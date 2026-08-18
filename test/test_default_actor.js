/**
 * LAN-5 / KAI-9 — acteur IMPLICITE `scene` matérialisé DANS L'AST (validé Romain 2026-06-26 ; RENOMMÉ le 2026-07-30).
 *
 * Quand une scène ne déclare AUCUN @actor (`.bps` simple, `.gr`, cv-adsr), BPScript inscrit un
 * acteur `scene` (transport `audio`, marqué `synthetic:true`) dans `ast.actors`, pour qu'une
 * scène simple emprunte le MÊME chemin orchestré qu'une scène multi-acteurs. Avant, c'était
 * l'HÔTE (kanopi bpx-adapter.ts:282-283) qui le synthétisait ; KAI-9 supprime la résolution
 * hôte → le défaut vit dans l'AST, BPx ne fait que le porter.
 *
 * ⚠️ DEUX ASSERTIONS DE CE FICHIER ONT ÉTÉ RETOURNÉES LE 2026-07-29, ET C'EST L'INVERSE D'UN
 * ASSOUPLISSEMENT. Elles exigeaient que l'acteur implicite SORTE SANS ALPHABET (« pitch via le
 * résolveur de scène »). Il n'existait aucun résolveur de scène en aval : l'AST partait muet, et
 * tout ce qui demande « est-ce une note ? » se taisait — 91 scènes sur 263. Verdict de Romain
 * (2026-07-29) : « ça ne devrait JAMAIS ARRIVER ». Le principe était pourtant ratifié et daté
 * depuis le 2026-07-04 (docs/design/SCENE_DEFAULTS_CASCADE.md) : « un paramètre définissable
 * n'est jamais inexistant ». Ces deux assertions GARDAIENT le défaut ; elles gardent maintenant
 * la cascade. Leçon : un témoin écrit d'après le comportement observé fige ce comportement,
 * même quand il contredit un contrat déjà signé.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function assert(label, cond, extra = '') {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL: ${label} ${extra}`); }
}
const actors = (src) => compileToBPxAST(src).ast.actors;

// ⚠️ IL S'APPELAIT `default` JUSQU'AU 2026-07-30. Décision Romain, en direct :
// `hub/decisions/2026-07-30-l-acteur-implicite-s-appelle-scene.md`. Son motif : refuser que ce qui
// s'appelle normalement en notation pointée remonte en `@`. Le nom donne à l'auteur de quoi
// DÉSIGNER ce qui n'appartient à personne — et `scene.C4` doit donc être ACCEPTÉ, ce que le seul
// renommage ne suffisait pas à faire (l'acteur naît après la validation des renvois pointés).
// ── 1. scène sans actor → un acteur `scene` transport audio, synthetic ─
{
  const a = actors('-----\nA -> C4');
  assert('un seul acteur', a.length === 1, JSON.stringify(a.map((x) => x.name)));
  const d = a[0];
  assert('nom = scene', d.name === 'scene');
  assert('transport.key = audio', d.properties?.transport?.key === 'audio', JSON.stringify(d.properties?.transport));
  assert('reference transport = audio', d.references?.find((r) => r.category === 'transport')?.name === 'audio');
  assert('marqué synthetic:true', d.synthetic === true);
  // La scène ne déclare aucune convention de notes → elle HÉRITE du socle core, et l'AST le DIT.
  assert('alphabet hérité du socle core', d.properties?.alphabet === 'western', JSON.stringify(d.properties));
  assert('la référence d alphabet suit la propriété',
    d.references?.find((r) => r.category === 'alphabet')?.name === 'western', JSON.stringify(d.references));
}

// ── 2. scène solfège sans actor → aussi un default, alphabet DÉCLARÉ ─────
// ⚠️ Cette scène témoin écrivait `do4 re4 mi4` SANS déclarer le solfège, et passait : le
// compilateur ne validait rien faute d'alphabet en portée. Elle déclare maintenant ce qu'elle
// veut dire. Ce n'est pas une concession au garde — c'était une scène incomplète, et le
// compilateur le disait à personne.
{
  const a = actors('tempo:60\nalphabet.solfege\n-----\nGamme -> do4 re4 mi4');
  assert('acteur implicite injecté même avec directives', a.length === 1 && a[0].name === 'scene', JSON.stringify(a));
  assert('alphabet de scène hérité par l acteur implicite', a[0].properties?.alphabet === 'solfege');
}

// ── 3. scène AVEC actor → PAS de default, pas de synthetic ──────────────
{
  const a = actors('actor sitar out.midi(ch:3)\n-----\nsitar -> C4');
  assert('un acteur déclaré', a.length === 1 && a[0].name === 'sitar');
  assert('pas synthetic', a[0].synthetic !== true);
  assert('pas d acteur implicite ajouté', !a.some((x) => x.name === 'scene' && x.synthetic));
}

// ── 4. plusieurs actor → aucun default ─────────────────────────────────
{
  const a = actors('actor a1 out.midi(ch:1)\nactor a2 out.osc(device:x)\n-----\na1 -> C4\na2 -> E4');
  assert('2 acteurs déclarés, pas d acteur implicite', a.length === 2 && !a.some((x) => x.synthetic));
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);

// ── 5. L'ANCIEN NOM NE REVIENT PAS, ET LA DÉSIGNATION POINTÉE MARCHE ─────────
// ⚠️ Le renommage seul ne suffisait pas : `scene.C4` était REFUSÉ par « Acteur inconnu », parce
// que l'acteur implicite est fabriqué APRÈS la validation des renvois pointés. Or c'est
// exactement ce que la décision veut permettre — « la réponse est la notation pointée, pas la
// forme nue en @ ». Ces témoins gardent le BUT, pas seulement le nom.
{
  const r = compileToBPxAST('core\nalphabet.western\n-----\nS -> scene.C4');
  assert('scene.C4 est ACCEPTÉ quand aucun acteur n est déclaré',
    (r.errors || []).length === 0, JSON.stringify(r.errors));
}
{
  // ET « si et seulement si » : quand la scène déclare ses acteurs, il n'y a PAS d'acteur
  // implicite — `scene.X` doit rester refusé, sinon on offre un nom qui ne désigne rien.
  const r = compileToBPxAST('core\nalphabet.western\nactor v\n  out.midi\n-----\nS -> scene.C4');
  assert('scene.X reste REFUSÉ quand des acteurs sont déclarés',
    (r.errors || []).some((e) => /Acteur inconnu/.test(e.message || '')), JSON.stringify(r.errors));
}
{
  const r = compileToBPxAST('core\nalphabet.western\n-----\nS -> C4');
  assert('l ancien nom default ne revient nulle part',
    !(r.ast.actors || []).some((a) => a.name === 'default'), JSON.stringify(r.ast.actors));
}
