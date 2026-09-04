#!/usr/bin/env node
/**
 * GARDE — UN TEXTE DE MON PAQUET NE CITE PAS UN FICHIER QUI N'EXISTE PLUS.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE, LE 2026-08-25. En convertissant le dernier catalogue de racine, `lib/`
 * a cessé de porter le moindre `.json`. **Neuf textes de mon paquet publié continuaient d'en nommer
 * un**, et quatre d'entre eux étaient rendus tels quels sur les pages publiées d'Atlas :
 *
 *     cinq corps de fonction     « libs-bundle.js en capte le SOURCE dans lib/digital.json »
 *                                → le fichier est `.bpsl` depuis sa conversion, et ce commentaire
 *                                  décrivait MON mécanisme faux, dans MA donnée publiée
 *     deux descriptions de raga   « (Déplacée de tunings.json, 2026-07-17) »
 *
 * ⇒ **Aucun de mes gardes ne pouvait le voir.** Un texte n'est pas du code : il ne casse pas, il ne
 * compile pas, il ne rougit nulle part. Il se contente d'envoyer son lecteur vers un fichier absent —
 * et il porte l'autorité de la donnée publiée. C'est un voisin qui me l'a mesuré, sur mon paquet.
 *
 * ⚠️ ET LA MÊME CLASSE A MORDU DANS L'AUTRE SENS LE MÊME JOUR. Sa mesure comptait NEUF morts ; deux
 * n'étaient pas morts. `console_strings.json` est le registre du moteur natif, il vit chez
 * bp3-engine, et les deux textes disaient eux-mêmes « registre moteur » et « BP3 ». Son motif était
 * borné à mon `lib/` — **il l'avait annoncé, puis franchi trois lignes plus bas.**
 *
 * ⇒ **CE GARDE PORTE DONC SA BORNE DANS SON CODE, PAS DANS UNE PHRASE.** Une citation qui nomme un
 * dépôt voisin est comptée, annoncée, et JAMAIS jugée : je ne sais pas ce qui existe chez les
 * autres, et un garde qui prétendrait le savoir rendrait un faux rouge à chaque frappe d'un voisin.
 *
 * LE GESTE QUAND IL MORD : corriger le TEXTE, jamais recréer le fichier. Et si la citation vise un
 * voisin, la faire nommer son dépôt — c'est ce qui la sort du périmètre de ce garde.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();

const LIB = new URL('../lib/', import.meta.url).pathname;

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

/** Ce qui existe réellement sous `lib/`, à toute profondeur. */
const present = new Set();
(function marcher(d, prefixe = '') {
  for (const x of readdirSync(d)) {
    const f = join(d, x);
    if (statSync(f).isDirectory()) marcher(f, `${prefixe}${x}/`);
    else present.add(`${prefixe}${x}`);
  }
})(LIB);

/**
 * ⛔ LA BORNE EST DANS LE MOTIF. Un chemin qui porte un RÉPERTOIRE que `lib/` ne connaît pas désigne
 * un autre dépôt — `capture-run/console_strings.json` chez bp3-engine, `loadGrammar.ts` chez BPx.
 * Ce garde ne juge que ce qui prétend vivre sous `lib/`.
 */
const MOTIF = /\b((?:lib\/)?[A-Za-z_][A-Za-z0-9_/-]*\.(?:json|bpsl|bps))\b/g;
const racinesDeLib = new Set([...present].filter((f) => f.includes('/')).map((f) => f.split('/')[0]));

const citations = new Map();          // fichier cité → [chemins de la donnée]
(function parcourir(n, chemin) {
  if (typeof n === 'string') {
    for (const m of n.matchAll(MOTIF)) {
      if (!citations.has(m[1])) citations.set(m[1], []);
      citations.get(m[1]).push(chemin);
    }
    return;
  }
  if (!n || typeof n !== 'object') return;
  for (const k of Object.keys(n)) parcourir(n[k], chemin ? `${chemin}.${k}` : k);
})(LIBS, '');

