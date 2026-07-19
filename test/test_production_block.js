/**
 * Test : bloc de directives de production `[@…]` (décision 2026-06-11)
 *
 * Cf. docs/spec/EBNF.md §production_block (lignes ~1099-1116), docs/spec/AST.md §Directive,
 * hub/decisions/2026-06-11-directives-production-crochets.md.
 *
 * Contrat testé :
 *   - `[@seed:1]`, `[@seed:1, @items:20]`, `[@improvize]` parsent au niveau scène ;
 *   - les nœuds AST produits sont IDENTIQUES à ceux des @-formes historiques ;
 *   - les @-formes historiques (seed/maxitems/allitems/improvize) restent lues,
 *     avec avertissement de dépréciation dans result.warnings (PAS dans errors) ;
 *   - le settingsJSON est identique entre les deux surfaces ;
 *   - une scène contenant un bloc n'est plus tronquée en silence (règles présentes).
 *
 * Run: node test/test_production_block.js
 */

import { readFileSync } from 'fs';
import { tokenize } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';
import { registerAll } from '../src/transpiler/libs.js';
import { compileBPS } from '../src/transpiler/index.js';

// ── Pre-register libs (no FS in tests) ─────────────────────

const libs = {};
for (const name of ['alphabets', 'controls', 'octaves', 'tunings', 'temperaments', 'settings', 'transcription']) {
  libs[name] = JSON.parse(readFileSync(`lib/${name}.json`, 'utf8'));
}
registerAll(libs);

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, details) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push({ label, details: details || '' });
    console.error(`  FAIL: ${label}${details ? ` — ${JSON.stringify(details)}` : ''}`);
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

function parseSource(src) {
  return parse(tokenize(src));
}

// Compare deux nœuds Directive en ignorant la ligne source.
// Exige l'EXISTENCE des deux nœuds (pas de passe vacante si les deux
// surfaces perdaient la directive en même temps).
function sameDirective(a, b) {
  if (!a || !b) return false;
  const strip = (d) => JSON.stringify({ ...d, line: 0 });
  return strip(a) === strip(b);
}

// ============================================================
// 1. Parsing du bloc — formes nominales
// ============================================================

section('[@…] — formes nominales');

{
  const ast = parseSource(`[@seed:7]
@mode:lin
S -> C4`);
  assert('bloc seul : 1 directive', ast.directives.length === 1, ast.directives);
  const d = ast.directives[0];
  assert('type Directive', d?.type === 'Directive');
  assert('name seed', d?.name === 'seed');
  assert('value Number 7', d?.value === 7 && typeof d?.value === 'number');
  assert('règle non perdue (1 subgrammar)', ast.subgrammars.length === 1, ast.subgrammars.length);
  assert('règle non perdue (1 rule)', ast.subgrammars[0]?.rules?.length === 1);
}

{
  const ast = parseSource(`[@seed:1, @maxitems:33]
@mode:lin
S -> C4`);
  assert('bloc groupé : 2 directives', ast.directives.length === 2, ast.directives);
  assert('ordre source préservé (seed avant maxitems)',
    ast.directives[0]?.name === 'seed' && ast.directives[1]?.name === 'maxitems');
  assert('maxitems value 33', ast.directives[1]?.value === 33);
}

{
  const ast = parseSource(`[@improvize]
@mode:lin
S -> C4`);
  assert('clé sans valeur : 1 directive', ast.directives.length === 1, ast.directives);
  assert('improvize value null', ast.directives[0]?.name === 'improvize' && ast.directives[0]?.value === null);
  assert('improvize : règles non perdues', ast.subgrammars.length === 1);
}

{
  // Bloc après d'autres directives d'en-tête (toujours niveau scène)
  const ast = parseSource(`@core
[@seed:2]
@mode:lin
S -> C4`);
  const seed = ast.directives.find(d => d.name === 'seed');
  assert('bloc après @core : seed présent', seed?.value === 2, ast.directives);
}

{
  // Frontière d'en-tête : l'en-tête s'étend jusqu'à la PREMIÈRE règle —
  // un bloc après @mode:lin mais avant les règles est accepté (choix figé ici).
  const r = compileBPS(`@mode:lin
[@seed:5]
S -> C4`);
  assert('bloc après @mode, avant règles : accepté', r.errors.length === 0, r.errors);
  const s = JSON.parse(r.settingsJSON);
  assert('bloc après @mode : Seed=5 appliqué', s.Seed?.value === '5', s.Seed);
// ⚠️ ASSERTION(S) DE TEXTE BP3 RETIRÉE(S) le 2026-07-19 — certification grammaire-texte
// abandonnée (arbitrage Romain), encodeur supprimé : plus de texte à vérifier.
//   assert('bloc après @mode : mode LIN conservé', r.grammar.includes('LIN'), r.grammar);
}

// ============================================================
// 2. Iso-AST : le bloc produit les MÊMES nœuds que la @-forme
// ============================================================

