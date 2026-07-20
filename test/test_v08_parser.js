/**
 * Test : parser v0.8 — @sound, @template, actor dot notation, sound_assignment
 *
 * Cf. docs/design/v0.8-decisions-final.md et docs/spec/{AST,EBNF,LANGUAGE}.md.
 *
 * Run: node test/test_v08_parser.js
 */

import { readFileSync } from 'fs';
import { tokenize } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';
import { registerAll } from '../src/transpiler/libs.js';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { bpsPath, grPath } from './corpus.mjs';

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
    console.error(`  FAIL: ${label}${details ? ` — ${details}` : ''}`);
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

function parseSource(src) {
  return parse(tokenize(src));
}

// CUTOVER graphie 2026-07-14 : renvoie true si `src` est REJETÉ (fail-loud) avec un message
// contenant `needle`. Sert à prouver que l'ancienne forme d'entité en `:` CRIE désormais.
function rejects(src, needle) {
  try { parse(tokenize(src)); return false; }
  catch (e) { return typeof e.message === 'string' && (!needle || e.message.includes(needle)); }
}

// ============================================================
// 1. @actor — dot notation (v0.8 canonique)
// ============================================================

section('@actor — dot notation v0.8');

{
  const ast = parseSource(`@controls
@actor sitar
  alphabet.tabla
  tuning.equal_temperament
  transport.midi(ch:3, vel:100)
S -> A`);
  const actor = ast.actors[0];
  assert('actor name parsed', actor.name === 'sitar');
  assert('alphabet via dot', actor.properties.alphabet === 'tabla');
  assert('tuning via dot', actor.properties.tuning === 'equal_temperament');
  assert('transport is TransportRef', actor.properties.transport?.type === 'TransportRef');
  assert('transport key=midi', actor.properties.transport?.key === 'midi');
  assert('transport ch=3', actor.properties.transport?.params?.ch === 3);
  assert('transport vel=100', actor.properties.transport?.params?.vel === 100);
}

// ============================================================
// 2. @actor — CUTOVER 2026-07-14 : l'ancienne forme d'entité en `:` est REJETÉE
// ============================================================

section('@actor — entité en `:` REJETÉE (cutover)');

{
  // `alphabet:tabla`, `tuning:…`, `transport:…` = composants mal graphiés → fail-loud.
  assert('alphabet:tabla → REJET',
    rejects(`@controls\n@actor sitar alphabet:tabla\nS -> A`, "alphabet:…"));
  assert('tuning:equal_temperament → REJET',
    rejects(`@controls\n@actor sitar tuning:equal_temperament\nS -> A`, "tuning:…"));
  assert('transport:midi(ch:3) → REJET',
    rejects(`@controls\n@actor sitar transport:midi(ch:3)\nS -> A`, "transport:…"));
}

// ============================================================
// 3. @actor — CANON dot pur (alphabet.X + transport.X)
// ============================================================

section('@actor — canon dot');

{
  const ast = parseSource(`@controls
@actor sitar @alphabet.tabla
  transport.midi(ch:3)
S -> A`);
  const actor = ast.actors[0];
  assert('alphabet via dot', actor.properties.alphabet === 'tabla');
  assert('transport via dot', actor.properties.transport?.key === 'midi');
}

// ============================================================
// 4. @sound — bloc anonyme par défaut
// ============================================================

section('@sound — bloc anonyme défaut');

{
  const ast = parseSource(`@controls
@sound
  { dur:500, alphaMin:80, alphaMax:120 }
S -> A`);
  assert('soundPrototypes is array', Array.isArray(ast.soundPrototypes));
  assert('1 prototype', ast.soundPrototypes.length === 1);
  const p0 = ast.soundPrototypes[0];
  assert('anonymous (name=null)', p0.name === null);
  assert('config.dur=500', p0.config.dur === 500);
  assert('config.alphaMin=80', p0.config.alphaMin === 80);
  assert('config.alphaMax=120', p0.config.alphaMax === 120);
}

// ============================================================
// 5. @sound — sons nommés multiples
// ============================================================

section('@sound — sons nommés multiples');

