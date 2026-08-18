#!/usr/bin/env node
/**
 * GARDE ANTI-RETOUR — l'ancien nom du POINT D'ATTENTE est SORTI, il ne revient pas.
 *
 * Romain aligne le vocabulaire (2026-07-29) : le TYPE de nœud s'appelait `TriggerIn` alors que sa
 * nature vaut `wait`. Il devient `Wait`, et `SymbolWithTriggerIn` devient `SymbolWithWait`.
 * La nature, les champs et la GRAPHIE du langage ne changent pas — une seule scène de la
 * bibliothèque emploie le point d'attente et aucune ne change d'un caractère.
 *
 * ⚠️ POURQUOI CE GARDE EXISTE, ET C'EST LA RÈGLE ANTI-RÉTROCOMPAT DU 2026-07-19 : remplacer X par
 * Y, c'est SUPPRIMER X dans le même mouvement. Pas d'alias « le temps de ». Sans ce garde, une
 * réapparition du vieux nom ne casserait rien de visible chez moi — elle re-fabriquerait
 * simplement le désaccord entre le type et la nature, en silence.
 *
 * ⚠️ ET UNE QUALIFICATION QUE J'AI DÛ CORRIGER MOI-MÊME, parce qu'elle avait déjà servi à décider :
 * j'avais annoncé à l'architecte que ce renommage serait une CASSE MUETTE chez les consommateurs.
 * FAUX, mesuré chez BPx : leur `M3_SUPPORTED_RHS_TYPES` (loadGrammar.ts:274-275) est une liste
 * BLANCHE, et `assertSupportedRhs` JETTE sur un type absent. Ils cassent BRUYAMMENT, au
 * chargement. Le protocole de coordination avait été bâti sur ma version alarmante ; il restait
 * bon, mais la raison ne l'était pas.
 *
 * L'ORDRE DE BASCULE, donné par BPx et suivi : je pousse D'ABORD. Ils lisent ma source EN DIRECT —
 * à l'instant où mon parseur émet `Wait`, leur liste blanche le refuse et crie. S'ils basculaient
 * avant moi, c'est l'inverse qui casserait. La fenêtre se ferme dans le bon sens si je pars le
 * premier.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── 1. LE NOUVEAU NOM EST CELUI QUI SORT ────────────────────────────────────────────────────
const S = 'core\nalphabet.western:midi\nin.midi sync1\nmode:ord\n-----\n';
const rhs0 = (regle) => compileToBPxAST(`${S}${regle}\n`).ast?.subgrammars?.[0]?.rules?.[0]?.rhs?.[0];
{
  const seul = rhs0('S -> <!sync1 C4');
  ok(seul?.type === 'Wait', `1. le point d'attente seul est un 'Wait' (reçu ${seul?.type})`);
  ok(seul?.payload?.nature === 'wait', '1. et sa nature ne change pas — c\'est le TYPE qu\'on aligne');
  const ancre = rhs0('S -> C4<!sync1 D4');
  ok(ancre?.type === 'SymbolWithWait', `1. la forme ancrée est un 'SymbolWithWait' (reçu ${ancre?.type})`);
  ok(ancre?.triggers?.[0]?.payload?.nature === 'wait', '1. la nature arrive aussi sur la forme ancrée');
  ok(ancre?.symbol?.payload?.nature === 'sounding', '1. et la note ancrée reste une NOTE');
}

// ── 2. L'ANCIEN NOM NE SURVIT NULLE PART — le balayage, pas mes exemples ────────────────────
// Une réapparition ne casserait RIEN de visible : elle re-fabriquerait le désaccord type/nature
// en silence. C'est pour ça que le garde balaie les fichiers, et pas seulement la sortie.
const RACINES = ['src', 'test', 'docs'];
const IGNORE = /(^|\/)(node_modules|dist|\.git)(\/|$)/;
const survivants = [];
const marcher = (dir) => {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (IGNORE.test(p)) continue;
    if (statSync(p).isDirectory()) { marcher(p); continue; }
    if (!/\.(js|mjs|cjs|ts|md|json)$/.test(p)) continue;
    if (p.endsWith('l_ancien_nom_du_point_d_attente_ne_revient_pas.mjs')) continue; // ce fichier le CITE
    const texte = readFileSync(p, 'utf8');
    // `TRIGGER_IN` est le JETON du lexeur (la graphie `<!`), il ne change PAS : on ne vise que
    // le nom de TYPE, en camel — la distinction compte, sinon ce garde refuserait le lexeur.
    for (const m of texte.matchAll(/\bSymbolWithTriggerIn\b|\bTriggerIn\b/g)) {
      survivants.push(`${p} : ${m[0]}`);
    }
  }
};
for (const r of RACINES) marcher(r);
ok(survivants.length === 0,
  `2. l'ancien nom doit avoir DISPARU — ${survivants.length} survivant(s) : ${survivants.slice(0, 5).join(' · ')}`);

// ── 3. SOCLE — sans lui, un balayage qui ne lirait rien verdirait ───────────────────────────
let lus = 0;
const compter = (dir) => {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (IGNORE.test(p)) continue;
    if (statSync(p).isDirectory()) { compter(p); continue; }
    if (/\.(js|mjs|cjs|ts|md|json)$/.test(p)) lus++;
  }
};
for (const r of RACINES) compter(r);
ok(lus > 50, `3. le balayage doit LIRE des fichiers — ${lus} lu(s)`);
// TÉMOIN D'INSTRUMENT : le motif doit savoir trouver quelque chose quand il y en a.
ok(/\bTriggerIn\b/.test('type: TriggerIn'), '3. TÉMOIN — le motif doit savoir MORDRE');
ok(!/\bTriggerIn\b/.test('T.TRIGGER_IN'), '3. TÉMOIN — et ne pas mordre sur le JETON du lexeur');

if (echecs.length) {
  console.error(`[ancien nom sorti] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[ancien nom sorti] ${passe} PASS / 0 FAIL — ${lus} fichier(s) balayés`);
