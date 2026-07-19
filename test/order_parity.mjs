// order_parity.mjs — Validation de PARITÉ texte « ordre-à-ordre ».
//
// Capture la sortie canonique NATIVE (`bp3 … -o`) pour les grammaires TEXTE,
// la tokenise avec l'utilitaire d'ordre PARTAGÉ (src/transpiler/orderTokens.js),
// et la compare jeton-à-jeton à l'oracle WASM gelé (s3_timed.json, reconstruit en
// rejoignant ses jetons par espaces — le brut WASM = split(' ') de la même chaîne).
//
// Sans --write : LECTURE SEULE (validation, gate Romain). Avec --write : pose
// snapshots/s3_native.json mode 'text' (idempotent — jetons identiques → non réécrit).
// Référence : hub/constats/2026-06-16-voie-texte-ordre.md.
//
// --campaign (ISO-100 A.2b, [433]) : toutes les clés mode TEXTE dont le -gr. existe,
// tout statut (l'oracle sert le programme, pas mon gate), moins look-and-say (#52) et
// la famille AllItems (divergence de contenu renvoyée à BPx). En campagne, le natif
// fait foi sur les DIFF (décision 2026-06-14 §MAJ) — l'écart est affiché pour triage.
//
// Usage : node test/order_parity.mjs [grammaire …|--campaign] [--write] [--force]

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
const GUARD = path.join(__dirname, 'bp3-guard.sh');   // enveloppe anti-OOM, cf [231]
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

function buildEngineArgs(name, prodFile, { allowExcluded = false } = {}) {
  // gd peut être ABSENT de grammars.json (ex. Ruwet, Visser3/5 pour l'oracle single-play,
  // item ORACLE-SINGLEPLAY-RECONCILE) : on construit alors les args depuis le seul -gr,
  // les auxiliaires (-se/-al) étant inférés du CORPS de la grammaire (fallbacks plus bas).
  const gd = GRAMMARS[name] || null;
  if (gd && gd.status === 'excluded' && !allowExcluded) return null;
  const grName = (gd && gd.bernard) || name;
  const grFile = path.join(TD, `-gr.${grName}`);
  if (!fs.existsSync(grFile)) return null;

  // Normalisation des fins de ligne : certaines grammaires (ex. transposition3,
  // 1997) sont en CR Mac → sans normalisation, le moteur voit toute la grammaire
  // comme UNE ligne commentée (`//`) et ne produit rien. On écrit donc un temp
  // NORMALISÉ, mais DANS test-data, pour que les auxiliaires embarqués (-ho/-al)
  // se résolvent relativement à ce dossier (sinon ils sont introuvables).
  let gr = fs.readFileSync(grFile, 'utf8').replace(/\r\n?/g, '\n');
  const grNoC = gr.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  // CONVENTION DE NOTES — DÉCLARÉE d'abord, reniflée seulement à défaut.
  //
  // On la devinait en cherchant `sa`/`ga` puis `do|re|mi…` dans le corps. L'heuristique
  // tient sur la plupart des grammaires et se trompe précisément là où ça compte : une
  // grammaire indienne portant `re4` est classée FRANÇAISE, alors que le natif avale `re`
  // comme degré indien et effondre sa production (bp3-engine, baseline v12 : `bells` rend
  // 4 jetons en indian contre 16 en français). Deviner une convention qui CHANGE LA SORTIE
  // est un pari, pas une mesure.
  // La convention se déclare donc dans `grammars.json` (`note_convention`), et le reniflage
  // ne sert plus que de défaut pour les grammaires qui ne la déclarent pas.
  const DECLAREE = { french: '1', indian: '2', english: '0', keys: '0' };
  const declaree = (GRAMMARS[name] || {}).note_convention;
  if (declaree !== undefined && DECLAREE[declaree] === undefined) {
    throw new Error(`grammars.json ${name}.note_convention = "${declaree}" inconnue (attendu : ${Object.keys(DECLAREE).join(', ')})`);
  }
  const hasIndian = declaree ? declaree === 'indian' : /\b(sa|ga)\d\b/.test(grNoC);
  const hasFrench = declaree ? declaree === 'french' : /\b(do|re|mi|fa|sol|la|si)\d\b/.test(grNoC);
  const conv = declaree ? DECLAREE[declaree] : (hasIndian ? '2' : hasFrench ? '1' : '0');

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
    for (const [k, val] of Object.entries(gd?.se_overrides || {})) { if (k === '_comment') continue; if (obj[k]) obj[k].value = String(val); else obj[k] = { name: k, value: String(val) }; }
    const tmpSe = path.join('/tmp', `_ord_${name}_se.json`);
    fs.writeFileSync(tmpSe, JSON.stringify(obj));
    args.push('-se', tmpSe);
  };
  if (gd?.s1_args) {
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
  if (!explicit.has('-se') && gd?.php_ref?.settings) { const m = gd.php_ref?.settings.match(/-se\.(\S+)/); if (m) pushSettings(path.join(TD, `-se.${m[1]}`)); }
  // Repli (aligné s3_native.cjs, gap découvert en [435]) : réglages/alphabet référencés
  // dans le CORPS de la grammaire — beaucoup de clés to_be_tested n'ont ni s1_args ni
  // php_ref.settings alors que le -se. existe dans test-data.
  if (!explicit.has('-se') && !args.includes('-se')) { const m = gr.match(/-se\.(\S+)/); if (m) pushSettings(path.join(TD, `-se.${m[1]}`)); }
  if (!explicit.has('-al') && gd?.php_ref?.alphabet) { const m = gd.php_ref?.alphabet.match(/-al\.(\S+)/); if (m) { const f = path.join(TD, `-al.${m[1]}`); if (fs.existsSync(f)) args.push('-al', f); } }
  if (!explicit.has('-al') && !args.includes('-al')) {
    const m = gr.match(/-al\.(\S+)/);
    if (m) { const f = path.join(TD, `-al.${m[1]}`); if (fs.existsSync(f)) args.push('-al', f); }
  }
  // NB : le `-ho.X` (homomorphisme) référencé dans le corps est AUTO-RÉSOLU par bp3 depuis le
  // dossier du -gr (TD) — le passer EN PLUS via `-ho` casse les grammaires qui l'auto-chargent
  // déjà (MyMelody, koto3 : double-chargement → « no output »). On ne le passe donc PAS.

  args.push('-o', prodFile);
  return args;
}

