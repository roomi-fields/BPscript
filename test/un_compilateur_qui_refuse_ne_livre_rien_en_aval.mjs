#!/usr/bin/env node
/**
 * GARDE — UN COMPILATEUR QUI REFUSE NE LIVRE RIEN EN AVAL.
 *
 * Décision Romain 2026-08-19 : « ce qui établit le succès est L'ABSENCE D'ERREUR, jamais la présence
 * d'un arbre ». Rust n'émet aucun binaire quand il échoue, GCC aucun objet.
 *
 * ⛔ CE QUE ÇA CORRIGE, ET C'ÉTAIT MUET. Un refus de SENS — mot inconnu, acteur ambigu, état de
 * drapeau qui ne désigne rien — laissait sortir un arbre COMPLET et plausible à côté des erreurs.
 * BPx l'a mesuré sur les 51 clés de la structure : AUCUNE n'évoque un état de compilation, donc rien
 * ne distinguait l'arbre d'un refus de celui d'un succès. Trois de ses refus ont dérivé sans un mot,
 * sortie identique au témoin.
 *
 * ⚠️ LE VOLET A COUVRE LES DEUX FAMILLES DE REFUS, et c'est le fond du défaut : un refus de FORME
 * partait par une exception et n'avait jamais d'arbre ; un refus de SENS revenait par le chemin
 * normal, l'arbre déjà posé. Le premier semblait prouver la règle que le second violait.
 *
 * ⛔ ET LE VOLET B EST INDISPENSABLE : sans lui, un compilateur qui ne rendrait JAMAIS d'arbre
 * passerait ce garde en vert. « Pas d'arbre quand ça refuse » ne dit rien tant qu'on n'a pas montré
 * qu'il y en a un quand ça accepte.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const c = (src) => { try { return compileToBPxAST(src); } catch (err) { return { ast: 'JETÉ', errors: [{ message: String(err.message) }] }; } };

// ── A. TOUT REFUS REND `ast: null` — les deux familles ───────────────────────────────────────────
const REFUS = [
  ['refus de SENS — alphabet inconnu', 'core\nalphabet.zorglubinvente\n-----\nS -> C4\n'],
  ['refus de SENS — état de drapeau inconnu', 'flag section(a:1)\n-----\nS -> A\n[section==zz] A -> C4\n'],
  ['refus de SENS — entrée absente du catalogue', 'core\ntuning.zorglubinvente\n-----\nS -> C4\n'],
  ['refus de SENS — mot que rien ne déclare', 'zorglubinvente truc (x:1)\n-----\nS -> C4\n'],
  ['refus de FORME — parenthèse jamais fermée', 'core\n-----\nS -> ((\n'],
  ['refus de FORME — règle avant le délimiteur', 'flag section(a:1)\nS -> C4\n'],
];
for (const [quoi, src] of REFUS) {
  const r = c(src);
  ok(r.errors.length > 0, `A. « ${quoi} » doit produire au moins une erreur — sinon ce cas n'éprouve rien`);
  ok(r.ast === null, `A. ⛔ « ${quoi} » ne doit livrer AUCUN arbre — reçu ${r.ast === 'JETÉ' ? 'une exception' : typeof r.ast}`);
}

// ── B. ⛔ ET UN SUCCÈS EN LIVRE UN — sans quoi le volet A serait tenu par le vide ─────────────────
const SUCCES = [
  ['une scène juste', 'core\nalphabet.western\n-----\nS -> C4\n'],
  ['une librairie', 'def x (a:1)\n'],
  ['un prototype et son exemplaire', 'def a (x)\na b (x:1)\n'],
];
for (const [quoi, src] of SUCCES) {
  const r = c(src);
  ok(r.errors.length === 0, `B. « ${quoi} » doit compiler sans erreur — sinon le volet B n'éprouve rien`);
  ok(r.ast !== null && typeof r.ast === 'object', `B. « ${quoi} » doit livrer un arbre — reçu ${JSON.stringify(r.ast)}`);
}

// ── C. LA FORME DE LA RÉPONSE NE CHANGE PAS — trois champs, toujours ─────────────────────────────
{
  const bon = c('core\nalphabet.western\n-----\nS -> C4\n');
  const mauvais = c('core\nalphabet.zorglubinvente\n-----\nS -> C4\n');
  for (const [quoi, r] of [['succès', bon], ['refus', mauvais]]) {
    ok(['ast', 'errors', 'warnings'].every((k) => k in r),
      `C. la réponse porte ses trois champs même sur un ${quoi} — un appelant qui lit \`errors\` ne doit pas tomber`);
  }
  ok(Array.isArray(mauvais.warnings), "C. les avertissements restent une liste sur un refus — ils ne sont pas des erreurs");
}

const ATTENDU = REFUS.length * 2 + SUCCES.length * 2 + 3;
ok(p + e.length === ATTENDU, `le garde doit éprouver ${ATTENDU} cas — ${p + e.length} seulement`);

if (e.length) { console.error(`[refus] ${e.length} ÉCHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[refus] ${p} PASS / 0 FAIL — ${p} assertion(s)`);
