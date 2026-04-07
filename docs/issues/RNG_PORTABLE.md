# SPEC: RNG portable — aligner bp3 Linux/WASM sur le LCG MSVC de bp.exe

## Contexte
bp.exe Windows (moteur de référence de Bernard) utilise le `rand()`/`srand()` de MSVC.
bp3 Linux utilise celui de glibc. Les algorithmes sont différents → même seed, séquences différentes.

6 grammaires S0≠S1 à cause de ça : templates, destru, transposition3, kss2, asymmetric, koto3.

## Algorithmes actuels

| Plateforme | rand() | RAND_MAX | Algorithme |
|---|---|---|---|
| bp.exe (MSVC) | CRT Windows | **32767** | LCG : `seed = seed * 214013 + 2531011; return (seed >> 16) & 0x7fff` |
| bp3 Linux (glibc) | glibc | **2147483647** | TYPE_3 nonlinear additive feedback, degré 31 |
| bp3 WASM (emscripten) | custom dans `bp3_wasm_stubs.c` | 2147483647 | Copie de glibc TYPE_3 |

## Ce qu'il faut faire

### 1. Créer `csrc/bp3/bp3_random.c` + `.h` avec le LCG MSVC

```c
// bp3_random.h
#ifndef BP3_RANDOM_H
#define BP3_RANDOM_H

void bp3_srand(unsigned int seed);
int  bp3_rand(void);

#define BP3_RAND_MAX 32767

#endif

// bp3_random.c
#include "bp3_random.h"

static unsigned int bp3_rng_state = 1;

void bp3_srand(unsigned int seed) {
    bp3_rng_state = seed;
}

int bp3_rand(void) {
    bp3_rng_state = bp3_rng_state * 214013 + 2531011;
    return (bp3_rng_state >> 16) & 0x7fff;
}
```

### 2. Remplacer dans les fichiers existants

| Fichier | Appels à remplacer |
|---|---|
| `Misc.c` (ResetRandom, Randomize, ReseedOrShuffle) | 6× `srand()`, 2× `rand()` |
| `Zouleb.c` (PickOneRuleRandomly) | 2× `rand()`, 2× `RAND_MAX` |
| `Compute.c` (ComputeInGram) | 3× `rand()`, 4× `RAND_MAX` |
| `SetObjectFeatures.c` (RandomTime) | 1× `rand()`, 1× `RAND_MAX` |
| `MakeSound.c` | 1× `rand()`, 1× `RAND_MAX` |

Total : **9× `rand()` → `bp3_rand()`**, **6× `srand()` → `bp3_srand()`**, **8× `RAND_MAX` → `BP3_RAND_MAX`**

### 3. Mettre à jour `bp3_wasm_stubs.c`

Remplacer l'implémentation glibc TYPE_3 par un simple `#include "bp3_random.h"` + alias.
Ou mieux : ne plus overrider `rand()`/`srand()` dans WASM puisque `bp3_rand()` sera utilisé partout.

### 4. Makefiles

Ajouter `bp3_random.c` à `Makefile` (Linux natif) et `Makefile.emscripten` (WASM).

## Attention : RAND_MAX change

MSVC `RAND_MAX` = 32767, glibc `RAND_MAX` = 2147483647. Tous les calculs de probabilité utilisent `RAND_MAX` comme diviseur :
- `Compute.c:434` : `choice = (total + 1) * (randomnumber/((double)RAND_MAX))`
- `Zouleb.c:497-498` : division par `RAND_MAX + 1L`

En remplaçant par `BP3_RAND_MAX = 32767`, les calculs s'alignent automatiquement sur le comportement MSVC.

## Vérification

Après le fix :
```bash
# Les 6 grammaires RND doivent passer en exact match
node s0_snapshot.cjs templates && node s1_native.cjs templates && node compare_s0_s1.cjs templates
# Idem pour : destru, transposition3, kss2, asymmetric, koto3
```

## RÉSOLU — 2026-04-02

**Résultat :** Score S0=S1 : **26/30 EXACT** (était ~18/30 avant)
- destru, kss2, asymmetric : passés de DIFF → EXACT grâce au RNG MSVC
- templates, transposition3, koto3 : COUNT_DIFF restant = parsing texte S0/S1, pas RNG
- visser-waves : 1 timing diff (quelques ms)

**Implémentation :** `bp3_random.c`/`.h` ajoutés dans `source/BP3/` et `csrc/bp3/`. Tous les appels `rand()`/`srand()`/`RAND_MAX` remplacés par `bp3_rand()`/`bp3_srand()`/`BP3_RAND_MAX`. L'ancienne implémentation glibc TYPE_3 dans `bp3_wasm_stubs.c` a été supprimée.
