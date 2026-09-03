#!/usr/bin/env node
/**
 * GARDE — UNE CLÉ OUVRE UNE PARENTHÈSE, ET CE QU'ELLE PORTE ARRIVE STRUCTURÉ.
 *
 * Décision Romain, 2026-08-19 : la récursivité des librairies s'exprime par les parenthèses et le
 * point ; l'indentation ne porte rien ; **le deux-points disparaît devant une parenthèse** — un
 * signe, un rôle.
 *
 * ⛔ CE QUI REND CE GARDE NÉCESSAIRE N'EST PAS L'ABSENCE, C'EST LE SILENCE VOISIN. Écrite avec le
 * deux-points dans un corps indenté, `range:(16, 8000)` COMPILAIT et rendait deux morceaux de
 * texte — `["(16,", "8000)"]` — parce que ce qui suit un deux-points y est découpé aux espaces.
 * Une graphie acceptée qui ne porte rien perd la donnée **sans un mot**, et le portillon reste vert.
 *
 * Le garde mesure donc DEUX choses à chaque forme : qu'elle compile, ET que l'arbre porte la
 * STRUCTURE. Vérifier la seule compilation certifierait exactement le défaut qu'on ferme.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const T = 'core\nalphabet.western\n';
const lire = (ligne) => {
  const r = compileToBPxAST(`${T}${ligne}\n-----\nS -> C4\n`);
  return { erreurs: (r.errors || []).map((e) => String(e.message ?? e)),
           // `def x(…)` est un objet RACINE depuis le 2026-09-02 : il vit dans `vars`, pas dans `defs`.
           paires: ((r.ast?.vars || []).find((v) => v.varType?.kind === 'type' && v.varType.type === null)
                    || (r.ast?.defs || [])[0])?.settings?.pairs };
};
/** La valeur portée par une clé, au bout d'un chemin de clés. */
const valeur = (paires, ...chemin) => {
  let courant = paires;
  for (const cle of chemin) {
    // ⛔ LE GARDE NE DOIT PAS PLANTER SUR CE QU'IL MESURE. Une injection qui rend une CHAÎNE là où
    // on attend une structure faisait exploser cette descente — et un plantage n'est pas un échec :
    // il ne dit pas ce qui manque, et il emporte les assertions qui suivent.
    if (!Array.isArray(courant)) return undefined;
    const p = courant.find((x) => x.key === cle);
    if (!p) return undefined;
    courant = p.value?.pairs ?? p.value;
  }
  return courant;
};
/** La valeur BRUTE d'une clé, sans déréférencer sa structure — c'est elle qui dit sa NATURE. */
const brute = (paires, cle) => (paires || []).find((x) => x.key === cle)?.value;

console.log('[parenthèse] la récursivité par la parenthèse, et ce qu\'elle porte');

// ── 1. UN NIVEAU — la valeur est un OBJET, pas du texte ─────────────────────────────────────
{
  const { erreurs, paires } = lire('def d(range(min:16, max:8000), unit:Hz)');
  ok(erreurs.length === 0, `1. la forme doit COMPILER(reçu : ${erreurs[0]?.slice(0, 110)})`);
  ok(valeur(paires, 'range', 'min') === 16, `1. 'min' doit arriver comme le NOMBRE 16 — reçu ${JSON.stringify(valeur(paires, 'range', 'min'))}`);
  ok(valeur(paires, 'range', 'max') === 8000, `1. 'max' doit arriver comme le NOMBRE 8000`);
  ok(valeur(paires, 'unit') === 'Hz', `1. la clé PLATE d'à côté reste intacte — reçu ${JSON.stringify(valeur(paires, 'unit'))}`);
  // ⛔ LE VOLET QUI COMPTE : pas de texte brut là où on attend une structure.
  ok(brute(paires, 'range')?.type === 'SettingBag',
    `1. la valeur de 'range' doit être une STRUCTURE, jamais une chaîne ni un tableau de morceaux — `
    + `c'est le mode d'échec exact qu'on ferme(reçu : ${JSON.stringify(brute(paires, 'range'))?.slice(0, 90)})`);
}

