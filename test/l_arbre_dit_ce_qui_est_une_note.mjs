#!/usr/bin/env node
/**
 * GARDE — l'ARBRE dit lui-même quels noms sont des NOTES. Le consommateur LIT, il ne demande plus.
 *
 * ORDRE de l'architecte (2026-07-29), en conséquence d'une règle que Romain a gravée le matin même
 * (`hub/decisions/2026-07-29-notre-mecanique-n-utilise-que-des-alphabets.md`) : « notre mécanique
 * ne doit utiliser QUE des alphabets ; le frontend BP3 traduit les conventions appelées au
 * lancement en alphabets ; les conventions ne doivent être connues QUE du frontend BP3 ».
 *
 * ⚠️ LE DÉFAUT QU'ON RETIRE, ET IL EST CHIFFRÉ. Kanopi interrogeait un prédicat à TROIS conventions
 * BP3 (anglaise, française, indienne). Le corpus déclare DOUZE alphabets — gamelan_pelog, shruti23,
 * bohlen_pierce et shakuhachi n'ont AUCUNE image dans ces trois-là. Tant que c'est le lecteur qui
 * pose la question, il porte une décision sémantique qui n'est pas la sienne, ET qui n'a pas de
 * réponse pour les trois quarts du catalogue. La phrase de Kanopi, reprise par l'architecte.
 *
 * ⚠️ LA FORME N'EST PAS DE MOI, et c'est délibéré : Romain a gravé le 2026-07-29 que ni bpscript ni
 * l'architecte ne prennent de décision de FORMALISME DE LANGAGE. Le champ `noteTerminals` EXISTE,
 * ratifié et daté (`hub/decisions/2026-07-28-le-fait-ce-nom-est-une-note-vient-du-frontal.md`,
 * défini pour bp3-frontend) : liste PLATE de noms nus, au niveau SCÈNE, ABSENT ≠ VIDE, « la
 * résolution DÉJÀ FAITE, pour cette scène-là ». On GÉNÉRALISE ce champ, on n'en invente pas un
 * second — deux champs pour un même fait seraient deux sources de vérité.
 *
 * ⚠️ LE TÉMOIN QUE L'ARCHITECTE EXIGE, et c'est lui qui juge la solution : « ça doit marcher pour
 * gamelan_pelog, bohlen_pierce et shruti23 comme pour western. Une solution qui ne marche que pour
 * trois alphabets est fausse — c'est précisément le défaut qu'on retire. » Le §2 balaie donc les
 * DOUZE alphabets de la librairie, construits depuis la DONNÉE, jamais depuis une liste écrite ici.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const compiler = (src) => compileToBPxAST(src);

// ── 1. ABSENT ≠ VIDE — la distinction porte du sens, et c'est la moitié qu'on casse ─────────
// Un champ absent dit « je ne sais pas » ; une liste vide dit « aucun nom de cette scène n'est une
// note ». Les confondre ferait lire mon silence comme un fait, ce qui est le pire des deux.
{
  const r = compiler('@core\n@mine.perso.gamme\nS -> C4');
  ok(r.ast?.noteTerminals === undefined,
    `1. hauteur OPAQUE : le champ doit être ABSENT, pas vide (reçu ${JSON.stringify(r.ast?.noteTerminals)})`);
}
{
  const r = compiler('@core\n@actor viz  eval.hydra\nS -> voix\nvoix -> viz.`osc(4).out()`');
  ok(r.ast?.noteTerminals === undefined,
    `1. VOIX-CODE pure : ABSENT — un bloc de code n'est pas une note (reçu ${JSON.stringify(r.ast?.noteTerminals)})`);
}
{
  // Un alphabet est en portée et la scène n'écrit aucune note : c'est un FAIT, donc une liste vide.
  const r = compiler('@core\n@alphabet.western\n@var travail\nS -> travail');
  ok(Array.isArray(r.ast?.noteTerminals) && r.ast.noteTerminals.length === 0,
    `1. alphabet en portée mais aucune note écrite : liste VIDE, pas absente (reçu ${JSON.stringify(r.ast?.noteTerminals)})`);
}

// ── 2. LES DOUZE ALPHABETS — le témoin exigé, construit depuis la DONNÉE ────────────────────
// La liste des alphabets n'est PAS écrite ici : elle est LUE dans la librairie. Ajouter un
// alphabet le teste automatiquement ; en retirer un ne peut pas passer inaperçu (le socle §4 le
// refuse). C'est ce qui distingue un témoin d'une liste que quelqu'un devra penser à compléter.
const ALPHABETS = Object.entries(LIBS['alphabets'])
  .filter(([, o]) => o && typeof o === 'object' && !Array.isArray(o) && Array.isArray(o.notes) && o.notes.length)
  .map(([nom, o]) => [nom, o.notes[0]]);
console.log(`[arbre note] ${ALPHABETS.length} alphabets de la librairie, lus dans la donnée`);
for (const [nom, premiereNote] of ALPHABETS) {
  // On écrit une règle dont la tête n'est PAS une note et dont le corps EST une note de cet
  // alphabet-là. Le fait attendu ne dépend d'aucune convention BP3 : il n'y en a pas ici.
  const r = compiler(`@core\n@alphabet.${nom}\nmotif -> ${premiereNote}\nS -> motif`);
  ok((r.errors || []).length === 0,
    `2. ${nom} : la scène témoin doit compiler — ${(r.errors || []).map((e) => e.message).slice(0, 1)}`);
  ok((r.ast?.noteTerminals || []).includes(premiereNote),
    `2. ${nom} : '${premiereNote}' doit être RECONNU comme note (reçu ${JSON.stringify(r.ast?.noteTerminals)})`);
  ok(!(r.ast?.noteTerminals || []).includes('motif'),
    `2. ${nom} : 'motif' n'est PAS une note et ne doit pas y figurer`);
}

// ── 3. CE QUE LE CONSOMMATEUR CHERCHE VRAIMENT ──────────────────────────────────────────────
// Kanopi ne cherche pas une collision (ma règle d'unicité s'en charge) : il veut écarter de sa
// lecture de STRUCTURE les éléments qui sont des notes. Une tête de règle qui porte un nom de note
// doit donc y figurer — c'est exactement le cas qui l'intéresse.
{
  const r = compiler('@core\n@alphabet.western\nG4 -> C4 D4');
  ok((r.ast?.noteTerminals || []).includes('G4'),
    `3. une TÊTE DE RÈGLE nommée comme une note doit être marquée (reçu ${JSON.stringify(r.ast?.noteTerminals)})`);
}
{
  // Descendre jusqu'aux FEUILLES : un nom sous un groupe ou sous une note ancrée compte autant
  // qu'un voisin de surface. Faute payée quatre fois en juillet — compter la surface ne voit pas
  // ce qui vit sous un nœud composite.
  const r = compiler('@core\n@controls\n@alphabet.western:midi\n@trigger sync1:midi\nS -> {C4 E4} G4<!sync1');
  for (const n of ['C4', 'E4', 'G4']) {
    ok((r.ast?.noteTerminals || []).includes(n),
      `3. '${n}' sous un groupe ou une note ancrée doit être vu (reçu ${JSON.stringify(r.ast?.noteTerminals)})`);
  }
  ok(!(r.ast?.noteTerminals || []).includes('sync1'),
    '3. un point d\'attente n\'est PAS une note — une attente suspend le temps, elle ne sonne pas');
}
{
  // Ce n'est PAS le catalogue : seuls les noms PRÉSENTS dans la scène (décision 2026-07-28).
  const r = compiler('@core\n@alphabet.western\nS -> C4');
  const l = r.ast?.noteTerminals || [];
  ok(l.length === 1 && l[0] === 'C4',
    `3. la liste porte ce que la SCÈNE écrit, pas le catalogue de l'alphabet (reçu ${l.length} entrée(s))`);
}

// ── 4. SOCLE ET ANTI-RÉTRÉCISSEMENT ─────────────────────────────────────────────────────────
// Sans lui, une librairie vidée ou un filtre trop strict rendraient ce fichier vert en n'ayant
// rien examiné — la famille close le 2026-07-27, et le témoin exigé porte justement sur le NOMBRE
// d'alphabets couverts.
ok(ALPHABETS.length >= 12,
  `4. le témoin de l'architecte porte sur les DOUZE alphabets — ${ALPHABETS.length} lu(s) dans la donnée`);
for (const attendu of ['gamelan_pelog', 'bohlen_pierce', 'shruti23']) {
  ok(ALPHABETS.some(([n]) => n === attendu),
    `4. '${attendu}' est NOMMÉMENT exigé par l'architecte et doit être dans le balayage`);
}

if (echecs.length) {
  console.error(`[arbre note] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[arbre note] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
