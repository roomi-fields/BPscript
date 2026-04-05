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
  - `BPSCRIPT_VISION.md` — Project overview and document index
  - `DESIGN_LANGUAGE.md` — Language specification (symbols, types, declarations, macros, flags, templates)
  - `DESIGN_GRAMMAR.md` — BPscript → BP3 grammar mapping (rules, modes, subgrammars)
  - `BPSCRIPT_EBNF.md` — Formal grammar (EBNF)
  - `BPSCRIPT_AST.md` — AST node definitions
  - `DESIGN_ARCHITECTURE.md` — Technical architecture (pipeline, actors, transports, REPL)
  - `DESIGN_ACTOR.md` — Actor concept (binding alphabet+tuning+octaves+transport)
  - `DESIGN_PITCH.md` — Pitch resolution (5 layers: alphabet, octaves, temperament, tuning, resolver)
  - `DESIGN_CV.md` — CV/signal objects (ADSR, LFO, ramp)
  - `DESIGN_SOUNDS.md` — Sounds system (spec < CT < CV cascading)
  - `DESIGN_EFFECTS.md` — Effects and signal processing
  - `DESIGN_REPL.md` — REPL adapters and backtick architecture
  - `DESIGN_INTERFACES_BP3.md` — BP3 WASM interface (in/out specification)

### Changelogs moteur (OBLIGATOIRE)
Après toute modification dans `bp3-engine/csrc/`:
- `csrc/bp3/` (moteur Bernard) → mettre à jour `bp3-engine/CHANGELOG_ENGINE.md`
- `csrc/wasm/` (portage WASM) → mettre à jour `bp3-engine/CHANGELOG_WASM.md`
- Nouveau bug/issue identifié → ajouter dans `test/FEEDBACK_BERNARD.md`

### Build & Test
```bash
# OBLIGATOIRE : utiliser build.sh, JAMAIS make directement ni cp manuellement
cd bp3-engine
source /mnt/d/Claude/emsdk/emsdk_env.sh
./build.sh all                                    # compile 3 targets (linux, windows, wasm)
./build.sh all --archive --version=v3.3.19-wasm.2 # compile + archive
cd ..

# Tests de non-régression (36 grammaires actives)
node test/test_all.cjs --bin last     # S1 + S2/S3 + comparaisons
# Voir test/README.md pour les détails des stages S0→S5
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

### Sessions parallèles — Rôles par nom de session

Si tu es lancé avec un nom de session (`-n`), lis immédiatement les fichiers mémoire correspondants pour récupérer tout le contexte accumulé.

**Session `moteur-wasm`** — Moteur BP3 WASM, tests e2e, conformité scènes
- Lis : `memory/session_2026_03_22.md`, `memory/session_2026_03_22b.md`, `memory/bpweb_engine.md`
- Focus : bugs moteur, pipeline WASM (bp3_api.c, stubs), test_wasm_all.js, CONFORMITY.md, aux files

**Session `transpileur`** — Parser, encoder, resolver, sounds
- Lis : `memory/session_2026_03_22.md`, `memory/session_2026_03_17.md`, `memory/session_2026_03_17b.md`
- Focus : tokenizer.js, parser.js, encoder.js, resolver.js, soundsResolver.js, lib/*.json, test/

**Session `architecture`** — Design langage, pitch, acteurs, REPL, effets
- Lis : `memory/session_2026_03_21.md`, `memory/session_2026_03_18.md`, `memory/design_actor.md`, `memory/design_pitch_architecture.md`
- Focus : docs/DESIGN_*.md, lib/alphabets.json, lib/tunings.json, lib/temperaments.json, concepts acteurs/REPL/effets

Après lecture des fichiers mémoire, fais un résumé de ce que tu sais pour confirmer que tu as le contexte.

### RTFM — Indexed Knowledge Base

This project has been indexed with RTFM.

For any **exploratory search** (finding which files/modules/classes are relevant
to a topic), use `rtfm_search` instead of Glob, find, ls, or broad Grep.
Then use `rtfm_expand` to read easily most relevant files/sections.
