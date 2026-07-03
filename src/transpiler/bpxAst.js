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
// `_btName` en tête + `payload.interp`), sans le traducteur BP3 ; tout le reste vit déjà dans l'arbre.
//
// L'AST porte déjà (depuis le parser) : payload par token (nature/actor/params/flux) +
// références d'acteur canoniques (ActorReference[]). Les consommateurs lisent directement
// les nœuds/directives (backticks sur le nœud ; @flag/@library/@scene/@mm dans les directives).

import { tokenize } from './tokenizer.js';
import { parse, ParseError } from './parser.js';
import { loadLibsFromDirectives } from './libs.js';
import { resolveActors } from './actorResolver.js';
import { validateControls } from './controlValidation.js';
import { validateModulation } from './modulationValidation.js';

/**
 * Annote les backticks (voix de code) SUR LE NŒUD — pas de table parallèle (directive
 * Romain 2026-06-17, confirmée BPx + Kanopi). Chaque nœud backtick porte :
 *   - `_btName` : étiquette unique (compteur PROPRE, ordre du document, indépendant de
 *     l'ancien format). C'est le NOM du terminal dérivable, lu par BPx (loadGrammar.ts) ;
 *     identité STRUCTURELLE en tête de nœud.
 *   - `code`    : déjà posé par le parser.
 *   - `payload` : DONNÉE D'ÉVÉNEMENT de la voix de code (KAI-9, point de bascule unique aligné
 *     bpx + Kairos) — `{ nature:'code', interp }`. L'`interp` est l'interpréteur : tag explicite
 *     (`sc: …`, `py: …`) sinon 'auto' ; un backtick NON tagué hérite de l'`eval` de l'acteur en
 *     tête de sa règle (`@actor drums eval.strudel` → 'strudel'). Scellé DANS LE PAYLOAD (pas en
 *     tête de nœud) : c'est ce qui VOYAGE dans la dérivation jusqu'à Kairos, qui matérialise
 *     event.output = { runtime:'code', device:interp }. BPx porte le payload opaque ; Kairos le lit.
 */
