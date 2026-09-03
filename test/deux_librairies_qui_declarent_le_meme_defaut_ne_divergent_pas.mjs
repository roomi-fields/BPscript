#!/usr/bin/env node
/**
 * GARDE — DEUX LIBRAIRIES QUI DÉCLARENT LE MÊME DÉFAUT NE DIVERGENT PAS EN SILENCE.
 *
 * Constat de Kairos, 2026-08-19, déposé AVANT ma frappe. Quatre manipulations de hauteur portent
 * leur défaut DANS DEUX LIBRAIRIES — `transpo` (le contrôle écrit dans une scène) et `digital`
 * (la fonction qui le calcule). Elles s'accordent aujourd'hui PAR LE FAIT, pas par une règle :
 * aucun garde ne les comparait, ni ici ni chez lui.
 *
 * ⛔ CE QUI REND CE GARDE NÉCESSAIRE N'EST PAS LA DUPLICATION, C'EST L'EFFET DE MA FRAPPE. Tant
 * que les deux formes DIFFÉRAIENT — une chaîne à découper d'un côté, des paramètres nommés de
 * l'autre — la duplication SE VOYAIT. Depuis que le défaut de `transpo` est lui aussi un défaut par
 * paramètre, les deux ont la MÊME forme : une divergence future serait deux nombres identiques qui
 * cessent un jour de l'être, sans que rien ne rougisse.
 *
 * UN ÉCART DE FORMES EST UN TÉMOIN INVOLONTAIRE. L'effacer sans poser le garde qui le remplace
 * échange une laideur visible contre un silence.
 *
 * ⚠️ CE GARDE NE CHOISIT PAS L'AUTORITÉ. Laquelle des deux déclarations fait foi est une question de
 * CONTRAT — Kairos a refusé de la trancher seul, et il a eu raison. Le garde tient l'ACCORD, pas la
 * source : tant qu'il tient, une divergence est impossible et la question se tranche calmement.
 */
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

console.log('[deux-défauts] deux librairies qui déclarent le même défaut ne divergent pas');

const controles = LIBS.transpo?.controls || {};
const objets = LIBS.digital?.objects || {};

/** Les valeurs par défaut d'une déclaration, à plat et dans l'ordre écrit. */
const defautsTranspo = (nom) => {
  const d = controles[nom]?.value;
  if (d === undefined) return [];
  return (d !== null && typeof d === 'object') ? Object.values(d) : [d];
};
const defautsDigital = (nom) => {
  const p = objets[nom]?.params;
  if (!p) return null;                       // la déclaration n'existe pas de ce côté
  // Les paramètres d'une fonction digitale gardent `default` jusqu'à la frappe des fonctions
  // (point 1 des cinq arbitrages) ; le contrôle, lui, porte `value` depuis le 2026-09-03.
  return Object.values(p).map((x) => x?.default).filter((x) => x !== undefined);
};

// ── 1. LE PÉRIMÈTRE DE LA COMPARAISON EST UN FAIT MESURÉ, ET IL EST GELÉ ────────────────────
// ⛔ Un nom qui ENTRE ou qui SORT cesse d'être compare sans un mot — c'est le mode d'échec exact
// qu'on ferme. Le garde inscrit donc le périmètre et rougit s'il bouge, au lieu de se contenter
// d'itérer sur ce qu'il trouve.
{
  const desDeux = Object.keys(controles).filter((n) => objets[n]).sort();
  ok(JSON.stringify(desDeux) === JSON.stringify(['chromashift', 'keyxpand', 'scaleshift', 'transpose']),
    `1. les noms déclarés DANS LES DEUX librairies doivent être les quatre mesurés — reçu `
    + `${JSON.stringify(desDeux)}. Un nom qui entre ou qui sort change ce que ce garde compare : `
    + `relire la correspondance avant de l'élargir.`);
  // L'asymétrie connue, inscrite pour qu'elle cesse d'être muette.
  ok(controles.scale !== undefined && objets.scale === undefined,
    `1. 'scale' est déclaré par 'transpo' SEUL — asymétrie connue. Si 'digital' vient à le porter, `
    + `les deux défauts doivent être compares comme les quatre autres.`);
}