const morts = [];
const horsPerimetre = [];
for (const [cite, ou] of citations) {
  const base = cite.replace(/^lib\//, '');
  // Un chemin à répertoire dont la racine n'est pas une racine de `lib/` vit ailleurs : hors sujet.
  if (base.includes('/') && !racinesDeLib.has(base.split('/')[0])) { horsPerimetre.push(cite); continue; }
  if (present.has(base)) continue;
  morts.push([cite, ou]);
}

// ── SOCLE — refuser de conclure sur du vide ──────────────────────────────────────────────────
ok(present.size >= 20,
  `SOCLE : ${present.size} fichier(s) relevé(s) sous lib/. Sous ce seuil, le parcours a échoué et `
  + `toute citation serait déclarée morte.`);
ok(Object.keys(LIBS).length >= 20,
  `SOCLE : ${Object.keys(LIBS).length} catalogue(s) dans le paquet — le parcours n'a rien lu.`);

ok(morts.length === 0,
  `⛔ ${morts.length} TEXTE(S) DU PAQUET CITENT UN FICHIER DE lib/ QUI N'EXISTE PLUS :\n`
  + morts.map(([c, ou]) => `        ${c}\n          ${ou.slice(0, 4).join('\n          ')}`).join('\n')
  + `\n      Un texte ne casse pas, ne compile pas, ne rougit nulle part — il envoie son lecteur vers `
  + `un fichier absent avec l'autorité de la donnée publiée, et il voyage jusqu'aux pages de qui me `
  + `dérive. Corriger le TEXTE, jamais recréer le fichier.`);

console.log(`[citations] ${present.size} fichier(s) sous lib/ · ${citations.size} nom(s) cité(s) dans `
  + `le paquet · ${horsPerimetre.length} hors périmètre(autre dépôt, NON jugé${horsPerimetre.length
    ? ' : ' + horsPerimetre.join(', ') : ''})`);

// ── L'INJECTION — dans le JUGE, et dans les DEUX sens ────────────────────────────────────────
{
  const juger = (cite, existants, racines) => {
    const base = cite.replace(/^lib\//, '');
    if (base.includes('/') && !racines.has(base.split('/')[0])) return 'hors-perimetre';
    return existants.has(base) ? 'vivante' : 'morte';
  };
  const existants = new Set(['digital.bpsl', 'digital/scaleshift.ts']);
  const racines = new Set(['digital']);
  ok(juger('lib/digital.json', existants, racines) === 'morte',
    `INJECTION (mord) — une citation vers un fichier absent de lib/ doit être MORTE. C'est le cas `
    + `exact des cinq corps de fonction du 2026-08-25.`);
  ok(juger('lib/digital.bpsl', existants, racines) === 'vivante',
    `INJECTION (se tait) — une citation vers un fichier présent ne doit rien déclencher.`);
  ok(juger('capture-run/console_strings.json', existants, racines) === 'hors-perimetre',
    `INJECTION (s'abstient) — une citation vers un AUTRE dépôt ne se juge pas. C'est la borne que la `
    + `mesure d'Atlas avait annoncée puis franchie, et elle vit ici dans le code, pas dans une phrase.`);
}

// ── LE TÉMOIN QUI DISCRIMINE — un paquet sans aucune citation rendrait le même vert ──────────
// ⛔ COMPTER DIT CE QUI EST ÉCRIT, EXERCER DIT CE QUI SE PASSE. Si plus aucun texte ne citait de
// fichier, ce garde serait vert en ne surveillant rien, et sa sortie serait indistinguable.
ok(citations.size > 0,
  `TÉMOIN : ZÉRO nom de fichier cité dans tout le paquet. Un garde vert qui n'a rien examiné et un `
  + `garde vert qui a tout validé ont la même sortie — celui-ci refuse la première.`);

if (e.length) {
  console.error(`[citations] ${e.length} ÉCHEC(S) :`);
  for (const x of e) console.error(`  ✗ ${x}`);
  process.exit(1);
}
console.log(`[citations] ${p} PASS / 0 FAIL — aucune citation morte, injection éprouvée dans les trois sens.`);
