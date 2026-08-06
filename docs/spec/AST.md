# BPScript — l'arbre de syntaxe abstraite

Ce document décrit ce que **l'arbre porte**. `LANGUAGE.md` dit le sens du langage ; `EBNF.md` en dit
la forme écrite.

**Les noms de nœuds et de champs sont en anglais** — c'est du code. La prose qui les décrit reste en
français. Un nom de nœud est **interne** : ce que l'auteur d'une scène écrit vit dans `LANGUAGE.md`,
et les deux n'ont pas à coïncider.

## Conventions

- Chaque nœud porte un `type` et les propriétés de sa sorte.
- La position source — ligne, colonne — est attachée à chaque nœud, pour les messages.
- `null` marque une propriété absente. **Absent et vide disent deux choses** : un champ omis dit
  que le producteur l'ignore, une liste vide dit qu'il le sait et que le compte est zéro.

---

## Nœud racine

### `Scene`

```
Scene {
  type: "Scene"
  directives: Directive[]            // invocations de librairie et de réglage
  actors: ActorDirective[]
  vars: VarDirective[]
  defs: DefDirective[]
  init: InitEntry[] | null           // le bloc @init ; null si la scène n'en a pas
  subgrammars: Subgrammar[]
  template: TemplateEntry[] | null   // le catalogue des formes
  homomorphisms: HomomorphismDecl[]
  backticks: BacktickOrphan[]
  libRefs?: string[]                 // invocations par provenance, adresses opaques
  noteTerminals?: string[]           // les noms de cette scène qui SONT des notes
  alphabetTerminals?: string[]       // les noms qui sont des terminaux sans hauteur
}
```

### `noteTerminals` et `alphabetTerminals` — l'arbre dit lui-même ce qui est une note

Deux listes plates de noms nus, au niveau scène : les noms **présents dans la scène** que le frontal
reconnaît comme des notes de l'alphabet actif, et ceux qu'il reconnaît comme des terminaux d'un
alphabet qui ne résout aucune hauteur — frappes, symboles abstraits. **Deux sources, deux sens ; les
fondre est interdit.**

Ce n'est ni un catalogue ni une table : c'est la **résolution déjà faite**, pour cette scène-là. Le
critère vient de la donnée : un alphabet qui déclare un accordage résout une hauteur.

**Absent et vide disent deux choses.** Le champ absent dit que la résolution d'un alphabet est hors
de portée ici — le producteur l'ignore. La liste vide dit qu'un alphabet est en portée et que le
compte est zéro — c'est un fait.

Un nom présent dans les deux listes est traité comme **note**. Une tête de règle nommée comme une
note y figure : c'est le cas que l'aval cherche, pour l'écarter de sa lecture de structure. Ces
listes portent ce qui sonne ; une attente, qui suspend le temps, vit ailleurs.

### `libRefs` — invocation de librairie par provenance

Une librairie est un **fichier** qui déclare son domaine dedans. L'invocation nomme la provenance,
le chemin de fichier et l'entrée — le dernier segment est l'entrée. Le domaine se lit en aval :
BPScript **porte** l'adresse, il ne la résout pas.

Chaque élément est une **adresse canonique opaque**, pré-normalisée. L'ordre d'apparition source est
préservé et les doublons sont retirés à l'émission. `factory` et `mine` sont des préfixes réservés.

Une référence de provenance nomme une librairie de hauteur ; elle ne porte aucune sortie. Pour
sonner, la scène déclare un acteur avec la sienne.

---

## La partie déclarative

### `ActorDirective`

