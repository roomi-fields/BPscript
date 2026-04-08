# BPscript — AST (Abstract Syntax Tree)

Version 0.7 — dérivé de BPSCRIPT_EBNF.md v0.6, validé par 44 scènes transpilées.

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
  actors: ActorDirective[]           // @actor directives (design target, not yet parsed)
  declarations: Declaration[]
  macros: Macro[]
  cvInstances: CVInstance[]
  backticks: BacktickOrphan[]
  subgrammars: Subgrammar[]
  templates: TemplateEntry[] | null    // section @templates (optionnelle)
}
```

---

## Directives

### `Directive`

```
Directive {
  type: "Directive"
  name: string                    // "core", "controls", "alphabet", "tuning", "routing", "mode"...
  subkey: string | null           // "western", "just_intonation", "studio"... (après le .)
  binding: string | null          // clé de connexion après : ("sc", "midi", "raga"...)
  runtime: string | null          // pour @mode:X — la valeur du mode ("random", "lin", etc.)
  params: Param[] | null          // forme explicite (transport=sc, eval=python)
  value: string | number | null   // 120, "7/8", -24...
  aliases: Alias[] | null         // résolution de conflits
  modifiers: ModeModifier[] | null // pour @mode:X(destru, mm:60) — modificateurs de sous-grammaire
  timePatterns: TimePattern[] | null // pour @timepatterns: t1=1/1, t2=3/2
  line: number
}

