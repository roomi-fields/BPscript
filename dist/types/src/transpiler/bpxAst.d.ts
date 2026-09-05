export function resoudreSource(source: any, environnement: any): {
    ast: null;
    errors: never[];
    warnings: never[];
};
/**
 * LA PORTE — le VERDICT par-dessus l'étage de résolution.
 *
 * ⛔ UN COMPILATEUR QUI REFUSE NE LIVRE RIEN EN AVAL (décision Romain 2026-08-19). Ce qui établit le
 * succès est l'ABSENCE D'ERREUR, jamais la présence d'un arbre. Rust n'émet aucun binaire quand il
 * échoue, GCC aucun objet ; TypeScript peut émettre malgré les erreurs, c'est une OPTION, et celle
 * qu'on recommande est de ne pas le faire.
 *
 * ⚠️ CE QUE ÇA CORRIGE, ET C'ÉTAIT MUET. Un refus de SENS laissait sortir un arbre COMPLET et
 * plausible à côté des erreurs. BPx l'a mesuré sur les 51 clés de la structure : AUCUNE n'évoque un
 * état de compilation, donc rien ne distinguait l'arbre d'un refus de celui d'un succès. Trois de
 * ses refus ont dérivé sans un mot, sortie identique au témoin.
 *
 * ⛔ ET ÇA AVEUGLAIT MES PROPRES GARDES AVANT CEUX DES AUTRES : quatre de mes bancs affirmaient des
 * choses sur des scènes que ce compilateur refuse, verts depuis toujours. L'un d'eux était invalidé
 * par un cri posé le matin même, et le portillon est resté vert toute la journée.
 *
 * QUI A BESOIN DE L'ARBRE D'UN REFUS passe par `resoudreSource` — c'est l'étage, il est juste
 * au-dessus, et il ne refait aucun calcul.
 *
 * @param {string} source            La scène `.bps`, telle quelle.
 * @param {Environnement} [environnement]
 * @returns {ResultatDeCompilation}  `ast` est nul dès qu'`errors` porte quoi que ce soit.
 */
export function compileToBPxAST(source: string, environnement?: Environnement): ResultatDeCompilation;
export default compileToBPxAST;
/**
 * L'ARBRE D'UNE SCÈNE RÉSOLUE — les axes de premier niveau que cet étage écrit et relit.
 *
 * ⛔ LA FORME RESTE OUVERTE, ET C'EST UNE MESURE, PAS UNE PRUDENCE. `AST.md` porte la taxonomie
 * complète des nœuds ; ce qui se DÉRIVE ici est ce que ce fichier touche. Fermer la forme sur ces
 * seuls axes ferait de cette description une seconde autorité, plus pauvre que la première, et
 * l'écart ne rougirait nulle part.
 */
export type ArbreDeScene = {
    [axe: string]: any;
};
/**
 * LES DÉFAUTS QUE L'HÔTE PORTE — ce que la scène ne dit pas, et qu'il pose à sa place.
 *
 * Un axe absent ici laisse la scène décider seule ; un axe présent ne s'inscrit QUE si la scène ne
 * le déclare pas (`applyEnvironmentDefaults`). L'hôte ne recouvre jamais une déclaration.
 */
export type Environnement = {
    /**
     * Le métronome par défaut, en battements par minute.
     */
    tempo?: number | undefined;
};
/**
 * CE QUE REND UNE COMPILATION — un arbre, des refus, des avertissements.
 *
 * ⛔ LE VERDICT SE LIT SUR `errors`, JAMAIS SUR LA PRÉSENCE DE `ast`. C'est la règle que la porte
 * applique, et elle est ici pour qu'un consommateur la lise dans le type : `ast` nul signifie
 * qu'aucun arbre n'est livrable, et `errors` non vide signifie que la compilation a REFUSÉ.
 */
export type ResultatDeCompilation = {
    /**
     * L'arbre BPx, ou `null`.
     */
    ast: ArbreDeScene | null;
    /**
     * Les refus. Vide = la compilation a réussi.
     */
    errors: Diagnostic[];
    /**
     * Ce qui passe et mérite d'être dit.
     */
    warnings: Diagnostic[];
};
export type Diagnostic = import("./diagnostics.js").Diagnostic;
