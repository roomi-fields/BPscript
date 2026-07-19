/**
 * CLASSIFICATION DES FICHIERS DE `test/` — source UNIQUE, partagée.
 *
 * Le lanceur (`run_guards.mjs`) s'en sert pour décider quoi exécuter ; le méta-garde
 * (`test_meta_garde.mjs`) s'en sert pour vérifier que rien n'échappe au gate. Les deux
 * lisent la MÊME déclaration : si elle était dupliquée, l'un finirait par autoriser ce que
 * l'autre interdit — la dérive qu'on a payée toute la journée, appliquée aux garde-fous.
 */
/**
 * LANE MOTEUR — exigent le moteur BP3 CONSTRUIT (`--bin`). Exécutés séparément
 * (`npm run guards:moteur`), jamais dans ce portillon : il doit tourner sur un clone frais.
 */
export const LANE_MOTEUR = new Map([
  ['test_wasm_all.js', 'intégration WASM complète : charge le moteur construit, un processus fils par scène'],
  ['run_bpx_scenes.cjs', 'joue les scènes contre le moteur WASM, prend --bin <tag>'],
]);
/** Modules importés, jamais lancés — couverts par ceux qui les utilisent. */
export const MODULES = new Map([
  ['compare_modal.cjs', 'comparateur importé par voie_b_status et les mesures'],
  ['kairos_bridge.mjs', 'pont vers Kairos/Kronos, importé par les mesures'],
  ['resolve_bin.cjs', 'résolution du tag de binaire, importé par la lane moteur'],
]);
/** Ce fichier-ci. */
export const MOI = 'run_guards.mjs';

/**
 * OUTILS À SEUIL — ils sortent toujours en zéro, c'est NOUS qui jugeons leur sortie.
 * Le seuil est un plancher constaté : il ne monte pas tout seul, mais il ne doit jamais
 * descendre sans qu'on le sache.
 */
export const SEUILS = [
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
export const HORS_PORTILLON = new Map([
  ['voie_b_status.mjs', 'mesure de conformité à la baseline native : plusieurs minutes, et son verdict est un CONSTAT à lire (20 ISO / 54 DIFF), pas une régression — au gate il rougirait en permanence pour un état connu'],
  ['audit_horloge.mjs', 'audit ponctuel des horloges natives : rapport de diagnostic, sans verdict binaire'],
  ['diff_families.mjs', 'classification mécanique des DIFF : outil d analyse, pas un garde'],
  ['nom_vs_hz.mjs', 'sonde de résolution nom↔fréquence : rapport, seuil non défini'],
  ['bp2_settings.cjs', 'inspection des réglages BP2 : utilitaire de lecture, aucune assertion'],
]);