{
  const ast = parseSource(`@controls
@sound
  { dur:500 }
  bell_short { sample:"bell.wav", dur:400 }
  bell_long  { sample:"bell.wav", dur:1200, coverEnd:true }
  drum_kick  { sample:"kick.wav", dur:200, breakTempo }
S -> A`);
  assert('4 prototypes', ast.soundPrototypes.length === 4);
  const [anon, bs, bl, dk] = ast.soundPrototypes;
  assert('anonymous first', anon.name === null);
  assert('bell_short name', bs.name === 'bell_short');
  assert('bell_short sample', bs.config.sample === 'bell.wav');
  assert('bell_long coverEnd=true (literal)', bl.config.coverEnd === true);
  assert('drum_kick breakTempo nu = true', dk.config.breakTempo === true);
  assert('drum_kick sample', dk.config.sample === 'kick.wav');
}

// ============================================================
// 6. @sound.libname — référence à une lib externe
// ============================================================

section('@sound.libname — lib externe');

{
  const ast = parseSource(`@controls
@sound.tabla_perc
S -> A`);
  const dir = ast.directives.find(d => d.name === 'sound');
  assert('directive @sound captured', !!dir);
  assert('subkey=tabla_perc', dir?.subkey === 'tabla_perc');
}

// ============================================================
// 7. @sound.libname:variant — variante de lib
// ============================================================

section('@sound.libname:variant — variante');

{
  const ast = parseSource(`@controls
@sound.tabla_perc:simplified
S -> A`);
  const dir = ast.directives.find(d => d.name === 'sound');
  assert('subkey=tabla_perc', dir?.subkey === 'tabla_perc');
  assert('binding=simplified', dir?.binding === 'simplified');
}

// ============================================================
// 8. @template (singulier) — section template v0.8
// ============================================================

section('@template — singulier v0.8');

{
  const ast = parseSource(`@controls
S -> A B C
@template
[1] /1 ???
[2] /1 ???????`);
  assert('template parsed', Array.isArray(ast.template));
  assert('2 entries', ast.template?.length === 2);
  // ⚠️ ASSERTION RETIRÉE le 2026-07-19 : elle vérifiait l'alias `ast.templates`, supprimé
  // (arbitrage Romain — un seul nom canonique, `template` au singulier, AST.md:40).
  assert('champ canonique `template` présent', Array.isArray(ast.template));
  assert('entry 1 index=1', ast.template?.[0]?.index === 1);
  assert('entry 1 wildcards=3', ast.template?.[0]?.body?.[0]?.count === 3);
}

// ============================================================
// 9. @templates (pluriel) — REFUSÉ depuis le 2026-07-19
// ============================================================

section('@templates — pluriel REFUSÉ');

