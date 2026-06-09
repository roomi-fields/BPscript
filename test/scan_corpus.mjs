/**
 * Scan corpus bp3-engine/test-data/ — classifie chaque grammaire -gr.* en :
 *   FIDÈLE         : round-trip compileBPS(bp3ToScene(gr)).grammar ≡ gr
 *   DIFFÈRE:cause  : diffère, cause identifiée
 *   NON GÉRÉ:cause : construct BP3 non représentable en BPscript
 *
 * Interface bp3ToScene : retourne une string.
 *   - Commence par "NON GÉRÉ:" → non géré
 *   - Sinon → BPS source à compiler
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { bp3ToScene } from '../src/transpiler/bp3ToScene.js';
import { compileBPS } from '../src/transpiler/index.js';

const TEST_DATA = '/home/romi/dev/bp/BPscript/bp3-engine/test-data';

// ---- extractSignificant : normalise deux grammaires pour comparaison ----
function extractSignificant(raw) {
  raw = raw.replace(/_mm\((\d+)\.0+\)/g, '_mm($1)');
  raw = raw.replace(/\(= /g, '(=').replace(/\(: /g, '(:');
  // Normaliser les gardes avec espaces : /flag = val/ → /flag=val/
  raw = raw.replace(/\/([A-Za-z_][A-Za-z0-9_]*)\s*([=+\-><]+)\s*([^\s/][^/]*?)\s*\//g, '/$1$2$3/');
  // Normaliser les espaces autour de '.' (période) : C4 . C5 → C4.C5
  raw = raw.replace(/\s+\.\s+/g, '.');
  // Normaliser les tabs en espaces et les espaces multiples
  raw = raw.replace(/\t+/g, ' ');
  raw = raw.replace(/ {2,}/g, ' ');
  // Normaliser les espaces autour de (= ...) templates collés: supprimer les espaces entre ) et (
  raw = raw.replace(/\)\s+\(/g, ')(');
  // Normaliser l'espace après ',' dans les polymetries {N, A B} → {N,A B}
  raw = raw.replace(/,\s+/g, ',');
  // Normaliser casse gram# / GRAM#
  raw = raw.replace(/\bGRAM#/g, 'gram#');
  const lines = raw.split('\n');
  const out = [];
  for (let line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('//') || t.startsWith(';')) continue;
    if (/^\s*-[a-z]{2}\./.test(t)) continue; // -se. -al. -ho. etc.
    if (t === 'TEMPLATES:' || t === 'TIMEPATTERNS:') continue;
    if (/^-{3,}$/.test(t)) { out.push('------------'); continue; }
    // Ignorer lignes de version BP2 (V.N, V.N.N) et dates BP2
    if (/^V\.\d/.test(t)) continue;
    if (/^Date:/.test(t)) continue;
    if (/^-?-(al|se|ho|gl|to|md|cs)\./i.test(t)) continue;
    // Supprimer annotations libres fin de ligne
    let cleaned = t.replace(/\s+\[[A-Z][^\]]*\]\s*$/, '');
    // Normaliser annotation libre en tête de ligne (sans mode)
    if (/^\[.*\]$/.test(cleaned)) continue;
    out.push(cleaned);
  }
  return out.join('\n');
}

// ---- classify diff between two normalized grammar strings ----
function classifyDiff(orig, produced) {
  const oLines = orig.split('\n');
  const pLines = produced.split('\n');
  for (let i = 0; i < Math.max(oLines.length, pLines.length); i++) {
    const o = (oLines[i] || '').trim();
    const p = (pLines[i] || '').trim();
    if (o !== p) {
      if (!p && o) return 'MISSING';
      if (!o && p) return 'EXTRA';
      if (o.replace(/\s+/g, '') === p.replace(/\s+/g, '')) return 'PLUS_SPACING';
      if (o.replace(/\(=\s*/g, '(=').replace(/\(:\s*/g, '(:') === p) return 'TEMPLATE_SPACE';
      return 'FORMAT';
    }
  }
  return 'EXACT';
}

const files = readdirSync(TEST_DATA).filter(f => f.startsWith('-gr.')).sort();

