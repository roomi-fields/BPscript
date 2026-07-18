#!/usr/bin/env node
/**
 * VOIE B — statut par grammaire, dans la modalité déclarée par la baseline.
 *
 * Décision 2026-07-18 (procédure de test suivi normée). Pour chaque grammaire disposant
 * d'une `.bps` : produire B = .bps → BPx, capturer DANS LA BONNE MODALITÉ, puis confronter
 * à la baseline native via LE comparateur partagé (`compare_modal.cjs`).
 *
 * Ce fichier ne compare RIEN lui-même : il produit et délègue. Le verdict appartient au
 * comparateur, que le frontal utilise aussi pour la Voie A — un seul juge pour les deux voies.
 *
 * Usage :  node test/voie_b_status.mjs [--json] [grammaire…]
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { compare, loadBaseline, soundingOnly, soundingText } = require('./compare_modal.cjs');
const { compileBPS } = require('../src/transpiler/index.js');
const { createSession } = await import('/home/romi/dev/bp/BPx/dist/index.js');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GRAMMARS = path.join(ROOT, 'test', 'grammars');

/** Produit la Voie B d'une grammaire, dans la modalité demandée. */
function produceB(name, modalite) {
  const bps = path.join(GRAMMARS, name, 'scene.bps');
  if (!existsSync(bps)) return { absent: true };
  let out;
  try {
    out = compileBPS(readFileSync(bps, 'utf-8'));
    if (out.errors.length) return { erreur: `compilation : ${out.errors[0].message}` };
  } catch (e) { return { erreur: `compilation : ${e.message}` }; }
  try {
    const s = createSession(out.ast, { seed: 1 });
    s.derive();
    if (modalite === 'MIDI') return { tokens: soundingOnly(s.emit('timed-tokens')) };
    const toks = s.emit('timed-tokens');
    return { text: soundingText(toks) };
  } catch (e) { return { erreur: `dérivation : ${e.message}` }; }
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const only = args.filter((a) => !a.startsWith('--'));

const { byName } = loadBaseline();
const withBps = readdirSync(GRAMMARS)
  .filter((d) => existsSync(path.join(GRAMMARS, d, 'scene.bps')))
  .filter((d) => byName[d])
  .filter((d) => only.length === 0 || only.includes(d))
  .sort();

const rows = [];
for (const name of withBps) {
  const ref = byName[name];
  const b = produceB(name, ref.modalite);
  let res;
  if (b.absent) res = { status: 'ABSENT', detail: 'pas de scene.bps' };
  else if (b.erreur) res = { status: 'NE PRODUIT PAS', modalite: ref.modalite, detail: b.erreur };
  else res = compare(name, b);
  rows.push({ grammaire: name, modalite: ref.modalite ?? '—', ...res });
}

if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const tally = {};
  for (const r of rows) tally[r.status] = (tally[r.status] || 0) + 1;
  console.log(`Voie B — ${rows.length} grammaires avec .bps, confrontées à la baseline native\n`);
  for (const r of rows) {
    const d = r.detail ? `  ${String(r.detail).slice(0, 72)}` : '';
    console.log(`  ${r.grammaire.padEnd(22)} ${String(r.modalite).padEnd(6)} ${r.status.padEnd(15)}${d}`);
  }
  console.log('\nBilan :');
  for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(16)} ${n}`);
  }
}
