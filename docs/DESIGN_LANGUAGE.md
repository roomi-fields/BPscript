# BPscript Language Design

## Principe

BPscript est un langage **dense**, pas simple. 3 mots reserves, 24 symboles, 7 operateurs.
Le vocabulaire est petit mais la combinatoire est riche. Comme les echecs :
6 types de pieces, complexite infinie.

Le langage va du trivial au tres complexe :

```
// Trivial -- une sequence de notes
S -> Sa Re Ga Pa

// Intermediaire -- polymetrie avec triggers et flags
[phase==1] S -> { Sa!dha Re!ti, -!spotlight _ }

// Complexe -- templates, captures, homomorphismes, multi-runtime
|x| (A) x!dha B -> x!ti $mel &mel [mode:random, phase+1]
```

Les symboles ne se memorisent pas -- ils se **lisent**. `->` est une fleche.
`!` est une impulsion. `...` est du suspens. La charge cognitive n'est pas
dans le vocabulaire mais dans la profondeur structurelle.

La vraie promesse : un compositeur peut commencer avec `S -> Sa Re Ga` et
decouvrir progressivement la polymetrie, les flags, les captures, les backticks.
Chaque feature est optionnelle -- la complexite est **additive**, pas imposee.

---

## Inventaire : 3 mots, 24 symboles, 7 operateurs

### Trois mots reserves

| Mot         | Role  | Sens                                      |
| ----------- | ----- | ----------------------------------------- |
| **gate**    | type  | occupe du temps, valeur constante         |
| **trigger** | type  | instant, zero duree, impulsion ponctuelle |
| **cv**      | type  | occupe du temps, valeur varie continument |

Les trois types sont inspires de l'eurorack et definissent le **rapport au temps** de chaque symbole.
Le compilateur sait ce qui occupe du temps et ce qui n'en occupe pas.
Le compositeur le voit aussi -- les types sont explicites a la definition.

### Vingt-quatre symboles structurels

```
@              environnement (imports, config globale)
-> <- <>       derivation + direction (BP3 : --> <-- <->)
{ , }          polymetrie, groupement temporel, etat interne de definition
( )            parametre runtime (portees : symbole, regle, groupe), definition, appel, contexte
:              paire cle:valeur, binding runtime (gate Sa:sc)
=              definition de macro (+ assignation dans les flags)
[ ]            qualificateur local (sur un groupe ou une regle)
` `            code externe opaque (echappement vers le runtime)
//             commentaire
-              silence (occupe du temps, absence d'evenement)
_              prolongation (etend l'evenement precedent)
.              period notation (separateur de fragments de duree egale)
...            repos indetermine (duree calculee par le moteur)
!              evenement zero-duree : trigger sortant ou mutation de flag
<!             trigger entrant (on attend -- point de synchronisation)
#              contexte negatif
?              capture (un symbole inconnu)
$              template : definition de motif (groupe)
&              template : reference au motif
~              liaison d'objets sonores (C4~ = debut, ~C4 = fin, ~C4~ = continuation)
| |            homomorphisme (variable liee dans une regle)
```

Les symboles temporels (`-`, `_`, `.`, `...`) sont des symboles du langage,
pas du vocabulaire de librairie -- le compilateur connait leur semantique.

Pas d'ambiguite entre `.` et `...` : ce sont des caracteres differents de `-`.
- `.` = toujours isole (separateur entre fragments)
- `...` = toujours 3 caracteres colles (repos indetermine)
- `-` = silence, `- - -` = trois silences (tokens separes par des espaces)

### Sept operateurs de flags

```
==             test d'egalite (dans [guard])
!=             test d'inegalite (dans [guard])
>              test superieur (dans [guard])
<              test inferieur (dans [guard])
>=             test superieur ou egal (dans [guard])
<=             test inferieur ou egal (dans [guard])
+              increment (dans [flag])
```

Les operateurs n'existent que dans le contexte des flags (`[guard]` avant le LHS et `[mutation]` dans le RHS).
L'assignation `=` reutilise un symbole structurel existant.
Le decrement `-` et l'increment `+` n'existent que dans le contexte des flags.

### Trois portees de metadonnees