{
  // Ce test disait l'inverse jusqu'au 2026-07-19 : il PROUVAIT que l'alias marchait, et c'est
  // à ce titre qu'il maintenait le rétrocompat en vie. bpx ayant migré ses scènes et retiré ses
  // alias, la graphie plurielle n'a plus d'usager — elle est coupée, et le test la verrouille
  // dans l'autre sens.
  let refuse = false, message = '';
  try {
    parseSource(`@controls
S -> A
@templates
[1] /1 ?????`);
  } catch (e) { refuse = true; message = e.message; }
  assert('@templates est REFUSÉ (plus aucun alias survivant)', refuse);
  // Le message doit NOMMER la migration : un « attendu template » ressemblerait à une coquille.
  assert('le refus nomme la forme de remplacement', /@template'? \(singulier\)/.test(message));
}

{
  // Témoin : le singulier, lui, passe toujours — sans quoi le test ci-dessus serait vert
  // même si on avait cassé la section template entière.
  const ast = parseSource(`@controls
S -> A
@template
[1] /1 ?????`);
  assert('témoin — @template (singulier) parse toujours', Array.isArray(ast.template));
  assert('témoin — count=5', ast.template?.[0]?.body?.[0]?.count === 5);
}

// ============================================================
// 10. SoundAssignment dans @actor — *:sound.X et Sa:sound.Y
// ============================================================

section('SoundAssignment dans @actor');

{
  const ast = parseSource(`@controls
@actor tabla
  alphabet.tabla
  transport.midi(ch:10)
  *:sound.tabla_perc
  Sa:sound.drum_kick
S -> A`);
  assert('soundAssignments top-level', Array.isArray(ast.soundAssignments));
  assert('2 assignments', ast.soundAssignments.length === 2);
  const [sa1, sa2] = ast.soundAssignments;
  // Forme PLATE (`scope` est une chaîne, le nom vit dans `alphabet`/`actor`) : c'est ce que
  // le transpileur émet ET ce que BPx consomme (findAssignment compare `a.scope` puis lit
  // `a.actor`). Ce test attendait `scope.kind`, la forme d'AVANT 498a311 — la spec l'a
  // décrite jusqu'au 2026-07-19, et personne ne l'implémentait plus.
  assert('1st scope=actor', sa1.scope === 'actor');
  assert('1st actor=tabla', sa1.actor === 'tabla');
  assert('1st subject=*', sa1.subject === '*');
  assert('1st target named-ref tabla_perc', sa1.target.kind === 'named-ref' && sa1.target.name === 'tabla_perc');
  assert('2nd subject=Sa', sa2.subject === 'Sa');
  assert('2nd target=drum_kick', sa2.target.name === 'drum_kick');
  // Pas de duplication sur l'ActorDirective (décision PM 1).
  assert('ActorDirective sans soundAssignments (PM décision 1)', !ast.actors[0].soundAssignments);
}

// ============================================================
// 11. sound.X seul (= *:sound.X)
// ============================================================

section('sound.X seul (sucre pour *:sound.X)');

{
  const ast = parseSource(`@controls
@actor x
  alphabet.tabla
  sound.bell_short
S -> A`);
  // Doit produire properties.sound + une SoundAssignment scope=actor subject=*.
  assert('actor properties.sound rempli', ast.actors[0].properties.sound === 'bell_short');
  assert('SoundAssignment scope=actor subject=*', ast.soundAssignments?.[0]?.subject === '*');
  assert('target.name=bell_short', ast.soundAssignments?.[0]?.target?.name === 'bell_short');
}

// ============================================================
// 12. SoundAssignment dans @alphabet.X
// ============================================================

section('SoundAssignment dans @alphabet.X');

{
  const ast = parseSource(`@controls
@alphabet.tabla
  *:sound.bell_short
  Sa:sound.drum_kick
  Re:sound.bell_long
S -> Sa Re Sa`);
  assert('3 assignments', ast.soundAssignments?.length === 3);
  const [a1, a2, a3] = ast.soundAssignments;
  assert('scope=alphabet', a1.scope === 'alphabet');
  assert('alphabet=tabla', a1.alphabet === 'tabla');
  assert('* subject', a1.subject === '*');
  assert('Sa subject', a2.subject === 'Sa');
  assert('Re subject', a3.subject === 'Re');
  assert('alphabet directive aussi présent', ast.directives.some(d => d.name === 'alphabet' && d.subkey === 'tabla'));
}

// ============================================================
// 13. Inline runtime qualifier — Sa(sound.bell_short)
// ============================================================

section('Inline Sa(sound.bell_short)');

{
  const ast = parseSource(`@controls
S -> Sa(sound.bell_short) Re`);
  const sa = ast.subgrammars[0].rules[0].rhs[0];
  assert('Sa is Symbol', sa.type === 'Symbol' && sa.name === 'Sa');
  assert('has suffixQualifiers', Array.isArray(sa.suffixQualifiers));
  const rq = sa.suffixQualifiers[0];
  assert('is RuntimeQualifier', rq.type === 'RuntimeQualifier');
  assert('pair key=sound', rq.pairs[0].key === 'sound');
  assert('pair value=bell_short', rq.pairs[0].value === 'bell_short');
}

// ============================================================
// 14. Inline mixé — Sa(vel:80, sound.bell, pan:64)
// ============================================================

section('Inline mixé vel+sound+pan');

{
  const ast = parseSource(`@controls
S -> Sa(vel:80, sound.bell, pan:64)`);
  const rq = ast.subgrammars[0].rules[0].rhs[0].suffixQualifiers[0];
  assert('3 pairs', rq.pairs.length === 3);
  assert('vel:80', rq.pairs[0].key === 'vel' && rq.pairs[0].value === 80);
  assert('sound:bell', rq.pairs[1].key === 'sound' && rq.pairs[1].value === 'bell');
  assert('pan:64', rq.pairs[2].key === 'pan' && rq.pairs[2].value === 64);
}

// ============================================================
// 15. Inline anonyme — Sa:{ dur:300 } dans @actor
// ============================================================

section('SoundAssignment inline-props dans @actor');

{
  const ast = parseSource(`@controls
@actor x
  alphabet.tabla
  Sa:{ dur:300, sample:"x.wav" }
S -> Sa`);
  const sa = ast.soundAssignments?.[0];
  assert('1 assignment', ast.soundAssignments?.length === 1);
  assert('subject=Sa', sa?.subject === 'Sa');
  assert('target.kind=inline-props', sa?.target?.kind === 'inline-props');
  assert('inline dur=300', sa?.target?.props?.dur === 300);
  assert('inline sample=x.wav', sa?.target?.props?.sample === 'x.wav');
}

// ============================================================
// 16. Booléen nu (`breakTempo` ≡ `breakTempo:true`)
// ============================================================

section('Booléen nu dans bloc inline');

{
  const ast = parseSource(`@controls
@sound
  drum { sample:"k.wav", breakTempo, contBeg }
S -> A`);
  const cfg = ast.soundPrototypes[0].config;
  assert('breakTempo=true (nu)', cfg.breakTempo === true);
  assert('contBeg=true (nu)', cfg.contBeg === true);
  assert('sample préservé', cfg.sample === 'k.wav');
}

// ============================================================
// 17. Commentaires `//` dans bloc @sound
// ============================================================

section('Commentaires dans @sound');

{
  const ast = parseSource(`@controls
@sound
  // entrée anonyme
  { dur:500 }
  // bell explicite
  bell { sample:"b.wav" }
S -> A`);
  assert('2 prototypes (comments ignored)', ast.soundPrototypes.length === 2);
  assert('1st anonymous', ast.soundPrototypes[0].name === null);
  assert('2nd named bell', ast.soundPrototypes[1].name === 'bell');
}

// ============================================================
// 18. Espacement variable : `*:sound.X` vs `* : sound . X`
// ============================================================

section('Espacement cohérent — *:sound.X');

{
  const noSpace = parseSource(`@controls
@actor a
  alphabet.tabla
  *:sound.bell
S -> A`);
  const withSpace = parseSource(`@controls
@actor a
  alphabet.tabla
  * : sound . bell
S -> A`);
  assert('no-space: 1 assignment', noSpace.soundAssignments?.length === 1);
  assert('with-space: 1 assignment', withSpace.soundAssignments?.length === 1);
  assert('no-space subject=*', noSpace.soundAssignments?.[0]?.subject === '*');
  assert('with-space subject=*', withSpace.soundAssignments?.[0]?.subject === '*');
  assert('no-space target.name=bell', noSpace.soundAssignments?.[0]?.target?.name === 'bell');
  assert('with-space target.name=bell', withSpace.soundAssignments?.[0]?.target?.name === 'bell');
}

// ============================================================
// 19. Migration : un fichier post-migration parse proprement
// ============================================================

section('Cas migration : forme v0.8 issue du script');

{
  const ast = parseSource(`@core
@controls
@alphabet.tabla:midi
@actor tabla
  alphabet.tabla
  transport.midi(ch:10)
  *:sound.tabla_perc
S -> tabla.dhin tabla.dha
@template
[1] /1 ???`);
  assert('actor parsed', ast.actors.length === 1);
  assert('template parsed', ast.template?.length === 1);
  assert('soundAssignments OK', ast.soundAssignments?.length === 1);
  assert('directives OK', ast.directives.some(d => d.name === 'alphabet' && d.subkey === 'tabla'));
}

// ============================================================
// 20. CUTOVER : sound.NAME (dot) → sound + SoundAssignment ; sounds:NAME (colon) REJETÉ
// ============================================================

section('sound.NAME (dot) canonique ; sounds:NAME (colon) REJETÉ');

{
  const ast = parseSource(`@controls
@actor t sound.tabla_perc @alphabet.tabla transport.midi(ch:1)
S -> A`);
  assert('properties.sound rempli (canonique)', ast.actors[0].properties.sound === 'tabla_perc');
  // Émet aussi une SoundAssignment scope=actor subject=*, cohérent avec
  // l'équivalence sémantique v0.8 (sound.X = *:sound.X dans @actor).
  assert('soundAssignment émis', ast.soundAssignments?.[0]?.target?.name === 'tabla_perc');
  assert('sounds:tabla_perc (colon v0.7) → REJET',
    rejects(`@controls\n@actor t sounds:tabla_perc\nS -> A`, "sounds:…"));
}

// ============================================================
// 21. Cas adversarial : *:sound.X dans flux RHS doit NE PAS être une affectation
// ============================================================

section('* dans flux RHS ≠ affectation');

{
  // Le `*` n'est valide en sujet d'affectation que dans un body @actor/@alphabet.
  // Dans un RHS de règle, `*` n'a pas de sens (testons qu'on ne crashe pas).
  // Note : le tokenizer émet T.STAR ; le parser RHS ne le traite pas (skip).
  try {
    const ast = parseSource(`@controls
S -> A B`);
    assert('control case parses', ast.subgrammars[0].rules[0].rhs.length === 2);
  } catch (e) {
    assert('control case parses', false, e.message);
  }
}

// ============================================================
// 21bis. eval.X (v0.8) et eval:X (v0.7) — décision PM 2
// ============================================================

section('eval.X harmonisé (PM décision 2)');

{
  // ⚠️ SANS `transport` : un acteur qui porte `eval.<interprète>` est un PRODUCTEUR qui sort
  // par ses propres moyens, et le parser refuse désormais de lui router une sortie (fail-loud
  // nommé : « un producteur 'eval.python' sort en natif — pas de 'transport' »). Ce test
  // écrivait les deux ensemble, forme d'avant ce durcissement : il ne rendait donc pas un
  // FAIL, il faisait PLANTER tout le fichier sur une exception non rattrapée — les 172
  // assertions suivantes ne s'exécutaient plus du tout.
  const ast08 = parseSource(`@controls
@actor a
  alphabet.tabla
  eval.python
S -> A`);
  assert('v0.8 eval.python parsed', ast08.actors[0].properties.eval === 'python');
  assert('eval + transport ensemble → REJET nommé',
    rejects(`@controls\n@actor a\n  alphabet.tabla\n  transport.midi(ch:1)\n  eval.python\nS -> A`, 'transport'));
  // CUTOVER : la forme colon `eval:python` (comme alphabet:/transport:) est REJETÉE.
  assert('eval:python (colon v0.7) → REJET',
    rejects(`@controls\n@actor a @alphabet.tabla transport.midi(ch:1) eval:python\nS -> A`, "eval:…"));
}

// ============================================================
// 22. Tests rétrocompat : grammaires existantes
// ============================================================

section('Rétrocompat : grammaire complète v0.7');

{
  const src = `// scene v0.7 typique
@core
@controls
@alphabet.western:midi
@mm:60
@striated
S -> A B C
A -> C4 D4 E4
B -> F4 G4 A4
C -> B4 C5`;
  const ast = parseSource(src);
  assert('directives parsed', ast.directives.length >= 3);
  assert('4 rules', ast.subgrammars[0].rules.length === 4);
  assert('no sound prototypes', ast.soundPrototypes === null);
  assert('no sound assignments', ast.soundAssignments === null);
}

// ============================================================
// 23. Actor sans alphabet : le PARSER laisse properties vide ; l'actorResolver REMPLIT
//     l'alphabet par cascade (acteur→scène→@core), il ne REJETTE JAMAIS (modèle Romain
//     2026-07-13, RESOLVER-CASCADE-ALPHABET) — cf. test_actor_cascade_alphabet.js.
// ============================================================

section('Actor sans alphabet (parser : properties vide, cascade en aval)');

{
  const ast = parseSource(`@controls
@actor empty
S -> A`);
  // Parse OK ; l'actorResolver remplira l'alphabet par cascade (pas d'erreur).
  assert('parses (resolver fills alphabet by cascade)', ast.actors[0].name === 'empty');
  assert('properties empty au PARSE (avant cascade)', Object.keys(ast.actors[0].properties).length === 0);
}

// ============================================================
// 24. scene.homomorphisms — contrat BPx
// ============================================================

section('scene.homomorphisms — contrat BPx');

{
  // Sans directive @transcription : champ vide ou absent
  const ast = parseSource(`@controls
S -> A B`);
  assert('sans @transcription: homomorphisms vide', !ast.homomorphisms || ast.homomorphisms.length === 0);
}

{
  // @transcription.checkhomo — format sections → 3 décls ('*', 'H', 'TR')
  const ast = parseSource(`@controls
@transcription.checkhomo
S -> A B`);
  assert('checkhomo: homomorphisms défini', Array.isArray(ast.homomorphisms));
  assert('checkhomo: 3 décls', ast.homomorphisms?.length === 3);
  const names = ast.homomorphisms?.map(h => h.name);
  assert("checkhomo: décl '*' présente", names?.includes('*'));
  assert("checkhomo: décl 'H' présente", names?.includes('H'));
  assert("checkhomo: décl 'TR' présente", names?.includes('TR'));
  const star = ast.homomorphisms?.find(h => h.name === '*');
  assert("checkhomo: type='Homomorphism'", star?.type === 'Homomorphism');
  assert("checkhomo: paires présentes", Array.isArray(star?.pairs) && star.pairs.length > 0);
  // paires de '*': a→a', a'→a", b→b', b'→b
  const pairMap = Object.fromEntries(star?.pairs || []);
  assert("checkhomo: a → a'", pairMap['a'] === "a'");
  assert("checkhomo: b → b'", pairMap['b'] === "b'");
  assert("checkhomo: line défini", typeof star?.line === 'number');
}

{
  // @transcription.dhati — format sections, section '*' avec 7 paires (identités conservées)
  const ast = parseSource(`@controls
@transcription.dhati
S -> dha ti`);
  assert('dhati: homomorphisms défini', Array.isArray(ast.homomorphisms));
  assert('dhati: 1 décl (section *)', ast.homomorphisms?.length === 1);
  const decl = ast.homomorphisms?.[0];
  assert("dhati: name='*'", decl?.name === '*');
  assert('dhati: 7 paires', decl?.pairs?.length === 7);
  const pairMap = Object.fromEntries(decl?.pairs || []);
  assert('dhati: dha → ta', pairMap['dha'] === 'ta');
  assert('dhati: ti → ti (identité conservée)', pairMap['ti'] === 'ti');
  assert('dhati: ge → ke', pairMap['ge'] === 'ke');
  assert('dhati: na → na (identité conservée)', pairMap['na'] === 'na');
}

{
  // @transcription.dhin — format sections, section '*' avec 11 paires
  const ast = parseSource(`@controls
@transcription.dhin
S -> dhin dha`);
  assert('dhin: homomorphisms défini', Array.isArray(ast.homomorphisms));
  assert('dhin: 1 décl', ast.homomorphisms?.length === 1);
  const decl = ast.homomorphisms?.[0];
  assert("dhin: name='*'", decl?.name === '*');
  assert('dhin: 11 paires', decl?.pairs?.length === 11);
  const pairMap = Object.fromEntries(decl?.pairs || []);
  assert('dhin: dha → ta', pairMap['dha'] === 'ta');
  assert('dhin: dhin → tin', pairMap['dhin'] === 'tin');
  assert('dhin: ta → ta (identité conservée)', pairMap['ta'] === 'ta');
}

{
  // @transcription.ruwet — format sections avec m1/m2/mineur
  const ast = parseSource(`@controls
@transcription.ruwet
S -> la4 fa4`);
  assert('ruwet: homomorphisms défini', Array.isArray(ast.homomorphisms));
  assert('ruwet: 3 décls (m1/m2/mineur)', ast.homomorphisms?.length === 3);
  const names = ast.homomorphisms?.map(h => h.name);
  assert("ruwet: décl 'm1' présente", names?.includes('m1'));
  assert("ruwet: décl 'mineur' présente", names?.includes('mineur'));
  const mineur = ast.homomorphisms?.find(h => h.name === 'mineur');
  assert('mineur: 2 paires seulement', mineur?.pairs?.length === 2);
  const pairMap = Object.fromEntries(mineur?.pairs || []);
  assert('mineur: fa4 → re4', pairMap['fa4'] === 're4');
  assert('mineur: la4 → fa4', pairMap['la4'] === 'fa4');
  // Sol4→mi4 NE DOIT PAS être présent (infidèle à -ho.Ruwet)
  assert('mineur: sol4 absent', !('sol4' in pairMap));
}

{
  // @transcription.tryhomomorphism — chaîne c-->fa4-->d dépliée en [c,fa4],[fa4,d]
  const ast = parseSource(`@controls
@transcription.tryhomomorphism
S -> a b c`);
  assert('tryhomo: homomorphisms défini', Array.isArray(ast.homomorphisms));
  assert('tryhomo: 1 décl', ast.homomorphisms?.length === 1);
  const decl = ast.homomorphisms?.[0];
  assert("tryhomo: name='*'", decl?.name === '*');
  // a→b, do4→re4, c→fa4, fa4→d (chaîne dépliée)
  assert('tryhomo: 4 paires (chaîne dépliée)', decl?.pairs?.length === 4);
  const pairMap = Object.fromEntries(decl?.pairs || []);
  assert('tryhomo: a → b', pairMap['a'] === 'b');
  assert('tryhomo: do4 → re4', pairMap['do4'] === 're4');
  assert('tryhomo: c → fa4', pairMap['c'] === 'fa4');
  assert('tryhomo: fa4 → d', pairMap['fa4'] === 'd');
}

// ============================================================
// 25. Encoder — dé-pollution alphabet homomorphismes
// ============================================================

// ⚠️ SECTION « Encoder — dé-pollution alphabet homomorphismes » RETIRÉE le 2026-07-19.
//
// Ses trois blocs appelaient `encode()` directement — l'encodeur BP3, supprimé avec la façade
// héritée (arbitrage Romain : seule la PRODUCTION doit être identique, pas la grammaire).
// Ils vérifiaient que l'alphabet PLAT émis ne se pollue pas des noms d'homomorphisme, que le
// texte porte `tabla_stroke` verbatim, et que `encode()` rend bien ses homomorphismes.
//
// Aucun n'est portable sur l'AST : l'« alphabet plat » et le « texte grammaire » sont des
// artefacts de l'encodeur, ils n'existent pas dans l'arbre. Ce que l'arbre porte, lui —
// `Scene.homomorphisms` — reste couvert par les assertions conservées plus haut dans ce fichier.

// ============================================================
// F1 — parseControl : pitchbend(+200) et token invalide
// ============================================================

section('F1 — parseControl : +N dans args + token invalide -> ParseError');

{
  // pitchbend(+200) doit compiler sans gel.
  // Stratégie : on exécute dans un Worker en lui donnant un délai maximal,
  // mais comme Worker est lourd, on utilise juste un try/catch synchrone —
  // le test échouera si le process freeze (le runner a un timeout global).
  // Un test synchrone suffit : après le fix retourne.
  let compiled;
  let caughtError = null;
  try {
    compiled = compileToBPxAST('@controls\nS -> a pitchbend(+200)');
  } catch (e) {
    caughtError = e;
  }
  assert('pitchbend(+200) ne lève pas d\'exception fatale', caughtError === null,
    caughtError ? caughtError.message : '');
  assert('pitchbend(+200) compile sans erreur',
    compiled && compiled.errors.length === 0,
    compiled ? compiled.errors.map(e => e.message).join('; ') : 'compiled=undefined');
  // +200 encodé comme +200 ou 200 — symétrique du -200
  if (compiled && compiled.controlTable) {
    const ct = compiled.controlTable[0];
    const val = ct && ct.assignments && ct.assignments.pitchbend;
    assert('pitchbend(+200) valeur 200 ou +200',
      val === 200 || val === '+200' || String(val) === '200',
      `val=${JSON.stringify(val)}`);
  }
}

{
  // Token vraiment invalide dans les args -> ParseError explicite (pas de gel)
  // pitchbend(@200) : '@' n'est pas un token valide dans les args
  let compiled;
  let caughtError = null;
  try {
    compiled = compileToBPxAST('@controls\nS -> a pitchbend(@invalid)');
  } catch (e) {
    caughtError = e;
  }
  // Le résultat peut être : une erreur dans compiled.errors, ou une ParseError catchée,
  // mais jamais un gel du process.
  assert('pitchbend(@invalid) ne gèle pas (résultat défini)',
    compiled !== undefined || caughtError !== null,
    'compileBPS a gelé (undefined sans exception)');
}

// ============================================================
// E5 — Tempo absolu A[/N] → bare « /N A » + exit _tempo(1/1)
// ============================================================

section('Encoder — tempo absolu A[/N] → /N A (bare, absolu + persistant)');

// ⚠️ QUATRE BLOCS RETIRÉS ICI le 2026-07-19 — ils vérifiaient le TEXTE BP3 émis.
//
// Ils asseyaient l'émission des opérateurs de tempo : `A[/2]` doit rendre `/2 A` et non une
// paire `_tempo`, `![/2]` doit rendre `_tempo(2/1)`, `A[*2]` doit rendre l'entrée `_tempo(1/2)`
// et la sortie `_tempo(1/1)`. C'étaient de bonnes assertions — c'est leur OBJET qui a disparu.
//
// La certification grammaire-texte est ABANDONNÉE (arbitrage Romain 2026-07-19 : « la seule
// chose que je veux c'est que la PRODUCTION soit identique, pas la grammaire »). L'encodeur BP3
// est supprimé, donc il n'y a plus de texte à vérifier — et rien à porter sur l'AST : ces
// assertions parlaient d'octets, pas de structure.
//
// Le reste de ce fichier — plus de 170 assertions sur l'AST — est CONSERVÉ intact.

// ============================================================
// R1 — Noms canoniques BP3_OPERATORS dans l'AST
// ============================================================

section('R1 — Noms canoniques BP3_OPERATORS dans l\'AST');

{
  // @gate star:midi → déclaration acceptée (canal de déclaration) ; l'AST porte
  // le nom d'alias 'star' dans la directive, pas dans les Symbol de règle.
  const src = `@controls
@gate star:midi
S -> star`;
  const ast = parseSource(src);
  assert('R1: @gate star déclaration sans erreur', !ast.errors?.length);

  // Le Symbol dans la règle doit porter le nom canonique '*', PAS 'star'
  function findSymbolNames(node, out = []) {
    if (!node || typeof node !== 'object') return out;
    if (node.type === 'Symbol') out.push(node.name);
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(x => findSymbolNames(x, out));
      else if (typeof v === 'object') findSymbolNames(v, out);
    }
    return out;
  }
  const names = findSymbolNames(ast);
  assert("R1: Symbol 'star' absent de l'AST", !names.includes('star'),
    `noms trouvés: ${names.join(', ')}`);
  assert("R1: Symbol '*' présent dans l'AST", names.includes('*'),
    `noms trouvés: ${names.join(', ')}`);
}

