#!/usr/bin/env node
/**
 * L'ÉCRITURE DÉCIDE DE CE QU'ELLE PRODUIT — pas une ligne écrite trois lignes plus haut.
 *
 * ⚠️ CE QUI A ÉTÉ PAYÉ, signalé par Romain le 2026-08-08 : « si on nomme/appelle des éléments non
 * spécifiés, ça ne devrait pas générer un arbre générique, ça devrait générer une erreur ».
 * Mesuré le jour même, le défaut était en réalité plus retors qu'une absence de refus :
 *
 *     `S -> C4(vel:80)` AVEC `@core`  → une NOTE portant un RÉGLAGE
 *     `S -> C4(vel:80)` SANS `@core`  → un APPEL de fonction portant un ARGUMENT
 *
 * Les deux compilaient. Ce n'étaient pas deux façons d'écrire la même structure : deux natures de
 * nœud, deux champs. Et ce qui tranchait n'était pas la règle mais une DÉCLARATION DE TÊTE qui ne
 * parle pas d'elle. En aval, BPx cherche les réglages là où il les connaît : sur la seconde forme
 * il ne les trouvait pas, sans erreur, et jouait la note sans son intensité.
 *
 * LA RÉFÉRENCE ÉTAIT DÉJÀ DE CE CÔTÉ et personne ne pouvait le voir : `@core` n'apparaît AUCUNE
 * fois dans les trois spécifications, `@core` quinze fois — mais aucune décision datée ne portait la
 * suppression, donc aucun garde ne pouvait mordre. `@core` AMÈNE désormais les contrôles
 * (`lib/core.json`, champ `apporte`), et l'invocation commande : une scène qui n'invoque RIEN n'a
 * rien du tout — Romain, le même jour : « invoquer commande, systématiquement ».
 *
 * ⚠️ ET LE DÉFAUT AVAIT DÉJÀ ÉTÉ PAYÉ UNE FOIS, SUR UNE FAMILLE. Quatre contrôles de sous-grammaire
 * étaient semés en dur dans le chargeur, avec le commentaire qui disait la cause : « silently
 * dropped unless @core was loaded ». On avait réparé l'endroit où le défaut s'était MONTRÉ, pas
 * l'espace où il vivait ; les 61 autres contrôles y sont restés des mois.
 *
 * CE QUE CE GARDE MESURE, et pourquoi il compare des ARBRES et non des compilations : les deux
 * formes compilaient. Un garde qui vérifierait « ça passe » serait resté vert tout du long. On
 * compare donc l'arbre COMPLET produit par la même règle, avec et sans la ligne.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compiler = (src) => {
  try { return compileToBPxAST(src); } catch (e) { return { errors: [{ message: e.message }] }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message ?? e).join(' | ');
/** L'arbre des règles, débarrassé de ce qui n'est pas du sujet (positions, provenance). */
const arbre = (r) => JSON.stringify(r.ast?.subgrammars,
  (k, v) => (['line', 'col', 'column'].includes(k) ? undefined : v));

// ── A. LA MATRICE — FORMES × (avec la ligne / sans la ligne) ─────────────────────────────────
// Ajouter une forme la teste automatiquement des deux côtés. Ce sont les formes que le corpus
// écrit réellement : réglage collé, plusieurs paires, sac de règle, sac de groupe, sac de flux,
// accord chargé, réglage sur un silence et sur une prolongation.
const FORMES = [
  'S -> C4(vel:80)',
  'S -> C4(vel:80, pan:20)',
  'S -> C4 D4 (vel:80)',
  'S -> {C4 D4}(vel:80)',
  'S -> !(vel:80) C4',
  'S -> C4(vel:80)!E4(vel:90)',
  'S -> C4 -(vel:80) D4',
  'S -> C4 _(vel:80)',
  'S -> C4(wave:sawtooth) D4',
  'S -> C4(vel:80) D4(pan:20)',
];
for (const rhs of FORMES) {
  const avec = compiler(`core\nalphabet.western\n-----\n${rhs}\n`);
  const sans = compiler(`core\nalphabet.western\n-----\n${rhs}\n`);
  ok(messages(avec) === '' && messages(sans) === '',
     `A. '${rhs}' est REFUSÉ — avec : ${messages(avec).slice(0, 60) || 'ok'} · `
     + `sans : ${messages(sans).slice(0, 60) || 'ok'}`);
  if (messages(avec) || messages(sans)) continue;
  ok(arbre(avec) === arbre(sans),
     `A. '${rhs}' produit DEUX ARBRES DIFFÉRENTS selon qu'une ligne de tête est écrite ou non. `
     + `Les deux compilent : rien ne le dirait, sauf cette comparaison. Avec la ligne → `
     + `${arbre(avec).slice(0, 150)} · sans → ${arbre(sans).slice(0, 150)}`);
}

