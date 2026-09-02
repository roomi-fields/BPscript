/**
 * BPScript Libs Bundle Generator
 *
 * Reads lib/ recursively and outputs a single ES module that exports all libs.
 * Usage: node src/transpiler/libs-bundle.js > src/transpiler/libs-data.js
 *
 * The generated module exports a `LIBS` object: { name: data, ... }
 * passed to registerAll() at load (Node + browser). Keys mirror the loader's
 * lookup names: top-level files keep their basename ("controls"), sub-directory
 * files use a slash key ("settings/notreich") so loadJsonFile('settings/notreich')
 * resolves from the registry — i.e. the bundle covers the on-demand sub-files
 * (lib/settings/*, lib/sounds/*) that have no filesystem fallback in the browser.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CHAMPS_DE_FICHIER } from './libs-champs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_DIR = join(__dirname, '../../lib');

const libs = {};

// ⛔ LES PLACES — les clés qui CONTIENNENT des entrées, par opposition aux entrées elles-mêmes.
//
// Un catalogue mêle les deux à la même profondeur : `voices` porte `objects` (une place) à côté de
// `resolves` (un champ de fichier), et `alphabets` porte ses entrées à sa racine. Un consommateur
// qui énumère le sommet d'un sac doit écarter les champs de fichier ET descendre dans les places.
//
// ⚠️ LA FORME NE SUFFIT PAS À LES SÉPARER, et c'est une mesure qui le dit. La règle « tous les
// membres sont des objets » classe juste 21 fois sur 21 aujourd'hui — mais elle rate une place VIDE
// (`core.symbols`, zéro entrée) et elle aurait classé `fatbass for:sub37` comme une place jusqu'au
// 2026-08-24, parce que son unique membre était un objet. Kairos a verrouillé ce trou chez lui
// plutôt que de deviner ; ce registre est ce qui le lui ferme.
//
// ⇒ POUR UNE SOURCE ÉCRITE DANS LE LANGAGE, la place est CONNUE : c'est ce générateur qui la crée.
//   Pour un catalogue encore en JSON, elle est DÉDUITE par la forme, et le paquet le dit.
const places = {};
const noterPlace = (lib, cle) => { (places[lib] = places[lib] || new Set()).add(cle); };
// ⛔ ET ON RETIENT QUELLES SOURCES SONT ÉCRITES DANS LE LANGAGE — sans ça, un repli sur la forme
// masque le registre. Mesuré par injection le 2026-08-24 : en retirant la notation des places, TOUT
// restait vert, parce que la forme retrouvait les mêmes 21 clés. Une connaissance de producteur qui
// se dégrade en déduction sans le dire est exactement ce que ce registre existe pour empêcher.
const ecritesDansLeLangage = new Set();

// Recurse one+ levels: top-level → "name", sub-dir → "subdir/name".
function collect(dir, prefix) {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { collect(full, prefix + entry + '/'); continue; }
    if (!entry.endsWith('.json')) continue;
    libs[prefix + entry.replace('.json', '')] = JSON.parse(readFileSync(full, 'utf-8'));
  }
}
collect(LIB_DIR, '');

// Capture des corps de FONCTIONS DIGITALES : lib/<name>/<fn>.ts → libs[<name>].objects[<fn>].body.
// L'authoring est un VRAI .ts TYPÉ (F1, contre kairos/core, vérifié par `npm run typecheck:digital`) ;
// le bundle en capte le SOURCE, que Kairos transpile (sucrase, strip des `import type`) et exécute au
// load. Source de vérité = le .ts (pas une chaîne dans le .json). Cf. docs/design/DIGITAL_FUNCTIONS.md.
function captureDigitalBodies(dir) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    const lib = libs[name];
    if (!lib || !lib.objects) continue;
    for (const entry of readdirSync(full).sort()) {
      if (!entry.endsWith('.ts')) continue;
      const fn = entry.replace('.ts', '');
      if (!lib.objects[fn]) {
        console.error(`[bundle] WARN: lib/${name}/${entry} — pas d'objet '${fn}' dans ${name}.json`);
        continue;
      }
      lib.objects[fn].body = readFileSync(join(full, entry), 'utf-8');
    }
  }
}

// ── LES LIBRAIRIES ÉCRITES EN BPSCRIPT ───────────────────────────────────────────────────────
// Une librairie se dit dans le langage qu'elle sert : `lib/<nom>.bpsl` porte ses contrôles en `def`,
// et le bundle les convertit en la MÊME forme que les `.json`.
//
// ⛔ L'EXTENSION EST `.bpsl`, PAS `.bps` — décision de Romain, 2026-08-14. Une SCÈNE s'écrit `.bps`,
// et les deux se lisent avec le MÊME compilateur : sans extension propre, rien ne distinguait une
// librairie d'une scène par son nom. La mesure qui l'a montré : chercher qui référence `.bps` chez
// les voisins rendait 222 fichiers sur sept dépôts — tous des lecteurs de SCÈNES. Une question sur
// les librairies ne pouvait pas trouver sa réponse dans ce bruit. Le runtime ne change donc pas d'un
// octet — les consommateurs lisent le bundle, comme avant. C'est le même geste que la capture des
// corps de fonctions digitales juste au-dessus : l'AUTHORING change, la donnée publiée ne bouge pas.
//
// LA CONVERSION, ET ELLE NE DEVINE RIEN :
//   · le `def` qui porte le NOM DU FICHIER déclare le fichier — resolvedBy, name, description ;
//   · tous les autres sont des contrôles ;
//   · une PHRASE porte ses GUILLEMETS — décision Romain, 2026-08-21, qui annule le backtick `txt:`.
//     ⚠️ ET LA LIGNE QUI ÉTAIT ICI CITAIT UNE RATIFICATION QUI N'EXISTAIT PAS : « la seule graphie
//     du langage qui délimite une phrase, ratifiée le 2026-08-13 ». Je l'avais écrite moi-même, et
//     je l'ai citée comme source pendant une journée. Aucune décision du 13 ne parle de prose.
//   · un nombre écrit devient un nombre.
//
// ⚠️ LA NATURE D'UNE VALEUR SE LIT DANS SON ÉCRITURE — voir `estUneSuite`, juste dessous. Cette
// ligne portait la règle inverse : « les clés-listes sont nommées, et c'est une propriété de la
// donnée » — cinq noms qui décidaient seuls, et qui décrivaient un mécanisme retiré le 2026-08-29.
// ⛔ LA LISTE DES CHAMPS DE FICHIER VIT EN UN SEUL ENDROIT — `libs-champs.js`, importé en tête. Ce
// fichier en portait une copie, et il y en avait CINQ dans l'écosystème, déjà divergentes.

/**
 * UNE PARENTHÈSE DONT AUCUN MEMBRE NE PORTE DE VALEUR EST UNE SUITE — LA FORME LE DIT.
 *
 * ⛔ CE QUE CE PRÉDICAT REMPLACE : cinq noms écrits en dur — `args`, `values`, `scope`, `range`,
 * `registers` — qui décidaient seuls qu'une clé portait une collection. Une valeur écrite en dur est
 * invisible : personne ne peut la lire ni la surcharger, et cette liste-là ne pouvait pas connaître
 * `degrees`, `ratios`, `compose` ni `junction` — 62 clés de la donnée publiée étaient dans ce cas.
 *
 * ⚠️ ET UN PROTOTYPE NE PEUT PAS LE DÉCLARER NON PLUS : il dit qu'un champ EXISTE, jamais qu'il porte
 * une liste. Ajouter ses champs nus à un ensemble de clés-listes faisait de `temperament`,
 * `description` et `culture` des listes — 483 valeurs publiées cassaient. **C'est l'écriture de
 * l'EXEMPLAIRE qui dit la nature** : une parenthèse de membres nus est une suite, un deux-points est
 * une valeur.
 *
 * ⚠️ IL VIVAIT DÉJÀ, à un seul des deux endroits qui en avaient besoin. Le retirer là où il manquait
 * transformait 68 listes publiées en objets — mesuré avant la frappe, et c'est ce qui prouve que le
 * défaut était le DOUBLE mécanisme, jamais la liste seule.
 */
