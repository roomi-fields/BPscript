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
  declarations: Declaration[]
  macros: Macro[]
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
  name: string                    // "core", "controls", "alphabet", "sub", "tempo"...
  subkey: string | null           // "western", "raga", "dhati"... (après le .)
  runtime: string | null          // "midi", "supercollider", "python"...
  value: string | number | null   // 120, "7/8", -24...
  aliases: Alias[] | null         // résolution de conflits
  line: number
}

Alias {
  type: "Alias"
  from: string
  to: string
}
```

Le champ `subkey` permet d'accéder à une entrée spécifique dans un fichier JSON.
La convention est stricte : `@file` → `lib/file.json`, `@file.key` → `lib/file.json` → clé `key`.

Exemples :
- `@core` -> `{ name:"core", subkey:null, runtime:null, value:null }`
- `@controls` -> `{ name:"controls", subkey:null, runtime:null, value:null }`
- `@alphabet.western:midi` -> `{ name:"alphabet", subkey:"western", runtime:"midi", value:null }`
- `@alphabet.raga:supercollider` -> `{ name:"alphabet", subkey:"raga", runtime:"supercollider", value:null }`
- `@sub.dhati` -> `{ name:"sub", subkey:"dhati", runtime:null, value:null }`
- `@tempo:120` -> `{ name:"tempo", subkey:null, runtime:null, value:120 }`
- `@meter:3/4` -> `{ name:"meter", subkey:null, runtime:null, value:"3/4" }`
- `@transpose:-24` -> `{ name:"transpose", subkey:null, runtime:null, value:-24 }`
- `@alphabet.western(A:La)` -> `{ name:"alphabet", subkey:"western", aliases:[{from:"A", to:"La"}] }`

---

## Déclarations

### `Declaration`

```
Declaration {
  type: "Declaration"
  temporalType: "gate" | "trigger" | "cv"
  name: string
  runtime: string
  line: number
}
```

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
  guard: Guard | Guard[] | null    // un ou plusieurs when (AND)
  contexts: Context[]
  lhs: LhsElement[]
  arrow: "->" | "<-" | "<>"
  rhs: RhsElement[]
  flags: FlagExpr[]                // [phase=2, Atrans] dans le RHS
  qualifiers: Qualifier[]          // [mode:random, scan:left] en fin de règle
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
- `when phase==1` -> `{ flag:"phase", operator:"==", value:1, mutates:false }`
- `when Ideas-1` -> `{ flag:"Ideas", operator:"-", value:1, mutates:true }`
- `when Ideas` (bare flag) -> `{ flag:"Ideas", operator:null, value:null, mutates:false }`

### `Qualifier`

```
Qualifier {
  type: "Qualifier"
  pairs: QualPair[]
  tempoOp: TempoOp | null          // [/2], [*3] etc. — mutuellement exclusif avec pairs
}

QualPair {
  type: "QualPair"
  key: string
  value: string | number | boolean // "random", 50, "1/2", "K1=3", true (clé nue)
  decrement: number | null         // pour weight:50-12
}

TempoOp {
  type: "TempoOp"
  operator: "/" | "\" | "*" | "**" // opérateur BP3
  value: number                    // A[/2] → { operator:"/", value:2 }
}
```

Un `Qualifier` contient soit des `pairs` (clé:valeur), soit un `tempoOp` (opérateur
temporel), jamais les deux. `[/2]` → `{ pairs:[], tempoOp:{ operator:"/", value:2 } }`.

Exemples :
- `A[/2]` → compilé en `/2 A` (speed = 2)
- `{A B}[\3]` → compilé en `\3 A B` (speed = 1/3)
- `{v1, v2}[speed:2]` → compilé en `{2, v1, v2}` (ratio polymétrique, pas un TempoOp)

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

### Qualificateurs de contrôle par élément

Tout `RhsElement` peut porter des qualificateurs de contrôle (préfixe et/ou suffixe) :

```
RhsElement {
  ...                                    // propriétés spécifiques au type
  controlQualifiers: Qualifier[] | null  // qualificateurs de contrôle attachés
  controlPrefix: boolean | null          // true si le premier qualifier est un préfixe
}
```

- `[vel:80]A` (préfixe) : `controlQualifiers: [{vel:80}]`, `controlPrefix: true`
- `A[vel:80]` (suffixe) : `controlQualifiers: [{vel:80}]`, `controlPrefix: false/null`
- `[ins:3, volumecont, volume:127]A[volume:0]` : deux qualifiers, le premier en préfixe

La distinction préfixe/suffixe est analogue à `++i`/`i++` en C :
- **Préfixe** = le contrôle s'applique avant l'élément → compilé en `_vel(80) A`
- **Suffixe** = le contrôle s'applique après l'élément → compilé en `A _vel(80)`

Le parser distingue les qualificateurs de contrôle (clé dans `lib/controls.json`)
des qualificateurs de règle (`mode`, `weight`, `scan`, etc.).

### `Symbol`

```
Symbol { type: "Symbol", name: string, line: number }
```

### `SymbolCall`

```
SymbolCall { type: "SymbolCall", name: string, args: Arg[], line: number }
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
  qualifiers: Qualifier[]          // speed et scale uniquement
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
  -> Type-checker -> Macro-expander -> Encoder -> BP3 grammar -> WASM engine
```

---

## Exemple

Source : `when phase==1 S -> Sa!dha Re [mode:random]`

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
      "qualifiers": [{ "pairs": [{ "key": "mode", "value": "random" }] }]
    }]
  }]
}
```
