import { createDefaultCoreModule, createDefaultSharedCoreModule, inject, EmptyFileSystem } from 'langium';
import { BPScriptGeneratedModule, BPScriptGeneratedSharedModule } from './js/generated/module.js';
const shared = inject(createDefaultSharedCoreModule(EmptyFileSystem), BPScriptGeneratedSharedModule);
const services = inject(createDefaultCoreModule({ shared }), BPScriptGeneratedModule);
shared.ServiceRegistry.register(services);
const parse = (t) => services.parser.LangiumParser.parse(t);

console.log('=== 1. CE QUE LE FRAGMENT DECRIT est accepte ===');
for (const s of ['@core\nS -> C4 D4 E4', '@alphabet.sargam\nS -> sa re ga', 'S -> {A B, C D} E',
                 'S -> C4 - _ 2 D4', 'S <> A B\nT <- C D']) {
  const r = parse(s + '\n');
  const n = [...(r.lexerErrors||[]), ...(r.parserErrors||[])].length;
  console.log('  ' + (n===0?'ok    ':'REFUSE') + '  ' + JSON.stringify(s.replace(/\n/g,' ⏎ ')));
}

console.log('\n=== 2. L ARBRE QU IL EN TIRE ===');
const r = parse('@core\nS -> C4 {A B, C} -\n');
const regle = r.value.subgrammars[0].rules[0];
console.log('  regle :', regle.lhs.name, regle.arrow);
for (const e of regle.rhs) {
  const d = e.$type === 'SymbolRef' ? e.name : e.$type === 'Polymetric'
    ? e.voices.map(v => v.elements.map(x => x.name ?? x.value ?? x.$type).join(' ')).join(' | ') : e.value;
  console.log('    ' + String(e.$type).padEnd(16), JSON.stringify(d));
}

console.log('\n=== 3. LA GESTION D ERREUR, telle qu elle vient — rien d ecrit a la main ===');
for (const s of ['S -> \n', 'S C4 D4\n', 'S -> {A B, C\n']) {
  const e = [...(parse(s).lexerErrors||[]), ...(parse(s).parserErrors||[])][0];
  console.log('  ' + JSON.stringify(s));
  console.log('     ligne ' + (e?.token?.startLine ?? '?') + ', colonne ' + (e?.token?.startColumn ?? '?')
              + ' — ' + (e?.message||'').replace(/\s+/g,' ').slice(0, 96));
}
