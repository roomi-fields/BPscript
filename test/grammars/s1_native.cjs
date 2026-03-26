#!/usr/bin/env node
/**
 * S1: Run original Bernard grammar on native BP3 C engine.
 * Produces MIDI file, extracts NoteOn events with timestamps.
 *
 * Usage: node s1_native.cjs drum
 * Output: test/grammars/drum/snapshots/s1_native.json
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const name = process.argv[2];
if (!name) { console.error('Usage: node s1_native.cjs <grammar>'); process.exit(1); }

const ROOT = path.resolve(__dirname, '..', '..');
const TD = path.resolve(ROOT, '..', 'bp3-engine', 'test-data');
const BP3 = path.resolve(ROOT, '..', 'bp3-engine', 'bp3');
const BP3_DIR = path.resolve(ROOT, '..', 'bp3-engine');

const MAP = require('./map.json');
const grName = MAP[name] || name;  // map scene→Bernard, or use name directly as Bernard grammar

const grFile = path.join(TD, `-gr.${grName}`);
if (!fs.existsSync(grFile)) { console.error(`Not found: ${grFile}`); process.exit(1); }
if (!fs.existsSync(BP3)) { console.error(`Native BP3 not built: ${BP3}`); process.exit(1); }

// Read grammar, strip old headers (V.2.x, Date:...) and fix old Mac encoding
let gr = fs.readFileSync(grFile, 'utf-8');
// Strip pre-BP3 headers: lines before first // comment or -xx. reference
const lines = gr.split('\n');
let startIdx = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i].trim();
  if (l.startsWith('//') || l.match(/^-[a-z]{2}\./) || l.match(/^(ORD|RND|SUB|LIN|TEM|GRAM)/i)) {
    startIdx = i; break;
  }
}
if (startIdx > 0) gr = lines.slice(startIdx).join('\n');
// Strip INIT: lines (GUI commands not supported in console)
gr = gr.split('\n').filter(l => !l.trim().startsWith('INIT:')).join('\n');
const grClean = gr.replace(/\u00A5/g, '.').replace(/\u017E/g, 'u');
const grCleanFile = '/tmp/_s1_grammar.txt';
fs.writeFileSync(grCleanFile, grClean);
const args = ['produce', '-e', '--midiout', '/tmp/_s1_output.mid', '-gr', grCleanFile, '--seed', '1'];

// NoteConvention: auto-detect from grammar content (strip comments to avoid false positives)
const grNoComments = grClean.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
const hasFrench = /\b(do|re|mi|fa|sol|la|si)\d\b/.test(grNoComments);
const hasIndian = /\b(sa|ga)\d\b/.test(grNoComments);
if (hasIndian) args.push('--indian');
else if (hasFrench) args.push('--french');

// Settings not passed to native — LoadSettings() crashes on many files (old format AND some JSON).
// Grammars override key settings with _mm(), _striated, etc. Native defaults are sufficient.
const alMatch = gr.match(/-al\.(\S+)/);
if (alMatch) {
  const f = path.join(TD, `-al.${alMatch[1]}`);
  if (fs.existsSync(f)) args.push('-al', f);
}
const hoMatch = gr.match(/-ho\.(\S+)/);
if (hoMatch && !alMatch) {
  // Try -al. first, then -ho. (native accepts both via -al flag)
  const alF = path.join(TD, `-al.${hoMatch[1]}`);
  const hoF = path.join(TD, `-ho.${hoMatch[1]}`);
  if (fs.existsSync(alF)) args.push('-al', alF);
  else if (fs.existsSync(hoF)) args.push('-al', hoF);
}
const toMatch = gr.match(/-to\.(\S+)/);
if (toMatch) {
  const f = path.join(TD, `-to.${toMatch[1]}`);
  if (fs.existsSync(f)) args.push('-to', f);
}

// Clean old MIDI file
try { fs.unlinkSync('/tmp/_s1_output.mid'); } catch(e) {}

// Run native BP3
try {
  execSync(`"${BP3}" ${args.join(' ')}`, {
    cwd: BP3_DIR, timeout: 30000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
  });
} catch (e) {
  console.error(`S1 FAIL: ${(e.stderr || e.message || '').substring(0, 100)}`);
  process.exit(1);
}

// Extract MIDI tokens (with timestamps)
let midiTokens = [];
try {
  const out = execSync(`python3 ${path.join(__dirname, 'parse_midi.py')}`, {
    encoding: 'utf-8', timeout: 5000
  }).trim();
  midiTokens = JSON.parse(out);
} catch (e) {}

// Always extract text output too (for comparison and fallback)
let textTokens = [];
try {
  const textOut = execSync(`"${BP3}" ${args.filter(a => a !== '--midiout' && a !== '/tmp/_s1_output.mid').concat(['-D']).join(' ')}`, {
    cwd: BP3_DIR, timeout: 30000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
  });
  const lines = textOut.split('\n').filter(l =>
    l.trim() && !l.startsWith('Bol ') && !l.startsWith('Version') && !l.startsWith('Reading') &&
    !l.startsWith('BP3 ') && !l.startsWith('Created') && !l.startsWith('Compil') &&
    !l.startsWith('Metro') && !l.startsWith('Pars') && !l.startsWith('Error') &&
    !l.startsWith('Produc') && !l.startsWith('Inter') && !l.startsWith('Expand') &&
    !l.startsWith('Phase') && !l.startsWith('Corr') && !l.startsWith('Sett') &&
    !l.startsWith('Writ') && !l.startsWith('Fad') && !l.startsWith('Clos') &&
    !l.startsWith('Using') && !l.startsWith('=>') && !l.startsWith('Split') &&
    !l.startsWith('Random') && !l.startsWith('test') && !l.startsWith('(null') &&
    !l.startsWith('New ') && !l.startsWith('\u2022') && !l.startsWith('/tmp')
  );
  if (lines.length > 0) {
    const prodLine = lines[lines.length - 1].trim();
    const names = prodLine.split(/\s+/).filter(t => t && t !== '-' && t !== '_' && t !== '&');
    textTokens = names.map(n => [n]);
  }
} catch (e2) {}

// MIDI first. Text fallback only when MIDI gives 0 (non-MIDI grammars: tabla, structural tests)
const tokens = midiTokens.length > 0 ? midiTokens : textTokens;

// Write snapshot
const snapDir = path.join(__dirname, name, 'snapshots');
if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
const snap = {
  source: `-gr.${grName}`, stage: 'S1',
  tokens: tokens,
  mode: tokens.length > 0 && tokens[0].length >= 3 ? 'midi' : 'text',
  date: new Date().toISOString().substring(0, 10)
};
fs.writeFileSync(path.join(snapDir, 's1_native.json'), JSON.stringify(snap, null, 2));
console.log(`S1 OK: ${tokens.length} ${snap.mode === 'midi' ? 'notes' : 'tokens (text)'} → ${name}/snapshots/s1_native.json`);
