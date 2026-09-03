#!/usr/bin/env node
/**
 * GARDE — UN REFUS SE VOIT DANS `errors`, TOUJOURS, ET LE CONTRAT LE DIT.
 *
 * Décision Romain du 2026-08-19 : « un compilateur qui refuse ne livre rien en aval ; ce qui
 * établit le succès est l'ABSENCE D'ERREUR, jamais la présence d'un arbre. »
 *
 * ⚠️ CE QUI L'A MOTIVÉE, mesuré ici : un refus de SYNTAXE rend `ast` nul, un refus de SENS et un
 * refus de MOT INCONNU rendent un arbre COMPLET. Un consommateur qui décide sur la présence de
 * l'arbre conclut « pas de refus » sur DEUX refus sur trois — et travaille sur un arbre mutilé en
 * croyant travailler sur une scène valide.
 *
 * ⛔ CE QUE CE GARDE TIENT, ET CE QU'IL NE TIENT PAS. Il n'exige PAS que l'arbre soit nul sur un
 * refus : ce serait figer un comportement que la décision ne tranche pas. Il tient l'INVARIANT
 * qu'elle établit — un refus se voit dans `errors`, quelle que soit sa nature — et il exige que le
 * CONTRAT le dise, à la façade et dans la spec dérivée. Une règle qu'un consommateur doit suivre
 * et qui n'est écrite nulle part n'est pas une règle, c'est un usage.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const T = 'core\nalphabet.western\n';
const compile = (src) => {
  try { const r = compileToBPxAST(src); return { e: (r.errors || []).length, ast: r.ast }; }
  catch (x) { return { e: 0, ast: undefined, jete: String(x.message) }; }
};

// ── 1. L'INVARIANT — chaque nature de refus se voit dans `errors` ────────────────────────────
// La matrice est la NATURE du refus, parce que c'est elle qui décidait de la présence de l'arbre.
const REFUS = [
  ['syntaxe',            `${T}-----\nS --> C4\n`],
  ['sens',               `${T}-----\nS -> C4 <!depart D4\n`],
  ['mot inconnu',        `${T}zorglubinvente\n-----\nS -> C4\n`],
  ['mot retiré',         `${T}mm:60\n-----\nS -> C4\n`],
  ['terminal absent',    `${T}-----\nS -> zz\n`],
  ['canal fermé',        `${T}a:text\n-----\nS -> a\n`],
  ['position',           `${T}-----\nS -> C4\nalphabet.western\n-----\nT -> D4\n`],
  ['vocabulaire',        `${T}-----\nS -> C4(zorglubattribut:1)\n`],
];
console.log(`[arbre après succès] ${REFUS.length} natures de refus`);
for (const [quoi, src] of REFUS) {
  const r = compile(src);
  ok(!r.jete,
    `1. un refus de ${quoi} doit remplir le canal d'erreurs, PAS jeter — un jet traverse la façade `
    + `et devient un plantage chez le consommateur(reçu : ${r.jete})`);
  ok(r.e >= 1,
    `1. un refus de ${quoi} doit poser au moins UNE erreur — sans elle, le seul signe du refus `
    + `serait l'absence d'arbre, et la décision du 2026-08-19 interdit d'en décider ainsi`);
}

// ── 2. LE COMPLÉMENT — une scène valide ne pose aucune erreur ───────────────────────────────
// Sans lui, un compilateur qui poserait une erreur sur tout aurait exactement la même tête.
{
  const r = compile(`${T}-----\nS -> C4 D4\n`);
  ok(r.e === 0, `2. TÉMOIN — une scène valide ne pose AUCUNE erreur (reçu ${r.e})`);
  ok(r.ast && typeof r.ast === 'object', '2. TÉMOIN — et elle rend un arbre');
}

// ── 3. LE CONTRAT LE DIT, AUX DEUX PLACES QUE LES CONSOMMATEURS LISENT ──────────────────────
// ⛔ La façade est ce qu'ils importent ; la spec dérivée est ce qu'ils lisent. Une règle écrite à
// une seule des deux places laisse l'autre enseigner l'ancien usage.
for (const [fichier, quoi] of [
  ['src/transpiler/index.js', 'la façade que les consommateurs importent'],
  ['docs/spec/AST.md',        'la spec dérivée qu\'ils lisent'],
]) {
  const texte = readFileSync(join(RACINE, fichier), 'utf8');
  ok(/erreurs nulles/i.test(texte),
    `3. ${fichier} — ${quoi} doit porter la clause « l'arbre n'a de sens qu'à erreurs nulles » `
    + `(décision Romain 2026-08-19)`);
  ok(/absence d'erreur/i.test(texte),
    `3. ${fichier} — et dire que le succès s'établit par l'ABSENCE D'ERREUR, jamais par la présence `
    + `d'un arbre. C'est cette moitié-là qui manquait, et c'est elle qui trompe.`);
}

if (echecs.length) {
  console.error(`[arbre après succès] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[arbre après succès] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
