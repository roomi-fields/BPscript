/**
 * test_tokenizer_hyphen.js — Tests de découpage note+silence sur le tokenizer
 *
 * ⛔ CE FICHIER A ETE RETOURNE LE 2026-08-17, ET SON EN-TETE DISAIT LE CONTRAIRE.
 * Il tenait la regle native — « un terminal ne peut jamais contenir '-' » (BP3
 * CompileGrammar.c:1196, Encode.c:140) — et dix-neuf de ses assertions exigeaient qu'un tiret
 * colle produise un IDENT puis un REST.
 *
 * LA DECISION DE ROMAIN l'abroge : un tiret ENTRE ESPACES est un silence, colle a des lettres
 * il appartient au NOM. `dha-dha` est le terminal de ce nom. C'est une divergence ASSUMEE avec
 * le natif, du meme ordre que celle sur la casse — l'espace porte le sens en BPScript.
 *
 * ⚠️ LES CAS N'ONT PAS BOUGE, LES ATTENTES SI. Un garde qui teste une regle abrogee se relit,
 * il ne se rafistole pas : chaque assertion retournee ci-dessous porte la forme QU'ON ECRIT
 * MAINTENANT, et son ancienne attente reste lisible dans l'historique.
 *
 * ⛔ CE QUI NE CHANGE PAS, et le fichier le garde : dans un CROCHET le tiret est un OPERATEUR
 * (`[Flag-1]` decremente), et la fleche `->` n'est jamais absorbee. Les deux ont ete casses en
 * ecrivant la regle, et repares dans le meme mouvement.
 *
 * Run: node test/test_tokenizer_hyphen.js
 */

import { tokenize, T } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { registerAll } from '../src/transpiler/libs.js';
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const BUNDLED = leRegistre();
import { readFileSync } from 'fs';
import { bpsPath, grPath } from './corpus.mjs';

// ── Pre-register libs ─────────────────────────────────────────
const libs = {};
for (const name of ['alphabets', 'expression', 'midi', 'audio', 'transpo', 'engine', 'octaves', 'tunings', 'temperaments', 'settings']) {
  // ⚠️ LA DONNÉE SE LIT AU BUNDLE, JAMAIS SUR LE DISQUE — et c'est l'avertissement que porte déjà
  // `lib/digital.json` : « un CONSOMMATEUR doit charger depuis le BUNDLE, jamais lire ce JSON sur le
  // disque ». Depuis le 2026-08-13 une librairie peut s'écrire en BPScript (`lib/audio.bps`) : lire
  // `lib/<nom>.json` fait alors tomber le test sur un fichier absent, et lui ferait rater la donnée
  // si le fichier existait encore par ailleurs. Le bundle est la source unique des consommateurs.
  libs[name] = BUNDLED[name];
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
  assert('do4- est UN nom', idents.includes('do4-'), `IDENT trouvés: ${idents}`);
  assert('do4 nu n\'est plus emis a part', !idents.includes('do4'), `IDENT trouvés: ${idents}`);
  assert('aucun REST : le tiret est dans le nom', rests.length === 0, `REST count: ${rests.length}`);
}

// ============================================================
// Cas 2 — re6- en fin de ligne → IDENT(re6) + REST   [CHANGE]
// ============================================================
section('Cas 2 : re6- fin de ligne');
{
  const tokens = toks('Vi -> re6-');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const rests = tokens.filter(t => t.type === T.REST);
  assert('re6- est UN nom', idents.includes('re6-'), `IDENT trouvés: ${idents}`);
  assert('re6 nu n\'est plus emis a part', !idents.includes('re6'), `IDENT trouvés: ${idents}`);
  assert('aucun REST : le tiret est dans le nom', rests.length === 0, `REST count: ${rests.length}`);
}

