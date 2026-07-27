#!/usr/bin/env node
/**
 * GARDE — mes DOCUMENTS enseignent-ils encore des formes vivantes ?
 *
 * ⚠️ LA FAUTE QU'ELLE FERME, payée SIX FOIS le 2026-07-27 sous six habits différents :
 * **on répare l'endroit où le défaut s'est MONTRÉ, pas l'espace où il peut vivre.**
 *   · une garde qui teste la forme du ticket, pas la construction — 5 fois ;
 *   · un balayage dont la portée laisse survivre ce qui est dehors ;
 *   · et pour finir : j'ai corrigé LA SECTION d'une spec, pas LE DOCUMENT. Une heure après avoir
 *     réécrit un bloc d'exemples, trois autres exemples de la même directive mentaient encore,
 *     plus bas dans le même fichier.
 *
 * ⚠️ ET LE GARDE LUI-MÊME L'A REPAYÉE, le lendemain — c'est la raison de sa version actuelle. Sa
 * portée était **trois fichiers de `docs/spec/`**, parce que c'est là que le mensonge s'était
 * montré. `docs/design/SCENES.md` enseignait la flèche morte DOUZE fois et `docs/reference/` une,
 * hors portée donc invisibles : ils n'auraient jamais rougi. Le garde balaye désormais **TOUT
 * `docs/`** — l'espace où une forme morte peut vivre, pas l'endroit où elle s'est montrée. La
 * leçon générale est inscrite dans CLAUDE.md : quand on ferme une famille, écrire la portée ET son
 * complément, sinon la campagne suivante retrouve les mêmes survivants.
 *
 * LA MÉCANISATION, plutôt que s'en souvenir : la doc **ne rougit jamais** — un exemple faux ne fait
 * rien du tout, il attend qu'un lecteur le recopie. Ce garde EXTRAIT les exemples de directive et
 * les **COMPILE**. Ce n'est plus une relecture, c'est une mesure : c'est la méthode qui a trouvé
 * tous les mensonges du 2026-07-27, alors que la relecture n'en avait trouvé aucun.
 *
 * CE QU'IL COUVRE — la moitié MESURABLE, et il faut le dire : les DIRECTIVES, qui sont compilables.
 * La prose qui les entoure ne l'est pas, et personne ne peut la mesurer automatiquement. Fermer la
 * moitié mesurable en le disant vaut mieux que laisser croire le document garanti.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const ICI = path.dirname(new URL(import.meta.url).pathname);
const DOCS = path.join(ICI, '..', 'docs');

/**
 * LA PORTÉE, ET SON COMPLÉMENT ÉCRIT — pas un tri de convenance.
 * Balayé : tout `docs/`, récursivement. Écarté, avec sa raison, et une seule :
 *   · `decisions-en-attente/archive/` — un ARCHIVE est un compte rendu daté de ce qui a été
 *     pensé à un moment. Le réécrire falsifierait l'histoire ; une forme morte y est à sa place,
 *     c'est même ce qu'on y cherche. La règle est « ne pas réécrire un compte rendu », pas
 *     « exclure ce qui gêne » — d'où le témoin §4 qui vérifie que l'écart reste étroit.
 */
const ARCHIVES = /(^|\/)(archive|archives)(\/|$)/;
const listerDocs = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) { if (!ARCHIVES.test(p)) listerDocs(p, out); }
    else if (e.endsWith('.md')) out.push(p);
  }
  return out;
};
const TOUS = listerDocs(DOCS);
const relatif = (p) => path.relative(DOCS, p);
// Les exemples COMPILÉS restent ciblés sur les specs : ailleurs, une directive apparaît souvent
// dans une phrase de prose et non comme une ligne à compiler. Le §3 (formes mortes), lui, balaye
// TOUT — c'est lui qui a laissé passer les douze.
const SPECS = ['LANGUAGE.md', 'EBNF.md', 'AST.md'].map((f) => path.join(DOCS, 'spec', f));

// ─── 1. SOCLE — refuser de conclure sur du vide ──────────────────────────────────────────────
const manquants = SPECS.filter((p) => !existsSync(p)).map((p) => path.basename(p));
ok(manquants.length === 0, `1. spec(s) introuvable(s) : ${manquants.join(', ')} — rien à mesurer`);
ok(TOUS.length >= 25,
   `1. le balayage doit voir TOUT docs/ — ${TOUS.length} document(s) trouvé(s). Un compte qui `
   + `s'effondre ne veut pas dire que la doc a maigri : il veut dire que le garde ne la lit plus.`);

// ─── 2. CHAQUE DIRECTIVE ÉCRITE EN EXEMPLE DOIT COMPILER ─────────────────────────────────────
// Les directives dont la FORME a bougé sont celles qui mentent le plus vite. On les prend toutes,
// pas celles du dernier chantier : c'est précisément l'erreur que ce garde existe pour fermer.
const DIRECTIVES = ['macro', 'alias', 'in', 'var', 'label', 'expose', 'meter', 'duration'];
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

