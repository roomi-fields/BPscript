/**
 * L'INDEX DES OBJETS — ce que les librairies déclarent, rendu comme des objets, pour la porte
 * `objets.js` ET pour le compilateur, qui joint à l'arbre le contenu de ce qu'une scène invoque.
 *
 * ⛔ CE MODULE N'IMPORTE PAS LE COMPILATEUR, et c'est ce qui le distingue de la porte. La porte
 * `objets.js` importe `bpxAst.js` pour son effet de bord — brancher le compilateur sur le chargeur —
 * parce que quiconque entre par elle seule doit trouver le registre prêt. Le compilateur, lui, lit
 * cet index pour joindre les librairies à l'arbre : s'il importait la porte, le cycle serait fermé
 * (`bpxAst → objets → bpxAst`), et l'architecture n'en admet aucun. L'index vit donc ici, sans
 * branchement ; la porte le réexporte après avoir branché.
 *
 * Ce que l'index rend :
 *   - une FAMILLE : l'objet racine d'un catalogue, nommé par le mot qu'on invoque (`scale`, `audio`,
 *     `alphabet`), ses membres propres, et ses entrées ;
 *   - un OBJET : son nom, la famille qui le porte, l'objet dont il dérive, ses membres propres, la
 *     place du catalogue où il est rangé, et s'il entre dans l'aide publiée ;
 *   - la RÉSOLUTION d'un nom : `objet('alphabet.western')` rend l'objet dont la chaîne finit ainsi ;
 *     `objet('western')` rend le seul objet de ce nom, ou la liste des candidats quand plusieurs
 *     familles en portent un (décision `2026-09-02-resolves-sort-un-objet-s-invoque-par-tout-suffixe-
 *     non-ambigu-de-sa-chaine.md`).
 *
 * ⚠️ UN CATALOGUE DE SOUS-DOSSIER EST UNE ENTRÉE DE SON DOSSIER. `lib/settings/test1.json` est ce
 * qu'une scène invoque par `settings.test1` : l'entrée `test1` de la famille `settings`, dont les
 * membres sont le contenu du fichier. Mesuré le 2026-09-02 sur la bibliothèque de kanopi : rendu
 * comme une famille `settings/test1`, il ne se résolvait par aucune chaîne qu'une scène écrit.
 *
 * ⚠️ LA CHAÎNE D'UN OBJET EST AUJOURD'HUI `<famille>.<nom>`. Les sortes d'une famille (`interval`,
 * `degree`… pour `scale`) vivent encore dans `types` ; elles rejoindront leur famille quand les
 * prototypes quitteront `types`, et la chaîne `scale.degree.bilaval` se lira alors ici sans qu'un
 * consommateur change.
 */
import { leRegistre, versionDuRegistre, placesDesLibrairies } from './libs.js';
import { entreesDe, CHAMPS_DU_PAQUET, CHAMPS_DE_FICHIER } from './libs-champs.js';
// Le schéma de SYNTAXE — ce que le langage EST, par sa propre porte (décision Romain, 2026-08-20).
import { SYNTAXE } from './syntaxe-data.js';

/** Le mot d'une famille — ce qu'on invoque. Lu dans la donnée tant que le paquet la porte. */
function motDe(cle, lib) {
  return (lib && typeof lib.resolves === 'string' && lib.resolves) || cle;
}

/** Les membres propres d'un objet du paquet : tout sauf la trace de dérivation et les notes privées. */
function membresDe(objet, exclure = new Set()) {
  const out = {};
  for (const [k, v] of Object.entries(objet || {})) {
    if (k === '_derive' || k.startsWith('_') || exclure.has(k)) continue;
    out[k] = v;
  }
  return out;
}

let _index = null;
let _versionIndexee = -1;

