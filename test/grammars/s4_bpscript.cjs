#!/usr/bin/env node
/**
 * S4: Compile BPscript scene and run on WASM engine.
 *
 * Usage: node s4_bpscript.cjs drum
 * Output: test/grammars/drum/snapshots/s4_bps.json
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const name = process.argv[2];
if (!name) { console.error('Usage: node s4_bpscript.cjs <grammar>'); process.exit(1); }

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.resolve(ROOT, 'dist');
const SCENES = path.resolve(ROOT, 'scenes');
const DIR = path.join(__dirname, name);

const bpsFile = path.join(SCENES, `${name}.bps`);
if (!fs.existsSync(bpsFile)) { console.error(`Not found: ${bpsFile}`); process.exit(1); }

// Read settings from S2 snapshot (reuse same params)
// Look for S2 snapshot — try scene name dir first, then check map for grammar name
const MAP = require('./map.json');
const grName = MAP[name] || name;
const s2Snap = fs.existsSync(path.join(__dirname, name, 'snapshots', 's2_orig.json'))
  ? path.join(__dirname, name, 'snapshots', 's2_orig.json')
  : path.join(__dirname, grName, 'snapshots', 's2_orig.json');
let sp = [0, 10, 10, 1, 1, 60];
if (fs.existsSync(s2Snap)) {
  try { sp = JSON.parse(fs.readFileSync(s2Snap, 'utf-8')).settings || sp; } catch(e) {}
}

// Compile BPscript
try {
  execSync(
    `node --input-type=module -e "import{compileBPS}from'./src/transpiler/index.js';import{readFileSync,writeFileSync}from'fs';const r=compileBPS(readFileSync('${bpsFile.replace(/\\/g,'\\\\')}','utf8'));writeFileSync('/tmp/_s4_gr.txt',r.grammar||'');writeFileSync('/tmp/_s4_al.txt',r.alphabetFile||(Array.isArray(r.alphabet)?r.alphabet.join('\\n'):'')||'');if(r.errors&&r.errors.length){process.stderr.write(r.errors[0].message);process.exit(1);}"`,
    { cwd: ROOT, timeout: 10000, encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] }
  );
} catch (e) {
  console.error(`S4 COMPILE FAIL: ${(e.stderr || e.message || '').substring(0, 80)}`);
  process.exit(1);
}

// Run WASM
const wasmScript = `
var fs=require('fs');
process.chdir('${DIST.replace(/\\/g,'/')}');
console.log=function(){};
require('${path.join(DIST,'bp3.js').replace(/\\/g,'/')}')().then(function(M){
  var init=M.cwrap('bp3_init','number',[]);
  var loadGr=M.cwrap('bp3_load_grammar','number',['string']);
  var loadAl=M.cwrap('bp3_load_alphabet','number',['string']);
  var SP=M.cwrap('bp3_load_settings_params','number',['number','number','number','number','number','number']);
  var produce=M.cwrap('bp3_produce','number',[]);
  var getTT=M.cwrap('bp3_get_timed_tokens','string',[]);
  init();
  SP(${sp.join(',')});
  var al=fs.readFileSync('/tmp/_s4_al.txt','utf-8');if(al.trim())loadAl(al);
  loadGr(fs.readFileSync('/tmp/_s4_gr.txt','utf-8'));
  var r=produce();
  var raw=JSON.parse(getTT());
  var filtered=raw.filter(function(t){return t.token!=='-'&&t.token!=='&'&&t.token!=='.'&&!t.token.startsWith('_');});
  var tokens=filtered.map(function(t){return[t.token,t.start,t.end];});
  process.stdout.write(JSON.stringify({r:r,tokens:tokens})+'\\n');
  process.exit(0);
}).catch(function(e){process.stdout.write(JSON.stringify({error:e.message.substring(0,80)})+'\\n');process.exit(0);});
setTimeout(function(){process.stdout.write(JSON.stringify({error:'TIMEOUT'})+'\\n');process.exit(0);},55000);
`;

fs.writeFileSync('/tmp/_s4_wasm.cjs', wasmScript);
try {
  const out = execSync('node /tmp/_s4_wasm.cjs', { timeout: 60000, encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] });
  const line = out.trim().split('\n').filter(l => l.startsWith('{')).pop();
  const result = line ? JSON.parse(line) : { error: 'no output' };
  if (result.error) { console.error(`S4 FAIL: ${result.error}`); process.exit(1); }

  const snapDir = path.join(DIR, 'snapshots');
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
  const snap = { source: `scenes/${name}.bps`, stage: 'S4', settings: sp, tokens: result.tokens, date: new Date().toISOString().substring(0, 10) };
  fs.writeFileSync(path.join(snapDir, 's4_bps.json'), JSON.stringify(snap, null, 2));
  console.log(`S4 OK: ${result.tokens.length} tokens → ${name}/snapshots/s4_bps.json`);
} catch (e) {
  console.error(`S4 FAIL: ${(e.stderr || e.message || '').substring(0, 80)}`);
  process.exit(1);
}
