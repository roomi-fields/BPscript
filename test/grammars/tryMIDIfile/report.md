# tryMIDIfile — Test Report

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
| S1 Native C | PASS | 8 |
| S2 WASM orig | PASS | 8 |
| S3 WASM silent | PASS | 8 |
| S4 BPscript | PASS | 8 |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | A4 0-1000 | A4 0-1000 | A4 0-1000 | A4 0-1000 |
| 1 | G4 1000-2000 | G4 1000-2000 | G4 1000-2000 | G4 1000-2000 |
| 2 | C5 2000-3000 | C5 2000-3000 | C5 2000-3000 | C5 2000-3000 |
| 3 | A5 3000-4000 | A5 3000-4000 | A5 3000-4000 | A5 3000-4000 |
| 4 | A4 4000-5000 | A4 4000-5000 | A4 4000-5000 | A4 4000-5000 |
| 5 | G4 5000-6000 | G4 5000-6000 | G4 5000-6000 | G4 5000-6000 |
| 6 | C5 6000-7000 | C5 6000-7000 | C5 6000-7000 | C5 6000-7000 |
| 7 | A5 7000-8000 | A5 7000-8000 | A5 7000-8000 | A5 7000-8000 |

## Settings

NoteConvention=0, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=60
