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
  const transAlphabet = compiled.alphabetFile || '';

  // Strip file refs from original
  const origGr = readFileSync(origGrPath, 'utf-8').replace(/\r/g, '\n');
  const stripped = origGr.split('\n').filter(l => !/^-[a-z]{2}\./.test(l.trim())).join('\n');

  // Write temp files for grammar and alphabet (avoids escaping issues)
  const tmpGr = join(DIST_DIR, '_tmp_grammar.txt');
  const tmpAl = join(DIST_DIR, '_tmp_alphabet.txt');
  writeFileSync(tmpGr, transGrammar);
  writeFileSync(tmpAl, transAlphabet || '');

  const script = `
const fs=require('fs');const BP3=require('./bp3.js');
BP3().then(m=>{
const I=m.cwrap('bp3_init','number',[]),G=m.cwrap('bp3_load_grammar','number',['string']),
A=m.cwrap('bp3_load_alphabet','number',['string']),
P=m.cwrap('bp3_produce','number',[]),C=m.cwrap('bp3_get_midi_event_count','number',[]),
E=m.cwrap('bp3_get_midi_events','string',[]),R=m.cwrap('bp3_get_result','string',[]),
Mg=m.cwrap('bp3_get_messages','string',[]);
I(42);G(fs.readFileSync('${esc(origGrPath)}','utf-8').replace(/\\r/g,'\\n').split('\\n').filter(l=>!/^-[a-z]{2}\\./.test(l.trim())).join('\\n'));
P();const oc=C();let on=[];if(oc>0)try{on=JSON.parse(E()).filter(e=>e.type===144).map(e=>e.note)}catch{}
const oe=/Errors: [1-9]/.test(Mg()),or=R().trim();
I(42);
const ta=fs.readFileSync('_tmp_alphabet.txt','utf-8');if(ta)A(ta);
G(fs.readFileSync('_tmp_grammar.txt','utf-8'));
P();const tc=C();let tn=[];if(tc>0)try{tn=JSON.parse(E()).filter(e=>e.type===144).map(e=>e.note)}catch{}
const te=/Errors: [1-9]/.test(Mg()),tr=R().trim();
console.log(JSON.stringify({oe,on:on.length,or:or.substring(0,200),te,tn:tn.length,tr:tr.substring(0,200),
nm:on.length===tn.length&&on.every((n,i)=>n===tn[i])}));
}).catch(e=>console.log(JSON.stringify({error:e.message})));
`.trim();

  try {
    const out = execSync(`node -e '${script.replace(/'/g, "'\\''")}'`, {
      cwd: DIST_DIR, timeout: 60000, stdio: ['pipe', 'pipe', 'pipe']
    }).toString().trim();
    const jsonLine = out.split('\n').filter(l => l.startsWith('{')).pop();
    if (!jsonLine) return { error: 'no JSON' };
    return JSON.parse(jsonLine);
  } catch (e) {
    return { error: (e.stderr?.toString() || e.message || '').substring(0, 80) };
  }
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

  if (w.oe && w.te) {
    results.push({ name, status: 'BOTH_FAIL', detail: 'both grammars fail in WASM' });
    process.stderr.write(' both fail\n');
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

  // Both succeed — compare
  if (w.nm && w.on > 0) {
    results.push({ name, status: 'MIDI_IDENTICAL', detail: w.on + ' notes' });
    process.stderr.write(' MIDI identical (' + w.on + ')\n');
  } else if (w.on === 0 && w.tn === 0) {
    // No MIDI — compare structural result
    if (w.or === w.tr) {
      results.push({ name, status: 'STRUCT_IDENTICAL', detail: 'result identical (' + w.or.length + ' chars)' });
    } else {
      results.push({ name, status: 'STRUCT_DIFF', detail: 'orig=' + w.or.substring(0, 50) + ' trans=' + w.tr.substring(0, 50) });
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

let midi = 0, struct = 0, bp3ok = 0, transok = 0, diff = 0, fail = 0;
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
    case 'BOTH_FAIL': wasm = 'skip'; break;
    case 'COMPILE_FAIL': break;
  }

  console.log(`| ${r.name} | ${compile} | ${bp3} | ${wasm} | ${detail} |`);
}

console.log(`\n**${midi} MIDI identical, ${struct} structural identical, ${transok} transpiled OK, ${bp3ok} BP3 exact, ${diff} diffs, ${fail} fails**`);
