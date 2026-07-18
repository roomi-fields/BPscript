# BPScript — AST (Abstract Syntax Tree)

Version 0.8 — dérivé de BPSCRIPT_EBNF.md v0.6, validé par 44 scènes transpilées.
v0.8 ajoute `soundPrototypes` + `soundAssignments`, renomme `templates` → `template`
et bascule les bindings d'acteurs de `:` à `.` pour les références d'entités
(cf. `docs/design/v0.8-decisions-final.md`).

---

## Conventions

- Chaque noeud a un `type` (string) et des propriétés spécifiques
- Les positions source (ligne, colonne) sont attachées à chaque noeud pour les erreurs
- `null` = propriété absente/optionnelle

---

## Noeud racine

### `Scene`

```
Scene {
  type: "Scene"
  directives: Directive[]
  actors: ActorDirective[]           // @actor directives
  scenes: SceneDirective[]           // @scene directives (child scenes)
  exposes: ExposeDirective[]         // @expose directives (flags visible au parent)
  maps: MapDirective[]               // @map directives (I/O mappings CC/OSC ↔ flags/triggers)
  aliases: AliasDirective[]          // @alias directives (named I/O endpoints)
  labels: LabelDirective[]           // @label directives (label declarations)
  declarations: Declaration[]
  macros: Macro[]
  cvInstances: CVInstance[]
  libRefs?: string[]                 // OPTIONNEL — invocations de librairie par PROVENANCE
                                     // (@factory.*/@mine.*), adresses canoniques opaques.
                                     // OMIS si aucune (jamais []). Cf. §libRefs ci-dessous.
  backticks: BacktickOrphan[]
  subgrammars: Subgrammar[]
  template: TemplateEntry[] | null         // section @template (optionnelle, v0.8 ; ex-`templates`)
  soundPrototypes: SoundPrototypeAST[] | null  // section @sound (déclaratif, v0.8)
  soundAssignments: SoundAssignmentAST[] | null  // affectations sujet→son (v0.8)
  homomorphisms: HomomorphismDeclAST[]    // contrat BPx (ajout 2026-06-10) — voir §HomomorphismDeclAST
}
```

### `libRefs` — invocation de librairie par provenance (canal neutre)

> Décision hub `2026-07-13-invocation-librairies-factory-mine` (ef75ec6) ; contrat
> `hub/contrats/bpscript-bpx.md §libRefs` (co-seing bpscript 2026-07-13).

Une librairie est un **fichier** qui **déclare son domaine dedans** (champ `domain` en tête du
fichier : `alphabets.json`→`"alphabet"`, etc.). L'invocation ne nomme PAS le domaine — elle nomme
la **provenance + le chemin-de-fichier + l'entrée** (dernier segment = entrée). Le domaine est lu
par le **résolveur** (Kairos) — BPScript **PORTE opaque** (loi 27 : porter ≠ résoudre).

- `Scene.libRefs?: string[]` (frère de `cvInstances`) ; `ActorDirective.libRefs?: string[]`
  (frère de `values`). **OMIS** si aucune invocation par provenance (jamais `[]`).
- Chaque élément = **adresse canonique OPAQUE pré-normalisée** :
  - **factory** (nom nu `@alphabet.sargam` OU sucre explicite `@factory.alphabet.sargam`) →
    adresse **nue** `<chemin-fichier>.<entrée>` (ex. `alphabet.sargam`). Le préfixe `@factory.`
    est **normalisé** (confondu au nom nu) AVANT émission.
  - **mine** (`@mine.ragas.mes-svaras.sa`) → adresse préfixée `mine.<chemin-fichier>.<entrée>`.
- Ordre d'apparition source **préservé** ; **dédup** chez l'émetteur (BPScript).
- **ADDITIF** : le sucre nu `@alphabet.X`/`@tuning.Y`/`@octaves.Z` reste un slot **LEGACY**
  inchangé (`Directive{name, subkey}`) — il **n'émet PAS** de `libRefs`. Seules les formes
  **explicites** `@factory.*`/`@mine.*` alimentent le canal neutre.
- `factory`/`mine` sont des **préfixes réservés** (aucune lib ne peut s'en prévaloir).

**Raccord de SORTIE (canonique, décision Romain 2026-07-13 §Raccord sortie).** Un `libRef` nomme une
**librairie de hauteur** ; il ne porte **aucune** sortie. Pour SONNER, une scène `@mine`/`@factory`
déclare un **acteur explicite** avec un transport — `@actor voice transport.audio` puis
`@mine.ragas.sargam` : la hauteur vient du `libRef` (résolue par Kairos), le transport vient de
l'acteur. Le binding de sortie CANON `@alphabet.X:<sortie>` (transport de l'acteur implicite,
décision 2026-07-16 — règle DISTINCTE qui coexiste) n'est **PAS** étendu à la réf de
provenance (séparation « lib de hauteur » vs « sortie » ; `libRefs` reste un `string[]` opaque, sans
binding). Une scène `@mine` **nue** (sans acteur) retombe sur le transport par défaut `audio` (natif) —
**muette dans le player web, et c'est VOULU** : l'auteur déclare sa sortie explicitement.

---

## Directives

### `Directive`

> **Bloc de production, nœud inchangé** (décision 2026-06-11, durcie le même jour) :
> les directives de production (`seed`, `maxitems`/`items`, `allitems`, `improvize`)
> s'écrivent UNIQUEMENT en bloc niveau scène — `[@seed:1, @items:20]`. La @-forme
> historique (`@seed:1`) est REJETÉE à la compilation (erreur pointant la nouvelle
> écriture — pas de dépréciation douce, arbitrage utilisateur). La forme du nœud
> `Directive` produit est inchangée ; aucun nouveau nœud ; contrat consommateurs
> (BPx, frontal) intact. Cf. EBNF §production_block et hub/principes-syntaxe.md.

```
Directive {
  type: "Directive"
  name: string                    // "core", "controls", "alphabet", "tuning", "mode"...
  subkey: string | null           // "western", "just_intonation", "studio"... (après le .)
  binding: string | null          // valeur après : — sur @alphabet.X = sortie de l'acteur implicite
                                  // (audio/midi/osc, décision 2026-07-16) ; sur @tuning.X = alphabet cible
  runtime: string | null          // pour @mode:X — la valeur du mode ("random", "lin", etc.)
  value: string | number | null   // 120, "7/8", -24...
  aliases: Alias[] | null         // résolution de conflits
  modifiers: ModeModifier[] | null // pour @mode:X(destru, mm:60) — modificateurs de sous-grammaire
  timePatterns: TimePattern[] | null // pour @timepatterns: t1=1/1, t2=3/2
  line: number
}

Alias {
  type: "Alias"
  from: string
  to: string
}

TimePattern {
  name: string                    // "t1", "t2" — nom du time pattern
  ratio: string                   // "1/1", "3/2" — ratio de durée
}
```

Convention stricte : `@file` → `lib/file.json`, `@file.key` → `lib/file.json` → clé `key`.

Le champ `binding` reçoit la valeur après `:`. Sa sémantique dépend de la directive :
- `@alphabet.western:audio` → binding = **sortie de l'acteur implicite** (canal audio/midi/osc,
  décision 2026-07-16 ; le binding d'alphabet renseigne le transport de l'acteur unique implicite,
  décision 2026-07-05 §2). `:browser`/`:webaudio` = noms PÉRIMÉS REJETÉS fail-loud au parse
  (décision 2026-07-16, Romain : on supprime, pas de normalisation) — écrire `:audio`.
- `@tuning.just_intonation:raga` → binding = alphabet cible
- `@tuning.western_12TET` → pas de binding (chargement simple)

**Liste positive FERMÉE** (addendum ratifié Romain 2026-07-16, décision
`2026-07-16-sortie-acteur-implicite-browser-audio-routing-obsolete.md §Addendum`) : le suffixe du
raccord `@alphabet.X:<sortie>` accepte **exactement** `{audio, midi, osc}` — tout autre suffixe
(`:sc`, `:video`, `:foo`…) = rejet fail-loud au parse (« on n'autorise que les 3 qu'on connaît »).
L'ancien sucre **`:sc` (= `(transport=sc, eval=sc)`) est ABOLI**, ainsi que la forme longue
`(transport=x, eval=y)` sur une directive d'alphabet (jamais implémentée) : un `eval` se déclare
sur un **@actor** (`eval.<X>`, modèle producteur/canal 2026-07-14), le raccord de l'acteur
implicite ne nomme qu'un **canal**.

Exemples :
- `@core` -> `{ name:"core", subkey:null, binding:null }`
- `@controls` -> `{ name:"controls", subkey:null, binding:null }`
- `@tuning.western_12TET` -> `{ name:"tuning", subkey:"western_12TET", binding:null }`
- `@alphabet.western:midi` -> `{ name:"alphabet", subkey:"western", binding:"midi" }`
- `@tuning.just_intonation:raga` -> `{ name:"tuning", subkey:"just_intonation", binding:"raga" }`
- `@tuning.equal_temperament:western` -> `{ name:"tuning", subkey:"equal_temperament", binding:"western" }`
- `@sub.dhati` -> `{ name:"sub", subkey:"dhati", binding:null }`
- `@tempo:120` -> `{ name:"tempo", subkey:null, value:120 }`
- `@baseHz:440` -> `{ name:"baseHz", subkey:null, value:440 }`
- `@alphabet.western(A:La)` -> `{ name:"alphabet", subkey:"western", aliases:[{from:"A", to:"La"}] }`
- `@improvize` -> `{ name:"improvize" }` — active Improvize=1 dans les settings BP3
- `@allitems` -> `{ name:"allitems" }` — active AllItems=1 dans les settings BP3
- `@timepatterns: t1=1/1, t2=3/2` -> `{ name:"timepatterns", timePatterns:[{name:"t1", ratio:"1/1"}, {name:"t2", ratio:"3/2"}] }`

