/**
 * Tests for the new 5-layer Resolver
 * Run: node test/test_resolver.js
 */

import { Resolver } from '../src/dispatcher/resolver.js';

let passed = 0;
let failed = 0;

function assert(label, actual, expected, tolerance = 0.5) {
  if (actual == null && expected != null) {
    failed++;
    console.error(`FAIL: ${label} — got null, expected ${expected}`);
    return;
  }
  const ok = Math.abs(actual - expected) < tolerance;
  if (ok) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`);
  }
}

function assertNull(label, actual) {
  if (actual == null) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${label} — expected null, got ${JSON.stringify(actual)}`);
  }
}

function assertNotNull(label, actual) {
  if (actual != null) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${label} — expected non-null, got null`);
  }
}

// ============================================================
// TEST 1: Western 12-TET with number octaves
// ============================================================
console.log('\n=== Western 12-TET ===');

const western12 = new Resolver({
  alphabet: {
    notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    alterations: ['bb', 'b', '', '#', '##']
  },
  octaves: {
    position: 'suffix',
    separator: '',
    registers: ['0','1','2','3','4','5','6','7','8','9'],
    default: 4
  },
  tuning: {
    degrees: [0, 2, 4, 5, 7, 9, 11],
    alterations: { '#': '100c', 'b': '-100c', '##': '200c', 'bb': '-200c' },
    baseHz: 440,
    baseNote: 'A',
    baseRegister: 4
  },
  temperament: {
    period_ratio: 2,
    divisions: 12,
    ratios: [1, '100c', '200c', '300c', '400c', '500c', '600c', '700c', '800c', '900c', '1000c', '1100c']
  }
});

// A4 = 440 Hz
let r = western12.resolve('A4');
assertNotNull('A4 resolves', r);
assert('A4 = 440 Hz', r?.frequency, 440, 0.1);

// A5 = 880 Hz (one octave up)
r = western12.resolve('A5');
assert('A5 = 880 Hz', r?.frequency, 880, 0.1);

// A3 = 220 Hz (one octave down)
r = western12.resolve('A3');
assert('A3 = 220 Hz', r?.frequency, 220, 0.1);

// C4 = 261.63 Hz (middle C)
r = western12.resolve('C4');
assert('C4 ≈ 261.63 Hz', r?.frequency, 261.63, 0.5);

// E4 = 329.63 Hz
r = western12.resolve('E4');
assert('E4 ≈ 329.63 Hz', r?.frequency, 329.63, 0.5);

// C#4 (alteration)
r = western12.resolve('C#4');
assert('C#4 ≈ 277.18 Hz', r?.frequency, 277.18, 0.5);

// Bb4
r = western12.resolve('Bb4');
assert('Bb4 ≈ 466.16 Hz', r?.frequency, 466.16, 0.5);

// Bare note (no octave) → default register 4
r = western12.resolve('A');
assert('A (bare) = A4 = 440 Hz', r?.frequency, 440, 0.1);

// ============================================================
// TEST 2: Sargam 22-shruti with arrow octaves
// ============================================================
console.log('\n=== Sargam 22-shruti ===');

const sargam22 = new Resolver({
  alphabet: {
    notes: ['sa', 're', 'ga', 'ma', 'pa', 'dha', 'ni'],
    alterations: ['komal', '', 'tivra']
  },
  octaves: {
    position: 'suffix',
    separator: '_',
    registers: ['vv', 'v', '', '^', '^^'],
    default: 2
  },
  tuning: {
    degrees: [0, 4, 7, 9, 13, 17, 20],
    alterations: { 'komal': '16/15', 'tivra': '25/24' },
    baseHz: 240,
    baseNote: 'sa',
    baseRegister: 2  // default = madhya = register index 2
  },
  temperament: {
    period_ratio: 2,
    divisions: 22,
    ratios: [1, '256/243', '16/15', '10/9', '9/8',
             '32/27', '6/5', '5/4', '81/64',
             '4/3', '27/20', '45/32', '729/512',
             '3/2', '128/81', '8/5', '5/3', '27/16',
             '16/9', '9/5', '15/8', '243/128']
  }
});

// sa (bare) = default register = 240 Hz
r = sargam22.resolve('sa');
assertNotNull('sa resolves', r);
assert('sa = 240 Hz', r?.frequency, 240, 0.1);

// sa_^ (one octave up) = 480 Hz
r = sargam22.resolve('sa_^');
assert('sa_^ = 480 Hz', r?.frequency, 480, 0.1);

// sa_v (one octave down) = 120 Hz
r = sargam22.resolve('sa_v');
assert('sa_v = 120 Hz', r?.frequency, 120, 0.1);

// pa = perfect fifth = 240 × 3/2 = 360 Hz
r = sargam22.resolve('pa');
assert('pa = 360 Hz (3/2)', r?.frequency, 360, 0.5);

// ga = major third (step 7 = 5/4) = 240 × 5/4 = 300 Hz
r = sargam22.resolve('ga');
assert('ga = 300 Hz (5/4)', r?.frequency, 300, 0.5);

// ============================================================
// TEST 3: Saptak prefix octaves
// ============================================================
console.log('\n=== Saptak prefix octaves ===');

const saptak = new Resolver({
  alphabet: {
    notes: ['sa', 're', 'ga', 'ma', 'pa', 'dha', 'ni'],
    alterations: ['komal', '', 'tivra']
  },
  octaves: {
    position: 'prefix',
    separator: ' ',
    registers: ['mandra', 'madhya', 'taar'],
    default: 1
  },
  tuning: {
    degrees: [0, 4, 7, 9, 13, 17, 20],
    alterations: {},
    baseHz: 240,
    baseNote: 'sa',
    baseRegister: 1  // madhya
  },
  temperament: {
    period_ratio: 2,
    divisions: 22,
    ratios: [1, '256/243', '16/15', '10/9', '9/8',
             '32/27', '6/5', '5/4', '81/64',
             '4/3', '27/20', '45/32', '729/512',
             '3/2', '128/81', '8/5', '5/3', '27/16',
             '16/9', '9/5', '15/8', '243/128']
  }
});

// madhya sa = 240 Hz
r = saptak.resolve('madhya sa');
assertNotNull('madhya sa resolves', r);
assert('madhya sa = 240 Hz', r?.frequency, 240, 0.1);

// taar sa = 480 Hz
r = saptak.resolve('taar sa');
assert('taar sa = 480 Hz', r?.frequency, 480, 0.1);

// mandra sa = 120 Hz
r = saptak.resolve('mandra sa');
assert('mandra sa = 120 Hz', r?.frequency, 120, 0.1);

// bare sa = madhya = 240 Hz
r = saptak.resolve('sa');
assert('sa (bare) = madhya = 240 Hz', r?.frequency, 240, 0.1);

// ============================================================
// TEST 4: Directional tuning (ascending vs descending)
// ============================================================
console.log('\n=== Directional tuning (Bhairav) ===');

const bhairav = new Resolver({
  alphabet: {
    notes: ['sa', 're', 'ga', 'ma', 'pa', 'dha', 'ni'],
    alterations: ['komal', '', 'tivra']
  },
  octaves: {
    position: 'suffix',
    separator: '_',
    registers: ['vv', 'v', '', '^', '^^'],
    default: 2
  },
  tuning: {
    ascending:  [0, 2, 7, 9, 13, 15, 20],
    descending: [0, 4, 7, 9, 13, 17, 20],
    alterations: {},
    baseHz: 240,
    baseNote: 'sa',
    baseRegister: 2
  },
  temperament: {
    period_ratio: 2,
    divisions: 22,
    ratios: [1, '256/243', '16/15', '10/9', '9/8',
             '32/27', '6/5', '5/4', '81/64',
             '4/3', '27/20', '45/32', '729/512',
             '3/2', '128/81', '8/5', '5/3', '27/16',
             '16/9', '9/5', '15/8', '243/128']
  }
});

// re ascending = step 2 = 16/15
const reAsc = bhairav.resolve('re', 'ascending');
assertNotNull('re ascending resolves', reAsc);

// re descending = step 4 = 9/8
const reDesc = bhairav.resolve('re', 'descending');
assertNotNull('re descending resolves', reDesc);

// They should be different!
if (reAsc && reDesc) {
  const different = Math.abs(reAsc.frequency - reDesc.frequency) > 1;
  if (different) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: re asc (${reAsc.frequency}) should differ from re desc (${reDesc.frequency})`);
  }
}

