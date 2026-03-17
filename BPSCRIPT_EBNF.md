# BPscript — Grammaire EBNF

Version 0.6 — dérivée de BPSCRIPT_VISION.md et validée par 44 traductions de scènes BP3.

Notation : ISO 14977 (`=` définition, `,` concaténation, `|` alternative,
`[ ]` optionnel, `{ }` répétition 0+, `+` répétition 1+, `"..."` littéral,
`(* ... *)` commentaire).

---

## Couche 1 — Structure globale

```ebnf
scene       = { directive | declaration | macro | backtick_orphan
              | comment | blank_line }
              , subgrammar+ ;
```

- `directive` — imports et configuration globale (`@...`)
- `declaration` — déclaration de terminal (type + runtime)
- `macro` — définition de macro (réécriture textuelle)
- `backtick_orphan` — code externe taggé au top-level
- `subgrammar` — bloc de règles, au moins un requis

### `directive`

```ebnf
directive = "@" , directive_body ;

directive_body = IDENT                              (* @core, @controls *)
               | IDENT , "." , IDENT                (* @alphabet.western — subkey access *)
               | IDENT , ":" , IDENT                (* @core:midi — runtime binding *)
               | IDENT , "." , IDENT , ":" , IDENT  (* @alphabet.western:midi — subkey + runtime *)
               | IDENT , ":" , value                (* @tempo:120, @meter:3/4 *)
               | IDENT , "(" , alias_list , ")"     (* @western(A:La) — résolution conflit *)
               ;

alias_list = alias , { "," , alias } ;
alias      = IDENT , ":" , IDENT ;
```

### `declaration`

```ebnf
declaration = TYPE , IDENT , ":" , RUNTIME ;

TYPE    = "gate" | "trigger" | "cv" ;
RUNTIME = IDENT ;                          (* sc, midi, python, tidal, etc. *)
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

Les règles d'une même sous-grammaire partagent le mode déclaré via `[mode:...]`.
Le séparateur `-----` marque la frontière entre sous-grammaires.

---

## Couche 3 — Règles

```ebnf
rule = [ guard ] , { context } , lhs , ARROW , rhs , { qualifier } ;

ARROW = "->" | "<-" | "<>" ;
```

### `guard`

```ebnf
guard = "when" , guard_expr , { guard_expr } ;     (* multi-guard = AND *)

guard_expr = IDENT , COMPARE_OP , flag_value      (* test pur *)
           | IDENT , MUTATE_OP , INT               (* test + mutation atomique *)
           | IDENT                                  (* bare flag : non-zéro test *)
           ;

COMPARE_OP = "==" | "!=" | ">" | "<" | ">=" | "<=" ;
MUTATE_OP  = "+" | "-" ;

flag_value = INT | IDENT ;                          (* littéral ou autre flag *)
```

La forme `when flag-N` décrémente ET teste > 0 atomiquement (sémantique BP3).
La forme `when flag>N` teste sans muter.
La forme `when Ideas` (bare flag) teste que le flag est non-zéro → `/Ideas/` en BP3.

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

```ebnf
qualifier = "[" , qual_pair , { "," , qual_pair } , "]"
          | "[" , tempo_op , "]" ;                    (* opérateur temporel : [/2], [*3] *)

qual_pair = QUAL_KEY , ":" , qual_value
          | QUAL_KEY ;                                (* clé nue = flag booléen : [destru] *)

tempo_op  = "/" , number                              (* speed = N → /N *)
          | "\" , number                              (* speed = 1/N → \N *)
          | "*" , number                              (* scale = N → *N *)
          | "**" , number ;                           (* scale = 1/N → **N *)

QUAL_KEY  = "mode" | "scan" | "speed"
          | "weight" | "on_fail" | "tempo" | "meter"
          | IDENT ;                                 (* clé libre → passée au runtime *)

qual_value = value
           | value , "-" , value                    (* poids décroissant : 50-12 *)
           | IDENT , "=" , INT                      (* K-param : K1=3 *)
           | IDENT , "(" , args , ")"               (* on_fail: fallback(B) *)
           ;
```

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

### 4.0 Qualificateurs de contrôle par élément

```ebnf
control_qualifier = "[" , control_pair , { "," , control_pair } , "]" ;

