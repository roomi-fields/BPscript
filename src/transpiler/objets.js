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
 * Ce que la porte rend :
 *   - une FAMILLE : l'objet racine d'un catalogue, nommé par le mot qu'on invoque (`scale`, `audio`,
 *     `alphabet`), ses membres propres, et ses entrées ;
 *   - un OBJET : son nom, la famille qui le porte, l'objet dont il dérive, ses membres propres, et
 *     la place du catalogue où il est rangé.
 *   - la RÉSOLUTION d'un nom : `objet('alphabet.western')` rend l'objet dont la chaîne finit ainsi ;
 *     `objet('western')` rend le seul objet de ce nom, ou la liste des candidats quand plusieurs
 *     familles en portent un (décision `2026-09-02-resolves-sort-un-objet-s-invoque-par-tout-suffixe-
 *     non-ambigu-de-sa-chaine.md`).
 *
 * ⚠️ LA SOURCE EST ENCORE LE PAQUET, et la porte l'ABRITE : ses consommateurs ne voient ni les clés de
 * fichier, ni `resolves`, ni `name`, `section`, `type`, `version` — les champs que la décision
 * `section-name-version-type-sortent-library-tombe` retire. Le jour où le compilateur lit les `.bpsl`
 * directement, la source change derrière cette porte et rien ne bouge devant.
 *
 * ⚠️ LA CHAÎNE D'UN OBJET EST AUJOURD'HUI `<famille>.<nom>`. Les sortes d'une famille (`interval`,
 * `degree`… pour `scale`) vivent encore dans `types` ; elles rejoindront leur famille quand les
 * prototypes quitteront `types`, et la chaîne `scale.degree.bilaval` se lira alors ici sans qu'un
 * consommateur change.
 */
// ⛔ LE BRANCHEMENT DU COMPILATEUR, IMPORTÉ LÀ OÙ IL EST FAIT — `bpxAst.js`, jamais `index.js`.
// Mesuré par Atlas le 2026-09-02 : importer `index.js` (qui ne fait que réexporter) pour son effet de
// bord faisait émettre au regroupeur un MORCEAU VIDE, partagé entre `dist/index.js` et `dist/objets.js`
// — zéro octet, absent du paquet publié, et le premier import du paquet échouait.
import './bpxAst.js';
import { leRegistre, placesDesLibrairies } from './libs.js';
import { entreesDe, CHAMPS_DU_PAQUET } from './libs-champs.js';

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

/**
 * L'index de tous les objets de toutes les librairies — reconstruit une fois, jamais recopié.
 * Chaque objet porte : nom, famille, derive, membres, place, chaine, documented.
 */
function index() {
  if (_index) return _index;
  const familles = new Map();   // mot → { nom, membres, entrees: Objet[], contributeurs: [clé de paquet] }
  const objets = new Map();     // nom → Objet[] (plusieurs familles peuvent porter un même nom)
  const poser = (o) => {
    if (!objets.has(o.nom)) objets.set(o.nom, []);
    objets.get(o.nom).push(o);
  };
  // La source est le REGISTRE du compilateur — lu dans les sources de `lib/`, jamais dans le paquet.
  const LIBS = leRegistre();
  const PLACES = placesDesLibrairies(LIBS);
  for (const [cle, lib] of Object.entries(LIBS)) {
    if (!lib || typeof lib !== 'object' || Array.isArray(lib)) continue;
    const mot = motDe(cle, lib);
    const places = new Set((PLACES[cle] || []).filter((p) => p !== '_deduites'));
    if (!familles.has(mot)) familles.set(mot, { nom: mot, membres: {}, entrees: [], contributeurs: [] });
    const fam = familles.get(mot);
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
  _index = { familles, objets };
  return _index;
}

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
  return { nom: f.nom, membres: { ...f.membres }, entrees: f.entrees.map((o) => ({ ...o, membres: { ...o.membres }, chaine: [...o.chaine] })) };
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
  if (candidats.length === 1) return { ...candidats[0], membres: { ...candidats[0].membres }, chaine: [...candidats[0].chaine] };
  if (candidats.length === 0) return null;
  return { ambigu: candidats.map((o) => o.chaine.join('.')) };
}

/** Tous les objets, à plat — pour qui inventorie. */
export function objets() {
  const out = [];
  for (const liste of index().objets.values()) for (const o of liste) out.push({ ...o, membres: { ...o.membres }, chaine: [...o.chaine] });
  return out;
}