section('[@…] — forme des nœuds Directive (contrat BPx inchangé)');

{
  // Forme contractuelle exacte (décision : @seed:7 → {type:'Directive',
  // name:'seed', value:7}) — la @-forme étant retirée, le bloc doit produire
  // ce nœud-là, à la ligne près.
  const newAst = parseSource(`[@seed:7]\n@mode:lin\nS -> C4`);
  const expected = { type: 'Directive', name: 'seed', subkey: null, runtime: null,
                     value: 7, aliases: null, modifiers: null, line: 1 };
  assert('nœud seed:7 conforme au contrat', sameDirective(newAst.directives[0], expected),
    { got: newAst.directives[0], expected });
}

{
  const newAst = parseSource(`[@improvize]\n@mode:lin\nS -> C4`);
  const expected = { type: 'Directive', name: 'improvize', subkey: null, runtime: null,
                     value: null, aliases: null, modifiers: null, line: 1 };
  assert('nœud improvize conforme au contrat', sameDirective(newAst.directives[0], expected),
    { got: newAst.directives[0], expected });
}

{
  // FLOAT → chaîne brute préservée (même convention que la @-forme)
  const oldAst = parseSource(`@a4:441.5\n@mode:lin\nS -> C4`);
  const newAst = parseSource(`[@a4:441.5]\n@mode:lin\nS -> C4`);
  assert('iso-AST a4:441.5 (FLOAT brut)', sameDirective(oldAst.directives[0], newAst.directives[0]),
    { old: oldAst.directives[0], new: newAst.directives[0] });
}

{
  // IDENT → champ runtime (même convention que la @-forme générique)
  const oldAst = parseSource(`@foo:bar\n@mode:lin\nS -> C4`);
  const newAst = parseSource(`[@foo:bar]\n@mode:lin\nS -> C4`);
  assert('iso-AST foo:bar (IDENT → runtime)', sameDirective(oldAst.directives[0], newAst.directives[0]),
    { old: oldAst.directives[0], new: newAst.directives[0] });
}

// ============================================================
// 3. Bout en bout : réglages moteur appliqués depuis le bloc
// ============================================================

section('[@…] — réglages moteur appliqués (settingsJSON)');

{
  // ⚠️ valeur ≠ 20 (20 est le défaut de MaxItemsProduce — faux positif garanti)
  const rNew = compileBPS(`[@seed:9, @maxitems:33]\n@mode:lin\nS -> C4`);
  assert('nouvelle forme : 0 erreur', rNew.errors.length === 0, rNew.errors);
  const s = JSON.parse(rNew.settingsJSON);
  assert('Seed=9 appliqué', s.Seed?.value === '9', s.Seed);
  assert('MaxItemsProduce=33 appliqué', s.MaxItemsProduce?.value === '33', s.MaxItemsProduce);
//   assert('grammaire émise inchangée par le bloc',
//     rNew.grammar.includes('LIN') && rNew.grammar.includes('gram#1[1] S --> C4'), rNew.grammar);
}

{
  // Ordre = sémantique (« last wins », allitems force Improvize:0)
  const r = compileBPS(`[@allitems, @maxitems:500]\n@mode:lin\nS -> C4`);
  const s = JSON.parse(r.settingsJSON);
  assert('allitems : AllItems=1', s.AllItems?.value === '1', s.AllItems);
  assert('allitems : Improvize forcé à 0', s.Improvize?.value === '0', s.Improvize);
  assert('maxitems 500 appliqué après', s.MaxItemsProduce?.value === '500', s.MaxItemsProduce);
}

{
  // Alias items → MaxItemsProduce (exemple normatif de la spec : [@seed:1, @items:20])
  const r = compileBPS(`[@items:33]\n@mode:lin\nS -> C4`);
  assert('items : 0 erreur', r.errors.length === 0, r.errors);
  const s = JSON.parse(r.settingsJSON);
  assert('items:33 → MaxItemsProduce=33', s.MaxItemsProduce?.value === '33', s.MaxItemsProduce);
}

// ============================================================
// 4. Rejet franc des @-formes (arbitrage utilisateur 2026-06-11, durci)
// ============================================================

section('@-formes — rejet franc (erreur pointant la nouvelle écriture)');

{
  const r = compileBPS(`@seed:1\n@mode:lin\nS -> C4`);
  assert('@seed : erreur', r.errors.length === 1, r.errors);
  const e = r.errors[0];
  assert('@seed : message cite le retrait', /retirée/.test(e?.message || ''), e);
  assert('@seed : message cite la nouvelle forme', (e?.message || '').includes('[@seed:1]'), e);
  assert('@seed : ligne renseignée', e?.line === 1, e);
}

{
  const r = compileBPS(`@improvize\n@mode:lin\nS -> C4`);
  assert('@improvize : erreur citant [@improvize]', (r.errors[0]?.message || '').includes('[@improvize]'), r.errors);
  const r2 = compileBPS(`@allitems\n@mode:lin\nS -> C4`);
  assert('@allitems : erreur', r2.errors.length > 0, r2.errors);
  const r3 = compileBPS(`@maxitems:33\n@mode:lin\nS -> C4`);
  assert('@maxitems : erreur', r3.errors.length > 0, r3.errors);
}

