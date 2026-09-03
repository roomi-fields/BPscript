#!/usr/bin/env node
/**
 * GARDE — editor/reference.json et public/help/reference.json sont une PAIRE : ils doivent
 * rester IDENTIQUES.
 *
 * Mesuré le 2026-08-05 : ils avaient divergé sur l'entrée 'template' — editor/reference.json
 * portait encore la graphie plurielle '@templates' (v0.7), refusée par le compilateur depuis
 * le 2026-07-19 ; public/help/reference.json portait déjà le singulier avec sa note datée.
 * RIEN ne l'a signalé pendant trois semaines : aucun garde ne comparait la paire. Résolu en
 * gardant la version qui disait la vérité (public/help/) et en écrasant l'autre.
 *
 * ⚠️ PORTÉE : ce garde ne compare QUE ces deux fichiers, nommément. Il ne détecte aucune
 * autre paire de jumeaux qui existerait ailleurs dans le dépôt — CLAUDE.md, « un garde a une
 * portée, ce qui est dehors survit ».
 */
import { readFileSync } from 'node:fs';

const editeur = readFileSync(new URL('../editor/reference.json', import.meta.url), 'utf8');
const aide = readFileSync(new URL('../public/help/reference.json', import.meta.url), 'utf8');

if (editeur === aide) {
  console.log('✅ editor/reference.json et public/help/reference.json sont jumeaux — 1 vérification passée');
} else {
  console.error('❌ editor/reference.json et public/help/reference.json ont DIVERGÉ — ils doivent rester identiques(octet par octet)');
  process.exitCode = 1;
}
