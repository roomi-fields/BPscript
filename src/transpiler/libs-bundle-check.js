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
console.log('[bundle:check] ✓ libs-data.js à jour vs les sources lib/.');
