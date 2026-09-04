#!/usr/bin/env node
/**
 * GARDE — UN MEMBRE EST UN MOT, ET AVANT LE DÉLIMITEUR SEULE LA VIRGULE LE SÉPARE DU SUIVANT.
 *
 * Deux défauts d'un même lecteur, trouvés le 2026-08-20 en MESURANT une question de rapports —
 * jamais en relisant le code. Le membre a été ouvert le 2026-08-19 (« un membre accepte un nom, un
 * nombre, ou un texte ») ; ces deux-là sont le complément que ce geste n'avait pas écrit.
 *
 * ⛔ 1. UN MEMBRE PRENAIT UN JETON LÀ OÙ UNE VALEUR PREND UN MOT. `ratios(100c, 200c)` ne rougissait
 * pas : il rendait QUATRE membres — `100`, `c`, `200`, `c`. Le tokenizer coupe entre le nombre et la
 * lettre qui le suit ; la VALEUR recolle ce qui se touche, le MEMBRE non. Deux lecteurs du même sac,
 * deux découpes. Une liste de cents doublait de longueur SANS UN SIGNE — et les cents sont 271
 * valeurs de la donnée d'aujourd'hui.
 *
 * ⛔ 2. LA FORME INTERDITE SURVIVAIT SOUS LA PARENTHÈSE QUI LA REMPLACE. `scope:symbol group` est
 * refusé depuis la décision du 2026-08-19 ; `scope(symbol group)` passait en silence et rendait deux
 * membres. Le refus tenait la VALEUR et pas le MEMBRE, parce que le membre est né le même jour,
 * après lui. Une règle posée sur l'endroit où le défaut s'est montré laisse vivre son complément.
 *
 * ⚠️ CE QUI REND CES DEUX-LÀ MUETS EST LA MÊME CHOSE : aucun des deux ne PRODUIT d'erreur. L'un
 * rend des membres en trop, l'autre accepte une graphie morte. Un corpus vert ne les voit ni l'un
 * ni l'autre — c'est pourquoi ce garde lit ce qui SORT, jamais seulement ce qui est refusé.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = 'core\nalphabet.western\n';
/** Les MEMBRES d'une parenthèse imbriquée du déclaratif, ou le refus. */
const membres = (ligne) => {
  let r;
  try { r = compileToBPxAST(`${TETE}${ligne}\n-----\nS -> C4\n`); }
  catch (e) { return { erreurs: ['JETÉ : ' + String(e.message)], cles: null }; }
  const erreurs = (r.errors || []).map((e) => String(e.message ?? e));
  // ⛔ `def f(…)` est un objet RACINE dans `vars` depuis le 2026-09-02 — `def` est le mot unique,
  // `object` est sorti. Le sac se lit là, ou dans `defs` pour les autres corps.
  const noeud = (r.ast?.vars || []).find((d) => d.varType?.kind === 'type' && d.varType.type === null)
    || (r.ast?.defs || [])[0];
  const sac = (noeud?.settings?.pairs || [])[0]?.value;
  return { erreurs, cles: (sac?.pairs || []).map((p) => p.key) };
};
/** Le premier élément du flux, où l'espace sépare depuis toujours. */
const flux = (element) => {
  const r = compileToBPxAST(`${TETE}-----\nS -> ${element}\n`);
  const el = r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs?.[0];
  return { erreurs: (r.errors || []).map((e) => String(e.message ?? e)),
           valeur: ((el?.suffixQualifiers || [])[0]?.pairs || [])[0]?.value };
};

console.log('[membre-mot] un membre est un mot, et la virgule seule le sépare');

