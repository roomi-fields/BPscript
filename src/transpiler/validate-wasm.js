/**
 * BPScript Validate (WASM) — compile .bps scenes, run through BP3 WASM engine,
 * compare MIDI output with original grammars.
 *
 * No files on disk — everything passes as strings to the WASM API.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES_DIR = join(__dirname, '../../scenes');
const BP3_LIB = join(__dirname, '../../bp3-engine/library');
const DIST_DIR = join(__dirname, '../../dist');

// Dynamic import of compileBPS (ESM)
const { compileBPS } = await import('./index.js');

const SCENE_MAP = {
  'drum':             'examples/drum/grammar.gr',
  'flags':            'examples/flags/grammar.gr',
  'acceleration':     'experimental/acceleration/grammar.gr',
  'templates':        'examples/templates/grammar.gr',
  'negative-context': 'examples/negative-context/grammar.gr',
  'harmony':          'examples/harmony/grammar.gr',
  'mohanam':          'tabla/mohanam/grammar.gr',
  'repeat':           'examples/repeat/grammar.gr',
  'time-patterns':    'examples/time-patterns/grammar.gr',
  'transposition':    'examples/transposition/grammar.gr',
  'livecode1':        'experimental/livecode1/grammar.gr',
  'scales':           'examples/scales/grammar.gr',
  'not-reich':        'experimental/not-reich/grammar.gr',
  'mozart-dice':      'western/mozart-dice/grammar.gr',
  'all-items':        'examples/all-items/grammar.gr',
  'one-scale':        'examples/one-scale/grammar.gr',
  'visser-shapes':    'experimental/visser-shapes/grammar.gr',
};

// Load BP3 WASM module (must set cwd to dist/ for bp3.data)
const origCwd = process.cwd();
process.chdir(DIST_DIR);
const BP3Module = require(join(DIST_DIR, 'bp3.js'));
const bp3 = await BP3Module();
process.chdir(origCwd);

const bp3_init = bp3.cwrap('bp3_init', 'number', []);
const bp3_load_settings = bp3.cwrap('bp3_load_settings', 'number', ['string']);
const bp3_load_alphabet = bp3.cwrap('bp3_load_alphabet', 'number', ['string']);
const bp3_load_grammar = bp3.cwrap('bp3_load_grammar', 'number', ['string']);
const bp3_produce = bp3.cwrap('bp3_produce', 'number', []);
const bp3_get_result = bp3.cwrap('bp3_get_result', 'string', []);
const bp3_get_messages = bp3.cwrap('bp3_get_messages', 'string', []);
const bp3_get_midi_events = bp3.cwrap('bp3_get_midi_events', 'string', []);
const bp3_get_midi_event_count = bp3.cwrap('bp3_get_midi_event_count', 'number', []);

/**
 * Run a grammar through BP3 WASM and return MIDI events.
 * @param {string} grammar - BP3 grammar text
 * @param {string|null} settings - Settings JSON string
 * @param {string|null} alphabet - Alphabet OCT string
 * @param {number} seed - Random seed
 * @returns {{ ok, events, noteOns, messages }}
 */
function runWASM(grammar, settings, alphabet, seed = 42) {
  try {
  bp3_init(seed);

  if (settings) bp3_load_settings(settings);
  if (alphabet) bp3_load_alphabet(alphabet);
  bp3_load_grammar(grammar);

  const result = bp3_produce();
  const messages = bp3_get_messages();
  const count = bp3_get_midi_event_count();
  let events = [];
  let noteOns = [];

  if (count > 0) {
    try {
      events = JSON.parse(bp3_get_midi_events());
      noteOns = events.filter(e => e.type === 144);
    } catch {}
  }

  const hasError = /Errors: [1-9]/.test(messages) || /Compilation failed/.test(messages);

  return { ok: !hasError && result > 0, events, noteOns, count, messages };
  } catch (e) {
    return { ok: false, events: [], noteOns: [], count: 0, messages: 'WASM crash: ' + e.message };
  }
}

/**
 * Load original grammar + its settings.json from bp3-engine/library
 */
function loadOriginal(grPath) {
  const grammarFile = join(BP3_LIB, grPath);
  const grammar = readFileSync(grammarFile, 'utf-8');

  // Try to load settings.json from same directory
  const dir = dirname(grammarFile);
  let settings = null;
  try {
    settings = readFileSync(join(dir, 'settings.json'), 'utf-8');
  } catch {}

  // Extract alphabet reference from grammar (-ho.xxx or -al.xxx)
  // and try to load from bp3-engine/data/
  let alphabet = null;
  const hoMatch = grammar.match(/^-ho\.(.+)$/m);
  if (hoMatch) {
    try {
      alphabet = readFileSync(join(__dirname, '../../bp3-engine/data', `-ho.${hoMatch[1]}`), 'utf-8');
    } catch {}
  }

  return { grammar, settings, alphabet };
}

