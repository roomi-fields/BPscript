/**
 * Test : étiquette absolu/relatif sur TempoOp (contrat BPx, décision
 * hub/decisions/2026-06-10-tempo-absolu-vs-relatif.md).
 *
 *   ![/N], ![*N]   (instant control, `!`)   → scope: 'relative'  (→ _tempo BP3)
 *   A[/N]          (suffixe d'élément)        → scope: 'absolute'  (→ /N nu BP3)
 *   [/N]           (qualificateur de règle)   → scope: 'absolute'
 *
 * L'AST portait un TempoOp générique : BPx devait deviner par position (et se
 * trompait sur l'élément). Le champ `scope` rend la décision explicite.
 *
 * Run: node test/test_tempo_scope.js
 */
import { readFileSync } from 'fs';
import { tokenize } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';
import { registerAll } from '../src/transpiler/libs.js';

const libs = {};
for (const n of ['alphabets', 'controls', 'octaves', 'tunings', 'temperaments', 'settings', 'transcription']) {
  libs[n] = JSON.parse(readFileSync(`lib/${n}.json`, 'utf8'));
}
registerAll(libs);

let passed = 0, failed = 0;
function assert(label, cond, detail) {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`); }
}

// Collecte récursive de tous les nœuds TempoOp d'un AST.
function findTempoOps(node, acc = []) {
  if (node == null || typeof node !== 'object') return acc;
  if (node.type === 'TempoOp') acc.push(node);
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) v.forEach(x => findTempoOps(x, acc));
    else if (v && typeof v === 'object') findTempoOps(v, acc);
  }
  return acc;
}
const scopeOf = (src) => {
  const tops = findTempoOps(parse(tokenize(src)));
  return tops.length === 1 ? tops[0].scope : `(${tops.length} TempoOp)`;
};

console.log('\n=== TempoOp scope absolu/relatif ===');

// Relatif : forme ! dans le flux
assert("![/2] → relative", scopeOf('@mode:lin\nS -> a ![/2] b') === 'relative', scopeOf('@mode:lin\nS -> a ![/2] b'));
assert("![*3] → relative", scopeOf('@mode:lin\nS -> a ![*3] b') === 'relative', scopeOf('@mode:lin\nS -> a ![*3] b'));

// Absolu : suffixe d'élément
assert("a[/2] → absolute", scopeOf('@mode:lin\nS -> a[/2] b') === 'absolute', scopeOf('@mode:lin\nS -> a[/2] b'));

// Absolu : qualificateur de règle
assert("[/2] règle → absolute", scopeOf('@mode:lin\nS -> a b [/2]') === 'absolute', scopeOf('@mode:lin\nS -> a b [/2]'));

// Le champ existe toujours (jamais undefined)
{
  const tops = findTempoOps(parse(tokenize('@mode:lin\nS -> a[/2] b ![/3] c')));
  assert("scope présent sur tous les TempoOp", tops.length === 2 && tops.every(t => t.scope === 'absolute' || t.scope === 'relative'),
    tops.map(t => t.scope));
}

console.log(`\n${'='.repeat(40)}\nRésultat : ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exit(1);