// ── A. UN MOT COLLÉ RESTE UN SEUL MEMBRE ────────────────────────────────────────────────────
// La matrice, pas la liste : toutes les façons dont le tokenizer coupe un mot que la donnée écrit.
{
  for (const [ecrit, attendu] of [
    ['ratios(100c, 200c)', ['100c', '200c']],          // cents entiers — 271 dans la donnée
    ['ratios(22.642c)', ['22.642c']],                  // cents décimaux — 53TET, 31TET…
    ['ratios(-1200c, 1200c)', ['-1200c', '1200c']],    // cents signés, le moins est un jeton à part
    ['ratios(12TET, 22shruti)', ['12TET', '22shruti']], // noms d'entrée : chiffre puis lettres
    ['range(-1200, 1200)', ['-1200', '1200']],         // TÉMOIN — le nombre signé ne régresse pas
    ['ratios(1, 2, 3)', ['1', '2', '3']],              // TÉMOIN — le nombre nu ne régresse pas
    ['ratios(a, b)', ['a', 'b']],                      // TÉMOIN — le nom ne régresse pas
  ]) {
    const r = membres(`def f(${ecrit})`);
    ok(r.erreurs.length === 0, `A. '${ecrit}' doit compiler — ${r.erreurs[0]}`);
    ok(JSON.stringify(r.cles) === JSON.stringify(attendu),
      `A. '${ecrit}' doit rendre ${JSON.stringify(attendu)} — reçu ${JSON.stringify(r.cles)}. `
      + `Un membre est un MOT : le tokenizer coupe entre le nombre et son unité, et ce lecteur `
      + `doit recoller ce qui se touche, comme une valeur le fait.`);
  }
  // ⛔ ET LE TEXTE NE SE RECOLLE À RIEN : il porte son délimiteur, donc il est complet.
  const t = membres('def f(registers("0", "1"))');
  ok(JSON.stringify(t.cles) === JSON.stringify(['0', '1']),
    `A. un membre TEXTE reste entier et seul — reçu ${JSON.stringify(t.cles)}`);
}

// ── B. AVANT LE DÉLIMITEUR, SEULE LA VIRGULE SÉPARE — MEMBRE COMPRIS ────────────────────────
// ⛔ LE VOLET QUI MANQUAIT. La valeur était tenue, le membre non : la graphie retirée du langage
// revenait par la parenthèse qui existe pour la remplacer.
{
  for (const [ecrit, reecrit] of [
    ['def f(scope(symbol group))', 'symbol, group'],
    ['def f(ratios(1 2 3))', '1, 2'],
    ['def f(args(pivot factor))', 'pivot, factor'],
    ['def f(ratios(100 c))', '100, c'],
  ]) {
    const r = membres(ecrit);
    ok(r.erreurs.length >= 1,
      `B. '${ecrit}' doit être REFUSÉ — avant le délimiteur l'espace ne sépare rien`);
    ok((r.erreurs[0] || '').includes(reecrit),
      `B. et le refus doit porter sa RÉÉCRITURE '${reecrit}' — un auteur qui écrit cette forme `
      + `l'a écrite légitimement la veille. Reçu : ${(r.erreurs[0] || '').slice(0, 160)}`);
  }
  // ⛔ TÉMOIN NON NUL — la virgule, elle, sépare. Sans lui, un lecteur qui refuserait TOUTE
  // parenthèse imbriquée passerait ce volet en triomphe.
  const v = membres('def f(scope(symbol, group))');
  ok(v.erreurs.length === 0 && JSON.stringify(v.cles) === JSON.stringify(['symbol', 'group']),
    `B-témoin. la virgule doit séparer — reçu ${JSON.stringify(v.cles)} · ${v.erreurs[0] || ''}`);
}