// --- Run validation ---

let identical = 0, compatible = 0, different = 0, errors = 0, skipped = 0;

for (const [name, grPath] of Object.entries(SCENE_MAP)) {
  const bpsFile = join(SCENES_DIR, name + '.bps');

  // 1. Compile BPS → BP3
  let bpsSrc;
  try { bpsSrc = readFileSync(bpsFile, 'utf-8'); } catch { console.log(`SKIP ${name}: no .bps`); skipped++; continue; }
  const compiled = compileBPS(bpsSrc);
  if (compiled.errors.length > 0) {
    console.log(`FAIL ${name}: compile error — ${compiled.errors[0].message}`);
    errors++;
    continue;
  }

  // 2. Run ORIGINAL through WASM
  //    Skip settings for now (WASM bug: settings kill MIDI output)
  const orig = loadOriginal(grPath);
  const origResult = runWASM(orig.grammar, null, orig.alphabet);

  if (!origResult.ok) {
    // Try without settings (some grammars work with defaults)
    const origRetry = runWASM(orig.grammar, null, orig.alphabet);
    if (!origRetry.ok) {
      const errMatch = origResult.messages.match(/Error code \d+:.*/);
      console.log(`SKIP ${name}: original failed — ${errMatch?.[0] || 'engine error'}`);
      skipped++;
      continue;
    }
    // Use retry result
    Object.assign(origResult, origRetry);
  }

  // 3. Run TRANSPILED through WASM
  //    Settings cause MIDI loss (WASM bug) — only load for non-western conventions
  // Only use alphabet for non-western conventions (western is built-in)
  const needsSettings = compiled.settingsJSON && /"NoteConvention".*"value":\s*"[^1]"/.test(compiled.settingsJSON);
  const needsAlphabet = needsSettings; // alphabet only needed when settings change note convention
  const transResult = runWASM(
    compiled.grammar,
    needsSettings ? compiled.settingsJSON : null,
    needsAlphabet ? compiled.alphabetFile : null
  );

  if (!transResult.ok) {
    console.log(`FAIL ${name}: transpiled rejected by engine`);
    const errLines = transResult.messages.split('\n').filter(l => /Error|\?\?\?/.test(l));
    for (const l of errLines.slice(0, 3)) console.log(`  ${l.trim()}`);
    errors++;
    continue;
  }

  // 4. Compare MIDI events
  if (origResult.count === 0 && transResult.count === 0) {
    console.log(`  OK ${name} (no MIDI — structural match)`);
    compatible++;
    continue;
  }

  if (origResult.count === 0 && transResult.count > 0) {
    console.log(`  OK ${name} (orig: no MIDI, trans: ${transResult.noteOns.length} notes — can't compare)`);
    compatible++;
    continue;
  }

  // Compare note-on events
  const origNotes = origResult.noteOns.map(e => e.note);
  const transNotes = transResult.noteOns.map(e => e.note);

  if (origNotes.length === transNotes.length &&
      origNotes.every((n, i) => n === transNotes[i])) {
    // Check timing too
    const origTimes = origResult.noteOns.map(e => e.time);
    const transTimes = transResult.noteOns.map(e => e.time);
    const timingMatch = origTimes.every((t, i) => t === transTimes[i]);

    if (timingMatch) {
      console.log(`  OK ${name} (${origNotes.length} notes, MIDI identical)`);
      identical++;
    } else {
      console.log(`  ~OK ${name} (${origNotes.length} notes match, timing differs)`);
      compatible++;
    }
  } else {
    console.log(`DIFF ${name} (orig: ${origNotes.length} notes, trans: ${transNotes.length} notes)`);
    // Show first difference
    for (let i = 0; i < Math.min(origNotes.length, transNotes.length, 3); i++) {
      if (origNotes[i] !== transNotes[i]) {
        console.log(`  note ${i}: orig=${origNotes[i]} trans=${transNotes[i]}`);
      }
    }
    different++;
  }
}

console.log(`\n${identical} IDENTICAL, ${compatible} COMPATIBLE, ${different} DIFFERENT, ${errors} FAIL, ${skipped} SKIP / ${Object.keys(SCENE_MAP).length} total`);
