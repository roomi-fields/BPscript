#!/usr/bin/env node
/**
 * S1: Run original Bernard grammar on native BP3 C engine.
 *
 * Mode is read from status.json field "production_mode":
 *   - "midi"  → run with --midiout, extract NoteOn events with timestamps
 *   - "text"  → run with -D, capture terminal symbols after "Producing item(s)..."
 *
 * If production_mode is not set, defaults to "midi" (most grammars produce MIDI).
 *
 * Usage: node s1_native.cjs drum
 * Output: test/grammars/drum/snapshots/s1_native.json
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { requireBinTag, resolveBin: _resolveBin, stripBinArgs } = require('./resolve_bin.cjs');

const args = stripBinArgs(process.argv.slice(2));
const name = args[0];
if (!name) { console.error('Usage: node s1_native.cjs <grammar> --bin <version>'); process.exit(1); }
const binTag = requireBinTag();

// Convert old BP2 positional settings to JSON.
function convertOldSettings(c) {
  const lines = c.split(/\r\n?|\n/);
  let hdr = 0;
  while (hdr < lines.length && lines[hdr].trim().startsWith('//')) hdr++;
  const vals = lines.slice(hdr);
  if (vals.length < 48) return null;
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
  set('Quantization','Quantization',2,false,'ms');
  set('Time_res','Time resolution',3,false,'ms');
  set('MIDIsyncDelay','Sync delay',4,false,'ms');
  set('Quantize','Quantize',5,true);
  set('Nature_of_time','Striated time',6,true);
  set('Pclock','Pclock',7,false);
  set('Qclock','Qclock',8,false);
  set('Improvize','Non-stop improvize',10,true);
  set('MaxItemsProduce','Max items produced',11,false);
  set('UseEachSub','Play each substitution',12,true);
  set('AllItems','Produce all items',13,true);
  set('DisplayProduce','Display production',14,true);
  set('DisplayItems','Display final score',19,true);
  set('ShowGraphic','Show graphics',20,true);
  set('AllowRandomize','Allow randomize',21,true);
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
  set('NoteConvention','Note convention',47,false);
  if (vals.length > 51) {
    set('GraphicScaleP','Graphic scale P',50,false);
    set('GraphicScaleQ','Graphic scale Q',51,false);
  }
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
const BP3 = _resolveBin(binTag, 'bp3');

const GRAMMARS = require('./grammars/grammars.json');
const gramDef = GRAMMARS[name];
if (!gramDef) { console.error(`Unknown grammar: ${name}. Not in grammars.json`); process.exit(1); }
if (gramDef.status === 'excluded') { console.error(`SKIP: ${name} is excluded — ${gramDef.reason}`); process.exit(1); }
const grName = gramDef.bernard || name;

const grFile = path.join(TD, `-gr.${grName}`);
if (!fs.existsSync(grFile)) { console.error(`Not found: ${grFile}`); process.exit(1); }
if (!fs.existsSync(BP3)) { console.error(`Native BP3 not built: ${BP3}`); process.exit(1); }

// Read production_mode from grammars.json (default: "midi")
const s1Mode = gramDef.production_mode || 'midi';

// Read grammar, strip old headers and fix old Mac encoding
let gr = fs.readFileSync(grFile, 'utf-8').replace(/\r\n?/g, '\n');
const grLines = gr.split('\n');
let startIdx = 0;
for (let i = 0; i < grLines.length; i++) {
  const l = grLines[i].trim();
  if (l.startsWith('//') || l.match(/^-[a-z]{2}\./) || l.match(/^(ORD|RND|SUB|LIN|TEM|GRAM)/i)) {
    startIdx = i; break;
  }
}
if (startIdx > 0) gr = grLines.slice(startIdx).join('\n');
gr = gr.split('\n').filter(l => !l.trim().startsWith('INIT:')).join('\n');
const grClean = gr.replace(/\u00A5/g, '.').replace(/\u017E/g, 'u');

// Per-grammar temp files to avoid contamination between runs
const tmpGrammar = path.join('/tmp', `_s1_${name}_grammar.txt`);
const tmpMidi = path.join('/tmp', `_s1_${name}_output.mid`);
const tmpText = path.join('/tmp', `_s1_${name}_text.txt`);
const tmpSettings = path.join('/tmp', `_s1_${name}_se.json`);
fs.writeFileSync(tmpGrammar, grClean);

// Build base args (common to both modes)
const baseArgs = ['produce', '-e', '-gr', tmpGrammar, '--seed', '1'];

// NoteConvention: auto-detect from grammar content
const grNoComments = grClean.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
const hasFrench = /\b(do|re|mi|fa|sol|la|si)\d\b/.test(grNoComments);
const hasIndian = /\b(sa|ga)\d\b/.test(grNoComments);
if (hasIndian) baseArgs.push('--indian');
else if (hasFrench) baseArgs.push('--french');

// Helper: load and convert settings file (JSON or old BP2 format), apply test overrides
function loadSettings(seFile) {
  if (!fs.existsSync(seFile)) return null;
  const seContent = fs.readFileSync(seFile, 'utf-8').trim();
  let seObj = null;
  if (seContent.startsWith('{')) {
    try { seObj = JSON.parse(seContent); } catch(e) {}
  } else {
    const converted = convertOldSettings(seContent);
    if (converted) {
      seObj = JSON.parse(converted);
      const nc = hasIndian ? '2' : hasFrench ? '1' : '0';
      seObj.NoteConvention = {name: "Note convention", value: nc, boolean: '0'};
    }
  }
  if (seObj) {
    seObj.ShowGraphic = {name: "Show graphic", value: "0"};
    seObj.ShowPianoRoll = {name: "Show piano roll", value: "0"};
    seObj.ShowObjectGraph = {name: "Show object graph", value: "0"};
    if (seObj.GraphicScaleP) seObj.GraphicScaleP.value = '0';
    if (seObj.GraphicScaleQ) seObj.GraphicScaleQ.value = '0';
    if (seObj.DisplayItems) seObj.DisplayItems.value = '1';
    // Keep original MaxItemsProduce from settings (don't override — must match S0/PHP)
    seObj.TraceProduce = {name: "Trace production", value: "0", boolean: "1"};
    fs.writeFileSync(tmpSettings, JSON.stringify(seObj));
    return tmpSettings;
  }
  return null;
}

// Load auxiliary files: s1_args (explicit overrides) + auto-detect missing from grammar header
// s1_args provides explicit overrides; auto-detect fills in anything not already specified.
const explicitFlags = new Set(); // track which flag types (-se, -al, -to, etc.) s1_args already set

if (gramDef.s1_args && gramDef.s1_args.length > 0) {
  for (let i = 0; i < gramDef.s1_args.length; i++) {
    const arg = gramDef.s1_args[i];
    if (arg.startsWith('-') && !arg.startsWith('--')) {
      explicitFlags.add(arg); // e.g. "-se", "-al", "-to"
      if (i + 1 < gramDef.s1_args.length) {
        const file = gramDef.s1_args[i + 1];
        const resolved = file.startsWith('/') ? file : path.join(TD, file);
        i++;
        if (arg === '-se') {
          const converted = loadSettings(resolved);
          if (converted) { baseArgs.push('-se', converted); }
        } else {
          baseArgs.push(arg, resolved);
        }
      } else {
        baseArgs.push(arg);
      }
    } else if (arg.startsWith('--')) {
      baseArgs.push(arg);
    } else {
      baseArgs.push(arg);
    }
  }
}

// Auto-detect from grammar header for any flag types NOT already set by s1_args
if (!explicitFlags.has('-se')) {
  const seMatch = gr.match(/-se\.(\S+)/);
  if (seMatch) {
    const seFile = path.join(TD, `-se.${seMatch[1]}`);
    const converted = loadSettings(seFile);
    if (converted) baseArgs.push('-se', converted);
  }
}
if (!explicitFlags.has('-al')) {
  const alMatch = gr.match(/-al\.(\S+)/);
  if (alMatch) {
    const f = path.join(TD, `-al.${alMatch[1]}`);
    if (fs.existsSync(f)) baseArgs.push('-al', f);
  }
  if (!alMatch) {
    const hoMatch = gr.match(/-ho\.(\S+)/);
    if (hoMatch) {
      const alF = path.join(TD, `-al.${hoMatch[1]}`);
      const hoF = path.join(TD, `-ho.${hoMatch[1]}`);
      if (fs.existsSync(alF)) baseArgs.push('-al', alF);
      else if (fs.existsSync(hoF)) baseArgs.push('-al', hoF);
    }
  }
}
if (!explicitFlags.has('-to')) {
  const toMatch = gr.match(/-to\.(\S+)/);
  if (toMatch) {
    const f = path.join(TD, `-to.${toMatch[1]}`);
    if (fs.existsSync(f)) baseArgs.push('-to', f);
  }
}
// NOTE: -cs (Csound instruments) intentionally NOT auto-loaded.
// Csound files can cause bp3 to hang waiting for audio output.
// Only load -cs if explicitly specified in s1_args.
if (!explicitFlags.has('-gl')) {
  const glMatch = gr.match(/-gl\.(\S+)/);
  if (glMatch) {
    const f = path.join(TD, `-gl.${glMatch[1]}`);
    if (fs.existsSync(f)) baseArgs.push('-gl', f);
  }
}

// ============================================================
// MODE: MIDI
// ============================================================
if (s1Mode === 'midi') {
  const midiArgs = [...baseArgs, '--midiout', tmpMidi];

  // Clean up previous midi file
  try { fs.unlinkSync(tmpMidi); } catch(e) {}

  // Run native BP3 — stdout to /dev/null, capture stderr for errors
  let stderrOutput = '';
  try {
    execSync(`"${BP3}" ${midiArgs.join(' ')}`, {
      cwd: BP3_DIR, timeout: 120000, stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (e) {
    stderrOutput = e.stderr ? e.stderr.toString() : (e.message || '');
    if (process.env.S1_DEBUG) console.error('BP3 error:', stderrOutput.substring(0, 300));
  }

  if (process.env.S1_DEBUG) {
    console.error('MIDI path:', tmpMidi, 'exists:', fs.existsSync(tmpMidi),
      'size:', fs.existsSync(tmpMidi) ? fs.statSync(tmpMidi).size : 0);
  }

  // Parse MIDI file
  let tokens = [];
  let midiNotes = [];
  if (fs.existsSync(tmpMidi) && fs.statSync(tmpMidi).size > 100) {
    try {
      const out = execSync(`python3 ${path.join(__dirname, 'parse_midi.py')} "${tmpMidi}"`, {
        encoding: 'utf-8', timeout: 10000
      }).trim();
      const parsed = JSON.parse(out);
      tokens = parsed.tokens || [];
      midiNotes = parsed.midi || [];
    } catch (e) {}
  }

  // Clean up
  try { fs.unlinkSync(tmpMidi); } catch(e) {}
  try { fs.unlinkSync(tmpGrammar); } catch(e) {}
  try { fs.unlinkSync(tmpSettings); } catch(e) {}

  if (tokens.length === 0) {
    // No MIDI produced — report error
    const snapDir = path.join(__dirname, 'grammars', name, 'snapshots');
    if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
    const snap = {
      source: `-gr.${grName}`, stage: 'S1', mode: 'midi',
      tokens: [], midi: [],
      error: stderrOutput.substring(0, 500) || 'No MIDI output produced',
      date: new Date().toISOString().substring(0, 10)
    };
    fs.writeFileSync(path.join(snapDir, 's1_native.json'), JSON.stringify(snap, null, 2));
    console.error(`S1 FAIL (midi): 0 notes for ${name}. ${snap.error.substring(0, 100)}`);
    process.exit(1);
  }

  // Write snapshot
  const snapDir = path.join(__dirname, 'grammars', name, 'snapshots');
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
  const snap = {
    source: `-gr.${grName}`, stage: 'S1', mode: 'midi',
    tokens, midi: midiNotes,
    date: new Date().toISOString().substring(0, 10)
  };
  fs.writeFileSync(path.join(snapDir, 's1_native.json'), JSON.stringify(snap, null, 2));
  console.log(`S1 OK: ${tokens.length} notes → ${name}/snapshots/s1_native.json`);
}

// ============================================================
// MODE: TEXT
// ============================================================
else if (s1Mode === 'text') {
  const textArgs = [...baseArgs, '-D'];

  // Run native BP3 — capture stdout to file
  let rawOutput = '';
  try {
    const fd = fs.openSync(tmpText, 'w');
    execSync(`"${BP3}" ${textArgs.join(' ')}`, {
      cwd: BP3_DIR, timeout: 120000, stdio: ['pipe', fd, 'pipe']
    });
    fs.closeSync(fd);
    rawOutput = fs.readFileSync(tmpText, 'utf-8');
  } catch (e) {
    // Engine may write partial output before crashing
    if (fs.existsSync(tmpText)) rawOutput = fs.readFileSync(tmpText, 'utf-8');
  }

  // Clean up temp files
  try { fs.unlinkSync(tmpText); } catch(e) {}
  try { fs.unlinkSync(tmpGrammar); } catch(e) {}
  try { fs.unlinkSync(tmpSettings); } catch(e) {}

  const allLines = rawOutput.split('\n');

  // Find "Producing item(s)..." or "Producing all possible items..." marker
  let prodIdx = -1;
  for (let i = 0; i < allLines.length; i++) {
    if (/Producing (item|all)/i.test(allLines[i])) { prodIdx = i; break; }
  }

  if (prodIdx === -1) {
    // No "Producing" marker → compilation failed. Save error output.
    const snapDir = path.join(__dirname, 'grammars', name, 'snapshots');
    if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
    const snap = {
      source: `-gr.${grName}`, stage: 'S1', mode: 'text',
      tokens: [], error: rawOutput.substring(0, 2000),
      date: new Date().toISOString().substring(0, 10)
    };
    fs.writeFileSync(path.join(snapDir, 's1_native.json'), JSON.stringify(snap, null, 2));
    console.error(`S1 FAIL (text): no "Producing" marker for ${name}. Compilation error saved.`);
    process.exit(1);
  }

  // Everything after "Producing item(s)..." = terminal output
  // Each non-empty line is one production item, tokens separated by spaces
  const tokens = [];
  for (let i = prodIdx + 1; i < allLines.length; i++) {
    const line = allLines[i].trim();
    if (!line) continue;
    // Skip engine diagnostic messages that appear after production
    if (/^\u2022|^\u{1F449}|items? (have|has) been produced|^Total computation time|^Interpreting structure|^Expanding polymetric|^Formula is complex|^Phase diagram|^Creating phase|^Setting time|^No graphic|^MIDI file|^Writing \d|^Fading out|^Closing MIDI|^Buffer limit|^Applying serial|^Correction of|^Jflag\b|^Subgrammar \d|^Production time|has channel \d|^Error code|^=> |^Should be|^Could not derive/u.test(line)) continue;
    // Split line into tokens, with post-processing cleanup
    const names = line.split(/\s+/).filter(t => t);
    for (let n of names) {
      // Strip surrounding single quotes from text terminals ('1' → 1)
      n = n.replace(/^'(.*)'$/, '$1');
      tokens.push([n]);
    }
  }

  // Write snapshot
  const snapDir = path.join(__dirname, 'grammars', name, 'snapshots');
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
  const snap = {
    source: `-gr.${grName}`, stage: 'S1', mode: 'text',
    tokens,
    date: new Date().toISOString().substring(0, 10)
  };
  fs.writeFileSync(path.join(snapDir, 's1_native.json'), JSON.stringify(snap, null, 2));
  console.log(`S1 OK: ${tokens.length} tokens (text) → ${name}/snapshots/s1_native.json`);
}

else {
  console.error(`S1 FAIL: unknown production_mode "${s1Mode}" in status.json for ${name}`);
  process.exit(1);
}
