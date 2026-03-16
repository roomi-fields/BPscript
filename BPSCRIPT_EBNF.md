# BPscript — Grammaire EBNF

Version 0.3 — dérivée de BPSCRIPT_VISION.md et validée par 17 traductions de scènes BP3.

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

directive_body = IDENT                              (* @core, @supercollider *)
               | "+"                                (* @+ — contrôles performance *)
               | IDENT , ":" , IDENT                (* @raga:supercollider *)
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
guard = "when" , guard_expr ;

guard_expr = IDENT , COMPARE_OP , flag_value      (* test pur *)
           | IDENT , MUTATE_OP , INT               (* test + mutation atomique *)
           ;

COMPARE_OP = "==" | "!=" | ">" | "<" | ">=" | "<=" ;
MUTATE_OP  = "+" | "-" ;

flag_value = INT | IDENT ;                          (* littéral ou autre flag *)
```

La forme `when flag-N` décrémente ET teste > 0 atomiquement (sémantique BP3).
La forme `when flag>N` teste sans muter.

### `context`

```ebnf
context = positive_context | negative_context ;

positive_context = "(" , symbol+ , ")" ;            (* contexte positif *)
negative_context = "#" , "(" , symbol+ , ")"         (* négatif sur groupe *)
                 | "#" , symbol ;                    (* négatif sur un seul symbole *)
```

Les contextes peuvent apparaître avant le LHS (contexte gauche), après le RHS
(contexte droit), ou dans le RHS (préservés pour les futures applications).

### `lhs`

```ebnf
lhs = lhs_element+ ;

lhs_element = symbol
            | variable
            | wildcard
            | context ;
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
rhs_element = symbol
            | symbol_call
            | rest | prolongation | undetermined_rest
            | period
            | numeric_duration
            | polymetric
            | control
            | simultaneous
            | trigger_in
            | variable
            | wildcard
            | template_master | template_slave
            | tie_start | tie_continue | tie_end
            | nil_string
            | backtick_standalone
            | context
            | flag_mutation ;
```

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

### 4.4 Contrôles (@+)

```ebnf
control = CONTROL_NAME , [ "(" , args , ")" ] ;

CONTROL_NAME = "vel" | "tempo" | "mm" | "ins" | "chan"
             | "staccato" | "legato" | "pan" | "mod"
             | "transpose" | "pitchbend" | "pressure"
             | "striated" | "smooth" | "goto" | "scale"
             | IDENT ;                               (* extensible *)

args = arg_value , { "," , arg_value } ;
```

Les contrôles compilent en `_name(args)` pour BP3. Zéro durée.

### 4.5 Simultanéité (`!`)

```ebnf
simultaneous = "!" , sim_target ;

sim_target   = symbol                                (* trigger : !dha *)
             | symbol_call                           (* trigger avec params : !dha(vel:120) *)
             ;
```

`!` est **exclusivement temporel** — il déclenche des symboles au même instant
que le primaire. Le primaire définit la durée :
- trigger → zéro durée
- gate → hérite la durée du primaire
- cv → hérite la durée du primaire

Chaînable : `Sa!dha!spotlight`.

Les mutations de flags ne passent plus par `!` — elles vont dans `[]`
(voir § 4.13).

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

`lambda` peut être suivi de `!` pour attacher des mutations de flag :
`lambda!Num_a=20!Num_b=0` — efface le non-terminal ET mute des flags.
Dans ce cas, le parser produit un `SimultaneousGroup` avec `NilString` comme primaire.

### 4.12 Backticks

```ebnf
backtick_inline     = "`" , CODE , "`" ;             (* dans un paramètre *)
backtick_standalone = "`" , IDENT , ":" , CODE , "`" ; (* dans le flux, taggé *)
```

Backtick attaché à un symbole → runtime implicite (celui du symbole).
Backtick dans le flux → tag obligatoire (`sc:`, `py:`, `tidal:`).

### 4.13 Flags dans le RHS (`[]`)

```ebnf
rhs_flag = "[" , flag_expr , { "," , flag_expr } , "]" ;

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

---

## Couche 5 — Lexèmes

```ebnf
IDENT       = letter , { letter | digit | "_" | "#" | "'" | '"' } ;
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

**Contraintes lexicales** :
- `-` (tiret) n'est JAMAIS autorisé dans un identifiant. `dhin--` = `dhin` + silence + silence.
  Confirmé par le code BP3 : `GetBol()` rejette `-` dans les noms (`CompileGrammar.c:1200-1203`).
- `#` est autorisé dans les identifiants pour les altérations (C#4, F#2).
- Les underscores `_` en début de nom sont réservés aux contrôles BP3 (`_vel`, `_tempo`).
  En BPscript, les contrôles n'ont pas de `_` — c'est un détail de compilation.

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
core           → librairie noyau (lambda, on_fail)
+              → contrôles performance
hooks          → macros d'interaction
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
| `-` | `-` | silence (identique) |
| `_` | `_` | prolongation (identique) |
| `.` | `.` | period (identique) |
| `...` | `...` | repos indéterminé (identique) |
| `when X==N` | `/X=N/` en LHS | condition flag |
| `when X-N` | `/X-N/` en LHS | test + mutation |
| `[X=N]` | `/X=N/` en RHS | mutation flag |
| `[X]` | `/X/` en RHS | flag set/ref (nu) |
| `vel(120)` | `_vel(120)` | contrôle @+ |
| `goto(2,1)` | `_goto(2,1)` | contrôle @+ |
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
| `scale(just_intonation,C4)` | `_scale(just intonation,C4)` | `_` → espace dans args scale |
| `repeat(K1=3)` | `_repeat(K1=3)` | contrôle @+ avec K-param |
| `X ->` (RHS vide) | `X -->` | production epsilon (sans lambda) |
| `transpose(-3)` | `_transpose(-3)` | valeur négative |

**Contraintes lexicales** :
- `-` (tiret) n'est JAMAIS autorisé dans un identifiant. `dhin--` = `dhin` + silence + silence.
  Confirmé par le code BP3 : `GetBol()` rejette `-` dans les noms (`CompileGrammar.c:1200-1203`).
- `#` est autorisé dans les identifiants pour les altérations musicales (C#4, F#2).
- Les underscores dans les noms sont autorisés (ex: `just_intonation`).
  Le compilateur traduit `_` → espace dans les arguments de `_scale()` pour BP3.
