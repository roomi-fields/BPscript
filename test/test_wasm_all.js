/**
 * Full WASM integration test — validates ALL scenes through the real BP3 engine.
 *
 * Each scene runs in an isolated child process (WASM crash can't corrupt others).
 *
 * Stages per scene:
 *   S1. Transpile:    source → grammar text (compileBPS, no errors)
 *   S2. Constraints:  BOLSIZE ≤ 30, no _ prefix terminals, grammar structure,
 *                     dispatcher dependency detection (scale, transpose → deps:)
 *   S3. WASM engine:  load alphabet + settings + grammar → produce → no errors
 *   S4. Timed tokens: bp3_get_timed_tokens() returns valid data
 *   S5. Resolver:     each terminal resolves (pitched or sounds, not null)
 *   S6. Conformity:   compare with original BP3 grammar (loads aux files from
 *                     bp3-engine/test-data/: -se. settings (old-format auto-converted),
 *                     -al./-ho. alphabet, -to. tonality (with inference if not in header);
 *                     -cs. csound skipped — binary format not loadable in test context)
 *
 * S6 comparison: terminal sequence + temporal proportions.
 * Originals produce MIDI notes (via OCT), transpiled produces silent sound objects
 * (flat alphabet). Names should match after enharmonic normalization.
 *
 * S6 results: exact | timing-diff | count:NvsM | names-diff | orig-empty | err
 *
 * On S6 timeout (complex originals), S1-S5 results are recovered.
 *
 * Run: node test/test_wasm_all.js
 * Deps: dist/ (WASM build), ../bp3-engine/test-data/ (original aux files)
 */

