// GRAMMAIRE DE MAQUETTE — chantier « parseur dérivé d'un formalisme », phase 3.
//
// Elle vise le CŒUR mesuré en phase 0 : les natures qui portent la quasi-totalité du corpus.
// Ce n'est pas encore le langage entier — la queue longue (câblage, gabarits, points d'attente,
// homomorphismes) est absente, et le compte d'acceptation le dit.
//
// ⚠️ DEUX CONTRAINTES MESURÉES SONT INSCRITES DANS SA FORME, pas dans un commentaire d'intention :
//   1. LA FIN DE LIGNE TERMINE UNE RÈGLE. L'espace caché fondait deux règles en une.
//   2. PAS DE RÉPÉTITION ENGLOBANTE AU SOMMET. Une itération au sommet avale l'échec de ce qu'elle
//      répète, et toute faute remonte au premier caractère. Les règles sont filles directes de la
//      scène pour que chacune échoue À SA PLACE — la qualité des diagnostics est une propriété de
//      la GRAMMAIRE, pas seulement de l'outil.
//
// ⚠️ `Symbol` reste interdit (nom réservé du runtime JavaScript) : le nœud le plus produit du
// langage s'appelle ici `SymbolRef`. C'est une frontière pour les huit dépôts qui lisent l'arbre.

grammar BPScript

entry Scene:
    NL* (
        actors+=ActorDirective
      | directives+=Directive
      | separators+=Separator
      | prods+=ProdLigne
      | gabarits+=EntreeGabarit
      | orphelins+=BacktickOrphelin
      | rules+=Rule
    )*;

// Un bloc de code seul sur sa ligne, sans règle qui le porte.
BacktickOrphelin:
    code=BACKTICK NL*;

ProdLigne:
    directive=ProdDirective NL*;

// ⚠️ LE CATALOGUE DE GABARITS : `[1] /1 ???????` — un RANG entre crochets, une ÉCHELLE, puis la
// forme en jokers. Ce n'est pas une règle : il n'y a pas de flèche.
EntreeGabarit:
    '[' rang=NUMBER ']' (echelle=Speed | echelleNue=EchelleNue)?
    (forme+=RhsElement | groupes+=GroupeGabarit)+ NL*;

// `($0 ???)` — un groupe de la forme, avec son ancre numérotée.
GroupeGabarit:
    '(' (ancre=ANCRE)? elements+=RhsElement* ')';

terminal ANCRE: /\$[0-9]+/;

EchelleNue:
    op=OpVitesse value=NUMBER ('/' denom=NUMBER)?;

// ── Déclaratif ──────────────────────────────────────────────────────────────
ActorDirective:
    '@' 'actor' name=ID (keys+=ActorKey)* NL*;

// ⚠️ Une clé d'acteur peut porter l'arobase : `@actor flute @alphabet.sargam octaves.western`.
// Les deux graphies coexistent dans le corpus.
ActorKey:
    (arobase='@')? key=ID '.' target=ID ('(' params+=Paire (',' params+=Paire)* ')')?;

// ⚠️ Un argument de directive peut être une RÉFÉRENCE POINTÉE : `@var touches in.keyboard`,
// `@actor sitar alphabet.sargam`. Une valeur nue ne suffit pas.
Directive:
    '@' name=ID ('.' target=ID)? (':' value=Valeur)? (bag=SettingBag)?
    (args+=ArgDirective | ',' args+=ArgDirective | coupures+=Branchement)* NL*;

// ⚠️ `@timepatterns: t1=96/100, t2=100/100` — un argument de directive peut AFFECTER une valeur
// avec le signe égal, pas seulement avec le deux-points. Mesuré : deux scènes l'écrivent ainsi.
// ⚠️ Un argument de directive peut être du CODE (`@cv sweep \`js: …\``) ou un TYPE À DEUX-POINTS
// suivi de paires (`@var section flag: a:1, b:2`).
// ⚠️ `@var section flag: a:1, b:2` — le TYPE d'une variable est suivi d'un deux-points, puis
// d'une liste de paires nommées séparées par des virgules. La valeur d'un argument peut donc
// elle-même être une liste.
ArgDirective:
    mot=ID ('.' sous=ID)? (bag=SettingBag)? ((':' | '=') paires+=PaireNommee (',' paires+=PaireNommee)*)?
  | num=NUMBER
  | texte=STRING
  | code=BACKTICK;

// ⚠️ UNE SEULE VOIE, pas deux. La première rédaction offrait « une liste de paires OU une
// valeur », et l'outil a signalé une AMBIGUÏTÉ : les deux commencent par un identifiant. Une
// grammaire ambiguë analyse de travers en silence — c'est pire qu'un refus. Une paire dont la
// valeur est facultative couvre les deux cas et l'ambiguïté disparaît au lieu d'être arbitrée.
// ⚠️ `>>` BRANCHE, `\\>>` COUPE — le câblage relie deux ports, et il apparaît AUSSI comme valeur
// d'une directive : `@macro lead saw.freq: pitch >> lpf.cutoff: …`.
Branchement:
    ('>>' | COUPE) (code=BACKTICK | cible=ID ('.' port=ID)? (':' (codeVal=BACKTICK | valeur=Valeur))?);

