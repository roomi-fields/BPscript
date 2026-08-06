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
      | rules+=Rule
    )*;

ProdLigne:
    directive=ProdDirective NL+;

// ── Déclaratif ──────────────────────────────────────────────────────────────
ActorDirective:
    '@' 'actor' name=ID (keys+=ActorKey)* NL+;

ActorKey:
    key=ID '.' target=ID ('(' params+=Paire (',' params+=Paire)* ')')?;

Directive:
    '@' name=ID ('.' target=ID)? (':' value=Valeur)? (args+=Valeur)* NL+;

Separator:
    value='-----' NL+;

// ── Règles de production ────────────────────────────────────────────────────
// ⚠️ TROIS CHOSES QUE LA MESURE DU CORPUS A IMPOSÉES, chacune sur un paquet de scènes :
//   · un SAC DE RÉGLAGES en fin de règle (`… - (vel:110)`) — 111 scènes butaient là ;
//   · une TÊTE À PLUSIEURS SYMBOLES (`S1F S2F E32 ->`) — la règle contextuelle ;
//   · une DIRECTIVE DE PRODUCTION entre crochets (`[@maxitems:20]`).
Rule:
    (guards+=Guard | prod+=ProdDirective)*
    lhs+=Lhs+ arrow=Arrow rhs+=RhsElement+
    (flags+=Guard | prod+=ProdDirective | bag=SettingBag)* NL+;

// ⚠️ Plusieurs directives dans un même crochet : `[@allitems, @maxitems:500]`.
ProdDirective:
    '[' '@' names+=ProdNom (',' '@'? names+=ProdNom)* ']';

ProdNom:
    name=ID (':' value=Valeur)?;

Lhs:
    (negatif='#')? name=ID | joker='?' (rang=NUMBER)?;

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
    Instant | GabaritGroupe | Polymetric | Backtick | Rest | Prolongation | Undetermined | Period
  | Wildcard | Nombre | SymbolRef;

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

Polymetric:
    '{' voices+=Voice (',' voices+=Voice)* '}' (':' frame=Duree)? (bag=SettingBag)?;

// ⚠️ Une VOIX porte son propre sac : `{C5 E5 (vel:100), E4 G4 (vel:70)}`.
Voice:
    elements+=RhsElement+ (bag=SettingBag)?;

// `$mel` capture, `&mel` rejoue — les gabarits. `#X` est un contexte négatif.
SymbolRef:
    (gabarit=SigneGabarit)? (negatif='#' (joker='?')?)? (actor=ID '.')? name=ID
    (':' duree=Duree)? ('.' numero=NUMBER)? (bag=SettingBag)? (tie='~')?;

SigneGabarit returns string:
    '$' | '&';

Duree:
    num=NUMBER ('/' denom=NUMBER)?;

SettingBag:
    '(' pairs+=Paire (',' pairs+=Paire)* ')';

// `cc.98:0` — le composant peut être un NUMÉRO.
Paire:
    key=ID ('.' (component=ID | numero=NUMBER))? (':' value=Valeur)?;

// ⚠️ UNE VALEUR PEUT AVOIR PLUSIEURS PARTIES, séparées par une ESPACE — `(scale:todi_ka_4 0)`,
// `(keymap:C3 C3 C5 C5)`, `(scale:Cmaj C4)`. C'est la loi du langage : la VIRGULE sépare les
// éléments du sac, l'ESPACE sépare les parties d'une valeur. Sans cela le sac se refermait sur la
// deuxième partie.
// ⚠️ Et le DÉCRÉMENT `N-D` (`weight:20-4`) est une valeur d'un seul tenant, pas deux parties.
Valeur:
    parts+=Atome+;

// ⚠️ `K1=1` — un K-paramètre s'initialise DANS une valeur (`weight:K1=1`, `rotate:K1=2`).
Atome:
    (signe='-')? num=NUMBER (('/' | '-' | '+') suite=NUMBER)*
  | mot=ID ('=' init=NUMBER)?
  | texte=STRING;

Nombre:
    value=NUMBER ('/' denom=NUMBER)?;

Backtick:      value=BACKTICK;
Rest:          value='-';
Prolongation:  value='_';
Undetermined:  value='...';
Period:        value='.';
// `?` anonyme, `?1` numéroté — les jokers d'un gabarit.
Wildcard:      value='?' (rang=NUMBER)?;

// ── Lexèmes ─────────────────────────────────────────────────────────────────
// ⚠️ `ID` accepte le chiffre en fin de mot et l'apostrophe : les terminaux du langage s'écrivent
// `C4`, `Bb3`, `A_r`, `B_r'`. Un identifiant qui les refuserait rejetterait la moitié du corpus.
// ⚠️ L'APOSTROPHE VIT À L'INTÉRIEUR DU NOM, pas seulement à la fin : `A'8`, `F'24`, `B_r'`.
// Mesuré : la placer en suffixe seul rejetait toute une famille de scènes.
terminal ID: /[A-Za-z_][A-Za-z0-9_#']*/;
terminal NUMBER returns number: /[0-9]+(\.[0-9]+)?/;
terminal STRING: /"[^"]*"/;
terminal BACKTICK: /`[^`]*`/;

terminal NL: /[\r\n]+/;
hidden terminal WS: /[ \t]+/;
hidden terminal COMMENT: /\/\/[^\n\r]*/;
