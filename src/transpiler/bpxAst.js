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
import { loadLibsFromDirectives, loadLib, resolveActorAlphabet, resolveActorAlphabetSource, describeVocabulary, universeControlNames } from './libs.js';
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

// Canal de sortie = CANON DIRECT {audio, midi, osc} (EBNF:182), écrit tel quel. Le modèle profils
// d'environnement (routing.json : studio/live/browser) et sa normalisation de surface (ex-
// transportTypeMap/canonicalRuntimeName/canonicalizeActorTransports) sont SUPPRIMÉS (décision
// 2026-07-16, Romain : on supprime, pas de rétrocompat). Les noms périmés `browser`/`webaudio`
// sont désormais REJETÉS fail-loud au parse (parser.js, lib/core.json `schema.deprecatedTransports`)
// — plus aucune résolution de surface ici.

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
/**
 * Résolution de l'invocation d'homomorphisme par SYMBOLE NU (ratifié Romain 2026-07-17).
 * Un Symbol de RHS dont le nom = une section d'homomorphisme chargée (@transcription.<X>),
 * et qui n'est NI un non-terminal (LHS de règle) NI un terminal d'alphabet en portée
 * (précédence RATIFIÉE terminal > règle > homo, contrat bpscript-bpx L31), devient un
 * MARQUEUR per-occurrence : on pose `role:'homomorphism'` sur le nœud (type Symbol conservé,
 * il reste un élément positionnel du flux). BPx compte les occurrences en portée (profondeur
 * k) et applique chains[note][k-1] (ou les paires). La RÉPÉTITION du symbole EST la
 * profondeur — aucun index posé ici. Passe BPx-ONLY : le chemin BP3 hérité reparse
 * indépendamment (compileBPS) et ne voit jamais ce champ → byte-id préservé.
 * Cf. AST.md §HomomorphismDeclAST, message bpx [464].
 */
function resolveHomomorphismMarkers(ast) {
  if (!ast || !Array.isArray(ast.homomorphisms) || ast.homomorphisms.length === 0) return;
  const homoNames = new Set(ast.homomorphisms.map((h) => h && h.name).filter(Boolean));
  if (homoNames.size === 0) return;
  // Non-terminaux : LHS de règle (précédence : la règle gagne sur l'homo).
  const nonterminals = new Set();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) (r.lhs || []).forEach((s) => s && s.name && nonterminals.add(s.name));
  // Terminaux d'alphabet en portée (précédence : le terminal gagne sur l'homo).
  const terminals = new Set();
  const addAlphabet = (name, octaves) => {
    const lib = resolveActorAlphabet(name, ast.directives);
    if (!lib || !lib.notes) return;
    for (const t of expandAlphabetTerminals(lib, octaves)) terminals.add(t);
    const alts = lib.alterations && typeof lib.alterations === 'object' && !Array.isArray(lib.alterations)
      ? Object.keys(lib.alterations) : [''];
    for (const note of lib.notes) for (const alt of alts) terminals.add(note + alt);
  };
  const sa = (ast.directives || []).find((d) => d.name === 'alphabet' && d.subkey);
  const so = (ast.directives || []).find((d) => d.name === 'octaves' && (d.subkey || d.runtime));
  if (sa) addAlphabet(sa.subkey, so ? (so.subkey || so.runtime) : null);
  for (const a of ast.actors || []) { const p = a.properties || {}; if (p.alphabet) addAlphabet(p.alphabet, p.octaves || null); }
  const mark = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(mark); return; }
    if (node.type === 'Symbol' && node.name && homoNames.has(node.name)
        && !nonterminals.has(node.name) && !terminals.has(node.name)) {
      node.role = 'homomorphism';
    }
    for (const k in node) { const v = node[k]; if (v && typeof v === 'object') mark(v); }
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) mark(r.rhs);
}

