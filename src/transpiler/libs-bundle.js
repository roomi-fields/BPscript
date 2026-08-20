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

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_DIR = join(__dirname, '../../lib');

const libs = {};

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
captureDigitalBodies(LIB_DIR);

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
//   · une valeur en backtick `txt:` rend son texte — c'est la seule graphie du langage qui délimite
//     une phrase, ratifiée le 2026-08-13 ;
//   · un nombre écrit devient un nombre.
//
// ⚠️ LES CLÉS-LISTES SONT NOMMÉES, ET C'EST UNE PROPRIÉTÉ DE LA DONNÉE, PAS UNE DEVINETTE. `args`,
// `values`, `scope` et `range` sont des listes PAR NATURE — un contrôle a zéro, un ou plusieurs
// arguments ; une portée est un ensemble de places ; une plage a deux bornes. Une valeur à une
// seule partie y reste donc une liste d'un élément, sans quoi `args:type` rendrait une chaîne là où
// tout le reste de la donnée porte un tableau, et chaque lecteur devrait gérer les deux.
const CLES_LISTES = new Set(['args', 'values', 'scope', 'range', 'registers']);
// ⚠️ `section` DIT OU LES ENTREES DE CE FICHIER SE RANGENT, en un endroit. Sans lui, le
// generateur DEVINAIT — `controls` par defaut — et le silence voulait dire deux choses
// opposees : `controls` pour une librairie de controles, la RACINE pour un catalogue.
// Une convention implicite qui decide a la place de la donnee est le defaut qu'on retire.
const CHAMPS_DE_FICHIER = new Set(['resolvedBy', 'resolves', 'name', 'description', 'version', 'type', 'section']);

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
      entree[p.key] = CLES_LISTES.has(p.key) ? suite(p.value, entry, nom, p.key) : sacEnObjet(p.value);
      continue;
    }
    let x = valeurDeCle({ kind: 'value', value: p.value, ...(p.texte ? { texte: true } : {}) });
    if (CLES_LISTES.has(p.key) && !Array.isArray(x)) x = [x];
    entree[p.key] = x;
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
    const t = x.match(/^txt:\s*([\s\S]*)$/);   // backtick typé : `txt: une phrase`
    if (t) return t[1];
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
function sacEnObjet(sac) {
  const out = {};
  for (const p of sac.pairs || []) {
    out[p.key] = (p.value && p.value.type === 'SettingBag') ? sacEnObjet(p.value) : p.value;
  }
  return out;
}

async function collectBps(dir, prefix, compileToBPxAST) {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { await collectBps(full, prefix + entry + '/', compileToBPxAST); continue; }
    if (!entry.endsWith('.bpsl')) continue;
    const nom = prefix + entry.replace('.bpsl', '');
    const r = compileToBPxAST(readFileSync(full, 'utf-8'));
    if ((r.errors || []).length) {
      console.error(`[bundle] ⛔ lib/${entry} NE COMPILE PAS : ${r.errors[0].message}`);
      process.exitCode = 1;
      continue;
    }
    const lib = { controls: {} };
    let sectionDuFichier = null;
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
        // Une valeur qui est elle-même un sac descend d'un niveau — la récursivité par la
        // parenthèse, lue depuis le 2026-08-19.
        out[p.key] = (p.value && p.value.type === 'SettingBag')
          ? (CLES_LISTES.has(p.key)
              // ⛔ UNE SUITE EST DÉJÀ TYPÉE MEMBRE PAR MEMBRE : la repasser à la coercition
              // générique retypera le texte « 0 » en nombre, et le geste de `suite` sera défait
              // au maillon suivant. Elle passe donc par un `kind` à elle, et sort verbatim.
              ? { kind: 'suite', value: suite(p.value, entry, d.name, p.key) }
              // ⛔ ET LE SAC BRUT VOYAGE AVEC : un CONTENEUR se range membre par membre, et
              //  aplatit sans passer par  — il rendrait  en
              //  au lieu de , ET IL PERDRAIT L ORDRE, puisqu'un objet
              // JavaScript réordonne ses clés entières. Mesuré : 228 valeurs publiées changeaient.
              : { kind: 'value', value: sacEnObjet(p.value), sac: p.value })
          : { kind: 'value', value: p.value, ...(p.texte ? { texte: true } : {}) };
      }
      return out;
    };
    for (const d of (r.ast.defs || [])) {
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
      if (d.name === entry.replace('.bpsl', '')) {
        cible = lib;
      } else {
        let ou = lib;
        if (chemin) {
          for (const seg of String(chemin).split('.')) { ou[seg] = ou[seg] || {}; ou = ou[seg]; }
        }
        cible = (ou[d.name] = {});
      }
      for (const [cle, v] of Object.entries(d.keys)) {
        // `section` ROUTE, elle ne se publie JAMAIS — ni sur une entree, ni sur le fichier.
        // Sur le fichier elle dit le rangement par defaut de ses entrees ; on la retient a
        // part pour que la donnee publiee reste celle de la source, octet pour octet.
        if (cle === 'section') { if (cible === lib) sectionDuFichier = valeurDeCle(v); continue; }
        let val = valeurDeCle(v);
        if (CLES_LISTES.has(cle) && !Array.isArray(val)) val = [val];
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
  }
}


// ── LE TRANSPILEUR LIT LES `.bps` ────────────────────────────────────────────────────────────
// ⚠️ CE GÉNÉRATEUR N'ÉCRIT JAMAIS SUR LE DISQUE — il rend son résultat sur la sortie standard, et
// c'est ce qui rend le garde de fraîcheur possible : il RELANCE ce générateur et compare à ce qui
// est commité. Ma première version écrivait un bundle intermédiaire dans `libs-data.js` pour casser
// la circularité — elle DÉTRUISAIT donc le bundle commité au moment même où on le vérifiait, et le
// garde comparait le frais à ce qu'il venait lui-même d'écraser.
// La circularité n'a pas besoin de ça : le bundle COMMITÉ suffit à charger le transpileur. Il est
// peut-être périmé pour d'autres librairies, mais un fichier de librairie ne déclare aucun `core`
// et n'a donc besoin d'AUCUN vocabulaire pour être lu.
const { compileToBPxAST } = await import('./index.js');
await collectBps(LIB_DIR, '', compileToBPxAST);

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

for (const [name, data] of Object.entries(libs)) {
  // NB : lib/tuning.json (162 gammes plates Bernard, ex-legacy) a été RETIRÉ (fichier mort,
  // runtime-inconsommé — ses ratios vivent dans temperaments.json en grilles bp3_*). Provenance
  // conservée : scripts/convert-tonality.js documente le mapping BP3 -to.* → gammes.
  output += `LIBS["${name}"] = ${JSON.stringify(data)};\n\n`;
}

output += 'export { LIBS };\n';

process.stdout.write(output);
