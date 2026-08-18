#!/usr/bin/env node
/**
 * GARDE — déclarer un mot du vocabulaire CONFISQUE un nom : la machine le voit, plus moi.
 *
 * D'OÙ ELLE VIENT. Le 2026-07-26 j'ai déclaré `mute`, `unmute` et `panic`. `patchbay-demo.bps`
 * déclarait déjà une macro `mute` : sa règle écrivait sept mots, il en arrivait six, sans erreur ni
 * avertissement. Kairos l'a mesuré le lendemain, trois de ses bancs glissaient d'un index.
 *
 * POURQUOI UNE GARDE ET PAS UNE RÈGLE ÉCRITE. La règle existe déjà dans CLAUDE.md — « mesurer les
 * corpus consommateurs AVANT de déclarer un mot ». Mais elle demande de S'EN SOUVENIR au bon
 * moment, et une règle qui exige qu'on y pense n'est pas une règle, c'est une intention
 * (architecte, 2026-07-27). Corollaire qu'il applique et que j'applique ici : quand une règle
 * demande de la vigilance, chercher ce qui la rend MÉCANIQUE. Ce fichier est cette mécanisation —
 * le jour où un mot nouveau confisque un nom déjà porté par une scène, le portillon rougit AVANT
 * le push, sans que personne n'ait eu à y penser.
 *
 * ⚠️ ELLE N'INTERDIT RIEN. Une confiscation peut être légitime — mais jamais SILENCIEUSE ni
 * involontaire. La marche à suivre est écrite dans le message d'échec : mesurer, décider, puis
 * inscrire la collision ci-dessous avec sa date et sa raison. Le registre est le lieu où une
 * confiscation devient un choix daté au lieu d'un effet de bord.
 *
 * CE QU'ELLE REGARDE : les noms que les scènes DÉCLARENT (macros, alias, étiquettes, déclarations,
 * acteurs, modulateurs) — pas les mots qu'elles emploient. Un mot du vocabulaire employé au fil
 * d'une séquence est un usage normal (10 scènes écrivent nus des contrôles continus) ; un nom
 * DÉCLARÉ par une scène, lui, appartient à cette scène, et le vocabulaire le lui prend.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { loadLibsFromDirectives } from '../src/transpiler/libs.js';
import { LIBS } from '../src/transpiler/libs-data.js';
import { nomsBps, lireBps, exigerCorpus } from './corpus.mjs';
import { readdirSync, readFileSync } from 'node:fs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/**
 * LE REGISTRE DES CONFISCATIONS ASSUMÉES — une ligne par collision, datée et motivée.
 * Y ajouter une entrée est un GESTE, pas une formalité : il vaut « j'ai mesuré les consommateurs,
 * j'assume que ce nom appartienne désormais au langage ».
 */
const CONFISCATIONS_ASSUMEES = [
  // ⛔ RETIREE le 2026-08-09 : la collision n existe plus, parce que la scene qui la portait ne
  // compile plus. `patchbay-demo` declare cinq macros, et `macro` est supprime du langage — elle
  // est inscrite au registre des refus, en attente de la revue du patching.
  // ⚠️ CE GARDE L A DIT LUI-MEME, et c est ce qu on lui demande : une derogation dont le
  // beneficiaire a disparu est un trou, pas une tolerance. Elle sortira du registre le jour ou la
  // scene reviendra — sous une autre forme, avec peut-etre un autre nom.
];

// ─── 1. SOCLE — sans données, ce garde serait creux et vert ──────────────────────────────────
const VOCABULAIRE = loadLibsFromDirectives(Object.keys(LIBS).map((n) => ({ name: n }))).controlNames;
ok(VOCABULAIRE.size >= 50, `1. le vocabulaire doit être chargé — ${VOCABULAIRE.size} mot(s)`);

exigerCorpus();
const sources = [];
for (const n of nomsBps()) sources.push([n, lireBps(n)]);
const DEMOS = new URL('../public/demos/', import.meta.url);
for (const f of readdirSync(DEMOS).filter((x) => x.endsWith('.bps'))) {
  sources.push([`demo:${f}`, readFileSync(new URL(f, DEMOS), 'utf8')]);
}
ok(sources.length > 100, `1. il faut de quoi mesurer — ${sources.length} source(s) examinée(s)`);

// ─── 2. Ce que chaque scène DÉCLARE, confronté au vocabulaire ────────────────────────────────
const nomsDeclares = (ast) => [
  ...(ast.macros || []), ...(ast.aliases || []), ...(ast.labels || []),
  ...(ast.declarations || []), ...(ast.actors || []), ...(ast.cvInstances || []),
].map((d) => d && d.name).filter(Boolean);

const trouvees = [];
for (const [scene, src] of sources) {
  let o;
  try { o = compileToBPxAST(src); } catch { continue; }
  if ((o.errors || []).length > 0) continue;
  for (const nom of nomsDeclares(o.ast)) {
    if (VOCABULAIRE.has(nom)) trouvees.push({ scene, nom });
  }
}

const cle = (c) => `${c.scene}::${c.nom}`;
const assumees = new Set(CONFISCATIONS_ASSUMEES.map(cle));
const vues = new Set(trouvees.map(cle));

// 2a. Toute confiscation NOUVELLE rougit — c'est le cœur du garde.
for (const c of trouvees) {
  ok(assumees.has(cle(c)),
     `2a. le mot '${c.nom}' du vocabulaire CONFISQUE un nom que '${c.scene}' déclare, et ce n'est `
     + `pas assumé. Un mot nouveau ne casse aucune syntaxe : il prend un nom, et la scène qui le `
     + `portait est tronquée EN SILENCE. Marche à suivre : mesurer les corpus consommateurs, `
     + `décider si la confiscation est voulue, puis l'inscrire dans CONFISCATIONS_ASSUMEES avec `
     + `sa date et sa raison — ou renoncer au mot.`);
}

// 2b. Et le registre ne rancit pas : une entrée qui ne correspond plus à rien doit partir.
for (const c of CONFISCATIONS_ASSUMEES) {
  ok(vues.has(cle(c)),
     `2b. '${c.nom}' est inscrit comme confisqué à '${c.scene}' (${c.date}) mais la collision `
     + `n'existe plus — RETIRER l'entrée. Un registre qui garde des lignes mortes finit par ne `
     + `plus rien dire.`);
  ok(typeof c.pourquoi === 'string' && c.pourquoi.length > 30,
     `2b. l'entrée '${c.nom}' doit dire POURQUOI la confiscation est assumée, pas seulement qu'elle l'est`);
}

if (echecs.length) {
  console.error(`❌ confiscation de nom : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ aucun mot ne confisque un nom à l'insu de personne — ${passe} vérification(s) passée(s) `
            + `sur ${sources.length} source(s), ${VOCABULAIRE.size} mot(s) de vocabulaire`);
}
