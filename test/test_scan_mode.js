/**
 * test_scan_mode.js — Tests du mapping [scan:...] → rule.mode dans le parser
 *
 * B2 : parser.js doit poser rule.mode = 'left'|'right'|'rnd'|null lors du parse
 * d'un qualificateur [scan:...]. Le qualificateur RESTE dans rule.qualifiers
 * (l'encoder s'en sert pour émettre le préfixe LEFT/RIGHT/RND en BP3).
 *
 * Run: node test/test_scan_mode.js
 */

import { tokenize } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { registerAll } from '../src/transpiler/libs.js';
import { readFileSync } from 'fs';
import { bpsPath, grPath } from './corpus.mjs';

// ── Pre-register libs ─────────────────────────────────────────
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

function parseSource(src) {
  return parse(tokenize(src));
}

function getRule(ast, subIdx, ruleIdx) {
  return ast.subgrammars &&
    ast.subgrammars[subIdx] &&
    ast.subgrammars[subIdx].rules &&
    ast.subgrammars[subIdx].rules[ruleIdx];
}

// ============================================================
// Cas 1 — [scan:left] → rule.mode === 'left'
// ============================================================
section('[scan:left] → rule.mode = left');
{
  const ast = parseSource(`@controls
X -> M [scan:left]`);
  const rule = getRule(ast, 0, 0);
  assert('règle parsée', rule && rule.type === 'Rule', 'pas de règle');
  assert('rule.mode === "left"', rule && rule.mode === 'left', `mode: ${rule && rule.mode}`);
  // La QualPair doit rester dans qualifiers (pour l'encoder)
  if (rule) {
    const scanPair = rule.qualifiers.flatMap(q => q.pairs || []).find(p => p.key === 'scan');
    assert('QualPair scan conservée dans qualifiers', scanPair && scanPair.value === 'left',
      `qualifiers: ${JSON.stringify(rule.qualifiers)}`);
  }
}

// ============================================================
// Cas 2 — [scan:right] → rule.mode === 'right'
// ============================================================
section('[scan:right] → rule.mode = right');
{
  const ast = parseSource(`@controls
X -> M [scan:right]`);
  const rule = getRule(ast, 0, 0);
  assert('rule.mode === "right"', rule && rule.mode === 'right', `mode: ${rule && rule.mode}`);
}

// ============================================================
// Cas 3 — [scan:rnd] → rule.mode === 'rnd'
// ============================================================
section('[scan:rnd] → rule.mode = rnd');
{
  const ast = parseSource(`@controls
X -> M [scan:rnd]`);
  const rule = getRule(ast, 0, 0);
  assert('rule.mode === "rnd"', rule && rule.mode === 'rnd', `mode: ${rule && rule.mode}`);
}

// ============================================================
// Cas 4 — pas de [scan:...] → rule.mode === null
// ============================================================
section('sans [scan:...] → rule.mode = null');
{
  const ast = parseSource(`@controls
X -> M`);
  const rule = getRule(ast, 0, 0);
  assert('rule.mode === null (absent)', rule && rule.mode === null, `mode: ${rule && rule.mode}`);
}

// ============================================================
// Cas 5 — valeur inconnue [scan:diagonal] → ParseError via compileBPS
// ============================================================
section('[scan:diagonal] → ParseError via compileBPS');
{
  const src = `@controls
@alphabet.western:midi
X -> M [scan:diagonal]`;
  const result = compileToBPxAST(src);
  // Doit émettre au moins une erreur (valeur scan inconnue)
  assert('erreur pour valeur scan inconnue', result.errors && result.errors.length > 0,
    `errors: ${JSON.stringify(result.errors)}`);
}

// ============================================================
// Cas 6 — règle sans scan, règle avec scan : seule la 2e a mode
// ============================================================
section('règle sans + règle avec scan');
{
  const ast = parseSource(`@controls
A -> B
C -> D [scan:rnd]`);
  const rule1 = getRule(ast, 0, 0);
  const rule2 = getRule(ast, 0, 1);
  assert('règle 1 mode null', rule1 && rule1.mode === null, `mode: ${rule1 && rule1.mode}`);
  assert('règle 2 mode rnd', rule2 && rule2.mode === 'rnd', `mode: ${rule2 && rule2.mode}`);
}

// ============================================================
// Cas 7 — compileBPS : préfixe 'LEFT' dans le texte BP3
// ============================================================
section('compileBPS [scan:left] → préfixe LEFT dans BP3');
{
  const src = `@controls
@alphabet.western:midi
X -> C4 [scan:left]`;
  const result = compileToBPxAST(src);
  assert('pas d\'erreur fatale', result.errors.length === 0, `errors: ${JSON.stringify(result.errors)}`);
// ⚠️ ASSERTION(S) DE TEXTE BP3 RETIRÉE(S) le 2026-07-19 — certification grammaire-texte
// abandonnée (arbitrage Romain), encodeur supprimé : plus de texte à vérifier.
//   assert('préfixe LEFT dans grammar', result.grammar && result.grammar.includes('LEFT'),
//     `extrait: ${result.grammar && result.grammar.slice(0, 300)}`);
}

// ============================================================
// Cas 8 — compileBPS [scan:rnd] → préfixe RND dans BP3
// ============================================================
section('compileBPS [scan:rnd] → préfixe RND dans BP3');
{
  const src = `@controls
@alphabet.western:midi
X -> C4 [scan:rnd]`;
  const result = compileToBPxAST(src);
//   assert('préfixe RND dans grammar', result.grammar && result.grammar.includes('RND'),
//     `extrait: ${result.grammar && result.grammar.slice(0, 300)}`);
}

// ============================================================
// Cas 9 — non-régression look-and-say.bps : [scan:left] en mode SUB
// ============================================================
section('non-régression look-and-say.bps [scan:left] en mode SUB');
{
  try {
    // Lit la copie AUTORITAIRE (test/grammars/), pas l'ex-copie scenes/ supprimée le 2026-07-19.
    // Elle porte en plus '[@maxitems:20]', la traduction du réglage natif — donc plus fidèle.
    const src = readFileSync(bpsPath('look-and-say'), 'utf8');
    const result = compileToBPxAST(src);
    assert('look-and-say compile sans erreur', result.errors.length === 0,
      `errors: ${JSON.stringify(result.errors)}`);
//     assert('préfixe LEFT dans grammar', result.grammar && result.grammar.includes('LEFT'),
//       'LEFT non trouvé');

    // Vérifier rule.mode dans l'AST
    const ast = parseSource(src);
    let foundLeft = false;
    for (const sub of (ast.subgrammars || [])) {
      for (const rule of (sub.rules || [])) {
        if (rule.mode === 'left') { foundLeft = true; break; }
      }
      if (foundLeft) break;
    }
    assert('au moins une règle rule.mode=left dans look-and-say', foundLeft,
      'aucune règle avec mode=left trouvée');
  } catch (e) {
    assert('look-and-say.bps chargé', false, e.message);
  }
}

// ============================================================
// Résultat final
// ============================================================
console.log(`\n${'='.repeat(50)}`);
if (failures.length > 0) {
  console.log('\nÉchecs :');
  for (const f of failures) {
    console.log(`  - ${f.label}${f.details ? ` : ${f.details}` : ''}`);
  }
}
console.log(`\nRésultat : ${passed} PASS, ${failed} FAIL`);

if (failed > 0) {
  process.exit(1);
}
