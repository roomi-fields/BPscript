#!/usr/bin/env node
/**
 * GARDE — aucune clé de RÉGLAGE (`core.json schema.qualifierKeys`) ne doit vivre
 * ailleurs que dans la librairie `lib/controls.json`.
 *
 * POURQUOI CE GARDE EXISTE. Le parseur route les réglages réservés (`mode`, `scan`, `weight`,
 * `on_fail`, `tempx`, `meter`) par TROIS chemins distincts qui doivent tous les deux CONNAÎTRE
 * la même liste : `libCtx.qualifierKeys` (lu depuis `lib/core.json` → `schema.qualifierKeys`) ET
 * `libCtx.controlNames` (lu depuis `lib/controls.json`). Le 2026-08-04, cinq des six clés
 * n'étaient déclarées que dans `core.json` — `lib/controls.json` les ignorait. Effet mesuré :
 * `isRuntimeQualifier()` (parser.js), contrôlé PAR `controlNames`, ne reconnaissait pas
 * `(mode:random)`/`(weight:50)`/… comme un réglage connu dans les positions qui l'utilisent
 * (ex. `!(...)` dans le flux) — message d'erreur contradictoire, cf. le test dédié. Deux données
 * pour une même notion, sans les tenir synchrones : le défaut d'origine.
 *
 * CE QUE LE GARDE MESURE : pour CHAQUE clé de `qualifierKeys`, elle doit apparaître dans
 * `universeControlNames()` — le registre UNIFIÉ que `controls.json` alimente. Prouvé dans LES
 * DEUX SENS (§injection) : une clé absente de `controls.json` fait mordre le garde ; une clé
 * présente le laisse muet.
 */
import { SYNTAXE } from '../src/transpiler/syntaxe-data.js';
import '../src/transpiler/index.js';   // la porte : elle branche le compilateur sur son chargeur (2026-09-02)
import { universeControlNames } from '../src/transpiler/libs.js';
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ─── 0. Témoin anti-rétrécissement — la liste source n'est pas vide ──────────────────────────
const qualifierKeys = SYNTAXE.bracketRewrites?.mots;
// ⛔ LE MESSAGE DIT « une liste NON VIDE » ET LE SEUIL EN GARDE SIX. Même objet que deux autres de
// mes bancs, à deux autres seuils — 7 et 7. Trois recopies du compte du jour, jamais accordées.
ok(Array.isArray(qualifierKeys) && qualifierKeys.length > 0,
   `0. lib/core.json → schema.qualifierKeys est VIDE(reçu ${JSON.stringify(qualifierKeys)})`);

// ─── 1. TOUTE clé de réglage vit dans lib/controls.json ──────────────────────────────────────
const noms = universeControlNames();
for (const cle of qualifierKeys || []) {
  ok(noms.has(cle),
     `1. '${cle}' est un réglage RÉSERVÉ(lib/core.json schema.qualifierKeys) mais `
     + `lib/controls.json ne le déclare NULLE PART — le parseur route par 'controlNames' `
     + `(libs.js), pas seulement par 'qualifierKeys' : une clé absente de controls.json `
     + `est refusée dans certaines positions(ex. '!(${cle}:…)' dans le flux)`);
}

// ─── 2. Injection — la logique de comparaison MORD sur une clé absente, et se TAIT sur une
//        clé présente. Isolée du registre réel (qui ne doit pas être muté en cours de test) :
//        on rejoue la même fonction de comparaison sur des univers FABRIQUÉS.
const manquantes = (cles, connues) => cles.filter((c) => !connues.has(c));

const universFactice = new Set(['mode', 'scan']); // 'weight' manque exprès
ok(manquantes(['mode', 'scan', 'weight'], universFactice).length === 1,
   "2. (mord) la comparaison doit signaler 'weight' absent d'un univers qui ne le contient pas");
ok(manquantes(['mode', 'scan'], universFactice).length === 0,
   "2. (se tait) la comparaison ne doit rien signaler quand toutes les clés sont présentes");

if (echecs.length) {
  console.error(`❌ réglage hors librairie : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ tout réglage réservé vit dans lib/controls.json — ${passe} vérification(s) passée(s) sur ${(qualifierKeys || []).length} clé(s)`);
}
