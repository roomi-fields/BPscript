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
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileToBPxAST } from '../src/transpiler/index.js';

const RACINE_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'transpiler');

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
// ⛔ UN GABARIT NE PORTE PAS TOUJOURS SES CHEVRONS. Un message ecrit `{A B}:N` ou `[weight:N]` :
// `A`, `B` et `N` sont des METAVARIABLES nues, que rien ne distingue d un symbole reel. Compilees
// telles quelles elles echouent sur un terminal non declare, et le garde accuse une prescription
// vivante. Une forme qui en porte est DITE non instanciable, jamais jugee et jamais sautee.
const METAVARIABLE = /(^|[\s{(\[:,])[A-Z]([\s}\])\.:,]|$)/;
const instanciable = (f) => !/<[^>]*>/.test(f.replace(/<!/g, '')) && !METAVARIABLE.test(f);

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
const MARQUEURS = /(declares?|invoke[sd]?|writes?|replaces?|use[sd]?|for [A-Z]|example|instead)[^']{0,60}$/i;

// ⛔ ET UN MESSAGE QUI CONTRASTE DEUX FORMES EN CITE UNE MORTE JUSTE APRES LA VIVANTE :
// « 'out.<canal>' remplace 'transport.<canal>' ». Prendre toutes les citations qui suivent un
// marqueur faisait donc juger la forme ENTERREE comme un conseil — quatre faux rouges sur cinq a
// ma premiere passe. La convention de mes messages met la forme a ECRIRE en premier : le garde ne
// retient donc que la PREMIERE citation apres chaque marqueur.
const formesCitees = (m) => {
  const out = [];
  let dernierMarqueur = -1;
  for (let i = 0; i < m.length; i++) {
    if (m[i] !== "'" || (i > 0 && /[\wà-ÿ]/i.test(m[i - 1]))) continue;   // élision, pas ouverture
    const debut = Math.max(0, i - 70);
    if (!MARQUEURS.test(m.slice(debut, i))) continue;                     // citation, pas conseil
    if (debut <= dernierMarqueur) continue;              // deja servi : la suivante contraste
    dernierMarqueur = i;
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
      const MORT = /(has LEFT the language|no longer exists|has been REMOVED|removed|is declared by no loaded library|is not a type in scope)/i;
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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// VOLET 2 — TOUS LES REFUS QUE LE CODE ÉCRIT, ET PAS SEULEMENT CEUX QU'UNE SCÈNE ATTEINT
//
// ⛔ CE QUI A COÛTÉ CE VOLET. Le corpus du dessus est une LISTE, écrite à la main, refus par refus.
// Le 2026-08-19, le refus de la directive de correspondance prescrivait TROIS formes mortes d'un
// coup — les deux signes du câblage et une déclaration sortie trois jours plus tôt. Ce garde était
// VERT dessus : il examinait vingt-quatre refus, et celui-là n'en faisait pas partie. Un garde vert
// par absence de cas ressemble trait pour trait à un garde qui a mesuré.
//
// Le corpus par scène garde sa valeur — il prouve qu'un refus est ATTEIGNABLE. Ce volet-ci prouve
// autre chose : qu'AUCUN message écrit dans le transpileur n'enseigne une forme morte, qu'une scène
// sache l'atteindre ou non. Un message est le troisième domicile d'un mot retiré, et rien ne le
// compile — c'est ce fichier ou rien.
//
// ⚠️ ET IL SE DÉRIVE DU SOURCE, jamais d'une énumération : ajouter un refus au parser l'inscrit ici
// sans que personne ait à y penser au bon moment.
// ⛔ LA LISTE SE DÉRIVE DU DOSSIER, ELLE NE S'ÉNUMÈRE PLUS. Le commentaire ci-dessus promettait
// déjà « jamais d'une énumération » et trois noms étaient écrits juste en dessous. Le 2026-09-01,
// cinq passes ont déménagé de `bpxAst.js` vers `resolution.js` : un message de refus est sorti du
// balayage avec sa fonction, et ce garde est resté VERT en couvrant un refus de moins.
// ⚠️ Les fichiers GÉNÉRÉS sont écartés — ils ne portent aucun refus et pèsent des mégaoctets.
// ⛔ ET LE CATALOGUE DES MESSAGES EN FAIT PARTIE — depuis le 2026-09-04, la PROSE des refus n'est
// plus écrite au site du refus mais dans `messages/<langue>.js` (décision de Romain : des codes
// stables, un texte qui vit à côté). Un balayage qui n'énumère que le dossier plat de `src/
// transpiler` est donc passé de 143 prescriptions à 8, et il l'a DIT — c'est son socle de
// non-vacuité qui a mordu, pas moi qui l'ai vu.
// ⚠️ C'EST LE MÊME MOTIF QU'IL DÉNONCE : un balayage écrit pour un ESPACE, et l'espace a bougé.
const SOURCES = [
  ...readdirSync(RACINE_SRC)
    .filter((f) => f.endsWith('.js') && !f.endsWith('-data.js'))
    .map((f) => join(RACINE_SRC, f)),
  ...readdirSync(join(RACINE_SRC, 'messages'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => join(RACINE_SRC, 'messages', f)),
].sort();

/** Les messages littéraux d'un fichier : le contenu de chaque `new ParseError(...)` / `LexError`,
 *  parenthèses comptées, interpolations neutralisées. */
function messagesEcrits(chemin) {
  const texte = readFileSync(chemin, 'utf-8');
  const out = [];
  // ⛔ UN REFUS S ECRIT DE DEUX FAÇONS, ET JE N EN BALAYAIS QU UNE. `new ParseError(…)` JETTE ;
  // `errors.push({ message: … })` POUSSE dans le canal. Mesuré le 2026-08-19, sur signalement de
  // BPx qui avait lu un message écrivant une forme morte que ce garde déclarait propre :
  //     parser.js   143 jets ·  0 poussées
  //     bpxAst.js     1 jet   · 41 poussées
  // Ce garde couvrait donc UN refus sur QUARANTE-DEUX dans l'émetteur. Un garde écrit pour une
  // CONSTRUCTION ne couvre pas l'ESPACE des refus — c'est le motif de la journée, appliqué à
  // moi-même : un motif identifie une chaîne, pas une forme.
  // ⚠️ ET LE CATALOGUE ÉCRIT SES MESSAGES EN VALEUR D'UNE CLÉ — `CODE_EN_MAJUSCULES:` suivi du
  //   texte. Troisième graphie d'un refus, après le JET et la POUSSÉE, et elle porte désormais la
  //   quasi-totalité de la prose. Un motif identifie une chaîne, pas une forme : chaque fois que la
  //   prose déménage, ce balayage doit apprendre son nouveau domicile.
  const RE = /new (?:Parse|Lex)Error\(|\bmessage:\s*(?=[`'"])|^\s{2}[A-Z][A-Z0-9_]{4,}:\s*$(?=\n\s*[`'"])|^\s{2}[A-Z][A-Z0-9_]{4,}:\s*(?=[`'"])/gm;
  let m;
  while ((m = RE.exec(texte)) !== null) {
    const jet = m[0].startsWith('new');
    let prof = jet ? 1 : 0, i = m.index + m[0].length;
    if (jet) {
      while (i < texte.length && prof > 0) {
        if (texte[i] === '(') prof++;
        else if(texte[i] === ')') prof--;
        i++;
      }
      out.push(texte.slice(m.index + m[0].length, i - 1));
      continue;
    }
    // Une poussée : le message est le littéral qui suit, jusqu'à son délimiteur de fermeture.
    const delim = texte[i];
    let j = i + 1;
    while (j < texte.length && !(texte[j] === delim && texte[j - 1] !== '\\')) j++;
    out.push(texte.slice(i, j + 1));
  }
  // La table des caractères étrangers du découpeur porte ses messages en données, hors d'un `throw`.
  for (const t of texte.matchAll(/\[\s*'(?:\\.|[^'])*'\s*,\s*("(?:\\.|[^"])*")\s*\]/g)) out.push(t[1]);
  return out.map((brut) => brut
    .replace(/\$\{[^}]*\}/g, 'X')       // interpolation → un nom neutre
    // ⛔ ET LE TROU DU CATALOGUE EST LA MÊME CHOSE SOUS UNE AUTRE GRAPHIE. `{nom}` remplace
    //   `${nom}` depuis que la prose vit hors du code : sans cette ligne, le garde lisait le trou
    //   comme un mot et accusait « une forme morte » sur une phrase parfaitement juste.
    .replace(/\{\w+\}/g, 'X')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, ' ')
    .replace(/[`"]/g, '')
    .replace(/\s*\+\s*/g, '')           // concaténation de littéraux : le message est continu
    .replace(/\s+/g, ' '));
}

let messagesLus = 0;
for (const chemin of SOURCES) {
  for (const message of messagesEcrits(chemin)) {
    messagesLus++;
    for (const forme of formesCitees(message)) {
      const tete = forme.replace(/^[^\wà-ÿ<]*/, '').split(/[\s.:(\[]/)[0];
      if (!tete || tete === 'X') continue;                  // une interpolation, pas une forme
      if (!/^[a-zà-ÿ][\wà-ÿ-]*$/i.test(tete)) continue;
      let f = forme;
      for (const [g, v] of GABARITS) f = f.replace(g, v);
      f = f.replace(/,?\s*…/g, '').replace(/\bX\b/g, 'x').trim();
      if (!instanciable(f)) { nonInstanciables.push(`${chemin.split('/').pop()} → « ${forme} »`); continue; }
      examinees++;
      const essais = PLACES.map((place) => compile(place(f)));
      const MORT = /(has LEFT the language|no longer exists|has been REMOVED|removed|is declared by no loaded library|is not a type in scope)/i;
      // ⛔ UN REFUS DE RESOLUTION ATTESTE LA FORME. « sound 'x' introuvable dans le catalogue » ne
      // dit pas que `sound.<nom>` est morte : il dit que l entree nommee n existe pas — donc que la
      // forme a ete LUE. Mon gabarit remplace `<nom>` par un nom qui n est dans aucun catalogue ;
      // sans cette distinction, le garde condamne une forme vivante a cause de son propre exemple.
      // ⛔ ET L EXEMPTION EST ETROITE, MESUREE PAR INJECTION. Ma premiere ecriture disait
      // « introuvable | non déclaré | inconnu » : dans le flux, `var x` se lit comme DEUX symboles
      // et rend « terminal non déclaré » — donc l exemption absolvait une prescription morte, et
      // mon injection ne mordait plus. Ce qui atteste une forme est le refus d une ENTREE DE
      // CATALOGUE, jamais celui d un terminal : le second dit qu on a lu autre chose.
      // ⛔ ET UN REFUS QUI ENUMERE SA LISTE FERMEE ATTESTE AUSSI LA FORME. « 'x' n'est pas une
      // sortie — les canaux de sortie sont audio, midi… » dit que `out.<X>` a ete LUE : c'est
      // l'ENTREE qui est fausse, et elle l'est parce que MON GABARIT a instancie `<X>` avec un nom
      // de son. Un gabarit a valeur unique sert deux sens ; sans cette distinction le garde
      // condamne une forme vivante a cause de son propre exemple.
      const RESOLUTION = /(not found in the catalog|does not exist|The list is CLOSED)/i;
      const motNu = /^[\wà-ÿ-]+$/i.test(f);
      const vivante = motNu
        ? !essais.every((e) => e.length > 0 && MORT.test(e[0]))
        : essais.some((e) => e.length === 0 || RESOLUTION.test(e[0]));
      ok(vivante,
        `PRESCRIPTION MORTE dans ${chemin.split('/').pop()} — un refus dit d'écrire « ${forme} », `
        + `et cette forme est REFUSÉE AUX QUATRE PLACES : ${essais[0][0]?.slice(0, 130)}. `
        + `Le message est écrit dans le code, qu'une scène sache l'atteindre ou non.`);
    }
  }
}

// ⛔ LE BALAYAGE DOIT AVOIR TROUVÉ DES MESSAGES — sinon l'extraction a cessé de reconnaître un
// refus, et tout ce volet est un ensemble vide qui a la tête d'un succès.
ok(messagesLus >= 100,
  `le balayage du source n'a lu que ${messagesLus} message(s) de refus dans ${SOURCES.length} `
  + `fichiers — l'extraction ne reconnaît plus la forme d'un refus.`);

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
