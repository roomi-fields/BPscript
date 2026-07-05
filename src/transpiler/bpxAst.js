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
import { loadLibsFromDirectives, loadLib, describeVocabulary } from './libs.js';
import { resolveActors, expandAlphabetTerminals } from './actorResolver.js';
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

  // 3. FAIL-LOUD orphelin (décision CV-curve 2026-07-04 + ajustement [299]) : un backtick
  //    de flux resté `interp:'auto'` n'a NI tag NI eval d'acteur en tête → langage inconnu,
  //    jamais deviné. Erreur claire (non fatale : l'AST reste produit, Kanopi l'affiche).
  const errors = [];
  const scanOrphans = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== 'object') continue;
      if (isBt(el) && el.payload && el.payload.interp === 'auto') {
        errors.push({
          message: `Backtick sans langage : ni tag (\`js: …\`) ni acteur voix-code (@actor … eval.X) `
                 + `en tête de règle — le langage doit être connu, jamais deviné (décision CV-curve [299]).`,
          line: el.line,
        });
      }
      if (el.elements) scanOrphans(el.elements);
      if (el.voices) for (const v of el.voices) scanOrphans(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) scanOrphans(rule.rhs);
  return errors;
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

// Transport par défaut de l'acteur IMPLICITE — lu DANS @core (donnée : `defaults.components
// .transport`), plus de constante en dur (cascade de défauts, Romain 2026-07-05). Le repli
// 'audio' n'est atteint QUE si @core est absent/cassé (bug de config) — pas un défaut normal.
function defaultActorTransport() {
  const core = loadLib('core');
  return (core && core.defaults && core.defaults.components && core.defaults.components.transport) || 'audio';
}

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
// DÉRIVATION alphabet ← accordage (bug 1.1, Romain 2026-07-05) : un accordage déclare son
// alphabet (`tunings.json` Y.alphabet). Quand un accordage est invoqué SANS alphabet, l'alphabet
// EFFECTIF se DÉRIVE de l'accordage (cascade), il n'est JAMAIS un western caché. Rendu EXPLICITE
// dans l'AST (acteur : `props.alphabet` ; scène : injection d'une directive `@alphabet.Y.alphabet`).
function deriveAlphabetFromTuning(ast) {
  if (!ast) return;
  const tuningAlpha = (tname) => { const t = loadLib('tuning', tname); return (t && t.alphabet) || null; };
  for (const actor of ast.actors || []) {
    const p = actor.properties || {};
    if (p.tuning && !p.alphabet) { const a = tuningAlpha(p.tuning); if (a) p.alphabet = a; }
  }
  const dirs = ast.directives || [];
  const tun = dirs.find((d) => d.name === 'tuning' && d.subkey);
  const alph = dirs.find((d) => d.name === 'alphabet' && d.subkey);
  if (tun && !alph) {
    const a = tuningAlpha(tun.subkey);
    if (a) dirs.push({ type: 'Directive', name: 'alphabet', subkey: a, runtime: null, value: null,
                       aliases: null, modifiers: null, line: tun.line, _derivedFromTuning: true });
  }
}

