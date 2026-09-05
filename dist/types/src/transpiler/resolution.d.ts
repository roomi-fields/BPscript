/**
 * RÉSOUT un arbre contre son environnement, et rend ce que l'étage suivant attend.
 *
 * Rend `{ ast, diagnostics, examines, greffes }` :
 *   · `ast`         l'arbre, univoque — le même objet, muté en place comme les autres passes
 *   · `diagnostics` le canal UNIQUE de refus. Vide tant que l'étage ne refuse rien.
 *   · `examines`    le nombre de nœuds traversés. **Un étage qui a examiné zéro n'a pas tourné**,
 *                   et c'est indiscernable d'un étage qui n'a rien trouvé : le compte est ce qui
 *                   sépare les deux.
 *   · `greffes`     le nombre de membres hérités posés. Même raison : un corpus sans dérivation et
 *                   une résolution morte ont la même empreinte, et seul ce compte les sépare.
 *
 * ⚠️ `environnement` EST REÇU ET PAS ENCORE LU. Il est dans la signature parce que c'est ce que cet
 * étage SAIT, par définition — le socle et les librairies invoquées. Il devient lisible quand un
 * prototype d'une autre source est atteignable, et pas avant.
 */
export function resoudre(ast: any, environnement: any): {
    ast: any;
    diagnostics: any[];
    examines: number;
    greffes: number;
};
export function emitSceneMeter(ast: any): void;
/**
 * UN GABARIT ESCLAVE REJOUE UN MAÎTRE, ET UN NOM QUE PERSONNE NE CAPTURE N'EN A AUCUN.
 *
 * `LANGUAGE.md` § « Capturer et rejouer » : « `$` capture un motif de groupe (maître), `&` le
 * rejoue (esclave). LE NOM PORTE L'APPARIEMENT ENTRE LES DEUX. » Un `&nom` sans `$nom` n'apparie
 * rien : il se lit comme un rejeu et ne rejoue aucun choix.
 *
 * ⛔ CE REFUS NE TRANCHE PAS LA PORTÉE DE L'APPARIEMENT, ET C'EST DÉLIBÉRÉ. Mesuré le 2026-08-29 :
 * un maître dans une règle et son esclave dans une AUTRE passent aujourd'hui, et la bible ne dit
 * pas si l'appariement vaut dans la règle ou dans la scène. Décider ici reviendrait à définir un
 * élément de langage. Les maîtres se collectent donc sur TOUTE la scène — la lecture la plus large,
 * donc le refus le plus prudent : ce qu'il rejette est faux dans les deux lectures.
 *
 * ⚠️ ET UNE SCÈNE QUI PORTE UNE ANCRE EST HORS DE PORTÉE. `$` seul en tête de membre gauche « marque
 * la règle entière comme gabarit maître » et « l'ancre reste ouverte jusqu'à sa fermeture » : elle
 * ouvre un maître SANS NOM, et rien n'écrit par quel nom un esclave le rejoue. Refuser là-dessus
 * serait supposer une réponse. 10 scènes du corpus en portent une.
 *
 * MESURE AVANT ÉCRITURE — 756 scènes compilables, 55 portent un gabarit : ZÉRO esclave orphelin.
 */