Param {
  type: "Param"
  key: string                     // "transport", "eval"
  value: string                   // "sc", "python", "midi"
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
- `@alphabet.raga:sc` → binding = clé de connexion (transport + eval)
- `@tuning.just_intonation:raga` → binding = alphabet cible
- `@routing.studio` → pas de binding (chargement simple)

La forme `(transport=x, eval=y)` est mutuellement exclusive avec `:` :
- `:sc` = sucre pour `(transport=sc, eval=sc)`
- `(transport=sc, eval=python)` = les deux spécifiés quand ils diffèrent

Exemples :
- `@core` -> `{ name:"core", subkey:null, binding:null }`
- `@controls` -> `{ name:"controls", subkey:null, binding:null }`
- `@routing.studio` -> `{ name:"routing", subkey:"studio", binding:null }`
- `@alphabet.western:midi` -> `{ name:"alphabet", subkey:"western", binding:"midi" }`
- `@alphabet.raga:sc` -> `{ name:"alphabet", subkey:"raga", binding:"sc" }`
- `@alphabet.raga(transport=sc, eval=python)` -> `{ name:"alphabet", subkey:"raga", params:[{key:"transport", value:"sc"}, {key:"eval", value:"python"}] }`
- `@tuning.just_intonation:raga` -> `{ name:"tuning", subkey:"just_intonation", binding:"raga" }`
- `@tuning.equal_temperament:western` -> `{ name:"tuning", subkey:"equal_temperament", binding:"western" }`
- `@sub.dhati` -> `{ name:"sub", subkey:"dhati", binding:null }`
- `@tempo:120` -> `{ name:"tempo", subkey:null, value:120 }`
- `@baseHz:440` -> `{ name:"baseHz", subkey:null, value:440 }`
- `@alphabet.western(A:La)` -> `{ name:"alphabet", subkey:"western", aliases:[{from:"A", to:"La"}] }`
- `@improvize` -> `{ name:"improvize" }` — active Improvize=1 dans les settings BP3
- `@allitems` -> `{ name:"allitems" }` — active AllItems=1 dans les settings BP3
- `@timepatterns: t1=1/1, t2=3/2` -> `{ name:"timepatterns", timePatterns:[{name:"t1", ratio:"1/1"}, {name:"t2", ratio:"3/2"}] }`

---

## Acteurs

### `ActorDirective`

```
ActorDirective {
  type: "ActorDirective"
  name: string                    // "sitar", "tabla", "lights"
  properties: {
    alphabet: string              // référence vers alphabets.json ("sargam", "western")
    scale: string | null          // gamme/degrés → pitch via tempérament (null = pas de pitch)
    sounds: string | null         // définitions per-terminal: timbre, percussions, samples (null = défaut transport)
    transport: TransportRef       // destination de rendu
    eval: string | null           // clé d'eval pour backticks (null = même que transport)
  }
  line: number
}

TransportRef {
  type: "TransportRef"
  key: string                     // "webaudio", "midi", "osc", "dmx"
  params: { [key: string]: any }  // { ch: 10 }, { port: 57110 }, {}
}
```

Exemples :
- `@actor sitar  alphabet:sargam  scale:sargam_22shruti  transport:webaudio`
  -> `{ name:"sitar", properties:{ alphabet:"sargam", scale:"sargam_22shruti", sounds:null, transport:{key:"webaudio", params:{}}, eval:null } }`
- `@actor tabla  alphabet:tabla  sounds:tabla_perc  transport:webaudio`
  -> `{ name:"tabla", properties:{ alphabet:"tabla", scale:null, sounds:"tabla_perc", transport:{key:"webaudio", params:{}}, eval:null } }`
- `@actor piano  alphabet:western  scale:western_12TET  sounds:piano_timbre  transport:webaudio`
  -> `{ name:"piano", properties:{ alphabet:"western", scale:"western_12TET", sounds:"piano_timbre", transport:{key:"webaudio", params:{}}, eval:null } }`
- `@actor drums  alphabet:tabla  sounds:tabla_gm  transport:midi(ch:10)`
  -> `{ name:"drums", properties:{ alphabet:"tabla", scale:null, sounds:"tabla_gm", transport:{key:"midi", params:{ch:10}}, eval:null } }`

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

Avec `@actor` : `gate Sa:sitar` → `{ temporalType:"gate", name:"Sa", actor:"sitar", runtime:null }`.
Legacy : `gate Sa:sc` → `{ temporalType:"gate", name:"Sa", actor:null, runtime:"sc" }`.

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
  name: string                      // nom de l'instance ("env1", "lfo1")
  target: string                    // paramètre ciblé ("filter", "pan", "gain")
  transport: string                 // runtime cible ("sc", "webaudio")
  lib: string | null                // lib source ("filter", null pour backtick)
  objectType: string                // type d'objet ("adsr", "lfo", "ramp", "backtick")
  args: (number | string)[]         // arguments positionnels
  namedArgs: { [key: string]: any } // arguments nommés (attack:10, rate:4)
  code: string | null               // code backtick (si objectType == "backtick")
  line: number
}
```

Exemples :
- `env1(filter, sc) = filter.adsr(10, 100, 0.7, 200)`
  -> `{ name:"env1", target:"filter", transport:"sc", lib:"filter", objectType:"adsr", args:[10, 100, 0.7, 200], namedArgs:{} }`
- `lfo1(pan, webaudio) = filter.lfo(rate:4, depth:50)`
  -> `{ name:"lfo1", target:"pan", transport:"webaudio", lib:"filter", objectType:"lfo", args:[], namedArgs:{rate:4, depth:50} }`
- `` mod1(gain, sc) = `js: new Float32Array(...)` ``
  -> `{ name:"mod1", target:"gain", transport:"sc", lib:null, objectType:"backtick", args:[], namedArgs:{}, code:"js: new Float32Array(...)" }`

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

La section `@templates` est optionnelle. Si absente, `Scene.templates` est `null` et BP3
génère les templates automatiquement. Si présente, l'encoder émet la section `TEMPLATES:`
dans la grammaire BP3 avec `_` au lieu de `?` et `@N` au lieu de `$N`.

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
  flags: FlagExpr[]                // [phase=2, Atrans] dans le RHS
  qualifiers: Qualifier[]          // [mode:random, scan:left] en fin de règle (engine [])
  runtimeQualifier: RuntimeQualifier | null  // suffixe () sur la règle : S -> C4 D4 (vel:80)
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

### `EngineQualifier` — instructions moteur BP3

```
EngineQualifier {
  type: "EngineQualifier"
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
}
```

Exemples :
- `[mode:random]` → `{ pairs:[{key:"mode", value:"random"}] }`
- `[retro]` → `{ pairs:[{key:"retro", value:true}] }` → compilé en `_retro` (sans parenthèses)
- `[rotate:2]` → `{ pairs:[{key:"rotate", value:2}] }` → compilé en `_rotate(2)`
- `A[/2]` → `{ tempoOp:{ operator:"/", value:2 } }` → compilé en `_tempo(2/1) A _tempo(1/2)`
- `A[*2]` → `{ tempoOp:{ operator:"*", value:2 } }` → compilé en `_tempo(1/2) A _tempo(2/1)`
- `A[/3/2]` → `{ tempoOp:{ operator:"/", value:"3/2" } }` → compilé en `_tempo(3/2) A _tempo(2/3)`
- `{A B}[/2]` → bracket : `_tempo(2/1) {A B} _tempo(1/2)` (portée locale au groupe)
- `![/2]` → `_tempo(2/1)` dans le flux (pas de bracket, portée séquentielle)
- `{v1, v2}[speed:2]` → compilé en `{2, v1, v2}` (ratio polymétrique, distinct du tempo)
- `[weight:inf]` → `{ pairs:[{key:"weight", value:"inf"}] }` → compilé en `<inf>`

**Clés nues** : quand `value === true` (clé sans `:valeur`), l'encodeur émet le nom BP3
sans parenthèses (`_retro`). Quand une valeur est fournie, avec parenthèses (`_rotate(2)`).

**Poids infini** : `value === "inf"` → compilé en `<inf>` (priorité absolue en BP3).

### `RuntimeQualifier` — paramètres runtime

```
RuntimeQualifier {
  type: "RuntimeQualifier"
  pairs: RuntimePair[]
  scope: "symbol" | "rule" | "group"  // déduit par le parser selon la position
}

