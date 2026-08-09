// UNE SCÈNE D'EXEMPLE ENSEIGNE — donc elle écrit la forme du JOUR, pas une forme qui compile encore.
//
// CE QUE ROMAIN A TRANCHÉ (2026-08-09) : « c'est BPScript qui est le plus proche du langage, alors
// c'est SA responsabilité de nous faire des scènes qui ont un peu de SENS et de MATIÈRE et qui
// PRODUISENT correctement. » Ce garde tient UNE des trois exigences — la forme. Il ne dit rien du
// sens ni de la matière, et il ne prétend pas le dire : ça se relit, ça ne se mesure pas.
//
// ⚠️ ET IL NE DIT PAS NON PLUS « ÇA PRODUIT ». Le compilateur seul rend un faux vert — il accepte
// des scènes que la dérivation refuse (payé par Kairos le matin, par kanopi le soir). La preuve de
// production appartient au banc qui DÉRIVE, chez kanopi, sur son corpus. Ce garde couvre la moitié
// amont, et il le dit plutôt que de laisser croire qu'il couvre tout.
//
// ── CE QUI REND CE GARDE DIFFÉRENT D'UNE LISTE ────────────────────────────────────────────────
// Il ne connaît AUCUN nom de forme morte. Il compile chaque scène et lit le refus : le langage
// lui-même dit ce qui est retiré, par ses propres messages. Une forme fermée demain est donc
// couverte le jour même, sans que personne y pense — c'est la seule façon qu'un garde grandisse
// avec le langage au lieu de vieillir avec lui.
//
// ⚠️ ET LE SOCLE EST UNE LISTE NOMMÉE, PAS UN COMPTE. Les scènes qui ne compilent pas aujourd'hui
// sont inscrites une par une dans `CE_QUI_DORT.md` avec leur motif ; ce garde exige qu'elles soient
// EXACTEMENT celles-là. Une sixième qui tomberait pour une autre raison ne peut donc pas se fondre
// dans un total — c'est la consigne de Romain sur le gel, et la raison en est qu'un compte tolère
// une compensation quand une liste dit LAQUELLE.

import fs from 'node:fs';
import path from 'node:path';
import { compileToBPxAST } from '../src/transpiler/index.js';

let echecs = 0;
const ok = (cond, quoi) => { if (!cond) { echecs++; console.log('  ÉCHEC ' + quoi); } };

const scenes = (function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.bps')) acc.push(p);
  }
  return acc;
})('public');

// LES SEULES SCÈNES AUTORISÉES À NE PAS COMPILER — nommées, datées, motivées dans l'inventaire du
// gel. Toute autre est un défaut : une démo qui n'analyse pas enseigne une forme morte à quiconque
// l'ouvre, et elle le fait en silence puisque personne ne compile une démo avant de la lire.
// VIDE, ET C'EST LA BONNE VALEUR. Les cinq démos qui n'analysaient plus ont été RÉÉCRITES le
// 2026-08-09, pas suspendues — Romain : « cv n'existe plus, pourquoi tu gèles, il faut réécrire ».
// Une démo est un objet qu'on ÉCRIT, pas une relique qu'on protège : quand sa forme meurt, elle se
// refait avec le langage du jour. J'avais commencé par les inscrire au gel ; c'était traiter une
// démo comme une mesure à préserver alors que c'est un texte à réécrire.
// La cinquième n'a pas été réécrite mais SUPPRIMÉE : son sujet entier (le câblage) a quitté le
// langage, et lui inventer un autre sujet aurait gardé un nom qui ment sur son contenu.
const SUSPENDUES = new Set([]);

const refusent = [];
for (const p of scenes) {
  const nom = path.basename(p);
  let erreurs = [];
  try { erreurs = compileToBPxAST(fs.readFileSync(p, 'utf8')).errors || []; }
  catch (e) { erreurs = [{ message: `CRASH : ${e.message}` }]; }
  if (erreurs.length) refusent.push([nom, erreurs[0].message]);
}

for (const [nom, message] of refusent) {
  ok(SUSPENDUES.has(nom),
    `'${nom}' n'analyse pas et n'est pas inscrite au gel — une démo qui enseigne doit écrire la `
    + `forme du jour. Reçu : ${message.slice(0, 90)}`);
}

// LES DEUX SENS. Une règle qui refuserait tout laisserait au vert la moitié « doit passer » ; c'est
// elle qui démasque (payé deux fois le 2026-07-28). Ici : les suspendues doivent VRAIMENT être en
// panne — une scène réparée qui reste inscrite ferait dormir un garde sur une exception éteinte,
// et l'exception survivrait à sa raison.
const enPanne = new Set(refusent.map(([n]) => n));
for (const nom of SUSPENDUES) {
  ok(enPanne.has(nom),
    `'${nom}' est inscrite au gel mais elle COMPILE — l'exception a survécu à sa raison, `
    + `la retirer de la liste et de CE_QUI_DORT.md.`);
}

// SOCLE ANTI-RÉTRÉCISSEMENT : si `public/` se vidait, ce garde passerait au vert sans avoir rien
// examiné — la famille « verdir sans examiner », fermée neuf fois dans ce dépôt.
ok(scenes.length >= 55, `le corpus de démos s'est vidé : ${scenes.length} scène(s), attendu ≥ 55`);

// TÉMOIN D'INSTRUMENT : sans lui, un compilateur devenu muet (acceptant tout) rendrait ce garde
// vert pour la pire des raisons. Une forme retirée DOIT toujours être refusée.
const temoin = compileToBPxAST('@mm:60\nS -> C4 D4');
ok(temoin.errors.length >= 1,
  'TÉMOIN — une forme retirée du langage doit être REFUSÉE ; le compilateur ne mord plus.');

console.log(echecs === 0
  ? `✅ les démos écrivent la forme du jour (${scenes.length} scènes, ${SUSPENDUES.size} suspendues nommément)`
  : `❌ ${echecs} échec(s)`);
process.exit(echecs === 0 ? 0 : 1);
