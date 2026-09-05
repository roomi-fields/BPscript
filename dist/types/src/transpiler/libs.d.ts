import { placesDesLibrairies } from './librairies.js';
/** Le registre, chargé s'il ne l'est pas encore. La seule porte de lecture. */
export function leRegistre(): {};
export function versionDuRegistre(): number;
export function brancherLeCompilateur(compiler: any): void;
/**
 * Load a lib by name, with optional subkey.
 * @file → lib/file.json (whole file)
 * @file.subkey → lib/file.json → entry from the top-level collection
 *
 * For alphabets.json: the collection key is "alphabets"
 * For sub.json: the collection key is "tables"
 * Generic fallback: tries the subkey directly on the root object
 */
export function loadLib(name: any, subkey: any): any;
export function directiveDeclareeParLaLibrairie(lib: any, nom: any): boolean;
/**
 * LA LIBRAIRIE `L` DÉCLARE-T-ELLE LA DIRECTIVE `nom` ? — lue dans la DONNÉE, jamais en dur.
 *
 * POURQUOI ELLE EXISTE. `loadLib(L, nom)` répond à une autre question : il cherche une ENTRÉE de
 * catalogue (`alphabet.sargam`), donc dans `alphabets`/`tables`/`objects`/racine. Une DIRECTIVE
 * ne vit dans aucun de ces champs — `tempo` est déclaré dans la section `subgrammar` d'`engine` —
 * si bien que `core.tempo:120` était refusé par le message « l'entrée n'existe pas dans la
 * librairie » alors que la librairie la déclare bel et bien, deux champs plus loin.
 *
 * CE QUE ROMAIN A TRANCHÉ (2026-08-09) : le préfixe est OPTIONNEL, il n'a jamais été INTERDIT, et
 * il vaut pour TOUTE paire librairie.directive — pas pour le seul tempo. C'est la contrepartie
 * exacte de la résolution par unicité du 2026-08-02 : le nom nu marche quand il est unique, le
 * préfixe nomme explicitement qui le déclare. La bible l'écrivait déjà (« le préfixe reste
 * écrivable partout, y compris là où un nom nu suffirait ») ; il n'était écrivable nulle part.
 *
 * ⚠️ SUIT LA CHAÎNE `apporte`, TRANSITIVEMENT (2026-08-10, mise en conformité des librairies).
 * `core` amène `engine` (lib/core.json `apporte`) : `core.seed:42` doit donc rester une
 * écriture valide de `seed:42` MÊME MAINTENANT QUE `seed` a déménagé dans `lib/engine.bpsl` —
 * le préfixe nomme le POINT D'ENTRÉE que l'auteur invoque, pas forcément le domicile final de la
 * clé. TRANSITIF depuis la scission de `controls.json` : `core` amène `controls`, qui amène à
 * son tour `expression`/`midi`/`audio`/`transpo` — `core.transpose:2` doit rester valide à
 * DEUX maillons de distance. `vus` protège d'un cycle d'`apporte` mal formé.
 */
/**
 * LES LIBRAIRIES QUI DÉCLARENT UN MOT — cherchées dans TOUT le registre, toutes sections, par la
 * portée déclarée ou par une clé d'adresse. Ce lecteur sert aux MESSAGES, jamais à l'acceptation :
 * un mot hors portée se refuse en nommant la librairie qui le déclare, et c'est ici qu'on la
 * trouve. Ce qu'une scène ACCEPTE se lit sur le contexte de ses invocations
 * (`loadLibsFromDirectives`, champs `portees`, `addressKeys`, `reservedDirectiveNames`), nulle
 * part ailleurs — principe 1 de Romain, 2026-09-02 : l'invocation met en portée ce qu'une
 * librairie déclare, et rien d'autre n'est en portée.
 */
export function librairiesQuiDeclarent(nom: any): any[];
/**
 * LE GROUPE D'UNICITÉ d'un mot — le nom du réglage qu'il pose, quand ce réglage ne se pose qu'une
 * fois par scène — ou `null`. Cherché dans TOUTES les librairies et TOUTES leurs sections, comme
 * les portées : la section range, la donnée déclare.
 *
 * ⚠️ UN GROUPE, PAS UN BOOLÉEN, et c'est le moteur qui l'impose : `_striated` et `_smooth` partagent
 * un seul compteur (`NotFoundNatureTime`, CompileGrammar.c:1545) parce qu'ils règlent la MÊME chose.
 * Un `unique:true` par mot aurait laissé passer l'un suivi de l'autre.
 */
export function groupeDUnicite(nom: any): any;
/**
 * L'axe nommé dans une invocation → le FICHIER qui le sert. Exporté parce que l'adresse produite
 * porte l'AXE (`sound.tabla_perc`) alors que la donnée vit sous le nom du FICHIER (`sounds`) :
 * qui veut remonter d'une adresse à sa librairie doit passer par ici. Recopier la table ailleurs
 * rouvrirait l'écart entre ce qu'on invoque et ce qu'on charge.
 */
