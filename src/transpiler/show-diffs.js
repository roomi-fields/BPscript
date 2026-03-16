/**
 * Show actual rule-level diffs for each scene (normalized).
 */
import { compileBPS } from './index.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';

const BP3_LIB = 'bp3-engine/library';
const origMap = {};
function findGr(dir) {
  try {
    for (const e of readdirSync(dir)) {
      const f = join(dir, e);
      if (statSync(f).isDirectory()) findGr(f);
      else if (e === 'grammar.gr') origMap[dirname(f).split('/').pop()] = f;
    }
  } catch {}
}
findGr(BP3_LIB);

function norm(l) {
  return l
    .replace(/gram#\d+\s*\[\d+\]\s*/g, '')
    .replace(/\s+\[[A-Z][^\]]*\]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const scenes = readdirSync('scenes').filter(f => f.endsWith('.bps')).map(f => f.replace('.bps', '')).sort();
const target = process.argv[2]; // optional: specific scene

for (const name of scenes) {
  if (target && name !== target) continue;
  if (!origMap[name]) continue;

  const orig = readFileSync(origMap[name], 'utf-8').replace(/\r/g, '\n');
  const oR = orig.split('\n')
    .filter(l => /^(gram#|[A-Z].*-->|[a-z].*-->|[)}?,+\-].*-->|\?.*-->|#.*-->|\|.*-->)/.test(l.trim()))
    .map(l => norm(l));

  const r = compileBPS(readFileSync('scenes/' + name + '.bps', 'utf-8'));
  if (r.errors.length) { console.log(`${name}: COMPILE ERROR`); continue; }
  const tR = r.grammar.split('\n').filter(l => l.startsWith('gram#')).map(l => norm(l));

  const diffs = [];
  for (let i = 0; i < Math.max(oR.length, tR.length); i++) {
    if (oR[i] !== tR[i]) diffs.push({ i, o: oR[i] || '(missing)', t: tR[i] || '(missing)' });
  }

  if (diffs.length === 0) {
    console.log(`✅ ${name}: ${oR.length} rules identical`);
  } else {
    console.log(`⚠️ ${name}: ${diffs.length} diffs / ${Math.max(oR.length, tR.length)} rules`);
    for (const d of diffs.slice(0, 3)) {
      console.log(`  O: ${d.o.substring(0, 100)}`);
      console.log(`  T: ${d.t.substring(0, 100)}`);
    }
    if (diffs.length > 3) console.log(`  ... ${diffs.length - 3} more`);
  }
}
