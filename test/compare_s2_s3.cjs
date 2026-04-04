#!/usr/bin/env node
/**
 * Compare S2 (WASM MIDI/text) vs S3 (WASM timed tokens).
 *
 * S2 has clean MIDI events or text tokens (same format as S1).
 * S3 has raw timed tokens including note names in native convention.
 *
 * For MIDI grammars: S2=[noteName,start,end] vs S3 timed tokens (filtered, normalized)
 * For text grammars: S2=[name] vs S3=[name,start,end] (compare names only)
 *
 * Normalizations applied to S3 timed tokens:
 *   1. Filter: remove control tokens (_xxx) and silences (-)
 *   2. Note convention: all notes → MIDI number → canonical English name (flats)
 *   3. Enharmonics: A# → Bb, C# → Db, etc.
 *   4. Sort by time, then by note name
 *   5. Quote stripping: '3' → 3
 *
 * Usage: node compare_s2_s3.cjs           (all active grammars)
 *        node compare_s2_s3.cjs drum      (one grammar)
 */
const fs = require('fs');
const path = require('path');

const GRAMMARS = require('./grammars/grammars.json');
const TIME_TOLERANCE_MS = 5;

// === Note normalization ===

const EN_SEMI = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
const FR_SEMI = { 'do': 0, 'ré': 2, 're': 2, 'mi': 4, 'fa': 5, 'sol': 7, 'la': 9, 'si': 11 };
const IN_SEMI = { 'sa': 0, 'ri': 1, 're': 2, 'ga': 3, 'gha': 4, 'ma': 5, 'pa': 7, 'dha': 9, 'ni': 11 };