/**
 * L'index de tous les objets de toutes les librairies — reconstruit quand le registre change,
 * jamais recopié. Chaque objet porte : nom, famille, derive, membres, place, chaine, librairie,
 * documented.
 *
 * ⛔ IL SE MÉMORISE SOUS LA VERSION DU REGISTRE, ET UNE AUTRE VERSION LE PÉRIME. Le compilateur lit
 * cet index à chaque compilation — dont celles des sources de librairie PENDANT le chargement du
 * registre. Mémorisé sans version, il figeait un index partiel, souvent vide, pour tout le processus :
 * mesuré le 2026-09-02 sur la porte construite, hors dépôt — le garde, lui, interrogeait la porte
 * avant de compiler et ne le voyait pas. Chaque enregistrement change la version, donc un index pris
 * pendant l'amorçage est périmé à l'enregistrement suivant, et le premier index pris sur le registre
 * complet est celui qui reste.
 */
function index() {
  // La source est le REGISTRE du compilateur — lu dans les sources de `lib/`, jamais dans le paquet.
  // `leRegistre()` d'ABORD : c'est lui qui charge, et la version se lit après.
  const LIBS = leRegistre();
  const version = versionDuRegistre();
  if (_index && _versionIndexee === version) return _index;
  const familles = new Map();   // mot → { nom, membres, entrees: Objet[], contributeurs: [clé de paquet] }
  const objets = new Map();     // nom → Objet[] (plusieurs familles peuvent porter un même nom)
  const poser = (o) => {
    if (!objets.has(o.nom)) objets.set(o.nom, []);
    objets.get(o.nom).push(o);
  };
  const PLACES = placesDesLibrairies(LIBS);
  const familleDe = (mot) => {
    // ⛔ UNE FAMILLE PUBLIE SES PLACES — posé le 2026-09-03 sur la mesure d'atlas. Une place VIDE
    //   était INVISIBLE : `core.symbols` existe, ne contient aucune entrée, et la porte n'en disait
    //   rien alors que le bundle le portait par sa structure. Ranger les objets PAR place ne peut pas
    //   rendre une place sans objet — c'est ce que `PLACES` sait et que la porte taisait.
    if (!familles.has(mot)) familles.set(mot, { nom: mot, membres: {}, entrees: [], places: [], contributeurs: [] });
    return familles.get(mot);
  };
  for (const [cle, lib] of Object.entries(LIBS)) {
    if (!lib || typeof lib !== 'object' || Array.isArray(lib)) continue;
    // Un catalogue de sous-dossier : `settings/test1` est l'entrée `test1` de la famille de `settings`.
    const barre = cle.indexOf('/');
    if (barre > 0) {
      const dossier = cle.slice(0, barre);
      const mot = motDe(dossier, LIBS[dossier]);
      const fam = familleDe(mot);
      fam.contributeurs.push(cle);
      const o = {
        nom: cle.slice(barre + 1), famille: mot, derive: null,
        membres: membresDe(lib, CHAMPS_DE_FICHIER), place: null, chaine: [mot, cle.slice(barre + 1)],
        librairie: cle, documented: Boolean(lib.documented),
      };
      fam.entrees.push(o);
      poser(o);
      continue;
    }
    const mot = motDe(cle, lib);
    const places = new Set((PLACES[cle] || []).filter((p) => p !== '_deduites'));
    const fam = familleDe(mot);
    fam.contributeurs.push(cle);
    for (const place of places) if (!fam.places.includes(place)) fam.places.push(place);
    // Les membres propres de la racine : les champs de sommet qui ne sont ni une entrée, ni une place,
    // ni un champ du paquet. Le premier contributeur écrit, les suivants complètent sans écraser.
    for (const [k, v] of Object.entries(lib)) {
      if (k.startsWith('_') || CHAMPS_DU_PAQUET.has(k) || places.has(k)) continue;
      if (v && typeof v === 'object' && !Array.isArray(v)) continue;   // une entrée, lue plus bas
      if (!(k in fam.membres)) fam.membres[k] = v;
    }
    // ⛔ `documented` SE LIT SUR L'ENTRÉE, CHEZ SON CONTRIBUTEUR — jamais sur la famille. Deux
    // catalogues servent `alphabet` : l'un porte `// @documented`, l'autre non, et la racine de la
    // famille ne garde que le premier. Mesuré par kairos le 2026-09-02 : `membres.documented` valait
    // `true` pour les 24 entrées. Ce qu'un catalogue déclare vaut pour CHACUNE de ses entrées.
    const entree = (nom, brut, place) => {
      const o = {
        nom, famille: mot, derive: typeof brut._derive === 'string' ? brut._derive : null,
        membres: membresDe(brut), place, chaine: [mot, nom],
        // ⛔ D'OÙ VIENT CET OBJET — champ posé le 2026-09-03 sur la mesure de bp3-frontend. Deux
        // catalogues servent la famille `alphabet` : `alphabets` (16) et `test_alphabets` (8). La
        // porte les aplatissait en 24 objets INDISCERNABLES, quand le bundle les séparait par ses
        // sections. Ce n'était pas un choix : une information que le paquet portait avait disparu.
        // ⚠️ ET SÛREMENT PAS `documented` À SA PLACE : il vaut `false` sur les alphabets de test et
        // `true` ailleurs, donc il COÏNCIDE aujourd'hui — mais il dit « ce catalogue est documenté »,
        // pas « il vient d'ici ». Un champ qui coïncide n'est pas un champ qui signifie ; le jour où
        // un alphabet de test serait documenté, un garde bâti dessus deviendrait faux sans rougir.
        // bp3-frontend a refusé de s'en servir, et il avait raison.
        librairie: cle, documented: Boolean(lib.documented),
      };
      fam.entrees.push(o);
      poser(o);
    };
    for (const nom of entreesDe(lib)) {
      if (places.has(nom)) continue;
      entree(nom, lib[nom], null);
    }
    for (const place of places) {
      const contenu = lib[place];
      if (!contenu || typeof contenu !== 'object' || Array.isArray(contenu)) continue;
      for (const nom of entreesDe(contenu)) entree(nom, contenu[nom], place);
    }
  }
  // ⛔ LA DÉRIVATION SE RÉSOUT À LA LECTURE — un exemplaire porte les membres de sa chaîne de
  // prototypes qu'il n'écrit pas. Le registre PORTE la structure et ne recopie pas l'héritage
  // (Romain, 2026-08-29) ; c'est donc ici, à la porte, que `alphabet.arabic` reçoit le `scope` et
  // l'`octaves` de `def alphabet`. Décision de Romain, 2026-09-02 : l'octaviation par défaut « doit
  // être spécifiée dans le prototype d'alphabet », et la section joint le membre hérité.
  // ⚠️ LE PROTOTYPE EST UNE RACINE : un nom de type peut aussi être celui d'un contrôle (`scale` est
  // le prototype de `types` ET un contrôle de `transpo`) ; parmi les candidats, celui qui ne dérive
  // de rien est le prototype. Une chaîne qui boucle s'arrête où elle repasse.
  const parNom = (nom) => objets.get(nom) || [];
  const prototypeDe = (nom) => {
    const candidats = parNom(nom);
    if (candidats.length === 1) return candidats[0];
    const racines = candidats.filter((c) => !c.derive);
    return racines.length === 1 ? racines[0] : null;
  };
  for (const liste of objets.values()) {
    for (const o of liste) {
      if (!o.derive) continue;
      const vus = new Set([o]);
      let proto = prototypeDe(o.derive);
      while (proto && !vus.has(proto)) {
        vus.add(proto);
        for (const [k, v] of Object.entries(proto.membres)) if (!(k in o.membres)) o.membres[k] = v;
        proto = proto.derive ? prototypeDe(proto.derive) : null;
      }
    }
  }
  // ⛔ LA RACINE D'UNE FAMILLE EST SON PROTOTYPE — et ses membres descendent sur ses entrées, comme
  // ceux de tout prototype. C'est ce qui fait qu'un corps rattaché à la racine (`lib/<x>/<x>.ts`)
  // voyage avec chaque entrée : l'applicateur d'homomorphisme part avec la table qui l'emploie
  // (Romain, 2026-09-03 ; demande de kairos, 3676). Ce qu'une entrée écrit gagne, toujours.
  // `documented` reste lu chez le contributeur de CHAQUE entrée : il ne descend pas d'ici.
  for (const fam of familles.values()) {
    for (const o of fam.entrees) {
      for (const [k, v] of Object.entries(fam.membres)) {
        // `documented` se lit chez le contributeur de chaque entrée ; `apporte` dit ce que le
        // FICHIER invoque, pas ce que l'objet porte. Ni l'un ni l'autre ne descend.
        if (k === 'documented' || k === 'apporte' || CHAMPS_DE_FICHIER.has(k)) continue;
        if (!(k in o.membres)) o.membres[k] = v;
      }
    }
  }
  _index = { familles, objets };
  _versionIndexee = version;
  return _index;
}