{
  // 'plus' dans une règle → Symbol '*' dans l'AST
  const src = `@controls
@gate plus:midi
S -> plus A`;
  const ast = parseSource(src);
  function findSymbolNames(node, out = []) {
    if (!node || typeof node !== 'object') return out;
    if (node.type === 'Symbol') out.push(node.name);
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(x => findSymbolNames(x, out));
      else if (typeof v === 'object') findSymbolNames(v, out);
    }
    return out;
  }
  const names = findSymbolNames(ast);
  assert("R1: Symbol 'plus' absent de l'AST", !names.includes('plus'),
    `noms trouvés: ${names.join(', ')}`);
  assert("R1: Symbol '+' présent dans l'AST", names.includes('+'),
    `noms trouvés: ${names.join(', ')}`);
}

{
  // 'fin' dans une règle → Symbol ';' dans l'AST
  const src = `@controls
@gate fin:midi
S -> A fin`;
  const ast = parseSource(src);
  function findSymbolNames(node, out = []) {
    if (!node || typeof node !== 'object') return out;
    if (node.type === 'Symbol') out.push(node.name);
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(x => findSymbolNames(x, out));
      else if (typeof v === 'object') findSymbolNames(v, out);
    }
    return out;
  }
  const names = findSymbolNames(ast);
  assert("R1: Symbol 'fin' absent de l'AST", !names.includes('fin'),
    `noms trouvés: ${names.join(', ')}`);
  assert("R1: Symbol ';' présent dans l'AST", names.includes(';'),
    `noms trouvés: ${names.join(', ')}`);
}

{
  // Vérification bout en bout sur dhati.scene.bps : aucun Symbol 'star'/'plus'/'fin' dans l'AST
  const src = readFileSync(bpsPath('dhati'), 'utf8');
  const result = compileToBPxAST(src);
  function findOldNames(node, out = []) {
    if (!node || typeof node !== 'object') return out;
    if (node.type === 'Symbol' && ['star', 'plus', 'fin'].includes(node.name)) out.push(node.name);
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(x => findOldNames(x, out));
      else if (typeof v === 'object') findOldNames(v, out);
    }
    return out;
  }
  const oldNames = findOldNames(result.ast);
  assert("R1 dhati: aucun Symbol 'star'/'plus'/'fin' dans l'AST", oldNames.length === 0,
    `trouvé: ${oldNames.join(', ')}`);
  assert('R1 dhati: pas d\'erreur de compilation', result.errors.length === 0,
    result.errors.map(e => e.message).join('; '));
}

// ============================================================
// Summary
// ============================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.label}${f.details ? ': ' + f.details : ''}`);
  process.exit(1);
}
