# BPscript — Grammaire EBNF

Version 0.6 — dérivée de BPSCRIPT_VISION.md et validée par 44 traductions de scènes BP3.

Notation : ISO 14977 (`=` définition, `,` concaténation, `|` alternative,
`[ ]` optionnel, `{ }` répétition 0+, `+` répétition 1+, `"..."` littéral,
`(* ... *)` commentaire).

---

## Couche 1 — Structure globale

```ebnf
scene       = { directive | actor_directive | scene_directive | expose_directive
              | map_directive | cc_directive | duration_directive
              | macro_directive | alias_directive | label_directive
              | declaration | cv_instance | macro
              | backtick_orphan | comment | blank_line }
              , subgrammar+ , [ template_section ] ;

actor_directive  = "@" , "actor" , IDENT , actor_props+ ;
scene_directive  = "@" , "scene" , IDENT , STRING ;        (* @scene verse "verse.bps" *)
expose_directive = "@" , "expose" , ( "[" , IDENT , "]" )+ ; (* @expose [intensity] [energy] *)
cc_directive     = "@" , "cc" , [ ":" ] , cc_pair , { "," , cc_pair } ; (* @cc breath:2, expression:11 *)
duration_directive = "@" , "duration" , ":" , ( INT | FLOAT ) , [ "b" | "s" ] ; (* @duration:16b, @duration:4.5s *)
macro_directive  = "@" , "macro" , IDENT , [ "(" , IDENT , { "," , IDENT } , ")" ]
                 , "=" , rhs ;                 (* @macro kick = (vel:120), @macro accent(x) = x(vel:120) *)
alias_directive  = "@" , "alias" , IDENT , "=" , map_endpoint ;  (* @alias breath = cc:2 *)
label_directive  = "@" , "label" , IDENT ;     (* @label groove *)
map_directive    = "@" , "map" , map_endpoint , map_arrow , map_endpoint ;

cc_pair    = IDENT , ":" , INT ;               (* breath:2 — nom:numéro CC *)
map_arrow  = "->" | "<->" | "<-" ;
map_endpoint = "cc" , ":" , INT , [ "(" , kv_pairs , ")" ]      (* cc:74, cc:1(min:0,max:100) *)
             | "osc" , ":" , ( "/" , IDENT )+ , [ "(" , kv_pairs , ")" ] (* osc:/sc/ready *)
             | "<!" , IDENT                                      (* <!trigger *)
             | "[" , IDENT , "]"                                 (* [flag] *)
             | "sys" , "." , IDENT                               (* sys.play — commande transport *)
             | IDENT , "." , IDENT                               (* scene.command ou actor.flag *)
             | IDENT ;                                           (* alias CC nommé *)

kv_pairs = kv_pair , { "," , kv_pair } ;
kv_pair  = IDENT , ":" , ( INT | FLOAT | IDENT ) ;

```

- `directive` — imports et configuration globale (`@...`)
- `declaration` — déclaration de terminal (type + runtime)
- `cv_instance` — instanciation d'objet CV/signal
- `macro` — définition de macro (réécriture textuelle)
- `backtick_orphan` — code externe taggé au top-level
- `subgrammar` — bloc de règles, au moins un requis

### `directive`

```ebnf
directive = "@" , directive_body ;

directive_body = IDENT                              (* @core, @controls *)
               | IDENT , "." , IDENT                (* @alphabet.western — subkey access *)
               | IDENT , ":" , IDENT                (* @routing:studio — binding simple *)
               | IDENT , "." , IDENT , ":" , IDENT  (* @alphabet.western:midi — subkey + binding *)
               | IDENT , "." , IDENT , "(" , param_pairs , ")"  (* @alphabet.raga(transport=sc, eval=python) — not yet implemented *)
               | IDENT , ":" , value                (* @tempo:120, @meter:3/4 *)
               | "+"                                (* @+ — append to previous subgrammar *)
               | IDENT , "(" , alias_list , ")"     (* @alphabet.western(A:La) — résolution conflit *)
               | "actor" , IDENT , actor_props+     (* @actor sitar alphabet:sargam ... — voir actor_directive *)
               | "scene" , IDENT , STRING           (* @scene verse "verse.bps" — voir scene_directive *)
               | "expose" , ( "[" , IDENT , "]" )+  (* @expose [intensity] — voir expose_directive *)
               | "cc" , [ ":" ] , cc_pair , { "," , cc_pair }  (* @cc breath:2 — voir cc_directive *)
               | "map" , map_endpoint , map_arrow , map_endpoint  (* @map cc:1 -> [x] — voir map_directive *)
               | "duration" , ":" , ( INT | FLOAT ) , [ "b" | "s" ]  (* @duration:16b — voir duration_directive *)
               | "timepatterns" , ":" , tp_pair , { "," , tp_pair }  (* @timepatterns: t1=1/1, t2=3/2 *)
               ;

tp_pair = IDENT , "=" , INT , "/" , INT ;  (* t1=1/1 — nom = numérateur/dénominateur *)

actor_props = IDENT , ":" , actor_value ;
actor_value = IDENT                                 (* alphabet:sargam *)
            | IDENT , "(" , param_pairs , ")" ;     (* transport:midi(ch:10) *)

(* Propriétés connues d'un acteur :
   alphabet   — vocabulaire de symboles (requis)
   scale      — gamme/degrés → pitch via tempérament (si pitched)
   sounds     — définitions per-terminal: timbre, percussions, samples (si non-pitched ou timbre spécifique)
   transport  — destination de rendu (requis)
   eval       — runtime pour backticks (si différent de transport)
*)


param_pairs = param_pair , { "," , param_pair } ;
param_pair  = IDENT , "=" , IDENT ;               (* transport=sc, eval=python *)

alias_list = alias , { "," , alias } ;
alias      = IDENT , ":" , IDENT ;
```