```
ActorDirective {
  type: "ActorDirective"
  name: string
  properties: {
    alphabet: string              // la collection de terminaux que l'acteur joue
    tuning: string | null         // l'accordage qui donne une fréquence à chaque degré
    octaves: string | null        // la convention de registre
    transport: OutputRef | null   // par où l'acteur sort — ÉCRIT `out.<canal>`
    eval: string | null           // le langage par défaut de ses backticks
  }
  references: ActorReference[]
  synthetic?: true
  line: number
}

OutputRef {
  type: "OutputRef"
  key: string                     // le canal : audio, midi, osc, dmx
  params: { [key: string]: any }  // l'adresse : { ch: 10 }, { device: "reaper", ch: 7 }
}

ActorReference {
  type: "ActorReference"
  category: "alphabet" | "tuning" | "octaves" | "transport" | "eval"
  name: string
  params?: { [key: string]: any }
}
```

Un acteur porte **cinq clés**. Chacune se lit dans un catalogue, et ce qui n'est pas écrit, l'acteur
l'hérite de la scène. `properties` est la forme interne ; `references` est la forme consommée en
aval, dérivée sans perte.

Le canal de sortie s'écrit `out.<canal>` et **le champ interne s'appelle `transport`**.

Une clé absente manque du champ.

**L'acteur implicite.** Quand une scène ne déclare aucun acteur, l'arbre en porte un nommé `default`,
marqué `synthetic`, sans alphabet. Une scène simple emprunte ainsi le même chemin qu'une scène à
plusieurs acteurs — un seul acteur est le cas d'un.

### `VarDirective`

```
VarDirective {
  type: "VarDirective"
  names: string[]                  // un nom, ou plusieurs quand la ligne les énumère
  varType: VarType | null          // null = une variable sans type
  line: number
}

VarType =
    { kind: "flag",       states: { name: string, value: number }[] }
  | { kind: "in",         channel: "midi" | "osc" | "keyboard" }
  | { kind: "convention", convention: "signal" | "pitch" | "phase" | "logic" }
  | { kind: "module",     module: string }
```

Une variable porte un **type** qui dit ce qu'elle est. Le nom vient d'abord, le type ensuite.

| type          | ce que la variable porte                                                            |
| ------------- | ----------------------------------------------------------------------------------- |
| `flag`        | un état entier, avec ses valeurs nommées ; les règles s'y conditionnent             |
| `in`          | une valeur qui vient du dehors : un **rôle**, et le canal qui l'apporte             |
| `convention`  | un flux de nombres, et la façon dont le récepteur le lit                            |
| `module`      | une **instance** de ce module — elle ne porte aucun corps propre                    |
| *(aucun)*     | un symbole du flux qui n'est ni une note ni un nom de règle                         |

Un flag déclare ses états en même temps que lui-même, et l'encodeur résout ensuite les noms en
entiers. Une entrée nomme un **rôle** ; l'appareil qui le remplit s'y associe hors de la scène.

**Une variable sans type porte la nature `var` dans le flux.** L'aval la porte opaquement, et la
résolution la laisse telle quelle.

### `DefDirective`

```
DefDirective {
  type: "DefDirective"
  name: string
  params: string[]                 // [] quand la définition n'en prend pas
  convention: "signal" | "pitch" | "phase" | "logic" | null
  body: DefBody
  line: number
}

DefBody =
    { kind: "terminal", proto: TerminalProto }         // @def cloche  degree:0  voice.sombre
  | { kind: "patch",    expr: PatchExpr }              // @def sombre lpf1 >> vca1
  | { kind: "setting",  bag: SettingBag }              // @def kick (vel:120)
  | { kind: "code",     backtick: BacktickInline }     // @def fondu phase `js: …`
  | { kind: "elements", body: RhsElement[] }           // @def cadence sa re ga pa

TerminalProto {
  runtime: string | null           // le canal de sortie
  sounding: boolean | null
  duration: number | null
  degree: number | null            // la hauteur, résolue par accordage et registres
  register: string | number | null
  hz: number | null                // la hauteur, déjà connue
  voice: string | BacktickInline | null   // la réalisation
  tuning: string | null            // le système de hauteur qu'il emprunte
  octaves: string | null
}
```

**Un corps de sorte `terminal` déclare un terminal qui vit au niveau de la scène.** Il y nomme
lui-même son système de hauteur, sa sortie et sa voix, et prend de la scène ce qu'il laisse de côté.

