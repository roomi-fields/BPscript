/**
 * LAN-5 / KAI-9 — acteur IMPLICITE `default` matérialisé DANS L'AST (validé Romain 2026-06-26).
 *
 * Quand une scène ne déclare AUCUN @actor (`.bps` simple, `.gr`, cv-adsr), BPScript inscrit un
 * acteur `default` (transport `audio`, marqué `synthetic:true`) dans `ast.actors`, pour qu'une
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

// ── 1. scène sans @actor → un acteur `default` transport audio, synthetic ─
{
  const a = actors('A -> C4');
  assert('un seul acteur', a.length === 1, JSON.stringify(a.map((x) => x.name)));
  const d = a[0];
  assert('nom = default', d.name === 'default');
  assert('transport.key = audio', d.properties?.transport?.key === 'audio', JSON.stringify(d.properties?.transport));
  assert('reference transport = audio', d.references?.find((r) => r.category === 'transport')?.name === 'audio');
  assert('marqué synthetic:true', d.synthetic === true);
  // La scène ne déclare aucune convention de notes → elle HÉRITE du socle @core, et l'AST le DIT.
  assert('alphabet hérité du socle @core', d.properties?.alphabet === 'western', JSON.stringify(d.properties));
  assert('la référence d alphabet suit la propriété',
    d.references?.find((r) => r.category === 'alphabet')?.name === 'western', JSON.stringify(d.references));
}

// ── 2. scène solfège sans @actor → aussi un default, alphabet DÉCLARÉ ─────
// ⚠️ Cette scène témoin écrivait `do4 re4 mi4` SANS déclarer le solfège, et passait : le
// compilateur ne validait rien faute d'alphabet en portée. Elle déclare maintenant ce qu'elle
// veut dire. Ce n'est pas une concession au garde — c'était une scène incomplète, et le
// compilateur le disait à personne.
{
  const a = actors('@mm:60\n@alphabet.solfege\nGamme -> do4 re4 mi4');
  assert('default injecté même avec directives', a.length === 1 && a[0].name === 'default', JSON.stringify(a));
  assert('alphabet de scène hérité par le default', a[0].properties?.alphabet === 'solfege');
}

// ── 3. scène AVEC @actor → PAS de default, pas de synthetic ──────────────
{
  const a = actors('@actor sitar transport.midi(ch:3)\nsitar -> C4');
  assert('un acteur déclaré', a.length === 1 && a[0].name === 'sitar');
  assert('pas synthetic', a[0].synthetic !== true);
  assert('pas d acteur default ajouté', !a.some((x) => x.name === 'default' && x.synthetic));
}

// ── 4. plusieurs @actor → aucun default ─────────────────────────────────
{
  const a = actors('@actor a1 transport.midi(ch:1)\n@actor a2 transport.osc(device:x)\na1 -> C4\na2 -> E4');
  assert('2 acteurs déclarés, pas de default', a.length === 2 && !a.some((x) => x.synthetic));
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