// FAIL-LOUD terminaux (bug 1.1 couche 2, Romain 2026-07-05) : le vocabulaire UTILISÉ (les
// terminaux des règles) doit être DÉCLARÉ par un alphabet en portée. Un terminal-note qui
// n'appartient à aucun alphabet effectif (ex. `C4` dans une scène `@alphabet.sargam`), et qui
// n'est ni un non-terminal, ni un symbole déclaré, ni du code → CRIE à la compilation.
// Union des alphabets effectifs = SÛRE (pas de faux positif cross-acteur).
function validateTerminals(ast) {
  if (!ast) return [];
  const errors = [];
  const codeVoice = new Set((ast.actors || []).filter((a) => (a.properties || {}).eval).map((a) => a.name));

  // Vocabulaire VALIDE = terminaux de TOUS les alphabets effectifs (octaviés + formes nues).
  const known = new Set(['lambda']);
  const addAlphabet = (name, octaves) => {
    const lib = loadLib('alphabet', name);
    if (!lib || !lib.notes) return false;
    for (const t of expandAlphabetTerminals(lib, octaves)) known.add(t);
    const alts = lib.alterations && typeof lib.alterations === 'object' && !Array.isArray(lib.alterations)
      ? Object.keys(lib.alterations) : [''];
    for (const note of lib.notes) for (const alt of alts) known.add(note + alt); // forme nue (défaut d'octave)
    return true;
  };
  let anyAlphabet = false;
  const sceneAlpha = (ast.directives || []).find((d) => d.name === 'alphabet' && d.subkey);
  const sceneOct = (ast.directives || []).find((d) => d.name === 'octaves' && (d.subkey || d.runtime));
  if (sceneAlpha) anyAlphabet = addAlphabet(sceneAlpha.subkey, sceneOct ? (sceneOct.subkey || sceneOct.runtime) : null) || anyAlphabet;
  for (const a of ast.actors || []) { const p = a.properties || {}; if (p.alphabet) anyAlphabet = addAlphabet(p.alphabet, p.octaves || null) || anyAlphabet; }
  if (!anyAlphabet) return errors; // aucun alphabet de notes en portée (voix-code pure) → rien à valider

  // Symboles DÉCLARÉS : non-terminaux (LHS), déclarations gate/trigger/cv, scènes, homomorphismes.
  const declared = new Set();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) (r.lhs || []).forEach((s) => s && declared.add(s.name));
  for (const d of ast.declarations || []) if (d && d.name) declared.add(d.name);
  for (const c of ast.cvInstances || []) if (c && c.name) declared.add(c.name); // `cv NAME : …` → NAME est un modulateur utilisable comme terminal de règle (voix CV)
  for (const s of ast.scenes || []) if (s && s.name) declared.add(s.name);
  for (const m of ast.macros || []) if (m && m.name) declared.add(m.name);
  // Motifs temporels (@timepatterns: t1=…) : symboles de flux, pas des terminaux de note.
  for (const d of ast.directives || []) if (d.name === 'timepatterns' && Array.isArray(d.timePatterns)) for (const tp of d.timePatterns) if (tp && tp.name) declared.add(tp.name);

  // Terminaux RHS : Symbol non couvert = non déclaré.
  const seen = new Set();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) for (const el of (r.rhs || [])) {
    if (!el || el.type !== 'Symbol' || !el.name) continue;
    if (el.payload && codeVoice.has(el.payload.actor)) continue; // voix-code : terminal arbitraire
    if (known.has(el.name) || declared.has(el.name) || seen.has(el.name)) continue;
    seen.add(el.name);
    errors.push({ message: `terminal '${el.name}' non déclaré — absent des alphabets en portée`, line: el.line });
  }
  return errors;
}

