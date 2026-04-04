#!/usr/bin/env node
/**
 * Compare S0 snapshots between two bp.exe versions.
 *
 * Usage:
 *   node test/compare_s0_versions.cjs v3.3.18-wasm.1 v3.3.19
 *   node test/compare_s0_versions.cjs v3.3.18-wasm.1 v3.3.19 --jobs=6
 *   node test/compare_s0_versions.cjs v3.3.18-wasm.1 v3.3.19 drum harmony
 */
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const GRAM_DIR = path.join(DIR, 'grammars');
const GRAMMARS = require('./grammars/grammars.json');

// ---- CLI ----
const args = process.argv.slice(2);
let JOBS = 6;
const versions = [];
const namedGrammars = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--jobs=')) JOBS = parseInt(a.split('=')[1]) || 6;
  else if (!a.startsWith('-')) {
    // First two positional args are versions, rest are grammar names
    if (versions.length < 2) versions.push(a);
    else namedGrammars.push(a);
  }
}

if (versions.length < 2) {
  console.error('Usage: node compare_s0_versions.cjs <version-A> <version-B> [grammar...] [--jobs=N]');
  process.exit(1);
}
const [versionA, versionB] = versions;

const activeNames = namedGrammars.length > 0
  ? namedGrammars
  : Object.keys(GRAMMARS).filter(k => GRAMMARS[k].status === 'active' && GRAMMARS[k].php_ref);

// ---- Temp dirs ----
const DIR_A = `/tmp/_s0_compare_A`;
const DIR_B = `/tmp/_s0_compare_B`;
fs.mkdirSync(DIR_A, { recursive: true });
fs.mkdirSync(DIR_B, { recursive: true });

// ---- Parallel runner ----
function runParallel(tasks, maxConcurrent) {
  return new Promise((resolve) => {
    const results = new Array(tasks.length);
    let running = 0, nextIdx = 0, completed = 0;
    function startNext() {
      while (running < maxConcurrent && nextIdx < tasks.length) {
        const idx = nextIdx++;
        const task = tasks[idx];
        running++;
        const start = Date.now();
        execFile('node', task.args, {
          timeout: task.timeout || 120000,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024
        }, (err, stdout, stderr) => {
          results[idx] = {
            name: task.name,
            ok: !err,
            stdout: (stdout || '').trim(),
            stderr: (stderr || '').trim(),
            elapsed: Date.now() - start
          };
          running--;
          completed++;
          if (completed === tasks.length) resolve(results);
          else startNext();
        });
      }
    }
    startNext();
  });
}

async function generateS0(version, tmpDir) {
  const tasks = activeNames.map(name => ({
    name,
    args: [path.join(DIR, 's0_snapshot.cjs'), name, '--bin', version],
    timeout: 120000
  }));
  const results = await runParallel(tasks, JOBS);
  let ok = 0, fail = 0;
  for (const r of results) {
    if (r.ok) {
      ok++;
      const snap = path.join(GRAM_DIR, r.name, 'snapshots', 's0_php.json');
      if (fs.existsSync(snap)) {
        fs.copyFileSync(snap, path.join(tmpDir, `${r.name}.json`));
      }
    } else {
      fail++;
      console.log(`  FAIL ${r.name}: ${r.stderr.substring(0, 80)}`);
    }
  }
  return { ok, fail };
}