function validateTerminals(ast) {
  if (!ast) return [];
  const errors = [];
  const codeVoice = new Set((ast.actors || []).filter((a) => (a.properties || {}).eval).map((a) => a.name));

  // Vocabulaire VALIDE = terminaux de TOUS les alphabets effectifs (octaviés + formes nues).
  const known = new Set(['lambda']);
  const addAlphabet = (name, octaves) => {
    const lib = resolveActorAlphabet(name, ast.directives);
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
  // Symboles DÉCLARÉS : non-terminaux (LHS), déclarations gate/trigger/cv, scènes, homomorphismes.
  const declared = new Set();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) (r.lhs || []).forEach((s) => s && declared.add(s.name));
  for (const d of ast.declarations || []) if (d && d.name) declared.add(d.name);
  for (const c of ast.cvInstances || []) if (c && c.name) declared.add(c.name); // `cv NAME : …` → NAME est un modulateur utilisable comme terminal de règle (voix CV)
  for (const s of ast.scenes || []) if (s && s.name) declared.add(s.name);
  for (const m of ast.macros || []) if (m && m.name) declared.add(m.name);
  // Motifs temporels (@timepatterns: t1=…) : symboles de flux, pas des terminaux de note.
  for (const d of ast.directives || []) if (d.name === 'timepatterns' && Array.isArray(d.timePatterns)) for (const tp of d.timePatterns) if (tp && tp.name) declared.add(tp.name);
  // VARIABLES DE TRAVAIL (`@var`, décision Romain 2026-07-27) : des symboles du flux qui ne sont
  // l'écriture d'aucune note. Elles entrent ici — dans les noms DÉCLARÉS, à côté des non-terminaux
  // — et non dans le vocabulaire d'un alphabet : elles n'ont pas de hauteur, elles ont un NOM.
  // Le refus ne s'affaiblit pas, il gagne une porte nommée : un symbole non déclaré crie toujours.
  for (const n of ast.vars || []) declared.add(n);

  errors.push(...validateCallVocabulary(ast, known, declared, codeVoice, anyAlphabet));
  if (!anyAlphabet) return errors; // aucun alphabet de notes en portée (voix-code pure) → rien à valider sur les symboles NUS

  // Terminaux RHS : Symbol non couvert = non déclaré.
  const seen = new Set();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) for (const el of (r.rhs || [])) {
    if (!el || el.type !== 'Symbol' || !el.name) continue;
    if (el.role === 'homomorphism') continue; // marqueur d'invocation d'homo (symbole nu résolu par nom), pas un terminal
    if (el.payload && codeVoice.has(el.payload.actor)) continue; // voix-code : terminal arbitraire
    if (known.has(el.name) || declared.has(el.name) || seen.has(el.name)) continue;
    seen.add(el.name);
    errors.push({ message: `terminal '${el.name}' non déclaré — absent des alphabets en portée`, line: el.line });
  }
  return errors;
}

/**
 * GARDE DE VOCABULAIRE DES APPELS `nom(…)` (chantier `_script`, GO Romain 2026-07-26).
 *
 * Un nom SUIVI D'UNE PARENTHÈSE n'est un CONTRÔLE que s'il est déclaré dans `controls.json`
 * (parser.js:3315 `isControlName`) ; sinon le parseur en fait un `SymbolCall`, c'est-à-dire un
 * TERMINAL SONNANT porteur de paramètres. Ce chemin n'était contrôlé par rien : un nom absent de
 * tout vocabulaire traversait la chaîne en silence, avec `payload.nature:'sounding'` — mesuré le
 * 2026-07-25 (`foobar(3)` accepté, 0 erreur) et re-mesuré le 2026-07-26 après le retrait de
 * `runtime.midi.script` : 3 des 5 scènes qui l'emploient compilaient toujours sans un mot.
 *
 * DEUX CRITÈRES, tous deux issus de la donnée — ni liste en dur ni cas particulier : `script`
 * tombe parce qu'il n'est plus DANS LA DONNÉE, pas parce qu'un test le nomme.
 *
 *  (a) VOCABULAIRE — le nom d'un appel se valide comme un symbole nu : alphabets en portée,
 *      non-terminaux, déclarations. Exige un alphabet en portée, exactement comme la validation
 *      des symboles nus : sans alphabet déclaré, le compilateur ne PEUT PAS savoir ce qui est un
 *      terminal, et juger quand même produit un faux refus (mesuré : `sitar -> C4 C4(ch:5)`,
 *      fragment sans alphabet, refusé à tort).
 *
 *  (b) FORME DE L'ARGUMENT — `()` porte une annotation `clé:valeur` sur l'événement (CLAUDE.md,
 *      « instructions runtime »). Un argument POSITIONNEL sur un nom qui n'est pas un contrôle
 *      déclaré n'annote rien : c'est un APPEL DE FONCTION, et le langage n'en a pas. Ce critère
 *      ne dépend d'aucun alphabet, ce qui referme le trou des scènes qui n'en ont pas (koto3,
 *      scène à gates, passait indemne par (a) seul). Mesuré sur les DEUX corpus consommateurs
 *      (Kanopi BPScript-tests + BPx test/scenes) : le seul appel à argument positionnel est
 *      `script` (7 occurrences) ; tous les autres sont entièrement nommés.
 *
 * Le message CITE l'appel tel qu'écrit (exigence de l'ordre [936]) : un utilisateur qui a écrit
 * `script(MIDI program 5)` doit lire sa propre ligne, pas un nom de nœud d'AST.
 */
