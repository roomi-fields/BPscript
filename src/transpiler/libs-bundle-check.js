// Garde de FRAÎCHEUR du bundle de librairies — OUTILLAGE (gate pré-push).
//
// Invariant gardé : `libs-data.js` (bundle COMMITTÉ, consommé par libs.js) doit être IDENTIQUE à la
// sortie de `libs-bundle.js` (régénération depuis lib/*.json + lib/digital/*.ts). Un bundle PÉRIMÉ
// (édition d'une lib SANS régénérer) est alors REJETÉ au portillon → péremption (a) rendue IMPOSSIBLE.
// Câblé à `npm run arch`. Sources : trou [215] (kanopi), décision deps-fraîches
// `hub/decisions/2026-06-30-deps-fraiches-source-unique-serveur.md` point 3 (garde « compilé pas en
// retard sur source »). Cf. l'avertissement de l'en-tête `libs.js` (« regenerate the bundle »).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const generator = join(__dirname, 'libs-bundle.js');
const bundlePath = join(__dirname, 'libs-data.js');

const fresh = execFileSync(process.execPath, [generator], { encoding: 'utf-8' });
const committed = readFileSync(bundlePath, 'utf-8');

if (fresh !== committed) {
  console.error(
    '[bundle:check] ✗ src/transpiler/libs-data.js est PÉRIMÉ vs lib/*.json + lib/digital/*.ts.\n' +
    '               Régénère : `npm run bundle:libs` (puis commit).',
  );
  process.exit(1);
}
// ⛔ LE TYPE PUBLIÉ SE VÉRIFIE COMME LA DONNÉE — posé le 2026-08-14 avec `libs-data.d.ts`.
// Kanopi a demandé que la porte officielle publie sa FORME, et il a refusé de la recopier chez lui :
// « une surface publiée se DÉRIVE, jamais ne se recopie ». Un type dérivé qu'on ne vérifie pas
// dérive exactement comme la copie qu'on voulait éviter — il décrirait une donnée d'hier en ayant
// l'air d'être la source de vérité, et le contrôle de types du voisin passerait au vert sur du faux.
const typesGen = join(__dirname, 'libs-types.js');
const typesPath = join(__dirname, 'libs-data.d.ts');
const typesFresh = execFileSync(process.execPath, [typesGen], { encoding: 'utf-8' });
const typesCommitted = readFileSync(typesPath, 'utf-8');
if (typesFresh !== typesCommitted) {
  console.error(
    '[bundle:check] ✗ src/transpiler/libs-data.d.ts est PÉRIMÉ vs le paquet.\n' +
    '               Régénère : `npm run bundle:libs` (puis commit).',
  );
  process.exit(1);
}
// ⛔ ET LA PORTE DU SCHÉMA DE SYNTAXE SE VÉRIFIE COMME LE BUNDLE — posée le 2026-08-21 quand le
// schéma a quitté `lib/`. C'est un SECOND artefact dérivé, et un artefact dérivé sans garde de
// fraîcheur dérive en silence : le bundle l'a déjà fait, et son garde est né de cette dérive.
// Atlas le lit par `git show <branche>:src/transpiler/syntaxe-data.js` — un fichier périmé lui
// publierait un vocabulaire d'hier sous l'apparence de la source de vérité.
const syntaxeGen = join(__dirname, 'syntaxe-bundle.mjs');
const syntaxePath = join(__dirname, 'syntaxe-data.js');
const syntaxeFresh = execFileSync(process.execPath, [syntaxeGen], { encoding: 'utf-8' });
const syntaxeCommitted = readFileSync(syntaxePath, 'utf-8');
if (syntaxeFresh !== syntaxeCommitted) {
  console.error(
    '[bundle:check] ✗ src/transpiler/syntaxe-data.js est PÉRIMÉ vs schema-syntaxe/language.json.\n' +
    '               Régénère : `npm run bundle:syntaxe` (puis commit).',
  );
  process.exit(1);
}
console.log('[bundle:check] ✓ libs-data.js, libs-data.d.ts et syntaxe-data.js à jour vs leurs sources.');
