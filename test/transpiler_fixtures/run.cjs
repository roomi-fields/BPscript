#!/usr/bin/env node
// Compile a .bps fixture and run on the v3.4.2-wasm.2 engine.
// Reports: parse errors, compiled grammar, raw engine output.
//
// Usage: node test/transpiler_fixtures/run.cjs <fixture-name> [--bin <version>]

const fs = require('fs');
const path = require('path');
const { requireBinTag, resolveDist, stripBinArgs } = require('../resolve_bin.cjs');

const argv = stripBinArgs(process.argv.slice(2));
const name = argv[0];
if (!name) {
  console.error('Usage: node run.cjs <fixture-name> [--bin <version>]');
  process.exit(1);
}
const binTag = requireBinTag();
const DIST = resolveDist(binTag);
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(__dirname, `${name}.bps`);
if (!fs.existsSync(SRC)) { console.error(`Not found: ${SRC}`); process.exit(1); }
const TMP = `/tmp/_fixture_${name}`;

const compileScript = `
import { compileBPS } from '${path.join(ROOT, 'src/transpiler/index.js').replace(/\\\\/g, '/')}';
import { readFileSync, writeFileSync } from 'fs';
const src = readFileSync('${SRC.replace(/\\\\/g, '/')}', 'utf-8');
const r = compileBPS(src);
writeFileSync('${TMP}_gr.txt', r.grammar || '');
writeFileSync('${TMP}_al.txt', r.alphabetFile || (Array.isArray(r.alphabet) ? r.alphabet.join('\\n') : ''));
writeFileSync('${TMP}_se.txt', r.settingsJSON || '{}');
writeFileSync('${TMP}_ct.json', JSON.stringify(r.controlTable || []));
writeFileSync('${TMP}_errors.json', JSON.stringify(r.errors || []));
`;
fs.writeFileSync(`${TMP}_compile.mjs`, compileScript);
const { execSync } = require('child_process');
try {
  execSync(`node ${TMP}_compile.mjs`, { stdio: 'inherit' });
} catch (e) {
  console.error('Compile failed:', e.message);
  process.exit(1);
}

const errors = JSON.parse(fs.readFileSync(`${TMP}_errors.json`, 'utf-8'));
console.log('--- ERRORS ---');
console.log(errors.length === 0 ? '(none)' : JSON.stringify(errors, null, 2));
console.log('--- GRAMMAR ---');
console.log(fs.readFileSync(`${TMP}_gr.txt`, 'utf-8'));
console.log('--- CONTROL TABLE ---');
console.log(fs.readFileSync(`${TMP}_ct.json`, 'utf-8'));
console.log('--- ENGINE RUN ---');

const runScript = `
process.chdir('${DIST.replace(/\\\\/g, '/')}');
const fs = require('fs');
const settings = fs.readFileSync('${TMP}_se.txt', 'utf-8');
const alphabet = fs.readFileSync('${TMP}_al.txt', 'utf-8');
const grammar = fs.readFileSync('${TMP}_gr.txt', 'utf-8');
require('${DIST.replace(/\\\\/g, '/')}/bp3.js')().then(M => {
  M.cwrap('bp3_init', 'number', [])();
  M.cwrap('bp3_load_settings', 'number', ['string'])(settings);
  M.cwrap('bp3_set_seed', 'void', ['number'])(1);
  M.cwrap('bp3_load_alphabet', 'number', ['string'])(alphabet);
  M.cwrap('bp3_load_grammar', 'number', ['string'])(grammar);
  M.cwrap('bp3_produce', 'number', [])();
  console.log('RAW:', M.cwrap('bp3_get_result', 'string', [])().trim());
}).catch(e => { console.error(e); process.exit(1); });
`;
fs.writeFileSync(`${TMP}_run.cjs`, runScript);
try {
  execSync(`node ${TMP}_run.cjs 2>&1`, { stdio: 'inherit' });
} catch (e) {
  console.error('Engine run failed:', e.message);
  process.exit(1);
}
