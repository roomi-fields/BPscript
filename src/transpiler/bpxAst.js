// bpxAst.js — Production de l'AST BPx (mode PROPRE, sans l'ancien format BP3).
//
// POURQUOI (directive Romain 2026-06-17). Deux modes / deux sorties TOTALEMENT
// SÉPARÉS, pour la cohérence, la propreté et la performance :
//   - `compileBPS()` (index.js) = ancienne voie : parse + ENCODE → grammaire BP3.
//     Fonction héritée (voie 2), vouée à être supprimée dans les prochaines versions.
//   - `compileToBPxAST()` (ici)  = voie AST BPx : produit UNIQUEMENT l'arbre, COMPLET,
//     **sans JAMAIS appeler le code de l'ancien format** (aucun import d'`encoder.js`).
//
// SOURCE UNIQUE = l'arbre, ZÉRO table parallèle (directive Romain 2026-06-17, confirmée
// BPx + Kanopi). Avant, l'encodeur BP3 déposait au passage les étiquettes de backtick et
// des tables latérales (backticks/flagStates/libraries) — vues redondantes (vestiges BP3),
// supprimées. Ce module ne fait que l'ANNOTATION DES BACKTICKS SUR LE NŒUD (étiquette
// `_btName` + `interp`), sans le traducteur BP3 ; tout le reste vit déjà dans l'arbre.
//
// L'AST porte déjà (depuis le parser) : payload par token (nature/actor/params/flux) +
// références d'acteur canoniques (ActorReference[]). Les consommateurs lisent directement
// les nœuds/directives (backticks sur le nœud ; @flag/@library/@scene/@mm dans les directives).

import { tokenize } from './tokenizer.js';
import { parse, ParseError } from './parser.js';
import { loadLibsFromDirectives } from './libs.js';
import { validateControls } from './controlValidation.js';
import { validateModulation } from './modulationValidation.js';

/**
 * Annote les backticks (voix de code) SUR LE NŒUD — pas de table parallèle (directive
 * Romain 2026-06-17, confirmée BPx + Kanopi). Chaque nœud backtick porte :
 *   - `_btName` : étiquette unique (compteur PROPRE, ordre du document, indépendant de
 *     l'ancien format). C'est le NOM du terminal dérivable, lu par BPx (loadGrammar.ts).
 *   - `code`    : déjà posé par le parser.
 *   - `interp`  : l'interpréteur. Tag explicite (`sc:`, `py:`…) sinon 'auto' ; un backtick
 *     NON tagué hérite de l'`eval` de l'acteur en tête de sa règle (`drums -> ` `` `…` `` ``
 *     avec `@actor drums eval.strudel` → 'strudel'). Posé sur le nœud → le nœud est
 *     auto-suffisant ; aucun index séparé. BPx l'ignore (charge opaque) ; le sink Kanopi le lit.
 */
function annotateBackticks(ast) {
  let counter = 0;
  const isBt = (el) => el && (el.type === 'BacktickStandalone' || el.type === 'BacktickInline');
  // 1. Étiquette + interp initial (tag ou 'auto').
  const label = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== 'object') continue;
      if (isBt(el)) { el._btName = `BT${el.tag || 'auto'}${counter++}`; el.interp = el.tag || 'auto'; }
      if (el.elements) label(el.elements);
      if (el.voices) for (const v of el.voices) label(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) label(rule.rhs);

  // 2. Résolution 'auto' → eval de l'acteur en tête de règle.
  const actorEval = {};
  for (const a of ast.actors || []) if (a.properties && a.properties.eval) actorEval[a.name] = a.properties.eval;
  const lhsHead = (lhs) => { const h = Array.isArray(lhs) ? lhs[0] : lhs; return h && h.name ? h.name : null; };
  const resolve = (els, evalKey) => {
    for (const el of els || []) {
      if (!el || typeof el !== 'object') continue;
      if (isBt(el) && el.interp === 'auto') el.interp = evalKey;
      if (el.elements) resolve(el.elements, evalKey);
      if (el.voices) for (const v of el.voices) resolve(v, evalKey);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) {
    const evalKey = actorEval[lhsHead(rule.lhs)];
    if (evalKey) resolve(rule.rhs, evalKey);
  }
}

/**
 * Produit l'AST BPx depuis le source `.bps`, SANS l'ancien format BP3 et SANS table
 * parallèle : tout vit DANS L'ARBRE (source unique, directive Romain 2026-06-17).
 * Les consommateurs lisent directement les nœuds/directives :
 *   - backticks → nœuds (`_btName`, `code`, `interp`) ;
 *   - drapeaux nommés → directives `@flag` (FlagStatesDirective) ;
 *   - librairies → directives `@library` (LibraryDirective) ;
 *   - scènes/expose/map/tempo → `ast.scenes` / `ast.exposes` / `ast.maps` / `@mm` ;
 *   - acteurs (transport/alphabet/eval) → `ast.actors[].references` (ActorReference) ;
 *   - payload par token (nature/actor/params/flux) → posé par le parser.
 *
 * Défauts d'environnement (point 1, spec-ecriture-structure §A) : la transpilation
 * prend un `environnement` (réglé dans Kanopi, fourni en entrée). Pour chaque réglage
 * ABSENT de la scène, BPScript inscrit le défaut EN DUR dans l'AST (l'AST se suffit ;
 * Kanopi ne touche jamais l'AST ; changer un défaut = re-transpiler). Cf.
 * applyEnvironmentDefaults.
 * @param {string} source
 * @param {{ tempo?: number, octave?: any, division?: any }} [environnement] défauts portés par Kanopi
 * @returns {{ ast, errors, warnings }}
 */
