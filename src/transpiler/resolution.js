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
import { parse, ParseError } from './parser.js';
import { LIBS } from './libs-data.js';
import { universeControlNames, resolveActorAlphabet, nomsDeTerminaux, loadLib } from './libs.js';
import { expandAlphabetTerminals } from './actorResolver.js';

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


export function hasTempoDirective(ast) {
  return (ast.directives || []).some(
    (d) => d && d.type === 'Directive' && d.name === 'tempo'
  );
}


/**
 * Inscrit les défauts d'ENVIRONNEMENT dans l'AST là où la scène ne déclare rien
 * (point 1, spec-ecriture-structure §A — décision archi validée Romain 2026-06-24).
 *
 * - Le défaut est inscrit EN DUR (pas une référence « va voir l'environnement plus
 *   tard ») : l'AST se suffit, le moteur dérive depuis une structure complète.
 * - Mécanisme GÉNÉRAL (un seul pour tout défaut), piloté par table.
 * - On ne câble QUE les défauts qui ont un vrai consommateur en aval (sinon on
 *   écrirait une cible que personne ne lit). Aujourd'hui : le TEMPO, lu par l'hôte
 *   et BPx via la directive `tempo` (Kanopi ; BPx loadGrammar). Les autres
 *   réglages (octave, division…) s'ajouteront ici dès que leur cible AST + lecteur
 *   seront définis.
 *
 * @param {object} ast  AST de scène (muté en place)
 * @param {{ tempo?: number }} [env]  défauts d'environnement portés par Kanopi
 */
export function applyEnvironmentDefaults(ast, env) {
  if (!ast || !env || typeof env !== 'object') return;

  // tempo → directive `tempo`, le seul nom du métronome depuis le 2026-08-10 (avant cette date
  // le métronome porte un seul nom). On n'inscrit le défaut que si la scène ne déclare aucun tempo.
  if (env.tempo != null && !hasTempoDirective(ast)) {
    (ast.directives = ast.directives || []).push({
      type: 'Directive',
      name: 'tempo',
      subkey: null,
      runtime: null,
      value: env.tempo,
      modifiers: null,
      fromEnvironment: true,   // provenance : défaut d'environnement, pas déclaré dans la source
      line: 0,
    });
  }
}


/**
 * Canonicalise UN contexte parser `{type:'Context', positive, symbols}` côté LHS.
 * Retourne `{inline: node}` (mécanisme A) ou `{remote: node}` (mécanisme B).
 * `line` : rule.line en tête, 0 en mi-LHS (réplique exacte de l'adaptateur).
 * `asRuleContext` : true en tête (forme contrat RuleContextAST, avec miroir
 * `symbols`), false en mi-LHS (ContextAST positionnel, sans miroir).
 */
export function canonicalizeLhsContext(ctx, line, asRuleContext) {
  const symbols = ctx.symbols || [];
  const single = symbols.length === 1;
  const allLiteral = symbols.every((s) => !isCtxWildcardName(s));
  const negated = ctx.positive === false;
  if (single && allLiteral && negated) {
    return { inline: { type: 'Symbol', name: symbols[0], negated: true, line } };
  }
  if (single && !allLiteral) {
    if (symbols[0] === '?') return { inline: { type: 'Wildcard', negated, line } };
    return { inline: { type: 'Variable', index: parseInt(symbols[0].slice(1), 10), negated, line } };
  }
  const elements = symbols.map((s) => ctxSymbolToElement(s, line));
  if (asRuleContext) {
    return { remote: {
      type: 'Context', side: 'left', positive: !negated, kind: 'remote',
      elements, symbols: [...symbols], line,
    } };
  }
  return { remote: { type: 'Context', negated, elements, line } };
}


export function canonicalizeLhsElement(el) {
  if (!el || typeof el !== 'object' || el.type !== 'Context') return el;
  if (Array.isArray(el.elements)) return el; // déjà canonique (ContextAST)
  const conv = canonicalizeLhsContext(el, el.line ?? 0, false);
  return conv.inline || conv.remote;
}


export function canonicalizeRhsElement(el) {
  if (!el || typeof el !== 'object') return el;
  if (el.type === 'Context') {
    const symbols = el.symbols || [];
    if (symbols.length === 1 && el.positive === false) {
      // `#X`/`#?`/`#?N` RHS → joker nié SANS nom ni line (le parser n'en pose pas ;
      // l'adaptateur n'ajoute line que s'il est défini). Compute.c:2014-2019.
      return { type: 'Wildcard', negated: true };
    }
    return el; // formes non mono-négatives : inchangées (erreur adaptateur préservée)
  }
  if (el.type === 'Polymetric' && Array.isArray(el.voices)) {
    return { ...el, voices: el.voices.map((v) => v.map((c) => canonicalizeRhsElement(c))) };
  }
  return el;
}


/**
 * Canonicalise les contextes de toutes les règles de l'AST (muté en place).
 * VIF (sûr, additif) : enrichissement des remotes de tête (double-émission).
 * GATÉ (Palier 4) : flip inline — tête/mi-LHS/RHS → atomes niés (P1-P4).
 */
