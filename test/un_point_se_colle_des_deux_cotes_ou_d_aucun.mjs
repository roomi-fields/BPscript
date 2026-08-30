#!/usr/bin/env node
/**
 * GARDE — UN POINT SE COLLE DES DEUX CÔTÉS, OU D'AUCUN.
 *
 * Décision de Romain, 2026-08-30 :
 * `hub/decisions/2026-08-30-un-signe-qualifiant-separe-par-un-espace-est-refuse.md`
 * — *« espace après le point est à mon sens une erreur et ne devrait pas compiler »*.
 *
 * ⛔ LE SIGNE PORTE DEUX RÔLES, ET C'EST LE COLLAGE QUI LES SÉPARE. `docs/spec/LANGUAGE.md:1893`
 * l'écrit dans la table du collage, à côté de `(x)` collé contre `(x)` séparé et de `C4!(…)` contre
 * `C4 !(…)` :
 *
 *     `alphabet.western`      COLLÉ des deux côtés    il QUALIFIE
 *     `C4 D4 . E4 F4 G4`      DÉTACHÉ des deux côtés  il SÉPARE — frontière entre fragments de
 *                                                     durée égale, un élément du langage
 *     `A4. D5` · `A4 .D5`     À CHEVAL                ni l'un ni l'autre ⇒ REFUSÉ
 *
 * ⚠️ CE QUE ROMAIN A CORRIGÉ, ET QUI A FAILLI COÛTER CENT NEUF SITES : la décision, prise à la
 * lettre, refusait « tout espace autour du point ». Le point DÉTACHÉ DES DEUX CÔTÉS n'est pas un
 * qualifiant mal écrit — c'est un autre signe, et il vit dans le corpus historique de Bernard
 * (`Visser3`, `Visser5`, `vina3`, `simpletemplates`, `doeslittle`). La mesure des QUATRE régimes est
 * ce qui l'a évité ; une lecture à deux régimes les cassait tous.
 *
 * ⛔ ET C'EST UN SEUL MÉCANISME, AU LEXEUR. La règle vaut PARTOUT où le signe apparaît, à toutes les
 * profondeurs — d'où la matrice ci-dessous, qui éprouve la partie déclarative ET le flux. Écrite
 * dans le parseur, elle aurait dû être répétée aux quinze places qui lisent un point.
 *
 * ⚠️ ELLE VIVAIT DÉJÀ, POUR UNE PLACE SEULE : le point d'attente la portait depuis le 2026-07-27
 * (`parser.js`, « COLLÉ des deux côtés c'est une ADRESSE, ESPACÉ des deux côtés c'est un
 * DÉCOUPAGE »). Cette branche est partie avec la généralisation : deux mécanismes pour un seul
 * fait, et la profondeur choisissait lequel.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compileToBPxAST } = require('../src/transpiler/index.js');

let ok = 0;
const echecs = [];
const verifier = (cond, quoi) => { if (cond) ok += 1; else echecs.push(quoi); };

const msgs = (src) => {
  try { return (compileToBPxAST(src).errors || []).map((e) => e.message || String(e)); }
  catch (e) { return [`JETÉ: ${e.message}`]; }
};

const A = 'core\nalphabet.western\n';
const T = 'core\nalphabet.western:midi\n';
const ENTREES = 'core\nalphabet.western\nin.midi brut\n';

// ── 1. LA MATRICE — chaque PLACE du point, dans les QUATRE régimes ────────────────────────────
// ⛔ Une matrice, pas une liste : une règle qui vaudrait en tête de scène et pas au fond d'un sac
// ne serait pas une règle. `@` marque l'endroit où le point se pose.
const PLACES = [
  ["invocation d'alphabet",             `core\nalphabet@western\n-----\nS -> C4`],
  ['invocation de tuning',              `${A}tuning@western_just\n-----\nS -> C4`],
  ["invocation d'octaves",              `${A}octaves@western\n-----\nS -> C4`],
  ["invocation d'homomorphisme",        `${A}homomorphism@checkhomo\n-----\nS -> C4`],
  ['clé de terminal entre parenthèses', `${T}terminal cloche (tuning@western_just)\n-----\nS -> C4`],
  ['clé de terminal nue',               `${T}terminal cloche tuning@western_just\n-----\nS -> C4`],
  ['clé de def nue',                    `${T}def cloche tuning@western_just\n-----\nS -> C4`],
  ['clé de def en bloc indenté',        `${T}def cloche\n  tuning@western_just\n-----\nS -> C4`],
  ['canal de sortie sur un terminal',   `${T}terminal cloche (out@midi)\n-----\nS -> C4`],
  ["clé d'acteur",                      `${A}actor sitar (out@midi)\n-----\nS -> C4`],
  ["section d'homomorphisme",           `${A}homomorphism.checkhomo\n-----\nS -> $N1 checkhomo@TR &N1`],
  ['objet sonore vu par un acteur',     `${A}actor sitar (out.midi)\n-----\nS -> sitar@C4`],
  ["adresse d'un point d'attente",      `${ENTREES}-----\nS -> C4 <!brut@60 D4`],
  ["entrée et son canal",               `${A}in@midi touches\n-----\nS -> C4`],
];
const A_CHEVAL = [['collé à gauche seulement', '. '], ['collé à droite seulement', ' .']];

let casesEprouvees = 0;
for (const [nom, gabarit] of PLACES) {
  // Le régime COLLÉ est le témoin qui donne sa valeur aux deux autres : sans lui, un gabarit
  // fautif rendrait « refusé » partout et la matrice serait verte sans rien prouver.
  verifier(msgs(gabarit.replace('@', '.')).length === 0,
    `1. TÉMOIN — « ${nom} » COLLÉ des deux côtés doit PASSER, sinon cette ligne ne mesure rien`);
  casesEprouvees += 1;
  for (const [regime, signe] of A_CHEVAL) {
    const e = msgs(gabarit.replace('@', signe));
    casesEprouvees += 1;
    verifier(e.length > 0, `1. « ${nom} », ${regime} : doit être REFUSÉ`);
    verifier(e.some((m) => /le point est/.test(m)),
      `1. « ${nom} », ${regime} : le refus doit parler du POINT, pas retomber sur un message `
      + `étranger à la règle — reçu : ${(e[0] || '').slice(0, 90)}`);
  }
}
// ⛔ UN GARDE COMPTE CE QU'IL A EXAMINÉ ET REFUSE D'AVOIR EXAMINÉ ZÉRO.
verifier(casesEprouvees === PLACES.length * 3,
  `1. les ${PLACES.length * 3} cases de la matrice ont été éprouvées (${casesEprouvees})`);

// ── 2. LE DÉTACHÉ DES DEUX CÔTÉS VIT — c'est un signe, pas une faute ──────────────────────────
// ⛔ SANS CE VOLET, LA RÈGLE SE FERMERAIT SUR 109 SITES DU CORPUS. `LANGUAGE.md:1893`.
for (const [quoi, src] of [
  ['la frontière de la bible',     `${A}-----\nS -> C4 D4 . E4 F4 G4`],
  ['deux frontières de suite',     `${A}-----\nS -> C3 . C4 . D4 C4`],
  ['en fin de ligne',              `${A}-----\nM10 -> C4 - .`],
  ['dans une polymétrie',          `${A}mode:rnd\n-----\nA -> {A4 . D5 B5}`],
  ["avant l'adresse d'une attente", `${ENTREES}-----\nS -> C4 <!brut . 60 D4`],
]) {
  verifier(msgs(src).length === 0,
    `2. ${quoi} : le point DÉTACHÉ des deux côtés doit PASSER — reçu : ${(msgs(src)[0] || '').slice(0, 100)}`);
}
// Et il produit bien un ÉLÉMENT, jamais un qualifiant silencieux.
{
  const r = compileToBPxAST(`${A}-----\nS -> C4 D4 . E4`);
  const types = (r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || []).map((e) => e.type);
  verifier(types.includes('Period'),
    `2. et la frontière ARRIVE dans l'arbre comme un élément — reçu : ${JSON.stringify(types)}`);
}

// ── 3. LE LEXEUR NE VOIT QUE LE POINT DU LANGAGE ──────────────────────────────────────────────
// ⛔ FABRIQUÉ, JAMAIS SUPPOSÉ. Une règle posée au lexeur casserait tout code externe, tout nombre
// et toute chaîne si l'un d'eux produisait un jeton point. Les six cas sont éprouvés, pas déduits.
for (const [quoi, src] of [
  ['un nombre décimal',                    `${A}-----\nS -> C4:0.5`],
  ['le repos indéterminé',                 `${A}-----\nS -> C4 ... D4`],
  ['un accent grave sur une ligne',        `${A}-----\nS -> \`js: n("c2").sound("sq").release(.1)\` C4`],
  ['un accent grave sur PLUSIEURS lignes', `${A}-----\nS -> \`js: saw(p)\n  .lpf(400)\n  .adsr(0.1)\` C4`],
  ['une chaîne',                           `${A}def d (description:"une phrase. Et une autre.")\n-----\nS -> C4`],
  ['un commentaire',                       `${A}// une phrase. Et une autre.\n-----\nS -> C4`],
]) {
  verifier(msgs(src).length === 0,
    `3. ${quoi} ne porte AUCUN point du langage — reçu : ${(msgs(src)[0] || '').slice(0, 100)}`);
}

// ── 4. LE REFUS DIT QUOI ÉCRIRE, ET IL DISTINGUE LE CAS SANS NOM ──────────────────────────────
// Un refus qui constate sans donner la réécriture laisse l'auteur deviner ; et proposer
// « `voice.` » comme forme correcte serait proposer une forme qui ne qualifie rien.
{
  const m = msgs(`${A}-----\nS -> A4. D5`).join(' | ');
  verifier(/A4\.D5/.test(m), `4. le refus DONNE la forme collée — reçu : ${m.slice(0, 110)}`);
  verifier(/A4 \. D5/.test(m), `4. et la forme détachée — reçu : ${m.slice(0, 110)}`);
}
{
  const m = msgs(`${T}def ka  voice.\n-----\nS -> C4`).join(' | ');
  verifier(/nom attendu après/.test(m),
    `4. un point que RIEN ne suit : le refus dit ce qui MANQUE — reçu : ${m.slice(0, 110)}`);
  verifier(!/'voice\.'\s*\)/.test(m),
    `4. et il ne propose PAS « voice. » comme réécriture — reçu : ${m.slice(0, 110)}`);
}

// ── 5. LA POSITION EST DITE — sans elle, un refus dans une grande scène est une chasse ────────
{
  // ⚠️ LA LIGNE ATTENDUE SE CALCULE, elle ne s'écrit pas en dur : un numéro recopié est faux au
  // premier caractère ajouté au préambule, et le garde rougirait sur sa propre arithmétique.
  const source = `${A}-----\nS -> C4\nT -> D4\nU -> A4. D5`;
  const attendue = source.split('\n').findIndex((l) => l.includes('A4. D5')) + 1;
  const m = msgs(source).join(' | ');
  verifier(new RegExp(`[Ll]igne ${attendue}\\b`).test(m),
    `5. le refus dit la LIGNE (${attendue}) — reçu : ${m.slice(0, 130)}`);
  verifier(/colonne \d+/.test(m), `5. et la COLONNE — reçu : ${m.slice(0, 130)}`);
}

// ── 6. TÉMOIN D'INSTRUMENT — un compilateur devenu permissif rendrait tout ce qui précède vert ─
verifier(msgs(`${A}-----\nS -> zzzz`).length > 0,
  '6. TÉMOIN — le compilateur refuse encore un terminal inconnu : la matrice ci-dessus mesure');
verifier(PLACES.length >= 14, `6. la matrice ne s'est pas vidée — ${PLACES.length} places`);

if (echecs.length) {
  console.error(`❌ un point se colle des deux côtés : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`un point se colle des deux côtés ou d'aucun : ${ok} PASS / 0 FAIL — ${ok} assertion(s)`);
