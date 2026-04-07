#!/usr/bin/env node
/**
 * Compare S4 (original.gr + silent.al) vs S5 (BPscript transpiler).
 *
 * S5 uses getResult() (text output) for all grammars since alphabets are silent.
 * Filters out non-terminal tokens before comparing:
 *  - Controls: _script(CT*), _vel(...), _tempo(...), etc.
 *  - Structure: polymetric braces, tempo divisors, fractional durations
 *  - Silences: -, _
 *
 * Usage: node compare_s4_s5.cjs <grammar>
 */
const fs = require('fs');
const path = require('path');

const name = process.argv[2];
if (!name) { console.error('Usage: node compare_s4_s5.cjs <grammar>'); process.exit(1); }

const GRAMMARS = require('./grammars/grammars.json');
const gramDef = GRAMMARS[name] || {};
if (gramDef.s4s5_skip) {
  console.error(`SKIP ${name}: ${gramDef.s4s5_skip}`);
  process.exit(1);
}
// c4key: Bernard's C4 key number (default 60). If 48, engine outputs octave-1 for solfège.
const c4keyShift = (60 - (gramDef.c4key || 60)) / 12;  // +1 when c4key=48

const DIR = path.join(__dirname, 'grammars', name, 'snapshots');
const s4File = path.join(DIR, 's4_silent.json');
const s5File = path.join(DIR, 's5_bps.json');

if (!fs.existsSync(s4File)) { console.error(`Not found: ${s4File}`); process.exit(1); }
if (!fs.existsSync(s5File)) { console.error(`Not found: ${s5File}`); process.exit(1); }

const s4 = JSON.parse(fs.readFileSync(s4File, 'utf-8'));
const s5 = JSON.parse(fs.readFileSync(s5File, 'utf-8'));

// Enharmonic normalization: flats → sharps for comparison
// Bb4 == A#4, Db4 == C#4, Eb4 == D#4, etc.
const ANGLO_FLAT_TO_SHARP = {
  'Cb': ['B', -1], 'Db': ['C#', 0], 'Eb': ['D#', 0], 'Fb': ['E', 0],
  'Gb': ['F#', 0], 'Ab': ['G#', 0], 'Bb': ['A#', 0]
};
const SOLF_FLAT_TO_SHARP = {
  'dob': ['si', -1], 'reb': ['do#', 0], 'mib': ['re#', 0], 'fab': ['mi', 0],
  'solb': ['fa#', 0], 'lab': ['sol#', 0], 'sib': ['la#', 0]
};

