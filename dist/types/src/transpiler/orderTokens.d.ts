/**
 * Tokenise une production canonique BP3 (sortie `-o`) en séquence ORDONNÉE.
 * @param {string} canonical - contenu brut de la sortie `-o` (une ligne en général).
 * @returns {string[]} jetons sonnants dans l'ordre de production.
 */
export function tokenizeOrder(canonical: string): string[];
export default tokenizeOrder;
