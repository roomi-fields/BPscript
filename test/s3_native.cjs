#!/usr/bin/env node
/**
 * s3_native.cjs — Confirmation de parité : timed-tokens NATIF (--tokensout) vs
 * oracle WASM existant (snapshots/s3_timed.json).
 *
 * LECTURE SEULE : ne réécrit JAMAIS de snapshot. Sert à valider le sérialiseur
 * natif --tokensout (TokensOut.c) introduit dans le moteur (oracle = bp3 natif,
 * decisions/2026-06-14-oracle-natif-trois-voies.md). La RE-GÉNÉRATION des oracles
 * est séquencée APRÈS le fix moteur (#48-#52) — pas ici.
 *
 * Invocation moteur identique à s1_native.cjs (mêmes réglages, convention, aux),
 * mais émet les timed-tokens au lieu du MIDI. Utilise le bp3 fraîchement compilé
 * (bp3-engine/bp3) qui porte le flag --tokensout.
 *
 * Usage: node s3_native.cjs <grammar|--all>
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BP3_DIR = path.resolve(ROOT, '..', 'bp3-engine');
const TD = path.resolve(BP3_DIR, 'test-data');
const BP3 = path.resolve(BP3_DIR, 'bp3');   // build natif en place (porte --tokensout)
const GRAMMARS = require('./grammars/grammars.json');

// Old BP2 positional settings → JSON (copie de s1_native.cjs)
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
  const set = (k, nm, pos, bool, unit) => {
    const val = v(pos); if (val === null) return;
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
  return o.NoteConvention ? JSON.stringify(o) : null;
}

// Construit les args moteur (iso s1_native) + --tokensout, lance, renvoie les tokens.
function runNative(name) {
  const gramDef = GRAMMARS[name];
  if (!gramDef || gramDef.status === 'excluded') return null;
  const grName = gramDef.bernard || name;
  const grFile = path.join(TD, `-gr.${grName}`);
  if (!fs.existsSync(grFile)) return { error: `grammaire absente: ${grFile}` };

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

  const tmpGrammar = path.join('/tmp', `_s3_${name}_grammar.txt`);
  const tmpTokens = path.join('/tmp', `_s3_${name}_tokens.json`);
  const tmpMidi = path.join('/tmp', `_s3_${name}.mid`);
  const tmpSettings = path.join('/tmp', `_s3_${name}_se.json`);
  fs.writeFileSync(tmpGrammar, grClean);

  const baseArgs = ['produce', '-e', '-gr', tmpGrammar, '--seed', '1'];
  const grNoComments = grClean.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  const hasFrench = /\b(do|re|mi|fa|sol|la|si)\d\b/.test(grNoComments);
  const hasIndian = /\b(sa|ga)\d\b/.test(grNoComments);
  if (hasIndian) baseArgs.push('--indian');
  else if (hasFrench) baseArgs.push('--french');

  function loadSettings(seFile) {
    if (!fs.existsSync(seFile)) return null;
    const seContent = fs.readFileSync(seFile, 'utf-8').trim();
    let seObj = null;
    if (seContent.startsWith('{')) { try { seObj = JSON.parse(seContent); } catch (e) {} }
    else {
      const converted = convertOldSettings(seContent);
      if (converted) {
        seObj = JSON.parse(converted);
        const nc = hasIndian ? '2' : hasFrench ? '1' : '0';
        seObj.NoteConvention = { name: "Note convention", value: nc, boolean: '0' };
      }
    }
    if (!seObj) return null;
    seObj.ShowGraphic = { name: "Show graphic", value: "0" };
    seObj.ShowPianoRoll = { name: "Show piano roll", value: "0" };
    seObj.ShowObjectGraph = { name: "Show object graph", value: "0" };
    if (seObj.GraphicScaleP) seObj.GraphicScaleP.value = '0';
    if (seObj.GraphicScaleQ) seObj.GraphicScaleQ.value = '0';
    if (seObj.DisplayItems) seObj.DisplayItems.value = '1';
    seObj.TraceProduce = { name: "Trace production", value: "0", boolean: "1" };
    for (const [k, val] of Object.entries(gramDef.se_overrides || {})) {
      if (k === '_comment') continue;
      if (seObj[k]) seObj[k].value = String(val); else seObj[k] = { name: k, value: String(val) };
    }
    fs.writeFileSync(tmpSettings, JSON.stringify(seObj));
    return tmpSettings;
  }

  const explicitFlags = new Set();
  if (gramDef.s1_args && gramDef.s1_args.length > 0) {
    for (let i = 0; i < gramDef.s1_args.length; i++) {
      const arg = gramDef.s1_args[i];
      if (arg.startsWith('-') && !arg.startsWith('--')) {
        explicitFlags.add(arg);
        if (i + 1 < gramDef.s1_args.length) {
          const file = gramDef.s1_args[i + 1];
          const resolved = file.startsWith('/') ? file : path.join(TD, file);
          i++;
          if (arg === '-se') { const c = loadSettings(resolved); if (c) baseArgs.push('-se', c); }
          else baseArgs.push(arg, resolved);
        } else baseArgs.push(arg);
      } else baseArgs.push(arg);
    }
  }
  if (!explicitFlags.has('-se')) {
    const m = gr.match(/-se\.(\S+)/);
    if (m) { const c = loadSettings(path.join(TD, `-se.${m[1]}`)); if (c) baseArgs.push('-se', c); }
  }
  if (!explicitFlags.has('-al')) {
    const m = gr.match(/-al\.(\S+)/);
    if (m) { const f = path.join(TD, `-al.${m[1]}`); if (fs.existsSync(f)) baseArgs.push('-al', f); }
    else {
      const h = gr.match(/-ho\.(\S+)/);
      if (h) { const alF = path.join(TD, `-al.${h[1]}`); if (fs.existsSync(alF)) baseArgs.push('-al', alF); }
    }
  }
  if (!explicitFlags.has('-to')) {
    const m = gr.match(/-to\.(\S+)/);
    if (m) { const f = path.join(TD, `-to.${m[1]}`); if (fs.existsSync(f)) baseArgs.push('-to', f); }
  }

  for (const f of [tmpTokens, tmpMidi]) { try { fs.unlinkSync(f); } catch (e) {} }
  const args = [...baseArgs, '--midiout', tmpMidi, '--tokensout', tmpTokens];
  try {
    execSync(`"${BP3}" ${args.join(' ')}`, { cwd: BP3_DIR, timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) { /* le moteur peut écrire avant un code non-zéro */ }

  let toks = null;
  if (fs.existsSync(tmpTokens)) { try { toks = JSON.parse(fs.readFileSync(tmpTokens, 'utf-8')); } catch (e) {} }
  for (const f of [tmpGrammar, tmpTokens, tmpMidi, tmpSettings]) { try { fs.unlinkSync(f); } catch (e) {} }
  return { tokens: toks };
}

