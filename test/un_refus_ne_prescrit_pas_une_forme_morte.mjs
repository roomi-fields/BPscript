#!/usr/bin/env node
/**
 * GARDE — CE QU'UN REFUS DIT D'ÉCRIRE DOIT COMPILER.
 *
 * ⚠️ CE QUI A COÛTÉ CE GARDE, ET C'EST DE MOI. Le 2026-08-18 j'ai sorti `var` du langage et câblé
 * le type en tête. Deux de mes messages de refus continuaient de PRESCRIRE `var` :
 *
 *     bpxAst.js  « Le déclarer : 'var <nom> in.<canal>' »        ← point d'attente non déclaré
 *     parser.js  « Déclarer l'instance d'abord : 'var <x> <mod>' » ← port d'instance non déclarée
 *
 * L'auteur qui suivait le conseil recevait un SECOND refus, portant sur le conseil lui-même. BPx
 * l'a mesuré sur son banc et me l'a rendu ; sur les deux, il n'en voyait qu'un — le sien.
 *
 * ⛔ LA LEÇON, ET ELLE N'EST PAS « J'AI OUBLIÉ UN MESSAGE ». Un refus qui donne une réécriture
 * PUBLIE une forme au même titre qu'un exemple de la bible : c'est une prescription, lue par un
 * humain, et rien ne la compilait jamais. Retirer un mot du langage a donc un TROISIÈME domicile,
 * après le parser et les librairies : les messages qui l'enseignent.
 *
 * CE QUE CE GARDE TIENT, et il tient l'ESPACE, pas les deux lignes tombées :
 *   1. il soumet un corpus de scènes qui DOIVENT être refusées ;
 *   2. de chaque message, il extrait toute forme citée entre apostrophes ;
 *   3. une forme dont la tête n'apparaît PAS dans la source soumise est une PRESCRIPTION — les
 *      autres sont la faute rendue à l'auteur, et elles ont le droit d'être mortes ;
 *   4. chaque prescription est INSTANCIÉE (ses gabarits `<canal>`, `<module>`… remplacés) puis
 *      COMPILÉE. Elle doit passer.
 *
 * Une prescription que la table de gabarits ne sait pas instancier est DITE, jamais sautée : un
 * garde qui s'exempte en silence certifie ce qu'il n'a pas regardé.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const SOCLE = 'core\nalphabet.western\n';
const compile = (src) => {
  try { return (compileToBPxAST(src).errors || []).map((e) => String(e.message ?? e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};

// ── LE CORPUS DES REFUS — chaque entrée doit être REFUSÉE, et son message est le sujet ─────────
// Une ligne s'ajoute ici le jour où un refus se dote d'une réécriture. La colonne `tete` note ce
// que la scène écrit déjà, pour distinguer la faute rendue de la forme prescrite.
const REFUS = [
  ['point d attente non déclaré',      `${SOCLE}-----\nS -> C4 <!depart D4\n`],
  ['port d une instance non déclarée', `${SOCLE}-----\nS -> C4(lpf1.cutoff:400) D4\n`],
  ['le mot `var`',                     `${SOCLE}var x\n-----\nS -> C4\n`],
  ['le mot `mm`',                      `${SOCLE}mm:60\n-----\nS -> C4\n`],
  ['le mot `routing`',                 `${SOCLE}routing:studio\n-----\nS -> C4\n`],
  ['le mot `transcription`',           `${SOCLE}transcription.dhati\n-----\nS -> C4\n`],
  ['le mot `label`',                   `${SOCLE}label:x\n-----\nS -> C4\n`],
  ['un drapeau sans ses valeurs',      `${SOCLE}section\n-----\nS -> C4 [section=calm]\n`],
  ['la graphie `sound:`',              `${SOCLE}sound:bell\n-----\nS -> C4\n`],
  ['`transport` chez un acteur',       `${SOCLE}actor d\n  alphabet.western\n  transport.midi\n-----\nS -> C4\n`],
  ['`templates` au pluriel',           `${SOCLE}-----\nS -> C4\ntemplates\n? -> C4\n`],
  ['la re-semence hors du flux',       `${SOCLE}-----\nS -> C4 ![srand]\n`],
  ['`tempx` dans une règle',           `${SOCLE}-----\nS -> C4 (tempx:2)\n`],
  ['un drapeau testé avec `=`',        `${SOCLE}flag s(a:1, b:2)\n-----\n[s=a] S -> C4\n`],
  ['un contexte au milieu du membre',  `${SOCLE}-----\nA (X) B -> C4\n`],
  ['la flèche BP3 collée',             `${SOCLE}-----\nS --> C4\n`],
  ['sortie de scène contre raccord',   `core\nalphabet.western:audio\nout.midi\n-----\nS -> C4\n`],
  ['un suffixe d arobase',             `${SOCLE}-----\nS -> C4@lent\n`],
  ['la graphie des barres `|x|`',      `${SOCLE}-----\nS -> |x| C4\n`],
  ['le mot `alias`',                   `${SOCLE}alias x y\n-----\nS -> C4\n`],
  ['le mot `macro`',                   `${SOCLE}macro lead toto\n-----\nS -> C4\n`],
  ['le mot `library`',                 `${SOCLE}library.gm\n-----\nS -> C4\n`],
  ['un accordage personnel mal écrit', `${SOCLE}tuning:mes-svaras\n-----\nS -> C4\n`],
  ['une entrée `in` à l ancienne',     `${SOCLE}in sync1(midi)\n-----\nS -> C4\n`],
];

// ── LA TABLE DES GABARITS — ce qu'un `<…>` vaut quand on veut l'éprouver ───────────────────────
const GABARITS = [
  [/<canal>/g, 'midi'], [/<module>/g, 'adsr'], [/<nom-?fichier>/g, 'ragas'],
  [/<nom>/g, 'x'], [/<entier>/g, '1'], [/<N>/g, '2'], [/<X>/g, 'bell'],
  [/<chemin-?fichier>/g, 'ragas'], [/<entree>/g, 'sa'], [/<chemin>/g, 'ragas'],
  [/<corps>/g, '(vel:100)'], [/<valeur>/g, '1'], [/<type>/g, 'symbol'],
];
const instanciable = (f) => !/<[^>]*>/.test(f.replace(/<!/g, ''));

// ⛔ LA POSITION QUALIFIE LA LIGNE, et un message ne la dit pas. `template` nomme une SECTION,
// `in.midi x` une DÉCLARATION, `![srand]` un geste de FLUX : jugée à la mauvaise place, une forme
// vivante paraîtrait morte. Le garde essaie donc les trois places et ne condamne que ce qui est
// refusé PARTOUT — une forme sortie du langage ne compile nulle part, c'est ce qui la distingue.
const PLACES = [
  (f) => `${SOCLE}${f}\n-----\nS -> C4\n`,                 // partie déclarative
  (f) => `${SOCLE}-----\n${f}\n`,                           // règle entière
  (f) => `${SOCLE}-----\nS -> C4 ${f} D4\n`,                // dans le flux d'une règle
  (f) => `${SOCLE}-----\nS -> C4\n${f}\n? -> C4\n`,        // section de queue
];

// ⛔ L'APOSTROPHE PORTE DEUX RÔLES DANS MES MESSAGES : elle cite une forme ET elle élide un mot
// français (`l'auteur`, `n'existe`, `d'abord`). Un extracteur naïf découpe la prose en fausses
// formes — mon premier jet en a fabriqué quatorze. La règle qui les sépare est une règle de
// FRANÇAIS : une élision suit toujours une LETTRE, jamais un espace ; une citation ouvre après un
// séparateur et ferme avant un séparateur.
//
// ⛔ ET UNE CITATION N'EST PAS UNE PRESCRIPTION. Un refus cite la forme MORTE qu'il enterre
// (« le suffixe 'nom' qu'elle servait à déclarer ») autant qu'il donne celle qu'il faut écrire.
// Ce qui les sépare est le MARQUEUR : le verbe par lequel le message passe du constat au conseil.
// Le garde ne juge que ce qui SUIT un marqueur — c'est exactement l'espace du défaut, une
// réécriture donnée par un refus.
const MARQUEURS = /(déclarer|écrire|écris|s'écrit|écrit|remplace|employer|utiliser|pour [A-ZÀ-Ý]|exemple|à la place)[^']{0,60}$/i;

const formesCitees = (m) => {
  const out = [];
  for (let i = 0; i < m.length; i++) {
    if (m[i] !== "'" || (i > 0 && /[\wà-ÿ]/i.test(m[i - 1]))) continue;   // élision, pas ouverture
    if (!MARQUEURS.test(m.slice(Math.max(0, i - 70), i))) continue;      // citation, pas conseil
    for (let j = i + 1; j < m.length && j < i + 80; j++) {
      if (m[j] === '\n') break;
      if (m[j] !== "'") continue;
      if (j + 1 < m.length && /[\wà-ÿ]/i.test(m[j + 1])) continue;        // élision interne
      const forme = m.slice(i + 1, j).trim();
      if (forme.length >= 2) out.push(forme);
      i = j;
      break;
    }
  }
  return out;
};

let examinees = 0;
const nonInstanciables = [];

for (const [quoi, src] of REFUS) {
  const messages = compile(src);
  ok(messages.length > 0, `le corpus exige un REFUS — '${quoi}' compile sans un mot`);
  if (messages.length === 0) continue;

  // les mots que la SOURCE écrit déjà : ce que le refus leur rend n'est pas une prescription
  const ecrits = new Set(src.split(/[\s.:(\[\]{}<>!=,~-]+/).filter(Boolean));

  for (const m of messages) {
    for (const forme of formesCitees(m)) {
      const tete = forme.replace(/^[^\wà-ÿ<]*/, '').split(/[\s.:(\[]/)[0];
      if (!tete || ecrits.has(tete)) continue;              // la faute rendue à l'auteur
      if (!/^[a-zà-ÿ][\wà-ÿ-]*$/i.test(tete)) continue;      // pas une forme de langage
      // ⚠️ SUBSTITUER D'ABORD, JUGER ENSUITE : mon premier jet testait l'instanciabilité sur la
      // forme BRUTE, donc tout gabarit tombait dans l'exemption avant d'avoir été instancié — le
      // garde s'exemptait précisément des deux formes qui l'avaient motivé.
      let f = forme;
      for (const [g, v] of GABARITS) f = f.replace(g, v);
      f = f.replace(/,?\s*…/g, '').trim();
      if (!instanciable(f)) { nonInstanciables.push(`${quoi} → « ${forme} »`); continue; }
      examinees++;
      const essais = PLACES.map((place) => compile(place(f)));
      // ⚠️ UN MOT NU N'EST PAS UNE FORME. Un message qui conseille « écrire 'def' » nomme un MOT ;
      // `def` seul est refusé à juste titre — il lui manque son nom. Ce qui se juge alors n'est pas
      // « compile-t-il » mais « le compilateur le CONNAÎT-il » : un mot sorti du langage se refuse
      // par « SORTI », « n'existe plus » ou « déclaré par aucune librairie », un mot vivant se
      // refuse sur ses ARGUMENTS. C'est la distinction que le refus lui-même écrit.
      const MORT = /(est SORTI|n'existe plus|est SUPPRIMÉE?|déclaré par aucune librairie|n'est pas un type)/i;
      const motNu = /^[\wà-ÿ-]+$/i.test(f);
      const vivante = motNu
        ? !essais.every((e) => e.length > 0 && MORT.test(e[0]))
        : essais.some((e) => e.length === 0);
      ok(vivante,
        `PRESCRIPTION MORTE — le refus de « ${quoi} » dit d'écrire « ${forme} », et cette forme `
        + `est REFUSÉE AUX QUATRE PLACES : ${essais[0][0]?.slice(0, 130)}. Un conseil qui ne `
        + `compile pas envoie l'auteur dans un second refus, portant sur le conseil.`);
    }
  }
}

// ⛔ UN GARDE QUI A EXAMINÉ ZÉRO N'A RIEN PROUVÉ.
ok(examinees >= 9,
  `ce garde n'a éprouvé que ${examinees} prescription(s) — sous ce seuil, il ne mesure plus rien : `
  + `soit le corpus a perdu ses refus, soit l'extraction ne reconnaît plus une forme citée.`);

console.log(`[prescription] ${REFUS.length} refus · ${examinees} prescription(s) compilée(s)`);
if (nonInstanciables.length) {
  console.log(`[prescription] ${nonInstanciables.length} forme(s) que la table de gabarits ne sait `
    + `pas instancier, DITES plutôt que sautées :`);
  for (const x of nonInstanciables) console.log('    · ' + x);
}

if (echecs.length) {
  console.error(`[prescription] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[prescription] ${passe} PASS / 0 FAIL`);
