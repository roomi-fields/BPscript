#!/usr/bin/env node
/**
 * Pipeline runner — orchestrates S1→S2→S3→S4 and comparisons.
 *
 * Usage:
 *   node runner.cjs drum          Run full pipeline for drum
 *   node runner.cjs --check       Regression check on all PASS grammars
 *   node runner.cjs --status      Show status of all grammars
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const TD = path.resolve(DIR, '..', '..', '..', 'bp3-engine', 'test-data');

function run(script, name) {
  try {
    const out = execSync(`node ${path.join(DIR, script)} ${name}`, {
      timeout: 90000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
    });
    process.stdout.write(out);
    return true;
  } catch (e) {
    process.stdout.write(e.stdout || '');
    process.stderr.write(e.stderr || '');
    return false;
  }
}

function compare(file1, file2, flags) {
  try {
    const out = execSync(`node ${path.join(DIR, 'compare.cjs')} ${file1} ${file2} ${flags || ''}`, {
      cwd: DIR, timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
    });
    process.stdout.write('  ' + out.split('\n').join('\n  ').trim() + '\n');
    return true;
  } catch (e) {
    process.stdout.write('  ' + (e.stdout || '').split('\n').join('\n  ').trim() + '\n');
    return false;
  }
}

function runPipeline(name) {
  const gramDir = path.join(DIR, name);
  const snapDir = path.join(gramDir, 'snapshots');

  // Load previous status to preserve manual annotations
  const prevFile = path.join(gramDir, 'status.json');
  const prev = fs.existsSync(prevFile) ? JSON.parse(fs.readFileSync(prevFile, 'utf-8')) : {};
  const status = { grammar: name, date: new Date().toISOString().substring(0, 10) };

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Pipeline: ${name}`);
  console.log('='.repeat(50));

  // S1
  console.log('\n--- S1: Native C ---');
  status.s1 = run('s1_native.cjs', name) ? 'PASS' : 'FAIL';
  if (status.s1 === 'FAIL' && prev.s1 === 'FAIL') { status.s1 = prev.s1; }
  if (status.s1 === 'FAIL') { save(gramDir, status); return status; }

  // S2
  if (prev.s2 === 'SKIP' || prev.s2 === 'DEGRADED') {
    console.log(`\n--- S2: ${prev.s2} (preserved) ---`);
    status.s2 = prev.s2;
  } else {
    console.log('\n--- S2: WASM original ---');
    status.s2 = run('s2_wasm_orig.cjs', name) ? 'PASS' : 'FAIL';
    if (status.s2 === 'FAIL') { save(gramDir, status); return status; }
  }

  // Compare S1 → S2 using mode from status.json
  const s1s2mode = status.s1_s2_mode || prev.s1_s2_mode || 'skip';
  status.s1_s2_mode = s1s2mode;
  console.log(`\n--- Compare S1 → S2 (mode: ${s1s2mode}) ---`);
  const s1s2 = compare(`${name}/snapshots/s1_native.json`, `${name}/snapshots/s2_orig.json`, `--mode=${s1s2mode}`);
  status.s1_vs_s2 = s1s2mode === 'skip' ? (prev.s1_vs_s2 || 'SKIP') : (s1s2 ? 'PASS' : 'DIFF');

  // S3
  const silentGr = path.join(gramDir, 'silent.gr');
  if (fs.existsSync(silentGr)) {
    console.log('\n--- S3: WASM silent objects ---');
    status.s3 = run('s3_wasm_silent.cjs', name) ? 'PASS' : 'FAIL';
    if (status.s3 === 'FAIL') { save(gramDir, status); return status; }

    const s2s3mode = status.s2_s3_mode || prev.s2_s3_mode || 'skip';
    status.s2_s3_mode = s2s3mode;
    console.log(`\n--- Compare S2 → S3 (mode: ${s2s3mode}) ---`);
    const s2s3 = compare(`${name}/snapshots/s2_orig.json`, `${name}/snapshots/s3_silent.json`, `--mode=${s2s3mode}`);
    status.s2_vs_s3 = s2s3mode === 'skip' ? (prev.s2_vs_s3 || 'SKIP') : (s2s3 ? 'PASS' : 'DIFF');
    if (!s2s3 && s2s3mode !== 'skip') { save(gramDir, status); return status; }
  } else {
    console.log('\n--- S3: SKIP (no silent.gr) ---');
    status.s3 = 'TODO';
  }

  // S4
  // Look for .bps by scene name (may differ from grammar name)
  const sceneName = prev.bpsScene || name;
  const bpsFile = path.join(DIR, '..', '..', 'scenes', `${sceneName}.bps`);
  if (fs.existsSync(bpsFile)) {
    console.log('\n--- S4: BPscript ---');
    status.s4 = run('s4_bpscript.cjs', sceneName) ? 'PASS' : 'FAIL';
    if (status.s4 === 'FAIL') { save(gramDir, status); return status; }

    // Compare S3 → S4 (use S3 snapshot from this grammar's dir, S4 from scene dir)
    const s3Snap = path.join(snapDir, 's3_silent.json');
    const s4Snap = path.join(DIR, sceneName, 'snapshots', 's4_bps.json');
    if (fs.existsSync(s3Snap) && fs.existsSync(s4Snap)) {
      const s3s4mode = status.s3_s4_mode || prev.s3_s4_mode || 'exact';
      status.s3_s4_mode = s3s4mode;
      console.log(`\n--- Compare S3 → S4 (mode: ${s3s4mode}) ---`);
      const cmp = compare(`${name}/snapshots/s3_silent.json`, `${sceneName}/snapshots/s4_bps.json`, `--mode=${s3s4mode}`);
      status.s3_vs_s4 = s3s4mode === 'skip' ? (prev.s3_vs_s4 || 'SKIP') : (cmp ? 'PASS' : 'DIFF');
      if (!cmp && s3s4mode !== 'skip') { save(gramDir, status); return status; }
    }
  } else {
    console.log('\n--- S4: SKIP (no .bps) ---');
    status.s4 = 'TODO';
  }

  // Copy source files into test directory for visibility
  const MAP = require('./map.json');
  const grName = MAP[name] || name;
  const grFile = path.join(TD, `-gr.${grName}`);
  if (grName && fs.existsSync(grFile)) {
    const dest = path.join(gramDir, 'original.gr');
    if (!fs.existsSync(dest)) fs.copyFileSync(grFile, dest);
  }
  const bpsDest = path.join(gramDir, 'scene.bps');
  const bpsSrc = path.join(DIR, '..', '..', 'scenes', `${name}.bps`);
  if (fs.existsSync(bpsSrc) && !fs.existsSync(bpsDest)) fs.copyFileSync(bpsSrc, bpsDest);

  // Generate report
  save(gramDir, status);
  try { execSync(`node ${path.join(DIR, 'report.cjs')} ${name}`, { stdio: 'pipe' }); } catch(e) {}

  // Summary
  const stages = [status.s1, status.s2, status.s3, status.s4];
  const allPass = stages.every(s => s === 'PASS');
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${name}: ${allPass ? '✅ PASS' : stages.join(' → ')}`);
  console.log('='.repeat(50));

  generateResultats();
  return status;
}

function save(dir, status) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Preserve manual annotations from previous status.json
  const MANUAL_STATUSES = new Set(['SKIP_RND', 'EXPECTED_DIFF', 'NOT_COMPARABLE', 'SKIP', 'DEGRADED', 'BLOCKED']);
  const prevFile = path.join(dir, 'status.json');
  if (fs.existsSync(prevFile)) {
    const prev = JSON.parse(fs.readFileSync(prevFile, 'utf-8'));
    for (const key of Object.keys(prev)) {
      // Preserve notes
      if (key.endsWith('_note') && !status[key]) status[key] = prev[key];
      // Preserve modes (compare modes set manually per grammar)
      if (key.endsWith('_mode') && !status[key]) status[key] = prev[key];
      // Preserve manual statuses — don't overwrite with computed DIFF
      if (MANUAL_STATUSES.has(prev[key]) && status[key] === 'DIFF') status[key] = prev[key];
      // Preserve metadata
      if (['bpsScene', 'encoding_fix'].includes(key) && !status[key]) status[key] = prev[key];
    }
  }
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(status, null, 2));
}

function runCheck() {
  // ONLY compare existing snapshots. NEVER regenerate snapshots or rewrite status.json.
  const dirs = fs.readdirSync(DIR).filter(d => {
    const s = path.join(DIR, d, 'status.json');
    return fs.statSync(path.join(DIR, d)).isDirectory() && fs.existsSync(s);
  });
  let pass = 0, fail = 0, skip = 0;
  for (const d of dirs.sort()) {
    const st = JSON.parse(fs.readFileSync(path.join(DIR, d, 'status.json'), 'utf-8'));
    const snapDir = path.join(DIR, d, 'snapshots');

    // Skip grammars that aren't testable
    if (st.s1 === 'BLOCKED' || st.s1 === 'FAIL' || st.s1 === 'SKIP' || st.s3 !== 'PASS') {
      skip++; continue;
    }

    let ok = true;
    const checks = [];

    // Check S1=S2 if mode is not skip and snapshots exist
    if (st.s1_s2_mode && st.s1_s2_mode !== 'skip') {
      const f1 = path.join(snapDir, 's1_native.json');
      const f2 = path.join(snapDir, 's2_orig.json');
      if (fs.existsSync(f1) && fs.existsSync(f2)) {
        const r = compare(`${d}/snapshots/s1_native.json`, `${d}/snapshots/s2_orig.json`, `--mode=${st.s1_s2_mode}`);
        if (!r) { ok = false; checks.push('S1≠S2'); }
      }
    }

    // Check S2=S3 if mode is not skip
    if (st.s2_s3_mode && st.s2_s3_mode !== 'skip') {
      const f2 = path.join(snapDir, 's2_orig.json');
      const f3 = path.join(snapDir, 's3_silent.json');
      if (fs.existsSync(f2) && fs.existsSync(f3)) {
        const r = compare(`${d}/snapshots/s2_orig.json`, `${d}/snapshots/s3_silent.json`, `--mode=${st.s2_s3_mode}`);
        if (!r) { ok = false; checks.push('S2≠S3'); }
      }
    }

    // Check S3=S4 if mode is not skip
    if (st.s3_s4_mode && st.s3_s4_mode !== 'skip') {
      const sceneName = st.bpsScene || d;
      const f3 = path.join(snapDir, 's3_silent.json');
      const f4 = path.join(DIR, sceneName, 'snapshots', 's4_bps.json');
      if (fs.existsSync(f3) && fs.existsSync(f4)) {
        const r = compare(`${d}/snapshots/s3_silent.json`, `${sceneName}/snapshots/s4_bps.json`, `--mode=${st.s3_s4_mode}`);
        if (!r) { ok = false; checks.push('S3≠S4'); }
      }
    }

    if (ok) {
      console.log(`  ✅ ${d}`);
      pass++;
    } else {
      console.log(`  ⚠️ REGRESSION: ${d} (${checks.join(', ')})`);
      fail++;
    }
  }
  console.log(`\n${pass} pass, ${fail} regressions, ${skip} skipped`);
  generateResultats();
}

function generateResultats() {
  const dirs = fs.readdirSync(DIR).filter(d => {
    return fs.statSync(path.join(DIR, d)).isDirectory() && fs.existsSync(path.join(DIR, d, 'status.json'));
  }).sort();

  const lines = ['# Résultats des tests — Pipeline S1→S2→S3→S4', '',
    'Généré automatiquement par `runner.cjs`. Ne pas éditer à la main.', '',
    `Dernière mise à jour : ${new Date().toISOString().substring(0, 16)}`, '',
    '| Grammaire | Specificity | S1 | S2 | S1=S2 | S3 | S2=S3 | S4 | S3=S4 | Notes |',
    '|-----------|-------------|----|----|-------|-------|-------|-------|-------|-------|'];

  let full = 0, blocked = 0, partial = 0, skipped = 0;
  const activeLines = [];
  const skipLines = [];

  for (const d of dirs) {
    const s = JSON.parse(fs.readFileSync(path.join(DIR, d, 'status.json'), 'utf-8'));
    // Build specificity tags
    const specs = [];
    if (s.s1_vs_s2 === 'SKIP_RND') specs.push('RND');
    if (s.s1_vs_s2 === 'NOT_COMPARABLE' && (s.s1_note || '').includes('MIDI')) specs.push('no MIDI');
    if (s.s1_vs_s2 === 'EXPECTED_DIFF' && (s.s1_vs_s2_note || '').includes('transpose')) specs.push('_transpose');
    if (s.s2 === 'SKIP' || s.s2 === 'DEGRADED') specs.push('no -mi/-so');
    if (s.s1 === 'BLOCKED') specs.push('needs -cs');
    if (s.s1 === 'FAIL') specs.push('S1 fail');
    if (s.s3_vs_s4 === 'EXPECTED_DIFF') specs.push('renamed');
    if ((s.s2_note || '').includes('-tb')) specs.push('no -tb');
    if (s.s1_vs_s2 === 'DIFF') specs.push('S1≠S2');
    if ((s.s1_vs_s2_note || '').includes('MIDI NoteOff')) specs.push('MIDI overlap');
    const spec = specs.join(', ') || '-';
    const note = s.s1_vs_s2_note || s.s3_vs_s4_note || s.s1_note || s.note || '';
    const short = note.length > 60 ? note.substring(0, 57) + '...' : note;
    const row = `| ${d} | ${spec} | ${s.s1||'?'} | ${s.s2||'?'} | ${s.s1_vs_s2||'-'} | ${s.s3||'?'} | ${s.s2_vs_s3||'-'} | ${s.s4||'?'} | ${s.s3_vs_s4||'-'} | ${short} |`;

    if (s.s1 === 'SKIP') {
      skipLines.push(`| ${d} | ${(s.s1_note || '').substring(0, 80)} |`);
      skipped++;
    } else {
      activeLines.push(row);
      if (s.s3 === 'PASS' && s.s4 === 'PASS') full++;
      else if (s.s1 === 'BLOCKED') blocked++;
      else partial++;
    }
  }

  for (const r of activeLines) lines.push(r);

  lines.push('', `**${full} complets | ${partial} partiels | ${blocked} bloqués | ${skipped} skippés | ${dirs.length} testés / 107 total**`);

  if (skipLines.length > 0) {
    lines.push('', '## Skippés temporaires', '',
      '| Grammaire | Raison |', '|-----------|--------|');
    for (const r of skipLines) lines.push(r);
  }
  fs.writeFileSync(path.join(DIR, 'RESULTATS.md'), lines.join('\n') + '\n');
}

function showStatus() {
  const dirs = fs.readdirSync(DIR).filter(d => {
    return fs.statSync(path.join(DIR, d)).isDirectory() && fs.existsSync(path.join(DIR, d, 'status.json'));
  });
  console.log(`\n=== Pipeline Status (${dirs.length} grammars) ===\n`);
  for (const d of dirs.sort()) {
    const s = JSON.parse(fs.readFileSync(path.join(DIR, d, 'status.json'), 'utf-8'));
    const stages = [s.s1||'?', s.s2||'?', s.s3||'?', s.s4||'?'].join(' → ');
    const allPass = s.s1==='PASS' && s.s2==='PASS' && s.s3==='PASS' && s.s4==='PASS';
    console.log(`  ${allPass ? '✅' : '⚠️'} ${d.padEnd(20)} ${stages}`);
  }
  generateResultats();
}

// CLI
const arg = process.argv[2];
if (!arg || arg === '--help') {
  console.log('Usage: node runner.cjs <grammar> | --check | --status');
} else if (arg === '--check') {
  runCheck();
} else if (arg === '--status') {
  showStatus();
} else {
  runPipeline(arg);
}
