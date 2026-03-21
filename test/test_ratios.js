/**
 * Tests for ratio normalizer
 * Run: node test/test_ratios.js
 */

import { normalizeRatio, normalizeRatios, normalizeTemperament, normalizeTuning } from '../src/dispatcher/ratios.js';

let passed = 0;
let failed = 0;

function assert(label, actual, expected, tolerance = 0.0001) {
  const ok = Math.abs(actual - expected) < tolerance;
  if (ok) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`);
  }
}

function assertNaN(label, actual) {
  if (isNaN(actual)) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${label} — expected NaN, got ${actual}`);
  }
}

// --- Fractions ---
assert('9/8', normalizeRatio('9/8'), 1.125);
assert('3/2', normalizeRatio('3/2'), 1.5);
assert('256/243', normalizeRatio('256/243'), 256 / 243);
assert('4/3', normalizeRatio('4/3'), 4 / 3);
assert('1/1', normalizeRatio('1/1'), 1.0);
assert('25/24', normalizeRatio('25/24'), 25 / 24);
assert('2048/2187', normalizeRatio('2048/2187'), 2048 / 2187);

// --- Cents ---
assert('0c', normalizeRatio('0c'), 1.0);
assert('100c', normalizeRatio('100c'), Math.pow(2, 100 / 1200));
assert('1200c', normalizeRatio('1200c'), 2.0);
assert('50c (quarter tone)', normalizeRatio('50c'), Math.pow(2, 50 / 1200));
assert('-100c', normalizeRatio('-100c'), Math.pow(2, -100 / 1200));
assert('22.642c (Holdrian comma)', normalizeRatio('22.642c'), Math.pow(2, 22.642 / 1200));
assert('701.887c (53-TET fifth)', normalizeRatio('701.887c'), Math.pow(2, 701.887 / 1200));

// --- Decimals ---
assert('1.05946 (decimal)', normalizeRatio(1.05946), 1.05946);
assert('1 (integer)', normalizeRatio(1), 1.0);
assert('2.02 (stretched octave)', normalizeRatio(2.02), 2.02);
assert('0 (zero)', normalizeRatio(0), 0);

// --- String decimals ---
assert('"1.125" string', normalizeRatio('1.125'), 1.125);
assert('"2" string', normalizeRatio('2'), 2.0);

// --- Edge cases ---
assertNaN('empty string', normalizeRatio(''));
assertNaN('garbage', normalizeRatio('abc'));
assertNaN('null', normalizeRatio(null));
assertNaN('undefined', normalizeRatio(undefined));
assertNaN('bad fraction', normalizeRatio('9/0'));

// --- normalizeRatios ---
const arr = normalizeRatios([1, '9/8', '100c', 1.5]);
assert('array[0]', arr[0], 1.0);
assert('array[1]', arr[1], 1.125);
assert('array[2]', arr[2], Math.pow(2, 100 / 1200));
assert('array[3]', arr[3], 1.5);

// --- normalizeTemperament ---
const temp = normalizeTemperament({
  period_ratio: 2,
  divisions: 3,
  ratios: [1, '9/8', '100c']
});
assert('temperament[0]', temp.ratios[0], 1.0);
assert('temperament[1]', temp.ratios[1], 1.125);
assert('temperament[2]', temp.ratios[2], Math.pow(2, 100 / 1200));

// --- normalizeTuning ---
const tuning = normalizeTuning({
  temperament: '12TET',
  degrees: [0, 2, 4],
  alterations: { '#': '25/24', 'b': '24/25', 'half_#': '50c' }
});
assert('tuning alt #', tuning.alterations['#'], 25 / 24);
assert('tuning alt b', tuning.alterations['b'], 24 / 25);
assert('tuning alt half_#', tuning.alterations['half_#'], Math.pow(2, 50 / 1200));

// --- Cross-check: 12-TET consistency ---
// In 12-TET, 700c should equal 3/2 in Pythagorean... no, 700c = 2^(7/12) ≈ 1.4983
// and 3/2 = 1.5. They're close but different (that's the whole point of temperaments)
const tet_fifth = normalizeRatio('700c');
const just_fifth = normalizeRatio('3/2');
assert('12-TET fifth ≈ 1.4983', tet_fifth, 1.4983, 0.0001);
assert('just fifth = 1.5', just_fifth, 1.5);
const diff_cents = 1200 * Math.log2(just_fifth / tet_fifth);
assert('Pythagorean comma ≈ 1.96 cents', diff_cents, 1.955, 0.01);

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
