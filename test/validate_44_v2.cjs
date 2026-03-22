#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCENES = path.join(__dirname, '..', 'scenes');
const TD = path.join(__dirname, '..', '..', 'bp3-engine', 'test-data');

const MAP = {
  '765432':'765432','acceleration':'acceleration','ames':'Ames',
  'asymmetric':'asymmetric1','beatrix-dice':'Beatrix','csound':'tryCsound',
  'destru':'tryDESTRU','dhati':'dhati','dhin':'dhin--','drum':'drum',
  'ek-do-tin':'12345678','flags':'tryFlags','graphics':'tryGraphics',
  'harmony':'tryHarmony','koto3':'koto3','kss2':'kss2',
  'livecode1':'livecode1','livecode2':'livecode2','look-and-say':'look-and-say',
  'major-minor':'tryMajorMinor','mohanam':'trial.mohanam','mozart-dice':'Mozart',
  'nadaka':'Nadaka','negative-context':'checkNegativeContext','not-reich':'NotReich',
  'one-scale':'tryOneScale','repeat':'tryrepeat','ruwet':'Ruwet',
  'scales':'tryScales','shapes-rhythm':'ShapesInRhythm','templates':'checktemplates',
  'time-patterns':'tryTimePatterns','transposition':'tryTranspose',
  'tunings':'tryTunings','vina':'vina','vina2':'vina2','vina3':'vina3',
  'visser-shapes':'Visser.Shapes','visser-waves':'Visser.Waves',
  'visser3':'Visser3','visser5':'Visser5','watch':'Watch_What_Happens',
  'alan-dice':'Alan','all-items':'tryAllItems'
};
const RANDOM = new Set(['alan-dice','beatrix-dice','mozart-dice','nadaka']);

function convertOldSettings(c) {
  const l=c.split('\n'); if(l.length<12)return null;
  const n=(i)=>{const v=parseFloat((l[i-1]||'').trim());return isNaN(v)?null:v;};
  const o={}; const a=(k,nm,i)=>{const v=n(i);if(v!==null)o[k]={name:nm,value:String(v),boolean:"0"};};
  a("NoteConvention","Note convention",10);a("Quantization","Quantization",5);
  a("Time_res","Time resolution",6);a("Nature_of_time","Nature of time",9);
  a("Improvize","Improvize",33);
  if(l.length>=47)a("MaxConsoleTime","Max console time",47);
  if(l.length>=65)a("C4key","C4 key number",65);
  if(l.length>=66)a("A4freq","A4 frequency",66);
  return o.NoteConvention?JSON.stringify(o):null;
}

function run(script, timeout) {
  try {
    const out = execSync(`node ${script}`, { timeout: timeout || 60000, encoding:'utf-8', stdio:['pipe','pipe','pipe'] });
    const json = out.trim().split('\n').filter(l=>l.startsWith('{')).pop();
    return json ? JSON.parse(json) : { crash:'no output' };
  } catch(e) {
    if(e.killed) return { crash:'TIMEOUT' };
    if(e.status===null) return { crash:'SIGSEGV' };
    return { crash:`exit${e.status}` };
  }
}

const results = [];

