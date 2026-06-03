/**
 * Test : encoder emits `[scale:N]` polymetric qualifier as BP3 native
 * `*N` (scale up) / `**M` (scale down) prefix on `{...}` braces.
 *
 * Ports the BP3 textual scaling markers from Encode.c:102-117 and the
 * consumer in Polymetric.c:229-244, 293-302 — distinct from speed/_tempo.
 *
 * Run: node test/test_scale_qualifier.js
 */

import { readFileSync } from 'fs';
import { compileBPS } from '../src/transpiler/index.js';
import { registerAll } from '../src/transpiler/libs.js';

const libs = {};
for (const name of ['alphabets', 'controls', 'octaves', 'tunings', 'temperaments', 'settings']) {
  libs[name] = JSON.parse(readFileSync(`lib/${name}.json`, 'utf8'));
}
registerAll(libs);

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, details) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push({ label, details: details || '' });
    console.error(`  FAIL: ${label}${details ? ` — ${details}` : ''}`);
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

function compile(src) {
  return compileBPS(src);
}

// ----------------------------------------------------------
// 1. [scale:2] on polymetric → `*2 {...}` prefix
// ----------------------------------------------------------

section('[scale:N] polymetric qualifier — N >= 1 → *N prefix');

{
  const src = `@core
@alphabet.western:midi
@mm:60
@striated

@mode:ord
S -> {C4, D4}[scale:2]
`;
  const r = compile(src);
  assert('compile ok (no errors)', r.errors.length === 0, JSON.stringify(r.errors));
  assert('grammar contains *2 prefix', r.grammar && r.grammar.includes('*2 {C4,D4}'),
    `got: ${JSON.stringify(r.grammar)}`);
  // Regression guard for bug #79: encoder used to drop [scale:N], emitting
  // just `{C4,D4}` with no scaling marker. We assert the marker is present.
  assert('scaling marker emitted (no longer dropped)',
    r.grammar && /\*2\s+\{C4,D4\}/.test(r.grammar),
    `got: ${JSON.stringify(r.grammar)}`);
}

// ----------------------------------------------------------
// 2. [scale:3] integer
// ----------------------------------------------------------

{
  const src = `@core
@alphabet.western:midi
@mm:60
@striated

@mode:ord
S -> {C4, D4, E4}[scale:3]
`;
  const r = compile(src);
  assert('scale:3 compile ok', r.errors.length === 0, JSON.stringify(r.errors));
  assert('grammar contains *3 prefix', r.grammar && r.grammar.includes('*3 {C4,D4,E4}'),
    `got: ${JSON.stringify(r.grammar)}`);
}

// ----------------------------------------------------------
// 3. [speed:N] still works (no regression on neighbour code path)
// ----------------------------------------------------------

section('[speed:N] still works (regression guard)');

{
  const src = `@core
@alphabet.western:midi
@mm:60
@striated

@mode:ord
S -> {C4, D4}[speed:2]
`;
  const r = compile(src);
  assert('speed compile ok', r.errors.length === 0, JSON.stringify(r.errors));
  assert('grammar contains {2,C4,D4}', r.grammar && r.grammar.includes('{2,C4,D4}'),
    `got: ${JSON.stringify(r.grammar)}`);
}

// ----------------------------------------------------------
// Summary
// ----------------------------------------------------------

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.label}${f.details ? ': ' + f.details : ''}`);
  process.exit(1);
}
