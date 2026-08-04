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
 * `text` est un cas particulier voulu : il EST dans le catalogue (c'est une destination — la
 * console d'affichage de l'interface) mais ne porte AUCUNE direction, donc `out.text` et
 * `in.text` sont refusés au même titre qu'un canal qui ne porte que l'autre direction.
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

/**
 * Vérifie une direction (`out`/`in`) pour un canal : accepté si le catalogue le déclare,
 * refusé — EN NOMMANT LA DIRECTION — sinon. Lit `channels` (chargé depuis lib/core.json au
 * moment du test, jamais copié en dur) pour décider de l'attendu.
 */
function verifierDirection(canal, direction, channels, motDirection) {
  const scene = direction === 'out' ? sceneOut(canal) : sceneIn(canal);
  const r = compile(scene);
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  const attendu = !!(channels[canal] && channels[canal][direction]);
  const label = `${direction}.${canal}`;
  if (attendu) {
    ok((r.errors || []).length === 0, `'${label}' doit être ACCEPTÉ — reçu : ${msg.slice(0, 200)}`);
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

// ─── TEXT SPÉCIFIQUEMENT SANS AUCUNE DIRECTION (item 3 de la tâche) ──────────────────────────
ok(!!channels.text, "'text' doit être présent dans le catalogue (donnée d'affichage)");
ok(!channels.text || !channels.text.out, "'text' ne doit PAS porter 'out' — non écrivable dans une scène");
ok(!channels.text || !channels.text.in, "'text' ne doit PAS porter 'in' — non écrivable dans une scène");

if (echecs.length) {
  console.error(`❌ catalogue unique des canaux : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ catalogue unique des canaux — ${passe} vérification(s) passée(s)`);
}
