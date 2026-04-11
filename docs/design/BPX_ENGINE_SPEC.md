# BPx Engine Specification

> **BPx** = moteur de derivation reactif, coeur du framework **Kanopi** (by roomi-fields).
> Le langage reste **BPscript**. BPx remplace BP3 (C, singleton, batch) par une
> architecture multi-instance, streaming, avec AST direct et arbre de derivation structure.
>
> Voir aussi : [ARCHITECTURE.md](ARCHITECTURE.md) pour le pipeline actuel,
> [SCENES.md](SCENES.md) pour la hierarchie de scenes,
> [AST.md](../spec/AST.md) pour les nodes d'entree.

## Pourquoi BP4

BP3 est un moteur de derivation de grammaires formelles ecrit en C par Bernard Bel
(40 ans de travail, CNRS). BPscript l'utilise via WASM. Les limitations de BP3
bloquent la vision "DAW des live coders" :

| Limitation BP3                          | Impact                           | Resolution BP4                    |
| --------------------------------------- | -------------------------------- | --------------------------------- |
| Singleton (~80 globales C)              | Pas de multi-scene               | Instance isolee, zero globale     |
| Texte intermediaire (AST→texte→reparse) | Perte d'information, lenteur     | AST direct en entree              |
| Batch (produce tout d'un coup)          | Pas de streaming, pas de live    | Derivation incrementale/streaming |
| Sortie plate (tokens plats)             | Structure perdue apres PolyMake  | DerivationTree en sortie          |
| BOLSIZE=30                              | Terminaux longs crashent         | Pas de limite sur les noms        |
| Stack overflow polymetrie 5+            | Grammaires complexes impossibles | Resolution iterative              |
| RNG non-portable                        | 6 grammaires non-deterministes   | LCG portable (MSVC)               |
| Settings via fichiers                   | Heap corruption WASM             | Parametres d'API                  |

---

## 1. Modele d'instance

Un moteur BP4 est une instance isolee. Aucun etat global. Plusieurs instances
coexistent sans interference.

```js
{
  // Identite
  id: string,
  generation: number,             // incremente a chaque changement de grammaire

  // Grammaire
  grammar: {
    subgrammars: Subgrammar[],    // liste ordonnee de sous-grammaires
    symbolTable: Map<string, SymbolInfo>,  // terminal → { id, type }
    nonTerminals: Set<string>,    // variables (symboles LHS)
  },

  // Etat de derivation
  derivation: {
    buffer: TokenStream,          // buffer de travail (liste chainee)
    tree: DerivationTree | null,  // arbre de structure construit pendant la derivation
    currentSubgrammar: number,    // index courant dans subgrammars
    iteration: number,            // nombre de passes completees
    status: 'idle' | 'deriving' | 'streaming' | 'paused' | 'done' | 'error',
  },

  // Flags
  flags: FlagStore,               // store observable cle-valeur

  // Triggers
  triggers: TriggerBus,           // bus d'evenements async

  // RNG
  rng: LCGState,                  // PRNG deterministe

  // Settings
  settings: {
    timeResolution: number,       // ms (defaut: 10)
    quantize: number,             // ms (defaut: 0, pas de quantification)
    natureOfTime: 'striated' | 'smooth',
    maxDerivationTime: number,    // secondes, 0 = illimite
    maxDerivationDepth: number,   // profondeur max (defaut: 1000)
    tempo: number,                // BPM (defaut: 60)
  },

  // Streaming
  stream: {
    cursor: number,               // index du dernier token emis
    lookahead: number,            // avance en ms (defaut: 2000)
    buffer: TimedToken[],         // tokens prets a consommer
    subscribers: Set<StreamCallback>,
  },
}
```

Pas de BOLSIZE — les noms de symboles sont des strings arbitraires.
Internement, les symboles sont references par id entier (dense, 0-based).

---

## 2. Cycle de vie

```
create(config?) → instance
  |
  +-- loadGrammar(ast)          <-- AST du parser BPscript (pas de texte)
  +-- setFlags(initial)         <-- etat initial des flags (optionnel)
  +-- setSeed(n)                <-- graine deterministe (optionnel)
  +-- setSettings(obj)          <-- settings (optionnel)
  |
  +-- derive()                  <-- derivation complete → DerivationTree + TimedTokens
  |   OU
  +-- startStreaming(lookahead) <-- incrementale : derive en avance sur le playback
  |   +-- pull(n)               <-- obtenir les n prochains tokens
  |   +-- pause()
  |   +-- resume()
  |   +-- stop()
  |
  +-- --- mutations live (a tout moment) ---
  |   +-- addRule(subgramIdx, rule)
  |   +-- modifyRule(subgramIdx, ruleIdx, newRule)
  |   +-- removeRule(subgramIdx, ruleIdx)
  |   +-- setFlag(name, value)
  |   +-- setWeight(subgramIdx, ruleIdx, weight)
  |   +-- setMode(subgramIdx, mode)
  |   +-- emitTrigger(name, payload?)
  |   +-- hotSwapGrammar(newAst)
  |
  +-- getTree()                 <-- retourne le DerivationTree
  +-- getTokens()               <-- retourne les TimedToken[] plats
  +-- getFlagState()            <-- retourne l'etat des flags
  |
  +-- destroy()                 <-- libere les ressources
```

### Interface publique

```js
function createBP4(config?: BP4Config): BP4Instance

interface BP4Config {
  seed?: number;
  settings?: Partial<BP4Settings>;
  flags?: Record<string, number>;
  onToken?: (token: TimedToken) => void;
  onTrigger?: (name: string, payload?: any) => void;
  onFlagChange?: (name: string, oldVal: number, newVal: number) => void;
  onError?: (error: BP4Error) => void;
}

interface BP4Instance {
  // Chargement
  loadGrammar(ast: SceneAST): void;

  // Derivation complete
  derive(): DerivationResult;

  // Streaming
  startStreaming(lookaheadMs?: number): void;
  pull(count?: number): TimedToken[];
  pause(): void;
  resume(): void;
  stop(): void;

  // Live coding
  addRule(subgramIdx: number, rule: RuleAST): void;
  modifyRule(subgramIdx: number, ruleIdx: number, rule: RuleAST): void;
  removeRule(subgramIdx: number, ruleIdx: number): void;
  setFlag(name: string, value: number): void;
  setWeight(subgramIdx: number, ruleIdx: number, weight: number): void;
  setMode(subgramIdx: number, mode: DerivationMode): void;
  emitTrigger(name: string, payload?: any): void;
  hotSwapGrammar(ast: SceneAST, options?: SwapOptions): void;

  // Fork
  fork(newSeed?: number): BP4Instance;

  // Requete
  getTree(): DerivationTree;
  getTokens(): TimedToken[];
  getFlagState(): Record<string, number>;
  getStatus(): InstanceStatus;

  // Lifecycle
  destroy(): void;
  readonly id: string;
  readonly generation: number;
}
```

---

## 3. Format d'entree : AST direct

BP4 consomme l'AST du parser BPscript directement (defini dans `docs/spec/AST.md`).
Plus de serialisation en texte BP3. L'encoder.js est elimine pour BP4.

### Ce que BP4 recoit

Uniquement la portion grammaire de l'AST Scene :

```js
interface BP4GrammarInput {
  subgrammars: SubgrammarAST[];   // Scene.subgrammars
  terminals: string[];             // tous les terminaux declares
}
```

Chaque `SubgrammarAST` contient ses `rules[]` et son `mode`.
Chaque `RuleAST` contient `guard`, `lhs`, `rhs`, `flags`, `qualifiers`.

### Ce que BP4 ne recoit PAS

BP4 est un deriveur symbolique pur. Il ne connait pas :
- Acteurs, alphabets, tunings, transports (→ dispatcher)
- Runtime qualifiers `()` (preserves comme annotations opaques)
- CV instances (→ dispatcher)
- Backticks (→ dispatcher)
- Maps, scenes (→ orchestrateur)

Les runtime qualifiers `()` sont preserves sur les noeuds du DerivationTree
pour que le dispatcher les lise apres derivation.

---

## 4. Format de sortie : DerivationTree + TimedTokens

### 4a. DerivationTree (hierarchique)

```js
interface DerivationTree {
  root: TreeNode;
  metadata: {
    totalDurationBeats: number;
    tempo: number;
    generation: number;
    seed: number;
    derivationTimeMs: number;
  };
}

type TreeNode = SequenceNode | PolymetricNode | LeafNode | ControlNode | RestNode;

interface SequenceNode {
  type: 'sequence';
  id: number;
  children: TreeNode[];
  span: Span;
  ruleRef: RuleRef | null;       // quelle regle a produit ce noeud
}

interface PolymetricNode {
  type: 'polymetric';
  id: number;
  voices: VoiceNode[];
  span: Span;
  speed: number | null;          // ratio de vitesse ({N, ...})
  constraint: 'equal-span';      // toutes les voix partagent la meme duree
}

interface VoiceNode {
  type: 'voice';
  id: number;
  children: TreeNode[];
  proportions: number[];         // duree relative de chaque enfant (normalise, somme = 1)
  symbolCount: number;           // nombre de symboles occupant du temps
  span: Span;
}

interface LeafNode {
  type: 'leaf';
  id: number;
  symbol: string;                // nom du terminal (pas de limite de taille)
  span: Span;
  runtimeQualifiers: any | null; // opaque, passe au dispatcher
  engineQualifiers: any | null;  // operateurs tempo resolus dans span
  simultaneous: string[] | null; // objets hors-temps declenches (operateur !)
  tieState: 'start' | 'continue' | 'end' | null;
}

interface ControlNode {
  type: 'control';
  id: number;
  kind: 'flag' | 'trigger_in' | 'trigger_out' | 'out_time' | 'script';
  name: string;
  payload: any;
  span: Span;                    // start === end (zero duree)
}

interface RestNode {
  type: 'rest';
  id: number;
  span: Span;
}

interface Span {
  startBeat: number;             // float64 — precision machine, pas d'arrondi
  endBeat: number;               // float64
  durationBeats: number;         // float64
  startMs: number;               // float64 (PAS d'entier — rupture avec BP3)
  endMs: number;                 // float64
  durationMs: number;            // float64
  tempoMultiplier: number;       // multiplicateur de tempo cumulatif
}
```

**Precision temporelle float64** : BPx produit tous les timestamps en virgule
flottante double precision (float64 natif JavaScript). C'est une rupture explicite
avec BP3 qui utilise des `long` entiers (millisecondes entieres = echantillonnage 1kHz).

Consequences :
- Zero erreur d'arrondi sur les calculs de proportions polymetriques
- Le scaling `@duration` s'applique sur les beats flottants avant conversion — pas de jitter
- Le dispatcher schedule directement en float vers `AudioContext.currentTime` (double precision)
- Les ratios irrationnels (tempo × proportion × speed) ne perdent pas de precision
- La resolution temporelle theorique est ~5 microsecondes (float64 a 10s)
  au lieu de 1ms (entier BP3) — 200x plus precis

BP3 (comparaison) :
```c
// BP3 : entiers, precision 1ms, arrondi a chaque calcul
Milliseconds **p_T;   // long (entier)
// LCM et proportions arrondis → drift cumulatif possible
```

BPx :
```js
// BPx : flottants, precision machine, pas d'arrondi intermediaire
span.startMs = span.startBeat * (60000 / tempo);  // float64 × float64
// Le seul arrondi est au moment du scheduling audio (AudioContext resolution ~5μs)
```

interface RuleRef {
  subgrammarIndex: number;
  ruleIndex: number;
  lhsSymbol: string;
}
```

### 4b. TimedToken[] (plat, pour le playback)

Extrait de l'arbre par parcours en profondeur (feuilles + controles) :

```js
interface TimedToken {
  token: string;
  start: number;                 // millisecondes, float64 (pas d'entier)
  end: number;                   // float64
  duration: number;              // float64
  nodeId: number;                // reference vers le noeud de l'arbre
  type: 'terminal' | 'rest' | 'control' | 'out_time';
  actor: string | null;
  runtimeQualifiers: any | null;
  simultaneous: string[] | null;
}
```

La liste plate est une **vue** de l'arbre, pas un calcul separe.
Le constraint solver peut modifier l'arbre et re-extraire les tokens
sans re-deriver.

---

## 5. Algorithme de derivation

### Vue d'ensemble

La derivation procede sous-grammaire par sous-grammaire. Dans chaque
sous-grammaire, le moteur scanne le buffer pour les regles applicables,
en selectionne une (selon le mode et les poids), l'applique, et repete
jusqu'au point fixe (tous les symboles sont terminaux).

### Buffer de derivation

Liste doublement chainee (pas un tableau). Insertion/suppression O(1)
pendant l'application des regles.

```js
class TokenStream {
  head: TokenNode | null;
  tail: TokenNode | null;
  length: number;
  splice(startNode, endNode, replacement): void;  // O(1)
}

class TokenNode {
  symbolId: number;
  symbolName: string;
  prev: TokenNode | null;
  next: TokenNode | null;
  treeNode: TreeNode | null;     // back-reference vers l'arbre
  flags: FlagMutation[] | null;
  qualifiers: any | null;
}
```

### Derivation pas a pas

```
pour chaque sous-grammaire (index 0..N-1) :
  selon le mode :
    ORD → deriveORD(buffer, subgram)
    RND → deriveRND(buffer, subgram)
    LIN → deriveLIN(buffer, subgram)
    SUB → deriveSUB(buffer, subgram, multiPass=true)
    SUB1 → deriveSUB(buffer, subgram, multiPass=false)
    TEM → deriveTEM(buffer, subgram)
    POSLONG → derivePOSLONG(buffer, subgram)

resoudre la polymetrie (iteratif)
propager les temps absolus (top-down)
```

### Modes

**ORD (Ordered)** : scanner le buffer gauche-a-droite. Pour chaque
non-terminal, prendre la premiere regle applicable (par ordre dans la liste).
Appliquer. Continuer jusqu'au point fixe.

**RND (Random)** : comme ORD, mais quand plusieurs regles matchent un
non-terminal, selection aleatoire par poids. Accumuler les poids,
tirer avec le LCG, choisir.

**LIN (Linear)** : chaque regle est essayee a chaque position. La premiere
qui matche est appliquee. Apres application, recommencer depuis le debut
avec la meme regle. Quand elle ne matche plus nulle part, passer a la suivante.

**SUB/SUB1 (Substitution)** : les LHS sont aussi des terminaux (persistent
dans la sortie). SUB applique toutes les regles jusqu'au point fixe.
SUB1 applique chaque regle au plus une fois par occurrence.

**TEM (Template)** : matching specialise avec $X/&X master/slave.

**POSLONG** : matcher le LHS le plus long possible. Quand plusieurs regles
matchent a la meme position, celle qui consomme le plus de symboles gagne.

### Selection de regle avec poids

```js
function selectRule(candidates, instance) {
  // Filtrer les regles a poids infini (priorite absolue)
  const infRules = candidates.filter(r => r.weight === Infinity);
  if (infRules.length > 0) candidates = infRules;

  // Construire la distribution cumulative
  let total = 0;
  const cumulative = [];
  for (const rule of candidates) {
    const w = getCurrentWeight(rule, instance);
    total += w;
    cumulative.push(total);
  }
  if (total === 0) return null;

  // Tirer un nombre aleatoire
  const r = instance.rng.next() % total;
  for (let i = 0; i < cumulative.length; i++) {
    if (r < cumulative[i]) return candidates[i];
  }
  return candidates[candidates.length - 1];
}
```

### Types de poids

| BPscript         | Interne                                | Comportement                            |
| ---------------- | -------------------------------------- | --------------------------------------- |
| `[weight:50]`    | `{ weight: 50, inc: 0, ctrl: null }`   | Poids statique 50                       |
| `[weight:50-12]` | `{ weight: 50, inc: -12, ctrl: null }` | Commence a 50, -12 a chaque application |
| `[weight:K1]`    | `{ weight: 0, inc: 0, ctrl: 'K1' }`    | Poids = valeur du flag K1               |
| `[weight:inf]`   | `{ weight: Infinity }`                 | Priorite absolue                        |

### Evaluation des guards

```js
function evaluateGuard(guard, flags) {
  const val = flags.get(guard.flag) ?? 0;

  if (guard.mutates) {
    const newVal = guard.operator === '+' ? val + guard.value : val - guard.value;
    if (newVal < 0) return false;  // decrementation sous zero = echec
    flags.set(guard.flag, newVal);
    return true;
  }

  switch (guard.operator) {
    case '==': return val === guard.value;
    case '!=': return val !== guard.value;
    case '>':  return val > guard.value;
    case '<':  return val < guard.value;
    case '>=': return val >= guard.value;
    case '<=': return val <= guard.value;
    case null: return val !== 0;
  }
}
```

### Matching de contexte

Les contextes gauche et droit sont matches contre le buffer autour de la
position candidate. Les contextes negatifs (`#(X Y)`) inversent le test :
le match echoue si le pattern est present.

### Captures et wildcards (?N)

Quand le LHS contient des wildcards `?N`, chaque `?N` se lie au terminal
a cette position. Dans le RHS, `?N` est remplace par la valeur liee.

---

## 6. Polymetrie

### Resolution iterative (pas recursive)

C'est le changement architectural critique qui elimine le stack overflow.
BP3 utilise `PolyMake` recursif. BP4 utilise une file de travail iterative.

```js
function resolvePolymetry(tree) {
  // Collecter tous les PolymetricNode en post-order (profondeur d'abord)
  const queue = collectPolymetricNodes(tree);

  for (const polyNode of queue) {
    // Compter les symboles par voix
    for (const voice of polyNode.voices) {
      voice.symbolCount = countSymbols(voice);
      voice.proportions = voice.children.map(child =>
        isTimeless(child) ? 0 : 1 / voice.symbolCount
      );
    }

    // Calcul LCM pour synchronisation des voix
    const counts = polyNode.voices.map(v => v.symbolCount);
    const lcm = computeLCM(counts);

    // Appliquer le ratio de vitesse
    const speedRatio = polyNode.speed ?? 1;
    polyNode.span.durationBeats = lcm / speedRatio;

    // Chaque voix occupe toute la duree du bloc
    for (const voice of polyNode.voices) {
      voice.span.durationBeats = polyNode.span.durationBeats;
      const beatPerSymbol = voice.span.durationBeats / voice.symbolCount;
      assignBeatsToChildren(voice, beatPerSymbol);
    }
  }

  // Propager les temps absolus (top-down depuis la racine)
  propagateAbsoluteTimes(tree.root, 0, tree.metadata.tempo);
}
```

### Polymetrie imbriquee

Le post-order garantit que les blocs internes sont resolus avant les externes.
Un bloc interne resolu compte comme 1 symbole dans sa voix parente.

```
{ A B, { C D E, F G } }

Interne : { C D E, F G }
  voix1: 3 symboles, voix2: 2 → LCM = 6
  Ce bloc = 1 symbole dans la voix2 externe

Externe : { A B, <blocInterne> }
  voix1: 2 symboles, voix2: 1 → LCM = 2
```

Pas de limite de profondeur — 50 niveaux imbriques = 50 iterations
d'une boucle, pas 50 frames de stack.

### Period notation

La notation point (`.`) cree des fragments de duree egale dans une voix.
Chaque fragment compte comme 1 unite dans le calcul LCM.

### @duration — enveloppe temporelle explicite

BPx supporte `@duration Nb` (en beats) ou `@duration Ns` (en secondes) pour
declarer la duree totale d'une scene independamment de son contenu.

```
@mm:120
@duration 16b
S -> Sa Re Ga Pa     // 4 tokens dans 16 beats = 4 beats chacun
```

Sans `@duration` : comportement implicite classique (duree = nombre de tokens × tempo).
Avec `@duration` : scaling uniforme **apres** resolution polymetrique.

Le scaling preserve toutes les proportions internes (speed, polymetrie, periods) :
```
1. BPx derive normalement → duree naturelle = N beats
2. ratio = duration_declaree / duree_naturelle
3. pour chaque Span : startBeat *= ratio, endBeat *= ratio, durationBeats *= ratio
4. recalcul ms depuis les beats scales
```

Le calcul se fait en float64 sur les beats — pas de quantification, pas de jitter.

**Pourquoi c'est necessaire** : sans @duration, changer la duree d'une scene
oblige a modifier le tempo (@mm, ce qui decale la clock externe) ou a ajouter
des prolongations (_ _ _) ou des [speed:] dans le code. @duration separe
les trois preoccupations :
- **Densite** = le contenu (combien de tokens, quelles proportions)
- **Duree** = @duration (combien de beats cette scene occupe)
- **Vitesse** = @mm (la clock, partagee avec le monde exterieur)

C'est l'equivalent de `Pfindur` en SuperCollider ou du "clip length" dans Ableton.

### Regle de scoping de @duration

`@duration` ne s'applique qu'au **conteneur racine** — le niveau le plus haut.
A l'interieur, tout est relatif.

```
@duration:16s (seul @duration qui compte)
  |
  S -> {verse, chorus}          // proportions relatives : 50/50 = 8s chacun
        |        |
        |        chorus → ses tokens se repartissent dans ses 8s
        |
        verse → ses tokens se repartissent dans ses 8s
          |
          S -> {melody[speed:2], drums}   // proportions relatives dans verse
```

**Quand une scene est jouee seule** (mode dev/test, ou performance autonome),
son `@duration` et son `@mm` sont effectifs :
```
// melody.bps — jouee seule : dure 8 beats a 120 BPM = 4 secondes
@mm:120
@duration:8b
S -> Sa Re Ga Ma Pa Dha Ni Sa
```

**Quand la meme scene est imbiquee dans un parent** via `@scene`,
son `@duration` et son `@mm` sont ignores. Le parent decide de l'enveloppe
via les proportions de sa propre grammaire. Les proportions internes de
l'enfant (8 tokens egaux, speed, polymetrie) sont preservees — seule
l'echelle change.

C'est le modele **clip** universel :
- Ableton : un clip a sa duree propre, dans l'arrangement le parent decide
- SuperCollider : `Pfindur(8, pattern)` est effectif seul, ignore quand imbrique
- VCV Rack : un sequenceur a sa longueur, le clock divider impose le rythme

Chaque objet a sa duree intrinseque qui n'est effective que quand il est
autonome. Des qu'il est contenu, le conteneur impose. Le `@duration` d'un
enfant est une **propriete par defaut**, pas une contrainte.

### Pipeline temporel BP3 (reference)

Pour reference, voici le pipeline temporel de BP3 que BPx remplace.
Les etapes sont documentees ici pour assurer la parite comportementale.

```
Token buffer (pp_buff)
    |
    v
PolyMake() --> Prod, Ratio, Kpress, Maxevent, maxseq
    |           Prod = LCM des ratios speed/scaling
    |           Kpress = taux de compression (quantization)
    v
FillPhaseDiagram() --> p_Seq[nseq][iseq] (grille 2D sparse)
    |                  nseq = voix (lignes), iseq = positions temporelles (colonnes)
    |                  Chaque terminal place a Class(p_im[nseq]) = floor(x) / Kpress
    v
SetTimeObjects():
    T[col] = period × (position - 1) / Ratio    (grille symbolique → ms entiers)
    |
    +- Calculate_alpha() : alpha = (T[next] - T[i]) / Tref    (ratio dilatation)
    +- Fix()             : time1/time2 = timings tentatives
    +- Locate()          : ts1/ts2 = constraint solver iteratif
              |            (ajuste continuite, chevauchement, gaps)
              v
         p_Instance[k].starttime / endtime    (ms entiers finaux)
```

Structures cles BP3 :

| Structure | Role |
|-----------|------|
| p_Seq[nseq][iseq] | Grille 2D : index instance a (voix, position) |
| p_Instance[k] | Parametres par instance : starttime, endtime, alpha, vel, chan, object |
| T[col] | Temps absolu ms par colonne de la grille |
| time1/time2 | Timings tentatives (Fix) |
| ts1/ts2 | Timings finaux apres constraint solving (Locate) |
| Prod/Ratio | Resolution symbolique (LCM des ratios) |
| Kpress | Taux de compression (quantization → echantillonnage) |

Parametres de quantization BP3 :
- Quantization (ms, defaut 10) : espacement minimum de la grille → controle Kpress
- SamplingRate (defaut 50) : pas d'interpolation des CC MIDI continus
- MinPeriod (defaut 200ms) : plancher pour le positionnement des sound objects

**Ce que BPx change** :
- Pas de grille 2D (p_Seq) — le DerivationTree porte la structure directement
- Pas de Kpress — pas de compression/echantillonnage, les proportions sont en float64
- Le constraint solver (alpha → Fix → Locate) est remplace par le constraint solver
  JavaScript du dispatcher (cf. TEMPORAL_DEFORMATION.md), qui travaille sur le
  DerivationTree et non sur une grille aplatie
- Les timestamps sont en float64, pas en long entiers

---

## 7. Flags : store observable

### FlagStore

```js
class FlagStore {
  _values: Map<string, number>;
  _subscribers: Map<string, Set<callback>>;
  _parent: FlagStore | null;      // pour le scoping multi-instance

  get(name): number {
    const local = this._values.get(name);
    if (local !== undefined) return local;
    return this._parent?.get(name) ?? 0;  // heritage parent
  }

  set(name, value): void {
    const old = this.get(name);
    this._values.set(name, value);
    if (old !== value) this._notify(name, old, value);
  }

  increment(name, delta): void {
    this.set(name, this.get(name) + delta);
  }

  subscribe(name, callback): unsubscribe;
  subscribeAll(callback): unsubscribe;
  setParent(parentStore): void;
  snapshot(): Record<string, number>;
}
```

### Bidirectionnel JS ↔ engine

Depuis JS (hors du moteur) :
```js
instance.setFlag('phase', 2);
instance.flags.subscribe('mood', (newVal) => { ... });
```

Depuis la derivation (regles de grammaire) :
- Guards lisent : `[phase==1]` → `flags.get('phase')`
- Mutations ecrivent : `[phase=2]` → `flags.set('phase', 2)`
- Les changements notifient les subscribers JS

### Scoping multi-instance

```
Parent [mood=dark]
  |
  +-- enfant A : flagStore._parent = parent.flagStore
  |   flagStore.get('mood') → lit le parent → 'dark'
  |   flagStore.set('intensity', 5) → local seulement
  |
  +-- enfant B : isole de A, herite du parent
```

`@expose` rend un flag enfant lisible par le parent.
Le parent observe les flags exposes via subscribe.

---

## 8. Triggers : bus async

### TriggerBus

```js
class TriggerBus {
  _waiters: Map<string, Set<resolve>>;   // derivation en attente
  _listeners: Map<string, Set<callback>>; // listeners externes

  emit(name, payload?): void {
    // Reveiller les derivations en attente
    // Notifier les listeners externes
  }

  wait(name): Promise<payload> {
    // Utilise en mode streaming quand <!trigger est rencontre
  }

  on(name, callback): unsubscribe;
}
```

### Integration avec la derivation

**Mode batch** (`derive()`) : le `<!trigger` est enregistre comme ControlNode
dans l'arbre. Le dispatcher gere l'attente au playback.

**Mode streaming** (`startStreaming()`) : la derivation se suspend au
`<!trigger`. Elle appelle `triggerBus.wait(name)` qui retourne une Promise.
Quand `emitTrigger(name)` est appele depuis JS, la Promise se resout et
la derivation reprend.

### Propagation inter-instances

Les triggers traversent la hierarchie de scenes (cf. SCENES.md).
Un orchestrateur multi-instance relaie les triggers entre instances.

---

## 9. Re-derivation incrementale

### Quoi change, quoi se passe

| Changement     | Action                          | Portee                                          |
| -------------- | ------------------------------- | ----------------------------------------------- |
| addRule        | Marquer la sous-grammaire dirty | Re-deriver depuis cette sous-grammaire          |
| modifyRule     | Marquer la sous-grammaire dirty | Re-deriver depuis cette sous-grammaire          |
| removeRule     | Marquer la sous-grammaire dirty | Re-deriver depuis cette sous-grammaire          |
| setFlag        | Mettre a jour FlagStore         | En streaming : les guards a venir re-evaluent   |
| setWeight      | Mettre a jour le poids en place | Prochaine selection utilise le nouveau poids    |
| setMode        | Mettre a jour le mode           | Prochaine passe de derivation                   |
| hotSwapGrammar | Remplacement complet            | Re-deriver from scratch, preserving flags + RNG |

### Strategie

L'arbre est organise par sous-grammaire d'origine. Quand la sous-grammaire N
est dirty :
1. Sauvegarder l'etat du buffer a l'entree de la sous-grammaire N
2. Re-deriver les sous-grammaires N a fin
3. Re-resoudre la polymetrie
4. Emettre les nouveaux tokens depuis le point de divergence

Granularite par sous-grammaire (pas par regle). Suffisant pour le live coding
typique. Optimisation par regle en v2 si necessaire.

### Hot swap

```js
function hotSwapGrammar(instance, newAst, options) {
  const savedFlags = options.preserveFlags ? instance.flags.snapshot() : {};
  instance.generation++;
  instance.loadGrammar(newAst);
  if (options.preserveFlags) restoreFlags(instance, savedFlags);
  if (instance.derivation.status === 'streaming') {
    instance.stop();
    instance.startStreaming(instance.stream.lookahead);
  }
}
```

---

## 10. Streaming

### Architecture

Le moteur derive en avance sur le curseur de playback. Le dispatcher
consomme les tokens au fur et a mesure.

```js
class StreamEngine {
  _lookaheadMs: number;          // avance (defaut: 2000ms)
  _playbackCursorMs: number;     // ou en est le playback
  _derivationCursorMs: number;   // jusqu'ou on a derive
  _buffer: TimedToken[];         // tokens prets

  start(lookaheadMs): void;

  advancePlayback(currentMs): void {
    this._playbackCursorMs = currentMs;
    if (this._derivationCursorMs - currentMs < this._lookaheadMs) {
      this._deriveAhead();
    }
  }

  pull(count): TimedToken[];
}
```

### Derivation par chunks

`_deriveNextChunk()` applique un pas de derivation et retourne les tokens
produits. La derivation est interruptible — c'est la difference fondamentale
avec le mode batch de BP3.

### Frontiere polymetrique

En streaming, les tokens ne peuvent etre emis qu'une fois leur timing resolu.
Pour un bloc polymetrique, il faut attendre que toutes les voix soient derivees.

Strategie : streamer librement dans les sections sequentielles. Quand un bloc
polymetrique est rencontre, bufferiser toutes les voix, resoudre le timing,
puis emettre. La latence de streaming augmente avec la profondeur polymetrique.

---

## 11. Multi-instance

### Isolation

Chaque `createBP4()` produit une instance completement independante.
Pas d'etat partage.

```js
const melody = createBP4({ seed: 42 });
const rhythm = createBP4({ seed: 99 });

melody.loadGrammar(melodyAst);
rhythm.loadGrammar(rhythmAst);

// Deriver independamment
const r1 = melody.derive();
const r2 = rhythm.derive();
```

### Orchestrateur multi-instances

```js
class SceneOrchestrator {
  _instances: Map<string, BP4Instance>;
  _globalTriggerBus: TriggerBus;

  addInstance(name, instance): void {
    // Cablage triggers instance ↔ bus global
    // Cablage flags @expose
  }
}
```

---

## 12. Live coding

### Operations atomiques

```js
// Ajouter une regle
instance.addRule(0, {
  type: 'Rule',
  guard: { flag: 'phase', operator: '==', value: 2 },
  lhs: [{ type: 'Symbol', name: 'S' }],
  rhs: [{ type: 'Symbol', name: 'Ga' }, { type: 'Symbol', name: 'Pa' }],
  qualifiers: [{ pairs: [{ key: 'weight', value: 80 }] }],
});

// Modifier une regle
instance.modifyRule(0, 2, newRuleAst);

// Supprimer une regle
instance.removeRule(0, 1);

// Changer le mode
instance.setMode(0, 'rnd');

// Changer un poids (pas de re-derivation)
instance.setWeight(0, 3, 120);
```

### Fork

Fork cree un snapshot de l'instance pour experimenter sans casser le live :

```js
const branch = instance.fork(newSeed);
branch.addRule(0, experimentalRule);
const result = branch.derive();
// Si ca sonne bien :
instance.hotSwapGrammar(branch.grammar);
branch.destroy();
```

### Protocole de commandes

Les operations sont des commandes atomiques, independantes, applicables
dans n'importe quel ordre :

```js
engine.send({ op: 'addRule', subgram: 0, rule: {...} });
engine.send({ op: 'setFlag', name: 'phase', value: 3 });
engine.send({ op: 'setMode', subgram: 0, mode: 'rnd' });
engine.send({ op: 'setWeight', subgram: 0, rule: 5, weight: 80 });
```

Cela ouvre la porte a :
- **Collaboration live** : deux performers envoient des commandes au meme moteur
- **Undo/redo** : chaque commande est reversible
- **Historique** : replay d'une performance comme sequence de commandes
- **Scripting** : un programme externe envoie des commandes (meta-meta-sequenceur)

---

## 13. Determinisme

### LCG portable

Meme implementation que BP3 (MSVC LCG, deja porte dans bp3_random.c) :

```js
class LCG {
  _state: number;  // unsigned 32-bit

  constructor(seed = 1) {
    this._state = seed >>> 0;
  }

  next(): number {
    this._state = (Math.imul(this._state, 214013) + 2531011) >>> 0;
    return (this._state >>> 16) & 0x7FFF;  // RAND_MAX = 32767
  }

  seed(s): void { this._state = s >>> 0; }
  clone(): LCG;
}
```

### Contrat de determinisme

Meme AST + memes flags initiaux + meme seed + memes settings
= sortie identique bit a bit, quel que soit la plateforme.

Testable via l'infrastructure S0/S1 existante.

---

## 14. Gestion d'erreurs

### Types d'erreurs

| Code | Type                | Gravite | Comportement                                       |
| ---- | ------------------- | ------- | -------------------------------------------------- |
| E001 | UNDEFINED_SYMBOL    | Fatal   | Refuse le chargement                               |
| E002 | EMPTY_GRAMMAR       | Fatal   | Refuse le chargement                               |
| E010 | DERIVATION_TIMEOUT  | Warning | Arrete la derivation, retourne les tokens produits |
| E011 | DERIVATION_DEPTH    | Warning | Arrete, retourne les tokens                        |
| E012 | NO_APPLICABLE_RULE  | Warning | Preserve le non-terminal en sortie (comme BP3)     |
| E013 | INFINITE_DERIVATION | Warning | Buffer >10x taille initiale sans terminaux         |
| E020 | LCM_OVERFLOW        | Warning | Tronque la polymetrie                              |
| E030 | TRIGGER_TIMEOUT     | Warning | Continue sans trigger                              |

### Degradation gracieuse

Quand une erreur survient en streaming :
- Les tokens deja produits restent valides et jouables
- L'erreur est emise via le callback `onError`
- Le status passe a `'error'`
- `hotSwapGrammar` permet de corriger et relancer

Quand un non-terminal survit a la derivation (pas de regle applicable) :
- Il est preserve dans la sortie comme un token
- Le noeud est marque `unresolvedNonTerminal: true`
- Warning E012 emis

---

## 15. Questions ouvertes

### Q1 : Mode TEM (Template matching)

Le mode TEM dans BP3 utilise un systeme de templates specialise
($X/&X, wildcards, brackets avec $N). L'algorithme est complexe.

**Recommandation** : reimplementer dans BP4 depuis la spec AST
(TemplateMaster, TemplateSlave, TemplateEntry). C'est une feature core
du langage, ne pas creer de dependance permanente a BP3.

### Q2 : Latence streaming pour polymetrie complexe

Pendant le streaming, les tokens d'un bloc polymetrique ne peuvent etre
emis qu'une fois toutes les voix derivees. Pour des polymetries profondes,
la latence peut augmenter.

**Recommandation** : documenter la frontiere polymetrique comme contrainte
connue. Mesurer en pratique — les blocs polymetriques produisent typiquement
un nombre borne de tokens.

### Q3 : Homomorphismes — derivation ou post-derivation ?

Les variables `|x|` se lient pendant le matching LHS et se substituent
pendant l'expansion RHS — c'est du grammar-time. Les labels de
transcription (N%terminal) sont du renommage post-derivation.

**Recommandation** : `|x|` pendant la derivation, transcription en
post-processing sur le DerivationTree.

### Q4 : Compatibilite settings BP3

BP3 a des dizaines de settings (NoteConvention, Quantization, etc.).
BP4 n'en a besoin que d'un sous-ensemble.

**Recommandation** : fournir un adaptateur `BP4.fromBP3Settings(settings)`
comme utilitaire separe, pas dans le core.

### Q5 : Granularite de la re-derivation

Le design actuel re-derive depuis la premiere sous-grammaire dirty.
Pour des grammaires avec beaucoup de sous-grammaires, c'est potentiellement
couteux.

**Recommandation** : commencer par la granularite sous-grammaire. Mesurer.
Le tracking par symbole ajoute de la complexite et de la memoire. A optimiser
seulement si mesure necessaire.

### Q6 : Implementation JS vs Rust

Le design cible JavaScript d'abord (iteration rapide, pas de build WASM).
Si la performance ne suffit pas (grammaires enormes), porter en Rust→WASM.

**Recommandation** : commencer en JS. L'interface publique (BP4Instance,
DerivationTree, TimedToken) est le contrat stable. Les structures internes
(TokenStream, TokenNode) sont des details d'implementation.

