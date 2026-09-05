/**
 * UN REFUS, TEL QU'IL SORT DE LA PORTE.
 *
 * ⛔ LE `code` EST LA SURFACE, `message` NE L'EST PAS — c'est la règle que ce module entier porte,
 * et elle est ici pour qu'un consommateur la lise dans le TYPE et pas seulement dans la prose. Deux
 * voisins ont bâti sur la phrase et ont cassé sur une traduction.
 *
 * `line` est présente quand la faute se situe ; les champs restants sont ceux que le site de refus
 * a joints — ils varient par code, et c'est pourquoi la forme reste ouverte.
 *
 * @typedef {object} Diagnostic
 * @property {string} code    Identifiant stable du refus. C'est sur lui qu'on s'accroche.
 * @property {string} message Texte composé depuis le catalogue de la langue. Il bouge.
 * @property {number} [line]  Ligne de la source, quand le refus en porte une.
 */
/**
 * Le texte d'un diagnostic, ses trous remplis.
 *
 * ⛔ UN CODE ABSENT DU CATALOGUE LÈVE, IL NE REND PAS UN TEXTE APPROXIMATIF. Rendre le code brut
 * comme message ferait un refus muet qui a l'air d'un refus : le lecteur verrait une chaîne en
 * majuscules et chercherait une cause qui n'existe pas. Un catalogue incomplet est un défaut de
 * construction, et il se voit à la première exécution.
 *
 * ⚠️ ET UN TROU NON REMPLI LÈVE AUSSI. Un `{nom}` laissé tel quel dans un message publié est une
 * phrase qui ment sur ce qu'elle décrit — et elle ne rougit nulle part, parce qu'un message est
 * du texte pour un humain. C'est la forme la plus discrète du défaut : le refus est juste, sa
 * cause est juste, et l'auteur lit un accolade.
 */
export function texteDuDiagnostic(code: any, params?: {}): string;
/**
 * UN DIAGNOSTIC PRÊT À POUSSER — `{ code, message, line }`, et ce qu'on veut de plus.
 *
 * ⛔ UNE SEULE FORME POUR LE CANAL COLLECTÉ. Sans elle, chaque site répétait le code DEUX fois — une
 * pour le champ, une pour composer le texte — et un site qui choisit son code par une condition
 * l'écrivait quatre fois. Deux écritures d'un même fait divergent : c'est la porte par où un `code`
 * cesse de correspondre à son message, sans que rien ne rougisse.
 */
export function diagnostic(code: any, params: any, extra?: {}): {
    code: any;
    message: string;
};
/** Les codes que le catalogue déclare — pour qui inventorie, et pour les gardes. */
export function codesDeDiagnostic(): string[];
/**
 * UN REFUS, TEL QU'IL SORT DE LA PORTE.
 *
 * ⛔ LE `code` EST LA SURFACE, `message` NE L'EST PAS — c'est la règle que ce module entier porte,
 * et elle est ici pour qu'un consommateur la lise dans le TYPE et pas seulement dans la prose. Deux
 * voisins ont bâti sur la phrase et ont cassé sur une traduction.
 *
 * `line` est présente quand la faute se situe ; les champs restants sont ceux que le site de refus
 * a joints — ils varient par code, et c'est pourquoi la forme reste ouverte.
 */
export type Diagnostic = {
    /**
     * Identifiant stable du refus. C'est sur lui qu'on s'accroche.
     */
    code: string;
    /**
     * Texte composé depuis le catalogue de la langue. Il bouge.
     */
    message: string;
    /**
     * Ligne de la source, quand le refus en porte une.
     */
    line?: number | undefined;
};
