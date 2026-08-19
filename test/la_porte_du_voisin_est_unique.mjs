#!/usr/bin/env node
/**
 * GARDE — UN SEUL FICHIER NOMME L'ARTEFACT CONSTRUIT D'UN VOISIN.
 *
 * ⛔ CE QUI A COÛTÉ CE GARDE, ET C'EST DE MOI, DEUX FOIS. Le 2026-08-14 j'ai écrit `bpx_dist.mjs`,
 * la porte qui échoue en NOMMANT le voisin quand son artefact manque — il disparaît le temps qu'il
 * reconstruit, et mon portillon tombait alors sur un `ERR_MODULE_NOT_FOUND` brut.
 *
 * ⚠️ JE N'AI PAS VÉRIFIÉ QUE LA PORTE ÉTAIT LE SEUL CHEMIN. Trois bancs gardaient le leur, dont
 * `ast_conformance`, qui est une ÉTAPE DU PORTILLON. Les 17 et 19 août j'ai rapporté à l'architecte
 * une « passe instable, non reproduite, dont le nom du garde est perdu » — DEUX FOIS. C'était ce
 * fichier-là, et il aurait dit sa cause en une ligne s'il était passé par la porte.
 *
 * UNE PORTE QUI N'EST PAS L'UNIQUE ENTRÉE N'EST PAS UNE PORTE. Fermer un espace, ce n'est pas
 * écrire la fermeture : c'est mesurer qu'aucun mur n'est resté ouvert à côté. Ce garde est cette
 * mesure, et il la refait à chaque passe.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

// LES ARTEFACTS CONSTRUITS DE MES VOISINS, chacun avec SA porte unique. Une ligne s'ajoute ici le
// jour où je consomme le produit de construction d'un dépôt de plus.
const PORTES = [
  { voisin: 'BPx', motif: /BPx[/'"`\\ ,]+[^\n]{0,40}\bdist\b/, porte: 'test/bpx_dist.mjs' },
];

// ⛔ LES EXEMPTIONS SONT NOMMÉES ET MOTIVÉES, jamais un motif large. `empreinte_voisins` MESURE ces
// artefacts : nommer le chemin est sa raison d'être, et l'exempter par un motif aurait exempté du
// même coup tout fichier au nom voisin.
const EXEMPTES = new Set([
  'test/empreinte_voisins.mjs',   // il prend l'empreinte des artefacts : il DOIT les nommer
]);

const fichiers = [];
const marcher = (d, rel = '') => {
  for (const x of readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'build'].includes(x.name) || x.name.startsWith('.')) continue;
    const q = join(d, x.name);
    const r = rel ? `${rel}/${x.name}` : x.name;
    if (statSync(q).isDirectory()) { marcher(q, r); continue; }
    if (/\.(m?js|cjs|ts|sh)$/.test(x.name)) fichiers.push([r, q]);
  }
};
marcher(RACINE);

for (const { voisin, motif, porte } of PORTES) {
  const nomme = [];
  for (const [rel, abs] of fichiers) {
    if (rel === porte || EXEMPTES.has(rel)) continue;
    const lignes = readFileSync(abs, 'utf8').split('\n');
    lignes.forEach((l, i) => {
      // la PROSE a le droit de parler du voisin ; c'est le CODE qui doit passer par la porte
      const t = l.trimStart();
      if (t.startsWith('*') || t.startsWith('//') || t.startsWith('#')) return;
      if (motif.test(l)) nomme.push(`${rel}:${i + 1}  ${l.trim().slice(0, 90)}`);
    });
  }
  ok(nomme.length === 0,
    `${nomme.length} site(s) nomment l'artefact construit de ${voisin} hors de sa porte `
    + `\`${porte}\` : ${nomme.slice(0, 4).join(' · ')}. Un chemin à soi jette une erreur brute `
    + `quand le voisin reconstruit, et son rouge se lit comme une panne d'ici — c'est ainsi qu'une `
    + `intermittence s'est racontée deux fois sans jamais être nommée.`);
}

// ⛔ ET LA PORTE DOIT ÊTRE UTILISÉE, sinon « aucun site hors de la porte » se vérifierait aussi
// bien sur un dépôt qui ne consomme plus rien du voisin.
{
  const usagers = fichiers.filter(([rel, abs]) =>
    rel !== 'test/bpx_dist.mjs' && /importerBPx|BPX_DIST/.test(readFileSync(abs, 'utf8')));
  ok(usagers.length >= 8,
    `seuls ${usagers.length} banc(s) passent par la porte — sous ce seuil, le compte de sites hors `
    + `de la porte ne prouve plus rien : il serait vert sur un dépôt qui a cessé de lire le voisin.`);
  console.log(`[porte voisin] ${fichiers.length} fichiers balayés · ${usagers.length} banc(s) passent par la porte`);
}

if (echecs.length) {
  console.error(`[porte voisin] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[porte voisin] ${passe} PASS / 0 FAIL`);
