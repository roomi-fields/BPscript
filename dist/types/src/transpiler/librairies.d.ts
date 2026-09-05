/**
 * POSE LA PROSE DES MARQUES SUR L'ARBRE, et refuse celle qui s'écrirait dans un sac.
 * @param {string} texte   la source telle qu'elle a été compilée — les lignes doivent concorder
 * @param {object} ast     l'arbre rendu par le compilateur, modifié sur place
 * @param {string} fichier le nom du fichier, pour les refus
 * @returns {number} le nombre de marques posées — un appelant qui compte refuse d'avoir posé zéro
 */
export function poserLesDescriptions(texte: string, ast: object, fichier: string): number;
/**
 * LIT TOUTES LES SOURCES ET LES MET AU REGISTRE, par point fixe.
 *
 * Les catalogues encore en JSON entrent d'abord, tels quels. Les sources écrites dans le langage se
 * compilent ensuite ; une source qui ne compile pas — parce qu'elle invoque en tête une librairie
 * pas encore construite — est reprise à la passe suivante. Une passe sans progrès nomme chaque refus.
 * Les corps `.ts` des fonctions digitales se rattachent à leur objet une fois la librairie construite.
 *
 * @param {Array} sources        ce que `sourcesDeLibrairie()` rend
 * @param {Function} compiler    `compileToBPxAST`
 * @param {Function} registerLib la porte d'entrée du registre
 */
export function chargerLesLibrairies(sources: any[], compiler: Function, registerLib: Function): void;
/**
 * L'EN-TÊTE d'un objet, tel qu'il est ÉCRIT : de sa première ligne à la parenthèse qui la ferme.
 */
export function enTeteEcrit(texte: any, nom: any): string | null;
/**
 * ⛔ LA CONCORDANCE SE JUGE SUR L'EN-TÊTE ÉCRIT — Romain, 2026-09-03 : « même si le corps est dans un
 * autre fichier il devrait reprendre EXACTEMENT le même en-tête ». C'est la vérification que le
 * compilateur C fait entre un prototype et sa définition. Les blancs ne comptent pas : le pli et
 * l'indentation sont de la mise en forme, et le langage le dit ailleurs.
 */
export function memeEnTete(texteRacine: any, texteCorps: any, nom: any): boolean;
/**
 * ⛔ LA CONCORDANCE — un en-tête repris dit la MÊME chose que sa déclaration, ou il est refusé.
 *
 * C'est la vérification que le compilateur C fait entre un prototype et sa définition. Comparer les
 * membres SANS le corps : ce que le fichier de corps ajoute est justement son corps.
 */
export function concorde(declaration: any, repris: any): boolean;
/**
 * LES PLACES DE CHAQUE LIBRAIRIE — publiées, parce qu'un consommateur ne peut pas les déduire.
 * Pour une source écrite dans le langage, elles sont CONNUES ; pour un catalogue encore en JSON,
 * elles sont déduites par la forme, et `_deduites` dit lesquels.
 * @param {object} registre  le registre, tel que `leRegistre()` le rend
 */
export function placesDesLibrairies(registre: object): {
    _deduites: string[];
};