function parseMidiNote(name) {
  if (!name || typeof name !== 'string') return null;

  let m = name.match(/^([A-G])(#|b|x|bb)?(-?\d+)$/);
  if (m) {
    let semi = EN_SEMI[m[1]];
    if (semi === undefined) return null;
    if (m[2] === '#') semi++;
    else if (m[2] === 'b') semi--;
    else if (m[2] === 'x') semi += 2;
    else if (m[2] === 'bb') semi -= 2;
    return { midi: (parseInt(m[3]) + 1) * 12 + semi };
  }

  m = name.match(/^(do|ré|re|mi|fa|sol|la|si)(#|b)?(-?\d+)$/);
  if (m) {
    let semi = FR_SEMI[m[1]];
    if (semi === undefined) return null;
    if (m[2] === '#') semi++;
    else if (m[2] === 'b') semi--;
    return { midi: (parseInt(m[3]) + 1) * 12 + semi };
  }

  m = name.match(/^(sa|ri|re|ga|gha|ma|pa|dha|ni)(#|b)?(-?\d+)$/);
  if (m) {
    let semi = IN_SEMI[m[1]];
    if (semi === undefined) return null;
    if (m[2] === '#') semi++;
    else if (m[2] === 'b') semi--;
    return { midi: (parseInt(m[3]) + 1) * 12 + semi };
  }

  return null;
}

const MIDI_TO_NAME = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
function midiToCanonical(midi) {
  const oct = Math.floor(midi / 12) - 1;
  const semi = ((midi % 12) + 12) % 12;
  return MIDI_TO_NAME[semi] + oct;
}

function normalizeToken(name) {
  if (!name) return name;
  const unquoted = name.replace(/^'(.*)'$/, '$1');
  const midi = parseMidiNote(unquoted);
  if (midi) return midiToCanonical(midi.midi);
  return unquoted;
}

// === Comparison ===

const arg = process.argv[2];
const names = arg
  ? [arg]
  : Object.entries(GRAMMARS).filter(([k, v]) => v.status === 'active').map(([k]) => k);

const results = { exact: [], timing: [], content: [], count: [], missing: [] };

for (const name of names) {
  const def = GRAMMARS[name];
  if (!def || def.status !== 'active') continue;

  const s2Path = path.join(__dirname, 'grammars', name, 'snapshots', 's2_orig.json');
  const s3Path = path.join(__dirname, 'grammars', name, 'snapshots', 's3_timed.json');

  if (!fs.existsSync(s2Path)) { results.missing.push({ name, reason: 'no S2 snapshot' }); continue; }
  if (!fs.existsSync(s3Path)) { results.missing.push({ name, reason: 'no S3 snapshot' }); continue; }

  const s2 = JSON.parse(fs.readFileSync(s2Path, 'utf-8'));
  const s3 = JSON.parse(fs.readFileSync(s3Path, 'utf-8'));

  const mode = def.production_mode || s2.mode || 'midi';
  const s2t = s2.tokens || [];

  // Filter S3 timed tokens: remove control tokens and silences
  const s3raw = s3.tokens || [];
  const s3filtered = s3raw.filter(t => {
    const tok = t[0] || '';
    return tok !== '-' && tok !== '&' && tok !== '.' && !tok.startsWith('_');
  });

  // Normalize S3 token names
  const s3norm = s3filtered.map(t => ({ name: normalizeToken(t[0]), start: t[1], end: t[2] }));

  if (mode === 'midi') {
    // S2 has [noteName, start, end], S3 has timed tokens normalized to same format
    const s2norm = s2t.map(t => ({ name: t[0], start: t[1], end: t[2] }));

    // Sort both by time then name
    const sortFn = (a, b) => {
      const da = (a.start || 0) - (b.start || 0);
      if (Math.abs(da) > TIME_TOLERANCE_MS) return da;
      return (a.name || '').localeCompare(b.name || '');
    };
    s2norm.sort(sortFn);
    s3norm.sort(sortFn);

    if (s2norm.length !== s3norm.length) {
      results.count.push({ name, mode, s2: s2norm.length, s3: s3norm.length });
      continue;
    }

    let exactMatch = true;
    let timingDiffs = 0;
    let maxTimingDiff = 0;
    let contentDiffs = [];

    for (let i = 0; i < s2norm.length; i++) {
      const n2 = s2norm[i].name;
      const n3 = s3norm[i].name;

      if (n2 !== n3) {
        contentDiffs.push({ idx: i, s2: s2norm[i], s3: s3norm[i] });
        exactMatch = false;
        if (contentDiffs.length >= 5) break;
      } else {
        const dSt = Math.abs((s2norm[i].start || 0) - (s3norm[i].start || 0));
        const dEn = Math.abs((s2norm[i].end || 0) - (s3norm[i].end || 0));
        const d = Math.max(dSt, dEn);
        if (d > maxTimingDiff) maxTimingDiff = d;
        if (dSt > 0 || dEn > 0) exactMatch = false;
        if (dSt > TIME_TOLERANCE_MS || dEn > TIME_TOLERANCE_MS) timingDiffs++;
      }
    }

    if (contentDiffs.length > 0) {
      results.content.push({ name, mode, count: s2norm.length, diffs: contentDiffs });
    } else if (timingDiffs > 0) {
      results.timing.push({ name, mode, count: s2norm.length, timingDiffs, maxMs: maxTimingDiff });
    } else if (!exactMatch) {
      results.timing.push({ name, mode, count: s2norm.length, timingDiffs: 0, maxMs: maxTimingDiff, note: 'within tolerance' });
    } else {
      results.exact.push({ name, mode, count: s2norm.length });
    }

  } else {
    // Text mode: compare token names only
    const s2norm = s2t.map(t => (t[0] || '').replace(/^'(.*)'$/, '$1'));
    const s3names = s3norm.map(t => t.name);

    if (s2norm.length !== s3names.length) {
      results.count.push({ name, mode, s2: s2norm.length, s3: s3names.length });
      continue;
    }

    let diffs = [];
    for (let i = 0; i < s2norm.length; i++) {
      if (s2norm[i] !== s3names[i]) {
        diffs.push({ idx: i, s2: s2norm[i], s3: s3names[i] });
        if (diffs.length >= 5) break;
      }
    }

    if (diffs.length > 0) {
      results.content.push({ name, mode, count: s2norm.length, diffs });
    } else {
      results.exact.push({ name, mode, count: s2norm.length });
    }
  }
}

// === Output ===
console.log('=== S2=S3 EXACT MATCH ===');
for (const r of results.exact) {
  const unit = r.mode === 'midi' ? 'notes' : 'tokens';
  console.log(`  OK  ${r.name.padEnd(22)} ${String(r.count).padStart(6)} ${unit}`);
}

if (results.timing.length) {
  console.log('\n=== TIMING DIFF (content matches, timing differs) ===');
  for (const r of results.timing) {
    console.log(`  ~   ${r.name.padEnd(22)} ${String(r.count).padStart(6)} notes  ${r.timingDiffs} diffs, max ±${r.maxMs}ms ${r.note || ''}`);
  }
}

if (results.content.length) {
  console.log('\n=== CONTENT DIFF ===');
  for (const r of results.content) {
    const unit = r.mode === 'midi' ? 'notes' : 'tokens';
    console.log(`  !!  ${r.name.padEnd(22)} ${String(r.count).padStart(6)} ${unit}  first diffs:`);
    for (const d of r.diffs) {
      console.log(`        [${d.idx}] S2=${JSON.stringify(d.s2)} S3=${JSON.stringify(d.s3)}`);
    }
  }
}

if (results.count.length) {
  console.log('\n=== COUNT DIFF ===');
  for (const r of results.count) {
    const unit = r.mode === 'midi' ? 'notes' : 'tokens';
    console.log(`  ##  ${r.name.padEnd(22)} S2=${r.s2} S3=${r.s3} ${unit} (diff=${r.s3 - r.s2})`);
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
console.log(`\n=== SUMMARY S2 vs S3 ===`);
console.log(`Compared:       ${total}`);
console.log(`  Exact match:  ${results.exact.length}`);
console.log(`  Timing diff:  ${results.timing.length}`);
console.log(`  Content diff: ${results.content.length}`);
console.log(`  Count diff:   ${results.count.length}`);
console.log(`  Missing:      ${results.missing.length}`);
