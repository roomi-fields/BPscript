# Ames — Test Report

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
| S1 Native C | PASS | 11 |
| S2 WASM orig | PASS | 11 |
| S3 WASM silent | PASS | 11 |
| S4 BPscript | PASS | 11 |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | F#3 666-2000 | F#3 666-2000 | F#3 666-2000 | F#3 666-2000 |
| 1 | A5 1333-2000 | F5 1333-2000 | F5 1333-2000 | F5 1333-2000 |
| 2 | F5 1333-2000 | A5 1333-2000 | A5 1333-2000 | A5 1333-2000 |
| 3 | E5 2000-2500 | G#3 2000-2500 | G#3 2000-2500 | G#3 2000-2500 |
| 4 | G#3 2000-2500 | E5 2000-2500 | E5 2000-2500 | E5 2000-2500 |
| 5 | G5 2000-2500 | G5 2000-2500 | G5 2000-2500 | G5 2000-2500 |
| 6 | A#4 2500-6000 | A#4 2500-6000 | A#4 2500-6000 | A#4 2500-6000 |
| 7 | B6 3750-6000 | G#5 3750-6000 | G#5 3750-6000 | G#5 3750-6000 |
| 8 | C6 3750-4000 | C6 3750-4000 | C6 3750-4000 | C6 3750-4000 |
| 9 | E6 3750-4000 | E6 3750-4000 | E6 3750-4000 | E6 3750-4000 |
| 10 | G#5 3750-6000 | B6 3750-6000 | B6 3750-6000 | B6 3750-6000 |

## Settings

NoteConvention=0, Quantize=10, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=15