export function refuserEsclaveSansMaitre(ast: any): {
    code: any;
    message: string;
}[];
/**
 * LA VOIX D'UN TERMINAL ARRIVE JUSQU'À L'ARBRE — cascade terminal, puis alphabet.
 *
 * ⛔ ACTE DE ROMAIN, 2026-08-08 : « tout est dans les PROPRIÉTÉS DU TERMINAL — ou pas, et c'est
 * alors résolu par les principes d'override. Et `def`/`voice` doit AUSSI être correctement
 * implémenté dans TOUS LES ALPHABETS. »
 * C'est la suite directe de la décision du 2026-08-01 : « un alphabet est une collection
 * structurée de terminaux », et `voice` n'est PAS une clé d'acteur — c'est le terminal qui la
 * porte, et l'alphabet qui les organise.
 *
 * ⚠️ CE QUE ÇA DÉBLOQUE, ET C'EST UN AGENT ENTIER ARRÊTÉ DEPUIS QUATRE HEURES. Kairos assurait le
 * DISPATCH DU SON — quelle voix joue quel symbole — en lisant la table des macros ; `macro` sort
 * du langage, la table n'existe plus, et il n'a rien à la place. La réponse était déjà dans la
 * spécification ; c'est l'implémentation qui manquait.
 *
 * ⚠️ DEUX ALPHABETS DÉCLARENT DÉJÀ LEURS VOIX EN DONNÉE — `tabla` associe `dha` à `bayan_open`,
 * `tryCsoundObjects` ses sept objets — et RIEN NE LES LISAIT ICI : la seule occurrence de
 * `.voices` dans ce dépôt désigne les voix d'un groupe polymétrique, sans rapport.
 *
 * ⛔ J'AI ÉCRIT « CETTE TABLE N'EST LUE PAR PERSONNE », ET C'ÉTAIT FAUX. Kairos l'a mesuré et me
 * l'a rendu : il la lit depuis JUIN — `resoudre-voix.ts:121`, sa voie (b), avec un témoin
 * bout-en-bout à lui. La donnée n'était pas morte : elle alimentait sa résolution de voix.
 * J'avais mesuré MON dépôt et conclu pour LE SIEN — la faute exacte que je remonte aux autres,
 * et la seconde fois de la journée. Ce qui était vrai : rien ne la lisait CHEZ MOI.
 *
 * ⚠️ ET ÇA OUVRE UNE QUESTION QUE JE NE TRANCHE PAS, la sienne : NOUS SOMMES DEUX À RÉSOUDRE LE
 * MÊME BINDING, depuis la même table, avec des précédences DIFFÉRENTES — la sienne va de l'acteur
 * à l'alphabet, la mienne du terminal à l'alphabet. Un acteur qui nomme une voix et un alphabet
 * qui en nomme une autre ne donnent pas le même résultat selon le chemin. Aujourd'hui l'écart ne
 * se voit pas (il ne lit pas encore ce champ) ; le jour où il le lira, il se verra.
 * Question portée à Romain : QUI résout le binding d'alphabet. Les deux réponses se défendent ;
 * ce qui ne se défend pas, c'est les deux à la fois.
 *
 * L'ORDRE DE RÉSOLUTION, du plus local au plus général :
 *   1. le terminal le nomme lui-même   (`def ka  voice.sec`)
 *   2. son alphabet le nomme pour lui  (`alphabets.json`, table `voices`)
 * Un terminal qui n'est nommé nulle part ne reçoit RIEN — l'absence reste une absence, et l'aval
 * la lit comme telle. On n'invente pas une voix par défaut : ce serait le défaut invisible que la
 * cascade des valeurs de scène a coûté le 2026-07-04.
 */
export function poserLaVoixDesTerminaux(ast: any): void;
/**
 * Retire l'ardoise `alphabet` des SEULS acteurs qui portent une adresse — en TOUT DERNIER.
 *
 * POURQUOI SI TARD. `properties.alphabet` a deux lecteurs qu'il ne faut pas confondre : le
 * pipeline INTERNE de BPScript (résolution d'acteur, validation des terminaux), qui tourne
 * jusqu'au bout de `compileToBPxAST`, et l'AVAL. Retirer le champ à l'émission de l'adresse
 * couperait le premier ; le retirer ici ne touche que le second.
 *
 * POURQUOI LE CHAMP ET PAS SEULEMENT LA RÉFÉRENCE. Mesuré chez BPx : `pickActorAlphabet`
 * (`loadGrammar.ts:3694`) lit `properties.alphabet` D'ABORD et ne regarde `references[]` qu'à
 * défaut. Filtrer la seule référence ne changeait donc RIEN — Kairos criait la même collision,
 * au mot près. C'est cette voie v0.7 encore préférée qui portait l'ardoise jusqu'à lui.
 *
 * PORTÉE, mesurée et non supposée : les acteurs qui émettent une adresse, et EUX SEULS — un
 * sur tout le corpus des 95 aujourd'hui (`tryKeyMap`, acteur `bols`). Toutes les autres scènes
 * sortent octet pour octet identiques, ce qui est vérifié plus bas par le bilan inchangé.
 */
export function retirerArdoiseAlphabet(ast: any): void;
export function applyDefaultActor(ast: any): {
    code: any;
    message: string;
}[];
export function hasTempoDirective(ast: any): any;
/**
 * Inscrit les défauts d'ENVIRONNEMENT dans l'AST là où la scène ne déclare rien
 * (point 1, spec-ecriture-structure §A — décision archi validée Romain 2026-06-24).
 *
 * - Le défaut est inscrit EN DUR (pas une référence « va voir l'environnement plus
 *   tard ») : l'AST se suffit, le moteur dérive depuis une structure complète.
 * - Mécanisme GÉNÉRAL (un seul pour tout défaut), piloté par table.
 * - On ne câble QUE les défauts qui ont un vrai consommateur en aval (sinon on
 *   écrirait une cible que personne ne lit). Aujourd'hui : le TEMPO, lu par l'hôte
 *   et BPx via la directive `tempo` (Kanopi ; BPx loadGrammar). Les autres
 *   réglages (octave, division…) s'ajouteront ici dès que leur cible AST + lecteur
 *   seront définis.
 *
 * @param {object} ast  AST de scène (muté en place)
 * @param {{ tempo?: number }} [env]  défauts d'environnement portés par Kanopi
 */
