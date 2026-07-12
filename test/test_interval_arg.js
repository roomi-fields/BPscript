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
 * NB : au moment d'écrire ce test, AUCUN contrôle de PROD n'est encore marqué
 * interval-typé (le marquage de lib est une action de FRONTIÈRE gelée jusqu'au GO
 * Kairos). On prouve donc le MÉCANISME via une lib de test éphémère, et on vérifie
 * la DORMANCE en prod (zéro régression).
 *
 * Run: node test/test_interval_arg.js
 */

import { readFileSync } from 'fs';
import { tokenize } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';
import { registerAll, registerLib, loadLibsFromDirectives } from '../src/transpiler/libs.js';

// ── Pre-register prod libs (no FS in the parser itself) ────
const libs = {};
for (const name of ['alphabets', 'controls', 'octaves', 'tunings', 'temperaments', 'settings', 'transcription']) {
  libs[name] = JSON.parse(readFileSync(`lib/${name}.json`, 'utf8'));
}
registerAll(libs);

// ── Lib de TEST éphémère : un contrôle interval-typé, sans toucher la prod ──
registerLib('ivltest', {
  name: 'ivltest', type: 'controls',
  runtime: { dispatcher: {
    ivl: { args: ['interval'], argType: 'interval', default: 0, description: 'test interval control' },
  } },
});

let passed = 0, failed = 0;
const failures = [];
function assert(label, cond, details) {
  if (cond) { passed++; } else { failed++; failures.push({ label, details: details || '' }); console.error(`  FAIL: ${label}${details ? ` — ${details}` : ''}`); }
}
function section(name) { console.log(`\n=== ${name} ===`); }

const HEAD = '@ivltest\n@alphabet.western\n\n';

// Récupère la 1re valeur portée pour la clé 'ivl' dans l'AST (RuntimeQualifier.pairs).
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
assert('fraction 3/2', ivlValue(HEAD + 'Tr -> (ivl:3/2)') === '3/2', String(ivlValue(HEAD + 'Tr -> (ivl:3/2)')));
assert('cents 700c', ivlValue(HEAD + 'Tr -> (ivl:700c)') === '700c', String(ivlValue(HEAD + 'Tr -> (ivl:700c)')));
assert('décimal 1.5', ivlValue(HEAD + 'Tr -> (ivl:1.5)') === '1.5', String(ivlValue(HEAD + 'Tr -> (ivl:1.5)')));
assert('entier nu = ratio 2', ivlValue(HEAD + 'Tr -> (ivl:2)') === '2', String(ivlValue(HEAD + 'Tr -> (ivl:2)')));

// ── 2. Signe négatif (intervalle descendant) : cents & décimal ──
section('Intervalle descendant');
assert('cents négatifs -200c', ivlValue(HEAD + 'S -> C4 !(ivl:-200c) D4') === '-200c', String(ivlValue(HEAD + 'S -> C4 !(ivl:-200c) D4')));
assert('décimal négatif -1.5', ivlValue(HEAD + 'Tr -> (ivl:-1.5)') === '-1.5', String(ivlValue(HEAD + 'Tr -> (ivl:-1.5)')));

// ── 3. Positions : autonome, simultané, suffixe, multi-pair ──
section('Positions de contrôle');
assert('suffixe C4(ivl:3/2)', ivlValue(HEAD + 'S -> C4(ivl:3/2) D4') === '3/2', String(ivlValue(HEAD + 'S -> C4(ivl:3/2) D4')));
assert('multi-pair s\'arrête à la virgule', ivlValue(HEAD + 'S -> C4(ivl:700c,vel:80) D4') === '700c', String(ivlValue(HEAD + 'S -> C4(ivl:700c,vel:80) D4')));

// ── 4. Malformé → CRIE en nommant la faute (L26, pas de repli) ──
section('Malformé — le compilateur crie');
assert('non-nombre foo', /Intervalle malforme/.test(throwsOn(HEAD + 'Tr -> (ivl:foo)') || ''), throwsOn(HEAD + 'Tr -> (ivl:foo)'));
assert('dénominateur manquant 3/', /denominateur/.test(throwsOn(HEAD + 'Tr -> (ivl:3/)') || ''), throwsOn(HEAD + 'Tr -> (ivl:3/)'));
assert('unité inconnue 3x', /unite inconnue/.test(throwsOn(HEAD + 'Tr -> (ivl:3x)') || ''), throwsOn(HEAD + 'Tr -> (ivl:3x)'));
assert('fraction négative -3/2', /fraction ne se note pas negative/.test(throwsOn(HEAD + 'Tr -> (ivl:-3/2)') || ''), throwsOn(HEAD + 'Tr -> (ivl:-3/2)'));
// Guillemets : la forme canonique est NUE — le message nomme les guillemets, PAS les formats (msg [379])
assert('guillemets "700c" → nomme les guillemets', /entre guillemets/.test(throwsOn(HEAD + 'Tr -> (ivl:"700c")') || ''), throwsOn(HEAD + 'Tr -> (ivl:"700c")'));
assert('guillemets → suggère la forme nue', /forme NUE '700c'/.test(throwsOn(HEAD + 'Tr -> (ivl:"700c")') || ''), throwsOn(HEAD + 'Tr -> (ivl:"700c")'));

// ── 5. ACTIVATION en prod : transpose EST interval-typé (décision 2026-07-11) ──
section('Activation — transpose réel en prod');
const prodCtx = loadLibsFromDirectives([{ name: 'controls' }]);
assert('intervalControls existe', prodCtx.intervalControls instanceof Set, typeof prodCtx.intervalControls);
assert('transpose est interval-typé en prod', prodCtx.intervalControls.has('transpose'), `set=${[...prodCtx.intervalControls]}`);
// transpose de prod : lu comme INTERVALLE (chaîne brute), pas comme entier
{
  const ast = parse(tokenize('@controls\n@alphabet.western\n\nTr -> (transpose:-2400c)'));
  let v;
  JSON.stringify(ast, (k, val) => { if (val && val.key === 'transpose' && v === undefined) v = val.value; return val; });
  assert('transpose:-2400c → "-2400c" (intervalle, chaîne)', v === '-2400c', String(v));
}
// @transpose global : émis en chaîne d'intervalle (forme nue), pas en nombre
{
  const ast = parse(tokenize('@controls\n@alphabet.western\n@transpose:3/2\n\nS -> C4 D4'));
  let v;
  JSON.stringify(ast, (k, val) => { if (val && val.type === 'Directive' && val.name === 'transpose' && v === undefined) v = val.value; return val; });
  assert('@transpose:3/2 global → "3/2" (chaîne)', v === '3/2', String(v));
}

// ── Bilan ─────────────────────────────────────────────────
console.log(`\n${failed === 0 ? 'OK' : 'ÉCHEC'} — ${passed} passés, ${failed} échoués`);
if (failed > 0) { for (const f of failures) console.error(`  - ${f.label}: ${f.details}`); process.exit(1); }
