#!/usr/bin/env node
/**
 * PUBLIER — fixer un état de ce dépôt, le nommer, et le rendre atteignable hors de mon arbre.
 *
 * Décisions de Romain, 2026-08-24 : `un-depot-ne-consomme-que-le-paquet-publie-d-un-voisin` et
 * `publier-c-est-fixer-un-etat-et-le-nommer`. Un consommateur qui lit mon arbre de travail exécute
 * ce que je n'ai pas enregistré, et **il ne peut pas nommer ce qu'il exécute**.
 *
 * ⛔ MON PAQUET EST UNE COPIE, ET C'EST MESURÉ. Mes quatre artefacts dérivés — `libs-data.js`,
 * `libs-data.d.ts`, `syntaxe-data.js`, `gabarits-data.js` — sont générés PUIS ENREGISTRÉS, et le
 * portillon refuse un artefact périmé. La construction n'a donc rien à générer : elle copie
 * l'assiette et grave l'empreinte. Publier n'améliore pas le contenu — **une copie datée et nommée
 * vaut mieux qu'un original mouvant**.
 *
 * ⛔ L'INSTANT EST UN FAIT DONNÉ, JAMAIS LU ICI — et c'est le seul écart avec le patron. Chez
 * runtime-OSC la gravure appelle l'horloge, donc deux constructions diffèrent toujours par leur
 * date, et le banc de déterminisme doit EXCLURE ce champ de sa comparaison. **Choisir un champ à
 * exclure, c'est choisir ce qu'on ne verra pas.** L'instant reçu se fixe dans le banc, et la
 * comparaison porte alors sur TOUT, octet pour octet, sans une seule exclusion.
 *
 * ⛔ LA BASCULE EST UN SEUL RENOMMAGE, SUR UN LIEN. Renommer un dossier sur un dossier existant
 * échoue, donc une bascule par dossier passe par deux renommages — et entre les deux, le paquet
 * n'existe pas. Un lien se remplace en un renommage, qui n'a pas d'instant d'absence. Le paquet
 * réel, lui, est immuable : chaque commit a le sien, et aucun n'est jamais écrasé.
 *
 * ⛔ ET LA GRAVURE SE VÉRIFIE DEUX FOIS, parce qu'une réécriture qui vise à côté est SILENCIEUSE.
 * AVANT : la ligne du régime source est présente dans le module émis, sinon le paquet annoncerait
 * `source-vive` en production. APRÈS : le module relu porte le commit et ne porte plus cette ligne.
 * **La vérification porte sur LA LIGNE, jamais sur le fichier entier**, dont les commentaires citent
 * le mot et feraient rougir un paquet correct.
 *
 * ⛔ AUCUNE DÉCISION NE VIT ICI. Les refus sont dans `publication-refus.mjs`, en fonctions pures qui
 * REÇOIVENT les faits — sans quoi les exercer demanderait de fabriquer un dépôt sale, un artefact
 * déjà publié et un lien mort. Ce script mesure, leur passe ce qu'il a mesuré, et agit.
 */
