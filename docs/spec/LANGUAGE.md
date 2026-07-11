# BPScript Language Specification

## Table des matieres

- [Principe fondamental](#principe-fondamental)
- [Le langage : dense, pas simple](#le-langage--dense-pas-simple)
- [Concepts cles](#concepts-cles)
- [Philosophie de separation](#philosophie-de-separation)
- [Le meta-ordonnanceur](#le-meta-ordonnanceur)
- [Inventaire : 3 mots, 24 symboles, 9 operateurs](#inventaire--3-mots-24-symboles-9-operateurs)
- [Systeme de types -- double declaration](#systeme-de-types----double-declaration)
- [Parametres -- opaques pour BPScript](#parametres----opaques-pour-bpscript)
- [`[]` moteur vs `()` runtime](#-moteur-vs--runtime----deux-destinataires-memes-portees)
- [Les parentheses `()` -- quatre roles](#les-parentheses------quatre-roles-zero-ambiguite)
- [Les accolades `{}` -- polymetrie et groupement](#les-accolades------polymetrie-et-groupement)
- [L'operateur `!` -- simultaneite](#loperateur------simultaneite)
- [Les trois silences](#les-trois-silences)
- [Period notation `.`](#period-notation------fragments-de-duree-egale)
- [Liaisons `~`](#liaisons------tied-sound-objects)
- [Captures `?`](#captures------pattern-matching)
- [Homomorphismes `|x|`](#homomorphismes-x----variables-liees)
- [Contextes `()` et `#`](#contextes----et------conditions-dapplication)
- [Templates `$` et `&`](#templates----et------capture-et-reutilisation-de-groupes)
- [Templates : regime catalogue (v0.8)](#templates---regime-catalogue-v08)
- [Sons et cascade d'heritage (v0.8)](#sons-et-cascade-dheritage-v08)
- [Conventions de notation v0.8 (. / : / *)](#conventions-de-notation-v08-----)
- [Flags](#flags----variables-detat-et-composition-conditionnelle)
- [Definitions et macros](#definitions-et-macros)
- [Les librairies](#les-librairies)
- [Operateurs temporels BP3](#operateurs-temporels-bp3)
- [Metrique -- `@meter`](#metrique----meter)
- [Modes, scan et directions](#modes-scan-et-directions----trois-niveaux-distincts)
- [Gestion d'echec -- `on_fail`](#gestion-dechec----on_fail)
- [Deux philosophies du temps](#deux-philosophies-du-temps)
- [Compilation vers BP3](#compilation-vers-bp3)

---

## Principe fondamental

BPScript est un **meta-ordonnanceur** : il derive des structures temporelles
et orchestre des comportements complexes ecrits dans des vrais langages
(SuperCollider, TidalCycles, Python, etc.) avec la puissance des grammaires
formelles pour decider **quand** ces comportements se declenchent.

Les symboles sont des noms avec un double contrat :
- **Type temporel** : comment ils se comportent dans le temps (gate, trigger, cv)
- **Runtime** : qui les manipule (sc, tidal, python, midi...)

Le langage connait trois mots et ne fait qu'une chose : ordonner dans le temps.

---

## Le langage : dense, pas simple

3 mots reserves, 24 symboles, 9 operateurs de flags -- le vocabulaire est petit mais la
combinatoire est riche. Comme les echecs : 6 types de pieces, complexite infinie.

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

## Concepts cles

### Backticks -- code natif dans le flux

```
`sc: SynthDef(\grain, {...}).add`      // orphelin -- init avant derivation
Sa(vel:`rrand(40,127)`)                // inline -- evalue par le runtime du symbole
`sc: i = i + 1`                       // standalone -- execute au temps T
```

### Simultaneite `!` et synchronisation `<!`

```
Sa!dha!spotlight          // 3 runtimes au meme instant
<!sync1 Sa Re Ga          // attend un signal externe avant de jouer
```

### Acteur -- unite de binding

Un acteur lie **six cles d'entite** (decision *cles-acteur-six*, Romain 2026-06-16) : `alphabet`
(requis), `tuning`, `octaves`, `sound`, `transport` (requis), `eval` — references via `.`.
`octaves` = convention de registre/notation, **defaut herite de l'alphabet**, surchargeable par
acteur (`@actor X octaves.Y`) ; etape de resolution distincte, rattachee a l'alphabet (pas au tuning).
Le marqueur de registre se **colle** au nom de note via le separateur de la convention (`lib/octaves.json`),
**jamais un espace** (l'espace est le delimiteur de termes BPScript : il scinderait le terminal). Les
conventions a **prefixe** (saptak indien, turkish, gamelan, shakuhachi, korean) utilisent `_` : la
musique indienne s'ecrit `mandra_sa` / `madhya_sa` (defaut, ou `sa` nu) / `taar_sa` — un seul terminal,
le registre resolu en aval par Kairos (TAAR-TOK, decision 2026-06-30).
Exemple :
```
@actor sitar1
  alphabet.sargam
  tuning.sargam_22shruti
  transport.webaudio
@actor sitar2
  alphabet.sargam
  tuning.sargam_12TET
  transport.midi(ch:3)
@actor tabla
  alphabet.tabla_bols
  transport.midi(ch:10)
```

Dans les regles, la dot notation `actor.terminal` qualifie un terminal par son acteur :
```
S -> sitar1.Sa sitar2.Sa tabla.tin    // acteur explicite
S -> Sa Re tin                         // resolution implicite si non ambigu
```

### Scenes -- hierarchie et communication

Une scene peut referencer d'autres scenes comme terminaux :
```
@scene verse "verse.bps"
@scene chorus "chorus.bps"

S -> { verse, chorus }         // polymetrie de scenes
[mood==dark] S -> verse        // conditionnel
```

Les flags du parent sont visibles en lecture par les enfants (heritage top-down).
Les enfants exposent explicitement les flags qu'ils veulent rendre visibles :
```
@expose [intensity]            // rend ce flag lisible par le parent
```

Le mapping `@map` connecte des I/O externes (CC, OSC) aux primitives du langage :
```
@map cc:1 -> [intensity]       // CC input -> flag
@map cc:64 -> <!sustain        // CC input -> trigger
@map [phase] -> cc:20          // flag -> CC output
@map osc:/sc/ready -> <!ready  // OSC input -> trigger
@map cc:60 -> sys.play         // CC -> commande transport
@map cc:1 <-> [mod_depth]      // bidirectionnel
```

Cf. [SCENES.md](../design/SCENES.md) pour le modele complet (scoping, sys, encapsulation).

### Duree explicite

```
@duration:16b                  // cette scene dure 16 beats (au tempo @mm courant)
@duration:8s                   // cette scene dure 8 secondes
```

`@duration` separe trois preoccupations :
- **Densite** = le contenu (combien de tokens, quelles proportions)
- **Duree** = @duration (combien de beats/secondes cette scene occupe)
- **Vitesse** = @mm (la clock, partagee avec le monde exterieur)

Sans `@duration` : comportement implicite (duree = nombre de tokens × tempo).
Avec `@duration` : scaling uniforme, proportions internes preservees.

`@duration` ne s'applique qu'au **conteneur racine**. Quand une scene est
imbiquee dans un parent via `@scene`, son `@duration` est ignore — le parent
decide de l'enveloppe. Le `@duration` de l'enfant est effectif uniquement
quand il est joue seul.

### CC nommes

```
@cc breath:2                   // declare CC2 comme "breath"
@cc expression:11              // declare CC11 comme "expression"
Sa(breath:80)                  // utilisable par nom dans les qualifiers
Sa(cc:74,80)                   // CC generique par numero
```

### Sounds system -- cascading

Les parametres se combinent par priorite : **spec** (defauts librairie) < **CT** (controles inline `()`) < **CV** (objets temporels continus).

> Modele v0.8 : la cascade complete a 8 niveaux est decrite dans la section
> [Sons et cascade d'heritage (v0.8)](#sons-et-cascade-dheritage-v08).
> Le territoire `@sound` est purement declaratif ; les affectations vivent
> dans les territoires d'origine (`@alphabet.X`, `@actor X`, ou inline).
> La directive `@actor` utilise desormais `.` pour les references d'entites
> (les 6 cles : `alphabet.X`, `tuning.X`, `octaves.X`, `sound.X`, `transport.X`, `eval.X`) -- cf.
> `docs/design/v0.8-decisions-final.md`.

---

## Philosophie de separation

BPScript ne fait qu'une chose : **ordonner des symboles types dans le temps.**

- Logique algorithmique -> backticks (dans le langage du runtime cible)
- Traitement de signal -> runtime (SuperCollider, Csound, Web Audio)
- Sound design -> runtime (SynthDefs, instruments)
- Routage -> fichier de routage (JSON)
- Temperament et accordage -> fichier de tuning (JSON)

Comme HTML ne contient pas de boucles et CSS ne contient pas de fonctions.
Chaque couche fait ce qu'elle sait faire. BPScript sait faire le temps.

---

## Le meta-ordonnanceur

L'idee centrale : BP3 sait **quand**. SC, Tidal, Python savent **quoi**.
Les backticks connectent les deux dans un seul fichier.

```
// Initialisation -- chaque runtime prepare ses objets
`sc: SynthDef(\grain, { |freq, dens| GrainSin.ar(dens, freq) }).add`
`tidal: let pat = s "bd sd hh sd"`
`py: import dmx; d = dmx.open()`

// Structure temporelle -- BP3 orchestre tout
[phase==1] S -> { intro, rythme }
[phase==2] S -> { melodie, rythme, lumieres }
```

Un fichier. Trois langages. Un seul ordonnanceur. Live-codable.

Le meta-ordonnanceur est agnostique de la cible :
- **Audio** : SuperCollider, Csound, Web Audio
- **Patterns** : TidalCycles (via SuperDirt)
- **Lumieres** : DMX via Python/OSC
- **Video** : Processing, TouchDesigner via OSC
- **Eurorack** : gate/trigger/CV via OSC, MIDI
- **Graphiques** : Canvas, WebGL, SVG via JavaScript
- **Installations** : capteurs, actionneurs, IoT
- **Tout ce qui a besoin d'etre orchestre dans le temps**

---

## Inventaire : 3 mots, 24 symboles, 9 operateurs

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
@              declaration (header) + application (suffixe RHS : C4@kick)
-> <- <>       derivation + direction (BP3 : --> <-- <->)
{ , }          polymetrie, groupement temporel, etat interne de definition
( )            parametre runtime (portees : symbole, regle, groupe), definition, appel, contexte
:              affectation/binding (gate Sa:sc, *:sound.bell, cc:2)
=              definition (@macro kick = ..., flags)
.              reference a une entite (alphabet.western, sound.bell, transport.midi) + sous-partie (actor.terminal) + period notation (A B . C D)
[ ]            qualificateur local (sur un groupe ou une regle)
` `            code externe opaque (echappement vers le runtime)
//             commentaire
-              silence (occupe du temps, absence d'evenement)
_              prolongation (etend l'evenement precedent)
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

Trois separateurs fondamentaux :
- **espace** = separe le mot-cle du contenu dans les declarations
- **`.`** = navigation dans une structure (sous-partie)
- **`:`** = affectation/binding (lie une chose a une autre)

Les symboles temporels (`-`, `_`, `.`, `...`) sont des symboles du langage,
pas du vocabulaire de librairie -- le compilateur connait leur semantique.

Pas d'ambiguite entre `.` et `...` : ce sont des caracteres differents de `-`.
- `.` = toujours isole (separateur entre fragments)
- `...` = toujours 3 caracteres colles (repos indetermine)
- `-` = silence, `- - -` = trois silences (tokens separes par des espaces)

### Neuf operateurs de flags

Les operateurs de flags se repartissent en deux groupes : comparaison (tests, dans une `[guard]` avant le LHS) et calcul (mutations, dans `[...]` dans le RHS).

Comparaison (6) :

```
==             test d'egalite
!=             test d'inegalite
>              test superieur
<              test inferieur
>=             test superieur ou egal
<=             test inferieur ou egal
```

Calcul (3) :

```
+              increment        [flag+1]
-              decrement        [flag-1]
=              assignation      [flag=valeur]
```

Soit neuf operateurs en tout. Le decrement `-` et l'assignation `=` reutilisent un glyphe employe ailleurs (`-` pour le silence, `=` pour la definition de macro), mais ce sont des operateurs distincts : l'inventaire des glyphes (les 24 symboles) et celui des operateurs sont independants. Tous n'ont de sens que dans le contexte des flags.

### Trois portees de metadonnees

- `@` = **global** : environnement, imports, configuration du systeme
- `[]` = **local moteur** : instructions BP3 -- modes, flags, operateurs temporels
- `()` = **local runtime** : parametres transportes au runtime cible (vel, filter, wave...)

Les nombres (`0.7`, `120`, `5ms`) sont des symboles opaques comme les autres --
le langage ne connait pas leur semantique, c'est le recepteur qui les interprete.

**Pas de `for`, pas de `while`, pas de branchement.** BPScript decrit des structures
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

## Parametres -- opaques pour BPScript

BPScript ne comprend pas les parametres. Il les **transporte** vers le runtime,
qui sait quoi en faire.

```
// SC definit les parametres dans un SynthDef
`sc: SynthDef(\sitar, { |freq, vel=80| ... }).add`

// BPScript declare le contrat temporel
gate Sa:sc

// Les parametres sont transportes tels quels vers SC
Sa(vel:120)                      // litteral -> SC recoit vel=120
Sa(vel:`rrand(40,127)`)          // backtick -> SC evalue rrand(40,127)
```

C'est un **gradient de complexite** -- un seul mecanisme, une seule plomberie :

```
// Niveau 1 : litteral -- BPScript transporte
Sa(vel:120)

// Niveau 2 : backtick -- le runtime du symbole evalue
Sa(vel:`rrand(40,127)`)

// Niveau 3 : backtick orphelin -- tag obligatoire
`sc: SynthDef(\grain, { |freq| ... }).add`
```

BPScript ne sait pas ce que `vel` veut dire. `120` est un litteral transporte,
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
X X -> abca [weight:inf]        // poids infini (priorite absolue)

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
weight             poids de la regle (entier, K-param, ou inf pour priorite absolue)
on_fail            gestion d'echec (skip, retry(N), fallback(X))
tempo              tempo local ou global (@tempo:120)
meter              signature rythmique (@meter:7/8, @meter:4/4)
scale              gamme microtonale
```

Toute cle non reservee dans `[]` est une erreur de compilation. Pour les parametres
destines au runtime (vel, filter, wave...), utiliser `()` a la place.

### Compilation de `[]` vers BP3

```
// BPScript                              -> BP3
A[/2] B C                                -> /2 A B C
[mode:random] S -> A B C                 -> RND  gram#N[M] S --> A B C
{C3, E3, G3, C4}:2                      -> {2, C3, E3, G3, C4}   // durée collée
```

### `()` -- parametres runtime (toujours suffixe)

Les parametres `()` sont des donnees transportees vers le **runtime cible** (Web Audio,
SuperCollider, MIDI externe, OSC, DMX...). BPScript ne les interprete pas -- il les
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

**Superposition (modulations continues, ex. filtres).** Quand plusieurs portees touchent le **meme
parametre** d'une meme note (filtre de note + filtre de groupe + groupe parent...), les controles
**s'EMPILENT en serie** -- ils ne s'ecrasent pas. L'ordre est **interieur->exterieur**, derive de
l'**imbrication structurelle** : dans `{ C4(filter:500) D4 }(filter:300)`, le son de C4 traverse son
filtre de note *puis* le filtre du groupe. Cette superposition est une **semantique de resolution
aval** (BPx/Kairos/runtime), pas une syntaxe : le langage l'exprime deja par le `subject` du
qualificateur et le nesting des groupes. (A distinguer des **scalaires** comme `vel`/`chan`, qui eux
s'**effondrent** par precedence -- une seule valeur gagne. Decision 2026-06-30 superposition-series.)

**Etendue d'arc et rearmement d'enveloppe (`cutoff:env`).** *(Comportement transverse complet :
`atlas/architecture/MODULATIONS.md` ; ici = la SYNTAXE + le guide d'ecriture de scene.)* Quand une
enveloppe module un parametre (ex. `cutoff:env`), **un silence `-` re-arme l'enveloppe** (re-declenche
son attaque) -- SAUF si une accolade `{ ... }` **enjambe** ce silence. L'accolade definit l'etendue d'**un seul arc continu**.
Deux formes, deux comportements (**aucune syntaxe nouvelle** : c'est la presence/etendue de l'accolade
qui choisit) :

```
// Forme REGLE nue -> le silence ARTICULE : re-arme a chaque -, phrases DETACHEES
Bass -> C2 - C2 (cutoff:env)      // deux arcs : l'enveloppe repart apres le -

// Forme ACCOLADES -> UN arc continu : le - interne est FRANCHI (legato / liaison)
Bass -> { C2 - C2 }(cutoff:env)   // un seul swell couvre C2, le silence, C2

// La BOUCLE est transparente : un tour ne re-arme QUE s'il y a un silence a la couture,
// ou si le tour tombe HORS de l'accolade. "Long build sur N tours" = une accolade qui
// couvre la reprise -- toujours pas de syntaxe nouvelle :
S -> { Bass Bass Bass Bass }(cutoff:env)   // un seul arc etale sur les 4 tours
```

Il n'y a donc que **deux** comportements ; le « drone / flux continu » n'est **pas** un 3e mode, c'est
`{}` sur une grande etendue. Cote formalisme : l'accolade doit apparaitre dans l'AST comme **un** noeud
conteneur **unique** portant le qualificateur a la portee `group`, dont l'etendue **survit** a
l'expansion polymetrique (fenetre du bus calculee par-bloc en aval : BPx la produit, Kairos la porte
opaque, le runtime la realise). Decision 2026-07-01 rearmement-enveloppes.

Les `()` runtime sont compiles en `_script(CT n)` -- des controles opaques que BP3
transmet sans interpreter. Le transpileur maintient une table de mapping :

```
// BPScript                              -> BP3
Sa(vel:120)                              -> _script(CT 0) Sa
{A B}(filter:lp)                         -> {_script(CT 2_start) A B _script(CT 2_end)}

// Table de mapping (cote JS) :
// CT 0 -> { scope: 'symbol', params: { vel: 120 } }
// CT 2_start/end -> { scope: 'group', params: { filter: 'lp' } }
```

### Valeur brute (modele CSS)

Pour `[]` et `()`, tout ce qui suit le `:` jusqu'au prochain `,` ou delimiteur
est la valeur brute. Le destinataire (moteur ou runtime) l'interprete -- BPScript
ne parse pas.

### Exception -- controles autonomes (resolution pure)

Quand un non-terminal se resout **entierement** en controles runtime
(pas d'element temporel), les controles peuvent apparaitre comme elements
RHS autonomes :

```
Pull0 -> (pitchbend:0)                                    // -> _script(CT n)
StartPull -> (pitchcont) (pitchrange:500) (pitchbend:0)    // -> _script(CT 0) _script(CT 1) _script(CT 2)
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

### Destinataire d'une paire `[sujet:]controle:valeur`

Par defaut, le `()` d'une regle vaut pour **la regle comme unite**. Une paire peut porter un
**sujet** explicite (devant le controle) pour cibler **plus finement** -- meme mecanisme que
l'affectation `*:sound.bell` (le `:` introduit deja un sujet dans le langage).

| Ecriture | Sujet | Cible |
| -------- | ----- | ----- |
| `(cutoff:Env)` | omis | **la regle elle-meme** (l'unite) |
| `(*:cutoff:Env)` | `*` | **chaque terminal** de la regle |
| `(C2:cutoff:Env)` | `C2` | les terminaux **C2** de la regle |

- `*` = « tous les terminaux » (sens qu'il a deja dans `*:sound.X`). `?` n'est PAS utilisable
  (il signifie « capturer un symbole inconnu » dans les gabarits).
- Le sujet est **par paire** : `(*:cutoff:Env, wave:sawtooth, vel:100)` = `cutoff` sur chaque
  terminal, `wave`/`vel` sur la regle.
- Pour un **CV** (qui varie dans le temps), le sujet decide l'**horloge** : sans sujet = un signal
  sur la voix (l'unite) ; `*:` = enveloppe **relancee/tiree par note**. C'est le sujet -- pas la
  nature de la valeur -- qui tranche. Pour un controle **statique** (`wave`), unite et par-terminal
  donnent le meme effet : la distinction ne compte que pour le temporel.

> Cible **cross-portee** (`(S:cutoff:Env)`, `(alphabet.*:...)`, niveau scene/autre regle) :
> meme mecanisme, portees plus larges -- **acte mais non implemente** (extension a venir, cf.
> `docs/design/CV.md` et le backlog langage). Le sucre de **groupe** `*:(cutoff:Env)` (sujet sur
> tout le groupe) est en backlog eventuel (non requis aujourd'hui).

### Contenance `()` vs flux `!()` -- deux facons de gouverner les notes

Un controle non-temporel (vel, wave, filter...) gouverne plusieurs notes de **deux
manieres opposees**, selon qu'il est ecrit `()` ou `!()` :

| Operateur | Regime | Portee | Deborde ? | Origine |
| --------- | ------ | ------ | --------- | ------- |
| **`(...)` nu** -- contenance | structurel | **toute sa portee** (regle ou groupe), **y compris les notes ecrites avant lui** | **non** : s'arrete au bord de sa portee | **ajout BPScript** (Romain 2026-06-20) |
| **`!(...)`** -- flux | sequentiel | les notes qui **suivent** dans l'ordre joue | **oui** : continue vers l'avant, **traverse les bords** de regle, jusqu'au prochain controle | **iso-BP3** (evenement non-temporel) |

```
// CONTENANCE -- (...) nu : confine, gouverne meme ce qui precede
Bass -> C2 E2 G2 (wave:sawtooth)     // les TROIS notes en sawtooth ; ne sort pas de Bass
{C4 E4}(vel:80)                      // C4 et E4 a 80 ; confine au groupe

// FLUX -- !(...) : forward, deborde
S -> A B ;  A -> C4 !(vel:100) ;  B -> E4 E4
// -> C4=defaut, puis !(vel:100) coule en avant : les E4 de B sortent A 100 (deborde dans B)
```

Le flux est un **etat courant** qui persiste **de facon continue** (pas de remise a zero
par cycle ou par regle) : une note **echantillonne** la valeur en vigueur a son instant
d'attaque, comme un signal en escalier. Sa portee est **par voix** : un flux pose dans une
voix ne bave pas dans les voix paralleles.

#### Table de syntaxe -- `!` est surcharge, la regle d'espace tranche

| Ecriture | Sens |
| -------- | ---- |
| `(...)` *(sans `!`)* | **contenance** -- confinee a sa portee (concept neuf BPScript) |
| `C4!(...)` **colle** (pas d'espace avant `!`) | **flux CONJOINT, ancre a C4** -- voyage avec C4, repliquee si C4 l'est |
| `C4 !(...)` **espace** | **flux EVENEMENT SEPARE** (non conjoint) -- pose seul dans la sequence |
| `B3!C7` *(`!` entre symboles, sans parentheses)* | **SIMULTANE / accord** (conjoint NON-flux) -- operateur existant, rien a voir avec le flux |

`!` est **surcharge** : entre symboles (`B3!C7`) = simultaneite/accord ; suivi de `(...)` = flux.
La **regle d'espace** ne s'applique qu'a **`!(...)`** : **colle = ancre** au terminal precedent,
**espace = separe**. Un `!(...)` colle sans terminal avant lui (debut de regle ou de groupe, ex.
`{!(vel:80) ...}`) retombe en **separe** (pas d'ancre possible). Dans l'AST, le `!(...)` porte
`conjoint: true|false` ; seul le simultane `B3!C7` reste un `SimultaneousGroup` (inchange).

**Precedence** (du plus fort au plus faible) :
**override de note `Sa(vel:120)` > flux `!(...)` > contenance `(...)` > defauts de declaration.**

> Reference : `hub/decisions/2026-06-20-controles-non-temporels-portage-resolution.md`.
> Comportement BP3 du flux verifie sur l'oracle natif (preuve MIDI : `P->C4 _vel(100) E4`
> joue trois fois -> velocites `[64,100,100,100,100,100]` ; le 1er C4 reste au defaut =
> forward-only, et le flux deborde sur la regle suivante).

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
Le role 3 est propre a BPScript (declarations typees).

### Ratio de tempo sur un bloc polymetrique

En BP3, un ratio optionnel peut preceder les voix : `{2, C3, E3, G3, C4}`.
En BPScript, ce ratio s'exprime via la **durée** `:` COLLÉE sur le groupe -- plus lisible :

```
// BP3 : ratio en premiere position (implicite)
{2, C3, E3, G3, C4}

// BPScript : durée collée au groupe (meme resultat)
{C3, E3, G3, C4}:2

// Ratio fractionnaire
{mi fa sol}:2/3
```

Le compilateur traduit `{...}:N` -> `{N, ...}` pour BP3. La même durée s'écrit sur une note :
`A4:1/2` -> `{1/2, A4}`. (Remplace l'ancien `[speed:N]`, supprimé -- décision 2026-06-26.)

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
- **`!(controle)` standalone** : mutation de **flux** -- coule vers l'avant dans l'ordre
  joue, deborde au-dela de sa portee (iso-BP3). A distinguer du `(...)` nu (contenance,
  confine) -- cf. [Contenance `()` vs flux `!()`](#contenance---vs-flux---deux-facons-de-gouverner-les-notes).

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

En BPScript, `.` et `,` sont transmis tels quels a BP3 -- pas de traduction.

---

## Liaisons `~` -- tied sound-objects

`~` remplace le `&` de BP3 (reserve aux templates en BPScript).

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

### Silence et prolongation comme contextes

`-` (silence) et `_` (prolongation) sont des voisins comme les autres : ils
s'emploient en contexte, notamment en contexte NEGATIF, sans parentheses.

```
#- V1 <> #- -              // V1 seulement s'il n'est PAS precede d'un silence
#_ S -> C4                 // S seulement s'il n'est PAS precede d'une prolongation
```

Emploi reel : `test/grammars/dhati3/scene.bps:25`. La forme sans parentheses
`#<symbole>` porte sur UN seul voisin ; `#(X Y)` porte sur le groupe.

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

### Ancre de gabarit maitre : `$` nu en tete de LHS

Un `$` seul, sans nom, place devant le membre gauche, marque la regle entiere
comme gabarit maitre. Il ne capture pas un groupe nomme : il ancre.

```
$ S -> C4 D4               // AST : lhs = [TemplateAnchor{kind:"master"}, Symbol{S}]
```

C'est un noeud de l'arbre destine a BPx (`TemplateAnchor`), pas un raccourci
d'ecriture de `$X`. La chaine BP3 heritee ne connait pas d'ancre de LHS ; seule
la forme nommee `$X` / `&X` y a une traduction (`(=X)` / `(:X)`).

---

## Templates : regime catalogue (v0.8)

La section `@template` (singulier, ex-`@templates`) est un **catalogue** de
patterns structurels.

```bpscript
@alphabet.western

S -> C4 D4

@template
[1] /1 ???????
[2] /1 ?????????
[3] /1 ($0 ???)($1 )
```

Trois faits structurants :

1. **Singulier sans suffixe** -- la directive s'appelle `@template`, alignee
   avec `@actor`, `@sound`, `@alphabet`. La v0.7 utilisait `@templates`.
2. **Pas de variantes ni de bindings** -- aucun suffixe `.X` ou `:X` sur la
   section.
3. **Toujours en mode catalogue** -- la section est consommee par
   `[mode:tem]` pour l'analyse inverse (modus tollens). Sa presence active
   le regime catalogue ; son absence laisse BP3 generer ses templates a la
   volee.

Cote moteur, le regime catalogue correspond au regime B (catalogue
post-derivation) decrit dans `BPx/backlog/m8-port-plan.md:103-117`. La spec
externe ne charge aucun autre regime sur la section -- il est implicite.

---

## Sons et cascade d'heritage (v0.8)

Un son BPScript decrit a la fois son **timbre** (sample, synth) et son
**comportement temporel** (duree, alpha, cover/cont/trunc, pivot, periode).
Pas de directive `@synth` separee -- la separation se fait dans les champs
du prototype.

### Territoires : un seul role chacun

| Territoire | Role | Affectations a un sujet ? |
|---|---|---|
| `@sound` | declarer des prototypes (anonymes + nommes) | **non** |
| `@alphabet.X` | declarer un alphabet | **oui** -- `*:sound.Y`, `Sa:sound.Z` |
| `@actor X` | declarer un acteur | **oui** -- `*:sound.Y`, `Sa:sound.Z` |
| RHS d'une regle | flux temporel | **oui** -- inline `Sa(sound.Y)` |

Regle absolue : **une affectation se fait depuis le territoire d'origine du
sujet**, jamais depuis `@sound`. Cela garde `@sound` purement declaratif.

### Declarer des sons (`@sound`)

```bpscript
@sound
  { dur:500, alphaMin:80, alphaMax:120 }   // entree anonyme = defaut herite
  bell_short { sample:"bell.wav", dur:400 }
  bell_long  { sample:"bell.wav", dur:1200, coverEnd:true }
  drum_kick  { sample:"kick.wav", dur:200, breakTempo:true }
```

- Une entree **anonyme** (`{ ... }` sans nom) est un defaut de scene (niveau 2
  de la cascade). Plusieurs entrees anonymes fusionnent dans l'ordre source.
- Une entree **nommee** (`name { ... }`) est referencable ailleurs via
  `sound.name`.

Les ~33 proprietes d'un prototype son sont decrites dans
`BPx/backlog/m4-symbol-config-audit.md` (~33 props -- capacites booleennes,
bornes temporelles, duree, alpha, pivot, periode) et formalisees cote
consommateur dans `BPx/src/types/soundConfig.ts:194-251`
(`SoundConfigInput`). Les defauts moteur viennent de
`ResetPrototype` (`bp3-engine/source/BP3/SoundObjects3.c:43-117`).

Forme canonique des champs :

- modes en string (`'absolute' | 'relative'` ; `'irrelevant'` pour `periodMode`)
- `pivType` accepte string ou entier `1..7` (cf. `soundConfig.ts:76-86`)
- booleens nus = `true` (`{ breakTempo }` == `{ breakTempo:true }`)

### Charger une lib de sons

`@sound.LIBNAME` charge `lib/sounds/LIBNAME.json`. Format :

```json
{
  "defaults":   { "dur": 500, "alphaMin": 80 },
  "named":      { "bell_short": { "sample": "bell.wav", "dur": 400 },
                  "drum_kick":  { "sample": "kick.wav", "breakTempo": true } },
  "by_terminal":{ "Sa": "drum_kick",
                  "Re": { "sample": "re.wav" } }
}
```

- `defaults` -> defaut anonyme de scene (niveau 2).
- `named` -> sons nommes utilisables via `sound.NAME`.
- `by_terminal` -> affectations injectees dans l'alphabet associe (niveau 4).
  La valeur peut etre une reference nommee (string) ou un bloc inline.

S'aligne sur le pattern existant `lib/sounds/tabla_perc.json`.

### Affecter un son a un sujet

Depuis un alphabet :

```bpscript
@alphabet.tabla
  notes: Sa Re ga ma Pa dha ni
  *:sound.bell_short                       // niveau 3 : defaut alphabet
  Sa:sound.drum_kick                       // niveau 4 : Sa specifique
  Re:sound.bell_long                       // niveau 4
```

Depuis un acteur :

```bpscript
@actor sitar
  alphabet.tabla
  transport.midi(ch:10)
  *:sound.bell_short                       // niveau 5 : defaut acteur
  Sa:sound.drum_kick                       // niveau 6 : Sa pour cet acteur
```

Inline sur une occurrence dans une regle :

```bpscript
S -> Sa(sound.bell_short)                  // niveau 7 : override CT
```

### Cascade -- 8 niveaux

Du moins specifique au plus specifique. Le moteur resout les proprietes d'un
son joue par un acteur en fusionnant les niveaux **par propriete** (heritage
fin, a la CSS).

| # | Niveau | Source |
|---|---|---|
| 1 | Defaut moteur BP3 | constantes `ResetPrototype` (SoundObjects3.c:43-117) |
| 2 | Defaut anonyme de scene | `@sound { ... }` (entree sans nom) |
| 3 | Defaut alphabet | `@alphabet.X *:sound.NAME` |
| 4 | Defaut note dans alphabet | `@alphabet.X Y:sound.NAME` |
| 5 | Defaut acteur | `@actor X *:sound.NAME` (ou `sound.NAME` dans le bloc acteur) |
| 6 | Defaut note d'acteur | `@actor X Y:sound.NAME` |
| 7 | Inline sur occurrence | `Y(sound.NAME)` dans RHS |
| 8 | (Reserve) override CV runtime | future v0.9+ |

Chaque niveau peut soit pointer un son nomme (reference), soit donner un
bloc de proprietes anonyme qui s'ajoute a la cascade.

**Fusion par propriete** : pour chaque champ (`dur`, `alphaMin`, `sample`,
`breakTempo`, ...), le niveau le plus eleve qui le specifie gagne. Les
niveaux intermediaires qui ne specifient pas ce champ ne masquent pas les
niveaux inferieurs -- c'est exactement le modele CSS.

### Pattern `defaults / named / by_terminal`

Le triplet defaults+named+by_terminal du format lib externe se retrouve dans
la structure declarative :

| Lib externe | Equivalent BPScript |
|---|---|
| `defaults: { ... }` | une entree anonyme dans `@sound` |
| `named: { N: {...} }` | une entree nommee `N { ... }` dans `@sound` |
| `by_terminal: { Y: ref }` | une affectation `Y:sound.ref` dans `@alphabet.X` |

C'est la meme cascade, exprimee une fois en JSON externe, une fois en
syntaxe BPScript.

---

## Conventions de notation v0.8 (`.` / `:` / `*`)

### Tableau cristallise

| Symbole | Sens | Exemple |
|---|---|---|
| `.` | reference a un element dans un namespace | `sound.bell_short`, `alphabet.tabla`, `transport.midi` |
| `:` | affectation a un sujet | `Sa:sound.drum_kick`, `*:sound.bell_short` |
| `*` | sujet = defaut (wildcard) | `*:sound.bell_short` |
| `()` | parametres runtime (heritables) | `Sa(vel:80)`, `transport.midi(ch:10)` |
| `[]` | instructions moteur (non heritees) | `[mode:tem]`, `[*1/2]` |
| `@` | directive top-level | `@sound`, `@actor`, `@template`, `@alphabet` |

### Regle dominante

`.` = **pointer**, `:` = **lier**. Les deux ne se confondent jamais. Le `*`
en position de sujet d'une affectation n'entre pas en conflit avec `[*N]`
(entre crochets) ni avec l'homomorphisme futur `* (= X)` (cote droit d'une
regle) -- contextes parser disjoints.

### Harmonisation `@actor` -- migration v0.7 -> v0.8

v0.7 :
```
@actor sitar alphabet:sargam tuning:sargam_22shruti transport:midi(ch:3, vel:100)
```

v0.8 :
```
@actor sitar
  alphabet.sargam
  tuning.sargam_22shruti
  transport.midi(ch:3, vel:100)
```

Raison : `sargam`, `sargam_22shruti`, `midi` sont des references a des
entites (libs / types de transport), pas des affectations. `.` est la
notation canonique de la reference. Convention uniforme dans tout le
langage.

### Separation des territoires (resume)

- **Declaratif** -- ce que l'on declare une fois et qui peut etre reutilise :
  `@sound`, `@alphabet.X`, `@actor X`, `@template`.
- **Affectations** -- ce qui lie un sujet a un comportement :
  `*:sound.X`, `Y:sound.X`. Toujours **depuis le territoire d'origine du
  sujet**, jamais depuis `@sound`.

Cette separation evite l'erreur classique « ou est-ce que j'ai mis l'affectation
de Sa ? » -- la reponse est toujours « dans l'alphabet ou l'acteur ou Sa est
declare, ou inline sur la note ».

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

### `[]` -- mutation d'etat en fin de regle

```
S -> A B [count-1]                        // mutation en fin de regle : count-1
S -> A B [phase=1] [count=2]              // plusieurs mutations en fin de regle
```

Une mutation s'ecrit en suffixe, **en fin de regle**. Elle est **hors-temps** : appliquee
au declenchement de la regle (pendant la derivation), pas a un point de la sequence
jouee -- sa position ne porte aucun sens temporel. En BP3, elle devient un marqueur
`/.../` place en fin de regle :

```
// BPScript                  -> BP3
S -> A B [count-1]           -> S --> A B /count-1/
S -> A B [phase=1] [count=2] -> S --> A B /phase=1/ /count=2/
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
jor -> {Sa Re Ga Pa}:2 [phase=3]
jhala -> {Sa Re Ga Pa Dha Ni Sa}:4
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

### Macros, labels, alias — noms et transformations

Trois directives pour nommer des choses. La difference est fonctionnelle :

| Directive | Ce qu'elle fait | Exemple |
|-----------|----------------|---------|
| `@macro` | Transformation nommee | `@macro kick = (vel:120)` |
| `@label` | Nom structural pur | `@label groove` |
| `@alias` | Nom pour un canal I/O | `@alias breath = cc:2` |

```
@macro kick = (vel:120)              // preset de controles
@macro accent(x) = x(vel:120)       // transformation parametree
@macro fast(x) = {x}:2              // transformation structurelle (durée collée)
@alias breath = cc:2                 // canal MIDI nomme
@alias intensity = osc:/sensor/1     // canal OSC nomme
@label hat                           // nom structural pur
@label groove                        // nom de groupe polymetrique
```

Application dans le RHS via `@` suffixe — colle a l'element, sans espace :

```
S -> C4@kick D4@hat E4@accent F4
S -> {melody, drums}@groove
```

`C4@kick` = "C4, avec kick applique". Le `@` en suffixe passe implicitement
l'element precedent comme argument (pour les macros parametrees).

Les noms sont utilisables dans les `@map` pour le controle externe :

```
@map cc:1 -> kick.ratio             // controle le ratio de tous les @kick
@map breath -> groove.ratio          // l'alias breath controle le groupe groove
@map cc:2 -> kick.vel                // controle le vel des @kick
```

Plusieurs elements peuvent partager le meme nom (multicast) :

```
S -> C4@kick D4 E4@kick F4          // cc:1 modifie les 2 kicks en meme temps
```

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

### Librairies de FONCTIONS digitales (evolution 2026-06-30)

Au-dela des librairies de **donnees** (alphabets, octaves, temperaments, controles, objets CV...),
une famille porte du **comportement** : les **fonctions de manipulation digitale** (transpose et
scaleshift — les deux transpositions, voir plus bas ; puis octave/registre, gamme, keyxpand...).
Une fonction = une entree `{params, body}` ou le `body` est
du **vrai code TS** type (authoring F1), vivant dans une lib `{type:'digital', objects}` (3 provenances :
fournie / perso / communautaire). C'est le **jumeau** des objets CV : meme idee (comportement nomme en
librairie), realise par un moteur different — **Kairos** (code discret, a la resolution) pour le digital,
le **runtime audio** (courbe declarative) pour l'analogique/CV.

L'hote fournit la lib ; **Kairos** la transpile au chargement et l'**applique** (le nom de fonction est
porte opaque jusqu'a lui ; il opere sur une **COPIE**, jamais l'arbre reel). BPScript pose la **forme**
de lib et le **typage a l'ecriture**, il ne resout/n'execute rien. Spec complete :
`docs/design/DIGITAL_FUNCTIONS.md` ; decision `hub/decisions/2026-06-30-frontiere-digital-analog-invariant-copie.md`.

### Les deux transpositions : reelle (`transpose`) et scalaire (`scaleshift`)

BPScript distingue les **deux** gestes de transposition musicologiques (decision 2026-07-11) :

- **`transpose` — transposition REELLE (chromatique)** : decale l'**ancre** de l'alphabet par un
  **intervalle fixe**. Preserve tous les intervalles ET le nom de chaque note ; fonctionne dans
  **tout** accordage (egal, inegal, parametrique). L'argument est un **intervalle** dans l'un des
  3 formats des temperaments : **fraction** `3/2`, **cents** `700c`, **decimal** `1.5` (un entier nu
  = ratio, `2` = octave). Ecriture **nue**, sans guillemets, comme toute valeur de controle :
  `(transpose:700c)`, `@transpose:-2400c`, `transpose(3/2)`. Une valeur **numerique** (ex.
  `transpose:2` compris comme un nombre de pas) n'existe plus : l'ancien regime par pas de grille est
  **supprime** (il n'etait une vraie transposition qu'en temperament egal).
- **`scaleshift` — transposition SCALAIRE (diatonique)** : decale de **N degres** d'alphabet
  (`scaleshift:2` : Sa -> Ga). Preserve les degres, pas les intervalles (en gamme inegale). Argument
  = entier N. S'appelait autrefois `rotate` (de hauteur) ; renomme pour lever l'homonymie avec le
  `![rotate]` de **structure** (rotation de sequence, moteur BPx), qui est une autre operation et
  garde son nom.

Resolution : Kairos normalise la chaine d'intervalle et applique la transposition reelle en fin de
chaine (facteur multiplicatif de cadre), apres les operations de grille — noms et registres preserves.

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

| BPScript       | Compile en BP3                        | Semantique                               |
| -------------- | ------------------------------------- | ---------------------------------------- |
| `A[/2]`        | `/2 A`                                | absolu + persistant (fixtempo), speed=2  |
| `A[*3]`        | `_tempo(1/3) A _tempo(1/1)`           | relatif, bracket enter/exit, scale×3     |
| `![/2]`        | `_tempo(2/1)`                         | relatif, flux (InstantControl)           |
| `A[\2]`        | non tokenise (EBNF exclut `\`)        | anomalie natif+WASM, voir TEMPO_OPS_WASM |

Portee flexible : sur un symbole, un groupe, ou un polymetric.

---

## Metrique -- `@meter`

BPScript supporte la signature rythmique via la directive `@meter`.

```
@meter:4/4                       // mesure a 4 temps
@meter:7/8                       // mesure a 7 croches
@tempo:120                       // 120 BPM
```

**Distinction tempo vs metronome :**
- `[tempo:2]` = multiplicateur relatif (double la vitesse courante)
- `@tempo:120` = marquage metronomique absolu (120 BPM)
- `@striated` / `@smooth` = bascule entre temps strie et temps lisse

---

## Modes, scan et directions -- trois niveaux distincts

| Niveau             | Question                             | BPScript         | Portee              |
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

BPScript unifie les deux dans la meme syntaxe via le systeme de types :

```
// Imperatif (comme _tempo) -- palier discret
{A B C}:2

// Fonctionnel (comme smooth time) -- propriete continue, CV sur le cadre
{A B C}:ramp(1, 3)
```

Le type `cv` est la **modernisation du smooth time de Boulez/Bel**.

| BPScript              | BP3                           | Concept                 |
| --------------------- | ----------------------------- | ----------------------- |
| **gate**              | sound-object (avec duree)     | evenement dans le temps |
| **trigger** (via `!`) | out-time object (duree nulle) | impulsion instantanee   |
| **cv**                | time pattern (smooth time)    | duree comme propriete   |

---

## Compilation vers BP3

BPScript compile vers le format de grammaire BP3 (`-gr.`). Cette section decrit
comment les constructions BPScript se traduisent en instructions BP3.

> Voir [INTERFACES_BP3.md](../design/INTERFACES_BP3.md) pour l'interface WASM complete.

### Format de grammaire BP3

Structure du fichier :
```
MODE                           // ORD, RND, SUB1, LIN, TEM, POSLONG
gram#N[M] LHS --> RHS          // regles
-----                          // separateur de sous-grammaire
MODE
gram#N[M] LHS --> RHS
```

### Sous-grammaires et modes

Chaque bloc entre `-----` est une sous-grammaire avec son propre mode de derivation.

| Mode BPScript      | BP3     | Comportement                              |
| ------------------- | ------- | ----------------------------------------- |
| `[mode:ord]`        | `ORD`   | ordonne -- les regles s'appliquent en ordre |
| `[mode:random]`     | `RND`   | aleatoire parmi les regles applicables    |
| `[mode:sub1]`       | `SUB1`  | substitution (une seule application)      |
| `[mode:lin]`        | `LIN`   | lineaire                                  |
| `[mode:tem]`        | `TEM`   | template matching                         |
| `[mode:poslong]`    | `POSLONG` | position la plus longue                 |

Le compilateur regroupe les regles par non-terminal et mode, inserant `-----`
entre les blocs de modes differents.

### Directions

| BPScript | BP3     | Sens                     |
| -------- | ------- | ------------------------ |
| `->`     | `-->`   | production (gauche droite) |
| `<-`     | `<--`   | analyse (droite gauche)  |
| `<>`     | `<->`   | bidirectionnel           |

### Symboles terminaux -- alphabet plat

BP3 recoit des **noms opaques** prefixes `bol`. Il ne sait rien des frequences,
des acteurs, des transports.

```
Source BPScript :
  Sa Re Ga Pa

Alphabet plat :
  bolSa
  bolRe
  bolGa
  bolPa

Grammaire BP3 :
  gram#1[1] S --> bolSa bolRe bolGa bolPa
```

Les noms de notes standard (`C4`, `sa`, `re`) deviennent des silent sound objects
dans BP3 -- pas de NoteConvention, pas de MIDI.

### Polymetrie

Transmise telle quelle a BP3 :

```
// BPScript
S -> { melodie, rythme }

// BP3
gram#1[1] S --> {melodie, rythme}
```

### Durée sur un groupe

La durée `:N` collée est traduite en cadre polymétrique BP3 :

```
// BPScript
{C3, E3, G3, C4}:2

// BP3
{2, bolC3, bolE3, bolG3, bolC4}
```

### Durée de portée règle

Détachée du dernier élément et posée en fin de règle, la durée porte sur **tout le membre
droit** — elle n'est pas un suffixe du terminal qui la précède :

```
// BPScript
S -> C4 D4 E4 :2

// BP3
{2,C4 D4 E4}
```

Trois portées distinctes, à ne pas confondre :

| Écriture            | Portée                    |
| ------------------- | ------------------------- |
| `A4:1/2`            | la note seule             |
| `{A B}:2`           | le groupe                 |
| `S -> A B C :2`     | le membre droit entier    |

La durée n'existe **pas** en ligne au milieu d'un flux : `S -> A :2 B` est refusée.

### Operateurs temporels

Deux semantiques distinctes selon l'operateur :

```
// BPScript                  -> BP3             Semantique
A[/2] B C                    -> /2 bolA bolB bolC    absolu, persistant (fixtempo)
{A B C}[/3]                  -> /3 {bolA bolB bolC}  idem, portee groupe
A[*2] B C                    -> _tempo(1/2) bolA _tempo(1/1) bolB bolC  relatif, bracket
![/2]                        -> _tempo(2/1)           relatif, flux (InstantControl)
```

`[/N]` = vitesse ABSOLUE N + fixtempo (BP3 Encode.c). Persiste jusqu'au prochain operateur
tempo ou fin de champ (reinitialise au separateur `,` des sous-champs polymetriques).
`[*N]` = relatif a la vitesse heritee. Exit `_tempo(1/1)` restaure l'herite au bord du bracket.
`![/N]` dans le flux (InstantControl) = `_tempo(N/1)` relatif, sans fixtempo.
`[\N]` n'est pas tokenise par BPScript (anomalies natif+WASM, voir TEMPO_OPS_WASM.md).

### Guards et flags

```
// BPScript                              -> BP3
[phase==1] S -> Sa Re Ga Pa             -> /phase=1/ gram#N[M] S --> bolSa bolRe bolGa bolPa
[Ideas-1] I -> R1 A R2                  -> /Ideas-1/ gram#N[M] I --> R1 A R2
S -> A B [count+1] C                    -> gram#N[M] S --> bolA bolB /count+1/ bolC
[phase==1] S -> Ga [phase=2] Re         -> /phase=1/ gram#N[M] S --> bolGa /phase=2/ bolRe
```

### Poids

```
// BPScript                              -> BP3
S -> A B C [weight:50]                   -> <50> gram#N[M] S --> bolA bolB bolC
```

### Controles runtime `()` -- _script(CT n)

Les parametres runtime sont compiles en tokens de controle opaques :

```
// BPScript                              -> BP3
Sa(vel:120)                              -> _script(CT 0) bolSa
Bass -> C2 C2 - C2 (vel:100)            -> gram#N[M] Bass --> _script(CT 1) bolC2 bolC2 - bolC2
{A B}(filter:lp)                         -> {_script(CT 2_start) bolA bolB _script(CT 2_end)}
```

Le transpileur emet une **controlTable** a cote de la grammaire :
```json
{
  "CT0": { "scope": "symbol", "params": { "vel": 120 } },
  "CT1": { "scope": "rule", "params": { "vel": 100 } },
  "CT2": { "scope": "group", "params": { "filter": "lp" } }
}
```

### Cascading des controles (spec < CT < CV)

Quand plusieurs sources definissent le meme parametre, l'ordre de priorite est :

1. **spec** (defauts de la librairie) -- plus basse
2. **CT** (controles inline `()`) -- surcharge la spec
3. **CV** (objets temporels continus) -- plus haute priorite

Le dispatcher applique ce cascading a chaque timed token.

### Silences et prolongation

Transmis directement :
```
// BPScript    -> BP3
-              -> -
_              -> _
...            -> ... (repos indetermine)
```

### Period notation

Transmise directement :
```
// BPScript                    -> BP3
S -> A B . C D . E F           -> gram#N[M] S --> bolA bolB . bolC bolD . bolE bolF
```

### Ties (liaisons)

`~` en BPScript -> `&` en BP3 :
```
// BPScript                    -> BP3
C4~ D4 E4 ~C4                 -> bolC4& bolD4 bolE4 &bolC4
```

### Captures

`?n` -> metavariables BP3 :
```
// BPScript                    -> BP3
?1 A ?1 -> ?1 B ?1             -> ?1 A ?1 --> ?1 B ?1
```

### Templates et transcriptions (homomorphismes)

`$` -> `(=X)` et `&` -> `(:X)`. Les noms de transcription entre master et slave
sont emis entre `(=X)` et `(:X)` dans la grammaire BP3.

```
// BPScript                              -> BP3
S <> $mel &mel                           -> S <-> (=mel) (:mel)
S -> $X tabla_stroke &X                  -> S --> (=X) tabla_stroke (:X)
S -> $X * &X                             -> S --> (=X) * (:X)
S -> $X * TR &X                          -> S --> (=X) * TR (:X)
Qaida <> $ {plus S64 fin}               -> Qaida <-> (= plus S64 fin)
```

**Contrat BPx** : les paires source→cible sont portées dans `Scene.homomorphisms[]`
(tableau de `HomomorphismDeclAST`). BPx consomme ce tableau post-dérivation via
`rewriteHomomorphismMarkers` pour appliquer les transformations de terminaux.

> Voir [HOMOMORPHISMS.md](../design/HOMOMORPHISMS.md) pour l'architecture complète.
>
> **AJOURNÉ (2026-06-10)** : l'approche étiquetage `N@terminal` dans le fichier -ho.
> (où BP3 émet des étiquettes opaques et le REPL les résout post-dérivation) est ajournée.
> L'approche retenue est `Scene.homomorphisms` + marqueurs inline (`star`, noms verbatim).

### Contextes

```
// BPScript                    -> BP3
(A B) C -> D E                 -> (A B) C --> D E
#(X Y) Z -> W                 -> #(X Y) Z --> W
```

### Homomorphismes

```
// BPScript                    -> BP3
|x| S x -> x S                -> |x| S x --> x S
```

### Out-time objects

`!symbole` standalone -> `<<symbole>>` :
```
// BPScript                    -> BP3
Y -> !f                        -> Y --> <<f>>
```

### Backticks

Les backticks orphelins et standalone sont encodes comme terminaux speciaux
dans la grammaire. Les backticks-parametres sont resolus via la controlTable.

---

### Meta-grammaires -- reecriture structurelle

BP3 est un systeme de reecriture de chaines -- `{`, `}`, `,` peuvent apparaitre
comme terminaux bruts. Le parser les traite comme des `RawBrace` quand ils ne
forment pas un polymetric balance dans la meme regle.

```
// BPScript: koto3 -- automate cellulaire avec meta-reecriture
#({) a b a -> {a c b, f f f - f}:5  // contexte negatif sur {
} -> }                                      // { et } comme terminaux
, -> ,                                      // , aussi
```

Deux usages distincts :
- **Embedding** : `{` et `}` distribues sur plusieurs regles, forment un polymetric
  valide apres derivation. La durée `}:N` sur `}` est propagee au `{` correspondant.
- **Meta-grammaire** : `{`, `}`, `,` comme terminaux matchables sur le LHS et
  dans les contextes `#({)`. La grammaire construit des polymetriques par reecriture.

La validation structurelle des `{}` est **repoussee au moteur BP3**.

---

### Time signatures inline

```
// BPScript                              -> BP3
S <> S96 [meter:4+4/6]                  -> S <-> S96 4+4/6
S -> P1 P2 P3 [meter:4+4+4+4+4+4/4]    -> gram#N[M] S --> P1 P2 P3 4+4+4+4+4+4/4
```

---

### Extensions futures (necessitent modifications BP3)

#### Capture de groupes

Actuellement `?` capture exactement **un** symbole. Pas de mecanisme
pour capturer un **groupe** de symboles de longueur variable.

#### CV sur les parametres moteur (speed, scale, tempo)

Les parametres resolus par le moteur BP3 lui-meme ne supportent que des valeurs
discretes. Trois approches possibles :
1. Modifier le moteur BP3 pour supporter des durees variables
2. Discretiser au compilateur -- `ramp(1, 3)` -> serie de `/N`
3. Post-traiter -- deformer le timeline apres resolution BP3

#### Quoted symbols

BP3 supporte les quoted symbols (`'1'`, `'texte'`). BPScript **ne porte pas**
cette syntaxe. Les grammaires BP3 qui les utilisent sont renommees dans la
traduction (ex: `'1'` -> `d1`).

#### Conventions de notes

Le contournement actuel (flat alphabet + bol prefix + prototypes -so.) est
documente dans [DESIGN_PITCH.md](../design/PITCH.md).
L'architecture cible (alphabets parametriques, temperaments, tunings)
rend obsolete le NoteConvention hardcode de BP3.

---

## Documents lies

- [EBNF.md](EBNF.md) -- Grammaire formelle EBNF
- [AST.md](AST.md) -- Structure de l'AST
- [INTERFACES_BP3.md](../design/INTERFACES_BP3.md) -- Interface WASM complete (in/out)
- [ARCHITECTURE.md](../design/ARCHITECTURE.md) -- Architecture technique
- [DESIGN_CV.md](../design/CV.md) -- CV / signal objects
- [DESIGN_PITCH.md](../design/PITCH.md) -- Architecture 5 couches pitch
- [DESIGN_HOMOMORPHISM_LABELING.md](../design/HOMOMORPHISMS.md) -- Etiquetage homomorphismes
