# BUG: bp3 Linux timeout sur Watch_What_Happens

## Grammaire affectée
- `watch` (bernard: `Watch_What_Happens`) — MIDI, 2105 notes attendues

## Symptôme
bp3 Linux (3.3.19) tourne indéfiniment sans produire de résultat (testé jusqu'à 90s).
bp.exe Windows (3.3.19, même source) produit 2105 notes MIDI en moins de 60s.

## Reproduction

```bash
cd /mnt/d/Claude/bp3-engine

# Timeout (aucune sortie après 90s)
timeout 90 ./bp3 produce -e -se test-data/-se.Watch_What_Happens -gr test-data/-gr.Watch_What_Happens --midiout /tmp/test_watch.mid --seed 1

# Fonctionne (2105 MIDI notes)
/mnt/c/MAMP/htdocs/bolprocessor/bp.exe produce -se ctests/-se.Watch_What_Happens -gr ctests/-gr.Watch_What_Happens --midiout C:\tmp\test_watch.mid -D -e --seed 1
```

## Settings
`-se.Watch_What_Happens` est en format JSON. Contient :
- NoteConvention: 0 (English)
- Improvize: 0
- MaxItemsProduce: 0 (pas de limite)
- MaxConsoleTime: 60 (secondes)
- Polyphonie élevée (2200 poly features)

## Comportement attendu
bp3 Linux doit produire 2105 notes MIDI, identique à bp.exe.

## Comportement observé
bp3 Linux ne termine jamais. Pas de sortie, pas de crash, tourne indéfiniment. Le setting MaxConsoleTime=60 n'est probablement pas respecté par bp3 Linux.

## RÉSOLU — 2026-04-02

**Cause racine :** Même bug que vina — `-se.Watch_What_Happens` a des settings graphiques activés. Le pipeline graphique (`DrawItem`) bouclait indéfiniment avec `imagePtr=NULL` car `ShowGraphic` était forcé TRUE par `ShowObjectGraph`.

**Fix :** Guard `NoTracePath` ajouté dans `ConsoleMain.c` (même fix que vina).

**Résultat :** 2106 notes MIDI produites en 81 secondes (attendu ~2105).
