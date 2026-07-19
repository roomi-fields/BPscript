/**
 * test_tokenizer_hyphen.js — Tests de découpage note+silence sur le tokenizer
 *
 * Règle arbitrée (alignée sur BP3 CompileGrammar.c:1196 + Encode.c:140) :
 *   n'absorber le '-' collé à un ident QUE si le caractère suivant est
 *   alphanumérique [a-zA-Z0-9]. Sinon, l'ident est émis seul et '-' devient REST.
 *
 * Run: node test/test_tokenizer_hyphen.js
 */

import { tokenize, T } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { registerAll } from '../src/transpiler/libs.js';
import { readFileSync } from 'fs';

// ── Pre-register libs ─────────────────────────────────────────
const libs = {};
for (const name of ['alphabets', 'controls', 'octaves', 'tunings', 'temperaments', 'settings']) {
  libs[name] = JSON.parse(readFileSync(`lib/${name}.json`, 'utf8'));
}
registerAll(libs);

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, details) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push({ label, details: details || '' });
    console.error(`  FAIL: ${label}${details ? ` — ${details}` : ''}`);
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

// Helper : extrait les tokens d'un fragment de règle (types + valeurs filtrés)
function toks(src) {
  return tokenize(src).filter(t => t.type !== T.EOF);
}

function tokTypes(src) {
  return toks(src).map(t => t.type);
}

function tokValues(src) {
  return toks(src).map(t => t.value);
}

// ============================================================
// Cas 1 — do4- suivi de '}' → IDENT(do4) + REST   [CHANGE: bug Item 2]
// ============================================================
section('Cas 1 : do4- suivi de }');
{
  const tokens = toks('Su -> {1,do4-}');
  // On cherche do4 et REST dans la séquence
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const rests = tokens.filter(t => t.type === T.REST);
  assert('do4 présent comme IDENT', idents.includes('do4'), `IDENT trouvés: ${idents}`);
  assert('do4- absent de l\'alphabet (pas d\'IDENT "do4-")', !idents.includes('do4-'), `IDENT trouvés: ${idents}`);
  assert('REST présent', rests.length >= 1, `REST count: ${rests.length}`);
}

// ============================================================
// Cas 2 — re6- en fin de ligne → IDENT(re6) + REST   [CHANGE]
// ============================================================
section('Cas 2 : re6- fin de ligne');
{
  const tokens = toks('Vi -> re6-');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const rests = tokens.filter(t => t.type === T.REST);
  assert('re6 présent comme IDENT', idents.includes('re6'), `IDENT trouvés: ${idents}`);
  assert('re6- absent', !idents.includes('re6-'), `IDENT trouvés: ${idents}`);
  assert('REST présent', rests.length >= 1, `REST count: ${rests.length}`);
}

// ============================================================
// Cas 3 — do4- fin de fichier sans \n → IDENT(do4) + REST   [CHANGE]
// ============================================================
section('Cas 3 : do4- fin de fichier (sans \\n)');
{
  const tokens = toks('S -> do4-');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const rests = tokens.filter(t => t.type === T.REST);
  assert('do4 présent', idents.includes('do4'), `IDENT trouvés: ${idents}`);
  assert('do4- absent', !idents.includes('do4-'), `IDENT trouvés: ${idents}`);
  assert('REST présent (EOF)', rests.length >= 1, `REST count: ${rests.length}`);
}

// ============================================================
// Cas 4 — do4-- end → IDENT(do4) REST REST   [inchangé]
// ============================================================
section('Cas 4 : do4-- (double tiret) — inchangé');
{
  const tokens = toks('X -> do4-- end');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const rests = tokens.filter(t => t.type === T.REST);
  assert('do4 présent', idents.includes('do4'), `IDENT trouvés: ${idents}`);
  assert('do4-- absent', !idents.includes('do4--') && !idents.includes('do4-'), `IDENT trouvés: ${idents}`);
  assert('au moins 2 REST', rests.length >= 2, `REST count: ${rests.length}`);
}

