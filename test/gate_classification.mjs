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
  // VIDE depuis le 2026-07-19 — et c'est une SUPPRESSION, pas un oubli.
  //
  // Les deux membres (`test_wasm_all.js`, `run_bpx_scenes.cjs`) ont été retirés sur décision de
  // Romain. Motif : la conformité se mesure contre le moteur NATIF (captures bp3-engine), pas
  // contre le WASM. `test_wasm_all.js` était une relique d'avant la refonte — il importait
  // `src/dispatcher/`, supprimé, et n'était de toute façon pas chargeable (du CommonJS dans un
  // paquet ESM). Il se PRÉSENTAIT comme une lane de conformité tout en étant incapable de
  // démarrer : le plus trompeur des codes morts, puisqu'il rassurait sur un axe qu'il ne
  // mesurait pas. `npm run guards:moteur` est retiré avec eux.
  //
  // La liste reste déclarée pour que le mécanisme survive : un futur test exigeant un binaire
  // construit devra y entrer, jamais être branché tel quel au portillon.
]);
/** Modules importés, jamais lancés — couverts par ceux qui les utilisent. */
export const MODULES = new Map([
  ['compare_modal.cjs', 'comparateur importé par voie_b_status et les mesures'],
  ['kairos_bridge.mjs', 'pont vers Kairos/Kronos, importé par les mesures'],
  ['resolve_bin.cjs', 'résolution du tag de binaire, importé par la lane moteur'],
  ['corpus.mjs', 'déclaration UNIQUE de où vit le corpus des 113 (bibliothèque Kanopi), importée par tous ses lecteurs'],
]);
/** Ce fichier-ci. */
export const MOI = 'run_guards.mjs';

/**
 * OUTILS À SEUIL — ils sortent toujours en zéro, c'est NOUS qui jugeons leur sortie.
 * Le seuil est un plancher constaté : il ne monte pas tout seul, mais il ne doit jamais
 * descendre sans qu'on le sache.
 */
export const SEUILS = [
  // VIDE depuis le 2026-07-19 — et c'est une conséquence, pas un oubli.
  //
  // Les deux outils qui vivaient ici (`scan_corpus.mjs`, plancher 13 FIDÈLE ;
  // `test_bp3_to_scene.cjs`, plancher 79 OK) mesuraient la fidélité du TEXTE BP3 émis.
  // La certification grammaire-texte est ABANDONNÉE (arbitrage Romain 2026-07-19 : « pour la
  // compatibilité bps/gr, la seule chose que je veux c'est que la PRODUCTION soit identique,
  // pas la grammaire »). Ces outils ont donc été supprimés avec l'encodeur qu'ils gardaient.
  //
  // La liste reste déclarée pour que le mécanisme de seuil survive : un outil qui imprime un
  // rapport et sort toujours en zéro devra y entrer, jamais être branché tel quel au portillon.
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

