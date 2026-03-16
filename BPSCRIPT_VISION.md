# BPscript — Vision

## Principe fondamental

BPscript est un **méta-ordonnanceur** : il dérive des structures temporelles
et orchestre des comportements complexes écrits dans des vrais langages
(SuperCollider, TidalCycles, Python, etc.) avec la puissance des grammaires
formelles pour décider **quand** ces comportements se déclenchent.

Les symboles sont des noms avec un double contrat :
- **Type temporel** : comment ils se comportent dans le temps (gate, trigger, cv)
- **Runtime** : qui les manipule (sc, tidal, python, midi...)

Le langage connaît quatre mots et ne fait qu'une chose : ordonner dans le temps.

## Le langage : dense, pas simple

BPscript n'est pas un langage simple — c'est un langage **dense**. Il hérite
de 30 ans de recherche formelle sur les structures temporelles (Bernard Bel, BP3).

4 mots réservés, 24 symboles, 7 opérateurs — le vocabulaire est petit mais la
combinatoire est riche. Comme les échecs : 6 types de pièces, complexité infinie.

Le langage va du trivial au très complexe :

```
// Trivial — une séquence de notes
S -> Sa Re Ga Pa

// Intermédiaire — polymétrie avec triggers et flags
when phase==1 S -> { Sa!dha Re!ti, -!spotlight _ }

// Complexe — templates, captures, homomorphismes, multi-runtime
|x| (A) x!dha B -> x!ti $mel &mel [mode:random, phase+1]
```

Les symboles ne se mémorisent pas — ils se **lisent**. `->` est une flèche.
`!` est une impulsion. `...` est du suspens. La charge cognitive n'est pas
dans le vocabulaire mais dans la profondeur structurelle.

La vraie promesse : un compositeur peut commencer avec `S -> Sa Re Ga` et
découvrir progressivement la polymétrie, les flags, les captures, les backticks.
Chaque feature est optionnelle — la complexité est **additive**, pas imposée.

## Inventaire du langage : 4 mots, 24 symboles, 7 opérateurs

### Quatre mots réservés

| Mot         | Rôle  | Sens                                      |
| ----------- | ----- | ----------------------------------------- |
| **gate**    | type  | occupe du temps, valeur constante         |
| **trigger** | type  | instant, zéro durée, impulsion ponctuelle |
| **cv**      | type  | occupe du temps, valeur varie continûment |
| **when**    | garde | condition d'activation d'une règle (flag) |

Les trois types sont inspirés de l'eurorack et définissent le **rapport au temps** de chaque symbole.
Le compilateur sait ce qui occupe du temps et ce qui n'en occupe pas.
Le compositeur le voit aussi — les types sont explicites à la définition.
`when` est la garde conditionnelle — elle active ou désactive une règle selon l'état des flags.

### Vingt-quatre symboles structurels

```
@              environnement (imports, config globale)
-> <- <>       dérivation + direction (BP3 : --> <-- <->)
{ , }          polymétrie, groupement temporel, état interne de définition
( )            définition, appel, contexte
:              paire clé:valeur, binding runtime (gate Sa:sc)
=              définition de macro (+ assignation dans les flags)
[ ]            qualificateur local (sur un groupe ou une règle)
` `            code externe opaque (échappement vers le runtime)
//             commentaire
-              silence (occupe du temps, absence d'événement)
_              prolongation (étend l'événement précédent)
.              period notation (séparateur de fragments de durée égale)
...            repos indéterminé (durée calculée par le moteur)
!              événement zéro-durée : trigger sortant ou mutation de flag
<!             trigger entrant (on attend — point de synchronisation)
#              contexte négatif
?              capture (un symbole inconnu)
$              template : définition de motif (groupe)
&              template : référence au motif
~              liaison d'objets sonores (C4~ = début, ~C4 = fin, ~C4~ = continuation)
| |            homomorphisme (variable liée dans une règle)
```

Les symboles temporels (`-`, `_`, `.`, `...`) sont des symboles du langage,
pas du vocabulaire de librairie — le compilateur connaît leur sémantique.

Pas d'ambiguïté entre `.` et `...` : ce sont des caractères différents de `-`.
- `.` = toujours isolé (séparateur entre fragments)
- `...` = toujours 3 caractères collés (repos indéterminé)
- `-` = silence, `- - -` = trois silences (tokens séparés par des espaces)

### Sept opérateurs de flags

```
==             test d'égalité (dans when)
!=             test d'inégalité (dans when)
>              test supérieur (dans when)
<              test inférieur (dans when)
>=             test supérieur ou égal (dans when)
<=             test inférieur ou égal (dans when)
+              incrément (dans [flag])
```

Les opérateurs n'existent que dans le contexte des flags (`when` sur le LHS et `[mutation]` sur le RHS).
L'assignation `=` réutilise un symbole structurel existant.
Le décrément `-` et l'incrément `+` n'existent que dans le contexte des flags.

Deux portées, deux symboles :
- `@` = **global** : environnement, imports, configuration du système
- `[]` = **local** : instructions moteur BP3 — qualifiers, flags, opérateurs temporels

Les nombres (`0.7`, `120`, `5ms`) sont des symboles opaques comme les autres —
le langage ne connaît pas leur sémantique, c'est le récepteur qui les interprète.

**Pas de `for`, pas de `while`, pas de branchement.** BPscript décrit des structures
dans le temps. `when` est une garde déclarative (la règle existe ou non), pas du
branchement impératif. Toute logique algorithmique, traitement de signal ou chaînage
passe par le code externe (backticks) ou par le bridge.

## Système de types — double déclaration

Chaque symbole a un **double contrat** avant d'être utilisé :

| Dimension         | Question                | Valeurs                    | Exemples                        |
| ----------------- | ----------------------- | -------------------------- | ------------------------------- |
| **Type temporel** | comment dans le temps ? | gate, trigger, cv          | gate = durée, trigger = instant |
| **Runtime**       | qui le manipule ?       | sc, tidal, python, midi... | sc = SuperCollider évalue       |

Sans ces deux informations, le compilateur refuse. Il ne sait pas comment
ordonnancer (type temporel) ni où envoyer (runtime).

### Trois catégories de symboles

Une scène BPS contient trois catégories de symboles, identifiées automatiquement
par le compilateur :