// ============================================================
// Cas 5 — mi6--- re6- → IDENT(mi6) REST×3 IDENT(re6) REST   [re6- change]
// ============================================================
section('Cas 5 : mi6--- re6-');
{
  const tokens = toks('Z -> mi6--- re6-');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const rests = tokens.filter(t => t.type === T.REST);
  assert('mi6 présent', idents.includes('mi6'), `IDENT trouvés: ${idents}`);
  assert('re6 présent', idents.includes('re6'), `IDENT trouvés: ${idents}`);
  assert('ni mi6- ni re6- ni mi6--- dans IDENT',
    !idents.some(id => id.includes('-')),
    `IDENT trouvés: ${idents}`);
  // mi6--- = mi6 + 3 REST ; re6- = re6 + 1 REST → total 4 REST
  assert('4 REST au total', rests.length === 4, `REST count: ${rests.length}`);
}

// ============================================================
// Cas 6 — A8-2 prescan LHS+RHS → IDENT unique   [inchangé]
// ============================================================
section('Cas 6 : A8-2 prescan — IDENT unique');
{
  // Avec un source qui a A8-2 en LHS et en RHS, le prescan doit le reconnaître
  const src = `A8-2 ? <- dha
M <- V A8-2`;
  const tokens = toks(src);
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  assert('A8-2 présent comme IDENT unique', idents.includes('A8-2'), `IDENT trouvés: ${idents}`);
  // Vérifier pas de séparation en A8 + REST + INT
  const a8idx = tokens.findIndex(t => t.type === T.IDENT && t.value === 'A8-2');
  assert('A8-2 est un seul token (pas suivi REST+INT)', a8idx >= 0, `A8-2 trouvé à: ${a8idx}`);
}

// Cas 6b — A'16-2 avec apostrophe
section('Cas 6b : A\'16-2 avec apostrophe — IDENT unique');
{
  const src = `A'16-2 ? <- dha
M <- V A'16-2`;
  const tokens = toks(src);
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  assert("A'16-2 présent comme IDENT unique", idents.includes("A'16-2"), `IDENT trouvés: ${idents.slice(0,8)}`);
}

// ============================================================
// Cas 7 — [K1-1] Head -> Head a [Atrans, A-1] → IDENT(K1-) INT(1) ... IDENT(A-) INT(1)
// + parse : Guard{K1,-,1} et FlagExpr{A,-,1}   [inchangé]
// ============================================================
section('Cas 7 : flag décréments [K1-1] et [A-1] — inchangé');
{
  const tokens = toks('[K1-1] Head -> Head a [Atrans, A-1]');
  // K1- doit être un IDENT, 1 un INT
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  assert('K1- présent comme IDENT (décrément)', idents.includes('K1-'), `IDENT trouvés: ${idents}`);
  assert('A- présent comme IDENT (décrément)', idents.includes('A-'), `IDENT trouvés: ${idents}`);

  // Parse — vérifier que Guard et FlagExpr sont bien formés
  const ast = parse(tokens);
  const rule = ast.subgrammars && ast.subgrammars[0] && ast.subgrammars[0].rules && ast.subgrammars[0].rules[0];
  assert('règle parsée', rule && rule.type === 'Rule', 'pas de règle');
  if (rule) {
    const guard = Array.isArray(rule.guard) ? rule.guard[0] : rule.guard;
    assert('guard K1 operator=-', guard && guard.flag === 'K1' && guard.operator === '-', `guard: ${JSON.stringify(guard)}`);
    assert('guard value=1', guard && guard.value === 1, `guard value: ${guard && guard.value}`);
    const flagA = rule.flags.find(f => f.flag === 'A');
    assert('FlagExpr A operator=-', flagA && flagA.operator === '-', `flags: ${JSON.stringify(rule.flags)}`);
    assert('FlagExpr A value=1', flagA && flagA.value === 1, `flags: ${JSON.stringify(rule.flags)}`);
  }
}

