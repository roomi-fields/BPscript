#!/usr/bin/env node
// LA SPEC DÉCLARE LES CHAMPS QUE L'ARBRE PORTE — confrontation mécanique `docs/spec/AST.md` ↔ arbre.
//
// POURQUOI CE GARDE EXISTE. Trois écarts spec-contre-code ont été relevés le 2026-08-06, tous de la
// MÊME famille : un champ que l'arbre porte et que la spec ne déclare pas (`Setting.decrement`), un
// champ que la spec nomme autrement que l'arbre (`Rule.scan` là où l'arbre porte `Rule.mode`), un
// nœud que la spec décrit et que l'arbre ne produit jamais (`SpeedChange`). Aucun des trois n'a été
// trouvé par relecture — ils l'ont été en COMPILANT et en regardant les champs. Un quatrième
// dormait dans l'exemple JSON du même document, à quatre cents lignes de la déclaration qu'il
// illustrait : réparer la déclaration seule l'aurait laissé mentir.
//
// « On répare l'endroit où le défaut s'est MONTRÉ, pas l'espace où il peut vivre » : l'espace, ici,
// c'est TOUT nœud déclaré par la spec × TOUT champ que le corpus lui fait porter. Ce garde parcourt
// ce produit croisé au lieu de rappeler qu'il faudrait y penser.
//
// CE QU'IL MESURE, ET CE QU'IL NE MESURE PAS.
//   · Il MORD sur un champ que l'arbre porte et que la spec ne déclare pas — c'est la dérive muette :
//     un consommateur qui lit la spec ne saura jamais que le champ existe.
//   · Il INVENTORIE (sans mordre) les champs déclarés qu'aucune scène ne porte : un champ facultatif
//     rare est légitime, un nœud entièrement absent l'est moins. Le compte est un CLIQUET : il ne
//     peut que descendre.
//   · Il ne dit RIEN du SENS d'un champ. La spec peut décrire juste et se tromper de raison ; aucune
//     compilation ne tranche cela.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { toutesLesScenes } from './corpus.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SPEC = path.join(ICI, '..', 'docs', 'spec', 'AST.md');

