#!/usr/bin/env node
/**
 * test_all.cjs — Oracle NATIF (décision 2026-06-14-oracle-natif-trois-voies).
 *
 * Le WASM est RETIRÉ du harnais : l'oracle est le bp3 NATIF, la validation passe
 * aux 2 voies BPx (voie A .gr→BPx chez le frontal ; voie B .bps→BPx chez BPx).
 * Ce harnais ne fait plus que produire/contrôler l'oracle natif :
 *   1. S1        — sortie MIDI native (bp3, parallèle)
 *   2. S3-native — timed-tokens natifs (bp3 --tokensout) via s3_native.cjs
 * (Anciens étages WASM S2/S3/S4/S5 + comparateurs s1_s2/s2_s3/s3_s4/s4_s5 supprimés.)
 *
 * Usage:
 *   node test/test_all.cjs --bin last            Oracle natif complet (S1 + S3-native)
 *   node test/test_all.cjs --bin last --s1       Seulement S1 (MIDI natif)
 *   node test/test_all.cjs --bin last --s3native Seulement les timed-tokens natifs
 *   node test/test_all.cjs --bin last --jobs=8   Parallélisme (défaut: 6)
 *   node test/test_all.cjs --bin last drum harmony  Grammaires nommées
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
const namedGrammars = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--s1') selectedStages.add('s1');
  else if (a === '--s3native') selectedStages.add('s3native');
  else if (a.startsWith('--jobs=')) JOBS = parseInt(a.split('=')[1]) || 6;
  else if (a === '--bin') i++; // skip value, handled by requireBinTag
  else if (a.startsWith('--bin=')) {} // skip, handled by requireBinTag
  else if (!a.startsWith('-')) namedGrammars.push(a);
}

// --bin is mandatory
const binTag = requireBinTag();
const binArgs = ['--bin', binTag];

// If no stage explicitly selected, run all
const runAll = selectedStages.size === 0;
const doS1 = runAll || selectedStages.has('s1');
const doS3native = runAll || selectedStages.has('s3native');

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
    // bp3 peut gonfler à ~7 Go (grammaire « watch ») : JAMAIS plus de 2 en parallèle sous peine
    // d'OOM système (cf [231]). Le verrou flock de bp3-guard.sh est le filet infranchissable ;
    // ce cap évite juste de lancer des workers qui attendraient le verrou pour rien.
    const BP3_JOBS = Math.min(JOBS, 2);
    console.log(`--- S1: Native BP3 (${activeNames.length} grammars, ${BP3_JOBS} parallel [cap anti-OOM]) ---`);
    const s1Start = Date.now();
    const s1Tasks = activeNames.map(name => ({
      name, script: 's1_native.cjs', stage: 'S1', timeout: 120000
    }));
    const s1Results = await runParallel(s1Tasks, BP3_JOBS);
    const s1Time = Date.now() - s1Start;

    let s1ok = 0, s1fail = 0;
    for (const r of s1Results) {
      if (r.ok) { s1ok++; }
      else { s1fail++; console.log(`  FAIL S1 ${r.name}: ${r.stderr.substring(0, 80)}`); }
    }
    console.log(`  S1: ${s1ok} OK, ${s1fail} FAIL — ${(s1Time/1000).toFixed(1)}s\n`);
  }

  // ---- S3-native : oracle timed-tokens NATIF (bp3 --tokensout) ----
  // Le WASM (S2/S3/S4/S5) est RETIRÉ (décision oracle-natif-trois-voies) : l'oracle est
  // le bp3 natif ; la validation passe aux 2 voies BPx (voie A .gr→BPx chez le frontal,
  // voie B .bps→BPx chez BPx). Ici on ne produit/contrôle que l'oracle natif.
  if (doS3native) {
    console.log(`--- S3-native : oracle timed-tokens natif (bp3 --tokensout) ---`);
    const t = Date.now();
    try {
      const out = require('child_process').execSync(`node ${path.join(DIR, 's3_native.cjs')} --all`, { encoding: 'utf-8', timeout: 300000 });
      const summary = out.split('\n').filter(l => /MATCH|DIFF|natif/.test(l)).pop();
      if (summary) console.log('  ' + summary.trim());
    } catch (e) { console.log('  s3_native --all: ' + (((e.stdout || e.message) || '') + '').substring(0, 120)); }
    console.log(`  S3-native: ${((Date.now() - t) / 1000).toFixed(1)}s\n`);
  }

  const totalTime = Date.now() - totalStart;
  console.log(`\nTotal: ${(totalTime/1000).toFixed(1)}s`);
}

main().catch(e => { console.error(e); process.exit(1); });
