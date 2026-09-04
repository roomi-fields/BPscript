// Garde de FRAÎCHEUR des artefacts dérivés — OUTILLAGE (gate pré-push).
//
// Invariant gardé : chaque artefact COMMITTÉ doit être IDENTIQUE à la sortie de son générateur. Un
// artefact PÉRIMÉ — source éditée sans régénérer — est REJETÉ au portillon. Câblé à `npm run arch`.
// Décision deps-fraîches `hub/decisions/2026-06-30-deps-fraiches-source-unique-serveur.md` point 3.
//
// ⛔ DEUX ARTEFACTS ONT QUITTÉ CE GARDE LE 2026-09-04, avec le bundle des librairies : `libs-data.js`
// et `libs-data.d.ts`. Le compilateur lit ses SOURCES depuis le 2026-09-02, donc le bundle figé était
// devenu une seconde autorité sur la même donnée — et un garde de fraîcheur sur une voie parallèle
// entretient la voie au lieu de la fermer. Le registre vivant n'a pas de fraîcheur à garder : il EST
// la source. Décision de Romain, 2026-09-04.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
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
// ⛔ ET LA PORTE DES GABARITS SE VÉRIFIE PAREIL — posée le 2026-08-21 quand ils ont quitté `lib/`.
// Troisième artefact dérivé, troisième garde de fraîcheur : bp3-frontend lit la CLÉ
// `bp3-settings-template` et son témoin compare deux ENSEMBLES, le dossier et le paquet. Un
// artefact périmé lui montrerait un paquet cohérent avec un dossier qui a bougé — donc vert.
const gabaritsGen = join(__dirname, 'gabarits-bundle.mjs');
const gabaritsPath = join(__dirname, 'gabarits-data.js');
const gabaritsFresh = execFileSync(process.execPath, [gabaritsGen], { encoding: 'utf-8' });
const gabaritsCommitted = readFileSync(gabaritsPath, 'utf-8');
if (gabaritsFresh !== gabaritsCommitted) {
  console.error(
    '[bundle:check] ✗ src/transpiler/gabarits-data.js est PÉRIMÉ vs gabarits/*.json.\n' +
    '               Régénère : `npm run bundle:gabarits` (puis commit).',
  );
  process.exit(1);
}
console.log('[bundle:check] ✓ syntaxe-data.js et gabarits-data.js à jour.');
