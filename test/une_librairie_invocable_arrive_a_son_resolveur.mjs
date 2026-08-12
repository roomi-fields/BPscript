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
 * Kairos, c'est qu'il DÉCLARE l'axe qu'il alimente. Le garde tient donc la portée ET son
 * complément : tout ce qui déclare passe, rien de ce qui ne déclare pas ne passe.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { LIBS } = require('../src/transpiler/libs-data.js');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

let ok = 0; let ko = 0;
const verifier = (cond, quoi) => { if (cond) { ok += 1; } else { ko += 1; console.log(`  FAIL ${quoi}`); } };

/** Le catalogue que le pont compose réellement, sans passer par Kairos. */
async function catalogueDuPont() {
  const { unirCatalogues } = await import('./kairos_bridge.mjs');
  const AXES = ['alphabets', 'tunings', 'temperaments', 'scales', 'octaves', 'test_alphabets'];
  const lire = (n) => JSON.parse(readFileSync(path.join(ROOT, 'lib', `${n}.json`), 'utf-8'));
  const cat = unirCatalogues(Object.fromEntries(AXES.map((n) => [n, lire(n)])), {});
  const axes = new Set(AXES);
  for (const [nom, f] of Object.entries(LIBS)) {
    if (!axes.has(nom) && f && typeof f === 'object' && f.resolves) cat[nom] = f;
  }
  return { cat, axes };
}

const { cat, axes } = await catalogueDuPont();

// LA PORTÉE — toute librairie qui déclare un axe est offerte au résolveur.
const declarantes = Object.entries(LIBS).filter(([n, f]) => !axes.has(n) && f && typeof f === 'object' && f.resolves);
verifier(declarantes.length > 0, 'au moins une librairie hors-axe déclare l\'axe qu\'elle alimente (sinon ce garde ne mesure rien)');
for (const [nom] of declarantes) {
  verifier(cat[nom] !== undefined, `la librairie « ${nom} », qui déclare résoudre « ${LIBS[nom].resolves} », arrive au catalogue`);
}

// SON COMPLÉMENT — celles qui ne déclarent RIEN restent dehors. Les offrir est pire que de ne rien
// offrir : le refus « fichier introuvable » devient « champ resolves ABSENT », donc un défaut de
// FORME imputé à une librairie qui n'a jamais prétendu appartenir à cette fabrique.
const muettes = Object.entries(LIBS).filter(([n, f]) => !axes.has(n) && f && typeof f === 'object' && !f.resolves);
verifier(muettes.length > 0, 'au moins une librairie ne déclare aucun axe (sinon le complément ne mesure rien)');
for (const [nom] of muettes) {
  verifier(cat[nom] === undefined, `la librairie « ${nom} », qui ne déclare aucun axe, reste hors du catalogue de hauteur`);
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
