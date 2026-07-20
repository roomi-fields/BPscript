#!/usr/bin/env node
/**
 * FAMILLES DE DIVERGENCE — classement MÉCANIQUE des écarts Voie B ↔ baseline native.
 *
 * POURQUOI CET OUTIL. J'avais classé les DIFF à la main (« CARDINALITÉ 24 / OCTAVE ~18 /
 * DURÉE 6 »). Confronté aux captures, ce classement s'est révélé FAUX sur deux points :
 * la moitié des « cardinalité » avaient en fait la MÊME cardinalité que la référence, et
 * les écarts de NOM recouvraient quatre causes distinctes, pas une. Une taxonomie affirmée
 * de mémoire se périme et induit en erreur ; celle-ci se recalcule.
 *
 * CE QU'IL SÉPARE (l'ordre des questions compte) :
 *   1. cardinalité      — pas le même nombre de jetons. Sous-cas PRÉFIXE : le candidat est
 *                         le début exact de la référence → signature « la référence répète
 *                         N fois ce que je produis une fois » (réglage MaxItemsProduce,
 *                         ProduceItems.c). Se résout côté baseline, pas côté langage.
 *   2. temps            — mêmes noms, temps différents. Facteur constant = famille durée.
 *   3. noms             — mêmes temps, noms différents. Quatre causes vues, à ne PAS
 *                         confondre : enharmonie (même son, autre graphie) ; suffixe de
 *                         variante d'accordage (Cj4 vs C4) ; décalage de degré constant ;
 *                         transposition non appliquée.
 *   4. noms+temps       — composé : les deux à corriger.
 *
 * ⚠️ Une divergence de NOM n'est PAS anodine et ne se « normalise » jamais par défaut :
 * normaliser une graphie n'est légitime que si le SON est prouvé identique (enharmonie en
 * tempérament égal). Ailleurs (variante d'accordage, transposition), le nom porte une
 * information réelle et l'aplatir MASQUERAIT le défaut. Cet outil constate, il ne corrige pas.
 *
 * Usage :  node test/diff_families.mjs [--ref <git-ref>] [grammaire…]
 *          --ref lit les captures à une révision de bp3-engine (défaut : l'arbre de travail).
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { DIR_BPS, bpsPath, nomsBps, exigerCorpus } from './corpus.mjs';

const require = createRequire(import.meta.url);
const { loadBaseline, soundingOnly, registerShiftFor } = require('./compare_modal.cjs');
const { compileToBPxAST } = require('../src/transpiler/index.js');
const { createSession } = await import('/home/romi/dev/bp/BPx/dist/index.js');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GRAMMARS = DIR_BPS;  // corpus emprunté à la bibliothèque Kanopi (test/corpus.mjs)
const ENGINE = path.resolve(ROOT, '..', 'bp3-engine');

const argv = process.argv.slice(2);
const refIdx = argv.indexOf('--ref');
const gitRef = refIdx >= 0 ? argv[refIdx + 1] : null;
const only = argv.filter((a, i) => !a.startsWith('--') && i !== refIdx + 1);

/** Capture native, depuis l'arbre de travail ou une révision figée. */
function capture(entry, dir) {
  if (!entry.capture) return null;
  try {
    if (gitRef) {
      const raw = execSync(`git -C ${ENGINE} show ${gitRef}:baseline-native/${entry.capture}`,
        { encoding: 'utf-8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
      return JSON.parse(raw);
    }
    const p = path.join(dir, entry.capture);
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : null;
  } catch { return null; }
}

/** Voie B — jetons sonnants, via les mêmes filtres que le comparateur partagé. */
function voieB(name) {
  const bps = bpsPath(name);
  if (!existsSync(bps)) return null;
  try {
    const out = compileToBPxAST(readFileSync(bps, 'utf-8'));
    if (out.errors.length) return null;
    const s = createSession(out.ast, { seed: 1 });
    s.derive();
    return soundingOnly(s.emit('timed-tokens'));
  } catch { return null; }
}

function classify(ref, mine, name) {
  const nameEq = (i, j) => ref[i].token === mine[j].token;
  const timeEq = (i, j) => ref[i].start === mine[j].start && ref[i].end === mine[j].end;

  if (ref.length !== mine.length) {
    let prefix = mine.length < ref.length;
    for (let i = 0; prefix && i < mine.length; i++) if (!nameEq(i, i) || !timeEq(i, i)) prefix = false;
    const ratio = (ref.length / mine.length).toFixed(1);
    return prefix
      ? { famille: 'cardinalite/PREFIXE', detail: `candidat = debut exact de la reference, x${ratio}` }
      : { famille: 'cardinalite', detail: `${ref.length} vs ${mine.length} (x${ratio}), contenu deja divergent` };
  }

  const names = ref.every((_, i) => nameEq(i, i));
  const times = ref.every((_, i) => timeEq(i, i));
  if (names && times) return { famille: 'ISO', detail: '' };

  if (names) {
    const fs_ = ref.map((r, i) => (mine[i].end - mine[i].start) === 0
      ? null : (r.end - r.start) / (mine[i].end - mine[i].start)).filter((x) => x != null);
    const uniq = [...new Set(fs_.map((x) => x.toFixed(4)))];
    return uniq.length === 1
      ? { famille: 'temps/FACTEUR', detail: `duree x${uniq[0]} constante` }
      : { famille: 'temps', detail: 'ecart non constant' };
  }

  const diff = [];
  for (let i = 0; i < ref.length; i++) if (!nameEq(i, i)) diff.push(`${ref[i].token} <- ${mine[i].token}`);
  const uniq = [...new Set(diff)];
  const detail = `${diff.length}/${ref.length} — ${uniq.slice(0, 4).join(', ')}${uniq.length > 4 ? '…' : ''}`;
  return { famille: times ? 'noms' : 'noms+temps', detail };
}

const { byName, dir } = loadBaseline();
exigerCorpus();
const names = nomsBps()
  .filter(() => true)
  .filter((d) => byName[d] && byName[d].modalite === 'MIDI' && byName[d].produit)
  .filter((d) => only.length === 0 || only.includes(d))
  .sort();

const rows = [];
for (const name of names) {
  const cap = capture(byName[name], dir);
  if (!cap) { rows.push({ name, famille: 'reference absente', detail: 'capture illisible' }); continue; }
  const ref = (Array.isArray(cap) ? cap : cap.tokens).map((t) => ({ token: t.token, start: t.start, end: t.end }));
  const mine = voieB(name);
  if (!mine) { rows.push({ name, famille: 'ne produit pas', detail: '' }); continue; }
  if (!ref.length || !mine.length) { rows.push({ name, famille: 'vide', detail: '' }); continue; }
  rows.push({ name, shift: registerShiftFor(name), ...classify(ref, mine, name) });
}

console.log(`FAMILLES DE DIVERGENCE — ${rows.length} grammaires MIDI productibles avec .bps`
  + `${gitRef ? ` (captures @ ${gitRef})` : ' (arbre de travail)'}\n`);
for (const r of rows) {
  const s = r.shift ? ` [c4key]` : '';
  console.log(`  ${r.name.padEnd(22)} ${r.famille.padEnd(20)}${s} ${r.detail || ''}`);
}
const tally = {};
for (const r of rows) tally[r.famille] = (tally[r.famille] || 0) + 1;
console.log('\nBilan :');
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${k}`);
}
