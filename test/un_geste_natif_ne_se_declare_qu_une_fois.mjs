#!/usr/bin/env node
/**
 * GARDE — un geste du moteur natif se déclare UNE FOIS, en donnée, sur la clé qui en est l'image.
 *
 * Arbitrage Romain du 2026-08-12 : un contrôle se compare à ce qu'il SIGNIFIE, jamais au nom sous
 * lequel il s'écrit ; l'équivalence se DÉCLARE une fois, au même endroit que la règle. Le champ
 * `bp3` d'une clé de librairie EST cette déclaration, et les deux voies de mesure la lisent.
 *
 * CE QUE CE GARDE TIENT — la portée ET son complément :
 *   - UNICITÉ : deux clés ne peuvent pas revendiquer le même geste natif. `transpose` et
 *     `chromashift` portent des noms voisins et des gestes DIFFÉRENTS (mesuré : en intonation
 *     juste sur do4, `chromashift:4` rend 330,000 Hz et `transpose:400c` 332,619 Hz — 13,7
 *     centièmes). Si les deux revendiquaient `_transpose`, la comparaison choisirait au hasard.
 *   - FORME : un geste natif s'écrit comme le natif l'écrit.
 *   - LA PROSE NE FAIT JAMAIS AUTORITÉ SEULE : une description qui NOMME un geste natif exige que
 *     ce geste soit déclaré quelque part en donnée. C'est le défaut que bp3-frontend a mesuré —
 *     une correspondance qui vit dans un commentaire devient une seconde autorité, et se périme
 *     sans un signe.
 *   - COMPLÉMENT : une clé qui ne revendique rien ne porte pas le champ, et le champ n'est jamais
 *     vide.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/transpiler/index.js');
const LIBS = require('../src/transpiler/libs.js').leRegistre();

let ok = 0; let ko = 0;
const verifier = (cond, quoi) => { if (cond) { ok += 1; } else { ko += 1; console.error(`FAIL — ${quoi}`); } };

/** Toutes les entrées d'objet des librairies, avec leur chemin complet. */
function entrees(racine = LIBS) {
  const out = [];
  const parcours = (obj, chemin) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    for (const [k, v] of Object.entries(obj)) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      out.push({ chemin: `${chemin}.${k}`, cle: k, valeur: v });
      parcours(v, `${chemin}.${k}`);
    }
  };
  for (const [n, l] of Object.entries(racine)) parcours(l, n);
  return out;
}

const toutes = entrees();
const declarantes = toutes.filter((e) => typeof e.valeur.bp3 === 'string');
verifier(declarantes.length > 0, 'au moins une clé déclare un geste natif(sinon le garde ne mesure rien)');

// ── UNICITÉ : un geste natif, une seule clé ───────────────────────────────────────────────────
/**
 * ⛔ UNE PAIRE PARTAGE SON IMAGE, ET C'EST LA VALEUR QUI LES SÉPARE — 2026-08-21.
 *
 * `resetnotes` et `letring` visent tous deux `ResetNotes` : l'un à 1, l'autre à 0. Ce n'est pas une
 * collision, c'est ce que Romain a voulu en donnant une paire à chaque geste dont le défaut est
 * configurable — une scène doit pouvoir dire le CONTRAIRE de ce qui est réglé.
 *
 * CE QUI RESTE UNE COLLISION : deux clés qui visent la même image SANS que leurs valeurs les
 * distinguent. Là, rien ne dit laquelle écrit, et l'aval choisit à ma place. Deux clés qui portent
 * la MÊME valeur sur la MÊME image sont donc refusées comme avant.
 */
function collisions(liste) {
  const par = new Map();
  for (const e of liste) {
    if (!par.has(e.valeur.bp3)) par.set(e.valeur.bp3, []);
    par.get(e.valeur.bp3).push(e);
  }
  return [...par.entries()]
    .filter(([, l]) => {
      if (l.length <= 1) return false;
      const valeurs = l.map((e) => e.valeur.bp3value);
      // départagées si CHACUNE porte une valeur et qu'elles sont toutes distinctes
      const distinctes = new Set(valeurs.map((v) => JSON.stringify(v)));
      return valeurs.some((v) => v === undefined) || distinctes.size !== valeurs.length;
    })
    .map(([g, l]) => [g, l.map((e) => e.chemin)]);
}
verifier(collisions(declarantes).length === 0,
  `aucun geste natif n'est revendiqué deux fois — ${collisions(declarantes).map(([g, l]) => `${g} par ${l.join(' et ')}`).join(' ; ')}`);

// LE PIÈGE NOMMÉ, tenu explicitement : les deux clés de transposition ne revendiquent pas le même.
const parNom = new Map(declarantes.map((e) => [e.cle, e.valeur.bp3]));
verifier(parNom.get('chromashift') === '_transpose', 'chromashift déclare être l\'image de _transpose');
verifier(parNom.get('transpose') === undefined, 'transpose ne revendique AUCUN geste natif — son nom voisin ne vaut pas équivalence');

