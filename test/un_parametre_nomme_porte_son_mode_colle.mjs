#!/usr/bin/env node
/**
 * GARDE — un paramètre nommé par l'auteur est la CLÉ, et son mode se COLLE à lui.
 *
 * FORME RATIFIÉE PAR ROMAIN le 2026-08-13, après qu'il a refusé la précédente :
 *   `!(slide:101)` · `!(slidecont)` · `!(slidestep)` · `!(slidefixed)`
 * et le paramètre se déclare : `@var slide signal` — « un flux de nombres, sans convention de
 * lecture » (LANGUAGE.md, les six types de variable).
 *
 * CE QUE ÇA REMPLACE, ET LES DEUX CANONS QUE L'ANCIENNE GRAPHIE CASSAIT :
 *   `!(cont:slide)`      INVERSAIT LE SUJET ET LA VALEUR. Le deux-points LIE UN SUJET À UNE VALEUR ;
 *                        le sujet écrit était `cont` et la « valeur » était le paramètre, alors que
 *                        le sens est l'inverse — c'est `slide` le sujet, `cont` dit comment il varie.
 *   `!(value:slide 101)` CACHAIT LE SUJET DANS LA VALEUR : deux termes séparés par une espace, dont
 *                        le PREMIER est un nom. Et `value` ne nomme rien, c'est un mot de mécanisme.
 * Les deux sont RETIRÉES — pas dépréciées. Une graphie remplacée se supprime dans le même mouvement.
 *
 * ⚠️ ET LA FORME EST LA MÊME QUE CELLE DES VINGT-SEPT MOTS, ce qui est tout l'intérêt : `velstep` et
 * `slidestep` ne sont pas deux graphies, c'est une seule construction — le mode collé au nom du
 * paramètre. Le langage ne gagne pas une règle, il en étend une aux paramètres que l'auteur invente.
 *
 * CE QUE LE GARDE MESURE, EN MATRICE — la déclaration × les quatre écritures × les positions :
 *   1. déclaré, les quatre formes passent ;
 *   2. NON déclaré, les quatre sont refusées — un mot inconnu ne devient pas un paramètre par accident ;
 *   3. un mode qui n'existe pas (`slidewobble`) est refusé, même sur un paramètre déclaré ;
 *   4. l'ancienne graphie est refusée sous ses trois mots ;
 *   5. les vingt-sept mots des neuf paramètres ne bougent pas — le complément qui prouve qu'on n'a
 *      pas élargi la règle jusqu'à tout accepter.
 *
 * INJECTION dans l'ACCUSÉ et dans le JUGE.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = '@core\n@alphabet.western\n';
const DECL = `${TETE}@var slide signal\n\n`;
const erreursDe = (src) => {
  try { return compileToBPxAST(src).errors ?? []; } catch (e) { return [{ message: e.message }]; }
};

// ─── 0. TÉMOIN — la scène de base compile, sinon le garde mesure autre chose ─────────────────
ok(erreursDe(`${TETE}S -> C4\n`).length === 0, '0. TÉMOIN : la scène nue doit compiler');
ok(erreursDe(`${DECL}S -> C4\n`).length === 0,
   "0. TÉMOIN : `@var slide signal` seul doit compiler — c'est la déclaration, pas un emploi");

// ─── 1. DÉCLARÉ — les quatre écritures passent, aux positions où un réglage se pose ──────────
for (const [quoi, src] of [
  ['la valeur, dans le flux',      `${DECL}S -> !(slide:101) C4\n`],
  ['le mode continu',              `${DECL}S -> !(slidecont) C4\n`],
  ['le mode par paliers',          `${DECL}S -> !(slidestep) C4\n`],
  ['le mode fixe',                 `${DECL}S -> !(slidefixed) C4\n`],
  ['la valeur, collée à une note', `${DECL}S -> C4(slide:101)\n`],
  ['la valeur, sur une règle',     `${DECL}S -> C4 D4 (slide:101)\n`],
  ['mode puis valeur, la forme du corpus', `${DECL}S -> !(slidecont) !(slide:0) C4 !(slide:701)\n`],
]) {
  const e = erreursDe(src);
  ok(e.length === 0, `1. ${quoi} doit compiler — refusé : ${String(e[0]?.message ?? '').slice(0, 100)}`);
}

// ─── 2. NON DÉCLARÉ — les quatre sont refusées ───────────────────────────────────────────────
// Sans ce volet, n'importe quel mot collé à `cont` deviendrait un paramètre, et une coquille
// créerait un paramètre fantôme EN SILENCE — la casse la plus chère, celle qui ne se voit pas.
for (const [quoi, src] of [
  ['la valeur',        `${TETE}S -> !(slide:101) C4\n`],
  ['le mode continu',  `${TETE}S -> !(slidecont) C4\n`],
  ['le mode paliers',  `${TETE}S -> !(slidestep) C4\n`],
  ['le mode fixe',     `${TETE}S -> !(slidefixed) C4\n`],
]) {
  ok(erreursDe(src).length > 0,
     `2. ${quoi} sur un paramètre NON déclaré doit être refusé — sinon une coquille crée un `
     + 'paramètre fantôme sans un signe');
}

// ─── 3. UN MODE QUI N'EXISTE PAS EST REFUSÉ, même sur un paramètre déclaré ───────────────────
for (const mot of ['slidewobble', 'slideramp', 'slidecontinu']) {
  ok(erreursDe(`${DECL}S -> !(${mot}) C4\n`).length > 0,
     `3. '${mot}' doit être refusé — les modes sont TROIS, et le collage ne rend pas légitime `
     + "n'importe quelle terminaison");
}

// ─── 4. L'ANCIENNE GRAPHIE EST RETIRÉE, pas dépréciée ────────────────────────────────────────
for (const [quoi, src] of [
  ['!(cont:slide)',       `${DECL}S -> !(cont:slide) C4\n`],
  ['!(fixed:slide)',      `${DECL}S -> !(fixed:slide) C4\n`],
  ['!(value:slide 101)',  `${DECL}S -> !(value:slide 101) C4\n`],
]) {
  ok(erreursDe(src).length > 0,
     `4. l'ancienne graphie ${quoi} doit être REFUSÉE — une graphie remplacée se supprime dans le `
     + 'même mouvement, jamais « au cas où »');
}

// ─── 5. LE COMPLÉMENT — les vingt-sept mots ne bougent pas ───────────────────────────────────
// Si la règle s'était élargie jusqu'à tout accepter, ce volet passerait aussi ; c'est le volet 2
// qui l'en empêche. Les deux ensemble disent la portée ET son complément.
for (const mot of ['velstep', 'velcont', 'volumefixed', 'pancont', 'transposestep']) {
  ok(erreursDe(`${TETE}S -> !(${mot}) C4\n`).length === 0,
     `5. '${mot}', un des vingt-sept mots des neuf paramètres, doit compiler SANS déclaration — `
     + "il vient d'une librairie, pas de la scène");
}

// ─── 6. INJECTION DANS LE JUGE — la décision rejouée isolée ──────────────────────────────────
const MODES = ['fixed', 'step', 'cont'];
const juger = (cle, declares) => MODES.some((m) => cle.endsWith(m) && declares.has(cle.slice(0, -m.length)));
const declares = new Set(['slide']);
ok(juger('slidecont', declares), '6. (mord) un mode collé à un paramètre déclaré est reconnu');
ok(!juger('slidewobble', declares), "6. (se tait) une terminaison qui n'est pas un mode ne l'est pas");
ok(!juger('autrecont', declares), '6. (se tait) un mode collé à un nom NON déclaré ne l\'est pas');
ok(!juger('cont', declares), "6. (se tait) le mode seul, sans paramètre devant, n'est pas une clé");

if (echecs.length) {
  console.error(`❌ paramètre nommé et mode collé : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ un paramètre nommé est la clé, son mode se colle — ${passe} vérification(s) passée(s)`);
}
