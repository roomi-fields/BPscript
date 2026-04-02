# BUG: bp3 Linux segfault sur vina / vina2

## Grammaires affectées
- `vina` (bernard: `vina`) — MIDI, 5 notes attendues
- `vina2` (bernard: `vina2`) — texte

## Symptôme
bp3 Linux (3.3.19) crashe avec core dump sur ces deux grammaires.
bp.exe Windows (3.3.19, même source) produit un résultat correct.

## Reproduction

```bash
cd /mnt/d/Claude/bp3-engine

# Crash (core dump)
./bp3 produce -e -se test-data/-se.Vina -gr test-data/-gr.vina --midiout /tmp/test_vina.mid --seed 1

# Fonctionne (5 MIDI notes)
/mnt/c/MAMP/htdocs/bolprocessor/bp.exe produce -se ctests/-se.Vina -gr ctests/-gr.vina --midiout C:\tmp\test_vina.mid -D -e --seed 1
```

## Settings
`-se.Vina` est en format JSON (converti par l'interface PHP). Contient :
- NoteConvention: 2 (Indian)
- Improvize: 0
- MaxItemsProduce: 20
- Metronome: 60

## Comportement attendu
bp3 Linux doit produire le même résultat que bp.exe :
- vina : 5 notes MIDI
- vina2 : sortie texte avec `{sa4 _ _, _pitchcont...}`

## Comportement observé
bp3 Linux : `Segmentation fault (core dumped)` immédiatement après le début de la compilation.

## RÉSOLU — 2026-04-02

**Cause racine :** `-se.Vina` a `ShowObjectGraph=1`. `SaveLoads1.c:758` force `ShowGraphic=TRUE`. En console sans `--trace`, `imagePtr` reste NULL → crash dans `Graphic.c:1388` (`fputs(line, imagePtr)`).

**Fix :** Guard `NoTracePath` ajouté dans `ConsoleMain.c` après `PrepareTraceDestination()` :
```c
if(NoTracePath) { ShowObjectGraph = ShowPianoRoll = ShowGraphic = FALSE; }
```

**Résultat :** vina produit 6 notes MIDI, vina2 produit texte correct.
