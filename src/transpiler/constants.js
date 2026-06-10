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
