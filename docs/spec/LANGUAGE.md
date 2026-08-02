# BPScript Language Specification

## Table des matieres

- [Principe fondamental](#principe-fondamental)
- [Le langage : dense, pas simple](#le-langage--dense-pas-simple)
- [Concepts cles](#concepts-cles)
- [Philosophie de separation](#philosophie-de-separation)
- [L'ordonnanceur](#lordonnanceur)
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
- [Templates : regime catalogue](#templates--regime-catalogue)
- [Sons et cascade d'heritage](#sons-et-cascade-dheritage)
- [Conventions de notation (`.` / `:` / `*`)](#conventions-de-notation-----)
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

BPScript est un **ordonnanceur** : il derive des structures temporelles par grammaires
formelles et decide **quand** se declenchent des comportements ecrits dans d'autres langages
(SuperCollider, TidalCycles, Python).

Les symboles sont des noms avec un double contrat :
- **Type temporel** : comment ils se comportent dans le temps (gate, trigger, cv)
- **Runtime** : qui les manipule (sc, tidal, python, midi...)

Le langage connait trois mots et fait une chose : ordonner dans le temps.

---

## Le langage : dense, pas simple

3 mots reserves, 24 symboles, 9 operateurs de flags -- le vocabulaire est petit et la
combinatoire est riche. Comme les echecs : 6 types de pieces, complexite infinie.

```bpscript
@core
@controls
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
| scene     | ce dont heritent tous les acteurs                | `@alphabet.sargam`, `@tempo:90`            |
| acteur    | ce que cet acteur emploie                        | `@actor sitar1` + `tuning.sargam_22shruti` |
| regle     | ce qui vaut pour toute la production             | `S -> sa re (vel:70)`                      |
| terme     | ce qui vaut pour ce terme                        | `sa(vel:100)`                              |

```bpscript
@core
@controls
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
| `sa(vel:100)`          | les parentheses collees portent le controle sur `sa`                         |
| `S -> sa re (vel:70)`  | les parentheses separees, en fin de regle, portent sur toute la regle        |
| `pa:2`                 | le `:` colle fixe la duree du terme ; separe (`pa :2`), la ligne est refusee |
| `{re ga}:2`            | le `:` colle fixe la duree du groupe                                         |
| `S -> sa re [phase=1]` | le crochet separe, en fin de regle, mute un drapeau                          |
| `sitar1.sa`            | le point colle qualifie `sa` par l'acteur `sitar1`                           |
| `sa . re`              | le point separe decoupe la sequence en fragments de duree egale              |
| `taar_sa`              | le separateur de registre colle le marqueur au nom de note                   |
| `sa!(vel:70)`          | le `!` colle ancre le controle sur `sa` : il voyage avec lui                 |
| `sa !(vel:70)`         | le `!` separe pose le controle seul dans la sequence                         |
| `<!depart`             | le point d'attente et le nom qu'il attend forment un seul terme              |

```bpscript
@core
@controls
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

Un backtick porte du code ecrit dans le langage d'un autre moteur. Le tag en tete (`sc:`, `py:`,
`tidal:`, `strudel:`, `hydra:`...) nomme l'interprete.

Il prend deux formes :

- **autonome** -- le backtick occupe une position a lui seul et joue son code quand la derivation
  l'atteint. En tete de scene, il prepare le moteur au chargement ; dans le flux d'une regle, il
  est un terminal de plein droit et joue a son instant. Son tag est requis, ou bien un acteur
  `eval.<moteur>` le qualifie par le point.
- **inline** -- le backtick occupe un parametre et rend une valeur, evaluee par le runtime du
  symbole qui le porte ; il herite du tag de ce symbole.

```bpscript
@core
@controls
@alphabet.sargam

// Autonome, en tete de scene : prepare le moteur au chargement
`sc: SynthDef(\grain, { |freq, dens| GrainSin.ar(dens, freq) }).add`

// Autonome dans le flux : joue son code a son instant, comme une note
// Inline dans un parametre : evalue par le runtime du symbole
S -> sa(vel:`rrand(40,127)`) `sc: i = i + 1` re
```

### Simultaneite `!` et synchronisation `<!`

`!` marque l'instant : ce qu'il porte ne prend aucun pas dans la sequence. Il a deux emplois, et
c'est ce qui **suit** le `!` qui decide duquel il s'agit.

**Entre deux termes**, il les place au meme instant : `sitar1.sa!tin!na` produit trois evenements
sur une seule attaque, et le premier terme donne la duree du groupe.

**En tete d'un terme**, il pose dans le flux un element sans duree, qui prend effet a l'endroit ou
il est ecrit : un controle de sortie `!(vel:80)`, un reglage moteur `![retro]`, une re-semence
`![@seed:7]`, un cablage. La table complete des lectures du `!` est dans
[Table de syntaxe du `!`](#table-de-syntaxe-du-).

`<!` suspend le flux jusqu'a l'arrivee d'un signal exterieur. Le nom attendu se colle au signe.
Ecrit apres une note, il s'ancre sur elle : la note sonne, puis la suite attend.

```bpscript
@core
@controls
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

| mot | ce qu'il fait |
| --- | --- |
| `@actor` | declare **qui joue** : un acteur, son alphabet, sa sortie |
| `@var` | declare **une variable** : un nom qui porte une valeur ou un etat |
| `@def` | declare **une definition** : un nom associe a un corps qu'on reinvoque |
| `@init` | declare **l'etat de depart** de la scene |

### `@var` -- declarer une variable

Une variable porte un **type** qui dit ce qu'elle est. Le type se place entre le mot et le nom.

```text
@var flag section: calm:1, full:2
@var in touches transport.keyboard
@var signal grain
@var pitch hauteur
@var phase rotation
@var logic porte
@var wire principal saw >> lpf >> audio
@var pivot
```

| type | ce que la variable porte |
| --- | --- |
| `flag` | un etat entier, avec ses valeurs nommees ; les regles s'y conditionnent |
| `in` | une valeur qui vient du dehors : un **role**, son canal, sa table de correspondance |
| `signal` | un flux de nombres, sans convention de lecture — le cas ordinaire |
| `pitch` | un signal lu comme une **hauteur** |
| `phase` | un signal lu comme une **position dans un cycle**, entre 0 et 1 : ce qui depasse **s'enroule** |
| `logic` | un signal lu comme un **etat haut ou bas**, dont ce sont les **transitions** qui font evenement |
| `wire` | un cablage nomme : une chaine de modules qu'on rebranche d'un mot |
| *(aucun)* | un symbole du flux qui n'est ni une note ni un nom de regle |

**Le flag declare ses etats en meme temps que lui-meme.** `calm:1, full:2` nomme deux valeurs
entieres ; une regle s'y conditionne ensuite par son nom : `[section==calm]`.

**Le role d'une entree ne nomme jamais un appareil.** La scene declare `touches` ; l'utilisateur
associe le clavier reel, et cette association vit **hors de la scene** -- un nom de port change de
machine en machine. Le flux attend un geste de ce role avec le point d'attente : `<!touches.Space`.

**Une variable sans type** existe pour etre ecrite dans une regle sans sonner : un pivot de
grammaire, un jalon de structure.

### `@def` -- declarer une definition

`@def` associe un nom a un corps, pour le reinvoquer d'un mot. Ses types sont ceux des signaux : `signal`, `pitch`, `phase`, `logic`.

```text
@def souffle lfo:2 >> filtre.cutoff
@def cadence sa re ga pa
@def phase enveloppe `js: (t, dur) => 1 - t / dur`
```

Ce qu'une definition peut porter : une structure de terminaux, un branchement, du code, un signal.
**Ce qui se definit est ce qui se reinvoque** -- un fil isole entre deux points ne se definit pas,
puisqu'on ne le rejoue jamais seul.

### `@init` -- l'etat de depart

`@init` porte ce qui existe au demarrage de la scene et n'appartient a aucune declaration : le
branchement initial, le code lance une fois, les valeurs de depart.

```text
@init
  saw >> lpf >> audio
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

| cle | ce qu'elle fixe |
| --- | --- |
| `alphabet` | la collection de terminaux que l'acteur joue |
| `tuning` | l'accordage qui donne une frequence a chaque degre |
| `octaves` | la convention de registre |
| `transport` | par ou l'acteur sort : `audio`, `midi`, `osc` |
| `eval` | le langage par defaut de ses backticks, quand le backtick ne le nomme pas |

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

Un module est un **patron** : il se declare une fois et s'instancie autant de fois qu'une piece en
a besoin, chaque instance portant ses propres valeurs de port.

### Invoquer une librairie

**Une librairie s'invoque par son nom, l'entree apres le point.** C'est la forme unique de tout ce
qui vit dans un catalogue.

```text
@alphabet.sargam
@tuning.just
@octaves.saptak
@sound.tabla_perc
@transcription.dhati
@library.strudel
```

| librairie | ce qu'elle collectionne |
| --- | --- |
| `alphabet` | des **terminaux** -- sonnants ou non, avec ou sans hauteur, code ou calcul |
| `tuning` | des accordages |
| `octaves` | des conventions de registre |
| `sound` | des prototypes d'objet sonore : ce que le moteur a le droit de comprimer, d'etirer, de tronquer pour faire tenir une polymetrie |
| `transcription` | des tables de correspondance entre notations |
| `library` | des banques chargees par un moteur de code |

**Un alphabet est une collection structuree de terminaux.** Un terminal est une chose entiere : il
sonne ou non, porte une hauteur ou non, invoque du code ou une instruction de calcul de hauteur.
Ce qui le simplifie est une **definition**, pas un decoupage en axes portes par l'acteur.

### Invoquer un reglage

**Un reglage s'ecrit par sa categorie, l'entree apres le point.** La categorie dit a quoi le reglage
touche, donc qui le consomme.

| categorie | ce qu'elle regle |
| --- | --- |
| `@pitch.` | `transpose` · `scaleshift` · `chromashift` · `diapason` |
| `@time.` | `tempo` · `duration` · `meter` · `timepatterns` |
| `@engine.` | `mode` · `scan` · `weight` · `seed` · `maxitems` · `on_fail` · `quantization` · `qclock` |

```text
@time.tempo:120
@engine.seed:42
@pitch.diapason:442
```

### Duree explicite

```bpscript
@core
@controls
@alphabet.sargam
@tempo:90
@duration:16b

S -> sa re ga pa
```

`@duration:16b` fixe une enveloppe de 16 beats au tempo `@tempo` courant ; `@duration:8s` la fixe
en secondes.

`@duration` separe trois preoccupations :
- **Densite** = le contenu (combien de termes, quelles proportions)
- **Duree** = `@duration` (combien de beats ou de secondes la scene occupe)
- **Vitesse** = `@tempo` (l'horloge, partagee avec le monde exterieur)

Avec `@duration`, la scene est dilatee uniformement et ses proportions internes sont preservees.
Sans `@duration`, la duree suit le contenu : le nombre de termes derives et le tempo courant.

---

## L'ordonnanceur

BPScript decide **quand**. Le code entre backticks decide **quoi** : il est execute par le
runtime que son tag nomme (`sc:`, `tidal:`, `py:`). Les deux vivent dans le meme fichier : les
backticks de tete preparent chaque runtime au chargement, ceux des productions jouent a leur
instant -- ecrits directement dans la regle, ou nommes par une `@macro` (cf.
[Backticks](#backticks----code-natif-dans-le-flux)).

```bpscript
@core
@controls
@alphabet.western:audio

// En tete de scene : chaque runtime prepare ses objets au chargement
`sc: SynthDef(\grain, { |freq, dens| GrainSin.ar(dens, freq) }).add`
`tidal: let pat = s "bd sd hh sd"`
`py: import dmx; d = dmx.open()`

// Une macro nomme un fragment de code ; son nom se pose nu dans le flux
@macro noir `py: d.blackout()`

S -> Section [phase=1]

-----

[phase==1] Section -> { Intro, Rythme }
[phase==2] Section -> { Melodie, Rythme }
Intro   -> C4 D4 `tidal: once pat` E4     // code ecrit directement dans la production
Rythme  -> G3 G3 G3 G3
Melodie -> E4 F4 noir G4 A4               // le meme geste, nomme par la macro
```

Le compilateur transmet le code tel quel, avec son tag et sa place dans le flux.

---

## Inventaire : 3 mots, 24 symboles, 9 operateurs

### Trois mots reserves

| Mot         | Role | Sens                                      |
| ----------- | ---- | ----------------------------------------- |
| **gate**    | type | occupe du temps, valeur constante         |
| **trigger** | type | instant, zero duree, impulsion ponctuelle |
| **cv**      | type | occupe du temps, valeur varie continument |

Les trois noms viennent de l'eurorack ; ils fixent le **rapport au temps** de chaque symbole.
Le compilateur en deduit l'occupation du temps, le compositeur la lit a la declaration.

### Vingt-quatre symboles structurels

```text
@              directive de declaration, en tete de scene
-> <- <>       derivation et direction (BP3 : --> <-- <->)
-> <- <>       derivation et direction (BP3 : --> <-- <->)
{ , }          polymetrie et groupement temporel
( )            parametres runtime (portees symbole, regle, groupe) et contexte de regle
:              affectation : lie un sujet a une valeur (@gate Sa:sc, *:sound.bell_short)
*              sujet universel d'une affectation -- tous les terminaux de la portee
               (*:sound.cloche, (*:vel:80)) ; entre crochets, multiplie la duree (C4[*2]) ;
               entre un gabarit maitre et son esclave, marqueur d'homomorphisme ($X * &X)
=              affectation de drapeau, entre crochets en fin de regle (S -> C4 [phase=2])
.              reference a une entite (alphabet.western, sound.bell_short, transport.midi),
               sous-partie (acteur.terminal), separateur de fragments (A B . C D)
[ ]            qualificateur moteur, sur un symbole, un groupe ou une regle
` `            code externe, execute par le runtime que son tag nomme
//             commentaire
-              silence : occupe du temps
_              prolongation : etend l'evenement precedent
...            repos indetermine, duree calculee par le moteur
!              simultaneite : ce qui suit partage l'instant d'attaque de l'element qui
               precede (C4!dha) ; sans element devant lui, objet hors-temps de duree nulle
               (S -> !dha C4) ; devant un controle, mutation de flux (![mode:random])
<!             trigger entrant : point de synchronisation, la derivation attend
#              contexte negatif
?              capture d'un symbole quelconque
$              template : definition d'un motif
&              template : reference a un motif
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

### Neuf operateurs de flags

Un drapeau se lit et s'ecrit a deux endroits de la regle : la **garde**, entre crochets avant
le LHS, et le crochet de **fin de regle**, apres le RHS. Chaque operateur a sa place.

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

Dans la garde, `+` et `-` font les deux en un pas : `[count-1]` teste que `count` est positif
et le decremente au moment ou la regle s'applique. En fin de regle, ils modifient le drapeau
pour les derivations suivantes.

`=` pose la valeur d'un drapeau et s'ecrit en fin de regle : `S -> Loop [phase=1, count=4]`.
Pour comparer un drapeau avant le LHS, l'operateur est `==` : `[phase==1] Loop -> C4`.

Un nom de drapeau seul entre crochets teste qu'il vaut autre chose que zero : `[Ideas] S -> C4`.

Les neuf a l'oeuvre dans une scene :

```bpscript
@core
@controls
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

Le decrement `-` s'ecrit avec le glyphe du silence ; entre crochets et pose sur un drapeau,
c'est l'operateur. L'inventaire des glyphes et celui des operateurs sont independants : un
meme signe sert dans les deux, sa place tranche lequel des deux roles il tient.

### Trois portees de metadonnees

- `@` = **global** : environnement, imports, configuration de la scene
- `[]` = **local moteur** : instructions BP3 -- modes, drapeaux, operateurs temporels
- `()` = **local runtime** : parametres transportes au runtime cible (vel, filter, wave...)

```bpscript
@core
@controls
@alphabet.western:audio
@tempo:120

S -> C4(vel:0.7) D4[/2] E4 F4 [mode:random]
```

Les nombres (`0.7`, `120`, `5ms`) sont transportes tels quels : c'est le recepteur qui leur
donne un sens.

BPScript decrit des structures dans le temps. Une garde `[...]` posee avant le LHS decide si
la regle s'applique a cette derivation. Le calcul et le traitement de signal s'ecrivent dans
le code externe (backticks).

---

## Systeme de types -- double declaration

Chaque symbole porte un **double contrat** avant d'etre employe :

| Dimension         | Question                | Valeurs                | Exemple                                |
| ----------------- | ----------------------- | ---------------------- | -------------------------------------- |
| **Type temporel** | comment dans le temps ? | gate, trigger, cv      | gate = duree, trigger = instant        |
| **Runtime**       | qui l'execute ?         | sc, py, tidal, midi... | `@gate Sa:sc` -- SuperCollider joue Sa |

Le compilateur exige les deux : le type temporel dit comment ordonnancer, le runtime dit ou
envoyer.

### Trois categories de symboles

Une scene contient trois categories de symboles, que le compilateur reconnait a leur ecriture :

| Categorie        | Declaration                                            | Role                                           | Exemples                               |
| ---------------- | ------------------------------------------------------ | ---------------------------------------------- | -------------------------------------- |
| **Non-terminal** | implicite (apparait en LHS d'une regle)                | variable de grammaire, se reecrit et disparait | S, Intro, Motif, R1, P4                |
| **Terminal**     | explicite (`@gate`, `@trigger`, `@cv`, ou un alphabet) | symbole de sortie, atteint un runtime          | `@gate Sa:sc`, `@trigger flash:py`     |
| **Controle**     | via `@controls`                                        | commande moteur BP3, zero duree                | `[mode:random]`, `[/2]`, `[weight:50]` |

Le compilateur reconnait un non-terminal a sa presence en LHS d'une regle ; tout autre nom est
un terminal, et vient alors d'une declaration ou d'un alphabet en portee. Un non-terminal vit
le temps de la derivation : son role est d'etre reecrit, et les regles le remplacent par des
terminaux. La derivation s'acheve sur des terminaux, seuls porteurs d'un type temporel et d'un
runtime.

### Declaration : type temporel + runtime

Une declaration donne le type temporel, le nom, puis la cible apres le deux-points :

```bpscript
@core
@controls

@gate Sa:sc                      // Sa occupe du temps, SuperCollider le joue
@trigger flash:python            // flash est un instant, Python le declenche
@cv ramp:tidal                   // ramp varie continument, Tidal le calcule

S -> Sa flash Sa
```

Un alphabet declare ses symboles en bloc. Le deux-points nomme alors le **canal de sortie** de
l'acteur implicite, pris parmi `audio`, `midi` et `osc` :

```bpscript
@core
@controls
@alphabet.sargam:audio

S -> sa re ga
```

Le type temporel et la cible d'un symbole valent pour toute la scene.

Chaque symbole employe dans une regle est declare, et le compilateur nomme celui qui manque :

```text
S -> C4 D4 Bloup E4
//            ^^^^
// terminal 'Bloup' non declare -- absent des alphabets en portee
```

---

## Parametres -- opaques pour BPScript

BPScript transporte les parametres jusqu'au runtime, qui les interprete.

```bpscript
@core
@controls

// SuperCollider definit les parametres dans un SynthDef
`sc: SynthDef(\sitar, { |freq, vel=80| ... }).add`

// BPScript declare le contrat temporel
@gate Sa:sc

// Les parametres partent tels quels vers SuperCollider
S -> Sa(vel:120) Sa(vel:`rrand(40,127)`) Sa
```

Trois ecritures, une seule plomberie :

```text
Sa(vel:120)                                  litteral -- BPScript transporte la valeur
Sa(vel:`rrand(40,127)`)                      backtick inline -- le runtime de Sa evalue
`sc: SynthDef(\grain, { |freq| ... }).add`   backtick autonome -- le tag nomme le langage
```

Un backtick qui tient sa propre place -- en tete de scene ou dans le flux d'une regle -- est
**autonome** : son langage se nomme, soit par un tag dans le bloc (`` `js: …` ``), soit par un
acteur qui le qualifie avec le point (`` drums.`…` ``, declare par `@actor drums eval.<moteur>`).
La regle vaut aux deux emplacements.

Pour BPScript, `vel` est un nom qu'il porte, `120` une valeur qu'il transporte, et
`` `rrand(40,127)` `` du code que le runtime de Sa evalue. Les trois suivent le meme chemin.

### Surcharge des parametres

La cascade fournit la valeur de chaque parametre ; ecrire ce parametre sur l'occurrence remplace
cette valeur, pour cette occurrence. La cascade complete est decrite dans « Sons et cascade
d'heritage ».

```bpscript
@core
@controls

`sc: SynthDef(\sitar, { |freq, vel=80| ... }).add`
@gate Sa:sc

S -> Sa Sa(vel:120) Sa(vel:`rrand(40,127)`)
//   ^ herite       ^ litteral      ^ evalue par SuperCollider
```

La surcharge porte sur les parametres ; le contrat -- type temporel et runtime -- reste celui
de la declaration.

---

## `[]` moteur vs `()` runtime -- deux destinataires, memes portees

### `[]` -- instructions moteur BP3 (toujours suffixe)

Les qualificateurs `[]` s'adressent au **moteur BP3**. Le compilateur les traduit en instructions
moteur (operateurs temporels, tempo, mode de sous-grammaire...). Le moteur les consomme **pendant**
la derivation et le calcul temporel ; la sortie porte leur effet.

```bpscript
// Portee symbole -- colle a l'element
S -> A[/2] B C                  // divise la vitesse de A

// Portee regle -- en fin de regle
S -> A B C [mode:random]        // mode de la sous-grammaire
Basse -> C2 C2 C3 [weight:50]   // poids de la regle
Basse -> C2 E2 G2 [weight:inf]  // poids infini : priorite absolue

// Portee groupe -- apres le groupe
S -> {A B C}[/2]                // vitesse du groupe divisee
```

### Cles reservees de `[]`

Ces cles font partie du langage : le compilateur les comprend et les traduit en instructions
moteur.

```text
/N   \N   *N   **N   operateurs temporels BP3
mode        mode du bloc (random, ord, sub, sub1, lin, tem, poslong) -- defaut : ord
scan        sens du parcours par regle (left, right, rnd) -- defaut : rnd
weight      poids de la regle (entier, K-param, ou inf pour priorite absolue)
on_fail     gestion d'echec (skip, retry(N), fallback(X)) -- defaut : skip
tempo       tempo de la regle -- [tempo:120] ; @tempo:120 pose celui de la scene
meter       signature rythmique -- [meter:7/8], [meter:4/4]
```

Toute autre cle entre crochets arrete la compilation. Les parametres destines au runtime
(`vel`, `filter`, `wave`...) s'ecrivent entre parentheses.

Le mot `scale` designe la **gamme microtonale** : c'est un controle de runtime, il s'ecrit
`(scale:nom cle)`. La mise a l'echelle temporelle d'un groupe s'ecrit avec la **duree collee**,
`{A B}:2`.

### Compilation de `[]` vers BP3

```text
// BPScript                              -> BP3
A[/2] B C                                -> /2 A B C
[mode:random] S -> A B C                 -> RND  gram#N[M] S --> A B C
{C3, E3, G3, C4}:2                       -> {2, C3, E3, G3, C4}      // duree collee
```

### `()` -- parametres runtime (toujours suffixe)

Les parametres `()` sont des donnees destinees au **runtime cible** (Web Audio, SuperCollider,
MIDI externe, OSC, DMX...). Le compilateur verifie que la cle appartient au vocabulaire charge,
transmet la valeur telle quelle, et le dispatcher JS route l'ensemble.

```bpscript
// Portee symbole -- colle a l'element
S -> C4(vel:120)                        // vel envoye au runtime quand C4 joue
S -> C2(wave:sawtooth, filterQ:8)       // parametres de synthese

// Portee regle -- en fin de RHS
Basse -> C2 C2 - C2 (vel:100)           // vel pour toute la phrase

// Portee groupe -- apres le groupe
S -> {A B C}(filter:lp, cutoff:4000)    // filtre sur tout le groupe
```

**Superposition des modulations continues.** Quand plusieurs portees posent le **meme parametre**
sur une meme note (note, groupe, groupe parent...), les controles **s'empilent en serie**, de
l'**interieur vers l'exterieur**, dans l'ordre de l'imbrication : dans
`{ C4(filter:500) D4 }(filter:300)`, le son de C4 traverse son filtre de note puis celui du groupe.
Les **scalaires** (`vel`, `chan`) suivent l'autre regime : la precedence en retient **une** valeur.
L'empilement se resout en aval (BPx, Kairos, runtime) ; le langage le dit deja par le sujet du
qualificateur et par l'imbrication des groupes.

**Etendue d'arc et rearmement d'enveloppe (`cutoff:env`).** Un silence `-` **re-arme** l'enveloppe
qui module un parametre : elle rejoue son attaque. Une accolade `{ ... }` qui enjambe ce silence
definit **un seul arc continu**, qui le franchit. C'est l'etendue de l'accolade qui choisit :

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

Un flux continu tenu sur une grande etendue s'ecrit donc avec la meme accolade, ouverte plus large.
Cote formalisme, l'accolade est **un** noeud conteneur unique portant le qualificateur a la portee
`group`, et son etendue survit a l'expansion polymetrique : BPx produit la fenetre du bus, Kairos
la porte opaque, le runtime la realise. Le comportement transverse complet est decrit dans
`atlas/architecture/MODULATIONS.md`.

Les `()` runtime sont compiles en `_script(CT n)` -- des controles opaques que BP3 transmet tels
quels. Le transpileur maintient une table de mapping :

```text
// BPScript                              -> BP3
C4(vel:120)                              -> _script(CT 0) C4
{A B}(filter:lp)                         -> {_script(CT 2_start) A B _script(CT 2_end)}

// Table de mapping (cote JS) :
// CT 0 -> { scope: 'symbol', params: { vel: 120 } }
// CT 2_start/end -> { scope: 'group', params: { filter: 'lp' } }
```

### Valeur brute (modele CSS)

Dans `[]` comme dans `()`, tout ce qui suit le `:` jusqu'au prochain `,` ou au delimiteur fermant
est la **valeur brute** : le destinataire -- moteur ou runtime -- l'interprete.

### Controles autonomes (resolution pure)

Quand un non-terminal se resout **entierement** en controles runtime, un sac `()` tient lieu de
RHS et la regle produit des elements de duree nulle :

```bpscript
Pull0 -> (pitchbend:0)
StartPull -> (pitchcont, pitchrange:500, pitchbend:0)
```

Une regle porte **un** sac en contenance. Pour en poser plusieurs, chacun prend son `!` et se pose
dans le flux :

```bpscript
@controls

StartPull -> !(pitchcont) !(pitchrange:500) !(pitchbend:0)
```

### Resume des portees

| Portee      | Syntaxe          | Destinataire    | Exemple           |
| ----------- | ---------------- | --------------- | ----------------- |
| **globale** | `@cle:valeur`    | settings moteur | `@tempo:120`      |
| **groupe**  | `{}[cle:valeur]` | moteur BP3      | `{A B}[/2]`       |
| **regle**   | `[cle:valeur]`   | moteur BP3      | `[mode:random]`   |
| **symbole** | `[cle:valeur]`   | moteur BP3      | `A[/2]`           |
| **groupe**  | `{}(cle:valeur)` | runtime cible   | `{A B}(vel:100)`  |
| **regle**   | `(cle:valeur)`   | runtime cible   | `C2 C2 (vel:100)` |
| **symbole** | `(cle:valeur)`   | runtime cible   | `C4(vel:120)`     |

### Destinataire d'une paire `[sujet:]controle:valeur`

Le `()` d'une regle vaut par defaut pour **la regle comme unite**. Une paire peut porter un
**sujet** devant le controle pour viser plus finement -- meme mecanisme que l'affectation
`*:sound.bell`, ou le `:` introduit deja un sujet.

| Ecriture          | Sujet | Cible                            |
| ----------------- | ----- | -------------------------------- |
| `(cutoff:env)`    | omis  | **la regle elle-meme** (l'unite) |
| `(*:cutoff:env)`  | `*`   | **chaque terminal** de la regle  |
| `(C2:cutoff:env)` | `C2`  | les terminaux **C2** de la regle |

- `*` designe tous les terminaux, le sens qu'il a deja dans `*:sound.X`.
- Le sujet vaut **par paire** : `(*:cutoff:env, wave:sawtooth, vel:100)` pose `cutoff` sur chaque
  terminal, `wave` et `vel` sur la regle.
- Pour un **CV** (qui varie dans le temps), le sujet decide l'**horloge** : sans sujet, un signal
  sur la voix ; avec `*:`, une enveloppe relancee par note. C'est le sujet qui tranche, pas la
  nature de la valeur. Pour un controle **statique** (`wave`), les deux ecritures donnent le meme
  effet : la distinction porte sur le temporel.

### Contenance `()` vs flux `!()` -- deux facons de gouverner les notes

Un controle non-temporel (`vel`, `wave`, `filter`...) gouverne plusieurs notes selon deux regimes,
que l'ecriture designe :

| Ecriture | Regime                     | Ce qu'elle gouverne                                                                                                  |
| -------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `(...)`  | **contenance**, structurel | toute sa portee -- regle ou groupe -- les elements ecrits avant elle compris ; l'effet s'arrete au bord de la portee |
| `!(...)` | **flux**, sequentiel       | les elements qui suivent dans l'ordre joue, au-dela des bords de regle, jusqu'au prochain controle                   |

```bpscript
@controls

// CONTENANCE -- (...) : les TROIS notes en sawtooth, l'effet reste dans Basse
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

| Ecriture                                      | Sens                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `(...)` *(sans `!`)*                          | **contenance** -- l'effet reste dans sa portee                                        |
| `C4!(...)` **colle** (pas d'espace avant `!`) | **flux CONJOINT, ancre a C4** -- il voyage avec C4 et se replique avec lui            |
| `C4 !(...)` **espace**                        | **flux, EVENEMENT SEPARE** -- pose seul dans la sequence                              |
| `B3!C7` *(`!` entre symboles)*                | **SIMULTANE / accord** -- les deux notes attaquent au meme instant                    |
| `!f` *(en tete, sans primaire)*               | **objet HORS-TEMPS** -- pose seul, sans duree (`OutTimeObject`)                       |
| `![@seed:N]`                                  | **directive de production DANS LE FLUX** -- element sans duree (`InstantControl`)     |
| `C4 !prise` *(nom d'une `@macro`)*            | **ACCORD** -- `prise` y sonne comme co-attaque et l'aval lui cherche une hauteur      |
| `!osc >> filtre`                              | **cablage pose dans le flux** -- le langage le lit, le moteur le refuse au chargement |
| `!=` *(dans une garde)*                       | **comparaison de difference**, pendant de `==`                                        |

C'est ce qui **suit** le `!` qui decide de la lecture. Le `!` lui-meme dit l'instantane, duree
zero ; la coupure de cablage s'ecrit `\>>`. `!=` forme un jeton unique, comme `==` ou `>=`.

**Un cablage se nomme.** La table des symboles du moteur range chaque element sous un nom, et un
cablage ecrit directement dans le flux est refuse au chargement. On le nomme donc dans une `@macro`
et on pose son nom **nu** dans le flux, ou il occupe un pas :

```bpscript
@macro prise osc >> filtre

S -> A4 prise B4
```

Ecrit `C4 !prise`, le meme nom devient une co-attaque de l'accord : l'aval lui cherche une hauteur
et un son sort, sans qu'aucune erreur le signale.

**L'espace tranche l'attache de `!(...)`** -- application de la convention generale de l'espace,
delimiteur de termes : colle au terminal precedent, le controle voyage avec lui ; separe par une
espace, il se pose seul dans la sequence. En tete de regle ou de groupe (`{!(vel:80) ...}`), il se
pose seul. L'AST porte cette attache sur le noeud `!(...)` (`conjoint`), et le simultane `B3!C7`
reste un `SimultaneousGroup`.

**Chaque element porte son `!`**, et une espace les separe : `Interne -> !(ins:1) !(chan:1)` donne
deux elements freres ; `C4!E4!G4` donne un primaire et deux secondaires.

**Precedence** (du plus fort au plus faible) :
**override de note `C4(vel:120)` > flux `!(...)` > contenance `(...)` > defauts de declaration.**

---

## Les parentheses `()` -- quatre roles

Les parentheses ont quatre fonctions, decidees par la position :

```bpscript
// 1. Sac de parametres runtime -- sur un symbole, une regle ou un groupe
S -> C4(vel:120)                      // symbole : vel envoye au runtime quand C4 joue
Basse -> C2 C2 - C2 (vel:100)         // regle : vel pour toute la phrase
S -> {A B}(filter:lp, cutoff:4000)    // groupe : filter pour tout le groupe

// 2. Contexte -- condition d'application d'une regle
(A B) X -> D E                        // X se reecrit en D E seulement s'il suit A B
```

```bpscript
// 3. Liste de parametres d'une declaration -- collee au nom
@macro accent(x) x(vel:120)

// 4. Argument d'un appel de macro
S -> accent(C4) E4
```

La regle de desambiguation est positionnelle :
- `symbole(` colle, dans une regle = sac de parametres runtime ou appel de macro
- `(` en fin de RHS = sac de parametres de portee regle
- `{}(` apres un groupe = sac de parametres de portee groupe
- `@directive nom(` colle au nom = liste de parametres d'une declaration
- `(` en tete de regle, avant le LHS et la fleche = contexte

Une procedure moteur prend elle aussi son argument entre parentheses, a l'interieur du sac `[]` :
`[on_fail:retry(2)]`, `[on_fail:fallback(Autre)]`.

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

```bpscript
// 3. Sac de proprietes dans une declaration
@sound
  bell_short { sample:"bell.wav", dur:400 }

S -> C4(sound.bell_short)
```

Les roles 1 et 2 suivent le comportement de BP3 ; le sac de proprietes est propre a BPScript.

### Duree collee sur un groupe

Une duree s'ecrit avec `:` colle (cf. la section des conventions de notation `.` / `:` / `*`).
Posee sur un bloc polymetrique, elle donne le ratio que BP3 place en premiere position du bloc :

```bpscript
S -> {C3, E3, G3, C4}:2      // duree du bloc
S -> {C4 E4 G4}:2/3          // ratio fractionnaire
S -> A4:1/2                  // la meme duree, sur une note
```

```text
// BPScript              -> BP3
{C3, E3, G3, C4}:2       -> {2, C3, E3, G3, C4}
A4:1/2                   -> {1/2, A4}
```

---

## L'operateur `!` -- simultaneite

### `!` -- "a cet instant, aussi ca"

`!` attache un ou plusieurs elements secondaires a un point dans le temps.
Le premier element (le **primaire**) definit la position et la duree.
Tout ce qui suit `!` se declenche **au meme instant**.

`!` accepte **tous les types** :

```bpscript
@gate visual_glow:osc
@trigger dha:sc
@trigger spotlight:osc
@cv monte mod.ramp(from:0, to:255)

S -> C4!dha                        // gate + trigger
S -> C4!visual_glow                // gate + gate : visual_glow prend la duree de C4
S -> C4!dha!spotlight [phase=2]    // gate + trigger + mutation de drapeau
S -> -!dha                         // silence + trigger
S -> C4!monte                      // gate + cv : monte prend la duree de C4
```

Regles :
- **Avant `!`** : le primaire -- il occupe du temps (gate, cv, silence)
- **Apres `!`** : les secondaires -- ils partagent l'instant d'attaque du primaire
  - **trigger** -> duree zero
  - **gate** -> prend la duree du primaire
  - **cv** -> prend la duree du primaire
  - **`nom=valeur`** -> mutation de drapeau, duree zero
- **`!nom` pose seul** dans la sequence : **objet hors-temps** -- il tient sa place dans
  l'ordre joue pour une duree nulle. Compile en `<<nom>>` pour BP3.
- **`!(controle)` pose seul** : mutation de **flux** -- cf.
  [Contenance `()` vs flux `!()`](#contenance---vs-flux---deux-facons-de-gouverner-les-notes)

C'est le mecanisme de la **simultaneite cross-runtime** : un seul point dans le temps porte
des evenements destines a SC, Python, Processing, DMX.

### Grouper des evenements simultanes dans une macro

Un ensemble d'evenements simultanes qui revient souvent se factorise dans une macro :

```bpscript
@gate visual_glow:osc
@trigger spotlight:osc
@gate visual_strobe:osc
@trigger flash:osc
@macro halo(x) x!visual_glow!spotlight
@macro eclair(x) x!visual_strobe!flash

S -> halo(C4) eclair(D4) halo(E4)
// Expansion :
// C4!visual_glow!spotlight D4!visual_strobe!flash E4!visual_glow!spotlight
```

### `<!` -- trigger entrant (on attend)

`<!` attend un signal externe avant de continuer. C'est un point de synchronisation, de
duree zero comme tout trigger.

```bpscript
@trigger dha:sc
@in sync1 transport.midi

S -> -<!sync1 C4 D4 E4       // attend en silence, puis joue
S -> C4<!sync1 D4 E4         // joue C4, attend, puis continue
S -> <!sync1 C4 D4 E4        // attend seul puis demarre
S -> C4!dha<!sync1 D4 E4     // joue C4 + dha, attend sync1, puis D4
```

`@in <role> transport.<canal>` nomme dans la scene le **role** que tient l'entree ; les canaux
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
fondamental de BP3.

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

En BPScript, `.` et `,` s'ecrivent comme en BP3 et sont transmis tels quels.

**L'espace tranche** : entoure d'espaces, le `.` decoupe la sequence ; colle entre deux noms,
il appelle un composant (`transport.midi`, `<!sync1.60`) -- cf. la section « Conventions de
notation ».

---

## Liaisons `~` -- tied sound-objects

En BPScript, la liaison s'ecrit `~` ; `&` y designe le gabarit esclave.

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

Le compilateur traduit `~` -> `&` pour BP3 (`C4~` -> `C4&`, `~C4` -> `&C4`).

---

## Captures `?` -- pattern matching

`?` apparie un symbole quelconque. A gauche de la fleche il capture ; a droite il rejoue la
valeur capturee.

`?n` **unifie** : toutes les occurrences de `?1` dans une regle designent le meme symbole.
Le `?` nu capture chaque position independamment.

```bpscript
@var N
?1 M ?1 -> ?1 N ?1       // le symbole qui encadre M revient autour de N
?1 ?2 -> ?2 ?1           // echange deux symboles
```

Une capture vaut pour **un** symbole. Une regle en porte jusqu'a 32 numerotees. Le compilateur
traduit `?n` vers les metavariables BP3.

---

## Homomorphismes `|x|` -- variables liees

`|x|` nomme une variable qui apparie n'importe quel symbole ; toutes les occurrences de `x`
dans la regle designent le meme symbole. Elle s'abaisse en non-terminal nomme pour le moteur.

```bpscript
|x| M x -> x M              // inversion
|x| x x -> x                // dedoublonnage
|x| |y| x y -> y x          // permutation
|x| (C4) x M -> x M x       // variable sous contexte positif
```

Les tables d'homomorphisme se declarent par `@transcription.<table>` et s'appliquent entre un
gabarit maitre et son esclave -- cf.
[Templates `$` et `&`](#templates----et------capture-et-reutilisation-de-groupes).

---

## Contextes `()` et `#` -- conditions d'application

```bpscript
(C4 D4) M -> E4 F4          // contexte positif : M se reecrit quand il suit C4 D4
#X M -> C4                  // creneau negatif : un symbole qui differe de X
(C4) M #(F4) -> D4 E4       // contexte positif a gauche, creneau negatif a droite
```

### `#X` apparie un symbole et consomme sa position

`#X` apparie exactement **un** symbole, qui doit differer de `X`, et il **occupe la position**
de ce symbole.

```bpscript
@var z1, z2, z3
#K1 #K2 #K3 M M -> z1 z2 z3 M M
```

Appliquee a `M K2 K3 K1 M M`, cette regle donne `M z1 z2 z3 M M` : les trois creneaux negatifs
ont apparie `K2`, `K3` et `K1` -- trois symboles reels, pris dans l'ordre, position par
position. Dans l'arbre, un `#X` est un `Symbol` de `lhs`, a sa place, avec `negated: true` ;
les contextes positifs `(...)`, eux, vivent dans le champ `contexts`.

**La qualite de CONTEXTE vient de la SYMETRIE de la regle** : un symbole ecrit a la meme place
des deux cotes de la fleche (prefixe ou suffixe commun) est du contexte. Differer de `X` et
appartenir au contexte sont deux proprietes independantes -- chacune s'obtient sans l'autre.

### Le test negatif est une disjonction a l'echelle de la regle

Plusieurs `#` dans une meme regle forment **un seul test** : il passe des qu'**UN** creneau
differe de son nom, et il bloque quand **TOUS** les creneaux egalent leur nom simultanement.

### Silence et prolongation comme creneaux

`-` (silence) et `_` (prolongation) sont des voisins comme les autres : ils s'emploient en
creneau, y compris en creneau negatif, ou le symbole se colle au `#` -- `#-`, `#_`.

```bpscript
#- V1 <> #- -              // le creneau apparie un symbole qui differe du silence
#_ M -> C4                 // le creneau apparie un symbole qui differe de la prolongation
#(X Y) M -> C4             // le creneau apparie un symbole qui differe de X et de Y
```

`#<symbole>` apparie un creneau ; `#(X Y)` apparie un creneau dont le symbole differe de chaque
membre du groupe. Les deux formes consomment une position.

---

## Templates `$` et `&` -- capture et reutilisation de groupes

`$` capture un motif de groupe (maitre), `&` le rejoue (esclave). Le nom porte
l'appariement entre les deux.

```bpscript
S <> $mel &mel                            // $mel capture, &mel rejoue
S <> $mel(tempo:120) &mel(tempo:80)       // chaque invocation porte ses parametres
S -> ${$X S &X} &{$X S &X}                // capture d'un groupe entier
```

Les parametres d'une invocation gouvernent l'expansion du gabarit : ils valent
pour ce que cette invocation produit. En BP3, `$X` s'ecrit `(=X)` et `&X`
s'ecrit `(:X)`.

### Ancre de gabarit maitre : `$` seul en tete de LHS

Un `$` suivi d'une espace, en tete du membre gauche, marque la regle entiere
comme gabarit maitre : il ancre la regle.

```bpscript
$ S -> C4 D4
```

L'arbre porte `lhs = [TemplateAnchor{kind:"master"}, Symbol{S}]`. L'espace
tranche entre les deux emplois du signe : colle a un identifiant, `$X` nomme une
capture ; suivi d'une espace, `$` ancre -- cf. l'espace, delimiteur de termes.
En BP3, l'ancre correspond au token `(=` laisse ouvert.

### Tables de substitution

Les tables de substitution vivent dans `lib/sub.json`, une par nom, chacune avec
ses sections. `@sub.<nom>` invoque une table :

```bpscript
@sub.dhati

S -> $N14 &N14
```

Un nom absent de la librairie est refuse au parse.

---

## La section `@template` -- catalogue de patrons

`@template` liste des patrons structurels. Elle se place apres les regles, en
fin de scene.

```bpscript
@alphabet.western

S -> C4 D4

@template
[1] /1 ???????
[2] *3/2 ??.??
[3] /1 ($0 ???)($1 )
```

Une entree s'ecrit `[<numero>] <echelle> <corps>` :

- `<numero>` -- l'index de l'entree, entre crochets.
- `<echelle>` -- `/N` ou `*N/M`, `/1` quand elle est omise.
- `<corps>` -- des jokers `?`, un par symbole attendu ; des points `.`
  (fragments de duree egale) ; des groupes numerotes `($N ...)`, imbricables.

Le mode `tem` fait l'appariement structurel sur ce catalogue. Il s'ecrit en tete
de scene ou en suffixe de regle.

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

Les six cles d'entite d'un acteur (`alphabet`, `tuning`, `octaves`, `sound`,
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

### Les parametres runtime `()`

Un parametre cascade des defauts de la librairie du symbole vers la valeur
ecrite a l'occurrence, puis vers l'objet temporel continu qui le pilote
(`spec < CT < CV`) -- cf. le cascading des controles.

```bpscript
@alphabet.sargam

S -> sa sa(vel:120)          // sa prend le defaut de librairie, puis 120
```

### Les proprietes d'un son

Sept niveaux, du defaut moteur a l'occurrence dans une regle -- cf. les sons.

### La vitesse d'un bloc

`[*N]` multiplie la vitesse heritee du contexte englobant ; `[/N]` pose une
vitesse absolue -- cf. les operateurs temporels.

```bpscript
S -> {A B}[*2] C
```

---

## Sons

Un son decrit son **timbre** (`sample`, `synth`) et son **comportement
temporel** : duree, dilatation, pivot, periode, recouvrement, troncature. Le
vocabulaire complet des proprietes d'un prototype vit dans `lib/sounds.json`
(capacites booleennes, bornes temporelles et leurs modes, duree, dilatation,
periode, timbre).

### Territoires : un seul role chacun

| Territoire      | Role                                        | Affectation a un sujet       |
| --------------- | ------------------------------------------- | ---------------------------- |
| `@sound`        | declarer des prototypes, anonymes et nommes | declaratif seul              |
| `@alphabet.X`   | declarer un alphabet                        | `*:sound.Y`, `sa:sound.Y`    |
| `@actor X`      | declarer un acteur                          | `*:sound.Y`, `sa:sound.Y`    |
| RHS d'une regle | flux temporel                               | `sa(sound.Y)` a l'occurrence |

Une affectation s'ecrit depuis le territoire d'origine du sujet, ce qui garde
`@sound` declaratif.

### Declarer des sons

```bpscript
@sound
  { dur:500, alphaMin:80, alphaMax:120 }   // entree anonyme = defaut de scene
  bell_short { sample:"bell.wav", dur:400 }
  bell_long  { sample:"bell.wav", dur:1200, coverEnd:true }
  drum_kick  { sample:"kick.wav", dur:200, breakTempo }
```

- Une entree **anonyme** (`{ ... }`) est un defaut de scene. Plusieurs entrees
  anonymes se lisent dans l'ordre source.
- Une entree **nommee** (`nom { ... }`) se reference ailleurs par `sound.nom`.
- Une capacite ecrite nue vaut `true` : `{ breakTempo }` donne
  `breakTempo: true` dans l'arbre.
- Les modes s'ecrivent en chaine (`'absolute'`, `'relative'` ; `'irrelevant'`
  pour `periodMode`) ; `pivType` accepte la chaine ou l'entier `1..7`.

### Invoquer un prototype du catalogue

`@sound.<nom>` invoque une entree du catalogue `lib/sounds.json` :

```bpscript
@sound.tabla_perc

S -> C4 D4
```

Un nom absent du catalogue est refuse au parse (« sound '<nom>' introuvable
dans le catalogue »).

### Affecter un son a un sujet

```bpscript
@sound
  { dur:500 }
  cloche { sample:"bell.wav", dur:400 }

@alphabet.sargam
  *:sound.cloche                           // defaut de l'alphabet
  sa:sound.cloche                          // sa dans cet alphabet
  re:{ dur:300 }                           // bloc de proprietes anonyme

@actor sitar
  alphabet.sargam
  transport.midi(ch:10)
  *:sound.cloche                           // defaut de l'acteur
  sa:{ dur:120 }                           // sa pour cet acteur

S -> sa(sound.cloche) re ga                // l'occurrence porte son son
```

Le sujet d'une affectation est un terminal (`sa`) ou `*`, qui vaut pour tous les
terminaux. La cible est une reference `sound.<nom>` ou un bloc de proprietes
`{ ... }` -- cf. le point et le deux-points.

### Les sept niveaux de la cascade des sons

Du moins specifique au plus specifique.

| #   | Niveau                    | Ecriture                                                  |
| --- | ------------------------- | --------------------------------------------------------- |
| 1   | Defaut moteur             | constantes de `ResetPrototype` (`SoundObjects3.c:43-117`) |
| 2   | Defaut de scene           | `@sound { ... }`                                          |
| 3   | Defaut d'alphabet         | `@alphabet.X` + `*:sound.NOM`                             |
| 4   | Note dans l'alphabet      | `@alphabet.X` + `Y:sound.NOM`                             |
| 5   | Defaut d'acteur           | `@actor X` + `*:sound.NOM`                                |
| 6   | Note pour un acteur       | `@actor X` + `Y:sound.NOM`                                |
| 7   | Occurrence dans une regle | `Y(sound.NOM)`                                            |

Chaque niveau pointe un son nomme ou pose un bloc de proprietes anonyme. La
fusion se fait champ par champ -- cf. l'heritage par cascade.

---

## Conventions de notation — l'espace, le point, le deux-points

Trois signes structurent toute l'écriture : l'**espace** sépare les termes, le **point**
désigne un élément dans un espace de noms, le **deux-points** lie un sujet à une valeur.
Ils gardent le même sens dans la partie déclarative et dans le flux.

### Tableau des signes

| Signe      | Sens                                      | Exemple                                            |
| ---------- | ----------------------------------------- | -------------------------------------------------- |
| espace     | sépare deux termes                        | `@macro souffle (vel:60)`                          |
| collage    | réunit deux termes en un seul             | `@macro accent(x) x(vel:120)`                      |
| `.`        | désigne un élément dans un espace de noms | `sound.cloche`, `alphabet.tabla`, `transport.midi` |
| `:`        | lie un sujet à une valeur                 | `dha:sound.frappe`, `@tempo:120`, `(vel:100)`      |
| `*`        | sujet = tous les terminaux                | `*:sound.cloche`                                   |
| `()`       | paramètres runtime, hérités par cascade   | `sa(vel:80)`, `transport.midi(ch:10)`              |
| `[]`       | instructions moteur, portée locale        | `[mode:random]`, `[/2]`                            |
| `@`        | ouvre une ligne de la partie déclarative  | `@sound`, `@actor`, `@alphabet.tabla`              |
| `->`       | règle de production                       | `S -> C4 D4`                                       |
| `>>` `\>>` | brancher un câble, le couper              | `saw >> lpf >> audio`                              |

### L'espace, délimiteur de termes

Une espace sépare deux termes ; leur **collage** en fait un seul. Partout où deux termes
peuvent se suivre, le collage porte une information et le langage la lit.

| Écriture                      | Lecture                                                  |
| ----------------------------- | -------------------------------------------------------- |
| `@macro accent(x) x(vel:120)` | `(x)` collé au nom = liste de paramètres de la macro     |
| `@macro souffle (vel:60)`     | `(vel:60)` séparé du nom = corps de la macro             |
| `C4[/2]`                      | qualificateur du terminal `C4`                           |
| `C4 D4 [mode:random]`         | qualificateur de la règle entière                        |
| `C4!(vel:100)`                | flux ancré à `C4`, il voyage avec lui (`conjoint: true`) |
| `C4 !(vel:100)`               | flux posé seul dans la séquence (`conjoint: false`)      |
| `{C4 D4}:2`                   | durée du groupe                                          |
| `sitar.sa`                    | le terminal `sa` vu à travers l'acteur `sitar`           |
| `C4 D4 . E4 F4 G4`            | point isolé = frontière entre fragments de durée égale   |

```bpscript
@alphabet.western
@controls
@macro accent(x) x(vel:120)
@macro souffle (vel:60)

S -> C4!accent D4 [mode:random]
Motif -> {C4 D4}:2 E4[/2]
```

### Le point — désigner dans un espace de noms

`espace.nom` nomme un élément à l'intérieur d'un espace. Les espaces de noms sont les
catégories de librairie (`alphabet`, `tuning`, `octaves`, `sound`, `transport`, `eval`,
`mod`), les acteurs, les modules à ports et les étiquettes de groupe.

| Emploi                                                    | Écriture                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| entité de librairie                                       | `alphabet.sargam`, `tuning.sargam_22shruti`, `sound.cloche` |
| directive qui charge une entrée d'un fichier de librairie | `@alphabet.tabla`, `@sub.dhati`                             |
| terminal vu à travers un acteur                           | `sitar.sa`                                                  |
| port d'un module                                          | `lpf.cutoff`                                                |
| contrôle d'un groupe étiqueté                             | `groove.vel`                                                |
| frontière entre fragments, point isolé                    | `C4 D4 . E4 F4 G4`                                          |

Les clés d'entité d'un acteur — `alphabet`, `tuning`, `octaves`, `sound`, `transport`,
`eval`, `voice` — sont des références : chacune s'écrit avec le point, sur sa ligne.

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
| affecter un son à un terminal              | `dha:sound.frappe`           |
| affecter un son au sujet par défaut        | `*:sound.cloche`             |
| poser une propriété sur un nom qui existe  | `@gate dha:midi`             |
| réglage global de scène                    | `@tempo:120`                 |
| paire clé-valeur dans `()` ou `[]`         | `(vel:100)`, `[mode:random]` |
| durée, collée à un terminal ou à un groupe | `C4:2`, `{C4 D4}:2`          |
| étiqueter un groupe polymétrique           | `groove:{C4 D4, E4}`         |

```bpscript
@alphabet.tabla
  *:sound.cloche
  dha:sound.frappe
@sound
  cloche { sample:"bell.wav", dur:400 }
  frappe { sample:"kick.wav", dur:200 }
@tempo:120
@gate dha:midi

S -> dha ti [mode:random]
```

### Deux formes déclaratives : créer un nom, poser une propriété

Toute ligne de la partie déclarative s'ouvre par l'arobase, et la présence du deux-points
dit laquelle des deux formes on écrit.

| Forme                         | Effet                                             |
| ----------------------------- | ------------------------------------------------- |
| `@<directive> <nom> <valeur>` | **crée** un nom                                   |
| `@<directive> <nom>:<cible>`  | pose une **propriété** sur un nom qui existe déjà |

```bpscript
@alphabet.western
@gate C4:midi                              // propriété : C4 est joué par MIDI
@cv env1 mod.adsr(attack:10, decay:200)    // déclaration : env1 est un nom neuf

S -> C4 D4
```

### `*` — le sujet par défaut

En position de sujet, `*` désigne tous les terminaux du territoire où il est écrit :
`*:sound.cloche` donne un son à l'alphabet ou à l'acteur entier, et chaque terminal nommé
ensuite l'affine — c'est l'héritage par cascade, appliqué aux sons (cf. la cascade
d'héritage).

### Séparation des territoires

- **Déclarer** — `@sound`, `@alphabet.X`, `@actor X`, `@template` : ce que l'on écrit une
  fois et que l'on réutilise.
- **Affecter** — `*:sound.X`, `Y:sound.X` : depuis le territoire d'origine du sujet,
  c'est-à-dire l'alphabet ou l'acteur où il est déclaré, ou l'occurrence dans une règle.

---

## Flags — variables d'état et composition conditionnelle

Un flag est une variable entière globale. Il conditionne l'application des règles et se
modifie pendant la dérivation.

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
[NumR+1] S -> S                   // incrémente NumR, active à chaque fois
Motif -> sa re ga
```

Opérateurs de test : `==`, `!=`, `>`, `<`, `>=`, `<=`.
Opérateurs de test et mutation : `+` (incrémente), `-` (décrémente).

La garde est déclarative : la règle **existe** quand la condition est vraie.

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

Opérateurs de mutation : `=` (assigner), `+` (incrémenter), `-` (décrémenter).

En BP3, la mutation devient un marqueur `/…/` placé en fin de règle :

```text
// BPScript                                -> BP3
S -> Motif Cadence [count-1]               -> S --> Motif Cadence /count-1/
S -> Motif Motif [phase=1] [count=2]       -> S --> Motif Motif /phase=1/ /count=2/
```

Le compilateur traduit `[X==N]` en condition BP3 `/X=N/`, et `[X=N]` en assignation BP3 `/X=N/`.

Le délimiteur distingue deux écritures voisines : `!dha` est un `!` suivi d'un symbole, donc
un déclenchement dans le temps ; `[phase=2]` est entre crochets, donc une mutation de flag.

### Exemple : une pièce en trois phases

```bpscript
@alphabet.sargam
@tempo:60

[phase==1] S -> alap S
[phase==2] S -> jor S
[phase==3] S -> jhala

alap -> sa _ re _ ga _ [phase=2]
jor -> {sa re ga pa}:2 [phase=3]
jhala -> {sa re ga pa dha ni sa}:4
```

---

## Déclarations, macros et alias

### Déclarer un symbole : type temporel et runtime

Une déclaration donne à un symbole son rapport au temps — `@gate`, `@trigger`, `@cv` — et le
runtime qui le prend en charge.

```bpscript
@alphabet.sargam
@gate sa:sc                      // sa occupe du temps, SuperCollider le joue
@trigger dha:sc                  // dha est instantané, SuperCollider le joue
@trigger flash:python            // flash est instantané, Python le joue
@cv ramp:sc                      // ramp varie continûment, SuperCollider le joue

S -> sa dha
```

### Un seul espace de noms

Les noms de toutes les sortes de choses vivent dans le **même espace** : terminaux de
l'alphabet actif, têtes de règle, macros, alias, entrées, acteurs, variables de travail,
objets CV, drapeaux. Chaque nom y appartient à **une seule** d'entre elles. Le contrôle a
lieu **à la déclaration** : c'est le fait de déclarer le nom qui tranche, son emploi dans
une règle étant une autre affaire.

Deux énoncés, tous deux globaux :

1. une **tête de règle** porte un nom qui lui appartient en propre parmi toutes les sortes
   ci-dessus ;
2. deux déclarations qui **créent** un nom en portent chacune un différent.

Le critère est l'**effet** de la ligne : entre dans la règle ce qui crée un nom. Une écriture
qui pose une propriété sur un nom existant (`@gate sa:sc`) laisse ce nom à sa sorte d'origine
et reste libre.

Les têtes de règle se rencontrent librement **entre elles**. Une tête répétée est une
**alternative** : le choix et les poids en découlent, et c'est le mécanisme même d'une
grammaire stochastique. Deux sous-grammaires sont des **passes successives** — un même nom y
est le même symbole, réécrit plus tard.

**Renommer en gardant la même musique** : `test/migration_noms.mjs` renomme un nom et tous ses
emplois, puis compare l'arbre dérivé entier avant et après, à graine fixe. Il écrit quand
chaque jeton coïncide.

### `@macro` et `@alias`

Une seule forme pour les deux, comme pour toute directive : `@<directive> <nom> <valeur>`.
Le nom vient d'abord, ce qu'il vaut ensuite.

| Directive | Ce qu'elle fait                                     | Où elle s'emploie          |
| --------- | --------------------------------------------------- | -------------------------- |
| `@macro`  | nomme une transformation, un préréglage, un câblage | à sa place dans une règle  |
| `@alias`  | donne un nom à une chose technique ou répétitive    | dans la partie déclarative |

```bpscript
@alphabet.western
@controls
@macro kick (vel:120)               // préréglage de contrôles
@macro accent(x) x(vel:120)         // transformation paramétrée
@macro fast(x) {x}:2                // transformation structurelle

Motif -> C4 D4 E4
S -> C4!kick D4 E4!accent fast(Motif)
```

La valeur d'un `@alias` est un nom déclaré — macro, `@gate`/`@trigger`/`@cv`, entrée —, une
étiquette de groupe suivie d'un contrôle, ou une adresse OSC. Un nom suivi du deux-points,
placé devant un groupe, étiquette l'ensemble : l'alias désigne alors d'un seul mot un
contrôle porté par tous ses éléments.

```bpscript
@alphabet.western
@controls
@trigger flash:python
@alias eclat flash                  // autre nom pour un symbole déclaré
@alias intensite osc:/sensor/1      // canal OSC nommé
@alias souffle groove.vel           // le vel du groupe étiqueté groove

S -> groove:{C4 D4, E4} F4
```

### Appliquer un nom dans une règle : le point d'exclamation

`!nom` attache le nom au terminal qui le précède : les deux partagent l'instant, et le
terminal porte la durée. Collé ou séparé d'une espace, `!nom` donne le même nœud ; la règle
d'espace joue sur `!(…)`, où le collage ancre le flux au terminal précédent.

```bpscript
@alphabet.western
@controls
@macro kick (vel:120)
@macro accent(x) x(vel:120)

S -> C4!kick D4 E4!accent F4
```

Mesuré : `S -> C4!kick D4` donne **deux** éléments dans le membre droit, `C4` et son attache
partageant le premier ; `S -> C4 kick D4` en donne **trois**, et le nom y occupe son propre pas.

### Câbler : `>>` et `\>>`

`>>` branche, `\>>` coupe. Le câblage initial s'écrit dans `@init`. Un câblage nommé se déclare
avec `@var wire`, et s'écrit
dans le corps d'une `@macro`, et son nom se pose **nu** dans le flux ; le compilateur marque
alors cet élément de la nature « câblage », que l'aval traite comme telle.

```bpscript
@alphabet.western
@var wire principal saw >> lpf >> audio
@macro ouvre lpf.cutoff:12000
@macro coupe saw \>> lpf

S -> C4 ouvre D4 coupe E4
```

Le même traitement vaut pour les trois gestes qui agissent sur un module : brancher, couper,
régler.

---

## Les librairies

Le langage connait ses trois types ; les librairies apportent le vocabulaire.

```bpscript
@core                        // silences, prolongation, controles moteur, defauts de scene
@controls                    // vel, tempo, transpose, ins, chan...
@alphabet.sargam:midi        // sa re ga ma pa dha ni, raccordes a la sortie MIDI
@tuning.sargam_22shruti      // accordage des degres de l'alphabet
@octaves.saptak              // convention de registre : mandra_sa / madhya_sa / taar_sa
@sub.dhati                   // table de substitution dhati
```

**Convention stricte** : la directive nomme l'**axe**, et le `.` designe l'**entree** lue dans le
fichier qui sert cet axe.

- `@alphabet.sargam` -> `lib/alphabets.json`, entree `sargam`
- `@tuning.sargam_22shruti` -> `lib/tunings.json`, entree `sargam_22shruti`
- `@sub.dhati` -> `lib/sub.json`, entree `dhati`
- `@core` -> `lib/core.json`, fichier entier

Cinq axes ont un **catalogue ferme** : `alphabet`, `tuning`, `octaves`, `scale`, `sound`. Sur
ceux-la, une entree se lit dans le catalogue ou le compilateur nomme la faute — `@alphabet.raga`
repond « alphabet 'raga' introuvable dans le catalogue ».

Le `:` d'une directive de librairie raccorde tous ses symboles a une sortie de l'acteur implicite.
Trois canaux sont ouverts : `audio`, `midi`, `osc`.

Les librairies definissent des **noms** et des **identites** ; le runtime produit le son ou le
signal.

### Librairies de FONCTIONS digitales

Au-dela des librairies de **donnees** (alphabets, accordages, octaves, temperaments, controles,
objets CV...), une famille porte du **comportement** : les **fonctions de manipulation digitale**
— les trois transpositions ci-dessous, puis octave/registre, gamme, keyxpand. Une fonction est une
entree `{params, body}` dont le `body` est du **vrai code TS** type, dans une lib
`{type:'digital', objects}` (trois provenances : fournie, perso, communautaire). C'est le **jumeau**
des objets CV : un comportement nomme en librairie, realise par **Kairos** (code discret, a la
resolution) pour le digital, par le **runtime audio** (courbe declarative) pour l'analogique/CV.

L'hote fournit la lib ; **Kairos** la transpile au chargement et l'**applique** sur une **COPIE**
de l'arbre, le nom de fonction lui parvenant opaque. BPScript pose la **forme** de lib et le
**typage a l'ecriture** ; Kairos resout et execute. Spec complete :
`docs/design/DIGITAL_FUNCTIONS.md`.

### Les trois transpositions : `transpose`, `scaleshift`, `chromashift`

BPScript distingue trois gestes de transposition musicologiques.

- **`transpose` — transposition REELLE (chromatique)** : decale l'**ancre** de l'alphabet d'un
  **intervalle fixe**, en preservant tous les intervalles ET le nom de chaque note ; vaut dans
  **tout** accordage (egal, inegal, parametrique). L'argument est un **intervalle** dans l'un des
  3 formats des temperaments : **fraction** `3/2`, **cents** `700c`, **decimal** `1.5` — un entier
  nu vaut un ratio (`2` = octave). Il s'ecrit **nu**, comme toute valeur de controle.
- **`scaleshift` — transposition SCALAIRE (diatonique)** : decale de **N degres** d'alphabet
  (`scaleshift:2` : `sa` -> `ga`), en preservant les degres. Argument = entier N. Le `![rotate]` de
  **structure** (rotation de sequence, moteur BPx) est un autre geste, avec son propre nom.
- **`chromashift` — transposition CHROMATIQUE (grille 12 cles)** : decale de **N cles chromatiques**
  (demi-tons) sur la grille 12, renomme vers la cle cible et prend **son** accordage
  (`chromashift:11` : +11 demi-tons). Argument = entier N. C'est l'**image de BP3 `_transpose(N)`**.

```bpscript
@controls
@alphabet.sargam
@transpose:-2400c                    // scene entiere : deux octaves plus bas
S -> sa re(transpose:700c) ga        // contenance : la quinte tient sur re
T -> sa !(scaleshift:2) re ga        // flux : les suivantes montent de deux degres
U -> sa ga(chromashift:11) pa        // grille 12 : ga part 11 demi-tons plus haut
```

Resolution : Kairos normalise la chaine d'intervalle et applique la transposition reelle en fin de
chaine (facteur multiplicatif de cadre), apres les operations de grille — noms et registres
preserves.

### Plusieurs vocabulaires dans une meme scene

Un acteur porte son propre alphabet, et la notation `acteur.terminal` dit lequel s'applique
(cf. [Acteur](#acteur----unite-de-binding)) :

```bpscript
@actor tabliste
  alphabet.tabla
@actor chanteur
  alphabet.sargam
S -> tabliste.dha chanteur.sa
```

---

## Operateurs temporels BP3

Les operateurs temporels de BP3 gouvernent deux variables internes, `speed` et `scale` : le tempo
effectif vaut `speed / scale`.

| BPScript | Compile en BP3              | Semantique                              |
| -------- | --------------------------- | --------------------------------------- |
| `A[/2]`  | `/2 A`                      | absolu + persistant (fixtempo), speed=2 |
| `A[*3]`  | `_tempo(1/3) A _tempo(1/1)` | relatif, bracket enter/exit, scale×3    |
| `![/2]`  | `_tempo(2/1)`               | relatif, flux (InstantControl)          |

Portee flexible : sur un symbole, un groupe, ou un polymetric.

```bpscript
@alphabet.sargam
S -> sa[/2] re {ga ma}[*3] ![/2] pa
```

---

## Metrique -- `@meter`

BPScript porte la signature rythmique via la directive `@meter`.

```bpscript
@meter:4/4                       // mesure a 4 temps
@meter:7/8                       // mesure a 7 croches
@meter:3+4+2/4                   // mesure additive : 3 + 4 + 2 temps
@tempo:120                       // 120 BPM
```

**Distinction tempo vs metronome :**
- `[tempo:2]` = multiplicateur relatif (double la vitesse courante), en suffixe de terminal, de
  groupe ou de regle
- `@tempo:120` = marquage metronomique absolu (120 BPM)
- `@striated` / `@smooth` = bascule entre temps strie et temps lisse

```bpscript
@meter:4/4
@tempo:120
S -> C4 D4 [tempo:2]
```

---

## Modes, scan et directions -- trois niveaux distincts

| Niveau             | Question                             | BPScript         | Portee              |
| ------------------ | ------------------------------------ | ---------------- | ------------------- |
| **Mode du bloc**   | quelle strategie de selection ?      | `[mode:random]`  | bloc/sous-grammaire |
| **Scan par regle** | dans quel sens chercher le symbole ? | `[scan:left]`    | regle individuelle  |
| **Direction**      | la regle se lit dans quel sens ?     | `->`, `<-`, `<>` | regle individuelle  |

Le mode vaut pour un bloc : il s'ecrit `@mode:<valeur>` en tete de scene, ou `[mode:<valeur>]` en
suffixe de regle. Le scan prend `left`, `right` ou `rnd`.

```bpscript
@alphabet.sargam
@mode:random
S -> sa re [scan:left]
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
S -> sa re ga [on_fail:retry(3)]           // cette regle : reessayer 3 fois
T -> ma pa [on_fail:fallback(ALT)]         // cette regle : basculer vers ALT
ALT -> dha ni
```

---

## Deux philosophies du temps

BP3 possede deux facons de controler le flux temporel (cf. Boulez,
*Penser la musique aujourd'hui*, 1963) :

|               | Smooth time (temps lisse)                 | `_tempo()` (temps strie)               |
| ------------- | ----------------------------------------- | -------------------------------------- |
| **Paradigme** | fonctionnel -- le temps est une propriete | imperatif -- le temps est une commande |
| **Usage**     | alap indien, gagaku, musique non pulsee   | musique occidentale, danse, pop        |
| **BP3**       | `_smooth` + time patterns                 | `_striated` + `_tempo(x/y)`            |

BPScript unifie les deux dans la meme syntaxe via le systeme de types :

```bpscript
@cv ramp:audio                       // ramp est un cv, gere par le runtime audio
S -> {C4 D4 E4}:2                    // palier discret -- la duree du groupe est un nombre
T -> C4!ramp(0,1)                    // continu -- la valeur court le long de la duree de C4
```

| BPScript              | BP3                           | Concept                 |
| --------------------- | ----------------------------- | ----------------------- |
| **gate**              | sound-object (avec duree)     | evenement dans le temps |
| **trigger** (via `!`) | out-time object (duree nulle) | impulsion instantanee   |
| **cv**                | time pattern (smooth time)    | duree comme propriete   |

---

## Compilation vers BP3

Cette section décrit la correspondance entre les constructions BPScript et les
instructions du format de grammaire BP3 (`-gr.`).

> Voir [INTERFACES_BP3.md](../design/INTERFACES_BP3.md) pour l'interface WASM complète.

### Format de grammaire BP3

Structure du fichier :
```text
MODE                           // ORD, RND, SUB, SUB1, LIN, TEM, POSLONG
gram#N[M] LHS --> RHS          // règles
-----                          // séparateur de sous-grammaire
MODE
gram#N[M] LHS --> RHS
```

### Sous-grammaires et modes

Chaque bloc entre `-----` est une sous-grammaire. `@mode:X` déclare le mode de
dérivation du bloc qui suit, jusqu'au séparateur suivant (cf. « Modes, scan et
directions »).

| BPScript        | BP3       | Stratégie de sélection                          |
| --------------- | --------- | ----------------------------------------------- |
| `@mode:ord`     | `ORD`     | ordonné — règles appliquées en séquence         |
| `@mode:random`  | `RND`     | aléatoire — sélection pondérée                  |
| `@mode:lin`     | `LIN`     | linéaire — bouclage cyclique                    |
| `@mode:sub`     | `SUB`     | substitution — toutes les occurrences à la fois |
| `@mode:sub1`    | `SUB1`    | substitution — occurrence la plus à gauche      |
| `@mode:tem`     | `TEM`     | appariement par gabarit                         |
| `@mode:poslong` | `POSLONG` | plus longue correspondance d'abord              |

Les règles sont regroupées par non-terminal et par mode ; un `-----` sépare deux
blocs de modes différents.

En mode `sub` et `sub1`, les symboles du membre gauche sont eux aussi des
terminaux : ce qui reste après les itérations appartient à l'alphabet et se joue.

### Directions

| BPScript | BP3   | Sens                                                       |
| -------- | ----- | ---------------------------------------------------------- |
| `->`     | `-->` | production — le membre gauche est réécrit en membre droit  |
| `<-`     | `<--` | analyse — la séquence droite est réduite au symbole gauche |
| `<>`     | `<->` | production et analyse                                      |

### Symboles terminaux — alphabet plat

BP3 reçoit des **noms opaques** préfixés `bol` et les traite comme des symboles.
La hauteur, l'acteur et le transport se résolvent en amont.

```text
Source BPScript :
  sa re ga pa

Alphabet plat :
  bolsa
  bolre
  bolga
  bolpa

Grammaire BP3 :
  gram#1[1] S --> bolsa bolre bolga bolpa
```

Les noms de notes (`C4`, `sa`, `re`) arrivent dans BP3 comme des objets sonores
silencieux : ils portent une position dans le temps, leur son se résout ailleurs.

### Polymétrie

Transmise telle quelle à BP3 :

```text
// BPScript
S -> { Melodie, Rythme }

// BP3
gram#1[1] S --> {Melodie, Rythme}
```

### Durée sur un groupe

La durée `:N` collée est traduite en cadre polymétrique BP3 :

```text
// BPScript
{C3, E3, G3, C4}:2

// BP3
{2, bolC3, bolE3, bolG3, bolC4}
```

### Durée de portée règle

Posée en fin de règle et séparée du dernier élément par une espace, la durée
porte sur **tout le membre droit** :

```text
// BPScript
S -> C4 D4 E4 :2

// BP3
{2,C4 D4 E4}
```

Trois portées distinctes :

| Écriture        | Portée                 |
| --------------- | ---------------------- |
| `A4:1/2`        | la note seule          |
| `{A B}:2`       | le groupe              |
| `S -> A B C :2` | le membre droit entier |

Une durée collée suit son terminal ou son groupe ; une durée détachée se place en
fin de membre droit.

### Opérateurs temporels

Portée et persistance, en complément de « Opérateurs temporels BP3 » :

```text
// BPScript                  -> BP3                                       Sémantique
A[/2] B C                    -> /2 bolA bolB bolC                         absolu, persistant (fixtempo)
{A B C}[/3]                  -> /3 {bolA bolB bolC}                       idem, portée groupe
A[*2] B C                    -> _tempo(1/2) bolA _tempo(1/1) bolB bolC    relatif, bracket
![/2]                        -> _tempo(2/1)                               relatif, flux (InstantControl)
```

`[/N]` impose la vitesse absolue N et persiste jusqu'au prochain opérateur de
tempo ou jusqu'à la fin du champ ; le séparateur `,` d'un sous-champ polymétrique
la réinitialise. `[*N]` s'applique relativement à la vitesse héritée, et la sortie
du bracket (`_tempo(1/1)`) restaure l'hérité. `![/N]` dans le flux vaut
`_tempo(N/1)` relatif, sans fixtempo.

### Gardes et flags

La garde se teste avant le membre gauche avec `==` ; la mutation s'écrit en fin de
règle.

```text
// BPScript                              -> BP3
[phase==1] S -> sa re ga pa             -> /phase=1/ gram#N[M] S --> bolsa bolre bolga bolpa
[Ideas-1] Ideas -> R1 C4 R2             -> /Ideas-1/ gram#N[M] Ideas --> R1 bolC4 R2
S -> C4 D4 E4 [count+1]                 -> gram#N[M] S --> bolC4 bolD4 bolE4 /count+1/
[phase==1] S -> ga re [phase=2]         -> /phase=1/ gram#N[M] S --> bolga bolre /phase=2/
```

### Poids

```text
// BPScript                              -> BP3
S -> A B C [weight:50]                   -> <50> gram#N[M] S --> bolA bolB bolC
```

### Contrôles runtime `()`

Un paramètre runtime est porté sur l'événement comme une annotation opaque,
jusqu'au runtime de sortie. Dans l'AST, il vit sur le nœud :
`RuntimeQualifier{pairs:[{clé, valeur}]}` en suffixe, `InstantControl` dans le
flux. Le contrôle natif BP3 correspondant est `_script(CT n)`.

```text
// BPScript                              -> BP3
sa(vel:120)                              -> _script(CT 0) bolsa
Bass -> C2 C2 - C2 (vel:100)             -> gram#N[M] Bass --> _script(CT 1) bolC2 bolC2 - bolC2
{A B}(filter:300)                        -> {_script(CT 2_start) bolA bolB _script(CT 2_end)}
```

Trois portées, distinguées par la place du sac : collé au terminal
(`C4(vel:120)`), espacé en fin de membre droit (portée règle), collé au groupe
(`{A B}(…)`).

### Cascade des contrôles

Quand plusieurs sources donnent le même paramètre, la valeur retenue vient du
niveau le plus élevé qui le précise (cf. « Cascade — 8 niveaux ») :

1. **spec** — défauts de la librairie ;
2. **`()`** — contrôle écrit en ligne, qui surcharge la spec ;
3. **CV** — objet temporel continu, priorité la plus haute.

La cascade s'applique à chaque événement daté.

### Silences et prolongation

Transmis directement :
```text
// BPScript    -> BP3
-              -> -
_              -> _
...            -> ... (repos indéterminé)
```

### Notation par périodes

Transmise directement :
```text
// BPScript                    -> BP3
S -> A B . C D . E F           -> gram#N[M] S --> bolA bolB . bolC bolD . bolE bolF
```

### Liaisons

`~` en BPScript → `&` en BP3 :
```text
// BPScript                    -> BP3
C4~ D4 E4 ~C4                 -> bolC4& bolD4 bolE4 &bolC4
```

### Captures

`?n` → métavariables BP3 :
```text
// BPScript                            -> BP3
?1 Motif ?1 -> ?1 Autre ?1             -> ?1 Motif ?1 --> ?1 Autre ?1
```

### Gabarits et transcriptions (homomorphismes)

`$` → `(=X)` et `&` → `(:X)`. Les noms de transcription entre maître et esclave
sont émis entre `(=X)` et `(:X)` dans la grammaire BP3.

```text
// BPScript                              -> BP3
S <> $mel &mel                           -> S <-> (=mel) (:mel)
S -> $X dha &X                           -> S --> (=X) dha (:X)
S -> $X * &X                             -> S --> (=X) * (:X)
S -> $X * TR &X                          -> S --> (=X) * TR (:X)
Qaida <> $ {plus S64 fin}                -> Qaida <-> (= + S64 ;)
```

**Contrat BPx** : les paires source→cible sont portées dans `Scene.homomorphisms[]`
(tableau de `HomomorphismDeclAST`). BPx consomme ce tableau post-dérivation via
`rewriteHomomorphismMarkers` pour appliquer les transformations de terminaux.

> Voir [HOMOMORPHISMS.md](../design/HOMOMORPHISMS.md) pour l'architecture complète.

### Contextes

```text
// BPScript                    -> BP3
(A B) C -> D E                 -> (A B) C --> D E
#(X Y) Z -> W                  -> #(X Y) Z --> W
```

La correspondance du `#` est terme à terme : les deux moteurs traitent `#X` comme
un symbole apparié qui **occupe une position** (cf. « `#X` … CONSOMME une
position » plus haut).

### Variables liées `|x|`

```text
// BPScript                    -> BP3
|x| S x -> x S                 -> |x| S x --> x S
```

### Out-time objects

`!symbole` autonome → `<<symbole>>` :
```text
// BPScript                    -> BP3
Y -> !f                        -> Y --> <<f>>
```

### Backticks

Un backtick autonome est un terminal de plein droit du membre droit : il est
encodé comme terminal spécial dans la grammaire. Un backtick en valeur de
paramètre voyage avec sa paire jusqu'au runtime qui l'évalue.

---

### Méta-grammaires — réécriture structurelle

BP3 est un système de réécriture de chaînes : `{`, `}`, `,` peuvent apparaître
comme terminaux bruts. Une accolade appariée dans la même règle forme un
polymétrique ; seule, elle est une accolade brute (`RawBrace`).

```text
// BPScript : koto3 — automate cellulaire avec méta-réécriture
#({) a b a -> {a c b, f f f - f}:5   // contexte négatif sur {
} -> }                                // { et } comme terminaux
, -> ,                                // , aussi
```

Deux usages distincts :
- **Distribution** : `{` et `}` répartis sur plusieurs règles, formant un
  polymétrique valide après dérivation. La durée `}:N` sur `}` est propagée au `{`
  correspondant.
- **Méta-grammaire** : `{`, `}`, `,` comme terminaux matchables sur le membre
  gauche et dans les contextes `#({)`. La grammaire construit des polymétriques
  par réécriture.

La validation structurelle des `{}` est **repoussée au moteur BP3**.

---

### Métrique en ligne

```text
// BPScript                              -> BP3
S <> S96 [meter:4+4/6]                   -> S <-> S96 4+4/6
S -> P1 P2 P3 [meter:4+4+4+4+4+4/4]      -> gram#N[M] S --> P1 P2 P3 4+4+4+4+4+4/4
```

---

### Symboles quotés BP3

Les symboles quotés d'une grammaire BP3 (`'1'`, `'texte'`) sont renommés à la
traduction : `'1'` devient `d1`.

---

## Documents liés

- [EBNF.md](EBNF.md) — grammaire formelle EBNF
- [AST.md](AST.md) — structure de l'AST
- [INTERFACES_BP3.md](../design/INTERFACES_BP3.md) — interface WASM complète (in/out)
- [ARCHITECTURE.md](../design/ARCHITECTURE.md) — architecture technique
- [CV.md](../design/CV.md) — CV / objets de signal
- [PITCH.md](../design/PITCH.md) — architecture 5 couches de hauteur
- [HOMOMORPHISMS.md](../design/HOMOMORPHISMS.md) — homomorphismes



