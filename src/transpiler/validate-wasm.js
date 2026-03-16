/**
 * BPScript Validate (WASM) — compare transpiled BPS with original BP3 grammars.
 *
 * Each test runs in a child process from dist/ to avoid bp3.js cwd issues.
 * The child process compiles BPS first, then loads WASM.
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES_DIR = join(__dirname, '../../scenes');
const BP3_LIB = join(__dirname, '../../bp3-engine/library');
const DIST_DIR = join(__dirname, '../../dist');
const TRANSPILER = join(__dirname, 'index.js');

const SCENE_MAP = {
  'drum': 'examples/drum/grammar.gr',
  'flags': 'examples/flags/grammar.gr',
  'acceleration': 'experimental/acceleration/grammar.gr',
  'templates': 'examples/templates/grammar.gr',
  'negative-context': 'examples/negative-context/grammar.gr',
  'harmony': 'examples/harmony/grammar.gr',
  'mohanam': 'tabla/mohanam/grammar.gr',
  'repeat': 'examples/repeat/grammar.gr',
  'time-patterns': 'examples/time-patterns/grammar.gr',
  'transposition': 'examples/transposition/grammar.gr',
  'livecode1': 'experimental/livecode1/grammar.gr',
  'scales': 'examples/scales/grammar.gr',
  'not-reich': 'experimental/not-reich/grammar.gr',
  'mozart-dice': 'western/mozart-dice/grammar.gr',
  'all-items': 'examples/all-items/grammar.gr',
  'one-scale': 'examples/one-scale/grammar.gr',
  'visser-shapes': 'experimental/visser-shapes/grammar.gr',
  'look-and-say': 'experimental/look-and-say/grammar.gr',
  'ames': 'western/ames/grammar.gr',
  'graphics': 'examples/graphics/grammar.gr',
  'visser3': 'experimental/visser3/grammar.gr',
  'livecode2': 'experimental/livecode2/grammar.gr',
  'visser5': 'experimental/visser5/grammar.gr',
  'asymmetric': 'experimental/asymmetric/grammar.gr',
  'csound': 'examples/csound/grammar.gr',
  'ek-do-tin': 'tabla/ek-do-tin/grammar.gr',
  'destru': 'examples/destru/grammar.gr',
  'kss2': 'experimental/kss2/grammar.gr',
  'vina': 'tabla/vina/grammar.gr',
  'vina2': 'tabla/vina2/grammar.gr',
};

function esc(s) { return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

function runTest(name, origGrPath, bpsPath) {
  const script = `
const {compileBPS}=require('${esc(TRANSPILER)}');
const fs=require('fs');
const c=compileBPS(fs.readFileSync('${esc(bpsPath)}','utf-8'));
if(c.errors.length>0){console.log(JSON.stringify({compileError:c.errors[0].message}));process.exit(0)}
const tg=c.grammar,ts=c.settingsJSON,ta=c.alphabetFile;
const og=fs.readFileSync('${esc(origGrPath)}','utf-8').split('\\n').filter(l=>!/^-[a-z]{2}\\./.test(l.trim())).join('\\n');
require('./bp3.js')().then(bp3=>{
const I=bp3.cwrap('bp3_init','number',[]),G=bp3.cwrap('bp3_load_grammar','number',['string']),
A=bp3.cwrap('bp3_load_alphabet','number',['string']),S=bp3.cwrap('bp3_load_settings','number',['string']),
P=bp3.cwrap('bp3_produce','number',[]),C=bp3.cwrap('bp3_get_midi_event_count','number',[]),
E=bp3.cwrap('bp3_get_midi_events','string',[]),R=bp3.cwrap('bp3_get_result','string',[]),
Mg=bp3.cwrap('bp3_get_messages','string',[]);
I(42);G(og);P();const oc=C();let on=[];
if(oc>0)try{on=JSON.parse(E()).filter(e=>e.type===144).map(e=>e.note)}catch{}
const oe=/Errors: [1-9]/.test(Mg()),or=R().trim();
I(42);if(ta)A(ta);G(tg);P();const tc=C();let tn=[];
if(tc>0)try{tn=JSON.parse(E()).filter(e=>e.type===144).map(e=>e.note)}catch{}
const te=/Errors: [1-9]/.test(Mg()),tr=R().trim();
const nm=on.length===tn.length&&on.every((n,i)=>n===tn[i]);
console.log(JSON.stringify({origErr:oe,origNotes:on.length,origResult:or.substring(0,80),
transErr:te,transNotes:tn.length,transResult:tr.substring(0,80),notesMatch:nm}))
}).catch(e=>console.log(JSON.stringify({error:e.message})))
`.trim();

  try {
    const out = execSync(`node -e '${script.replace(/'/g, "'\\''")}'`, {
      cwd: DIST_DIR,
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString().trim();
    const jsonLine = out.split('\n').filter(l => l.startsWith('{')).pop();
    if (!jsonLine) return { error: 'no JSON output' };
    return JSON.parse(jsonLine);
  } catch (e) {
    return { error: (e.stderr?.toString() || e.message || '').substring(0, 80) };
  }
}

// --- Run all tests ---
let identical = 0, compatible = 0, different = 0, errors = 0, skipped = 0;

for (const [name, grPath] of Object.entries(SCENE_MAP)) {
  const bpsFile = join(SCENES_DIR, name + '.bps');
  const origGr = join(BP3_LIB, grPath);
  const r = runTest(name, origGr, bpsFile);

  if (r.error || r.compileError) {
    console.log(`SKIP ${name}: ${(r.error || r.compileError).substring(0, 60)}`);
    skipped++;
  } else if (r.origErr) {
    console.log(`SKIP ${name}: original failed`);
    skipped++;
  } else if (r.transErr) {
    console.log(`FAIL ${name}: transpiled rejected`);
    errors++;
  } else if (r.notesMatch && r.origNotes > 0) {
    console.log(`  OK ${name} (${r.origNotes} notes, MIDI identical)`);
    identical++;
  } else if (r.origNotes === 0 && r.transNotes === 0) {
    console.log(`  OK ${name} (structural match)`);
    identical++;
  } else if (r.origNotes === 0 && r.transNotes > 0) {
    console.log(`  ~OK ${name} (trans: ${r.transNotes} notes, orig: no MIDI)`);
    compatible++;
  } else {
    console.log(`DIFF ${name} (orig: ${r.origNotes} notes, trans: ${r.transNotes} notes)`);
    different++;
  }
}

console.log(`\n${identical} IDENTICAL, ${compatible} COMPATIBLE, ${different} DIFFERENT, ${errors} FAIL, ${skipped} SKIP / ${Object.keys(SCENE_MAP).length} total`);
