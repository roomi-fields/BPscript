#!/bin/bash
# Build BP3 WASM from Bernard's sources + our WASM layer
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/../dist"
BP3_REPO="https://github.com/bolprocessor/bolprocessor.git"
BP3_BRANCH="graphics-for-BP3"
TMP_DIR="/tmp/bp3-build-$$"

echo "Cloning BP3 sources..."
git clone --depth 1 --branch "$BP3_BRANCH" "$BP3_REPO" "$TMP_DIR" 2>/dev/null

echo "Building WASM..."
mkdir -p "$BUILD_DIR"

# Use Bernard's sources + our WASM layer
make -f "$SCRIPT_DIR/Makefile.emscripten" \
    BP3_SRC="$TMP_DIR/source/BP3" \
    WASM_SRC="$SCRIPT_DIR" \
    BUILD_DIR="$BUILD_DIR" \
    clean all

echo "Cleaning up..."
rm -rf "$TMP_DIR"

echo "Build complete: $BUILD_DIR/bp3.{js,wasm,data}"
