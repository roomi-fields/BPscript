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

import { texteDuDiagnostic, diagnostic } from './diagnostics.js';
import { sortieHeritee, alphabetHerite, octavesHerite, tuningHerite, evalHerite }
  from './actorResolver.js';
import { parse, ParseError } from './parser.js';
import { lesDefauts, motsInvoques, familles, canaux, clesDActeur, motReserve, formeDuMot } from './index-des-objets.js';
import { universeControlNames, resolveActorAlphabet, nomsDeTerminaux, loadLib, leRegistre, versionDuRegistre, librairiesQuiDeclarent } from './libs.js';
import { expandAlphabetTerminals } from './actorResolver.js';
import { resolveActorAlphabetSource } from './libs.js';
import { groupeDUnicite } from './libs.js';
import { describeVocabulary } from './vocabulaire.js';

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
      message: `'&${e.name}' replays a template that nothing captures — no '$${e.name}' in this `
        + `scene. The name is what pairs the master with the slave: with no master, the replay has `
        + `no choice to repeat. Write '$${e.name}' where the pattern is captured.`,
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
      errors.push(diagnostic('RESOLVE_OVERLAPPING_ACTORS_OUTPUT_BINDING', { p1: alphaBinding.subkey, p2: alphaBinding.runtime }, { line: alphaBinding.line || 0 }));
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
    errors.push(diagnostic('RESOLVE_OUTPUTS_SAME_SCENE_OUT', { p1: sortie.conflit.ecrite, p2: sortie.conflit.alphabet, p3: sortie.conflit.raccord }, { line: sortie.conflit.line }));
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
            throw new ParseError('RESOLVE_REMOTE_CONTEXT_MID_PATTERN', {},
              { line: rule.line ?? 0, col: 0 });
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
  const cat = canaux();
  const c = cat[canal];
  if (!c) return `channel '${canal}' does not exist — the channels are ${Object.keys(cat).join(', ')}. `
    + `The list is CLOSED.`;
  if (!c.out) return `'${canal}' is not an output — a terminal sounds, it is not read. The output `
    + `channels are ${Object.keys(cat).filter((k) => cat[k].out).join(', ')}.`;
  if (!c.writable) return `'${canal}' is a DESTINATION of the architecture, routed like the other `
    + `outputs, but WRITING it in a scene is still waiting for its dedicated device.`;
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
        errors.push(diagnostic(
          auRegistre ? 'RESOLVE_CALL_CONTROL_NOT_INVOKED' : 'RESOLVE_CALL_DOES_NOT_EXIST',
          { appel: citer(n), name: n.name }, { line: n.line }));
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
  // ⛔ SANS ALPHABET EN PORTÉE, UN SYMBOLE NON DÉCLARÉ EST REFUSÉ — Romain, 2026-09-02 : « si on
  // n'invoque pas core et qu'on n'a pas déclaré d'alphabet, la compilation plantera quand l'utilisateur
  // va utiliser un terminal non déclaré ». Ce validateur RENDAIT LA MAIN ici (« aucun alphabet →
  // rien à valider ») : une scène nue acceptait n'importe quel symbole, en silence. Une voix de code
  // garde ses symboles arbitraires par la clause ci-dessous, à sa place.

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
        errors.push(diagnostic('RESOLVE_COMPOUND_SOUND_OBJECT_DECLARED', { part }, { line: el.line }));
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
      // ⛔ QUATRE CAUSES, QUATRE CODES — 2026-09-04. Elles ne se distinguaient que par leur phrase :
      // un consommateur qui voulait savoir POURQUOI un terminal est refusé n'avait que la prose. Le
      // code est la surface, et il doit dire ce que la phrase disait.
      errors.push(diagnostic(
        cause ? 'RESOLVE_TERMINAL_DECL_CHANNEL'
          : !anyAlphabet ? 'RESOLVE_TERMINAL_NO_ALPHABET'
            : reste && reste !== el.name ? 'RESOLVE_TERMINAL_SEGMENTATION_STOPPED'
              : 'RESOLVE_TERMINAL_UNDECLARED',
        { name: el.name, runtime: ligne && ligne.runtime, cause, reste }, { line: el.line }));
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
      errors.push(diagnostic('RESOLVE_SETTING_SUBJECT_NAMES_TERMINAL', { s }, { line: n.line }));
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

export function emitSceneLibRefs(ast) {
  const axesHauteur = new Set(['alphabet', 'tuning', 'octaves', 'scale']); // portés par un autre canal
  const refs = [];
  for (const d of ast.directives || []) {
    if (!d || !d.name || !d.subkey || axesHauteur.has(d.name)) continue;
    // Une directive dont le NOM est une librairie chargeable et dont le POINT nomme une entrée
    // résoluble : c'est une invocation par provenance.
    const entree = loadLib(d.name, d.subkey);
    if (!entree) continue;
    // ⚠️ Le filtre exigeait `entree.notes` — il ne laissait donc passer QUE les alphabets, pour
    // lesquels je l'avais écrit. `sound.tabla_perc` résolvait sans rien émettre : l'invocation
    // était acceptée et ne PRODUISAIT rien. Accepter n'est pas transmettre — c'est le même défaut
    // que la directive de mètre qui parlait dans le vide. Corrigé le 2026-07-26 : toute entrée
    // résoluble émet son adresse, quel que soit ce qu'elle contient.
    const adresse = `${d.name}.${d.subkey}`;
    if (!refs.includes(adresse)) refs.push(adresse);
  }
  // TABLE DE CORRESPONDANCE d'une ENTRÉE (`in pedale transport.midi mapping.<table>`). C'est une
  // invocation de librairie comme une autre : son ADRESSE doit sortir, sinon la scène « déclare »
  // une table que l'aval ne voit jamais. Accepter n'est pas transmettre.
  //
  // ⚠️ ELLE SORT MÊME QUAND L'ENTRÉE NE RÉSOUT PAS, et c'est délibéré pour l'instant :
  // `lib/mapping.json` est volontairement VIDE tant que Romain n'a pas donné de vraie table
  // (arbitrage 2026-07-27), donc exiger la résolution refuserait TOUS les exemples ratifiés.
  // Le cri sur entrée inconnue est un chantier ouvert, tranché mais séquencé derrière un
  // renommage chez Kanopi — quand il arrivera, il vaudra ici comme ailleurs.
  for (const e of ast.inputs || []) {
    if (!e || !e.mapping) continue;
    const adresse = `mapping.${e.mapping}`;
    if (!refs.includes(adresse)) refs.push(adresse);
  }
  if (refs.length === 0) return;
  ast.libRefs = [...(ast.libRefs || []), ...refs.filter((r) => !(ast.libRefs || []).includes(r))];
}


export function deriveAlphabetFromTuning(ast) {
  if (!ast) return;
  const tuningAlpha = (tname) => { const t = loadLib('tuning', tname); return (t && t.alphabet) || null; };
  for (const actor of ast.actors || []) {
    const p = actor.properties || {};
    if (p.tuning && !p.alphabet) { const a = tuningAlpha(p.tuning); if (a) p.alphabet = a; }
  }
  const dirs = ast.directives || [];
  const tun = dirs.find((d) => d.name === 'tuning' && d.subkey);
  const alph = dirs.find((d) => d.name === 'alphabet' && d.subkey);
  if (tun && !alph) {
    const a = tuningAlpha(tun.subkey);
    // ⛔ LE MARQUEUR `_derivedFromTuning` EST SORTI LE 2026-08-21 — Romain : « UN ACCORDAGE SANS
    // ALPHABET N'A PAS DE SENS. Un accordage se pose nécessairement sur un 12TET, donc sur un
    // alphabet. » Cette dérivation n'est donc PAS un rattrapage, c'est le comportement normal : un
    // accordage PORTE son alphabet. Il n'y avait rien à marquer — le champ signalait une exception
    // qui n'en est pas une.
    //
    // ⚠️ ET IL AVAIT FUI DANS L'ARBRE PUBLIÉ. Son souligné annonçait un interne ; il sortait
    // pourtant jusqu'au consommateur, sur une scène du corpus, sans que la spec le déclare — c'est
    // le garde `la_spec_declare_les_champs_que_l_arbre_porte` qui l'a fait sortir, le jour où une
    // migration a fait changer de graphie la seule scène qui le portait.
    // Mesure avant retrait : ZÉRO lecteur sur les quinze dépôts de la tour. Aucun préavis dû.
    if (a) dirs.push({ type: 'Directive', name: 'alphabet', subkey: a, runtime: null, value: null,
                       aliases: null, modifiers: null, line: tun.line });
  }
}


/**
 * PROVENANCE DES LIAISONS D'ACTEUR → `actors[].libRefs` (contrat bpx-kairos-arbre §2.1).
 *
 * LE TROU QU'ELLE COMBLE. Une liaison d'acteur sort en NOM NU : `actors.bols.alphabet = 'abc'`.
 * Ce nom ne dit pas d'où il vient. Tant que l'entrée est au catalogue standard, l'aval s'en
 * sort — il la retrouve par son nom. Mais quand elle vient d'une librairie DÉCLARÉE PAR LA
 * SCÈNE (`test_alphabets.abc`), le nom nu est une impasse : Kairos ne connaît pas `abc`, et
 * il ne DOIT pas le deviner — il lit le domaine déclaré DANS le fichier, il ne l'infère jamais
 * d'une adresse. Sans provenance, sa seule issue serait de renifler, c'est-à-dire d'inventer.
 *
 * CE QU'ELLE ÉMET, et rien de plus. L'adresse canonique `<fichier>.<entrée>`, UNIQUEMENT quand
 * l'entrée vient d'une librairie déclarée par la scène. Une liaison servie par le catalogue
 * standard n'émet RIEN : elle se retrouve déjà par son nom, et lui poser une adresse ferait du
 * bruit là où il n'y a pas de question. Champ OMIS si vide, jamais `[]` (patron `cvInstances`).
 *
 * POURQUOI CE N'EST PAS LE MIROIR DE LA PORTÉE SCÈNE. `ast.libRefs` naît des invocations par
 * provenance (`factory.` / `mine.`) — mesuré sur le corpus des 95 : ZÉRO scène en émet. Le
 * canal existe et il est testé (`test_libref_provenance.js`), mais aucune scène ne l'emprunte.
 * Rien à recopier vers l'acteur, donc : l'adresse ne se transporte pas d'en haut, elle se
 * DÉRIVE de la résolution — d'où `resolveActorAlphabetSource`, qui répond « d'où vient-il »
 * là où le résolveur répond « existe-t-il ».
 */
export function emitActorLibRefs(ast) {
  for (const actor of ast.actors || []) {
    const alpha = (actor.properties || {}).alphabet;
    if (!alpha) continue;
    const src = resolveActorAlphabetSource(alpha, ast.directives);
    if (!src || !src.lib) continue;   // catalogue standard → aucune adresse à poser
    actor.libRefs = [`${src.lib}.${alpha}`];
    // L'ADRESSE REMPLACE L'ARDOISE, elle ne la double PAS.
    //
    // Mesuré : émettre les deux fait CRIER Kairos — « collision de domaine 'alphabet' (acteur
    // 'bols') : 'test_alphabets.abc' vs 'slot legacy' — pas de dernier-qui-parle ». Il a raison
    // de refuser : deux invocations du même domaine à la même portée, c'est à l'émetteur de
    // trancher, pas au résolveur de deviner laquelle gagne.
    //
    // Et l'ardoise ne peut pas être celle qui reste : mesuré aussi, un nom nu (`abc`) n'est
    // cherché que dans le catalogue STANDARD — même le fichier injecté ne le rend pas trouvable.
    // Seule l'adresse porte la provenance. Garder les deux serait donc une voie parallèle dont
    // l'une ne mène nulle part : exactement le patron qu'on supprime.
    //
    // Le RETRAIT lui-même est différé : `properties.alphabet` sert au pipeline INTERNE
    // (résolution d'acteur, validation des terminaux), qui tourne encore après nous.
    // Cf. `retirerArdoiseAlphabet`, appelée en toute fin de chaîne.
  }
}


/**
 * L'ARBRE DIT LUI-MÊME QUELS NOMS SONT DES NOTES — `ast.noteTerminals`.
 *
 * ORDRE de l'architecte (2026-07-29), sur une règle que Romain venait de graver le matin même
 * (`hub/decisions/2026-07-29-notre-mecanique-n-utilise-que-des-alphabets.md`) : « notre mécanique
 * ne doit utiliser QUE des alphabets ; les conventions ne doivent être connues QUE du frontend
 * BP3 ». Et sa consigne pour ici : l'arbre porte LE FAIT, pas un nom d'alphabet que le
 * consommateur devrait interpréter.
 *
 * ⚠️ POURQUOI CE N'EST PAS UNE FORME QUE J'INVENTE — je n'ai pas à décider du formalisme du
 * langage (règle gravée par Romain le 2026-07-29). Le champ EXISTE, ratifié et daté :
 * `hub/decisions/2026-07-28-le-fait-ce-nom-est-une-note-vient-du-frontal.md` le définit pour
 * bp3-frontend — liste PLATE de noms nus, au niveau SCÈNE, ABSENT ≠ VIDE, contenant « les noms
 * présents dans la scène qu'il reconnaît comme notes : pas le catalogue, pas une table, la
 * résolution DÉJÀ FAITE ». On généralise ce champ, on n'en crée pas un second.
 *
 * CE QUE ÇA RETIRE À L'AVAL, et c'est la raison d'être : Kanopi interrogeait un prédicat à TROIS
 * conventions BP3 (anglaise, française, indienne). La bibliothèque déclare DOUZE alphabets —
 * gamelan_pelog, shruti23, bohlen_pierce et shakuhachi n'ont AUCUNE image dans ces trois-là. Un
 * consommateur qui pose la question porte donc une décision sémantique qui ne lui appartient pas,
 * et qui n'a pas de réponse pour les trois quarts du catalogue. Ici elle en a une, toujours :
 * c'est moi qui possède les alphabets.
 *
 * ABSENT ≠ VIDE, et la distinction porte du sens :
 *   · champ ABSENT  = aucun alphabet résolvable ici (hauteur opaque, voix-code pure) — je ne sais
 *     PAS, et l'aval ne doit pas lire mon silence comme « aucune note » ;
 *   · liste VIDE    = un alphabet est en portée et AUCUN nom de la scène n'est une note. C'est un
 *     fait, pas une ignorance.
 */
export function emitNoteTerminals(ast) {
  const { terminaux, aUnAlphabet } = terminauxEnPortee(ast);
  if (!aUnAlphabet) return;                       // je ne sais pas → champs ABSENTS, jamais []
  // Les noms PRÉSENTS dans la scène, des deux côtés de la flèche : une tête de règle qui porte un
  // nom de note en est un cas, et c'est justement celui que l'aval cherche à écarter de sa lecture
  // de structure. Descendre jusqu'aux FEUILLES — un nom sous un groupe polymétrique ou sous une
  // note ancrée compte autant qu'un voisin de surface (faute payée quatre fois en juillet).
  const presents = new Set();
  const recolter = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(recolter);
    if (typeof n.name === 'string') presents.add(n.name);
    for (const k in n) if (n[k] && typeof n[k] === 'object') recolter(n[k]);
  };
  recolter(ast.subgrammars || []);

  // ⚠️ LE PARTAGE EN DEUX — CORRECTION D'UN DÉFAUT QUE J'AI LIVRÉ, PAS UNE EXTENSION (2026-07-29).
  // J'ai d'abord émis UN champ, en reprenant le NOM que la décision du 2026-07-28 définit sans
  // reprendre la DISTINCTION qui le justifie — elle écrit pourtant « champ DISTINCT de
  // alphabetTerminals : deux sources, deux sens ; les fondre est INTERDIT ». Résultat mesuré :
  // mon arbre AFFIRMAIT que `dha`, `dhin`, `ka` (frappes de tabla) et `a`, `b`, `c` (symboles
  // abstraits) SONT des notes, quand la donnée dit l'inverse en toutes lettres. Trouvé par
  // bp3-frontend, qui émet les deux champs depuis le début.
  //
  // ⚠️ LE CRITÈRE NE SE DÉDUIT PLUS, IL SE LIT — REMPLACEMENT, PAS AJOUT (Romain, 2026-07-30,
  // `hub/decisions/2026-07-30-ce-qui-sonne-ce-qui-dure-ce-qui-resout-une-hauteur-se-declare.md`) :
  // « il faut que soit spécifié non seulement si c'est un objet sonnant mais aussi s'il résout une
  // hauteur », et « aucune des trois propriétés ne se déduit ». L'alphabet le DÉCLARE, par
  // `resolvesPitch`.
  //
  // CE QUE LE CRITÈRE DÉDUIT MANQUAIT, ET C'EST CE QUI L'A FAIT RETIRER. Je lisais `defaultTuning`
  // — un alphabet sans accordage ne résolvait pas de hauteur. Mesuré sur les 22 entrées des deux
  // catalogues : UN SEUL faux négatif, mais il est réel — `shakuhachi`. Il ne porte aucun
  // accordage et résout pourtant une hauteur : `lib/octaves.json` lui déclare des registres nommés
  // (otsu, kan, daikan) et ses altérations *meri* et *kari* valent un demi-ton. Les quatre autres
  // sans accordage (tabla, simple, dhadhatite, tryCsoundObjects) étaient bien classés.
  // Un critère juste 21 fois sur 22 reste un critère qui DEVINE ; celui-ci LIT.
  //
  // ⚠️ ET IL RESTE UN TROU QUE CE CHANGEMENT DÉPLACE SANS LE FERMER, dit ici pour qu'on ne le
  // cherche pas ailleurs : `shakuhachi` est désormais une NOTE et ne porte AUCUNE ancre — ni
  // accordage, ni diapason, ni note de base. La donnée dit qu'il résout une hauteur, pas PAR
  // RAPPORT À QUOI. Kairos l'avait signalé le 2026-07-29 ; le combler ici reviendrait à choisir une
  // règle que la donnée n'énonce pas. Consommateurs prévenus avant écriture (préavis du
  // 2026-07-30 à bpx, kairos, bp3-frontend).
  //
  // PRÉCÉDENCE, et elle n'est pas de moi : la décision du 2026-07-28 la fixe — « un nom présent
  // dans les deux champs est traité comme NOTE, c'est l'ordre du C » (SEARCHNOTE avant
  // SEARCHTERMINAL). On émet donc fidèlement dans les deux ; c'est au lecteur d'appliquer la
  // règle, pas à moi de trancher en amputant un champ.
  const aHauteur = (nomAlphabet) => {
    const lib = resolveActorAlphabet(nomAlphabet, ast.directives);
    return !!(lib && lib.resolvesPitch);
  };
  const notes = new Set();
  const sansHauteur = new Set();
  const verser = (nomAlphabet, octaves) => {
    const lib = resolveActorAlphabet(nomAlphabet, ast.directives);
    if (!lib || !nomsDeTerminaux(lib)) return;
    const cible = aHauteur(nomAlphabet) ? notes : sansHauteur;
    for (const t of expandAlphabetTerminals(lib, octaves)) cible.add(t);
    const alts = lib.alterations && typeof lib.alterations === 'object' && !Array.isArray(lib.alterations)
      ? Object.keys(lib.alterations) : [''];
    for (const note of nomsDeTerminaux(lib)) for (const alt of alts) cible.add(note + alt); // forme nue
  };
  const sceneAlpha = (ast.directives || []).find((d) => d.name === 'alphabet' && d.subkey);
  const sceneOct = (ast.directives || []).find((d) => d.name === 'octaves' && (d.subkey || d.runtime));
  if (sceneAlpha) verser(sceneAlpha.subkey, sceneOct ? (sceneOct.subkey || sceneOct.runtime) : null);
  for (const a of ast.actors || []) {
    const p = a.properties || {};
    if (p.alphabet) verser(p.alphabet, p.octaves || null);
  }

  const dansLaScene = (ens) => [...presents].filter((n) => ens.has(n)).sort();
  ast.noteTerminals = dansLaScene(notes);
  ast.alphabetTerminals = dansLaScene(sansHauteur);
}


