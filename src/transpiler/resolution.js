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

import { sortieHeritee, alphabetHerite, octavesHerite, tuningHerite, evalHerite }
  from './actorResolver.js';

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

export function emitSceneMeter(ast) {
  // `meter` s'écrit en PARENTHÈSES depuis la décision Romain 2026-08-02 (LANGUAGE.md:773-800) :
  // l'injection du défaut de scène rejoint donc `r.settings.pairs` (le crochet REFUSE désormais
  // `[meter:…]`, cf. checkQualifierKey, parser.js). `r.qualifiers` (sac bracket, procédures de
  // niveau règle) n'est PAS concerné — meter n'y a jamais vécu.
  const dir = (ast.directives || []).find((d) => d && d.name === 'meter' && d.value != null);
  if (!dir) return;
  const valeur = String(dir.value);
  for (const sg of ast.subgrammars || []) {
    for (const r of sg.rules || []) {
      const porteDeja = (r.settings?.pairs || []).some((p) => p && p.key === 'meter');
      if (porteDeja) continue;   // la règle recouvre le défaut de scène, pour elle seule
      r.settings = r.settings || { type: 'SettingBag', pairs: [] };
      r.settings.pairs.push({ key: 'meter', value: valeur, decrement: null });
    }
  }
}


/**
 * UN GABARIT ESCLAVE REJOUE UN MAÎTRE, ET UN NOM QUE PERSONNE NE CAPTURE N'EN A AUCUN.
 *
 * `LANGUAGE.md` § « Capturer et rejouer » : « `$` capture un motif de groupe (maître), `&` le
 * rejoue (esclave). LE NOM PORTE L'APPARIEMENT ENTRE LES DEUX. » Un `&nom` sans `$nom` n'apparie
 * rien : il se lit comme un rejeu et ne rejoue aucun choix.
 *
 * ⛔ CE REFUS NE TRANCHE PAS LA PORTÉE DE L'APPARIEMENT, ET C'EST DÉLIBÉRÉ. Mesuré le 2026-08-29 :
 * un maître dans une règle et son esclave dans une AUTRE passent aujourd'hui, et la bible ne dit
 * pas si l'appariement vaut dans la règle ou dans la scène. Décider ici reviendrait à définir un
 * élément de langage. Les maîtres se collectent donc sur TOUTE la scène — la lecture la plus large,
 * donc le refus le plus prudent : ce qu'il rejette est faux dans les deux lectures.
 *
 * ⚠️ ET UNE SCÈNE QUI PORTE UNE ANCRE EST HORS DE PORTÉE. `$` seul en tête de membre gauche « marque
 * la règle entière comme gabarit maître » et « l'ancre reste ouverte jusqu'à sa fermeture » : elle
 * ouvre un maître SANS NOM, et rien n'écrit par quel nom un esclave le rejoue. Refuser là-dessus
 * serait supposer une réponse. 10 scènes du corpus en portent une.
 *
 * MESURE AVANT ÉCRITURE — 756 scènes compilables, 55 portent un gabarit : ZÉRO esclave orphelin.
 */
export function refuserEsclaveSansMaitre(ast) {
  const maitres = new Set();
  const esclaves = [];
  let ancre = false;
  (function marcher(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const e of n) marcher(e); return; }
    if (n.type === 'TemplateMaster' && n.name) maitres.add(n.name);
    if (n.type === 'TemplateAnchor') ancre = true;
    if (n.type === 'TemplateSlave' && n.name) esclaves.push(n);
    for (const k in n) marcher(n[k]);
  })(ast);
  if (ancre) return [];
  const vus = new Set();
  const erreurs = [];
  for (const e of esclaves) {
    if (maitres.has(e.name) || vus.has(e.name)) continue;
    vus.add(e.name);
    erreurs.push({
      message: `'&${e.name}' rejoue un gabarit que rien ne capture — aucun '$${e.name}' dans cette `
        + `scène. Le nom porte l'appariement entre le maître et l'esclave : sans maître, le rejeu `
        + `n'a pas de choix à répéter. Écrire '$${e.name}' là où le motif se capture.`,
      line: e.line,
    });
  }
  return erreurs;
}


