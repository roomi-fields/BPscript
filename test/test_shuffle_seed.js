/**
 * Test : orthogonalité brassage / graine (décision 2026-06-14-shuffle-seed-orthogonaux).
 *
 *   [shuffle]        → _rndseq            (brasser seul, conservé)
 *   [shuffle:N]      → ERREUR             (la graine s'écrit [@seed:N])
 *   ![@seed:N]       → _srand(N)          (re-semence dans le flux ; restreint à seed)
 *   ![@maxitems:N]   → ERREUR             (pas de jeton de flux BP3 hors seed)
 *   ![@seed:1] {…}[shuffle] → _srand(1) … {_rndseq …}  (remplace l'ancien [shuffle:1])
 *
 * Run: node test/test_shuffle_seed.js
 */
import { readFileSync } from 'fs';
import { registerAll } from '../src/transpiler/libs.js';
import { compileBPS } from '../src/transpiler/index.js';

const libs = {};
for (const n of ['alphabets', 'controls', 'octaves', 'tunings', 'temperaments', 'settings', 'transcription']) {
  libs[n] = JSON.parse(readFileSync(`lib/${n}.json`, 'utf8'));
}
registerAll(libs);

let passed = 0, failed = 0;
function assert(label, cond, detail) {
  if (cond) passed++;
  else { failed++; console.error(`  FAIL: ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`); }
}
const rhs = (g) => (g.split('\n').find(l => l.includes('gram#')) || '').replace(/.*-->/, '').trim();

console.log('\n=== brassage / graine orthogonaux ===');

// [shuffle] conservé → _rndseq
{
  const r = compileBPS('@controls\n@mode:random\nA -> {a b c}[shuffle]');
  assert('[shuffle] : 0 erreur', r.errors.length === 0, r.errors);
  assert('[shuffle] → _rndseq', rhs(r.grammar).includes('_rndseq'), rhs(r.grammar));
  assert('[shuffle] : pas de _srand', !rhs(r.grammar).includes('_srand'), rhs(r.grammar));
}

// [shuffle:N] supprimé → erreur pointant @seed
{
  const r = compileBPS('@controls\n@mode:random\nA -> {a b c}[shuffle:1]');
  assert('[shuffle:1] : erreur', r.errors.length > 0, r.errors);
  assert('[shuffle:1] : message cite @seed', /@seed/.test((r.errors[0] || {}).message || ''), r.errors);
}

// ![@seed:N] dans le flux → _srand(N)
{
  const r = compileBPS('@mode:lin\nS -> a ![@seed:2] b');
  assert('![@seed:2] : 0 erreur', r.errors.length === 0, r.errors);
  assert('![@seed:2] → _srand(2)', rhs(r.grammar).includes('_srand(2)'), rhs(r.grammar));
}

// ![@<autre>] dans le flux → erreur (seul seed a un sens en flux)
{
  const r = compileBPS('@mode:lin\nS -> a ![@maxitems:3] b');
  assert('![@maxitems] : erreur (hors seed)', r.errors.length > 0, r.errors);
}

// Remplacement de [shuffle:1] : ![@seed:1] {…}[shuffle] → _srand(1) … _rndseq
{
  const r = compileBPS('@controls\n@mode:random\nB -> ![@seed:1] {C4 B4 E4}[shuffle]');
  assert('remplacement : 0 erreur', r.errors.length === 0, r.errors);
  const g = rhs(r.grammar);
  assert('remplacement → _srand(1)', g.includes('_srand(1)'), g);
  assert('remplacement → _rndseq', g.includes('_rndseq'), g);
}

console.log(`\n${'='.repeat(40)}\nRésultat : ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exit(1);
