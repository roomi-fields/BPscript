/**
 * LA PORTE DES OBJETS — ce qu'une librairie déclare, rendu comme des objets et non comme une table
 * de fichiers.
 *
 * Décision de Romain, 2026-09-02 : « je ne comprends pas pourquoi on aurait besoin du nom du fichier
 * ni de resolves ; pourquoi la structure des objets ne suffit pas ». Elle suffit. Le nom du fichier
 * et `resolves` ne servaient qu'au paquet intermédiaire, une table de fichiers née le 2026-06-14
 * sans décision, et qui sort en phase 5 (`2026-08-30-le-format-intermediaire-des-librairies-sort-en-
 * phase-5.md`). La porte s'expose AVANT le retrait : c'est la condition écrite dans cette décision.
 *
 * Ce que la porte rend est décrit dans `index-des-objets.js`, qui le calcule : familles, objets,
 * résolution d'une chaîne. La porte n'y ajoute qu'une chose — le BRANCHEMENT du compilateur sur son
 * chargeur, pour que quiconque entre par elle seule trouve le registre prêt à se construire. L'index
 * ne l'importe pas, parce que le compilateur le lit pour joindre à l'arbre les librairies qu'une
 * scène invoque, et qu'un import de la porte depuis le compilateur fermerait un cycle.
 *
 * ⚠️ LA SOURCE EST ENCORE LE PAQUET, et la porte l'ABRITE : ses consommateurs ne voient ni les clés de
 * fichier, ni `resolves`, ni `name`, `section`, `type`, `version` — les champs que la décision
 * `section-name-version-type-sortent-library-tombe` retire. Le jour où le compilateur lit les `.bpsl`
 * directement, la source change derrière cette porte et rien ne bouge devant.
 */
// ⛔ LE BRANCHEMENT DU COMPILATEUR, IMPORTÉ LÀ OÙ IL EST FAIT — `bpxAst.js`, jamais `index.js`.
// Mesuré par Atlas le 2026-09-02 : importer `index.js` (qui ne fait que réexporter) pour son effet de
// bord faisait émettre au regroupeur un MORCEAU VIDE, partagé entre `dist/index.js` et `dist/objets.js`
// — zéro octet, absent du paquet publié, et le premier import du paquet échouait.
import './bpxAst.js';

export { familles, famille, objet, objets } from './index-des-objets.js';
