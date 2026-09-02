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
 * jamais recopié. Chaque objet porte : nom, famille, derive, membres, place, chaine, documented.
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
    if (!familles.has(mot)) familles.set(mot, { nom: mot, membres: {}, entrees: [], contributeurs: [] });
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
        documented: Boolean(lib.documented),
      };
      fam.entrees.push(o);
      poser(o);
      continue;
    }
    const mot = motDe(cle, lib);
    const places = new Set((PLACES[cle] || []).filter((p) => p !== '_deduites'));
    const fam = familleDe(mot);
    fam.contributeurs.push(cle);
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
        membres: membresDe(brut), place, chaine: [mot, nom], documented: Boolean(lib.documented),
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
  _index = { familles, objets };
  _versionIndexee = version;
  return _index;
}

/** Une copie d'un objet — la porte ne rend jamais ses structures internes. */
const copie = (o) => ({ ...o, membres: { ...o.membres }, chaine: [...o.chaine] });

/** Les familles — les mots qu'on invoque — dans l'ordre du paquet. */
export function familles() {
  return [...index().familles.keys()];
}

/**
 * Une famille : sa racine (membres propres) et ses entrées, dans l'ordre de la donnée.
 * Rend `null` quand aucune librairie ne déclare ce mot.
 */
export function famille(mot) {
  const f = index().familles.get(mot);
  if (!f) return null;
  return { nom: f.nom, membres: { ...f.membres }, entrees: f.entrees.map(copie) };
}

/**
 * Résout un nom écrit comme une chaîne — `alphabet.western`, ou un suffixe non ambigu — vers l'objet
 * qu'il désigne. Rend l'objet ; `null` si rien ne porte ce nom ; `{ ambigu: [chaines] }` quand
 * plusieurs objets finissent par ce suffixe : l'ambiguïté se constate à l'usage, jamais par une liste.
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

/** Tous les objets, à plat — pour qui inventorie. */
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
/** Le schéma structurel — les membres de l'objet `schema` en portée du registre, ou `null` sans lui. */
export function leSchema() { return objetUnique('schema'); }
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
  const file = ((ast && ast.directives) || []).map((d) => d && d.name).filter(Boolean);
  while (file.length) {
    const mot = file.shift();
    if (vus.has(mot)) continue;
    vus.add(mot);
    for (const a of apportePar.get(mot) || []) file.push(a);
  }
  return vus;
}

/** Un objet par son nom, s'il est EN PORTÉE de la scène — sa famille invoquée — sinon `null`. */
export function objetEnPortee(nom, ast) {
  const o = objet(nom);
  if (!o) return null;
  if (o.ambigu) throw new Error(`'${nom}' est déclaré par plusieurs librairies — ${o.ambigu.join(', ')} — et le compilateur ne peut pas choisir`);
  return motsInvoques(ast).has(o.famille) ? o : null;
}
