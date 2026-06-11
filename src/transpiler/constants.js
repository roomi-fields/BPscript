/**
 * BPScript — constantes partagées transpileur
 *
 * BP3_OPERATORS : table identifiant→opérateur BP3.
 * Source unique partagée par parser.js et encoder.js.
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
 * PRODUCTION_DIRECTIVES : noms des directives de production (instructions au
 * moteur sur COMMENT produire, pas des éléments de la grammaire).
 *
 * Surface canonique : bloc `[@clé:valeur]` groupable — `[@seed:1, @items:20]`
 * (décision utilisateur 2026-06-11, hub/decisions/2026-06-11-directives-
 * production-crochets.md ; EBNF §production_block). Les @-formes historiques
 * (`@seed:N`…) restent lues avec avertissement de dépréciation.
 *
 * Le routage nom→réglage moteur reste dans lib/settings.json (directive_map) ;
 * cette liste ne sert qu'à la dépréciation des @-formes.
 */
export const PRODUCTION_DIRECTIVES = Object.freeze([
  'seed', 'maxitems', 'items', 'allitems', 'all_items', 'improvize',
]);
