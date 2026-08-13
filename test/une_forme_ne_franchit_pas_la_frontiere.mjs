#!/usr/bin/env node
/**
 * GARDE — une COMMODITÉ D'ÉCRITURE se déplie avant l'arbre, et n'en franchit jamais la frontière.
 *
 * LA QUESTION QUI A FAIT CE GARDE (Romain, 2026-08-12, en ouvrant les librairies de forme) :
 * « le def est résolu où ? par quel composant ? et comment on assure qu'à la fin on retombe bien
 * sur le contrôle final de la librairie avec son destinataire dans l'arbre ? »
 *
 * LA MESURE D'ALORS, ET ELLE ÉTAIT MAUVAISE : par PERSONNE. Une scène qui écrivait
 * `@def kick (vel:120)` puis posait `kick` produisait un symbole opaque nommé `kick`, étiqueté
 * `nature:'sounding'` — donc lu en aval comme une NOTE. Le réglage canonique n'apparaissait pas,
 * son destinataire non plus, et aucun des cinq voisins ne lit `DefDirective`.
 *
 * LA RÈGLE QUE CE GARDE TIENT : l'arbre ne porte que le vocabulaire CANONIQUE. Tout ce qui est en
 * aval — la table des destinataires, les autres gardes, les consommateurs — s'indexe dessus sans
 * cas particulier. Une forme sert à écrire ; elle ne voyage pas.
 *
 * LES TROIS SORTES QUI SE DÉPLIENT, et elles n'ajoutent QUE de l'écriture :
 *   `prereglage`      `@def kick (vel:120)`        un sac de réglages nommé ;
 *   `structure`       `@def cadence sa re ga pa`   une suite de termes nommée ;
 *   `transformation`  `@def accent(x) x(vel:120)`  une suite de termes nommée, à trous.
 * LA MACRO SE CONFORME À LA RÉÉCRITURE (arbitrage Romain, 2026-08-13) : le corps entre dans la
 * règle ÉLÉMENT PAR ÉLÉMENT, il ne forme pas de groupe, et le nom occupe la durée de ce qu'il
 * contient. La bible l'écrit : « Expansion : C4!tin!ge D4!na!ka E4!tin!ge ».
 *
 * CE QU'IL MESURE, EN MATRICE — la sorte de définition × ce que l'arbre doit en garder :
 *   1. le nom du préréglage a DISPARU des symboles de l'arbre ;
 *   2. le réglage CANONIQUE est là, avec sa valeur ;
 *   3. son DESTINATAIRE est là, identique à celui qu'aurait la forme écrite en direct ;
 *   4. l'arbre déplié est INDISCERNABLE de celui de l'écriture directe — la comparaison porte sur
 *      la structure entière, pas sur les champs que j'aurais choisis. HUIT lignes : les trois
 *      sortes, un paramètre répété, une forme dans une forme, un groupe, un silence ;
 *   5. ce qui n'est PAS du sucre survit : un terminal déclaré et une INVOCATION DE MODULE gardent
 *      leur nom ;
 *   6. le dépliage ne sort pas du MEMBRE DROIT — une tête de règle est une déclaration ;
 *   7. SEPT écarts d'emploi sont refusés avec leur réécriture, jamais devinés.
 *
 * INJECTION dans l'ACCUSÉ (dépliage neutralisé) et dans le JUGE (la comparaison rejouée isolée).
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = '@core\n@alphabet.western:midi\n\n';
const arbreDe = (src) => {
  const r = compileToBPxAST(src);
  return { erreurs: r.errors ?? [], ast: r.ast ?? r };
};
const symbolesDe = (n, acc = []) => {
  if (!n || typeof n !== 'object') return acc;
  if (Array.isArray(n)) { n.forEach((x) => symbolesDe(x, acc)); return acc; }
  if (n.type === 'Symbol' && n.name) acc.push(n.name);
  Object.values(n).forEach((v) => symbolesDe(v, acc));
  return acc;
};
const sacsDe = (n, acc = []) => {
  if (!n || typeof n !== 'object') return acc;
  if (Array.isArray(n)) { n.forEach((x) => sacsDe(x, acc)); return acc; }
  if (n.payload && n.payload.params) acc.push({ params: n.payload.params, resolvedBy: n.payload.resolvedBy ?? null });
  Object.values(n).forEach((v) => sacsDe(v, acc));
  return acc;
};
/** L'empreinte compare TOUT, sauf les positions dans le texte — deux écritures différentes ne
 *  tombent évidemment pas aux mêmes colonnes, et c'est le seul écart prouvé hors sujet. */
