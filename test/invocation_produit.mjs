#!/usr/bin/env node
/**
 * GARDE — une invocation de librairie PRODUIT une adresse, ou CRIE. Jamais rien entre les deux.
 *
 * POURQUOI ELLE VÉRIFIE CE QUI SORT, PAS CE QUI COMPILE. `@sound.tabla_perc` compilait depuis
 * toujours et ne produisait RIEN : ni prototype, ni référence de provenance. Six scènes du corpus
 * l'invoquaient en croyant qu'il résolvait. Un test qui aurait vérifié « ça compile » aurait été
 * vert pendant tout ce temps — c'est la différence entre un test qui rassure et un test qui
 * mesure. « Accepter n'est pas transmettre. »
 *
 * LA MÊME CAUSE FRAPPAIT `@transcription.X` : l'émetteur d'adresses exigeait un champ `notes`,
 * propre aux alphabets, parce que je l'avais écrit pour eux. Tout ce qui n'était pas un alphabet
 * était donc abandonné en silence. Ce garde couvre TOUS les axes, pas celui du jour.
 *
 * TROIS SORTIES POSSIBLES, et une seule interdite :
 *   entrée connue   → l'adresse SORT dans `ast.libRefs` ;
 *   entrée inconnue → le compilateur CRIE ;
 *   rien du tout    → interdit, et c'est ce que ce garde attrape.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { describeVocabulary } from '../src/transpiler/libs.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compile = (directive) => {
  try {
    return compileToBPxAST(`@core\n@controls\n@alphabet.western:midi\n${directive}\n@mode:ord\nS -> C4\n`);
  } catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};

// ─── 1. Une entrée CONNUE produit son adresse ────────────────────────────────────────────────
// Les axes de HAUTEUR (alphabet, tuning, octaves, scale) passent par un autre canal — c'est voulu
// et documenté dans l'émetteur ; on ne les exige pas ici.
const AUTRE_CANAL = new Set(['alphabet', 'tuning', 'octaves', 'scale']);
const composants = describeVocabulary().components;
let axesVerifies = 0;
for (const [axe, entrees] of Object.entries(composants)) {
  if (AUTRE_CANAL.has(axe) || !entrees || entrees.length === 0) continue;
  axesVerifies++;
  const entree = entrees[0];
  const r = compile(`@${axe}.${entree}`);
  ok((r.errors || []).length === 0, `1. '@${axe}.${entree}' doit compiler — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
  ok((r.ast?.libRefs || []).includes(`${axe}.${entree}`),
     `1. '@${axe}.${entree}' doit PRODUIRE l'adresse '${axe}.${entree}' — libRefs = ${JSON.stringify(r.ast?.libRefs || null)}`);
}
ok(axesVerifies > 0, "1. aucun axe à vérifier — le garde serait creux (l'univers des composants est vide ?)");

// ─── 2. Le cas qui a motivé le garde, nommé explicitement ────────────────────────────────────
{
  const r = compile('@sound.tabla_perc');
  ok((r.ast?.libRefs || []).includes('sound.tabla_perc'),
     "2. '@sound.tabla_perc' doit produire son adresse — 6 scènes du corpus l'invoquent");
  const t = compile('@transcription.dhati');
  ok((t.ast?.libRefs || []).includes('transcription.dhati'),
     "2. '@transcription.dhati' aussi — le filtre qui exigeait un champ d'alphabet l'abandonnait en silence");
}

// ─── 3. Une entrée INCONNUE crie, sur chaque axe ─────────────────────────────────────────────
for (const axe of Object.keys(composants)) {
  const r = compile(`@${axe}.nexistepas_${axe}`);
  ok((r.errors || []).length > 0,
     `3. '@${axe}.nexistepas' doit CRIER — une référence inexistante n'est jamais un silence`);
}

// ─── 4. Le point APPELLE, le deux-points AFFECTE — sur chaque axe, sans trou ─────────────────
for (const [axe, entrees] of Object.entries(composants)) {
  if (!entrees || entrees.length === 0) continue;
  const r = compile(`@${axe}:${entrees[0]}`);
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok((r.errors || []).length > 0, `4. '@${axe}:<X>' doit être refusé — ':' n'affecte pas un composant`);
  ok(msg.includes(`@${axe}:`),
     `4. le refus de '@${axe}:<X>' doit NOMMER la faute et donner la réécriture — reçu : ${msg.slice(0, 120)}`);
}

if (echecs.length) {
  console.error(`❌ invocation de librairie : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ invocation de librairie — ${passe} vérification(s) passée(s) sur ${Object.keys(composants).length} axe(s)`);
}
