// Graphie canonique des bindings d'ACTEUR — CUTOVER 2026-07-14 (Romain GO, tour [411]).
// Règle gravée (décision hub 2026-06-26) : « `.` APPELLE un composant / `:` AFFECTE une valeur ».
//
// CANON sur la ligne d'acteur — TOUT composant se nomme avec `.` :
//   - alphabet = alphabet.<nom>  (sucre FACTORY legacy → properties.alphabet)
//   - out      = out.<canal>(…)   (une sortie prend des params ch/device → COMPOSANT,
//                                   PAS une valeur ; corrige b489933 qui l'avait mis en `:`)
// `out` remplace `transport` (décision Romain 2026-08-04, in/out remplacent transport) : seul
// le mot ÉCRIT change, le champ interne reste `properties.transport`.
// La provenance `factory.` NE se pose PAS sur la ligne d'acteur : une hauteur
// est un libRef de SCÈNE + un acteur sortie-seule (2026-07-13 §Raccord sortie).
//
// CUTOVER (zéro rétrocompat, non-négociable Romain) : les formes d'entité en `:` (alphabet:X,
// out:X, tuning:X, eval:X, sound:X) sont REJETÉES (fail-loud) — plus AUCUNE tolérance.

import { parse } from '../src/transpiler/parser.js';
import { tokenize } from '../src/transpiler/tokenizer.js';
import { compileToBPxAST } from '../src/transpiler/index.js';

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

console.log('\n=== CANON : alphabet.<nom> + out.<canal>(…) ===');
{
  const a = actor0('core\nactor voice alphabet.sargam out.audio\n-----\nS -> sa\n');
  assert('alphabet.sargam → properties.alphabet = sargam', a.properties.alphabet === 'sargam', JSON.stringify(a.properties.alphabet));
  assert('out.audio → key = audio', a.properties.transport?.key === 'audio', JSON.stringify(a.properties.transport));
}
{
  const a = actor0('core\nactor sitar alphabet.sargam out.midi(ch:3)\n-----\nS -> sa\n');
  assert('out.midi(ch:3) → params.ch = 3 (composant + params)', a.properties.transport?.params?.ch === 3, JSON.stringify(a.properties.transport));
}

console.log('\n=== §71 : une provenance NON posée sur la ligne d\'acteur → libRef de SCÈNE ===');
{
  // ⚠️ CE VOLET S'ÉPROUVAIT SUR `mine.`, SORTI DU LANGAGE LE 2026-08-19. Il migre sur `factory.`,
  // qui porte le MÊME mécanisme — et l'adresse émise change avec lui : `factory.` est un sucre
  // NORMALISÉ au nu, là où `mine.` préfixait. Ce que le volet mesure ne bouge pas : une provenance
  // écrite en tête de scène est une référence de SCÈNE, jamais une clé d'acteur.
  const ast = parse(tokenize('core\nactor voice out.audio\nfactory.ragas.sargam\n-----\nS -> sa\n'));
  assert('acteur sortie-seule : properties.alphabet ABSENT', ast.actors[0].properties.alphabet === undefined, JSON.stringify(ast.actors[0].properties.alphabet));
  assert('factory.ragas.sargam → libRef de scène, adresse NUE', JSON.stringify(ast.libRefs) === '["ragas.sargam"]', JSON.stringify(ast.libRefs));
}

console.log('\n=== CUTOVER : l\'ancienne forme d\'entité en `:` CRIE désormais ===');
{
  assert('out:browser (deux-points) → REJET fail-loud',
    cries('core\nactor voice alphabet.sargam out:browser\n-----\nS -> sa\n', "out:…"),
    'attendu ParseError out:…');
  assert('alphabet:sargam (deux-points) → REJET fail-loud',
    cries('core\nactor voice alphabet:sargam out.audio\n-----\nS -> sa\n', "alphabet:…"),
    'attendu ParseError alphabet:…');
  assert('out:midi(ch:3) (deux-points) → REJET fail-loud',
    cries('core\nactor voice alphabet.sargam out:midi(ch:3)\n-----\nS -> sa\n', "out:…"),
    'attendu ParseError out:…');
  // Le message pointe le canon `.`
  let msg = '';
  try { parse(tokenize('core\nactor voice out:browser\n-----\nS -> sa\n')); }
  catch (e) { msg = e.message; }
  assert('le message pointe le canon `out.<nom>`', msg.includes("out.<nom>"), msg);
}

console.log('\n=== TOMBSTONE : le mot `transport` (ex-canon) n\'existe plus, `.` comme `:` ===');
{
  // Décision Romain 2026-08-04 : `transport` est SORTI du langage, `out` le remplace. Les deux
  // formes crient désormais le MÊME message de migration, pas le refus `:` générique ci-dessus.
  assert('transport.audio → REJET fail-loud (mot sorti du langage)',
    cries('core\nactor voice alphabet.sargam transport.audio\n-----\nS -> sa\n', "n'existe plus"),
    "attendu ParseError \"transport' n'existe plus\"");
  assert('transport:audio → REJET fail-loud (mot sorti du langage)',
    cries('core\nactor voice alphabet.sargam transport:audio\n-----\nS -> sa\n', "n'existe plus"),
    "attendu ParseError \"transport' n'existe plus\"");
  // Le message pointe la migration vers `out.<canal>`.
  let msg = '';
  try { parse(tokenize('core\nactor voice transport.audio\n-----\nS -> sa\n')); }
  catch (e) { msg = e.message; }
  assert('le message pointe la migration `out.<canal>`', msg.includes('out.<canal>'), msg);
}

console.log('\n=== NON-RÉGRESSION : le `:` reste valide pour AFFECTER une valeur ===');
{
  // `sujet:sound.X` (une note reçoit un son) : le `:` affecte une valeur → toujours accepté.
  // Les affectations sont hoistées top-level en `scene.soundAssignments` (parser.js:181-189).
  const scene = parse(tokenize('core\nactor voice alphabet.sargam out.audio\n  sa:sound.piano\n-----\nS -> sa\n'));
  assert('sa:sound.piano (affectation de valeur à un sujet) accepté',
    Array.isArray(scene.soundAssignments) && scene.soundAssignments.some((s) => s.subject === 'sa'),
    JSON.stringify(scene.soundAssignments));
}

console.log('\n=== BYTE-ID BP3 : les deux graphies dot canon = grammaire identique ===');
{
  // `alphabet.sargam` et `alphabet.sargam` (point nu) sont deux graphies DOT équivalentes :
  // même canal legacy, même grammaire BP3 octet-pour-octet.
  const atForm  = 'core\nactor flute alphabet.sargam octaves.western out.midi\n-----\nflute -> sa re ga\n';
  const nuForm  = 'core\nactor flute alphabet.sargam octaves.western out.midi\n-----\nflute -> sa re ga\n';
  // ⚠️ ASSERTION DE TEXTE BP3 RETIRÉE le 2026-07-19 — la certification grammaire-texte est
  // abandonnée (arbitrage Romain) et l'encodeur supprimé : il n'y a plus de texte à vérifier.
  // ancienne assertion : assert('grammaire BP3 octet-identique (alphabet.X vs alphabet.X)'(atForm).grammar === compileToBPxAST(
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok} passés, ${ko} échoués`);
if (ko > 0) process.exit(1);
