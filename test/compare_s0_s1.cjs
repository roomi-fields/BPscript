#!/usr/bin/env node
/**
 * Compare S0 (PHP/bp.exe) vs S1 (native bp3) snapshot CONTENT.
 *
 * Reads:  {grammar}/snapshots/s0_php.json   (from s0_snapshot.cjs)
 *         {grammar}/snapshots/s1_native.json (from s1_native.cjs)
 *
 * MIDI comparison: token-by-token (note name, start_ms, end_ms)
 * Text comparison: token-by-token (terminal symbol)
 *
 * Usage: node compare_s0_s1.cjs           (all active grammars)
 *        node compare_s0_s1.cjs drum      (one grammar)
 */
const fs = require('fs');
const path = require('path');

const GRAMMARS = require('./grammars/grammars.json');
const TIME_TOLERANCE_MS = 2; // allow ±2ms rounding between Windows/Linux

const arg = process.argv[2];
const names = arg
  ? [arg]
  : Object.entries(GRAMMARS).filter(([k,v]) => v.status === 'active' && v.php_ref).map(([k]) => k);

const results = { exact: [], timing: [], content: [], count: [], missing: [], s1only: [] };

for (const name of names) {
  const def = GRAMMARS[name];
  if (!def || def.status !== 'active') continue;

  const s0Path = path.join(__dirname, 'grammars', name, 'snapshots', 's0_php.json');
  const s1Path = path.join(__dirname, 'grammars', name, 'snapshots', 's1_native.json');

  if (!fs.existsSync(s0Path)) {
    if (!def.php_ref) {
      results.s1only.push(name);
    } else {
      results.missing.push({ name, reason: 'no S0 snapshot' });
    }
    continue;
  }
  if (!fs.existsSync(s1Path)) {
    results.missing.push({ name, reason: 'no S1 snapshot' });
    continue;
  }

  const s0 = JSON.parse(fs.readFileSync(s0Path, 'utf-8'));
  const s1 = JSON.parse(fs.readFileSync(s1Path, 'utf-8'));

  const mode = s0.mode;
  const s0t = s0.tokens || [];
  const s1t = s1.tokens || [];

  if (s0t.length !== s1t.length) {
    results.count.push({ name, mode, s0: s0t.length, s1: s1t.length });
    continue;
  }

  if (mode === 'midi') {
    // Compare note name + timing
    let exactMatch = true;
    let timingDiffs = 0;
    let contentDiffs = [];

    for (let i = 0; i < s0t.length; i++) {
      const [n0, st0, en0] = s0t[i];
      const [n1, st1, en1] = s1t[i];

      if (n0 !== n1) {
        contentDiffs.push({ idx: i, s0: s0t[i], s1: s1t[i] });
        exactMatch = false;
        if (contentDiffs.length >= 5) break;
      } else {
        const dSt = Math.abs(st0 - st1);
        const dEn = Math.abs(en0 - en1);
        if (dSt > 0 || dEn > 0) exactMatch = false;
        if (dSt > TIME_TOLERANCE_MS || dEn > TIME_TOLERANCE_MS) {
          timingDiffs++;
        }
      }
    }

    if (contentDiffs.length > 0) {
      results.content.push({ name, mode, count: s0t.length, diffs: contentDiffs });
    } else if (timingDiffs > 0) {
      results.timing.push({ name, mode, count: s0t.length, timingDiffs });
    } else if (!exactMatch) {
      results.timing.push({ name, mode, count: s0t.length, timingDiffs: 0, note: 'within tolerance' });
    } else {
      results.exact.push({ name, mode, count: s0t.length });
    }

  } else {
    // Text: compare token names
    let diffs = [];
    for (let i = 0; i < s0t.length; i++) {
      const n0 = s0t[i][0];
      const n1 = s1t[i][0];
      if (n0 !== n1) {
        diffs.push({ idx: i, s0: n0, s1: n1 });
        if (diffs.length >= 5) break;
      }
    }

    if (diffs.length > 0) {
      results.content.push({ name, mode, count: s0t.length, diffs });
    } else {
      results.exact.push({ name, mode, count: s0t.length });
    }
  }
}

// === Output ===
console.log('=== EXACT MATCH (content identical) ===');
for (const r of results.exact) {
  const unit = r.mode === 'midi' ? 'notes' : 'tokens';
  console.log(`  OK  ${r.name.padEnd(22)} ${String(r.count).padStart(6)} ${unit}`);
}

if (results.timing.length) {
  console.log('\n=== TIMING DIFF (notes match, timing differs) ===');
  for (const r of results.timing) {
    console.log(`  ~   ${r.name.padEnd(22)} ${String(r.count).padStart(6)} notes  ${r.timingDiffs} timing diffs ${r.note || ''}`);
  }
}

if (results.content.length) {
  console.log('\n=== CONTENT DIFF (different notes/tokens) ===');
  for (const r of results.content) {
    const unit = r.mode === 'midi' ? 'notes' : 'tokens';
    console.log(`  !!  ${r.name.padEnd(22)} ${String(r.count).padStart(6)} ${unit}  first diffs:`);
    for (const d of r.diffs) {
      console.log(`        [${d.idx}] S0=${JSON.stringify(d.s0)} S1=${JSON.stringify(d.s1)}`);
    }
  }
}

if (results.count.length) {
  console.log('\n=== COUNT DIFF (different number of tokens) ===');
  for (const r of results.count) {
    const unit = r.mode === 'midi' ? 'notes' : 'tokens';
    console.log(`  ##  ${r.name.padEnd(22)} S0=${r.s0} S1=${r.s1} ${unit} (diff=${r.s1 - r.s0})`);
  }
}

if (results.missing.length) {
  console.log('\n=== MISSING SNAPSHOTS ===');
  for (const r of results.missing) {
    console.log(`  XX  ${r.name.padEnd(22)} ${r.reason}`);
  }
}

if (results.s1only.length) {
  console.log('\n=== S1 ONLY (no S0 ref) ===');
  for (const n of results.s1only) console.log(`  --  ${n}`);
}

// Summary
const total = results.exact.length + results.timing.length + results.content.length + results.count.length;
console.log(`\n=== SUMMARY ===`);
console.log(`Compared:       ${total}`);
console.log(`  Exact match:  ${results.exact.length}`);
console.log(`  Timing diff:  ${results.timing.length}`);
console.log(`  Content diff: ${results.content.length}`);
console.log(`  Count diff:   ${results.count.length}`);
console.log(`  Missing:      ${results.missing.length}`);
console.log(`  S1-only:      ${results.s1only.length}`);
