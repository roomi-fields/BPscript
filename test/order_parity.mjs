// order_parity.mjs — Validation de PARITÉ texte « ordre-à-ordre ».
//
// Capture la sortie canonique NATIVE (`bp3 … -o`) pour les grammaires TEXTE,
// la tokenise avec l'utilitaire d'ordre PARTAGÉ (src/transpiler/orderTokens.js),
// et la compare jeton-à-jeton à l'oracle WASM gelé (s3_timed.json, reconstruit en
// rejoignant ses jetons par espaces — le brut WASM = split(' ') de la même chaîne).
//
// LECTURE SEULE : ne réécrit aucun snapshot. Sert à VALIDER la voie avant tout
// branchement (gate Romain). Référence : hub/constats/2026-06-16-voie-texte-ordre.md.
//
// Usage : node test/order_parity.mjs [grammaire …]   (défaut : 3 cas de validation)

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenizeOrder } from '../src/transpiler/orderTokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BP3_DIR = path.resolve(ROOT, '..', 'bp3-engine');
const TD = path.resolve(BP3_DIR, 'test-data');
const BP3 = path.resolve(BP3_DIR, 'bp3');
const GRAMMARS = JSON.parse(fs.readFileSync(path.join(__dirname, 'grammars', 'grammars.json'), 'utf8'));

// Réglages BP2 positionnels → JSON (repris de s3_native.cjs, version compacte).
function convertOldSettings(c, conv) {
  const lines = c.split(/\r\n?|\n/);
  let hdr = 0;
  while (hdr < lines.length && lines[hdr].trim().startsWith('//')) hdr++;
  const vals = lines.slice(hdr);
  if (vals.length < 48) return null;
  const v = (p) => { const t = (vals[p] || '').trim(); if (!t || t.startsWith('/') || t.startsWith('<')) return null; return isNaN(parseFloat(t)) ? null : t; };
  const o = {};
  const set = (k, nm, p, b, u) => { const val = v(p); if (val === null) return; const e = { name: nm, value: val, boolean: b ? '1' : '0' }; if (u) e.unit = u; o[k] = e; };
  set('Quantization', 'Quantization', 2, false, 'ms'); set('Time_res', 'Time resolution', 3, false, 'ms');
  set('Improvize', 'Non-stop improvize', 10, true); set('MaxItemsProduce', 'Max items produced', 11, false);
  set('UseEachSub', 'Play each substitution', 12, true); set('AllItems', 'Produce all items', 13, true);
  set('MaxConsoleTime', 'Max computation time', 44, false, 'seconds'); set('Seed', 'Seed for randomization', 45, false);
  o.NoteConvention = { name: 'Note convention', value: conv, boolean: '0' };
  return o;
}

function buildEngineArgs(name, prodFile) {
  const gd = GRAMMARS[name];
  if (!gd || gd.status === 'excluded') return null;
  const grName = gd.bernard || name;
  const grFile = path.join(TD, `-gr.${grName}`);
  if (!fs.existsSync(grFile)) return null;

  // Normalisation des fins de ligne : certaines grammaires (ex. transposition3,
  // 1997) sont en CR Mac → sans normalisation, le moteur voit toute la grammaire
  // comme UNE ligne commentée (`//`) et ne produit rien. On écrit donc un temp
  // NORMALISÉ, mais DANS test-data, pour que les auxiliaires embarqués (-ho/-al)
  // se résolvent relativement à ce dossier (sinon ils sont introuvables).
  let gr = fs.readFileSync(grFile, 'utf8').replace(/\r\n?/g, '\n');
  const grNoC = gr.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const hasIndian = /\b(sa|ga)\d\b/.test(grNoC);
  const hasFrench = /\b(do|re|mi|fa|sol|la|si)\d\b/.test(grNoC);
  const conv = hasIndian ? '2' : hasFrench ? '1' : '0';

  const tmpGr = path.join(TD, `_ord_tmp_${name}.gr`);
  fs.writeFileSync(tmpGr, gr);
  const args = ['produce', '-e', '-gr', tmpGr, '--seed', '1'];
  if (hasIndian) args.push('--indian'); else if (hasFrench) args.push('--french');

  // -se / -al / -to depuis s1_args ou inférés
  const explicit = new Set();
  const pushSettings = (file) => {
    if (!fs.existsSync(file)) return;
    const raw = fs.readFileSync(file, 'utf8').trim();
    let obj = raw.startsWith('{') ? JSON.parse(raw) : convertOldSettings(raw, conv);
    if (!obj) return;
    obj.ShowGraphic = { name: 'Show graphic', value: '0' };
    obj.DisplayItems = { name: 'Display final score', value: '1', boolean: '1' };
    for (const [k, val] of Object.entries(gd.se_overrides || {})) { if (k === '_comment') continue; if (obj[k]) obj[k].value = String(val); else obj[k] = { name: k, value: String(val) }; }
    const tmpSe = path.join('/tmp', `_ord_${name}_se.json`);
    fs.writeFileSync(tmpSe, JSON.stringify(obj));
    args.push('-se', tmpSe);
  };
  if (gd.s1_args) {
    // s1_args = paires (drapeau, fichier). En BP3 les fichiers AUX commencent
    // aussi par `-` (ex. -so.abc) : un drapeau simple `-x` consomme TOUJOURS
    // l'élément suivant comme fichier. Seuls les `--xxx` sont des drapeaux nus.
    for (let i = 0; i < gd.s1_args.length; i++) {
      const a = gd.s1_args[i];
      if (a.startsWith('--')) { args.push(a); continue; }
      if (a.startsWith('-')) {
        explicit.add(a);
        if (i + 1 < gd.s1_args.length) {
          const f = gd.s1_args[++i];
          const r = f.startsWith('/') ? f : path.join(TD, f);
          if (a === '-se') pushSettings(r); else args.push(a, r);
        } else args.push(a);
      } else args.push(a);
    }
  }
  if (!explicit.has('-se') && gd.php_ref?.settings) { const m = gd.php_ref.settings.match(/-se\.(\S+)/); if (m) pushSettings(path.join(TD, `-se.${m[1]}`)); }
  if (!explicit.has('-al') && gd.php_ref?.alphabet) { const m = gd.php_ref.alphabet.match(/-al\.(\S+)/); if (m) { const f = path.join(TD, `-al.${m[1]}`); if (fs.existsSync(f)) args.push('-al', f); } }

  args.push('-o', prodFile);
  return args;
}

