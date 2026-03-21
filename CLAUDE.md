## BPscript — Meta-sequencer for Temporal Structure Composition

3 reserved words, 24 symbols, 7 operators. Compiles to BP3 grammar format and runs via WASM.
Orchestrates SC, TidalCycles, Python, MIDI, DMX, etc. in a single file via backticks.

### Language summary
- **3 words**: `gate`, `trigger`, `cv` (temporal types)
- **24 structural symbols**: `@`, `->`, `<-`, `<>`, `{}`, `,`, `()`, `:`, `=`, `[]`, ``` `` ```, `//`, `-`, `_`, `.`, `...`, `!`, `<!`, `#`, `?`, `$`, `&`, `~`, `|`
- **7 flag operators**: `==`, `!=`, `>`, `<`, `>=`, `<=`, `+`
- **5 reserved qualifier keys**: `speed`, `scale`, `mode`, `weight`, `on_fail`
- **Double declaration**: each symbol has temporal type + runtime binding (`gate Sa:sc`)
- Silence: `-` in both BPscript and BP3
- Prolongation: `_` in both BPscript and BP3
- Period notation: `.` = equal-duration fragment separator (same as BP3)
- `!` = simultaneous event (any type: trigger, gate, cv, or flag mutation)
- `[]` = engine instructions (BP3): guards, mode, weight, speed, tempo operators
- `()` = runtime instructions (dispatcher): vel, pan, wave, attack, release, filter, etc.
- Backticks: code evaluated by the symbol's runtime (implicit) or tagged (`sc:`, `py:`)

### Architecture
- `bp3-engine/` — Submodule: BP3 WASM engine ([roomi-fields/bp3-engine](https://github.com/roomi-fields/bp3-engine))
- `src/transpiler/` — Parser and compiler
  - `tokenizer.js` — Source text → token stream
  - `parser.js` — Tokens → AST (Scene, Directive, Rule, CVInstance, Macro, Polymetry)
  - `encoder.js` — AST → BP3 grammar text + flat alphabet + prototypes + settings
  - `prototypes.js` — Generates BP3 -so. prototype files for terminal durations
  - `index.js` — Facade: `compileBPS(source)` → `{ grammar, alphabetFile, prototypesFile, controlTable, cvTable, errors }`
  - `libs.js` — Library loader (JSON → controls, symbols, CV objects)
- `src/dispatcher/` — Clock, routing, transports
  - `dispatcher.js` — Event scheduling, control state, CV routing
  - `resolver.js` — Note name → frequency (alphabet + tuning + temperament)
  - `transports/webaudio.js` — Web Audio synthesis + CV buses
- `lib/` — JSON libraries (controls, alphabet, tuning, filter, routing, etc.)
- `web/index.html` — BPscript web interface (BPscript tab auto-compiles to Grammar tab)
- `dist/` — BP3 WASM build (bp3.js, bp3.wasm, bp3.data)
- `docs/` — Design documents
  - `BPSCRIPT_VISION.md` — Language specification (authoritative)
  - `BPSCRIPT_EBNF.md` — Formal grammar (EBNF)
  - `BPSCRIPT_AST.md` — AST node definitions
  - `DESIGN_ARCHITECTURE.md` — Technical architecture (pipeline, actors, transports, REPL)
  - `DESIGN_ACTOR.md` — Actor concept (binding alphabet+tuning+octaves+transport)
  - `DESIGN_PITCH.md` — Pitch resolution (5 layers: alphabet, octaves, temperament, tuning, resolver)

### Build & Test
```bash
cd bp3-engine
source /mnt/d/Claude/emsdk/emsdk_env.sh
make -f Makefile.emscripten
cd ..
python3 -m http.server 8080
# Open http://localhost:8080/web/index.html
```

### BPscript Compilation Pipeline
```
Source text → Tokenizer (tokens) → Parser (AST) → Encoder (BP3 grammar + flat alphabet + prototypes) → WASM engine
```

### Key conventions
- `[]` = engine (BP3): `[mode:random]`→RND, `[weight:50]`→`<50>`, `A[/2]`→`/2 A`, `{A B}[speed:2]`→`{2, A B}`
- `()` = runtime (dispatcher): `(vel:80)`→`_script(CT0)`, `(wave:sawtooth)`→`_script(CT1)`
- Direction: `->` (default L→R), `<-` (RIGHT→LEFT), `<>` (bidirectional)
- BP3 rule format: `gram#blockNum[ruleNum] MODE LHS --> RHS`
- Silence: `-` in both BPscript and BP3
- Tied notes: `~` in BPscript → `&` in BP3
- Flags: `[X==N]` → `/X=N/` (guard), `[X=N]` → `/X=N/` (mutation)
- Flat alphabet: no OCT, all terminals as custom bols. Notes prefixed `bol` (C4→bolC4) for BP3 compat.
- Block separator: `-----` between subgrammars with different modes

### RTFM — Indexed Knowledge Base

This project has been indexed with RTFM.

For any **exploratory search** (finding which files/modules/classes are relevant
to a topic), use `rtfm_search` instead of Glob, find, ls, or broad Grep.
Then use `rtfm_expand` to read easily most relevant files/sections.
