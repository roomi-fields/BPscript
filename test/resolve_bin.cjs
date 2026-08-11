#!/usr/bin/env node
/**
 * resolve_bin.cjs — Shared --bin resolution for all test scripts.
 *
 * --bin is MANDATORY. Only accepts version tags (e.g. v3.3.19).
 * Special value "last" reads from bp3-engine/builds/LAST.
 *
 * Resolution: tag → bp3-engine/builds/{tag}/
 */
const fs = require('fs');
const path = require('path');

// bp3-engine a cessé d'être un sous-module de BPscript le 2026-06-14 (hub/decisions/
// 2026-06-14-desubmodule-bp3-engine.md) : le sibling (../bp3-engine/) est devenu l'UNIQUE
// dépôt moteur canonique. Le test ci-dessous garde un ordre de résolution à deux branches
// (submodule puis sibling), mais la branche submodule est morte : BPscript/bp3-engine
// n'existe plus sur le disque, elle ne peut plus jamais matcher.
const submodule = path.resolve(__dirname, '..', 'bp3-engine');
const sibling = path.resolve(__dirname, '..', '..', 'bp3-engine');
const BP3_DIR = fs.existsSync(path.join(submodule, 'builds')) ? submodule : sibling;
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

// `resolveDist` A ÉTÉ SUPPRIMÉ le 2026-08-11, avec son unique appelant
// (`test/transpiler_fixtures/run.cjs`) : il résolvait un répertoire de build WASM, et le WASM sort
// de toute la tour (décision de Romain). Son appelant était d'ailleurs mort en silence bien avant —
// il lisait `r.grammar` et `r.alphabetFile` sur le résultat de `compileToBPxAST`, qui n'a que
// `ast`, `errors`, `warnings` : il écrivait des fichiers vides sans que rien ne le dise.
// `resolveBin`, lui, résout le binaire NATIF et reste.

/**
 * Strip --bin and its value from an argv array.
 */
function stripBinArgs(argv) {
  return argv.filter((a, i, arr) => a !== '--bin' && arr[i - 1] !== '--bin');
}

module.exports = { requireBinTag, resolveBin, stripBinArgs, BP3_DIR, BUILDS_DIR };