/**
 * Résolution de l'invocation d'homomorphisme par SYMBOLE NU (ratifié Romain 2026-07-17).
 * Un Symbol de RHS dont le nom = une section d'homomorphisme chargée (@homomorphism.<X>),
 * et qui n'est NI un non-terminal (LHS de règle) NI un terminal d'alphabet en portée
 * (précédence RATIFIÉE terminal > règle > homo, contrat bpscript-bpx L31), devient un
 * MARQUEUR per-occurrence : on pose `role:'homomorphism'` sur le nœud (type Symbol conservé,
 * il reste un élément positionnel du flux). BPx compte les occurrences en portée (profondeur
 * k) et applique chains[note][k-1] (ou les paires). La RÉPÉTITION du symbole EST la
 * profondeur — aucun index posé ici. Passe BPx-ONLY : jusqu'à la suppression de
 * compileBPS le 2026-07-19 (commit 1b974f5), le chemin BP3 hérité reparsait
 * indépendamment et ne voyait jamais ce champ → byte-id préservé.
 * Cf. AST.md §HomomorphismDeclAST, message bpx [464].
 */
export function resolveHomomorphismMarkers(ast) {
  if (!ast || !Array.isArray(ast.homomorphisms) || ast.homomorphisms.length === 0) return;
  const homoNames = new Set(ast.homomorphisms.map((h) => h && h.name).filter(Boolean));
  if (homoNames.size === 0) return;
  // Non-terminaux : LHS de règle (précédence : la règle gagne sur l'homo).
  const nonterminals = new Set();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) (r.lhs || []).forEach((s) => s && s.name && nonterminals.add(s.name));
  // Terminaux d'alphabet en portée (précédence : le terminal gagne sur l'homo).
  const terminals = new Set();
  const addAlphabet = (name, octaves) => {
    const lib = resolveActorAlphabet(name, ast.directives);
    if (!lib || !nomsDeTerminaux(lib)) return;
    for (const t of expandAlphabetTerminals(lib, octaves)) terminals.add(t);
    const alts = lib.alterations && typeof lib.alterations === 'object' && !Array.isArray(lib.alterations)
      ? Object.keys(lib.alterations) : [''];
    for (const note of nomsDeTerminaux(lib)) for (const alt of alts) terminals.add(note + alt);
  };
  const sa = (ast.directives || []).find((d) => d.name === 'alphabet' && d.subkey);
  const so = (ast.directives || []).find((d) => d.name === 'octaves' && (d.subkey || d.runtime));
  if (sa) addAlphabet(sa.subkey, so ? (so.subkey || so.runtime) : null);
  for (const a of ast.actors || []) { const p = a.properties || {}; if (p.alphabet) addAlphabet(p.alphabet, p.octaves || null); }
  const mark = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(mark); return; }
    if (node.type === 'Symbol' && node.name && homoNames.has(node.name)
        && !nonterminals.has(node.name) && !terminals.has(node.name)) {
      node.role = 'homomorphism';
    }
    for (const k in node) { const v = node[k]; if (v && typeof v === 'object') mark(v); }
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) mark(r.rhs);
}


/**
 * Annote les backticks (voix de code) SUR LE NŒUD — pas de table parallèle (directive
 * Romain 2026-06-17, confirmée BPx + Kanopi). Chaque nœud backtick porte :
 *   - `_btName` : étiquette unique (compteur PROPRE, ordre du document, indépendant de
 *     l'ancien format). C'est le NOM du terminal dérivable, lu par BPx (loadGrammar.ts) ;
 *     identité STRUCTURELLE en tête de nœud.
 *   - `code`    : déjà posé par le parser.
 *   - `payload` : DONNÉE D'ÉVÉNEMENT de la voix de code (KAI-9, point de bascule unique aligné
 *     bpx + Kairos) — `{ nature:'code', interp }`. L'`interp` est l'interpréteur : tag explicite
 *     (`sc: …`, `py: …`) sinon 'auto' ; un backtick NON tagué hérite de l'`eval` de l'acteur en
 *     tête de sa règle (`actor drums eval.strudel` → 'strudel'). Scellé DANS LE PAYLOAD (pas en
 *     tête de nœud) : c'est ce qui VOYAGE dans la dérivation jusqu'à Kairos, qui matérialise
 *     event.output = { runtime:'code', device:interp }. BPx porte le payload opaque ; Kairos le lit.
 */
export function annotateBackticks(ast) {
  let counter = 0;
  const isBt = (el) => el && (el.type === 'BacktickStandalone' || el.type === 'BacktickInline');
  // 1. Étiquette + payload de voix de code (nature:'code' + interp initial : tag ou 'auto').
  //    L'interp est scellée DANS LE PAYLOAD (payload.interp), pas en tête de nœud : c'est la
  //    donnée d'événement qui VOYAGE dans la dérivation jusqu'à Kairos (qui matérialise
  //    event.output = {runtime:'code', device:interp}). Point de bascule unique, aligné bpx/Kairos.
  const label = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== 'object') continue;
      if (isBt(el)) {
        el._btName = `BT${el.tag || 'auto'}${counter++}`;
        el.payload = { ...(el.payload || {}), nature: 'code', interp: el.tag || 'auto' };
      }
      if (el.elements) label(el.elements);
      if (el.voices) for (const v of el.voices) label(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) label(rule.rhs);
  // ⚠️ ET LES CORPS DE MACRO, qui n'étaient parcourus PAR RIEN. Un bloc de code y voyageait sans
  // nature et sans langage — ni étiqueté, ni refusé : muet de bout en bout. Mesuré le 2026-07-28
  // sur une question de Romain, qui décrit la macro comme une façon LÉGITIME d'associer un nom à
  // du code (« pour ne pas avoir à écrire le code dans les règles »). Une écriture qu'on veut
  // légitime ne peut pas être le seul endroit où le langage n'est jamais vérifié.
  // Coût mesuré AVANT : 0 scène sur 442 porte du code dans un corps de macro.

  // 2. Résolution 'auto' → eval de L'ACTEUR QUI QUALIFIE LE BLOC (sur payload.interp).
  //
  // ⚠️ CE CHEMIN A CHANGÉ LE 2026-07-28. Il lisait le nom de la TÊTE DE RÈGLE et le cherchait dans
  // la table des acteurs : c'est ce qui obligeait à nommer une règle comme un acteur — l'amalgame
  // que Romain a qualifié d'erreur grave, et que la règle d'unicité refuse désormais. Ce chemin
  // était donc DEVENU MORT : une tête ne peut plus porter un nom d'acteur.
  // Il est remplacé, pas doublé : le langage vient de l'acteur qui QUALIFIE le bloc par le point
  // (`drums.\`note("c3")\``), là où il qualifie déjà une note (`sitar.Sa`). Un nom de règle
  // redevient une étiquette pour appeler la règle, et rien d'autre.
  //
  // ⛔ ET LA CASCADE A TROIS NIVEAUX, LE PLUS PROCHE L'EMPORTE : l'ACTEUR qui qualifie le bloc par
  // le point, puis la SCÈNE par sa ligne `eval.<moteur>`, puis le SOCLE — `core` porte `js`.
  // Le tag écrit sur l'occurrence l'emporte sur les trois : il est posé avant, à l'étape 1.
  //
  // ⚠️ LE NIVEAU SCÈNE EXISTAIT DÉJÀ DANS L'ARBRE ET UN SEUL LECTEUR L'IGNORAIT — celui-ci.
  // `eval.tidal` en tête de scène descend dans chaque acteur déclaré ET fabrique l'acteur implicite
  // qui le porte ; mesuré. Un backtick NU du flux était refusé pendant que l'acteur implicite de sa
  // propre scène nommait son langage. Ce n'était pas un niveau à construire, c'était un niveau à
  // consulter.
  //
  // Le socle vit en DONNÉE (`core.defaults.components.eval`), jamais en dur : une valeur écrite ici
  // serait invisible et personne ne pourrait la surcharger.
  const acteurEval = {};
  for (const a of ast.actors || []) if (a.properties && a.properties.eval) acteurEval[a.name] = a.properties.eval;
  const sceneEval = (ast.directives || []).find((d) => d.name === 'eval' && (d.subkey || d.runtime));
  const socleEval = (lesDefauts(ast) || {}).eval;
  const parDefaut = (sceneEval && (sceneEval.subkey || sceneEval.runtime)) || socleEval || null;
  const resoudre = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== 'object') continue;
      if (isBt(el) && el.payload && el.payload.interp === 'auto') {
        const proche = (el.actor && acteurEval[el.actor]) || parDefaut;
        if (proche) el.payload.interp = proche;
      }
      if (el.elements) resoudre(el.elements);
      if (el.voices) for (const v of el.voices) resoudre(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) resoudre(rule.rhs);

  // 2bis. LES SITES SANS ACTEUR — le backtick de tête de scène, la définition de code, la courbe.
  //
  // ⛔ ILS ÉTAIENT RÉSOLUS AU PARSEUR, PAR UN SECOND MOTEUR DE REFUS. Le parseur exigeait leur tag
  // parce qu'aucun acteur ne les entoure ; l'aval résolvait les autres. Deux lieux pour une seule
  // question, et depuis que le socle nomme un langage, le second n'avait plus rien à refuser.
  // Il est SUPPRIMÉ, pas désactivé : `splitBacktickTag` rend `tag:null` et ne juge plus.
  //
  // ⚠️ ET C'EST L'AVAL QUI DOIT TRANCHER, PAS LE PARSEUR : le parseur voit la scène ligne par ligne,
  // donc une ligne `eval.<moteur>` écrite APRÈS un backtick lui serait invisible, et « le plus
  // proche l'emporte » deviendrait « le plus haut dans le fichier l'emporte ». Aucun de ces trois
  // sites n'a d'acteur : leur cascade est scène, puis socle.
  //
  // ⚠️ ILS SONT QUATRE, ET J'EN AVAIS BRANCHÉ TROIS. `init` est le quatrième — un garde l'a dit en
  // rougissant, et il avait raison sur le fond alors que son assertion portait sur l'ancienne
  // règle : « aucun acteur ne l'entoure ». Retirer le refus du parseur sans brancher ce site-là
  // aurait laissé partir un bloc de code au langage NUL, en silence. Le trou aurait changé de
  // place au lieu de se fermer.
  if (parDefaut) {
    const poser = (n) => { if (n && typeof n === 'object' && /^Backtick/.test(n.type || '') && !n.tag) n.tag = parDefaut; };
    for (const b of ast.backticks || []) poser(b);
    for (const e of ast.init || []) poser(e);
    for (const d of ast.defs || []) if (d && d.kind === 'code' && !d.tag) d.tag = parDefaut;
    for (const dec of ast.declarations || []) if (dec && dec.curve && !dec.curve.tag) dec.curve.tag = parDefaut;
  }

  // 3. FAIL-LOUD orphelin (décision CV-curve 2026-07-04 + ajustement [299]) : un backtick
  //    de flux resté `interp:'auto'` n'a NI tag NI eval d'acteur en tête → langage inconnu,
  //    jamais deviné. Erreur claire (non fatale : l'AST reste produit, Kanopi l'affiche).
  //    Le socle le nomme désormais pour toute scène, donc ce cri ne se déclenche que si la donnée
  //    de socle est absente — un catalogue amputé, jamais une scène mal écrite.
  const errors = [];
  const scanOrphans = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== 'object') continue;
      if (isBt(el) && el.payload && el.payload.interp === 'auto') {
        errors.push(diagnostic('RESOLVE_BACKTICK_LANGUAGE_MUST_KNOWN', {}, { line: el.line }));
      }
      if (el.elements) scanOrphans(el.elements);
      if (el.voices) for (const v of el.voices) scanOrphans(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) scanOrphans(rule.rhs);
  // Même portée que l'étiquetage : un corps de macro est un endroit où du code peut s'écrire,
  // donc un endroit où son langage doit être connu. Il n'a pas de tête de règle dont hériter —
  // le tag est donc, aujourd'hui, la seule façon d'y dire le langage.
  return errors;
}


/**
 * POSE LE DESTINATAIRE DE CHAQUE RÉGLAGE SUR LE SAC QUI LE PORTE.
 *
 * CE QUE ÇA RÉPARE. Un sac de réglages voyageait avec sa NATURE et sa PORTÉE, jamais avec sa
 * DESTINATION : `!(vel:50)` arrivait en aval indistinguable de `!(chan:3)` et de
 * `!(transpose:3/2)`, alors que les trois vont à trois outils différents — toutes les sorties, le
 * runtime MIDI, Kairos. Seul le NOM de la clé les séparait, donc tout consommateur devait
 * redeviner la destination avec une table recopiée chez lui. Une table recopiée dérive : le jour
 * où une clé change de librairie, rien ne rougit et le réglage part au mauvais destinataire SANS
 * ERREUR. L'information existait pourtant depuis toujours, dans le champ `resolvedBy` de la
 * librairie déclarante — elle s'arrêtait au chargeur.
 *
 * LA FORME EST UNE TABLE, PAS UNE VALEUR, et la mesure l'impose : un sac unique peut mélanger
 * les destinataires — `!(vel:50, transpose:3/2, volume:90)` en réunit trois. Une valeur seule
 * aurait donc obligé à en choisir une et à taire les autres. `resolvedBy` est parallèle à
 * `params`, clé pour clé.
 *
 * LE NOM EST CELUI DE LA SOURCE, délibérément : la librairie écrit `resolvedBy`, le sac écrit
 * `resolvedBy`, la valeur est portée VERBATIM. Aucune traduction, donc aucune table de
 * correspondance à tenir entre deux vocabulaires.
 *
 * ⚠️ CE QUI N'EST PAS ANNOTÉ EST UNE ABSENCE ASSUMÉE, JAMAIS UNE INVENTION. Un contrôleur nommé
 * par la scène (`cc mon_nom:98`) n'est déclaré par aucune librairie : il n'a pas de destinataire
 * lisible, et sa clé reste donc hors de la table plutôt que d'en recevoir un supposé. Le trou est
 * visible, ce qui est le but.
 */
export function poserLeDestinataireDesReglages(ast, libCtx) {
  const table = libCtx?.controlResolvedBy || {};
  const tableQualifiee = libCtx?.controlQualifiedResolvedBy || {};
  const vu = new Set();
  const walk = (n) => {
    if (!n || typeof n !== 'object' || vu.has(n)) return;
    vu.add(n);
    if (Array.isArray(n)) { for (const x of n) walk(x); return; }
    const params = n.payload && n.payload.params;
    if (params && typeof params === 'object') {
      // ⚠️ LE PRÉFIXE DÉCIDE DU DESTINATAIRE, ET C'EST TOUT CE POUR QUOI IL EXISTE. La table par nom
      // NU rend la déclaration chargée en DERNIER : `expression.pan` en recevait le destinataire
      // d'`audio`, donc la scène compilait et le réglage partait quand même au mauvais outil — un
      // préfixe accepté et ignoré, le pire des deux mondes. Trouvé par le garde en naissant.
      // Les paires portent `lib` quand l'auteur l'a écrit ; on les lit sur le nœud ET sur ses sacs
      // collés, un sac portant ses propres paires repliées.
      const origine = new Map();
      const noter = (liste) => { for (const pr of liste || []) if (pr && pr.lib) origine.set(pr.key, pr.lib); };
      noter(n.pairs);
      for (const sq of (n.suffixQualifiers || [])) noter(sq && sq.pairs);
      const dest = {};
      for (const cle of Object.keys(params)) {
        const lib = origine.get(cle);
        const qualifie = lib ? tableQualifiee[`${lib}.${cle}`] : undefined;
        if (qualifie) dest[cle] = qualifie;
        else if (table[cle]) dest[cle] = table[cle];
      }
      if (Object.keys(dest).length) n.payload.resolvedBy = dest;
    }
    for (const v of Object.values(n)) walk(v);
  };
  walk(ast);
}


