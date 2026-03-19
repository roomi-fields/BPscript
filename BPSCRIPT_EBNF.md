# BPscript — Grammaire EBNF

Version 0.6 — dérivée de BPSCRIPT_VISION.md et validée par 44 traductions de scènes BP3.

Notation : ISO 14977 (`=` définition, `,` concaténation, `|` alternative,
`[ ]` optionnel, `{ }` répétition 0+, `+` répétition 1+, `"..."` littéral,
`(* ... *)` commentaire).

---

## Couche 1 — Structure globale

```ebnf
scene       = { directive | declaration | cv_instance | macro | backtick_orphan
              | comment | blank_line }
              , subgrammar+ ;
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
               ;

param_pairs = param_pair , { "," , param_pair } ;
param_pair  = IDENT , "=" , IDENT ;               (* transport=sc, eval=python *)

alias_list = alias , { "," , alias } ;
alias      = IDENT , ":" , IDENT ;
```

### `declaration`

```ebnf
declaration = TYPE , IDENT , ":" , RUNTIME ;

TYPE    = "gate" | "trigger" | "cv" ;
RUNTIME = IDENT ;                          (* sc, midi, python, tidal, etc. *)
```

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

Les règles d'une même sous-grammaire partagent le mode déclaré via `@mode:...`.
Le mode est défini par une directive `@mode:X` (ex: `@mode:random`, `@mode:ord`) qui s'applique
à la sous-grammaire qui suit, jusqu'au prochain séparateur `-----`.
Le séparateur `-----` marque la frontière entre sous-grammaires.

---

## Couche 3 — Règles

```ebnf
rule = [ guard ] , { context } , lhs , ARROW , rhs , { qualifier } ;

ARROW = "->" | "<-" | "<>" ;
```

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

context_sym      = symbol | "{" | "}" | "," ;        (* symboles + braces pour méta-grammaires *)
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

**Clés nues (flags)** : `[destru]` sans `:value` = flag booléen (`true`).
Compilé en preamble de la sous-grammaire (`_destru` entre la ligne mode et les règles).
Clés nues reconnues : `destru`, `striated`, `smooth`.

---

## Couche 4 — Éléments RHS

```ebnf
rhs_element = [ control_qualifier ] , element_core , [ control_qualifier ] ;

control_qualifier = engine_qualifier | runtime_qualifier ;

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
```

#### `()` — Qualificateurs runtime

```ebnf
runtime_qualifier = "(" , runtime_pair , { "," , runtime_pair } , ")" ;

runtime_pair = RUNTIME_KEY , ":" , value ;

RUNTIME_KEY  = (* nom présent dans lib/controls.json section "runtime" :
                  vel, chan, pan, wave, attack, release, detune,
                  filter, filterQ, transpose, ins, staccato, legato,
                  mod, pitchbend, volume, etc. *) ;
```

Compilé en `_script(CTn)` pour BP3 — le dispatcher interprète au playback.

```
(vel:80)               → _script(CT0) avec {vel: 80}
(wave:sawtooth, vel:100, filterQ:8) → _script(CT0) avec {wave:"sawtooth", vel:100, filterQ:8}
```

#### Position — préfixe ou suffixe

- **Préfixe** : `(vel:80) A` — le contrôle s'applique **avant** `A`.
  Compilé en : `_script(CT0) A`

- **Suffixe** : `A(vel:80)` — le contrôle s'applique **après** `A`.
  Compilé en : `A _script(CT0)`

Les deux syntaxes `[]` et `()` supportent préfixe et suffixe.

**Exception — contrôles autonomes dans le RHS** : quand un non-terminal se résout
en purs contrôles (aucun élément temporel), les contrôles peuvent apparaître comme
éléments RHS autonomes. C'est le seul cas où des éléments zéro-durée sont tolérés
dans le RHS sans être attachés via `[]`.

```ebnf
(* Résolution d'un non-terminal en contrôle runtime pur *)
Pull0 -> (pitchbend:0)                                          (* → _script(CTn) *)
StartPull -> (pitchcont) (pitchrange:500) (pitchbend:0)          (* → _script(CT0) _script(CT1) _script(CT2) *)
```

Ce pattern existe dans les grammaires à couches (vina, vina2, vina3) où les
non-terminaux intermédiaires occupent du temps dans la couche supérieure et se
résolvent en instructions moteur dans la couche inférieure.

### 4.1 Symboles