export function applyEnvironmentDefaults(ast: object, env?: {
    tempo?: number;
}): void;
/**
 * Canonicalise UN contexte parser `{type:'Context', positive, symbols}` côté LHS.
 * Retourne `{inline: node}` (mécanisme A) ou `{remote: node}` (mécanisme B).
 * `line` : rule.line en tête, 0 en mi-LHS (réplique exacte de l'adaptateur).
 * `asRuleContext` : true en tête (forme contrat RuleContextAST, avec miroir
 * `symbols`), false en mi-LHS (ContextAST positionnel, sans miroir).
 */
export function canonicalizeLhsContext(ctx: any, line: any, asRuleContext: any): {
    inline: {
        type: string;
        name: any;
        negated: boolean;
        line: any;
        index?: undefined;
    };
    remote?: undefined;
} | {
    inline: {
        type: string;
        negated: boolean;
        line: any;
        name?: undefined;
        index?: undefined;
    };
    remote?: undefined;
} | {
    inline: {
        type: string;
        index: number;
        negated: boolean;
        line: any;
        name?: undefined;
    };
    remote?: undefined;
} | {
    remote: {
        type: string;
        side: string;
        positive: boolean;
        kind: string;
        elements: any;
        symbols: any[];
        line: any;
        negated?: undefined;
    };
    inline?: undefined;
} | {
    remote: {
        type: string;
        negated: boolean;
        elements: any;
        line: any;
        side?: undefined;
        positive?: undefined;
        kind?: undefined;
        symbols?: undefined;
    };
    inline?: undefined;
};
export function canonicalizeLhsElement(el: any): any;
export function canonicalizeRhsElement(el: any): any;
/**
 * Canonicalise les contextes de toutes les règles de l'AST (muté en place).
 * VIF (sûr, additif) : enrichissement des remotes de tête (double-émission).
 * GATÉ (Palier 4) : flip inline — tête/mi-LHS/RHS → atomes niés (P1-P4).
 */
export function canonicalizeContexts(ast: any): void;
export function ctxSymbolToElement(sym: any, line: any): {
    type: string;
    line: any;
    index?: undefined;
    name?: undefined;
} | {
    type: string;
    index: number;
    line: any;
    name?: undefined;
} | {
    type: string;
    name: any;
    line: any;
    index?: undefined;
};
/**
 * Enrichit SUR PLACE une entrée REMOTE de rule.contexts : double-émission
 * `elements` TYPÉS (canonique) + `symbols`/`positive` conservés (le BPx vivant
 * ne lit qu'eux), ORDRE et position inchangés (rien ne bouge → prérequis P2/P3
 * non concernés). `side` est OMIS : il dépend de la position du remote dans la
 * séquence finale (un remote de tête est un contexte DROIT quand le motif est
 * vide, cf. P2) — à calculer au flip Palier 4 ; le défaut de contrat ('left')
 * s'applique en attendant. Les entrées de catégorie INLINE (#X, #?, #?N —
 * mécanisme A) restent BRUTES : leur forme canonique est l'atome nié dans le
 * LHS, qui n'est émissible qu'au flip (P1-P4).
 */
export function enrichRemoteHeadContext(ctx: any, line: any): any;
/**
 * Des TROIS façons dont un canal peut être fautif, laquelle ? Le catalogue des canaux est la seule
 * source ; aucun nom n'est écrit ici. Rend `null` quand le canal est bon — c'est alors une vraie
 * faute de terminal.
 */
export function canalFautif(canal: any): string | null;
/**
 * LE RECENSEMENT DES NOMS DÉCLARÉS — non-terminaux, définitions, scènes, homomorphismes, motifs
 * temporels, variables de travail.
 *
 * ⚠️ IL EST PARTAGÉ PAR LA VALIDATION ET PAR LA SEGMENTATION, et le partage est le fond du geste :
 * la segmentation doit ÉPARGNER ces noms. Un non-terminal qui s'appelle `taka` n'est pas un mot
 * collé de l'alphabet — le découper le ferait disparaître de sa propre grammaire, sans un signe.
 * Deux recensements côte à côte divergeraient au premier nom ajouté à l'un.
 */