function validateCallVocabulary(ast, known, declared, codeVoice, anyAlphabet) {
  const errors = [];
  const seen = new Set();
  const citer = (el) => {
    const parts = (el.args || []).map((a) => {
      const v = a && a.value ? a.value : a;
      const texte = v && Object.prototype.hasOwnProperty.call(v, 'value') ? v.value : v;
      return (a && a.key ? `${a.key}:` : '') + texte;
    });
    return `${el.name}(${parts.join(' ')})`;
  };
  // Portée RÉCURSIVE, contrairement à la boucle des symboles nus ci-dessus : un appel se niche
  // dans un groupe ou une polymétrie aussi bien qu'au premier rang de la règle.
  const visiter = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visiter); return; }
    if (n.type === 'SymbolCall' && n.name
        && !(n.payload && codeVoice.has(n.payload.actor))
        && !known.has(n.name) && !declared.has(n.name) && !seen.has(n.name)) {
      const positionnel = (n.args || []).some((a) => a && a.key == null);
      if (anyAlphabet || positionnel) {
        seen.add(n.name);
        // NOMMER LA CAUSE, PAS LE SYMPTÔME. Deux situations très différentes portent le même
        // symptôme (un appel reclassé en terminal sonnant), et les confondre envoie l'utilisateur
        // chercher une faute de frappe là où il manque une ligne d'en-tête :
        //   - le nom EXISTE dans le registre des contrôles, mais la scène ne l'a pas importé ;
        //   - le nom n'existe nulle part.
        // Mesuré le 2026-07-26 sur le témoin de bpx : `ins(12)` sans `@controls` dégénérait en
        // note, et mon premier message affirmait « 'ins' n'existe pas », ce qui est FAUX.
        const auRegistre = universeControlNames().has(n.name);
        errors.push({
          message: auRegistre
            ? `appel '${citer(n)}' : '${n.name}' est un contrôle du registre, mais cette scène ne `
              + `l'a pas importé — il a donc été reclassé en TERMINAL SONNANT, c'est-à-dire en note. `
              + `Déclarer la librairie de contrôles en tête de scène ('@controls')`
            : `appel '${citer(n)}' : '${n.name}' n'existe pas — ni contrôle du registre, ni terminal `
              + `des alphabets en portée, ni symbole déclaré. Une fonction générique n'est pas du `
              + `langage : chaque intention porte son nom ('[]' pour le moteur, '()' pour le `
              + `runtime, en 'clé:valeur')`,
          line: n.line,
        });
      }
    }
    for (const k in n) { const v = n[k]; if (v && typeof v === 'object') visiter(v); }
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) visiter(r.rhs);
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

  /**
   * Une valeur NUMÉRIQUE écrite en décimal arrivait ici en CHAÎNE — et deux choses en
   * découlaient, dont une bien pire que l'autre.
   *
   * 1. `@diapason:261.63` était plié tel quel : l'arbre portait `"261.63"`, et Kairos le
   *    refusait à juste titre (« un diapason est un nombre fini > 0 »). L'entier `262`, lui,
   *    passait. Une scène pouvait donc déclarer un diapason parfaitement valide et être
   *    rejetée en aval pour une raison de TYPE, sans que rien ne le dise ici.
   * 2. Plus grave : le contrôle de plage ci-dessous ne s'applique QUE si la valeur est déjà un
   *    nombre. Une chaîne le traversait sans être vérifiée — `@diapason:"99999"` passait le
   *    domaine. Le garde existait et ne mordait pas sur la moitié des entrées.
   *
   * On convertit donc avant de valider, pour les valeurs dont la spec déclare une PLAGE
   * (c'est ce qui les désigne comme numériques). Une chaîne non numérique reste telle quelle
   * et sera rejetée par le contrôle de plage — on ne fabrique pas un nombre à partir de rien.
   */
  const versNombre = (spec, v) => {
    if (!Array.isArray(spec.range) || typeof v !== 'string') return v;
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : v;
  };

  const checkDomain = (name, spec, v, line) => {
    if (Array.isArray(spec.range) && typeof v !== 'number') {
      errors.push({ message: `'${name}': '${v}' n'est pas un nombre (attendu : ${spec.range[0]}..${spec.range[1]}${spec.unit ? ' ' + spec.unit : ''})`, line });
      return false;
    }
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
    const valeur = versNombre(spec, d.value);
    if (checkDomain(d.name, spec, valeur, d.line)) sceneVals[d.name] = valeur;
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
  // RÈGLE DE CASCADE (loi 35, constitution:175 ; docs/design/SCENE_DEFAULTS_CASCADE.md, Romain
  // 2026-07-04) : « un pli qui ne sait PAS résoudre le composant INVOQUÉ laisse la valeur ABSENTE,
  // le résolveur (Kairos) la remplit depuis la lib invoquée ». Le socle @core (defaultComponents,
  // lu depuis lib/core.json `defaults.components` — PAS un hardcode) ne s'applique QUE si AUCUN
  // composant n'est invoqué (scène nue). Un axe d'ancre est « invoqué » si un DIRECTIVE legacy le
  // nomme (@alphabet.X/@tuning.X) OU si une invocation par le canal NEUTRE (libRefs) porte
  // l'identité de hauteur — opaque ici (domaine déclaré DANS le fichier, résolu chez Kairos, L27).
  // Jamais le socle par-dessus un composant invoqué (même classe que le bug diapason 2026-07-04
  // où @core écrasait le composant déclaré). FIX [394]/[395].
  const hasNeutralPitch = !!(ast.libRefs && ast.libRefs.length);
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
          // Axe INVOQUÉ (directive legacy OU canal neutre) mais NON résolu ici → ABSENT (Kairos remplit).
          const axisInvoked = (ast.directives || []).some((x) => x.name === axis) || hasNeutralPitch;
          if (axisInvoked) { anyAxisDeclared = true; continue; }
          compName = defaultComponents[axis]; // AUCUN composant invoqué (scène nue) → socle @core
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
      v = versNombre(spec, v);
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
  // DÉDUPLICATION PAR CLÉ ET PAR LIGNE — et surtout : une paire vue DEUX FOIS ne compte qu'une.
  //
  // La même paire est collectée à deux endroits : dans `payload.params` (replié par le parser,
  // SANS position) et dans `RuntimeQualifier.pairs` (AVEC ligne et colonne). L'identifiant de
  // déduplication valait `clé + ':' + (ligne || 0)` : les deux passages produisaient donc deux
  // identifiants différents, et l'attribut inconnu était signalé DEUX FOIS — une fois sans
  // position, une fois avec. Pire, la version SANS position arrivait en premier, donc le
  // premier message rendu à l'appelant n'avait ni ligne ni colonne.
  // Mesuré : `(mysteryParam:42)` rendait 2 erreurs, `(cutof:env1)` en rendait 3.
  //
  // On déduplique donc par CLÉ, et on garde la position dès qu'un des passages la porte.
  const vus = new Map();
  const flag = (key, line, col) => {
    if (knownParamKey(key)) return;
    const deja = vus.get(key);
    if (deja) {
      // Un passage ultérieur porte la position que le premier n'avait pas : on complète.
      if (deja.line === undefined && line !== undefined) { deja.line = line; deja.col = col; }
      return;
    }
    const err = { message: `attribut '(${key}:…)' inconnu — ni contrôle, ni valeur de librairie, ni entrée de modulation, ni adresse`, line, col };
    vus.set(key, err);
    errors.push(err);
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
    if (componentExists(axis, name)) return;
    // Un alphabet peut vivre HORS du catalogue standard, dans une librairie que la scène a
    // elle-même déclarée (`@test_alphabets` par exemple). La validation doit donc poser la MÊME
    // question que la résolution — sinon elle refuse un nom que le resolveur sait charger, et on
    // a deux vérités sur « cet alphabet existe-t-il ».
    if (axis === 'alphabet' && resolveActorAlphabet(name, ast.directives)) return;
    errors.push({ message: `${axis} '${name}' introuvable dans le catalogue (référence inexistante)`, line });
  };

  // 3bis. LIBRAIRIE SANS CATALOGUE — une ENTRÉE INCONNUE y crie aussi (arbitrage architecte
  // 2026-07-27, sur le cas `dhin1`). Les axes à CATALOGUE crient depuis toujours ; les autres —
  // `transcription`, `test_alphabets`, `settings`, `mapping`… — acceptaient n'importe quel nom EN
  // SILENCE. Payé sur pièce : `@transcription.dhinOO` a traversé toute la migration sans un mot ;
  // la scène croyait charger un homomorphisme et n'en chargeait AUCUN, depuis des mois.
  //
  // L'ARGUMENT QUI TRANCHE : ne rien pouvoir vérifier n'est pas une raison de ne rien vérifier,
  // c'est une raison de vérifier AUTRE CHOSE. Ici le vérifiable est trivial — l'entrée existe-t-elle
  // dans le fichier invoqué. Aucun catalogue n'est requis pour poser cette question.
  //
  // FRONTIÈRE MESURÉE AVANT DE LIVRER, sur 447 fichiers de scène (bibliothèque Kanopi entière,
  // démos, scènes de BPx) : QUATRE invocations ne résolvent pas, et les quatre sont déjà refusées
  // aujourd'hui (`@alphabet.raga`, axe à catalogue). Ce fail-loud n'ajoute donc AUCUNE casse.
  const libExiste = (nom) => !!loadLib(nom);
  for (const d of ast.directives || []) {
    if (!d || !d.name || !d.subkey) continue;
    if (catalogAxes.includes(d.name)) continue;   // déjà couvert par checkComponent, ci-dessous
    if (!libExiste(d.name)) continue;             // pas une librairie : autre faute, autre message
    if (loadLib(d.name, d.subkey)) continue;
    errors.push({
      message: `'@${d.name}.${d.subkey}' : l'entrée '${d.subkey}' n'existe pas dans la librairie `
             + `'${d.name}'. Une invocation qui ne résout rien est indistinguable, côté `
             + `consommateur, d'une scène qui n'a rien déclaré — elle ne peut donc pas être acceptée `
             + `en silence.`,
      line: d.line,
    });
  }

  // LA TABLE D'UNE ENTRÉE (`mapping.<table>`) EST SOUMISE AU MÊME CRI — sans exemption (arbitrage
  // architecte 2026-07-27). J'avais épinglé le cas plutôt que de trancher, parce que `lib/mapping.json`
  // est délibérément vide et que le cri rendait non compilables les exemples de la décision. La
  // réponse : ce sont les EXEMPLES qui changent, pas la règle — ils s'écrivent en ADRESSE NUE, forme
  // explicitement autorisée.
  //
  // LA RAISON DU REFUS D'EXEMPTER, et elle vaut au-delà d'ici : une dérogation posée « jusqu'au
  // remplissage » n'a pas de date de fin, personne ne la surveille, et elle survit à la raison qui
  // l'a fait naître. Trois ont été démontées cette semaine.
  for (const e of ast.inputs || []) {
    if (!e || !e.mapping) continue;
    if (loadLib('mapping', e.mapping)) continue;
    errors.push({
      message: `'@in ${e.name} … mapping.${e.mapping}' : la table '${e.mapping}' n'existe pas dans `
             + `la librairie 'mapping'. Une entrée qui invoque une table inexistante croirait `
             + `traduire et ne traduirait rien. Sans table, écrire l'entrée seule et employer des `
             + `adresses nues ('<!${e.name}.60').`,
      line: e.line,
    });
  }

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

/**
 * PROVENANCE DES LIAISONS D'ACTEUR → `actors[].libRefs` (contrat bpx-kairos-arbre §2.1).
 *
 * LE TROU QU'ELLE COMBLE. Une liaison d'acteur sort en NOM NU : `actors.bols.alphabet = 'abc'`.
 * Ce nom ne dit pas d'où il vient. Tant que l'entrée est au catalogue standard, l'aval s'en
 * sort — il la retrouve par son nom. Mais quand elle vient d'une librairie DÉCLARÉE PAR LA
 * SCÈNE (`@test_alphabets.abc`), le nom nu est une impasse : Kairos ne connaît pas `abc`, et
 * il ne DOIT pas le deviner — il lit le domaine déclaré DANS le fichier, il ne l'infère jamais
 * d'une adresse. Sans provenance, sa seule issue serait de renifler, c'est-à-dire d'inventer.
 *
 * CE QU'ELLE ÉMET, et rien de plus. L'adresse canonique `<fichier>.<entrée>`, UNIQUEMENT quand
 * l'entrée vient d'une librairie déclarée par la scène. Une liaison servie par le catalogue
 * standard n'émet RIEN : elle se retrouve déjà par son nom, et lui poser une adresse ferait du
 * bruit là où il n'y a pas de question. Champ OMIS si vide, jamais `[]` (patron `cvInstances`).
 *
 * POURQUOI CE N'EST PAS LE MIROIR DE LA PORTÉE SCÈNE. `ast.libRefs` naît des invocations par
 * provenance (`@factory.` / `@mine.`) — mesuré sur le corpus des 95 : ZÉRO scène en émet. Le
 * canal existe et il est testé (`test_libref_provenance.js`), mais aucune scène ne l'emprunte.
 * Rien à recopier vers l'acteur, donc : l'adresse ne se transporte pas d'en haut, elle se
 * DÉRIVE de la résolution — d'où `resolveActorAlphabetSource`, qui répond « d'où vient-il »
 * là où le résolveur répond « existe-t-il ».
 */
function emitActorLibRefs(ast) {
  for (const actor of ast.actors || []) {
    const alpha = (actor.properties || {}).alphabet;
    if (!alpha) continue;
    const src = resolveActorAlphabetSource(alpha, ast.directives);
    if (!src || !src.lib) continue;   // catalogue standard → aucune adresse à poser
    actor.libRefs = [`${src.lib}.${alpha}`];
    // L'ADRESSE REMPLACE L'ARDOISE, elle ne la double PAS.
    //
    // Mesuré : émettre les deux fait CRIER Kairos — « collision de domaine 'alphabet' (acteur
    // 'bols') : 'test_alphabets.abc' vs 'slot legacy' — pas de dernier-qui-parle ». Il a raison
    // de refuser : deux invocations du même domaine à la même portée, c'est à l'émetteur de
    // trancher, pas au résolveur de deviner laquelle gagne.
    //
    // Et l'ardoise ne peut pas être celle qui reste : mesuré aussi, un nom nu (`abc`) n'est
    // cherché que dans le catalogue STANDARD — même le fichier injecté ne le rend pas trouvable.
    // Seule l'adresse porte la provenance. Garder les deux serait donc une voie parallèle dont
    // l'une ne mène nulle part : exactement le patron qu'on supprime.
    //
    // Le RETRAIT lui-même est différé : `properties.alphabet` sert au pipeline INTERNE
    // (résolution d'acteur, validation des terminaux), qui tourne encore après nous.
    // Cf. `retirerArdoiseAlphabet`, appelée en toute fin de chaîne.
  }
}

/**
 * PORTÉE SCÈNE — un alphabet déclaré par une LIBRAIRIE doit sortir sur l'axe `alphabet`.
 *
 * LE DÉFAUT QUE ÇA CORRIGE, mesuré : une scène qui écrit `@test_alphabets.structural` déclare bien
 * un alphabet — `lib/core.json` le dit noir sur blanc, `test_alphabets` = « référence-librairie,
 * MÊME AXE CATALOGUE que `alphabet` ». Mais j'émettais la directive sous le NOM DE SA LIBRAIRIE, et
 * l'aval ne lit que `name === 'alphabet'` (`BPx/src/session.ts:2124`) : l'alphabet n'arrivait donc
 * jamais. `ames` sortait `scenePitch {alphabet:'western', …}`, `negative-context` sortait
 * `scenePitch {tokens:[…]}` — sans rien. Et pour Kairos, « scène sans alphabet » et « scène dont
 * l'alphabet ne m'est pas parvenu » sont indistinguables : il devinait, et donnait 440 Hz au
 * symbole STRUCTUREL `A` d'une grammaire qui se déclare « test de grammaire pure ».
 * Rayon mesuré avant correctif : 10 scènes sur 95, et TOUTES en `@test_alphabets.X` — aucune scène
 * en `@alphabet.X` n'était touchée.
 *
 * L'ADRESSE, PAS L'ARDOISE — même règle qu'en portée acteur (`emitActorLibRefs`) et même raison :
 * un nom nu n'est cherché que dans le catalogue STANDARD, donc il ne mènerait nulle part ; seule
 * l'adresse `<lib>.<entrée>` porte la provenance. `ast.libRefs` est le canal neutre du contrat
 * (bpx-kairos-arbre §2.1), et BPx le transporte tel quel jusqu'à `scenePitch.libRefs`
 * (`session.ts:2144`).
 *
 * La directive d'origine RESTE : ce n'est pas une ardoise, c'est la déclaration qui CHARGE la
 * librairie pour le pipeline interne (résolution d'acteur, validation des terminaux).
 */
/**
 * MÈTRE DE SCÈNE — la scène pose le DÉFAUT, la règle le RECOUVRE pour elle seule.
 *
 * Ce n'est pas un arbitrage neuf : c'est la CASCADE PAR PORTÉE qui gouverne déjà tout le langage
 * (`lib/controls.json` se déclare « layered by scope » ; `hub/decisions/2026-06-26-kai9-adresse-dans-
 * arbre.md:17-19` : « override sur les détails, EN CASCADE PAR PORTÉE » ; `LANGUAGE.md:103` emploie
 * la même formule pour le transport). Il n'y avait rien à inventer, seulement à retrouver.
 *
 * POURQUOI L'ÉMETTRE SUR LA RÈGLE plutôt que de laisser la directive de scène parler : le
 * consommateur lit le mètre dans les QUALIFICATIFS DE LA RÈGLE (BPx `loadGrammar.ts:4136-4143`,
 * `parseMeterSignature`), jamais dans les directives. Une directive de scène qui n'atteint aucune
 * règle n'atteint personne — c'était l'état mesuré : `@meter:4/4` compilait et n'était consommé
 * par rien.
 *
 * Une règle qui porte déjà un mètre n'est PAS touchée : c'est le recouvrement.
 */
/**
 * GARDE DE LA CORRESPONDANCE `@map` — une extrémité PORTÉE doit nommer quelque chose de déclaré.
 *
 * MESURÉ le 2026-07-26 (signalé par bp3-frontend) : `@map foobar.X -> sync1` compilait. La
 * directive arrive pourtant bien dans l'arbre — dans `ast.maps`, pas dans `ast.directives`, ce qui
 * avait fait conclure à tort qu'elle ne portait rien. Le défaut n'est donc pas un silence de
 * transport : c'est l'ABSENCE DE VALIDATION du référent. N'importe quel mot passait.
 *
 * CE QUI EST DÉCLARABLE, selon `docs/design/SCENES.md` §6.1-6.2 — on ne crée aucune forme, on
 * vérifie celles qui existent :
 *   `verse.kick`  → `verse` est une SCÈNE déclarée (`@scene verse`) ;
 *   `kick.vel`    → `kick` est un LABEL posé sur des éléments (`C4@kick`) ;
 *   `*.kick.vel`  → toutes les scènes.
 * Un mot qui n'est aucun des trois ne désigne rien, et le taire fabrique une correspondance morte.
 *
 * ⚠️ CE QUE CETTE GARDE NE FAIT PAS : elle ne dit pas COMMENT une note entrante se déclare comme
 * source (`@map note.C#2`). C'est une forme à créer, et cette question est chez Romain. Ici on
 * ferme le silence, on ne remplit pas le vide : `note.C#2` tombe donc, faute de référent déclaré,
 * et c'est le bon comportement tant que la forme n'existe pas.
 */
function validateMaps(ast) {
  const erreurs = [];
  if (!(ast.maps || []).length) return erreurs;
  const connus = new Set(['*']);
  for (const sc of ast.scenes || []) if (sc && sc.name) connus.add(sc.name);
  // Les ENTRÉES déclarées (`@in <rôle> …`) sont des portées légitimes pour une source : c'est
  // exactement ce que `@map depart touches.z` désigne — le rôle `touches`, et son étiquette `z`.
  for (const e of ast.inputs || []) if (e && e.name) connus.add(e.name);
  const collecterLabels = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(collecterLabels); return; }
    if (typeof n.label === 'string' && n.label) connus.add(n.label);
    for (const k in n) if (n[k] && typeof n[k] === 'object') collecterLabels(n[k]);
  };
  collecterLabels(ast.subgrammars);
  // Une extremite NUE (`@map cc:1 -> sync1`) est lue comme un ALIAS : un nom seul. Elle n'etait
  // validee par rien — `@map nimportequoi -> nimportequoi2` passait entier. Mesure d'Atlas
  // confirmee le 2026-07-26. Ce qu'un nom nu peut designer, selon SCENES.md §6.1 : un alias
  // declare, un trigger/gate/cv declare, un label pose, une scene, une macro.
  for (const d of ast.declarations || []) if (d && d.name) connus.add(d.name);
  for (const m of ast.macros || []) if (m && m.name) connus.add(m.name);
  const verifierNu = (bout, cote, ligne) => {
    if (!bout || bout.kind !== 'alias' || connus.has(bout.name)) return;
    erreurs.push({
      message: `'@map' : ${cote} '${bout.name}' ne désigne rien — un nom nu doit être une ENTRÉE `
        + `déclarée ('@in ${bout.name} transport.<canal>'), un trigger ou un gate déclaré, un label `
        + `posé sur un élément, une scène ou une macro`
        + ([...connus].length ? ` ; connus ici : ${[...connus].filter((x) => x !== '*').join(', ') || '(aucun)'}` : ''),
      line: ligne,
    });
  };
  const verifier = (bout, cote, ligne) => {
    verifierNu(bout, cote, ligne);
    if (!bout || bout.kind !== 'scoped' || connus.has(bout.scope)) return;
    erreurs.push({
      message: `'@map' : ${cote} '${bout.scope}.${bout.name}' ne désigne rien — '${bout.scope}' n'est `
        + `ni une scène déclarée, ni un label posé sur un élément (\`C4@${bout.scope}\`), ni '*'`
        + (connus.size > 1 ? ` ; connus ici : ${[...connus].filter((x) => x !== '*').join(', ') || '(aucun)'}` : ''),
      line: ligne,
    });
  };
  // Une liaison porte désormais UN NOM et UNE SOURCE (décision 2026-07-27) : il n'y a plus de
  // « cible » à vérifier — le nom EST la cible, et il est créé par la déclaration elle-même.
  for (const m of ast.maps) verifier(m.source, 'la source', m.line);
  return erreurs;
}