**Deux axes le qualifient, indépendamment** : d'où vient sa **hauteur** — `degree` et `register`
résolus par les librairies, ou `hz` déjà connue — et par quoi il se **réalise** — `voice`, ou du
code. Chacun peut rester vide, et toutes les combinaisons ont un sens.

Sa hauteur vit dans ses champs : `degree` et `register` la font résoudre par les librairies, `hz` la
donne directement.

`@def` associe un nom à un corps, pour le réinvoquer d'un mot. Le nom vient d'abord, ce qu'il vaut
ensuite. La liste de paramètres se distingue d'un corps entre parenthèses par le **collage** :
collée au nom c'est une liste, séparée par une espace c'est le corps.

Un nom dont le corps est un `PatchExpr` porte la nature **`wire`** dans le flux, et non `sounding` :
brancher, couper et régler agissent sur un module sans produire de son, donc sans durée.

### `InitEntry`

```
InitEntry = PatchExpr | BacktickOrphan
```

`@init` porte ce qui existe au démarrage de la scène et n'appartient à aucune déclaration : le
branchement initial, le code lancé une fois, les valeurs de départ. Ce qui appartient à une chose
s'initialise dans sa déclaration ; `@init` recueille ce qui appartient à la scène entière.

### Le langage de patch

```
PatchExpr = PatchChain | PatchSwitch | PortAssignment

PatchChain {
  type: "PatchChain"
  nodes: PatchNode[]               // les étages, dans l'ordre écrit
  links: PatchLink[]               // un de moins que d'étages
}

PatchNode {
  type: "PatchNode"
  name: string                     // "lpf1", ou "out" pour le puits
  port: string | null              // le port nommé : lpf1.cutoff
}

PatchLink {
  type: "PatchLink"
  cut: boolean                     // false = brancher `>>`, true = couper `\>>`
  width: number                    // la largeur du câble ; 1 quand aucun nombre n'est écrit
}

PatchSwitch {
  type: "PatchSwitch"
  target: string
  on: boolean                      // switchon / switchoff
}

PortAssignment {
  type: "PortAssignment"
  target: string                   // l'instance
  port: string
  value: string | number
}
```

Le puits d'une chaîne s'écrit `out` : il désigne la sortie de l'acteur, dont le canal est celui que
l'acteur déclare. Un module a une entrée et une sortie par défaut ; quand elles suffisent, la chaîne
se lit sans les nommer, et `port` vaut `null`.

**Une inadéquation de largeur s'adapte** : un port à une voix prend la première, un port à plusieurs
voix alimenté en une seule diffuse cette valeur sur toutes, et une largeur qui dépasse ce que le
port accepte se ramène à ce nombre.

### `Directive` — invocations de librairie et de réglage

```
Directive {
  type: "Directive"
  name: string                    // "core", "alphabet", "tuning", "time", "engine"…
  subkey: string | null           // l'entrée, après le point
  binding: string | null          // la valeur après le `:` — sur un alphabet, le runtime de sortie
  value: string | number | null   // 120, "7/8", -24…
  line: number
}
```

Une librairie s'invoque par son nom, l'entrée après le point. Un réglage s'écrit par sa catégorie,
l'entrée après le point. Le deux-points affecte une valeur ; sur un alphabet et ses terminaux, c'est
le runtime de sortie, pris parmi `audio`, `midi`, `osc` et `dmx`.

**Le préfixe est optionnel** : un nom nu passe s'il vit dans une seule librairie invoquée. La
résolution est **statique**, et la compilation nomme les deux candidats.

### `HomomorphismDecl`

```
HomomorphismDecl {
  type: "Homomorphism"
  name: string                      // le nom de la section
  pairs: [string, string][]         // paires plates source → cible
  line?: number
}
```

Une table porte des correspondances symbole vers symbole, appliquées à la dérivation, et l'étiquette
de la section est le nom de l'homomorphisme. Une section déclarée en **chaîne** se déplie en paires
consécutives à la lecture ; l'arbre ne porte que les paires. Quand deux écritures visent la même
source, la dernière gagne. Les paires identité sont conservées.

