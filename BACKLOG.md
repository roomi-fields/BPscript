# BPscript — Backlog

Dernière mise à jour : 2026-04-06
Build : v3.3.19-wasm.8
S4 vs S5 : 16/29 EXACT, 13 DIFF, 7 SKIP, 2 MISSING

## Moteur BP3 — Investigation

### #32 WriteMIDIbyte drift CC interpolés (NotReich)
Root cause trouvée : CC volume interpolés dépassent le timestamp du NoteOn suivant, `OldMIDIfileTime` recule, delta perdu s'accumule. Deux fixes proposés (MIDIfiles.c ou MakeSound.c).
**Status :** En attente décision Bernard (Fix A vs Fix B).

### ~~#36~~ Production TEXT sans séparateurs — RÉSOLU
Non reproductible sur wasm.8. `getResult()` retourne les terminaux séparés avec et sans alphabet.

### Résolus
- ~~#33~~ NoteOff retardé → dedup keep-longest WASM (wasm.2)
- ~~#35~~ Offset +10ms → Kpress offset WASM (wasm.3)
- ~~#38~~ T47 → Bernard implémenté v3.3.19, WASM adapté (wasm.4)
- ~~#39~~ ASLR p_DefaultChannel → GetRelease.c 3 points (wasm.5)
- ~~#42~~ Plot(ANYWHERE) écrase sentinelles -1 → FillPhaseDiagram.c (wasm.8)
- ~~#43~~ CT catchall `_script(CT N)` → ScriptUtils.c + console_strings.json (wasm.8)

## Transpileur S5

### COUNT diffs S4 vs S5 (11 grammaires)
Cause à investiguer. Le pipeline S5 passe par le dispatcher (resolveTokens) qui applique transpose/rotate/etc.
Les seuls contrôles qui causent un diff attendu sont ceux avec traitement audio webaudio (wave, filter, etc.) — non testables au niveau tokens.

### Bugs restants
- `_goto` : position dans la grammaire incorrect
- `mode` : gram#1 toujours LIN, devrait respecter @mode
- Terminaux numériques purs (ex: `1`, `2`) confondus avec des vitesses
- Settings non fidèlement portés depuis les -se. de Bernard

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