/** Une copie d'un objet — la porte ne rend jamais ses structures internes. */
const copie = (o) => ({ ...o, membres: { ...o.membres }, chaine: [...o.chaine] });

/**
 * UN OBJET DÉCLARÉ PAR UNE LIBRAIRIE — ce que la porte `bpscript/objets` rend.
 *
 * ⛔ CES FORMES SONT ÉCRITES ICI PARCE QUE LA DÉRIVATION NE LES DEVINE PAS. Sans elles, mes quatre
 * fonctions publiques se décrivaient toutes en `any`, et un consommateur ne pouvait pas distinguer
 * « ce champ n'existe pas » de « ce champ n'a pas été inféré ». Mesuré chez kanopi le 2026-09-05,
 * à l'exécution sur ce que je publie : *une dérivation ferme la divergence, elle ne fonde pas la
 * complétude.*
 *
 * `membres` reste OUVERT, et c'est mesuré : ce qu'un objet porte est ce que sa librairie déclare —
 * fermer la forme ici ferait de ce fichier une seconde autorité, plus pauvre que la donnée.
 *
 * @typedef {object} ObjetDeclare
 * @property {string} nom                        Le nom sous lequel la scène le désigne.
 * @property {string} famille                    Le mot d'invocation de sa famille.
 * @property {string | null} derive              Le prototype dont il dérive, s'il en a un.
 * @property {{ [membre: string]: any }} membres Ce que sa librairie lui donne.
 * @property {string[]} [chaine]                 Sa chaîne de dérivation, de lui vers sa racine.
 */

