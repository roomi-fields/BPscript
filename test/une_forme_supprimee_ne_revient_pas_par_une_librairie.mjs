#!/usr/bin/env node
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
    // `duration` survit comme CHAMP d'un prototype de terminal : c'est un autre objet, et le
    // garde ne doit pas le confondre avec la directive.
    survit: 'le champ `duration` du prototype de terminal (LANGUAGE.md:943)' },
  { mot: 'mm', valeur: '60', decision: '2026-06-26, appliqué le 2026-08-18 — un seul nom, `tempo`',
    refusGenerique: true },
  { mot: 'scene', valeur: '120', decision: 'la hiérarchie de scènes est supprimée' },
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

// ── LA MOITIÉ « DOIT PASSER » — sans elle, une règle qui refuserait tout aurait l'air juste ───
{
  ok(err('tempo:120\n-----\nS -> C4').length === 0, "TÉMOIN — `tempo:120` PASSE : c'est le remplaçant de `mm`");
  ok(err('seed:42\n-----\nS -> C4').length === 0, 'TÉMOIN — `seed:42` PASSE : une directive vivante');
  ok(err('engine.seed:42\n-----\nS -> C4').length === 0,
    'TÉMOIN — `engine.seed:42` PASSE : le préfixe par la librairie reste ouvert aux formes VIVANTES');
}

// ── ET LE MOT QUI SURVIT AILLEURS N'EST PAS CONFONDU ─────────────────────────────────────────
// `duration` reste un CHAMP de prototype de terminal. Une suppression porte sur une GRAPHIE, pas
// sur un mot : confondre les deux ferait retirer ce qui vit encore.
{
  const r = compileToBPxAST(`${SOCLE}def cloche note duration:2\n-----\nS -> cloche`);
  const msg = (r.errors || []).map((e) => e.message).join(' | ');
  ok(!/'duration'/.test(msg),
    `le champ 'duration' d'un terminal n'est pas la directive supprimée — il ne doit pas être `
    + `accusé à sa place (reçu : ${msg.slice(0, 120)})`);
}

if (echecs.length) {
  console.error(`[forme supprimée] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[forme supprimée] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