const { readFileSync, readdirSync, writeFileSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

const DIST_DIR = join(__dirname, '..', 'dist');
const SCENES_DIR = join(__dirname, '..', 'scenes');
const BP3_BOLSIZE = 30;

// Confirmed engine limitations (2026-03-22, verified both original + transpiled)
const WASM_SKIP = new Set([
  '765432',        // stack overflow (13 subgrammars, deep polymetry)
  'nadaka',        // stack overflow (octave variable resolution across 5 subgrammars)
  'not-reich',     // stack overflow (phasing/polymetry)
  'visser3',       // stack overflow (transposition-driven structure)
  'visser-shapes', // stack overflow (44 nesting levels)
  'visser-waves',  // stack overflow (59 braces, deep embedding)
  'visser5',       // stack overflow (serial tools, key expansion)
  'shapes-rhythm', // memory overflow (17 subgrammars, 146 rules)
  'watch',         // stack overflow (combinatorial explosion)
  'asymmetric',    // 0 tokens — compiles clean, flag-driven recursion produces nothing
  'mohanam',       // 0 tokens — compiles clean, flag-driven recursion produces nothing
]);

// Map scene name → original BP3 grammar path (relative to dist/library/)
const ORIGINAL_MAP = {
  'drum': 'examples/drum/grammar.gr', 'flags': 'examples/flags/grammar.gr',
  'acceleration': 'experimental/acceleration/grammar.gr', 'templates': 'examples/templates/grammar.gr',
  'negative-context': 'examples/negative-context/grammar.gr', 'harmony': 'examples/harmony/grammar.gr',
  'mohanam': 'tabla/mohanam/grammar.gr', 'repeat': 'examples/repeat/grammar.gr',
  'time-patterns': 'examples/time-patterns/grammar.gr', 'transposition': 'examples/transposition/grammar.gr',
  'livecode1': 'experimental/livecode1/grammar.gr', 'scales': 'examples/scales/grammar.gr',
  'not-reich': 'experimental/not-reich/grammar.gr', 'mozart-dice': 'western/mozart-dice/grammar.gr',
  'all-items': 'examples/all-items/grammar.gr', 'one-scale': 'examples/one-scale/grammar.gr',
  'visser-shapes': 'experimental/visser-shapes/grammar.gr', 'look-and-say': 'experimental/look-and-say/grammar.gr',
  'ames': 'western/ames/grammar.gr', 'graphics': 'examples/graphics/grammar.gr',
  'visser3': 'experimental/visser3/grammar.gr', 'livecode2': 'experimental/livecode2/grammar.gr',
  'visser5': 'experimental/visser5/grammar.gr', 'asymmetric': 'experimental/asymmetric/grammar.gr',
  'csound': 'examples/csound/grammar.gr', 'ek-do-tin': 'tabla/ek-do-tin/grammar.gr',
  'destru': 'examples/destru/grammar.gr', 'kss2': 'experimental/kss2/grammar.gr',
  'vina': 'tabla/vina/grammar.gr', 'vina2': 'tabla/vina2/grammar.gr', 'vina3': 'tabla/vina3/grammar.gr',
  'dhin': 'tabla/dhin/grammar.gr', 'dhati': 'tabla/dhati/grammar.gr', 'nadaka': 'tabla/nadaka/grammar.gr',
  '765432': 'experimental/765432/grammar.gr', 'shapes-rhythm': 'experimental/shapes-rhythm/grammar.gr',
  'visser-waves': 'experimental/visser-waves/grammar.gr', 'koto3': 'experimental/koto3/grammar.gr',
  'major-minor': 'examples/major-minor/grammar.gr', 'tunings': 'examples/tunings/grammar.gr',
  'alan-dice': 'western/alan-dice/grammar.gr', 'beatrix-dice': 'western/beatrix-dice/grammar.gr',
  'ruwet': 'western/ruwet/grammar.gr', 'watch': 'western/watch/grammar.gr',
};

// Known unresolved terminals — not transpiler bugs, expected limitations.
// These produce WARN instead of FAIL.
const RESOLVER_KNOWN = {
  'all-items':     'opaque structural terminals (a, b)',
  'flags':         'opaque structural terminals (a, b)',
  'repeat':        'opaque structural terminals (a, b, c)',
  'koto3':         'opaque structural terminals (a, b, c, f, chik)',
  'destru':        'destructive grammar — opaque compound terminals',
  'look-and-say':  'Conway sequence digits (d1, d2, d3)',
  'time-patterns': 'time patterns (t1-t4) not yet supported',
  'one-scale':     'just intonation Cj4/Aj4/Gj4 — BP3-specific notation',
  'dhati':         'multi-alphabet scene (tabla + solfege Lahra) — needs multi-actor',
  'kss2':          'X/Y structural symbols may survive random derivation (weight decay)',
};

const LIB_DIR = join(DIST_DIR, 'library');

const TEST_DATA_DIR = join(__dirname, '..', '..', 'bp3-engine', 'test-data');

// Child process script template — runs one scene through all stages
function buildChildScript(sceneFile, origGrammarPath) {
  const absScene = join(SCENES_DIR, sceneFile).replace(/\\/g, '/');
  const absLib = join(__dirname, '..', 'lib').replace(/\\/g, '/');
  const absOrig = origGrammarPath ? join(LIB_DIR, origGrammarPath).replace(/\\/g, '/') : null;
  const absTestData = TEST_DATA_DIR.replace(/\\/g, '/');

  return `
const fs = require('fs');
require('./bp3.js')().then(async (Module) => {
  const result = { stages: {} };
  try {
    // ESM imports
    const { compileBPS } = await import('${join(__dirname, '..', 'src', 'transpiler', 'index.js').replace(/\\/g, '/')}');
    const { Resolver } = await import('${join(__dirname, '..', 'src', 'dispatcher', 'resolver.js').replace(/\\/g, '/')}');
    const { SoundsResolver } = await import('${join(__dirname, '..', 'src', 'dispatcher', 'soundsResolver.js').replace(/\\/g, '/')}');

    // Libs
    const alphabets = JSON.parse(fs.readFileSync('${absLib}/alphabets.json', 'utf8'));
    const tunings = JSON.parse(fs.readFileSync('${absLib}/tunings.json', 'utf8'));
    const temperaments = JSON.parse(fs.readFileSync('${absLib}/temperaments.json', 'utf8'));
    const octaves = JSON.parse(fs.readFileSync('${absLib}/octaves.json', 'utf8'));
    const tablaPerc = JSON.parse(fs.readFileSync('${absLib}/sounds/tabla_perc.json', 'utf8'));

    // S1: Transpile
    const source = fs.readFileSync('${absScene}', 'utf8');
    const compiled = compileBPS(source);
    if (compiled.errors.length > 0) {
      result.stages.s1 = { ok: false, err: compiled.errors[0].message };
      console.log(JSON.stringify(result));
      return;
    }
    result.stages.s1 = { ok: true };

    // S2: Constraints (enriched)
    const bols = compiled.alphabetFile
      ? compiled.alphabetFile.split('\\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'))
      : [];
    const s2warnings = [];

    // S2a: BOLSIZE
    const oversize = bols.filter(b => b.length > ${BP3_BOLSIZE});
    if (oversize.length > 0) {
      result.stages.s2 = { ok: false, err: oversize.map(b => b + '(' + b.length + ')').join(', ') };
      console.log(JSON.stringify(result));
      return;
    }

    // S2b: No _ prefix in terminals (would collide with BP3 control namespace)
    const underscoreBols = bols.filter(b => b.startsWith('_'));
    if (underscoreBols.length > 0) s2warnings.push('_prefix:' + underscoreBols.join(','));

    // S2c: Grammar structure — every non-comment, non-mode, non-separator line should be a rule
    const gramLines = compiled.grammar.split('\\n').filter(l => l.trim() && !l.startsWith('//'));
    const modes = new Set(['ORD','RND','SUB1','SUB','LIN','TEM','POSLONG']);
    const badLines = gramLines.filter(l => {
      const t = l.trim();
      if (modes.has(t)) return false;              // mode line
      if (t.startsWith('---')) return false;        // separator
      if (t.startsWith('_')) return false;          // preamble (_mm, _striated, etc.)
      if (t.startsWith('gram#')) return false;      // rule
      return true;
    });
    if (badLines.length > 0) s2warnings.push('bad_lines:' + badLines.length);

    // S2d: Dispatcher dependencies (functions routed via _script that runtime doesn't handle yet)
    const deps = [];
    for (const ct of (compiled.controlTable || [])) {
      for (const key of Object.keys(ct.assignments || {})) {
        if (['scale','transpose'].includes(key) && !deps.includes(key)) deps.push(key);
      }
    }

    result.stages.s2 = { ok: true, count: bols.length, warnings: s2warnings, deps };

    // S3: WASM
    const init = Module.cwrap('bp3_init', 'number', []);
    const loadGr = Module.cwrap('bp3_load_grammar', 'number', ['string']);
    const loadAl = Module.cwrap('bp3_load_alphabet', 'number', ['string']);
    const loadSe = Module.cwrap('bp3_load_settings', 'number', ['string']);
    const loadSp = Module.cwrap('bp3_load_settings_params', 'number',
      ['number','number','number','number','number','number']);
    const produce = Module.cwrap('bp3_produce', 'number', []);
    const getMsg = Module.cwrap('bp3_get_messages', 'string', []);
    const getTTC = Module.cwrap('bp3_get_timed_token_count', 'number', []);
    const getTT = Module.cwrap('bp3_get_timed_tokens', 'string', []);

    init(42);
    loadSp(0, 10, 10, 1, Math.floor(Math.random() * 32000) + 1, 60);
    if (compiled.alphabetFile) loadAl(compiled.alphabetFile);
    if (compiled.settingsJSON) loadSe(compiled.settingsJSON);
    loadGr(compiled.grammar);
    produce();

    const messages = getMsg();
    // Error code 32 = "can't create MIDI data" — expected with flat alphabets, not blocking
    const hasRealError = /Errors: [1-9]/.test(messages)
      && !/Errors: \\d+.*Error code 32/.test(messages.replace(/\\n/g, ' '));
    const hasSyntaxError = /Can.t make sense/.test(messages) || /Can.t accept/.test(messages);
    if (hasRealError || hasSyntaxError) {
      const errLine = messages.split('\\n').find(l => /Can.t make sense|Can.t accept|Error code (?!32)/.test(l)) || 'WASM error';
      result.stages.s3 = { ok: false, err: errLine.trim().substring(0, 120) };
      console.log(JSON.stringify(result));
      return;
    }
    result.stages.s3 = { ok: true };

    // S4: Timed tokens
    // Note: bp3_get_timed_token_count() returns 0 even when tokens exist (WASM API quirk).
    // We parse bp3_get_timed_tokens() directly instead.
    let tokens;
    try { tokens = JSON.parse(getTT()); } catch(e) { tokens = []; }
    result.stages.s4 = { ok: tokens.length > 0, count: tokens.length, err: tokens.length === 0 ? '0 tokens' : null };
    if (!result.stages.s4.ok) { console.log(JSON.stringify(result)); return; }

    // S5: Resolver
    const alphabetKeyMap = { raga: 'sargam' };
    let alphabetKey = 'western', tuningKey = null, soundsKey = null, octavesKey = null;
    for (const dir of (compiled.directives || [])) {
      if (dir.name === 'alphabet' && dir.subkey) alphabetKey = alphabetKeyMap[dir.subkey] || dir.subkey;
      if (dir.name === 'tuning' && dir.runtime) tuningKey = dir.runtime;
      if (dir.name === 'sounds' && (dir.runtime || dir.subkey)) soundsKey = dir.runtime || dir.subkey;
      if (dir.name === 'octaves' && (dir.subkey || dir.runtime)) octavesKey = dir.subkey || dir.runtime;
    }
    if (!tuningKey) {
      for (const [k, v] of Object.entries(tunings)) {
        if (k.startsWith('_')) continue;
        if (v.alphabet === alphabetKey) { tuningKey = k; break; }
      }
    }
    tuningKey = tuningKey || 'western_12TET';
    const octDef = { western:'western', sargam:'arrows', solfege:'western', tabla:'western' };
    const octKey = octavesKey || octDef[alphabetKey] || 'western';
    const tuningData = tunings[tuningKey];
    const tempData = tuningData?.temperament ? temperaments[tuningData.temperament] : null;
    const resolver = new Resolver({
      alphabet: alphabets[alphabetKey] || alphabets.western,
      octaves: octaves?.[octKey],
      tuning: tuningData,
      temperament: tempData,
    });
    if (!soundsKey) { const m = { tabla: 'tabla_perc' }; soundsKey = m[alphabetKey] || null; }
    if (soundsKey === 'tabla_perc') resolver.soundsResolver = new SoundsResolver(tablaPerc);

    const seen = new Set();
    const unresolved = [];
    for (const t of tokens) {
      if (seen.has(t.token) || t.token.startsWith('_') || t.token === '-' || t.token === '&') continue;
      seen.add(t.token);
      if (!resolver.resolve(t.token)) unresolved.push(t.token);
    }
    result.stages.s5 = { ok: true, resolved: seen.size - unresolved.length, unresolved };

    // Flush S1-S5 results before attempting S6 (S6 can timeout on complex originals)
    result._s5done = true;
    console.log(JSON.stringify(result));

    // S6: Conformity — compare with original BP3 grammar (+ aux files)
    const origPath = '${absOrig}';
    const testDataDir = '${absTestData}';
    if (origPath !== 'null' && fs.existsSync(origPath)) {
      try {
        const origRaw = fs.readFileSync(origPath, 'utf8');
        const origGrammar = origRaw
          .split('\\n').filter(l => !/^-[a-z]{2}\\./.test(l.trim()) && !/^\\[/.test(l.trim()) && !/^INIT:/.test(l.trim())).join('\\n');

        // Parse aux file references from grammar header
        const seMatch = origRaw.match(/^-se\\.(\\S+)/m);
        const alMatch = origRaw.match(/^-al\\.(\\S+)/m);
        const hoMatch = origRaw.match(/^-ho\\.(\\S+)/m);
        const toMatch = origRaw.match(/^-to\\.(\\S+)/m);
        const csMatch = origRaw.match(/^-cs\\.(\\S+)/m);

        // Cwrap extra loaders
        const loadTo = Module.cwrap('bp3_load_tonality', 'number', ['string']);
        const loadCs = Module.cwrap('bp3_load_csound_resources', 'number', ['string']);
        const getMidiCount = Module.cwrap('bp3_get_midi_event_count', 'number', []);

        // Load in order: init → settings → alphabet → tonality → grammar → produce
        init(42);
        loadSp(0, 10, 10, 1, Math.floor(Math.random() * 32000) + 1, 60);

        // Convert old-format settings (positional text) to JSON
        function convertOldSettings(c) {
          const l=c.split('\\n'); if(l.length<12) return null;
          const n=(i)=>{const v=(l[i-1]||'').trim();if(!v||v.startsWith('//')||v.startsWith('<'))return null;const f=parseFloat(v);return isNaN(f)?null:v;};
          const o={};
          const a=(k,nm,i,bool)=>{const v=n(i);if(v!==null)o[k]={name:nm,value:v,boolean:bool?'1':'0'};};
          const ab=(k,nm,i,unit)=>{const v=n(i);if(v!==null){const e={name:nm,value:v,boolean:'0'};if(unit)e.unit=unit;o[k]=e;}};
          ab('Quantization','Quantization',5,'ms');ab('Time_res','Time resolution',6,'ms');
          ab('MIDIsyncDelay','MIDI sync delay',7,'ms');a('Quantize','Quantize',8,true);
          a('Nature_of_time','Nature of time',9,false);a('NoteConvention','Note convention',10,false);
          a('Pclock','P clock',11,false);a('Qclock','Q clock',12,false);
          // DisplayItems MUST be 1 in WASM — bp3_init() sets it, don't let old settings override
          o.DisplayItems={name:'Display items',value:'1',boolean:'1'};
          if(l.length>=29)a('DisplayProduce','Display produce',29,true);
          if(l.length>=30)a('SplitTimeObjects','Split time objects',30,true);
          if(l.length>=33)a('Improvize','Improvize',33,true);
          if(l.length>=44)ab('DeftBufferSize','Default buffer size',44);
          if(l.length>=47)ab('MaxConsoleTime','Max console time',47,'seconds');
          if(l.length>=64)ab('EndFadeOut','End fade out',64,'seconds');
          if(l.length>=65)ab('C4key','C4 key number',65,'MIDI key');
          if(l.length>=66)ab('A4freq','A4 frequency',66,'Hz');
          if(l.length>=67)a('StrikeAgainDefault','Strike again default',67,true);
          if(l.length>=68)ab('DeftVolume','Default volume',68,'0-127');
          if(l.length>=70)ab('DeftVelocity','Default velocity',70,'0-127');
          return o.NoteConvention?JSON.stringify(o):null;
        }

        const auxLoaded = [];
        if (seMatch && fs.existsSync(testDataDir + '/-se.' + seMatch[1])) {
          let seData = fs.readFileSync(testDataDir + '/-se.' + seMatch[1], 'utf8');
          if (!seData.trim().startsWith('{')) seData = convertOldSettings(seData) || '';
          if (seData) { loadSe(seData); auxLoaded.push('se'); }
        }
        if (alMatch && fs.existsSync(testDataDir + '/-al.' + alMatch[1])) {
          loadAl(fs.readFileSync(testDataDir + '/-al.' + alMatch[1], 'utf8'));
          auxLoaded.push('al');
        } else if (hoMatch && fs.existsSync(testDataDir + '/-al.' + hoMatch[1])) {
          loadAl(fs.readFileSync(testDataDir + '/-al.' + hoMatch[1], 'utf8'));
          auxLoaded.push('ho>al');
        }
        // Load tonality — try explicit -to. from header, then infer from grName/seName/csName
        let toLoaded = false;
        if (toMatch && fs.existsSync(testDataDir + '/-to.' + toMatch[1])) {
          loadTo(fs.readFileSync(testDataDir + '/-to.' + toMatch[1], 'utf8'));
          auxLoaded.push('to'); toLoaded = true;
        }
        if (!toLoaded) {
          const grBasename = origPath ? origPath.split('/').pop().replace('grammar.gr','').replace('.gr','') : null;
          const toCandidates = [];
          if (seMatch) toCandidates.push(seMatch[1]);
          if (csMatch) toCandidates.push(csMatch[1]);
          for (const c of toCandidates) {
            if (fs.existsSync(testDataDir + '/-to.' + c)) {
              loadTo(fs.readFileSync(testDataDir + '/-to.' + c, 'utf8'));
              auxLoaded.push('to:' + c); toLoaded = true; break;
            }
          }
        }
        // Skip -cs. (Csound instruments) — binary format not loadable in WASM test context
        if (csMatch) auxLoaded.push('cs:skip');

        loadGr(origGrammar);
        produce();

        const origTC = getTTC();
        let origTokens = [];
        try { origTokens = JSON.parse(getTT()); } catch {}
        const origMidiCount = getMidiCount();

        // Compare note tokens (filter controls, normalize enharmonics)
        const enh = s => s.replace(/Db/g,'C#').replace(/Eb/g,'D#').replace(/Gb/g,'F#').replace(/Ab/g,'G#').replace(/Bb/g,'A#');
        const isNote = t => !t.token.startsWith('_') && t.token !== '-' && t.token !== '&';
        const origNotes = origTokens.filter(isNote);
        const transNotes = tokens.filter(isNote);

        let tokenMatch = 'unknown';
        if (origNotes.length === 0) {
          tokenMatch = 'orig-empty';
        } else if (origNotes.length !== transNotes.length) {
          tokenMatch = 'count:' + origNotes.length + 'vs' + transNotes.length;
        } else {
          let namesOk = true, timingOk = true;
          for (let i = 0; i < origNotes.length; i++) {
            if (enh(origNotes[i].token) !== enh(transNotes[i].token)) { namesOk = false; break; }
            if (Math.abs(origNotes[i].start - transNotes[i].start) > 10 ||
                Math.abs(origNotes[i].end - transNotes[i].end) > 10) { timingOk = false; }
          }
          if (namesOk && timingOk) tokenMatch = 'exact';
          else if (namesOk) tokenMatch = 'timing-diff';
          else tokenMatch = 'names-diff';
        }

        result.stages.s6 = {
          origNotes: origNotes.length,
          transNotes: transNotes.length,
          origMidi: origMidiCount,
          match: tokenMatch,
          aux: auxLoaded
        };
      } catch (e6) {
        result.stages.s6 = { error: e6.message.substring(0, 80) };
      }
    }

    console.log(JSON.stringify(result));
  } catch(e) {
    result.error = e.message.substring(0, 120);
    console.log(JSON.stringify(result));
  }
}).catch(e => console.log(JSON.stringify({ error: e.message.substring(0, 120) })));
`.trim();
}

// ── Main ──
const scenes = readdirSync(SCENES_DIR).filter(f => f.endsWith('.bps')).sort();
let pass = 0, fail = 0, skip = 0, warn = 0;
const failures = [];
const warnings = [];

console.log(`\n=== WASM INTEGRATION TEST — ${scenes.length} scenes ===\n`);

for (const file of scenes) {
  const name = file.replace('.bps', '');

  if (WASM_SKIP.has(name)) {
    console.log(`  SKIP  ${name}  (engine limitation)`);
    skip++;
    continue;
  }

  const origPath = ORIGINAL_MAP[name] || null;
  const script = buildChildScript(file, origPath);

  let result;
  try {
    const out = execSync(`node -e '${script.replace(/'/g, "'\\''")}'`, {
      cwd: DIST_DIR,
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    }).toString().trim();

    const jsonLine = out.split('\n').filter(l => l.startsWith('{')).pop();
    if (!jsonLine) {
      result = { error: 'no JSON output' };
    } else {
      result = JSON.parse(jsonLine);
    }
  } catch (e) {
    const stderr = e.stderr?.toString() || '';
    const stdout = e.stdout?.toString() || '';
    // On timeout, try to recover S1-S5 results (S6 may have caused the timeout)
    if (e.killed || (e.message || '').includes('ETIMEDOUT')) {
      const jsonLine = stdout.split('\n').filter(l => l.startsWith('{')).pop();
      if (jsonLine) {
        try {
          const partial = JSON.parse(jsonLine);
          if (partial._s5done) {
            // S1-S5 succeeded, S6 timed out — report S6 as timeout, not scene FAIL
            partial.stages.s6 = { error: 'S6 timeout (original too complex)' };
            result = partial;
          }
        } catch {}
      }
    }
    if (!result) {
      const errMsg = stderr.includes('Maximum call stack')
        ? 'WASM stack overflow'
        : stderr.includes('memory access out of bounds')
        ? 'WASM memory overflow'
        : (e.message || '').substring(0, 80);
      result = { error: errMsg };
    }
  }

  // Format output
  if (result.error) {
    console.log(`  FAIL  ${name}`);
    console.log(`        crash: ${result.error}`);
    fail++;
    failures.push({ name, error: result.error });
  } else {
    const s = result.stages;
    if (!s.s1?.ok) {
      console.log(`  FAIL  ${name}  S1-transpile: ${s.s1.err}`);
      fail++; failures.push({ name, error: `S1: ${s.s1.err}` });
    } else if (!s.s2?.ok) {
      console.log(`  FAIL  ${name}  S2-bolsize: ${s.s2.err}`);
      fail++; failures.push({ name, error: `S2: ${s.s2.err}` });
    } else if (!s.s3?.ok) {
      console.log(`  FAIL  ${name}  S3-wasm: ${s.s3.err}`);
      fail++; failures.push({ name, error: `S3: ${s.s3.err}` });
    } else if (!s.s4?.ok) {
      console.log(`  FAIL  ${name}  S4-tokens: ${s.s4.err}`);
      fail++; failures.push({ name, error: `S4: ${s.s4.err}` });
    } else {
      const unres = s.s5?.unresolved?.length || 0;
      if (unres > 0 && RESOLVER_KNOWN[name]) {
        console.log(`  WARN  ${name}  S5-resolve: ${unres} unresolved: ${s.s5.unresolved.join(', ')}  (${RESOLVER_KNOWN[name]})`);
        warn++;
        warnings.push({ name, reason: RESOLVER_KNOWN[name], unresolved: s.s5.unresolved });
      } else if (unres > 0) {
        console.log(`  FAIL  ${name}  S5-resolve: ${unres} unresolved: ${s.s5.unresolved.join(', ')}`);
        fail++;
        failures.push({ name, error: `S5: ${unres} unresolved: ${s.s5.unresolved.join(', ')}` });
      } else {
        // S6 conformity info
        const s6 = s.s6;
        let conf = '';
        if (s6 && !s6.error) {
          conf = ` S6:${s6.match}`;
          if (s6.match.startsWith('count:') || s6.match === 'names-diff' || s6.match === 'timing-diff') {
            conf += ` (orig:${s6.origNotes} trans:${s6.transNotes})`;
          }
          if (s6.match === 'orig-empty' && s6.origMidi > 0) {
            conf += ` (midi:${s6.origMidi})`;
          }
          if (s6.aux?.length) conf += ` [${s6.aux.join('+')}]`;
        } else if (s6?.error) {
          conf = ` S6:err`;
        }
        // S2 extras
        const s2w = s.s2?.warnings?.length ? ` S2w:${s.s2.warnings.join(',')}` : '';
        const s2d = s.s2?.deps?.length ? ` deps:${s.s2.deps.join(',')}` : '';
        console.log(`  OK    ${name}  [${s.s4.count} tokens, ${s.s2.count} terminals${conf}${s2d}${s2w}]`);
        pass++;
      }
    }
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`${pass} OK, ${fail} FAIL, ${warn} WARN, ${skip} SKIP / ${scenes.length} total`);

if (warnings.length > 0) {
  console.log(`\nKnown unresolved (WARN):`);
  for (const w of warnings) {
    console.log(`  ${w.name}: ${w.unresolved.join(', ')}  — ${w.reason}`);
  }
}

if (failures.length > 0) {
  console.log(`\nFailing scenes:`);
  for (const f of failures) {
    console.log(`  ${f.name}: ${f.error}`);
  }
  process.exit(1);
}