**Invocation par symbole nu.** Le symbole dont le nom est celui d'une section chargée devient un
marqueur : le nœud du flux reçoit `role: "homomorphism"`, et sa **répétition** encode la profondeur.
La précédence de résolution est terminal, puis nom de règle, puis homomorphisme — le marqueur n'est
posé que si le nom n'est ni l'un ni l'autre.

---

## Sous-grammaires et catalogue

### `Subgrammar`

```
Subgrammar {
  type: "Subgrammar"
  rules: Rule[]
  index: number
  mode: "ord" | "random" | "lin" | "sub" | "sub1" | "tem" | "poslong" | null
}
```

Les règles d'une même sous-grammaire partagent le mode. Deux sous-grammaires sont des **passes
successives** : un même nom y est le même symbole, réécrit plus tard.

En mode `sub` et `sub1`, les symboles du membre gauche sont eux aussi des terminaux — ce qui reste
après les itérations appartient à l'alphabet et se joue.

### `TemplateEntry`

```
TemplateEntry {
  type: "TemplateEntry"
  index: number                    // le rang dans le catalogue
  scale: string                    // "/1", "*3/2" — l'échelle ; "/1" quand elle est omise
  body: TemplateElement[]
}

TemplateElement = TemplateSlot | TemplateFragment | TemplateBracket

TemplateSlot { type: "TemplateSlot", count: number }
TemplateFragment   { type: "TemplateFragment" }
TemplateBracket  { type: "TemplateBracket", index: number, body: TemplateElement[] }
```

Le moteur explore les formes que la grammaire permet et les écrit ici ; le rang est la place dans
cette énumération, et c'est lui que l'analyse rend pour dire quelle forme a répondu. Le mode `tem`
fait l'appariement structurel sur ce catalogue, dans l'ordre des rangs.

---

## Règles

### `Rule`

```
Rule {
  type: "Rule"
  guard: Guard[] | null            // plusieurs gardes se lisent comme un ET
  contexts: Context[]
  lhs: LhsElement[]
  arrow: "->" | "<-" | "<>"
  rhs: RhsElement[]
  flags: FlagExpr[]                // les mutations, émises en fin de règle
  settings: SettingBag | null // le sac de portée règle
  scan: "left" | "right" | "rnd" | null   // null = le défaut, `rnd`
  line: number
}
```

| Direction | Sens                                                            |
| --------- | --------------------------------------------------------------- |
| `->`      | **production** — le membre gauche est réécrit en membre droit   |
| `<-`      | **analyse** — la séquence droite est réduite au symbole gauche  |
| `<>`      | **production et analyse** — la règle vaut dans les deux sens    |

### `Guard`

```
Guard {
  type: "Guard"
  flag: string
  operator: "==" | "!=" | ">" | "<" | ">=" | "<=" | "+" | "-" | null
  value: number | string | null
  mutates: boolean
}
```

La garde décide si la règle **existe** pour cette dérivation. Avec `+` et `-`, elle tient deux temps
dans cet ordre : le test rend la règle candidate tant que le drapeau est strictement positif, puis
la mutation s'applique au moment où la règle est retenue. Le drapeau vaut donc encore sa valeur
d'avant pendant tout le test. Un drapeau seul teste qu'il vaut autre chose que zéro.

### `FlagExpr`

```
FlagExpr {
  type: "FlagExpr"
  flag: string
  operator: "=" | "+" | "-"
  value: number | string
}
```

Une mutation est **hors-temps** : elle s'applique au déclenchement de la règle, pendant la
dérivation. Sa position se lit dans la règle ; la séquence jouée reste inchangée.

### `Context`

```
Context { type: "Context", positive: boolean, symbols: string[] }
```

La parenthèse regarde sans prendre ; le dièse collé à un symbole occupe la place. Un contexte
négatif est un contexte **avec un signe** — c'est le champ `positive` qui le porte. Les wildcards
sont acceptés dans les groupes.

