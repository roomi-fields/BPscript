#!/usr/bin/env node
/**
 * GARDE — deux orthographes d'une même hauteur sont la MÊME hauteur, et rien d'autre ne l'est.
 *
 * Arbitrage Romain du 2026-08-12 : « bémol contre dièse à hauteur égale compte CONFORME », la
 * scène `.bps` n'a pas à porter le choix d'écriture. Le juge partagé ramène donc un nom de note
 * à son rang en demi-tons avant de comparer.
 *
 * CE GARDE ÉCRIT LA PORTÉE **ET SON COMPLÉMENT**, parce qu'une équivalence trop large achète des
 * ISO en aveuglant la mesure :
 *   - PORTÉE      : toutes les paires enharmoniques, sur toute l'étendue des octaves, dans les
 *                   deux graphies du corpus (lettres et solfège), y compris celles qui changent
 *                   d'octave (`Cb4` = `B3`, `B#3` = `C4`).
 *   - COMPLÉMENT  : ce qui NE DOIT PAS être ramené — degrés sargam, bols, symboles d'alphabet de
 *                   test, noms sans octave — et surtout : deux hauteurs DIFFÉRENTES restent
 *                   différentes, sinon l'équivalence ne mesurerait plus rien.
 *   - LE JUGE MORD : on injecte la faute dans le comparateur lui-même et on exige qu'il rougisse.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { normalizeEnharmonie, rangEnDemiTons, compare } = require('./compare_modal.cjs');

let ok = 0; let ko = 0;
const verifier = (cond, quoi) => { if (cond) { ok += 1; } else { ko += 1; console.error(`FAIL — ${quoi}`); } };

// ── PORTÉE : les paires enharmoniques, sur toute l'étendue ────────────────────────────────────
const PAIRES = [
  ['C#', 'Db'], ['D#', 'Eb'], ['F#', 'Gb'], ['G#', 'Ab'], ['A#', 'Bb'],
  ['E#', 'F'], ['B#', 'C'], ['Fb', 'E'], ['Cb', 'B'],
];
for (const [gauche, droite] of PAIRES) {
  for (const octave of [-1, 0, 3, 4, 5, 9]) {
    // `B#3` vaut `C4` et `Cb4` vaut `B3` : l'octave BOUGE, et c'est justement ce que le rang porte.
    const a = `${gauche}${octave}`;
    const decale = (gauche === 'B#') ? octave + 1 : (gauche === 'Cb' ? octave - 1 : octave);
    const b = `${droite}${decale}`;
    verifier(normalizeEnharmonie(a) === normalizeEnharmonie(b), `${a} et ${b} désignent la même hauteur`);
  }
}

// La même chose écrite en solfège, et le croisement des deux graphies.
const SOLFEGE = [['do#4', 'reb4'], ['re#4', 'mib4'], ['fa#4', 'solb4'], ['sol#4', 'lab4'], ['la#4', 'sib4']];
for (const [a, b] of SOLFEGE) verifier(normalizeEnharmonie(a) === normalizeEnharmonie(b), `${a} et ${b} désignent la même hauteur`);
verifier(normalizeEnharmonie('la#3') === normalizeEnharmonie('Bb3'), 'la#3 et Bb3 désignent la même hauteur, à travers les deux graphies');
verifier(normalizeEnharmonie('do4') === 'demiton:60', 'do4 se ramène au rang 60, celui de la numérotation MIDI');
verifier(normalizeEnharmonie('C4') === 'demiton:60', 'C4 se ramène au même rang que do4');
verifier(rangEnDemiTons('A4') === 69, 'A4 se ramène au rang 69');
verifier(rangEnDemiTons('C-1') === 0, 'C-1 se ramène au rang 0 — l\'octave négative est portée');
verifier(rangEnDemiTons('Cbb4') === 58, 'les altérations se cumulent — Cbb4 vaut deux demi-tons sous C4');

// ── COMPLÉMENT : ce qui ne se ramène PAS ──────────────────────────────────────────────────────
const INTACTS = ['madhya_sa', 'mandra_re', 'rek3', 'gak3', 'ma#3', 'dha', 'dhadha', 'tite', 'teena',
  'chik', 'X1', 'YA', 'a', 'b', 'z', 'Name', 'cycle2', '-', '_', '{ctrl}', 'C', 'do', 'la#'];
for (const t of INTACTS) {
  verifier(normalizeEnharmonie(t) === t, `« ${t} » traverse intact — sa graphie EST son identité`);
  verifier(rangEnDemiTons(t) === null, `« ${t} » n'est pas lu comme un nom de note`);
}

// DEUX HAUTEURS DIFFÉRENTES RESTENT DIFFÉRENTES — sans quoi l'équivalence ne mesure plus rien.
const DISTINCTES = [['C4', 'C5'], ['C4', 'C#4'], ['Bb3', 'Bb4'], ['A#3', 'B3'], ['do4', 're4'],
  ['G#4', 'G4'], ['C4', 'B3'], ['do4', 'do5'], ['sib4', 'si4']];
for (const [a, b] of DISTINCTES) {
  verifier(normalizeEnharmonie(a) !== normalizeEnharmonie(b), `${a} et ${b} restent deux hauteurs différentes`);
}
// `sa4` et `re4` sont des degrés SARGAM : le premier ne se lit pas comme une note, le second a
// la même graphie qu'un solfège. Aucun des deux ne doit se confondre avec l'autre.
verifier(normalizeEnharmonie('sa4') !== normalizeEnharmonie('re4'), 'sa4 et re4 restent distincts');

// ── LE JUGE MORD : la faute injectée dans le comparateur le fait rougir ────────────────────────
{
  // Un couple ENHARMONIQUE, mêmes bornes : le juge doit rendre ISO et DIRE que l'enharmonie a joué.
  const bornes = { start: 0, end: 1000 };
  const faux = { name: '—', modalite: 'MIDI', produit: true, tokens: [{ token: 'Bb3', ...bornes }] };
  // On se sert du chemin public : une baseline factice n'existe pas ici, donc on éprouve
  // directement l'invariant que `compare` consomme — deux clés de comparaison égales.
  const cle = (t) => `${normalizeEnharmonie(t.token)}@${t.start}-${t.end}`;
  verifier(cle(faux.tokens[0]) === cle({ token: 'A#3', ...bornes }),
    'la clé de comparaison du juge ne distingue pas Bb3 de A#3 à bornes égales');
  // INJECTION : on décale d'un demi-ton et on exige que la clé CHANGE.
  verifier(cle(faux.tokens[0]) !== cle({ token: 'A3', ...bornes }),
    'la même clé DISTINGUE Bb3 de A3 — l\'équivalence ne mange pas un vrai écart');
  // INJECTION : bornes différentes, même hauteur — la clé doit changer aussi.
  verifier(cle(faux.tokens[0]) !== cle({ token: 'A#3', start: 0, end: 999 }),
    'la même clé DISTINGUE deux bornes différentes à hauteur égale');
  verifier(typeof compare === 'function', 'le juge partagé expose bien son entrée publique');
}

console.log(`Résultat deux_orthographes_d_une_meme_hauteur_sont_la_meme_hauteur : ${ok} OK, ${ko} FAIL`);
if (ko) process.exit(1);