/**
 * UNE FAMILLE — un mot d'invocation, ses membres propres, et ses entrées.
 *
 * @typedef {object} FamilleDeclaree
 * @property {string} nom
 * @property {{ [membre: string]: any }} membres
 * @property {string[]} places                   Les places où ce mot peut s'écrire.
 * @property {ObjetDeclare[]} entrees            Dans l'ordre de la donnée.
 */

/** Les familles — les mots qu'on invoque — dans l'ordre du paquet. */
/** @returns {string[]} */
export function familles() {
  return [...index().familles.keys()];
}

/**
 * Une famille : sa racine (membres propres) et ses entrées, dans l'ordre de la donnée.
 * Rend `null` quand aucune librairie ne déclare ce mot.
 *
 * @param {string} mot
 * @returns {FamilleDeclaree | null}
 */
export function famille(mot) {
  const f = index().familles.get(mot);
  if (!f) return null;
  return { nom: f.nom, membres: { ...f.membres }, places: [...f.places], entrees: f.entrees.map(copie) };
}

/**
 * Résout un nom écrit comme une chaîne — `alphabet.western`, ou un suffixe non ambigu — vers l'objet
 * qu'il désigne. Rend l'objet ; `null` si rien ne porte ce nom ; `{ ambigu: [chaines] }` quand
 * plusieurs objets finissent par ce suffixe : l'ambiguïté se constate à l'usage, jamais par une liste.
 *
 * @param {string} chaine
 * @returns {ObjetDeclare | { ambigu: string[] } | null}
 */
export function objet(chaine) {
  const segments = String(chaine || '').split('.').filter(Boolean);
  if (!segments.length) return null;
  const nom = segments[segments.length - 1];
  const candidats = (index().objets.get(nom) || []).filter((o) => {
    const c = o.chaine;
    if (segments.length > c.length) return false;
    for (let i = 1; i <= segments.length; i++) if (c[c.length - i] !== segments[segments.length - i]) return false;
    return true;
  });
  if (candidats.length === 1) return copie(candidats[0]);
  if (candidats.length === 0) return null;
  return { ambigu: candidats.map((o) => o.chaine.join('.')) };
}

/**
 * Tous les objets, à plat — pour qui inventorie.
 * @returns {ObjetDeclare[]}
 */
