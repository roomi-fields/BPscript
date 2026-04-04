# checktemplates — Test Report

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
| S4 BPscript | PASS | - |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | C4 0-1000 | C4 0-1000 | C4 0-1000 |  |
| 1 | C4 1000-1500 | C4 1000-1500 | C4 1000-1500 |  |
| 2 | C4 1500-2000 | C4 1500-2000 | C4 1500-2000 |  |
| 3 | C4 2000-2333 | C4 2000-2333 | C4 2000-2333 |  |
| 4 | C4 2333-2666 | C4 2333-2666 | C4 2333-2666 |  |
| 5 | C4 2666-3000 | C4 2666-3000 | C4 2666-3000 |  |
| 6 | C4 3000-4000 | C4 3000-4000 | C4 3000-4000 |  |

## Settings

NoteConvention=0, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=60
