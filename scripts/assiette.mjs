#!/usr/bin/env node
/**
 * L'ASSIETTE DU PAQUET — DÉRIVÉE DE LA CONSTRUCTION, JAMAIS TENUE À LA MAIN.
 *
 * Le champ `files` du manifeste déclare ce qui entre dans le paquet publié. **Il se dérive de la
 * FERMETURE TRANSITIVE des portes déclarées** — chaque porte, puis tout ce que ses modules importent
 * — et ce script le vérifie à chaque passe du portillon.
 *
 * ⛔ PAS DES PORTES, DE LA CONSTRUCTION. Décision de méthode de l'architecte, 2026-08-24, après une
 * mesure de Kairos : *cinq dépôts l'atteignent par un chemin DANS son paquet, contre neuf par son
 * nom ; un périmètre dérivé des portes SOUS-COUVRE.* ⇒ **Un périmètre trop étroit coûte un MENSONGE,
 * un périmètre trop large coûte un « modifié » réparable. On ne choisit pas la forme qui ment.**
 *
 * ⛔ ET UNE LISTE TENUE À LA MAIN PÉRIME SANS ROUGIR — c'est la classe que ce dépôt a retirée sept
 * fois le 2026-08-24 : sept copies de la liste des champs de fichier, trois comptes figés dans les
 * intitulés du lexeur, une carte du réel fausse depuis deux mois. **Une assiette écrite à la main
 * serait la huitième.**
 *
 * ⚠️ ET LE PAQUET EST AUTOPORTANT : aucun fichier de l'assiette ne compose un chemin qui SORT de la
 * racine. **Si l'un s'y met, sa cible n'entrera pas dans l'assiette et le paquet publiera un chemin
 * mort** — ce que le volet C refuse.
 *
 * ⛔ ET LE VOLET C A MORDU SUR LE MAUVAIS MOTIF, mesuré le 2026-08-31. Il s'annonçait « lit au
 * CHARGEMENT » et comptait des `readFileSync` **n'importe où dans le fichier**, corps de fonction
 * compris. Sur `test/compare_modal.cjs` il a rendu « 4 fichier(s) LISENT au chargement » là où il y
 * avait **un** fichier, **quatre** occurrences, et **zéro** lecture au chargement : le module se
 * charge à code 0 depuis un lieu où sa cible n'existe pas. J'ai relayé ce verdict comme un fait à
 * deux destinataires — un garde juste dans sa conclusion, faux dans ce qu'il affirmait mesurer.
 *
 * ⇒ **Le moment de la lecture n'est pas le fait qui compte, et il n'est pas décidable ici.** Ce qui
 * rend un chemin mort chez le consommateur est que sa CIBLE SOIT HORS DE L'ASSIETTE — à l'import
 * comme au premier appel. Le critère porte donc sur la cible, à tout étage : une composition qui
 * remonte plus haut que la profondeur du fichier sort de la racine du dépôt.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const RACINE = new URL('..', import.meta.url).pathname;

/** La fermeture transitive : chaque porte, puis tout ce que ses modules importent. */
export function assietteDerivee() {
  const paquet = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'));
  const portes = Object.values(paquet.exports || {})
    .map((v) => (typeof v === 'string' ? v : v && v.default))
    .filter((v) => v && /\.(js|mjs|cjs|ts)$/.test(v));
  const vus = new Set();
  const dedans = [];
  const marcher = (rel) => {
    if (vus.has(rel)) return;
    vus.add(rel);
    const abs = join(RACINE, rel.replace(/^\.\//, ''));
    if (!existsSync(abs)) return;
    dedans.push(rel.replace(/^\.\//, ''));
    const t = readFileSync(abs, 'utf8');
    for (const m of t.matchAll(/from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]/g)) {
      marcher('./' + relative(RACINE, join(dirname(abs), m[1] || m[2])));
    }
  };
  for (const p of portes) marcher(p);
  return { portes: portes.length, fichiers: dedans.sort() };
}

/**
 * La plus haute remontée qu'un texte compose, en nombre de segments `..`.
 *
 * Deux graphies portent le même geste et se comptent pareil — la liste d'arguments
 * (`resolve(__dirname, '..', '..', 'x')`) et la chaîne (`new URL('../../x', …)`).
 */
export function remonteeMaximale(texte) {
  let max = 0;
  for (const m of texte.matchAll(/(?:['"]\.\.['"]\s*,\s*)*['"]\.\.['"]/g)) {
    max = Math.max(max, (m[0].match(/\.\./g) || []).length);
  }
  for (const m of texte.matchAll(/['"]((?:\.\.\/)+)/g)) {
    max = Math.max(max, (m[1].match(/\.\./g) || []).length);
  }
  return max;
}

/**
 * Les fichiers de l'assiette dont un chemin SORT de la racine — leur cible ne peut pas y entrer.
 *
 * La profondeur du fichier borne ce qu'il peut remonter sans sortir : `src/transpiler/x.js` remonte
 * deux crans et reste chez lui, `test/x.cjs` un seul. Au-delà, la cible appartient à un autre dépôt.
 */
export function ciblesHorsAssiette(fichiers) {
  const out = [];
  for (const f of fichiers) {
    const t = readFileSync(join(RACINE, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    const profondeur = f.split('/').length - 1;
    const remontee = remonteeMaximale(t);
    if (remontee > profondeur) out.push(`${f} → remonte ${remontee} cran(s) pour une profondeur de ${profondeur}`);
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('assiette.mjs')) {
  const { portes, fichiers } = assietteDerivee();
  const chemin = join(RACINE, 'package.json');
  const paquet = JSON.parse(readFileSync(chemin, 'utf8'));
  const declare = [...(paquet.files || [])].sort();

  if (process.argv.includes('--verifier')) {
    const enTrop = declare.filter((f) => !fichiers.includes(f));
    const manquants = fichiers.filter((f) => !declare.includes(f));
    if (!portes) { console.error('[assiette] ⛔ ZÉRO porte déclarée — le calcul n\'a rien examiné.'); process.exit(1); }
    if (enTrop.length || manquants.length) {
      console.error(`[assiette] ⛔ LE CHAMP \`files\` NE CORRESPOND PAS À LA CONSTRUCTION.`);
      if (manquants.length) console.error(`        MANQUENT (le paquet publierait un chemin mort) : ${manquants.join(', ')}`);
      if (enTrop.length) console.error(`        EN TROP (le paquet embarque ce qu'aucune porte n'ouvre) : ${enTrop.join(', ')}`);
      console.error('        Régénérer par `npm run assiette`.');
      process.exit(1);
    }
    if (!fichiers.length) { console.error('[assiette] ⛔ ZÉRO fichier examiné — le volet C n\'a rien mesuré.'); process.exit(1); }

    // ⛔ LE TÉMOIN — le détecteur voit-il une cible hors racine quand il y en a une ? Sans lui, un
    // détecteur mort et une assiette propre rendent la MÊME sortie. Et son complément : la remontée
    // qui reste chez elle ne doit rien lever, sinon le garde refuserait tout le dépôt.
    if (remonteeMaximale("resolve(__dirname, '..', '..', 'voisin')") !== 2
        || remonteeMaximale("new URL('../../voisin', import.meta.url)") !== 2
        || remonteeMaximale("new URL('..', import.meta.url)") !== 1) {
      console.error('[assiette] ⛔ TÉMOIN — le détecteur de remontée ne voit plus ce qu\'il doit voir.');
      process.exit(1);
    }

    const hors = ciblesHorsAssiette(fichiers);
    if (hors.length) {
      console.error(`[assiette] ⛔ ${hors.length} fichier(s) de l'assiette composent un chemin HORS de la racine :`);
      for (const x of hors) console.error(`        ${x}`);
      console.error('        Leur cible ne peut pas entrer dans l\'assiette : le paquet publierait un chemin mort.');
      process.exit(1);
    }
    console.log(`[assiette] ✓ ${fichiers.length} fichier(s) depuis ${portes} porte(s) · paquet autoportant`);
    process.exit(0);
  }

  paquet.files = fichiers;
  writeFileSync(chemin, `${JSON.stringify(paquet, null, 2)}\n`);
  console.log(`[assiette] écrite — ${fichiers.length} fichier(s) depuis ${portes} porte(s)`);
}