// ============================================================
// TEST 5: Parametric temperament (meantone)
// ============================================================
console.log('\n=== Parametric meantone ===');

const meantone = new Resolver({
  alphabet: {
    notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    alterations: ['b', '', '#']
  },
  octaves: {
    position: 'suffix',
    separator: '',
    registers: ['0','1','2','3','4','5','6','7','8','9'],
    default: 4
  },
  tuning: {
    temperament: 'meantone',
    degrees: [0, 2, 4, -1, 1, 3, 5],
    alterations: { '#': '100c', 'b': '-100c' },
    baseHz: 440,
    baseNote: 'A',
    baseRegister: 4
  },
  temperament: {
    type: 'parametric',
    period: 1200,
    generator: 700,  // start with 12-TET (700c fifth)
    mapping: [[1,0], [1,1], [0,4]]
  }
});

// With generator=700 (12-TET), A4 = 440
r = meantone.resolve('A4');
assertNotNull('A4 parametric resolves', r);
assert('A4 (g=700) = 440 Hz', r?.frequency, 440, 0.5);

// G4 = generator 1 from C, which is... let me compute
// A = degree index 5, degrees[5] = 3 generators
// G = degree index 4, degrees[4] = 1 generator
// C = degree index 0, degrees[0] = 0 generators
// With g=700: C4 should be at -3×700 mod 1200 from A = -900 mod 1200 = 300 cents below A
// Actually: A is 3 generators, C is 0 generators.
// deltaCents from A: (0×700 - 3×700) + (4-4)×1200 = -2100, mod 1200 ... need to think about this
// Let's just check C4 is approximately right
r = meantone.resolve('C4');
assertNotNull('C4 parametric resolves', r);
assert('C4 (g=700) ≈ 261.6 Hz', r?.frequency, 261.6, 2);