// ── 2. LES DÉFAUTS S'ACCORDENT, VALEUR PAR VALEUR ───────────────────────────────────────────
// On compare les VALEURS, pas les noms de paramètres : `pivot` ici, `pivotStep` là-bas. Choisir
// un nommage serait choisir l'autorité, et ce n'est pas à un garde de le faire.
{
  let compares = 0;
  for (const nom of ['scaleshift', 'chromashift', 'keyxpand', 'transpose']) {
    const ici = defautsTranspo(nom);
    const la = defautsDigital(nom);
    if (la === null) { echecs.push(`2. '${nom}' n'est plus déclaré par 'digital' — la comparaison tombe`); continue; }
    compares++;
    ok(JSON.stringify(ici) === JSON.stringify(la),
      `2. '${nom}' : les deux librairies déclarent des défauts DIFFÉRENTS — transpo `
      + `${JSON.stringify(ici)} (${JSON.stringify(controles[nom]?.value)}) · digital `
      + `${JSON.stringify(la)}. Elles décrivent le même geste : un écart y est une faute, jamais `
      + `une variante.`);
  }
  ok(compares === 4, `2. le garde doit avoir COMPARÉ les quatre — ${compares} comparaison(s)`);
}

// ── 3. LA CORRESPONDANCE DES NOMS EST MESURÉE, PAS SUPPOSÉE ─────────────────────────────────
// ⚠️ Les paramètres ne portent PAS les mêmes noms d'une librairie à l'autre. Ce n'est pas un défaut
// que ce garde répare — c'est un fait qu'il inscrit, pour qu'un renommage d'un seul côté rougisse
// au lieu de fabriquer un appariement faux.
{
  const paires = [
    ['keyxpand', ['pivot', 'factor'], ['pivotStep', 'factor']],
    ['scaleshift', [], ['n']],
    ['chromashift', [], ['n']],
  ];
  for (const [nom, ici, la] of paires) {
    const cIci = Object.keys(controles[nom]?.value && typeof controles[nom].value === 'object'
      ? controles[nom].value : {});
    const cLa = Object.keys(objets[nom]?.params || {});
    ok(JSON.stringify(cIci) === JSON.stringify(ici),
      `3. '${nom}' · transpo doit nommer ${JSON.stringify(ici)} — reçu ${JSON.stringify(cIci)}`);
    ok(JSON.stringify(cLa) === JSON.stringify(la),
      `3. '${nom}' · digital doit nommer ${JSON.stringify(la)} — reçu ${JSON.stringify(cLa)}`);
  }
}

// ── 4. TÉMOIN D'INSTRUMENT — le garde sait DISTINGUER ───────────────────────────────────────
// ⛔ Sans lui, une comparaison qui rendrait toujours vrai passerait les volets ci-dessus en
// triomphe. On fabrique la divergence et on exige que la comparaison la voie.
{
  const faux = JSON.stringify([0, 1]) === JSON.stringify([0, 2]);
  ok(faux === false, '4. TÉMOIN — la comparaison doit distinguer deux suites qui diffèrent d\'une valeur');
  ok(JSON.stringify(defautsTranspo('keyxpand')) === JSON.stringify([0, 1]),
    `4. TÉMOIN — et lire réellement les valeurs de 'keyxpand' — reçu `
    + `${JSON.stringify(defautsTranspo('keyxpand'))}`);
}

ok(passe >= 14, `le garde doit avoir EXAMINÉ, pas seulement tourné (${passe} assertions)`);

if (echecs.length) {
  console.error(`[deux-défauts] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[deux-défauts] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
