# tryTimePatterns — Test Report

Date: 2026-04-01
Result: **PASS → PASS → PASS → TODO**

## Source files

- `original.gr` — grammaire Bernard
- `silent.gr` — réécriture silent sound objects
- `silent.al` — alphabet plat

## Stages

| Stage | Status | Tokens |
|-------|--------|--------|
| S1 Native C | PASS | 8 |
| S2 WASM orig | PASS | 15 |
| S3 WASM silent | PASS | 15 |
| S4 BPscript | TODO | - |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | C4 0-387 | ? 0-2000 | t1 0-2500 |  |
| 1 | D4 387-774 | ? 2000-5000 | t2 2500-5000 |  |
| 2 | E4 774-1290 | ? 0-774 | t1 0-1000 |  |
| 3 | F4 1290-1806 | ? 774-1806 | t3 1000-2000 |  |
| 4 | A4 2000-2290 | ? 1806-2290 | t4 2000-3000 |  |
| 5 | B4 2290-3064 | C4 0-387 | C4 0-500 |  |
| 6 | C5 3064-4419 | D4 387-774 | D4 500-1000 |  |
| 7 | E5 4419-5000 | E4 774-1290 | E4 1000-1500 |  |
| 8 |  | F4 1290-1806 | F4 1500-2000 |  |
| 9 |  | A4 2000-2290 | A4 2500-3000 |  |
| 10 |  | ? 2290-3838 | t3 3000-4000 |  |
| 11 |  | ? 3838-5000 | t1 4000-5000 |  |
| 12 |  | B4 2290-3064 | B4 3000-3500 |  |
| 13 |  | C5 3064-4419 | C5 3500-4500 |  |
| 14 |  | E5 4419-5000 | E5 4500-5000 |  |

## Settings

NoteConvention=0, Quantize=10, TimeRes=100, NatureOfTime=1, Seed=1, MaxTime=10
