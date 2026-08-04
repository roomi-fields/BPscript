#!/usr/bin/env node
/**
 * GARDE — `@transport` et `@out` ne sont PAS des directives de scène.
 *
 * LE TROU (signalé par Atlas, mesuré ici avant correction) : la décision du 2026-08-04
 * (`hub/decisions/2026-08-04-la-direction-s-ecrit-in-et-out-remplacent-transport.md`) sort le mot
 * `transport` du langage et pose `out` comme clé d'ACTEUR. Le refus est bien posé À L'INTÉRIEUR
 * d'un bloc `@actor` (tombstone `transport` à `parser.js` ~1726) — il ne l'était PAS en DIRECTIVE
 * DE SCÈNE : `@transport.midi` et `@out.midi` en tête de scène compilaient tous les deux SANS
 * ERREUR, et sans AUCUN EFFET (l'acteur implicite garde `{type:'TransportRef', key:'audio'}`
 * quoi qu'on écrive). Le trou est PRÉEXISTANT — `@transport.midi` compilait déjà avant le lot du
 * renommage, ce n'est pas une régression du 2026-08-04, c'est ce que ce lot aurait dû fermer.
 *
 * CE QUE CE GARDE NE COUVRE PAS : les DEUX mots restent dans `schema.reservedDirectives`
 * (`lib/core.json`) — ce garde n'y touche pas, il ajoute un refus explicite à côté, comme les
 * tombstones `@in`/`@routing`/`@scene` déjà dans `parser.js`.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const EN_TETE = '@core\n';
const compile = (corps) => {
  try { return compileToBPxAST(`${EN_TETE}${corps}\n`); }
  catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};

// ─── LES CINQ CAS DE LA MESURE ────────────────────────────────────────────────────────────────
for (const [corps, quoi, mot] of [
  ['@transport.midi\n@mode:ord\nS -> C4', "'@transport.midi' en tête de scène", 'transport'],
  ['@out.midi\n@mode:ord\nS -> C4', "'@out.midi' en tête de scène", 'out'],
]) {
  const r = compile(corps);
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok((r.errors || []).length > 0, `${quoi} doit être REFUSÉ — reçu : ${JSON.stringify(r.errors)}`);
  ok(msg.includes(mot), `${quoi} : le refus doit NOMMER le mot fautif ('${mot}') — reçu : ${msg.slice(0, 160)}`);
  ok(msg.includes('2026-08-04'), `${quoi} : le refus doit référencer la décision — reçu : ${msg.slice(0, 160)}`);
}

// ─── DÉJÀ REFUSÉ, NE DOIT PAS BOUGER : '@in' en tête de scène ────────────────────────────────
{
  const r = compile("@in.midi\n@mode:ord\nS -> C4");
  ok((r.errors || []).length > 0, "'@in.midi' en tête de scène doit rester REFUSÉ (tombstone préexistant)");
}

// ─── NE DOIT PAS CASSER : 'out.audio' DANS un bloc @actor ────────────────────────────────────
{
  const r = compile('@actor v\n  alphabet.western\n  out.audio\n@mode:ord\nS -> v.C4');
  ok((r.errors || []).length === 0,
     `'out.audio' dans @actor doit rester ACCEPTÉ — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
}

// ─── NE DOIT PAS CASSER : '@var x in.midi' ───────────────────────────────────────────────────
{
  const r = compile('@var x in.midi\n@mode:ord\nS -> C4');
  ok((r.errors || []).length === 0,
     `'@var x in.midi' doit rester ACCEPTÉ — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
}

if (echecs.length) {
  console.error(`❌ transport/out en directive de scène : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ transport/out en directive de scène — ${passe} vérification(s) passée(s)`);
}