const estUneSuite = (sac) => Boolean(sac && sac.type === 'SettingBag'
  && (sac.pairs || []).length && (sac.pairs).every((m) => m.value === true));

/**
 * RANGE UNE ENTRÉE ÉCRITE DANS UNE PLACE — et descend tant que la place a des étages.
 *
 * `schema(reservedDirectives(a, b))` a deux étages ; `engine(mode(…))` en a un. La descente
 * s'arrête quand ce qu'elle trouve n'est plus une place mais une ENTRÉE : un objet dont les
 * membres portent des valeurs, ou une suite de noms nus.
 */
function rangerConteneur(ou, nom, val, entry, place) {
  // Une valeur simple posée dans une place : `version:"1.0"` sous un conteneur.
  if (!val || val.type !== 'SettingBag') { ou[nom] = valeurDeCle({ kind: 'value', value: val }); return; }
  const pairs = val.pairs || [];
  // ⛔ UNE SUITE DE NOMS NUS EST UNE LISTE, PAS UNE PLACE — `reservedDirectives(scale, alphabet, …)`.
  // Elle se reconnaît à ce qu'AUCUN de ses membres ne porte de valeur, et elle passe par `suite`
  // pour garder son ORDRE et la NATURE de chaque membre.
  if (pairs.length && pairs.every((p) => p.value === true)) {
    ou[nom] = suite(val, entry, place, nom);
    return;
  }
  // Une PLACE ne porte que des sacs ; une ENTRÉE porte au moins une valeur.
  if (pairs.length && pairs.every((p) => p.value && p.value.type === 'SettingBag')) {
    const sous = (ou[nom] = ou[nom] || {});
    for (const p of pairs) rangerConteneur(sous, p.key, p.value, entry, `${place}.${nom}`);
    return;
  }
  const entree = (ou[nom] = {});
  for (const p of pairs) {
    if (p.value && p.value.type === 'SettingBag') {
      // ⚠️ UNE CLÉ-LISTE PASSE PAR `suite`, jamais par l'aplatissement : lui rendrait `args(seed)`
      // en `{seed:true}` au lieu de `['seed']`, ET perdrait l'ordre — un objet JavaScript réordonne
      // ses clés entières. Mesuré : 228 valeurs publiées changeaient sans cette distinction.
      entree[p.key] = estUneSuite(p.value) ? suite(p.value, entry, nom, p.key) : sacEnObjet(p.value, entry, nom);
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
  // Mesuré sur `octaves.western`, qui porte `default:"4"` et ressortait en `4` — indistinguable du
  // rang qu'on venait de retirer, et pour `bp3` le nombre 4 désigne le registre nommé « 3 ».
  // ⚠️ ET LA COERCITION RESTE POUR TOUT LE RESTE : les six librairies encore en corps indenté
  // rendent TOUT en chaîne, donc leurs nombres ont besoin d'elle. La retirer d'un bloc changeait
  // 582 valeurs publiées — `notes_count`, `range`, `degrees` — au lieu des vingt visées. C'est la
  // marque qui distingue, jamais le type de ce qui arrive.
  if (v && v.texte) return v.value;
  const brut = v && v.kind === 'value' ? v.value : (v && v.value);
  const un = (x) => {
    if (typeof x !== 'string') return x;
    // ⚠️ LE BOOLÉEN EST TYPÉ, et son absence était bloquante : `bpscript:false` rendait la CHAÎNE
    // 'false', qui est vraie. Les six gestes natifs déclarés pour le seul routage seraient
    // rentrés dans le vocabulaire du langage — l'inverse exact de ce que leur champ déclare, et
    // en silence, parce qu'une chaîne non vide passe tous les tests de présence.
    if (x === 'true') return true;
    if (x === 'false') return false;
    return /^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x;
  };
  return Array.isArray(brut) ? brut.map(un) : un(brut);
}

// ⚠️ LA CIRCULARITÉ EST RÉELLE ET SE RÉSOUT EN DEUX TEMPS, jamais par un second lecteur.
// Le bundle a besoin du TRANSPILEUR pour lire une librairie en BPScript ; le transpileur a besoin du
// BUNDLE pour son vocabulaire. Écrire un petit lecteur de `def` ici règlerait la boucle en une
// minute — et créerait une SECONDE GRAMMAIRE, exactement ce que la demande de Romain exclut :
// « je veux que ton interpréteur interprète le contenu des librairies de la même façon qu'il
// interprète le contenu des scènes ».
// On écrit donc d'abord le bundle des `.json` SEULS sur le disque, puis on charge le transpileur —
// qui trouve alors un bundle valide — et on relit les `.bps` avec LUI. Un seul interprète, deux passes.
// ⛔ UNE PARENTHÈSE PRÉSERVE L'ORDRE DE CE QU'ON Y ÉCRIT — arbitrage Romain, 2026-08-19. Une seule
// forme sert la SUITE et l'ENSEMBLE : un ensemble est une suite dont personne ne lit le rang. Ce que
// la donnée exigeait : `octaves.saptak` adresse ses registres PAR LEUR RANG — `default:1` désigne
// madhya, le deuxième des trois — donc sans l'ordre cette valeur ne désigne plus rien.
//
// ⛔ LA SUITE SE PREND SUR `pairs`, JAMAIS SUR UN OBJET INTERMÉDIAIRE. Un objet JavaScript réordonne
// ses clés entières AVANT toutes les autres : `{"0":…,"1":…}` sort en ordre numérique quoi qu'on
// écrive, et le rang serait rendu par le moteur d'exécution au lieu de la source. Le tableau des
// couples est la seule lecture qui rend ce qui a été écrit.
//
// ⛔ ET UN MEMBRE PORTEUR EST REFUSÉ, JAMAIS AVALÉ : dans une clé-liste, seul le rang compte, donc
// une valeur écrite sur un membre n'a nulle part où aller. La perdre en silence est le mode d'échec
// exact du chantier — une graphie acceptée qui ne porte rien.
// ⛔ ET LA NATURE D'UN MEMBRE SE LIT SUR SA MARQUE, JAMAIS SUR SON TEXTE. Depuis le 2026-08-19 un
// membre est un nom, un nombre ou un texte entre guillemets — et `"0"` et `0` s'écrivent pareil une
// fois la clé posée. Un registre nommé « 0 » ressortirait donc en NOMBRE si on relisait son texte,
// et la donnée publiée changerait de type sans un mot. Le parseur marque le membre texte ; on lit
// la marque.
function suite(sac, fichier, declaration, cle) {
  const porteurs = (sac.pairs || []).filter((p) => p.value !== true);
  if (porteurs.length) {
    console.error(`[bundle] ⛔ lib/${fichier} · ${declaration} : '${cle}' est une clé-liste — ses `
      + `membres sont des noms nus, et ${porteurs.map((p) => `'${p.key}'`).join(', ')} porte(nt) une `
      + `valeur. Une clé-liste ne lit que le RANG ; cette valeur serait perdue sans un mot.`);
    process.exitCode = 1;
  }
  return (sac.pairs || []).map((p) => (p.texte ? p.key
    : (/^-?\d+(\.\d+)?$/.test(p.key) ? Number(p.key) : p.key)));
}

/** Un sac imbriqué devient un objet — une parenthèse, un niveau. */
/**
 * ⛔ UN LITTÉRAL SE LIT PAREIL À TOUTES LES PROFONDEURS, ET CE LECTEUR DISAIT LE CONTRAIRE.
 *
 * Cette fonction recopiait `p.value` BRUT, quand `valeurDeCle` — l'autre lecteur, à trois cents
 * lignes d'ici — rend `'true'` en booléen et `'12'` en nombre. **Deux lecteurs pour un seul fait**,
 * et la profondeur décidait lequel s'appliquait :
 *
 *     champ de fichier, sur la déclaration     documented:false   →  false     LE BOOLÉEN
 *     membre au fond d'une place               out:true           →  "true"    LA CHAÎNE
 *
 * ⚠️ CE QUE ÇA A COÛTÉ, ET C'EST DE MOI : le 2026-08-24 j'ai mesuré le premier cas, conclu sur le
 * second, et routé « le langage n'a pas de littéral booléen » à quatre destinataires — dont une
 * surface publiée. runtime-MIDI l'a réfuté avec mon propre paquet, et sa question était la bonne :
 * **pas si le langage a un booléen, mais QUELLE POSITION le perd.** Celle-ci.
 *
 * ⚠️ ET C'EST L'UNE DES TROIS PERTES QUI TIENNENT `core` HORS DE LA CONVERSION — quatorze booléens
 * de ses canaux devenaient des chaînes, et une chaîne non vide est VRAIE.
 *
 * ⛔ RAYON D'IMPACT MESURÉ AVANT LA FRAPPE : 7331 feuilles comparées, ZÉRO valeur publiée change.
 * Aucune source du langage n'écrit aujourd'hui un littéral typable au fond d'un sac ; la réparation
 * ferme la porte avant que quelqu'un la pousse.
 */
function sacEnObjet(sac, fichier = '?', declaration = '?') {
  const out = {};
  for (const p of sac.pairs || []) {
    // ⛔ UNE SUITE DE NOMS NUS EST UNE LISTE, À CETTE PROFONDEUR COMME AUX AUTRES. Ce lecteur en
    // faisait un OBJET — `liste(a, b)` rendait `{a:true, b:true}` — quand `rangerConteneur`, un
    // étage plus haut, rend `["a","b"]` pour la MÊME graphie.
    //
    // ⚠️ DEUX MÉCANISMES POUR UN SEUL FAIT, ET LA PROFONDEUR CHOISISSAIT : à l'étage de l'entrée la
    // suite se reconnaît à sa FORME (aucun membre ne porte de valeur) ; plus bas, elle ne se
    // reconnaissait qu'à la LISTE DE CLÉS écrite à la main. **C'est le même défaut que les deux
    // lecteurs de valeur réparés le matin même, dans le même fichier** — j'avais fermé le littéral
    // et laissé la suite.
    //
    // ⛔ RAYON D'IMPACT MESURÉ AVANT LA FRAPPE : 7331 feuilles, ZÉRO valeur publiée change. Aucune
    // source du langage n'écrit aujourd'hui une suite à cette profondeur.
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

/** Les sources écrites dans le langage, dans l'ordre des noms — l'ordre du paquet. */
function sourcesBps(dir, prefix) {
  const out = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { out.push(...sourcesBps(full, prefix + entry + '/')); continue; }
    if (!entry.endsWith('.bpsl')) continue;
    out.push({ entry, full, nom: prefix + entry.replace('.bpsl', '') });
  }
  return out;
}

// ⛔ L'ORDRE DE LECTURE SUIT LA CHAÎNE `apporte`, PAS L'ALPHABET — ET C'EST UN POINT FIXE, JAMAIS UNE
// LISTE DE NOMS. Une source invoque en tête ce dont elle dérive (`types` porte les types du socle
// depuis le 2026-09-02, et six catalogues de contrôles l'invoquent). Lue par ordre alphabétique,
// `audio` passait avant `types` et lisait le `types` du paquet COMMITÉ — sans `control` — donc ne
// compilait plus, et le paquet ne pouvait plus être régénéré depuis ses sources : l'amorçage ne
// tenait qu'à l'ancien paquet. Mesuré le 2026-09-02, six sources sur vingt-deux.
// ⇒ Une source qui ne compile pas est REPRISE après les autres ; chaque librairie construite entre
// au registre du compilateur, et les sources lues ensuite la voient telle qu'elle vient d'être
// écrite. Une passe sans progrès s'arrête et nomme chaque refus : c'est une vraie faute de source.
async function collectBps(restants, compileToBPxAST, registerLib) {
  const encore = [];
  const refus = [];
  for (const { entry, full, nom } of restants) {
    ecritesDansLeLangage.add(nom);
    const r = compileToBPxAST(readFileSync(full, 'utf-8'));
    if ((r.errors || []).length) {
      encore.push({ entry, full, nom });
      refus.push(`lib/${entry} NE COMPILE PAS : ${r.errors[0].message}`);
      continue;
    }
    const lib = { controls: {} };
    let sectionDuFichier = null;
    // ⛔ UNE LIBRAIRIE EN INVOQUE UNE AUTRE PAR UNE LIGNE NUE, ET C'EST `apporte` — décision Romain,
    // 2026-08-20, `une-librairie-en-invoque-une-autre-a-la-lecture`. Le mécanisme existait déjà et
    // n'était pas EMPLOYÉ à la lecture d'un fichier de librairie : `libs.js` suit la chaîne
    // `apporte` transitivement, avec garde anti-cycle, et personne ne la remplissait depuis une
    // source écrite dans le langage.
    //
    // ⚠️ `apporte` N'EST PAS UN CHAMP DE FICHIER — il ne s'écrit pas dans le corps du `def`. C'est
    // l'invocation elle-même, à la tête du fichier, exactement comme une scène invoque : `types`
    // seul sur sa ligne. Le générateur la relève ici et la publie sous le nom que le mécanisme
    // porte déjà, plutôt que d'inventer un second nom pour un seul fait.
    //
    // ⚠️ ET LA LIGNE ÉTAIT INERTE JUSQU'ICI : `lib/scales.bpsl` écrit `types` depuis sa conversion
    // pour que ses 135 exemplaires trouvent leur prototype À LA COMPILATION — et rien n'en
    // arrivait au paquet, donc rien ne chargeait `types` derrière une invocation de `scale`.
    // L'ordre d'écriture est l'ordre de la liste : la chaîne se résout dans l'ordre déclaré.
    const invoquees = (r.ast.directives || [])
      .filter((d) => d.name && !d.subkey)
      .map((d) => d.name);
    if (invoquees.length) lib.apporte = invoquees;
    // ⛔ UNE DÉCLARATION S'ÉCRIT SOUS DEUX FORMES, ET LE LECTEUR DOIT LES DEUX. Le corps INDENTÉ
    // rend `keys` ; le corps entre PARENTHÈSES rend `settings`. La seconde est celle que Romain a
    // tranchée le 2026-08-19 — « je m'oppose formellement à toute forme de parsing en fonction de
    // l'indentation » — et la première s'éteint avec la réécriture des neuf librairies.
    //
    // ⛔ SANS CETTE LECTURE, RÉÉCRIRE UNE LIBRAIRIE LA VIDE EN SILENCE : le `continue` du dessous
    // sautait toute déclaration sans `keys`, donc toutes celles écrites en parenthèses, et le
    // bundle sortait avec une librairie vide sans un mot. C'est le mode d'échec exact du chantier —
    // une graphie acceptée qui ne porte rien — et il se serait produit AU GÉNÉRATEUR, où aucun
    // refus du compilateur ne l'aurait vu : le fichier compile parfaitement.
    //
    // Les deux formes se ramènent ici à la MÊME structure `{clé: valeur}` : une seule suite de
    // lecture derrière, jamais deux branches à tenir en parallèle.
    const clesDeLaDeclaration = (d) => {
      if (d.keys) return d.keys;
      if (!d.settings || !Array.isArray(d.settings.pairs)) return null;
      const out = {};
      for (const p of d.settings.pairs) {
        // ⛔ CE QUI EST HÉRITÉ NE SE REPUBLIE PAS — décision de Romain, 2026-08-29 : *« dans les
        // librairies, porter sinon ça n'a aucun sens »*. L'étage qui résout grave la dérivation
        // dans l'arbre, parce que l'aval doit recevoir une valeur et jamais un choix ; le paquet,
        // lui, PORTE la structure et ne la recopie pas. Un lecteur qui republierait la greffe
        // écrirait le régime que Romain a écarté, sans qu'aucune mesure ne le dise : la donnée
        // serait juste, seulement plus grosse de ce que chaque exemplaire aurait recopié.
        if (p.herite) continue;
        // Une valeur qui est elle-même un sac descend d'un niveau — la récursivité par la
        // parenthèse, lue depuis le 2026-08-19.
        out[p.key] = (p.value && p.value.type === 'SettingBag')
          ? (estUneSuite(p.value)
              // ⛔ UNE SUITE EST DÉJÀ TYPÉE MEMBRE PAR MEMBRE : la repasser à la coercition
              // générique retypera le texte « 0 » en nombre, et le geste de `suite` sera défait
              // au maillon suivant. Elle passe donc par un `kind` à elle, et sort verbatim.
              ? { kind: 'suite', value: suite(p.value, entry, d.name, p.key) }
              // ⛔ ET LE SAC BRUT VOYAGE AVEC : un CONTENEUR se range membre par membre, et
              // l'aplatisseur ne passe pas par la lecture de suite — il rendrait une liste d'un
              // seul nom en objet à un membre, ET IL PERDRAIT L'ORDRE, puisqu'un objet JavaScript
              // réordonne ses clés entières. Mesuré : 228 valeurs publiées changeaient.
              // ⚠️ Ce commentaire a été amputé une première fois : je l'avais inséré par le shell
              // avec des accents graves, que le shell a exécutés. Cinquième fois du même signe.
              : { kind: 'value', value: sacEnObjet(p.value, entry, d.name), sac: p.value })
          : { kind: 'value', value: p.value, ...(p.texte ? { texte: true } : {}) };
      }
      return out;
    };
    // ⛔ ET LES EXEMPLAIRES SONT DES DÉCLARATIONS PAR LE TYPE, PAS DES `def`. Un prototype et ceux
    // qui en dérivent s'écrivent `scale ionian (…)` : le parseur en fait des VarDirective, et cette
    // boucle ne lisait que les `defs`. Les 185 entrées de `scales` disparaissaient — mesuré, 1805
    // valeurs publiées perdues. Le langage exprimait la dérivation, ce lecteur ne la voyait pas :
    // la troisième fois aujourd'hui qu'un mécanisme ratifié n'était servi que par le compilateur.
    //
    // Une déclaration par le type porte son NOM dans `names` et son type dans `varType.type` — un
    // exemplaire garde donc la trace de ce dont il dérive, et le générateur n'a pas à la deviner.
    // ⛔ LA PARENTHÈSE ABSENTE VAUT PARENTHÈSE VIDE, ET CE FILTRE DISAIT LE CONTRAIRE. Il exigeait
    // `v.settings` pour retenir un exemplaire ; un prototype écrit sans corps — `object gamut` —
    // était donc écarté et son entrée SORTAIT du paquet, au lieu d'y porter un objet vide.
    //
    // ⚠️ TROUVÉ EN RETIRANT LES CINQ CORPS (Romain, 2026-08-25 : « on ne fait pas de prédéfinition
    // d'objet vide »). Les cinq lignes restaient dans la source et les cinq entrées disparaissaient
    // du paquet — l'inverse exact de l'arbitrage, dont le point est que la LIGNE reste pour donner
    // un parent nommé à `interval maqam_sikah (…)`.
    //
    // ⛔ ET MA COMPARAISON DE FEUILLES NE POUVAIT PAS LE VOIR : elle rendait `types.gamut.description
    // → absent`, ce qui se lit comme le retrait voulu. **Une liste de feuilles ne dit rien de la
    // disparition du NŒUD qui les portait** — les deux ont la même empreinte.
    const sacVide = { type: 'SettingBag', pairs: [] };
    const declarations = [
      ...(r.ast.defs || []),
      ...(r.ast.vars || []).filter((v) => v.varType?.kind === 'type')
        .map((v) => ({ type: 'DefDirective', name: v.names[0], settings: v.settings || sacVide,
                       derivedeDe: v.varType.type, line: v.line })),
    ];
    for (const d of declarations) {
      if (d.type !== 'DefDirective') continue;
      d.keys = clesDeLaDeclaration(d);
      if (!d.keys) continue;
      // ⛔ UNE CLÉ `section` DIT OÙ LE MOT SE RANGE — posée le 2026-08-14 pour la bascule d'`engine`.
      // Les cinq premières librairies n'avaient qu'une section, `controls`. `engine` en porte QUATRE :
      // `controls`, `engine`, `subgrammar` et `schema.reservedDirectives`. Sans ce mot, la conversion
      // les FUSIONNERAIT en une seule et changerait la donnée — quatre lecteurs de mon propre `src/`
      // les distinguent, et le garde des graphies natives balaye les trois premières nommément.
      // ⚠️ CE N'EST PAS UNE FORME DU LANGAGE, c'est une correspondance de LECTURE : `section` est une
      // clé ordinaire de `def`, que le langage accepte déjà, et rien de nouveau ne s'écrit dans une
      // scène. Même geste que l'absence d'`args` qui vaut liste vide. La preuve reste l'ÉGALITÉ du
      // paquet avant et après, pas ce raisonnement.
      // Le chemin est POINTÉ : `schema.reservedDirectives` se lit comme une descente.
      // Le chemin vient de l'entree, sinon du FICHIER, sinon la RACINE. Plus aucun defaut
      // implicite : une librairie qui ne dit rien range ses entrees comme sa source.
      const chemin = d.keys && d.keys.section ? valeurDeCle(d.keys.section)
        : sectionDuFichier;
      let cible;
      let aEcrireEnQueue = null;
      if (d.name === entry.replace('.bpsl', '')) {
        cible = lib;
      } else {
        let ou = lib;
        if (chemin) {
          const segs = String(chemin).split('.');
          for (const seg of segs) { ou[seg] = ou[seg] || {}; ou = ou[seg]; }
          noterPlace(nom, segs[0]);
        }
        cible = (ou[d.name] = {});
        // ⛔ LA TRACE DE DÉRIVATION SE PUBLIE — câblage 4 de la phase 3, 2026-08-31.
        //
        // Elle était LUE et jamais ÉCRITE : `derivedeDe` sert au rangement, puis disparaît. ⇒ **La
        // dérivation existait à la COMPILATION et s'évaporait à la PUBLICATION**, et c'est pourquoi
        // rien ne distinguait `alphabet` de `western` à l'arrivée.
        //
        // Décision de Romain : *le type d'une entrée est le prototype dont elle dérive, écrit en
        // tête* — `alphabet western (…)`, exactement comme un membre porte son type. Le publier est
        // donc la seule façon pour un consommateur de lire ce que la source dit déjà.
        //
        // ⚠️ ET L'ORDRE EST CONTRAINT, il ne se choisit pas : cette trace entre AVANT que `resolves`
        // sorte du catalogue. Inversé, un catalogue perd son mot d'invocation avant que son
        // remplaçant existe — kairos a chiffré le coût avant la frappe : ses scènes meurent MUETTES,
        // 98 invocations sur `alphabet`, 51 sur `scale`.
        //
        // ⚠️ UN PROTOTYPE NE PORTE PAS LA TRACE. `object gamut` dérive du mot qui INTRODUIT un
        // prototype, pas d'un parent : lui coller `_derive:"object"` publierait une dérivation qui
        // n'existe pas.
        //
        // ⛔ ET ELLE S'ÉCRIT EN DERNIER, PAS EN PREMIER — mesuré. Posée à la création de l'objet,
        // elle décalait le rang de TOUTES les clés des 189 entrées, et mon témoin d'ordre l'a dit :
        // « 189 ORDRES DE CLÉS ONT BOUGÉ ». Un ajout en queue laisse chaque clé existante à son rang.
        // ⇒ *Un champ neuf n'a aucune raison de déplacer ceux qui étaient là.*
        aEcrireEnQueue = d.derivedeDe && d.derivedeDe !== 'object' ? d.derivedeDe : null;
      }
      for (const [cle, v] of Object.entries(d.keys)) {
        // `section` ROUTE, elle ne se publie JAMAIS — ni sur une entree, ni sur le fichier.
        // Sur le fichier elle dit le rangement par defaut de ses entrees ; on la retient a
        // part pour que la donnee publiee reste celle de la source, octet pour octet.
        if (cle === 'section') { if (cible === lib) sectionDuFichier = valeurDeCle(v); continue; }
        const val = valeurDeCle(v);
        // ⛔ ET UNE CLÉ QUI PORTE UN OBJET EST UN CONTENEUR — LA SECTION DEVIENT LA PLACE.
        //
        // La récursivité par la parenthèse est ratifiée depuis le 2026-08-19 : « un champ dont la
        // valeur est elle-même un objet s'écrit par la parenthèse ». Le compilateur la lit ; CE
        // LECTEUR-CI ne la lisait pas. Il exigeait un `def` par entrée, chacune portant un champ
        // qui NOMMAIT sa section — une lecture PLATE d'une donnée qui a des étages.
        //
        // ⚠️ CE QUE ÇA SUPPRIME : `section` comme CHAMP. Une entrée écrite DANS `engine(…)` est
        // dans engine ; elle n'a plus à le dire. La donnée publiée ne bouge pas d'un caractère —
        // mesuré avant la frappe : `section` a ZÉRO occurrence dans les 29 librairies publiées,
        // il n'a jamais voyagé, il ROUTAIT.
        //
        // La distinction est étroite et ne devine rien : sur la déclaration DU FICHIER, une clé
        // hors des champs de fichier qui porte un OBJET est une place. Tout le reste reste refusé.
        if (cible === lib && !CHAMPS_DE_FICHIER.has(cle)) {
          // Le SAC BRUT, jamais l'objet aplati : l'ordre des suites en dépend.
          const sac = v && v.sac;
          if (sac && sac.type === 'SettingBag') {
            const ou = (lib[cle] = lib[cle] || {});
            noterPlace(nom, cle);
            for (const p2 of (sac.pairs || [])) rangerConteneur(ou, p2.key, p2.value, entry, cle);
            continue;
          }
          console.error(`[bundle] ⛔ lib/${entry} : '${cle}' n'est pas un champ de FICHIER `
            + `(${[...CHAMPS_DE_FICHIER].join(', ')}), et sa valeur n'est pas un objet. Une entrée `
            + `se déclare par son propre 'def', ou s'écrit DANS une place — '${cle}(<nom>(…), …)'.`);
          process.exitCode = 1;
          continue;
        }
        cible[cle] = val;
      }
      // La trace de dérivation ferme l'entrée — cf. le bloc qui la calcule, plus haut.
      if (aEcrireEnQueue) cible._derive = aEcrireEnQueue;
    }
    // ⚠️ UNE LISTE VIDE N'A PAS DE GRAPHIE, et l'absence de `args` n'en a jamais eu d'autre sens.
    // Mesure du 2026-08-13 : sur les 64 contrôles du bundle, ZÉRO n'omet `args` et 31 le portent
    // vide. L'absence est donc libre, et la source `.bps` s'en sert pour dire « aucun argument ».
    // C'est une correspondance de LECTURE, pas une forme du langage : rien de nouveau ne s'écrit
    // dans une scène. La preuve n'est pas ce raisonnement mais l'ÉGALITÉ du bundle avant/après.
    // ⚠️ ET LA RESTAURATION VAUT POUR TOUTES LES SECTIONS, pas seulement `controls` — trouvé en
    // convertissant `engine` : sept mots de `engine` et `subgrammar` perdaient leur `args` vide,
    // parce que cette boucle ne connaissait qu'une section. Le routage par `section` a rendu le
    // défaut visible ; il vivait déjà, latent, en attendant une deuxième section.
    // ⚠️ ET PAS `schema.reservedDirectives` : ses entrées n'ont JAMAIS porté d'`args`. Ma première
    // version l'y incluait et AJOUTAIT le champ à ses 27 mots — ajouter une valeur est un
    // changement de donnée autant qu'en retirer un, et c'est la comparaison avant/après qui l'a
    // dit, pas la lecture. Une directive réservée déclare un NOM et sa portée, pas une signature.
    const sections = [lib.controls, lib.engine, lib.subgrammar].filter(Boolean);
    for (const sec of sections) {
      for (const c of Object.values(sec)) {
        if (c && typeof c === 'object' && c.args === undefined && ('bp3' in c || 'description' in c)) c.args = [];
      }
    }
    if (!Object.keys(lib.controls).length) delete lib.controls;
    libs[nom] = lib;
    registerLib(nom, lib);
  }
  if (!encore.length) return;
  if (encore.length === restants.length) {
    for (const m of refus) console.error(`[bundle] ⛔ ${m}`);
    process.exitCode = 1;
    return;
  }
  await collectBps(encore, compileToBPxAST, registerLib);
}


// ── LE TRANSPILEUR LIT LES `.bps` ────────────────────────────────────────────────────────────
// ⚠️ CE GÉNÉRATEUR N'ÉCRIT JAMAIS SUR LE DISQUE — il rend son résultat sur la sortie standard, et
// c'est ce qui rend le garde de fraîcheur possible : il RELANCE ce générateur et compare à ce qui
// est commité. Ma première version écrivait un bundle intermédiaire dans `libs-data.js` pour casser
// la circularité — elle DÉTRUISAIT donc le bundle commité au moment même où on le vérifiait, et le
// garde comparait le frais à ce qu'il venait lui-même d'écraser.
// La circularité n'a pas besoin de ça : le bundle COMMITÉ suffit à charger le transpileur. Il sert
// d'amorce, et chaque librairie construite ici le REMPLACE au registre au fil de la lecture — une
// source qui invoque `types` en tête lit le `types` de cette régénération, jamais celui du paquet.
const { compileToBPxAST } = await import('./index.js');
const { registerLib } = await import('./libs.js');
await collectBps(sourcesBps(LIB_DIR, ''), compileToBPxAST, registerLib);
captureDigitalBodies(LIB_DIR);

// Output as ES module
//
// ⛔ L'EN-TÊTE NE NOMME PAS UN FORMAT DE SOURCE, ET C'EST UNE RÈGLE, PAS UN GOÛT. Il a dit
// « lib/*.json » jusqu'au 2026-08-19, alors que neuf librairies sur vingt-neuf n'existaient plus
// qu'en `.bpsl`. Ce fichier est déclaré en export dans `package.json` : un consommateur qui lit
// cette phrase conclut que le bundle est PARTIEL depuis la conversion et va chercher les sources à
// la main — donc se recassera à la prochaine bascule de format. Atlas a failli le faire.
//
// C'est le SIXIÈME lecteur qui se trompe en raisonnant sur l'extension d'un fichier de librairie,
// et le premier qui n'est pas du code : une PHRASE. Le format d'une source n'est jamais une
// information utile à qui veut la donnée.
let output = '// Auto-generated by libs-bundle.js — do not edit\n';
output += '// Contains every library of lib/, whatever the format of its source\n\n';
output += 'const LIBS = {};\n\n';

// ⛔ L'ORDRE DU PAQUET EST CELUI DES NOMS, JAMAIS CELUI DES PASSES — ET IL DÉSIGNE UNE AUTORITÉ.
// Ce générateur rangeait les `.json` d'abord, les `.bpsl` ensuite. Or `motsDInvocation()` prend le
// PREMIER fichier qui sert un axe comme catalogue de RÉFÉRENCE (libs.js, `fichierDeLAxe`) : convertir
// `alphabets` le renvoyait derrière `test_alphabets`, et le catalogue de TEST devenait l'autorité de
// l'axe `alphabet`. Mesuré le 2026-08-24 — sept gardes de cascade rouges, l'alphabet effectif absent.
//
// ⚠️ C'EST LE SEPTIÈME LECTEUR TROMPÉ PAR L'EXTENSION D'UNE SOURCE DE LIBRAIRIE, et le premier qui
// soit ce fichier même. Le format d'une source n'est jamais une information utile à qui veut la
// donnée — y compris pour la RANGER. Un tri par nom rend le paquet indifférent au format, et il ne
// change AUCUNE autorité sur l'état d'aujourd'hui : mesuré, 22 axes, zéro bascule.
for (const [name, data] of Object.entries(libs).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
  // NB : lib/tuning.json (162 gammes plates Bernard, ex-legacy) a été RETIRÉ (fichier mort,
  // runtime-inconsommé — ses ratios vivent dans temperaments.json en grilles bp3_*). Provenance
  // conservée : scripts/convert-tonality.js documente le mapping BP3 -to.* → gammes.
  output += `LIBS["${name}"] = ${JSON.stringify(data)};\n\n`;
}

// ⛔ CHAQUE CLÉ PUBLIÉE PORTE SON ENTRÉE, VIDE SI ELLE N'A AUCUNE PLACE. Ma première écriture ne
// nommait que les treize catalogues qui en ont : pour les treize autres, `PLACES[nom]` rendait
// `undefined`, et « je n'ai pas de place » ne se distinguait pas de « je n'ai rien déclaré ».
// Atlas et runtime-midi l'ont relevé le même jour, indépendamment — et c'est le TROISIÈME ÉTAT que
// runtime-midi venait de me faire fermer sur `documented`, deux heures plus tôt, sur un autre champ.
//
// ⛔ LES PLACES SE PUBLIENT, parce qu'un consommateur ne peut pas les déduire. Pour une source
// écrite dans le langage, ce générateur les CONNAÎT — il vient de les créer. Pour un catalogue
// encore en JSON, il les déduit par la forme, et cette déduction rate une place VIDE : le champ
// `_deduites` dit lesquelles, pour qu'un lecteur sache où sa confiance s'arrête.
const tousObjets = (v) => {
  const m = Object.keys(v).filter((k) => !k.startsWith('_'));
  return m.length > 0 && m.every((k) => v[k] && typeof v[k] === 'object' && !Array.isArray(v[k]));
};
const PLACES = {};
const deduites = [];
for (const [nom, data] of Object.entries(libs).sort(([a2], [b2]) => (a2 < b2 ? -1 : a2 > b2 ? 1 : 0))) {
  // ⛔ UNE SOURCE ÉCRITE DANS LE LANGAGE NE SE DÉDUIT JAMAIS : ce générateur a créé ses places, donc
  // il les connaît, y compris quand il n'y en a AUCUNE. Le repli est réservé à ce qu'il n'a pas écrit.
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
output += `const PLACES = ${JSON.stringify(PLACES)};\n`;
output += `PLACES._deduites = ${JSON.stringify(deduites.sort())};\n\n`;
output += 'export { LIBS, PLACES };\n';

process.stdout.write(output);
