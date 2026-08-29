#!/usr/bin/env node
/**
 * LA VOIX D'UN TERMINAL ARRIVE JUSQU'À L'ARBRE — le terminal d'abord, son alphabet ensuite.
 *
 * ⛔ ACTE DE ROMAIN, 2026-08-08 : « tout est dans les PROPRIÉTÉS DU TERMINAL — ou pas, et c'est
 * alors résolu par les principes d'override. Et `@def`/`voice` doit AUSSI être correctement
 * implémenté dans TOUS LES ALPHABETS. »
 * Suite directe de la décision du 2026-08-01 — « un alphabet est une collection structurée de
 * terminaux » — qui avait sorti `voice` des clés d'acteur pour cette raison exacte : ce n'est pas
 * l'acteur qui dit ce qu'un terminal EST, c'est le terminal, et l'alphabet qui les organise.
 *
 * ⚠️ CE QUE CE CHEMIN DÉBLOQUE : un agent entier, arrêté quatre heures. Kairos assurait le DISPATCH
 * DU SON — quelle voix joue quel symbole — en lisant la table des macros. `@macro` sort du langage,
 * la table n'existe plus, et il n'avait rien à la place. La réponse était déjà écrite dans la
 * spécification (§« Déclarer un terminal ») ; c'est l'implémentation qui manquait.
 *
 * ⚠️ DEUX ALPHABETS DÉCLARAIENT DÉJÀ LEURS VOIX EN DONNÉE — `tabla` associe `dha` à `bayan_open`,
 * `tryCsoundObjects` ses sept objets — et rien ne les lisait DANS CE DÉPÔT.
 *
 * ⛔ J'AVAIS ÉCRIT « CETTE TABLE N'EST LUE PAR PERSONNE ». C'ÉTAIT FAUX, et Kairos me l'a rendu
 * avec sa mesure : il la lit depuis JUIN (`resoudre-voix.ts:121`), et il en a un témoin
 * bout-en-bout. J'avais mesuré MON dépôt et conclu pour LE SIEN — la faute que je remonte aux
 * autres, commise deux fois dans la même journée. Ce qui était vrai, et seulement cela : rien ne
 * la lisait chez moi.
 * ⚠️ La leçon n'est pas « vérifier chez le voisin » : c'est qu'une affirmation dont la portée
 * dépasse ce qu'on a mesuré entre dans le dossier des autres comme une mesure. La mienne était
 * dans un message ET dans un commit.
 *
 * ⚠️ ET UN TÉMOIN MANQUE, KAIROS L'A MESURÉ POUR MOI : sur ses 204 scènes, la forme à convention
 * (`signal`, `pitch`, `phase`, `logic`) n'est exercée par AUCUNE. Zéro sur 204. Ce garde est donc
 * le seul témoin de ce chemin — « la forme existe » et « la forme est exercée » sont deux choses,
 * et c'est la seconde qui attrape les défauts.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compiler = (src) => {
  try { return compileToBPxAST(src); } catch (e) { return { errors: [{ message: e.message }] }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message ?? e).join(' | ');
/** La voix portée par chaque élément sonnant du premier membre droit. */
const voix = (r) => (r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [])
  .filter((n) => n.payload?.nature === 'sounding')
  .map((n) => [n.name, n.payload.voice ?? null]);

// ── A. LA CASCADE, DU PLUS LOCAL AU PLUS GÉNÉRAL ─────────────────────────────────────────────
const CAS = [
  ['le TERMINAL la nomme lui-même : je la PORTE',
   'core\nalphabet.western\ndef ka  voice.bayan_muted\n-----\nS -> ka\n', [['ka', 'bayan_muted']]],
  ['deux terminaux nommés',
   'core\nalphabet.western\ndef ka  voice.bayan_muted\ndef ko  voice.bayan_open\n-----\nS -> ka ko\n',
   [['ka', 'bayan_muted'], ['ko', 'bayan_open']]],
  ['personne ne la nomme : elle reste ABSENTE',
   'core\nalphabet.western\n-----\nS -> C4\n',              [['C4', null]]],
  // ⛔ LA TABLE DE L'ALPHABET N'EST PAS RÉSOLUE ICI — Romain, 2026-08-08 : « c'est Kairos, ça
  // n'est pas ton rôle. » Je l'avais fait, et c'était résoudre à la place de l'aval, qui le fait
  // depuis juin depuis la même table. Ce cas garde la frontière DANS L'AUTRE SENS : si un jour je
  // me remets à résoudre, il rougit.
  ['la table de l\'alphabet reste À RÉSOUDRE en aval',
   'core\nalphabet.tabla\n-----\nS -> dha ka\n',            [['dha', null], ['ka', null]]],
];
for (const [quoi, src, attendu] of CAS) {
  const r = compiler(src);
  ok(messages(r) === '', `A. ${quoi} — REFUSÉ : ${messages(r).slice(0, 80)}`);
  if (messages(r)) continue;
  ok(JSON.stringify(voix(r)) === JSON.stringify(attendu),
     `A. ${quoi} — attendu ${JSON.stringify(attendu)}, reçu ${JSON.stringify(voix(r))}. `
     + `La voix est ce par quoi l'aval décide QUEL SON joue le symbole : si elle n'arrive pas, `
     + `le dispatch se fait sur rien.`);
}

