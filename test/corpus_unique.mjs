#!/usr/bin/env node
/**
 * GARDE — ce dépôt ne possède PAS de copie du corpus des 113.
 *
 * POURQUOI IL EXISTE. Nommer un risque ne le traite pas. La décision du 2026-07-20 donne au corpus
 * un propriétaire unique (la bibliothèque Kanopi) ; sans mécanisme, cette règle se re-négocie toute
 * seule au premier « je remets juste un fichier de test ici, le temps de… ». C'est exactement comme
 * ça que `scenes/vina.bps` et `test/grammars/vina/scene.bps` ont divergé sous le même nom pendant
 * des jours, en faisant se contredire deux agents de bonne foi.
 *
 * CE QU'IL VÉRIFIE : aucune scène ni grammaire du corpus ne réapparaît sous `test/`. Ce dépôt les
 * EMPRUNTE via `test/corpus.mjs`, il ne les héberge plus.
 *
 * CE QU'IL NE VÉRIFIE PAS, et il faut le savoir : il ne compare pas les CONTENUS avec la
 * bibliothèque. Un garde qui rassure sur un axe qu'il ne mesure pas est ce qu'on a payé toute la
 * semaine — celui-ci prouve l'absence de copie, RIEN d'autre.
 *
 * Usage :  node test/corpus_unique.mjs
 */
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DIR_BPS, DIR_GR } from './corpus.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);

/** Ce qui reste légitimement ici : les ORACLES de mesure, produits par ce dépôt (cf. test/README.md). */
const ORACLES = /(^|\/)(snapshots|oracles)(\/|$)/;

function scanner(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    const rel = path.relative(ICI, p);
    if (ORACLES.test(rel)) continue;
    if (statSync(p).isDirectory()) scanner(p, acc);
    else if (/\.(bps|gr)$/.test(e)) acc.push(rel);
  }
  return acc;
}

// Le risque n'est pas « un .bps existe sous test/ » — ce dépôt a ses propres fixtures, écrites ici
// et qui n'appartiennent à personne d'autre. Le risque est qu'un fichier porte le NOM d'une entrée
// du corpus : c'est ce qui fait diverger deux fichiers sous le même nom, l'incident vina exactement.
const NOMS_CORPUS = new Set(
  (existsSync(DIR_BPS) ? readdirSync(DIR_BPS) : []).map((f) => f.replace(/\.bps$/, ''))
    .concat((existsSync(DIR_GR) ? readdirSync(DIR_GR) : []).map((f) => f.replace(/\.gr$/, '')))
);
// `scene.bps` / `original.gr` : les noms qu'avait la copie supprimée. Ils ne doivent jamais revenir.
const FORMES_COPIE = new Set(['scene.bps', 'original.gr']);

const copies = scanner(ICI).filter((rel) => {
  const base = path.basename(rel);
  return FORMES_COPIE.has(base) || NOMS_CORPUS.has(base.replace(/\.(bps|gr)$/, ''));
});

console.log(`[corpus] la source est ${path.relative(path.resolve(ICI, '..', '..'), DIR_BPS)} et ${path.relative(path.resolve(ICI, '..', '..'), DIR_GR)}`);

// Témoin anti-vacuité : si la bibliothèque a disparu, ce garde passerait au vert en ne prouvant
// rien — le faux vert le plus coûteux, puisqu'il certifie une unicité obtenue par le vide.
//
// ⚠️ IL NE REGARDAIT QUE L'EXISTENCE DES DOSSIERS, et c'était un cran trop haut : deux dossiers
// VIDES le satisfaisaient, la liste de noms sortait vide, aucun fichier ne pouvait donc matcher, et
// le verdict tombait au VERT après n'avoir comparé À RIEN. Mesuré le 2026-07-27 — même famille que
// les six autres, mais celle-ci était la plus retorse : le témoin anti-vacuité existait DÉJÀ, il
// vérifiait juste la mauvaise chose. Un témoin posé au mauvais niveau rassure sans protéger.
if (!existsSync(DIR_BPS) || !existsSync(DIR_GR)) {
  console.log('  FAIL  garde CREUX : la bibliothèque est introuvable — « aucune copie ici » ne prouve alors rien');
  process.exit(1);
}
if (NOMS_CORPUS.size === 0) {
  console.log('  FAIL  garde CREUX : la bibliothèque est VIDE(0 nom) — aucun fichier ne peut entrer en collision '
            + "avec une liste vide, « aucune copie ici » ne prouve alors rien non plus");
  process.exit(1);
}

