#!/usr/bin/env node
/**
 * UNE INVOCATION MET SON VOCABULAIRE EN PORTÉE — une seule ligne suffit.
 *
 * `@test_alphabets.abc` charge l'alphabet ET l'active : ses mots sont écrivables, tout autre mot est
 * refusé. Le nom du fichier et celui de l'entrée disent déjà tout.
 *
 * ⛔ ELLE DÉSACTIVAIT LA VALIDATION AU LIEU DE L'ACTIVER. La scène sortait avec ZÉRO terminal en
 * portée, `validateTerminals` revenait avant tout contrôle, et n'importe quel symbole passait. Il
 * fallait écrire `@alphabet.abc` EN PLUS — et cette seconde ligne coûtait deux fois : elle donnait
 * un faux vert ici tout en faisant REFUSER la projection chez Kairos, deux surfaces se disputant un
 * seul slot d'alphabet. Une ligne qui répare la compilation et casse la projection n'est pas une
 * contrainte, c'est le symptôme d'un défaut.
 *
 * ⚠️ LA SONDE SE CALCULE, ELLE NE SE CHOISIT PAS, et c'est la leçon de méthode de ce garde. Un mot
 * témoin fait de lettres présentes dans le vocabulaire est ABSORBÉ par lui : `ZZZ` reste accepté
 * sous `structural`, qui déclare `Z` — il s'y lit `Z Z Z`. Une sonde prise DANS le vocabulaire
 * qu'elle teste ne prouve rien, et le volet A la vérifie insegmentable avant de s'en servir.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';
import { segmenter } from '../src/transpiler/segmentation.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const messages = (r) => (r.errors || []).map((e) => e.message ?? e).join(' | ');

// ── A. UNE LIGNE SUFFIT — sur CHAQUE alphabet du catalogue de test ──────────────────────────
// ⚠️ LA LISTE VIENT DE LA DONNÉE : un alphabet ajouté demain est couvert le jour même.
{
  const entrees = Object.entries(LIBS.test_alphabets || {})
    .filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object' && v.terminals);
  ok(entrees.length > 0,
     `A. aucun alphabet dans le catalogue de test — le garde serait creux.`);

  for (const [nom, lib] of entrees) {
    const T = new Set(Object.keys(lib.terminals));
    // La sonde : le premier mot dont AUCUN morceau n'est un terminal.
    const sonde = ['QQQ', 'WWW', 'Q7Q', 'JJJ'].find((s) => !T.has(s) && !segmenter(s, T)?.parts);
    ok(!!sonde,
       `A. aucune sonde insegmentable trouvée pour '${nom}' — sans elle ce volet ne mesure rien, `
       + `parce qu'un mot absorbé par le vocabulaire reste accepté quoi qu'il arrive.`);
    if (!sonde) continue;

    const bon = compileToBPxAST(`core\ntest_alphabets.${nom}\n-----\nS -> ${[...T][0]}\n`);
    ok(messages(bon) === '',
       `A. 'test_alphabets.${nom}' SEULE doit accepter ses propres mots — reçu : ${messages(bon).slice(0, 80)}`);

    const mauvais = compileToBPxAST(`core\ntest_alphabets.${nom}\n-----\nS -> ${sonde}\n`);
    ok(messages(mauvais) !== '',
       `A. 'test_alphabets.${nom}' SEULE doit REFUSER '${sonde}', insegmentable sur ses `
       + `${T.size} termes. Il passe — donc la validation ne tourne pas, et cette scène n'est `
       + `contrôlée par rien.`);
  }
}

// ── B. CE QUI N'EST PAS UN ALPHABET NE MET RIEN EN PORTÉE ────────────────────────────────────
// ⚠️ SANS CE VOLET, une passe qui chargerait n'importe quelle invocation passerait le volet A en
// triomphe — et donnerait à une scène le vocabulaire d'une palette de sons.
{
  // ⚠️ LE CAS SE PREND SANS AUTRE ALPHABET, et c'est la seule forme qui discrimine. Ma première
  // écriture posait `alphabet.western` à côté : l'alphabet y était déjà, donc une passe qui aurait
  // chargé N'IMPORTE QUELLE invocation passait le volet EN VERT. L'injection ne mordait pas — et
  // c'était le volet qui était creux, pas l'injection.
  // Invoquée SEULE, une entrée sans terminaux laisse le vocabulaire tel qu'il était ; la charger
  // rendrait la scène validée contre un ensemble VIDE, où même `C4` serait refusé.
  for (const [quoi, directive] of [
    ['une palette de percussions', 'sound.tabla_perc'],
    ['une table de réécriture',    'homomorphism.dhati'],
    ['un langage d\'évaluation',   'eval.strudel'],
  ]) {
    const r = compileToBPxAST(`core\n${directive}\n-----\nS -> C4\n`);
    ok(messages(r) === '',
       `B. ${quoi} ne porte aucun terminal : l'invoquer SEULE ne doit rien mettre en portée. `
       + `Reçu : ${messages(r).slice(0, 80)} — si 'C4' est refusé, la scène est validée contre un `
       + `ensemble VIDE.`);
  }
}

// ── C. LA DIRECTIVE D'AXE CONTINUE DE MARCHER — l'une n'exclut pas l'autre ───────────────────
{
  const r = compileToBPxAST('core\nalphabet.tabla\n-----\nS -> dha\n');
  ok(messages(r) === '',
     `C. 'alphabet.tabla' pose toujours son alphabet — reçu : ${messages(r).slice(0, 80)}`);
  const deux = compileToBPxAST('core\ntest_alphabets.abc\nalphabet.abc\n-----\nS -> a\n');
  ok(messages(deux) === '',
     `C. les DEUX lignes ensemble restent acceptées — la seconde devient inutile, pas interdite. `
     + `Reçu : ${messages(deux).slice(0, 80)}`);
}

// ── SOCLE ────────────────────────────────────────────────────────────────────────────────────
ok(passe >= 20, `SOCLE : ${passe} vérifications seulement — la matrice s'est vidée sans rougir.`);

if (echecs.length) {
  console.error(`❌ une invocation met son vocabulaire en portée : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ Une seule ligne suffit — chaque alphabet du catalogue de test accepte ses mots et `
          + `REFUSE une sonde calculée insegmentable sur lui. Ce qui ne porte pas de terminaux ne `
          + `met rien en portée, et la directive d'axe continue de marcher. `
          + `${passe} vérification(s) passée(s).`);