#### Défauts d'environnement (à la transpilation)

> Point 1 de `hub/projets/spec-ecriture-structure.md` (décision archi validée Romain 2026-06-24).

La transpilation BPx prend un **environnement** en second paramètre :
`compileToBPxAST(source, environnement)`, `environnement = { tempo?, octave?, division?, … }`
(défauts réglés dans Kanopi, fournis en entrée). Pour chaque réglage **absent** de la scène,
BPScript **inscrit le défaut EN DUR** dans l'AST à la création — l'AST se suffit, le moteur
dérive depuis une structure complète. **Kanopi ne touche jamais l'AST** (remplace l'injection
côté hôte, finding KAN-A10). Conséquence assumée : changer un défaut = re-transpiler (un défaut
est de la config froide, pas un paramètre live ; le changement *en jeu* passe par Kairos).

- **tempo** (seule clé câblée — seul lecteur aval existant) : pas de `@mm`/`@tempo` déclaré →
  inscrit une `Directive` `{ name:"mm", value:<environnement.tempo>, fromEnvironment:true }`.
  Lue en aval par l'hôte (`mmFromAst`) et BPx (`loadGrammar`).
- Si la scène déclare déjà un tempo, elle **gagne** (aucune injection).
- `fromEnvironment:true` marque la provenance (défaut, non déclaré dans la source).
- octave/division… : même mécanisme, **câblés dès que leur cible AST + lecteur aval seront
  définis** (pas d'inscription d'une cible que rien ne lit).

### `FlagStatesDirective` (A5)

États de drapeau nommés : nomme les valeurs entières d'un drapeau pour pouvoir tester/poser par
nom (`[scene==calm]` → `/scene=1/`). L'encodeur résout les noms en entiers et expose la table dans
`compileBPS().flagStates` (Kanopi : commande de scène par nom). Un IDENT non déclaré reste tel quel
(référence à un autre drapeau).

```
FlagStatesDirective {
  type: "FlagStatesDirective"
  flag: string                     // "scene"
  states: { name: string, value: number }[]  // [{name:"calm",value:1},{name:"full",value:2}]
  line: number
}
```

- `@flag scene: calm:1, full:2` → `{ flag:"scene", states:[{name:"calm",value:1},{name:"full",value:2}] }`
  → `flagStates` : `{ scene: { calm:1, full:2 } }`.

### `LibraryDirective`

Librairie de runtime liée à un **moteur** (eval), partagée par toutes ses voix. Le nom est une
**chaîne** (convention B5 : un nom = IDENT | chaîne ; chaîne car caractères spéciaux/ressource
externe). La résolution réelle (chargement) est faite en aval (Kanopi/workspace).

```
LibraryDirective {
  type: "LibraryDirective"
  engine: string                   // moteur ciblé (sous-clé) : "strudel"
  name: string                     // nom de la banque (chaîne) : "dirt-samples"
  line: number
}
```

- `@library.strudel "dirt-samples"` → `{ engine:"strudel", name:"dirt-samples" }`
  → `compileBPS().libraries` : `{ strudel: ["dirt-samples"] }` (accumulé par moteur).

---

## Acteurs

### `ActorDirective`

```
ActorDirective {
  type: "ActorDirective"
  name: string                    // "sitar", "tabla", "lights"
  properties: {                   // SIX clés d'entité (décision cles-acteur-six, Romain 2026-06-16)
    alphabet: string              // référence vers alphabets.json ("sargam", "western")
    tuning: string | null         // tempérament/accordage ("sargam_22shruti", "equal_temperament")
    octaves: string | null        // convention de registre (référence octaves.json) ; null = héritée
                                   // de l'alphabet. TRAVERSE vers BPx via `references` (category
                                   // "octaves", gravée parser.js:1033) — PORTÉE OPAQUE (BPx 2fdb291),
                                   // résolue par Kairos contre octaves.json (kairos 8fce0fc). L'override
                                   // surcharge la convention native de l'alphabet (ex. sargam noté sa6).
    sound: string | null          // producteur PAR SYMBOLE (banque, ou prospectif backtick-synthé)
    transport: TransportRef | null // CANAL de NOTRE sortie (audio/midi/osc) — modèle producteur/canal
                                   // (Romain 2026-07-14). OPTIONNEL : acteur SANS eval → défaut cascade
                                   // @core `audio` ; acteur AVEC eval → transport ABSENT/INTERDIT (il
                                   // sort en natif, fail-loud si présent). PAS de transport.video/visual.
    eval: string | null           // PRODUCTEUR embarqué AUTONOME (strudel/hydra/p5/csound/mercury) :
                                   // produit + sort en NATIF, sans transport. null = producteur défaut
                                   // IMPLICITE `js` (notre code, produit dans notre env → utilise transport).
  }
  references: ActorReference[]   // FORME CANONIQUE (AST_SPEC §2.1) lue par le dispatcher/BPx :
                                 // une entrée par binding, { type:"ActorReference", category, name, params? }
                                 // (category ∈ alphabet|tuning|octaves|sound|transport|eval|voice).
                                 // `voice` (LANG-SONS-2, [438] 2026-07-16) : nom d'une entrée de
                                 // lib/voices (son de base + contrôles, réalisée par-runtime) —
                                 // la hauteur n'y vit PAS (structurelle : alphabet+tuning).
                                 // `properties` ci-dessus = forme interne BPScript (pipeline encodeur) ;
                                 // `references` = forme consommée en aval (dérivée, lossless).
                                 // Les `*:sound.X` / `Sa:sound.Y` écrits DANS le bloc acteur ne sont
                                 // PAS portés ici : ils remontent sur `Scene.soundAssignments` avec
                                 // `scope:"actor", actor:"<nom>"` (cf. tableau des portées ci-dessous
                                 // et `soundAssignments?` du contrat BPx, types/ast.ts:73 — champ de
                                 // SCÈNE, jamais d'acteur).
  synthetic?: true               // acteur IMPLICITE `default` (aucun @actor déclaré), matérialisé
                                 // dans l'AST (LAN-5/KAI-9). Absent sur un acteur déclaré. L'aval
                                 // le distingue d'un acteur réel (panneau Acteurs vide).
  line: number
}
```

**Acteur implicite `default`** (LAN-5 / KAI-9, validé Romain 2026-06-26). Quand une scène ne déclare
AUCUN `@actor` (`.bps` simple, `.gr`, cv-adsr), BPScript inscrit un acteur `default` dans `ast.actors`
(transport `audio` — constante `DEFAULT_ACTOR_TRANSPORT`, **à déplacer en conf éditable Kanopi**), marqué
`synthetic:true`, **sans alphabet** (la résolution pitch tombe sur le résolveur de scène qui renifle les
tokens). Une scène simple emprunte ainsi le MÊME chemin orchestré qu'une multi-acteurs (mono = un acteur).
Avant, l'hôte (`kanopi bpx-adapter.ts:282-283`) le synthétisait ; KAI-9 supprime la résolution hôte →
le défaut vit dans l'AST, BPx ne fait que le porter.

**Adressage de sortie = `transport` + ses params** (KAI-9, Romain 2026-06-26). UNE seule forme
partout : le TYPE de runtime est `transport.<type>` (`references[transport].name`) et les DÉTAILS
d'adresse (device/channel/port) sont ses **params**, iso quel que soit le type :
`transport.midi(ch:3)`, `transport.osc(device:reaper, ch:7)`. L'hôte reconstruit son routage depuis
`references[transport].{name, params}` (plus de tiroir séparé). L'ancien champ `ActorDirective.binding`
(OSC-L1, device:/ch: lâche) est **supprimé** : les détails OSC vivaient dans un tiroir parallèle au
lieu de `transport.params`.

```
TransportRef {
  type: "TransportRef"
  key: string                     // NOM D'APPAREIL LIBRE (clé @devices), pas un enum. Ex. "midi"
                                  // canon {audio, midi, osc} ; "dmx"/"strudel"... = appareils libres (@devices, résolus aval)
  params: { [key: string]: any }  // { ch: 10 }, { port: 57110 }, {}
}
```

**`transport` = canal de NOTRE sortie** (`audio`/`midi`/`osc`, défaut cascade @core `audio`) :
optionnel, et **absent/interdit sur un acteur `eval`**. **`eval` = producteur embarqué autonome**
(strudel/hydra/p5/csound/mercury) qui **sort en natif** ; absence d'`eval` = producteur défaut `js`
(notre code) → SEUL cas de voix de code transportée vers NOTRE `transport` (modèle producteur/canal,
Romain 2026-07-14). Un acteur est une **voix** ;
sa sortie suit la cascade scène → acteur → terminal (voir « Cascade de sortie » ci-dessous et
`docs/design/ACTOR.md`), distincte de la cascade des sons.

