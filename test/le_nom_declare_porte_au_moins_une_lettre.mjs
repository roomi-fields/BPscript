#!/usr/bin/env node
/**
 * GARDE — UN NOM DÉCLARÉ PORTE AU MOINS UNE LETTRE, ET LA RÈGLE FORMELLE LE DIT.
 *
 * Décision de Romain, relayée le 2026-09-04 : « un nom peut commencer par un chiffre s'il porte une
 * lettre, ça n'est jamais un chiffre pur, avec le cas `12EDO` ».
 *
 * ⛔ CE QUI L'A RENDU NÉCESSAIRE : `EBNF.md:749` écrivait `NOM_DECLARE = IDENT | ( digit+ ,
 * { letter | digit } )`, qui admet `12` — un chiffre pur — quand la prose de la même page (l. 758) et
 * le compilateur le refusent tous les deux. La règle FORMELLE était la seule des trois à être fausse,
 * et une règle formelle qui admet ce que la définition refuse fabrique une SECONDE AUTORITÉ.
 *
 * ⚠️ ET ELLE ÉTAIT AUSSI TROP ÉTROITE, dans le même mouvement : `{ letter | digit }` refuse
 * `12a_b`, `12a-b` et `12a#` que le compilateur ACCEPTE. Une seule ligne fausse dans les deux sens —
 * c'est ce qu'on obtient en réécrivant à la main ce qui se dérive.
 *
 * ⇒ La règle juste est `digit+ , IDENT` : IDENT commence toujours par une lettre, donc la lettre est
 *   exigée immédiatement après les chiffres, et tout ce qu'un nom porte ensuite est porté ici aussi.
 *
 * Ce garde tient les DEUX surfaces : la matrice de ce que le compilateur fait, et la graphie de la
 * règle écrite. Sans la seconde, la prose peut redevenir fausse sans que rien rougisse.
 */
import { readFileSync } from 'node:fs';
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const declare = (nom) => {
  const r = compileToBPxAST(`core\nalphabet.simple\ndef ${nom}(vel:100)\n-----\nS -> a\n`, { librairie: true });
  return (r.errors || []).length === 0;
};

// ── 1. CE QUI EST UN NOM — la lettre suit les chiffres, et le reste du nom vit après ──────────────
for (const nom of ['12a', '1a2', '12TET', '22shruti', '12EDO', '12a_b', '12a-b', '12a#', "12a'", 'a12']) {
  ok(declare(nom), `1. « ${nom} » porte une lettre : il DOIT être un nom déclaré`);
}

// ── 2. LE COMPLÉMENT — ce qui n'en est pas ───────────────────────────────────────────────────────
// Un chiffre pur, et tout signe glissé entre les chiffres et la lettre : la lettre suit les chiffres
// IMMÉDIATEMENT, sans quoi `digit+ , IDENT` ne se lit pas.
for (const nom of ['12', '12_a', "12'a", '12-a', '12#a', '1_2a']) {
  ok(!declare(nom), `2. « ${nom} » ne porte pas de lettre après ses chiffres : il DOIT être refusé`);
}

// ── 3. LA RÈGLE FORMELLE DIT LA MÊME CHOSE ───────────────────────────────────────────────────────
{
  const ebnf = readFileSync(new URL('../docs/spec/EBNF.md', import.meta.url), 'utf8');
  const ligne = ebnf.split('\n').find((l) => l.startsWith('NOM_DECLARE'));
  ok(typeof ligne === 'string', '3. SOCLE : aucune règle NOM_DECLARE dans EBNF.md — elle a changé de nom ou disparu');
  if (ligne) {
    ok(/digit\+\s*,\s*IDENT/.test(ligne),
      `3. ⛔ la règle formelle n'exige plus une lettre après les chiffres — reçu ${JSON.stringify(ligne)}`);
    ok(!/digit\+\s*,\s*\{/.test(ligne),
      `3. ⛔ la règle formelle admet un chiffre pur (« digit+ , { … } »), que la prose et le compilateur refusent — reçu ${JSON.stringify(ligne)}`);
  }
}

const ATTENDU = 10 + 6 + 3;
ok(passe + echecs.length === ATTENDU,
  `SOCLE : le garde doit éprouver ${ATTENDU} cas — ${passe + echecs.length} seulement`);

if (echecs.length) {
  console.error(`[nom déclaré] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[nom déclaré] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
