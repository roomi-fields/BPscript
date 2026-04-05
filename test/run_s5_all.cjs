#!/usr/bin/env node
/**
 * Run S5 (BPscript transpiler) tests on all active grammars that have a .bps scene.
 * Then compare S4 vs S5 with control-token filtering.
 *
 * Reads grammars.json: only grammars with status=active are tested.
 * Skips grammars without a scene.bps file.
 *
 * Usage: node run_s5_all.cjs --bin <version>
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { requireBinTag } = require('./resolve_bin.cjs');
const binTag = requireBinTag();

const GRAMMARS = require('./grammars/grammars.json');
const active = Object.keys(GRAMMARS)
  .filter(k => GRAMMARS[k].status === 'active')
  .sort();

const DIR = __dirname;
const ROOT = path.resolve(DIR, '..');

// Find grammars with a .bps scene
function hasBps(name) {
  return fs.existsSync(path.join(DIR, 'grammars', name, 'scene.bps'))
    || fs.existsSync(path.join(ROOT, 'scenes', `${name}.bps`));
}

// Non-terminal filter (same as compare_s4_s5.cjs)
function isNonTerminal(tok) {
  if (tok === '-' || tok === '_') return true;
  if (tok.startsWith('_script(CT')) return true;
  if (/^_[a-z]/.test(tok)) return true;
  if (/^[{}()\[\],]/.test(tok)) return true;
  if (/[{}]/.test(tok)) return true;
  if (/^\/\d/.test(tok)) return true;
  if (/^\d+\/\d+$/.test(tok)) return true;
  if (/^\([:=]/.test(tok)) return true;
  return false;
}

function compareS4S5(name) {
  const snapDir = path.join(DIR, 'grammars', name, 'snapshots');
  const s4File = path.join(snapDir, 's4_silent.json');
  const s5File = path.join(snapDir, 's5_bps.json');
  if (!fs.existsSync(s4File)) return { status: 'NO_S4', s4: 0, s5: 0, s4f: 0, s5f: 0 };
  if (!fs.existsSync(s5File)) return { status: 'NO_S5', s4: 0, s5: 0, s4f: 0, s5f: 0 };

  const s4 = JSON.parse(fs.readFileSync(s4File, 'utf-8'));
  const s5 = JSON.parse(fs.readFileSync(s5File, 'utf-8'));
  function splitStructure(tokens) {
    const out = [];
    for (const tok of tokens) {
      let t = tok;
      const leadMatch = t.match(/^(\{[\d/]*,?)(.*)/);
      if (leadMatch && leadMatch[2]) {
        if (leadMatch[1]) out.push(leadMatch[1]);
        t = leadMatch[2];
      }
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
  const s4raw = splitStructure(s4.tokens.map(t => t[0]));
  const s5raw = splitStructure(s5.tokens.map(t => t[0]));
  const s4filt = s4raw.filter(t => !isNonTerminal(t));
  const s5filt = s5raw.filter(t => !isNonTerminal(t));

  let status;
  if (s5filt.length === 0 && s4filt.length > 0) status = 'ZERO';
  else if (JSON.stringify(s4filt) === JSON.stringify(s5filt)) status = 'EXACT';
  else if (s4filt.length === s5filt.length) status = 'CONTENT';
  else status = 'COUNT';

  return { status, s4: s4raw.length, s5: s5raw.length, s4f: s4filt.length, s5f: s5filt.length };
}

// Run
const results = [];
const counts = { EXACT: 0, ZERO: 0, COUNT: 0, CONTENT: 0, SKIP: 0, FAIL: 0 };

for (const name of active) {
  if (!hasBps(name)) {
    results.push({ name, status: 'SKIP', note: 'no .bps' });
    counts.SKIP++;
    continue;
  }

  // Run S5
  try {
    execSync(`node ${path.join(DIR, 's5_bpscript.cjs')} ${name} --bin ${binTag}`, {
      timeout: 130000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (e) {
    const msg = (e.stderr || e.message || '').substring(0, 80);
    results.push({ name, status: 'FAIL', note: msg });
    counts.FAIL++;
    continue;
  }

  // Compare
  const cmp = compareS4S5(name);
  results.push({ name, ...cmp });
  counts[cmp.status] = (counts[cmp.status] || 0) + 1;
}

// Output
console.log('\n=== S5 BPscript — S4 vs S5 (control-filtered) ===\n');
console.log('Grammar'.padEnd(20) + 'Status'.padEnd(10) + 'S4'.padStart(7) + 'S5'.padStart(7) + '  Note');
console.log('-'.repeat(70));
for (const r of results) {
  const note = r.note || (r.s4f !== undefined && r.s4f !== r.s5f ? `terminals ${r.s4f}→${r.s5f}` : '');
  console.log(
    r.name.padEnd(20) +
    r.status.padEnd(10) +
    (r.s4 !== undefined ? String(r.s4).padStart(7) : ''.padStart(7)) +
    (r.s5 !== undefined ? String(r.s5).padStart(7) : ''.padStart(7)) +
    (note ? '  ' + note : '')
  );
}
console.log('-'.repeat(70));
console.log(`\nTotal: ${active.length} active | EXACT=${counts.EXACT} CONTENT=${counts.CONTENT} COUNT=${counts.COUNT} ZERO=${counts.ZERO} FAIL=${counts.FAIL} SKIP=${counts.SKIP}`);
