import { LIBS as BUNDLED } from '../src/transpiler/libs-data.js';
/**
 * Test : l'OPÉRATEUR DE VITESSE — une seule écriture, et elle est RELATIVE.
 *
 *   ! (/N) · ! (*N/M)   posé dans le flux   → TempoOp scope 'relative'
 *
 * ⚠️ CE FICHIER A CHANGÉ DE SUJET LE 2026-08-06, ET LE POURQUOI IMPORTE.
 * Il vérifiait l'étiquette absolu/relatif que la décision du 2026-06-10 avait introduite : la
 * forme en CROCHETS vivait à trois positions (flux, suffixe d'élément, suffixe de règle) et
 * BPx devait deviner par position — d'où le champ `scope`.
 *
 * La décision du 2026-08-06 (`tempx` supprimé, la vitesse s'écrit `! (/N)` dans le flux) ne
 * laisse qu'UNE position. Il n'existe plus aucune écriture qui produise `scope: 'absolute'` :
 * l'étiquette survit dans l'arbre, sa valeur `absolute` n'a plus de porte d'entrée.
 * ⚠️ CE N'EST PAS UN NETTOYAGE, C'EST UNE PERTE À SIGNALER : une décision datée est vidée par
 * une autre sans que la seconde le dise. Ce fichier la RETIENT au lieu de la laisser disparaître
 * avec les assertions qu'on aurait simplement effacées — et le témoin plus bas rougira le jour
 * où une écriture ré-ouvrira `absolute`, pour qu'on le décide plutôt que de le subir.
 *
 * Run: node test/test_tempo_scope.js
 */
import { readFileSync } from 'fs';
import { tokenize } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';
import { registerAll } from '../src/transpiler/libs.js';

const libs = {};
for (const n of ['alphabets', 'expression', 'midi', 'audio', 'transpo', 'engine', 'octaves', 'tunings', 'temperaments', 'settings', 'homomorphism']) {
  libs[n] = BUNDLED[n];
}
registerAll(libs);