export function nomsDeclares(ast: any): Set<any>;
/**
 * GARDE DE VOCABULAIRE DES APPELS `nom(…)` (chantier `_script`, GO Romain 2026-07-26).
 *
 * Un nom SUIVI D'UNE PARENTHÈSE n'est un CONTRÔLE que s'il est déclaré dans `controls.json`
 * (parser.js:3315 `isControlName`) ; sinon le parseur en fait un `SymbolCall`, c'est-à-dire un
 * TERMINAL SONNANT porteur de paramètres. Ce chemin n'était contrôlé par rien : un nom absent de
 * tout vocabulaire traversait la chaîne en silence, avec `payload.nature:'sounding'` — mesuré le
 * 2026-07-25 (`foobar(3)` accepté, 0 erreur) et re-mesuré le 2026-07-26 après le retrait de
 * `runtime.midi.script` : 3 des 5 scènes qui l'emploient compilaient toujours sans un mot.
 *
 * DEUX CRITÈRES, tous deux issus de la donnée — ni liste en dur ni cas particulier : `script`
 * tombe parce qu'il n'est plus DANS LA DONNÉE, pas parce qu'un test le nomme.
 *
 *  (a) VOCABULAIRE — le nom d'un appel se valide comme un symbole nu : alphabets en portée,
 *      non-terminaux, déclarations. Exige un alphabet en portée, exactement comme la validation
 *      des symboles nus : sans alphabet déclaré, le compilateur ne PEUT PAS savoir ce qui est un
 *      terminal, et juger quand même produit un faux refus (mesuré : `sitar -> C4 C4(ch:5)`,
 *      fragment sans alphabet, refusé à tort).
 *
 *  (b) FORME DE L'ARGUMENT — `()` porte une annotation `clé:valeur` sur l'événement (CLAUDE.md,
 *      « instructions runtime »). Un argument POSITIONNEL sur un nom qui n'est pas un contrôle
 *      déclaré n'annote rien : c'est un APPEL DE FONCTION, et le langage n'en a pas. Ce critère
 *      ne dépend d'aucun alphabet, ce qui referme le trou des scènes qui n'en ont pas (koto3,
 *      scène à gates, passait indemne par (a) seul). Mesuré sur les DEUX corpus consommateurs
 *      (Kanopi BPScript-tests + BPx test/scenes) : le seul appel à argument positionnel est
 *      `script` (7 occurrences) ; tous les autres sont entièrement nommés.
 *
 * Le message CITE l'appel tel qu'écrit (exigence de l'ordre [936]) : un utilisateur qui a écrit
 * `script(MIDI program 5)` doit lire sa propre ligne, pas un nom de nœud d'AST.
 */
export function validateCallVocabulary(ast: any, known: any, declared: any, codeVoice: any, anyAlphabet: any): any[];
/**
 * Les terminaux de TOUS les alphabets effectifs de la scène — UNE seule définition.
 *
 * Deux gardes en ont besoin et posent la MÊME question : « ce mot est-il une note ici ? ».
 * `validateTerminals` la pose sur un mot écrit dans une règle ; la garde des noms de macro la pose
 * sur un nom déclaré. Dupliquer le calcul, c'est se garantir qu'un jour l'une acceptera ce que
 * l'autre refuse — la dérive qu'on paie ailleurs, appliquée aux garde-fous eux-mêmes.
 *
 * « Effectif » = l'alphabet de la scène ET celui de chaque acteur. Les deux formes comptent :
 * décorée du registre (`madhya_sa`) et nue (`sa`), parce que les deux s'écrivent.
 */
export function terminauxEnPortee(ast: any): {
    terminaux: Set<any>;
    aUnAlphabet: boolean;
    paquets: any[];
};
export function validateTerminals(ast: any): any[];
export function emitSceneLibRefs(ast: any): void;
export function deriveAlphabetFromTuning(ast: any): void;
/**
 * PROVENANCE DES LIAISONS D'ACTEUR → `actors[].libRefs` (contrat bpx-kairos-arbre §2.1).
 *
 * LE TROU QU'ELLE COMBLE. Une liaison d'acteur sort en NOM NU : `actors.bols.alphabet = 'abc'`.
 * Ce nom ne dit pas d'où il vient. Tant que l'entrée est au catalogue standard, l'aval s'en
 * sort — il la retrouve par son nom. Mais quand elle vient d'une librairie DÉCLARÉE PAR LA
 * SCÈNE (`test_alphabets.abc`), le nom nu est une impasse : Kairos ne connaît pas `abc`, et
 * il ne DOIT pas le deviner — il lit le domaine déclaré DANS le fichier, il ne l'infère jamais
 * d'une adresse. Sans provenance, sa seule issue serait de renifler, c'est-à-dire d'inventer.
 *
 * CE QU'ELLE ÉMET, et rien de plus. L'adresse canonique `<fichier>.<entrée>`, UNIQUEMENT quand
 * l'entrée vient d'une librairie déclarée par la scène. Une liaison servie par le catalogue
 * standard n'émet RIEN : elle se retrouve déjà par son nom, et lui poser une adresse ferait du
 * bruit là où il n'y a pas de question. Champ OMIS si vide, jamais `[]` (patron `cvInstances`).
 *
 * POURQUOI CE N'EST PAS LE MIROIR DE LA PORTÉE SCÈNE. `ast.libRefs` naît des invocations par
 * provenance (`factory.` / `mine.`) — mesuré sur le corpus des 95 : ZÉRO scène en émet. Le
 * canal existe et il est testé (`test_libref_provenance.js`), mais aucune scène ne l'emprunte.
 * Rien à recopier vers l'acteur, donc : l'adresse ne se transporte pas d'en haut, elle se
 * DÉRIVE de la résolution — d'où `resolveActorAlphabetSource`, qui répond « d'où vient-il »
 * là où le résolveur répond « existe-t-il ».
 */
