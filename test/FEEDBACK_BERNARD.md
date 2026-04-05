# Feedback pour Bernard — Moteur BP3

Points ouverts identifiés pendant les tests systématiques des 37 grammaires actives.
Les points résolus (#1-#31, #34, #37) sont tracés dans `bp3-engine/CHANGELOG_ENGINE.md`.

Dernière mise à jour : 2026-04-05
Build : v3.3.18-wasm.20

---

## 32. FillPhaseDiagram — bifurcation triolets NotReich (GCC vs clang)

**Grammaire :** `-gr.NotReich` (Thierry Montaudon, 1997), seed=1, `_mm(60) _striated`

**Symptôme :** 580 notes identiques entre GCC et clang pour les tokens 0–564 (0s→82s). À partir du token 565, divergence brutale : les timestamps GCC dérivent de -7ms à -109ms par rapport à clang.

Les valeurs clang sont des multiples exacts de 333ms (triolets à 60 bpm). Les valeurs GCC dérivent :
```
clang :  F3 82333   G3 82666   C4 84000   F3 84333   G3 84666
GCC :    F3 82340   G3 82707   C4 84075   F3 84408   G3 84775
```

**Analyse :** Ce n'est PAS un arrondi cumulatif (sinon ça dériverait dès le début). C'est une **bifurcation** — un test conditionnel (`tempo > tempomax`, `toofast`, ou similaire) qui bascule différemment à t=82s entre GCC et clang à cause d'une valeur flottante à la limite.

Testé : `round(prodtempo)` → aucun effet. `-mfpmath=sse` → aucun effet (GCC x86_64 utilise déjà SSE).

**Compilateurs :** gcc 13.3.0 (Ubuntu), mingw-gcc 13 (Windows cross), emcc/clang (WASM). Tous avec `-O2 -fno-common`.

**Confirmé :** S0 (bp.exe mingw) = S1 (bp3 gcc). S2 (WASM clang) a les valeurs "justes".

**Quantization :** 50ms dans les settings. Question de Bernard : le problème apparaît-il sans quantisation ? Non testé.

**Impact :** 15 notes sur 580, timing uniquement, fin de pièce.

---

## 33. MakeSound — NoteOff retardé par le scheduling séquentiel (Visser5, Visser-Waves)

**Grammaires :** `-gr.Visser5` (16 notes affectées / 1112), `-gr.Visser-Waves` (2 / 365), seed=1

**Symptôme :** Le MIDI natif produit des durées plus longues que `p_Instance.endtime - starttime` pour certaines notes dans des structures polymétriques. L'excès varie de +20ms à +146ms. La note est systématiquement prolongée jusqu'au `endtime` de la note suivante (i+1) dans la séquence.

Exemple concret (Visser5, i=12) :
```
i=12  D6   p_Instance: [10688 - 10969]  dur=281ms
i=13  Bb6  p_Instance: [10969 - 11104]  dur=135ms

WASM :  D6 NoteOff à 10969ms  (= p_Instance.endtime, exact)
Natif : D6 NoteOff à 11104ms  (= endtime de Bb6, +135ms)
```

**Analyse :** Le scheduling séquentiel de MakeSound (boucle while t1 <= t2, traitement par deadline) sort AVANT d'émettre le NoteOff quand une autre instance doit être initialisée. Le NoteOff est émis au prochain passage, à un temps qui correspond au `endtime` de l'instance suivante.

**Lien Bernard :** https://bolprocessor.org/control-noteon-noteoff/ — le mécanisme de superposition NoteOn/NoteOff décrit pourrait être en cause.

**Impact :** 18 notes sur ~1500 (1.2%), durées S1 > S2 de 20 à 146ms.

---

## 35. TimeSet — starttime +10ms sur certaines grammaires avec settings Visser

**Grammaires :** acceleration (-se.Visser2), visser3 (-se.Visser3), visser-shapes (-se.Visser.Shapes), seed=1

**Symptôme :** `p_Instance[2].starttime = 10` au lieu de 0 pour la première note. Tous les événements décalés de +10ms constant. Les grammaires sans settings n'ont pas ce décalage.

Le natif corrige via `FormatMIDIstream(zerostart=TRUE)`. Le WASM lit `p_Instance` directement.

**Impact :** 3 grammaires sur 36, +10ms constant (inaudible).

---

## 36. Production TEXT sans séparateurs quand un alphabet est chargé

**Grammaire :** `-gr.checkNegativeContext`, production mode TEXT

**Symptôme :** Avec un alphabet chargé (silent sound objects), `getResult()` retourne les terminaux concaténés sans espaces (`AAAA2A3A1` au lieu de `A A A A2 A3 A1`).

**Impact :** 1 grammaire TEXT sur 36.

---

## 38. Filtrage terminaux vs non-terminaux dans p_Instance — silent sound objects

**Contexte :** Pipeline BPscript → BP3 WASM, extraction des timed tokens.

**Besoin :** Distinguer dans `p_Instance[k].object` un terminal de l'alphabet (qui produit du son) d'un non-terminal résiduel (variable non résolue).

**Problème :** Après la conversion T4→T3 dans `MakeEmptyTokensSilent()`, les deux sont indistinguables. Le proxy `p_Type[j] & 1` ne marche pas pour les silent sound objects (pas de prototype MIDI → bit=0 pour tous).

**Réponse de Bernard :** Proposé de créer un token **T47** qui remplacerait les T4 au lieu de les convertir en T3. Le T47 serait traité comme un T3 dans tout le pipeline mais garderait la distinction.

**Status :** En attente d'implémentation par Bernard. Si le T47 est visible dans le buffer au moment de FillPhaseDiagram, c'est suffisant pour marquer l'objet côté WASM.

**Impact :** Bloquant pour S5 (timed tokens en mode silent sound objects).

---

## 39. Mémoire non initialisée — non-déterminisme ASLR sur bp3 Linux (kss2)

**Build :** v3.3.18-wasm.20

**Symptôme :** bp3 Linux produit des résultats non-déterministes sur kss2 (~25% d'échec), malgré seed fixe. Désactiver ASLR (`setarch x86_64 -R`) rend le binaire 100% déterministe.

**Systèmes non affectés :** WASM (mémoire linéaire fixe), bp.exe Windows.

**Piste :** Variable non initialisée dans Compute.c, CompileGrammar.c, ou GiveSpace. Analyse Valgrind/ASan recommandée.

**Workaround :** `setarch x86_64 -R` dans s1_native.cjs.

---

## 40. Patches à intégrer dans v3.3.19 (3 fixes manquants)

**Vérification :** `upstream/graphics-for-BP3` commit cf9d788 (2026-04-04) comparé avec nos sources locales.

### 40a. RNG portable `bp3_random.c` / `bp3_random.h`

Remplacer `rand()`/`srand()`/`RAND_MAX` par `bp3_rand()`/`bp3_srand()`/`BP3_RAND_MAX` — LCG MSVC (`seed * 214013 + 2531011`, `RAND_MAX = 32767`).

**Nouveaux fichiers :**

`bp3_random.h` :
```c
#ifndef BP3_RANDOM_H
#define BP3_RANDOM_H
void bp3_srand(unsigned int seed);
int  bp3_rand(void);
#define BP3_RAND_MAX 32767
#endif
```

`bp3_random.c` :
```c
#include "bp3_random.h"
static unsigned int bp3_rng_state = 1;
void bp3_srand(unsigned int seed) { bp3_rng_state = seed; }
int bp3_rand(void) {
    bp3_rng_state = bp3_rng_state * 214013 + 2531011;
    return (bp3_rng_state >> 16) & 0x7fff;
}
```

**Inclure** `#include "bp3_random.h"` dans `-BP3.h`.

**Remplacements :** Misc.c (6×srand, 2×rand), Compute.c (3×rand, 4×RAND_MAX), Zouleb.c (2×rand, 2×RAND_MAX), SetObjectFeatures.c (1×rand, 1×RAND_MAX), MakeSound.c (1×rand, 1×RAND_MAX), ScriptUtils.c (1×srand).

**Impact :** S0=S1 passe de ~18/30 à 33/36 EXACT.

### 40b. FIELDSIZE 100 → 1000

Dans `-BP3.h` : `#define FIELDSIZE 1000` (était 100). Empêche les crashs sur les terminaux longs.

### 40c. Guard `NoTracePath` — désactiver les graphiques

**Fix 1 — `ConsoleMain.c`** (ABSENT de cf9d788), après `PrepareTraceDestination()` :
```c
if(NoTracePath) {
    ShowObjectGraph = ShowPianoRoll = ShowGraphic = FALSE;
}
```

**Fix 2 — `SaveLoads1.c`** (commenté dans cf9d788), décommenter ligne ~704 :
```c
if(NoTracePath) {
    ShowObjectGraph = ShowPianoRoll = ShowGraphic = FALSE;
    BPPrintMessage(0,odInfo,"No graphic due to the absence of a trace path\n");
}
```

**Grammaires corrigées :** vina (segfault), vina2 (segfault), Watch_What_Happens (timeout infini).

---

## Notes pour référence

- Build v3.3.18-wasm.20 (2026-04-05) — sources = Bernard v3.3.19 (cf9d788) + nos 3 fixes (#40a, #40b, #40c)
- Non-reg wasm.20 vs wasm.18 : S0→S4 = 0 régression
- 36 grammaires actives (bells skip — fichiers -ho.cloches1 manquants)
- Points ouverts : #32, #33, #35, #36, #38, #39, #40
