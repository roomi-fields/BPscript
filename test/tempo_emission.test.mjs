#!/usr/bin/env node
/**
 * ÉMISSION DES OPÉRATEURS DE TEMPO — couverture de l'angle mort.
 *
 * POURQUOI CE FICHIER. Les quatre fonctions d'émission de tempo (`encoder.js:1487-1547` :
 * `tempoOpToPair`, `tempoOpToBarePrefix`, `tempoOpToInline`, `tempoOpToBP3Enter`) n'avaient
 * AUCUN test couvrant. C'est précisément là que trois tours de diagnostic se sont perdus :
 * un facteur 64 sur `tryKeyMap`, attribué à tort au moteur, alors que la cause était une
 * transcription qui confondait DEUX SURFACES distinctes.
 *
 * ⚠️ CET EN-TÊTE A DÉCRIT `[/N]` COMME « SCOPÉ ». C'ÉTAIT FAUX — corrigé le 2026-07-19.
 *
 * Ce que les trois formes émettent RÉELLEMENT (mesuré, et conforme à `EBNF.md:576` et `:657`) :
 *   - `SYM[/N]` → `/N SYM` — l'opérateur NU de BP3. **ABSOLU et PERSISTANT** (fixtempo) :
 *     aucun marqueur de sortie n'est émis, donc rien ne restaure le tempo hérité.
 *   - `SYM[*N]` → `_tempo(1/N) SYM _tempo(1/1)` — **SCOPÉ**, et c'est LUI qui porte la paire
 *     entrer/sortir. L'exit `_tempo(1/1)` restaure l'hérité au bord du bracket.
 *   - `![/N]`   → `_tempo(N/1)` — forme instantanée, persistante elle aussi.
 *
 * L'erreur venait d'avoir attribué à `[/N]` le comportement de `[*N]`. Elle a une conséquence
 * concrète : `[/N]` émet EXACTEMENT le `/N` nu des grammaires natives, il est donc
 * byte-fidèle, là où `![/N]` émet une paire `_tempo` de même sémantique mais d'octet différent.
 * Vérifié sur la notation de Bernard : `abbabccabcca . abcccbaab[/3] . bbb[/1] [meter:3+4+2/4]`
 * rend `3+4+2/4 abbabccabcca . /3 abcccbaab . /1 bbb`, la ligne native.
 *
 * CE QUE LES TESTS VERROUILLENT VRAIMENT : que les trois formes restent DISTINCTES à
 * l'émission. Les faire converger changerait le son — ça, c'était juste, et ça reste.
 *
 * Ces tests ne vérifient pas « ça compile » — ils verrouillent le TEXTE BP3 émis, parce que
 * c'est lui qui doit rester byte-identique au natif, et la PORTÉE, parce que c'est elle qui
 * s'était perdue.
 *
 * Usage :  node test/tempo_emission.test.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compileBPS } = require('../src/transpiler/index.js');

let echecs = 0;
let passes = 0;

/** Compile et rend la partie droite de la première règle émise. */
function rhs(source) {
  const out = compileBPS(`@core\n@controls\n@alphabet.western:midi\n${source}\n`);
  if (out.errors.length) return `ERREUR: ${out.errors[0].message}`;
  const ligne = out.grammar.split('\n').find((l) => l.includes('-->')) || '';
  return ligne.replace(/^gram#\d+\[\d+\]\s*/, '').replace(/^S\s*-->\s*/, '');
}

function verifie(intitule, source, attendu) {
  const obtenu = rhs(source);
  if (obtenu === attendu) { passes++; return; }
  echecs++;
  console.error(`✗ ${intitule}`);
  console.error(`    source   : ${source}`);
  console.error(`    attendu  : ${attendu}`);
  console.error(`    obtenu   : ${obtenu}`);
}

// --- Forme CANONIQUE (bracket collé) : opérateur NU, portée scopée -----------------------
// L'opérateur se place DEVANT le symbole qu'il qualifie — piège payé : `A[/2] B` ne donne pas
// `A /2 B` mais `/2 A B`. Pour reproduire le natif `A /2 B`, il faut écrire `A B[/2]`.
verifie('suffixe /N — opérateur nu, placé devant son symbole',
  'S -> C4[/2] D4', '/2 C4 D4');
verifie('suffixe /N sur le SECOND symbole — reproduit le natif « A /2 A »',
  'S -> C4 D4[/2]', 'C4 /2 D4');
verifie('suffixe /N à opérande fractionnaire (EBNF.md:655)',
  'S -> C4 D4[/5/3]', 'C4 /5/3 D4');

// --- Forme INSTANTANÉE : paire _tempo, persistante ---------------------------------------
verifie('![/N] — émet la paire _tempo relative',
  'S -> ![/8] C4 D4', '_tempo(8/1) C4 D4');
verifie('![/N] fractionnaire',
  'S -> ![/5/3] C4', '_tempo(5/3) C4');

// --- Forme BRACKET RELATIVE `*` : enter + exit --------------------------------------------
// L'exit est TOUJOURS _tempo(1/1) — il restaure l'hérité, ce n'est PAS le réciproque.
verifie('suffixe *N — bracket relatif, entrée puis restauration',
  'S -> C4[*2] D4', '_tempo(1/2) C4 _tempo(1/1) D4');

// --- Qualifieur nommé [tempo:N] : contrôle explicite, distinct de l'opérateur nu ----------
verifie('[tempo:N] — contrôle nommé, PAS l opérateur nu',
  'S -> C4[tempo:5/3] D4', 'C4 _tempo(5/3) D4');

// --- LA DISTINCTION QUI A COÛTÉ TROIS TOURS ----------------------------------------------
// Les deux formes ci-dessous émettent des textes BP3 DIFFÉRENTS et ont des PORTÉES
// différentes. Si un jour elles convergent, c'est une régression : le natif écrit le `/N`
// espacé (persistant), et `[/N]` collé ne doit jamais s'y substituer silencieusement.
const collee = rhs('S -> C4[/8] D4 E4');
const instantanee = rhs('S -> ![/8] C4 D4 E4');
if (collee === instantanee) {
  echecs++;
  console.error('✗ les surfaces collée et instantanée ont CONVERGÉ — régression : ce sont');
  console.error('    deux sémantiques distinctes (scopée contre persistante), pas deux graphies.');
  console.error(`    les deux rendent : ${collee}`);
} else {
  passes++;
}

console.log(`\n[tempo] ${passes} vérification(s) passée(s), ${echecs} échec(s).`);
process.exit(echecs ? 1 : 0);