Un contexte négatif est placé **dans le membre gauche**, à sa position, parce qu'il consomme un
emplacement.

---

## Éléments

```
LhsElement = Symbol | Wildcard | Context | TemplateAnchor | RawBrace

RhsElement = Symbol | SymbolCall | SymbolWithWait | Rest | Prolongation | UndeterminedRest
           | Period | NumericDuration | Polymetric
           | SimultaneousGroup | OutTimeObject | InstantControl | Wait
           | Wildcard
           | TemplateMaster | TemplateMasterGroup | TemplateSlave | TemplateSlaveGroup
           | TemplateAnchor
           | TieStart | TieContinue | TieEnd
           | NilString | BacktickStandalone | Context | RawBrace
```

Tout élément du membre droit peut porter des suffixes, **toujours collés à droite** :

```
RhsElement {
  …                                          // les propriétés de sa sorte
  suffixQualifiers: SettingBag[] | null
}
```

Le tokenizer marque chaque token d'un drapeau `spaceBefore` : c'est lui qui tranche l'attache. Une
parenthèse **sans** espace avant s'attache comme suffixe à l'élément précédent ; espacée en fin de
règle, elle qualifie la règle.

### Symboles

```
Symbol      { type: "Symbol", name: string, actor: string | null,
              payload: { nature: "sounding" | "var" | "wire" | "wait" },
              role: "homomorphism" | null,
              line: number }
SymbolCall  { type: "SymbolCall", name: string, actor: string | null, args: Arg[], line: number }
Arg         { type: "Arg", key: string | null, value: Literal | BacktickInline }
Literal     { type: "Literal", value: number | string }
```

Le champ `actor` est rempli par le point explicite — `sitar.sa` —, ou par la résolution quand un
seul acteur porte ce symbole. Il vaut `null` pour un non-terminal, qui n'a pas d'acteur.

**La nature dit ce que le jeton est pour le temps**, et la liste est fermée : `sounding` pour ce qui
sonne, `var` pour une variable sans type, `wire` pour un nom dont le corps est un câblage, `wait`
pour un point d'attente. Elle vit dans `payload`, sur le nœud posé dans le flux.

**Le rôle** vaut `homomorphism` sur le symbole dont le nom est celui d'une section chargée, et
`null` sur tout autre symbole.

Un **objet sonore composé** est un unique `Symbol` dont le nom est la concaténation sans blancs de
son contenu : le contenu interne fait partie du nom, opaque à la dérivation.

### Silences, temps et durée

```
Rest             { type: "Rest" }               // occupe une position, le temps s'écoule
Prolongation     { type: "Prolongation" }       // étend l'événement précédent
UndeterminedRest { type: "UndeterminedRest" }   // durée calculée par le moteur
Period           { type: "Period" }             // frontière entre fragments de durée égale
NumericDuration  { type: "NumericDuration", numerator: number, denominator: number }
```

Un nombre nu posé dans le flux est un silence, et le nombre en donne la durée. Un entier nu donne
`denominator` à 1.

### `Polymetric`

```
Polymetric {
  type: "Polymetric"
  voices: RhsElement[][]                     // une voix est une séquence plate
  frame: string | number | null              // la durée du bloc, posée par le `:` collé
  settings: SettingBag | null          // le sac collé au `}`
}
```

Les accolades portent la polymétrie — plusieurs voix séparées par la virgule — et le groupement
temporel — une seule voix. La durée collée donne le **ratio du cadre** : elle vit dans `frame`, et
c'est là, et nulle part ailleurs, que le consommateur la lit.

### Simultanéité et instantané

```
SimultaneousGroup {
  type: "SimultaneousGroup"
  primary: RhsElement
  secondaries: RhsElement[]
}

OutTimeObject  { type: "OutTimeObject", name: string }

InstantControl {
  type: "InstantControl"
  qualifier: SettingBag | SpeedChange
  conjoint: boolean                // true quand le `!` est collé au terminal précédent
}

SpeedChange {
  type: "SpeedChange"
  operator: "/" | "*"
  value: number | string           // entier, décimal, ou fraction
}
```

