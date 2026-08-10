#!/usr/bin/env node
/**
 * GARDE — un wildcard NUMÉROTÉ (`?N`) en ligne de catalogue `@template` est REFUSÉ, pas tronqué.
 *
 * Décision : `hub/decisions/2026-08-04-le-signe-interrogation-est-un-wildcard-le-gabarit-garde-
 * capturer.md`. Le `?` est un wildcard, `$X`/`&X` restent des gabarits. La partie documentaire
 * (LANGUAGE.md:1683-1684) dit déjà : « les mêmes `?` que dans une règle, un par terminal effacé,
 * et toujours ANONYMES : une ligne de catalogue n'a pas de flèche, donc rien à rejouer et pas de
 * numéro. »
 *
 * ⚠️ LE DÉFAUT RÉPARÉ ICI, mesuré AVANT correction (`parseTemplateBody`, parser.js ~2787-2816) :
 * `?N` n'était atteint par AUCUNE branche du `if/else if` de la boucle. Le `?` était compté comme
 * wildcard NU (la boucle `while (at(T.QUESTION))` s'arrête dès qu'elle voit l'INT), puis l'INT
 * restant tombait dans le `else break` final — qui sortait de la boucle EN SILENCE, tronquant tout
 * le reste de la ligne de catalogue sans une erreur. `[1] /1 ?1 ? .` ne gardait qu'un seul
 * `TemplateWildcard` ; ' ? .' disparaissait de l'AST sans warning.
 *
 * C'est le pire mode d'échec : pas de rouge, une ligne de catalogue amputée sans que rien ne le
 * dise. Le correctif REFUSE nommément au lieu de tronquer.
 *
 * ⚠️ CE QUE CE GARDE NE COUVRE PAS : aucun autre comportement du gabarit (le `?` nu en catalogue,
 * le `?N` en règle, les groupes `${...}`/`&{...}`) — ces trois cas sont ici uniquement comme
 * TÉMOINS anti-régression, pour prouver que le refus ne mord QUE la forme numérotée en catalogue.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── 1. LA LIGNE EST PORTÉE ENTIÈRE — la troncature est devenue IMPOSSIBLE ────────────────
// ⚠️ CE GARDE A CHANGÉ DE CAMP le 2026-08-10, et le motif compte plus que le retournement.
// Il exigeait un REFUS de `?N` en catalogue. Ce refus n'avait de sens que parce que le frontal
// DÉCOUPAIT la ligne : la forme numérotée n'était atteinte par aucune branche, et le reste de la
// ligne disparaissait en silence. Le refus fermait la troncature.
//
// Depuis que l'entrée de catalogue se transporte VERBATIM (forme ratifiée par Romain, BPx
// AST_SPEC §1.9), il n'y a plus de découpage — donc plus de troncature possible, par construction.
// Et le contenu de la ligne n'est plus jugé ici : c'est le moteur qui la lit.
//
// CE QUI EST GARDÉ MAINTENANT EST LA PROPRIÉTÉ QUI COMPTAIT DÉJÀ : la ligne arrive ENTIÈRE.
// Le refus était le moyen ; l'intégrité était la fin.
{
  const src = `@alphabet.western\n\nS -> C4 D4\n\n@template\n[1] /1 ?1 ? .\n`;
  const r = compileToBPxAST(src);
  const entrees = r.ast?.template || [];
  ok((r.errors || []).length === 0,
    `1. la ligne se transporte, elle ne se juge plus ici (reçu ${JSON.stringify(r.errors)})`);
  ok(entrees.length === 1, `1. une ligne de catalogue, une entrée (reçu ${entrees.length})`);
  ok(entrees[0]?.line === '[1] /1 ?1 ? .',
    `1. ENTIÈRE et VERBATIM — c'est la troncature que ce garde ferme depuis toujours. `
    + `Reçu : ${JSON.stringify(entrees[0]?.line)}`);
  ok(!('index' in (entrees[0] || {})) && !('body' in (entrees[0] || {})),
    `1. aucun champ dérivé à côté de la ligne : deux sources pour la même information ne diraient `
    + `pas laquelle croire`);
}

// ── 2. TÉMOIN — ce qui suit la ligne n'est PAS avalé ─────────────────────────────────────
// La troncature d'origine mangeait la suite en silence. Deux lignes doivent rester deux.
{
  const r = compileToBPxAST(`@alphabet.western\n\nS -> C4\n\n@template\n[1] ?1 ? .\n[2] a b\n`);
  const e = r.ast?.template || [];
  ok(e.length === 2, `2. TÉMOIN — deux lignes écrites, deux entrées (reçu ${e.length})`);
  ok(e[1]?.line === '[2] a b', `2. la seconde est intacte (reçu ${JSON.stringify(e[1]?.line)})`);
}

if (echecs.length) {
  console.error(`[wildcard numéroté en catalogue] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[wildcard numéroté en catalogue] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
