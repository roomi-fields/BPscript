// GARDE ANTI-DÉRIVE — CUTOVER graphie UNIVERSEL (Romain 2026-07-14, tour [412]).
// « Le canon `.` (composant) / `:` (valeur) appliqué à TOUT axe-composant, SANS TROU. »
//
// Ce test itère l'AUTORITÉ MACHINE des axes-composants (describeVocabulary().components, dérivée
// de lib/core.json schema.catalogAxes) et prouve, pour CHACUN, la morsure 2 sens :
//   - `@axe:<entrée>`  (deux-points) → REJETÉ fail-loud  (l'opérande est un nom de catalogue)
//   - `@axe.<entrée>`  (point)       → ACCEPTÉ            (canon)
// Si un jour on AJOUTE un axe à catalogue (core.json) sans que le parser le rejette en `:`, ce
// test ÉCHOUE — on ne retrouvera plus jamais un axe-composant oublié qui tolère l'ancienne forme.
//
// Réf : parser.js CATALOG_AXIS_KEYS (doit rester le miroir de core.json schema.catalogAxes) ;
//       libs.js describeVocabulary().components ; décision hub 2026-06-26 (« . appelle / : affecte »).

import { parse } from '../src/transpiler/parser.js';
import { tokenize } from '../src/transpiler/tokenizer.js';
import { describeVocabulary } from '../src/transpiler/libs.js';

let ok = 0, ko = 0;
function assert(label, cond, detail) {
  if (cond) { ok++; console.log(`OK  ${label}`); }
  else { ko++; console.log(`KO  ${label}${detail !== undefined ? '  → ' + detail : ''}`); }
}
function rejects(src, needle) {
  try { parse(tokenize(src)); return false; }
  catch (e) { return typeof e.message === 'string' && (!needle || e.message.includes(needle)); }
}
function accepts(src) {
  try { parse(tokenize(src)); return true; } catch { return false; }
}

const components = describeVocabulary().components;
const axes = Object.keys(components);
console.log(`\n=== Axes-composants audités (autorité machine) : ${axes.join(', ')} ===`);
assert('au moins alphabet/tuning/octaves/scale sont des axes-composants',
  ['alphabet', 'tuning', 'octaves', 'scale'].every((a) => axes.includes(a)), axes.join(', '));

for (const axis of axes) {
  const entry = (components[axis] || [])[0];
  if (!entry) { assert(`${axis} : au moins une entrée de catalogue`, false, 'catalogue vide'); continue; }
  // Morsure 2 sens sur une entrée RÉELLE du catalogue de l'axe.
  assert(`@${axis}:${entry} (deux-points) → REJET fail-loud`,
    rejects(`@core\n@controls\n@${axis}:${entry}\nS -> C4\n`, `@${axis}:<X>`));
  assert(`@${axis}.${entry} (point) → ACCEPTÉ (canon)`,
    accepts(`@core\n@controls\n@${axis}.${entry}\nS -> C4\n`));
}

// Garde de non-régression : le `:` RESTE le canon des VALEURS (hors-scope du rejet).
console.log('\n=== Le `:` reste valide pour les VALEURS (jamais rejeté) ===');
for (const val of ['@tempo:120', '@diapason:432', '@meter:4/4', '@transpose:24']) {
  assert(`${val} (valeur) → ACCEPTÉ`, accepts(`@core\n@controls\n${val}\nS -> C4\n`), val);
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok} passés, ${ko} échoués`);
if (ko > 0) process.exit(1);
