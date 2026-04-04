#!/usr/bin/env node
/**
 * S2+S3: Run original Bernard grammar on WASM engine.
 *
 * S2 = MIDI events (midi mode) or text tokens (text mode) — same format as S1
 * S3 = Raw timed tokens from bp3_get_timed_tokens() — all tokens with timing
 *
 * Usage: node s2_wasm_orig.cjs drum
 * Output: test/grammars/drum/snapshots/s2_orig.json  (MIDI/text — comparable to S1)
 *         test/grammars/drum/snapshots/s3_timed.json  (timed tokens)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { requireBinTag, resolveDist: _resolveDist, stripBinArgs } = require('./resolve_bin.cjs');

const args = stripBinArgs(process.argv.slice(2));
const name = args[0];
if (!name) { console.error('Usage: node s2_wasm_orig.cjs <grammar> --bin <version>'); process.exit(1); }
const binTag = requireBinTag();

// Convert old BP2 positional settings to JSON.
// Mapping from settings_names_old.txt (Bernard Bel, email 23 mars 2026).
// File format: 2 header lines (// comments), then one value per line.
// Position P in settings_names_old.txt → file line (P + 2) in 0-based array.
function convertOldSettings(c) {
  const lines = c.split(/\r\n?|\n/);
  // Skip header lines (// comments at start)
  let hdr = 0;
  while (hdr < lines.length && lines[hdr].trim().startsWith('//')) hdr++;
  const vals = lines.slice(hdr);
  if (vals.length < 48) return null; // need at least up to NoteConvention (pos 47)
  const v = (pos) => {
    const s = (vals[pos] || '').trim();
    if (!s || s.startsWith('/') || s.startsWith('<')) return null;
    const f = parseFloat(s); return isNaN(f) ? null : s;
  };
  const o = {};
  const set = (k, nm, pos, bool, unit) => {
    const val = v(pos); if (val === null) return;
    const e = { name: nm, value: val, boolean: bool ? '1' : '0' };
    if (unit) e.unit = unit; o[k] = e;
  };
  // TIMING (pos 2-8)
  set('Quantization','Quantization',2,false,'ms');
  set('Time_res','Time resolution',3,false,'ms');
  set('MIDIsyncDelay','Sync delay',4,false,'ms');
  set('Quantize','Quantize',5,true);
  set('Nature_of_time','Striated time',6,true);
  set('Pclock','Pclock',7,false);
  set('Qclock','Qclock',8,false);
  // PRODUCTION (pos 10-14)
  set('Improvize','Non-stop improvize',10,true);
  set('MaxItemsProduce','Max items produced',11,false);
  set('UseEachSub','Play each substitution',12,true);
  set('AllItems','Produce all items',13,true);
  set('DisplayProduce','Display production',14,true);
  // DISPLAY (pos 19-21)
  set('DisplayItems','Display final score',19,true);
  set('ShowGraphic','Show graphics',20,true);
  set('AllowRandomize','Allow randomize',21,true);
  // COMPUTE (pos 27-45)
  set('ResetNotes','Reset Notes',27,true);
  set('ComputeWhilePlay','Compute while playing',28,true);
  set('ResetWeights','Reset rule weights',30,true);
  set('ResetFlags','Reset rule flags',31,true);
  set('ResetControllers','Reset controllers',32,true);
  set('NoConstraint','Ignore constraints',33,true);
  set('SplitTimeObjects','Split terminal symbols',38,true);
  set('SplitVariables','Split |variables|',39,true);
  set('DeftBufferSize','Default buffer size',41,false);
  set('MaxConsoleTime','Max computation time',44,false,'seconds');
  set('Seed','Seed for randomization',45,false);
  // NOTES (pos 47)
  set('NoteConvention','Note convention',47,false);
  // GRAPHICS (pos 50-51)
  if (vals.length > 51) {
    set('GraphicScaleP','Graphic scale P',50,false);
    set('GraphicScaleQ','Graphic scale Q',51,false);
  }
  // MIDI (pos 61-70)
  if (vals.length > 70) {
    set('EndFadeOut','Fade-out time',61,false,'seconds');
    set('C4key','C4 key number',62,false,'MIDI key');
    set('A4freq','A4 frequency',63,false,'Hz');
    set('StrikeAgainDefault','Strike again NoteOn\'s',64,true);
    set('DeftVolume','Default volume',65,false,'0-127');
    set('VolumeController','Volume controller',66,false,'0-127');
    set('DeftVelocity','Default velocity',67,false,'0-127');
    set('DeftPanoramic','Default panoramic',68,false,'0-127');
    set('PanoramicController','Panoramic controller',69,false,'0-127');
    set('SamplingRate','Sampling rate',70,false);
  }
  // MISC (pos 111+)
  if (vals.length > 111) set('DefaultBlockKey','Default block key',111,false,'MIDI key');
  if (vals.length > 127) {
    set('ShowObjectGraph','Show object graph',126,true);
    set('ShowPianoRoll','Show pianoroll',127,true);
  }
  return o.NoteConvention ? JSON.stringify(o) : null;
}

const ROOT = path.resolve(__dirname, '..');
const BP3_DIR = path.resolve(ROOT, '..', 'bp3-engine');
const TD = path.resolve(BP3_DIR, 'test-data');
const DIST = _resolveDist(binTag);
const TMP = `/tmp/_s2_${name}`;

const GRAMMARS = require('./grammars/grammars.json');
const gramDef = GRAMMARS[name];
if (!gramDef) { console.error(`Unknown grammar: ${name}. Not in grammars.json`); process.exit(1); }
if (gramDef.status === 'excluded') { console.error(`SKIP: ${name} is excluded`); process.exit(1); }
const grName = gramDef.bernard || name;

const grFile = path.join(TD, `-gr.${grName}`);
if (!fs.existsSync(grFile)) { console.error(`Not found: ${grFile}`); process.exit(1); }

// Read grammar, strip old headers and fix old Mac encoding
let grRaw = fs.readFileSync(grFile, 'utf-8').replace(/\r\n?/g, '\n');
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

// NoteConvention: auto-detect from grammar content.
// 0=English (C D E), 1=French (do re mi), 2=Indian (sa re ga ma pa dha ni)
// Strip comments before detecting notation (avoid false positives from // comments)
const grNoComments = gr.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
const hasFrench = /\b(do|re|mi|fa|sol|la|si)\d\b/.test(grNoComments);
// Indian: require sa or ga (unique to sargam, don't exist in French or English)
const hasIndian = /\b(sa|ga)\d\b/.test(grNoComments);
const noteConv = hasIndian ? 2 : (hasFrench ? 1 : 0);

// Settings: use s1_args if present, otherwise auto-detect from grammar header
// This ensures S2 uses the same settings as S1.
let explicitSe = null, explicitTo = null;
if (gramDef.s1_args) {
  for (let i = 0; i < gramDef.s1_args.length; i++) {
    if (gramDef.s1_args[i] === '-se' && i + 1 < gramDef.s1_args.length) explicitSe = gramDef.s1_args[++i];
    if (gramDef.s1_args[i] === '-to' && i + 1 < gramDef.s1_args.length) explicitTo = gramDef.s1_args[++i];
  }
}
// Also check php_ref.tonality
if (!explicitTo && gramDef.php_ref && gramDef.php_ref.tonality) explicitTo = gramDef.php_ref.tonality;

const seMatch = explicitSe ? [null, explicitSe.replace(/^-se\./, '')] : gr.match(/-se\.(\S+)/);
let seJsonContent = '';
let sp = [noteConv, 10, 10, 1, 1, 60];
if (seMatch) {
  const f = path.join(TD, `-se.${seMatch[1]}`);
  if (fs.existsSync(f)) {
    const c = fs.readFileSync(f, 'utf-8');
    if (c.trim().startsWith('{')) {
      seJsonContent = c;
      // Extract basic params for snapshot metadata
      try {
        const o = JSON.parse(c);
        sp = [noteConv, parseInt(o.Quantization?.value)||10,
              parseInt(o.Time_res?.value)||10, parseInt(o.Nature_of_time?.value)||1, 1,
              parseInt(o.MaxConsoleTime?.value)||60];
      } catch(e) {}
    } else {
      // Legacy BP2 positional settings — convert to JSON
      const converted = convertOldSettings(c.replace(/\r\n?/g, '\n'));
      if (converted) {
        const seObj = JSON.parse(converted);
        // Override NoteConvention from auto-detection (BP2 value may be wrong)
        seObj.NoteConvention = {name: "Note convention", value: String(noteConv), boolean: '0'};
        // Keep original MaxItemsProduce from settings (don't override — must match S0/S1)
        seJsonContent = JSON.stringify(seObj);
        sp = [noteConv, parseInt(seObj.Quantization?.value)||10,
              parseInt(seObj.Time_res?.value)||10, parseInt(seObj.Nature_of_time?.value)||1, 1,
              parseInt(seObj.MaxConsoleTime?.value)||60];
      }
    }
  }
}

// Aux files: check s1_args first, then grammar header
let explicitAl = null;
if (gramDef.s1_args) {
  for (let i = 0; i < gramDef.s1_args.length; i++) {
    if (gramDef.s1_args[i] === '-al' && i + 1 < gramDef.s1_args.length) explicitAl = gramDef.s1_args[++i];
  }
}
const alMatch = explicitAl ? [null, explicitAl.replace(/^-al\./, '')] : gr.match(/-al\.(\S+)/);
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
      if (fs.existsSync(mf)) fs.writeFileSync(`${TMP}_mi_${miMatch[1]}.txt`, fs.readFileSync(mf, 'utf-8'));
    }
  }
}

let toContent = '';
// Priority: explicitTo (from s1_args/php_ref) > grammar header > inference
if (explicitTo) {
  const f = path.join(TD, explicitTo.startsWith('-to.') ? explicitTo : `-to.${explicitTo}`);
  if (fs.existsSync(f)) toContent = fs.readFileSync(f, 'utf-8');
}
if (!toContent && toMatch) { const f = path.join(TD, `-to.${toMatch[1]}`); if (fs.existsSync(f)) toContent = fs.readFileSync(f, 'utf-8'); }
if (!toContent) {
  for (const c of [grName, seMatch?.[1], csMatch?.[1]].filter(Boolean)) {
    const f = path.join(TD, `-to.${c}`); if (fs.existsSync(f)) { toContent = fs.readFileSync(f, 'utf-8'); break; }
  }
}

// Sound-object prototypes: check s1_args for -so
let soContent = '';
if (gramDef.s1_args) {
  for (let i = 0; i < gramDef.s1_args.length; i++) {
    if (gramDef.s1_args[i] === '-so' && i + 1 < gramDef.s1_args.length) {
      const soName = gramDef.s1_args[++i].replace(/^-so\./, '');
      const f = path.join(TD, `-so.${soName}`);
      if (fs.existsSync(f)) soContent = fs.readFileSync(f, 'utf-8');
      break;
    }
  }
}

// Detect mode: text grammars use getResult(), midi grammars use getTT()
const s1Mode = gramDef.production_mode || 'midi';
const useTextMode = s1Mode === 'text';
let allItems = false;
if (seJsonContent) {
  try {
    const seObj = JSON.parse(seJsonContent);
    allItems = seObj.AllItems?.value === '1';
    // Keep original MaxItemsProduce from settings (don't override — must match S0/S1)
    // DisplayItems must be 1 for production output (BP2 settings often have 0)
    seObj.DisplayItems = {name: "Display final score", value: "1", boolean: "1"};
    // Disable graphics (crash in console/WASM mode)
    seObj.ShowGraphic = {name: "Show graphic", value: "0", boolean: "1"};
    seObj.ShowPianoRoll = {name: "Show piano roll", value: "0", boolean: "1"};
    seObj.ShowObjectGraph = {name: "Show object graph", value: "0", boolean: "1"};
    // Disable traces (same as S0/S1)
    seObj.TraceProduce = {name: "Trace production", value: "0", boolean: "1"};
    seJsonContent = JSON.stringify(seObj);
  } catch(e) {}
}

// Write temp files and run WASM (per-grammar prefix for parallel safety)
fs.writeFileSync(`${TMP}_gr.txt`, gr);
fs.writeFileSync(`${TMP}_al.txt`, alContent);
fs.writeFileSync(`${TMP}_to.txt`, toContent);
fs.writeFileSync(`${TMP}_se.txt`, seJsonContent);
fs.writeFileSync(`${TMP}_so.txt`, soContent);

const wasmScript = `
var fs=require('fs');
var TMP='/tmp/_s2_${name}';
process.chdir('${DIST.replace(/\\/g,'/')}');
console.log=function(){};
require('${path.join(DIST,'bp3.js').replace(/\\/g,'/')}')().then(function(M){
  var init=M.cwrap('bp3_init','number',[]);
  var loadGr=M.cwrap('bp3_load_grammar','number',['string']);
  var loadAl=M.cwrap('bp3_load_alphabet','number',['string']);
  var loadSettings=M.cwrap('bp3_load_settings','number',['string']);
  var setSeed=M.cwrap('bp3_set_seed','void',['number']);
  var SP=M.cwrap('bp3_load_settings_params','number',['number','number','number','number','number','number']);
  var loadTo=M.cwrap('bp3_load_tonality','number',['string']);
  var produce=M.cwrap('bp3_produce','number',[]);
  var getTT=M.cwrap('bp3_get_timed_tokens','string',[]);
  var getResult=M.cwrap('bp3_get_result','string',[]);
  var getMidi=M.cwrap('bp3_get_midi_events','string',[]);
  init();
  var seJson=fs.readFileSync(TMP+'_se.txt','utf-8');
  if(seJson.trim()){loadSettings(seJson);}
  else{SP(${noteConv},${sp[1]},${sp[2]},${sp[3]},1,${sp[5]});}
  var setWriteMidi=M.cwrap('bp3_set_write_midi','void',['number']);
  if(${useTextMode ? 'true' : 'false'})setWriteMidi(0);
  var prov=M.cwrap('bp3_provision_file','number',['string','string']);
  var loadProto=M.cwrap('bp3_load_object_prototypes','number',['string']);
  var al=fs.readFileSync(TMP+'_al.txt','utf-8');if(al.trim())loadAl(al);
  var miFiles=fs.readdirSync('/tmp').filter(function(f){return f.startsWith('_s2_${name}_mi_');});
  miFiles.forEach(function(f){var name='-mi.'+f.replace('_s2_${name}_mi_','').replace('.txt','');prov(name,fs.readFileSync('/tmp/'+f,'utf-8'));});
  var so=fs.readFileSync(TMP+'_so.txt','utf-8');if(so.trim())loadProto(so);
  var to=fs.readFileSync(TMP+'_to.txt','utf-8');if(to.trim())loadTo(to);
  loadGr(fs.readFileSync(TMP+'_gr.txt','utf-8'));
  setSeed(1);
  var r=produce();
  // Text tokens (for text mode S2)
  var textTokens=[];
  if(${useTextMode ? 'true' : 'false'}){
    var txt=getResult();
    var lines=txt.split('\\n').filter(function(l){return l.trim();});
    for(var i=0;i<lines.length;i++){
      var names=lines[i].trim().split(/\\s+/).filter(function(t){return t;});
      for(var j=0;j<names.length;j++){var n=names[j].replace(/^'(.*)'$/,'$1');textTokens.push([n]);}
    }
  }
  // Timed tokens (for S3)
  var timedRaw=JSON.parse(getTT());
  var timed=timedRaw.map(function(t){return[t.token,t.start,t.end];});
  // MIDI events (for midi mode S2)
  var midiRaw=JSON.parse(getMidi());
  var pending={};
  var midi=[];
  for(var m=0;m<midiRaw.length;m++){
    var ev=midiRaw[m];
    var key=ev.note+'_'+(ev.channel||0);
    if(ev.type===144&&ev.velocity>0){
      if(!pending[key])pending[key]=[];
      pending[key].push(ev.time);
    }else if(ev.type===128||(ev.type===144&&ev.velocity===0)){
      if(pending[key]&&pending[key].length>0){
        midi.push([ev.note,pending[key].shift(),ev.time]);
      }
    }
  }
  midi.sort(function(a,b){return a[1]-b[1]||a[0]-b[0];});
  require('fs').writeFileSync(TMP+'_result.json',JSON.stringify({r:r,textTokens:textTokens,timed:timed,midi:midi}));
  process.stdout.write('OK\\n');
  process.exit(0);
}).catch(function(e){require('fs').writeFileSync(TMP+'_result.json',JSON.stringify({error:e.message.substring(0,80)}));process.stdout.write('OK\\n');process.exit(0);});
setTimeout(function(){require('fs').writeFileSync(TMP+'_result.json',JSON.stringify({error:'TIMEOUT'}));process.stdout.write('OK\\n');process.exit(0);},55000);
`;

fs.writeFileSync(`${TMP}_wasm.cjs`, wasmScript);
try {
  execSync(`node ${TMP}_wasm.cjs`, { timeout: 60000, encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] });
  const resultJson = fs.readFileSync(`${TMP}_result.json`, 'utf-8');
  const result = JSON.parse(resultJson);
  if (result.error) { console.error(`S2 FAIL: ${result.error}`); process.exit(1); }

  const snapDir = path.join(__dirname, 'grammars', name, 'snapshots');
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
  const today = new Date().toISOString().substring(0, 10);

  // S2: MIDI events (midi mode) or text tokens (text mode) — same format as S1
  const s2tokens = s1Mode === 'midi'
    ? (result.midi || []).map(m => {
        // Convert MIDI number to note name (same as S1 format)
        const NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
        const oct = Math.floor(m[0] / 12) - 1;
        return [NAMES[m[0] % 12] + oct, m[1], m[2]];
      })
    : result.textTokens;
  const s2snap = { source: `-gr.${grName}`, stage: 'S2', mode: s1Mode, settings: sp, tokens: s2tokens, date: today };
  fs.writeFileSync(path.join(snapDir, 's2_orig.json'), JSON.stringify(s2snap, null, 2));

  // S3: raw timed tokens
  const s3snap = { source: `-gr.${grName}`, stage: 'S3', mode: 'timed', settings: sp, tokens: result.timed, date: today };
  fs.writeFileSync(path.join(snapDir, 's3_timed.json'), JSON.stringify(s3snap, null, 2));

  const unit = s1Mode === 'midi' ? 'notes' : 'tokens';
  console.log(`S2 OK: ${s2tokens.length} ${unit} (mode=${s1Mode}) → ${name}/snapshots/s2_orig.json`);
  console.log(`S3 OK: ${result.timed.length} timed tokens → ${name}/snapshots/s3_timed.json`);
} catch (e) {
  console.error(`S2 FAIL: ${(e.stderr || e.message || '').substring(0, 80)}`);
  process.exit(1);
}
