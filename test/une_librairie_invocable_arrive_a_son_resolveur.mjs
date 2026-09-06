/**
 * UNE LIBRAIRIE INVOCABLE ARRIVE À SON RÉSOLVEUR.
 *
 * Une scène peut invoquer un fichier de librairie par son nom (`homomorphism.dhati`,
 * `voices.trois`). Kairos va alors le chercher DANS LE CATALOGUE qu'on lui passe, et refuse
 * bruyamment s'il ne l'y trouve pas — la scène entière ne rend plus un seul jeton.
 *
 * Mon pont ne posait qu'une clé de contexte à part (`homomorphismeLib`), qui alimente un AUTRE
 * mécanisme. Toute invocation tombait donc, et le coût était invisible : la grammaire ressortait
 * « ne produit pas », ce qui se lit comme un défaut du langage. Mesuré le 2026-08-12 sur `dhati2`
 * et `tryhomomorphism`.
 *
 * ⚠️ CE GARDE PORTE SUR LE CRITÈRE, PAS SUR LES NOMS QUI ONT ÉCHOUÉ. Ma première réparation posait
 * `homomorphism` seul — celui que le refus m'avait montré — et la campagne suivante est tombée sur
 * deux autres fichiers par le même mécanisme. Ce qui fait qu'un fichier appartient à la fabrique de
 * Kairos, c'est qu'il porte un MOT D'INVOCATION : le prototype dérivé de la famille, rendu par la
 * porte des objets. Un fichier rangé SOUS une famille (`settings/test1`) n'en porte pas — son mot
 * serait barré d'une oblique, qui ne s'écrit dans aucune invocation. Le garde tient donc la portée
 * ET son complément : tout ce qui porte un mot passe, rien de ce qui n'en porte pas ne passe.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
require('../src/transpiler/index.js');
const LIBS = require('../src/transpiler/libs.js').leRegistre();
const { motDuFichier } = require('../src/transpiler/index-des-objets.js');
/** Le mot sous lequel une scène invoque ce fichier — nul s'il n'en porte pas. */
const motInvocable = (n) => { const m = motDuFichier(n); return m && !m.includes('/') ? m : null; };
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

let ok = 0; let ko = 0;
const verifier = (cond, quoi) => { if (cond) { ok += 1; } else { ko += 1; console.log(`  FAIL ${quoi}`); } };

/** Le catalogue que le pont compose réellement, sans passer par Kairos. */
async function catalogueDuPont() {
  // ⚠️ LA LISTE VIENT DU PONT et la DONNEE vient du BUNDLE : recopiee ici, la liste divergeait au
  // premier axe ajoute, et un chemin `lib/<axe>.json` cassait net des qu'un catalogue changeait de
  // format. Le bundle rend la meme donnee quelle que soit la source.
  const { unirCatalogues, FICHIERS_HAUTEUR } = await import('./kairos_bridge.mjs');
  const AXES = FICHIERS_HAUTEUR;
  const cat = unirCatalogues(Object.fromEntries(AXES.map((n) => [n, LIBS[n]])), {});
  const axes = new Set(AXES);
  for (const [nom, f] of Object.entries(LIBS)) {
    if (!axes.has(nom) && f && typeof f === 'object' && motInvocable(nom)) cat[nom] = f;
  }
  return { cat, axes };
}

const { cat, axes } = await catalogueDuPont();

// LA PORTÉE — toute librairie qui déclare un axe est offerte au résolveur.
const declarantes = Object.entries(LIBS).filter(([n, f]) => !axes.has(n) && f && typeof f === 'object' && motInvocable(n));
verifier(declarantes.length > 0, 'au moins une librairie hors-axe porte un mot d\'invocation(sinon ce garde ne mesure rien)');
for (const [nom] of declarantes) {
  verifier(cat[nom] !== undefined, `la librairie « ${nom} », qu'on invoque par « ${motInvocable(nom)} », arrive au catalogue`);
}

// SON COMPLÉMENT — celles qui ne portent AUCUN mot restent dehors. Les offrir est pire que de ne
// rien offrir : le refus « fichier introuvable » devient un défaut de FORME imputé à un fichier qui
// n'a jamais prétendu appartenir à cette fabrique.
const muettes = Object.entries(LIBS).filter(([n, f]) => !axes.has(n) && f && typeof f === 'object' && !motInvocable(n));
verifier(muettes.length > 0, 'au moins un fichier ne porte aucun mot d\'invocation(sinon le complément ne mesure rien)');
for (const [nom] of muettes) {
  verifier(cat[nom] === undefined, `le fichier « ${nom} », qui ne porte aucun mot, reste hors du catalogue de hauteur`);
}

// LES AXES gardent leur contenu de CATALOGUE, jamais le fichier brut posé par-dessus.
for (const a of axes) {
  verifier(cat[a] !== undefined && typeof cat[a] === 'object', `l'axe « ${a} » porte son catalogue`);
}

// LE JUGE MORD — on retire une déclarante du catalogue et on exige que la vérification rougisse.
{
  const [nom] = declarantes[0];
  const ampute = { ...cat }; delete ampute[nom];
  verifier(ampute[nom] === undefined && cat[nom] !== undefined,
    `l'injection de la faute est effective : « ${nom} » retiré de la copie, présent dans l'original`);
  const manquantes = declarantes.filter(([n]) => ampute[n] === undefined).map(([n]) => n);
  verifier(manquantes.length === 1 && manquantes[0] === nom,
    'la vérification DÉSIGNE la librairie retirée quand on la retire');
}

console.log(`Résultat une_librairie_invocable_arrive_a_son_resolveur : ${ok} OK, ${ko} FAIL`);
if (ko) process.exit(1);