for (const [scene, grName] of Object.entries(MAP)) {
  const grFile = path.join(TD, `-gr.${grName}`);
  const bpsFile = path.join(SCENES, `${scene}.bps`);
  if (!fs.existsSync(grFile) || !fs.existsSync(bpsFile)) {
    results.push({scene, status:'SKIP', detail:'files missing'});
    continue;
  }

  // Prepare original aux files
  const gr = fs.readFileSync(grFile, 'utf-8');
  const seMatch = gr.match(/-se\.(\S+)/);
  const alMatch = gr.match(/-al\.(\S+)/);
  const hoMatch = gr.match(/-ho\.(\S+)/);
  const toMatch = gr.match(/-to\.(\S+)/);

  let seContent = '';
  if (seMatch) {
    const sf = path.join(TD, `-se.${seMatch[1]}`);
    if (fs.existsSync(sf)) {
      let s = fs.readFileSync(sf, 'utf-8');
      if (!s.trim().startsWith('{')) s = convertOldSettings(s) || '';
      seContent = s;
    }
  }
  const alName = alMatch ? alMatch[1] : (hoMatch ? hoMatch[1] : null);
  let alContent = '';
  if (alName) {
    const af = path.join(TD, `-al.${alName}`);
    if (fs.existsSync(af)) alContent = fs.readFileSync(af, 'utf-8');
  }
  let toContent = '';
  if (toMatch) {
    const tf = path.join(TD, `-to.${toMatch[1]}`);
    if (fs.existsSync(tf)) toContent = fs.readFileSync(tf, 'utf-8');
  }

  fs.writeFileSync('/tmp/_v44_gr.txt', gr);
  fs.writeFileSync('/tmp/_v44_se.txt', seContent);
  fs.writeFileSync('/tmp/_v44_al.txt', alContent);
  fs.writeFileSync('/tmp/_v44_to.txt', toContent);

  // Compile BPS
  let transGr = '', transAl = '';
  try {
    const compOut = execSync(
      `node --input-type=module -e "import{compileBPS}from'./src/transpiler/index.js';import{readFileSync,writeFileSync}from'fs';const r=compileBPS(readFileSync('${bpsFile.replace(/\\/g,'\\\\')}','utf8'));writeFileSync('/tmp/_v44_tgr.txt',r.grammar||'');writeFileSync('/tmp/_v44_tal.txt',r.alphabetFile||r.alphabet||'');if(r.errors&&r.errors.length)process.stderr.write(r.errors[0].message||'err');"`,
      { cwd: path.join(__dirname, '..'), timeout: 10000, encoding:'utf-8', stdio:['pipe','pipe','pipe'] }
    );
  } catch(e) {
    results.push({scene, status:'COMPILE_ERR', detail:(e.stderr||e.message||'').substring(0,60)});
    continue;
  }

  // Run original
  const orig = run(path.join(__dirname, '_run_orig.cjs'), 60000);

  // Run transpiled
  const trans = run(path.join(__dirname, '_run_trans.cjs'), 60000);

  // Compare
  if (orig.crash && trans.crash) {
    results.push({scene, status:'BOTH_CRASH', detail:`orig:${orig.crash} trans:${trans.crash}`});
  } else if (orig.crash) {
    results.push({scene, status:'ORIG_CRASH', detail:`${orig.crash} (trans: r=${trans.r} tokens=${trans.tokens||trans.tc})`});
  } else if (trans.crash) {
    results.push({scene, status:'TRANS_CRASH', detail:`${trans.crash} (orig: r=${orig.r} midi=${orig.midi} notes=${(orig.notes||[]).length})`});
  } else if (RANDOM.has(scene)) {
    results.push({scene, status:'RANDOM', detail:`orig:${(orig.notes||[]).length}notes trans:${trans.tokens||0}tokens (seeds differ)`});
  } else if (orig.r === 1 && trans.r === 1) {
    const on = (orig.notes||[]).length;
    const tt = trans.tokens || 0;
    if (on > 0 && tt > 0) {
      results.push({scene, status:'OK_BOTH_PRODUCE', detail:`orig:${on}notes/${orig.midi}midi trans:${tt}tokens`});
    } else if (on > 0 && tt === 0) {
      results.push({scene, status:'TRANS_EMPTY', detail:`orig:${on}notes trans:0tokens`});
    } else if (on === 0 && tt > 0) {
      results.push({scene, status:'ORIG_NO_MIDI', detail:`orig:text="${orig.text}" trans:${tt}tokens`});
    } else {
      // Both produced but no MIDI and no tokens — compare text
      if (orig.text && trans.text && orig.text.substring(0,60) === trans.text.substring(0,60)) {
        results.push({scene, status:'OK_TEXT_MATCH', detail:`"${orig.text.substring(0,50)}"`});
      } else {
        results.push({scene, status:'TEXT_DIFF', detail:`orig:"${(orig.text||'').substring(0,40)}" trans:"${(trans.text||'').substring(0,40)}"`});
      }
    }
  } else if (orig.r === 0 && trans.r === 0) {
    results.push({scene, status:'BOTH_MISS', detail:'both r=0'});
  } else if (orig.r === 0) {
    results.push({scene, status:'ORIG_MISS', detail:`orig:r=0 trans:r=${trans.r} tokens=${trans.tokens||0}`});
  } else {
    results.push({scene, status:'DIFF', detail:`orig:r=${orig.r} errs=${orig.errs} trans:r=${trans.r} errs=${trans.errs}`});
  }
}

console.log('\n=== VALIDATION 44 SCENES ===\n');
for (const r of results) {
  const icon = r.status.startsWith('OK') ? '✅' :
    r.status === 'RANDOM' ? '🎲' :
    r.status.includes('CRASH') ? '💥' :
    r.status.includes('MISS') ? '⚠️' :
    r.status.includes('ERR') || r.status.includes('DIFF') || r.status.includes('EMPTY') ? '❌' : '⚠️';
  console.log(`${icon} ${r.scene.padEnd(18)} ${r.status.padEnd(20)} ${r.detail || ''}`);
}

const counts = {};
for (const r of results) counts[r.status] = (counts[r.status]||0)+1;
console.log('\n=== SUMMARY ===');
for (const [k,v] of Object.entries(counts).sort((a,b)=>b[1]-a[1]))
  console.log(`  ${k}: ${v}`);
console.log(`  TOTAL: ${results.length}`);
