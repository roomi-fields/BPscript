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
import esbuild from 'esbuild';

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

/**
 * Construit TOUTES les portes en UN SEUL graphe, morceaux partagés.
 *
 * ⛔ DIX PORTES SÉPARÉES FERAIENT DIX INSTANCES D'UN MÊME MODULE. Un consommateur qui importe
 * `bpscript` et `bpscript/bpxAst` obtiendrait deux copies du même code, donc deux états — un défaut
 * qui ne se voit qu'à l'exécution et seulement quand un module porte un état. Le graphe unique le
 * rend impossible par construction. Mesuré : 515 ko en un graphe contre 729 ko pour huit portes
 * séparées, et le partage grandit avec le nombre de portes.
 */
async function construireTout(portes) {
  const entryPoints = Object.fromEntries(
    portes.map(([cible, source]) => [cible.replace(/^dist\//, '').replace(/\.js$/, ''), source]),
  );
  const r = await esbuild.build({
    entryPoints, bundle: true, format: 'esm', platform: 'neutral', splitting: true,
    packages: 'external', outdir: join(RACINE, 'dist'), metafile: true,
  });
  return Object.values(r.metafile.outputs).reduce((t, o) => t + o.bytes, 0);
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

  // ⛔ L'EMPREINTE PORTE SUR TOUT `dist/`, PAS SUR LES SEULES CIBLES DÉCLARÉES. Les morceaux
  // partagés ne sont ni des portes ni des copies : les exclure reviendrait à choisir ce qu'on ne
  // verra pas, et c'est là que vit la majorité du code publié.
  const empreinteDist = () => {
    const dir = join(RACINE, 'dist');
    if (!existsSync(dir)) return {};
    return Object.fromEntries(readdirSync(dir).sort()
      .map((f) => [`dist/${f}`, readFileSync(join(dir, f), 'utf8')]));
  };
  const avant = verifier ? empreinteDist() : null;

  if (existsSync(join(RACINE, 'dist'))) rmSync(join(RACINE, 'dist'), { recursive: true });
  const total = await construireTout(portes);
  for (const [cible, source] of copies) {
    mkdirSync(dirname(join(RACINE, cible)), { recursive: true });
    writeFileSync(join(RACINE, cible), readFileSync(join(RACINE, source), 'utf8'));
  }
  const apres = empreinteDist();

  if (verifier) {
    const noms = [...new Set([...Object.keys(avant), ...Object.keys(apres)])].sort();
    const absents = noms.filter((c) => avant[c] === undefined);
    const enTrop = noms.filter((c) => apres[c] === undefined);
    const derives = noms.filter((c) => avant[c] !== undefined && apres[c] !== undefined && avant[c] !== apres[c]);
    if (absents.length || enTrop.length || derives.length) {
      console.error(`[construire] ⛔ L'ARTEFACT ENREGISTRÉ N'EST PAS CELUI QUE LA SOURCE PRODUIT.`);
      if (absents.length) console.error(`        ABSENT(S) du dépôt : ${absents.join(', ')}`);
      if (enTrop.length) console.error(`        ENREGISTRÉ(S) sans que la source les produise : ${enTrop.join(', ')}`);
      if (derives.length) console.error(`        A DÉRIVÉ de sa source : ${derives.join(', ')}`);
      console.error('        Régénérer par `npm run construire`, et le commiter avec la source.');
      process.exit(1);
    }
    console.log(`[construire] ✓ ${noms.length} fichier(s) de dist/ conformes à leur source, `
      + `dont ${construites.length} porte(s) · ${Math.round(total / 1024)} ko`);
    process.exit(0);
  }

  console.log(`[construire] ${construites.length} porte(s) — ${Object.keys(apres).length} fichier(s) `
    + `dans dist/, ${Math.round(total / 1024)} ko`);
}
