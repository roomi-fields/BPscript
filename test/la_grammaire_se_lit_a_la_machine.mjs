#!/usr/bin/env node
// LA GRAMMAIRE SE LIT À LA MACHINE — première pierre du chantier « dériver le parseur de l'EBNF ».
//
// POURQUOI CELUI-CI D'ABORD (Romain, 2026-08-06 : « je veux que tu fasses le 3 »).
// Dériver le tokenizer et le parseur de `docs/spec/EBNF.md` suppose une chose avant toutes les
// autres : que ce document soit LISIBLE PAR UNE MACHINE. Aujourd'hui il ne l'est par personne —
// il est cité dans une trentaine de commentaires du code, ses exemples sont compilés par un autre
// garde, mais sa GRAMMAIRE n'est confrontée à rien. Un document qu'aucune machine ne lit dérive
// sans bruit : c'est le même mode d'échec que la doc qui ment, appliqué au futur générateur.
//
// CE QU'IL VÉRIFIE — trois propriétés, toutes internes au document, aucune n'exige que le parseur
// change quoi que ce soit aujourd'hui :
//   1. TOUT bloc `ebnf` se lit : chaque production a un nom, un `=` et un `;`.
//   2. AUCUN symbole n'est ORPHELIN : tout non-terminal référencé est défini quelque part.
//   3. AUCUNE production n'est INACCESSIBLE depuis l'axiome `scene` — une règle que rien
//      n'atteint ne décrit plus le langage, elle en décrit un souvenir.
//
// CE QU'IL NE VÉRIFIE PAS, ET IL FAUT LE DIRE : que la grammaire décrive le MÊME langage que le
// parseur. C'est l'étage suivant du chantier (engendrer des phrases depuis la grammaire et les
// passer au compilateur). Ce garde-ci ne prouve que la cohérence INTERNE du document — nécessaire,
// très loin d'être suffisante.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const EBNF = path.join(ICI, '..', 'docs', 'spec', 'EBNF.md');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ────────────────────────────────────────────────────────────────────────────
// 1. Extraire les blocs `ebnf` et les découper en productions
// ────────────────────────────────────────────────────────────────────────────
// Notation ISO 14977 telle que le document l'annonce en tête : `=` définit, `;` termine,
// `(* … *)` commente. On retire les commentaires AVANT de découper : ils contiennent des `;`
// et des `=` d'exemple qui casseraient le découpage.
function productions(texte) {
  const blocs = [];
  let dans = false, courant = [];
  for (const l of texte.split('\n')) {
    const cloture = /^```/.test(l);
    if (cloture) {
      if (dans) { blocs.push(courant.join('\n')); courant = []; dans = false; }
      else if (/^```ebnf\s*$/.test(l)) dans = true;
      continue;
    }
    if (dans) courant.push(l);
  }
  const prods = [];
  for (const b of blocs) {
    const sansCom = b.replace(/\(\*[\s\S]*?\*\)/g, ' ');
    for (const brut of sansCom.split(';')) {
      const p = brut.trim();
      if (p === '') continue;
      const m = p.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]*)$/);
      prods.push(m ? { nom: m[1], corps: m[2], brut: p } : { nom: null, brut: p });
    }
  }
  return { blocs: blocs.length, prods };
}

const { blocs, prods } = productions(readFileSync(EBNF, 'utf-8'));

// SOCLE — un extracteur cassé rendrait zéro production et passerait au vert sans rien mesurer.
ok(blocs >= 20, `SOCLE : ${blocs} bloc(s) ebnf trouvé(s) — l'extracteur ne lit plus le document`);
ok(prods.length >= 80, `SOCLE : ${prods.length} production(s) découpée(s) — le découpage ne mord plus`);

// ────────────────────────────────────────────────────────────────────────────
// 2. Toute production se lit
// ────────────────────────────────────────────────────────────────────────────
const illisibles = prods.filter((p) => p.nom === null);
ok(illisibles.length === 0,
   `1. ${illisibles.length} fragment(s) ne se lisent pas comme une production « nom = … ; » :\n     `
   + illisibles.slice(0, 6).map((p) => p.brut.replace(/\s+/g, ' ').slice(0, 90)).join('\n     '));

const definis = new Map();
for (const p of prods) if (p.nom) definis.set(p.nom, (definis.get(p.nom) ?? 0) + 1);
const doubles = [...definis].filter(([, n]) => n > 1).map(([nom]) => nom);
ok(doubles.length === 0,
   `1bis. ${doubles.length} symbole(s) DÉFINIS PLUSIEURS FOIS — la seconde définition écrase la `
   + `première pour un générateur : ${doubles.join(', ')}`);

