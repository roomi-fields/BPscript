#!/usr/bin/env node
/**
 * ⛔ GARDE SUSPENDU — GEL MODULATION / PATCHING (Romain, 2026-08-09).
 *
 * « On gèle tout ce qui est modulation/patching. » Et geler un sujet gèle CE QUI LE SERT : on ne
 * SUPPRIME pas, on SUSPEND avec motif daté, et on attend.
 *
 * ⚠️ CE GARDE AVAIT ÉTÉ SUPPRIMÉ le 2026-08-09 au motif que « son sujet n'existe plus », les
 * directives qu'il éprouve ayant été retirées du langage le matin même. C'ÉTAIT LE MAUVAIS GESTE :
 * le sujet ne disparaît pas, il DORT — il revient avec le remaniement Dedale/FaustX, sous une
 * autre graphie. Un garde supprimé emporte avec lui ce qu'il gardait ; un garde suspendu le dit.
 *
 * ⚠️ ET LE JOUR MÊME, CETTE SUPPRESSION A COÛTÉ : le garde de la validation de modulation a été
 * retiré parce que « son sujet n'existe plus », alors que le CODE qu'il surveillait tournait
 * toujours — il lit une section supprimée, rend donc toujours vide, et accepte désormais une
 * modulation vers une source inexistante. Le sujet du GARDE avait disparu ; celui du CODE non.
 *
 * RALLUMAGE : au dégel du chantier Dedale/FaustX. L'ordre des chantiers est fixé par Romain —
 * 1. conformité à LANGUAGE.md hors patching, 2. un point ISO-100, 3. et seulement ensuite FaustX.
 *
 * Le corps du garde est CONSERVÉ INTACT sous ce drapeau : il n'y a rien à réinventer au dégel.
 */
const GEL_MODULATION_PATCHING = true;
if (GEL_MODULATION_PATCHING) {
  console.log('⏸️  SUSPENDU — gel modulation/patching (Romain 2026-08-09), rallumage au dégel Dedale/FaustX.');
  process.exit(0);
}

// Garde-fou : déclaration de modulateur CV (design Romain 2026-06-20).
// Forme : `cv <nom> : <lib>.<type>(params)` ou `cv <nom> : `code`` — PUREMENT DESCRIPTIVE
// (aucune cible/route sur la déclaration ; le branchement se fait au point de paramètre
// `(cutoff:env1)`, où la valeur peut être un symbole dérivable de la grammaire).
// À distinguer de la double-déclaration temporelle `@cv ramp:sc` (type temporel + runtime).
import { compileToBPxAST } from '../src/transpiler/bpxAst.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }
const HEAD = '@mod\n@controls\n@alphabet.western:audio\n';
function ast(src) { return compileToBPxAST(HEAD + src); }
function cvs(r) { return (r.ast?.cvInstances || []); }

// 1. Déclaration descriptive : lib.type(namedArgs), pas de cible
{
  const r = ast('@cv env1 mod.adsr(attack:500, decay:2000, sustain:0.6, release:400)\nS -> grave aigu (cutoff:env1)\ngrave -> C2\naigu -> E2\n');
  check((r.errors || []).length === 0, '1: 0 erreur, obtenu ' + JSON.stringify(r.errors));
  const c = cvs(r)[0] || {};
  check(cvs(r).length === 1, '1: 1 CVInstance, obtenu ' + cvs(r).length);
  check(c.name === 'env1', '1: name=env1, obtenu ' + c.name);
  check(c.lib === 'mod' && c.objectType === 'adsr', '1: mod.adsr, obtenu ' + c.lib + '.' + c.objectType);
  check(c.namedArgs && c.namedArgs.release === 400, '1: namedArgs.release=400');
  check(c.target === undefined && c.cvin === undefined && c.transport === undefined,
    '1: AUCUNE cible/route sur la déclaration, obtenu ' + JSON.stringify({ t:c.target, c:c.cvin, tr:c.transport }));
}

// 2. Backtick : modulateur custom inline
{
  const r = ast('@cv custom `js:(t,d) => Math.sin(t)`\nS -> C2 (amplitude:custom)\n');
  const c = cvs(r)[0] || {};
  check(c.objectType === 'backtick' && c.lib === null, '2: backtick, lib null');
  check(/Math.sin/.test(c.code || ''), '2: code capté');
}

// 3. Args POSITIONNELS — REFUSÉS depuis le 2026-07-26
// La déclaration d'un modulateur avait échappé au ménage : ce n'est pas un sac de contrôle, donc
// la garde des sacs ne la voyait pas. Or la règle ne connaît pas de sous-zone — un argument dont
// la PLACE tient lieu de nom n'existe plus nulle part dans le langage. La forme nommée reste la
// bonne (cas 2 ci-dessus), exactement comme `transport.midi(ch:3)`.
{
  const r = ast('@cv env2 mod.adsr(10, 200, 0.5, 300)\nS -> C2 (cutoff:env2)\n');
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  check(/POSITIONNEL/.test(msg), '3: args positionnels refusés, obtenu ' + (msg || 'AUCUNE ERREUR'));
  check(/attack:/.test(msg), '3: le refus NOMME les paramètres attendus, obtenu ' + msg);
}

// 4. NON-RÉGRESSION : `@cv ramp:sc` reste une Declaration temporelle (PAS une CVInstance)
{
  const r = ast('@cv ramp:sc\nS -> ramp\n');
  check(cvs(r).length === 0, '4: cv ramp:sc -> 0 CVInstance, obtenu ' + cvs(r).length);
  const d = (r.ast.declarations || [])[0] || {};
  check(d.type === 'Declaration' && d.temporalType === 'cv' && d.name === 'ramp' && d.runtime === 'sc',
    '4: cv ramp:sc -> Declaration cv ramp:sc, obtenu ' + JSON.stringify(d));
}

// 5. Branchement au point de paramètre : la valeur peut être un symbole dérivable
//    (cutoff:Env) où Env -> env1 | env2. Le parser capte la paire {cutoff:Env} ; le résolveur tranche.
{
  const r = ast('@cv env1 mod.adsr(attack:5, decay:150, sustain:0.2, release:400)\n'
    + '@cv env2 mod.adsr(attack:3, decay:100, sustain:0.2, release:400)\n'
    + 'S -> {Bass Bass, Env Env}\nBass -> C2 C3 (cutoff:Env, wave:square)\nEnv -> env1\nEnv -> env2\n');
  check((r.errors || []).length === 0, '5: 0 erreur, obtenu ' + JSON.stringify(r.errors));
  check(cvs(r).length === 2, '5: 2 modulateurs déclarés, obtenu ' + cvs(r).length);
  const bassRule = r.ast.subgrammars[0].rules.find((rl) => {
    const h = Array.isArray(rl.lhs) ? rl.lhs[0] : rl.lhs; return h && h.name === 'Bass';
  });
  const pairs = bassRule && bassRule.settings && bassRule.settings.pairs || [];
  const cutoff = pairs.find((p) => p.key === 'cutoff');
  check(cutoff && cutoff.value === 'Env', '5: branchement (cutoff:Env) capté, obtenu ' + JSON.stringify(cutoff));
}

console.log(`${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