// ── B-bis. UN REFUS DIT CE QUI EST ÉCRIT — PAS UNE CAUSE QU'IL SUPPOSE ──────────────────────
// ⛔ MA PREMIÈRE ÉCRITURE DU VOLET B ACCUSAIT TOUJOURS UNE ESPACE. `ratios(256/243)` n'en porte
// AUCUNE, et le refus lui répondait « deux termes sont separes par une espace », en proposant
// « 256, / » — une réécriture absurde sous une conclusion juste. SEPT signes collés tombaient
// dedans : / + ! = * < [.
//
// Un message de refus FAIT AUTORITÉ : l'auteur cherche l'espace qu'on lui nomme, et il n'y en a
// pas. Une raison fausse coûte plus cher qu'un refus muet — elle envoie chercher ailleurs.
{
  for (const [ecrit, signe] of [
    // ⛔ LA BARRE A QUITTÉ CETTE LISTE — décision Romain 2026-08-20 : un rapport EST un objet, donc
    // un membre. Son volet est RETOURNÉ en B-ter. Les six autres signes restent refusés : ce volet
    // garde la QUALITÉ du refus, et cette qualité vaut toujours pour eux.
    ['def f(r(a+b))', '+'], ['def f(r(a!b))', '!'],
    ['def f(r(a=b))', '='], ['def f(r(a*b))', '*'], ['def f(r(a<b))', '<'],
    ['def f(r(a[b]))', '['],
  ]) {
    const r = membres(ecrit);
    ok(r.erreurs.length >= 1, `B-bis. '${ecrit}' doit être refusé`);
    const msg = r.erreurs[0] || '';
    ok(msg.includes(`'${signe}'`),
      `B-bis. le refus de '${ecrit}' doit NOMMER le signe '${signe}' — reçu : ${msg.slice(0, 130)}`);
    ok(!/separated by a space/.test(msg),
      `B-bis. et NE PAS accuser une espace que la source ne porte pas — '${ecrit}' n'en a aucune. `
      + `Reçu : ${msg.slice(0, 130)}`);
  }
  // ⛔ TÉMOIN NON NUL — le vrai cas d'espace garde son message, sinon la correction l'a mangé.
  const e = membres('def f(r(a b))');
  ok(/separated by a space/.test(e.erreurs[0] || ''),
    `B-bis-témoin. une VRAIE espace doit garder son message — reçu : ${(e.erreurs[0] || '').slice(0, 120)}`);
}

// ── B-ter. ⛔ ET LA BARRE PASSE, ELLE — le volet retourné ─────────────────────────────────────
// Ce que B-bis gardait pour la barre — « `256/243` est refusé » — était vrai jusqu'au 2026-08-20 et
// ne l'est plus : « une énumération contient tous types d'objets, et un rapport en est un ». Le
// RETOURNER plutôt que le supprimer garde le sujet — la barre reste éprouvée, dans l'autre sens.
{
  const r = membres('def f(ratios(1, 256/243, 9/8, 32/27))');
  ok(r.erreurs.length === 0, `B-ter. la forme de la décision doit PASSER — reçu ${JSON.stringify(r.erreurs)}`);
  ok(JSON.stringify(r.cles) === JSON.stringify(['1', '256/243', '9/8', '32/27']),
    `B-ter. et rendre QUATRE membres, pas sept — reçu ${JSON.stringify(r.cles)}`);
  // ⚠️ ET LA RÈGLE DE L'ESPACE TIENT : c'est le COLLAGE qui fait le membre, pas le signe.
  ok(membres('def f(r(a / b))').erreurs.length >= 1,
    "B-ter. une barre ESPACÉE reste refusée — l'espace sépare, il ne recolle pas");
}

// ── C. APRÈS LE DÉLIMITEUR, RIEN NE CHANGE ──────────────────────────────────────────────────
// Le même lecteur de sac sert les deux mondes. Une correction du déclaratif qui suivrait dans le
// flux y casserait l'espace, qui y sépare les termes depuis toujours.
{
  const k = flux('C4(keyxpand:C4 2)');
  ok(k.erreurs.length === 0 && k.valeur === 'C4 2',
    `C. '(keyxpand:C4 2)' doit compiler dans le FLUX et porter ses deux parties — reçu `
    + `${JSON.stringify(k.valeur)} · ${k.erreurs[0]?.slice(0, 110) || ''}`);
  const s = flux('C4(scale:0 0)');
  ok(s.erreurs.length === 0 && s.valeur === '0 0',
    `C. '(scale:0 0)' aussi — reçu ${JSON.stringify(s.valeur)}`);
  const v = flux('C4(vel:80)');
  ok(v.erreurs.length === 0 && v.valeur === 80, 'C-témoin. une valeur simple du flux ne bouge pas');
}

