# WASM Issue — PolyMake stack overflow sur polymetries imbriquees

Date: 2026-03-24 (maj 2026-04-07)
Statut: non resolu — workaround en place (texte sans timings)

## Symptome

Les grammaires avec polymetries imbriquees sur 4-5+ niveaux crashent en WASM
avec "Maximum call stack size exceeded". Le texte est produit correctement,
le crash est dans PlayBuffer1 pendant l'expansion polymetrique (PolyMake).

Grammaire de reference : `-gr.NotReich` (Thierry Montaudon, 1997).

## Comportement compare

| | Natif (3.3.16) | WASM |
|---|---|---|
| Texte produit | 1491 chars | 1491 chars (identique) |
| Timing (TimeSet) | 580 sound-objects, 0.6s | crash stack overflow |
| Avec 16MB V8 stack | N/A | pas de crash mais >120s (timeout) |

Le texte est identique — la production grammaticale fonctionne. Seule l'extraction
des timings (PlayBuffer1 → PolyMake → TimeSet) echoue.

## Structure de NotReich

```
gram#2[4] A --> {1, C4 -,  - E#3 G3, A#5, - D5}       ← 4 streams
gram#2[5] B --> {A A,  C2}                               ← contient 2×A
gram#2[6] B" --> {B, - F5}                               ← contient B
gram#2[7] C --> {B, { - C5}}                             ← contient B
gram#2[8] D --> {B, - {C4 F5 E#4}}                      ← contient B
gram#2[9] E --> {D, D#4 F4 C5 G#3}                      ← contient D
```

E se deploie en : `{{{{1, C4 -,...}{1, C4 -,...}, C2}, -{C4 F5 E#4}}, notes}`
→ 5 niveaux d'imbrication polymetrique.

Apres production (gram#1 + gram#2), le buffer contient ~50 expressions polymetriques
imbriquees. PolyMake doit les expander recursivement.

## Cause racine

**PolyMake est recursif** (dans `Polymetric.c`, code de Bernard). Chaque `{}`
imbrique genere un appel recursif. Pour NotReich :
- 50 expressions × 5 niveaux × sous-appels internes = centaines d'appels recursifs

**La stack V8 (pas la stack WASM) deborde.** Le flag `STACK_SIZE=33554432` dans
le Makefile controle la stack lineaire Emscripten (pour les variables locales C).
Mais V8 maintient sa propre call stack pour les return addresses WASM, limitee a
~984 KB par defaut.

Augmenter `--stack-size` de Node.js :
- **1MB (defaut)** : crash apres ~1.6s
- **4MB** : crash apres ~1.6s (meme point)
- **16MB** : pas de crash mais >120s vs 0.6s natif (200x plus lent)

Le 200x slowdown avec assez de stack suggere que le probleme n'est pas juste
la profondeur de recursion mais aussi le cout par frame WASM dans V8
(trampoline overhead, pas de tail-call optimization).

## Pourquoi le natif est 200x plus rapide

Hypotheses :
1. **Cout d'appel** : en C natif, un appel recursif coute ~10 cycles (push/pop
   registres). En WASM V8, chaque appel implique la gestion du shadow stack V8
   + le stack lineaire Emscripten — possiblement 10-100x plus cher par frame.
2. **Cache** : la recursion profonde en WASM traverse plus de memoire
   (stack lineaire en heap) que le C natif (stack OS en memoire contigue).
3. **Optimisations compilateur** : gcc peut faire du tail-call elimination ou
   inliner des fonctions recursives. Emscripten/LLVM en mode WASM est plus
   conservateur.

## Impact

Grammaires affectees identifiees :
- **NotReich** : 5 niveaux, 50 expressions → crash
- Potentiellement toute grammaire avec polymeries profondes (>4 niveaux)

Les grammaires avec 2-3 niveaux de polymetrie fonctionnent (testees : drum,
ek-do-tin, destru, livecode2).

## Solutions envisagees (non implementees)

### A. Reecrire PolyMake en iteratif
- Eliminerait le probleme de stack
- Necessite de modifier `Polymetric.c` (code de Bernard)
- Complexe : PolyMake gere des arbres d'expressions imbriquees

### B. Emscripten ASYNCIFY
- Permet d'interrompre et reprendre l'execution WASM
- Resout le probleme de stack (unwinding/rewinding)
- Cout : ~50% overhead sur TOUT le code, pas juste PolyMake
- Augmente la taille du WASM de ~30%

### C. WASM tail calls (proposal)
- V8 supporte `--experimental-wasm-tail-call` depuis v111
- Necessite que LLVM emette des tail calls pour PolyMake
- PolyMake n'est probablement pas tail-recursive (appels au milieu de la fonction)

### D. Worker thread avec stack dediee
- Executer produce() dans un Web Worker avec une stack plus grande
- Fonctionne dans le navigateur et Node.js
- Complexite d'integration (async, transfert de resultats)

### E. Detection et degradation gracieuse (solution actuelle)
- Le texte est toujours produit correctement
- Le crash est dans PlayBuffer1 (timing extraction)
- Le JS peut rattraper l'erreur et retourner le texte sans timings
- Deja en place dans le test runner (try/catch autour de produce())

## Etat actuel

La solution E est en place : les grammaires complexes produisent le texte
correct mais sans timed tokens. Pour NotReich, le texte (1491 chars) est
accessible via `bp3_get_result()` apres le crash.

Si un jour on veut les timings pour ces grammaires, la solution A (PolyMake
iteratif) est la plus propre mais necessite l'accord de Bernard et un travail
significatif sur `Polymetric.c`.
