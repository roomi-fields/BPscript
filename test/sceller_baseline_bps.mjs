#!/usr/bin/env node
/**
 * SCELLER LA BASELINE DE LA VOIE `.bps` — sur l'assiette des 96 natives, et sur elle seule.
 *
 * CONSIGNE DE ROMAIN, 2026-08-11 : « tu produis la baseline de la voie .bps, à partir de la
 * baseline native et d'elle seule ». L'assiette est la liste SCELLÉE par bp3-engine
 * (`baseline-native/SCELLE.json`, champ `preuve.reproductibles_96`), jamais une reconstruction.
 *
 * ⚠️ CE FICHIER NE MESURE RIEN LUI-MÊME, ET C'EST DÉLIBÉRÉ. La mesure appartient à
 * `voie_b_status.mjs`, qui parcourt la chaîne COMPLÈTE — `.bps` → compileToBPxAST → BPx →
 * Kairos (hauteur) → Kronos (temps) — et délègue la comparaison à `compare_modal.cjs`, juge
 * unique des deux voies. Ce fichier RESTREINT ce résultat à l'assiette et le SCELLE avec ses
 * conditions. Une seconde mesure serait une seconde autorité.
 *
 * ⛔ POURQUOI CET AVERTISSEMENT EST ÉCRIT ICI. Le 2026-08-11 j'ai monté une chaîne à part —
 * arbre, puis dérivation BPx, et comparaison directe — et j'ai rapporté ZÉRO production
 * identique et « 51 séquences à marqueurs opaques » comme un empêchement chez BPx. C'était un
 * artefact du POINT DE MESURE : les marqueurs `{poly}` / `{ctrl}` sont la sortie de BPx AVANT
 * Kairos et Kronos, et la chaîne complète les résout. Mesurée au bon endroit, l'assiette rend
 * VINGT productions identiques. L'en-tête de `voie_b_status.mjs` porte cet avertissement depuis
 * le rebranchement demandé par Romain ; je ne l'avais pas lu avant de monter le mien.
 *
 * LES TROIS ÉTATS demandés, et la correspondance avec ce que rend le harnais :
 *   PLANTE               ← `NE PRODUIT PAS`  (refus à la compilation, ou refus de la chaîne)
 *   PRODUIT              ← `DIFF`            (la chaîne rend une production, elle diverge)
 *   PRODUCTION IDENTIQUE ← `ISO`
 * Un quatrième état sort du harnais — `NON-MESURABLE` — et il n'est PAS rangé de force dans les
 * trois : il est écrit tel quel, nommé, avec sa cause. Ranger une énumération qui ne termine pas
 * sous « plante » ou sous « produit » inventerait la réponse que la mesure n'a pas donnée.
 *
 * Usage : node test/sceller_baseline_bps.mjs [--ecrire]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const NATIVE = path.resolve(RACINE, '..', 'bp3-engine', 'baseline-native');
const SORTIE = path.join(ICI, 'baseline-bps', 'baseline.json');

// ── L'ASSIETTE — scellée par le propriétaire de la référence, jamais reconstruite ────────────
const scelle = JSON.parse(fs.readFileSync(path.join(NATIVE, 'SCELLE.json'), 'utf8'));
const native = JSON.parse(fs.readFileSync(path.join(NATIVE, 'baseline.json'), 'utf8'));
// ⛔ L'ASSIETTE EST CE QUE LE SCELLÉ PORTE, ET SON COMPTE NE SE VÉRIFIE PAS ICI.
//
// Ce contrôle exigeait 96. Il refusait donc de tourner le jour où le propriétaire rescellait —
// et il a refusé : Romain a retiré cinq grammaires dont le fichier de réglages déclaré est
// illisible par le moteur, l'assiette est passée à 91, et ce producteur s'est arrêté sur un
// chiffre écrit chez moi. Un compte attendu en dur EST une contre-mesure de la référence : il
// dit « je sais combien tu en as » à celui qui seul le sait. bp3-engine est la référence, son
// chiffre fait foi, et on ne le remesure pas (arbitrage 2026-08-12).
//
// CE QUI RESTE CONTRÔLÉ, et qui n'est pas un compte : que la liste EXISTE et ne soit pas vide.
// Une assiette absente ferait produire une baseline sur rien, en silence — c'est le seul cas où
// ce producteur doit s'arrêter, et il ne devine toujours aucune assiette.
// Le nom du champ appartient au propriétaire ; il porte encore le compte d'origine et ce n'est
// pas à moi de le renommer.
const ASSIETTE = scelle.preuve.reproductibles_96;
if (!Array.isArray(ASSIETTE) || ASSIETTE.length === 0) {
  console.error("❌ l'assiette scellée est absente ou vide. Ce producteur ne devine pas une "
    + "assiette : il s'arrête.");
  process.exit(1);
}

// ── LA MESURE — empruntée au harnais, jamais refaite ─────────────────────────────────────────
const brut = execFileSync(process.execPath, [path.join(ICI, 'voie_b_status.mjs'), '--json'],
  { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 1_800_000 });
const mesureJson = JSON.parse(brut);
const mesures = Array.isArray(mesureJson) ? mesureJson : Object.values(mesureJson)[0];
const parNom = new Map(mesures.map((e) => [e.grammaire, e]));

const ETATS = {
  'NE PRODUIT PAS': 'PLANTE',
  DIFF: 'PRODUIT',
  ISO: 'PRODUCTION IDENTIQUE',
};

const grammaires = [];
for (const nom of ASSIETTE) {
  const nat = Object.values(native.grammaires).find((e) => e.grammaire === nom) || null;
  const m = parNom.get(nom) || null;
  if (!m) {
    // La scène n'existe pas dans le corpus : ce n'est pas un état de la chaîne, c'est une ABSENCE.
    grammaires.push({ grammaire: nom, scene_bps: false, etat: null,
      hors_etats: 'SCENE ABSENTE DU CORPUS', detail: null,
      modalite: nat?.modalite ?? null, action: nat?.action ?? null });
    continue;
  }
  const etat = ETATS[m.status] ?? null;
  grammaires.push({
    grammaire: nom,
    scene_bps: true,
    etat,
    hors_etats: etat ? null : m.status,
    detail: m.detail ?? null,
    modalite: m.modalite ?? nat?.modalite ?? null,
    action: nat?.action ?? null,
    n_reference: m.n_ref ?? null,
    n_candidat: m.n_cand ?? null,
  });
}

const compte = (p) => grammaires.filter(p).length;
const baseline = {
  _comment: 'Baseline de la voie .bps sur l\'assiette des 96 natives scellées. Produite par '
    + 'test/sceller_baseline_bps.mjs ; la MESURE vient de test/voie_b_status.mjs, jamais d\'ici.',
  version: 'v1',
  date: new Date().toISOString().slice(0, 10),
  assiette: {
    source: 'bp3-engine/baseline-native/SCELLE.json → preuve.reproductibles_96',
    reference_native: `${scelle.reference} → ${native.version}`,
    n: ASSIETTE.length,
  },
  conditions_de_mesure: {
    oracle: 'bp3-engine/builds/v3.5.1-iso.1/bp3',
    empreinte: native.binaire_md5 ?? null,
    version_moteur: native.binaire ?? null,
    seed: native.seed ?? null,
    chaine: '.bps → compileToBPxAST → BPx (derive / produceAll) → Kairos (hauteur) → Kronos (temps)',
    comparateur: 'test/compare_modal.cjs — juge unique des deux voies',
    corpus_scenes: 'kanopi/packages/library/scenes/BPScript-tests',
    action_repliquee: 'la même que le natif : single (une réalisation, graine posée) ou '
      + 'produce-all (énumération), selon le champ `action` de la baseline native',
  },
  bilan: {
    scenes_presentes: compte((g) => g.scene_bps),
    scenes_absentes: compte((g) => !g.scene_bps),
    PLANTE: compte((g) => g.etat === 'PLANTE'),
    PRODUIT: compte((g) => g.etat === 'PRODUIT'),
    'PRODUCTION IDENTIQUE': compte((g) => g.etat === 'PRODUCTION IDENTIQUE'),
    hors_les_trois_etats: compte((g) => g.scene_bps && !g.etat),
  },
  grammaires,
};

console.log(`assiette ${ASSIETTE.length} · scènes présentes ${baseline.bilan.scenes_presentes} · `
  + `absentes ${baseline.bilan.scenes_absentes}`);
for (const [k, v] of Object.entries(baseline.bilan)) console.log(`  ${k.padEnd(22)} ${v}`);
const horsTrois = grammaires.filter((g) => g.scene_bps && !g.etat);
if (horsTrois.length) {
  console.log(`\n⚠️ HORS DES TROIS ÉTATS — remontés NOMMÉS, jamais rangés de force :`);
  for (const g of horsTrois) console.log(`  ${g.grammaire.padEnd(20)} ${g.hors_etats} — ${String(g.detail).slice(0, 100)}`);
}

if (process.argv.includes('--ecrire')) {
  fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
  fs.writeFileSync(SORTIE, `${JSON.stringify(baseline, null, 1)}\n`);
  console.log(`\n✅ scellée dans ${path.relative(RACINE, SORTIE)}`);
} else {
  console.log(`\n(lecture seule — --ecrire pour sceller dans ${path.relative(RACINE, SORTIE)})`);
}