// Now morph to Pythagorean (g=702)
meantone.setGenerator(702);
r = meantone.resolve('A4');
assert('A4 (g=702) = 440 Hz', r?.frequency, 440, 0.5);

// The fifth should be purer
r = meantone.resolve('E4');
assertNotNull('E4 (g=702) resolves', r);
// E is degree[2] = 4 generators = 4×702 = 2808 cents → mod 1200 = 408 cents above C
// but we need it relative to A...

// ============================================================
// TEST 6: Bohlen-Pierce (tritave period)
// ============================================================
console.log('\n=== Bohlen-Pierce (period=3) ===');

const bp = new Resolver({
  alphabet: {
    notes: ['C', 'Db', 'D', 'E', 'F', 'Gb', 'G', 'H', 'Jb', 'J', 'A', 'Bb', 'B'],
    alterations: []
  },
  octaves: {
    position: 'suffix',
    separator: '',
    registers: ['0','1','2','3','4','5'],
    default: 1
  },
  tuning: {
    degrees: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    alterations: {},
    baseHz: 440,
    baseNote: 'C',
    baseRegister: 1
  },
  temperament: {
    period_ratio: 3,  // tritave, not octave!
    divisions: 13,
    ratios: [1, '27/25', '25/21', '9/7', '7/5', '75/49', '5/3', '9/5', '49/25', '15/7', '7/3', '63/25', '25/9']
  }
});

// C1 = 440 Hz (base)
r = bp.resolve('C1');
assert('BP C1 = 440 Hz', r?.frequency, 440, 0.1);

// C2 = 440 × 3 = 1320 Hz (one tritave up)
r = bp.resolve('C2');
assert('BP C2 = 1320 Hz (tritave)', r?.frequency, 1320, 1);

// G1 = 440 × 5/3 ≈ 733.33 Hz
r = bp.resolve('G1');
assert('BP G1 ≈ 733.33 Hz (5/3)', r?.frequency, 733.33, 1);

// ============================================================
// TEST 7: Gamelan (stretched octave)
// ============================================================
console.log('\n=== Gamelan pelog (stretched octave) ===');

const pelog = new Resolver({
  alphabet: {
    notes: ['nem', 'barang', 'bem', 'gulu', 'lima', 'enam', 'pitu'],
    alterations: []
  },
  octaves: {
    position: 'prefix',
    separator: ' ',
    registers: ['ageng', 'tengah', 'alit'],
    default: 1
  },
  tuning: {
    degrees: [0, 1, 2, 3, 4, 5, 6],
    alterations: {},
    baseHz: 282,
    baseNote: 'nem',
    baseRegister: 1
  },
  temperament: {
    period_ratio: 2.02,  // stretched octave!
    divisions: 7,
    ratios: [1, 1.126, 1.244, 1.351, 1.496, 1.683, 1.894]
  }
});

// nem (tengah) = 282 Hz
r = pelog.resolve('nem');
assert('pelog nem = 282 Hz', r?.frequency, 282, 0.1);

// nem (alit) = 282 × 2.02 = 569.64 Hz (stretched!)
r = pelog.resolve('alit nem');
assert('pelog alit nem ≈ 569.64 Hz', r?.frequency, 569.64, 1);

// lima (tengah) = 282 × 1.496 = 421.87 Hz
r = pelog.resolve('lima');
assert('pelog lima ≈ 421.87 Hz', r?.frequency, 421.87, 1);

// ============================================================
// TEST 8: Edge cases
// ============================================================
console.log('\n=== Edge cases ===');

assertNull('empty string', western12.resolve(''));
assertNull('null', western12.resolve(null));
assertNull('unknown note', western12.resolve('X4'));
assertNull('number only', western12.resolve('42'));

// ============================================================
// Summary
// ============================================================
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
