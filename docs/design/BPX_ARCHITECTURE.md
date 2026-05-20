# BPx — Architecture interne

> **Contrat externe** : voir [BPX_ENGINE_SPEC.md](BPX_ENGINE_SPEC.md) — input AST, output Tree+Tokens, modes, déterminisme.
>
> **Ce document** : organisation **interne** du moteur. Comment le code est découpé pour que les algos évoluent indépendamment et que les performances tiennent en live coding.
>
> Lecteur cible : dev qui implémente BPx ou un de ses plugins.

---

## 0. Stack technique

| Choix | Décision |
|---|---|
| **Langage** | TypeScript strict, compilé en ESM |
| **Runtime** | Node ≥ 20 + navigateurs evergreen |
| **WASM** | non en v1 ; à reconsidérer si benchmarks bloquent |
| **Build** | esbuild (sub-100 ms) — pas de bundler complexe |
| **Tests** | vitest (Node + jsdom) |
| **Benchs** | tinybench, dans la même CI que les tests |
| **Layout** | package standalone `/dev/bp/BPx/` ; consommé par BPscript via dépendance locale |
| **Pas de** | classes héritées, getters/setters, decorators, mixins, async dans le hot path |

Justification : voir §9.

---

## 1. Principe — quatre règles immuables

**R1. Moteur structurel pur.** BPx dérive une grammaire de symboles abstraits et produit une structure temporelle. Il ne connaît ni notes, ni MIDI, ni OSC, ni transport, ni eval, ni alphabet, ni acteur.

**R2. Identité ≠ charge.** Chaque symbole porte une **identité** (entier dense, 0..N) utilisée pour le matching, et une **charge utile opaque** attachée à l'identité par l'AST consommateur. Le moteur ne lit jamais la charge.

**R3. Performance de premier rang.** Cibles en millisecondes, pas en secondes. Allocation dans le hot path = bug. Voir §5.

**R4. Extensibilité par registres.** Modes, émetteurs, commandes, routeurs sont enregistrés à l'init. Ajouter un de ces éléments ne touche jamais le cœur.

Toute évolution future doit pouvoir être justifiée par référence à ces quatre règles. Si une feature les viole, elle est hors-scope ou demande un amendement explicite de l'archi.

---

## 2. Taxonomie des nœuds

### 2.1 Cinq types, pas plus

```
DerivationTree
└── root: Node
       │
       ├── SequenceNode      // suite ordonnée d'enfants
       │     └── children: Node[]
       │
       ├── PolymetricNode    // contrainte d'égalité de span
       │     ├── voices: VoiceNode[]
       │     └── speed: number | null
       │
       ├── VoiceNode         // (uniquement enfant de Polymetric)
       │     ├── children: Node[]
       │     └── proportions: Float64Array
       │
       ├── OccupyingNode     // unité qui occupe du temps
       │     ├── id: int32   (→ SymbolRegistry)
       │     ├── role: 'leaf' | 'rest' | 'prolongation'
       │     ├── span: Span
       │     └── tieState: 'start' | 'continue' | 'end' | null
       │
       └── EventNode         // unité instantanée (zéro durée)
             ├── id: int32
             └── span: Span (start === end)
```

**`SequenceNode`** : la primitive composite. Toute règle qui produit plusieurs éléments en série donne un SequenceNode.

**`PolymetricNode`** : seul nœud structurellement « concurrent ». Voix synchronisées sur un span partagé. Tout le reste de la concurrence (`Sa!dha`, `!f`) est désucré en placement multi-nœuds au load.

**`VoiceNode`** : enfant exclusif de `PolymetricNode`. Porte les proportions internes (Float64Array dense, somme = 1).

**`OccupyingNode`** : tout ce qui occupe du temps. `role` distingue leaf/rest/prolongation pour la polymétrie et les ties — c'est la **seule** sémantique structurelle visible au moteur sur un nœud occupant. Tout le reste (gate vs trig vs cv, note vs sample, etc.) est dans `payload`, donc opaque.

**`EventNode`** : tout ce qui ne prend pas de temps. Flag mutation, trigger emit, contrôle, out-time object — le moteur les place à un timestamp et c'est tout. La nature de l'événement est dans le payload.

### 2.2 Champs traversaux (sur tous les nœuds)

| Champ | Type | Sens |
|---|---|---|
| `kind` | int8 (enum) | Type de nœud — discriminant pour le visiteur |
| `id` | int32 | Identifiant unique dans l'arbre, alloué densément |
| `span` | Span | start/end en beats + ms (float64) |
| `payload` | unknown | **Opaque**, voyage sans être lu |

### 2.3 Span

