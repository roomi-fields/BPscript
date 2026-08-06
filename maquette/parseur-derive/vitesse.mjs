import { createDefaultCoreModule, createDefaultSharedCoreModule, inject, EmptyFileSystem } from 'langium';
import { BPScriptGeneratedModule, BPScriptGeneratedSharedModule } from './js/generated/module.js';
const shared = inject(createDefaultSharedCoreModule(EmptyFileSystem), BPScriptGeneratedSharedModule);
const services = inject(createDefaultCoreModule({ shared }), BPScriptGeneratedModule);
shared.ServiceRegistry.register(services);
const parse = (t) => services.parser.LangiumParser.parse(t);

const { compileToBPxAST } = await import('/home/romi/dev/bp/BPscript/src/transpiler/index.js');
const { toutesLesScenes } = await import('/home/romi/dev/bp/BPscript/test/corpus.mjs');
const scenes = toutesLesScenes();
const octets = scenes.reduce((a, [, s]) => a + s.length, 0);

// chauffe
for (const [, s] of scenes.slice(0, 20)) { parse(s); try { compileToBPxAST(s); } catch {} }

let t = process.hrtime.bigint();
for (const [, s] of scenes) parse(s);
const tGen = Number(process.hrtime.bigint() - t) / 1e6;

t = process.hrtime.bigint();
for (const [, s] of scenes) { try { compileToBPxAST(s); } catch {} }
const tMain = Number(process.hrtime.bigint() - t) / 1e6;

const f = (ms) => (ms / scenes.length).toFixed(2) + ' ms/scène  (' + ms.toFixed(0) + ' ms pour ' + scenes.length + ')';
console.log('corpus :', scenes.length, 'scènes,', (octets / 1024).toFixed(0), 'Ko');
console.log('  analyseur ENGENDRÉ (analyse seule)      :', f(tGen));
console.log('  parseur ACTUEL (analyse + scellement)   :', f(tMain));