// ────────────────────────────────────────────────────────────────────────────
// 3. Aucun symbole orphelin
// ────────────────────────────────────────────────────────────────────────────
// Les références sont les identifiants du corps qui ne sont pas des littéraux (`"..."`).
function references(corps) {
  return new Set([...corps.replace(/"[^"]*"/g, ' ').matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)]
    .map((m) => m[1]));
}
// TERMINAUX LEXICAUX — définis par le tokenizer, pas par la grammaire. Registre NOMMÉ, jamais une
// liste noire de commodité : chacun doit être RÉFÉRENCÉ quelque part, sinon le témoin le signale.
// Resserré à la première exécution : j'en avais déclaré huit par anticipation, le témoin
// ci-dessous a montré que quatre n'abritaient rien. Une porte ouverte pour personne s'enlève.
const LEXICAUX = new Set(['IDENT', 'INT', 'FLOAT', 'NEWLINE']);
const lexicalUtilise = new Set();

const orphelins = new Map();
for (const p of prods) {
  if (!p.nom) continue;
  for (const r of references(p.corps)) {
    if (LEXICAUX.has(r)) { lexicalUtilise.add(r); continue; }
    if (definis.has(r)) continue;
    if (!orphelins.has(r)) orphelins.set(r, []);
    orphelins.get(r).push(p.nom);
  }
}
ok(orphelins.size === 0,
   `2. ${orphelins.size} symbole(s) RÉFÉRENCÉS et jamais DÉFINIS — un générateur ne saurait pas `
   + `quoi en faire :\n     `
   + [...orphelins].slice(0, 12).map(([r, ou]) => `${r} (cité par ${ou.slice(0, 3).join(', ')})`).join('\n     '));

for (const l of LEXICAUX) {
  ok(lexicalUtilise.has(l),
     `2bis. le terminal lexical '${l}' est déclaré au registre de ce garde mais RÉFÉRENCÉ NULLE `
     + `PART dans la grammaire — une dérogation sans bénéficiaire s'enlève.`);
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Aucune production inaccessible depuis l'axiome
// ────────────────────────────────────────────────────────────────────────────
const AXIOME = 'scene';
ok(definis.has(AXIOME), `3. l'axiome '${AXIOME}' doit être défini — sinon rien n'est atteignable`);
const corpsDe = new Map(prods.filter((p) => p.nom).map((p) => [p.nom, p.corps]));
const atteints = new Set();
const descendre = (nom) => {
  if (atteints.has(nom) || !corpsDe.has(nom)) return;
  atteints.add(nom);
  for (const r of references(corpsDe.get(nom))) descendre(r);
};
descendre(AXIOME);
// REGISTRE DES INACCESSIBLES CONNUS — nommé, daté, motivé, avec témoin dans les deux sens.
// Une production inaccessible est une DETTE mesurée, pas une tolérance : elle sort du registre le
// jour où la grammaire la raccroche.
const INACCESSIBLES_CONNUS = new Map([
  ['STRING', "mesuré le 2026-08-06, et la mesure RENVERSE ce que les documents laissent croire. "
    + "Le lexème existe (tokenizer.js:214) mais rien ne le référence, parce que `library_invocation` "
    + "(EBNF.md:132) ne prévoit pas d'argument et que LANGUAGE.md:545 écrit `@library.strudel` NU. "
    + "⚠️ OR LA FORME NUE N'EST ÉCRITE PAR PERSONNE : zéro occurrence sur tout l'écosystème. Les SIX "
    + "sites du corpus portent tous un argument (`@library.strudel \"dirt-samples\"`), et cet "
    + "argument a un CONSOMMATEUR MESURÉ — Kanopi collecte les banques d'échantillons d'une scène "
    + "pour les précharger (`preload-on-open.svelte.ts`), et son test de non-régression enregistre "
    + "le bug quand la déclaration manque : « banque inconnue → son MUET ». "
    + "Donc ce n'est pas l'argument qui est de trop, c'est la forme NUE : la doc décrit une écriture "
    + "que nul n'emploie et tait celle qui fait sonner. Correction à faire dans la BIBLE d'abord "
    + "(Romain, 2026-08-06 : « je ne vois pas le sens de cette déclaration ») — la grammaire suivra."],
]);
const inaccessiblesTous = [...definis.keys()].filter((n) => !atteints.has(n));
const inaccessibles = inaccessiblesTous.filter((n) => !INACCESSIBLES_CONNUS.has(n));
// TÉMOIN — une entrée du registre qui n'abrite plus rien s'enlève, sinon le registre grossit seul.
for (const [nom] of INACCESSIBLES_CONNUS) {
  ok(inaccessiblesTous.includes(nom),
     `3bis. '${nom}' est au registre des inaccessibles mais la grammaire l'atteint désormais — `
     + `RETIRE-le : un registre qui ne se resserre jamais n'est qu'un compteur.`);
}
ok(inaccessibles.length === 0,
   `3. ${inaccessibles.length} production(s) INACCESSIBLE(S) depuis '${AXIOME}' — elles ne `
   + `décrivent plus le langage :\n     ` + inaccessibles.join(', '));

// ────────────────────────────────────────────────────────────────────────────
if (echecs.length) {
  console.error(`❌ la grammaire ne se lit pas encore à la machine : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ la grammaire se lit à la machine — ${passe} vérification(s) : ${blocs} bloc(s), `
          + `${definis.size} production(s), 0 orphelin, `
          + `${inaccessiblesTous.length} inaccessible(s) depuis '${AXIOME}' (toutes au registre daté).`);
