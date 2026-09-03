#!/usr/bin/env node
/**
 * GARDE — l'axe SONNANT compare un ENSEMBLE MINUTE ; l'axe TEXTE compare une SUITE.
 *
 * L'ARBITRAGE QUE CE GARDE TIENT (Romain, 2026-08-12). « Ce dont je veux m'assurer, c'est que les
 * MÊMES NOTES soient produites aux MÊMES INSTANTS avec la MÊME DURÉE. L'ORDRE D'AFFICHAGE N'A
 * AUCUNE IMPORTANCE. » Deux voix simultanées s'écrivent dans un ordre que le producteur choisit ;
 * ce choix ne s'entend pas, donc il ne se compare pas.
 *
 * ⛔ ET SURTOUT CE QU'IL NE RELÂCHE PAS — c'est la moitié du garde, et la plus exposée :
 *   - un INSTANT qui diffère reste une divergence ;
 *   - une DURÉE qui diffère reste une divergence ;
 *   - une NOTE qui diffère reste une divergence ;
 *   - les MULTIPLICITÉS comptent : c'est un multiensemble, jamais un ensemble. Trois `do` contre
 *     deux `do` et un `ré` portent les mêmes éléments et ne sont PAS le même ensemble minute.
 *   - l'axe TEXTE ne bouge pas : là-bas, permuter deux terminaux reste un écart.
 *
 * LE JUGE EST PARTAGÉ avec bp3-frontend : un relâchement de trop chez moi devient un faux vert
 * chez lui. D'où la matrice, et d'où l'injection du juge trop permissif à la fin.
 */
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);

let ok = 0; let ko = 0;
const verifier = (cond, quoi) => { if (cond) { ok += 1; } else { ko += 1; console.error(`FAIL — ${quoi}`); } };

// Une baseline factice, chez MOI : on éprouve le juge sans toucher à la référence d'un voisin.
const racine = mkdtempSync(path.join(tmpdir(), 'juge-ensemble-'));
mkdirSync(path.join(racine, 'captures'), { recursive: true });
const entrees = {};
const poserMidi = (nom, jetons) => {
  writeFileSync(path.join(racine, 'captures', `${nom}.tokens.json`), JSON.stringify(jetons));
  entrees[nom] = { grammaire: nom, produit: true, modalite: 'MIDI', capture: path.join('captures', `${nom}.tokens.json`) };
};
const poserTexte = (nom, texte) => {
  writeFileSync(path.join(racine, 'captures', `${nom}.text.txt`), texte);
  entrees[nom] = { grammaire: nom, produit: true, modalite: 'TEXTE', capture: path.join('captures', `${nom}.text.txt`) };
};

const j = (token, start, end) => ({ token, start, end });
// Trois notes dont DEUX SIMULTANÉES — c'est là que l'ordre d'écriture est un choix du producteur.
const REF = [j('C4', 0, 1), j('E4', 1, 2), j('G4', 1, 2), j('C5', 2, 3)];
poserMidi('accord', REF);
// Un même jeton RÉPÉTÉ au même instant : le témoin des multiplicités.
poserMidi('repete', [j('C4', 0, 1), j('C4', 0, 1), j('D4', 0, 1)]);
poserTexte('suite', 'a b c d');
writeFileSync(path.join(racine, 'baseline.json'), JSON.stringify({ grammaires: entrees }));

process.env.BASELINE_DIR = racine;
const J = require('./compare_modal.cjs');
const { ISO, DIFF } = J;

// L'instrument d'abord : sans référence chargée, la matrice ne mesurerait rien.
verifier(J.referenceFor('accord') !== null && (J.referenceFor('accord').tokens || []).length === 4,
  'la baseline factice se charge et rend ses 4 jetons');

const juger = (nom, jetons) => J.compare(nom, { tokens: jetons });
const permuter = (l, i, k) => { const c = l.slice(); [c[i], c[k]] = [c[k], c[i]]; return c; };

// ── CE QUE LA DÉCISION RELÂCHE : LE RANG, ET RIEN D'AUTRE ─────────────────────────────────────
{
  const permute = permuter(REF, 1, 2); // E4 et G4 échangés — mêmes instants, mêmes durées
  const v = juger('accord', permute);
  verifier(v.status === ISO, "ordre d'affichage permuté sur deux notes SIMULTANÉES : ISO");
  verifier(v.ordre === 'libre', "et le verdict DIT que l'ordre a joué — un ISO relâché ne se lit pas strict");
}
verifier(juger('accord', REF).status === ISO, 'ordre identique : ISO');
verifier(juger('accord', REF).ordre === undefined, "et sans relâchement, rien n'est annoncé");
verifier(juger('accord', REF.slice().reverse()).status === ISO,
  'suite entièrement renversée : ISO — le rang ne compte sur aucune partie de la liste');