RuntimePair {
  type: "RuntimePair"
  key: string                      // RUNTIME_KEY : vel, wave, filter, filterQ, pan...
  value: string | number | Backtick // 120, "sawtooth", `rrand(40,127)`
}
```

`()` est **toujours suffixe** (jamais en préfixe). La portée est déduite de la position :
- **symbole** : `Sa(vel:120)` → `Sa _script(CT 0)` — attaché au `Symbol` node
- **règle** : `S -> C4 D4 (vel:80)` → `_script(CT 1) C4 D4` — dans `Rule.runtimeQualifier`
- **instantané** : `{!(chan:1) C8 -, !(chan:2) C7 C7}` → `{_script(CT 2) C8 -, _script(CT 3) C7 C7}` — via `InstantControl` dans le flux
- **groupe** : `{A B}(filter:lp)` → `_script(CT 4_start) {A B} _script(CT 4_end)` — dans `Polymetric.runtimeQualifier`

Le transpileur maintient une table de mapping `CT n → { scope, params }` passée au dispatcher.

---

## Éléments LHS

```
LhsElement = Symbol | Variable | Wildcard | Context | RawBrace
```

---

## Éléments RHS

```
RhsElement = Symbol | SymbolCall | Rest | Prolongation | UndeterminedRest
           | Period | NumericDuration | Polymetric
           | SimultaneousGroup | OutTimeObject | InstantControl | TriggerIn
           | Variable | Wildcard
           | TemplateMaster | TemplateMasterGroup | TemplateSlave | TemplateSlaveGroup
           | TieStart | TieContinue | TieEnd
           | NilString | BacktickStandalone | Context | RawBrace
```

### Qualificateurs par élément

Tout `RhsElement` peut porter des qualificateurs moteur `[]` (préfixe ou suffixe)
et/ou runtime `()` (suffixe uniquement). La position est déterminée par l'**espacement** :

```
RhsElement {
  ...                                            // propriétés spécifiques au type
  prefixQualifiers: EngineQualifier[] | null     // [] collé à droite : [/2]A, [retro]A
  suffixQualifiers: (EngineQualifier | RuntimeQualifier)[] | null  // [] ou () collé à gauche : A[weight:50], A(vel:80)
}
```

La distinction préfixe/suffixe est déterminée par le **tokenizer** via le champ
`spaceBefore` sur chaque token. Le parser utilise cette information pour router
le qualificateur dans `prefixQualifiers` ou `suffixQualifiers`.

Exemples :
- `[/2]A` (préfixe, collé à A) : `prefixQualifiers: [{ tempoOp: {"/", 2} }]`
- `A[weight:50]` (suffixe, collé à A) : `suffixQualifiers: [{ weight: 50 }]`
- `A(vel:80)` (runtime suffixe) : `suffixQualifiers: [{ vel: 80 }]`
- `A [X] B` → **erreur** : qualifier flottant, utiliser `A ![X] B`

`[]` supporte préfixe et suffixe. `()` est toujours suffixe.

### `Symbol`

```
Symbol { type: "Symbol", name: string, actor: string | null, line: number }
```

Le champ `actor` est rempli par le `:acteur` explicite (`Sa:sitar`), ou par la
phase de résolution implicite (quand un seul acteur contient ce symbole). `null`
pour les non-terminaux (qui n'ont pas d'acteur).

### `SymbolCall`

```
SymbolCall { type: "SymbolCall", name: string, actor: string | null, args: Arg[], line: number }
Arg { type: "Arg", key: string | null, value: Literal | BacktickInline }
```

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
  voices: Voice[]
  qualifiers: Qualifier[]                    // speed et scale uniquement (engine [])
  runtimeQualifier: RuntimeQualifier | null  // suffixe () sur le groupe : {A B}(vel:100)
  label: string | null                       // étiquette UI : couplet1:{A B, C D}
}

Voice {
  elements: RhsElement[]
}
```

