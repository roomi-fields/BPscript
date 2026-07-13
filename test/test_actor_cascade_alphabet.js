// RESOLVER-CASCADE-ALPHABET (modèle Romain 2026-07-13) — la cascade de défauts s'applique AUSSI
// à l'alphabet : « PAS D'ALPHABET » N'EXISTE PAS. Un acteur sans alphabet HÉRITE (acteur → scène
// @alphabet.X → sinon socle @core western). Le résolveur ne REJETTE JAMAIS pour 'no alphabet' —
// c'était le bug §71 qui bloquait le son d'une scène + acteur transport-seul.
//
// Loi 35 (cascade) : si la scène INVOQUE une hauteur OPAQUE (@mine./@factory. libRef, résolue par
// Kairos), l'alphabet reste ABSENT ici (l'aval le remplit) ; @mine/@factory = simple préfixe de
// PROVENANCE (décision 2026-07-13). Sources : cascade loi 35 + lib/core.json defaults.components.
//
// Réf : actorResolver.js resolveActors (cascade), lib/core.json defaults.components.alphabet=western.

import { compileToBPxAST } from '../src/transpiler/bpxAst.js';

let ok = 0, ko = 0;
function assert(label, cond, detail) {
  if (cond) { ok++; console.log(`OK  ${label}`); }
  else { ko++; console.log(`KO  ${label}${detail !== undefined ? '  → ' + detail : ''}`); }
}
function scene(src) {
  const { ast, errors } = compileToBPxAST(src);
  const a = (ast && ast.actors || [])[0];
  const notes = (ast && ast.subgrammars || [])[0]?.rules?.[0]?.rhs
    ?.filter((e) => e.type === 'Symbol').map((e) => ({ n: e.name, act: e.payload && e.payload.actor })) || [];
  return { alphabet: a?.properties?.alphabet, transport: a?.properties?.transport?.key, notes, errors: (errors || []).map((e) => e.message) };
}

console.log('\n=== FACTORY : acteur transport-seul HÉRITE l\'alphabet de scène (@alphabet.western) ===');
{
  const r = scene('@core\n@controls\n@alphabet.western\n@actor voice transport:browser\nvoice -> C4 D4\n');
  assert('0 erreur (plus de rejet no-alphabet)', r.errors.length === 0, r.errors.join(' | '));
  assert('alphabet hérité = western', r.alphabet === 'western', String(r.alphabet));
  assert('notes attribuées à voice (SONNE)', r.notes.every((n) => n.act === 'voice'), JSON.stringify(r.notes));
}

console.log('\n=== DÉFAUT @core : aucun alphabet de scène → socle western ===');
{
  const r = scene('@core\n@controls\n@actor voice transport:browser\nvoice -> C4 D4\n');
  assert('0 erreur', r.errors.length === 0, r.errors.join(' | '));
  assert('alphabet = socle @core western', r.alphabet === 'western', String(r.alphabet));
  assert('notes attribuées à voice', r.notes.every((n) => n.act === 'voice'), JSON.stringify(r.notes));
}

console.log('\n=== @MINE : hauteur opaque de scène → alphabet ABSENT (Kairos résout), PAS de rejet ===');
{
  const r = scene('@core\n@controls\n@mine.ragas.sargam\n@actor voice transport:browser\nvoice -> sa re\n');
  assert('0 erreur (compile, plus de rejet §71)', r.errors.length === 0, r.errors.join(' | '));
  assert('alphabet ABSENT (opaque, loi 35 → aval)', r.alphabet === undefined, String(r.alphabet));
  assert('transport présent (browser→webaudio)', r.transport === 'webaudio', String(r.transport));
}

console.log('\n=== VOIX-CODE (eval) : PAS d\'héritage d\'alphabet ===');
{
  const r = scene('@core\n@controls\n@actor stru transport:audio eval.strudel\nS -> stru\nstru -> `x`\n');
  assert('alphabet ABSENT (voix-code, pas de vocabulaire de notes)', r.alphabet === undefined, String(r.alphabet));
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok} passés, ${ko} échoués`);
if (ko > 0) process.exit(1);
