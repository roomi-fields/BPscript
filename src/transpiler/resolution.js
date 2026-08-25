/**
 * L'ÉTAGE QUI RÉSOUT — le troisième des quatre, et le seul qui n'avait pas de domicile.
 *
 * Décision de Romain, 2026-08-24, `le-compilateur-a-quatre-etages-et-un-seul-canal-de-refus` :
 *
 *     lire les signes      les caractères            → des jetons
 *     lire la forme        la grammaire, ET RIEN DU VOCABULAIRE → un arbre où tout nom est
 *                                                       un symbole NON RÉSOLU
 *     RÉSOUDRE ET VÉRIFIER l'environnement — le socle et les librairies invoquées
 *                                                     → un arbre UNIVOQUE, et des diagnostics
 *     produire la sortie   l'arbre résolu            → la sortie, ET AUCUNE DÉCISION
 *
 * ⛔ CE QUE CE FICHIER EXISTE POUR RÉPARER. L'état mesuré le 2026-08-24 : le troisième étage était
 * **sans domicile, éclaté sur cinq modules**. Le parseur porte le tiers de la résolution — 155 refus
 * dont 46 parlent d'un NOM (« n'est déclaré par aucune librairie », « introuvable ») — et il importe
 * **douze fonctions du chargeur de librairies** : il ne lit pas une forme, il connaît le vocabulaire.
 *
 * ⇒ **Un nom inconnu n'est pas une faute de forme.** Le parseur qui refuse un nom tranche à l'étage
 * suivant, et il le fait avec le seul canal dont il dispose — l'arrêt immédiat.
 *
 * ⛔ ET LA CAUSE QUI A OUVERT LE CHANTIER EST PLUS LARGE QUE ÇA. Romain, 2026-08-25 : *« il faut
 * lancer un vrai mode plan chez BPScript pour en faire un vrai compilateur qui acceptera tout ce qui
 * peut être spécifié en librairie dans le langage tel qu'on l'a défini dans sa forme. »* L'essai du
 * prototype de famille a échoué parce que **le compilateur traite une librairie comme de la DONNÉE À
 * RANGER, pas comme du LANGAGE À RÉSOUDRE** — et la preuve la plus nette est que la même forme non
 * résolue **vit aussi dans une SCÈNE**. Ce n'est pas un défaut du déclaratif : c'est la résolution du
 * langage qui est incomplète des deux côtés.
 *
 * ⇒ C'est pourquoi cet étage est le domicile des deux : ce qui vaut pour une scène vaut pour une
 * source de librairie **par construction**, puisque les deux passent ici. Une règle qui vaudrait à
 * l'entrée et pas au fond d'un sac ne serait pas une règle, ce serait un cas.
 *
 * ⚠️ CE QU'IL NE FAIT PAS ENCORE, ET C'EST VOULU. Il est POSÉ ET TRAVERSÉ avant de porter la moindre
 * décision. Un étage branché qui ne décide rien se prouve ; un étage qui décide sans qu'on ait
 * prouvé qu'il est atteint laisse croire à un effet que personne n'a mesuré — c'est « un banc qui
 * appelle ma propre porte prouve la porte, jamais le branchement ». Le branchement se prouve
 * d'abord, l'effet ensuite.
 *
 * ⛔ CE QU'IL NE FERA JAMAIS : refuser à la DÉCLARATION. Décision de Romain, 2026-08-23,
 * `le-refus-se-pose-a-l-usage-et-il-est-positionnel` — *« rien ne se refuse à la déclaration ;
 * déclarer et instancier sont le même geste, et refuser à la déclaration interdirait tout modèle
 * incomplet, donc toute dérivation. »* Ce que cet étage refusera se refuse **à l'usage**, et
 * **positionnellement** : il n'a pas à comprendre ce qu'est un alphabet, il vérifie que ce qu'on lui
 * donne porte ce que la place exige.
 */

/**
 * Les nœuds de l'arbre, à toute profondeur — le parcours que l'étage emprunte pour compter ce qu'il
 * a vu, et qu'il empruntera pour résoudre.
 *
 * ⚠️ IL DESCEND DANS LES TABLEAUX ET DANS LES OBJETS, sans liste de champs. Une liste de champs à
 * visiter est une liste en dur de plus : elle deviendrait fausse au premier nœud neuf, et son
 * silence ressemblerait à « rien à résoudre ici ».
 */
function* noeuds(n, vus = new Set()) {
  if (!n || typeof n !== 'object' || vus.has(n)) return;
  vus.add(n);
  if (Array.isArray(n)) {
    for (const e of n) yield* noeuds(e, vus);
    return;
  }
  yield n;
  for (const k of Object.keys(n)) yield* noeuds(n[k], vus);
}

/**
 * RÉSOUT un arbre contre son environnement, et rend ce que l'étage suivant attend.
 *
 * Rend `{ ast, diagnostics, examines }` :
 *   · `ast`         l'arbre, univoque — le même objet, muté en place comme les autres passes
 *   · `diagnostics` le canal UNIQUE de refus. Vide tant que l'étage ne décide rien.
 *   · `examines`    le nombre de nœuds traversés. **Un étage qui a examiné zéro n'a pas tourné**,
 *                   et c'est indiscernable d'un étage qui n'a rien trouvé : le compte est ce qui
 *                   sépare les deux.
 *
 * ⚠️ `environnement` EST REÇU ET PAS ENCORE LU. Il est dans la signature parce que c'est ce que cet
 * étage SAIT, par définition — le socle et les librairies invoquées. Le poser plus tard obligerait à
 * changer tous les appelants au moment où l'on a le moins envie d'y toucher.
 */
export function resoudre(ast, environnement) {
  const diagnostics = [];
  let examines = 0;
  for (const _ of noeuds(ast)) examines++;
  void environnement;
  return { ast, diagnostics, examines };
}

/**
 * LE DERNIER COMPTE, pour le garde qui prouve que l'étage est BRANCHÉ et pas seulement présent.
 *
 * ⛔ SANS LUI, LE GARDE PROUVERAIT LA PORTE ET JAMAIS LE BRANCHEMENT : un banc qui appelle `resoudre`
 * lui-même est vert que la voie de compilation le traverse ou non. Ce témoin se lit APRÈS une
 * compilation réelle, et il ne peut monter que si la voie est passée par ici.
 */
let dernierCompte = null;

export function noterLePassage(compte) { dernierCompte = compte; }
export function dernierPassage() { return dernierCompte; }
