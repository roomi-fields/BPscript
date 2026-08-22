#!/usr/bin/env node
// ⛔ MIGRE LE 2026-08-22 : une librairie s invoque par le mot qu elle DECLARE, jamais par le nom
// de son fichier (decision de Romain du 2026-08-17, frappee ce jour).
/**
 * GARDE — UNE FORME SUPPRIMÉE PAR DÉCISION NE REVIENT PAS PAR LA PORTE D'UNE LIBRAIRIE.
 *
 * ⚠️ CE QUI A COÛTÉ CE GARDE, ET C'EST DE MOI. `duration` a été supprimée du langage le 2026-08-04
 * (`hub/decisions/2026-08-04-la-duree-de-scene-est-supprimee.md`, Romain : « on supprime
 * duration »). Le 2026-08-10, en créant `lib/engine.json`, j'y ai recopié les clés que la référence
 * d'Atlas attribue à cette librairie — SANS confronter chacune aux décisions datées. `duration` est
 * repassée dedans, et `@engine.duration:16`, REFUSÉ au 4 août, est redevenu acceptable.
 *
 * LA SUPPRESSION A DONC RECULÉ pendant que tout le monde la croyait acquise, par un geste qui
 * n'avait rien à voir avec elle. Personne ne l'a vu : aucun garde ne regardait cette porte, et la
 * donnée neuve avait l'air d'une mise en conformité.
 *
 * ⚠️ ET C'EST LA DONNÉE QUI A PARLÉ QUAND ON M'A INTERROGÉ : j'ai répondu « déclarée dans
 * engine.schema, donc pas d'écart » en lisant mon propre fichier caduc. Une donnée fausse ne se
 * contente pas de laisser passer une forme morte — elle RÉPOND À SA PLACE quand on mesure.
 *
 * CE QUE CE GARDE TIENT : chaque forme retirée par une décision datée, éprouvée dans TOUTES ses
 * graphies — nue, préfixée par sa librairie, et dans le flux. Une seule graphie gardée laisserait
 * les autres rentrer, et c'est exactement par la graphie PRÉFIXÉE que `duration` est revenue.
 */
