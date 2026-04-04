# tryDESTRU — Test Report

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
| S1 Native C | PASS | 24 |
| S2 WASM orig | PASS | 24 |
| S3 WASM silent | PASS | 24 |
| S4 BPscript | PASS | - |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | b @undefined | c 0-1000 | c 0-1000 |  |
| 1 | b @undefined | b 1000-2000 | b 1000-2000 |  |
| 2 | b @undefined | b 2000-3000 | b 2000-3000 |  |
| 3 | b @undefined | c 3000-4000 | c 3000-4000 |  |
| 4 | b @undefined | c 4000-5000 | c 4000-5000 |  |
| 5 | b @undefined | b 5000-6000 | b 5000-6000 |  |
| 6 | b @undefined | b 6000-7000 | b 6000-7000 |  |
| 7 | b @undefined | c 7000-8000 | c 7000-8000 |  |
| 8 | b @undefined | c 8000-9000 | c 8000-9000 |  |
| 9 | b @undefined | b 9000-10000 | b 9000-10000 |  |
| 10 | b @undefined | b 10000-11000 | b 10000-11000 |  |
| 11 | b @undefined | c 11000-12000 | c 11000-12000 |  |
| 12 | c @undefined | c 12000-13000 | c 12000-13000 |  |
| 13 | c @undefined | b 13000-14000 | b 13000-14000 |  |
| 14 | c @undefined | b 14000-15000 | b 14000-15000 |  |
| 15 | c @undefined | c 15000-16000 | c 15000-16000 |  |
| 16 | c @undefined | c 16000-17000 | c 16000-17000 |  |
| 17 | c @undefined | b 17000-18000 | b 17000-18000 |  |
| 18 | c @undefined | b 18000-19000 | b 18000-19000 |  |
| 19 | c @undefined | c 19000-20000 | c 19000-20000 |  |
| 20 | c @undefined | c 20000-21000 | c 20000-21000 |  |
| 21 | c @undefined | b 21000-22000 | b 21000-22000 |  |
| 22 | c @undefined | b 22000-23000 | b 22000-23000 |  |
| 23 | c @undefined | c 23000-24000 | c 23000-24000 |  |

## Settings

NoteConvention=0, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=10
