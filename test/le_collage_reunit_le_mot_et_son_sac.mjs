#!/usr/bin/env node
/**
 * GARDE — ENTRE UN MOT DÉCLARÉ ET SON SAC, L'ESPACE EST INTERDITE ; ET LA CLÔTURE D'UN CORPS COMPTE.
 *
 * Décisions de Romain, 2026-09-03 :
 *   · « entre un mot déclaré et son sac, il ne faut pas d'espace, je veux qu'il soit interdit » ;
 *   · « vu que les espaces ont un sens, on ne peut mettre des retours à la ligne que là où il y a
 *     déjà des espaces » ;
 *   · la CLÔTURE d'un backtick compte — l'ouverture est une suite, la fermeture la première suite de
 *     même longueur.
 *
 * ⛔ CE QUE CE GARDE TIENT, ET POURQUOI IL EST UNE MATRICE, PAS UNE LISTE. La règle du collage
 * existait DÉJÀ à l'intérieur d'un sac — `diapason (…)` y était refusé — et pas en tête de
 * déclaration. Un mécanisme qui vaut à une profondeur et pas à l'autre n'est pas une règle, c'est un
 * cas. Le garde éprouve donc les DEUX étages, les deux sortes de déclaration (`def` et le type en
 * tête), et le COMPLÉMENT : ce que la règle doit laisser passer.
 *
 * ⚠️ ET IL ÉPROUVE L'ESPACE ET LE PLI ENSEMBLE. Avant cette frappe, `mot (sac)` était accepté et
 * `mot\n(sac)` refusé : le pli était traité autrement que l'espace, ce que la deuxième décision
 * interdit. Les deux colonnes doivent rendre le même verdict.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

const B = String.fromCharCode(96);
const TETE = 'core\nalphabet.simple\n';
let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const refus = (decl) => {
  const r = compileToBPxAST(`${TETE}${decl}\n-----\nS -> a\n`, { librairie: true });
  return (r.errors || []).map((e) => e.message);
};

// ── 1. L'ESPACE ET LE PLI SONT REFUSÉS, aux deux sortes de déclaration, avec la RÉÉCRITURE ───────
for (const [quoi, decl, attendu] of [
  ['def, espace',        'def kick (vel:120)',  'def kick(…)'],
  ['def, pli',           'def kick\n(vel:120)', null],
  ['type en tête, espace', 'sound metro (vel:120)', 'sound metro(…)'],
  ['type en tête, pli',    'sound metro\n(vel:120)', null],
]) {
  const msgs = refus(decl);
  ok(msgs.length > 0, `1. ${quoi} : doit être REFUSÉ — reçu aucun refus`);
  if (attendu) {
    ok(msgs.some((m) => m.includes(attendu.replace('(…)', '(')) && /space/i.test(m)),
      `1. ${quoi} : le refus doit nommer l'espace ET donner la réécriture collée — reçu ${JSON.stringify(msgs)}`);
  }
}

// ── 2. LE COMPLÉMENT — la forme collée passe, à toutes les profondeurs ───────────────────────────
for (const [quoi, decl] of [
  ['def collé',                 'def kick(vel:120)'],
  ['type en tête collé',        'sound metro(vel:120)'],
  ['sous-sac collé',            'def zorglub(range(min:1, max:2))'],
  ['membres obligatoires',      'def gamme(culture, ratios)'],
  ['transformation et son corps', 'def accent(x) x(vel:120)'],
  ['pli après une virgule',     'def kick(vel:120,\n  pan:64)'],
  ['pli après la parenthèse',   'def kick(\n  vel:120, pan:64)'],
  ['pli avant la fermante',     'def kick(vel:120, pan:64\n)'],
]) {
  ok(refus(decl).length === 0, `2. ${quoi} : doit PASSER — reçu ${JSON.stringify(refus(decl))}`);
}

// ── 3. L'ESPACE DANS UN SAC EST REFUSÉE AUSSI — la règle vaut à toutes les profondeurs ───────────
{
  const msgs = refus('def zorglub(range (min:1, max:2))');
  ok(msgs.length > 0, '3. une espace entre une clé et son sous-sac reste refusée');
}

// ── 4. LA CLÔTURE COMPTE — la matrice des longueurs ──────────────────────────────────────────────
const corpsDe = (decl) => {
  const r = compileToBPxAST(`${TETE}${decl}\n-----\nS -> a\n`, { librairie: true });
  const v = ((r.ast && r.ast.vars) || [])[0];
  return { erreurs: (r.errors || []).map((e) => e.message), code: v && v.corps ? v.corps.code : null };
};
for (const [quoi, decl, attendu] of [
  ['une barre',                 `sound m1(v:1) ${B}ts: return 1${B}`,                      'return 1'],
  ['une barre, tag omis',       `sound m2(v:1) ${B}return 1${B}`,                          'return 1'],
  ['deux barres, une dedans',   `sound m3(v:1) ${B}${B}ts: a ${B}b${B} c${B}${B}`,         `a ${B}b${B} c`],
  ['trois barres, deux dedans', `sound m4(v:1) ${B}${B}${B}ts: a${B}${B}b${B}${B}${B}`,    `a${B}${B}b`],
]) {
  const r = corpsDe(decl);
  ok(r.erreurs.length === 0 && r.code === attendu,
    `4. ${quoi} : le corps doit être ${JSON.stringify(attendu)} — reçu ${JSON.stringify(r)}`);
}

// ── 5. LE COMPLÉMENT DE LA CLÔTURE — une ouverture jamais fermée est refusée EN NOMMANT sa longueur
{
  const r = compileToBPxAST(`${TETE}sound m5(v:1) ${B}${B}ts: return 1\n-----\nS -> a\n`, { librairie: true });
  const msgs = (r.errors || []).map((e) => e.message);
  ok(msgs.some((m) => /2 backticks/.test(m) && /never closed/i.test(m)),
    `5. une ouverture de deux barres jamais fermée est refusée en nommant la longueur — reçu ${JSON.stringify(msgs)}`);
  ok(r.ast === null, '5. et elle ne livre aucun arbre');
}

const ATTENDU = 4 + 2 + 8 + 1 + 4 + 2;
ok(passe + echecs.length === ATTENDU,
  `le garde doit éprouver ${ATTENDU} cas — ${passe + echecs.length} seulement`);

if (echecs.length) {
  console.error(`[collage] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[collage] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