export function canonicalizeContexts(ast) {
  for (const sub of ast.subgrammars || []) {
    for (const rule of sub.rules || []) {
      if (Array.isArray(rule.contexts) && rule.contexts.length > 0) {
        rule.contexts = rule.contexts.map((ctx) => enrichRemoteHeadContext(ctx, rule.line ?? 0));
      }
      if (INLINE_FLIP_PALIER4) {
        // FLIP C (top [271], B de bpx landé) — ORDRE SOURCE (P2) : la séquence
        // assemblée [items de tête convertis + LHS écrit] reproduit le routage
        // positionnel historique pour calculer le `side` OBÉI par BPx
        // (splitRuleContexts : un seul contexte par côté) :
        //   index 0 → 'left' ; dernier index → 'right' (remote de tête à motif
        //   vide = contexte DROIT, cas T8) ; MILIEU → erreur à la TRANSPILATION
        //   (même sémantique que l'ancien « Remote context must appear at
        //   start or end of LHS » levé au chargement).
        const seq = [];
        const remoteMarks = [];
        for (const ctx of rule.contexts || []) {
          if (ctx && Array.isArray(ctx.elements)) {
            const mark = { __remote: ctx };
            seq.push(mark); remoteMarks.push(mark);
            continue;
          }
          const conv = canonicalizeLhsContext(ctx, rule.line ?? 0, true);
          if (conv.inline) { seq.push(conv.inline); }
          else { const mark = { __remote: conv.remote }; seq.push(mark); remoteMarks.push(mark); }
        }
        const assembled = [...seq, ...rule.lhs];
        const declared = [];
        for (const mark of remoteMarks) {
          const i = assembled.indexOf(mark);
          const rc = mark.__remote;
          if (i === 0) declared.push({ ...rc, side: 'left' });
          else if (i === assembled.length - 1) declared.push({ ...rc, side: 'right' });
          else {
            throw new ParseError(
              `contexte distant en milieu de motif (autorisé : début ou fin de LHS)`,
              { line: rule.line ?? 0, col: 0 }
            );
          }
        }
        rule.lhs = assembled.filter((x) => !x || !x.__remote);
        rule.contexts = declared;
        rule.lhs = rule.lhs.map(canonicalizeLhsElement);
        rule.rhs = rule.rhs.map(canonicalizeRhsElement);
      }
    }
  }
}


export function ctxSymbolToElement(sym, line) {
  if (sym === '?') return { type: 'Wildcard', line };
  if (CTX_METAVAR_RE.test(sym)) return { type: 'Variable', index: parseInt(sym.slice(1), 10), line };
  return { type: 'Symbol', name: sym, line };
}


/**
 * Enrichit SUR PLACE une entrée REMOTE de rule.contexts : double-émission
 * `elements` TYPÉS (canonique) + `symbols`/`positive` conservés (le BPx vivant
 * ne lit qu'eux), ORDRE et position inchangés (rien ne bouge → prérequis P2/P3
 * non concernés). `side` est OMIS : il dépend de la position du remote dans la
 * séquence finale (un remote de tête est un contexte DROIT quand le motif est
 * vide, cf. P2) — à calculer au flip Palier 4 ; le défaut de contrat ('left')
 * s'applique en attendant. Les entrées de catégorie INLINE (#X, #?, #?N —
 * mécanisme A) restent BRUTES : leur forme canonique est l'atome nié dans le
 * LHS, qui n'est émissible qu'au flip (P1-P4).
 */
export function enrichRemoteHeadContext(ctx, line) {
  if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx.elements)) return ctx; // déjà enrichi
  const symbols = ctx.symbols || [];
  const single = symbols.length === 1;
  const allLiteral = symbols.every((s) => !isCtxWildcardName(s));
  const inlineCategory = single && (!allLiteral || ctx.positive === false);
  if (inlineCategory) return ctx; // mécanisme A : brut jusqu'au flip Palier 4
  return {
    type: 'Context', positive: ctx.positive !== false, kind: 'remote',
    elements: symbols.map((s) => ctxSymbolToElement(s, line)),
    symbols: ctx.symbols, line,
  };
}


// Interrupteur du flip INLINE (mécanisme A émis par le frontal). BASCULÉ au
// top C [271] (2026-07-03), étape B de bpx landée verte (B1 4988425 bascule
// rule.contexts→left/rightContext + B2 7360983 retraits + shim 3-formes).
// Prérequis réglés : P1 = découpeur A/A-bis (le #ab nié tombe au longest-match
// via splitCompoundTerminals, oracle [258]/[261]) ; P2 = side/séquence depuis
// l'ordre SOURCE (ci-dessous) ; P3 = lecteurs de tête posés (inertes → actifs) ;
// P4 = kanopi posé (9d88b3f, cf. [259]).
const INLINE_FLIP_PALIER4 = true;

const CTX_METAVAR_RE = /^\?\d+$/;

const isCtxWildcardName = (s) => s === '?' || CTX_METAVAR_RE.test(s);

