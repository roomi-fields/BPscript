#!/usr/bin/env node
/**
 * GARDE — un POINT D'ATTENTE qualifie son adresse par des clés déclarées.
 *
 * LA FORME, tranchée par Romain le 2026-08-15 : `<! in.midi(note:60, channel:3)` — le point
 * d'attente nomme la source qu'il écoute par des paires `clé:valeur`, et une définition (`@def`)
 * en factorise l'écriture.
 *
 * CE QUI MANQUAIT. La structure `(clé:valeur, …)` était parsée et le mécanisme d'adresse complet ;
 * `channel` y était déclaré depuis toujours, `note` ne l'était nulle part. La forme entière tombait
 * donc sur « attribut '(note:…)' inconnu » — le langage savait, personne n'avait déclaré le mot.
 *
 * CE QUE CE GARDE TIENT, et c'est le point : les clés sont une DONNÉE (`lib/core.json`
 * schema.addressKeys). Retirer `note` de la donnée doit rendre la forme ratifiée impossible, et
 * c'est exactement ce que le volet 3 exige en le retirant EN MÉMOIRE.
 *
 * PORTÉE ET COMPLÉMENT. Le garde couvre les DEUX écritures (collée et espacée), les DEUX clés
 * seules, les deux formes déjà vivantes qu'il ne doit pas casser (nue, positionnelle), la forme
 * allégée par `@def` — et son complément : une COQUILLE doit rester refusée, sinon déclarer un mot
 * aurait ouvert la porte à tous.
 *
 * INJECTION dans l'ACCUSÉ (la clé retirée de la donnée) et dans le JUGE.
 */
import { createRequire } from 'node:module';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { describeVocabulary, registerLib, clearRegistry, registerAll } from '../src/transpiler/libs.js';

const require = createRequire(import.meta.url);
const { LIBS } = require('../src/transpiler/libs-data.js');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const erreursDe = (src) => {
  try { return compileToBPxAST(src).errors ?? []; } catch (e) { return [{ message: e.message }]; }
};
const refusDAttribut = (src) =>
  erreursDe(src).filter((e) => /attribut '\(.*?:…\)' inconnu/.test(String(e.message)));

// ─── 0. SOCLE — les clés d'adresse sont une donnée, et les deux mots y sont ──────────────────
clearRegistry();
registerAll(LIBS);
const cles = describeVocabulary().addressKeys || [];
for (const mot of ['note', 'channel']) {
  ok(cles.includes(mot),
     `0. SOCLE : '${mot}' doit être déclaré en clé d'adresse (lib/core.json schema.addressKeys) — `
     + `vues : ${cles.join(', ')}`);
}
ok(Object.keys(LIBS.core.schema._destinations || {}).includes('note'),
   "0. SOCLE : 'note' doit porter sa destination dans `_destinations` — la légende annonce couvrir "
   + 'CHAQUE mot des clés d\'adresse, et une entrée manquante la rend fausse en silence');

// ─── 1. LES FORMES RATIFIÉES COMPILENT ──────────────────────────────────────────────────────
const FORMES = [
  ['directe, signe collé',   '@core\nS -> C4 <!in.midi(note:60, channel:3)\n'],
  ['directe, signe espacé',  '@core\nS -> C4 <! in.midi(note:60, channel:3)\n'],
  ['la note seule',          '@core\nS -> C4 <! in.midi(note:60)\n'],
  ['le canal seul',          '@core\nS -> C4 <! in.midi(channel:3)\n'],
  ['allégée par @def',       '@core\n@def pedale(x) x <! in.midi(note:60, channel:3)\nS -> pedale(C4)\n'],
];
for (const [quoi, src] of FORMES) {
  const errs = erreursDe(src);
  ok(errs.length === 0,
     `1. ${quoi} doit compiler — refusée : ${errs.map((e) => e.message).join(' | ')}`);
}

// ─── 1bis. LES DEUX FORMES DÉJÀ VIVANTES NE BOUGENT PAS ─────────────────────────────────────
// Déclarer un mot ne doit rien retrancher : l'attente nue et l'adresse positionnelle compilaient
// avant ce geste, et une régression de leur côté serait muette.
for (const [quoi, src] of [
  ['l\'attente nue',            '@core\nS -> C4 <!in.midi\n'],
  ['l\'adresse positionnelle',  '@core\nS -> C4 <!in.midi.60\n'],
]) {
  ok(erreursDe(src).length === 0, `1bis. ${quoi} doit continuer de compiler`);
}

