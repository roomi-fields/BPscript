#!/usr/bin/env node
/**
 * GARDE — CE QUE MA DONNÉE PUBLIÉE DÉCRIT NE PEUT PAS ÊTRE UNE FORME MORTE.
 *
 * ⛔ LE QUATRIÈME DOMICILE D'UN MOT RETIRÉ. Trois étaient déjà tenus : le parser, les librairies —
 * le mot RÉSERVÉ — et les messages de refus. Le 2026-08-19, l'architecte a trouvé le quatrième :
 * la DESCRIPTION que la donnée porte à côté du mot. `timepatterns` était décrit par
 * « Motifs temporels nommes -- @timepatterns: t1=1/1 » alors que l'arobase est sortie du langage le
 * 2026-08-16.
 *
 * Une description n'est pas un commentaire : elle voyage dans `libs-data.js`, que `package.json`
 * DÉCLARE EN EXPORT. Un voisin qui bâtit une aide, une complétion ou une page de référence lit
 * cette phrase et enseigne à un auteur une graphie que mon compilateur refuse — et rien chez lui ne
 * peut le signaler, puisque sa donnée vient de moi.
 *
 * ⛔ ET MON GARDE DES PRESCRIPTIONS NE POUVAIT PAS LE VOIR : il balaie les MESSAGES du transpileur.
 * Une description vit dans la DONNÉE. Deux domiciles, deux gardes — c'est le motif de la journée.
 *
 * ⛔ LA MOITIÉ DIFFICILE EST DE NE PAS ACCUSER LE CODE D'UN AUTRE LANGAGE. Les réalisations audio
 * des voix portent du JavaScript en backtick typé, et l'opérateur `>>` y est le sien. Un motif qui
 * cherche des signes se trompe de langage — « un motif identifie une chaîne, pas une forme ». Le
 * garde exclut donc les valeurs qui SONT du code, par leur tag, jamais par leur contenu.
 */
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/**
 * TOUTE CHAÎNE DE PROSE de la donnée publiée, avec son chemin. Découverte par descente, jamais
 * énumérée : une liste de champs écrite à la main deviendrait aveugle au champ suivant.
 */
/** Les champs dont le RÔLE est de porter du code, nommés un par un. */
const CHAMPS_DE_CODE = new Set(['body', 'code', 'audio', 'source']);

const proses = [];
(function descendre(noeud, chemin) {
  if (!noeud || typeof noeud !== 'object') return;
  for (const [cle, valeur] of Object.entries(noeud)) {
    const ici = `${chemin}.${cle}`;
    if (typeof valeur === 'string') {
      // ⛔ UNE RÉALISATION EN CODE N'EST PAS DE LA PROSE. Un backtick TAGUÉ porte le langage d'un
      // autre interprète : ses signes sont les siens. On l'écarte sur son TAG, pas sur son texte.
      if (/^\s*`\s*[a-z]+\s*:/.test(valeur)) continue;
      // ⛔ ET UN CORPS DE FONCTION NON PLUS, MÊME SANS BACKTICK. Les objets `digital` portent leur
      // TypeScript dans un champ `body` : ses annotations commencent par une arobase, qui est celle
      // de ce langage-là. L'exclusion se fait par le NOM du champ — nommé, jamais par un motif
      // large : un champ dont le rôle est de porter du code se déclare, il ne se devine pas.
      if (CHAMPS_DE_CODE.has(cle)) continue;
      if (valeur.length >= 20) proses.push([ici, valeur]);
    } else descendre(valeur, ici);
  }
})(LIBS, 'LIBS');

/**
 * LES FORMES MORTES, avec leur décision. Chacune est une graphie que le langage a perdue et qu'une
 * description ne peut donc pas enseigner.
 */
const FORMES_MORTES = [
  ['l\'arobase de tête', /(^|[\s(`'"])@[a-zA-Z][\w.]*/, '2026-08-16'],
  ['le signe du câblage', /(^|\s)\\?>>(\s|$)/, '2026-08-18'],
];

console.log(`[description] ${proses.length} chaîne(s) de prose publiée(s) × ${FORMES_MORTES.length} formes mortes`);

ok(proses.length >= 500,
  `le balayage n'a trouvé que ${proses.length} chaîne(s) — la descente ne reconnaît plus la prose, `
  + `et ce garde deviendrait un ensemble vide qui a la tête d'un succès.`);

for (const [quoi, motif, decision] of FORMES_MORTES) {
  const coupables = proses.filter(([, v]) => motif.test(v));
  ok(coupables.length === 0,
    `${coupables.length} description(s) publiée(s) enseignent ${quoi}, sortie du langage le `
    + `${decision} :\n       `
    + coupables.slice(0, 6).map(([c, v]) => `${c}\n         « ${v.slice(0, 110)} »`).join('\n       '));
}

// ── LE JUGE MORD SUR CE QU'IL PRÉTEND VOIR ──────────────────────────────────────────────────
// ⛔ SANS CE VOLET, un motif trop étroit rendrait le volet du dessus vert sur une donnée fautive.
for (const [nom, texte, attrapePar] of [
  ['arobase en tête de phrase',   '@timepatterns: t1=1/1 déclare un motif', 0],
  ['arobase après un espace',     'la forme est @seed:N pour figer la dérivation', 0],
  ['arobase dans un exemple cité', 'écrire `@alphabet.X` en tête de scène', 0],
  ['chevron du câblage',          'la chaîne s écrit saw1 >> lpf1 dans une macro', 1],
]) {
  ok(FORMES_MORTES[attrapePar][1].test(texte),
    `JUGE — « ${nom} » n'est PAS vu : une description écrite ainsi passerait en triomphe.\n`
    + `       ${texte}`);
}
// Le témoin inverse : ce qui est légitime ne doit JAMAIS être accusé.
for (const [nom, texte] of [
  ['une adresse de courriel',      'écrire à contact chez exemple point org'],
  ['du code JavaScript tagué',     '`js: saw(pitch) >> lpf(cutoff)`'],
  ['un opérateur de comparaison',  'la garde [Notes>4] compare un compteur'],
  ['la graphie vivante du réglage', 'le réglage s écrit seed:N en tête de scène'],
]) {
  const accuse = FORMES_MORTES.some(([, m]) => m.test(texte))
    && !/^\s*`\s*[a-z]+\s*:/.test(texte);
  ok(!accuse,
    `JUGE — « ${nom} » est accusé à tort : le garde ferait retirer une phrase juste.\n       ${texte}`);
}

ok(proses.length >= 500 && passe > 10, `le garde doit avoir EXAMINÉ, pas seulement tourné (${passe} assertions)`);

if (echecs.length) {
  console.error(`[description] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[description] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
