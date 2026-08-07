#!/usr/bin/env node
// LE SCHÉMA D'ARBRE ENGENDRÉ EST CONFRONTÉ — le second formalisme sort du néant.
//
// ⚠️ CE QUE CE GARDE ÉTABLIT, ET POURQUOI IL A FALLU LE CHERCHER.
// Romain demandait DEUX formalismes maintenus : la grammaire, et « l'équivalent pour l'AST ».
// J'ai passé la journée à dire que le second n'existait pas — que `AST.md` restait un document
// que rien ne lit. C'était vrai de `AST.md`, et FAUX du chantier : l'outil ENGENDRE déjà un
// schéma d'arbre depuis la grammaire (`generated/ast.ts`, 55 types). Le second formalisme
// existait, il n'était simplement confronté à rien.
//
// ⚠️ ET C'EST UNE DIFFÉRENCE DE NATURE, pas de degré. `AST.md` est écrit à la main et peut
// mentir — il l'a fait aujourd'hui même, en déclarant un champ que personne ne produisait. Le
// schéma engendré ne peut pas mentir sur la grammaire : il EST la grammaire, sous une autre
// forme. Ce que ce garde mesure, c'est donc l'écart entre ce que la grammaire produit et ce que
// `AST.md` prétend.
//
// LES TROIS VOLETS :
//   A. le schéma est ENGENDRÉ et peuplé — sinon les deux suivants ne mesurent rien ;
//   B. chaque nœud du schéma engendré porte un nom RECEVABLE — pas de nom réservé qui obligerait
//      un consommateur à le renommer ;
//   C. l'écart avec `AST.md` est CHIFFRÉ et ne remonte pas.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = path.join(ICI, '..', 'maquette', 'parseur-derive', 'generated', 'ast.ts');
const ASTMD = path.join(ICI, '..', 'docs', 'spec', 'AST.md');

if (!existsSync(SCHEMA)) {
  console.log('⏭️  schéma d\'arbre non engendré — `cd maquette/parseur-derive && npx langium generate`. '
            + 'Ce garde ne mesure rien tant qu\'il n\'existe pas.');
  process.exit(0);
}

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const src = readFileSync(SCHEMA, 'utf-8');
const noeuds = [...src.matchAll(/^export interface ([A-Za-z][A-Za-z0-9_]*)/gm)].map((m) => m[1]);

// ── A. le schéma est peuplé ─────────────────────────────────────────────────
ok(noeuds.length >= 30,
   `A. SOCLE : ${noeuds.length} nœud(s) dans le schéma engendré — il n'est plus produit, ou la `
   + `grammaire s'est vidée.`);

// ── B. aucun nom irrecevable ────────────────────────────────────────────────
// ⚠️ MESURÉ le 2026-08-06 : l'outil REFUSE `Symbol`, nom réservé du runtime JavaScript. Le nœud
// le plus produit du langage — 21 924 occurrences — ne peut donc pas garder son nom, et l'arbre
// engendré le porte sous `SymbolRef`. Ce garde vérifie qu'aucun AUTRE nom du langage ne tombe
// dans le même piège sans qu'on l'ait vu : un consommateur qui devrait renommer découvrirait la
// contrainte au moment de brancher, pas avant.
const RESERVES = ['Symbol', 'Object', 'Function', 'Array', 'String', 'Number', 'Boolean', 'Map',
                  'Set', 'Date', 'Error', 'Promise', 'RegExp', 'Proxy', 'Reflect'];
const collisions = noeuds.filter((n) => RESERVES.includes(n));
ok(collisions.length === 0,
   `B. ${collisions.length} nœud(s) portent un nom réservé du runtime : ${collisions.join(', ')} — `
   + `l'outil les refusera, et le consommateur devra renommer.`);

// ── C. l'écart avec AST.md, chiffré ─────────────────────────────────────────
const md = readFileSync(ASTMD, 'utf-8');
const declares = new Set([...md.matchAll(/^([A-Z][A-Za-z]*)\s*\{\s*$/gm)].map((m) => m[1]));
ok(declares.size >= 20, `C. SOCLE : ${declares.size} nœuds déclarés dans AST.md`);

const communs = noeuds.filter((n) => declares.has(n));
const seulementEngendres = noeuds.filter((n) => !declares.has(n));

// RETARD daté du 2026-08-07 — il ne peut que descendre. Le chiffre dit combien de nœuds le
// schéma engendré porte sans qu'`AST.md` les connaisse : c'est la mesure de la distance entre
// ce que la grammaire produit et ce que la spec dérivée décrit.
const RETARD = 39;   // mesuré le 2026-08-07
ok(seulementEngendres.length <= RETARD,
   `C. ${seulementEngendres.length} nœud(s) du schéma engendré absents d'AST.md — le retard `
   + `mesuré le 2026-08-07 était de ${RETARD}, il ne doit pas remonter.`);

// ⚠️ TÉMOIN À DEUX SENS : sans lui, une grammaire qui ne produirait plus RIEN passerait le volet C
// avec un écart de zéro. Le recouvrement doit rester réel.
ok(communs.length >= 5,
   `C-témoin. ${communs.length} nœud(s) portent le même nom des deux côtés — sous ce seuil, un `
   + `écart faible ne veut plus dire « proche », il veut dire « vide ».`);

if (echecs.length) {
  console.error(`❌ schéma d'arbre : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ le schéma d'arbre engendré est confronté — ${passe} vérification(s) : `
          + `${noeuds.length} nœuds engendrés depuis la grammaire, ${declares.size} déclarés dans `
          + `AST.md, ${communs.length} portent le même nom, ${seulementEngendres.length} au retard daté.`);
console.log(`   ⚠️ Ce garde compare des NOMS. Deux nœuds homonymes peuvent porter des champs `
          + `différents — l'égalité de forme n'est pas mesurée ici.`);
