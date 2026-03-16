/**
 * BPScript Transpiler — Test
 * Tests with actual .bps scene files
 */

import { readFileSync } from 'fs';
import { tokenize, T } from './tokenizer.js';
import { parse } from './parser.js';
import { encode } from './encoder.js';
import { compileBPS } from './index.js';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES_DIR = join(__dirname, '../../scenes');

function testTokenizer(name, source) {
  console.log(`\n=== TOKENIZER: ${name} ===`);
  const tokens = tokenize(source);
  const significant = tokens.filter(t => t.type !== T.NEWLINE && t.type !== T.COMMENT && t.type !== T.EOF);
  console.log(`${significant.length} tokens`);
  for (const t of significant) {
    console.log(`  ${t.type.padEnd(15)} ${String(t.value).substring(0, 40)}`);
  }
  return tokens;
}

function testParser(name, source) {
  console.log(`\n=== PARSER: ${name} ===`);
  const tokens = tokenize(source);
  const ast = parse(tokens);
  console.log(`Directives: ${ast.directives.length}`);
  console.log(`Declarations: ${ast.declarations.length}`);
  console.log(`Macros: ${ast.macros.length}`);
  console.log(`Backticks: ${ast.backticks.length}`);
  console.log(`Subgrammars: ${ast.subgrammars.length}`);
  for (const sub of ast.subgrammars) {
    console.log(`  Subgrammar ${sub.index}: ${sub.rules.length} rules`);
    for (const rule of sub.rules) {
      const guard = rule.guard ? `when ${rule.guard.flag}${rule.guard.operator}${rule.guard.value}` : '';
      const lhs = rule.lhs.map(e => e.name || e.type).join(' ');
      const rhsTypes = rule.rhs.map(e => e.type).join(', ');
      console.log(`    ${guard} ${lhs} ${rule.arrow} [${rhsTypes}]`);
    }
  }
  return ast;
}

function testFull(name, source) {
  console.log(`\n=== FULL TRANSPILE: ${name} ===`);
  const result = compileBPS(source);
  if (result.errors.length > 0) {
    console.log('ERRORS:');
    for (const err of result.errors) console.log(`  ${err.message}`);
  }
  if (result.grammar) {
    console.log('--- BP3 Grammar ---');
    console.log(result.grammar);
    console.log('--- Alphabet ---');
    console.log(result.alphabet.join(', ') || '(empty)');
  } else {
    console.log('(no grammar produced)');
    if (result.ast) {
      console.log(`AST: ${result.ast.directives.length} dirs, ${result.ast.declarations.length} decls, ${result.ast.subgrammars.length} subs`);
      for (const sub of result.ast.subgrammars) {
        console.log(`  Sub ${sub.index}: ${sub.rules.length} rules`);
      }
    }
  }
  console.log('---');
}

// --- Run tests ---

function loadScene(name) {
  return readFileSync(`${SCENES_DIR}/${name}`, 'utf-8');
}

try {
  // Test 1: drum
  const drum = loadScene('drum.bps');
  testTokenizer('drum', drum);
  testParser('drum', drum);
  testFull('drum', drum);

  // Test 2: flags — debug step by step
  const flags = loadScene('flags.bps');
  testTokenizer('flags', flags);
  try {
    testParser('flags', flags);
  } catch(e) {
    console.log('PARSER ERROR:', e.message);
  }
  testFull('flags', flags);

  // Test 3: acceleration
  testFull('acceleration', loadScene('acceleration.bps'));

  // Test 4: templates
  testFull('templates', loadScene('templates.bps'));

  // Test 5: negative-context
  testFull('negative-context', loadScene('negative-context.bps'));

  // Test 6: harmony
  testFull('harmony', loadScene('harmony.bps'));

  // Test 7: mohanam
  testFull('mohanam', loadScene('mohanam.bps'));

  // Test 8: repeat
  testFull('repeat', loadScene('repeat.bps'));

  // Test 9: time-patterns
  testFull('time-patterns', loadScene('time-patterns.bps'));

  // Test 10: transposition
  testFull('transposition', loadScene('transposition.bps'));

  // Test 11: livecode1
  testFull('livecode1', loadScene('livecode1.bps'));

  // Test 12: scales
  testFull('scales', loadScene('scales.bps'));

  // Test 13: not-reich (apostrophes et guillemets dans identifiants)
  testFull('not-reich', loadScene('not-reich.bps'));

  // Test 14: mozart-dice (K-params, LIN mode, solfège français, 158 terminaux)
  testFull('mozart-dice', loadScene('mozart-dice.bps'));

  // Test 15: all-items (templates $X &X, _destru)
  testFull('all-items', loadScene('all-items.bps'));

  // Test 16: one-scale (scales, just intonation, weight:0)
  testFull('one-scale', loadScene('one-scale.bps'));

  // Test 17: visser-shapes (rotate, keyxpand, velcont, float tempo)
  testFull('visser-shapes', loadScene('visser-shapes.bps'));

  // Test 18: look-and-say (quoted symbols, SUB mode, scan:left, flags)
  testFull('look-and-say', loadScene('look-and-say.bps'));

  // Test 19: ames (undetermined rest, ties, nested polymetric ratios)
  testFull('ames', loadScene('ames.bps'));

  // Test 20: graphics (legato, staccato inline)
  testFull('graphics', loadScene('graphics.bps'));

  // Test 21: visser3 (transposition non-terminals, period, polymetric grouping)
  testFull('visser3', loadScene('visser3.bps'));

} catch (err) {
  console.error('TEST ERROR:', err.message);
  console.error(err.stack);
}
