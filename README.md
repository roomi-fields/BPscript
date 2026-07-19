# BPScript — A Modern Language for the Bol Processor

**BPScript** is a research-driven composition language built on the **Bol Processor (BP3)** —
the formal music grammar system Bernard Bel and Jim Kippen have developed since 1981, originally
to model North Indian tabla improvisation.

BP3 has an unusually wide range of formal power: depending on which mechanisms are active, its
grammar spans context-free (Type 2) to context-sensitive (Type 1) and beyond — a tunable complexity
rather than a fixed class. It is also **bidirectional**: it can *generate* music and *recognize*
whether a sequence belongs to a musical language (PROD/ANAL modes), a reversibility rarely found in
music systems. Forty years of work gave it weighted stochastic grammars, native polymetry,
conditional flags, master/slave patterns, seven derivation modes, and dozens of performance-control
functions. TidalCycles cites it as an influence.

That power has always been locked behind a dense, archaic syntax and a 1990s C codebase.
**BPScript is the research effort to keep the formalism and modernize everything around it:**

- **A readable, typed language** — 3 reserved words, 24 symbols, 9 flag operators. Typed temporal
  primitives (`gate`, `trigger`, `cv`), scenes, actors, declarative I/O mappings.
- **Native code via backticks** — embed runtime-evaluated code (currently JS / Web Audio) alongside
  the temporal structure, in a single file.
- **Compiles to BP3** — the transpiler emits native BP3 grammar, so 40 years of derivation
  expertise are reused, not reinvented. The engine runs in the browser via **WebAssembly**.
- **An evolution path** — `BPx`, a next-generation reactive derivation engine designed to succeed
  BP3's batch C core (see the `BPx` repository: `../BPx/docs/ARCHITECTURE.md`).

> Try it online: **[roomi-fields.com/bpscript](https://roomi-fields.com/bpscript/)** — write BPScript,
> compile to a BP3 grammar, and derive it in the browser.

## Setup

```bash
git clone --recursive https://github.com/roomi-fields/BPscript.git
cd BPScript

# Recompile the engine (requires Emscripten + GCC + mingw)
cd bp3-engine
source /path/to/emsdk/emsdk_env.sh
./build.sh all --archive --version=v3.4.4-wasm.1
cd ..

# Run the regression gate (also wired to pre-push)
npm run arch && npm run typecheck && npm run verify
```

## Structure

```
bp3-engine/          BP3 WASM engine (submodule roomi-fields/bp3-engine, branch wasm)
src/
  transpiler/        Tokenizer, parser, encoder (BPScript → BP3 grammar)
  bpx/               BPx engine stub (next-generation derivation engine)
lib/                 JSON libraries (controls, alphabets, tunings, filter, routing)
dist/                BP3 WASM binaries (bp3.js, bp3.wasm, bp3.data)
test/                Test infrastructure S0→S5 (36 reference grammars)
docs/                Specification, design, and reference documentation
scenes/              Example .bps files
```

## Pipeline

```
Source .bps → Tokenizer → Parser (AST) → Encoder → BP3 grammar + alphabet + prototypes
                                                          ↓
                                              BP3 WASM engine (produce)
                                                          ↓
                                                    Timed tokens
```

The timed tokens are the language's output. A downstream runtime (scheduler, audio,
MIDI/OSC) consumes them — out of scope for this repository.

## Test

Prerequisite: build the engine with `./build.sh all --archive` (see Setup).

The regression gate is three npm scripts, wired to `pre-push` — a push is refused if any bites:

| Command | What it guards |
|---------|----------------|
| `npm run arch` | dependency structure + freshness of the bundled libraries |
| `npm run typecheck` | types of the `digital` / `homomorphism` libraries |
| `npm run verify` | AST_SPEC conformance of the whole corpus + tempo operator emission |

```bash
npm run arch && npm run typecheck && npm run verify

# Complementary suites, run by hand when you touch their surface
node test/scan_corpus.mjs        # BP3 -> BPScript -> BP3 round-trip
node test/voie_b_status.mjs      # comparison against the native baseline, AT THE END OF THE CHAIN
```

> The old `S0-S5` staged pipeline (`test_all.cjs`, `runner.cjs`, the `sN` steps) was **removed on
> 2026-07-19**. Nothing live invoked it, but it stayed readable and kept being mistaken for the
> current procedure. See `test/README.md`.

The 36 reference grammars live in `test/grammars/grammars.json`. Each stage's snapshots
are in `test/grammars/{name}/snapshots/`.

Detailed results: `test/RESULTATS.md`
Open points with Bernard: `test/FEEDBACK_BERNARD.md`

## Documentation

Start with `docs/INDEX.md` (full index). Highlights:

- `docs/spec/LANGUAGE.md` — complete language specification
- `docs/spec/EBNF.md` — formal grammar (ISO 14977)
- `docs/spec/AST.md` — AST node reference
- `docs/design/ARCHITECTURE.md` — compilation pipeline
- `../BPx/docs/ARCHITECTURE.md` — next-generation BPx engine (separate repository)
- `docs/reference/BP3_FILE_FORMATS.md` — BP3 auxiliary file formats
- `BACKLOG.md` — open points and backlog
