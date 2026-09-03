#!/usr/bin/env node
/**
 * GARDE — UNE VALEUR PEUT COMMENCER PAR UN TIRET BAS.
 *
 * Décision Romain, 2026-08-19 : « les fonctions BP3 commencent par un tiret bas, c'est leur
 * convention ». Ce n'est donc pas au parseur de la refuser — et le contournement, renommer une
 * procédure native, mentirait sur ce que le moteur porte.
 *
 * ⛔ LE TIRET BAS EST UN SIGNE DU FLUX — la PROLONGATION — et le tokenizer le détache PARTOUT. Le
 * recoller au tokenizer changerait le sens d'un `_` écrit dans une production ; il se recolle donc
 * là où une VALEUR est attendue, et là seulement. Mesure du corpus avant d'écrire : 71 tirets bas
 * collés à un nom, tous dans des valeurs de librairie, ZÉRO dans les 69 scènes.
 *
 * ⛔ LE GARDE ÉCRIT LA PORTÉE **ET SON COMPLÉMENT**. La portée : les six places où une valeur
 * s'écrit. Le complément : le flux, où le tiret bas doit rester une PROLONGATION. Ne tenir que la
 * première ferait passer une correction qui casse le signe le plus commun du langage.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = 'core\nalphabet.western\n';
const erreursDe = (src) => (compileToBPxAST(src).errors || []).map((e) => String(e.message ?? e));

console.log('[tiret-bas] une valeur peut commencer par un tiret bas');

// ── A. LES SIX PLACES OÙ UNE VALEUR S'ÉCRIT ─────────────────────────────────────────────────
// Réparer l'endroit où le défaut s'est montré (le sac d'un type en tête) aurait laissé les cinq
// autres. Elles sont écrites une par une, et le garde rougit si l'une d'elles se referme.
for (const [ou, src] of [
  ['un sac de définition',            `${TETE}def x(bp3:_srand)\n-----\nS -> C4`],
  // Forme B (Romain, 2026-09-02) : un geste natif est un `control` qui porte `bpscript:false`.
  ['un sac de type en tête',          `${TETE}control srand(bp3:_srand, bpscript:false)\n-----\nS -> C4`],
  ['un sac du flux',                  `${TETE}-----\nS -> C4(vel:_srand)`],
  ['un corps indenté',                `${TETE}def x\n  bp3:_srand\n\n-----\nS -> C4`],
  ['la valeur de départ d\'une convention', `${TETE}signal grain:_x\n-----\nS -> C4`],
  ['la valeur de départ d\'un symbole',     `${TETE}symbol a:_x\n-----\nS -> C4`],
  ['une pose de tête',                `${TETE}tempo:_x\n-----\nS -> C4`],
]) {
  const e = erreursDe(src);
  ok(e.length === 0, `A. une valeur à tiret bas doit être lue dans ${ou} — reçu : ${e[0]?.slice(0, 120)}`);
}

// ⛔ TÉMOIN NON NUL — la même écriture SANS le tiret bas passe déjà. Sans lui, un lecteur cassé
// pour toutes les valeurs rendrait le volet A rouge pour une raison qui n'est pas celle-ci.
for (const [ou, src] of [
  ['un sac de définition',            `${TETE}def x(bp3:srand)\n-----\nS -> C4`],
  ['la valeur de départ d\'une convention', `${TETE}signal grain:x\n-----\nS -> C4`],
]) {
  ok(erreursDe(src).length === 0, `A-témoin. la même valeur SANS tiret bas doit passer dans ${ou}`);
}

// ── B. LE COMPLÉMENT — DANS LE FLUX, LE TIRET BAS RESTE UNE PROLONGATION ────────────────────
// C'est le volet qui compte : le signe le plus commun du langage ne doit pas changer de nature
// parce qu'on a ouvert une valeur ailleurs.
const rhsDe = (flux) => {
  const r = compileToBPxAST(`${TETE}-----\nS -> ${flux}`);
  return { erreurs: (r.errors || []).map((e) => String(e.message ?? e)),
           types: (r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || []).map((e) => e.type) };
};
{
  const un = rhsDe('C4 _ D4');
  ok(JSON.stringify(un.types) === JSON.stringify(['Symbol', 'Prolongation', 'Symbol']),
    `B. '_' isolé dans le flux reste une PROLONGATION — reçu ${JSON.stringify(un.types)}`);
  const deux = rhsDe('C4 _ _ D4');
  ok(deux.types.filter((t) => t === 'Prolongation').length === 2,
    `B. deux prolongations restent DEUX — reçu ${JSON.stringify(deux.types)}`);
  // ⛔ ET LE CAS QUI TRANCHE — IL SE MESURE SUR LA STRUCTURE, PAS SUR UN MESSAGE. Collé à un nom
  // dans une PRODUCTION, le tiret bas reste une prolongation SUIVIE d'un terme. Ma première
  // écriture lisait le refus « terminal 'srand' non déclaré » avec un motif lâche : posé au
  // TOKENIZER, le recollage rend « terminal '_srand' non déclaré », qui satisfaisait le même motif.
  // Le garde était VERT sur l'injection qui casse la prolongation — un garde dont le critère
  // n'exclut pas la faute ne prouve rien. On lit donc l'ARBRE, sur un terminal DÉCLARÉ.
  const colle = rhsDe('C4 _C4');
  ok(JSON.stringify(colle.types) === JSON.stringify(['Symbol', 'Prolongation', 'Symbol']),
    `B. dans une PRODUCTION, '_C4' reste une PROLONGATION suivie du symbole — s'il devenait un nom, `
    + `la scène changerait de sens en silence. Reçu ${JSON.stringify(colle.types)}`);
}

// ── C. CE QUI RESTE REFUSÉ — le tiret bas ne devient pas un joker ────────────────────────────
{
  // Un tiret bas SEUL après un deux-points n'est pas un nom : rien ne le suit.
  const e = erreursDe(`${TETE}signal grain:_\n-----\nS -> C4`);
  ok(e.length >= 1,
    'C. un tiret bas SEUL ne fait pas une valeur — il ne nomme rien. Si ça passe, le recollage '
    + 'accepte un signe isolé comme un nom.');
  // Et un tiret bas SÉPARÉ de son nom non plus : le collage réunit, l'espace sépare.
  const s = erreursDe(`${TETE}signal grain:_ srand\n-----\nS -> C4`);
  ok(s.length >= 1,
    'C. `_ srand` avec une espace ne fait pas un nom — sinon l\'espace cesserait de séparer les '
    + 'termes, à cet endroit seulement.');
}

ok(passe >= 13, `le garde doit avoir EXAMINÉ, pas seulement tourné(${passe} assertions)`);

if (echecs.length) {
  console.error(`[tiret-bas] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[tiret-bas] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