function annotateBackticks(ast) {
  let counter = 0;
  const isBt = (el) => el && (el.type === 'BacktickStandalone' || el.type === 'BacktickInline');
  // 1. Étiquette + payload de voix de code (nature:'code' + interp initial : tag ou 'auto').
  //    L'interp est scellée DANS LE PAYLOAD (payload.interp), pas en tête de nœud : c'est la
  //    donnée d'événement qui VOYAGE dans la dérivation jusqu'à Kairos (qui matérialise
  //    event.output = {runtime:'code', device:interp}). Point de bascule unique, aligné bpx/Kairos.
  const label = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== 'object') continue;
      if (isBt(el)) {
        el._btName = `BT${el.tag || 'auto'}${counter++}`;
        el.payload = { ...(el.payload || {}), nature: 'code', interp: el.tag || 'auto' };
      }
      if (el.elements) label(el.elements);
      if (el.voices) for (const v of el.voices) label(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) label(rule.rhs);

  // 2. Résolution 'auto' → eval de l'acteur en tête de règle (sur payload.interp).
  const actorEval = {};
  for (const a of ast.actors || []) if (a.properties && a.properties.eval) actorEval[a.name] = a.properties.eval;
  // Tête de règle = premier atome NON NIÉ (un `#X` inline de tête est un contexte,
  // pas la tête — préparé P3, flip Palier 4 ; inerte tant que le flip n'émet rien).
  const lhsHead = (lhs) => {
    const els = Array.isArray(lhs) ? lhs : [lhs];
    const h = els.find((e) => e && e.negated !== true);
    return h && h.name ? h.name : null;
  };
  const resolve = (els, evalKey) => {
    for (const el of els || []) {
      if (!el || typeof el !== 'object') continue;
      if (isBt(el) && el.payload && el.payload.interp === 'auto') el.payload.interp = evalKey;
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
 *   - backticks → nœuds (`_btName`, `code` en tête ; `payload.interp` + `payload.nature:'code'`) ;
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

// ============================================================================
// Frontière AST (Palier 3, décision architecte 2026-07-02) — canonicalisation
// des CONTEXTES pour la voie BPx SEULE. parser.js/encoder.js restent INTACTS :
// la sortie BP3 héritée (compileBPS) est GELÉE (le texte .grammar est l'oracle
// de parité), or la forme canonique RHS jette le nom du symbole nié (`#a` →
// joker nié) et changerait ce texte. D'où la transformation ICI — compileToBPxAST
// est la couche d'émission BPx de BPScript ; compileBPS ne passe jamais par elle.
//
// RÉPLIQUE À L'IDENTIQUE la catégorisation de l'adaptateur BPx vivant
// (injectParserContext + normaliseLhs/RhsWildcardToVariable, loadGrammar.ts:
// 2607-2909), ancrée moteur (Encode.c:991-999 ; Compute.c:2014-2019) :
//
//   INLINE (mécanisme A — négation de symbole, AST_SPEC §1.2.1) :
//     tête/mi-LHS `#X`  → Symbol{name, negated:true}  (consommé en place)
//     tête/mi-LHS `#?`  → Wildcard{negated}  ;  `#?N` → Variable{index, negated}
//     RHS `#X`/`#?`/`#?N` → Wildcard{negated:true} — le NOM est JETÉ : le moteur
//       saute la paire qui suit le `#` (i+=2) et ne le lit jamais sur le RHS ;
//       c'est déjà la conversion de l'adaptateur (« symbol name is discarded »).
//
//   REMOTE (mécanisme B — RuleContextAST sur rule.contexts) :
//     `(X)` / `(X Y)` / `#(X Y)` de tête → reste sur rule.contexts, enrichi
//       `elements` TYPÉS (canonique) + GARDE `symbols` (@deprecated) en MIROIR
//       transitoire : le BPx vivant pré-Palier-4 lit encore `symbols` → la
//       parité reste verte avec l'adaptateur en place (double-émission).
//     mi-LHS → ContextAST{negated, elements} EN PLACE (la position porte le
//       routage gauche/droite de compileLhsPattern ; pas de miroir : la branche
//       pass-through de l'adaptateur déclenche sur `elements` présent).
//
// Idempotence de l'adaptateur sur ces formes (vérifiée sur pièces) : Symbol/
// Wildcard/Variable traversent inchangés ; Context avec `elements` → branche (a)
// pass-through ; les entrées rule.contexts sont relues via le miroir `symbols`.
// Hors périmètre (répliqué à l'identique de l'adaptateur) : corps de gabarits
// `${...}` (l'adaptateur ne récurse que dans Polymetric.voices pour les AST
// BPScript) ; formes RHS non mono-négatives (l'adaptateur lève la même erreur
// explicite qu'aujourd'hui) ; corps de macro (aucun consommateur BPx).
//
// ⚠️ FLIP INLINE = PALIER 4 UNIQUEMENT (interrupteur INLINE_FLIP_PALIER4 ci-
// dessous, OFF). La vérification adverse 4-lentilles (2026-07-02, workflow
// wf_38cf2d78) a RÉFUTÉ l'équivalence du flip inline PRÉ-Palier-4 sur le langage
// général (le corpus, lui, est byte-identique — angle mort). 4 divergences
// CONFIRMÉES par exécution A/B, qui sont autant de PRÉREQUIS du flip :
//   P1. Découpeur d'alphabet mono-caractère : BPx splitte AVANT d'adapter les
//       contextes (loadGrammar.ts:2501 puis :2502) et ne coupe que les Symbol
//       nus → un `#ab` émis inline en amont est découpé (¬a b) alors qu'il
//       restait atomique en Context. → BPx doit ignorer les Symbol niés au
//       split (ou réordonner ses passes) AVANT le flip.
//   P2. Ordre source des contextes de tête : l'adaptateur pré-préfixe
//       rule.contexts DEVANT un LHS déjà préfixé → un remote qui SUIT un
//       inline dans la source lui passe devant (bascule contexte droit→gauche
//       prouvée : « W A B Q » vs « P A B W » ; règles hier rejetées au
//       chargement qui dérivent). → au flip, calculer la séquence/`side`
//       depuis l'ordre SOURCE (un remote de tête peut être un contexte DROIT
//       quand le motif est vide — d'où `side` OMIS dans l'enrichissement).
//   P3. Lecteurs de tête côté BPScript : annotateBackticks (lhsHead, ci-
//       dessous) et modulationValidation.js:35 identifient la règle par
//       lhs[0].name → un atome nié préfixé masque l'acteur (interp
//       'strudel'→'auto') et les erreurs de modulation. → leur apprendre à
//       sauter les atomes niés de tête AVANT le flip.
//   P4. Kanopi bpx-adapter.ts:550 (table de backticks par lhs[0].name) : même
//       correction que P3, côté hôte.
// ============================================================================

// Interrupteur du flip INLINE (mécanisme A émis par le frontal). BASCULÉ au
// top C [271] (2026-07-03), étape B de bpx landée verte (B1 4988425 bascule
// rule.contexts→left/rightContext + B2 7360983 retraits + shim 3-formes).
// Prérequis réglés : P1 = découpeur A/A-bis (le #ab nié tombe au longest-match
// via splitCompoundTerminals, oracle [258]/[261]) ; P2 = side/séquence depuis
// l'ordre SOURCE (ci-dessous) ; P3 = lecteurs de tête posés (inertes → actifs) ;
// P4 = kanopi posé (9d88b3f, cf. [259]).
const INLINE_FLIP_PALIER4 = true;

// ============================================================================
// DÉCOUPEUR frontal des terminaux composés — alphabet mono-caractère
// (flip Palier 4, ÉTAPE A — arbitrage 2 Romain : « le frontal émet les atomes »)
//
// Port de la tokenisation `GetBols`/`SEARCHTERMINAL2` (Encode.c:888-918,
// longest-match sur la table des bols) pour le cas alphabet mono-caractère,
// À L'ÉMISSION (voie BPx seule — compileBPS/encoder.js gelés intacts). Oracle
// natif rendu ([258], constat hashab-monochar) : le longest-match gouverne —
// sous un alphabet dont TOUS les terminaux font 1 caractère, une chaîne
// composée `abca` s'apparie a·b·c·a (4 tokens) ; un bol multi-caractères
// déclaré (`ek`) reste ATOMIQUE (le plus long match à sa 1re lettre est le
// bol lui-même).
//
// Même charpente que le splitter de l'adaptateur BPx vivant (loadGrammar.ts
// splitRule/Lhs/RhsCompoundTerminals:2255-2418 + makeSplitSymbol:2425-2448),
// qui devient un NO-OP structurel sur les chaînes pur-terminales (après
// découpe, plus aucun Symbol composé de terminaux ne l'atteint) — idempotence.
// DEUX différences de principe, voulues : (1) RÉALIGNEMENT NATIF A-bis (accord
// architecte 2026-07-03, preuves natives bp3-engine) : une chaîne MIXTE
// (`abXa`, `ab4`) n'est PLUS laissée intacte — split glouton des terminaux
// puis reste tokenisé BP3 (variable/nombre), cf. tokenizeCompoundName ;
// l'adaptateur vivant (qui la laisse intacte) est INFIDÈLE au natif sur ce
// point — son prédicat ne re-découpe pas mes variables émises (noms à
// majuscule ∉ terminaux) ni les NumericDuration → toujours no-op derrière moi.
// (2) la PORTE n'est plus un hardcode
// `{abc: a..z}` (déviation « transport » documentée côté BPx : l'AST ne
// portait pas la liste de notes) — ICI la liste est dans les libs, donc la
// porte se DÉRIVE des données : découpe ssi la scène déclare des alphabets
// dont TOUS les terminaux GÉNÉRÉS font 1 caractère (libCtx.alphabetTerminals,
// libs.js). En extension aujourd'hui : seule `abc` qualifie (western génère
// C4/D#5… multi-char via les octaves ; structural/conway/kathak… multi) —
// porte ≡ celle de BPx, sans hardcode (règle feedback_no_hardcode).
//
// Position pipeline : EN FIN d'émission, APRÈS annotateBackticks et les
// validations — comme aujourd'hui où la découpe se produit en aval (dans BPx),
// mes lecteurs de tête et validateurs voient l'AST NON découpé (aucun
// changement de comportement pour eux). Hors périmètre (identique au splitter
// vivant) : SymbolCall (référence d'instance, jamais découpée), noms de
// contextes `#ab` (restent des nœuds Context bruts pré-flip-C ; leur découpe
// oracle ¬a·b tombera du flip C : Context→Symbol nié PUIS ce découpeur).
// ============================================================================

/** Porte : Set des terminaux si TOUS les terminaux d'alphabet générés font
 * 1 caractère (alphabet mono-char), null sinon (aucune découpe). */
function singleCharAlphabetSet(libCtx) {
  const terms = (libCtx && libCtx.alphabetTerminals) || [];
  if (terms.length === 0) return null;
  for (const t of terms) { if (typeof t !== 'string' || t.length !== 1) return null; }
  return new Set(terms);
}

/**
 * Tokenise un nom composé selon la règle NATIVE (réalignement A-bis, accord
 * architecte 2026-07-03 sur preuves bp3-engine [263] — constat hashab-monochar,
 * addendum) : à chaque position, (1) terminal déclaré au LONGEST-MATCH
 * (SEARCHTERMINAL2 Encode.c:888-918) ; sinon (2) MAJUSCULE → VARIABLE qui
 * absorbe les alphanumériques suivants (SEARCHVAR — preuves : abXa→a·b·Xa,
 * abX4→a·b·X4, abXcd→a·b·Xcd) ; sinon (3) CHIFFRE → NOMBRE (suite de chiffres —
 * preuves : ab4→a·b·4, ab4a→a·b·4·a) ; sinon (4) caractère hors règle prouvée →
 * nom INTACT (conservateur). Jamais « intacte à cause d'un char non-terminal »
 * (l'ancien choix, hérité de l'adaptateur BPx, était INFIDÈLE au natif).
 * null = rien à découper (atomique ou un seul token).
 */
function tokenizeCompoundName(name, terminals) {
  if (name.length < 2) return null; // déjà atomique
  const toks = [];
  let i = 0;
  while (i < name.length) {
    let best = null;
    for (const t of terminals) {
      if (name.startsWith(t, i) && (best === null || t.length > best.length)) best = t;
    }
    if (best !== null) { toks.push({ kind: 'terminal', text: best }); i += best.length; continue; }
    const ch = name[i];
    if (ch >= 'A' && ch <= 'Z') {
      let j = i + 1;
      while (j < name.length && /[A-Za-z0-9]/.test(name[j])) j++;
      toks.push({ kind: 'variable', text: name.slice(i, j) });
      i = j; continue;
    }
    if (ch >= '0' && ch <= '9') {
      let j = i + 1;
      while (j < name.length && name[j] >= '0' && name[j] <= '9') j++;
      toks.push({ kind: 'number', text: name.slice(i, j) });
      i = j; continue;
    }
    return null; // hors règle native prouvée → intact
  }
  return toks.length < 2 ? null : toks;
}

/** Fabrique un atome découpé. line/actor sur CHAQUE atome ; negated/payload
 * sur le PREMIER seul (le `#`/la charge portent sur le token écrit entier,
 * BP3 les applique au premier terminal apparié — Encode.c:906/992). Miroir
 * exact de makeSplitSymbol (loadGrammar.ts:2425-2448). */
function makeSplitAtom(original, ch, isFirst) {
  const node = { type: 'Symbol', name: ch };
  if (original.line !== undefined) node.line = original.line;
  if (original.actor !== undefined) node.actor = original.actor;
  if (isFirst && original.negated === true) node.negated = true;
  if (isFirst && original.payload !== undefined) node.payload = original.payload;
  return node;
}

/** Découpe un élément de LHS (seuls les Symbol nus sont candidats).
 * terminal/variable → Symbol ; NOMBRE en LHS = non représentable dans
 * LhsElementAST et non prouvé au natif → nom INTACT (soumis à validation
 * bp3-engine, cas exotique `ab4 -> …`). */
function splitLhsElement(el, terminals) {
  if (!el || el.type !== 'Symbol') return [el];
  const toks = tokenizeCompoundName(el.name, terminals);
  if (toks === null || toks.some((t) => t.kind === 'number')) return [el];
  return toks.map((t, i) => makeSplitAtom(el, t.text, i === 0));
}

/** Découpe un élément de RHS (Symbol nu ; récursion voix polymétriques et
 * groupes de gabarit — mêmes nœuds que le splitter vivant). terminal/variable
 * → Symbol ; nombre → NumericDuration (forme du parser pour un INT nu). */
function splitRhsElement(el, terminals) {
  if (!el || typeof el !== 'object') return [el];
  if (el.type === 'Symbol') {
    const toks = tokenizeCompoundName(el.name, terminals);
    if (toks === null) return [el];
    return toks.map((t, i) =>
      t.kind === 'number'
        ? { type: 'NumericDuration', numerator: Number(t.text), denominator: 1 }
        : makeSplitAtom(el, t.text, i === 0));
  }
  if (el.type === 'Polymetric' && Array.isArray(el.voices)) {
    return [{ ...el, voices: el.voices.map((v) => v.flatMap((c) => splitRhsElement(c, terminals))) }];
  }
  if ((el.type === 'TemplateMasterGroup' || el.type === 'TemplateSlaveGroup') && Array.isArray(el.elements)) {
    return [{ ...el, elements: el.elements.flatMap((c) => splitRhsElement(c, terminals)) }];
  }
  return [el];
}

/** Découpe les terminaux composés de toutes les règles (muté en place). */
function splitCompoundTerminals(ast, libCtx) {
  const terminals = singleCharAlphabetSet(libCtx);
  if (!terminals) return;
  for (const sub of ast.subgrammars || []) {
    for (const rule of sub.rules || []) {
      rule.lhs = rule.lhs.flatMap((el) => splitLhsElement(el, terminals));
      rule.rhs = rule.rhs.flatMap((el) => splitRhsElement(el, terminals));
    }
  }
}

const CTX_METAVAR_RE = /^\?\d+$/;
const isCtxWildcardName = (s) => s === '?' || CTX_METAVAR_RE.test(s);

/** Élément typé d'un contexte remote (miroir de la branche multi d'injectParserContext). */
function ctxSymbolToElement(sym, line) {
  if (sym === '?') return { type: 'Wildcard', line };
  if (CTX_METAVAR_RE.test(sym)) return { type: 'Variable', index: parseInt(sym.slice(1), 10), line };
  return { type: 'Symbol', name: sym, line };
}

/**
 * Canonicalise UN contexte parser `{type:'Context', positive, symbols}` côté LHS.
 * Retourne `{inline: node}` (mécanisme A) ou `{remote: node}` (mécanisme B).
 * `line` : rule.line en tête, 0 en mi-LHS (réplique exacte de l'adaptateur).
 * `asRuleContext` : true en tête (forme contrat RuleContextAST, avec miroir
 * `symbols`), false en mi-LHS (ContextAST positionnel, sans miroir).
 */
function canonicalizeLhsContext(ctx, line, asRuleContext) {
  const symbols = ctx.symbols || [];
  const single = symbols.length === 1;
  const allLiteral = symbols.every((s) => !isCtxWildcardName(s));
  const negated = ctx.positive === false;
  if (single && allLiteral && negated) {
    return { inline: { type: 'Symbol', name: symbols[0], negated: true, line } };
  }
  if (single && !allLiteral) {
    if (symbols[0] === '?') return { inline: { type: 'Wildcard', negated, line } };
    return { inline: { type: 'Variable', index: parseInt(symbols[0].slice(1), 10), negated, line } };
  }
  const elements = symbols.map((s) => ctxSymbolToElement(s, line));
  if (asRuleContext) {
    return { remote: {
      type: 'Context', side: 'left', positive: !negated, kind: 'remote',
      elements, symbols: [...symbols], line,
    } };
  }
  return { remote: { type: 'Context', negated, elements, line } };
}

/** Canonicalise un élément de LHS (seuls les Context parser sont touchés). */
function canonicalizeLhsElement(el) {
  if (!el || typeof el !== 'object' || el.type !== 'Context') return el;
  if (Array.isArray(el.elements)) return el; // déjà canonique (ContextAST)
  const conv = canonicalizeLhsContext(el, el.line ?? 0, false);
  return conv.inline || conv.remote;
}

/** Canonicalise un élément de RHS (récursif dans les voix polymétriques). */
function canonicalizeRhsElement(el) {
  if (!el || typeof el !== 'object') return el;
  if (el.type === 'Context') {
    const symbols = el.symbols || [];
    if (symbols.length === 1 && el.positive === false) {
      // `#X`/`#?`/`#?N` RHS → joker nié SANS nom ni line (le parser n'en pose pas ;
      // l'adaptateur n'ajoute line que s'il est défini). Compute.c:2014-2019.
      return { type: 'Wildcard', negated: true };
    }
    return el; // formes non mono-négatives : inchangées (erreur adaptateur préservée)
  }
  if (el.type === 'Polymetric' && Array.isArray(el.voices)) {
    return { ...el, voices: el.voices.map((v) => v.map((c) => canonicalizeRhsElement(c))) };
  }
  return el;
}

/**
 * Enrichit SUR PLACE une entrée REMOTE de rule.contexts : double-émission
 * `elements` TYPÉS (canonique) + `symbols`/`positive` conservés (le BPx vivant
 * ne lit qu'eux), ORDRE et position inchangés (rien ne bouge → prérequis P2/P3
 * non concernés). `side` est OMIS : il dépend de la position du remote dans la
 * séquence finale (un remote de tête est un contexte DROIT quand le motif est
 * vide, cf. P2) — à calculer au flip Palier 4 ; le défaut de contrat ('left')
 * s'applique en attendant. Les entrées de catégorie INLINE (#X, #?, #?N —
 * mécanisme A) restent BRUTES : leur forme canonique est l'atome nié dans le
 * LHS, qui n'est émissible qu'au flip (P1-P4).
 */
function enrichRemoteHeadContext(ctx, line) {
  if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx.elements)) return ctx; // déjà enrichi
  const symbols = ctx.symbols || [];
  const single = symbols.length === 1;
  const allLiteral = symbols.every((s) => !isCtxWildcardName(s));
  const inlineCategory = single && (!allLiteral || ctx.positive === false);
  if (inlineCategory) return ctx; // mécanisme A : brut jusqu'au flip Palier 4
  return {
    type: 'Context', positive: ctx.positive !== false, kind: 'remote',
    elements: symbols.map((s) => ctxSymbolToElement(s, line)),
    symbols: ctx.symbols, line,
  };
}

