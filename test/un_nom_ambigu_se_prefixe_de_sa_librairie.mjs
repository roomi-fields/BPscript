#!/usr/bin/env node
/**
 * GARDE — deux librairies peuvent déclarer le même contrôle, et l'appel se PRÉFIXE alors.
 *
 * RÈGLE DE ROMAIN (2026-08-13) : « on peut avoir deux déclarations d'un même contrôle et à ce
 * moment-là on a l'obligation de l'appeler en préfixant `<nom de la librairie>.<contrôle>` ».
 *
 * CE QUE J'AVAIS ÉCRIT LA VEILLE, ET QUI ÉTAIT L'INVERSE DE LA RÈGLE : un refus DUR à la
 * DÉCLARATION — « un contrôle ne se déclare qu'une fois ». Le raisonnement se tenait (le
 * destinataire d'un réglage se lit sur la librairie qui le déclare, donc deux déclarations donnent
 * deux destinataires) mais la conclusion visait le mauvais bout. Ce n'est pas la déclaration qui
 * est indécidable, c'est l'APPEL NU.
 *
 * LE MODE D'ÉCHEC QUE CE GARDE FERME, et c'est le seul qui compte : le chargeur garde la DERNIÈRE
 * déclaration lue et le réglage part au destinataire de celle-là, SANS ERREUR. Mesuré en posant un
 * `pan` de témoin dans `audio` : `(pan:20)` était jugé sur la plage d'audio (-1..1) et sortait
 * « hors plage », alors que l'auteur écrivait le `pan` d'`expression` (0..127). Rien ne nommait
 * l'ambiguïté ; l'ORDRE DE CHARGEMENT décidait.
 *
 * ⚠️ CE GARDE FABRIQUE SON AMBIGUÏTÉ, parce qu'il n'y en a AUCUNE dans les librairies du jour. Un
 * garde qui attendrait qu'un conflit existe ne préviendrait rien — il rougirait le jour où le
 * défaut est déjà là. Il enregistre donc une version d'`audio` qui déclare `pan`, avec une plage et
 * un destinataire DIFFÉRENTS de ceux d'`expression` : c'est ce contraste qui rend le mauvais choix
 * visible.
 *
 * LA MATRICE — la position du sac × la forme d'écriture. Un réglage s'écrit à quatre endroits, et
 * n'en tenir qu'un laisserait vivre les trois autres :
 *   collé à un symbole · dans le flux · sur une règle · sur un groupe.
 *
 * INJECTION dans l'ACCUSÉ (le refus retiré, le préfixe ignoré) et dans le JUGE.
 */
import { createRequire } from 'node:module';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { registerLib, clearRegistry, registerAll } from '../src/transpiler/libs.js';

const require = createRequire(import.meta.url);
const { LIBS } = require('../src/transpiler/libs-data.js');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = 'core\nalphabet.western\n-----\n';
const erreursDe = (src) => {
  try { return compileToBPxAST(src).errors ?? []; } catch (e) { return [{ message: e.message }]; }
};
const refusDAmbiguite = (src) =>
  erreursDe(src).filter((e) => /cannot be written BARE/.test(String(e.message)));

// ─── 0. TÉMOIN — sans ambiguïté, tout passe. C'est l'état de référence à retrouver après. ─────
clearRegistry();
registerAll(LIBS);
ok(erreursDe(`${TETE}S -> C4(pan:20)\n`).length === 0,
   '0. TÉMOIN : sans ambiguïté, un nom nu doit compiler — sinon le garde mesure autre chose');
ok(erreursDe(`${TETE}S -> C4(vel:100)\n`).length === 0,
   '0. TÉMOIN : un contrôle ordinaire doit compiler');

// ─── L'AMBIGUÏTÉ FABRIQUÉE — `pan` déclaré par expression ET par audio ───────────────────────
const audioAvecPan = JSON.parse(JSON.stringify(LIBS.audio));
audioAvecPan.controls.pan = {
  args: ['value'], range: [-1, 1], default: 0,
  description: 'TÉMOIN DU GARDE — panoramique audio, plage et destinataire distincts de expression',
  scope: ['symbol', 'group', 'rule', 'flow'],
};
registerLib('audio', audioAvecPan);

// ─── 1. LA DÉCLARATION DOUBLE EST PERMISE ────────────────────────────────────────────────────
// C'est le point que je tenais à l'envers : le chargeur ne doit PAS refuser, il doit CHARGER.
{
  const e = erreursDe(`${TETE}S -> C4(vel:100)\n`);
  ok(!e.some((x) => /déclaré DEUX FOIS/.test(String(x.message))),
     `1. deux déclarations d'un même contrôle sont PERMISES — le chargeur ne doit pas refuser `
     + `(reçu : ${JSON.stringify(e.map((x) => String(x.message).slice(0, 70)))})`);
  ok(e.length === 0,
     `1. une scène qui n'emploie pas le nom ambigu doit compiler normalement(${e[0]?.message})`);
}