PaireNommee:
    valeur=Valeur ((':' | '=') (code=BACKTICK | suite=Valeur))? (branchements+=Branchement)*;

Separator:
    value='-----' NL*;

// ── Règles de production ────────────────────────────────────────────────────
// ⚠️ TROIS CHOSES QUE LA MESURE DU CORPUS A IMPOSÉES, chacune sur un paquet de scènes :
//   · un SAC DE RÉGLAGES en fin de règle (`… - (vel:110)`) — 111 scènes butaient là ;
//   · une TÊTE À PLUSIEURS SYMBOLES (`S1F S2F E32 ->`) — la règle contextuelle ;
//   · une DIRECTIVE DE PRODUCTION entre crochets (`[@maxitems:20]`).
Rule:
    (guards+=Guard | prod+=ProdDirective)*
    lhs+=Lhs+ arrow=Arrow rhs+=RhsElement*
    (flags+=Guard | prod+=ProdDirective | bag=SettingBag)* NL*;

// ⚠️ Plusieurs directives dans un même crochet : `[@allitems, @maxitems:500]`.
ProdDirective:
    '[' '@' names+=ProdNom (',' '@'? names+=ProdNom)* ']';

ProdNom:
    name=ID (':' value=Valeur)?;

// `#(?1 ?3 ?2 ?4)` — un contexte négatif peut porter sur un GROUPE de jokers.
// ⚠️ La PROLONGATION et le SILENCE font partie d'une tête de règle : `re5_r _ G ->`, `Oc3 _ ->`.
// Une tête n'est pas qu'une suite de noms — elle décrit un MOTIF à reconnaître.
// ⚠️ UNE TÊTE DE RÈGLE N'EST PAS QU'UN NOM. Mesuré : elle peut être un objet sonore composé
// (`|a4| -> …`), un gabarit (`$ V1 #tr <> …`), une prolongation, un silence, un joker. C'est un
// MOTIF à reconnaître dans la dérivation, pas un identifiant.
// `(A B) X -> D E` — un CONTEXTE POSITIF : ce qui précède doit être présent pour que la règle
// s'applique, mais n'est pas réécrit.
Lhs:
    contexte=ContextePositif
  | compose=Compose
  | gabarit=SigneGabarit
  | prolongation='_'
  | silence='-'
  | (negatif='#')? name=ID
  | (negatif='#')? joker='?' (rang=NUMBER)?
  | negatif='#' silence='-'
  | negatif='#' '(' groupe+=Wildcard+ ')';

Arrow returns string:
    '->' | '<-' | '<>';

// ⚠️ Le crochet porte aussi les PROCÉDURES de niveau règle (`[repeat:1]`, `[goto:2 1]`) — une
// clé suivie d'un deux-points, distincte d'un test de drapeau.
// ⚠️ Plusieurs mutations dans un même crochet : `[Ideas=20, Notes=32, NumR=1]`.
Guard:
    '[' items+=GuardItem (',' items+=GuardItem)* ']';

GuardItem:
    flag=ID ((op=OpDrapeau | deuxpoints=':') value=Valeur)?;

OpDrapeau returns string:
    '==' | '!=' | '>=' | '<=' | '>' | '<' | '=' | '+' | '-';

// ── Membre droit ────────────────────────────────────────────────────────────
RhsElement:
    Cablage | Attente | AppelLibre | Instant | Etoile | ContexteJoker | Compose | GabaritGroupe | Polymetric | Backtick | Rest | Prolongation | Undetermined | Period
  | Wildcard | Nombre | SymbolRef;

// `#?` — un contexte négatif portant sur un joker, en tête comme en membre droit.
ContextePositif:
    '(' elements+=RhsElement+ ')';

ContexteJoker:
    negatif='#' (joker='?' (rang=NUMBER)? | silence='-');

// `saw1 >> lpf1 >> out` — le CÂBLAGE posé dans le flux : une chaîne de modules reliés.
Cablage:
    depart=ID ('.' portDepart=ID)? etapes+=Branchement+;

// `<!touches.Space` — le point d'attente : le flux suspend jusqu'à l'arrivée du rôle nommé.
Attente:
    '<!' role=ID ('.' adresse=(ID | NUMBER))?;

// ⚠️ `script(wait for do#2 channel 1)` — un appel dont les arguments sont du TEXTE LIBRE, pas des
// paires. La grammaire doit donc admettre une suite de mots quelconques entre les parenthèses.
AppelLibre:
    nom='script' '(' mots+=MotLibre+ ')';