**v0.8 — bindings d'entités via `.`** : les références à une entité nommée
(`alphabet`, `tuning`, `transport`, `sound`) utilisent désormais `.` et non `:`.
Le `:` reste réservé aux affectations de sujet (cf. `SoundAssignmentAST`).
Les `actor_props` sont écrites une par ligne (ou séparées par espaces) dans le
bloc qui suit `@actor NAME`.

Exemples (v0.8) :

```bpscript
@actor sitar
  alphabet.sargam
  tuning.sargam_22shruti
  transport.audio
```
→ `{ type:"ActorDirective", name:"sitar", properties:{ alphabet:"sargam", tuning:"sargam_22shruti", transport:{type:"TransportRef", key:"audio", params:{}} }, references:[…3 entrées…], line:3 }`

Les clés absentes (`sound`, `octaves`, `eval`) ne sont **pas** émises à `null` : elles manquent.

```bpscript
@actor tabla
  alphabet.tabla
  transport.audio
  *:sound.tabla_perc
```
→ acteur : `{ type:"ActorDirective", name:"tabla", properties:{ alphabet:"tabla", transport:{type:"TransportRef", key:"audio", params:{}} }, references:[…], line:1 }`
→ et, **sur la scène** : `soundAssignments:[{ type:"SoundAssignment", scope:"actor", actor:"tabla", subject:"*", target:{ kind:"named-ref", name:"tabla_perc" }, line:1 }]`

```bpscript
@actor drums
  alphabet.tabla
  transport.midi(ch:10)
  *:sound.tabla_gm
  Sa:sound.drum_kick
```
→ acteur : `{ type:"ActorDirective", name:"drums", properties:{ alphabet:"tabla", transport:{type:"TransportRef", key:"midi", params:{ch:10}} }, references:[…], line:1 }`
→ et, **sur la scène** : `soundAssignments:[{ scope:"actor", actor:"drums", subject:"*", target:{kind:"named-ref", name:"tabla_gm"}, … }, { scope:"actor", actor:"drums", subject:"Sa", target:{kind:"named-ref", name:"drum_kick"}, … }]`

**Champs v0.7 dépréciés** :
- `scale` → renommé `tuning` (référence à `lib/tunings.json`).
- `sounds` (pluriel, valeur string) → remplacé par `sound` (singulier, défaut acteur)
  et par les `soundAssignments` pour les affectations note-à-son.

**Compatibilité** : la v0.8 n'accepte plus la syntaxe `alphabet:X` (ni `tuning:`,
`transport:`, `sounds:`). Le script de migration des 44 grammaires gère la
transformation `:` → `.` (cf. `docs/design/v0.8-decisions-final.md` plan de migration).

### Cascade de sortie — scène → acteur → terminal

La **sortie** (paramètres de rendu : vélocité, pan, canal, params de transport…) suit une cascade
à **trois niveaux**, l'override le plus fin l'emportant :

1. **scène** — défauts de la scène.
2. **acteur** — un acteur **est** une voix ; ses bindings (`transport`, `eval`) et ses qualifiers
   par défaut s'appliquent à tous ses terminaux.
3. **terminal** — override sur une occurrence (`Sa(vel:80)`, `acteur.terminal(...)`). « terminal »
   et non « note » : tout n'est pas une note (bol, backtick…).

Le niveau « voix » intermédiaire a été **supprimé** : acteur = voix. Cette cascade de sortie est
**distincte** de la cascade des sons (8 niveaux, ci-dessous) — ne pas en calquer la liste de
niveaux. Modèle complet : `docs/design/ACTOR.md`.

---

## Sons (v0.8)

La directive `@sound` est **déclarative uniquement** : elle déclare des
prototypes anonymes (défauts de scène) ou nommés (`bell_short`, `drum_kick`,
etc.). Les **affectations** (lier un sujet — note, alphabet, acteur — à un son)
se font depuis le territoire d'origine du sujet, jamais depuis `@sound`. Cf.
`docs/design/v0.8-decisions-final.md` §1-2.

### `SoundPrototypeAST`

```
SoundPrototypeAST {
  type: "SoundPrototype"
  name: string | null              // null = entrée anonyme (défaut de scène),
                                   // sinon nom du son (référence depuis ailleurs)
  config: Partial<SoundConfigInput>  // propriétés du son (sample/synth/dur/alpha/...)
  line: number
}
```

