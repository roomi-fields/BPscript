#!/usr/bin/env node
/**
 * GARDE — LE LANGAGE D'UN BACKTICK VIENT DE LA PLACE LA PLUS PROCHE QUI LE NOMME.
 *
 * Trois niveaux, décision Romain : l'ACTEUR qui qualifie le bloc par le point, la SCÈNE par sa
 * ligne `eval.<moteur>`, le SOCLE — `core` porte `js`. Le tag écrit sur l'occurrence l'emporte sur
 * les trois.
 *
 * ⛔ CE N'EST PAS UN ASSOUPLISSEMENT DE « JAMAIS DEVINÉ ». Un langage DÉCLARÉ est connu. Ce qui a
 * mis cinq semaines, c'est que la décision existait(2026-07-14, « pas d'eval spécifié ⇒ producteur
 * par défaut = js ») et que le défaut n'avait jamais été posé — le refus construit à sa place était
 * le SYMPTÔME de son absence, pas une protection.
 *
 * ⛔ ET LE NIVEAU SCÈNE EXISTAIT DÉJÀ DANS L'ARBRE, IGNORÉ PAR UN SEUL LECTEUR. `eval.tidal` en tête
 * de scène descendait dans chaque acteur déclaré ET fabriquait l'acteur implicite qui le porte ;
 * seul le résolveur de backtick ne le consultait pas. Un backtick nu était refusé pendant que
 * l'acteur implicite de sa propre scène nommait son langage.
 *
 * ⛔ ET LA RÉSOLUTION VIT EN UN SEUL LIEU. Elle était à DEUX : le parseur exigeait le tag sur les
 * sites sans acteur (tête de scène, définition de code, courbe), l'aval résolvait les autres. Le
 * second moteur est SUPPRIMÉ, pas désactivé. Il devait l'être : le parseur lit la scène ligne par
 * ligne, donc un `eval.<moteur>` écrit APRÈS un backtick lui est invisible — « le plus proche
 * l'emporte » y serait devenu « le plus haut dans le fichier l'emporte ».
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import '../src/transpiler/index.js';
import { leRegistre } from '../src/transpiler/libs.js';
const LIBS = leRegistre();

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = 'core\nalphabet.western\n';
/** Ce que la scène produit : refus, langages des backticks de tête, langages du flux. */
const scene = (src) => {
  let r;
  try { r = compileToBPxAST(src); } catch (e) { return { erreurs: ['JETÉ : ' + String(e.message)] }; }
  const flux = [];
  const descendre = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(descendre); return; }
    if (/^Backtick/.test(o.type || '')) flux.push(o.payload?.interp ?? o.tag ?? null);
    Object.values(o).forEach(descendre);
  };
  descendre(r.ast?.subgrammars);
  return { erreurs: (r.errors || []).map((e) => String(e.message ?? e)),
           tete: (r.ast?.backticks || []).map((b) => b.tag), flux };
};

console.log('[backtick-cascade] le langage vient de la place la plus proche qui le nomme');

// ── A. LES TROIS NIVEAUX RÉPONDENT, DU PLUS LOINTAIN AU PLUS PROCHE ─────────────────────────
{
  const socle = scene(`${TETE}-----\nS -> \`n "0"\`\n`);
  ok(socle.erreurs.length === 0, `A. le SOCLE doit suffire — reçu ${socle.erreurs[0]}`);
  ok(JSON.stringify(socle.flux) === JSON.stringify(['js']),
    `A. un backtick nu sans rien vaut le socle 'js' — reçu ${JSON.stringify(socle.flux)}`);

  const sc = scene(`${TETE}eval.tidal\n-----\nS -> \`n "0"\`\n`);
  ok(sc.erreurs.length === 0, `A. la SCÈNE doit répondre — reçu ${sc.erreurs[0]}`);
  ok(JSON.stringify(sc.flux) === JSON.stringify(['tidal']),
    `A. la scène l'emporte sur le socle — reçu ${JSON.stringify(sc.flux)}`);

  const ac = scene(`${TETE}eval.tidal\nactor d eval.strudel\n-----\nS -> d.\`n "0"\`\n`);
  ok(ac.erreurs.length === 0, `A. l'ACTEUR doit répondre — reçu ${ac.erreurs[0]}`);
  ok(JSON.stringify(ac.flux) === JSON.stringify(['strudel']),
    `A. l'acteur l'emporte sur la scène — reçu ${JSON.stringify(ac.flux)}. C'est l'ORDRE de la `
    + `cascade qui se mesure ici : trois niveaux qui rendraient la même valeur ne prouveraient rien.`);
}