Le **primaire** donne la position et la durée ; les **secondaires** partagent son instant d'attaque
et prennent sa durée. Un objet hors-temps tient sa place dans l'ordre joué pour une durée nulle.

`conjoint` porte l'attache que l'espace tranche : collé au terminal précédent, le réglage voyage
avec lui et se réplique avec lui ; séparé par une espace, il se pose seul dans la séquence. En tête
de règle ou de groupe, il se pose seul.

Un réglage posé dans le flux vaut pour ce qui **suit**, au-delà des bords de règle, jusqu'au
prochain sac. Le flux est un **état courant** : une note échantillonne la valeur en vigueur à son
instant d'attaque, et sa portée est **par voix**.

`/N` accélère, et `*N/M` écrit la même chose en fraction inverse : `*a/b` vaut `/(b/a)`.

### `Wait` et `SymbolWithWait` — le point d'attente

```
Wait {
  type: "Wait"
  name: string                       // le rôle attendu
  address: string | number | null    // l'adresse collée : <!sync1.60
  suffixQualifiers: SettingBag[] | null
  payload: { nature: "wait" }
}

SymbolWithWait {
  type: "SymbolWithWait"
  symbol: Symbol
  triggers: Wait[]
}
```

Le point d'attente est un élément **de plein droit** du membre droit, à sa position dans la
séquence. Sa nature dit ce que le jeton est pour le temps.

Une attente **suspend** le temps là où un silence l'**occupe** : durée zéro, la grille reste où
elle est. Le symbole porteur **garde sa nature**, et le point d'attente s'ancre sur lui.

L'adresse dit ce qu'elle **est** par son type : un nombre est le numéro brut de l'appareil, un
identifiant est l'étiquette produite par la table de correspondance.

### Wildcards et barres

```
Wildcard { type: "Wildcard", index: number | null }   // `?` nu, ou `?n`
```

`?` désigne une **place**, prend le symbole qui s'y trouve, et cette place est consommée. Le numéro
lie toutes les occurrences du même numéro dans une règle au même symbole ; le `?` nu prend chaque
place indépendamment. Une règle en porte jusqu'à 32 numérotés.

Un nom **entre barres** s'abaisse en `Symbol`. Les barres délimitent le nom d'un non-terminal, et
autorisent une initiale minuscule là où le nom serait pris pour un terminal.

### Gabarits

```
TemplateMaster      { type: "TemplateMaster", name: string, args: Arg[] | null }
TemplateMasterGroup { type: "TemplateMasterGroup", elements: RhsElement[] }
TemplateSlave       { type: "TemplateSlave", name: string, args: Arg[] | null }
TemplateSlaveGroup  { type: "TemplateSlaveGroup", elements: RhsElement[] }
TemplateAnchor      { type: "TemplateAnchor", kind: "master" }
```

Un gabarit est une production dont les terminaux sont effacés ; ce qui reste est sa structure. Le
maître capture, l'esclave rejoue, et le nom porte l'appariement. **L'esclave rejoue le choix du
maître** : quand le nom capturé désigne une règle à plusieurs alternatives, les deux invocations
donnent la même.

Les paramètres d'une invocation gouvernent l'expansion de ce qu'elle produit, et ne débordent pas —
même régime de contenance que le groupe et la règle.

L'**ancre** marque la règle entière comme gabarit maître et reste ouverte jusqu'à sa fermeture. Les
groupes s'imbriquent.

### Liaisons et chaîne vide

```
TieStart    { type: "TieStart", symbol: string }
TieContinue { type: "TieContinue", symbol: string }
TieEnd      { type: "TieEnd", symbol: string }
NilString   { type: "NilString" }
```

### Backticks

