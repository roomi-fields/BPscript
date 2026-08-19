#!/usr/bin/env node
/**
 * GARDE — L'AROBASE EST SORTIE DU LANGAGE, ET SA SORTIE SE MESURE PLACE PAR PLACE.
 *
 * Décision Romain du 2026-08-16 : l'arobase quitte le langage, et c'est la POSITION qui qualifie
 * une ligne — avant le `-----` elle déclare, après elle produit.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE. Le refus mordait aux huit places, mesuré le 2026-08-19. Mais AUCUN
 * garde ne les tenait ENSEMBLE : neuf fichiers mentionnaient l'arobase, aucun ne l'énumérait. Un
 * comportement sans matrice tient tant que personne n'y touche — et le jour où une place rouvre,
 * rien ne le dit. Une graphie se retire d'un ESPACE, pas d'un endroit.
 *
 * ⛔ ET DEUX RETRAITS SE CROISENT ICI, LE GARDE DOIT LES SÉPARER. Sept places rendent « l'arobase
 * est SORTIE du langage ». La huitième — le suffixe collé à un élément, `C4@lent` — rend un AUTRE
 * message, parce que ce suffixe est sorti par SA PROPRE décision, le 2026-07-28, avant l'arobase.
 * Confondre les deux ferait croire qu'une seule décision couvre les deux formes : le jour où l'une
 * serait rouverte, l'autre partirait avec elle sans qu'on l'ait voulu.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const T = 'core\nalphabet.western\n';
const err = (src) => {
  try { return (compileToBPxAST(src).errors || []).map((e) => String(e.message ?? e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};

// ── 1. LES SEPT PLACES QUE LA DÉCISION DU 2026-08-16 COUVRE ──────────────────────────────────
// Une place par nature de ligne : ce que l'arobase pouvait précéder quand elle vivait.
const PLACES = [
  ['une invocation de librairie', `core\n@alphabet.western\n-----\nS -> C4\n`],
  ['un bloc d\'acteur',           `core\n@actor d\n  alphabet.western\n  out.midi\n-----\nS -> C4\n`],
  ['une définition',              `${T}@def k (vel:120)\n-----\nS -> C4\n`],
  ['l\'état de départ',           `${T}@init\n  \`sc: x\`\n-----\nS -> C4\n`],
  ['un réglage',                  `${T}@tempo:120\n-----\nS -> C4\n`],
  ['un mode, DANS le corps',      `${T}-----\nS -> C4\n@mode:ord\nT -> D4\n`],
  ['la section des gabarits',     `${T}-----\nS -> C4\n@template\n? -> C4\n`],
];

console.log(`[arobase] ${PLACES.length} places + le suffixe + ${3} témoins`);

for (const [quoi, src] of PLACES) {
  const e = err(src);
  ok(e.length >= 1, `1. l'arobase devant ${quoi} doit être REFUSÉE`);
  ok(e.some((m) => /l'arobase est SORTIE du langage/.test(m)),
    `1. l'arobase devant ${quoi} — le refus doit NOMMER la sortie de l'arobase, `
    + `pas constater une faute de frappe (reçu : ${e[0]?.slice(0, 110)})`);
  ok(e.some((m) => /POSITION/.test(m)),
    `1. l'arobase devant ${quoi} — le refus doit dire ce qui qualifie une ligne À SA PLACE : `
    + `sa POSITION de part et d'autre du délimiteur. Sans ça il retire sans réapprendre.`);
}

// ── 2. LA HUITIÈME PLACE — LE SUFFIXE, SORTI PAR SA PROPRE DÉCISION ─────────────────────────
// ⛔ ELLE NE DOIT PAS RENDRE LE MÊME MESSAGE. Le suffixe collé à un élément est sorti le
// 2026-07-28, presque trois semaines avant l'arobase. Deux retraits, deux causes.
{
  const e = err(`${T}-----\nS -> C4@lent\n`);
  ok(e.length >= 1, "2. le suffixe collé `C4@lent` doit être REFUSÉ");
  ok(e.some((m) => /suffixe/.test(m)),
    `2. le suffixe collé — le refus doit NOMMER le suffixe, qui est ce qui sort ici `
    + `(reçu : ${e[0]?.slice(0, 110)})`);
  ok(!e.some((m) => /l'arobase est SORTIE du langage/.test(m)),
    `2. le suffixe collé ne doit PAS être refusé au nom de l'arobase : il est sorti par sa propre `
    + `décision, le 2026-07-28. Un seul message pour deux retraits fait disparaître l'un des deux.`);
}

// ── 3. LE COMPLÉMENT — les mêmes lignes SANS arobase doivent PASSER ──────────────────────────
// Sans lui, un refus qui mordrait tout aurait exactement la même tête.
for (const [quoi, src] of [
  ['une invocation de librairie', `core\nalphabet.western\n-----\nS -> C4\n`],
  ['un bloc d\'acteur',           `core\nactor d\n  alphabet.western\n  out.midi\n-----\nS -> C4\n`],
  ['une définition',              `${T}def k (vel:120)\n-----\nS -> C4\n`],
  ['un réglage',                  `${T}tempo:120\n-----\nS -> C4\n`],
  ['un mode, DANS le corps',      `${T}-----\nS -> C4\nmode:ord\nT -> D4\n`],
]) {
  ok(err(src).length === 0, `3. TÉMOIN — ${quoi} SANS arobase doit PASSER (reçu : ${err(src)[0]?.slice(0, 90)})`);
}

// ── 4. ET LE SIGNE LUI-MÊME N'EST PLUS UN JETON DU LANGAGE ──────────────────────────────────
// Une place peut se fermer au parseur pendant que le signe reste lisible ailleurs. Ce volet le
// mesure sur une place qu'aucune des sept ne couvre : au milieu d'une règle.
{
  const e = err(`${T}-----\nS -> C4 @ D4\n`);
  ok(e.length >= 1, "4. l'arobase seule, au milieu d'une règle, doit être REFUSÉE");
}

if (echecs.length) {
  console.error(`[arobase] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[arobase] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
