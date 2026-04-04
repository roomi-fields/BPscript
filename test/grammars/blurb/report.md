# blurb — Test Report

Date: 2026-03-30
Result: **PASS → PASS → TODO → TODO**

## Source files

- `original.gr` — grammaire Bernard

## Stages

| Stage | Status | Tokens |
|-------|--------|--------|
| S1 Native C | PASS | 20 |
| S2 WASM orig | PASS | 8 |
| S3 WASM silent | TODO | - |
| S4 BPscript | TODO | - |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | _cont(blurb) @undefined | C4 0-1000 |  |  |
| 1 | _fixed(blurb) @undefined | D4 1000-2000 |  |  |
| 2 | _ins(Flute) @undefined | E4 2000-3000 |  |  |
| 3 | _ins(Harpsichord) @undefined | F4 3000-4000 |  |  |
| 4 | _step(blurb) @undefined | G4 4000-5000 |  |  |
| 5 | _value(blurb,-211) @undefined | A4 5000-6000 |  |  |
| 6 | _value(blurb,-34) @undefined | B4 6000-7000 |  |  |
| 7 | _value(blurb,123.42) @undefined | C5 7000-8000 |  |  |
| 8 | --> @undefined |  |  |  |
| 9 | ??? @undefined |  |  |  |
| 10 | A4 @undefined |  |  |  |
| 11 | B4 @undefined |  |  |  |
| 12 | C4 @undefined |  |  |  |
| 13 | C5 @undefined |  |  |  |
| 14 | D4 @undefined |  |  |  |
| 15 | E4 @undefined |  |  |  |
| 16 | F4 @undefined |  |  |  |
| 17 | G4 @undefined |  |  |  |
| 18 | gram#1[1] @undefined |  |  |  |
| 19 | S @undefined |  |  |  |

## Settings

NoteConvention=0, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=60
