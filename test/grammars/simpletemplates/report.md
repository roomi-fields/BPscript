# simpletemplates — Test Report

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
| 0 | D5 0-1000 | D5 0-1000 | D5 0-1000 | D5 0-1000 |
| 1 | C5 1000-2000 | C5 1000-2000 | C5 1000-2000 | C5 1000-2000 |
| 2 | D5 2000-2666 | D5 2000-2666 | D5 2000-2666 | D5 2000-2666 |
| 3 | D5 2666-3333 | D5 2666-3333 | D5 2666-3333 | D5 2666-3333 |
| 4 | C5 3333-4000 | C5 3333-4000 | C5 3333-4000 | C5 3333-4000 |
| 5 | D5 4000-6000 | D5 4000-6000 | D5 4000-6000 | D5 4000-6000 |

## Settings

NoteConvention=0, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=60
