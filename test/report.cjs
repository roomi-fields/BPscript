#!/usr/bin/env node
/**
 * Generate a human-readable report for a grammar.
 * Shows all 4 stages side by side with tokens, names, and timestamps.
 *
 * Usage: node report.cjs drum
 * Output: test/grammars/drum/report.md
 */
const fs = require('fs');
const path = require('path');

const name = process.argv[2];
if (!name) { console.error('Usage: node report.cjs <grammar>'); process.exit(1); }

const dir = path.join(__dirname, 'grammars', name);
const snapDir = path.join(dir, 'snapshots');
const statusFile = path.join(dir, 'status.json');

if (!fs.existsSync(dir)) { console.error(`Not found: ${dir}`); process.exit(1); }

// Load status
let status = {};
if (fs.existsSync(statusFile)) status = JSON.parse(fs.readFileSync(statusFile, 'utf-8'));

// Load snapshots
function loadSnap(file) {
  const f = path.join(snapDir, file);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf-8'));
}

const s1 = loadSnap('s1_native.json');
const s2 = loadSnap('s2_orig.json');
const s3 = loadSnap('s3_silent.json');
const s4 = loadSnap('s4_bps.json');

// Build report
const lines = [];
lines.push(`# ${name} — Test Report`);
lines.push('');
lines.push(`Date: ${status.date || 'unknown'}`);
lines.push(`Result: **${status.s1 === 'PASS' && status.s2 === 'PASS' && status.s3 === 'PASS' && status.s4 === 'PASS' ? 'PASS' : [status.s1, status.s2, status.s3, status.s4].join(' → ')}**`);
lines.push('');

// Source files
lines.push('## Source files');
lines.push('');
if (fs.existsSync(path.join(dir, 'original.gr'))) lines.push('- `original.gr` — grammaire Bernard');
if (fs.existsSync(path.join(dir, 'silent.gr'))) lines.push('- `silent.gr` — réécriture silent sound objects');
if (fs.existsSync(path.join(dir, 'silent.al'))) lines.push('- `silent.al` — alphabet plat');
if (fs.existsSync(path.join(dir, 'scene.bps'))) lines.push('- `scene.bps` — scène BPscript');
lines.push('');

// Stages summary
lines.push('## Stages');
lines.push('');
lines.push(`| Stage | Status | Tokens |`);
lines.push(`|-------|--------|--------|`);
lines.push(`| S1 Native C | ${status.s1 || '?'} | ${s1 ? s1.tokens.length : '-'} |`);
lines.push(`| S2 WASM orig | ${status.s2 || '?'} | ${s2 ? s2.tokens.length : '-'} |`);
lines.push(`| S3 WASM silent | ${status.s3 || '?'} | ${s3 ? s3.tokens.length : '-'} |`);
lines.push(`| S4 BPscript | ${status.s4 || '?'} | ${s4 ? s4.tokens.length : '-'} |`);
lines.push('');

// Token comparison table
lines.push('## Token comparison');
lines.push('');

// Determine max tokens across all stages
const maxLen = Math.max(
  s1 ? s1.tokens.length : 0,
  s2 ? s2.tokens.length : 0,
  s3 ? s3.tokens.length : 0,
  s4 ? s4.tokens.length : 0
);

if (maxLen > 0) {
  // Sort S1 by start time for comparison
  let s1sorted = s1 ? [...s1.tokens].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])) : null;

  lines.push('| # | S1 (C natif) | S2 (WASM orig) | S3 (silent) | S4 (BPscript) |');
  lines.push('|--:|:-------------|:---------------|:------------|:--------------|');

  for (let i = 0; i < maxLen; i++) {
    const t1 = s1sorted && s1sorted[i] ? (s1sorted[i].length >= 3 ? `${s1sorted[i][0]} ${s1sorted[i][1]}-${s1sorted[i][2]}` : `${s1sorted[i][0]} @${s1sorted[i][1]}`) : '';
    const t2 = s2 && s2.tokens[i] ? `${s2.tokens[i][0]} ${s2.tokens[i][1]}-${s2.tokens[i][2]}` : '';
    const t3 = s3 && s3.tokens[i] ? `${s3.tokens[i][0]} ${s3.tokens[i][1]}-${s3.tokens[i][2]}` : '';
    const t4 = s4 && s4.tokens[i] ? `${s4.tokens[i][0]} ${s4.tokens[i][1]}-${s4.tokens[i][2]}` : '';
    lines.push(`| ${i} | ${t1} | ${t2} | ${t3} | ${t4} |`);
  }
} else {
  lines.push('No tokens produced.');
}

lines.push('');

// Settings if available
if (s2 && s2.settings) {
  lines.push('## Settings');
  lines.push('');
  const labels = ['NoteConvention', 'Quantize', 'TimeRes', 'NatureOfTime', 'Seed', 'MaxTime'];
  lines.push(s2.settings.map((v, i) => `${labels[i]}=${v}`).join(', '));
  lines.push('');
}

const report = lines.join('\n');
const reportFile = path.join(dir, 'report.md');
fs.writeFileSync(reportFile, report);
console.log(`Report written: ${name}/report.md`);