Le champ `config` est une forme partielle. Toutes les clés sont optionnelles ;
les manquantes héritent de la cascade (cf. `LANGUAGE.md` section « Sons et
cascade d'héritage »). Le shape canonique de `SoundConfigInput` côté
consommateur est défini dans `BPx/src/types/soundConfig.ts:194-251` (~33
propriétés couvrant capacités booléennes, bornes temporelles, durée, alpha,
pivot, période). Forme canonique : modes en string (`'absolute' | 'relative'`),
`pivType` accepte string ou entier `1..7`, booléens nus = `true`.

Origine des défauts moteur (niveau 1 de la cascade) :
`bp3-engine/source/BP3/SoundObjects3.c:43-117` (`ResetPrototype`). Index BP3
des propriétés : `bp3-engine/source/BP3/-BP3decl.h:185-200`.

Exemples :

```bpscript
@sound
  { dur:500, alphaMin:80, alphaMax:120 }     // anonyme = défaut scène
  bell_short { sample:"bell.wav", dur:400 }
  bell_long  { sample:"bell.wav", dur:1200, coverEnd:true }
  drum_kick  { sample:"kick.wav", dur:200, breakTempo:true }
```
→
```
[
  { type:"SoundPrototype", name:null,         config:{ dur:500, alphaMin:80, alphaMax:120 } },
  { type:"SoundPrototype", name:"bell_short", config:{ sample:"bell.wav", dur:400 } },
  { type:"SoundPrototype", name:"bell_long",  config:{ sample:"bell.wav", dur:1200, coverEnd:true } },
  { type:"SoundPrototype", name:"drum_kick",  config:{ sample:"kick.wav", dur:200, breakTempo:true } }
]
```

Plusieurs entrées anonymes sont autorisées et fusionnent dans l'ordre source
(défauts les plus tardifs gagnent, façon CSS).

**Note timbre vs comportement** : un son décrit à la fois son timbre
(`sample:`, `synth:`) et son comportement temporel (durée, alpha, cover/cont/
trunc, pivot, période). Pas de directive `@synth` séparée. Les clés timbre
(`sample`, `synth`, `samplerate`, etc.) sont opaques pour le moteur BPx —
elles sont transmises au runtime cible (cf. `LANGUAGE.md`).

### `SoundAssignmentAST`

```
SoundAssignmentAST {
  type: "SoundAssignment"
  scope: SoundScope                // qui possède cette affectation (alphabet ou acteur)
  subject: string                  // nom de note (ex. "Sa") ou "*" (défaut wildcard)
  target: SoundTarget
  line: number
}

SoundScope =
    { kind: "alphabet", name: string }   // affectation dans @alphabet.<name>
  | { kind: "actor",    name: string }   // affectation dans @actor <name>

SoundTarget =
    { kind: "named-ref",   name: string }                       // sound.bell_short
  | { kind: "inline-props", props: Partial<SoundConfigInput> }   // { dur:300 } (bloc anonyme)
```

Une `SoundAssignmentAST` apparaît dans **trois contextes** parents (le territoire
d'origine du sujet) :

| Contexte parent | Niveau cascade | Émis dans | `scope` |
|---|---|---|---|
| `@alphabet.X` (corps) | 3 (`*:`) ou 4 (`Y:`) | `Scene.soundAssignments` | `{ kind:"alphabet", name:"X" }` |
| `@actor X` (corps) | 5 (`*:`) ou 6 (`Y:`) | `ActorDirective.soundAssignments` | `{ kind:"actor", name:"X" }` |
| Inline sur occurrence dans une règle | 7 | `Symbol.suffixQualifiers` (via runtime qualifier `sound.NAME`) | — (pas une assignation, mais un suffixe d'élément) |

Le champ `subject` :
- `"*"` = wildcard sujet (défaut hérité par tous les sujets non explicitement
  affectés dans le même territoire).
- nom d'un terminal (ex. `"Sa"`, `"do4"`) = affectation à cette note dans le
  scope parent.

Le champ `target` :
- `kind: "named-ref"` = pointe un son nommé déclaré dans `@sound` ou importé
  via une lib externe.
- `kind: "inline-props"` = bloc anonyme `{ dur:300, sample:"x.wav" }` qui
  s'ajoute à la cascade comme couche de propriétés (sans nom global).

Exemples :

```bpscript
@alphabet.tabla
  notes: Sa Re ga ma Pa dha ni
  *:sound.bell_short            // défaut alphabet
  Sa:sound.drum_kick
  Re:sound.bell_long
```
→ `Scene.soundAssignments` contient :
```
[
  { type:"SoundAssignment", scope:{kind:"alphabet", name:"tabla"}, subject:"*",  target:{ kind:"named-ref", name:"bell_short" } },
  { type:"SoundAssignment", scope:{kind:"alphabet", name:"tabla"}, subject:"Sa", target:{ kind:"named-ref", name:"drum_kick" } },
  { type:"SoundAssignment", scope:{kind:"alphabet", name:"tabla"}, subject:"Re", target:{ kind:"named-ref", name:"bell_long" } }
]
```

Note : le champ `scope` rend chaque affectation autonome (sans dépendance à sa
position structurelle dans le doc) — un consommateur peut itérer sur la liste
plate `Scene.soundAssignments` sans rejoindre via la position. Voir EBNF.md
pour la grammaire `alphabet_section` étendue.

### Cascade des sons — 8 niveaux (résumé)

| # | Niveau | Source AST |
|---|---|---|
| 1 | défaut moteur BP3 | constantes `ResetPrototype` (SoundObjects3.c:43-117) — pas dans l'AST |
| 2 | défaut anonyme de scène | `SoundPrototypeAST` avec `name:null` |
| 3 | défaut alphabet | `SoundAssignmentAST` `scope:{kind:"alphabet"}` + `subject:"*"` |
| 4 | défaut note dans alphabet | `SoundAssignmentAST` `scope:{kind:"alphabet"}` + `subject:"<note>"` |
| 5 | défaut acteur | `SoundAssignmentAST` `scope:{kind:"actor"}` + `subject:"*"` (ou `ActorDirective.properties.sound`) |
| 6 | défaut note d'acteur | `SoundAssignmentAST` `scope:{kind:"actor"}` + `subject:"<note>"` |
| 7 | inline sur occurrence | `Symbol.suffixQualifiers` portant un `RuntimeQualifier` `sound:NAME` |
| 8 | (réservé) override CV runtime | future v0.9+ |

Sémantique détaillée et fusion par propriété : voir `LANGUAGE.md` section « Sons
et cascade d'héritage ».

### `SceneDirective`

```
SceneDirective {
  type: "SceneDirective"
  name: string                    // nom de la scène (devient un terminal)
  file: string                    // chemin du fichier .bps
  line: number
}
```

Exemple : `@scene verse "verse.bps"` → `{ name:"verse", file:"verse.bps" }`

### `ExposeDirective`

```
ExposeDirective {
  type: "ExposeDirective"
  flags: string[]                 // noms des flags rendus visibles au parent
  line: number
}
```

Exemple : `@expose [intensity]` → `{ flags:["intensity"] }`

### `MapDirective`

```
MapDirective {
  type: "MapDirective"
  source: MapEndpoint
  arrow: "->" | "<->" | "<-"
  target: MapEndpoint
  line: number
}

MapEndpoint = { kind: "cc", number: int, params: object | null }
            | { kind: "osc", address: string, params: object | null }
            | { kind: "flag", name: string }
            | { kind: "trigger", name: string }
            | { kind: "sys", scene: string | null, command: string }
```

Exemples :
- `@map cc:1 -> [intensity]` → `{ source:{kind:"cc",number:1}, arrow:"->", target:{kind:"flag",name:"intensity"} }`
- `@map [phase] -> cc:20` → `{ source:{kind:"flag",name:"phase"}, arrow:"->", target:{kind:"cc",number:20} }`
- `@map cc:60 -> sys.play` → `{ source:{kind:"cc",number:60}, arrow:"->", target:{kind:"sys",scene:null,command:"play"} }`
- `@map cc:60 -> verse.play` → `{ source:{kind:"cc",number:60}, arrow:"->", target:{kind:"sys",scene:"verse",command:"play"} }`

### `CCDirective`

```
CCDirective {
  type: "Directive"
  name: "cc"
  ccMappings: { name: string, number: int }[]
  line: number
}
```

Exemple : `@cc breath:2` → `{ name:"cc", ccMappings:[{name:"breath", number:2}] }`

### `DurationDirective`

```
DurationDirective {
  type: "Directive"
  name: "duration"
  value: {
    amount: number              // 16, 8, 4.5
    unit: "b" | "s"             // b = beats, s = secondes (défaut: b)
  }
  line: number
}
```

Exemple : `@duration:16b` → `{ name:"duration", value:{amount:16, unit:"b"} }`
Exemple : `@duration:4.5s` → `{ name:"duration", value:{amount:4.5, unit:"s"} }`

Le runtime aval rescale les timestamps proportionnellement pour que la séquence tienne dans la durée déclarée.

### `MacroDirective`

```
MacroDirective {
  type: "MacroDirective"
  name: string                    // "kick", "accent", "fast"
  params: string[]                // [] si sans paramètres, ["x"] si @macro accent(x)
  body: RhsElement[]              // body parsé par parseRhsElements()
  line: number
}
```

Exemples :
- `@macro kick = (vel:120)` → `{ name:"kick", params:[], body:[InstantControl(vel:120)] }`
- `@macro accent(x) = x(vel:120)` → `{ name:"accent", params:["x"], body:[SymbolCall(x, vel:120)] }`

### `AliasDirective`

```
AliasDirective {
  type: "AliasDirective"
  name: string                    // "breath", "sensor"
  source: MapEndpoint             // { kind: "cc", number: 2 } ou { kind: "osc", address: "/sensor/1" }
  line: number
}
```

Exemple : `@alias breath = cc:2` → `{ name:"breath", source:{kind:"cc", number:2} }`

### `LabelDirective`

```
LabelDirective {
  type: "LabelDirective"
  name: string                    // "groove", "hat"
  line: number
}
```

Exemple : `@label groove` → `{ name:"groove" }`

### Label suffixe (`@`)

Tout nœud RHS peut porter un champ optionnel `label: string` attaché par `@` sans espace :

```
C4@kick   → Symbol { name: "C4", label: "kick" }
{A B}@groove → Polymetric { ..., label: "groove" }
```

---

## Déclarations

### `Declaration`

```
Declaration {
  type: "Declaration"
  temporalType: "gate" | "trigger" | "cv"
  name: string
  actor: string                   // nom de l'acteur (remplace "runtime" quand @actor est utilisé)
  runtime: string | null          // legacy : runtime direct (quand pas de @actor)
  line: number
}
```

Avec `@actor`, les symboles ne sont pas déclarés individuellement — l'acteur importe
tout son alphabet. La qualification se fait dans les règles via dot notation (`sitar.Sa`).
Format préféré : `@gate Sa:midi`. Format legacy (sans `@`) : `gate Sa:sc` — toujours supporté.
Exemple : `@gate Sa:midi` → `{ temporalType:"gate", name:"Sa", runtime:"midi" }`.

---

## Macros

### `Macro`

```
Macro {
  type: "Macro"
  name: string
  params: string[]
  body: RhsElement[]
  line: number
}
```

---

## CV Instances

### `CVInstance`

```
CVInstance {
  type: "CVInstance"
  name: string                      // nom du modulateur ("env1", "sweep")
  lib: string | null                // lib source ("mod", null pour backtick)
  objectType: string                // type d'objet ("adsr", "lfo", "ramp", "backtick")
  args: (number | string)[]         // arguments positionnels
  namedArgs: { [key: string]: any } // arguments nommés (attack:10, rate:4)
  tag: string                       // clé d'interprète du backtick ("js", "sc"…) — OBLIGATOIRE (cv = orphelin)
  code: string | null               // code backtick SANS le tag (si objectType == "backtick")
  line: number
}
```

Déclaration **purement descriptive** (design Romain 2026-06-20, cf. `cv_instance` dans EBNF) :
`cv env1 : mod.adsr(...)` décrit ce qu'EST le modulateur — **pas de cible/route/transport** sur la
déclaration. Le branchement se fait au point de paramètre (`(cutoff: env1)` → paire de
`RuntimeQualifier` dont la valeur est un symbole/littéral). Les champs `target`/`cvin`/`transport`
des anciennes formes sont supprimés.

Exemples :
- `cv env1 : mod.adsr(attack:5, decay:150, sustain:0.2, release:400)`
  -> `{ name:"env1", lib:"mod", objectType:"adsr", args:[], namedArgs:{attack:5, decay:150, sustain:0.2, release:400}, code:null }`
- `` cv wobble : `js: (t,dur)=>…` ``
  -> `{ name:"wobble", lib:null, objectType:"backtick", tag:"js", code:"(t,dur)=>…", args:[], namedArgs:{} }`

Le **tag** du backtick (`js:`) est **OBLIGATOIRE** (décision hub
`2026-07-04-cv-curve-syntaxe-backtick-type.md`, fail-loud) : il type le **langage** de la courbe,
séparé du `code` (le tag n'est plus laissé dans `code`). Le mot-clé `cv` type le **rôle**
(modulation) — orthogonaux. Un backtick sans tag = erreur claire au parse (cf. EBNF §4.13).

Le **branchement** `Bass -> C2(cutoff: wobble)` n'est PAS dans la CVInstance : c'est une paire du
`RuntimeQualifier` de la note/règle/groupe (`{ key:"cutoff", value:"wobble" }`), portée en
`payload.params.cutoff` et résolue en aval (le nom réfère la CVInstance déclarée).

---

## Sous-grammaires

### `Subgrammar`

```
Subgrammar {
  type: "Subgrammar"
  rules: Rule[]
  index: number
  mode: string | null              // "random", "ord", "sub", "sub1", "lin", "tem", "poslong"
  modifiers: ModeModifier[] | null // directives de sous-grammaire depuis @mode:X(modifiers)
}

ModeModifier {
  name: string                     // clé de controls.json section "subgrammar" : destru, striated, smooth, mm
  value: number | string | true    // true = flag sans valeur, number = mm:60
}
```

Exemples :
- `@mode:lin(destru)` → `{ mode:"lin", modifiers:[{ name:"destru", value:true }] }`
- `@mode:random(striated, mm:60)` → `{ mode:"random", modifiers:[{ name:"striated", value:true }, { name:"mm", value:60 }] }`

L'encoder émet les modifiers en preamble BP3 (ligne séparée entre le mode et les règles).
Les clés sont déclarées dans `controls.json` section `subgrammar` avec leur nom BP3
(`destru` → `_destru`, `mm` → `_mm`).

**Mode SUB/SUB1** : en mode substitution, les symboles LHS sont aussi des terminaux
(ils restent dans la séquence après les itérations et doivent être dans l'alphabet).
L'encoder ne les exclut pas de l'alphabet, contrairement aux modes ORD/RND où les
symboles LHS sont des non-terminaux.

### `TemplateEntry`

```
TemplateEntry {
  type: "TemplateEntry"
  index: number                    // [1], [2], [3]...
  scale: string                    // "/1", "/2", "*1/2" — facteur d'échelle
  body: TemplateElement[]
}

TemplateElement = TemplateWildcard | TemplatePeriod | TemplateBracket

TemplateWildcard {
  type: "TemplateWildcard"
  count: number                    // ???? → count=4, ? → count=1
}

TemplatePeriod {
  type: "TemplatePeriod"
}

TemplateBracket {
  type: "TemplateBracket"
  index: number                    // ($0 ...) → index=0
  body: TemplateElement[]          // contenu du bracket (peut être vide)
}
```

Exemples :
- `[1] /1 ???????` → `{ index:1, scale:"/1", body:[{ type:"TemplateWildcard", count:7 }] }`
- `[3] /1 ($0 ???)($1 )` → `{ index:3, scale:"/1", body:[{ type:"TemplateBracket", index:0, body:[{type:"TemplateWildcard", count:3}] }, { type:"TemplateBracket", index:1, body:[] }] }`

La section `@template` (v0.8 — singulier, ex-`@templates`) est optionnelle.
Si absente, `Scene.template` est `null` et BP3 génère les templates
automatiquement. Si présente, l'encoder émet la section `TEMPLATES:` dans la
grammaire BP3 avec `_` au lieu de `?` et `@N` au lieu de `$N`.

**Régime catalogue (v0.8)** : la section `@template` est **toujours** en mode
catalogue (utilisée en `[mode:tem]` pour l'analyse inverse / modus tollens).
Pas de suffixe de mode sur la section. Sémantique côté moteur : régime B
(catalogue post-dérivation), cf. `BPx/backlog/m8-port-plan.md:103-117`. Voir
`LANGUAGE.md` section « Templates : régime catalogue ».

---

## Règles

### `Rule`

```
Rule {
  type: "Rule"
  guard: Guard | Guard[] | null    // un ou plusieurs guards (AND)
  contexts: Context[]
  lhs: LhsElement[]
  arrow: "->" | "<-" | "<>"
  rhs: RhsElement[]
  flags: FlagExpr[]                // mutations collectées, émises en fin de règle : /phase=2/ /Atrans/
  qualifiers: Qualifier[]          // [mode:random, scan:left] en fin de règle (engine [])
  runtimeQualifier: RuntimeQualifier | null  // suffixe () sur la règle : S -> C4 D4 (vel:80)
  mode: "rnd" | "left" | "right" | null
    // Extrait du qualificateur [scan:left|right|rnd] (parser.js, juste avant return Rule).
    // null = mode par défaut de la sous-grammaire (géré par BPx loadGrammar.ts:3920-3923).
    // Duplication intentionnelle : la QualPair 'scan' reste dans qualifiers pour que
    // l'encoder (encoder.js:331-335) émette le préfixe BP3 LEFT/RIGHT/RND.
    // BPx lit ast.mode (ast.ts:431-449, loadGrammar.ts:3897-3924).
  line: number
}
```

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

Exemples :
- `[phase==1]` -> `{ flag:"phase", operator:"==", value:1, mutates:false }`
- `[Ideas-1]` -> `{ flag:"Ideas", operator:"-", value:1, mutates:true }`
- `[Ideas]` (bare flag) -> `{ flag:"Ideas", operator:null, value:null, mutates:false }`

**Note lexicale** : le tokenizer absorbe le `-` trailing dans l'identifiant (`times-` → un
seul token IDENT). Le parser détecte le pattern `IDENT-trailing-dash + INT` dans les guards
et les flags, et décompose en `flag` + `operator` + `value`. `[times-1]` produit donc bien
`{ flag:"times", operator:"-", value:1 }` et non `{ flag:"times-", ... }`.

### `Qualifier` — instructions moteur BP3

```
Qualifier {
  type: "Qualifier"
  pairs: QualPair[]
  tempoOp: TempoOp | null          // [/2], [*3] etc. — mutuellement exclusif avec pairs
}

QualPair {
  type: "QualPair"
  key: string                      // ENGINE_KEY : mode, scan, weight, tempo, scale...
  value: string | number | boolean // "random", 50, "1/2", "K1=3", "inf", true (clé nue)
  decrement: number | null         // pour weight:50-12
}
// value = "inf" pour [weight:inf] → poids infini (compilé en <°> pour BP3)

TempoOp {
  type: "TempoOp"
  operator: "/" | "*"             // / = plus rapide, * = plus lent
  value: number | string          // entier (2), décimal (1.5) ou fraction ("3/2")
  scope: "absolute" | "relative"  // absolute = A[/N] (élément) / [/N] (règle) → /N nu BP3 ;
                                   // relative = ![/N] (instant `!`) → paire _tempo BP3.
                                   // Décision 2026-06-10-tempo-absolu-vs-relatif ; le
                                   // consommateur (BPx) LIT ce champ au lieu de deviner par position.
}
```

Exemples :
- `[mode:random]` → `{ pairs:[{key:"mode", value:"random"}] }`
- `[retro]` → `{ pairs:[{key:"retro", value:true}] }` → compilé en `_retro` (sans parenthèses)
- `[rotate:2]` → `{ pairs:[{key:"rotate", value:2}] }` → compilé en `_rotate(2)`
- `[shuffle]` → `{ pairs:[{key:"shuffle", value:true}] }` → compilé en `_rndseq` (seq_prefix)
- `[shuffle:42]` → `{ pairs:[{key:"shuffle", value:42}] }` → compilé en `_srand(42) _rndseq`
- `[order]` → `{ pairs:[{key:"order", value:true}] }` → compilé en `_ordseq` (seq_prefix)
- `A[/2]` → `{ tempoOp:{ operator:"/", value:2 } }` → compilé en `/2 A` (opérateur nu, absolu + persistant)
- `A[*2]` → `{ tempoOp:{ operator:"*", value:2 } }` → compilé en `_tempo(1/2) A _tempo(1/1)` (relatif, bracket)
- `A[/3/2]` → `{ tempoOp:{ operator:"/", value:"3/2" } }` → compilé en `/3/2 A` (opérateur nu)
- `{A B}[/2]` → `/2 {A B}` (opérateur nu devant le groupe)
- `![/2]` → `_tempo(2/1)` dans le flux (relatif, sans bracket — portée séquentielle jusqu'au prochain opérateur)

**Distinction sémantique `/` vs `*` :**
- `/N` (opérateur NU) = vitesse ABSOLUE N + fixtempo (BP3 Encode.c:418-425). La durée de référence du champ est imposée. Persiste jusqu'au prochain opérateur tempo ou fin de champ. Pas de bracket ni d'exit token.
- `*N` (bracket `_tempo`) = relatif à la vitesse héritée. Enter `_tempo(1/N)` avant l'élément, exit `_tempo(1/1)` après (restaure la vitesse héritée au bord du bracket).
- `![/N]` dans le flux (InstantControl) → `_tempo(N/1)` relatif (sans fixtempo), portée séquentielle.
- `{v1, v2}[speed:2]` → compilé en `{2, v1, v2}` (ratio polymétrique, distinct du tempo)
- `[weight:inf]` → `{ pairs:[{key:"weight", value:"inf"}] }` → compilé en `<inf>`
- `[gap:50]` → `{ pairs:[{key:"gap", value:50}] }` → compilé en `_staccato(50)` (suffixe)
- `[overlap:80]` → `{ pairs:[{key:"overlap", value:80}] }` → compilé en `_legato(80)` (suffixe)
- `[rndtime:10]` → `{ pairs:[{key:"rndtime", value:10}] }` → compilé en `_rndtime(10)` (suffixe)
  Portée : sur un élément (`A[rndtime:10]` → `A _rndtime(10)`) ou un groupe
  (`{A B C D}[rndtime:20]` → `{A B C D} _rndtime(20)`). Pas de seq_prefix — contrôle
  courant non-réordonnant, profil identique à gap/overlap (CompileProcs.c case 59,
  plage 0..32767 ms, `p_Instance[k].randomtime`).

**Clés nues** : quand `value === true` (clé sans `:valeur`), l'encodeur émet le nom BP3
sans parenthèses (`_retro`, `_rndseq`, `_ordseq`). Quand une valeur est fournie, avec
parenthèses (`_rotate(2)`) ou avec préfixe graine (`_srand(42) _rndseq` pour `shuffle`).

**Contrôles seq_prefix** (`scope:"seq_prefix"` dans controls.json) : `retro`, `shuffle`,
`order`, `rotate`. Injectés en tête du groupe (inside `{}`) ou en tête de RHS (fin de règle).
Portées :
- `{a b c}[shuffle]` → `{_rndseq a b c}` (inside accolades, via `Polymetric.suffixQualifiers`)
- `a b c [shuffle]` → `_rndseq a b c` (fin de règle, via `Rule.qualifiers`)

**Distinction `[]` vs `()` pour `rotate`** : `[rotate:2]` (engine, `Qualifier`) compile en
`_rotate(2)` BP3 (décalage cyclique temporel) ; `(rotate:2)` (runtime, `RuntimeQualifier`)
compile en `_script(CT n)` via dispatcher (rotation diatonique, transformation pitch).

**Poids infini** : `value === "inf"` → compilé en `<inf>` (priorité absolue en BP3).

### `RuntimeQualifier` — paramètres runtime

```
RuntimeQualifier {
  type: "RuntimeQualifier"
  pairs: { key: string, value: string | number | boolean, subject?: string, line, col }[]
  // key : RUNTIME_KEY (vel, wave, filter, filterQ, pan...)
  // value : 120, "sawtooth", "rrand(40,127)" ; true pour une clé nue (velcont, pitchcont)
  // subject (optionnel) : destinataire de la paire `[sujet:]key:value` (décision Romain 2026-06-21)
  //   absent  → la portée elle-même (la règle/le groupe comme unité)
  //   "*"     → chaque terminal de la portée (ex. CV : enveloppe par note)
  //   "<nom>" → les terminaux <nom> de la règle (ex. "C2"), ou (PARKÉ) une portée cross-règle/scène
}
```

Le **sujet** (`subject`) cible plus finement qu'une paire nue : `(*:cutoff:Env)` → `subject:"*"`
(chaque terminal), `(C2:cutoff:Env)` → `subject:"C2"`, `(cutoff:Env)` → pas de `subject` (= la
règle). Cohérent avec l'affectation existante `*:sound.X`. Pour un CV, le sujet décide l'**horloge**
(unité/signal vs par-terminal) ; le consommateur (BPx/dispatcher) le lit. Cf. `docs/design/CV.md`.

Les pairs runtime sont des objets nus `{ key, value }` (pas de champ `type`, contrairement aux
`QualPair` du `Qualifier` moteur). La portée (symbole / règle / groupe / instantané) n'est **pas**
stockée sur le nœud : elle est déduite de la position dans l'AST par l'encodeur.

`()` est **toujours suffixe** (jamais en préfixe). La portée est déduite de la position :
- **symbole** : `Sa(vel:120)` → `Sa _script(CT 0)` — attaché au `Symbol` node
- **règle** : `S -> C4 D4 (vel:80)` → `_script(CT 1) C4 D4` — dans `Rule.runtimeQualifier`
- **instantané** : `{!(chan:1) C8 -, !(chan:2) C7 C7}` → `{_script(CT 2) C8 -, _script(CT 3) C7 C7}` — via `InstantControl` dans le flux
- **groupe** : `{A B}(filter:lp)` → `_script(CT 4_start) {A B} _script(CT 4_end)` — dans `Polymetric.runtimeQualifier`

Le transpileur maintient une table de mapping `CT n → { scope, params }` (la control table)
consommée par le runtime aval.

**Étendue d'arc — enveloppe de groupe `{ … }(cutoff:env)`** (décision 2026-07-01 réarmement-enveloppes).
Une enveloppe de groupe définit l'étendue d'**un arc continu** franchissant les silences internes.
**Répartition des rôles (arbitrage 2026-07-01, AST_SPEC §4 « l'arbre résout seul »)** : l'AST BPScript
porte le qualificateur d'une clé de contrôle **inconnue** (ex. `cutoff`) en `Rule.runtimeQualifier`
(`scope:"rule"`) — l'attachement collé `}(…)` passe par le check **strict** `isRuntimeQualifier`
(parser.js:2172, piloté par `controlNames`) et retombe au niveau règle pour une clé hors `controls.json`.
Ce `scope:"rule"` est **SUFFISANT et correct** : la **remontée** de la contenance au nœud conteneur
(`Polymetric`) et le calcul de la fenêtre-bloc sont le rôle de **BPx** (l'arbre résout seul), **pas** de
l'AST. ⚠️ Ne **PAS** enregistrer `cutoff`/`resonance` dans `controls.json` pour forcer `scope:"group"` :
piste **abandonnée** (n'était pas la racine, risquait la parité). Le bug CVA-ARMING vit dans le chemin
**nesté de BPx** (fenêtre recalculée par segment sous polymétrie), pas ici.

---

## Éléments LHS

```
LhsElement = Symbol | Variable | Wildcard | Context | TemplateAnchor | RawBrace
```

---

## Éléments RHS

```
RhsElement = Symbol | SymbolCall | SymbolWithTriggerIn | Control | Rest | Prolongation | UndeterminedRest
           | Period | NumericDuration | Polymetric
           | SimultaneousGroup | OutTimeObject | InstantControl | TriggerIn
           | Variable | Wildcard
           | TemplateMaster | TemplateMasterGroup | TemplateSlave | TemplateSlaveGroup | TemplateAnchor
           | TieStart | TieContinue | TieEnd
           | NilString | BacktickStandalone | Context | RawBrace
```

### Qualificateurs par élément

Tout `RhsElement` peut porter des qualificateurs moteur `[]` et/ou runtime `()`,
toujours en **suffixe** : collés à droite de l'élément (sans espace avant).

```
RhsElement {
  ...                                            // propriétés spécifiques au type
  suffixQualifiers: (Qualifier | RuntimeQualifier)[] | null  // [] ou () collés à droite : A[weight:50], A(vel:80)
}
```

Le tokenizer marque chaque token avec `spaceBefore`. Un `[` ou `(` **sans** espace
avant s'attache comme suffixe à l'élément précédent. Un `[` précédé d'un espace, en
fin de règle, est un qualificateur de règle ; un `[` en tête de règle est une garde
de flag (voir `Guard`). Le parser ne produit pas de qualificateur préfixe.

Exemples :
- `A[weight:50]` (collé à A) : `suffixQualifiers: [Qualifier{ pairs:[{key:"weight", value:50}] }]`
- `A[/2]` (opérateur de durée, collé à A) : `suffixQualifiers: [Qualifier{ tempoOp:{operator:"/", value:2} }]`
- `A(vel:80)` (runtime, collé à A) : `suffixQualifiers: [RuntimeQualifier{ pairs:[{key:"vel", value:80}] }]`
- `A [X] B` → **erreur** : qualificateur flottant, utiliser `A ![X] B`

Sur le RHS, `[]` comme `()` sont toujours en suffixe.

### `Symbol`

```
Symbol { type: "Symbol", name: string, actor: string | null, line: number }
```

Le champ `actor` est rempli par la dot notation explicite (`sitar.Sa`), ou par la
phase de résolution implicite (quand un seul acteur contient ce symbole). `null`
pour les non-terminaux (qui n'ont pas d'acteur).

**Objet sonore composé** (`|[ … ]`, ratifié Romain 2026-07-18) : une suite de notes/
prolongations occupant UNE unité d'ordonnancement est représentée par un **unique
`Symbol`** dont le `name` est la concaténation SANS blancs du contenu
(`|[ do5 _ do5 do5 ]` → `Symbol { name: "do5_do5do5", payload: { nature: "sounding" } }`).
Aucun nœud dédié : c'est la forme canonique identique à celle que le frontal BP3 émet pour
un terminal concaténé — le contenu interne (`_`, poly imbriquée) fait partie du nom, opaque
à la dérivation, résolu en aval. Cf. `docs/issues/LANG_COMPOUND_SOUND_OBJECT.md`, EBNF `compound_sound_object`.

### `SymbolCall`

```
SymbolCall { type: "SymbolCall", name: string, actor: string | null, args: Arg[], line: number }
Arg { type: "Arg", key: string | null, value: Literal | BacktickInline }
```

### `Control`

```
Control {
  type: "Control"
  name: string        // nom du contrôle : vel, tempo, goto, striated, smooth, destru, stop...
  args: string[]      // fragments d'arguments bruts : ["120"], ["2","1"] ; [] pour un contrôle sans argument
}
```

Forme parsée d'un contrôle BP3 écrit directement dans le flux : `vel(120)` → `{ name:"vel", args:["120"] }`,
`goto(2,1)` → `{ name:"goto", args:["2","1"] }`, `striated` → `{ name:"striated", args:[] }`.
Distinct de l'`InstantControl` (`!(...)`) et du `RuntimeQualifier` (`(...)` suffixe d'un symbole).

### `SymbolWithTriggerIn`

```
SymbolWithTriggerIn {
  type: "SymbolWithTriggerIn"
  symbol: Symbol           // le symbole porteur
  triggers: TriggerIn[]    // un ou plusieurs trigger-in attachés
}
```

Émis pour `Sa<!sync1` : un symbole qui attend un trigger entrant (`<!`) avant de se déclencher.

### `Rest`

```
Rest { type: "Rest" }
```

### `Prolongation`

```
Prolongation { type: "Prolongation" }
```

### `UndeterminedRest`

```
UndeterminedRest { type: "UndeterminedRest" }
```

Compilé en `_rest` (commande BP3 built-in, encodée `T0, 17` dans `Encode.c`).
**Pas en `...`** — trois points seraient interprétés comme trois periods (`T0, 7` × 3).
Le caractère historique `…` (Unicode U+2026) a été abandonné par Bernard en 2022
pour des raisons de compatibilité UTF-8/HTML. `_rest` est la notation recommandée.

### `Period`

```
Period { type: "Period" }
```

### `NumericDuration`

```
NumericDuration { type: "NumericDuration", numerator: number, denominator: number }
```

### `Polymetric`

```
Polymetric {
  type: "Polymetric"
  voices: RhsElement[][]                     // tableau de voix, chaque voix = séquence plate
  qualifiers: Qualifier[]                    // speed et scale uniquement (engine [])
  runtimeQualifier: RuntimeQualifier | null  // suffixe () sur le groupe : {A B}(vel:100)
  label: string | null                       // étiquette UI : couplet1:{A B, C D}
}
```

Une voix est une séquence plate d'éléments RHS (pas de nœud wrapper), conforme à
EBNF.md `voice = rhs_element+`.

Les contrôles à l'intérieur d'une voix se positionnent avec `!()` et `![]` comme
éléments instantanés dans le flux. Pas de portée voix implicite — la position dans
le source = la position dans la sortie BP3.

**Contrainte** : seuls `speed` et `scale` sont des qualifiers de polymétrie.
Les autres qualifiers (`weight`, `mode`, `scan`, `on_fail`) après `}` appartiennent
à la **règle**, pas au bloc polymétrique. Le parser utilise un lookahead sur la clé.

**Ratio de cadre** : le 1er champ `{M, …}` est porté par le qualifier **`speed`** de `qualifiers`.
La **durée de surface** `:N` (supprime l'ancien `[speed:N]`, cf. décision 2026-06-26) **désucre vers
ce même qualifier** — `{A B}:2` → `Polymetric{qualifiers:[speed:2]}` → `{2, A B}`. ⚠️ Le ratio vit
ICI, **jamais dans un champ ad hoc** : c'est le contrat que lisent BP3 (`encoder.js` `getQualValue`)
ET BPx. `{A}:2` -> `{2, A}`. Ratios fractionnaires : `{A}:1/2` -> `{1/2, A}` (value = "1/2", chaîne).

## Portées d'attachement × nœud AST, par élément (CONTRAT)

Un suffixe/opérateur peut s'attacher à une **base** de portées (l'espace et le `!` désambiguïsent —
cf. `EBNF.md` §Portées). **Cette base n'est pas une loi uniforme** : chaque élément déclare **quelles
portées lui sont valides** et **vers quel nœud AST il se traduit pour chacune**. Ce tableau est le
**contrat** que lisent les consommateurs de l'AST (BP3 *et* BPx) : un producteur qui invente un champ
hors-contrat (ex. un `frame` ad hoc pour un ratio qui appartient à `Polymetric.qualifiers`) casse le
chemin vivant en silence, même si un autre chemin reste vert. **Citer cette table AVANT de coder une
représentation.**

Les cinq portées : `terminal` (collé) · `groupe` (collé `}`) · `règle` (espacé, fin de RHS) ·
`!accolé` (collé, flux conjoint) · `!inline` (espacé, événement séparé).

| Élément | terminal | groupe | règle | !accolé | !inline | Nœud AST |
|---------|:---:|:---:|:---:|:---:|:---:|----------|
| **durée `:N`** | ✅ | ✅ | ✅ | ❌ | ❌ | `Polymetric.qualifiers` (qualifier `speed`) — le RHS/le terminal est emballé dans le `Polymetric` |
| **tempo `/N` `\N` `*N`** | ✅ `A[/2]` | ✅ | ✅ `[/2]A` | ❌ | ✅ `![/2]` | `TempoOp{operator, value, scope}` |
| **runtime `(clé:val)`** | ✅ | ✅ | ✅ | ✅ | ✅ | terminal/groupe/règle → `…suffixQualifiers`/`runtimeQualifier` ; `!` → `InstantControl{conjoint}` |
| **moteur `[weight]`** | ❌ | ❌ | ✅ | ❌ | ❌ | `Rule.flags` |
| **moteur `[mode]` `[scan]`** | ❌ | ❌ | ✅ / préambule bloc | ❌ | ❌ | `Rule.mode` / préambule sous-grammaire |
| **`scale`** (polymétrie) | ❌ | ✅ | ❌ | ❌ | ❌ | `Polymetric.qualifiers` (qualifier `scale`) |

Portée invalide pour un élément = **erreur fail-loud**, jamais un avalement silencieux (ex. durée
isolée dans le flux `A :2 B` → `ParseError`). La colonne « nœud AST » est **normative** : c'est là,
et nulle part ailleurs, que le consommateur lit la valeur.

### `SimultaneousGroup`

```
SimultaneousGroup {
  type: "SimultaneousGroup"
  primary: Symbol | SymbolCall | Rest | NilString
  secondaries: (Symbol | SymbolCall)[]
}
```

`!` est exclusivement temporel — pas de FlagMutation dans les secondaries.
Les flags vont dans les qualifiers de la Rule (via `[]`).

Exemples :
- `Sa!dha [phase=2]` -> `{ primary: Symbol("Sa"), secondaries: [Symbol("dha")] }` + rule flag `[phase=2]`
- `lambda [Num_a=20, Num_b=0]` -> `NilString` + rule flags

### `TriggerIn`

```
TriggerIn { type: "TriggerIn", name: string, qualifiers: Qualifier[] }
```

### `OutTimeObject`

```
OutTimeObject { type: "OutTimeObject", name: string }
```

`!f` standalone (sans primaire) → `<<f>>` en BP3. Objet hors-temps déclenché
sans occuper de durée dans la séquence.

### `InstantControl`

```
InstantControl {
  type: "InstantControl"
  qualifier: RuntimeQualifier | Qualifier | ProductionInline   // le contrôle à appliquer
}

// ProductionInline (décision 2026-06-14) : ![@seed:N] = re-semence dans le flux.
// { type:"ProductionInline", directives: [Directive{name:"seed", value:N}] } → _srand(N).
// Restreint à seed (autres clés rejetées au parse). Consommateurs (BPx) : émettre _srand.
```

`!(vel:80)` → `_script(CT n)` en BP3. `![retro]` → `_retro` en BP3. `![@seed:2]` → `_srand(2)`.
Événement instantané (zéro durée) positionné explicitement dans le flux temporel.
La position dans le source BPScript = la position dans la sortie BP3.

Exemples :
- `{!(chan:1) C8 - - -}` → `{_script(CT 0) C8 - - -}`
- `{C8 - - - !(chan:1)}` → `{C8 - - - _script(CT 0)}`
- `![retro] A B` → `_retro A B`

### `Variable`

```
Variable { type: "Variable", name: string }
```

### `Wildcard`

```
Wildcard { type: "Wildcard", index: number | null }
```

### `TemplateMaster` / `TemplateMasterGroup`

```
TemplateMaster { type: "TemplateMaster", name: string, args: Arg[] | null }
TemplateMasterGroup { type: "TemplateMasterGroup", elements: RhsElement[] }
```

`$X` → TemplateMaster. `${$X S &X}` → TemplateMasterGroup (contenu récursif).

### `TemplateAnchor`

```
TemplateAnchor { type: "TemplateAnchor", kind: "master" }
```

Ancre de gabarit maître « `$ ` » (dollar isolé avec espace). Valide en LHS et en RHS.
Compilé en token BP3 `(=` (sans fermeture de parenthèse) — T2,0 dans Encode.c:1341-1364.
L'ancre symétrique `(:` (esclave) est réservée, non implémentée (zéro occurrence corpus).

### `TemplateSlave` / `TemplateSlaveGroup`

```
TemplateSlave { type: "TemplateSlave", name: string, args: Arg[] | null }
TemplateSlaveGroup { type: "TemplateSlaveGroup", elements: RhsElement[] }
```

> **ABANDONNÉ (2026-06-10)** : le champ `transcriptions: string[] | null` prévu dans cette
> version a été supprimé en faveur de l'approche `Scene.homomorphisms` + marqueurs inline
> (`star`, `$X`, `&X`). Les noms de transcription entre master et slave sont conservés
> verbatim dans le RHS BP3 ; BPx les consume via `rewriteHomomorphismMarkers`.
> Le champ `transcriptions` N'EXISTE PAS dans l'implémentation courante du parser.

### `TieStart` / `TieContinue` / `TieEnd`

```
TieStart { type: "TieStart", symbol: string }
TieContinue { type: "TieContinue", symbol: string }
TieEnd { type: "TieEnd", symbol: string }
```

### `NilString`

```
NilString { type: "NilString" }
```

Peut porter des flags via `Rule.flags` : `lambda [Num_a=20, Num_b=0]`.

### `BacktickInline` / `BacktickStandalone` / `BacktickOrphan`

```
BacktickInline { type: "BacktickInline", code: string, tag: string | null }
BacktickStandalone { type: "BacktickStandalone", tag: string, code: string, line: number }
BacktickOrphan { type: "BacktickOrphan", tag: string, code: string, line: number }
```

**Langage TOUJOURS connu — tag OU eval d'acteur, jamais deviné** (décision hub
`2026-07-04-cv-curve-syntaxe-backtick-type.md` + ajustement [299]). `BacktickOrphan` (top-level) et
la courbe `CVInstance` backtick EXIGENT un `tag` (erreur claire au parse sinon). Un backtick de flux
(`BacktickStandalone`/`BacktickInline`) peut être NON taggé (`tag:null`) SSI la tête de sa règle est
un `@actor … eval.X` : il **hérite** de X (résolu en `annotateBackticks` → `payload.interp`) ; un
tag explicite l'override. Un flux non taggé SANS eval d'acteur en tête = **orphelin** → erreur claire
à l'annotation. Le `code` ne contient jamais le tag (séparé à l'analyse).

`BacktickStandalone` est un **terminal de plein droit** du RHS (membre de `RhsElement` /
`element_core`) : il occupe une position dans le flux comme une note. Le `tag` désigne
l'**interpréteur**/producteur (`eval`) du code (`strudel`, `hydra`, `csound`, `js`…). Sortie (modèle
producteur/canal, Romain 2026-07-14) : un `eval.<X>` embarqué autonome **sort en natif** (pas de
transport) ; seul le producteur défaut `js` est placé par le dispatcher vers NOTRE `transport`.
`BacktickInline` est une valeur calculée dans un paramètre ; `BacktickOrphan` est du code
taggé au niveau scène. Le rattachement d'un backtick à un acteur précis (voix-code) est décrit dans
`docs/design/ACTOR.md`.

### `Context`

```
Context { type: "Context", positive: boolean, symbols: string[] }
```

`#X` (un seul symbole), `#(X Y)` (groupe), `#?` (boundary) sont les trois formes du contexte négatif.
Les wildcards `?N` sont acceptés dans les groupes : `#(?1 ?3 ?2 ?4)` → `symbols: ["?1","?3","?2","?4"]`.
Utilisé dans les grammaires LIN pour les patterns de permutation (ex: change ringing).

### `RawBrace`

```
RawBrace {
  type: "RawBrace"
  value: "{" | "}" | ","            // brace brute pour embedding patterns
  polySpeed: number | string | null  // annoté par le 2-pass depuis }[speed:N]
  qualifiers: Qualifier[] | null     // [speed:N] sur } (source du polySpeed)
}
```

Émis quand `{`, `}`, `,` sont non-balancés dans une règle (embedding pattern).
Le 2-pass `annotateUnbalancedBraces` propage `[speed:N]` du `}` vers le `{` correspondant.

### `FlagExpr`

```
FlagExpr {
  type: "FlagExpr"
  flag: string
  operator: "=" | "+" | "-" | null  // null = flag nu [Atrans]
  value: number | string | null     // null = flag nu
}
```

Même note lexicale que `Guard` : `[times-1]` → `{ flag:"times", operator:"-", value:1 }`
(le parser décompose le trailing-dash absorbé par le tokenizer).

### `Literal`

```
Literal { type: "Literal", value: number | string }
```

### `HomomorphismDeclAST`

```
HomomorphismDeclAST {
  type: "Homomorphism"
  name: string          // nom de la section (ex: "*", "m1", "mineur", "TR")
  pairs: [string, string][]         // paires PLATES [source, cible], last-write-wins
  line?: number         // ligne source de la directive @transcription.xxx
}
```

Attaché à `Scene.homomorphisms[]`. Produit par le parser depuis les directives
`@transcription.<subkey>` et les entrées de `lib/transcription.json`.

- Format `sections` : une entrée par section → `name` = clé de section
- Format `mappings` : une seule entrée → `name` = subkey de la directive
- Paires identité (a→a) conservées pour fidélité Bernard

**Homomorphisme à CHAÎNES — `chains` = SUCRE, compilé en `pairs` plates (corrigé 2026-07-17).**
Une section de lib peut se DÉCLARER en chaîne : `"sections": { "TR": { "chains": { "C3":
["B3","F4","C6"], … } } }` (fidèle au format natif `-ho.<X>` : `note --> a --> b`). Mais
`chains` n'est PAS un mécanisme distinct : le parser le **DÉPLIE en paires consécutives**
(`C3-->B3-->F4-->C6` ⇒ `(C3,B3),(B3,F4),(F4,C6)`), TOUTES fusionnées **dernière écriture gagne**,
et n'émet QUE `pairs` (jamais `chains` dans l'AST). Le mécanisme réel — infirmation du modèle
depth-indexed par l'**oracle natif** (2026-07-17 ; BPx `loadGrammar.ts:6368-6396`) — est UNE table
de paires par homo, appliquée par `Image()` (une application par portée empilée du même nom). Ex.
`TR` : `C3` début de la ligne 1 (`(C3,B3)`) MAIS clé médiane de la ligne 2 (`(C3,B4)`) → `C3→B4`
(dernière écriture). Le consommateur (Kairos) **ne déplie rien** : il query `image(name,sym)` 2-arg.

**Invocation par SYMBOLE NU (marqueur `role`).** Le symbole nu dont le nom = une
section chargée devient un marqueur d'invocation : le nœud RHS `Symbol` reçoit
`role: "homomorphism"` (type Symbol conservé — élément positionnel du flux). La
**répétition** du symbole encode la profondeur `k` (1er `TR` → `chains[note][0]`, `TR
TR` → `[1]`…). Précédence de résolution (contrat bpscript-bpx L31) : **terminal >
non-terminal (règle) > homo** — le marqueur n'est posé que si le nom n'est ni un
terminal d'alphabet en portée ni un LHS de règle. Passe BPx-only (`resolveHomomorphismMarkers`,
bpxAst.js) : le chemin BP3 hérité ne voit jamais `role`/`chains` (byte-id préservé).

Contrat BPx (`ast.ts:150-157`) : BPx consomme ce tableau pour appliquer les
transformations de terminaux post-dérivation via `rewriteHomomorphismMarkers`
(paires) / `applyImage` étendu (chaînes, compte du marqueur `role:'homomorphism'`).

---

## Contraintes lexicales

- `-` trailing (sans espace avant) : `do4-` = IDENT(`do4`) + REST(`-`) — deux tokens distincts.
  `do4 -` = terminal `do4` + silence (identique). `dhin--` = terminal `dhin` + silence + silence.
  **Rappel** : BP3 interdit `-` dans les noms de bol (CompileGrammar.c:1196). Le tokenizer
  émet donc toujours le tiret traînant comme REST séparé.
  **Exception dans `[]`** : `[times-1]` = mutation flag (`times` − 1), pas identifiant `times-`.
- `-` interne autorisé dans les non-terminaux LHS via pré-scan (`Tr-11`, `my-var`)
- `#` est autorisé dans les identifiants pour les altérations (C#4, F#2)
- `_` **interne** est autorisé dans les noms (`just_intonation`, `sa_4`).
  `_` **traînant** (sans caractère alphanum suivant) génère un ou plusieurs tokens PROLONG séparés :
  `si3_____` = IDENT(`si3`) + PROLONG×5 — conforme à BP3 (OkBolChar2 / Encode.c:415).

---

## Pipeline AST

```
Source (.bps) -> Tokenizer -> Parser -> AST (Scene)
  -> Actor resolver (charge JSON, expand symboles, conflits)
  -> Encoder -> BP3 grammar + terminalActorMap + mapTable + sceneTable -> WASM engine
```

La phase **Actor resolver** (`src/transpiler/actorResolver.js`) entre le parser et l'encoder :
1. Collecte les `ActorDirective` de la Scene
2. Charge `alphabets.json` par acteur via `loadLib()`, expand les terminaux (notes × altérations × registres)
3. Construit un `symbolActorMap` : terminal → Set d'acteurs qui le contiennent
4. Résout les déclarations `gate X:actorName` comme bindings acteur
5. Walk récursif du RHS : résolution implicite (1 acteur → auto) ou erreur (ambiguïté)

L'encoder émet en parallèle :
- `terminalActorMap` (terminal BP3 → acteur) — pour le routing runtime
- `mapTable` (I/O mappings CC/OSC ↔ flags/triggers) — pour le bus I/O runtime
- `sceneTable` (nom → fichier .bps) — pour l'orchestration multi-scènes
- `exposeTable` (flags exposés au parent) — pour le scoping inter-scènes

---

## Exemple

Source : `[phase==1] S -> Sa!dha Re [mode:random]`

```json
{
  "type": "Scene",
  "subgrammars": [{
    "type": "Subgrammar",
    "index": 1,
    "rules": [{
      "type": "Rule",
      "guard": { "flag": "phase", "operator": "==", "value": 1, "mutates": false },
      "lhs": [{ "type": "Symbol", "name": "S" }],
      "arrow": "->",
      "rhs": [
        { "type": "SimultaneousGroup",
          "primary": { "type": "Symbol", "name": "Sa" },
          "secondaries": [{ "type": "Symbol", "name": "dha" }] },
        { "type": "Symbol", "name": "Re" }
      ],
      "qualifiers": [{ "pairs": [{ "key": "mode", "value": "random" }] }],
      "runtimeQualifier": null
    }]
  }]
}
```
