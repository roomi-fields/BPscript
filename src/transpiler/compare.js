/**
 * BPScript Compare — compare transpiled BP3 output with original BP3 grammar files
 *
 * Extracts significant lines (mode, preamble, rules, separators) from both
 * and reports differences.
 */

import { readFileSync, readdirSync } from 'fs';
import { compileBPS } from './index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES_DIR = join(__dirname, '../../scenes');
const BP3_DIR = join(__dirname, '../../bp3-engine/library');

// Map scene names to original grammar paths
const SCENE_MAP = {
  'drum':             'examples/drum/grammar.gr',
  'flags':            'examples/flags/grammar.gr',
  'acceleration':     'experimental/acceleration/grammar.gr',
  'templates':        'examples/templates/grammar.gr',
  'negative-context': 'examples/negative-context/grammar.gr',
  'harmony':          'examples/harmony/grammar.gr',
  'mohanam':          'tabla/mohanam/grammar.gr',
  'repeat':           'examples/repeat/grammar.gr',
  'time-patterns':    'examples/time-patterns/grammar.gr',
  'transposition':    'examples/transposition/grammar.gr',
  'livecode1':        'experimental/livecode1/grammar.gr',
  'scales':           'examples/scales/grammar.gr',
  'not-reich':        'experimental/not-reich/grammar.gr',
  'mozart-dice':      'western/mozart-dice/grammar.gr',
  'all-items':        'examples/all-items/grammar.gr',
  'one-scale':        'examples/one-scale/grammar.gr',
  'visser-shapes':    'experimental/visser-shapes/grammar.gr',
  'major-minor':      'examples/major-minor/grammar.gr',
  'tunings':          'examples/tunings/grammar.gr',
  'vina3':            'tabla/vina3/grammar.gr',
  'visser-waves':     'experimental/visser-waves/grammar.gr',
};

/**
 * Extract significant lines from a BP3 grammar:
 * - Mode lines (RND, ORD, LIN, SUB1, etc.)
 * - Preamble lines (_mm, _striated, _destru, etc.)
 * - Rule lines (gram#N[M] ...)
 * - Separator lines (---...)
 * Ignores: comments, file refs (-se., -al.), blank lines, COMMENT: sections
 */
function extractSignificant(text) {
  const lines = text.split('\n');
  const result = [];
  let inComment = false;

  for (let raw of lines) {
    raw = raw.trim();

    // Skip COMMENT: section at end of file
    if (raw === 'COMMENT:') { inComment = true; continue; }
    if (inComment) continue;

    // Skip empty, comments, file refs, TEMPLATES:, TIMEPATTERNS:
    if (!raw) continue;
    if (raw.startsWith('//')) continue;
    if (raw.startsWith('-se.') || raw.startsWith('-al.') || raw.startsWith('-cs.')
      || raw.startsWith('-ho.') || raw.startsWith('-to.') || raw.startsWith('-md.')) continue;
    if (raw === 'TEMPLATES:' || raw === 'TIMEPATTERNS:') continue;

    // Normalize whitespace
    raw = raw.replace(/\s+/g, ' ').trim();

    // Strip trailing annotations [text] on mode lines (e.g. "LIN [Select rules...]")
    if (/^(RND|ORD|LIN|SUB1?|TEM|POSLONG)(\s+\[.*)$/.test(raw)) {
      raw = raw.replace(/\s+\[.*$/, '');
    }

    // Strip trailing annotations on rules (e.g. "S --> ... [Just intonation]")
    // But NOT qualifiers that look like [key:value] — only free text annotations
    raw = raw.replace(/\s+\[[A-Z][^\]]*\]\s*$/, '');

    result.push(raw);
  }
  return result;
}

/**
 * Normalize a line for comparison:
 * - Trim spaces around operators
 * - Normalize separator lengths
 */
function normalize(line) {
  // Normalize separators to fixed length
  if (/^-{5,}$/.test(line)) return '------------';
  // Normalize spaces (already done in extract)
  return line;
}

// --- Run comparison ---

let totalOk = 0, totalDiff = 0, totalSkip = 0;

const scenes = Object.keys(SCENE_MAP);

for (const name of scenes) {
  const bpsFile = join(SCENES_DIR, name + '.bps');
  const grFile = join(BP3_DIR, SCENE_MAP[name]);

  let bpsSrc, grSrc;
  try {
    bpsSrc = readFileSync(bpsFile, 'utf-8');
    grSrc = readFileSync(grFile, 'utf-8');
  } catch (e) {
    console.log(`SKIP ${name}: ${e.message}`);
    totalSkip++;
    continue;
  }

  // Compile BPS
  const result = compileBPS(bpsSrc);
  if (result.errors.length > 0) {
    console.log(`FAIL ${name}: compile error — ${result.errors[0].message}`);
    totalDiff++;
    continue;
  }

  // Extract significant lines
  const expected = extractSignificant(grSrc).map(normalize);
  const actual = extractSignificant(result.grammar).map(normalize);

  // Compare
  const diffs = [];
  const maxLen = Math.max(expected.length, actual.length);

  for (let i = 0; i < maxLen; i++) {
    const exp = expected[i] || '(missing)';
    const act = actual[i] || '(missing)';
    if (exp !== act) {
      diffs.push({ line: i + 1, expected: exp, actual: act });
    }
  }

  if (diffs.length === 0) {
    console.log(`  OK ${name} (${expected.length} lines match)`);
    totalOk++;
  } else {
    console.log(`DIFF ${name}: ${diffs.length} difference(s)`);
    for (const d of diffs.slice(0, 5)) {
      console.log(`  line ${d.line}:`);
      console.log(`    expected: ${d.expected.substring(0, 120)}`);
      console.log(`    actual:   ${d.actual.substring(0, 120)}`);
    }
    if (diffs.length > 5) console.log(`  ... and ${diffs.length - 5} more`);
    totalDiff++;
  }
}

console.log(`\n${totalOk} OK, ${totalDiff} DIFF, ${totalSkip} SKIP / ${scenes.length} total`);