// ── CE QU'ELLE NE RELÂCHE PAS ─────────────────────────────────────────────────────────────────
verifier(juger('accord', [j('C4', 0, 1), j('E4', 1, 2), j('G4', 1.5, 2), j('C5', 2, 3)]).status === DIFF,
  'un INSTANT qui diffère : DIFF — la décision ne relâche rien sur les instants');
verifier(juger('accord', [j('C4', 0, 1), j('E4', 1, 2), j('G4', 1, 2.5), j('C5', 2, 3)]).status === DIFF,
  'une DURÉE qui diffère : DIFF — ni sur les durées');
verifier(juger('accord', [j('C4', 0, 1), j('E4', 1, 2), j('A4', 1, 2), j('C5', 2, 3)]).status === DIFF,
  'une NOTE qui diffère : DIFF');
verifier(juger('accord', REF.slice(0, 3)).status === DIFF,
  'une note MANQUANTE : DIFF');
verifier(juger('accord', REF.concat([j('C4', 0, 1)])).status === DIFF,
  'une note EN TROP, même déjà présente ailleurs : DIFF');

// LES MULTIPLICITÉS — le piège d'un juge qui comparerait des ENSEMBLES.
verifier(juger('repete', [j('C4', 0, 1), j('C4', 0, 1), j('D4', 0, 1)]).status === ISO,
  'multiplicités respectées : ISO');
verifier(juger('repete', [j('C4', 0, 1), j('D4', 0, 1), j('D4', 0, 1)]).status === DIFF,
  'MÊMES éléments, multiplicités différentes(2×C4+D4 contre C4+2×D4) : DIFF — c est un MULTIensemble');
verifier(juger('repete', [j('C4', 0, 1), j('D4', 0, 1)]).status === DIFF,
  'un doublon perdu : DIFF');

// ── L'AXE TEXTE NE BOUGE PAS ──────────────────────────────────────────────────────────────────
verifier(J.compare('suite', { text: 'a b c d' }).status === ISO, 'texte identique : ISO');
verifier(J.compare('suite', { text: 'a c b d' }).status === DIFF,
  "texte permuté : DIFF — sur l'axe TEXTE la SUITE compte, l'arbitrage ne vaut que pour le sonnant");

// ── LE DÉTAIL DIT L'ÉCART EN ÉLÉMENTS, PLUS EN RANGS ──────────────────────────────────────────
{
  const v = juger('accord', [j('C4', 0, 1), j('E4', 1, 2), j('A4', 1, 2), j('C5', 2, 3)]);
  verifier(/absent/.test(String(v.detail)) && !/rang/.test(String(v.detail)),
    "le détail nomme ce qui manque et ce qui est en trop, jamais « la 1re divergence au rang N » "
    + '— une position n a plus de sens quand le rang ne compte pas');
}

// ── LE GARDE MORD : on injecte les DEUX fautes symétriques ────────────────────────────────────
{
  // Faute 1 — le juge D'AVANT : comparer rang à rang. Il rendrait DIFF sur la permutation.
  const rangARang = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const cle = (t) => `${t.token}${t.start}-${t.end}`;
  const permute = permuter(REF, 1, 2);
  verifier(!rangARang(REF.map(cle), permute.map(cle)) && juger('accord', permute).status === ISO,
    'le juge rang-à-rang aurait rendu DIFF là où le juge corrigé rend ISO : le relâchement mord');

  // Faute 2 — le juge TROP PERMISSIF : comparer des ENSEMBLES, sans les multiplicités. Il rendrait
  // ISO sur 2×C4+D4 contre C4+2×D4. C'est le faux vert qu'un juge PARTAGÉ propagerait chez l'autre.
  const commeEnsemble = (a, b) => {
    const sa = new Set(a); const sb = new Set(b);
    return sa.size === sb.size && [...sa].every((x) => sb.has(x));
  };
  const ref = [j('C4', 0, 1), j('C4', 0, 1), j('D4', 0, 1)].map(cle);
  const cand = [j('C4', 0, 1), j('D4', 0, 1), j('D4', 0, 1)].map(cle);
  verifier(commeEnsemble(ref, cand) && juger('repete', cand).status === DIFF,
    'le juge par ENSEMBLE aurait rendu ISO là où le juge corrigé rend DIFF : la retenue mord aussi');
}

console.log(`Résultat l_axe_sonnant_compare_un_ensemble_minute : ${ok} OK, ${ko} FAIL`);
if (ko) process.exit(1);