### `declaration`

```ebnf
declaration = [ "@" ] , TYPE , IDENT , ":" , ACTOR_OR_RUNTIME ;

TYPE              = "gate" | "trigger" | "cv" ;
ACTOR_OR_RUNTIME  = IDENT ;               (* acteur name (preferred) ou legacy runtime name *)
```

Format préféré : `@gate Sa:midi`. Format legacy (sans `@`) : `gate Sa:sc` — toujours supporté.
Avec `@actor`, les symboles sont qualifiés par dot notation dans les règles :
`sitar.Sa` → le terminal `Sa` résolu via l'acteur `sitar`.

### `cv_instance`

```ebnf
cv_instance = IDENT , "(" , IDENT , "," , IDENT , ")" , "=" , cv_rhs ;
cv_rhs = IDENT , "." , IDENT , "(" , arg_list , ")"    (* lib.type(args) *)
       | backtick_inline ;                               (* `js: code` *)
```

### `macro`

```ebnf
macro = IDENT , "(" , param_list , ")" , "=" , rhs ;

param_list = IDENT , { "," , IDENT } ;
```

### `backtick_orphan`

```ebnf
backtick_orphan = "`" , IDENT , ":" , CODE , "`" ;
```

Le tag (`sc:`, `py:`, `tidal:`) est obligatoire pour les backticks non attachés
à un symbole.

### `comment`

```ebnf
comment = "//" , TEXT ;
```

---

## Couche 2 — Sous-grammaires

```ebnf
subgrammar = rule+ , [ separator ] ;

separator  = "-----" , { "-" } ;           (* 5+ tirets, sépare les sous-grammaires *)
```

### Directive de mode

```ebnf
mode_directive = "@" , "mode" , ":" , MODE_VALUE , [ "(" , mode_modifier , { "," , mode_modifier } , ")" ] ;

MODE_VALUE     = "random" | "ord" | "sub" | "sub1" | "lin" | "tem" | "poslong" ;

mode_modifier  = SUBGRAMMAR_KEY                       (* flag : destru, striated, smooth *)
               | SUBGRAMMAR_KEY , ":" , value ;        (* avec valeur : mm:60 *)

SUBGRAMMAR_KEY = (* clés de la section "subgrammar" de controls.json :
                   destru, striated, smooth, mm *) ;
```

Les règles d'une même sous-grammaire partagent le mode déclaré via `@mode:...`.
Le mode est défini par une directive `@mode:X` (ex: `@mode:random`, `@mode:ord`) qui s'applique
à la sous-grammaire qui suit, jusqu'au prochain séparateur `-----`.
Le séparateur `-----` marque la frontière entre sous-grammaires.

Les **modificateurs de mode** entre `()` sont des directives de sous-grammaire émises
en preamble BP3 (entre la ligne mode et les règles). Ils sont déclarés dans la section
`subgrammar` de `controls.json`.

Exemples :
- `@mode:lin(destru)` → `LIN` + `_destru` en preamble
- `@mode:random(striated, mm:60)` → `RND` + `_striated _mm(60)` en preamble
- `@mode:ord(smooth)` → `ORD` + `_smooth` en preamble

Les mêmes directives peuvent aussi apparaître en global avec `@` (`@striated`, `@mm:60`),
auquel cas elles s'appliquent au preamble de la première sous-grammaire.

**Mode SUB/SUB1** : en mode substitution, les symboles en LHS sont aussi des terminaux.
Les règles SUB remplacent des patterns dans la séquence ; ce qui reste après toutes les
itérations doit être dans l'alphabet pour être joué. Le transpileur inclut donc les symboles
LHS des sous-grammaires SUB/SUB1 dans l'alphabet (contrairement aux modes ORD/RND où
les symboles LHS sont des non-terminaux).

### Section templates (optionnelle)

```ebnf
template_section = "@" , "templates" , NEWLINE , template_entry+ ;

template_entry   = "[" , INT , "]" , scale_factor , template_body ;

scale_factor     = "/" , INT                        (* /1, /2 — ratio d'échelle *)
                 | "*" , INT , "/" , INT ;           (* *1/2 — forme explicite *)

template_body    = template_element+ ;

template_element = "?"                              (* wildcard : un terminal *)
                 | "?" , { "?" }                    (* wildcards compacts : ???? = ? ? ? ? *)
                 | "."                              (* period — séparateur de fragments *)
                 | "(" , "$" , INT , template_body , ")"   (* bracket master : ($0 ???) *)
                 | "(" , "$" , INT , ")"            (* bracket master vide : ($1 ) *)
                 ;
```

Les templates décrivent la **structure temporelle** des items produits par les règles
template (`<>`). Chaque `?` représente un slot terminal (sound object).

La section `@templates` est **optionnelle** :
- Si absente, BP3 génère les templates automatiquement pendant la production
- Si présente, BP3 utilise les templates spécifiées pour le matching en mode analyse
- En mode `@mode:tem`, les templates servent de contraintes structurelles

Exemples :
```bpscript
@templates
[1] /1 ???????                    // 7 terminaux en séquence
[2] /1 ?????????                  // 9 terminaux
[3] /1 ($0 ???)($1 )              // structure récursive : master(3 slots) + slave(vide)
```

Traduction BP3 :
```
TEMPLATES:
[1] *1/1 _______
[2] *1/1 _________
[3] *1/1 (@0 ___)(@1 )
```

