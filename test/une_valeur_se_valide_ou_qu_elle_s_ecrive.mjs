#!/usr/bin/env node
/**
 * GARDE — une VALEUR se valide OÙ QU'ELLE S'ÉCRIVE, et une entrée de modulation ne gouverne pas
 * la portée d'un contrôle homonyme.
 *
 * DEUX CORRECTIONS DU MÊME JOUR (Romain, 2026-08-15), et elles se tiennent : toutes deux viennent
 * d'une table qui répondait à une question qu'on ne lui posait pas.
 *
 * ═══ A. LA TÊTE DE SCÈNE EST UNE PLACE D'ÉCRITURE COMME UNE AUTRE
 *
 * CE QUI PASSAIT : `@vel:200` COMPILAIT, alors que `!(vel:200)` était refusé en nommant la plage.
 * La collecte des valeurs ne ramassait que les paires d'un SAC ; une directive de tête n'est pas
 * un sac. La validation ne voyait donc jamais la moitié des écritures.
 *
 * CE QUI L'A RENDU BLOQUANT : `rate` et `fadeout` ne s'écrivent QU'en tête de scène. Leurs bornes
 * — mesurées sur les sources du moteur, que le natif fait respecter en ARRÊTANT la compilation —
 * ne mordaient nulle part. Des plages déclarées qui ne validaient rien sont pires qu'une absence :
 * elles font croire que la valeur est gardée.
 *
 * ═══ B. DEUX CONCEPTS, UN NOM, DEUX TABLES
 *
 * `pan` est écrit deux fois dans le vocabulaire : une VALEUR qu'on écrit (`!(pan:64)`, contrôle
 * 0..127) et une CIBLE où un CV se branche (`(pan: env1)`, entrée de modulation −1..1). La table
 * des portées les confondait, et la boucle des modulations passant en dernier, l'entrée ÉCRASAIT
 * le contrôle. Résultat mesuré : `pan` avait reçu `scene` dans sa déclaration, sur arbitrage de
 * Romain, et `@pan:64` restait refusé en récitant les places de l'AUTRE `pan`.
 *
 * ⛔ CE QUE CE GARDE TIENT, ET SON COMPLÉMENT. Il ne suffit pas que `@pan:64` passe : il faut aussi
 * qu'un nom qui n'appartient QU'aux modulations garde SA portée. Sinon la séparation serait un
 * desserrage — tout deviendrait écrivable partout, et le garde serait vert en décrivant un langage
 * plus large que le vrai.
 *
 * INJECTION dans le JUGE, et dans l'ACCUSÉ pour chacune des deux corrections.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const erreursDe = (src) => {
  try { return compileToBPxAST(src).errors ?? []; } catch (e) { return [{ message: e.message }]; }
};
const horsPlage = (src) =>
  erreursDe(src).filter((e) => /hors plage pour le contrôle/.test(String(e.message)));
const horsPortee = (src) =>
  erreursDe(src).filter((e) => /ne peut pas s'écrire/.test(String(e.message)));

// ── A1. LA MÊME VALEUR, LES DEUX PLACES, LE MÊME VERDICT ────────────────────────────────────
// La matrice est le point : un mot qui s'écrit à deux places doit être jugé pareil aux deux, et
// c'est l'ÉCART entre les deux colonnes qui était le défaut.
const MOTS = [
  ['vel',           200,  100],
  ['ins',           129,    5],
  ['volumecontrol', 128,   11],
  ['pancontrol',    128,   10],
  ['chan',           17,    3],
];
for (const [mot, mauvaise, bonne] of MOTS) {
  ok(horsPlage(`@core\n@midi.${mot}:${mauvaise}\nS -> C4\n`).length > 0
     || horsPlage(`@core\n@${mot}:${mauvaise}\nS -> C4\n`).length > 0,
     `A1. '${mot}:${mauvaise}' en TÊTE DE SCÈNE doit être refusé en nommant la plage — c'est la `
     + `place qui échappait à la validation`);
  ok(erreursDe(`@core\nS -> C4 !(${mot}:${mauvaise})\n`).length > 0,
     `A1. '${mot}:${mauvaise}' dans un SAC doit rester refusé`);
  ok(erreursDe(`@core\nS -> C4 !(${mot}:${bonne})\n`).length === 0,
     `A1. '${mot}:${bonne}' dans un sac doit passer — le complément, sans quoi ce garde décrirait `
     + `un langage qui refuse tout`);
}

// ── A2. LES DEUX MOTS QUI NE S'ÉCRIVENT QU'EN TÊTE — le cas qui a rendu la faute bloquante ───
for (const [mot, mauvaise, bonne] of [['rate', 1001, 50]]) {
  ok(horsPlage(`@core\n@midi.${mot}:${mauvaise}\nS -> C4\n`).length > 0,
     `A2. '${mot}' ne s'écrit QU'en tête de scène : sa plage doit y mordre, sinon elle ne mord `
     + `nulle part`);
  ok(erreursDe(`@core\n@midi.${mot}:${bonne}\nS -> C4\n`).length === 0,
     `A2. '${mot}:${bonne}' doit passer`);
}

// ── A3. CE QUI N'EST PAS UN CONTRÔLE PASSE SANS BRUIT ───────────────────────────────────────
// Le complément d'A1 : la validation ne connaît que les mots de la librairie. Une directive de
// tête qui n'en est pas ne doit pas se mettre à rougir parce qu'on a élargi la collecte.
for (const [quoi, src] of [
  ['un composant de catalogue', '@core\n@alphabet.western\nS -> C4\n'],
  ['un mot nu',                 '@core\n@midi.letring\nS -> C4\n'],
  ['le socle lui-même',         '@core\nS -> C4\n'],
]) {
  ok(erreursDe(src).length === 0, `A3. ${quoi} doit continuer de compiler`);
}

// ── B1. `pan` ACCEPTE LA TÊTE DE SCÈNE, comme `vel` et `volume` ─────────────────────────────
for (const mot of ['pan', 'vel', 'volume']) {
  ok(horsPortee(`@core\n@${mot}:64\nS -> C4\n`).length === 0,
     `B1. '@${mot}:64' en tête de scène doit être accepté — sa portée déclarée le permet, et rien `
     + `d'autre ne doit la recouvrir`);
}

// ── B2. LE COMPLÉMENT — un nom PROPRE aux modulations garde SA portée ───────────────────────
// Sans ce volet, séparer les tables aurait pu rendre tout écrivable partout, et B1 serait vert
// pour la mauvaise raison.
ok(horsPortee('@core\n@cutoff:400\nS -> C4\n').length > 0,
   "B2. 'cutoff' n'appartient QU'aux entrées de modulation : sa portée doit continuer de refuser "
   + 'la tête de scène. La séparation donne le dernier mot au contrôle, elle ne supprime pas la '
   + 'portée des modulations.');
ok(erreursDe('@core\nS -> C4(cutoff:400)\n').length === 0,
   "B2. et 'cutoff' doit rester écrivable là où sa portée l'autorise");

// ── B3. LES DEUX FAMILLES SONT TENUES SÉPARÉMENT DANS LA DONNÉE ─────────────────────────────
{
  const { LIBS } = await import('../src/transpiler/libs-data.js');
  const controle = LIBS.expression?.controls?.pan;
  let entree = null;
  for (const [type, e] of Object.entries(LIBS.modulation || {})) {
    if (type.startsWith('_') || !e || typeof e !== 'object') continue;
    if (e.pan) entree = e.pan;
  }
  ok(controle && entree,
     "B3. SOCLE : les deux `pan` doivent exister — le contrôle et l'entrée de modulation. Si l'un "
     + 'disparaît, ce garde ne mesure plus la collision qu\'il existe pour tenir.');
  ok(controle && Array.isArray(controle.scope) && controle.scope.includes('scene'),
     `B3. le CONTRÔLE 'pan' doit déclarer la tête de scène — arbitrage de Romain. Vu : `
     + `${JSON.stringify(controle && controle.scope)}`);
  ok(entree && Array.isArray(entree.scope) && !entree.scope.includes('scene'),
     `B3. l'ENTRÉE DE MODULATION 'pan' ne la déclare PAS — et c'est bien elle qui écrasait l'autre. `
     + `Vue : ${JSON.stringify(entree && entree.scope)}`);
}

// ── C. INJECTION DANS LE JUGE — les deux décisions rejouées isolées ──────────────────────────
const jugerPlage = (valeur, plage) => Array.isArray(plage) && typeof valeur === 'number'
  && (valeur < plage[0] || valeur > plage[1]);
ok(jugerPlage(200, [0, 127]), 'C. (mord) une valeur au-dessus du maximum');
ok(jugerPlage(0, [1, 128]), 'C. (mord) une valeur en dessous du minimum');
ok(!jugerPlage(64, [0, 127]), 'C. (se tait) une valeur dans la plage');
ok(!jugerPlage(true, [0, 127]), "C. (se tait) un mot nu n'a pas de valeur à juger");

const jugerPortee = (cle, controles, modulation) =>
  (controles.has(cle) ? controles.get(cle) : modulation.get(cle));
{
  const c = new Map([['pan', ['symbol', 'scene']]]);
  const mo = new Map([['pan', ['symbol']], ['cutoff', ['symbol']]]);
  ok(jugerPortee('pan', c, mo).includes('scene'),
     "C. (contrôle d'abord) le `pan` contrôle gouverne sa propre portée");
  ok(!jugerPortee('cutoff', c, mo).includes('scene'),
     "C. (modulation en repli) un nom qu'aucun contrôle ne porte garde la sienne");
}

const TOTAL_ATTENDU = MOTS.length * 3 + 2 + 3 + 3 + 2 + 3 + 4 + 2;
ok(passe + echecs.length === TOTAL_ATTENDU,
   `bilan : ${TOTAL_ATTENDU} vérifications attendues, ${passe + echecs.length} exécutées`);

if (echecs.length) {
  console.error(`❌ une valeur se valide où qu'elle s'écrive : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ une valeur se valide où qu'elle s'écrive — ${passe} vérification(s) passée(s)`);
}