Les contrôles à l'intérieur d'une voix se positionnent avec `!()` et `![]` comme
éléments instantanés dans le flux. Pas de portée voix implicite — la position dans
le source = la position dans la sortie BP3.

**Contrainte** : seuls `speed` et `scale` sont des qualifiers de polymétrie.
Les autres qualifiers (`weight`, `mode`, `scan`, `on_fail`) après `}` appartiennent
à la **règle**, pas au bloc polymétrique. Le parser utilise un lookahead sur la clé.

`{A}[speed:2]` -> `{2, A}` en BP3. Ratios fractionnaires : `{A}[speed:1/2]` -> `{1/2, A}`.

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
  qualifier: RuntimeQualifier | EngineQualifier   // le contrôle à appliquer
}
```

`!(vel:80)` → `_script(CT n)` en BP3. `![retro]` → `_retro` en BP3.
Événement instantané (zéro durée) positionné explicitement dans le flux temporel.
La position dans le source BPscript = la position dans la sortie BP3.

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

### `TemplateSlave` / `TemplateSlaveGroup`

```
TemplateSlave { type: "TemplateSlave", name: string, args: Arg[] | null, transcriptions: string[] | null }
TemplateSlaveGroup { type: "TemplateSlaveGroup", elements: RhsElement[], transcriptions: string[] | null }
```

Le champ `transcriptions` contient les noms de transcription entre le master et le slave :
- `$X tabla_stroke &X` → `transcriptions: ["tabla_stroke"]`
- `$X * TR &X` → `transcriptions: ["*", "TR"]`
- `$X &X` (sans transcription) → `transcriptions: null`

Le parser collecte les identifiants entre le `$X` et le `&X` correspondant.
L'encoder utilise ces noms pour émettre les labels dans la grammaire BP3 et
pour construire le fichier -ho. avec les étiquettes appropriées.

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

---

## Contraintes lexicales

- `-` trailing (sans espace avant) fait partie de l'identifiant : `do4-` = un seul terminal.
  `do4 -` = terminal `do4` + silence. `dhin--` = terminal `dhin` + silence + silence.
  **Exception dans `[]`** : `[times-1]` = mutation flag (`times` − 1), pas identifiant `times-`.
- `-` interne autorisé dans les non-terminaux LHS via pré-scan (`Tr-11`, `my-var`)
- `#` est autorisé dans les identifiants pour les altérations (C#4, F#2)
- Les underscores sont autorisés dans les noms (`just_intonation`)

---

## Pipeline AST

```
Source (.bps) -> Tokenizer -> Parser -> AST (Scene)
  -> Actor resolver (charge JSON, expand symboles, conflits)  (* design target *)
  -> Macro-expander -> Encoder -> BP3 grammar + terminalActorMap -> WASM engine
```

La phase **Actor resolver** (design target, pas encore implémentée) entre le parser et l'encoder :
1. Collecte les `ActorDirective` de la Scene
2. Charge `alphabets.json`, `scales.json`, `sounds/`, `temperaments.json` par acteur
3. Importe les symboles de chaque alphabet dans la symbolTable
4. Détecte les conflits inter-acteurs (même symbole, acteurs différents)
5. Résout les `Symbol.actor = null` par lookup implicite (un seul acteur candidat)

L'encoder émet en parallèle une `terminalActorMap` (terminal BP3 -> acteur)
utilisée par le dispatcher au runtime.

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
