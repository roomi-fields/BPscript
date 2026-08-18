#!/usr/bin/env node
/**
 * UNE LIBRAIRIE DÉCLARE, EN DONNÉE, LE MOT SOUS LEQUEL ON L'INVOQUE.
 *
 * Le champ est `resolves` — « l'axe que cette librairie résout, le QUOI là où `resolvedBy` dit le
 * QUI ». La table qui relie un mot à ses fichiers en est DÉRIVÉE, reconstruite à chaque appel.
 *
 * ⛔ ELLE ÉTAIT ÉCRITE EN DUR, ET QUATRE LIGNES DÉCIDAIENT DE TOUT : `alphabet`, `tuning`, `scale`,
 * `sound`. `temperament`, `voice` et `octaves` n'existaient pas comme mots d'invocation pour une
 * seule raison — personne n'avait écrit leur ligne. Ce n'était pas un catalogue, c'était un oubli à
 * quatre entrées, et il portait le nom de « catalogue » dans les échanges.
 *
 * ⚠️ LE MOT N'A AUCUNE RÈGLE DE NOMBRE. `octaves` et `settings` s'invoquent au PLURIEL, `alphabet`
 * et `tuning` au singulier ; imposer un nombre grammatical aurait cassé six invocations du corpus
 * pour une question de forme. La donnée porte le mot, elle ne le décline pas.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const messages = (r) => (r.errors || []).map((e) => e.message ?? e).join(' | ');
const METAS = ['resolvedBy', 'resolves', 'name', 'description', 'version', 'schema', 'defaults', 'symbols', 'settings', 'apporte'];
const entreesDe = (lib) => Object.keys(lib).filter((k) => !k.startsWith('_') && !METAS.includes(k)
  && lib[k] && typeof lib[k] === 'object' && !Array.isArray(lib[k]));

// ── A. CHAQUE LIBRAIRIE QUI DÉCLARE SON MOT EST INVOCABLE PAR LUI ───────────────────────────
// ⚠️ LA LISTE VIENT DE LA DONNÉE : une librairie qui déclare son mot demain est couverte le jour
// même, et une qui le retire ne laisse pas un cas fantôme.
{
  let verifies = 0;
  for (const [fichier, lib] of Object.entries(LIBS)) {
    if (!lib || typeof lib !== 'object' || !lib.resolves) continue;
    const entrees = entreesDe(lib);
    if (!entrees.length) continue;
    verifies++;
    const r = compileToBPxAST(`core\nalphabet.western\n${lib.resolves}.${entrees[0]}\n-----\nS -> C4\n`);
    ok(!/aucune librairie ne sert/.test(messages(r)),
       `A. '${fichier}' déclare 'resolves: ${lib.resolves}' : '${lib.resolves}.${entrees[0]}' doit `
       + `être servi. Reçu : ${messages(r).slice(0, 90)}`);
  }
  ok(verifies >= 9,
     `A. ${verifies} librairies à mot déclaré vérifiées — sous ce seuil le volet ne mesure plus la donnée.`);
}

// ── B. LE MOT N'A AUCUNE RÈGLE DE NOMBRE ────────────────────────────────────────────────────
// Le singulier et le pluriel coexistent, chacun déclaré par sa librairie.
{
  for (const [mot, entree] of [['alphabet', 'western'], ['tuning', 'western_12TET'],
                               ['octaves', 'western'], ['settings', 'test1']]) {
    const r = compileToBPxAST(`core\nalphabet.western\n${mot}.${entree}\n-----\nS -> C4\n`);
    ok(!/aucune librairie ne sert/.test(messages(r)),
       `B. '${mot}.${entree}' doit être servi — le mot suit la donnée, pas une règle de nombre. `
       + `Reçu : ${messages(r).slice(0, 80)}`);
  }
}

// ── C. UN MOT PEUT DÉSIGNER PLUSIEURS FICHIERS ──────────────────────────────────────────────
// `alphabets.json` et `test_alphabets.json` déclarent tous deux `alphabet`.
{
  const porteurs = Object.entries(LIBS)
    .filter(([, l]) => l && typeof l === 'object' && l.resolves === 'alphabet')
    .map(([f]) => f);
  ok(porteurs.length >= 2,
     `C. au moins deux fichiers doivent déclarer 'alphabet' — reçu ${JSON.stringify(porteurs)}. `
     + `Ce volet garde le cas « deux fichiers, un mot ».`);

  // ⚠️ ET AUCUN NOM D'ENTRÉE NE DOIT ÊTRE PORTÉ PAR LES DEUX : sans ça, le mot deviendrait ambigu
  // et la recherche trancherait par l'ordre des fichiers, c'est-à-dire par hasard.
  // ⚠️ ET LE VOLET DOIT ATTEINDRE LA TABLE, PAS SEULEMENT LA DONNÉE — trouvé par une injection
  // qui ne mordait pas. Vérifier que deux fichiers DÉCLARENT le mot ne dit rien de ce que la table
  // en fait : tronquée au premier fichier, elle passait ce volet EN VERT. Le cas qui discrimine est
  // une entrée du SECOND fichier, invoquée par le mot commun.
  const second = porteurs[1];
  const entreeDuSecond = entreesDe(LIBS[second])[0];
  const r = compileToBPxAST(`core\nalphabet.${entreeDuSecond}\n-----\nS -> C4\n`);
  ok(!/introuvable dans le catalogue|aucune librairie ne sert/.test(messages(r)),
     `C. 'alphabet.${entreeDuSecond}' vit dans '${second}', le SECOND fichier du mot : il doit être `
     + `atteint. Reçu : ${messages(r).slice(0, 90)}. Une table qui ne garde que le premier fichier `
     + `passe les volets qui lisent la donnée, et rate celui-ci.`);

  const noms = porteurs.map((f) => new Set(entreesDe(LIBS[f])));
  const collision = [...noms[0]].filter((x) => noms.slice(1).some((s) => s.has(x)));
  ok(collision.length === 0,
     `C. aucun nom d'entrée ne doit vivre dans deux fichiers du même mot — reçu ${JSON.stringify(collision)}. `
     + `Le mot deviendrait ambigu et l'ordre des fichiers déciderait à la place de l'auteur.`);
}

// ── D. LA TABLE N'EST PAS ÉCRITE DANS LE CODE ───────────────────────────────────────────────
// ⚠️ SANS CE VOLET, une table en dur qui couvrirait les quatre anciens alias passerait A et B —
// c'est exactement l'état d'avant, et il se donnait pour un catalogue.
{
  const declares = Object.values(LIBS)
    .filter((l) => l && typeof l === 'object' && l.resolves).map((l) => l.resolves);
  const uniques = new Set(declares);
  ok(uniques.size >= 10,
     `D. ${uniques.size} mots distincts déclarés par la donnée — l'ancienne table en dur n'en `
     + `portait que QUATRE. Sous ce seuil, la table a probablement été réécrite dans le code.`);
  for (const mot of ['temperament', 'voice', 'octaves', 'settings', 'eval', 'sound']) {
    ok(uniques.has(mot),
       `D. '${mot}' doit être déclaré par une librairie — il n'existait PAS dans la table en dur, et `
       + `c'est sa présence ici qui prouve que le mot vient de la donnée.`);
  }
}

// ── SOCLE ────────────────────────────────────────────────────────────────────────────────────
ok(passe >= 20, `SOCLE : ${passe} vérifications seulement — la matrice s'est vidée sans rougir.`);

if (echecs.length) {
  console.error(`❌ une librairie déclare le mot qui l'invoque : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ Le mot d'invocation vient de la DONNÉE — chaque librairie qui déclare 'resolves' est `
          + `servie par lui, singulier comme pluriel, et un mot peut désigner deux fichiers sans `
          + `qu'aucune entrée ne soit ambiguë. ${passe} vérification(s) passée(s).`);