// ── D. AUCUNE LISTE PUBLIÉE NE PORTE LA TRACE D'UN MOT DÉCOUPÉ ──────────────────────────────
// ⛔ LE VOLET QUI COMPTE. Le mode d'échec n'est pas un refus manquant, c'est une LISTE PLUS LONGUE
// que sa source, et rien ne rougit. Sa trace est exacte : un membre purement NUMÉRIQUE suivi d'un
// membre qui n'est qu'une UNITÉ — `[…, "100", "c", …]`.
//
// ⚠️ LE CRITÈRE SE MESURE À CE QU'IL EXCLUT. Ma première écriture accusait toute lettre seule et
// rougissait sur `baseNote:"A"` et sur des symboles d'homomorphisme, tous légitimes : un critère
// qui n'exclut pas la faute n'accuse rien de précis. C'est la SUITE des deux qui est la découpe.
{
  let listes = 0;
  let vues = 0;
  const decoupes = [];
  const cents = [];
  const NOMBRE_NU = (x) => typeof x === 'string' && /^-?\d+(\.\d+)?$/.test(x);
  const UNITE_SEULE = (x) => typeof x === 'string' && /^[a-zA-Z]$/.test(x);
  const descendre = (o, chemin) => {
    if (typeof o === 'string') { vues++; if (/^-?\d+(\.\d+)?c$/.test(o)) cents.push(o); return; }
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      listes++;
      for (let i = 0; i < o.length - 1; i++) {
        if (NOMBRE_NU(o[i]) && UNITE_SEULE(o[i + 1])) {
          decoupes.push(`${chemin}[${i}] = ${JSON.stringify(o[i])}, ${JSON.stringify(o[i + 1])}`);
        }
      }
    }
    for (const [k, v] of Object.entries(o)) descendre(v, `${chemin}.${k}`);
  };
  for (const nom of Object.keys(LIBS)) descendre(LIBS[nom], nom);
  ok(vues >= 5000, `D. le balayage doit voir la donnée entière — ${vues} chaîne(s)`);
  ok(listes >= 400, `D. et ses listes — ${listes} liste(s) examinée(s)`);
  ok(cents.length >= 200,
    `D. la donnée doit porter ses cents — ${cents.length} mesuré(s), 271 le jour du geste. `
    + `S'ils disparaissent, ce garde ne protège plus rien de vivant.`);
  ok(decoupes.length === 0,
    `D. aucune liste publiée ne doit porter un nombre SUIVI de son unité détachée — c'est la trace `
    + `exacte d'un mot découpé. Reçu : ${decoupes.slice(0, 5).join(' · ')}`);
  // ⛔ TÉMOIN NON NUL : le critère doit SAVOIR voir la découpe, et NE PAS accuser ce qui est sain.
  const faux = [];
  const sain = [];
  const juger = (l, seau) => { for (let i = 0; i < l.length - 1; i++) {
    if (NOMBRE_NU(l[i]) && UNITE_SEULE(l[i + 1])) seau.push(l[i]); } };
  juger(['1', '100', 'c', '200', 'c'], faux);
  juger(['1', '100c', '200c'], sain);
  juger(['A', 'B', 'C'], sain);            // `baseNote`-like : des lettres seules, légitimes
  ok(faux.length === 2, `D-témoin. le critère doit voir les DEUX découpes fabriquées — ${faux.length}`);
  ok(sain.length === 0, 'D-témoin. et n\'accuser NI la liste recollée NI des lettres légitimes');
}

ok(passe >= 50, `le garde doit avoir EXAMINÉ, pas seulement tourné(${passe} assertions)`);

if (echecs.length) {
  console.error(`[membre-mot] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[membre-mot] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
