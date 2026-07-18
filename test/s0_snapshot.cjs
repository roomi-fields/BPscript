#!/usr/bin/env node
/**
 * S0: Reference snapshots — oracle MSVC.
 *
 * MIGRATION PC2 NATIF (2026-06-14) : bp.exe Windows (ex /mnt/c/MAMP) n'existe plus.
 * Le port RNG MSVC (bp3_random.c, LCG 214013/2531011, RAND_MAX 32767) fait que le
 * binaire bp3 NATIF reproduit la séquence aléatoire de bp.exe. L'oracle S0 est donc
 * désormais produit par bp3 natif avec la configuration php_ref (settings/alphabet/
 * tonality + convention de note explicites), lue depuis bp3-engine/test-data.
 *
 * S0 diffère de S1 par la résolution de config : S0 suit php_ref (grammars.json,
 * convention de note forcée) ; S1 auto-détecte. Même moteur (bp3 natif), même
 * nettoyage de grammaire, même format de sortie (s0_php.json).
 *
 * ⚠️ NE PAS re-capturer tant que les bugs moteur #48-#52 ne sont pas résolus.
 *    Utiliser --dry pour vérifier sans écraser les snapshots de référence.
 *
 * For MIDI grammars: run bp3 → parse MIDI → save tokens + midi arrays
 * For text grammars: run bp3 → parse production text → save tokens
 *
 * Usage: node s0_snapshot.cjs drum --bin last           (one grammar)
 *        node s0_snapshot.cjs --all --bin last           (all S0 grammars)
 *        node s0_snapshot.cjs drum --bin last --dry      (no write, print summary)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { requireBinTag, resolveBin: _resolveBin, stripBinArgs } = require('./resolve_bin.cjs');
const binTag = requireBinTag();
const BP3 = _resolveBin(binTag, 'bp3');           // binaire natif (était bp.exe)
const GUARD = path.join(__dirname, 'bp3-guard.sh'); // enveloppe anti-OOM, cf [231]
const ROOT = path.resolve(__dirname, '..');
const BP3_DIR = path.resolve(ROOT, '..', 'bp3-engine');
const TD = path.resolve(BP3_DIR, 'test-data');    // sources canoniques (était /mnt/c/MAMP/.../ctests)
const PARSE_MIDI = path.join(__dirname, 'parse_midi.py');
const GRAMMARS = require('./grammars/grammars.json');

// Diagnostic line filter for text-mode production (same family as S1)
const DIAG_RE = /^•|^\u{1F449}|items? (have|has) been produced|^Total computation|^Interpreting|^Expanding|^Formula|^Phase|^Creating|^Setting time|^No graphic|^MIDI file|^Writing \d|^Fading|^Closing|^Buffer|^Applying|^Correction|^Jflag\b|^Subgrammar|^Production time|has channel \d|^Error code|^=> |^Should be|^Using quantization|^Csound tables|^Could not derive/u;

// Old BP2 positional settings → JSON (identique à s1_native.cjs)
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
  // GARDE DE PLAUSIBILITÉ (BPS-24). La carte positionnelle ci-dessous suppose UN layout,
  // or le corpus BP2 en contient PLUSIEURS (fichiers de 112 à ~362 lignes). Sur un layout
  // non prévu, les positions fixes tombent à côté et rapportent des valeurs absurdes :
  // -se.Alarm (112 lignes) rend '10' aux positions 62/63/65/67, d'où A4freq = 10 Hz et
  // C4key = 10, là où le même emplacement dans un fichier de 357 lignes vaut 440 et 60.
  // Conséquence vécue : un MaxConsoleTime à 1 seconde COUPE la production (koto1 est
  // tombée à 7 tokens au lieu de 72). 34 des 84 fichiers étaient touchés.
  // On n'émet donc un champ QUE si sa valeur est physiquement plausible ; sinon on
  // l'omet et le défaut moteur s'applique (cf docs/reference/settings_names.tab).
  // Bornes fournies par bp3-engine + bornes MIDI (0-127) qui sont des faits du protocole.
  const PLAUSIBLE = {
    A4freq:              (n) => n >= 200 && n <= 900,
    C4key:               (n) => n >= 36 && n <= 84,
    SamplingRate:        (n) => n > 20,
    MaxConsoleTime:      (n) => n > 10,
    VolumeController:    (n) => n === 7 || n === 11,
    PanoramicController: (n) => n === 10,
    DeftVelocity:        (n) => n >= 1 && n <= 127,
    DeftVolume:          (n) => n >= 1 && n <= 127,
    DeftPanoramic:       (n) => n >= 0 && n <= 127,
    DefaultBlockKey:     (n) => n >= 0 && n <= 127,
  };
  const rejected = [];
  const set = (k, nm, pos, bool, unit) => {
    const val = v(pos); if (val === null) return;
    const check = PLAUSIBLE[k];
    if (check && !check(parseFloat(val))) { rejected.push(`${k}=${val}`); return; }
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
  if (rejected.length && process.env.BP_SETTINGS_AUDIT) {
    console.error(`  [plausibilité] champs écartés : ${rejected.join(', ')}`);
  }
  return o.NoteConvention ? JSON.stringify(o) : null;
}

// Load + patch settings (JSON or old BP2), disable traces/graphics. noteConv: '0'|'1'|'2'.
function loadSettings(seFile, noteConv, tmpSettings) {
  if (!fs.existsSync(seFile)) return null;
  const seContent = fs.readFileSync(seFile, 'utf-8').trim();
  let seObj = null;
  if (seContent.startsWith('{')) {
    try { seObj = JSON.parse(seContent); } catch (e) {}
  } else {
    const converted = convertOldSettings(seContent);
    if (converted) {
      seObj = JSON.parse(converted);
      seObj.NoteConvention = { name: "Note convention", value: noteConv, boolean: '0' };
    }
  }
  if (!seObj) return null;
  seObj.ShowGraphic = { name: "Show graphic", value: "0" };
  seObj.ShowPianoRoll = { name: "Show piano roll", value: "0" };
  seObj.ShowObjectGraph = { name: "Show object graph", value: "0" };
  if (seObj.GraphicScaleP) seObj.GraphicScaleP.value = '0';
  if (seObj.GraphicScaleQ) seObj.GraphicScaleQ.value = '0';
  if (seObj.DisplayItems) seObj.DisplayItems.value = '1';
  // MaxItemsProduce conservé tel quel (doit matcher l'oracle historique).
  seObj.TraceProduce = { name: "Trace production", value: "0", boolean: "1" };
  fs.writeFileSync(tmpSettings, JSON.stringify(seObj));
  return tmpSettings;
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

// Convention de note php_ref → valeur NoteConvention + flag CLI
function noteConvOf(ref) {
  switch ((ref.note_convention || 'english').toLowerCase()) {
    case 'indian': return { value: '2', flag: '--indian' };
    case 'french': return { value: '1', flag: '--french' };
    default:       return { value: '0', flag: null };       // english
  }
}

function processGrammar(name) {
  const gramDef = GRAMMARS[name];
  if (!gramDef || gramDef.status === 'excluded') return null;
  if (!gramDef.php_ref) return null;          // pas une grammaire S0
  if (gramDef.php_ref.blocked) return null;   // incompatible oracle

  const grName = gramDef.bernard || name;
  const s1Mode = gramDef.production_mode || 'midi';
  const ref = gramDef.php_ref;
  const nc = noteConvOf(ref);

  const grFile = path.join(TD, `-gr.${grName}`);
  if (!fs.existsSync(grFile)) { console.error(`S0 SKIP: grammaire absente ${grFile}`); return null; }

  // Nettoyage grammaire (identique à S1) : LF, en-têtes, encodage Mac
  let gr = fs.readFileSync(grFile, 'utf-8').replace(/\r\n?/g, '\n');
  const grLines = gr.split('\n');
  let startIdx = 0;
  for (let i = 0; i < grLines.length; i++) {
    const l = grLines[i].trim();
    if (l.startsWith('//') || l.match(/^-[a-z]{2}\./) || l.match(/^(ORD|RND|SUB|LIN|TEM|GRAM)/i)) { startIdx = i; break; }
  }
  if (startIdx > 0) gr = grLines.slice(startIdx).join('\n');
  gr = gr.split('\n').filter(l => !l.trim().startsWith('INIT:')).join('\n');
  const grClean = gr.replace(/¥/g, '.').replace(/ž/g, 'u');

  const tmpGrammar = path.join('/tmp', `_s0_${name}_grammar.txt`);
  const tmpMidi = path.join('/tmp', `_s0_${name}_output.mid`);
  const tmpText = path.join('/tmp', `_s0_${name}_text.txt`);
  const tmpSettings = path.join('/tmp', `_s0_${name}_se.json`);
  fs.writeFileSync(tmpGrammar, grClean);

  const args = ['produce', '-e', '-gr', tmpGrammar, '--seed', '1'];
  if (nc.flag) args.push(nc.flag);
  if (ref.settings) {
    const se = loadSettings(path.join(TD, ref.settings), nc.value, tmpSettings);
    if (se) args.push('-se', se);
  }
  if (ref.alphabet)  args.push('-al', path.join(TD, ref.alphabet));
  if (ref.tonality)  args.push('-to', path.join(TD, ref.tonality));
  if (ref.csound)    args.push('-cs', path.join(TD, ref.csound));
  // Prototypes d'objets sonores. Une grammaire dont l'alphabet ne porte que des NOMS
  // d'objets (ek, do, tin…) ne produit AUCUNE note sans son -so : le fichier définit
  // leur réalisation. Constaté sur 12345678 (0 note sans -so, 2034 octets de MIDI avec).
  if (ref.soundobjects) args.push('-so', path.join(TD, ref.soundobjects));

  const cleanup = () => {
    for (const f of [tmpGrammar, tmpMidi, tmpText, tmpSettings]) { try { fs.unlinkSync(f); } catch (e) {} }
  };

  if (s1Mode === 'midi') {
    args.push('--midiout', tmpMidi);
    try { fs.unlinkSync(tmpMidi); } catch (e) {}
    try {
      execSync(`bash "${GUARD}" "${BP3}" ${args.map(a => `"${a}"`).join(' ')}`, {
        cwd: BP3_DIR, timeout: 120000, stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (e) {}

    let tokens = [], midiNotes = [];
    if (fs.existsSync(tmpMidi) && fs.statSync(tmpMidi).size > 50) {
      try {
        const out = execSync(`python3 "${PARSE_MIDI}" "${tmpMidi}"`, { encoding: 'utf-8', timeout: 10000 }).trim();
        const parsed = JSON.parse(out);
        tokens = parsed.tokens || [];
        midiNotes = parsed.midi || [];
      } catch (e) {}
    }
    cleanup();
    if (tokens.length === 0) { console.error(`S0 FAIL (midi): 0 notes for ${name}`); return null; }
    return { source: `-gr.${grName}`, stage: 'S0', mode: 'midi', tokens, midi: midiNotes,
      date: new Date().toISOString().substring(0, 10) };

  } else {
    args.push('-D');
    let rawOutput = '';
    try {
      const fd = fs.openSync(tmpText, 'w');
      execSync(`bash "${GUARD}" "${BP3}" ${args.map(a => `"${a}"`).join(' ')}`, {
        cwd: BP3_DIR, timeout: 120000, stdio: ['pipe', fd, 'pipe']
      });
      fs.closeSync(fd);
      rawOutput = fs.readFileSync(tmpText, 'utf-8');
    } catch (e) {
      if (fs.existsSync(tmpText)) rawOutput = fs.readFileSync(tmpText, 'utf-8');
    }
    cleanup();
    const tokens = parseTextOutput(rawOutput);
    if (!tokens || tokens.length === 0) { console.error(`S0 FAIL (text): no production for ${name}`); return null; }
    return { source: `-gr.${grName}`, stage: 'S0', mode: 'text', tokens,
      date: new Date().toISOString().substring(0, 10) };
  }
}

// Main
const s0args = stripBinArgs(process.argv.slice(2));
const DRY = s0args.includes('--dry');
const arg = s0args.filter(a => a !== '--dry')[0];
if (!arg) { console.error('Usage: node s0_snapshot.cjs <grammar|--all> --bin <version> [--dry]'); process.exit(1); }

if (!fs.existsSync(BP3)) { console.error(`Binaire bp3 natif introuvable: ${BP3}`); process.exit(1); }

const names = arg === '--all'
  ? Object.entries(GRAMMARS).filter(([k, v]) => v.status === 'active' && v.php_ref).map(([k]) => k)
  : [arg];

let ok = 0, fail = 0;
for (const name of names) {
  const snap = processGrammar(name);
  if (snap) {
    const count = snap.mode === 'midi' ? snap.tokens.length + ' notes' : snap.tokens.length + ' tokens';
    if (DRY) {
      const refPath = path.join(__dirname, 'grammars', name, 'snapshots', 's0_php.json');
      let cmp = '(pas de référence)';
      if (fs.existsSync(refPath)) {
        const refN = (JSON.parse(fs.readFileSync(refPath, 'utf8')).tokens || []).length;
        cmp = refN === snap.tokens.length ? `MATCH référence (${refN})` : `DIFF référence: ${refN} attendu, ${snap.tokens.length} obtenu`;
      }
      console.log(`S0 [dry] ${name}: ${count} — ${cmp}`);
    } else {
      const snapDir = path.join(__dirname, 'grammars', name, 'snapshots');
      if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
      fs.writeFileSync(path.join(snapDir, 's0_php.json'), JSON.stringify(snap, null, 2));
      console.log(`S0 OK: ${count} → ${name}/snapshots/s0_php.json`);
    }
    ok++;
  } else {
    fail++;
  }
}

if (names.length > 1) {
  console.log(`\nS0 Snapshots${DRY ? ' [dry]' : ''}: ${ok} OK, ${fail} FAIL (total ${ok + fail})`);
}
