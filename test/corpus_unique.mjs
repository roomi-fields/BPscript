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
import { readdirSync, statSync, existsSync } from 'node:fs';
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
if (!existsSync(DIR_BPS) || !existsSync(DIR_GR)) {
  console.log('  FAIL  garde CREUX : la bibliothèque est introuvable — « aucune copie ici » ne prouve alors rien');
  process.exit(1);
}

if (copies.length) {
  for (const c of copies) console.log(`  FAIL  test/${c} — copie du corpus ; il appartient à la bibliothèque Kanopi, passer par test/corpus.mjs`);
  console.log(`\n  ${copies.length} copie(s). Une copie qui garde un lecteur n'est pas en retrait : elle est réutilisée, et elle diverge.`);
  process.exit(1);
}

console.log('  OK   aucune scène ni grammaire du corpus n\'est hébergée sous test/ — 1 assertion');