control_pair = CONTROL_KEY , ":" , raw_value          (* clé: valeur brute *)
             | CONTROL_KEY ;                          (* flag nu : [volumecont] *)

CONTROL_KEY  = (* nom présent dans lib/controls.json : vel, tempo, ins,
                  chan, transpose, volume, volumecont, pitchbend, keyxpand,
                  scale, value, script, etc. *) ;

raw_value    = (* tout texte jusqu'au prochain "," ou "]" *) ;
```

Les qualificateurs de contrôle s'attachent à un élément RHS individuel (pas à la règle).
Ils compilent en `_name(value)` pour BP3 — des commandes zéro-durée.

**Valeur brute (modèle CSS)** : tout ce qui suit le `:` jusqu'au prochain `,` ou `]`
est la valeur, interprétée par le contrôle. Les espaces séparent les arguments et sont
convertis en `,` pour BP3. Les underscores dans les noms de gamme sont convertis en espaces.

```
[vel: 80]              → _vel(80)              // 1 argument
[keyxpand: B3 -1]      → _keyxpand(B3,-1)      // 2 arguments (espaces → virgules)
[scale: just_intonation C4] → _scale(just intonation,C4)  // underscore → espace
[script: MIDI send Continue] → _script(MIDI send Continue) // espaces préservés
```

**Position — préfixe ou suffixe** (analogie `++i` / `i++` en C) :

- **Préfixe** (recommandé) : `[vel:80]A` — le contrôle s'applique **avant** `A`.
  Le changement est actif au moment où `A` est joué.
  Compilé en : `_vel(80) A`

- **Suffixe** : `A[vel:80]` — le contrôle s'applique **après** `A`.
  Le changement prend effet pour les éléments suivants.
  Compilé en : `A _vel(80)`

- **Collé vs espacé** : `[vel:80]A` (collé) = qualificateur sur `A`.
  `[vel:80] A` (espace) = qualificateur sur la règle (interdit pour les contrôles,
  seuls `mode`, `weight`, `scan`, `on_fail`, etc. sont des qualificateurs de règle).

- **Distinction `[]` contrôle vs `[]` règle** : le parser distingue par la clé.
  Si la clé est un nom de contrôle connu (via lib/controls.json) → qualificateur d'élément.
  Sinon → qualificateur de règle ou flag.

**Exception — contrôles autonomes dans le RHS** : quand un non-terminal se résout
en purs contrôles (aucun élément temporel), les contrôles peuvent apparaître comme
éléments RHS autonomes. C'est le seul cas où des éléments zéro-durée sont tolérés
dans le RHS sans être attachés via `[]`.

```ebnf
(* Résolution d'un non-terminal en contrôle pur *)
Pull0 -> pitchbend(0)                                (* → _pitchbend(0) *)
StartPull -> pitchcont pitchrange(500) pitchbend(0)   (* → _pitchcont _pitchrange(500) _pitchbend(0) *)
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
polymetric = "{" , voice , { "," , voice } , "}" , [ qualifier ] ;

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
Chaînable : `<!sync1<!sync2`. Qualifiable : `<!sync1[timeout:5000]`.

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
nil_string = "lambda" ;
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
- `when phase==1 S -> ...` → test flag (LHS)
- `S -> ... [phase=2]` → set flag (RHS)

### 4.13 Backticks

```ebnf
backtick_inline     = "`" , CODE , "`" ;             (* dans un paramètre *)
backtick_standalone = "`" , IDENT , ":" , CODE , "`" ; (* dans le flux, taggé *)
```

Backtick attaché à un symbole → runtime implicite (celui du symbole).
Backtick dans le flux → tag obligatoire (`sc:`, `py:`, `tidal:`).

### 4.14 Raw braces (méta-grammaires)

```ebnf
raw_brace = "{" | "}" | "," ;                        (* braces non balancées *)
```

Utilisé quand `{`, `}`, `,` apparaissent comme terminaux bruts dans le RHS
(embedding patterns, méta-grammaires). Le parser les émet comme `RawBrace`
quand ils ne forment pas un polymetric balancé dans la même règle.

---

## Couche 5 — Lexèmes

```ebnf
IDENT       = letter , { letter | digit | "_" | "#" | "'" | '"' }
            | letter , { letter | digit | "_" | "#" | "'" | '"' } , "-" , { letter | digit | "_" | "#" | "'" | '"' | "-" } ;
              (* Le tiret "-" est autorisé dans les non-terminaux : Tr-11, my-var.
                 Résolu par pré-scan : le tokenizer collecte les LHS du fichier
                 et reconnaît les identifiants avec "-" qui apparaissent en LHS.
                 Convention héritée de BP3 (Bernard Bel) : "-" autorisé dans les
                 noms de variables, interdit dans les terminaux. *)
INT         = digit+ ;
FLOAT       = [ "-" ] , digit+ , "." , digit+ ;
value       = INT | FLOAT | IDENT | INT , "/" , INT ;
CODE        = (* tout caractère sauf ` non échappé *) ;
TEXT        = (* tout caractère jusqu'à fin de ligne *) ;
letter      = "a"-"z" | "A"-"Z" ;
digit       = "0"-"9" ;
blank_line  = (* ligne vide ou whitespace seul *) ;
```

**Contraintes lexicales** :
- `-` (tiret) n'est JAMAIS autorisé dans un identifiant. `dhin--` = `dhin` + silence + silence.
  Confirmé par le code BP3 : `GetBol()` rejette `-` dans les noms (`CompileGrammar.c:1200-1203`).
- `#` est autorisé dans les identifiants pour les altérations musicales (C#4, F#2).
- Les underscores dans les noms sont autorisés (ex: `just_intonation`).
  Le compilateur traduit `_` → espace dans les arguments de `_scale()` pour BP3.

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
on_fail  → gestion d'échec (skip, retry(N), fallback(X))
tempo    → tempo local
meter    → signature rythmique
timeout  → limite de temps sur <!
```

### Clés réservées de `@`

```
core                → librairie noyau (lambda, on_fail)
controls            → contrôles performance (vel, tempo, transpose, etc.)
alphabet.western    → alphabet western (C, D, E...) depuis lib/alphabets.json
alphabet.raga       → alphabet raga (sa, re, ga...) depuis lib/alphabets.json
sub.dhati           → table de substitution depuis lib/sub.json
hooks               → macros d'interaction
tempo          → tempo global
meter          → métrique globale
mm             → marquage métronomique
striated       → temps strié
smooth         → temps lisse
transpose      → transposition globale
chan            → canal MIDI global
vel            → vélocité globale
ins            → programme MIDI global
min_tempo      → contrainte tempo minimum
max_tempo      → contrainte tempo maximum
```

### Mots réservés (4)

```
gate     → type temporel : occupe du temps, valeur constante
trigger  → type temporel : instant, zéro durée
cv       → type temporel : occupe du temps, valeur continue
when     → garde conditionnelle sur une règle
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
| `when X==N` | `/X=N/` en LHS | condition flag |
| `when X-N` | `/X-N/` en LHS | test + mutation |
| `[X=N]` | `/X=N/` en RHS | mutation flag |
| `[X]` | `/X/` en RHS | flag set/ref (nu) |
| `[vel:120]A` | `_vel(120) A` | contrôle préfixe (avant A) |
| `A[vel:120]` | `A _vel(120)` | contrôle suffixe (après A) |
| `[ins:3, volumecont, volume:127]A` | `_ins(3) _volumecont _volume(127) A` | multi-contrôle préfixe |
| `[mode:random]` | `RND` en mode_line | mode du bloc |
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
| `[transpose: -3]A` | `_transpose(-3) A` | valeur négative en préfixe |
| `when Ideas` | `/Ideas/` | bare flag (test non-zéro) |
| `[meter:4+4/6]` | `4+4/6` avant RHS | time signature inline |

**Contraintes lexicales** :
- `-` (tiret) n'est JAMAIS autorisé dans un identifiant. `dhin--` = `dhin` + silence + silence.
  Confirmé par le code BP3 : `GetBol()` rejette `-` dans les noms (`CompileGrammar.c:1200-1203`).
- `#` est autorisé dans les identifiants pour les altérations musicales (C#4, F#2).
- Les underscores dans les noms sont autorisés (ex: `just_intonation`).
  Le compilateur traduit `_` → espace dans les arguments de `_scale()` pour BP3.
