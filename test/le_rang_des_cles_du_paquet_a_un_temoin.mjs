#!/usr/bin/env node
/**
 * GARDE — LE RANG DES CLÉS DU PAQUET A UN TÉMOIN, ET IL NE L'AVAIT PAS.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE, LE 2026-08-25. En convertissant `core.json`, trois ordres de clés ont
 * changé — `core`, `core.schema`, `scales`. **Aucune de mes preuves ne pouvait le voir** : une
 * comparaison par CHEMIN rend `x.y` avant et après sans jamais dire à quel rang `y` se trouve. Je
 * l'ai mesuré à la main, une fois, parce que je me suis souvenu du 2026-08-23 — pas parce qu'un
 * instrument me l'a dit.
 *
 * ⚠️ ET C'EST UN VOISIN QUI A NOMMÉ LE VRAI DÉFAUT. Kanopi, le jour même : *« si aucun de tes trois
 * destinataires n'en a, ton changement de rang est INOBSERVABLE en aval. Ce n'est pas “sans risque”,
 * c'est “sans témoin”, et les deux ne se confondent pas. Le jour où un rang comptera, personne ne le
 * verra basculer. »* Trois voisins ont mesuré n'avoir aucun lecteur atteint ; **aucun n'a dit que le
 * rang n'importait pas.**
 *
 * ⛔ ET LE RANG A DÉJÀ MORDU, DEUX FOIS, PLUS BAS QUE LÀ OÙ JE REGARDAIS :
 *
 *     2026-08-23   ranger le paquet par PASSE au lieu de par NOM a fait du catalogue de TEST
 *                  l'autorité de l'axe `alphabet`. Sept gardes de cascade sont tombés d'un coup,
 *                  et la preuve d'égalité comparait 3631 champs sans en voir un seul bouger :
 *                  **elle comparait les VALEURS, jamais leur RANG.**
 *     mesuré chez   kairos, `src/pitch/builder.ts:250` — `Object.keys(entry.terminals)` fixe l'ordre
 *     les voisins   des notes, donc les DEGRÉS, donc les HAUTEURS. Un réordonnancement à l'intérieur
 *                   d'une entrée d'alphabet ne rend pas « la même donnée sous un autre rang » :
 *                   il change ce qu'on entend.
 *
 * CE QUE CE GARDE FAIT, ET CE QU'IL NE FAIT PAS. Il **n'interdit rien** — un rang a le droit de
 * bouger. Il le rend VISIBLE : il tient l'empreinte des ordres de clés à toutes les profondeurs du
 * paquet publié, et il rougit quand l'une bouge, en NOMMANT le chemin.
 *
 * LE GESTE QUAND IL MORD :
 *   1. regarder le chemin nommé — est-ce un rang que quelqu'un lit ?
 *   2. les lecteurs de rang MESURÉS chez les voisins, au 2026-08-25 :
 *        kairos  `builder.ts:237`  rang des ENTRÉES de `tunings` (premier accordage qui nomme l'alphabet)
 *        kairos  `builder.ts:250`  rang des clés DANS une entrée d'alphabet → les degrés
 *        atlas   `inventaire.mjs:326`  `core.defaults.values`, dans l'ordre reçu
 *        atlas   `inventaire.mjs:224-225`  `syntaxWords`, `directiveValues` (schéma de syntaxe)
 *      Ces quatre-là se préviennent AVANT la frappe. Les autres chemins se rendent au préavis.
 *   3. puis remettre l'empreinte à jour : `node test/le_rang_des_cles_du_paquet_a_un_temoin.mjs --maj`
 *
 * ⚠️ UNE EMPREINTE COMPARE TOUT, SAUF CE QUI EST PROUVÉ HORS SUJET. Celle-ci ne choisit aucun champ :
 * choisir reviendrait à décider ce qu'on ne verra pas, et c'est exactement ainsi que le rang est
 * passé sous les 3631 champs comparés du 2026-08-23.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { LIBS, PLACES } from '../src/transpiler/libs-data.js';

const REFERENCE = new URL('./ordres-du-paquet.json', import.meta.url);

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

/**
 * L'ORDRE DES CLÉS DE CHAQUE OBJET, PAR CHEMIN — et rien d'autre.
 *
 * ⛔ LES TABLEAUX COMPTENT AUSSI, et pour la même raison. `apporte` est une liste ORDONNÉE : la
 * chaîne d'invocation se résout dans l'ordre écrit. Un tableau réordonné est un rang qui bouge, et
 * ne lire que les objets le laisserait passer.
 */
function ordres(o, chemin = '', out = {}) {
  if (!o || typeof o !== 'object') return out;
  if (Array.isArray(o)) {
    out[chemin] = o.map((x) => (x && typeof x === 'object' ? '·' : String(x))).join('|');
    o.forEach((v, i) => ordres(v, `${chemin}[${i}]`, out));
    return out;
  }
  out[chemin] = Object.keys(o).join('|');
  for (const k of Object.keys(o)) ordres(o[k], chemin ? `${chemin}.${k}` : k, out);
  return out;
}

const empreinte = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/** L'empreinte du paquet : un condensé par chemin. La référence reste lisible et diffable. */
function empreinteDuPaquet() {
  const tout = { ...ordres(LIBS), ...ordres(PLACES, '#PLACES') };
  const out = {};
  for (const [chemin, ordre] of Object.entries(tout)) out[chemin || '#racine'] = empreinte(ordre);
  return out;
}

const courant = empreinteDuPaquet();

