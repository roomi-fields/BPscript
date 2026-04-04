# tryAllItems — Test Report

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
| S1 Native C | PASS | 2 |
| S2 WASM orig | PASS | 2 |
| S3 WASM silent | PASS | 2 |
| S4 BPscript | PASS | - |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | C4 0-1000 | C4 0-1000 | C4 0-1000 |  |
| 1 | D6 1000-2000 | D6 1000-2000 | D6 1000-2000 |  |

## Settings

NoteConvention=0, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=60
