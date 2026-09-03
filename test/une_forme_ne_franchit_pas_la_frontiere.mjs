#!/usr/bin/env node
/**
 * GARDE — une COMMODITÉ D'ÉCRITURE se déplie avant l'arbre, et n'en franchit jamais la frontière.
 *
 * LA QUESTION QUI A FAIT CE GARDE (Romain, 2026-08-12, en ouvrant les librairies de forme) :
 * « le def est résolu où ? par quel composant ? et comment on assure qu'à la fin on retombe bien
 * sur le contrôle final de la librairie avec son destinataire dans l'arbre ? »
 *
 * LA MESURE D'ALORS, ET ELLE ÉTAIT MAUVAISE : par PERSONNE. Une scène qui écrivait
 * `@def kick(vel:120)` puis posait `kick` produisait un symbole opaque nommé `kick`, étiqueté
 * `nature:'sounding'` — donc lu en aval comme une NOTE. Le réglage canonique n'apparaissait pas,
 * son destinataire non plus, et aucun des cinq voisins ne lit `DefDirective`.
 *
 * LA RÈGLE QUE CE GARDE TIENT : l'arbre ne porte que le vocabulaire CANONIQUE. Tout ce qui est en
 * aval — la table des destinataires, les autres gardes, les consommateurs — s'indexe dessus sans
 * cas particulier. Une forme sert à écrire ; elle ne voyage pas.
 *
 * LES TROIS SORTES QUI SE DÉPLIENT, et elles n'ajoutent QUE de l'écriture :
 *   `prereglage`      `@def kick(vel:120)`        un sac de réglages nommé ;
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

const TETE = 'core\nalphabet.western:midi\n';
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
const direct = arbreDe(`${TETE}-----\nS -> !(vel:120) C4\n`);
ok(direct.erreurs.length === 0, `0. l'écriture directe doit compiler(${direct.erreurs[0]?.message})`);
const sacsDirect = sacsDe(direct.ast.subgrammars);
ok(sacsDirect.length === 1 && sacsDirect[0].params.vel === 120,
   `0. l'écriture directe doit porter un sac(vel:120) — reçue ${JSON.stringify(sacsDirect)}`);
ok(sacsDirect[0].resolvedBy?.vel === 'toutes les sorties',
   `0. l'écriture directe doit porter son destinataire — reçu ${JSON.stringify(sacsDirect[0].resolvedBy)}`);

// ─── 1 à 4. LE PRÉRÉGLAGE DÉPLIÉ ─────────────────────────────────────────────────────────────
const deplie = arbreDe(`${TETE}def kick(vel:120)\n\n-----\nS -> kick C4\n`);
ok(deplie.erreurs.length === 0, `1. le préréglage doit compiler(${deplie.erreurs[0]?.message})`);
ok(!symbolesDe(deplie.ast.subgrammars).includes('kick'),
   "1. le nom 'kick' ne doit plus figurer dans les symboles de l'arbre — une forme ne franchit pas "
   + `la frontière(symboles : ${JSON.stringify(symbolesDe(deplie.ast.subgrammars))})`);
const sacsDeplie = sacsDe(deplie.ast.subgrammars);
ok(sacsDeplie.length === 1 && sacsDeplie[0].params.vel === 120,
   `2. le réglage canonique(vel:120) doit être dans l'arbre — reçu ${JSON.stringify(sacsDeplie)}`);
ok(sacsDeplie[0]?.resolvedBy?.vel === 'toutes les sorties',
   `3. le destinataire doit suivre le réglage déplié — reçu ${JSON.stringify(sacsDeplie[0]?.resolvedBy)}`);
ok(empreinte(deplie.ast.subgrammars) === empreinte(direct.ast.subgrammars),
   "4. l'arbre déplié doit être INDISCERNABLE de celui de l'écriture directe. Choisir les champs "
   + 'comparés reviendrait à choisir ce qu\'on ne verra pas.');

// ─── 5. CE QUI N'EST PAS DU SUCRE SURVIT ─────────────────────────────────────────────────────
// Un terminal déclaré CRÉE un nom : le déplier l'effacerait. Le tri se lit sur la sorte.
{
  const t = arbreDe('core\nalphabet.western:midi\ndef ka voice.bayan_muted\n-----\nS -> ka\n');
  if (t.erreurs.length) {
    ok(false, `5. la déclaration de terminal doit compiler(${t.erreurs[0]?.message})`);
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
  ['préréglage',                 `def kick(vel:120)\n\n-----\nS -> kick C4\n`,        `S -> !(vel:120) C4\n`],
  ['transformation, 1 paramètre', `def accent(x) x(vel:120)\n\n-----\nS -> accent(C4)\n`, `S -> C4(vel:120)\n`],
  ['transformation, 2 paramètres', `def duo(a,b) a!b\n\n-----\nS -> duo(C4,E4)\n`,      `S -> C4!E4\n`],
  ['paramètre RÉPÉTÉ dans le corps', `def echo(x) x x\n\n-----\nS -> echo(C4)\n`,       `S -> C4 C4\n`],
  ['structure posée nue',        `def cadence C4 D4 E4\n\n-----\nS -> cadence\n`,      `S -> C4 D4 E4\n`],
  ['structure sous un groupe',   `def cadence C4 D4\n\n-----\nS -> {cadence, E4}\n`,   `S -> {C4 D4, E4}\n`],
  ['une forme DANS une forme',   `def a C4 D4\ndef b a E4\n\n-----\nS -> b\n`,        `S -> C4 D4 E4\n`],
  ['structure à silence et prolongation', `def creux C4 - _\n\n-----\nS -> creux D4\n`, `S -> C4 - _ D4\n`],
]) {
  const g = arbreDe(`${TETE}${avecForme}`);
  const d = arbreDe(`${TETE}-----\n${enDirect}`);
  if (g.erreurs.length || d.erreurs.length) {
    ok(false, `5bis. ${quoi} : les deux écritures doivent compiler(${g.erreurs[0]?.message ?? d.erreurs[0]?.message})`);
    continue;
  }
  ok(empreinte(g.ast.subgrammars) === empreinte(d.ast.subgrammars),
     `5bis. ${quoi} — l'arbre déplié doit être INDISCERNABLE de l'écriture directe`);
}

// ─── 5ter. LE VOLET DE L'INVOCATION DE MODULE EST PARTI AVEC SA FORME ────────────────────────
// ⛔ Il éprouvait que `def monte ramp1(from:0, to:255)` ne se déplie PAS — `ramp1` était une
// instance de module déclarée, `from` et `to` ses ports, et une invocation est une CHOSE. Le
// catalogue `mod` est archivé le 2026-08-23 et ses trois entrées quittent le langage : `ramp ramp1`
// ne compile plus, donc l'accusé de ce volet ne peut plus naître. Le tri qu'il gardait a été élagué
// de `parser.js` dans le même mouvement — un filtre qui ne peut plus rien filtrer a exactement la
// même forme qu'un filtre qui n'a rien à filtrer.

// ─── 6. LE DÉPLIAGE NE SORT PAS DU MEMBRE DROIT ──────────────────────────────────────────────
// ⚠️ CE VOLET EXISTE PARCE QUE J'AI CRÉÉ LE DÉFAUT et qu'il était silencieux : en balayant l'arbre
// entier, le dépliage remplaçait la TÊTE d'une règle nommée comme la forme — la règle perdait son
// nom, et le conflit de noms, qui est refusé, ne se déclarait plus. Une forme s'emploie là où un
// terme s'emploie ; une tête de règle n'est pas un emploi, c'est une déclaration.
{
  const t = arbreDe(`${TETE}def kick(vel:120)\n\n-----\nkick -> C4\nS -> kick\n`);
  ok(t.erreurs.some((e) => /bears a name already taken by a definition/.test(String(e.message))),
     "6. une TÊTE DE RÈGLE homonyme d'une forme doit rester un conflit de noms REFUSÉ — le "
     + `dépliage ne doit pas l'effacer en la réécrivant(reçu : ${JSON.stringify(t.erreurs.map((e) => String(e.message).slice(0, 60)))})`);
}

// ─── 6bis. ⛔ UNE RÈGLE N'A DE NOM QUE SI SON MEMBRE GAUCHE EST UN SEUL SYMBOLE ──────────────
// Le contrat ne porte aucun champ `name` sur une règle (`AST.md`, `Rule` : `lhs: LhsElement[]`),
// et la bible dit que « le membre gauche est réécrit en membre droit » — une SÉQUENCE, jamais un
// identifiant. Le contrôle de collision parcourait pourtant CHAQUE élément du membre gauche et
// l'accusait comme une tête.
//
// ⚠️ CE QUE ÇA A COÛTÉ, et c'est BPx qui l'a isolé au cas minimal le 2026-08-19 : la règle
// CONTEXTUELLE `M trkt <> trkt M` — `-gr.dhati2:28` de Bernard, que le natif compile sans réserve
// — était REFUSÉE dès que `trkt` devenait une définition. Le même mot passait à DROITE et tombait
// à GAUCHE. Il a laissé la scène rouge plutôt que de renommer un symbole de la grammaire : le
// renommage aurait réparé au point d'observation.
//
// LA MATRICE EST LA POSITION, parce que c'est là que l'écart vivait — et son COMPLÉMENT avec :
// une tête unique reste contrôlée, sinon lever le contrôle passerait pour l'avoir borné.
{
  const D = `${TETE}def trkt tr kt\n-----\n`;
  const collision = (regle) => arbreDe(D + regle + '\n').erreurs
    .some((e) => /bears a name already taken by a definition/.test(String(e.message)));
  for (const [quoi, regle, attendu] of [
    ['membre DROIT, deux symboles à gauche',     'V V <> trkt',      false],
    ['membre DROIT, un symbole à gauche',        'S <> trkt',        false],
    ['membre GAUCHE SEUL — la règle A un nom',   'trkt <> dha',      true],
    ['membre GAUCHE en SÉQUENCE contextuelle',   'M trkt <> trkt M', false],
    ['séquence en production',                   'M trkt -> dha',    false],
    ['séquence de trois',                        'M trkt V -> dha',  false],
    // ⚠️ LE CONTEXTE NIÉ NE COMPTE PAS COMME UN SYMBOLE DE TÊTE : `#K M -> C4` porte deux entrées
    // dans `lhs` pour UNE seule tête. Compter `lhs.length` aurait exempté en silence la forme que
    // la décision du 2026-07-28 nomme — le contrôle doit tenir ici.
    ['une tête unique derrière un contexte nié', '#dha trkt -> dha', true],
  ]) {
    ok(collision(regle) === attendu,
       `6bis. « ${regle} » — collision ${attendu ? 'ATTENDUE' : 'INTERDITE'} : une règle n'a de nom `
       + `que si son membre gauche est un seul symbole(${quoi})`);
  }
}

// ─── 7. LA SORTE SE LIT SUR LA FORME DE L'USAGE ──────────────────────────────────────────────
// Un préréglage se pose NU. Appelé avec des arguments, il ne se devine pas : il se refuse, avec
// sa réécriture. Sans ce refus, `kick(C4)` traversait l'arbre en appel opaque étiqueté SONNANT —
// le mode d'échec que ce garde tient tout entier.
// LA MATRICE DES ÉCARTS — chaque façon d'employer une forme de travers, et le refus qui l'attend.
// Sans eux, l'écart traversait l'arbre en appel opaque étiqueté SONNANT : le mode d'échec que ce
// garde tient tout entier.
for (const [ecart, src, motif] of [
  ['un préréglage APPELÉ',        `def kick(vel:120)\n\n-----\nS -> kick(C4)\n`,       /is a preset: it is placed BARE/],
  ['une structure APPELÉE',       `def cadence C4 D4\n\n-----\nS -> cadence(E4)\n`,     /is a structure: it is placed BARE/],
  ['une transformation POSÉE NUE', `def accent(x) x(vel:120)\n\n-----\nS -> accent\n`,  /is a transformation on x/],
  ['un argument DE TROP',         `def accent(x) x(vel:120)\n\n-----\nS -> accent(C4, D4)\n`, /1 parameter\(s\).*2 argument\(s\)/],
  ['un argument NOMMÉ',           `def accent(x) x(vel:120)\n\n-----\nS -> accent(x: C4)\n`, /by POSITION, never by name/],
  ['une forme qui SE contient',   `def a C4 a\n\n-----\nS -> a\n`,                      /expands without end/],
  ['deux formes qui se contiennent', `def a b\ndef b a\n\n-----\nS -> a\n`,            /expands without end/],
]) {
  const t = arbreDe(`${TETE}${src}`);
  ok(t.erreurs.some((e) => motif.test(String(e.message))),
     `7. ${ecart} doit être refusé, avec sa réécriture(reçu : `
     + `${JSON.stringify(t.erreurs.map((e) => String(e.message).slice(0, 70)))})`);
}

// ─── 8. LE COMPLÉMENT — la forme se déplie PARTOUT où un terme se pose ───────────────────────
// Écrire la portée sans son complément décrirait un langage plus étroit que le vrai : une forme
// posée sous un groupe polymétrique est un emploi comme un autre, et elle s'y déplie.
{
  const g = arbreDe(`${TETE}def kick(vel:120)\n\n-----\nS -> {kick C4, D4}\n`);
  const d = arbreDe(`${TETE}-----\nS -> {!(vel:120) C4, D4}\n`);
  ok(g.erreurs.length === 0 && d.erreurs.length === 0,
     `8. les deux écritures groupées doivent compiler(${g.erreurs[0]?.message ?? d.erreurs[0]?.message})`);
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
