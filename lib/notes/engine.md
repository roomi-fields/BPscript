# Notes — librairie `engine`

Ce que `lib/engine.bpsl` ne montre pas : la cause d'une valeur, l'histoire d'une forme, la
borne d'une mesure. La source porte ce qui EST, cette note porte le reste.

## types

LA LIBRAIRIE « engine » — écrite dans le langage qu'elle sert.
Convertie depuis le JSON : le bundle en rend la MÊME donnée, les consommateurs ne
voient aucun changement. C'est l'AUTHORING qui change, pas la donnée.

⚠️ LA DOCUMENTATION EST UN COMMENTAIRE, plus une clé `_xxx_doc` dans la donnée : un
   commentaire ne voyage pas jusqu'aux consommateurs, une clé si.
AUTORITE
Le contenu de cette librairie est déclaré par atlas/architecture/LIBRAIRIES.md:168, qui la
donne pour nature « en-tête » et pour destinataire BPx. Créée le 2026-08-10 sur autorisation
de Romain (« il faut créer cette librairie engine »), en même temps que le passage des
directives de production à l'arobase.
GRAPHIE
⚠️ UNE LIBRAIRIE DIT QUI EXÉCUTE, JAMAIS COMMENT ÇA S'ÉCRIT. `goto`, `repeat`, `stop` et
`failed` sont portés par `engine` ET s'écrivent ENTRE CROCHETS en fin de règle — ce sont des
PROCÉDURES de dérivation (LANGUAGE.md:805). Leur appartenance à cette librairie ne déplace
pas leur graphie, et l'inverse est vrai aussi : `seed` appartient à `engine` et s'écrit
`seed:42` en tête de scène.
PREFIXE
Le préfixe est OPTIONNEL : `seed:42` et `engine.seed:42` désignent la même chose, par la
règle d'unicité (atlas/architecture/LIBRAIRIES.md:42). Une clé portée par une seule librairie
se résout sans être préfixée.
ARTICULCONT
POURQUOI UN MODE DE VARIATION VIT ICI. L'articulation se pose par `legato` et `staccato`,
déclarés dans la place `engine` de ce fichier parce qu'ils déforment la DURÉE des notes ;
le destinataire de ce fichier est donc aussi le leur. Le mode continu suit son paramètre,
comme tous les modes continus (`lib/variation.json`, `_partage_doc`) : il vit ici.
⚠️ LA PLACE NE COMMANDE PAS LE SIGNE, et le croire serait une faute : depuis la décision de
Romain du 2026-08-02, c'est le DOMAINE DE LA CLÉ qui adresse le destinataire, pas le sac.
Mesuré : `legato`, rangé sous `engine`, s'écrit `(legato:20)` et se fait REFUSER entre
crochets, avec sa réécriture. Les crochets ne portent aucun réglage — ils portent les
drapeaux de fin de règle, qui acceptent n'importe quel nom.
NATURE ET PLACE
Chaque entrée dit ce qu'elle est par son type en tête — `control` — et où elle s'écrit par
`scope`. La clé `section` dit seulement dans quelle PLACE du paquet elle se range ; elle ne
type rien (décision de Romain, 2026-09-02 : « on ne type pas par l'endroit où on range, on
déclare »). Un geste natif sans forme BPScript est un contrôle qui porte `bpscript:false`.

## srand

── Gestes natifs sans forme BPScript ──────────────────────────────────────────────────────

## mode

── La place `engine` — ce qui gouverne la dérivation ──────────────────────────────────────
_comment : [] syntax — translated directly to BP3 instructions by the transpiler
_reglages_reserves_doc : mode/scan/weight/on_fail/meter -- SANS champ 'bp3' (contrairement
aux autres entrees de cette place) : ce ne sont pas des PROCEDURES BP3 (`_nom(args)`
recherchees via controlMap), ce sont des attributs STRUCTURELS de la grammaire native (poids
litteral `<N>`, suffixe de mode de sous-grammaire, prefixe scan LEFT/RIGHT, signature
rythmique) que le frontal BP3 lit par un chemin dedie, pas par la table generique
bp3->controle. Leur inventer un nom '_xxx' serait une correspondance FAUSSE. Textes de
description repris tels quels de docs/spec/LANGUAGE.md:1024-1029 (spec gelee, non modifiee).

## resetweights

RESETWEIGHTS · LES POIDS REPARTENT DE LEUR VALEUR ECRITE. Cree le 2026-08-21 sur decision de
Romain (`trois-reglages-natifs-trouvent-leur-domicile`). Il vit ici parce que c est la
GENERATION DE LA STRUCTURE qui le consomme, agnostique au contenu -- aupres de `weight`, dont
il remet la valeur. Sa fonction est mesuree dans le moteur d origine : ScriptUtils.c:1628-1637.
⛔ SON CONTRAIRE EXISTE DEPUIS LE 2026-08-22, sur GO de Romain — « ok pour le contraire ». Sa
premiere objection etait qu un reset est une ACTION PONCTUELLE, pas un etat a passer a off ;
la mesure du natif l a levee : `ScriptUtils.c:1628-1637` porte `ResetWeights = FALSE` au cas
133 (« Reset rule weights OFF ») et `= TRUE` au cas 134 (« ON »), et le fichier de reglages le
publie a 1. C est un REGLAGE A DEUX ETATS, pas une action — d ou la paire, comme
`resetcontrols`/`keepcontrols`. La regle des paires est desormais sans exception.

