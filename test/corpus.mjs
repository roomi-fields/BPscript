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

/**
 * Racine de la bibliothèque Kanopi. Surchargeable pour mesurer sur une révision donnée.
 *
 * ⛔ ET C'EST SON ESPACE PUBLIÉ, JAMAIS SON ARBRE DE TRAVAIL — décision du 2026-08-24, « un dépôt ne
 * lit que le paquet publié ». Mesuré le 2026-09-04, sous enveloppe : `../kanopi/packages/library`
 * n'existe plus, et le banc de conformité a refusé de conclure sur zéro source.
 *
 * ⇒ L'ENVELOPPE N'A PAS CRÉÉ CE DÉFAUT, ELLE L'A RENDU VISIBLE. Mon corpus emprunté se lisait dans
 *   l'état NON COMMITÉ d'un voisin : une scène qu'il venait d'éditer sans l'enregistrer entrait dans
 *   mon verdict, et une scène qu'il avait publiée mais pas encore rebasculée n'y entrait pas. Le
 *   verdict dépendait de ce qu'il avait sous la main à cet instant.
 *
 * ⚠️ Le publié porte le corpus entier — 177 scènes BPScript et 113 grammaires BP3, mesurées le jour
 *   de la bascule. Ce n'est pas un sous-ensemble.
 */
export const LIBRARY = process.env.KANOPI_LIBRARY
  ? path.resolve(process.env.KANOPI_LIBRARY)
  : path.resolve(ICI, '..', '..', '.publie', 'kanopi', 'packages', 'library');

/** Les deux répertoires fixés par Romain (décision du 2026-07-20). */
export const DIR_GR = path.join(LIBRARY, 'scenes', 'BP3-tests');
export const DIR_BPS = path.join(LIBRARY, 'scenes', 'BPScript-tests');

/** Chemin de la version BPScript d'une grammaire. Existe pour 95 des 113. */
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
 * TOUTES les scènes BPScript de la bibliothèque, pas seulement les 95 de `BP3-tests`.
 *
 * ⚠️ POURQUOI CETTE FONCTION EXISTE (2026-07-29). `nomsBps()` ne lit QU'UN dossier — celui des
 * scènes converties depuis BP3. La bibliothèque en a quinze autres (`code-voices/`, `csound/`,
 * `strudel/`, `world/`…), et ce sont eux qui portent les cas les plus atypiques : les voix de
 * code, justement. Un garde bâti sur `nomsBps()` seul balaie 156 scènes sur 263 et n'en croise
 * AUCUNE — il rendrait un verdict vert sur une famille qu'il n'a jamais vue. C'est la faute
 * « la portée d'un garde se choisit sur l'ESPACE, jamais sur le dossier où ça s'est vu » ;
 * elle est ici mécanisée plutôt que rappelée.
 *
 * Ne remplace PAS `nomsBps()` : les mesures de parité BP3↔BPScript ont besoin de l'appariement
 * `.bps`/`.gr`, qui n'existe que dans ces deux dossiers-là. Deux questions, deux portées.
 *
 * @returns {Array<[string, string]>} paires [chemin relatif à la bibliothèque, contenu]
 */
export function toutesLesScenes() {
  const out = [];
  const marcher = (dir, prefixe) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      // `_archive` est GELÉE, et le critère est MESURÉ, pas choisi : 54 de ses 58 scènes ne
      // compilent plus (elles portent `:browser`, un raccord retiré du langage). Exiger qu'une
      // archive suive le langage vivant n'a pas de sens — c'est la seule dérogation que
      // `aucune_scene_ne_vit_hors_de_portee.mjs` accepte, et elle y est datée et motivée.
      if (e.name === '.git' || e.name === 'node_modules' || e.name === '_archive') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) marcher(p, `${prefixe}${e.name}/`);
      else if (e.name.endsWith('.bps')) out.push([`${prefixe}${e.name}`, readFileSync(p, 'utf-8')]);
    }
  };
  marcher(path.join(LIBRARY, 'scenes'), '');
  // ⚠️ LES SCÈNES DE CE DÉPÔT AUSSI — ajoutées le 2026-07-30, et c'est une RÉPARATION.
  // Elles n'étaient dans AUCUNE liste : 70 scènes (démos et fixtures de test) que personne ne
  // vérifiait. Quand la forme des voix de code a changé le 2026-07-28, les 52 scènes de la
  // bibliothèque ont été migrées et les CINQ démos d'ici sont restées cassées deux jours, en
  // silence. `aucune_scene_ne_vit_hors_de_portee.mjs` refuse désormais tout écart entre ce qui
  // EXISTE et ce qui est VÉRIFIÉ — mais il ne pouvait rien réparer tant que cette fonction
  // regardait un seul côté de la frontière.
  marcher(path.resolve(ICI, '..'), '');
  return out.sort((a, b) => a[0].localeCompare(b[0]));
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
  // ⚠️ UN DOSSIER QUI EXISTE N'EST PAS UN CORPUS. Cette fonction ne vérifiait que la PRÉSENCE des
  // deux dossiers : pointée sur deux dossiers VIDES, elle passait, et les sept gardes qui s'appuient
  // dessus rendaient un verdict VERT en n'ayant RIEN LU. Mesuré le 2026-07-27 sur la question de
  // l'architecte — « ton garde peut-il rendre un verdict vert sans avoir rien examiné ? ». Oui, il
  // le pouvait, et son silence aurait ressemblé à un succès le jour même où la bibliothèque aurait
  // été déplacée, renommée, ou où la racine aurait dérivé.
  //
  // L'absence de signal prise pour un bon signal : c'est la famille de défaut, et la parade est
  // qu'un garde REFUSE d'avoir examiné zéro. La suite (compter et ANNONCER dans le verdict vert)
  // appartient à chaque garde ; ce socle-ci ferme le cas zéro pour tout le monde d'un seul geste.
  const nbBps = readdirSync(DIR_BPS).filter((f) => f.endsWith('.bps')).length;
  const nbGr = readdirSync(DIR_GR).filter((f) => f.endsWith('.gr')).length;
  if (nbBps === 0 || nbGr === 0) {
    throw new Error(
      `Corpus VIDE sous ${LIBRARY} : ${nbBps} scène(s) .bps et ${nbGr} grammaire(s) .gr. Les `
      + `dossiers existent mais ne contiennent rien — un garde qui conclurait là-dessus rendrait `
      + `un verdict vert sans avoir rien examiné. Vérifier le clone de kanopi ou KANOPI_LIBRARY.`
    );
  }
  return { bps: nbBps, gr: nbGr };
}
