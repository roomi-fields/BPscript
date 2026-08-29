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
 * ⚠️ LE BRANCHEMENT S'EST PROUVÉ D'ABORD, L'EFFET ENSUITE. L'étage a d'abord été posé et TRAVERSÉ
 * sans porter la moindre décision — un étage qui décide sans qu'on ait prouvé qu'il est atteint
 * laisse croire à un effet que personne n'a mesuré. Son compte de passage le prouve depuis.
 *
 * ⛔ CE QU'IL PORTE MAINTENANT : LA DÉRIVATION. Un exemplaire hérite des membres de son prototype
 * qu'il n'écrit pas ; ce qu'il écrit gagne. Le lien parent est déjà dans l'arbre — `varType.type` —
 * et il n'y a rien à inventer.
 *
 * ⇒ **Et il vaut des deux côtés par construction** : une scène et une source de librairie entrent
 * toutes deux par la voie unique, donc toutes deux passent ici. C'est ce qui distingue ce domicile
 * d'un chemin de service — une règle qui vaudrait à l'entrée et pas au fond d'un sac serait un cas.
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
 * LES DÉCLARATIONS PAR LE TYPE, relevées dans l'arbre — les DEUX formes que le parseur produit, et
 * il en produit bien deux.
 *
 *     def X (…)        → `DefDirective` dans `ast.defs`  — aucun parent écrit
 *     <type> X (…)     → `VarDirective` dans `ast.vars`  — le parent est `varType.type`
 *
 * ⛔ LIRE UNE SEULE DES DEUX PLACES REND ZÉRO PARTOUT, et un zéro se lit comme « rien à résoudre ».
 * C'est le défaut exact que ce dépôt a mesuré au générateur du bundle, où la boucle ne lisait que
 * les `defs` : les 185 entrées de `scales` disparaissaient sans un mot.
 *
 * ⚠️ LE SAC D'ORIGINE EST RELEVÉ AVANT TOUTE GREFFE. Sans cette copie, un prototype qui est
 * lui-même un exemplaire transmettrait à ses enfants ce qu'il vient de recevoir, et le résultat
 * dépendrait de l'ORDRE dans lequel la table est parcourue — deux passes, deux arbres.
 */
function declarationsDe(ast) {
  const table = new Map();
  const poser = (nom, parent, noeud) => {
    if (!nom || table.has(nom)) return;
    table.set(nom, { parent, noeud, origine: [...((noeud.settings && noeud.settings.pairs) || [])] });
  };
  for (const d of (ast && ast.defs) || []) if (d) poser(d.name, null, d);
  for (const v of (ast && ast.vars) || []) {
    if (!v || !v.varType || v.varType.kind !== 'type') continue;
    for (const n of v.names || []) poser(n, v.varType.type, v);
  }
  return table;
}

/**
 * LA DÉRIVATION SE RÉSOUT — un exemplaire reçoit les membres de sa chaîne de prototypes qu'il
 * n'écrit pas, et rend le compte de ce qui a été greffé.
 *
 * ⛔ LE PLUS PROCHE GAGNE, ET CE QUI EST ÉCRIT GAGNE SUR TOUT. La remontée va du parent immédiat
 * vers la racine ; un membre déjà porté n'est jamais réécrit. C'est ce qui fait de la dérivation un
 * héritage et non une fusion.
 *
 * ⛔ ELLE EST TRANSITIVE. Mesuré sur le corpus des librairies : 387 exemplaires remontent d'un cran,
 * 179 de deux, 7 de trois. Un mécanisme qui s'arrête au premier parent serait juste sur 387 cas et
 * faux sur 186, **sans que rien ne rougisse**.
 *
 * ⚠️ UN PARENT ABSENT DE L'ARBRE ARRÊTE LA REMONTÉE, SANS REFUS. Deux cas la portent : `object`, la
 * racine du prototypal, qui ne se déclare jamais ; et un prototype qui vit dans une AUTRE source,
 * invoquée. Ce second cas est celui de 414 exemplaires sur 574, et il ne se résoudra qu'une fois le
 * prototype publié — la trace de dérivation entre dans le paquet à la phase suivante. Refuser ici
 * refuserait à la DÉCLARATION, ce que cet étage ne fera jamais.
 *
 * ⚠️ ET LA GREFFE SE MARQUE. Un membre hérité est marqué `herite`, parce que deux lecteurs de cet
 * arbre ne veulent pas la même chose : l'aval reçoit une valeur GRAVÉE — jamais un choix — et le
 * générateur du bundle republie ce que la SOURCE écrit. Décision de Romain, 2026-08-29 : *« dans les
 * librairies, porter sinon ça n'a aucun sens »*. Sans la marque, le paquet recopierait l'héritage
 * sur chacun de ses exemplaires, ce qui est exactement le régime qu'il a écarté.
 */
function heriterDesPrototypes(ast) {
  const table = declarationsDe(ast);
  let greffes = 0;
  for (const [nom, decl] of table) {
    if (!decl.parent) continue;
    const portees = new Set(decl.origine.map((p) => p.key));
    const vus = new Set([nom]);
    let parent = decl.parent;
    while (parent && !vus.has(parent) && table.has(parent)) {
      vus.add(parent);
      const proto = table.get(parent);
      for (const par of proto.origine) {
        if (portees.has(par.key)) continue;
        portees.add(par.key);
        // ⛔ LA PARENTHÈSE ABSENTE VAUT PARENTHÈSE VIDE : un exemplaire écrit sans corps —
        // `alphabet plain` — hérite comme les autres, et son sac s'ouvre pour le recevoir.
        if (!decl.noeud.settings) decl.noeud.settings = { type: 'SettingBag', pairs: [] };
        decl.noeud.settings.pairs.push({ ...par, herite: true });
        greffes++;
      }
      parent = proto.parent;
    }
  }
  return greffes;
}

/**
 * RÉSOUT un arbre contre son environnement, et rend ce que l'étage suivant attend.
 *
 * Rend `{ ast, diagnostics, examines, greffes }` :
 *   · `ast`         l'arbre, univoque — le même objet, muté en place comme les autres passes
 *   · `diagnostics` le canal UNIQUE de refus. Vide tant que l'étage ne refuse rien.
 *   · `examines`    le nombre de nœuds traversés. **Un étage qui a examiné zéro n'a pas tourné**,
 *                   et c'est indiscernable d'un étage qui n'a rien trouvé : le compte est ce qui
 *                   sépare les deux.
 *   · `greffes`     le nombre de membres hérités posés. Même raison : un corpus sans dérivation et
 *                   une résolution morte ont la même empreinte, et seul ce compte les sépare.
 *
 * ⚠️ `environnement` EST REÇU ET PAS ENCORE LU. Il est dans la signature parce que c'est ce que cet
 * étage SAIT, par définition — le socle et les librairies invoquées. Il devient lisible quand un
 * prototype d'une autre source est atteignable, et pas avant.
 */
export function resoudre(ast, environnement) {
  const diagnostics = [];
  let examines = 0;
  for (const _ of noeuds(ast)) examines++;
  const greffes = heriterDesPrototypes(ast);
  void environnement;
  return { ast, diagnostics, examines, greffes };
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
