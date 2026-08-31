#!/usr/bin/env node
/**
 * LA CONSTRUCTION — CE QUI EST PUBLIÉ CESSE D'ÊTRE CE QUI S'ÉDITE.
 *
 * Règle de Romain, 2026-08-31 : *« tous les projets ont maintenant des binaires versionnés qui sont
 * utilisés par les autres repos »*. Décision
 * `hub/decisions/2026-08-31-tout-depot-consomme-publie-un-artefact-construit.md`.
 *
 * ⛔ CE QUE ÇA FERME, ET C'EST LA RAISON. Avant, mes onze cibles publiées pointaient vers `src/` :
 * un voisin lié me lisait VIVANT, donc chaque frappe l'atteignait, et **onze de mes vingt fichiers
 * publiés voyageaient sans qu'aucune porte ne les ouvre** — `tokenizer.js`, `parser.js`,
 * `bpxAst.js` en tête, que kairos exécute. Un consommateur exécutait du code dont la stabilité
 * n'était promise par personne. Le regroupement les fait disparaître : ce qui n'est pas une porte
 * n'est plus atteignable.
 *
 * ⚠️ LA TABLE DES SOURCES VIT DANS `build.portes.json`, PAS ICI. Le manifeste ne porte que les
 * CIBLES — c'est lui qui fait foi pour un consommateur. Une source écrite en dur dans ce script
 * serait invisible : personne ne pourrait la lire ni la surcharger.
 *
 * ⚠️ ET TOUT IMPORT NU RESTE EXTERNE — `--packages=external`, jamais une liste de noms. Mon
 * manifeste ne déclare AUCUNE dépendance d'exécution : ce qui n'est pas relatif est fourni par le
 * consommateur, et l'était déjà. `public/editor/bpscript-lang.js` était publié tel quel et son
 * consommateur résolvait codemirror et lezer de son côté ; les embarquer changerait la sémantique de
 * la porte au passage, sous couvert de construction. Une liste écrite ici périmerait au premier
 * import ajouté, en silence, et la règle vaut pour toutes les portes d'un coup.
 *
 * `--verifier` recompare l'enregistré au régénéré, comme la carte et l'assiette : un artefact
 * commité qui aurait dérivé de sa source publierait une chaîne que plus personne ne mesure.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const RACINE = new URL('..', import.meta.url).pathname;
const TABLE = JSON.parse(readFileSync(join(RACINE, 'build.portes.json'), 'utf8'));

/** Les cibles que le manifeste publie sous `dist/` — la liste opposable, dérivée jamais recopiée. */
export function ciblesPubliees() {
  const paquet = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'));
  const out = new Set();
  const prendre = (v) => {
    if (typeof v === 'string') { if (v.startsWith('./dist/')) out.add(v.slice(2)); return; }
    if (v && typeof v === 'object') for (const x of Object.values(v)) prendre(x);
  };
  for (const v of Object.values(paquet.exports || {})) prendre(v);
  if (typeof paquet.main === 'string' && paquet.main.startsWith('dist/')) out.add(paquet.main);
  return [...out].sort();
}

/** Construit une porte. Rend la taille écrite. */
function construire(cible, source) {
  const abs = join(RACINE, cible);
  mkdirSync(dirname(abs), { recursive: true });
  execFileSync('npx', ['esbuild', source, '--bundle', '--format=esm', '--platform=neutral',
    '--packages=external', '--outfile=' + abs], { cwd: RACINE, stdio: 'pipe' });
  return readFileSync(abs, 'utf8').length;
}

if (process.argv[1] && process.argv[1].endsWith('construire.mjs')) {
  const verifier = process.argv.includes('--verifier');
  const portes = Object.entries(TABLE.portes);
  const copies = Object.entries(TABLE.copies || {});

  // ⛔ UN GARDE COMPTE CE QU'IL A EXAMINÉ ET REFUSE D'AVOIR EXAMINÉ ZÉRO.
  if (!portes.length) { console.error('[construire] ⛔ ZÉRO porte déclarée — rien à construire.'); process.exit(1); }

  // ⛔ LA TABLE ET LE MANIFESTE DOIVENT DIRE LA MÊME CHOSE. Une porte construite qu'aucun `exports`
  // n'ouvre est du poids mort ; une cible publiée que la table ne construit pas est un chemin mort.
  const declarees = ciblesPubliees();
  const construites = [...portes.map(([c]) => c), ...copies.map(([c]) => c)].sort();
  const orphelines = construites.filter((c) => !declarees.includes(c));
  const fantomes = declarees.filter((c) => !construites.includes(c));
  if (orphelines.length || fantomes.length) {
    console.error('[construire] ⛔ LA TABLE ET LE MANIFESTE DIVERGENT.');
    if (fantomes.length) console.error(`        PUBLIÉES et non construites (chemin mort) : ${fantomes.join(', ')}`);
    if (orphelines.length) console.error(`        CONSTRUITES et non publiées (poids mort) : ${orphelines.join(', ')}`);
    process.exit(1);
  }

  const avant = verifier
    ? Object.fromEntries(construites.filter((c) => existsSync(join(RACINE, c)))
        .map((c) => [c, readFileSync(join(RACINE, c), 'utf8')]))
    : null;

  if (!verifier && existsSync(join(RACINE, 'dist'))) rmSync(join(RACINE, 'dist'), { recursive: true });
  let total = 0;
  for (const [cible, source] of portes) total += construire(cible, source);
  for (const [cible, source] of copies) {
    mkdirSync(dirname(join(RACINE, cible)), { recursive: true });
    writeFileSync(join(RACINE, cible), readFileSync(join(RACINE, source), 'utf8'));
  }

  if (verifier) {
    const derives = construites.filter((c) => avant[c] !== readFileSync(join(RACINE, c), 'utf8'));
    const absents = construites.filter((c) => avant[c] === undefined);
    if (absents.length || derives.length) {
      console.error(`[construire] ⛔ L'ARTEFACT ENREGISTRÉ N'EST PAS CELUI QUE LA SOURCE PRODUIT.`);
      if (absents.length) console.error(`        ABSENT(S) du dépôt : ${absents.join(', ')}`);
      if (derives.length) console.error(`        A DÉRIVÉ de sa source : ${derives.join(', ')}`);
      console.error('        Régénérer par `npm run construire`, et le commiter avec la source.');
      process.exit(1);
    }
    console.log(`[construire] ✓ ${construites.length} artefact(s) conformes à leur source · ${Math.round(total / 1024)} ko`);
    process.exit(0);
  }

  const nb = readdirSync(join(RACINE, 'dist')).length;
  console.log(`[construire] ${construites.length} porte(s) construite(s) — ${nb} fichier(s), ${Math.round(total / 1024)} ko`);
}
