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
  ['l\'ALPHABET nomme la voix (tabla)',
   '@core\n@alphabet.tabla\nS -> dha ka\n',            [['dha', 'bayan_open'], ['ka', 'bayan_muted']]],
  ['le TERMINAL la nomme lui-même',
   '@core\n@alphabet.western\n@def ka  voice.sec\nS -> ka\n', [['ka', 'sec']]],
  ['personne ne la nomme : elle reste ABSENTE',
   '@core\n@alphabet.western\nS -> C4\n',              [['C4', null]]],
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

// ── B. LE PLUS LOCAL GAGNE — et sans ce volet, on ne saurait pas lequel ──────────────────────
// ⚠️ `dha` porte une voix DANS l'alphabet tabla. Un `@def` qui le renomme doit l'emporter :
// c'est le principe d'override que Romain nomme explicitement. Sans ce cas, une cascade qui
// prendrait TOUJOURS l'alphabet passerait le volet A en entier.
{
  const r = compiler('@core\n@alphabet.tabla\n@def dha  voice.dayan_tap\nS -> dha ka\n');
  ok(messages(r) === '', `B. le terminal redéclaré est REFUSÉ : ${messages(r).slice(0, 80)}`);
  if (!messages(r)) {
    ok(JSON.stringify(voix(r)) === JSON.stringify([['dha', 'dayan_tap'], ['ka', 'bayan_muted']]),
       `B. le plus local doit GAGNER : 'dha' redéclaré par @def doit porter 'dayan_tap' et 'ka' `
       + `garder celle de l'alphabet. Reçu : ${JSON.stringify(voix(r))}. Une cascade qui ne `
       + `distingue pas ses étages n'est pas une cascade, c'est une valeur unique.`);
  }
}

// ── C. LA DONNÉE EST VRAIMENT LÀ — socle contre le faux vert ─────────────────────────────────
// ⚠️ Si les alphabets perdaient leur table de voix, les volets A et B passeraient au vert en ne
// mesurant plus rien : `null` partout serait « conforme » à une donnée vide.
{
  const avecVoix = Object.entries(LIBS.alphabets || {})
    .filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object' && v.voices);
  ok(avecVoix.length >= 2,
     `C-SOCLE : ${avecVoix.length} alphabet(s) déclarent une table de voix, 2 au moins attendus `
     + `(tabla, tryCsoundObjects). Sous ce seuil ce garde ne mesure plus la cascade, il mesure `
     + `une donnée absente — et il serait vert.`);
  const tabla = LIBS.alphabets?.tabla?.voices || {};
  ok(tabla.dha === 'bayan_open',
     `C-SOCLE : la table de tabla doit toujours associer 'dha' à 'bayan_open' — reçu `
     + `${JSON.stringify(tabla.dha)}. Le volet A repose sur cette valeur exacte.`);
}

// ── D. CE QUI RESTE À FAIRE, ÉCRIT PLUTÔT QUE TU ──────────────────────────────────────────────
// ⚠️ Romain demande la voix dans TOUS les alphabets. Ils sont 17 et DEUX seulement la portent.
// Donner une voix aux quinze autres est une question de SENS musical — quel son joue un `C4` de
// l'alphabet occidental ? — et je n'ai aucun outil qui y réponde. Ce compte n'est donc PAS une
// assertion qui échoue : c'est un COMPTEUR qui rend l'écart visible à chaque passage, pour qu'il
// ne s'oublie pas. Le jour où les quinze sont renseignés, cette ligne le dira.
{
  const tous = Object.entries(LIBS.alphabets || {})
    .filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object' && Array.isArray(v.notes));
  const avec = tous.filter(([, v]) => v.voices);
  console.log(`   ⏳ voix par alphabet : ${avec.length}/${tous.length} renseignés — `
            + `${tous.length - avec.length} attendent une décision de sens (quel son joue leurs `
            + `terminaux). Compteur, pas échec.`);
}

if (echecs.length) {
  console.error(`❌ la voix d'un terminal : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ la voix d'un terminal arrive dans l'arbre — cascade terminal puis alphabet, le plus `
          + `local gagne, l'absence reste une absence. ${passe} vérification(s) passée(s).`);