export function emitActorLibRefs(ast: any): void;
/**
 * L'ARBRE DIT LUI-MÊME QUELS NOMS SONT DES NOTES — `ast.noteTerminals`.
 *
 * ORDRE de l'architecte (2026-07-29), sur une règle que Romain venait de graver le matin même
 * (`hub/decisions/2026-07-29-notre-mecanique-n-utilise-que-des-alphabets.md`) : « notre mécanique
 * ne doit utiliser QUE des alphabets ; les conventions ne doivent être connues QUE du frontend
 * BP3 ». Et sa consigne pour ici : l'arbre porte LE FAIT, pas un nom d'alphabet que le
 * consommateur devrait interpréter.
 *
 * ⚠️ POURQUOI CE N'EST PAS UNE FORME QUE J'INVENTE — je n'ai pas à décider du formalisme du
 * langage (règle gravée par Romain le 2026-07-29). Le champ EXISTE, ratifié et daté :
 * `hub/decisions/2026-07-28-le-fait-ce-nom-est-une-note-vient-du-frontal.md` le définit pour
 * bp3-frontend — liste PLATE de noms nus, au niveau SCÈNE, ABSENT ≠ VIDE, contenant « les noms
 * présents dans la scène qu'il reconnaît comme notes : pas le catalogue, pas une table, la
 * résolution DÉJÀ FAITE ». On généralise ce champ, on n'en crée pas un second.
 *
 * CE QUE ÇA RETIRE À L'AVAL, et c'est la raison d'être : Kanopi interrogeait un prédicat à TROIS
 * conventions BP3 (anglaise, française, indienne). La bibliothèque déclare DOUZE alphabets —
 * gamelan_pelog, shruti23, bohlen_pierce et shakuhachi n'ont AUCUNE image dans ces trois-là. Un
 * consommateur qui pose la question porte donc une décision sémantique qui ne lui appartient pas,
 * et qui n'a pas de réponse pour les trois quarts du catalogue. Ici elle en a une, toujours :
 * c'est moi qui possède les alphabets.
 *
 * ABSENT ≠ VIDE, et la distinction porte du sens :
 *   · champ ABSENT  = aucun alphabet résolvable ici (hauteur opaque, voix-code pure) — je ne sais
 *     PAS, et l'aval ne doit pas lire mon silence comme « aucune note » ;
 *   · liste VIDE    = un alphabet est en portée et AUCUN nom de la scène n'est une note. C'est un
 *     fait, pas une ignorance.
 */
export function emitNoteTerminals(ast: any): void;
/**
 * Résolution de l'invocation d'homomorphisme par SYMBOLE NU (ratifié Romain 2026-07-17).
 * Un Symbol de RHS dont le nom = une section d'homomorphisme chargée (@homomorphism.<X>),
 * et qui n'est NI un non-terminal (LHS de règle) NI un terminal d'alphabet en portée
 * (précédence RATIFIÉE terminal > règle > homo, contrat bpscript-bpx L31), devient un
 * MARQUEUR per-occurrence : on pose `role:'homomorphism'` sur le nœud (type Symbol conservé,
 * il reste un élément positionnel du flux). BPx compte les occurrences en portée (profondeur
 * k) et applique chains[note][k-1] (ou les paires). La RÉPÉTITION du symbole EST la
 * profondeur — aucun index posé ici. Passe BPx-ONLY : jusqu'à la suppression de
 * compileBPS le 2026-07-19 (commit 1b974f5), le chemin BP3 hérité reparsait
 * indépendamment et ne voyait jamais ce champ → byte-id préservé.
 * Cf. AST.md §HomomorphismDeclAST, message bpx [464].
 */
