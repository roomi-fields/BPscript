#!/usr/bin/env node
// Inventaire des scènes .bps : compile via compileToBPxAST, catégorise, détecte backticks/langages.
// (lisait `compileBPS` — supprimé le 2026-07-19 avec l'émission BP3 ; le script ne se chargeait
//  plus du tout, SyntaxError à l'import. Il n'exploitait que `errors`, la migration est neutre.)
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { compileToBPxAST } from '../src/transpiler/index.js';

const DIRS = ['public/demos', 'scenes', '_archive/web'];
const EXTERNAL = ['tidal', 'foxdot', 'orca', 'sc', 'py', 'hs', 'sclang', 'supercollider'];

// Retire les commentaires // (hors backticks) pour ne détecter que le code réel.
function stripComments(src) {
  let out = '', bt = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '`') { bt = !bt; out += c; continue; }
    if (!bt && c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n'; continue;
    }
    out += c;
  }
  return out;
}

function firstComment(src) {
  for (const raw of src.split('\n')) {
    const l = raw.trim();
    if (l.startsWith('//')) return l.replace(/^\/+\s*/, '').slice(0, 70);
  }
  return '';
}

const rows = [];
for (const dir of DIRS) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter(x => x.endsWith('.bps')).sort()) {
    const path = join(dir, f);
    const src = readFileSync(path, 'utf-8');
    let ok = false, err = '';
    try {
      const r = compileToBPxAST(src);
      ok = !r.errors || r.errors.length === 0;
      if (!ok) err = (r.errors[0].message || String(r.errors[0])).slice(0, 60);
    } catch (e) { err = (e.message || String(e)).slice(0, 60); }
    const code = stripComments(src);
    const hasBT = /`/.test(code);
    const tags = [...new Set([...code.matchAll(/`(\w+):/g)].map(m => m[1].toLowerCase()))];
    const ext = tags.filter(t => EXTERNAL.includes(t));
    let cat;
    if (ext.length) cat = 4;
    else if (hasBT) cat = 2;
    else cat = 1;
    const lines = src.split('\n').filter(l => l.trim() && !l.trim().startsWith('//')).length;
    rows.push({ path, ok, err, cat, hasBT, tags, ext, lines, desc: firstComment(src) });
  }
}

const summary = { 1: [0, 0], 2: [0, 0], 4: [0, 0] };
for (const r of rows) { summary[r.cat][0]++; if (r.ok) summary[r.cat][1]++; }
console.log(JSON.stringify({ summary, rows }, null, 1));