import { LIBS } from '../src/transpiler/libs-data.js';
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const SOCLE = 'core\nalphabet.western\n';
const err = (src) => {
  try { return (compileToBPxAST(SOCLE + src).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};

// LES FORMES SUPPRIMÉES, chacune avec sa décision datée. Une ligne s'ajoute ici le jour où une
// forme sort du langage — c'est le prix d'une suppression, et il est d'une ligne.
const SUPPRIMEES = [
  { mot: 'duration', valeur: '16', decision: '2026-08-04 — la durée de scène est supprimée',
    // `duration` est DÉCRITE par la bible comme un champ de prototype de terminal (889, 1017,
    // 1025) — un autre objet que la directive. Aucune librairie ne l'écrit : le volet de fin le
    // mesure et le dit.
    survit: 'le champ `duration` du prototype de terminal, décrit par LANGUAGE.md:1025' },
  { mot: 'mm', valeur: '60', decision: '2026-06-26, appliqué le 2026-08-18 — un seul nom, `tempo`',
    refusGenerique: true },
  { mot: 'scene', valeur: '120', decision: 'la hiérarchie de scènes est supprimée' },
  { mot: 'mine', valeur: '1', decision: '2026-08-19 — Romain : « SI, mine SORT ! Maintenant ! »',
    refusGenerique: true,
    // ⛔ SA FORME VIVE ÉTAIT COMPOSÉE — `mine.<chemin-fichier>.<entrée>` — donc les trois graphies
    // du socle ne suffisent pas : elles n'auraient jamais atteint la branche qui le lisait. Le
    // volet dédié ci-dessous éprouve la forme qu'il portait réellement.
    composee: 'ragas.mes-svaras.sa' },
];

console.log(`[forme supprimée] ${SUPPRIMEES.length} forme(s) x 3 graphies`);

for (const f of SUPPRIMEES) {
  // 1. LA FORME NUE
  ok(err(`${f.mot}:${f.valeur}\n-----\nS -> C4`).length >= 1,
    `'${f.mot}:${f.valeur}' doit être REFUSÉ — supprimé (${f.decision})`);

  // 2. LA FORME PRÉFIXÉE PAR UNE LIBRAIRIE — c'est PAR ELLE que `duration` est revenue.
  //    Le préfixe se rabat sur le nom nu : si une librairie déclare le mot, la forme préfixée le
  //    ressuscite sans que la forme nue ne bouge. Une seule graphie gardée ne garde rien.
  for (const lib of ['engine', 'core', 'midi', 'transpo']) {
    ok(err(`${lib}.${f.mot}:${f.valeur}\n-----\nS -> C4`).length >= 1,
      `'${lib}.${f.mot}:${f.valeur}' doit être REFUSÉ — une librairie ne rouvre pas une forme `
      + `supprimée (${f.decision})`);
  }

  // 3. LA FORME NUE SANS VALEUR — l'autre moitié, celle qui a régressé une fois déjà.
  ok(err(`${f.mot}\n-----\nS -> C4`).length >= 1,
    `'${f.mot}' seul doit être REFUSÉ — supprimé (${f.decision})`);

  // 4. ET POUR CELLES QUI SORTENT SANS PIERRE TOMBALE, LE REFUS EST CELUI D'UN MOT INVENTÉ, mot
  //    pour mot. Règle de `hub/decisions/2026-08-15-un-type-se-declare-en-librairie-object-def-var-init.md`
  //    — « un mot inconnu est refusé comme un mot inventé ». Sans cette comparaison, un refus
  //    NOMMÉ survivant quelque part ferait vivre le mot à moitié : refusé en surface, encore connu
  //    du compilateur, et rien ne le dirait.
  //    ⚠️ ELLE NE VAUT PAS POUR TOUTES. Les sept mots partis AVANT cette décision (`scene`,
  //    `transport`, `library`, `in`, `macro`, `flag`, et `duration`) gardent un refus nommé ; leur
  //    sort se tranche ensemble, chez Romain. Exiger le refus générique d'eux figerait une
  //    décision qui n'est pas prise.
  if (f.refusGenerique) {
    const nu = (m) => (err(`${m}:${f.valeur}\n-----\nS -> C4`)[0] || '')
      .replace(new RegExp(m, 'g'), '<mot>').replace(/at line \d+:\d+/, '').trim();
    ok(nu(f.mot) === nu('zorglubinvente'),
      `le refus de '${f.mot}' doit être celui d'un mot INVENTÉ, mot pour mot — reçu `
      + `'${nu(f.mot)}' contre '${nu('zorglubinvente')}'`);
  }
}

// ── LA FORME COMPOSÉE — celle que le mot portait réellement ──────────────────────────────────
// ⛔ UN MOT DONT LA GRAPHIE EST COMPOSÉE NE SE GARDE PAS PAR SA FORME NUE. `mine` ne s'écrivait
// jamais seul : il préfixait un chemin de fichier personnel. Les trois graphies du socle
// n'atteignaient donc pas la branche qui le lisait, et le garde aurait été vert sans rien mesurer.
//
// ⚠️ ET SON REFUS DOIT ÊTRE CELUI D'UN MOT INVENTÉ, mot pour mot : la décision du 2026-08-19 dit
// « pas de message dédié, pas de renvoi, pas de trace dans le code ». Un refus qui le nommerait
// encore le ferait vivre à moitié — refusé en surface, connu du compilateur.
for (const f of SUPPRIMEES.filter((x) => x.composee)) {
  const nu = (m) => (err(`${m}.${f.composee}\n-----\nS -> C4`)[0] || '')
    .replace(new RegExp(m, 'g'), '<mot>').replace(/at line \d+:\d+/, '').trim();
  ok(err(`${f.mot}.${f.composee}\n-----\nS -> C4`).length >= 1,
    `'${f.mot}.${f.composee}' doit être REFUSÉ — supprimé (${f.decision})`);
  ok(nu(f.mot) === nu('zorglubinvente'),
    `le refus de '${f.mot}.<chemin>' doit être celui d'un mot INVENTÉ, mot pour mot — reçu `
    + `'${nu(f.mot)}' contre '${nu('zorglubinvente')}'`);
}

// ── LE TÉMOIN DE LA PROVENANCE A TENU SA PROMESSE, ET IL EST SORTI AVEC ELLE ────────────────
// ⚠️ IL DISAIT, MOT POUR MOT : « le jour où `factory` sort, il rougit et sort avec lui ». Ce jour
// est le 2026-08-20 : le préfixe est retiré, et le mot est inscrit au registre des mots sortis
// avec sa date. Le témoin a fait exactement ce pour quoi il était écrit — figer un écart qu'une
// consigne ne couvrait pas encore, et se retirer quand elle l'a couvert.
//
// ⛔ ET CE QUI L'A FAIT SORTIR N'EST PAS SA FORME, C'EST SA RAISON : le préfixe CONTOURNAIT la
// résolution. Mesuré avant le retrait — `temperament.nexistepas` est REFUSÉ, et
// `factory.temperament.nexistepas` était ACCEPTÉ et voyageait jusqu'à l'aval. Une seconde porte
// qui ne vérifie rien n'est pas un sucre.
//
// La forme vivante qui reste est l'invocation DIRECTE : même canal, et elle EXIGE que la
// librairie existe.
ok(err('temperament.12TET\n-----\nS -> C4').length === 0,
  "TÉMOIN — l'invocation DIRECTE d'une entrée de catalogue compile ; c'est la forme qui reste.");

// ── LA MOITIÉ « DOIT PASSER » — sans elle, une règle qui refuserait tout aurait l'air juste ───
{
  ok(err('tempo:120\n-----\nS -> C4').length === 0, "TÉMOIN — `tempo:120` PASSE : c'est le remplaçant de `mm`");
  ok(err('seed:42\n-----\nS -> C4').length === 0, 'TÉMOIN — `seed:42` PASSE : une directive vivante');
  ok(err('engine.seed:42\n-----\nS -> C4').length === 0,
    'TÉMOIN — `engine.seed:42` PASSE : le préfixe par la librairie reste ouvert aux formes VIVANTES');
}

// ── ET LE MOT QUI SURVIT AILLEURS ─────────────────────────────────────────────────────────────
// ⛔ CE VOLET MESURAIT UNE FORME QUI N EXISTE NULLE PART. Il compilait `def cloche note duration:2`
// et exigeait que le refus ne nomme pas `duration` — mais cette ligne n'a jamais été une graphie :
// ni `note` ni `duration` ne sont des terminaux, et le refus les nommait TOUS LES DEUX, à juste
// titre. Une assertion qui interdit un MOT dans un message interdit aussi les refus légitimes qui
// le nomment.
//
// CE QUI SE MESURE VRAIMENT, et c'est la question que ce fichier pose : une forme supprimée peut-
// elle revenir PAR LA DONNÉE ? Pour `duration`, la réponse se lit dans le bundle, pas dans une
// scène — et elle est nette.
//
// ⚠️ ÉCART SIGNALÉ, NON COMBLÉ : `LANGUAGE.md` décrit `duration` comme un champ de PROTOTYPE DE
// TERMINAL (lignes 889, 1017, 1025) ; AUCUNE librairie n'écrit ce champ aujourd'hui. La bible
// décrit une forme que la donnée ne porte pas encore. Remonté à l'architecte le 2026-08-19 ; ce
// garde le CONSTATE plutôt que de le taire, et il rougira le jour où la donnée l'écrira — ce sera
// alors le moment de rouvrir la question, avec la forme sous les yeux.
{
  const champs = [];
  const marche = (o, chemin) => {
    if (!o || typeof o !== 'object') return;
    if (!Array.isArray(o) && Object.prototype.hasOwnProperty.call(o, 'duration')) champs.push(chemin);
    for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') marche(v, `${chemin}.${k}`);
  };
  for (const [nom, lib] of Object.entries(LIBS)) marche(lib, nom);
  ok(champs.length === 0,
    `la directive 'duration' ne doit revenir par AUCUNE librairie — ${champs.length} entrée(s) `
    + `portent le champ : ${champs.slice(0, 4).join(', ')}. Si c'est un prototype de terminal `
    + `légitime, la question se rouvre avec la forme sous les yeux ; en attendant, c'est la porte `
    + `par laquelle une forme supprimée rentre.`);
}

if (echecs.length) {
  console.error(`[forme supprimée] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[forme supprimée] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
