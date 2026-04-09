/**
 * Test: Actor system — parser, actorResolver, encoder, dispatcher
 *
 * Run: node test/test_actors.js
 */

import { readFileSync } from 'fs';
import { compileBPS } from '../src/transpiler/index.js';
import { resolveActors, expandAlphabetTerminals } from '../src/transpiler/actorResolver.js';
import { loadLib, registerAll, clearRegistry } from '../src/transpiler/libs.js';
import { tokenize } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';
import { Dispatcher } from '../src/dispatcher/dispatcher.js';

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

// ── Pre-register libs ─────────────────────────────────────

const libs = {};
for (const name of ['alphabets', 'controls', 'octaves', 'tunings', 'temperaments', 'settings']) {
  libs[name] = JSON.parse(readFileSync(`lib/${name}.json`, 'utf8'));
}
registerAll(libs);

// ══════════════════════════════════════════════════════════
// 1. expandAlphabetTerminals
// ══════════════════════════════════════════════════════════

section('expandAlphabetTerminals');

const tablaTerminals = expandAlphabetTerminals(libs.alphabets.tabla);
assert('tabla has dhin', tablaTerminals.has('dhin'));
assert('tabla has dha', tablaTerminals.has('dha'));
assert('tabla has ge', tablaTerminals.has('ge'));
assert('tabla no octave variants', !tablaTerminals.has('dhin4'));
assert('tabla count = 38', tablaTerminals.size === libs.alphabets.tabla.notes.length);

const sargamTerminals = expandAlphabetTerminals(libs.alphabets.sargam);
assert('sargam has octave variants', sargamTerminals.size > 7);
// saptak: prefix, separator=' ', registers=[mandra, madhya, taar]
// alterations: komal, '', tivra → 3 per note × 7 notes × 3 registers = 63
assert('sargam count = 63', sargamTerminals.size === 63);
assert('sargam has "madhya sa"', sargamTerminals.has('madhya sa'));
assert('sargam has "taar rekomal"', sargamTerminals.has('taar rekomal'));

const westernTerminals = expandAlphabetTerminals(libs.alphabets.western);
assert('western has C4', westernTerminals.has('C4'));
assert('western has F#7', westernTerminals.has('F#7'));
assert('western has Bb2', westernTerminals.has('Bb2'));

// ══════════════════════════════════════════════════════════
// 2. No actors — retrocompat
// ══════════════════════════════════════════════════════════

section('No actors (retrocompat)');

const r1 = compileBPS('@controls\nS -> A B C');
assert('no errors', r1.errors.length === 0);
assert('actorTable empty', Object.keys(r1.actorTable).length === 0);
assert('terminalActorMap empty', Object.keys(r1.terminalActorMap).length === 0);
assert('grammar correct', r1.grammar.includes('S --> A B C'));

// ══════════════════════════════════════════════════════════
// 3. Single actor — dot notation
// ══════════════════════════════════════════════════════════

section('Single actor — dot notation');

const r2 = compileBPS(`@controls
@actor tabla alphabet:tabla transport:midi(ch:10)
S -> tabla.dhin tabla.dha tabla.ge`);

assert('no errors', r2.errors.length === 0);
assert('actorTable has tabla', !!r2.actorTable.tabla);
assert('tabla alphabet = tabla', r2.actorTable.tabla.alphabet === 'tabla');
assert('tabla transport key = midi', r2.actorTable.tabla.transport.key === 'midi');
assert('tabla transport ch = 10', r2.actorTable.tabla.transport.params.ch === 10);
assert('dhin → tabla', r2.terminalActorMap.dhin === 'tabla');
assert('dha → tabla', r2.terminalActorMap.dha === 'tabla');
assert('ge → tabla', r2.terminalActorMap.ge === 'tabla');
assert('grammar has terminals', r2.grammar.includes('S --> dhin dha ge'));

// ══════════════════════════════════════════════════════════
// 4. Single actor — implicit resolution
// ══════════════════════════════════════════════════════════

section('Single actor — implicit resolution');

const r3 = compileBPS(`@controls
@actor tabla alphabet:tabla transport:midi(ch:10)
S -> dhin dha ge ka`);

assert('no errors', r3.errors.length === 0);
assert('dhin → tabla (implicit)', r3.terminalActorMap.dhin === 'tabla');
assert('ka → tabla (implicit)', r3.terminalActorMap.ka === 'tabla');

// ══════════════════════════════════════════════════════════
// 5. Two actors — different alphabets (no ambiguity)
// ══════════════════════════════════════════════════════════

section('Two actors — different alphabets');

