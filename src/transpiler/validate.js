/**
 * BPScript Validate — run both original and transpiled grammars through BP3 engine
 * and compare MIDI outputs byte-for-byte.
 *
 * Scaffolding: copies auxiliary files (-se, -al, -ho, -cs, -to, -tb, -md)
 * from bp3-ctests and original grammar dirs so bp.exe can run.
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync, copyFileSync } from 'fs';
import { execSync } from 'child_process';
import { compileBPS } from './index.js';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES_DIR = join(__dirname, '../../scenes');
const BP3_DIR = join(__dirname, '../../bp3-engine/library');
const BP_EXE_DIR = '/mnt/d/Claude/BP2SC/tools/bolprocessor';
const BP_CTESTS = '/mnt/d/Claude/BP2SC/bp3-ctests';
const BP3_DATA = join(__dirname, '../../bp3-engine/data');

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
};

const AUX_PREFIXES = ['-se.', '-al.', '-ho.', '-cs.', '-to.', '-tb.', '-md.', '-mi.'];

function runBP3(grammarFile, midiOut) {
  try {
    const cmd = `cd "${BP_EXE_DIR}" && ./bp.exe produce --seed 42 -gr "${grammarFile}" --midiout "${midiOut}" 2>&1`;
    const out = execSync(cmd, { timeout: 30000 }).toString();
    const hasError = /Errors: [1-9]/.test(out) || /Compilation failed/.test(out);
    const match = out.match(/Writing (\d+) sound-objects/);
    const objects = match ? parseInt(match[1]) : 0;
    return { ok: !hasError, objects, output: out };
  } catch (e) {
    return { ok: false, objects: 0, output: e.message };
  }
}

/**
 * Extract auxiliary file references from a BP3 grammar (lines starting with -prefix.)
 * Returns array of filenames like ["-se.tryHarmony", "-ho.abc"]
 */
function extractAuxRefs(grammarText) {
  const refs = [];
  for (const line of grammarText.split('\n')) {
    const trimmed = line.trim();
    for (const prefix of AUX_PREFIXES) {
      if (trimmed.startsWith(prefix)) {
        refs.push(trimmed);
        break;
      }
    }
  }
  return refs;
}

/**
 * Copy auxiliary files to bp.exe working dir.
 * Searches: 1) same dir as grammar, 2) bp3-ctests
 * Returns list of files copied (for cleanup).
 */
function copyAuxFiles(grammarPath, auxRefs) {
  const copied = [];
  const grammarDir = dirname(grammarPath);
  const allRefs = [...auxRefs];

  // Resolve transitive refs: -ho files may reference -mi files
  for (const ref of auxRefs) {
    const src = [join(BP_CTESTS, ref), join(BP3_DATA, ref), join(grammarDir, ref)]
      .find(p => existsSync(p));
    if (src) {
      try {
        const content = readFileSync(src, 'utf-8');
        for (const line of content.split('\n')) {
          const t = line.trim();
          if (AUX_PREFIXES.some(p => t.startsWith(p)) && !allRefs.includes(t)) {
            allRefs.push(t);
          }
        }
      } catch {} // binary files — skip
    }
  }

  for (const ref of allRefs) {
    const dest = join(BP_EXE_DIR, ref);

    // Try grammar dir first (some have .al files alongside grammar)
    // The ref is like "-se.tryHarmony", file might be named differently
    const refName = ref.substring(ref.indexOf('.') + 1); // "tryHarmony"
    const refPrefix = ref.substring(0, ref.indexOf('.') + 1); // "-se."

    // Search in bp3-ctests (most reliable source for -se files)
    const ctestFile = join(BP_CTESTS, ref);
    if (existsSync(ctestFile)) {
      copyFileSync(ctestFile, dest);
      copied.push(dest);
      continue;
    }

    // Search in bp3-engine/data (homomorphisms, alphabets, csound)
    const dataFile = join(BP3_DATA, ref);
    if (existsSync(dataFile)) {
      copyFileSync(dataFile, dest);
      copied.push(dest);
      continue;
    }

    // Search in grammar dir (for .al files etc.)
    const gramDirFile = join(grammarDir, ref);
    if (existsSync(gramDirFile)) {
      copyFileSync(gramDirFile, dest);
      copied.push(dest);
      continue;
    }

    // Try alphabet.al → -al.xxx mapping
    if (refPrefix === '-al.' || refPrefix === '-ho.') {
      const altFile = join(grammarDir, 'alphabet.al');
      if (existsSync(altFile)) {
        copyFileSync(altFile, dest);
        copied.push(dest);
        continue;
      }
    }
  }

  return copied;
}

// --- Run validation ---

let identical = 0, different = 0, errors = 0, skipped = 0;

