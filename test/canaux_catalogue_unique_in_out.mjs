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
import { LIBS } from '../src/transpiler/libs-data.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
// La donnee se prend dans le BUNDLE : il rend la meme chose quel que soit le format de la source.
const CORE = LIBS.core;

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compile = (corps) => {
  try { return compileToBPxAST(`core\n${corps}\n`); }
  catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};

// ⛔ CE TÉMOIN S'APPELAIT `sceneOut` ET BÂTISSAIT UN BLOC D'ACTEUR. Le nom mentait, et c'est
// exactement par là que le trou a survécu : la sortie de SCÈNE — `out.<canal>` en tête, sans
// acteur — n'était éprouvée par personne, et elle acceptait `out.zorglub` comme `out.keyboard`.
// La forme d'acteur, elle, refusait les deux depuis le 2026-08-04.
//
// ⚠️ UN GARDE NOMMÉ POUR UNE FORME QU'IL N'EXERCE PAS EST PIRE QU'UN GARDE ABSENT : il occupe la
// place. Les DEUX graphies passent désormais dans la même matrice, et le message doit être le
// MÊME — deux écritures d'une seule règle qui refusent différemment enseignent deux langages.
// ⚠️ ET UNE TROISIÈME GRAPHIE EST ENTRÉE LE 2026-08-19 : la DÉCLARATION DE TERMINAL, `<nom>:<canal>`.
// Elle laissait passer `a:text` (canal fermé à l'écriture) et rendait, sur `a:zorglub`, un refus qui
// accusait le TERMINAL au lieu du CANAL. Trois écritures d'une même liste fermée, trois fois la même
// exigence — et c'est la troisième fois que la même case se rouvre à une place qu'on n'éprouvait pas.
const GRAPHIES_OUT = {
  acteur: (canal) => `actor v\n  alphabet.western\n  out.${canal}\nmode:ord\n-----\nS -> v.C4`,
  scene: (canal) => `alphabet.western\nout.${canal}\nmode:ord\n-----\nS -> C4`,
  terminal: (canal) => `alphabet.western\nzz:${canal}\nmode:ord\n-----\nS -> zz`,
};
const sceneOut = GRAPHIES_OUT.acteur;
const sceneIn = (canal) => `in.${canal} x\nmode:ord\n-----\nS -> C4`;

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
function verifierDirection(canal, direction, channels, motDirection, graphie = 'acteur') {
  const scene = direction === 'out' ? GRAPHIES_OUT[graphie](canal) : sceneIn(canal);
  const r = compile(scene);
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  const porteDirection = !!(channels[canal] && channels[canal][direction]);
  const ecrivable = !!(channels[canal] && channels[canal].writable);
  const label = `${direction}.${canal} (graphie ${direction === 'out' ? graphie : 'scène'})`;
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
const core = CORE;
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
  for (const graphie of Object.keys(GRAPHIES_OUT)) {
    verifierDirection(canal, 'out', channels, "n'est pas une sortie", graphie);
  }
  verifierDirection(canal, 'in', channels, "n'est pas une entrée");
}

// ─── HORS CATALOGUE : la liste reste FERMÉE ──────────────────────────────────────────────────
// LES DEUX GRAPHIES, et le message COMPARÉ mot pour mot entre elles.
{
  const messages = {};
  for (const graphie of Object.keys(GRAPHIES_OUT)) {
    const r = compile(GRAPHIES_OUT[graphie]('inconnu'));
    const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
    messages[graphie] = msg;
    ok((r.errors || []).length > 0, `'out.inconnu' (graphie ${graphie}) doit être REFUSÉ (liste fermée)`);
    // ⚠️ CE QUE LE REFUS DOIT DIRE DÉPEND DE LA GRAPHIE, ET C'EST VOULU. Sur `out.<canal>` la
    // direction est ÉCRITE, donc un nom inconnu se refuse par elle. Sur `<nom>:<canal>` la direction
    // n'est écrite nulle part : le refus doit d'abord dire que le canal N'EXISTE PAS, sans quoi il
    // reprocherait une direction à un mot qui n'est pas un canal du tout.
    const attendu = graphie === 'terminal' ? "n'existe pas" : "n'est pas une sortie";
    ok(msg.includes(attendu),
      `'out.inconnu' (graphie ${graphie}) refusé mais sans dire « ${attendu} » — reçu : ${msg.slice(0, 200)}`);
  }
  // ⛔ LE REFUS DOIT DIRE LA MÊME CHOSE DES DEUX CÔTÉS, à l'attribution d'acteur près. Sans cette
  // comparaison, une graphie peut refuser pour une raison et l'autre pour une autre, et les deux
  // volets ci-dessus resteraient verts.
  const noyau = (m) => m.replace(/^acteur '[^']*' : /, '').replace(/ at line \d+:\d+/, '').trim();
  ok(noyau(messages.acteur) === noyau(messages.scene),
    `les deux graphies de 'out.inconnu' doivent refuser par le MÊME message — acteur : `
    + `« ${noyau(messages.acteur).slice(0, 90)} » · scène : « ${noyau(messages.scene).slice(0, 90)} »`);
  // ⛔ LA DÉCLARATION DE TERMINAL DIT DE PLUS QUE LE CANAL N'EXISTE PAS. Les deux autres graphies
  // n'ont qu'un refus de DIRECTION ; celle-ci sépare « ce canal n'existe pas » de « il n'a pas cette
  // direction », parce qu'un nom inventé y ressemble à une faute de frappe sur un réglage. Deux
  // causes distinctes valent mieux qu'un message unique — c'est la leçon du suffixe et de l'arobase.
  ok(/n'existe pas/.test(messages.terminal),
    `'zz:inconnu' doit dire que le CANAL n'existe pas — reçu : ${messages.terminal.slice(0, 120)}`);
  ok(!/terminal 'zz' non déclaré/.test(messages.terminal),
    `'zz:inconnu' accuse encore le TERMINAL alors que la faute est sur le CANAL — c'est le défaut `
    + `réparé le 2026-08-19 (reçu : ${messages.terminal.slice(0, 120)})`);
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
