// ⛔ MIGRE LE 2026-08-22 : une librairie s invoque par le mot qu elle DECLARE, jamais par le nom
// de son fichier (decision de Romain du 2026-08-17, frappee ce jour). `temperaments` →
// `temperament`, `test_alphabets` → `alphabet`, `voices` → `voice`, `tunings` → `tuning`,
// `scales` → `scale`, `sounds` → `sound`, `alphabets` → `alphabet`.
// RESOLVER-CASCADE-ALPHABET (modèle Romain 2026-07-13) — la cascade de défauts s'applique AUSSI
// à l'alphabet : « PAS D'ALPHABET » N'EXISTE PAS. Un acteur sans alphabet HÉRITE (acteur → scène
// alphabet.X → sinon socle core western). Le résolveur ne REJETTE JAMAIS pour 'no alphabet' —
// c'était le bug §71 qui bloquait le son d'une scène + acteur transport-seul.
//
// Loi 35 (cascade) : si la scène INVOQUE une hauteur OPAQUE (`factory.` libRef, résolue par
// Kairos), l'alphabet reste ABSENT ici (l'aval le remplit) ; `factory` = simple préfixe de
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

console.log('\n=== FACTORY : acteur transport-seul HÉRITE l\'alphabet de scène(@alphabet.western) ===');
{
  const r = scene('core\nalphabet.western\nactor mavoix out.audio\n-----\nvoice -> C4 D4\n');
  assert('0 erreur (plus de rejet no-alphabet)', r.errors.length === 0, r.errors.join(' | '));
  assert('alphabet hérité = western', r.alphabet === 'western', String(r.alphabet));
  assert('notes attribuées à mavoix (SONNE)', r.notes.every((n) => n.act === 'mavoix'), JSON.stringify(r.notes));
}

console.log('\n=== DÉFAUT @core : aucun alphabet de scène → socle western ===');
{
  const r = scene('core\nactor mavoix out.audio\n-----\nvoice -> C4 D4\n');
  assert('0 erreur', r.errors.length === 0, r.errors.join(' | '));
  assert('alphabet = socle @core western', r.alphabet === 'western', String(r.alphabet));
  assert('notes attribuées à mavoix', r.notes.every((n) => n.act === 'mavoix'), JSON.stringify(r.notes));
}

// ⛔ LES DEUX EXCEPTIONS QUI VIVAIENT ICI SONT SORTIES — Romain, 2026-09-02 : la surcharge par niveaux
// est universelle. Une invocation de scène (un tempérament) ne coupe plus la cascade, et une voix de
// code est un acteur comme un autre : elle hérite. Ce que ce fichier mesurait comme « absent » est
// désormais l'alphabet que `core` déclare.
console.log('\n=== TEMPÉRAMENT INVOQUÉ : la cascade ne se coupe pas, l\'acteur reçoit le défaut de core ===');
{
  const r = scene('core\ntemperament.12TET\nactor mavoix out.audio\n-----\nvoice -> C4 D4\n');
  assert('0 erreur', r.errors.length === 0, r.errors.join(' | '));
  assert('alphabet = western (défaut de core, l\'invocation ne le coupe pas)', r.alphabet === 'western', String(r.alphabet));
  assert('transport présent(canon audio)', r.transport === 'audio', String(r.transport));
}

console.log('\n=== VOIX-CODE (eval) : un acteur comme un autre, elle hérite ===');
{
  const r = scene('core\nactor stru eval.strudel\n-----\nS -> voix\nvoix -> `strudel: x`\n');
  assert('alphabet = western (hérité, aucune exception)', r.alphabet === 'western', String(r.alphabet));
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok} passés, ${ko} échoués`);
if (ko > 0) process.exit(1);
