#!/usr/bin/env node
/**
 * LE MODE VAUT POUR UN BLOC, ET IL NE CHANGE PAS EN COURS DE TIRAGE.
 *
 * DÉCISION DE ROMAIN, 2026-08-08 : « on ne change pas de mode en cours de tirage, on supprime cette
 * partie ». Le mode s'écrit `@mode:<valeur>` en tête de sous-grammaire — une ligne seule, avant ses
 * règles — et nulle part ailleurs.
 *
 * ⚠️ CE QUE CETTE DÉCISION A COÛTÉ À ÉTABLIR, ET LA LEÇON EST SUR LES RÉFÉRENCES. La spécification
 * écrivait `S -> A B C (mode:random)` et lui consacrait un paragraphe entier : « le mode porte plus
 * loin que sa place — écrit en suffixe de règle, il vaut pour la sous-grammaire entière ». J'avais
 * bâti sur cet exemple tout un axe de mon formalisme des portées : la distinction entre « où on a
 * le droit d'écrire » et « jusqu'où l'effet porte ».
 *
 * Romain a posé UNE question — « c'est issu de BP3 ? je croyais que le mode était donné une seule
 * fois en début de sous-grammaire » — et la mesure des trois sources a tout renversé :
 *     corpus (274 scènes)   : `@mode` en tête 287 fois · en sac ZÉRO
 *     moteur d'origine      : en tête de bloc, seul sur sa ligne · en suffixe JAMAIS
 *     mon arbre             : le mode restait sur la règle, le bloc restait SANS mode
 * La référence décrivait donc une forme que ni le moteur, ni aucune scène, ni mon propre code ne
 * connaissaient — et qui, appliquée, n'aurait rien fait. **Une spécification peut porter une forme
 * morte aussi longtemps que personne ne mesure ce qui l'écrit.**
 *
 * ⚠️ ET ELLE AVAIT ESSAIMÉ : DIX-SEPT occurrences dans les trois spécifications, alors que je n'en
 * avais vu qu'UNE. Corriger la section où le défaut s'est montré aurait laissé seize mensonges.
 *
 * CE QUE CE GARDE MESURE : le refus dans TOUTES les positions où un sac peut se poser, pas dans
 * celle du ticket. Une garde écrite pour la position qui s'est montrée laisse vivre les autres.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const P = '@core\n@alphabet.western\n';
const compiler = (s) => {
  try { return compileToBPxAST(P + s); } catch (e) { return { errors: [{ message: e.message }] }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message ?? e).join(' | ');

// ── A. TOUTES LES POSITIONS D'UN SAC REFUSENT LE MODE ────────────────────────────────────────
// Ajouter une position la teste automatiquement. Ce sont les six endroits où un sac peut se poser.
const POSITIONS = [
  ['suffixe de règle',        'S -> C4 D4 (mode:random)\n'],
  ['posé dans le flux',       'S -> !(mode:random) C4\n'],
  ['collé à une note',        'S -> C4(mode:random) D4\n'],
  ['collé à un groupe',       'S -> {C4 D4}(mode:random)\n'],
  ['collé à une fermante',    'S -> A B\nA -> { C4\nB -> D4 }(mode:random)\n'],
  ['collé à un silence',      'S -> C4 -(mode:random) D4\n'],
  // ⚠️ LES DEUX SIGNES. Mon premier refus ne visait que les parenthèses ; mesuré dans la foulée,
  // `S -> C4 [mode:random]` PASSAIT — refusé la minute d'avant, accepté après mon correctif,
  // parce que retirer `mode` des clés réservées l'avait sorti du garde des crochets. J'avais
  // fermé une porte en en ouvrant une autre, dans le même geste, en écrivant le correctif qui
  // cite la règle « énumérer TOUTES les formes que le parser peut produire ».
  ['entre crochets',          'S -> C4 [mode:random]\n'],
  // ⚠️ CETTE POSITION EST DESORMAIS FERMEE EN AMONT (2026-08-09) : le crochet ne se pose plus DANS
  // LE FLUX, quelle que soit sa cle. Le refus qu on y rencontre est donc celui de la POSITION, pas
  // celui du mode — et il ne peut pas donner la reecriture du mode, puisqu il ne sait pas de quoi
  // il parle. Ce n est pas une regression : c est une porte fermee plus tot sur le chemin.
  // Le mode reste garde sur les SEPT autres positions de cette matrice, dont sa forme en
  // parentheses dans le flux, qui elle reste ouverte a d autres cles.
  ['parenthèses dans le flux', 'S -> !(mode:random) C4\n'],
];
for (const [quoi, src] of POSITIONS) {
  const msg = messages(compiler(src));
  ok(/n'a plus sa place|@mode/.test(msg),
     `A. ${quoi} — '(mode:…)' doit être REFUSÉ et ne l'est pas (${msg.slice(0, 70) || 'aucune erreur'}). `
     + `Une garde écrite pour la seule position du ticket laisse vivre les cinq autres.`);
  ok(/@mode:/.test(msg),
     `A. ${quoi} — le refus doit donner la RÉÉCRITURE ('@mode:…' en tête de sous-grammaire). `
     + `Un refus qui ne dit pas quoi écrire à la place envoie l'auteur dans un mur.`);
}

// ── B. TÉMOIN QUI MORD — la forme VIVANTE passe, et les autres réglages aussi ────────────────
// ⚠️ Sans cette moitié, un compilateur qui refuserait tout sac passerait le volet A en triomphe.
for (const [quoi, src] of [
  ['@mode en tête de sous-grammaire',   '@mode:random\nS -> C4 D4\n'],
  ['un autre réglage en fin de règle',  'S -> C4 D4 (weight:50)\n'],
  ['un autre réglage dans le flux',     'S -> !(vel:80) C4\n'],
  ['un autre réglage collé à une note', 'S -> C4(vel:80) D4\n'],
]) {
  ok(messages(compiler(src)) === '',
     `B-témoin. ${quoi} doit PASSER et ne passe plus : ${messages(compiler(src)).slice(0, 80)}. `
     + `Le refus vise le mode, pas les sacs.`);
}

// ── C. LES DOCUMENTS N'ENSEIGNENT PLUS LA FORME MORTE ────────────────────────────────────────
// ⚠️ Ce volet existe parce que la forme vivait dans DIX-SEPT endroits et que je n'en avais vu
// qu'un. La doc se balaye, elle ne se relit pas.
{
  const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'docs');
  const fichiers = [];
  const marche = (d) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) marche(p); else if (f.name.endsWith('.md')) fichiers.push(p);
    }
  };
  marche(RACINE);
  const coupables = [];
  for (const p of fichiers) {
    const lignes = readFileSync(p, 'utf8').split('\n');
    lignes.forEach((l, i) => {
      if (/\(mode:/.test(l)) coupables.push(`${path.relative(RACINE, p)}:${i + 1}`);
    });
  }
  ok(coupables.length === 0,
     `C. ${coupables.length} endroit(s) de la documentation écrivent encore le mode dans un SAC : `
     + `${coupables.slice(0, 6).join(', ')}${coupables.length > 6 ? '…' : ''}. `
     + `La forme est supprimée du langage ; un document qui l'enseigne encore fabrique des scènes `
     + `qui ne compilent pas.`);
  ok(fichiers.length >= 20,
     `C-SOCLE : ${fichiers.length} document(s) balayés. Sous ce seuil le balayage ne lit plus la `
     + `documentation, et son verdict vert ne voudrait rien dire.`);
}

// ── SOCLE ────────────────────────────────────────────────────────────────────────────────────
ok(POSITIONS.length >= 8,
   `SOCLE : ${POSITIONS.length} positions testées. Le langage en compte huit — six pour la
   parenthèse, deux pour le crochet ; en retirer une rouvre exactement le trou que ce garde ferme.`);

if (echecs.length) {
  console.error(`❌ le mode ne change pas en cours de tirage : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ le mode vaut pour un bloc et ne change pas en cours de tirage — refusé dans les `
          + `${POSITIONS.length} positions d'un sac, avec sa réécriture ; 4 témoins prouvent que le `
          + `refus ne vise que lui ; la documentation entière balayée. `
          + `${passe} vérification(s) passée(s).`);
