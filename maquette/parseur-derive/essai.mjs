// Confronte l'analyseur ENGENDRÉ au corpus réel. Mesure, pas démonstration.
import { createDefaultCoreModule, createDefaultSharedCoreModule, inject, EmptyFileSystem } from 'langium';
import { BPScriptGeneratedModule, BPScriptGeneratedSharedModule } from './js/generated/module.js';

const shared = inject(createDefaultSharedCoreModule(EmptyFileSystem), BPScriptGeneratedSharedModule);
const services = inject(createDefaultCoreModule({ shared }), BPScriptGeneratedModule);
shared.ServiceRegistry.register(services);
const parse = (texte) => services.parser.LangiumParser.parse(texte);

const { toutesLesScenes } = await import('/home/romi/dev/bp/BPscript/test/corpus.mjs');
let ok = 0; const echecs = new Map();
// ⚠️ TROIS SCENES SONT DECLAREES INCOMPATIBLES (decision Romain 2026-08-06, l accolade ne
// traverse plus les regles). Elles sortent du DENOMINATEUR : les compter serait mesurer un
// refus voulu comme un manque de la grammaire.
const INCOMPATIBLES = ['visser-waves', 'koto3', 'dhati2'];
for (const [nom, src] of toutesLesScenes()) {
  if (INCOMPATIBLES.some((x) => nom.endsWith('/' + x + '.bps') || nom === x + '.bps')) continue;
  const r = parse(src);
  const errs = [...(r.lexerErrors || []), ...(r.parserErrors || [])];
  if (errs.length === 0) { ok++; continue; }
  const e = errs[0];
  const ligne = (e.token && e.token.startLine) ? (src.split('\n')[e.token.startLine - 1] || '').trim() : '';
  const m = (e.message || '').replace(/\s+/g, ' ').slice(0, 40);
  if (!echecs.has(m)) echecs.set(m, []);
  echecs.get(m).push(nom + ' | ' + ligne.slice(0, 56));
}
const total = ok + [...echecs.values()].reduce((a, b) => a + b.length, 0);
console.log(`analyseur ENGENDRE sur le corpus : ${ok}/${total} scenes acceptees`);
console.log('\n--- ce qu il refuse, par motif ---');
for (const [m, l] of [...echecs].sort((a, b) => b[1].length - a[1].length).slice(0, 6)) {
  console.log(String(l.length).padStart(4), m);
  for (const x of l.slice(0, 3)) console.log('        ' + x);
}
