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
}
```

---

## Directives

### `Directive`

```
Directive {
  type: "Directive"
  name: string                    // "core", "controls", "alphabet", "tuning", "routing"...
  subkey: string | null           // "western", "just_intonation", "studio"... (après le .)
  binding: string | null          // clé de connexion après : ("sc", "midi", "raga"...)
  params: Param[] | null          // forme explicite (transport=sc, eval=python)
  value: string | number | null   // 120, "7/8", -24...
  aliases: Alias[] | null         // résolution de conflits
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
}
```

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
  value: string | number | boolean // "random", 50, "1/2", "K1=3", true (clé nue)
  decrement: number | null         // pour weight:50-12
}

TempoOp {
  type: "TempoOp"
  operator: "/" | "\" | "*" | "**" // opérateur BP3
  value: number                    // A[/2] → { operator:"/", value:2 }
}
```

Exemples :
- `[mode:random]` → `{ pairs:[{key:"mode", value:"random"}] }`
- `A[/2]` → `{ tempoOp:{ operator:"/", value:2 } }` → compilé en `/2 A`
- `{v1, v2}[speed:2]` → compilé en `{2, v1, v2}` (ratio polymétrique)

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
- **symbole** : `Sa(vel:120)` → `Sa _script(CT0)` — attaché au `Symbol` node
- **règle** : `S -> C4 D4 (vel:80)` → `_script(CT1) C4 D4` — dans `Rule.runtimeQualifier`
- **groupe** : `{A B}(filter:lp)` → `{_script(CT2_start) A B _script(CT2_end)}` — dans `Polymetric.runtimeQualifier`

Le transpileur maintient une table de mapping `CTn → { scope, params }` passée au dispatcher.

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
           | SimultaneousGroup | OutTimeObject | TriggerIn | Variable | Wildcard
           | TemplateMaster | TemplateMasterGroup | TemplateSlave | TemplateSlaveGroup
           | TieStart | TieContinue | TieEnd
           | NilString | BacktickStandalone | Context | RawBrace
```

### Qualificateurs par élément

Tout `RhsElement` peut porter des qualificateurs moteur `[]` (préfixe ou suffixe)
et/ou runtime `()` (suffixe uniquement) :

```
RhsElement {
  ...                                            // propriétés spécifiques au type
  controlQualifiers: (EngineQualifier | RuntimeQualifier)[] | null
  controlPrefix: boolean | null                  // true si le premier qualifier est un préfixe (engine [] uniquement)
  tempoOp: TempoOp | null                        // suffixe [/2], [*3] etc.
}
```

Exemples :
- `[tempo:2]A` (moteur, préfixe) : `controlQualifiers: [{tempo:2}]`, `controlPrefix: true`
- `A(vel:80)` (runtime, suffixe) : `controlQualifiers: [{vel:80}]`, `controlPrefix: null`
- `A[/2]` (opérateur temporel, suffixe) : `tempoOp: { operator:"/", value:2 }`

`[]` supporte préfixe et suffixe. `()` est toujours suffixe sur l'element.

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
  voices: RhsElement[][]
  qualifiers: Qualifier[]                    // speed et scale uniquement (engine [])
  runtimeQualifier: RuntimeQualifier | null  // suffixe () sur le groupe : {A B}(vel:100)
}
```

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
TemplateSlave { type: "TemplateSlave", name: string, args: Arg[] | null }
TemplateSlaveGroup { type: "TemplateSlaveGroup", elements: RhsElement[] }
```

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

### `Literal`

```
Literal { type: "Literal", value: number | string }
```

---

## Contraintes lexicales

- `-` n'est JAMAIS autorisé dans un identifiant (`dhin--` = `dhin` + silence + silence)
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
