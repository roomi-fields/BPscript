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
 * ⚠️ ET LE PAQUET EST AUTOPORTANT, MESURÉ : aucun des fichiers de l'assiette ne lit un fichier au
 * chargement. **Si l'un s'y met, sa lecture n'entrera pas dans l'assiette et le paquet publiera un
 * chemin mort** — ce que le volet C refuse.
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

/** Les fichiers de l'assiette qui LISENT un fichier au chargement — leur cible doit y entrer aussi. */
export function lecturesAuChargement(fichiers) {
  const out = [];
  for (const f of fichiers) {
    const t = readFileSync(join(RACINE, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    for (const m of t.matchAll(/readFileSync\s*\(([^)]{0,90})/g)) {
      out.push(`${f} → ${m[1].replace(/\s+/g, ' ').slice(0, 70)}`);
    }
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
    const lect = lecturesAuChargement(fichiers);
    if (lect.length) {
      console.error(`[assiette] ⛔ ${lect.length} fichier(s) de l'assiette LISENT au chargement : ${lect.join(' · ')}`);
      console.error('        Leur cible doit entrer dans l\'assiette, sinon le paquet publie un chemin mort.');
      process.exit(1);
    }
    console.log(`[assiette] ✓ ${fichiers.length} fichier(s) depuis ${portes} porte(s) · paquet autoportant`);
    process.exit(0);
  }

  paquet.files = fichiers;
  writeFileSync(chemin, `${JSON.stringify(paquet, null, 2)}\n`);
  console.log(`[assiette] écrite — ${fichiers.length} fichier(s) depuis ${portes} porte(s)`);
}