| BPscript | BP3 | Notes |
|----------|-----|-------|
| `?` | `_` | wildcard terminal (un slot) |
| `????` | `____` | wildcards compacts (4 slots) |
| `.` | `.` | period (identique) |
| `($0 ???)` | `(@0 ___)` | bracket master ($ = master en BPscript) |
| `($1 )` | `(@1 )` | bracket slave vide |
| `/1` | `*1/1` | facteur d'échelle |

---

## Couche 3 — Règles

```ebnf
rule = [ guard ] , { context } , lhs , ARROW , rhs
       , [ runtime_qualifier ] , { qualifier } ;

ARROW = "->" | "<-" | "<>" ;
```

Le `runtime_qualifier` suffixe optionnel sur la règle (ex: `S -> C4 D4 E4 (vel:80)`)
s'applique à toute la portée de la règle.

### `guard`

```ebnf
guard = "[" , guard_expr , "]" , { "[" , guard_expr , "]" } ;     (* multi-guard = AND *)

guard_expr = IDENT , COMPARE_OP , flag_value      (* test pur *)
           | IDENT , MUTATE_OP , INT               (* test + mutation atomique *)
           | IDENT                                  (* bare flag : non-zéro test *)
           ;

COMPARE_OP = "==" | "!=" | ">" | "<" | ">=" | "<=" ;
MUTATE_OP  = "+" | "-" ;

flag_value = INT | IDENT ;                          (* littéral ou autre flag *)
```

La forme `[flag-N]` décrémente ET teste > 0 atomiquement (sémantique BP3).
La forme `[flag>N]` teste sans muter.
La forme `[Ideas]` (bare flag) teste que le flag est non-zéro → `/Ideas/` en BP3.

### `context`

```ebnf
context = positive_context | negative_context ;

positive_context = "(" , context_sym+ , ")" ;        (* contexte positif *)
negative_context = "#" , "(" , context_sym+ , ")"    (* négatif sur groupe *)
                 | "#" , context_sym                  (* négatif sur un seul symbole *)
                 | "#" , "?" ;                       (* boundary — pas de symbole ici *)

context_sym      = symbol | wildcard | "{" | "}" | "," ;  (* symboles, wildcards ?N, braces *)
```

Les contextes peuvent apparaître avant le LHS (contexte gauche), après le RHS
(contexte droit), ou dans le RHS (préservés pour les futures applications).

### `lhs`

```ebnf
lhs = lhs_element+ ;

lhs_element = symbol
            | variable
            | wildcard
            | context
            | "{" | "}" | "," ;                    (* méta-grammaires : braces comme terminaux *)
```

### `rhs`

```ebnf
rhs = rhs_element* ;                               (* peut être vide via lambda *)
```

### `qualifier`

Le `qualifier` en fin de règle est un `engine_qualifier` (moteur BP3 uniquement).
Les paramètres runtime utilisent `()` — voir section 4.0.

```ebnf
qualifier = engine_qualifier ;
```

Définition complète de `engine_qualifier` et `runtime_qualifier` en section 4.0.

Syntaxe double acceptée : `[weight:3, scan:left]` ou `[weight:3] [scan:left]`.

**Opérateurs temporels** : `[/2]`, `[\2]`, `[*3]`, `[**3]` — notation directe des
4 opérateurs BP3. Portée flexible : sur un symbole (`A[/2]`), un groupe (`{A B}[/2]`),
ou un polymetric (`{v1, v2}[/2]`). Compilé en préfixe inline (`/2 A`, `/2 A B`, etc.).

**Ratio polymétrique** : `[speed:N]` sur un polymetric multi-voix contrôle le ratio
de tempo du conteneur. `{v1, v2}[speed:2]` → `{2, v1, v2}`. C'est une propriété
du conteneur `{}`, distincte des opérateurs temporels.

**K-params** : `[weight:K1=3]` initialise le K-param K1 à 3. `[weight:K1]` référence
la valeur courante. Utilisé en mode LIN pour les distributions probabilistes (ex: jeu de dés
de Mozart, avec K1-K11 simulant 2 dés en cloche 1,2,3,4,5,6,5,4,3,2,1).

**Poids infini** : `[weight:inf]` — priorité absolue. La règle est toujours choisie
quand elle matche. Compilé en `<inf>` pour BP3. Utilisé en mode LIN pour forcer
une substitution.

**Clés nues (flags)** : `[destru]` sans `:value` = flag booléen (`true`).
Compilé en preamble de la sous-grammaire (`_destru` entre la ligne mode et les règles).
Clés nues reconnues : `destru`, `striated`, `smooth`.

---

## Couche 4 — Éléments RHS

```ebnf
rhs_element = [ prefix_qualifier ] , element_core , [ suffix_qualifier ] , [ "@" , IDENT ] ;
(* Le @ suffixe attache un label à l'élément : C4@kick, {A B}@groove. Sans espace avant @. *)

prefix_qualifier = engine_qualifier ;
(* [] collé à droite de l'élément : [/2]A — déterminé par absence d'espace après ] *)

suffix_qualifier = engine_qualifier | runtime_qualifier ;
(* [] ou () collé à gauche de l'élément : A[weight:50], A(vel:80) — déterminé par absence d'espace avant [ ou ( *)

element_core = symbol
             | symbol_call
             | rest | prolongation | undetermined_rest
             | period
             | numeric_duration
             | polymetric
             | simultaneous
             | out_time_object
             | trigger_in
             | variable
             | wildcard
             | template_master | template_slave
             | tie_start | tie_continue | tie_end
             | nil_string
             | backtick_standalone
             | context
             | raw_brace
             | flag_bracket ;
```

### 4.0 Qualificateurs — `[]` engine vs `()` runtime

Deux syntaxes selon la destination :