```
BacktickInline     { type: "BacktickInline", code: string, tag: string | null }
BacktickStandalone { type: "BacktickStandalone", tag: string | null, actor: string | null,
                     code: string, line: number }
BacktickOrphan     { type: "BacktickOrphan", tag: string, code: string, line: number }
```

Le tag nomme le **langage**, et le langage nomme son **`interpreter`**. Le tag et le code sont
séparés à l'analyse.

Un backtick de tête exige son tag. Un backtick de flux peut s'en passer quand un acteur le qualifie
par le point — `` drums.`…` `` — : il prend l'`eval` de cet acteur, que le champ `actor` porte, et
un tag explicite gagne sur l'héritage. Un backtick de flux sans tag ni acteur qui le qualifie est un
orphelin, et la compilation le nomme.

Un backtick autonome est un **terminal de plein droit** : il occupe une position dans le flux comme
une note. Un langage dit en librairie s'il sonne et s'il occupe du temps ; une occurrence surcharge
ces défauts avec un sac.

### `RawBrace`

```
RawBrace {
  type: "RawBrace"
  value: "{" | "}" | ","
  frame: string | number | null    // la durée collée, propagée depuis la fermante
}
```

Émise quand une accolade ou une virgule paraît comme terminal brut, sans former un bloc équilibré
dans la même règle. Les accolades peuvent être déséquilibrées à travers plusieurs règles, la durée
se propageant de la fermante vers l'ouvrante correspondante.

---

## Les réglages

### `SettingBag`

```
SettingBag {
  type: "SettingBag"
  pairs: Setting[]
}

Setting {
  key: string                      // le nom du réglage ; il porte son destinataire
  component?: string | number      // le composant nommé par le point : (cc.98:45), (lpf1.cutoff:400)
  subject?: string                 // le sujet : "*", ou un nom de terminal
  value: string | number | boolean // true pour une clé nue
  line: number
  col: number
}
```

**Le nom d'un réglage suffit à savoir où il va** : chaque nom appartient à une librairie, et chaque
librairie a un destinataire. Les paires sont portées **opaquement** — l'arbre les transporte, il ne
les interprète pas.

Le **sujet** cible plus finement qu'une paire nue, et vaut **par paire** : absent, c'est la portée
elle-même comme unité ; `*` désigne chaque terminal de la portée ; un nom désigne les terminaux de
ce nom. Pour un signal, le sujet décide l'**horloge** ; pour un réglage statique, les deux écritures
donnent le même effet.

Le **composant** est ce que le point appelle à l'intérieur d'une clé. Quels contrôles en portent un
est déclaré en librairie.

### Portées d'attachement × nœud — le contrat

Un suffixe s'attache à une **base** de portées, que l'espace et le `!` désambiguïsent. Cette base
vaut comme socle : **chaque élément déclare quelles portées lui sont valides, et vers quel nœud il
se traduit pour chacune.** Ce tableau est le contrat que lisent les consommateurs de
l'arbre ; c'est là, et nulle part ailleurs, qu'ils lisent la valeur.

Les cinq portées : `terminal` (collé) · `groupe` (collé au `}`) · `règle` (espacé, en fin de membre
droit) · `!accolé` (collé, flux conjoint) · `!inline` (espacé, événement séparé).

| Élément | terminal | groupe | règle | !accolé | !inline | Nœud |
|---------|:---:|:---:|:---:|:---:|:---:|------|
| **durée `:N`** | ✅ | ✅ | ❌ | ❌ | ❌ | `Polymetric.frame` — le terminal ou le groupe est emballé |
| **réglage `(clé:val)`** | ✅ | ✅ | ✅ | ✅ | ✅ | `…suffixQualifiers` · `Rule.settings` · `Polymetric.settings` · `InstantControl` |
| **vitesse `(/N)` `(*N/M)`** | ❌ | ❌ | ❌ | ❌ | ✅ | `SpeedChange`, dans un `InstantControl` |
| **garde `[…]`** | ❌ | ❌ | ✅ | ❌ | ❌ | `Rule.guard` |
| **mutation `[…]`** | ❌ | ❌ | ✅ | ❌ | ❌ | `Rule.flags` |

