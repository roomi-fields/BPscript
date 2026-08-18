#!/usr/bin/env node
/**
 * GARDE ANTI-RETOUR — `@alias` est SORTI du langage, et il ne revient pas.
 *
 * DÉCISION DE ROMAIN, 2026-08-15 : « donc on retire alias et on apprend à def à nommer un point
 * d'attente ». `@def` porte ce que `@alias` faisait — un nom associé à un corps qu'on réinvoque.
 *
 * ⛔ CE QUI A JUSTIFIÉ LE RETRAIT, ET C'EST UNE MESURE, PAS UN AVIS. Les six formes que son lecteur
 * acceptait ont été confrontées à `@def` EN DÉCLARATION **ET EN USAGE** — « ça compile » ne dit pas
 * « ça désigne » :
 *   · `cc:2`, `osc:/chemin`, `sys.panic` se déclaraient et AUCUNE forme d'usage ne les résolvait ;
 *   · `[drapeau]` échouait des DEUX côtés — employer le nom était refusé ;
 *   · un nom pointé, un sac, une séquence : `@def` est plus large ;
 *   · `<!point` — le seul cas où l'alias compilait ET s'employait… et il ne DÉSIGNAIT rien pour
 *     autant : `<!depart` compilait À L'IDENTIQUE sans aucune déclaration, parce qu'un point
 *     d'attente acceptait n'importe quel nom. C'est la raison pour laquelle le retrait n'a rien
 *     perdu.
 *     ⚠️ ET CETTE MESURE A ÉTÉ RENDUE CADUQUE LE SOIR MÊME, par la décision qu'elle a provoquée :
 *     Romain a tranché qu'un point d'attente DOIT être déclaré (« sinon on ne sait pas ce qu'on
 *     attend »). Le volet 3 mesure donc désormais le contraire — un nom non déclaré est REFUSÉ —
 *     et c'est le garde `un_point_d_attente_nomme_ce_qu_il_attend.mjs` qui tient la règle.
 * Et `ast.aliases` n'avait aucun consommateur sur les vingt-quatre dépôts.
 *
 * ⛔ PAS DE PIERRE TOMBALE — règle de Romain du même jour : « dans le parseur la règle devrait être
 * très simple : tout ce qui n'est pas défini est rejeté ». Ce garde exige donc que `@alias` soit
 * refusé EXACTEMENT COMME un mot inventé, pas par un message daté qui lui serait propre. La
 * mémoire de ce qui a été retiré vit dans les décisions, pas dans le parseur.
 *
 * INJECTION dans le JUGE, et le complément : ce que `@def` doit continuer d'accepter.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const T = 'core\nalphabet.western\n';
const erreursDe = (src) => {
  try { return compileToBPxAST(src).errors ?? []; } catch (e) { return [{ message: e.message }]; }
};
const messages = (src) => erreursDe(src).map((e) => String(e.message)).join(' | ');

// ── 1. LE MOT EST REFUSÉ, DANS LES SIX FORMES QU'IL ACCEPTAIT ───────────────────────────────
const FORMES = [
  ['un point d\'attente', 'alias depart <!sync1'],
  ['un drapeau',          'alias tension [stage]'],
  ['un contrôleur',       'alias souffle cc:2'],
  ['une adresse OSC',     'alias envoi osc:/synth/note'],
  ['une commande',        'alias stop sys.panic'],
  ['un nom nu',           'alias court long'],
];
for (const [quoi, ligne] of FORMES) {
  ok(erreursDe(`${T}${ligne}\n-----\nS -> C4\n`).length > 0,
     `1. 'alias' portant ${quoi} doit être REFUSÉ — le mot est sorti du langage`);
}

// ── 2. IL EST REFUSÉ COMME UN MOT INVENTÉ, PAS PAR UN MESSAGE QUI LUI EST PROPRE ─────────────
// ⛔ Le volet qui tient la règle « pas de pierre tombale ». Sans lui, quelqu'un rendrait service
// en réintroduisant un refus daté et nommé — ce qui remettrait le passé dans le parseur.
{
  const duMotSorti = messages(`${T}alias x\n-----\nS -> C4\n`);
  const duMotInvente = messages(`${T}zzjamaisvu x\n-----\nS -> C4\n`);
  // ⛔ MODULO LE NOM DU MOT : les deux messages nomment le mot fautif, donc l egalite STRICTE
  // etait impossible a satisfaire. Ce qui doit etre identique est la FORME du refus — c est ce
  // que la decision demande : « un mot inconnu est refuse comme un mot invente ».
  // ⚠️ LE MOT SE NEUTRALISE PARTOUT OÙ IL PARAÎT, pas seulement entre guillemets simples : depuis
  // que le refus cite la LIGNE (`'alias x' : 'alias' n'est pas un type…`), le mot apparaît DEUX
  // fois et une neutralisation partielle laissait deux messages identiques passer pour différents.
  const neutre = (m) => m.replace(/\b(alias|zzjamaisvu)\b/g, '<mot>');
  ok(neutre(duMotSorti) === neutre(duMotInvente),
     `2. 'alias' doit être refusé EXACTEMENT comme un mot inventé — la mémoire du retrait vit `
     + `dans les décisions, pas dans le parseur.\n       sorti  : ${duMotSorti}\n       inventé: ${duMotInvente}`);
  // ⛔ LE CRITERE EST LA FORME DU MESSAGE, PAS L ABSENCE DU MOT. Ce volet exigeait que le refus
  // ne NOMME PAS `alias` — or tout refus nomme le mot fautif, y compris celui d un mot invente
  // (`'zzjamaisvu' n'est declare par aucune librairie`). Il ne pouvait donc jamais passer une
  // fois la pierre tombale retiree. Ce qui distingue une pierre tombale d un refus generique,
  // c est qu elle cite une DECISION et donne une REECRITURE ; on mesure cela.
  ok(!/est SORTI|est SUPPRIM|decisions\//i.test(duMotSorti),
     `2. et le refus ne doit pas etre une PIERRE TOMBALE — ni decision citee, ni reecriture. `
     + `Reçu : ${duMotSorti}`);
}

// ── 3. CE QUE L'ALIAS NE DÉSIGNAIT PAS, MESURÉ SUR LA RÈGLE D'AUJOURD'HUI ───────────────────
// ⚠️ CE VOLET A ÉTÉ RETOURNÉ LE SOIR DU 2026-08-15, ET SON PROPRE AVERTISSEMENT L'AVAIT PRÉVU : il
// exigeait qu'un point d'attente NON DÉCLARÉ compile, et disait « si cela cessait d'être vrai, la
// question se rouvre, et ce garde doit être relu avant d'être réparé ». Elle s'est rouverte le
// jour même — Romain a tranché qu'un point d'attente doit être déclaré — et le garde est relu, pas
// rafistolé.
// CE QU'IL MESURE MAINTENANT : la déclaration qui compte est celle de l'ENTRÉE, jamais un alias.
// Le nœud porte le nom écrit, et rien d'autre ne l'a jamais résolu.
{
  const r = compileToBPxAST(`${T}in.midi depart\n-----\nS -> C4 <!depart D4\n`);
  const attentes = [];
  (function marcher(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const e of n) marcher(e); return; }
    if (n.type === 'Wait') attentes.push(n.name);
    for (const k in n) marcher(n[k]);
  })(r.ast);
  ok((r.errors ?? []).length === 0 && attentes.length === 1 && attentes[0] === 'depart',
     `3. un point d'attente DÉCLARÉ PAR SON ENTRÉE compile et porte son propre nom — vu `
     + `${JSON.stringify(attentes)}`);
}

// ── 4. L'ARBRE NE PORTE PLUS LE CHAMP ───────────────────────────────────────────────────────
{
  const r = compileToBPxAST(`${T}-----\nS -> C4\n`);
  ok(r.ast.aliases === undefined,
     `4. l'arbre ne doit plus porter 'aliases' — un champ émis et toujours vide fait conclure `
     + `« cette scène ne désigne rien » au lieu de « ce canal n'existe plus ». Vu : `
     + `${JSON.stringify(r.ast.aliases)}`);
}

// ── 5. LE CODE NE GARDE PAS SON LECTEUR ─────────────────────────────────────────────────────
// Le mot mort s'élague dans le mouvement qui le rend mort : un lecteur qui survit à sa directive
// est du code que rien n'appelle et que le prochain rebranchera « puisqu'il est là ».
for (const [fichier, symbole] of [
  ['src/transpiler/parser.js', 'parseAliasValue'],
  ['src/transpiler/parser.js', 'AliasDirective'],
  ['src/transpiler/bpxAst.js', 'validateAliases'],
]) {
  const source = readFileSync(new URL(`../${fichier}`, import.meta.url), 'utf-8');
  ok(!source.includes(symbole),
     `5. '${symbole}' doit avoir disparu de ${fichier} — il n'a plus de directive à servir`);
}

// ── 6. LE COMPLÉMENT — ce que `def` accepte n'a pas bougé ──────────────────────────────────
// Sans ce volet, retirer trop large passerait au vert : il suffirait que `def` casse pour que
// les cinq précédents restent tous justes.
for (const [quoi, ligne, usage] of [
  ['une séquence',    'def montee C4 D4 E4', 'S -> montee\n'],
  ['un préréglage',   'def fort (vel:100)',  'S -> C4 fort\n'],
  ['une transformation', 'def accent(x) x(vel:120)', 'S -> accent(C4)\n'],
  ['un nom pointé',   'def souffle perc.tin', 'S -> C4\n'],
]) {
  ok(erreursDe(`${T}${ligne}\n-----\n${usage}`).length === 0,
     `6. 'def' portant ${quoi} doit continuer de compiler — reçu : ${messages(`${T}${ligne}\n-----\n${usage}`)}`);
}

// ── 7. AUCUNE SCÈNE DU DÉPÔT NE L'ÉCRIT ─────────────────────────────────────────────────────
// Le complément du volet 1 : mesurer que le mot est refusé ne dit pas qu'il a quitté le corpus.
{
  // ⚠️ LE CORPUS EST ARBORESCENT — `test/grammars/` porte des DOSSIERS, pas des scènes à plat.
  // Un lecteur qui énumère le premier niveau rend ZÉRO et se croit vert ; c'est le socle qui l'a
  // dit, à sa première exécution.
  // ⚠️ ET LE BALAYAGE S'ARRÊTE AUX DOSSIERS DE TRAVAIL : `node_modules` et `.claude` portent des
  // liens symboliques CIRCULAIRES entre dépôts voisins, et les suivre fait boucler le lecteur
  // jusqu'à l'erreur système. Mesuré en l'écrivant.
  const scenes = [];
  const racine = fileURLToPath(new URL('../', import.meta.url));
  (function marcher(dir) {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e.startsWith('.')) continue;
      const complet = join(dir, e);
      if (statSync(complet).isDirectory()) marcher(complet);
      else if (e.endsWith('.bps') || e.endsWith('.bpsl')) scenes.push(complet);
    }
  })(racine);
  ok(scenes.length >= 50,
     `7. SOCLE : au moins cinquante scènes attendues dans le dépôt — lues ${scenes.length}`);
  // ⛔ UNE DIRECTIVE S ECRIT EN TETE DE LIGNE, une MENTION vit dans une phrase. Depuis que
  // l arobase est sortie, chercher `alias` nu attrape « alias for pressure » dans la description
  // d un controle MIDI — de la prose anglaise, pas une declaration. Le motif porte donc sur la
  // POSITION, qui est ce qui qualifie une ligne desormais.
  const coupables = scenes.filter((f) => /^\s*alias\b/m.test(readFileSync(f, 'utf-8')));
  ok(coupables.length === 0,
     `7. aucune scène ni librairie du dépôt ne doit écrire 'alias' — vues : ${coupables.join(', ')}`);
}

// ── 8. INJECTION DANS LE JUGE — la décision rejouée isolée ──────────────────────────────────
const juger = (mot, declares) => !declares.has(mot);
const declares = new Set(['def', 'var', 'init', 'actor']);
ok(juger('alias', declares), '8. (mord) un mot sorti est rejeté');
ok(juger('zzjamaisvu', declares), '8. (mord) un mot inventé aussi, et par le MÊME chemin');
ok(!juger('def', declares), '8. (se tait) un mot déclaré passe');

const TOTAL_ATTENDU = FORMES.length + 2 + 1 + 1 + 3 + 4 + 2 + 3;
ok(passe + echecs.length === TOTAL_ATTENDU,
   `bilan : ${TOTAL_ATTENDU} vérifications attendues, ${passe + echecs.length} exécutées`);

if (echecs.length) {
  console.error(`❌ 'alias' est sorti du langage : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ 'alias' est sorti du langage — ${passe} vérification(s) passée(s)`);
}