## rotate

⛔ SANS UNITE, ET C EST TRANCHE. Le champ d'unite reste VIDE, et c'est un ETAT : un degre d'alphabet est un RANG, pas une grandeur (decision de Romain, 2026-08-22 — « le degre et la touche n'entrent pas au vocabulaire des unites »). C'est le nom de l'argument qui porte l'information.

## legato

legato · POURCENTAGE D'ALLONGEMENT, pas une valeur MIDI. Mot du moteur (BP3_help.txt:736) : «
durations of notes in the following sequence will be increased by x% ». La borne etait 0..127
-- une plage MIDI posee sur un pourcentage, PROUVEE FAUSSE : les donnees de test du moteur
natif ecrivent _legato(300). Signale par kanopi le 2026-08-07 (tryShruti.bps:8, un BOURDON,
ou un legato au-dela de 100% fait chevaucher les notes tenues -- l'intention meme). Le moteur
ne declare AUCUN plafond ; 1000 est un garde-fou de saisie, pas une limite du moteur.

## destru

destru · RANGE DANS LA PLACE `engine` LE 2026-08-10 (arbitrage Romain : « la portee regle,
c est un sac en fin de regle pour tous les controles, ca doit etre pareil pour destru, voila
comme pour stop »). ⚠️ DEUX CHOSES DIFFERENTES, TOUTES DEUX PORTEES PAR LA DONNEE, et les
confondre a coute ce deplacement : la PLACE dit dans quel SAC le mot s ecrit (`engine` ->
crochets, `runtime.*` -> parentheses) ; le champ `scope` dit A QUELLE POSITION il vaut.
`destru` etait range sous `subgrammar`, qui n alimente aucun sac : `S -> C4 [destru]` etait
donc lu comme un DRAPEAU (FlagExpr), homonyme et silencieux, au lieu d un controle de regle.
Il garde ses DEUX natures parce que `scope` reste ['subgrammar','rule'] : la validation des
modificateurs de sous-grammaire lit la PORTEE, pas la place.
PORTEES CONFORMES AU MOTEUR NATIF, ET S Y LIMITANT (arbitrage Romain 2026-08-10 : « on doit
etre conforme a l usage BP3 et s y limiter pour destru »). Le moteur porte `destru` a DEUX
niveaux, tous deux lus a la production : la SOUS-GRAMMAIRE, armee par le preambule
(CompileGrammar.c:1528, lue Compute.c:225), et la REGLE, armee dans le RHS (Encode.c:408, lue
Compute.c:732 sous `mode == PROD && rule.destru`). Le corpus natif le confirme : 3 occurrences,
toutes posees APRES le mode d une sous-grammaire et avant ses regles (-gr.tryDESTRU:18,
-gr.tryPatternGrammar:12, -gr.tryAllItems0:16), jamais en tete de grammaire. ⚠️ LA PORTEE
`scene` ETAIT INVENTEE — aucune branche du moteur ne la porte. Retiree le 2026-08-10. La
portee `rule` la remplace : sa graphie EXISTAIT deja (`S -> C4 [destru]`, mesure), seule la
donnee ne la declarait pas.

## seed

── Les réglages de tête de scène — ce que le moteur lit avant de dériver ──────────────────
Ils ne portent aucun `bp3:` : ce sont des REGLAGES du moteur natif (Seed, MaxItemsProduce,
AllItems, Improvize, Quantization, Qclock), pas des procedures `_xxx`. Leur nom natif se
declare le jour ou il est mesure, jamais invente.

## randomize

── La place `subgrammar` — ce qui s'écrit APRÈS le mode d'une sous-grammaire ──────────────
La re-semence, la nature du temps. ⛔ LE METRONOME N EST PAS ICI, ET C EST `lib/time.json`
QUI LE PORTE — avec son cablage natif `_mm`, sa double portee et son groupe d unicite. Le mot
`mm` est SORTI du langage le 2026-08-18 sur arbitrage de Romain ; son remplacant `tempo` a
repris tout son cablage, mais dans le domicile que la bible lui donne en quatorze endroits.
`core` amene `time`, donc `tempo:120` s ecrit nu.
⚠️ `striated` et `smooth` partagent le groupe `nature-du-temps`. UN GROUPE D UNICITE, PAS UN
DRAPEAU PAR MOT — et c est le natif qui l impose. Le moteur tient DEUX compteurs
(CompileGrammar.c:1535-1551) : `NotFoundMetronom` pour `_mm` seul, et `NotFoundNatureTime`
PARTAGE par `_striated` et `_smooth`, qui tombent dans le MEME case par fall-through. Un
`_striated` suivi d un `_smooth` est donc refuse AUSSI : ils reglent LA MEME CHOSE, la nature
du temps, et on ne la regle pas deux fois. Le refus natif n est pas un avertissement :
`return(7)`, la grammaire entiere ne compile pas. Le groupe du metronome vit chez `time` ; les
groupes se comptent a travers TOUTES les librairies, pas fichier par fichier.

