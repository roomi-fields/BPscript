/**
 * Validation DATA de la formule d'altération (2A, Romain 2026-07-17) — l'altération se CALCULE
 * PAR FORMULE depuis la grille du tempérament, PAS par ratio fixe (#=25/24) ni table de lookup.
 *
 * FORMULE (indexation de la grille par degré + offset d'altération) :
 *   step        = tuning.degrees[noteIdx] + alphabet.alterations[alt]      (offset ENTIER, pas de grille)
 *   octaveShift = floor(step / divisions)
 *   gridStep    = ((step mod divisions) + divisions) mod divisions
 *   ratio       = temperament.ratios[gridStep] * period_ratio ** octaveShift
 *
 * Ce banc PROUVE que la DATA bpscript (lib/*.json) suffit à la formule et donne les bonnes valeurs —
 * il n'EST PAS le résolveur (rôle Kairos, PORTER≠RÉSOUDRE) : c'est un oracle de référence + un garde
 * anti-régression sur la grille. La résolution hz réelle (et sa preuve e2e) vit chez Kairos.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const lib = (f) => JSON.parse(readFileSync(join(__dirname, '../lib', f), 'utf-8'));
const alphabets = lib('alphabets.json');
const tunings = lib('tunings.json');
const temperaments = lib('temperaments.json');

// Ratio "num/den" | nombre | "Nc" (cents) → nombre décimal.
function toNum(r) {
  if (typeof r === 'number') return r;
  if (typeof r === 'string') {
    if (r.endsWith('c')) return 2 ** (parseFloat(r) / 1200);
    if (r.includes('/')) { const [n, d] = r.split('/').map(Number); return n / d; }
    return parseFloat(r);
  }
  return NaN;
}

/** Applique la FORMULE : (tuningKey, noteName, alt) → ratio décimal, depuis la seule DATA lib. */
function alteredRatio(tuningKey, noteName, alt) {
  const tuning = tunings[tuningKey];
  const alphabet = alphabets[tuning.alphabet];
  const temperament = temperaments[tuning.temperament];
  const noteIdx = alphabet.notes.indexOf(noteName);
  if (noteIdx < 0) throw new Error(`note ${noteName} absente de ${tuning.alphabet}`);
  const offset = alt === '' ? 0 : alphabet.alterations[alt];
  if (offset === undefined) throw new Error(`altération ${alt} absente de ${tuning.alphabet}`);
  const divisions = temperament.divisions;
  const ratios = temperament.ratios.map(toNum);
  const period = toNum(temperament.period_ratio ?? 2);
  const step = tuning.degrees[noteIdx] + offset;
  const octaveShift = Math.floor(step / divisions);
  const gridStep = ((step % divisions) + divisions) % divisions;
  return ratios[gridStep] * period ** octaveShift;
}

let pass = 0, fail = 0;
const approx = (a, b) => Math.abs(a - b) < 1e-9;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  OK   ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };

console.log('=== Formule d\'altération — CALCULÉE depuis la grille, pas de ratio fixe ===');

// JUSTE — le cas de Romain : Db doit valoir 16/15 (calculé), PAS 27/25 (dérivé du fixe #=25/24).
ok(approx(alteredRatio('western_just', 'D', 'b'), 16 / 15), 'western_just Db = 16/15 (D degré 2, b −1 → grille[1]) — CALCULÉ');
ok(approx(alteredRatio('western_just', 'C', '#'), 16 / 15), 'western_just C# = 16/15 (C degré 0, # +1 → grille[1]) = Db (modèle 12-clés, flat Bernard)');
ok(approx(alteredRatio('western_just', 'C', ''), 1), 'western_just C = 1/1 (degré 0, sans altération)');
ok(approx(alteredRatio('western_just', 'E', 'b'), 6 / 5), 'western_just Eb = 6/5 (E degré 4, b −1 → grille[3])');
ok(!approx(alteredRatio('western_just', 'D', 'b'), 27 / 25), 'western_just Db ≠ 27/25 (l\'ancien ratio fixe dérivé est écarté)');

// ÉGAL (12TET) — inchangé : la grille donne 2^(k/12), = ce que le ratio fixe (±100c) donnait.
ok(approx(alteredRatio('western_12TET', 'D', 'b'), 2 ** (1 / 12)), 'western_12TET Db = 2^(1/12) = 100c (inchangé)');
ok(approx(alteredRatio('western_12TET', 'C', '#'), 2 ** (1 / 12)), 'western_12TET C# = 2^(1/12) = 100c (inchangé)');

// SARGAM juste — komal/tivra en offsets (−1/+1), même formule.
ok(approx(alteredRatio('western_just', 'B', '#'), 2), 'western_just B# = 2/1 (B degré 11, # +1 → step 12 → octave, grille[0]×2) — wrap d\'octave');

console.log(`\n--- Formule d'altération : ${pass} OK, ${fail} FAIL ---`);
process.exit(fail ? 1 : 0);