const r4 = compileBPS(`@controls
@actor sitar alphabet:sargam transport:midi(ch:3)
@actor tabla alphabet:tabla transport:midi(ch:10)
S -> dhin dha ge ka`);

assert('no errors', r4.errors.length === 0);
assert('dhin → tabla', r4.terminalActorMap.dhin === 'tabla');
assert('dha → tabla', r4.terminalActorMap.dha === 'tabla');
// sargam terminals have spaces (saptak convention), so no overlap with tabla raw bols

// ══════════════════════════════════════════════════════════
// 6. Two actors — same alphabet (ambiguity)
// ══════════════════════════════════════════════════════════

section('Two actors — same alphabet (ambiguity)');

const r5 = compileBPS(`@controls
@actor piano alphabet:western transport:midi(ch:1)
@actor synth alphabet:western transport:midi(ch:2)
S -> C4 D4 E4`);

assert('3 ambiguity errors', r5.errors.length === 3);
assert('error mentions piano', r5.errors[0].message.includes('piano'));
assert('error mentions synth', r5.errors[0].message.includes('synth'));
assert('error suggests dot notation', r5.errors[0].message.includes('piano.C4'));

// ══════════════════════════════════════════════════════════
// 7. Ambiguity resolved with dot notation
// ══════════════════════════════════════════════════════════

section('Ambiguity resolved — dot notation');

const r6 = compileBPS(`@controls
@actor piano alphabet:western transport:midi(ch:1)
@actor synth alphabet:western transport:midi(ch:2)
S -> piano.C4 synth.D4 piano.E4`);

assert('no errors', r6.errors.length === 0);
assert('C4 → piano', r6.terminalActorMap.C4 === 'piano');
assert('D4 → synth', r6.terminalActorMap.D4 === 'synth');
assert('E4 → piano', r6.terminalActorMap.E4 === 'piano');

// ══════════════════════════════════════════════════════════
// 8. Ambiguity resolved with declaration
// ══════════════════════════════════════════════════════════

section('Ambiguity resolved — declaration');

const r7 = compileBPS(`@controls
@actor piano alphabet:western transport:midi(ch:1)
@actor synth alphabet:western transport:midi(ch:2)
gate C4:piano
gate D4:synth
gate E4:piano
S -> C4 D4 E4`);

assert('no errors', r7.errors.length === 0);
assert('C4 → piano (decl)', r7.terminalActorMap.C4 === 'piano');
assert('D4 → synth (decl)', r7.terminalActorMap.D4 === 'synth');
assert('E4 → piano (decl)', r7.terminalActorMap.E4 === 'piano');

// ══════════════════════════════════════════════════════════
// 9. Mixed: actor + non-actor symbols
// ══════════════════════════════════════════════════════════

section('Mixed actor + non-actor symbols');

const r8 = compileBPS(`@controls
@actor tabla alphabet:tabla transport:midi(ch:10)
S -> dhin X dha Y`);

assert('no errors', r8.errors.length === 0);
assert('dhin → tabla', r8.terminalActorMap.dhin === 'tabla');
assert('X not in map', !r8.terminalActorMap.X);
assert('Y not in map', !r8.terminalActorMap.Y);

// ══════════════════════════════════════════════════════════
// 10. Actor in polymetric
// ══════════════════════════════════════════════════════════

section('Actor in polymetric');

const r9 = compileBPS(`@controls
@actor tabla alphabet:tabla transport:midi(ch:10)
S -> {tabla.dhin tabla.dha, tabla.ge tabla.ka}`);

assert('no errors', r9.errors.length === 0);
assert('dhin → tabla', r9.terminalActorMap.dhin === 'tabla');
assert('ge → tabla', r9.terminalActorMap.ge === 'tabla');
assert('grammar has polymetric', r9.grammar.includes('{') && r9.grammar.includes(','));

// ══════════════════════════════════════════════════════════
// 11. @cc directive
// ══════════════════════════════════════════════════════════

section('@cc directive');

const r10 = compileBPS(`@controls
@cc breath:2, expression:11
S -> A(breath:100) B(expression:64) C`);

assert('no errors', r10.errors.length === 0);
assert('2 CT entries', r10.controlTable.length === 2);
assert('CT0 has breath=100', r10.controlTable[0].assignments.breath === 100);
assert('CT1 has expression=64', r10.controlTable[1].assignments.expression === 64);
assert('grammar has _script', r10.grammar.includes('_script(CT 0)'));

// ══════════════════════════════════════════════════════════
// 12. cc() generic
// ══════════════════════════════════════════════════════════

section('cc() generic');

