#!/usr/bin/env node
/**
 * GARDE — un drapeau CRÉE un nom, et il ne peut pas prendre celui d'une autre sorte.
 *
 * CE QUI PASSAIT, ET C'EST LA SEULE PORTE QUI RESTAIT OUVERTE. `S -> C4 [velcont]` compilait :
 * `velcont` est un RÉGLAGE du vocabulaire, et le sac de drapeaux en faisait un drapeau sans un
 * mot. `@var`, `@alias`, `@actor`, `@def` et les objets CV sont contrôlés depuis longtemps ; le
 * sac de drapeaux acceptait TOUT NOM, quelle que soit la sorte à laquelle il appartenait déjà.
 * La casse était muette : le réglage devenait inatteignable sous ce nom, sans une erreur.
 *
 * LA RÈGLE EST CELLE DE LA BIBLE, appliquée à une sorte qui y échappait — les noms de toutes les
 * sortes vivent dans le même espace, chacun n'appartient qu'à une seule, et le contrôle a lieu à
 * la déclaration. Un drapeau se déclare par `@var … flag` OU par sa première mutation : les deux
 * créent le nom, donc les deux se contrôlent.
 *
 * CE QUE LE GARDE MESURE, EN MATRICE SUR LES DEUX AXES — la sorte volée × la position du sac :
 *   1. un drapeau qui reprend un nom de RÉGLAGE est refusé, dans le sac de fin de règle comme
 *      dans la garde qui précède le membre gauche, et sous ses trois formes d'écriture ;
 *   2. les formes légitimes restent ACCEPTÉES — c'est le complément, sans quoi le garde décrirait
 *      un langage plus étroit que le vrai : un nom neuf, un nom nu (forme vivante, vingt usages
 *      dans le corpus), un drapeau déclaré par `@var`, et le même drapeau muté dans dix règles ;
 *   3. les deux autres sortes — un TERMINAL de l'alphabet actif, une TÊTE DE RÈGLE — sont refusées
 *      elles aussi : « un drapeau ne porte qu'un nom de drapeau » (Romain, 2026-08-12).
 *
 * INJECTION dans l'ACCUSÉ (le vocabulaire réel, un réglage pris comme drapeau) et dans le JUGE
 * (la comparaison de sortes rejouée isolée).
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { universeControlNames } from '../src/transpiler/libs.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = '@core\n@alphabet.western:midi\n\n';
const erreursDe = (src) => (compileToBPxAST(src).errors ?? []);
const refusDeDrapeau = (src) => erreursDe(src).filter((e) => /le drapeau '/.test(String(e.message)));

// ─── 0. Témoin anti-rétrécissement ───────────────────────────────────────────────────────────
const controles = [...universeControlNames()];
ok(controles.length >= 75, `0. l'univers doit porter au moins 75 réglages (reçu ${controles.length})`);

// ─── 1. LA MATRICE — sorte volée × position × forme d'écriture ───────────────────────────────
// Trois réglages pris dans TROIS librairies différentes, pour qu'aucune ne soit le seul témoin.
const VOLES = ['velcont', 'vel', 'transpose'].filter((n) => controles.includes(n));
ok(VOLES.length === 3, `1. les trois réglages témoins doivent exister (trouvés ${VOLES.join(', ')})`);
for (const n of VOLES) {
  const positions = [
    ['en fin de règle, muté', `${TETE}S -> C4 [${n}=1]\n`],
    ['en fin de règle, incrémenté', `${TETE}S -> C4 [${n}+1]\n`],
    ['en fin de règle, nom nu', `${TETE}S -> C4 [${n}]\n`],
    ['en garde devant le membre gauche', `${TETE}[${n}] S -> C4\nS -> D4\n`],
    ['en garde, comparé', `${TETE}[${n}==1] S -> C4\nS -> D4\n`],
    ['mêlé à un drapeau légitime', `${TETE}S -> C4 [stage=1, ${n}=2]\n`],
  ];
  for (const [ou, src] of positions) {
    ok(refusDeDrapeau(src).length > 0,
       `1. '${n}' est un réglage : le refuser comme drapeau ${ou} — accepté en silence`);
  }
}

// ─── 2. LE COMPLÉMENT — les formes légitimes ne bougent pas ──────────────────────────────────
const LEGITIMES = [
  ['un nom neuf, muté', `${TETE}S -> C4 [zz_drapeau_neuf=1]\n`],
  ['un nom neuf, nu (forme vivante du corpus)', `${TETE}S -> C4 [zz_drapeau_neuf]\n`],
  ['plusieurs mutations dans un sac', `${TETE}S -> C4 [stage=1, count=4]\n`],
  ['une garde devant le membre gauche', `${TETE}[Ideas] S -> C4\nS -> D4\n`],
  ['un drapeau déclaré par @var, puis muté', `${TETE}@var section flag: calm:1, full:2\n\nS -> C4 [section=1]\n`],
  ['le MÊME drapeau muté dans deux règles', `${TETE}S -> C4 [count-1]\nS -> D4 [count-1]\n`],
];
for (const [quoi, src] of LEGITIMES) {
  const e = erreursDe(src);
  ok(e.length === 0, `2. ${quoi} doit rester ACCEPTÉ — refusé : ${String(e[0]?.message ?? e[0]).slice(0, 110)}`);
}

// ─── 3. LES DEUX AUTRES SORTES — terminal et tête de règle ───────────────────────────────────
// « Un drapeau doit porter uniquement un nom de drapeau ; un drapeau qui porte le nom de n'importe
// quoi d'autre devrait générer une erreur » (Romain, 2026-08-12). Le TERMINAL avait d'abord été
// laissé passer — l'ambiguïté paraissait douteuse puisque les crochets disent déjà qu'on parle
// d'un drapeau. Romain a tranché l'inverse : la sorte se décide au NOM, pas au signe qui l'entoure.
for (const [sorte, src] of [
  ['un TERMINAL, muté', `${TETE}S -> C4 [C4=1]\n`],
  ['un TERMINAL, nom nu', `${TETE}S -> C4 [C4]\n`],
  ['un TERMINAL, en garde', `${TETE}[C4] S -> D4\nS -> E4\n`],
  ['une TÊTE DE RÈGLE, mutée', `${TETE}S -> Motif [Motif=1]\nMotif -> C4\n`],
  ['une TÊTE DE RÈGLE, nom nu', `${TETE}S -> Motif [Motif]\nMotif -> C4\n`],
]) {
  ok(refusDeDrapeau(src).length > 0, `3. un drapeau qui reprend ${sorte} doit être refusé`);
}

// ─── 4. INJECTION DANS LE JUGE — la comparaison de sortes, rejouée isolée ────────────────────
const juger = (nom, sortesPrises) => sortesPrises.get(nom) ?? null;
const prises = new Map([['vel', 'un réglage'], ['section', 'un drapeau']]);
ok(juger('vel', prises) === 'un réglage', '4. (mord) le juge doit voir la sorte déjà prise');
ok(juger('section', prises) === 'un drapeau', '4. (se tait) un drapeau qui reste un drapeau n\'est pas un vol');
ok(juger('zz_neuf', prises) === null, '4. (se tait) un nom neuf n\'appartient à personne');

if (echecs.length) {
  console.error(`❌ drapeau qui confisque un nom : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ un drapeau ne prend le nom d'aucune autre sorte — ${passe} vérification(s) passée(s)`);
}
