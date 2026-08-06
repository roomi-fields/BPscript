// Confronte l'analyseur ENGENDRÉ au corpus réel. Mesure, pas démonstration.
import { createDefaultCoreModule, createDefaultSharedCoreModule, inject, EmptyFileSystem } from 'langium';
import { BPScriptGeneratedModule, BPScriptGeneratedSharedModule } from './js/generated/module.js';

const shared = inject(createDefaultSharedCoreModule(EmptyFileSystem), BPScriptGeneratedSharedModule);
const services = inject(createDefaultCoreModule({ shared }), BPScriptGeneratedModule);
shared.ServiceRegistry.register(services);
const parse = (texte) => services.parser.LangiumParser.parse(texte);

const { toutesLesScenes } = await import('/home/romi/dev/bp/BPscript/test/corpus.mjs');
let ok = 0; const echecs = new Map();
for (const [nom, src] of toutesLesScenes()) {
  const r = parse(src);
  const errs = [...(r.lexerErrors || []), ...(r.parserErrors || [])];
  if (errs.length === 0) { ok++; continue; }
  const m = (errs[0].message || '').replace(/\s+/g, ' ').slice(0, 58);
  if (!echecs.has(m)) echecs.set(m, []);
  echecs.get(m).push(nom);
}
const total = ok + [...echecs.values()].reduce((a, b) => a + b.length, 0);
console.log(`analyseur ENGENDRE sur le corpus : ${ok}/${total} scenes acceptees`);
console.log('\n--- ce qu il refuse, par motif ---');
for (const [m, l] of [...echecs].sort((a, b) => b[1].length - a[1].length).slice(0, 8))
  console.log(String(l.length).padStart(4), m);
