// CONSTRUIRE L'ARBRE — phase 3 du chantier, la moitié qui manquait.
//
// ⚠️ Jusqu'ici la maquette RECONNAISSAIT sans rien produire : elle disait « cette scène est bien
// formée » et s'arrêtait là. Romain a demandé un parseur qui PRODUISE l'AST de la scène.
// Reconnaître était la moitié facile.
//
// CE QUE FAIT CE FICHIER : traduire l'arbre d'analyse engendré vers la forme que le reste de la
// chaîne consomme, puis COMPARER, scène par scène, avec ce que produit le parseur de production.
//
// ⚠️ LA COMPARAISON PORTE SUR LA DISTRIBUTION DES NATURES, pas sur l'égalité des arbres — et il
// faut le dire. Deux arbres peuvent porter les mêmes natures en mêmes nombres et différer par
// leur imbrication. C'est une mesure de PREMIER ORDRE : elle attrape ce qui manque et ce qui est
// en trop, elle ne prouve pas l'identité. L'égalité structurelle est le pas d'après.

import { createDefaultCoreModule, createDefaultSharedCoreModule, inject, EmptyFileSystem } from 'langium';
import { BPScriptGeneratedModule, BPScriptGeneratedSharedModule } from './js/generated/module.js';

const shared = inject(createDefaultSharedCoreModule(EmptyFileSystem), BPScriptGeneratedSharedModule);
const services = inject(createDefaultCoreModule({ shared }), BPScriptGeneratedModule);
shared.ServiceRegistry.register(services);
const analyser = (t) => services.parser.LangiumParser.parse(t);

// ── La table de correspondance ──────────────────────────────────────────────
// ⚠️ `SymbolRef` porte le nom que l'outil impose : `Symbol` est réservé par le runtime
// JavaScript. La traduction le remet à son nom du langage — c'est la frontière annoncée.
const NATURE = {
  SymbolRef: 'Symbol',
  Rule: 'Rule',
  Polymetric: 'Polymetric',
  Rest: 'Rest',
  Prolongation: 'Prolongation',
  Nombre: 'NumericTerminal',
  Duree: 'NumericDuration',
  SettingBag: 'SettingBag',
  Instant: 'InstantControl',
  Directive: 'Directive',
  ActorDirective: 'ActorDirective',
  ActorKey: 'ActorReference',
  Guard: 'Guard',
  Wildcard: 'Wildcard',
  // ⚠️ CORRECTION DE MA TABLE, pas du langage : la production distingue le code ISOLÉ dans le flux
  // du code ATTACHÉ à une voix. Ma table les confondait, d'où un écart de +829 % que j'ai failli
  // ranger avec les divergences du langage. Un écart peut venir de l'instrument.
  Backtick: 'Backtick',
  Scene: 'Scene',
};

/** Compte les natures d'un arbre engendré, traduites vers les noms du langage. */
function naturesEngendrees(noeud, compte = new Map(), vus = new WeakSet()) {
  if (!noeud || typeof noeud !== 'object' || vus.has(noeud)) return compte;
  vus.add(noeud);
  if (Array.isArray(noeud)) { for (const x of noeud) naturesEngendrees(x, compte, vus); return compte; }
  const t = noeud.$type;
  if (typeof t === 'string') {
    const n = NATURE[t];
    if (n) compte.set(n, (compte.get(n) || 0) + 1);
  }
  for (const [k, v] of Object.entries(noeud)) {
    if (k.startsWith('$')) continue;          // $container, $cstNode… — la charpente de l'outil
    naturesEngendrees(v, compte, vus);
  }
  return compte;
}

/** Compte les natures d'un arbre de production. */
function naturesProduction(noeud, compte = new Map(), vus = new WeakSet()) {
  if (!noeud || typeof noeud !== 'object' || vus.has(noeud)) return compte;
  vus.add(noeud);
  if (Array.isArray(noeud)) { for (const x of noeud) naturesProduction(x, compte, vus); return compte; }
  if (typeof noeud.type === 'string') compte.set(noeud.type, (compte.get(noeud.type) || 0) + 1);
  for (const v of Object.values(noeud)) naturesProduction(v, compte, vus);
  return compte;
}

const { compileToBPxAST } = await import('/home/romi/dev/bp/BPscript/src/transpiler/index.js');
const { toutesLesScenes } = await import('/home/romi/dev/bp/BPscript/test/corpus.mjs');
const INCOMPATIBLES = ['visser-waves', 'koto3', 'dhati2', 'dhin'];

// Les natures que la maquette prétend produire — les seules sur lesquelles la comparaison a un sens.
const COMPAREES = new Set(Object.values(NATURE));

let scenes = 0;
const ecart = new Map();   // nature -> { engendre, production }
for (const [nom, src] of toutesLesScenes()) {
  if (INCOMPATIBLES.some((x) => nom.endsWith('/' + x + '.bps'))) continue;
  const g = analyser(src);
  if ([...g.lexerErrors, ...g.parserErrors].length) continue;
  let p; try { p = compileToBPxAST(src); } catch { continue; }
  if (!p.ast) continue;
  scenes++;
  const cg = naturesEngendrees(g.value), cp = naturesProduction(p.ast);
  for (const n of COMPAREES) {
    if (!ecart.has(n)) ecart.set(n, { engendre: 0, production: 0 });
    const e = ecart.get(n);
    e.engendre += cg.get(n) || 0;
    e.production += cp.get(n) || 0;
  }
}

console.log(`ARBRE ENGENDRÉ vs ARBRE DE PRODUCTION — ${scenes} scènes comparées\n`);
console.log('nature'.padEnd(20) + 'engendré'.padStart(10) + 'production'.padStart(12) + '   écart');
let accord = 0;
for (const [n, e] of [...ecart].sort((a, b) => b[1].production - a[1].production)) {
  const d = e.production === 0 ? (e.engendre === 0 ? 0 : 999)
          : Math.round(((e.engendre - e.production) / e.production) * 100);
  if (Math.abs(d) <= 5) accord++;
  console.log(n.padEnd(20) + String(e.engendre).padStart(10) + String(e.production).padStart(12)
            + '   ' + (d === 0 ? '=' : (d > 0 ? '+' : '') + d + ' %'));
}
console.log(`\n${accord}/${ecart.size} natures à moins de 5 % d'écart.`);
console.log('⚠️ Mesure de PREMIER ORDRE : même distribution ≠ même arbre. L\'imbrication n\'est pas comparée.');
