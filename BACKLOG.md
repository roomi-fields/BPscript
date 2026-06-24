# BPScript — Backlog

Dernière mise à jour : 2026-04-06
Build : v3.3.19-wasm.8
S4 vs S5 : 16/29 EXACT, 13 DIFF, 7 SKIP, 2 MISSING

## Données — cohérence chaîne pitch (alphabet → fréquence)

- **BPS-1** `ouvert` — Tri des `bp3_*` dans temperaments.json (différé, 2026-06-17). `lib/temperaments.json` traîne ~150 entrées legacy `bp3_*` qui MÉLANGENT de vrais tempéraments (`bp3_werckmeister_3`, `bp3_meantone_*`, `bp3_kirnberger_*`…) avec des GAMMES déguisées en tempéraments (`bp3_Cmaj`, `bp3_todi1`, `bp3_asavari1`, `bp3_*_murcchana`…). À TRIER : les vrais tempéraments restent ; les « gammes » partent dans `scales.json`. Même nature de ménage que la consolidation maqams. Reporté (décision Romain) — à faire après la migration jins/maqams.

## Moteur BP3 — Investigation

- **32** `bloqué` — `#32` WriteMIDIbyte drift CC interpolés (NotReich). Root cause trouvée : CC volume interpolés dépassent le timestamp du NoteOn suivant, `OldMIDIfileTime` recule, delta perdu s'accumule. Deux fixes proposés (MIDIfiles.c ou MakeSound.c). **Status :** En attente décision Bernard (Fix A vs Fix B).
- **36** `fait` — `#36` Production TEXT sans séparateurs — RÉSOLU. Non reproductible sur wasm.8. `getResult()` retourne les terminaux séparés avec et sans alphabet.

### Résolus

- **33** `fait` — `#33` NoteOff retardé → dedup keep-longest WASM (wasm.2)
- **35** `fait` — `#35` Offset +10ms → Kpress offset WASM (wasm.3)
- **38** `fait` — `#38` T47 → Bernard implémenté v3.3.19, WASM adapté (wasm.4)
- **39** `fait` — `#39` ASLR p_DefaultChannel → GetRelease.c 3 points (wasm.5)
- **42** `fait` — `#42` Plot(ANYWHERE) écrase sentinelles -1 → FillPhaseDiagram.c (wasm.8)
- **43** `fait` — `#43` CT catchall `_script(CT N)` → ScriptUtils.c + console_strings.json (wasm.8)

## Transpileur S5

- **BPS-2** `ouvert` — COUNT diffs S4 vs S5 (11 grammaires). Cause à investiguer. Le pipeline S5 passe par le dispatcher (resolveTokens) qui applique transpose/rotate/etc. Les seuls contrôles qui causent un diff attendu sont ceux avec traitement audio webaudio (wave, filter, etc.) — non testables au niveau tokens.

Bugs restants. Détail dans `memory/backlog_s5_transpiler.md`.

- **BPS-3** `ouvert` — `_goto` : position dans la grammaire incorrect
- **BPS-4** `ouvert` — `mode` : gram#1 toujours LIN, devrait respecter @mode
- **BPS-5** `ouvert` — Terminaux numériques purs (ex: `1`, `2`) confondus avec des vitesses
- **BPS-6** `ouvert` — Settings non fidèlement portés depuis les -se. de Bernard

## Dispatcher / Runtime

- **BPS-7** `ouvert` — Resolver musical complet. Mapping note → fréquence en dur (Western 12-TET, A=440). Degrés : sargam → fréquences ; Tempérament : pythagoricien, meantone, just intonation ; Référence configurable : `@tuning:442` ; Microtonalité : échelles à N divisions.
- **BPS-8** `ouvert` — Routage CV multi-cibles. CV crée un bus audio global. Besoin de routage par cible : `env1(Phrase1, browser)`.
