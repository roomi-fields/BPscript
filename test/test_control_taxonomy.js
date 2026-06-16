// Garde-fou : taxonomie des contrôles (décision contrôles, Romain 2026-06-16).
// Trois formes distinctes, l'AST les sépare pour que BPx route :
//   - bang  xxx:N      → instant (sans durée)        [InstantControl / hors ce test]
//   - parens xxx(N)    → transport-BPx (runtime)      [Control category:'transport-bpx']
//   - underscore _xxx(N) → transport-BP3 (BP3 only)   [Control category:'transport-bp3']
// + sonnant (Symbol), prolongation (Prolongation), silence (Rest), marqueur.
// BUG corrigé : `_xxx(N)` nu NE DOIT PAS être coupé en `_` (prolongation) + sonnant.
import { tokenize } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';
import { compileBPS } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }
function rhs(src) { return parse(tokenize(`@core\nS -> ${src}`)).subgrammars[0].rules[0].rhs; }

// 1. BUG : `_transpose(2)` = UN seul Control transport-bp3, AUCUNE prolongation parasite
{
  const r = rhs('_transpose(2)');
  check(r.length === 1, '_transpose(2) = 1 élément, obtenu ' + r.length + ' : ' + JSON.stringify(r));
  check(r[0] && r[0].type === 'Control', 'type Control, obtenu ' + (r[0] && r[0].type));
  check(r[0] && r[0].name === 'transpose', 'name=transpose');
  check(r[0] && r[0].category === 'transport-bp3', "category=transport-bp3, obtenu " + (r[0] && r[0].category));
  check(!r.some((e) => e.type === 'Prolongation'), 'aucune Prolongation parasite');
}

// 2. `_pitchbend(-200)` (argument négatif) → Control transport-bp3
{
  const r = rhs('_pitchbend(-200)');
  check(r.length === 1 && r[0].type === 'Control' && r[0].category === 'transport-bp3', '_pitchbend(-200) = Control transport-bp3 : ' + JSON.stringify(r));
  check(r[0] && r[0].args[0] === '-200', 'arg = -200');
}

// 3. dans une séquence : sonnant / transport-bp3 / sonnant proprement séparés
{
  const r = rhs('C4 _transpose(2) D4');
  check(r.length === 3, 'C4 _transpose(2) D4 = 3 éléments, obtenu ' + r.length);
  check(r[0].type === 'Symbol' && r[2].type === 'Symbol' && r[1].type === 'Control', 'sonnant/Control/sonnant');
}

// 4. RÉGRESSION : `_` nu (prolongation) et `-` (silence) inchangés
{
  const r = rhs('C4 _ -');
  check(r[1] && r[1].type === 'Prolongation', '`_` nu reste Prolongation');
  check(r[2] && r[2].type === 'Rest', '`-` reste Rest (silence)');
}

// 5. ENCODE : `_transpose(2)` → forme BP3 native `_transpose(2)` (pas `_ transpose`)
{
  const g = compileBPS('@core\nS -> C4 _transpose(2) D4');
  check(g.errors.length === 0, 'compile sans erreur : ' + JSON.stringify(g.errors));
  check(/_transpose\(2\)/.test(g.grammar), 'grammaire BP3 contient _transpose(2) : ' + JSON.stringify(g.grammar));
  check(!/_ transpose/.test(g.grammar), 'pas de "_ transpose" parasite');
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
