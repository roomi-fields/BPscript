#!/usr/bin/env node
/**
 * NOM contre FRÉQUENCE — un écart de nom est-il un écart de SON ?
 *
 * Méthode imposée (architecte [675]) : ne jamais conclure sur le nom seul. On résout les noms
 * NATIFS et les noms CANDIDATS par LE MÊME catalogue, et on compare les Hz.
 *   - Hz identiques  → iso au nommage près (différence de CONVENTION) — alignable, comme l'enharmonie.
 *   - Hz différents  → vraie erreur de résolution — un DIFF, et il faut le garder.
 *
 * On ne résout que les noms DISTINCTS (une poignée), pas les centaines de jetons.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { compileBPS } = require('../src/transpiler/index.js');
const { referenceFor, registerShiftFor } = require('./compare_modal.cjs');
const { createSession } = await import('/home/romi/dev/bp/BPx/dist/index.js');
const { resoudreViaKairos } = await import('./kairos_bridge.mjs');

const GR = path.join(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), 'test', 'grammars');

/** Hz de chaque nom, résolus par LE catalogue de la scène (jamais un calcul maison). */
async function hzDeNoms(noms, entete) {
  const carte = {};
  const lot = 60; // les règles très longues ralentissent la dérivation
  for (let i = 0; i < noms.length; i += lot) {
    const tranche = noms.slice(i, i + lot);
    const src = `${entete}\nS -> ${tranche.join(' ')}\n`;
    const out = compileBPS(src);
    if (out.errors.length) { for (const n of tranche) carte[n] = `ERR:${out.errors[0].message.slice(0, 30)}`; continue; }
    const s = createSession(out.ast, { seed: 1 });
    const { tokens } = await resoudreViaKairos(s);
    for (const t of tokens) if (carte[t.token] === undefined) carte[t.token] = t.hz;
  }
  return carte;
}

for (const nom of process.argv.slice(2)) {
  const ref = referenceFor(nom);
  const refToks = ref.tokens || [];
  const scene = readFileSync(`${GR}/${nom}/scene.bps`, 'utf-8');

  // En-tête de la scène (tout ce qui précède la 1re règle) : même alphabet, même accordage,
  // même transposition — sinon je comparerais deux résolutions différentes.
  const enteteScene = scene.split('\n').filter((l) => l.trim().startsWith('@')).join('\n');
  // ⚠️ La référence se résout SANS @transpose. Le natif a DÉJÀ appliqué son C4key : le nom
  // qu'il écrit (do3) est le nom RENUMÉROTÉ, il sonne tel quel. Lui appliquer ma transposition
  // le décalerait une seconde fois — j'ai failli conclure « 818 erreurs de résolution » sur ce
  // seul artefact de sonde.
  const entete = enteteScene.split('\n').filter((l) => !l.trim().startsWith('@transpose')).join('\n');

  const session = createSession(compileBPS(scene).ast, { seed: 1 });
  const { tokens: mine } = await resoudreViaKairos(session);

  const nomsRef = [...new Set(refToks.map((t) => t.token))];
  const nomsMien = [...new Set(mine.map((t) => t.token))];
  const hzRef = await hzDeNoms(nomsRef, entete);
  const hzMien = {}; for (const t of mine) if (hzMien[t.token] === undefined) hzMien[t.token] = t.hz;

  const shift = registerShiftFor(nom);
  let memeHz = 0, hzDiff = 0, absent = 0;
  const exemples = [];
  const n = Math.min(refToks.length, mine.length);
  for (let i = 0; i < n; i++) {
    const a = refToks[i].token, b = mine[i].token;
    if (a === b) continue;
    const ha = hzRef[a], hb = hzMien[b];
    if (typeof ha !== 'number' || typeof hb !== 'number') { absent++; continue; }
    if (Math.abs(ha - hb) < 0.01) { memeHz++; if (exemples.length < 4) exemples.push(`${a}/${b} = ${ha.toFixed(2)} Hz`); }
    else { hzDiff++; if (exemples.length < 8) exemples.push(`${a}=${ha.toFixed(2)} ≠ ${b}=${hb.toFixed(2)}`); }
  }
  console.log(`\n=== ${nom}  (ref ${refToks.length} / cand ${mine.length}, shift ${shift})`);
  console.log(`  noms differents mais MEME Hz : ${memeHz}   (→ convention, alignable)`);
  console.log(`  noms differents et Hz DIFFERENT : ${hzDiff}   (→ vraie erreur de resolution)`);
  console.log(`  non resolus : ${absent}`);
  exemples.forEach((e) => console.log('   ', e));
}
