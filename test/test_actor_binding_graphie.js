// Graphie canonique des bindings d'ACTEUR — CUTOVER 2026-07-14 (Romain GO, tour [411]).
// Règle gravée (décision hub 2026-06-26) : « `.` APPELLE un composant / `:` AFFECTE une valeur ».
//
// CANON sur la ligne d'acteur — TOUT composant se nomme avec `.` :
//   - alphabet  = @alphabet.<nom>       (sucre FACTORY legacy → properties.alphabet)
//   - transport = transport.<canal>(…)  (un transport prend des params ch/device → COMPOSANT,
//                                         PAS une valeur ; corrige b489933 qui l'avait mis en `:`)
// Les provenances @factory./@mine. NE se posent PAS sur la ligne d'acteur : une hauteur perso
// est un libRef de SCÈNE + un acteur transport-seul (2026-07-13 §Raccord sortie).
//
// CUTOVER (zéro rétrocompat, non-négociable Romain) : les formes d'entité en `:` (alphabet:X,
// transport:X, tuning:X, eval:X, sound:X) sont REJETÉES (fail-loud) — plus AUCUNE tolérance.

import { parse } from '../src/transpiler/parser.js';
import { tokenize } from '../src/transpiler/tokenizer.js';
import { compileBPS } from '../src/transpiler/index.js';

let ok = 0, ko = 0;
function assert(label, cond, detail) {
  if (cond) { ok++; console.log(`OK  ${label}`); }
  else { ko++; console.log(`KO  ${label}${detail !== undefined ? '  → ' + detail : ''}`); }
}
const actor0 = (src) => parse(tokenize(src)).actors[0];
// Compile et renvoie les messages d'erreur (le fail-loud remonte via ParseError capté).
function cries(src, needle) {
  try {
    parse(tokenize(src));
    return false; // pas d'erreur → ne crie pas
  } catch (e) {
    return typeof e.message === 'string' && e.message.includes(needle);
  }
}

console.log('\n=== CANON : @alphabet.<nom> + transport.<canal>(…) ===');
{
  const a = actor0('@core\n@controls\n@actor voice @alphabet.sargam transport.browser\nS -> sa\n');
  assert('@alphabet.sargam → properties.alphabet = sargam', a.properties.alphabet === 'sargam', JSON.stringify(a.properties.alphabet));
  assert('transport.browser → key = browser', a.properties.transport?.key === 'browser', JSON.stringify(a.properties.transport));
}
{
  const a = actor0('@core\n@controls\n@actor sitar @alphabet.sargam transport.midi(ch:3)\nS -> sa\n');
  assert('transport.midi(ch:3) → params.ch = 3 (composant + params)', a.properties.transport?.params?.ch === 3, JSON.stringify(a.properties.transport));
}

console.log('\n=== §71 : @mine.* NON posé sur la ligne d\'acteur → libRef de SCÈNE ===');
{
  const ast = parse(tokenize('@core\n@controls\n@actor voice transport.browser\n@mine.ragas.sargam\nS -> sa\n'));
  assert('acteur transport-seul : properties.alphabet ABSENT', ast.actors[0].properties.alphabet === undefined, JSON.stringify(ast.actors[0].properties.alphabet));
  assert('@mine.ragas.sargam → libRef de scène', JSON.stringify(ast.libRefs) === '["mine.ragas.sargam"]', JSON.stringify(ast.libRefs));
}

console.log('\n=== CUTOVER : l\'ancienne forme d\'entité en `:` CRIE désormais ===');
{
  assert('transport:browser (deux-points) → REJET fail-loud',
    cries('@core\n@controls\n@actor voice @alphabet.sargam transport:browser\nS -> sa\n', "transport:…"),
    'attendu ParseError transport:…');
  assert('alphabet:sargam (deux-points) → REJET fail-loud',
    cries('@core\n@controls\n@actor voice alphabet:sargam transport.webaudio\nS -> sa\n', "alphabet:…"),
    'attendu ParseError alphabet:…');
  assert('transport:midi(ch:3) (deux-points) → REJET fail-loud',
    cries('@core\n@controls\n@actor voice @alphabet.sargam transport:midi(ch:3)\nS -> sa\n', "transport:…"),
    'attendu ParseError transport:…');
  // Le message pointe le canon `.`
  let msg = '';
  try { parse(tokenize('@core\n@controls\n@actor voice transport:browser\nS -> sa\n')); }
  catch (e) { msg = e.message; }
  assert('le message pointe le canon `transport.<nom>`', msg.includes("transport.<nom>"), msg);
}

console.log('\n=== NON-RÉGRESSION : le `:` reste valide pour AFFECTER une valeur ===');
{
  // `sujet:sound.X` (une note reçoit un son) : le `:` affecte une valeur → toujours accepté.
  // Les affectations sont hoistées top-level en `scene.soundAssignments` (parser.js:181-189).
  const scene = parse(tokenize('@core\n@controls\n@actor voice @alphabet.sargam transport.browser\n  sa:sound.piano\nS -> sa\n'));
  assert('sa:sound.piano (affectation de valeur à un sujet) accepté',
    Array.isArray(scene.soundAssignments) && scene.soundAssignments.some((s) => s.subject === 'sa'),
    JSON.stringify(scene.soundAssignments));
}

console.log('\n=== BYTE-ID BP3 : les deux graphies dot canon = grammaire identique ===');
{
  // `@alphabet.sargam` et `alphabet.sargam` (point nu) sont deux graphies DOT équivalentes :
  // même canal legacy, même grammaire BP3 octet-pour-octet.
  const atForm  = '@core\n@controls\n@actor flute @alphabet.sargam octaves.western transport.midi\nflute -> sa re ga\n';
  const nuForm  = '@core\n@controls\n@actor flute alphabet.sargam octaves.western transport.midi\nflute -> sa re ga\n';
  assert('grammaire BP3 octet-identique (@alphabet.X vs alphabet.X)', compileBPS(atForm).grammar === compileBPS(nuForm).grammar);
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok} passés, ${ko} échoués`);
if (ko > 0) process.exit(1);
