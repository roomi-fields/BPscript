/**
 * LE VOCABULAIRE DU LANGAGE — la porte d'éditeur, DÉRIVÉE de la porte des objets.
 *
 * Arbitrage de Romain, 2026-09-03 : « la porte des objets EST la porte d'éditeur ; `describeVocabulary()`
 * se dérive d'elle ou sort ». Elle se dérive : ce que l'éditeur propose, colore et complète est ce
 * que les librairies déclarent, lu par la même porte que tout le monde (`bpscript/objets`), jamais
 * par un chemin de fichier ni une forme de catalogue.
 *
 * Ce qui vient de la PORTE : les voix (la famille `voice`), les entrées de chaque axe de catalogue
 * (un axe est une famille), les fonctions (la famille `function`). Ce qui vient encore du CONTEXTE
 * des librairies invoquées (`loadLibsFromDirectives`) : les mots de tête, les contrôles avec leurs
 * défauts résolus, les valeurs, les clés d'adresse, les clés de crochet — parce que l'interface et
 * ses réalisations, le défaut d'environnement et le schéma de `core` ne sont pas encore des objets
 * de la porte (points 3 et 4 de Romain, en attente). Le jour où ils le sont, cette moitié suit.
 *
 * DEUX QUESTIONS, DEUX PORTÉES : sans directives, « quel est le vocabulaire du langage ? » — le
 * catalogue entier, ce que l'éditeur affiche ; avec directives, « qu'est-ce que CETTE scène a le
 * droit d'écrire ? » — les seules librairies qu'elle invoque (Romain, 2026-08-08 : « invoquer
 * commande, systématiquement »).
 *
 * @param {Array} [directives]  les directives de la scène (acteurs compris), ou rien.
 * @returns {{
 *   voices: string[],
 *   keywords: string[],                       // mots de tête : le langage, et ce que les librairies invoquées déclarent en portée scène
 *   controls: Array<{name, args?, range?, values?, value?, description?, resolvedBy?}>,  // `value` : ce que le contrôle vaut quand personne ne l'écrit ; `resolvedBy` : QUI le réalise
 *   values:   Array<{name, range?, unit?, values?, description?}>,
 *   functions: string[],
 *   components: { [axis:string]: string[] },  // les entrées de chaque axe de catalogue
 *   addressKeys: string[],
 *   qualifierKeys: string[],
 *   directiveValues: { [directive:string]: {description?, values: [{name, description?}]} },
 *   syntaxWords: { [word:string]: {kind, description?, syntax?} }
 * }}
 */
import { famille, axesDeCatalogue, objets } from './index-des-objets.js';
import { loadLibsFromDirectives, leRegistre } from './libs.js';
// ⛔ LE SCHÉMA DE SYNTAXE SE LIT PAR SA PROPRE PORTE — il a quitté `lib/` le 2026-08-21 (décision
// Romain du 2026-08-20) : ce n'est pas une librairie, il porte ce que le LANGAGE EST, et sa porte
// refuse de se publier vide.
import { SYNTAXE } from './syntaxe-data.js';

/**
 * Les noms des entrées d'une famille qui ENTRENT DANS L'AIDE PUBLIÉE — `documented`, lu chez le
 * contributeur de chaque entrée (Romain, 2026-09-02 : `test_alphabets` reste publié, non documenté :
 * ses huit alphabets se compilent et ne se proposent pas). Dans l'ordre de la donnée ; vide si
 * personne ne déclare la famille.
 */
const nomsDe = (mot) => {
  const f = famille(mot);
  return f ? f.entrees.filter((e) => e.documented).map((e) => e.nom) : [];
};

const pick = (def, keys) => {
  const o = {};
  for (const k of keys) if (def[k] !== undefined) o[k] = def[k];
  return o;
};

export function describeVocabulary(directives = []) {
  const aUneScene = Array.isArray(directives) && directives.length > 0;
  const allDirs = aUneScene ? directives : Object.keys(leRegistre()).map((name) => ({ name }));
  const ctx = loadLibsFromDirectives(allDirs);
  // Un axe de catalogue est une famille : ses entrées sont ce que la scène peut nommer après le point.
  const components = {};
  for (const axis of axesDeCatalogue()) components[axis] = nomsDe(axis);
  return {
    voices: nomsDe('voice'),
    keywords: [...ctx.reservedDirectiveNames],
    controls: Object.entries(ctx.controls).map(([name, def]) =>
      ({ name, ...pick(def || {}, ['args', 'range', 'values', 'value', 'description', 'resolvedBy']) })),
    values: Object.entries(ctx.valueRegistry).map(([name, spec]) =>
      ({ name, ...pick(spec || {}, ['range', 'unit', 'values', 'description']) })),
    // ⛔ UNE FONCTION EST UN MOT QUI PORTE SON CORPS — arbitrage de Romain, 2026-09-03 : une
    // manipulation est un contrôle du langage, et son corps se rattache à lui (`lib/transpo/
    // transpose.ts`). La famille `function` a disparu avec cette forme ; l'éditeur propose donc
    // les mots qui portent une réalisation, quelle que soit la librairie qui les déclare.
    // Une manipulation porte SES PARAMÈTRES avec son corps ; une table d'homomorphisme hérite le
    // corps de son applicateur sans en être une — elle est la donnée sur laquelle il travaille.
    functions: objets()
      .filter((o) => o.documented && typeof o.membres.body === 'string' && o.membres.params)
      .map((o) => o.nom),
    components,
    addressKeys: [...ctx.addressKeys],
    qualifierKeys: [...ctx.qualifierKeys],
    directiveValues: SYNTAXE.directiveValues || {},
    syntaxWords: SYNTAXE.syntaxWords || {},
  };
}