---

## 16. Priorite d'implementation

| Etape   | Composant                           | Valide par                                        |
| ------- | ----------------------------------- | ------------------------------------------------- |
| 1       | LCG + FlagStore                     | Tests unitaires isoles                            |
| 2       | Chargement grammaire depuis AST     | Parse les scenes existantes                       |
| 3       | Mode ORD (derivation ordonnee)      | Premiere derivation fonctionnelle                 |
| 4       | Mode RND + poids                    | Selection aleatoire, poids statiques/decrementaux |
| 5       | Resolution polymetrique (iterative) | LCM, proportions, imbrication                     |
| 6       | Construction du DerivationTree      | Arbre pendant la derivation                       |
| 7       | Extraction TimedToken[]             | Aplatir l'arbre pour le playback                  |
| **MVP** | **Etapes 1-7**                      | **Remplace BP3 pour les grammaires simples**      |
| 8       | Contextes + captures (?N, #)        | Pattern matching complet                          |
| 9       | Modes SUB/SUB1                      | Substitution                                      |
| 10      | Modes LIN, TEM, POSLONG             | Parite complete avec BP3                          |
| 11      | Streaming engine                    | Derivation incrementale                           |
| 12      | Integration triggers                | Async wait/emit                                   |
| 13      | Operations live coding              | addRule, modifyRule, hotSwap                      |
| 14      | Orchestrateur multi-instances       | Flag scoping, trigger propagation                 |
| 15      | Fork/merge                          | Experimentation live                              |

Les etapes 1-7 produisent un moteur minimal viable. Les etapes 8-10
atteignent la parite avec BP3. Les etapes 11-15 delivrent la vision
live coding.

---

## 17. DerivationTree observable — principe architectural

### Le DerivationTree est la source de verite unique

Tout dans Kanopi converge vers le DerivationTree :
- Le moteur BPx le **produit** (derivation)
- La timeline le **projette** (rendu visuel)
- Le code texte le **projette** (serialisation)
- Les CC/OSC le **modifient** (via MapEngine)
- Le drag souris le **modifie** (via le meme chemin que les CC)
- Le constraint solver le **modifie** (proportions, durees)
- Le playback le **lit** (extraction TimedToken[])

### Tout input est un controle

Le drag de la souris sur la timeline n'est pas un cas special — c'est un
controleur comme un CC MIDI ou un message OSC. Il emet un controle qui
modifie une propriete de l'arbre, et l'arbre notifie ses observers.

```
CC potard        --> MapEngine --> tree.setProperty('groove.ratio', 0.7)
OSC message      --> MapEngine --> tree.setProperty('groove.ratio', 0.7)
Souris drag      --> MapEngine --> tree.setProperty('groove.ratio', 0.7)
Flag [tension]   --> MapEngine --> tree.setProperty('groove.ratio', 0.7)
```

### Toute vue est une projection

La timeline, le pianoroll, une notation graphique, un scope — chacune est
une fonction `render(tree) -> pixels`. Ajouter une vue = ajouter une
fonction de rendu. Pas de cablage UI specifique.

### Le meta-sequenceur se represente lui-meme

Le systeme est suffisamment general pour que l'UI soit une consequence
de l'architecture, pas un ajout. Le meta-sequenceur orchestre des
structures temporelles — y compris sa propre representation graphique.

### Implementation

**Phase 1 (BP3, maintenant)** : l'arbre est reconstruit depuis les tokens plats.
La timeline est cablee manuellement. Les CC/drag fonctionnent mais par des
chemins separes. Le retour visuel en temps reel est assure par le code UI.

**Phase 2 (BPx)** : l'arbre est la sortie native du moteur. Il est construit
observable des le depart (notifications par propriete). Toutes les sources de
controle (CC, OSC, drag, flags) passent par le MapEngine vers les proprietes
de l'arbre. Toutes les vues sont des projections de l'arbre. Ajouter une vue
ou une source de controle coute zero cablage.

### Modulation et types de controle

Les trois types temporels BPscript (gate, trigger, cv) determinent la nature
du controle sur l'arbre :

| Type | Signal | Cibles arbre | Evaluation |
|------|--------|-------------|------------|
| **gate** | Duree | Notes, sons, scenes | Au scheduling |
| **trigger** | Discret | Proportions, poids, mode, flags | Au tic de cycle |
| **cv** | Continu | Volume, pitch, filter, pan | Audio rate |

Un CC mappe vers une **proportion structurelle** est lu comme un trigger :
la valeur au moment du tic de cycle. C'est un sample & hold implicite.
L'affichage de la timeline reflete la valeur courante en temps reel (continu),
mais le playback ne la lit qu'au tic (discret).

```
CC potard (continu)
    |
    +--> affichage timeline : continu (la barre bouge en temps reel)
    |
    +--> playback : sample & hold au tic de cycle (discret)
```

Le structurel est discret pour le son, continu pour l'affichage.

---

## Relation avec les autres documents

- [AST.md](../spec/AST.md) — Nodes d'entree que BP4 consomme directement
- [LANGUAGE.md](../spec/LANGUAGE.md) — Features du langage que BP4 doit supporter
- [ARCHITECTURE.md](ARCHITECTURE.md) — Pipeline actuel (BP3) et futur (BP4)
- [SCENES.md](SCENES.md) — Hierarchie de scenes, scoping, triggers
- [TEMPORAL_DEFORMATION.md](TEMPORAL_DEFORMATION.md) — Constraint solver (consomme le DerivationTree)
- [SOUNDS.md](SOUNDS.md) — Controls par sous-groupes (dispatcher consomme les RuntimeQualifiers)
- [../plan/UI_WEB.md](../plan/UI_WEB.md) — Features UI bloquees par BP3 que BP4 debloque
