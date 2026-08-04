# BPScript — Grammaire EBNF

Ce document décrit la **forme écrite** du langage. `LANGUAGE.md` en dit le sens ; `AST.md` dit ce
que l'arbre porte.

Notation : ISO 14977 (`=` définition, `,` concaténation, `|` alternative, `[ ]` optionnel,
`{ }` répétition 0+, `+` répétition 1+, `"..."` littéral, `(* ... *)` commentaire).

---

## Couche 1 — Structure globale

```ebnf
scene = { declarative_line } , subgrammar+ , [ template_section ] ;

declarative_line = library_invocation
                 | setting_invocation
                 | actor_directive
                 | var_directive
                 | def_directive
                 | init_directive
                 | backtick_orphan
                 | comment | blank_line ;
```

Une scène commence par ce qu'elle déclare et se poursuit par ce qu'elle produit. La partie
déclarative fait exister des choses ; les règles de production les font sonner dans le temps.

### Les quatre mots déclaratifs

Le cœur déclaratif tient en quatre mots. Tout le reste s'écrit en invoquant une librairie ou une
catégorie de réglages.

```ebnf
actor_directive = "@" , "actor" , IDENT , NEWLINE , actor_key+ ;

actor_key = ACTOR_KEY , "." , IDENT , [ "(" , kv_pairs , ")" ] ;   (* out.midi(ch:3) *)

ACTOR_KEY = "alphabet" | "tuning" | "octaves" | "out" | "eval" ;
```

`@actor` déclare **qui joue**. Chacune des cinq clés se lit dans un catalogue ; ce que l'acteur
n'écrit pas, il l'hérite de la scène. Le point appelle le composant, et les paramètres entre
parenthèses en donnent l'adresse.

```ebnf
var_directive = "@" , "var" , IDENT , var_type              (* @var lpf1 lpf *)
              | "@" , "var" , IDENT , { "," , IDENT } ;     (* @var pivot   @var z1, z2, z3 *)

var_type = "flag" , ":" , flag_state , { "," , flag_state }  (* @var section flag: calm:1, full:2 *)
         | "in" , "." , IN_CHANNEL                           (* @var touches in.keyboard *)
         | CONVENTION                                        (* @var hauteur pitch *)
         | IDENT ;                                           (* @var lpf1 lpf — un module *)

CONVENTION = "signal" | "pitch" | "phase" | "logic" ;
IN_CHANNEL = "midi" | "osc" | "keyboard" ;
flag_state = IDENT , ":" , INT ;
```

`@var` déclare **une variable** : un nom qui porte une valeur ou un état. Le nom vient d'abord, le
type ensuite. Un flag déclare ses états en même temps que lui-même, et une règle s'y conditionne
ensuite par leur nom. Une entrée nomme un **rôle** ; l'appareil qui le remplit s'y associe hors de
la scène. Une variable sans type est un symbole du flux qui n'est ni une note ni un nom de règle.

```ebnf
def_directive = "@" , "def" , IDENT , [ param_list ] , [ CONVENTION ] , def_body ;

param_list = "(" , IDENT , { "," , IDENT } , ")" ;      (* collé au nom *)

def_body = terminal_block            (* @def cloche  degree:0  voice.sombre *)
         | patch_expr                (* @def sombre lpf1 >> vca1 *)
         | setting_bag               (* @def kick (vel:120) *)
         | backtick_inline           (* @def fondu phase `js: (t, dur) => 1 - t / dur` *)
         | rhs ;                     (* @def cadence sa re ga pa   @def accent(x) x(vel:120) *)

terminal_block = terminal_key+ ;     (* une clé par ligne, ou sur la même ligne *)

terminal_key = TERMINAL_REF , "." , ( IDENT | backtick_inline )   (* le point appelle un composant *)
             | TERMINAL_VALUE , ":" , value ;                (* le deux-points affecte une valeur *)

TERMINAL_REF   = "tuning" | "octaves" | "out" | "voice" ;
TERMINAL_VALUE = "degree" | "register" | "hz" | "sounding" | "duration" ;
```

`@def` déclare **une définition** : un nom associé à un corps qu'on réinvoque d'un mot. Le nom vient
d'abord, ce qu'il vaut ensuite. La liste de paramètres se **colle** au nom ; un corps qui commence
par une parenthèse en est séparé par une espace. Le nom se pose ensuite à sa place dans une règle.

**Un bloc de clés déclare un terminal.** Ce sont celles du prototype d'un terminal, et le nom de
chacune suffit à la reconnaître. Un terminal déclaré dans une scène vit au niveau de la scène : il y
nomme lui-même son système de hauteur, sa sortie et sa voix, et prend de la scène ce qu'il laisse de
côté.

Sa hauteur s'écrit dans ses clés : `degree` et `register` la font résoudre par les librairies
d'accordage et de registres, `hz` la donne directement.