/**
 * LA VOIX D'UN TERMINAL ARRIVE JUSQU'À L'ARBRE — cascade terminal, puis alphabet.
 *
 * ⛔ ACTE DE ROMAIN, 2026-08-08 : « tout est dans les PROPRIÉTÉS DU TERMINAL — ou pas, et c'est
 * alors résolu par les principes d'override. Et `def`/`voice` doit AUSSI être correctement
 * implémenté dans TOUS LES ALPHABETS. »
 * C'est la suite directe de la décision du 2026-08-01 : « un alphabet est une collection
 * structurée de terminaux », et `voice` n'est PAS une clé d'acteur — c'est le terminal qui la
 * porte, et l'alphabet qui les organise.
 *
 * ⚠️ CE QUE ÇA DÉBLOQUE, ET C'EST UN AGENT ENTIER ARRÊTÉ DEPUIS QUATRE HEURES. Kairos assurait le
 * DISPATCH DU SON — quelle voix joue quel symbole — en lisant la table des macros ; `macro` sort
 * du langage, la table n'existe plus, et il n'a rien à la place. La réponse était déjà dans la
 * spécification ; c'est l'implémentation qui manquait.
 *
 * ⚠️ DEUX ALPHABETS DÉCLARENT DÉJÀ LEURS VOIX EN DONNÉE — `tabla` associe `dha` à `bayan_open`,
 * `tryCsoundObjects` ses sept objets — et RIEN NE LES LISAIT ICI : la seule occurrence de
 * `.voices` dans ce dépôt désigne les voix d'un groupe polymétrique, sans rapport.
 *
 * ⛔ J'AI ÉCRIT « CETTE TABLE N'EST LUE PAR PERSONNE », ET C'ÉTAIT FAUX. Kairos l'a mesuré et me
 * l'a rendu : il la lit depuis JUIN — `resoudre-voix.ts:121`, sa voie (b), avec un témoin
 * bout-en-bout à lui. La donnée n'était pas morte : elle alimentait sa résolution de voix.
 * J'avais mesuré MON dépôt et conclu pour LE SIEN — la faute exacte que je remonte aux autres,
 * et la seconde fois de la journée. Ce qui était vrai : rien ne la lisait CHEZ MOI.
 *
 * ⚠️ ET ÇA OUVRE UNE QUESTION QUE JE NE TRANCHE PAS, la sienne : NOUS SOMMES DEUX À RÉSOUDRE LE
 * MÊME BINDING, depuis la même table, avec des précédences DIFFÉRENTES — la sienne va de l'acteur
 * à l'alphabet, la mienne du terminal à l'alphabet. Un acteur qui nomme une voix et un alphabet
 * qui en nomme une autre ne donnent pas le même résultat selon le chemin. Aujourd'hui l'écart ne
 * se voit pas (il ne lit pas encore ce champ) ; le jour où il le lira, il se verra.
 * Question portée à Romain : QUI résout le binding d'alphabet. Les deux réponses se défendent ;
 * ce qui ne se défend pas, c'est les deux à la fois.
 *
 * L'ORDRE DE RÉSOLUTION, du plus local au plus général :
 *   1. le terminal le nomme lui-même   (`def ka  voice.sec`)
 *   2. son alphabet le nomme pour lui  (`alphabets.json`, table `voices`)
 * Un terminal qui n'est nommé nulle part ne reçoit RIEN — l'absence reste une absence, et l'aval
 * la lit comme telle. On n'invente pas une voix par défaut : ce serait le défaut invisible que la
 * cascade des valeurs de scène a coûté le 2026-07-04.
 */
export function poserLaVoixDesTerminaux(ast) {
  if (!ast) return;
  // (1) ce que les `def` de la scène déclarent
  const parDef = new Map();
  for (const d of ast.defs || []) {
    if (d && d.type === 'DefDirective' && d.keys && d.keys.voice) parDef.set(d.name, d.keys.voice.value);
  }
  // ⛔ JE NE RÉSOUS PAS LE BINDING D'ALPHABET — Romain, 2026-08-08 : « c'est Kairos, ça n'est pas
  // ton rôle, tu n'en as pas besoin, c'est son rôle. »
  //
  // ⚠️ JE L'AVAIS ÉCRIT, ET C'ÉTAIT PORTER PLUS LOIN QUE MON RÔLE. Ma passe lisait la table
  // `voices` de l'alphabet et posait le résultat sur le terminal. Kairos fait exactement cela
  // depuis JUIN, depuis la même table (`resoudre-voix.ts:121`) — nous étions DEUX à résoudre le
  // même fait, avec des précédences différentes : la sienne va de l'acteur à l'alphabet, la
  // mienne allait du terminal à l'alphabet. Un acteur qui nomme une voix et un alphabet qui en
  // nomme une autre ne donnent pas le même résultat selon le chemin. L'écart ne se voyait pas
  // encore — il ne lit pas ce champ — et se serait vu le jour où il l'aurait lu.
  // C'est lui qui l'a mesuré et remonté ; la décision est de Romain.
  //
  // CE QUI RESTE ICI EST DU PORTAGE, PAS DE LA RÉSOLUTION : une voix ÉCRITE dans la scène par
  // `def <nom>  voice.<voix>` est une déclaration de l'auteur, je la transporte telle quelle.
  // Ce que l'alphabet organise, c'est l'aval qui le résout — « porter ≠ résoudre », et c'est la
  // règle que je passe mes journées à opposer aux autres.
  if (!parDef.size) return;

  const w = (n, vus = new WeakSet()) => {
    if (!n || typeof n !== 'object' || vus.has(n)) return;
    vus.add(n);
    if (Array.isArray(n)) { n.forEach((x) => w(x, vus)); return; }
    if (n.payload && n.payload.nature === 'sounding') {
      const nom = typeof n.symbol === 'string' ? n.symbol : n.name;
      const voix = parDef.get(nom);
      if (voix !== undefined && n.payload.voice === undefined) n.payload.voice = voix;
    }
    Object.values(n).forEach((v) => w(v, vus));
  };
  w(ast.subgrammars);
}


