#!/usr/bin/env node
/**
 * GARDE — UNE LIBRAIRIE S'INVOQUE PAR LE MOT QU'ELLE DÉCLARE, JAMAIS PAR LE NOM DE SON FICHIER.
 *
 * DÉCISION DE ROMAIN, 2026-08-17 —
 * `hub/decisions/2026-08-17-une-librairie-declare-le-mot-sous-lequel-on-l-invoque.md`, section
 * **« Ce qui est décidé »** : *« Une invocation et une clé d'acteur emploient le même mot. »*
 * Et le PRINCIPE, plus bas : *« le nom logique se sépare du nom physique — un fichier se renomme,
 * se scinde ou s'ajoute sans qu'aucune scène change. »*
 *
 * ⛔ CE QUE CE GARDE FERME, ET POURQUOI IL A FALLU SEPT JOURS. La décision porte AUSSI une section
 * « L'état mesuré » qui écrit *« l'invocation admet les deux »*. Trois d'entre nous — l'architecte,
 * Kairos et moi — avons lu cette phrase comme une permission. **C'est un CONSTAT de la divergence
 * que la partie prescriptive ordonne de fermer**, et c'est le RANG DES SECTIONS qui le dit. Kairos a
 * rouvert le fichier au lieu de nous croire.
 *
 * ⛔ ET LA BRÈCHE ÉTAIT UNIQUE, MESURÉE PLACE PAR PLACE — chacune éprouvée DEUX FOIS, avec le mot
 * déclaré (témoin positif : la place existe et compile) et avec le nom de fichier :
 *
 *     tête NUE                 ✓ acceptait      ⬅ LA BRÈCHE, 8 noms physiques sur 8
 *     tête POINTÉE             ⛔ refusait
 *     clé d'ACTEUR             ⛔ refusait
 *     préfixe de contrôle       ⛔ refusait
 *
 * **Quatre places conformes ne protègent rien tant que la cinquième est ouverte** : une scène qui
 * commence par un nom de fichier casse au renommage, exactement ce que le principe interdit.
 *
 * ⚠️ AUCUN NOM N'EST ÉCRIT ICI. Les couples (fichier, mot) se dérivent du champ `resolves` de la
 * donnée publiée. Une librairie ajoutée demain entre dans ce garde le jour même, et une librairie
 * dont le nom ÉGALE son mot n'y entre jamais — c'est la donnée qui le dit, pas une liste.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const refus = (src) => {
  try {
    // `core` en tête quand la scène ne l'écrit pas : sans alphabet en portée, `C4` est refusé
    // (Romain, 2026-09-02), et ce garde mesure l'invocation, pas l'alphabet.
    const avecSocle = src.startsWith('core') ? src : `core\n${src}`;
    const r = compileToBPxAST(avecSocle.endsWith('\n') ? avecSocle : `${avecSocle}\n`);
    const x = (r.errors || [])[0];
    return x ? String(x.message || x) : null;
  } catch (err) { return `EXCEPTION ${err.message}`; }
};

// ── LES COUPLES, DÉRIVÉS DE LA DONNÉE ───────────────────────────────────────────────────────
const DIVERGENTS = [];
for (const [fichier, lib] of Object.entries(LIBS)) {
  if (lib && typeof lib === 'object' && typeof lib.resolves === 'string' && lib.resolves
      && lib.resolves !== fichier) DIVERGENTS.push([fichier, lib.resolves]);
}
const IDENTIQUES = Object.entries(LIBS)
  .filter(([f, l]) => l && typeof l === 'object' && l.resolves === f).map(([f]) => f);

ok(DIVERGENTS.length > 0,
  '⛔ ZÉRO couple divergent dans la donnée — ce garde n\'aurait plus d\'objet, ou le champ `resolves` '
  + 'a changé de forme. Dans les deux cas il ne veille plus.');
ok(IDENTIQUES.length > 0,
  '⛔ ZÉRO librairie dont le nom ÉGALE son mot — le volet du complément ci-dessous n\'éprouverait rien.');

// ── A. LA TÊTE NUE REFUSE LE NOM PHYSIQUE, ET NOMME LE MOT À ÉCRIRE ─────────────────────────
for (const [fichier, mot] of DIVERGENTS) {
  const m = refus(`${fichier}\n-----\nS -> C4`);
  ok(m !== null,
    `A. « ${fichier} » nu en tête doit être REFUSÉ : c'est le NOM DU FICHIER, et la décision du `
    + `2026-08-17 exige le mot déclaré « ${mot} ».`);
  ok(m === null || m.includes(mot),
    `A. et le refus doit NOMMER le mot à écrire « ${mot} » — sinon l'auteur cherche une donnée `
    + `manquante au lieu de changer un mot. Reçu : ${String(m).slice(0, 130)}`);
}

// ── B. LE TÉMOIN POSITIF — le mot DÉCLARÉ compile, à la même place ──────────────────────────
// ⛔ Sans lui, un compilateur qui refuserait TOUTE tête nue passerait le volet A en entier.
for (const [, mot] of DIVERGENTS) {
  ok(refus(`${mot}\n-----\nS -> C4`) === null,
    `B-témoin. le mot DÉCLARÉ « ${mot} » doit compiler en tête nue — reçu : `
    + `${String(refus(`${mot}\n-----\nS -> C4`)).slice(0, 110)}`);
}

// ── C. LE COMPLÉMENT — un fichier dont le nom ÉGALE son mot n'est PAS touché ────────────────
// La règle porte sur la DIVERGENCE entre nom physique et mot logique, jamais sur le fait d'écrire
// un nom de fichier : quand les deux coïncident, il n'y a rien à distinguer.
{
  let vus = 0;
  for (const f of IDENTIQUES) {
    const m = refus(`${f}\n-----\nS -> C4`);
    vus++;
    ok(m === null || !/FILE NAME/.test(m),
      `C. « ${f} » a le même nom que son mot déclaré : ce garde ne doit PAS le refuser comme un nom `
      + `physique. Reçu : ${String(m).slice(0, 110)}`);
  }
  ok(vus === IDENTIQUES.length, `C. ${vus} / ${IDENTIQUES.length} librairie(s) non divergente(s) éprouvée(s)`);
}

// ── D. LA BORNE — un mot qu'aucune librairie ne porte reste refusé pour SA cause ────────────
// Sans elle, la réparation pourrait avoir remplacé un refus juste par un autre.
{
  const m = refus('zzzjamais\n-----\nS -> C4');
  ok(m !== null, "D-borne. un mot qu'aucune librairie ne porte doit rester REFUSÉ.");
  ok(m === null || !/FILE NAME/.test(m),
    `D-borne. et son refus ne doit PAS l'accuser d'être un nom de fichier — il n'en est pas un. `
    + `Reçu : ${String(m).slice(0, 110)}`);
}

// ── E. LES QUATRE AUTRES PLACES N'ONT PAS BOUGÉ ────────────────────────────────────────────
// ⛔ La prédiction déposée avant la frappe disait : « ces huit noms cessent d'être acceptés à CETTE
// place, et rien d'autre ne bouge ». Ce volet est ce qui la tient dans le temps.
{
  const [fichier, mot] = DIVERGENTS[0];
  const pointeFichier = refus(`core\n${fichier}.western\n-----\nS -> C4`);
  ok(pointeFichier !== null && /FILE NAME/.test(pointeFichier),
    `E. la tête POINTÉE refusait déjà le nom physique et doit continuer — reçu : ${pointeFichier}`);
  ok(refus(`core\nalphabet.western:midi\n-----\nS -> C4(vel:120)`) === null,
    'E. une affectation ordinaire doit compiler — la fermeture ne touche pas les sacs.');
  ok(refus(`core\nalphabet.western:midi\n-----\nS -> C4(midi.volume:80)`) === null,
    'E. un préfixe de contrôle doit compiler — la fermeture ne touche pas les préfixes.');
  void mot;
}

if (e.length) {
  console.error(`[mot déclaré] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error('  ✗ ' + x);
  process.exit(1);
}
console.log(`[mot déclaré] ${p} PASS / 0 FAIL — ${DIVERGENTS.length} couple(s) divergent(s) `
  + `(${DIVERGENTS.map(([f, m]) => `${f}→${m}`).join(' ')}), ${IDENTIQUES.length} librairie(s) non `
  + `divergente(s) épargnée(s), la borne et les quatre autres places comprises`);