/**
 * ⛔ UN POINT D'ATTENTE NOMME CE QU'IL ATTEND, ET CE NOM SE DÉCLARE.
 *
 * DÉCISION DE ROMAIN, 2026-08-15 : « oui il doit être déclaré, sinon on ne sait pas ce qu'on
 * attend ». La forme de déclaration existe depuis le 2026-08-04 — `var <nom> in.<canal>` — et
 * c'est son EXIGENCE qui manquait, pas sa graphie.
 *
 * CE QUI PASSAIT : `<!depart` et `<!depatr` étaient deux points d'attente valides et sans rapport,
 * en silence. Une coquille ne casse rien — elle fabrique une seconde attente que rien ne viendra
 * jamais satisfaire, et la dérivation s'arrête pour toujours sans un mot.
 *
 * ⛔ LE REFUS PORTE SUR LA RACINE, ADRESSÉE OU NON — une seule règle, pas deux. Dans `<!p.60`, `p`
 * est le RÔLE et `.60` est l'ADRESSE : c'est `p` qui se déclare, jamais l'adresse
 * (`LANGUAGE.md:1517` : « l'adresse de la source se colle au point d'attente — `<!sync1.60` écoute
 * le numéro 60 de l'entrée `sync1` »). Romain, même jour : « bien oui, sinon comment on sait ce
 * qu'est `p` ? ».
 *
 * CE QUI COMPTE COMME DÉCLARATION : tout ce qui CRÉE le nom dans la scène — une entrée
 * (`var <rôle> in.<canal>`), une variable de travail, une déclaration de porte ou de trigger, un
 * acteur. On ne restreint pas à la seule entrée : la question est « ce nom existe-t-il », pas
 * « par quel mot ».
 *
 * ⛔ DEUX RACINES, ET CE NE SONT PAS DEUX FORMES RIVALES — arbitrage de Romain, 2026-08-15 : « un
 * point de synchronisation, dans tous les cas, attend un ÉVÉNEMENT. Un événement peut être
 * déclenché par une infinité de choses. » La DÉCLARATION dit D'OÙ ça vient, la QUALIFICATION dit
 * QUOI exactement, et ce sont deux questions :
 *     <!sync1                        tout événement de `sync1` lève le point
 *     <!sync1.60                     seulement l'adresse 60
 *     <!in.midi(note:60, channel:3)  pleinement qualifié, sans passer par un rôle
 * La racine est donc SOIT un rôle déclaré, SOIT une DIRECTION — et une direction n'a rien à
 * déclarer, elle nomme le canal lui-même. La liste des directions se lit dans la DONNÉE (les mots
 * de direction du socle) : aucun nom n'est écrit ici, et le jour où une direction s'ajoute, ce
 * refus la suit sans une ligne.
 */
export function refuserAttenteNonDeclaree(ast) {
  const connus = new Set();
  for (const i of (ast.inputs || [])) for (const n of (i.names || (i.name ? [i.name] : []))) connus.add(n);
  for (const v of (ast.vars || [])) for (const n of (v.names || [])) connus.add(n);
  for (const d of (ast.declarations || [])) if (d && d.name) connus.add(d.name);
  for (const a of (ast.actors || [])) if (a && a.name) connus.add(a.name);

  // LES MOTS DE DIRECTION, DÉRIVÉS DU CATALOGUE DES CANAUX : chaque canal déclare les directions
  // qu'il autorise (`midi: {in:true, out:true}`), donc les mots de direction sont exactement les
  // champs booléens que ce catalogue emploie. Aucun nom n'est écrit ici, et le jour où une
  // direction s'ajoute au catalogue, ce refus la suit sans une ligne.
  // ⚠️ ET LA DÉRIVATION NE PASSE PAS PAR `reservedDirectives` : cette liste porte `transport`, un
  // mot RETIRÉ du langage, dont la légende parle encore de direction. On aurait exempté une racine
  // morte. Le catalogue, lui, ne décrit que ce qui existe.
  const directions = new Set();
  for (const canal of Object.values(canaux())) {
    if (!canal || typeof canal !== 'object') continue;
    for (const [cle, valeur] of Object.entries(canal)) {
      if (typeof valeur === 'boolean' && valeur === true && cle !== 'writable') directions.add(cle);
    }
  }

  // ⛔ LE REFUS À L'USAGE D'UNE ENTRÉE SANS CANAL A ÉTÉ ÉLAGUÉ AVEC LA FORME QU'IL GARDAIT.
  // Un rôle sans canal se refusait ICI, au point d'attente qui l'employait ; depuis l'arbitrage de
  // Romain du 2026-08-23, il se refuse à la DÉCLARATION (`parser.js`, `in <rôle>`). Le filtre qui
  // vivait à cette place ne pouvait plus trouver une seule entrée : garder un refus dont l'accusé
  // ne peut plus naître, c'est laisser croire qu'un cas est couvert quand il est devenu impossible.
  const erreurs = [];
  const vus = new Set();
  (function marcher(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const e of n) marcher(e); return; }
    if (n.type === 'Wait' && typeof n.name === 'string'
        && !connus.has(n.name) && !directions.has(n.name) && !vus.has(n.name)) {
      vus.add(n.name);
      erreurs.push({
        message: `'<!${n.name}' waits for a signal that nothing declares — no input, variable, `
          + `gate or actor of this scene bears the name '${n.name}'. Declare it: `
          + `'in.<channel> ${n.name}'. Without a declaration, a typo builds a SECOND wait that `
          + `nothing will ever satisfy, and the derivation stops forever without a word.`,
        line: n.line,
      });
    }
    // ⚠️ L'ADRESSE NE SE VALIDE PAS ICI, ET C'EST UN ÉCART DE SPÉCIFICATION, PAS UN OUBLI.
    // `EBNF.md` § « Le point d'attente » écrit : « un identifiant est l'étiquette produite par la
    // table de correspondance ». Un refus posé sur cette phrase — l'adresse nommée exige une table —
    // a été écrit, mesuré, et RETIRÉ le 2026-08-29 : trois gardes de ce dépôt et une scène du corpus
    // prescrivent l'inverse. `test/declaration_d_entree.mjs:178` asserte que `<!pedale.suivant`
    // COMPILE sur une entrée sans table, et `wait-for-key.bps` écrit `<!touches.Space` — le nom
    // d'une touche, que le clavier produit sans qu'aucune table soit déclarée.
    // ⇒ La phrase de la spécification et ce que le langage admet ne coïncident pas. L'écart est
    // remonté à Romain ; il ne se tranche pas ici.
    for (const k in n) marcher(n[k]);
  })(ast);
  return erreurs;
}


/**
 * GARDE — UN SEUL ESPACE DE NOMS. Rien ne peut porter le nom d'autre chose.
 *
 * Règle de Romain (2026-07-28) : « il ne faut AUCUNE AMBIGUÏTÉ POSSIBLE. RIEN ne peut avoir des
 * noms identiques. À chaque fois qu'on déclare un truc dont le nom existe déjà, ça doit être
 * signalé par une ERREUR. »
 *
 * ⚠️ LE CRITÈRE EST L'EFFET, JAMAIS LA FORME DE LA LIGNE. Ce qui est refusé, c'est ce qui CRÉE un
 * nom. Une écriture qui pose une PROPRIÉTÉ sur un nom existant reste permise — `gate Sa:sc` dit
 * le type temporel et le routage d'un terminal, elle ne crée aucun nom rival : mesuré, le nœud
 * produit est identique avec et sans elle. Un garde qui filtrerait sur « ça commence par une
 * directive » refuserait cette forme ratifiée et laisserait passer une tête de règle ambiguë.
 *
 * DEUX ÉNONCÉS, TOUS DEUX GLOBAUX — aucune portée, et c'est mesuré, pas supposé :
 *   A. une TÊTE DE RÈGLE ne peut porter le nom d'aucune AUTRE SORTE de chose (terminal de
 *      l'alphabet actif, macro, alias, entrée, acteur, variable de travail, scène, objet CV,
 *      DRAPEAU) ;
 *   B. deux déclarations qui CRÉENT un nom ne peuvent pas porter le même, ni le nom d'un terminal.
 *
 * ⚠️ CE QUI N'EST PAS DEDANS, ET C'EST LA MOITIÉ DU TRAVAIL : les têtes de règle ne se heurtent
 * JAMAIS entre elles. Une tête répétée n'est pas un conflit, c'est une ALTERNATIVE — le choix et
 * les poids, c'est-à-dire le mécanisme même d'une grammaire stochastique ; et deux sous-grammaires
 * sont des PASSES successives, pas des espaces parallèles, donc un même nom y est le même symbole
 * réécrit plus tard. Un témoin de garde m'avait été prescrit qui refusait ce cas : mesuré, il
 * aurait refusé 120 scènes sur 333. C'est en le mesurant qu'il est tombé, pas en le relisant.
 *
 * ⚠️ UN DRAPEAU CRÉE UN NOM, DEPUIS LE 2026-07-30 (Romain, `hub/decisions/2026-07-30-trois-
 * arbitrages-nature-fabrique-drapeaux.md`) : « les drapeaux doivent être inclus dans l'espace de
 * déduplication des noms ». C'était un TROU, pas un espace séparé légitime — mesuré sur les 272
 * scènes du corpus : 3 portent un drapeau, toutes nommées `section`, zéro homonymie, donc le
 * corpus ne bouge pas en fermant le trou. Ce qui crée le nom, c'est le drapeau LUI-MÊME
 * (`var section flag: …`, ex-`flag section: …` — la forme de tête de scène est tombée le
 * 2026-08-05), PAS ses états : `calm`/`full` dans `var section flag: calm:1, full:2` ne sont
 * que des étiquettes internes au drapeau, jamais des noms globaux — les y faire entrer
 * déborderait la règle. Une LECTURE du drapeau (`[section==calm]`, une mutation `[section=full]`)
 * n'en crée pas non plus : comme `declarations` (gate/trigger/cv), c'est une propriété posée sur
 * un nom existant, pas une création.
 */
