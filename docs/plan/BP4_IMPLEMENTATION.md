# Plan d'implementation BPx Engine

> BPx = moteur de derivation nouvelle generation, remplace BP3.
> Coeur du framework **Kanopi** (le DAW des live coders, by roomi-fields).
> Le langage reste **BPscript**.
>
> Fusionne la spec (docs/design/BPX_ENGINE_SPEC.md) et le plan d'implementation.
> La spec definit le QUOI, ce document definit le COMMENT.
>
> Voir aussi : [BPX_ENGINE_SPEC.md](../design/BPX_ENGINE_SPEC.md) pour la spec complete,
> [MARKET_STUDY.md](MARKET_STUDY.md) pour le positionnement strategique.

## Naming

| Niveau | Nom | Role |
|--------|-----|------|
| **Produit/Framework** | **Kanopi** | Le DAW des live coders — UI, runtimes, bridge, timeline |
| **Langage** | **BPscript** | Le meta-sequenceur — 3 mots, 24 symboles, descendant de BP3 |
| **Moteur** | **BPx** | Le deriveur de grammaires — remplace BP3, JS pur, multi-instance |

## Contexte

BP3 est un moteur C de derivation de grammaires formelles (Bernard Bel, 40 ans).
BPscript l'utilise via WASM mais les limitations (singleton, texte intermediaire,
batch, stack overflow polymetrie, BOLSIZE=30) bloquent la vision "DAW des live coders".

BPx le remplace en JS pur : instances isolees, AST direct, DerivationTree
structure, streaming, live coding.

### Pipeline actuel (BP3)

```
Source .bps → Tokenizer → Parser → AST(Scene) → Encoder → texte BP3 → WASM → tokens plats
```

### Pipeline BPx (Kanopi)

```
Source .bps → Tokenizer → Parser → AST(Scene) → BPx Engine (JS) → DerivationTree + TimedToken[]
```

L'encoder.js (AST→texte BP3) est elimine. Le parser existant (src/transpiler/parser.js)
reste inchange — BPx consomme directement l'AST Scene qu'il produit.

---

## Architecture fichiers

```
src/bpx/
├── index.js              # createBPx() facade, BPxInstance
├── grammar-loader.js     # AST Scene → structure interne (Subgrammar[], SymbolTable)
├── derivation.js         # boucle principale, dispatch vers les modes
├── modes/
│   ├── ord.js            # mode ORD (ordered)
│   ├── rnd.js            # mode RND (random, weighted)
│   ├── lin.js            # mode LIN (linear)
│   ├── sub.js            # modes SUB/SUB1 (substitution)
│   ├── tem.js            # mode TEM (templates $X/&X)
│   └── poslong.js        # mode POSLONG (longest match)
├── context.js            # matching de contexte gauche/droite/negatif
├── captures.js           # wildcards ?N, metavariables, bindings
├── token-stream.js       # liste doublement chainee (buffer de derivation)
├── polymetry.js          # resolution iterative, LCM, proportions
├── tree.js               # construction DerivationTree, extraction TimedToken[]
├── flag-store.js         # FlagStore observable avec scoping parent/enfant
├── trigger-bus.js        # TriggerBus async wait/emit
├── lcg.js                # PRNG deterministe (LCG MSVC)
├── guard.js              # evaluation des guards
├── errors.js             # types d'erreurs BPx (E001-E030)
├── stream-engine.js      # derivation en avance sur le playback
├── live.js               # addRule, modifyRule, hotSwap, protocole commandes
└── scene-orchestrator.js # multi-instance, flag scoping, trigger propagation

test/bpx/
├── test_lcg.js
├── test_flag_store.js
├── test_token_stream.js
├── test_grammar_loader.js
├── test_ord.js
├── test_rnd.js
├── test_context.js
├── test_captures.js
├── test_sub.js
├── test_lin.js
├── test_tem.js
├── test_polymetry.js
├── test_tree.js
├── test_streaming.js
├── test_triggers.js
├── test_live.js
├── test_multi_instance.js
├── test_e2e.js           # scenes .bps existantes via parser → BPx
└── test_determinism.js   # cross-check BP3 vs BPx
```

---

## Diagramme de dependances

