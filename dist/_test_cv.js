import { compileBPS } from '../src/transpiler/index.js';
import { registerLib } from '../src/transpiler/libs.js';
import { readFileSync } from 'fs';

// Register libs
const libDir = new URL('../lib/', import.meta.url).pathname;
for (const name of ['alphabet', 'controls', 'core', 'routing', 'settings', 'sub', 'filter']) {
  try {
    const data = JSON.parse(readFileSync(`${libDir}${name}.json`, 'utf-8'));
    registerLib(name, data);
  } catch {}
}

// Test CV ADSR demo
const source = `@filter
@core
@controls
@alphabet.western:browser
@mm:120

env1(Phrase1, browser) = filter.adsr(10, 200, 0.5, 300)

S -> {Phrase1, env1 -}

Phrase1 -> [wave:sawtooth, vel:90] C3 E3 G3 C4`;

const result = compileBPS(source);

console.log('=== CV ADSR Compilation ===');
console.log('Errors:', result.errors.length ? result.errors : 'none');
console.log('\n--- Grammar ---');
console.log(result.grammar);
console.log('\n--- Alphabet ---');
console.log(result.alphabetFile || '(empty)');
console.log('\n--- CV Table ---');
console.log(JSON.stringify(result.cvTable, null, 2));
console.log('\n--- Control Table ---');
console.log(JSON.stringify(result.controlTable, null, 2));

// Verify dual-token presence
const hasCV0 = result.grammar.includes('_script(CV0)');
const hasEnv1 = result.grammar.includes('env1');
console.log(`\n--- Checks ---`);
console.log(`Grammar has _script(CV0): ${hasCV0}`);
console.log(`Grammar has env1: ${hasEnv1}`);
console.log(`cvTable has entries: ${result.cvTable.length > 0}`);
console.log(`cvTable[0].args.attack: ${result.cvTable[0]?.args?.attack}`);
