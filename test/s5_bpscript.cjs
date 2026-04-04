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

const { requireBinTag, resolveDist: _resolveDist, stripBinArgs } = require('./resolve_bin.cjs');

const _args = stripBinArgs(process.argv.slice(2));
const name = _args[0];
if (!name) { console.error('Usage: node s5_bpscript.cjs <grammar> --bin <version>'); process.exit(1); }
const binTag = requireBinTag();

const ROOT = path.resolve(__dirname, '..');
const BP3_DIR = path.resolve(ROOT, '..', 'bp3-engine');
const DIST = _resolveDist(binTag);
const SCENES = path.resolve(ROOT, 'scenes');
const DIR = path.join(__dirname, 'grammars', name);

const bpsFile = path.join(SCENES, `${name}.bps`);
if (!fs.existsSync(bpsFile)) { console.error(`Not found: ${bpsFile}`); process.exit(1); }

// Read settings from S2 snapshot (reuse same params)
// Look for S2 snapshot — try scene name dir first, then check map for grammar name
const GRAMMARS = require('./grammars/grammars.json');
const grName = GRAMMARS[name]?.bernard || name;
const s2Snap = fs.existsSync(path.join(__dirname, 'grammars', name, 'snapshots', 's2_orig.json'))
  ? path.join(__dirname, 'grammars', name, 'snapshots', 's2_orig.json')
  : path.join(__dirname, 'grammars', grName, 'snapshots', 's2_orig.json');
let sp = [0, 10, 10, 1, 1, 60];
if (fs.existsSync(s2Snap)) {
  try { sp = JSON.parse(fs.readFileSync(s2Snap, 'utf-8')).settings || sp; } catch(e) {}
}
// S4 ALWAYS uses NoteConvention=0 (silent sound objects, opaque terminals)
sp[0] = 0;

// Compile BPscript
try {
  execSync(
    `node --input-type=module -e "import{compileBPS}from'./src/transpiler/index.js';import{readFileSync,writeFileSync}from'fs';const r=compileBPS(readFileSync('${bpsFile.replace(/\\/g,'\\\\')}','utf8'));writeFileSync('/tmp/_s4_gr.txt',r.grammar||'');writeFileSync('/tmp/_s4_al.txt',r.alphabetFile||(Array.isArray(r.alphabet)?r.alphabet.join('\\n'):'')||'');writeFileSync('/tmp/_s4_se.txt',r.settingsJSON||'');if(r.errors&&r.errors.length){process.stderr.write(r.errors[0].message);process.exit(1);}"`,
    { cwd: ROOT, timeout: 10000, encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] }
  );
} catch (e) {
  console.error(`S4 COMPILE FAIL: ${(e.stderr || e.message || '').substring(0, 80)}`);
  process.exit(1);
}

// Override MaxItemsProduce in S4 settings for reproducible comparison
try {
  const seRaw = fs.readFileSync('/tmp/_s4_se.txt', 'utf-8');
  if (seRaw.trim()) {
    const seObj = JSON.parse(seRaw);
    seObj.MaxItemsProduce = {name: "Max items to produce", value: "10"};
    fs.writeFileSync('/tmp/_s4_se.txt', JSON.stringify(seObj));
  }
} catch(e) {}

// Run WASM
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
  var produce=M.cwrap('bp3_produce','number',[]);
  var getTT=M.cwrap('bp3_get_timed_tokens','string',[]);
  init();
  var seJson=fs.readFileSync('/tmp/_s4_se.txt','utf-8');if(seJson.trim())loadSettings(seJson);
  setSeed(1);
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
