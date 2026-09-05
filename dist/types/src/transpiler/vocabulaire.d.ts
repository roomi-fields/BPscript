/**
 * ⛔ CE BLOC EST ICI, ET PAS EN TÊTE DE FICHIER — c'est ce qui le rend LISIBLE PAR LA DÉRIVATION.
 *
 * Il y a vécu, complet et juste, séparé de sa fonction par les imports : il documentait pour un
 * lecteur humain et ne disait RIEN à l'outil. La description dérivée de ma porte rendait donc
 * `controls: {name}[]`, `components: {}`, `voices: any` — l'inférence prenait la forme la plus
 * ÉTROITE qu'elle voyait construire, et un consommateur ne pouvait pas distinguer « ce champ
 * n'existe pas » de « ce champ n'a pas été inféré ».
 *
 * ⚠️ MESURÉ PAR KANOPI À L'EXÉCUTION SUR CE QUE JE PUBLIE, jamais sur mon code — 25 erreurs chez lui
 * sur des champs qui EXISTENT tous. *Une dérivation ferme la divergence, elle ne fonde pas la
 * complétude* : elle est fidèle à la source, et la source ne portait pas l'information là où
 * l'outil la lit.
 *
 * @param {Array} [directives]  les directives de la scène (acteurs compris), ou rien.
 * @returns {{
 *   voices: string[],
 *   keywords: string[],
 *   controls: Array<{ name: string, args?: any[], range?: any, values?: any, value?: any,
 *                     description?: string, resolvedBy?: string }>,
 *   values: Array<{ name: string, range?: number[], unit?: string, values?: any, description?: string }>,
 *   functions: string[],
 *   components: { [axe: string]: string[] },
 *   addressKeys: string[],
 *   qualifierKeys: string[],
 *   directiveValues: { [directive: string]: { description?: string,
 *                      values: Array<{ name: string, description?: string }> } },
 *   syntaxWords: { [mot: string]: { kind: string, description?: string, syntax?: string } }
 * }}
 */
export function describeVocabulary(directives?: any[]): {
    voices: string[];
    keywords: string[];
    controls: Array<{
        name: string;
        args?: any[];
        range?: any;
        values?: any;
        value?: any;
        description?: string;
        resolvedBy?: string;
    }>;
    values: Array<{
        name: string;
        range?: number[];
        unit?: string;
        values?: any;
        description?: string;
    }>;
    functions: string[];
    components: {
        [axe: string]: string[];
    };
    addressKeys: string[];
    qualifierKeys: string[];
    directiveValues: {
        [directive: string]: {
            description?: string;
            values: Array<{
                name: string;
                description?: string;
            }>;
        };
    };
    syntaxWords: {
        [mot: string]: {
            kind: string;
            description?: string;
            syntax?: string;
        };
    };
};