```ebnf
init_directive = "@" , "init" , NEWLINE , init_entry+ ;

init_entry = patch_expr | backtick_orphan ;
```

`@init` déclare **l'état de départ** de la scène : ce qui existe au démarrage et appartient à la
scène entière — le branchement initial, le code lancé une fois, les valeurs de départ. Ce qui
appartient à une chose s'initialise dans sa déclaration.

### Le langage de patch

```ebnf
patch_expr = patch_chain | patch_switch | port_assignment ;

patch_chain     = patch_node , { wire_op , patch_node } ;
wire_op         = [ INT ] , ( ">>" | "\>>" ) ;        (* le nombre donne la largeur : 8>> *)
patch_node      = "out" | IDENT , [ "." , IDENT ] ;    (* lpf1   lpf1.cutoff   out *)
patch_switch    = IDENT , ( "switchon" | "switchoff" ) ;
port_assignment = IDENT , "." , IDENT , ":" , value ;  (* lpf1.cutoff:400 *)
```

Le langage du câblage porte tout ce qui touche à la gestion du patch : brancher, couper,
neutraliser, affecter une valeur à un port. Un nombre devant les chevrons donne la largeur du
câble ; sans nombre, le câble en porte une. Le puits d'une chaîne s'écrit `out` — il désigne la
sortie de l'acteur, dont le canal est celui que l'acteur déclare.

Un module a une entrée et une sortie de signal par défaut ; quand elles suffisent, la chaîne
s'écrit sans les nommer. Quand il y en a plusieurs, le câblage les nomme avec le point.

Ce langage s'écrit à deux emplacements : nommé dans un `@def`, littéral dans un backtick `patch:`.

### Invoquer une librairie, invoquer un réglage

```ebnf
library_invocation = "@" , "core"
                   | "@" , LIBRARY , "." , IDENT , [ ":" , RUNTIME ]
                   | "@" , provenance , "." , path_seg , "." , path_seg , { "." , path_seg } ;

LIBRARY    = "alphabet" | "tuning" | "octaves" | "sound" | "homomorphism"
           | "library" | "module" | "patch" | "eval" | "devices" ;
RUNTIME    = "audio" | "midi" | "osc" ;
provenance = "factory" | "mine" ;
path_seg   = ( IDENT | INT ) , { IDENT | INT } ;

setting_invocation = "@" , [ CATEGORY , "." ] , IDENT , [ ":" , value ] ;
CATEGORY = "transpo" | "time" | "engine" ;
```

Une librairie s'invoque par son nom, l'entrée après le point : c'est la forme unique de tout ce qui
vit dans un catalogue. `@core` apporte le socle ; une scène qui ne l'écrit pas n'a aucun défaut.

Un réglage s'écrit par sa catégorie, l'entrée après le point. La catégorie dit à quoi le réglage
touche, donc qui le consomme : `@transpo.` la hauteur, `@time.` le temps qui s'écoule, `@engine.`
le temps calculé et la dérivation.

**Le préfixe est optionnel** : un nom nu passe s'il vit dans une seule librairie invoquée. Porté par
deux, la compilation s'arrête et nomme les deux candidats. La résolution est statique.

Le deux-points affecte une valeur. Sur un alphabet et ses terminaux, c'est le runtime de sortie.

Une référence de **provenance** nomme la provenance, le chemin de fichier et l'entrée — le dernier
segment est l'entrée, le milieu est le chemin. Un segment recolle des lettres et des chiffres
collés : `mes-svaras`, `22shruti`. La sortie d'une telle scène passe par un acteur explicite.

```ebnf
kv_pairs = kv_pair , { "," , kv_pair } ;
kv_pair  = IDENT , ":" , ( INT | FLOAT | IDENT ) ;
```

### Backtick de tête et commentaire

```ebnf
backtick_orphan = "`" , TAG , ":" , CODE , "`" ;
comment         = "//" , TEXT ;
```

Un backtick de tête prépare son `interpreter` au chargement. Le tag est une **adresse** : il nomme le
langage, et le langage nomme son `interpreter`. Chaque langage se déclare en librairie, où il dit
s'il sonne et s'il occupe du temps ; une occurrence surcharge ces défauts avec un sac.

---

## Couche 2 — Sous-grammaires

```ebnf
subgrammar = [ mode_line ] , rule+ , [ separator ] ;

separator  = "-----" , { "-" } ;           (* 5+ tirets : la passe suivante commence *)

mode_line  = "@" , "mode" , ":" , MODE ;

MODE = "ord" | "random" | "lin" | "sub" | "sub1" | "tem" | "poslong" ;
```

Les règles d'une même sous-grammaire partagent le mode. Il s'écrit `@mode:<valeur>` en tête, ou
`(mode:<valeur>)` en suffixe de règle. Deux sous-grammaires sont des **passes successives** : un
même nom y est le même symbole, réécrit plus tard.