/**
 * Canonicalise les contextes de toutes les règles de l'AST (muté en place).
 * VIF (sûr, additif) : enrichissement des remotes de tête (double-émission).
 * GATÉ (Palier 4) : flip inline — tête/mi-LHS/RHS → atomes niés (P1-P4).
 */
function canonicalizeContexts(ast) {
  for (const sub of ast.subgrammars || []) {
    for (const rule of sub.rules || []) {
      if (Array.isArray(rule.contexts) && rule.contexts.length > 0) {
        rule.contexts = rule.contexts.map((ctx) => enrichRemoteHeadContext(ctx, rule.line ?? 0));
      }
      if (INLINE_FLIP_PALIER4) {
        // FLIP C (top [271], B de bpx landé) — ORDRE SOURCE (P2) : la séquence
        // assemblée [items de tête convertis + LHS écrit] reproduit le routage
        // positionnel historique pour calculer le `side` OBÉI par BPx
        // (splitRuleContexts : un seul contexte par côté) :
        //   index 0 → 'left' ; dernier index → 'right' (remote de tête à motif
        //   vide = contexte DROIT, cas T8) ; MILIEU → erreur à la TRANSPILATION
        //   (même sémantique que l'ancien « Remote context must appear at
        //   start or end of LHS » levé au chargement).
        const seq = [];
        const remoteMarks = [];
        for (const ctx of rule.contexts || []) {
          if (ctx && Array.isArray(ctx.elements)) {
            const mark = { __remote: ctx };
            seq.push(mark); remoteMarks.push(mark);
            continue;
          }
          const conv = canonicalizeLhsContext(ctx, rule.line ?? 0, true);
          if (conv.inline) { seq.push(conv.inline); }
          else { const mark = { __remote: conv.remote }; seq.push(mark); remoteMarks.push(mark); }
        }
        const assembled = [...seq, ...rule.lhs];
        const declared = [];
        for (const mark of remoteMarks) {
          const i = assembled.indexOf(mark);
          const rc = mark.__remote;
          if (i === 0) declared.push({ ...rc, side: 'left' });
          else if (i === assembled.length - 1) declared.push({ ...rc, side: 'right' });
          else {
            throw new ParseError(
              `contexte distant en milieu de motif (autorisé : début ou fin de LHS)`,
              { line: rule.line ?? 0, col: 0 }
            );
          }
        }
        rule.lhs = assembled.filter((x) => !x || !x.__remote);
        rule.contexts = declared;
        rule.lhs = rule.lhs.map(canonicalizeLhsElement);
        rule.rhs = rule.rhs.map(canonicalizeRhsElement);
      }
    }
  }
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
    // Frontière AST (Palier 3) : pas de `soundAssignments:null` — champ non canonique.
    // Canonique = `assignments?` OPTIONNEL (absent ici : l'acteur implicite n'affecte aucun son).
    synthetic: true, // acteur implicite (aucun @actor déclaré) — panneau Acteurs vide
    line: 0,
  }];
}

