#!/usr/bin/env node
/**
 * LE SAC DE RÉGLAGES SE LIT PAREIL DANS TOUTES SES POSITIONS.
 *
 * ⚠️ CE QUE CE GARDE FERME, ET LA CAUSE EXACTE (mesurée le 2026-08-07).
 * `LANGUAGE.md` décrit le sac de réglages une fois, et dit explicitement que ses signes « se
 * comportent à l'identique dans les deux sacs et à toute profondeur — rien de ce qui est écrit ici
 * ne cache une exception plus loin ». Le parser, lui, en avait TROIS lectures : un reconnaisseur
 * pour le sac COLLÉ, un pour le SUFFIXE de règle, un pour le marqueur de FLUX. Chacun était une
 * approximation partielle du lecteur, et chacun connaissait un sous-ensemble DIFFÉRENT des formes.
 *
 * Le produit croisé 11 formes × 4 positions donnait 13 cellules rouges — le port d'une instance
 * passait collé et échouait en suffixe, le sujet de portée passait en suffixe et échouait dans le
 * flux, l'étoile du sujet se faisait happer par l'opérateur de vitesse. Aucune de ces cellules
 * n'aurait jamais rougi : chaque position avait ses propres essais, et chacun testait la forme
 * qu'il savait déjà lire.
 *
 * ⚠️ ET C'EST LA FAUTE INSCRITE DANS `CLAUDE.md`, REPAYÉE : « une garde se construit en MATRICE,
 * pas en liste ». Le commentaire du contrôleur numéroté (`cc.98:45`) portait déjà, mot pour mot,
 * l'avertissement « les deux régimes doivent l'accepter, sinon on n'aurait déplacé le trou » —
 * écrit, connu, et insuffisant, parce qu'il demandait d'y penser au bon moment. D'où ce garde :
 * ajouter une FORME la teste dans toutes les positions, ajouter une POSITION la teste sur toutes
 * les formes. Plus rien à penser.
 *
 * LES QUATRE VOLETS :
 *   A. MATRICE — chaque forme compile dans chaque position ;
 *   B. MÊMES PAIRES — la même écriture rend le même contenu de sac partout, pas seulement
 *      « ça passe » : un reconnaisseur réparé au-dessus d'un lecteur qui abîme resterait vert ;
 *   C. TÉMOIN QUI MORD — un sac MAL FORMÉ reste refusé dans les quatre positions. Sans lui, un
 *      reconnaisseur devenu « accepte tout » passerait les volets A et B en triomphe ;
 *   D. SOCLE — la matrice ne peut pas se vider en silence.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ⛔ LE SOCLE DÉCLARAIT UNE INSTANCE DE MODULE, et il ne le peut plus : `mod` est archivé le
// 2026-08-23 et `adsr env1` ne compile plus. Les trois formes de PORT D'INSTANCE de la matrice
// (`(env1.attack:400)` et ses cinq combinaisons) sont parties avec lui — elles éprouvaient une
// graphie du langage, pas une position du sac. Ce que ce garde tient reste entier : le sac se lit
// PAREIL dans toutes ses positions, et c'est sur les clés valuées qu'il se mesure.
const P = 'core\nalphabet.western:midi\n-----\n';

// ── LES FORMES — la grammaire d'un élément de sac, énumérée ────────────────────────────────────
// élément ::= sujet? clé ('.' composant)? (':' valeur)?  — cf. `sacBienForme()` dans parser.js.
// Chaque ligne couvre une construction, PAS une graphie de ticket : la clé nue et la clé valuée,
// le composant appelé par le point sous ses deux formes (numéro et port nommé), les trois sujets
// du tableau des portées, et les COMPOSITIONS — c'est un mélange qui a révélé que seule la
// POSITION du premier élément décidait.
const FORMES = [
  ['clé valuée',            '(vel:80)'],
  ['clé nue',               '(velcont)'],
  ['contrôleur numéroté',   '(cc.98:45)'],
  ['sujet étoile + clé',    '(*:vel:80)'],
  ['sujet terminal + clé',  '(C4:vel:80)'],
];

// ── LES POSITIONS — les quatre endroits du langage où un sac peut vivre ────────────────────────
// Elles ne sont pas interchangeables pour le SENS (la portée diffère : la règle, le groupe,
// l'élément, l'instant) — elles le sont pour la LECTURE, et c'est ce qui est mesuré ici.
const POSITIONS = [
  ['suffixe de règle',  (s) => `S -> C4 D4 ${s}`],
  ['collé au groupe',   (s) => `S -> {C4 D4}${s}`],
  ['collé au terminal', (s) => `S -> C4${s} D4`],
  ['dans le flux !()',  (s) => `S -> C4 !${s} D4`],
];

const compiler = (source) => {
  try { return compileToBPxAST(P + source + '\n'); }
  catch (e) { return { errors: [{ message: e.message }] }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message || e).join(' | ');

/** Les paires du premier sac de l'arbre, sans les repères de position (ligne/colonne). */
function pairesDuSac(noeud, vus = new WeakSet()) {
  if (!noeud || typeof noeud !== 'object' || vus.has(noeud)) return null;
  vus.add(noeud);
  if (Array.isArray(noeud)) {
    for (const x of noeud) { const t = pairesDuSac(x, vus); if (t) return t; }
    return null;
  }
  if (Array.isArray(noeud.pairs)) {
    return JSON.stringify(noeud.pairs.map(({ line, col, ...reste }) => reste));
  }
  for (const v of Object.values(noeud)) { const t = pairesDuSac(v, vus); if (t) return t; }
  return null;
}