```ebnf
symbol      = IDENT ;                               (* terminal ou non-terminal *)
symbol_call = IDENT , "(" , arg_list , ")" ;         (* appel avec paramètres *)

arg_list    = arg , { "," , arg } ;
arg         = [ IDENT , ":" ] , arg_value ;           (* positionnel ou nommé *)
arg_value   = value | backtick_inline ;
```

### 4.2 Silences et temps

```ebnf
rest              = "-" ;                            (* silence déterminé *)
prolongation      = "_" ;                            (* étend l'événement précédent *)
undetermined_rest = "..." ;                          (* durée calculée par le moteur *)
period            = "." ;                            (* séparateur de fragments égaux *)
numeric_duration  = INT | INT , "/" , INT ;           (* silence de durée rationnelle *)
```

`numeric_duration` : un nombre nu dans le flux = silence de durée rationnelle.
**À confirmer avec Bernard** : différence exacte entre `-` et `1`.

### 4.3 Polymétrie

```ebnf
polymetric = "{" , voice , { "," , voice } , "}"
             , [ engine_qualifier ] , [ runtime_qualifier ] ;

voice      = rhs_element+ ;
```

Le ratio de tempo BP3 (`{2, voix1, voix2}`) s'exprime via `[speed:N]` :
`{voix1, voix2}[speed:2]`.

### 4.4 Simultanéité (`!`)

```ebnf
simultaneous = "!" , sim_target ;

sim_target   = symbol                                (* trigger : !dha *)
             | symbol_call                           (* trigger avec params : !dha(vel:120) *)
             ;
```

`!` est **exclusivement temporel** — il déclenche des symboles.

Deux usages :
- **Attaché** à un primaire (`Sa!dha`) : le primaire définit la durée, le secondaire
  se déclenche au même instant. Compilé en `Sa <<dha>>`.
- **Standalone** (`!f`) : out-time object — déclenché hors-temps, sans durée.
  Compilé en `<<f>>`. Utilisé quand un non-terminal se résout en pur trigger.

Chaînable : `Sa!dha!spotlight`.

Les mutations de flags ne passent plus par `!` — elles vont dans `[]`
(voir § 4.12).

### 4.5 Out-time object (`!` standalone)

```ebnf
out_time_object = "!" , IDENT ;                      (* !f → <<f>> en BP3 *)
```

Objet hors-temps : déclenché sans occuper de durée dans la séquence.
Utilisé quand un non-terminal se résout en pur déclenchement.

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

