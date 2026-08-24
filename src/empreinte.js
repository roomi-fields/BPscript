/**
 * EMPREINTE — ce que mon paquet DIT de lui-même à qui le consomme.
 *
 * Forme imposée par `hub/contrats/ce-qu-un-banc-lit-chez-son-voisin.md` § « un paquet publié porte
 * son empreinte », reprise du patron `runtime-OSC/docs/patron-publier-un-paquet.md` pièce 6. Chaque
 * producteur la grave chez lui : ni outil partagé, ni librairie commune.
 *
 * ⛔ DEUX INSTANCES, JAMAIS UN MÊME FICHIER INTERPRÉTÉ DEUX FOIS. Dans l'arbre de travail, ce module
 * déclare `source-vive`. À la publication, le module ÉMIS est réécrit avec les valeurs réelles —
 * commit, propreté, instant, nombre de fichiers. C'est ce que le consommateur lit, et il n'a plus
 * rien à déduire.
 *
 * ⛔ LA PORTE S'APPELLE `./empreinte` CHEZ TOUS LES PRODUCTEURS, ET ELLE EST SECONDAIRE. Déclarée,
 * donc joignable par contrat ; nommée pareil partout, donc découvrable — une pièce derrière une
 * porte unique n'existe que pour qui sait déjà qu'elle existe. ⛔ Une porte métier qui la
 * ré-exporterait serait une voie parallèle : deux voies vers un même témoin, et celle qu'on oublie
 * ment la première.
 *
 * ⚠️ CE QUE CETTE VALEUR RETIRE À MON CONSOMMATEUR : la déduction. Sans elle il lit mon champ de
 * portes et CONCLUT ce que j'exécute — un raisonnement qui devient faux en silence le jour où le
 * régime change sans que personne réécrive la conclusion.
 *
 * ⚠️ LE CHAMP `regime` RAPPORTE, IL NE FAIT RIEN RÉSOUDRE. La dualité d'origine discriminait les
 * instances par une condition de résolution `development` dans le champ de portes : c'est le
 * mécanisme même qui fait charger les sources d'un voisin, et il sort. Le champ, lui, reste.
 */
export const EMPREINTE = { regime: 'source-vive' };