/**
 * Des TROIS façons dont un canal peut être fautif, laquelle ? Le catalogue des canaux est la seule
 * source ; aucun nom n'est écrit ici. Rend `null` quand le canal est bon — c'est alors une vraie
 * faute de terminal.
 */
export function canalFautif(canal) {
  const cat = LIBS.core?.schema?.channels || {};
  const c = cat[canal];
  if (!c) return `le canal '${canal}' n'existe pas — les canaux sont ${Object.keys(cat).join(', ')}. `
    + `La liste est FERMÉE.`;
  if (!c.out) return `'${canal}' n'est pas une sortie — un terminal sonne, il ne se lit pas. Les `
    + `canaux de sortie sont ${Object.keys(cat).filter((k) => cat[k].out).join(', ')}.`;
  if (!c.writable) return `'${canal}' est une DESTINATION de l'architecture, routée comme les autres `
    + `sorties, mais son ÉCRITURE dans une scène attend encore son appareil dédié.`;
  return null;
}


/**
 * LE RECENSEMENT DES NOMS DÉCLARÉS — non-terminaux, définitions, scènes, homomorphismes, motifs
 * temporels, variables de travail.
 *
 * ⚠️ IL EST PARTAGÉ PAR LA VALIDATION ET PAR LA SEGMENTATION, et le partage est le fond du geste :
 * la segmentation doit ÉPARGNER ces noms. Un non-terminal qui s'appelle `taka` n'est pas un mot
 * collé de l'alphabet — le découper le ferait disparaître de sa propre grammaire, sans un signe.
 * Deux recensements côte à côte divergeraient au premier nom ajouté à l'un.
 */
export function nomsDeclares(ast) {
  // Symboles DÉCLARÉS : non-terminaux (LHS), déclarations gate/trigger/cv, scènes, homomorphismes.
  const declared = new Set();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) (r.lhs || []).forEach((s) => s && declared.add(s.name));
  for (const d of ast.declarations || []) if (d && d.name) declared.add(d.name);
  // ⛔ UNE DEFINITION EST UN NOM REINVOCABLE — LANGUAGE.md:304 : « def associe un nom a un corps,
  // POUR LE REINVOQUER D UN MOT ». Mesure du 2026-08-09 : `def m C4 D4` puis `S -> m C4` refusait
  // — « terminal 'm' non declare ». Le nom etait donc declare et INUTILISABLE : la moitie du sens
  // de la directive manquait, et le palier ecrit ce matin ne l avait pas vu parce qu il rangeait la
  // definition dans l arbre sans jamais l invoquer.
  // ⚠️ TROUVE EN MIGRANT UN GARDE DE PORTEE, pas en ecrivant la directive. Ce recensement est la
  // seule liste qui autorise un nom dans une regle — et la ligne d a cote recensait encore les
  // objets CV, section supprimee le jour meme : une liste qui gagne des entrees et n en perd
  // jamais finit par decrire un langage qui n existe plus.
  for (const d of ast.defs || []) {
    if (d && d.type === 'DefDirective' && d.name) declared.add(d.name);
  }
  for (const s of ast.scenes || []) if (s && s.name) declared.add(s.name);
  // LES NOMS D'HOMOMORPHISME — le nom INVOQUÉ et les ÉTIQUETTES DE SECTION.
  // ⚠️ `LANGUAGE.md` §« Les tables d'homomorphisme » : « Elle s'applique entre un gabarit maître
  // et son esclave, dont le NOM SE POSE ENTRE LES DEUX » — `S -> $N14 dhati &N14`. Ce nom n'est
  // pas une note : c'est le marqueur qui dit quelle table transforme le rejeu. Il était refusé
  // comme « terminal non déclaré ».
  //
  // ⚠️ ET IL Y AVAIT DÉJÀ UNE BRANCHE POUR ÇA, MORTE : le contrôle testait `el.role !==
  // 'homomorphism'` et RIEN ne posait jamais ce rôle. Deuxième correctif entièrement rédigé et
  // jamais branché trouvé aujourd'hui, après `isEndOfRhs()`. Une branche morte ne rougit pas, ne
  // sert pas, et se lit comme une couverture.
  //
  // DEUX NOMS, PAS UN : une table à section unique s'invoque par son nom (`homomorphism.dhati`
  // → `dhati` dans le flux) et l'arbre la nomme `*` ; une table à sections nommées pose ses
  // ÉTIQUETTES (`checkhomo` → `*`, `H`, `TR`, et les règles écrivent `S -> $X * TR &X Y`).
  // N'en déclarer qu'un laisserait l'autre refusé — c'est la faute « on répare la forme qui s'est
  // montrée » appliquée à un nom.
  for (const d of ast.directives || []) if (d.name === 'homomorphism' && d.subkey) declared.add(d.subkey);
  for (const h of ast.homomorphisms || []) if (h && h.name) declared.add(h.name);
  // Motifs temporels (timepatterns: t1=…) : symboles de flux, pas des terminaux de note.
  for (const d of ast.directives || []) if (d.name === 'timepatterns' && Array.isArray(d.timePatterns)) for (const tp of d.timePatterns) if (tp && tp.name) declared.add(tp.name);
  // VARIABLES DE TRAVAIL (`var`, décision Romain 2026-07-27) : des symboles du flux qui ne sont
  // l'écriture d'aucune note. Elles entrent ici — dans les noms DÉCLARÉS, à côté des non-terminaux
  // — et non dans le vocabulaire d'un alphabet : elles n'ont pas de hauteur, elles ont un NOM.
  // Le refus ne s'affaiblit pas, il gagne une porte nommée : un symbole non déclaré crie toujours.
  // ⚠️ `ast.vars` porte la DIRECTIVE ENTIÈRE (`VarDirective`, AST.md:119-150) depuis le
  // 2026-08-05, pas ses noms nus — une ligne peut en porter PLUSIEURS (`names`).
  for (const v of ast.vars || []) for (const n of v?.names || []) declared.add(n);
  return declared;
}