export function resolveHomomorphismMarkers(ast: any): void;
/**
 * Annote les backticks (voix de code) SUR LE NŒUD — pas de table parallèle (directive
 * Romain 2026-06-17, confirmée BPx + Kanopi). Chaque nœud backtick porte :
 *   - `_btName` : étiquette unique (compteur PROPRE, ordre du document, indépendant de
 *     l'ancien format). C'est le NOM du terminal dérivable, lu par BPx (loadGrammar.ts) ;
 *     identité STRUCTURELLE en tête de nœud.
 *   - `code`    : déjà posé par le parser.
 *   - `payload` : DONNÉE D'ÉVÉNEMENT de la voix de code (KAI-9, point de bascule unique aligné
 *     bpx + Kairos) — `{ nature:'code', interp }`. L'`interp` est l'interpréteur : tag explicite
 *     (`sc: …`, `py: …`) sinon 'auto' ; un backtick NON tagué hérite de l'`eval` de l'acteur en
 *     tête de sa règle (`actor drums eval.strudel` → 'strudel'). Scellé DANS LE PAYLOAD (pas en
 *     tête de nœud) : c'est ce qui VOYAGE dans la dérivation jusqu'à Kairos, qui matérialise
 *     event.output = { runtime:'code', device:interp }. BPx porte le payload opaque ; Kairos le lit.
 */
export function annotateBackticks(ast: any): any[];
/**
 * POSE LE DESTINATAIRE DE CHAQUE RÉGLAGE SUR LE SAC QUI LE PORTE.
 *
 * CE QUE ÇA RÉPARE. Un sac de réglages voyageait avec sa NATURE et sa PORTÉE, jamais avec sa
 * DESTINATION : `!(vel:50)` arrivait en aval indistinguable de `!(chan:3)` et de
 * `!(transpose:3/2)`, alors que les trois vont à trois outils différents — toutes les sorties, le
 * runtime MIDI, Kairos. Seul le NOM de la clé les séparait, donc tout consommateur devait
 * redeviner la destination avec une table recopiée chez lui. Une table recopiée dérive : le jour
 * où une clé change de librairie, rien ne rougit et le réglage part au mauvais destinataire SANS
 * ERREUR. L'information existait pourtant depuis toujours, dans le champ `resolvedBy` de la
 * librairie déclarante — elle s'arrêtait au chargeur.
 *
 * LA FORME EST UNE TABLE, PAS UNE VALEUR, et la mesure l'impose : un sac unique peut mélanger
 * les destinataires — `!(vel:50, transpose:3/2, volume:90)` en réunit trois. Une valeur seule
 * aurait donc obligé à en choisir une et à taire les autres. `resolvedBy` est parallèle à
 * `params`, clé pour clé.
 *
 * LE NOM EST CELUI DE LA SOURCE, délibérément : la librairie écrit `resolvedBy`, le sac écrit
 * `resolvedBy`, la valeur est portée VERBATIM. Aucune traduction, donc aucune table de
 * correspondance à tenir entre deux vocabulaires.
 *
 * ⚠️ CE QUI N'EST PAS ANNOTÉ EST UNE ABSENCE ASSUMÉE, JAMAIS UNE INVENTION. Un contrôleur nommé
 * par la scène (`cc mon_nom:98`) n'est déclaré par aucune librairie : il n'a pas de destinataire
 * lisible, et sa clé reste donc hors de la table plutôt que d'en recevoir un supposé. Le trou est
 * visible, ce qui est le but.
 */
export function poserLeDestinataireDesReglages(ast: any, libCtx: any): void;
/**
 * ⛔ UN POINT D'ATTENTE NOMME CE QU'IL ATTEND, ET CE NOM SE DÉCLARE.
 *
 * DÉCISION DE ROMAIN, 2026-08-15 : « oui il doit être déclaré, sinon on ne sait pas ce qu'on
 * attend ». La forme de déclaration existe depuis le 2026-08-04 — `var <nom> in.<canal>` — et
 * c'est son EXIGENCE qui manquait, pas sa graphie.
 *
 * CE QUI PASSAIT : `<!depart` et `<!depatr` étaient deux points d'attente valides et sans rapport,
 * en silence. Une coquille ne casse rien — elle fabrique une seconde attente que rien ne viendra
 * jamais satisfaire, et la dérivation s'arrête pour toujours sans un mot.
 *
 * ⛔ LE REFUS PORTE SUR LA RACINE, ADRESSÉE OU NON — une seule règle, pas deux. Dans `<!p.60`, `p`
 * est le RÔLE et `.60` est l'ADRESSE : c'est `p` qui se déclare, jamais l'adresse
 * (`LANGUAGE.md:1517` : « l'adresse de la source se colle au point d'attente — `<!sync1.60` écoute
 * le numéro 60 de l'entrée `sync1` »). Romain, même jour : « bien oui, sinon comment on sait ce
 * qu'est `p` ? ».
 *
 * CE QUI COMPTE COMME DÉCLARATION : tout ce qui CRÉE le nom dans la scène — une entrée
 * (`var <rôle> in.<canal>`), une variable de travail, une déclaration de porte ou de trigger, un
 * acteur. On ne restreint pas à la seule entrée : la question est « ce nom existe-t-il », pas
 * « par quel mot ».
 *
 * ⛔ DEUX RACINES, ET CE NE SONT PAS DEUX FORMES RIVALES — arbitrage de Romain, 2026-08-15 : « un
 * point de synchronisation, dans tous les cas, attend un ÉVÉNEMENT. Un événement peut être
 * déclenché par une infinité de choses. » La DÉCLARATION dit D'OÙ ça vient, la QUALIFICATION dit
 * QUOI exactement, et ce sont deux questions :
 *     <!sync1                        tout événement de `sync1` lève le point
 *     <!sync1.60                     seulement l'adresse 60
 *     <!in.midi(note:60, channel:3)  pleinement qualifié, sans passer par un rôle
 * La racine est donc SOIT un rôle déclaré, SOIT une DIRECTION — et une direction n'a rien à
 * déclarer, elle nomme le canal lui-même. La liste des directions se lit dans la DONNÉE (les mots
 * de direction du socle) : aucun nom n'est écrit ici, et le jour où une direction s'ajoute, ce
 * refus la suit sans une ligne.
 */