```
                    ┌──────────────────────────────────┐
                    │  index.js (facade createBPx)     │
                    └──────────┬───────────────────────┘
                               │
          ┌────────────────────┼────────────────────────┐
          │                    │                         │
          ▼                    ▼                         ▼
  ┌──────────────┐   ┌─────────────────┐   ┌─────────────────────┐
  │ grammar-     │   │ derivation.js   │   │ stream-engine.js    │
  │ loader.js    │   │ (boucle         │   │ (lookahead, pull,   │
  │ (AST→struct) │   │  principale)    │   │  chunks)            │
  └──────┬───────┘   └───────┬─────────┘   └──────────┬──────────┘
         │                   │                         │
         │     ┌─────────────┼─────────────┐           │
         │     │             │             │           │
         │     ▼             ▼             ▼           │
         │  ┌────────┐ ┌─────────┐ ┌────────────┐     │
         │  │ modes/ │ │ guard.js│ │ polymetry  │     │
         │  │ ord    │ │         │ │ .js        │     │
         │  │ rnd    │ └────┬────┘ └─────┬──────┘     │
         │  │ lin    │      │            │            │
         │  │ sub    │      │            │            │
         │  │ tem    │      ▼            ▼            │
         │  │ poslong│ ┌─────────┐ ┌──────────┐      │
         │  └───┬────┘ │ flag-   │ │ tree.js  │      │
         │      │      │ store.js│ │ (build + │      │
         │      │      └────┬────┘ │  extract)│      │
         │      │           │      └──────────┘      │
         │      ▼           │                         │
         │  ┌────────┐      │      ┌──────────────┐   │
         │  │ token-  │     │      │ trigger-     │   │
         │  │ stream  │     │      │ bus.js       │◄──┘
         │  │ .js     │     │      └──────────────┘
         │  └─────────┘     │
         │                  │      ┌──────────────┐
         │                  │      │ lcg.js       │
         │                  │      └──────────────┘
         │                  │
         │                  │      ┌──────────────┐
         │                  │      │ errors.js    │
         │                  │      └──────────────┘
         │                  │
         │     ┌────────────┼──────────────┐
         │     ▼            ▼              ▼
         │  ┌──────────┐ ┌──────────┐ ┌──────────────┐
         │  │context.js│ │captures  │ │ live.js      │
         │  │(L/R/neg) │ │.js (?N)  │ │(addRule,     │
         │  └──────────┘ └──────────┘ │ hotSwap,     │
         │                            │ fork, cmds)  │
         │                            └──────┬───────┘
         │                                   │
         │                                   ▼
         │                            ┌──────────────┐
         └───────────────────────────►│ scene-       │
                                      │ orchestrator │
                                      │ .js          │
                                      └──────────────┘
```

---

## Etapes MVP (1-7)

### Etape 1 : LCG + FlagStore + Errors + Guards

**Fichiers** : `lcg.js`, `flag-store.js`, `errors.js`, `guard.js`
**Tests** : `test_lcg.js`, `test_flag_store.js`
**Zero dependance** — totalement testable en isolation.

**lcg.js** :
- Classe LCG : `constructor(seed)`, `next()`, `seed(s)`, `clone()`, `getState()`, `setState(s)`
- Algorithme MSVC : `state = (state * 214013 + 2531011) >>> 0`
- Retour : `(state >>> 16) & 0x7FFF` (RAND_MAX = 32767)
- Verification : meme sequence que `bp3-engine/csrc/bp3/bp3_random.c`

**flag-store.js** :
- Classe FlagStore : `get(name)`, `set(name, value)`, `increment(name, delta)`
- `subscribe(name, cb)`, `subscribeAll(cb)`, `snapshot()`, `setParent(store)`
- Heritage parent : `get()` remonte au parent si absent localement
- Observable : `set()` notifie les subscribers si la valeur change
- Default : `get()` retourne 0 si inconnu (convention BP3)

**errors.js** :
- Enum des codes E001-E030 (cf. BPX_ENGINE_SPEC.md section 14)
- Classe BP4Error { code, type, severity, message, context }

