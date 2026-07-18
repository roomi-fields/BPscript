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
 * LA DISTINCTION QUE CES TESTS VERROUILLENT
 * (décision `hub/decisions/2026-07-16-tempo-slash-n-nu-legacy-persistant.md`, RATIFIÉE) :
 *   - `SYM[/N]` — bracket COLLÉ, surface canonique BPScript → suffixe **SCOPÉ** (enter/exit).
 *     Le tempo ne gouverne QUE l'élément qualifié ; ce qui suit revient au tempo hérité.
 *   - `![/N]`   — forme instantanée → **PERSISTANT** jusqu'à la fin du champ. C'est elle qui
 *     transcrit le `/N` ESPACÉ des grammaires `.gr` natives.
 * Les confondre change le son. Ce n'est pas une nuance de graphie.
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
