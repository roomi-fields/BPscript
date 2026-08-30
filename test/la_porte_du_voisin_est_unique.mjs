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
import { VOISINS_A_ARTEFACT } from './artefact_voisin.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

// ⛔ LA LISTE DES VOISINS NE S'ÉCRIT PLUS ICI : elle est LUE de la porte. Elle a été en dur jusqu'au
// 2026-08-30, avec UNE ligne — `BPx` — pendant que quatre sites nommaient `kairos/dist` et
// `kronos/dist` en absolu. Le garde était vert, et il l'était honnêtement : il ne pouvait refuser
// que ce qu'on lui avait donné. ⇒ Un garde écrit pour l'endroit où le défaut s'est montré ne couvre
// pas l'espace où il peut vivre ; celui-ci couvre maintenant tout ce que la porte déclare, et un
// voisin qui s'y ajoute est gardé sans qu'une ligne bouge ici.
const PORTE = 'test/artefact_voisin.mjs';
const PORTES = VOISINS_A_ARTEFACT.map((voisin) => ({
  voisin,
  motif: new RegExp(`${voisin}[/'"\`\\\\ ,]+[^\\n]{0,40}\\bdist\\b`),
  porte: PORTE,
}));

// ⛔ PLUS AUCUNE EXEMPTION, ET C'EST UNE MESURE. `empreinte_voisins` en avait une parce qu'il
// nommait les trois chemins : il les DÉRIVE maintenant de la porte, donc il n'a plus rien à
// exempter. Une exemption qui survit à sa cause est un trou qui ne rougit jamais.
const EXEMPTES = new Set([]);

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
    rel !== PORTE && /importerArtefact|cheminArtefact|VOISINS_A_ARTEFACT/.test(readFileSync(abs, 'utf8')));
  // ⛔ CE SEUIL ÉTAIT À 8 POUR UN COMPTE DE 10 — deux bancs pouvaient cesser de passer par la porte
  // sans un mot, sous un message qui dit « ne prouve plus rien ». Le propos, écrit deux lignes plus
  // haut, est la NON-NULLITÉ : « il serait vert sur un dépôt qui a cessé de lire le voisin ».
  // Un seuil calé sur le compte du jour ne tient ni ce propos ni l'inventaire qu'il verrouille — il
  // ne mord qu'au troisième retrait, avec un message qui parle du premier.
  ok(usagers.length > 0,
    `AUCUN banc ne passe par la porte — le compte de sites hors de la porte ne prouve plus rien : il `
    + `serait vert sur un dépôt qui a cessé de lire le voisin.`);
  console.log(`[porte voisin] ${fichiers.length} fichiers balayés · ${PORTES.length} voisin(s) gardé(s) : `
    + `${VOISINS_A_ARTEFACT.join(', ')} · ${usagers.length} banc(s) passent par la porte`);
}

if (echecs.length) {
  console.error(`[porte voisin] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[porte voisin] ${passe} PASS / 0 FAIL`);
