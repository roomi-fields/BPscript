#!/usr/bin/env node
/**
 * GARDE — UN MOT DU LANGAGE SUIVI D'UN POINT QU'IL N'ADMET PAS EST REFUSÉ, AVEC SA RÉÉCRITURE.
 *
 * ⛔ LE TROU QU'IL FERME, ET IL ÉTAIT MUET. Un juge de la résolution portait une EXEMPTION AVEUGLE :
 * il épargnait le MOT du langage sans juger la SOUS-CLÉ. Mesuré le 2026-09-03, mot par mot sur les
 * neuf : `seed.zzz` ne rendait AUCUNE erreur, et `init.zzz` rendait `init: []` — la ligne était lue,
 * avalée, absente de l'arbre. Les sept autres étaient rattrapés par leur propre lecteur, ce qui
 * MASQUAIT le trou : un relevé sur un seul mot aurait conclu que le langage refusait.
 *
 * ⚠️ ET IL S'EST OUVERT EN RÉPARANT AUTRE CHOSE. Le refus d'avant existait, mais accusait le mauvais
 * fait : `seed.x` recevait « aucune librairie ne sert l'axe seed », le refus d'un mot INVENTÉ pour un
 * mot du langage. La dissolution du schéma de `core` (2026-09-03) a retiré ce refus, et le mauvais
 * message est devenu un SILENCE — pire, parce qu'un message faux se corrige et qu'un silence ne se
 * voit pas. Un item du backlog demandait « un juge pour ce cas » : le voici.
 *
 * LA MATRICE — les NEUF mots de la grammaire, lus dans la donnée (jamais listés ici) × le point :
 *   1. chacun, suivi d'un point qu'il n'admet pas, est REFUSÉ ;
 *   2. le refus PORTE LA RÉÉCRITURE quand la donnée la déclare (`grammarWords.syntaxe`) ;
 *   3. le COMPLÉMENT : les formes légitimes passent — `out.<canal>` et `in.<canal> <rôle>` portent
 *      une sous-clé par construction, `core` est une famille dont l'entrée se juge, et les formes
 *      nues ou à valeur (`init`, `seed:42`, `mode:ord`) ne sont pas touchées.
 *
 * INJECTION dans l'ACCUSÉ (l'exemption remise) et dans le JUGE.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { motsDeLaGrammaire, formeDuMot, clesDActeur } from '../src/transpiler/index-des-objets.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const TETE = 'core\nalphabet.simple\n';
const erreurs = (ligne) => {
  try { return (compileToBPxAST(`${TETE}${ligne}\n-----\nS -> a\n`).errors || []).map((e) => String(e.message)); }
  catch (e) { return [String(e.message)]; }
};

// ── 0. SOCLE — la liste vient de la donnée, et elle n'est pas vide ─────────────────────────────
const MOTS = [...motsDeLaGrammaire()].sort();
ok(MOTS.length >= 8, `0. SOCLE : ${MOTS.length} mot(s) de grammaire lus dans la donnée — un balayage qui rend zéro mesure sa propre recherche`);

// ── 1. CHACUN, SUIVI D'UN POINT, EST REFUSÉ ────────────────────────────────────────────────────
for (const mot of MOTS) {
  const e = erreurs(`${mot}.zzz`);
  ok(e.length > 0,
     `1. '${mot}.zzz' doit être REFUSÉ — une ligne qu'aucune donnée ne sert est lue, écrite dans `
     + `l'arbre (ou avalée), et sans effet. C'est le silence que ce garde ferme.`);
}

// ── 2. LE REFUS PORTE SA RÉÉCRITURE, pour les mots dont la donnée la déclare ───────────────────
// Les mots rattrapés par leur propre lecteur gardent leur message, qui dit déjà la forme ; ce volet
// tient ceux que le juge neuf refuse, et il exige que la donnée porte la réécriture.
for (const mot of MOTS) {
  const forme = formeDuMot(mot);
  ok(typeof forme === 'string' && forme.includes(mot),
     `2. la donnée doit déclarer la forme de '${mot}' (grammarWords.syntaxe) — reçu ${JSON.stringify(forme)}`);
  const e = erreurs(`${mot}.zzz`).join(' | ');
  // Un mot dont la forme ADMET le point (`out.<canal>`, `in.<canal> …`) est jugé sur sa SOUS-CLÉ :
  // son refus nomme ce qui n'existe pas, et c'est le bon message. Les autres nomment le mot.
  const admetLePoint = typeof forme === 'string' && forme.includes(`${mot}.`);
  ok(admetLePoint ? /zzz/.test(e) : new RegExp(`'${mot}`).test(e),
     `2. le refus de '${mot}.zzz' doit nommer ${admetLePoint ? 'la SOUS-CLÉ inexistante' : 'le MOT en cause'} — reçu ${e.slice(0, 110)}`);
}

// ── 3. LE COMPLÉMENT — les formes légitimes passent ───────────────────────────────────────────
// Sans ce volet, refuser TOUT mot du langage suivi d'un point rendrait le garde vert en décrivant
// un langage plus étroit que le vrai : `out.midi` est la sortie de l'acteur implicite.
for (const [quoi, ligne] of [
  ["la sortie de l'acteur implicite", 'out.midi'],
  ['une entrée nommée',              'in.midi pedale'],
  ['la graine, à valeur',            'seed:42'],
  ['le mot nu',                      'init'],
  ['le mode, à valeur',              'mode:ord'],
  ["l'invocation d'un alphabet",     'alphabet.western'],
]) {
  const e = erreurs(ligne);
  ok(e.length === 0, `3. '${ligne}' (${quoi}) doit PASSER — reçu ${JSON.stringify(e).slice(0, 130)}`);
}
// Et ce qui échappe au juge se lit dans la DONNÉE, jamais dans une liste tenue ici.
ok(clesDActeur().has('out'),
   `3. 'out' doit être une clé d'acteur dans la donnée — c'est ce qui lui vaut de porter une sous-clé`);

// ── 4. INJECTION DANS LE JUGE — la décision rejouée isolée ────────────────────────────────────
const juger = (mot, sousCle, motsDuLangage, clesActeur) =>
  Boolean(sousCle) && motsDuLangage.has(mot) && !clesActeur.has(mot);
const lang = new Set(['seed', 'init', 'out']);
const cles = new Set(['out']);
ok(juger('seed', 'zzz', lang, cles), '4. (mord) un mot du langage avec une sous-clé est refusé');
ok(!juger('out', 'midi', lang, cles), "4. (se tait) une clé d'acteur porte sa sous-clé");
ok(!juger('seed', null, lang, cles), '4. (se tait) le mot nu passe');
ok(!juger('alphabet', 'western', lang, cles), "4. (se tait) un mot qui n'est pas du langage passe");

ok(passe >= 25, `SOCLE : ${passe} vérifications — la matrice s'est vidée`);
if (echecs.length) {
  console.error(`[mot du langage + point] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[mot du langage + point] ${passe} PASS / 0 FAIL — ${MOTS.length} mots, ${passe} assertion(s)`);
