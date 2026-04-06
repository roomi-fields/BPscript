#!/usr/bin/env node
/**
 * S5: Compile BPscript scene → BP3 grammar → run on WASM → timed tokens.
 *
 * Pipeline: scene.bps → transpiler(compileBPS) → grammar + alphabet + settings → WASM → timed tokens
 * Comparison: S5 vs S4 (same terminal names, same engine, different grammar source)
 *
 * scene.bps are in test/grammars/{name}/scene.bps
 *
 * Output: test/grammars/{name}/snapshots/s5_bps.json
 *
 * Usage: node s5_bpscript.cjs drum --bin <version>
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
const DIST = _resolveDist(binTag);
const DIR = path.join(__dirname, 'grammars', name);
const TMP = `/tmp/_s5_${name}`;

// Find scene.bps (in grammar dir or scenes/)
const bpsFile = fs.existsSync(path.join(DIR, 'scene.bps'))
  ? path.join(DIR, 'scene.bps')
  : path.join(ROOT, 'scenes', `${name}.bps`);
if (!fs.existsSync(bpsFile)) { console.error(`Not found: scene.bps for ${name}`); process.exit(1); }

const GRAMMARS = require('./grammars/grammars.json');
const gramDef = GRAMMARS[name];
const s1Mode = gramDef?.production_mode || 'midi';
const useTextMode = s1Mode === 'text';

// Step 1: Compile BPscript via ESM wrapper (transpiler uses ES modules)
const compileScript = `
import { compileBPS } from '${path.join(ROOT, 'src/transpiler/index.js').replace(/\\/g, '/')}';
import { readFileSync, writeFileSync } from 'fs';
const source = readFileSync('${bpsFile.replace(/\\/g, '/')}', 'utf8');
const r = compileBPS(source);
writeFileSync('${TMP}_gr.txt', r.grammar || '');
writeFileSync('${TMP}_al.txt', r.alphabetFile || (Array.isArray(r.alphabet) ? r.alphabet.join('\\n') : '') || '');
writeFileSync('${TMP}_se.txt', r.settingsJSON || '');
writeFileSync('${TMP}_ct.json', JSON.stringify(r.controlTable || {}));
writeFileSync('${TMP}_alphabet.json', JSON.stringify(r.alphabet || []));
// Extract alphabet directive for resolver config
const alphDir = (r.directives || []).find(d => d.name === 'alphabet');
const info = { errors: r.errors || [], grammarLines: (r.grammar || '').split('\\n').length, alphabetSize: (r.alphabet || []).length,
  alphabetName: alphDir?.subkey || null };
writeFileSync('${TMP}_compile.json', JSON.stringify(info));
`;
fs.writeFileSync(`${TMP}_compile.mjs`, compileScript);

try {
  execSync(`node ${TMP}_compile.mjs`, { cwd: ROOT, timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch (e) {
  console.error(`S5 COMPILE FAIL: ${(e.stderr || e.message || '').substring(0, 120)}`);
  process.exit(1);
}

const compileInfo = JSON.parse(fs.readFileSync(`${TMP}_compile.json`, 'utf-8'));
if (compileInfo.errors.length > 0) {
  console.error(`S5 COMPILE ERRORS: ${compileInfo.errors.map(e => e.message).join('; ')}`);
  process.exit(1);
}

// Step 2: Run WASM with compiled grammar
const wasmScript = `
var fs=require('fs');
var TMP='${TMP}';
process.chdir('${DIST.replace(/\\/g, '/')}');
console.log=function(){};
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
  if(${useTextMode ? 'true' : 'false'})setWriteMidi(0);
  setSeed(1);
  setVerbose(1);
  var al=fs.readFileSync(TMP+'_al.txt','utf-8');if(al.trim())loadAl(al);
  loadGr(fs.readFileSync(TMP+'_gr.txt','utf-8'));
  var r=produce();
  var timed;
  if(${useTextMode ? 'true' : 'false'}){
    var txt=getResult();
    var lines=txt.split('\\n').filter(function(l){return l.trim();});
    timed=[];
    for(var i=0;i<lines.length;i++){
      var names=lines[i].trim().split(/\\s+/).filter(function(t){return t;});
      for(var j=0;j<names.length;j++){var n=names[j].replace(/^'(.*)'$/,'$1');timed.push([n,0,0]);}
    }
  } else {
    var timedRaw=JSON.parse(getTT());
    timed=timedRaw.map(function(t){return[t.token,t.start,t.end];});
  }
  require('fs').writeFileSync(TMP+'_result.json',JSON.stringify({r:r,timed:timed}));
  process.stdout.write('OK\\n');
  process.exit(0);
}).catch(function(e){require('fs').writeFileSync(TMP+'_result.json',JSON.stringify({error:e.message.substring(0,80)}));process.stdout.write('OK\\n');process.exit(0);});
setTimeout(function(){require('fs').writeFileSync(TMP+'_result.json',JSON.stringify({error:'TIMEOUT'}));process.stdout.write('OK\\n');process.exit(0);},120000);
`;

fs.writeFileSync(`${TMP}_wasm.cjs`, wasmScript);
try {
  execSync(`node ${TMP}_wasm.cjs`, { timeout: 130000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  const resultJson = fs.readFileSync(`${TMP}_result.json`, 'utf-8');
  const result = JSON.parse(resultJson);
  if (result.error) { console.error(`S5 WASM FAIL: ${result.error}`); process.exit(1); }

  // Step 3: Pass timed tokens through dispatcher resolveTokens() for control resolution
  const controlTable = JSON.parse(fs.readFileSync(`${TMP}_ct.json`, 'utf-8'));

  let finalTokens = result.timed;
  if (!useTextMode) {
    // Build timed token objects for dispatcher.load()
    const timedForDispatcher = result.timed.map(t => ({ token: t[0], start: t[1], end: t[2] }));

    const alphabetName = compileInfo.alphabetName || 'western';
    const resolveScript = `
import { Dispatcher } from '${path.join(ROOT, 'src/dispatcher/dispatcher.js').replace(/\\/g, '/')}';
import { Resolver } from '${path.join(ROOT, 'src/dispatcher/resolver.js').replace(/\\/g, '/')}';
import { readFileSync, writeFileSync } from 'fs';

const timedTokens = JSON.parse(readFileSync('${TMP}_timed_for_dispatch.json', 'utf-8'));
const controlTable = JSON.parse(readFileSync('${TMP}_ct.json', 'utf-8'));

// Load libs for resolver config
const LIB = '${path.join(ROOT, 'lib').replace(/\\/g, '/')}';
const alphabets = JSON.parse(readFileSync(LIB + '/alphabet.json', 'utf-8'));
const octaves = JSON.parse(readFileSync(LIB + '/octaves.json', 'utf-8'));
const tunings = JSON.parse(readFileSync(LIB + '/tunings.json', 'utf-8'));
const temperaments = JSON.parse(readFileSync(LIB + '/temperaments.json', 'utf-8'));

const alphName = '${alphabetName}';
const alph = alphabets[alphName];
const octConfig = alph?.octaves ? octaves[alph.octaves] : octaves.western;
// Find matching tuning (alphabetName_12TET or first matching)
const tuningKey = alphName + '_12TET';
const tuning = tunings[tuningKey] || Object.values(tunings).find(t => t.alphabet === alphName) || tunings.western_12TET;
const temp = temperaments[tuning.temperament];

const resolver = new Resolver({ alphabet: alph, octaves: octConfig, tuning, temperament: temp });

// Minimal AudioContext mock (resolveTokens doesn't use audio)
const mockCtx = { currentTime: 0, state: 'suspended', resume() {} };
const d = new Dispatcher(mockCtx);
d._resolver = resolver;
d.setControlTable(controlTable);
d.load(timedTokens);
const resolved = d.resolveTokens();

writeFileSync('${TMP}_resolved.json', JSON.stringify(resolved));
`;
    fs.writeFileSync(`${TMP}_timed_for_dispatch.json`, JSON.stringify(timedForDispatcher));
    fs.writeFileSync(`${TMP}_resolve.mjs`, resolveScript);

    try {
      execSync(`node ${TMP}_resolve.mjs`, { cwd: ROOT, timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      const resolved = JSON.parse(fs.readFileSync(`${TMP}_resolved.json`, 'utf-8'));
      finalTokens = resolved.map(t => [t.token, t.start, t.end]);
    } catch (e) {
      // If dispatcher fails, fall back to raw tokens (non-fatal)
      const errMsg = (e.stderr || e.message || '').substring(0, 200);
      console.error(`S5 DISPATCH WARN: ${errMsg} (using raw tokens)`);
    }
  }

  const snapDir = path.join(DIR, 'snapshots');
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
  const today = new Date().toISOString().substring(0, 10);
  const alphabet = JSON.parse(fs.readFileSync(`${TMP}_alphabet.json`, 'utf-8'));
  const snap = { source: `scene.bps`, stage: 'S5', mode: s1Mode,
    compile: { grammarLines: compileInfo.grammarLines, alphabetSize: compileInfo.alphabetSize },
    alphabet: alphabet,
    tokens: finalTokens, date: today };
  fs.writeFileSync(path.join(snapDir, 's5_bps.json'), JSON.stringify(snap, null, 2));
  console.log(`S5 OK: ${finalTokens.length} tokens → ${name}/snapshots/s5_bps.json`);
} catch (e) {
  console.error(`S5 WASM FAIL: ${(e.stderr || e.message || '').substring(0, 120)}`);
  process.exit(1);
}