// ─── 2. L'APPEL NU EST REFUSÉ — aux QUATRE positions où un réglage s'écrit ───────────────────
for (const [ou, src] of [
  ['collé à un symbole',  `${TETE}S -> C4(pan:20)\n`],
  ['dans le flux',        `${TETE}S -> !(pan:20) C4\n`],
  ['sur une règle',       `${TETE}S -> C4 D4 (pan:20)\n`],
  ['sur un groupe',       `${TETE}S -> {C4 D4}(pan:20)\n`],
]) {
  ok(refusDAmbiguite(src).length > 0,
     `2. '${ou}' : un nom que deux librairies déclarent doit être refusé écrit NU — sinon le `
     + `chargeur tranche en silence et le réglage part au mauvais destinataire`);
}

// ─── 3. LE REFUS PORTE SA RÉÉCRITURE — les deux préfixes, nommés ─────────────────────────────
// Un refus qui dit seulement « ambigu » laisse l'auteur chercher qui se dispute le nom.
{
  const m = String(refusDAmbiguite(`${TETE}S -> C4(pan:20)\n`)[0]?.message ?? '');
  ok(/'audio\.pan:…'/.test(m) && /'expression\.pan:…'/.test(m),
     `3. le refus doit NOMMER les deux préfixes possibles — reçu : ${m.slice(0, 160)}`);
}

// ─── 4. LE COMPLÉMENT — la forme préfixée est ACCEPTÉE, aux mêmes quatre positions ───────────
// Sans ce volet le garde décrirait un langage plus étroit que le vrai : il suffirait de refuser
// TOUT emploi du nom pour le faire passer au vert.
for (const [ou, src] of [
  ['collé à un symbole',  `${TETE}S -> C4(audio.pan:0.5)\n`],
  ['dans le flux',        `${TETE}S -> !(audio.pan:0.5) C4\n`],
  ['sur une règle',       `${TETE}S -> C4 D4 (audio.pan:0.5)\n`],
  ['sur un groupe',       `${TETE}S -> {C4 D4}(audio.pan:0.5)\n`],
  ["l'autre librairie",   `${TETE}S -> C4(expression.pan:20)\n`],
]) {
  const e = erreursDe(src);
  ok(e.length === 0,
     `4. '${ou}' : la forme préfixée doit être ACCEPTÉE — refusée : ${String(e[0]?.message ?? '').slice(0, 110)}`);
}

// ─── 5. LE PRÉFIXE DÉSIGNE VRAIMENT UNE DÉCLARATION, il ne décore pas ────────────────────────
// La preuve qu'il porte : chaque forme est jugée sur LA PLAGE DE SA LIBRAIRIE. Sans cela le
// préfixe serait accepté et ignoré — le pire des deux mondes, une graphie qui rassure sans agir.
{
  const horsAudio = erreursDe(`${TETE}S -> C4(audio.pan:20)\n`);
  ok(horsAudio.some((e) => /out of range/.test(String(e.message))),
     "5. 'audio.pan:20' doit sortir HORS PLAGE — audio va de -1 à 1, et c'est sa plage qui juge");
  const dansExpression = erreursDe(`${TETE}S -> C4(expression.pan:20)\n`);
  ok(dansExpression.length === 0,
     `5. 'expression.pan:20' doit passer — expression va de 0 à 127 (${dansExpression[0]?.message})`);
}

// ─── 6. LE DESTINATAIRE SUIT LE PRÉFIXE, et c'est tout l'enjeu ───────────────────────────────
// Le préfixe existe pour désigner QUI résout. S'il n'atteignait pas `resolvedBy`, il ne servirait
// à rien : la scène compilerait et le réglage partirait quand même au mauvais outil.
{
  const lire = (src) => {
    const ast = compileToBPxAST(src).ast;
    const out = [];
    (function marche(n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(marche); return; }
      if (n.payload && n.payload.resolvedBy && n.payload.resolvedBy.pan) out.push(n.payload.resolvedBy.pan);
      Object.values(n).forEach(marche);
    })(ast.subgrammars);
    return [...new Set(out)];
  };
  ok(JSON.stringify(lire(`${TETE}S -> C4(audio.pan:0.5)\n`)) === '["runtime-audio"]',
     `6. 'audio.pan' doit porter le destinataire d'audio — reçu ${JSON.stringify(lire(`${TETE}S -> C4(audio.pan:0.5)\n`))}`);
  ok(JSON.stringify(lire(`${TETE}S -> C4(expression.pan:20)\n`)) === '["toutes les sorties"]',
     `6. 'expression.pan' doit porter le destinataire d'expression — reçu ${JSON.stringify(lire(`${TETE}S -> C4(expression.pan:20)\n`))}`);
}

