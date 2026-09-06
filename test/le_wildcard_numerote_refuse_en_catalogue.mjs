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
  const src = `alphabet.western\n\n-----\nS -> C4 D4\n\ntemplate\n[1] /1 ?1 ? .\n`;
  const r = compileToBPxAST(src);
  const entrees = r.ast?.template?.entrees || [];
  ok((r.errors || []).length === 0,
    `1. la ligne se transporte, elle ne se juge plus ici(reçu ${JSON.stringify(r.errors)})`);
  ok(entrees.length === 1, `1. une ligne de catalogue, une entrée(reçu ${entrees.length})`);
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
  const r = compileToBPxAST(`alphabet.western\n\n-----\nS -> C4\n\ntemplate\n[1] ?1 ? .\n[2] a b\n`);
  const e = r.ast?.template?.entrees || [];
  ok(e.length === 2, `2. TÉMOIN — deux lignes écrites, deux entrées(reçu ${e.length})`);
  ok(e[1]?.line === '[2] a b', `2. la seconde est intacte(reçu ${JSON.stringify(e[1]?.line)})`);
}

// ── 3. L'AUTRE PORTE DE LA MÊME PERTE — une ligne qui n'OUVRE PAS une entrée ─────────────
// ⛔ LE TRANSPORT VERBATIM FERMAIT LA TRONCATURE D'UNE LIGNE, PAS LA DISPARITION DE LA SECTION.
// La boucle sortait sur tout ce qui n'ouvre pas par un crochet, la section rendait ce qu'elle
// avait, et l'analyse de la scène finissait là : le RESTE DU FICHIER partait avec, sans un mot.
// Mesuré le 2026-09-06 — un rang oublié (`/1 ??`) et une ligne de texte quelconque rendaient
// toutes deux un catalogue vide et zéro refus.
//
// ⚠️ CE QUE CE VOLET NE JUGE PAS, ET C'EST DÉLIBÉRÉ : le CORPS d'une entrée. Un rang SANS forme
// reste accepté, et il a son témoin ci-dessous — le corps est lu par le moteur (forme ratifiée le
// 2026-08-10), le juger ici serait décider à sa place.
//
// ⛔ LE RANG, LUI, EST UN ENTIER — décision de Romain, 2026-09-06, prise sur la mesure du moteur
// natif rendue par bp3-engine : il n'en refuse AUCUN. `ProduceItems.c:1370-1377` lit le rang
// chiffre par chiffre, remplace tout caractère fautif par zéro et l'accumule quand même, écrit un
// message qu'il n'inscrit PAS à son compteur d'erreurs, et rend 0. ⇒ `[1z]` devient le rang 10,
// `[zzz]` le rang 0, et deux entrées peuvent partager un rang sans que rien ne le dise.
// *Accepter ici, c'est laisser fabriquer un rang que personne n'a écrit.* Le refus est donc un
// AJOUT au comportement natif, et il est assumé comme tel.
{
  const S = 'core\nalphabet.western\n-----\nS -> C4\ntemplate\n';
  const codes = (corps) => (compileToBPxAST(S + corps).errors || []).map((x) => String(x.code || ''));
  const entrees = (corps) => {
    const r = compileToBPxAST(S + corps);
    return r.ast?.template?.entrees?.length ?? -1;
  };

  // Ce qui n'ouvre pas une entrée est REFUSÉ — la matrice croise la place (seule, après une
  // entrée) et la graphie (rang absent, texte quelconque).
  const REFUSES = [
    ['le rang oublié, seul',          '/1 ??\n'],
    ['du texte quelconque, seul',     'zzz nimporte quoi\n'],
    ['le rang oublié, APRÈS une entrée',      '[1] /1 ??\n/1 ??\n'],
    ['du texte quelconque, APRÈS une entrée', '[1] /1 ??\nzzz perdu\n'],
  ];
  for (const [nom, corps] of REFUSES) {
    const c = codes(corps);
    ok(c.includes('PARSE_TEMPLATE_LINE_NOT_A_CATALOG_ENTRY'),
      `3. « ${nom} » doit être REFUSÉ — reçu ${c.length ? c.join(', ') : 'AUCUNE erreur'}. `
      + `Sans ce refus, cette ligne ET tout ce qui la suit disparaissent sans un signe.`);
  }

  // Les témoins : ce qui EST une entrée passe, et le compte est juste. Sans eux, un refus posé
  // trop large rendrait la section inutilisable en restant vert ci-dessus.
  const PASSENT = [
    ['la forme de la bible',   '[1] /1 ??\n',                     1],
    ['trois entrées',          '[1] /1 ??\n[2] /1 ??\n[3] a b\n', 3],
    ['une section vide',       '',                                0],
    ['un rang sans forme',     '[1]\n',                           1],
  ];
  for (const [nom, corps, attendu] of PASSENT) {
    const c = codes(corps);
    ok(c.length === 0, `3. TÉMOIN « ${nom} » ne doit rien lever — reçu ${c.join(', ')}`);
    ok(entrees(corps) === attendu,
      `3. TÉMOIN « ${nom} » — ${attendu} entrée(s) attendue(s), ${entrees(corps)} reçue(s)`);
  }
  // ── LE RANG EST UN ENTIER — chaque forme que le moteur dégrade en silence est refusée ici.
  // Les graphies viennent de la mesure de bp3-engine, avec le rang que le natif FABRIQUE.
  const RANGS = [
    ['tout en lettres — le natif en fait le rang 0',  '[zzz] /1 ??\n'],
    ['chiffre puis lettre — le natif en fait 10',     '[1z] /1 ??\n'],
    ['lettre puis chiffre',                           '[z1] /1 ??\n'],
    ['crochets vides',                                '[] /1 ??\n'],
    ['un décimal, qui n est pas un entier',           '[1.5] /1 ??\n'],
  ];
  for (const [nom, corps] of RANGS) {
    const c = codes(corps);
    ok(c.includes('PARSE_TEMPLATE_RANK_IS_AN_INTEGER'),
      `3bis. « ${nom} » doit être REFUSÉ — reçu ${c.length ? c.join(', ') : 'AUCUNE erreur'}. `
      + `Le moteur natif ne refuse rien : il fabrique un rang que personne n'a écrit.`);
  }
  // ⚠️ ET LE TÉMOIN QUI EMPÊCHE LE REFUS DE TOUT MANGER : les entiers passent, à plusieurs chiffres.
  for (const [nom, corps] of [['un rang à un chiffre', '[7] /1 ??\n'],
                              ['un rang à deux chiffres', '[42] /1 ??\n'],
                              ['un rang à trois chiffres', '[100] /1 ??\n']]) {
    ok(codes(corps).length === 0 && entrees(corps) === 1,
      `3bis. TÉMOIN « ${nom} » doit passer et faire UNE entrée — reçu ${codes(corps).join(', ')} / ${entrees(corps)}`);
  }

  // ⛔ LE SOCLE COMPTE LES TROIS MATRICES, et il est posé APRÈS elles — placé avant, il ne
  // comptait que ce qui le précédait et rougissait le jour où une matrice naissait plus bas.
  ok(REFUSES.length + PASSENT.length + RANGS.length >= 13,
    `3. SOCLE — les matrices se sont vidées : ${REFUSES.length + PASSENT.length + RANGS.length} cas exercés.`);
}

if (echecs.length) {
  console.error(`[wildcard numéroté en catalogue] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[wildcard numéroté en catalogue] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