export function refuserNomsEnDouble(ast, libCtx) {
  const erreurs = [];
  const { terminaux } = terminauxEnPortee(ast);

  // Ce qui CRÉE un nom, par sorte. `declarations` (gate/trigger/cv) n'y est PAS : elle pose une
  // propriété sur un nom existant. Les têtes de règle sont à part — elles ne se heurtent pas
  // entre elles, donc elles ne peuvent pas servir de « déjà pris » les unes pour les autres.
  // ⛔ LA CLÉ DÉCIDE, LE LIBELLÉ S'AFFICHE. Deux sites comparaient la SORTE par sa phrase
  // française ; la passer en anglais les a rendus muets d'un coup — un texte destiné à l'humain
  // servait de donnée au compilateur. `cle` est stable et jamais rendue à l'utilisateur.
  const creesParDeclaration = new Map();   // nom → { cle, sorte, line }
  const noter = (nom, cle, sorte, line) => {
    if (!nom || typeof nom !== 'string') return;
    if (creesParDeclaration.has(nom)) {
      const p = creesParDeclaration.get(nom);
      erreurs.push({
        message: `the name '${nom}' is already taken: ${p.sorte} declared it${p.line ? ` on line ${p.line}` : ''}, `
          + `and ${sorte} redeclares it. A name designates only ONE thing in a scene — otherwise, `
          + `reading it in a rule, one no longer knows what it refers to. Choose another name.`,
        line,
      });
      return;
    }
    creesParDeclaration.set(nom, { cle, sorte, line });
    if (terminaux.has(nom)) {
      erreurs.push({
        message: `'${nom}' is a TERMINAL of the active alphabet, and ${sorte} makes it a name — a `
          + `rule writing '${nom}' would no longer say whether it plays the note or the other thing. `
          + `Choose another name. The refusal falls at DECLARATION: the name need not be used for `
          + `the ambiguity to exist.`,
        line,
      });
    }
  };
  for (const e of ast.inputs || []) noter(e?.name, 'input', 'an input', e?.line);
  // ⚠️ `ast.vars` porte la DIRECTIVE ENTIÈRE (`VarDirective`) depuis le 2026-08-05, pas un nom nu :
  // une ligne peut en porter PLUSIEURS (`names`). Un drapeau (Romain 2026-07-30, `varType.kind ===
  // 'flag'`, ex-`@flag`) CRÉE un nom comme toute autre variable — le nom est `names[0]`, jamais
  // les états (`varType.states[].name`), qui sont des étiquettes internes.
  // ⛔ UN OBJET RACINE — `def kick (vel:120)`, `varType.type === null` — EST UNE DÉFINITION, pas une
  // variable de travail (2026-09-02, `object` sort et `def` est le mot unique). Son nom se DÉPLIE dans
  // les règles comme une forme ; une tête de règle homonyme est donc l'ambiguïté que ce garde refuse,
  // et la levée accordée aux variables de travail ne lui est pas accordée.
  for (const v of ast.vars || []) {
    const racine = v?.varType?.kind === 'type' && v.varType.type === null;
    const cle = v?.varType?.kind === 'flag' ? 'flag' : (racine ? 'definition' : 'working-var');
    const sorte = { flag: 'a flag', definition: 'a definition', 'working-var': 'a working variable' }[cle];
    for (const n of v?.names || []) noter(n, cle, sorte, v?.line);
  }
  // ⚠️ L'ACTEUR EST LÀ, ET IL Y EST REVENU LE 2026-07-28 AU SOIR. Je l'en avais écarté le matin,
  // en croyant protéger la voix de code : `actor viz eval.hydra` puis `viz -> <code>` était la
  // forme du corpus, et je l'avais remontée comme un « conflit dans la décision » à arbitrer.
  // Romain a tranché l'inverse, et il avait raison depuis le début : cette écriture AMALGAME un
  // nom d'acteur et un nom de règle, et c'est précisément ce que la règle existe pour interdire.
  // J'avais donc écrit une exception pour protéger la faute.
  // Ce qui donne son langage au code est le TAG, pas le nom de la règle — 44 scènes migrées chez
  // Kanopi, zéro amalgame restant, mesuré avant de poser ceci.
  for (const a of ast.actors || []) if (!a?.synthetic) noter(a?.name, 'actor', 'an actor', a?.line);
  for (const sc of ast.scenes || []) noter(sc?.name, 'scene', 'a scene', sc?.line);
  // ⚠️ LES DEFINITIONS MANQUAIENT A CE RECENSEMENT, et le trou s est vu le jour ou `def` a
  // remplace `macro` (2026-08-09) : `var C4 adsr` refusait le conflit de nom, `def C4 …` passait.
  // L invariant — un nom ne designe qu UNE chose — etait donc garde pour six sortes de declaration
  // et pas pour la septieme, la plus recente. Une garde ecrite avant une forme ne la connait pas :
  // c est a l ajout de la forme qu il faut y penser, et rien ne le rappelle.
  // ⚠️ ET SEULEMENT CELLES QUI NE DECLARENT PAS UN TERMINAL. Une definition de terminal
  // (`def ka voice.sec`) ne PREND pas un nom, elle en CREE un — la recenser comme un conflit
  // interdisait de declarer quoi que ce soit, et mes deux gardes de `def` sont tombes dessus
  // dans la minute. Le conflit ne vaut que pour une definition qui reinvoque autre chose sous
  // un nom deja porte par un terminal.
  for (const d of ast.defs || []) {
    if (d && d.type === 'DefDirective' && d.kind !== 'terminal') {
      noter(d.name, 'definition', 'a definition', d.line);
    }
  }
  // Un drapeau CRÉE un nom (Romain 2026-07-30) — voir la boucle sur `ast.vars` ci-dessus, qui le
  // couvre depuis que `flag` est tombé (2026-08-05) : `FlagStatesDirective` n'est plus produite.

  // ⚠️ LES TÊTES DE RÈGLE NE SONT PLUS CONTRÔLÉES ICI — décision Romain du 2026-08-03,
  // `hub/decisions/2026-08-03-une-tete-de-regle-peut-etre-un-terminal.md`, appliquée le 2026-08-07.
  //
  // « Une tête de règle a le droit de porter le nom d'un terminal. Le frontal doit accepter
  // `C4 -> G4`, `?1 D4 -> ?1 E4`, `#K1 #K2 #K3 M -> C4`. » Le motif est le mécanisme lui-même :
  // c'est le principe du mode `sub`/`sub1` — une règle de SUBSTITUTION réécrit un terminal, elle a
  // donc forcément un terminal en tête. Le refus invoquait « la note devient inatteignable », qui
  // est exactement ce que la substitution fait EXPRÈS.
  //
  // ⚠️ ET LA RÈGLE D'UNICITÉ N'EST PAS ROUVERTE — c'est le point à ne pas confondre. Son critère
  // est l'EFFET (`2026-07-28-unicite-des-noms.md`) : « poser une propriété sur un nom existant
  // reste permis — aucun nom rival créé ». Une tête de règle ne CRÉE aucun nom, elle pose une
  // réécriture sur un nom qui existe déjà. C'est le frontal qui la traitait comme une DÉCLARATION ;
  // l'application était trop large, pas la règle. Tout ce qui déclare vraiment — `macro`, `var`,
  // `alias`, `actor`, un objet CV — reste contrôlé au-dessus, y compris contre les terminaux.
  //
  // CE QUE ÇA DÉBLOQUE, et ce n'était pas un détail : aucune grammaire de substitution ne compilait
  // en BPScript. Donc aucun mécanisme de motif — captures, contextes, dièses, gabarits — n'était
  // mesurable de bout en bout depuis une scène ; il fallait passer par la graphie BP3 et le moteur
  // natif. C'est le préalable à mesurer l'ISO de ces mécanismes sur la chaîne complète.
  //
  // ⚠️ CE QUI RESTE CONTRÔLÉ, ET POURQUOI JE NE SUIS PAS ALLÉ PLUS LOIN. La décision NOMME ses
  // trois formes : `C4 -> G4` (un terminal), `?1 D4 -> ?1 E4` (un terminal sous un joker),
  // `#K1 #K2 #K3 M -> C4` avec `var M` (une variable de travail). Elle lève donc DEUX collisions :
  // le TERMINAL et la VARIABLE. Elle ne dit rien des autres.
  //
  // Or l'AMALGAME acteur / tête de règle a été tranché NEUF JOURS PLUS TÔT, en sens inverse et dans
  // ces termes : « erreur grave » (Romain, 2026-07-28) — `actor viz` puis `viz -> <code>` mélange
  // un nom d'acteur et un nom de règle, et 44 scènes de Kanopi ont été migrées pour l'éliminer.
  // Ma première écriture retirait le contrôle EN ENTIER, donc levait aussi ce cas-là : c'était
  // faire dire à une décision plus que ce qu'elle écrit, exactement la faute de la veille sur
  // `out`. Je m'en tiens aux deux collisions nommées ; les autres restent, et le résidu
  // (macro, alias, scène, objet CV — jamais tranchés dans un sens ni dans l'autre) est une
  // question pour Romain, pas une déduction pour moi.
  const LEVEES = new Set(['working-var']);
  const tetesVues = new Set();
  for (const sg of ast.subgrammars || []) {
    for (const r of sg.rules || []) {
      // ⛔ UNE RÈGLE N'A DE NOM QUE SI SON MEMBRE GAUCHE EST UN SEUL SYMBOLE. Le contrat ne porte
      // aucun champ `name` sur une règle (`AST.md`, `Rule` : `lhs: LhsElement[]`), et la bible dit
      // que « le membre gauche est réécrit en membre droit » — une SÉQUENCE, jamais un identifiant.
      //
      // ⚠️ CE QUE CETTE BOUCLE FAISAIT, et c'est BPx qui l'a isolé au cas minimal le 2026-08-19 :
      // elle parcourait CHAQUE élément du membre gauche et l'accusait comme une tête de règle. Sur
      // une règle CONTEXTUELLE — `M trkt <> trkt M`, `-gr.dhati2:28` de Bernard — il n'y a rien à
      // collisionner : `trkt` y est une OCCURRENCE dans une séquence, pas une déclaration. La
      // mesure de BPx est nette et se rejoue à l'identique : le même mot passe à DROITE et tombe
      // à GAUCHE, ce qui n'a de sens pour aucune règle du langage.
      //
      // Le natif compile cette règle sans réserve. Refuser la scène aurait demandé à BPx de
      // renommer un symbole de la grammaire de Bernard — réparer au point d'observation.
      //
      // ⚠️ ON COMPTE LES ÉLÉMENTS NON NIÉS, jamais `lhs.length` : `#K1 #K2 #K3 M -> C4` porte
      // quatre entrées pour une seule tête, et le compte brut aurait exempté en silence la forme
      // que la décision du 2026-07-28 nomme.
      const tetes = (r.lhs || []).filter((t) => t && !t.negated);
      if (tetes.length !== 1) continue;
      for (const t of tetes) {
        const nom = t?.name;
        if (!nom || tetesVues.has(nom)) continue;
        tetesVues.add(nom);
        const declare = creesParDeclaration.get(nom);
        if (declare && !LEVEES.has(declare.cle)) {
          erreurs.push({
            message: `rule '${nom}' bears a name already taken by ${declare.sorte} — `
              + `reading '${nom}' in a sequence, one no longer knows what it refers to. `
              + `Choose another name for one of the two.`,
            line: r.line,
          });
        }
      }
    }
  }

  // ⛔ UN DRAPEAU CRÉE UN NOM, MÊME SANS `var` — et ce nom était pris à n'importe qui, en silence.
  //
  // CE QUI PASSAIT, mesuré : `S -> C4 [velcont]` compile. `velcont` est un RÉGLAGE du vocabulaire,
  // et le sac de drapeaux en faisait un drapeau sans un mot. Idem pour `[C4]`, le nom d'un
  // terminal de l'alphabet actif. Le sac de drapeaux acceptait TOUT NOM, quelle que soit la sorte
  // à laquelle il appartenait déjà — c'est la seule porte du langage qui restait ouverte, quand
  // `var`, `alias`, `actor`, `def` et les objets CV sont contrôlés depuis longtemps.
  //
  // LA RÈGLE EST CELLE DE LA BIBLE, appliquée à une sorte qui y échappait : les noms de toutes les
  // sortes vivent dans le même espace, chacun n'appartient qu'à une seule, et le contrôle a lieu à
  // la déclaration. Un drapeau se déclare par `var … flag` OU par sa première mutation — les deux
  // créent le nom, donc les deux se contrôlent.
  //
  // ⚠️ CE QUI N'EST PAS REFUSÉ, ET C'EST DÉLIBÉRÉ. Le même drapeau muté dans dix règles reste UN
  // nom, pas dix déclarations. Et une TÊTE DE RÈGLE n'est pas un rival : elle ne crée aucun nom
  // (décision Romain 2026-08-03), donc `[S=1]` à côté d'une règle `S` n'est pas traité ici.
  //
  // ⚠️ TOUTES LES SORTES, SANS EXCEPTION — arbitrage de Romain, 2026-08-12 : « un drapeau doit
  // porter uniquement un nom de drapeau ; un drapeau qui porte le nom de n'importe quoi d'autre
  // devrait générer une erreur ». J'avais laissé passer le TERMINAL, en jugeant l'ambiguïté
  // douteuse puisque les crochets disent déjà qu'on parle d'un drapeau. Romain a tranché l'inverse
  // et la règle est plus simple ainsi : la sorte se décide au nom, pas au signe qui l'entoure.
  // La TÊTE DE RÈGLE y entre aussi — elle ne crée pas de nom (décision 2026-08-03) mais elle en
  // PORTE un, et un drapeau qui le reprend fait exactement ce que ce refus existe pour empêcher.
  const drapeaux = new Set();
  const collecterDrapeaux = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(collecterDrapeaux); return; }
    // DEUX NŒUDS POUR UNE MÊME SORTE, et n'en voir qu'un laissait la moitié de l'espace ouverte :
    // `FlagExpr` est la MUTATION en fin de règle, `Guard` est le TEST devant le membre gauche.
    // Les deux nomment un drapeau, donc les deux confisquent un nom.
    if ((n.type === 'FlagExpr' || n.type === 'Guard') && typeof n.flag === 'string') drapeaux.add(n.flag);
    for (const v of Object.values(n)) collecterDrapeaux(v);
  };
  collecterDrapeaux(ast.subgrammars);
  // Les têtes de règle, recensées à part : elles ne se heurtent pas ENTRE elles (une tête répétée
  // est une alternative) mais un drapeau qui reprend l'une d'elles est un vol de nom.
  const tetesDeRegle = new Map();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) {
    for (const t of r.lhs || []) if (t?.name && !t.negated && !tetesDeRegle.has(t.name)) {
      tetesDeRegle.set(t.name, r.line);
    }
  }
  for (const nom of drapeaux) {
    const declare = creesParDeclaration.get(nom);
    if (declare && declare.cle !== 'flag') {
      erreurs.push({
        message: `flag '${nom}' bears a name already taken by ${declare.sorte}`
          + `${declare.line ? ` on line ${declare.line}` : ''} — a name designates only ONE thing in `
          + `a scene. Choose another name for the flag.`,
      });
      continue;
    }
    if (tetesDeRegle.has(nom)) {
      erreurs.push({
        message: `flag '${nom}' bears the name of a RULE of the grammar`
          + `${tetesDeRegle.get(nom) ? ` on line ${tetesDeRegle.get(nom)}` : ''} — a name designates `
          + `only ONE thing in a scene. Choose another name for the flag.`,
      });
      continue;
    }
    if (terminaux.has(nom)) {
      erreurs.push({
        message: `flag '${nom}' bears the name of a TERMINAL of the active alphabet — a name `
          + `designates only ONE thing in a scene, and a flag bears only a flag name. `
          + `Choose another name for the flag.`,
      });
      continue;
    }
    if (libCtx?.controlNames?.has(nom)) {
      erreurs.push({
        message: `flag '${nom}' bears the name of a SETTING of the vocabulary — the flag bag `
          + `would silently turn it into a flag, and the setting would become unreachable under `
          + `that name. Choose another name for the flag.`,
      });
      continue;
    }
  }
  return erreurs;
}


/**
 * SCENE_VALUES (hub [293], design docs/design/SCENE_VALUES_OVERRIDE.md §3.4) — pli de
 * la cascade STATIQUE des valeurs de librairie dans la déclaration d'acteur, conforme
 * AST_SPEC §0.1 (« le frontend plie la cascade statique ; un token ne recopie jamais
 * la config complète »). Pour chaque valeur du registre (ex. diapason) :
 *   effectif = params d'entité acteur (tuning.X(diapason:432))
 *           ?? valeur de scène (@diapason:442)
 *           ?? défaut du composant référencé (spec.componentDefault, ex. le champ
 *              diapason du tuning choisi) ?? spec.default
 * → actors[i].values = { nom: effectif } (champ absent si rien). L'occurrence
 * (diapason:428) reste sur payload.params (canal existant, domaine validé ici).
 * BPx porte values OPAQUE (ActorEntry) — DISTINCT de transport.params (adresse, KAI-9).
 * @returns {Array<{message, line?}>} erreurs (domaine, forme, noms inconnus)
 */
export function applySceneValues(ast, libCtx) {
  const registry = (libCtx && libCtx.valueRegistry) || {};
  const errors = [...((libCtx && libCtx.valueRegistryErrors) || [])];
  const names = Object.keys(registry);
  if (!names.length) return errors;

  /**
   * Une valeur NUMÉRIQUE écrite en décimal arrivait ici en CHAÎNE — et deux choses en
   * découlaient, dont une bien pire que l'autre.
   *
   * 1. `diapason:261.63` était plié tel quel : l'arbre portait `"261.63"`, et Kairos le
   *    refusait à juste titre (« un diapason est un nombre fini > 0 »). L'entier `262`, lui,
   *    passait. Une scène pouvait donc déclarer un diapason parfaitement valide et être
   *    rejetée en aval pour une raison de TYPE, sans que rien ne le dise ici.
   * 2. Plus grave : le contrôle de plage ci-dessous ne s'applique QUE si la valeur est déjà un
   *    nombre. Une chaîne le traversait sans être vérifiée — `diapason:"99999"` passait le
   *    domaine. Le garde existait et ne mordait pas sur la moitié des entrées.
   *
   * On convertit donc avant de valider, pour les valeurs dont la spec déclare une PLAGE
   * (c'est ce qui les désigne comme numériques). Une chaîne non numérique reste telle quelle
   * et sera rejetée par le contrôle de plage — on ne fabrique pas un nombre à partir de rien.
   */
  const versNombre = (spec, v) => {
    if (!Array.isArray(spec.range) || typeof v !== 'string') return v;
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : v;
  };

  const checkDomain = (name, spec, v, line) => {
    if (Array.isArray(spec.range) && typeof v !== 'number') {
      errors.push(diagnostic('RESOLVE_NUMBER_EXPECTED', { name, v, p1: spec.range[0], p2: spec.range[1], p3: spec.unit ? ' ' + spec.unit : '' }, { line }));
      return false;
    }
    if (typeof v === 'number' && Array.isArray(spec.range) && spec.range.length === 2
        && (v < spec.range[0] || v > spec.range[1])) {
      errors.push(diagnostic('RESOLVE_OUT_RANGE', { name, v, p1: spec.range[0], p2: spec.range[1], p3: spec.unit ? ' ' + spec.unit : '' }, { line }));
      return false;
    }
    if (Array.isArray(spec.values) && !spec.values.includes(v)) {
      errors.push(diagnostic('RESOLVE_UNKNOWN_VALUE_ALLOWED', { name, v, p1: spec.values.join(', ') }, { line }));
      return false;
    }
    return true;
  };

  // Niveau SCÈNE : nom:valeur (forme deux-points = valeur, règle ':'/'.')
  const sceneVals = {};
  for (const d of ast.directives || []) {
    const spec = registry[d.name];
    if (!spec) continue;
    if (d.value == null) {
      errors.push(diagnostic('RESOLVE_EXPECTS_VALUE_NAME', { p1: d.name }, { line: d.line }));
      continue;
    }
    const valeur = versNombre(spec, d.value);
    if (checkDomain(d.name, spec, valeur, d.line)) sceneVals[d.name] = valeur;
  }

  // Composant d'un AXE déclaré au niveau SCÈNE, lu en forme POINT uniquement (`tuning.X`
  // → `subkey`). SÉMANTIQUE `.`/`:` (Romain) : `.` APPELLE un composant, `:` affecte une
  // VALEUR. Un accordage est un COMPOSANT → point. `tuning:X` (deux-points) = forme v0.7
  // PÉRIMÉE (affecterait une « valeur » à un axe de composant, non-sens) : NON accommodée
  // ici — elle relève de la migration v0.7→v0.8, pas d'un chemin de code.
  const defaultComponents = (libCtx && libCtx.defaultComponents) || {};
  const sceneComponent = (axis) => {
    const d = (ast.directives || []).find((x) => x.name === axis && x.subkey);
    return d ? d.subkey : undefined;
  };
  // Défaut EFFECTIF (niveaux 2-1) : `spec.overriddenBy = "axe.champ"` = le champ du composant
  // EFFECTIF de l'axe (acteur ?? scène ?? défaut core) donne le défaut. RÈGLE DURE (kairos [310]) :
  // si un composant est en portée mais NON RÉSOLU, on renvoie `undefined` (valeur ABSENTE, l'aval
  // résout) — JAMAIS un littéral global par-dessus un composant déclaré. Un `spec.default` littéral
  // n'est le socle QUE pour une valeur SANS composant (pas d'`overriddenBy`, ex. tempo).
  // RÈGLE DE CASCADE (loi 35, constitution:175 ; docs/design/SCENE_DEFAULTS_CASCADE.md, Romain
  // 2026-07-04) : « un pli qui ne sait PAS résoudre le composant INVOQUÉ laisse la valeur ABSENTE,
  // le résolveur (Kairos) la remplit depuis la lib invoquée ». Le socle core (defaultComponents,
  // lu depuis lib/core.json `defaults.components` — PAS un hardcode) ne s'applique QUE si AUCUN
  // composant n'est invoqué (scène nue). Un axe d'ancre est « invoqué » si un DIRECTIVE legacy le
  // nomme (alphabet.X/tuning.X) OU si une invocation par le canal NEUTRE (libRefs) porte
  // l'identité de hauteur — opaque ici (domaine déclaré DANS le fichier, résolu chez Kairos, L27).
  // Jamais le socle par-dessus un composant invoqué (même classe que le bug diapason 2026-07-04
  // où core écrasait le composant déclaré). FIX [394]/[395].
  const hasNeutralPitch = !!(ast.libRefs && ast.libRefs.length);
  const cascadeDefault = (spec, props) => {
    if (spec.overriddenBy) {
      // `overriddenBy` = "axe.champ" OU une CHAÎNE ["tuning.diapason","alphabet.diapason"] :
      // le SPÉCIFIQUE précède le GÉNÉRIQUE (un accordage qui redéclare l'ancre = override
      // exceptionnel, doit primer — aligné sur la lecture kairos `tuning ?? alphabet` [313]).
      const chain = Array.isArray(spec.overriddenBy) ? spec.overriddenBy : [spec.overriddenBy];
      let anyAxisDeclared = false;
      for (const ref of chain) {
        const [axis, field] = ref.split('.');
        let compName = (props && props[axis]) || sceneComponent(axis);
        if (compName == null) {
          // Axe INVOQUÉ (directive legacy OU canal neutre) mais NON résolu ici → ABSENT (Kairos remplit).
          const axisInvoked = (ast.directives || []).some((x) => x.name === axis) || hasNeutralPitch;
          if (axisInvoked) { anyAxisDeclared = true; continue; }
          compName = defaultComponents[axis]; // AUCUN composant invoqué (scène nue) → socle core
        }
        if (compName) {
          const comp = loadLib(axis, compName);
          if (comp && comp[field] != null) return comp[field]; // 1er champ résolu de la chaîne gagne
        }
      }
      // Aucun maillon résolu. Si un axe était déclaré mais non résolu (forme périmée/nom
      // absent) → ABSENT (l'aval résout, jamais le socle global). Sinon → défaut scalaire.
      return anyAxisDeclared ? undefined : spec.default;
    }
    return spec.default; // valeur sans composant → défaut scalaire socle
  };

  // Niveau ACTEUR : pli dans la déclaration (jamais de recopie par token). Cascade complète
  // par valeur : acteur (4) → scène (3) → composant invoqué (2) → socle core (1).
  for (const actor of ast.actors || []) {
    const props = actor.properties || {};
    const eParams = props.entityParams || {};
    for (const [axis, params] of Object.entries(eParams)) {
      // UN PARAMÈTRE PEUT ÊTRE INTRINSÈQUE À L'ENTRÉE, PAS SEULEMENT GLOBAL (décision Romain
      // 2026-08-06, sur `eval.strudel(bank:…)` : « bank est intrinsèque à strudel, c'est pas
      // générique »). Avant, un paramètre de clé d'acteur devait être une valeur DÉCLARÉE au
      // registre global — donc valable pour tous les langages, ce qui est faux : une banque
      // d'échantillons n'a de sens que pour le moteur qui sait la charger.
      // On regarde donc d'abord l'ENTRÉE elle-même (`lib/<axe>.json` → `objects.<entrée>.
      // parameters`), exactement comme `lib/mod.json` déclare `attack`/`release` sur `adsr`.
      const entree = props[axis];
      const propres = (typeof entree === 'string' && loadLib(axis, entree)?.parameters) || null;
      for (const k of Object.keys(params)) {
        if (propres && propres[k] !== undefined) continue;   // propre à l'entrée : accepté
        if (!registry[k]) {
          errors.push(diagnostic('RESOLVE_NEITHER_PARAMETER_NOR_DECLARED', { axis, p1: entree ?? '…', k, p2: entree ?? axis }, { line: actor.line }));
        }
      }
    }
    const vals = {};
    for (const name of names) {
      const spec = registry[name];
      let v;
      for (const params of Object.values(eParams)) {
        if (params && params[name] != null) v = params[name]; // niveau 4 acteur
      }
      if (v === undefined && sceneVals[name] !== undefined) v = sceneVals[name]; // niveau 3 scène
      if (v === undefined) v = cascadeDefault(spec, props); // niveaux 2-1 (composant invoqué → socle core)
      if (v === undefined) continue;
      v = versNombre(spec, v);
      if (checkDomain(name, spec, v, actor.line)) vals[name] = v;
    }
    if (Object.keys(vals).length) actor.values = vals;
  }

  // Niveau OCCURRENCE : (diapason:428) → déjà porté par payload.params ; domaine validé.
  const walkParams = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walkParams); return; }
    const p = node.payload && node.payload.params;
    if (p) {
      for (const [k, v] of Object.entries(p)) {
        if (registry[k]) checkDomain(k, registry[k], v, node.line);
      }
    }
    for (const k in node) {
      if (k !== 'payload' && node[k] && typeof node[k] === 'object') walkParams(node[k]);
    }
  };
  walkParams(ast.subgrammars);

  return errors;
}


