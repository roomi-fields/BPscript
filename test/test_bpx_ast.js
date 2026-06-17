// Test — compileToBPxAST : voie AST BPx PROPRE, SANS ancien format BP3 et SANS table parallèle.
// Directive Romain 2026-06-17 (confirmée BPx + Kanopi) : SOURCE UNIQUE = l'arbre. Tout vit sur
// les nœuds / directives ; le résultat ne renvoie que { ast, errors, warnings }.
import { compileToBPxAST } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }

function backtickNodes(ast) {
  const out = [];
  const walk = (els) => { for (const e of els || []) { if (/Backtick/.test(e.type || '')) out.push(e); if (e.voices) e.voices.forEach(walk); if (e.elements) walk(e.elements); } };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) walk(r.rhs);
  return out;
}

// 1. Résultat = ARBRE SEUL, aucune table parallèle, aucun artefact BP3
{
  const r = compileToBPxAST('@core\nS -> C4 D4');
  check(!!r.ast, 'ast présent');
  check(JSON.stringify(Object.keys(r).sort()) === JSON.stringify(['ast', 'errors', 'warnings']),
    'résultat = { ast, errors, warnings } SEULEMENT, obtenu ' + JSON.stringify(Object.keys(r)));
  check(!('grammar' in r) && !('backticks' in r) && !('flagStates' in r) && !('libraries' in r),
    'aucune table parallèle ni grammaire BP3');
  check(r.ast.subgrammars[0].rules[0].rhs[0].payload?.nature === 'sounding', 'payload par token présent');
}

// 2. Backticks : tout SUR LE NŒUD (_btName + code + interp), pas de table
{
  const r = compileToBPxAST('@core\nS -> C4 `sc: synth(1)` `note("c2")`');
  const bts = backtickNodes(r.ast);
  check(bts.length === 2, 'deux nœuds backtick, obtenu ' + bts.length);
  check(bts.every((n) => n._btName), 'tous _btName posés sur les nœuds');
  check(new Set(bts.map((n) => n._btName)).size === 2, '_btName uniques');
  const sc = bts.find((n) => n.tag === 'sc');
  check(sc && sc.interp === 'sc' && sc.code === 'synth(1)', 'backtick tagué : interp+code sur le nœud : ' + JSON.stringify(sc));
}

// 3. Interp 'auto' résolu SUR LE NŒUD depuis l'eval de l'acteur (tête de règle = acteur)
{
  const r = compileToBPxAST('@actor stru\n  transport.audio\n  eval.strudel\nS -> stru\nstru -> `note("c2")`');
  const bt = backtickNodes(r.ast)[0];
  check(bt && bt.interp === 'strudel', "interp 'auto' → 'strudel' (eval acteur) sur le nœud : " + JSON.stringify(bt && bt.interp));
}

// 4. flagStates LU depuis la directive @flag (pas de table)
{
  const r = compileToBPxAST('@flag scene: calm:1, full:2\n@core\nS -> C4');
  const fd = (r.ast.directives || []).find((d) => d.type === 'FlagStatesDirective' && d.flag === 'scene');
  check(!!fd, 'directive @flag présente dans l\'arbre');
  const m = Object.fromEntries((fd?.states || []).map((s) => [s.name, s.value]));
  check(m.calm === 1 && m.full === 2, 'états lisibles depuis la directive : ' + JSON.stringify(m));
}

// 5. libraries LU depuis la directive @library (pas de table)
{
  const r = compileToBPxAST('@library.strudel "dirt-samples"\n@core\nS -> C4');
  const ld = (r.ast.directives || []).find((d) => d.type === 'LibraryDirective');
  check(ld?.engine === 'strudel' && ld?.name === 'dirt-samples', '@library lisible depuis la directive : ' + JSON.stringify(ld));
}

// 6. acteurs : references[] (ActorReference) + sceneTable depuis ast.scenes (pas de table)
{
  const r = compileToBPxAST('@actor tabla\n  alphabet.tabla\n  transport.midi(ch:10)\n@scene verse "verse.bps"\nS -> tabla.Sa');
  const tr = r.ast.actors[0].references?.find((x) => x.category === 'transport');
  check(tr?.type === 'ActorReference' && tr?.name === 'midi' && tr?.params?.ch === 10,
    'ActorReference transport sur le nœud acteur : ' + JSON.stringify(tr));
  check(r.ast.scenes?.[0]?.name === 'verse' && r.ast.scenes?.[0]?.file === 'verse.bps',
    'scène lisible depuis ast.scenes : ' + JSON.stringify(r.ast.scenes));
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
