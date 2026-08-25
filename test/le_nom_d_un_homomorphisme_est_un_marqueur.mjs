#!/usr/bin/env node
/**
 * LE NOM D'UN HOMOMORPHISME SE POSE DANS LE FLUX — ce n'est pas une note.
 *
 * `LANGUAGE.md` §« Les tables d'homomorphisme » : « Elle s'applique entre un gabarit maître et son
 * esclave, dont le NOM SE POSE ENTRE LES DEUX » — `S -> $N14 dhati &N14`. Ce nom dit quelle table
 * transforme le rejeu ; il était refusé comme « terminal non déclaré ».
 *
 * ⚠️ IL Y AVAIT DÉJÀ UNE BRANCHE POUR ÇA, ET ELLE ÉTAIT MORTE. Le contrôle du vocabulaire testait
 * `el.role !== 'homomorphism'` et **rien ne posait jamais ce rôle**. C'est le DEUXIÈME correctif
 * entièrement rédigé et jamais branché trouvé le 2026-08-07, après `isEndOfRhs()`. Une branche
 * morte ne rougit pas, ne sert pas, et se lit comme une couverture — c'est ce qui la rend plus
 * dangereuse qu'un trou déclaré.
 *
 * ⚠️ DEUX FAMILLES DE NOMS, PAS UNE — et n'en déclarer qu'une aurait laissé l'autre refusée :
 *   · le nom INVOQUÉ, pour une table à section unique : `@homomorphism.dhati` → `dhati` dans le
 *     flux (l'arbre, lui, nomme cette section `*`) ;
 *   · les ÉTIQUETTES de section, pour une table qui en porte plusieurs : `@homomorphism.checkhomo`
 *     déclare `*`, `H`, `TR`, et les règles écrivent `S -> $X * TR &X Y`.
 * C'est la faute « on répare la forme qui s'est montrée » appliquée à un nom : la ligne de la
 * bible n'employait que la première.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const compiler = (src) => {
  try { return compileToBPxAST(src); } catch (e) { return { errors: [{ message: e.message }] }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message || e).join(' | ');

// ── A. LES DEUX FAMILLES DE NOMS SONT DES SYMBOLES LÉGITIMES DU FLUX ──────────────────────────
const DOIVENT_PASSER = [
  // ⚠️ AUCUN DE CES NOMS N'EST UN TERMINAL, ET C'EST LA CONDITION POUR QUE CE VOLET PROUVE
  // QUELQUE CHOSE. Premier jet : j'avais pris `dhati` (la ligne de la bible) et `TR` — tous deux
  // sont des bols de tabla. Le garde était vert AVEC ET SANS le correctif : il mesurait
  // l'alphabet, pas le mécanisme. Trouvé en injectant la faute, jamais en le relisant.
  ['le nom INVOQUÉ, entre maître et esclave',
   'core\nalphabet.tabla\nhomomorphism.tryhomomorphism\n-----\nN14 -> dha\nS -> $N14 tryhomomorphism &N14\n'],
  ['le même nom, posé seul dans le flux',
   'core\nalphabet.tabla\nhomomorphism.tryhomomorphism\n-----\nS -> dha tryhomomorphism dha\n'],
  ['une seconde table, invoquée par son nom',
   'core\nalphabet.tabla\nhomomorphism.transposition\n-----\nS -> dha transposition dha\n'],
  ['deux tables invoquées : les deux noms sont lisibles',
   'core\nalphabet.tabla\nhomomorphism.tryhomomorphism\nhomomorphism.transposition\n-----\n'
   + 'S -> dha tryhomomorphism transposition dha\n'],
];
for (const [quoi, src] of DOIVENT_PASSER) {
  const msg = messages(compiler(src));
  ok(msg === '', `A. ${quoi} — REFUSÉ : ${msg.replace(/\s+/g, ' ').slice(0, 100)}`);
}

// ── B. TÉMOIN QUI MORD — déclarer les noms d'homomorphisme n'ouvre pas la porte à tout ────────
// ⚠️ Sans cette moitié, un correctif qui aurait simplement cessé de vérifier les terminaux
// passerait le volet A en triomphe. C'est elle qui démasque.
const DOIVENT_REFUSER = [
  ['un nom qui n\'est ni une note ni une table',
   'core\nalphabet.tabla\nhomomorphism.dhati\n-----\nN14 -> dha\nS -> $N14 zzz &N14\n'],
  // ⚠️ TÉMOIN CHOISI AVEC SOIN : `dhati` est AUSSI un bol de tabla (41 terminaux), donc une scène
  // qui l'écrit sans invoquer la table compile — et pour une bonne raison, pas par laxisme.
  // Mesurer avec lui aurait accusé le code d'un défaut qu'il n'a pas. Le témoin emploie donc un
  // nom de table qui n'est terminal de rien.
  ['une table NON invoquée par la scène',
   'core\nalphabet.tabla\n-----\nN14 -> dha\nS -> $N14 tryhomomorphism &N14\n'],
  ['une étiquette de section d\'une AUTRE table, non invoquée',
   'core\nalphabet.tabla\nhomomorphism.dhati\n-----\nS -> dha TR dha\n'],
];
for (const [quoi, src] of DOIVENT_REFUSER) {
  const msg = messages(compiler(src));
  ok(/non déclaré|absent des alphabets/.test(msg),
     `B-témoin. ${quoi} — doit être REFUSÉ, et ne l'est plus (${msg.slice(0, 80) || 'aucune erreur'}). `
     + `Déclarer les noms d'une table invoquée ne doit pas déclarer tous les noms du monde.`);
}

// ── SOCLE ─────────────────────────────────────────────────────────────────────────────────────
// ⛔ COMPTE EXACT, PAS UN SEUIL — « refuser zéro n'est pas refuser une baisse » (kairos, 2026-08-25).
// Un seuil calé sur l'existant ne mord qu'au SECOND retrait, avec un message qui parle du premier.
// Ce nombre se met à jour DANS le geste qui ajoute un cas ; c'est ce qui le rend opposable.
ok(DOIVENT_PASSER.length === 4 && DOIVENT_REFUSER.length === 3,
   `SOCLE : les deux sens doivent être peuplés — ${DOIVENT_PASSER.length} qui passent, `
   + `${DOIVENT_REFUSER.length} qui refusent. Une seule famille mesurée laisserait l'autre libre.`);

if (echecs.length) {
  console.error(`❌ le nom d'un homomorphisme : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ le nom d'un homomorphisme se pose dans le flux — ${passe} vérification(s) : `
          + `${DOIVENT_PASSER.length} formes lues (nom invoqué ET étiquettes de section) et `
          + `${DOIVENT_REFUSER.length} refus qui prouvent que le vocabulaire mord encore.`);
