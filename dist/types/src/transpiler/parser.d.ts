export function parse(tokens: any, opts?: {}): {
    type: string;
    directives: never[];
    defs: never[];
    init: null;
    actors: never[];
    scenes: never[];
    exposes: never[];
    vars: never[];
    inputs: never[];
    declarations: never[];
    backticks: never[];
    subgrammars: never[];
    soundPrototypes: null;
    soundAssignments: null;
    homomorphisms: never[];
};
/**
 * Erreur d'ANALYSE — et elle porte un CODE depuis le 2026-09-04.
 *
 * ⛔ POURQUOI. Le TEXTE d'un refus était la seule surface à laquelle un consommateur pouvait
 * s'accrocher, et elle n'était déclarée nulle part : kanopi y a perdu 11 bancs sur 939 par ma seule
 * TRADUCTION, kairos un banc sur une REFORMULATION — même porte, même cause, même étage, seule la
 * phrase avait bougé. *Un garde bâti sur la graphie d'un voisin mesure sa rédaction, jamais son
 * comportement* (kairos, 2026-09-04).
 *
 * ⇒ Le CODE est ce qui ne bouge pas. Le message vit dans `messages/<langue>.js` et il a le droit de
 *   changer souvent — c'est le but du catalogue, décision de Romain : « des codes d'erreurs, et
 *   sortir le texte du compilateur, le mettre à côté pour facilement faire des traductions ».
 *
 * ⚠️ ET LA POSITION RESTE DANS LE MESSAGE. `at line L:C` est ajouté ici, hors du catalogue : c'est
 * une donnée, pas une phrase, et la traduire n'aurait aucun sens.
 */
export class ParseError extends Error {
    constructor(code: any, params: any, token: any);
    code: any;
    token: any;
}
