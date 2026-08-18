#!/usr/bin/env node
/**
 * GARDE — un GESTE se dit par DEUX MOTS POSITIFS, et l'environnement en choisit UN.
 *
 * LA FORME, tranchée par Romain le 2026-08-15. Quatre gestes de fin et de relance, huit mots,
 * jamais un nom et sa négation :
 *     resetnotes / letring              fin de scène
 *     resetcontrols / keepcontrols      fin des contrôleurs
 *     strikeagain / sustain             note rejouée
 *     pedalrelease / pedalhold          interrupteur rejoué
 *
 * LE CRITÈRE, ET IL A CORRIGÉ UNE PRÉMISSE FAUSSE. On avait d'abord réservé une paire aux seuls
 * gestes « vrais au moteur natif », et `resetcontrols` devait rester seul. Mesure de runtime-MIDI :
 * `resetnotes` est faux au natif LUI AUSSI. Le vrai critère est ailleurs — dès qu'un défaut est
 * CONFIGURABLE en direct par l'interface, une scène doit pouvoir dire le CONTRAIRE de ce qui est
 * configuré. Omettre le mot HÉRITE du réglage ; ça ne le nie pas.
 *
 * ⛔ CE QUE CE GARDE TIENT, ET QUE RIEN D'AUTRE NE TIENDRAIT. L'invariant n'est pas « les huit mots
 * existent » — c'est qu'EXACTEMENT UN mot par paire soit vrai dans l'environnement. Deux vrais, et
 * le runtime reçoit un ordre et son contraire ; zéro vrai, et le geste n'a pas d'état de départ,
 * ce qui se lit comme « désactivé » alors que le moteur, lui, en a un. Les deux fautes s'écrivent
 * en changeant UN caractère dans la librairie des défauts, et aucune ne se voit à la lecture.
 *
 * ⚠️ LE REFUS D'ÉCRITURE EST UNE AUTRE QUESTION, tenue séparément : écrire les DEUX mots d'une paire
 * dans une scène est refusé par le groupe d'unicité. Ce garde vérifie les deux — la DONNÉE au volet
 * 1, l'ÉCRITURE au volet 3 — parce qu'un mécanisme peut être juste d'un côté et muet de l'autre.
 *
 * INJECTION dans l'ACCUSÉ (une paire déséquilibrée) et dans le JUGE.
 */
import { createRequire } from 'node:module';
import { compileToBPxAST } from '../src/transpiler/index.js';

const require = createRequire(import.meta.url);
const { LIBS } = require('../src/transpiler/libs-data.js');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const erreursDe = (src) => {
  try { return compileToBPxAST(src).errors ?? []; } catch (e) { return [{ message: e.message }]; }
};

// ── 0. LES PAIRES SE LISENT DANS LA DONNÉE, jamais dans une liste tenue ici ──────────────────
// Le groupe d'unicité EST la paire : deux mots qui partagent un `unicite` sont les deux faces d'un
// même geste. Écrire les huit noms dans ce fichier ferait une seconde autorité, qui dériverait le
// jour où une cinquième paire naîtrait.
const parGroupe = {};
for (const [nomLib, lib] of Object.entries(LIBS)) {
  for (const section of ['controls', 'engine', 'subgrammar']) {
    for (const [nom, def] of Object.entries((lib && lib[section]) || {})) {
      if (nom.startsWith('_') || !def || typeof def !== 'object' || !def.unicite) continue;
      (parGroupe[def.unicite] = parGroupe[def.unicite] || []).push({ nom, nomLib });
    }
  }
}
const gestesMidi = Object.entries(parGroupe).filter(([, mots]) => mots.every((m) => m.nomLib === 'midi'));
ok(gestesMidi.length === 4,
   `0. SOCLE : quatre gestes MIDI attendus, ${gestesMidi.length} balayé(s) — un balayage qui rend `
   + `zéro ou trois mesure sa propre recherche. Vus : ${gestesMidi.map(([g]) => g).join(', ')}`);
for (const [groupe, mots] of gestesMidi) {
  ok(mots.length === 2,
     `0. le geste '${groupe}' doit se dire par DEUX mots — vus ${mots.length} `
     + `(${mots.map((m) => m.nom).join(', ')})`);
}

// ── 1. EXACTEMENT UN MOT PAR PAIRE EST VRAI DANS L'ENVIRONNEMENT ────────────────────────────
const defauts = (LIBS.midi_default && LIBS.midi_default.controlDefaults) || {};
ok(Object.keys(defauts).length >= 20,
   `1. SOCLE : la librairie des défauts doit porter au moins vingt valeurs — lues `
   + `${Object.keys(defauts).length}`);
for (const [groupe, mots] of gestesMidi) {
  const vrais = mots.filter((m) => defauts[m.nom] === true).map((m) => m.nom);
  const declares = mots.filter((m) => typeof defauts[m.nom] === 'boolean').map((m) => m.nom);
  ok(declares.length === 2,
     `1. les DEUX mots de '${groupe}' doivent porter une valeur booléenne dans l'environnement — `
     + `déclarés : ${declares.join(', ') || 'aucun'}. Un mot sans valeur n'a pas d'état de départ.`);
  ok(vrais.length === 1,
     `1. EXACTEMENT UN mot de '${groupe}' doit être vrai — vus ${vrais.length} `
     + `(${vrais.join(', ') || 'aucun'}). Deux vrais donnent au runtime un ordre et son contraire ; `
     + `zéro le laisse sans état de départ.`);
}

