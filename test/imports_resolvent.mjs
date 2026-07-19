#!/usr/bin/env node
/**
 * GARDE — tout import nommé d'un module LOCAL doit correspondre à un export réel.
 *
 * POURQUOI IL EXISTE. `compileBPS` a été supprimé le 2026-07-19 avec l'émission BP3. Le portillon
 * est resté vert, et trois fichiers ont continué d'importer le symbole disparu pendant toute une
 * journée — `scripts/inventory-scenes.mjs` mourait sur un SyntaxError à la première ligne,
 * `test/test_wasm_all.js` importait `compileBPS` tout en appelant `compileToBPxAST` (migration
 * faite à moitié), et un fichier de brouillon non suivi faisait de même.
 *
 * Rien ne pouvait les attraper : ces fichiers ne sont lancés par aucune suite, et une garde de
 * dépendances vérifie QUI dépend de QUI, jamais si le symbole importé existe encore. Un module
 * peut donc être « atteignable » et l'import qu'on en fait être mort.
 *
 * ⚠️ CE QU'IL NE COUVRE PAS, et il faut le savoir : il vérifie que le SYMBOLE existe, pas que le
 * fichier tourne. `test/test_wasm_all.js` passe désormais ce garde et reste inexécutable pour une
 * raison plus profonde (il écrit du CommonJS dans un paquet ESM). Un garde qui rassure sur un axe
 * qu'il ne mesure pas est exactement ce qu'on a payé toute la journée — donc : ce garde prouve la
 * cohérence des imports, RIEN d'autre.
 *
 * Usage :  node test/imports_resolvent.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
/** On inspecte le code qu'on possède. `_archive/` est une archive assumée, `public/src/` une copie non suivie. */
const EXCLUS = ['node_modules', '.git', '.claude', '_archive', 'dist', 'public/src', 'bp3-engine'];

function fichiers(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    const rel = path.relative(RACINE, p);
    if (EXCLUS.some((x) => rel === x || rel.startsWith(x + path.sep))) continue;
    if (statSync(p).isDirectory()) fichiers(p, acc);
    else if (/\.(js|mjs|cjs)$/.test(e)) acc.push(p);
  }
  return acc;
}

/** Exports nommés d'un module, par lecture statique — `export const X`, `export function X`, `export { A, B }`. */
function exportsDe(src) {
  const noms = new Set();
  for (const m of src.matchAll(/^\s*export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) noms.add(m[1]);
  for (const m of src.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const t = part.trim(); if (!t) continue;
      noms.add((t.split(/\s+as\s+/).pop() || t).trim());
    }
  }
  // CommonJS : `module.exports = { a, b }` et `exports.x = …`
  for (const m of src.matchAll(/^\s*exports\.([A-Za-z_$][\w$]*)\s*=/gm)) noms.add(m[1]);
  const cjs = src.match(/module\.exports\s*=\s*\{([^}]*)\}/s);
  if (cjs) for (const part of cjs[1].split(',')) {
    const t = part.trim(); if (!t) continue;
    noms.add((t.split(':')[0] || t).trim());
  }
  return noms;
}

/** Résout un spécificateur relatif vers un fichier existant. Rend null si ce n'est pas un module local. */
function resoudre(depuis, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null;
  const base = spec.startsWith('/') ? spec : path.resolve(path.dirname(depuis), spec);
  for (const c of [base, base + '.js', base + '.mjs', base + '.cjs', path.join(base, 'index.js')]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

let vus = 0, verifies = 0;
const morts = [];

for (const f of fichiers(RACINE)) {
  const src = readFileSync(f, 'utf-8');
  vus++;
  // `import { a, b } from '…'` et `const { a } = await import('…')` / `require('…')`
  const formes = [
    /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g,
    /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(?:await\s+import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of formes) {
    for (const m of src.matchAll(re)) {
      const cible = resoudre(f, m[2]);
      if (!cible) continue;                       // paquet externe ou chemin construit : hors périmètre
      const dispo = exportsDe(readFileSync(cible, 'utf-8'));
      if (dispo.size === 0) continue;             // export non lisible statiquement : on n'invente pas de verdict
      for (const brut of m[1].split(',')) {
        const nom = (brut.trim().split(/\s+as\s+/)[0] || '').trim();
        if (!nom) continue;
        verifies++;
        if (!dispo.has(nom)) {
          morts.push({ fichier: path.relative(RACINE, f), symbole: nom, cible: path.relative(RACINE, cible) });
        }
      }
    }
  }
}

console.log(`[imports] ${vus} fichier(s) inspecté(s), ${verifies} import(s) nommé(s) vérifié(s).`);
// Témoin anti-vacuité : un garde qui ne vérifie rien passerait au vert sans rien prouver.
if (verifies < 20) {
  console.log(`  FAIL  garde CREUX : ${verifies} import(s) vérifié(s), c'est trop peu pour que ce vert veuille dire quoi que ce soit`);
  process.exit(1);
}
for (const d of morts) console.log(`  FAIL  ${d.fichier} importe « ${d.symbole} » — absent de ${d.cible}`);
if (!morts.length) console.log('  OK   tout import nommé d\'un module local correspond à un export réel');
process.exit(morts.length ? 1 : 0);
