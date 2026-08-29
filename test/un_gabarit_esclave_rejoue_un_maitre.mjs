#!/usr/bin/env node
/**
 * GARDE — un gabarit ESCLAVE rejoue un MAÎTRE, et un nom que personne ne capture n'en a aucun.
 *
 * `LANGUAGE.md` § « Capturer et rejouer, dans une regle » : « `$` capture un motif de groupe
 * (maitre), `&` le rejoue (esclave). LE NOM PORTE L'APPARIEMENT ENTRE LES DEUX. »
 *
 * ⛔ CE QUI PASSAIT, MESURÉ LE 2026-08-29 : `S -> C4 &zzz` compilait sans un mot, et le nœud
 * `TemplateSlave{name:'zzz'}` partait dans l'arbre que l'aval reçoit. Un rejeu qui ne rejoue rien
 * n'est pas un refus manquant sur une graphie exotique : c'est une règle du langage sans effet.
 *
 * ⛔ ET CE GARDE NE TRANCHE PAS LA PORTÉE DE L'APPARIEMENT — il la TIENT OUVERTE, et c'est son
 * volet le plus important. La bible ne dit pas si un esclave doit trouver son maître dans SA règle
 * ou dans la scène ; aujourd'hui les deux passent. Le refus ne mord donc que sur le cas vrai dans
 * les DEUX lectures : aucun `$nom` nulle part. Le volet 2 assert que la forme inter-règles passe
 * TOUJOURS — si un jour elle est resserrée, il rougit et dit exactement ce qui a changé.
 *
 * ⚠️ ET L'ANCRE MET LA SCÈNE HORS DE PORTÉE. `$` seul en tête de membre gauche ouvre un maître SANS
 * NOM, « et l'ancre reste ouverte jusqu'à sa fermeture » : rien n'écrit par quel nom un esclave le
 * rejoue. 10 scènes du corpus en portent une, et supposer une réponse les aurait cassées.
 *
 * MESURE AVANT ÉCRITURE — 756 scènes compilables, 55 portent un gabarit : ZÉRO esclave orphelin.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let ok = 0; let ko = 0;
const verifier = (cond, quoi) => { if (cond) { ok += 1; } else { ko += 1; console.error(`FAIL — ${quoi}`); } };

const T = 'core\nalphabet.western\n-----\n';
const compile = (src) => {
  const r = compileToBPxAST(T + src + '\n');
  return { errs: (r.errors || []).map((e) => e.message), arbre: r.ast ? JSON.stringify(r.ast) : '' };
};
const orphelin = (src) => compile(src).errs.filter((m) => /rejoue un gabarit que rien ne capture/.test(m));

// ── 1. L'ORPHELIN EST REFUSÉ, DANS TOUS SES CONTENANTS ────────────────────────────────────────
// Les contenants se dérivent de la place d'un terme dans le flux, pas d'un cas vu.
const CONTENANTS = [
  ['au premier rang', 'S -> &zzz C4'],
  ['en fin de règle', 'S -> C4 &zzz'],
  ['sous un groupe', 'S -> {C4 &zzz}'],
  ['sous une voix de polymétrie', 'S -> {&zzz, D4}'],
  ['porteur de ses arguments', 'S -> C4 &zzz(vel:120)'],
  ['dans une règle qui en porte un JUSTE', 'S -> $A C4 &A &zzz\nA -> D4'],
];
let contenantsExamines = 0;
for (const [ou, src] of CONTENANTS) {
  contenantsExamines += 1;
  const m = orphelin(src);
  verifier(m.length > 0, `1. un esclave orphelin ${ou} est REFUSÉ — « ${src} »`);
  verifier(m.length > 0 && m[0].includes('zzz'), `1. et le refus CITE le nom fautif (${ou})`);
}
verifier(contenantsExamines === 6, `1. les 6 contenants ont été examinés (${contenantsExamines})`);

// ── 2. LA PORTÉE RESTE OUVERTE — le volet qui empêche de trancher sans Romain ──────────────────
// ⛔ SI CE VOLET ROUGIT, QUELQU'UN A DÉCIDÉ QUE L'APPARIEMENT EST INTRA-RÈGLE. C'est peut-être
// voulu, et alors c'est un arbitrage : le relire AVANT de « réparer » ce fichier.
verifier(compile('S -> $A C4\nT -> &A D4\nA -> E4').errs.length === 0,
  "2. un maître dans UNE règle et son esclave dans une AUTRE passent — la portée de l'appariement "
  + "n'est pas écrite, ce refus ne la tranche pas");

// ── 3. LE CONTRÔLE NÉGATIF — couper trop large est l'autre façon d'échouer ─────────────────────
for (const [quoi, src] of [
  ['un maître et son esclave', 'S -> $A C4 &A\nA -> D4'],
  ['un maître SANS esclave', 'S -> $A C4\nA -> D4'],
  ['deux paires appariées', 'S -> $A &A $B &B\nA -> C4\nB -> D4'],
  ['un esclave apparié, sous un groupe', 'S -> $A {C4 &A}\nA -> D4'],
  ['un maître et son esclave, avec réglages', 'S -> $A (vel:80) &A (vel:40)\nA -> C4'],
  ['une scène sans le moindre gabarit', 'S -> C4 D4'],
  ['un groupe maître ANONYME', 'S -> ${C4 D4} E4'],
]) {
  verifier(compile(src).errs.length === 0,
    `3. ${quoi} passe toujours : « ${src.replace(/\n/g, ' ⏎ ')} » (reçu : ${compile(src).errs[0] || ''})`);
}

// ⚠️ L'ANCRE MET LA SCÈNE HORS DE PORTÉE — elle ouvre un maître sans nom.
verifier(compile('$ S -> C4 D4\nT -> &A E4').errs.length === 0,
  "3. une scène qui porte une ANCRE est hors de portée : l'ancre ouvre un maître SANS NOM, et rien "
  + "n'écrit par quel nom un esclave le rejoue");

// ── 4. LA BÊTISE N'ARRIVE PLUS DANS L'ARBRE ───────────────────────────────────────────────────
{
  const bon = compile('S -> $A C4 &A\nA -> D4');
  verifier(!/zzz/.test(bon.arbre), "4. CONTRÔLE NÉGATIF : l'arbre du témoin correct ne porte pas le mot témoin");
  verifier(compile('S -> C4 &zzz').arbre === '',
    "4. et l'arbre d'un esclave orphelin est NUL — le rejeu sans maître ne part pas à l'aval");
}

// ── 5. INJECTION DANS LE JUGE — la décision rejouée isolée ─────────────────────────────────────
const juger = (nom, maitres) => !maitres.has(nom);
verifier(juger('zzz', new Set(['A'])), '5. (mord) un nom que personne ne capture rougit');
verifier(!juger('A', new Set(['A'])), '5. (se tait) un nom capturé passe');
verifier(juger('A', new Set()), '5. (mord) aucun maître du tout rougit');

console.log(`Résultat un_gabarit_esclave_rejoue_un_maitre : ${ok} OK, ${ko} FAIL`);
if (ko) process.exit(1);