export function refuserAttenteNonDeclaree(ast: any): {
    code: any;
    message: string;
}[];
/**
 * GARDE — UN SEUL ESPACE DE NOMS. Rien ne peut porter le nom d'autre chose.
 *
 * Règle de Romain (2026-07-28) : « il ne faut AUCUNE AMBIGUÏTÉ POSSIBLE. RIEN ne peut avoir des
 * noms identiques. À chaque fois qu'on déclare un truc dont le nom existe déjà, ça doit être
 * signalé par une ERREUR. »
 *
 * ⚠️ LE CRITÈRE EST L'EFFET, JAMAIS LA FORME DE LA LIGNE. Ce qui est refusé, c'est ce qui CRÉE un
 * nom. Une écriture qui pose une PROPRIÉTÉ sur un nom existant reste permise — `gate Sa:sc` dit
 * le type temporel et le routage d'un terminal, elle ne crée aucun nom rival : mesuré, le nœud
 * produit est identique avec et sans elle. Un garde qui filtrerait sur « ça commence par une
 * directive » refuserait cette forme ratifiée et laisserait passer une tête de règle ambiguë.
 *
 * DEUX ÉNONCÉS, TOUS DEUX GLOBAUX — aucune portée, et c'est mesuré, pas supposé :
 *   A. une TÊTE DE RÈGLE ne peut porter le nom d'aucune AUTRE SORTE de chose (terminal de
 *      l'alphabet actif, macro, alias, entrée, acteur, variable de travail, scène, objet CV,
 *      DRAPEAU) ;
 *   B. deux déclarations qui CRÉENT un nom ne peuvent pas porter le même, ni le nom d'un terminal.
 *
 * ⚠️ CE QUI N'EST PAS DEDANS, ET C'EST LA MOITIÉ DU TRAVAIL : les têtes de règle ne se heurtent
 * JAMAIS entre elles. Une tête répétée n'est pas un conflit, c'est une ALTERNATIVE — le choix et
 * les poids, c'est-à-dire le mécanisme même d'une grammaire stochastique ; et deux sous-grammaires
 * sont des PASSES successives, pas des espaces parallèles, donc un même nom y est le même symbole
 * réécrit plus tard. Un témoin de garde m'avait été prescrit qui refusait ce cas : mesuré, il
 * aurait refusé 120 scènes sur 333. C'est en le mesurant qu'il est tombé, pas en le relisant.
 *
 * ⚠️ UN DRAPEAU CRÉE UN NOM, DEPUIS LE 2026-07-30 (Romain, `hub/decisions/2026-07-30-trois-
 * arbitrages-nature-fabrique-drapeaux.md`) : « les drapeaux doivent être inclus dans l'espace de
 * déduplication des noms ». C'était un TROU, pas un espace séparé légitime — mesuré sur les 272
 * scènes du corpus : 3 portent un drapeau, toutes nommées `section`, zéro homonymie, donc le
 * corpus ne bouge pas en fermant le trou. Ce qui crée le nom, c'est le drapeau LUI-MÊME
 * (`var section flag: …`, ex-`flag section: …` — la forme de tête de scène est tombée le
 * 2026-08-05), PAS ses états : `calm`/`full` dans `var section flag: calm:1, full:2` ne sont
 * que des étiquettes internes au drapeau, jamais des noms globaux — les y faire entrer
 * déborderait la règle. Une LECTURE du drapeau (`[section==calm]`, une mutation `[section=full]`)
 * n'en crée pas non plus : comme `declarations` (gate/trigger/cv), c'est une propriété posée sur
 * un nom existant, pas une création.
 */
