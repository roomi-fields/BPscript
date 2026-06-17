// bpxAst.js — Production de l'AST BPx (mode PROPRE, sans l'ancien format BP3).
//
// POURQUOI (directive Romain 2026-06-17). Deux modes / deux sorties TOTALEMENT
// SÉPARÉS, pour la cohérence, la propreté et la performance :
//   - `compileBPS()` (index.js) = ancienne voie : parse + ENCODE → grammaire BP3.
//     Fonction héritée (voie 2), vouée à être supprimée dans les prochaines versions.
//   - `compileToBPxAST()` (ici)  = voie AST BPx : produit UNIQUEMENT l'arbre, COMPLET,
//     **sans JAMAIS appeler le code de l'ancien format** (aucun import d'`encoder.js`).
//
// Avant, l'AST n'était « complet » que parce que l'encodeur BP3 tournait et y déposait
// au passage les étiquettes de backtick (`_btName`) + les tables (backticks/flagStates/
// libraries). Dépendance cachée supprimée : ces annotations sont faites ICI, en passes
// agnostiques, sans le traducteur BP3.
//
// L'AST porte déjà (depuis le parser) : payload par token (nature/actor/params/flux),
// références d'acteur canoniques (ActorReference[]). Ce module ajoute ce qui restait
// produit par l'encodeur, de façon agnostique.

import { tokenize } from './tokenizer.js';
import { parse, ParseError } from './parser.js';

/**
 * Étiquetage des backticks (voix de code) : assigne `_btName` à chaque nœud backtick
 * et remplit la table `backticks[_btName] = { interp, code }`. Compteur PROPRE (ordre
 * du document) — indépendant de tout compteur d'alphabet de l'ancien format. Le nom
 * sert de terminal dérivable par BPx ; il est corrélé à la table par le sink (Kanopi).
 */
function labelBackticks(ast, backticks) {
  let counter = 0;
  const walk = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== 'object') continue;
      if (el.type === 'BacktickStandalone' || el.type === 'BacktickInline') {
        const tag = el.tag || 'auto';
        const name = `BT${tag}${counter++}`;
        el._btName = name;
        backticks[name] = { interp: tag, code: el.code };
      }
      if (el.elements) walk(el.elements);
      if (el.voices) for (const v of el.voices) walk(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) walk(rule.rhs);
}

/**
 * Résolution de l'interpréteur des backticks NON tagués (`interp:'auto'`) : ils héritent
 * de l'`eval` de l'acteur en tête de leur règle (`drums -> ` `` `…` `` `` avec
 * `@actor drums eval.strudel` → interp 'strudel'). Le tag explicite n'est pas touché.
 */
function resolveBacktickInterp(ast, backticks) {
  const actorEval = {};
  for (const a of ast.actors || []) {
    if (a.properties && a.properties.eval) actorEval[a.name] = a.properties.eval;
  }
  const lhsHead = (lhs) => { const h = Array.isArray(lhs) ? lhs[0] : lhs; return h && h.name ? h.name : null; };
  const walk = (els, evalKey) => {
    for (const el of els || []) {
      if (!el || typeof el !== 'object') continue;
      if (el._btName && backticks[el._btName] && backticks[el._btName].interp === 'auto') {
        backticks[el._btName].interp = evalKey;
      }
      if (el.elements) walk(el.elements, evalKey);
      if (el.voices) for (const v of el.voices) walk(v, evalKey);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) {
    const evalKey = actorEval[lhsHead(rule.lhs)];
    if (evalKey) walk(rule.rhs, evalKey);
  }
}

/** États de drapeau nommés : { flag → { alias → entier } } (depuis @flag). */
function buildFlagStates(ast) {
  const flagStates = {};
  for (const dir of ast.directives || []) {
    if (dir.type === 'FlagStatesDirective') {
      const m = flagStates[dir.flag] || {};
      for (const s of dir.states) m[s.name] = s.value;
      flagStates[dir.flag] = m;
    }
  }
  return flagStates;
}

/** Librairies de runtime (@library.<moteur> "nom") : { moteur → [noms] }. */
function buildLibraries(ast) {
  const libraries = {};
  for (const dir of ast.directives || []) {
    if (dir.type === 'LibraryDirective') {
      (libraries[dir.engine] = libraries[dir.engine] || []).push(dir.name);
    }
  }
  return libraries;
}

/**
 * Produit l'AST BPx COMPLET depuis le source `.bps`, SANS l'ancien format BP3.
 * @param {string} source
 * @returns {{ ast, backticks, flagStates, libraries, errors, warnings }}
 *   - `ast`        : arbre de scène (payload par token, ActorReference[], _btName posés)
 *   - `backticks`  : { _btName → { interp, code } } (corrélé au sink Kanopi)
 *   - `flagStates` : { flag → { alias → entier } }
 *   - `libraries`  : { moteur → [noms] }
 */
export function compileToBPxAST(source) {
  const result = { ast: null, backticks: {}, flagStates: {}, libraries: {}, errors: [], warnings: [] };
  try {
    const ast = parse(tokenize(source), { onWarning: (w) => result.warnings.push(w) });
    result.ast = ast;
    labelBackticks(ast, result.backticks);     // _btName + table backticks
    resolveBacktickInterp(ast, result.backticks); // interp 'auto' → eval acteur
    result.flagStates = buildFlagStates(ast);
    result.libraries = buildLibraries(ast);
  } catch (e) {
    if (e instanceof ParseError) result.errors.push({ message: e.message, line: e.token && e.token.line });
    else throw e;
  }
  return result;
}

export default compileToBPxAST;