function nativeOrder(name) {
  const prodFile = path.join('/tmp', `_ord_${name}_prod.txt`);
  try { fs.unlinkSync(prodFile); } catch {}
  const args = buildEngineArgs(name, prodFile);
  if (!args) return { error: 'args' };
  try { execSync(`"${BP3}" ${args.map((a) => `"${a}"`).join(' ')}`, { cwd: BP3_DIR, timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] }); } catch {}
  try { fs.unlinkSync(path.join(TD, `_ord_tmp_${name}.gr`)); } catch {} // temp grammaire normalisée
  if (!fs.existsSync(prodFile)) return { error: 'no output' };
  const canonical = fs.readFileSync(prodFile, 'utf8').trim();
  return { canonical, tokens: tokenizeOrder(canonical) };
}

function wasmOrder(name) {
  const p = path.join(__dirname, 'grammars', name, 'snapshots', 's3_timed.json');
  if (!fs.existsSync(p)) return null;
  const raw = JSON.parse(fs.readFileSync(p, 'utf8')).tokens.map((t) => t[0]).join(' ');
  return { raw, tokens: tokenizeOrder(raw) };
}

// Pose l'oracle natif d'ORDRE texte. Anti-dégénéré : refuse 0 jeton ou majorité de
// noms vides (gamme invalide). Format aligné sur s3_native.cjs (midi) : mode 'text',
// timings nuls (l'ordre EST l'information).
function writeTextOracle(name, tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return 'VIDE (non écrit)';
  const empty = tokens.filter((t) => !t || t === '').length;
  if (empty > tokens.length / 2) return `DÉGÉNÉRÉ (${empty}/${tokens.length} noms vides, non écrit)`;
  const dir = path.join(__dirname, 'grammars', name, 'snapshots');
  if (!fs.existsSync(dir)) return 'PAS DE DOSSIER snapshots';
  const snap = {
    source: 'native -o (bp3 Linux, production canonique ordonnée)',
    stage: 's3_native',
    mode: 'text',
    tokens: tokens.map((t) => [t, 0, 0]),
    date: '2026-06-16',
  };
  fs.writeFileSync(path.join(dir, 's3_native.json'), JSON.stringify(snap, null, 2));
  return `écrit (${tokens.length} jetons)`;
}

const argv = process.argv.slice(2);
const DO_WRITE = argv.includes('--write');     // pose s3_native si parité OK
const FORCE = argv.includes('--force');         // pose le natif même si DIFF (natif fait foi)
const targets = argv.filter((a) => !a.startsWith('--'));
const names = targets.length ? targets : ['flags', 'negative-context', 'ek-do-tin'];

let pass = 0, fail = 0;
console.log(`=== Parité texte ORDRE-à-ORDRE (natif -o  vs  oracle WASM, tokeniseur partagé)${DO_WRITE ? '  [--write]' : ''}${FORCE ? '  [--force natif fait foi]' : ''} ===\n`);
for (const name of names) {
  const nat = nativeOrder(name);
  const wasm = wasmOrder(name);
  if (nat.error) { console.log(`  ${name}: ÉCHEC natif (${nat.error})`); fail++; continue; }
  const a = nat.tokens;
  if (!wasm) {
    if (DO_WRITE && FORCE) console.log(`  ${name}: pas d'oracle WASM → ${writeTextOracle(name, a)}`);
    else { console.log(`  ${name}: pas d'oracle WASM`); fail++; }
    continue;
  }
  const b = wasm.tokens;
  let diff = -1;
  const m = Math.max(a.length, b.length);
  for (let i = 0; i < m; i++) { if (a[i] !== b[i]) { diff = i; break; } }
  if (diff === -1) {
    const w = DO_WRITE ? ` → ${writeTextOracle(name, a)}` : '';
    console.log(`  ${name}: OK — ${a.length} jetons, ordre identique${w}`); pass++;
  } else {
    if (DO_WRITE && FORCE) { console.log(`  ${name}: DIFF @${diff} (natif fait foi) → ${writeTextOracle(name, a)}`); }
    else { console.log(`  ${name}: DIFF @${diff} — natif=${JSON.stringify(a[diff])} wasm=${JSON.stringify(b[diff])} (len natif=${a.length} wasm=${b.length})`); fail++; }
  }
}
console.log(`\n${pass} OK / ${fail} DIFF sur ${names.length}`);
process.exit(fail ? 1 : 0);
