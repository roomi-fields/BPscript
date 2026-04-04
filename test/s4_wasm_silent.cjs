#!/usr/bin/env node
/**
 * S3: Run silent sound objects grammar on WASM engine.
 * Requires silent.gr + silent.al in the grammar directory.
 *
 * Usage: node s3_wasm_silent.cjs drum
 * Output: test/grammars/drum/snapshots/s3_silent.json
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { requireBinTag, resolveDist: _resolveDist, stripBinArgs } = require('./resolve_bin.cjs');

const _args = stripBinArgs(process.argv.slice(2));
const name = _args[0];
if (!name) { console.error('Usage: node s4_wasm_silent.cjs <grammar> --bin <version>'); process.exit(1); }
const binTag = requireBinTag();

const ROOT = path.resolve(__dirname, '..');
const BP3_DIR = path.resolve(ROOT, '..', 'bp3-engine');
const TD = path.resolve(BP3_DIR, 'test-data');
const DIST = _resolveDist(binTag);
const DIR = path.join(__dirname, 'grammars', name);

const silentGr = path.join(DIR, 'silent.gr');
const silentAl = path.join(DIR, 'silent.al');
if (!fs.existsSync(silentGr)) { console.error(`Not found: ${silentGr}`); process.exit(1); }

// Read settings from S2 snapshot (reuse same params)
const s2Snap = path.join(DIR, 'snapshots', 's2_orig.json');
let sp = [0, 10, 10, 1, 1, 60];
if (fs.existsSync(s2Snap)) {
  try { sp = JSON.parse(fs.readFileSync(s2Snap, 'utf-8')).settings || sp; } catch(e) {}
}
// S3 ALWAYS uses NoteConvention=0 (silent sound objects, opaque terminals)
sp[0] = 0;

// Tonality and settings: read from grammar header or infer
const GRAMMARS = require('./grammars/grammars.json');
const grName = GRAMMARS[name]?.bernard || name;
let toContent = '';
let seJsonContent = '';
if (grName) {
  const grFile = path.join(TD, `-gr.${grName}`);
  if (fs.existsSync(grFile)) {
    const gr = fs.readFileSync(grFile, 'utf-8');
    const toMatch = gr.match(/-to\.(\S+)/);
    const csMatch = gr.match(/-cs\.(\S+)/);
    const seMatch = gr.match(/-se\.(\S+)/);
    if (toMatch) { const f = path.join(TD, `-to.${toMatch[1]}`); if (fs.existsSync(f)) toContent = fs.readFileSync(f, 'utf-8'); }
    if (!toContent) {
      for (const c of [grName, seMatch?.[1], csMatch?.[1]].filter(Boolean)) {
        const f = path.join(TD, `-to.${c}`); if (fs.existsSync(f)) { toContent = fs.readFileSync(f, 'utf-8'); break; }
      }
    }
    // Load full JSON settings (same as S2)
    if (seMatch) {
      const f = path.join(TD, `-se.${seMatch[1]}`);
      if (fs.existsSync(f)) {
        const c = fs.readFileSync(f, 'utf-8');
        if (c.trim().startsWith('{')) seJsonContent = c;
      }
    }
  }
}

// Write temp files and run WASM
const grContent = fs.readFileSync(silentGr, 'utf-8');
const alContent = fs.existsSync(silentAl) ? fs.readFileSync(silentAl, 'utf-8') : '';
fs.writeFileSync('/tmp/_s3_gr.txt', grContent);
fs.writeFileSync('/tmp/_s3_al.txt', alContent);
fs.writeFileSync('/tmp/_s3_to.txt', toContent);
// Override WASM-critical settings in the JSON before loading
if (seJsonContent.trim()) {
  try {
    const seObj = JSON.parse(seJsonContent);
    // DisplayItems must be 1 for WASM to produce output (Bernard's PHP settings have 0)
    if (seObj.DisplayItems) seObj.DisplayItems.value = '1';
    // NoteConvention must be 0 for S3 (silent sound objects)
    if (seObj.NoteConvention) seObj.NoteConvention.value = '0';
    // Force MaxItemsProduce=10 for reproducible comparison
    seObj.MaxItemsProduce = {name: "Max items to produce", value: "10"};
    seJsonContent = JSON.stringify(seObj);
  } catch(e) {}
}
fs.writeFileSync('/tmp/_s3_se.txt', seJsonContent);

const wasmScript = `
var fs=require('fs');
process.chdir('${DIST.replace(/\\/g,'/')}');
console.log=function(){};
require('${path.join(DIST,'bp3.js').replace(/\\/g,'/')}')().then(function(M){
  var init=M.cwrap('bp3_init','number',[]);
  var loadGr=M.cwrap('bp3_load_grammar','number',['string']);
  var loadAl=M.cwrap('bp3_load_alphabet','number',['string']);
  var loadSettings=M.cwrap('bp3_load_settings','number',['string']);
  var setSeed=M.cwrap('bp3_set_seed','void',['number']);
  var loadTo=M.cwrap('bp3_load_tonality','number',['string']);
  var produce=M.cwrap('bp3_produce','number',[]);
  var getTT=M.cwrap('bp3_get_timed_tokens','string',[]);
  init();
  var seJson=fs.readFileSync('/tmp/_s3_se.txt','utf-8');if(seJson.trim())loadSettings(seJson);
  setSeed(1);
  var al=fs.readFileSync('/tmp/_s3_al.txt','utf-8');if(al.trim())loadAl(al);
  var to=fs.readFileSync('/tmp/_s3_to.txt','utf-8');if(to.trim())loadTo(to);
  loadGr(fs.readFileSync('/tmp/_s3_gr.txt','utf-8'));
  var r=produce();
  var raw=JSON.parse(getTT());
  var filtered=raw.filter(function(t){return t.token!=='-'&&t.token!=='&'&&t.token!=='.'&&!t.token.startsWith('_');});
  var tokens=filtered.map(function(t){return[t.token,t.start,t.end];});
  process.stdout.write(JSON.stringify({r:r,tokens:tokens})+'\\n');
  process.exit(0);
}).catch(function(e){process.stdout.write(JSON.stringify({error:e.message.substring(0,80)})+'\\n');process.exit(0);});
setTimeout(function(){process.stdout.write(JSON.stringify({error:'TIMEOUT'})+'\\n');process.exit(0);},55000);
`;

fs.writeFileSync('/tmp/_s3_wasm.cjs', wasmScript);
try {
  const out = execSync('node /tmp/_s3_wasm.cjs', { timeout: 60000, encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] });
  const line = out.trim().split('\n').filter(l => l.startsWith('{')).pop();
  const result = line ? JSON.parse(line) : { error: 'no output' };
  if (result.error) { console.error(`S3 FAIL: ${result.error}`); process.exit(1); }

  const snapDir = path.join(DIR, 'snapshots');
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
  const snap = { source: 'silent.gr', stage: 'S3', settings: sp, tokens: result.tokens, date: new Date().toISOString().substring(0, 10) };
  fs.writeFileSync(path.join(snapDir, 's3_silent.json'), JSON.stringify(snap, null, 2));
  console.log(`S3 OK: ${result.tokens.length} tokens → ${name}/snapshots/s3_silent.json`);
} catch (e) {
  console.error(`S3 FAIL: ${(e.stderr || e.message || '').substring(0, 80)}`);
  process.exit(1);
}
