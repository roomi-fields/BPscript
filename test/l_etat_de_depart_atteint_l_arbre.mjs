#!/usr/bin/env node
/**
 * GARDE — `@init` porte l'état de départ JUSQU'À L'ARBRE, et son câblage est refusé EN LE DISANT.
 *
 * CE QUI PASSAIT, ET C'EST LE PIRE DES SILENCES : `@init` seul COMPILAIT et ne portait RIEN. Il
 * tombait dans la lecture des directives génériques, qui avale un nom et s'arrête. Une scène
 * pouvait donc écrire son état de départ et le voir disparaître sans une erreur. Un corps, lui,
 * était REFUSÉ (« Expected arrow ») : la moitié muette, la moitié bruyante — le pire arrangement,
 * parce que la moitié muette ne se découvre qu'à l'écoute.
 *
 * CE QUE `@init` PORTE, selon `LANGUAGE.md` § « l'etat de depart » : « ce qui existe au démarrage de
 * la scène et n'appartient à aucune déclaration : le branchement initial, le code lancé une fois,
 * les valeurs de départ. Ce qui appartient à une chose s'initialise DANS sa déclaration. »
 *
 * ⛔ LE BRANCHEMENT N'EST PAS LU, ET C'EST UNE DÉCISION, PAS UN OUBLI. La forme du câblage passe à
 * FaustX (arbitrage Romain, 2026-08-13) et le chantier du patching est GELÉ depuis le 2026-08-09.
 * Écrire un lecteur maintenant figerait une graphie dont le remplacement est décidé. Il est donc
 * REFUSÉ EN LE NOMMANT — un refus nommé vaut mieux qu'un silence, et il tombera de lui-même.
 *
 * LA FORME DE L'ARBRE EST CELLE QUE LA SPEC ÉCRIT, pas une de mon invention : `init: InitEntry[] |
 * null` (AST.md:30), tableau PLAT, entrées de type `BacktickOrphan` (AST.md:657). Une seconde forme
 * obligerait chaque consommateur à connaître la mienne en plus de celle qui est publiée.
 *
 * ⚠️ UN ÉCART SIGNALÉ, PAS COMBLÉ EN SILENCE : `LANGUAGE.md` dit que `@init` porte « les valeurs de
 * départ », `AST.md` définit `InitEntry = PatchExpr | BacktickOrphan` et n'a pas de troisième
 * variante. `AST.md` est un DÉRIVÉ de `LANGUAGE.md` — c'est donc le TYPE qui est en retard. Le sac
 * est porté, et l'écart remonte à Romain.
 *
 * INJECTION dans l'ACCUSÉ et dans le JUGE.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = 'core\nalphabet.western\n';
const arbreDe = (src) => {
  try { const r = compileToBPxAST(src); return { e: r.errors ?? [], ast: r.ast ?? r }; }
  catch (x) { return { e: [{ message: x.message }], ast: null }; }
};

// ─── 0. TÉMOIN — l'absence se dit `null`, pas un tableau vide ────────────────────────────────
{
  const t = arbreDe(`${TETE}\n-----\nS -> C4\n`);
  ok(t.e.length === 0, `0. la scène sans init doit compiler (${t.e[0]?.message})`);
  ok(t.ast.init === null,
     `0. sans init, l'arbre porte null — pas un tableau vide, sinon « la scène n'en a pas » et `
     + `« elle en a un vide » deviennent indistinguables (reçu ${JSON.stringify(t.ast.init)})`);
}

// ─── 1. LE CODE LANCÉ UNE FOIS ATTEINT L'ARBRE ───────────────────────────────────────────────
{
  const t = arbreDe(`${TETE}init\n  \`js: setup()\`\n\n-----\nS -> C4\n`);
  ok(t.e.length === 0, `1. init avec du code doit compiler (${t.e[0]?.message})`);
  ok(Array.isArray(t.ast?.init) && t.ast.init.length === 1,
     `1. l'arbre doit porter UNE entrée (reçu ${JSON.stringify(t.ast?.init)})`);
  const c = t.ast?.init?.[0];
  ok(c?.type === 'BacktickOrphan' && c.tag === 'js' && c.code === 'setup()',
     `1. l'entrée doit être un BacktickOrphan avec son tag et son code — le type est celui que la `
     + `spec nomme, pas un type à moi (reçu ${JSON.stringify(c)})`);
}

// ─── 2. LES VALEURS DE DÉPART AUSSI ──────────────────────────────────────────────────────────
{
  const t = arbreDe(`${TETE}init\n  !(vel:100)\n\n-----\nS -> C4\n`);
  ok(t.e.length === 0, `2. init avec une valeur doit compiler (${t.e[0]?.message})`);
  const v = t.ast?.init?.[0];
  ok(v?.type === 'SettingBag' && v.pairs?.[0]?.key === 'vel' && v.pairs[0].value === 100,
     `2. la valeur de départ doit atteindre l'arbre avec sa clé et sa valeur (reçu ${JSON.stringify(v)})`);
}

// ─── 3. LES DEUX ENSEMBLE, DANS L'ORDRE ÉCRIT ────────────────────────────────────────────────
// Un tableau plat garde l'ordre ; deux tiroirs séparés l'auraient perdu, et l'ordre d'un état de
// départ compte — poser une valeur avant ou après avoir lancé le code n'est pas la même chose.
{
  const t = arbreDe(`${TETE}init\n  !(vel:100)\n  \`js: setup()\`\n\n-----\nS -> C4\n`);
  ok(t.e.length === 0, `3. les deux ensemble doivent compiler (${t.e[0]?.message})`);
  ok(t.ast?.init?.length === 2
     && t.ast.init[0].type === 'SettingBag' && t.ast.init[1].type === 'BacktickOrphan',
     `3. l'ordre ÉCRIT doit être conservé — valeur puis code ici (reçu `
     + `${JSON.stringify((t.ast?.init || []).map((x) => x.type))})`);
}

// ⛔ LA SECTION 4 — LE CABLAGE — EST RETIREE. Le mecanisme sort du langage (Romain,
// 2026-08-18 : « modulation et cablage ils sont obsoletes, ils vont etre remplaces par FauxtX »).
// Elle exigeait que `saw1 >> lpf1` soit REFUSE « en nommant la cause » ; il n y a plus ni signe
// ni cause a nommer — un cablage s ecrit comme n importe quel mot inconnu. Ce qui reste de ce
// fichier porte l ETAT DE DEPART, qui ne bouge pas.


// ─── 5. `init` EST UN SITE SANS ACTEUR — SON LANGAGE VIENT DE LA SCÈNE, PUIS DU SOCLE ───────
// Décision Romain : le langage d'un backtick vient de la place la plus proche qui le nomme, et le
// socle `core` en porte un. Aucun acteur n'entoure `init` : sa cascade est donc scène, puis socle.
//
// ⛔ CE VOLET EXIGEAIT LE REFUS, ET IL A RENDU SERVICE EN ROUGISSANT. Sa raison — « aucun acteur ne
// l'entoure » — était juste, et c'est elle qui a montré que `init` est un QUATRIÈME site sans
// acteur, oublié quand les trois autres ont été branchés. Sans lui, un bloc de code y serait parti
// avec un langage NUL, en silence : le trou aurait changé de place au lieu de se fermer.
{
  const t = arbreDe(`${TETE}init\n  \`setup()\`\n\n-----\nS -> C4\n`);
  ok(t.e.length === 0, `5. un backtick sans tag doit COMPILER dans init — ${t.e[0]?.message}`);
  ok((t.ast?.init || [])[0]?.tag === 'js',
     `5. et porter le langage du SOCLE — reçu ${JSON.stringify((t.ast?.init || [])[0]?.tag)}. Un `
     + `bloc de code qui part avec un langage NUL ne part nulle part, et ne le dit pas.`);
  const s = arbreDe(`${TETE}eval.tidal\ninit\n  \`setup()\`\n\n-----\nS -> C4\n`);
  ok((s.ast?.init || [])[0]?.tag === 'tidal',
     `5. et la SCÈNE l'emporte sur le socle — reçu ${JSON.stringify((s.ast?.init || [])[0]?.tag)}`);
}
// Et un tag inconnu reste refusé, comme partout : la liste des évaluateurs vaut ici aussi.
{
  const t = arbreDe(`${TETE}init\n  \`zz: setup()\`\n\n-----\nS -> C4\n`);
  ok(t.e.some((x) => /évaluateur qui n'est pas déclaré/.test(String(x.message))),
     "5. un tag INCONNU doit être refusé dans init comme ailleurs — le contrôle des évaluateurs "
     + "ne s'arrête pas à la porte de cette directive");
}

// ─── 6. INJECTION DANS LE JUGE — la décision rejouée isolée ──────────────────────────────────
const juger = (entrees) => (entrees === null ? 'absent' : `${entrees.length} entrée(s)`);
ok(juger(null) === 'absent', '6. (se tait) null se lit « absent »');
ok(juger([]) === '0 entrée(s)', '6. (mord) un init vide est PRÉSENT et vide, pas absent');
ok(juger([1, 2]) === '2 entrée(s)', '6. (mord) le compte suit les entrées');

if (echecs.length) {
  console.error(`❌ l'état de départ n'atteint pas l'arbre : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ l'état de départ atteint l'arbre — ${passe} vérification(s) passée(s)`);
}
