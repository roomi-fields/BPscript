# BPscript — Minimal Language for Bol Processor

BPscript is a minimal language (9 symbols, zero reserved words) that compiles to BP3 grammar format. It runs the BP3 engine in the browser via WebAssembly.

See [BPSCRIPT_VISION.md](BPSCRIPT_VISION.md) for the full design document.

## Setup
```bash
git clone --recursive https://github.com/roomi-fields/BPscript.git
cd BPscript/bp3-engine
source /path/to/emsdk/emsdk_env.sh
make -f Makefile.emscripten
cd ..
python3 -m http.server 8080
# Open http://localhost:8080/web/index.html
```

## Structure
- `bp3-engine/` — BP3 WASM engine (submodule)
- `src/bpscript/` — Parser and compiler
- `web/` — BPscript web interface
- `dist/` — Deployable version
