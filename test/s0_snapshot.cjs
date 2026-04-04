#!/usr/bin/env node
/**
 * S0: Generate reference snapshots from bp.exe (PHP motor).
 * Same format as S1 snapshots for content-level comparison.
 *
 * For MIDI grammars: run bp.exe → parse MIDI → save tokens + midi arrays
 * For text grammars: run bp.exe → parse production text → save tokens
 *
 * Usage: node s0_snapshot.cjs drum        (one grammar)
 *        node s0_snapshot.cjs --all       (all S0 grammars)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { requireBinTag, resolveBin: _resolveBin, stripBinArgs } = require('./resolve_bin.cjs');
const binTag = requireBinTag();
const BP_EXE = _resolveBin(binTag, 'bp.exe');
const BP_EXE_DIR = '/mnt/c/MAMP/htdocs/bolprocessor';
const CTESTS = 'ctests';
const MIDI_DIR = '/mnt/c/tmp/php_ref';
const MIDI_DIR_WIN = 'C:\\tmp\\php_ref';
const PARSE_MIDI = path.join(__dirname, 'parse_midi.py');
const GRAMMARS = require('./grammars/grammars.json');

if (!fs.existsSync(MIDI_DIR)) fs.mkdirSync(MIDI_DIR, { recursive: true });

// Control token filter (same as S1)
const CONTROL_RE = /^_(vel|volume|script|pitchrange|transpose|pitchcont|pitchbend|chan|modulation|pressure|panoramic|ins|mm|striated|smooth|staccato|legato|baseoctave|rndvel|rndchan|randomize|velcont|volumecont|cont|value|fixed|tempo|legato)(\(|$)/;
const DIAG_RE = /^\u2022|^\u{1F449}|items? (have|has) been produced|^Total computation|^Interpreting|^Expanding|^Formula|^Phase|^Creating|^Setting time|^No graphic|^MIDI file|^Writing \d|^Fading|^Closing|^Buffer|^Applying|^Correction|^Jflag\b|^Subgrammar|^Production time|has channel \d|^Error code|^=> |^Should be|^Using quantization|^Csound tables|^Could not derive/u;

// Modify settings JSON to disable traces (same as S1)
function patchSettings(seFile) {
  const ctestsPath = path.join(BP_EXE_DIR, seFile);
  if (!fs.existsSync(ctestsPath)) return null;
  try {
    const se = JSON.parse(fs.readFileSync(ctestsPath, 'utf-8'));
    se.TraceProduce = { name: "Trace production", value: "0", boolean: "1" };
    se.ShowGraphic = { name: "Show graphic", value: "0" };
    se.ShowPianoRoll = { name: "Show piano roll", value: "0" };
    se.ShowObjectGraph = { name: "Show object graph", value: "0" };
    if (se.DisplayItems) se.DisplayItems.value = '1';
    const tmp = path.join('/mnt/c/tmp', `_s0_se_${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify(se));
    return tmp;
  } catch (e) {
    return null;
  }
}

function parseTextOutput(rawOutput) {
  const allLines = rawOutput.split('\n');
  let prodIdx = -1;
  for (let i = 0; i < allLines.length; i++) {
    if (/Producing (item|all)/i.test(allLines[i])) { prodIdx = i; break; }
  }
  if (prodIdx === -1) return null;

  const tokens = [];
  for (let i = prodIdx + 1; i < allLines.length; i++) {
    const line = allLines[i].trim();
    if (!line) continue;
    if (DIAG_RE.test(line)) continue;
    // Skip derivation trace lines (same filtering as S1 with TraceProduce=0)
    if (/^\[Step #/.test(line)) continue;
    if (/^Selected:/.test(line)) continue;
    const names = line.split(/\s+/).filter(t => t);
    for (let n of names) {
      n = n.replace(/^'(.*)'$/, '$1');
      tokens.push([n]);
    }
  }
  return tokens;
}

function processGrammar(name) {
  const gramDef = GRAMMARS[name];
  if (!gramDef || gramDef.status === 'excluded') return null;
  if (!gramDef.php_ref) return null; // Not an S0 grammar

  const grName = gramDef.bernard || name;
  const s1Mode = gramDef.production_mode || 'midi';
  const ref = gramDef.php_ref;

  // Build bp.exe command using PHP ref params
  // Patch settings to disable traces (same as S1)
  let tmpSettings = null;
  const args = ['produce', '-e'];
  if (ref.settings) {
    tmpSettings = patchSettings(`${CTESTS}/${ref.settings}`);
    if (tmpSettings) {
      // bp.exe needs Windows path for temp settings
      const winTmp = tmpSettings.replace('/mnt/c/', 'C:\\').replace(/\//g, '\\');
      args.push('-se', winTmp);
    } else {
      args.push('-se', `${CTESTS}/${ref.settings}`);
    }
  }
  args.push('-gr', `${CTESTS}/-gr.${grName}`);
  if (ref.alphabet) args.push('-al', `${CTESTS}/${ref.alphabet}`);
  if (ref.tonality) args.push('-to', `${CTESTS}/${ref.tonality}`);
  args.push('--seed', '1');

  if (s1Mode === 'midi') {
    const midiFile = path.join(MIDI_DIR, `${grName}.mid`);
    const midiFileWin = `${MIDI_DIR_WIN}\\${grName}.mid`;
    args.push('--midiout', midiFileWin, '-D');

    try { fs.unlinkSync(midiFile); } catch(e) {}

    try {
      execSync(`"${BP_EXE}" ${args.map(a => `"${a}"`).join(' ')}`, {
        cwd: BP_EXE_DIR, timeout: 120000, stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (e) {}

    let tokens = [], midiNotes = [];
    if (fs.existsSync(midiFile) && fs.statSync(midiFile).size > 100) {
      try {
        const out = execSync(`python3 "${PARSE_MIDI}" "${midiFile}"`, {
          encoding: 'utf-8', timeout: 10000
        }).trim();
        const parsed = JSON.parse(out);
        tokens = parsed.tokens || [];
        midiNotes = parsed.midi || [];
      } catch (e) {}
    }

    if (tmpSettings) try { fs.unlinkSync(tmpSettings); } catch(e) {}

    if (tokens.length === 0) {
      console.error(`S0 FAIL (midi): 0 notes for ${name}`);
      return null;
    }

    return {
      source: `-gr.${grName}`, stage: 'S0', mode: 'midi',
      tokens, midi: midiNotes,
      date: new Date().toISOString().substring(0, 10)
    };

  } else {
    args.push('-D');
    let rawOutput = '';
    try {
      rawOutput = execSync(`"${BP_EXE}" ${args.map(a => `"${a}"`).join(' ')}`, {
        cwd: BP_EXE_DIR, timeout: 120000, encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (e) {
      rawOutput = e.stdout || '';
    }

    if (tmpSettings) try { fs.unlinkSync(tmpSettings); } catch(e) {}

    const tokens = parseTextOutput(rawOutput);
    if (!tokens || tokens.length === 0) {
      console.error(`S0 FAIL (text): no production for ${name}`);
      return null;
    }

    return {
      source: `-gr.${grName}`, stage: 'S0', mode: 'text',
      tokens,
      date: new Date().toISOString().substring(0, 10)
    };
  }
}

// Main
const s0args = stripBinArgs(process.argv.slice(2));
const arg = s0args[0];
if (!arg) { console.error('Usage: node s0_snapshot.cjs <grammar|--all> --bin <version>'); process.exit(1); }

const names = arg === '--all'
  ? Object.entries(GRAMMARS).filter(([k,v]) => v.status === 'active' && v.php_ref).map(([k]) => k)
  : [arg];

let ok = 0, fail = 0;
for (const name of names) {
  const snap = processGrammar(name);
  if (snap) {
    const snapDir = path.join(__dirname, 'grammars', name, 'snapshots');
    if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
    fs.writeFileSync(path.join(snapDir, 's0_php.json'), JSON.stringify(snap, null, 2));
    const count = snap.mode === 'midi' ? snap.tokens.length + ' notes' : snap.tokens.length + ' tokens';
    console.log(`S0 OK: ${count} → ${name}/snapshots/s0_php.json`);
    ok++;
  } else {
    fail++;
  }
}

if (names.length > 1) {
  console.log(`\nS0 Snapshots: ${ok} OK, ${fail} FAIL (total ${ok + fail})`);
}