/**
 * Retire l'ardoise `alphabet` des SEULS acteurs qui portent une adresse — en TOUT DERNIER.
 *
 * POURQUOI SI TARD. `properties.alphabet` a deux lecteurs qu'il ne faut pas confondre : le
 * pipeline INTERNE de BPScript (résolution d'acteur, validation des terminaux), qui tourne
 * jusqu'au bout de `compileToBPxAST`, et l'AVAL. Retirer le champ à l'émission de l'adresse
 * couperait le premier ; le retirer ici ne touche que le second.
 *
 * POURQUOI LE CHAMP ET PAS SEULEMENT LA RÉFÉRENCE. Mesuré chez BPx : `pickActorAlphabet`
 * (`loadGrammar.ts:3694`) lit `properties.alphabet` D'ABORD et ne regarde `references[]` qu'à
 * défaut. Filtrer la seule référence ne changeait donc RIEN — Kairos criait la même collision,
 * au mot près. C'est cette voie v0.7 encore préférée qui portait l'ardoise jusqu'à lui.
 *
 * PORTÉE, mesurée et non supposée : les acteurs qui émettent une adresse, et EUX SEULS — un
 * sur tout le corpus des 95 aujourd'hui (`tryKeyMap`, acteur `bols`). Toutes les autres scènes
 * sortent octet pour octet identiques, ce qui est vérifié plus bas par le bilan inchangé.
 */
export function retirerArdoiseAlphabet(ast) {
  for (const actor of ast.actors || []) {
    if (!actor.libRefs || !actor.libRefs.length) continue;
    if (actor.properties) delete actor.properties.alphabet;
    if (Array.isArray(actor.references)) {
      actor.references = actor.references.filter((r) => r && r.category !== 'alphabet');
    }
  }
}


