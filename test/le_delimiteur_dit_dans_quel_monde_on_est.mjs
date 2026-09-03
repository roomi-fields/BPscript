#!/usr/bin/env node
/**
 * GARDE — LE DÉLIMITEUR DIT DANS QUEL MONDE ON EST.
 *
 * Décision Romain, 2026-08-19 : dans le DÉCLARATIF, seule la virgule sépare — l'espace n'y sépare
 * rien, il est de la mise en forme, comme l'indentation. Une valeur n'a qu'UNE partie ; plusieurs
 * parties sont plusieurs valeurs, et elles s'écrivent par une parenthèse et des noms. Dans le FLUX
 * rien ne change : l'espace y sépare les termes.
 *
 * ⛔ LE MÊME LECTEUR DE SAC SERT LES DEUX CÔTÉS. C'est ce qui rend ce garde nécessaire : la règle
 * n'est pas « cette graphie sort du langage », elle est « cette graphie change de sens selon sa
 * POSITION ». Un garde qui ne tiendrait que le refus laisserait passer la correction qui ferme aussi
 * le flux — et le flux est l'endroit où l'espace sépare depuis toujours.
 *
 * ⛔ ET LE REFUS PORTE SA RÉÉCRITURE. Un auteur qui écrit `scope:symbol group` a écrit une forme
 * vivante il y a un jour ; un refus qui ne lui donne pas `scope(symbol, group)` le laisse deviner.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = 'core\nalphabet.western\n';
const declaratif = (ligne) => {
  const r = compileToBPxAST(`${TETE}${ligne}\n-----\nS -> C4\n`);
  return { erreurs: (r.errors || []).map((e) => String(e.message ?? e)),
           pairs: (r.ast?.defs || [])[0]?.settings?.pairs };
};
const flux = (element) => {
  const r = compileToBPxAST(`${TETE}-----\nS -> ${element}\n`);
  const el = r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs?.[0];
  return { erreurs: (r.errors || []).map((e) => String(e.message ?? e)),
           valeur: ((el?.suffixQualifiers || [])[0]?.pairs || [])[0]?.value };
};

console.log('[délimiteur] le délimiteur dit dans quel monde on est');

// ── A. AVANT LE DÉLIMITEUR — UNE VALEUR N'A QU'UNE PARTIE ───────────────────────────────────
for (const [ecrit, reecrit] of [
  ['def f (scope:symbol group)', 'scope(symbol, group'],
  ['def f (scope:symbol group rule flow)', 'scope(symbol, group'],
  ['def f (value:0 1)', 'value(0, 1'],
  ['def f (args:pivot factor)', 'args(pivot, factor'],
]) {
  const r = declaratif(ecrit);
  ok(r.erreurs.length >= 1,
    `A. '${ecrit}' doit être REFUSÉ dans le déclaratif — l'espace n'y sépare rien`);
  ok((r.erreurs[0] || '').includes(reecrit),
    `A. et le refus doit porter sa RÉÉCRITURE '${reecrit}' — reçu : ${(r.erreurs[0] || '').slice(0, 150)}`);
}
// ⛔ TÉMOIN NON NUL — ce qui n'a qu'une partie passe, et la parenthèse aussi. Sans lui, un lecteur
// qui refuserait TOUTE valeur déclarative passerait le volet A en triomphe.
{
  ok(declaratif('def f (scope:symbol)').erreurs.length === 0,
    'A-témoin. une valeur à UNE partie doit passer dans le déclaratif');
  const p = declaratif('def f (scope(symbol, group))');
  ok(p.erreurs.length === 0, `A-témoin. la parenthèse est la forme de remplacement — elle doit passer (${p.erreurs[0]})`);
  ok(declaratif('def f (x:"deux mots")').erreurs.length === 0,
    'A-témoin. un TEXTE délimité porte ses espaces — ce sont ses caractères, pas des séparateurs');
}

// ── B. APRÈS LE DÉLIMITEUR — RIEN NE CHANGE ─────────────────────────────────────────────────
// Le volet qui compte : l'espace sépare les termes dans le flux depuis toujours, et la correction
// du déclaratif ne doit pas l'y suivre.
{
  const k = flux('C4(keyxpand:C4 2)');
  ok(k.erreurs.length === 0, `B. '(keyxpand:C4 2)' doit COMPILER dans le flux — reçu ${k.erreurs[0]?.slice(0, 120)}`);
  ok(k.valeur === 'C4 2',
    `B. et porter ses DEUX parties — c'est là que l'aval attend un pivot et un facteur. Reçu ${JSON.stringify(k.valeur)}`);
  const s = flux('C4(scale:0 0)');
  ok(s.erreurs.length === 0 && s.valeur === '0 0',
    `B. '(scale:0 0)' doit compiler dans le flux et porter ses deux parties — reçu ${JSON.stringify(s.valeur)}`);
  const v = flux('C4(vel:80)');
  ok(v.erreurs.length === 0 && v.valeur === 80, `B-témoin. une valeur simple du flux ne bouge pas`);
}

// ── C. LA DONNÉE PUBLIÉE — UN DÉFAUT À PLUSIEURS PARTIES EST DEVENU PLUSIEURS VALEURS ───────
// ⛔ `args` NOMMAIT DÉJÀ LES PARTIES : le défaut cesse d'être une chaîne à découper et devient un
// défaut PAR PARAMÈTRE. C'est la donnée qui prouve que la règle a été appliquée, pas seulement
// que la graphie a été refusée.
{
  const t = LIBS.transpo?.controls || {};
  for (const [nom, attendu] of [
    ['scale', { name: 0, blockkey: 0 }],
    ['keyxpand', { pivot: 0, factor: 1 }],
  ]) {
    ok(JSON.stringify(t[nom]?.value) === JSON.stringify(attendu),
      `C. transpo.${nom}.value doit être ${JSON.stringify(attendu)} — un défaut par paramètre, `
      + `jamais une chaîne à découper. Reçu ${JSON.stringify(t[nom]?.value)}`);
    // Et les noms viennent d'`args`, qui les déclarait déjà : les deux doivent s'accorder.
    ok(JSON.stringify(Object.keys(t[nom]?.value || {})) === JSON.stringify(t[nom]?.args),
      `C. et ses clés doivent être exactement ses 'args' (${JSON.stringify(t[nom]?.args)}) — reçu `
      + `${JSON.stringify(Object.keys(t[nom]?.value || {}))}`);
  }
}

// ── D. AUCUNE VALEUR PUBLIÉE À PLUSIEURS PARTIES DANS UNE LIBRAIRIE RÉÉCRITE ────────────────
// Les sept librairies encore en corps indenté en portent 288 ; elles tombent avec leur réécriture.
// Le garde tient ce qui EST réécrit, et il grandit tout seul.
{
  const reecrites = ['variation', 'transpo', 'octaves', 'sounds'];
  let examinees = 0;
  const fautives = [];
  const descendre = (o, chemin, cle) => {
    if (typeof o === 'string') {
      examinees++;
      if (cle !== 'description' && !cle.startsWith('_') && /\S\s+\S/.test(o)) fautives.push([chemin, o]);
      return;
    }
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) descendre(v, `${chemin}.${k}`, Array.isArray(o) ? cle : k);
  };
  for (const nom of reecrites) descendre(LIBS[nom], nom, nom);
  ok(examinees >= 40, `D. le balayage doit voir les valeurs des librairies réécrites — ${examinees} vue(s)`);
  ok(fautives.length === 0,
    `D. aucune valeur publiée d'une librairie réécrite ne doit porter plusieurs parties — reçu : `
    + fautives.slice(0, 4).map(([c, v]) => `${c} = ${JSON.stringify(v).slice(0, 40)}`).join(' · '));
}

ok(passe >= 20, `le garde doit avoir EXAMINÉ, pas seulement tourné (${passe} assertions)`);

if (echecs.length) {
  console.error(`[délimiteur] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[délimiteur] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