// ── B. UN ACCORD CHARGÉ RESTE UN ACCORD ──────────────────────────────────────────────────────
// ⚠️ VOLET NÉ D'UN DÉFAUT MUET TROUVÉ EN CHEMIN : `C4(vel:80)!E4(vel:90)` cessait d'être un accord
// dès qu'une scène invoquait les contrôles (186 des 274 du corpus) — deux éléments frères au lieu
// d'une co-attaque, sans un mot. L'accord n'était construit que sur la voie de l'APPEL, celle que
// prend un élément dont la clé N'EST PAS un contrôle connu. Le seul test qui couvrait la forme
// l'écrivait sans invocation : il gardait le cas qui n'arrive presque jamais, et restait vert.
const ACCORDS = [
  ['sans charge, deux notes',       'S -> C4!E4',                             2],
  ['sans charge, trois notes',      'S -> C4!E4!G4',                          3],
  ['charge sur la première',        'S -> C4(vel:80)!E4',                     2],
  ['charge sur les deux',           'S -> C4(vel:80)!E4(vel:90)',             2],
  ['charge sur trois',              'S -> C4(vel:80)!E4(vel:90)!G4(vel:100)', 3],
  ['dans un groupe polymétrique',   'S -> {C4(vel:80)!E4(vel:90) D4}',        2],
];
const accordDe = (n) => {
  if (!n || typeof n !== 'object') return null;
  if (n.type === 'SimultaneousGroup') return n;
  if (n.type === 'Polymetric') return accordDe(n.voices?.[0]?.[0]);
  return null;
};
for (const [quoi, rhs, notes] of ACCORDS) {
  const r = compiler(`core\nalphabet.western\n-----\n${rhs}\n`);
  ok(messages(r) === '', `B. '${rhs}' est REFUSÉ : ${messages(r).slice(0, 70)}`);
  if (messages(r)) continue;
  const g = accordDe(r.ast.subgrammars[0].rules[0].rhs[0]);
  ok(!!g, `B. ${quoi} — '${rhs}' ne produit PLUS d'accord : les notes cessent d'attaquer ensemble. `
        + `Aucun refus ne le dit, la scène sonne simplement autrement.`);
  if (!g) continue;
  const membres = [g.primary, ...(g.secondaries || [])];
  ok(membres.length === notes,
     `B. ${quoi} — ${notes} co-attaques attendues, ${membres.length} trouvée(s). `
     + `Une co-attaque perdue ou imbriquée ne s'entend que sur la sortie.`);
  ok(!membres.some((m) => m && m.type === 'SimultaneousGroup'),
     `B. ${quoi} — l'accord est IMBRIQUÉ au lieu d'être à plat : ${membres.map((m) => m?.type).join('+')}. `
     + `'C4!E4!G4' rend trois co-attaques à plat ; la forme chargée doit rendre la même chose.`);
  ok(!membres.some((m) => m && m.args !== undefined),
     `B. ${quoi} — une co-attaque porte encore un APPEL (champ 'args') : `
     + `${JSON.stringify(membres.map((m) => m?.args).filter(Boolean))}. Le sac d'une note est un `
     + `réglage, jamais un argument d'appel.`);
}

// ── C. TÉMOIN QUI MORD — le refus d'une clé inconnue ne dépend pas non plus de la ligne ──────
// ⚠️ Sans cette moitié, un compilateur qui aurait cessé de valider passerait les volets A et B en
// triomphe : deux arbres identiques et des accords bien formés, mais plus aucun refus.
for (const [quoi, src] of [
  ['une clé qui n\'existe nulle part, avec la ligne', 'core\nalphabet.western\n-----\nS -> C4(zzzz:80)\n'],
  ['une clé qui n\'existe nulle part, sans la ligne', 'core\nalphabet.western\n-----\nS -> C4(zzzz:80)\n'],
  ['une VALEUR interdite, avec la ligne',             'core\nalphabet.western\n-----\nS -> C4(wave:zzz)\n'],
  ['une VALEUR interdite, sans la ligne',             'core\nalphabet.western\n-----\nS -> C4(wave:zzz)\n'],
  // ⚠️ L'AUTRE MOITIÉ DE LA RÈGLE, et c'est elle qui distingue « les contrôles sont toujours là »
  // de « invoquer commande ». Une scène qui n'invoque RIEN n'a RIEN : le réglage y est refusé.
  // Ma première écriture chargeait les contrôles inconditionnellement — le volet A serait passé
  // au vert, et pourtant l'invocation n'aurait toujours rien commandé.
  ['un réglage sans AUCUNE invocation',               'S -> C4(vel:80)\n'],
  ['un réglage sous une librairie qui ne le déclare pas', 'alphabet.western\n-----\nS -> C4(vel:80)\n'],
]) {
  ok(messages(compiler(src)) !== '',
     `C-témoin. ${quoi} — doit être REFUSÉ et ne l'est plus. La validation ne doit jamais dépendre `
     + `d'une ligne de tête : c'est précisément ce qui laissait passer une valeur interdite en `
     + `silence dès qu'une scène ne l'écrivait pas.`);
}

// ── SOCLE ────────────────────────────────────────────────────────────────────────────────────
ok(FORMES.length >= 10 && ACCORDS.length >= 6,
   `SOCLE : ${FORMES.length} formes et ${ACCORDS.length} accords. Une matrice qui rétrécirait ne `
   + `dirait pas que le langage a changé, elle dirait qu'elle ne le lit plus.`);

if (echecs.length) {
  console.error(`❌ une ligne de tête change ce qu'une règle produit : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ l'écriture décide seule de ce qu'elle produit — ${FORMES.length} formes comparées `
          + `arbre à arbre des deux côtés, ${ACCORDS.length} accords chargés restés des accords, `
          + `4 refus qui prouvent que la validation mord encore. `
          + `${passe} vérification(s) passée(s).`);
