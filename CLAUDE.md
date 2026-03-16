## BPscript — Meta-sequencer for Temporal Structure Composition

4 reserved words, 24 symbols, 7 operators. Compiles to BP3 grammar format and runs via WASM.
Orchestrates SC, TidalCycles, Python, MIDI, DMX, etc. in a single file via backticks.

### Language summary
- **4 words**: `gate`, `trigger`, `cv` (temporal types), `when` (guard)
- **24 structural symbols**: `@`, `->`, `<-`, `<>`, `{}`, `,`, `()`, `:`, `=`, `[]`, ``` `` ```, `//`, `-`, `_`, `.`, `...`, `!`, `<!`, `#`, `?`, `$`, `&`, `~`, `||`
- **7 flag operators**: `==`, `!=`, `>`, `<`, `>=`, `<=`, `+`
- **5 reserved qualifier keys**: `speed`, `scale`, `mode`, `weight`, `on_fail`
- **Double declaration**: each symbol has temporal type + runtime binding (`gate Sa:sc`)
- Silence: `-` in both BPscript and BP3
- Prolongation: `_` in both BPscript and BP3
- Period notation: `.` = equal-duration fragment separator (same as BP3)
- `!` = simultaneous event (any type: trigger, gate, cv, or flag mutation)
- `when` = declarative guard on rule (flag condition)
- Backticks: code evaluated by the symbol's runtime (implicit) or tagged (`sc:`, `py:`)

### Architecture
- `bp3-engine/` — Submodule: BP3 WASM engine ([roomi-fields/bp3-engine](https://github.com/roomi-fields/bp3-engine))
- `src/bpscript/` — Parser and compiler
  - `tokenizer.js` — Source text → token stream
  - `parser.js` — Tokens → AST (Program, Directive, Rule, Definition, Macro, Call, Polymetry)
  - `compiler.js` — AST → BP3 grammar text + alphabet + settings
  - `bpscript.js` — Facade: `compileBPScript(source)` → `{ grammar, alphabet, settings, errors, warnings }`
  - `errors.js` — Error types with line/col
- `web/index.html` — BPscript web interface (BPscript tab auto-compiles to Grammar tab)
- `dist/` — Deployable version (roomi-fields palette)
- `BPSCRIPT_VISION.md` — Full design document (authoritative)

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
Source text → Tokenizer (tokens) → Parser (AST) → Type-check → Macro-expansion → Encoder (BP3 grammar) → WASM engine
```

### Key conventions
- Mode mapping: `[mode:random]`→RND, `[mode:ord]`→ORD, `[mode:sub1]`→SUB1, `[mode:lin]`→LIN, `[mode:tem]`→TEM, `[mode:poslong]`→POSLONG
- Direction: `->` (default L→R), `<-` (RIGHT→LEFT), `<>` (bidirectional)
- BP3 rule format: `gram#blockNum[ruleNum] MODE LHS --> RHS`
- Silence: `-` in both BPscript and BP3
- Tied notes: `~` in BPscript → `&` in BP3
- Flags: `when X==N` → `/X=N/` (condition), `!X=N` → `/X=N/` (assignment)
- Speed: `{A B}[speed:2]` → `/2 A B` in BP3
- Block separator: `-----` between subgrammars with different modes

### RTFM — Indexed Knowledge Base

This project has been indexed with RTFM.

For any **exploratory search** (finding which files/modules/classes are relevant
to a topic), use `rtfm_search` instead of Glob, find, ls, or broad Grep.
Then use `rtfm_expand` to read easily most relevant files/sections.
