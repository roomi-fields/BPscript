/**
 * LA LECTURE DES LIBRAIRIES — une source écrite dans le langage devient un objet du registre.
 *
 * Le compilateur lit ses librairies dans leurs SOURCES, par le même interprète que les scènes
 * (Romain : « je veux que ton interpréteur interprète le contenu des librairies de la même façon
 * qu'il interprète le contenu des scènes »), et il le fait par POINT FIXE depuis un registre vide :
 * une source qui invoque en tête ce dont elle dérive ne se lit qu'une fois cette librairie construite,
 * donc une source qui ne compile pas est reprise après les autres, et une passe sans progrès nomme
 * chaque refus — c'est alors une vraie faute de source. Mesuré le 2026-09-02 : 22 sources, trois
 * passes, une seconde.
 *
 * Ce module portait jusque-là le nom de « générateur du paquet » : il construisait la même chose pour
 * l'écrire dans `libs-data.js`, que le compilateur relisait ensuite. Le compilateur lit désormais ici
 * directement ; le paquet n'est plus qu'un dérivé imprimé pour les consommateurs qui le lisent encore,
 * et il sort avec eux (décision du 2026-08-30, phase 5).
 *
 * LA CONVERSION, ET ELLE NE DEVINE RIEN :
 *   · le `def` qui porte le NOM DU FICHIER déclare le fichier — resolvedBy, description… ;
 *   · tous les autres sont des entrées, rangées dans la place que leur `section` ou celle du fichier
 *     leur donne — la place dit où l'entrée VIT, jamais ce qu'elle EST (Romain, 2026-09-02) ;
 *   · une PHRASE porte ses GUILLEMETS (Romain, 2026-08-21) ; un nombre écrit devient un nombre ;
 *   · une parenthèse de noms nus est une SUITE ; un deux-points est une valeur — la nature d'une
 *     valeur se lit dans son écriture (`estUneSuite`), jamais dans une liste de noms.
 */
import { CHAMPS_DE_FICHIER } from './libs-champs.js';

// ⛔ LES PLACES — les clés qui CONTIENNENT des entrées, par opposition aux entrées elles-mêmes.
//
// Un catalogue mêle les deux à la même profondeur : `voices` porte `objects` (une place) à côté de
// `resolves` (un champ de fichier), et `alphabets` porte ses entrées à sa racine. Un consommateur qui
// énumère le sommet d'un sac doit écarter les champs de fichier ET descendre dans les places.
//
// ⚠️ LA FORME NE SUFFIT PAS À LES SÉPARER, et c'est une mesure qui le dit : la règle « tous les
// membres sont des objets » rate une place VIDE (`core.symbols`, zéro entrée) et aurait classé
// `fatbass for:sub37` comme une place. Pour une source écrite dans le langage, la place est CONNUE :
// c'est cette lecture qui la crée. Pour un catalogue encore en JSON, elle est DÉDUITE par la forme,
// et `placesDesLibrairies()` le dit (`_deduites`).
const places = {};
const noterPlace = (lib, cle) => { (places[lib] = places[lib] || new Set()).add(cle); };
const ecritesDansLeLangage = new Set();

/**
 * UNE PARENTHÈSE DONT AUCUN MEMBRE NE PORTE DE VALEUR EST UNE SUITE — LA FORME LE DIT.
 *
 * ⛔ CE QUE CE PRÉDICAT REMPLACE : cinq noms écrits en dur — `args`, `values`, `scope`, `range`,
 * `registers` — qui décidaient seuls qu'une clé portait une collection. Une valeur écrite en dur est
 * invisible : personne ne peut la lire ni la surcharger, et cette liste-là ne pouvait pas connaître
 * `degrees`, `ratios`, `compose` ni `junction` — 62 clés de la donnée publiée étaient dans ce cas.
 *
 * ⚠️ ET UN PROTOTYPE NE PEUT PAS LE DÉCLARER NON PLUS : il dit qu'un champ EXISTE, jamais qu'il porte
 * une liste. **C'est l'écriture de l'EXEMPLAIRE qui dit la nature** : une parenthèse de membres nus
 * est une suite, un deux-points est une valeur.
 */
const estUneSuite = (sac) => Boolean(sac && sac.type === 'SettingBag'
  && (sac.pairs || []).length && (sac.pairs).every((m) => m.value === true));