```ts
type Span = {
  startBeat: number;     // float64
  endBeat: number;
  durationBeats: number; // = endBeat - startBeat (cache)
  startMs: number;       // float64, calculé à TimingPass
  endMs: number;
  durationMs: number;
  tempoMultiplier: number; // accumulé depuis la racine ([/2], [*3])
};
```

Dense, plat, alloué dans un pool. Aucune méthode — c'est de la donnée.

### 2.4 Ce qui **disparaît** par rapport à la spec actuelle

| Spec actuelle | Sort | Pourquoi |
|---|---|---|
| `ControlNode` (avec `kind: flag/trigger/script/...`) | Devient `EventNode` à payload opaque | Le moteur n'a pas à connaître les sous-types |
| `RestNode` | Devient `OccupyingNode` avec `role: 'rest'` | Un silence est juste un nœud occupant à payload neutre |
| `LeafNode.simultaneous: string[]` | Disparaît | Désucré au load en plusieurs nœuds au même `start` |
| `LeafNode.runtimeQualifiers` | Va dans `payload` | Opacité |
| `LeafNode.engineQualifiers` | Consommé pendant le load (tempo, retro, …) ou attaché si non interprété | `[]` ≠ `()` |

---

## 3. Pipeline — passes nommées

### 3.1 Vue d'ensemble

```
                       ┌─────────────────┐
                       │   AST (Scene)   │
                       └────────┬────────┘
                                │
                ┌───────────────▼───────────────┐
                │         loadGrammar()         │
                │ ┌───────────────────────────┐ │
                │ │ buildSymbolRegistry       │ │
                │ │ compileRules (→ trie/IR)  │ │
                │ │ compileContexts           │ │
                │ │ compileGuards             │ │
                │ └───────────────────────────┘ │
                └───────────────┬───────────────┘
                                │
                                ▼
                ┌───────────────────────────────┐
                │         Session (state)       │
                │  buffer | tree | flags | rng  │
                └───────────────┬───────────────┘
                                │
        ┌───────────────────────┼─────────────────────┐
        │                       │                     │
        ▼                       ▼                     ▼
   batch:                   streaming:           live coding:
   run(pipeline)            for await pull       dispatch(cmd)
                                                  → re-run from
                                                    dirty boundary
                                │
                ┌───────────────▼───────────────────────────┐
                │              run(pipeline)                │
                │                                           │
                │  for each subgrammar:                     │
                │    DerivePass(idx, mode) ────┐            │
                │       │                      │            │
                │       │ buffer = stream      │            │
                │       │ tree   = stream      │            │
                │       │                      │            │
                │       └─ jusqu'au point fixe │            │
                │                              │            │
                │  PolymetryPass ──────────────┤            │
                │  TimingPass    ──────────────┤            │
                │  ConstraintPass ─────────────┤            │
                │  EmitPass(format) ───────────┘            │
                └───────────────────────┬───────────────────┘
                                        │
                                        ▼
                       ┌────────────────────────────────┐
                       │  DerivationTree + emit output  │
                       │  (TimedToken[] | MIDI | Csound │
                       │   | MusicXML | custom)         │
                       └────────────────────────────────┘
```

### 3.2 Détail des passes

Chaque pass est une **fonction nommée**, testable en isolation, dépendant uniquement de la `Session` et d'un `PassContext` injecté. Les passes peuvent muter la session (raison perf, R3) mais ont un contrat de déterminisme : `(stateIn, ctx) → stateOut` reproductible bit-à-bit.

#### 3.2.1 `loadGrammar` — pré-compilation

| Sous-étape | Rôle | Référence BP3 |
|---|---|---|
| `buildSymbolRegistry` | Aplatit l'AST en `Map<string, int32>` + table inverse | `CompileGrammar.c:903 ReadAlphabet` (sans BOLSIZE) |
| `compileRules` | LHS → structure indexée par symbole de tête, RHS → bytecode minimal d'application | `CompileGrammar.c:1378 ParseGrammarLine`, `CompileGrammar.c:1271 CreateBol` |
| `compileContexts` | `#(X Y)`, `#X`, `#?` → patterns dense | `CompileGrammar.c:1637 Encode` (contextes) |
| `compileGuards` | `[phase==1]` → fonction `(flags) → bool` mémoïsable | `CompileGrammar.c:1399` (parse), `Compute.c` (eval) |
| `compileWeights` | `[weight:50-12]` → `WeightSpec { base, decrement, ctrl }` | spec §5 |

**Sortie** : objet `Grammar` immuable, indexable. Pas une liste de strings, pas un AST réutilisé.

#### 3.2.2 `DerivePass` — boucle de dérivation

