# BPScript Language Specification

## Table des matieres

- [Principe fondamental](#principe-fondamental)
- [Le langage : dense, pas simple](#le-langage--dense-pas-simple)
- [Concepts cles](#concepts-cles)
- [La partie declarative](#la-partie-declarative)
- [L'ordonnanceur](#lordonnanceur)
- [Inventaire](#inventaire)
- [Systeme de types](#systeme-de-types----ce-quun-nom-est-comment-un-signal-se-lit)
- [Parametres](#parametres----opaques-pour-bpscript)
- [Les sacs : `()` reglages, `[]` derivation](#les-sacs---reglages--derivation)
- [Les parentheses `()`](#les-parentheses-----quatre-roles)
- [Les accolades `{}`](#les-accolades-----polymetrie-et-groupement)
- [L'operateur `!`](#loperateur-----simultaneite)
- [Les trois silences](#les-trois-silences)
- [Period notation `.`](#period-notation-----fragments-de-duree-egale)
- [Liaisons `~`](#liaisons-----tied-sound-objects)
- [Captures `?`](#captures-----pattern-matching)
- [Les barres `|x|`](#les-barres-x----delimiter-un-nom)
- [Contextes `()` et `#`](#contextes--et-----conditions-dapplication)
- [Les gabarits `$` et `&`](#les-gabarits--et-----la-structure-dune-production)
- [Heritage par cascade](#heritage-par-cascade)
- [Conventions de notation](#conventions-de-notation-—-lespace-le-point-le-deux-points)
- [Flags](#flags-—-variables-détat-et-composition-conditionnelle)
- [Déclarations](#déclarations)
- [Les librairies](#les-librairies)
- [Le temps](#le-temps)
- [Modes, scan et directions](#modes-scan-et-directions----trois-niveaux-distincts)
- [Gestion d'echec](#gestion-dechec----on_fail)
- [Le temps](#le-temps----formes-avancees)

---

## Principe fondamental

BPScript est un **ordonnanceur** : il derive des structures temporelles par grammaires
formelles et decide **quand** se declenchent des comportements ecrits dans d'autres langages
(SuperCollider, TidalCycles, Python).

Les symboles sont des noms avec un double contrat :
- **Convention de lecture** : comment le recepteur lit ce qu'ils portent (pitch, phase, logic)
- **Runtime** : qui les manipule (sc, tidal, python, midi...)

Le langage connait trois mots et fait une chose : ordonner dans le temps.

---

## Le langage : dense, pas simple

Le vocabulaire est petit et la combinatoire est riche. Comme les echecs : 6 types de pieces, complexite infinie.

```bpscript
@core
@alphabet.sargam

// Une sequence de notes
S -> sa re ga pa

// Polymetrie, simultaneite, silence, prolongation et garde de drapeau
[phase==1] S -> { sa!dha re!ni, - _ }

// Homomorphisme, contexte, gabarit, mutation de drapeau
|x| (A) x B -> x $mel &mel [phase+1]
```

Le langage est pense pour rester le plus lisible possible : `->` est une fleche, `!` une
impulsion, `...` un suspens. La difficulte se trouve dans la profondeur structurelle.

---

## Concepts cles

### L'heritage par cascade

Toute valeur du langage a une source par defaut et se surcharge en la nommant a un niveau plus
local. La regle vaut partout, pour les entites d'un acteur comme pour les parametres d'un
evenement : **le plus local l'emporte**. Nommer une valeur a un niveau la fixe pour ce niveau et
pour tout ce qu'il contient.

| Niveau    | Ce qu'il fixe                                    | Ecriture                                   |
| --------- | ------------------------------------------------ | ------------------------------------------ |
| global    | les défauts communs a toutes les scenes d'un son | `lib/core.json`                            |
| librairie | les defauts d'un alphabet, d'un tuning, d'un son | `lib/*.json`                               |
| scene     | ce dont heritent tous les acteurs                | `@alphabet.sargam`, `@time.tempo:90`       |
| acteur    | ce que cet acteur emploie                        | `@actor sitar1` + `tuning.sargam_22shruti` |
| regle     | ce qui vaut pour toute la production             | `S -> sa re (vel:70)`                      |
| terme     | ce qui vaut pour ce terme                        | `sa(vel:100)`                              |

```bpscript
@core
@alphabet.sargam

@actor sitar1
  tuning.sargam_22shruti

S -> sitar1.sa sitar1.re(vel:100) ga (vel:70)
```

Cas d'usage mesures dans cet exemple :
- `@alphabet.sargam` seul donne a la scene sa convention de registre (`saptak`), son temperament
  (`sargam_12TET`) et son canal de sortie (`audio`, fourni par `@core`).
- `sitar1` ne nomme que son temperament : il recoit l'alphabet de la scene et la convention de
  registre de l'alphabet, et emploie `sargam_22shruti` pour lui seul.
- `(vel:100)` colle a `re` vaut pour ce terme ; `(vel:70)` en fin de regle vaut pour la regle.

### L'espace, delimiteur de termes

L'espace separe deux termes du flux. Ce qui est **colle** a un terme appartient a ce terme et le
gouverne ; ce qui en est **separe par un espace** est un terme, ou une portee, a part.

Les operateurs qui **relient** deux termes se lisent de la meme facon avec ou sans espace autour :
la fleche `->`, la simultaneite `!`, le cablage `>>` et sa coupure `\>>`, le point d'attente `<!`.
`S->sa!re` et `S -> sa ! re` donnent le meme arbre.

Les signes qui **qualifient** un terme se collent a lui : le point `.`, le deux-points `:`, les
parentheses `()`, les crochets `[]`. Separes par un espace, ils changent de portee, ou la ligne est
refusee.

| Ecriture               | Portee                                                                       |
| ---------------------- | ---------------------------------------------------------------------------- |
| `sa(vel:100)`          | les parentheses collees portent le reglage sur `sa`                          |
| `S -> sa re (vel:70)`  | les parentheses separees, en fin de regle, portent sur toute la regle        |
| `pa:2`                 | le `:` colle fixe la duree du terme ; separe (`pa :2`), la ligne est refusee |
| `S -> A B :2`          | une duree detachee en fin de regle est refusee : elle se colle a son hote   |
| `{re ga}:2`            | le `:` colle fixe la duree du groupe                                         |
| `S -> sa re [phase=1]` | le crochet separe, en fin de regle, mute un drapeau                          |
| `sitar1.sa`            | le point colle qualifie `sa` par l'acteur `sitar1`                           |
| `sa . re`              | le point separe decoupe la sequence en fragments de duree egale              |
| `taar_sa`              | le separateur de registre colle le marqueur au nom de note                   |
| `sa!(vel:70)`          | le `!` colle ancre le reglage sur `sa` : il voyage avec lui                  |
| `sa !(vel:70)`         | le `!` separe pose le reglage seul dans la sequence                          |
| `<!depart`             | le point d'attente et le nom qu'il attend forment un seul terme              |

```bpscript
@core
@alphabet.sargam

@actor sitar1
  tuning.sargam_22shruti

S -> T U sitar1.sa(vel:100) taar_sa {re ga}:2 pa:2
T -> sa re (vel:70)
U -> sa!(vel:70) re !(vel:100) ga . dha <!depart ni [phase=1]
```

Le sens de chaque signe accole -- le point, le deux-points, l'etoile -- est detaille dans
[Conventions de notation](#conventions-de-notation-----).

### Backticks -- code natif dans le flux

Un backtick porte du code, et **le tag en tete est une adresse** : il nomme le langage, et le
langage nomme son interprete -- exactement comme le domaine d'une cle. Les langages externes
(`sc:`, `py:`, `tidal:`, `strudel:`, `hydra:`...) vont a runtime-codevoices ; **`patch:` va a
Dedale**, parce que le cablage est son metier.

**Chaque langage se declare en librairie** -- voir « Le prototype d'un langage backtique ». C'est la
qu'il dit s'il sonne et s'il occupe du temps, au lieu de le laisser deviner ; une occurrence
surcharge ces defauts avec un sac.

Il prend deux formes :

- **autonome** -- le backtick occupe une position a lui seul et joue son code quand la derivation
  l'atteint. En tete de scene, il prepare le moteur au chargement ; dans le flux d'une regle, il
  est un terminal de plein droit et joue a son instant. Son tag est requis, ou bien un acteur
  `eval.<moteur>` le qualifie par le point.
- **inline** -- le backtick occupe un parametre et rend une valeur, evaluee par le runtime du
  symbole qui le porte ; il herite du tag de ce symbole.

```bpscript
@core
@alphabet.sargam

// Autonome, en tete de scene : prepare le moteur au chargement
`sc: SynthDef(\grain, { |freq, dens| GrainSin.ar(dens, freq) }).add`

// Autonome dans le flux : joue son code a son instant, comme une note
// Inline dans un parametre : evalue par le runtime du symbole
S -> sa(vel:`rrand(40,127)`) `sc: i = i + 1` re
```

#### Le langage de patch

**`patch:` est le langage du cablage**, et Dedale l'interprete. Il s'ecrit dans une regle comme
tout backtick : **muet, et de duree nulle**.

```bpscript
S -> C4 `patch: saw1 >> lpf1` D4 `patch: lpf1 switchoff` E4
```

Il porte **tout ce qui touche a la gestion du patch** : brancher `>>`, couper `\>>`, neutraliser
`switchon` / `switchoff`, affecter une valeur a un port (`lpf1.cutoff:400`).

**Il manipule le patch ; les declarations vivent en tete de scene** -- creer une instance s'y ecrit,
comme toute declaration du langage.

**Un backtick est un terminal, et un terminal se pose dans une regle** : c'est a ce titre que le
cablage y entre. La derivation, elle, produit de la matiere -- `S -> saw1 >> lpf1` arrete la
compilation.

**Le meme langage sert dans un `@def`** : ce qu'on reinvoque se nomme, ce qu'on ecrit une fois
reste litteral. Un seul langage, deux emplacements.

### Simultaneite `!` et synchronisation `<!`

`!` marque l'instant : ce qu'il porte ne prend aucun pas dans la sequence. Il a deux emplois, et
c'est ce qui **suit** le `!` qui decide duquel il s'agit.

**Entre deux termes**, il les place au meme instant : `sitar1.sa!tin!na` produit trois evenements
sur une seule attaque, et le premier terme donne la duree du groupe.

**En tete d'un terme**, il pose dans le flux un element sans duree, qui prend effet a l'endroit ou
il est ecrit : un reglage de sortie `!(vel:80)`, un reglage moteur `!(retro)`, une re-semence
`!(seed:7)`, un cablage. La table complete des lectures du `!` est dans
[Table de syntaxe du `!`](#table-de-syntaxe-du-).

`<!` suspend le flux jusqu'a l'arrivee d'un signal exterieur. Le nom attendu se colle au signe.
Ecrit apres une note, il s'ancre sur elle : la note sonne, puis la suite attend.

```bpscript
@core
@actor sitar1
  alphabet.sargam
  transport.audio
@actor tabla1
  alphabet.tabla
  transport.midi(ch:10)

S -> !(vel:80) sitar1.sa!tin!na <!depart sitar1.re
```

`!(vel:80)` se pose seul, sans duree, et vaut a partir de la. `sitar1.sa!tin!na` produit **trois
evenements** au meme instant. `<!depart` retient la suite jusqu'a l'arrivee du signal `depart`.

## La partie declarative

Une scene commence par ce qu'elle declare, et se poursuit par ce qu'elle produit. La partie
declarative fait exister des choses ; les regles de production les font sonner dans le temps.

### Quatre mots

Le coeur declaratif tient en quatre mots. Tout le reste s'ecrit en invoquant une librairie ou une
categorie de reglages.

| mot      | ce qu'il fait                                                          |
| -------- | ---------------------------------------------------------------------- |
| `@actor` | declare **qui joue** : un acteur, son alphabet, sa sortie              |
| `@var`   | declare **une variable** : un nom qui porte une valeur ou un etat      |
| `@def`   | declare **une definition** : un nom associe a un corps qu'on reinvoque |
| `@init`  | declare **l'etat de depart** de la scene                               |

### `@var` -- declarer une variable

Une variable porte un **type** qui dit ce qu'elle est. **Le nom vient d'abord, le type ensuite** --
l'ordre de toute declaration, `@def` et `@actor` comme celle-ci.

```text
@var section flag: calm:1, full:2
@var touches in transport.keyboard
@var grain signal
@var hauteur pitch
@var rotation phase
@var porte logic
@var lpf1 lpf
@var pivot
```

| type          | ce que la variable porte                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `flag`        | un etat entier, avec ses valeurs nommees ; les regles s'y conditionnent                         |
| `in`          | une valeur qui vient du dehors : un **role**, son canal, sa table de correspondance             |
| `signal`      | un flux de nombres, sans convention de lecture — le cas ordinaire                               |
| `pitch`       | un signal lu comme une **hauteur**                                                              |
| `phase`       | un signal lu comme une **position dans un cycle**, entre 0 et 1 : ce qui depasse **s'enroule**  |
| `logic`       | un signal lu comme un **etat haut ou bas**, dont ce sont les **transitions** qui font evenement |
| un **module** | une **instance** de ce module -- `lpf1` de type `lpf` ; elle ne porte aucun corps propre        |
| *(aucun)*     | un symbole du flux qui n'est ni une note ni un nom de regle                                     |

**Le flag declare ses etats en meme temps que lui-meme.** `calm:1, full:2` nomme deux valeurs
entieres ; une regle s'y conditionne ensuite par son nom : `[section==calm]`.

**Le role d'une entree ne nomme jamais un appareil.** La scene declare `touches` ; l'utilisateur
associe le clavier reel, et cette association vit **hors de la scene** -- un nom de port change de
machine en machine. Le flux attend un geste de ce role avec le point d'attente : `<!touches.Space`.

**Une variable sans type** existe pour etre ecrite dans une regle sans sonner : un pivot de
grammaire, un jalon de structure.

### `@def` -- declarer une definition

`@def` associe un nom a un corps, pour le reinvoquer d'un mot. **Le nom vient d'abord, ce qu'il vaut
ensuite.** Ses types sont ceux des signaux : `signal`, `pitch`, `phase`, `logic`.

```text
@def souffle lfo:2 >> filtre.cutoff       // un branchement
@def cadence sa re ga pa                  // une structure de terminaux
@def fondu phase `js: (t, dur) => 1 - t / dur`       // du code
@def kick (vel:120)                       // un prereglage
@def accent(x) x(vel:120)                 // une transformation parametree
@def fast(x) {x}:2                        // une transformation structurelle
```

Le nom se pose ensuite a sa place dans une regle :

```bpscript
Motif -> C4 D4 E4
S -> C4!kick D4 E4!accent fast(Motif)
```

**Ce qui se definit est ce qui se reinvoque** -- un fil isole entre deux points ne se definit pas,
puisqu'on ne le rejoue jamais seul.

### `@init` -- l'etat de depart

`@init` porte ce qui existe au demarrage de la scene et n'appartient a aucune declaration : le
branchement initial, le code lance une fois, les valeurs de depart.

```text
@var saw1 saw
@var lpf1 lpf

@init
  saw1 >> lpf1 >> audio
  `sc: SynthDef(\grain, { |freq| ... }).add`
```

**Une production ne s'ecrit pas dans `@init`** : une regle produit dans le temps, l'initialisation
precede le temps.

Ce qui appartient a une chose s'initialise **dans sa declaration** -- un flag ecrit son etat de
depart la ou il nait. `@init` recueille ce qui ne se rattache a rien : un branchement relie des
modules deja declares, il n'appartient a aucun d'eux.

### `@actor` -- declarer qui joue

Un acteur porte cinq cles. Chacune se lit dans un catalogue, et ce qui n'est pas ecrit vient de la
cascade.

| cle         | ce qu'elle fixe                                                           |
| ----------- | ------------------------------------------------------------------------- |
| `alphabet`  | la collection de terminaux que l'acteur joue                              |
| `tuning`    | l'accordage qui donne une frequence a chaque degre                        |
| `octaves`   | la convention de registre                                                 |
| `transport` | par ou l'acteur sort : `audio`, `midi`, `osc`                             |
| `eval`      | le langage par defaut de ses backticks, quand le backtick ne le nomme pas |

```text
@actor sitar
  alphabet.sargam
  tuning.sargam_22shruti
  octaves.saptak
  transport.audio
```

### Les modules -- ce qu'on cable

Un **module** est une fonction : une ou plusieurs **entrees**, du code, une ou plusieurs
**sorties**. C'est un module eurorack ecrit en code. Les modules vivent dans une librairie et
s'invoquent comme tout le reste.

```text
@module.saw
@module.lpf
@module.adsr
```

**Un seul signal, des conventions de lecture.** Il n'existe pas plusieurs natures de signal : un
signal est un flux de nombres. Ce qu'un type ajoute, c'est **la facon dont le recepteur le lit** --
une hauteur se transpose, une phase s'enroule, un etat logique se seuille. C'est pourquoi tout se
branche partout : il n'y a rien a convertir, seulement une convention a appliquer.

**Le signal sans convention est le cas ordinaire.** Ce qu'on appelle ailleurs « l'audio » est
simplement un signal dont on ne dit rien de plus.

**Chaque port est type.** Un port porte la **convention** selon laquelle son contenu se lit : `pitch`, `phase`,
`logic` — ou aucune, et c'est alors un signal ordinaire. Le type d'un port dit ce qu'on a le droit d'y brancher, et le compilateur le verifie.

**Un module a une entree et une sortie de signal par defaut.** Quand elles suffisent, la chaine
s'ecrit sans les nommer :

```text
saw >> lpf >> audio
```

**Quand il y en a plusieurs, le cablage les nomme**, avec le point :

```text
saw.freq >> lpf.cutoff
env.out >> lpf.cutoff
```

Un module est un **prototype** : il se declare une fois et s'instancie autant de fois qu'une piece en
a besoin, chaque instance portant ses propres valeurs de port.

**La librairie declare le TYPE, la scene declare l'INSTANCE, et c'est l'instance qu'on invoque.**
Un filtre passe-bas nomme `lpf` en librairie ne s'ecrit pas dans une regle : la scene ecrit

```text
@var lpf1 lpf
```

et c'est `lpf1` qui se cable et se regle. **Une instance est une variable** : son comportement vient
de son type. Deux filtres dans une piece
sont deux instances nommees, chacune avec ses valeurs de port.

#### Le prototype d'un module

**Les noms de champs sont en anglais** -- c'est du code. La prose qui les decrit reste en francais.

```json
{
  "name": "",
  "category": "",
  "description": "",
  "ports": {},
  "code": ""
}
```

**Trois sous-prototypes** couvrent les formes possibles. Chacun **ajoute** les champs de son cas.

| sous-prototype  | ce qu'il a                     | ce qu'il ajoute                            |
| --------------- | ------------------------------ | ------------------------------------------ |
| **`source`**    | des sorties seulement          | `defaultOut`                               |
| **`processor`** | des entrées **et** des sorties | `defaultIn` · `defaultOut` · `passthrough` |
| **`sink`**      | des entrées seulement          | `defaultIn`                                |

Un oscillateur, du bruit, un LFO sont des **sources** : on ne les neutralise pas, il n'y a rien à
faire passer à travers, donc pas de `passthrough`. Un filtre, un amplificateur, une enveloppe sont
des **traitements**. La sortie audio est un **puits**.

**Le sous-prototype est structurel, la catégorie est descriptive.** Le premier dit ce que le module
peut recevoir et rendre ; la seconde le range et le rend trouvable. Un LFO et un oscillateur ont
deux catégories et la même forme.

| champ                               | ce qu'il porte                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `name` · `category` · `description` | identité, famille, prose d'aide                                                                                                |
| `ports`                             | les ports du module, par leur nom                                                                                              |
| `defaultIn` · `defaultOut`          | le port qu'un câblage vise sans le nommer : `saw1 >> lpf1` relie la sortie par défaut de l'un à l'entrée par défaut de l'autre |
| `passthrough`                       | `{ "<sortie>": "<entrée>" }` — le chemin que le signal emprunte quand le module est court-circuité                             |
| `code`                              | le traitement                                                                                                                  |

#### Le prototype d'un port

```json
{
  "direction": "in",
  "convention": null,
  "voices": 1,
  "range": null,
  "unit": null,
  "description": ""
}
```

**Une entrée ajoute `fallback`** — la valeur qu'elle prend si rien n'est branché. Une sortie n'en a
pas : la notion lui est étrangère.

| champ            | ce qu'il porte                                                                  |
| ---------------- | ------------------------------------------------------------------------------- |
| `direction`      | `in` ou `out`                                                                   |
| `convention`     | comment le contenu du port se lit : `null`, `pitch`, `phase`, `logic`           |
| `voices`         | combien de **voix** ce port accepte — `1` pour une seule, `8` pour jusqu'à huit |
| `range` · `unit` | les bornes et l'unité du signal attendu                                         |
| `fallback`       | *(entrée seulement)* la valeur prise quand rien n'est branché                   |

**Les conventions.** `null` désigne un signal ordinaire, sans convention de lecture — c'est le cas
courant, celui qu'on appelle ailleurs « l'audio ». `pitch` se lit comme une hauteur, en
logarithmique : 1,0 vaut une octave. `phase` se lit comme une position dans un cycle entre 0 et 1 ;
ce qui dépasse s'enroule. `logic` se lit comme un état haut ou bas, dont ce sont les **transitions**
qui font événement.

**Un paramètre est une entrée** avec un `fallback` et rien de branché. Régler est un cas particulier de
brancher.

**La polyphonie appartient au port**, pas au module : un filtre traite huit voix tout en gardant une
seule coupure.

**Ces prototypes vivent avec les autres.** Un module, un port, un terminal, un alphabet suivent le meme
mecanisme : un socle, des sous-prototypes qui **ajoutent** les champs de leur cas, et un champ qui
n'existe que si sa notion s'applique.

**Aucun ne porte le nom du composant qui le resout.** Le langage dit ce qu'une piece veut ; quel
composant le calcule est une affaire d'architecture, et le nommer ici ferait d'un changement
d'architecture un changement de langage. Ce qu'un objet porte, c'est sa **destination** -- le
runtime de sortie d'un terminal --, jamais son resolveur.

### Invoquer une librairie

**Une librairie s'invoque par son nom, l'entree apres le point.** C'est la forme unique de tout ce
qui vit dans un catalogue.

```text
@alphabet.sargam
@tuning.just
@octaves.saptak
@transcription.dhati
@library.strudel
```

| librairie       | ce qu'elle collectionne                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `alphabet`      | des **terminaux** -- sonnants ou non, avec ou sans hauteur, code ou calcul                                                      |
| `tuning`        | des accordages                                                                                                                  |
| `octaves`       | des conventions de registre                                                                                                     |
| `sound`         | des prototypes d'objet sonore : ce que le moteur a le droit de comprimer, d'etirer, de tronquer pour faire tenir une polymetrie |
| `transcription` | des tables de correspondance entre notations                                                                                    |
| `library`       | des banques chargees par un moteur de code                                                                                      |
| `module`        | des modules de signal : leurs ports, leurs conventions et leur traitement                                                       |
| `patch`         | le langage de cablage des backtiques `patch:`                                                                                   |
| `eval`          | les langages backtiques externes -- `sc`, `js`, `strudel`, `hydra`                                                              |

Le catalogue complet, avec la nature de chaque librairie et le composant qui la resout, vit dans
`atlas/architecture/LIBRAIRIES.md`.

**Un alphabet est une collection structuree de terminaux.** Un terminal est une chose entiere : il
sonne ou non, porte une hauteur ou non, invoque du code ou une instruction de calcul de hauteur.
Ce qui le simplifie est une **definition**, pas un decoupage en axes portes par l'acteur.

### Invoquer un reglage

**Un reglage s'ecrit par sa categorie, l'entree apres le point.** La categorie dit a quoi le reglage
touche, donc qui le consomme.

| categorie  | ce qu'elle regle                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@transpo.`  | `transpose` · `scaleshift` · `chromashift` · `keyxpand` · `diapason`                                                                                         |
| `@time.`   | `tempo` -- la vitesse a laquelle le temps se lit                                                                                                             |
| `@engine.` | `mode` · `scan` · `weight` · `seed` · `maxitems` · `on_fail` · `quantization` · `qclock` · `duration` · `meter` · `timepatterns` · les operateurs `/` et `*` |

**Le temps se partage entre deux categories** : `engine` porte le temps **calcule** -- ou tombe
chaque evenement, une propriete de l'arbre ; `time` porte le temps qui **s'ecoule**. Le metre et la
duree disent ou les choses tombent, donc ils relevent du premier.

```text
@time.tempo:120
@engine.seed:42
@transpo.diapason:442
```

### Duree explicite

```text
@core
@alphabet.sargam
@time.tempo:90
@engine.duration:16b

S -> sa re ga pa
```

`@engine.duration:16b` fixe une enveloppe de 16 beats au tempo courant ; `8s` la fixe en secondes.

La duree separe trois preoccupations :
- **Densite** = le contenu (combien de termes, quelles proportions)
- **Duree** = `@engine.duration` (combien de beats ou de secondes la scene occupe)
- **Vitesse** = `@time.tempo` (l'horloge, partagee avec le monde exterieur)

Avec une duree posee, la scene est dilatee uniformement et ses proportions internes sont
preservees. Sans elle, la duree suit le contenu : le nombre de termes derives et le tempo courant.

---

## L'ordonnanceur

BPScript decide **quand**. Le code entre backticks decide **quoi** : il est execute par le
runtime que son tag nomme (`sc:`, `tidal:`, `py:`). Les deux vivent dans le meme fichier : les
backticks de tete preparent chaque runtime au chargement, ceux des productions jouent a leur
instant -- ecrits directement dans la regle, ou nommes par une definition (cf.
[Backticks](#backticks----code-natif-dans-le-flux)).

```bpscript
@core
@alphabet.western:audio

// En tete de scene : chaque moteur de code prepare ses objets au chargement
`sc: SynthDef(\grain, { |freq, dens| GrainSin.ar(dens, freq) }).add`
`tidal: let pat = s "bd sd hh sd"`
`py: import dmx; d = dmx.open()`

// Une definition nomme un fragment de code ; son nom se pose nu dans le flux
@def noir `py: d.blackout()`

S -> Section [phase=1]

-----

[phase==1] Section -> { Intro, Rythme }
[phase==2] Section -> { Melodie, Rythme }
Intro   -> C4 D4 `tidal: once pat` E4     // code ecrit directement dans la production
Rythme  -> G3 G3 G3 G3
Melodie -> E4 F4 noir G4 A4               // le meme geste, nomme par la definition
```

Le compilateur transmet le code tel quel, avec son tag et sa place dans le flux.

---

## Inventaire

### Ce que le langage connait en propre

**Est reserve ce qui existe quand aucune librairie n'est invoquee.** Une scene nue n'a que ces
mots : le parser les connait pour construire l'arbre, aucun catalogue ne peut les redefinir.

| Mot     | Ce qu'il declare                        |
| ------- | ----------------------------------------- |
| `@actor` | qui joue                                |
| `@var`   | qu'un nom existe, et de quel type       |
| `@def`   | qu'un nom vaut un corps                 |
| `@init`  | l'etat de depart de la scene            |

Plus les **symboles structurels** ci-dessous.

**Tout le reste vient des librairies.** `mode`, `tempo`, `vel`, `cutoff`, les alphabets, les
accordages, les modules : rien de cela n'est un mot du langage. Une scene qui n'invoque aucune
librairie ne les connait pas, et les ecrire se heurte a des noms inconnus -- c'est le comportement
attendu, pas une faute.

### Les symboles structurels

```text
@              directive de declaration, en tete de scene
-> <- <>       derivation et direction
-----          separateur de sous-grammaires : la passe suivante commence
{ , }          polymetrie et groupement temporel
( )            reglages (portees symbole, regle, groupe) et contexte de regle
:              affectation : lie un sujet a une valeur (@alphabet.sargam:audio, *:vel:80)
*              sujet universel d'une affectation -- tous les terminaux de la portee
               (*:vel:80, *:sombre) ; dans une vitesse, ecrit la fraction (! (*2/3)) ;
               entre un gabarit maitre et son esclave, marqueur d'homomorphisme ($X * &X)
=              affectation de drapeau, entre crochets en fin de regle (S -> C4 [phase=2])
.              reference a une entite (alphabet.western, lpf1.cutoff, transport.midi),
               sous-partie (acteur.terminal), separateur de fragments (A B . C D)
[ ]            derivation : un drapeau qui la conditionne, un rang de forme structurelle
` `            code externe, execute par le runtime que son tag nomme
//             commentaire
-              silence : occupe du temps
_              prolongation : etend l'evenement precedent
...            repos indetermine, duree calculee par le moteur
!              simultaneite : ce qui suit partage l'instant d'attaque de l'element qui
               precede (C4!dha) ; sans element devant lui, objet hors-temps de duree nulle
               (S -> !dha C4) ; devant un reglage, mutation de flux (!(mode:random))
<!             point d'attente : point de synchronisation, la derivation attend un geste entrant
#              contexte negatif
?              capture d'un symbole quelconque
$              gabarit : capture d'un motif (maitre)
&              gabarit : rejeu d'un motif (esclave)
~              liaison d'objets sonores (C4~ debut, ~C4 fin, ~C4~ continuation)
| |            homomorphisme : variable liee dans une regle
>> \>>         cablage : brancher un element sur un autre, couper le cable
```

L'espace separe les termes : `C4 D4` est deux notes, `- - -` est trois silences. L'emploi de
`.`, `:` et `*` est decrit dans « Conventions de notation », celui de `!` dans « L'operateur
`!` -- simultaneite ».

Ecriture des symboles temporels :
- `.` s'ecrit isole entre deux espaces -- separateur de fragments (`A B . C D`)
- `...` s'ecrit en trois caracteres colles -- repos indetermine
- `-` s'ecrit isole -- un silence par occurrence

Le compilateur connait la semantique de `-`, `_`, `.` et `...` : ce sont des symboles du
langage, au meme titre que les fleches.

### Les operateurs de flags

Comparaison (6) -- dans la garde :

```text
==             test d'egalite
!=             test d'inegalite
>              test superieur
<              test inferieur
>=             test superieur ou egal
<=             test inferieur ou egal
```

Calcul (3) :

```text
+              increment      [count+1]     garde et fin de regle
-              decrement      [count-1]     garde et fin de regle
=              affectation    [count=4]     fin de regle
```

Le decrement `-` s'ecrit avec le glyphe du silence ; entre crochets et pose sur un drapeau, c'est
l'operateur. L'inventaire des glyphes et celui des operateurs sont independants : un meme signe sert
dans les deux, sa place tranche lequel des deux roles il tient.

Ce qu'ils font est decrit dans « Flags ».

### Trois places, trois roles

- `@` = **global** : environnement, imports, configuration de la scene
- `[]` = **la derivation** : un drapeau qui la conditionne, un rang qui designe une de ses formes
- `()` = **les reglages** : le domaine de la cle nomme leur destinataire

```text
@core
@alphabet.western:audio
@time.tempo:120

S -> C4(vel:0.7) D4:0.5 E4 F4 (mode:random)
```

Un reglage s'invoque par sa categorie -- `@transpo.`, `@time.`, `@engine.` -- decrite dans
« Invoquer un reglage ». Les nombres (`0.7`, `120`, `5ms`) sont transportes tels quels : c'est
le recepteur qui leur donne un sens.

### Le crochet -- ce qui appartient a la derivation

**Le crochet porte ce qui gouverne la derivation elle-meme** : l'etat qui decide de son chemin, et
le rang d'une forme dans le catalogue. Tout reglage s'ecrit entre **parentheses**, ou le **domaine
de la cle** nomme son destinataire.

| place                              | ce qu'il porte                                                |
| ---------------------------------- | ------------------------------------------------------------- |
| avant le membre gauche             | un **test** de drapeau : `[phase==1]`, `[Ideas]`, `[count-1]` |
| en fin de regle                    | une **affectation** de drapeau : `[phase=2]`                  |
| en tete d'une ligne de `@template` | le **rang** d'une forme dans le catalogue : `[3]`             |

Une garde decide si la regle s'applique a cette derivation ; une affectation change l'etat pour la
suite. Un reglage ecrit entre crochets arrete la compilation, et le message donne sa forme : le
`mode` s'ecrit `(mode:random)`.

```bpscript
@core
@alphabet.western:audio

[count-1] S -> C4 D4 (mode:random) [phase=2]
```

**Un signe, une nature.** Ce qui est entre crochets appartient a la **derivation** : un drapeau
decide de son chemin, un rang designe une des formes qu'elle autorise. Ce qui est entre parentheses
appartient a ce qu'elle **produit** : un reglage en decrit une propriete, et le domaine de sa cle
suffit a le router.

BPScript decrit des structures dans le temps. Le calcul et le traitement de signal s'ecrivent
dans le code externe (backticks).

---

## Systeme de types -- ce qu'un nom est, comment un signal se lit

Un type repond a deux questions distinctes : ce qu'un **nom** est dans la scene, et comment un
**signal** se lit chez celui qui le recoit.

### Trois categories de symboles

Une scene contient trois categories de symboles, que le compilateur reconnait a leur ecriture :

| Categorie        | Declaration                              | Role                                           | Exemples                               |
| ---------------- | ---------------------------------------- | ---------------------------------------------- | -------------------------------------- |
| **Non-terminal** | le nom d'une regle (son LHS), ou `@var`  | variable de grammaire, se reecrit et disparait | S, Intro, Motif, R1, P4                |
| **Terminal**     | explicite (un alphabet, une declaration) | symbole de sortie, atteint un runtime          | `sa`, `C4`, `dha`                      |
| **Reglage**      | une cle d'une librairie invoquee         | decrit une propriete, zero duree               | `(mode:random)`, `(weight:50)`, `(vel:80)` |

**Rien n'est implicite.** Un non-terminal se declare de deux facons : il est le nom d'une regle,
donc declare par son membre gauche, ou bien `@var` le declare -- c'est le cas des non-terminaux
intermediaires, qui n'ont pas de regle a leur nom. Un non-terminal vit le temps de la derivation :
son role est d'etre reecrit, et les regles le remplacent par des terminaux. La derivation s'acheve
sur des terminaux, seuls porteurs d'une sortie.

### Ce que porte un terminal

Un terminal est une chose entiere : il sonne ou non, porte une hauteur ou non, invoque du code
ou une instruction de calcul de hauteur.

**Un terminal se declare sur un prototype.** Le prototype porte toutes ses proprietes avec leur valeur
par defaut ; un terminal concret ne declare que ce qui differe.

```json
{ "name": "", "runtime": "audio", "sounding": true, "duration": null, "code": null }
```

**Un champ n'existe que si sa notion s'applique.** Une valeur non renseignee prend son defaut ;
une notion etrangere a l'objet n'a pas de champ du tout. Un sous-prototype **ajoute** donc les champs
de son cas, il ne se contente pas d'en changer la valeur. Le socle ne connait pas la hauteur : une
percussion ne porte pas une hauteur vide, la notion lui est etrangere.

| sous-prototype      | ce qu'il ajoute                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| **`note`**       | `degree` -- un degre, resolu par les librairies d'accordage et d'octaves, **calcule par Kairos** |
| **`percussion`** | rien : elle sonne et dure, sans porter de hauteur                                                |

`degree` et non `pitch` : le champ porte un **degre** que l'accordage resout, alors que `pitch` est
deja une convention de lecture de signal. Un mot, une chose.

**L'affectation de valeur d'un terminal est son runtime de sortie** -- ce que le deux-points
ecrit.

Les autres cas tombent du meme socle : un terminal dont `sounding` est faux ne produit aucune
sortie, c'est le pivot de grammaire ; un terminal sans `duration` occupe l'instant ; un terminal
dont `code` est renseigne invoque du code.

**D'autres natures s'ajouteront par le meme mecanisme.** Un terminal qui joue un **echantillon**
aura son sous-prototype : de quel fichier il vient, et ce que le moteur a le droit d'en deformer --
comprimer, etirer, tronquer -- pour le faire tenir dans une polymetrie. Le socle ne bouge pas ; un
sous-prototype ajoute les champs de son cas, comme `note` ajoute le degre.

**Un alphabet est une collection de terminaux**, et c'est une commodite de regroupement : un
terminal peut se declarer seul. Le prototype d'un alphabet porte la meme affectation, et ses
terminaux en heritent :

```json
{ "name": "", "description": "", "runtime": "audio", "terminals": {} }
```

Le deux-points affecte donc le **runtime de sortie**, pris parmi `audio`, `midi` et `osc` ; un
terminal qui n'en declare pas prend celui de son alphabet :

```bpscript
@core
@alphabet.sargam:audio

S -> sa re ga
```

La sortie d'un terminal vaut pour toute la scene.

#### Le prototype d'un langage backtique

**Un langage backtique se declare en librairie comme tout le reste** -- un prototype avec ses defauts,
surcharge par chaque langage. C'est lui qui repond a « ce code sonne-t-il, et occupe-t-il du
temps ? », au lieu de le laisser deviner.

```json
{ "name": "", "description": "", "sounding": true, "duration": null }
```

| champ         | ce qu'il porte                                                       |
| ------------- | -------------------------------------------------------------------- |
| `name`        | le tag ecrit devant le deux-points -- `sc`, `js`, `strudel`, `patch` |
| `description` | a quoi sert ce langage                                               |
| `sounding`    | ce que ce langage produit par defaut, sonnant ou non                 |
| `duration`    | la duree par defaut de ce qu'il produit                              |
| `returns`     | *(seulement s'il rend une valeur)* la convention de ce qu'il rend    |

**`returns` appartient aux langages employables EN LIGNE** -- `sa(vel:` suivi d'un backtick qui rend
un nombre. Sa presence dit qu'on peut ecrire ce langage dans un parametre, et la convention de ce
qu'il y rend.

**Un seul prototype pour les deux emplois.** Le meme `sc:` s'ecrit autonome dans le flux et en ligne
dans un parametre ; ce qui varie d'un langage a l'autre, ce sont ses defauts, et une occurrence les
surcharge avec un sac : `` `sc: i = i + 1`(sounding:false) ``.

**`patch` declare `sounding` faux et `duration` nulle**, toujours.

Chaque terminal employe dans une regle est declare, et le compilateur nomme celui qui manque :

```text
S -> C4 D4 Bloup E4
//            ^^^^
// terminal 'Bloup' non declare -- absent des alphabets en portee
```

### Les conventions de lecture d'un signal

Un signal est un flux de nombres ; le type dit **comment le recepteur le lit**, et c'est tout ce
qu'il ajoute.

| convention | lecture                                                                      |
| ---------- | ---------------------------------------------------------------------------- |
| *(aucune)* | un signal ordinaire -- le cas courant, ce qu'on appelle ailleurs « l'audio » |
| `pitch`    | une hauteur, en logarithmique : `1.0` vaut une octave                        |
| `phase`    | une position dans un cycle entre 0 et 1 ; ce qui depasse s'enroule           |
| `logic`    | un etat haut ou bas, dont les **transitions** font evenement                 |

Un declenchement est une transition d'un etat bistable, donc un `logic` : une meme convention
couvre l'etat tenu et l'impulsion.

Ces quatre conventions typent les ports des modules, les variables `@var` et les definitions
`@def`. Le principe et les ports sont decrits dans « Les modules -- ce qu'on cable », les
variables dans « `@var` -- declarer une variable ».

---

## Parametres -- opaques pour BPScript

BPScript transporte les parametres jusqu'au runtime, qui les interprete.

```bpscript
@core

// SuperCollider definit les parametres dans un SynthDef
`sc: SynthDef(\sitar, { |freq, vel=80| ... }).add`

// L'acteur dit qui joue et quel moteur de code evalue ses backticks
@actor sitar
  alphabet.sargam
  eval.sc

// Les parametres partent tels quels vers SuperCollider
S -> sitar.sa(vel:120) sitar.sa(vel:`rrand(40,127)`) sitar.sa
```

Trois ecritures, une seule plomberie :

```text
sa(vel:120)                                  litteral -- BPScript transporte la valeur
sa(vel:`rrand(40,127)`)                      backtick inline -- le runtime de sa evalue
`sc: SynthDef(\grain, { |freq| ... }).add`   backtick autonome -- le tag nomme le langage
```

Un backtick qui tient sa propre place -- en tete de scene ou dans le flux d'une regle -- est
**autonome** : son langage se nomme, soit par un tag dans le bloc (`` `js: …` ``), soit par un
acteur qui le qualifie avec le point (`` drums.`…` ``, declare par `@actor drums eval.<moteur>`).
La regle vaut aux deux emplacements.

Pour BPScript, `vel` est un nom qu'il porte, `120` une valeur qu'il transporte, et
`` `rrand(40,127)` `` du code que le runtime de `sa` evalue. Les trois suivent le meme chemin.

### Surcharge des parametres

La cascade fournit la valeur de chaque parametre ; ecrire ce parametre sur l'occurrence remplace
cette valeur, pour cette occurrence. La cascade complete est decrite dans « Heritage par
cascade ».

```bpscript
@core

`sc: SynthDef(\sitar, { |freq, vel=80| ... }).add`
@actor sitar
  alphabet.sargam
  eval.sc

S -> sitar.sa sitar.sa(vel:120) sitar.sa(vel:`rrand(40,127)`)
//         ^ herite         ^ litteral            ^ evalue par SuperCollider
```

La surcharge porte sur les parametres ; le contrat -- la sortie et la convention de lecture --
reste celui de la declaration.

---

## Les sacs : `()` reglages, `[]` derivation

### Les reglages du moteur

**Le moteur recoit ses reglages entre parentheses**, comme tout le reste : le domaine de la cle
l'adresse. Il les consomme **pendant** la derivation et le calcul temporel ; la sortie porte leur
effet.

```bpscript
// Portee symbole -- colle a l'element
S -> A:0.5 B C                  // A occupe un demi-battement

// Portee regle -- en fin de regle
S -> A B C (mode:random)        // mode de la sous-grammaire
Basse -> C2 C2 C3 (weight:50)   // poids de la regle
Basse -> C2 E2 G2 (weight:inf)  // poids infini : priorite absolue

// Portee groupe -- apres le groupe
S -> {A B C}:0.5                // le groupe occupe un demi-battement
```

### Les cles que le moteur consomme

Elles vivent dans la librairie `engine`, sauf le tempo qui vit dans `time` :

```text
/N   *N     les deux operateurs temporels -- fraction (*3/2) et decimal (/1.5) admis
mode        mode du bloc (random, ord, sub, sub1, lin, tem, poslong) -- defaut : ord
scan        sens du parcours par regle (left, right, rnd) -- defaut : rnd
weight      poids de la regle (entier, K-param, ou inf) -- a zero, la regle est ecartee
on_fail     gestion d'echec (skip, retry(N), fallback(X)) -- defaut : skip
tempo       tempo de la regle -- (tempo:120) ; @time.tempo:120 pose celui de la scene
meter       signature rythmique -- (meter:7/8), (meter:4+4/4)
```

Une cle qu'aucune librairie invoquee ne porte arrete la compilation.

### `()` -- un reglage (toujours suffixe)

**Le nom d'un reglage suffit a savoir ou il va.** Chaque nom appartient a une librairie, et chaque
librairie a un destinataire : ecrire `mode` dit le moteur, `tuning` dit la hauteur, `wave` dit une
sortie sonore. On n'ecrit donc jamais le destinataire -- le nom le porte. C'est la meme regle que
pour les directives de tete.

Le compilateur verifie que la cle appartient a une librairie invoquee et transmet la valeur telle
quelle. **Qui lit quoi est decrit dans `atlas/architecture/05-interfaces.md`.**

```bpscript
// Portee symbole -- colle a l'element
S -> C4(vel:120)                        // vel envoye au runtime quand C4 joue
S -> C2(wave:sawtooth, filterQ:8)       // parametres de synthese

// Portee regle -- en fin de RHS
Basse -> C2 C2 - C2 (vel:100)           // vel pour toute la phrase

// Portee groupe -- apres le groupe
S -> {A B C}(lpf1.cutoff:4000)          // une instance nommee, un de ses ports
```

**Superposition des modulations continues.** Quand plusieurs portees posent le **meme parametre**
sur une meme note (note, groupe, groupe parent...), les reglages **s'empilent en serie**, de
l'**interieur vers l'exterieur**, dans l'ordre de l'imbrication : dans
`{ C4(lpf1.cutoff:500) D4 }(lpf2.cutoff:300)`, le son de C4 traverse son filtre de note puis celui du
groupe.
**Une valeur simple, elle, ne s'empile pas.** Deux `vel` sur la meme note ne s'additionnent pas et
ne se traversent pas : le plus local gagne, l'autre est ignore. La difference tient a ce que la
chose est -- un filtre se traverse, une intensite se choisit.

**Une enveloppe posee sur une portee repart a chaque silence.** Ecrire `(cutoff:env)` confie la
coupure a une enveloppe nommee `env` : elle monte, elle tient, elle redescend. Quand elle couvre une
**regle** ou un **groupe**, chaque silence `-` de cette portee la relance depuis le debut ; une
accolade qui enjambe le silence lui fait au contraire **traverser** -- une seule montee sur toute
l'etendue. L'accolade choisit :

```bpscript
// Regle nue -> le silence ARTICULE : l'enveloppe repart apres chaque -
Detache -> C2 - C2 (cutoff:env)

// Accolade -> UN arc continu : le - interne est franchi (liaison)
Lie -> { C2 - C2 }(cutoff:env)

// La boucle est transparente : un tour re-arme quand un silence tombe a la couture,
// ou quand le tour sort de l'accolade. Un long arc sur N tours = une accolade
// qui couvre la reprise :
S -> { Lie Lie Lie Lie }(cutoff:env)
```

**Une seule regle a retenir : c'est l'accolade qui dit jusqu'ou une enveloppe tient.** Plus elle
est large, plus la montee est longue -- sur une note, sur une phrase, sur plusieurs tours de boucle.
Ce qui la realise est decrit dans `atlas/architecture/MODULATIONS.md`.

### Valeur brute (modele CSS)

Dans `()`, tout ce qui suit le `:` jusqu'au prochain `,` ou au delimiteur fermant
est la **valeur brute** : le destinataire -- moteur ou runtime -- l'interprete.

### Controles autonomes (resolution pure)

Quand un non-terminal se resout **entierement** en reglages, un sac `()` tient lieu de
RHS et la regle produit des elements de duree nulle :

```bpscript
Pull0 -> (pitchbend:0)
StartPull -> (pitchcont, pitchrange:500, pitchbend:0)
```

Une regle porte **un** sac de portee. Pour en poser plusieurs, chacun prend son `!` et se pose
dans le flux :

```bpscript

StartPull -> !(pitchcont) !(pitchrange:500) !(pitchbend:0)
```

### Resume des portees

**Le domaine de la cle nomme le destinataire ; la place du sac donne la portee.**

| Portee      | Syntaxe          | Exemple           |
| ----------- | ---------------- | ----------------- |
| **globale** | `@cle:valeur`    | `@time.tempo:120` |
| **groupe**  | `{}(cle:valeur)` | `{A B}(vel:80)`   |
| **regle**   | `(cle:valeur)`   | `C2 C2 (vel:100)` |
| **symbole** | `(cle:valeur)`   | `C4(vel:120)`     |

Le crochet a son propre tableau, sous « Le crochet -- ce qui appartient a la derivation ».

### Destinataire d'une paire `[sujet:]cle:valeur`

Le `()` d'une regle vaut par defaut pour **la regle comme unite**. Une paire peut porter un
**sujet** devant la cle pour viser plus finement -- meme mecanisme que l'affectation
`*:vel:80`, ou le `:` introduit deja un sujet.

| Ecriture                             | Sujet | Cible                             |
| ------------------------------------ | ----- | --------------------------------- |
| `(cutoff:env)` · `{…}(sombre)`       | omis  | **la portee elle-meme** (l'unite) |
| `(*:cutoff:env)` · `{…}(*:sombre)`   | `*`   | **chaque terminal** de la portee  |
| `(C2:cutoff:env)` · `{…}(C2:sombre)` | `C2`  | les terminaux **C2** de la portee |

Le sujet s'ecrit pareil devant une **valeur** a affecter et devant un **nom** a appliquer : le
deux-points introduit le sujet dans les deux cas.

- `*` designe tous les terminaux de la portee.
- Le sujet vaut **par paire** : `(*:cutoff:env, wave:sawtooth, vel:100)` pose `cutoff` sur chaque
  terminal, `wave` et `vel` sur la regle.
- Pour un **signal** (qui varie dans le temps), le sujet decide l'**horloge** : sans sujet, il court
  sur la voix ; avec `*:`, une enveloppe relancee par note. C'est le sujet qui tranche, pas la
  nature de la valeur. Pour un reglage **statique** (`wave`), les deux ecritures donnent le meme
  effet : la distinction porte sur le temporel.

**La difference est musicale, pas cosmetique.** Un traitement partage melange les terminaux avant de
les traiter ; un traitement par terminal en donne un a chacun. Sur un filtre resonant, le premier
fait resonner l'accord, le second fait resonner chaque note.

### Appliquer un module

**Un module invoque dans un sac s'insere entre le terminal et sa sortie.** C'est un **calque**, et
sa portee en donne l'etendue.

```bpscript
@var lpf1 lpf
@var lpf2 lpf

S -> C4(lpf1.cutoff:400)              // un calque sur une note
S -> { C4 D4 }(lpf2.cutoff:800)       // un calque sur un groupe
S -> { C4(lpf1.cutoff:400) D4 }(lpf2.cutoff:800)   // les deux : C4 traverse le sien, puis celui du groupe
```

**Le meme nom pose un calque ou un geste, selon l'endroit ou il est ecrit :**

| Ecriture                | Ce que ca fait                                                              |
| ----------------------- | --------------------------------------------------------------------------- |
| dans un sac `(sombre)`  | un **calque** -- il vit sur la portee, il nait et meurt avec elle           |
| nu dans le flux `coupe` | un **geste** -- il change la topologie a cet instant, et ca reste apres lui |

```bpscript
@def sombre lpf1 >> vca1
@def coupe  saw1 \>> lpf1

S -> { C4 D4 }(sombre) E4 coupe F4
```

Un cable se coupe pendant que ca joue ; une portee, elle, se referme.

**Les modules d'un chainage restent des instances nommees.** Un chainage se declare en tete, comme
toute definition ; son nom et ceux de ses modules s'emploient ensuite dans les regles :

```bpscript
@var lpf1 lpf
@var vca1 vca
@def sombre lpf1 >> vca1

S -> {C4 D4}(sombre) E4(lpf1.cutoff:400)
```

**Le corps d'un chainage est ecrit dans le langage de patch** -- le meme que celui des backtiques
`patch:`. Un seul langage, deux emplacements : nomme dans un `@def`, litteral dans une regle.

**Un module de librairie et un chainage de scene sont la meme chose**, declaree par le meme mot :
une librairie de modules est une collection de `@def`, comme un alphabet est une collection de
terminaux. Ce qui s'invoque dans une regle est **l'instance**, jamais le type : la scene ecrit
`@var lpf1 lpf`, puis `{A B}(lpf1.cutoff:4000)`.

**Ce que le calque devient a l'execution** -- exemplaires, ordre de traversee, fin de vie,
rechargement a chaud -- est decrit dans `hub/projets/dedale/LE-CALQUE.md`.

### Le sac dans le flux : `!()`

**Un sac vaut pour sa portee ; le meme sac precede de `!` vaut pour ce qui suit.** C'est
l'application de deux principes deja poses : la portee se lit dans la place du sac, et le `!` pose
un element sans duree a l'endroit ou il est ecrit.

| Ecriture | Ce qu'elle gouverne                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| `(...)`  | toute sa portee -- regle ou groupe -- les elements ecrits avant elle compris ; l'effet s'arrete au bord de la portee |
| `!(...)` | les elements qui suivent dans l'ordre joue, au-dela des bords de regle, jusqu'au prochain sac                        |

```bpscript

// PORTEE -- (...) : les TROIS notes en sawtooth, l'effet reste dans Basse
Basse -> C2 E2 G2 (wave:sawtooth)
S -> {C4 E4}(vel:80)                 // C4 et E4 a 80, l'effet reste dans le groupe

// FLUX -- !(...) : la valeur coule vers l'avant et franchit la fin de Debut
S -> Debut Suite
Debut -> C4 !(vel:100)               // C4 garde le defaut, le flux part apres lui
Suite -> E4 E4                       // les deux E4 sortent a 100
```

Le flux est un **etat courant** qui reste en vigueur d'un cycle et d'une regle a l'autre. Une note
**echantillonne** la valeur en vigueur a son instant d'attaque, comme un signal en escalier. Sa
portee est **par voix** : un flux pose dans une voix reste dans cette voix.

#### Table de syntaxe du `!`

| Ecriture                                      | Sens                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `(...)` *(sans `!`)*                          | **portee** -- l'effet reste dans sa portee                                       |
| `C4!(...)` **colle** (pas d'espace avant `!`) | **flux CONJOINT, ancre a C4** -- il voyage avec C4 et se replique avec lui       |
| `C4 !(...)` **espace**                        | **flux, EVENEMENT SEPARE** -- pose seul dans la sequence                         |
| `B3!C7` *(`!` entre symboles)*                | **SIMULTANE / accord** -- les deux notes attaquent au meme instant               |
| `!f` *(en tete, sans primaire)*               | **objet HORS-TEMPS** -- pose seul, sans duree (`OutTimeObject`)                  |
| `!(seed:N)`                                   | **reglage pose DANS LE FLUX** -- element sans duree (`InstantControl`)           |
| `C4 !prise` *(nom d'une definition)*          | **ACCORD** -- `prise` y sonne comme co-attaque et l'aval lui cherche une hauteur |
| `` !`patch: osc1 >> lpf1` ``                  | **cablage pose dans le flux** -- un terminal de code, muet et de duree nulle     |
| `!=` *(dans une garde)*                       | **comparaison de difference**, pendant de `==`                                   |

C'est ce qui **suit** le `!` qui decide de la lecture. Le `!` lui-meme dit l'instantane, duree
zero ; la coupure de cablage s'ecrit `\>>`. `!=` forme un jeton unique, comme `==` ou `>=`.

Ecrit `C4 !prise`, le nom d'un cablage devient une co-attaque de l'accord : l'aval lui cherche une
hauteur et un son sort, sans qu'aucune erreur le signale.

**L'espace tranche l'attache de `!(...)`** -- application de la convention generale de l'espace,
delimiteur de termes : colle au terminal precedent, le reglage voyage avec lui ; separe par une
espace, il se pose seul dans la sequence. En tete de regle ou de groupe (`{!(vel:80) ...}`), il se
pose seul. L'AST porte cette attache sur le noeud `!(...)` (`conjoint`), et le simultane `B3!C7`
reste un `SimultaneousGroup`.

**Un nom pose apres `!` s'attache au terminal qui precede** : les deux partagent l'instant, et le
terminal porte la duree. `S -> C4!kick D4` donne **deux** elements dans le membre droit, `C4` et son
attache partageant le premier ; `S -> C4 kick D4` en donne **trois**, et le nom y occupe son propre
pas.

**Chaque element porte son `!`**, et une espace les separe : `Interne -> !(ins:1) !(chan:1)` donne
deux elements freres ; `C4!E4!G4` donne un primaire et deux secondaires.

**Precedence** (du plus fort au plus faible) :
**override de note `C4(vel:120)` > flux `!(...)` > portee `(...)` > defauts de declaration.**

---

## Les parentheses `()` -- quatre roles

Les parentheses ont quatre fonctions, decidees par la position :

```bpscript
// 1. Sac de reglages -- sur un symbole, une regle ou un groupe
S -> C4(vel:120)                      // symbole : vel envoye a la sortie quand C4 joue
Basse -> C2 C2 - C2 (vel:100)         // regle : vel pour toute la phrase
S -> {A B}(lpf1.cutoff:4000)          // groupe : le filtre couvre tout le groupe

// 2. Contexte -- condition d'application d'une regle
(A B) X -> D E                        // X se reecrit en D E seulement s'il suit A B
```

```bpscript
// 3. Liste de parametres d'une declaration -- collee au nom
@def accent(x) x(vel:120)

// 4. Argument d'un appel de definition
S -> accent(C4) E4
```

La regle de desambiguation est positionnelle :
- `symbole(` colle, dans une regle = sac de reglages, ou appel d'une definition
- `(` en fin de RHS = sac de reglages de portee regle
- `{}(` apres un groupe = sac de reglages de portee groupe
- `@directive nom(` colle au nom = liste de parametres d'une declaration
- `(` en tete de regle, avant le LHS et la fleche = contexte

Une procedure moteur prend elle aussi son argument entre parentheses, a l'interieur du sac `[]` :
`(on_fail:retry(2))`, `(on_fail:fallback(Autre))`.

Le groupement s'ecrit avec les accolades `{}`.

---

## Les accolades `{}` -- polymetrie et groupement

Les accolades ont trois roles :

```bpscript
// 1. Polymetrie -- plusieurs voix simultanees, separees par ,
Melodie -> C4 E4
Rythme -> G4 -
S -> { Melodie, Rythme }

// 2. Groupement temporel -- un sous-groupe dans une sequence, une seule voix
S -> A {B C D} E F
```

### Duree collee sur un groupe

Une duree s'ecrit avec `:` colle (cf. la section des conventions de notation `.` / `:` / `*`).
Posee sur un bloc polymetrique, elle en donne le ratio :

```bpscript
S -> {C3, E3, G3, C4}:2      // duree du bloc
S -> {C4 E4 G4}:2/3          // ratio fractionnaire
S -> A4:1/2                  // la meme duree, sur une note
```

---

## L'operateur `!` -- simultaneite

### `!` -- "a cet instant, aussi ca"

`!` attache un ou plusieurs elements secondaires a un point dans le temps.
Le premier element (le **primaire**) definit la position et la duree.
Tout ce qui suit `!` se declenche **au meme instant**.

`!` accepte **tout ce qui se pose dans le flux** :

```bpscript
@alphabet.western:audio
@alphabet.tabla:osc
@def monte mod.ramp(from:0, to:255)

S -> dha!tin                       // deux symboles a la meme attaque
S -> dha!na                        // na prend la duree de dha
S -> C4!dha!ge [phase=2]    // deux secondaires et une mutation de drapeau
S -> -!dha                         // le silence porte la position, dha attaque avec lui
S -> C4!monte                      // monte prend la duree de C4
```

Regles :
- **Avant `!`** : le primaire -- il occupe du temps (une note, un silence, un signal)
- **Apres `!`** : les secondaires -- ils partagent l'instant d'attaque du primaire et **prennent
  sa duree** ; seule une mutation de drapeau (`nom=valeur`) reste de duree zero
- **`!nom` pose seul** dans la sequence : **objet hors-temps** -- il tient sa place dans
  l'ordre joue pour une duree nulle.
- **`!(reglage)` pose seul** : mutation de **flux** -- cf.
  [Le sac dans le flux : `!()`](#le-sac-dans-le-flux--)

C'est le mecanisme de la **simultaneite cross-runtime** : un seul point dans le temps porte
des evenements destines a SC, Python, Processing, DMX.

### Grouper des evenements simultanes dans une definition

Un ensemble d'evenements simultanes qui revient souvent se factorise dans une definition :

```bpscript
@def halo(x) x!tin!ge
@def eclair(x) x!na!ka

S -> halo(C4) eclair(D4) halo(E4)
// Expansion :
// C4!tin!ge D4!na!ka E4!tin!ge
```

### `<!` -- le point d'attente

`<!` attend un signal externe avant de continuer. C'est un point de synchronisation, de
duree zero.

```bpscript
@alphabet.western:audio
@var sync1 in transport.midi

S -> -<!sync1 C4 D4 E4       // attend en silence, puis joue
S -> C4<!sync1 D4 E4         // joue C4, attend, puis continue
S -> <!sync1 C4 D4 E4        // attend seul puis demarre
S -> C4!E4<!sync1 D4 E4      // joue C4 + E4, attend sync1, puis D4
```

`@var <role> in transport.<canal>` nomme dans la scene le **role** que tient l'entree ; les canaux
d'entree sont `midi`, `osc` et `keyboard`. L'appareil qui remplit ce role s'y associe hors de
la scene. L'adresse de la source se colle au point d'attente -- `<!sync1.60` ecoute le numero
60 de l'entree `sync1` -- et les points d'attente se chainent : `<!sync1<!sync2`.

---

## Les trois silences

| Symbole | Nom                   | Duree                       | Ce qu'il fait                             |
| ------- | --------------------- | --------------------------- | ----------------------------------------- |
| `-`     | **silence**           | fixee par le compositeur    | occupe une position, le temps s'ecoule    |
| `_`     | **prolongation**      | etend l'evenement precedent | le son se poursuit sur l'attaque d'avant  |
| `...`   | **repos indetermine** | calculee par le moteur      | le moteur choisit la duree la plus simple |

```bpscript
S -> C4 D4 - E4              // silence explicite : 4 positions, la 3e est vide
S -> C4 _ D4 E4              // prolongation : C4 dure 2 positions
S -> { A B C ..., D E F G }  // repos indetermine : le moteur calcule
```

Le repos indetermine `...` porte la **representation minimale** des structures polymetriques :
le compositeur ecrit les evenements, le moteur calcule les silences qui produisent la
structure temporelle la plus simple.

---

## Period notation `.` -- fragments de duree egale

Le `.` separe une sequence en fragments de **duree symbolique egale**. C'est un mecanisme
fondamental du langage.

```bpscript
S -> A B . C D . E F          // 3 fragments : (A B), (C D), (E F)
S -> { A B . C D, E F G }     // voix 1 : 2 fragments, voix 2 : 3 symboles
```

Le decoupage se construit aussi par derivation, chaque regle apportant sa part :

```bpscript
M1 -> E2 .
M2 -> D2 M1                  // M2 = D2 E2 .
M3 -> B2 M2                  // M3 = B2 D2 E2 .
```

Le point et la virgule sont transmis tels quels au moteur.

**L'espace tranche** : entoure d'espaces, le `.` decoupe la sequence ; colle entre deux noms,
il appelle un composant (`transport.midi`, `<!sync1.60`) -- cf. la section « Conventions de
notation ».

---

## Liaisons `~` -- tied sound-objects

En BPScript, la liaison s'ecrit `~`.

Un son est tenu a travers d'autres evenements. Le NoteOn arrive au debut, le NoteOff a la fin,
par-dessus les sons intercales.

```bpscript
S -> C4~ D4 E4 ~C4            // C4 tenu du debut a la fin
S -> C4~ D4 E4 ~C4~ F4 ~C4    // C4 tenu, avec deux points de suture
```

Syntaxe :
- `C4~` ouvre la liaison : NoteOn au debut
- `~C4~` la continue : le son se poursuit a travers l'evenement
- `~C4` la ferme : NoteOff a la fin

---

## Captures `?` -- pattern matching

**`?` se lit « ce qu'il y a la ».** Il ne nomme rien : il designe une **place**, prend le symbole qui
s'y trouve, et cette place est **consommee**. A droite de la fleche, il rejoue ce qu'il a pris.

**`?n` ajoute « et le meme ailleurs »** : toutes les occurrences de `?1` dans une regle designent le
meme symbole. Le `?` nu prend chaque place independamment.

**Une regle de motif se pose dans une sous-grammaire en substitution** -- c'est la que sa tete peut
etre un terminal, puisqu'elle le reecrit :

```bpscript
@core
@alphabet.western

S -> C4 D4 C4
-----
@mode:sub1
?1 D4 ?1 -> ?1 G4 ?1        //  C4 D4 C4  ->  C4 G4 C4
```

```bpscript
// « quelque chose, puis D4 » devient G4
? D4 -> G4               //  C4 D4     ->  G4

// « quelque chose, D4, la meme chose » devient « cette chose, G4, cette chose »
?1 D4 ?1 -> ?1 G4 ?1     //  C4 D4 C4  ->  C4 G4 C4
```

**Une capture est le SEUL joker du langage** -- les barres `|x|`, elles, ne font que delimiter un
nom de non-terminal.

**Le numero change ce que la regle accepte, pas seulement ce qu'elle rejoue.** Une regle qui ne
s'applique pas laisse la chaine **inchangee** :

```bpscript
// « deux choses quelconques » -- elles peuvent differer
? ?   -> G4              //  C4 D4  ->  G4

// « deux fois la meme chose » -- sinon la regle ne mord pas
?1 ?1 -> G4              //  C4 C4  ->  G4
                         //  C4 D4  ->  C4 D4     inchangee
```

Une capture vaut pour **un** symbole. Une regle en porte jusqu'a 32 numerotees. Le compilateur
les porte jusqu'au moteur.

---

## Les barres `|x|` -- delimiter un nom

**Les barres delimitent le NOM d'un non-terminal.** Elles ne quantifient rien et n'apparient rien :
`|x|` designe le non-terminal appele `x`, ni plus ni moins. Elles servent quand le nom
commencerait par une minuscule, la ou il serait sinon pris pour un terminal.

```bpscript
S -> |a| |b|                //  la regle produit deux non-terminaux
|a| -> C4                   //  C4 D4     chacun se reecrit comme n'importe quelle regle
|b| -> D4
```

**Un nom entre barres est une tete de regle comme une autre** -- il se declare a gauche, il se
reecrit, il disparait de la production. Ce qui apparie *n'importe quel* symbole, ce sont les
captures `?` et `?n`.

Les tables d'homomorphisme, elles, se declarent par `@transcription.<table>` et s'appliquent entre
un gabarit maitre et son esclave -- cf.
[Les gabarits `$` et `&`](#les-gabarits----et------la-structure-dune-production).

---

## Contextes `()` et `#` -- conditions d'application

**La parenthese se lit « quand », le diese se lit « sauf ».**

```bpscript
// « quand E4 suit C4 D4 » : E4 devient F4 G4, et le contexte reste ou il est
(C4 D4) E4 -> F4 G4         //  C4 D4 E4  ->  C4 D4 F4 G4

// « quelque chose sauf C4, puis D4 » devient G4
#C4 D4 -> G4                //  E4 D4     ->  G4
                            //  C4 D4     ->  C4 D4     inchangee
```

**Un contexte REGARDE, il ne PREND pas.** C'est ce qui le separe d'une capture, et elle s'entend a
la resolution :

```bpscript
// « quelque chose, puis D4 » devient « D4, puis cette chose » -- la place est PRISE, donc elle bouge
?1 D4 -> D4 ?1              //  C4 D4  ->  D4 C4

// « quand D4 suit C4 » : D4 devient « D4 puis C4 » -- C4 est REGARDE, donc il reste
(C4) D4 -> D4 C4            //  C4 D4  ->  C4 D4 C4
```

**D'ou une asymetrie.** Une capture peut imiter un contexte -- il suffit de la remettre a
l'identique :

```bpscript
// « quand D4 suit C4 » : D4 devient G4
(C4)    D4 -> G4            //  C4 D4  ->  C4 G4

// « quelque chose, puis D4 » devient « cette chose, puis G4 » -- pris, puis remis a l'identique
?1      D4 -> ?1 G4         //  C4 D4  ->  C4 G4
```

L'inverse est impossible : un contexte ne peut ni deplacer ni retirer ce qu'il regarde. Ce qu'il
apporte en propre, c'est la **garantie que ce qui est entre parentheses ne bougera pas** -- lisible
sans comparer les deux cotes de la fleche.

### Un contexte negatif consomme sa position

**`#X` apparie exactement UN symbole**, qui doit differer de `X`, et il **occupe la position** de ce
symbole. C'est ce qui le separe d'un contexte positif : `(X)` regarde sans prendre, `#X` prend.

```bpscript
@var z1, z2, z3

// « trois choses, sauf K1 K2 K3, puis M M » deviennent « z1 z2 z3 M M »
#K1 #K2 #K3 M M -> z1 z2 z3 M M   //  M K2 K3 K1 M M  ->  M z1 z2 z3 M M
```

Les trois contextes negatifs ont apparie `K2`, `K3` et `K1` -- trois symboles reels, pris dans
l'ordre, position par position.

**La qualite de CONTEXTE vient de la SYMETRIE de la regle** : un symbole ecrit a la meme place
des deux cotes de la fleche (prefixe ou suffixe commun) est du contexte. Differer de `X` et
appartenir au contexte sont deux proprietes independantes -- chacune s'obtient sans l'autre.

### Plusieurs `#` forment un seul « sauf »

**La negation porte sur l'ENSEMBLE, pas sur chaque contexte pris a part.** `#K1 #K2 #K3 M M` se lit « trois
symboles quelconques suivis de M M, **sauf K1 K2 K3** » -- et non « trois symboles dont chacun
differe du sien ».

Le test passe donc des qu'**UN** contexte differe de son nom, et il bloque seulement quand **TOUS**
egalent le leur en meme temps.

### `#K1 #K2 #K3` et `#(K1 K2 K3)` : trois positions ou une seule

**Le groupe ne change pas le nombre d'interdits, il change le nombre de PLACES.**

```bpscript
// TROIS places, une par diese : « trois choses, sauf la suite K1 K2 K3 »
#K1 #K2 #K3 M -> C4        //  W1 W2 K3 M  ->  C4           les quatre places sont prises
                           //  K1 K2 K3 M  ->  K1 K2 K3 M   toutes egalent la leur, inchangee

// UNE place : « une chose qui n'est ni K1, ni K2, ni K3 »
#(K1 K2 K3) M -> C4        //  W1 W2 W3 M  ->  W1 W2 W3 C4  seul M est pris, le reste demeure
```

**La difference se voit a ce qui reste.** La forme a trois dieses **consomme quatre positions** et
ne laisse que `C4` ; la forme groupee n'en consomme qu'**une** -- elle regarde le voisin sans le
prendre -- et laisse les trois autres en place.

### Silence et prolongation

`-` (silence) et `_` (prolongation) sont des voisins comme les autres : ils s'emploient en contexte
negatif, ou le symbole se colle au `#` -- `#-`, `#_`.

```bpscript
// « quelque chose qui n'est pas un silence, puis V1 »
#- V1 <> #- -

// « quelque chose qui n'est pas une prolongation, puis M » devient C4
#_ M -> C4
```

---

## Les gabarits `$` et `&` -- la structure d'une production

**Un gabarit est une production dont les terminaux sont effaces.** Ce qui reste est sa structure :
les groupes, leur appariement, les echelles de vitesse, les fragments. Le meme mecanisme sert a
deux echelles -- dans une regle, pour capturer un motif et le rejouer ; en catalogue, pour enumerer
les formes qu'une grammaire autorise.

### Capturer et rejouer, dans une regle

`$` capture un motif de groupe (maitre), `&` le rejoue (esclave). Le nom porte l'appariement entre
les deux.

```bpscript
S <> $mel &mel                            // $mel capture, &mel rejoue
S <> $mel(tempo:120) &mel(tempo:80)       // chaque invocation porte ses parametres
S -> ${$X S &X} &{$X S &X}                // capture d'un groupe entier
```

**L'esclave rejoue le CHOIX du maitre, pas la regle.** Quand le nom capture designe une regle a
plusieurs alternatives, les deux invocations donnent la **meme** -- c'est ce qui distingue un
gabarit de deux invocations libres :

```bpscript
S -> $mel &mel      // deux productions possibles : les deux moities sont toujours identiques
S -> mel mel        // quatre : chaque moitie tire son alternative
```

Les parametres d'une invocation gouvernent l'expansion du gabarit : ils valent pour ce que cette
invocation produit.

### Ancre de gabarit maitre : `$` seul en tete de LHS

Un `$` suivi d'une espace, en tete du membre gauche, marque la regle entiere comme gabarit maitre :
il ancre la regle.

```bpscript
$ S -> C4 D4
```

L'arbre porte `lhs = [TemplateAnchor{kind:"master"}, Symbol{S}]`. L'espace tranche entre les deux
emplois du signe : colle a un identifiant, `$X` nomme une capture ; suivi d'une espace, `$` ancre --
cf. l'espace, delimiteur de termes. L'ancre reste ouverte jusqu'a sa fermeture.

### Tables de substitution

Les tables de substitution vivent dans `lib/sub.json`, une par nom, chacune avec ses sections.
`@sub.<nom>` invoque une table :

```bpscript
@sub.dhati

S -> $N14 &N14
```

Un nom absent de la librairie est refuse au parse.

### `@template` -- le catalogue des formes

**Le catalogue porte les memes gabarits, un par ligne.** Le moteur derive une production, en efface
les terminaux, et ecrit ce qui reste : c'est le meme geste que `$mel`, applique a une production
entiere plutot qu'a un groupe. La section se place apres les regles, en fin de scene.

```bpscript
@alphabet.western

S -> C4 D4

@template
[1] /1 ??
[2] *3/2 ?.?
[3] /1 ($0 ?)($1 )
```

Une entree s'ecrit `[<rang>] <echelle> <forme>` :

- `<rang>` -- la place de l'entree dans le catalogue, entre crochets.
- `<echelle>` -- `/N` ou `*N/M`, `/1` quand elle est omise.
- `<forme>` -- des jokers `?`, un par terminal efface ; des points `.` (fragments de duree egale) ;
  des groupes appariees `($N ...)`, imbricables -- les memes maitres et esclaves que dans une regle.

**Le catalogue s'enumere.** Le moteur explore les formes que la grammaire permet et les ecrit ici :
une grammaire de quinze regles peut en produire seize, parce que les variantes de vitesse se
croisent avec celles des non-terminaux. Le rang est la place dans cette enumeration, et c'est lui
que l'analyse rend pour dire quelle forme a repondu.

Le mode `tem` fait l'appariement structurel sur ce catalogue, dans l'ordre des rangs. Il s'ecrit en
tete de scene ou en suffixe de regle.

```bpscript
@alphabet.sargam
@mode:tem

S -> sa re ga

@template
[1] /1 ???
```

---

## Heritage par cascade

Une propriete se resout par cascade : plusieurs niveaux la posent, du plus
general au plus specifique, et le niveau le plus specifique qui la mentionne
l'emporte. La fusion se fait **champ par champ** -- un niveau qui laisse un
champ de cote laisse passer celui du dessous. Chaque niveau ecrit donc
uniquement ce qu'il change, et l'ecriture est la meme partout : on pose la
propriete au niveau ou on veut qu'elle change.

### Les composants d'un acteur

Les cinq cles d'un acteur (`alphabet`, `tuning`, `octaves`,
`transport`, `eval`) cascadent de la scene vers l'acteur. Une scene qui nomme
son alphabet tient les autres de la cascade :

```bpscript
@alphabet.sargam

S -> sa re ga
```

L'acteur de scene resolu prend l'alphabet `sargam`, le registre `saptak`,
l'accordage `sargam_12TET`, le canal `audio` et un diapason de 240 Hz :
l'entree `sargam` de `lib/alphabets.json` porte la convention de registre,
l'accordage par defaut et l'ancre de hauteur, et l'acteur en herite.
`@actor X octaves.Y` change le registre pour cet acteur ; les autres cles
restent celles heritees.

### Les reglages `()`

Un reglage cascade des defauts de la librairie du symbole vers la valeur
ecrite a l'occurrence, puis vers l'objet temporel continu qui le pilote
(`spec < CT < signal`) -- cf. l'heritage par cascade.

```bpscript
@alphabet.sargam

S -> sa sa(vel:120)          // sa prend le defaut de librairie, puis 120
```

### La vitesse d'un bloc

`[*N]` multiplie la vitesse heritee du contexte englobant ; `[/N]` pose une
vitesse absolue -- cf. les operateurs temporels.

```bpscript
S -> {A B}:2 C
```
## Conventions de notation — l'espace, le point, le deux-points

Trois signes structurent toute l'écriture : l'**espace** sépare les termes, le **point**
désigne un élément dans un espace de noms, le **deux-points** lie un sujet à une valeur.
Ils gardent le même sens dans la partie déclarative et dans le flux.

### Tableau des signes

| Signe      | Sens                                      | Exemple                                           |
| ---------- | ----------------------------------------- | ------------------------------------------------- |
| espace     | sépare deux termes                        | `@def souffle (vel:60)`                           |
| collage    | réunit deux termes en un seul             | `@def accent(x) x(vel:120)`                       |
| `.`        | désigne un élément dans un espace de noms | `lpf1.cutoff`, `alphabet.tabla`, `transport.midi` |
| `:`        | lie un sujet à une valeur                 | `dha:midi`, `@time.tempo:120`, `(vel:100)`        |
| `*`        | sujet = tous les terminaux                | `*:vel:80`                                        |
| `()`       | réglages ; le domaine de la clé adresse   | `sa(vel:80)`, `(mode:random)`, `(tuning:just)`    |
| `[]`       | ce qui appartient a la derivation         | `[phase==1]`, `[phase=2]`, `[3]` dans `@template` |
| `@`        | ouvre une ligne de la partie déclarative  | `@actor`, `@alphabet.tabla`, `@def`               |
| `->`       | règle de production                       | `S -> C4 D4`                                      |
| `>>` `\>>` | brancher un câble, le couper              | `saw >> lpf >> audio`                             |

### L'espace, délimiteur de termes

Une espace sépare deux termes ; leur **collage** en fait un seul. Partout où deux termes
peuvent se suivre, le collage porte une information et le langage la lit.

| Écriture                    | Lecture                                                   |
| --------------------------- | --------------------------------------------------------- |
| `@def accent(x) x(vel:120)` | `(x)` collé au nom = liste de paramètres de la définition |
| `@def souffle (vel:60)`     | `(vel:60)` séparé du nom = corps de la définition         |
| `C4(vel:80)`                | qualificateur du terminal `C4`                            |
| `C4 D4 (mode:random)`       | qualificateur de la règle entière                         |
| `C4!(vel:100)`              | flux ancré à `C4`, il voyage avec lui (`conjoint: true`)  |
| `C4 !(vel:100)`             | flux posé seul dans la séquence (`conjoint: false`)       |
| `{C4 D4}:2`                 | durée du groupe                                           |
| `sitar.sa`                  | le terminal `sa` vu à travers l'acteur `sitar`            |
| `C4 D4 . E4 F4 G4`          | point isolé = frontière entre fragments de durée égale    |

```bpscript
@alphabet.western
@def accent(x) x(vel:120)
@def souffle (vel:60)

S -> C4!accent D4 (mode:random)
Motif -> {C4 D4}:2 E4:0.5
```

### Le point — désigner dans un espace de noms

`espace.nom` nomme un élément à l'intérieur d'un espace. Les espaces de noms sont les
catégories de librairie (`alphabet`, `tuning`, `octaves`, `transport`, `eval`,
`module`), les acteurs et les instances de module avec leurs ports.

| Emploi                                                    | Écriture                                                  |
| --------------------------------------------------------- | --------------------------------------------------------- |
| entité de librairie                                       | `alphabet.sargam`, `tuning.sargam_22shruti`, `module.lpf` |
| directive qui charge une entrée d'un fichier de librairie | `@alphabet.tabla`, `@sub.dhati`                           |
| terminal vu à travers un acteur                           | `sitar.sa`                                                |
| port d'un module                                          | `lpf.cutoff`                                              |
| frontière entre fragments, point isolé                    | `C4 D4 . E4 F4 G4`                                        |

Les cinq clés d'un acteur — `alphabet`, `tuning`, `octaves`, `transport`, `eval` — sont des
références : chacune s'écrit avec le point, sur sa ligne.

```bpscript
@alphabet.sargam
@actor sitar
  alphabet.sargam
  tuning.sargam_22shruti
  transport.midi(ch:3, vel:100)

S -> sitar.sa sitar.re sitar.ga
```

### Le deux-points — lier un sujet à une valeur

Le sujet est à gauche du signe, la valeur à droite.

| Emploi                                     | Écriture                     |
| ------------------------------------------ | ---------------------------- |
| affecter une sortie à un terminal          | `dha:midi`                   |
| affecter une sortie au sujet par défaut    | `*:midi`                     |
| poser une propriété sur un nom qui existe  | `@alphabet.tabla:midi`       |
| réglage global de scène                    | `@time.tempo:120`            |
| paire clé-valeur dans `()`                 | `(vel:100)`, `(mode:random)` |
| durée, collée à un terminal ou à un groupe | `C4:2`, `{C4 D4}:2`          |

```text
@alphabet.tabla:midi
@time.tempo:120

S -> dha ti (mode:random)
```

### Deux formes déclaratives : créer un nom, poser une propriété

Toute ligne de la partie déclarative s'ouvre par l'arobase, et la présence du deux-points
dit laquelle des deux formes on écrit.

| Forme                         | Effet                                             |
| ----------------------------- | ------------------------------------------------- |
| `@<directive> <nom> <valeur>` | **crée** un nom                                   |
| `@<directive> <nom>:<cible>`  | pose une **propriété** sur un nom qui existe déjà |

```bpscript
@alphabet.western:midi                     // propriété : les terminaux de western sortent en MIDI
@def env1 mod.adsr(attack:10, decay:200) // déclaration : env1 est un nom neuf

S -> C4 D4
```

### `*` — le sujet par défaut

En position de sujet, `*` désigne tous les terminaux du territoire où il est écrit :
`*:midi` donne une sortie à l'alphabet entier, et chaque terminal nommé ensuite l'affine —
c'est l'héritage par cascade.

### Séparation des territoires

- **Déclarer** — `@alphabet.X`, `@actor X`, `@var`, `@def` : ce que l'on écrit une
  fois et que l'on réutilise.
- **Affecter** — `*:midi`, `Y:osc` : depuis le territoire d'origine du sujet,
  c'est-à-dire l'alphabet ou l'acteur où il est déclaré, ou l'occurrence dans une règle.

---

## Flags — variables d'état et composition conditionnelle

Un flag est une variable entière globale. Il conditionne l'application des règles et se
modifie pendant la dérivation. Les neuf opérateurs qui le lisent et l'écrivent sont listés dans
« Inventaire » ; cette section dit ce qu'ils font.

### `[garde]` — condition d'application

Écrite devant le membre gauche, la garde décide si la règle existe pour cette dérivation.

**Test** (opérateur de comparaison) :

```bpscript
@alphabet.sargam
[phase==1] S -> sa re ga pa       // active quand phase vaut 1
[count>3]  S -> ga pa             // active quand count dépasse 3
```

**Test et mutation** (opérateur arithmétique) :

```bpscript
@alphabet.sargam
[Ideas-1] S -> Motif S            // décrémente Ideas, active tant qu'il reste positif
[NumR+1] S -> S                   // incrémente NumR, active tant qu'il reste positif
Motif -> sa re ga
```

**Dans la garde, `+` et `-` testent d'abord et mutent ensuite, dans cet ordre.** `[count-1]` rend la
règle candidate tant que `count` est strictement positif ; le décrément s'applique après, au moment
où la règle est retenue. Le drapeau vaut donc encore sa valeur d'avant pendant tout le test, et
`[count+1]` demande lui aussi un `count` strictement positif.

**Un nom de drapeau seul teste qu'il vaut autre chose que zéro** : `[Ideas] S -> C4`.

La garde est déclarative : la règle **existe** quand la condition est vraie.

Les neuf à l'œuvre dans une scène :

```bpscript
@core
@alphabet.western:audio

S -> Loop [phase=1, count=4]

-----

@mode:random
[count-1]  Loop -> C4 Loop
[count>0]  Loop -> D4 Loop
[count>=2] Loop -> E4 Loop
[count<9]  Loop -> F4 Loop
[count<=9] Loop -> G4 Loop
[phase!=0] Loop -> A4 Loop [phase+1]
[count==0] Loop -> C5
```

### `[]` — mutation d'état en fin de règle

Une mutation s'écrit en suffixe, en fin de règle. Elle est **hors-temps** : elle s'applique
au déclenchement de la règle, pendant la dérivation ; sa position se lit dans la règle, la
séquence jouée reste inchangée.

```bpscript
@alphabet.sargam
S -> Motif Cadence [count-1]                 // une mutation
S -> Motif Motif [phase=1] [count=2]         // plusieurs mutations
Motif -> sa re
Cadence -> ga pa
```

`=` ne s'écrit qu'en fin de règle ; pour comparer un drapeau devant le membre gauche, l'opérateur
est `==`.

Le délimiteur distingue deux écritures voisines : `!dha` est un `!` suivi d'un symbole, donc
un déclenchement dans le temps ; `[phase=2]` est entre crochets, donc une mutation de flag.

### Exemple : une pièce en trois phases

```text
@alphabet.sargam
@time.tempo:60

[phase==1] S -> alap S
[phase==2] S -> jor S
[phase==3] S -> jhala

alap -> sa _ re _ ga _ [phase=2]
jor -> {sa re ga pa}:2 [phase=3]
jhala -> {sa re ga pa dha ni sa}:4
```

---

## Déclarations

### Déclarer un symbole : convention de lecture et sortie

Une déclaration donne à un symbole sa convention de lecture — `pitch`, `phase`, `logic`, ou
aucune — et la sortie qui le prend en charge. La convention s'écrit avec `@var` et `@def` (cf.
« `@var` — déclarer une variable ») ; la sortie se pose sur l'alphabet ou sur l'acteur.

```bpscript
@alphabet.sargam:audio           // les terminaux de sargam sortent par l'audio
@alphabet.tabla:osc              // ceux de tabla sortent par l'OSC

S -> sa dhin
```

### Un seul espace de noms

Les noms de toutes les sortes de choses vivent dans le **même espace** : terminaux de
l'alphabet actif, têtes de règle, définitions, entrées, acteurs, variables de travail,
signaux, drapeaux. Chaque nom y appartient à **une seule** d'entre elles. Le contrôle a
lieu **à la déclaration** : c'est le fait de déclarer le nom qui tranche, son emploi dans
une règle étant une autre affaire.

Deux énoncés, tous deux globaux :

1. une **tête de règle** porte un nom qui lui appartient en propre parmi toutes les sortes
   ci-dessus ;
2. deux déclarations qui **créent** un nom en portent chacune un différent.

Le critère est l'**effet** de la ligne : entre dans la règle ce qui crée un nom. Une écriture
qui pose une propriété sur un nom existant (`dha:midi`) laisse ce nom à sa sorte
d'origine et reste libre.

Les têtes de règle se rencontrent librement **entre elles**. Une tête répétée est une
**alternative** : le choix et les poids en découlent, et c'est le mécanisme même d'une
grammaire stochastique. Deux sous-grammaires sont des **passes successives** — un même nom y
est le même symbole, réécrit plus tard.

**Renommer en gardant la même musique** : `test/migration_noms.mjs` renomme un nom et tous ses
emplois, puis compare l'arbre dérivé entier avant et après, à graine fixe. Il écrit quand
chaque jeton coïncide.

### Câbler : `>>` et `\>>`

`>>` branche, `\>>` coupe. Le câblage initial s'écrit dans `@init`. Un chaînage nommé se déclare
avec `@def`, et son nom se pose **nu** dans le flux ; le compilateur marque alors cet élément de la
nature « câblage », que l'aval traite comme telle.

```text
@alphabet.western
@var saw1 saw
@var lpf1 lpf

@init
  saw1 >> lpf1 >> audio

@def ouvre lpf1.cutoff:12000
@def coupe saw1 \>> lpf1

S -> C4 ouvre D4 coupe E4
```

Le même traitement vaut pour les trois gestes qui agissent sur un module : brancher, couper,
régler.

**Un nombre devant les chevrons donne la largeur du câble** — `8>>` relie huit voix d'un coup.
Sans nombre, le câble en porte une.

```text
@init
  saw1 8>> lpf1 8>> audio     // huit voix jusqu'à la sortie
  lfo1 >> lpf1.cutoff         // une seule voix pilote la coupure des huit
```

**Une inadéquation de largeur s'adapte, elle n'échoue jamais** : un port à une voix prend la
première, un port à plusieurs voix alimenté en une seule diffuse cette valeur sur toutes, et une
largeur écrite qui dépasse ce que le port accepte se ramène à ce nombre. Ce que chaque port accepte
se lit dans son champ `voices`.

**Le corps d'un `@def` de câblage est écrit dans le langage de patch**, celui-là même que porte un
backtick `patch:`. Un câblage qu'on ne réinvoque pas s'écrit donc **littéralement dans la règle** :

```text
S -> C4 `patch: saw1 \>> lpf1` D4
```

Un seul langage, deux emplacements : nommé dans un `@def`, littéral dans un backtick. Le backtick
y entre comme terminal, et un terminal se pose dans une règle.

---

## Les librairies

**Le langage connait la mecanique ; les librairies apportent tout le reste.** Un moteur sait
deriver une grammaire, instancier un module, relier des ports, echantillonner un signal. Il ne
connait ni le sargam, ni ce qu'est un filtre passe-bas, ni comment une enveloppe se calcule : ces
choses vivent en librairie, avec leur description **et leur code**.

### Invoquer

**`@core` apporte le socle.** Une scene qui l'ecrit recoit les librairies de base et leurs valeurs
par defaut, comme un fichier C inclut son en-tete. Une scene qui ne l'ecrit pas n'a **aucun defaut**,
et ce qu'elle emploie se heurte a des noms inconnus : c'est le comportement attendu, pas une faute.

**La directive nomme la librairie, le point designe l'entree.**

```text
@alphabet.sargam:midi        // l'entree `sargam` de la librairie des alphabets, raccordee au MIDI
@tuning.sargam_22shruti      // l'accordage des degres
@octaves.saptak              // la convention de registre
@module.lpf                  // un module de signal
```

**Le deux-points affecte une valeur** — pour un alphabet et ses terminaux, c'est le runtime de
sortie, pris parmi `audio`, `midi` et `osc`.

**La notation pointee n'est obligatoire qu'en cas d'homonymie.** `@tempo:120` suffit tant qu'une
seule librairie invoquee porte ce nom ; on ecrit `@time.tempo:120` le jour ou deux le portent.
La categorie dit alors a quoi le reglage touche.

### Le prefixe est optionnel -- un nom se resout par unicite

**Un nom nu passe s'il n'existe que dans une seule librairie invoquee.** S'il est porte par deux,
la compilation s'arrete et **nomme les deux candidats** : on ne prefixe que ce cas.

```text
(cutoff:4000)          // un seul catalogue porte `cutoff` -- il passe nu
(time.tempo:120)       // on prefixerait si deux librairies portaient `tempo`
```

**L'ambiguite n'a jamais de gagnant implicite** -- ni le premier invoque, ni le dernier. Un ordre
d'appel rendrait une ligne dependante de ce qui la precede : en session, invoquer une librairie
changerait le destinataire d'une ligne qu'on n'a pas touchee. La resolution est **statique**.

Une librairie neuve peut rendre ambigu du code qui compilait : le message nomme les deux candidats
et l'auteur choisit. Le prefixe reste ecrivable partout, y compris la ou un nom nu suffirait.

### Ce qu'une librairie contient

**Des objets conformes a un prototype.** Un alphabet collectionne des terminaux ; une librairie de
modules collectionne des modules, chacun avec ses ports. Le prototype dit quels champs un objet porte,
et un champ n'existe que si sa notion s'applique.

**Un objet porte son code.** Un module y decrit son traitement, pas seulement ses ports. C'est ce
qui permet au moteur de rester vide de toute specificite : ajouter un filtre n'ajoute pas une ligne
au moteur, il ajoute une entree a une librairie.

**Une entree introuvable est nommee** : `@alphabet.raga` repond « alphabet 'raga' introuvable dans
le catalogue ». Rien ne se resout par defaut en silence.

### Deux origines, trois moments

Une librairie est **native** — livree avec le produit — ou **ecrite par l'utilisateur**. Les deux
ont la meme forme ; seul le moment de leur compilation differe.

| moment                          | ce qui s'y passe                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| a la construction du produit    | les librairies natives sont **precompilees**                                                       |
| a la validation d'une librairie | l'utilisateur enregistre la sienne, elle est **compilee la**, et il voit ses erreurs immediatement |
| au lancement d'une scene        | **rien ne se compile** : on charge ce qui l'est deja                                               |

**Le lancement d'une piece ne compile rien.** Une erreur d'ecriture se dit a l'auteur pendant qu'il
ecrit, jamais au moment de jouer.

## Le temps

**Cinq choses se disent sur le temps, et chacune a son ecriture.**

| Ce qu'on veut dire                    | Comment ca s'ecrit                    |
| ------------------------------------- | --------------------------------------- |
| l'horloge de la scene                 | `@tempo:120`, en tete                 |
| ce que dure un element ou un groupe   | le deux-points colle -- `C4:0.5`      |
| accelerer ou ralentir a partir d'ici  | `! (/2)`, dans le flux                |
| est-ce que ca pulse                   | `@striated` · `@smooth`               |
| comment on bat                        | `@meter:4/4`                          |

### L'horloge -- `@tempo`

**Le tempo se pose en tete de scene, en battements par minute.** C'est l'horloge, celle qu'on
partage avec le monde exterieur : elle vaut pour la piece entiere.

```bpscript
@tempo:120
```

Ce qui varie d'un passage a l'autre est une **vitesse**, et elle a sa propre ecriture.

### La duree -- le deux-points colle

**Le deux-points colle dit ce qu'un element occupe**, en battements. Il ne touche que son hote :
ce qui l'entoure garde sa duree.

```bpscript
S -> C4:2 D4 E4              // C4 occupe deux battements, D4 et E4 un chacun
S -> C4:0.5 D4 E4            // C4 occupe un demi-battement
S -> {C4 D4}:2 E4            // le groupe occupe deux battements
```

**Un groupe polymetrique pose la meme contrainte, sur plusieurs voix** : `{2, C4 D4, E4}` dit que ce
bloc occupe deux battements, et chaque voix s'y arrange.

### La vitesse -- `! (/N)` dans le flux

**La vitesse se pose dans le flux et court jusqu'a la fin du champ.** Elle s'ecrit avec `!` separe
par une espace, comme tout element pose seul dans la sequence.

```bpscript
S -> C4 ! (/2) D4 E4         // D4 et E4 vont deux fois plus vite, C4 garde sa duree
S -> C4 ! (/2) D4 ! (/1) E4  // seul D4 est accelere ; /1 restaure la vitesse d'origine
```

**`/N` accelere, `*N/M` ecrit la fraction inverse.** `/2` va deux fois plus vite ; `*2/3` etire de
moitie plus. Les deux graphies disent la meme chose : `*1/2` **est** `/2`.

### La nature du temps -- `@striated` et `@smooth`

**Le temps strie pulse ; le temps lisse coule.** L'un donne une grille de battements que le
metronome engendre, l'autre laisse chaque objet porter sa propre duree.

```bpscript
@striated                    // la musique occidentale, la danse
@smooth                      // un alap, un gagaku, une musique non pulsee
```

C'est la distinction de Boulez (*Penser la musique aujourd'hui*, 1963), et le langage l'ecrit d'un
mot.

### Le battement -- `@meter`

**Le metre dit comment on bat.** Il s'adresse a qui joue et a qui affiche : quatre temps par mesure,
sept croches, ou un cycle inegal.

```bpscript
@meter:4/4                   // quatre temps
@meter:7/8                   // sept croches
@meter:3+4+2/4               // un cycle de neuf temps, battu 3 puis 4 puis 2
```

**La forme additive structure aussi la production** : elle decoupe le cycle en groupes inegaux et y
repartit ce qui est derive. C'est ce qui permet un rupak a sept temps, un jhaptal a dix, une
metrique balkanique.


## Modes, scan et directions -- trois niveaux distincts

| Niveau             | Question                             | BPScript         | Portee              |
| ------------------ | ------------------------------------ | ---------------- | ------------------- |
| **Mode du bloc**   | quelle strategie de selection ?      | `(mode:random)`  | bloc/sous-grammaire |
| **Scan par regle** | dans quel sens chercher le symbole ? | `(scan:left)`    | regle individuelle  |
| **Direction**      | la regle se lit dans quel sens ?     | `->`, `<-`, `<>` | regle individuelle  |

Le mode vaut pour un bloc : il s'ecrit `@mode:<valeur>` en tete de scene, ou `(mode:<valeur>)` en
suffixe de regle. Le scan prend `left`, `right` ou `rnd`.

| Mode      | Strategie de selection                           |
| --------- | ------------------------------------------------ |
| `ord`     | ordonne -- la premiere regle applicable gagne    |
| `random`  | aleatoire -- selection ponderee par les poids    |
| `lin`     | lineaire -- bouclage cyclique                    |
| `sub`     | substitution -- toutes les occurrences a la fois |
| `sub1`    | substitution -- l'occurrence la plus a gauche    |
| `tem`     | appariement par gabarit                          |
| `poslong` | la plus longue correspondance d'abord            |

**En mode `sub` et `sub1`, les symboles du membre gauche sont eux aussi des terminaux** : ce qui
reste apres les iterations appartient a l'alphabet et se joue.

| Direction | Sens                                                            |
| --------- | --------------------------------------------------------------- |
| `->`      | **production** -- le membre gauche est reecrit en membre droit  |
| `<-`      | **analyse** -- la sequence droite est reduite au symbole gauche |
| `<>`      | **production et analyse** -- la regle vaut dans les deux sens   |

```bpscript
@alphabet.sargam
@mode:random
S -> sa re (scan:left)
S <- ga ma
S <> pa dha
```

---

## Gestion d'echec -- `on_fail`

Trois strategies : `skip`, `retry(N)`, `fallback(X)`. La strategie de scene s'ecrit
`@on_fail:<strategie>` ; la forme avec argument s'ecrit en suffixe de regle.

```bpscript
@alphabet.sargam
@on_fail:skip                              // strategie de scene
S -> sa re ga (on_fail:retry(3))           // cette regle : reessayer 3 fois
T -> ma pa (on_fail:fallback(ALT))         // cette regle : basculer vers ALT
ALT -> dha ni
```

---

---

## Le temps -- formes avancees

**Cette section porte ce qu'on ecrit rarement.** Les cinq ecritures ci-dessus suffisent a jouer ;
celles-ci existent pour ce qu'elles seules permettent.

### La duree de la scene

**Fixer l'enveloppe totale et laisser le contenu s'y dilater.** La scene occupe la duree ecrite, et
ses proportions internes sont preservees.

```bpscript
@engine.duration:16b         // seize battements au tempo courant
@engine.duration:8s          // huit secondes
```

Trois choses s'y separent : la **densite** vient du contenu, la **duree** de cette ecriture, la
**vitesse** du tempo.

### Les motifs temporels

**Une courbe de temps plutot qu'une pulsation reguliere.** Un motif temporel decrit comment le temps
s'ecoule sur une etendue, la ou le tempo n'en donne qu'une valeur.

### La vitesse absolue

**Poser un nombre d'evenements par battement**, au lieu d'un rapport a la vitesse heritee.

### La deviation aleatoire

**Humaniser les attaques** en les decalant d'une amplitude ecrite. Elle appartient a l'oeuvre : ce
qu'elle produit fait partie de ce qu'on a compose.

```bpscript
S -> C4 (rndtime:100) D4 E4  // les attaques devient jusqu'a cent millisecondes
```

---


## Documents liés

- [EBNF.md](EBNF.md) — grammaire formelle EBNF
- [AST.md](AST.md) — structure de l'AST
- [ARCHITECTURE.md](../design/ARCHITECTURE.md) — architecture technique
- [CV.md](../design/CV.md) — objets de signal
- [PITCH.md](../design/PITCH.md) — architecture 5 couches de hauteur
- [HOMOMORPHISMS.md](../design/HOMOMORPHISMS.md) — homomorphismes