```ebnf
IDENT       = letter , { letter | digit | "_" | "#" | "'" | '"' }
            | letter , { letter | digit | "_" | "#" | "'" | '"' } , "-" , { letter | digit | "_" | "#" | "'" | '"' | "-" } ;
              (* The second form (with "-") applies ONLY to non-terminal identifiers
                 (LHS symbols like Tr-11, my-var). "-" is NEVER allowed in terminal names.
                 Resolved by pre-scan: the tokenizer collects LHS symbols from the file
                 and recognizes identifiers with "-" that appear in LHS position.
                 Convention inherited from BP3 (Bernard Bel). *)
INT         = digit+ ;
FLOAT       = [ "-" ] , digit+ , "." , digit+ ;
value       = [ "-" ] , INT | FLOAT | IDENT | INT , "/" , INT ;
CODE        = (* tout caractère sauf ` non échappé *) ;
TEXT        = (* tout caractère jusqu'à fin de ligne *) ;
letter      = "a"-"z" | "A"-"Z" ;
digit       = "0"-"9" ;
blank_line  = (* ligne vide ou whitespace seul *) ;
```

**Contraintes lexicales** :
- `-` (tiret) est autorisé dans les non-terminaux (LHS) via pré-scan (ex: `Tr-11`, `my-var`),
  mais JAMAIS dans les terminaux. `dhin--` = `dhin` + silence + silence.
  Confirmé par le code BP3 : `GetBol()` rejette `-` dans les noms de terminaux (`CompileGrammar.c:1200-1203`).
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
/N \N    → opérateurs speed BP3 (A[/2] → /2 A, A[\2] → \2 A)
*N **N   → opérateurs scale BP3 (A[*3] → *3 A, A[**3] → **3 A)
weight   → poids de la règle
on_fail  → gestion d'échec (skip, retry(N), fallback(X)) (* not yet implemented *)
tempo    → tempo local
meter    → signature rythmique
timeout  → limite de temps sur <! (* not yet implemented *)
```

### Clés réservées de `@`

```
core                           → librairie noyau (lambda, on_fail)
controls                       → contrôles performance (vel, tempo, transpose, etc.)
alphabet.KEY:BINDING           → alphabet KEY depuis lib/alphabet.json, lié à BINDING
alphabet.KEY(transport=X, eval=Y) → transport ≠ eval (forme explicite)
tuning.KEY:ALPHABET            → tuning KEY depuis lib/tuning.json, lié à ALPHABET
sub.KEY                        → table de substitution depuis lib/sub.json
routing.KEY                    → config connexion KEY depuis lib/routing.json
hooks                          → macros d'interaction (* not yet implemented *)
tempo                          → tempo global
meter                          → métrique globale
mm                             → marquage métronomique
baseHz                         → diapason (défaut 440) (* not yet implemented — current implementation uses @tuning:442 *)
striated                       → temps strié
smooth                         → temps lisse
transpose                      → transposition globale
chan                            → canal MIDI global
vel                            → vélocité globale
ins                            → programme MIDI global
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
| `~` | `&` | liaison |
| `#X` | `#X` | contexte négatif (identique) |
| `#?` | `#?` | boundary — pas de symbole (identique) |
| `!f` (standalone) | `<<f>>` | out-time object |
| `-` | `-` | silence (identique) |
| `_` | `_` | prolongation (identique) |
| `.` | `.` | period (identique) |
| `...` | `...` | repos indéterminé (identique) |
| `[X==N]` | `/X=N/` en LHS | guard condition flag |
| `[X-N]` | `/X-N/` en LHS | guard test + mutation |
| `[X=N]` | `/X=N/` en RHS | mutation flag |
| `[X]` | `/X/` en RHS | flag set/ref (nu) |
| `(vel:120) A` | `_script(CT0) A` | runtime préfixe (avant A) |
| `A(vel:120)` | `A _script(CT0)` | runtime suffixe (après A) |
| `(ins:3, volume:127) A` | `_script(CT0) A` | multi-runtime préfixe |
| `@mode:random` | `RND` en mode_line | mode du bloc |
| `[scan:left]` | `LEFT` dans la règle | mode dérivation |
| `[weight:50-12]` | `<50-12>` | poids décroissant |
| `[weight:K1=1]` | `<K1=1>` | K-param avec initialisation |
| `[weight:K1]` | `<K1>` | K-param (réf. valeur courante) |
| `[destru]` | `_destru` en preamble | flag de sous-grammaire |
| `A[/2]` | `/2 A` | opérateur speed (vitesse = 2) |
| `A[\2]` | `\2 A` | opérateur speed inverse (vitesse = 1/2) |
| `A[*3]` | `*3 A` | opérateur scale (échelle = 3) |
| `A[**3]` | `**3 A` | opérateur scale inverse (échelle = 1/3) |
| `{v1, v2}[speed:2]` | `{2, v1, v2}` | ratio polymétrique (≠ opérateur) |
| `-----` | `-----` | séparateur (identique) |
| `lambda` | `lambda` | chaîne vide (identique) |
| `<!sync1` | `<<W1>>` | sync tag |
| `[scale: just_intonation C4]A` | `_scale(just intonation,C4) A` | valeur brute (espaces→virgules, `_`→espace) |
| `[keyxpand: B3 -1]C3` | `_keyxpand(B3,-1) C3` | valeur brute multi-args |
| `[script: MIDI send Continue]A` | `_script(MIDI send Continue) A` | espaces préservés (script) |
| `[value: slide 0]H` | `_value(slide,0) H` | valeur brute 2 args |
| `X ->` (RHS vide) | `X -->` | production epsilon (sans lambda) |
| `(transpose:-3) A` | `_script(CT0) A` | runtime valeur négative |
| `[Ideas]` (guard) | `/Ideas/` | bare flag guard (test non-zéro) |
| `[meter:4+4/6]` | `4+4/6` avant RHS | time signature inline |

**Contraintes lexicales** :
- `-` (tiret) est autorisé dans les non-terminaux (LHS) via pré-scan (ex: `Tr-11`, `my-var`),
  mais JAMAIS dans les terminaux. `dhin--` = `dhin` + silence + silence.
  Confirmé par le code BP3 : `GetBol()` rejette `-` dans les noms de terminaux (`CompileGrammar.c:1200-1203`).
- `#` est autorisé dans les identifiants pour les altérations musicales (C#4, F#2).
  Known limitation: `#` in terminal names currently causes issues with BP3's internal MIDI mapping when using flat alphabet.
- Les underscores dans les noms sont autorisés (ex: `just_intonation`).
  Le compilateur traduit `_` → espace dans les arguments de `_scale()` pour BP3.
  Known limitation: `_` in terminal names is rejected by BP3's alphabet parser. This is a blocker for the planned `Sa_v`/`Sa_^` octave convention.
