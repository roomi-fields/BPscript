// Garde-fou : déclaration de modulateur CV (design Romain 2026-06-20).
// Forme : `cv <nom> : <lib>.<type>(params)` ou `cv <nom> : `code`` — PUREMENT DESCRIPTIVE
// (aucune cible/route sur la déclaration ; le branchement se fait au point de paramètre
// `(cutoff: env1)`, où la valeur peut être un symbole dérivable de la grammaire).
// À distinguer de la double-déclaration temporelle `cv ramp:sc` (type temporel + runtime).
import { compileToBPxAST } from '../src/transpiler/bpxAst.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }
const HEAD = '@mod\n@controls\n@alphabet.western:browser\n';
function ast(src) { return compileToBPxAST(HEAD + src); }
function cvs(r) { return (r.ast.cvInstances || []); }

// 1. Déclaration descriptive : lib.type(namedArgs), pas de cible
{
  const r = ast('cv env1 : mod.adsr(attack:500, decay:2000, sustain:0.6, release:400)\nS -> C2 E2 (cutoff: env1)\nC2 -> C2\nE2 -> E2\n');
  check((r.errors || []).length === 0, '1: 0 erreur, obtenu ' + JSON.stringify(r.errors));
  const c = cvs(r)[0] || {};
  check(cvs(r).length === 1, '1: 1 CVInstance, obtenu ' + cvs(r).length);
  check(c.name === 'env1', '1: name=env1, obtenu ' + c.name);
  check(c.lib === 'mod' && c.objectType === 'adsr', '1: mod.adsr, obtenu ' + c.lib + '.' + c.objectType);
  check(c.namedArgs && c.namedArgs.release === 400, '1: namedArgs.release=400');
  check(c.target === undefined && c.cvin === undefined && c.transport === undefined,
    '1: AUCUNE cible/route sur la déclaration, obtenu ' + JSON.stringify({ t: c.target, c: c.cvin, tr: c.transport }));
}

// 2. Backtick : modulateur custom inline
{
  const r = ast('cv custom : `js: (t,d) => Math.sin(t)`\nS -> C2 (amplitude: custom)\n');
  const c = cvs(r)[0] || {};
  check(c.objectType === 'backtick' && c.lib === null, '2: backtick, lib null');
  check(/Math.sin/.test(c.code || ''), '2: code capté');
}

// 3. Args positionnels
{
  const r = ast('cv env2 : mod.adsr(10, 200, 0.5, 300)\nS -> C2 (cutoff: env2)\n');
  const c = cvs(r)[0] || {};
  check(c.args && c.args.length === 4 && c.args[0] === 10, '3: 4 args positionnels, obtenu ' + JSON.stringify(c.args));
}

// 4. NON-RÉGRESSION : `cv ramp:sc` reste une Declaration temporelle (PAS une CVInstance)
{
  const r = ast('cv ramp:sc\nS -> ramp\n');
  check(cvs(r).length === 0, '4: cv ramp:sc -> 0 CVInstance, obtenu ' + cvs(r).length);
  const d = (r.ast.declarations || [])[0] || {};
  check(d.type === 'Declaration' && d.temporalType === 'cv' && d.name === 'ramp' && d.runtime === 'sc',
    '4: cv ramp:sc -> Declaration cv ramp:sc, obtenu ' + JSON.stringify(d));
}

// 5. Branchement au point de paramètre : la valeur peut être un symbole dérivable
//    (cutoff: Env) où Env -> env1 | env2. Le parser capte la paire {cutoff: Env} ; le résolveur tranche.
{
  const r = ast('cv env1 : mod.adsr(attack:5, decay:150, sustain:0.2, release:400)\n'
    + 'cv env2 : mod.adsr(attack:3, decay:100, sustain:0.2, release:400)\n'
    + 'S -> {Bass Bass, Env Env}\nBass -> C2 C3 (cutoff: Env, wave:square)\nEnv -> env1\nEnv -> env2\n');
  check((r.errors || []).length === 0, '5: 0 erreur, obtenu ' + JSON.stringify(r.errors));
  check(cvs(r).length === 2, '5: 2 modulateurs déclarés, obtenu ' + cvs(r).length);
  const bassRule = r.ast.subgrammars[0].rules.find((rl) => {
    const h = Array.isArray(rl.lhs) ? rl.lhs[0] : rl.lhs; return h && h.name === 'Bass';
  });
  const pairs = bassRule && bassRule.runtimeQualifier && bassRule.runtimeQualifier.pairs || [];
  const cutoff = pairs.find((p) => p.key === 'cutoff');
  check(cutoff && cutoff.value === 'Env', '5: branchement (cutoff: Env) capté, obtenu ' + JSON.stringify(cutoff));
}

console.log(`${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