MotLibre:
    valeur=ID | valeur=NUMBER;

// `$ {…}` capture un GROUPE entier, `& {…}` le rejoue — l'espace sépare le signe du groupe.
GabaritGroupe:
    signe=SigneGabarit groupe=Polymetric;

// `!(vel:80)` runtime · `! (/2)` vitesse · `![retro]` moteur · `![@seed:1]` production · `!nom`
Instant:
    '!' (speed=Speed | bag=SettingBag | prod=ProdDirective | crochet=Guard | name=ID);

Speed:
    '(' op=OpVitesse value=NUMBER ('/' denom=NUMBER)? ')';

OpVitesse returns string:
    '/' | '*';

// ⚠️ UN BLOC PEUT S'ÉTENDRE SUR PLUSIEURS LIGNES — mesuré : trois scènes du corpus l'écrivent
// ainsi, une voix par ligne. La fin de ligne termine une RÈGLE, mais pas un BLOC : à l'intérieur
// des accolades, elle redevient de la mise en page. C'est la seule place du langage où le retour
// à la ligne change de sens, et la grammaire doit le dire.
Polymetric:
    '{' NL* voices+=Voice (',' NL* voices+=Voice)* NL* '}' (':' frame=Duree)? (bags+=SettingBag)* (crochets+=Guard)*;

// ⚠️ Une VOIX porte son propre sac : `{C5 E5 (vel:100), E4 G4 (vel:70)}`.
Voice:
    elements+=RhsElement+ (bag=SettingBag)? NL*;

// `$mel` capture, `&mel` rejoue — les gabarits. `#X` est un contexte négatif.
// ⚠️ LA LIAISON SE POSE DES DEUX CÔTÉS : `G#5~` ouvre, `~G#5` ferme. Mesuré sur le corpus —
// `{2,~G#5,~B6}` était refusé faute d'admettre le tilde en tête.
SymbolRef:
    (gabarit=SigneGabarit)? (lien='~')? (negatif='#')? (actor=ID '.')? name=ID
    (':' duree=Duree)? ('.' numero=NUMBER)?
    (bags+=SettingBag | crochets+=Guard)* (tie='~')?;

// `mel(2)` — l'APPEL d'un symbole avec ses arguments positionnels.
// ⚠️ AU MOINS UN ARGUMENT. La première rédaction les rendait facultatifs, et `S -> C4()` — un sac
// VIDE — passait. C'est le volet B du garde qui l'a attrapé, pas moi : ajouter une construction
// peut RELÂCHER la grammaire ailleurs, et le compte de scènes acceptées ne le dit jamais.
ListeArgs:
    '(' args+=Valeur (',' args+=Valeur)* ')';

SigneGabarit returns string:
    '$' | '&';

Duree:
    num=NUMBER ('/' denom=NUMBER)?;

SettingBag:
    '(' pairs+=Paire (',' pairs+=Paire)* ')';

// `cc.98:0` — le composant peut être un NUMÉRO.
// ⚠️ LE SUJET d'un réglage, écrit devant la clé et séparé par un deux-points : `(*:cutoff:env1)`
// pose `cutoff` sur CHAQUE terminal de la portée, `(C2:cutoff:400)` sur les seuls `C2`. Trois
// pièces séparées par deux `:` là où une paire ordinaire en a deux.
// ⚠️ LE SUJET d'un réglage s'écrit devant la clé : `(*:cutoff:env1)` pose `cutoff` sur CHAQUE
// terminal de la portée, `(C2:cutoff:400)` sur les seuls `C2`.
// ⚠️ ET IL NE S'ÉCRIT PAS EN ALTERNATIVE. Première rédaction : « un sujet optionnel PUIS une clé »
// — deux chemins commençant par un identifiant, donc AMBIGU, et l'outil l'a dit deux fois. La
// paire lit donc ses parties DANS L'ORDRE, et c'est le NOMBRE de deux-points qui décide du sens :
// deux parties = clé et valeur, trois = sujet, clé et valeur. Aucune alternative à arbitrer.
// ⚠️ UN SEUL CHEMIN POUR LA PARENTHÈSE COLLÉE. `mel(2)` (appel) et `C4(vel:80)` (réglage) ont la
// MÊME forme : deux règles concurrentes rendaient la grammaire AMBIGUË, et l'outil l'a dit. Le sac
// les couvre tous les deux — une paire dont la clé est un NOMBRE et la valeur absente EST un
// argument positionnel. La distinction est SÉMANTIQUE, pas syntaxique : c'est au code de trancher.
Paire:
    (etoile='*' | premier=ID | positionnel=NUMBER) ('.' (component=ID | numero=NUMBER))?
    (':' deuxieme=Valeur (':' troisieme=Valeur)?)?;