// ─── 2. LE COMPLÉMENT — une COQUILLE reste refusée ──────────────────────────────────────────
// Sans ce volet, déclarer `note` pourrait avoir ouvert la porte à n'importe quelle clé, et le
// garde serait vert en décrivant un langage qui n'existe pas.
for (const [quoi, cle] of [
  ['une coquille sur note',     'nte'],
  ['une coquille sur channel',  'chanel'],
  ['un mot plausible',          'velocity'],
]) {
  ok(refusDAttribut(`@core\nS -> C4 <! in.midi(${cle}:60)\n`).length > 0,
     `2. ${quoi} ('${cle}') doit rester refusée — sinon toute clé passe au point d'attente`);
}

// ─── 3. INJECTION DANS L'ACCUSÉ — la clé retirée de la DONNÉE, la forme retombe ─────────────
// ⚠️ EN MÉMOIRE, jamais sur le disque : une librairie modifiée sur disque atteint mes
// consommateurs à la seconde où je l'enregistre.
{
  const ampute = JSON.parse(JSON.stringify(LIBS.core));
  ampute.schema.addressKeys = ampute.schema.addressKeys.filter((k) => k !== 'note');
  registerLib('core', ampute);
  ok(refusDAttribut('@core\nS -> C4 <! in.midi(note:60)\n').length > 0,
     "3. (mord) `note` retiré de la donnée doit faire retomber la forme sur « attribut inconnu » — "
     + 'sinon la clé est reconnue ailleurs qu\'en librairie, et la donnée ne commande rien');
  clearRegistry();
  registerAll(LIBS);
  ok(erreursDe('@core\nS -> C4 <! in.midi(note:60)\n').length === 0,
     '3. après restauration, la forme doit repasser — sinon la mutilation fuit sur la suite');
}

// ─── 4. INJECTION DANS LE JUGE — la décision rejouée isolée ─────────────────────────────────
const juger = (cle, declarees) => !declarees.has(cle);
const declarees = new Set(['ch', 'channel', 'device', 'note', 'port']);
ok(juger('nte', declarees), '4. (mord) une clé hors liste doit rougir');
ok(!juger('note', declarees), '4. (se tait) une clé déclarée passe');
ok(!juger('channel', declarees), '4. (se tait) le canal aussi');
ok(juger('velocity', declarees), '4. (mord) un mot plausible non déclaré rougit');

// ─── 5. À L'ARRIVÉE — les paires atteignent l'arbre, portées par le point d'attente ──────────
// Un refus levé ne prouve rien de ce que l'aval reçoit : « compile » n'est pas « arrive ».
{
  const arbre = compileToBPxAST('@core\nS -> C4 <! in.midi(note:60, channel:3)\n').ast;
  const attentes = [];
  (function marcher(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const el of n) marcher(el); return; }
    if (n.type === 'Wait') attentes.push(n);
    for (const k in n) marcher(n[k]);
  })(arbre);
  ok(attentes.length === 1, `5. l'arbre doit porter UN point d'attente — vus : ${attentes.length}`);
  const paires = (attentes[0]?.suffixQualifiers || []).flatMap((s) => s.pairs || []);
  const vue = Object.fromEntries(paires.map((p) => [p.key, p.value]));
  ok(vue.note === 60 && vue.channel === 3,
     `5. les deux paires doivent ARRIVER sur le point d'attente — vu : ${JSON.stringify(vue)}`);
}

// Le compte des vérifications EXÉCUTÉES, hors ce bilan lui-même : un garde qui refuse d'avoir
// examiné zéro doit aussi refuser d'en avoir examiné dix-sept parce qu'une boucle s'est vidée.
const TOTAL_ATTENDU = 21;
ok(passe + echecs.length === TOTAL_ATTENDU,
   `bilan : ${TOTAL_ATTENDU} vérifications attendues, ${passe + echecs.length} exécutées`);

if (echecs.length) {
  console.error(`❌ adresse d'un point d'attente : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ une adresse d'entrée se qualifie par ses clés — ${passe} vérification(s) passée(s), `
    + `${cles.length} clés d'adresse déclarées`);
}