```
DerivePass(session, subgramIdx, mode)
   │
   ├── scanner = BufferScanner(session.buffer, mode.scanDirection)
   ├── selector = mode.RuleSelector(session.rng, session.flags)
   │
   └── while not fixedPoint:
         for position in scanner:
            candidates = subgram.indexLookup(position.head)
            applicable = candidates.filter(matchLHS, matchContext, evalGuard)
            if applicable.empty: continue
            rule = selector.pick(applicable)
            if rule == null: break
            rule.apply(buffer, position, treeBuilder)
            scanner.notifyMutation(...)
```

Le `mode` (registre, §4.1) fournit deux objets :
- `RuleSelector` — comment choisir parmi les règles applicables (ORD = première, RND = pondéré, LIN = round-robin sur règles, POSLONG = LHS le plus long, TEM = template-match).
- `scanDirection` — gauche-droite, droite-gauche, à partir d'un point fixe.

L'application d'une règle :
1. Splice le buffer (linked list, O(1))
2. Crée les nouveaux `Node`s (pool §5)
3. Insère dans l'arbre via `treeBuilder.attach(parentNode, newNodes)`
4. Met à jour les ties si mutation autour d'un `~`

**Référence BP3** :
- Compute.c (top-level) — boucle pass principale
- ProduceItems.c — application des règles, gestion du buffer
- CompileGrammar.c (modes ORD/RND/SUB/LIN/TEM/POSLONG)

#### 3.2.3 `PolymetryPass` — résolution itérative

```
PolymetryPass(session)
   │
   ├── queue = collectPolymetricNodes(tree, postOrder)
   │
   └── for poly in queue:
         for voice in poly.voices:
            voice.symbolCount = countOccupying(voice)
            voice.proportions = allocProportions(voice)
         lcm = computeLCM(poly.voices.map(v => v.symbolCount))
         poly.span.durationBeats = lcm / (poly.speed ?? 1)
         for voice in poly.voices:
            voice.span.durationBeats = poly.span.durationBeats
            assignBeatsToChildren(voice, voice.span / voice.symbolCount)
```

**Itératif strict** (jamais récursif) — c'est le fix du stack overflow BP3.

**Référence BP3** :
- `Polymetric.c:44 PolyMake` — algorithme original (récursif via `PolyExpand:793`)
- `Polymetric.c:2155 TellComplex` — l'erreur que BPx ne lèvera pas
- **Élimine** : `FillPhaseDiagram.c` complet (~2.5 kLOC, grille 2D + Class quantization)
- **Élimine** : `Class(double)` (FillPhaseDiagram.c:2030) — quantization Kpress, plus pertinent en float64

#### 3.2.4 `TimingPass` — beats → ms

Propage les temps absolus top-down depuis la racine. Tempo cumulatif via `tempoMultiplier`. Conversion finale `beat × 60000/tempo` en float64 — pas d'arrondi intermédiaire.

**Référence BP3** : `TimeSet.c:143 SetTimeObjects` (extrait : `T[col] = period × (position-1) / Ratio`), mais simplifié massivement parce que pas de grille `p_Seq` à projeter.

#### 3.2.5 `ConstraintPass` — solver de timing

C'est le morceau **critique pour la parité**. Sans lui, BPx produit des timestamps « idéaux » qui peuvent diverger de BP3 sur les transitions complexes (chevauchements, gaps, ties cross-polymetric).

```
ConstraintPass(session, options)
   │
   ├── for each adjacent pair (a, b) in occupying nodes:
   │     alpha = computeAlpha(a, b, ref)            // ratio dilatation
   │     ts1, ts2 = candidateTimings(a, b, alpha)
   │     accept = solutionAcceptable(ts1, ts2, constraints)
   │     if not accept: ts1, ts2 = locate(a, b, options)
   │
   └── apply timings to spans
```

