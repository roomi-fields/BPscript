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
import { compileToBPxAST } from '../src/transpiler/index.js';

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

console.log('\n=== brassage / graine orthogonaux ===');

// [shuffle] conservé → _rndseq
{
  const r = compileToBPxAST('@controls\n@mode:random\nA -> {a b c}[shuffle]');
  assert('[shuffle] : 0 erreur', r.errors.length === 0, r.errors);
  // ⚠️ DEUX ASSERTIONS DE TEXTE BP3 RETIRÉES le 2026-07-19 (émission `_rndseq`, absence de
  // `_srand`) — certification grammaire-texte abandonnée, encodeur supprimé.
}

// [shuffle:N] supprimé → erreur pointant @seed
{
  const r = compileToBPxAST('@controls\n@mode:random\nA -> {a b c}[shuffle:1]');
  assert('[shuffle:1] : erreur', r.errors.length > 0, r.errors);
  assert('[shuffle:1] : message cite @seed', /@seed/.test((r.errors[0] || {}).message || ''), r.errors);
}

// ![@seed:N] dans le flux → _srand(N)
{
  const r = compileToBPxAST('@mode:lin\nS -> a ![@seed:2] b');
  assert('![@seed:2] : 0 erreur', r.errors.length === 0, r.errors);
  // ⚠️ ASSERTION DE TEXTE BP3 RETIRÉE le 2026-07-19 (émission `_srand(2)`).
}

// ![@<autre>] dans le flux → erreur (seul seed a un sens en flux)
{
  const r = compileToBPxAST('@mode:lin\nS -> a ![@maxitems:3] b');
  assert('![@maxitems] : erreur (hors seed)', r.errors.length > 0, r.errors);
}

// Remplacement de [shuffle:1] : ![@seed:1] {…}[shuffle] → _srand(1) … _rndseq
{
  const r = compileToBPxAST('@controls\n@mode:random\nB -> ![@seed:1] {C4 B4 E4}[shuffle]');
  assert('remplacement : 0 erreur', r.errors.length === 0, r.errors);
  // ⚠️ DEUX ASSERTIONS DE TEXTE BP3 RETIRÉES le 2026-07-19. Ce qui RESTE vérifié ici est le
  // point qui compte pour le langage : la forme de remplacement de `[shuffle:1]` COMPILE.
}

console.log(`\n${'='.repeat(40)}\nRésultat : ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exit(1);
