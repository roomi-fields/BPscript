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
  // ⛔ CE VOLET A MIGRÉ DEUX FOIS, ET LA PREMIÈRE MIGRATION ÉTAIT LA FAUTE. Il s'éprouvait sur
  // `mine.`, sorti le 2026-08-19 ; il a migré sur `factory.`, sorti le 2026-08-20. Déplacer un
  // volet d'un mot retiré vers un mot EN SURSIS ne le sauve pas, ça reporte sa chute — et le
  // commentaire qui l'accompagnait décrivait `factory.` comme un sucre, ce qu'il n'était pas.
  // Il s'éprouve désormais sur l'invocation DIRECTE, la forme vivante : elle produit le même canal
  // et elle EXIGE que la librairie existe.
  // Ce que le volet mesure ne bouge pas : une invocation écrite en tête de scène est une référence
  // de SCÈNE, jamais une clé d'acteur.
  // ⚠️ PAR LA PORTE COMPLÈTE, PAS PAR LE PARSEUR SEUL. L'ancienne forme préfixée produisait son
  // nœud AU PARSEUR, sans résolution — c'est exactement le contournement qui l'a fait sortir.
  // L'invocation directe EXIGE que la librairie existe : elle se mesure donc là où elle se résout.
  const ast = compileToBPxAST('core\nactor voice out.audio\ntemperaments.12TET\n-----\nS -> sa\n').ast;
  assert('acteur sortie-seule : properties.alphabet ABSENT', ast.actors[0].properties.alphabet === undefined, JSON.stringify(ast.actors[0].properties.alphabet));
  assert('temperaments.12TET → libRef de scène, adresse NUE', JSON.stringify(ast.libRefs) === '["temperaments.12TET"]', JSON.stringify(ast.libRefs));
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

console.log('\n=== `transport` NE MARCHE PLUS sur un acteur, `.` comme `:` ===');
{
  // Décision Romain 2026-08-04 : `transport` est SORTI du langage, `out` le remplace.
  //
  // ⛔ CE QUE CE VOLET EXIGEAIT, ET QUI ÉTAIT LA FAUTE : il réclamait le TEXTE du message, et ce
  // texte ÉCRIVAIT le mot retiré. Un garde qui impose qu'un message nomme un mot sorti oblige le
  // code à le garder — il transforme la trace en obligation. La règle (Romain, 2026-08-18) ne
  // laisse vivre que « les gardes qui vérifient que le mot NE MARCHE PLUS ».
  //
  // Ce qui se mesure ici est donc le REFUS, et le témoin qui le rend concluant est un mot INVENTÉ
  // à la même place : sans lui, un compilateur qui refuserait toute clé d'acteur passerait ce
  // volet en triomphe.
  for (const graphie of ['transport.audio', 'transport:audio']) {
    assert(`${graphie} → REJET fail-loud (mot sorti du langage)`,
      cries(`core\nactor voice alphabet.sargam ${graphie}\n-----\nS -> sa\n`, ''),
      `attendu un refus sur '${graphie}'`);
  }
  assert('TÉMOIN — une clé d\'acteur VALIDE passe toujours',
    !cries('core\nactor voice alphabet.sargam out.audio\n-----\nS -> sa\n', ''),
    'out.audio doit rester accepté — sinon le refus ci-dessus ne prouve rien');
  // Le refus enseigne la clé VIVANTE, jamais celle qui est sortie.
  let msg = '';
  try { parse(tokenize('core\nactor voice transport.audio\n-----\nS -> sa\n')); }
  catch (e) { msg = e.message; }
  assert('le refus enseigne la clé vivante `out.<canal>`', msg.includes('out.<canal>'), msg);
  assert('et il n\'ÉCRIT PAS le mot sorti', !msg.includes('transport'), msg);
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