/** Une faute de SOURCE — la librairie ne se construit pas, et elle le dit en nommant la ligne. */
class FauteDeLibrairie extends Error {}

/**
 * RANGE UNE ENTRÉE ÉCRITE DANS UNE PLACE — et descend tant que la place a des étages.
 *
 * `schema(reservedDirectives(a, b))` a deux étages ; `engine(mode(…))` en a un. La descente
 * s'arrête quand ce qu'elle trouve n'est plus une place mais une ENTRÉE : un objet dont les
 * membres portent des valeurs, ou une suite de noms nus.
 */
function rangerConteneur(ou, nom, val, fichier, place) {
  if (!val || val.type !== 'SettingBag') { ou[nom] = valeurDeCle({ kind: 'value', value: val }); return; }
  const pairs = val.pairs || [];
  // ⛔ UNE SUITE DE NOMS NUS EST UNE LISTE, PAS UNE PLACE — elle passe par `suite` pour garder son
  // ORDRE et la NATURE de chaque membre.
  if (pairs.length && pairs.every((p) => p.value === true)) {
    ou[nom] = suite(val, fichier, place, nom);
    return;
  }
  // Une PLACE ne porte que des sacs ; une ENTRÉE porte au moins une valeur.
  if (pairs.length && pairs.every((p) => p.value && p.value.type === 'SettingBag')) {
    const sous = (ou[nom] = ou[nom] || {});
    for (const p of pairs) rangerConteneur(sous, p.key, p.value, fichier, `${place}.${nom}`);
    return;
  }
  const entree = (ou[nom] = {});
  for (const p of pairs) {
    if (p.value && p.value.type === 'SettingBag') {
      // ⚠️ UNE CLÉ-LISTE PASSE PAR `suite`, jamais par l'aplatissement : lui rendrait `args(seed)`
      // en `{seed:true}` au lieu de `['seed']`, ET perdrait l'ordre — un objet JavaScript réordonne
      // ses clés entières. Mesuré : 228 valeurs publiées changeaient sans cette distinction.
      entree[p.key] = estUneSuite(p.value) ? suite(p.value, fichier, nom, p.key) : sacEnObjet(p.value, fichier, nom);
      continue;
    }
    entree[p.key] = valeurDeCle({ kind: 'value', value: p.value, ...(p.texte ? { texte: true } : {}) });
  }
}

function valeurDeCle(v) {
  // Une SUITE arrive typée membre par membre — elle sort telle quelle.
  if (v && v.kind === 'suite') return v.value;
  // ⛔ ET UN TEXTE DÉLIMITÉ SORT TEL QUEL, PARCE QU'IL EST MARQUÉ. `"4"` et `4` s'écrivent pareil
  // une fois la clé posée : retyper le premier confond le NOM d'un registre avec son RANG.
  if (v && v.texte) return v.value;
  const brut = v && v.kind === 'value' ? v.value : (v && v.value);
  const un = (x) => {
    if (typeof x !== 'string') return x;
    // ⚠️ LE BOOLÉEN EST TYPÉ, et son absence était bloquante : `bpscript:false` rendait la CHAÎNE
    // 'false', qui est vraie.
    if (x === 'true') return true;
    if (x === 'false') return false;
    return /^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x;
  };
  return Array.isArray(brut) ? brut.map(un) : un(brut);
}

// ⛔ UNE PARENTHÈSE PRÉSERVE L'ORDRE DE CE QU'ON Y ÉCRIT — arbitrage Romain, 2026-08-19. Une seule
// forme sert la SUITE et l'ENSEMBLE : un ensemble est une suite dont personne ne lit le rang.
// ⛔ LA SUITE SE PREND SUR `pairs`, JAMAIS SUR UN OBJET INTERMÉDIAIRE : un objet JavaScript réordonne
// ses clés entières avant toutes les autres.
// ⛔ ET UN MEMBRE PORTEUR EST REFUSÉ, JAMAIS AVALÉ : dans une clé-liste, seul le rang compte.
// ⛔ ET LA NATURE D'UN MEMBRE SE LIT SUR SA MARQUE : un registre nommé « 0 » reste un texte.
function suite(sac, fichier, declaration, cle) {
  const porteurs = (sac.pairs || []).filter((p) => p.value !== true);
  if (porteurs.length) {
    throw new FauteDeLibrairie(`lib/${fichier} · ${declaration} : '${cle}' est une clé-liste — ses `
      + `membres sont des noms nus, et ${porteurs.map((p) => `'${p.key}'`).join(', ')} porte(nt) une `
      + `valeur. Une clé-liste ne lit que le RANG ; cette valeur serait perdue sans un mot.`);
  }
  return (sac.pairs || []).map((p) => (p.texte ? p.key
    : (/^-?\d+(\.\d+)?$/.test(p.key) ? Number(p.key) : p.key)));
}