// ---- Main ----
async function main() {
  const totalStart = Date.now();
  console.log(`Comparing S0: ${versionA} vs ${versionB} — ${activeNames.length} grammars, ${JOBS} jobs\n`);

  // Step 1: Generate S0 with version A
  console.log(`--- S0 ${versionA} ---`);
  const tA = Date.now();
  const rA = await generateS0(versionA, DIR_A);
  console.log(`  ${rA.ok} OK, ${rA.fail} FAIL — ${((Date.now()-tA)/1000).toFixed(1)}s\n`);

  // Step 2: Generate S0 with version B
  console.log(`--- S0 ${versionB} ---`);
  const tB = Date.now();
  const rB = await generateS0(versionB, DIR_B);
  console.log(`  ${rB.ok} OK, ${rB.fail} FAIL — ${((Date.now()-tB)/1000).toFixed(1)}s\n`);

  // Step 3: Compare
  console.log(`=== ${versionA} vs ${versionB} ===\n`);

  let exact = 0, timing = 0, content = 0, count = 0, missing = 0;
  const exactList = [], timingList = [], contentList = [], countList = [], missingList = [];

  for (const name of activeNames) {
    const fileA = path.join(DIR_A, `${name}.json`);
    const fileB = path.join(DIR_B, `${name}.json`);

    if (!fs.existsSync(fileA) && !fs.existsSync(fileB)) {
      missing++; missingList.push({ name, which: 'both' }); continue;
    }
    if (!fs.existsSync(fileA)) {
      missing++; missingList.push({ name, which: versionA }); continue;
    }
    if (!fs.existsSync(fileB)) {
      missing++; missingList.push({ name, which: versionB }); continue;
    }

    const a = JSON.parse(fs.readFileSync(fileA, 'utf-8'));
    const b = JSON.parse(fs.readFileSync(fileB, 'utf-8'));
    const tokA = a.tokens || [];
    const tokB = b.tokens || [];

    if (tokA.length !== tokB.length) {
      count++;
      countList.push({ name, a: tokA.length, b: tokB.length, diff: tokB.length - tokA.length });
      continue;
    }

    let nameDiffs = 0, timingDiffs = 0, maxTimeDiff = 0;
    const firstDiffs = [];
    for (let i = 0; i < tokA.length; i++) {
      const ra = tokA[i], rb = tokB[i];
      const nameMatch = ra[0] === rb[0];
      if (!nameMatch) nameDiffs++;

      if (ra.length >= 3 && rb.length >= 3) {
        const td = Math.max(Math.abs(ra[1] - rb[1]), Math.abs(ra[2] - rb[2]));
        if (td > 0) timingDiffs++;
        if (td > maxTimeDiff) maxTimeDiff = td;
      }

      if ((!nameMatch || (ra.length >= 3 && rb.length >= 3 && (ra[1] !== rb[1] || ra[2] !== rb[2]))) && firstDiffs.length < 5) {
        firstDiffs.push({ i, a: ra, b: rb });
      }
    }

    if (nameDiffs === 0 && timingDiffs === 0) {
      exact++; exactList.push({ name, count: tokA.length });
    } else if (nameDiffs === 0 && timingDiffs > 0) {
      timing++; timingList.push({ name, count: tokA.length, timingDiffs, maxTimeDiff, firstDiffs });
    } else {
      content++; contentList.push({ name, count: tokA.length, nameDiffs, timingDiffs, firstDiffs });
    }
  }

  // Print results
  if (exactList.length > 0) {
    console.log('=== EXACT MATCH ===');
    for (const e of exactList) {
      const unit = GRAMMARS[e.name]?.production_mode === 'text' ? 'tokens' : 'notes';
      console.log(`  OK  ${e.name.padEnd(22)} ${String(e.count).padStart(6)} ${unit}`);
    }
    console.log('');
  }

  if (timingList.length > 0) {
    console.log('=== TIMING DIFF (names match, timing differs) ===');
    for (const t of timingList) {
      console.log(`  ~   ${t.name.padEnd(22)} ${String(t.count).padStart(6)} notes  ${t.timingDiffs} diffs, max ±${t.maxTimeDiff}ms`);
      for (const d of t.firstDiffs) {
        console.log(`        [${d.i}] ${versionA}=${JSON.stringify(d.a)} ${versionB}=${JSON.stringify(d.b)}`);
      }
    }
    console.log('');
  }

  if (contentList.length > 0) {
    console.log('=== CONTENT DIFF ===');
    for (const c of contentList) {
      console.log(`  !!  ${c.name.padEnd(22)} ${String(c.count).padStart(6)} items  ${c.nameDiffs} name diffs, ${c.timingDiffs} timing diffs`);
      for (const d of c.firstDiffs) {
        console.log(`        [${d.i}] ${versionA}=${JSON.stringify(d.a)} ${versionB}=${JSON.stringify(d.b)}`);
      }
    }
    console.log('');
  }

  if (countList.length > 0) {
    console.log('=== COUNT DIFF ===');
    for (const c of countList) {
      const unit = GRAMMARS[c.name]?.production_mode === 'text' ? 'tokens' : 'notes';
      console.log(`  ##  ${c.name.padEnd(22)} ${versionA}=${c.a} ${versionB}=${c.b} ${unit} (diff=${c.diff > 0 ? '+' : ''}${c.diff})`);
    }
    console.log('');
  }

  if (missingList.length > 0) {
    console.log('=== MISSING ===');
    for (const m of missingList) {
      console.log(`  ??  ${m.name} (${m.which} failed)`);
    }
    console.log('');
  }

  console.log(`=== SUMMARY: ${versionA} vs ${versionB} ===`);
  console.log(`Compared:       ${activeNames.length}`);
  console.log(`  Exact match:  ${exact}`);
  console.log(`  Timing diff:  ${timing}`);
  console.log(`  Content diff: ${content}`);
  console.log(`  Count diff:   ${count}`);
  console.log(`  Missing:      ${missing}`);
  console.log(`\nTotal: ${((Date.now()-totalStart)/1000).toFixed(1)}s`);
}

main().catch(e => { console.error(e); process.exit(1); });