function emitSceneMeter(ast) {
  const dir = (ast.directives || []).find((d) => d && d.name === 'meter' && d.value != null);
  if (!dir) return;
  const valeur = String(dir.value);
  for (const sg of ast.subgrammars || []) {
    for (const r of sg.rules || []) {
      const porteDeja = (r.qualifiers || []).some((q) => (q.pairs || []).some((p) => p && p.key === 'meter'));
      if (porteDeja) continue;   // la règle recouvre le défaut de scène, pour elle seule
      r.qualifiers = r.qualifiers || [];
      r.qualifiers.push({
        type: 'Qualifier',
        pairs: [{ type: 'QualPair', key: 'meter', value: valeur, decrement: null }],
        tempoOp: null,
      });
    }
  }
}

function emitSceneLibRefs(ast) {
  const axesHauteur = new Set(['alphabet', 'tuning', 'octaves', 'scale']); // portés par un autre canal
  const refs = [];
  for (const d of ast.directives || []) {
    if (!d || !d.name || !d.subkey || axesHauteur.has(d.name)) continue;
    // Une directive dont le NOM est une librairie chargeable et dont le POINT nomme une entrée
    // résoluble : c'est une invocation par provenance.
    const entree = loadLib(d.name, d.subkey);
    if (!entree) continue;
    // ⚠️ Le filtre exigeait `entree.notes` — il ne laissait donc passer QUE les alphabets, pour
    // lesquels je l'avais écrit. `@sound.tabla_perc` résolvait sans rien émettre : l'invocation
    // était acceptée et ne PRODUISAIT rien. Accepter n'est pas transmettre — c'est le même défaut
    // que la directive de mètre qui parlait dans le vide. Corrigé le 2026-07-26 : toute entrée
    // résoluble émet son adresse, quel que soit ce qu'elle contient.
    const adresse = `${d.name}.${d.subkey}`;
    if (!refs.includes(adresse)) refs.push(adresse);
  }
  // TABLE DE CORRESPONDANCE d'une ENTRÉE (`@in pedale transport.midi mapping.<table>`). C'est une
  // invocation de librairie comme une autre : son ADRESSE doit sortir, sinon la scène « déclare »
  // une table que l'aval ne voit jamais. Accepter n'est pas transmettre.
  //
  // ⚠️ ELLE SORT MÊME QUAND L'ENTRÉE NE RÉSOUT PAS, et c'est délibéré pour l'instant :
  // `lib/mapping.json` est volontairement VIDE tant que Romain n'a pas donné de vraie table
  // (arbitrage 2026-07-27), donc exiger la résolution refuserait TOUS les exemples ratifiés.
  // Le cri sur entrée inconnue est un chantier ouvert, tranché mais séquencé derrière un
  // renommage chez Kanopi — quand il arrivera, il vaudra ici comme ailleurs.
  for (const e of ast.inputs || []) {
    if (!e || !e.mapping) continue;
    const adresse = `mapping.${e.mapping}`;
    if (!refs.includes(adresse)) refs.push(adresse);
  }
  if (refs.length === 0) return;
  ast.libRefs = [...(ast.libRefs || []), ...refs.filter((r) => !(ast.libRefs || []).includes(r))];
}

