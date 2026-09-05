/**
 * Resolve actors for the AST.
 *
 * @param {Object} ast - parsed Scene AST (with actors[] and subgrammars[])
 * @returns {{ actorTable: Object, terminalActorMap: Object, errors: Array }}
 *
 * actorTable: { actorName → { alphabet, scale, sounds, transport, eval, symbols: string[] } }
 * terminalActorMap: { terminalName → actorName }
 */
export function resolveActors(ast: Object): {
    actorTable: Object;
    terminalActorMap: Object;
    errors: any[];
};
/**
 * Expand an alphabet lib into a set of terminal names.
 * Mirrors the logic in libs.js loadLibsFromDirectives (terminal generation).
 *
 * @param {Object} alphabetLib - alphabet entry from alphabets.json (has notes, alterations, octaves)
 * @returns {Set<string>} set of terminal names
 */
export function expandAlphabetTerminals(alphabetLib: Object, octavesOverride: any): Set<string>;
/**
 * L'ALPHABET HÉRITÉ PAR UNE SCÈNE — la cascade @core → scène, DÉFINIE UNE SEULE FOIS.
 *
 * ⚠️ POURQUOI CETTE FONCTION EXISTE, ET C'EST UNE FAUTE PAYÉE, PAS UN REFACTOR (2026-07-29).
 * Cette cascade vivait ICI et ne s'appliquait qu'aux acteurs DÉCLARÉS. L'acteur implicite, lui,
 * est fabriqué plus tard (`bpxAst.applyDefaultActor`) et naissait SANS alphabet — donc une scène
 * qui ne déclare aucune convention de notes sortait de chez moi avec un ensemble de terminaux
 * VIDE. Mesuré : 91 scènes sur 263 (bibliothèque Kanopi 279a533 + démos de ce dépôt).
 *
 * CE QUE ÇA COÛTAIT EN AVAL, et c'est le vrai dégât : tout ce qui demande « est-ce une note ? »
 * se taisait sur ces scènes — la règle d'unicité des noms comme le refus d'un terminal inconnu.
 * Un consommateur ne pouvait pas le savoir : un ensemble vide et un ensemble non calculé ont
 * exactement la même tête. Verdict de Romain (2026-07-29) : « ça ne devrait JAMAIS ARRIVER ».
 *
 * LE PRINCIPE N'EST PAS DE MOI — il est RATIFIÉ et daté : `docs/design/SCENE_DEFAULTS_CASCADE.md`
 * (Romain, 2026-07-04), « tout ce qu'une scène peut définir a un défaut, et ce défaut vit dans une
 * librairie », « un paramètre définissable n'est jamais inexistant ». Son étape 2 (étendre aux
 * autres axes) n'avait jamais été faite. L'AST SORT COMPLET : un consommateur n'a rien à compléter,
 * et surtout rien à DEVINER.
 *
 * LA SEULE ABSENCE LÉGITIME reste la hauteur OPAQUE (loi 35) : quand la scène invoque une identité
 * de hauteur par le canal neutre, l'alphabet n'est pas résolvable ici et Kairos le remplit. Poser
 * le socle @core par-dessus un composant invoqué serait le bug diapason du 2026-07-04 à l'envers.
 *
 * @returns {string|null} le nom de l'alphabet hérité, ou null si la hauteur est opaque
 */
export function alphabetHerite(ast: any): string | null;
/**
 * LA CONVENTION DE REGISTRES HÉRITÉE — même cascade, deuxième axe (2026-07-29).
 *
 * Elle sortait à vide dans 251 scènes sur 263, y compris quand la scène ÉCRIT `octaves.saptak`
 * noir sur blanc : la directive était lue par le validateur de terminaux et par PERSONNE d'autre,
 * donc l'arbre ne la portait nulle part. Deux définitions de « quels sont les terminaux ici » qui
 * ne lisaient pas les mêmes registres — la famille de défaut que je paie le plus souvent.
 *
 * ⚠️ ET LE SOCLE @core S'ARRÊTE ICI, DÉLIBÉRÉMENT, PARCE QUE C'EST MESURÉ. `defaults.components
 * .octaves` vaut `western`. L'appliquer à un alphabet qui ne déclare AUCUN registre le casserait :
 * `expandAlphabetTerminals` traite ce cas comme « notes nues » (« No octaves — raw notes, e.g.
 * tabla ») — les 39 terminaux de `tabla` deviendraient octaviés et aucune scène de tabla ne
 * reconnaîtrait plus ses propres frappes. L'absence de registres n'est donc PAS un trou : c'est
 * une VALEUR, et le document de cascade le dit à sa façon (« invoquer @alphabet.X recouvre
 * l'octavation »). Conséquence à reporter, pas à masquer : l'entrée `octaves` de @core n'est plus
 * atteignable une fois qu'un alphabet est toujours résolu — c'est une donnée morte, et l'arbitrage
 * de son sort appartient à Romain, pas à ce fichier.
 *
 * @returns {string|undefined} la convention de registres, ou undefined = notes nues (une VALEUR)
 */
