#!/usr/bin/env node
/**
 * MÉTA-GARDE ANTI-CONTOURNEMENT — un fichier À PART, pas un bloc du lanceur.
 *
 * POURQUOI À PART. Tant qu'il vivait DANS `run_guards.mjs`, il ne pouvait rien dire du
 * lanceur lui-même : c'est le lanceur qui décidait de l'exécuter. Un garde qui dépend de
 * ce qu'il surveille n'est pas un garde. Ici il est un fichier de `test/` comme les
 * autres — donc lancé par le portillon (inclusion par défaut) ET lançable seul.
 *
 * ⚠️ MA PREMIÈRE VERSION ÉTAIT UN FIGURANT, et seule l'injection l'a démasquée. Elle
 * cherchait des « orphelins » DANS `test/` — or le portillon inclut par défaut tout
 * fichier non déclaré ailleurs : il ne peut JAMAIS y avoir d'orphelin là. Le contrôle
 * était vide par construction, exactement le travers que je reproche aux outils qui
 * sortent toujours en zéro. Vérifié à l'époque : un fichier bidon déposé dans `test/`
 * laissait le gate au vert.
 *
 * Ce qu'il vérifie réellement :
 *   1. les fichiers de test vivant HORS de `test/` — ceux-là, rien ne les lance jamais ;
 *   2. les exclusions SANS motif écrit — « retiré pour l'instant » est ce qui pourrit.
 *
 * Il NE RE-DÉRIVE PAS la vérité du lanceur : il lit la MÊME déclaration
 * (`gate_classification.mjs`) et interroge le SYSTÈME DE FICHIERS lui-même, il ne relit
 * pas le rapport de `run_guards`. Un garde qui se contenterait de croire le compte-rendu
 * du lanceur ne vérifierait que la cohérence du lanceur avec lui-même.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { LANE_MOTEUR, MODULES, HORS_PORTILLON } from './gate_classification.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');

/** Tests hors `test/` connus et assumés, avec leur raison. */
const HORS_DOSSIER_ADMIS = new Map([
  ['src/transpiler/test.js', 'démonstration manuelle du transpileur (imprime alphabet et grammaire, aucune assertion, sort toujours en zéro) — outil de mise au point, jamais un garde'],
]);

const trouves = [];
const explore = (rel) => {
  for (const e of readdirSync(path.join(RACINE, rel), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const sous = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) explore(sous);
    else if (/(^|\/)(test|spec)[._-].*\.(js|cjs|mjs|ts)$|\.(test|spec)\.(js|cjs|mjs|ts)$|(^|\/)test\.(js|cjs|mjs)$/.test(sous)) trouves.push(sous);
  }
};
for (const racine of ['src', 'lib', 'editor']) {
  try { explore(racine); } catch { /* dossier absent : rien à explorer */ }
}

let echecs = 0;
const horsGate = trouves.filter((f) => !HORS_DOSSIER_ADMIS.has(f));
if (horsGate.length > 0) {
  echecs++;
  console.error(`FAIL méta-garde — ${horsGate.length} fichier(s) de test vivent HORS de test/ et ne sont lancés par rien :`);
  for (const f of horsGate) console.error(`       ${f}`);
  console.error('       Déplacez-les dans test/ (ils y seront lancés automatiquement), ou déclarez-les');
  console.error('       dans HORS_DOSSIER_ADMIS avec un motif écrit.');
}

const sansMotif = [...LANE_MOTEUR, ...MODULES, ...HORS_PORTILLON, ...HORS_DOSSIER_ADMIS]
  .filter(([, motif]) => !motif || motif.trim().length < 20)
  .map(([f]) => f);
if (sansMotif.length > 0) {
  echecs++;
  console.error(`FAIL méta-garde — exclusion(s) sans motif écrit : ${sansMotif.join(', ')}`);
}

// ANTI-VACUITÉ de ce garde-ci : il balaie un ensemble ; s'il n'y voit plus rien, c'est
// qu'il ne regarde plus au bon endroit, pas que le dépôt est devenu parfait.
const exclusions = LANE_MOTEUR.size + MODULES.size + HORS_PORTILLON.size;
if (exclusions < 10) {
  echecs++;
  console.error(`FAIL méta-garde — ${exclusions} exclusion(s) vues, au moins 10 attendues : la déclaration n'est plus lue.`);
}

console.log(`${echecs === 0 ? 'PASS' : 'FAIL'} méta-garde — ${trouves.length} test(s) hors test/ (tous motivés), ${exclusions} exclusions motivées.`);
process.exit(echecs ? 1 : 0);