| Mode      | Stratégie de sélection                           |
| --------- | ------------------------------------------------ |
| `ord`     | ordonné — la première règle applicable gagne     |
| `random`  | aléatoire — sélection pondérée par les poids     |
| `lin`     | linéaire — bouclage cyclique                     |
| `sub`     | substitution — toutes les occurrences à la fois  |
| `sub1`    | substitution — l'occurrence la plus à gauche     |
| `tem`     | appariement par gabarit                          |
| `poslong` | la plus longue correspondance d'abord            |

En mode `sub` et `sub1`, les symboles du membre gauche sont eux aussi des terminaux : ce qui reste
après les itérations appartient à l'alphabet et se joue. Une **tête de règle** peut donc y être un
terminal, puisqu'elle le réécrit.

### Le catalogue des formes — `@template`

```ebnf
template_section = "@" , "template" , NEWLINE , template_entry+ ;

template_entry   = "[" , INT , "]" , [ scale_factor ] , template_body ;

scale_factor     = "/" , INT                        (* /1, /2 *)
                 | "*" , INT , "/" , INT ;           (* *3/2 *)

template_body    = template_element+ ;

template_element = "?" , { "?" }                          (* un ? par terminal effacé *)
                 | "."                                    (* fragments de durée égale *)
                 | "(" , "$" , INT , [ template_body ] , ")" ;   (* groupes appariés *)
```

Un gabarit est une production dont les terminaux sont effacés ; ce qui reste est sa structure. Le
catalogue porte les mêmes gabarits, un par ligne. Une entrée s'écrit `[<rang>] <échelle> <forme>` :
le rang est sa place dans le catalogue, l'échelle vaut `/1` quand elle est omise, et la forme porte
les mêmes `?` que dans une règle — un par terminal effacé, **anonymes**. Le mode `tem` fait
l'appariement structurel sur ce catalogue, dans l'ordre des rangs.

La section se place après les règles, en fin de scène.

---

## Couche 3 — Règles

```ebnf
rule = [ guard ] , { context } , lhs , ARROW , rhs , [ setting_bag ] , { flag_bracket } ;

ARROW = "->" | "<-" | "<>" ;
```

| Direction | Sens                                                            |
| --------- | --------------------------------------------------------------- |
| `->`      | **production** — le membre gauche est réécrit en membre droit   |
| `<-`      | **analyse** — la séquence droite est réduite au symbole gauche  |
| `<>`      | **production et analyse** — la règle vaut dans les deux sens    |

### Trois places, trois rôles

- `@` = le **global** : environnement, imports, configuration de la scène.
- `[]` = la **dérivation** : un drapeau qui la conditionne, un rang qui désigne une de ses formes.
- `()` = les **réglages** : le domaine de la clé nomme leur destinataire.

Un signe, une nature. Ce qui est entre crochets appartient à la dérivation ; ce qui est entre
parenthèses appartient à ce qu'elle **produit**. Un réglage écrit entre crochets arrête la
compilation, et le message donne sa forme.

### `guard` — condition d'application

```ebnf
guard = "[" , guard_expr , "]" , { "[" , guard_expr , "]" } ;     (* multi-garde = ET *)

guard_expr = IDENT , COMPARE_OP , flag_value      (* test pur *)
           | IDENT , MUTATE_OP , INT               (* test de positivité, puis mutation au tir *)
           | IDENT ;                               (* le drapeau vaut autre chose que zéro *)

COMPARE_OP = "==" | "!=" | ">" | "<" | ">=" | "<=" ;
MUTATE_OP  = "+" | "-" ;

flag_value = INT | IDENT ;                         (* littéral, état nommé, ou autre drapeau *)
```

Écrite devant le membre gauche, la garde décide si la règle existe pour cette dérivation. Elle est
déclarative : la règle **existe** quand la condition est vraie.

Dans la garde, `+` et `-` testent d'abord et mutent ensuite, dans cet ordre : la règle est candidate
tant que le drapeau est strictement positif, et la mutation s'applique au moment où la règle est
retenue. Le drapeau vaut donc encore sa valeur d'avant pendant tout le test.

### `flag_bracket` — mutation d'état en fin de règle

```ebnf
flag_bracket = "[" , flag_expr , { "," , flag_expr } , "]" ;

flag_expr = IDENT , MUTATE_ASSIGN , flag_rvalue     (* [stage=2] *)
          | IDENT ;                                  (* drapeau nu : [Atrans] *)

MUTATE_ASSIGN = "=" | "+" | "-" ;
flag_rvalue   = INT | IDENT ;
```

Une mutation s'écrit en suffixe, en fin de règle. Elle est **hors-temps** : elle s'applique au
déclenchement de la règle, pendant la dérivation ; sa position se lit dans la règle, la séquence
jouée reste inchangée. `=` ne s'écrit qu'en fin de règle ; pour comparer un drapeau devant le
membre gauche, l'opérateur est `==`.

### `context` — conditions d'application

