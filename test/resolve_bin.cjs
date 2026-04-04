#!/usr/bin/env node
/**
 * resolve_bin.cjs — Shared --bin resolution for all test scripts.
 *
 * --bin is MANDATORY. Only accepts version tags (e.g. v3.3.19, v3.3.18-wasm.1).
 * Special value "last" reads from bp3-engine/builds/LAST.
 *
 * Resolution: tag → bp3-engine/builds/{tag}/
 */
const fs = require('fs');
const path = require('path');

const BP3_DIR = path.resolve(__dirname, '..', '..', 'bp3-engine');
const BUILDS_DIR = path.resolve(BP3_DIR, 'builds');
const LAST_FILE = path.resolve(BUILDS_DIR, 'LAST');

function readLast() {
  if (!fs.existsSync(LAST_FILE)) {
    console.error('ERROR: No builds/LAST file found. Run build.sh --archive first.');
    process.exit(1);
  }
  return fs.readFileSync(LAST_FILE, 'utf8').trim();
}

/**
 * Parse --bin from process.argv. Exits if missing.
 * Returns the resolved version tag string.
 */
function requireBinTag() {
  const idx = process.argv.indexOf('--bin');
  if (idx < 0 || idx + 1 >= process.argv.length) {
    const script = path.basename(process.argv[1] || 'script');
    console.error(`ERROR: --bin <version> is required.\n  Usage: node ${script} <grammar> --bin <tag>\n  Use --bin last for latest working version.`);
    process.exit(1);
  }
  let tag = process.argv[idx + 1];
  if (tag === 'last') tag = readLast();
  return tag;
}

/**
 * Resolve tag to a binary file path (for s0/s1: bp.exe, bp3).
 * @param {string} tag - Version tag
 * @param {string} filename - 'bp3' or 'bp.exe'
 * @returns {string} Full path to binary
 */
function resolveBin(tag, filename) {
  const dir = path.resolve(BUILDS_DIR, tag);
  if (!fs.existsSync(dir)) {
    console.error(`--bin: version directory not found: ${dir}`);
    process.exit(1);
  }
  const full = path.join(dir, filename);
  if (!fs.existsSync(full)) {
    console.error(`--bin: binary not found: ${full}`);
    process.exit(1);
  }
  return full;
}

/**
 * Resolve tag to a WASM directory (for s2/s4/s5).
 * Verifies bp3.js exists in the directory.
 * @param {string} tag - Version tag
 * @returns {string} Full path to directory containing bp3.js
 */
function resolveDist(tag) {
  const dir = path.resolve(BUILDS_DIR, tag);
  if (!fs.existsSync(dir)) {
    console.error(`--bin: version directory not found: ${dir}`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(dir, 'bp3.js'))) {
    console.error(`--bin: bp3.js not found in ${dir}`);
    process.exit(1);
  }
  return dir;
}

/**
 * Strip --bin and its value from an argv array.
 */
function stripBinArgs(argv) {
  return argv.filter((a, i, arr) => a !== '--bin' && arr[i - 1] !== '--bin');
}

module.exports = { requireBinTag, resolveBin, resolveDist, stripBinArgs, BP3_DIR, BUILDS_DIR };
