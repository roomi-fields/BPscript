// Test — compileToBPxAST : voie AST BPx PROPRE, sans l'ancien format BP3.
// Directive Romain 2026-06-17 : produire l'arbre COMPLET sans recours au traducteur BP3.
import { compileToBPxAST } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }

function backtickNodes(ast) {
  const out = [];
  const walk = (els) => { for (const e of els || []) { if (/Backtick/.test(e.type || '')) out.push(e); if (e.voices) e.voices.forEach(walk); if (e.elements) walk(e.elements); } };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) walk(r.rhs);
  return out;
}

// 1. AST COMPLET, AUCUNE sortie BP3 (pas de grammar/alphabet/settings)
{
  const r = compileToBPxAST('@core\nS -> C4 D4');
  check(!!r.ast, 'ast présent');
  check(!('grammar' in r), 'AUCUNE grammaire BP3 (grammar absent)');
  check(!('alphabet' in r) && !('settings' in r), 'aucun artefact BP3 (alphabet/settings absents)');
  check(r.errors.length === 0, 'compile sans erreur : ' + JSON.stringify(r.errors));
  check(r.ast.subgrammars[0].rules[0].rhs[0].payload?.nature === 'sounding', 'payload par token présent');
}

// 2. Backticks : _btName posé + table cohérente (inline ET standalone), SANS encode
{
  const r = compileToBPxAST('@core\nS -> C4 `sc: synth(1)` `note("c2")`');
  const bts = backtickNodes(r.ast);
  check(bts.length === 2, 'deux nœuds backtick, obtenu ' + bts.length);
  check(bts.every((n) => n._btName), 'tous _btName posés');
  const keys = new Set(Object.keys(r.backticks));
  check(bts.every((n) => keys.has(n._btName)), '_btName ∈ clés backticks');
  const sc = Object.values(r.backticks).find((v) => v.interp === 'sc');
  check(sc && sc.code === 'synth(1)', 'backtick tagué sc capturé');
}

// 3. Interp 'auto' résolu depuis l'eval de l'acteur (tête de règle = acteur)
{
  const r = compileToBPxAST('@actor stru\n  transport.audio\n  eval.strudel\nS -> stru\nstru -> `note("c2")`');
  const vals = Object.values(r.backticks);
  check(vals.length === 1 && vals[0].interp === 'strudel', "interp 'auto' → 'strudel' (eval acteur) : " + JSON.stringify(r.backticks));
}

// 4. flagStates + libraries (tables agnostiques)
{
  const r = compileToBPxAST('@flag scene: calm:1, full:2\n@library.strudel "dirt-samples"\n@core\nS -> C4');
  check(r.flagStates?.scene?.calm === 1 && r.flagStates?.scene?.full === 2, 'flagStates : ' + JSON.stringify(r.flagStates));
  check(JSON.stringify(r.libraries) === JSON.stringify({ strudel: ['dirt-samples'] }), 'libraries : ' + JSON.stringify(r.libraries));
}

// 5. references[] (ActorReference canonique) présent dans l'AST
{
  const r = compileToBPxAST('@actor tabla\n  alphabet.tabla\n  transport.midi(ch:10)\nS -> tabla.Sa');
  const tr = r.ast.actors[0].references?.find((x) => x.category === 'transport');
  check(tr?.type === 'ActorReference' && tr?.name === 'midi' && tr?.params?.ch === 10,
    'ActorReference transport : ' + JSON.stringify(tr));
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