| Syntaxe | Destination | Exemples |
|---------|-------------|----------|
| `[]` | Moteur BP3 | `[mode:random]`, `[weight:50]`, `A[/2]`, `[scale:just C4]` |
| `()` | Runtime/dispatcher | `(vel:80)`, `(wave:sawtooth)`, `(filter:300, filterQ:5)` |

#### `[]` — Qualificateurs moteur (engine)

```ebnf
engine_qualifier = "[" , engine_pair , { "," , engine_pair } , "]"
                 | "[" , tempo_op , "]" ;

tempo_op = ( "/" | "*" ) , ( INT | FLOAT | INT , "/" , INT ) ;
           (* / = plus rapide, * = plus lent *)
           (* [/2] → _tempo(2/1) bracket, [*3/2] → _tempo(2/3) bracket *)
           (* [*1.5] → _tempo(1/1.5) bracket *)
           (* Portée déterminée par attachement : terminal, {}, ou règle *)

engine_pair = ENGINE_KEY , ":" , raw_value
            | ENGINE_KEY ;                              (* flag nu : [destru] *)

ENGINE_KEY  = "mode" | "scan" | "speed" | "weight" | "on_fail"
            | "tempo" | "meter" | "scale" | "retro" | "rotate"
            | "keyxpand" | "repeat" | "failed" | "stop" | "goto"
            | "striated" | "smooth" ;

raw_value   = (* tout texte jusqu'au prochain "," ou "]" *) ;
```

```
[mode:random]          → RND en mode de sous-grammaire
[weight:50]            → <50>
A[/2]                  → /2 A
[scale: just_intonation C4] → _scale(just intonation,C4)
[retro]                → _retro (clé nue = sans parenthèses)
[rotate:2]             → _rotate(2) (clé avec valeur = avec parenthèses)
```

**Contrôles engine sans argument** : quand une clé engine est utilisée nue (`[retro]`,
`[destru]`), la valeur interne est `true`. L'encodeur émet le nom BP3 **sans parenthèses**
(`_retro`, `_destru`). Quand une valeur est fournie (`[rotate:2]`), l'encodeur émet
avec parenthèses (`_rotate(2)`).

#### `()` — Qualificateurs runtime

```ebnf
runtime_qualifier = "(" , runtime_pair , { "," , runtime_pair } , ")" ;

runtime_pair = RUNTIME_KEY , ":" , value ;

RUNTIME_KEY  = (* nom présent dans lib/controls.json section "runtime" :
                  vel, chan, pan, wave, attack, release, detune,
                  filter, filterQ, transpose, ins, staccato, legato,
                  mod, pitchbend, volume, etc. *) ;
```

Compilé en `_script(CT n)` pour BP3 — le dispatcher interprète au playback.

```
(vel:80)               → _script(CT 0) avec {vel: 80}
(wave:sawtooth, vel:100, filterQ:8) → _script(CT 0) avec {wave:"sawtooth", vel:100, filterQ:8}
```

#### Position — règles d'espacement

L'**espace** (ou son absence) détermine si un qualificateur est un **préfixe** ou
un **suffixe**. C'est la règle fondamentale de positionnement en BPscript :

| Syntaxe | Espacement | Interprétation |
|---------|------------|----------------|
| `A[X]` | collé à gauche | suffixe de A |
| `[X]A` | collé à droite | préfixe de A |
| `A [X]B` | espace à gauche, collé à droite | préfixe de B |
| `A[X] B` | collé à gauche, espace à droite | suffixe de A |
| `A [X] B` | espace des deux côtés | **erreur** — utiliser `A ![X] B` |
| `A[X]B` | collé des deux côtés | **erreur** — ambigu |

Mêmes règles pour `()` — mais `()` est **toujours suffixe** (collé à gauche) :

| Syntaxe | Interprétation |
|---------|----------------|
| `A(vel:80)` | suffixe de A ✅ |
| `(vel:80) A` | **erreur** — utiliser `!(vel:80) A` |
| `A (vel:80)` | suffixe de A si fin de règle/voix, sinon **erreur** |

Pour positionner un contrôle **librement dans le flux** (entre deux éléments),
utiliser `!()` ou `![]` :
- `A !(vel:80) B` → `A _script(CT 0) B` — contrôle instantané positionné entre A et B
- `{![retro] A B}` → `{_retro A B}` — contrôle engine en tête de voix
- `{!(chan:1) C8 - - -, !(chan:2) - C7}` → `{_script(CT 0) C8 - - -, _script(CT 1) - C7}`

Deux portées pour les suffixes de règle :

- **Règle** : `S -> C4 D4 E4 (vel:80)` — `()` en fin de RHS, s'applique à toute la règle.
  Compilé en : `_script(CT 0) C4 D4 E4`

- **Groupe** : `{A B}(vel:100)` — `()` collé au `}`, s'applique au groupe.
  Compilé en : `_script(CT 0) {A B}`

**Contrôles instantanés dans le RHS** : quand un non-terminal se résout en purs
contrôles (aucun élément temporel), utiliser `!()` pour les positionner dans le flux :

```bpscript
Pull0 -> !(pitchbend:0)                                          // → _script(CT n)
StartPull -> !(pitchcont) !(pitchrange:500) !(pitchbend:0)        // → _script(CT 0) _script(CT 1) _script(CT 2)
```

Ce pattern existe dans les grammaires à couches (vina, vina2, vina3) où les
non-terminaux intermédiaires occupent du temps dans la couche supérieure et se
résolvent en instructions moteur dans la couche inférieure.

### 4.1 Symboles

```ebnf
symbol      = IDENT , [ ":" , IDENT ] ;              (* terminal ou non-terminal, optionnel :acteur *)
symbol_call = IDENT , [ ":" , IDENT ] , "(" , arg_list , ")" ;  (* appel avec paramètres, optionnel :acteur *)

arg_list    = arg , { "," , arg } ;
arg         = [ IDENT , ":" ] , arg_value ;           (* positionnel ou nommé *)
arg_value   = value | backtick_inline ;
```

