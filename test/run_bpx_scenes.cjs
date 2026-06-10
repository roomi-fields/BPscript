#!/usr/bin/env node
/**
 * Run the BPx M1/M2 fixture scenes against the BP3 WASM engine.
 *
 * Pipeline: scene.bps → compileBPS() → BP3 grammar/alphabet/settings → WASM
 *           → terminals (from bp3_get_timed_tokens with verbose=1)
 *
 * Usage: node test/run_bpx_scenes.cjs --bin <tag>   (--bin last = builds/LAST)
 *
 * Scenes are read from scenes/ (local copies, bit-identical to the BPx
 * fixtures /home/romi/dev/bp/BPx/test/scenes/).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { requireBinTag, resolveDist } = require('./resolve_bin.cjs');

const ROOT = path.resolve(__dirname, '..');
const SCENES_DIR = path.join(ROOT, 'scenes');

const binTag = requireBinTag();
const DIST = resolveDist(binTag);
console.log(`Using engine: ${binTag} (${DIST})`);

const EXPECTED = {
  // M1 — exact sequences
  'm1_01_smoke.bps':              { kind: 'exact', tokens: ['-','-','-','-','-','-'],          note: 'header + @mode:ord + 6 terminals' },
  'm1_02_alternatives.bps':       { kind: 'exact', tokens: ['-','-','-','_','-','_'],          note: 'multi-règles LHS, [weight:50], [weight:0]' },
  'm1_03_subgrammars_guard.bps':  { kind: 'exact', tokens: ['_','-','-','-'],                   note: '-----, [phase==1] guard, [phase=2] mutation' },
  // FAIL CONNU (moteur BP3) : gram#1 "S --> Loop" laisse 1 seul item dans la
  // chaîne intermédiaire → rc=-4 (garde mono-item, cf. docs/issues/S8_ADVANCED_MECHANISMS.md §0).
  'm1_04_recursion.bps':          { kind: 'exact', tokens: ['-','-','-','-','-','-','-'],      note: 'récursion, [count>0]/[count==0], [count-1] RHS — FAIL connu rc=-4 (S8 §0)' },
  // FAIL CONNU (moteur BP3, bug #47) : les guards [count...] sur Chunk (enfant)
  // ne voient pas la mutation [count-1] du parent → C4 jamais émis. m1_05bis
  // est le contournement (self-recursion), cf. en-tête scenes/m1_05bis.bps.
  'm1_05_combo.bps':              { kind: 'exact', tokens: ['_','C4','C4','_','-','_'],        note: 'tous opérateurs M1, AND, mutations, [weight:0], récursion — FAIL connu bug #47' },
  'm1_05bis.bps':                 { kind: 'exact', tokens: ['_','C4','C4','C4','C4','-','_'],  note: 'combo M1 self-recursion (contournement bug #47)' },
  // M2 — structural invariants (seed=1, LCG-determined)
  // Les terminaux observables sont déclarés DANS les scènes (en-têtes : "Terminaux
  // observables pris dans l'alphabet western:midi") : C4/D4/E4/G4, pas a/b/c/H/L.
  'm2_01_rnd_deterministic.bps':  { kind: 'pattern', length: 6,  body: ['C4','D4','E4'], suffix: '-', note: 'RND équiprobable, 5 ∈{C4,D4,E4} + -' },
  'm2_02_rnd_weighted.bps':       { kind: 'pattern', length: 11, body: ['C4','G4'],      suffix: '-', note: '[weight:N] 9:1, 10 ∈{C4,G4} + -' },
  'm2_03_rnd_decrement.bps':      { kind: 'pattern', lengthRange: [1, 4], body: ['C4'],  suffix: '-', note: '[weight:N-D] décrémental, 0..3 C4 + -' },
  'm2_04_kparam.bps':             { kind: 'pattern', length: 11, body: ['C4','G4'],      suffix: '-', note: '[weight:K1=80] K-param 16:1, 10 ∈{C4,G4} + -' },
  'm2_05_mutating_guard.bps':     { kind: 'pattern', lengthRange: [1, 200], body: ['-','C4'], suffix: '-', note: '[Ideas-1] mutating guard LHS, terminé par -' },
};

function compileOne(scenePath, tmp) {
  // ESM compile via inline script (transpiler is ESM)
  const compileScript = `
import { compileBPS } from '${path.join(ROOT, 'src/transpiler/index.js').replace(/\\/g, '/')}';
import { readFileSync, writeFileSync } from 'fs';
const src = readFileSync('${scenePath.replace(/\\/g, '/')}', 'utf8');
const r = compileBPS(src);
writeFileSync('${tmp}_gr.txt', r.grammar || '');
writeFileSync('${tmp}_al.txt', r.alphabetFile || (Array.isArray(r.alphabet) ? r.alphabet.join('\\n') : ''));
writeFileSync('${tmp}_se.txt', r.settingsJSON || '');
writeFileSync('${tmp}_info.json', JSON.stringify({ errors: r.errors || [] }));
`;
  fs.writeFileSync(`${tmp}_compile.mjs`, compileScript);
  try {
    execFileSync('node', [`${tmp}_compile.mjs`], { cwd: ROOT, timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    return { ok: false, error: `COMPILE FAIL: ${(e.stderr?.toString() || e.message || '').substring(0, 200)}` };
  }
  const info = JSON.parse(fs.readFileSync(`${tmp}_info.json`, 'utf8'));
  if (info.errors.length > 0) {
    return { ok: false, error: `COMPILE ERRORS: ${info.errors.map(e => e.message || JSON.stringify(e)).join('; ')}` };
  }
  // BP3 requires non-terminals to start with uppercase OR be wrapped with |pipes|.
  // The BPx fixtures use lowercase non-terminals (BPx-style). Wrap them post-hoc
  // so we exercise the BP3 engine itself, not the parser convention.
  const grammarPath = `${tmp}_gr.txt`;
  const orig = fs.readFileSync(grammarPath, 'utf8');
  const lines = orig.split(/\r?\n/);
  const allLhs = new Set();   // every LHS (non-terminal), any case
  const lowerLhs = new Set(); // subset that's lowercase → needs |pipe| wrap
  for (const ln of lines) {
    const m = ln.match(/^gram#\d+\[\d+\](.*?)\s+(\S+)\s+-->/);
    if (m) {
      const lhs = m[2];
      if (/^[A-Za-z][A-Za-z0-9_]*$/.test(lhs)) {
        allLhs.add(lhs);
        if (/^[a-z]/.test(lhs)) lowerLhs.add(lhs);
      }
    }
  }
  if (lowerLhs.size > 0) {
    const re = new RegExp(`\\b(${Array.from(lowerLhs).join('|')})\\b`, 'g');
    const patched = lines.map(ln => {
      if (ln.startsWith('//')) return ln;
      return ln.replace(re, (m) => `|${m}|`);
    }).join('\n');
    fs.writeFileSync(grammarPath, patched);
  }
  // Collect bare-name terminals to declare in alphabet : tokens that appear in
  // RHS but are NOT non-terminals (LHS). BP3 rejects them as "undefined
  // variables" unless declared.
  const allTokens = new Set();
  for (const ln of lines) {
    const m = ln.match(/^gram#\d+\[\d+\](.*?)\s+-->\s+(.*)$/);
    if (!m) continue;
    const rhs = m[2];
    const toks = rhs.split(/\s+/);
    for (const t of toks) {
      if (!t || t === '-' || t === '_' || t.startsWith('/') || t.startsWith('<') || t.startsWith('|')) continue;
      if (/^[A-Za-z][A-Za-z0-9_#]*$/.test(t) && !allLhs.has(t)) allTokens.add(t);
    }
  }
  const alPath = `${tmp}_al.txt`;
  const al = fs.existsSync(alPath) ? fs.readFileSync(alPath, 'utf8') : '';
  const alLines = new Set(al.split(/\r?\n/).map(l => l.trim()).filter(Boolean));
  const extras = [];
  for (const t of allTokens) {
    if (!alLines.has(t)) extras.push(t);
  }
  if (extras.length > 0) {
    fs.writeFileSync(alPath, (al ? al.trim() + '\n' : '') + extras.join('\n') + '\n');
  }
  return { ok: true, lowerNonTerms: Array.from(lowerLhs), addedTerminals: extras };
}

function runWasm(tmp) {
  const wasmScript = `
var fs=require('fs');
var TMP='${tmp}';
process.chdir('${DIST.replace(/\\/g, '/')}');
var _logs=[]; var _origLog=console.log;
console.log=function(){ _logs.push(Array.prototype.join.call(arguments,' ')); };
require('${path.join(DIST, 'bp3.js').replace(/\\/g, '/')}')().then(function(M){
  var init=M.cwrap('bp3_init','number',[]);
  var loadGr=M.cwrap('bp3_load_grammar','number',['string']);
  var loadAl=M.cwrap('bp3_load_alphabet','number',['string']);
  var loadSettings=M.cwrap('bp3_load_settings','number',['string']);
  var setSeed=M.cwrap('bp3_set_seed','void',['number']);
  var produce=M.cwrap('bp3_produce','number',[]);
  var getTT=M.cwrap('bp3_get_timed_tokens','string',[]);
  var getResult=M.cwrap('bp3_get_result','string',[]);
  var setWriteMidi=M.cwrap('bp3_set_write_midi','void',['number']);
  var setVerbose=M.cwrap('bp3_set_timed_tokens_verbose','void',['number']);
  init();
  var seJson=fs.readFileSync(TMP+'_se.txt','utf-8');
  if(seJson.trim())loadSettings(seJson);
  setSeed(1);
  setVerbose(1);
  var al=fs.readFileSync(TMP+'_al.txt','utf-8');if(al.trim())loadAl(al);
  var gres=loadGr(fs.readFileSync(TMP+'_gr.txt','utf-8'));
  var r=produce();
  var tokens=[];
  // Prefer the textual production output (bp3_get_result), which is the full
  // derived sequence including silences. Timed tokens filter out duplicates
  // and uninteresting events. The text format is space-separated, sometimes
  // quoted with single quotes.
  var txt=getResult();
  if(txt && txt.trim()){
    var stripped = txt.split(/\\n/).filter(function(l){
      l = l.trim(); if(!l) return false;
      // Skip BP3 trace lines that may sneak in.
      if(l.startsWith('//') || l.indexOf('subgrammar')>=0 || l.indexOf('Compiling')>=0) return false;
      return true;
    }).join(' ');
    // Drop _script(CT n) / _script(CT n_e) wrappers: they encode the ()
    // runtime qualifiers (vel, pan, ...) destined to a downstream runtime,
    // not derived terminals (cf. CLAUDE.md: "(vel:80) -> _script(CT0)").
    stripped = stripped.replace(/_script\\([^)]*\\)/g, ' ');
    stripped.split(/\\s+/).forEach(function(t){ t = t.replace(/^'|'$/g,''); if(t) tokens.push(t); });
  }
  var msgs = ''; try{ var gm=M.cwrap('bp3_get_messages','string',[]); msgs=gm()||''; }catch(e){}
  fs.writeFileSync(TMP+'_result.json', JSON.stringify({ produceRet:r, gres:gres, tokens:tokens, raw:txt, msgs:msgs, logs:_logs }));
  process.stdout.write('OK\\n'); process.exit(0);
}).catch(function(e){
  fs.writeFileSync(TMP+'_result.json', JSON.stringify({ error: (e.message||String(e)).substring(0,200) }));
  process.stdout.write('OK\\n'); process.exit(0);
});
setTimeout(function(){
  fs.writeFileSync(TMP+'_result.json', JSON.stringify({ error:'TIMEOUT' }));
  process.stdout.write('OK\\n'); process.exit(0);
}, 30000);
`;
  fs.writeFileSync(`${tmp}_wasm.cjs`, wasmScript);
  try {
    execFileSync('node', [`${tmp}_wasm.cjs`], { cwd: ROOT, timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    return { ok: false, error: `WASM EXEC FAIL: ${(e.stderr?.toString() || e.message || '').substring(0, 200)}` };
  }
  const result = JSON.parse(fs.readFileSync(`${tmp}_result.json`, 'utf8'));
  if (result.error) return { ok: false, error: `WASM RUN FAIL: ${result.error}` };
  return { ok: true, tokens: result.tokens, produceRet: result.produceRet, gres: result.gres, raw: result.raw };
}

function checkPattern(tokens, exp) {
  const issues = [];
  if (exp.length !== undefined && tokens.length !== exp.length) issues.push(`length=${tokens.length} ≠ ${exp.length}`);
  if (exp.lengthRange) {
    const [lo, hi] = exp.lengthRange;
    if (tokens.length < lo || tokens.length > hi) issues.push(`length=${tokens.length} not in [${lo},${hi}]`);
  }
  if (exp.suffix !== undefined && tokens[tokens.length - 1] !== exp.suffix) issues.push(`suffix='${tokens[tokens.length-1]}' ≠ '${exp.suffix}'`);
  if (exp.body) {
    const bodySet = new Set(exp.body);
    const bad = tokens.slice(0, -1).filter(t => !bodySet.has(t));
    if (bad.length) issues.push(`body has illegal tokens: ${bad.slice(0,5).join(',')} (allowed: ${exp.body.join(',')})`);
  }
  return issues;
}

let pass = 0, fail = 0;
for (const fn of Object.keys(EXPECTED)) {
  const scenePath = path.join(SCENES_DIR, fn);
  const tmp = `/tmp/_bpx_${fn.replace(/\W/g, '_')}`;
  const exp = EXPECTED[fn];
  console.log('────────────────────────────────────────');
  console.log(`▶ ${fn}`);

  const c = compileOne(scenePath, tmp);
  if (!c.ok) { console.log(`  ✗ ${c.error}`); fail++; continue; }

  const w = runWasm(tmp);
  if (!w.ok) { console.log(`  ✗ ${w.error}`); fail++; continue; }

  const tokens = w.tokens || [];
  console.log(`  got: ${tokens.join(' ')}    (length=${tokens.length}, produce=${w.produceRet})`);
  if (exp.kind === 'exact') {
    const equal = tokens.length === exp.tokens.length && tokens.every((t, i) => t === exp.tokens[i]);
    console.log(`  expected: ${exp.tokens.join(' ')}`);
    if (equal) { console.log(`  ✓ PASS — ${exp.note}`); pass++; }
    else       { console.log(`  ✗ FAIL — ${exp.note}`); fail++; }
  } else {
    const issues = checkPattern(tokens, exp);
    const inv = `length=${exp.length ?? `[${exp.lengthRange?.join('..')}]`} body∈{${exp.body.join(',')}} suffix=${exp.suffix}`;
    console.log(`  invariants: ${inv}`);
    if (issues.length === 0) { console.log(`  ✓ PASS — ${exp.note}`); pass++; }
    else                     { console.log(`  ✗ FAIL: ${issues.join('; ')} — ${exp.note}`); fail++; }
  }
}

console.log('════════════════════════════════════════');
console.log(`Total: ${pass}/${pass+fail} pass${fail ? ` (${fail} fail)` : ''}`);
process.exit(fail ? 1 : 0);
