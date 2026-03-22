/**
 * Test bp3_get_timed_tokens() with various scenes and alphabets.
 * Run: node dist/_test_timed_tokens.js
 */

const { readFileSync } = require('fs');
const { join } = require('path');

// Mini transpiler runner (Node.js)
async function loadTranspiler() {
  const { compileBPS } = await import('../src/transpiler/index.js');
  return compileBPS;
}

const SCENES = [
  {
    name: 'western-simple',
    desc: 'Notes western C4 D4 E4 — alphabet standard',
    grammar: 'ORD\ngram#1[1] S --> C4 D4 E4',
    alphabet: 'OCT\nC0 --> C1 --> C2 --> C3 --> C4 --> C5 --> C6 --> C7\nD0 --> D1 --> D2 --> D3 --> D4 --> D5 --> D6 --> D7\nE0 --> E1 --> E2 --> E3 --> E4 --> E5 --> E6 --> E7',
  },
  {
    name: 'controls-inline',
    desc: 'Controls _vel inline — should appear in text but not as tokens',
    grammar: 'ORD\ngram#1[1] S --> _vel(80) C4 _vel(60) D4 E4',
    alphabet: 'OCT\nC0 --> C1 --> C2 --> C3 --> C4 --> C5\nD0 --> D1 --> D2 --> D3 --> D4 --> D5\nE0 --> E1 --> E2 --> E3 --> E4 --> E5',
  },
  {
    name: 'no-alphabet',
    desc: 'Terminals without alphabet — symbols stay as names in p_Bol',
    grammar: 'RND\ngram#1[1] S --> A B C\ngram#1[2] A --> X Y',
  },
  {
    name: 'polymétrie',
    desc: 'Polymetric expression — different voices with different durations',
    grammar: 'ORD\ngram#1[1] S --> {C4 D4 E4, F4 G4}',
    alphabet: 'OCT\nC0 --> C1 --> C2 --> C3 --> C4 --> C5\nD0 --> D1 --> D2 --> D3 --> D4 --> D5\nE0 --> E1 --> E2 --> E3 --> E4 --> E5\nF0 --> F1 --> F2 --> F3 --> F4 --> F5\nG0 --> G1 --> G2 --> G3 --> G4 --> G5',
  },
  {
    name: 'silence-prolongation',
    desc: 'Rests and prolongations in the sequence',
    grammar: 'ORD\ngram#1[1] S --> C4 - D4 _ E4',
    alphabet: 'OCT\nC0 --> C1 --> C2 --> C3 --> C4 --> C5\nD0 --> D1 --> D2 --> D3 --> D4 --> D5\nE0 --> E1 --> E2 --> E3 --> E4 --> E5',
  },
];

// BPS scenes compiled by transpiler
const BPS_SCENES = [
  { name: 'drum.bps', file: 'scenes/drum.bps' },
  { name: 'harmony.bps', file: 'scenes/harmony.bps' },
  { name: 'mohanam.bps', file: 'scenes/mohanam.bps' },
];

require('./bp3.js')().then(async (bp3) => {
  const init = bp3.cwrap('bp3_init', 'number', []);
  const loadGr = bp3.cwrap('bp3_load_grammar', 'number', ['string']);
  const loadAl = bp3.cwrap('bp3_load_alphabet', 'number', ['string']);
  const loadSe = bp3.cwrap('bp3_load_settings', 'number', ['string']);
  const produce = bp3.cwrap('bp3_produce', 'number', []);
  const getResult = bp3.cwrap('bp3_get_result', 'string', []);
  const getMidiCount = bp3.cwrap('bp3_get_midi_event_count', 'number', []);
  const getTokens = bp3.cwrap('bp3_get_timed_tokens', 'string', []);
  const getTokenCount = bp3.cwrap('bp3_get_timed_token_count', 'number', []);

  let compileBPS;
  try { compileBPS = await loadTranspiler(); } catch(e) {
    console.warn('Transpiler not available:', e.message);
  }

  console.log('=== RAW GRAMMAR TESTS ===\n');

  for (const scene of SCENES) {
    init();
    if (scene.alphabet) loadAl(scene.alphabet);
    loadGr(scene.grammar);
    const r = produce();

    const text = getResult().trim();
    const midiCount = getMidiCount();
    const tokenCount = getTokenCount();
    let tokens = [];
    try { tokens = JSON.parse(getTokens()); } catch {}

    console.log(`--- ${scene.name} ---`);
    console.log(`  ${scene.desc}`);
    console.log(`  text output: "${text}"`);
    console.log(`  MIDI events: ${midiCount}, timed tokens: ${tokenCount}`);
    if (tokens.length > 0) {
      for (const t of tokens) {
        const dur = t.end - t.start;
        console.log(`    ${t.token.padEnd(12)} ${t.start}ms → ${t.end}ms (${dur}ms) vel=${t.vel} ch=${t.chan} trans=${t.trans}`);
      }
    }
    console.log();
  }

  // BPS scenes via transpiler
  if (compileBPS) {
    console.log('=== BPS TRANSPILED SCENES ===\n');

    for (const scene of BPS_SCENES) {
      try {
        const source = readFileSync(join(__dirname, '..', scene.file), 'utf-8');
        const compiled = compileBPS(source);

        if (compiled.errors.length > 0) {
          console.log(`--- ${scene.name}: COMPILE ERROR ---`);
          compiled.errors.forEach(e => console.log(`  ${e.message}`));
          console.log();
          continue;
        }

        init();
        if (compiled.alphabetFile) loadAl(compiled.alphabetFile);
        if (compiled.settingsJSON) loadSe(compiled.settingsJSON);
        loadGr(compiled.grammar);
        const r = produce();

        const text = getResult().trim();
        const midiCount = getMidiCount();
        const tokenCount = getTokenCount();
        let tokens = [];
        try { tokens = JSON.parse(getTokens()); } catch {}

        console.log(`--- ${scene.name} ---`);
        console.log(`  text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
        console.log(`  MIDI: ${midiCount}, tokens: ${tokenCount}`);
        if (tokens.length > 0) {
          const shown = tokens.slice(0, 12);
          for (const t of shown) {
            const dur = t.end - t.start;
            console.log(`    ${t.token.padEnd(12)} ${t.start}ms → ${t.end}ms (${dur}ms) vel=${t.vel} ch=${t.chan}`);
          }
          if (tokens.length > 12) console.log(`    ... (${tokens.length - 12} more)`);
        }
        console.log();
      } catch (e) {
        console.log(`--- ${scene.name}: ERROR: ${e.message} ---\n`);
      }
    }
  }
}).catch(e => console.error('FATAL:', e.message));