```ebnf
context = positive_context | negative_context ;

positive_context = "(" , context_sym+ , ")" ;
negative_context = "#" , context_sym                 (* un seul symbole *)
                 | "#" , "(" , context_sym+ , ")"    (* un groupe *)
                 | "#" , "?" ;                       (* frontière *)

context_sym      = symbol | wildcard | rest | prolongation | "{" | "}" | "," ;
```

**La parenthèse se lit « quand », le dièse se lit « sauf ».** La parenthèse regarde sans prendre ;
le dièse collé à un symbole, lui, occupe la place — il apparie exactement un symbole, qui doit
différer du sien.

La qualité de **contexte** vient de la **symétrie** de la règle : un symbole écrit à la même place
des deux côtés de la flèche est du contexte.

Plusieurs dièses forment un seul « sauf » : la négation porte sur l'ensemble. Le test passe dès
qu'un contexte diffère de son nom, et il bloque seulement quand tous égalent le leur en même temps.
Le groupe ne change pas le nombre d'interdits, il change le nombre de **places** : `#K1 #K2 #K3`
consomme trois positions, `#(K1 K2 K3)` une seule.

Le silence et la prolongation sont des voisins comme les autres, et le symbole se colle au dièse :
`#-`, `#_`.

### `lhs` et `rhs`

```ebnf
lhs = lhs_element+ ;

lhs_element = symbol | variable | wildcard | context
            | template_anchor                       (* $ nu = ancre de gabarit maître *)
            | "{" | "}" | "," ;                    (* méta-grammaires : accolades terminales *)

rhs = rhs_element* ;                               (* peut être vide *)
```

---

## Couche 4 — Éléments du membre droit

```ebnf
rhs_element = element_core , { suffix } ;

suffix      = setting_bag | duration | flag_bracket ;

element_core = symbol
             | symbol_call
             | compound_sound_object
             | rest | prolongation | undetermined_rest
             | period
             | numeric_duration
             | polymetric
             | simultaneous
             | out_time_object
             | instant
             | wait
             | variable
             | wildcard
             | template_master | template_slave | template_anchor
             | homomorphism_marker
             | tie_start | tie_continue | tie_end
             | nil_string
             | backtick_standalone
             | context
             | raw_brace ;
```

### 4.1 L'espace, délimiteur de termes

L'espace sépare deux termes du flux. Ce qui est **collé** à un terme appartient à ce terme et le
gouverne ; ce qui en est **séparé par un espace** est un terme, ou une portée, à part.

Les opérateurs qui **relient** deux termes se lisent de la même façon avec ou sans espace autour :
la flèche `->`, la simultanéité `!`, le câblage `>>` et sa coupure `\>>`, le point d'attente `<!`.
`S->sa!re` et `S -> sa ! re` donnent le même arbre.

Les signes qui **qualifient** un terme se collent à lui : le point `.`, le deux-points `:`, les
parenthèses `()`, les crochets `[]`. Séparés par un espace, ils changent de portée, ou la ligne est
refusée.

| Écriture               | Portée                                                                        |
| ---------------------- | ----------------------------------------------------------------------------- |
| `sa(vel:100)`          | les parenthèses collées portent le réglage sur `sa`                           |
| `S -> sa re (vel:70)`  | les parenthèses séparées, en fin de règle, portent sur toute la règle         |
| `pa:2`                 | le `:` collé fixe la durée du terme ; séparé (`pa :2`), la ligne est refusée   |
| `{re ga}:2`            | le `:` collé fixe la durée du groupe                                          |
| `S -> sa re [stage=1]` | le crochet séparé, en fin de règle, mute un drapeau                           |
| `sitar1.sa`            | le point collé qualifie `sa` par l'acteur `sitar1`                            |
| `sa . re`              | le point séparé découpe la séquence en fragments de durée égale               |
| `sa!(vel:70)`          | le `!` collé ancre le réglage sur `sa` : il voyage avec lui                   |
| `sa !(vel:70)`         | le `!` séparé pose le réglage seul dans la séquence                           |
| `<!depart`             | le point d'attente et le nom qu'il attend forment un seul terme               |

Le tokenizer annote chaque token d'un drapeau `spaceBefore` : c'est lui qui porte cette lecture.

### 4.2 Symboles

```ebnf
symbol      = [ IDENT , "." ] , IDENT ;                          (* acteur.terminal *)
symbol_call = [ IDENT , "." ] , IDENT , "(" , arg_list , ")" ;

arg_list    = arg , { "," , arg } ;
arg         = [ IDENT , ":" ] , arg_value ;
arg_value   = value | backtick_inline ;

compound_sound_object = "|[" , sound_atom , { sound_atom } , "]" ;
sound_atom            = symbol | prolongation | polymetric ;
```

Un terminal qualifié par son acteur s'écrit `acteur.terminal`. Un **objet sonore composé** est une
suite de notes et de prolongations occupant **une** unité d'ordonnancement : son contenu est
concaténé sans blancs en un nom de terminal unique, et la prolongation y étend la note précédente
à l'intérieur de l'objet.

