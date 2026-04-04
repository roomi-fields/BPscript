/**
 * Integration test: SoundsResolver + Resolver + WebAudioTransport
 *
 * Tests the full chain without a browser:
 *   resolver.resolve("dhin") → { layers: [...] }
 *   transport.send(event) → _sendLayers() → _sendPercussion(params)
 *
 * Run: node test/test_sounds.js
 */

import { readFileSync } from 'fs';
import { Resolver } from '../src/dispatcher/resolver.js';
import { SoundsResolver } from '../src/dispatcher/soundsResolver.js';
import { WebAudioTransport } from '../src/dispatcher/transports/webaudio.js';
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

// ── Load libs ──────────────────────────────────────────────

const alphabets = JSON.parse(readFileSync('lib/alphabets.json', 'utf8'));
const tunings = JSON.parse(readFileSync('lib/tunings.json', 'utf8'));
const temperaments = JSON.parse(readFileSync('lib/temperaments.json', 'utf8'));
const tablaPerc = JSON.parse(readFileSync('lib/sounds/tabla_perc.json', 'utf8'));

// ── Mock AudioContext ──────────────────────────────────────

class MockParam {
  constructor() { this.value = 0; }
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
  setValueCurveAtTime() {}
}

class MockNode {
  constructor(type) {
    this.type = type;
    this.gain = new MockParam();
    this.frequency = new MockParam();
    this.detune = new MockParam();
    this.pan = new MockParam();
    this.Q = new MockParam();
    this.buffer = null;
  }
  connect() { return this; }
  disconnect() {}
  start() {}
  stop() {}
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
    this._destination = new MockNode('destination');
  }
  get destination() { return this._destination; }
  createOscillator() { return new MockNode('oscillator'); }
  createGain() { return new MockNode('gain'); }
  createBiquadFilter() { return new MockNode('filter'); }
  createStereoPanner() { return new MockNode('panner'); }
  createBuffer(ch, len, rate) {
    return { getChannelData: () => new Float32Array(Math.max(1, len)) };
  }
  createBufferSource() { return new MockNode('bufferSource'); }
  resume() {}
}

// ── 1. SoundsResolver standalone ───────────────────────────

section('SoundsResolver standalone');

const sr = new SoundsResolver(tablaPerc);

// dhin = 2 layers (bayan_open + dayan_ring)
const dhin = sr.resolve('dhin');
assert('dhin has layers', Array.isArray(dhin?.layers));
assert('dhin has 2 layers', dhin.layers.length === 2);
assert('dhin layer0 freq=80 (bayan)', dhin.layers[0].freq === 80);
assert('dhin layer1 freq=350 (dayan)', dhin.layers[1].freq === 350);
assert('dhin layer0 has pitch_drop', dhin.layers[0].pitch_drop === 0.6);
assert('dhin layer1 has brightness', dhin.layers[1].brightness === 4000);

// ka = 1 layer (bayan_muted)
const ka = sr.resolve('ka');
assert('ka has 1 layer', ka.layers.length === 1);
assert('ka short decay=60', ka.layers[0].decay === 60);
assert('ka low noise=0.1', ka.layers[0].noise === 0.1);

// ge = 1 layer (bayan_open)
const ge = sr.resolve('ge');
assert('ge has 1 layer', ge.layers.length === 1);
assert('ge freq=80 (bass)', ge.layers[0].freq === 80);
assert('ge long decay=350', ge.layers[0].decay === 350);

// tin = dayan_ring + override
const tin = sr.resolve('tin');
assert('tin has 1 layer', tin.layers.length === 1);
assert('tin override freq=500', tin.layers[0].freq === 500);
assert('tin override decay=150', tin.layers[0].decay === 150);

// tirakita = 2 layers + override
const tira = sr.resolve('tirakita');
assert('tirakita has 2 layers', tira.layers.length === 2);
assert('tirakita short decay=40', tira.layers[0].decay === 40);
assert('tirakita bright=5000', tira.layers[0].brightness === 5000);

// Unknown token → null
assert('unknown → null', sr.resolve('xyz_unknown_bol') === null);
assert('silence → null', sr.resolve('-') === null);

// ── 2. Resolver with SoundsResolver fallback ───────────────