// Octave shift for C4key convention mismatch (e.g. C4key=48 → engine outputs octave-1)
function shiftOctave(tok, delta) {
  if (delta === 0) return tok;
  // Anglo: C4, F#3, Ab5
  let m = tok.match(/^([A-G][b#]?)(\d+)$/);
  if (m) return m[1] + (parseInt(m[2]) + delta);
  // Solfège: do4, fa#3, sol3
  m = tok.match(/^(do|re|mi|fa|sol|la|si)([b#]?)(\d+)$/);
  if (m) return m[1] + m[2] + (parseInt(m[3]) + delta);
  // Indian: sa4, pa5, ma6
  m = tok.match(/^(sa|re|ga|ma|pa|dha|ni)([b#]?)(\d+)$/);
  if (m) return m[1] + m[2] + (parseInt(m[3]) + delta);
  return tok;
}

function normalizeEnharmonic(tok) {
  // Anglo: Bb4 → A#4
  let m = tok.match(/^([A-G]b)(\d+)$/);
  if (m && ANGLO_FLAT_TO_SHARP[m[1]]) {
    const [sharp, octDelta] = ANGLO_FLAT_TO_SHARP[m[1]];
    return sharp + (parseInt(m[2]) + octDelta);
  }
  // Solfège: sib3 → la#3
  m = tok.match(/^(do|re|mi|fa|sol|la|si)(b)(\d+)$/);
  if (m) {
    const key = m[1] + m[2];
    if (SOLF_FLAT_TO_SHARP[key]) {
      const [sharp, octDelta] = SOLF_FLAT_TO_SHARP[key];
      return sharp + (parseInt(m[3]) + octDelta);
    }
  }
  return tok;
}

// Non-terminal filter: controls, silences, structure tokens
function isNonTerminal(tok) {
  if (tok === '-' || tok === '_') return true;                    // silence, prolongation
  if (tok.startsWith('_script(CT')) return true;                  // transpiler runtime controls
  if (/^_[a-z]/.test(tok)) return true;                           // BP3 native controls
  if (/^[{}()\[\],]/.test(tok)) return true;                      // lone structural chars
  if (/[{}]/.test(tok)) return true;                               // any token containing braces (polymetric fragments)
  if (/^\/\d/.test(tok)) return true;                             // tempo divisors /2, /5
  if (/^\d+\/\d+$/.test(tok)) return true;                        // fractional durations 1/2, 3/4
  if (/^\([:=]/.test(tok)) return true;                            // template markers (= Tihai), (: Tihai)
  return false;
}

// Split polymetric-attached tokens: "{2,C4" → ["{2,", "C4"], "C4}" → ["C4", "}"]
function splitStructure(tokens) {
  const out = [];
  for (const tok of tokens) {
    if (tok == null) continue;
    // Split leading { with optional speed prefix: {2,C4 → {2, + C4
    let t = tok;
    const leadMatch = t.match(/^(\{[\d/]*,?)(.*)/);
    if (leadMatch && leadMatch[2]) {
      if (leadMatch[1]) out.push(leadMatch[1]);
      t = leadMatch[2];
    }
    // Split trailing } : C4} → C4 + }
    const trailMatch = t.match(/^(.*?)(}+)$/);
    if (trailMatch && trailMatch[1]) {
      out.push(trailMatch[1]);
      out.push(trailMatch[2]);
    } else {
      out.push(t);
    }
  }
  return out;
}

// Normalize token name for sorting (enharmonic + octave shift)
const normS4 = t => normalizeEnharmonic(shiftOctave(t, c4keyShift));
const normS5 = t => normalizeEnharmonic(t);

// Sort both sides by time, then by normalized token name as tiebreaker
const mkSort = (norm) => (a, b) => {
  const dt = a[1] - b[1] || a[2] - b[2];
  if (dt !== 0) return dt;
  const na = norm(a[0]), nb = norm(b[0]);
  return na < nb ? -1 : na > nb ? 1 : 0;
};
const s4sorted = [...s4.tokens].sort(mkSort(normS4));
// Filter S5 tokens to only terminals declared in the scene's alphabet
const s5alphabet = s5.alphabet && s5.alphabet.length > 0 ? new Set(s5.alphabet) : null;
const s5filtered = s5alphabet
  ? s5.tokens.filter(t => s5alphabet.has(t[0]))
  : s5.tokens;
const s5sorted = [...s5filtered].sort(mkSort(normS5));
const s4raw = splitStructure(s4sorted.map(t => t[0]));
const s5raw = splitStructure(s5sorted.map(t => t[0]));

const s4terms = s4raw.filter(t => !isNonTerminal(t)).map(normS4);
const s5terms = s5raw.filter(t => !isNonTerminal(t)).map(normS5);

const s4excluded = s4raw.length - s4terms.length;
const s5excluded = s5raw.length - s5terms.length;

// Compare filtered terminals
const exact = JSON.stringify(s4terms) === JSON.stringify(s5terms);
let status;
if (s5terms.length === 0 && s4terms.length > 0) status = 'ZERO';
else if (exact) status = 'EXACT';
else if (s4terms.length === s5terms.length) status = 'CONTENT';
else status = 'COUNT';

console.log(`${name}: S4=${s4raw.length}(${s4terms.length}t+${s4excluded}x) S5=${s5raw.length}(${s5terms.length}t+${s5excluded}x) → ${status}`);

if (!exact) {
  const maxLen = Math.max(s4terms.length, s5terms.length);
  let diffs = 0;
  for (let i = 0; i < maxLen && diffs < 10; i++) {
    if (s4terms[i] !== s5terms[i]) {
      console.log(`  [${i}] S4=${JSON.stringify(s4terms[i])} S5=${JSON.stringify(s5terms[i])}`);
      diffs++;
    }
  }
  if (s4terms.length !== s5terms.length) {
    console.log(`  terminal count: S4=${s4terms.length} S5=${s5terms.length} (delta=${s5terms.length - s4terms.length})`);
  }
}