function compareToOracle(name, nativeToks) {
  const gd = GRAMMARS[name];
  const s3 = path.join(__dirname, 'grammars', name, 'snapshots', 's3_timed.json');
  if (!fs.existsSync(s3)) return { status: 'NO_ORACLE' };
  const oracle = JSON.parse(fs.readFileSync(s3, 'utf-8')).tokens;
  // Mode texte : l'oracle s3 stocke des timings nuls (tokens texte) — pas comparable
  // aux timed-tokens MIDI. Skip honnête.
  if ((gd && gd.production_mode === 'text') || oracle.every(t => t[1] === 0 && t[2] === 0))
    return { status: 'SKIP_TEXT' };
  if (!Array.isArray(nativeToks)) return { status: 'NO_NATIVE' };
  if (nativeToks.length !== oracle.length)
    return { status: 'DIFF', detail: `longueur ${nativeToks.length} natif vs ${oracle.length} oracle` };
  for (let i = 0; i < oracle.length; i++) {
    const [on, os, oe] = oracle[i];
    const t = nativeToks[i];
    if (t.token !== on || t.start !== os || t.end !== oe)
      return { status: 'DIFF', detail: `tok ${i}: natif {${t.token},${t.start},${t.end}} vs oracle {${on},${os},${oe}}` };
  }
  return { status: 'MATCH', n: oracle.length };
}

// Main
const arg = process.argv[2];
if (!arg) { console.error('Usage: node s3_native.cjs <grammar|--all>'); process.exit(1); }
if (!fs.existsSync(BP3)) { console.error(`bp3 natif frais introuvable: ${BP3} (lance ./build.sh linux)`); process.exit(1); }

const names = arg === '--all'
  ? Object.entries(GRAMMARS).filter(([k, v]) => v.status === 'active' && v.php_ref && (v.production_mode || 'midi') === 'midi').map(([k]) => k)
  : [arg];

// Exclusions parité : build buggé (#48-#52) + watch (lent, #50)
const EXCLUDE = new Set(['765432', 'look-and-say', 'watch']);

let match = 0, diff = 0, skip = 0, other = 0;
for (const name of names) {
  if (EXCLUDE.has(name)) { console.log(`  ${name}: EXCLU (#48-#52 / lent)`); skip++; continue; }
  // Skip mode texte avant même de lancer le moteur
  const gd = GRAMMARS[name];
  if (gd && gd.production_mode === 'text') { console.log(`  ${name}: SKIP (mode texte)`); skip++; continue; }
  const r = runNative(name);
  if (!r) { console.log(`  ${name}: SKIP (exclue/inconnue)`); other++; continue; }
  if (r.error) { console.log(`  ${name}: ${r.error}`); other++; continue; }
  const c = compareToOracle(name, r.tokens);
  if (c.status === 'MATCH') { console.log(`  ${name}: MATCH (${c.n})`); match++; }
  else if (c.status === 'DIFF') { console.log(`  ${name}: DIFF — ${c.detail}`); diff++; }
  else if (c.status === 'SKIP_TEXT') { console.log(`  ${name}: SKIP (oracle texte/nul)`); skip++; }
  else { console.log(`  ${name}: ${c.status}`); other++; }
}
if (names.length > 1) console.log(`\nParité timing natif↔WASM (s3_timed) : ${match} MATCH, ${diff} DIFF, ${skip} skip, ${other} autre (sur ${names.length})`);