### 4.3 Silences et temps

```ebnf
rest              = "-" ;                            (* occupe une position, le temps s'écoule *)
prolongation      = "_" ;                            (* étend l'événement précédent *)
undetermined_rest = "..." ;                          (* durée calculée par le moteur *)
period            = "." ;                            (* séparateur de fragments égaux *)
numeric_duration  = INT | INT , "/" , INT ;           (* silence de durée rationnelle *)

duration = ":" , ( INT | FLOAT | INT , "/" , INT ) ;  (* collé : C4:2, {A B}:2 *)
```

Le repos indéterminé porte la **représentation minimale** des structures polymétriques : le
compositeur écrit les événements, le moteur calcule les silences qui produisent la structure
temporelle la plus simple.

Le deux-points collé dit ce qu'un élément occupe, en battements. Il ne touche que son hôte : ce qui
l'entoure garde sa durée. Ses portées sont le terminal et le groupe ; une durée détachée en fin de
règle est refusée, elle se colle à son hôte.

Le `.` s'écrit isolé entre deux espaces, `...` en trois caractères collés, `-` isolé — un silence
par occurrence.

### 4.4 Polymétrie et groupement

```ebnf
polymetric = [ label , ":" ] , "{" , voice , { "," , voice } , "}" , { suffix } ;

label      = IDENT ;
voice      = rhs_element+ ;
```

Les accolades portent la **polymétrie** — plusieurs voix simultanées séparées par la virgule — et le
**groupement temporel** — un sous-groupe dans une séquence, une seule voix. Une durée posée sur un
bloc polymétrique en donne le ratio. Une voix est une séquence plate d'éléments.

### 4.5 Simultanéité et instantané — `!`

```ebnf
simultaneous = element_core , "!" , element_core , { "!" , element_core } ;

instant      = "!" , instant_target ;

instant_target = symbol
               | symbol_call
               | setting_bag                   (* !(vel:80)   !(retro)   !(seed:7) *)
               | speed_change ;                      (* ! (/2)   ! (*2/3) *)

speed_change = "(" , ( "/" | "*" ) , ( INT | FLOAT | INT , "/" , INT ) , ")" ;

out_time_object = "!" , IDENT ;
```

`!` marque l'instant : ce qu'il porte ne prend aucun pas dans la séquence. C'est ce qui **suit** le
`!` qui décide de la lecture.

**Entre deux termes**, il les place au même instant : le premier élément — le **primaire** — donne
la position et la durée, et tout ce qui suit se déclenche au même instant en prenant sa durée. Seule
une mutation de drapeau reste de durée zéro.

**En tête d'un terme**, il pose dans le flux un élément instantané, qui prend effet à l'endroit où
il est écrit : un réglage de sortie, un réglage moteur, une re-semence, un changement de vitesse.
Posé seul, un nom devient un **objet hors-temps** : il tient sa place dans l'ordre joué pour une
durée nulle.

| Écriture                        | Sens                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| `C4!(vel:80)` **collé**         | flux **conjoint**, ancré à `C4` — il voyage avec lui et se réplique  |
| `C4 !(vel:80)` **espacé**       | flux, **événement séparé** — posé seul dans la séquence              |
| `B3!C7`                         | **simultané** — les deux notes attaquent au même instant             |
| `!f` en tête, sans primaire     | objet **hors-temps** — posé seul, sans durée                         |
| `!(seed:7)`                     | réglage posé **dans le flux** — élément sans durée                   |
| `C4 !prise`                     | **accord** — le nom y sonne comme co-attaque                         |
| `! (/2)`                        | **changement de vitesse** posé dans le flux — élément sans durée     |

Un sac vaut pour sa portée ; le même sac précédé de `!` vaut pour ce qui suit, au-delà des bords de
règle, jusqu'au prochain sac. Le flux est un **état courant** : une note échantillonne la valeur en
vigueur à son instant d'attaque, et sa portée est **par voix**.

**Précédence**, du plus fort au plus faible : réglage de note `C4(vel:120)` > flux `!(...)` >
portée `(...)` > défauts de déclaration.

### 4.6 Le point d'attente — `<!`

```ebnf
wait = "<!" , IDENT , [ "." , ( IDENT | INT ) ] , { suffix } ;
```

`<!` suspend le flux jusqu'à l'arrivée d'un **trigger** — une occurrence entrante nommée. Le nom
attendu se colle au signe. Écrit après une note, il s'ancre sur elle : la note sonne, puis la suite
attend. C'est un point de synchronisation, de durée zéro.

