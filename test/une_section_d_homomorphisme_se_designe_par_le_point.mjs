#!/usr/bin/env node
/**
 * GARDE — UNE SECTION D'HOMOMORPHISME SE DÉSIGNE PAR LE POINT, ET L'ORDRE DES SECTIONS COMPTE.
 *
 * FORME VALIDÉE PAR ROMAIN le 2026-08-10. La bible pose déjà la table entre le gabarit maître et
 * son esclave (`docs/spec/LANGUAGE.md:1635` — « elle s'applique entre un gabarit maître et son
 * esclave, dont le nom se pose entre les deux ») ; ce qui manquait était la SECTION.
 *
 * `S -> $N14 checkhomo.TR &N14`         — une section
 * `S -> $N14 checkhomo checkhomo.TR &N14` — deux, dans l'ordre où elles s'appliquent
 *
 * POURQUOI CETTE FORME ET PAS UNE AUTRE : le `.` désigne déjà un élément dans un espace de noms
 * (`alphabet.sargam`, `sitar.sa`, `lpf1.cutoff`), et l'espace sépare déjà deux termes dont la suite
 * porte l'ordre. Aucun signe nouveau — c'est le critère qui a fait écarter les trois autres
 * propositions.
 *
 * ⚠️ POURQUOI L'ORDRE DOIT ÊTRE DISABLE, mesuré sur le natif : `bp3-engine/test-data/-gr.checkHomo`
 * écrit `S --> (= X) * TR (: X) Y` et `Y --> (= a b) TR * (: b' b)` — les deux sections dans les
 * deux ordres, en miroir, dans la même grammaire. Une forme qui ne saurait pas les distinguer
 * porterait deux règles différentes de la même façon.
 *
 * ⚠️ ET LA FORME NUE VAUT LA SECTION PAR DÉFAUT — pas « toutes les sections ». J'avais écrit
 * « toutes » ici, et personne ne l'avait dit : le natif dit l'inverse. `docs/reference/HO_FORMAT.md`
 * :110 — « `*` est le label par défaut (index 0), les autres sont des noms arbitraires définis par
 * le compositeur ». `*` est donc UNE section, celle qu'on n'a pas nommée.
 * J'avais comblé un silence de la bible par une supposition, et je l'avais écrite comme un fait
 * dans un garde — l'endroit le plus difficile à démentir ensuite.
 *
 * CE QUE ÇA RÈGLE, et c'est l'arbitrage de Romain (2026-08-10) : « ne rien spécifier » et « la
 * section par défaut » sont LA MÊME CHOSE dans le fichier source. La forme nue suit donc deux
 * principes déjà en vigueur — le préfixe optionnel par unicité, et la cascade de défauts (« tout ce
 * qu'une scène peut définir a un défaut »). Aucune lecture n'est ajoutée au signe `*`, qui reste
 * hors du langage de surface.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const S = '@core\n@alphabet.western\n@homomorphism.checkhomo\n';
const err = (flux) => {
  try { return (compileToBPxAST(S + flux).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};

// ── 1. LES ÉCRITURES JUSTES ──────────────────────────────────────────────────────────────────
const JUSTES = [
  ['la table nue — sa section par défaut', 'S -> $N14 checkhomo &N14'],
  ['une section',                        'S -> $N14 checkhomo.TR &N14'],
  ['la section par défaut, puis une nommée', 'S -> $N14 checkhomo checkhomo.TR &N14'],
  ["l'ordre inverse",                    'S -> $N14 checkhomo.TR checkhomo &N14'],
  ['trois sections',                     'S -> $N14 checkhomo checkhomo.H checkhomo.TR &N14'],
];
console.log(`[section d'homomorphisme] ${JUSTES.length} écritures justes + les refus mérités`);
for (const [quoi, flux] of JUSTES) {
  const e = err(flux);
  ok(e.length === 0, `1. '${flux}' (${quoi}) doit PASSER — reçu : ${e[0]}`);
}

// ── 2. ET L'ORDRE ARRIVE DANS L'ARBRE ────────────────────────────────────────────────────────
// Sans ce bloc, une correction qui accepterait les deux écritures en les rendant IDENTIQUES
// passerait la matrice ci-dessus : la compilation réussirait pour la mauvaise raison.
{
  const lire = (flux) => {
    const r = compileToBPxAST(S + flux);
    const rhs = r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [];
    return rhs.filter((el) => el && el.actor === 'checkhomo').map((el) => el.name);
  };
  const droit = lire('S -> $N14 checkhomo.H checkhomo.TR &N14');
  const inverse = lire('S -> $N14 checkhomo.TR checkhomo.H &N14');
  ok(droit.length === 2, `2. les deux sections arrivent dans l'arbre (reçu ${JSON.stringify(droit)})`);
  ok(JSON.stringify(droit) !== JSON.stringify(inverse),
    `2. L'ORDRE EST SIGNIFIANT — '* TR' et 'TR *' ne peuvent pas rendre le même arbre. Le natif `
    + `écrit les deux dans la même grammaire (-gr.checkHomo). Reçu : ${JSON.stringify(droit)} et `
    + `${JSON.stringify(inverse)}`);
}

// ── 3. LES REFUS MÉRITÉS — la moitié qui démasque une acceptation trop large ──────────────────
{
  const e = err('S -> $N14 zorglub.TR &N14');
  ok(e.length >= 1, "3. une table NON déclarée reste refusée — sinon n'importe quel nom pointé passe");
  ok(err('S -> $N14 checkhomo.TR &N14').length === 0 && e.length >= 1,
    '3. et le refus ne mord QUE la table inconnue, pas la déclarée');
}

// ── 4. TÉMOIN D'INSTRUMENT ───────────────────────────────────────────────────────────────────
// Sans lui, un compilateur devenu permissif rendrait ce fichier vert pour la pire des raisons.
ok(err('S -> $N14 inconnu.X &N14').length >= 1,
  '4. TÉMOIN — le compilateur mord encore sur un nom pointé qui ne désigne rien');
ok(JUSTES.length >= 5, `4. la matrice ne s'est pas vidée — ${JUSTES.length} écritures`);
// ⚠️ ET LE SIGNE `*` N'ENTRE PAS DANS LA SURFACE : `checkhomo.*` se découpe en trois morceaux
// (symbole, point, accolade brute) et la section disparaît EN SILENCE — mesuré le 2026-08-10.
// C'est la raison pour laquelle la section par défaut s'écrit NUE : le témoin le tient.
ok(err('S -> $N14 checkhomo.* &N14').length === 0
   && !(compileToBPxAST(S + 'S -> $N14 checkhomo.* &N14').ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [])
        .some((el) => el && el.actor === 'checkhomo'),
  "4. TÉMOIN — `checkhomo.*` ne porte AUCUNE section dans l'arbre : la forme par défaut s'écrit "
  + 'NUE, et ce témoin rougira si quelqu\'un croit un jour que `.*` fonctionne.');

if (echecs.length) {
  console.error(`[section d'homomorphisme] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[section d'homomorphisme] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
