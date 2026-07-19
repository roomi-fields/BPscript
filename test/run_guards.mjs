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

/** Exige le moteur BP3 construit → lane séparée, jamais dans ce portillon. */
const LANE_MOTEUR = new Set(['test_wasm_all.js', 'run_bpx_scenes.cjs']);
/** Modules importés, pas des exécutables. */
const MODULES = new Set(['compare_modal.cjs', 'kairos_bridge.mjs', 'resolve_bin.cjs']);
/** Ce fichier-ci. */
const MOI = 'run_guards.mjs';

/**
 * OUTILS À SEUIL — ils sortent toujours en zéro, c'est NOUS qui jugeons leur sortie.
 * Le seuil est un plancher constaté : il ne monte pas tout seul, mais il ne doit jamais
 * descendre sans qu'on le sache.
 */
const SEUILS = [
  {
    fichier: 'scan_corpus.mjs',
    quoi: 'aller-retour BP3 → BPScript → BP3',
    mesure: (sortie) => (sortie.match(/FIDÈLE/g) || []).length,
    plancher: 13,
    unite: 'grammaire(s) FIDÈLE',
  },
  {
    // DETTE NOMMÉE, pas une exclusion. Ce fichier porte 6 échecs ANTÉRIEURS à la
    // restauration du portillon : la notation métavariable `|x|` se perd à la conversion
    // (`(=|A1|)` ressort `(=A1`). Le corriger demande de creuser le convertisseur, ce qui
    // n'est pas le chantier du jour.
    // Plutôt que de l'exclure — le gate ne couvrirait alors PLUS DU TOUT le convertisseur —
    // on le surveille par son NOMBRE DE SUCCÈS : il ne doit jamais descendre. Les 6 échecs
    // connus restent tolérés, une régression NOUVELLE mord immédiatement.
    fichier: 'test_bp3_to_scene.cjs',
    quoi: 'convertisseur BP3 → scène (6 échecs connus : métavariables |x|)',
    mesure: (sortie) => Number((sortie.match(/Résultat unitaires\+ref:\s*(\d+) OK/) || [])[1] || 0),
    plancher: 79,
    unite: 'assertion(s) OK',
  },
];
/** Outils de rapport délibérément HORS portillon (voir en-tête). */
const HORS_PORTILLON = new Set(['voie_b_status.mjs', 'audit_horloge.mjs', 'diff_families.mjs', 'nom_vs_hz.mjs', 'bp2_settings.cjs']);

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

console.log(`\n[gardes] ${passes} garde(s) vert(s), ${echecs} en échec.`);
console.log(`[gardes] ${assertions} assertion(s) RÉELLEMENT exécutée(s)`
  + (sansCompte ? ` — ${sansCompte} fichier(s) n'annoncent pas leur compte, non totalisés.` : '.'));
if (echecs === 0) {
  console.log('[gardes] lane séparée, non lancée ici : test_wasm_all.js, run_bpx_scenes.cjs (moteur construit requis).');
}
process.exit(echecs ? 1 : 0);
