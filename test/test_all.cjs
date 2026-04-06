#!/usr/bin/env node
/**
 * test_all.cjs — Run S1 + S2/S3 + S4 + S5 generation and comparisons.
 *
 * Optimizations vs running scripts individually:
 *   1. S1 (native) runs in parallel batches (N concurrent bp3 processes)
 *   2. S2/S3 (WASM) runs in parallel batches (N concurrent node processes)
 *   3. S4 (WASM + silent.al) runs in parallel batches
 *   4. S5 (transpiler + WASM) runs in parallel batches
 *   5. Comparisons run at the end (fast, ~1.4s each)
 *
 * WASM note: bp3_init() does NOT fully reset state between grammars,
 * so each grammar runs in its own process (no in-process batching).
 * The speedup comes from parallelism, not from sharing WASM init.
 *
 * Usage:
 *   node test/test_all.cjs --bin last         Run all stages (S1+S2/S3+S4+S5)
 *   node test/test_all.cjs --bin last --s1    Only regenerate S1
 *   node test/test_all.cjs --bin last --s2    Only regenerate S2/S3
 *   node test/test_all.cjs --bin last --s4    Only regenerate S4
 *   node test/test_all.cjs --bin last --s5    Only regenerate S5
 *   node test/test_all.cjs --bin last --compare  Only run comparisons (no regen)
 *   node test/test_all.cjs --bin last --jobs=8   Set parallelism (default: 6)
 *   node test/test_all.cjs --bin last drum harmony  Run only named grammars
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
const selectedStages = new Set();
let onlyCompare = false;
const namedGrammars = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--s1') selectedStages.add('s1');
  else if (a === '--s2') selectedStages.add('s2');
  else if (a === '--s4') selectedStages.add('s4');
  else if (a === '--s5') selectedStages.add('s5');
  else if (a === '--compare') onlyCompare = true;
  else if (a.startsWith('--jobs=')) JOBS = parseInt(a.split('=')[1]) || 6;
  else if (a === '--bin') i++; // skip value, handled by requireBinTag
  else if (a.startsWith('--bin=')) {} // skip, handled by requireBinTag
  else if (!a.startsWith('-')) namedGrammars.push(a);
}

// --bin is mandatory
const binTag = requireBinTag();
const binArgs = ['--bin', binTag];

// If no stage explicitly selected, run all
const runAll = selectedStages.size === 0 && !onlyCompare;
const doS1 = runAll || selectedStages.has('s1');
const doS2 = runAll || selectedStages.has('s2');
const doS4 = runAll || selectedStages.has('s4');
const doS5 = runAll || selectedStages.has('s5');
const doCompare = runAll || onlyCompare;

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

  // ---- S4: WASM + silent.al ----
  if (doS4) {
    console.log(`--- S4: WASM+silent.al (${activeNames.length} grammars, ${JOBS} parallel) ---`);
    const s4Start = Date.now();
    const s4Tasks = activeNames.map(name => ({
      name, script: 's4_wasm_silent.cjs', stage: 'S4', timeout: 60000
    }));
    const s4Results = await runParallel(s4Tasks, JOBS);
    const s4Time = Date.now() - s4Start;

    let s4ok = 0, s4fail = 0, s4skip = 0;
    for (const r of s4Results) {
      if (r.ok) { s4ok++; }
      else if (/SKIP|no silent/.test(r.stderr + r.stdout)) { s4skip++; }
      else { s4fail++; console.log(`  FAIL S4 ${r.name}: ${r.stderr.substring(0, 80)}`); }
    }
    console.log(`  S4: ${s4ok} OK, ${s4fail} FAIL${s4skip ? `, ${s4skip} SKIP` : ''} — ${(s4Time/1000).toFixed(1)}s\n`);
  }

  // ---- S5: BPscript transpiler ----
  if (doS5) {
    console.log(`--- S5: BPscript transpiler (${activeNames.length} grammars, ${JOBS} parallel) ---`);
    const s5Start = Date.now();
    const s5Tasks = activeNames.map(name => ({
      name, script: 's5_bpscript.cjs', stage: 'S5', timeout: 60000
    }));
    const s5Results = await runParallel(s5Tasks, JOBS);
    const s5Time = Date.now() - s5Start;

    let s5ok = 0, s5fail = 0, s5skip = 0;
    for (const r of s5Results) {
      if (r.ok) { s5ok++; }
      else if (/SKIP|no .bps/.test(r.stderr + r.stdout)) { s5skip++; }
      else { s5fail++; console.log(`  FAIL S5 ${r.name}: ${r.stderr.substring(0, 80)}`); }
    }
    console.log(`  S5: ${s5ok} OK, ${s5fail} FAIL${s5skip ? `, ${s5skip} SKIP` : ''} — ${(s5Time/1000).toFixed(1)}s\n`);
  }

  // ---- Comparisons ----
  if (doCompare) {
    console.log('--- Comparisons ---');

    const cmpStart1 = Date.now();
    const { execSync } = require('child_process');

    // S1 vs S2
    try {
      const out = execSync(`node ${path.join(DIR, 'compare_s1_s2.cjs')}`, {
        encoding: 'utf-8', timeout: 30000
      });
      const summary = out.split('\n').filter(l => /Compared:|Exact|Timing|Content|Count|Missing/.test(l));
      console.log('  S1 vs S2:');
      for (const l of summary) console.log('    ' + l.trim());
    } catch(e) {
      console.log('  compare_s1_s2 failed');
    }

    // S2 vs S3
    try {
      const out = execSync(`node ${path.join(DIR, 'compare_s2_s3.cjs')}`, {
        encoding: 'utf-8', timeout: 30000
      });
      const summary = out.split('\n').filter(l => /Compared:|Exact|Timing|Content|Count|Missing/.test(l));
      console.log('  S2 vs S3:');
      for (const l of summary) console.log('    ' + l.trim());
    } catch(e) {
      console.log('  compare_s2_s3 failed');
    }

    // S3 vs S4
    try {
      const out = execSync(`node ${path.join(DIR, 'compare_s3_s4.cjs')}`, {
        encoding: 'utf-8', timeout: 30000
      });
      const summary = out.split('\n').filter(l => /Compared:|Exact|Timing|Content|Count|Missing/.test(l));
      console.log('  S3 vs S4:');
      for (const l of summary) console.log('    ' + l.trim());
    } catch(e) {
      console.log('  compare_s3_s4 failed');
    }

    // S4 vs S5
    try {
      // compare_s4_s5 expects a grammar name, run for each
      let s45exact = 0, s45diff = 0, s45skip = 0, s45total = 0;
      for (const name of activeNames) {
        try {
          const out = execSync(`node ${path.join(DIR, 'compare_s4_s5.cjs')} ${name}`, {
            encoding: 'utf-8', timeout: 10000
          });
          s45total++;
          if (/EXACT|OK/.test(out)) s45exact++;
          else s45diff++;
        } catch(e) {
          const msg = (e.stderr || e.stdout || e.message || '').toString();
          if (/SKIP|missing|no .bps|Not found/.test(msg)) s45skip++;
          else { s45diff++; s45total++; }
        }
      }
      console.log(`  S4 vs S5: ${s45exact}/${s45total} EXACT, ${s45diff} DIFF, ${s45skip} SKIP`);
    } catch(e) {
      console.log('  compare_s4_s5 failed');
    }

    console.log(`  Comparisons: ${((Date.now()-cmpStart1)/1000).toFixed(1)}s`);
  }

  const totalTime = Date.now() - totalStart;
  console.log(`\nTotal: ${(totalTime/1000).toFixed(1)}s`);
}

main().catch(e => { console.error(e); process.exit(1); });