const empreinte = (n) => JSON.stringify(n, (k, v) => (k === 'line' || k === 'col' ? undefined : v));

// ─── 0. Témoin anti-rétrécissement — l'écriture directe rend bien ce qu'on va comparer ───────
const direct = arbreDe(`${TETE}S -> !(vel:120) C4\n`);
ok(direct.erreurs.length === 0, `0. l'écriture directe doit compiler (${direct.erreurs[0]?.message})`);
const sacsDirect = sacsDe(direct.ast.subgrammars);
ok(sacsDirect.length === 1 && sacsDirect[0].params.vel === 120,
   `0. l'écriture directe doit porter un sac (vel:120) — reçue ${JSON.stringify(sacsDirect)}`);
ok(sacsDirect[0].resolvedBy?.vel === 'toutes les sorties',
   `0. l'écriture directe doit porter son destinataire — reçu ${JSON.stringify(sacsDirect[0].resolvedBy)}`);

// ─── 1 à 4. LE PRÉRÉGLAGE DÉPLIÉ ─────────────────────────────────────────────────────────────
const deplie = arbreDe(`${TETE}@def kick (vel:120)\n\nS -> kick C4\n`);
ok(deplie.erreurs.length === 0, `1. le préréglage doit compiler (${deplie.erreurs[0]?.message})`);
ok(!symbolesDe(deplie.ast.subgrammars).includes('kick'),
   "1. le nom 'kick' ne doit plus figurer dans les symboles de l'arbre — une forme ne franchit pas "
   + `la frontière (symboles : ${JSON.stringify(symbolesDe(deplie.ast.subgrammars))})`);
const sacsDeplie = sacsDe(deplie.ast.subgrammars);
ok(sacsDeplie.length === 1 && sacsDeplie[0].params.vel === 120,
   `2. le réglage canonique (vel:120) doit être dans l'arbre — reçu ${JSON.stringify(sacsDeplie)}`);
ok(sacsDeplie[0]?.resolvedBy?.vel === 'toutes les sorties',
   `3. le destinataire doit suivre le réglage déplié — reçu ${JSON.stringify(sacsDeplie[0]?.resolvedBy)}`);
ok(empreinte(deplie.ast.subgrammars) === empreinte(direct.ast.subgrammars),
   "4. l'arbre déplié doit être INDISCERNABLE de celui de l'écriture directe. Choisir les champs "
   + 'comparés reviendrait à choisir ce qu\'on ne verra pas.');

// ─── 5. CE QUI N'EST PAS DU SUCRE SURVIT ─────────────────────────────────────────────────────
// Un terminal déclaré CRÉE un nom : le déplier l'effacerait. Le tri se lit sur la sorte.
{
  const t = arbreDe('@core\n@alphabet.western:midi\n@def ka voice.sec\n\nS -> ka\n');
  if (t.erreurs.length) {
    ok(false, `5. la déclaration de terminal doit compiler (${t.erreurs[0]?.message})`);
  } else {
    ok(symbolesDe(t.ast.subgrammars).includes('ka'),
       "5. un TERMINAL déclaré garde son nom dans l'arbre — il crée un nom, il n'est pas du sucre");
  }
}