section('Resolver + SoundsResolver fallback');

// Tabla resolver (no tuning → pitch fails → sounds fallback)
const tablaResolver = new Resolver({ alphabet: alphabets.tabla });
tablaResolver.soundsResolver = new SoundsResolver(tablaPerc);

const rDhin = tablaResolver.resolve('dhin');
assert('tabla dhin resolved', rDhin != null);
assert('tabla dhin has layers', Array.isArray(rDhin.layers));
assert('tabla dhin no frequency (not pitched)', rDhin.frequency === undefined);

const rKa = tablaResolver.resolve('ka');
assert('tabla ka resolved', rKa != null);
assert('tabla ka has layers', Array.isArray(rKa.layers));

const rUnknown = tablaResolver.resolve('xyz_not_a_bol');
assert('tabla unknown → null', rUnknown === null);

// Western resolver — pitch works, no sounds needed
const westernResolver = new Resolver({
  alphabet: alphabets.western,
  tuning: tunings.western_12TET,
  temperament: temperaments['12TET']
});

const rC4 = westernResolver.resolve('C4');
assert('western C4 resolved', rC4 != null);
assert('western C4 has frequency', rC4.frequency > 260 && rC4.frequency < 263);
assert('western C4 no layers', rC4.layers === undefined);

// Western resolver + sounds attached — pitch should take priority
westernResolver.soundsResolver = new SoundsResolver(tablaPerc);
const rC4s = westernResolver.resolve('C4');
assert('western+sounds C4 still pitched', rC4s.frequency > 260);
assert('western+sounds C4 no layers', rC4s.layers === undefined);

// But unknown bols should fall to sounds
// (clear cache first since we just added soundsResolver)
westernResolver._cache = {};
const rDhinW = westernResolver.resolve('dhin');
assert('western+sounds dhin → sounds fallback', rDhinW?.layers?.length === 2);

// ── 3. WebAudioTransport with mock ─────────────────────────

section('WebAudioTransport send');

const mockCtx = new MockAudioContext();

// Transport with tabla resolver
const transport = new WebAudioTransport(mockCtx, { resolver: tablaResolver });

// Track what _sendPercussion receives
const percCalls = [];
const origSendPerc = transport._sendPercussion.bind(transport);
transport._sendPercussion = function(event, absTime, params) {
  percCalls.push({ token: event.token, hasParams: !!params, params });
  origSendPerc(event, absTime, params);
};

// Send a tabla bol with layers
percCalls.length = 0;
transport.send({ token: 'dhin', velocity: 0.7, durSec: 0.5 }, 0.0);
assert('dhin → _sendPercussion called (via _sendLayers)', percCalls.length === 2);
assert('dhin layer0 has explicit params', percCalls[0].hasParams === true);
assert('dhin layer0 freq=80', percCalls[0].params.freq === 80);
assert('dhin layer1 freq=350', percCalls[1].params.freq === 350);

// Send a single-layer bol
percCalls.length = 0;
transport.send({ token: 'ka', velocity: 0.5, durSec: 0.3 }, 0.5);
assert('ka → _sendPercussion called once', percCalls.length === 1);
assert('ka has explicit params', percCalls[0].hasParams === true);
assert('ka freq=80 (bayan_muted)', percCalls[0].params.freq === 80);

// Send unknown bol → no sound, no crash (console.warn)
percCalls.length = 0;
transport.send({ token: 'xyz_unknown', velocity: 0.5, durSec: 0.2 }, 1.0);
assert('unknown → _sendPercussion NOT called (no fallback)', percCalls.length === 0);

// ── 4. WebAudioTransport pitched (non-regression) ──────────

section('WebAudioTransport pitched');

const pitchedTransport = new WebAudioTransport(mockCtx, { resolver: westernResolver });

// Pitched send should NOT go through _sendPercussion
const pitchPercCalls = [];
const origPitchPerc = pitchedTransport._sendPercussion.bind(pitchedTransport);
pitchedTransport._sendPercussion = function(event, absTime, params) {
  pitchPercCalls.push({ token: event.token });
  origPitchPerc(event, absTime, params);
};

pitchedTransport.send({ token: 'C4', velocity: 0.5, durSec: 0.5, wave: 'triangle', pan: 64 }, 0.0);
assert('C4 → no _sendPercussion call (pitched path)', pitchPercCalls.length === 0);

