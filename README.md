# BPscript — Meta-sequencer for Temporal Structure Composition

3 reserved words, 24 symbols, 7 operators. Compiles to BP3 grammar format and runs via WebAssembly.
Orchestrates SuperCollider, TidalCycles, Python, MIDI, DMX in a single file.

## Setup

```bash
git clone --recursive https://github.com/roomi-fields/BPscript.git
cd BPscript

# L'interface web fonctionne directement (dist/ contient les binaires WASM)
python3 -m http.server 8080
# Open http://localhost:8080/web/index.html

# Pour recompiler le moteur (requires Emscripten + GCC + mingw)
cd bp3-engine
source /path/to/emsdk/emsdk_env.sh
./build.sh all --archive --version=v3.3.19-wasm.1
cd ..

# Lancer les tests de non-régression
node test/test_all.cjs --bin last
```

## Structure

```
bp3-engine/          BP3 WASM engine (submodule roomi-fields/bp3-engine, branche wasm)
src/
  transpiler/        Tokenizer, parser, encoder (BPscript → BP3 grammar)
  dispatcher/        Clock, routing, Web Audio synthesis, CV buses
lib/                 JSON libraries (controls, alphabet, tuning, filter, routing)
web/                 BPscript web interface
dist/                BP3 WASM binaries (bp3.js, bp3.wasm, bp3.data)
test/                Test infrastructure S0→S5 (36 grammaires de référence)
docs/                Design documents
scenes/              Example .bps files
```

## Pipeline

```
Source .bps → Tokenizer → Parser (AST) → Encoder → BP3 grammar + alphabet + prototypes
                                                          ↓
                                              BP3 WASM engine (produce)
                                                          ↓
                                              Timed tokens → Dispatcher → Audio
```

## Test

Prérequis : avoir compilé le moteur avec `./build.sh all --archive` (voir Setup).

Les tests comparent la production du moteur BP3 à travers 6 stages :

| Stage | Source | Description |
|-------|--------|-------------|
| S0 | bp.exe (Windows) | Référence PHP de Bernard |
| S1 | bp3 (Linux natif) | Même moteur, autre plateforme |
| S2 | bp3.wasm | MIDI events depuis le WASM |
| S3 | bp3.wasm | Timed tokens depuis p_Instance |
| S4 | bp3.wasm | Comme S3 avec silent sound objects |
| S5 | transpiler + bp3.wasm | Pipeline BPscript complet |

```bash
# Lancer tous les tests (nécessite --bin)
node test/test_all.cjs --bin last

# Tester une grammaire spécifique
node test/s1_native.cjs drum --bin last
node test/s4_wasm_silent.cjs drum --bin last

# Le tag "last" lit builds/LAST dans bp3-engine
```

Les 36 grammaires de référence sont dans `test/grammars/grammars.json`. Les snapshots de chaque stage sont dans `test/grammars/{name}/snapshots/`.

Résultats détaillés : `test/RESULTATS.md`
Points ouverts Bernard : `test/FEEDBACK_BERNARD.md`

## Documentation

- `docs/BPSCRIPT_VISION.md` — Vue d'ensemble
- `docs/DESIGN_LANGUAGE.md` — Spécification du langage
- `docs/BPSCRIPT_EBNF.md` — Grammaire formelle
- `docs/DESIGN_GRAMMAR.md` — Mapping BPscript → BP3
- `docs/DESIGN_ARCHITECTURE.md` — Architecture technique
- `BACKLOG.md` — Points ouverts et backlog