export function objets() {
  const out = [];
  for (const liste of index().objets.values()) for (const o of liste) out.push(copie(o));
  return out;
}

/**
 * LES TABLES DU SOCLE SE LISENT PAR L'OBJET QUI LES PORTE, JAMAIS PAR LE NOM D'UNE LIBRAIRIE.
 *
 * Décision de Romain, 2026-09-02 : « rien ne se code en dur de ce qui se déclare — le compilateur
 * lit, il ne connaît pas de liste de noms ». Le schéma structurel (`catalogAxes`, `channels`,
 * `actorKeys`, `qualifierKeys`, `reservedDirectives`…) et les défauts de scène (`components`) sont
 * des OBJETS déclarés par une librairie — `core` aujourd'hui. Treize lectures les cherchaient par
 * `loadLib('core')` : une librairie qui aurait déclaré son propre `schema` n'aurait jamais été lue,
 * et le mot `core` vivait dans le compilateur. Ces deux portes lisent l'objet par son NOM, dans le
 * registre entier ; deux librairies qui déclareraient le même sont une ambiguïté, et elle crie.
 */
function objetUnique(nom) {
  const o = objet(nom);
  if (!o) return null;
  if (o.ambigu) throw new Error(`'${nom}' est déclaré par plusieurs librairies — ${o.ambigu.join(', ')} — et le compilateur ne peut pas choisir`);
  return o.membres;
}
/**
 * ⛔ LE SCHÉMA DE `core` EST DISSOUS — arbitrage de Romain, 2026-09-03 (point 2 des cinq
 * arbitrages) : chaque champ vit sur l'objet qu'il décrit, ou se dérive. Rien n'est en portée sans
 * invocation, sauf la syntaxe. Les quatre lectures ci-dessous remplacent `leSchema()`.
 */

/** Les mots de la GRAMMAIRE — la syntaxe, par sa propre porte ; jamais une librairie. */
export function motsDeLaGrammaire() {
  const g = SYNTAXE.grammarWords;
  return new Set(g && Array.isArray(g.mots) ? g.mots : []);
}

/**
 * LA FORME QU'UN MOT DE LA GRAMMAIRE ADMET — `seed:<N>`, `out.<canal>`, `def <nom> <corps>`. Elle
 * existe pour qu'un refus donne la RÉÉCRITURE au lieu de constater : un mot du langage écrit
 * autrement s'entend dire ce qu'il fallait écrire. Rend `null` quand la donnée ne la porte pas.
 */
export function formeDuMot(nom) {
  const s = SYNTAXE.grammarWords && SYNTAXE.grammarWords.syntaxe;
  const f = s && s[nom];
  return typeof f === 'string' ? f : null;
}

/**
 * Un mot RÉSERVÉ — un mot de la GRAMMAIRE, celui qu'un auteur ne peut jamais ombrer (décision du
 * 2026-08-21 : la grammaire, le socle, les librairies ; seule la première est inombrable). La liste
 * `reservedDirectives` du schéma de `core` mêlait ces mots-là et des mots de LIBRAIRIE (`transpose`,
 * `homomorphism`, `settings`…) ; ces derniers sont des familles du registre, et une famille se
 * reconnaît par `familles()`, jamais par une liste.
 */
export function motReserve(nom) {
  return motsDeLaGrammaire().has(nom);
}

/**
 * LES AXES DE CATALOGUE — un prototype racine de `types` qui DÉCLARE la portée `scene` : ses
 * exemplaires s'invoquent en tête de scène, `alphabet.western`, `tuning.just`, `voice.wobble`.
 * C'est ce que la portée dit, et rien d'autre ne le dit : `temperament` a 174 entrées et ne
 * s'invoque pas directement (elle passe par un accordage), donc il ne déclare pas cette portée.
 * La liste `catalogAxes` du schéma de `core` est dissoute là-dedans (Romain, 2026-09-03).
 */
export function axesDeCatalogue() {
  const types = index().familles.get('types');
  if (!types) return [];
  return types.entrees
    .filter((e) => !e.derive && Array.isArray(e.membres.scope) && e.membres.scope.includes('scene'))
    .map((e) => e.nom);
}