/**
 * Un sac imbriqué devient un objet — une parenthèse, un niveau.
 * ⛔ UN LITTÉRAL SE LIT PAREIL À TOUTES LES PROFONDEURS, et une suite de noms nus est une liste à
 * cette profondeur comme aux autres : un seul lecteur, jamais deux qui divergent avec la profondeur.
 */
function sacEnObjet(sac, fichier = '?', declaration = '?') {
  const out = {};
  for (const p of sac.pairs || []) {
    if (p.value && p.value.type === 'SettingBag'
        && (p.value.pairs || []).length && (p.value.pairs || []).every((q) => q.value === true)) {
      out[p.key] = suite(p.value, fichier, declaration, p.key);
      continue;
    }
    out[p.key] = (p.value && p.value.type === 'SettingBag')
      ? sacEnObjet(p.value, fichier, declaration)
      : valeurDeCle({ kind: 'value', value: p.value, ...(p.texte ? { texte: true } : {}) });
  }
  return out;
}

/**
 * CONSTRUIT UNE LIBRAIRIE depuis l'arbre de sa source — l'objet que le registre portera.
 * @param {string} nom       le nom logique (`audio`, `settings/notreich`)
 * @param {string} fichier   le nom du fichier, pour les refus
 * @param {object} ast       l'arbre rendu par le compilateur
 */