export function validateReferences(ast, libCtx = {}, environnement = {}) {
  const errors = [];
  // La table des places permises, sur les librairies que la scène invoque. Un réglage que deux
  // d'entre elles déclarent n'y a pas de place nu — c'est `signalerAmbiguite`, plus bas, qui le
  // refuse en nommant les préfixes ; préfixé, il est jugé à la place que SA librairie déclare.
  const porteesPermises = chargerPorteesPermises(ast);
  // ⛔ UN MOT QU'AUCUNE LIBRAIRIE INVOQUÉE NE DÉCLARE N'EST PAS EN PORTÉE — principe 1, Romain
  // 2026-09-02. S'il est déclaré ailleurs au registre, le refus est positionnel et NOMME la
  // librairie à invoquer ; un mot que personne ne déclare est refusé par les lecteurs de vocabulaire.
  const horsInvocation = (cle, line, col) => {
    const declarants = librairiesQuiDeclarent(cle);
    if (!declarants.length) return false;
    errors.push(diagnostic('RESOLVE_SCOPE_INVOKED_LIBRARY_DECLARES', { cle, p1: declarants.map((l) => `'${l}'`).join(' or ') }, { line, col }));
    return true;
  };
  // ⛔ LE VOCABULAIRE D'UNE SCÈNE EST CELUI QU'ELLE INVOQUE (Romain, 2026-08-08) : « invoquer
  // commande, systématiquement — si un mot est inconnu dans le corpus invoqué, alors erreur ».
  //
  // ⚠️ CETTE LIGNE DISAIT L'INVERSE, et c'est elle qui laissait tout passer : « agrégat de TOUTES
  // les libs disponibles. Un mot usable est valide. » Un réglage était donc accepté dès qu'une
  // librairie du dépôt le déclarait, même si la scène n'en invoquait aucune — l'invocation ne
  // commandait rien. Les acteurs comptent comme des invocations : ils portent leurs propres
  // références de librairie (alphabet, accordage, registres).
  const vocab = describeVocabulary([...(ast.directives || []), ...(ast.actors || [])]);
  const controlNames = new Set(vocab.controls.map((c) => c.name));
  const registry = new Set(vocab.values.map((v) => v.name));
  const reserved = new Set(vocab.keywords);
  const digitalFns = new Set(vocab.functions);
  const addressKeys = new Set(vocab.addressKeys);
  // Réglages RÉSERVÉS (mode/scan/weight/on_fail/tempx/meter) — écrits en '()' depuis la décision
  // Romain 2026-08-02 (LANGUAGE.md:773-800). Sans cette entrée, `knownParamKey` les refusait
  // comme « attribut inconnu » : le vocabulaire des `(k:v)` ne les avait jamais portés, ils ne
  // vivaient QUE côté `[]` (checkQualifierKey, parser.js).
  const qualifierKeys = new Set(vocab.qualifierKeys);
  const catalogAxes = Object.keys(vocab.components);
  const componentExists = (axis, name) => (vocab.components[axis] || []).includes(name);

  // 1. Occurrence / paramètres `(k:v)` — clé connue = contrôle ∪ valeur ∪ adresse ∪ fonction
  //    digitale ∪ réglage réservé. Les paires d'occurrence vivent dans
  //    `payload.params` (note ou groupe/règle, foldées par le parser) ET dans les
  //    `SettingBag.pairs`.
  // Les INSTANCES de module que la scène déclare (`var lpf1 lpf`) : un réglage peut nommer le
  // PORT de l'une d'elles (`(lpf1.cutoff:400)`, `AST.md` §Setting). Le nom d'une instance est
  // choisi par l'auteur — aucun registre de librairie ne peut le connaître, il faut le lire dans
  // la scène. Sans cela, sept exemples de la bible tombaient sur « attribut inconnu ».
  const instancesDeclarees = new Set(
    (ast.vars || []).flatMap((v) => (v && Array.isArray(v.names) ? v.names : [])));

  // ── LE MODE D'UN PARAMÈTRE DÉCLARÉ — `slidecont`, `slidestep`, `slidefixed` ─────────────────
  // FORME RATIFIÉE PAR ROMAIN le 2026-08-13, et c'est la MÊME construction que les vingt-sept mots
  // des neuf paramètres de jeu : le mode se COLLE au nom du paramètre, et le collage réunit deux
  // termes en un seul. `velstep` et `slidestep` ne sont pas deux graphies, c'est la même.
  //
  // ⚠️ CE QU'ELLE REMPLACE, ET POURQUOI L'ANCIENNE ÉTAIT FAUSSE. On écrivait `!(cont:slide)` :
  // le `:` LIE UN SUJET À UNE VALEUR, or le sujet écrit était `cont` et la « valeur » était
  // `slide` — l'inverse du sens. Et `!(value:slide 101)` cachait le SUJET DANS LA VALEUR, deux
  // termes dont le premier est un nom. Aucune des deux ne dit de quoi on parle en tête de clé.
  // La forme canonique remet le paramètre en clé : `!(slide:101)` et `!(slidecont)`.
  //
  // LE PARAMÈTRE DOIT ÊTRE DÉCLARÉ (`var slide signal` — « un flux de nombres, sans convention de
  // lecture », LANGUAGE.md). Sans déclaration le nom est refusé, et c'est le but : un mot inconnu
  // collé à `cont` ne doit pas devenir un paramètre par accident.
  const MODES = ['fixed', 'step', 'cont'];
  const signauxDeclares = new Set(
    (ast.vars || [])
      .filter((v) => v && v.varType && v.varType.kind === 'convention')
      .flatMap((v) => (Array.isArray(v.names) ? v.names : [])));
  const estModeDeParametre = (k) => MODES.some((mode) =>
    k.endsWith(mode) && signauxDeclares.has(k.slice(0, -mode.length)));

  const connuNu = (k) => controlNames.has(k) || registry.has(k) || addressKeys.has(k) || digitalFns.has(k) || qualifierKeys.has(k) || instancesDeclarees.has(k) || estModeDeParametre(k);
  /**
   * ⛔ UN NOM POINTÉ DÉSIGNE UN ÉLÉMENT DANS UN ESPACE DE NOMS — sa TÊTE dit où chercher.
   *
   * Depuis que le parseur rend `mute.all` comme UN nom au lieu d'une paire `{mute: 'all'}`
   * (le point APPELLE, le deux-points AFFECTE — `LANGUAGE.md:390`), cette table doit savoir lire
   * un nom pointé. **La règle est générique et vaut pour toute tête** : la clé est connue quand sa
   * tête l'est. Que le composant existe est une question DISTINCTE — et elle n'a aujourd'hui aucun
   * refus, ce qui est inscrit au chantier des refus positionnels (BPS-91), pas ici.
   */
  const knownParamKey = (k) => {
    if (connuNu(k)) return true;
    const point = typeof k === 'string' ? k.indexOf('.') : -1;
    return point > 0 && connuNu(k.slice(0, point));
  };
  // DÉDUPLICATION PAR CLÉ ET PAR LIGNE — et surtout : une paire vue DEUX FOIS ne compte qu'une.
  //
  // La même paire est collectée à deux endroits : dans `payload.params` (replié par le parser,
  // SANS position) et dans `SettingBag.pairs` (AVEC ligne et colonne). L'identifiant de
  // déduplication valait `clé + ':' + (ligne || 0)` : les deux passages produisaient donc deux
  // identifiants différents, et l'attribut inconnu était signalé DEUX FOIS — une fois sans
  // position, une fois avec. Pire, la version SANS position arrivait en premier, donc le
  // premier message rendu à l'appelant n'avait ni ligne ni colonne.
  // Mesuré : `(mysteryParam:42)` rendait 2 erreurs, `(cutof:env1)` en rendait 3.
  //
  // On déduplique donc par CLÉ, et on garde la position dès qu'un des passages la porte.
  // ⛔ UN NOM QUE DEUX LIBRAIRIES DÉCLARENT NE S'ÉCRIT PAS NU — il ne dit pas de quoi on parle.
  //
  // RÈGLE DE ROMAIN (2026-08-13) : deux déclarations d'un même contrôle sont permises, et l'appel
  // se préfixe alors `<librairie>.<contrôle>`. Le refus porte donc sur l'APPEL AMBIGU, jamais sur
  // la déclaration — c'est l'inverse de ce que j'avais écrit le 2026-08-12.
  //
  // ⚠️ CE QUE ÇA REMPLACE EST UN CHOIX SILENCIEUX, et c'est le seul mode d'échec qui compte ici :
  // sans ce refus, le chargeur garde la DERNIÈRE déclaration lue et le réglage part au destinataire
  // de celle-là. Mesuré en posant un `pan` de témoin dans `audio.json` : `(pan:20)` était jugé sur
  // la plage d'`audio` (-1..1) et sortait « hors plage », alors que l'auteur écrivait le `pan` de
  // `expression` (0..127). Aucune erreur ne nommait l'ambiguïté ; l'ordre de chargement décidait.
  //
  // LE REFUS PORTE SA RÉÉCRITURE — la liste des préfixes possibles, nommés. Un refus qui dit
  // seulement « ambigu » laisse l'auteur chercher quelles librairies se disputent le nom.
  const ambigus = libCtx.ambiguousControls || new Set();
  const prefixesDe = (nom) => Object.keys(libCtx.controlsQualified || {})
    .filter((q) => q.endsWith(`.${nom}`)).sort();
  const vusAmbigus = new Set();
  const signalerAmbiguite = (key, line, col) => {
    if (!ambigus.has(key) || vusAmbigus.has(key)) return;
    vusAmbigus.add(key);
    const choix = prefixesDe(key);
    errors.push(diagnostic('RESOLVE_DECLARED_LIBRARIES_CANNOT_WRITTEN', { key, p1: choix.length, p2: choix.map((c) => `'${c}:…'`).join(' or ') }, { line, col }));
  };

  // ── UN MOT GÉNÉRIQUE ÉCRIT POUR UNE SORTIE QUI NE LE RÉALISE PAS ────────────────────────────
  // RÈGLE DE ROMAIN (2026-08-15) : « si certains sont en attente d'une implémentation, il faut
  // mettre l'implémentation au backlog et s'assurer qu'on a un message d'erreur si on l'utilise ».
  //
  // ⛔ C'EST UN REFUS D'USAGE, PAS DE DÉCLARATION, et la distinction porte tout le mécanisme. Le
  // chargeur refuse déjà une déclaration incohérente — un `implements` qui pointe dans le vide.
  // Ici, la déclaration est juste et c'est l'ÉCRITURE qui n'a nulle part où aller : `!(volume:90)`
  // chez un acteur qui sort en `audio`, quand seul `midi` réalise `volume`. Sans ce refus, le mot
  // compile et ne fait RIEN — le défaut que le langage refuse partout ailleurs.
  //
  // LE CANAL D'UNE RÉALISATION EST LE NOM DE SA LIBRAIRIE, quand ce nom est un canal déclaré
  // (`midi.volume` → canal `midi`). Aucun nom n'est écrit ici : le catalogue des canaux et les
  // liens de réalisation sont tous deux de la donnée.
  const canauxDeclares = new Set(Object.keys(canaux()));
  const realisationsPar = {};      // nom nu → Set des canaux qui le réalisent
  for (const [face, reals] of Object.entries(libCtx.implementations || {})) {
    const nom = face.slice(face.indexOf('.') + 1);
    const canaux = new Set(reals.map((q) => q.slice(0, q.indexOf('.'))).filter((l) => canauxDeclares.has(l)));
    if (canaux.size > 0) realisationsPar[nom] = canaux;
  }
  // LES SORTIES ACTIVES DE LA SCÈNE. `applyDefaultActor` a déjà tourné : `ast.actors` est peuplé,
  // acteur implicite compris, et chacun porte sa clé de transport. Une scène peut en avoir
  // plusieurs — c'est le cas réel de Kanopi, qui joue MIDI et audio ensemble.
  const sortiesActives = [...new Set((ast.actors || [])
    .map((a) => a && a.properties && a.properties.transport && a.properties.transport.key)
    .filter((k) => typeof k === 'string' && canauxDeclares.has(k)))];
  const vusSansRealisation = new Set();
  const signalerRealisationManquante = (key, line, col) => {
    const canaux = realisationsPar[key];
    if (!canaux || vusSansRealisation.has(key) || sortiesActives.length === 0) return;
    const orphelines = sortiesActives.filter((s) => !canaux.has(s));
    if (orphelines.length === 0) return;
    vusSansRealisation.add(key);
    errors.push(diagnostic('RESOLVE_GENERIC_WORD_EVERY_OUTPUT', { key, p1: orphelines.map((s) => `'${s}'`).join(' and '), p2: orphelines.length > 1 ? '' : 'es', p3: [...canaux].sort().map((c) => `'${c}.${key}'`).join(', ') }, { line, col }));
  };

  // ── UN TAG DE BACKTICK NOMME UN ÉVALUATEUR DÉCLARÉ, PAS N'IMPORTE QUEL MOT ──────────────────
  // ⚠️ CE QUI PASSAIT : `` `zz: du code` `` compilait. Le lecteur de tag ne vérifiait que sa FORME
  // — une expression régulière « une lettre puis des caractères de mot » — jamais son appartenance
  // à une liste. Une COQUILLE (`jss:` pour `js:`) créait donc un interprète fantôme EN SILENCE, et
  // la scène compilait : le code partait à un évaluateur qui n'existe pas, sans une erreur. Même
  // famille que le drapeau qui confisquait un nom, réparé le 2026-08-12.
  //
  // LA LISTE EST UNE DONNÉE, jamais un tableau en dur : `lib/eval.json` déclare les évaluateurs et
  // `core` l'apporte depuis le 2026-08-13, pour qu'une scène ordinaire l'ait en portée. Ajouter un
  // langage se fait donc dans la librairie, et ce refus le suit sans une ligne de code.
  const evaluateurs = new Set((vocab.components && vocab.components.eval) || []);
  const tagsVus = new Set();
  const verifierTag = (tag, line, col) => {
    if (typeof tag !== 'string' || !tag || evaluateurs.has(tag) || tagsVus.has(tag)) return;
    tagsVus.add(tag);
    errors.push(diagnostic('RESOLVE_NAMES_EVALUATOR_DECLARED_BACKTICK', { tag, p1: [...evaluateurs].sort().join(', ') }, { line, col }));
  };

  const vus = new Map();
  /**
   * ⛔ UN REFUS ÉCRIT LA GRAPHIE QUE L'AUTEUR A ÉCRITE — TROISIÈME DOMICILE DE LA RÈGLE.
   *
   * Ce message rendait `attribut '(sound.bell_short:…)' inconnu` sur une scène qui écrit
   * `C4(sound.bell_short)` : **un DEUX-POINTS là où l'auteur a mis un POINT**. Il enseignait donc
   * la règle d'or à l'envers — `.` appelle un composant, `:` affecte une valeur — et invitait à
   * poser une valeur là où la forme n'en admet aucune.
   *
   * ⇒ **Une règle du langage habite TROIS endroits : la spec, le REFUS qui l'applique, et le garde
   * qui le tient.** La réparation du nom pointé du 2026-08-24 a touché le lecteur et le garde ; le
   * refus est resté sur l'ancien modèle, et **celui qui lit un refus apprend la règle par lui**.
   * Relevé le même soir par BPx, par Kairos et par l'architecte, chacun de son côté.
   *
   * ⚠️ LA DISTINCTION VIENT DU PARSEUR, pas d'une heuristique sur le nom — mesuré avant d'écrire :
   *     C4(zzznu)       →  { key:'zzznu', value: true }     le BOOLÉEN : écrit nu
   *     C4(zzznu:true)  →  { key:'zzznu', value: "true" }   la CHAÎNE : une valeur écrite
   * Une valeur strictement `true` dit donc « aucun deux-points n'a été écrit », et rien d'autre.
   */
  const flag = (key, line, col, ecritNu = false) => {
    if (knownParamKey(key)) return;
    const deja = vus.get(key);
    if (deja) {
      // Un passage ultérieur porte la position que le premier n'avait pas : on complète.
      if (deja.line === undefined && line !== undefined) { deja.line = line; deja.col = col; }
      return;
    }
    // ⛔ ET CET OBJET NE PORTE PLUS DE CHAMP DE MARQUAGE. J'avais ajouté `generique` et `cle` pour que
    // la déduplication cesse de reconnaître ce message par une expression sur son TEXTE. Le filtre a
    // été élagué le même soir — il n'avait plus de producteur — et les deux champs sont morts avec lui.
    //
    // ⚠️ ILS N'ÉTAIENT PAS INERTES POUR AUTANT, et c'est BPx qui l'a mesuré : son registre de rouges
    // empreint l'OBJET D'ERREUR sérialisé, pas la phrase. **23 de ses 42 entrées ont changé
    // d'empreinte**, toutes les 23 par ces deux champs, sur un texte identique mot pour mot.
    //
    // ⇒ **Mon préavis annonçait TROIS TEXTES et j'ai changé une FORME.** Entre « comparer un message »
    // et « ne pas le lire », il y a **empreindre l'objet entier** — une issue que ma lettre n'avait pas.
    // Deuxième faute de périmètre sur le même sujet en deux jours : l'instrument mesure une graphie et
    // la conclusion porte sur un contrat.
    // Un mot qu'une librairie NON invoquée déclare n'est pas inconnu : il est hors portée, et le
    // refus qui nomme la librairie à invoquer est rendu par le contrôle de place (`horsInvocation`).
    if (librairiesQuiDeclarent(key).length) return;
    const err = { message: `unknown attribute '(${key}${ecritNu ? '' : ':…'})' — neither a control, nor a library value, nor an address`,
      line, col };
    vus.set(key, err);
    errors.push(err);
  };
  (function collect(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const el of node) collect(el); return; }
    if (typeof node.tag === 'string' && typeof node.code === 'string') {
      verifierTag(node.tag, node.line, node.col);
    }
    if (node.payload && node.payload.params) {
      // ⚠️ L'AMBIGUÏTÉ SE JUGE SUR LA FORME ÉCRITE, JAMAIS SUR LE REPLI. `payload.params` est
      // keyé par le nom CANONIQUE du contrôle : le préfixe qui levait l'ambiguïté n'y figure
      // plus, et juger ici accuserait `audio.pan:0.5` d'être écrit nu. On lit donc les sacs
      // COLLÉS à ce nœud pour savoir si la clé y est arrivée préfixée.
      // DEUX SOURCES, et n'en lire qu'une laissait passer le cas le plus courant : un SAC porte
      // lui-même un `payload.params` replié de SES PROPRES paires — il n'a pas de
      // `suffixQualifiers`, il EST le qualifieur. Ne regarder que les sacs collés accusait donc
      // tout sac préfixé d'être écrit nu.
      const prefixees = new Set();
      const noter = (liste) => { for (const pr of liste || []) if (pr && pr.lib) prefixees.add(pr.key); };
      noter(node.pairs);
      for (const sq of (node.suffixQualifiers || [])) noter(sq && sq.pairs);
      for (const k of Object.keys(node.payload.params)) {
        if (!prefixees.has(k)) { signalerAmbiguite(k, node.line); signalerRealisationManquante(k, node.line); }
        // ⛔ LA MÊME RÈGLE AUX DEUX ÉTAGES, ET C'EST ICI QUE LE MESSAGE SORTAIT. `flag` déduplique
        // par clé : ce chemin — le repli `payload.params` — est visité AVANT le sac, donc c'est SON
        // message qui gagne, et réparer le sac seul ne changeait rien. Mesuré plutôt que supposé :
        //     C4(zzznu)          →  params { zzznu: true }        le booléen : écrit nu
        //     C4(zzzaffecte:1)   →  params { zzzaffecte: 1 }      une valeur écrite
        // Le repli porte la même distinction que la paire ; un seul mécanisme sert les deux étages.
        flag(k, node.line, undefined, node.payload.params[k] === true);
      }
    }
    // ⚠️ LES DEUX SIGNES, PAS UN SEUL. Le mode s'écrit aussi bien entre parenthèses (`SettingBag`)
    // qu'entre crochets (`Qualifier`) — et mon premier refus ne visait que le premier. Mesuré dans
    // la foulée : `S -> C4 [mode:random]` PASSAIT, alors qu'il était refusé la minute d'avant.
    // J'avais donc fermé la porte d'un côté en en ouvrant une de l'autre, dans le même geste.
    // C'est la faute « énumérer TOUTES les formes que le parser peut produire », commise en
    // écrivant le correctif qui la cite.
    if ((node.type === 'SettingBag' || node.type === 'Qualifier') && Array.isArray(node.pairs)) {
      for (const p of node.pairs) {
        if (node.type === 'SettingBag') {
          // Une paire ÉCRITE sans préfixe : c'est ici, et seulement ici, que l'ambiguïté se voit.
          if (!p.lib) { signalerAmbiguite(p.key, p.line, p.col); signalerRealisationManquante(p.key, p.line, p.col); }
          flag(p.key, p.line, p.col, p.value === true);
        }
        // ⛔ LE MODE NE CHANGE PAS EN COURS DE TIRAGE — décision de Romain, 2026-08-08.
        //
        // Il vaut pour un BLOC et s'écrit `mode:<valeur>` en tête de sous-grammaire, point. La
        // forme en sac — suffixe de règle, flux, ou n'importe quelle autre position — est SUPPRIMÉE.
        //
        // ⚠️ CE QUI A CONDUIT À CETTE DÉCISION, et c'est une leçon sur les références. La spec
        // écrivait `S -> A B C (mode:random)` et lui consacrait un paragraphe entier expliquant
        // qu'un mode écrit sur une règle gouverne le bloc. Mesuré sur les trois sources : le corpus
        // écrit `mode` en tête **287 fois** et la forme en sac **ZÉRO** ; le moteur d'origine met
        // son mode en tête de bloc, seul sur sa ligne, jamais en suffixe. La spec décrivait donc
        // une forme que ni le moteur ni aucune scène ne connaît — et mon arbre ne l'appliquait
        // nulle part : le mode restait sur la règle, le bloc restait sans mode.
        // Romain a tranché en supprimant la forme plutôt qu'en la faisant vivre.
        // ⚠️ Elle avait essaimé : DIX-SEPT occurrences dans les trois spécifications, alors que je
        // n'en avais vu qu'une. Un balayage, jamais une correction sur place.
        //
        // On refuse ICI, sur l'arbre entier, et non dans une branche du parseur : le mode ne doit
        // apparaître dans AUCUN sac, quelle qu'en soit la position — règle, groupe, symbole, flux,
        // accolade fermante. Une garde écrite pour la position qui s'est montrée laisserait vivre
        // les cinq autres.
        if (p.key === 'mode') {
          errors.push(diagnostic('RESOLVE_MODE_LONGER_BELONGS_RULE', { p1: p.value ?? '<value>' }, { line: p.line, col: p.col }));
        }
      }
    }
    // ⛔ UN RÉGLAGE ÉCRIT HORS DE SA PORTÉE EST REFUSÉ — décision de Romain, 2026-08-08 :
    // « le poids n'a de sens que sur une RÈGLE, et une écriture hors portée doit être REFUSÉE avec
    // une erreur explicite nommant la ligne, le contrôle et la portée ».
    //
    // C'est le seul office de la déclaration de portée. L'accrochage dans l'arbre DIT déjà où le
    // réglage est ; la librairie dit où il A LE DROIT d'être. Sans cette confrontation, on lit
    // n'importe quel réglage n'importe où sans jamais pouvoir dire qu'il est mal placé — c'est ce
    // qui a rendu un poids muet pendant quatre jours, le défaut du moteur appliqué à sa place.
    //
    // La place se lit sur le NŒUD QUI PORTE le sac, jamais sur une liste de noms : ajouter un
    // porteur au langage suffit à l'inscrire ici. Les portées permises viennent de la DONNÉE
    // (chaque clé, dans SA librairie) — ce code ne nomme aucun contrôle.
    // ⏸️ REFUS SUSPENDU — les portées déclarées ne sont pas encore INSTRUITES (Romain, 2026-08-08).
    //
    // Le mécanisme est complet et mesuré, mais il confronte l'écriture à des portées que j'avais
    // tirées d'un inventaire d'USAGE. Romain a posé la méthode : « il faut inspecter pour chaque
    // contrôle, en fonction de ce qu'il EXPRIME, ce qui a du sens ou non » — en restant conforme
    // aux limites du moteur d'origine QUI FONT SENS, et en étendant délibérément avec le sac collé
    // et le sac de flux.
    // Refuser sur des déclarations non fondées casserait des écritures légitimes en se réclamant
    // d'une règle que personne n'a arrêtée. Le refus se rebranche quand les 70 clés sont instruites
    // une par une ; d'ici là il ne mord pas, et ce commentaire dit pourquoi plutôt que de le taire.
    const place = REFUS_HORS_PORTEE_ACTIF ? PORTEE_DU_PORTEUR[node.type] : null;
    if (place) {
      for (const sac of [node.settings, node.qualifier, ...(node.suffixQualifiers || [])]) {
        if (!sac || !Array.isArray(sac.pairs)) continue;
        for (const p of sac.pairs) {
          const cle = String(p.key).split('.')[0];
          const permis = porteesPermises.get(cle, p.lib);
          if (!permis) { if (!p.lib) horsInvocation(cle, p.line ?? node.line, p.col); continue; }
          if (permis.includes(place)) continue;
          errors.push(diagnostic('RESOLVE_KEY_WRONG_PLACE', {
            cle, place: NOM_DE_PLACE[place],
            permis: permis.length === 1
              ? `it holds ONLY ${NOM_DE_PLACE[permis[0]] ?? permis[0]}`
              : `it holds ${permis.slice(0, -1).map((s) => NOM_DE_PLACE[s] ?? s).join(', ')}`
                + ` or ${NOM_DE_PLACE[permis[permis.length - 1]] ?? permis[permis.length - 1]}`,
          }, { line: p.line ?? node.line, col: p.col }));
        }
      }
    }
    for (const k in node) { if (k !== 'params' && node[k] && typeof node[k] === 'object') collect(node[k]); }
  })(ast.subgrammars);
  // ⚠️ LE CONTRÔLE DES TAGS NE S'ARRÊTE PAS AUX SOUS-GRAMMAIRES. `init` porte du code hors de
  // toute règle : un tag inconnu y passait, alors qu'il est refusé partout ailleurs. Trouvé par le
  // garde de l'état de départ. On repasse sur `init` — les autres volets, eux, n'ont rien à y voir.
  for (const e of (ast.init || [])) {
    if (e && typeof e.tag === 'string' && typeof e.code === 'string') verifierTag(e.tag, e.line, e.col);
  }

  // ── LES DEUX PLACES QUI N'ONT PAS DE SAC : la tête de scène et la tête de sous-grammaire ────
  //
  // ⚠️ MON REFUS NE GARDAIT QUE QUATRE PLACES SUR SIX, et c'est le produit croisé qui l'a montré —
  // 85 cellules « déclaré interdit mais accepté », toutes sur ces deux places. `weight:50` en tête
  // de scène passait, `stop` aussi. J'avais écrit la garde pour les endroits où un sac se pose
  // dans une règle, c'est-à-dire pour la forme que j'avais sous les yeux ; les deux places qui
  // s'écrivent AUTREMENT — une directive, un modificateur de mode — n'étaient pas gardées du tout.
  // C'est la faute « on répare l'endroit où le défaut s'est montré », commise sur une garde dont
  // c'est précisément le sujet.
  if (REFUS_HORS_PORTEE_ACTIF) {
    const dire = (cle, place, line) => {
      const permis = porteesPermises.get(cle);
      if (!permis) { horsInvocation(cle, line); return; }
      if (permis.includes(place)) return;
      errors.push(diagnostic('RESOLVE_KEY_WRONG_PLACE', {
        cle, place: NOM_DE_PLACE[place],
        permis: permis.length === 1
          ? `it holds ONLY ${NOM_DE_PLACE[permis[0]] ?? permis[0]}`
          : `it holds ${permis.slice(0, -1).map((x) => NOM_DE_PLACE[x] ?? x).join(', ')}`
            + ` or ${NOM_DE_PLACE[permis[permis.length - 1]] ?? permis[permis.length - 1]}`,
      }, { line }));
    };
    // ⚠️ UNE DIRECTIVE DE TÊTE N'EST PAS TOUJOURS UN RÉGLAGE — et l'homonymie est réelle.
    // `mod` INVOQUE la librairie `lib/mod.json` ; elle ne pose pas le contrôle MIDI `mod`.
    // Mesuré : sans ce tri, cinq scènes du corpus étaient refusées à tort, toutes pour ce seul
    // mot. Une invocation se reconnaît à ce qu'un fichier de librairie porte son nom — c'est le
    // même critère que le chargeur emploie, pas une liste de noms à écarter.
    for (const d of (ast.directives || [])) {
      if (!d || !d.name) continue;
      // ⛔ UNE DECLARATION N EST PAS UN USAGE — corrige le 2026-08-09.
      // `def mute drum.on` DECLARE un nom ; il n ECRIT pas le controle `mute` en tete de scene.
      // Ce parcours prenait le `name` de TOUTE directive, donc une declaration dont le nom se
      // trouve etre celui d un controle se faisait refuser pour une place qu elle n occupe pas.
      // ⚠️ ET C EST EXACTEMENT LE SUJET DU GARDE QUI L A TROUVE — « le nom declare par la scene
      // gagne ». La regle etait ecrite, appliquee ailleurs, et ce parcours-ci ne la connaissait
      // pas : il ne distinguait pas ce qui S ECRIT de ce qui SE DECLARE.
      if (d.type && d.type !== 'Directive') continue;
      // ⚠️ UNE CLÉ DE SCÈNE S'ÉCRIT DE DEUX FAÇONS, et je n'en gardais qu'une : nue (`tempo:120`) ou
      // QUALIFIÉE PAR SON DOMAINE (`engine.mode:random`, la forme que le tableau des invocations
      // de la référence emploie). Mesuré le 2026-08-08 : après avoir retiré `mode` des clés de
      // scène, `mode` refusait bien — et `engine.mode` passait toujours. Deux graphies de la même
      // chose, une seule gardée : le refus se contournait en écrivant le nom complet.
      // ⛔ DANS UNE LIBRAIRIE, UNE LIGNE DE TÊTE À VALEUR EST LA VALEUR D'UN OBJET, PAS UN USAGE —
      // arbitrage de Romain, 2026-09-03 (forme 4) : l'environnement surcharge un contrôle en
      // l'écrivant en tête de sa librairie, `volume:90`, comme une scène ; la place ne se juge pas,
      // parce qu'elle dit OÙ un usage s'écrit, et qu'une valeur d'environnement n'est pas un usage.
      // Mesuré : neuf des vingt-deux réglages de `midi_default` (chan, mod, pitchbend, pitchrange,
      // pressure, volumerate, modrate, pitchrate, pressrate) n'ont pas la portée scène.
      if (environnement && environnement.librairie && (d.value != null || d.runtime != null)) continue;
      const clesEcrites = [];
      if (!loadLib(d.name)) clesEcrites.push(d.name);   // nue ; une invocation de librairie n'en est pas une
      if (d.subkey && porteesPermises.has(d.subkey)) clesEcrites.push(d.subkey);  // qualifiée
      for (const cle of clesEcrites) dire(cle, 'scene', d.line);
    }
    for (const sg of (ast.subgrammars || [])) {
      for (const m of (sg.modifiers || [])) {
        const nom = typeof m === 'string' ? m : (m && m.name);
        if (nom) dire(nom, 'subgrammar', sg.line);
      }
    }
  }

  // 2. Existence d'un COMPOSANT référencé dans un axe à catalogue.
  const checkComponent = (axis, name, line) => {
    if (!name) return;
    if (componentExists(axis, name)) return;
    // Un alphabet peut vivre HORS du catalogue standard, dans une librairie que la scène a
    // elle-même déclarée (`test_alphabets` par exemple). La validation doit donc poser la MÊME
    // question que la résolution — sinon elle refuse un nom que le resolveur sait charger, et on
    // a deux vérités sur « cet alphabet existe-t-il ».
    if (axis === 'alphabet' && resolveActorAlphabet(name, ast.directives)) return;
    errors.push(diagnostic('RESOLVE_FOUND_CATALOG_REFERENCE_DOES', { axis, name }, { line }));
  };

  // 3bis. LIBRAIRIE SANS CATALOGUE — une ENTRÉE INCONNUE y crie aussi (arbitrage architecte
  // 2026-07-27, sur le cas `dhin1`). Les axes à CATALOGUE crient depuis toujours ; les autres —
  // `transcription`, `test_alphabets`, `settings`, `mapping`… — acceptaient n'importe quel nom EN
  // SILENCE. Payé sur pièce : `homomorphism.dhinOO` a traversé toute la migration sans un mot ;
  // la scène croyait charger un homomorphisme et n'en chargeait AUCUN, depuis des mois.
  //
  // L'ARGUMENT QUI TRANCHE : ne rien pouvoir vérifier n'est pas une raison de ne rien vérifier,
  // c'est une raison de vérifier AUTRE CHOSE. Ici le vérifiable est trivial — l'entrée existe-t-elle
  // dans le fichier invoqué. Aucun catalogue n'est requis pour poser cette question.
  //
  // FRONTIÈRE MESURÉE AVANT DE LIVRER, sur 447 fichiers de scène (bibliothèque Kanopi entière,
  // démos, scènes de BPx) : QUATRE invocations ne résolvent pas, et les quatre sont déjà refusées
  // aujourd'hui (`alphabet.raga`, axe à catalogue). Ce fail-loud n'ajoute donc AUCUNE casse.
  // ⛔ UNE LIBRAIRIE S INVOQUE PAR LE MOT QU ELLE DECLARE, JAMAIS PAR LE NOM DE SON FICHIER —
  // décision de Romain, 2026-08-17. Le nom LOGIQUE se sépare du nom PHYSIQUE : « un fichier se
  // renomme, se scinde ou s'ajoute sans qu'aucune scène change ».
  //
  // ⚠️ `loadLib(nom)` NE SUFFIT PAS À JUGER, et c'est ce qui laissait les deux voies vivre : il
  // traduit un AXE en fichier, puis retombe sur le nom TEL QUEL quand ce n'est pas un axe. Sept
  // fichiers étaient donc adressables par leur nom physique — `voices.bayan_open`,
  // `tunings.western_12TET`, `sounds.tabla_perc`… — cinq jours après l'arbitrage, pendant que
  // kanopi migrait 22 scènes sur la règle inverse.
  //
  // ⛔ CE JUGE LIT DONC LES MOTS DÉCLARÉS, jamais le registre des fichiers. Un mot qu'aucune
  // librairie ne DÉCLARE n'est pas un axe, même si un fichier porte ce nom.
  const motsDeclares = () => new Set(
    Object.values(leRegistre()).map((l) => l && typeof l === 'object' ? l.resolves : null).filter(Boolean));
  const libExiste = (nom) => motsDeclares().has(nom);
  // Un mot réservé : la grammaire, ou le mot d'une famille du registre (le schéma est dissous).
  const motsDuLangage = { has: (nom) => motReserve(nom) };
  // ⛔ LA TÊTE NUE ACCEPTAIT ENCORE LE NOM DE FICHIER, ET C'ÉTAIT LA DERNIÈRE BRÈCHE.
  //
  // Ce juge écartait les directives SANS sous-clé — `if (!d.subkey) continue` — donc `alphabets` seul
  // en tête passait pendant que `alphabets.western` était refusé. Mesuré le 2026-08-24, place par
  // place, chacune éprouvée avec le mot déclaré ET le nom de fichier :
  //     tête NUE                     ✓ accepté   ⬅ LA BRÈCHE, 8 noms physiques sur 8
  //     tête POINTÉE                 ⛔ refusé
  //     clé d'ACTEUR                 ⛔ refusé
  //     préfixe de contrôle           ⛔ refusé
  //
  // ⇒ La décision de Romain du 2026-08-17 l'ordonnait déjà, sous « Ce qui est décidé », ligne 23 :
  // *« Une invocation et une clé d'acteur emploient LE MÊME MOT. »* Ce que sa section « L'état
  // mesuré » écrit — *« l'invocation admet les deux »* — est un CONSTAT de la divergence, pas une
  // permission. **Le rang des sections décidait, et personne ne l'avait regardé pendant sept jours.**
  //
  // ⚠️ ET LE PRINCIPE NE TIENT QUE SI LE NOM PHYSIQUE N'INVOQUE PAS : *« un fichier se renomme, se
  // scinde ou s'ajoute sans qu'aucune scène change »*. Quatre places conformes ne protègent rien
  // tant que la cinquième est ouverte.
  //
  // ⚠️ RIEN N'EST ÉCRIT EN DUR : le juge compare le nom au champ `resolves` de la librairie que ce
  // nom désigne. Un fichier dont le nom ÉGALE son mot déclaré n'est pas touché, et un fichier
  // ajouté demain l'est le jour même.
  for (const d of ast.directives || []) {
    if (!d || !d.name) continue;
    if (!d.subkey) {
      const fichierNu = leRegistre()[d.name];
      const motNu = fichierNu && typeof fichierNu === 'object' ? fichierNu.resolves : null;
      if (motNu && motNu !== d.name) {
        errors.push(diagnostic('RESOLVE_FILE_NAME_WORD_INVOKES', { p1: d.name, motNu }, { line: d.line }));
      }
      continue;
    }
    if (catalogAxes.includes(d.name)) continue;   // déjà couvert par checkComponent, ci-dessous
    // ⛔ UN AXE QUE PERSONNE NE SERT EST REFUSE. Cette ligne disait « pas une librairie : autre
    // faute, autre message » — et AUCUN autre message n'existait. `module.adsr`, `patch.x`,
    // `devices.x` passaient donc en silence, et `zzzinvente.quoi` aussi : le trou n'etait pas de
    // trois noms, il etait OUVERT A L'INFINI. Mesure du 2026-08-17, cas fabrique par l'architecte.
    //
    // ⚠️ RIEN N'EST EN DUR NI D'UN COTE NI DE L'AUTRE. Les trois noms venaient de la SPEC, jamais
    // du code — il ne les a jamais connus. Et ce qui est epargne ici se lit dans la DONNEE : les
    // mots du langage que les librairies recensent, dont `out` et `in`, qui portent une sous-cle
    // sans etre des invocations de librairie.
    //
    // ⛔ CE LECTEUR VISE `core` PAR SON NOM, ET CE N'EST PAS UN OUBLI — C'EST UN DEFAUT SIGNALE.
    // La liste a DEUX domiciles et DEUX formes : il connait donc 22 mots sur 67, et rend aux 45
    // autres « aucune librairie ne sert cet axe », c'est-a-dire le refus d'un mot INVENTE pour des
    // mots du langage. `seed.x` envoie son auteur chercher une librairie.
    //
    // ⛔ ET LE BRANCHER SUR LA PORTE `universeReservedDirectives` LE REND PIRE, MESURE LE
    // 2026-08-19 : `seed.x`, `meter.x` et `timepatterns.x` se mettent alors a COMPILER. L'exemption
    // est aveugle — elle epargne le mot sans que personne ne juge la SOUS-CLE — et `out`/`in` ne
    // s'en tirent que parce qu'un autre juge les rattrape ensuite. Un message imparfait qui REFUSE
    // vaut mieux qu'un message parfait qui AVALE.
    // ⛔ ET LE JUGE QUI MANQUAIT EST ICI — « un mot du langage suivi d'une sous-clé qu'il n'admet
    // pas ». L'exemption qui vivait à cette ligne épargnait le MOT sans juger la SOUS-CLÉ : elle
    // était aveugle, et le seul refus qui la rattrapait venait d'ailleurs, pour certains mots
    // seulement. Mesuré le 2026-09-03, mot par mot sur les neuf : `seed.zzz` et `init.zzz` ne
    // rendaient AUCUNE erreur — la ligne était lue, écrite dans l'arbre, et sans effet. Sept autres
    // étaient rattrapés par leur propre lecteur, ce qui masquait le trou au lieu de le fermer.
    //
    // LE REFUS PORTE SA RÉÉCRITURE, lue dans la donnée (`grammarWords.syntaxe`) : un auteur qui
    // écrit `seed.42` s'entend dire `seed:<N>`. Ce qui ÉCHAPPE se lit aussi dans la donnée — une
    // CLÉ D'ACTEUR (`out.midi`, `alphabet.western`) porte une sous-clé par construction, et une
    // FAMILLE du registre est une invocation, jugée deux lignes plus bas sur son entrée.
    if (!libExiste(d.name)) {
      if (motsDuLangage.has(d.name)) {
        if (clesDActeur().has(d.name)) continue;   // `out.<canal>` : la sous-clé est sa forme
        const forme = formeDuMot(d.name);
        errors.push(diagnostic('RESOLVE_LANGUAGE_WORD_NOT_QUALIFIED', {
          name: d.name, subkey: d.subkey,
          forme: forme ? ` — it is written '${forme}'.` : '.',
        }, { line: d.line }));
        continue;
      }
      // ⛔ ET LE REFUS NOMME LE MOT A ECRIRE quand l axe est un NOM DE FICHIER. Sans ça, l auteur
      // de `voices.bayan_open` lit « aucune librairie ne sert cet axe » devant un fichier qui
      // existe, et il cherche une donnee manquante au lieu de changer un mot.
      const fichier = leRegistre()[d.name];
      const motAEcrire = fichier && typeof fichier === 'object' ? fichier.resolves : null;
      errors.push(diagnostic(
        motAEcrire ? 'RESOLVE_AXIS_IS_FILE_NAME' : 'RESOLVE_AXIS_SERVED_BY_NONE',
        { name: d.name, subkey: d.subkey, motAEcrire }, { line: d.line }));
      continue;
    }
    if (loadLib(d.name, d.subkey)) continue;
    errors.push(diagnostic('RESOLVE_ENTRY_DOES_EXIST_LIBRARY', { p1: d.name, p2: d.subkey }, { line: d.line }));
  }

  // LA TABLE D'UNE ENTRÉE (`mapping.<table>`) EST SOUMISE AU MÊME CRI — sans exemption (arbitrage
  // architecte 2026-07-27). J'avais épinglé le cas plutôt que de trancher, parce que `lib/mapping.json`
  // est délibérément vide et que le cri rendait non compilables les exemples de la décision. La
  // réponse : ce sont les EXEMPLES qui changent, pas la règle — ils s'écrivent en ADRESSE NUE, forme
  // explicitement autorisée.
  //
  // LA RAISON DU REFUS D'EXEMPTER, et elle vaut au-delà d'ici : une dérogation posée « jusqu'au
  // remplissage » n'a pas de date de fin, personne ne la surveille, et elle survit à la raison qui
  // l'a fait naître. Trois ont été démontées cette semaine.
  for (const e of ast.inputs || []) {
    if (!e || !e.mapping) continue;
    if (loadLib('mapping', e.mapping)) continue;
    errors.push({
      // ⛔ CE REFUS NOMMAIT UNE LIBRAIRIE QUI N'EXISTE PLUS. `lib/mapping.json` est retiré le
      // 2026-08-24 — décision de Romain, une place qui ne porte aucune donnée n'a pas de fichier —
      // et le message envoyait l'auteur « ajouter la table dans la librairie 'mapping' », c'est-à-dire
      // dans un fichier supprimé. Le refus est le domicile où l'auteur apprend la règle : il dit
      // désormais ce qui EST, à savoir qu'aucune librairie ne déclare de table.
      ...diagnostic('RESOLVE_MAPPING_TABLE_UNDECLARED', { name: e.name, mapping: e.mapping },
        { line: e.line }),
    });
  }

  // 3. Directives de scène : invocation de composant (axis.X) OU override de valeur (X:v).
  for (const d of ast.directives || []) {
    if (d.subkey && catalogAxes.includes(d.name)) { checkComponent(d.name, d.subkey, d.line); continue; }
    // ⛔ UN MOT QU'UNE LIBRAIRIE NON INVOQUÉE DÉCLARE N'EST PAS INCONNU : il est hors portée, et son
    // refus — qui nomme la librairie à invoquer — est rendu par le contrôle de place (`dire`, dans
    // `validateReferences`). Ces trois refus ne visent que les mots que PERSONNE ne déclare.
    const declareAilleurs = librairiesQuiDeclarent(d.name).length > 0;
    if (d.value != null && d.value !== true && !registry.has(d.name) && !reserved.has(d.name) && !declareAilleurs) {
      errors.push(diagnostic('RESOLVE_UNKNOWN_VALUE_DECLARED_ANY', { p1: d.name }, { line: d.line }));
      continue;
    }
    // ⛔ ET LA TROISIÈME GRAPHIE — `<clé>:<mot>` — TOMBAIT DANS UN TROISIÈME SILENCE.
    //
    // Le refus du dessus lit `value`, qui ne porte QUE les nombres. Quand ce qui suit le deux-points
    // est un mot, le lecteur le range dans `runtime` — la graphie d'un canal de sortie
    // (`alphabet.western:audio`) — et plus rien ne regardait le nom de la clé. Mesuré le 2026-08-19 :
    // `zorglubinvente:studio` compilait SANS UN MOT et posait sa ligne dans l'arbre, quand
    // `zorglubinvente:64` était refusé. Un même mot inventé, deux sorts, selon ce qu'on écrit après.
    //
    // ⚠️ C'EST LE TROISIÈME CAS DE LA MÊME FAMILLE, et les deux premiers sont réparés juste ici :
    // `X:<nombre>` au-dessus, la forme NUE au-dessous, le 2026-08-10. Chacun a été trouvé par la
    // casse suivante, jamais par la relecture du voisin — parce que trois graphies portent la même
    // faute et qu'une réparation écrite pour l'une ne dit rien des deux autres.
    //
    // ⚠️ ET LE CANAL DE SORTIE PASSE, parce que sa clé est un AXE DE CATALOGUE : `alphabet.western`
    // porte un `subkey` et sort deux lignes plus haut. La forme visée n'a pas de sous-clé — un nom
    // seul, suivi d'un mot, que rien ne déclare.
    if (d.subkey == null && d.runtime != null
        && !registry.has(d.name) && !reserved.has(d.name) && !declareAilleurs) {
      errors.push(diagnostic('RESOLVE_DECLARED_LOADED_LIBRARY_TOP', { p1: d.name, p2: d.runtime }, { line: d.line }));
      continue;
    }
    // ⚠️ ET LA FORME NUE AUSSI — c'est la moitié qui avait régressé. Le refus ci-dessus ne mordait
    // que sur `X:valeur` : toute directive écrite SANS valeur passait, quel que soit son nom.
    // Mesuré le 2026-08-10 : `zorglub42` compilait sans un mot, exactement comme `sub`.
    //
    // C'est la règle 1 de Romain dans son état le plus nu — « tous les mots acceptés par le parseur
    // doivent venir des librairies invoquées dans la scène ». L'union des vocabulaires ne sert à
    // rien tant qu'un nom absent de l'union est accepté quand même : le vocabulaire existe, il
    // n'est simplement pas OPPOSÉ à l'auteur.
    //
    // Une invocation de librairie (`core`, `alphabet.western`) porte son nom dans le registre ou
    // un `subkey` — elle ne tombe pas ici.
    // ⚠️ ET SEULEMENT LES DIRECTIVES QUI INVOQUENT. Une directive qui DÉCLARE (`def`, `var`,
    // `actor`…) porte le nom que l'AUTEUR crée, pas un mot de librairie : son nœud a son propre
    // type, et l'aval le lit ainsi. Sans ce filtre, la garde refuse `def m C4 D4` en accusant
    // « 'm' n'est déclaré par aucune librairie » — elle reproche à l'auteur d'avoir nommé ce
    // qu'il déclare. Mesuré le 2026-08-10 : j'ai d'abord pris ce refus pour un défaut du parseur
    // et je l'ai inscrit au backlog ; c'était la garde qui ne savait pas distinguer.
    if (d.type && d.type !== 'Directive') continue;
    if (d.value == null && !d.subkey && !d.runtime
        && !registry.has(d.name) && !reserved.has(d.name) && !loadLib(d.name) && !declareAilleurs) {
      errors.push(diagnostic('RESOLVE_DECLARED_LOADED_LIBRARY_TOP_2', { p1: d.name }, { line: d.line }));
    }
  }

  // 4bis. UN RÉGLAGE QUI NE SE POSE QU'UNE FOIS NE SE POSE PAS DEUX — et le groupe est DANS LA
  //       DONNÉE, jamais ici.
  //
  // Le moteur natif tient deux compteurs (CompileGrammar.c:1535-1551) et refuse par `return(7)` :
  // la grammaire entière ne compile pas. `NotFoundMetronom` couvre `_mm` ; `NotFoundNatureTime` est
  // PARTAGÉ par `_striated` et `_smooth`, qui tombent dans le même `case` par fall-through.
  //
  // ⚠️ C'EST POURQUOI LA DONNÉE NOMME UN GROUPE ET NON UN BOOLÉEN. Un `unique:true` par mot aurait
  // laissé passer `striated` suivi de `smooth` — deux mots différents, un seul réglage : la nature
  // du temps, qu'on ne règle pas deux fois. C'est le cas qu'une formulation par mot rate, et il a
  // fallu que bp3-frontend aille lire le C pour qu'il apparaisse : mon signalement d'origine ne
  // parlait que de deux mots sur trois, et les donnait pour indépendants.
  //
  // TOUTES LES POSITIONS COMPTENT DANS LE MÊME SEAU, parce que le natif compte sur la GRAMMAIRE
  // entière : la tête de scène et les modificateurs de sous-grammaire. Compter la surface à part de
  // la graphie de sous-grammaire laisserait passer `tempo:120` suivi de `mode:ord(tempo:90)`.
  {
    const groupes = new Map();          // groupe -> [{mot, line}]
    const noter = (nom, line) => {
      if (!nom) return;
      const g = groupeDUnicite(nom);
      if (!g) return;
      if (!groupes.has(g)) groupes.set(g, []);
      groupes.get(g).push({ mot: nom, line });
    };
    for (const d of ast.directives || []) {
      if (!d || (d.type && d.type !== 'Directive')) continue;
      // Une librairie d'environnement donne une valeur à CHAQUE mot, `resetnotes:false` et
      // `letring:true` compris — ce ne sont pas deux réglages d'une scène, ce sont deux valeurs
      // d'objets (forme 4, Romain 2026-09-03). L'unicité se juge sur la scène qui les emploie.
      if (environnement && environnement.librairie && (d.value != null || d.runtime != null)) continue;
      noter(d.name, d.line);
      for (const m of d.modifiers || []) noter(m && m.name, d.line);
    }
    for (const sg of ast.subgrammars || []) {
      for (const m of sg.modifiers || []) noter(m && m.name, sg.line);
    }
    for (const [groupe, vus] of groupes) {
      if (vus.length < 2) continue;
      const mots = [...new Set(vus.map((v) => v.mot))];
      errors.push(diagnostic('RESOLVE_GROUP_SET_TWICE', {
        groupe, fois: vus.length, mots: mots.map((m) => `'${m}'`).join(', '),
        remede: mots.length > 1 ? 'These words set THE SAME THING: keep only one.'
                                : 'Remove the extra occurrences.',
      }, { line: vus[vus.length - 1].line }));
    }
  }

  // 5. COHÉRENCE alphabet/accordage (bug 1.1, Romain 2026-07-05) : un accordage n'appartient
  //    qu'à SON alphabet (`tunings.json` Y.alphabet). Un alphabet DÉCLARÉ qui ne correspond
  //    pas à celui de l'accordage déclaré = INCOHÉRENCE → CRIE à la compilation (fail-loud),
  //    jamais compiler-et-sonner un mélange incohérent.
  const tuningAlphabet = (tname) => { const t = loadLib('tuning', tname); return (t && t.alphabet) || null; };
  const sceneComp = (axis) => { const d = (ast.directives || []).find((x) => x.name === axis && x.subkey); return d ? d.subkey : null; };
  const checkCoherence = (alphaName, tuningName, line) => {
    if (!alphaName || !tuningName) return;
    const ta = tuningAlphabet(tuningName);
    if (ta && ta !== alphaName) {
      errors.push(diagnostic('RESOLVE_ALPHABET_INCONSISTENT_TUNING_WHICH', { alphaName, tuningName, ta }, { line: line || 0 }));
    }
  };
  checkCoherence(sceneComp('alphabet'), sceneComp('tuning'), 0);
  for (const actor of ast.actors || []) checkCoherence((actor.properties || {}).alphabet, (actor.properties || {}).tuning, actor.line);

  // 4. Références d'entité des ACTEURS (axes à catalogue) → existence catalogue.
  for (const actor of ast.actors || []) {
    const props = actor.properties || {};
    for (const axis of catalogAxes) if (props[axis]) checkComponent(axis, props[axis], actor.line);
  }

  // 5. Références d'entité des TERMINAUX que la scène déclare — LA MÊME QUESTION QU'AU 4.
  //
  // ⛔ DEUX MÉCANISMES POUR UN SEUL FAIT, ET LA PROFONDEUR CHOISISSAIT LEQUEL. Mesuré le
  // 2026-08-29 : `tuning.zzzz` est REFUSÉ chez un acteur et ÉTAIT ACCEPTÉ chez un terminal, sur
  // les trois clés à la fois (tuning, octaves, out) — et le mot inconnu arrivait jusqu'à l'arbre
  // que l'aval reçoit, vérifié par contrôle négatif : la même clé remplie correctement n'en porte
  // aucune trace. Une règle qui vaut à un étage et pas à l'autre n'est pas une règle, c'est un cas.
  //
  // ⚠️ UN SEUL POINT LES COUVRE TOUTES, et c'est mesuré avant d'écrire : les quatre graphies de
  // déclaration — `terminal x (k.v)`, `terminal x k.v`, `def x k.v`, et le bloc indenté —
  // convergent sur le MÊME nœud, `DefDirective{kind:'terminal', keys}`. Fermer sur la graphie qui
  // s'est montrée en aurait laissé trois ouvertes.
  //
  // ⛔ AUCUN NOM DE CLÉ N'EST ÉCRIT ICI. Un axe à catalogue se valide par la porte du 4 ; la clé
  // de SORTIE se reconnaît à ce qu'elle est déclarée clé d'acteur (`schema.actorKeys`) et qu'elle
  // nomme une direction que les canaux portent (`schema.channels`) — deux listes de la donnée qui
  // se croisent. Ajouter une clé au langage se fait donc en librairie, sans une ligne de code.
  const lesCanaux = canaux();
  const directionsDeCanal = new Set(Object.values(lesCanaux)
    .flatMap((c) => Object.entries(c || {}).filter(([, v]) => typeof v === 'boolean').map(([k]) => k)));
  const clesDeSortie = new Set([...clesDActeur().keys()]
    .filter((k) => directionsDeCanal.has(k) && !catalogAxes.includes(k)));
  for (const def of ast.defs || []) {
    if (!def || def.kind !== 'terminal' || !def.keys) continue;
    for (const [axe, ref] of Object.entries(def.keys)) {
      if (!ref || ref.kind !== 'ref' || !ref.value) continue;
      if (catalogAxes.includes(axe)) { checkComponent(axe, ref.value, def.line); continue; }
      if (!clesDeSortie.has(axe)) continue;
      const cause = canalFautif(ref.value);
      if (cause) errors.push(diagnostic('RESOLVE_TERMINAL', { p1: def.name, cause }, { line: def.line }));
    }
  }

  return errors;
}


