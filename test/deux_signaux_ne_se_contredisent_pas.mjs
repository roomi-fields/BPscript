#!/usr/bin/env node
/**
 * SENTINELLE — deux signaux que J'ÉMETS ne doivent pas se contredire.
 *
 * ⚠️ LE DÉFAUT, mesuré par BPx à leur entrée le 2026-07-29, sur un même arbre :
 *     `noteTerminals` NE CONTIENT PAS `chain`   → je dis moi-même que ce n'est pas une note
 *     l'élément de flux porte `nature:'sounding'` → je dis qu'il sonne
 * Ils SUIVENT LA NATURE — c'est leur contrat d'opacité, ils portent et ne fabriquent pas. D'où un
 * item qui occupe un temps : chain@0-500, C4 repoussée à 500-1000. À 120 au tempo, un temps entier
 * de musique avalé.
 *
 * ⚠️ ET LE DÉFAUT N'ÉTAIT PAS DANS L'INTENTION — leur mise au point, que je reprends parce qu'elle
 * est juste et que je m'étais accusé de « mauvaise foi » : `noteTerminals` est arrivé APRÈS, la
 * nature venait d'ailleurs, et les deux ont vécu côte à côte SANS QUE RIEN NE LES CONFRONTE.
 * Le défaut était l'ABSENCE D'UN GARDE QUI LES REGARDE ENSEMBLE. C'est ce fichier.
 *
 * POURQUOI UN REGISTRE ET PAS UNE ASSERTION : la réparation demande de NOMMER la nature d'une macro
 * de câblage, et c'est une décision de FORMALISME — Romain a gravé que ni moi ni l'architecte ne la
 * prenons. Exiger dès maintenant l'invariant rendrait ce garde ROUGE en permanence, et un garde
 * toujours rouge apprend à être ignoré. On pose donc un CLIQUET : l'étendue exacte est inscrite, et
 * le garde mord si elle GRANDIT. Le jour où la nature est scellée, l'étendue tombe à zéro et le
 * témoin rougit pour dire de RETIRER l'entrée — pas d'ajuster le nombre.
 *
 * (Méthode empruntée à BPx, qui a épinglé sa moitié le même jour : un constat qu'on note dans un
 * registre se relit quand on y pense ; un constat qu'on épingle VIENT VOUS CHERCHER.)
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { exigerCorpus, toutesLesScenes } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const naturesSonnantes = (n, out = []) => {
  if (!n || typeof n !== 'object') return out;
  if (Array.isArray(n)) { n.forEach((x) => naturesSonnantes(x, out)); return out; }
  if (n.type === 'Symbol' && n.name && n.payload && n.payload.nature === 'sounding') out.push(n.name);
  for (const k of ['voices', 'elements', 'content', 'symbol', 'triggers', 'primary', 'secondaries']) {
    if (n[k]) naturesSonnantes(n[k], out);
  }
  return out;
};

// ── 1. LA CONTRADICTION EXISTE-T-ELLE, ET SUR QUELLE ÉTENDUE ? ──────────────────────────────
// ÉTENDUE INSCRITE le 2026-07-29 : UNE scène, UNE macro de câblage. Mesurée, pas estimée.
const ETENDUE_INSCRITE = [{ scene: 'patchbay.bps', macro: 'lead',
  date: '2026-07-29',
  pourquoi: "macro de câblage dont le nom sort en nature 'sounding' — donc l'aval lui donne une "
          + "place ET une durée alors que rien ne sonne. Réparation en attente d'une décision de "
          + "formalisme (le NOM de la nature) ; le correctif est localisé, parser.js:680-682." }];

exigerCorpus();
const trouvees = [];
for (const [nom, src] of toutesLesScenes()) {
  let o;
  try { o = compileToBPxAST(src); } catch { continue; }
  if (!o.ast || (o.errors || []).length) continue;
  const macros = new Map((o.ast.macros || []).map((m) => [m.name, m]));
  if (!macros.size) continue;
  for (const sg of o.ast.subgrammars || []) for (const r of sg.rules || []) {
    for (const n of naturesSonnantes(r.rhs || [])) {
      const m = macros.get(n);
      if (!m) continue;
      if (!(m.body || []).some((b) => b && b.type === 'Wiring')) continue;  // seul le CÂBLAGE est en cause
      const cle = `${nom.replace(/^.*\//, '')}:${n}`;
      if (!trouvees.includes(cle)) trouvees.push(cle);
    }
  }
}

const inscrites = ETENDUE_INSCRITE.map((e) => `${e.scene}:${e.macro}`);
const nouvelles = trouvees.filter((t) => !inscrites.includes(t));
const disparues = inscrites.filter((i) => !trouvees.includes(i));

console.log(`[deux signaux] étendue inscrite : ${inscrites.length} · mesurée : ${trouvees.length}`);

// LE CLIQUET — elle ne doit pas GRANDIR pendant qu'on attend l'arbitrage.
ok(nouvelles.length === 0,
  `1. la contradiction ne doit pas S'ÉTENDRE — ${nouvelles.length} nouvelle(s) : ${nouvelles.join(' · ')}. `
  + `Une macro de câblage de plus dans le flux, c'est un temps de musique de plus avalé.`);

// LE TÉMOIN QUI DIT QUE C'EST RÉPARÉ — et qui dit quoi faire, pas quoi ajuster.
ok(disparues.length === 0,
  `1. ⚠️ ${disparues.length} entrée(s) du registre ONT DISPARU : ${disparues.join(' · ')}. `
  + `NE PAS AJUSTER LE NOMBRE — c'est la RÉPARATION qui est arrivée. Vérifier que la nature a été `
  + `scellée (parser.js:680-682), puis RETIRER l'entrée du registre et transformer ce cliquet en `
  + `assertion : « une macro de câblage ne porte JAMAIS la nature sounding ».`);

// ── 2. CE QUI DOIT RESTER VRAI PENDANT L'ATTENTE ────────────────────────────────────────────
// Une macro ORDINAIRE garde sa durée : Romain l'a tranché explicitement (« une macro a TOUJOURS
// une durée, celle de ce qu'elle contient »). Sans ce témoin, une réparation trop large passerait.
{
  const r = compileToBPxAST('@core\n@alphabet.western\n@macro motif C4 D4\nS -> motif E4\n');
  const s = naturesSonnantes(r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || []);
  ok(s.includes('motif'),
    '2. SE TAIT — une macro ORDINAIRE garde la nature sonnante : elle a une durée, celle de son contenu');
}
// Et un MODULATEUR invoqué dure aussi — l'enveloppe a sa propre durée (même arbitrage).
ok(compileToBPxAST('@core\n@alphabet.western\n@mod\n@cv env1 mod.adsr(attack:5)\nS -> C4 env1\n').errors.length === 0,
  '2. SE TAIT — un modulateur invoqué reste légitime dans le flux');

// ── 3. SOCLE ─────────────────────────────────────────────────────────────────────────────────
ok(ETENDUE_INSCRITE.length >= 1, '3. le registre ne s\'est pas vidé de lui-même');
ok(ETENDUE_INSCRITE.every((e) => e.date && e.pourquoi),
  '3. chaque entrée du registre porte sa DATE et sa RAISON — une dérogation muette est un trou');

if (echecs.length) {
  console.error(`[deux signaux] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[deux signaux] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