function construireLaLibrairie(nom, fichier, ast, documente) {
  const lib = { controls: {} };
  let sectionDuFichier = null;
  // ⛔ UNE LIBRAIRIE EN INVOQUE UNE AUTRE PAR UNE LIGNE NUE, ET C'EST `apporte` — décision Romain,
  // 2026-08-20. Ce n'est pas un champ de fichier : c'est l'invocation elle-même, à la tête du
  // fichier, exactement comme une scène invoque. L'ordre d'écriture est l'ordre de la liste.
  const invoquees = (ast.directives || [])
    .filter((d) => d.name && !d.subkey)
    .map((d) => d.name);
  if (invoquees.length) lib.apporte = invoquees;
  // ⛔ « DOCUMENTÉ » SE DIT EN COMMENTAIRE, JAMAIS DANS LA DONNÉE — décision de Romain, 2026-09-02 :
  // un catalogue entre dans l'aide publiée s'il porte la ligne `// @documented`, la même graphie que
  // les métadonnées de scène de kanopi. Ce n'est pas un membre de l'objet : c'est une information
  // pour Atlas, et Atlas la lit dans la source. Le registre la PORTE encore, en booléen, pour qui lit
  // le paquet dérivé — jusqu'à ce que le paquet sorte.
  lib.documented = Boolean(documente);
  // Une déclaration s'écrit sous deux formes — le corps INDENTÉ rend `keys`, le corps entre
  // PARENTHÈSES rend `settings` — et les deux se ramènent à la MÊME structure `{clé: valeur}`.
  const clesDeLaDeclaration = (d) => {
    if (d.keys) return d.keys;
    if (!d.settings || !Array.isArray(d.settings.pairs)) return null;
    const out = {};
    for (const p of d.settings.pairs) {
      // ⛔ CE QUI EST HÉRITÉ NE SE REPUBLIE PAS — Romain, 2026-08-29 : « dans les librairies, porter
      // sinon ça n'a aucun sens ». L'étage qui résout grave la dérivation dans l'arbre ; le registre
      // PORTE la structure et ne la recopie pas.
      if (p.herite) continue;
      out[p.key] = (p.value && p.value.type === 'SettingBag')
        ? (estUneSuite(p.value)
            ? { kind: 'suite', value: suite(p.value, fichier, d.name, p.key) }
            : { kind: 'value', value: sacEnObjet(p.value, fichier, d.name), sac: p.value })
        : { kind: 'value', value: p.value, ...(p.texte ? { texte: true } : {}) };
    }
    return out;
  };
  // ⛔ LES EXEMPLAIRES SONT DES DÉCLARATIONS PAR LE TYPE, PAS DES `def` : `scale ionian (…)` rend une
  // VarDirective, qui porte son nom dans `names` et son type dans `varType.type`. La parenthèse
  // absente vaut parenthèse vide. Une CONVENTION est un exemplaire comme un autre — `signal pitch`
  // déclare `pitch`, qui dérive de `signal` (Romain, 2026-09-02).
  const sacVide = { type: 'SettingBag', pairs: [] };
  const declarations = [
    ...(ast.defs || []),
    ...(ast.vars || []).filter((v) => v.varType?.kind === 'type' || v.varType?.kind === 'convention')
      .map((v) => ({ type: 'DefDirective', name: v.names[0], settings: v.settings || sacVide,
                     derivedeDe: v.varType.kind === 'type' ? v.varType.type : v.varType.convention, line: v.line })),
  ];
  const nomDuFichier = fichier.replace(/^.*\//, '').replace(/\.bpsl$/, '');
  for (const d of declarations) {
    if (d.type !== 'DefDirective') continue;
    d.keys = clesDeLaDeclaration(d);
    if (!d.keys) continue;
    // Une clé `section` dit où le mot se range : le chemin vient de l'entrée, sinon du FICHIER,
    // sinon la RACINE. Le chemin est pointé — `schema.reservedDirectives` se lit comme une descente.
    const chemin = d.keys && d.keys.section ? valeurDeCle(d.keys.section) : sectionDuFichier;
    let cible;
    let aEcrireEnQueue = null;
    if (d.name === nomDuFichier) {
      cible = lib;
    } else {
      let ou = lib;
      if (chemin) {
        const segs = String(chemin).split('.');
        for (const seg of segs) { ou[seg] = ou[seg] || {}; ou = ou[seg]; }
        noterPlace(nom, segs[0]);
      }
      cible = (ou[d.name] = {});
      // ⛔ LA TRACE DE DÉRIVATION SE PUBLIE — câblage 4 de la phase 3, 2026-08-31 : le type d'une
      // entrée est le prototype dont elle dérive, écrit en tête. Elle s'écrit EN DERNIER, pour ne
      // déplacer aucune clé existante. Un prototype racine n'en porte pas.
      aEcrireEnQueue = d.derivedeDe && d.derivedeDe !== 'object' ? d.derivedeDe : null;
    }
    for (const [cle, v] of Object.entries(d.keys)) {
      // `section` ROUTE, elle ne se publie JAMAIS — ni sur une entrée, ni sur le fichier.
      if (cle === 'section') { if (cible === lib) sectionDuFichier = valeurDeCle(v); continue; }
      if (cle === 'documented' && cible === lib) {
        throw new FauteDeLibrairie(`lib/${fichier} : 'documented' ne s'écrit plus dans le sac de la `
          + `racine — un catalogue documenté porte la ligne '// @documented' en tête (Romain, 2026-09-02).`);
      }
      const val = valeurDeCle(v);
      // ⛔ SUR LA DÉCLARATION DU FICHIER, UNE CLÉ HORS DES CHAMPS DE FICHIER QUI PORTE UN OBJET EST
      // UNE PLACE — la récursivité par la parenthèse, lue depuis le 2026-08-19.
      if (cible === lib && !CHAMPS_DE_FICHIER.has(cle)) {
        const sac = v && v.sac;
        if (sac && sac.type === 'SettingBag') {
          const ou = (lib[cle] = lib[cle] || {});
          noterPlace(nom, cle);
          for (const p2 of (sac.pairs || [])) rangerConteneur(ou, p2.key, p2.value, fichier, cle);
          continue;
        }
        throw new FauteDeLibrairie(`lib/${fichier} : '${cle}' n'est pas un champ de FICHIER `
          + `(${[...CHAMPS_DE_FICHIER].join(', ')}), et sa valeur n'est pas un objet. Une entrée `
          + `se déclare par son propre 'def', ou s'écrit DANS une place — '${cle}(<nom>(…), …)'.`);
      }
      cible[cle] = val;
    }
    if (aEcrireEnQueue) cible._derive = aEcrireEnQueue;
  }
  // ⚠️ UNE LISTE VIDE N'A PAS DE GRAPHIE : l'absence de `args` vaut liste vide, dans toute place de
  // contrôles — jamais dans une table réservée, qui n'a jamais porté de signature.
  const sections = [lib.controls, lib.engine, lib.subgrammar].filter(Boolean);
  for (const sec of sections) {
    for (const c of Object.values(sec)) {
      if (c && typeof c === 'object' && c.args === undefined && ('bp3' in c || 'description' in c)) c.args = [];
    }
  }
  if (!Object.keys(lib.controls).length) delete lib.controls;
  return lib;
}

/**
 * LIT TOUTES LES SOURCES ET LES MET AU REGISTRE, par point fixe.
 *
 * Les catalogues encore en JSON entrent d'abord, tels quels. Les sources écrites dans le langage se
 * compilent ensuite ; une source qui ne compile pas — parce qu'elle invoque en tête une librairie
 * pas encore construite — est reprise à la passe suivante. Une passe sans progrès nomme chaque refus.
 * Les corps `.ts` des fonctions digitales se rattachent à leur objet une fois la librairie construite.
 *
 * @param {Array} sources        ce que `sourcesDeLibrairie()` rend
 * @param {Function} compiler    `compileToBPxAST`
 * @param {Function} registerLib la porte d'entrée du registre
 */
export function chargerLesLibrairies(sources, compiler, registerLib) {
  for (const s of sources) {
    if (s.format !== 'json') continue;
    registerLib(s.nom, JSON.parse(s.texte));
  }
  let restants = sources.filter((s) => s.format === 'bpsl');
  const construites = {};
  for (;;) {
    const encore = [];
    const refus = [];
    for (const s of restants) {
      ecritesDansLeLangage.add(s.nom);
      const r = compiler(s.texte);
      if ((r.errors || []).length) {
        encore.push(s);
        refus.push(`lib/${s.fichier} NE COMPILE PAS : ${r.errors[0].message}`);
        continue;
      }
      // La ligne `// @documented` se lit dans le TEXTE de la source : c'est un commentaire, il ne
      // traverse pas le compilateur, et c'est voulu — il ne fait pas partie de l'objet.
      const documente = /^\s*\/\/\s*@documented\b/m.test(s.texte);
      const lib = construireLaLibrairie(s.nom, s.fichier, r.ast, documente);
      construites[s.nom] = lib;
      registerLib(s.nom, lib);
    }
    if (!encore.length) break;
    if (encore.length === restants.length) {
      throw new FauteDeLibrairie(`${refus.length} source(s) de librairie ne compilent pas :\n  ` + refus.join('\n  '));
    }
    restants = encore;
  }
  // Les corps de FONCTIONS DIGITALES : lib/<nom>/<fonction>.ts → <nom>.objects.<fonction>.body.
  // L'authoring est un VRAI .ts typé ; le registre en porte le SOURCE, que Kairos transpile.
  for (const s of sources) {
    if (s.format !== 'ts') continue;
    const lib = construites[s.nom];
    if (!lib || !lib.objects || !lib.objects[s.fonction]) {
      throw new FauteDeLibrairie(`lib/${s.fichier} : aucun objet '${s.fonction}' dans la librairie '${s.nom}'`);
    }
    lib.objects[s.fonction].body = s.texte;
  }
}

/**
 * LES PLACES DE CHAQUE LIBRAIRIE — publiées, parce qu'un consommateur ne peut pas les déduire.
 * Pour une source écrite dans le langage, elles sont CONNUES ; pour un catalogue encore en JSON,
 * elles sont déduites par la forme, et `_deduites` dit lesquels.
 * @param {object} registre  le registre, tel que `leRegistre()` le rend
 */
export function placesDesLibrairies(registre) {
  const tousObjets = (v) => {
    const m = Object.keys(v).filter((k) => !k.startsWith('_'));
    return m.length > 0 && m.every((k) => v[k] && typeof v[k] === 'object' && !Array.isArray(v[k]));
  };
  const PLACES = {};
  const deduites = [];
  for (const [nom, data] of Object.entries(registre).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (ecritesDansLeLangage.has(nom)) {
      PLACES[nom] = [...(places[nom] || [])].sort();
      continue;
    }
    const parLaForme = Object.keys(data || {}).filter((k) => !k.startsWith('_')
      && !CHAMPS_DE_FICHIER.has(k) && data[k] && typeof data[k] === 'object'
      && !Array.isArray(data[k]) && tousObjets(data[k]));
    PLACES[nom] = parLaForme.sort();
    deduites.push(nom);
  }
  PLACES._deduites = deduites.sort();
  return PLACES;
}