| Catégorie        | Déclaration                             | Rôle                                           | Exemples                      |
| ---------------- | --------------------------------------- | ---------------------------------------------- | ----------------------------- |
| **Non-terminal** | implicite (apparaît en LHS d'une règle) | variable de grammaire, se réécrit et disparaît | S, I, A, B, R1, P4            |
| **Terminal**     | explicite (type + runtime)              | symbole de sortie, atteint un runtime          | sa6:gate:midi, dha:trigger:sc |
| **Contrôle**     | via `@+` / `@hooks`                     | commande moteur, zéro durée                    | vel(120), tempo(2), goto(2,1) |

Les non-terminaux sont des **symboles purement BPS** : ils n'existent que
pendant la dérivation, n'ont ni type temporel ni runtime. Ils se réécrivent
en terminaux via les règles de grammaire. Si un non-terminal survit dans la
sortie finale (n'a pas été réécrit), c'est une **erreur de grammaire** —
la dérivation est incomplète.

C'est la théorie standard des grammaires formelles : le compilateur détecte
les non-terminaux (tout symbole qui apparaît en LHS d'au moins une règle)
et les terminaux (tout symbole qui n'est jamais en LHS et doit être déclaré).

**Question ouverte** : faut-il une explicitation des non-terminaux dans la scène
(par exemple un commentaire conventionnel ou une section dédiée) pour aider
à la lisibilité des grammaires complexes ? Dans `mohanam.bps`, des symboles comme
`R1`, `P41`, `Str`, `Step3Up` sont des non-terminaux dont le rôle n'est pas
évident sans les commentaires. Le langage ne l'impose pas, mais une convention
pourrait aider.

### Déclaration : type temporel + runtime

La syntaxe utilise `:` pour lier un symbole à son runtime :

```
// Déclaration dans la scène
gate Sa:sc                       // Sa est un gate, géré par SuperCollider
trigger flash:python             // flash est un trigger, géré par Python
cv ramp:sc                       // ramp est un cv, géré par SuperCollider

// Déclaration par import (en bloc)
@raga:supercollider              // tous les symboles du raga → gate/trigger:sc
@lights:python                   // tous les symboles de lights → trigger:python
```

Le type temporel et le runtime ne changent jamais après déclaration.

Un symbole non déclaré est une erreur :
```
S -> Sa Re Bloup Ga
//            ^^^^
// ❌ Erreur : 'Bloup' n'est pas déclaré (ni type temporel, ni runtime)
```

Le parallèle en informatique : **CUDA** (`__device__ float x` = type + cible d'exécution),
**GLSL** (`uniform float x` = qualifier + type). Deux dimensions orthogonales sur le même objet.

### Paramètres — opaques pour BPscript

BPscript ne comprend pas les paramètres. Il les **transporte** vers le runtime,
qui sait quoi en faire.

```
// SC définit les paramètres dans un SynthDef
`sc: SynthDef(\sitar, { |freq, vel=80, attack=0.005| ... }).add`

// BPscript déclare le contrat temporel
gate Sa:sc

// Les paramètres sont transportés tels quels vers SC
Sa(vel:120)                      // littéral → SC reçoit vel=120
Sa(vel:`rrand(40,127)`)          // backtick → SC évalue rrand(40,127)
```

C'est un **gradient de complexité** — un seul mécanisme, une seule plomberie :

```
// Niveau 1 : littéral — BPscript transporte
Sa(vel:120)

// Niveau 2 : backtick — le runtime du symbole évalue
Sa(vel:`rrand(40,127)`)

// Niveau 3 : backtick orphelin — tag obligatoire
`sc: SynthDef(\grain, { |freq| ... }).add`
```

BPscript ne sait pas ce que `vel` veut dire. `120` est un littéral transporté,
`` `rrand(40,127)` `` est du code évalué par le runtime de Sa. Même chemin,
le gradient est cosmétique.

### Override et héritage

Les librairies déclarent les défauts des symboles qu'elles fournissent.
Le compositeur surcharge ponctuellement. Le runtime reçoit le résultat.

```
// @raga:supercollider définit Sa avec vel:80 par défaut

Sa                               // vel:80 (défaut hérité de la lib)
Sa(vel:120)                      // vel:120 (surcharge littérale)
Sa(vel:`rrand(40,127)`)          // vel:évalué par SC (surcharge backtick)
```

La surcharge ne modifie que les paramètres, jamais le contrat (type + runtime).

### CV — valeurs continues

`cv` exprime une valeur qui varie sur une durée. Chaque runtime résout les CV
avec ses outils natifs :

```
cv ramp:sc(from, to)
cv lfo:sc(rate, depth)

// Un accelerando progressif
S -> A B C D E F [tempo: ramp(100, 140)]

// Un crescendo
S -> A B C D [vel: ramp(40, 127)]
```

| Runtime    | Comment il résout les CV                               |
| ---------- | ------------------------------------------------------ |
| **Csound** | Table de valeurs, interpolation native (élégant)       |
| **SC**     | `Line.kr`, `Env` — enveloppes natives                  |
| **MIDI**   | Flood de CC messages à 50/sec (brut mais fonctionnel)  |
| **OSC**    | Transport universel, peut piloter Csound en temps réel |

La résolution du CV dépend de **qui a besoin des valeurs intermédiaires** :
- **Paramètres moteur** (speed, tempo) : le compilateur discrétise en paliers
  pour BP3 (solution "striated" — BP3 tient l'horloge micro)
- **Paramètres runtime** (vel, pan, freq) : instruction one-shot, le runtime
  interpole nativement (solution "smooth" — BP3 tient l'horloge macro)

Voir la section "CV — choix de design" dans l'architecture pour les détails.

## Les parenthèses `()` — trois rôles, zéro ambiguïté

Les parenthèses ont trois fonctions selon le contexte :

```
// 1. Déclaration — avec un type devant
gate note(pitch, vel:80) { ... }

// 2. Appel — après un symbole dans une expression
note(Sa, vel:120)

// 3. Contexte — condition d'application d'une règle
(A B) C -> D E           // C se réécrit en D E seulement si précédé de A B
```

La règle de désambiguïsation est positionnelle :
- `type nom(` = déclaration
- `symbole(` dans une expression = appel
- `(` en tête de règle, avant le LHS et `->` = contexte

Le **groupement** n'est pas un rôle de `()`. C'est `{}` qui fait le groupement,
conformément à BP3.

## Les accolades `{}` — polymétrie et groupement

Les accolades ont trois rôles :

```
// 1. Polymétrie — plusieurs voix simultanées (séparées par ,)
S -> { melodie, rythme }

// 2. Groupement temporel — sous-groupe dans une séquence (une seule voix)
S -> A {B C D} E F

// 3. État interne — dans les définitions (paires clé:valeur privées)
gate note(pitch, vel:80) { attack:5ms, decay:200ms }
```

Les rôles 1 et 2 suivent le comportement de BP3.
Le rôle 3 est propre à BPscript (déclarations typées).

### Ratio de tempo sur un bloc polymétrique

En BP3, un ratio optionnel peut précéder les voix : `{2, C3, E3, G3, C4}`.
En BPscript, ce ratio s'exprime via `[speed:]` sur le groupe — plus lisible :

```
// BP3 : ratio en première position (implicite)
{2, C3, E3, G3, C4}

// BPscript : qualificateur explicite (même résultat)
{C3, E3, G3, C4}[speed:2]

// Ratio fractionnaire
{mi fa sol}[speed:2/3]
```

Le compilateur traduit `{...}[speed:N]` → `{N, ...}` pour BP3.
Pas de ratio implicite en BPscript — tout passe par `[speed:]`.

Les qualificateurs `[]` s'appliquent à trois niveaux :

```
// Sur un groupe (compilé en /2 ... pour BP3)
S -> A {B C D}[speed:2] E F

// Sur une règle (mode de dérivation)
S -> A B C [mode:random]

// Sur un symbole
S -> A Sa[speed:2] B

// CV sur un groupe (résolution par le runtime)
S -> {A B C D}[speed: ramp(1, 3)]
```

## Qualificateurs `[]` — métadonnées structurelles locales

Les crochets portent des paires `clé:valeur` qui qualifient un groupe ou une règle.
Le style idiomatique est sans espace autour du `:` (mais les deux sont acceptés).

```
S -> A B C [mode:random]              // mode de dérivation
S -> A B C [tempo:160]                // tempo local
S -> A B C [weight:3]                 // poids de cette règle (vs autres règles pour S)
S -> A B C [weight:5-2]               // poids décroissant (5, puis 4, 3, 2)
{A B C}[speed:2]                      // vitesse doublée sur le groupe
```

Quatre portées pour les métadonnées, deux syntaxes :

| Portée      | Syntaxe          | Destinataire    | Exemple          |
| ----------- | ---------------- | --------------- | ---------------- |
| **globale** | `@clé:valeur`    | settings moteur | `@tempo:120`     |
| **groupe**  | `{}[clé:valeur]` | moteur BP3      | `{A B}[/2]`      |
| **règle**   | `[clé:valeur]`   | moteur BP3      | `[mode:random]`  |
| **symbole** | `[clé:valeur]`   | moteur BP3      | `A[/2]`          |
| **symbole** | `(clé:valeur)`   | runtime cible   | `Sa(vel:120)`    |

`[]` et `()` sur un symbole ont des rôles distincts :
- `Sa(vel:120)` → paramètre transporté au **runtime** (le runtime interprète)
- `A[/2]` → instruction pour le **moteur BP3** (le compilateur traduit en `/2 A`)

### Clés réservées de `[]`

Les clés suivantes sont réservées dans `[]` et `@` — le compilateur les comprend
et les traduit en instructions BP3. Elles font partie du langage, pas d'une librairie :

```
/N   \N   *N   **N    opérateurs temporels BP3 (voir § Opérateurs temporels)
mode               mode du bloc (random, ord, sub1, lin, tem, poslong)
scan               sens du parcours par règle (left, right, rnd) — défaut : rnd
weight             poids de la règle pour la sélection
on_fail            gestion d'échec (skip, retry(N), fallback(X))
tempo              tempo local ou global (@tempo:120)
meter              signature rythmique (@meter:7/8, @meter:4/4)
```

Toute autre clé dans `[]` est passée comme métadonnée opaque au runtime.

## Backticks — code natif dans le flux

Les backticks délimitent du code opaque pour BPscript. Le compilateur ne parse pas,
ne comprend pas, ne valide pas ce qu'il y a dans les backticks — il transporte
et le runtime évalue.

### Quel runtime évalue ?

- **Backtick attaché à un symbole** → runtime implicite (celui du symbole)
- **Backtick orphelin** → tag obligatoire (`sc:`, `py:`, `tidal:`)

```
@supercollider
@python
@raga:supercollider

// Orphelins — tag obligatoire (pas attachés à un symbole)
`sc: SynthDef(\sitar, { |freq, vel=80| ... }).add`
`py: import dmx; d = dmx.open()`
`sc: var i = 0`

// Attachés — runtime implicite
Sa(vel:`rrand(40,127)`)          // Sa est :sc → backtick évalué par SC
-!flash(`set_brightness(255)`)   // flash est :python → backtick évalué par Python
`sc: i = i + 1`                  // orphelin taggé → SC

// Paramètre littéral — pas de backtick, même chemin
Sa(vel:120)                      // SC reçoit vel=120 (transporté tel quel)
```

### Trois usages

- **Initialisation** : `` `sc: SynthDef(...)` `` au top-level — exécuté avant la dérivation
- **Terminal** : `` `sc: i = i + 1` `` dans une séquence — exécuté au temps t
- **Paramètre** : `` vel:`rrand(40,127)` `` — évalué pour calculer la valeur

### Variables et scopes

Chaque runtime maintient sa propre session persistante (REPL). Les variables
vivent dans le scope de leur runtime :

```
`sc: var i = 0`                  // SC scope : i = 0
`py: brightness = 100`           // Python scope : brightness = 100

// Même runtime, même session → variables partagées naturellement
Sa(vel:`sc: i`) `sc: i = i + 1` Re(vel:`sc: i`)
// i est dans le scope SC, persiste entre les backticks

// Runtimes différents → pas d'état partagé
// Coordination par flags BPscript ou triggers !/<! (OSC)
```

Un fichier **sans backticks** fonctionne avec n'importe quel runtime.
Un fichier **avec backticks** lie chaque backtick au runtime de son symbole.

## L'opérateur `!` — simultanéité

### `!` — "à cet instant, aussi ça"

`!` attache un ou plusieurs éléments secondaires à un point dans le temps.
Le premier élément (le **primaire**) définit la position et la durée.
Tout ce qui suit `!` se déclenche **au même instant**.

`!` accepte **tous les types** :

```
// Primaire (avant !) : gate, cv, ou silence — définit la durée
// Secondaires (après !) : tout type accepté

Sa!dha                       // gate:sc + trigger:sc
Sa!visual_glow               // gate:sc + gate:processing (hérite durée de Sa)
Sa!dha!spotlight [phase=2]   // gate + triggers + flag (! = temporel, [] = état)
-!dha                        // silence + trigger
Sa!ramp(brightness,0,255)    // gate:sc + cv:python (hérite durée de Sa)
```

Règles :
- **Avant `!`** : le primaire — doit occuper du temps (gate, cv, silence)
- **Après `!`** : secondaires — se déclenchent au même instant
  - **trigger** → zéro durée
  - **gate** → hérite de la durée du primaire
  - **cv** → hérite de la durée du primaire
  - **`nom=valeur`** → mutation de flag (zéro durée)

C'est le mécanisme central de la **simultanéité cross-runtime** :
un seul point dans le temps peut déclencher des événements dans
SC, Python, Processing, DMX — sans utiliser la polymétrie.

```
@supercollider
@python
@raga:supercollider
@lights:trigger.python

// Un seul point temporel, trois runtimes
S -> Sa!dha!spotlight Re!ti Ga!dha!fadeout Pa

// Multimédia complet
S -> Sa!dha!spotlight!visual_glow Re!ti Ga!dha _ -!fadeout Pa!dha!applause
```

### Bundles récurrents via macros

Si un ensemble d'événements simultanés revient souvent, une macro
le factorise. Les macros sont de la **substitution textuelle pure** —
elles ne savent rien des types ni des runtimes.

```
// Macros — réécriture agnostique
scene_a(x) = x!visual_glow!spotlight
scene_b(x) = x!visual_strobe!flash

// Usage
S -> scene_a(Sa) scene_b(Re) scene_a(Ga)

// Expansion (le compilateur voit) :
// Sa!visual_glow!spotlight Re!visual_strobe!flash Ga!visual_glow!spotlight
```

La macro ne sait pas que `visual_glow` est du Processing ni que `spotlight`
est du Python. Elle recopie. Le typage (temporel + runtime) est vérifié
**après** l'expansion.

Trois étapes, trois préoccupations, zéro couplage :
- **Macros** = réécriture syntaxique (agnostique)
- **Types temporels** = gate/trigger/cv (vérifiés à la compilation)
- **Binding runtime** = sc/python/tidal (résolu au dispatch)

### `<!` — trigger entrant (on attend)

`<!` est le miroir de `!` : il attend un signal externe avant de continuer.
C'est un point de synchronisation — zéro durée, comme tout trigger.

La syntaxe reprend la logique des flèches du langage : `->` (sortant), `<-` (entrant).

```
trigger sync1()     // déclaré trigger, configuré dans le mapping

// Attend en silence, puis joue
S -> -<!sync1 Sa Re Ga

// Joue Sa, attend, puis continue
S -> Sa<!sync1 Re Ga

// Attend seul (sans gate ni silence devant) puis démarre
S -> <!sync1 Sa Re Ga

// Chaînable avec des triggers sortants
S -> Sa!dha<!sync1 Re Ga    // joue Sa + dha, attend sync1, puis Re
```

La source du signal (MIDI, OSC, capteur, autre instance BP3...) est configurée
dans le mapping, pas dans le langage :

```json
{
  "inputs": {
    "sync1": { "source": "midi", "key": 60, "channel": 1 },
    "sync2": { "source": "osc", "address": "/sync/downbeat" }
  }
}
```

Cela permet la **composition distribuée** : plusieurs instances de BP3
tournant simultanément avec des grammaires différentes, synchronisées
par des triggers entrants/sortants. La source peut être MIDI, OSC,
ou tout autre protocole — le langage ne le sait pas.

### `@hooks` — interaction temps réel simplifiée

Le mécanisme `<!` est puissant mais bas niveau. La librairie `@hooks` fournit
des macros intuitives qui cachent la plomberie — comme `@+` le fait pour
les contrôles moteur.

```
@hooks

// Attente simple
S -> wait(downbeat) Sa Re Ga Pa
// Expansion : <!downbeat Sa Re Ga Pa

// Attente multiple (AND séquentiel)
S -> Sa wait_all(sync1, sync2) Re Ga
// Expansion : Sa <!sync1<!sync2 Re Ga

// Attente avec timeout (ms)
S -> Sa wait_timeout(cue, 5000) Re Ga
// Expansion : Sa <!cue[timeout:5000] Re Ga

// Contrôleur continu en live (CC MIDI pilote le tempo)
@tempo: speed_ctrl(cc:1, chan:1)
// Configure le dispatcher pour écouter CC1 et modifier le tempo

// Contraintes de tempo
@min_tempo:60
@max_tempo:180
```

`@hooks` traduit en `<!` + qualificateurs. Le compositeur écrit des noms
lisibles, le compilateur produit les wait tags BP3 appropriés.

Fonctions disponibles dans `@hooks` :

| Fonction              | Ce qu'elle fait                      | Expansion         |
| --------------------- | ------------------------------------ | ----------------- |
| `wait(x)`             | attend un signal                     | `<!x`             |
| `wait_all(a,b,c)`     | attend tous les signaux dans l'ordre | `<!a<!b<!c`       |
| `wait_timeout(x,ms)`  | attend avec limite de temps          | `<!x[timeout:ms]` |
| `speed_ctrl(cc,chan)` | CC MIDI pilote le tempo en live      | config dispatcher |
| `tap_tempo(key,chan)` | tap tempo via MIDI note              | config dispatcher |

## Métrique — `@meter`

BPscript supporte la signature rythmique via la directive `@meter`.
Le compilateur traduit vers les paramètres de time-base de BP3.

```
@meter:4/4                       // mesure à 4 temps
@meter:7/8                       // mesure à 7 croches
@tempo:120                       // 120 BPM
```

La métrique interagit avec :
- `@tempo` — le BPM s'applique à l'unité de temps définie par `@meter`
- `[speed:N]` — modifie la vitesse relative à la métrique
- Le repos indéterminé `...` — le moteur calcule en respectant la métrique
- Le live coding quantized — les changements s'alignent sur les barres

BP3 utilise des proportions rationnelles pour le temps, pas des durées absolues.
`@meter` définit le cadre métrique dans lequel ces proportions s'inscrivent.

## Les trois silences

BPscript hérite de BP3 trois façons d'exprimer l'absence de son, chacune
avec une sémantique temporelle distincte :

| Symbole | Nom                   | Durée                       | Sémantique                               |
| ------- | --------------------- | --------------------------- | ---------------------------------------- |
| `-`     | **silence**           | fixée par le compositeur    | absence d'événement, occupe du temps     |
| `_`     | **prolongation**      | étend l'événement précédent | le son continue, pas de nouvelle attaque |
| `...`   | **repos indéterminé** | calculée par le moteur      | le moteur trouve la durée optimale       |

```
@raga

// Silence explicite : 4 positions, la 3e est vide
S -> Sa Re - Ga

// Prolongation : Sa dure 2 positions
S -> Sa _ Re Ga

// Repos indéterminé : le moteur calcule la durée pour équilibrer les voix
S -> { A B C ..., D E F G }
```

Le repos indéterminé `...` est fondamental pour la **représentation minimale**
des structures polymétriques. Le compositeur écrit le minimum, le moteur
calcule les silences qui produisent la structure temporelle la plus simple
(via le plus petit commun multiple des durées rationnelles).

C'est la notation la plus proche de ce qu'un musicien humain attendrait :
on spécifie la structure, pas les détails de timing.
Si le résultat ne convient pas, on remplace un `...` par un silence `-`
de durée explicite.

## Period notation `.` — fragments de durée égale

Le `.` est un séparateur qui découpe une séquence en fragments de **durée
symbolique égale**. C'est un mécanisme fondamental de BP3 pour la construction
de structures polymétriques.

```
// Chaque fragment entre les . a la même durée symbolique
S -> A B . C D . E F          // 3 fragments : (A B), (C D), (E F)

// Combinable avec la polymétrie
S -> { A B . C D, E F G }    // voix 1 : 2 fragments de 2 symboles, voix 2 : 3 symboles

// Dérivation récursive avec expansion (exemple de Bernard Bel)
A -> E2 .
B -> D2 A                    // B = D2 E2 .
C -> B2 B                    // C = B2 D2 E2 .
// Chaque dérivation ajoute une note au début, le . maintient les proportions
```

La period notation et la polymétrie utilisent le **même algorithme d'expansion**
de BP3 et peuvent être combinées librement. Le `.` dans une séquence et le `,`
dans un `{}` sont les deux faces du même mécanisme.

### `{}` optionnels pour une séquence unique

Conformément à BP3, les `{}` peuvent être omis quand il n'y a qu'une seule
séquence (pas de polymétrie) :

```
// Avec {} — explicite
S -> {A B . C D . E F}

// Sans {} — même chose, une seule séquence
S -> A B . C D . E F

// {} obligatoire seulement pour la polymétrie (plusieurs voix avec ,)
S -> {A B . C D, E F G}
```

Le parser sait que `.` dans une séquence = period notation. Pas besoin
d'envelopper dans `{}` pour lever l'ambiguïté.

En BPscript, `.` et `,` sont transmis tels quels à BP3 — pas de traduction.
Les espaces autour de `,` et `.` sont optionnels (le tokenizer les ignore).

## Flags — variables d'état et composition conditionnelle

Les flags sont des variables entières globales qui conditionnent l'application
des règles et permettent de modifier l'état pendant la dérivation.

### `when` — garde conditionnelle (test ou test+mutation)

`when` a deux formes, fidèles à la sémantique de BP3 :

**Test pur** (opérateur de comparaison) :
```
when phase==1 S -> Sa Re Ga Pa       // active si phase vaut 1
when count>3  A -> B C               // active si count > 3
when tension!=0 A -> B C             // active si tension ≠ 0
```

**Test + mutation** (opérateur arithmétique) :
```
when Ideas-1 I -> R1 A R2           // décrémente Ideas, active si > 0 après
when Notes-4 A -> P4                // décrémente Notes de 4, active si > 0
when NumR+1 I -> I                  // incrémente NumR (toujours > 0 → toujours actif)
```

La forme `when flag-N` est **atomique** : elle décrémente ET teste au moment
de la **sélection** de la règle — pas à la production. C'est la sémantique
exacte de BP3 (`/flag-N/` en position gauche). Le compilateur traduit
directement en `/flag-N/` pour BP3.

Opérateurs de test : `==`, `!=`, `>`, `<`, `>=`, `<=`
Opérateurs de test+mutation : `+` (incrémente et teste > 0), `-` (décrémente et teste > 0)

`when` est déclaratif : la règle **existe** quand la condition est vraie.
Ce n'est pas du branchement (if/else) — c'est une garde, comme dans les
L-systems paramétriques ou les clauses Erlang.

### `!` — mutation d'état dans le RHS

La mutation de flag utilise `!`, le même opérateur que les triggers.
C'est cohérent : les deux sont des **événements zéro-durée** attachés
à un point dans le flux temporel.

```
when phase==1 S -> Sa Re Ga [phase=2] Pa     // joue Ga, puis passe phase à 2
S -> A B [count+1] C                          // incrémente count après B
S -> A [tension-1] B                          // décrémente tension après A
when phase==2 S -> Ga [phase=1] Re Sa        // joue Ga, reset phase à 1
```

Opérateurs de mutation : `=` (assigner), `+` (incrémenter), `-` (décrémenter)

La distinction est syntaxique — pas d'ambiguïté :
- `!dha` → `!` suivi d'un symbole → trigger temporel
- `[phase=2]` → `[]` → mutation de flag (état moteur)
- `[Atrans]` → `[]` flag nu → flag set/ref

Les flags peuvent aussi référencer d'autres flags :
- `[flag1=flag2]` → copier la valeur d'un autre flag
- `when flag1==flag2` → comparer deux flags

### Exemple : raga en 3 phases

```
@raga
@tempo:60

// Gardes : chaque phase a ses propres règles
when phase==1 S -> alap S
when phase==2 S -> jor S
when phase==3 S -> jhala

// L'ālāp explore lentement, puis bascule
alap -> Sa _ Re _ Ga _ [phase=2]

// Le jor accélère, puis bascule
jor -> {Sa Re Ga Pa}[speed:2] [phase=3]

// Le jhālā conclut
jhala -> {Sa Re Ga Pa Dha Ni Sa}[speed:4]
```

### Exemple : compteur cyclique

```
when count==0 A -> Sa Re [count+1]
when count==1 A -> Ga Pa [count+1]
when count==2 A -> Dha Ni [count=0]    // reset → boucle

// 3 dérivations de A donnent 3 résultats différents, puis ça recommence
```

Les flags sont le mécanisme de **composition conditionnelle** de BP3 :
on écrit des règles qui ne s'activent que dans certains états, et on fait
évoluer ces états pendant la dérivation. C'est plus puissant que du hasard pur
(`[mode:random]`) — ça permet de construire des **parcours compositionnels**.

Le compilateur traduit `when X==N` → `/X=N/` (condition BP3) et `[X=N]` → `/X=N/` (assignation BP3).

## Liaisons `~` — deux usages distincts

`~` remplace le `&` de BP3 (réservé aux templates en BPscript).
Deux usages, deux complexités — mais une seule syntaxe :

### Liaison mélodique (legato/slur)

Les notes se chevauchent légèrement pour un phrasé fluide.
En BPscript, c'est un contrôle `@+` — pas besoin de `~` :

```
legato(20) Sa Re Ga      // 20% de prolongation sur chaque note
```

Le compilateur traduit en `_legato(20)` pour BP3.

### Objets sonores liés (tied sound-objects)

Un son est tenu à travers d'autres événements. Le NoteOn arrive au début,
le NoteOff à la fin, malgré les autres sons entre les deux.

```
C4~ D4 E4 ~C4            // C4 tenu du début à la fin
                          // D4 et E4 jouent pendant que C4 est tenu

C4~ D4 E4 ~C4~ F4 ~C4    // C4 tenu, avec deux points de suture
```

Syntaxe :
- `C4~` = début de liaison (NoteOn, pas de NoteOff)
- `~C4~` = continuation (pas de NoteOn ni NoteOff)
- `~C4` = fin de liaison (NoteOff)

Le compilateur traduit `~` → `&` pour BP3 (`C4~` → `C4&`, `~C4` → `&C4`).
Le moteur BP3 gère la complexité : retrouver le `~C4` correspondant à travers
les structures polymétriques, gérer les cas d'erreur (si `~C4` n'est pas trouvé,
la liaison est abandonnée — mieux que de garder une touche enfoncée indéfiniment).

## Homomorphismes `|x|` — variables liées

`|x|` déclare une variable qui matche n'importe quel symbole dans une règle.
Contrairement à `?` (qui capture pour réutilisation numérotée), `|x|` exprime
des **transformations structurelles** — le même symbole doit apparaître partout
où la variable est utilisée.

```
// Inversion : quel que soit x, si on voit S x, on produit x S
|x| S x -> x S

// Dédoublonnage : quel que soit x, x x devient x
|x| x x -> x

// Plusieurs variables
|x| |y| x y -> y x                  // permutation

// Variable avec contexte
|x| (A) x B -> x C x               // x précédé de A et suivi de B
```

Les homomorphismes sont le mécanisme de **pattern matching avec variables**
de BP3. Plus expressif que `?` pour les transformations structurelles,
car les variables ont un nom sémantique et participent au matching global.

## Captures `?` — pattern matching dans les règles

`?` suivi d'un chiffre capture un symbole inconnu. À gauche de `->`, il capture.
À droite, il rejoue la valeur capturée.

```
// ?1 matche n'importe quel symbole, doit être le même des deux côtés
?1 A ?1 -> ?1 B ?1
// do A do → do B do
// Sa A Sa → Sa B Sa

// Plusieurs captures numérotées
?1 ?2 -> ?2 ?1              // inverse deux symboles

// Capture avec paramètres
?1(vel:120) -> ?1(vel:80)   // change la vélocité de tout symbole qui a vel:120
```

`?` capture exactement **un** symbole. Jusqu'à 32 captures numérotées par règle.
Le compilateur traduit `?n` vers les métavariables BP3.

## Contextes `()` et `#` — conditions d'application

Les contextes permettent d'appliquer une règle seulement si le symbole
est entouré de certains voisins.

```
// Contexte positif : C se réécrit en D E seulement si précédé de A B
(A B) C -> D E

// Contexte négatif : Z se réécrit en W seulement si PAS précédé de X Y
#(X Y) Z -> W

// Combinaison : contexte gauche positif + droit négatif
(A) C #(F) -> D E           // C précédé de A et PAS suivi de F
```

`#` est le symbole de négation de contexte. Il se place devant les parenthèses
du contexte à nier. Le compilateur traduit vers les contextes BP3.

## Templates `$` et `&` — capture et réutilisation de groupes

`$` définit (master) un motif de groupe. `&` le référence (slave).
Contrairement à `?` qui capture un seul symbole, les templates capturent
des **groupes** de symboles et contraignent leur réapparition.

```
// $mel définit un motif, &mel le référence (doit être identique)
S <> $mel &mel

// Template avec transformation de paramètres
S <> $mel(tempo:120) &mel(tempo:80)

// Templates sur un groupe — ${...} et &{...}
S -> ${$X S &X} &{$X S &X}    // capture et rejoue un groupe entier
```

`$` et `&` ne dépendent pas de la position par rapport à `->` :
- `$X` est toujours la définition (master), où qu'il soit
- `&X` est toujours la référence (slave), où qu'il soit
- Plusieurs `&X` peuvent référencer le même `$X`

Le compilateur traduit `$` → `(=X)` et `&` → `(:X)` pour BP3.

## Définitions et macros

### Définitions — contrat temporel + runtime

Les définitions déclarent le double contrat d'un symbole.
Les paramètres sont opaques pour BPscript — le runtime les interprète.

```
@supercollider
@python

// Définitions — type temporel : runtime
gate Sa:sc                       // Sa occupe du temps, SC le gère
trigger dha:sc                   // dha est instant, SC le gère
trigger flash:python             // flash est instant, Python le gère
cv ramp:sc                       // ramp varie continûment, SC le gère

// Le runtime définit les sons/comportements dans son langage
`sc: SynthDef(\sitar, { |freq, vel=80| ... }).add`
`py: def flash_light(brightness): dmx.set(1, brightness)`
```

### Macros — réécriture agnostique

Les macros sont de la substitution textuelle pure. Elles ne connaissent
ni les types ni les runtimes. Le typage est vérifié après expansion.

```
// Macros — alias et transformations (avec =)
accent(x) = x(vel:120)
scene_a(x) = x!visual_glow!spotlight

// Usage
S -> accent(Sa) scene_a(Re) Ga

// Après expansion, le compilateur voit :
// Sa(vel:120) Re!visual_glow!spotlight Ga
// Et vérifie les types + runtimes de chaque symbole
```

### Compilation

Le compilateur encode les appels en terminaux opaques pour BP3 :

```
// BPscript : Sa(vel:120)
// Terminal BP3 : gate_Sa_vel~120
// Le runtime SC décode et interprète
```

BP3 reçoit un terminal opaque. Le runtime décode la convention de nommage
et interprète les paramètres avec ses outils natifs.

## Les librairies

Le langage ne connaît que ses trois types. Les librairies apportent le vocabulaire —
les noms, leurs types temporels, et leur identité abstraite.
Les librairies sont liées à un runtime à l'import.

```
@core                            // on_fail, contrôles moteur
@+                               // tempo(), vel(), pan(), mm(), striated(), smooth()
@hooks                           // wait(), wait_all(), wait_timeout(), speed_ctrl()...
@raga:supercollider              // Sa, Re, Ga... (gate:sc), dha, ti... (trigger:sc)
@western:supercollider           // C, D, E, F, G, A, B (gate:sc)
@lights:python                   // spotlight, strobe, fade... (trigger:python)
@patterns                        // macros agnostiques : fast(), slow(), rev(), euclid()
```

`@patterns` n'a pas de runtime — ce sont des macros (réécriture textuelle).
`@core`, `@+` et `@hooks` sont des contrôles moteur BP3, pas des objets runtime.

`@+` fournit les contrôles de performance avec des noms propres.
Le compositeur écrit `tempo(2)`, le compilateur produit `_tempo(2)` pour BP3.
Le `_` est un détail d'implémentation, invisible dans le source BPscript.

**Distinction tempo vs métronome :**
- `tempo(2)` = multiplicateur relatif (double la vitesse courante)
- `mm(120)` = marquage métronomique absolu (120 BPM)
- `striated()` / `smooth()` = bascule entre temps strié et temps lisse

Ce sont trois niveaux distincts du contrôle temporel (cf. B12).

Une librairie déclare les types et le runtime de ses symboles.
Quand on importe `@raga:supercollider`, `Sa` est un `gate:sc` et `dha` est
un `trigger:sc` — le compositeur n'a pas besoin de le redéclarer.

```
@raga:supercollider

// Sa est gate:sc, dha est trigger:sc — déclarés par @raga
S -> Sa Re Ga Pa              // 4 gates (occupent du temps, gérés par SC)
S -> Sa!dha Re!dha Ga!dha     // gates + triggers (même runtime : SC)
```

La même librairie peut être liée à un runtime différent :
```
@raga:csound                  // même vocabulaire, Csound au lieu de SC
@raga:midi                    // même vocabulaire, MIDI direct
```

Les librairies définissent des **noms** et des **identités**, pas des formats de sortie.
Le runtime gère la production du son/signal.

### Conflits de noms

Si deux librairies définissent le même symbole, le compilateur produit une erreur
et demande une résolution explicite :

```
@raga               // définit A (degree 6 = Dha)
@western            // définit A (note la)
// ❌ Erreur : symbole 'A' défini dans @raga et @western

// Résolution : alias explicite
@raga
@western(A:La)       // renomme A de @western en La
```

## Les 5 couches + runtime (MusicOSI)

BPscript sépare les préoccupations en 5 couches déclaratives + un runtime.

| #   | Couche          | Où                | Rôle                                              |
| --- | --------------- | ----------------- | ------------------------------------------------- |
| 1   | **Définition**  | `.bp`             | déclarer des types, créer des macros              |
| 2   | **Composition** | `.bp`             | structurer dans le temps (dérivation, polymétrie) |
| 3   | **Librairie**   | `lib/*.json`      | noms → types + identités musicales abstraites     |
| 4   | **Tempérament** | `tuning/*.json`   | degrés → fréquences (ratios, Hz)                  |
| 5   | **Routage**     | `*.routing.json`  | quel événement → quel adaptateur                  |
|     | **Runtime**     | Python, SC, JS... | adaptateurs parallèles, chacun gère ses symboles  |

Les 5 couches sont déclaratives et indépendantes.
Le runtime est catégoriquement différent — c'est du code, pas de la donnée.

### 1. Définition (le vocabulaire)

Déclarer le double contrat (type temporel + runtime) et des macros.

```
@core
@supercollider
@python
@raga:supercollider               // notes → SC
@lights:python                    // lumières → Python

// Runtime : définir les sons et comportements natifs
`sc: SynthDef(\sitar, { |freq, vel=80| ... }).add`
`py: import dmx; d = dmx.open()`

// Macros agnostiques (réécriture textuelle)
accent(x) = x(vel:120)
scene_a(x) = x!visual_glow!spotlight
```

### 2. Composition (la structure temporelle)

Le cœur BP : dérivation, polymétrie, proportions.
Les runtimes sont déclarés, le compositeur se concentre sur la structure.

```
@core
@supercollider
@python
@raga:supercollider
@lights:python
@tempo:120

// Structure polymétrique : mélodie, rythme et lumières synchronisés
S -> { melodie, rythme, lumieres }

// Mélodie (SC) avec paramètres — littéraux ou backticks
melodie -> Sa(vel:110) Re Ga(vel:`sc: rrand(80,120)`) Pa

// Rythme (SC) : triggers sur silences
rythme -> -!dha(vel:120) - -!ti(vel:60) -!dha

// Lumières (Python) : triggers sur silences
lumieres -> -!spotlight _ _ _ -!fadeout

// Bundles cross-runtime via macros
S -> scene_a(Sa) scene_a(Re) Ga Pa

// Groupement avec vitesse doublée
S -> A {B C D}[speed:2] E F

// Dérivation avec mode aléatoire
S -> A B C [mode:random]

// Direction inversée
S <- A B C

// Pattern matching
?1 B ?1 -> ?1 C ?1

// Template : mélodie répétée avec des tempos différents
S <> $mel[tempo:120] &mel[tempo:80]

// Code externe : compteur SC dans le flux temporel
`sc: var i = 0`
melodie -> Sa(vel:`sc: i*20`) `sc: i=i+1` Re(vel:`sc: i*20`) `sc: i=i+1` Ga
```

### 3. Librairie — les noms (`lib/raga.json`)

Définit les noms, leurs types, et leur identité musicale abstraite.
Aucune information de sortie.

```json
{
  "name": "raga",
  "symbols": {
    "Sa": { "type": "gate", "degree": 1, "params": { "vel": 80 } },
    "Re": { "type": "gate", "degree": 2, "params": { "vel": 80 } },
    "Ga": { "type": "gate", "degree": 3, "params": { "vel": 80 } },
    "Ma": { "type": "gate", "degree": 4, "params": { "vel": 80 } },
    "Pa": { "type": "gate", "degree": 5, "params": { "vel": 80 } },
    "Dha": { "type": "gate", "degree": 6, "params": { "vel": 80 } },
    "Ni": { "type": "gate", "degree": 7, "params": { "vel": 80 } },
    "dha": { "type": "trigger", "id": "bass_open" },
    "dhin": { "type": "trigger", "id": "bass_closed" },
    "ti": { "type": "trigger", "id": "high_closed" },
    "ta": { "type": "trigger", "id": "high_open" }
  }
}
```

### 4. Tempérament — les fréquences (`tuning/shruti.json`)

Traduit les degrés en fréquences. Pas de noms de notes, pas de MIDI.

```json
{
  "name": "shruti",
  "base_hz": 261.63,
  "ratios": {
    "1": "1/1",
    "2": "9/8",
    "3": "5/4",
    "4": "4/3",
    "5": "3/2",
    "6": "5/3",
    "7": "15/8"
  }
}
```

### 5. Routage (`morceau.routing.json`)

Déclare quel événement va vers quel adaptateur. Le routage est par symbole
ou par type — pas par voix. Une même voix peut contenir des événements
destinés à différents adaptateurs.

```json
{
  "adapters": {
    "sc": { "type": "supercollider", "host": "localhost:57110" },
    "midi": { "type": "midi", "device": "IAC Driver" },
    "dmx": { "type": "dmx", "universe": 1 }
  },
  "routes": {
    "gate.note": "sc",
    "trigger.percussion": "midi",
    "trigger.light": "dmx"
  },
  "tuning": "shruti"
}
```

Le routage indique aussi le tempérament à utiliser. Chaque adaptateur
le traduit dans le format natif de sa cible (SC : `Tuning`, MIDI : note + pitch bend,
Csound : Hz dans le score).

### Runtime — les adaptateurs

Le runtime n'est pas une couche déclarative. C'est du **code** — un ou plusieurs
adaptateurs qui tournent en parallèle, chacun dans le langage de sa cible.

Chaque adaptateur :
- Reçoit les événements structurés horodatés qui lui sont destinés
- Traduit le tempérament dans le format natif de sa cible
- Évalue les backticks attachés à ses symboles (dans son propre langage)
- Produit la sortie concrète (audio, MIDI, DMX, etc.)

```
@core
@supercollider                    // runtime SC disponible
@python                           // runtime Python disponible
@raga:supercollider               // les notes du raga → SC
@lights:trigger.python            // les triggers lumière → Python

S -> Sa!dha Re!spotlight Ga Pa
//   ^^      ^^^^^^^^^^^
//   SC      Python (spotlight est un trigger.light → dmx via Python)
```

Un fichier **sans backticks** fonctionne avec n'importe quel adaptateur.
Un fichier **avec backticks** lie chaque backtick au runtime de son symbole.

#### Backticks et multi-runtime

Les backticks sont évalués par le runtime du symbole auquel ils sont attachés :

```
Sa(vel:`rrand(40, 127)`)         // Sa → SC → backtick SCLang
-!spotlight(`set_brightness(255)`) // spotlight → Python → backtick Python
```

Les backticks **orphelins** (non attachés à un symbole) doivent être taggés :

```
`sc:var i = 0`                    // init dans le scope SC
`py:import dmx`                   // init dans le scope Python
```

Chaque runtime maintient son propre scope de variables.
Il n'y a **pas d'état partagé** entre runtimes — la coordination passe
par les flags BPscript (gérés par BP3) ou les triggers `!`/`<!`.

**Ce sujet (multi-runtime, backticks taggés, routage par symbole) reste à approfondir.**

### Qui sait quoi

| Couche                      | Sait                             | Ne sait pas                           |
| --------------------------- | -------------------------------- | ------------------------------------- |
| 1. Définition (`.bp`)       | types, macros, paramètres        | fréquences, MIDI, format de sortie    |
| 2. Composition (`.bp`)      | structure temporelle, dérivation | fréquences, MIDI, format de sortie    |
| 3. Librairie (`lib/`)       | noms → types + identités         | fréquences, MIDI, format de sortie    |
| 4. Tempérament (`tuning/`)  | degrés → Hz/ratios               | noms de notes, MIDI, format de sortie |
| 5. Routage (`routing.json`) | quel événement → quel adaptateur | structure, composition                |
| Runtime (adaptateurs)       | résoudre et exécuter ses events  | les events des autres adaptateurs     |

Cinq couches déclaratives + un runtime parallèle.

## Modes, scan et directions — trois niveaux distincts

BP3 a trois niveaux de contrôle sur la dérivation, chacun avec sa syntaxe :

| Niveau             | Question                             | BP3                               | BPscript         | Portée              |
| ------------------ | ------------------------------------ | --------------------------------- | ---------------- | ------------------- |
| **Mode du bloc**   | quelle stratégie de sélection ?      | ORD, RND, SUB1, LIN, TEM, POSLONG | `[mode:random]`  | bloc/sous-grammaire |
| **Scan par règle** | dans quel sens chercher le symbole ? | LEFT, RIGHT, RND                  | `[scan:left]`    | règle individuelle  |
| **Direction**      | la règle se lit dans quel sens ?     | `-->`, `<--`, `<->`               | `->`, `<-`, `<>` | règle individuelle  |

```
// Mode du bloc — stratégie de sélection
S -> A B C [mode:random]      // RND : choix aléatoire parmi les règles
S -> A B C [mode:sub1]        // SUB1 : substitution
S -> A B C [mode:ord]         // ORD : ordonné
S -> A B C [mode:lin]         // LIN : linéaire
S -> A B C [mode:tem]         // TEM : template matching
S -> A B C [mode:poslong]     // POSLONG : position la plus longue

// Scan — sens du parcours pour trouver le symbole à réécrire
S -> A B C [scan:left]        // LEFT : depuis la gauche (leftmost)
S -> A B C [scan:right]       // RIGHT : depuis la droite (rightmost)
S -> A B C                    // défaut : rnd (position aléatoire)

// Direction — sens de lecture de la règle
S -> A B C                    // --> : production (gauche → droite)
S <- A B C                    // <-- : analyse (droite → gauche)
S <> A B C                    // <-> : bidirectionnel

// Combinable
S -> A B C [mode:random, scan:left, weight:50]
```

## Gestion d'échec de dérivation — `on_fail`

Quand une dérivation échoue (aucune règle ne s'applique), BP3 a des mécanismes
de contrôle de flux (`_goto`, `_failed`). BPscript les exprime à un niveau
d'abstraction plus élevé, comme une gestion d'interruptions :

```
// Directive globale — s'applique à toute la grammaire
@on_fail:skip                              // ignorer la règle qui échoue

// Override local sur une règle
[on_fail:retry(3)] S -> A B C              // réessayer 3 fois
[on_fail:fallback(B)] S -> A B C           // basculer vers sous-grammaire B
```

Stratégies disponibles :
- `skip` — sauter la règle, continuer la dérivation
- `retry(N)` — réessayer N fois (utile avec `[mode:random]`)
- `fallback(X)` — basculer vers la sous-grammaire X

`on_fail` fait partie de `@core`. Le compilateur traduit en `_goto`/`_failed` pour BP3.

## Opérateurs temporels BP3

BP3 possède 4 opérateurs temporels fondamentaux qui contrôlent deux variables
internes `speed` et `scale`. Le tempo effectif est `tempo = speed / scale`.
Ce sont des instructions zéro-durée — elles modifient l'état du séquenceur
sans occuper de temps.

En BPscript, ces opérateurs sont exposés directement dans `[]` — pas de
mot-clé intermédiaire, la notation mathématique est plus explicite :

| BPscript       | Compilé en BP3 | Variable    | Effet                        |
| -------------- | -------------- | ----------- | ---------------------------- |
| `A[/2]`        | `/2 A`         | speed = 2   | double la vitesse            |
| `A[\2]`        | `\2 A`         | speed = 1/2 | divise la vitesse par 2      |
| `A[*3]`        | `*3 A`         | scale = 3   | triple l'échelle de durée    |
| `A[**3]`       | `**3 A`        | scale = 1/3 | divise l'échelle par 3       |

Portée flexible — sur un symbole, un groupe, ou un polymetric :
- `A[/2]` → `/2 A` (un seul élément)
- `{A B C}[/2]` → `/2 A B C` (groupe)
- `{voix1, voix2}[/2]` → `/2 {voix1, voix2}` (polymetric entier)

Note : le ratio de tempo polymétrique (`{2, voix1, voix2}`) est un concept
distinct — c'est une propriété du conteneur `{}`, pas un opérateur de vitesse.
Il s'exprime en BPscript par le premier élément numérique avant la virgule
dans `{}` : `{voix1, voix2}[speed:2]` → `{2, voix1, voix2}`.

## Deux philosophies du temps — et BPscript les unifie

BP3 possède deux façons de contrôler le flux temporel, héritées de deux
philosophies incompatibles (cf. Boulez, *Penser la musique aujourd'hui*, 1963) :

|               | Smooth time (temps lisse)                               | `_tempo()` (temps strié)                          |
| ------------- | ------------------------------------------------------- | ------------------------------------------------- |
| **Paradigme** | fonctionnel — le temps est une **propriété** de l'objet | impératif — le temps est une **commande** externe |
| **Analogie**  | l'objet *est* lent                                      | on *dit* à l'objet d'aller lentement              |
| **Usage**     | ālāp indien, gagaku, musique non pulsée                 | musique occidentale, danse, pop                   |
| **BP3**       | `_smooth` + time patterns                               | `_striated` + `_tempo(x/y)`                       |

BPscript unifie les deux dans la même syntaxe via le système de types :

```
// Impératif (comme _tempo) — palier discret, trigger-like
{A B C}[speed:2]

// Fonctionnel (comme smooth time) — propriété continue, CV
{A B C}[speed: ramp(1, 3)]
```

Le type `cv` est la **modernisation du smooth time de Boulez/Bel**.
Un `cv ramp(100, 140)` sur le tempo, c'est du smooth time — le tempo
est une propriété de la structure, pas une commande insérée dans le flux.

Les types BPscript correspondent aux concepts de BP3 :

| BPscript              | BP3                           | Concept                 |
| --------------------- | ----------------------------- | ----------------------- |
| **gate**              | sound-object (avec durée)     | événement dans le temps |
| **trigger** (via `!`) | out-time object (durée nulle) | impulsion instantanée   |
| **cv**                | time pattern (smooth time)    | durée comme propriété   |

## Live coding

Modifier en live, recompiler à chaud :
- Changer une **définition** → le comportement change, la structure reste
- Changer la **composition** → la structure change, les comportements restent
- Changer la **librairie** → le vocabulaire change, la structure reste
- Changer le **tempérament** → l'accord change, les notes restent
- Changer le **routage** → la destination change, la musique reste
- Changer les **backticks** → la logique algorithmique change, la structure reste

Cinq couches + backticks, chacun modifiable indépendamment.
Le moteur BP3 re-dérive en temps réel.

### BPscript comme méta-ordonnanceur

L'idée centrale : BP3 sait **quand**. SC, Tidal, Python savent **quoi**.
Les backticks connectent les deux dans un seul fichier.

```
@core
@supercollider
@tidal
@python
@raga:supercollider
@lights:trigger.python

// Initialisation — chaque runtime prépare ses objets
`sc: SynthDef(\grain, { |freq, dens| GrainSin.ar(dens, freq) }).add`
`tidal: let pat = s "bd sd hh sd"`
`py: import dmx; d = dmx.open()`

// Structure temporelle — BP3 orchestre tout
when phase==1 S -> { intro, rythme }
when phase==2 S -> { melodie, rythme, lumieres }

// SC reçoit les gates et les synthés
melodie -> Sa _ Re `sc: Synth(\grain, [freq:880, dens:100])` _ _ Ga Pa

// Tidal reçoit ses patterns, démarrés/arrêtés par BP3
rythme -> `tidal: d1 $ pat # speed 1` _ _ _
          `tidal: d1 $ pat # speed 2` _ _ _ [phase=2]
          `tidal: d1 $ silence`

// Python pilote les lumières
lumieres -> -!spotlight _ _ _ -!fadeout
```

Un fichier. Trois langages. Un seul ordonnanceur. Live-codable.

BP3 ne produit pas juste des notes — il orchestre des **comportements complexes**
écrits dans des vrais langages, avec la puissance structurelle des grammaires
formelles (dérivation, polymétrie, flags, captures) pour décider **quand**
ces comportements se déclenchent.

La synchronisation est parfaite parce que c'est BP3 qui tient l'horloge —
pas de drift entre les langages.

C'est l'argument massif :
- SC seul fait du son complexe mais ordonnance mal les macro-structures
- Tidal seul fait des patterns mais pas de grammaires formelles
- Python seul fait de la logique mais ne sait pas le temps musical
- BP3 seul est un puissant ordonnanceur de structures temporelles mais délègue la production sonore
- **BPscript + backticks = les quatre ensemble**

Le méta-ordonnanceur est agnostique de la cible :
- **Audio** : SuperCollider, Csound, Web Audio
- **Patterns** : TidalCycles (via SuperDirt)
- **Lumières** : DMX via Python/OSC
- **Vidéo** : Processing, TouchDesigner via OSC
- **Eurorack** : gate/trigger/CV via OSC, MIDI, ou MIDI 2.0
- **Graphiques** : Canvas, WebGL, SVG via JavaScript
- **Robotique** : servos, drones, CNC via OSC/serial
- **Installations** : capteurs, actionneurs, IoT
- **Tout ce qui a besoin d'être orchestré dans le temps**

Et la boucle est bouclée avec l'eurorack : les types gate/trigger/cv
de BPscript viennent du monde modulaire, et ils peuvent **retourner**
vers du modulaire. Le langage parle nativement le vocabulaire de ses
cibles hardware.

BPscript est un pont entre ces mondes :
- Les compositeurs qui veulent une syntaxe minimale pour la structure
- Les live-codeurs SC/Tidal qui veulent du code algorithmique dans le flux
- Les artistes multimédia qui veulent synchroniser son, lumière, vidéo
- Les musiciens modulaires qui veulent des structures complexes pour l'eurorack

Les backticks ouvrent une fenêtre vers chaque langage sans polluer
la syntaxe structurelle. La structure est lisible et claire,
le code est ponctuel et délimité.

## Philosophie de séparation

BPscript ne fait qu'une chose : **ordonner des symboles typés dans le temps.**

- Logique algorithmique → backticks (dans le langage du runtime cible)
- Traitement de signal → adaptateur (SuperCollider, Csound, Web Audio)
- Sound design → adaptateur (SuperCollider SynthDefs, Csound instruments)
- Routage et dispatching → fichier de routage (JSON)
- Tempérament et accordage → fichier de tempérament (JSON, traduit par l'adaptateur)

Comme HTML ne contient pas de boucles et CSS ne contient pas de fonctions.
Chaque couche fait ce qu'elle sait faire. BPscript sait faire le temps.
Quand il faut de la logique, les backticks ouvrent une fenêtre vers un vrai langage
sans polluer la syntaxe structurelle.

## Architecture technique

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌──────────┐    ┌───────────┐    ┌──────────────────────┐  │
│  │ Éditeur  │    │Compilateur│    │   Moteur BP3 WASM    │  │
│  │ (.bp)    │───→│ BPscript  │───→│                      │  │
│  │          │    │           │    │ Dérivation            │  │
│  └──────────┘    │ Type-check│    │ Polymétrie            │  │
│                  │ Expansion │    │ Ordonnancement        │  │
│  ┌──────────┐    │ Encodage  │    │                      │  │
│  │Librairies│───→│           │    └──────────┬───────────┘  │
│  │ (JSON)   │    └───────────┘               │              │
│  └──────────┘                                │              │
│                                              ▼              │
│  ┌──────────┐                     ┌──────────────────────┐  │
│  │Tempéra-  │                     │ Séquence horodatée   │  │
│  │ment(JSON)│                     │ (terminaux + temps)  │  │
│  └──────────┘                     └──────────┬───────────┘  │
│                                              │              │
│  ┌──────────┐                     ┌──────────▼───────────┐  │
│  │ Routage  │────────────────────→│     Dispatcher       │  │
│  │ (JSON)   │                     │ route par symbole/   │  │
│  └──────────┘                     │ type vers adaptateurs│  │
│                                   └──┬──────┬──────┬─────┘  │
│                                      │      │      │        │
└──────────────────────────────────────┼──────┼──────┼────────┘
                                       │      │      │
                    ┌──────────────────┐│      │      │┌──────────────┐
                    │  Adaptateur SC   │◄      │      ►│ Adaptateur   │
                    │  (SCLang)        │       │       │ Python       │
                    │  traduit tempér. │       │       │ traduit temp.│
                    │  évalue backticks│       │       │ évalue backt.│
                    │  → scsynth      │       │       │ → DMX, OSC   │
                    └──────────────────┘       │       └──────────────┘
                                              │
                                   ┌──────────▼───────────┐
                                   │  Adaptateur MIDI     │
                                   │  traduit tempérament │
                                   │  → hardware MIDI     │
                                   └──────────────────────┘
```

### Composants

**Éditeur** — Interface web avec deux vues :
- Onglet BPscript : édition du source `.bp`
- Onglet Grammar : grammaire BP3 générée (lecture seule, auto-compilée)

**Compilateur BPscript** — JavaScript, exécuté côté client :
- Tokenizer : source → flux de tokens (24 symboles + 4 mots + 7 opérateurs)
- Parser : tokens → AST (Program, Directive, Rule, Definition, Macro, Call, Polymetry)
- Type-checker : vérifie le double contrat (type temporel + runtime binding)
- Macro-expander : substitution textuelle pure (agnostique types/runtimes)
- Encoder : AST → grammaire BP3 texte + alphabet + settings

**Moteur BP3 WASM** — C compilé en WebAssembly via Emscripten :
- Source : [bolprocessor/bolprocessor](https://github.com/bolprocessor/bolprocessor) (Bernard Bel)
- Fork : [roomi-fields/bp3-engine](https://github.com/roomi-fields/bp3-engine) (branche wasm)
- Dérivation de grammaires formelles (9 modes, 3 directions)
- Résolution de polymétrie (algorithme LCM de Bernard Bel)
- Calcul des repos indéterminés `...`
- Gestion des flags, captures, templates, homomorphismes
- Produit une séquence de terminaux horodatés

**Dispatcher** (JS, nouveau composant central) — Route et résout :
- Décode les terminaux opaques (convention de nommage → type + runtime + paramètres)
- Route chaque événement vers le(s) runtime(s) concerné(s) selon le binding
- Pour les backticks-paramètres : envoie au runtime, récupère la valeur, résout
- Pour les CV : discrétise ou délègue selon le type de paramètre (voir CV ci-dessous)
- Un même point temporel (`!`) peut être dispatché à plusieurs runtimes
- Gère le scheduling temps réel (horloge de playback)

**Runtimes** — Sessions persistantes (REPL), un par langage cible :
- Chaque runtime est une session vivante (sclang, ghci+Tidal, Python, etc.)
- Reçoit les événements structurés horodatés
- Évalue les backticks dans son propre langage et scope
- Traduit le tempérament dans son format natif (SC: `Tuning`, MIDI: note+bend)
- Produit la sortie concrète (audio, MIDI, DMX, etc.)
- Plusieurs runtimes tournent en parallèle
- L'interface est universelle (~100 lignes par langage) :
  - `connect()` — ouvrir la session
  - `eval(code, time)` — envoyer du code au temps T
  - `getValue(expr)` — évaluer et retourner une valeur
  - `close()` — fermer la session

### Interfaces entre composants

Le chemin `source → son` traverse 3 interfaces. Les deux premières existent,
la troisième est à créer.

**Interface 1 : Compilateur → Moteur BP3 WASM** (existe)

Format : texte grammaire BP3 (format `-gr.` standard) + alphabet + settings.
C'est le format natif de BP3, inchangé. Le compilateur BPscript actuel
(`src/bpscript/compiler.js`) produit déjà ce format.

```
// Grammaire BP3 (texte)
gram#1[1] ORD S --> {melodie, rythme}
gram#1[2] ORD melodie --> gate_Sa_vel~80 gate_Re_vel~80

// Alphabet
gate_Sa_vel~80, gate_Re_vel~80, ...

// Settings
-se.DURATION 10000
```

**Interface 2 : Moteur BP3 WASM → Dispatcher** (existe)

Format : tableau JS d'événements horodatés, exposé via l'API WASM.
Chaque événement contient le terminal opaque, le temps de début et la durée.

```js
[
  { terminal: "gate_Sa_vel~80", start: 0, duration: 1000 },
  { terminal: "gate_Re_vel~80", start: 1000, duration: 1000 },
  { terminal: "backtick_sc_i=i+1", start: 1000, duration: 0 },
  ...
]
```

Les backticks sont encodés comme des terminaux spéciaux dans la grammaire BP3.
Le moteur les traite comme n'importe quel terminal — il ne les évalue pas.

**Interface 3 : Dispatcher → Runtimes** (à créer)

Format : messages structurés envoyés aux sessions REPL. C'est le composant
central à concevoir. Chaque message contient :

```js
{
  type: "event",           // event | eval | getValue
  runtime: "sc",           // quel runtime reçoit
  symbol: "Sa",            // le symbole BPscript
  temporalType: "gate",    // gate | trigger | cv
  params: { vel: 120 },    // paramètres littéraux (déjà résolus)
  backticks: { vel: "rrand(40,127)" },  // paramètres backtick (à évaluer)
  start: 0,                // ms depuis le début
  duration: 1000,          // ms (0 pour triggers)
}
```

Pour les backticks standalone :
```js
{
  type: "eval",
  runtime: "sc",
  code: "i = i + 1",
  time: 1000
}
```

Pour les backticks-paramètres (le dispatcher attend la réponse) :
```js
// Dispatcher envoie :
{ type: "getValue", runtime: "sc", expr: "rrand(40,127)" }
// Runtime répond :
{ value: 87 }
// Dispatcher résout et envoie l'event avec vel: 87
```

### Flux d'exécution

```
1. Compilation : .bp → grammaire BP3 (avec backticks encodés comme terminaux)
2. Dérivation : BP3 → séquence horodatée (terminaux + backticks opaques)
3. Playback en temps réel :
   │
   │  à chaque temps T, le dispatcher :
   │  ├→ décode le terminal (type + runtime + params + backticks)
   │  ├→ backticks-paramètres : getValue → runtime évalue → résout
   │  ├→ événement résolu → envoie au(x) runtime(s) concerné(s)
   │  └→ backticks-standalone : eval → runtime exécute (side effect)
```

### CV — choix de design (à trancher)

Le CV pose une question fondamentale : **qui interpole entre les bornes ?**

La réponse dépend de **qui a besoin des valeurs intermédiaires** :

**Paramètres moteur** (speed, scale, tempo) → **solution "striated"**
BP3 DOIT connaître chaque valeur car c'est lui qui calcule les durées.
Le compilateur discrétise le CV en N paliers.

```
// BPscript : CV continu
{A B C D}[speed: ramp(1, 3)]

// Le compilateur produit N paliers discrets pour BP3 :
/1 A /1.66 B /2.33 C /3 D
```

**Paramètres runtime** (vel, pan, freq, brightness) → **solution "smooth"**
BP3 n'a pas besoin des valeurs intermédiaires. Il donne le start et la durée.
Le runtime interpole nativement (SC: `Line.kr`, Csound: tables, MIDI: CC flood).

```
// BPscript : CV continu sur un paramètre runtime
Sa(vel: ramp(40, 127))

// Le dispatcher envoie au runtime :
// "interpole vel de 40 à 127 sur la durée de Sa"
// SC produit : Line.kr(40, 127, dur)
// MIDI produit : flood de CC à 50 msg/sec
```

**BP3 tient toujours l'horloge macro** (quand ça commence, quand ça finit).
Le runtime gère le micro (ce qui se passe entre les bornes). C'est la même
séparation que MIDI : le séquenceur envoie note-on et note-off, le synthé
gère l'ADSR entre les deux.

### Live coding — choix de design (à trancher)

**Latence estimée :**
- Compilation BPscript → BP3 : < 10ms (génération de texte)
- Dérivation BP3 : 10-500ms selon la complexité de la grammaire
- Dispatch : négligeable
- Total réaliste : **50-100ms** pour une grammaire typique

**Granularité — 3 stratégies possibles :**

| Stratégie     | Comportement                                | Avantage        | Risque           |
| ------------- | ------------------------------------------- | --------------- | ---------------- |
| **Quantized** | le changement prend effet au prochain cycle | sûr, prévisible | latence perçue   |
| **Immediate** | la dérivation en cours est remplacée        | réactif         | glitch possible  |
| **Queued**    | attend un point de sync pour basculer       | musical         | moins interactif |

Recommandation : commencer par **quantized** (comme TidalCycles qui quantise
sur le cycle). Ajouter les autres modes plus tard si nécessaire.

**État lors du hot-swap :**
- Les **sessions runtime restent vivantes** : SynthDefs, variables, patterns préservés
- Les **flags BP3 sont réinitialisés** : la recompilation repart de zéro
- Asymétrie assumée : l'état structurel (flags) repart, l'état sonore (runtimes) persiste
- Possibilité future : sauvegarder/restaurer les flags lors du hot-swap

### Pipeline de compilation détaillé

```
Source (.bp)
  │
  ▼
Tokenizer ──→ flux de tokens
  │
  ▼
Parser ──→ AST
  │
  ▼
Type-checker
  │  - vérifie le double contrat : type temporel (gate/trigger/cv) + runtime
  │  - résout les imports (@raga:sc, @lights:python)
  │  - détecte les conflits de noms entre librairies
  │  - valide les ! (primaire doit occuper du temps)
  │  - rejette les symboles non déclarés
  │
  ▼
Macro-expander
  │  - expanse les définitions (note(Sa) → paramètres complets)
  │  - expanse les macros (accent(Sa) → Sa(vel:120))
  │
  ▼
Encoder
  │  1. Encode les appels paramétrés en terminaux opaques
  │  2. Traduit ?n → métavariables BP3
  │  3. Traduit $/& → (=X)/(:X) (templates BP3)
  │  4. Traduit #() → contextes négatifs BP3
  │  5. Traduit |x| → variables d'homomorphisme BP3
  │  6. Traduit when X==N → /X=N/ (condition BP3)
  │  7. Traduit [X=N] → /X=N/ (assignation BP3)
  │  8. Traduit ~ → & (notes liées BP3)
  │  9. Passe - (silence) et . (period) tels quels vers BP3
  │  10. Traduit [on_fail:...] → _goto/_failed
  │  11. Traduit [speed:N] → /N, *N, etc.
  │  12. Traduit @+ controls → _tempo(), _vel(), etc.
  │
  ▼
Grammaire BP3 + alphabet + settings
  │
  ▼
Moteur WASM (dérivation + ordonnancement)
  │
  ▼
Séquence horodatée
  │
  ▼
Dispatcher (routage par symbole/type)
  │
  ├→ Adaptateur SC (évalue backticks SC, traduit tempérament, → scsynth)
  ├→ Adaptateur MIDI (traduit tempérament, → hardware MIDI)
  ├→ Adaptateur Python (évalue backticks Python, → DMX, OSC, etc.)
  └→ ...
```

Le moteur BP3 est **non-bloquant** : il produit des résultats partiels
pendant la dérivation, permettant un retour audio immédiat même sur
des grammaires complexes.

### Composition distribuée

Plusieurs instances de BPscript/BP3 peuvent tourner simultanément,
synchronisées par des triggers :

```
┌────────────────┐          ┌────────────────┐
│  Instance A    │   !sync  │  Instance B    │
│  (mélodie)     │─────────→│  (percussion)  │
│                │          │                │
│  Sa!sync Re    │   <!sync │  <!sync -!dha  │
└────────────────┘←─────────└────────────────┘
                    !reply
```

Les messages transitent par MIDI, OSC, ou tout protocole configuré
dans le mapping. Le langage ne connaît que `!nom` et `<!nom` —
le transport est transparent.

## Extensions futures (nécessitent des modifications du moteur BP3)

### Capture de groupes

Actuellement `?` capture exactement **un** symbole. Il n'existe pas de mécanisme
pour capturer un **groupe** de symboles de longueur variable.

```
// Aujourd'hui : capture un seul symbole
?1 A ?1 -> ?1 B ?1

// Futur : capturer un groupe (syntaxe à définir)
?1... A ?1... -> ?1... B ?1...     // ?1 matche N symboles
```

Cette extension nécessite des modifications dans le moteur BP3 au niveau
du pattern matching des métavariables, qui ne supporte actuellement que
la correspondance symbole-à-symbole.

### CV sur les paramètres moteur (speed, scale, tempo)

Le type `cv` est exprimable dans le langage sur n'importe quel paramètre,
mais les paramètres résolus par le moteur BP3 lui-même (speed, scale, tempo)
ne supportent que des valeurs discrètes.

```
// Aujourd'hui : paliers discrets
S -> {A B}[speed:1] {C D}[speed:2] {E F}[speed:3]

// Futur : courbe continue
S -> {A B C D E F}[speed: ramp(1, 3)]
```

Pour les paramètres bridge (vel, pan, etc.), les CV sont implémentables
immédiatement — le bridge interpole entre les points.

Pour speed/scale/tempo, trois approches possibles :
1. **Modifier le moteur BP3** pour supporter des durées variables (lourd)
2. **Discrétiser** au compilateur — `ramp(1, 3)` → série de `/N` (approximation)
3. **Post-traiter** — le bridge déforme le timeline après la résolution BP3

---

## Évolutions requises du moteur BP3

### Conventions de notes extensibles

Le moteur BP3 actuel a **3 conventions de notes hardcodées** dans le code C
(`NoteConvention` : 0=français, 1=anglais, 2=indien). Le mapping nom→MIDI
est statique — impossible d'ajouter de nouvelles conventions sans modifier
et recompiler le moteur.

Dans l'architecture BPscript, les conventions de notes sont des **librairies JSON**
(`@western`, `@raga`, et à terme `@solfege`, `@tabla`, ou toute convention
définie par l'utilisateur). L'encoder génère l'alphabet (format OCT) et les
settings (NoteConvention) pour que le moteur BP3 reconnaisse les terminaux.

**Limitation actuelle** : on est contraint aux 3 conventions hardcodées.
Pour les alphabets custom (tabla bols, sons concrets, noms arbitraires),
BP3 a besoin de fichiers `-mi` (prototypes MIDI) — un format binaire
complexe impossible à générer depuis les librairies JSON.

**Évolution nécessaire** : extraire le mapping nom→MIDI du code C et le rendre
paramétrique. Le moteur devrait accepter un dictionnaire `{ "nom": midi_number }`
passé programmatiquement, rendant obsolètes :
- Le champ `NoteConvention` hardcodé dans les settings
- Les fichiers `-mi` (prototypes binaires)
- La limitation à 3 systèmes de notation

Cela permettrait à BPscript de supporter une infinité de conventions via
de simples librairies JSON — chaque `@monAlphabet` définirait ses propres
terminaux et leur mapping MIDI, sans recompilation du moteur.

### Alphabets sans MIDI

Certains terminaux n'ont pas de mapping MIDI (lumières DMX, triggers OSC,
événements Python). Le moteur BP3 les traite actuellement comme des
"undefined variables" — il dérive la grammaire mais ne produit pas de MIDI.
La séquence horodatée est correcte, le dispatcher route vers les bons runtimes.
C'est suffisant pour l'architecture actuelle.

### Quoted symbols non portés

BP3 supporte les **quoted symbols** (`'1'`, `'texte'`) pour utiliser des
caractères spéciaux ou des nombres comme terminaux. BPscript **ne porte pas**
cette syntaxe — les terminaux sont toujours des identifiants (`letter { letter | digit | _ | # }`).

Raisons :
- Les nombres nus dans le flux BPscript sont des **durées numériques**, pas des terminaux
- Les mots réservés de BPscript (`gate`, `trigger`, `cv`, `when`, `lambda`) sont peu nombreux et rarement en conflit
- Les quoted symbols ajoutent de la complexité syntaxique pour un usage rare

Les grammaires BP3 qui utilisent des quoted symbols sont **renommées** dans la
traduction (ex: `'1'` → `d1`, `'2'` → `d2`). Le mapping est documenté dans
les commentaires de chaque scène.
