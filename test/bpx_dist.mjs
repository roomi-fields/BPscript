/**
 * LA PORTE UNIQUE VERS L'ARTEFACT CONSTRUIT DE BPx — et elle nomme sa cause quand il manque.
 *
 * ⛔ POURQUOI ELLE EXISTE. Huit de mes gardes importaient `/home/romi/dev/bp/BPx/dist/index.js` par
 * chemin absolu. Cet artefact est un PRODUIT DE CONSTRUCTION du voisin : il disparaît pendant qu'il
 * reconstruit. Mon portillon passait donc au rouge sur un fichier qui n'est pas à moi, avec un
 * `ERR_MODULE_NOT_FOUND` brut qui n'apprend rien — mesuré le 2026-08-14 : deux rouges pendant un
 * même chantier, puis reproduit en boucle, échec au TROISIÈME essai sur quarante.
 *
 * ⚠️ UN ROUGE INTERMITTENT QUI N'ACCUSE PERSONNE EST LE PIRE DES DEUX MONDES : on le rejoue jusqu'au
 * vert, et rejouer jusqu'au vert est exactement le repli qu'on s'interdit. La première fois, je l'ai
 * classé « non reproduit » après treize exécutions — il fallait quarante essais et une boucle qui
 * garde la sortie, pas treize essais qui la jettent.
 *
 * CE QU'ELLE NE FAIT PAS, ET C'EST DÉLIBÉRÉ : elle ne saute pas le garde et ne rend pas un
 * avertissement. « Un garde qui peut se sauter doit ÉCHOUER, jamais avertir » — charte du
 * 2026-08-14. Un artefact absent est une raison de ne pas conclure, jamais une raison de passer.
 *
 * CE QU'ELLE FAIT : elle échoue en NOMMANT le voisin, son fichier, et le fait que la cause est
 * probablement une reconstruction en cours. Le lecteur du rouge sait en une ligne que son code n'est
 * pas en cause et chez qui regarder.
 */
import { existsSync } from 'node:fs';

export const BPX_DIST = '/home/romi/dev/bp/BPx/dist/index.js';

/** Importe l'artefact de BPx, ou échoue en disant à qui appartient la panne. */
export async function importerBPx() {
  if (!existsSync(BPX_DIST)) {
    throw new Error(
      `ARTEFACT DU VOISIN ABSENT — ${BPX_DIST} n'existe pas.\n`
      + '  Ce fichier est un PRODUIT DE CONSTRUCTION de BPx, pas un fichier de ce dépôt : il\n'
      + '  disparaît le temps qu\'il reconstruit. Ce rouge ne dit RIEN sur le code d\'ici.\n'
      + '  Vérifier chez BPx que sa construction est terminée, puis rejouer. Si l\'absence dure,\n'
      + '  c\'est une panne de son côté, pas un défaut du garde.',
    );
  }
  return import(BPX_DIST);
}
