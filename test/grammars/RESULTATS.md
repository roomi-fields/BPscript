# Résultats des tests — Pipeline S1→S2→S3→S4

Généré automatiquement par `runner.cjs`. Ne pas éditer à la main.

Dernière mise à jour : 2026-03-25T18:05

| Grammaire | Specificity | S1 | S2 | S1=S2 | S3 | S2=S3 | S4 | S3=S4 | Notes |
|-----------|-------------|----|----|-------|-------|-------|-------|-------|-------|
| 12345678 | S1 fail | FAIL | ? | - | ? | - | ? | - | 78 tokens identical. Tabla bols with flat alphabet. |
| 765432 | - | PASS | PASS | EXPECTED_DIFF | PASS | PASS | PASS | PASS | 823 tokens both sides. Names differ: English (S1) vs Fren... |
| Ames | - | PASS | PASS | SKIP | PASS | SKIP | PASS | PASS | 11 tokens identical. _rest, ties, polymetry, _mm(60), _st... |
| MyMelody | - | PASS | PASS | EXPECTED_DIFF | PASS | PASS | PASS | PASS | 67 tokens both sides. Names differ: English (S1) vs Frenc... |
| NotReich | no MIDI | PASS | FAIL | NOT_COMPARABLE | TODO | - | TODO | - | 580 notes MIDI. |
| Visser3 | S1 fail | FAIL | ? | - | ? | - | ? | - |  |
| Visser5 | S1 fail | FAIL | FAIL | - | TODO | - | TODO | - | Native timeout (>30s). Deep polymetry 17 levels. |
| acceleration | - | PASS | PASS | SKIP | PASS | SKIP | PASS | PASS | _transpose(12) applied by native (E2→E3), not by WASM (E2... |
| asymmetric1 | - | PASS | PASS | PASS | FAIL | - | TODO | - | 15 tokens text (a b 2 3 structural symbols). |
| blurb | needs -cs | BLOCKED | BLOCKED | - | TODO | - | TODO | - | requires -cs.tryCsound (Csound instruments). Native C han... |
| check& | - | PASS | FAIL | - | BLOCKED | - | BLOCKED | - | 11 tokens text (French, ties &, _rest, _pitchbend). Rules... |
| checkNegativeContext | - | PASS | PASS | SKIP | PASS | SKIP | PASS | PASS | Verified manually: S1 text A A A A2 A3 A1 = S2 timed toke... |
| checktemplates | - | PASS | PASS | SKIP | PASS | SKIP | PASS | PASS | 7 tokens identical. RND now produces same result on nativ... |
| dhin1 | no MIDI | PASS | PASS | NOT_COMPARABLE | SKIP | - | TODO | - | No MIDI (tabla bols). Text captures noise. |
| doeslittle | MIDI overlap | PASS | PASS | SKIP | PASS | SKIP | PASS | PASS | D4 end 1333 (MIDI) vs 2000 (WASM). MIDI NoteOff overlap: ... |
| drum | - | PASS | PASS | SKIP | PASS | SKIP | PASS | PASS | 12 tokens identical (1ms tolerance on end times — gcc vs ... |
| gramgene1 | - | PASS | PASS | NOT_COMPARABLE | FAIL | - | TODO | - | S1 text parsing incomplete for quoted terminals. S2 33 to... |
| kss2 | _transpose, renamed | PASS | PASS | EXPECTED_DIFF | PASS | EXPECTED_DIFF | PASS | EXPECTED_DIFF | 78 vs 86 tokens. Native applies _transpose(-7), WASM does... |
| livecode1 | - | PASS | PASS | SKIP | PASS | SKIP | PASS | PASS | 27 tokens identical. Deep polymetry, _vel/_chan as runtime. |
| livecode2 | renamed | PASS | PASS | NOT_COMPARABLE | PASS | EXPECTED_DIFF | PASS | EXPECTED_DIFF | S1 text 24 tokens, S2 29 tokens. Text parsing incomplete ... |
| look-and-say | renamed | PASS | PASS | SKIP | PASS | SKIP | PASS | EXPECTED_DIFF | 13 tokens both sides but different sequence (9/13 names d... |
| simpletemplates | - | PASS | PASS | SKIP | PASS | SKIP | PASS | PASS | 6 tokens identical. RND+TEMPLATES, same seed produces sam... |
| transposition3 | S1 fail | FAIL | PASS | NOT_COMPARABLE | PASS | EXPECTED_DIFF | FAIL | FAIL | 48 tokens same names but all timings differ. _script(CTn)... |
| tryAllItems | - | PASS | PASS | SKIP | PASS | SKIP | PASS | PASS | 2 tokens identical (C5 D3). _goto, _failed, _repeat, K-pa... |
| tryAllItems0 | - | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 2 tokens text (b b). |
| tryAllItems1 | - | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 2 tokens identical (C4, D6). Same as tryAllItems but Choi... |
| tryDESTRU | no MIDI, no -mi/-so | PASS | SKIP | NOT_COMPARABLE | PASS | SKIP | PASS | PASS | 20 tokens identical. _destru destructures abca→a b c a vi... |
| tryGraphics | renamed | PASS | PASS | SKIP | PASS | SKIP | PASS | EXPECTED_DIFF | 6 tokens identical. legato+staccato engine controls. |
| tryMIDIfile | - | PASS | PASS | SKIP | PASS | SKIP | PASS | PASS | 8 tokens identical. RND with weights <1-1>, _volume as ru... |
| tryPatternGrammar | - | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 11 tokens names identical (a a a a a b a a b a a). |
| tryRotate | - | PASS | PASS | SKIP | PASS | SKIP | PASS | PASS | 65 tokens identical. RND + _rotate(K1=2) + K-param cumula... |
| tryTimePatterns | no MIDI, no -mi/-so, no -tb | PASS | DEGRADED | NOT_COMPARABLE | TODO | - | TODO | - | 8 MIDI notes with correct timings. |

**21 complets | 10 partiels | 1 bloqués | 5 skippés | 37 testés / 107 total**

## Skippés temporaires

| Grammaire | Raison |
|-----------|--------|
| Nadaka-1er-essai | Variable A8 undefined in grammar. Produces A8 A8 A8 A8 on both native and WASM.  |
| bells | Requires -ho.cloches1 (with -mi). Complex: wildcards, infinite weight, negative  |
| checkVolChan | Requires -ho.Frenchnotes and -in.abc1. Skip temporaire. |
| dhadhatite1 | Complex: 5 subgrammars, -ho.dhadhatite, compound tabla terminals. Skip temporair |
| transposition1 | Requires -ho.transposition (homomorphism with -mi dependency). Skip temporaire. |
