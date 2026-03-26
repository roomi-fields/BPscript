# BP3 File Formats — Reference

> Compiled from bolprocessor.org documentation (56 pages scraped March 2026)
> and code inspection of BP3 WASM engine.

---

## Overview

BP3 organizes projects as collections of files with two-letter prefixed extensions.
Each file type has a specific role in the pipeline.

```
-da.project          ← data file (project entry point)
  ├── -gr.name       ← grammar (production rules)
  ├── -al.name       ← alphabet (terminal symbols)
  ├── -ho.name       ← homomorphisms (transformations)
  ├── -se.name       ← settings (configuration)
  ├── -so.name       ← sound-object prototypes
  ├── -to.name       ← tonality/tuning (scales, temperaments)
  ├── -tb.name       ← time base (time patterns)
  ├── -cs.name       ← Csound instrument descriptions
  └── -gl.name       ← glossary
```

---

## Functional Formats (BP3 WASM confirmed)

### `-gr.` — Grammar

The core file. Contains production rules organized in subgrammars.

**Structure:**
```
// comments
-se.settings_file
-ho.homomorphism_file
-al.alphabet_file

ORD
gram#1[1] S --> A B C
gram#1[2] A --> a b
-----
RND
gram#2[1] B --> c d
gram#2[2] B --> e f
```

**Key elements:**
- Mode declaration on a line alone: `ORD`, `RND`, `LIN`, `SUB`, `SUB1`, `TEM`, `POSLONG`
- Rules: `gram#N[M] <weight> /flags/ LHS --> RHS`
- Arrows: `-->` (production), `<-->` (bidirectional), `<--` (analysis)
- Subgrammar separator: `-----` (5+ hyphens)
- Optional `TEMPLATES:` section at the end