/**
 * GARDE DE VOCABULAIRE DES APPELS `nom(…)` (chantier `_script`, GO Romain 2026-07-26).
 *
 * Un nom SUIVI D'UNE PARENTHÈSE n'est un CONTRÔLE que s'il est déclaré dans `controls.json`
 * (parser.js:3315 `isControlName`) ; sinon le parseur en fait un `SymbolCall`, c'est-à-dire un
 * TERMINAL SONNANT porteur de paramètres. Ce chemin n'était contrôlé par rien : un nom absent de
 * tout vocabulaire traversait la chaîne en silence, avec `payload.nature:'sounding'` — mesuré le
 * 2026-07-25 (`foobar(3)` accepté, 0 erreur) et re-mesuré le 2026-07-26 après le retrait de
 * `runtime.midi.script` : 3 des 5 scènes qui l'emploient compilaient toujours sans un mot.
 *
 * DEUX CRITÈRES, tous deux issus de la donnée — ni liste en dur ni cas particulier : `script`
 * tombe parce qu'il n'est plus DANS LA DONNÉE, pas parce qu'un test le nomme.
 *
 *  (a) VOCABULAIRE — le nom d'un appel se valide comme un symbole nu : alphabets en portée,
 *      non-terminaux, déclarations. Exige un alphabet en portée, exactement comme la validation
 *      des symboles nus : sans alphabet déclaré, le compilateur ne PEUT PAS savoir ce qui est un
 *      terminal, et juger quand même produit un faux refus (mesuré : `sitar -> C4 C4(ch:5)`,
 *      fragment sans alphabet, refusé à tort).
 *
 *  (b) FORME DE L'ARGUMENT — `()` porte une annotation `clé:valeur` sur l'événement (CLAUDE.md,
 *      « instructions runtime »). Un argument POSITIONNEL sur un nom qui n'est pas un contrôle
 *      déclaré n'annote rien : c'est un APPEL DE FONCTION, et le langage n'en a pas. Ce critère
 *      ne dépend d'aucun alphabet, ce qui referme le trou des scènes qui n'en ont pas (koto3,
 *      scène à gates, passait indemne par (a) seul). Mesuré sur les DEUX corpus consommateurs
 *      (Kanopi BPScript-tests + BPx test/scenes) : le seul appel à argument positionnel est
 *      `script` (7 occurrences) ; tous les autres sont entièrement nommés.
 *
 * Le message CITE l'appel tel qu'écrit (exigence de l'ordre [936]) : un utilisateur qui a écrit
 * `script(MIDI program 5)` doit lire sa propre ligne, pas un nom de nœud d'AST.
 */
export function validateCallVocabulary(ast, known, declared, codeVoice, anyAlphabet) {
  const errors = [];
  const seen = new Set();
  const citer = (el) => {
    const parts = (el.args || []).map((a) => {
      const v = a && a.value ? a.value : a;
      const texte = v && Object.prototype.hasOwnProperty.call(v, 'value') ? v.value : v;
      return (a && a.key ? `${a.key}:` : '') + texte;
    });
    return `${el.name}(${parts.join(' ')})`;
  };
  // Portée RÉCURSIVE, contrairement à la boucle des symboles nus ci-dessus : un appel se niche
  // dans un groupe ou une polymétrie aussi bien qu'au premier rang de la règle.
  const visiter = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visiter); return; }
    if (n.type === 'SymbolCall' && n.name
        && !(n.payload && codeVoice.has(n.payload.actor))
        && !known.has(n.name) && !declared.has(n.name) && !seen.has(n.name)) {
      const positionnel = (n.args || []).some((a) => a && a.key == null);
      if (anyAlphabet || positionnel) {
        seen.add(n.name);
        // NOMMER LA CAUSE, PAS LE SYMPTÔME. Deux situations très différentes portent le même
        // symptôme (un appel reclassé en terminal sonnant), et les confondre envoie l'utilisateur
        // chercher une faute de frappe là où il manque une ligne d'en-tête :
        //   - le nom EXISTE dans le registre des contrôles, mais la scène ne l'a pas importé ;
        //   - le nom n'existe nulle part.
        // Mesuré le 2026-07-26 sur le témoin de bpx : `ins(12)` sans `core` dégénérait en
        // note, et mon premier message affirmait « 'ins' n'existe pas », ce qui est FAUX.
        const auRegistre = universeControlNames().has(n.name);
        errors.push({
          message: auRegistre
            ? `appel '${citer(n)}' : '${n.name}' est un contrôle du registre, mais cette scène ne `
              + `l'a pas importé — il a donc été reclassé en TERMINAL SONNANT, c'est-à-dire en note. `
              + `Déclarer le socle en tête de scène ('core')`
            : `appel '${citer(n)}' : '${n.name}' n'existe pas — ni contrôle du registre, ni terminal `
              + `des alphabets en portée, ni symbole déclaré. Une fonction générique n'est pas du `
              + `langage : chaque intention porte son nom ('[]' pour le moteur, '()' pour le `
              + `runtime, en 'clé:valeur')`,
          line: n.line,
        });
      }
    }
    for (const k in n) { const v = n[k]; if (v && typeof v === 'object') visiter(v); }
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) visiter(r.rhs);
  return errors;
}


