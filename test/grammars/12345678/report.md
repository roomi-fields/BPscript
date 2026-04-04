# 12345678 — Test Report

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
| S1 Native C | PASS | 78 |
| S2 WASM orig | PASS | 1 |
| S3 WASM silent | PASS | 1 |
| S4 BPscript | PASS | - |

## Token comparison

| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |
|--:|:-------------|:---------------|:------------|:--------------|
| 0 | _pitchbend(-200) @undefined | ek 0-0 | ek 0-0 |  |
| 1 | _pitchbend(200) @undefined |  |  |  |
| 2 | _pitchcont @undefined |  |  |  |
| 3 | _pitchrange(200)(={2,ek @undefined |  |  |  |
| 4 | _transpose(-2)(:{2,ek @undefined |  |  |  |
| 5 | _transpose(-2)(:{2,ek @undefined |  |  |  |
| 6 | -{3,- @undefined |  |  |  |
| 7 | -{3,- @undefined |  |  |  |
| 8 | -{3,- @undefined |  |  |  |
| 9 | -}) @undefined |  |  |  |
| 10 | -}) @undefined |  |  |  |
| 11 | -}) @undefined |  |  |  |
| 12 | at}{2,ek @undefined |  |  |  |
| 13 | at}{2,ek @undefined |  |  |  |
| 14 | at}{2,ek @undefined |  |  |  |
| 15 | char @undefined |  |  |  |
| 16 | char @undefined |  |  |  |
| 17 | char @undefined |  |  |  |
| 18 | char @undefined |  |  |  |
| 19 | char @undefined |  |  |  |
| 20 | char @undefined |  |  |  |
| 21 | char @undefined |  |  |  |
| 22 | char @undefined |  |  |  |
| 23 | char @undefined |  |  |  |
| 24 | char} @undefined |  |  |  |
| 25 | char} @undefined |  |  |  |
| 26 | char} @undefined |  |  |  |
| 27 | che @undefined |  |  |  |
| 28 | che @undefined |  |  |  |
| 29 | che @undefined |  |  |  |
| 30 | che}{2,ek @undefined |  |  |  |
| 31 | che}{2,ek @undefined |  |  |  |
| 32 | che}{2,ek @undefined |  |  |  |
| 33 | do @undefined |  |  |  |
| 34 | do @undefined |  |  |  |
| 35 | do @undefined |  |  |  |
| 36 | do @undefined |  |  |  |
| 37 | do @undefined |  |  |  |
| 38 | do @undefined |  |  |  |
| 39 | do @undefined |  |  |  |
| 40 | do @undefined |  |  |  |
| 41 | do @undefined |  |  |  |
| 42 | do @undefined |  |  |  |
| 43 | do @undefined |  |  |  |
| 44 | do @undefined |  |  |  |
| 45 | do @undefined |  |  |  |
| 46 | do @undefined |  |  |  |
| 47 | do @undefined |  |  |  |
| 48 | ek @undefined |  |  |  |
| 49 | ek @undefined |  |  |  |
| 50 | ek @undefined |  |  |  |
| 51 | panch @undefined |  |  |  |
| 52 | panch @undefined |  |  |  |
| 53 | panch @undefined |  |  |  |
| 54 | panch @undefined |  |  |  |
| 55 | panch @undefined |  |  |  |
| 56 | panch @undefined |  |  |  |
| 57 | panch}{2,ek @undefined |  |  |  |
| 58 | panch}{2,ek @undefined |  |  |  |
| 59 | panch}{2,ek @undefined |  |  |  |
| 60 | sat @undefined |  |  |  |
| 61 | sat @undefined |  |  |  |
| 62 | sat @undefined |  |  |  |
| 63 | tin @undefined |  |  |  |
| 64 | tin @undefined |  |  |  |
| 65 | tin @undefined |  |  |  |
| 66 | tin @undefined |  |  |  |
| 67 | tin @undefined |  |  |  |
| 68 | tin @undefined |  |  |  |
| 69 | tin @undefined |  |  |  |
| 70 | tin @undefined |  |  |  |
| 71 | tin @undefined |  |  |  |
| 72 | tin @undefined |  |  |  |
| 73 | tin @undefined |  |  |  |
| 74 | tin @undefined |  |  |  |
| 75 | tin @undefined |  |  |  |
| 76 | tin @undefined |  |  |  |
| 77 | tin @undefined |  |  |  |

## Settings

NoteConvention=0, Quantize=30, TimeRes=10, NatureOfTime=1, Seed=1, MaxTime=3600