let passed = 0, failed = 0;
function assert(label, cond, detail) {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`); }
}

// Collecte récursive de tous les nœuds TempoOp d'un AST.
function findTempoOps(node, acc = []) {
  if (node == null || typeof node !== 'object') return acc;
  if (node.type === 'TempoOp') acc.push(node);
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) v.forEach(x => findTempoOps(x, acc));
    else if (v && typeof v === 'object') findTempoOps(v, acc);
  }
  return acc;
}
const scopeOf = (src) => {
  const tops = findTempoOps(parse(tokenize(src)));
  return tops.length === 1 ? tops[0].scope : `(${tops.length} TempoOp)`;
};

console.log('\n=== L\'opérateur de vitesse : une écriture, une portée ===');

const refuse = (src) => { try { parse(tokenize(src)); return null; } catch (e) { return e.message; } };

// LA SEULE ÉCRITURE — celle de la bible (LANGUAGE.md:1249, :2259-2261).
assert("! (/2) → relative", scopeOf('@mode:lin\nS -> a ! (/2) b') === 'relative', scopeOf('@mode:lin\nS -> a ! (/2) b'));
assert("! (*3/2) → relative", scopeOf('@mode:lin\nS -> a ! (*3/2) b') === 'relative', scopeOf('@mode:lin\nS -> a ! (*3/2) b'));

// LES TROIS POSITIONS EN CROCHETS SONT RETIRÉES — et le refus nomme la relève.
for (const [quoi, src] of [
  ['flux',              '@mode:lin\nS -> a ![/2] b'],
  ['suffixe d\'élément', '@mode:lin\nS -> a[/2] b'],
  ['suffixe de règle',   '@mode:lin\nS -> a b [/2]'],
]) {
  const m = refuse(src);
  assert(`[/2] en ${quoi} → refusé`, m !== null, m);
  assert(`[/2] en ${quoi} → le refus donne '! (/N)'`, m !== null && m.includes('! (/N)'), m);
}

// TÉMOIN DE LA PERTE — aucune écriture ne produit plus `absolute`. S'il rougit, c'est qu'une
// porte s'est rouverte : à décider, pas à absorber.
{
  const src = '@mode:lin\nS -> a ! (/2) b ! (*3) c';
  const tops = findTempoOps(parse(tokenize(src)));
  assert("aucune écriture ne rend 'absolute'", tops.length === 2 && tops.every(t => t.scope === 'relative'),
    tops.map(t => t.scope));
}

// ─── « COLLÉ » VEUT DIRE COLLÉ À UN TERME — matrice des OUVRANTS ────────────────────────────
// ⚠️ CE BLOC VIENT D'UN DÉFAUT MESURÉ PAR KANOPI, PAS D'UNE IDÉE. `{! (/2) C4, D4}` était REFUSÉ
// et `{ ! (/2) C4, D4}` accepté : le `!` en tête de voix était pris pour un flux CONJOINT parce
// que le test ne regardait que l'espace à gauche, jamais ce qu'il y avait à gauche. Une accolade
// n'est pas un terminal. Coût réel chez l'architecte : 178 espaces posés après des accolades pour
// réparer quatre scènes, en suivant un message qui accusait l'espace.
//
// ⚠️ ET LA PREMIÈRE VERSION DE CETTE MATRICE NE MORDAIT PAS. Je l'avais écrite avec des formes
// ESPACÉES (`{a, ! (/2) b}`) : la garde n'agit que sur le COLLÉ, donc huit de ses neuf cellules
// passaient quel que soit l'état du code. Mesuré en retirant la garde : une seule rougissait.
// Chaque cellule est désormais COLLÉE à son ouvrant — la seule position où la question se pose.
//
// ⚠️ QUELLES CELLULES MORDENT VRAIMENT, MESURÉ PAR INJECTION — et il faut le dire, sinon un vert
// laisse croire plus qu'il ne prouve :
//   · les DEUX cellules « vitesse collée à une accolade / à une virgule » rougissent quand on
//     retire la garde. Ce sont elles qui gardent cette correction.
//   · les cellules `conjointDe` ne bougent PAS sous injection : le drapeau `conjoint` d'un
//     RÉGLAGE en tête de voix ou de membre droit est produit par un AUTRE site, qui était déjà
//     juste. Elles restent comme témoins de non-régression DE CE SITE-LÀ — elles ne prouvent
//     rien sur la garde ci-dessous, et ce fichier ne prétend pas le contraire.
{
  const conjointDe = (src) => {
    let n = 0; const vu = new WeakSet();
    const w = x => { if (!x || typeof x !== 'object' || vu.has(x)) return; vu.add(x);
      if (x.type === 'InstantControl' && x.conjoint === true) n++;
      if (Array.isArray(x)) { x.forEach(w); return; } for (const v of Object.values(x)) w(v); };
    w(parse(tokenize(src))); return n;
  };
  const EN_TETE = '@core\n@mode:lin\n';
  // UN OUVRANT NE PORTE PAS DE TERME : collé ou non, jamais conjoint. Formes COLLÉES — c'est là,
  // et là seulement, que la garde décide quelque chose.
  for (const [quoi, src] of [
    ['fleche',   EN_TETE + 'S ->!(vel:80) a'],
    ['accolade', EN_TETE + 'S -> {!(vel:80) a, b}'],
    ['virgule',  EN_TETE + 'S -> {a,!(vel:80) b}'],
  ]) assert(`colle a une ${quoi} : jamais conjoint`, conjointDe(src) === 0, conjointDe(src));

  // LA MOITIÉ « DOIT MORDRE » : un vrai terme collé donne bien un conjoint. Sans elle, une règle
  // qui refuserait TOUT resterait verte.
  for (const [quoi, src] of [
    ['terminal', EN_TETE + 'S -> a!(vel:80) b'],
    ['groupe',   EN_TETE + 'S -> {a}!(vel:80) b'],
  ]) assert(`colle a un ${quoi} : conjoint`, conjointDe(src) === 1, conjointDe(src));

  // LA VITESSE refuse le conjoint : elle passe après un ouvrant, elle tombe après un terme.
  for (const [quoi, src] of [
    ['accolade', '@mode:lin\nS -> {!(/2) a, b}'],
    ['virgule',  '@mode:lin\nS -> {a,!(/2) b}'],
    ['fleche',   '@mode:lin\nS -> !(/2) a'],
  ]) assert(`vitesse collee a une ${quoi} : acceptee`, refuse(src) === null, refuse(src));
  for (const [quoi, src] of [
    ['terminal', '@mode:lin\nS -> a!(/2) b'],
    ['groupe',   '@mode:lin\nS -> {a}!(/2) b'],
  ]) assert(`vitesse collee a un ${quoi} : refusee`, refuse(src) !== null);
}

console.log(`\n${'='.repeat(40)}\nRésultat : ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exit(1);
