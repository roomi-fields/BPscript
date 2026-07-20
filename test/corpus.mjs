/**
 * OÙ VIT LE CORPUS DES 113 — déclaration UNIQUE, et le seul endroit qui le sait.
 *
 * POURQUOI CE FICHIER EXISTE. Le corpus a vécu en plusieurs exemplaires possédés par plusieurs
 * dépôts, sans propriétaire déclaré. C'est la cause DIRECTE de l'incident `vina` du 2026-07-19 :
 * `scenes/vina.bps` et `test/grammars/vina/scene.bps` ont divergé sous le même nom pendant des
 * jours, et deux agents de bonne foi se sont contredits parce qu'ils ne lisaient pas le même
 * fichier. Aucune rigueur individuelle ne désarme ça : une vérification ne peut pas attraper ce
 * qu'elle ne regarde pas.
 *
 * La décision `hub/decisions/2026-07-20-bibliotheque-kanopi-source-officielle-des-113.md`
 * (RATIFIÉE) donne au corpus UN propriétaire : la bibliothèque publique de Kanopi. Ce dépôt-ci
 * n'en possède plus de copie — il l'EMPRUNTE, et par ce fichier seulement.
 *
 * ⚠️ RÈGLE. Si tu as besoin d'une grammaire ou d'une scène, passe par ici. Ne recompose JAMAIS le
 * chemin à la main dans un test : douze chemins recopiés, c'est douze occasions de diverger, et
 * c'est précisément ce qu'on vient de payer. Le garde `corpus_unique.mjs` échoue si une copie
 * réapparaît dans ce dépôt.
 *
 * NB : les instantanés sous `test/grammars/<nom>/snapshots/` NE SONT PAS le corpus. Ce sont des oracles de
 * mesure produits ici, et ils restent ici (cf. test/README.md).
 */
import path from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const ICI = path.dirname(new URL(import.meta.url).pathname);

/** Racine de la bibliothèque Kanopi. Surchargeable pour mesurer sur une révision donnée. */
export const LIBRARY = process.env.KANOPI_LIBRARY
  ? path.resolve(process.env.KANOPI_LIBRARY)
  : path.resolve(ICI, '..', '..', 'kanopi', 'packages', 'library');

/** Les deux répertoires fixés par Romain (décision du 2026-07-20). */
export const DIR_GR = path.join(LIBRARY, 'scenes', 'BP3-tests');
export const DIR_BPS = path.join(LIBRARY, 'scenes', 'BPScript-tests');

/** Chemin de la version BPScript d'une grammaire. Existe pour 96 des 113. */
export const bpsPath = (nom) => path.join(DIR_BPS, `${nom}.bps`);
/** Chemin de la version BP3 d'une grammaire. Existe pour les 113. */
export const grPath = (nom) => path.join(DIR_GR, `${nom}.gr`);

export const aBps = (nom) => existsSync(bpsPath(nom));
export const aGr = (nom) => existsSync(grPath(nom));

export const lireBps = (nom) => readFileSync(bpsPath(nom), 'utf-8');
export const lireGr = (nom) => readFileSync(grPath(nom), 'utf-8');

/** Les noms qui ont une version BPScript, triés. */
export function nomsBps() {
  if (!existsSync(DIR_BPS)) return [];
  return readdirSync(DIR_BPS).filter((f) => f.endsWith('.bps')).map((f) => f.slice(0, -4)).sort();
}

/**
 * Fail-loud si la bibliothèque est absente. Un corpus introuvable doit CRIER : une mesure qui
 * tourne sur zéro scène sortirait au vert en ne prouvant rien — le pire des faux verts.
 */
export function exigerCorpus() {
  if (!existsSync(DIR_BPS) || !existsSync(DIR_GR)) {
    throw new Error(
      `Corpus introuvable sous ${LIBRARY}. Il appartient à la bibliothèque Kanopi ` +
      `(décision 2026-07-20). Cloner kanopi à côté de ce dépôt, ou pointer KANOPI_LIBRARY.`
    );
  }
}