// ─── 6bis. LE PRÉFIXE N'EST PAS UNE SECONDE GRAMMAIRE — il accepte TOUT ce que le nu accepte ──
// ⚠️ CE VOLET EXISTE PARCE QUE J'AVAIS ÉCRIT LA SECONDE GRAMMAIRE. Ma première version lisait la
// valeur DANS sa propre branche, et ne connaissait donc que les valeurs simples :
// `transpo.transpose:3/2` butait sur la barre de fraction — l'intervalle a son propre lecteur —
// et `variation.velstep`, une clé SANS valeur, n'était pas reconnue du tout. Le préfixe se
// consomme maintenant AVANT toute lecture, et tout ce qui suit passe par les mêmes lecteurs.
//
// LA MESURE EST UNE PARITÉ, pas une liste de cas qui marchent : pour chaque forme, l'écriture nue
// et l'écriture préfixée doivent rendre le MÊME verdict. Y compris quand les deux ÉCHOUENT — une
// parité qui n'exigerait que le succès laisserait le préfixe diverger sur les refus.
{
  clearRegistry();
  registerAll(LIBS);
  const PAIRES = [
    ['une valeur entière',        'vel:100',            'expression.vel:100'],
    ['une valeur nommée',         'wave:triangle',      'audio.wave:triangle'],
    ['un intervalle en fraction', 'transpose:3/2',      'transpo.transpose:3/2'],
    ['un intervalle en cents',    'transpose:700c',     'transpo.transpose:700c'],
    ['une clé SANS valeur',       'velstep',            'variation.velstep'],
    ['un réglage moteur',         'rndtime:100',        'engine.rndtime:100'],
    ['une valeur composite',      'keyxpand:C4,2',      'transpo.keyxpand:C4,2'],
  ];
  for (const [quoi, nu, prefixe] of PAIRES) {
    const a = erreursDe(`${TETE}S -> C4(${nu})\n`).length > 0;
    const b = erreursDe(`${TETE}S -> C4(${prefixe})\n`).length > 0;
    ok(a === b,
       `6bis. '${quoi}' : la forme préfixée doit rendre le MÊME verdict que la nue — `
       + `'${nu}' ${a ? 'refusé' : 'accepté'} mais '${prefixe}' ${b ? 'refusé' : 'accepté'}`);
  }
  // TÉMOIN D'INSTRUMENT — la liste doit contenir au moins un cas qui PASSE et un qui ÉCHOUE dans
  // les deux formes, sinon la parité se vérifierait sur un seul régime.
  ok(erreursDe(`${TETE}S -> C4(vel:100)\n`).length === 0,
     '6bis. TÉMOIN : au moins une paire doit être acceptée des deux côtés');
  ok(erreursDe(`${TETE}S -> C4(keyxpand:C4,2)\n`).length > 0,
     "6bis. TÉMOIN : au moins une paire doit être refusée des deux côtés — sans quoi la parité ne "
     + "s'éprouve que sur le succès et laisse le préfixe diverger sur les refus");
}

// ─── 7. RETOUR À L'ÉTAT RÉEL — un garde ne laisse pas son témoin derrière lui ────────────────
clearRegistry();
registerAll(LIBS);
ok(erreursDe(`${TETE}S -> C4(pan:20)\n`).length === 0,
   "7. après restauration, le nom nu doit repasser — sinon le témoin fuit sur les gardes suivants");

// ─── 8. INJECTION DANS LE JUGE — la décision rejouée isolée ──────────────────────────────────
const juger = (nom, ambigus, prefixeEcrit) => ambigus.has(nom) && !prefixeEcrit;
const ambigus = new Set(['pan']);
ok(juger('pan', ambigus, false), '8. (mord) un nom ambigu écrit nu doit être refusé');
ok(!juger('pan', ambigus, true), '8. (se tait) le même nom préfixé passe');
ok(!juger('vel', ambigus, false), '8. (se tait) un nom non ambigu écrit nu passe');

if (echecs.length) {
  console.error(`❌ un nom ambigu ne se préfixe pas : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ deux déclarations sont permises, l'appel se préfixe — ${passe} vérification(s) passée(s)`);
}