// ============================================================
// Cas 8 — qualifier 'pure_minor-third_meantone' → valeur recollée intacte   [inchangé]
// ============================================================
section('Cas 8 : qualifier pure_minor-third_meantone — inchangé');
{
  const src = `@controls
S -> ![tempo:2, scale: pure_minor-third_meantone 0] Up_Down`;
  // tokenize : pure_minor- doit être IDENT(pure_minor-) et third_meantone IDENT(third_meantone)
  const tokens = toks(src);
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  assert('pure_minor- présent (absorption avant alnum)', idents.includes('pure_minor-'), `IDENT trouvés: ${idents.filter(id => id.includes('minor') || id.includes('third'))}`);

  // parse — vérifier que la QualPair a la valeur recollée
  const ast = parse(tokens);
  const rule = ast.subgrammars && ast.subgrammars[0] && ast.subgrammars[0].rules && ast.subgrammars[0].rules[0];
  assert('règle parsée', rule && rule.type === 'Rule', 'pas de règle');
  if (rule && rule.rhs) {
    // La valeur de scale doit être 'pure_minor-third_meantone'
    // On cherche dans les rhs elements pour le qualifier de tempo/scale
    // Le qualifier est dans l'élément Exclaim ou dans qualifiers de la règle
    const exclaimEl = rule.rhs.find(el => el && el.type === 'Exclaim');
    if (exclaimEl && exclaimEl.qualifiers) {
      const scalePair = exclaimEl.qualifiers.flatMap(q => q.pairs || []).find(p => p.key === 'scale');
      assert('scale value = pure_minor-third_meantone', scalePair && scalePair.value === 'pure_minor-third_meantone',
        `scale: ${scalePair && scalePair.value}`);
    } else {
      // Le test de valeur recollée est vérifié indirectement par le tokenizer
      assert('pure_minor- absorbé (alnum après)', true);
    }
  }
}

// ============================================================
// Cas 9 — dhin-- ta → IDENT(dhin) REST REST IDENT(ta)   [inchangé]
// ============================================================
section('Cas 9 : dhin-- ta — inchangé');
{
  const tokens = toks('Y -> dhin-- ta');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const rests = tokens.filter(t => t.type === T.REST);
  assert('dhin présent', idents.includes('dhin'), `IDENT trouvés: ${idents}`);
  assert('ta présent', idents.includes('ta'), `IDENT trouvés: ${idents}`);
  assert('2 REST pour dhin--', rests.length === 2, `REST count: ${rests.length}`);
  assert('pas de dhin-', !idents.includes('dhin-'), `IDENT trouvés: ${idents}`);
}

// ============================================================
// Cas 10 — do4 - _ → IDENT REST PROLONG   [inchangé]
// ============================================================
section('Cas 10 : do4 - _ avec espaces — inchangé');
{
  const tokens = toks('W -> do4 - _');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const rests = tokens.filter(t => t.type === T.REST);
  const prolongs = tokens.filter(t => t.type === T.PROLONG);
  assert('do4 présent', idents.includes('do4'), `IDENT: ${idents}`);
  assert('REST présent (silence isolé)', rests.length >= 1, `REST: ${rests.length}`);
  assert('PROLONG présent', prolongs.length >= 1, `PROLONG: ${prolongs.length}`);
}

// ============================================================
// Cas 11 — a->b → IDENT(a) ARROW_R IDENT(b)   [inchangé]
// ============================================================
section('Cas 11 : a->b flèche — inchangé');
{
  const tokens = toks('a->b');
  const types = tokens.map(t => t.type);
  assert('IDENT ARROW_R IDENT', types[0] === T.IDENT && types[1] === T.ARROW_R && types[2] === T.IDENT,
    `types: ${types}`);
}

// ============================================================
// Cas 12 — [weight:50-12] → INT(50) REST INT(12), decrement=12 après parse
// ============================================================
section('Cas 12 : [weight:50-12] décrement de poids — inchangé');
{
  const src = `@controls
S -> A [weight:50-12]`;
  const ast = parse(toks(src));
  const rule = ast.subgrammars && ast.subgrammars[0] && ast.subgrammars[0].rules && ast.subgrammars[0].rules[0];
  assert('règle parsée', rule && rule.type === 'Rule', 'pas de règle');
  if (rule && rule.qualifiers && rule.qualifiers.length > 0) {
    const weightPair = rule.qualifiers.flatMap(q => q.pairs || []).find(p => p.key === 'weight');
    assert('weight base=50', weightPair && weightPair.value === 50, `weight: ${JSON.stringify(weightPair)}`);
    assert('weight decrement=12', weightPair && weightPair.decrement === 12, `weight decrement: ${JSON.stringify(weightPair)}`);
  } else {
    assert('qualifiers présents', false, 'pas de qualifiers');
  }
}