export function applyDefaultActor(ast) {
  if (!ast) return [];
  const errors = [];
  // Le binding de sortie de l'alphabet de scène (`alphabet.X:midi` → runtime:'midi') est la
  // clé de connexion transport (+eval) de l'UNIQUE acteur implicite (AST.md:94). Décision Romain
  // 2026-07-05 (acteur unique implicite) : sans actor, ce binding renseigne le transport de
  // l'acteur synthétique ; AVEC un actor, c'est un CHEVAUCHEMENT interdit (implicite XOR explicite).
  const alphaBinding = (ast.directives || []).find((d) => d.name === 'alphabet' && d.runtime);
  if ((ast.actors || []).length > 0) {
    if (alphaBinding) {
      errors.push({
        message: `chevauchement d'acteurs : un binding de sortie sur l'alphabet (alphabet.${alphaBinding.subkey}:${alphaBinding.runtime}) désigne un acteur implicite, incompatible avec un 'actor' explicite — choisis l'un OU l'autre`,
        line: alphaBinding.line || 0,
      });
    }
    return errors; // au moins un actor déclaré → pas d'acteur implicite (pas de chevauchement)
  }
  // LA SORTIE DE L'ACTEUR IMPLICITE — cascade complète (`sortieHeritee`), plus une lecture partielle.
  // ⚠️ CE QUI ÉTAIT ÉCRIT ICI IGNORAIT LA SCÈNE : la clé venait du raccord d'alphabet ou du socle,
  // jamais de `out.midi`. La directive était refusée au parse, donc rien ne pouvait le révéler —
  // et le jour où elle a été acceptée, l'acteur a continué à sortir `audio` sans un mot. Une valeur
  // par défaut et une valeur IGNORÉE ont exactement la même tête ; c'est pourquoi la cascade est
  // définie une seule fois, à côté des trois autres axes, et pas reconstituée à chaque appelant.
  const sortie = sortieHeritee(ast);
  if (sortie.conflit) {
    errors.push({
      message: `deux sorties pour la même scène : 'out.${sortie.conflit.ecrite}' et le raccord `
             + `'alphabet.${sortie.conflit.alphabet}:${sortie.conflit.raccord}' désignent des `
             + `canaux différents — les deux écritures disent la MÊME chose, il faut n'en garder `
             + `qu'une`,
      line: sortie.conflit.line,
    });
  }
  const transportKey = sortie.key;
  const transport = { type: 'TransportRef', key: transportKey, params: sortie.params };
  // ⚠️ ET SON ALPHABET — il naissait SANS, et c'était le trou (Romain 2026-07-29, « ça ne devrait
  // JAMAIS ARRIVER »). L'ancien commentaire ici disait « pas d'alphabet : pitch via le résolveur de
  // scène » : il n'existait aucun résolveur de scène en aval pour le remplir, donc l'AST partait
  // muet et le consommateur devait deviner. La cascade est la MÊME que pour un acteur déclaré
  // (`alphabetHerite`, définie une seule fois) : scène → socle core, ABSENT si la hauteur est
  // opaque. Une voix-code pure n'est pas concernée : elle n'a pas d'alphabet DÉCLARÉ ici, et
  // l'acteur implicite n'existe que faute de tout actor — il n'y a donc aucun eval à hériter.
  const alphabetKey = alphabetHerite(ast);
  const properties = { transport };
  const references = [{ type: 'ActorReference', category: 'transport', name: transportKey, line: 0 }];
  if (alphabetKey) {
    properties.alphabet = alphabetKey;
    references.push({ type: 'ActorReference', category: 'alphabet', name: alphabetKey, line: 0 });
    const oct = octavesHerite(ast, alphabetKey);   // les registres suivent l'alphabet, même cascade
    if (oct) {
      properties.octaves = oct;
      references.push({ type: 'ActorReference', category: 'octaves', name: oct, line: 0 });
    }
    // L'ACCORDAGE vient de l'ALPHABET, jamais du socle core (Romain 2026-07-29).
    const tun = tuningHerite(ast, alphabetKey);
    if (tun) {
      properties.tuning = tun;
      references.push({ type: 'ActorReference', category: 'tuning', name: tun, line: 0 });
    }
  }
  // L'INTERPRÈTE PAR DÉFAUT — cinquième et dernière des clés d'acteur à descendre (Romain,
  // 2026-08-07 : « toutes ces directives doivent descendre dans l'acteur implicite »). Il ne
  // descendait pas DU TOUT : `eval.strudel` en tête de scène était lu par le validateur et par
  // personne d'autre. Et il ne dépend PAS de l'alphabet — une scène qui ne joue aucune note
  // déclare quand même par quoi ses backtiques sont lus — donc il vit hors du bloc ci-dessus.
  const interprete = evalHerite(ast);
  if (interprete) {
    properties.eval = interprete;
    references.push({ type: 'ActorReference', category: 'eval', name: interprete, line: 0 });
  }
  // ⚠️ IL S'APPELAIT `default` JUSQU'AU 2026-07-30 (décision Romain, en direct :
  // `hub/decisions/2026-07-30-l-acteur-implicite-s-appelle-scene.md`). Son motif n'est pas
  // esthétique : il refusait que ce qui s'appelle normalement en notation pointée remonte en `@`.
  // Nommer l'acteur implicite `scene` donne à l'auteur de quoi DÉSIGNER ce qui n'appartient à
  // personne — quand rien n'est déclaré, le contenu appartient bien à la scène.
  // LE MOT N'ÉTAIT PAS LIBRE : trois scènes de la bibliothèque l'employaient comme nom de drapeau.
  // Elles sont refusées par la règle d'unicité et migrées par leur propriétaire — c'est le mode qui
  // CRIE, pas celui qui se tait, et c'est pour ça qu'on peut le prendre.
  ast.actors = [{
    type: 'ActorDirective',
    name: 'scene',
    properties,
    references,
    // Frontière AST (Palier 3) : pas de `soundAssignments:null` — champ non canonique.
    // Canonique = `assignments?` OPTIONNEL (absent ici : l'acteur implicite n'affecte aucun son).
    synthetic: true, // acteur implicite (aucun actor déclaré) — panneau Acteurs vide
    line: 0,
  }];
  return errors;
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
