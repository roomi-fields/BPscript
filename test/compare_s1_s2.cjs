#!/usr/bin/env node
/**
 * Compare S1 (native bp3) vs S2 (WASM bp3) — same output format.
 *
 * S1 and S2 both produce: MIDI events [noteName, start, end] or text tokens [name].
 * Comparison is direct (same format), like S0 vs S1.
 *
 * Reads:  {grammar}/snapshots/s1_native.json
 *         {grammar}/snapshots/s2_orig.json
 *
 * Usage: node compare_s1_s2.cjs           (all active grammars)
 *        node compare_s1_s2.cjs drum      (one grammar)
 */
const fs = require('fs');
const path = require('path');

const GRAMMARS = require('./grammars/grammars.json');
const TIME_TOLERANCE_MS = 5; // per-event delta tolerance (WASM vs native tick→ms rounding)

// Normalize enharmonics: sharps → flats (S1 may use sharps, S2 uses flats)
const ENHARMONIC = { 'C#': 'Db', 'D#': 'Eb', 'E#': 'F', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb', 'B#': 'C' };
function normalizeNote(name) {
  if (!name) return name;
  const m = name.match(/^([A-G]#)(-?\d+)$/);
  if (m && ENHARMONIC[m[1]]) return ENHARMONIC[m[1]] + m[2];
  return name;
}

const arg = process.argv[2];
const names = arg
  ? [arg]
  : Object.entries(GRAMMARS).filter(([k, v]) => v.status === 'active').map(([k]) => k);

const results = { exact: [], timing: [], content: [], count: [], missing: [] };

for (const name of names) {
  const def = GRAMMARS[name];
  if (!def || def.status !== 'active') continue;

  const s1Path = path.join(__dirname, 'grammars', name, 'snapshots', 's1_native.json');
  const s2Path = path.join(__dirname, 'grammars', name, 'snapshots', 's2_orig.json');

  if (!fs.existsSync(s1Path)) { results.missing.push({ name, reason: 'no S1 snapshot' }); continue; }
  if (!fs.existsSync(s2Path)) { results.missing.push({ name, reason: 'no S2 snapshot' }); continue; }

  const s1 = JSON.parse(fs.readFileSync(s1Path, 'utf-8'));
  const s2 = JSON.parse(fs.readFileSync(s2Path, 'utf-8'));

  const mode = def.production_mode || s1.mode || 'midi';
  const s1t = s1.tokens || [];
  const s2t = s2.tokens || [];

  if (s1t.length !== s2t.length) {
    results.count.push({ name, mode, s1: s1t.length, s2: s2t.length });
    continue;
  }

  if (mode === 'midi') {
    // Compare note name + timing (both are [noteName, start, end]).
    // Use DELTA-based comparison: S1 timestamps come from MIDI ticks where
    // ms_per_tick may not be exactly 1.0 (e.g. Pclock/Qclock=3/11 → ratio 1.002673).
    // This causes cumulative drift in absolute timestamps, but individual deltas
    // between consecutive events remain within ±2ms. Comparing deltas avoids
    // false TIMING_DIFF classifications from tick→ms rounding accumulation.
    let exactMatch = true;
    let timingDiffs = 0;
    let maxDeltaDiff = 0;
    let maxAbsDiff = 0;
    let contentDiffs = [];

    for (let i = 0; i < s1t.length; i++) {
      const [rawN1, st1, en1] = s1t[i];
      const [rawN2, st2, en2] = s2t[i];
      const n1 = normalizeNote(rawN1);
      const n2 = normalizeNote(rawN2);

      if (n1 !== n2) {
        contentDiffs.push({ idx: i, s1: s1t[i], s2: s2t[i] });
        exactMatch = false;
        if (contentDiffs.length >= 5) break;
      } else {
        // Track absolute diff (for reporting)
        const absDiff = Math.max(Math.abs(st1 - st2), Math.abs(en1 - en2));
        if (absDiff > maxAbsDiff) maxAbsDiff = absDiff;
        if (absDiff > 0) exactMatch = false;

        // Delta-based comparison: compare intervals between consecutive events
        if (i > 0) {
          const deltaSt1 = st1 - s1t[i-1][1];
          const deltaSt2 = st2 - s2t[i-1][1];
          const deltaEn1 = en1 - s1t[i-1][2];
          const deltaEn2 = en2 - s2t[i-1][2];
          const dSt = Math.abs(deltaSt1 - deltaSt2);
          const dEn = Math.abs(deltaEn1 - deltaEn2);
          const d = Math.max(dSt, dEn);
          if (d > maxDeltaDiff) maxDeltaDiff = d;
          if (d > TIME_TOLERANCE_MS) timingDiffs++;
        }
        // Also check first event absolute timing
        if (i === 0 && absDiff > TIME_TOLERANCE_MS) timingDiffs++;
      }
    }

    if (contentDiffs.length > 0) {
      results.content.push({ name, mode, count: s1t.length, diffs: contentDiffs });
    } else if (timingDiffs > 0) {
      results.timing.push({ name, mode, count: s1t.length, timingDiffs, maxMs: maxAbsDiff, maxDelta: maxDeltaDiff });
    } else if (!exactMatch) {
      results.timing.push({ name, mode, count: s1t.length, timingDiffs: 0, maxMs: maxAbsDiff, maxDelta: maxDeltaDiff, note: 'within tolerance' });
    } else {
      results.exact.push({ name, mode, count: s1t.length });
    }

  } else {
    // Text: compare token names
    let diffs = [];
    for (let i = 0; i < s1t.length; i++) {
      const n1 = (s1t[i][0] || '').replace(/^'(.*)'$/, '$1');
      const n2 = (s2t[i][0] || '').replace(/^'(.*)'$/, '$1');
      if (n1 !== n2) {
        diffs.push({ idx: i, s1: n1, s2: n2 });
        if (diffs.length >= 5) break;
      }
    }

    if (diffs.length > 0) {
      results.content.push({ name, mode, count: s1t.length, diffs });
    } else {
      results.exact.push({ name, mode, count: s1t.length });
    }
  }
}

// === Output ===
console.log('=== S1=S2 EXACT MATCH ===');
for (const r of results.exact) {
  const unit = r.mode === 'midi' ? 'notes' : 'tokens';
  console.log(`  OK  ${r.name.padEnd(22)} ${String(r.count).padStart(6)} ${unit}`);
}

if (results.timing.length) {
  console.log('\n=== TIMING DIFF (notes match, timing differs) ===');
  for (const r of results.timing) {
    const delta = r.maxDelta !== undefined ? ` (maxΔ=${r.maxDelta}ms)` : '';
    console.log(`  ~   ${r.name.padEnd(22)} ${String(r.count).padStart(6)} notes  ${r.timingDiffs} diffs, max ±${r.maxMs}ms${delta} ${r.note || ''}`);
  }
}

if (results.content.length) {
  console.log('\n=== CONTENT DIFF ===');
  for (const r of results.content) {
    const unit = r.mode === 'midi' ? 'notes' : 'tokens';
    console.log(`  !!  ${r.name.padEnd(22)} ${String(r.count).padStart(6)} ${unit}  first diffs:`);
    for (const d of r.diffs) {
      console.log(`        [${d.idx}] S1=${JSON.stringify(d.s1)} S2=${JSON.stringify(d.s2)}`);
    }
  }
}

if (results.count.length) {
  console.log('\n=== COUNT DIFF ===');
  for (const r of results.count) {
    const unit = r.mode === 'midi' ? 'notes' : 'tokens';
    console.log(`  ##  ${r.name.padEnd(22)} S1=${r.s1} S2=${r.s2} ${unit} (diff=${r.s2 - r.s1})`);
  }
}

if (results.missing.length) {
  console.log('\n=== MISSING SNAPSHOTS ===');
  for (const r of results.missing) {
    console.log(`  XX  ${r.name.padEnd(22)} ${r.reason}`);
  }
}

// Summary
const total = results.exact.length + results.timing.length + results.content.length + results.count.length;
console.log(`\n=== SUMMARY S1 vs S2 ===`);
console.log(`Compared:       ${total}`);
console.log(`  Exact match:  ${results.exact.length}`);
console.log(`  Timing diff:  ${results.timing.length}`);
console.log(`  Content diff: ${results.content.length}`);
console.log(`  Count diff:   ${results.count.length}`);
console.log(`  Missing:      ${results.missing.length}`);
