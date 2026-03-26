#!/usr/bin/env node
/**
 * S2: Run original Bernard grammar on WASM engine.
 * Produces timed tokens [name, start, end].
 *
 * Usage: node s2_wasm_orig.cjs drum
 * Output: test/grammars/drum/snapshots/s2_orig.json
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const name = process.argv[2];
if (!name) { console.error('Usage: node s2_wasm_orig.cjs <grammar>'); process.exit(1); }

const ROOT = path.resolve(__dirname, '..', '..');
const TD = path.resolve(ROOT, '..', 'bp3-engine', 'test-data');
const DIST = path.resolve(ROOT, 'dist');

const MAP = require('./map.json');
const grName = MAP[name] || name;

const grFile = path.join(TD, `-gr.${grName}`);
if (!fs.existsSync(grFile)) { console.error(`Not found: ${grFile}`); process.exit(1); }

// Read grammar, strip old headers and fix old Mac encoding
let grRaw = fs.readFileSync(grFile, 'utf-8');
const grLines = grRaw.split('\n');
let grStart = 0;
for (let i = 0; i < grLines.length; i++) {
  const l = grLines[i].trim();
  if (l.startsWith('//') || l.match(/^-[a-z]{2}\./) || l.match(/^(ORD|RND|SUB|LIN|TEM|GRAM)/i)) {
    grStart = i; break;
  }
}
if (grStart > 0) grRaw = grLines.slice(grStart).join('\n');
// Strip INIT: lines (GUI commands not supported in console/WASM)
grRaw = grRaw.split('\n').filter(l => !l.trim().startsWith('INIT:')).join('\n');
const gr = grRaw.replace(/\u00A5/g, '.').replace(/\u017E/g, 'u');

// Extract settings params.
// NoteConvention: auto-detect from grammar content.
// 0=English (C D E), 1=French (do re mi), 2=Indian (sa re ga ma pa dha ni)
// Strip comments before detecting notation (avoid false positives from // comments)
const grNoComments = gr.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
const hasFrench = /\b(do|re|mi|fa|sol|la|si)\d\b/.test(grNoComments);
// Indian: require sa or ga (unique to sargam, don't exist in French or English)
const hasIndian = /\b(sa|ga)\d\b/.test(grNoComments);
const noteConv = hasIndian ? 2 : (hasFrench ? 1 : 0);
const seMatch = gr.match(/-se\.(\S+)/);
let sp = [noteConv, 10, 10, 1, 1, 60];
if (seMatch) {
  const f = path.join(TD, `-se.${seMatch[1]}`);
  if (fs.existsSync(f)) {
    const c = fs.readFileSync(f, 'utf-8');
    if (c.trim().startsWith('{')) {
      try {
        const o = JSON.parse(c);
        sp = [noteConv, parseInt(o.Quantization?.value)||10,
              parseInt(o.Time_res?.value)||10, parseInt(o.Nature_of_time?.value)||1, 1,
              parseInt(o.MaxConsoleTime?.value)||60];
      } catch(e) {}
    } else {
      const l = c.split('\n');
      const n = (i) => { const v = parseFloat((l[i-1]||'').trim()); return isNaN(v) ? null : v; };
      sp = [noteConv, n(5)||10, n(6)||10, n(9)||1, 1, n(47)||60];
    }
  }
}

// Aux files
const alMatch = gr.match(/-al\.(\S+)/);
const hoMatch = gr.match(/-ho\.(\S+)/);
const toMatch = gr.match(/-to\.(\S+)/);
const csMatch = gr.match(/-cs\.(\S+)/);

let alContent = '';
if (alMatch) {
  const f = path.join(TD, `-al.${alMatch[1]}`);
  if (fs.existsSync(f)) alContent = fs.readFileSync(f, 'utf-8');
}
if (!alContent && hoMatch) {
  // Load -ho. file as alphabet. Strip V.x.x / Date: legacy header (BP2.5 format)
  // that causes "Can't accept character ':'" in CompileAlphabet.
  const f = path.join(TD, `-ho.${hoMatch[1]}`);
  if (fs.existsSync(f)) {
    const hoLines = fs.readFileSync(f, 'utf-8').split('\n');
    let start = 0;
    if (hoLines[0] && /^V\.\d/.test(hoLines[0])) start++;
    if (hoLines[start] && /^Date:/.test(hoLines[start])) start++;
    alContent = hoLines.slice(start).join('\n');

    // Provision -mi. file referenced inside -ho. to Emscripten FS
    const miMatch = alContent.match(/^-mi\.(\S+)/m);
    if (miMatch) {
      const mf = path.join(TD, `-mi.${miMatch[1]}`);
      if (fs.existsSync(mf)) fs.writeFileSync(`/tmp/_s2_mi_${miMatch[1]}.txt`, fs.readFileSync(mf, 'utf-8'));
    }
  }
}

let toContent = '';
if (toMatch) { const f = path.join(TD, `-to.${toMatch[1]}`); if (fs.existsSync(f)) toContent = fs.readFileSync(f, 'utf-8'); }
if (!toContent) {
  for (const c of [grName, seMatch?.[1], csMatch?.[1]].filter(Boolean)) {
    const f = path.join(TD, `-to.${c}`); if (fs.existsSync(f)) { toContent = fs.readFileSync(f, 'utf-8'); break; }
  }
}

// Write temp files and run WASM
fs.writeFileSync('/tmp/_s2_gr.txt', gr);
fs.writeFileSync('/tmp/_s2_al.txt', alContent);
fs.writeFileSync('/tmp/_s2_to.txt', toContent);

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
  var prov=M.cwrap('bp3_provision_file','number',['string','string']);
  var al=fs.readFileSync('/tmp/_s2_al.txt','utf-8');if(al.trim())loadAl(al);
  var to=fs.readFileSync('/tmp/_s2_to.txt','utf-8');if(to.trim())loadTo(to);
  var miFiles=fs.readdirSync('/tmp').filter(function(f){return f.startsWith('_s2_mi_');});
  miFiles.forEach(function(f){var name='-mi.'+f.replace('_s2_mi_','').replace('.txt','');prov(name,fs.readFileSync('/tmp/'+f,'utf-8'));});
  loadGr(fs.readFileSync('/tmp/_s2_gr.txt','utf-8'));
  var r=produce();
  var raw=JSON.parse(getTT());
  var filtered=raw.filter(function(t){return t.token!=='-'&&t.token!=='&'&&t.token!=='.'&&!t.token.startsWith('_');});
  var tokens=filtered.map(function(t){return[t.token,t.start,t.end];});
  process.stdout.write(JSON.stringify({r:r,tokens:tokens})+'\\n');
  process.exit(0);
}).catch(function(e){process.stdout.write(JSON.stringify({error:e.message.substring(0,80)})+'\\n');process.exit(0);});
setTimeout(function(){process.stdout.write(JSON.stringify({error:'TIMEOUT'})+'\\n');process.exit(0);},55000);
`;

fs.writeFileSync('/tmp/_s2_wasm.cjs', wasmScript);
try {
  const out = execSync('node /tmp/_s2_wasm.cjs', { timeout: 60000, encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] });
  const line = out.trim().split('\n').filter(l => l.startsWith('{')).pop();
  const result = line ? JSON.parse(line) : { error: 'no output' };
  if (result.error) { console.error(`S2 FAIL: ${result.error}`); process.exit(1); }

  const snapDir = path.join(__dirname, name, 'snapshots');
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
  const snap = { source: `-gr.${grName}`, stage: 'S2', settings: sp, tokens: result.tokens, date: new Date().toISOString().substring(0, 10) };
  fs.writeFileSync(path.join(snapDir, 's2_orig.json'), JSON.stringify(snap, null, 2));
  console.log(`S2 OK: ${result.tokens.length} tokens → ${name}/snapshots/s2_orig.json`);
} catch (e) {
  console.error(`S2 FAIL: ${(e.stderr || e.message || '').substring(0, 80)}`);
  process.exit(1);
}