// ─── 3. AUCUNE FORME VOUÉE AU RETRAIT NE GARDE UN APPELANT VIVANT ────────────────────────────
// Exigence du lot [1040] : « un garde qui ÉCHOUE si une forme vouée au retrait garde un appelant
// vivant ». Un appelant, ce n'est pas seulement du code — un DOCUMENT qui enseigne la forme en est
// un, et le pire : il ne casse rien, il attend qu'un lecteur recopie.
//
// ⚠️ Et le balayage est un PRODUIT CROISÉ, FORMES × DOCUMENTS. Ajouter une pierre tombale la
// cherche automatiquement dans tous les documents ; ajouter un document le soumet automatiquement
// à toutes les pierres. Rien à penser au bon moment — c'est exactement ce qui a manqué le
// 2026-07-27, où la liste des formes était complète mais la liste des fichiers ne l'était pas.
//
// ⚠️ ET UNE FORME EST ABSOLUE : la flèche employée comme câblage ne se cite PAS, même pour
// expliquer sa disparition. Règle de l'architecte sur dictée de Romain, 2026-07-27 : « une graphie
// fautive citée en exemple finit recopiée », et « la flèche est une grammaire de RÈGLE, ça ne l'a
// JAMAIS été et ça ne le sera JAMAIS » — donc l'ancienne ligne n'est pas un état de référence
// qu'on citerait au passé, c'est une faute d'écriture. Nommer la fonction en français, jamais par
// sa graphie. Les autres formes gardent leur exemption : nommer `@alias` ou `=` dans une phrase,
// c'est nommer la directive, pas exhiber une ligne recopiable.
//
// ⚠️ CETTE LISTE A CHANGÉ DE SENS le 2026-07-27 au soir, et il faut le dire : `@alias` en est SORTI
// (il est revenu au langage) et `@map` y est ENTRÉ (il est abandonné). Ce n'est pas une hésitation
// de ma part — c'est un arbitrage de Romain sur un argument absent de tous les inventaires : une
// directive ne se débranche pas, `!>>` si. La liste est le REGISTRE de l'état courant, pas une
// mémoire des mouvements ; ce qui est mort y figure, ce qui vit n'y figure pas.
const MORTES = [
  [/@macro\s+[A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\))?\s*=/, "la macro avec le signe '=' (supprimé le 2026-07-27)", 'exemptable'],
  [/@alias\s+[A-Za-z_][A-Za-z0-9_]*\s*=/, "l'alias avec le signe '=' (supprimé de TOUT le langage le 2026-07-27)", 'exemptable'],
  [/@map\s+[A-Za-z_<[]/, "'@map' — ABANDONNÉ le 2026-07-27 au soir : le câblage passe par '>>' et "
   + "'!>>', qui savent aussi débrancher pendant que ça joue ; pour désigner, '@alias'", 'exemptable'],
  [/@(?:map|alias)\s+[^\n|]*(->|<->|<-)/,
   "la flèche employée comme CÂBLAGE — elle ne se cite jamais, même au passé pour expliquer sa "
   + "disparition : nommer la fonction en français ('un contrôleur règle le tempo pendant que ça "
   + "joue'), jamais par sa graphie", 'absolue'],
];
// Les lignes qui PARLENT de la disparition sont légitimes pour les formes 'exemptable' — elles
// nomment la directive pour l'expliquer. Elles ne le sont PAS pour la forme 'absolue'.
const PARLE_DE_SA_MORT = /DISPARU|DISPARA|SUPPRIM|disparait|disparaît|disparu|absorbé|absorbe|morte|retiré|ancien|2026-07-27/;
let croisements = 0;
for (const p of TOUS) {
  const nom = relatif(p);
  const toutes = readFileSync(p, 'utf8').split('\n');
  const sansExplication = toutes.filter((l) => !PARLE_DE_SA_MORT.test(l));
  for (const [motif, quoi, rigueur] of MORTES) {
    croisements++;
    const fautives = (rigueur === 'absolue' ? toutes : sansExplication).filter((l) => motif.test(l));
    ok(fautives.length === 0,
       `3. ${nom} ${rigueur === 'absolue' ? 'CITE' : 'enseigne'} encore ${quoi} — ${fautives.length} `
       + `ligne(s), dont : '${(fautives[0] || '').trim().slice(0, 70)}'`);
  }
}
ok(croisements === TOUS.length * MORTES.length && croisements >= 100,
   `3. le produit croisé doit être PLEIN — ${croisements} croisement(s) pour ${TOUS.length} `
   + `document(s) × ${MORTES.length} forme(s) morte(s)`);

// ─── 4. TÉMOIN — l'écart de portée reste étroit, et il se justifie ───────────────────────────
// Une exclusion est une porte : elle doit rester de la taille de sa raison. Le jour où la moitié
// de `docs/` passerait par une exclusion, le garde serait vert et ne garderait plus rien.
{
  const totalMd = (function compter(dir, n = 0) {
    for (const e of readdirSync(dir)) {
      const q = path.join(dir, e);
      if (statSync(q).isDirectory()) n = compter(q, n);
      else if (e.endsWith('.md')) n++;
    }
    return n;
  })(DOCS);
  const ecartes = totalMd - TOUS.length;
  ok(ecartes <= 3,
     `4. trop de documents écartés du balayage — ${ecartes} sur ${totalMd}. La seule raison admise `
     + `est « c'est un compte rendu archivé, le réécrire falsifierait l'histoire ». Si l'écart `
     + `grandit, c'est qu'on écarte pour ne pas corriger.`);
}

if (echecs.length) {
  console.error(`❌ documents du langage : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ les documents enseignent des formes vivantes — ${passe} vérification(s) passée(s) : `
            + `${exemples} exemple(s) compilé(s) dans ${SPECS.length} spec(s), et ${croisements} `
            + `croisement(s) ${TOUS.length} document(s) × ${MORTES.length} forme(s) morte(s)`);
}