export function splitCompoundTerminals(ast, libCtx) {
  const terminals = singleCharAlphabetSet(libCtx);
  if (!terminals) return;
  for (const sub of ast.subgrammars || []) {
    for (const rule of sub.rules || []) {
      rule.lhs = rule.lhs.flatMap((el) => splitLhsElement(el, terminals));
      rule.rhs = rule.rhs.flatMap((el) => splitRhsElement(el, terminals));
    }
  }
}



/**
 * LA TABLE DES PORTÉES PERMISES SE CONSTRUIT SUR CE QUE LA SCÈNE INVOQUE — Romain, 2026-09-02/03 :
 * « elle doit dépendre des librairies invoquées ». Elle lisait CINQ librairies par leur nom
 * (`expression`, `midi`, `audio`, `transpo`, `engine`), quelle que soit la scène : un réglage déclaré
 * ailleurs n'y entrait jamais, et un réglage d'une librairie que la scène n'invoquait pas y était.
 *
 * Ce qu'elle rend, pour une scène : chaque réglage déclaré par une librairie INVOQUÉE — directement
 * ou par une librairie qui l'invoque — avec la portée qu'il déclare ; et chaque clé d'adresse, de
 * même (elles ont quitté le socle le 2026-08-15 pour la librairie du canal qui les porte, et chacune
 * déclare sa portée). Un réglage déclaré par DEUX librairies invoquées n'a PAS de portée nu — c'est
 * l'ambiguïté que `validateReferences` refuse en nommant les préfixes, et l'auteur préfixe, comme un
 * terminal par son acteur ; préfixé (`get(cle, lib)`), il est jugé à la portée que SA librairie
 * déclare. SAUF quand les autres déclarent réaliser l'une (`implements:expression.volume`) : c'est
 * le même mot, une interface et ses réalisations, et sa portée nue est celle de l'interface. Mesuré
 * sur le corpus : `volume` est le seul mot dans ce cas, `audio` et `midi` réalisant `expression`.
 *
 * La table est mémorisée par ENSEMBLE de librairies invoquées, jamais par scène : deux scènes qui
 * invoquent la même chose partagent la même table, et un registre qui bouge la périme. Sans scène,
 * le registre entier fait portée — pour les outils qui décrivent le vocabulaire.
 */