// ── MISE À JOUR EXPLICITE — jamais automatique ───────────────────────────────────────────────
// ⛔ UNE RÉFÉRENCE QUI SE MET À JOUR TOUTE SEULE NE GARDE RIEN : elle enregistre ce qui vient de
// passer et le déclare conforme. C'est le mode d'échec d'un `--maj` implicite, et il est muet.
if (process.argv.includes('--maj')) {
  writeFileSync(REFERENCE, `${JSON.stringify(courant, null, 1)}\n`);
  console.log(`[rang] référence mise à jour — ${Object.keys(courant).length} chemin(s).`);
  process.exit(0);
}

// ── SOCLE — refuser de conclure sur du vide ──────────────────────────────────────────────────
ok(Object.keys(courant).length >= 500,
  `SOCLE : ${Object.keys(courant).length} chemin(s) relevé(s) dans le paquet. Sous ce seuil, le `
  + `parcours a échoué et l'égalité comparerait deux vides.`);
ok(existsSync(REFERENCE),
  `SOCLE : la référence des ordres est absente. La poser : `
  + `node test/le_rang_des_cles_du_paquet_a_un_temoin.mjs --maj`);

if (existsSync(REFERENCE)) {
  const reference = JSON.parse(readFileSync(REFERENCE, 'utf8'));
  const chemins = new Set([...Object.keys(reference), ...Object.keys(courant)]);
  const bouges = [...chemins].filter((c) => reference[c] !== courant[c]);

  ok(bouges.length === 0,
    `⛔ ${bouges.length} ORDRE(S) DE CLÉS ONT BOUGÉ dans le paquet publié :\n`
    + bouges.slice(0, 12).map((c) => `        ${c}  ${reference[c] ? (courant[c] ? 'RÉORDONNÉ' : 'disparu') : 'apparu'}`).join('\n')
    + (bouges.length > 12 ? `\n        … et ${bouges.length - 12} autre(s)` : '')
    + `\n      Un rang n'est pas de la mise en page : le 2026-08-23, un rang déplacé a fait du `
    + `catalogue de TEST l'autorité de l'axe 'alphabet', et sept gardes sont tombés. Vérifier qui `
    + `lit CE chemin (l'en-tête nomme les quatre lecteurs mesurés chez les voisins), prévenir, puis `
    + `'--maj'.`);

  // ── LE TÉMOIN QUI DISCRIMINE — sans lui, une référence VIDE serait verte sans rien comparer ──
  ok(Object.keys(reference).length >= 500,
    `TÉMOIN : la référence ne porte que ${Object.keys(reference).length} chemin(s). Une référence `
    + `vidée compare deux fois rien et rend vert.`);
}

// ── L'INJECTION — on FABRIQUE le réordonnancement, et on exige que le juge le voie ────────────
// ⛔ OBSERVER NE DISCRIMINE PAS, FABRIQUER TRANCHE. Un paquet stable rend le même vert qu'un juge
// mort ; seule une empreinte fabriquée sur un ordre inversé sépare les deux.
{
  const juger = (ref, cour) => [...new Set([...Object.keys(ref), ...Object.keys(cour)])]
    .filter((c) => ref[c] !== cour[c]);

  const a = { x: 1, y: 2, z: 3 };
  const b = { z: 3, y: 2, x: 1 };            // MÊMES valeurs, autre rang
  ok(JSON.stringify(a) !== JSON.stringify(b),
    `INJECTION — socle : les deux objets doivent différer par leur ordre seul.`);
  ok(juger({ o: empreinte(Object.keys(a).join('|')) }, { o: empreinte(Object.keys(b).join('|')) }).length === 1,
    `INJECTION (mord) — un objet réordonné, valeurs identiques, doit être RELEVÉ. C'est le cas exact `
    + `qu'une comparaison par chemin ou par valeur ne voit pas.`);
  ok(juger({ o: empreinte('x|y|z') }, { o: empreinte('x|y|z') }).length === 0,
    `INJECTION (se tait) — un ordre inchangé ne doit rien déclencher, sinon le garde crie toujours `
    + `et on finit par le débrancher.`);

  // ⛔ ET LE TABLEAU AUSSI — `apporte` est une liste ORDONNÉE, la chaîne d'invocation s'y résout
  // dans l'ordre écrit. Un juge aveugle aux tableaux laisserait passer une chaîne réordonnée.
  const l1 = ordres({ apporte: ['a', 'b', 'c'] });
  const l2 = ordres({ apporte: ['c', 'b', 'a'] });
  ok(l1.apporte !== l2.apporte,
    `INJECTION (mord) — un TABLEAU réordonné doit être vu : 'apporte' est une chaîne d'invocation, `
    + `et son ordre décide de l'ordre de résolution.`);
}

// ── ET LE PAQUET PORTE BIEN LES CHEMINS QUE LES VOISINS ONT NOMMÉS ───────────────────────────
// ⚠️ UN GARDE SE PROUVE SUR LA GRAPHIE QUE LE CODE ÉCRIT. Si l'un de ces chemins disparaissait du
// relevé, le témoin resterait vert en ne surveillant plus le seul rang dont on sait qu'il est lu.
for (const chemin of ['core.defaults.values', 'core.apporte', 'scales.apporte']) {
  ok(Object.prototype.hasOwnProperty.call(courant, chemin),
    `COUVERTURE — '${chemin}' est un rang MESURÉ comme lu chez un voisin, et il ne figure pas dans `
    + `le relevé. Le témoin serait vert en ne le surveillant plus.`);
}

if (e.length) {
  console.error(`[rang] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error(`  ✗ ${x}`);
  process.exit(1);
}
console.log(`[rang] ${p} PASS / 0 FAIL — ${Object.keys(courant).length} ordre(s) de clés sous témoin, `
  + `injection éprouvée dans les deux sens.`);