if (copies.length) {
  for (const c of copies) console.log(`  FAIL  test/${c} — copie du corpus ; il appartient à la bibliothèque Kanopi, passer par test/corpus.mjs`);
  console.log(`\n  ${copies.length} copie(s). Une copie qui garde un lecteur n'est pas en retrait : elle est réutilisée, et elle diverge.`);
  process.exit(1);
}

/**
 * ── ET AUCUN FICHIER DE CODE NE RECOMPOSE LE CHEMIN DU CORPUS ────────────────────────────────────
 *
 * ⛔ CE VOLET EST UNE DETTE PAYÉE, ET LE GARDE AU-DESSUS L'AVAIT LAISSÉE PASSER DEUX FOIS. Il
 * interdisait de copier un FICHIER du corpus ; il ne disait rien du CHEMIN. Or `corpus.mjs` se
 * déclare « le seul endroit qui le sait » et sa propre règle est écrite : « ne recompose JAMAIS le
 * chemin à la main dans un test ; douze chemins recopiés, c'est douze occasions de diverger ».
 *
 * ⇒ MESURÉ LE 2026-09-04, sous enveloppe : DEUX gardes le recomposaient, dont un en chemin ABSOLU.
 *   Ils ont rendu ZÉRO scène en silence quand la racine a changé — un l'a dit, l'autre a compté
 *   zéro et conclu. Aucun des deux n'était visible avant que la frontière existe.
 *
 * Un COMMENTAIRE peut nommer le chemin : c'est de la documentation, pas une lecture. Seule une
 * ligne de code compte.
 */
const CODE = /\.(m?js|cjs|ts)$/;
const fichiersDeCode = (dir, acc = []) => {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git') continue;
    const p = path.join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }   // un lien mort ne fait pas tomber le balayage
    if (st.isDirectory()) fichiersDeCode(p, acc);
    else if (CODE.test(e)) acc.push(p);
  }
  return acc;
};
const RACINE = path.resolve(ICI, '..');
// ⚠️ DEUX FICHIERS SONT HORS D'ATTEINTE, ET POUR DEUX RAISONS DIFFÉRENTES : `corpus.mjs` PORTE la
// déclaration — c'est son travail — et ce garde-ci porte le MOTIF qui la traque, donc il s'accuse
// lui-même. Un juge ne peut pas être son propre accusé quand l'accusation est écrite dans sa main.
const DECLARATION = path.join(ICI, 'corpus.mjs');
const MOI_MEME = path.join(ICI, 'corpus_unique.mjs');
const recomposent = [];
let examines = 0;
for (const f of fichiersDeCode(RACINE)) {
  if (f === DECLARATION || f === MOI_MEME) continue;
  examines++;
  const lignes = readFileSync(f, 'utf8').split('\n');
  lignes.forEach((l, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;                 // un commentaire documente, il ne lit pas
    if (/kanopi['"/\s,)\]]*[^\n]*packages['"/\s,)\]]*[^\n]*library/.test(l)) {
      recomposent.push(`${path.relative(RACINE, f)}:${i + 1}  ${l.trim().slice(0, 90)}`);
    }
  });
}
if (examines < 100) {
  console.log(`  FAIL  garde CREUX : ${examines} fichier(s) de code examiné(s) — un périmètre qui fond ne prouve rien`);
  process.exit(1);
}
if (recomposent.length) {
  for (const r of recomposent) console.log(`  FAIL  ${r}`);
  console.log(`\n  ${recomposent.length} chemin(s) du corpus recomposé(s) à la main. La déclaration unique est `
            + `test/corpus.mjs — importer DIR_BPS, DIR_GR, bpsPath ou toutesLesScenes. Un chemin recopié `
            + `rend ZÉRO en silence le jour où la racine bouge, et un garde qui compte zéro conclut.`);
  process.exit(1);
}

console.log(`  OK   aucune scène ni grammaire du corpus n'est hébergée sous test/ — 1 assertion, `
          + `${NOMS_CORPUS.size} nom(s) du corpus confrontés à l'arborescence de test/`);
console.log(`  OK   aucun des ${examines} fichier(s) de code ne recompose le chemin du corpus — 2 assertions`);
