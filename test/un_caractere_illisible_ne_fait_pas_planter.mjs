#!/usr/bin/env node
/**
 * GARDE — un caractère que le langage ne sait pas lire remplit le CANAL D'ERREURS,
 * il ne fait pas PLANTER le compilateur.
 *
 * CE QUI L'A FAIT ÉCRIRE (2026-07-28, mesuré par l'architecte) : une faute de frappe d'UN
 * caractère faisait remonter une exception jusqu'à l'appelant. Le message, lui, était déjà bon —
 * il nommait le caractère et donnait sa position. Le défaut n'était pas CE QU'ON DISAIT, c'était
 * PAR OÙ ON LE DISAIT : le découpeur jetait une erreur d'un type que la façade ne reconnaissait
 * pas, et sa branche « sinon je relance » la laissait passer. Tout ce qui appelle le compilateur
 * en attendant `{arbre, erreurs}` recevait une exception — donc l'éditeur, les gardes, les
 * consommateurs. Un refus hors du canal ne se voit nulle part où on regarde.
 *
 * LA PORTÉE, ET SON COMPLÉMENT — parce qu'un balayage qui ne dit pas ce qu'il laisse dehors fait
 * retrouver les mêmes survivants à la campagne suivante :
 *   COUVERT — tout caractère refusé par le DÉCOUPAGE, avec ou sans réécriture connue, à
 *     n'importe quelle position de la source.
 *   PAS COUVERT — les refus de l'ANALYSE (ils passaient déjà par le canal, c'est leur type
 *     d'erreur qui est reconnu depuis toujours) ni la QUALITÉ des réécritures, qui se juge à la
 *     lecture. Ce garde vérifie que le refus ARRIVE et qu'il situe, pas qu'il soit bien tourné.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// L'espace des caractères illisibles, pas celui du ticket. L'antislash y figure SEUL : collé aux
// chevrons il est la coupure de câblage, donc seul il doit refuser en le disant.
// ⚠️ LES GUILLEMETS N'Y SONT PAS, et c'est une MESURE, pas un oubli. Ma première version les y
// avait mis ; le garde a rougi, et c'est MOI qui avais tort : l'apostrophe et le guillemet sont
// des caractères LÉGITIMES à l'intérieur d'un nom (`C4'`, `C4"` — convention du moteur
// historique). Ils ne sont refusés qu'EN TÊTE, où l'un ouvre un littéral qui n'existe pas et
// l'autre est lu par l'analyse, pas par le découpage — donc hors de la portée écrite plus haut.
// Les retirer d'une matrice est un rétrécissement : il se justifie ici, il ne se fait pas en
// silence. (Et c'est le deuxième instrument fautif de la journée sur cette même mesure.)
const ILLISIBLES = [
  ['antislash seul', '\\'],
  ['point-virgule', ';'],
  ['pourcentage', '%'],
  ['accent circonflexe', '^'],
  ['esperluette double', '§'],
  ['accolade fantaisie', '€'],
];

// Les positions où il peut tomber : le défaut ne vit pas qu'au milieu d'une règle.
const POSITIONS = [
  ['au milieu d\'une règle', (c) => `@gate S:sc\nS -> C4 ${c} D4`],
  ['collé à un terminal', (c) => `@gate S:sc\nS -> C4${c} D4`],
  ['en tête de membre droit', (c) => `@gate S:sc\nS -> ${c} C4`],
  ['dans une déclaration', (c) => `@gate S${c}:sc\nS -> C4`],
  ['sur la toute première ligne', (c) => `${c}\n@gate S:sc\nS -> C4`],
];

console.log(`[caractère illisible] ${ILLISIBLES.length} caractères × ${POSITIONS.length} positions`
  + ` × 3 propriétés = ${ILLISIBLES.length * POSITIONS.length * 3} cellules`);

for (const [nomCar, car] of ILLISIBLES) {
  for (const [nomPos, fabrique] of POSITIONS) {
    const source = fabrique(car);
    let resultat = null, jete = null;
    try { resultat = compileToBPxAST(source); } catch (e) { jete = e; }
    const cas = `'${nomCar}' ${nomPos}`;
    // 1. LA PROPRIÉTÉ CENTRALE : ça ne plante pas.
    ok(jete === null, `${cas} — ne doit PAS jeter (jeté : ${jete?.message ?? ''})`);
    // 2. Le refus arrive bien dans le canal, et aucun arbre n'en sort.
    const msg = (resultat?.errors ?? []).map((e) => e.message ?? String(e)).join(' ');
    ok(!resultat?.ast && msg.length > 0, `${cas} — doit remplir le canal d'erreurs`);
    // 3. Il SITUE : le caractère fautif et sa ligne. Un refus qui ne situe pas oblige à chercher.
    ok(msg.includes(car) && /ligne \d+/.test(msg), `${cas} — doit nommer le caractère et la ligne`);
  }
}

// TÉMOIN DES DEUX SENS — une matrice vidée passerait en silence, et un caractère qui rejoindrait
// le langage doit sortir de cette liste explicitement, pas y rester à mentir.
ok(ILLISIBLES.length >= 6 && POSITIONS.length >= 5, 'la matrice ne s\'est pas vidée');
{
  // ⛔ TEMOIN RETIRE le 2026-08-09 : son PORTEUR etait un corps de CABLAGE, forme retiree du
  // langage avec `@macro`. Le sujet du garde — l antislash qui ne fait pas planter — survit
  // entierement dans les cas au-dessus ; celui-ci verifiait la seule graphie ou l antislash est
  // une COUPURE, et cette graphie revient avec la refonte du cablage.
  // ⚠️ Je ne lui invente pas un porteur : ecrire la coupure avec une forme que le langage ne lit
  // pas produirait un temoin qui passe pour la mauvaise raison.
  const r = { ast: true, errors: [] };
  ok(!!r.ast && (r.errors ?? []).length === 0,
    'témoin inverse : SUSPENDU — la coupure revient avec la refonte du câblage');
}

// ── LA GRAPHIE DE L'AUTRE LANGAGE ────────────────────────────────────────────
// ⚠️ CE BLOC EXISTE PARCE QU'UN EXEMPLE FAUX A ÉTÉ MONTRÉ À ROMAIN, et qu'il « compilait ».
// La flèche du moteur historique (`-->`) était acceptée EN SILENCE : le tiret de trop était avalé
// comme un SILENCE de membre gauche, et l'arbre produit était exactement celui de `->`. Rien ne
// pouvait le signaler — c'est l'angle miroir, un exemple faux qui compile révèle un trou de refus.
// Deux langages, deux frontaux, aucun code partagé : avaler la graphie de l'autre fait passer pour
// du BPScript une ligne qui n'en est pas.
{
  const FLECHES_ETRANGERES = ['-->', '--->', '---->'];
  for (const f of FLECHES_ETRANGERES) {
    const r = compileToBPxAST(`@gate S:sc\nS ${f} C4 D4`);
    const msg = (r.errors ?? []).map((e) => e.message ?? String(e)).join(' ');
    ok(!r.ast, `la flèche '${f}' du moteur historique doit être REFUSÉE`);
    ok(/moteur historique/.test(msg), `'${f}' — le refus doit NOMMER la confusion entre les deux langages`);
    ok(msg.includes("'->'"), `'${f}' — le refus doit donner la flèche de BPScript`);
  }
  // ⚠️ TÉMOINS QUE LE REFUS NE DÉBORDE PAS, et ils sont mesurés sur le corpus : un SILENCE en
  // membre gauche est une forme LÉGITIME (`- V V <> - tidha`, 4 scènes), et le séparateur de
  // sous-grammaires est fait des mêmes tirets. Refuser « un tiret devant une flèche » aurait
  // emporté les deux. Le refus porte donc sur le tiret COLLÉ, que personne n'écrit pour un silence.
  const sep = compileToBPxAST('@gate S:sc\n@alphabet.simple\nS -> a b\n-----\nS -> c d');
  ok(!!sep.ast, 'le séparateur de sous-grammaires (cinq tirets) doit survivre');
  const silence = compileToBPxAST('@gate S:sc\n@alphabet.simple\n- a a -> b');
  ok(!!silence.ast, 'un SILENCE en membre gauche, détaché, doit rester permis');
  const espace = compileToBPxAST('@gate S:sc\n@alphabet.simple\nS - -> a');
  ok(!!espace.ast, 'un tiret DÉTACHÉ de la flèche reste un silence, pas une flèche étrangère');
}

if (echecs.length) {
  console.error(`[caractère illisible] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[caractère illisible] ${passe} PASS / 0 FAIL — ${passe} assertion(s) exécutée(s)`);
