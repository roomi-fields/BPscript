#!/usr/bin/env node
/**
 * GARDE — une clé de TERMINAL se valide comme la même clé chez un ACTEUR.
 *
 * ⛔ CE QU'IL FERME : DEUX MÉCANISMES POUR UN SEUL FAIT. Mesuré le 2026-08-29, sur les trois clés
 * à la fois — `tuning.zzzz`, `octaves.zzzz`, `out.zzzz` étaient REFUSÉS chez un acteur et ACCEPTÉS
 * chez un terminal. La profondeur choisissait le mécanisme : une règle qui vaut à un étage et pas
 * à l'autre n'est pas une règle, c'est un cas.
 *
 * ⚠️ ET LE MOT INCONNU ARRIVAIT JUSQU'À L'ARBRE que l'aval reçoit — ce n'est pas « la place
 * ignore », c'est « la place passe ». Vérifié par CONTRÔLE NÉGATIF : la même clé remplie
 * correctement ne porte aucune trace du mot témoin, donc la trace mesurée vient bien de la place.
 *
 * ⛔ LE GARDE S'ÉCRIT POUR LA CONSTRUCTION, JAMAIS POUR LA FORME SIGNALÉE. Les QUATRE graphies de
 * déclaration convergent sur le même nœud (`DefDirective{kind:'terminal'}`) et il les éprouve
 * toutes : `terminal x (k.v)`, `terminal x k.v`, `def x k.v`, et le bloc indenté. Fermer sur celle
 * qui s'est montrée en aurait laissé trois ouvertes.
 *
 * ⛔ ET IL ÉPROUVE PLUS D'UNE NATURE. Un garde qui ne pose qu'un objet vide mesure un PLAFOND de
 * refus : la place pourrait accepter un objet d'une autre nature. Six natures déclarées passent
 * ici, plus le croisement d'axes — une entrée d'accordage posée sur la clé des registres.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compileToBPxAST } = require('../src/transpiler/index.js');

let ok = 0; let ko = 0;
const verifier = (cond, quoi) => { if (cond) { ok += 1; } else { ko += 1; console.error(`FAIL — ${quoi}`); } };

const T = 'core\nalphabet.western:midi\n';
const A = 'core\nalphabet.western\n';
const compile = (src) => {
  const r = compileToBPxAST(src);
  return { errs: (r.errors || []).map((e) => e.message), arbre: r.ast ? JSON.stringify(r.ast) : '' };
};

// LES QUATRE GRAPHIES — elles se dérivent du nom de la clé et de sa valeur, jamais recopiées.
const graphies = (cle, val) => [
  `terminal cloche (${cle}.${val})`,
  `terminal cloche ${cle}.${val}`,
  `def cloche ${cle}.${val}`,
  `def cloche\n  ${cle}.${val}`,
];

// ── 1. LA PLACE REFUSE, DANS TOUTES SES GRAPHIES ──────────────────────────────────────────────
let graphiesExaminees = 0;
// ⛔ `voice` EST ENTRÉE LE 2026-08-29, PAR LA DONNÉE ET PAR ELLE SEULE. Romain a tranché l'issue B
// le même jour — « la bible cite des noms qui existent » — et la fermeture n'a coûté AUCUNE ligne
// de code : `voice` rejoint `schema.catalogAxes` en librairie, et le point 5 la prend aussitôt.
// ⚠️ SANS CE VOLET, LA FERMETURE N'AVAIT PAS DE TÉMOIN : retirer `voice` des axes déclarés ne
// faisait rougir que l'empreinte du paquet — un ordre de clés — et aucun garde de comportement.
// Un mécanisme dont l'injection ne mord que sur une empreinte est une hypothèse.
for (const cle of ['tuning', 'octaves', 'out', 'voice']) {
  for (const g of graphies(cle, 'zzzz')) {
    graphiesExaminees += 1;
    const errs = compile(`${T}${g}\n-----\nS -> C4\n`).errs;
    verifier(errs.length > 0, `${cle} : « ${g.replace('\n', ' ⏎ ')} » est REFUSÉ`);
    verifier(errs.some((m) => m.includes('zzzz')),
      `${cle} : le refus CITE le nom fautif au lieu de rejeter sans rien dire`);
  }
}
// ⛔ UN GARDE COMPTE CE QU'IL A EXAMINÉ ET REFUSE D'AVOIR EXAMINÉ ZÉRO — sans quoi une liste vide
// rendrait ce fichier vert sans avoir rien éprouvé.
verifier(graphiesExaminees === 16, `les 16 graphies × clés ont été examinées (${graphiesExaminees})`);

// ── 2. LE REFUS DIT LAQUELLE DES TROIS CAUSES DE CANAL ────────────────────────────────────────
// Un canal peut être fautif de trois façons ; un message unique enverrait chercher la mauvaise.
{
  const inexistant = compile(`${T}terminal cloche (out.zzzz)\n-----\nS -> C4\n`).errs.join(' ');
  verifier(/n'existe pas/.test(inexistant), "out.zzzz : le refus dit que le CANAL n'existe pas");
  const pasUneSortie = compile(`${T}terminal cloche (out.keyboard)\n-----\nS -> C4\n`).errs.join(' ');
  verifier(/n'est pas une sortie/.test(pasUneSortie),
    "out.keyboard : le canal EXISTE, et le refus dit qu'il n'est pas une SORTIE — pas « inconnu »");
  verifier(/terminal 'cloche'/.test(pasUneSortie), 'et le refus nomme le terminal en cause');
}

// ── 3. LE CONTRÔLE NÉGATIF — couper trop large est l'autre façon d'échouer ─────────────────────
for (const forme of [
  'terminal cloche (tuning.western_just)',
  'terminal cloche (octaves.western)',
  'terminal cloche (out.midi)',
  'terminal cloche (voice.wobble)',
  'terminal cloche (voice.bayan_muted)',
  'terminal cloche (voice.dayan_ring)',
  'terminal cloche (tuning.western_just, octaves.western, out.midi)',
  'terminal cloche (degree:0)',
  'terminal cloche (hz:440)',
  'def cadence C4 D4',
  'def kick (vel:120)',
]) {
  verifier(compile(`${T}${forme}\n-----\nS -> C4\n`).errs.length === 0,
    `la place remplie CORRECTEMENT passe toujours : « ${forme} »`);
}

// ── 4. PLUS D'UNE NATURE — le refus ne tient pas qu'à l'objet vide ─────────────────────────────
const NATURES = [
  ['objet vide', 'object n1 ()\n', 'n1'],
  ['objet PORTEUR', 'object n2 (scope:flow, x:1)\n', 'n2'],
  ['exemplaire dérivé', 'object p (scope:flow)\np n3 ()\n', 'n3'],
  ['drapeau', 'flag n4:0\n', 'n4'],
  ['définition', 'def n5 (vel:120)\n', 'n5'],
  ['variable de travail', 'signal n6\n', 'n6'],
];
for (const cle of ['tuning', 'octaves', 'out', 'voice']) {
  for (const [quoi, decl, nom] of NATURES) {
    verifier(compile(`${T}${decl}terminal cloche (${cle}.${nom})\n-----\nS -> C4\n`).errs.length > 0,
      `${cle} : un ${quoi} déclaré y est refusé — le refus porte sur la NATURE, pas sur l'absence`);
  }
}
// LE CROISEMENT D'AXES : une entrée qui EXISTE, posée sur la clé d'un autre axe.
verifier(compile(`${T}terminal cloche (tuning.western)\n-----\nS -> C4\n`).errs.length > 0,
  "tuning.western : 'western' existe en REGISTRES, pas en accordage — la place le refuse");
verifier(compile(`${T}terminal cloche (octaves.western_just)\n-----\nS -> C4\n`).errs.length > 0,
  "octaves.western_just : l'entrée existe en ACCORDAGE, pas en registres — la place le refuse");

// ── 5. LA BÊTISE N'ARRIVE PLUS DANS L'ARBRE, et le témoin correct n'en porte aucune trace ─────
{
  const bon = compile(`${T}terminal cloche (tuning.western_just)\n-----\nS -> C4\n`);
  verifier(!/zzzz/.test(bon.arbre), "CONTRÔLE NÉGATIF : l'arbre du témoin correct ne porte pas le mot témoin");
  const mauvais = compile(`${T}terminal cloche (tuning.zzzz)\n-----\nS -> C4\n`);
  verifier(mauvais.arbre === '', "et l'arbre d'un refus est NUL — le mot ne part pas à l'aval");
}

// ── 6. L'ACTEUR N'A PAS BOUGÉ — la fermeture reprend son mécanisme, elle n'en pose pas un second ─
verifier(compile(`${A}actor basse (tuning.zzzz)\n-----\nS -> C4\n`).errs.length > 0,
  "l'acteur refuse toujours un accordage inconnu");
verifier(compile(`${A}actor basse (tuning.western_just)\n-----\nS -> C4\n`).errs.length === 0,
  "et il accepte toujours le bon");
{
  // LE MÊME MESSAGE DES DEUX CÔTÉS pour un axe à catalogue : un seul mécanisme, donc une seule
  // phrase. Deux textes différents signaleraient deux chemins de refus.
  const a = compile(`${A}actor basse (tuning.zzzz)\n-----\nS -> C4\n`).errs[0];
  const t = compile(`${T}terminal cloche (tuning.zzzz)\n-----\nS -> C4\n`).errs[0];
  verifier(a === t, `acteur et terminal rendent le MÊME refus sur un axe à catalogue`);
}

console.log(`Résultat une_cle_de_terminal_se_valide_comme_celle_d_un_acteur : ${ok} OK, ${ko} FAIL`);
if (ko) process.exit(1);
