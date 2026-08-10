#!/usr/bin/env node
/**
 * GARDE — UNE SCÈNE PORTE DANS L'ARBRE CE QU'ELLE ÉCRIT DANS SON TEXTE.
 *
 * ⚠️ CE GARDE EXISTE PARCE QU'AUCUN AUTRE NE REGARDAIT LÀ (2026-08-10). Mon garde de canonicité
 * COMPILE chaque scène : une scène dont l'arbre est vide passe, puisqu'elle compile. Le banc de
 * kanopi mesure le SON. Entre « ça compile » et « ça sonne », personne ne vérifiait que l'arbre
 * PORTE ce que l'auteur a écrit.
 *
 * CE QUE ÇA A COÛTÉ, mesuré sur pièces : `catalogue-de-gabarits-les-rangs.bps` — écrite pour
 * ENSEIGNER le catalogue de gabarits, livrée, commitée par kanopi, verte à son banc — écrit DEUX
 * entrées et l'arbre en porte UNE, corps VIDE. Zéro erreur. Elle enseigne une forme dont l'arbre
 * ne porte rien, et trois gardes verts l'ont laissée passer.
 *
 * ⚠️ ET LE DÉFAUT NE VIENT PAS DE LA SCÈNE : il vient de l'émission (parser.js:3574, BACKLOG
 * BPS-64). Ce garde ne l'accuse donc pas — il le NOMME et le tient, pour qu'il ne grandisse pas et
 * qu'il ne disparaisse pas non plus dans un total.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileToBPxAST } from '../src/transpiler/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// LES DEUX DOMICILES, comme le garde de canonicité : mes démos, et les scènes de langage chez
// kanopi. Un écart qui n'existerait que chez le voisin doit rougir ici aussi.
const RACINES = [path.join(ROOT, 'public'), path.join(ROOT, '..', 'kanopi', 'packages', 'library', 'scenes', 'samples')];

const scenes = [];
for (const r of RACINES) {
  if (!fs.existsSync(r)) { ok(false, `domicile introuvable : '${r}'`); continue; }
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.bps')) scenes.push(p);
    }
  })(r);
}
ok(scenes.length >= 85, `le corpus s'est vidé : ${scenes.length} scène(s), attendu ≥ 85`);

// ── CE QUI SE MESURE : une section ÉCRITE, un compte ATTENDU, ce que l'arbre PORTE ────────────
// Une matrice, pas un cas : le catalogue de gabarits est celui qui a mordu, il n'est pas le seul
// endroit où du texte peut mourir entre la scène et l'arbre.
const SECTIONS = [
  {
    quoi: 'catalogue de gabarits',
    // ce que l'auteur écrit : les lignes de rang sous `@template`
    ecrit: (t) => ((t.split(/^@template\b/m)[1] || '').split('\n').filter((l) => /^\s*\[\d+\]/.test(l)).length),
    // ce que l'arbre porte : les entrées, et le total des éléments de corps
    porte: (ast) => {
      const tpl = ast?.template || [];
      return { entrees: tpl.length, corps: tpl.reduce((n, e) => n + ((e.body || []).length), 0) };
    },
  },
  {
    quoi: 'acteurs',
    ecrit: (t) => (t.match(/^@actor\b/gm) || []).length,
    porte: (ast) => ({ entrees: (ast?.actors || []).filter((a) => a.name !== 'scene').length, corps: 1 }),
  },
  {
    quoi: 'variables',
    ecrit: (t) => (t.match(/^@var\b/gm) || []).length,
    porte: (ast) => ({ entrees: (ast?.vars || []).length, corps: 1 }),
  },
];

// ⚠️ LE DÉFAUT CONNU EST NOMMÉ, PAS COMPTÉ. Une exception qui vit dans un total se fond dedans ;
// nommée, elle EXIGE d'être retirée le jour où elle est réparée — et ce garde le vérifie plus bas.
const CONNUS = new Map([
  ['catalogue-de-gabarits-les-rangs.bps|catalogue de gabarits',
   'BPS-64 — parser.js:3574 rend UNE entrée sur deux et un corps VIDE. Défaut d\'émission, pas de la scène.'],
]);

const ecarts = [];
for (const p of scenes) {
  const texte = fs.readFileSync(p, 'utf8');
  let ast;
  try { const r = compileToBPxAST(texte); if ((r.errors || []).length) continue; ast = r.ast; }
  catch { continue; }
  for (const s of SECTIONS) {
    const n = s.ecrit(texte);
    if (!n) continue;
    const { entrees, corps } = s.porte(ast);
    if (entrees === n && corps > 0) continue;
    ecarts.push({ cle: `${path.basename(p)}|${s.quoi}`, nom: path.basename(p), quoi: s.quoi, n, entrees, corps });
  }
}

for (const e of ecarts) {
  ok(CONNUS.has(e.cle),
    `'${e.nom}' écrit ${e.n} ${e.quoi} et l'arbre en porte ${e.entrees} (corps : ${e.corps}). `
    + `Ce n'est pas une erreur de compilation — la scène passe. C'est du texte qui MEURT entre `
    + `l'auteur et le consommateur, et rien ne le dit.`);
}

// L'AUTRE SENS — un défaut connu qui ne se manifeste plus a survécu à sa raison, et il doit sortir.
{
  const vus = new Set(ecarts.map((e) => e.cle));
  for (const [cle, motif] of CONNUS) {
    ok(vus.has(cle),
      `'${cle}' est inscrit comme défaut connu (${motif}) mais l'écart a DISPARU — le retirer de la `
      + `liste, sinon l'exception survit à sa raison et masquera la prochaine.`);
  }
}

console.log(`[porte ce qu'elle écrit] ${scenes.length} scène(s) × ${SECTIONS.length} section(s) — `
  + `${ecarts.length} écart(s), ${CONNUS.size} connu(s) nommé(s)`);

if (echecs.length) {
  console.error(`[porte ce qu'elle écrit] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[porte ce qu'elle écrit] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