function nativeOrder(name, opts = {}) {
  const prodFile = path.join('/tmp', `_ord_${name}_prod.txt`);
  try { fs.unlinkSync(prodFile); } catch {}
  const args = buildEngineArgs(name, prodFile, opts);
  if (!args) return { error: 'args' };
  // Sous le garde anti-OOM : la campagne inclut des grammaires à boucle infinie
  // documentée (PP, checkcontext) — plafond mémoire + victime OOM + timeout.
  try { execSync(`bash "${GUARD}" "${BP3}" ${args.map((a) => `"${a}"`).join(' ')}`, { cwd: BP3_DIR, timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] }); } catch {}
  try { fs.unlinkSync(path.join(TD, `_ord_tmp_${name}.gr`)); } catch {} // temp grammaire normalisée
  if (!fs.existsSync(prodFile)) return { error: 'no output' };
  // Garde anti-démesure : une dérivation non terminante (Improvize, livecode2) peut écrire
  // des centaines de Mo avant le timeout — jamais un oracle, et readFileSync exploserait.
  const sz = fs.statSync(prodFile).size;
  if (sz > 50 * 1024 * 1024) { try { fs.unlinkSync(prodFile); } catch {} return { error: `production démesurée (${(sz / 1048576).toFixed(0)} Mo — dérivation non terminante)` }; }
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
  const newToks = tokens.map((t) => [t, 0, 0]);
  const dir = path.join(__dirname, 'grammars', name, 'snapshots');
  const file = path.join(dir, 's3_native.json');
  // Idempotence : jetons identiques à l'oracle en place → fraîcheur confirmée, pas de
  // réécriture ; un oracle mode:'midi' n'est JAMAIS écrasé par la voie texte.
  if (fs.existsSync(file)) {
    try {
      const prev = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (prev.mode === 'midi') return 'ORACLE MIDI en place (non touché)';
      if (JSON.stringify(prev.tokens) === JSON.stringify(newToks)) return `inchangé — frais confirmé (${newToks.length} jetons)`;
    } catch { /* illisible → réécrit */ }
  }
  const snap = {
    source: 'native -o (bp3 Linux, production canonique ordonnée)',
    stage: 's3_native',
    mode: 'text',
    tokens: newToks,
    date: new Date().toISOString().slice(0, 10),
  };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(snap, null, 2));
  return `écrit (${newToks.length} jetons)`;
}

const argv = process.argv.slice(2);
const DO_WRITE = argv.includes('--write');     // pose s3_native si parité OK
const CAMPAIGN = argv.includes('--campaign');  // ISO-100 A.2b : tout le corpus texte
const FORCE = argv.includes('--force') || CAMPAIGN; // pose le natif même si DIFF (natif fait foi)
const SINGLEPLAY = argv.includes('--singleplay'); // ORACLE-SINGLEPLAY-RECONCILE (item tour [573])
const targets = argv.filter((a) => !a.startsWith('--'));

