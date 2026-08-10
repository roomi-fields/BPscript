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
 * PRODUCTION_DIRECTIVES : noms des directives de production (instructions au
 * moteur sur COMMENT produire, pas des éléments de la grammaire).
 *
 * Surface canonique : `@clé:valeur` en tête de scène, préfixe optionnel — `@seed:42`,
 * `@engine.seed:42`, `@items:20`. Le bloc `[@…]` est REFUSÉ depuis le 2026-08-10.
 * (décision utilisateur 2026-06-11, hub/decisions/2026-06-11-directives-
 * production-crochets.md, incl. ADDENDUM — durcissement même jour ;
 * EBNF §production_block). Les @-formes historiques (`@seed:N`…) sont REJETÉES
 * à la compilation (ParseError, parser.js:2049-2054) : le message pointe la
 * nouvelle écriture `@seed:N`.
 *
 * Le routage nom→réglage moteur reste dans lib/settings.json (directive_map) ;
 * cette liste a deux usages distincts dans parser.js : rejeter les @-formes
 * historiques hors bloc (ParseError ci-dessus, parser.js:2049-2054) et avertir
 * (warn(), parser.js:1111-1112) quand une clé utilisée dans le bloc canonique
 * `[@...]` n'en fait pas partie.
 */
export const PRODUCTION_DIRECTIVES = Object.freeze([
  'maxitems', 'items', 'allitems', 'all_items', 'improvize',
]);
