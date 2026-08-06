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
for (const n of ['alphabets', 'controls', 'octaves', 'tunings', 'temperaments', 'settings', 'transcription']) {
  libs[n] = JSON.parse(readFileSync(`lib/${n}.json`, 'utf8'));
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

console.log(`\n${'='.repeat(40)}\nRésultat : ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exit(1);
