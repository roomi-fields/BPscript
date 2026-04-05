# BPscript — Backlog

Dernière mise à jour : 2026-04-05

## Moteur BP3 — Investigation

### #32 Bifurcation FillPhaseDiagram (GCC vs clang)
NotReich : tokens identiques 0–564, divergence brutale à t=82s. Pas un arrondi cumulatif — un branchement conditionnel qui bascule différemment. `round(prodtempo)` et `-mfpmath=sse` sans effet.
**À faire :** Instrumenter tempo/toofast/speed/scale autour du token 565, comparer traces GCC vs WASM.

### #33 NoteOff scheduling séquentiel (MakeSound)
Visser5/Visser-Waves : NoteOff retardé jusqu'au endtime de la note suivante. Scheduling séquentiel de MakeSound.
**À faire :** Créer une grammaire minimale qui reproduit le problème. Investiguer le mécanisme p_keyon/SendToDriver.

### #35 Offset +10ms settings Visser
TimeSet produit starttime=10 au lieu de 0 avec les settings Visser. Le natif corrige via FormatMIDIstream zerostart.
**À faire :** Identifier quel paramètre settings cause le décalage. Reproduire le zerostart WASM sans casser les silences initiaux.

### #39 ASLR / mémoire non initialisée (kss2)
Workaround `setarch -R` appliqué.
**À faire :** Compiler avec `-fsanitize=address` ou Valgrind pour localiser la variable.

### #38 Terminal distinction (T47)
Bernard propose T47 au lieu de T4→T3. En attente de son implémentation.
**À faire :** Adapter `bp3_get_timed_tokens()` quand T47 sera disponible.

## Transpileur S5

### Bugs restants
- `_goto` : position dans la grammaire incorrect
- `mode` : gram#1 toujours LIN, devrait respecter @mode
- Terminaux numériques purs (ex: `1`, `2`) confondus avec des vitesses
- 3 contrôles runtime non implémentés

Détail dans `memory/backlog_s5_transpiler.md`.

## Dispatcher / Runtime

### Resolver musical complet
Mapping note → fréquence en dur (Western 12-TET, A=440).
- Degrés : sargam → fréquences
- Tempérament : pythagoricien, meantone, just intonation
- Référence configurable : `@tuning:442`
- Microtonalité : échelles à N divisions

### Routage CV multi-cibles
CV crée un bus audio global. Besoin de routage par cible : `env1(Phrase1, browser)`.
