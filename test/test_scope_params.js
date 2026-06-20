// Garde-fou : scellage des params de TOUS les scopes contextuels dans payload.params de
// chaque note. Arbitrage E016 (Romain 2026-06-20) : BPx transporte la charge opaque et ne
// PROPAGE aucun contrôle contextuel. Le transpileur scelle donc, au transpile, les params
// de portée règle, de portée groupe (imbriquée) et les mutations de flux `!(…)` sur chaque note.
// PRÉCÉDENCE (par localité) : règle < groupe externe < groupe interne < flux < override de note.
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
{
  const L = rhsLeaves(HEAD + 'S -> {C4, E4} F4 (vel:80)\n');
  check(L.length === 3, '4: 3 notes (C4,E4 in poly + F4), obtenu ' + L.length);
  check(L.every((n) => n.params && n.params.vel === 80),
    '4: scope-règle scellé sur les 3 notes (récursion polymétrie) :: ' + JSON.stringify(L));
}

// 5. Sans aucun scope : pas de params parasites
{
  const L = rhsLeaves(HEAD + 'S -> C4 E4\n');
  check(L.every((n) => !n.params), '5: aucun param scellé sans scope :: ' + JSON.stringify(L));
}

// 6. Scope-GROUPE `{C4,E4}(vel:80)` : scellé sur les notes du groupe
{
  const L = rhsLeaves(HEAD + 'S -> {C4, E4}(vel:80)\n');
  check(L.length === 2 && L.every((n) => n.params && n.params.vel === 80),
    '6: scope-groupe scellé :: ' + JSON.stringify(L));
}

// 7. Groupes IMBRIQUÉS : interne écrase externe, fusion des clés différentes
//    { {C4 E4}(vel:50) G4 }(wave:sawtooth) → C4,E4 = {vel:50, wave:saw} ; G4 = {wave:saw}
{
  const L = rhsLeaves(HEAD + 'S -> { {C4 E4}(vel:50) G4 }(wave:sawtooth)\n');
  const c4 = L.find((n) => n.name === 'C4'), g4 = L.find((n) => n.name === 'G4');
  check(c4 && c4.params.vel === 50 && c4.params.wave === 'sawtooth',
    '7: C4 = groupe interne vel:50 + externe wave :: ' + JSON.stringify(c4));
  check(g4 && g4.params.wave === 'sawtooth' && g4.params.vel === undefined,
    '7: G4 = externe wave seul (pas de vel:50) :: ' + JSON.stringify(g4));
}

// 8. Mutation de FLUX `!(vel:80)` : scelle les notes SUIVANTES, pas les précédentes
{
  const L = rhsLeaves(HEAD + 'S -> C4 !(vel:80) E4 G4\n');
  const c4 = L.find((n) => n.name === 'C4'), e4 = L.find((n) => n.name === 'E4'), g4 = L.find((n) => n.name === 'G4');
  check(c4 && !c4.params, '8: C4 (avant mutation) sans param :: ' + JSON.stringify(c4));
  check(e4 && e4.params.vel === 80 && g4 && g4.params.vel === 80,
    '8: E4 et G4 (après mutation) prennent vel:80 :: ' + JSON.stringify([e4, g4]));
}

// 9. Mutation de flux + override de note : la note gagne
{
  const L = rhsLeaves(HEAD + 'S -> !(vel:80) C4(vel:30) E4\n');
  const c4 = L.find((n) => n.name === 'C4'), e4 = L.find((n) => n.name === 'E4');
  check(c4 && c4.params.vel === 30, '9: C4 override gagne sur le flux :: ' + JSON.stringify(c4));
  check(e4 && e4.params.vel === 80, '9: E4 prend le flux :: ' + JSON.stringify(e4));
}

// 10. Flux > groupe (par localité) : mutation à l'intérieur du groupe écrase le scope-groupe
//     {C4 !(vel:80) E4}(vel:50) → C4 = 50 (avant mutation), E4 = 80 (mutation > groupe)
{
  const L = rhsLeaves(HEAD + 'S -> {C4 !(vel:80) E4}(vel:50)\n');
  const c4 = L.find((n) => n.name === 'C4'), e4 = L.find((n) => n.name === 'E4');
  check(c4 && c4.params.vel === 50, '10: C4 = groupe vel:50 :: ' + JSON.stringify(c4));
  check(e4 && e4.params.vel === 80, '10: E4 = mutation vel:80 (> groupe) :: ' + JSON.stringify(e4));
}

console.log(`${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