- `@` = **global** : environnement, imports, configuration du systeme
- `[]` = **local moteur** : instructions BP3 -- modes, flags, operateurs temporels
- `()` = **local runtime** : parametres transportes au runtime cible (vel, filter, wave...)

Les nombres (`0.7`, `120`, `5ms`) sont des symboles opaques comme les autres --
le langage ne connait pas leur semantique, c'est le recepteur qui les interprete.

**Pas de `for`, pas de `while`, pas de branchement.** BPscript decrit des structures
dans le temps. `[guard]` est une garde declarative (la regle existe ou non), pas du
branchement imperatif. Toute logique algorithmique, traitement de signal ou chainage
passe par le code externe (backticks) ou par le bridge.

---

## Systeme de types -- double declaration

Chaque symbole a un **double contrat** avant d'etre utilise :

| Dimension         | Question                | Valeurs                    | Exemples                        |
| ----------------- | ----------------------- | -------------------------- | ------------------------------- |
| **Type temporel** | comment dans le temps ? | gate, trigger, cv          | gate = duree, trigger = instant |
| **Runtime**       | qui le manipule ?       | sc, tidal, python, midi... | sc = SuperCollider evalue       |

Sans ces deux informations, le compilateur refuse. Il ne sait pas comment
ordonnancer (type temporel) ni ou envoyer (runtime).

### Trois categories de symboles

Une scene BPS contient trois categories de symboles, identifiees automatiquement
par le compilateur :