const counts = { FIDÈLE: 0, DIFFÈRE: {}, NON_GÉRÉ: {} };
const rows = [];

for (const fname of files) {
  const grPath = join(TEST_DATA, fname);
  const grammarText = readFileSync(grPath, 'utf-8');
  const name = fname.replace(/^-gr\./, '');

  const result = bp3ToScene(grammarText);

  if (typeof result === 'string' && result.startsWith('NON GÉRÉ:')) {
    // Extract short cause key
    const reason = result.slice('NON GÉRÉ: '.length);
    // Extract first phrase before '(' or end
    const causeKey = reason.replace(/\s*\(.*$/, '').substring(0, 60);
    counts.NON_GÉRÉ[causeKey] = (counts.NON_GÉRÉ[causeKey] || 0) + 1;
    rows.push({ name, status: 'NON GÉRÉ', detail: reason.substring(0, 80) });
    continue;
  }

  const bpsSource = typeof result === 'string' ? result : String(result);

  // Try to compile back
  let compiled;
  try {
    compiled = compileBPS(bpsSource);
  } catch (e) {
    const key = 'EXCEPTION: ' + e.message.substring(0, 40);
    counts.DIFFÈRE[key] = (counts.DIFFÈRE[key] || 0) + 1;
    rows.push({ name, status: 'DIFFÈRE', detail: 'EXCEPTION: ' + e.message.substring(0, 60) });
    continue;
  }

  if (compiled.errors && compiled.errors.length > 0) {
    const msg = compiled.errors[0].message || '';
    const key = 'COMPILE_ERROR: ' + msg.substring(0, 40);
    counts.DIFFÈRE[key] = (counts.DIFFÈRE[key] || 0) + 1;
    rows.push({ name, status: 'DIFFÈRE', detail: 'COMPILE_ERROR: ' + msg.substring(0, 60) });
    continue;
  }

  const origSig = extractSignificant(grammarText);
  const prodSig = extractSignificant(compiled.grammar);

  if (origSig === prodSig) {
    counts.FIDÈLE++;
    rows.push({ name, status: 'FIDÈLE', detail: '' });
  } else {
    const cause = classifyDiff(origSig, prodSig);
    counts.DIFFÈRE[cause] = (counts.DIFFÈRE[cause] || 0) + 1;
    // Show first diff line
    const oLines = origSig.split('\n');
    const pLines = prodSig.split('\n');
    let firstDiff = '';
    for (let i = 0; i < Math.max(oLines.length, pLines.length); i++) {
      if ((oLines[i] || '') !== (pLines[i] || '')) {
        firstDiff = `L${i+1}: orig="${(oLines[i]||'').substring(0,35)}" prod="${(pLines[i]||'').substring(0,35)}"`;
        break;
      }
    }
    rows.push({ name, status: `DIFFÈRE:${cause}`, detail: firstDiff });
  }
}

// ---- print table ----
const W1 = 30, W2 = 20, W3 = 80;
const pad = (s, w) => String(s).padEnd(w);
console.log('\n' + pad('Grammaire', W1) + pad('Statut', W2) + 'Détail');
console.log('-'.repeat(W1 + W2 + W3));
for (const r of rows) {
  console.log(pad(r.name, W1) + pad(r.status, W2) + r.detail.substring(0, W3));
}

// ---- summary ----
console.log('\n=== RÉSUMÉ ===');
const totalDiffere = Object.values(counts.DIFFÈRE).reduce((a, b) => a + b, 0);
const totalNonGere = Object.values(counts.NON_GÉRÉ).reduce((a, b) => a + b, 0);
console.log(`FIDÈLE:    ${counts.FIDÈLE}/${files.length}`);
console.log(`DIFFÈRE:   ${totalDiffere}/${files.length}`);
for (const [k, v] of Object.entries(counts.DIFFÈRE)) {
  console.log(`  ${String(v).padStart(3)}x  ${k.substring(0, 80)}`);
}
console.log(`NON GÉRÉ:  ${totalNonGere}/${files.length}`);
for (const [k, v] of Object.entries(counts.NON_GÉRÉ)) {
  console.log(`  ${String(v).padStart(3)}x  ${k.substring(0, 80)}`);
}
