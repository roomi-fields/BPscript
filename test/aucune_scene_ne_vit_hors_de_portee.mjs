#!/usr/bin/env node
/**
 * GARDE — AUCUNE SCÈNE NE VIT HORS DE PORTÉE.
 *
 * ⚠️ CE QU'IL EXISTE POUR PARER, ET LE DÉFAUT EST MUET. Un garde a une PORTÉE, et ce qui est
 * dehors SURVIT — y compris à une campagne qui croit avoir tout fermé. Payé le 2026-07-29 : la
 * migration de la forme des voix de code a couvert les 52 scènes de la bibliothèque, et les CINQ
 * démos de ce dépôt sont restées en arrière, CASSÉES, pendant deux jours. Rien n'a rougi. Je les
 * ai trouvées par hasard, en cherchant autre chose.
 *
 * LA CAUSE N'EST PAS UN OUBLI, C'EST UNE PORTÉE : `toutesLesScenes()` lit la bibliothèque de
 * Kanopi, et rien d'autre. Les 61 scènes de `public/` de ce dépôt n'étaient dans AUCUNE liste.
 * Une vérification ne peut pas attraper ce qu'elle ne regarde pas — et elle ne le DIT pas non
 * plus : son silence ressemble exactement à un succès.
 *
 * LE GESTE : comparer l'ESPACE des scènes qui EXISTENT à l'ESPACE des scènes VÉRIFIÉES, et
 * refuser tout écart qui n'est pas inscrit ici, nommé, daté, motivé. C'est la mécanisation d'une
 * règle qui, sans elle, demanderait d'y penser au bon moment — donc une intention, pas une règle
 * (critère de l'architecte, 2026-07-27).
 *
 * ⚠️ ET IL VÉRIFIE LES DEUX SENS. Une dérogation dont plus AUCUN fichier ne relève est un trou,
 * pas une tolérance : le garde la refuse aussi. Une porte ouverte pour personne s'enlève.
 */
import { readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { LIBRARY, toutesLesScenes } from './corpus.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const DEPOT = path.resolve(ICI, '..');

/**
 * LE REGISTRE DES DÉROGATIONS. Chaque entrée dit QUI, DEPUIS QUAND et POURQUOI. Sans motif écrit,
 * une exclusion devient un trou que personne ne rouvre.
 */
const HORS_PORTEE_ASSUME = [];
// ⛔ LA DÉROGATION `_archive/` EST RETIRÉE LE 2026-08-16 — elle n'a plus AUCUN bénéficiaire.
// Elle couvrait les 58 démos de `_archive/web/demos/`, supprimées le jour même sur arbitrage de
// Romain : un fichier ignoré par git reste INDEXÉ et LU, et 53 des 58 différaient de leur homonyme
// suivi, donc l'archive enseignait une seconde graphie pendant une migration.
// ⚠️ C'EST MON PROPRE GESTE QUI L'A VIDÉE, et ce garde me l'a dit dans la minute. Le registre est
// donc vide, et c'est l'état juste : « une porte ouverte pour personne n'est pas une tolérance,
// c'est un trou par lequel la prochaine famille entrera sans bruit » — sa phrase, écrite le jour de
// sa naissance quand il a mordu sur son auteur. Il vient de mordre une troisième fois, sur moi.
// Ce qu'a emporté la suppression est consigné dans `docs/archive/58-demos-archivees-supprimees.md`.
// ⚠️ DEUX DÉROGATIONS ONT ÉTÉ RETIRÉES LE JOUR MÊME OÙ CE GARDE A ÉTÉ ÉCRIT — instantanés de
// mesure et dépendances installées. Je les avais posées par prudence ; le garde a mesuré qu'AUCUN
// fichier n'en relevait et a refusé de les laisser. C'est son second sens, et il a mordu sur son
// propre auteur au premier passage : une porte ouverte pour personne n'est pas une tolérance,
// c'est un trou par lequel la prochaine famille entrera sans bruit.

/** Tous les `.bps` d'une racine, chemins relatifs à elle. */
function scenesSous(racine) {
  if (!existsSync(racine)) return [];
  const out = [];
  const marcher = (dir, prefixe) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) marcher(p, `${prefixe}${e.name}/`);
      else if (e.name.endsWith('.bps')) out.push(`${prefixe}${e.name}`);
    }
  };
  marcher(racine, '');
  return out.sort();
}

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── L'ESPACE RÉEL : tout ce qui existe, des deux côtés de la frontière ────────
const RACINES = [
  ['bibliothèque', path.join(LIBRARY, 'scenes')],
  ['ce dépôt', DEPOT],
];
const reel = [];
for (const [ou, racine] of RACINES) for (const s of scenesSous(racine)) reel.push({ ou, chemin: s });

// ── SOCLE : un garde qui n'examine rien ne prouve rien ────────────────────────
ok(reel.length > 0, 'SOCLE — au moins une scène doit exister(sinon ce garde ne prouve rien)');
for (const [ou, racine] of RACINES) {
  ok(scenesSous(racine).length > 0, `SOCLE — ${ou} (${racine}) doit contenir des scènes`);
}

// ── L'ESPACE VÉRIFIÉ : ce que les gardes lisent réellement ────────────────────
const verifie = new Set(toutesLesScenes().map(([nom]) => nom));
ok(verifie.size > 0, 'SOCLE — le corpus vérifié ne doit pas être vide');

// ── L'ÉCART, et le registre qui l'explique ───────────────────────────────────
const derogeePar = (chemin) => HORS_PORTEE_ASSUME.find((d) => d.motif.test(chemin));
const orphelines = [];
const derogees = new Map();
for (const { ou, chemin } of reel) {
  if (verifie.has(chemin)) continue;
  const d = derogeePar(chemin);
  if (d) { derogees.set(d, (derogees.get(d) || 0) + 1); continue; }
  orphelines.push(`${ou} : ${chemin}`);
}

ok(orphelines.length === 0,
  `${orphelines.length} scène(s) EXISTENT sans être vérifiées par aucun garde :\n`
  + orphelines.map((o) => `      ${o}`).join('\n')
  + '\n      → soit les faire entrer dans le corpus vérifié, soit inscrire une dérogation'
  + ' NOMMÉE, DATÉE et MOTIVÉE dans ce fichier.');

// ── L'AUTRE SENS : une dérogation sans bénéficiaire est un trou, pas une tolérance ──
for (const d of HORS_PORTEE_ASSUME) {
  ok((derogees.get(d) || 0) > 0,
    `DÉROGATION SANS BÉNÉFICIAIRE (${d.motif}, depuis ${d.depuis}) : plus AUCUNE scène n'en `
    + 'relève. Une porte ouverte pour personne s\'enlève — la retirer de ce fichier.');
}

// ── TÉMOIN ANTI-RÉTRÉCISSEMENT ───────────────────────────────────────────────
ok(RACINES.length >= 2, 'TÉMOIN — la portée couvre TOUJOURS les deux côtés(bibliothèque ET dépôt)');
ok(HORS_PORTEE_ASSUME.every((d) => d.depuis && d.pourquoi && d.pourquoi.length > 40),
  'TÉMOIN — chaque dérogation porte sa date ET son motif écrit');

if (echecs.length) {
  console.error(`[portée des scènes] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[portée des scènes] ${reel.length} scène(s) existent · ${verifie.size} vérifiée(s) · `
  + `${[...derogees.values()].reduce((a, b) => a + b, 0)} hors portée ASSUMÉE(${HORS_PORTEE_ASSUME.length} motifs)`);
console.log(`[portée des scènes] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