| Categorie        | Declaration                             | Role                                           | Exemples                      |
| ---------------- | --------------------------------------- | ---------------------------------------------- | ----------------------------- |
| **Non-terminal** | implicite (apparait en LHS d'une regle) | variable de grammaire, se reecrit et disparait | S, I, A, B, R1, P4            |
| **Terminal**     | explicite (type + runtime)              | symbole de sortie, atteint un runtime          | sa6:gate:midi, dha:trigger:sc |
| **Controle**     | via `@controls` / `@hooks`              | commande moteur BP3, zero duree                | [tempo:2], [mode:random], [/2] |

Les non-terminaux sont des **symboles purement BPS** : ils n'existent que
pendant la derivation, n'ont ni type temporel ni runtime. Ils se reecrivent
en terminaux via les regles de grammaire. Si un non-terminal survit dans la
sortie finale (n'a pas ete reecrit), c'est une **erreur de grammaire** --
la derivation est incomplete.

### Declaration : type temporel + runtime

La syntaxe utilise `:` pour lier un symbole a son runtime :

```
// Declaration dans la scene
gate Sa:sc                       // Sa est un gate, gere par SuperCollider
trigger flash:python             // flash est un trigger, gere par Python
cv ramp:sc                       // ramp est un cv, gere par SuperCollider

// Declaration par import (en bloc)
@alphabet.raga:supercollider     // tous les symboles du raga -> gate/trigger:sc
@lights:python                   // tous les symboles de lights -> trigger:python
```

Le type temporel et le runtime ne changent jamais apres declaration.

Un symbole non declare est une erreur :
```
S -> Sa Re Bloup Ga
//            ^^^^
// Erreur : 'Bloup' n'est pas declare (ni type temporel, ni runtime)
```

Le parallele en informatique : **CUDA** (`__device__ float x` = type + cible d'execution),
**GLSL** (`uniform float x` = qualifier + type). Deux dimensions orthogonales sur le meme objet.

---

## Parametres -- opaques pour BPscript

BPscript ne comprend pas les parametres. Il les **transporte** vers le runtime,
qui sait quoi en faire.

```
// SC definit les parametres dans un SynthDef
`sc: SynthDef(\sitar, { |freq, vel=80| ... }).add`

// BPscript declare le contrat temporel
gate Sa:sc

// Les parametres sont transportes tels quels vers SC
Sa(vel:120)                      // litteral -> SC recoit vel=120
Sa(vel:`rrand(40,127)`)          // backtick -> SC evalue rrand(40,127)
```

C'est un **gradient de complexite** -- un seul mecanisme, une seule plomberie :

```
// Niveau 1 : litteral -- BPscript transporte
Sa(vel:120)

// Niveau 2 : backtick -- le runtime du symbole evalue
Sa(vel:`rrand(40,127)`)

// Niveau 3 : backtick orphelin -- tag obligatoire
`sc: SynthDef(\grain, { |freq| ... }).add`
```

BPscript ne sait pas ce que `vel` veut dire. `120` est un litteral transporte,
`` `rrand(40,127)` `` est du code evalue par le runtime de Sa. Meme chemin,
le gradient est cosmetique.

### Override et heritage

Les librairies declarent les defauts des symboles qu'elles fournissent.
Le compositeur surcharge ponctuellement. Le runtime recoit le resultat.

```
// @alphabet.raga:supercollider definit Sa avec vel:80 par defaut

Sa                               // vel:80 (defaut herite de la lib)
Sa(vel:120)                      // vel:120 (surcharge litterale)
Sa(vel:`rrand(40,127)`)          // vel:evalue par SC (surcharge backtick)
```

La surcharge ne modifie que les parametres, jamais le contrat (type + runtime).

---

## `[]` moteur vs `()` runtime -- deux destinataires, memes portees

### `[]` -- instructions moteur BP3 (toujours suffixe)

Les qualificateurs `[]` sont des commandes pour le **moteur BP3**. Le compilateur
les traduit en instructions BP3 (`_tempo()`, `_scale()`, mode de sous-grammaire, etc.).
Ils sont resolus **pendant** la derivation et le calcul temporel -- ils n'existent
plus dans la sortie.

```
// Portee symbole -- colle a l'element
A[/2] B C                       // divise la vitesse de A

// Portee regle -- en fin de regle
S -> A B C [mode:random]        // mode de la sous-grammaire
Bass -> C2 C2 C3 [weight:50]    // poids de la regle

// Portee groupe -- apres le groupe
{A B C}[/2]                     // vitesse du groupe divisee
```

### Cles reservees de `[]`

Les cles suivantes sont reservees -- le compilateur les comprend
et les traduit en instructions BP3. Elles font partie du langage, pas d'une librairie :

```
/N   \N   *N   **N    operateurs temporels BP3
mode               mode du bloc (random, ord, sub1, lin, tem, poslong)
scan               sens du parcours par regle (left, right, rnd) -- defaut : rnd
weight             poids de la regle pour la selection
speed              ratio de tempo sur un groupe polymetrique
on_fail            gestion d'echec (skip, retry(N), fallback(X))
tempo              tempo local ou global (@tempo:120)
meter              signature rythmique (@meter:7/8, @meter:4/4)
scale              gamme microtonale
```

Toute cle non reservee dans `[]` est une erreur de compilation. Pour les parametres
destines au runtime (vel, filter, wave...), utiliser `()` a la place.

### Compilation de `[]` vers BP3

```
// BPscript                              -> BP3
A[/2] B C                                -> /2 A B C
[mode:random] S -> A B C                 -> RND  gram#N[M] S --> A B C
{C3, E3, G3, C4}[speed:2]               -> {2, C3, E3, G3, C4}
```

### `()` -- parametres runtime (toujours suffixe)

Les parametres `()` sont des donnees transportees vers le **runtime cible** (Web Audio,
SuperCollider, MIDI externe, OSC, DMX...). BPscript ne les interprete pas -- il les
transmet. C'est le dispatcher JS qui les route.

```
// Portee symbole -- colle a l'element
Sa(vel:120)                      // vel envoye au runtime quand Sa joue
C2(wave:sawtooth, filterQ:8)     // parametres de synthese

// Portee regle -- en fin de RHS
Bass -> C2 C2 - C2 (vel:100)     // vel pour toute la phrase

// Portee groupe -- apres le groupe
{A B C}(filter:lp, cutoff:4000)  // filtre sur tout le groupe
```

### Compilation de `()` vers BP3

Les `()` runtime sont compiles en `_script(CTn)` -- des controles opaques que BP3
transmet sans interpreter. Le transpileur maintient une table de mapping :

```
// BPscript                              -> BP3
Sa(vel:120)                              -> _script(CT0) Sa
{A B}(filter:lp)                         -> {_script(CT2_start) A B _script(CT2_end)}

// Table de mapping (cote JS) :
// CT0 -> { scope: 'symbol', params: { vel: 120 } }
// CT2_start/end -> { scope: 'group', params: { filter: 'lp' } }
```

### Valeur brute (modele CSS)

Pour `[]` et `()`, tout ce qui suit le `:` jusqu'au prochain `,` ou delimiteur
est la valeur brute. Le destinataire (moteur ou runtime) l'interprete -- BPscript
ne parse pas.

### Exception -- controles autonomes (resolution pure)

Quand un non-terminal se resout **entierement** en controles runtime
(pas d'element temporel), les controles peuvent apparaitre comme elements
RHS autonomes :

```
Pull0 -> (pitchbend:0)                                    // -> _script(CTn)
StartPull -> (pitchcont) (pitchrange:500) (pitchbend:0)    // -> _script(CT0) _script(CT1) _script(CT2)
```

C'est le seul cas ou des elements zero-duree sont toleres dans le RHS sans etre
attaches a un symbole.

### Resume des portees

| Portee      | Syntaxe          | Destinataire    | Exemple           |
| ----------- | ---------------- | --------------- | ----------------- |
| **globale** | `@cle:valeur`    | settings moteur | `@tempo:120`      |
| **groupe**  | `{}[cle:valeur]` | moteur BP3      | `{A B}[/2]`       |
| **regle**   | `[cle:valeur]`   | moteur BP3      | `[mode:random]`   |
| **symbole** | `[cle:valeur]`   | moteur BP3      | `A[/2]`           |
| **groupe**  | `{}(cle:valeur)` | runtime cible   | `{A B}(vel:100)`  |
| **regle**   | `(cle:valeur)`   | runtime cible   | `C2 C2 (vel:100)` |
| **symbole** | `(cle:valeur)`   | runtime cible   | `Sa(vel:120)`     |

---

## Les parentheses `()` -- quatre roles, zero ambiguite

Les parentheses ont quatre fonctions selon le contexte :

```
// 1. Parametre runtime -- sur un symbole, une regle ou un groupe
Sa(vel:120)                      // symbole : vel envoye au runtime quand Sa joue
C2 C2 - C2 (vel:100)             // regle : vel pour toute la phrase
{A B}(filter:lp, cutoff:4000)    // groupe : filter pour tout le groupe

// 2. Declaration -- avec un type devant
gate note(pitch, vel:80) { ... }

// 3. Appel -- apres un symbole dans une expression
note(Sa, vel:120)

// 4. Contexte -- condition d'application d'une regle
(A B) C -> D E           // C se reecrit en D E seulement si precede de A B
```

La regle de desambiguation est positionnelle :
- `symbole(` dans une expression = parametre runtime ou appel
- `(` en fin de RHS = parametre runtime de portee regle
- `{}(` apres un groupe = parametre runtime de portee groupe
- `type nom(` = declaration
- `(` en tete de regle, avant le LHS et `->` = contexte

Le **groupement** n'est pas un role de `()`. C'est `{}` qui fait le groupement,
conformement a BP3.

---

## Les accolades `{}` -- polymetrie et groupement

Les accolades ont trois roles :

```
// 1. Polymetrie -- plusieurs voix simultanees (separees par ,)
S -> { melodie, rythme }

// 2. Groupement temporel -- sous-groupe dans une sequence (une seule voix)
S -> A {B C D} E F

// 3. Etat interne -- dans les definitions (paires cle:valeur privees)
gate note(pitch, vel:80) { attack:5ms, decay:200ms }
```

Les roles 1 et 2 suivent le comportement de BP3.
Le role 3 est propre a BPscript (declarations typees).

### Ratio de tempo sur un bloc polymetrique

En BP3, un ratio optionnel peut preceder les voix : `{2, C3, E3, G3, C4}`.
En BPscript, ce ratio s'exprime via `[speed:]` sur le groupe -- plus lisible :

```
// BP3 : ratio en premiere position (implicite)
{2, C3, E3, G3, C4}

// BPscript : qualificateur explicite (meme resultat)
{C3, E3, G3, C4}[speed:2]

// Ratio fractionnaire
{mi fa sol}[speed:2/3]
```

Le compilateur traduit `{...}[speed:N]` -> `{N, ...}` pour BP3.
Pas de ratio implicite en BPscript -- tout passe par `[speed:]`.

---

## L'operateur `!` -- simultaneite

### `!` -- "a cet instant, aussi ca"

`!` attache un ou plusieurs elements secondaires a un point dans le temps.
Le premier element (le **primaire**) definit la position et la duree.
Tout ce qui suit `!` se declenche **au meme instant**.

`!` accepte **tous les types** :

```
Sa!dha                       // gate:sc + trigger:sc
Sa!visual_glow               // gate:sc + gate:processing (herite duree de Sa)
Sa!dha!spotlight [phase=2]   // gate + triggers + flag (! = temporel, [] = etat)
-!dha                        // silence + trigger
Sa!ramp(brightness,0,255)    // gate:sc + cv:python (herite duree de Sa)
```

Regles :
- **Avant `!`** : le primaire -- doit occuper du temps (gate, cv, silence)
- **Apres `!`** : secondaires -- se declenchent au meme instant
  - **trigger** -> zero duree
  - **gate** -> herite de la duree du primaire
  - **cv** -> herite de la duree du primaire
  - **`nom=valeur`** -> mutation de flag (zero duree)
- **`!` standalone** (sans primaire) : **out-time object** -- declenche hors-temps,
  sans occuper de duree. Compile en `<<symbol>>` pour BP3.

C'est le mecanisme central de la **simultaneite cross-runtime** :
un seul point dans le temps peut declencher des evenements dans
SC, Python, Processing, DMX -- sans utiliser la polymetrie.

### Bundles recurrents via macros

Si un ensemble d'evenements simultanes revient souvent, une macro
le factorise :

```
scene_a(x) = x!visual_glow!spotlight
scene_b(x) = x!visual_strobe!flash

S -> scene_a(Sa) scene_b(Re) scene_a(Ga)

// Expansion :
// Sa!visual_glow!spotlight Re!visual_strobe!flash Ga!visual_glow!spotlight
```

### `<!` -- trigger entrant (on attend)

`<!` est le miroir de `!` : il attend un signal externe avant de continuer.
C'est un point de synchronisation -- zero duree, comme tout trigger.

```
trigger sync1()     // declare trigger, configure dans le mapping

S -> -<!sync1 Sa Re Ga       // attend en silence, puis joue
S -> Sa<!sync1 Re Ga         // joue Sa, attend, puis continue
S -> <!sync1 Sa Re Ga        // attend seul puis demarre
S -> Sa!dha<!sync1 Re Ga     // joue Sa + dha, attend sync1, puis Re
```

La source du signal (MIDI, OSC, capteur, autre instance BP3...) est configuree
dans le mapping, pas dans le langage.

### `@hooks` -- interaction temps reel simplifiee

Le mecanisme `<!` est puissant mais bas niveau. La librairie `@hooks` fournit
des macros intuitives qui cachent la plomberie :

| Fonction              | Ce qu'elle fait                      | Expansion         |
| --------------------- | ------------------------------------ | ----------------- |
| `wait(x)`             | attend un signal                     | `<!x`             |
| `wait_all(a,b,c)`     | attend tous les signaux dans l'ordre | `<!a<!b<!c`       |
| `wait_timeout(x,ms)`  | attend avec limite de temps          | `<!x[timeout:ms]` |
| `speed_ctrl(cc,chan)` | CC MIDI pilote le tempo en live      | config dispatcher |
| `tap_tempo(key,chan)` | tap tempo via MIDI note              | config dispatcher |

---

## Les trois silences

| Symbole | Nom                   | Duree                       | Semantique                               |
| ------- | --------------------- | --------------------------- | ---------------------------------------- |
| `-`     | **silence**           | fixee par le compositeur    | absence d'evenement, occupe du temps     |
| `_`     | **prolongation**      | etend l'evenement precedent | le son continue, pas de nouvelle attaque |
| `...`   | **repos indetermine** | calculee par le moteur      | le moteur trouve la duree optimale       |

```
S -> Sa Re - Ga              // Silence explicite : 4 positions, la 3e est vide
S -> Sa _ Re Ga              // Prolongation : Sa dure 2 positions
S -> { A B C ..., D E F G }  // Repos indetermine : le moteur calcule
```

Le repos indetermine `...` est fondamental pour la **representation minimale**
des structures polymetriques. Le compositeur ecrit le minimum, le moteur
calcule les silences qui produisent la structure temporelle la plus simple.

---

## Period notation `.` -- fragments de duree egale

Le `.` est un separateur qui decoupe une sequence en fragments de **duree
symbolique egale**. C'est un mecanisme fondamental de BP3.

```
S -> A B . C D . E F          // 3 fragments : (A B), (C D), (E F)
S -> { A B . C D, E F G }    // voix 1 : 2 fragments, voix 2 : 3 symboles

// Derivation recursive avec expansion (exemple de Bernard Bel)
A -> E2 .
B -> D2 A                    // B = D2 E2 .
C -> B2 B                    // C = B2 D2 E2 .
```

En BPscript, `.` et `,` sont transmis tels quels a BP3 -- pas de traduction.

---

## Liaisons `~` -- tied sound-objects

`~` remplace le `&` de BP3 (reserve aux templates en BPscript).

Un son est tenu a travers d'autres evenements. Le NoteOn arrive au debut,
le NoteOff a la fin, malgre les autres sons entre les deux.

```
C4~ D4 E4 ~C4            // C4 tenu du debut a la fin
C4~ D4 E4 ~C4~ F4 ~C4    // C4 tenu, avec deux points de suture
```

Syntaxe :
- `C4~` = debut de liaison (NoteOn, pas de NoteOff)
- `~C4~` = continuation (pas de NoteOn ni NoteOff)
- `~C4` = fin de liaison (NoteOff)

Le compilateur traduit `~` -> `&` pour BP3 (`C4~` -> `C4&`, `~C4` -> `&C4`).

---

## Captures `?` -- pattern matching

`?` suivi d'un chiffre capture un symbole inconnu. A gauche de `->`, il capture.
A droite, il rejoue la valeur capturee.

```
?1 A ?1 -> ?1 B ?1       // do A do -> do B do
?1 ?2 -> ?2 ?1           // inverse deux symboles
?1(vel:120) -> ?1(vel:80) // change la velocite de tout symbole qui a vel:120
```

`?` capture exactement **un** symbole. Jusqu'a 32 captures numerotees par regle.
Le compilateur traduit `?n` vers les metavariables BP3.

---

## Homomorphismes `|x|` -- variables liees

`|x|` declare une variable qui matche n'importe quel symbole dans une regle.
Plus expressif que `?` pour les transformations structurelles.

```
|x| S x -> x S              // inversion
|x| x x -> x                // dedoublonnage
|x| |y| x y -> y x          // permutation
|x| (A) x B -> x C x        // variable avec contexte
```

---

## Contextes `()` et `#` -- conditions d'application

Les contextes permettent d'appliquer une regle seulement si le symbole
est entoure de certains voisins.

```
(A B) C -> D E              // contexte positif : C precede de A B
#(X Y) Z -> W               // contexte negatif : Z PAS precede de X Y
(A) C #(F) -> D E           // combinaison
```

`#` est le symbole de negation de contexte.

---

## Templates `$` et `&` -- capture et reutilisation de groupes

`$` definit (master) un motif de groupe. `&` le reference (slave).

```
S <> $mel &mel                            // $mel definit, &mel rejoue
S <> $mel(tempo:120) &mel(tempo:80)       // avec transformation
S -> ${$X S &X} &{$X S &X}               // capture de groupe entier
```

### Substitution (`[sub:table]`)

Les tables de substitution sont dans `lib/sub.json`. Le qualifier `[sub:nom]`
sur un template slave `&` applique la substitution nommee :

```
@sub

$N14 &N14[sub:dhati]       // capture N14, rejoue en substituant
```

Le compilateur traduit `$` -> `(=X)` et `&` -> `(:X)` pour BP3.

---

## Flags -- variables d'etat et composition conditionnelle

Les flags sont des variables entieres globales qui conditionnent l'application
des regles et permettent de modifier l'etat pendant la derivation.

### `[guard]` -- garde conditionnelle

**Test pur** (operateur de comparaison) :
```
[phase==1] S -> Sa Re Ga Pa       // active si phase vaut 1
[count>3]  A -> B C               // active si count > 3
```

**Test + mutation** (operateur arithmetique) :
```
[Ideas-1] I -> R1 A R2           // decremente Ideas, active si > 0 apres
[NumR+1] I -> I                  // incremente NumR (toujours actif)
```

Operateurs de test : `==`, `!=`, `>`, `<`, `>=`, `<=`
Operateurs de test+mutation : `+` (incremente), `-` (decremente)

La garde est declarative : la regle **existe** quand la condition est vraie.

### `[]` -- mutation d'etat dans le RHS

```
[phase==1] S -> Sa Re Ga [phase=2] Pa     // joue Ga, puis passe phase a 2
S -> A B [count+1] C                      // incremente count apres B
```

Operateurs de mutation : `=` (assigner), `+` (incrementer), `-` (decrementer)

La distinction est syntaxique :
- `!dha` -> `!` suivi d'un symbole -> trigger temporel
- `[phase=2]` -> `[]` -> mutation de flag (etat moteur)

Le compilateur traduit `[X==N]` -> `/X=N/` (condition BP3) et `[X=N]` -> `/X=N/` (assignation BP3).

### Exemple : raga en 3 phases

```
@alphabet.raga
@tempo:60

[phase==1] S -> alap S
[phase==2] S -> jor S
[phase==3] S -> jhala

alap -> Sa _ Re _ Ga _ [phase=2]
jor -> {Sa Re Ga Pa}[speed:2] [phase=3]
jhala -> {Sa Re Ga Pa Dha Ni Sa}[speed:4]
```

---

## Definitions et macros

### Definitions -- contrat temporel + runtime

Les definitions declarent le double contrat d'un symbole.

```
gate Sa:sc                       // Sa occupe du temps, SC le gere
trigger dha:sc                   // dha est instant, SC le gere
trigger flash:python             // flash est instant, Python le gere
cv ramp:sc                       // ramp varie continument, SC le gere
```

### Macros -- reecriture agnostique

Les macros sont de la substitution textuelle pure. Elles ne connaissent
ni les types ni les runtimes. Le typage est verifie apres expansion.

```
accent(x) = x(vel:120)
scene_a(x) = x!visual_glow!spotlight

S -> accent(Sa) scene_a(Re) Ga
// Apres expansion : Sa(vel:120) Re!visual_glow!spotlight Ga
```

Trois etapes, trois preoccupations, zero couplage :
- **Macros** = reecriture syntaxique (agnostique)
- **Types temporels** = gate/trigger/cv (verifies a la compilation)
- **Binding runtime** = sc/python/tidal (resolu au dispatch)

---

## Les librairies

Le langage ne connait que ses trois types. Les librairies apportent le vocabulaire.

```
@core                            // on_fail, controles moteur
@controls                        // vel, tempo, transpose, ins, chan...
@hooks                           // wait(), wait_all(), wait_timeout()...
@alphabet.western:supercollider  // C, D, E, F, G, A, B (gate:sc)
@alphabet.raga:supercollider     // Sa, Re, Ga... (gate:sc), dha, ti... (trigger:sc)
@sub.dhati                       // table de substitution dhati
@lights:python                   // spotlight, strobe, fade... (trigger:python)
@patterns                        // macros agnostiques : fast(), slow(), rev(), euclid()
```

**Convention stricte** : le nom de la directive = le nom du fichier JSON dans `lib/`.
Le `.` accede a une entree specifique dans le fichier :
- `@alphabet.western` -> `lib/alphabet.json` -> cle `"western"`
- `@sub.dhati` -> `lib/sub.json` -> cle `"dhati"`
- `@core` -> `lib/core.json` (fichier entier)

Les librairies definissent des **noms** et des **identites**, pas des formats de sortie.
Le runtime gere la production du son/signal.

### Conflits de noms

Si deux librairies definissent le meme symbole, le compilateur produit une erreur
et demande une resolution explicite :

```
@alphabet.raga               // definit A (degree 6 = Dha)
@alphabet.western            // definit A (note la)
// Erreur : symbole 'A' defini dans @alphabet.raga et @alphabet.western

// Resolution : alias explicite
@alphabet.raga
@alphabet.western(A:La)       // renomme A de @alphabet.western en La
```

---

## Operateurs temporels BP3

BP3 possede 4 operateurs temporels fondamentaux qui controlent deux variables
internes `speed` et `scale`. Le tempo effectif est `tempo = speed / scale`.

| BPscript       | Compile en BP3 | Variable    | Effet                        |
| -------------- | -------------- | ----------- | ---------------------------- |
| `A[/2]`        | `/2 A`         | speed = 2   | double la vitesse            |
| `A[\2]`        | `\2 A`         | speed = 1/2 | divise la vitesse par 2      |
| `A[*3]`        | `*3 A`         | scale = 3   | triple l'echelle de duree    |
| `A[**3]`       | `**3 A`        | scale = 1/3 | divise l'echelle par 3       |

Portee flexible : sur un symbole, un groupe, ou un polymetric.

---

## Metrique -- `@meter`

BPscript supporte la signature rythmique via la directive `@meter`.

```
@meter:4/4                       // mesure a 4 temps
@meter:7/8                       // mesure a 7 croches
@tempo:120                       // 120 BPM
```

**Distinction tempo vs metronome :**
- `[tempo:2]` = multiplicateur relatif (double la vitesse courante)
- `@mm:120` = marquage metronomique absolu (120 BPM)
- `@striated` / `@smooth` = bascule entre temps strie et temps lisse

---

## Modes, scan et directions -- trois niveaux distincts

| Niveau             | Question                             | BPscript         | Portee              |
| ------------------ | ------------------------------------ | ---------------- | ------------------- |
| **Mode du bloc**   | quelle strategie de selection ?      | `[mode:random]`  | bloc/sous-grammaire |
| **Scan par regle** | dans quel sens chercher le symbole ? | `[scan:left]`    | regle individuelle  |
| **Direction**      | la regle se lit dans quel sens ?     | `->`, `<-`, `<>` | regle individuelle  |

---

## Gestion d'echec -- `on_fail`

```
@on_fail:skip                              // directive globale
[on_fail:retry(3)] S -> A B C              // override local -- reessayer 3 fois
[on_fail:fallback(B)] S -> A B C           // basculer vers sous-grammaire B
```

Strategies : `skip`, `retry(N)`, `fallback(X)`.

---

## Deux philosophies du temps

BP3 possede deux facons de controler le flux temporel (cf. Boulez,
*Penser la musique aujourd'hui*, 1963) :

|               | Smooth time (temps lisse)              | `_tempo()` (temps strie)              |
| ------------- | -------------------------------------- | ------------------------------------- |
| **Paradigme** | fonctionnel -- le temps est une propriete | imperatif -- le temps est une commande |
| **Usage**     | alap indien, gagaku, musique non pulsee | musique occidentale, danse, pop       |
| **BP3**       | `_smooth` + time patterns              | `_striated` + `_tempo(x/y)`          |

BPscript unifie les deux dans la meme syntaxe via le systeme de types :

```
// Imperatif (comme _tempo) -- palier discret
{A B C}[speed:2]

// Fonctionnel (comme smooth time) -- propriete continue, CV
{A B C}[speed: ramp(1, 3)]
```

Le type `cv` est la **modernisation du smooth time de Boulez/Bel**.

| BPscript              | BP3                           | Concept                 |
| --------------------- | ----------------------------- | ----------------------- |
| **gate**              | sound-object (avec duree)     | evenement dans le temps |
| **trigger** (via `!`) | out-time object (duree nulle) | impulsion instantanee   |
| **cv**                | time pattern (smooth time)    | duree comme propriete   |

---

## Documents lies

- [BPSCRIPT_VISION.md](BPSCRIPT_VISION.md) -- Vue d'ensemble du projet
- [BPSCRIPT_EBNF.md](BPSCRIPT_EBNF.md) -- Grammaire formelle EBNF
- [BPSCRIPT_AST.md](BPSCRIPT_AST.md) -- Structure de l'AST
- [DESIGN_GRAMMAR.md](DESIGN_GRAMMAR.md) -- Mapping BPscript -> BP3
- [DESIGN_CV.md](DESIGN_CV.md) -- CV / signal objects
- [DESIGN_ARCHITECTURE.md](DESIGN_ARCHITECTURE.md) -- Architecture technique
