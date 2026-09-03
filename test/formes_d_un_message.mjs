#!/usr/bin/env node
/**
 * VÉRIFICATEUR DES FORMES D'UN MESSAGE — ce que j'écris aux autres passe par le compilateur.
 *
 * ⚠️ POURQUOI IL EXISTE (Romain, 2026-07-28) : « ton rôle c'est d'être le spécialiste du langage
 * BPScript et tu spécules complètement, tu ne le maîtrises pas du tout. »
 * En une journée j'ai inventé une graphie et la lui ai montrée, semé des antislashs doublés dans
 * quatre documents, et documenté une forme qui fabrique un son fantôme. Chaque fois, la forme
 * n'était PAS passée au compilateur avant de sortir de moi.
 *
 * LE TROU EXACT, ET IL EST ÉTROIT : mes DOCUMENTS sont déjà gardés (`les_exemples_de_la_spec_
 * compilent.mjs` extrait les exemples et les compile). Mes MESSAGES ne l'étaient pas — or c'est
 * par là que passe ce que lisent Romain et les autres agents, et c'est ce qui a servi de base à
 * des arbitrages.
 *
 * LA CONVENTION, ET ELLE EST LE POINT : toute forme BPScript dans un message s'écrit dans un
 * BLOC INDENTÉ DE QUATRE ESPACES. Ce n'est pas de la mise en page — c'est ce qui rend la règle
 * VÉRIFIABLE : une forme non indentée est une forme non vérifiée, et ça se voit à l'œil sur le
 * brouillon. Le vérificateur ne devine jamais ce qui est du BPScript dans de la prose française :
 * deviner l'aurait rendu ininterprétable (mes phrases citent `@alias`, `->` et des noms de
 * directives en permanence).
 *
 * USAGE :
 *   node test/formes_d_un_message.mjs <brouillon.txt>
 * Sortie 0 = toutes les formes compilent. Sortie 1 = au moins une ne compile pas, et elle est
 * nommée avec le refus du compilateur. Aucune forme dans le fichier = sortie 0 avec un mot qui
 * le DIT (un fichier sans forme n'est pas une preuve, c'est une absence de preuve).
 */
import { readFileSync } from 'node:fs';
import { compileToBPxAST } from '../src/transpiler/index.js';

const fichier = process.argv[2];
if (!fichier) {
  console.error('usage : node test/formes_d_un_message.mjs <brouillon.txt>');
  console.error('  Toute forme BPScript du message doit être dans un bloc indenté de 4 espaces.');
  process.exit(2);
}

const lignes = readFileSync(fichier, 'utf8').split('\n');

// Les blocs indentés de 4 espaces, regroupés (un bloc = une scène à compiler d'un seul tenant).
const blocs = [];
let courant = null;
lignes.forEach((l, i) => {
  const estForme = /^ {4}\S/.test(l);
  if (estForme) {
    if (!courant) { courant = { debut: i + 1, lignes: [] }; blocs.push(courant); }
    courant.lignes.push(l.slice(4));
  } else if (l.trim() === '' && courant) {
    // une ligne vide ne coupe pas un bloc : une scène en a
    courant.lignes.push('');
  } else {
    courant = null;
  }
});

if (!blocs.length) {
  console.log('[formes] aucune forme BPScript dans ce message(aucun bloc indenté de 4 espaces).');
  console.log('⚠️ Ce n\'est PAS une preuve que le message est juste : c\'est une absence de forme à');
  console.log('   vérifier. Si le message CITE une forme sans l\'indenter, la règle est violée et');
  console.log('   ce vérificateur ne peut pas le voir — c\'est à la relecture du brouillon.');
  process.exit(0);
}

// Une forme citée est souvent un FRAGMENT (une règle seule, une directive seule) : on l'enveloppe
// dans la plus petite scène qui lui donne un sens, et on le DIT. Un fragment qui ne compile pas
// seul n'est pas forcément faux — mais il ne doit pas sortir sans qu'on sache lequel des deux.
const SOCLE = 'core\nalphabet.western\n-----\n';
let echecs = 0;
for (const b of blocs) {
  const texte = b.lignes.join('\n').trim();
  if (!texte) continue;
  const aDejaUnSocle = /^@(core|alphabet|actor|controls)/m.test(texte) || /^(gate|trigger|cv) /m.test(texte);
  const source = aDejaUnSocle ? texte : SOCLE + texte;
  let verdict;
  try {
    const r = compileToBPxAST(source);
    verdict = (r.ast && !(r.errors ?? []).length)
      ? null
      : (r.errors ?? []).map((e) => e.message ?? String(e)).join(' | ');
  } catch (e) { verdict = 'JETÉ : ' + String(e.message); }
  const ou = `ligne ${b.debut}${aDejaUnSocle ? '' : ' (enveloppée dans une scène minimale)'}`;
  if (verdict) {
    echecs++;
    console.error(`✗ ${ou}\n    ${texte.split('\n')[0]}\n    → ${verdict}`);
  } else {
    console.log(`✔ ${ou} — compile`);
  }
}

console.log(`\n[formes] ${blocs.length} bloc(s) · ${echecs} en échec`);
if (echecs) {
  console.error('⚠️ NE PAS ENVOYER. Une forme fausse dans un message devient une base d\'arbitrage :');
  console.error('   c\'est comme ça qu\'un exemple inventé est arrivé jusqu\'à Romain le 2026-07-28.');
  process.exit(1);
}