**Source:** Used in every example on bolprocessor.org.
- [Pattern grammars](https://bolprocessor.org/pattern-grammars/)
- [Flags in grammars](https://bolprocessor.org/flags/)
- [Produce all items](https://bolprocessor.org/produce-all-items/)
- [Mozart's musical dice game](https://bolprocessor.org/mozarts-musical-dice-game/)
- [Interactive improvisation](https://bolprocessor.org/interactive-improvisation/)

**WASM status:** ✅ 103/103 files load successfully.

---

### `-al.` — Alphabet

Defines the terminal symbols available to the grammar.

**Structure:**
```
-al.abc
a b c d e f g
```

Simple space-separated list of terminal names. Notes use the active convention
(English: `C4 D4 E4`, French: `do3 re3 mi3`, Indian: `Sa Re Ga`).

**Note convention:** Set in the grammar or settings. Default is English.
The French convention uses `do3` = middle C (MIDI 60), not `do4`.

**Source:**
- [Produce all items](https://bolprocessor.org/produce-all-items/) — `-al.abc` example
- [Mozart's dice game](https://bolprocessor.org/mozarts-musical-dice-game/) — French note convention

**WASM status:** ✅ 12/12 files load successfully.

---

### `-to.` — Tonality / Tuning

Defines scales, temperaments, and microtonality settings.

**Content:** Scale definitions with cent values or ratios for each degree.
Supports multiple temperament systems (equal, just, meantone, Indian shruti, etc.)

**Source:**
- [Microtonality](https://bolprocessor.org/microtonality/) — `-to.tryMPE`, multiple scales
- [MIDI microtonality](https://bolprocessor.org/check-midi-microtonality/) — MPE implementation
- [Csound tuning](https://bolprocessor.org/csound-tuning/) — Csound integration
- [Raga intonation](https://bolprocessor.org/raga-intonation/) — Indian tuning systems
- [Just intonation framework](https://bolprocessor.org/just-intonation-framework/)
- [Creation of just-intonation scales](https://bolprocessor.org/creation-just-intonation/)
- [Comparing temperaments](https://bolprocessor.org/comparing-temperaments/)

**WASM status:** ✅ 13/13 files load successfully.

---

### `-tb.` — Time Base / Time Patterns

Defines time patterns for smooth time (non-measured, rubato-like timing).

**Content:** Sequences of duration ratios that modify the temporal flow.
Used with `_smooth` mode for non-metronomic time.

**Source:**
- [Time patterns (smooth time)](https://bolprocessor.org/time-patterns-smooth-time/)
- [Rationalizing musical time](https://bolprocessor.org/rationalizing-musical-time/)

**WASM status:** ✅ 23/23 files load successfully (via provision).

---

### `-gl.` — Glossary

Maps symbols to descriptions or alternative representations.

**Source:**
- Referenced in BP2 reference manual (section 7 "Glossaries")

**WASM status:** ✅ 2/2 files load successfully (via provision).

---

## Partially Functional Formats

### `-ho.` — Homomorphisms

Defines symbol transformations (transposition, inversion, etc.).

**Structure (modern format, BP2.8+):**
```
// Homomorphism file
// Created: ...
-mi.prototype_file
* C4 --> D4
* D4 --> E4
```

**Three sub-formats observed:**
1. **`//` header format** (BP2.8+): Header lines start with `//`. ✅ Works.
2. **`-mi.` direct format**: Starts with `-mi.xxx`. ✅ Works.
3. **`*` direct format**: Starts with `*`. ✅ Works.
4. **`V.x.x` format** (BP2.5 legacy): Contains `Date:` outside comments → ❌ FAILS ("Can't accept character :")

**Source:**
- BP2 reference manual section 4: "Patterns in BP grammars"
- [BP1 in real musical context](https://bolprocessor.org/bp1-in-real-musical-context/) — homomorphic transformations

**WASM status:** ⚠️ 23/38 OK, 11/38 FAIL (legacy format), 4 untested.

---

### `-se.` — Settings

Configuration parameters for the grammar and playback.

**Two formats:**
1. **JSON format** (PHP interface): Parsed by `bp3_load_settings_params`. ✅ Works.
   - Parameters: `seed`, `quantize`, `graphicScale`, `timeAccuracy`, `maxDeriv`, `maxItems`
2. **Text format** (BP2 legacy): Key-value pairs. ❌ FAILS ("Could not parse JSON")

**Source:**
- BP2 reference manual section 16: "What's in a -se. file?"
- [Produce all items](https://bolprocessor.org/produce-all-items/) — `-se.tryAllItems0`

**WASM status:** ⚠️ ~30% OK (JSON), ~70% FAIL (legacy text format).

---

### `-so.` / `-mi.` — Sound-Object Prototypes

Defines metrical and topological properties of sound-objects (duration, elasticity,
pivot points, pre-roll, post-roll).

**Content:** MIDI sequences or Csound scores that serve as prototypes for terminals.
Each sound-object has properties that the time-setting algorithm uses:
- Pivot position (PivBeg, PivCent, PivEnd)
- Truncation rules
- Elasticity (min/max duration)
- Relocatability
- Continuity constraints

**Source:**
- [Time-setting of sound-objects](https://bolprocessor.org/time-setting-of-sound-objects/)
- [Interactive improvisation](https://bolprocessor.org/interactive-improvisation/) — `-so.koto3`
- [Control of NoteOn/NoteOff](https://bolprocessor.org/control-noteon-noteoff/)
- [Silent sound-objects](https://bolprocessor.org/silent-sound-objects/)
- [Two algorithms](https://bolprocessor.org/two-algorithms/) — time-setting algorithm

**WASM status:** ⚠️ Fails when the referenced `-ho.` file fails (cascading).

---

### `-cs.` — Csound

Csound instrument descriptions and orchestra files.

**Content:** Csound orchestra code (instruments, function tables) used when
BP3 generates Csound scores instead of MIDI.

**Source:**
- [Csound checkup](https://bolprocessor.org/csound-checkup/)
- [Csound objects](https://bolprocessor.org/csound-objects/)
- [Csound tuning](https://bolprocessor.org/csound-tuning/)
- [Continuous parameters in Csound](https://bolprocessor.org/continuous-parameters-csound/)
- [Simple Csound orchestra](https://bolprocessor.org/simple-csound-orchestra/)
- [Csound argument mapping](https://bolprocessor.org/csound-argument-mapping/)
- [Sarasvati vina](https://bolprocessor.org/sarasvati-vina/) — `-cs.Vina`

**WASM status:** ❌ HANG (timeout) on some files. 13 files in test-data.

---

## Non-Functional / Legacy Formats

### `-da.` — Data (Project)

Project entry point file. References other files.

**Source:**
- [Importing MusicXML](https://bolprocessor.org/importing-musicxml/) — `-da.musicXML`
- [MIDI microtonality](https://bolprocessor.org/check-midi-microtonality/) — `-da.tryMPE`

**WASM status:** Not tested independently (loaded via PHP interface).

---

### `-or.` — Orchestra

Csound orchestra files (separate from `-cs.`).

**WASM status:** ❌ "Unknown option" — not supported in console mode. 14 files in test-data.

---

### `-in.` — Interactive MIDI

Interactive MIDI configuration (filters, mappings for real-time input).

**Source:**
- BP2 reference manual section 6: "Interactive control"
- [Capture MIDI input](https://bolprocessor.org/capture-midi-input/)

**WASM status:** ❌ "unsupported" in console mode. 3 files in test-data.

---

## Undocumented / Unknown Formats

| Prefix | Probable role | Evidence |
|---|---|---|
| `-kb.` | Keyboard mapping | BP1 had keyboard mappings ([Installing BP1](https://bolprocessor.org/installing-bp1/)) |
| `-tr.` | Trace output | BP2 ref manual section 8: "Trace procedures" |
| `-wg.` | Weights | Possibly weight/learning data |
| `-md.` | MIDI data | BP2 ref manual section 14: "Saving and loading MIDI code" |

These formats likely existed in BP2 and may not have been ported to BP3 web.

---

## Key Documentation Links

| Topic | URL |
|---|---|
| **Complete BP2 reference manual** | https://bolprocessor.org/misc/docs/ |
| **Pattern grammars** | https://bolprocessor.org/pattern-grammars/ |
| **Polymetric structures** | https://bolprocessor.org/polymetric-structure/ |
| **Flags** | https://bolprocessor.org/flags/ |
| **Time-setting algorithm** | https://bolprocessor.org/time-setting-of-sound-objects/ |
| **Two algorithms (paper)** | https://bolprocessor.org/two-algorithms/ |
| **Smooth time / time patterns** | https://bolprocessor.org/time-patterns-smooth-time/ |
| **Microtonality** | https://bolprocessor.org/microtonality/ |
| **Tied notes** | https://bolprocessor.org/tied-notes/ |
| **Live coding** | https://bolprocessor.org/live-coding/ |
| **Minimising polymetric** | https://bolprocessor.org/minimising-a-polymetric-structure/ |
| **Complex ratios** | https://bolprocessor.org/complex-ratios-polymetric/ |
| **Raga intonation** | https://bolprocessor.org/raga-intonation/ |
| **Just intonation** | https://bolprocessor.org/just-intonation-framework/ |
| **Comparing temperaments** | https://bolprocessor.org/comparing-temperaments/ |
| **Importing MusicXML** | https://bolprocessor.org/importing-musicxml/ |
| **Publications** | https://bolprocessor.org/publications/ |
