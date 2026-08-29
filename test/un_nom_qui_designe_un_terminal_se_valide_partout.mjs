#!/usr/bin/env node
/**
 * GARDE — un nom qui doit DÉSIGNER UN TERMINAL se valide comme un terminal, où qu'il s'écrive.
 *
 * ⛔ CE QU'IL FERME : LA POSITION CHOISISSAIT LE MÉCANISME. Mesuré le 2026-08-29 :
 *
 *     C4!vide     secondaire derrière un primaire     REFUSÉ
 *     !vide       le même secondaire, posé SEUL       ACCEPTÉ
 *
 * Un même nom, un même rôle, deux sorts selon qu'un primaire le précède. Le parseur range le
 * second sous un nœud `OutTimeObject` et la validation ne nommait que `Symbol` : une règle qui
 * vaut à une position et pas à l'autre n'est pas une règle, c'est un cas.
 *
 * ⛔ ET LE SUJET D'UN RÉGLAGE DÉSIGNE DES TERMINAUX — `EBNF.md` § « Réglages » : « un nom désigne
 * les terminaux de ce nom ». Un nom qu'aucun alphabet ne porte n'en désignait aucun, et le réglage
 * partait quand même dans l'arbre, sans destinataire.
 *
 * ⛔ LE GARDE S'ÉCRIT POUR LA CONSTRUCTION. Les deux places vivent sous PLUSIEURS porteurs, mesurés
 * avant d'écrire : l'objet hors-temps au premier rang, sous un groupe, sous une polymétrie, avec
 * ses arguments ; le sujet sous les QUATRE porteurs de paires que le parseur produit — sac collé au
 * symbole, sac de portée groupe, sac de portée règle, sac posé dans le flux. Une matrice, pas une
 * liste : fermer la place qui s'est montrée en aurait laissé six ouvertes.
 *
 * ⚠️ ET LE REFUS DE L'OBJET HORS-TEMPS EST LE MÊME TEXTE QUE CELUI DU SECONDAIRE — c'est
 * l'assertion qui prouve qu'un seul mécanisme sert les deux. Deux phrases signaleraient deux
 * chemins de refus, donc le retour du défaut qu'on vient de fermer.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compileToBPxAST } = require('../src/transpiler/index.js');

let ok = 0; let ko = 0;
const verifier = (cond, quoi) => { if (cond) { ok += 1; } else { ko += 1; console.error(`FAIL — ${quoi}`); } };

const T = 'core\nalphabet.western:midi\n';
const compile = (src) => {
  const r = compileToBPxAST(src);
  return { errs: (r.errors || []).map((e) => e.message), arbre: r.ast ? JSON.stringify(r.ast) : '' };
};

// ── 1. L'OBJET HORS-TEMPS — TOUS SES CONTENANTS ───────────────────────────────────────────────
// Les contenants se dérivent de la place du terme dans le flux, jamais recopiés d'un cas vu.
const CONTENANTS_HORS_TEMPS = [
  ['premier rang', (x) => `S -> !${x} C4`],
  ['sous un groupe', (x) => `S -> {!${x} C4}`],
  ['sous une voix de polymétrie', (x) => `S -> {!${x}, D4}`],
  ['porteur de ses arguments', (x) => `S -> !${x}(vel:120) C4`],
  ['second rang, derrière un terme', (x) => `S -> C4 !${x}`],
];
let contenantsExamines = 0;
for (const [ou, forme] of CONTENANTS_HORS_TEMPS) {
  contenantsExamines += 1;
  const errs = compile(`${T}-----\n${forme('vide')}\n`).errs;
  verifier(errs.length > 0, `objet hors-temps ${ou} : un nom que rien ne déclare est REFUSÉ`);
  verifier(errs.some((m) => m.includes('vide')), `objet hors-temps ${ou} : le refus CITE le nom fautif`);
}
verifier(contenantsExamines === 5, `les 5 contenants ont été examinés (${contenantsExamines})`);

// ⛔ LE MÊME TEXTE QUE LE SECONDAIRE — un seul mécanisme, donc une seule phrase.
{
  const seul = compile(`${T}-----\nS -> !vide C4\n`).errs[0];
  const derriere = compile(`${T}-----\nS -> C4!vide\n`).errs[0];
  verifier(seul === derriere,
    `l'objet hors-temps et le secondaire rendent le MÊME refus — reçu « ${seul} » et « ${derriere} »`);
}

// ── 2. LE SUJET D'UN RÉGLAGE — LES QUATRE PORTEURS DE PAIRES ──────────────────────────────────
// Mesurés sur l'arbre : suffixQualifiers.pairs · settings.pairs (nœud) · settings.pairs (règle) ·
// qualifier.pairs. Plus la descente sous une voix de groupe, qui ajoute un cran de profondeur.
const PORTEURS_DE_SUJET = [
  ['sac collé au symbole', (s) => `S -> C4(${s}:vel:120)`],
  ['sac de portée groupe', (s) => `S -> {C4 D4}(${s}:vel:120)`],
  ['sac de portée règle', (s) => `S -> C4 D4 (${s}:vel:120)`],
  ['sac posé dans le flux', (s) => `S -> C4 !(${s}:vel:120) D4`],
  ['sac collé, SOUS un groupe', (s) => `S -> {C4(${s}:vel:120) D4}`],
];
let porteursExamines = 0;
for (const [ou, forme] of PORTEURS_DE_SUJET) {
  porteursExamines += 1;
  const errs = compile(`${T}-----\n${forme('vide')}\n`).errs;
  verifier(errs.length > 0, `sujet dans un ${ou} : un nom qui ne désigne aucun terminal est REFUSÉ`);
  verifier(errs.some((m) => /sujet de réglage/.test(m)),
    `sujet dans un ${ou} : le refus nomme la PLACE — un utilisateur doit savoir que c'est le sujet`);
}
verifier(porteursExamines === 5, `les 5 porteurs de paires ont été examinés (${porteursExamines})`);

// ── 3. LE CONTRÔLE NÉGATIF — couper trop large est l'autre façon d'échouer ─────────────────────
for (const [quoi, src] of [
  ['un sujet qui nomme un terminal', 'S -> C4 D4 (C4:vel:120)'],
  ['le sujet UNIVERSEL', 'S -> C4 D4 (*:vel:120)'],
  ['aucun sujet du tout', 'S -> C4 D4 (vel:120)'],
  ['un objet hors-temps qui nomme un terminal', 'S -> D4 !C4'],
  ['un secondaire ordinaire', 'S -> C4!D4'],
  ['un sac sans la moindre paire à sujet', 'S -> C4(vel:120, cc.98:45)'],
]) {
  const errs = compile(`${T}-----\n${src}\n`).errs;
  verifier(errs.length === 0, `${quoi} passe toujours : « ${src} » (reçu : ${errs[0] || ''})`);
}
// Ce qui se déclare passe aussi — une définition, un non-terminal.
for (const [quoi, src] of [
  ['une DÉFINITION en sujet', `def f (vel:120)\n-----\nS -> C4 (f:vel:120)`],
  ['une DÉFINITION en objet hors-temps', `def f (vel:120)\n-----\nS -> !f C4`],
  ['un NON-TERMINAL en sujet', `-----\nS -> A (A:vel:120)\nA -> C4`],
  ['un NON-TERMINAL en objet hors-temps', `-----\nS -> C4 !A\nA -> D4`],
]) {
  verifier(compile(`${T}${src}\n`).errs.length === 0, `${quoi} passe toujours : « ${quoi} »`);
}
// La QUALIFICATION PAR ACTEUR et la VOIX-CODE restent hors de portée — elles l'étaient avant.
verifier(compile('core\nactor melodie\n  alphabet.western\nactor perc\n  alphabet.tabla\n'
  + '-----\nS -> melodie.C4 !perc.dha\n').errs.length === 0,
  'un objet hors-temps QUALIFIÉ PAR UN ACTEUR passe toujours');
verifier(compile('core\nactor moteur (eval.js)\nalphabet.western\n'
  + '-----\nS -> C4 !moteur.nimporte\n').errs.length === 0,
  "un objet hors-temps sur une VOIX-CODE passe toujours — son terminal est arbitraire");

// ── 4. PLUS D'UNE NATURE — et ce qu'elle mesure ici est un RÉGIME, pas un refus ────────────────
//
// ⛔ CES TROIS PLACES ONT LE RÉGIME DU FLUX, PARCE QU'ELLES ONT SON MÉCANISME. Mesuré le
// 2026-08-29 : un objet déclaré et vide passe en `S -> n1`, donc il passe aussi en `!n1` et en
// `(n1:vel:120)`. Le vocabulaire du flux vérifie qu'un nom EXISTE ; il ne juge pas ce que la chose
// est. Poser ici un refus de nature que `S -> n1` n'a pas, ce serait un SECOND mécanisme, choisi
// par la position — le défaut même que cette frappe ferme.
//
// ⇒ CE QUE LE GARDE ASSERTE EST DONC L'ÉGALITÉ DES TROIS SORTS, quel que soit le sort. Il ne fige
// aucun régime : le jour où le vocabulaire du flux jugera la nature, ces trois places bougeront
// ensemble ou ce garde rougira. C'est l'assiette, et elle vaut sur toutes les natures déclarées.
const NATURES = [
  ['objet vide', 'object n1 ()\n', 'n1'],
  ['objet PORTEUR', 'object n2 (scope:flow, x:1)\n', 'n2'],
  ['exemplaire dérivé', 'object p (scope:flow)\np n3 ()\n', 'n3'],
  ['drapeau', 'flag n4:0\n', 'n4'],
  ['acteur', 'actor n5\n  alphabet.western\n', 'n5'],
  ['entrée', 'in.midi n6\n', 'n6'],
];
let naturesExaminees = 0;
for (const [quoi, decl, nom] of NATURES) {
  naturesExaminees += 1;
  const dansLeFlux = compile(`${T}${decl}-----\nS -> ${nom} C4\n`).errs.length > 0;
  const horsTemps = compile(`${T}${decl}-----\nS -> !${nom} C4\n`).errs.length > 0;
  const enSujet = compile(`${T}${decl}-----\nS -> C4 D4 (${nom}:vel:120)\n`).errs.length > 0;
  verifier(horsTemps === dansLeFlux,
    `${quoi} : l'objet hors-temps a le MÊME sort que le flux (flux ${dansLeFlux ? 'refuse' : 'passe'}, `
    + `hors-temps ${horsTemps ? 'refuse' : 'passe'}) — un seul mécanisme, un seul régime`);
  verifier(enSujet === dansLeFlux,
    `${quoi} : le sujet de réglage a le MÊME sort que le flux (flux ${dansLeFlux ? 'refuse' : 'passe'}, `
    + `sujet ${enSujet ? 'refuse' : 'passe'}) — un seul mécanisme, un seul régime`);
}
verifier(naturesExaminees === 6, `les 6 natures déclarées ont été examinées (${naturesExaminees})`);
// LE CROISEMENT : un nom qui EXISTE dans un autre alphabet, hors de celui en portée.
verifier(compile(`${T}-----\nS -> !dha C4\n`).errs.length > 0,
  "objet hors-temps : 'dha' existe en tabla, pas sous l'alphabet en portée — refusé");
verifier(compile(`${T}-----\nS -> C4 (dha:vel:120)\n`).errs.length > 0,
  "sujet de réglage : 'dha' existe en tabla, pas sous l'alphabet en portée — refusé");

// ── 5. LA BÊTISE N'ARRIVE PLUS DANS L'ARBRE, et le témoin correct n'en porte pas trace ─────────
// ⚠️ LE MOT SE CHERCHE COMME VALEUR *ET* COMME CLÉ : un balayage par valeur ne voit pas une clé,
// et un réglage y arrive sous `params.<clé>`. Mesuré le 2026-08-29 sur une autre place.
{
  const bon = compile(`${T}-----\nS -> D4 !C4 (C4:vel:120)\n`);
  verifier(!/vide/.test(bon.arbre), "CONTRÔLE NÉGATIF : l'arbre du témoin correct ne porte pas le mot témoin");
  verifier(compile(`${T}-----\nS -> !vide C4\n`).arbre === '',
    "et l'arbre d'un objet hors-temps refusé est NUL — le mot ne part pas à l'aval");
  verifier(compile(`${T}-----\nS -> C4 D4 (vide:vel:120)\n`).arbre === '',
    "et l'arbre d'un sujet refusé est NUL — le réglage sans destinataire ne part pas à l'aval");
}

console.log(`Résultat un_nom_qui_designe_un_terminal_se_valide_partout : ${ok} OK, ${ko} FAIL`);
if (ko) process.exit(1);