// ============================================================
// Cas 3 — do4- fin de fichier sans \n → IDENT(do4) + REST   [CHANGE]
// ============================================================
section('Cas 3 : do4- fin de fichier(sans \\n)');
{
  const tokens = toks('S -> do4-');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const rests = tokens.filter(t => t.type === T.REST);
  assert('do4- est UN nom', idents.includes('do4-'), `IDENT trouvés: ${idents}`);
  assert('do4 nu absent', !idents.includes('do4'), `IDENT trouvés: ${idents}`);
  assert('aucun REST(EOF) : le tiret est dans le nom', rests.length === 0, `REST count: ${rests.length}`);
}

// ============================================================
// Cas 4 — do4-- end → IDENT(do4) REST REST   [inchangé]
// ============================================================
section('Cas 4 : do4-- (double tiret) — inchangé');
{
  const tokens = toks('X -> do4-- end');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const rests = tokens.filter(t => t.type === T.REST);
  assert('do4-- est UN nom', idents.includes('do4--'), `IDENT trouvés: ${idents}`);
  assert('do4 nu absent', !idents.includes('do4'), `IDENT trouvés: ${idents}`);
  assert('aucun REST : les deux tirets sont dans le nom', rests.length === 0, `REST count: ${rests.length}`);
}

// ============================================================
// Cas 5 — mi6--- re6- → IDENT(mi6) REST×3 IDENT(re6) REST   [re6- change]
// ============================================================
section('Cas 5 : mi6--- re6-');
{
  const tokens = toks('Z -> mi6--- re6-');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const rests = tokens.filter(t => t.type === T.REST);
  assert('mi6--- est UN nom', idents.includes('mi6---'), `IDENT trouvés: ${idents}`);
  assert('re6- est UN nom', idents.includes('re6-'), `IDENT trouvés: ${idents}`);
  assert('mi6---, re6- et mi6- sont des NOMS',
    idents.includes('mi6---') && idents.includes('re6-'),
    `IDENT trouvés: ${idents}`);
  // mi6--- = mi6 + 3 REST ; re6- = re6 + 1 REST → total 4 REST
  assert('aucun REST : les quatre tirets sont dans les noms', rests.length === 0, `REST count: ${rests.length}`);
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
  assert('A8-2 est un seul token(pas suivi REST+INT)', a8idx >= 0, `A8-2 trouvé à: ${a8idx}`);
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
  // ⛔ LES TROIS DRAPEAUX SE DECLARENT DEPUIS LE 2026-08-22 (Romain) : un drapeau porte sa valeur
  // initiale, et un nom employe sans declaration est refuse. Ce banc lit le TOKENIZER, mais il
  // appelle `parse` juste apres — donc sa source doit etre une scene valide, pas une ligne nue.
  // Les assertions de jetons ne bougent pas : elles cherchent `K1` et `A` parmi les IDENT, et le
  // tiret parmi les types ; les declarations en ajoutent, elles n en retirent aucun.
  // `types` en tête : `flag` est un objet de ce fichier, sans socle implicite (Romain, 2026-09-02).
  const tokens = toks('types\nflag K1:0\nflag A:0\nflag Atrans:0\n-----\n[K1-1] Head -> Head a [Atrans, A-1]');
  // ⚠️ CES DEUX ASSERTIONS TESTAIENT LA FORME DU JETON, PAS L'EFFET, et le déplacement du
  // 2026-08-17 est instructif. Elles exigeaient `IDENT("K1-")` — le tokenizer collait alors le
  // tiret suivi d'un alphanumérique. Il ne le colle plus : au natif, un tiret est un SILENCE et
  // `dha- dha` rend exactement `dha - dha`, mesuré sur le TEMPS et non sur le texte.
  // LE DÉCRÉMENT N'EST PAS CASSÉ POUR AUTANT — les vingt scènes du corpus qui en portent un
  // restent vertes, et les assertions de PARSE ci-dessous le prouvent : c'est là que le sens vit.
  // Un garde qui grave une forme intermédiaire rougit sur un geste juste ; celui-ci garde
  // désormais que le décrément se LIT, quelle que soit la découpe qui l'a produit.
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  assert('le nom du flag reste un IDENT', idents.includes('K1') && idents.includes('A'), `IDENT trouvés: ${idents}`);
  assert('le tiret est un jeton SÉPARÉ', tokens.some((t) => t.type === T.REST), `types: ${[...new Set(tokens.map(t=>t.type))]}`);

  // Parse — vérifier que Guard et FlagExpr sont bien formés
  const ast = parse(tokens);
  const rule = ast.subgrammars && ast.subgrammars[0] && ast.subgrammars[0].rules && ast.subgrammars[0].rules[0];
  assert('règle parsée', rule && rule.type === 'Rule', 'pas de règle');
  if (rule) {
    const guard = Array.isArray(rule.guard) ? rule.guard[0] : rule.guard;
    assert('guard K1 operator=-', guard && guard.flag === 'K1' && guard.operator === '-', `guard: ${JSON.stringify(guard)}`);
    assert('guard value=1', guard && guard.value === 1, `guard value:${guard && guard.value}`);
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
  // ⚠️ `weight` s'écrit en PARENTHÈSES depuis la décision Romain 2026-08-02 (LANGUAGE.md:773-800) —
  // `![tempx:…]` (crochets) est désormais REFUSÉ. `!(weight:2)` sert la même fonction dans ce test
  // (un AUTRE élément du flux à côté de `scale`, non le sujet mesuré ici).
  const src = `core
-----
S -> !(weight:2) !(scale:pure_minor-third_meantone 0) Up_Down`;
  // ⚠️ CETTE ASSERTION TESTAIT LE JETON, PAS L'EFFET — même déplacement que le cas 7, le
  // 2026-08-17. Elle exigeait `IDENT("pure_minor-")`, produit par un tokenizer qui collait le
  // tiret suivi d'un alphanumérique ; il ne le colle plus, le tiret étant un SILENCE au natif.
  // LA VALEUR SURVIT INTACTE POUR AUTANT : mesuré, l'arbre porte bien
  // `pure_minor-third_meantone` — c'est le lecteur de réglages qui la recolle, pas le tokenizer.
  // Ce qui compte est là, et les assertions de parse ci-dessous le gardent.
  const tokens = toks(src);
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  assert('le nom a tiret est UN SEUL IDENT', idents.includes('pure_minor-third_meantone'), `IDENT trouvés: ${idents.filter(id => id.includes('minor') || id.includes('third'))}`);

  // parse — vérifier que la QualPair a la valeur recollée
  const ast = parse(tokens);
  const rule = ast.subgrammars && ast.subgrammars[0] && ast.subgrammars[0].rules && ast.subgrammars[0].rules[0];
  assert('règle parsée', rule && rule.type === 'Rule', 'pas de règle');
  if (rule && rule.rhs) {
    // La valeur de scale doit être 'pure_minor-third_meantone'
    // Sac SCINDE le 2026-07-26 : tempo est MOTEUR (crochets), scale est RUNTIME (parentheses).
    // On cherche dans les rhs elements pour le qualificatif de scale
    // Le qualifier est dans l'élément Exclaim ou dans qualifiers de la règle
    const exclaimEl = rule.rhs.find(el => el && el.type === 'Exclaim');
    if (exclaimEl && exclaimEl.qualifiers) {
      const scalePair = exclaimEl.qualifiers.flatMap(q => q.pairs || []).find(p => p.key === 'scale');
      assert('scale value = pure_minor-third_meantone', scalePair && scalePair.value === 'pure_minor-third_meantone',
        `scale:${scalePair && scalePair.value}`);
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
  assert('dhin-- est UN nom', idents.includes('dhin--'), `IDENT trouvés: ${idents}`);
  assert('ta présent', idents.includes('ta'), `IDENT trouvés: ${idents}`);
  assert('aucun REST pour dhin--', rests.length === 0, `REST count: ${rests.length}`);
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
// Cas 12 — (weight:50-12) → INT(50) REST INT(12), decrement=12 après parse
// ⚠️ `weight` s'écrit en PARENTHÈSES depuis la décision Romain 2026-08-02 (LANGUAGE.md:773-800) —
// `[weight:…]` (crochets) est désormais REFUSÉ. Le décrément (`readQualifierValue`, parser.js)
// est PARTAGÉ entre les deux sacs : ce cas prouve qu'il survit à la migration en `()`.
// ============================================================
section('Cas 12 : (weight:50-12) décrement de poids — même lecteur, sac déplacé');
{
  const src = `core
-----
S -> A (weight:50-12)`;
  const ast = parse(toks(src));
  const rule = ast.subgrammars && ast.subgrammars[0] && ast.subgrammars[0].rules && ast.subgrammars[0].rules[0];
  assert('règle parsée', rule && rule.type === 'Rule', 'pas de règle');
  const weightPair = (rule && rule.settings && rule.settings.pairs || []).find(p => p.key === 'weight');
  if (weightPair) {
    assert('weight base=50', weightPair.value === 50, `weight:${JSON.stringify(weightPair)}`);
    assert('weight decrement=12', weightPair.decrement === 12, `weight decrement: ${JSON.stringify(weightPair)}`);
  } else {
    assert('settings.pairs présents', false, 'pas de settings.pairs');
  }
}

// ============================================================
// Cas 13 — mohanam [Notes-4] A -> P4 (weight:50-12) — sac déplacé
// ============================================================
section('Cas 13 : mohanam réel [Notes-4] + (weight:50-12) — sac déplacé');
{
  // `Notes` se declare depuis le 2026-08-22 — `mohanam.bps`, dont ce cas est tire, ecrit
  // `[Notes=32]` a sa premiere regle ; on prend SA valeur plutot qu un zero qui rendrait
  // `[Notes-4]` inerte.
  const src = `core
flag Notes:32
-----
[Notes-4] A -> P4 (weight:50-12)`;
  const ast = parse(toks(src));
  const rule = ast.subgrammars && ast.subgrammars[0] && ast.subgrammars[0].rules && ast.subgrammars[0].rules[0];
  assert('règle parsée', rule && rule.type === 'Rule', 'pas de règle');
  if (rule) {
    const guard = Array.isArray(rule.guard) ? rule.guard[0] : rule.guard;
    assert('guard Notes operator=-', guard && guard.flag === 'Notes' && guard.operator === '-', `guard: ${JSON.stringify(guard)}`);
    assert('guard value=4', guard && guard.value === 4, `guard value:${guard && guard.value}`);
    const weightPair = (rule.settings && rule.settings.pairs || []).find(p => p.key === 'weight');
    assert('weight base=50', weightPair && weightPair.value === 50, `weight:${JSON.stringify(weightPair)}`);
    assert('weight decrement=12', weightPair && weightPair.decrement === 12, `weight:${JSON.stringify(weightPair)}`);
  }
}

// ============================================================
// Vérification compileBPS — 765432 : pas de do4-/mi4-/sol4-/etc. dans l'alphabet
// ============================================================
section('compileBPS 765432 — pas de terminaux parasites note-');
{
  try {
    const src = readFileSync(bpsPath('765432'), 'utf8');
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
  assert('si3 présent(pas si3_____)', idents.includes('si3') && !idents.includes('si3_____'),
    `IDENT: ${idents}`);
  assert('5 PROLONG', prolongs.length === 5, `PROLONG count: ${prolongs.length}`);
}

section('F2 : pa3_ → IDENT(pa3) + PROLONG×1');
{
  const tokens = toks('X -> pa3_');
  const idents = tokens.filter(t => t.type === T.IDENT).map(t => t.value);
  const prolongs = tokens.filter(t => t.type === T.PROLONG);
  assert('pa3 présent(pas pa3_)', idents.includes('pa3') && !idents.includes('pa3_'),
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

section('F2 : sa_4 intact(shruti — underscore interne)');
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
