/**
 * Test : argument d'INTERVALLE MUSICAL des contrôles interval-typés (transpose réelle).
 *
 * Décision RATIFIÉE (hub/decisions/2026-07-11-transposition-reelle-vs-scalaire.md) :
 * `transpose` devient la transposition RÉELLE, son argument est un INTERVALLE dans les
 * 3 formats des tempéraments — fraction 3/2, cents 700c, décimal 1.5. Le lecteur de
 * surface (parser.js, parseRuntimeQualifier) porte la valeur BRUTE (chaîne) ; la
 * résolution (Kairos, normalizeRatio) la normalise. Un contrôle est interval-typé
 * quand sa def de lib porte `argType:"interval"` (libs.js, ctx.intervalControls).
 *
 * NB : `transpose` (lib/controls.json:458, `argType:"interval"`) EST interval-typé
 * EN PROD depuis le GO architecte du 2026-07-11 (commit BPscript 854f62f,
 * hub/decisions/2026-07-11-transposition-reelle-vs-scalaire.md) — cf. section 5
 * plus bas, qui le PROUVE (`prodCtx.intervalControls.has('transpose')`). Les
 * formats/erreurs des sections 1-4 restent prouvés sur une lib de test éphémère,
 * indépendante de la prod.
 *
 * Run: node test/test_interval_arg.js
 */

import '../src/transpiler/index.js';   // la porte : elle branche le compilateur sur son chargeur (2026-09-02)
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const BUNDLED = leRegistre();
import { readFileSync } from 'fs';
import { tokenize } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';
import { registerAll, registerLib, loadLibsFromDirectives } from '../src/transpiler/libs.js';

// ── Pre-register prod libs (no FS in the parser itself) ────
const libs = {};
for (const name of ['alphabets', 'expression', 'midi', 'audio', 'transpo', 'engine', 'octaves', 'tunings', 'temperaments', 'settings', 'homomorphism']) {
  // ⚠️ LA DONNÉE SE LIT AU BUNDLE, JAMAIS SUR LE DISQUE — et c'est l'avertissement que porte déjà
  // `lib/digital.json` : « un CONSOMMATEUR doit charger depuis le BUNDLE, jamais lire ce JSON sur le
  // disque ». Depuis le 2026-08-13 une librairie peut s'écrire en BPScript (`lib/audio.bps`) : lire
  // `lib/<nom>.json` fait alors tomber le test sur un fichier absent, et lui ferait rater la donnée
  // si le fichier existait encore par ailleurs. Le bundle est la source unique des consommateurs.
  libs[name] = BUNDLED[name];
}
registerAll(libs);

// ── Lib de TEST éphémère : un contrôle interval-typé, sans toucher la prod ──
// ⛔ LA SECTION EST `controls`, ET `groups` EST SORTIE DU FORMAT — décision de Romain, 2026-09-04 :
// « le seul qui est légitime est resolvedBy ». Ce banc posait son contrôle dans `groups.dispatcher`,
// une section que le compilateur acceptait encore et qu'aucune librairie n'écrivait ; il était donc
// le dernier à la tenir en vie. Il déclare maintenant sa librairie comme les vingt-deux vraies.
registerLib('ivltest', {
  name: 'ivltest', type: 'controls', resolvedBy: 'Kairos',
  controls: {
    ivl: { args: ['interval'], argType: 'interval', default: 0, description: 'test interval control' },
  },
});

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, details) {
  if (cond) { passed++; } else { failed++; failures.push({ label, details: details || '' }); console.error(`  FAIL: ${label}${details ? ` — ${details}` : ''}`); }
}
function section(name) { console.log(`\n=== ${name} ===`); }

const HEAD = 'ivltest\nalphabet.western\n\n';

// Récupère la 1re valeur portée pour la clé 'ivl' dans l'AST (SettingBag.pairs).
function ivlValue(src) {
  const ast = parse(tokenize(src));
  let found;
  JSON.stringify(ast, (k, v) => {
    if (v && typeof v === 'object' && v.key === 'ivl' && found === undefined) found = v.value;
    return v;
  });
  return found;
}
function throwsOn(src) {
  try { parse(tokenize(src)); return null; } catch (e) { return e.message; }
}

// ── 1. Les trois formats portent la CHAÎNE BRUTE ─────────
section('Formats valides — valeur portée brute');
assert('fraction 3/2', ivlValue(HEAD + '-----\nTr -> (ivl:3/2)') === '3/2', String(ivlValue(HEAD + '-----\nTr -> (ivl:3/2)')));
assert('cents 700c', ivlValue(HEAD + '-----\nTr -> (ivl:700c)') === '700c', String(ivlValue(HEAD + '-----\nTr -> (ivl:700c)')));
assert('décimal 1.5', ivlValue(HEAD + '-----\nTr -> (ivl:1.5)') === '1.5', String(ivlValue(HEAD + '-----\nTr -> (ivl:1.5)')));
assert('entier nu = ratio 2', ivlValue(HEAD + '-----\nTr -> (ivl:2)') === '2', String(ivlValue(HEAD + '-----\nTr -> (ivl:2)')));

