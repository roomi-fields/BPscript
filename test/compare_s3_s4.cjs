#!/usr/bin/env node
/**
 * Compare S3 (WASM timed tokens) vs S4 (WASM + silent.al timed tokens).
 *
 * S3 = timed tokens from p_Instance with simple notes (j >= 16384).
 * S4 = timed tokens from p_Instance with silent sound objects (bols).
 * Both produce [tokenName, start, end] — same format, direct comparison.
 *
 * Token names differ (S3=note names, S4=bol names) but timing should match.
 * Comparison is count + timing only (not token names).
 *
 * Usage: node compare_s3_s4.cjs           (all active grammars)
 *        node compare_s3_s4.cjs drum      (one grammar)
 */
const fs = require('fs');
const path = require('path');

const GRAMMARS = require('./grammars/grammars.json');
const TIME_TOLERANCE_MS = 5;

const arg = process.argv[2];
const names = arg
  ? [arg]
  : Object.entries(GRAMMARS).filter(([k, v]) => v.status === 'active').map(([k]) => k);

const results = { exact: [], timing: [], content: [], count: [], missing: [], skipped: [] };

for (const name of names) {
  const def = GRAMMARS[name];
  if (!def || def.status !== 'active') continue;
  if (def.s3s4_skip) { results.skipped.push({ name, reason: def.s3s4_skip }); continue; }

  const s3Path = path.join(__dirname, 'grammars', name, 'snapshots', 's3_timed.json');
  const s4Path = path.join(__dirname, 'grammars', name, 'snapshots', 's4_silent.json');

  if (!fs.existsSync(s3Path)) { results.missing.push({ name, reason: 'no S3 snapshot' }); continue; }
  if (!fs.existsSync(s4Path)) { results.missing.push({ name, reason: 'no S4 snapshot' }); continue; }

  const s3 = JSON.parse(fs.readFileSync(s3Path, 'utf-8'));
  const s4 = JSON.parse(fs.readFileSync(s4Path, 'utf-8'));

  const mode = def.production_mode || s3.mode || 'midi';
  const s3t = s3.tokens || [];
  const s4t = s4.tokens || [];

  if (s3t.length !== s4t.length) {
    results.count.push({ name, mode, s3: s3t.length, s4: s4t.length });
    continue;
  }

  if (mode === 'midi') {
    // Compare timing only (token names differ: S3=notes, S4=bols)
    let exactMatch = true;
    let timingDiffs = 0;
    let maxTimingDiff = 0;
    let maxDeltaDiff = 0;

    for (let i = 0; i < s3t.length; i++) {
      const st3 = s3t[i][1], en3 = s3t[i][2];
      const st4 = s4t[i][1], en4 = s4t[i][2];

      const absDiff = Math.max(Math.abs(st3 - st4), Math.abs(en3 - en4));
      if (absDiff > maxTimingDiff) maxTimingDiff = absDiff;
      if (absDiff > 0) exactMatch = false;

      if (i > 0) {
        const dSt = Math.abs((st3 - s3t[i-1][1]) - (st4 - s4t[i-1][1]));
        const dEn = Math.abs((en3 - s3t[i-1][2]) - (en4 - s4t[i-1][2]));
        const d = Math.max(dSt, dEn);
        if (d > maxDeltaDiff) maxDeltaDiff = d;
        if (d > TIME_TOLERANCE_MS) timingDiffs++;
      }
      if (i === 0 && absDiff > TIME_TOLERANCE_MS) timingDiffs++;
    }

    if (timingDiffs > 0) {
      results.timing.push({ name, mode, count: s3t.length, timingDiffs, maxMs: maxTimingDiff, maxDelta: maxDeltaDiff });
    } else if (!exactMatch) {
      results.timing.push({ name, mode, count: s3t.length, timingDiffs: 0, maxMs: maxTimingDiff, maxDelta: maxDeltaDiff, note: 'within tolerance' });
    } else {
      results.exact.push({ name, mode, count: s3t.length });
    }

  } else {
    // Text: compare token names directly (S3 and S4 should match)
    let diffs = [];
    for (let i = 0; i < s3t.length; i++) {
      const n3 = (s3t[i][0] || '').replace(/^'(.*)'$/, '$1');
      const n4 = (s4t[i][0] || '').replace(/^'(.*)'$/, '$1');
      if (n3 !== n4) {
        diffs.push({ idx: i, s3: n3, s4: n4 });
        if (diffs.length >= 5) break;
      }
    }

    if (diffs.length > 0) {
      results.content.push({ name, mode, count: s3t.length, diffs });
    } else {
      results.exact.push({ name, mode, count: s3t.length });
    }
  }
}

// === Output ===
console.log('=== S3=S4 EXACT MATCH ===');
for (const r of results.exact) {
  const unit = r.mode === 'midi' ? 'notes' : 'tokens';
  console.log(`  OK  ${r.name.padEnd(22)} ${String(r.count).padStart(6)} ${unit}`);
}

if (results.timing.length) {
  console.log('\n=== TIMING DIFF (count matches, timing differs) ===');
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
      console.log(`        [${d.idx}] S3=${JSON.stringify(d.s3)} S4=${JSON.stringify(d.s4)}`);
    }
  }
}

if (results.count.length) {
  console.log('\n=== COUNT DIFF ===');
  for (const r of results.count) {
    const unit = r.mode === 'midi' ? 'notes' : 'tokens';
    console.log(`  ##  ${r.name.padEnd(22)} S3=${r.s3} S4=${r.s4} ${unit} (diff=${r.s4 - r.s3})`);
  }
}

if (results.missing.length) {
  console.log('\n=== MISSING SNAPSHOTS ===');
  for (const r of results.missing) {
    console.log(`  XX  ${r.name.padEnd(22)} ${r.reason}`);
  }
}

if (results.skipped.length) {
  console.log('\n=== SKIPPED (s3s4_skip) ===');
  for (const r of results.skipped) {
    console.log(`  --  ${r.name.padEnd(22)} ${r.reason.substring(0, 80)}`);
  }
}

// Summary
const total = results.exact.length + results.timing.length + results.content.length + results.count.length;
console.log(`\n=== SUMMARY S3 vs S4 ===`);
console.log(`Compared:       ${total}`);
console.log(`  Exact match:  ${results.exact.length}`);
console.log(`  Timing diff:  ${results.timing.length}`);
console.log(`  Content diff: ${results.content.length}`);
console.log(`  Count diff:   ${results.count.length}`);
console.log(`  Missing:      ${results.missing.length}`);
console.log(`  Skipped:      ${results.skipped.length}`);