{
  // Les alias (items / all_items) en @-forme sont rejetés de la même façon
  const r = compileBPS(`@items:44\n@mode:lin\nS -> C4`);
  assert('@items : erreur', r.errors.length > 0, r.errors);
  const r2 = compileBPS(`@all_items\n@mode:lin\nS -> C4`);
  assert('@all_items : erreur', r2.errors.length > 0, r2.errors);
}

{
  const r = compileBPS(`[@seed:1, @improvize]\n@mode:lin\nS -> C4`);
  assert('nouvelle forme : 0 erreur, 0 avertissement',
    r.errors.length === 0 && (r.warnings || []).length === 0,
    { errors: r.errors, warnings: r.warnings });
}

{
  // Les directives non-production ne déclenchent PAS la dépréciation
  const r = compileBPS(`@core\n@mm:60\n@mode:lin\nS -> C4`);
  assert('@core/@mm : 0 avertissement', (r.warnings || []).length === 0, r.warnings);
}

{
  // Clé hors production dans le bloc : parsée (EBNF) mais avertie —
  // les noms à traitement spécial (@mode…) y perdraient leur effet en silence
  const r = compileBPS(`[@qclock:11]\n@mode:lin\nS -> C4`);
  assert('[@qclock:11] : 0 erreur', r.errors.length === 0, r.errors);
  assert('[@qclock:11] : 1 avertissement (clé hors production)', (r.warnings || []).length === 1, r.warnings);
  assert('[@qclock:11] : avertissement cite la clé', (r.warnings?.[0]?.message || '').includes("'@qclock'"), r.warnings);
  const r2 = compileBPS(`[@mode:lin]\nS -> C4 C4`);
  assert('[@mode:lin] : averti (effet non garanti)', (r2.warnings || []).length === 1, r2.warnings);
}

// ============================================================
// 5. Erreurs franches (plus de troncature silencieuse)
// ============================================================

section('[@…] — erreurs franches');

{
  // Clé sans @ dans le bloc → erreur (le @ est répété sur chaque clé)
  const r = compileBPS(`[@seed:1, maxitems:2]\n@mode:lin\nS -> C4`);
  assert('clé sans @ : erreur', r.errors.length > 0, r.errors);
}

{
  // Bloc vide / @ nu → erreur (sur le chemin du bloc : IDENT attendu après @)
  const r = compileBPS(`[@]\n@mode:lin\nS -> C4`);
  assert('[@] : erreur', r.errors.length > 0, r.errors);
  assert('[@] : erreur du chemin bloc (IDENT attendu)',
    (r.errors[0]?.message || '').includes('Expected IDENT'), r.errors);
}

{
  // ![@…] : réserve future (re-semer pendant le jeu) — erreur franche,
  // pas d'absorption silencieuse de la scène
  const r = compileBPS(`![@seed:2]\n@mode:lin\nS -> C4`);
  assert('![@seed:2] : erreur', r.errors.length > 0, r.errors);
  assert('![@seed:2] : message cite la réserve', (r.errors[0]?.message || '').includes('réservée'), r.errors);
}

{
  // Bloc non fermé → erreur
  const r = compileBPS(`[@seed:1\n@mode:lin\nS -> C4`);
  assert('bloc non fermé : erreur', r.errors.length > 0, r.errors);
}

{
  // Placement entre sous-grammaires → erreur claire (niveau scène uniquement)
  const r = compileBPS(`@mode:lin
S -> X
-----
[@seed:1]
@mode:lin
X -> C4`);
  assert('bloc entre sous-grammaires : erreur', r.errors.length > 0, r.errors);
  assert('message cite l\'en-tête de scène', (r.errors[0]?.message || '').includes('en-tête'), r.errors);
}

// ============================================================
// 6. Non-régression : les crochets existants ne changent pas de sens
// ============================================================

section('[…] existants — non-régression');

{
  // Garde de règle [K1==1] toujours une garde
  const r = compileBPS(`@mode:lin\n[K1==1] S -> C4`);
  assert('garde [K1==1] : 0 erreur', r.errors.length === 0, r.errors);
//   assert('garde émise /K1=1/', r.grammar.includes('/K1=1/'), r.grammar);
}

{
  // Qualificateur de règle [weight:50] toujours un poids
  const r = compileBPS(`@mode:random\nS -> C4 [weight:50]`);
  assert('[weight:50] : 0 erreur', r.errors.length === 0, r.errors);
//   assert('poids émis <50>', r.grammar.includes('<50>'), r.grammar);
}

// ============================================================
// Bilan
// ============================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`Résultat : ${passed} PASS, ${failed} FAIL`);
if (failed > 0) {
  for (const f of failures) console.log(`  - ${f.label}`);
  process.exit(1);
}