const r11 = compileBPS(`@controls
S -> A(cc:74,80) B C`);

assert('no errors', r11.errors.length === 0);
assert('1 CT entry', r11.controlTable.length === 1);
assert('CT0 has cc=74,80', r11.controlTable[0].assignments.cc === '74,80');

// ══════════════════════════════════════════════════════════
// 13. Period vs dot notation disambiguation
// ══════════════════════════════════════════════════════════

section('Period vs dot notation');

// No actor → period notation
const r12 = compileBPS(`@controls\nS -> A . B . C`);
assert('no actor: grammar has periods', r12.grammar.includes('A . B . C'));
assert('no actor: no errors', r12.errors.length === 0);

// With actor → dot notation
const r13 = compileBPS(`@controls
@actor t alphabet:tabla transport:midi(ch:10)
S -> t.dhin . t.dha`);
assert('with actor: dhin resolved', r13.terminalActorMap.dhin === 't');
assert('with actor: period preserved', r13.grammar.includes('. dha'));

// Non-actor IDENT.IDENT → period
const r14 = compileBPS(`@controls\nS -> X.Y Z`);
assert('non-actor dot: period', r14.grammar.includes('X . Y Z'));

// ══════════════════════════════════════════════════════════
// 14. Dispatcher actor routing
// ══════════════════════════════════════════════════════════

section('Dispatcher actor routing');

const mockAudioCtx = { state: 'running', currentTime: 0 };
const d = new Dispatcher(mockAudioCtx);

// Set actors
d.setActors(
  {
    sitar: { alphabet: 'sargam', transport: { key: 'midi', params: { ch: 3 } } },
    tabla: { alphabet: 'tabla', transport: { key: 'midi', params: { ch: 10 } } },
  },
  { sa4: 'sitar', re4: 'sitar', dhin: 'tabla', dha: 'tabla' }
);

assert('2 actors registered', Object.keys(d._actors).length === 2);
assert('sa4 → sitar', d._terminalActorMap.sa4 === 'sitar');
assert('dhin → tabla', d._terminalActorMap.dhin === 'tabla');

// Per-actor resolver
const sitarResolver = { transposeToken: (t) => t, rotateToken: (t) => t, keyxpandToken: (t) => t, _id: 'sitar' };
const tablaResolver = { transposeToken: (t) => t, rotateToken: (t) => t, keyxpandToken: (t) => t, _id: 'tabla' };
d.setActorResolver('sitar', sitarResolver);
d.setActorResolver('tabla', tablaResolver);

assert('sa4 uses sitar resolver', d._resolverForToken('sa4')._id === 'sitar');
assert('dhin uses tabla resolver', d._resolverForToken('dhin')._id === 'tabla');
assert('unknown uses global (null)', d._resolverForToken('X') === null);

// Set global resolver as fallback
d._resolver = { _id: 'global', transposeToken: (t) => t, rotateToken: (t) => t, keyxpandToken: (t) => t };
assert('unknown uses global fallback', d._resolverForToken('X')._id === 'global');
assert('sa4 still uses sitar', d._resolverForToken('sa4')._id === 'sitar');

// Per-actor transport
d.addTransport('midi_sitar', { send: () => {}, close: () => {} });
d.addTransport('midi_tabla', { send: () => {}, close: () => {} });
d.addTransport('default', { send: () => {}, close: () => {} });
d.setActorTransport('sitar', 'midi_sitar');
d.setActorTransport('tabla', 'midi_tabla');

const tSitar = d._transportForToken('sa4');
const tTabla = d._transportForToken('dhin');
const tDefault = d._transportForToken('X');
assert('sa4 → midi_sitar transport', tSitar === d.transports.midi_sitar);
assert('dhin → midi_tabla transport', tTabla === d.transports.midi_tabla);
assert('X → default transport', tDefault === d.transports.default);

// ══════════════════════════════════════════════════════════
// 15. Actor with unknown alphabet
// ══════════════════════════════════════════════════════════

section('Error: unknown alphabet');

const r15 = compileBPS(`@controls
@actor foo alphabet:nonexistent transport:midi(ch:1)
S -> A B C`);

assert('error for unknown alphabet', r15.errors.some(e => e.message.includes('nonexistent')));

// ══════════════════════════════════════════════════════════
// 16. Actor without alphabet
// ══════════════════════════════════════════════════════════

section('Error: no alphabet');

const r16 = compileBPS(`@controls
@actor foo transport:midi(ch:1)
S -> A B C`);

assert('error for missing alphabet', r16.errors.some(e => e.message.includes('no alphabet')));

// ══════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
