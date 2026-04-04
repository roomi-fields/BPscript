#!/usr/bin/env node
/**
 * test_all.cjs — Run S1 + S2/S3 generation and comparisons in one shot.
 *
 * Optimizations vs running scripts individually:
 *   1. S1 (native) runs in parallel batches (N concurrent bp3 processes)
 *   2. S2/S3 (WASM) runs in parallel batches (N concurrent node processes)
 *   3. Comparisons run at the end (fast, ~1.4s each)
 *
 * WASM note: bp3_init() does NOT fully reset state between grammars,
 * so each grammar runs in its own process (no in-process batching).
 * The speedup comes from parallelism, not from sharing WASM init.
 *
 * Usage:
 *   node test/test_all.cjs              Run all active grammars
 *   node test/test_all.cjs --s1         Only regenerate S1
 *   node test/test_all.cjs --s2         Only regenerate S2/S3
 *   node test/test_all.cjs --compare    Only run comparisons (no regen)
 *   node test/test_all.cjs --jobs=8     Set parallelism (default: 6)
 *   node test/test_all.cjs --bin=v3.3.18-wasm.1  Use specific engine version
 *   node test/test_all.cjs drum harmony Run only named grammars
 */
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const { requireBinTag } = require('./resolve_bin.cjs');

const DIR = __dirname;
const GRAM_DIR = path.join(DIR, 'grammars');
const GRAMMARS = require('./grammars/grammars.json');

// ---- CLI parsing ----
const args = process.argv.slice(2);
let JOBS = 6;
let onlyS1 = false, onlyS2 = false, onlyCompare = false;
const namedGrammars = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--s1') onlyS1 = true;
  else if (a === '--s2') onlyS2 = true;
  else if (a === '--compare') onlyCompare = true;
  else if (a.startsWith('--jobs=')) JOBS = parseInt(a.split('=')[1]) || 6;
  else if (a === '--bin') i++; // skip value, handled by requireBinTag
  else if (a.startsWith('--bin=')) {} // skip, handled by requireBinTag
  else if (!a.startsWith('-')) namedGrammars.push(a);
}

// --bin is mandatory
const binTag = requireBinTag();
const binArgs = ['--bin', binTag];

const doS1 = !onlyS2 && !onlyCompare;
const doS2 = !onlyS1 && !onlyCompare;
const doCompare = !onlyS1 && !onlyS2 || onlyCompare;

// ---- Grammar list ----
const activeNames = namedGrammars.length > 0
  ? namedGrammars
  : Object.keys(GRAMMARS).filter(k => GRAMMARS[k].status === 'active');

// ---- Parallel runner ----
function runParallel(tasks, maxConcurrent) {
  return new Promise((resolve) => {
    const results = new Array(tasks.length);
    let running = 0;
    let nextIdx = 0;
    let completed = 0;

    function startNext() {
      while (running < maxConcurrent && nextIdx < tasks.length) {
        const idx = nextIdx++;
        const task = tasks[idx];
        running++;

        const start = Date.now();
        const child = execFile('node', [path.join(DIR, task.script), task.name, ...binArgs], {
          timeout: task.timeout || 60000,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024
        }, (err, stdout, stderr) => {
          const elapsed = Date.now() - start;
          results[idx] = {
            name: task.name,
            stage: task.stage,
            ok: !err,
            stdout: (stdout || '').trim(),
            stderr: (stderr || '').trim(),
            elapsed
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

// ---- Main ----
async function main() {
  const totalStart = Date.now();
  const versionTag = ` [${binTag}]`;
  console.log(`test_all: ${activeNames.length} grammars, ${JOBS} parallel jobs${versionTag}\n`);

  // ---- S1: Native BP3 ----
  if (doS1) {
    console.log(`--- S1: Native BP3 (${activeNames.length} grammars, ${JOBS} parallel) ---`);
    const s1Start = Date.now();
    const s1Tasks = activeNames.map(name => ({
      name, script: 's1_native.cjs', stage: 'S1', timeout: 120000
    }));
    const s1Results = await runParallel(s1Tasks, JOBS);
    const s1Time = Date.now() - s1Start;

    let s1ok = 0, s1fail = 0;
    for (const r of s1Results) {
      if (r.ok) { s1ok++; }
      else { s1fail++; console.log(`  FAIL S1 ${r.name}: ${r.stderr.substring(0, 80)}`); }
    }
    console.log(`  S1: ${s1ok} OK, ${s1fail} FAIL — ${(s1Time/1000).toFixed(1)}s\n`);
  }

  // ---- S2+S3: WASM ----
  if (doS2) {
    console.log(`--- S2+S3: WASM (${activeNames.length} grammars, ${JOBS} parallel) ---`);
    const s2Start = Date.now();
    const s2Tasks = activeNames.map(name => ({
      name, script: 's2_wasm_orig.cjs', stage: 'S2', timeout: 60000
    }));
    const s2Results = await runParallel(s2Tasks, JOBS);
    const s2Time = Date.now() - s2Start;

    let s2ok = 0, s2fail = 0;
    for (const r of s2Results) {
      if (r.ok) { s2ok++; }
      else { s2fail++; console.log(`  FAIL S2 ${r.name}: ${r.stderr.substring(0, 80)}`); }
    }
    console.log(`  S2: ${s2ok} OK, ${s2fail} FAIL — ${(s2Time/1000).toFixed(1)}s\n`);
  }

  // ---- Comparisons ----
  if (doCompare) {
    console.log('--- Comparisons ---');

    // S1 vs S2
    const cmpStart1 = Date.now();
    const { execSync } = require('child_process');
    try {
      const out = execSync(`node ${path.join(DIR, 'compare_s1_s2.cjs')}`, {
        encoding: 'utf-8', timeout: 30000
      });
      // Extract summary line
      const summary = out.split('\n').filter(l => /Compared:|Exact|Timing|Content|Count|Missing/.test(l));
      for (const l of summary) console.log('  ' + l.trim());
    } catch(e) {
      console.log('  compare_s1_s2 failed');
    }

    // S2 vs S3
    try {
      const out = execSync(`node ${path.join(DIR, 'compare_s2_s3.cjs')}`, {
        encoding: 'utf-8', timeout: 30000
      });
      const summary = out.split('\n').filter(l => /Compared:|Exact|Timing|Content|Count|Missing/.test(l));
      console.log('');
      for (const l of summary) console.log('  ' + l.trim());
    } catch(e) {
      console.log('  compare_s2_s3 failed');
    }
    console.log(`  Comparisons: ${((Date.now()-cmpStart1)/1000).toFixed(1)}s`);
  }

  const totalTime = Date.now() - totalStart;
  console.log(`\nTotal: ${(totalTime/1000).toFixed(1)}s`);
}

main().catch(e => { console.error(e); process.exit(1); });
