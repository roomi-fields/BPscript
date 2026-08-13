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
 * CE QU'IL MESURE, EN MATRICE — la sorte de définition × ce que l'arbre doit en garder :
 *   1. le nom du préréglage a DISPARU des symboles de l'arbre ;
 *   2. le réglage CANONIQUE est là, avec sa valeur ;
 *   3. son DESTINATAIRE est là, identique à celui qu'aurait la forme écrite en direct ;
 *   4. l'arbre déplié est INDISCERNABLE de celui de l'écriture directe — la comparaison porte sur
 *      la structure entière, pas sur les champs que j'aurais choisis ;
 *   5. ce qui n'est PAS du sucre survit : un terminal déclaré garde son nom.
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
{
  const t = arbreDe(`${TETE}@def kick (vel:120)\n\nS -> kick(C4)\n`);
  ok(t.erreurs.some((e) => /est un préréglage : il se pose NU/.test(String(e.message))),
     '7. un préréglage APPELÉ avec des arguments doit être refusé, avec sa réécriture');
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