function applyDefaultActor(ast) {
  if (!ast) return [];
  const errors = [];
  // Le binding de sortie de l'alphabet de scène (`@alphabet.X:midi` → runtime:'midi') est la
  // clé de connexion transport (+eval) de l'UNIQUE acteur implicite (AST.md:94). Décision Romain
  // 2026-07-05 (acteur unique implicite) : sans @actor, ce binding renseigne le transport de
  // l'acteur synthétique ; AVEC un @actor, c'est un CHEVAUCHEMENT interdit (implicite XOR explicite).
  const alphaBinding = (ast.directives || []).find((d) => d.name === 'alphabet' && d.runtime);
  if ((ast.actors || []).length > 0) {
    if (alphaBinding) {
      errors.push({
        message: `chevauchement d'acteurs : un binding de sortie sur l'alphabet (@alphabet.${alphaBinding.subkey}:${alphaBinding.runtime}) désigne un acteur implicite, incompatible avec un @actor explicite — choisis l'un OU l'autre`,
        line: alphaBinding.line || 0,
      });
    }
    return errors; // au moins un @actor déclaré → pas d'acteur implicite (pas de chevauchement)
  }
  // Transport de l'acteur implicite : binding de l'alphabet s'il existe, sinon défaut du composant.
  const transportKey = (alphaBinding && alphaBinding.runtime) || defaultActorTransport();
  const transport = { type: 'TransportRef', key: transportKey, params: {} };
  ast.actors = [{
    type: 'ActorDirective',
    name: 'default',
    properties: { transport }, // pas d'alphabet : pitch via le résolveur de scène
    references: [
      { type: 'ActorReference', category: 'transport', name: transportKey, line: 0 },
    ],
    // Frontière AST (Palier 3) : pas de `soundAssignments:null` — champ non canonique.
    // Canonique = `assignments?` OPTIONNEL (absent ici : l'acteur implicite n'affecte aucun son).
    synthetic: true, // acteur implicite (aucun @actor déclaré) — panneau Acteurs vide
    line: 0,
  }];
  return errors;
}

/**
 * SCENE_VALUES (hub [293], design docs/design/SCENE_VALUES_OVERRIDE.md §3.4) — pli de
 * la cascade STATIQUE des valeurs de librairie dans la déclaration d'acteur, conforme
 * AST_SPEC §0.1 (« le frontend plie la cascade statique ; un token ne recopie jamais
 * la config complète »). Pour chaque valeur du registre (ex. diapason) :
 *   effectif = params d'entité acteur (tuning.X(diapason:432))
 *           ?? valeur de scène (@diapason:442)
 *           ?? défaut du composant référencé (spec.componentDefault, ex. le champ
 *              diapason du tuning choisi) ?? spec.default
 * → actors[i].values = { nom: effectif } (champ absent si rien). L'occurrence
 * (diapason:428) reste sur payload.params (canal existant, domaine validé ici).
 * BPx porte values OPAQUE (ActorEntry) — DISTINCT de transport.params (adresse, KAI-9).
 * @returns {Array<{message, line?}>} erreurs (domaine, forme, noms inconnus)
 */