for (const [name, grPath] of Object.entries(SCENE_MAP)) {
  const bpsFile = join(SCENES_DIR, name + '.bps');
  const origGr = join(BP3_DIR, grPath);

  // 1. Compile BPS → BP3
  let bpsSrc;
  try { bpsSrc = readFileSync(bpsFile, 'utf-8'); } catch { console.log(`SKIP ${name}: no .bps`); skipped++; continue; }
  const result = compileBPS(bpsSrc);
  if (result.errors.length > 0) {
    console.log(`FAIL ${name}: compile error — ${result.errors[0].message}`);
    errors++;
    continue;
  }

  // 2. Write grammars to bp.exe working dir
  const transGr = join(BP_EXE_DIR, `-gr.validate_${name}`);
  const origLocal = join(BP_EXE_DIR, `-gr.validate_orig_${name}`);
  const origText = readFileSync(origGr, 'utf-8');
  writeFileSync(transGr, result.grammar);
  writeFileSync(origLocal, origText);

  // 2b. Write generated alphabet file if available
  const hoFile = join(BP_EXE_DIR, '-ho.bpscript');
  if (result.alphabetFile) {
    writeFileSync(hoFile, result.alphabetFile);
  }

  // 3. Copy auxiliary files (-se, -al, -ho, -cs, -to, -tb, -md)
  const auxRefs = extractAuxRefs(origText);
  const copiedFiles = copyAuxFiles(origGr, auxRefs);
  const missingAux = auxRefs.filter(ref => !existsSync(join(BP_EXE_DIR, ref)));

  // 4. Run original through BP3 engine
  const origMidi = join(BP_EXE_DIR, `out_orig_${name}.mid`);
  const transMidi = join(BP_EXE_DIR, `out_trans_${name}.mid`);

  const origResult = runBP3(`-gr.validate_orig_${name}`, `out_orig_${name}.mid`);

  if (!origResult.ok) {
    const reason = missingAux.length > 0 ? `missing: ${missingAux.join(', ')}` : 'engine error';
    console.log(`SKIP ${name}: original BP3 failed (${reason})`);
    skipped++;
    // Cleanup
    try { unlinkSync(transGr); unlinkSync(origLocal); } catch {}
    for (const f of copiedFiles) try { unlinkSync(f); } catch {}
    continue;
  }

  // 5. Run transpiled through BP3 engine
  //    The transpiled grammar doesn't reference -se/-al files, so we need to
  //    add the same references to make bp.exe happy
  const transText = result.grammar;
  // Inject aux refs into transpiled grammar (after the // header lines)
  const transLines = transText.split('\n');
  const headerEnd = transLines.findIndex(l => !l.startsWith('//') && l.trim() !== '');
  const transWithAux = [
    ...transLines.slice(0, headerEnd),
    ...auxRefs,
    ...transLines.slice(headerEnd)
  ].join('\n');
  writeFileSync(transGr, transWithAux);

  const transResult = runBP3(`-gr.validate_${name}`, `out_trans_${name}.mid`);

  if (!transResult.ok) {
    console.log(`FAIL ${name}: transpiled BP3 rejected by engine`);
    const errLines = transResult.output.split('\n').filter(l => /Error|\?\?\?/.test(l));
    for (const l of errLines.slice(0, 3)) console.log(`  ${l.trim()}`);
    errors++;
    // Cleanup
    try { unlinkSync(transGr); unlinkSync(origLocal); unlinkSync(origMidi); } catch {}
    for (const f of copiedFiles) try { unlinkSync(f); } catch {}
    continue;
  }

  // 6. Compare MIDI outputs
  let origMidiData, transMidiData;
  try { origMidiData = readFileSync(origMidi); } catch { console.log(`SKIP ${name}: no original MIDI`); skipped++; continue; }
  try { transMidiData = readFileSync(transMidi); } catch { console.log(`FAIL ${name}: no transpiled MIDI`); errors++; continue; }

  if (origMidiData.equals(transMidiData)) {
    console.log(`  OK ${name} (${origResult.objects} objects, MIDI identical)`);
    identical++;
  } else {
    console.log(`DIFF ${name} (orig: ${origResult.objects} obj/${origMidiData.length}B, trans: ${transResult.objects} obj/${transMidiData.length}B)`);
    different++;
  }

  // Cleanup
  try { unlinkSync(transGr); unlinkSync(origLocal); unlinkSync(origMidi); unlinkSync(transMidi); } catch {}
  for (const f of copiedFiles) try { unlinkSync(f); } catch {}
}

console.log(`\n${identical} OK, ${different} DIFF, ${errors} FAIL, ${skipped} SKIP / ${Object.keys(SCENE_MAP).length} total`);