export function refuserNomsEnDouble(ast: any, libCtx: any): {
    code: any;
    message: string;
}[];
/**
 * SCENE_VALUES (hub [293], design docs/design/SCENE_VALUES_OVERRIDE.md §3.4) — pli de
 * la cascade STATIQUE des valeurs de librairie dans la déclaration d'acteur, conforme
 * AST_SPEC §0.1 (« le frontend plie la cascade statique ; un token ne recopie jamais
 * la config complète »). Pour chaque valeur du registre (ex. diapason) :
 *   effectif = params d'entité acteur (tuning.X(diapason:432))
 *           ?? valeur de scène (@diapason:442)
 *           ?? défaut du composant référencé (spec.componentDefault, ex. le champ
 *              diapason du tuning choisi) ?? spec.default
 * → actors[i].values = { nom: effectif } (champ absent si rien). L'occurrence
 * (diapason:428) reste sur payload.params (canal existant, domaine validé ici).
 * BPx porte values OPAQUE (ActorEntry) — DISTINCT de transport.params (adresse, KAI-9).
 * @returns {Array<{message, line?}>} erreurs (domaine, forme, noms inconnus)
 */
export function applySceneValues(ast: any, libCtx: any): Array<{
    message: any;
    line?: any;
}>;
export function validateReferences(ast: any, libCtx?: {}, environnement?: {}): {
    code: any;
    message: string;
}[];
export function splitCompoundTerminals(ast: any, libCtx: any): void;
/**
 * LA TABLE DES PORTÉES PERMISES SE CONSTRUIT SUR CE QUE LA SCÈNE INVOQUE — Romain, 2026-09-02/03 :
 * « elle doit dépendre des librairies invoquées ». Elle lisait CINQ librairies par leur nom
 * (`expression`, `midi`, `audio`, `transpo`, `engine`), quelle que soit la scène : un réglage déclaré
 * ailleurs n'y entrait jamais, et un réglage d'une librairie que la scène n'invoquait pas y était.
 *
 * Ce qu'elle rend, pour une scène : chaque réglage déclaré par une librairie INVOQUÉE — directement
 * ou par une librairie qui l'invoque — avec la portée qu'il déclare ; et chaque clé d'adresse, de
 * même (elles ont quitté le socle le 2026-08-15 pour la librairie du canal qui les porte, et chacune
 * déclare sa portée). Un réglage déclaré par DEUX librairies invoquées n'a PAS de portée nu — c'est
 * l'ambiguïté que `validateReferences` refuse en nommant les préfixes, et l'auteur préfixe, comme un
 * terminal par son acteur ; préfixé (`get(cle, lib)`), il est jugé à la portée que SA librairie
 * déclare. SAUF quand les autres déclarent réaliser l'une (`implements:expression.volume`) : c'est
 * le même mot, une interface et ses réalisations, et sa portée nue est celle de l'interface. Mesuré
 * sur le corpus : `volume` est le seul mot dans ce cas, `audio` et `midi` réalisant `expression`.
 *
 * La table est mémorisée par ENSEMBLE de librairies invoquées, jamais par scène : deux scènes qui
 * invoquent la même chose partagent la même table, et un registre qui bouge la périme. Sans scène,
 * le registre entier fait portée — pour les outils qui décrivent le vocabulaire.
 */
export function chargerPorteesPermises(ast: any): any;
export function singleCharAlphabetSet(libCtx: any): Set<any> | null;
export function splitLhsElement(el: any, terminals: any): any[];
export function splitRhsElement(el: any, terminals: any): any[];
/**
 * Tokenise un nom composé selon la règle NATIVE (réalignement A-bis, accord
 * architecte 2026-07-03 sur preuves bp3-engine [263] — constat hashab-monochar,
 * addendum) : à chaque position, (1) terminal déclaré au LONGEST-MATCH
 * (SEARCHTERMINAL2 Encode.c:888-918) ; sinon (2) MAJUSCULE → VARIABLE qui
 * absorbe les alphanumériques suivants (SEARCHVAR — preuves : abXa→a·b·Xa,
 * abX4→a·b·X4, abXcd→a·b·Xcd) ; sinon (3) CHIFFRE → NOMBRE (suite de chiffres —
 * preuves : ab4→a·b·4, ab4a→a·b·4·a) ; sinon (4) caractère hors règle prouvée →
 * nom INTACT (conservateur). Jamais « intacte à cause d'un char non-terminal »
 * (l'ancien choix, hérité de l'adaptateur BPx, était INFIDÈLE au natif).
 * null = rien à découper (atomique ou un seul token).
 */
export function tokenizeCompoundName(name: any, terminals: any): {
    kind: string;
    text: any;
}[] | null;
export function makeSplitAtom(original: any, ch: any, isFirst: any): {
    type: string;
    name: any;
};
export function noterLePassage(compte: any): void;
export function dernierPassage(): any;
export const restesDeSegmentation: WeakMap<object, any>;