function applySceneValues(ast, libCtx) {
  const registry = (libCtx && libCtx.valueRegistry) || {};
  const errors = [...((libCtx && libCtx.valueRegistryErrors) || [])];
  const names = Object.keys(registry);
  if (!names.length) return errors;

  const checkDomain = (name, spec, v, line) => {
    if (typeof v === 'number' && Array.isArray(spec.range) && spec.range.length === 2
        && (v < spec.range[0] || v > spec.range[1])) {
      errors.push({ message: `'${name}': ${v} hors plage [${spec.range[0]}..${spec.range[1]}]${spec.unit ? ' ' + spec.unit : ''}`, line });
      return false;
    }
    if (Array.isArray(spec.values) && !spec.values.includes(v)) {
      errors.push({ message: `'${name}': valeur '${v}' inconnue (admises : ${spec.values.join(', ')})`, line });
      return false;
    }
    return true;
  };

  // Niveau SCÈNE : @nom:valeur (forme deux-points = valeur, règle ':'/'.')
  const sceneVals = {};
  for (const d of ast.directives || []) {
    const spec = registry[d.name];
    if (!spec) continue;
    if (d.value == null) {
      errors.push({ message: `'@${d.name}' attend une VALEUR (ex. @${d.name}:440) — pas un nom`, line: d.line });
      continue;
    }
    if (checkDomain(d.name, spec, d.value, d.line)) sceneVals[d.name] = d.value;
  }

  // Composant d'un AXE déclaré au niveau SCÈNE, lu en forme POINT uniquement (`@tuning.X`
  // → `subkey`). SÉMANTIQUE `.`/`:` (Romain) : `.` APPELLE un composant, `:` affecte une
  // VALEUR. Un accordage est un COMPOSANT → point. `@tuning:X` (deux-points) = forme v0.7
  // PÉRIMÉE (affecterait une « valeur » à un axe de composant, non-sens) : NON accommodée
  // ici — elle relève de la migration v0.7→v0.8, pas d'un chemin de code.
  const defaultComponents = (libCtx && libCtx.defaultComponents) || {};
  const sceneComponent = (axis) => {
    const d = (ast.directives || []).find((x) => x.name === axis && x.subkey);
    return d ? d.subkey : undefined;
  };
  // Défaut EFFECTIF (niveaux 2-1) : `spec.overriddenBy = "axe.champ"` = le champ du composant
  // EFFECTIF de l'axe (acteur ?? scène ?? défaut @core) donne le défaut. RÈGLE DURE (kairos [310]) :
  // si un composant est en portée mais NON RÉSOLU, on renvoie `undefined` (valeur ABSENTE, l'aval
  // résout) — JAMAIS un littéral global par-dessus un composant déclaré. Un `spec.default` littéral
  // n'est le socle QUE pour une valeur SANS composant (pas d'`overriddenBy`, ex. tempo).
  const cascadeDefault = (spec, props) => {
    if (spec.overriddenBy) {
      // `overriddenBy` = "axe.champ" OU une CHAÎNE ["tuning.diapason","alphabet.diapason"] :
      // le SPÉCIFIQUE précède le GÉNÉRIQUE (un accordage qui redéclare l'ancre = override
      // exceptionnel, doit primer — aligné sur la lecture kairos `tuning ?? alphabet` [313]).
      const chain = Array.isArray(spec.overriddenBy) ? spec.overriddenBy : [spec.overriddenBy];
      let anyAxisDeclared = false;
      for (const ref of chain) {
        const [axis, field] = ref.split('.');
        let compName = (props && props[axis]) || sceneComponent(axis);
        if (compName == null) {
          if ((ast.directives || []).some((x) => x.name === axis)) { anyAxisDeclared = true; continue; } // axe déclaré, non résolu ici
          compName = defaultComponents[axis]; // aucune déclaration de l'axe → défaut @core
        }
        if (compName) {
          const comp = loadLib(axis, compName);
          if (comp && comp[field] != null) return comp[field]; // 1er champ résolu de la chaîne gagne
        }
      }
      // Aucun maillon résolu. Si un axe était déclaré mais non résolu (forme périmée/nom
      // absent) → ABSENT (l'aval résout, jamais le socle global). Sinon → défaut scalaire.
      return anyAxisDeclared ? undefined : spec.default;
    }
    return spec.default; // valeur sans composant → défaut scalaire socle
  };

  // Niveau ACTEUR : pli dans la déclaration (jamais de recopie par token). Cascade complète
  // par valeur : acteur (4) → scène (3) → composant invoqué (2) → socle @core (1).
  for (const actor of ast.actors || []) {
    const props = actor.properties || {};
    const eParams = props.entityParams || {};
    for (const [axis, params] of Object.entries(eParams)) {
      for (const k of Object.keys(params)) {
        if (!registry[k]) {
          errors.push({ message: `'${axis}.…(${k}:…)' : '${k}' n'est pas une valeur déclarée (ni socle @core ni librairie invoquée)`, line: actor.line });
        }
      }
    }
    const vals = {};
    for (const name of names) {
      const spec = registry[name];
      let v;
      for (const params of Object.values(eParams)) {
        if (params && params[name] != null) v = params[name]; // niveau 4 acteur
      }
      if (v === undefined && sceneVals[name] !== undefined) v = sceneVals[name]; // niveau 3 scène
      if (v === undefined) v = cascadeDefault(spec, props); // niveaux 2-1 (composant invoqué → socle @core)
      if (v === undefined) continue;
      if (checkDomain(name, spec, v, actor.line)) vals[name] = v;
    }
    if (Object.keys(vals).length) actor.values = vals;
  }

  // Niveau OCCURRENCE : (diapason:428) → déjà porté par payload.params ; domaine validé.
  const walkParams = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walkParams); return; }
    const p = node.payload && node.payload.params;
    if (p) {
      for (const [k, v] of Object.entries(p)) {
        if (registry[k]) checkDomain(k, registry[k], v, node.line);
      }
    }
    for (const k in node) {
      if (k !== 'payload' && node[k] && typeof node[k] === 'object') walkParams(node[k]);
    }
  };
  walkParams(ast.subgrammars);

  return errors;
}

