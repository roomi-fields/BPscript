/**
 * Frontière R4 — charge (params) sur un accord `!` (décision Romain + BPx 2026-06-23).
 *
 * 3 formes, 3 cibles distinctes :
 *   1. {C4!E4}(vel:90)        → contenance de BLOC : tout l'accord (sur le conteneur).
 *   2. C4!E4(vel:90)          → charge COLLÉE : E4 SEUL (dernier secondaire).
 *   3. C4(vel:80)!E4(vel:90)  → par NOTE : un override par note.
 *
 * Contrat AST figé : chaque note sonnante porte sa charge d'occurrence dans
 * payload.params (+ payload.occurrence:true), uniforme ; la contenance de bloc
 * reste sur le conteneur englobant (payload.containment:true, params).
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function assert(label, cond, extra = '') {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL: ${label} ${extra}`); }
}

function rule(src) {
  const r = compileToBPxAST(src);
  if (r.errors && r.errors.length) {
    console.log('  PARSE ERROR:', JSON.stringify(r.errors));
    return null;
  }
  return r.ast.subgrammars[0].rules[0];
}

const DECLS = 'gate C4:sc\ngate E4:sc\n';

// ── Forme 1 : contenance de bloc ────────────────────────────────────────
{
  const r = rule(DECLS + 'A -> {C4!E4}(vel:90)');
  const poly = r.rhs[0];
  assert('F1 RHS = Polymetric (bloc)', poly?.type === 'Polymetric', `got ${poly?.type}`);
  const grp = poly?.voices?.[0]?.[0];
  assert('F1 bloc contient un SimultaneousGroup', grp?.type === 'SimultaneousGroup');
  // La charge est sur le conteneur (qualifieur de règle), PAS sur les notes.
  const rq = r.runtimeQualifier;
  assert('F1 contenance sur le conteneur', rq?.payload?.containment === true,
    JSON.stringify(rq?.payload));
  assert('F1 params.vel=90 sur le conteneur', rq?.payload?.params?.vel === 90,
    JSON.stringify(rq?.payload?.params));
  // Les notes de l'accord ne portent PAS d'override d'occurrence.
  assert('F1 C4 sans charge', !grp?.primary?.payload?.params,
    JSON.stringify(grp?.primary?.payload));
  assert('F1 E4 sans charge', !grp?.secondaries?.[0]?.payload?.params,
    JSON.stringify(grp?.secondaries?.[0]?.payload));
}

// ── Forme 2 : charge collée → E4 seul ───────────────────────────────────
{
  const r = rule(DECLS + 'A -> C4!E4(vel:90)');
  const grp = r.rhs[0];
  assert('F2 RHS = SimultaneousGroup', grp?.type === 'SimultaneousGroup', `got ${grp?.type}`);
  assert('F2 C4 (primaire) SANS charge', !grp?.primary?.payload?.params,
    JSON.stringify(grp?.primary?.payload));
  const e4 = grp?.secondaries?.[0];
  assert('F2 E4 (secondaire) params.vel=90', e4?.payload?.params?.vel === 90,
    JSON.stringify(e4?.payload));
  assert('F2 E4 occurrence:true', e4?.payload?.occurrence === true,
    JSON.stringify(e4?.payload));
}

// ── Forme 3 : par note ──────────────────────────────────────────────────
{
  const r = rule(DECLS + 'A -> C4(vel:80)!E4(vel:90)');
  const grp = r.rhs[0];
  assert('F3 RHS = SimultaneousGroup', grp?.type === 'SimultaneousGroup', `got ${grp?.type}`);
  assert('F3 C4 params.vel=80', grp?.primary?.payload?.params?.vel === 80,
    JSON.stringify(grp?.primary?.payload));
  assert('F3 C4 occurrence:true', grp?.primary?.payload?.occurrence === true);
  const e4 = grp?.secondaries?.[0];
  assert('F3 E4 params.vel=90', e4?.payload?.params?.vel === 90,
    JSON.stringify(e4?.payload));
  assert('F3 E4 occurrence:true', e4?.payload?.occurrence === true);
}

// ── Repliement aussi hors accord : note simple SymbolCall ───────────────
{
  const r = rule('gate C4:sc\nA -> C4(vel:80)');
  const n = r.rhs[0];
  assert('note simple params.vel=80 (repliée)', n?.payload?.params?.vel === 80,
    JSON.stringify(n?.payload));
  assert('note simple occurrence:true', n?.payload?.occurrence === true);
  // L'arg original est conservé (voie BP3 héritée).
  assert('args originaux conservés', Array.isArray(n?.args) && n.args.length === 1,
    JSON.stringify(n?.args));
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
