#!/usr/bin/env node
/**
 * LE PORTILLON — lance TOUS les gardes du dépôt et échoue si l'un mord.
 *
 * POURQUOI CE FICHIER EXISTE. Jusqu'au 2026-07-19, le portillon ne lançait que DEUX
 * fichiers de test sur 41. Les 39 autres n'étaient exécutés par rien : ils étaient verts
 * par chance, et quinze avaient déjà pourri sans témoin — dont un qui PLANTAIT en cours de
 * route et annulait silencieusement 166 assertions. Un garde qu'on ne lance pas ne garde
 * rien ; il donne seulement l'impression d'être couvert.
 *
 * CE QUI EST LANCÉ ICI, et pourquoi ce découpage :
 *   - les GARDES : ils assertent et sortent en code non nul quand ils échouent, sans rien
 *     exiger de l'extérieur. Tout ce qui est dans ce lot DOIT rester vert.
 *   - les OUTILS À SEUIL : ils impriment un rapport et sortent TOUJOURS en zéro. Les lancer
 *     tels quels n'aurait aucun effet — ce sont des figurants. On leur donne donc un SEUIL
 *     mesurable et c'est nous qui échouons si le seuil n'est pas tenu.
 *
 * CE QUI N'EST PAS LANCÉ ICI, explicitement :
 *   - `test_wasm_all.js` et `run_bpx_scenes.cjs` — ils exigent le moteur CONSTRUIT (`--bin`).
 *     Lane séparée : le portillon doit pouvoir tourner sur un clone frais, sans build.
 *   - `compare_modal.cjs`, `kairos_bridge.mjs`, `resolve_bin.cjs` — des modules importés,
 *     jamais lancés ; ils sont couverts par ceux qui les utilisent.
 *   - `voie_b_status.mjs` — mesure de conformité à la baseline native, plusieurs minutes,
 *     et son verdict est un CONSTAT à lire (20 ISO / 54 DIFF), pas une régression. Le mettre
 *     au portillon rendrait le gate rouge en permanence pour un état connu.
 *
 * Usage :  node test/run_guards.mjs [--verbose]
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const verbeux = process.argv.includes('--verbose');

import { LANE_MOTEUR, MODULES, MOI, SEUILS, HORS_PORTILLON } from './gate_classification.mjs';

const fichiers = readdirSync(ICI)
  .filter((f) => /\.(js|cjs|mjs)$/.test(f))
  .filter((f) => f !== MOI && !MODULES.has(f) && !LANE_MOTEUR.has(f) && !HORS_PORTILLON.has(f))
  .filter((f) => !SEUILS.some((s) => s.fichier === f))
  .sort();

let echecs = 0;
let passes = 0;
let assertions = 0;
let sansCompte = 0;

/**
 * COMPTE D'ASSERTIONS RÉELLEMENT EXÉCUTÉES — pas le nombre de fichiers verts.
 *
 * Un fichier qui PLANTE en cours de route compte pour UN échec alors qu'il annule des
 * centaines d'assertions : `test_v08_parser` en rapportait 4 et en cachait 166. Compter les
 * fichiers sous-estime donc structurellement ce qu'on ne surveille pas. On totalise ce qui
 * s'est réellement exécuté, et on dit combien de fichiers n'annoncent PAS leur compte —
 * parce qu'un total qui ignore ses trous serait le même mensonge en plus discret.
 */
const compterAssertions = (sortie) => {
  for (const re of [/(\d+)\s+passed/i, /Passé\s*:\s*(\d+)/i, /(\d+)\s+PASS\b/, /Results?:\s*(\d+)/i, /(\d+)\s+vérification\(s\) passée\(s\)/i, /Résultat[^:]*:\s*(\d+)\s+OK/i]) {
    const m = sortie.match(re);
    if (m) return Number(m[1]);
  }
  const n = (sortie.match(/^\s*(?:ok|OK|PASS|✓)\b/gm) || []).length;
  return n > 0 ? n : null;
};

for (const f of fichiers) {
  const r = spawnSync('node', [path.join(ICI, f)], { encoding: 'utf-8', timeout: 300000 });
  const n = compterAssertions((r.stdout || '') + (r.stderr || ''));
  if (n === null) sansCompte++; else assertions += n;
  if (r.status === 0) {
    passes++;
    if (verbeux) console.log(`  ok   ${f}${n === null ? '' : `  (${n} assertions)`}`);
  } else {
    echecs++;
    console.error(`  ÉCHEC ${f}  (code ${r.status})`);
    const detail = ((r.stdout || '') + (r.stderr || '')).split('\n').filter((l) => /FAIL|Error|✗/.test(l)).slice(0, 3);
    for (const d of detail) console.error(`         ${d.trim().slice(0, 140)}`);
  }
}

for (const s of SEUILS) {
  const r = spawnSync('node', [path.join(ICI, s.fichier)], { encoding: 'utf-8', timeout: 900000 });
  const n = s.mesure((r.stdout || '') + (r.stderr || ''));
  if (n >= s.plancher) {
    passes++;
    if (verbeux) console.log(`  ok   ${s.fichier} — ${n} ${s.unite} (plancher ${s.plancher})`);
  } else {
    echecs++;
    console.error(`  ÉCHEC ${s.fichier} — ${n} ${s.unite}, plancher ${s.plancher} (${s.quoi})`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-VACUITÉ — tout garde d'ENSEMBLE doit prouver qu'il regarde quelque chose.
//
// Un garde qui balaie un ensemble et le trouve vide passe au vert sans rien vérifier.
// C'est l'erreur exacte que j'ai commise dans la première version du méta-garde : elle
// cherchait des orphelins dans un ensemble qui ne pouvait pas en contenir, et elle
// verdissait toujours. Un contrôle vide est indiscernable d'un contrôle satisfait.
// On exige donc un TÉMOIN POSITIF : chaque garde d'ensemble déclare le nombre minimal
// d'éléments qu'il doit voir. S'il en voit moins, c'est qu'il ne regarde plus au bon
// endroit — et c'est LUI qui est cassé, pas le dépôt qui est devenu parfait.
{
  const temoins = [
    { quoi: 'gardes lancés par le portillon', vu: fichiers.length, minimum: 35 },
    { quoi: 'outils sous seuil', vu: SEUILS.length, minimum: 2 },
    { quoi: 'exclusions motivées', vu: LANE_MOTEUR.size + MODULES.size + HORS_PORTILLON.size, minimum: 10 },
  ];
  const creux = temoins.filter((t) => t.vu < t.minimum);
  if (creux.length > 0) {
    echecs++;
    for (const t of creux) {
      console.error(`  ÉCHEC anti-vacuité — ${t.quoi} : ${t.vu} vu(s), minimum attendu ${t.minimum}.`);
      console.error('         Un garde qui ne voit plus rien ne prouve rien : vérifiez qu il regarde au bon endroit.');
    }
  } else {
    passes++;
    if (verbeux) console.log(`  ok   anti-vacuité — ${temoins.map((t) => `${t.vu} ${t.quoi}`).join(', ')}`);
  }
}

console.log(`\n[gardes] ${passes} garde(s) vert(s), ${echecs} en échec.`);
console.log(`[gardes] ${assertions} assertion(s) RÉELLEMENT exécutée(s)`
  + (sansCompte ? ` — ${sansCompte} fichier(s) n'annoncent pas leur compte, non totalisés.` : '.'));
if (echecs === 0) {
  console.log('[gardes] lane séparée, non lancée ici : test_wasm_all.js, run_bpx_scenes.cjs (moteur construit requis).');
}
process.exit(echecs ? 1 : 0);
