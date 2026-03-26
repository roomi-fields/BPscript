#!/usr/bin/env node
/**
 * Compare two snapshots.
 *
 * Usage: node compare.cjs <snap1> <snap2> --mode <mode>
 * Modes:
 *   sort_exact   Sort by start time, compare names + start + end (1ms tolerance)
 *   exact        Compare in order: names + start + end (1ms tolerance)
 *   names_only   Compare names only, in order (ignore timestamps)
 *   skip         Don't compare (always returns success)
 *
 * Exit code: 0 = identical, 1 = different, 2 = error
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const modeFlag = process.argv.find(a => a.startsWith('--mode='));
const mode = modeFlag ? modeFlag.split('=')[1] : 'exact';

if (args.length !== 2) {
  console.error('Usage: node compare.cjs <snap1.json> <snap2.json> --mode=<mode>');
  process.exit(2);
}

if (mode === 'skip') {
  console.log('⏭️  SKIP (compare mode)');
  process.exit(0);
}

const file1 = path.resolve(__dirname, args[0]);
const file2 = path.resolve(__dirname, args[1]);

if (!fs.existsSync(file1)) { console.error(`Not found: ${file1}`); process.exit(2); }
if (!fs.existsSync(file2)) { console.error(`Not found: ${file2}`); process.exit(2); }

const snap1 = JSON.parse(fs.readFileSync(file1, 'utf-8'));
const snap2 = JSON.parse(fs.readFileSync(file2, 'utf-8'));

let t1 = snap1.tokens;
let t2 = snap2.tokens;

if (mode === 'sort_exact') {
  const sortFn = (a, b) => (a[1]||0) - (b[1]||0) || a[0].localeCompare(b[0]);
  t1 = [...t1].sort(sortFn);
  t2 = [...t2].sort(sortFn);
}

console.log(`${path.basename(args[0])}: ${t1.length} tokens`);
console.log(`${path.basename(args[1])}: ${t2.length} tokens`);

if (t1.length !== t2.length) {
  console.log(`❌ DIFF count: ${t1.length} vs ${t2.length}`);
  const max = Math.min(5, Math.max(t1.length, t2.length));
  for (let i = 0; i < max; i++) {
    const a = t1[i] ? `${t1[i][0]}@${t1[i][1]||'?'}` : '---';
    const b = t2[i] ? `${t2[i][0]}@${t2[i][1]||'?'}` : '---';
    console.log(`  [${i}] ${a}  vs  ${b}`);
  }
  process.exit(1);
}

const TOLERANCE = 1;
let diffs = 0;
for (let i = 0; i < t1.length; i++) {
  const a = t1[i], b = t2[i];
  const nameOk = a[0] === b[0];

  if (mode === 'names_only') {
    if (!nameOk) {
      if (diffs < 10) console.log(`  [${i}] ❌ name: ${a[0]} ≠ ${b[0]}`);
      diffs++;
    }
    continue;
  }

  // exact or sort_exact: compare names + timestamps
  const aHasTime = a.length >= 2 && typeof a[1] === 'number';
  const bHasTime = b.length >= 2 && typeof b[1] === 'number';
  const startOk = (!aHasTime || !bHasTime) || Math.abs(a[1] - b[1]) <= TOLERANCE;
  const endOk = (!aHasTime || !bHasTime) || (a.length < 3 || b.length < 3) || Math.abs(a[2] - b[2]) <= TOLERANCE;

  if (!nameOk || !startOk || !endOk) {
    if (diffs < 10) {
      const detail = !nameOk ? `name:${a[0]}≠${b[0]}` :
                     !startOk ? `start:${a[1]}≠${b[1]}` :
                     `end:${a[2]}≠${b[2]}`;
      console.log(`  [${i}] ❌ ${a[0]} ${detail}`);
    }
    diffs++;
  }
}

if (diffs === 0) {
  console.log(`✅ IDENTICAL (${t1.length} tokens)`);
  process.exit(0);
} else {
  console.log(`❌ ${diffs} differences out of ${t1.length} tokens`);
  process.exit(1);
}
