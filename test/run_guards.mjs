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

/**
 * LANE MOTEUR — exigent le moteur BP3 CONSTRUIT (`--bin`). Exécutés séparément
 * (`npm run guards:moteur`), jamais dans ce portillon : il doit tourner sur un clone frais.
 */
const LANE_MOTEUR = new Map([
  ['test_wasm_all.js', 'intégration WASM complète : charge le moteur construit, un processus fils par scène'],
  ['run_bpx_scenes.cjs', 'joue les scènes contre le moteur WASM, prend --bin <tag>'],
]);
/** Modules importés, jamais lancés — couverts par ceux qui les utilisent. */
const MODULES = new Map([
  ['compare_modal.cjs', 'comparateur importé par voie_b_status et les mesures'],
  ['kairos_bridge.mjs', 'pont vers Kairos/Kronos, importé par les mesures'],
  ['resolve_bin.cjs', 'résolution du tag de binaire, importé par la lane moteur'],
]);
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
/**
 * HORS PORTILLON — chaque exclusion porte SON MOTIF, et le méta-garde vérifie qu'aucun
 * fichier n'échappe au gate sans en avoir un. Un fichier retiré « pour l'instant » sans
 * raison écrite est exactement ce qui nous a mordus.
 */
const HORS_PORTILLON = new Map([
  ['voie_b_status.mjs', 'mesure de conformité à la baseline native : plusieurs minutes, et son verdict est un CONSTAT à lire (20 ISO / 54 DIFF), pas une régression — au gate il rougirait en permanence pour un état connu'],
  ['audit_horloge.mjs', 'audit ponctuel des horloges natives : rapport de diagnostic, sans verdict binaire'],
  ['diff_families.mjs', 'classification mécanique des DIFF : outil d analyse, pas un garde'],
  ['nom_vs_hz.mjs', 'sonde de résolution nom↔fréquence : rapport, seuil non défini'],
  ['bp2_settings.cjs', 'inspection des réglages BP2 : utilitaire de lecture, aucune assertion'],
]);

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
// MÉTA-GARDE ANTI-CONTOURNEMENT
//
// C'est LUI qui rend les autres obligatoires. Sans lui, la restauration du portillon
// serait vraie aujourd'hui et fausse dans six mois : il suffirait qu'un test soit ajouté
// hors du gate pour qu'il redevienne un garde que personne ne lance — l'état qu'on vient
// de payer (2 fichiers lancés sur 41, quinze pourris sans témoin, un qui plantait en
// annulant 166 assertions).
//
// ⚠️ MA PREMIÈRE VERSION DE CE MÉTA-GARDE ÉTAIT UN FIGURANT, et l'injection l'a prouvé.
// Elle cherchait des « orphelins » DANS `test/` — or ce portillon inclut par DÉFAUT tout
// fichier non déclaré ailleurs : un nouveau test y tombe automatiquement, il ne peut donc
// JAMAIS y avoir d'orphelin ici. Le contrôle était vide par construction, exactement le
// travers que je reprochais aux outils sortant toujours en zéro. Vérifié : un fichier
// bidon déposé dans `test/` passait le gate au vert.
//
// Ce qu'il faut réellement surveiller, et que cette version vérifie :
//   1. les fichiers de test vivant HORS de `test/` — ceux-là, rien ne les lance jamais ;
//   2. les exclusions SANS motif écrit — « retiré pour l'instant » est ce qui pourrit.
const RACINE = path.resolve(ICI, '..');
/** Tests hors `test/` déjà connus et assumés, avec leur raison. */
const HORS_DOSSIER_ADMIS = new Map([
  ['src/transpiler/test.js', 'démonstration manuelle du transpileur (imprime alphabet et grammaire, aucune assertion, sort toujours en zéro) — conservée comme outil de mise au point, jamais un garde'],
]);
{
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
  const horsGate = trouves.filter((f) => !HORS_DOSSIER_ADMIS.has(f));
  const sansMotif = [...LANE_MOTEUR, ...MODULES, ...HORS_PORTILLON, ...HORS_DOSSIER_ADMIS]
    .filter(([, motif]) => !motif || motif.trim().length < 20)
    .map(([f]) => f);

  if (horsGate.length > 0) {
    echecs++;
    console.error(`  ÉCHEC méta-garde — ${horsGate.length} fichier(s) de test vivent HORS de test/ et ne sont lancés par rien :`);
    for (const f of horsGate) console.error(`         ${f}`);
    console.error('         Déplacez-les dans test/ (ils seront lancés automatiquement), ou déclarez-les');
    console.error('         dans HORS_DOSSIER_ADMIS avec un motif écrit.');
  }
  if (sansMotif.length > 0) {
    echecs++;
    console.error(`  ÉCHEC méta-garde — exclusion(s) sans motif écrit : ${sansMotif.join(', ')}`);
  }
  if (horsGate.length === 0 && sansMotif.length === 0) {
    passes++;
    if (verbeux) {
      console.log(`  ok   méta-garde — tout test de test/ est lancé par défaut ; ${trouves.length} hors dossier, tous motivés`);
    }
  }
}

console.log(`\n[gardes] ${passes} garde(s) vert(s), ${echecs} en échec.`);
console.log(`[gardes] ${assertions} assertion(s) RÉELLEMENT exécutée(s)`
  + (sansCompte ? ` — ${sansCompte} fichier(s) n'annoncent pas leur compte, non totalisés.` : '.'));
if (echecs === 0) {
  console.log('[gardes] lane séparée, non lancée ici : test_wasm_all.js, run_bpx_scenes.cjs (moteur construit requis).');
}
process.exit(echecs ? 1 : 0);