Une portée invalide pour un élément est une **erreur nommée** : une durée isolée dans le flux
arrête la compilation.

**Précédence**, du plus fort au plus faible : réglage de note > flux `!(...)` > portée `(...)` >
défauts de déclaration.

### Comment une valeur se résout

Une propriété se résout par **cascade** : plusieurs niveaux la posent, du plus général au plus
spécifique, et le niveau le plus spécifique qui la mentionne l'emporte. La fusion se fait **champ
par champ** — un niveau qui laisse un champ de côté laisse passer celui du dessous. Ce qu'un niveau
ne pose pas, il le tient par **héritage** du niveau qui le contient.

| Niveau    | Ce qu'il fixe                                     |
| --------- | ------------------------------------------------- |
| global    | les défauts communs à toutes les scènes           |
| librairie | les défauts d'un alphabet, d'un accordage, d'un son |
| scène     | ce dont héritent tous les acteurs                 |
| acteur    | ce que cet acteur emploie                         |
| règle     | ce qui vaut pour toute la production              |
| terme     | ce qui vaut pour ce terme                         |

Quand plusieurs portées posent le **même paramètre** sur une même note, les réglages **s'empilent en
série**, de l'intérieur vers l'extérieur. Une valeur simple ne s'empile pas : le plus local gagne.
Un filtre se traverse, une intensité se choisit.

### Les défauts d'environnement

La transpilation prend un **environnement** en second paramètre. Pour chaque réglage absent de la
scène, l'arbre reçoit le défaut **en dur** à la création : il se suffit, et le moteur dérive depuis
une structure complète. Une scène qui déclare déjà la valeur gagne. Le champ `fromEnvironment`
marque la provenance.

---

## Contraintes lexicales

- Un `_` **interne** est absorbé dans le nom quand une lettre ou un chiffre le suit : `sa_4`,
  `just_intonation`.
- Un `_` **traînant** arrête la lecture du nom et devient une prolongation par underscore.
- Un `-` **traînant** est un silence : `do4-` s'écrit aussi `do4 -`.
- Un `-` **interne** est autorisé dans les noms de non-terminaux : `Tr-11`.
- **Entre crochets**, `[times-1]` est une mutation : le parser décompose le motif
  identifiant-tiret-nombre en drapeau, opérateur et valeur.
- `#` est autorisé dans les identifiants, pour les altérations : `C#4`.

---

## Le chemin

```
Source (.bps) → Tokenizer → Parser → Scene
  → résolution des acteurs (charge les catalogues, étend les symboles, tranche les conflits)
  → Encodeur → grammaire BP3 + tables de routage → moteur
```

La **résolution des acteurs** vient entre le parser et l'encodeur : elle collecte les acteurs,
charge leur alphabet, construit la correspondance terminal → acteurs, et parcourt le membre droit
pour résoudre chaque symbole — automatiquement quand un seul acteur le porte, par une erreur nommée
quand plusieurs le portent.

L'encodeur émet en parallèle la correspondance terminal → acteur, pour le routage, et la table des
réglages que le runtime consomme.

---

## Exemple

Source : `[stage==1] S -> sa!dha re (mode:random)`

```json
{
  "type": "Scene",
  "subgrammars": [{
    "type": "Subgrammar",
    "index": 1,
    "rules": [{
      "type": "Rule",
      "guard": [{ "flag": "stage", "operator": "==", "value": 1, "mutates": false }],
      "lhs": [{ "type": "Symbol", "name": "S" }],
      "arrow": "->",
      "rhs": [
        { "type": "SimultaneousGroup",
          "primary": { "type": "Symbol", "name": "sa" },
          "secondaries": [{ "type": "Symbol", "name": "dha" }] },
        { "type": "Symbol", "name": "re" }
      ],
      "flags": [],
      "settings": { "type": "SettingBag",
                    "pairs": [{ "key": "weight", "value": 50 }] },
      "scan": null
    }]
  }]
}
```