### 4.2 Silences et temps

```ebnf
rest              = "-" ;                            (* silence déterminé *)
prolongation      = "_" ;                            (* étend l'événement précédent *)
undetermined_rest = "..." ;                          (* durée calculée par le moteur — compilé en _rest *)
period            = "." ;                            (* séparateur de fragments égaux *)
numeric_duration  = INT | INT , "/" , INT ;           (* silence de durée rationnelle *)
```

`numeric_duration` : un nombre nu dans le flux = silence de durée rationnelle.
**À confirmer avec Bernard** : différence exacte entre `-` et `1`.

`undetermined_rest` : `...` en BPscript est compilé en `_rest` pour BP3 (commande built-in,
token `T0, 17` dans `Encode.c`). Utilisé dans les voix polymétriques — le moteur calcule
la durée donnant l'expression la plus simple. **Attention** : trois points littéraux `...`
en BP3 seraient interprétés comme trois periods (`.` = `T0, 7`), pas comme un repos
indéterminé. Le caractère historique `…` (U+2026) a été abandonné en 2022 (compat UTF-8).

### 4.3 Polymétrie

```ebnf
polymetric = [ label , ":" ] , "{" , voice , { "," , voice } , "}"
             , [ engine_qualifier ] , [ runtime_qualifier ] ;

label      = IDENT ;    (* étiquette UI, metadata pure — ignorée par l'encoder *)

voice      = rhs_element+ ;
```

Les contrôles à l'intérieur d'une voix se positionnent avec `!()` et `![]` :
`{!(chan:1, vel:120) C8 - - -, !(chan:1, vel:100) - C7 C7 C7}`.
La position dans le source = la position dans la sortie BP3.

Le ratio de tempo BP3 (`{2, voix1, voix2}`) s'exprime via `[speed:N]` :
`{voix1, voix2}[speed:2]`.

### 4.4 Instantanéité (`!`)

```ebnf
instant = "!" , instant_target ;

instant_target = symbol                              (* trigger : !dha → <<dha>> *)
               | symbol_call                         (* trigger avec params : !dha(vel:120) *)
               | runtime_qualifier                   (* contrôle runtime : !(transpose:2) → _script(CT n) *)
               | engine_qualifier                    (* contrôle engine : ![retro] → _retro *)
               ;
```

`!` marque un événement **instantané** (zéro durée) dans le flux temporel.

Trois usages :

- **Attaché** à un primaire (`Sa!dha`) : le primaire définit la durée, le secondaire
  se déclenche au même instant. Compilé en `Sa <<dha>>`.
- **Standalone symbole** (`!f`) : out-time object — déclenché hors-temps, sans durée.
  Compilé en `<<f>>`.
- **Standalone contrôle** (`!(transpose:2)`, `![retro]`) : instruction instantanée
  positionnée dans le flux. La position dans la séquence détermine le moment d'application.
  Compilé en `_script(CT n)` ou `_retro` etc.

Chaînable : `Sa!dha!spotlight`.

Exemples avec contrôles :
```
{!(transpose:2) D}        → {_script(CT 0) D}       // préfixe dans la voix
{D !(transpose:2)}        → {D _script(CT 0)}       // suffixe dans la voix
{![retro] A B}             → {_retro A B}           // engine prefix
Sa !(vel:80) Re            → Sa _script(CT 0) Re     // entre deux symboles
```

Ceci remplace le mécanisme de "portée voix" : au lieu de transformer silencieusement
un suffixe en préfixe, l'utilisateur positionne explicitement le contrôle dans le flux
avec `!`. La position BPscript = la position BP3.

### 4.5 Out-time object (`!` standalone)

```ebnf
out_time_object = "!" , IDENT ;                      (* !f → <<f>> en BP3 *)
```

Objet hors-temps : déclenché sans occuper de durée dans la séquence.
Utilisé quand un non-terminal se résout en pur déclenchement.

Note : `!symbol` et `!(control)` / `![control]` sont tous des formes de `!` standalone.
La distinction est que `!symbol` produit un out-time object `<<symbol>>` tandis que
`!(key:value)` et `![key]` produisent des tokens de contrôle (`_script(CT n)`, `_retro`, etc.).

### 4.6 Trigger entrant (`<!`)

```ebnf
trigger_in = "<!" , IDENT , [ qualifier ] ;
```

Point de synchronisation — attend un signal externe.
Chaînable : `<!sync1<!sync2`. Qualifiable : `<!sync1[timeout:5000]` (* not yet implemented *).
`<!` can also be attached to a symbol: `Sa<!sync1` produces a combined SymbolWithTriggerIn node.

### 4.7 Variables (homomorphismes)

```ebnf
variable = "|" , IDENT , "|" ;
```

### 4.8 Wildcards (captures)

```ebnf
wildcard = "?" , [ INT ] ;
```

`?` = anonyme, `?1` = capture nommée.

### 4.9 Templates

```ebnf
template_master = "$" , IDENT , [ "(" , arg_list , ")" ]
               | "$" , "{" , rhs_element+ , "}" ;          (* groupe : ${$X S &X} *)

template_slave  = "&" , IDENT , [ "(" , arg_list , ")" ]
               | "&" , "{" , rhs_element+ , "}" ;          (* groupe : &{$X S &X} *)
```

Sur un symbole : `$X` = master, `&X` = slave. Compilé en `(=X)` / `(:X)`.
Sur un groupe : `${...}` / `&{...}`. Compilé en `(= ...)` / `(: ...)`.
Les templates groupes peuvent contenir d'autres templates (imbrication).

