/**
 * Test : encoder emits `[scale:N]` polymetric qualifier as BP3 native
 * `*N` (scale up) / `**M` (scale down) prefix on `{...}` braces.
 *
 * Ports the BP3 textual scaling markers from Encode.c:102-117 and the
 * consumer in Polymetric.c:229-244, 293-302 — distinct from speed/_tempo.
 *
 * Run: node test/test_scale_qualifier.js
 */

import { readFileSync } from 'fs';
import { compileBPS } from '../src/transpiler/index.js';
import { registerAll } from '../src/transpiler/libs.js';

const libs = {};
for (const name of ['alphabets', 'controls', 'octaves', 'tunings', 'temperaments', 'settings']) {
  libs[name] = JSON.parse(readFileSync(`lib/${name}.json`, 'utf8'));
}
registerAll(libs);

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, details) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push({ label, details: details || '' });
    console.error(`  FAIL: ${label}${details ? ` — ${details}` : ''}`);
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

function compile(src) {
  return compileBPS(src);
}

// ----------------------------------------------------------
// 1. [scale:2] on polymetric → `*2 {...}` prefix
// ----------------------------------------------------------

section('[scale:N] polymetric qualifier — N >= 1 → *N prefix');

{
  const src = `@core
@alphabet.western:midi
@mm:60
@striated

@mode:ord
S -> {C4, D4}[scale:2]
`;
  const r = compile(src);
  assert('compile ok (no errors)', r.errors.length === 0, JSON.stringify(r.errors));
// ⚠️ ASSERTION(S) DE TEXTE BP3 RETIRÉE(S) le 2026-07-19 — certification grammaire-texte
// abandonnée (arbitrage Romain), encodeur supprimé : plus de texte à vérifier.
//   assert('grammar contains *2 prefix', r.grammar && r.grammar.includes('*2 {C4,D4}'),
//     `got: ${JSON.stringify(r.grammar)}`);
  // Regression guard for bug #79: encoder used to drop [scale:N], emitting
  // just `{C4,D4}` with no scaling marker. We assert the marker is present.
//   assert('scaling marker emitted (no longer dropped)',
//     r.grammar && /\*2\s+\{C4,D4\}/.test(r.grammar),
//     `got: ${JSON.stringify(r.grammar)}`);
}

// ----------------------------------------------------------
// 2. [scale:3] integer
// ----------------------------------------------------------

{
  const src = `@core
@alphabet.western:midi
@mm:60
@striated

@mode:ord
S -> {C4, D4, E4}[scale:3]
`;
  const r = compile(src);
  assert('scale:3 compile ok', r.errors.length === 0, JSON.stringify(r.errors));
//   assert('grammar contains *3 prefix', r.grammar && r.grammar.includes('*3 {C4,D4,E4}'),
//     `got: ${JSON.stringify(r.grammar)}`);
}

// ----------------------------------------------------------
// 3. [speed:N] est SUPPRIMÉ — et doit être refusé par son nom
// ----------------------------------------------------------
//
// Ce bloc exigeait l'inverse : que `[speed:2]` COMPILE, et rende `{2,C4,D4}`. Il a été écrit
// quand `speed` existait. La décision datée `2026-06-26-trois-concepts-temps-duree` l'a
// SUPPRIMÉ — pas renommé — parce que la durée subsume le qualificatif : `{A B}:2` dit la même
// chose et se lit en vocabulaire de musicologie.
//
// Le test a survécu à la décision, et il MENTAIT : il présentait une suppression ratifiée
// comme une régression. Un test périmé est pire qu'un test absent, parce qu'il a l'air de
// garantir quelque chose. On l'aligne donc sur la vérité ratifiée — et on en profite pour
// garder un vrai garde : le rejet doit NOMMER la faute et indiquer la forme de remplacement,
// sinon l'auteur d'une vieille scène ne saura pas quoi écrire.

section('[speed:N] est supprimé — rejet nommé (décision 2026-06-26)');

{
  const src = `@core
@alphabet.western:midi
@mm:60
@striated

@mode:ord
S -> {C4, D4}[speed:2]
`;
  const r = compile(src);
  assert('speed est REFUSÉ', r.errors.length > 0, 'aucune erreur : la suppression ne mord plus');
  const msg = (r.errors[0] && r.errors[0].message) || '';
  assert('le refus nomme le mot supprimé', msg.includes('speed'), `message: ${msg}`);
  assert('le refus indique la forme de remplacement', msg.includes(':'), `message: ${msg}`);
}

{
  // La forme de REMPLACEMENT, elle, doit rendre exactement ce que `[speed:2]` rendait.
  const src = `@core
@alphabet.western:midi
@mm:60
@striated

@mode:ord
S -> {C4, D4}:2
`;
  const r = compile(src);
  assert('la durée « :2 » compile', r.errors.length === 0, JSON.stringify(r.errors));
//   assert('et rend {2,C4,D4}', r.grammar && r.grammar.includes('{2,C4,D4}'),
//     `got: ${JSON.stringify(r.grammar)}`);
}

// ----------------------------------------------------------
// Summary
// ----------------------------------------------------------

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.label}${f.details ? ': ' + f.details : ''}`);
  process.exit(1);
}