**Référence BP3** (à porter quasi-littéralement, c'est la zone risque §2.1 du feasability) :
- `TimeSet.c:47 TimeSet` — entrée
- `TimeSetFunctions.c:56 Locate` — solver itératif
- `TimeSetFunctions.c:41 Possible_choices` — enumération solutions
- `TimeSetFunctions.c:43 Situation_ok` — validation contrainte
- `TimeSetFunctions.c:45 Get_choice` — sélection
- `TimeSetFunctions.c:50 Solution_is_accepted` — critère
- `TimeSetFunctions.c:52 Alternate_correction1` — fallback

~2 kLOC C, à tester contre S0/S1 sur les 116 grammaires.

**Plug-replacement** : ce pass est un point d'extension. Une version v2 « TEMPORAL_DEFORMATION » (CC/OSC déforment en temps réel) remplace simplement ce pass dans le pipeline sans toucher le reste.

#### 3.2.6 `EmitPass` — sortie

```ts
interface Emitter<T> {
  name: string;
  emit(tree: DerivationTree, options?: any): T;
}
```

Émetteurs par défaut :
- `'timed-tokens'` → `TimedToken[]` (silent sound objects, équivalent BP3)
- `'tree-json'` → JSON sérialisable
- `'midi-events'` (futur) → `[{ type: 'note-on', note, vel, t }, ...]`
- `'csound-score'` (futur)
- `'musicxml'` (futur)

Les émetteurs sont des **registres** (§4.2). N'importe quel utilisateur peut en enregistrer un sans toucher BPx. La signature `emit(tree)` n'a pas accès au state interne — pas de fuite d'abstraction.

---

## 4. Registres

Quatre points d'extension. **Aucun n'est dans une enum hardcodée.**

### 4.1 Modes

```ts
interface Mode {
  name: string;
  scanDirection: 'lr' | 'rl' | 'longest-first';
  ruleSelector(rng: LCG, flags: FlagStore): RuleSelector;
  postProcess?(tree: DerivationTree, subgramIdx: number): void;
}

// Built-in :
modes.register('ord', ORDMode);
modes.register('rnd', RNDMode);
modes.register('lin', LINMode);
modes.register('sub', SUBMode);
modes.register('sub1', SUB1Mode);
modes.register('tem', TEMMode);
modes.register('poslong', POSLONGMode);

// Custom (Bernard ou user) :
modes.register('weighted-poslong', { ... });
```

`TEM` (§Q1 spec) est un mode comme un autre une fois encapsulé.

**Référence BP3** : `CompileGrammar.c:391 InsertSubgramTypes` parse les directives modes ; `Compute.c` dispatche au runtime.

### 4.2 Émetteurs

Voir §3.2.6. Interface unique, pas de connexion au moteur autre que `tree → output`.

### 4.3 Commandes

Toute mutation live coding est une **donnée**, pas un appel de méthode :

```ts
type Command =
  | { op: 'addRule', subgramIdx: number, rule: RuleAST }
  | { op: 'modifyRule', subgramIdx: number, ruleIdx: number, rule: RuleAST }
  | { op: 'removeRule', subgramIdx: number, ruleIdx: number }
  | { op: 'setFlag', name: string, value: number }
  | { op: 'setWeight', subgramIdx: number, ruleIdx: number, weight: WeightSpec }
  | { op: 'setMode', subgramIdx: number, mode: string }
  | { op: 'emitTrigger', name: string, payload?: unknown }
  | { op: 'hotSwapGrammar', ast: SceneAST, options?: SwapOptions };

interface CommandHandler {
  apply(session: Session, cmd: Command): { dirty: DirtySet, undo: Command };
}

session.dispatch(cmd) → { newState, undo }
```

Bénéfices gratuits :
- **Undo/redo** : chaque handler retourne une commande inverse.
- **Replay** : `session.replay(commandLog)` reconstruit un état.
- **Networked collab** : sérialisable JSON, ordonnable via Lamport timestamp.
- **Scripting** : un programme externe = une source de commandes.

Surface API publique : un seul point d'entrée mutationnel, `dispatch`.

### 4.4 Routeurs

Pas dans BPx, mais l'**interface** y est définie pour que les routeurs puissent consommer la sortie :

```ts
interface Router {
  consume(output: TimedToken[] | DerivationTree): void;
}
```

BPx publie l'arbre et/ou les tokens ; le routeur (BPscript dispatcher, par exemple) lit les payloads et dispatche. **Le moteur ne sait pas ce qu'est un routeur.**

### 4.5 Orchestrateur multi-scène — hors BPx

L'orchestration de plusieurs Sessions (hiérarchie de scènes BPscript, propagation cross-scene des flags/triggers, routage des `@map`) est **application-level**, pas dans le moteur. BPx fournit les primitives :

- `Session` — une instance moteur autonome (= une scène)
- `FlagStore` — état local par session
- `TriggerBus` — bus local par session
- `dispatch(command)` — surface mutationnelle

Un `SceneOrchestrator` construit *sur* ces primitives pour composer plusieurs sessions. Le moteur n'a pas connaissance de l'orchestrateur. Cette séparation est essentielle : un user peut écrire son propre orchestrateur sans toucher BPx.

Voir [SCENES.md](SCENES.md) pour le modèle complet (hiérarchie, cycle de vie, routing).

---

## 5. Performance

### 5.1 Budgets

| Opération | Cible | Mesuré sur |
|---|---|---|
| Dérivation grammaire moyenne (~100 règles, ~1k tokens) | < 10 ms | Bench `medium.bench.ts` |
| Hot-swap (modify + re-derive) | < 50 ms | Bench `hotswap.bench.ts` |
| Streaming pull (2s d'avance) | < 5 ms | Bench `stream.bench.ts` |
| Allocations dans hot path | proche zéro | Heap snapshot pre/post derive |
| Temps `loadGrammar` | < 2 ms | Bench `load.bench.ts` |

**Régression bench = bloquant CI.** Au même titre qu'une régression de S0/S1.

### 5.2 Techniques

#### 5.2.1 Object pools

Trois pools dimensionnés au load :

```ts
class NodePool {
  private free: Node[] = [];
  acquire(kind: NodeKind): Node { ... }
  release(node: Node): void { ... }
  releaseAll(): void { /* fin de dérivation */ }
}
```

Pools : `OccupyingNode`, `EventNode`, `SequenceNode` (les 3 high-volume). `PolymetricNode` et `VoiceNode` sont rares, allocation directe.

#### 5.2.2 Pré-compilation grammaire

Au load :
- LHS de chaque règle indexé par symbole de tête (`Map<int32, Rule[]>`)
- Contextes compilés en `Int32Array` + masque (positif/négatif)
- Guards en closures monomorphes (pas de switch sur `operator` au runtime)
- Weights en struct dense (3 int32) — pas d'objet par règle

Le hot path ne re-parse jamais l'AST.

#### 5.2.3 Identités denses

```ts
type SymbolId = number;  // int32, dense 0..N
type RuleId = number;    // int32

class SymbolRegistry {
  private byName: Map<string, SymbolId>;
  private byId: string[];        // name lookup
  private payloads: unknown[];   // attached at load
}
```

Comparaisons sur entiers, pas sur strings. `name` n'apparaît que dans les messages d'erreur et la sérialisation.

#### 5.2.4 Buffer = liste doublement chaînée + free list

Spec §5 le précise déjà. À implémenter avec nodes recyclés via pool, pas via `new` à chaque insertion.

#### 5.2.5 Streaming = generator

```ts
function* derive(session: Session): Generator<DeriveYield, DerivationTree, unknown> {
  for (const subgram of session.grammar.subgrammars) {
    while (!fixedPoint(...)) {
      // ... apply rule ...
      yield { kind: 'progress', tokensProduced: ... };
    }
  }
  // ...
  return finalTree;
}
```

Un `yield` = un point de checkpoint + d'interruption. Mutations via `dispatch()` sont absorbées au prochain yield. Pas de Promise dans le moteur.

L'orchestration externe (Session + clock playback) consomme le generator via `for await` ou pull manuel.

#### 5.2.6 Pas de `delete`, shapes monomorphes

Toute propriété de Node est définie au constructeur. Pas de `node.foo = bar` ad-hoc. V8 garde la hidden class stable → inlining optimal.

#### 5.2.7 Float64 partout, pas de Number fragmenté

`span.startBeat` etc. sont des `number` JS (= float64 IEEE-754). Pas de `BigInt`, pas de Decimal.js. Les calculs critiques utilisent `Math.fround` seulement si on veut une précision intermédiaire en float32 (pas le cas ici).

### 5.3 Anti-patterns interdits

| Pattern | Pourquoi non |
|---|---|
| `class Foo extends Bar` | Hiérarchie = polymorphisme caché, pénalité V8 |
| `Object.defineProperty`, getters/setters | Pénalité V8, opaques au profiler |
| `delete obj.x` | Casse hidden class |
| `arguments` keyword | Idem |
| `try/catch` dans hot path | V8 désoptimise (sauf moteurs récents, mais à éviter) |
| `Promise` / `async` dans la dérivation | Pause yield arbitraire, GC pressure |
| `Object.keys()` / `for..in` sur structures hot | Itération lente |
| Closures capturant des grosses portées | Allocation par appel |

### 5.4 Worker (option v2)

L'API publique de BPx est conçue **comme si** elle pouvait tourner en Worker :
- Pas de référence externe partagée
- Communications par snapshots structurés (commands sérialisables, tokens sérialisables)
- Tree exposé en lecture seule au consommateur (snapshot)

Si v1 ne tient pas les budgets, on déplace `Session` dans un Worker dédié sans changer le contrat externe.

---

## 6. Tests d'extensibilité

Toute évolution architecturale doit passer ces quatre tests sans régression.

### 6.1 « Bernard veut un mode expérimental »

Cible : **1 fichier nouveau**, zéro modification du moteur.

```ts
// modes/experimental.ts
import { modes } from 'bpx';
modes.register('experimental', {
  name: 'experimental',
  scanDirection: 'lr',
  ruleSelector: (rng, flags) => new MyCustomSelector(rng, flags),
});
```

### 6.2 « User veut exporter en Csound score »

Cible : **1 fichier nouveau**.

```ts
// emitters/csound.ts
import { emitters } from 'bpx';
emitters.register('csound-score', {
  emit(tree) { return tree.walk(...).map(...).join('\n'); }
});
```

### 6.3 « Le solver TEMPORAL_DEFORMATION évolue »

Cible : **1 ligne** dans la config pipeline.

```ts
session.pipeline.replace('constraint', new RealtimeDeformationSolver(...));
```

### 6.4 « User pilote un servomoteur depuis une grammaire »

Cible : **rien dans BPx**. Il définit un payload `{type:'servo', angle:90}`, écrit un routeur qui filtre `payload.type === 'servo'`, point.

---

## 7. Non-goals

BPx **ne fait pas** :

- ❌ MIDI, OSC, WebAudio, DMX, fichiers audio, Csound
- ❌ Alphabets, octaves, tunings, tempéraments — résolution pitch
- ❌ Acteurs, transports, REPL, eval de code
- ❌ Sound objects, prototypes (`-so.`), instruments
- ❌ UI, timeline, pianoroll, drag, visualisation
- ❌ CC/OSC mapping, MapEngine
- ❌ **Orchestration multi-scène** (hiérarchie, propagation cross-scene, routing `@map`) — application-level, cf. [SCENES.md](SCENES.md)
- ❌ Sérialisation BP3 texte (encoder.js mort)
- ❌ Compatibilité fichiers BP3 binaires
- ❌ `_script(CT n)` ou tout autre sentinel — la charge est opaque, pas redirigée
- ❌ Quantization grille (`Kpress`, `Class`)
- ❌ Limite BOLSIZE sur les noms de symboles

Ces points appartiennent à BPscript (transpiler, dispatcher, routeur) ou aux émetteurs/routeurs externes. Si on est tenté de les ramener dans BPx, c'est un signal de dérive.

---

## 8. Cartographie BP3 → BPx

### 8.1 Ce qui est porté (algorithme à reproduire)

| Concept BP3 | Source | LOC | BPx |
|---|---|---|---|
| LCG portable | `bp3_random.c` (`bp3_srand`, `bp3_rand`) | ~30 | `src/lcg.ts` (déjà fait conceptuellement) |
| Compilation grammaire | `CompileGrammar.c:44 CompileGrammar` | 2282 | `src/load/compileGrammar.ts` |
| Parse modes | `CompileGrammar.c:391 InsertSubgramTypes` | ~100 | Registre modes §4.1 |
| Parse alphabet | `CompileGrammar.c:903 ReadAlphabet` | ~140 | `src/load/symbolRegistry.ts` (sans BOLSIZE) |
| Parse règles | `CompileGrammar.c:1378 ParseGrammarLine` | ~300 | `src/load/compileRules.ts` |
| Encodage règle | `CompileGrammar.c:1637` (Encode) | ~60 | Inline dans `compileRules` |
| Dérivation principale | `Compute.c` + `ProduceItems.c` | ~4200 | `src/passes/derive/` (split par mode) |
| LCM polymétrie | `Polymetric.c:44 PolyMake` | 2177 | `src/passes/polymetry.ts` (itératif !) |
| Calcul timing | `TimeSet.c:143 SetTimeObjects` | 738 | `src/passes/timing.ts` |
| Constraint solver | `TimeSetFunctions.c:56 Locate` + voisins | 1218 | `src/passes/constraint.ts` |

**Total à porter : ~11 kLOC C → ~3-5 kLOC TypeScript** (estimation, bénéfice de la suppression de la grille, des MIDI specifics, des allocations explicites C).

### 8.2 Ce qui disparaît (hors scope BPx)

| BP3 | Pourquoi pas dans BPx | Va où |
|---|---|---|
| `FillPhaseDiagram.c` (2480) | Grille 2D `p_Seq` éliminée par float64 | nulle part — disparaît |
| `Class(double)` quantization | Pas de quantization | nulle part |
| `MakeSound.c`, `SoundObjects2.c` (4500) | Sound objects = MIDI specifics | Routeur BPscript |
| `MIDIstuff.c`, `MIDIdriver.c` | Driver MIDI | Routeur |
| `Csound.c`, `CsoundScoreMake.c` | Csound | Émetteur Csound externe |
| `Encode.c` | Encodage texte BP3 | Mort |
| `HTML.c`, `Graphic.c`, `DisplayThings.c` | UI BP3 | UI BPscript séparée |
| `SaveLoads*.c` | Sérialisation fichiers BP3 | Pas de compat binaire |
| `Script.c`, `ScriptUtils.c` | `_script(CT n)` hack | **Aboli** par opacité payload |
| `Tonality.c` | Pitch | Resolver acteur, hors BPx |

### 8.3 Ce qui est nouveau (sans équivalent BP3)

| BPx | Pourquoi |
|---|---|
| `DerivationTree` natif (pas reconstruit) | Source de vérité unique (§17 spec) |
| `EventNode` à payload opaque | R2 (identité ≠ charge) |
| Pipeline de passes nommées | R4 (extensibilité) |
| Pools nodes | R3 (perf) |
| Generator de dérivation | Streaming + cancel sans Promise |
| Registres modes/émetteurs/commandes | R4 |
| FlagStore observable + parent chain | Multi-instance + scoping (§7 spec) |
| TriggerBus async | Live coding |
| Determinisme bit-à-bit cross-platform | Contrat §13 spec |

---

## 9. Justification du choix de stack

### 9.1 Pourquoi TypeScript et pas JavaScript pur

- 5-6 mois de dev sur un moteur stateful avec 5 types de nœuds, 4 registres, 8 passes : sans types, le coût mental d'introspection en relecture est prohibitif.
- Refactor sans peur : V8 inline aussi bien du JS strict que du TS compilé. Coût runtime = 0.
- Catch les bugs S0/S1 ne catchent pas (shape mismatch, champ optionnel oublié).
- IDE nav : critique sur un pipeline à 8 passes avec injection de contextes.
- Build moderne (esbuild, swc) : compile un projet de 5 kLOC en < 100 ms. Iteration speed équivalente à JS pur.

### 9.2 Pourquoi pas Rust/WASM en v1

- Bénéfice perf attendu : 2-3× sur compute pur. Mais le hot path BPx est dominé par allocation/dispatch, où V8 + pools fait jeu égal.
- Coût boundary WASM ↔ JS : passage de l'arbre = sérialisation ou shared memory ; les deux ont un overhead non-trivial.
- Coût itération : rebuild WASM 5-30 s vs reload TS instantané. Sur 6 mois, c'est des semaines perdues.
- Tooling live coding (debug, hot-reload, REPL) : excellent en JS, encore embryonnaire en Rust/WASM.
- Risque : chercher la perf avant de mesurer. R3 dit *cible*, pas *prématuré*.

**Critère de revisitation** : si après optim sérieuse JS (§5), une grammaire réelle dépasse les budgets §5.1 d'un facteur 2 ou plus, on porte le ou les passes critiques en Rust/WASM (probablement `ConstraintPass` ou `PolymetryPass` sur scènes très imbriquées). On ne porte **pas** tout le moteur.

### 9.3 Layout package

```
/dev/bp/BPx/
├── package.json         (name: "bpx", type: "module")
├── tsconfig.json        (strict, target ES2022)
├── src/
│   ├── index.ts         (API publique : createBPx, registries)
│   ├── session.ts       (Session, dispatch)
│   ├── lcg.ts
│   ├── flagStore.ts
│   ├── triggerBus.ts
│   ├── load/
│   │   ├── compileGrammar.ts
│   │   ├── symbolRegistry.ts
│   │   └── compileRules.ts
│   ├── passes/
│   │   ├── derive/
│   │   │   ├── index.ts
│   │   │   ├── ord.ts
│   │   │   ├── rnd.ts
│   │   │   ├── sub.ts
│   │   │   ├── lin.ts
│   │   │   ├── tem.ts
│   │   │   └── poslong.ts
│   │   ├── polymetry.ts
│   │   ├── timing.ts
│   │   └── constraint.ts
│   ├── emit/
│   │   ├── timedTokens.ts
│   │   └── treeJson.ts
│   ├── pool/
│   │   └── nodePool.ts
│   └── types/
│       ├── ast.ts        (input AST shape — ré-exporté de BPscript)
│       ├── node.ts       (5 node types)
│       ├── span.ts
│       └── command.ts
├── test/
│   ├── parity/           (vs S0/S1, sur 116 grammaires)
│   ├── unit/             (par pass, par registre)
│   └── bench/            (perf budgets §5.1)
└── docs/
    └── ARCHITECTURE.md   (← ce document, copié/symlink)
```

BPscript consomme via `package.json` :
```json
"dependencies": { "bpx": "file:../BPx" }
```

---

## 10. Décisions et points ouverts

### 10.1 Acquis

| # | Question | Décision |
|---|---|---|
| Q1 | Contrat de parité timing | **On porte `Locate` & co.** Parité gestion temporelle + polymétrie. Voir étude faisabilité §2.1. |
| Q2 | Mode TEM en MVP ? | **Repoussé en étape 10** (après parité ORD/RND/SUB). MVP couvre ~83% des grammaires test. |
| Q3 | Format payload | **Scellé dans l'AST** par le transpileur BPscript. BPx reçoit du code mort. |
| Q4 | API streaming | **Pull via generator**. Le consommateur tire au rythme du playback. Push optionnel par-dessus. |
| Q5 | Multi-instance | **Modèle multi-instance application-level**, hors BPx core. Voir [SCENES.md](SCENES.md). |

### 10.2 Encore à trancher

| # | Question | Statut |
|---|---|---|
| Q6 | FlagStore : parent chain in-memory ou propagation event-based ? | **Tranché v1 : parent chain in-memory.** Simple, rapide, suffisant tant qu'on reste dans le même process JS. Variante event-based à ajouter en v2 si portage Worker/Rust subprocess. Sémantique observable identique dans les deux cas. |
| Q7 | Sémantique « consume terminal scène » | **Ouvert.** Quand le parent consomme un token de type scène, comportement runtime à arrêter. Voir [SCENES.md §2.3](SCENES.md). |
| Q8 | Versionnement | **Acté** : 0.x jusqu'à parité S0/S1 100%. 1.0.0 = parité tenue + benchmarks tenus + 3 émetteurs. |

### 10.3 Roadmap MVP — milestones livrables

Chaque milestone livre un incrément validable. Ordre strict (chaque M dépend de M-1). Critère de validation = sous-ensemble des 116 grammaires test passent S0/S1.

| M | Durée | Contenu | Validation | Référence BP3 |
|---|---|---|---|---|
| **M0** | 1 sem | Scaffold projet + LCG + FlagStore + TriggerBus + SymbolRegistry + types Node | Tests unitaires verts | `bp3_random.c` |
| **M1** | 2 sem | Loader AST → Grammar pré-compilée + DerivePass mode ORD + Buffer linked list | ~5 grammaires linéaires passent S0/S1 (ex: `12345678`, `765432`) | `CompileGrammar.c`, `Compute.c`, `ProduceItems.c` |
| **M2** | 1 sem | Mode RND + sélection pondérée (LCG portable) | ~10 grammaires (ajout des stochastiques simples) | `CompileGrammar.c` (modes), spec §5 |
| **M3** | 3 sem | PolymetryPass itératif (LCM, voix, period notation, speed) + DerivationTree construit pendant la dérivation | ~25 grammaires (ajout polymétrie simple) | `Polymetric.c:44 PolyMake` (porté en itératif) |
| **M4** | 2 sem | TimingPass (beat → ms float64) + ConstraintPass (Locate & co.) | ~50 grammaires (parité timing) | `TimeSet.c:143 SetTimeObjects`, `TimeSetFunctions.c:56 Locate` + voisins |
| **M5** | 1 sem | Contextes `#(X Y)`, `#X`, `#?` + captures `?N` + ties `~` | ~70 grammaires | `CompileGrammar.c:1637 Encode` (contextes) |
| **M6** | 1 sem | Modes SUB / SUB1 / LIN / POSLONG | ~80 grammaires | `CompileGrammar.c`, `Compute.c` (modes) |
| **M7** | 1 sem | EmitPass `timed-tokens` + EmitPass `tree-json` + harness S0/S1 complet | **MVP livré, ~85% grammaires** | — |
| | | | | |
| M8 | 2 sem | Mode TEM (templates `$X/&X`) | ~95 grammaires | spec §Q1, à porter depuis BP3 |
| M9 | 2 sem | Streaming generator + hot-swap basique | Tests de live coding | — |
| M10 | 3 sem | Orchestrateur multi-scène application-level (en dehors de BPx) | Tests SCENES.md scénarios | — |

**Total MVP (M0-M7) : ~12 semaines.** Total parité complète (M0-M8) : ~14 semaines.

**Discipline de port** : à chaque milestone, **traduction littérale** des fonctions C BP3 ciblées vers TypeScript. Pas de réinvention d'algorithme. Les grammaires servent de harness de validation, pas de spec.

---

## 11. Liens

- [BPX_ENGINE_SPEC.md](BPX_ENGINE_SPEC.md) — contrat externe
- [SCENES.md](SCENES.md) — hiérarchie multi-scène, orchestrateur application-level
- [AST.md](../spec/AST.md) — format d'entrée
- [LANGUAGE.md](../spec/LANGUAGE.md) — sémantique langage
- [TEMPORAL_DEFORMATION.md](TEMPORAL_DEFORMATION.md) — futur ConstraintPass v2
- [ARCHITECTURE.md](ARCHITECTURE.md) — pipeline BPscript actuel (BP3)
