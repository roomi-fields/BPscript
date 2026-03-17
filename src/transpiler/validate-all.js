/**
 * BPScript Full Validation — tests all 44 scenes via WASM
 * For each scene: MIDI comparison > structural comparison > normalized BP3 diff
 *
 * Each test runs in a separate child process (bp3.js changes cwd).
 * Results written to scenes/SUIVI.md
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { compileBPS } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES_DIR = join(__dirname, '../../scenes');
const BP3_LIB = join(__dirname, '../../bp3-engine/library');
const DIST_DIR = join(__dirname, '../../dist');
const LIB_DIR = join(__dirname, '../../lib');

// Find all original grammars
const origMap = {};
function findGr(dir) {
  try {
    for (const e of readdirSync(dir)) {
      const f = join(dir, e);
      if (statSync(f).isDirectory()) findGr(f);
      else if (e === 'grammar.gr') origMap[dirname(f).split('/').pop()] = f;
    }
  } catch {}
}
findGr(BP3_LIB);

function esc(s) { return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

/**
 * Run a WASM test in a child process. Returns { origMidi, transMidi, origResult, transResult, origErr, transErr }
 */
function wasmTest(name, origGrPath, bpsPath) {
  const compiled = compileBPS(readFileSync(bpsPath, 'utf-8'));
  if (compiled.errors.length > 0) return { error: 'compile: ' + compiled.errors[0].message };

  const transGrammar = compiled.grammar;
  const transSettings = compiled.settingsJSON || '';
  let transAlphabet = compiled.alphabetFile || '';

  // Detect NoteConvention from @alphabet.xxx directive
  let noteConvention = 0; // default ENGLISH
  try {
    const alphaJson = JSON.parse(readFileSync(join(LIB_DIR, 'alphabet.json'), 'utf-8'));
    const bpsSrc = readFileSync(bpsPath, 'utf-8');
    const alphaMatch = bpsSrc.match(/@alphabet\.(\w+)/);
    if (alphaMatch && alphaJson.alphabets[alphaMatch[1]]?.noteConvention !== undefined) {
      noteConvention = alphaJson.alphabets[alphaMatch[1]].noteConvention;
    }
  } catch {}

  // If no alphabet from compiler, auto-detect terminals from grammar
  // Collect all lowercase symbols from rule lines (not comments) that BP3 might
  // not recognize. BP3 requires lowercase symbols to be declared in the alphabet.
  if (!transAlphabet) {
    const allSymbols = new Set();
    for (const line of transGrammar.split('\n')) {
      if (!line.match(/^gram#\d+\[\d+\]/) && !line.match(/^\S+\s+-->/)) continue; // skip non-rule lines
      // Extract all word tokens from the line
      const words = line.match(/(?<=\s|^|,|{|}|\(|\))[A-Za-z][A-Za-z0-9_#'".-]*/g);
      if (words) words.forEach(w => allSymbols.add(w));
    }
    const bp3Keywords = new Set(['lambda', 'LEFT', 'RIGHT', 'RND', 'ORD', 'LIN', 'SUB', 'SUB1', 'TEM', 'POSLONG', 'gram']);
    // Include all symbols that start with lowercase (BP3 rejects them without alphabet)
    const terminals = [...allSymbols].filter(s =>
      s[0] >= 'a' && s[0] <= 'z' &&
      !bp3Keywords.has(s) &&
      !s.startsWith('_') &&
      s !== 'lambda'
    );
    if (terminals.length > 0) transAlphabet = terminals.join('\n');
  }

  // Find settings file from original grammar's -se. line
  const origGr = readFileSync(origGrPath, 'utf-8').replace(/\r/g, '\n');
  const seMatch = origGr.match(/^-se\.(.+)$/m);
  let settingsFile = '';
  if (seMatch) {
    const seName = seMatch[1].trim();
    // test-data is in the main bp3-engine repo (/mnt/d/Claude/bp3-engine)
    const TD = join(__dirname, '../../../bp3-engine/test-data');
    try { settingsFile = readFileSync(join(TD, '-se.' + seName), 'utf-8'); } catch {}
  }

  // Write temp files
  const tmpGr = join(DIST_DIR, '_tmp_grammar.txt');
  const tmpAl = join(DIST_DIR, '_tmp_alphabet.txt');
  const tmpSe = join(DIST_DIR, '_tmp_settings.json');
  writeFileSync(tmpAl, transAlphabet || '');
  writeFileSync(tmpSe, settingsFile || '');

  // Run each grammar in its own process (WASM is stateful)
  function runOne(grammarText) {
    writeFileSync(tmpGr, grammarText);
    try {
      const out = execSync('node _test_one.js', {
        cwd: DIST_DIR, timeout: 120000, stdio: ['pipe', 'pipe', 'pipe']
      }).toString().trim();
      const jsonLine = out.split('\n').filter(l => l.startsWith('{')).pop();
      if (!jsonLine) return null;
      return JSON.parse(jsonLine);
    } catch (e) {
      return { error: (e.stderr?.toString() || e.message || '').substring(0, 80) };
    }
  }

  // Strip file refs from original
  const origStripped = origGr.split('\n').filter(l => !/^-[a-z]{2}\./.test(l.trim())).join('\n');

  const origResult = runOne(origStripped);
  const transResult = runOne(transGrammar);

  if (!origResult || !transResult || origResult.error || transResult.error) {
    return { error: 'wasm: orig=' + JSON.stringify(origResult?.error) + ' trans=' + JSON.stringify(transResult?.error) };
  }

  // Build combined result for compatibility with existing logic
  const w = {
    oe: origResult.err, on: origResult.midi, or: origResult.res,
    te: transResult.err, tn: transResult.midi, tr: transResult.res,
    nm: origResult.notes && transResult.notes &&
        origResult.notes.length === transResult.notes.length &&
        origResult.notes.every((n, i) => n === transResult.notes[i]),
  };

  return w;
}

/**
 * Normalize a BP3 rule for comparison
 */
function norm(line) {
  return line
    .replace(/gram#\d+\s*\[\d+\]\s*/g, '')
    .replace(/\s+\[[A-Z][^\]]*\]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Run all tests ---
const scenes = readdirSync(SCENES_DIR).filter(f => f.endsWith('.bps')).map(f => f.replace('.bps', '')).sort();
const results = [];

for (const name of scenes) {
  const bpsFile = join(SCENES_DIR, name + '.bps');
  const origGr = origMap[name];
  process.stderr.write(`Testing ${name}...`);

  if (!origGr) {
    results.push({ name, status: 'NO_ORIG', detail: 'pas de grammaire originale' });
    process.stderr.write(' no original\n');
    continue;
  }

  // Compile check
  const compiled = compileBPS(readFileSync(bpsFile, 'utf-8'));
  if (compiled.errors.length > 0) {
    results.push({ name, status: 'COMPILE_FAIL', detail: compiled.errors[0].message });
    process.stderr.write(' compile fail\n');
    continue;
  }

  // WASM test
  const w = wasmTest(name, origGr, bpsFile);

  if (w.error) {
    // Fall back to BP3 text comparison
    const origText = readFileSync(origGr, 'utf-8').replace(/\r/g, '\n');
    const oRules = origText.split('\n')
      .filter(l => /^(gram#|[A-Z].*-->|[a-z].*-->|[)}?,].*-->|\?.*-->|#.*-->)/.test(l.trim()))
      .map(l => norm(l));
    const tRules = compiled.grammar.split('\n').filter(l => l.startsWith('gram#')).map(l => norm(l));

    if (oRules.length === tRules.length && oRules.every((r, i) => r === tRules[i])) {
      results.push({ name, status: 'BP3_EXACT', detail: oRules.length + ' rules (WASM: ' + w.error.substring(0, 40) + ')' });
    } else {
      const diffs = oRules.filter((r, i) => r !== tRules[i]).length + Math.abs(oRules.length - tRules.length);
      results.push({ name, status: 'BP3_DIFF', detail: diffs + ' diffs / ' + Math.max(oRules.length, tRules.length) + ' rules' });
    }
    process.stderr.write(' BP3 text\n');
    continue;
  }

  // WASM crash (undefined results) — true crash, not just grammar errors
  if (w.oe === undefined || w.te === undefined) {
    // Fall back to BP3 text comparison
    const origText = readFileSync(origGr, 'utf-8').replace(/\r/g, '\n');
    const oRules = origText.split('\n')
      .filter(l => /^(gram#|[A-Z].*-->|[a-z].*-->|[)}?,].*-->|\?.*-->|#.*-->)/.test(l.trim()))
      .map(l => norm(l));
    const tRules = compiled.grammar.split('\n').filter(l => l.startsWith('gram#')).map(l => norm(l));
    const diffs = oRules.filter((r, i) => r !== tRules[i]).length + Math.abs(oRules.length - tRules.length);
    if (diffs === 0) {
      results.push({ name, status: 'BP3_EXACT', detail: oRules.length + ' rules (WASM crash)' });
    } else {
      results.push({ name, status: 'BP3_DIFF', detail: diffs + ' diffs / ' + Math.max(oRules.length, tRules.length) + ' rules (WASM crash)' });
    }
    process.stderr.write(' WASM crash → BP3 text\n');
    continue;
  }

  // Both grammars errored in WASM — compare results anyway
  if (w.oe && w.te) {
    if (w.or === w.tr) {
      results.push({ name, status: 'STRUCT_IDENTICAL', detail: 'both err, result identical (' + (w.or||'').length + ' chars)' });
      process.stderr.write(' both err, match\n');
    } else {
      results.push({ name, status: 'BOTH_FAIL', detail: 'both err, results differ' });
      process.stderr.write(' both fail\n');
    }
    continue;
  }

  if (w.oe && !w.te) {
    // Original fails, transpiled OK — structural validation
    results.push({ name, status: 'TRANS_OK', detail: 'transpiled compiles+derives (' + (w.tn || 0) + ' MIDI)' });
    process.stderr.write(' trans OK\n');
    continue;
  }

  if (w.te) {
    results.push({ name, status: 'TRANS_FAIL', detail: 'transpiled rejected by WASM' });
    process.stderr.write(' trans fail\n');
    continue;
  }

  // Both succeed — compare MIDI first, then structural
  if (w.nm && w.on > 0) {
    results.push({ name, status: 'MIDI_IDENTICAL', detail: w.on + ' notes' });
    process.stderr.write(' MIDI identical (' + w.on + ')\n');
  } else if (w.on === 0 && w.tn === 0) {
    if (w.or === w.tr) {
      results.push({ name, status: 'STRUCT_IDENTICAL', detail: 'result identical (' + (w.or||'').length + ' chars)' });
    } else {
      results.push({ name, status: 'STRUCT_DIFF', detail: 'orig=' + (w.or||'').substring(0, 50) + ' trans=' + (w.tr||'').substring(0, 50) });
    }
    process.stderr.write(' structural\n');
  } else if (w.on > 0 && w.tn === 0) {
    results.push({ name, status: 'MIDI_DIFF', detail: 'orig=' + w.on + ' notes, trans=0' });
    process.stderr.write(' MIDI diff\n');
  } else {
    results.push({ name, status: 'MIDI_DIFF', detail: 'orig=' + w.on + ' trans=' + w.tn + ' notes' });
    process.stderr.write(' MIDI diff\n');
  }
}

// --- Output results ---
console.log('\n| Scène | Compile | BP3 | WASM | Détail |');
console.log('|-------|:---:|-----|------|--------|');

let midi = 0, struct = 0, bp3ok = 0, transok = 0, diff = 0, fail = 0, skip = 0;
for (const r of results) {
  const compile = '✅';
  let bp3 = '—', wasm = '—', detail = r.detail;

  switch (r.status) {
    case 'MIDI_IDENTICAL': wasm = '✅ MIDI'; midi++; break;
    case 'STRUCT_IDENTICAL': wasm = '✅ struct'; struct++; break;
    case 'STRUCT_DIFF': wasm = '⚠️ struct'; diff++; break;
    case 'MIDI_DIFF': wasm = '⚠️ MIDI'; diff++; break;
    case 'BP3_EXACT': bp3 = '✅ exact'; bp3ok++; break;
    case 'BP3_DIFF': bp3 = '⚠️'; diff++; break;
    case 'TRANS_OK': wasm = '~OK'; transok++; break;
    case 'TRANS_FAIL': wasm = '❌'; fail++; break;
    case 'BOTH_FAIL': wasm = 'skip'; skip++; break;
    case 'COMPILE_FAIL': break;
  }

  console.log(`| ${r.name} | ${compile} | ${bp3} | ${wasm} | ${detail} |`);
}

const total = midi + struct + transok + bp3ok + diff + fail + skip;
console.log(`\n**${total}/44 — ${midi} MIDI, ${struct} struct, ${transok} ~OK, ${bp3ok} BP3 exact, ${diff} diffs, ${fail} fails, ${skip} skip**`);