// ⚠️ UNE VALEUR PEUT AVOIR PLUSIEURS PARTIES, séparées par une ESPACE — `(scale:todi_ka_4 0)`,
// `(keymap:C3 C3 C5 C5)`, `(scale:Cmaj C4)`. C'est la loi du langage : la VIRGULE sépare les
// éléments du sac, l'ESPACE sépare les parties d'une valeur. Sans cela le sac se refermait sur la
// deuxième partie.
// ⚠️ Et le DÉCRÉMENT `N-D` (`weight:20-4`) est une valeur d'un seul tenant, pas deux parties.
Valeur:
    parts+=Atome+;

// ⚠️ `K1=1` — un K-paramètre s'initialise DANS une valeur (`weight:K1=1`, `rotate:K1=2`).
Atome:
    (signe='-')? num=NUMBER (('/' | '-' | '+') suite+=NUMBER)*
  | mot=ID ('=' (initSigne='-')? init=NUMBER (('/' | '-' | '+') initSuite+=NUMBER)*)?
  | texte=STRING;

Nombre:
    value=NUMBER ('/' denom=NUMBER)?;

// ⚠️ Un bloc de code porte sa DURÉE, collée à l'accent grave fermant : les scènes Csound
// écrivent `…`:18 — dix-huit battements pour tout le bloc.
Backtick:      value=BACKTICK (':' duree=Duree)? (bags+=SettingBag)*;
// Un silence porte son sac comme un terminal : `-(vel:127)`.
Rest:          value='-' (bag=SettingBag)?;
// ⚠️ `|[ do5 _ do5 do5 ]` — l'OBJET SONORE COMPOSÉ : le tube ouvre un bloc dont le contenu est
// une séquence de terminaux, pas des paires clé-valeur. Mesuré : la lecture par `Guard` échouait
// sur la prolongation, qui n'est pas un nom de drapeau.
// ⚠️ DEUX GRAPHIES pour l'objet sonore composé, mesurées sur deux scènes différentes :
// `|[ do5 _ do5 ]` avec des crochets, et `|a4|` encadré par des tubes.
Compose:
    '|' '[' elements+=RhsElement+ ']'
  | '|' elements+=RhsElement+ '|';
Prolongation:  value='_';
Undetermined:  value='...';
Period:        value='.';
// `?` anonyme, `?1` numéroté — les jokers d'un gabarit.
// Un joker porte son propre sac : `?1(vel:95)`.
Wildcard:      value='?' (rang=NUMBER)? (bag=SettingBag)?;
// `*` — le marqueur d'homomorphisme, posé dans le flux.
Etoile:        value='*';

// ⚠️ LA DERNIÈRE LIGNE D'UN FICHIER N'A PAS DE SAUT DE LIGNE. Mesuré : 59 scènes du corpus se
// terminent sans, et ma règle en exigeait un — un refus qui ne disait rien du langage, seulement
// de ma grammaire trop stricte. Un quart du corpus tombait là-dessus.


// ── Lexèmes ─────────────────────────────────────────────────────────────────
// ⚠️ `ID` accepte le chiffre en fin de mot et l'apostrophe : les terminaux du langage s'écrivent
// `C4`, `Bb3`, `A_r`, `B_r'`. Un identifiant qui les refuserait rejetterait la moitié du corpus.
// ⚠️ L'APOSTROPHE VIT À L'INTÉRIEUR DU NOM, pas seulement à la fin : `A'8`, `F'24`, `B_r'`.
// Mesuré : la placer en suffixe seul rejetait toute une famille de scènes.
// ⚠️ UN NOM PORTE PLUS QUE DES LETTRES. Mesuré sur le corpus : l'apostrophe et le GUILLEMET
// marquent le registre (`A'8`, `B"8`), le dièse une altération (`G#5`), et le TIRET SUIVI D'UN
// CHIFFRE une variante (`Tr-11`, `A'6-2`). Un identifiant qui les refuserait rejetterait des
// familles entières — et aucun des trois documents ne le disait.
// ⚠️ Le TIRET vit aussi ENTRE DEUX MOTS : `pure_minor-third_meantone`. Mesuré sur le corpus —
// le restreindre au tiret-chiffre laissait tomber les noms d'accordage composés.
terminal ID: /[A-Za-z_][A-Za-z0-9_#'"]*(-[A-Za-z0-9_][A-Za-z0-9_#'"]*)*/;
terminal NUMBER returns number: /[0-9]+(\.[0-9]+)?/;
terminal STRING: /"[^"]*"/;
terminal BACKTICK: /`[^`]*`/;

terminal NL: /[\r\n]+/;
terminal COUPE: /\\>>/;
hidden terminal WS: /[ \t]+/;
hidden terminal COMMENT: /\/\/[^\n\r]*/;
