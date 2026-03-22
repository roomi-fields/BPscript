import { compileBPS } from '../src/transpiler/index.js';
import { registerLib, clearRegistry } from '../src/transpiler/libs.js';
import { readFileSync } from 'fs';

const libDir = new URL('../lib/', import.meta.url).pathname;
for (const name of ['alphabet', 'controls', 'core', 'routing', 'settings', 'sub', 'filter']) {
  try {
    registerLib(name, JSON.parse(readFileSync(`${libDir}${name}.json`, 'utf-8')));
  } catch {}
}

// Test LFO
const lfo = compileBPS(`@filter
@core
@controls
@alphabet.western:browser
@mm:100

wobble(Melody, browser) = filter.lfo(2, 80, shape:sine)

S -> {Melody, wobble}

Melody -> [wave:triangle, vel:80] C4 D4 E4 F4 G4 A4 B4 C5`);

console.log('=== LFO ===');
console.log('Errors:', lfo.errors.length ? lfo.errors : 'none');
console.log('Grammar:', lfo.grammar);
console.log('CV Table:', JSON.stringify(lfo.cvTable, null, 2));

// Test backtick
const bt = compileBPS(`@core
@controls
@alphabet.western:browser
@mm:80

custom(Phrase1, browser) = \`(t, dur) => Math.sin(t / dur * Math.PI * 8) * 0.5 + 0.5\`

S -> {Phrase1, custom}

Phrase1 -> [wave:sawtooth, vel:90] C3 E3 G3 C4 E4 G4 C5 G4`);

console.log('\n=== Backtick CV ===');
console.log('Errors:', bt.errors.length ? bt.errors : 'none');
console.log('Grammar:', bt.grammar);
console.log('CV Table:', JSON.stringify(bt.cvTable, null, 2));
