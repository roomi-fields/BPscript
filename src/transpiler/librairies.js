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

// ⛔ LA PROSE D'UN OBJET SE DIT EN COMMENTAIRE, JAMAIS DANS SON SAC — décision de Romain,
// 2026-09-04 : « la prose sort de la donnée vers une marque // @description en source », et
// « convention : on met en préfixe de chaque objet le // @description correspondant ». La marque est
// de même nature que `// @documented` : elle ne traverse pas le compilateur, elle se lit dans le
// TEXTE de la source, et elle n'est pas un membre de l'objet.
//
// ⚠️ ELLE RESSORT DANS LA DONNÉE PUBLIÉE, sous la clé `description` : sa forme m'appartient, son
//   existence non — mes consommateurs la lisent dans mon paquet, et la voie « lire ma source » est
//   fermée. C'est pourquoi la marque s'INJECTE dans l'arbre plutôt que de se poser à côté : tout ce
//   qui suit — le rangement, le discriminant d'un contrôle, l'égalité du paquet — la voit inchangée.
//
// ⇒ LA MARQUE S'ATTACHE À CE QUI SUIT, À TOUTE PROFONDEUR. Une déclaration au sommet et un membre au
//   fond d'un `params(…)` se lisent du même mécanisme : une règle qui vaudrait à l'entrée et pas au
//   fond d'un sac serait un cas, pas une règle.
// ⇒ AU-DELÀ DE 140 CARACTÈRES, LA PROSE SE REPLIE — demande de Romain, 2026-09-04. Les lignes
//   suivantes portent `//` nu, à la même indentation, et se recollent par un espace. La graphie a été
//   choisie sur mesure : aucun commentaire ordinaire ne s'intercale entre une marque et son objet
//   dans les 22 sources, donc un `//` nu qui suit une marque ne peut être que sa suite.
const MARQUE_DESCRIPTION = /^[ \t]*\/\/[ \t]*@description[ \t]+(.*\S)[ \t]*$/;
const SUITE_DE_MARQUE = /^[ \t]*\/\/[ \t]*(?!@)(.*\S)[ \t]*$/;

/**
 * LES PLACES QUI PEUVENT PORTER UNE PROSE — ligne d'ouverture → le sac qui la recevra.
 * Une déclaration donne sa ligne et son sac ; un membre dont la valeur est un sac donne les siens.
 * Un nom nu vaut un objet vide : le sac se crée, pour que la marque ait où se poser.
 */
function placesQuiPortentUneProse(ast) {
  const table = new Map();
  const vus = new Set();
  const visiterSac = (sac) => {
    if (!sac || sac.type !== 'SettingBag' || vus.has(sac)) return;
    vus.add(sac);
    for (const p of sac.pairs || []) {
      if (p.value && p.value.type === 'SettingBag') {
        // ⛔ PLUSIEURS SACS OUVRENT SUR UNE MÊME LIGNE, ET C'EST LE PLUS ENGLOBANT QUI PORTE :
        //   `control stop(bp3:_stop, scope(rule), …)` ouvre le sac du contrôle ET celui de `scope`,
        //   tous deux à la même ligne. La visite descend du plus large au plus profond, donc le
        //   premier inscrit est le bon ; écraser donnait la prose du contrôle à son `scope`, sans
        //   qu'aucun refus ne s'en aperçoive — le registre sortait muet.
        if (p.line != null && !table.has(p.line)) table.set(p.line, p.value);
        visiterSac(p.value);
      }
    }
  };
  for (const d of [...(ast.defs || []), ...(ast.vars || [])]) {
    if (d.line != null) {
      if (!d.settings) d.settings = { type: 'SettingBag', pairs: [] };
      table.set(d.line, d.settings);
    }
    visiterSac(d.settings);
  }
  return table;
}

/** Parcourt tous les sacs de l'arbre et rend chaque paire, à toute profondeur. */
function* toutesLesPaires(ast) {
  const vus = new Set();
  const descendre = function* (sac) {
    if (!sac || sac.type !== 'SettingBag' || vus.has(sac)) return;
    vus.add(sac);
    for (const p of sac.pairs || []) {
      yield p;
      if (p.value && p.value.type === 'SettingBag') yield* descendre(p.value);
    }
  };
  for (const d of [...(ast.defs || []), ...(ast.vars || [])]) yield* descendre(d.settings);
}

/**
 * POSE LA PROSE DES MARQUES SUR L'ARBRE, et refuse celle qui s'écrirait dans un sac.
 * @param {string} texte   la source telle qu'elle a été compilée — les lignes doivent concorder
 * @param {object} ast     l'arbre rendu par le compilateur, modifié sur place
 * @param {string} fichier le nom du fichier, pour les refus
 * @returns {number} le nombre de marques posées — un appelant qui compte refuse d'avoir posé zéro
 */
