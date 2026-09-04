// GARDE-SOURCE-VOISINE: porte — ce fichier EST l'unique entrée vers l'artefact construit d'un
// voisin, quel qu'il soit. Il remplace `test/bpx_dist.mjs`, qui ne fermait la porte que pour BPx.
// Compter sa ligne, c'est compter la réparation — et la retirer rouvrirait les quatorze sites.
/**
 * LA PORTE UNIQUE VERS L'ARTEFACT CONSTRUIT D'UN VOISIN — et elle nomme sa cause quand il manque.
 *
 * ⛔ POURQUOI ELLE EXISTE, ET POURQUOI ELLE A DÛ ÊTRE ÉLARGIE. La porte de BPx a été posée le
 * 2026-08-14 parce que huit gardes importaient `/home/romi/dev/bp/BPx/dist/index.js` par chemin
 * absolu. Elle a tenu — dix bancs y passent. ⛔ MAIS ELLE A ÉTÉ ÉCRITE POUR L'ENDROIT OÙ LE DÉFAUT
 * S'ÉTAIT MONTRÉ, PAS POUR L'ESPACE OÙ IL POUVAIT VIVRE : `kairos` et `kronos` n'y sont jamais
 * entrés, et quatre sites les importaient encore en absolu le 2026-08-30 — dont deux dans le pont
 * que bp3-frontend consomme.
 *
 * ⇒ Relevé par bp3-frontend, qui atteint `kairos/dist` et `kronos/dist` en passant par mon pont :
 * ma clôture transitive publiée comptait quatorze modules et ne pouvait pas les voir, une mesure
 * d'imports statiques ne suivant pas un chemin construit.
 *
 * CE QU'ELLE NE FAIT PAS, ET C'EST DÉLIBÉRÉ : elle ne saute pas le garde et ne rend pas un
 * avertissement. « Un garde qui peut se sauter doit ÉCHOUER, jamais avertir. » Un artefact absent
 * est une raison de ne pas conclure, jamais une raison de passer.
 *
 * CE QU'ELLE FAIT : elle échoue en NOMMANT le voisin, son fichier, et le fait que la cause est
 * probablement une reconstruction en cours. Le lecteur du rouge sait en une ligne que son code
 * n'est pas en cause et chez qui regarder.
 */
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ⛔ LE CHEMIN SE DÉRIVE DE MA RACINE, IL NE S'ÉCRIT PAS EN ABSOLU. Un chemin absolu ne se déclare
// nulle part et ne se voit qu'au moment où il ÉCHOUE, sur une machine qui n'est pas celle où il a
// été écrit. Mesuré chez moi le 2026-08-14 : 39 fichiers, dont SIX au portillon.
// ⛔ ET C'EST L'ESPACE PUBLIÉ, JAMAIS L'ARBRE DE TRAVAIL DU VOISIN — décision du 2026-08-24, « un
// dépôt ne lit que le paquet publié ». Mesuré le 2026-09-04, sous enveloppe : `../BPx/dist/index.js`
// n'existe plus, et le portillon s'est arrêté là. ⇒ Ce n'est pas l'enveloppe qui a créé le défaut,
// elle l'a RENDU VISIBLE : mes bancs typaient contre l'état NON COMMITÉ d'un voisin, donc leur
// verdict dépendait de ce qu'il avait sous la main à cet instant.
// ⛔⛔ ET LA COUR SE CHERCHE, ELLE NE SE COMPTE PAS EN REMONTÉES — rendu par bp3-frontend le
// 2026-09-04, mesuré chez lui. Deux remontées depuis `<dépôt>/test/` donnent la cour quand ce
// fichier vit dans MON ARBRE ; lues depuis MON ESPACE PUBLIÉ — `.publie/BPscript/test/` — elles
// donnent déjà `.publie`, et le segment ajouté compose `.publie/.publie`, qui n'existe pas.
//
// ⇒ ⛔ ET LE REFUS ACCUSAIT LE VOISIN : « l'artefact que kairos PUBLIE est absent […] cause
//   probable : kairos n'a pas encore publié ». Kairos avait publié. Un lecteur pressé vérifiait son
//   empreinte, la trouvait bonne, et rejouait. Chez bp3-frontend, 65 grammaires sur 98 sont passées
//   à « plante » sans qu'aucune n'ait changé.
//
// ⇒ *Un compte de remontées mesure la POSITION du fichier, jamais la cour.* Cette position a changé
//   avec la séparation, et rien ne l'a dit. On remonte donc jusqu'à trouver la cour elle-même —
//   celle qui PORTE `.publie`, ou `.publie` lui-même quand on est lu depuis l'intérieur.
function trouverLAtelier(depart) {
  for (let d = depart; ; d = dirname(d)) {
    if (basename(d) === '.publie') return d;
    if (existsSync(join(d, '.publie'))) return join(d, '.publie');
    if (dirname(d) === d) break;
  }
  throw new Error(
    `PORTE DU VOISIN : aucun espace publié trouvé en remontant depuis ${depart}. `
    + `La cour est le dossier qui porte '.publie' ; ni lui ni aucun de ses parents ne l'a.`);
}
const ATELIER = trouverLAtelier(dirname(fileURLToPath(import.meta.url)));

/**
 * LES VOISINS QUI PUBLIENT UN ARTEFACT CONSTRUIT, et le chemin de leur entrée DANS LEUR arbre.
 * ⛔ Une ligne s'ajoute ici le jour où un voisin de plus en publie un — et le garde
 * `la_porte_du_voisin_est_unique` refuse alors tout autre site qui le nommerait.
 */
const ARTEFACTS = {
  BPx: ['BPx', 'dist', 'index.js'],
  kairos: ['kairos', 'dist', 'index.js'],
  kronos: ['kronos', 'dist', 'index.js'],
};

/** Le chemin de l'artefact d'un voisin, dérivé de ma racine. */
export function cheminArtefact(voisin) {
  const segments = ARTEFACTS[voisin];
  if (!segments) {
    throw new Error(
      `VOISIN INCONNU — '${voisin}' n'a pas d'artefact déclaré dans cette porte.\n`
      + `  Déclarés : ${Object.keys(ARTEFACTS).join(', ')}.\n`
      + '  Un voisin qui publie un artefact s\'ajoute ICI, jamais par un chemin écrit ailleurs.',
    );
  }
  return join(ATELIER, ...segments);
}

/** Importe l'artefact construit d'un voisin, ou échoue en disant à qui appartient la panne. */
export async function importerArtefact(voisin) {
  const chemin = cheminArtefact(voisin);
  if (!existsSync(chemin)) {
    throw new Error(
      `ARTEFACT PUBLIÉ DU VOISIN ABSENT — ${chemin} n'existe pas.\n`
      + `  C'est l'artefact que ${voisin} PUBLIE, pas un fichier de ce dépôt, et pas son arbre de\n`
      + '  travail : ce rouge ne dit RIEN sur le code d\'ici.\n'
      + `  Cause probable : ${voisin} n'a pas encore publié, ou publie en ce moment. Vérifier\n`
      + `  l'EMPREINTE de son espace publié, puis rejouer. Si l'absence dure, c'est chez lui.`,
    );
  }
  return import(chemin);
}

/** Les voisins déclarés — lus par le garde de porte unique, jamais recopiés à la main. */
export const VOISINS_A_ARTEFACT = Object.keys(ARTEFACTS);