// ── 5. Dispatcher integration ──────────────────────────────

section('Dispatcher integration');

const dispatcher = new Dispatcher(mockCtx);
dispatcher.addTransport('default', transport);
dispatcher._resolver = tablaResolver;

// Simulate timed tokens like a tabla scene would produce
const fakeTimedTokens = [
  { token: 'dhin', start: 0, end: 500 },
  { token: '-', start: 500, end: 1000 },
  { token: 'dha', start: 1000, end: 1500 },
  { token: 'ge', start: 1500, end: 2000 },
  { token: 'na', start: 2000, end: 2500 },
  { token: 'ka', start: 2500, end: 3000 },
];

dispatcher.load(fakeTimedTokens);
assert('dispatcher loaded 6 events', dispatcher.events.length === 6);
assert('dispatcher duration = 3s', Math.abs(dispatcher.duration - 3.0) < 0.01);

// Manually schedule all events (simulate what clock would do)
percCalls.length = 0;
for (const evt of dispatcher.events) {
  if (evt.isSilence || evt.isProlongation) continue;
  transport.send({
    token: evt.token,
    durSec: evt.durSec,
    velocity: 0.5,
  }, evt.startSec);
}

// dhin=2, dha=2, ge=1, na=1, ka=1 → 7 _sendPercussion calls
assert('5 bols → 7 _sendPercussion calls (dhin/dha=2 each)', percCalls.length === 7);
assert('all had explicit params', percCalls.every(c => c.hasParams));

// ── 6. Full pipeline: compile + resolve + dispatch ─────────

section('Full pipeline (transpiler → resolver → transport)');

// Dynamic import of transpiler
const transpiler = await import('../src/transpiler/index.js');
const compileBPS = transpiler.compileBPS;

// Compile a simple tabla-like scene
const source = `
@core
@controls
@mm:120

S -> dhin - dha ge na ka ta ti
`;

const result = compileBPS(source);
assert('compile OK (no errors)', result.errors.length === 0);
assert('grammar produced', result.grammar.length > 0);

// Check that the timed tokens would resolve correctly via our resolver
const terminals = result.grammar.match(/\b(dhin|dha|ge|na|ka|ta|ti)\b/g) || [];
assert('grammar contains tabla bols', terminals.length > 0);

for (const bol of ['dhin', 'dha', 'ge', 'na', 'ka', 'ta', 'ti']) {
  const res = tablaResolver.resolve(bol);
  assert(`resolve("${bol}") ≠ null`, res != null);
  assert(`resolve("${bol}") has layers`, Array.isArray(res?.layers));
}

// ── 7. BP3 constraints: BOLSIZE validation ─────────────────

section('BP3 BOLSIZE validation');

const BP3_BOLSIZE = 30;

// ALL scenes must have terminals ≤ 30 chars
import { readdirSync } from 'fs';
const allScenes = readdirSync('scenes').filter(f => f.endsWith('.bps'));
for (const scene of allScenes) {
  const src = readFileSync('scenes/' + scene, 'utf8');
  const r = compileBPS(src);
  const bols = r.alphabetFile ? r.alphabetFile.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')) : [];
  const over = bols.filter(b => b.length > BP3_BOLSIZE);
  assert(`${scene}: compile OK`, r.errors.length === 0);
  assert(`${scene}: no terminal > ${BP3_BOLSIZE} chars`, over.length === 0);
  if (over.length) over.forEach(b => console.log(`    ${b} (${b.length})`));
}

// A scene with a long terminal MUST produce an error
const badScene = compileBPS(`
@core
gate dhatidhagenadhatrktdhatidhagedheenagena:midi
S -> dhatidhagenadhatrktdhatidhagedheenagena
`);
assert('long terminal → compile error', badScene.errors.length > 0);
assert('error mentions BOLSIZE', badScene.errors.some(e => e.message.includes('BOLSIZE') || e.message.includes('exceeds')));

// ── 8. Browser simulation: _createResolver() logic ─────────

section('Browser _createResolver() simulation');

// Replicate exactly what web/index.html _createResolver() does:
// 1. Read directives from compiled scene
// 2. Pick alphabetKey, tuningKey, soundsKey
// 3. Build resolver
// 4. Attach soundsResolver if applicable

