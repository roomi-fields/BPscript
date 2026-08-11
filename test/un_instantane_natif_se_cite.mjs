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
 * ⚠️ CE GARDE NE RÉCLAME RIEN AUX HÉRITÉS, ET C'EST UNE DÉCISION, PAS UNE TOLÉRANCE. On ne sait
 * pas quelle commande les a produits ; l'écrire serait FABRIQUER la donnée qui manque — la faute
 * exacte que l'estampille existe pour empêcher. Ils portent une date, ils gardent leur date.
 * Ce garde les COMPTE : un chiffre qui descend vaut mieux qu'un trou muet, et il descendra tout
 * seul à mesure que les captures neuves remplacent les anciennes.
 *
 * ⚠️ ET ILS LE DISENT MAINTENANT AU LIEU DE SE TAIRE. Le bloc `conditions_de_mesure`, dicté par
 * bp3-engine le 2026-08-11 après la décision de Romain sur les conditions de mesure, porte le
 * trou CHAMP PAR CHAMP en `null` et déclare `qualifie: false`. Le garde le LIT au lieu de déduire
 * l'absence : un instantané qui dit « aucune autorité » ne se confond plus avec un instantané qui
 * n'a jamais eu de format pour le dire.
 *
 * ⛔ UNE CONDITION VIDE EST AUSSI FAUSSE QU'UNE CONDITION ABSENTE, et c'est la leçon payée par
 * bp3-frontend le 2026-08-11 : son premier jet remplissait le champ du commit avec `null` sur ses
 * 26 références, parce que le chemin donné à git était le nom NU du fichier. Le champ existait, il
 * était écrit, il ne portait rien — ET RIEN N'A ROUGI. Ce garde refuse donc aussi la CHAÎNE VIDE
 * et la chaîne d'espaces, pas seulement `undefined`/`null` ; et il s'éprouve sur ces valeurs-là,
 * pas seulement sur un champ manquant.
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
// Plancher 50 depuis le retrait du WASM (2026-08-11) : les 50 `s3_timed` sont sortis avec le
// portage qu'ils mesuraient, le corpus passe de 106 à 56. Un plancher laissé à 100 aurait rougi
// pour un geste voulu, et se serait fait baisser sans qu'on regarde — il descend AVEC sa cause.
ok(instantanes.length >= 50,
  `le corpus d'instantanés s'est vidé : ${instantanes.length} trouvé(s), attendu ≥ 50`);

const CHAMPS = ['engineVersion', 'engineMd5', 'command'];
/** ⚠️ UNE CHAÎNE VIDE OU BLANCHE N'EST PAS UNE CONDITION — cf. l'en-tête, défaut bp3-frontend. */
const porte = (v) => v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
let qualifies = 0;
const nonQualifies = [];
const partiels = [];
let disentLeurTrou = 0;

for (const p of instantanes) {
  let j;
  try { j = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { ok(false, `'${path.relative(ROOT, p)}' est illisible — un oracle qui ne se parse pas ne mesure rien`); continue; }
  // Le bloc DICTÉ par le producteur des références natives : il déclare le trou au lieu de le
  // laisser deviner. On le compte pour pouvoir exiger, plus bas, que tout non-qualifié le porte.
  const bloc = j.conditions_de_mesure;
  if (bloc && bloc.qualifie === false) disentLeurTrou++;
  const presents = CHAMPS.filter((c) => porte(j[c]));
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

// ⛔ UN NON-QUALIFIÉ DIT SON TROU, SINON IL EST MUET. C'est la moitié qui ÉCHOUE : le compte
// ci-dessous renseigne, celle-ci exige. Un instantané sans estampille ET sans bloc ne se distingue
// pas d'un fichier qu'on aurait oublié de qualifier.
ok(disentLeurTrou === nonQualifies.length,
  `${nonQualifies.length} instantané(s) sans estampille, dont ${disentLeurTrou} seulement déclarent `
  + `leur trou par 'conditions_de_mesure' (qualifie:false). Un instantané muet se lit comme une `
  + `référence ; un instantané qui dit « aucune autorité » ne trompe personne.`);

// LE COMPTE — il n'échoue pas, il RENSEIGNE. C'est la dette d'héritage, et elle est nommée.
console.log(`[instantané natif] ${instantanes.length} instantané(s) — ${qualifies} qualifié(s) `
  + `(version + md5 + commande), ${nonQualifies.length} hérité(s) sans estampille, `
  + `${disentLeurTrou} déclarant leur trou`);

// ── TÉMOINS D'INSTRUMENT ──────────────────────────────────────────────────────────────────────
// Sans eux, un garde qui ne saurait plus lire un champ compterait tout le monde « qualifié » et
// rendrait vert pour la pire des raisons. LA MATRICE couvre les trois façons de ne rien porter —
// absent, nul, VIDE — et son complément, la valeur qui porte vraiment.
{
  const CREUX = [
    ['absent', { engineVersion: '3.5.1', engineMd5: 'b100125b' }],
    ['nul', { engineVersion: '3.5.1', engineMd5: 'b100125b', command: null }],
    ['chaîne VIDE', { engineVersion: '3.5.1', engineMd5: 'b100125b', command: '' }],
    ['chaîne BLANCHE', { engineVersion: '3.5.1', engineMd5: 'b100125b', command: '   ' }],
  ];
  for (const [quoi, faux] of CREUX) {
    ok(CHAMPS.filter((c) => porte(faux[c])).length === 2,
      `TÉMOIN — une commande ${quoi} doit rendre l'estampille INCOMPLÈTE. C'est par la chaîne vide `
      + `que le défaut est passé chez bp3-frontend : le champ écrit, et rien dedans.`);
  }
  const vrai = { engineVersion: '3.5.1', engineMd5: 'b100125b660287ea3cb0ce3eb9fb23f9', command: 'bash guard bp3 -gr x -o' };
  ok(CHAMPS.every((c) => porte(vrai[c])),
    'TÉMOIN INVERSE — une estampille complète doit être reconnue, sinon le compte reste à zéro '
    + 'pour une raison qui n\'est pas la bonne');
}

if (echecs.length) {
  console.error(`[instantané natif] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[instantané natif] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