L'adresse de la source se colle au point d'attente — `<!sync1.60` écoute le numéro 60 de l'entrée
`sync1` — et les points d'attente se chaînent : `<!sync1<!sync2`. **Collé, c'est une adresse ;
espacé, c'est un découpage** : `<!brut . 60` est le point d'attente `brut`, un fragment, puis le
terminal `60`. La forme mixte — point collé au nom, valeur détachée — est refusée, et le message
donne les deux réécritures.

Le type dit ce que l'adresse **est** : un nombre est le numéro brut de l'appareil ; un identifiant
est l'étiquette produite par la table de correspondance.

### 4.7 Les barres — délimiter un nom

```ebnf
variable = "|" , IDENT , "|" ;
```

Les barres délimitent le **nom** d'un non-terminal : `|x|` désigne le non-terminal appelé `x`, ni
plus ni moins. Elles servent quand le nom commencerait par une minuscule, là où il serait sinon pris
pour un terminal. Un nom entre barres est une tête de règle comme une autre.

### 4.8 Wildcards

```ebnf
wildcard = "?" , [ INT ] ;
```

**`?` se lit « ce qu'il y a là ».** Il ne nomme rien : il désigne une **place**, prend le symbole qui
s'y trouve, et cette place est **consommée**. À droite de la flèche, il rejoue ce qu'il a pris.

`?n` ajoute « et le même ailleurs » : toutes les occurrences de `?1` dans une règle désignent le
même symbole. Le `?` nu prend chaque place indépendamment. Une règle qui ne s'applique pas laisse la
chaîne inchangée.

Un wildcard vaut pour **un** symbole ; une règle en porte jusqu'à 32 numérotés.

### 4.9 Gabarits et homomorphismes

```ebnf
template_master = "$" , IDENT , [ "(" , arg_list , ")" ]
                | "$" , "{" , rhs_element+ , "}" ;

template_slave  = "&" , IDENT , [ "(" , arg_list , ")" ]
                | "&" , "{" , rhs_element+ , "}" ;

template_anchor = "$" ;                                (* $ isolé, suivi d'une espace *)
```

`$` capture un motif de groupe — le **maître** —, `&` le rejoue — l'**esclave**. Le nom porte
l'appariement entre les deux, et chaque invocation porte ses paramètres, qui gouvernent l'expansion
de ce qu'elle produit.

**L'esclave rejoue le CHOIX du maître.** Quand le nom capturé désigne une règle à plusieurs
alternatives, les deux invocations donnent la même — c'est ce qui distingue un gabarit de deux
invocations libres.

Un `$` suivi d'une espace, en tête du membre gauche, marque la règle entière comme gabarit maître :
il ancre la règle, et l'ancre reste ouverte jusqu'à sa fermeture. L'espace tranche entre les deux
emplois du signe : collé à un identifiant, `$X` nomme un gabarit ; suivi d'une espace, `$` ancre.

```ebnf
homomorphism_marker = IDENT ;      (* $N14 dhati &N14 — le nom de la table, entre les deux *)
```

Une **table d'homomorphisme** s'invoque par `@homomorphism.<table>`, une par nom, chacune avec ses
sections. Elle porte des correspondances symbole vers symbole, et l'étiquette de la section est le
nom de l'homomorphisme. Elle s'applique **entre un gabarit maître et son esclave**, dont le nom se
pose entre les deux : l'esclave rejoue alors le maître transformé par la table.

**Un nom de table est un identifiant.** Les signes que le langage emploie ailleurs sont refusés à
cette place, et un nom absent de la librairie est refusé au parse.

### 4.10 Liaisons

```ebnf
tie_start    = symbol , "~" ;                        (* ouvre : attaque au début *)
tie_continue = "~" , symbol , "~" ;                  (* continue à travers l'événement *)
tie_end      = "~" , symbol ;                        (* ferme : relâche à la fin *)
```

Un son est tenu à travers d'autres événements, par-dessus les sons intercalés.

### 4.11 Chaîne vide

```ebnf
nil_string = "lambda" ;
```

Efface le non-terminal. Un membre droit vide fait la même chose.

### 4.12 Réglages — `()`

```ebnf
setting_bag = "(" , setting , { "," , setting } , ")" ;

setting = [ subject , ":" ] , KEY , [ "." , ( IDENT | INT ) ] , ":" , raw_value  (* clé et valeur *)
        | [ subject , ":" ] , KEY ;                                             (* clé nue *)

subject   = "*" | IDENT ;
raw_value = (* tout texte jusqu'au prochain "," ou au délimiteur fermant *) ;
```

**Le nom d'un réglage suffit à savoir où il va.** Chaque nom appartient à une librairie, et chaque
librairie a un destinataire : le nom du réglage porte le sien. Une clé
qu'aucune librairie invoquée ne porte arrête la compilation.

Tout ce qui suit le `:` jusqu'au prochain `,` ou au délimiteur fermant est la **valeur brute** : le
destinataire l'interprète.

**La place du sac donne la portée** :

