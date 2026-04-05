#!/usr/bin/env node
/**
 * S4: Run original Bernard grammar with silent (flat) alphabet on WASM.
 *
 * S4 = S2 pipeline + silent.al loaded instead of the grammar's own alphabet.
 * This validates that the engine produces correct timed tokens when terminals
 * are opaque bols (no MIDI prototypes) instead of simple notes (j >= 16384).
 *
 * Requires: test/grammars/{name}/silent.al
 * Uses: same grammar, settings, aux files as S2 (original.gr)
 *
 * Output: test/grammars/{name}/snapshots/s4_silent.json (timed tokens)
 *
 * Usage: node s4_wasm_silent.cjs drum --bin <version>
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { requireBinTag, resolveDist: _resolveDist, stripBinArgs } = require('./resolve_bin.cjs');

const _args = stripBinArgs(process.argv.slice(2));
const name = _args[0];
if (!name) { console.error('Usage: node s4_wasm_silent.cjs <grammar> --bin <version>'); process.exit(1); }
const binTag = requireBinTag();

const DIR = path.join(__dirname, 'grammars', name);
const silentAl = path.join(DIR, 'silent.al');
if (!fs.existsSync(silentAl)) { console.error(`Not found: ${silentAl}`); process.exit(1); }

// Step 1: Run S2 pipeline (generates S2+S3 snapshots and leaves temp files)
try {
  execSync(`node ${path.join(__dirname, 's2_wasm_orig.cjs')} ${name} --bin ${binTag}`, {
    timeout: 60000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
  });
} catch(e) {
  console.error(`S4 FAIL (S2 step): ${(e.stderr || e.message || '').substring(0, 120)}`);
  process.exit(1);
}

// Step 2: Re-run WASM with same grammar but silent.al alphabet override
const DIST = _resolveDist(binTag);
const TMP = `/tmp/_s2_${name}`;
const ROOT = path.resolve(__dirname, '..');
const BP3_DIR = path.resolve(ROOT, '..', 'bp3-engine');
const TD = path.resolve(BP3_DIR, 'test-data');

// Read the silent alphabet
const silentAlContent = fs.readFileSync(silentAl, 'utf-8');

// Overwrite the alphabet temp file with silent.al
fs.writeFileSync(`${TMP}_al.txt`, silentAlContent);


// Provision -ho. file if grammar references one (needed for homomorphism resolution)
const grContent = fs.readFileSync(`${TMP}_gr.txt`, 'utf-8');
const hoMatch = grContent.match(/-ho\.(\S+)/);
let hoProvision = '';
if (hoMatch) {
  const hoFile = path.join(TD, `-ho.${hoMatch[1]}`);
  if (fs.existsSync(hoFile)) {
    const hoContent = fs.readFileSync(hoFile, 'utf-8');
    fs.writeFileSync(`${TMP}_ho.txt`, hoContent);
    hoProvision = `prov('-ho.${hoMatch[1]}',fs.readFileSync(TMP+'_ho.txt','utf-8'));`;
  }
}

const GRAMMARS = require('./grammars/grammars.json');
const gramDef = GRAMMARS[name];
const s1Mode = gramDef?.production_mode || 'midi';
const useTextMode = s1Mode === 'text';

const wasmScript = `
var fs=require('fs');
var TMP='${TMP}';
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
  var getResult=M.cwrap('bp3_get_result','string',[]);
  var setWriteMidi=M.cwrap('bp3_set_write_midi','void',['number']);
  var prov=M.cwrap('bp3_provision_file','number',['string','string']);
  var loadProto=M.cwrap('bp3_load_object_prototypes','number',['string']);
  init();
  var seJson=fs.readFileSync(TMP+'_se.txt','utf-8');
  if(seJson.trim())loadSettings(seJson);
  if(${useTextMode ? 'true' : 'false'})setWriteMidi(0);
  // Load SILENT alphabet (the key difference from S2)
  var al=fs.readFileSync(TMP+'_al.txt','utf-8');if(al.trim())loadAl(al);
  // Provision -ho. file for homomorphism grammars
  ${hoProvision}
  var miFiles=fs.readdirSync('/tmp').filter(function(f){return f.startsWith('_s2_${name}_mi_');});
  miFiles.forEach(function(f){var n='-mi.'+f.replace('_s2_${name}_mi_','').replace('.txt','');prov(n,fs.readFileSync('/tmp/'+f,'utf-8'));});
  var so=fs.readFileSync(TMP+'_so.txt','utf-8');if(so.trim())loadProto(so);
  var to=fs.readFileSync(TMP+'_to.txt','utf-8');if(to.trim())loadTo(to);
  loadGr(fs.readFileSync(TMP+'_gr.txt','utf-8'));
  setSeed(1);
  var r=produce();
  // Timed tokens
  var timed;
  if(${useTextMode ? 'true' : 'false'}){
    var txt=getResult();
    var lines=txt.split('\\n').filter(function(l){return l.trim();});
    var textTokens=[];
    for(var i=0;i<lines.length;i++){
      var names=lines[i].trim().split(/\\s+/).filter(function(t){return t;});
      for(var j=0;j<names.length;j++){var n=names[j].replace(/^'(.*)'$/,'$1');textTokens.push([n]);}
    }
    timed=textTokens.map(function(t){return[t[0],0,0];});
  } else {
    var timedRaw=JSON.parse(getTT());
    timed=timedRaw.map(function(t){return[t.token,t.start,t.end];});
  }
  require('fs').writeFileSync(TMP+'_s4_result.json',JSON.stringify({r:r,timed:timed}));
  process.stdout.write('OK\\n');
  process.exit(0);
}).catch(function(e){require('fs').writeFileSync(TMP+'_s4_result.json',JSON.stringify({error:e.message.substring(0,80)}));process.stdout.write('OK\\n');process.exit(0);});
setTimeout(function(){require('fs').writeFileSync(TMP+'_s4_result.json',JSON.stringify({error:'TIMEOUT'}));process.stdout.write('OK\\n');process.exit(0);},55000);
`;

fs.writeFileSync(`${TMP}_s4_wasm.cjs`, wasmScript);
try {
  execSync(`node ${TMP}_s4_wasm.cjs`, { timeout: 60000, encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] });
  const resultJson = fs.readFileSync(`${TMP}_s4_result.json`, 'utf-8');
  const result = JSON.parse(resultJson);
  if (result.error) { console.error(`S4 FAIL: ${result.error}`); process.exit(1); }

  const snapDir = path.join(DIR, 'snapshots');
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
  const today = new Date().toISOString().substring(0, 10);
  const snap = { source: 'original.gr+silent.al', stage: 'S4', mode: s1Mode,
    tokens: result.timed, date: today };
  fs.writeFileSync(path.join(snapDir, 's4_silent.json'), JSON.stringify(snap, null, 2));
  console.log(`S4 OK: ${result.timed.length} tokens → ${name}/snapshots/s4_silent.json`);
} catch (e) {
  console.error(`S4 FAIL: ${(e.stderr || e.message || '').substring(0, 120)}`);
  process.exit(1);
}
