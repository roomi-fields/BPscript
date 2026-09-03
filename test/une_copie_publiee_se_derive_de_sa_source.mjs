#!/usr/bin/env node
/**
 * GARDE — TOUTE COPIE PUBLIÉE EST DÉRIVÉE DE SA SOURCE, JAMAIS UNE SECONDE SOURCE.
 *
 * Ce que `public/` sert aux consommateurs doit porter EXACTEMENT le contenu de la source qu'on
 * édite. La matrice ci-dessous énumère les paires ; elle ne se devine pas, elle se mesure — la
 * recherche qui l'a produite est décrite plus bas.
 *
 * ⚠️ CE QUE CE GARDE FERME, mesuré le 2026-08-18 : les deux fichiers d'une paire étaient
 * identiques à l'octet et maintenus À LA MAIN. En migrant la source(l'arobase sortie du langage),
 * la copie est restée en arrière — et c'est ELLE que les consommateurs chargent. Pendant cette
 * fenêtre, l'appui d'éditeur enseignait un signe retiré à qui écrivait une scène.
 *
 * ⛔ LE MODE D'ÉCHEC EST MUET, et c'est ce qui le rend cher : une copie périmée ne rougit nulle
 * part. Elle sert, simplement, un contenu faux. Aucun compte, aucun test de forme ne la distingue
 * d'une copie à jour — seule l'égalité avec sa source la mesure.
 *
 * ⚠️ POURQUOI UNE MATRICE ET PAS LA PAIRE SIGNALÉE : la première a été trouvée en poursuivant
 * quatorze arobases, donc par accident. La FAMILLE a ensuite été cherchée pour elle-même, sur
 * 502 fichiers texte du dépôt (hors `.git`, `node_modules`, `_archive` et les répertoires d'outil),
 * en appariant les noms de base dont un exemplaire vit sous `public/` ou `dist/`. Elle rend DEUX
 * paires réelles — celles inscrites ici — et un faux positif nommé : `docs/index.json` (index de
 * documentation) et `public/demos/index.json` (catalogue de démos) partagent un nom de base sans
 * être la même chose. Un troisième candidat vit sous `_archive/`, hors périmètre vivant.
 *
 * LE GESTE QUAND CE GARDE MORD : recopier la source sur la copie. La source est celle qu'on édite ;
 * la copie ne s'édite jamais.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** source → copie publiée. Une ligne par paire, et le compte est éprouvé plus bas. */
const PAIRES = [
  ['editor/reference.json', 'public/help/reference.json'],
  ['editor/bpscript-lang.js', 'public/editor/bpscript-lang.js'],
];

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── SOCLE — refuser de conclure sur du vide ─────────────────────────────────────────────────
// Une matrice vidée passerait au vert en ne mesurant rien. Son compte est donc lui-même mesuré.
ok(PAIRES.length >= 2,
   `SOCLE : la matrice doit porter les paires mesurées — ${PAIRES.length} inscrite(s). Une paire `
   + `qui disparaît d'ici cesse d'être surveillée sans que personne le voie.`);

for (const [rSource, rCopie] of PAIRES) {
  const source = path.join(ROOT, rSource);
  const copie = path.join(ROOT, rCopie);

  ok(existsSync(source), `SOCLE : la source '${rSource}' est introuvable`);
  ok(existsSync(copie), `SOCLE : la copie '${rCopie}' est introuvable`);
  if (!existsSync(source) || !existsSync(copie)) continue;

  const a = readFileSync(source, 'utf8');
  const b = readFileSync(copie, 'utf8');

  // L'égalité se juge sur le CONTENU. Pour du JSON, deux arbres normalisés — une réécriture qui ne
  // change que l'indentation n'est pas une divergence de contenu, et rougir là-dessus apprendrait
  // à recopier sans lire. Pour le reste, le texte tel quel.
  let egal;
  if (rSource.endsWith('.json')) {
    try { egal = JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b)); }
    catch { egal = false; }
  } else egal = a === b;

  ok(egal,
    `'${rCopie}' A DIVERGÉ DE '${rSource}'. C'est la copie que les consommateurs chargent, donc `
    + `c'est le contenu FAUX qui sert, et rien ne le dit. Rejouer la dérivation : `
    + `cp ${rSource} ${rCopie}`);

  // ── LE TÉMOIN — sans lui, deux fichiers VIDÉS passeraient pour deux fichiers d'accord.
  ok(a.length > 200,
    `TÉMOIN — '${rSource}' doit porter du contenu : ${a.length} octet(s). Sous ce seuil, l'égalité `
    + `ci-dessus compare deux fichiers vides et ne prouve plus rien.`);
}

// ── ET L'AROBASE NE REVIENT PAS DANS L'APPUI D'ÉDITEUR ──────────────────────────────────────
// Elle est sortie du langage le 2026-08-17. Un exemple qui l'écrit enseigne une forme que le
// compilateur refuse — c'est le cas exact qui a motivé ce fichier.
{
  const j = JSON.parse(readFileSync(path.join(ROOT, 'editor/reference.json'), 'utf8'));
  const fautifs = [];
  const cherche = (n, p) => {
    if (!n || typeof n !== 'object') return;
    for (const [k, v] of Object.entries(n)) {
      if (typeof v === 'string' && ['example', 'syntax'].includes(k)
          && /(^|\n)[ \t]*@[a-zA-Z]/.test(v)) fautifs.push(p + '.' + k);
      else cherche(v, p + '.' + k);
    }
  };
  cherche(j, '');
  ok(fautifs.length === 0,
    `l'arobase est SORTIE du langage — ${fautifs.length} exemple(s) l'enseignent encore : `
    + `${fautifs.slice(0, 4).join(', ')}`);
}

if (echecs.length) {
  console.error(`❌ les copies publiées : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error('   - ' + e);
  process.exit(1);
}
console.log(`✅ ${PAIRES.length} copie(s) publiée(s) dérivent de leur source — ${passe} vérification(s)`);