// ────────────────────────────────────────────────────────────────────────────
// 1. Ce que la SPEC déclare
// ────────────────────────────────────────────────────────────────────────────
// Forme lue : un bloc clôturé contenant `Nom {` … `}`, chaque ligne intérieure portant
// `champ: type` ou `champ?: type`. C'est la SEULE forme employée par le document ; une
// déclaration écrite autrement ne serait pas vue — d'où le socle plus bas, qui refuse
// qu'un changement de mise en forme vide silencieusement la mesure.
function champsDeclares(texte) {
  const decl = new Map(); // nœud -> Set(champs)
  let nœud = null;
  for (const ligne of texte.split('\n')) {
    const ouvre = ligne.match(/^([A-Z][A-Za-z]*)\s*\{\s*$/);
    if (ouvre) { nœud = ouvre[1]; decl.set(nœud, new Set()); continue; }
    if (nœud && /^\}\s*$/.test(ligne)) { nœud = null; continue; }
    if (!nœud) continue;
    const champ = ligne.match(/^\s{2,}([A-Za-z_][A-Za-z0-9_]*)\??\s*:/);
    if (champ) decl.get(nœud).add(champ[1]);
  }
  return decl;
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Ce que l'ARBRE porte
// ────────────────────────────────────────────────────────────────────────────
function champsPortes() {
  const vus = new Map(); // nœud -> Map(champ -> occurrences)
  const marcher = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(marcher); return; }
    if (typeof x.type === 'string') {
      if (!vus.has(x.type)) vus.set(x.type, new Map());
      const m = vus.get(x.type);
      for (const k of Object.keys(x)) m.set(k, (m.get(k) || 0) + 1);
    }
    // ⚠️ `Setting` N'A PAS DE DISCRIMINANT `type` : ses instances sont les paires d'un
    // `SettingBag`, reconnues par leur PLACE et non par un champ. Sans ce cas, la mesure
    // rendait « Setting : nœud entier jamais produit » sur 601 paires bien présentes —
    // l'instrument aurait menti exactement comme ceux qu'il est là pour attraper.
    if (x.type === 'SettingBag' && Array.isArray(x.pairs)) {
      if (!vus.has('Setting')) vus.set('Setting', new Map());
      const m = vus.get('Setting');
      for (const p of x.pairs) for (const k of Object.keys(p)) m.set(k, (m.get(k) || 0) + 1);
    }
    for (const v of Object.values(x)) marcher(v);
  };
  let compilees = 0;
  for (const [, src] of toutesLesScenes()) {
    let r; try { r = compileToBPxAST(src); } catch { continue; }
    if (!r.ast) continue;
    compilees++; marcher(r.ast);
  }
  return { vus, compilees };
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Le registre des dérogations — nommé, daté, motivé, JAMAIS une liste noire muette
// ────────────────────────────────────────────────────────────────────────────
// Une dérogation SANS BÉNÉFICIAIRE est un trou, pas une tolérance : chaque entrée doit
// désigner un champ qui EXISTE aujourd'hui, sinon le témoin plus bas la déclare périmée.
const DEROGATIONS = [
  // (Une dérogation `*.type` a été écrite puis RETIRÉE à la première exécution : le témoin
  //  ci-dessous a montré qu'elle n'abritait rien — la spec déclare `type` sur chaque nœud.)
  { nœud: '*', champ: 'payload',
    motif: "sceau de nature posé par bpxAst.js, décrit à sa propre section de la spec et non nœud "
         + "par nœud (2026-08-06) — il se pose sur des nœuds de familles trop différentes pour "
         + "être déclaré dans chacun." },
];

// ────────────────────────────────────────────────────────────────────────────
// 4. Le CLIQUET — une base qui ne peut que descendre
// ────────────────────────────────────────────────────────────────────────────
// Chaque entrée est un champ que l'ARBRE porte sans que la SPEC le déclare : une dette
// mesurée le 2026-08-06, pas une permission. Retirer une ligne quand la spec la couvre ;
// en ajouter une exige de dire pourquoi la spec ne peut pas la dire.
// Mesurée le 2026-08-06, première exécution : 23 champs. Le motif dit POURQUOI la ligne existe
// encore, jamais « on verra plus tard ».
const DETTE = new Set([
  // Le vestige en cours de retrait — sa ligne SORT le jour où le sac disparaît, et le cliquet
  // rougira si elle survit à son sujet.
  'Rule.qualifiers', 'Polymetric.qualifiers', 'Wait.qualifiers',
  // Champs de la SCÈNE que la spec ne détaille pas encore, nœud par nœud.
  'Scene.scenes', 'Scene.exposes', 'Scene.inputs', 'Scene.aliases', 'Scene.declarations',
  'Scene.macros', 'Scene.cvInstances', 'Scene.soundPrototypes', 'Scene.soundAssignments',
  // Champs de DIRECTIVE et d'ACTEUR portés par l'arbre, absents de leur déclaration.
  'Directive.runtime', 'Directive.aliases', 'Directive.modifiers', 'Directive.timePatterns',
  'ActorDirective.values', 'ActorDirective.libRefs', 'ActorReference.line',
  'Subgrammar.modifiers',
  // Divers : diagnostic de lint porté sur la règle, étiquette de bloc, suffixes de bloc.
  'Rule.warnings', 'Polymetric.label', 'Polymetric.suffixQualifiers',
]);

