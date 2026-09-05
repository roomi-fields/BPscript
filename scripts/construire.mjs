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
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import esbuild from 'esbuild';
import { deriverLesTypes, ciblesDeTypes } from './deriver-types.mjs';

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
async function construireTout(portes, sortie) {
  const entryPoints = Object.fromEntries(
    portes.map(([cible, source]) => [cible.replace(/^dist\//, '').replace(/\.js$/, ''), source]),
  );
  // ⛔ LES SOURCES DE LIBRAIRIE S'EMBARQUENT COMME TEXTE — Romain, 2026-08-30 : « le parseur tourne
  // déjà dans le navigateur ; ce qui manque n'est pas la capacité de compiler, c'est l'accès au
  // système de fichiers, et un .bpsl embarqué comme texte le règle sans générer de module ». Le
  // module `sources.js` lit `lib/` sur le disque ; dans une porte construite, il est REMPLACÉ par la
  // même liste, lue ici au moment de la construction. Un seul import site, deux fournisseurs, choisis
  // à la construction — jamais à l'exécution. Rien n'est écrit dans `src/`.
  const { sourcesDeLibrairie } = await import('../src/transpiler/sources.js');
  const sourcesEmbarquees = {
    name: 'sources-de-librairie-embarquees',
    setup(b) {
      b.onResolve({ filter: /[\\/]sources\.js$/ }, (args) => (
        args.importer.includes('/src/transpiler/') ? { path: 'sources-de-librairie', namespace: 'bpscript-sources' } : null));
      b.onLoad({ filter: /.*/, namespace: 'bpscript-sources' }, () => ({
        contents: `const SOURCES = ${JSON.stringify(sourcesDeLibrairie())};\nexport function sourcesDeLibrairie() { return SOURCES.map((s) => ({ ...s })); }\n`,
        loader: 'js',
      }));
    },
  };
  const r = await esbuild.build({
    entryPoints, bundle: true, format: 'esm', platform: 'neutral', splitting: true,
    packages: 'external', outdir: sortie, metafile: true, plugins: [sourcesEmbarquees],
  });
  return Object.values(r.metafile.outputs).reduce((t, o) => t + o.bytes, 0);
}

/**
 * Le contenu d'un dossier de construction, fichier par fichier, SOUS-DOSSIERS COMPRIS.
 *
 * ⛔ IL NE LISAIT QU'UN NIVEAU, ET LA DESCRIPTION DES PORTES VIT SOUS `types/`. Une comparaison qui
 * n'énumère pas ce qu'elle doit juger est verte pour toujours : les déclarations auraient dérivé de
 * leurs sources sans que rien ne le dise, et le consommateur aurait lu une surface périmée. C'est
 * la clause posée au hub le 2026-09-05 — *une description que le garde ne peut pas LIRE est aussi
 * peu confrontée qu'une description qu'aucun garde ne lit.*
 */
function contenuDe(dir, base = dir) {
  if (!existsSync(dir)) return {};
  const out = {};
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) Object.assign(out, contenuDe(p, base));
    else out[relative(base, p)] = readFileSync(p, 'utf8');
  }
  return out;
}

/**
 * L'écart entre ce que la source produit et ce qui est enregistré — trois familles nommées.
 *
 * ⛔ ELLE EST SÉPARÉE POUR ÊTRE ÉPROUVÉE. Le garde a vécu une heure sans témoin sur son propre
 * détecteur : injection faite le 2026-08-31, comparaison de contenus remplacée par `false`, artefact
 * fautif enregistré ⇒ **verdict VERT, code 0**. Les trois morsures étaient prouvées et le juge ne
 * l'était pas — *un détecteur mort et un dossier propre rendent la même sortie.*
 */
export function ecartDe(attendu, enregistre) {
  const noms = [...new Set([...Object.keys(attendu), ...Object.keys(enregistre)])].sort();
  return {
    noms,
    absents: noms.filter((f) => enregistre[f] === undefined),
    enTrop: noms.filter((f) => attendu[f] === undefined),
    derives: noms.filter((f) => attendu[f] !== undefined && enregistre[f] !== undefined
      && attendu[f] !== enregistre[f]),
  };
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
  // Les descriptions de portes sont construites au même titre que les portes : dérivées du code par
  // `deriver-types.mjs`, elles sont des cibles publiées et se confrontent comme les autres.
  const construites = [...portes.map(([c]) => c), ...copies.map(([c]) => c), ...ciblesDeTypes()].sort();
  const orphelines = construites.filter((c) => !declarees.includes(c));
  const fantomes = declarees.filter((c) => !construites.includes(c));
  if (orphelines.length || fantomes.length) {
    console.error('[construire] ⛔ LA TABLE ET LE MANIFESTE DIVERGENT.');
    if (fantomes.length) console.error(`        PUBLIÉES et non construites (chemin mort) : ${fantomes.join(', ')}`);
    if (orphelines.length) console.error(`        CONSTRUITES et non publiées (poids mort) : ${orphelines.join(', ')}`);
    process.exit(1);
  }

  // ⛔ EN VÉRIFICATION, ON NE TOUCHE JAMAIS L'ARTEFACT ENREGISTRÉ — BPS-105, réparé le 2026-08-31.
  //
  // Ce garde supprimait `dist/` et le reconstruisait AVANT de comparer. Deux conséquences, et la
  // seconde est la grave :
  //   · chaque passage du portillon réécrivait les dix-huit fichiers publiés, **sans commit ni
  //     publication** — kanopi a vu bouger dix-huit entrées pendant sa campagne, trois fois ;
  //   · ⛔ entre la suppression et la reconstruction, **`dist/` N'EXISTE PAS**. Un portillon
  //     interrompu là laisse le paquet publié amputé, et un voisin lié lit ce trou.
  //
  // ⇒ La construction va donc dans un dossier temporaire, et la comparaison porte sur son contenu
  // contre celui de `dist/`. **Une sonde doit être neutre vis-à-vis de ce qu'elle mesure.**
  //
  // ⚠️ ET LE TEMPORAIRE VIT HORS DE LA RACINE. Le poser sous `dist.tmp/` reviendrait à écrire dans
  // l'arbre que les voisins relèvent : ils dérivent leurs racines de mon manifeste et voient tout
  // ce qui bouge sous mes premiers segments. Ce garde cesserait de réécrire l'artefact et
  // continuerait de fermer leurs fenêtres.
  const cible = verifier ? mkdtempSync(join(tmpdir(), 'bpscript-construire-')) : join(RACINE, 'dist');
  try {
    if (!verifier && existsSync(cible)) rmSync(cible, { recursive: true });
    const total = await construireTout(portes, cible);
    for (const [nom, source] of copies) {
      writeFileSync(join(cible, nom.replace(/^dist\//, '')), readFileSync(join(RACINE, source), 'utf8'));
    }
    // ⛔ UN FICHIER VIDE DANS UNE PORTE EST UN DÉFAUT DE CONSTRUCTION, pas un fichier. Mesuré par Atlas
    // le 2026-09-02 : le regroupeur a émis un morceau de ZÉRO octet (un module qui ne faisait que
    // réexporter, importé pour son effet de bord), `dist/index.js` l'importait en première ligne, le
    // publieur ne l'a pas emporté, et le paquet publié ne s'importait plus — deux commits d'affilée,
    // sans qu'aucun garde ne rougisse ici. Le constructeur refuse donc d'émettre un fichier vide.
    // LA DESCRIPTION DES PORTES, DÉRIVÉE DU CODE — jamais écrite, donc jamais périmée.
    const types = deriverLesTypes(cible);
    const vides = Object.entries(contenuDe(cible)).filter(([, t]) => t.length === 0).map(([f]) => f);
    if (vides.length) {
      console.error(`[construire] ⛔ ${vides.length} fichier(s) VIDE(S) émis : ${vides.join(', ')} — un morceau `
        + `vide est un module importé pour son seul effet de bord ; importer ce qui fait l'effet, pas ce qui le réexporte.`);
      process.exit(1);
    }

    if (verifier) {
      // ⛔ LE TÉMOIN — le détecteur voit-il les trois familles quand elles sont là, et se tait-il
      // quand elles ne le sont pas ? Sans lui, une comparaison morte rend le même vert qu'un dossier
      // propre, et les trois morsures éprouvées ne prouvent rien.
      const t = ecartDe({ a: '1', b: '1' }, { a: '2', c: '1' });
      const rien = ecartDe({ a: '1' }, { a: '1' });
      if (t.derives.join() !== 'a' || t.absents.join() !== 'b' || t.enTrop.join() !== 'c'
          || rien.derives.length || rien.absents.length || rien.enTrop.length) {
        console.error('[construire] ⛔ TÉMOIN — le détecteur d\'écart ne voit plus ce qu\'il doit voir.');
        process.exit(1);
      }

      const attendu = contenuDe(cible);
      const enregistre = contenuDe(join(RACINE, 'dist'));
      const { noms, absents, enTrop, derives } = ecartDe(attendu, enregistre);
      if (!noms.length) { console.error('[construire] ⛔ ZÉRO fichier comparé — la construction n\'a rien émis.'); process.exit(1); }

      // ⛔ CE QUE LE JUGE N'A PAS ÉNUMÉRÉ, IL LE DIT — IL NE L'ÉCARTE PAS EN SILENCE.
      //
      // Clause posée au hub le 2026-09-05 : *une description que le garde ne peut pas LIRE est aussi
      // peu confrontée qu'une description qu'aucun garde ne lit.* Éprouvé ici par injection le jour
      // même : l'énumération rendue non récursive, une déclaration FAUSSE enregistrée sous `types/`,
      // ⇒ **VERT, code 0**. Rien dans la sortie ne distinguait ce vert d'un vert honnête, sauf un
      // compte de fichiers que personne ne lit — 26 au lieu de 51.
      //
      // ⚠️ ET LE REFUS SE POSE SUR LES DÉCLARATIONS, PAS SUR LES CIBLES PUBLIÉES — ma première
      // écriture visait celles-ci et l'injection ne l'a PAS fait mordre : les cibles vivent à la
      // RACINE de `dist/`, donc un juge non récursif les voit toutes. Ce qui échappe est exactement
      // ce qui est en profondeur. *Un garde se pose sur l'espace où le défaut peut vivre, jamais sur
      // celui où on l'a cherché.*
      //
      // Le compte vient de la dérivation elle-même, qui sait ce qu'elle a émis — deux instruments
      // écrits séparément, et un écart entre eux est un refus.
      const vuesEnProfondeur = noms.filter((n) => n.startsWith('types/')).length;
      if (vuesEnProfondeur < types.declarations) {
        console.error('[construire] ⛔ LE JUGE N\'A PAS ÉNUMÉRÉ CE QU\'IL DOIT JUGER.');
        console.error(`        ${types.declarations} déclaration(s) dérivée(s), ${vuesEnProfondeur} `
          + `atteinte(s) par la comparaison.`);
        console.error('        Une description que la comparaison n\'atteint pas est verte pour toujours.');
        process.exit(1);
      }
      if (absents.length || enTrop.length || derives.length) {
        console.error(`[construire] ⛔ L'ARTEFACT ENREGISTRÉ N'EST PAS CELUI QUE LA SOURCE PRODUIT.`);
        if (absents.length) console.error(`        ABSENT(S) de dist/ : ${absents.join(', ')}`);
        if (enTrop.length) console.error(`        ENREGISTRÉ(S) sans que la source les produise : ${enTrop.join(', ')}`);
        if (derives.length) console.error(`        A DÉRIVÉ de sa source : ${derives.join(', ')}`);
        console.error('        Régénérer par `npm run construire`, et le commiter avec la source.');
        process.exit(1);
      }
      console.log(`[construire] ✓ ${noms.length} fichier(s) de dist/ conformes à leur source, `
        + `dont ${construites.length} porte(s) · ${Math.round(total / 1024)} ko · artefact NON touché`);
      process.exit(0);
    }

    console.log(`[construire] ${portes.length} porte(s) — ${Object.keys(contenuDe(cible)).length} `
      + `fichier(s) dans dist/, ${Math.round(total / 1024)} ko · ${types.ponts.length} porte(s) DÉCRITE(S) `
      + `depuis ${types.declarations} déclaration(s) dérivée(s)`);
  } finally {
    if (verifier) rmSync(cible, { recursive: true, force: true });
  }
}
