#!/usr/bin/env node
/**
 * GARDE — `lib/core.json` `schema.channels` est le CATALOGUE UNIQUE des canaux (décision Romain
 * 2026-08-04). Avant ce geste la donnée était coupée en deux et avait DIVERGÉ sans témoin : ce
 * fichier portait les DIRECTIONS, `kanopi/packages/library/devices.json` (dépôt voisin) portait
 * les PARAMÈTRES par défaut — trois canaux sur cinq déclarés des deux côtés avec des champs
 * disjoints, et deux (`dmx`, `text`) n'existant que d'un seul côté. Personne ne l'a vu jusqu'à ce
 * que le voisin bute dessus.
 *
 * CE GARDE LIT LA DONNÉE, IL NE LA RÉÉCRIT PAS (matrice construite depuis `schema.channels`, pas
 * une liste couchée dans le test) — sinon ajouter/retirer un canal en librairie ne serait testé
 * par personne. Douze cas : chaque canal du catalogue × chaque direction {out, in}, plus un cas
 * hors-catalogue (`inconnu`) pour vérifier que la liste reste FERMÉE. Chaque refus doit NOMMER
 * la direction demandée, pas réciter une liste (Romain : « le refus nomme la direction »).
 *
 * DIRECTION ≠ ÉCRITURE (correction Romain 2026-08-04, sur un défaut du geste catalogue-unique
 * lui-même) : `text` PORTE `out:true` — il est routé exactement comme les autres sorties de
 * l'architecture — mais reste refusé à l'écriture (`writable:false`), parce que son point
 * d'écriture — son appareil dédié — n'existe pas encore. Le refus de `out.text` ne doit donc PAS
 * nommer une direction absente (ce serait faux, il l'a) : il nomme l'écriture fermée. `writable`
 * est déclaré EXPLICITEMENT sur les SIX canaux (jamais déduit d'une absence) — la forme se
 * reproduira : un canal peut exister dans l'architecture avant d'avoir sa graphie.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const CORE_PATH = path.join(ICI, '..', 'lib', 'core.json');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compile = (corps) => {
  try { return compileToBPxAST(`@core\n${corps}\n`); }
  catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};

const sceneOut = (canal) => `@actor v\n  alphabet.western\n  out.${canal}\n@mode:ord\nS -> v.C4`;
const sceneIn = (canal) => `@var x in.${canal}\n@mode:ord\nS -> C4`;

// Mot que porte le message quand un canal EST une direction mais reste fermé à l'écriture —
// DISTINCT de `motDirection` ('n'est pas une sortie'/'n'est pas une entrée'), qui nommerait une
// direction absente et serait donc FAUX pour un canal comme `text` (il a la direction).
const MOT_ECRITURE_FERMEE = 'ÉCRITURE';

/**
 * Vérifie une direction (`out`/`in`) pour un canal. Trois issues possibles, lues depuis
 * `channels` (chargé depuis lib/core.json au moment du test, jamais copié en dur) :
 *  - le canal ne porte pas cette direction → REFUSÉ, message NOMME la direction absente ;
 *  - le canal porte la direction mais `writable:false` → REFUSÉ, message NOMME l'écriture
 *    fermée (DIRECTION ≠ ÉCRITURE, jamais « n'est pas une sortie », qui serait faux) ;
 *  - le canal porte la direction et `writable:true` → ACCEPTÉ.
 */
function verifierDirection(canal, direction, channels, motDirection) {
  const scene = direction === 'out' ? sceneOut(canal) : sceneIn(canal);
  const r = compile(scene);
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  const porteDirection = !!(channels[canal] && channels[canal][direction]);
  const ecrivable = !!(channels[canal] && channels[canal].writable);
  const label = `${direction}.${canal}`;
  if (porteDirection && ecrivable) {
    ok((r.errors || []).length === 0, `'${label}' doit être ACCEPTÉ — reçu : ${msg.slice(0, 200)}`);
  } else if (porteDirection && !ecrivable) {
    ok((r.errors || []).length > 0, `'${label}' doit être REFUSÉ (écriture fermée) — reçu ACCEPTÉ`);
    ok(!msg.includes(motDirection), `'${label}' refusé mais dit encore « ${motDirection} » — FAUX, ce canal PORTE la direction (défaut du 2026-08-04) — reçu : ${msg.slice(0, 200)}`);
    ok(msg.toUpperCase().includes(MOT_ECRITURE_FERMEE), `'${label}' refusé mais le message ne NOMME pas l'écriture fermée — reçu : ${msg.slice(0, 200)}`);
  } else {
    ok((r.errors || []).length > 0, `'${label}' doit être REFUSÉ — reçu ACCEPTÉ`);
    ok(msg.includes(motDirection), `'${label}' refusé mais le message ne NOMME pas la direction ('${motDirection}') — reçu : ${msg.slice(0, 200)}`);
  }
}

// ─── CHARGE LE CATALOGUE DEPUIS LA DONNÉE (pas une liste réécrite ici) ───────────────────────
const core = JSON.parse(fs.readFileSync(CORE_PATH, 'utf8'));
const channels = core.schema.channels;

