/**
 * ⛔ LE REFUS DU SECOND ALPHABET DE SCÈNE EST SORTI — arbitrage de Romain, 2026-08-23 :
 * « un axe redéclaré se redéfinit : le dernier écrit gagne, Y COMPRIS `alphabet`. LE REFUS et le
 * premier-qui-tient sortent tous les deux. »
 *
 * ⚠️ ET SON JUMEAU D'ACTEUR EST SORTI DANS LE MÊME COMMIT, mais celui-ci a failli rester : ma frappe
 * ne visait que la clé d'acteur, et le refus de SCÈNE vivait ici, dans un autre fichier, sous un
 * autre nom. C'est le TÉMOIN POSITIF de Kanopi qui l'a montré — elle compilait une scène à deux
 * alphabets pour prouver que sa sonde savait voir le cas, et la scène a été refusée. Sans ce témoin,
 * je poussais un geste à moitié fait : le doublon autorisé chez l'acteur, refusé chez la scène.
 *
 * ⚠️ LE MOTIF, POUR LA PROCHAINE FOIS : « le même fait vivait à deux places, une seule était gardée »
 * était écrit dans le refus que je retirais. Je l'ai lu en le supprimant sans voir qu'il décrivait
 * l'endroit où l'autre moitié m'attendait.
 */
/**
 * PORTÉE SCÈNE — un alphabet déclaré par une LIBRAIRIE doit sortir sur l'axe `alphabet`.
 *
 * LE DÉFAUT QUE ÇA CORRIGE, mesuré : une scène qui écrit `test_alphabets.structural` déclare bien
 * un alphabet — `lib/core.json` le dit noir sur blanc, `test_alphabets` = « référence-librairie,
 * MÊME AXE CATALOGUE que `alphabet` ». Mais j'émettais la directive sous le NOM DE SA LIBRAIRIE, et
 * l'aval ne lit que `name === 'alphabet'` (`BPx/src/session.ts:2124`) : l'alphabet n'arrivait donc
 * jamais. `ames` sortait `scenePitch {alphabet:'western', …}`, `negative-context` sortait
 * `scenePitch {tokens:[…]}` — sans rien. Et pour Kairos, « scène sans alphabet » et « scène dont
 * l'alphabet ne m'est pas parvenu » sont indistinguables : il devinait, et donnait 440 Hz au
 * symbole STRUCTUREL `A` d'une grammaire qui se déclare « test de grammaire pure ».
 * Rayon mesuré avant correctif : 10 scènes sur 95, et TOUTES en `test_alphabets.X` — aucune scène
 * en `alphabet.X` n'était touchée.
 *
 * L'ADRESSE, PAS L'ARDOISE — même règle qu'en portée acteur (`emitActorLibRefs`) et même raison :
 * un nom nu n'est cherché que dans le catalogue STANDARD, donc il ne mènerait nulle part ; seule
 * l'adresse `<lib>.<entrée>` porte la provenance. `ast.libRefs` est le canal neutre du contrat
 * (bpx-kairos-arbre §2.1), et BPx le transporte tel quel jusqu'à `scenePitch.libRefs`
 * (`session.ts:2144`).
 *
 * La directive d'origine RESTE : ce n'est pas une ardoise, c'est la déclaration qui CHARGE la
 * librairie pour le pipeline interne (résolution d'acteur, validation des terminaux).
 */
/**
 * MÈTRE DE SCÈNE — la scène pose le DÉFAUT, la règle le RECOUVRE pour elle seule.
 *
 * Ce n'est pas un arbitrage neuf : c'est la CASCADE PAR PORTÉE qui gouverne déjà tout le langage
 * (`lib/controls.json` se déclare « layered by scope » ; `hub/decisions/2026-06-26-kai9-adresse-dans-
 * arbre.md:17-19` : « override sur les détails, EN CASCADE PAR PORTÉE » ; `LANGUAGE.md:103` emploie
 * la même formule pour le transport). Il n'y avait rien à inventer, seulement à retrouver.
 *
 * POURQUOI L'ÉMETTRE SUR LA RÈGLE plutôt que de laisser la directive de scène parler : le
 * consommateur lit le mètre dans les QUALIFICATIFS DE LA RÈGLE (BPx `loadGrammar.ts:4136-4143`,
 * `parseMeterSignature`), jamais dans les directives. Une directive de scène qui n'atteint aucune
 * règle n'atteint personne — c'était l'état mesuré : `meter:4/4` compilait et n'était consommé
 * par rien.
 *
 * Une règle qui porte déjà un mètre n'est PAS touchée : c'est le recouvrement.
 */
/**
 * ⛔ L'ÉTAGE DE RÉSOLUTION — ANALYSER puis RÉSOUDRE, sans rendre de verdict.
 *
 * Tous les langages ont trois étages : analyser, résoudre, vérifier. Les trois existaient ici et
 * tournaient à chaque compilation ; rien ne permettait de s'ARRÊTER au second. Cette fonction est
 * cet arrêt — elle n'ajoute aucun calcul, elle rend atteignable ce qui se faisait déjà.
 *
 * CE QU'ELLE REND, ET C'EST TOUTE LA DIFFÉRENCE AVEC LA PORTE :
 *   · la source NE PARSE PAS  → `ast: null`. Il n'y a pas d'arbre, personne ne peut rien en tirer.
 *   · la résolution REFUSE    → `ast` PRÉSENT, `errors` peuplé. Le refus de SENS est une INFORMATION
 *     SUR l'arbre, pas sa disparition.
 *
 * ⛔ POURQUOI CE SECOND CAS EXISTE. Un outil de migration, un formateur, un outil de renommage
 * travaillent sur du code que le compilateur refuse — c'est leur raison d'être. Le nôtre répare les
 * collisions définition/terminal, refusées depuis ac6fe6a : son entrée est PAR DÉFINITION une source
 * rejetée. Mesuré le 2026-08-20 : la même source rend une erreur par la porte et un arbre de seize
 * clés par le parseur — deux questions, deux réponses justes.
 *
 * ⚠️ ET IL NE SUFFIT PAS DE PARSER. Basculer l'outil sur `parse(tokenize(…))` seul fait tomber un
 * volet sur quatre : la détection de collisions a besoin d'annotations que la résolution POSE SUR
 * l'arbre — terminaux d'alphabet étendus, acteur attribué. La résolution ne s'applique pas À CÔTÉ du
 * parse, elle s'applique DESSUS. C'est ce qui fait de ceci un étage et non un chemin de service.
 *
 * @param {string} source            La scène `.bps`, telle quelle.
 * @param {Environnement} [environnement]
 * @returns {ResultatDeCompilation}  `ast` présent dès que la source PARSE, erreurs comprises.
 */
export function resoudreSource(source: string, environnement?: Environnement): ResultatDeCompilation;
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