| Portée      | Reconnaissance                | Exemple                    |
| ----------- | ----------------------------- | -------------------------- |
| **symbole** | collé au symbole              | `C4(vel:120)`              |
| **groupe**  | collé au `}`                  | `{A B}(vel:100)`           |
| **règle**   | espacé, en fin de membre droit | `S -> C4 D4 (mode:random)` |
| **globale** | `@catégorie.clé:valeur`       | `@time.tempo:120`          |

Une paire peut porter un **sujet** devant la clé pour viser plus finement. Le sujet vaut **par
paire** : sans sujet, la portée elle-même comme unité ; `*` désigne chaque terminal de la portée ;
un nom désigne les terminaux de ce nom. Pour un signal, le sujet décide l'**horloge** ; pour un
réglage statique, les deux écritures donnent le même effet.

Une règle porte **un** sac de portée. Pour en poser plusieurs, chacun prend son `!` et se pose dans
le flux. Quand un non-terminal se résout entièrement en réglages, un sac tient lieu de membre droit
et la règle produit des éléments de durée nulle.

Le point appelle un composant à l'intérieur d'une clé — `(cc.98:45)` désigne le contrôleur 98 —,
comme il le fait partout ailleurs. Quels contrôles portent un numéro est déclaré en librairie.

Un **module** invoqué dans un sac s'insère entre le terminal et sa sortie : c'est un **calque**, et
sa portée en donne l'étendue. Le même nom pose un calque dans un sac, ou un **geste** écrit nu dans
le flux — le premier vit sur la portée et meurt avec elle, le second change la topologie à cet
instant et ça reste après lui.

Quand plusieurs portées posent le **même paramètre** sur une même note, les réglages **s'empilent en
série**, de l'intérieur vers l'extérieur. Une valeur simple, elle, ne s'empile pas : le plus local
gagne. Un filtre se traverse, une intensité se choisit.

### 4.13 Les clés que le moteur consomme

Elles vivent dans la librairie `engine`, sauf `tempo` et `tempx` qui vivent dans `time`.

```
/N   *N     les deux opérateurs temporels — fraction (*3/2) et décimal (/1.5) admis
mode        mode du bloc (ord, random, lin, sub, sub1, tem, poslong) — défaut : ord
scan        sens du parcours par règle (left, right, rnd) — défaut : rnd
weight      poids de la règle (entier, K-param, ou inf) — à zéro, la règle est écartée
on_fail     gestion d'échec (skip, retry(N), fallback(X)) — défaut : skip
meter       signature rythmique — (meter:7/8), (meter:4+4/4)
seed        graine du tirage
maxitems    nombre d'items produits
rndtime     déviation aléatoire des attaques, en millisecondes
tempo       le métronome de la scène, en battements par minute
tempx       multiplicateur de vitesse de la règle — (tempx:2/3) ralentit d'un tiers
```

Une procédure moteur prend son argument entre parenthèses, à l'intérieur du sac :
`(on_fail:retry(2))`, `(on_fail:fallback(Autre))`.

Un **poids infini** — `(weight:inf)` — donne une priorité absolue : la règle est toujours choisie
quand elle apparie. Un **K-param** initialise (`weight:K1=3`) ou référence (`weight:K1`) une valeur
courante, pour les distributions probabilistes du mode `lin`.

### 4.14 Backticks

```ebnf
backtick_inline     = "`" , [ TAG , ":" ] , CODE , "`" ;   (* dans un paramètre : rend une valeur *)
backtick_standalone = [ IDENT , "." ] , "`" , [ TAG , ":" ] , CODE , "`" ;
                                                           (* dans le flux : terminal de plein droit *)
```

Un backtick porte du code, et le tag en tête est une **adresse** : il nomme le langage, et le
langage nomme son `interpreter`. Il prend deux formes.

**Autonome** — le backtick occupe une position à lui seul et joue son code quand la dérivation
l'atteint. En tête de scène, il prépare le moteur au chargement ; dans le flux d'une règle, il est
un terminal de plein droit et joue à son instant. Son tag est requis, ou bien un acteur `eval.<X>`
le qualifie par le point.

**En ligne** — le backtick occupe un paramètre et rend une valeur, évaluée par l'`interpreter` du
symbole qui le porte ; il hérite du tag de ce symbole. Un langage employable en ligne le déclare en
librairie, avec la convention de ce qu'il rend.

`patch:` est le langage du câblage — il ne sonne pas et n'occupe pas de temps.

### 4.15 Accolades brutes

```ebnf
raw_brace = "{" | "}" | "," ;
```

Émises quand une accolade ou une virgule paraît comme terminal brut dans le membre droit, sans
former un bloc polymétrique équilibré dans la même règle — les méta-grammaires les emploient. Les
accolades peuvent être déséquilibrées à travers plusieurs règles, la durée `}:N` se propageant de la
fermante vers l'ouvrante correspondante.

---

## Couche 5 — Lexèmes

