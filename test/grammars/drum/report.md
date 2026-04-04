# drum — Test Report

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
| S1 Native C | PASS | 12 |
| S2 WASM orig | PASS | 12 |
| S3 WASM silent | PASS | 12 |
| S4 BPscript | PASS | 12 |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | C8 0-40 | C8 0-40 | C8 0-40 | C8 0-40 |
| 1 | E7 0-39 | C7 1000-1040 | C7 1000-1040 | C7 1000-1040 |
| 2 | E7 500-539 | C7 2000-2040 | C7 2000-2040 | C7 2000-2040 |
| 3 | C7 1000-1040 | C7 3000-3040 | C7 3000-3040 | C7 3000-3040 |
| 4 | E7 1000-1039 | E7 0-39 | E7 0-39 | E7 0-39 |
| 5 | E7 1500-1539 | E7 500-540 | E7 500-540 | E7 500-540 |
| 6 | C7 2000-2040 | E7 1000-1040 | E7 1000-1040 | E7 1000-1040 |
| 7 | E7 2000-2039 | E7 1500-1540 | E7 1500-1540 | E7 1500-1540 |
| 8 | E7 2500-2539 | E7 2000-2040 | E7 2000-2040 | E7 2000-2040 |
| 9 | C7 3000-3040 | E7 2500-2540 | E7 2500-2540 | E7 2500-2540 |
| 10 | E7 3000-3039 | E7 3000-3040 | E7 3000-3040 | E7 3000-3040 |
| 11 | E7 3500-3539 | E7 3500-3540 | E7 3500-3540 | E7 3500-3540 |

## Settings

NoteConvention=0, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=60
