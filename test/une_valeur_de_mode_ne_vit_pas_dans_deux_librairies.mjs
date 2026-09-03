#!/usr/bin/env node
/**
 * GARDE — LES VALEURS DE MODE SONT DÉCLARÉES À UNE SEULE VOIX, ET CHACUNE COMPILE.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE. La liste fermée des modes de dérivation vivait dans DEUX librairies :
 * `language.directiveValues.mode.values`, que le parser lit pour refuser un mode inconnu, et
 * `engine.engine.mode.values`, que personne ne lit chez moi mais que mon bundle PUBLIE. Le
 * 2026-08-19, `random` est devenu `rnd` : le refus a été câblé sur la première, et la seconde a
 * gardé `random` pendant une journée entière. Aucun garde n'a rougi — les deux listes n'étaient
 * comparées par rien.
 *
 * **Une donnée publiée qui décrit une valeur morte est le troisième domicile d'un mot retiré**,
 * après le parser et le refus. Elle est pire que les deux autres : un voisin qui lit mon bundle
 * pour proposer les modes à un auteur lui en offre un que le compilateur refuse, et rien chez lui
 * ne peut le signaler — sa donnée vient de moi.
 *
 * ⛔ ET LE GARDE COMPARE DANS LES DEUX SENS. Vérifier que chaque valeur déclarée compile laisserait
 * passer une valeur MANQUANTE ; vérifier l'inverse laisserait passer une valeur en trop. Une
 * égalité d'ensembles ne se prouve que par ses deux inclusions.
 */
import { loadLib } from '../src/transpiler/libs.js';
import { SYNTAXE } from '../src/transpiler/syntaxe-data.js';
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const T = 'core\nalphabet.western\n';
const erreursDe = (src) => (compileToBPxAST(src).errors || []).map((e) => e.message ?? String(e));

/**
 * LES DEUX DOMICILES DE LA LISTE. Nommés, pas découverts : une découverte par balayage rendrait
 * l'ensemble vide le jour où un chemin change, et un ensemble vide a la tête d'un garde vert.
 */
const DOMICILES = [
  // ⛔ LE SCHÉMA DE SYNTAXE A QUITTÉ `lib/` LE 2026-08-21 — il se lit par SA PORTE, plus par le
  // registre des librairies (décision Romain du 2026-08-20). `loadLib('language')` rendait `null`
  // après le déménagement, et ce volet a compté ZÉRO mode déclaré : un catalogue vide et un
  // catalogue déplacé ont exactement la même empreinte à travers un lecteur qui n'a pas suivi.
  ['schema-syntaxe · directiveValues.mode.values',
    () => (SYNTAXE.directiveValues?.mode?.values || []).map((v) => v.name ?? v)],
  ['engine.engine.mode.values',
    () => loadLib('engine')?.engine?.mode?.values || []],
];

const listes = DOMICILES.map(([nom, lire]) => [nom, lire()]);
console.log(`[modes] ${listes.length} domiciles : ${listes.map(([n, l]) => `${n} (${l.length})`).join(' · ')}`);

// ── 1. AUCUN DOMICILE N'EST VIDE — un ensemble vide passe toutes les inclusions ──────────────
for (const [nom, liste] of listes) {
  ok(liste.length >= 7,
    `1. ${nom} doit déclarer au moins les sept modes du natif(reçu : ${liste.length})`);
}

// ── 2. LES DEUX LISTES SONT ÉGALES — les deux inclusions, pas une ───────────────────────────
{
  const [[nomA, a], [nomB, b]] = listes;
  const ensA = new Set(a);
  const ensB = new Set(b);
  for (const v of ensA) {
    ok(ensB.has(v), `2. '${v}' est déclaré par ${nomA} et MANQUE à ${nomB}`);
  }
  for (const v of ensB) {
    ok(ensA.has(v), `2. '${v}' est déclaré par ${nomB} et MANQUE à ${nomA} — `
      + `une donnée publiée qui porte une valeur que le parser refuse enseigne une forme morte`);
  }
}

// ── 3. CHAQUE VALEUR DÉCLARÉE COMPILE — la donnée ne promet rien que le code refuse ─────────
for (const [nom, liste] of listes) {
  for (const v of liste) {
    const e = erreursDe(`${T}-----\nS -> C4\nmode:${v}\nT -> D4\n`);
    ok(e.length === 0,
      `3. ${nom} déclare '${v}', que le compilateur REFUSE(reçu : ${e[0]?.slice(0, 130)})`);
  }
}

// ── 4. TÉMOIN NON NUL — un mode qu'aucun domicile ne déclare doit être REFUSÉ ────────────────
// Sans lui, un compilateur qui accepterait tout rendrait le volet 3 vert sans rien prouver.
for (const invente of ['zorglubmode', 'random']) {
  const e = erreursDe(`${T}-----\nS -> C4\nmode:${invente}\nT -> D4\n`);
  ok(e.length >= 1, `4. TÉMOIN — le mode '${invente}' n'est déclaré nulle part et doit être REFUSÉ`);
  ok(e.some((m) => m.includes(invente)),
    `4. TÉMOIN — le refus doit nommer la VALEUR fautive, pas la clé(reçu : ${e[0]?.slice(0, 130)})`);
}

if (echecs.length) {
  console.error(`[modes] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[modes] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
