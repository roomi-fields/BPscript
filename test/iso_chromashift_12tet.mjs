/**
 * ISO chromashift 12-TET — preuve côté BPScript (émission + sémantique vs oracle natif).
 *
 * chromashift = image de BP3 `_transpose(N)` (décision Romain 2026-07-17) : décalage de N clés
 * CHROMATIQUES sur la grille 12. En tempérament ÉGAL (12-TET, le défaut western/sargam quand aucun
 * `@scale` n'est fixé), une clé = un demi-ton → chromashift(N) = +N demi-tons = hz × 2^(N/12).
 * AUCUNE table de gamme n'est nécessaire (les 3 scènes sont en 12-TET). La microtonalité n'apparaît
 * que pour une scène à gamme explicite (grammaire `scales`), traitée à part.
 *
 * FRONTIÈRE : BPScript ÉMET `(chromashift:N)` (opaque) ; KAIROS RÉSOUT le hz (fonction digitale
 * `chromashift.ts` : step += N ; projeter → hz). Ce banc prouve la part BPSCRIPT :
 *   (A) l'émission porte le bon N sur les 3 scènes ;
 *   (B) la sémantique 12-TET (+N demi-tons) reproduit BYTE-IDENTIQUEMENT l'oracle natif sur le
 *       préfixe chromashift-PUR de transposition1 (déterministe, @mode:ord, avant tout homomorphisme).
 * La preuve hz e2e complète (projeter Kairos vs oracle) vit côté kairos (transpose-digital-e2e).
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { compileToBPxAST } from '../src/transpiler/bpxAst.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const G = (name) => readFileSync(join(__dirname, 'grammars', name, 'scene.bps'), 'utf-8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  OK   ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };

// --- Collecte des valeurs chromashift émises dans un AST (InstantControl + directive @chromashift) ---
function chromashiftValues(ast) {
  const vals = [];
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.type === 'InstantControl' && n.qualifier?.pairs) {
      for (const p of n.qualifier.pairs) if (p.key === 'chromashift') vals.push(p.value);
    }
    if (n.name === 'chromashift' && 'value' in n && n.type !== 'InstantControl') vals.push(n.value);
    for (const v of Object.values(n)) walk(v);
  })(ast);
  return vals;
}

// ============================================================
// (A) ÉMISSION — les 3 scènes portent le bon chromashift:N
// ============================================================
console.log('=== (A) Émission chromashift:N (les 3 scènes) ===');

{
  const { ast, errors } = compileToBPxAST(G('transposition1'));
  ok(errors.length === 0, 'transposition1 compile sans erreur');
  const v = chromashiftValues(ast).sort((a, b) => a - b);
  ok(JSON.stringify(v) === JSON.stringify([0, 5, 11]), 'transposition1 émet chromashift {0,5,11} (Tr0/Tr7/Tr1) — got ' + JSON.stringify(v));
}
{
  const { ast, errors } = compileToBPxAST(G('kss2'));
  const v = chromashiftValues(ast);
  ok(v.includes(-7), 'kss2 émet chromashift:-7 — got ' + JSON.stringify(v));
  // Bloqueur PRÉ-EXISTANT (hors chromashift) : sargam sa6/re6… non résolus sous octaves saptak par
  // défaut (@alphabet.sargam:midi sans octaves.western). N'AFFECTE PAS l'émission chromashift ; documenté.
  const sargamErr = errors.filter((e) => /terminal '(sa|re|ga|pa|dha|ni)\d' non déclaré/.test(e.message || ''));
  ok(sargamErr.length > 0, 'kss2 a un bloqueur PRÉ-EXISTANT octave-sargam (' + sargamErr.length + ' terminaux) — SÉPARÉ de chromashift');
}
{
  const { ast, errors } = compileToBPxAST(G('mohanam'));
  ok(errors.length === 0, 'mohanam compile sans erreur (octaves.western → sa6 résolu)');
  const v = chromashiftValues(ast);
  ok(v.includes(-24), 'mohanam émet @chromashift:-24 — got ' + JSON.stringify(v));
}

// ============================================================
// (B) ISO 12-TET — transposition1 préfixe chromashift-PUR vs oracle natif (byte-identique)
// ============================================================
console.log('=== (B) ISO 12-TET vs oracle natif — transposition1 (préfixe pur, @mode:ord) ===');

// Le 1er `${|A1|}` est AVANT tout `TR` → chromashift SEUL (aucun homomorphisme).
// |A1| -> {Tr0 M1. Tr1 M1 Tr7 M1 Tr0 M1 Tr7 M1}, M1 -> C3 B3 F4, Tr{0,1,7}=chromashift{0,11,5}.
const M1 = ['C3', 'B3', 'F4'];
const SEMI = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const shift = (note, n) => {
  const m = note.match(/^([A-G]#?)(\d+)$/);
  const idx0 = SEMI.indexOf(m[1]) + n;
  const oct = +m[2] + Math.floor(idx0 / 12);
  return SEMI[((idx0 % 12) + 12) % 12] + oct;
};
const expected = [];
for (const N of [0, 11, 5, 0, 5]) for (const nt of M1) expected.push(shift(nt, N));

const oracle = JSON.parse(readFileSync(join(__dirname, 'grammars', 'transposition1', 'snapshots', 's1_native.json'), 'utf-8'));
const got = oracle.tokens.map((t) => t[0]).slice(0, expected.length);
ok(JSON.stringify(got) === JSON.stringify(expected),
  'préfixe 15 tokens natifs = M1 sous chromashift{0,11,5} (+N demi-tons) BYTE-IDENTIQUE\n       attendu: ' + expected.join(' ') + '\n       oracle : ' + got.join(' '));

console.log(`\n--- ISO chromashift 12-TET : ${pass} OK, ${fail} FAIL ---`);
process.exit(fail ? 1 : 0);