import { readFile, writeFile, mkdir, rm, cp, symlink, rename, readdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { assietteDerivee } from './assiette.mjs';
import { refusAvantConstruction, refusApresConstruction } from './publication-refus.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PAQUETS = path.join(os.homedir(), 'dev/bp/.paquets');

/** La ligne exacte que la gravure remplace. Le module la porte une seule fois, hors commentaires. */
export const LIGNE_SOURCE = "export const EMPREINTE = { regime: 'source-vive' };";

/** Le module gravé, relatif à la racine du paquet. */
export const MODULE_EMPREINTE = 'src/empreinte.js';

const git = (...args) => new Promise((ok, ko) =>
  execFile('git', args, { cwd: RACINE }, (err, out) => (err ? ko(err) : ok(out.trim()))));

const existe = (p) => stat(p).then(() => true, () => false);

/** L'empreinte gravée dans un paquet déjà là, ou `null` s'il n'y en a pas. */
export async function lireEmpreinte(dossier) {
  try {
    const t = await readFile(path.join(dossier, MODULE_EMPREINTE), 'utf8');
    const m = t.match(/^export const EMPREINTE = ([\s\S]*?);$/m);
    return m ? JSON.parse(m[1]) : null;
  } catch {
    return null;
  }
}

/**
 * TOUS LES COMMITS DÉJÀ PUBLIÉS SOUS MON NOM, lus dans les empreintes gravées.
 *
 * ⚠️ LA LISTE SE LIT, ELLE NE SE DÉDUIT PAS DU NOM DU DOSSIER : le nom porte l'ABRÉGÉ, l'empreinte
 * porte le commit entier, et comparer un abrégé à un commit entier ne mord jamais.
 */
async function commitsPublies(nom) {
  let entrees;
  try {
    entrees = await readdir(PAQUETS, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entrees) {
    if (!e.isDirectory() || !e.name.startsWith(`${nom}-`)) continue;
    const emp = await lireEmpreinte(path.join(PAQUETS, e.name));
    if (emp?.commit) out.push(emp.commit);
  }
  return out;
}

/** La bascule : un lien se remplace en UN renommage, sans instant d'absence. */
async function basculer(cible, lien) {
  const provisoire = `${lien}.${process.pid}`;
  await rm(provisoire, { force: true });
  await symlink(cible, provisoire);
  await rename(provisoire, lien);
}

/** Compte les fichiers réellement émis sous une racine — témoin d'assiette, jamais déduit. */
async function compter(dir) {
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? await compter(path.join(dir, e.name)) : 1;
  }
  return n;
}

/**
 * CONSTRUIT le paquet dans `chantier` et y GRAVE l'empreinte. Rend l'empreinte gravée.
 *
 * ⛔ SEULE AUTORITÉ DE CONSTRUCTION. Le banc de déterminisme appelle CETTE fonction — un banc qui
 * referait la copie et la gravure de son côté mesurerait sa propre imitation, et il resterait vert
 * le jour où la vraie construction changerait. C'est la classe que ce dépôt a payée sept fois le
 * 2026-08-24, sur sept copies de la même liste de champs.
 */
export async function construire(chantier, { commit, abrege, version, propre, entrant, instant }) {
  await rm(chantier, { recursive: true, force: true });
  await mkdir(chantier, { recursive: true });

  for (const e of entrant) {
    await mkdir(path.join(chantier, path.dirname(e)), { recursive: true });
    await cp(path.join(RACINE, e), path.join(chantier, e), { recursive: true });
  }
  await cp(path.join(RACINE, 'package.json'), path.join(chantier, 'package.json'));

  // ── LA GRAVURE, ET SES DEUX LECTURES ────────────────────────────────────────────────────────
  const emis = path.join(chantier, MODULE_EMPREINTE);
  const avant = await readFile(emis, 'utf8');
  if (!avant.includes(LIGNE_SOURCE)) {
    throw new Error(`GRAVURE À CÔTÉ : la ligne du régime source est absente de ${MODULE_EMPREINTE}. `
      + `Le paquet aurait annoncé « source-vive » en production, et personne ne l'aurait vu.`);
  }
  const empreinte = {
    regime: 'paquet',
    commit,
    abrege,
    version,
    // Rapporte, ne décide pas : la publication a déjà refusé sur une assiette sale, donc ce champ
    // vaut toujours `true` quand il est gravé. Il reste parce qu'un consommateur le LIT.
    propre,
    construitLe: instant,
    fichiers: await compter(chantier),
  };
  await writeFile(emis, avant.replace(LIGNE_SOURCE,
    `export const EMPREINTE = ${JSON.stringify(empreinte, null, 2)};`));

  const relu = await readFile(emis, 'utf8');
  if (relu.includes(LIGNE_SOURCE) || !relu.includes(commit)) {
    throw new Error('GRAVURE NON CONSTATÉE : le module relu porte encore le régime source, ou ne '
      + 'porte pas le commit. Un changement de graphie laisserait le témoin en place, et il mentirait.');
  }
  return empreinte;
}

/** Publie, ou rebascule le lien si le commit courant est déjà publié. */
export async function publier({ bruyant = true, instant = new Date().toLocaleString('sv-SE') } = {}) {
  const pkg = JSON.parse(await readFile(path.join(RACINE, 'package.json'), 'utf8'));
  const entrant = pkg.files || [];
  const commit = await git('rev-parse', 'HEAD');
  const abrege = await git('rev-parse', '--short', 'HEAD');
  const cible = path.join(PAQUETS, `${pkg.name}-${abrege}`);
  const chantier = `${cible}.chantier`;
  const lien = path.join(PAQUETS, pkg.name);

  // ── LES FAITS D'ABORD, LES REFUS ENSUITE, L'EFFET EN DERNIER — jamais mêlés ──────────────────
  const { fichiers: derivee } = assietteDerivee();
  const sale = entrant.length ? await git('status', '--porcelain', '--', ...entrant) : '';
  const modifies = sale ? sale.split('\n').map((l) => l.slice(3).trim()).filter(Boolean) : [];
  const cibleExiste = await existe(cible);
  const deja = cibleExiste ? await lireEmpreinte(cible) : null;

  // ⛔ LA BRANCHE IDEMPOTENTE SE LIT AVANT LES REFUS, et elle n'en est pas un : un commit déjà
  // publié SOUS SON NOM ne se reconstruit pas — c'est le LIEN qui se rebascule.
  await mkdir(PAQUETS, { recursive: true });
  if (deja?.commit === commit) {
    await basculer(cible, lien);
    if (bruyant) console.log(`[publier] ✓ ${pkg.name} ${abrege} — déjà publié, inchangé ; lien rebasculé.`);
    return { ...deja, cible, lien };
  }

  // ⚠️ `publies` EST LA VRAIE LISTE, lue sur le disque. La passer vide rendrait le refus incapable
  // de mordre : un filtre qui ne filtre plus rien a la même forme qu'un filtre qui n'a rien à
  // filtrer. Il mord quand mon commit est publié sous un AUTRE nom — l'abrégé change de longueur.
  const avant = refusAvantConstruction({
    assiette: { derivee, declaree: entrant },
    arbre: { modifies, assiette: entrant },
    commit: { commit, publies: await commitsPublies(pkg.name) },
    nom: { nom: path.basename(cible), cibleExiste, commitDuNom: deja?.commit ?? null, commit },
  });
  if (avant.length) throw new Error(avant.join('\n  · '));

  const empreinte = await construire(chantier, {
    commit, abrege, version: pkg.version, propre: true, entrant, instant,
  });
  await rename(chantier, cible);
  await basculer(cible, lien);

  // ── LES DEUX REFUS QUI SE POSENT SUR L'ARTEFACT, une fois qu'il existe ───────────────────────
  const apres = refusApresConstruction({
    empreinte: { empreinte: await lireEmpreinte(cible), commitAttendu: commit },
    lien: { lien, cible, cibleExiste: await existe(cible), racinePaquets: PAQUETS },
  });
  if (apres.length) throw new Error(apres.join('\n  · '));

  if (bruyant) {
    console.log(`[publier] ✓ ${pkg.name} ${abrege} — ${empreinte.fichiers} fichier(s), assiette propre.`);
    console.log(`[publier]   ${lien} → ${path.basename(cible)}`);
  }
  return { ...empreinte, cible, lien };
}

if (process.argv[1] && process.argv[1].endsWith('publier.mjs')) {
  try {
    await publier();
  } catch (e) {
    console.error(`\n[publier] ✗ ${e.message}\n`);
    process.exit(1);
  }
}
