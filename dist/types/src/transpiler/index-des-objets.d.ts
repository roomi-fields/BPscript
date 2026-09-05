/** Les familles — les mots qu'on invoque — dans l'ordre du paquet. */
export function familles(): any[];
/**
 * Une famille : sa racine (membres propres) et ses entrées, dans l'ordre de la donnée.
 * Rend `null` quand aucune librairie ne déclare ce mot.
 */
export function famille(mot: any): {
    nom: any;
    membres: any;
    places: any[];
    entrees: any;
} | null;
/**
 * Résout un nom écrit comme une chaîne — `alphabet.western`, ou un suffixe non ambigu — vers l'objet
 * qu'il désigne. Rend l'objet ; `null` si rien ne porte ce nom ; `{ ambigu: [chaines] }` quand
 * plusieurs objets finissent par ce suffixe : l'ambiguïté se constate à l'usage, jamais par une liste.
 */
export function objet(chaine: any): any;
/** Tous les objets, à plat — pour qui inventorie. */
export function objets(): any[];
/**
 * ⛔ LE SCHÉMA DE `core` EST DISSOUS — arbitrage de Romain, 2026-09-03 (point 2 des cinq
 * arbitrages) : chaque champ vit sur l'objet qu'il décrit, ou se dérive. Rien n'est en portée sans
 * invocation, sauf la syntaxe. Les quatre lectures ci-dessous remplacent `leSchema()`.
 */
/** Les mots de la GRAMMAIRE — la syntaxe, par sa propre porte ; jamais une librairie. */
export function motsDeLaGrammaire(): Set<string>;
/**
 * LA FORME QU'UN MOT DE LA GRAMMAIRE ADMET — `seed:<N>`, `out.<canal>`, `def <nom> <corps>`. Elle
 * existe pour qu'un refus donne la RÉÉCRITURE au lieu de constater : un mot du langage écrit
 * autrement s'entend dire ce qu'il fallait écrire. Rend `null` quand la donnée ne la porte pas.
 */
export function formeDuMot(nom: any): string | null;
/**
 * Un mot RÉSERVÉ — un mot de la GRAMMAIRE, celui qu'un auteur ne peut jamais ombrer (décision du
 * 2026-08-21 : la grammaire, le socle, les librairies ; seule la première est inombrable). La liste
 * `reservedDirectives` du schéma de `core` mêlait ces mots-là et des mots de LIBRAIRIE (`transpose`,
 * `homomorphism`, `settings`…) ; ces derniers sont des familles du registre, et une famille se
 * reconnaît par `familles()`, jamais par une liste.
 */
export function motReserve(nom: any): boolean;
/**
 * LES AXES DE CATALOGUE — un prototype racine de `types` qui DÉCLARE la portée `scene` : ses
 * exemplaires s'invoquent en tête de scène, `alphabet.western`, `tuning.just`, `voice.wobble`.
 * C'est ce que la portée dit, et rien d'autre ne le dit : `temperament` a 174 entrées et ne
 * s'invoque pas directement (elle passe par un accordage), donc il ne déclare pas cette portée.
 * La liste `catalogAxes` du schéma de `core` est dissoute là-dedans (Romain, 2026-09-03).
 */
export function axesDeCatalogue(): any;
/**
 * LES CLÉS D'UN ACTEUR sont les membres TYPÉS du prototype `actor` de `types` (`alphabet alphabet`,
 * `destination out`…) : nom → type. Vide sans `types` au registre.
 */
export function clesDActeur(): Map<any, any>;
/**
 * LES CANAUX — les exemplaires du prototype `destination`, par nom : `{ audio: {out, writable,
 * params}, midi: {…}, … }`. La liste est FERMÉE parce que la donnée la porte. Un exemplaire se
 * reconnaît à son TYPE EN TÊTE (`destination midi (…)`), jamais à un nom de famille : il vit dans
 * la famille de la librairie qui le déclare.
 */
export function canaux(): {};
/**
 * Les défauts de scène — les membres de l'objet `components` (alphabet, tuning, transport, eval),
 * s'il est EN PORTÉE de la scène : sa librairie invoquée, directement ou par une autre. Sans scène,
 * le registre entier fait portée (le vocabulaire, l'éditeur).
 */
export function lesDefauts(ast: any): any;
/**
 * CE QU'UNE SCÈNE INVOQUE — les mots de ses invocations, et ceux que chaque librairie invoquée
 * invoque à son tour (`apporte`), jusqu'au bout. Ce qu'une librairie déclare est en portée quand elle
 * est invoquée, directement ou par une librairie qui l'invoque : c'est le principe d'invocation, le
 * même que le parseur applique aux types du socle. Il vaut pour les DÉFAUTS de scène : `core` déclare
 * un alphabet par défaut, effectif quand `core` est invoqué, surchargé par la scène ou l'acteur qui
 * déclare le sien (Romain, 2026-09-02).
 */
export function motsInvoques(ast: any): Set<any>;
/** Un objet par son nom, s'il est EN PORTÉE de la scène — sa famille invoquée — sinon `null`. */
export function objetEnPortee(nom: any, ast: any): any;