/**
 * Les terminaux de TOUS les alphabets effectifs de la scène — UNE seule définition.
 *
 * Deux gardes en ont besoin et posent la MÊME question : « ce mot est-il une note ici ? ».
 * `validateTerminals` la pose sur un mot écrit dans une règle ; la garde des noms de macro la pose
 * sur un nom déclaré. Dupliquer le calcul, c'est se garantir qu'un jour l'une acceptera ce que
 * l'autre refuse — la dérive qu'on paie ailleurs, appliquée aux garde-fous eux-mêmes.
 *
 * « Effectif » = l'alphabet de la scène ET celui de chaque acteur. Les deux formes comptent :
 * décorée du registre (`madhya_sa`) et nue (`sa`), parce que les deux s'écrivent.
 */
export function terminauxEnPortee(ast) {
  const terminaux = new Set();
  // ⛔ UN PAQUET PAR ALPHABET, EN PLUS DE L'UNION. La validation demande « ce nom est-il connu »,
  // et l'union y répond. La SEGMENTATION demande autre chose : « ce mot tient-il dans UN
  // vocabulaire » — décision de Romain du 2026-08-16, un mot se segmente entièrement dans un seul
  // alphabet. Sur l'union, `taC4` se lirait `ta` (tabla) + `C4` (occidental), un mot construit avec
  // des morceaux de deux langues.
  const paquets = [];
  const ajouter = (name, octaves) => {
    const lib = resolveActorAlphabet(name, ast.directives);
    if (!lib || !nomsDeTerminaux(lib)) return false;
    const paquet = new Set();
    for (const t of expandAlphabetTerminals(lib, octaves)) { terminaux.add(t); paquet.add(t); }
    const alts = lib.alterations && typeof lib.alterations === 'object' && !Array.isArray(lib.alterations)
      ? Object.keys(lib.alterations) : [''];
    for (const note of nomsDeTerminaux(lib)) for (const alt of alts) { terminaux.add(note + alt); paquet.add(note + alt); } // forme nue
    paquets.push(paquet);
    return true;
  };
  let aUnAlphabet = false;
  // ⚠️ UNE SCÈNE NE DÉCLARE QU'UN ALPHABET — tranché par Romain le 2026-08-07 : « on ne déclare
  // pas plusieurs acteurs implicites, un seul ; sinon c'est explicite. » Un acteur porte UN
  // alphabet et UNE sortie ; deux vocabulaires appellent donc deux acteurs, et deux acteurs se
  // DÉCLARENT. Le second `alphabet` de scène était refusé plus bas ; ce refus est SORTI le
  // 2026-08-23 — le dernier écrit gagne, y compris `alphabet`.
  // il n'est plus ignoré en silence — c'est pour ça qu'on lit le premier sans remords.
  const sceneAlpha = (ast.directives || []).find((d) => d.name === 'alphabet' && d.subkey);
  const sceneOct = (ast.directives || []).find((d) => d.name === 'octaves' && (d.subkey || d.runtime));
  if (sceneAlpha) {
    aUnAlphabet = ajouter(sceneAlpha.subkey, sceneOct ? (sceneOct.subkey || sceneOct.runtime) : null)
                || aUnAlphabet;
  }
  for (const a of ast.actors || []) {
    const p = a.properties || {};
    if (p.alphabet) aUnAlphabet = ajouter(p.alphabet, p.octaves || null) || aUnAlphabet;
  }
  // ⛔ UNE INVOCATION MET SON VOCABULAIRE EN PORTEE — une seule ligne suffit.
  //
  // `test_alphabets.abc` DESACTIVAIT la validation au lieu de l'activer : la scene sortait avec
  // ZERO terminal, `validateTerminals` revenait avant tout controle, et n'importe quel symbole
  // passait. Il fallait ecrire `alphabet.abc` EN PLUS, ce que rien ne justifiait — le nom du
  // fichier et celui de l'entree disent deja tout.
  //
  // ⚠️ ET LA SECONDE LIGNE COUTAIT DEUX FOIS : elle faisait REFUSER la projection chez Kairos
  // (collision de domaine, deux surfaces pour un seul slot) tout en donnant un faux vert ici.
  // Une ligne qui repare la compilation et casse la projection n'est pas une contrainte, c'est le
  // symptome d'un defaut.
  //
  // `ajouter` refuse une entree sans terminaux : `sound.X`, `homomorphism.X` et `eval.X` ne
  // mettent donc RIEN en portee, et ce qui EST un alphabet en charge un.
  for (const ref of ast.libRefs || []) {
    const parts = String(ref).split('.');
    // ⚠️ L'ENTREE SE CHERCHE DANS LA LIBRAIRIE INVOQUEE, jamais partout. Sans cette borne,
    // `homomorphism.dhati` chargeait l'alphabet `dhati` du catalogue de test — un nom porte par
    // deux librairies de natures differentes, et la mise en portee prenait la mauvaise.
    const lib = loadLib(parts.slice(0, -1).join('.'), parts[parts.length - 1]);
    if (!lib || !nomsDeTerminaux(lib)) continue;
    aUnAlphabet = ajouter(parts[parts.length - 1], sceneOct ? (sceneOct.subkey || sceneOct.runtime) : null) || aUnAlphabet;
  }
  // ⛔ UN TERMINAL DÉCLARÉ PAR `def` ENTRE AU VOCABULAIRE — sinon la directive ne sert à rien.
  //
  // `LANGUAGE.md` §« Déclarer un terminal » : « un terminal se déclare avec `def` et un bloc de
  // clés ». Une déclaration qui n'ajoute pas son nom au vocabulaire est une porte nommée qui ne
  // change RIEN : la scène compile la directive, puis refuse le symbole qu'elle vient de déclarer.
  // Mesuré le 2026-08-08, juste après l'ouverture de `def` : `def ka voice.sec` puis `S -> ka`
  // rendait « terminal 'ka' non déclaré ». La directive était lue, rangée dans l'arbre, et
  // ignorée du seul contrôle qui la concernait.
  //
  // ⚠️ ET C'EST LE CŒUR DU CHANTIER, PAS UN DÉTAIL. Cinq directives sortent du langage, et `gate`
  // — 119 lignes sur 14 scènes — déclarait précisément des terminaux avec leur sortie. Sans cette
  // ligne, la cible de migration accepte la déclaration et refuse l'usage : le pire des deux
  // mondes, un mur avec une porte peinte dessus.
  // Un terminal declare par `def` appartient a la SCENE, pas a un alphabet : il est en portee
  // partout, donc il rejoint chaque paquet. Un mot peut le meler aux bols de l'alphabet actif sans
  // pour autant traverser deux alphabets.
  for (const d of ast.defs || []) {
    if (d && d.type === 'DefDirective' && d.kind === 'terminal' && d.name) {
      terminaux.add(d.name);
      for (const paquet of paquets) paquet.add(d.name);
    }
  }
  return { terminaux, aUnAlphabet, paquets };
}


