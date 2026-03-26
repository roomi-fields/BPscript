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

const name = process.argv[2];
if (!name) { console.error('Usage: node s3_wasm_silent.cjs <grammar>'); process.exit(1); }

const ROOT = path.resolve(__dirname, '..', '..');
const TD = path.resolve(ROOT, '..', 'bp3-engine', 'test-data');
const DIST = path.resolve(ROOT, 'dist');
const DIR = path.join(__dirname, name);

const silentGr = path.join(DIR, 'silent.gr');
const silentAl = path.join(DIR, 'silent.al');
if (!fs.existsSync(silentGr)) { console.error(`Not found: ${silentGr}`); process.exit(1); }

// Read settings from S2 snapshot (reuse same params)
const s2Snap = path.join(DIR, 'snapshots', 's2_orig.json');
let sp = [0, 10, 10, 1, 1, 60];
if (fs.existsSync(s2Snap)) {
  try { sp = JSON.parse(fs.readFileSync(s2Snap, 'utf-8')).settings || sp; } catch(e) {}
}

// Tonality: read from grammar header or infer
const MAP = require('./map.json');
const grName = MAP[name] || name;
let toContent = '';
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
  }
}

// Write temp files and run WASM
const grContent = fs.readFileSync(silentGr, 'utf-8');
const alContent = fs.existsSync(silentAl) ? fs.readFileSync(silentAl, 'utf-8') : '';
fs.writeFileSync('/tmp/_s3_gr.txt', grContent);
fs.writeFileSync('/tmp/_s3_al.txt', alContent);
fs.writeFileSync('/tmp/_s3_to.txt', toContent);

const wasmScript = `
var fs=require('fs');
process.chdir('${DIST.replace(/\\/g,'/')}');
console.log=function(){};
require('${path.join(DIST,'bp3.js').replace(/\\/g,'/')}')().then(function(M){
  var init=M.cwrap('bp3_init','number',[]);
  var loadGr=M.cwrap('bp3_load_grammar','number',['string']);
  var loadAl=M.cwrap('bp3_load_alphabet','number',['string']);
  var SP=M.cwrap('bp3_load_settings_params','number',['number','number','number','number','number','number']);
  var loadTo=M.cwrap('bp3_load_tonality','number',['string']);
  var produce=M.cwrap('bp3_produce','number',[]);
  var getTT=M.cwrap('bp3_get_timed_tokens','string',[]);
  init();
  SP(${sp.join(',')});
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
