#!/usr/bin/env node
/**
 * GARDE — UN INSTANTANÉ NATIF SE CITE : version, empreinte du binaire, ET COMMANDE COMPLÈTE.
 *
 * RÈGLE DU PROPRIÉTAIRE DE L'ORACLE (bp3-engine, `ORACLE-BINAIRE.md`, étendue aux instantanés le
 * 2026-08-10) : tout artefact de référence natif se cite ainsi. Ce garde ne l'invente pas, il la
 * mesure chez moi.
 *
 * ⚠️ CE QU'UN INSTANTANÉ SANS BINAIRE NOMMÉ NE PEUT PAS FAIRE : rougir sur un changement de moteur.
 * Il dérive en silence — sa valeur change de sens sans que rien ne le dise. C'est le mode d'échec
 * muet, celui qu'aucune comparaison ne signale parce que les deux côtés restent lisibles.
 *
 * ⚠️ ET LA COMMANDE EST DÉTERMINANTE, PAS ACCESSOIRE. Mesuré le 2026-08-10 sur `koto3`, graine 1,
 * binaire b100125b : à PRODUCTION IDENTIQUE — mêmes 20 items, fichier texte octet pour octet
 * identique — 28 % des événements se placent à un instant DIFFÉRENT selon les sorties demandées, et
 * la fin totale passe de 15862 à 17648. Deux instantanés du même binaire produits par deux
 * commandes différentes ne sont donc pas comparables, et l'écart se lirait comme une régression.
 *
 * ⚠️ CE GARDE NE RÉCLAME RIEN AUX 106 EXISTANTS, ET C'EST UNE DÉCISION, PAS UNE TOLÉRANCE. On ne
 * sait pas quelle commande les a produits ; l'écrire serait FABRIQUER la donnée qui manque — la
 * faute exacte que l'estampille existe pour empêcher. Ils portent une date, ils gardent leur date.
 * Ce garde les COMPTE : un chiffre qui descend vaut mieux qu'un trou muet, et il descendra tout
 * seul à mesure que les captures neuves remplacent les anciennes.
 *
 * ⛔ ET LA RÉGÉNÉRATION N'EST PAS À MOI CE MATIN : le minutage natif dépend encore de la commande
 * (Bernard corrige), et BPx construit un capteur d'invocation. Régénérer figerait un minutage
 * instable et croiserait son chantier. Ce garde mesure l'état ; il ne le force pas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GRAMMARS = path.join(ROOT, 'test', 'grammars');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const instantanes = [];
if (fs.existsSync(GRAMMARS)) {
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.includes(`${path.sep}snapshots${path.sep}`) && e.name.endsWith('.json')) instantanes.push(p);
    }
  })(GRAMMARS);
}

// SOCLE — un balayage qui ne trouve rien passerait au vert sans avoir rien examiné.
ok(instantanes.length >= 100,
  `le corpus d'instantanés s'est vidé : ${instantanes.length} trouvé(s), attendu ≥ 100`);

const CHAMPS = ['engineVersion', 'engineMd5', 'command'];
let qualifies = 0;
const nonQualifies = [];
const partiels = [];

for (const p of instantanes) {
  let j;
  try { j = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { ok(false, `'${path.relative(ROOT, p)}' est illisible — un oracle qui ne se parse pas ne mesure rien`); continue; }
  const presents = CHAMPS.filter((c) => j[c] !== undefined && j[c] !== null);
  if (presents.length === CHAMPS.length) qualifies++;
  else if (presents.length === 0) nonQualifies.push(path.relative(ROOT, p));
  // ⚠️ LE CAS PARTIEL EST LE SEUL QUI ÉCHOUE. Un instantané tout nu est l'héritage, connu et
  // compté ; un instantané qui porte DEUX champs sur trois est une capture NEUVE dont l'estampille
  // s'est écrite à moitié — donc un défaut du producteur, pas de l'histoire.
  else partiels.push(`${path.relative(ROOT, p)} → il manque ${CHAMPS.filter((c) => !presents.includes(c)).join(', ')}`);
}

for (const p of partiels) {
  ok(false, `ESTAMPILLE À MOITIÉ ÉCRITE : ${p}. Une capture neuve porte les trois champs ou aucun — `
    + `deux sur trois signale un producteur qui a perdu une pièce en chemin.`);
}

// LE COMPTE — il n'échoue pas, il RENSEIGNE. C'est la dette d'héritage, et elle est nommée.
console.log(`[instantané natif] ${instantanes.length} instantané(s) — ${qualifies} qualifié(s) `
  + `(version + md5 + commande), ${nonQualifies.length} hérité(s) sans estampille`);

// TÉMOIN D'INSTRUMENT : sans lui, un garde qui ne saurait plus lire un champ compterait tout le
// monde « qualifié » et rendrait vert pour la pire des raisons.
{
  const faux = { engineVersion: '3.5.1', engineMd5: 'b100125b', command: null };
  const presents = CHAMPS.filter((c) => faux[c] !== undefined && faux[c] !== null);
  ok(presents.length === 2,
    `TÉMOIN — une estampille sans commande doit être vue comme INCOMPLÈTE (reçu ${presents.length}/3 champs)`);
}
// TÉMOIN INVERSE : une estampille complète doit être reconnue, sinon le garde ne verra jamais
// aucune capture neuve et son compte restera à zéro pour une raison qui n'est pas la bonne.
{
  const vrai = { engineVersion: '3.5.1', engineMd5: 'b100125b660287ea3cb0ce3eb9fb23f9', command: 'bash guard bp3 -gr x -o' };
  ok(CHAMPS.every((c) => vrai[c] !== undefined && vrai[c] !== null),
    'TÉMOIN — une estampille complète doit être reconnue comme qualifiée');
}

if (echecs.length) {
  console.error(`[instantané natif] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[instantané natif] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