function simulateCreateResolver(directives, libSounds) {
  const alphabetKeyMap = { raga: 'sargam' };
  let alphabetKey = 'western';
  let tuningKey = null;
  let soundsKey = null;

  for (const dir of (directives || [])) {
    if (dir.name === 'alphabet' && dir.subkey) {
      alphabetKey = alphabetKeyMap[dir.subkey] || dir.subkey;
    }
    if (dir.name === 'tuning' && dir.runtime) tuningKey = dir.runtime;
    if (dir.name === 'sounds' && (dir.runtime || dir.subkey)) {
      soundsKey = dir.runtime || dir.subkey;
    }
  }

  // Auto-detect tuning
  if (!tuningKey) {
    for (const [k, v] of Object.entries(tunings)) {
      if (k.startsWith('_')) continue;
      if (v.alphabet === alphabetKey) { tuningKey = k; break; }
    }
  }
  tuningKey = tuningKey || 'western_12TET';

  const alphabetData = alphabets[alphabetKey];
  const tuningData = tunings[tuningKey];
  const tempName = tuningData?.temperament;
  const tempData = tempName ? temperaments[tempName] : null;

  const resolver = new Resolver({
    alphabet: alphabetData || alphabets.western,
    tuning: tuningData,
    temperament: tempData,
  });

  // Auto-detect sounds from alphabet
  if (!soundsKey) {
    const soundsAutoMap = { tabla: 'tabla_perc' };
    soundsKey = soundsAutoMap[alphabetKey] || null;
  }

  if (soundsKey && libSounds[soundsKey]) {
    resolver.soundsResolver = new SoundsResolver(libSounds[soundsKey]);
  }

  return resolver;
}

const libSounds = { tabla_perc: tablaPerc };

// Case A: Scene dhin.bps — has @core @controls, NO @alphabet, NO @sounds
const dhinResult = compileBPS(readFileSync('scenes/dhin.bps', 'utf8'));
const dhinResolver = simulateCreateResolver(dhinResult.directives, libSounds);
const dhinResolve = dhinResolver.resolve('dhin');
console.log(`  dhin.bps directives: ${dhinResult.directives.map(d => '@' + d.name).join(', ')}`);
console.log(`  dhin.bps resolve("dhin") = ${dhinResolve ? 'FOUND' : 'NULL'}`);
assert('dhin.bps: dhin resolves (not NULL)', dhinResolve != null);

// Case B: Scene with explicit @sounds:tabla_perc
const withSoundsResult = compileBPS(`
@core
@controls
@sounds:tabla_perc
@mm:120
S -> dhin - dha ge
`);
const withSoundsResolver = simulateCreateResolver(withSoundsResult.directives, libSounds);
const withSoundsResolve = withSoundsResolver.resolve('dhin');
console.log(`  @sounds scene resolve("dhin") = ${withSoundsResolve ? 'FOUND' : 'NULL'}`);
assert('@sounds:tabla_perc: dhin resolves', withSoundsResolve != null);

// Case C: Scene with @alphabet:tabla (auto-detect)
const withAlphabetResult = compileBPS(`
@core
@controls
@alphabet.tabla
@mm:120
S -> dhin - dha ge
`);
const withAlphabetResolver = simulateCreateResolver(withAlphabetResult.directives, libSounds);
const withAlphabetResolve = withAlphabetResolver.resolve('dhin');
console.log(`  @alphabet.tabla resolve("dhin") = ${withAlphabetResolve ? 'FOUND' : 'NULL'}`);
assert('@alphabet:tabla: dhin resolves (auto-detect)', withAlphabetResolve != null);

// Case D: Western scene — pitched should still work
const westernResult = compileBPS(`
@core
@controls
@alphabet.western:midi
@mm:120
S -> C4 D4 E4
`);
const westernSimResolver = simulateCreateResolver(westernResult.directives, libSounds);
const c4Resolve = westernSimResolver.resolve('C4');
console.log(`  western resolve("C4") = ${c4Resolve?.frequency || 'NULL'} Hz`);
assert('western C4 still pitched', c4Resolve?.frequency > 260);

// ── Results ────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
