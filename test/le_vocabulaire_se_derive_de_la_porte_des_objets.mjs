#!/usr/bin/env node
/**
 * GARDE — LE VOCABULAIRE DE L'ÉDITEUR SE DÉRIVE DE LA PORTE DES OBJETS.
 *
 * Arbitrage de Romain, 2026-09-03 (« b ») : la porte des objets EST la porte d'éditeur, et
 * `describeVocabulary()` se dérive d'elle ou sort. Les listes d'objets qu'elle rend — voix, entrées
 * de chaque axe de catalogue, fonctions — sont celles des familles de la porte, filtrées par le signal
 * `documented` de chaque entrée. Ce garde tient :
 *   1. l'égalité, famille par famille, entre ce que la porte déclare (documenté) et ce que le
 *      vocabulaire rend — et le TÉMOIN NON NUL : au moins une famille porte une entrée non documentée
 *      qui est bien absente du vocabulaire (sinon le filtre ne serait pas éprouvé) ;
 *   2. la dérivation est VIVANTE : une famille enregistrée dans le registre pendant le garde apparaît
 *      dans le vocabulaire sans un geste, et disparaît avec elle ;
 *   3. le complément textuel : le chargeur ne porte plus de `describeVocabulary`, aucun module de
 *      `src/transpiler` ne l'importe du chargeur, et le module du vocabulaire lit la porte.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describeVocabulary } from '../src/transpiler/index.js';
import { famille, axesDeCatalogue, objets } from '../src/transpiler/index-des-objets.js';
import { registerLib, leRegistre } from '../src/transpiler/libs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const documentes = (mot) => { const f = famille(mot); return f ? f.entrees.filter((e) => e.documented).map((e) => e.nom) : []; };
const nonDocumentes = (mot) => { const f = famille(mot); return f ? f.entrees.filter((e) => !e.documented).map((e) => e.nom) : []; };

// ── 1. famille par famille, et le témoin non nul ──────────────────────────────────────────────
{
  const v = describeVocabulary();
  ok(JSON.stringify(v.voices) === JSON.stringify(documentes('voice')), `1. voices = famille 'voice' documentée — reçu ${v.voices.length} / ${documentes('voice').length}`);
  // Une FONCTION est un mot qui porte son corps ET ses paramètres — la famille `function` a disparu
  // le 2026-09-03 : une manipulation est un contrôle du langage, et son corps se rattache à lui.
  const manipulations = objets().filter((o) => o.documented && typeof o.membres.body === 'string' && o.membres.params).map((o) => o.nom);
  ok(JSON.stringify(v.functions) === JSON.stringify(manipulations), `1. functions = les mots qui portent un corps et des paramètres — reçu ${v.functions.length} / ${manipulations.length}`);
  const axes = axesDeCatalogue();
  ok(axes.length >= 5, `1. au moins cinq axes de catalogue — reçu ${axes.length}`);
  ok(JSON.stringify(Object.keys(v.components)) === JSON.stringify(axes), `1. un axe = une clé de components, dans l'ordre du schéma — reçu ${JSON.stringify(Object.keys(v.components))}`);
  let exclus = 0;
  for (const axe of axes) {
    ok(JSON.stringify(v.components[axe]) === JSON.stringify(documentes(axe)), `1. components.${axe} = famille '${axe}' documentée — reçu ${(v.components[axe] || []).length} / ${documentes(axe).length}`);
    for (const nom of nonDocumentes(axe)) { exclus++; ok(!v.components[axe].includes(nom), `1. '${axe}.${nom}' n'est pas documenté : absent du vocabulaire`); }
  }
  ok(exclus > 0, `1. TÉMOIN NON NUL : au moins une entrée non documentée existe dans un axe — reçu ${exclus}`);
}

// ── 2. la dérivation est vivante ───────────────────────────────────────────────────────────────
{
  const registre = leRegistre();
  registerLib('zzvoix', { resolves: 'voice', documented: true, resolvedBy: 'témoin', objects: { zztemoin: { description: 'voix témoin du garde' } } });
  try {
    ok(describeVocabulary().voices.includes('zztemoin'), '2. une voix enregistrée dans le registre apparaît dans le vocabulaire sans un geste');
  } finally {
    delete registre.zzvoix;
    registerLib('zzvoix', undefined);
    delete registre.zzvoix;
  }
  ok(!describeVocabulary().voices.includes('zztemoin'), '2. et disparaît avec elle — le vocabulaire ne mémorise pas hors du registre');
}

// ── 3. le complément textuel ───────────────────────────────────────────────────────────────────
{
  const src = (f) => readFileSync(join(__dirname, '..', 'src', 'transpiler', f), 'utf-8');
  ok(!/function describeVocabulary/.test(src('libs.js')), '3. le chargeur ne porte plus de describeVocabulary');
  for (const f of ['parser.js', 'resolution.js', 'bpxAst.js', 'index.js']) {
    const t = src(f);
    const duChargeur = /import \{[^}]*describeVocabulary[^}]*\} from '\.\/libs\.js'/.test(t);
    ok(!duChargeur, `3. ${f} n'importe pas describeVocabulary du chargeur`);
  }
  const vocab = src('vocabulaire.js');
  ok(/from '\.\/index-des-objets\.js'/.test(vocab) && /famille\(/.test(vocab), '3. le module du vocabulaire lit la porte des objets');
}

ok(passe >= 15, `SOCLE : ${passe} vérifications — la matrice s'est vidée`);
if (echecs.length) {
  console.error(`[vocabulaire ← porte] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[vocabulaire ← porte] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