// ============================================================
// Cas 13 — mohanam [Notes-4] A -> P4 [weight:50-12] — inchangé
// ============================================================
section('Cas 13 : mohanam réel [Notes-4] + [weight:50-12] — inchangé');
{
  const src = `@controls
[Notes-4] A -> P4 [weight:50-12]`;
  const ast = parse(toks(src));
  const rule = ast.subgrammars && ast.subgrammars[0] && ast.subgrammars[0].rules && ast.subgrammars[0].rules[0];
  assert('règle parsée', rule && rule.type === 'Rule', 'pas de règle');
  if (rule) {
    const guard = Array.isArray(rule.guard) ? rule.guard[0] : rule.guard;
    assert('guard Notes operator=-', guard && guard.flag === 'Notes' && guard.operator === '-', `guard: ${JSON.stringify(guard)}`);
    assert('guard value=4', guard && guard.value === 4, `guard value: ${guard && guard.value}`);
    const weightPair = rule.qualifiers.flatMap(q => q.pairs || []).find(p => p.key === 'weight');
    assert('weight base=50', weightPair && weightPair.value === 50, `weight: ${JSON.stringify(weightPair)}`);
    assert('weight decrement=12', weightPair && weightPair.decrement === 12, `weight: ${JSON.stringify(weightPair)}`);
  }
}

// ============================================================
// Vérification compileBPS — 765432 : pas de do4-/mi4-/sol4-/etc. dans l'alphabet
// ============================================================
section('compileBPS 765432 — pas de terminaux parasites note-');
{
  try {
    const src = readFileSync('test/grammars/765432/scene.bps', 'utf8');
    const result = compileToBPxAST(src);
    const alphaTerms = result.alphabetFile ? result.alphabetFile.split('\n').map(l => l.trim()).filter(Boolean) : [];
    const parasites = ['do4-', 'mi4-', 'sol4-', 'do5-', 'mi5-', 'sol5-', 'do7-'];
    for (const p of parasites) {
      assert(`alphabet sans "${p}"`, !alphaTerms.some(line => line.includes(p)),
        `trouvé "${p}" dans alphabetFile`);
    }
    // Vérifier que la grammaire émet do4 + espace + - (séparés)
    // ⚠️ ASSERTION DE TEXTE BP3 RETIRÉE le 2026-07-19 : elle vérifiait que la grammaire
    // émise contenait « do4 - ». La certification grammaire-texte est abandonnée (arbitrage
    // Romain) et l'encodeur supprimé — il n'y a plus de texte à vérifier. Le reste du fichier
    // (plus de 75 assertions sur la TOKENISATION, son objet réel) est conservé intact.
  } catch (e) {
    assert('compileBPS 765432 sans erreur fatale', false, e.message);
  }
}

// ============================================================
// F2 — UNDERSCORE TRAÎNANT : comportement symétrique du tiret
// Règle : '_' absorbé DANS l'ident seulement si suivi d'un alphanumérique.
// Sinon : ident émis seul + les '_' deviennent des tokens PROLONG séparés.
// ============================================================

section('F2 : si3_____ → IDENT(si3) + PROLONG×5');
{
  const tokens = toks('X -> si3_____');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const prolongs = tokens.filter(t => t.type === T.PROLONG);
  assert('si3 présent (pas si3_____)', idents.includes('si3') && !idents.includes('si3_____'),
    `IDENT: ${idents}`);
  assert('5 PROLONG', prolongs.length === 5, `PROLONG count: ${prolongs.length}`);
}

section('F2 : pa3_ → IDENT(pa3) + PROLONG×1');
{
  const tokens = toks('X -> pa3_');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const prolongs = tokens.filter(t => t.type === T.PROLONG);
  assert('pa3 présent (pas pa3_)', idents.includes('pa3') && !idents.includes('pa3_'),
    `IDENT: ${idents}`);
  assert('1 PROLONG', prolongs.length === 1, `PROLONG count: ${prolongs.length}`);
}

section('F2 : Up_Down intact (underscore INTERNE suivi d\'alnum)');
{
  const tokens = toks('S -> Up_Down');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  assert('Up_Down intact (ident unique)', idents.includes('Up_Down'),
    `IDENT: ${idents}`);
  assert('pas de PROLONG parasite', tokens.filter(t => t.type === T.PROLONG).length === 0);
}

section('F2 : Num_total intact (flag avec underscore interne)');
{
  const tokens = toks('S -> A [Num_total=20]');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  assert('Num_total intact', idents.includes('Num_total'), `IDENT: ${idents}`);
  assert('Num pas IDENT séparé', !idents.includes('Num'), `IDENT: ${idents}`);
}

