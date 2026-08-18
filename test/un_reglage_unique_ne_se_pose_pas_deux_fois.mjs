#!/usr/bin/env node
/**
 * GARDE — UN RÉGLAGE QUI NE SE POSE QU'UNE FOIS NE SE POSE PAS DEUX, ET LE GROUPE EST DANS LA DONNÉE.
 *
 * LE MOTEUR NATIF tient deux compteurs (`CompileGrammar.c:1535-1551`) et refuse par `return(7)` —
 * la grammaire ENTIÈRE ne compile pas, ce n'est pas un avertissement :
 *   · `NotFoundMetronom`   → `_mm` seul.
 *   · `NotFoundNatureTime` → `_striated` ET `_smooth`, qui tombent dans le MÊME `case` par
 *     fall-through. Un `_striated` suivi d'un `_smooth` est donc refusé AUSSI.
 *
 * ⚠️ C'EST POURQUOI LA DONNÉE NOMME UN GROUPE ET NON UN BOOLÉEN, et ce garde existe surtout pour
 * ça. Un `unique:true` par mot aurait laissé passer `@striated` puis `@smooth` — deux mots
 * différents, un seul réglage : la nature du temps, qu'on ne règle pas deux fois.
 *
 * ⚠️ ET MON SIGNALEMENT D'ORIGINE ÉTAIT PLUS ÉTROIT QUE L'ÉCART. Je l'avais décrit comme portant
 * sur DEUX mots (`striated`, `smooth`) et les donnais pour indépendants. bp3-frontend est allé lire
 * le C au lieu de porter ma clame : il y a TROIS mots — `_mm` a le sien —, et les deux autres
 * PARTAGENT leur compteur. J'avais ce code sous les yeux : ma fenêtre de lecture commençait trois
 * lignes sous le refus de `_mm`. Une fenêtre tronquée coupe la cause, exactement comme un motif
 * compte sans lire.
 *
 * LA MATRICE — le même groupe atteint par TOUTES ses positions, et son complément :
 *   la tête de scène · les modificateurs de sous-grammaire · les deux CROISÉS, qui sont le cas
 *   qu'un compteur par section raterait.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { groupeDUnicite } from '../src/transpiler/libs.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const SOCLE = 'core\nalphabet.western\n';
const err = (src) => {
  try { return (compileToBPxAST(SOCLE + src).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};

// ── 1. SOCLE — la donnée porte les groupes, sinon tout le reste est vide de sens ─────────────
{
  const attendus = [['tempo', 'metronome'],
                    ['striated', 'nature-du-temps'], ['smooth', 'nature-du-temps']];
  for (const [mot, groupe] of attendus) {
    ok(groupeDUnicite(mot) === groupe,
       `1. SOCLE — '${mot}' doit déclarer le groupe '${groupe}' ; reçu '${groupeDUnicite(mot)}'`);
  }
  // ⚠️ LE COMPLÉMENT : un mot ORDINAIRE ne porte aucun groupe. Sans lui, un lecteur qui rendrait
  // le même groupe pour tout ferait passer la section 2 pour la mauvaise raison.
  ok(groupeDUnicite('seed') === null && groupeDUnicite('destru') === null,
     `1. SOCLE — un réglage ordinaire ne porte AUCUN groupe (reçu seed='${groupeDUnicite('seed')}', `
     + `destru='${groupeDUnicite('destru')}')`);
}

// ── 2. LE MÊME GROUPE, DEUX FOIS, PAR TOUTES SES PORTES ──────────────────────────────────────
const DOUBLONS = [
  ['le même mot deux fois en tête',        'tempo:120\ntempo:90\n-----\nS -> C4',          'metronome'],
  ['deux mots du MÊME groupe',             'striated\nsmooth\n-----\nS -> C4',             'nature-du-temps'],
  ['le même mot deux fois, nature',        'striated\nstriated\n-----\nS -> C4',           'nature-du-temps'],
  ['CROISÉ — tête + sous-grammaire',       'striated\nmode:ord(smooth)\n-----\nS -> C4',   'nature-du-temps'],
  // ⚠️ CE CAS A CHANGÉ DE FORME, PAS D'OBJET (2026-08-18). Il croisait deux MOTS du même groupe —
  // `tempo` en tête et `mm` sur la sous-grammaire. `mm` est sorti du langage : le métronome porte
  // un seul nom, et il s'écrit aux DEUX places. Le croisement mesuré est donc désormais celui des
  // deux POSITIONS d'un même mot, qui est exactement ce que le compteur par section raterait.
  ['CROISÉ — tête + sous-grammaire, métronome', 'tempo:120\nmode:ord(tempo:90)\n-----\nS -> C4', 'metronome'],
];
console.log(`[réglage unique] ${DOUBLONS.length} doublons x toutes leurs portes + le complément`);
for (const [quoi, src, groupe] of DOUBLONS) {
  const e = err(src);
  ok(e.length >= 1, `2. '${quoi}' doit être REFUSÉ`);
  ok(e.some((m) => m.includes(`'${groupe}'`)),
     `2. '${quoi}' — le refus doit NOMMER le groupe ('${groupe}'), pas seulement le mot ; reçu : ${e[0]}`);
}
// ⚠️ LES DEUX CROISÉS SONT LE CŒUR : un compteur par SECTION (les directives d'un côté, les
// modificateurs de l'autre) serait vert sur les trois premiers et muet sur ceux-là.
ok(err('striated\nmode:ord(smooth)\n-----\nS -> C4').length >= 1
   && err('tempo:120\nmode:ord(tempo:90)\n-----\nS -> C4').length >= 1,
   '2. les deux CROISÉS mordent — le compte est global à la scène, pas par section');

// ── 3. LE COMPLÉMENT — une fois, c'est permis ────────────────────────────────────────────────
// Sans cette moitié, une règle qui refuserait TOUTE occurrence aurait l'air juste ci-dessus.
const JUSTES = [
  ['le métronome, une fois',        'tempo:120\n-----\nS -> C4'],
  ['la nature du temps, une fois',  'striated\n-----\nS -> C4'],
  ['deux groupes DIFFÉRENTS',       'tempo:120\nstriated\n-----\nS -> C4'],
  ['sur la sous-grammaire seule',   'mode:ord(striated)\n-----\nS -> C4'],
  ['un réglage sans groupe, libre', 'seed:42\n-----\nS -> C4'],
];
for (const [quoi, src] of JUSTES) {
  const e = err(src);
  ok(e.length === 0, `3. '${quoi}' doit PASSER — reçu : ${e[0]}`);
}

// ── 4. TÉMOIN D'INSTRUMENT ───────────────────────────────────────────────────────────────────
ok(DOUBLONS.length >= 5 && JUSTES.length >= 5,
   `4. la matrice ne s'est pas vidée — ${DOUBLONS.length} refus, ${JUSTES.length} passages`);
// Le même flux, à un mot près, distingué : sans ce témoin un compilateur devenu permissif OU
// devenu strict rendrait ce fichier vert par un seul côté.
ok(err('striated\n-----\nS -> C4').length === 0 && err('striated\nsmooth\n-----\nS -> C4').length >= 1,
   '4. TÉMOIN — le compilateur distingue UNE occurrence de DEUX sur le même groupe');

if (echecs.length) {
  console.error(`[réglage unique] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[réglage unique] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
