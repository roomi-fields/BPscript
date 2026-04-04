# tryGraphics — Test Report

Date: 2026-03-30
Result: **PASS**

## Source files

- `original.gr` — grammaire Bernard
- `silent.gr` — réécriture silent sound objects
- `silent.al` — alphabet plat
- `scene.bps` — scène BPscript

## Stages

| Stage | Status | Tokens |
|-------|--------|--------|
| S1 Native C | PASS | 6 |
| S2 WASM orig | PASS | 6 |
| S3 WASM silent | PASS | 6 |
| S4 BPscript | PASS | 6 |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | C4 0-1200 | C4 0-1200 | C4 0-1200 | C4 0-1000 |
| 1 | F#5 0-1350 | D4 1000-2200 | D4 1000-2200 | D4 1000-2000 |
| 2 | D4 1000-2200 | E4 2000-3200 | E4 2000-3200 | E4 2000-3000 |
| 3 | G3 1500-2850 | F#5 0-1350 | F#5 0-1350 | F#5 0-1500 |
| 4 | G4 1500-3000 | G3 1500-2850 | G3 1500-2850 | G3 1500-3000 |
| 5 | E4 2000-3200 | G4 1500-3000 | G4 1500-3000 | G4 1500-3000 |

## Settings

NoteConvention=0, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=60