/**
 * Retire l'ardoise `alphabet` des SEULS acteurs qui portent une adresse — en TOUT DERNIER.
 *
 * POURQUOI SI TARD. `properties.alphabet` a deux lecteurs qu'il ne faut pas confondre : le
 * pipeline INTERNE de BPScript (résolution d'acteur, validation des terminaux), qui tourne
 * jusqu'au bout de `compileToBPxAST`, et l'AVAL. Retirer le champ à l'émission de l'adresse
 * couperait le premier ; le retirer ici ne touche que le second.
 *
 * POURQUOI LE CHAMP ET PAS SEULEMENT LA RÉFÉRENCE. Mesuré chez BPx : `pickActorAlphabet`
 * (`loadGrammar.ts:3694`) lit `properties.alphabet` D'ABORD et ne regarde `references[]` qu'à
 * défaut. Filtrer la seule référence ne changeait donc RIEN — Kairos criait la même collision,
 * au mot près. C'est cette voie v0.7 encore préférée qui portait l'ardoise jusqu'à lui.
 *
 * PORTÉE, mesurée et non supposée : les acteurs qui émettent une adresse, et EUX SEULS — un
 * sur tout le corpus des 95 aujourd'hui (`tryKeyMap`, acteur `bols`). Toutes les autres scènes
 * sortent octet pour octet identiques, ce qui est vérifié plus bas par le bilan inchangé.
 */