export function validateTerminals(ast) {
  if (!ast) return [];
  const errors = [];
  const codeVoice = new Set((ast.actors || []).filter((a) => (a.properties || {}).eval).map((a) => a.name));

  // Vocabulaire VALIDE = terminaux de TOUS les alphabets effectifs (octaviés + formes nues).
  const { terminaux: known, aUnAlphabet: anyAlphabet } = terminauxEnPortee(ast);
  const declared = nomsDeclares(ast);

  errors.push(...validateCallVocabulary(ast, known, declared, codeVoice, anyAlphabet));
  if (!anyAlphabet) return errors; // aucun alphabet de notes en portée (voix-code pure) → rien à valider sur les symboles NUS

  // Terminaux RHS : Symbol non couvert = non déclaré.
  //
  // ⚠️ CETTE BOUCLE NE LISAIT QUE LE PREMIER NIVEAU — un terminal inconnu placé dans un GROUPE
  // passait SANS UN MOT. Mesuré le 2026-07-29, trois scènes minimales sous alphabet occidental :
  //   `motif -> zzz` REFUSÉ · `motif -> a b` REFUSÉ · `motif -> {a a b b}` ZÉRO ERREUR.
  //
  // ⚠️ C'EST LA QUATRIÈME FOIS QUE JE PAIE CETTE FAMILLE, et je l'avais inscrite trois fois :
  // « descendre jusqu'aux FEUILLES — compter les voisins de surface ne voit pas ce qui vit sous un
  // nœud composite ». Je l'avais réparée dans la garde des sacs, dans celle de la correspondance,
  // dans celle du point d'attente… et jamais re-balayée ICI, dans le validateur le plus central.
  // Une règle qu'on a écrite et appliquée ailleurs ne protège pas l'endroit qu'on n'a pas regardé.
  //
  // CE QUE ÇA COÛTAIT, ET C'EST PIRE QUE LE TROU LUI-MÊME : tant qu'il était ouvert, AUCUNE scène à
  // groupes ne pouvait être migrée sur la foi d'un « zéro erreur » — le compilateur disait oui à
  // tout. Une scène de la bibliothèque a été déclarée MIGRÉE le matin même sur ce vert-là
  // (`Mozartexpression`, huit noms de solfège cachés sous alphabet occidental). Un vert qui ne
  // mesure pas ce qu'on croit est pire qu'un rouge (formule de bpx, reprise).
  //
  // AMPLEUR MESURÉE AVANT ÉCRITURE, 258 scènes : 76 portent des terminaux sous un groupe, 7 y
  // cachent un inconnu, 6 passent de verte à rouge. Les trois consommateurs ont été prévenus À
  // L'ÉCRITURE avec la liste exacte — pas au push (règle du 2026-07-29).
  const seen = new Set();
  // ⚠️ LA LISTE DES CHAMPS PORTEURS SE MESURE, ELLE NE SE DEVINE PAS. Mon premier jet en oubliait
  // deux —  et , ceux de l'événement simultané — et le garde l'a dit tout
  // de suite parce qu'il éprouve l'ESPACE des contenants et pas le groupe qui s'était montré.
  // C'est précisément ce qu'une matrice achète : la faute que j'allais refaire au même endroit.
  const COMPOSITES = ['voices', 'elements', 'content', 'symbol', 'triggers', 'primary', 'secondaries'];
  const verifier = (el) => {
    if (!el || typeof el !== 'object') return;
    if (Array.isArray(el)) { el.forEach(verifier); return; }
    // L'OBJET SONORE COMPOSÉ — `|[C4 E4 G4]` : le nom formé est un terminal, et ce sont ses
    // PARTIES qui se contrôlent. `LANGUAGE.md` §« L'objet sonore composé » dit que le nom formé
    // « se pose dans le flux comme un terminal ORDINAIRE » — aucun alphabet ne portera jamais le
    // concaténé, donc le chercher tel quel refusait toujours. Opaque à la DÉRIVATION ne veut pas
    // dire opaque au vocabulaire : une faute de frappe à l'intérieur crie, à sa place.
    if (el.type === 'Symbol' && Array.isArray(el.compose) && el.compose.length) {
      for (const part of el.compose) {
        // Silence, prolongation et sous-blocs polymétriques sont ce qui s'écrit à l'intérieur
        // (bible, même section) : ce ne sont pas des noms à chercher dans un alphabet.
        if (/^[-_.]+$/.test(part) || /[{},]/.test(part)) continue;
        if (known.has(part) || declared.has(part) || seen.has(part)) continue;
        seen.add(part);
        errors.push({
          message: `dans l'objet sonore composé '|[…]' : '${part}' n'est déclaré nulle part — `
                 + `absent des alphabets en portée`,
          line: el.line,
        });
      }
      return;
    }
    // ⛔ L'OBJET HORS-TEMPS EST UN SECONDAIRE POSÉ SEUL, ET IL SE VALIDE COMME UN SECONDAIRE.
    // `LANGUAGE.md` § « la simultanéité » : « après `!` : les secondaires », et « `!nom` pose seul :
    // objet hors-temps — il tient sa place dans l'ordre joué pour une durée nulle ». Le nom qu'il
    // porte est donc du même vocabulaire que tout autre terme du flux.
    //
    // ⚠️ MESURÉ LE 2026-08-29, ET C'EST LA POSITION QUI CHOISISSAIT LE MÉCANISME : `C4!vide` était
    // REFUSÉ — le secondaire descend par `secondaries`, donc cette boucle le voyait — tandis que
    // `!vide` posé seul PASSAIT, parce que le parseur en fait un nœud `OutTimeObject` et que la
    // condition ci-dessous ne nommait que `Symbol`. Un même nom, un même rôle, deux sorts selon
    // qu'un primaire le précède : c'est un cas, pas une règle.
    //
    // ⚠️ ET IL ARRIVAIT DANS L'ARBRE avec `payload.nature:'sounding'` — l'aval recevait l'ordre de
    // faire sonner un terminal que rien ne déclare. Le refus porte donc le MÊME TEXTE que celui du
    // secondaire : une seule question posée au même objet ne rend qu'une seule phrase.
    if ((el.type === 'Symbol' || el.type === 'OutTimeObject') && el.name
        && el.role !== 'homomorphism'            // marqueur d'invocation d'homo, pas un terminal
        && !(el.payload && codeVoice.has(el.payload.actor))   // voix-code : terminal arbitraire
        && !known.has(el.name) && !declared.has(el.name) && !seen.has(el.name)) {
      seen.add(el.name);
      // ⛔ LE REFUS NOMME LE RESTE, PAS LE MOT. La segmentation est passée avant et a buté sur un
      // bout précis ; c'est lui qui manque à l'alphabet, et le natif le dit ainsi — « Can't make
      // sense of "a" ». Dire le mot entier envoie chercher un terminal qui n'a jamais eu à exister.
      const reste = restesDeSegmentation.get(el);
      // ⛔ ET SI L'AUTEUR A ÉCRIT LA DÉCLARATION, LA FAUTE EST SUR SON CANAL, PAS SUR LE TERMINAL.
      // `a:zorglub` rendait « terminal 'a' non déclaré » : la ligne cessait d'être lue comme une
      // déclaration parce que `zorglub` n'est pas un canal, et l'auteur cherchait sa faute sur `a`.
      // La liste des canaux est FERMÉE partout ailleurs — chez l'acteur depuis le 2026-08-04, sur la
      // sortie de scène depuis le 2026-08-19 — elle ne l'était pas ici, et le refus accusait le
      // mauvais terme.
      //
      // ⚠️ LA PRÉCISION SE POSE ICI, AU POINT D'ÉMISSION, et pas dans le lecteur de déclaration :
      // une borne posée là-bas est passée DEVANT les pierres tombales et a rendu muets les refus
      // nommés de `routing`, `label` et `transcription`. Un message réparé où il est écrit ne peut
      // rien avaler.
      const ligne = (ast.directives || []).find((d) =>
        d && d.type === 'Directive' && d.name === el.name && typeof d.runtime === 'string');
      const cause = ligne && canalFautif(ligne.runtime);
      errors.push({
        message: cause
          ? `'${el.name}:${ligne.runtime}' déclare un terminal, et ${cause} La déclaration s'écrit `
            + `'<nom>:<canal>' — le terminal n'est pas en cause.`
          : reste && reste !== el.name
            ? `terminal '${el.name}' non déclaré — segmentation bloquée sur '${reste}', absent des alphabets en portée`
            : `terminal '${el.name}' non déclaré — absent des alphabets en portée`,
        line: el.line,
      });
    }
    for (const k of COMPOSITES) if (el[k]) verifier(el[k]);
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) verifier(r.rhs || []);

  // ⛔ LE SUJET D'UNE PAIRE DÉSIGNE DES TERMINAUX, ET IL SE VALIDE COMME UN TERMINAL.
  // `EBNF.md` § « Réglages » : « le sujet vaut par paire : sans sujet, la portée elle-même comme
  // unité ; `*` désigne chaque terminal de la portée ; UN NOM DÉSIGNE LES TERMINAUX DE CE NOM ».
  // Un nom qu'aucun alphabet ni aucune déclaration ne porte ne désigne rien du tout — le réglage
  // n'a pas de destinataire, et il partait quand même dans l'arbre.
  //
  // ⛔ LE BALAYAGE EST RÉCURSIF, ET C'EST LA MESURE QUI L'IMPOSE : les paires vivent sous QUATRE
  // porteurs différents, à des profondeurs quelconques — `suffixQualifiers[].pairs` (sac collé au
  // symbole), `settings.pairs` sur un nœud (portée groupe) ET sur la règle (portée règle),
  // `qualifier.pairs` (sac posé dans le flux par `!()`). Un sac sous une voix de polymétrie descend
  // encore d'un cran. Énumérer des chemins fermerait les places qui se sont montrées et laisserait
  // les autres ; on reconnaît une paire à sa FORME — un objet qui porte un sujet.
  //
  // ⚠️ `*` EST LE SUJET UNIVERSEL, il ne se cherche dans aucun vocabulaire. Et le sujet POINTÉ
  // (`perc.dha:…`) est refusé ailleurs, avant d'arriver ici.
  const sujetsVus = new Set();
  const verifierLesSujets = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(verifierLesSujets); return; }
    const s = n.subject;
    if (typeof s === 'string' && s && s !== '*'
        && !codeVoice.has(s)
        && !known.has(s) && !declared.has(s) && !sujetsVus.has(s)) {
      sujetsVus.add(s);
      errors.push({
        message: `sujet de réglage '${s}:…' : '${s}' ne désigne aucun terminal — absent des `
               + `alphabets en portée et des noms déclarés. Un sujet vise les terminaux de son nom ; `
               + `'*' vise chaque terminal de la portée, et l'absence de sujet vise la portée entière`,
        line: n.line,
      });
    }
    for (const v of Object.values(n)) if (v && typeof v === 'object') verifierLesSujets(v);
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) verifierLesSujets(r);

  return errors;
}


// ⛔ CETTE TABLE EST PARTAGEE PAR LES DEUX FICHIERS, donc elle n'a qu'un domicile. La dupliquer
// ferait deux tables et la segmentation se perdrait entre elles — mesure : une scene sur 177
// plantait sur son absence, et le temoin d'arbre l'a nommee.
// ⛔ LE RESTE INCONSOMMÉ NE VOYAGE PAS DANS L'ARBRE. La segmentation le connaît, le refus le nomme,
// et entre les deux il vit ICI — hors des nœuds. Un champ posé sur un nœud SORT chez BPx et Kairos :
// ce serait une surface publiée que rien ne déclare, et ce que j'expose est déclaré.
export const restesDeSegmentation = new WeakMap();

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