// ─── 5bis. LA MATRICE DES TROIS SORTES × LES PLACES OÙ UN TERME SE POSE ──────────────────────
// « La macro se conforme à la réécriture » (arbitrage Romain, 2026-08-13) : le corps entre dans la
// règle ÉLÉMENT PAR ÉLÉMENT, il ne forme pas de groupe, et le nom occupe la durée de ce qu'il
// contient. Chaque ligne compare l'écriture avec la forme à l'écriture SANS elle, sur l'empreinte
// ENTIÈRE : c'est la seule comparaison qui ne laisse pas choisir ce qu'on ne verra pas.
for (const [quoi, avecForme, enDirect] of [
  ['préréglage',                 `@def kick (vel:120)\n\nS -> kick C4\n`,        `S -> !(vel:120) C4\n`],
  ['transformation, 1 paramètre', `@def accent(x) x(vel:120)\n\nS -> accent(C4)\n`, `S -> C4(vel:120)\n`],
  ['transformation, 2 paramètres', `@def duo(a,b) a!b\n\nS -> duo(C4,E4)\n`,      `S -> C4!E4\n`],
  ['paramètre RÉPÉTÉ dans le corps', `@def echo(x) x x\n\nS -> echo(C4)\n`,       `S -> C4 C4\n`],
  ['structure posée nue',        `@def cadence C4 D4 E4\n\nS -> cadence\n`,      `S -> C4 D4 E4\n`],
  ['structure sous un groupe',   `@def cadence C4 D4\n\nS -> {cadence, E4}\n`,   `S -> {C4 D4, E4}\n`],
  ['une forme DANS une forme',   `@def a C4 D4\n@def b a E4\n\nS -> b\n`,        `S -> C4 D4 E4\n`],
  ['structure à silence et prolongation', `@def creux C4 - _\n\nS -> creux D4\n`, `S -> C4 - _ D4\n`],
]) {
  const g = arbreDe(`${TETE}${avecForme}`);
  const d = arbreDe(`${TETE}${enDirect}`);
  if (g.erreurs.length || d.erreurs.length) {
    ok(false, `5bis. ${quoi} : les deux écritures doivent compiler (${g.erreurs[0]?.message ?? d.erreurs[0]?.message})`);
    continue;
  }
  ok(empreinte(g.ast.subgrammars) === empreinte(d.ast.subgrammars),
     `5bis. ${quoi} — l'arbre déplié doit être INDISCERNABLE de l'écriture directe`);
}

// ─── 5ter. UNE INVOCATION DE MODULE N'EST PAS UNE STRUCTURE ──────────────────────────────────
// `@var ramp1 ramp` puis `@def monte ramp1(from:0, to:255)` : le corps commence par un terme nu,
// donc le parser type `monte` en STRUCTURE. Mais `ramp1` est une INSTANCE DE MODULE déclarée,
// `from` et `to` sont ses ports, et une invocation est une CHOSE — elle ne se déplie pas. Le
// défaut était muet tant que rien ne se dépliait ; il devient une erreur de compilation dès que le
// corps devient du vrai contenu d'arbre.
{
  const t = arbreDe('@core\n@alphabet.western\n@var ramp1 ramp\n@def monte ramp1(from:0, to:255)\n\nS -> C4!monte\n');
  ok(t.erreurs.length === 0,
     `5ter. une invocation de module nommée par @def ne doit PAS se déplier (${t.erreurs[0]?.message})`);
  ok(symbolesDe(t.ast?.subgrammars).includes('monte'),
     "5ter. le nom de l'invocation de module reste dans l'arbre — ce n'est pas du sucre");
}

// ─── 6. LE DÉPLIAGE NE SORT PAS DU MEMBRE DROIT ──────────────────────────────────────────────
// ⚠️ CE VOLET EXISTE PARCE QUE J'AI CRÉÉ LE DÉFAUT et qu'il était silencieux : en balayant l'arbre
// entier, le dépliage remplaçait la TÊTE d'une règle nommée comme la forme — la règle perdait son
// nom, et le conflit de noms, qui est refusé, ne se déclarait plus. Une forme s'emploie là où un
// terme s'emploie ; une tête de règle n'est pas un emploi, c'est une déclaration.
{
  const t = arbreDe(`${TETE}@def kick (vel:120)\n\nkick -> C4\nS -> kick\n`);
  ok(t.erreurs.some((e) => /nom déjà pris par une définition/.test(String(e.message))),
     "6. une TÊTE DE RÈGLE homonyme d'une forme doit rester un conflit de noms REFUSÉ — le "
     + `dépliage ne doit pas l'effacer en la réécrivant (reçu : ${JSON.stringify(t.erreurs.map((e) => String(e.message).slice(0, 60)))})`);
}