// ── 2. Signe négatif (intervalle descendant) : cents & décimal ──
section('Intervalle descendant');
assert('cents négatifs -200c', ivlValue(HEAD + '-----\nS -> C4 !(ivl:-200c) D4') === '-200c', String(ivlValue(HEAD + '-----\nS -> C4 !(ivl:-200c) D4')));
assert('décimal négatif -1.5', ivlValue(HEAD + '-----\nTr -> (ivl:-1.5)') === '-1.5', String(ivlValue(HEAD + '-----\nTr -> (ivl:-1.5)')));

// ── 3. Positions : autonome, simultané, suffixe, multi-pair ──
section('Positions de contrôle');
assert('suffixe C4(ivl:3/2)', ivlValue(HEAD + '-----\nS -> C4(ivl:3/2) D4') === '3/2', String(ivlValue(HEAD + '-----\nS -> C4(ivl:3/2) D4')));
assert('multi-pair s\'arrête à la virgule', ivlValue(HEAD + '-----\nS -> C4(ivl:700c,vel:80) D4') === '700c', String(ivlValue(HEAD + '-----\nS -> C4(ivl:700c,vel:80) D4')));

// ── 4. Malformé → CRIE en nommant la faute (L26, pas de repli) ──
section('Malformé — le compilateur crie');
assert('non-nombre foo', /Malformed interval/.test(throwsOn(HEAD + '-----\nTr -> (ivl:foo)') || ''), throwsOn(HEAD + '-----\nTr -> (ivl:foo)'));
assert('dénominateur manquant 3/', /denominator/.test(throwsOn(HEAD + '-----\nTr -> (ivl:3/)') || ''), throwsOn(HEAD + '-----\nTr -> (ivl:3/)'));
assert('unité inconnue 3x', /unknown unit/.test(throwsOn(HEAD + '-----\nTr -> (ivl:3x)') || ''), throwsOn(HEAD + '-----\nTr -> (ivl:3x)'));
assert('fraction négative -3/2', /is not written negative/.test(throwsOn(HEAD + '-----\nTr -> (ivl:-3/2)') || ''), throwsOn(HEAD + '-----\nTr -> (ivl:-3/2)'));
// Guillemets : la forme canonique est NUE — le message nomme les guillemets, PAS les formats (msg [379])
assert('guillemets "700c" → nomme les guillemets', /in quotes/.test(throwsOn(HEAD + '-----\nTr -> (ivl:"700c")') || ''), throwsOn(HEAD + '-----\nTr -> (ivl:"700c")'));
assert('guillemets → suggère la forme nue', /BARE form '700c'/.test(throwsOn(HEAD + '-----\nTr -> (ivl:"700c")') || ''), throwsOn(HEAD + '-----\nTr -> (ivl:"700c")'));

// ── 5. ACTIVATION en prod : transpose EST interval-typé (décision 2026-07-11) ──
// `controls` SUPPRIMÉ le 2026-08-10 (Romain) : `transpose` vit dans `lib/transpo.json`,
// amené par `core` comme toute scène réelle l'invoque désormais (core.apporte).
section('Activation — transpose réel en prod');
const prodCtx = loadLibsFromDirectives([{ name: 'core' }]);
assert('intervalControls existe', prodCtx.intervalControls instanceof Set, typeof prodCtx.intervalControls);
assert('transpose est interval-typé en prod', prodCtx.intervalControls.has('transpose'), `set=${[...prodCtx.intervalControls]}`);
// transpose de prod : lu comme INTERVALLE (chaîne brute), pas comme entier
{
  const ast = parse(tokenize('core\nalphabet.western\n\n-----\nTr -> (transpose:-2400c)'));
  let v;
  JSON.stringify(ast, (k, val) => { if (val && val.key === 'transpose' && v === undefined) v = val.value; return val; });
  assert('transpose:-2400c → "-2400c" (intervalle, chaîne)', v === '-2400c', String(v));
}
// transpose global : émis en chaîne d'intervalle (forme nue), pas en nombre
{
  const ast = parse(tokenize('core\nalphabet.western\ntranspose:3/2\n\n-----\nS -> C4 D4'));
  let v;
  JSON.stringify(ast, (k, val) => { if (val && val.type === 'Directive' && val.name === 'transpose' && v === undefined) v = val.value; return val; });
  assert('transpose:3/2 global → "3/2" (chaîne)', v === '3/2', String(v));
}

// ── Bilan ─────────────────────────────────────────────────
console.log(`\n${failed === 0 ? 'OK' : 'ÉCHEC'} — ${passed} passés, ${failed} échoués`);
if (failed > 0) { for (const f of failures) console.error(`  - ${f.label}: ${f.details}`); process.exit(1); }
