/**
 * BPScript — constantes partagées transpileur
 *
 * BP3_OPERATORS : table identifiant→opérateur BP3.
 * Source unique consommée par parser.js (encoder.js supprimé le 2026-07-19,
 * commit 1b974f5 — arbitrage Romain : PRODUCTION identique, pas la grammaire).
 * Exporter ici évite toute duplication / désynchronisation.
 *
 * Contexte (Encode.c:1316-1338, BP3main.h:126) :
 *   Code[3]='+', Code[5]=';', Code[21]='*'
 *   `star` → `*`  marqueur homomorphisme / wildcard
 *   `plus` → `+`  opérateur jonction/continuation
 *   `fin`  → `;`  terminateur de séquence
 *
 * Ces noms sont des opérateurs BP3, PAS des bols : ils ne doivent jamais
 * figurer dans l'alphabet. Le parser normalise les Symbol nodes vers les
 * noms canoniques dès la construction de l'AST.
 */
export const BP3_OPERATORS = Object.freeze({ plus: '+', fin: ';', star: '*' });

/**
 * ⚠️ `PRODUCTION_DIRECTIVES` VIVAIT ICI — RETIRÉE (étape 3, mise en conformité des librairies,
 * règle 5 : « aucun contrôle codé en dur dans le parseur »). C'était une liste FIGÉE de cinq noms
 * (maxitems, items, allitems, all_items, improvize), IMPORTÉE par `parser.js` mais plus CONSULTÉE
 * nulle part dans son corps — mesuré avant retrait (`grep PRODUCTION_DIRECTIVES src/ test/` :
 * zéro occurrence hors sa propre déclaration et son import mort). Les deux usages que son
 * commentaire décrivait (rejet des @-formes historiques, avertissement du bloc `[@...]`) ont été
 * remplacés depuis par des mécanismes lisant `lib/*.json` (`schema.reservedDirectives`,
 * `directive_map` de `lib/settings.json`) sans que l'import correspondant soit nettoyé. Les cinq
 * noms restent des directives VIVANTES — déclarées dans `lib/engine.json` schema.reservedDirectives,
 * scope `['scene']` — leur acceptation ne dépendait déjà plus de cette liste.
 */