export function fichierDeLAxe(axe: any): any;
/**
 * Résout un alphabet nommé pour une LIAISON D'ACTEUR (`actor X alphabet.<nom>`).
 *
 * POURQUOI CETTE FONCTION EXISTE. `loadLib('alphabet', nom)` ne connaît QUE le catalogue standard
 * (`alphabets.json`). Or une scène peut déclarer d'autres librairies d'alphabets — `test_alphabets`
 * en est une — et leurs entrées étaient alors INATTEIGNABLES depuis un acteur : la scène savait les
 * résoudre, l'acteur non. `tryKeyMap` est tombé exactement là (terminaux `a`/`b` de
 * `test_alphabets.abc`, inatteignables une fois passés par un acteur).
 *
 * On ne DUPLIQUE pas ces entrées dans `alphabets.json` : une donnée en deux exemplaires est
 * précisément le défaut qu'on élimine. On élargit la RÉSOLUTION, pas le catalogue.
 *
 * Ordre : le catalogue standard d'abord (il fait autorité), puis les librairies que la scène a
 * elle-même déclarées, dans leur ordre de déclaration. Rend `null` si rien ne porte ce nom.
 */
export function resolveActorAlphabet(nom: any, directives: any): any;
/**
 * Même résolution, mais elle rend AUSSI le fichier d'où l'entrée provient (`lib`) —
 * `null` quand c'est le catalogue standard.
 *
 * POURQUOI CETTE VARIANTE. `resolveActorAlphabet` répond « cet alphabet existe-t-il », ce qui
 * suffit à résoudre et à valider. Elle ne répond PAS à « d'où vient-il », et c'est précisément
 * ce que l'aval doit savoir : Kairos lit le domaine DÉCLARÉ DANS LE FICHIER et n'invente rien
 * (contrat bpx-kairos-arbre §2.1). Un nom nu comme `abc` ne dit pas son fichier — l'adresse
 * canonique `test_alphabets.abc`, si. Les deux fonctions posent donc la même question au même
 * endroit : dupliquer la recherche ici serait rouvrir l'écart entre validation et résolution.
 */
export function resolveActorAlphabetSource(nom: any, directives: any): {
    entry: any;
    lib: any;
} | null;
export function loadLibsFromDirectives(directives: any): {
    controls: {};
    controlMap: {};
    controlResolvedBy: {};
    controlsQualified: {};
    controlQualifiedResolvedBy: {};
    ambiguousControls: Set<any>;
    implementations: {};
    implementedInterface: {};
    controlNames: Set<any>;
    bp3NativeControls: Set<any>;
    seqPrefixControls: Set<any>;
    dispatcherOnlyControls: Set<any>;
    dualContextControls: Set<any>;
    subgrammarControls: Map<any, any>;
    noArgControls: Set<any>;
    bagOnlyControls: Set<any>;
    engineBagControls: Set<any>;
    runtimeBagControls: Set<any>;
    ruleAllowedControls: Set<any>;
    ruleScopeControls: Set<any>;
    componentControls: Set<any>;
    intervalControls: Set<any>;
    symbols: {};
    alphabetTerminals: never[];
    _libs: {};
    _alphabets: never[];
    _octaveConvention: null;
    transcriptions: {};
    valueRegistry: {};
    valueRegistryErrors: never[];
};
export function universeControlNames(): any;
/**
 * Register a single lib by name (e.g. "controls" → contents of lib/controls.json).
 */
export function registerLib(name: any, data: any): void;
/**
 * Register multiple libs at once.
 * @param {Object} libs - { name: data, ... }
 */
export function registerAll(libs: Object): void;
/**
 * Clear all registered libs and cache (for testing).
 */
export function clearRegistry(): void;
/**
 * LES NOMS DE TERMINAUX D'UN ALPHABET — un seul accès, pour tout le dépôt.
 *
 * ⚠️ POURQUOI UNE FONCTION ET NON DOUZE LECTURES. Le format des alphabets a été reformaté le
 * 2026-08-08 sur le prototype de `LANGUAGE.md` : la liste `notes` est devenue la collection
 * `terminals`, où chaque terminal porte ses clés — « un terminal est une chose entière »
 * (décision Romain, 2026-08-01). DOUZE sites lisaient `.notes` en dur ; les remplacer un par un
 * aurait laissé le prochain changement casser aux douze mêmes endroits, et il aurait fallu les
 * retrouver. Un seul accès, et le format ne se lit plus qu'ici.
 */
export function nomsDeTerminaux(alphabetLib: any): string[] | null;
export { placesDesLibrairies };