**guard.js** :
- `evaluateGuard(guard, flagStore)` : operateurs ==, !=, >, <, >=, <=, null (bare flag != 0)
- Mutations : + (increment), - (decrement, retourne false si < 0)
- `evaluateGuards(guards[], flagStore)` : AND de tous les guards

---

### Etape 2 : TokenStream

**Fichier** : `token-stream.js`
**Test** : `test_token_stream.js`

- `TokenNode { symbolId, symbolName, prev, next, treeNode, flags, qualifiers }`
- `TokenStream { head, tail, length }`
- `splice(startNode, endNode, replacementNodes[])` : O(1), retire start..end, insere replacements
- `toArray()` : parcours lineaire pour debug
- `fromSymbols(symbols[])` : factory, cree la chaine depuis une liste de noms
- `[Symbol.iterator]` pour `for..of`
- `findFirst(predicate)` : premier noeud qui matche

---

### Etape 3 : Grammar Loader

**Fichier** : `grammar-loader.js`
**Test** : `test_grammar_loader.js`

- `loadGrammar(sceneAST)` → `{ subgrammars, symbolTable, nonTerminals }`
- Parcourt `scene.subgrammars[]` et leurs `rules[]`
- Construit `symbolTable: Map<string, { id, type }>` (terminaux = id dense 0-based)
- Identifie `nonTerminals` : tout symbole apparaissant en LHS d'une regle
- Chaque regle interne : `{ guard[], lhs[], rhs[], weight, incWeight, ctrl, mode }`
- Valide : E001 si symbole reference non declare, E002 si grammaire vide
- **Ne touche PAS** aux actors/transports/backticks — BPx est un deriveur symbolique pur
- Fichier cle a lire : `src/transpiler/parser.js` (produit l'AST Scene)

---

### Etape 4 : Mode ORD (premiere derivation)

**Fichiers** : `modes/ord.js`, `derivation.js`
**Test** : `test_ord.js`

**derivation.js** :
- `derive(instance)` → orchestre : pour chaque subgrammar, appeler le mode correspondant
- Initialise le buffer avec le symbole de depart (premier LHS de gram#1)
- Gere `maxDerivationDepth` (E011) et `maxDerivationTime` (E010, via performance.now())
- Detecte derivation infinie (E013 : buffer >10x taille initiale sans terminaux)

**modes/ord.js** :
- `deriveORD(buffer, subgram, flagStore)`
- Scanner gauche→droite. Pour chaque non-terminal :
  1. Collecter les regles candidates (LHS matche le symbole courant)
  2. Evaluer les guards de chaque candidate (via evaluateGuards)
  3. Prendre la premiere regle applicable (par index dans la liste)
  4. `splice()` le non-terminal avec le RHS expanse
  5. Appliquer les flag mutations du RHS
- Repeter jusqu'au point fixe (aucun non-terminal restant, ou aucune regle applicable)
- Les non-terminaux sans regle survivent (warning E012, comme BP3)

---

### Etape 5 : Mode RND + poids

**Fichier** : `modes/rnd.js`
**Test** : `test_rnd.js`

- `deriveRND(buffer, subgram, flagStore, lcg)`
- Comme ORD mais selection par poids quand plusieurs regles matchent
- `selectRule(candidates, lcg, flagStore)` :
  - Filtrer les regles a poids infini (priorite absolue)
  - Construire la distribution cumulative des poids
  - Tirer avec LCG `% total`, binary search dans le cumulatif
- Types de poids :
  - Statique : `weight: 50`
  - Decremental : `weight: 50, inc: -12` → decrementer apres chaque application, clamp a 0
  - K-param : `weight: 0, ctrl: 'K1'` → lire la valeur du flag K1 comme poids
  - Infini : `weight: Infinity` → priorite absolue, toujours choisi

---

### Etape 6 : Polymetrie iterative

**Fichier** : `polymetry.js`
**Test** : `test_polymetry.js`

C'est le changement architectural critique qui elimine le stack overflow de BP3
(cf. docs/issues/POLYMAKE_STACK.md). NotReich (5 niveaux) = 5 iterations d'une boucle.

- `resolvePolymetry(tree)` : file de travail, pas de recursion
- Collecter les PolymetricNode en **post-order** (profondeur d'abord, internes avant externes)
- Pour chaque noeud :
  1. Compter les symboles par voix (`countSymbols` : terminaux + rests, pas les controles)
  2. Calculer LCM des comptes (avec detection overflow E020)
  3. Appliquer le speed ratio si present (`{N, ...}`)
  4. Calculer `proportions[]` par voix (normalise, somme = 1)
  5. Assigner `span.durationBeats` a chaque voix et chaque enfant
- `propagateAbsoluteTimes(root, startBeat, tempo)` : top-down, convertit beats → ms
- Utilitaires : `gcd(a, b)`, `lcm(a, b)`, `computeLCM(counts[])`

**Polymetrie imbriquee** — le post-order garantit que les blocs internes sont resolus
avant les externes. Un bloc interne resolu compte comme 1 symbole dans sa voix parente.

**Period notation** — `.` cree des fragments de duree egale dans une voix.
Chaque fragment compte comme 1 unite dans le calcul LCM.

---

### Etape 7 : DerivationTree + TimedToken[] + Facade

**Fichiers** : `tree.js`, `index.js`
**Tests** : `test_tree.js`, `test_e2e.js`, `test_determinism.js`

**tree.js** :
- Construction pendant la derivation : chaque `splice()` cree un SequenceNode avec ruleRef
- Les terminaux deviennent des LeafNode, les silences des RestNode
- Les PolymetricNode sont crees depuis les noeuds Polymetric de l'AST
- Les ControlNode capturent les flag mutations, triggers, _script(CTn)
- `extractTimedTokens(tree)` : parcours DFS, collecte feuilles + controles → TimedToken[]
- RuntimeQualifiers preserves sur les LeafNode (opaques pour BPx, le dispatcher les lit)

**index.js** (facade) :
- `createBPx(config?)` → BPxInstance
- `loadGrammar(ast)` → valide et charge
- `derive()` → `{ tree, tokens, metadata }` (metadata = duration, tempo, seed, derivationTimeMs)
- `getTree()`, `getTokens()`, `getFlagState()`, `getStatus()`, `destroy()`
- `setFlag(name, value)`, `setSeed(n)`, `setSettings(obj)`
- `fork(newSeed?)` → clone instance (copie grammar + flags, nouveau seed)

**--- MVP ATTEINT ICI ---**

A ce stade BPx peut remplacer BP3 pour les grammaires ORD et RND
sans contextes ni captures. C'est suffisant pour ~70% des scenes existantes.

---

## Etapes post-MVP (8-15)

### Etape 8 : Contextes + Captures

**Fichiers** : `context.js`, `captures.js`
**Tests** : `test_context.js`, `test_captures.js`
**Depend de** : MVP (etapes 1-7)

**context.js** — matching de contexte dans les regles :
- `matchLeftContext(rule, buffer, position)` : verifier que les symboles a gauche du LHS correspondent au contexte gauche de la regle
- `matchRightContext(rule, buffer, position)` : idem a droite
- `matchNegativeContext(rule, buffer, position)` : patterns qui ne doivent PAS etre presents (BPscript `#(X Y)`)
- Integrer dans la boucle de selection de regles : un candidat dont le contexte ne matche pas est rejete
- Ref BP3 : `Compute.c:1344-1398` (offsets gauche/droite)

**captures.js** — wildcards et metavariables :
- `matchLHSWithCaptures(rule, buffer, position)` → `{ bindings, endPos }` ou `null`
- Quand le LHS contient `?N` (Wildcard), le symbole a cette position est lie a `?N`
- Pendant l'expansion RHS, `?N` est remplace par la valeur liee
- `expandRHSWithBindings(rhs, bindings)` → nodes resolus
- Ref BP3 : metavariables dans `Compute.c`, instantiation arrays

**Impact sur les modes** : modifier `ord.js` et `rnd.js` pour appeler `matchLeftContext`/`matchRightContext` avant d'accepter un candidat, et `matchLHSWithCaptures` quand la regle a `ismeta=true`.

---

### Etape 9 : Modes SUB / SUB1

**Fichier** : `modes/sub.js`
**Test** : `test_sub.js`
**Depend de** : MVP

**SUB (Substitution multi-pass)** :
- Les symboles LHS sont aussi des terminaux (persistent dans la sortie)
- Scanner tout le buffer. Pour chaque position, si un LHS matche, appliquer la regle
- Repeter jusqu'au point fixe (aucune regle ne matche nulle part)
- Difference avec ORD : les LHS ne sont pas consommes, ils persistent

**SUB1 (Substitution single-pass)** :
- Comme SUB mais chaque regle est appliquee au plus une fois par occurrence
- Marquer les positions deja traitees pour eviter de re-appliquer

Ref BP3 : `Compute.c:333-338` et `411-449` pour la distinction ORD/SUB/SUB1.

---

### Etape 10 : Modes LIN, TEM, POSLONG

**Fichiers** : `modes/lin.js`, `modes/tem.js`, `modes/poslong.js`
**Tests** : `test_lin.js`, `test_tem.js`
**Depend de** : MVP + etape 8 (contextes/captures)

**LIN (Linear)** :
- Chaque regle est essayee a chaque position dans le buffer
- La premiere qui matche est appliquee
- Apres application, recommencer depuis le debut du buffer avec la meme regle
- Quand la regle ne matche plus nulle part, passer a la suivante
- Direction de scan configurable par regle (gauche, droite, aleatoire)
- Ref BP3 : `Compute.c` mode LINtype

**TEM (Template)** :
- Matching specialise avec $X/&X master/slave (TemplateMaster, TemplateSlave, TemplateEntry dans l'AST)
- Le master `$X` capture une sequence, le slave `&X` la reproduit
- Les TemplateEntry definissent des transformations (wildcards `?`, brackets avec `$N` indexing, scale /N *N)
- C'est le mode le plus complexe — reimplementer depuis la spec AST
- Ref BP3 : code specifique dans `Compute.c` pour templates
- Question ouverte Q1 dans la spec : reimplementer from scratch recommande

**POSLONG (Position Longest)** :
- Quand plusieurs regles matchent a la meme position, celle qui consomme le plus de symboles gagne
- Trier les candidats par longueur de LHS decroissante, prendre le premier
- Ref BP3 : POSLONGtype dans `Compute.c`

---

### Etape 11 : Streaming Engine

**Fichier** : `stream-engine.js`
**Test** : `test_streaming.js`
**Depend de** : MVP

- Classe StreamEngine : decouple la derivation du playback
- `start(lookaheadMs)` : commence a deriver en avance (defaut 2000ms)
- `advancePlayback(currentMs)` : le dispatcher informe la progression du playback
- `pull(count)` : obtenir les prochains tokens prets
- `subscribe(callback)` : notification push a chaque token produit
- `pause()`, `resume()`, `stop()`

**Derivation par chunks** :
- `_deriveNextChunk()` : applique un pas de derivation, retourne les tokens produits
- La derivation est **interruptible** — difference fondamentale avec le batch BP3
- Si le buffer de tokens devance le playback de plus de `lookaheadMs`, la derivation se met en pause

**Frontiere polymetrique** :
- Les tokens sequentiels sont emis immediatement
- Quand un bloc polymetrique est rencontre, bufferiser toutes les voix
- Resoudre le timing une fois le bloc complet, puis emettre
- La latence de streaming augmente avec la profondeur polymetrique
- Documenter : "streaming latency increases with polymetric depth"

---

### Etape 12 : Integration Triggers

**Fichier** : `trigger-bus.js` (existe deja depuis etape 1, enrichir)
**Test** : `test_triggers.js`
**Depend de** : etape 11 (streaming)

**Mode batch** (`derive()`) :
- Le `<!trigger` est enregistre comme ControlNode dans l'arbre
- Le dispatcher gere l'attente au moment du playback (comme aujourd'hui)

**Mode streaming** (`startStreaming()`) :
- Quand la derivation rencontre `<!trigger`, elle appelle `triggerBus.wait(name)`
- `wait()` retourne une Promise — la derivation se suspend
- Quand `emitTrigger(name)` est appele depuis JS (CC via @map, OSC, UI), la Promise se resout
- La derivation reprend a partir du point de suspension
- Timeout configurable : si le trigger n'arrive pas dans N secondes, warning E030

**Emission de triggers** (`!name` dans le RHS) :
- `triggerBus.emit(name)` pendant la derivation
- Propage aux listeners externes et aux instances soeurs

---

### Etape 13 : Operations Live Coding

**Fichier** : `live.js`
**Test** : `test_live.js`
**Depend de** : etape 11 (streaming)

**Operations atomiques sur la grammaire** :
- `addRule(subgramIdx, ruleAST)` : ajouter une regle, marquer la sous-grammaire dirty
- `modifyRule(subgramIdx, ruleIdx, ruleAST)` : remplacer une regle
- `removeRule(subgramIdx, ruleIdx)` : supprimer une regle
- `setMode(subgramIdx, mode)` : changer le mode de derivation
- `setWeight(subgramIdx, ruleIdx, weight)` : modifier un poids en place (pas de re-derivation)

**Re-derivation incrementale** :
- Dirty tracker : `Set<subgramIdx>` des sous-grammaires modifiees
- Quand une sous-grammaire N est dirty :
  1. Sauvegarder l'etat du buffer a l'entree de N (sortie de N-1)
  2. Re-deriver N a fin
  3. Re-resoudre la polymetrie pour les sous-arbres affectes
  4. Emettre les nouveaux tokens depuis le point de divergence
- Granularite par sous-grammaire (pas par regle)

**Hot swap** :
- `hotSwapGrammar(newAst, options)` : remplacement complet
- Preserve les flags (option), preserve le RNG state (option)
- Incremente `instance.generation` (invalidation de cache)
- Si en streaming, restart depuis la position courante

**Protocole de commandes** :
- `send({ op, ...params })` : interface uniforme pour toutes les operations
- Commandes independantes, applicables dans n'importe quel ordre
- Ouvre la porte a : collaboration live, undo/redo, historique, scripting externe

---

### Etape 14 : Orchestrateur Multi-Instances

**Fichier** : `scene-orchestrator.js`
**Test** : `test_multi_instance.js`
**Depend de** : etape 13 (live coding)

**SceneOrchestrator** :
- `addInstance(name, instance)` : enregistre une instance BPx dans l'orchestrateur
- `removeInstance(name)` : retire
- Cablage automatique : triggers instance ↔ bus global

**Flag scoping** (cf. SCENES.md) :
- Heritage top-down : `instance.flags.setParent(parentInstance.flags)`
- L'enfant lit les flags du parent si pas de valeur locale
- `@expose` : le parent observe les flags exposes via `subscribe()`
  - `child.flags.subscribe('intensity', v => parent.flags.set('verse.intensity', v))`
- Siblings isoles (pas de lecture directe entre freres)

**Trigger propagation** :
- Les triggers traversent la hierarchie dans les deux sens
- Parent → enfants : `parent.triggers.on(name, () => child.triggers.emit(name))`
- Enfant → parent : `child.triggers.on(name, () => parent.triggers.emit(`child.${name}`))`
- Global bus : `_globalTriggerBus` relaie tous les triggers avec namespace

**Scenes comme terminaux** :
- Quand le dispatcher rencontre un terminal qui est un nom de scene :
  1. L'orchestrateur lance `instance.derive()` ou `instance.startStreaming()`
  2. Les tokens produits sont schedules dans la timeline du parent
  3. Les flags herites fournissent le contexte initial

---

### Etape 15 : Fork / Merge

**Fichier** : `index.js` (methode fork sur BPxInstance)
**Test** : integre dans `test_live.js`
**Depend de** : etape 13

**Fork** :
- `instance.fork(newSeed?)` → nouvelle instance BPx
- Copie la grammaire (reference partagee, copy-on-write si modifiee)
- Deep copy du flag state
- Nouveau seed ou seed herite
- Derivation state independante

**Usage** :
```js
const branch = instance.fork(42);
branch.addRule(0, experimentalRule);
const result = branch.derive();  // tester sans casser le live
// Si ca sonne bien :
instance.hotSwapGrammar(branch.grammar);
branch.destroy();
```

**Merge** :
- Pas de merge automatique des resultats de derivation
- Le merge est une operation manuelle : l'utilisateur ecoute le fork, approuve, et hotSwap
- Le protocole de commandes (etape 13) permet de rejouer les operations d'un fork sur l'instance principale

---

### Etape 16 : DerivationTree observable + controles unifies

**Fichiers** : `tree.js` (notifications), `index.js` (setProperty API)
**Test** : `test_tree_observable.js`
**Depend de** : etape 7 (tree) + etape 13 (live coding)

Le DerivationTree devient observable — chaque modification de propriete
notifie les listeners. Toutes les sources de controle (CC, OSC, drag souris,
flags) passent par le meme chemin : `tree.setProperty(path, value)`.

**tree.js** :
- `setProperty(path, value)` : modifie une propriete par chemin (ex: 'groove.ratio')
- `onPropertyChange(path, callback)` : observe les changements
- Les projections (timeline, pianoroll) s'abonnent et se re-rendent

**Modulation et types de controle** :
- **cv** (continu) → parametres son (vel, filter, pan) : effet immediat
- **trigger** (discret) → structurel (proportions, poids) : effet au tic de cycle
- L'affichage reflete en continu, le playback sample au tic

**Impact** : le drag souris sur la timeline emet un controle via MapEngine
au lieu de modifier les pixels directement. Ajouter une vue ou une source
de controle coute zero cablage.

---

## Integration pipeline existant

Le parser et le tokenizer restent inchanges. La facade `compileBPS()` dans
`src/transpiler/index.js` est etendue :

```js
import { createBPx } from '../bpx/index.js';

function compileBPS(source, { engine = 'bp3' } = {}) {
  // ... tokenize, parse, resolveActors (inchange)
  if (engine === 'bp4') {
    const bp4 = createBPx({ seed: settings.seed });
    bp4.loadGrammar(ast);
    const result = bp4.derive();
    return {
      ...result,
      ast,
      controlTable: result.controlTable ?? [],
      cvTable: result.cvTable ?? [],
      mapTable: result.mapTable ?? [],
      sceneTable: result.sceneTable ?? {},
      exposeTable: result.exposeTable ?? [],
      errors: []
    };
  }
  // ... encode BP3 (chemin par defaut, inchange)
}
```

Le dispatcher consomme les TimedToken[] de BPx exactement comme ceux de BP3 —
le format est compatible par design. Le DerivationTree est un bonus que le
dispatcher peut utiliser pour la timeline et le constraint solver.

---

## Verification

| Quoi | Comment | Quand |
|------|---------|-------|
| Tests unitaires | `node --test test/bpx/test_*.js` | Apres chaque etape |
| Determinisme LCG | Meme seed → meme sequence, cross-check avec sortie C | Etape 1 |
| Comparaison BP3 | Pour chaque .bps, comparer terminaux BPx vs BP3 | Etape 7+ |
| Regression polymetrie | NotReich (5 niveaux) produit un resultat | Etape 6 |
| Streaming latence | Mesurer la latence de streaming pour differentes profondeurs polymetriques | Etape 11 |
| Multi-instance isolation | Deux instances avec seeds differents → resultats differents | Etape 14 |
| Hot swap integrite | Flags preserves, RNG coherent apres swap | Etape 13 |
| Suite complete | `node --test test/bpx/` | Continu |

**Note sur la comparaison BP3** : les timings peuvent differer entre BPx (polymetrie iterative)
et BP3 (polymetrie recursive) pour les grammaires avec polymetrie. L'ordre des terminaux
doit etre identique pour les grammaires ORD et RND sans polymetrie.

---

## Relation avec les autres documents

- [BPX_ENGINE_SPEC.md](../design/BPX_ENGINE_SPEC.md) — la spec complete (le QUOI)
- [AST.md](../spec/AST.md) — nodes d'entree que BPx consomme directement
- [LANGUAGE.md](../spec/LANGUAGE.md) — features du langage que BPx supporte
- [SCENES.md](../design/SCENES.md) — hierarchie de scenes (etape 14)
- [TEMPORAL_DEFORMATION.md](../design/TEMPORAL_DEFORMATION.md) — constraint solver (consomme DerivationTree)
- [UI_WEB.md](UI_WEB.md) — features UI qui beneficient de BPx
- [MARKET_STUDY.md](MARKET_STUDY.md) — positionnement strategique