export function octavesHerite(ast: any, alphabetKey: any): string | undefined;
/**
 * L'ACCORDAGE HÉRITÉ — il se LIT sur l'alphabet actif, qui le déclare.
 *
 * ⚠️ CETTE FONCTION EXISTE PARCE QUE J'AI REFUSÉ DE L'ÉCRIRE HIER, ET C'ÉTAIT LE BON REFLEXE.
 * @core porte `defaults.components.tuning: western_12TET`. Le poser sur une scène sargam ou
 * gamelan est une AFFIRMATION MUSICALE que je ne sais pas prouver — j'ai donc laissé l'axe à vide
 * sur 230 scènes et je l'ai escaladé plutôt que de trancher une question de sens par une
 * compilation. Réponse de Romain, verbatim (courrier du 2026-07-29) : « l'accordage par défaut de
 * chaque alphabet doit être DANS L'ALPHABET, c'est déjà géré, pas besoin d'accordage par défaut
 * dans core ».
 *
 * ⛔ ET LA CITATION DIT « PAS BESOIN », JAMAIS « JAMAIS ». Le titre de ce bloc a porté pendant trois
 * semaines « il vient de l'alphabet, JAMAIS du socle @core (Romain) » — un durcissement de MA main,
 * signé de SON nom et daté de son message. Romain répondait à ma réserve (je refusais de POSER une
 * valeur musicale) ; il disait que je n'ai pas à m'en servir, pas que l'entrée doit disparaître.
 * L'entrée `tuning` du socle reste, et cette fonction ne la lit pas : les deux tiennent ensemble.
 * Une citation exacte sous une phrase qui la durcit se relit comme une décision qui n'a pas été
 * prise — et c'est la faute la plus chère du dépôt, parce que personne ne rouvre le courrier.
 *
 * Donc je n'ai JAMAIS à poser cette valeur : je la LIS sur l'alphabet actif, qui la déclare
 * (`defaultTuning`). western → western_12TET, sargam → sargam_12TET, arabic → arabic_24TET,
 * turkish → turkish_53TET, bohlen_pierce → bohlen_pierce_equal, shruti23 → shruti23_native.
 * Trois alphabets n'en déclarent aucun (tabla, simple, shakuhachi) : la valeur reste ABSENTE, ce
 * qui est un FAIT porté par la donnée et non une ignorance de ma part.
 *
 * ⚠️ ET UNE ANOMALIE DE DONNÉE, MESURÉE, QUE JE NE CORRIGE PAS ICI : `shakuhachi` n'a pas de
 * `defaultTuning` alors que ses altérations `meri`/`kari` (menton bas / menton haut) SONT des
 * inflexions de hauteur. Son absence ressemble à un trou de donnée, pas à « cet alphabet ne
 * résout pas de hauteur ». Signalé à l'architecte ; se répare dans la librairie, pas par une
 * exception dans ce fichier.
 *
 * @returns {string|undefined} l'accordage effectif, ou undefined = l'alphabet n'en déclare pas
 */
export function tuningHerite(ast: any, alphabetKey: any): string | undefined;
/**
 * LA SORTIE HÉRITÉE — quatrième axe de la cascade, et le plus trompeur des cinq.
 *
 * ⚠️ CE QU'IL FAISAIT AVANT LE 2026-08-07, et pourquoi c'est pire qu'un trou. Les trois axes de
 * hauteur au-dessus sortaient ABSENTS quand la scène ne les écrivait pas — visible. La sortie,
 * elle, sortait PRÉSENTE et FAUSSE : l'acteur implicite recevait toujours `audio`, le défaut du
 * socle, même quand la scène écrivait `out.midi` noir sur blanc. Un consommateur ne pouvait pas
 * le savoir — une valeur par défaut et une valeur ignorée ont exactement la même tête. C'est le
 * mode d'échec MUET, celui qu'aucun garde ne signale parce que rien ne manque.
 *
 * Et l'écriture était refusée au parse depuis le 2026-08-04, ce qui masquait le reste : on ne
 * mesure pas la descente d'une directive qu'on interdit d'écrire.
 *
 * LA CASCADE, dans l'ordre : ce que la scène écrit (`out.midi(ch:1)`) → le raccord de sortie posé
 * sur l'alphabet (`alphabet.X:midi`, canon 2026-07-05) → le défaut du composant (`lib/core.json`).
 * Les deux premiers disent LA MÊME CHOSE par deux écritures ; s'ils se contredisent, on refuse en
 * les nommant tous les deux plutôt que d'en élire un en silence.
 *
 * @returns {{key: string, params: object, conflit: object|null}}
 */
export function sortieHeritee(ast: any): {
    key: string;
    params: object;
    conflit: object | null;
};
/**
 * LE LANGAGE D'ÉVALUATION HÉRITÉ — cinquième axe, et il ne descendait pas du tout.
 *
 * `eval.strudel` en tête de scène compilait et n'atteignait jamais l'acteur implicite : la
 * directive était lue par le validateur et par personne d'autre, exactement le défaut mesuré sur
 * les registres le 2026-07-29. Une scène sans `actor` qui déclare son interprète par défaut le
 * perdait entre le parse et l'arbre.
 *
 * ⚠️ ON NE MATÉRIALISE QUE CE QUI RÉSOUT, même règle que pour les registres : un interprète que le
 * catalogue ne connaît pas n'a aucune valeur effective à porter, et le cri reste sur la directive
 * plutôt que d'être répété sur sa copie.
 *
 * @returns {string|undefined}
 */
export function evalHerite(ast: any): string | undefined;
export function defaultActorTransport(ast: any): any;