export function chargerPorteesPermises(ast) {
  const registre = leRegistre();
  const version = versionDuRegistre();
  if (_versionDesTables !== version) { _tablesDesPortees.clear(); _versionDesTables = version; }
  const mots = ast ? motsInvoques(ast) : new Set(familles());
  const cleEnsemble = [...mots].sort().join(' ');
  if (_tablesDesPortees.has(cleEnsemble)) return _tablesDesPortees.get(cleEnsemble);

  const declarations = new Map();   // réglage → [{ mot, scope, implemente }]
  const noter = (mot, cle, scope, implemente) => {
    if (!declarations.has(cle)) declarations.set(cle, []);
    declarations.get(cle).push({ mot, scope, implemente: typeof implemente === 'string' ? implemente : null });
  };
  const marcher = (mot, o) => {
    for (const [k, v] of Object.entries(o || {})) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      if ('args' in v && 'description' in v) {
        // `bpscript:false` sort l'entrée du vocabulaire : elle n'a pas de portée.
        if (Array.isArray(v.scope) && v.bpscript !== false) noter(mot, k, v.scope, v.implements);
      } else marcher(mot, v);
    }
  };
  for (const [cle, lib] of Object.entries(registre)) {
    if (!lib || typeof lib !== 'object' || cle.includes('/')) continue;
    const mot = (typeof lib.resolves === 'string' && lib.resolves) || cle;
    if (!mots.has(mot)) continue;
    marcher(mot, lib);
    const adresses = lib.schema && lib.schema.addressKeys;
    if (adresses && !Array.isArray(adresses) && typeof adresses === 'object') {
      for (const [k, def] of Object.entries(adresses)) {
        if (k.startsWith('_') || !def || !Array.isArray(def.scope)) continue;
        noter(mot, k, def.scope, null);
      }
    }
  }
  const m = new Map();        // réglage → scope
  const ambigus = new Map();  // réglage → [mots]
  for (const [cle, decls] of declarations) {
    if (decls.length === 1) { m.set(cle, decls[0].scope); continue; }
    const interfaces = decls.filter((d) => !d.implemente);
    const realisations = decls.filter((d) => d.implemente);
    const uneInterface = interfaces.length === 1
      && realisations.every((r) => r.implemente === `${interfaces[0].mot}.${cle}`);
    if (uneInterface) { m.set(cle, interfaces[0].scope); continue; }
    ambigus.set(cle, decls.map((d) => d.mot));
  }
  const table = {
    // nu : la portée du mot s'il n'a qu'une déclaration (ou une interface) ; préfixé : celle de sa librairie
    get: (cle, lib) => (lib ? (declarations.get(cle) || []).find((d) => d.mot === lib)?.scope : m.get(cle)),
    has: (cle) => m.has(cle) || ambigus.has(cle),
  };
  _tablesDesPortees.set(cleEnsemble, table);
  return table;
}