/**
 * LES CLÉS D'UN ACTEUR sont les membres TYPÉS du prototype `actor` de `types` (`alphabet alphabet`,
 * `destination out`…) : nom → type. Vide sans `types` au registre.
 */
export function clesDActeur() {
  const o = objet('types.actor');
  const out = new Map();
  if (!o || o.ambigu) return out;
  for (const [k, v] of Object.entries(o.membres || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof v._derive === 'string') out.set(k, v._derive);
  }
  return out;
}

/**
 * LES CANAUX — les exemplaires du prototype `destination`, par nom : `{ audio: {out, writable,
 * params}, midi: {…}, … }`. La liste est FERMÉE parce que la donnée la porte. Un exemplaire se
 * reconnaît à son TYPE EN TÊTE (`destination midi (…)`), jamais à un nom de famille : il vit dans
 * la famille de la librairie qui le déclare.
 */
export function canaux() {
  const out = {};
  for (const o of index().objets.values()) {
    for (const e of o) {
      if (e.derive !== 'destination') continue;
      const m = {};
      for (const [k, v] of Object.entries(e.membres || {})) if (!k.startsWith('_')) m[k] = v;
      out[e.nom] = m;
    }
  }
  return out;
}
/**
 * Les défauts de scène — les membres de l'objet `components` (alphabet, tuning, transport, eval),
 * s'il est EN PORTÉE de la scène : sa librairie invoquée, directement ou par une autre. Sans scène,
 * le registre entier fait portée (le vocabulaire, l'éditeur).
 */
export function lesDefauts(ast) {
  const o = ast ? objetEnPortee('components', ast) : objet('components');
  if (!o) return null;
  if (o.ambigu) throw new Error(`'components' est déclaré par plusieurs librairies — ${o.ambigu.join(', ')}`);
  return o.membres;
}

/**
 * CE QU'UNE SCÈNE INVOQUE — les mots de ses invocations, et ceux que chaque librairie invoquée
 * invoque à son tour (`apporte`), jusqu'au bout. Ce qu'une librairie déclare est en portée quand elle
 * est invoquée, directement ou par une librairie qui l'invoque : c'est le principe d'invocation, le
 * même que le parseur applique aux types du socle. Il vaut pour les DÉFAUTS de scène : `core` déclare
 * un alphabet par défaut, effectif quand `core` est invoqué, surchargé par la scène ou l'acteur qui
 * déclare le sien (Romain, 2026-09-02).
 */
export function motsInvoques(ast) {
  const LIBS = leRegistre();
  const apportePar = new Map();
  for (const [cle, lib] of Object.entries(LIBS)) {
    if (!lib || typeof lib !== 'object') continue;
    const mot = motDe(cle.split('/')[0], LIBS[cle.split('/')[0]]);
    if (!apportePar.has(mot)) apportePar.set(mot, new Set());
    for (const a of (Array.isArray(lib.apporte) ? lib.apporte : [])) apportePar.get(mot).add(a);
  }
  const vus = new Set();
  // Le nom de chaque directive, et le PRÉFIXE d'une directive de tête préfixée (`time.tempo:120`
  // porte `lib:'time'`) : le préfixe nomme la librairie, donc il l'invoque.
  const file = ((ast && ast.directives) || []).flatMap((d) => (d ? [d.name, d.lib] : [])).filter(Boolean);
  while (file.length) {
    const mot = file.shift();
    if (vus.has(mot)) continue;
    vus.add(mot);
    for (const a of apportePar.get(mot) || []) file.push(a);
  }
  return vus;
}

/**
 * Un objet par son nom, s'il est EN PORTÉE de la scène — sa famille invoquée — sinon `null`.
 * @param {string} nom
 * @param {object} ast
 * @returns {ObjetDeclare | null}
 */
export function objetEnPortee(nom, ast) {
  const o = objet(nom);
  if (!o) return null;
  if (o.ambigu) throw new Error(`'${nom}' est déclaré par plusieurs librairies — ${o.ambigu.join(', ')} — et le compilateur ne peut pas choisir`);
  return motsInvoques(ast).has(o.famille) ? o : null;
}