// ────────────────────────────────────────────────────────────────────────────
// 5. La confrontation
// ────────────────────────────────────────────────────────────────────────────
function confronter() {
  const decl = champsDeclares(readFileSync(SPEC, 'utf-8'));
  const { vus, compilees } = champsPortes();

  // SOCLE — une mesure qui tourne sur rien sortirait au vert en ne prouvant rien.
  if (decl.size < 20) throw new Error(`SOCLE : ${decl.size} nœuds lus dans AST.md — la forme de déclaration a changé, ce garde ne voit plus rien`);
  if (compilees < 150) throw new Error(`SOCLE : ${compilees} scènes compilées — le corpus est absent ou muet`);

  const derogAppliquee = new Set();
  const deroge = (n, c) => DEROGATIONS.some(d => {
    const touche = (d.nœud === '*' || d.nœud === n) && d.champ === c;
    if (touche) derogAppliquee.add(`${d.nœud}.${d.champ}`);
    return touche;
  });

  const nonDeclares = [];   // l'arbre porte, la spec ignore  → MORD
  const nonPortes = [];     // la spec déclare, aucune scène ne porte → inventaire
  for (const [nœud, champs] of decl) {
    const porte = vus.get(nœud);
    if (!porte) { nonPortes.push(`${nœud} (nœud entier — aucune scène ne le produit)`); continue; }
    for (const c of champs) if (!porte.has(c)) nonPortes.push(`${nœud}.${c}`);
    for (const c of porte.keys()) {
      if (champs.has(c) || deroge(nœud, c)) continue;
      nonDeclares.push({ cle: `${nœud}.${c}`, n: porte.get(c) });
    }
  }
  return { decl, vus, compilees, nonDeclares, nonPortes, derogAppliquee };
}

const r = confronter();
let rouge = false;

console.log(`AST.md déclare ${r.decl.size} nœuds ; ${r.compilees} scènes compilées, ${r.vus.size} natures de nœud rencontrées.\n`);

// ── Témoin des dérogations : chacune doit servir quelqu'un ──────────────────
for (const d of DEROGATIONS) {
  const cle = `${d.nœud}.${d.champ}`;
  if (!r.derogAppliquee.has(cle)) {
    console.log(`❌ DÉROGATION SANS BÉNÉFICIAIRE : ${cle} n'abrite plus rien — elle s'enlève.`);
    rouge = true;
  }
}

// ── Ce qui MORD : l'arbre porte, la spec ne le dit pas ──────────────────────
const nouveaux = r.nonDeclares.filter(x => !DETTE.has(x.cle));
if (nouveaux.length) {
  console.log(`❌ ${nouveaux.length} champ(s) portés par l'arbre et ABSENTS de la spec :`);
  for (const x of nouveaux.sort((a, b) => b.n - a.n)) console.log(`     ${String(x.n).padStart(6)} × ${x.cle}`);
  rouge = true;
} else {
  console.log(`✅ aucun champ hors spec (dette portée : ${DETTE.size}).`);
}

// ── CLIQUET : la dette ne remonte pas, et une ligne réparée doit sortir ─────
const dettePerimee = [...DETTE].filter(c => !r.nonDeclares.some(x => x.cle === c));
if (dettePerimee.length) {
  console.log(`❌ ${dettePerimee.length} ligne(s) de dette PÉRIMÉE(S) — la spec les couvre, elles sortent :`);
  for (const c of dettePerimee) console.log(`     ${c}`);
  rouge = true;
}

// ── Inventaire (ne mord pas) : déclaré mais jamais porté ────────────────────
if (r.nonPortes.length) {
  console.log(`\nℹ️  ${r.nonPortes.length} champ(s)/nœud(s) déclarés qu'aucune scène ne porte —`);
  console.log(`    facultatif rare ou description périmée ; à lire, pas à corriger en aveugle :`);
  for (const c of r.nonPortes.slice(0, 40)) console.log(`     ${c}`);
  if (r.nonPortes.length > 40) console.log(`     … et ${r.nonPortes.length - 40} autres`);
}

process.exit(rouge ? 1 : 0);