// ── 2. DEUX NIVEAUX — une parenthèse descend d'un niveau, sans limite ────────────────────────
{
  const { erreurs, paires } = lire('def tabla(terminals(dha(voice:bayan_open), ta(voice:dayan_tap)))');
  ok(erreurs.length === 0, `2. deux niveaux doivent COMPILER(reçu : ${erreurs[0]?.slice(0, 110)})`);
  ok(valeur(paires, 'terminals', 'dha', 'voice') === 'bayan_open',
    `2. la feuille au bout de DEUX parenthèses doit arriver — reçu ${JSON.stringify(valeur(paires, 'terminals', 'dha', 'voice'))}`);
  ok(valeur(paires, 'terminals', 'ta', 'voice') === 'dayan_tap', '2. et la seconde aussi');
}
{
  const { erreurs, paires } = lire('def x(a(b(c(d:1))))');
  ok(erreurs.length === 0, `3. QUATRE niveaux doivent COMPILER(reçu : ${erreurs[0]?.slice(0, 90)})`);
  ok(valeur(paires, 'a', 'b', 'c', 'd') === 1, '3. et la feuille arrive au bout des quatre');
}

// ── 4. LE COLLAGE EST EXIGÉ — une parenthèse SÉPARÉE n'appartient pas à la clé ───────────────
{
  const { erreurs } = lire('def d(range (16, 8000))');
  ok(erreurs.length >= 1,
    '4. une parenthèse séparée par une espace ne doit PAS être portée par la clé — sinon l\'espace '
    + 'cesserait de séparer les termes, à cet endroit seulement');
}

// ── 5. ⛔ LE TÉMOIN NON NUL — la forme PLATE est intacte ─────────────────────────────────────
// Sans lui, un lecteur qui casserait le sac ordinaire passerait tous les volets ci-dessus.
{
  const { erreurs, paires } = lire('def fort(vel:100, dur:2)');
  ok(erreurs.length === 0, '5. TÉMOIN — le sac plat doit COMPILER');
  ok(valeur(paires, 'vel') === 100 && valeur(paires, 'dur') === 2,
    `5. TÉMOIN — et rendre ses deux couples(reçu : ${JSON.stringify(paires)?.slice(0, 100)})`);
}

// ── 6. CE QUE CE GESTE N'A PAS OUVERT — mesuré, pas supposé ─────────────────────────────────
// ⛔ UN NOM NU DANS UN SAC EST DEVENU LISIBLE PAR CONSÉQUENCE, pas par intention : la récursion
// passe par le lecteur existant, qui lit déjà une clé sans valeur. La déclaration EN TÊTE, elle,
// suit un autre chemin et continue d'exiger `clé:valeur`. Deux chemins, une seule graphie — c'est
// une mesure, et elle doit rougir le jour où l'un des deux bouge.
{
  const nu = lire('def s(terminals(a, b, c))');
  ok(nu.erreurs.length === 0, '6. un nom NU dans un sac est LU — conséquence de la récursion');
  ok(valeur(nu.paires, 'terminals', 'a') === true,
    `6. et il arrive avec la valeur des clés sans argument — reçu ${JSON.stringify(valeur(nu.paires, 'terminals', 'a'))}`);
  const tete = lire('flag section(a, b, c)');
  ok(tete.erreurs.length >= 1,
    '6. la déclaration EN TÊTE n\'est PAS touchée : elle exige toujours `clé:valeur`. Si elle '
    + 'accepte, les deux chemins ont fusionné et ce garde doit être relu.');
}

ok(passe >= 15, `le garde doit avoir EXAMINÉ, pas seulement tourné(${passe} assertions)`);

if (echecs.length) {
  console.error(`[parenthèse] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[parenthèse] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
