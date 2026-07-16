// Attribution des NOTES NUES à un acteur EXPLICITE (bug résolu 2026-07-13, diag bpscript [402]).
//
// Racine : resolveActors bâtissait symbolActorMap depuis expandAlphabetTerminals — qui ne produit
// QUE les formes décorées de registre (madhya_sa…), jamais la forme NUE 'sa'. Or les scènes
// écrivent des notes nues. validateTerminals (bpxAst.js:639-641) les reconnaît ; resolveActors NON.
// Conséquence : note nue non attribuée → orpheline → muette avec un acteur explicite (aucun 'default'
// synthétique pour la recueillir). Fix : resolveActors enregistre AUSSI les formes nues.
// L'attribution passe par le CANAL EXISTANT payload.actor (node.payload.actor, actorResolver.js:148).

import { compileToBPxAST } from '../src/transpiler/bpxAst.js';

let ok = 0, ko = 0;
function assert(label, cond, detail) {
  if (cond) { ok++; console.log(`OK  ${label}`); }
  else { ko++; console.log(`KO  ${label}${detail !== undefined ? '  → ' + detail : ''}`); }
}
function notesActors(src) {
  const { ast, errors } = compileToBPxAST(src);
  const sg = (ast && ast.subgrammars || [])[0];
  const out = [];
  if (sg) for (const r of sg.rules || []) for (const el of r.rhs || []) {
    if (el.type === 'Symbol') out.push({ name: el.name, actor: el.payload && el.payload.actor, hasEl: el.actor });
  }
  return { out, errors: (errors || []).map((e) => e.message) };
}

console.log('\n=== Note NUE attribuée à l\'acteur explicite (via payload.actor, canal existant) ===');
{
  const { out, errors } = notesActors('@core\n@controls\n@actor voice @alphabet.sargam transport.audio\nS -> sa re\n');
  assert('compile sans erreur', errors.length === 0, errors.join(' | '));
  assert('note nue sa → payload.actor = voice', out.find((n) => n.name === 'sa')?.actor === 'voice', JSON.stringify(out));
  assert('note nue re → payload.actor = voice', out.find((n) => n.name === 're')?.actor === 'voice', JSON.stringify(out));
  // Le canal est bien payload.actor (existant), pas un nouveau champ : el.actor DOUBLE payload.actor.
  assert('attribution sur canal existant (el.actor double payload.actor)', out.find((n) => n.name === 'sa')?.hasEl === 'voice', JSON.stringify(out));
}

console.log('\n=== Note altérée nue (komal) aussi attribuée ===');
{
  const { out } = notesActors('@core\n@controls\n@actor voice @alphabet.sargam transport.audio\nS -> rekomal ga\n');
  assert('rekomal → voice', out.find((n) => n.name === 'rekomal')?.actor === 'voice', JSON.stringify(out));
  assert('ga → voice', out.find((n) => n.name === 'ga')?.actor === 'voice', JSON.stringify(out));
}

console.log('\n=== Non-régression : scène IMPLICITE (acteur default synthétique) inchangée ===');
{
  // Sans @actor, l'acteur 'default' est synthétique et n'a pas d'alphabet → notes nues NON attribuées
  // (orphelines, recueillies par le default en aval). Comportement inchangé par le fix.
  const { out } = notesActors('@alphabet.sargam:audio\nS -> sa re\n');
  assert('implicite : sa reste non attribué (default sink, inchangé)', out.find((n) => n.name === 'sa')?.actor === undefined, JSON.stringify(out));
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok} passés, ${ko} échoués`);
if (ko > 0) process.exit(1);