/**
 * Inscrit les défauts d'ENVIRONNEMENT dans l'AST là où la scène ne déclare rien
 * (point 1, spec-ecriture-structure §A — décision archi validée Romain 2026-06-24).
 *
 * - Le défaut est inscrit EN DUR (pas une référence « va voir l'environnement plus
 *   tard ») : l'AST se suffit, le moteur dérive depuis une structure complète.
 * - Mécanisme GÉNÉRAL (un seul pour tout défaut), piloté par table.
 * - On ne câble QUE les défauts qui ont un vrai consommateur en aval (sinon on
 *   écrirait une cible que personne ne lit). Aujourd'hui : le TEMPO, lu par l'hôte
 *   et BPx via la directive `@mm` (Kanopi mmFromAst ; BPx loadGrammar). Les autres
 *   réglages (octave, division…) s'ajouteront ici dès que leur cible AST + lecteur
 *   seront définis.
 *
 * @param {object} ast  AST de scène (muté en place)
 * @param {{ tempo?: number }} [env]  défauts d'environnement portés par Kanopi
 */
function applyEnvironmentDefaults(ast, env) {
  if (!ast || !env || typeof env !== 'object') return;

  // tempo → directive `@mm` (la SEULE directive de tempo lue en aval). On n'inscrit
  // le défaut que si la scène ne déclare AUCUN tempo (`@mm` ou `@tempo`).
  if (env.tempo != null && !hasTempoDirective(ast)) {
    (ast.directives = ast.directives || []).push({
      type: 'Directive',
      name: 'mm',
      subkey: null,
      runtime: null,
      value: env.tempo,
      aliases: null,
      modifiers: null,
      fromEnvironment: true,   // provenance : défaut d'environnement, pas déclaré dans la source
      line: 0,
    });
  }
}

/** Vrai si la scène déclare déjà un tempo (directive `@mm` ou `@tempo`). */
function hasTempoDirective(ast) {
  return (ast.directives || []).some(
    (d) => d && d.type === 'Directive' && (d.name === 'mm' || d.name === 'tempo')
  );
}

// LAN-5 / KAI-9 : transport par défaut de l'acteur IMPLICITE (quand la scène ne déclare
// aucun @actor). CONSTANTE À DÉPLACER en conf éditable Kanopi (idéal LAN-5) ; minimal
// acceptable KAI-9 = constante CLAIREMENT marquée, mais portée DANS L'AST (plus côté hôte).
const DEFAULT_ACTOR_TRANSPORT = 'audio'; // TODO LAN-5 : lire depuis la conf Kanopi

/**
 * Matérialise l'acteur IMPLICITE `default` DANS L'AST quand la scène ne déclare AUCUN
 * @actor (cas `.bps` simple, `.gr`, cv-adsr) — LAN-5, validé Romain 2026-06-26.
 *
 * POURQUOI : KAI-9 supprime la résolution hôte. Avant, l'hôte (kanopi bpx-adapter.ts)
 * injectait un acteur synthétique `{name:'default', transport:audio}` quand aucun @actor
 * n'était déclaré, pour qu'une scène simple emprunte le MÊME chemin orchestré qu'une scène
 * multi-acteurs (mono = orchestration à un acteur). On REMONTE ce défaut dans l'AST : BPx
 * ne fait que le PORTER, il ne l'invente plus ; l'hôte cesse de le synthétiser.
 *
 * L'acteur implicite N'A PAS d'alphabet (honnête) : la résolution pitch tombe sur le
 * résolveur de scène (qui renifle western/solfège depuis les tokens). Marqué `synthetic:true`
 * pour que l'aval le distingue d'un acteur déclaré (le panneau Acteurs reste vide).
 *
 * @param {object} ast  AST de scène (muté en place)
 */
function applyDefaultActor(ast) {
  if (!ast) return;
  if ((ast.actors || []).length > 0) return; // au moins un @actor déclaré → rien à faire
  const transport = { type: 'TransportRef', key: DEFAULT_ACTOR_TRANSPORT, params: {} };
  ast.actors = [{
    type: 'ActorDirective',
    name: 'default',
    properties: { transport }, // pas d'alphabet : pitch via le résolveur de scène
    references: [
      { type: 'ActorReference', category: 'transport', name: DEFAULT_ACTOR_TRANSPORT, line: 0 },
    ],
    soundAssignments: null,
    synthetic: true, // acteur implicite (aucun @actor déclaré) — panneau Acteurs vide
    line: 0,
  }];
}

export function compileToBPxAST(source, environnement) {
  const result = { ast: null, errors: [], warnings: [] };
  try {
    const ast = parse(tokenize(source), { onWarning: (w) => result.warnings.push(w) });
    annotateBackticks(ast);   // _btName + interp posés SUR LES NŒUDS
    applyEnvironmentDefaults(ast, environnement);  // défauts d'environnement → AST (point 1)
    applyDefaultActor(ast);   // acteur implicite `default` si aucun @actor (LAN-5 / KAI-9)
    result.ast = ast;

    // Validation sémantique des valeurs de contrôle contre la lib @controls
    // (source unique des valeurs/plages permises). Erreurs non fatales : l'AST reste
    // produit, Kanopi affiche les erreurs en rouge à l'éval. Cf. controlValidation.js.
    const directives = [
      ...(ast.directives || []),
      ...((ast.scenes || []).flatMap((s) => s.directives || [])),
    ];
    const libCtx = loadLibsFromDirectives(directives);
    result.errors.push(...validateControls(ast, libCtx.controls));
    result.errors.push(...validateModulation(ast, libCtx));
  } catch (e) {
    if (e instanceof ParseError) result.errors.push({ message: e.message, line: e.token && e.token.line });
    else throw e;
  }
  return result;
}

export default compileToBPxAST;
