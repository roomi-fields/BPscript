#!/usr/bin/env node
/**
 * GARDE — L'ANCRAGE DE REGISTRE VIT SUR L'ALPHABET, JAMAIS SUR L'ACCORDAGE.
 *
 * Décision Romain 2026-08-20 : le registre est une propriété de l'alphabet ; le porteur global garde
 * l'accordage et le transport.
 *
 * ⛔ CE QU'IL TIENT, ET LE DÉFAUT ÉTAIT VIVANT QUAND IL A ÉTÉ ÉCRIT. `western_just_c` portait encore
 * `baseRegister:"4"` — SEUL des dix-neuf accordages. Un reste de migration, et le pire des restes :
 * pas une erreur, une INCOHÉRENCE SILENCIEUSE. Un consommateur qui lit `tuning.baseRegister` avec un
 * repli pour l'absence voyait son repli se déclencher sur dix-huit accordages et PAS sur le
 * dix-neuvième — même code, deux comportements, aucun cri. C'est runtime-MIDI qui portait ce repli.
 *
 * ⚠️ ET CE COMPTE A ÉTÉ FAUX ICI PENDANT UNE HEURE : j'avais écrit vingt-et-un, qui est le nombre de
 * CLÉS de `tunings` — `resolvedBy` et `resolves` en font partie et ne sont pas des accordages. Même
 * piège que 187 contre 185 sur les gammes le matin même, et bp3-frontend l'a payé trois fois dans la
 * soirée. Un compte de clés n'est pas un compte d'entrées, et rien ne les distingue à l'œil.
 *
 * ⚠️ ET SON RETRAIT ÉTAIT NEUTRE POUR UNE RAISON QU'IL FAUT DIRE : les deux valeurs coïncidaient —
 * `alphabet.western` porte `"4"` lui aussi. Ce n'était pas un champ MORT, c'était un champ REDONDANT.
 * Mesuré sur le résolveur de Kairos, cas fabriqué : alphabet `"5"` et accordage retiré donnent
 * C4 = 130.815 au lieu de 261.63 — UNE OCTAVE. Le mécanisme est vivant ; c'est la coïncidence des
 * valeurs qui rendait le geste sans effet, pas l'inutilité du champ.
 *
 * ⛔ LE VOLET B EST LE COMPLÉMENT : la règle dit où le registre VIT, pas seulement où il ne vit pas.
 * Un garde qui n'interdit que l'accordage resterait vert le jour où les alphabets le perdraient tous.
 */
import { LIBS } from '../src/transpiler/libs-data.js';

let p = 0;
const e = [];
const ok = (cond, quoi) => { if (cond) p++; else e.push(quoi); };

const entrees = (lib) => Object.entries(lib || {})
  .filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object' && !Array.isArray(v));

// ── A. AUCUN ACCORDAGE NE PORTE L'ANCRAGE ────────────────────────────────────────────────────────
{
  const accordages = entrees(LIBS.tunings);
  ok(accordages.length > 0, "A. la donnée doit porter des accordages — sans eux le garde examine zéro");
  const fautifs = accordages.filter(([, v]) => v.baseRegister !== undefined).map(([k]) => k);
  ok(fautifs.length === 0,
    `A. ⛔ ${fautifs.length} accordage(s) portent un ancrage de registre : ${fautifs.join(', ')} — `
    + `le registre est une propriété de l'ALPHABET, et un champ que seuls quelques-uns portent fait `
    + `répondre deux fois différemment au même code, sans que rien ne crie`);
}

// ── B. ⛔ ET LES ALPHABETS LE PORTENT — sinon la règle serait tenue par le vide ───────────────────
{
  const alphabets = entrees(LIBS.alphabets);
  ok(alphabets.length > 0, "B. la donnée doit porter des alphabets");
  const avec = alphabets.filter(([, v]) => v.baseRegister !== undefined);
  ok(avec.length > 0,
    "B. au moins un alphabet doit porter l'ancrage — un garde qui n'interdit que l'accordage resterait "
    + "vert le jour où plus personne ne le porterait, et la règle serait tenue par une absence");
  // La NATURE, parce qu'un changement de nature passe tous les gardes de valeur (bp3-frontend, 2026-08-20).
  const nonChaines = avec.filter(([, v]) => typeof v.baseRegister !== 'string').map(([k]) => k);
  ok(nonChaines.length === 0,
    `B. l'ancrage est le NOM d'un registre, donc une CHAÎNE : ${nonChaines.join(', ')} ne l'est/le sont pas. `
    + `Le champ est passé du nombre au nom le 41e85b4 ; un lecteur arithmétique coerce une chaîne sans `
    + `broncher et sort d'une octave en silence`);
}

// ── C. ⛔ TÉMOIN — chaque nom d'ancrage désigne un rang RÉEL de sa convention ─────────────────────
// La chaîne vide EST un nom de rang légitime : rang 2 chez `arrows`, rang 0 chez `turkish`. Elle ne
// ressemble à rien de suspect, et c'est ce qui la rend la valeur la plus dangereuse du catalogue.
{
  const conventions = LIBS.octaves || {};
  let verifies = 0;
  const orphelins = [];
  for (const [nom, a] of entrees(LIBS.alphabets)) {
    if (a.baseRegister === undefined) continue;
    const conv = conventions[a.octaves];
    if (!conv || !Array.isArray(conv.registers)) continue;
    verifies++;
    if (!conv.registers.includes(a.baseRegister)) orphelins.push(`${nom} → ${JSON.stringify(a.baseRegister)} absent de ${a.octaves}`);
  }
  ok(verifies > 0, "C. le garde doit avoir vérifié au moins un ancrage contre sa convention");
  ok(orphelins.length === 0,
    `C. ${orphelins.length} ancrage(s) ne désignent aucun rang de leur convention : ${orphelins.join(' · ')}`);
}

const ATTENDU = 2 + 3 + 2;
ok(p + e.length === ATTENDU, `le garde doit éprouver ${ATTENDU} cas — ${p + e.length} seulement`);

if (e.length) { console.error(`[registre] ${e.length} ÉCHEC(S) :`); for (const x of e) console.error('  ✗ ' + x); process.exit(1); }
console.log(`[registre] ${p} PASS / 0 FAIL — ${p} assertion(s)`);
