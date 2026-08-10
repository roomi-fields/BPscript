#!/usr/bin/env node
/**
 * GARDE — CE QUI EST COLLÉ À LA VALEUR D'UNE DIRECTIVE EST REFUSÉ, ET LE REFUS LE NOMME.
 *
 * ⚠️ CE GARDE MANQUAIT, ET SON ABSENCE A SERVI D'ARGUMENT. Le 2026-08-10, en retirant une branche
 * morte du parseur, un chantier a fait perdre le message dédié de `@duration:16b` ; le motif donné
 * était « aucun garde ne teste cette forme précise ». Ce n'est pas une raison d'accepter une
 * régression de diagnostic — c'est la raison d'écrire le garde qui manque.
 *
 * ⚠️ ET LE DÉFAUT N'ÉTAIT PAS CELUI QU'ON CROYAIT. Mesuré avant de réparer : il ne touchait pas
 * `duration` en propre, il touchait TOUTE directive dont la valeur porte quelque chose de collé —
 * y compris `@tempo:120b`, sur une directive parfaitement vivante. Réparer `duration` seul aurait
 * réparé l'endroit où le défaut s'est montré, pas l'espace où il vit.
 *
 * CE QUE COÛTAIT LE SILENCE : la valeur numérique se lisait, l'unité restait sur la pile, et la
 * boucle principale la rencontrait plus loin comme un symbole égaré. Le message était donc
 * « Expected arrow (-> <- <>) », À LA LIGNE SUIVANTE. Un auteur y lit un problème de règle alors
 * qu'il a écrit une unité qui n'existe pas, une ligne plus haut.
 *
 * LA MATRICE, ET SON COMPLÉMENT — les deux moitiés comptent autant :
 *   · TOUTE forme collée est refusée, sur des directives de familles différentes, par les DEUX
 *     écritures qui lisent une valeur (la directive de tête et la forme de flux) ;
 *   · TOUTE forme légitime passe — sans quoi un refus trop large aurait l'air juste ici.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const SOCLE = '@core\n@alphabet.western\n';
const err = (src) => {
  try { return (compileToBPxAST(SOCLE + src).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};

// ── 1. CE QUI EST COLLÉ EST REFUSÉ, ET LE REFUS NOMME LES DEUX MORCEAUX ──────────────────────
// Des directives de familles DIFFÉRENTES : une vivante et lue en aval (`tempo`), une de
// production (`items`, `seed`), une SUPPRIMÉE du langage (`duration`), une INCONNUE (`zorglub`).
// Le défaut vivait sous les quatre : un garde qui n'en prendrait qu'une le laisserait sous les
// autres.
const COLLEES = [
  ['tempo', '120', 'b'],
  ['items', '20', 's'],
  ['seed', '42', 'x'],
  ['duration', '16', 'b'],
  ['zorglub', '16', 'b'],
];
console.log(`[unité collée] ${COLLEES.length} directive(s) x 2 écritures + les formes légitimes`);

for (const [nom, val, unite] of COLLEES) {
  const e = err(`@${nom}:${val}${unite}\nS -> C4`);
  ok(e.length >= 1, `1. '@${nom}:${val}${unite}' doit être REFUSÉ — '${unite}' ne se lit pas`);
  ok(e.some((m) => m.includes(`'${unite}'`)),
     `1. le refus de '@${nom}:${val}${unite}' doit NOMMER ce qui reste collé ('${unite}') ; reçu : ${e[0]}`);
  ok(e.some((m) => m.includes(`'${nom}'`)),
     `1. le refus de '@${nom}:${val}${unite}' doit NOMMER la directive ('${nom}') ; reçu : ${e[0]}`);
  // ⚠️ LA MOITIÉ QUI DIT POURQUOI CE GARDE EXISTE : le message d'AVANT parlait de flèche, à la
  // ligne suivante. S'il revenait, tout le reste de ce garde resterait vert.
  ok(!e.some((m) => /Expected arrow/.test(m)),
     `1. '@${nom}:${val}${unite}' ne doit PLUS tomber sur « Expected arrow » — c'est le diagnostic `
     + `qui envoyait l'auteur chercher une règle quand il avait écrit une unité ; reçu : ${e[0]}`);
}

// ── 2. L'AUTRE ÉCRITURE — la forme de FLUX lit la même valeur par le même chemin ─────────────
// Sans ce bloc, une réparation posée sur la seule tête de scène laisserait le flux muet.
{
  const e = err('S -> ![seed:42x] C4');
  ok(e.length >= 1, "2. '![seed:42x]' dans le flux doit être REFUSÉ comme en tête de scène");
  ok(e.some((m) => m.includes("'x'")), `2. et le refus doit nommer ce qui reste collé ; reçu : ${e[0]}`);
  // ⚠️ LE MESSAGE NE DOIT PAS CITER UNE GRAPHIE QUE L'AUTEUR N'A PAS ÉCRITE. La première version
  // du refus citait `'@seed:42x'` à qui avait écrit `![seed:42x]` — elle l'envoyait chercher une
  // ligne de tête inexistante. Un diagnostic qui déplace le lecteur est pire qu'un diagnostic
  // vague.
  ok(!e.some((m) => m.includes('@seed')),
     `2. le refus ne doit pas citer la graphie '@seed' — l'auteur a écrit '![seed:…]' ; reçu : ${e[0]}`);
}

// ── 3. LE COMPLÉMENT — ce qui est LÉGITIME passe ─────────────────────────────────────────────
// Un refus trop large aurait l'air juste dans la section 1. Ces formes sont lues AVANT le refus
// et sortent par leur propre chemin : chacune vérifie qu'il n'a pas mangé le sien.
const LEGITIMES = [
  ['un entier nu', '@tempo:120'],
  ['un rapport', '@meter:3/4'],
  ['un mètre additif', '@meter:3+4+2/4'],
  ['une valeur négative', '@transpose:-24'],
  ['un nom', '@mode:random'],
  ['une graine nue', '@seed:42'],
  ['la forme de flux', 'S -> ![seed:42] C4'],
];
for (const [quoi, forme] of LEGITIMES) {
  const src = forme.startsWith('S ->') ? forme : `${forme}\nS -> C4`;
  const e = err(src);
  ok(e.length === 0, `3. '${forme}' (${quoi}) doit PASSER — reçu : ${e[0]}`);
}
// La forme pointée porte un nom de composant, pas une valeur : elle ne passe pas par ce lecteur,
// et ce témoin le tient — si le refus l'atteignait, il mordrait toute la surface d'invocation.
ok(err('@alphabet.western:midi\nS -> C4').length === 0
   || !err('@alphabet.western:midi\nS -> C4')[0].includes('collé'),
   `3. '@alphabet.western:midi' ne doit pas être accusé d'unité collée`);

// ── 4. TÉMOIN D'INSTRUMENT ───────────────────────────────────────────────────────────────────
ok(COLLEES.length >= 5 && LEGITIMES.length >= 7,
   `4. la matrice ne s'est pas vidée — ${COLLEES.length} refus, ${LEGITIMES.length} passages`);
ok(err('@tempo:120\nS -> C4').length === 0 && err('@tempo:120b\nS -> C4').length >= 1,
   '4. TÉMOIN — le compilateur distingue encore les deux, sur la MÊME directive');

if (echecs.length) {
  console.error(`[unité collée] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[unité collée] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