// ── A. MATRICE — chaque forme, dans chaque position ────────────────────────────────────────────
let cellules = 0;
for (const [nomForme, sac] of FORMES) {
  for (const [nomPos, ecrire] of POSITIONS) {
    cellules++;
    const msg = messages(compiler(ecrire(sac)));
    ok(msg === '',
       `A. ${nomForme} '${sac}' est REFUSÉ en position « ${nomPos} » : ${msg.replace(/\s+/g, ' ').slice(0, 100)}. `
       + `La bible décrit le sac une fois pour toutes ses positions — une forme lue à un endroit et `
       + `refusée à un autre EST l'exception cachée qu'elle dit ne pas avoir.`);
  }
}

// ── B. MÊMES PAIRES — le contenu du sac ne dépend pas de l'endroit où il est écrit ─────────────
// ⚠️ SANS CE VOLET, LE GARDE GARDERAIT L'ACCUSÉ ET PAS LE JUGE. Le volet A ne mesure que « ça
// passe » : un reconnaisseur réparé au-dessus d'un lecteur qui perd le sujet, ou qui range le port
// dans la clé, resterait vert de bout en bout. Ce volet compare ce qui SORT.
for (const [nomForme, sac] of FORMES) {
  const rendus = new Map();
  for (const [nomPos, ecrire] of POSITIONS) {
    const r = compiler(ecrire(sac));
    if ((r.errors || []).length) continue;   // le volet A l'a déjà signalé
    rendus.set(nomPos, pairesDuSac(r.ast));
  }
  const distincts = new Set(rendus.values());
  ok(distincts.size <= 1,
     `B. ${nomForme} '${sac}' rend des paires DIFFÉRENTES selon la position : `
     + [...rendus].map(([p, v]) => `${p} → ${v}`).join(' ; ').slice(0, 220)
     + `. Le sac est lu partout, mais pas lu PAREIL — c'est le trou d'après.`);
}

