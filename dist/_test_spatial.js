import { compileBPS } from '../src/transpiler/index.js';
import { registerLib, clearRegistry } from '../src/transpiler/libs.js';
import { readFileSync } from 'fs';

const libDir = new URL('../lib/', import.meta.url).pathname;
for (const name of ['alphabet', 'controls', 'core', 'routing', 'settings', 'sub', 'filter']) {
  try {
    registerLib(name, JSON.parse(readFileSync(`${libDir}${name}.json`, 'utf-8')));
  } catch {}
}

const source = readFileSync(new URL('../web/demos/cv-lfo.bps', import.meta.url).pathname, 'utf-8');
console.log('=== SOURCE ===');
console.log(source);

const result = compileBPS(source);
console.log('\n=== ERRORS ===');
console.log(result.errors.length ? result.errors : 'none');

console.log('\n=== GRAMMAR ===');
console.log(result.grammar);

console.log('\n=== CV TABLE ===');
console.log(JSON.stringify(result.cvTable, null, 2));

console.log('\n=== CONTROL TABLE ===');
console.log(JSON.stringify(result.controlTable, null, 2));

console.log('\n=== ALPHABET (custom terminals only) ===');
const alphaLines = (result.alphabetFile || '').split('\n');
const custom = alphaLines.filter(l => !l.startsWith('//') && !l.startsWith('OCT') && !l.includes(' --> '));
console.log(custom.length ? custom.join('\n') : '(none besides notes)');

console.log('\n=== AST cvInstances ===');
console.log(JSON.stringify(result.ast.cvInstances, null, 2));

console.log('\n=== AST subgrammars ===');
for (const sub of result.ast.subgrammars) {
  console.log(`Subgrammar ${sub.index} (mode: ${sub.mode || 'default'}):`);
  for (const rule of sub.rules) {
    const lhs = rule.lhs.map(e => e.name || e.type).join(' ');
    const rhs = rule.rhs.map(e => {
      if (e.type === 'Polymetric') return `{${e.voices.length} voices}`;
      if (e.type === 'Symbol') return e.name;
      return e.type;
    }).join(' ');
    console.log(`  ${lhs} ${rule.arrow} ${rhs}`);
  }
}
