#!/usr/bin/env node
/**
 * UN AUTEUR REÇOIT TOUTES SES FAUTES — LE CANAL DE REFUS EST UNIQUE.
 *
 * Décision de Romain, 2026-08-24 : le compilateur a quatre étages et UN SEUL canal de refus
 * (`decisions/2026-08-24-le-compilateur-a-quatre-etages-et-un-seul-canal-de-refus.md`). Un auteur
 * reçoit toutes ses fautes, pas la première.
 *
 * ⛔ CE QUE CE GARDE FERME, MESURÉ AVANT LA RÉPARATION. Le parseur LEVAIT là où l'aval COLLECTE :
 * la nature d'un refus dépendait donc de l'ÉTAGE qui voyait la faute, jamais de la faute. Deux
 * conséquences, toutes deux reproduites ici :
 *   · deux fautes de forme ne rendaient qu'UNE erreur — l'analyse s'arrêtait à la première ;
 *   · une faute de forme ÉCRASAIT une faute de nom écrite AVANT elle dans le fichier. L'auteur
 *     corrigeait sa ligne 3 et découvrait sa ligne 2 au tour suivant.
 *
 * ⚠️ LA MATRICE EST LE POINT, PAS LES CAS. Un garde écrit sur le cas vu — « deux fautes de forme » —
 * laisserait passer l'écrasement croisé, qui est le pire des deux. Les quatre combinaisons d'étage
 * et d'ordre sont donc toutes ici : même étage ×2, étages mêlés dans les DEUX ordres.
 *
 * ⚠️ ET LE SOCLE DISTINGUE « TOUT REMONTE » DE « TOUT EST REFUSÉ » : une scène juste doit rendre
 * zéro. Sans lui, un compilateur qui refuserait tout passerait ce garde en vert.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const H = 'core\nalphabet.western\n';
const compte = (src) => (compileToBPxAST(src, {}).errors || []).length;
const codes = (src) => (compileToBPxAST(src, {}).errors || []).map((e) => String(e.code || ''));

// ── SOCLE — une scène juste ne rend rien, et l'arbre sort ─────────────────────────────────────
{
  const r = compileToBPxAST(`${H}-----\nS -> C4 D4\n`, {});
  ok((r.errors || []).length === 0, `SOCLE : une scène juste rend ${(r.errors || []).length} erreur(s)`);
  ok(r.ast !== null, `SOCLE : une scène juste doit rendre un arbre — sans quoi ce garde mesure un compilateur mort`);
}

// ── SOCLE — chaque faute prise SEULE est bien vue, sinon compter deux ne veut rien dire ───────
const FAUTE_DE_FORME_1 = 'S -> C4((( \n';
const FAUTE_DE_FORME_2 = 'T -> D4((( \n';
const FAUTE_DE_NOM_1 = 'S -> C4(zzinexistant1:1)\n';
const FAUTE_DE_NOM_2 = 'T -> D4(zzinexistant2:2)\n';
for (const [nom, ligne] of [['forme 1', FAUTE_DE_FORME_1], ['forme 2', FAUTE_DE_FORME_2],
                            ['nom 1', FAUTE_DE_NOM_1], ['nom 2', FAUTE_DE_NOM_2]]) {
  ok(compte(`${H}-----\n${ligne}`) === 1, `SOCLE : la faute « ${nom} » seule doit rendre EXACTEMENT 1 erreur`);
}

// ── LA MATRICE — deux fautes rendent deux erreurs, quels que soient les étages et l'ordre ─────
const MATRICE = [
  ['deux fautes de FORME',            FAUTE_DE_FORME_1 + FAUTE_DE_FORME_2],
  ['deux fautes de NOM',              FAUTE_DE_NOM_1 + FAUTE_DE_NOM_2],
  ['NOM puis FORME',                  FAUTE_DE_NOM_1 + FAUTE_DE_FORME_2],
  ['FORME puis NOM',                  FAUTE_DE_FORME_1 + FAUTE_DE_NOM_2],
];
for (const [nom, corps] of MATRICE) {
  const n = compte(`${H}-----\n${corps}`);
  ok(n === 2, `${nom} — l'auteur doit recevoir 2 erreurs, il en reçoit ${n}. Un refus d'un étage `
    + `écrase ceux de l'autre : la nature d'un refus dépend alors de l'étage qui voit la faute, `
    + `jamais de la faute.`);
}

// ── LE CAS QUI A OUVERT LE DÉFAUT — la faute PREMIÈRE dans le fichier ne doit pas disparaître ─
{
  const vus = codes(`${H}-----\n${FAUTE_DE_NOM_1}${FAUTE_DE_FORME_2}`);
  ok(vus.some((c) => c.startsWith('RESOLVE_')),
     `la faute de NOM de la ligne 1 doit remonter alors qu'une faute de FORME suit ligne 2 — `
   + `vus : ${vus.join(', ')}`);
  ok(vus.some((c) => c.startsWith('PARSE_')),
     `et la faute de FORME de la ligne 2 aussi — vus : ${vus.join(', ')}`);
}

// ── LE RÉSULTAT RESTE BINAIRE — collecter plusieurs fautes et produire une sortie sont deux choses ─
for (const [nom, corps] of MATRICE) {
  const r = compileToBPxAST(`${H}-----\n${corps}`, {});
  ok(r.ast === null, `${nom} — l'arbre doit être nul dès qu'une erreur existe (résultat binaire)`);
}

// ── LA REPRISE NE FABRIQUE PAS DE FAUTES — une règle abandonnée n'en contamine pas d'autres ───
{
  const n = compte(`${H}-----\n${FAUTE_DE_FORME_1}T -> D4\nU -> E4\n`);
  ok(n === 1, `une faute de forme suivie de DEUX règles justes doit rendre 1 erreur, pas ${n} — `
    + `au-delà, la reprise repart au milieu d'une règle illisible et invente des fautes.`);
}

if (echecs.length) {
  console.error(`[canal unique] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[canal unique] ${passe} PASS / 0 FAIL — ${passe} assertion(s) · `
  + `${MATRICE.length} combinaison(s) d'étage et d'ordre, chacune vérifiée sur le compte ET sur le résultat binaire`);