export function poserLesDescriptions(texte, ast, fichier) {
  // Le refus vient d'ABORD : une source qui porte encore la prose dans son sac se répare, elle ne se
  // complète pas. Il vaut à toute profondeur, là où l'ancienne forme vivait.
  for (const p of toutesLesPaires(ast)) {
    if (p.key === 'description') {
      throw new FauteDeLibrairie(`lib/${fichier}:${p.line} : 'description' ne s'écrit plus dans un sac `
        + `— la prose d'un objet se porte en préfixe, sur une ligne '// @description …' `
        + `(Romain, 2026-09-04).`);
    }
  }
  const lignes = String(texte).split('\n');
  const places = placesQuiPortentUneProse(ast);
  let posees = 0;
  for (let i = 0; i < lignes.length; i += 1) {
    const m = MARQUE_DESCRIPTION.exec(lignes[i]);
    if (!m) continue;
    // Les lignes de `//` nu qui suivent prolongent la prose ; elles se recollent par un espace.
    const morceaux = [m[1]];
    let j = i + 1;
    for (; j < lignes.length; j += 1) {
      const s = SUITE_DE_MARQUE.exec(lignes[j]);
      if (!s) break;
      morceaux.push(s[1]);
    }
    i = j - 1;                                   // la marque et ses suites sont consommées
    // La marque décrit ce qui SUIT : on saute le blanc, et la première ligne qui porte quelque chose
    // est celle qui doit ouvrir un objet.
    while (j < lignes.length && !lignes[j].trim()) j += 1;
    const sac = places.get(j + 1);
    if (!sac) {
      throw new FauteDeLibrairie(`lib/${fichier}:${i + 1} : '// @description' ne précède aucun objet `
        + `— la marque se pose en préfixe d'une déclaration ou d'un membre qui ouvre une parenthèse.`);
    }
    // ⇒ EN TÊTE DU SAC, parce que la marque est un PRÉFIXE : la prose se lit avant l'objet en source,
    //   et elle se lit avant ses membres dans la donnée. L'ordre devient uniforme — il suivait
    //   jusqu'ici la place que chaque source avait donnée à sa clé.
    sac.pairs.unshift({ key: 'description', value: morceaux.join(' '), texte: true, line: i + 1, col: 1 });
    posees += 1;
  }
  return posees;
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
  // ⛔ ET UNE LIGNE DE TÊTE À VALEUR N'INVOQUE RIEN : ELLE SURCHARGE — arbitrage de Romain,
  // 2026-09-03 (forme 4). `volume:90` en tête de `midi_default.bpsl` donne au contrôle `volume`, en
  // portée de qui invoque cette librairie, la valeur 90 — comme une scène l'écrit en tête. Le
  // registre la porte sous `reglages`, dans l'ordre d'écriture ; le chargeur l'applique par niveaux.
  const aUneValeur = (d) => d.value != null || d.runtime != null;
  const invoquees = (ast.directives || [])
    .filter((d) => d.type !== 'FileDirective' && d.name && !d.subkey && !aUneValeur(d))
    .map((d) => d.name);
  if (invoquees.length) lib.apporte = invoquees;
  // ⛔ LES FICHIERS DE CORPS QUE CETTE LIBRAIRIE DÉCLARE — `transpo/foobar`, une ligne par fichier.
  // C'est la LISTE, l'équivalent du Makefile : quelqu'un doit la donner, et c'est la librairie, pas
  // une convention de dossier ni un nom deviné.
  // ⚠️ ET ELLE NE SE PUBLIE PAS : c'est une information de CONSTRUCTION, pas de la donnée. Posée sur
  //   la librairie, elle entrait dans le paquet — et un champ neuf est une ENTRÉE FANTÔME pour qui
  //   énumère. Le témoin d'égalité du paquet l'a vue apparaître, et il a eu raison de crier.
  const fichiersDeCorps = (ast.directives || [])
    .filter((d) => d.type === 'FileDirective')
    .map((d) => `${d.name}/${d.fichier}`);
  if (fichiersDeCorps.length) Object.defineProperty(lib, '_fichiersDeCorps', {
    value: fichiersDeCorps, enumerable: false, configurable: true,
  });
  const reglages = (ast.directives || []).filter((d) => d.name && !d.subkey && aUneValeur(d));
  // Un mot après le deux-points est porté brut par le lecteur de tête ; `true` et `false` sont des
  // booléens, comme dans un sac (`letring:true`).
  const valeurDeTete = (d) => { const v = d.value != null ? d.value : d.runtime; return v === 'true' ? true : v === 'false' ? false : v; };
  if (reglages.length) lib.reglages = Object.fromEntries(reglages.map((d) => [d.name, valeurDeTete(d)]));
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
      // ⛔ UN MEMBRE DÉCLARÉ PAR SON TYPE — `sound terminals()`, `alphabet alphabet` — arbitrage de
      // Romain, 2026-09-03 : le type en tête, le nom ensuite, comme toute déclaration. Il se publie
      // comme un EXEMPLAIRE VIDE qui dérive de son type (`{_derive: "sound"}`) : un nom nu vaut un
      // objet vide, et le type voyage. Une collection typée qui porte des éléments les publie avec.
      if (p.type) {
        const contenu = (p.value && p.value.type === 'SettingBag') ? sacEnObjet(p.value, fichier, d.name) : {};
        out[p.key] = { kind: 'value', value: { ...contenu, _derive: p.type } };
        continue;
      }
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
  // ⛔ LES RACINES D'ABORD, LES CORPS ENSUITE. Un fichier de corps reprend l'en-tête de sa
  // déclaration — `control transpose(…)` — et `control` n'est en portée que par ce que la librairie
  // INVOQUE. Compilé isolément, il ne connaît pas ce mot : mesuré, quatre des cinq corps refusaient
  // « Expected IDENT ». C'est l'équivalent du `.c` qui inclut son `.h` ; ici la racine le lui donne.
  let restants = sources.filter((s) => s.format === 'bpsl' && !s.nom.includes('/'));
  const corpsAcompiler = sources.filter((s) => s.format === 'bpsl' && s.nom.includes('/'));
  const construites = {};
  for (;;) {
    const encore = [];
    const refus = [];
    for (const s of restants) {
      ecritesDansLeLangage.add(s.nom);
      // `librairie: true` : une ligne de tête à valeur y est la valeur d'un objet, pas un usage à
      // juger par sa place (forme 4, Romain 2026-09-03).
      const r = compiler(s.texte, { librairie: true });
      if ((r.errors || []).length) {
        encore.push(s);
        refus.push(`lib/${s.fichier} NE COMPILE PAS : ${r.errors[0].message}`);
        continue;
      }
      // La ligne `// @documented` se lit dans le TEXTE de la source : c'est un commentaire, il ne
      // traverse pas le compilateur, et c'est voulu — il ne fait pas partie de l'objet.
      const documente = /^\s*\/\/\s*@documented\b/m.test(s.texte);
      // La prose se lit au même endroit, et se pose sur l'arbre AVANT qu'il ne devienne de la donnée.
      poserLesDescriptions(s.texte, r.ast, s.fichier);
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
  // ⛔ UN CORPS SE RATTACHE PAR LA REPRISE DE SON EN-TÊTE, JAMAIS PAR LE NOM DU FICHIER — Romain,
  // 2026-09-03 : « même si le corps est dans un autre fichier il devrait reprendre EXACTEMENT le même
  // en-tête ». Ce site lisait `lib/transpo/transpose.ts` et le posait sur l'objet `transpose` de la
  // seule foi du nom : « il me semble qu'on a dit que ça ne devait pas juste marcher parce que les
  // fichiers sont correctement nommés ».
  //
  // ⇒ CE QUE FAIT LE C, ET QUE CE SITE NE FAISAIT PAS : le nom des fichiers n'y joue AUCUN rôle. Le
  //   `.c` inclut le `.h`, l'éditeur de liens apparie par NOM DE SYMBOLE, et la LISTE des fichiers
  //   vient du build. Ici la liste vient de la librairie — elle déclare `transpo/foobar` en tête — et
  //   l'appariement se fait sur la déclaration reprise, que le fichier de corps peut donc appeler
  //   comme il veut.
  //
  // ⇒ TROIS REFUS, qui n'existaient ni l'un ni l'autre :
  //     · un fichier de corps que la racine ne déclare pas          — un corps que personne n'a demandé
  //     · un fichier déclaré qu'aucune source ne fournit            — l'`undefined reference` du lien
  //     · un en-tête repris qui DIVERGE de sa déclaration           — la concordance de signature
  // ⇒ UN FICHIER DE CORPS N'EST PAS UNE LIBRAIRIE : il ne se construit pas, il se LIT. Ses
  //   déclarations reprennent celles de la racine ; seul son corps est neuf. On lit donc son arbre
  //   directement — `construireLaLibrairie` le traiterait comme un catalogue et refuserait ses
  //   membres au sommet (mesuré : « 'bp3' n'est pas un champ de FICHIER »).
  const corpsLus = new Map();      // nom de source → [{ nom, corps, enTete }]
  for (const s of corpsAcompiler) {
    const [nomLib] = s.nom.split('/');
    const racine = construites[nomLib];
    // La racine met en portée ce qu'elle invoque, plus elle-même : c'est l'inclusion de l'en-tête.
    const invoque = [...(racine && racine.apporte ? racine.apporte : []), nomLib].join('\n');
    const r = compiler(`${invoque}\n${s.texte}`, { librairie: true });
    if ((r.errors || []).length) {
      throw new FauteDeLibrairie(`lib/${s.fichier} NE COMPILE PAS : ${r.errors[0].message}`);
    }
    const lus = [];
    for (const v of (r.ast && r.ast.vars) || []) {
      const nom = (v.names || [])[0];
      if (!nom || !v.corps) continue;
      lus.push({ nom, corps: v.corps.code, tag: v.corps.tag });
    }
    corpsLus.set(s.nom, lus);
  }
  const corpsParLibrairie = new Map();
  for (const s of corpsAcompiler) {
    const [lib] = s.nom.split('/');
    if (!corpsParLibrairie.has(lib)) corpsParLibrairie.set(lib, []);
    corpsParLibrairie.get(lib).push(s);
  }
  for (const [lib, fichiers] of corpsParLibrairie) {
    const racine = construites[lib];
    if (!racine) continue;                       // pas une librairie écrite dans le langage
    const declares = new Set(racine._fichiersDeCorps || []);
    for (const s of fichiers) {
      if (!declares.has(s.nom)) {
        throw new FauteDeLibrairie(`lib/${s.fichier} : la librairie '${lib}' ne DÉCLARE pas ce fichier `
          + `de corps — l'écrire en tête de 'lib/${lib}.bpsl' sur une ligne à elle : '${s.nom}'. `
          + `Un corps que rien ne déclare ne se charge pas sur la foi de son nom.`);
      }
      declares.delete(s.nom);
      // ⇒ APPARIER PAR L'EN-TÊTE REPRIS. Le fichier de corps est une source comme une autre : il a
      //   été compilé et construit sous son nom (`transpo/transpose`). Chacun de ses objets doit
      //   retrouver son homonyme dans la racine, y concorder, et lui donner son corps.
      const lus = corpsLus.get(s.nom) || [];
      if (!lus.length) {
        throw new FauteDeLibrairie(`lib/${s.fichier} ne porte AUCUN corps — un fichier déclaré comme `
          + `corps écrit son code après l'en-tête repris, entre backticks tagués.`);
      }
      const texteRacine = (sources.find((x) => x.nom === lib) || {}).texte || '';
      for (const { nom, corps } of lus) {
        // ⚠️ LA LIGNE DE TÊTE EST LE PROTOTYPE DE LA FAMILLE, et elle devient la RACINE elle-même,
        //   jamais une entrée : `def homomorphism(…)` dans `homomorphism.bpsl`. Son corps descend
        //   ensuite sur les dix-huit tables, qui en héritent.
        const cible = nom === lib ? racine
          : racine[nom] && typeof racine[nom] === 'object' && !Array.isArray(racine[nom])
            ? racine[nom]
            : Object.values(racine).find((place) => place && typeof place === 'object'
                && !Array.isArray(place) && place[nom] && typeof place[nom] === 'object')?.[nom];
        if (!cible) {
          throw new FauteDeLibrairie(`lib/${s.fichier} reprend l'en-tête de '${nom}', et la librairie `
            + `'${lib}' ne déclare aucun objet de ce nom — un corps reprend l'en-tête d'une `
            + `déclaration qui existe.`);
        }
        if (!memeEnTete(texteRacine, s.texte, nom)) {
          throw new FauteDeLibrairie(`lib/${s.fichier} : l'en-tête repris de '${nom}' DIVERGE de sa `
            + `déclaration dans 'lib/${lib}.bpsl' — un corps reprend EXACTEMENT le même en-tête.`);
        }
        cible.body = corps;
      }
      // ⛔ POSER UN CORPS FAIT BOUGER LE REGISTRE — et la porte des objets se mémoïse sur sa VERSION.
      //   Sans ce signalement, les corps étaient dans le registre et INVISIBLES à la porte : mesuré,
      //   `transpo.transpose` sortait sans `body` alors que le registre le portait. Un état posé
      //   après la dernière invalidation n'existe pour personne.
      registerLib(lib, racine);
    }
    for (const manque of declares) {
      throw new FauteDeLibrairie(`lib/${lib}.bpsl déclare le fichier de corps '${manque}', et aucune `
        + `source ne le fournit — écrire 'lib/${manque}.bpsl', ou retirer la ligne.`);
    }
  }
}

/**
 * L'EN-TÊTE d'un objet, tel qu'il est ÉCRIT : de sa première ligne à la parenthèse qui la ferme.
 */
export function enTeteEcrit(texte, nom) {
  const L = String(texte || '').split('\n');
  const i = L.findIndex((l) => new RegExp(`^[a-z_]+ ${nom}\\(|^def ${nom}\\(`).test(l));
  if (i < 0) return null;
  // ⚠️ L'EN-TÊTE S'ARRÊTE À SA PARENTHÈSE FERMANTE, PAS À LA FIN DE LIGNE : dans un fichier de corps,
  //   le backtick s'ouvre sur la MÊME ligne — `) ``ts:` — et le prendre faisait diverger tous les
  //   en-têtes repris de leur déclaration.
  let prof = 0;
  for (let j = i; j < L.length; j++) {
    for (let k = 0; k < L[j].length; k++) {
      const c = L[j][k];
      if (c === '(') prof++;
      else if (c === ')') {
        prof--;
        if (prof <= 0) return L.slice(i, j).concat(L[j].slice(0, k + 1)).join('\n');
      }
    }
  }
  return null;
}

/**
 * ⛔ LA CONCORDANCE SE JUGE SUR L'EN-TÊTE ÉCRIT — Romain, 2026-09-03 : « même si le corps est dans un
 * autre fichier il devrait reprendre EXACTEMENT le même en-tête ». C'est la vérification que le
 * compilateur C fait entre un prototype et sa définition. Les blancs ne comptent pas : le pli et
 * l'indentation sont de la mise en forme, et le langage le dit ailleurs.
 */
export function memeEnTete(texteRacine, texteCorps, nom) {
  const a = enTeteEcrit(texteRacine, nom);
  const b = enTeteEcrit(texteCorps, nom);
  if (a == null || b == null) return false;
  // ⚠️ LA COMPARAISON NORMALISE LES BLANCS, ET C'EST SÛR ICI : les deux en-têtes ont déjà passé le
  //   refus de l'espace entre un mot et son sac, et le pli comme l'indentation sont de la mise en
  //   forme — le langage le dit ailleurs. Sans normaliser AUTOUR des parenthèses et des virgules,
  //   une déclaration pliée ne concordait jamais avec la même écrite sur une ligne.
  const nu = (x) => x.replace(/\s+/g, ' ').replace(/\s*([(),])\s*/g, '$1').trim();
  return nu(a) === nu(b);
}

/**
 * ⛔ LA CONCORDANCE — un en-tête repris dit la MÊME chose que sa déclaration, ou il est refusé.
 *
 * C'est la vérification que le compilateur C fait entre un prototype et sa définition. Comparer les
 * membres SANS le corps : ce que le fichier de corps ajoute est justement son corps.
 */
export function concorde(declaration, repris) {
  const nu = (o) => {
    const out = {};
    for (const [k, v] of Object.entries(o || {})) {
      if (k === 'body' || k === 'corps' || k.startsWith('_')) continue;
      out[k] = v;
    }
    return out;
  };
  const a = JSON.stringify(nu(declaration));
  const b = JSON.stringify(nu(repris));
  return a === b;
}

/**
 * LES PLACES DE CHAQUE LIBRAIRIE — publiées, parce qu'un consommateur ne peut pas les déduire.
 * Pour une source écrite dans le langage, elles sont CONNUES ; pour un catalogue encore en JSON,
 * elles sont déduites par la forme, et `_deduites` dit lesquels.
 * @param {object} registre  le registre, tel que `leRegistre()` le rend
 */
export function placesDesLibrairies(registre) {
  // ⚠️ UN MEMBRE TYPÉ N'EST PAS UNE ENTRÉE — `def actor (alphabet alphabet, …)` publie
  // `{alphabet: {_derive:'alphabet'}, …}`, qui a la FORME d'un conteneur d'entrées. Un exemplaire
  // vide ne porte que sa trace de dérivation : un conteneur de places a des enfants qui portent
  // quelque chose (Romain, 2026-09-03, « le type en tête »).
  const tousObjets = (v) => {
    const m = Object.keys(v).filter((k) => !k.startsWith('_'));
    return m.length > 0 && m.every((k) => v[k] && typeof v[k] === 'object' && !Array.isArray(v[k]))
      && m.some((k) => Object.keys(v[k]).some((x) => !x.startsWith('_')));
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
