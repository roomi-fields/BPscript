#!/usr/bin/env node
/**
 * SONDE — les deux voies produisent-elles le MÊME AST ?
 *
 * CE QUE C'EST, ET CE QUE CE N'EST PAS. Un outil de DIAGNOSTIC, pas un garde. Il ne dit pas
 * si une grammaire est correcte — c'est la production qui le dit, et elle seule (décision
 * Romain : « la seule chose que je veux c'est que la PRODUCTION soit identique »). Il répond à
 * une question plus étroite et très utile : *où* chercher quand un DIFF est constaté.
 *
 * LE DISCRIMINANT :
 *   - AST des deux voies DIVERGENTS  → la cause est FRONTALE (parseur ou émission : mon bord
 *     pour la Voie B, celui de bp3-frontend pour la Voie A). Inutile de creuser BPx.
 *   - AST IDENTIQUES mais production divergente → la cause est EN AVAL (BPx, Kairos, Kronos).
 *     Inutile de relire les parseurs.
 *
 * Ça automatise le « d'où ça vient » que je déduisais à la main — et que je me suis trompé à
 * déduire plusieurs fois : constater *où* ça casse n'a jamais dit *d'où* ça vient. Une sonde
 * qui répond mécaniquement à cette question vaut mieux qu'un raisonnement qui paraît solide.
 *
 * ⚠️ IL NE DÉGRADE PAS SA SORTIE. Si la Voie A n'est pas chargeable, il le DIT et s'arrête.
 * Un outil qui répond « OK » en ayant silencieusement perdu la moitié de son entrée est le
 * pire des oracles — on a payé exactement ça sur un pipeline de snapshots.
 *
 * Usage :  node --experimental-strip-types test/sonde_ast.mjs [grammaire…]
 *          (le drapeau est requis : la Voie A est du TypeScript non compilé)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { DIR_BPS, bpsPath, nomsBps, exigerCorpus } from './corpus.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GRAMMARS = DIR_BPS;  // corpus emprunté à la bibliothèque Kanopi (test/corpus.mjs)
const NATIF = '/home/romi/dev/bp/bp3-engine/test-data';

const { compileToBPxAST } = require('../src/transpiler/index.js');

let parseBP3;
try {
  ({ parseBP3 } = await import('/home/romi/dev/bp/bp3-frontend/src/index.ts'));
} catch (e) {
  console.error('SONDE INUTILISABLE — la Voie A (bp3-frontend/src/index.ts) ne se charge pas :');
  console.error(`  ${e.message}`);
  console.error("  Relancer avec `node --experimental-strip-types` (la Voie A est du TypeScript non compilé).");
  console.error('  Je ne rends AUCUN verdict sans les deux côtés : une comparaison à une seule voie');
  console.error('  ne dirait rien, et un « identique » obtenu ainsi serait un mensonge.');
  process.exit(2);
}

/**
 * Forme comparable d'un AST : on retire ce qui ne peut PAS coïncider entre deux voies sans
 * que ce soit une divergence — les positions source (`line`, `col`) décrivent le fichier
 * d'origine, pas la structure. Tout le reste est comparé tel quel : c'est une sonde de
 * structure, elle n'a pas à être indulgente.
 */
function forme(noeud) {
  if (Array.isArray(noeud)) return noeud.length === 0 ? null : noeud.map(forme);
  if (noeud && typeof noeud === 'object') {
    const out = {};
    for (const k of Object.keys(noeud).sort()) {
      if (k === 'line' || k === 'col') continue;
      const v = forme(noeud[k]);
      // ABSENCE ≡ VIDE. Une voie écrit `assignments: []`, l'autre omet le champ : les deux
      // disent « il n'y en a pas ». Les compter comme une divergence noierait les vraies sous
      // du bruit — et un outil qui signale tout ne signale rien. On ne normalise QUE l'absence :
      // deux valeurs présentes et différentes restent une divergence, sans indulgence.
      if (v === null || v === undefined) continue;
      out[k] = v;
    }
    return out;
  }
  return noeud;
}

/** Premier chemin où les deux formes divergent — pour pointer, pas pour tout dérouler. */
function premiereDivergence(a, b, chemin = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${chemin} : ${a.length} élément(s) contre ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = premiereDivergence(a[i], b[i], `${chemin}[${i}]`);
      if (d) return d;
    }
    return chemin;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = premiereDivergence(a[k], b[k], `${chemin}.${k}`);
      if (d) return d;
    }
    return chemin;
  }
  return `${chemin} : ${JSON.stringify(a)} contre ${JSON.stringify(b)}`;
}

const seulement = process.argv.slice(2).filter((a) => !a.startsWith('--'));
exigerCorpus();
const noms = nomsBps()
  .filter((d) => existsSync(path.join(NATIF, `-gr.${d}`)))
  .filter((d) => seulement.length === 0 || seulement.includes(d))
  .sort();

const tally = { identiques: 0, frontal: 0, indisponible: 0 };
console.log(`Sonde AST — ${noms.length} grammaire(s) ayant les DEUX sources (.bps et -gr.*)\n`);

for (const nom of noms) {
  let a, b;
  try {
    b = compileToBPxAST(readFileSync(bpsPath(nom), 'utf-8'));
    if (b.errors.length) { console.log(`  ${nom.padEnd(24)} VOIE B REFUSE  ${b.errors[0].message.slice(0, 60)}`); tally.indisponible++; continue; }
  } catch (e) { console.log(`  ${nom.padEnd(24)} VOIE B ÉCHOUE  ${e.message.slice(0, 60)}`); tally.indisponible++; continue; }
  try {
    a = parseBP3(readFileSync(path.join(NATIF, `-gr.${nom}`), 'utf-8'));
  } catch (e) { console.log(`  ${nom.padEnd(24)} VOIE A ÉCHOUE  ${e.message.slice(0, 60)}`); tally.indisponible++; continue; }

  const astA = forme(a.ast ?? a);
  const astB = forme(b.ast);
  if (JSON.stringify(astA) === JSON.stringify(astB)) {
    console.log(`  ${nom.padEnd(24)} AST IDENTIQUES → un DIFF de production viendrait de l'AVAL`);
    tally.identiques++;
  } else {
    console.log(`  ${nom.padEnd(24)} AST DIVERGENTS → cause FRONTALE ${premiereDivergence(astA, astB).slice(0, 90)}`);
    tally.frontal++;
  }
}

console.log('\nBilan :');
console.log(`  AST identiques (chercher en AVAL)     ${tally.identiques}`);
console.log(`  AST divergents (chercher au FRONTAL)  ${tally.frontal}`);
console.log(`  non comparables (une voie indisponible) ${tally.indisponible}`);
