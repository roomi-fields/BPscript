# look-and-say — Test Report

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
| S1 Native C | PASS | 13 |
| S2 WASM orig | PASS | 13 |
| S3 WASM silent | PASS | 13 |
| S4 BPscript | PASS | 1 |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | '1' @undefined | '3' 0-1000 | '3' 0-1000 | d3 0-0 |
| 1 | '1' @undefined | '2' 1000-2000 | '2' 1000-2000 |  |
| 2 | '1' @undefined | '1' 2000-3000 | '1' 2000-3000 |  |
| 3 | '1' @undefined | '1' 3000-4000 | '1' 3000-4000 |  |
| 4 | '1' @undefined | '1' 4000-5000 | '1' 4000-5000 |  |
| 5 | '1' @undefined | '2' 5000-6000 | '2' 5000-6000 |  |
| 6 | '2' @undefined | '1' 6000-7000 | '1' 6000-7000 |  |
| 7 | '2' @undefined | '2' 7000-8000 | '2' 7000-8000 |  |
| 8 | '2' @undefined | '3' 8000-9000 | '3' 8000-9000 |  |
| 9 | '2' @undefined | '3' 9000-10000 | '3' 9000-10000 |  |
| 10 | '3' @undefined | '2' 10000-11000 | '2' 10000-11000 |  |
| 11 | '3' @undefined | '1' 11000-12000 | '1' 11000-12000 |  |
| 12 | '3' @undefined | '1' 12000-13000 | '1' 12000-13000 |  |

## Settings

NoteConvention=0, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=60