// ── B. LE TAG ÉCRIT L'EMPORTE SUR LES TROIS ─────────────────────────────────────────────────
{
  for (const [quoi, src] of [
    ['contre le socle', `${TETE}-----\nS -> \`sc: a\`\n`],
    ['contre la scène', `${TETE}eval.tidal\n-----\nS -> \`sc: a\`\n`],
    ['contre l\'acteur', `${TETE}actor d eval.tidal\n-----\nS -> d.\`sc: a\`\n`],
  ]) {
    const r = scene(src);
    ok(r.erreurs.length === 0 && JSON.stringify(r.flux) === JSON.stringify(['sc']),
      `B. le tag écrit doit l'emporter ${quoi} — reçu ${JSON.stringify(r.flux)} · ${r.erreurs[0] || ''}`);
  }
}

// ── C. LES SITES SANS ACTEUR — LE SECOND MOTEUR DE REFUS EST MORT ───────────────────────────
// ⛔ LE VOLET QUI COMPTE : le parseur refusait ces trois-là, l'aval résolvait les autres. Une
// question, deux lieux. Si le refus du parseur revenait, ce volet rougirait et pas le volet A.
{
  const t = scene(`${TETE}\`a=1\`\n-----\nS -> C4\n`);
  ok(t.erreurs.length === 0,
    `C. un backtick de TÊTE DE SCÈNE sans tag doit compiler — reçu ${t.erreurs[0]}`);
  ok(JSON.stringify(t.tete) === JSON.stringify(['js']),
    `C. et porter le socle — reçu ${JSON.stringify(t.tete)}`);

  const s = scene(`${TETE}eval.tidal\n\`n "0"\`\n-----\nS -> C4\n`);
  ok(JSON.stringify(s.tete) === JSON.stringify(['tidal']),
    `C. la scène l'emporte pour un backtick de tête aussi — reçu ${JSON.stringify(s.tete)}`);

  // ⛔ L'ORDRE D'ÉCRITURE NE DÉCIDE PAS. C'est la raison pour laquelle la résolution a quitté le
  // parseur : il lit ligne par ligne, donc une déclaration qui SUIT lui serait invisible.
  const apres = scene(`${TETE}\`n "0"\`\neval.tidal\n-----\nS -> C4\n`);
  ok(JSON.stringify(apres.tete) === JSON.stringify(['tidal']),
    `C. et une ligne 'eval' écrite APRÈS le backtick vaut autant qu'avant — reçu `
    + `${JSON.stringify(apres.tete)}. Sinon « le plus proche l'emporte » veut dire « le plus haut `
    + `dans le fichier l'emporte », ce que personne n'a décidé.`);
}

// ── D. LE SOCLE EST UNE DONNÉE, JAMAIS UNE VALEUR ÉCRITE EN DUR ─────────────────────────────
// Une valeur en dur serait invisible et personne ne pourrait la surcharger.
{
  ok(LIBS.core?.defaults?.components?.eval === 'js',
    `D. 'core' doit porter le langage de code par défaut EN DONNÉE — reçu `
    + `${JSON.stringify(LIBS.core?.defaults?.components?.eval)}`);
  // ⛔ ET L'ENTRÉE 'octaves' EST SORTIE DU MÊME PORTEUR — le registre est une propriété de
  // l'alphabet. Mesuré avant le retrait : zéro lecteur, ici comme chez les voisins.
  ok(LIBS.core?.defaults?.components?.octaves === undefined,
    `D. et 'octaves' doit être SORTI du porteur global — reçu `
    + `${JSON.stringify(LIBS.core?.defaults?.components?.octaves)}`);
  ok(LIBS.core?.defaults?.components?.alphabet === 'western'
    && LIBS.core?.defaults?.components?.tuning === 'western_12TET'
    && LIBS.core?.defaults?.components?.transport === 'audio',
    `D-témoin. les trois entrées qui RESTENT ne bougent pas — reçu `
    + `${JSON.stringify(LIBS.core?.defaults?.components)}`);
}

ok(passe >= 14, `le garde doit avoir EXAMINÉ, pas seulement tourné(${passe} assertions)`);

if (echecs.length) {
  console.error(`[backtick-cascade] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[backtick-cascade] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
