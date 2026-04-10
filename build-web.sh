#!/bin/bash
# Build BPscript web app into a self-contained public/ directory
# Usage: ./build-web.sh
# Output: public/ — ready to deploy (nginx, GitHub Pages, VPS, etc.)

set -e

OUT="public"

echo "Building BPscript web app → $OUT/"

# Clean
rm -rf "$OUT"
mkdir -p "$OUT"

# Copy web assets (index.html goes to root)
cp web/index.html "$OUT/index.html"
cp web/timeline.js "$OUT/timeline.js"
cp -r web/demos "$OUT/demos"
cp -r web/editor "$OUT/editor"
cp -r web/help "$OUT/help"

# Copy runtime sources
mkdir -p "$OUT/src/dispatcher/transports"
cp src/dispatcher/dispatcher.js "$OUT/src/dispatcher/"
cp src/dispatcher/clock.js "$OUT/src/dispatcher/"
cp src/dispatcher/resolver.js "$OUT/src/dispatcher/"
cp src/dispatcher/soundsResolver.js "$OUT/src/dispatcher/"
cp src/dispatcher/transports/webaudio.js "$OUT/src/dispatcher/transports/"
cp src/dispatcher/transports/midi.js "$OUT/src/dispatcher/transports/"
cp src/dispatcher/transports/osc.js "$OUT/src/dispatcher/transports/"

mkdir -p "$OUT/src/transpiler"
cp src/transpiler/index.js "$OUT/src/transpiler/"
cp src/transpiler/tokenizer.js "$OUT/src/transpiler/"
cp src/transpiler/parser.js "$OUT/src/transpiler/"
cp src/transpiler/encoder.js "$OUT/src/transpiler/"
cp src/transpiler/prototypes.js "$OUT/src/transpiler/"
cp src/transpiler/libs.js "$OUT/src/transpiler/"
cp src/transpiler/libs-data.js "$OUT/src/transpiler/"
cp src/transpiler/actorResolver.js "$OUT/src/transpiler/"
[ -f src/transpiler/validate-all.js ] && cp src/transpiler/validate-all.js "$OUT/src/transpiler/"

# Copy libraries
mkdir -p "$OUT/lib"
cp lib/*.json "$OUT/lib/"
[ -d lib/sounds ] && cp -r lib/sounds "$OUT/lib/sounds"
[ -d lib/tonality ] && cp -r lib/tonality "$OUT/lib/tonality"

# Copy WASM engine
mkdir -p "$OUT/dist"
cp dist/bp3.js "$OUT/dist/"
cp dist/bp3.wasm "$OUT/dist/"
[ -f dist/bp3.data ] && cp dist/bp3.data "$OUT/dist/"

# Copy scenes (Bernard originals)
[ -d dist/library ] && cp -r dist/library "$OUT/dist/library"

# Fix paths: ../src/ → ./src/, ../lib/ → ./lib/, ../dist/ → ./dist/
sed -i "s|\.\./src/|./src/|g" "$OUT/index.html"
sed -i "s|\.\./lib/|./lib/|g" "$OUT/index.html"
sed -i "s|\.\./dist/|./dist/|g" "$OUT/index.html"

echo ""
echo "Done. Output in $OUT/"
echo "  index.html    — entry point"
echo "  src/          — dispatcher + transpiler"
echo "  lib/          — JSON libraries"
echo "  dist/         — WASM engine"
echo "  demos/        — BPscript scenes"
echo ""
echo "Deploy: copy $OUT/ to your server root."
echo "  nginx: root /var/www/bpscript; (serves index.html at /)"
echo "  GitHub Pages: upload $OUT/ contents"
