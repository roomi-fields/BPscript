#!/usr/bin/env node
/**
 * GARDE — LA VIRGULE SÉPARE LES ÉLÉMENTS D'UN SAC, L'ESPACE SÉPARE LES PARTIES D'UNE VALEUR.
 *
 * Décision Romain, 2026-07-26, rappelée le 2026-08-19. Le séparateur a toujours fonctionné ainsi —
 * ce qui variait, c'est OÙ on regardait : dans un corps de librairie INDENTÉ il n'y a pas de sac, la
 * valeur est le RESTE DE LA LIGNE, virgule comprise. La règle n'a donc jamais été appliquée LÀ, et
 * deux valeurs en ont vécu.
 *
 * ⛔ CE QUI REND CE GARDE NÉCESSAIRE : la donnée fautive a fait naître son propre passe-droit dans le
 * parseur — un champ `argType:composite` qui faisait avaler la virgule au lieu de la refuser. Une
 * rustine de ce genre ne protège pas une règle, elle protège une exception, et elle rend l'exception
 * INVISIBLE : la forme interdite compilait sans un mot. Le garde tient donc les DEUX bouts — la
 * donnée publiée ET le refus du parseur — parce que fermer l'un sans l'autre laisse la porte ouverte.
 *
 * ⚠️ `argType:interval` N'EST PAS LA MÊME CHOSE et reste vivant : il lit une fraction, des cents ou
 * un décimal (`transpose:3/2`, `700c`), et n'a jamais eu affaire à la virgule. Le garde le PROUVE
 * vivant — sans quoi le prochain élagage l'emporterait avec son homonyme.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

console.log('[virgule] la virgule sépare les éléments, l\'espace sépare les parties');

// ── A. LA DONNÉE PUBLIÉE — L'ESPACE, PAS UN SITE ────────────────────────────────────────────
// ⛔ ON ÉCRIT LA PORTÉE **ET SON COMPLÉMENT** : toute librairie, toute entrée, tout champ de VALEUR.
// Réparer les deux entrées trouvées laisserait l'espace où le défaut peut revenir.
//
// La PROSE est exclue, et nommément : une description, une note, une source et une unité sont des
// phrases pour un humain, la virgule y est de la ponctuation. Un corps de fonction digitale est du
// code. Tout le reste est une VALEUR, et une valeur ne porte pas de virgule.
const PROSE = new Set(['description', 'unit', 'body', '_note', '_source', '_comment',
  '_anchor_note', '_source_ancre', '_note_doc', 'version']);
const estProse = (cle) => PROSE.has(cle) || cle.startsWith('_');

// ⛔ LE CODE EXTERNE SE RECONNAÎT À SON SIGNE, PAS AU NOM DU CHAMP QUI LE PORTE.
//
// L'exclusion « un corps de fonction est du code » existait depuis l'origine, mais elle était écrite
// sur un LIEU — le champ `body`, seul endroit où du code vivait alors. Le 2026-08-30, les quinze
// corps de voix sont devenus des fonctions JavaScript (décision de Romain : « des fonctions js
// simples qui produisent du son »), et une fonction à trois paramètres ne s'écrit pas sans virgule :
// `(t, dur, env) => …`. La règle du séparateur n'a pas bougé — elle porte sur les valeurs DU
// LANGAGE, et un backtick est du code que le langage TRANSPORTE, opaque par construction.
//
// ⇒ Le discriminant est donc le backtick, que le langage écrit pour dire « ceci n'est pas à moi ».
// MESURÉ sur la donnée entière au moment de la frappe : 7314 feuilles, 15 valeurs entièrement
// délimitées par des backticks — les quinze corps de voix, et RIEN d'autre. Le champ `body` n'en
// porte aucune : les deux exclusions gardent des choses différentes, aucune n'absorbe l'autre.
//
// ⚠️ LA DÉLIMITATION EST EXIGÉE AUX DEUX BOUTS. Un backtick au MILIEU d'une valeur ne la rend pas
// opaque — sans quoi une seule apostrophe inversée suffirait à faire passer n'importe quelle liste.
const estCodeExterne = (v) => /^`[\s\S]*`$/.test(v.trim());

let feuilles = 0;
const fautives = [];
const descendre = (o, chemin, cleCourante) => {
  if (typeof o === 'string') {
    feuilles++;
    if (o.includes(',') && !estProse(cleCourante) && !estCodeExterne(o)) fautives.push([chemin, o]);
    return;
  }
  if (!o || typeof o !== 'object') { feuilles++; return; }
  for (const [k, v] of Object.entries(o)) {
    // Dans un TABLEAU, la clé porteuse reste celle du champ, pas l'indice.
    descendre(v, `${chemin}.${k}`, Array.isArray(o) ? cleCourante : k);
  }
};
for (const nom of Object.keys(LIBS)) descendre(LIBS[nom], nom, nom);

ok(fautives.length === 0,
  `A. ${fautives.length} valeur(s) publiée(s) portent une virgule là où l'espace sépare les parties : `
  + fautives.slice(0, 6).map(([c, v]) => `${c} = ${JSON.stringify(v).slice(0, 50)}`).join(' · '));
// ⛔ UN GARDE COMPTE CE QU'IL A EXAMINÉ ET REFUSE D'AVOIR EXAMINÉ ZÉRO.
ok(feuilles >= 5000, `A. le balayage doit voir la donnée entière — ${feuilles} feuille(s) vue(s)`);

// ⛔ TÉMOIN DE PORTÉE, À VALEUR NON NULLE. Sans lui, une exclusion de prose trop large absoudrait
// tout et le volet A serait vert sur une donnée entièrement fautive.
{
  const faux = { lib: { controls: { x: { value: '0,1' } } } };
  const avant = fautives.length;
  descendre(faux, 'témoin', 'témoin');
  ok(fautives.length === avant + 1,
    `A-témoin. le balayage doit VOIR une virgule injectée dans un 'value' — il n'en a vu que `
    + `${fautives.length - avant}. Une exclusion trop large rendrait le volet A décoratif.`);
  fautives.length = avant;
}

// ⛔ TÉMOIN DE L'EXCLUSION PAR BACKTICK — elle doit être une frontière, jamais un passe-droit.
// Les trois cas se distinguent : ce qui est DÉLIMITÉ par des backticks est du code et sort du
// jugement ; ce qui en porte un au milieu, ou d'un seul côté, reste une valeur et se juge.
{
  const avant = fautives.length;
  descendre({ x: '`js: (t, dur) => t`' }, 'témoin-code', 'x');
  ok(fautives.length === avant,
    `A-témoin. une valeur entièrement entre backticks est du CODE — la virgule y appartient au `
    + `langage invité, pas au mien. Le balayage n'aurait pas dû l'accuser.`);

  for (const [quoi, valeur] of [
    ['un backtick au MILIEU', 'a,b `js: x` c'],
    ['un backtick à GAUCHE seulement', '`js: a,b'],
    ['un backtick à DROITE seulement', 'a,b`'],
  ]) {
    const n = fautives.length;
    descendre({ x: valeur }, 'témoin-partiel', 'x');
    ok(fautives.length === n + 1,
      `A-témoin. ${quoi} ne rend PAS une valeur opaque — elle doit rester jugée, sans quoi une `
      + `seule apostrophe inversée ferait passer n'importe quelle liste.`);
  }
  fautives.length = avant;
}

// ── B. `argType` — LA RUSTINE EST PARTIE, SON HOMONYME EST VIVANT ───────────────────────────
{
  const vus = [];
  const chercher = (o) => {
    if (!o || typeof o !== 'object') return;
    if (!Array.isArray(o) && o.argType !== undefined) vus.push(o.argType);
    for (const v of Object.values(o)) chercher(v);
  };
  for (const nom of Object.keys(LIBS)) chercher(LIBS[nom]);
  ok(!vus.includes('composite'),
    `B. aucune librairie ne doit déclarer 'argType:composite' — c'est le passe-droit de la virgule. `
    + `Reçu : ${JSON.stringify(vus)}`);
  ok(vus.includes('interval'),
    `B. et 'argType:interval' doit rester DÉCLARÉ — il lit une fraction, jamais une virgule, et un `
    + `élagage par homonymie l'emporterait. Reçu : ${JSON.stringify(vus)}`);
}

// ── C. LE PARSEUR — L'EXCEPTION EST REFUSÉE, LA RÈGLE PASSE ─────────────────────────────────
// Fermer la donnée sans fermer le lecteur laisserait la forme interdite compiler pour qui l'écrit
// à la main. Les deux bouts, ou rien.
const lire = (flux) => {
  const r = compileToBPxAST(`core\nalphabet.western\n-----\nS -> ${flux}\n`);
  const el = r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs?.[0];
  const sac = (el?.suffixQualifiers || [])[0];
  return { erreurs: (r.errors || []).map((e) => String(e.message ?? e)),
           valeur: (sac?.pairs || [])[0]?.value };
};
{
  const virgule = lire('C4(keyxpand:C4,2)');
  ok(virgule.erreurs.length >= 1,
    'C. `keyxpand:C4,2` doit être REFUSÉ — la virgule y sépare deux éléments de sac, et le second '
    + 'n\'est pas une paire. Si ça compile, le passe-droit est revenu.');

  const espace = lire('C4(keyxpand:C4 2)');
  ok(espace.erreurs.length === 0, `C. \`keyxpand:C4 2\` doit COMPILER(reçu : ${espace.erreurs[0]})`);
  // ⛔ COMPILER NE SUFFIT PAS : c'est la forme où l'ancien défaut perdait la moitié de la valeur.
  ok(espace.valeur === 'C4 2',
    `C. et porter ses DEUX parties — c'est ici que l'aval criait « needs a pivot note and a factor ». `
    + `Reçu ${JSON.stringify(espace.valeur)}`);

  const scale = lire('C4(scale:0 0)');
  ok(scale.erreurs.length === 0 && scale.valeur === '0 0',
    `C. \`scale:0 0\` doit compiler et porter ses deux parties — reçu ${JSON.stringify(scale.valeur)}`);
}
{
  // TÉMOIN — l'autre `argType` lit toujours ses trois formes.
  for (const [ecrit, attendu] of [['3/2', '3/2'], ['700c', '700c'], ['1.5', '1.5']]) {
    const r = lire(`C4(transpose:${ecrit})`);
    ok(r.erreurs.length === 0 && String(r.valeur) === attendu,
      `C-témoin. \`transpose:${ecrit}\` doit rester lu comme un INTERVALLE — reçu `
      + `${JSON.stringify(r.valeur)} ${r.erreurs[0] || ''}`);
  }
}

console.log(`[virgule] ${feuilles} feuille(s) de donnée balayée(s), 0 virgule hors prose`);

if (echecs.length) {
  console.error(`[virgule] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[virgule] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