/**
 * FAIL-FAST à la COMPILATION (règle Romain 2026-07-04, langages bien faits) : toute
 * référence dont l'info est disponible ici DOIT être vérifiée ici, pas reportée à la
 * dérivation. Une référence — VALEUR (`@X:v`, occurrence `(k:v)`) ou COMPOSANT
 * (`@alphabet.X`, `@tuning.X`, `@octaves.X`) — qui n'existe pas dans les librairies
 * chargées → ERREUR CLAIRE (nom fautif). Kairos garde son filet défensif en aval.
 * ZÉRO HARDCODE : tout le vocabulaire (contrôles/valeurs/fonctions/adresses/axes) vient
 * des libs chargées + du schéma @core → une user library l'étend automatiquement.
 * @returns {Array<{message, line?, col?}>}
 */
function validateReferences(ast) {
  const errors = [];
  // Univers de référence = MÊME vocabulaire que celui exposé à Kanopi (une seule source
  // de vérité) : agrégat de TOUTES les libs disponibles. Un mot usable est valide.
  const vocab = describeVocabulary();
  const controlNames = new Set(vocab.controls.map((c) => c.name));
  const registry = new Set(vocab.values.map((v) => v.name));
  const modInputs = new Set(vocab.modulationInputs);
  const reserved = new Set(vocab.keywords);
  const digitalFns = new Set(vocab.functions);
  const addressKeys = new Set(vocab.addressKeys);
  const catalogAxes = Object.keys(vocab.components);
  const componentExists = (axis, name) => (vocab.components[axis] || []).includes(name);

  // 1. Occurrence / paramètres `(k:v)` — clé connue = contrôle ∪ valeur ∪ entrée modulation ∪
  //    adresse ∪ fonction digitale. Les paires d'occurrence vivent dans `payload.params`
  //    (note ou groupe/règle, foldées par le parser) ET dans les `RuntimeQualifier.pairs`.
  const knownParamKey = (k) => controlNames.has(k) || registry.has(k) || modInputs.has(k) || addressKeys.has(k) || digitalFns.has(k);
  const seen = new Set();
  const flag = (key, line, col) => {
    const id = key + ':' + (line || 0);
    if (seen.has(id) || knownParamKey(key)) return;
    seen.add(id);
    errors.push({ message: `attribut '(${key}:…)' inconnu — ni contrôle, ni valeur de librairie, ni entrée de modulation, ni adresse`, line, col });
  };
  (function collect(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const el of node) collect(el); return; }
    if (node.payload && node.payload.params) for (const k of Object.keys(node.payload.params)) flag(k, node.line);
    if (node.type === 'RuntimeQualifier' && Array.isArray(node.pairs)) for (const p of node.pairs) flag(p.key, p.line, p.col);
    for (const k in node) { if (k !== 'params' && node[k] && typeof node[k] === 'object') collect(node[k]); }
  })(ast.subgrammars);

  // 2. Existence d'un COMPOSANT référencé dans un axe à catalogue.
  const checkComponent = (axis, name, line) => {
    if (!name) return;
    if (!componentExists(axis, name)) errors.push({ message: `${axis} '${name}' introuvable dans le catalogue (référence inexistante)`, line });
  };

  // 3. Directives de scène : invocation de composant (@axis.X) OU override de valeur (@X:v).
  for (const d of ast.directives || []) {
    if (d.subkey && catalogAxes.includes(d.name)) { checkComponent(d.name, d.subkey, d.line); continue; }
    if (d.value != null && d.value !== true && !registry.has(d.name) && !reserved.has(d.name)) {
      errors.push({ message: `valeur '@${d.name}:…' inconnue — non déclarée par une librairie chargée`, line: d.line });
    }
  }

  // 5. COHÉRENCE alphabet/accordage (bug 1.1, Romain 2026-07-05) : un accordage n'appartient
  //    qu'à SON alphabet (`tunings.json` Y.alphabet). Un alphabet DÉCLARÉ qui ne correspond
  //    pas à celui de l'accordage déclaré = INCOHÉRENCE → CRIE à la compilation (fail-loud),
  //    jamais compiler-et-sonner un mélange incohérent.
  const tuningAlphabet = (tname) => { const t = loadLib('tuning', tname); return (t && t.alphabet) || null; };
  const sceneComp = (axis) => { const d = (ast.directives || []).find((x) => x.name === axis && x.subkey); return d ? d.subkey : null; };
  const checkCoherence = (alphaName, tuningName, line) => {
    if (!alphaName || !tuningName) return;
    const ta = tuningAlphabet(tuningName);
    if (ta && ta !== alphaName) {
      errors.push({ message: `alphabet '${alphaName}' incohérent avec l'accordage '${tuningName}' (qui appartient à l'alphabet '${ta}') — un accordage ne se combine qu'avec son alphabet`, line: line || 0 });
    }
  };
  checkCoherence(sceneComp('alphabet'), sceneComp('tuning'), 0);
  for (const actor of ast.actors || []) checkCoherence((actor.properties || {}).alphabet, (actor.properties || {}).tuning, actor.line);

  // 4. Références d'entité des ACTEURS (axes à catalogue) → existence catalogue.
  for (const actor of ast.actors || []) {
    const props = actor.properties || {};
    for (const axis of catalogAxes) if (props[axis]) checkComponent(axis, props[axis], actor.line);
  }

  return errors;
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
    deriveAlphabetFromTuning(ast); // alphabet ← accordage quand @alphabet absent (bug 1.1) — AVANT resolveActors
    result.errors.push(...resolveActors(ast).errors);
    canonicalizeContexts(ast); // frontière AST Palier 3 : contextes → forme canonique (inline/remote)
    result.errors.push(...annotateBackticks(ast));   // _btName + payload.interp/nature:'code' ; CRIE si backtick orphelin sans langage
    applyEnvironmentDefaults(ast, environnement);  // défauts d'environnement → AST (point 1)
    result.errors.push(...applyDefaultActor(ast));   // acteur implicite `default` (transport ← binding alphabet) + garde anti-chevauchement (LAN-5 / KAI-9 / décision 2026-07-05)
    result.ast = ast;

    // Validation sémantique des valeurs de contrôle contre la lib @controls
    // (source unique des valeurs/plages permises). Erreurs non fatales : l'AST reste
    // produit, Kanopi affiche les erreurs en rouge à l'éval. Cf. controlValidation.js.
    const directives = [
      ...(ast.directives || []),
      ...((ast.scenes || []).flatMap((s) => s.directives || [])),
      // SCENE_VALUES : les acteurs (hissés dans ast.actors par le parseur) touchent
      // leurs catalogues d'entité → sections `values` au registre (libs.js).
      ...(ast.actors || []),
    ];
    const libCtx = loadLibsFromDirectives(directives);
    result.errors.push(...applySceneValues(ast, libCtx)); // SCENE_VALUES : pli acteur + validation 3 niveaux
    result.errors.push(...validateReferences(ast)); // fail-fast : références (valeur/composant) inexistantes → erreur (univers = describeVocabulary)
    result.errors.push(...validateTerminals(ast)); // fail-loud : terminal de règle absent des alphabets en portée → erreur
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
