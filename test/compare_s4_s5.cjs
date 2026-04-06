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

const DIR = path.join(__dirname, 'grammars', name, 'snapshots');
const s4File = path.join(DIR, 's4_silent.json');
const s5File = path.join(DIR, 's5_bps.json');

if (!fs.existsSync(s4File)) { console.error(`Not found: ${s4File}`); process.exit(1); }
if (!fs.existsSync(s5File)) { console.error(`Not found: ${s5File}`); process.exit(1); }

const s4 = JSON.parse(fs.readFileSync(s4File, 'utf-8'));
const s5 = JSON.parse(fs.readFileSync(s5File, 'utf-8'));

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

// Sort both sides by time for temporal comparison
// (S4 is in structural order from engine, S5 is in temporal order from dispatcher)
const timSort = (a, b) => a[1] - b[1] || a[2] - b[2] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
const s4sorted = [...s4.tokens].sort(timSort);
const s5sorted = [...s5.tokens].sort(timSort);
const s4raw = splitStructure(s4sorted.map(t => t[0]));
const s5raw = splitStructure(s5sorted.map(t => t[0]));

const s4terms = s4raw.filter(t => !isNonTerminal(t));
const s5terms = s5raw.filter(t => !isNonTerminal(t));

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