export function compileToBPxAST(source, environnement) {
  const result = { ast: null, errors: [], warnings: [] };
  try {
    const ast = parse(tokenize(source), { onWarning: (w) => result.warnings.push(w) });
    // Résolution d'acteur (décision 2026-07-03 note-nue, option A) : attribution
    // implicite mono-propriétaire + erreur d'ambiguïté « Use dot notation », MÊME
    // sémantique que la voie héritée (index.js compileBPS:32). L'aval ne résout
    // rien (BPx/Kairos lisent `payload.actor` opaque) → sans cette passe, toute
    // note nue part acteur-nulle dans l'arbre. AVANT applyDefaultActor : l'acteur
    // synthétique `default` n'a pas d'alphabet (faux « no alphabet property » sinon).
    result.errors.push(...resolveActors(ast).errors);
    canonicalizeContexts(ast); // frontière AST Palier 3 : contextes → forme canonique (inline/remote)
    annotateBackticks(ast);   // _btName en tête + payload.interp/nature:'code' sur les nœuds backtick
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

    // Découpeur frontal mono-char (flip Palier 4, étape A) — EN DERNIER :
    // annotateBackticks et les validateurs ci-dessus voient l'AST NON découpé,
    // exactement comme quand la découpe vivait en aval dans BPx.
    splitCompoundTerminals(ast, libCtx);
  } catch (e) {
    if (e instanceof ParseError) result.errors.push({ message: e.message, line: e.token && e.token.line });
    else throw e;
  }
  return result;
}

export default compileToBPxAST;
