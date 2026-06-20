// Garde-fou : scellage des params SCOPE-RÈGLE dans payload.params de chaque note.
// Arbitrage E016 (2026-06-20, Romain d'accord) : BPx transporte la charge opaque et ne
// PROPAGE PAS le qualificateur de règle. Le transpileur scelle donc, au transpile, les params
// de portée règle (`Bass -> C2 D2 (wave:sawtooth)`) dans le payload.params de CHAQUE note.
// PRÉCÉDENCE (fusion, pas écrasement) : note > règle. Un override propre à une note gagne.
import { compileToBPxAST } from '../src/transpiler/bpxAst.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }

const SOUND = new Set(['Symbol', 'SymbolCall', 'OutTimeObject', 'TieStart', 'TieContinue', 'TieEnd']);
function leaves(els, out = []) {
  for (const el of els || []) {
    if (!el || typeof el !== 'object') continue;
    if (SOUND.has(el.type)) out.push(el);
    else if (el.type === 'Polymetric') for (const v of el.voices || []) leaves(v, out);
    else if (el.type === 'SimultaneousGroup') { if (el.primary) leaves([el.primary], out); leaves(el.secondaries || [], out); }
  }
  return out;
}
function rhsLeaves(src) {
  const { ast, errors } = compileToBPxAST(src);
  if (errors && errors.length) console.log('  (errors:', JSON.stringify(errors), ')');
  const rule = ast.subgrammars[0].rules[0];
  return leaves(rule.rhs).map((l) => ({ name: l.name, params: l.payload && l.payload.params }));
}
const HEAD = '@controls\n@alphabet.western:browser\n';

// 1. Scope-règle scellé sur TOUTES les notes
{
  const L = rhsLeaves(HEAD + 'S -> C4 E4 (vel:80)\n');
  check(L.length === 2, '1: 2 notes, obtenu ' + L.length);
  check(L.every((n) => n.params && n.params.vel === 80), '1: vel:80 sur chaque note :: ' + JSON.stringify(L));
}

// 2. Override par note GAGNE sur le scope-règle (même clé)
{
  const L = rhsLeaves(HEAD + 'S -> C4(vel:20) E4 (vel:80)\n');
  const c4 = L.find((n) => n.name === 'C4'), e4 = L.find((n) => n.name === 'E4');
  check(c4 && c4.params.vel === 20, '2: C4 garde son override vel:20, obtenu ' + JSON.stringify(c4));
  check(e4 && e4.params.vel === 80, '2: E4 prend le scope-règle vel:80, obtenu ' + JSON.stringify(e4));
}

// 3. Fusion de clés DIFFÉRENTES (note wave:square + règle vel:80)
{
  const L = rhsLeaves(HEAD + 'S -> C4(wave:square) E4 (vel:80)\n');
  const c4 = L.find((n) => n.name === 'C4');
  check(c4 && c4.params.wave === 'square' && c4.params.vel === 80,
    '3: C4 fusionne wave(note)+vel(règle), obtenu ' + JSON.stringify(c4));
}

// 4. Scope-RÈGLE atteint les notes À L'INTÉRIEUR d'une polymétrie + la note hors-poly.
//    NB : `{C4,E4} (vel:80)` seul attache le qualificateur au GROUPE (scope séquence, hors
//    périmètre) ; on force le scope-règle en ajoutant une note après la polymétrie.
{
  const L = rhsLeaves(HEAD + 'S -> {C4, E4} F4 (vel:80)\n');
  check(L.length === 3, '4: 3 notes (C4,E4 in poly + F4), obtenu ' + L.length);
  check(L.every((n) => n.params && n.params.vel === 80),
    '4: scope-règle scellé sur les 3 notes (récursion polymétrie) :: ' + JSON.stringify(L));
}

// 5. Sans scope-règle : pas de params parasites
{
  const L = rhsLeaves(HEAD + 'S -> C4 E4\n');
  check(L.every((n) => !n.params), '5: aucun param scellé sans qualificateur de règle :: ' + JSON.stringify(L));
}

console.log(`${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
