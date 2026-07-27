#!/usr/bin/env node
/**
 * GARDE — les exemples de mes SPECS compilent-ils encore ?
 *
 * ⚠️ LA FAUTE QU'ELLE FERME, payée SIX FOIS le 2026-07-27 sous six habits différents :
 * **on répare l'endroit où le défaut s'est MONTRÉ, pas l'espace où il peut vivre.**
 *   · une garde qui teste la forme du ticket, pas la construction — 5 fois ;
 *   · un balayage dont la portée laisse survivre ce qui est dehors ;
 *   · et pour finir : j'ai corrigé LA SECTION d'une spec, pas LE DOCUMENT. Une heure après avoir
 *     réécrit un bloc d'exemples, trois autres exemples de la même directive mentaient encore,
 *     plus bas dans le même fichier.
 *
 * LA MÉCANISATION, plutôt que s'en souvenir : la doc **ne rougit jamais** — un exemple faux ne fait
 * rien du tout, il attend qu'un lecteur le recopie. Ce garde EXTRAIT les exemples de directive des
 * trois specs et les **COMPILE**. Ce n'est plus une relecture, c'est une mesure : c'est la méthode
 * qui a trouvé les trois mensonges, alors que la relecture n'avait rien trouvé de la journée.
 *
 * CE QU'IL COUVRE — la moitié MESURABLE, et il faut le dire : les DIRECTIVES, qui sont compilables.
 * La prose qui les entoure ne l'est pas, et personne ne peut la mesurer automatiquement. Fermer la
 * moitié mesurable en le disant vaut mieux que laisser croire le document garanti.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const ICI = path.dirname(new URL(import.meta.url).pathname);
const SPECS = ['LANGUAGE.md', 'EBNF.md', 'AST.md'].map((f) => path.join(ICI, '..', 'docs', 'spec', f));

// ─── 1. SOCLE — refuser de conclure sur du vide ──────────────────────────────────────────────
const manquants = SPECS.filter((p) => !existsSync(p)).map((p) => path.basename(p));
ok(manquants.length === 0, `1. spec(s) introuvable(s) : ${manquants.join(', ')} — rien à mesurer`);

// ─── 2. CHAQUE DIRECTIVE ÉCRITE EN EXEMPLE DOIT COMPILER ─────────────────────────────────────
// Les directives dont la FORME a bougé sont celles qui mentent le plus vite. On les prend toutes,
// pas celles du dernier chantier : c'est précisément l'erreur que ce garde existe pour fermer.
const DIRECTIVES = ['macro', 'map', 'in', 'var', 'label', 'expose', 'meter', 'duration'];
const RE = new RegExp(`^(@(?:${DIRECTIVES.join('|')})\\s[^\\n]*)$`, 'gm');
// Un refus de RÉSOLUTION (l'entrée n'existe pas dans une librairie, le nom ne désigne rien) n'est
// PAS une faute de forme : un exemple de doc nomme des choses qui ne vivent pas dans la scène
// minimale qu'on lui fabrique. On ne garde que ce qui est refusé pour sa FORME.
const REFUS_DE_RESOLUTION = /ne désigne rien|n'existe pas|introuvable|non déclaré|jamais posé/;

let exemples = 0;
for (const p of SPECS) {
  if (!existsSync(p)) continue;
  const nom = path.basename(p);
  for (const m of readFileSync(p, 'utf8').matchAll(RE)) {
    const ligne = m[1].replace(/\s*\/\/.*/, '').trim();
    exemples++;
    let r;
    try { r = compileToBPxAST(`@core\n@controls\n@alphabet.western:midi\n${ligne}\n@mode:ord\nS -> C4\n`); }
    catch (e) { r = { errors: [{ message: e.message }] }; }
    const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
    ok(msg === '' || REFUS_DE_RESOLUTION.test(msg),
       `2. ${nom} enseigne une forme que le compilateur REFUSE : '${ligne.slice(0, 60)}' → `
       + `${msg.slice(0, 110)}. Une spec qui enseigne une forme morte ne rougit jamais — elle attend `
       + `qu'un lecteur la recopie.`);
  }
}

ok(exemples >= 8,
   `2. il faut des exemples à mesurer — ${exemples} trouvé(s). Si ce compte s'effondre, ce n'est `
   + `pas que la doc est devenue parfaite : c'est que le garde ne la lit plus.`);

// ─── 3. LES FORMES SUPPRIMÉES NE DOIVENT PLUS ÊTRE ENSEIGNÉES ────────────────────────────────
// ⚠️ Un exemple supprimé d'UNE section survit dans les autres — payé le 2026-07-27, une heure après
// la correction du bloc principal. On cherche donc dans TOUT le fichier, pas dans la section qu'on
// vient de toucher.
const MORTES = [
  [/@macro\s+[A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\))?\s*=/, "la macro avec le signe '=' (supprimé le 2026-07-27)"],
  [/@alias\s+[A-Za-z_]/, "'@alias' (absorbé par '@map' le 2026-07-27)"],
  [/@map\s+[^\n]*(->|<->|<-)/, "la liaison à la flèche (la flèche est redevenue une production)"],
];
for (const p of SPECS) {
  if (!existsSync(p)) continue;
  const nom = path.basename(p);
  // Les lignes qui PARLENT de la disparition sont légitimes — elles la nomment pour l'expliquer.
  const lignes = readFileSync(p, 'utf8').split('\n')
    .filter((l) => !/DISPARU|SUPPRIM|disparait|disparaît|absorbé|absorbe|2026-07-27/.test(l));
  for (const [motif, quoi] of MORTES) {
    const fautives = lignes.filter((l) => motif.test(l));
    ok(fautives.length === 0,
       `3. ${nom} enseigne encore ${quoi} — ${fautives.length} ligne(s), dont : `
       + `'${(fautives[0] || '').trim().slice(0, 70)}'`);
  }
}

if (echecs.length) {
  console.error(`❌ exemples de la spec : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ les exemples de la spec compilent — ${passe} vérification(s) passée(s) sur `
            + `${exemples} exemple(s) de directive dans ${SPECS.length} spec(s)`);
}