// ── FORME : une image native est un NOM ───────────────────────────────────────────────────────
// ⛔ LA FORME `_` + NOM A ÉTÉ RELÂCHÉE — Romain, 2026-08-21. Ce n'était pas une règle : c'était
// l'empreinte de la seule table contre laquelle ce garde avait été écrit, celle des mots du FLUX.
// Le moteur s'écrit à deux endroits, et le second — le fichier de réglages — nomme ses clés sans
// tiret bas : `EndFadeOut`, `MIDIsyncDelay`, `ResetWeights`. Lier un mot BPScript sans tiret bas à
// une commande native qui en porte un est résolu depuis toujours (`def chan(bp3:_chan, …)`) ;
// c'est le même mécanisme dans l'autre sens. LE CHAMP PORTE LE NOM NATIF, QUEL QU'IL SOIT.
// Ce que le moteur porte RÉELLEMENT se prouve ailleurs, contre ses deux tables — garde
// `un_controle_dit_sa_graphie_native`, volets 3 et 5. Ici on tient la forme, pas l'existence.
// `lambda` reste nommée : le langage l'écrit ainsi, la chaîne vide sans souligné des deux côtés.
for (const e of declarantes) {
  const v = e.valeur.bp3;
  verifier(v.length > 0, `${e.chemin} : le geste natif déclaré n'est pas vide`);
  verifier(v === 'lambda' || /^[_a-zA-Z][a-zA-Z0-9_]*$/.test(v),
    `${e.chemin} : « ${v} » est un NOM`);
  verifier(!/\s/.test(v), `${e.chemin} : « ${v} » ne porte aucun blanc`);
}

// ── LA PROSE NE FAIT PAS AUTORITÉ SEULE ───────────────────────────────────────────────────────
const gestesDeclares = new Set(declarantes.map((e) => e.valeur.bp3));
const prosesQuiNomment = toutes
  .map((e) => ({ ...e, nomme: typeof e.valeur.description === 'string' ? (e.valeur.description.match(/BP3 (_[a-zA-Z][a-zA-Z0-9]*)/) || [])[1] : undefined }))
  .filter((e) => e.nomme);
verifier(prosesQuiNomment.length > 0, 'au moins une description nomme un geste natif(sinon le complément ne mesure rien)');
for (const e of prosesQuiNomment) {
  verifier(gestesDeclares.has(e.nomme),
    `${e.chemin} : sa description nomme « ${e.nomme} », et ce geste est DÉCLARÉ en donnée quelque part`);
  // Et quand la clé porte elle-même le champ, les deux disent la MÊME chose.
  if (typeof e.valeur.bp3 === 'string') {
    verifier(e.valeur.bp3 === e.nomme, `${e.chemin} : son champ et sa description nomment le même geste`);
  }
}

// ── COMPLÉMENT : celles qui ne revendiquent rien ne portent rien ──────────────────────────────
const muettes = toutes.filter((e) => e.valeur.bp3 === undefined);
verifier(muettes.length > declarantes.length, 'la plupart des entrées ne revendiquent aucun geste natif');
for (const e of muettes.slice(0, 40)) {
  verifier(!('bp3' in e.valeur), `${e.chemin} ne porte pas de champ vide`);
}

// ── LE JUGE MORD ──────────────────────────────────────────────────────────────────────────────
{
  // INJECTION 1 — une seconde clé revendique un geste déjà pris : la vérification doit rougir.
  const usurpateur = { chemin: 'transpo.controls.transpose', cle: 'transpose', valeur: { bp3: '_transpose' } };
  const avec = [...declarantes, usurpateur];
  verifier(collisions(declarantes).length === 0 && collisions(avec).length === 1,
    'la vérification d\'unicité DÉSIGNE la collision quand on injecte une seconde revendication');
  verifier(collisions(avec)[0][0] === '_transpose',
    'et elle nomme le geste revendiqué deux fois');

  // INJECTION 1bis — LE CAS QU'OUVRE LA PAIRE, et sans lui l'assouplissement serait une porte
  // ouverte. Deux clés visent la même image AVEC LA MÊME VALEUR : rien ne les départage, l'aval
  // choisit à ma place, et la vérification doit rougir exactement comme avant.
  const jumeaux = [
    { chemin: 'x.controls.a', cle: 'a', valeur: { bp3: 'ResetFlags', bp3value: 1 } },
    { chemin: 'x.controls.b', cle: 'b', valeur: { bp3: 'ResetFlags', bp3value: 1 } },
  ];
  verifier(collisions([...declarantes, ...jumeaux]).some(([g]) => g === 'ResetFlags'),
    'deux clés qui visent la même image AVEC LA MÊME VALEUR restent une collision');
  // ET LA CONTREPARTIE : les mêmes, valeurs distinctes, passent — c'est une paire.
  const paire = [
    { chemin: 'x.controls.a', cle: 'a', valeur: { bp3: 'ResetFlags', bp3value: 1 } },
    { chemin: 'x.controls.b', cle: 'b', valeur: { bp3: 'ResetFlags', bp3value: 0 } },
  ];
  verifier(!collisions([...declarantes, ...paire]).some(([g]) => g === 'ResetFlags'),
    'et les mêmes, valeurs INVERSES, forment une paire légitime');

  // INJECTION 2 — on retire la déclaration d'un geste que des proses nomment : elles doivent
  // rester orphelines, donc la vérification de prose doit rougir.
  const ampute = new Set([...gestesDeclares]); ampute.delete('_transpose');
  const orphelines = prosesQuiNomment.filter((e) => !ampute.has(e.nomme));
  verifier(orphelines.length > 0,
    'la vérification de prose DÉSIGNE les descriptions orphelines quand on retire leur déclaration');
  verifier(prosesQuiNomment.every((e) => gestesDeclares.has(e.nomme)),
    "et sur l'état réel, aucune description n'est orpheline");
}

console.log(`Résultat un_geste_natif_ne_se_declare_qu_une_fois : ${ok} OK, ${ko} FAIL`);
if (ko) process.exit(1);
