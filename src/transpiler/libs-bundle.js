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
// L'authoring est un VRAI .ts TYPÉ (F1, contre @kairos/core, vérifié par `npm run typecheck:digital`) ;
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
// Une librairie se dit dans le langage qu'elle sert : `lib/<nom>.bpsl` porte ses contrôles en `@def`,
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
//   · le `@def` qui porte le NOM DU FICHIER déclare le fichier — resolvedBy, name, description ;
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
const CLES_LISTES = new Set(['args', 'values', 'scope', 'range']);
const CHAMPS_DE_FICHIER = new Set(['resolvedBy', 'resolves', 'name', 'description', 'version', 'type']);

function valeurDeCle(v) {
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
// BUNDLE pour son vocabulaire. Écrire un petit lecteur de `@def` ici règlerait la boucle en une
// minute — et créerait une SECONDE GRAMMAIRE, exactement ce que la demande de Romain exclut :
// « je veux que ton interpréteur interprète le contenu des librairies de la même façon qu'il
// interprète le contenu des scènes ».
// On écrit donc d'abord le bundle des `.json` SEULS sur le disque, puis on charge le transpileur —
// qui trouve alors un bundle valide — et on relit les `.bps` avec LUI. Un seul interprète, deux passes.
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
    for (const d of (r.ast.directives || [])) {
      if (d.type !== 'DefDirective' || !d.keys) continue;
      // ⛔ UNE CLÉ `section` DIT OÙ LE MOT SE RANGE — posée le 2026-08-14 pour la bascule d'`engine`.
      // Les cinq premières librairies n'avaient qu'une section, `controls`. `engine` en porte QUATRE :
      // `controls`, `engine`, `subgrammar` et `schema.reservedDirectives`. Sans ce mot, la conversion
      // les FUSIONNERAIT en une seule et changerait la donnée — quatre lecteurs de mon propre `src/`
      // les distinguent, et le garde des graphies natives balaye les trois premières nommément.
      // ⚠️ CE N'EST PAS UNE FORME DU LANGAGE, c'est une correspondance de LECTURE : `section` est une
      // clé ordinaire de `@def`, que le langage accepte déjà, et rien de nouveau ne s'écrit dans une
      // scène. Même geste que l'absence d'`args` qui vaut liste vide. La preuve reste l'ÉGALITÉ du
      // paquet avant et après, pas ce raisonnement.
      // Le chemin est POINTÉ : `schema.reservedDirectives` se lit comme une descente.
      const chemin = d.keys && d.keys.section ? valeurDeCle(d.keys.section) : 'controls';
      let cible;
      if (d.name === entry.replace('.bpsl', '')) {
        cible = lib;
      } else {
        let ou = lib;
        const parts = String(chemin).split('.');
        for (const seg of parts) { ou[seg] = ou[seg] || {}; ou = ou[seg]; }
        cible = (ou[d.name] = {});
      }
      for (const [cle, v] of Object.entries(d.keys)) {
        if (cle === 'section') continue;   // elle ROUTE, elle ne se publie pas
        let val = valeurDeCle(v);
        if (CLES_LISTES.has(cle) && !Array.isArray(val)) val = [val];
        if (cible === lib && !CHAMPS_DE_FICHIER.has(cle)) {
          console.error(`[bundle] ⛔ lib/${entry} : '${cle}' n'est pas un champ de FICHIER `
            + `(${[...CHAMPS_DE_FICHIER].join(', ')}). Un contrôle se déclare par son propre '@def'.`);
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
// peut-être périmé pour d'autres librairies, mais un fichier de librairie ne déclare aucun `@core`
// et n'a donc besoin d'AUCUN vocabulaire pour être lu.
const { compileToBPxAST } = await import('./index.js');
await collectBps(LIB_DIR, '', compileToBPxAST);

// Output as ES module
let output = '// Auto-generated by libs-bundle.js — do not edit\n';
output += '// Contains all lib/*.json data for browser use\n\n';
output += 'const LIBS = {};\n\n';

for (const [name, data] of Object.entries(libs)) {
  // NB : lib/tuning.json (162 gammes plates Bernard, ex-legacy) a été RETIRÉ (fichier mort,
  // runtime-inconsommé — ses ratios vivent dans temperaments.json en grilles bp3_*). Provenance
  // conservée : scripts/convert-tonality.js documente le mapping BP3 -to.* → gammes.
  output += `LIBS["${name}"] = ${JSON.stringify(data)};\n\n`;
}

output += 'export { LIBS };\n';

process.stdout.write(output);
