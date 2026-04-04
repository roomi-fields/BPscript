# checkNegativeContext — Test Report

Date: 2026-03-26
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
| S4 BPscript | PASS | - |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | A @undefined | A 0-0 | A 0-1000 |  |
| 1 | A @undefined | A 0-0 | A 1000-2000 |  |
| 2 | A @undefined | A 0-0 | A 2000-3000 |  |
| 3 | A1 @undefined | A2 0-0 | A2 3000-4000 |  |
| 4 | A2 @undefined | A3 0-0 | A3 4000-5000 |  |
| 5 | A3 @undefined | A1 0-0 | A1 5000-6000 |  |

## Settings

NoteConvention=0, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=10