```ebnf
IDENT       = letter , { letter | digit | ( "_" , ( letter | digit ) ) | "#" | "'" | '"' }
            | letter , { letter | digit | ( "_" , ( letter | digit ) ) | "#" | "'" | '"' } ,
              "-" , { letter | digit | ( "_" , ( letter | digit ) ) | "#" | "'" | '"' | "-" } ;
INT         = digit+ ;
FLOAT       = [ "-" ] , digit+ , "." , digit+ ;
STRING      = '"' , { (* tout caractère sauf " *) } , '"' ;
value       = [ "-" ] , INT | FLOAT | IDENT
            | INT , { "+" , INT } , "/" , INT ;   (* 7/8, 4+4/4 — la signature rythmique *)
KEY         = IDENT ;
TAG         = IDENT ;
CODE        = (* tout caractère sauf ` non échappé *) ;
TEXT        = (* tout caractère jusqu'à fin de ligne *) ;
letter      = "a"-"z" | "A"-"Z" ;
digit       = "0"-"9" ;
blank_line  = (* ligne vide ou espaces seuls *) ;
```

**Contraintes lexicales.**

- Un `_` **interne** est absorbé dans le nom quand une lettre ou un chiffre le suit immédiatement :
  `sa_4`, `Up_Down`, `just_intonation`.
- Un `_` **traînant** arrête la lecture du nom : le tokenizer émet une prolongation par underscore.
  `si3_____` est `si3` suivi de cinq prolongations.
- Un `-` **traînant** est un silence : `do4-` est `do4` suivi d'un
  silence, et s'écrit donc aussi `do4 -`.
- Un `-` **interne** est autorisé dans les noms de non-terminaux : `Tr-11`, `my-var`.
- **Entre crochets**, `[times-1]` est une mutation de drapeau : le parser décompose le motif
  identifiant-tiret-nombre en drapeau, opérateur et valeur.
- `#` est autorisé dans les identifiants, pour les altérations : `C#4`, `F#2`.
- Un nombre nu dans le flux est un silence, et le nombre en donne la durée.

---

## Traduction vers BP3

| BPScript | BP3 | Notes |
|----------|-----|-------|
| `->` `<-` `<>` | `-->` `<--` `<->` | direction |
| `$X` / `&X` | `(=X)` / `(:X)` | gabarit maître / esclave, sur un symbole |
| `${A S B}` / `&{A S B}` | `(=A S B)` / `(:A S B)` | sur un groupe |
| `$X tabla_stroke &X` | `(=X) tabla_stroke (:X)` | homomorphisme entre maître et esclave |
| `~` | `&` | liaison |
| `#X` | `#X` | symbole apparié ≠ X, consomme une position |
| `#?` | `#?` | frontière |
| `!f` | `<<f>>` | objet hors-temps |
| `-` `_` `.` | `-` `_` `.` | silence, prolongation, fragment |
| `...` | `_rest` | repos indéterminé |
| `[X==N]` / `[X-N]` | `/X=N/` / `/X-N/` en membre gauche | garde |
| `[X=N]` / `[X]` | `/X=N/` / `/X/` en membre droit | mutation, drapeau nu |
| `C4(vel:120)` | `C4 _script(CT 0)` | réglage sur un symbole |
| `S -> C4 D4 (vel:80)` | `_script(CT 0) C4 D4` | réglage de règle |
| `{A B}(vel:100)` | `_script(CT 0_s) {A B} _script(CT 0_e)` | réglage de groupe |
| `!(vel:80)` | `_script(CT n)` | réglage posé dans le flux |
| `!(retro)` | `_retro` | clé nue : sans parenthèses |
| `(rotate:2)` | `_rotate(2)` | clé avec valeur : avec parenthèses |
| `(shuffle)` / `(order)` | `_rndseq` / `_ordseq` | injectés en tête du groupe ou du membre droit |
| `!(seed:N)` | `_srand(N)` | re-semence au point d'apparition |
| `@mode:random` | `RND` | mode du bloc |
| `(scan:left)` | `LEFT` | sens du parcours |
| `(weight:50)` / `(weight:inf)` | `<50>` / `<inf>` | poids |
| `(meter:4+4/6)` | `4+4/6` avant le membre droit | signature rythmique |
| `! (/2)` | `_tempo(2/1)` | changement de vitesse dans le flux |
| `{v1, v2}:2` | `{2, v1, v2}` | durée d'un bloc polymétrique |
| `A4:1/2` | `{1/2, A4}` | durée d'une note |
| `-----` | `-----` | séparateur de sous-grammaires |
| `lambda` | `lambda` | chaîne vide |
| `<!sync1` | `<<W1>>` | point d'attente |
| `@template` | `TEMPLATES:` | catalogue des formes |
| `?` / `????` | `_` / `____` | terminal effacé, dans un gabarit |
| `($0 ???)` | `(@0 ___)` | groupe apparié, dans un gabarit |
| `/1` | `*1/1` | échelle, dans un gabarit |
