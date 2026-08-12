#!/usr/bin/env node
/**
 * GARDE — une référence dont le propriétaire annonce qu'elle est fausse ne rend AUCUN verdict,
 * et la liste des références suspendues ne grossit pas en silence.
 *
 * LA CAUSE. Préavis bp3-engine du 2026-08-12 : ses captures de `PP` et de `check&` reposent sur un
 * fichier de réglages EMPRUNTÉ que la grammaire ne déclare pas. Romain a levé le gel pour ces deux
 * entrées, et pour rien d'autre. Juger contre elles rendrait un chiffre déjà su faux — un DIFF
 * imputerait à la scène l'écart du réglage, un ISO consacrerait le mauvais instant.
 *
 * ⛔ CE QUE CE GARDE EMPÊCHE SURTOUT. Une suspension est une porte de sortie : elle transforme un
 * verdict en silence. Elle doit donc rester EXACTEMENT à sa taille. Ce garde échoue si une
 * troisième grammaire y entre — la levée viendra du second courrier de bp3-engine, jamais d'un
 * élargissement commode. Le complément est la moitié qui compte : toute autre grammaire est jugée.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const J = require('./compare_modal.cjs');
const { NON_MESURABLE } = J;

let ok = 0; let ko = 0;
const verifier = (cond, quoi) => { if (cond) { ok += 1; } else { ko += 1; console.error(`FAIL — ${quoi}`); } };

const SUSPENDUES = ['PP', 'check&'];
const { byName } = J.loadBaseline();

// L'instrument d'abord : les deux noms existent bien dans la référence, sinon on mesurerait du vide.
for (const n of SUSPENDUES) verifier(!!byName[n], `${n} est bien déclarée par la baseline`);

// ── LA SUSPENSION MORD, QUOI QUE PORTE LE CANDIDAT ────────────────────────────────────────────
for (const n of SUSPENDUES) {
  for (const [quoi, cand] of [
    ['un candidat quelconque', { tokens: [{ token: 'x', start: 0, end: 1 }] }],
    ['un candidat vide', { tokens: [] }],
    ['aucun candidat', null],
  ]) {
    const v = J.compare(n, cand);
    verifier(v.status === NON_MESURABLE && v.reference_en_revision === true,
      `${n} avec ${quoi} : NON-MESURABLE, et la cause est nommée « référence en révision »`);
  }
  verifier(/bp3-engine/.test(String(J.compare(n, { tokens: [] }).detail)),
    `${n} : le détail nomme le propriétaire qui a annoncé la révision`);
}

// ── ET ELLE NE DÉBORDE PAS — le complément, c'est la moitié qui compte ────────────────────────
const autres = Object.keys(byName).filter((n) => !SUSPENDUES.includes(n));
verifier(autres.length > 50, `l'assiette du complément est réelle (${autres.length} autres grammaires)`);
const debordements = autres.filter((n) => {
  const v = J.compare(n, { tokens: [{ token: 'x', start: 0, end: 1 }] });
  return v && v.reference_en_revision;
});
verifier(debordements.length === 0,
  `AUCUNE autre grammaire n'est suspendue — la liste vaut deux noms, pas un de plus`
  + (debordements.length ? ` (déborde sur : ${debordements.join(', ')})` : ''));

// ── LE GARDE MORD : on injecte une troisième suspension et on exige qu'il la voie ─────────────
{
  const commeSiTroisSuspendues = (n) => ['PP', 'check&', 'drum'].includes(n);
  verifier(commeSiTroisSuspendues('drum') && !J.compare('drum', { tokens: [{ token: 'x', start: 0, end: 1 }] }).reference_en_revision,
    "une suspension élargie à une troisième grammaire serait vue : le juge, lui, juge encore `drum`");
}

console.log(`Résultat une_reference_en_revision_ne_se_juge_pas : ${ok} OK, ${ko} FAIL`);
if (ko) process.exit(1);
