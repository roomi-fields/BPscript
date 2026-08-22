#!/usr/bin/env node
/**
 * UN DRAPEAU SE DÉCLARE, ET CE QU'ON ÉCRIT AVEC LUI SE JUGE À L'USAGE.
 *
 * ⛔ CE BANC REMPLACE `un_etat_de_drapeau_se_refuse_a_l_usage_et_le_drapeau_nu_reste_libre.mjs`,
 * DONT LES DEUX NOTIONS SONT MORTES LE 2026-08-22 — et son NOM les portait toutes les deux.
 *   · « un état de drapeau » : les états nommés sortent (Romain — « un flag à valeurs nommées, ce
 *     n'est pas en BP3, donc je ne veux pas ce truc ») ;
 *   · « le drapeau nu reste libre » : un drapeau porte sa valeur initiale, et un nom employé sans
 *     déclaration est REFUSÉ (Romain — « DONC EN BPSCRIPT ON INITIE »).
 * Un banc dont le titre affirme deux formes retirées est pire qu'un banc absent : il enseigne.
 *
 * ⚠️ CE QU'IL GARDAIT DE VIVANT EST ICI, ET RIEN N'EST PERDU : le cri porte toujours sur ce qui ne
 * désigne rien, il vaut sur TOUS les comparateurs et TOUS les mutateurs, et la comparaison entre
 * deux drapeaux reste légale — deux scènes du corpus l'écrivent, le natif la porte.
 *
 * ⛔ ET LE CRI EST À L'USAGE, JAMAIS À LA DÉCLARATION : c'est le prototypal pur, et c'est ce qui
 * distingue « ce nom n'existe pas » de « cette déclaration est incomplète ».
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

/** Deux drapeaux déclarés, comme le langage l'exige depuis le 2026-08-22. */
const DECL = 'flag section:1\nflag autre:1\n-----\nS -> A\n';
const cri = (regle, tete = DECL) => {
  try {
    const r = compileToBPxAST(`core\nalphabet.western:audio\n${tete}-----\n${regle}\n`, {});
    return (r.errors || []).map((x) => x.message || String(x));
  } catch (x) { return [x.message]; }
};
const refuse = (regle, tete) => cri(regle, tete).some((m) => /drapeau/i.test(m));
const passe = (regle, tete) => cri(regle, tete).length === 0;

const COMPARE = ['==', '!=', '>', '<', '>=', '<='];
const MUTE = ['=', '+', '-'];

// ── A. UN NOM QUI NE DÉSIGNE RIEN EST REFUSÉ — sur les six comparateurs et les trois mutateurs ──
// La matrice est le point : un cri posé sur un seul opérateur laisse les huit autres muets, et
// c'est exactement ce qui avait laissé l'état inconnu passer pendant que le drapeau vide criait.
for (const op of COMPARE) {
  ok(refuse(`[section${op}zorglub] A -> C4`),
     `A. comparateur '${op}' : un nom qui ne désigne aucun drapeau doit être refusé`);
}
for (const op of MUTE) {
  ok(refuse(`A -> C4 [section${op}zorglub]`),
     `A. mutateur '${op}' : un nom qui ne désigne aucun drapeau doit être refusé`);
}

// ── B. LE COMPLÉMENT — ce qui est LÉGITIME passe, sur tous les opérateurs ───────────────────────
// Sans lui, un cri trop large aurait la même empreinte qu'un cri juste : tout refuser est aussi
// « zéro faute non détectée ».
for (const op of COMPARE) {
  ok(passe(`[section${op}2] A -> C4`), `B. comparateur '${op}' : un ENTIER passe`);
  ok(passe(`[section${op}autre] A -> C4`),
     `B. comparateur '${op}' : le nom d'un AUTRE DRAPEAU déclaré passe — deux scènes du corpus `
     + `l'écrivent (\`[Num_a>Num_b]\`), le natif le porte, et la décision ne le retire pas`);
}
for (const op of MUTE) {
  ok(passe(`A -> C4 [section${op}2]`), `B. mutateur '${op}' : un ENTIER passe`);
}

// ── C. LES FORMES SANS VALEUR — rien à résoudre, donc rien à refuser ────────────────────────────
ok(passe('[section] A -> C4'), 'C. un drapeau seul en garde passe — il teste sa propre positivité');
ok(passe('A -> C4 [section]'), 'C. et seul en fin de règle aussi');

// ── D. ⛔ LE DRAPEAU LUI-MÊME SE DÉCLARE — ce que le régime d'avant laissait passer ─────────────
// C'est le renversement du 2026-08-22 : ce volet gardait l'INVERSE, « un drapeau non déclaré se
// compare librement, 44 scènes vivantes en dépendent ». Elles ont migré, toutes.
const SANS = '-----\nS -> X\n';
ok(refuse('[Num_a>Num_b] X -> C4', SANS),
   'D. un drapeau NON déclaré est refusé en garde, même comparé à un autre');
ok(refuse('X -> C4 [Num_a=20]', SANS),
   'D. et en mutation — c\'est le cas qui passait en silence, parce que le test jugeait la VALEUR');
ok(cri('X -> C4 [Num_a=20]', SANS).some((m) => /n'est pas déclaré/.test(m)),
   'D. et le refus NOMME le drapeau manquant, plus la forme qui le déclare');

// ── E. ⛔ LE CRI EST À L'USAGE, JAMAIS À LA DÉCLARATION ─────────────────────────────────────────
// Le prototypal pur : une déclaration complète ne peut pas être refusée pour ce qu'on en fera.
ok(passe('A -> C4', 'flag s:0\n-----\nS -> A\n'),
   'E. un drapeau déclaré et JAMAIS employé passe — rien ne se refuse à la déclaration');
ok(refuse('[s==a] A -> C4', 'flag s:0\n-----\nS -> A\n'),
   'E. et c\'est son EMPLOI vers un nom inexistant qui crie');

// ── F. CE QUE LE CRI EXISTE POUR FAIRE — la valeur arrive ENTIÈRE dans l'arbre ──────────────────
{
  const r = compileToBPxAST(
    `core\nalphabet.western:audio\nflag section:1\n-----\nS -> A\n-----\n[section==2] A -> C4\n`, {});
  const t = JSON.stringify(r.ast || {});
  ok((r.errors || []).length === 0, `F. SOCLE : la scène doit compiler — reçu ${(r.errors || [])[0]?.message || ''}`);
  ok(/"flag":"section","operator":"==","value":2/.test(t),
     `F. la garde porte la valeur ENTIÈRE 2 dans l'arbre — sans quoi l'aval devrait résoudre un nom `
     + `que le langage ne déclare plus`);
}

const ATTENDU = COMPARE.length + MUTE.length + COMPARE.length * 2 + MUTE.length + 2 + 3 + 2 + 2;
ok(p + e.length === ATTENDU, `bilan : ${ATTENDU} attendues, ${p + e.length} exécutées`);

if (e.length) {
  console.error(`❌ un drapeau se déclare : ${e.length} échec(s)`);
  for (const x of e) console.error(`  ✗ ${x}`);
  process.exit(1);
}
console.log(`✅ un drapeau se déclare, et son emploi se juge à l'usage — ${COMPARE.length} `
  + `comparateurs × ${MUTE.length} mutateurs, le nom inconnu crie, l'entier et l'autre drapeau `
  + `passent, et le drapeau non déclaré est refusé EN LE NOMMANT. ${p} vérification(s) passée(s).`);