function retirerArdoiseAlphabet(ast) {
  for (const actor of ast.actors || []) {
    if (!actor.libRefs || !actor.libRefs.length) continue;
    if (actor.properties) delete actor.properties.alphabet;
    if (Array.isArray(actor.references)) {
      actor.references = actor.references.filter((r) => r && r.category !== 'alphabet');
    }
  }
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
    resolveHomomorphismMarkers(ast);  // symbole nu → marqueur d'invocation d'homo par nom (AVANT les validateurs : le marqueur n'est pas un terminal)
    emitActorLibRefs(ast);           // provenance des liaisons d'acteur → `actors[].libRefs` (contrat bpx-kairos-arbre §2.1)
    result.errors.push(...validateMaps(ast));  // `@map` : une extrémité portée doit nommer un référent déclaré
    emitSceneMeter(ast);             // `@meter` de scène → défaut sur chaque règle qui n'en porte pas (cascade par portée)
    emitSceneLibRefs(ast);           // idem en portée SCÈNE : `@test_alphabets.X` → `ast.libRefs` (sinon l'alphabet n'arrive jamais)
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

    // LE DIAGNOSTIC PRÉCIS SUBSUME LE GÉNÉRIQUE (arbitrage architecte [778]).
    //
    // Une quasi-faute comme `(cutof:env1)` déclenchait DEUX messages : le générique
    // « attribut '(cutof:…)' inconnu — ni contrôle, ni valeur… » et le ciblé « 'cutof' n'est
    // pas une entrée de modulation (connues : cutoff, amplitude, resonance, pitch, pan) ».
    // Le second dit tout ce que dit le premier, PLUS la liste des formes attendues : le
    // générique n'ajoute rien et noie le seul message utile.
    // On le retire donc pour les clés qui ont déjà un diagnostic nommé. Une clé sans
    // diagnostic ciblé garde évidemment le générique — c'est le seul qu'elle ait.
    {
      const genericRe = /^attribut '\((.+?):…\)' inconnu/;
      const clesDiagnostiquees = new Set(
        result.errors
          .filter((e) => e && typeof e.message === 'string' && !genericRe.test(e.message))
          .map((e) => (e.message.match(/^'(.+?)'/) || [])[1])
          .filter(Boolean),
      );
      if (clesDiagnostiquees.size > 0) {
        result.errors = result.errors.filter((e) => {
          const m = e && typeof e.message === 'string' ? e.message.match(genericRe) : null;
          return !(m && clesDiagnostiquees.has(m[1]));
        });
      }
    }

    // Découpeur frontal mono-char (flip Palier 4, étape A) — EN DERNIER :
    // annotateBackticks et les validateurs ci-dessus voient l'AST NON découpé,
    // exactement comme quand la découpe vivait en aval dans BPx.
    splitCompoundTerminals(ast, libCtx);
    retirerArdoiseAlphabet(ast);  // EN DERNIER : l'adresse remplace l'ardoise pour l'aval, jamais pour le pipeline interne
  } catch (e) {
    if (e instanceof ParseError) result.errors.push({ message: e.message, line: e.token && e.token.line });
    else throw e;
  }
  return result;
}

export default compileToBPxAST;
