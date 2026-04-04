# Résultats des tests — Pipeline S1→S2→S3→S4

Généré automatiquement par `runner.cjs`. Ne pas éditer à la main.

Dernière mise à jour : 2026-04-02T13:19

| Grammaire | Specificity | S1 | S2 | S1=S2 | S3 | S2=S3 | S4 | S3=S4 | Notes |
|-----------|-------------|----|----|-------|-------|-------|-------|-------|-------|
| 12345678 | - | PASS | PASS | NOT_COMPARABLE | PASS | DIFF | ? | - | _transpose dans la grammaire — natif applique la transpos... |
| 765432 | - | PASS | PASS | PASS | PASS | PASS | FAIL | - | Pitch 823/823 identique ✅. Timing 3x: natif 500ms vs WASM... |
| Ames | - | PASS | PASS | PASS | PASS | PASS | FAIL | - | S1=S2 ✅ pitch exact (11/11), enharmonic notation diff (A#... |
| MyMelody | S1≠S2 | PASS | PASS | DIFF | PASS | DIFF | ? | - | S1≠S2: 0/67 pitch match. Vrai diff (RND + notation + timi... |
| NotReich | S1≠S2 | PASS | PASS | DIFF | PASS | PASS | TODO | - | 580 MIDI: pitch 580/580 ✅, 15 timing diffs ±41ms (arrondi... |
| Visser3 | - | PASS | PASS | PASS | PASS | DIFF | ? | - | S1↔S2 MIDI: count 401≠232 (WASM misses some events). Pitc... |
| Visser5 | S1≠S2 | PASS | PASS | DIFF | PASS | DIFF | ? | - | S1↔S2 MIDI: count 1112≠1088. _transpose applied to MIDI b... |
| acceleration | - | PASS | PASS | PASS | PASS | PASS | FAIL | - | S1↔S2 MIDI: 78 count ✅, pitch 0/78 (native transposes MID... |
| alan-dice | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| all-items | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| all-items1 | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| asymmetric | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| asymmetric1 | S1≠S2 | PASS | PASS | DIFF | FAIL | - | ? | - | 15 tokens text (a b 2 3 structural symbols). |
| beatrix-dice | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| bells | - | PASS | PASS | PASS | PASS | DIFF | ? | - | S2 produit 0 MIDI events. Les tokens sont produits mais p... |
| blurb | - | PASS | PASS | NOT_COMPARABLE | PASS | DIFF | ? | - | Dépend de -cs.tryCsound. Pas comparable S1↔S2. |
| check& | - | PASS | PASS | NOT_COMPARABLE | PASS | NOT_COMPARABLE | TODO | - | Pitchbend + long ties crash WASM. Pas comparable. |
| checkNegativeContext | no MIDI | PASS | PASS | NOT_COMPARABLE | PASS | SKIP | ? | - | Grammaire structurelle. Pas de MIDI. S1 text capture trac... |
| checkVolChan | - | PASS | PASS | NOT_COMPARABLE | PASS | NOT_COMPARABLE | TODO | - | Grammaire interactive (-in.abc1). S2=0 tokens. |
| checktemplates | S1≠S2 | PASS | PASS | DIFF | PASS | PASS | FAIL | - | 7 tokens identical. RND now produces same result on nativ... |
| destru | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| dhadhatite1 | - | PASS | PASS | NOT_COMPARABLE | PASS | DIFF | ? | - | Tabla bols via -ho.dhadhatite. Pas de MIDI. S1 text erreu... |
| dhati | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| dhin | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| dhin1 | no MIDI | PASS | PASS | NOT_COMPARABLE | PASS | SKIP | ? | - | Tabla bols via -ho.dhati. Pas de MIDI. S1 text erreur par... |
| doeslittle | S1≠S2 | PASS | PASS | DIFF | PASS | DIFF | ? | - | S1=24 MIDI (FIELDSIZE=1000, natif produit 3 items), S2=7 ... |
| drum | S1 fail | FAIL | ? | - | ? | - | ? | - | S1=S2 ✅ pitch exact (12/12), sort_exact after sort by (st... |
| ek-do-tin | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| flags | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| gramgene1 | - | PASS | PASS | NOT_COMPARABLE | FAIL | - | ? | - | Meta-grammaire. S1 text parsing incomplet. |
| graphics | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| harmony | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| koto3 | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| kss2 | - | PASS | PASS | PASS | PASS | DIFF | ? | - | S2 produit 0 MIDI events. Les tokens sont produits mais p... |
| livecode1 | - | PASS | PASS | PASS | PASS | PASS | FAIL | - | Pitch 100% identique (multiset sort). Timing diffs = arro... |
| livecode2 | S1≠S2 | PASS | PASS | DIFF | PASS | PASS | FAIL | - | Pitch 100% identique (multiset sort). Timing diffs = arro... |
| look-and-say | - | PASS | PASS | PASS | PASS | PASS | FAIL | - | 13 tokens both sides but different sequence (9/13 names d... |
| mohanam | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| mozart-dice | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| nadaka | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| negative-context | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| not-reich | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| one-scale | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| repeat | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| ruwet | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| simpletemplates | S1≠S2 | PASS | PASS | DIFF | PASS | DIFF | ? | - | 6 tokens identical. RND+TEMPLATES, same seed produces sam... |
| templates | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| time-patterns | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| transposition1 | S1≠S2 | PASS | PASS | DIFF | PASS | DIFF | ? | - | S1↔S2 MIDI: 75 count ✅, timing 75/75 exact ✅, pitch 30/75... |
| transposition3 | no MIDI | PASS | PASS | NOT_COMPARABLE | PASS | DIFF | ? | - | Bug moteur BP3 originel: overflow durées PolyExpand (endt... |
| tryAllItems | S1≠S2 | PASS | PASS | DIFF | PASS | DIFF | ? | - | 2 tokens identical (C5 D3). _goto, _failed, _repeat, K-pa... |
| tryAllItems0 | - | PASS | PASS | NOT_COMPARABLE | PASS | PASS | FAIL | - | AllItems=1 + text-only. S1 capture dérivations intermédia... |
| tryAllItems1 | - | PASS | PASS | NOT_COMPARABLE | PASS | PASS | FAIL | - | AllItems=1 + text-only. Validé manuellement (items unique... |
| tryDESTRU | S1≠S2 | PASS | PASS | DIFF | PASS | DIFF | ? | - | 20 tokens identical. _destru destructures abca→a b c a vi... |
| tryGraphics | S1≠S2 | PASS | PASS | DIFF | PASS | DIFF | ? | - | S1=S2 ✅ pitch exact (6/6) |
| tryMIDIfile | S1≠S2 | PASS | PASS | DIFF | PASS | DIFF | ? | - | 8 tokens identical. RND with weights <1-1>, _volume as ru... |
| tryPatternGrammar | - | PASS | PASS | PASS | PASS | PASS | FAIL | - | 312/312 names identical ✅. AllItems text comparison. |
| tryRotate | S1≠S2 | PASS | PASS | DIFF | PASS | DIFF | ? | - | 65 tokens identical. RND + _rotate(K1=2) + K-param cumula... |
| tryTimePatterns | no -tb | PASS | PASS | PASS | PASS | NOT_COMPARABLE | TODO | - | 8 MIDI events: pitch 8/8 ✅, 8 timing diffs ±1ms (arrondi) |
| visser-shapes | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |
| visser-waves | - | PASS | PASS | SKIP | PASS | SKIP | FAIL | - |  |

**0 complets | 61 partiels | 0 bloqués | 0 skippés | 61 testés / 107 total**