// ─── 7. LA SORTE SE LIT SUR LA FORME DE L'USAGE ──────────────────────────────────────────────
// Un préréglage se pose NU. Appelé avec des arguments, il ne se devine pas : il se refuse, avec
// sa réécriture. Sans ce refus, `kick(C4)` traversait l'arbre en appel opaque étiqueté SONNANT —
// le mode d'échec que ce garde tient tout entier.
// LA MATRICE DES ÉCARTS — chaque façon d'employer une forme de travers, et le refus qui l'attend.
// Sans eux, l'écart traversait l'arbre en appel opaque étiqueté SONNANT : le mode d'échec que ce
// garde tient tout entier.
for (const [ecart, src, motif] of [
  ['un préréglage APPELÉ',        `@def kick (vel:120)\n\nS -> kick(C4)\n`,       /est un préréglage : il se pose NU/],
  ['une structure APPELÉE',       `@def cadence C4 D4\n\nS -> cadence(E4)\n`,     /est une structure : il se pose NU/],
  ['une transformation POSÉE NUE', `@def accent(x) x(vel:120)\n\nS -> accent\n`,  /est une transformation sur x/],
  ['un argument DE TROP',         `@def accent(x) x(vel:120)\n\nS -> accent(C4, D4)\n`, /1 paramètre\(s\).*2 argument\(s\)/],
  ['un argument NOMMÉ',           `@def accent(x) x(vel:120)\n\nS -> accent(x: C4)\n`, /par POSITION, jamais par nom/],
  ['une forme qui SE contient',   `@def a C4 a\n\nS -> a\n`,                      /se déplie sans fin/],
  ['deux formes qui se contiennent', `@def a b\n@def b a\n\nS -> a\n`,            /se déplie sans fin/],
]) {
  const t = arbreDe(`${TETE}${src}`);
  ok(t.erreurs.some((e) => motif.test(String(e.message))),
     `7. ${ecart} doit être refusé, avec sa réécriture (reçu : `
     + `${JSON.stringify(t.erreurs.map((e) => String(e.message).slice(0, 70)))})`);
}

// ─── 8. LE COMPLÉMENT — la forme se déplie PARTOUT où un terme se pose ───────────────────────
// Écrire la portée sans son complément décrirait un langage plus étroit que le vrai : une forme
// posée sous un groupe polymétrique est un emploi comme un autre, et elle s'y déplie.
{
  const g = arbreDe(`${TETE}@def kick (vel:120)\n\nS -> {kick C4, D4}\n`);
  const d = arbreDe(`${TETE}S -> {!(vel:120) C4, D4}\n`);
  ok(g.erreurs.length === 0 && d.erreurs.length === 0,
     `8. les deux écritures groupées doivent compiler (${g.erreurs[0]?.message ?? d.erreurs[0]?.message})`);
  ok(empreinte(g.ast.subgrammars) === empreinte(d.ast.subgrammars),
     '8. une forme posée SOUS UN GROUPE se déplie comme ailleurs — même empreinte que l\'écriture '
     + 'directe au même endroit');
}

// ─── 9. INJECTION DANS LE JUGE — la comparaison rejouée isolée ───────────────────────────────
ok(empreinte({ a: 1, line: 9 }) === empreinte({ a: 1, line: 4 }),
   '9. (se tait) deux positions différentes ne doivent pas séparer deux arbres identiques');
ok(empreinte({ a: 1 }) !== empreinte({ a: 2 }),
   '9. (mord) une valeur différente doit séparer deux arbres');
ok(empreinte({ a: 1 }) !== empreinte({ a: 1, b: 1 }),
   '9. (mord) un champ EN PLUS doit séparer deux arbres — comparer les seuls champs communs '
   + 'laisserait passer tout ce que le dépliage ajoute en trop');

if (echecs.length) {
  console.error(`❌ une forme a franchi la frontière : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ une commodité d'écriture se déplie avant l'arbre — ${passe} vérification(s) passée(s)`);
}
