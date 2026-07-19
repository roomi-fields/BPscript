/**
 * Test : outils sériels BPScript → BP3
 *
 * Vérifie que shuffle/order/retro/rotate et la graine sont émis correctement
 * dans le texte BP3 produit par compileBPS.
 *
 * Portée suffixe canonique :
 *   {a b c}[shuffle]  → {_rndseq a b c}       (marqueur DANS l'accolade)
 *   a b c [shuffle]   → _rndseq a b c          (fin de règle → tête de RHS)
 *   {a b c}[shuffle:42] → {_srand(42) _rndseq a b c}  (graine + shuffle)
 *   [rotate:2]  → _rotate(2)                   (engine, résolution bracket)
 *   (rotate:2)  → _script(CT…)                 (runtime, inchangé)
 *
 * Run: node test/test_serial_tools.js
 */

import { readFileSync } from 'fs';
import { compileBPS } from '../src/transpiler/index.js';
import { registerAll } from '../src/transpiler/libs.js';

const libs = {};
for (const name of ['alphabets', 'controls', 'octaves', 'tunings', 'temperaments', 'settings']) {
  libs[name] = JSON.parse(readFileSync(`lib/${name}.json`, 'utf8'));
}
registerAll(libs);

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, got) {
  if (condition) {
    passed++;
    console.log(`  OK : ${label}`);
  } else {
    failed++;
    failures.push({ label, got });
    console.error(`  FAIL: ${label}${got !== undefined ? `\n       got: ${got}` : ''}`);
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

function getRuleLine(src) {
  const r = compileBPS(src);
  if (r.errors && r.errors.length) {
    console.error('Compilation errors:', r.errors);
  }
  const lines = r.grammar.split('\n');
  return lines.find(l => l.includes('-->')) || '';
}

const HDR = `@controls
gate a:midi
gate b:midi
gate c:midi
gate d:midi
gate e:midi
gate f:midi
gate g:midi`;

// -----------------------------------------------------------------------
// 1. Suffixe groupe : marqueur sériel DANS l'accolade
// -----------------------------------------------------------------------

section('Suffixe groupe — marqueur DANS accolade');

{
  const line = getRuleLine(`${HDR}\nS -> {a b c d}[shuffle]`);
  assert(
    '{a b c d}[shuffle] → {_rndseq a b c d}',
    line.includes('{_rndseq a b c d}'),
    line
  );
}

{
  const line = getRuleLine(`${HDR}\nS -> {a b c d}[order]`);
  assert(
    '{a b c d}[order] → {_ordseq a b c d}',
    line.includes('{_ordseq a b c d}'),
    line
  );
}

// -----------------------------------------------------------------------
// 2. Portée large : groupe imbriqué
// -----------------------------------------------------------------------

section('Portée large — groupe imbriqué');

{
  const line = getRuleLine(`${HDR}\nS -> {{a b c d} {e f g}}[shuffle]`);
  assert(
    '{{a b c d} {e f g}}[shuffle] → {_rndseq {a b c d} {e f g}}',
    line.includes('{_rndseq {a b c d} {e f g}}'),
    line
  );
}

// -----------------------------------------------------------------------
// 3. Fin de règle : marqueur en tête de RHS
// -----------------------------------------------------------------------

section('Fin de règle — marqueur en tête de RHS');

{
  const line = getRuleLine(`${HDR}\nS -> a b c d [shuffle]`);
  assert(
    'a b c d [shuffle] → _rndseq a b c d',
    line.includes('_rndseq a b c d') && !line.includes('/shuffle/'),
    line
  );
}

{
  const line = getRuleLine(`${HDR}\nS -> a b c d [order]`);
  assert(
    'a b c d [order] → _ordseq a b c d',
    line.includes('_ordseq a b c d') && !line.includes('/order/'),
    line
  );
}

// -----------------------------------------------------------------------
// 4. Graine ORTHOGONALE : shuffle et graine sont séparés (refactor 2026-06-14).
//    - `[shuffle:N]` est RETIRÉ → erreur d'aiguillage (plus de _srand fusionné).
//    - la graine s'écrit `![@seed:N]` (dans le flux) → _srand(N) en tête de RHS.
// -----------------------------------------------------------------------

section('Graine orthogonale — [shuffle:N] retiré, graine via ![@seed:N]');

{
  const r = compileBPS(`${HDR}\nS -> {a b c d}[shuffle:42]`);
  const err = (r.errors && r.errors[0] && r.errors[0].message) || '';
  assert(
    '[shuffle:N] retiré → erreur qui aiguille vers @seed',
    (r.errors || []).length > 0 && /shuffle/.test(err) && /seed/.test(err),
    err
  );
}

{
  const line = getRuleLine(`${HDR}\nS -> ![@seed:42] {a b c d}[shuffle]`);
  assert(
    '![@seed:42] {a b c d}[shuffle] → _srand(42) {_rndseq a b c d}',
    line.includes('_srand(42)') && line.includes('{_rndseq a b c d}'),
    line
  );
}

// -----------------------------------------------------------------------
// 5. rotate : résolution par type de qualificateur
// -----------------------------------------------------------------------

section('rotate — engine [] vs runtime ()');

{
  const line = getRuleLine(`${HDR}\nS -> {a b c d}[rotate:2]`);
  assert(
    '[rotate:2] → _rotate(2)',
    line.includes('_rotate(2)') && !line.includes('_script'),
    line
  );
}

{
  // `rotate` est un contrôle MOTEUR (il figure dans `ENGINE_KEY`, `EBNF.md:669`), pas un
  // contrôle runtime. Il s'émet donc en natif `_rotate(2)` quelle que soit la graphie —
  // ce test attendait `_script(CT…)`, la forme d'avant sa reclassification.
  const r = compileBPS(`${HDR}\nS -> {a b c d}(rotate:2)`);
  const line = r.grammar.split('\n').find(l => l.includes('-->')) || '';
  assert(
    '(rotate:2) → _rotate(2) natif (contrôle MOTEUR, pas runtime)',
    line.includes('_rotate(2)'),
    `line=${line}`
  );
}

// -----------------------------------------------------------------------
// 6. retro (déjà engine) : doit toujours fonctionner
// -----------------------------------------------------------------------

section('retro — inchangé');

{
  const line = getRuleLine(`${HDR}\nS -> {a b c d}[retro]`);
  // retro est engine-native → _retro dans la sortie
  assert(
    '{a b c d}[retro] → contient _retro',
    line.includes('_retro'),
    line
  );
}

// -----------------------------------------------------------------------
// 7. Non-régression : speed/scale restent corrects
// -----------------------------------------------------------------------

section('Non-régression — durée « :N » et scale inchangés');

{
  // `speed` est SUPPRIMÉ (décision 2026-06-26 : la durée le subsume). La forme vivante est
  // `{…}:N`. Ce test exigeait que `[speed:2]` compile — troisième occurrence de cette même
  // attente périmée dans le corpus de tests.
  const line = getRuleLine(`${HDR}\nS -> {a b c d}:2`);
  assert(
    '{a b c d}:2 → {2,a b c d}',
    line.includes('{2,a b c d}'),
    line
  );
}

{
  const line = getRuleLine(`${HDR}\nS -> {a b c d}[scale:3]`);
  assert(
    '{a b c d}[scale:3] → *3 {a b c d}',
    line.includes('*3 {a b c d}'),
    line
  );
}

// -----------------------------------------------------------------------
// Résumé
// -----------------------------------------------------------------------

console.log(`\n--- Résumé ---`);
console.log(`Passé : ${passed}  Échoué : ${failed}`);
if (failures.length > 0) {
  console.log('\nÉchecs détaillés :');
  for (const f of failures) {
    console.log(`  - ${f.label}${f.got ? `\n    got: ${f.got}` : ''}`);
  }
  process.exit(1);
}
