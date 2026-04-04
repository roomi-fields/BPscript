# doeslittle — Test Report

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
| S1 Native C | PASS | 7 |
| S2 WASM orig | PASS | 7 |
| S3 WASM silent | PASS | 7 |
| S4 BPscript | PASS | 7 |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | C4 0-1000 | C4 0-1000 | C4 0-1000 | C4 0-1000 |
| 1 | G4 0-1333 | D4 1000-2000 | D4 1000-2000 | D4 1000-2000 |
| 2 | D4 1000-1333 | E4 2000-3000 | E4 2000-3000 | E4 2000-3000 |
| 3 | D4 1333-2666 | F4 3000-4000 | F4 3000-4000 | F4 3000-4000 |
| 4 | E4 2000-3000 | G4 0-1333 | G4 0-1333 | G4 0-1333 |
| 5 | C5 2666-4000 | D4 1333-2666 | D4 1333-2666 | D4 1333-2666 |
| 6 | F4 3000-4000 | C5 2666-4000 | C5 2666-4000 | C5 2666-4000 |

## Settings

NoteConvention=0, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=60