// ── 2. LA VALEUR ARRIVE AU CONSOMMATEUR, elle ne reste pas dans le fichier ───────────────────
// « Déclaré » n'est pas « publié » : le reversement sur la déclaration est ce que lit l'aval.
{
  const { describeVocabulary } = await import('../src/transpiler/libs.js');
  const vocab = describeVocabulary();
  for (const [, mots] of gestesMidi) {
    for (const { nom } of mots) {
      const c = vocab.controls.find((x) => x.name === nom);
      ok(c && c.default === defauts[nom],
         `2. '${nom}' doit ressortir du vocabulaire avec sa valeur d'environnement `
         + `(${defauts[nom]}) — vu ${c && c.default}`);
    }
  }
}

// ── 3. L'ÉCRITURE — les trois places, et les deux refus ─────────────────────────────────────
// Romain : « oui configurables aussi par acteurs, mais il faut que ces contrôles soient aussi
// activables dans la scène en !(...) ». Tête de scène et flux sont mesurés ici ; l'écriture par
// ACTEUR ne passe pas aujourd'hui et c'est signalé à part — une clé d'acteur est une liste fermée.
for (const [, mots] of gestesMidi) {
  const nom = mots[0].nom;
  ok(erreursDe(`core\nmidi.${nom}\n-----\nS -> C4\n`).length === 0,
     `3. 'midi.${nom}' en tête de scène doit compiler`);
  ok(erreursDe(`core\n-----\nS -> C4 !(${nom}) D4\n`).length === 0,
     `3. '!(${nom})' dans le flux doit compiler — Romain l'a demandé nommément`);
  // Le complément : un geste n'est PAS une propriété d'une note, et il n'a pas de forme nue.
  ok(erreursDe(`core\n-----\nS -> C4(${nom})\n`).length > 0,
     `3. 'C4(${nom})' doit être REFUSÉ — un geste ne se pose pas sur un élément`);
  ok(erreursDe(`core\n-----\nS -> C4 ${nom} D4\n`).length > 0,
     `3. la forme NUE de '${nom}' dans le flux doit être REFUSÉE — sans quoi une scène qui portait `
     + `déjà ce nom est tronquée en silence`);
}

// ── 4. LES DEUX MOTS D'UNE PAIRE NE S'ÉCRIVENT PAS ENSEMBLE ─────────────────────────────────
for (const [groupe, mots] of gestesMidi) {
  const msg = erreursDe(`core\nmidi.${mots[0].nom}\nmidi.${mots[1].nom}\n-----\nS -> C4\n`)
    .map((e) => String(e.message)).join(' | ');
  ok(new RegExp(groupe).test(msg) && msg.includes(mots[0].nom) && msg.includes(mots[1].nom),
     `4. écrire les DEUX mots de '${groupe}' doit être refusé en NOMMANT les deux — reçu : `
     + `${msg.slice(0, 130)}`);
}

// ── 5. INJECTION DANS LE JUGE — la décision rejouée isolée ──────────────────────────────────
// ⚠️ LA RÈGLE PORTE DEUX CONDITIONS, ET MA PREMIÈRE VERSION N'EN TENAIT QU'UNE. « Exactement un
// vrai » laisse passer une paire dont le second mot n'a AUCUNE valeur : un seul vrai, condition
// remplie, et pourtant le geste est à moitié déclaré. Le juge exige donc les deux valeurs ET un
// seul vrai — c'est l'injection qui l'a montré, pas la relecture.
const juger = (mots, valeurs) =>
  mots.every((m) => typeof valeurs[m] === 'boolean')
  && mots.filter((m) => valeurs[m] === true).length === 1;
ok(juger(['a', 'b'], { a: true, b: false }), '5. (se tait) un vrai, un faux');
ok(!juger(['a', 'b'], { a: true, b: true }), '5. (mord) deux vrais');
ok(!juger(['a', 'b'], { a: false, b: false }), '5. (mord) aucun vrai');
ok(!juger(['a', 'b'], { a: true }), '5. (mord) un mot sans valeur');

// Le compte des vérifications EXÉCUTÉES, hors ce bilan : un garde qui refuse d'avoir examiné zéro
// doit aussi refuser d'en avoir examiné la moitié parce qu'une boucle s'est vidée.
const TOTAL_ATTENDU = 1 + 4 + 1 + 8 + 8 + 16 + 4 + 4;
ok(passe + echecs.length === TOTAL_ATTENDU,
   `bilan : ${TOTAL_ATTENDU} vérifications attendues, ${passe + echecs.length} exécutées`);

if (echecs.length) {
  console.error(`❌ un geste se dit par deux mots positifs : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ un geste se dit par deux mots positifs — ${passe} vérification(s) passée(s), `
    + `${gestesMidi.length} gestes, ${gestesMidi.length * 2} mots`);
}