// ── B. LA FRONTIÈRE — je PORTE ce qui est écrit, je ne RÉSOUS pas ce qui est organisé ───────
// ⚠️ CE VOLET A CHANGÉ DE SUJET LE 2026-08-08, et c'est la leçon. Il vérifiait une PRÉCÉDENCE
// entre le `def` et la table de l'alphabet — donc il gardait une résolution que je n'aurais pas
// dû écrire. Kairos a mesuré que nous étions DEUX à résoudre le même fait depuis la même table,
// avec des précédences différentes ; Romain a tranché que c'est son rôle.
// Ce que ce volet garde désormais est la FRONTIÈRE : une voix ÉCRITE dans la scène est portée
// telle quelle, une voix ORGANISÉE par un alphabet ne l'est pas. « Porter ≠ résoudre » — la règle
// que j'oppose aux autres, et que j'avais franchie sans m'en apercevoir.
{
  const r = compiler('core\nalphabet.tabla\ndef dha  voice.dayan_tap\n-----\nS -> dha ka\n');
  ok(messages(r) === '', `B. le terminal redéclaré est REFUSÉ : ${messages(r).slice(0, 80)}`);
  if (!messages(r)) {
    ok(JSON.stringify(voix(r)) === JSON.stringify([['dha', 'dayan_tap'], ['ka', null]]),
       `B. 'dha' est ÉCRIT par un @def : je le porte. 'ka' n'est nommé que par la table de son `
       + `alphabet : je ne le résous pas, l'aval le fait. Reçu : ${JSON.stringify(voix(r))}. `
       + `Si 'ka' porte une voix ici, c'est que je me suis remis à résoudre à la place d'un autre.`);
  }
}

// ── C. LA DONNÉE EST VRAIMENT LÀ — socle contre le faux vert ─────────────────────────────────
// ⚠️ FORMAT REFORMATÉ le 2026-08-08 : la table `voices`, qui associait APRÈS COUP un terminal à
// une voix, a disparu. La voix est désormais une CLÉ DU TERMINAL — « un terminal est une chose
// entière », et c'est exactement ce que cette table contournait en le redécoupant par axes.
// Ce socle lit donc les terminaux, pas une table parallèle. Il garde la même chose : si la donnée
// perdait ses voix, les volets au-dessus passeraient au vert en ne mesurant plus rien.
{
  const voixDe = (alpha) => Object.entries(LIBS.alphabets?.[alpha]?.terminals || {})
    .filter(([, t]) => t && t.voice);
  const tabla = voixDe('tabla');
  // ⚠️ CE SOCLE ÉTAIT UN NOMBRE EN DUR, ET IL S'EST PÉRIMÉ AU PREMIER CHANGEMENT DE DONNÉE. Il
  // exigeait dix terminaux à voix ; l'alphabet est passé aux bols ATOMIQUES le 2026-08-17 — les
  // composés se segmentent au lieu de se déclarer — et il en reste neuf. Le garde rougissait sur
  // un geste juste, ce qui est la définition d'un seuil mal choisi.
  // Il compte désormais les VOIX EMPLOYÉES, pas les terminaux : chaque voix de tabla doit être
  // portée par au moins un bol. La donnée fixe elle-même le seuil, donc retirer un bol ne le fait
  // pas rougir tandis que perdre une voix entière le fait — ce qu'il existe pour attraper.
  const voixEmployees = new Set(tabla.map(([, t]) => t.voice));
  ok(voixEmployees.size >= 4,
     `C-SOCLE : ${voixEmployees.size} voix distinctes employées par les bols de tabla `
     + `(${[...voixEmployees].join(', ')}), 4 au moins attendues. Sous ce seuil, la donnée a perdu `
     + `une famille de frappes entière et les volets au-dessus ne mesureraient plus rien.`);
  const dha = LIBS.alphabets?.tabla?.terminals?.dha?.voice;
  ok(dha === 'bayan_open',
     `C-SOCLE : le terminal 'dha' de tabla doit porter la voix 'bayan_open' — reçu `
     + `${JSON.stringify(dha)}.`);
  const csound = voixDe('tryCsoundObjects');
  ok(csound.length >= 7,
     `C-SOCLE : ${csound.length} terminal(aux) de tryCsoundObjects portent une voix, 7 attendus.`);
}

// ── D. CE QUE LA DONNÉE PORTE, POUR MÉMOIRE ─────────────────────────────────────────────────
{
  const tous = Object.entries(LIBS.alphabets || {})
    .filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object' && v.terminals);
  const avec = tous.filter(([, v]) => Object.values(v.terminals).some((t) => t && t.voice));
  console.log(`   ℹ️ alphabets dont au moins un terminal porte une voix : ${avec.length}/${tous.length}. `
            + `Résolues par l'aval, pas ici.`);
}

if (echecs.length) {
  console.error(`❌ la voix d'un terminal : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ la voix d'un terminal arrive dans l'arbre — cascade terminal puis alphabet, le plus `
          + `local gagne, l'absence reste une absence. ${passe} vérification(s) passée(s).`);
