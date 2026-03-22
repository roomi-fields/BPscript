import { compileBPS } from '../src/transpiler/index.js';
import { registerLib, clearRegistry } from '../src/transpiler/libs.js';
import { readFileSync } from 'fs';

const libDir = new URL('../lib/', import.meta.url).pathname;
for (const name of ['alphabet', 'controls', 'core', 'routing', 'settings', 'sub', 'filter']) {
  try {
    registerLib(name, JSON.parse(readFileSync(`${libDir}${name}.json`, 'utf-8')));
  } catch {}
}

const demos = ['cv-adsr.bps', 'cv-lfo.bps', 'cv-backtick.bps'];
const demoDir = new URL('../web/demos/', import.meta.url).pathname;

for (const file of demos) {
  const source = readFileSync(`${demoDir}${file}`, 'utf-8');
  const result = compileBPS(source);
  const ok = result.errors.length === 0;
  const cvCount = result.cvTable?.length || 0;
  const ctCount = result.controlTable?.length || 0;
  const hasCV = result.grammar.includes('_script(CV');
  console.log(`${ok ? 'OK' : 'FAIL'} ${file} — CV:${cvCount} CT:${ctCount} dual-token:${hasCV}`);
  if (!ok) console.log('  Errors:', result.errors);
  console.log('  Grammar:', result.grammar.split('\n').filter(l => l.startsWith('gram')).join('\n  '));
}
