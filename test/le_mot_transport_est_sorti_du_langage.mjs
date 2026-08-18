#!/usr/bin/env node
/**
 * GARDE — le mot `transport` est SORTI du langage ; `out` y est ENTRÉ.
 *
 * LA DÉCISION : `hub/decisions/2026-08-04-la-direction-s-ecrit-in-et-out-remplacent-transport.md`.
 * Elle sort le mot `transport` du langage et pose `in.`/`out.` à sa place : la direction s'écrit,
 * elle ne se déduit plus de la position.
 *
 * ⚠️ CE FICHIER S'APPELAIT « transport ET OUT ne sont pas des directives de scène » JUSQU'AU
 * 2026-08-07, ET SA MOITIÉ `out` ÉTAIT FAUSSE. Elle invoquait cette décision pour interdire
 * `@out.midi` en tête de scène — la décision ne dit pas ça. Tous ses exemples écrivent `out.` sous
 * un acteur ; aucun n'interdit le défaut de scène. Et la bible, elle, l'ÉCRIT
 * (`LANGUAGE.md` §« Les cinq clés d'un acteur ») :
 *     @alphabet.sargam          // la scene entiere joue le sargam et sort par le MIDI
 *     @out.midi(ch:1)
 *     @actor sitar              // cet acteur affine ce dont il herite
 *
 * ⚠️ ET LA LEÇON N'EST PAS « j'ai mal lu une décision ». Le défaut mesuré était RÉEL — `@out.midi`
 * compilait sans AUCUN EFFET, l'acteur implicite gardant `audio` quoi qu'on écrive. Face à un
 * défaut qui a deux réparations — INTERDIRE l'écriture, ou la BRANCHER — j'ai pris la facile, et
 * je lui ai cherché une caution dans une décision qui parlait d'autre chose. Un garde a alors
 * gravé le refus, et le refus a masqué le trou pendant trois jours : **on ne mesure pas la
 * descente d'une directive qu'on interdit d'écrire.**
 *
 * Le nom du fichier a changé avec la règle : un garde dont le TITRE enseigne une règle morte est
 * un appelant vivant de cette règle, exactement ce que `les_exemples_de_la_spec_compilent.mjs`
 * chasse dans la documentation.
 *
 * CE QUE CE GARDE COUVRE : la sortie du mot `transport`, et le fait qu'`out` s'écrive aux DEUX
 * étages. Que la clé DESCENDE avec la bonne valeur est mesuré ailleurs, et c'est délibéré :
 * `les_cles_d_acteur_descendent_dans_l_acteur_implicite.mjs` le fait pour les cinq clés à la fois.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compile = (corps) => {
  try { return compileToBPxAST(`core\n${corps}\n`); }
  catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message || e).join(' | ');

// ─── LE MOT `transport` NE S'ÉCRIT PLUS, ET LE REFUS LE DIT ──────────────────────────────────
{
  const r = compile('transport.midi\nmode:ord\n-----\nS -> C4');
  const msg = messages(r);
  ok((r.errors || []).length > 0, `'transport.midi' en tête de scène doit être REFUSÉ — reçu : ${msg || 'aucune erreur'}`);
  ok(msg.includes('transport'), `le refus doit NOMMER le mot fautif — reçu : ${msg.slice(0, 160)}`);
}

// ─── `in` EN TÊTE DE SCÈNE RESTE REFUSÉ — l'entrée vit dans `var` ──────────────────────────
{
  const r = compile('in.midi\nmode:ord\n-----\nS -> C4');
  ok((r.errors || []).length > 0, "'in.midi' seul en tête de scène doit rester REFUSÉ — le canal engage, le RÔLE manque");
}

// ─── `out` S'ÉCRIT AUX DEUX ÉTAGES — c'est la correction du 2026-08-07 ───────────────────────
// ⚠️ CES DEUX CAS SONT LE TÉMOIN DE LA CORRECTION. Le premier était REFUSÉ par ce fichier même ;
// s'il redevenait rouge, c'est que le fail-loud est revenu et que la bible est de nouveau en
// avance sur le code sans que personne ne le dise.
{
  const r = compile('alphabet.western\nout.midi\nmode:ord\n-----\nS -> C4');
  ok((r.errors || []).length === 0,
     `'out.midi' en tête de scène doit être ACCEPTÉ (défaut de scène, LANGUAGE.md §« Les cinq clés `
     + `d'un acteur ») — reçu : ${messages(r).slice(0, 140)}`);
}
{
  const r = compile('actor v\n  alphabet.western\n  out.audio\nmode:ord\n-----\nS -> v.C4');
  ok((r.errors || []).length === 0,
     `'out.audio' dans un bloc '@actor' doit rester ACCEPTÉ — reçu : ${messages(r).slice(0, 140)}`);
}

// ─── LES PARAMÈTRES DE LA CLÉ S'ÉCRIVENT AUX DEUX ÉTAGES AUSSI ───────────────────────────────
// La clé porte ses paramètres partout où elle s'écrit — ils ne dépendent pas de l'endroit.
for (const [ou, corps] of [
  ['en tête de scène', 'alphabet.western\nout.midi(ch:1)\nmode:ord\n-----\nS -> C4'],
  ['sous un @actor',   'actor v\n  alphabet.western\n  out.midi(ch:1)\nmode:ord\n-----\nS -> v.C4'],
]) {
  const r = compile(corps);
  ok((r.errors || []).length === 0,
     `'out.midi(ch:1)' ${ou} doit être ACCEPTÉ — reçu : ${messages(r).slice(0, 140)}`);
}

// ─── NE DOIT PAS CASSER : `var x in.midi` ───────────────────────────────────────────────────
{
  const r = compile('in.midi x\nmode:ord\n-----\nS -> C4');
  ok((r.errors || []).length === 0, `'in.midi x' doit rester ACCEPTÉ — reçu : ${messages(r).slice(0, 140)}`);
}

if (echecs.length) {
  console.error(`❌ le mot transport / la clé out : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ le mot 'transport' est sorti du langage, la clé 'out' s'écrit aux deux étages `
            + `(tête de scène et bloc d'acteur), avec ses paramètres — ${passe} vérification(s)`);
}
