#!/usr/bin/env node
/**
 * LE CHAMP `files` DU MANIFESTE SE DÉRIVE DE `dist/`, IL NE SE TIENT PAS À LA MAIN.
 *
 * Les morceaux partagés du regroupeur (`dist/chunk-*.js`) sont nommés sur leur contenu : à chaque
 * changement de donnée, certains meurent et d'autres naissent, et un manifeste tenu à la main se
 * périme EN SILENCE — le paquet publié perd un morceau que `dist/index.js` importe en première ligne,
 * et le premier import échoue chez le consommateur. Mesuré par Atlas le 2026-09-02 (`1ac1b35`).
 *
 * Ce script a vécu HORS du dépôt, dans un bac de travail de session, pendant une journée de frappes :
 * il était appelé à chaque construction et n'était nulle part. Il vit ici depuis le 2026-09-02, et
 * `npm run construire` l'appelle.
 *
 *     node scripts/deriver-files.mjs             dérive et écrit le manifeste s'il a changé
 *     node scripts/deriver-files.mjs --verifier  sort en 1 si le manifeste ne dit pas `dist/`
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFESTE = join(RACINE, 'package.json');
const verifier = process.argv.includes('--verifier');

const pkg = JSON.parse(readFileSync(MANIFESTE, 'utf8'));
const reels = readdirSync(join(RACINE, 'dist')).filter((n) => n.startsWith('chunk-')).sort().map((n) => `dist/${n}`);
if (!reels.length) {
  console.error('[files] ⛔ aucun morceau dans dist/ — construire d\'abord ; un manifeste dérivé de rien ne prouve rien.');
  process.exit(1);
}
const ancien = pkg.files;
const sortants = ancien.filter((f) => f.startsWith('dist/chunk-') && !reels.includes(f));
const entrants = reels.filter((f) => !ancien.includes(f));

if (!sortants.length && !entrants.length) {
  console.log(`[files] déjà dérivé — ${reels.length} morceau(x), aucun ne bouge.`);
  process.exit(0);
}
if (verifier) {
  console.error(`[files] ⛔ le manifeste ne dit pas dist/ — sortent : ${sortants.join(' ') || '—'} · entrent : ${entrants.join(' ') || '—'}`);
  console.error('       → node scripts/deriver-files.mjs, puis enregistrer package.json avec dist/.');
  process.exit(1);
}
// Les morceaux prennent la place des anciens dans la liste ; le reste du champ ne bouge pas.
const premierRang = ancien.findIndex((f) => f.startsWith('dist/chunk-'));
const sansMorceaux = ancien.filter((f) => !f.startsWith('dist/chunk-'));
const rang = premierRang === -1 ? sansMorceaux.length : premierRang;
pkg.files = [...sansMorceaux.slice(0, rang), ...reels, ...sansMorceaux.slice(rang)];
writeFileSync(MANIFESTE, JSON.stringify(pkg, null, 2) + '\n');
console.log(`[files] sortent : ${sortants.join(' ') || '—'}`);
console.log(`[files] entrent : ${entrants.join(' ') || '—'}`);
console.log(`[files] ${pkg.files.length} entrée(s), dont ${reels.length} morceau(x).`);