// ── Mode --singleplay (item ORACLE-SINGLEPLAY-RECONCILE, tour [573]) ────────────
// Émet un oracle single-play UNIFORME (texte RÉSOLU, ordonné, seed 1) pour bp3-frontend :
// natif `bp3 … -o` (machinerie buildEngineArgs : conversion -se, note-convention, alphabet)
// → tokenizeOrder (séquence de jetons SONNANTS incluant les contrôles `_x(args)`). C'est ce que
// bp3-frontend confronte à son « play frontal ». Sortie : test/oracles/singleplay/<name>.json .
// Fonctionne AUSSI pour les grammaires absentes de grammars.json (Ruwet, Visser3/5) — buildEngineArgs
// infère les auxiliaires depuis le -gr. `allowExcluded` pour ne bloquer sur aucun statut.
if (SINGLEPLAY) {
  const OUT = path.join(__dirname, 'oracles', 'singleplay');
  fs.mkdirSync(OUT, { recursive: true });
  const list = targets.length ? targets
    : ['MyMelody', 'doeslittle', 'simpletemplates', 'Ruwet', 'koto3', 'Visser3', 'Visser5'];
  console.log(`=== Oracle single-play (natif -o RÉSOLU, seed 1) → test/oracles/singleplay/ ===\n`);
  let ok = 0, ko = 0;
  for (const name of list) {
    const nat = nativeOrder(name, { allowExcluded: true });
    if (nat.error || !Array.isArray(nat.tokens) || nat.tokens.length === 0) {
      console.log(`  ${name}: ÉCHEC natif (${nat.error || '0 jeton'}) — pas d'oracle`); ko++; continue;
    }
    const snap = {
      name,
      source: 'native bp3 -o (single-play résolu, seed 1) → tokenizeOrder',
      mode: 'text-singleplay',
      seed: 1,
      count: nat.tokens.length,
      tokens: nat.tokens,
    };
    const file = path.join(OUT, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(snap, null, 2));
    console.log(`  ${name}: ${nat.tokens.length} jetons → oracles/singleplay/${name}.json`);
    ok++;
  }
  console.log(`\n${ok} oracle(s) émis / ${ko} en échec sur ${list.length}`);
  process.exit(ko && ok === 0 ? 1 : 0);
}

// Hors campagne texte : #52 look-and-say (build natif faux, décision 2026-06-14 §MAJ) ;
// famille AllItems = divergence de CONTENU (octave C5/C4) renvoyée à BPx (résorption §2.B).
const EXCLUDE_TEXT = new Set(['look-and-say', 'all-items', 'all-items1', 'tryAllItems0', 'tryAllItems1', 'templates']);

const names = CAMPAIGN
  ? Object.entries(GRAMMARS)
      .filter(([k, v]) => k !== '_comment'
        && (v.production_mode || 'midi') === 'text'
        && fs.existsSync(path.join(TD, `-gr.${v.bernard || k}`)))
      .map(([k]) => k)
  : targets.length ? targets : ['flags', 'negative-context', 'ek-do-tin'];

let pass = 0, fail = 0;
console.log(`=== Parité texte ORDRE-à-ORDRE (natif -o  vs  oracle WASM, tokeniseur partagé)${DO_WRITE ? '  [--write]' : ''}${FORCE ? '  [--force natif fait foi]' : ''} ===\n`);
for (const name of names) {
  if (CAMPAIGN && EXCLUDE_TEXT.has(name)) { console.log(`  ${name}: EXCLU (${name === 'look-and-say' ? '#52 build natif faux' : 'famille AllItems, renvoyée BPx'})`); continue; }
  const nat = nativeOrder(name, { allowExcluded: CAMPAIGN || FORCE });
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
    if (DO_WRITE && FORCE) { console.log(`  ${name}: DIFF @${diff} natif=${JSON.stringify(a[diff])} wasm=${JSON.stringify(b[diff])} (len ${a.length}/${b.length}) — natif fait foi → ${writeTextOracle(name, a)}`); }
    else { console.log(`  ${name}: DIFF @${diff} — natif=${JSON.stringify(a[diff])} wasm=${JSON.stringify(b[diff])} (len natif=${a.length} wasm=${b.length})`); fail++; }
  }
}
console.log(`\n${pass} OK / ${fail} DIFF sur ${names.length}`);
process.exit(fail ? 1 : 0);
