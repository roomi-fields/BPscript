/**
 * Toutes les références de librairie que l'arbre porte, où qu'elles vivent : la règle vaut à toutes
 * les profondeurs, et un `libRefs` posé demain sur un nœud neuf entrera sans qu'une ligne bouge ici.
 */
export function referencesDe(ast: any): {
    chaines: any[];
    mots: any[];
};
/** Chaque membre, à toute profondeur, dont la clé est un mot de famille et la valeur un nom. */
export function suivreLesMembres(membres: any, FAMILLES: any, noter: any): void;
/**
 * Pose `ast.librairies` : chaque objet invoqué, puis ce que ces objets nomment.
 * @returns {Array<{message: string}>} les fautes — une référence que la porte ne rend pas
 */
export function joindreLesLibrairies(ast: any): Array<{
    message: string;
}>;
