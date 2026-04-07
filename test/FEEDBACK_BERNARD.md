# Feedback pour Bernard — Moteur BP3

Points ouverts identifiés pendant les tests systématiques des 36 grammaires actives.
Les points résolus (#1-#31, #34, #37) sont tracés dans `bp3-engine/CHANGELOG_ENGINE.md`.

Dernière mise à jour : 2026-04-06
Build : v3.3.19-wasm.8

---

## 32. WriteMIDIbyte — drift cumulatif timestamps MIDI par ControlChange interpolés (NotReich)

**Grammaire :** `-gr.NotReich` (Thierry Montaudon, 1997), seed=1, `_mm(60) _striated`

**Symptôme :** 580 notes. Tokens 0-564 (0s-82s) identiques entre natif et WASM. Token 565+ : timestamps natif (GCC et mingw) dérivent de +7ms a +109ms par rapport au WASM.

```
WASM :   F3 82333   G3 82666   C4 84000   F3 84333   G3 84666
Natif :  F3 82340   G3 82707   C4 84075   F3 84408   G3 84775
```

**Root cause (GDB) :** Le calcul temporel est correct (TimeSet, FillPhaseDiagram, Calculate_alpha, Fix -- tous verifies, valeurs propres). Le probleme est dans la serialisation du flux MIDI dans `WriteMIDIbyte()` (MIDIfiles.c).

La rampe `_volume(80)` vers `_volume(0)` dans C' genere des ControlChange (byte 176) interpoles par pas de 20ms. Ces CC **depassent** le timestamp du NoteOn suivant :

```
CC volume  time=83020  delta=20   (OK)
CC volume  time=83040  delta=20   (OK -- mais depasse le prochain NoteOn)
NoteOn F3  time=83033  --> temps RECULE de 7ms
```

`WriteMIDIbyte()` ligne 344 corrige le recul :
```c
if(time < OldMIDIfileTime) OldMIDIfileTime = time;
```
Le NoteOn est ecrit avec delta=0 (place au tick du dernier CC = 83040 au lieu de 83033). Puis `OldMIDIfileTime` recule a 83033. Le delta perdu (7ms) s'accumule a chaque cycle de la polyrythmie (+34ms par beat).

**Deux corrections possibles :**

**Fix A -- Empecher le drift cumulatif (1 ligne, MIDIfiles.c:344) :**
```c
// Avant :
if(time < OldMIDIfileTime) OldMIDIfileTime = time;
// Apres :
if(time < OldMIDIfileTime) time = OldMIDIfileTime;
```
Le NoteOn est place au tick du dernier CC (erreur max ~20ms ponctuelle, non cumulative). Le timeline continue sans drift.

**Fix B -- Borner les CC interpoles (MakeSound.c, root cause) :**
Dans la boucle d'interpolation volume/panoramic de `MakeSound()`, borner le timestamp de chaque CC pour ne pas depasser le `t1` du prochain NoteOn. Les events restent ordonnes chronologiquement, aucune erreur residuelle.

**Impact :** 15 notes sur 580, fin de piece uniquement (quand la rampe `_volume()` est active).

---

## 33. ~~MakeSound — NoteOff retardé~~ → RÉSOLU (WASM dedup keep-longest)

**Grammaires :** `-gr.Visser5` (16→1 diff / 1112), `-gr.Visser-Waves` (4 / 365), seed=1

**Root cause :** Instances polymétriques du même pitch commençant au même moment (nseq différents). En natif, `p_keyon[channel][note]` compte les NoteOn actifs et n'émet le NoteOff qu'au dernier release → garde toujours la durée la plus longue. En WASM, le dedup par (midiKey, startMs) gardait la première instance rencontrée (la plus courte).

Exemple (Visser5, D6 MIDI 86) :
```
p_Instance[14] obj=16434 start=10698 end=10979 dur=281 nseq=0  ← courte
p_Instance[20] obj=16434 start=10698 end=11114 dur=416 nseq=1  ← longue
```

**Fix appliqué (v3.3.19-wasm.2) :** Dans `bp3_wasm_stubs.c` PlayBuffer1, quand un doublon (midiKey, startMs) est détecté, au lieu de simplement le skip, on met à jour le NoteOff de l'événement déjà émis si le doublon a une durée plus longue. Array `dedupNoteOff[]` tracke l'index du NoteOff dans eventStack.

**Résultat :** visser5 passe de 16 TIMING_DIFF à 1 (±11ms, tick rounding).

---

## 35. ~~TimeSet — starttime +10ms~~ → RÉSOLU WASM (Kpress quantization offset)

**Grammaires :** acceleration (-se.Visser2), visser3 (-se.Visser3), visser-shapes (-se.Visser.Shapes), seed=1

**Root cause :** Quand Kpress ≥ 2 (quantization active sur grammaires complexes), la compensation d'arrondis dans TimeSet.c ligne 195 (`if(jn > 0) T[jn-1] = T[jn]`) écrase T[0] (=0ms) avec T[1] (=premier quantum, ici 10ms). Cela décale tout le tableau T[] d'un quantum. Le natif corrige via `FormatMIDIstream(zerostart=TRUE)`.

Kpress est un indicateur qui détermine si la grammaire nécessite une compression temporelle en fonction de la quantization demandée et de la complexité polymmétrique (Ratio). Kpress=1 → pas de compression. Kpress > 2 → compression active → bug T[0].

**Fix appliqué (v3.3.19-wasm.3) :** Dans PlayBuffer1, quand Kpress ≥ 2, on scanne le min starttime de p_Instance et on le stocke dans `wasm_kpress_offset`. Ce quantum est soustrait de tous les timestamps dans PlayBuffer1 (MIDI) et bp3_get_timed_tokens (S3/S4).

**Résultat :** acceleration, visser3, visser-shapes passent de TIMING+10ms à EXACT MATCH.

**Note pour Bernard :** La compensation `T[jn-1] = T[jn]` quand `jn > 0` crée une cascade qui décale tout T[] d'un quantum. `if(jn > 1)` éviterait l'écrasement de T[0] sans toucher les autres positions. À discuter.

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

**Status :** RÉSOLU. Bernard a implémenté T47 dans FillPhaseDiagram.c, SetObjectFeatures.c, DisplayArg.c (v3.3.19). Côté WASM (wasm.4), on scanne `pp_buff` pour les tags T47 après PolyMake et on construit `wasm_is_sso[]` pour distinguer SSO des non-terminaux résiduels dans `bp3_get_timed_tokens()`.

**Impact :** Non-reg 36/36. Aucune grammaire de test actuelle ne produit de T47 — validation end-to-end à faire avec une scène BPscript dédiée.

---

## 39. ~~Mémoire non initialisée ASLR~~ → RÉSOLU (p_DefaultChannel non initialisé)

**Grammaires affectées :** kss2 (RND, STRIATED, `-se.kss`), look-and-say (SUB, STRIATED, `-se.look-and-say`)

**Symptôme :** bp3 Linux produit des résultats non-déterministes (~30-40% de crash), malgré seed fixe.
Message d'erreur : `'X' has channel 64. Should be 1..16` (ou 32, 96 — valeurs aléatoires).
Désactiver ASLR (`setarch x86_64 -R`) rendait le binaire 100% déterministe.

**Root cause :** `p_DefaultChannel` est non initialisé à deux endroits dans `GetRelease.c` :

1. **`MakeSoundObjectSpace()`** (première allocation, ~ligne 935) : la boucle `for(j=2; j < jmax; j++)` n'initialise que `p_MIDIsize` et `p_CsoundSize`. `p_DefaultChannel[j]` n'est pas mis à 0. La boucle complète d'initialisation (lignes 940-979) ne couvre que j=0 et j=1.

2. **`ResizeObjectSpace()`** (~ligne 1099) : `MySetHandleSize` agrandit le buffer `p_DefaultChannel`, mais les nouveaux octets (issus de `realloc`) ne sont pas initialisés. La boucle d'init (ligne 1143) commence à `j = Jbol`, or `Jbol` est **déjà mis à jour** quand on arrive dans `ResizeObjectSpace` → la boucle fait 0 itérations sur les nouveaux slots. De plus, cette boucle était conditionnée par `Nature_of_time == SMOOTH` (ajouté 2024-07-25), excluant toutes les grammaires STRIATED.

Avec ASLR actif, `realloc` retourne des adresses variables → les octets non initialisés ont des valeurs aléatoires (32, 64, 96...). `SetObjectFeatures.c:244` lit `p_DefaultChannel[j] > 0` → assigne channel=64 → erreur `Should be 1..16`.

**Fix (3 points dans `GetRelease.c`) :**

**Point 1 — `MakeSoundObjectSpace()`, boucle j=2..jmax (~ligne 936) :**
```c
for(j=2; j < jmax; j++) {
    (*p_MIDIsize)[j] = (*p_CsoundSize)[j] = ZERO;
    (*p_DefaultChannel)[j] = 0;  // AJOUT: était non initialisé
}
```

**Point 2 — `ResizeObjectSpace()`, après MySetHandleSize de p_DefaultChannel (~ligne 1099) :**
```c
MySetHandleSize((Handle*)&p_DefaultChannel,(Size)maxsounds*sizeof(char));
/* AJOUT: zero-fill après resize — les nouveaux octets de realloc sont
   non initialisés. Safe car les valeurs légitimes sont chargées après
   par LoadObjectPrototypes. */
if(p_DefaultChannel != NULL && *p_DefaultChannel != NULL)
    memset(*p_DefaultChannel, 0, (size_t)maxsounds * sizeof(char));
```

**Point 3 — `ResizeObjectSpace()`, condition de la boucle d'init (~ligne 1142) :**
```c
// AVANT:
if(Jbol < maxsounds && Nature_of_time == SMOOTH) {
// APRÈS:
if(Jbol < maxsounds) {
```
La condition `SMOOTH` empêchait l'init pour les grammaires STRIATED. L'init des propriétés de base doit s'exécuter pour toutes les grammaires.

**Validation :** kss2 et look-and-say : 50/50 runs déterministes sans `setarch -R`.
S0 (bp.exe Windows) : 32/36 OK (les 4 FAIL sont pré-existants, non liés au fix).
S1 (bp3 Linux) : 36/36 OK. Scores comparaison identiques.

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

## 42. FillPhaseDiagram — Plot(ANYWHERE) écrase les sentinelles -1

**Grammaire :** `-gr.Visser.Shapes` avec 26+ tags `_script(CT N)`, seed=1, `_mm(60) _striated`

**Besoin :** BPscript émet des `_script(CT N)` dans la grammaire BP3 pour marquer les positions temporelles
des contrôles runtime (vel, pan, wave, etc.). Ces tags sont des marqueurs sans durée qui doivent traverser
le moteur sans affecter la production — le dispatcher les intercepte en sortie. Plus une scène BPscript
est riche en contrôles, plus il y a de tags `_script()` dans la grammaire.

**Symptôme :** Segfault en natif, timestamps=0 en WASM (crash silencieux). Se manifeste quand le diagramme
de phase est assez dense — dans visser-shapes à partir de 26 tags `_script(CT N)` uniques, car M3 (utilisé
dans Part2/Part3/Part4) devient complet et l'expansion polymétrique crée un diagramme de 242 lignes.

**Root cause (GDB) :** `Plot(ANYWHERE)` dans `FillPhaseDiagram.c` cherche un slot libre sur toutes les
séquences avec :
```c
oldk = (*((*p_seq)[nseq]))[iplot];
if(oldk > 1) continue;
```

Le terminateur de séquence `-1` satisfait `oldk <= 1` → `ANYWHERE` le traite comme un slot libre et
l'écrase par un objet `_script()`. Sans terminateur, la boucle dans `Calculate_alpha()`
(SetObjectFeatures.c:975) :
```c
while((*((*p_Seq)[nseq]))[++inext] == 0);
```
dépasse le buffer (pas de `-1` pour arrêter) → segfault.

Confirmé par GDB : breakpoint `FillPhaseDiagram.c:1996 if oldk == -1` s'active, objet 2101 écrit
par-dessus le `-1` de la séquence 1 à position 19317.

**Fix (`csrc/bp3/FillPhaseDiagram.c`, ligne 1995) :**
```c
// AVANT :
if(oldk > 1) continue;
// APRÈS :
if(oldk > 1 || oldk == -1) continue; /* Don't overwrite end-of-sequence sentinel */
```

**Validation :** visser-shapes passe de segfault (natif) / timestamps=0 (WASM) à 2115 sound-objects /
1954 tokens avec timestamps valides. Non-régression S1=36/36, S2=36/36, S3=S4=35/35.

---

## 43. ScriptUtils — commande CT pour `_script(CT N)` passthrough

**Besoin :** Le transpileur BPscript émet `_script(CT N)` (avec espace) pour marquer les positions des
contrôles runtime dans la structure temporelle. Ces tags doivent être acceptés par le moteur comme des
commandes valides (no-op) pour que :
1. Le natif ne refuse pas la production (`Script aborted on: CT 0`)
2. Le moteur traite CT comme un élément légitime de la structure (pas un symbole inconnu)

**Contexte :** `ExecScriptLine()` matche l'argument de `_script()` contre la table `ScriptCommand`
(135 entrées chargées depuis `console_strings.json`). Les commandes ont le format
`"<id> <keyword> [<params>]"`. Un `_script(CT 0)` cherche le mot-clé "CT" suivi du paramètre "0".
Sans entrée dans la table → "Script aborted" en natif, stub OK en WASM.

Note : l'original de Bernard utilise `_script(CT0)` (sans espace), qui n'est matché par aucune entrée
de la table (traité comme un seul mot "CT0") — ça fonctionne uniquement parce que le WASM stubbe tout.
Le format avec espace est nécessaire pour un matching correct.

**Fix (2 fichiers) :**

**1. `csrc/wasm/console_strings.json` — ajout en fin de tableau `ScriptCommand` :**
```json
"193 CT _any_"
```
Le `_any_` est un wildcard dans le parseur de commandes : matche n'importe quel paramètre après "CT".

**2. `csrc/bp3/ScriptUtils.c` — ajout dans le switch de `DoScript()` :**
```c
case 193:	/* CT (control tag) — dispatcher passthrough, no engine action */
    break;
```

**Validation :** visser-shapes en natif avec 61 tags `_script(CT N)` : `Errors: 0`, 2115 sound-objects.

---

## Notes pour référence

- Build v3.3.19-wasm.8 (2026-04-06) — sources = Bernard v3.3.19 (cf9d788) + fixes #39, #42, #43 + patches #40a-c
- Non-reg wasm.8 : S1=36/36, S2=36/36, S3=S4=35/35, S4vsS5=16/31 EXACT
- 36 grammaires actives (bells skip — fichiers -ho.cloches1 manquants)
- Points ouverts : #32, #36, #40
- Résolu moteur : #39 (p_DefaultChannel), #42 (sentinel -1), #43 (CT catchall) — fixes à intégrer par Bernard
- Résolu WASM : #33 (dedup keep-longest, wasm.2), #35 (Kpress offset, wasm.3), #38 (T47 SSO, wasm.4)