**Transcription (homomorphisme)** : un nom de transcription entre `$X` et `&X`
applique la transformation au slave :

```bpscript
S -> $X tabla_stroke &X          // applique tabla_stroke au pattern capturé
S -> $X * &X                     // applique la transcription par défaut (*)
```

Compilé en : `S --> (= X) tabla_stroke (: X)`.
Le nom doit correspondre à une section dans l'alphabetFile, chargée via `@transcription.xxx`.
Plusieurs transcriptions peuvent être chaînées : `$X * TR &X` → `(= X) * TR (: X)`.

### 4.10 Liaisons (~)

```ebnf
tie_start    = symbol , "~" ;                        (* C4~ = début de liaison *)
tie_continue = "~" , symbol , "~" ;                  (* ~C4~ = continuation *)
tie_end      = "~" , symbol ;                        (* ~C4 = fin de liaison *)
```

Compilé en `&` pour BP3. Le moteur gère le matching à travers la polymétrie.

### 4.11 Chaîne vide

```ebnf
nil_string = "lambda" ;                    (* internal — users typically write an empty RHS: S -> *)
```

Efface le non-terminal (production ε).

### 4.12 Flags dans le RHS (`[]`)

```ebnf
flag_bracket = "[" , flag_expr , { "," , flag_expr } , "]" ;

flag_expr = IDENT , MUTATE_ASSIGN , flag_rvalue     (* mutation : [phase=2] *)
          | IDENT ;                                  (* flag set/ref : [Atrans], [K1] *)

MUTATE_ASSIGN = "=" | "+" | "-" ;
flag_rvalue   = INT | IDENT ;                        (* littéral ou autre flag *)
```

Les flags RHS utilisent `[]` — la même syntaxe que les qualifiers et opérateurs
temporels. C'est cohérent : `[]` = instructions moteur BP3, `!` = temporel.

Exemples :
- `Sa!dha [phase=2]` → trigger dha + mutation flag (deux concepts séparés)
- `Head [Atrans, A-1, K2, K3]` → 4 flags d'un coup
- `lambda [Num_a=20, Num_b=0]` → efface le non-terminal + init flags

Symétrie LHS/RHS :
- `[phase==1] S -> ...` → test flag (guard)
- `S -> ... [phase=2]` → set flag (RHS)

### 4.13 Backticks

```ebnf
backtick_inline     = "`" , CODE , "`" ;             (* dans un paramètre *)
backtick_standalone = "`" , IDENT , ":" , CODE , "`" ; (* dans le flux, taggé *)
```

Backtick attaché à un symbole → runtime implicite (celui du symbole).
Backtick dans le flux → tag obligatoire (`sc:`, `py:`, `tidal:`).
Currently only JS backticks (`js:`) are implemented. SC/Python/Tidal tags are architecture targets.

### 4.14 Raw braces (méta-grammaires)

```ebnf
raw_brace = "{" | "}" | "," ;                        (* braces non balancées *)
```

Utilisé quand `{`, `}`, `,` apparaissent comme terminaux bruts dans le RHS
(embedding patterns, méta-grammaires). Le parser les émet comme `RawBrace`
quand ils ne forment pas un polymetric balancé dans la même règle.

**Cross-rule braces** : les accolades peuvent être déséquilibrées à travers plusieurs
règles avec propagation du `[speed:N]` de la `}` fermante vers la `{` ouvrante correspondante.

---

## Couche 5 — Lexèmes

### Espacement (significatif)

L'espace est **significatif** pour déterminer l'attachement des qualificateurs `[]` et `()`.
Le tokenizer annote chaque token avec un flag `spaceBefore` (booléen) indiquant si un ou
plusieurs espaces/tabulations précèdent le token.

Règles d'attachement :
- Token `[` ou `(` **sans espace avant** → collé à l'élément précédent (suffixe)
- Token suivant `]` ou `)` **sans espace avant** → collé au qualifier (préfixe)
- `[` et `]` avec espace des deux côtés → qualifier flottant (erreur, utiliser `![]`)
- `[` et `]` sans espace des deux côtés → ambigu (erreur)

Le tokenizer n'élimine pas les espaces — il les consomme mais enregistre leur présence.