// ── B-témoin. LE JUGE DOIT DISCRIMINER, pas seulement rendre « pareil » ────────────────────────
// ⚠️ INJECTION FAITE DANS LE JUGE, PAS SEULEMENT DANS L'ACCUSÉ (`CLAUDE.md`, 2026-07-28 : « un
// garde qui ne teste que des cas qui réussissent garde l'accusé, pas le juge »). Mesuré : rendre
// `pairesDuSac` CONSTANT laisse le volet B entièrement VERT — toutes les positions rendent alors
// la même chose, forcément. Le volet B ne peut donc pas se prouver lui-même ; il lui faut des
// paires que le juge DOIT distinguer. Chaque couple ci-dessous ne diffère que par un point, et
// c'est précisément le point qu'un juge appauvri laisserait tomber.
const DOIVENT_DIFFERER = [
  ['la valeur',      '(vel:80)',              '(vel:90)'],
  ['le sujet',       '(*:vel:80)',            '(C4:vel:80)'],
  ['le sujet absent', '(vel:80)',             '(*:vel:80)'],
  ['la clé',         '(vel:80)',              '(velcont)'],
];
for (const [quoi, a, b] of DOIVENT_DIFFERER) {
  const ecrire = POSITIONS[0][1];
  const pa = pairesDuSac(compiler(ecrire(a)).ast);
  const pb = pairesDuSac(compiler(ecrire(b)).ast);
  ok(pa !== null && pb !== null && pa !== pb,
     `B-témoin. '${a}' et '${b}' ne diffèrent que par ${quoi}, et le juge les rend IDENTIQUES `
     + `(${pa} vs ${pb}) — il ne lit plus ce champ. Le volet B au-dessus ne prouve alors plus rien : `
     + `un juge aveugle trouve tout pareil.`);
}

// ── C. TÉMOIN QUI MORD — un sac mal formé reste refusé, dans les quatre positions ──────────────
// ⚠️ LE TÉMOIN DOIT PROUVER LES DEUX SENS. Les volets A et B ne disent que « ça passe » : un
// reconnaisseur devenu permissif — qui prendrait pour un sac toute parenthèse — les passerait tous
// les deux. Ces huit formes cassent la grammaire de l'élément en un point chacune (valeur absente,
// clé absente, parenthèse non fermée, sujet vide, deux-points doublé, point sans composant, point
// sans clé, nombre en place de clé) et doivent rester REFUSÉES partout.
const MAL_FORMES = [
  ['valeur absente',        '(vel:)'],
  ['clé absente',           '(:80)'],
  ['parenthèse non fermée', '(vel:80'],
  ['sujet vide',            '(*:)'],
  ['deux-points doublé',    '(vel::80)'],
  ['point sans clé',        '(.attack:400)'],
  ['nombre en place de clé', '(80:vel)'],
];
let cellulesTemoin = 0;
for (const [pourquoi, sac] of MAL_FORMES) {
  for (const [nomPos, ecrire] of POSITIONS) {
    cellulesTemoin++;
    ok(messages(compiler(ecrire(sac))) !== '',
       `C-témoin. '${sac}' (${pourquoi}) est ACCEPTÉ en position « ${nomPos} » — le reconnaisseur `
       + `du sac ne reconnaît plus une forme, il happe toute parenthèse. Un garde dont toutes les `
       + `cellules réussissent ne garde plus rien.`);
  }
}

// ── D. SOCLE — la matrice ne se vide pas en silence ───────────────────────────────────────────
// ⚠️ LE PLANCHER SUIT LE RETRAIT, ET IL DIT POURQUOI. Il valait 40 — dix formes × quatre positions.
// Cinq formes portaient un PORT D'INSTANCE (`env1.attack`) et sont sorties avec le catalogue `mod`,
// archivé le 2026-08-23. Un plancher qu'on baisse sans sa cause ne se distingue pas d'un plancher
// qu'on desserre pour faire passer un test : celui-ci nomme la forme partie et la décision.
ok(cellules === FORMES.length * POSITIONS.length && cellules >= 20,
   `D. SOCLE : la matrice doit être PLEINE — ${cellules} cellule(s) pour ${FORMES.length} forme(s) `
   + `× ${POSITIONS.length} position(s).`);
ok(cellulesTemoin === MAL_FORMES.length * POSITIONS.length && cellulesTemoin >= 24,
   `D. SOCLE : le témoin doit être PLEIN — ${cellulesTemoin} cellule(s) pour ${MAL_FORMES.length} `
   + `forme(s) mal formée(s) × ${POSITIONS.length} position(s).`);

if (echecs.length) {
  console.error(`❌ le sac ne se lit pas pareil partout : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ le sac se lit pareil dans toutes ses positions — ${passe} vérification(s) : `
          + `${cellules} cellules ${FORMES.length} formes × ${POSITIONS.length} positions, toutes `
          + `lues et rendant les MÊMES paires, et ${cellulesTemoin} cellules de témoin où un sac `
          + `mal formé reste refusé.`);