// ─── TÉMOIN ANTI-RÉTRÉCISSEMENT : le catalogue doit couvrir les 5 canaux attendus par la tâche ─
for (const canal of ['audio', 'midi', 'osc', 'keyboard', 'dmx', 'text']) {
  ok(Object.prototype.hasOwnProperty.call(channels, canal), `le catalogue doit déclarer '${canal}'`);
}

// ─── TÉMOIN FIGÉ D'ÉCRITURE : INDÉPENDANT de la donnée qu'il relit (mesuré 2026-08-04) ───────
// La matrice plus bas s'ADAPTE à `channels` — donc une régression COHÉRENTE de la donnée (ex.
// quelqu'un bascule 'audio' à writable:false) ne casse RIEN dans une matrice qui ne fait que
// suivre ce que la donnée dit. Prouvé par injection : sans ce témoin, le garde restait VERT
// après avoir mis 'audio' à writable:false. Ce bloc fige donc les valeurs ATTENDUES à la main,
// hors de toute lecture de `channels` — c'est lui qui rougit si le catalogue régresse.
for (const canal of ['audio', 'midi', 'osc', 'keyboard', 'dmx']) {
  ok(!!(channels[canal] && channels[canal].writable === true), `'${canal}' doit rester ÉCRIVABLE (témoin figé, indépendant de la donnée)`);
}
ok(!!(channels.text && channels.text.writable === false), "'text' doit rester NON écrivable (témoin figé, indépendant de la donnée)");

// ─── MATRICE : CHAQUE CANAL DU CATALOGUE × {out, in} ─────────────────────────────────────────
for (const canal of Object.keys(channels)) {
  verifierDirection(canal, 'out', channels, "n'est pas une sortie");
  verifierDirection(canal, 'in', channels, "n'est pas une entrée");
}

// ─── HORS CATALOGUE : la liste reste FERMÉE ──────────────────────────────────────────────────
{
  const r = compile(sceneOut('inconnu'));
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok((r.errors || []).length > 0, "'out.inconnu' doit être REFUSÉ (liste fermée)");
  ok(msg.includes("n'est pas une sortie"), `'out.inconnu' refusé mais sans nommer la direction — reçu : ${msg.slice(0, 200)}`);
}

// ─── DMX SPÉCIFIQUEMENT ATTENDU EN SORTIE (item 2 de la tâche) ───────────────────────────────
ok(!!(channels.dmx && channels.dmx.out), "'dmx' doit porter la direction 'out' dans le catalogue");
ok(!channels.dmx || !channels.dmx.in, "'dmx' ne doit PAS porter la direction 'in' (pas demandé par la tâche)");

// ─── TEXT : SORTIE DE L'ARCHITECTURE, PAS ENCORE ÉCRIVABLE (défaut corrigé 2026-08-04) ───────
// `text` porte désormais `out:true` (il EST routé comme les autres sorties) ET `writable:false`
// (son point d'écriture — son appareil dédié — n'existe pas encore). Les deux propriétés sont
// SÉPARÉES : le catalogue ne confond plus « n'a pas de direction » et « n'est pas écrivable ».
ok(!!channels.text, "'text' doit être présent dans le catalogue (donnée d'affichage)");
ok(!!(channels.text && channels.text.out), "'text' DOIT porter 'out' — il est routé comme les autres sorties");
ok(!channels.text || !channels.text.in, "'text' ne doit PAS porter 'in' — aucune direction d'entrée");
ok(!!(channels.text && channels.text.writable === false), "'text' doit porter 'writable:false' EXPLICITEMENT (pas déduit d'une absence)");

// ─── CAS NEUF : un canal marqué non écrivable est REFUSÉ au parse tout en restant dans le
// catalogue (item de la tâche 2026-08-04). Généralisé à TOUT canal writable:false du catalogue,
// pas seulement `text` — le prochain canal routé-mais-pas-encore-écrivable retombe dans le même
// filet. Le message ne doit JAMAIS dire que le canal n'est pas une sortie/entrée : il L'EST.
for (const canal of Object.keys(channels)) {
  if (channels[canal].writable !== false) continue;
  ok(Object.prototype.hasOwnProperty.call(channels, canal), `'${canal}' (non écrivable) doit rester DANS le catalogue`);
  for (const direction of ['out', 'in']) {
    if (!channels[canal][direction]) continue; // pas cette direction : couvert par la matrice ci-dessus
    const scene = direction === 'out' ? sceneOut(canal) : sceneIn(canal);
    const r = compile(scene);
    const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
    ok((r.errors || []).length > 0, `cas neuf : '${direction}.${canal}' (writable:false) doit être REFUSÉ`);
    ok(!msg.includes(`n'est pas une ${direction === 'out' ? 'sortie' : 'entrée'}`),
      `cas neuf : '${direction}.${canal}' refusé mais le message dit encore une direction absente — FAUX — reçu : ${msg.slice(0, 200)}`);
  }
}

if (echecs.length) {
  console.error(`❌ catalogue unique des canaux : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ catalogue unique des canaux — ${passe} vérification(s) passée(s)`);
}
