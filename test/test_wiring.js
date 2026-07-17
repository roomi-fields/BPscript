// test_wiring.js — Câblage son (LANG-SONS §9) : opérateurs >> / !>> + corps @macro câblage.
// Vérifie le PARSER/AST (PORTER≠RÉSOUDRE : BPScript émet le Wiring, l'aval résout).
import { compileToBPxAST } from '../src/transpiler/bpxAst.js';
import { compileBPS } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function ok(name, cond) { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name); } }

function macros(src) {
  const r = compileToBPxAST('@core\n@controls\n' + src + '\nS -> lead');
  return { errors: r.errors, macros: r.ast?.macros || [] };
}

console.log('=== Câblage >> / !>> ===');

// 1. Série simple : saw >> lpf >> audio
{
  const { errors, macros: m } = macros('@macro lead = saw >> lpf >> audio');
  ok('série 3 étages, 0 erreur', errors.length === 0 && m[0].body[0].type === 'Wiring');
  ok('3 étages câblés', eq(m[0].body[0].stages.map((s) => s.module), ['saw', 'lpf', 'audio']));
  ok('aucun cut sur une série', m[0].body[0].stages.every((s) => s.cut === false));
}

// 2. Ports + valeurs (ref, backtick, nombre)
{
  const { macros: m } = macros('@macro v = saw.freq: pitch >> lpf.cutoff: `js: lfo(2)` >> audio');
  const s = m[0].body[0].stages;
  ok('port adressé par le point', s[0].module === 'saw' && s[0].port === 'freq');
  ok('valeur ref (pitch)', eq(s[0].value, { kind: 'ref', name: 'pitch' }));
  ok('valeur backtick typée', s[1].value.kind === 'backtick' && s[1].value.tag === 'js');
  ok('étage terminal sans port ni valeur', s[2].module === 'audio' && s[2].port === null);
}

// 3. Valeur nombre + unité
{
  const { macros: m } = macros('@macro d = env.decay: 350ms >> audio');
  ok('valeur nombre + unité', eq(m[0].body[0].stages[0].value, { kind: 'number', value: 350, unit: 'ms' }));
}

// 4. Débranchement !>> (patchbay dynamique)
{
  const { errors, macros: m } = macros('@macro mute = !>> out.in');
  ok('!>> = Wiring cut, 0 erreur', errors.length === 0 && m[0].body[0].type === 'Wiring' && m[0].body[0].cut === true);
  ok('cible du cut', m[0].body[0].stages[0].module === 'out' && m[0].body[0].stages[0].port === 'in');
}

// 5. Cut en milieu de chaîne : a >> b !>> c
{
  const { macros: m } = macros('@macro cx = a >> b !>> c');
  const s = m[0].body[0].stages;
  ok('lien >> non-cut, lien !>> cut', s[1].cut === false && s[2].cut === true);
}

// 6. Substitution INCHANGÉE (corps sans >> = ancien @macro)
{
  const { errors, macros: m } = macros('@macro accent(x) = x(vel:120)');
  ok('substitution reste RhsElement (pas Wiring)', errors.length === 0 && m[0].body[0].type !== 'Wiring');
}

// 7. BP3 byte : un câblage n'apparaît pas dans la grammaire BP3 (feature BPScript/BPx)
{
  const r = compileBPS('@core\n@controls\n@macro lead = saw >> lpf >> audio\nS -> Sa');
  ok('compileBPS ne crashe pas sur un câblage', typeof r.grammar === 'string');
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
