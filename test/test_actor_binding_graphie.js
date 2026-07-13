// LAN-8 — graphie canonique des bindings d'ACTEUR (décision hub 2026-06-26 « . appelle un
// composant / : affecte une valeur » + invocation 2026-07-13 §Raccord sortie).
//
// CANON sur la ligne d'acteur :
//   - alphabet = @alphabet.<nom>   (le `.` appelle le composant ; sucre FACTORY legacy →
//                                    properties.alphabet, canal legacy résolu au compile)
//   - sortie   = transport:<canal> (le `:` affecte la valeur ; params conservés)
// Les provenances @factory./@mine. NE se posent PAS sur la ligne d'acteur : une hauteur perso
// est un libRef de SCÈNE + un acteur transport-seul (2026-07-13 §Raccord sortie).
//
// TRANSITION (accept-both) : les anciennes formes `alphabet.X` (point nu), `alphabet:X` (deux-
// points) et `transport.X` (point) restent ACCEPTÉES tant que la migration du corpus kanopi
// n'est pas faite (un hard-reject est une action de FRONTIÈRE, coordonnée par l'architecte).

import { parse } from '../src/transpiler/parser.js';
import { tokenize } from '../src/transpiler/tokenizer.js';
import { compileBPS } from '../src/transpiler/index.js';

let ok = 0, ko = 0;
function assert(label, cond, detail) {
  if (cond) { ok++; console.log(`OK  ${label}`); }
  else { ko++; console.log(`KO  ${label}${detail !== undefined ? '  → ' + detail : ''}`); }
}
const actor0 = (src) => parse(tokenize(src)).actors[0];

console.log('\n=== CANON : @alphabet.<nom> + transport:<canal> ===');
{
  const a = actor0('@core\n@controls\n@actor voice @alphabet.sargam transport:browser\nS -> sa\n');
  assert('@alphabet.sargam → properties.alphabet = sargam', a.properties.alphabet === 'sargam', JSON.stringify(a.properties.alphabet));
  assert('transport:browser → key = browser', a.properties.transport?.key === 'browser', JSON.stringify(a.properties.transport));
}
{
  const a = actor0('@core\n@controls\n@actor sitar @alphabet.sargam transport:midi(ch:3)\nS -> sa\n');
  assert('transport:midi(ch:3) → params.ch = 3', a.properties.transport?.params?.ch === 3, JSON.stringify(a.properties.transport));
}

console.log('\n=== §71 : @mine.* NON posé sur la ligne d\'acteur → libRef de SCÈNE ===');
{
  const ast = parse(tokenize('@core\n@controls\n@actor voice transport:browser\n@mine.ragas.sargam\nS -> sa\n'));
  assert('acteur transport-seul : properties.alphabet ABSENT', ast.actors[0].properties.alphabet === undefined, JSON.stringify(ast.actors[0].properties.alphabet));
  assert('@mine.ragas.sargam → libRef de scène', JSON.stringify(ast.libRefs) === '["mine.ragas.sargam"]', JSON.stringify(ast.libRefs));
}

console.log('\n=== TRANSITION : anciennes formes encore ACCEPTÉES (non-régression) ===');
{
  const a = actor0('@core\n@controls\n@actor voice alphabet.sargam transport.browser\nS -> sa\n');
  assert('alphabet.sargam (point nu, déprécié) toléré', a.properties.alphabet === 'sargam', JSON.stringify(a.properties.alphabet));
  assert('transport.browser (point, déprécié) toléré', a.properties.transport?.key === 'browser', JSON.stringify(a.properties.transport));
  const b = actor0('@core\n@controls\n@actor voice alphabet:sargam transport:webaudio\nS -> sa\n');
  assert('alphabet:sargam (deux-points, déprécié) toléré', b.properties.alphabet === 'sargam', JSON.stringify(b.properties.alphabet));
}

console.log('\n=== BYTE-ID BP3 : canon vs ancienne forme = sortie identique ===');
{
  const oldSrc = '@core\n@controls\n@actor flute alphabet.sargam octaves.western transport.midi\nflute -> sa re ga\n';
  const canonSrc = '@core\n@controls\n@actor flute @alphabet.sargam octaves.western transport:midi\nflute -> sa re ga\n';
  assert('grammaire BP3 octet-identique (ancien vs canon)', compileBPS(oldSrc).grammar === compileBPS(canonSrc).grammar);
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok} passés, ${ko} échoués`);
if (ko > 0) process.exit(1);