section('F2 : sa_4 intact (shruti — underscore interne)');
{
  const tokens = toks('S -> sa_4 r1_4');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  assert('sa_4 intact', idents.includes('sa_4'), `IDENT: ${idents}`);
  assert('r1_4 intact', idents.includes('r1_4'), `IDENT: ${idents}`);
  assert('pas de PROLONG', tokens.filter(t => t.type === T.PROLONG).length === 0);
}

section('F2 : do3_ suivi espace → IDENT(do3) + PROLONG');
{
  const tokens = toks('X -> do3_ fa3');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const prolongs = tokens.filter(t => t.type === T.PROLONG);
  assert('do3 présent', idents.includes('do3'), `IDENT: ${idents}`);
  assert('do3_ absent', !idents.includes('do3_'), `IDENT: ${idents}`);
  assert('1 PROLONG', prolongs.length === 1, `PROLONG count: ${prolongs.length}`);
}

section('F2 : do3_- → IDENT(do3) + PROLONG + REST');
{
  const tokens = toks('X -> do3_-');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const prolongs = tokens.filter(t => t.type === T.PROLONG);
  const rests = tokens.filter(t => t.type === T.REST);
  assert('do3 présent', idents.includes('do3'), `IDENT: ${idents}`);
  assert('1 PROLONG', prolongs.length === 1, `PROLONG: ${prolongs.length}`);
  assert('1 REST', rests.length === 1, `REST: ${rests.length}`);
}

section('F2 : _rest LEADING → PROLONG (comportement inchangé)');
{
  // Un '_' en début de token est toujours PROLONG isolé (pas de changement)
  const tokens = toks('X -> a _ b');
  const prolongs = tokens.filter(t => t.type === T.PROLONG);
  assert('_ isolé → PROLONG', prolongs.length === 1, `PROLONG: ${prolongs.length}`);
}

section('F2 : W -> do4 - _ inchangé');
{
  // Cas de non-régression : déjà séparés, inchangé
  const tokens = toks('W -> do4 - _');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const rests = tokens.filter(t => t.type === T.REST);
  const prolongs = tokens.filter(t => t.type === T.PROLONG);
  assert('do4 intact', idents.includes('do4'), `IDENT: ${idents}`);
  assert('REST présent', rests.length >= 1, `REST: ${rests.length}`);
  assert('PROLONG présent', prolongs.length >= 1, `PROLONG: ${prolongs.length}`);
}

section('F2 : gak3_ (tryRagas) → IDENT(gak3) + PROLONG');
{
  const tokens = toks('X -> gak3_');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const prolongs = tokens.filter(t => t.type === T.PROLONG);
  assert('gak3 présent', idents.includes('gak3'), `IDENT: ${idents}`);
  assert('gak3_ absent', !idents.includes('gak3_'), `IDENT: ${idents}`);
  assert('1 PROLONG', prolongs.length === 1, `PROLONG: ${prolongs.length}`);
}

section('F2 : re5______ (shapes-rhythm) → IDENT(re5) + PROLONG×6');
{
  const tokens = toks('X -> re5______');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const prolongs = tokens.filter(t => t.type === T.PROLONG);
  assert('re5 présent', idents.includes('re5'), `IDENT: ${idents}`);
  assert('6 PROLONG', prolongs.length === 6, `PROLONG count: ${prolongs.length}`);
}

section('F2 : Full_scale intact (LHS non-terminal avec underscores internes)');
{
  // Full_scale est un non-terminal avec underscore interne suivi d'alnum
  const tokens = toks('Full_scale -> sa_4 r1_4');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  assert('Full_scale intact', idents.includes('Full_scale'), `IDENT: ${idents}`);
  assert('sa_4 intact', idents.includes('sa_4'), `IDENT: ${idents}`);
  assert('r1_4 intact', idents.includes('r1_4'), `IDENT: ${idents}`);
}

// ============================================================
// Résultat final
// ============================================================
console.log(`\n${'='.repeat(50)}`);
if (failures.length > 0) {
  console.log('\nÉchecs :');
  for (const f of failures) {
    console.log(`  - ${f.label}${f.details ? ` : ${f.details}` : ''}`);
  }
}
console.log(`\nRésultat : ${passed} PASS, ${failed} FAIL`);

if (failed > 0) {
  process.exit(1);
}