```ebnf
IDENT       = letter , { letter | digit | "_" | "#" | "'" | '"' } , [ "-" ]
            | letter , { letter | digit | "_" | "#" | "'" | '"' } , "-" , { letter | digit | "_" | "#" | "'" | '"' | "-" } ;
              (* First form: standard identifier, optionally with a single trailing "-".
                 A trailing "-" (no space before it) is part of the identifier name (e.g. do4-, mi4-).
                 A "-" after whitespace is a REST (silence).
                 This is consistent with BP3 where do4- is a single bol name.
                 Second form (with "-" followed by more chars) applies to non-terminal identifiers
                 (LHS symbols like Tr-11, my-var).
                 Resolved by pre-scan: the tokenizer collects LHS symbols from the file
                 and recognizes identifiers with "-" that appear in LHS position.
                 Convention inherited from BP3 (Bernard Bel). *)
INT         = digit+ ;
FLOAT       = [ "-" ] , digit+ , "." , digit+ ;
STRING      = '"' , { (* tout caractère sauf " *) } , '"' ;   (* littéral chaîne, pour @scene *)
value       = [ "-" ] , INT | FLOAT | IDENT | INT , "/" , INT ;
CODE        = (* tout caractère sauf ` non échappé *) ;
TEXT        = (* tout caractère jusqu'à fin de ligne *) ;
letter      = "a"-"z" | "A"-"Z" ;
digit       = "0"-"9" ;
blank_line  = (* ligne vide ou whitespace seul *) ;
```

**Contraintes lexicales** :
- `-` (tiret) en position **trailing** (immédiatement après un identifiant, sans espace) fait partie
  du nom : `do4-` = un seul terminal. `do4 -` = terminal `do4` + silence.
  `dhin--` = terminal `dhin` + silence + silence (le deuxième `-` empêche l'absorption du premier).
  Cohérent avec BP3 où `do4-` est un nom de bol valide.
  **Exception dans `[]`** : à l'intérieur d'un bracket, `[times-1]` est une mutation de flag
  (décrémenter `times` de 1), pas un identifiant `times-` suivi de `1`. Le parser détecte
  le pattern IDENT-avec-trailing-dash + INT et le décompose en flag + opérateur + valeur.
  Ceci s'applique aux guards (`[times-1]` en LHS) et aux flags RHS (`[times-1]` en RHS).
- `-` (tiret) en position **interne** (entre deux parties alphanumériques) est autorisé
  dans les non-terminaux (LHS) via pré-scan (ex: `Tr-11`, `my-var`).
- `#` est autorisé dans les identifiants pour les altérations musicales (C#4, F#2).
  Known limitation: `#` in terminal names currently causes issues with BP3's internal MIDI mapping when using flat alphabet.
- Les underscores dans les noms sont autorisés (ex: `just_intonation`).
  Le compilateur traduit `_` → espace dans les arguments de `_scale()` pour BP3.
  Known limitation: `_` in terminal names is rejected by BP3's alphabet parser. This is a blocker for the planned `Sa_v`/`Sa_^` octave convention.

**Quoted symbols** : BP3 supporte `'texte'` pour utiliser des caractères spéciaux
ou des nombres comme terminaux (`'1'`, `'2'`). BPscript **n'a pas** de quoted symbols —
les terminaux sont toujours des identifiants. Les grammaires BP3 qui utilisent des nombres
comme terminaux doivent être renommées dans la traduction (ex: `'1'` → `d1`).
Les nombres nus dans le flux BPscript sont des durées numériques, pas des terminaux.

---

## Couche 6 — Clés réservées

### Clés réservées de `[]`

```
mode     → MODE du bloc (random, ord, sub1, lin, tem, poslong)
scan     → sens du parcours par règle (left, right, rnd) — défaut : rnd
speed    → ratio de tempo polymétrique ({v1, v2}[speed:2] → {2, v1, v2})
/N       → diviser durée (A[/2] → durée ÷ 2, compilé en /2 A)
*N       → multiplier durée (A[*2] → durée × 2, compilé en \2 A)
weight   → poids de la règle
on_fail  → gestion d'échec (skip, retry(N), fallback(X)) (* not yet implemented *)
tempo    → tempo local
meter    → signature rythmique
timeout  → limite de temps sur <! (* not yet implemented *)
```

### Modificateurs de mode (sous-grammaire)

Déclarés dans `controls.json` section `subgrammar`. Émis en preamble BP3.

```
destru   → déstructure les terminaux composés selon l'alphabet (_destru)
striated → temps strié / pulsé (_striated)
smooth   → temps lisse / non pulsé (_smooth)
mm:N     → marquage métronomique en BPM (_mm(N))
```

Utilisables comme modificateurs de `@mode` : `@mode:lin(destru)`, `@mode:random(striated, mm:60)`.
Ou en global : `@striated`, `@mm:60` (appliqué au preamble de la première sous-grammaire).

### Clés réservées de `@`

```
actor NAME props...            → déclare un acteur (binding alphabet+scale+sounds+transport)
core                           → librairie noyau (lambda, on_fail)
controls                       → contrôles performance (vel, tempo, transpose, etc.)
alphabet.KEY:BINDING           → alphabet KEY depuis lib/alphabet.json, lié à BINDING
alphabet.KEY(transport=X, eval=Y) → transport ≠ eval (forme explicite)
tuning.KEY:ALPHABET            → tuning KEY depuis lib/tuning.json, lié à ALPHABET
sub.KEY                        → table de substitution depuis lib/sub.json
routing.KEY                    → config connexion KEY depuis lib/routing.json
hooks                          → macros d'interaction (* not yet implemented *)
templates                      → section templates (? = wildcard, ($N) = bracket marker)
mode:VALUE(modifiers)          → mode de sous-grammaire avec modificateurs optionnels
tempo                          → tempo global
meter                          → métrique globale
baseHz                         → diapason (défaut 440) (* not yet implemented — current implementation uses @tuning:442 *)
transpose                      → transposition globale
chan                            → canal MIDI global
vel                            → vélocité globale
ins                            → programme MIDI global
improvize                      → mode improvisation continue (Improvize=1)
allitems                       → produire tous les items (AllItems=1)
maxitems:N                     → nombre max d'items produits (0 = illimité)
quantize:N / quantization:N    → quantization en ms (défaut 10)
qclock:N                       → Qclock (dénominateur période métronome)
seed:N                         → graine RNG (0 = aléatoire)
tuning:SCALE                   → temperament from tuning.json (e.g. @tuning:Cmaj)
tuning:N                       → reference pitch in Hz (e.g. @tuning:442)
filter                         → CV/signal objects library
min_tempo                      → contrainte tempo minimum (* not yet implemented *)
max_tempo                      → contrainte tempo maximum (* not yet implemented *)
```

### Mots réservés (3)

```
gate     → type temporel : occupe du temps, valeur constante
trigger  → type temporel : instant, zéro durée
cv       → type temporel : occupe du temps, valeur continue
```

### Symbole réservé (1)

```
lambda   → chaîne vide (efface le non-terminal)
```

---

## Traduction BPscript → BP3

| BPscript | BP3 | Notes |
|----------|-----|-------|
| `->` | `-->` | direction |
| `<-` | `<--` | direction |
| `<>` | `<->` | direction |
| `$X` | `(=X)` | template master (symbole) |
| `&X` | `(:X)` | template slave (symbole) |
| `${A S B}` | `(=A S B)` | template master (groupe) |
| `&{A S B}` | `(:A S B)` | template slave (groupe) |
| `$X tabla_stroke &X` | `(=X) tabla_stroke (:X)` | transcription entre master et slave |
| `~` | `&` | liaison |
| `#X` | `#X` | contexte négatif (identique) |
| `#?` | `#?` | boundary — pas de symbole (identique) |
| `!f` (standalone) | `<<f>>` | out-time object |
| `-` | `-` | silence (identique) |
| `_` | `_` | prolongation (identique) |
| `.` | `.` | period (identique) |
| `...` | `_rest` | repos indéterminé |
| `[X==N]` | `/X=N/` en LHS | guard condition flag |
| `[X-N]` | `/X-N/` en LHS | guard test + mutation |
| `[X=N]` | `/X=N/` en RHS | mutation flag |
| `[X]` | `/X/` en RHS | flag set/ref (nu) |
| `C4(vel:120)` | `C4 _script(CT 0)` | runtime suffixe (symbole) |
| `S -> C4 D4 E4 (vel:80)` | `_script(CT 0) C4 D4 E4` | runtime suffixe (règle) |
| `{!(vel:80) A B, !(vel:60) C D}` | `{_script(CT 0) A B, _script(CT 1) C D}` | contrôle instantané dans voix |
| `{A B !(vel:80), C D !(vel:60)}` | `{A B _script(CT 0), C D _script(CT 1)}` | contrôle instantané fin de voix |
| `!(transpose:2)` | `_script(CT n)` | contrôle runtime instantané |
| `![retro]` | `_retro` | contrôle engine instantané |
| `{A B}(vel:100)` | `_script(CT 0_s) {A B} _script(CT 0_e)` | runtime suffixe (groupe) |
| `@mode:random` | `RND` en mode_line | mode du bloc |
| `[scan:left]` | `LEFT` dans la règle | mode dérivation |
| `[weight:50-12]` | `<50-12>` | poids décroissant |
| `[weight:K1=1]` | `<K1=1>` | K-param avec initialisation |
| `[weight:K1]` | `<K1>` | K-param (réf. valeur courante) |
| `[weight:inf]` | `<inf>` | poids infini (priorité absolue) |
| `[destru]` | `_destru` en preamble | flag de sous-grammaire |
| `A[/2]` | `_tempo(2/1) A _tempo(1/2)` | 2x plus rapide (bracket) |
| `A[*2]` | `_tempo(1/2) A _tempo(2/1)` | 2x plus lent (bracket) |
| `A[/3/2]` | `_tempo(3/2) A _tempo(2/3)` | 1.5x plus rapide (fraction) |
| `{A B}[/2]` | `_tempo(2/1) {A B} _tempo(1/2)` | groupe 2x plus rapide |
| `![/2]` | `_tempo(2/1)` | tempo séquentiel (pas de bracket) |
| `{v1, v2}[speed:2]` | `{2, v1, v2}` | ratio polymétrique (≠ tempo) |
| `-----` | `-----` | séparateur (identique) |
| `lambda` | `lambda` | chaîne vide (identique) |
| `<!sync1` | `<<W1>>` | sync tag |
| `[scale: just_intonation C4]A` | `_scale(just intonation,C4) A` | valeur brute (espaces→virgules, `_`→espace) |
| `[keyxpand: B3 -1]C3` | `_keyxpand(B3,-1) C3` | valeur brute multi-args |
| `A(script: MIDI send Continue)` | `A _script(MIDI send Continue)` | espaces préservés (script) |
| `H(value: slide 0)` | `H _value(slide,0)` | valeur brute 2 args |
| `X ->` (RHS vide) | `X -->` | production epsilon (sans lambda) |
| `A(transpose:-3)` | `A _script(CT 0)` | runtime valeur négative |
| `[Ideas]` (guard) | `/Ideas/` | bare flag guard (test non-zéro) |
| `[meter:4+4/6]` | `4+4/6` avant RHS | time signature inline |
| `@templates` | `TEMPLATES:` | section templates (optionnelle) |
| `?` (dans template) | `_` | wildcard terminal (un slot) |
| `????` (dans template) | `____` | wildcards compacts (4 slots) |
| `($0 ???)` (dans template) | `(@0 ___)` | bracket master ($ → @) |
| `/1` (dans template) | `*1/1` | facteur d'échelle |

**Contraintes lexicales** :
- `-` (tiret) en position **trailing** (immédiatement après un identifiant, sans espace) fait partie
  du nom : `do4-` = un seul terminal. `do4 -` = terminal `do4` + silence.
  `dhin--` = terminal `dhin` + silence + silence. Cohérent avec BP3.
  **Exception dans `[]`** : `[times-1]` = mutation flag, pas identifiant `times-` + `1`.
- `-` (tiret) en position **interne** est autorisé dans les non-terminaux (LHS) via pré-scan
  (ex: `Tr-11`, `my-var`).
- `#` est autorisé dans les identifiants pour les altérations musicales (C#4, F#2).
  Known limitation: `#` in terminal names currently causes issues with BP3's internal MIDI mapping when using flat alphabet.
- Les underscores dans les noms sont autorisés (ex: `just_intonation`).
  Le compilateur traduit `_` → espace dans les arguments de `_scale()` pour BP3.
  Known limitation: `_` in terminal names is rejected by BP3's alphabet parser. This is a blocker for the planned `Sa_v`/`Sa_^` octave convention.