export function singleCharAlphabetSet(libCtx) {
  const terms = (libCtx && libCtx.alphabetTerminals) || [];
  if (terms.length === 0) return null;
  for (const t of terms) { if (typeof t !== 'string' || t.length !== 1) return null; }
  return new Set(terms);
}


export function splitLhsElement(el, terminals) {
  if (!el || el.type !== 'Symbol') return [el];
  const toks = tokenizeCompoundName(el.name, terminals);
  if (toks === null || toks.some((t) => t.kind === 'number')) return [el];
  return toks.map((t, i) => makeSplitAtom(el, t.text, i === 0));
}


export function splitRhsElement(el, terminals) {
  if (!el || typeof el !== 'object') return [el];
  if (el.type === 'Symbol') {
    const toks = tokenizeCompoundName(el.name, terminals);
    if (toks === null) return [el];
    return toks.map((t, i) =>
      t.kind === 'number'
        ? { type: 'NumericDuration', numerator: Number(t.text), denominator: 1 }
        : makeSplitAtom(el, t.text, i === 0));
  }
  if (el.type === 'Polymetric' && Array.isArray(el.voices)) {
    return [{ ...el, voices: el.voices.map((v) => v.flatMap((c) => splitRhsElement(c, terminals))) }];
  }
  if ((el.type === 'TemplateMasterGroup' || el.type === 'TemplateSlaveGroup') && Array.isArray(el.elements)) {
    return [{ ...el, elements: el.elements.flatMap((c) => splitRhsElement(c, terminals)) }];
  }
  return [el];
}


/**
 * Tokenise un nom composé selon la règle NATIVE (réalignement A-bis, accord
 * architecte 2026-07-03 sur preuves bp3-engine [263] — constat hashab-monochar,
 * addendum) : à chaque position, (1) terminal déclaré au LONGEST-MATCH
 * (SEARCHTERMINAL2 Encode.c:888-918) ; sinon (2) MAJUSCULE → VARIABLE qui
 * absorbe les alphanumériques suivants (SEARCHVAR — preuves : abXa→a·b·Xa,
 * abX4→a·b·X4, abXcd→a·b·Xcd) ; sinon (3) CHIFFRE → NOMBRE (suite de chiffres —
 * preuves : ab4→a·b·4, ab4a→a·b·4·a) ; sinon (4) caractère hors règle prouvée →
 * nom INTACT (conservateur). Jamais « intacte à cause d'un char non-terminal »
 * (l'ancien choix, hérité de l'adaptateur BPx, était INFIDÈLE au natif).
 * null = rien à découper (atomique ou un seul token).
 */
export function tokenizeCompoundName(name, terminals) {
  if (name.length < 2) return null; // déjà atomique
  const toks = [];
  let i = 0;
  while (i < name.length) {
    let best = null;
    for (const t of terminals) {
      if (name.startsWith(t, i) && (best === null || t.length > best.length)) best = t;
    }
    if (best !== null) { toks.push({ kind: 'terminal', text: best }); i += best.length; continue; }
    const ch = name[i];
    if (ch >= 'A' && ch <= 'Z') {
      let j = i + 1;
      while (j < name.length && /[A-Za-z0-9]/.test(name[j])) j++;
      toks.push({ kind: 'variable', text: name.slice(i, j) });
      i = j; continue;
    }
    if (ch >= '0' && ch <= '9') {
      let j = i + 1;
      while (j < name.length && name[j] >= '0' && name[j] <= '9') j++;
      toks.push({ kind: 'number', text: name.slice(i, j) });
      i = j; continue;
    }
    return null; // hors règle native prouvée → intact
  }
  return toks.length < 2 ? null : toks;
}


export function makeSplitAtom(original, ch, isFirst) {
  const node = { type: 'Symbol', name: ch };
  if (original.line !== undefined) node.line = original.line;
  if (original.actor !== undefined) node.actor = original.actor;
  if (isFirst && original.negated === true) node.negated = true;
  if (isFirst && original.payload !== undefined) node.payload = original.payload;
  return node;
}


/**
 * FAIL-FAST à la COMPILATION (règle Romain 2026-07-04, langages bien faits) : toute
 * référence dont l'info est disponible ici DOIT être vérifiée ici, pas reportée à la
 * dérivation. Une référence — VALEUR (`X:v`, occurrence `(k:v)`) ou COMPOSANT
 * (`alphabet.X`, `tuning.X`, `octaves.X`) — qui n'existe pas dans les librairies
 * chargées → ERREUR CLAIRE (nom fautif). Kairos garde son filet défensif en aval.
 * ZÉRO HARDCODE : tout le vocabulaire (contrôles/valeurs/fonctions/adresses/axes) vient
 * des libs chargées + du schéma @core → une user library l'étend automatiquement.
 * @returns {Array<{message, line?, col?}>}
 */
/**
 * OÙ UN SAC SE TROUVE, LU SUR LE NŒUD QUI LE PORTE — la table qui traduit l'arbre en vocabulaire
 * de portée. Elle vient de la MESURE des dix porteurs de sac de l'arbre, pas d'une intuition :
 * un réglage s'accroche aussi à un silence, à une prolongation, à un joker et aux deux membres
 * d'un gabarit, et tous relèvent de `symbol` — écrire « note » aurait rétréci le vocabulaire sous
 * l'usage réel. Ajouter un porteur au langage l'inscrit ici, et il est validé aussitôt.
 */
const REFUS_HORS_PORTEE_ACTIF = true;   // cf. la note au point de confrontation, plus bas
const PORTEE_DU_PORTEUR = {
  Rule: 'rule',
  Polymetric: 'group', RawBrace: 'group',
  InstantControl: 'flow',
  Symbol: 'symbol', SymbolCall: 'symbol', Wildcard: 'symbol', Prolongation: 'symbol',
  Rest: 'symbol', TemplateMaster: 'symbol', TemplateSlave: 'symbol',
};
/** Les mots du vocabulaire, dits en français dans les messages — l'auteur ne lit pas la donnée. */
/**
 * ⛔ UNE PLACE SE NOMME PAR SA FORME QUAND LE NOM SEUL NE SUFFIT PAS À L'ÉCRIRE. Atlas a mesuré le
 * 2026-08-19 que `destru` recevait « il vaut en tête de sous-grammaire ou sur une règle » — et que
 * l'écrire NU en tête de sous-grammaire était refusé à son tour, par un AUTRE message qui le
 * renvoyait en tête de scène, que le premier refuse. **Les deux messages s'envoyaient l'un vers
 * l'autre, et aucun ne nommait la seule place qui marche.**
 *
 * En tête de sous-grammaire, un réglage ne s'écrit pas seul : il vit dans la parenthèse du mode —
 * `mode:rnd(destru)`. Nommer la place sans nommer la forme envoie l'auteur écrire ce qui sera
 * refusé. Un refus qui donne une réécriture doit donner une réécriture QUI COMPILE.
 */
const NOM_DE_PLACE = {
  scene: 'at the top of a scene', subgrammar: 'at the top of a sub-grammar, inside the mode parentheses (`mode:<mode>(<setting>)`)',
  rule: 'on a rule', group: 'on a group', symbol: 'on an element', flow: 'in the flow',
};

/**
 * Les portées permises par clé, ramassées dans TOUTES les librairies qui en portent.
 *
 * ⚠️ IL FAUT PLUSIEURS SOURCES : le sac ne porte pas que des contrôles. `ch` vient du socle, les
 * procédures moteur de leur propre librairie, les clés d'adresse du canal qui les porte — bâtir la
 * table sur la seule librairie des contrôles les refuserait toutes à tort.
 *
 * ⛔ ELLE A TENU DEUX TABLES, une pour les contrôles et une pour les entrées de modulation, sur
 * décision de Romain du 2026-08-15 : `pan` était le SEUL nom porté par les deux familles, et la
 * table unique laissait la portée de l'entrée écraser celle du contrôle — `pan:64` en tête de
 * scène était refusé en récitant les places de l'AUTRE `pan`. La seconde table disparaît avec
 * l'archivage de la librairie des modulations le 2026-08-22 : plus aucune clé ne l'alimente.
 * `pan` reste gouverné par sa déclaration de contrôle, qui porte `scene`.
 */
const _tablesDesPortees = new Map();   // ensemble de librairies invoquées → table
let _versionDesTables = -1;

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
