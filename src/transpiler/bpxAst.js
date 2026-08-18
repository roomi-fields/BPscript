// bpxAst.js — Production de l'AST BPx (mode PROPRE, sans l'ancien format BP3).
//
// POURQUOI (directive Romain 2026-06-17). Deux modes / deux sorties TOTALEMENT
// SÉPARÉS, pour la cohérence, la propreté et la performance :
//   - `compileBPS()` (index.js) = ancienne voie : parse + ENCODE → grammaire BP3.
//     Fonction héritée (voie 2) — SUPPRIMÉE le 2026-07-19 (cf. index.js:7-16, commit
//     1b974f5) ; ce paragraphe documente pourquoi compileToBPxAST n'en a jamais dépendu.
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
// les nœuds/directives (backticks sur le nœud ; les réglages de tête dans les directives).

import { tokenize, LexError } from './tokenizer.js';
import { parse, ParseError } from './parser.js';
import { loadLibsFromDirectives, loadLib, resolveActorAlphabet, resolveActorAlphabetSource, describeVocabulary, universeControlNames, nomsDeTerminaux, groupeDUnicite} from './libs.js';
import { LIBS } from './libs-data.js';
import { segmenter } from './segmentation.js';

// ⛔ LE RESTE INCONSOMMÉ NE VOYAGE PAS DANS L'ARBRE. La segmentation le connaît, le refus le nomme,
// et entre les deux il vit ICI — hors des nœuds. Un champ posé sur un nœud SORT chez BPx et Kairos :
// ce serait une surface publiée que rien ne déclare, et ce que j'expose est déclaré.
const restesDeSegmentation = new WeakMap();
import { resolveActors, expandAlphabetTerminals, alphabetHerite, octavesHerite, tuningHerite,
         sortieHeritee, evalHerite, defaultActorTransport } from './actorResolver.js';
import { validateControls } from './controlValidation.js';
import { validateModulation } from './modulationValidation.js';

/**
 * POSE LE DESTINATAIRE DE CHAQUE RÉGLAGE SUR LE SAC QUI LE PORTE.
 *
 * CE QUE ÇA RÉPARE. Un sac de réglages voyageait avec sa NATURE et sa PORTÉE, jamais avec sa
 * DESTINATION : `!(vel:50)` arrivait en aval indistinguable de `!(chan:3)` et de
 * `!(transpose:3/2)`, alors que les trois vont à trois outils différents — toutes les sorties, le
 * runtime MIDI, Kairos. Seul le NOM de la clé les séparait, donc tout consommateur devait
 * redeviner la destination avec une table recopiée chez lui. Une table recopiée dérive : le jour
 * où une clé change de librairie, rien ne rougit et le réglage part au mauvais destinataire SANS
 * ERREUR. L'information existait pourtant depuis toujours, dans le champ `resolvedBy` de la
 * librairie déclarante — elle s'arrêtait au chargeur.
 *
 * LA FORME EST UNE TABLE, PAS UNE VALEUR, et la mesure l'impose : un sac unique peut mélanger
 * les destinataires — `!(vel:50, transpose:3/2, volume:90)` en réunit trois. Une valeur seule
 * aurait donc obligé à en choisir une et à taire les autres. `resolvedBy` est parallèle à
 * `params`, clé pour clé.
 *
 * LE NOM EST CELUI DE LA SOURCE, délibérément : la librairie écrit `resolvedBy`, le sac écrit
 * `resolvedBy`, la valeur est portée VERBATIM. Aucune traduction, donc aucune table de
 * correspondance à tenir entre deux vocabulaires.
 *
 * ⚠️ CE QUI N'EST PAS ANNOTÉ EST UNE ABSENCE ASSUMÉE, JAMAIS UNE INVENTION. Un contrôleur nommé
 * par la scène (`cc mon_nom:98`) n'est déclaré par aucune librairie : il n'a pas de destinataire
 * lisible, et sa clé reste donc hors de la table plutôt que d'en recevoir un supposé. Le trou est
 * visible, ce qui est le but.
 */
function poserLeDestinataireDesReglages(ast, libCtx) {
  const table = libCtx?.controlResolvedBy || {};
  const tableQualifiee = libCtx?.controlQualifiedResolvedBy || {};
  const vu = new Set();
  const walk = (n) => {
    if (!n || typeof n !== 'object' || vu.has(n)) return;
    vu.add(n);
    if (Array.isArray(n)) { for (const x of n) walk(x); return; }
    const params = n.payload && n.payload.params;
    if (params && typeof params === 'object') {
      // ⚠️ LE PRÉFIXE DÉCIDE DU DESTINATAIRE, ET C'EST TOUT CE POUR QUOI IL EXISTE. La table par nom
      // NU rend la déclaration chargée en DERNIER : `expression.pan` en recevait le destinataire
      // d'`audio`, donc la scène compilait et le réglage partait quand même au mauvais outil — un
      // préfixe accepté et ignoré, le pire des deux mondes. Trouvé par le garde en naissant.
      // Les paires portent `lib` quand l'auteur l'a écrit ; on les lit sur le nœud ET sur ses sacs
      // collés, un sac portant ses propres paires repliées.
      const origine = new Map();
      const noter = (liste) => { for (const pr of liste || []) if (pr && pr.lib) origine.set(pr.key, pr.lib); };
      noter(n.pairs);
      for (const sq of (n.suffixQualifiers || [])) noter(sq && sq.pairs);
      const dest = {};
      for (const cle of Object.keys(params)) {
        const lib = origine.get(cle);
        const qualifie = lib ? tableQualifiee[`${lib}.${cle}`] : undefined;
        if (qualifie) dest[cle] = qualifie;
        else if (table[cle]) dest[cle] = table[cle];
      }
      if (Object.keys(dest).length) n.payload.resolvedBy = dest;
    }
    for (const v of Object.values(n)) walk(v);
  };
  walk(ast);
}

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
 *     tête de sa règle (`actor drums eval.strudel` → 'strudel'). Scellé DANS LE PAYLOAD (pas en
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
  // ⚠️ ET LES CORPS DE MACRO, qui n'étaient parcourus PAR RIEN. Un bloc de code y voyageait sans
  // nature et sans langage — ni étiqueté, ni refusé : muet de bout en bout. Mesuré le 2026-07-28
  // sur une question de Romain, qui décrit la macro comme une façon LÉGITIME d'associer un nom à
  // du code (« pour ne pas avoir à écrire le code dans les règles »). Une écriture qu'on veut
  // légitime ne peut pas être le seul endroit où le langage n'est jamais vérifié.
  // Coût mesuré AVANT : 0 scène sur 442 porte du code dans un corps de macro.

  // 2. Résolution 'auto' → eval de L'ACTEUR QUI QUALIFIE LE BLOC (sur payload.interp).
  //
  // ⚠️ CE CHEMIN A CHANGÉ LE 2026-07-28. Il lisait le nom de la TÊTE DE RÈGLE et le cherchait dans
  // la table des acteurs : c'est ce qui obligeait à nommer une règle comme un acteur — l'amalgame
  // que Romain a qualifié d'erreur grave, et que la règle d'unicité refuse désormais. Ce chemin
  // était donc DEVENU MORT : une tête ne peut plus porter un nom d'acteur.
  // Il est remplacé, pas doublé : le langage vient de l'acteur qui QUALIFIE le bloc par le point
  // (`drums.\`note("c3")\``), là où il qualifie déjà une note (`sitar.Sa`). Un nom de règle
  // redevient une étiquette pour appeler la règle, et rien d'autre.
  const acteurEval = {};
  for (const a of ast.actors || []) if (a.properties && a.properties.eval) acteurEval[a.name] = a.properties.eval;
  const resoudre = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== 'object') continue;
      if (isBt(el) && el.payload && el.payload.interp === 'auto' && el.actor && acteurEval[el.actor]) {
        el.payload.interp = acteurEval[el.actor];
      }
      if (el.elements) resoudre(el.elements);
      if (el.voices) for (const v of el.voices) resoudre(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) resoudre(rule.rhs);

  // 3. FAIL-LOUD orphelin (décision CV-curve 2026-07-04 + ajustement [299]) : un backtick
  //    de flux resté `interp:'auto'` n'a NI tag NI eval d'acteur en tête → langage inconnu,
  //    jamais deviné. Erreur claire (non fatale : l'AST reste produit, Kanopi l'affiche).
  const errors = [];
  const scanOrphans = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== 'object') continue;
      if (isBt(el) && el.payload && el.payload.interp === 'auto') {
        errors.push({
          message: `Backtick sans langage — il doit être connu, jamais deviné. Deux façons de le `
                 + `dire : un TAG dans le bloc (\`js: …\`), ou un ACTEUR qui qualifie le bloc par le `
                 + `point (\`drums.\`…\`\`, avec 'actor drums eval.<moteur>'). Le second porte AUSSI `
                 + `l'identité de la voix, que le tag seul ne donne pas.`,
          line: el.line,
        });
      }
      if (el.elements) scanOrphans(el.elements);
      if (el.voices) for (const v of el.voices) scanOrphans(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) scanOrphans(rule.rhs);
  // Même portée que l'étiquetage : un corps de macro est un endroit où du code peut s'écrire,
  // donc un endroit où son langage doit être connu. Il n'a pas de tête de règle dont hériter —
  // le tag est donc, aujourd'hui, la seule façon d'y dire le langage.
  return errors;
}

/**
 * Produit l'AST BPx depuis le source `.bps`, SANS l'ancien format BP3 et SANS table
 * parallèle : tout vit DANS L'ARBRE (source unique, directive Romain 2026-06-17).
 * Les consommateurs lisent directement les nœuds/directives :
 *   - backticks → nœuds (`_btName`, `code` en tête ; `payload.interp` + `payload.nature:'code'`) ;
 *   - drapeaux nommés → `ast.vars` (`VarDirective` de `varType.kind === 'flag'`, ex-`@flag`) ;
 *   - librairies → directives d'invocation (`alphabet.X`, `tuning.Y`…) ;
 *   - scènes/expose/tempo → `ast.scenes` / `ast.exposes` / `tempo` ;
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
 *   et BPx via la directive `tempo` (Kanopi ; BPx loadGrammar). Les autres
 *   réglages (octave, division…) s'ajouteront ici dès que leur cible AST + lecteur
 *   seront définis.
 *
 * @param {object} ast  AST de scène (muté en place)
 * @param {{ tempo?: number }} [env]  défauts d'environnement portés par Kanopi
 */
function applyEnvironmentDefaults(ast, env) {
  if (!ast || !env || typeof env !== 'object') return;

  // tempo → directive `tempo`, le seul nom du métronome depuis le 2026-08-10 (avant cette date
  // le métronome porte un seul nom). On n'inscrit le défaut que si la scène ne déclare aucun tempo.
  if (env.tempo != null && !hasTempoDirective(ast)) {
    (ast.directives = ast.directives || []).push({
      type: 'Directive',
      name: 'tempo',
      subkey: null,
      runtime: null,
      value: env.tempo,
      modifiers: null,
      fromEnvironment: true,   // provenance : défaut d'environnement, pas déclaré dans la source
      line: 0,
    });
  }
}

/** Vrai si la scène déclare déjà un tempo. Un seul nom depuis le 2026-08-10 : `tempo`. */
function hasTempoDirective(ast) {
  return (ast.directives || []).some(
    (d) => d && d.type === 'Directive' && d.name === 'tempo'
  );
}

// ============================================================================
// Frontière AST (Palier 3, décision architecte 2026-07-02) — canonicalisation
// des CONTEXTES pour la voie BPx SEULE. Jusqu'à sa suppression le 2026-07-19
// (commit 1b974f5), parser.js/encoder.js restaient INTACTS : la sortie BP3
// héritée (compileBPS) était GELÉE (le texte .grammar servait d'oracle
// de parité), or la forme canonique RHS jette le nom du symbole nié (`#a` →
// joker nié) et aurait changé ce texte. D'où la transformation ICI — compileToBPxAST
// est la couche d'émission BPx de BPScript ; compileBPS (supprimé) ne passait jamais par elle.
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
//       `elements` TYPÉS (canonique) + GARDE `symbols` (deprecated) en MIROIR
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
// À L'ÉMISSION (voie BPx seule — compileBPS/encoder.js, supprimés le 2026-07-19,
// commit 1b974f5). Oracle
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

// `defaultActorTransport` VIT DÉSORMAIS AVEC LES AUTRES CASCADES (actorResolver.js, 2026-08-07) :
// c'est le niveau 1 de l'axe SORTIE, il n'avait aucune raison d'être seul de son côté.

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
 * injectait un acteur synthétique `{name:'scene', transport:audio}` quand aucun @actor
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
// dans l'AST (acteur : `props.alphabet` ; scène : injection d'une directive `alphabet.Y.alphabet`).
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
// n'appartient à aucun alphabet effectif (ex. `C4` dans une scène `alphabet.sargam`), et qui
// n'est ni un non-terminal, ni un symbole déclaré, ni du code → CRIE à la compilation.
// Union des alphabets effectifs = SÛRE (pas de faux positif cross-acteur).
/**
 * Résolution de l'invocation d'homomorphisme par SYMBOLE NU (ratifié Romain 2026-07-17).
 * Un Symbol de RHS dont le nom = une section d'homomorphisme chargée (@homomorphism.<X>),
 * et qui n'est NI un non-terminal (LHS de règle) NI un terminal d'alphabet en portée
 * (précédence RATIFIÉE terminal > règle > homo, contrat bpscript-bpx L31), devient un
 * MARQUEUR per-occurrence : on pose `role:'homomorphism'` sur le nœud (type Symbol conservé,
 * il reste un élément positionnel du flux). BPx compte les occurrences en portée (profondeur
 * k) et applique chains[note][k-1] (ou les paires). La RÉPÉTITION du symbole EST la
 * profondeur — aucun index posé ici. Passe BPx-ONLY : jusqu'à la suppression de
 * compileBPS le 2026-07-19 (commit 1b974f5), le chemin BP3 hérité reparsait
 * indépendamment et ne voyait jamais ce champ → byte-id préservé.
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
    if (!lib || !nomsDeTerminaux(lib)) return;
    for (const t of expandAlphabetTerminals(lib, octaves)) terminals.add(t);
    const alts = lib.alterations && typeof lib.alterations === 'object' && !Array.isArray(lib.alterations)
      ? Object.keys(lib.alterations) : [''];
    for (const note of nomsDeTerminaux(lib)) for (const alt of alts) terminals.add(note + alt);
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

/**
 * Les terminaux de TOUS les alphabets effectifs de la scène — UNE seule définition.
 *
 * Deux gardes en ont besoin et posent la MÊME question : « ce mot est-il une note ici ? ».
 * `validateTerminals` la pose sur un mot écrit dans une règle ; la garde des noms de macro la pose
 * sur un nom déclaré. Dupliquer le calcul, c'est se garantir qu'un jour l'une acceptera ce que
 * l'autre refuse — la dérive qu'on paie ailleurs, appliquée aux garde-fous eux-mêmes.
 *
 * « Effectif » = l'alphabet de la scène ET celui de chaque acteur. Les deux formes comptent :
 * décorée du registre (`madhya_sa`) et nue (`sa`), parce que les deux s'écrivent.
 */
function terminauxEnPortee(ast) {
  const terminaux = new Set();
  // ⛔ UN PAQUET PAR ALPHABET, EN PLUS DE L'UNION. La validation demande « ce nom est-il connu »,
  // et l'union y répond. La SEGMENTATION demande autre chose : « ce mot tient-il dans UN
  // vocabulaire » — décision de Romain du 2026-08-16, un mot se segmente entièrement dans un seul
  // alphabet. Sur l'union, `taC4` se lirait `ta` (tabla) + `C4` (occidental), un mot construit avec
  // des morceaux de deux langues.
  const paquets = [];
  const ajouter = (name, octaves) => {
    const lib = resolveActorAlphabet(name, ast.directives);
    if (!lib || !nomsDeTerminaux(lib)) return false;
    const paquet = new Set();
    for (const t of expandAlphabetTerminals(lib, octaves)) { terminaux.add(t); paquet.add(t); }
    const alts = lib.alterations && typeof lib.alterations === 'object' && !Array.isArray(lib.alterations)
      ? Object.keys(lib.alterations) : [''];
    for (const note of nomsDeTerminaux(lib)) for (const alt of alts) { terminaux.add(note + alt); paquet.add(note + alt); } // forme nue
    paquets.push(paquet);
    return true;
  };
  let aUnAlphabet = false;
  // ⚠️ UNE SCÈNE NE DÉCLARE QU'UN ALPHABET — tranché par Romain le 2026-08-07 : « on ne déclare
  // pas plusieurs acteurs implicites, un seul ; sinon c'est explicite. » Un acteur porte UN
  // alphabet et UNE sortie ; deux vocabulaires appellent donc deux acteurs, et deux acteurs se
  // DÉCLARENT. Le second `alphabet` de scène est refusé plus bas (`refuserAlphabetsMultiples`),
  // il n'est plus ignoré en silence — c'est pour ça qu'on lit le premier sans remords.
  const sceneAlpha = (ast.directives || []).find((d) => d.name === 'alphabet' && d.subkey);
  const sceneOct = (ast.directives || []).find((d) => d.name === 'octaves' && (d.subkey || d.runtime));
  if (sceneAlpha) {
    aUnAlphabet = ajouter(sceneAlpha.subkey, sceneOct ? (sceneOct.subkey || sceneOct.runtime) : null)
                || aUnAlphabet;
  }
  for (const a of ast.actors || []) {
    const p = a.properties || {};
    if (p.alphabet) aUnAlphabet = ajouter(p.alphabet, p.octaves || null) || aUnAlphabet;
  }
  // ⛔ UNE INVOCATION MET SON VOCABULAIRE EN PORTEE — une seule ligne suffit.
  //
  // `test_alphabets.abc` DESACTIVAIT la validation au lieu de l'activer : la scene sortait avec
  // ZERO terminal, `validateTerminals` revenait avant tout controle, et n'importe quel symbole
  // passait. Il fallait ecrire `alphabet.abc` EN PLUS, ce que rien ne justifiait — le nom du
  // fichier et celui de l'entree disent deja tout.
  //
  // ⚠️ ET LA SECONDE LIGNE COUTAIT DEUX FOIS : elle faisait REFUSER la projection chez Kairos
  // (collision de domaine, deux surfaces pour un seul slot) tout en donnant un faux vert ici.
  // Une ligne qui repare la compilation et casse la projection n'est pas une contrainte, c'est le
  // symptome d'un defaut.
  //
  // `ajouter` refuse une entree sans terminaux : `sound.X`, `homomorphism.X` et `eval.X` ne
  // mettent donc RIEN en portee, et ce qui EST un alphabet en charge un.
  for (const ref of ast.libRefs || []) {
    const parts = String(ref).split('.');
    // ⚠️ L'ENTREE SE CHERCHE DANS LA LIBRAIRIE INVOQUEE, jamais partout. Sans cette borne,
    // `homomorphism.dhati` chargeait l'alphabet `dhati` du catalogue de test — un nom porte par
    // deux librairies de natures differentes, et la mise en portee prenait la mauvaise.
    const lib = loadLib(parts.slice(0, -1).join('.'), parts[parts.length - 1]);
    if (!lib || !nomsDeTerminaux(lib)) continue;
    aUnAlphabet = ajouter(parts[parts.length - 1], sceneOct ? (sceneOct.subkey || sceneOct.runtime) : null) || aUnAlphabet;
  }
  // ⛔ UN TERMINAL DÉCLARÉ PAR `def` ENTRE AU VOCABULAIRE — sinon la directive ne sert à rien.
  //
  // `LANGUAGE.md` §« Déclarer un terminal » : « un terminal se déclare avec `def` et un bloc de
  // clés ». Une déclaration qui n'ajoute pas son nom au vocabulaire est une porte nommée qui ne
  // change RIEN : la scène compile la directive, puis refuse le symbole qu'elle vient de déclarer.
  // Mesuré le 2026-08-08, juste après l'ouverture de `def` : `def ka voice.sec` puis `S -> ka`
  // rendait « terminal 'ka' non déclaré ». La directive était lue, rangée dans l'arbre, et
  // ignorée du seul contrôle qui la concernait.
  //
  // ⚠️ ET C'EST LE CŒUR DU CHANTIER, PAS UN DÉTAIL. Cinq directives sortent du langage, et `gate`
  // — 119 lignes sur 14 scènes — déclarait précisément des terminaux avec leur sortie. Sans cette
  // ligne, la cible de migration accepte la déclaration et refuse l'usage : le pire des deux
  // mondes, un mur avec une porte peinte dessus.
  // Un terminal declare par `def` appartient a la SCENE, pas a un alphabet : il est en portee
  // partout, donc il rejoint chaque paquet. Un mot peut le meler aux bols de l'alphabet actif sans
  // pour autant traverser deux alphabets.
  for (const d of ast.directives || []) {
    if (d && d.type === 'DefDirective' && d.kind === 'terminal' && d.name) {
      terminaux.add(d.name);
      for (const paquet of paquets) paquet.add(d.name);
    }
  }
  return { terminaux, aUnAlphabet, paquets };
}

/**
 * LA VOIX D'UN TERMINAL ARRIVE JUSQU'À L'ARBRE — cascade terminal, puis alphabet.
 *
 * ⛔ ACTE DE ROMAIN, 2026-08-08 : « tout est dans les PROPRIÉTÉS DU TERMINAL — ou pas, et c'est
 * alors résolu par les principes d'override. Et `def`/`voice` doit AUSSI être correctement
 * implémenté dans TOUS LES ALPHABETS. »
 * C'est la suite directe de la décision du 2026-08-01 : « un alphabet est une collection
 * structurée de terminaux », et `voice` n'est PAS une clé d'acteur — c'est le terminal qui la
 * porte, et l'alphabet qui les organise.
 *
 * ⚠️ CE QUE ÇA DÉBLOQUE, ET C'EST UN AGENT ENTIER ARRÊTÉ DEPUIS QUATRE HEURES. Kairos assurait le
 * DISPATCH DU SON — quelle voix joue quel symbole — en lisant la table des macros ; `macro` sort
 * du langage, la table n'existe plus, et il n'a rien à la place. La réponse était déjà dans la
 * spécification ; c'est l'implémentation qui manquait.
 *
 * ⚠️ DEUX ALPHABETS DÉCLARENT DÉJÀ LEURS VOIX EN DONNÉE — `tabla` associe `dha` à `bayan_open`,
 * `tryCsoundObjects` ses sept objets — et RIEN NE LES LISAIT ICI : la seule occurrence de
 * `.voices` dans ce dépôt désigne les voix d'un groupe polymétrique, sans rapport.
 *
 * ⛔ J'AI ÉCRIT « CETTE TABLE N'EST LUE PAR PERSONNE », ET C'ÉTAIT FAUX. Kairos l'a mesuré et me
 * l'a rendu : il la lit depuis JUIN — `resoudre-voix.ts:121`, sa voie (b), avec un témoin
 * bout-en-bout à lui. La donnée n'était pas morte : elle alimentait sa résolution de voix.
 * J'avais mesuré MON dépôt et conclu pour LE SIEN — la faute exacte que je remonte aux autres,
 * et la seconde fois de la journée. Ce qui était vrai : rien ne la lisait CHEZ MOI.
 *
 * ⚠️ ET ÇA OUVRE UNE QUESTION QUE JE NE TRANCHE PAS, la sienne : NOUS SOMMES DEUX À RÉSOUDRE LE
 * MÊME BINDING, depuis la même table, avec des précédences DIFFÉRENTES — la sienne va de l'acteur
 * à l'alphabet, la mienne du terminal à l'alphabet. Un acteur qui nomme une voix et un alphabet
 * qui en nomme une autre ne donnent pas le même résultat selon le chemin. Aujourd'hui l'écart ne
 * se voit pas (il ne lit pas encore ce champ) ; le jour où il le lira, il se verra.
 * Question portée à Romain : QUI résout le binding d'alphabet. Les deux réponses se défendent ;
 * ce qui ne se défend pas, c'est les deux à la fois.
 *
 * L'ORDRE DE RÉSOLUTION, du plus local au plus général :
 *   1. le terminal le nomme lui-même   (`def ka  voice.sec`)
 *   2. son alphabet le nomme pour lui  (`alphabets.json`, table `voices`)
 * Un terminal qui n'est nommé nulle part ne reçoit RIEN — l'absence reste une absence, et l'aval
 * la lit comme telle. On n'invente pas une voix par défaut : ce serait le défaut invisible que la
 * cascade des valeurs de scène a coûté le 2026-07-04.
 */
function poserLaVoixDesTerminaux(ast) {
  if (!ast) return;
  // (1) ce que les `def` de la scène déclarent
  const parDef = new Map();
  for (const d of ast.directives || []) {
    if (d && d.type === 'DefDirective' && d.keys && d.keys.voice) parDef.set(d.name, d.keys.voice.value);
  }
  // ⛔ JE NE RÉSOUS PAS LE BINDING D'ALPHABET — Romain, 2026-08-08 : « c'est Kairos, ça n'est pas
  // ton rôle, tu n'en as pas besoin, c'est son rôle. »
  //
  // ⚠️ JE L'AVAIS ÉCRIT, ET C'ÉTAIT PORTER PLUS LOIN QUE MON RÔLE. Ma passe lisait la table
  // `voices` de l'alphabet et posait le résultat sur le terminal. Kairos fait exactement cela
  // depuis JUIN, depuis la même table (`resoudre-voix.ts:121`) — nous étions DEUX à résoudre le
  // même fait, avec des précédences différentes : la sienne va de l'acteur à l'alphabet, la
  // mienne allait du terminal à l'alphabet. Un acteur qui nomme une voix et un alphabet qui en
  // nomme une autre ne donnent pas le même résultat selon le chemin. L'écart ne se voyait pas
  // encore — il ne lit pas ce champ — et se serait vu le jour où il l'aurait lu.
  // C'est lui qui l'a mesuré et remonté ; la décision est de Romain.
  //
  // CE QUI RESTE ICI EST DU PORTAGE, PAS DE LA RÉSOLUTION : une voix ÉCRITE dans la scène par
  // `def <nom>  voice.<voix>` est une déclaration de l'auteur, je la transporte telle quelle.
  // Ce que l'alphabet organise, c'est l'aval qui le résout — « porter ≠ résoudre », et c'est la
  // règle que je passe mes journées à opposer aux autres.
  if (!parDef.size) return;

  const w = (n, vus = new WeakSet()) => {
    if (!n || typeof n !== 'object' || vus.has(n)) return;
    vus.add(n);
    if (Array.isArray(n)) { n.forEach((x) => w(x, vus)); return; }
    if (n.payload && n.payload.nature === 'sounding') {
      const nom = typeof n.symbol === 'string' ? n.symbol : n.name;
      const voix = parDef.get(nom);
      if (voix !== undefined && n.payload.voice === undefined) n.payload.voice = voix;
    }
    Object.values(n).forEach((v) => w(v, vus));
  };
  w(ast.subgrammars);
}

/**
 * LE RECENSEMENT DES NOMS DÉCLARÉS — non-terminaux, définitions, scènes, homomorphismes, motifs
 * temporels, variables de travail.
 *
 * ⚠️ IL EST PARTAGÉ PAR LA VALIDATION ET PAR LA SEGMENTATION, et le partage est le fond du geste :
 * la segmentation doit ÉPARGNER ces noms. Un non-terminal qui s'appelle `taka` n'est pas un mot
 * collé de l'alphabet — le découper le ferait disparaître de sa propre grammaire, sans un signe.
 * Deux recensements côte à côte divergeraient au premier nom ajouté à l'un.
 */
function nomsDeclares(ast) {
  // Symboles DÉCLARÉS : non-terminaux (LHS), déclarations gate/trigger/cv, scènes, homomorphismes.
  const declared = new Set();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) (r.lhs || []).forEach((s) => s && declared.add(s.name));
  for (const d of ast.declarations || []) if (d && d.name) declared.add(d.name);
  // ⛔ UNE DEFINITION EST UN NOM REINVOCABLE — LANGUAGE.md:304 : « def associe un nom a un corps,
  // POUR LE REINVOQUER D UN MOT ». Mesure du 2026-08-09 : `def m C4 D4` puis `S -> m C4` refusait
  // — « terminal 'm' non declare ». Le nom etait donc declare et INUTILISABLE : la moitie du sens
  // de la directive manquait, et le palier ecrit ce matin ne l avait pas vu parce qu il rangeait la
  // definition dans l arbre sans jamais l invoquer.
  // ⚠️ TROUVE EN MIGRANT UN GARDE DE PORTEE, pas en ecrivant la directive. Ce recensement est la
  // seule liste qui autorise un nom dans une regle — et la ligne d a cote recensait encore les
  // objets CV, section supprimee le jour meme : une liste qui gagne des entrees et n en perd
  // jamais finit par decrire un langage qui n existe plus.
  for (const d of ast.directives || []) {
    if (d && d.type === 'DefDirective' && d.name) declared.add(d.name);
  }
  for (const s of ast.scenes || []) if (s && s.name) declared.add(s.name);
  // LES NOMS D'HOMOMORPHISME — le nom INVOQUÉ et les ÉTIQUETTES DE SECTION.
  // ⚠️ `LANGUAGE.md` §« Les tables d'homomorphisme » : « Elle s'applique entre un gabarit maître
  // et son esclave, dont le NOM SE POSE ENTRE LES DEUX » — `S -> $N14 dhati &N14`. Ce nom n'est
  // pas une note : c'est le marqueur qui dit quelle table transforme le rejeu. Il était refusé
  // comme « terminal non déclaré ».
  //
  // ⚠️ ET IL Y AVAIT DÉJÀ UNE BRANCHE POUR ÇA, MORTE : le contrôle testait `el.role !==
  // 'homomorphism'` et RIEN ne posait jamais ce rôle. Deuxième correctif entièrement rédigé et
  // jamais branché trouvé aujourd'hui, après `isEndOfRhs()`. Une branche morte ne rougit pas, ne
  // sert pas, et se lit comme une couverture.
  //
  // DEUX NOMS, PAS UN : une table à section unique s'invoque par son nom (`homomorphism.dhati`
  // → `dhati` dans le flux) et l'arbre la nomme `*` ; une table à sections nommées pose ses
  // ÉTIQUETTES (`checkhomo` → `*`, `H`, `TR`, et les règles écrivent `S -> $X * TR &X Y`).
  // N'en déclarer qu'un laisserait l'autre refusé — c'est la faute « on répare la forme qui s'est
  // montrée » appliquée à un nom.
  for (const d of ast.directives || []) if (d.name === 'homomorphism' && d.subkey) declared.add(d.subkey);
  for (const h of ast.homomorphisms || []) if (h && h.name) declared.add(h.name);
  // Motifs temporels (timepatterns: t1=…) : symboles de flux, pas des terminaux de note.
  for (const d of ast.directives || []) if (d.name === 'timepatterns' && Array.isArray(d.timePatterns)) for (const tp of d.timePatterns) if (tp && tp.name) declared.add(tp.name);
  // VARIABLES DE TRAVAIL (`var`, décision Romain 2026-07-27) : des symboles du flux qui ne sont
  // l'écriture d'aucune note. Elles entrent ici — dans les noms DÉCLARÉS, à côté des non-terminaux
  // — et non dans le vocabulaire d'un alphabet : elles n'ont pas de hauteur, elles ont un NOM.
  // Le refus ne s'affaiblit pas, il gagne une porte nommée : un symbole non déclaré crie toujours.
  // ⚠️ `ast.vars` porte la DIRECTIVE ENTIÈRE (`VarDirective`, AST.md:119-150) depuis le
  // 2026-08-05, pas ses noms nus — une ligne peut en porter PLUSIEURS (`names`).
  for (const v of ast.vars || []) for (const n of v?.names || []) declared.add(n);
  return declared;
}

/**
 * LA PASSE DE SEGMENTATION — elle transforme l'arbre AVANT qu'il soit validé.
 *
 * Un nom collé n'est un mot pour personne : il est dissous avant que la grammaire travaille
 * (mesure de bp3-engine sur le binaire natif). Un nœud devient donc N nœuds, et c'est une
 * transformation de STRUCTURE — pas une commodité d'affichage.
 *
 * ⚠️ ELLE PASSE AVANT `validateTerminals`, et l'ordre est le fond du geste : validée d'abord, la
 * scène serait refusée sur un nom que la segmentation sait lire. Le refus qui subsiste après elle
 * est le bon — c'est celui du reste inconsommable, que le natif nomme aussi.
 */
function segmenterLesTerminaux(ast, known, paquets) {
  // Le premier alphabet qui lit le mot ENTIER gagne. Un mot lisible dans DEUX alphabets n'existe
  // pas au corpus (mesure du 2026-08-16) : rien n'est construit pour un cas qui n'existe pas.
  const lire = (nom) => {
    let echec = null;
    for (const paquet of paquets) {
      const r = segmenter(nom, paquet);
      if (r && r.parts) return r;
      // ⚠️ LE RESTE DU PREMIER ALPHABET EST CONSERVÉ : c'est lui que le refus doit nommer, et le
      // jeter rendrait le message muet sur ce qui manque. Un échec n'est pas une absence de mesure.
      if (r && r.reste && !echec) echec = r;
    }
    return echec;
  };
  // ⛔ LA SEGMENTATION GAGNE SUR LA DÉCLARATION PAR POSITION — décision de Romain, 2026-08-16.
  // Un nom qui SE SEGMENTE est une suite de terminaux, des deux côtés de la flèche : `taka -> dha`
  // est `ta ka -> dha`. Un nom qui NE se segmente pas reste déclaré par sa position, et sa casse
  // n'y change rien : `zzz -> dha` crée toujours le non-terminal `zzz`.
  //
  // ⚠️ C'EST LA MOITIÉ DU NATIF QU'ON PREND, ET L'AUTRE QU'ON REFUSE. Au moteur natif, c'est la
  // CASSE qui porte la nature — minuscule terminal, majuscule non-terminal. On ne suit pas : faire
  // porter la nature à une convention typographique ferait changer un nom de nature par un simple
  // renommage.
  const intouchables = new Set([...nomsDeclares(ast)].filter((n) => !lire(n)?.parts));
  const dansUneListe = (liste) => {
    if (!Array.isArray(liste)) return liste;
    const sortie = [];
    for (const el of liste) {
      if (el && el.type === 'Symbol' && el.name && !known.has(el.name) && !intouchables.has(el.name)
          && el.role !== 'homomorphism' && !(Array.isArray(el.compose) && el.compose.length)) {
        const r = lire(el.name);
        if (r && r.parts) {
          for (const part of r.parts) sortie.push({ ...el, name: part });
          continue;
        }
        // Insegmentable : le nœud reste tel quel et c'est `validateTerminals` qui refuse — mais il
        // refusera EN NOMMANT LE RESTE, que la segmentation est seule à connaître.
        if (r && r.reste) restesDeSegmentation.set(el, r.reste);
      }
      sortie.push(descendre(el));
    }
    return sortie;
  };
  const CONTENANTS = ['voices', 'elements', 'content', 'symbol', 'triggers', 'primary', 'secondaries'];
  const descendre = (el) => {
    if (!el || typeof el !== 'object') return el;
    // ⚠️ UNE LISTE DE LISTES. Les voix d'une polymétrie sont des TABLEAUX, pas des nœuds : sans
    // cette ligne la descente s'arrête au premier tableau imbriqué et le nom collé survit sous le
    // groupe. Trouvé par la matrice des contenants, pas par le cas qui se montrait.
    if (Array.isArray(el)) return dansUneListe(el);
    for (const k of CONTENANTS) if (Array.isArray(el[k])) el[k] = dansUneListe(el[k]);
    return el;
  };
  for (const sg of ast.subgrammars || []) {
    for (const r of sg.rules || []) {
      if (Array.isArray(r.rhs)) r.rhs = dansUneListe(r.rhs);
      // LES DEUX CÔTÉS DE LA FLÈCHE — l'écriture collée est une commodité de saisie, pas une
      // notion de membre droit. Une règle qui vise `taka` vise les deux bols que ce nom désigne.
      if (Array.isArray(r.lhs)) r.lhs = dansUneListe(r.lhs);
    }
  }
}

function validateTerminals(ast) {
  if (!ast) return [];
  const errors = [];
  const codeVoice = new Set((ast.actors || []).filter((a) => (a.properties || {}).eval).map((a) => a.name));

  // Vocabulaire VALIDE = terminaux de TOUS les alphabets effectifs (octaviés + formes nues).
  const { terminaux: known, aUnAlphabet: anyAlphabet } = terminauxEnPortee(ast);
  known.add('lambda');
  const declared = nomsDeclares(ast);

  errors.push(...validateCallVocabulary(ast, known, declared, codeVoice, anyAlphabet));
  if (!anyAlphabet) return errors; // aucun alphabet de notes en portée (voix-code pure) → rien à valider sur les symboles NUS

  // Terminaux RHS : Symbol non couvert = non déclaré.
  //
  // ⚠️ CETTE BOUCLE NE LISAIT QUE LE PREMIER NIVEAU — un terminal inconnu placé dans un GROUPE
  // passait SANS UN MOT. Mesuré le 2026-07-29, trois scènes minimales sous alphabet occidental :
  //   `motif -> zzz` REFUSÉ · `motif -> a b` REFUSÉ · `motif -> {a a b b}` ZÉRO ERREUR.
  //
  // ⚠️ C'EST LA QUATRIÈME FOIS QUE JE PAIE CETTE FAMILLE, et je l'avais inscrite trois fois :
  // « descendre jusqu'aux FEUILLES — compter les voisins de surface ne voit pas ce qui vit sous un
  // nœud composite ». Je l'avais réparée dans la garde des sacs, dans celle de la correspondance,
  // dans celle du point d'attente… et jamais re-balayée ICI, dans le validateur le plus central.
  // Une règle qu'on a écrite et appliquée ailleurs ne protège pas l'endroit qu'on n'a pas regardé.
  //
  // CE QUE ÇA COÛTAIT, ET C'EST PIRE QUE LE TROU LUI-MÊME : tant qu'il était ouvert, AUCUNE scène à
  // groupes ne pouvait être migrée sur la foi d'un « zéro erreur » — le compilateur disait oui à
  // tout. Une scène de la bibliothèque a été déclarée MIGRÉE le matin même sur ce vert-là
  // (`Mozartexpression`, huit noms de solfège cachés sous alphabet occidental). Un vert qui ne
  // mesure pas ce qu'on croit est pire qu'un rouge (formule de bpx, reprise).
  //
  // AMPLEUR MESURÉE AVANT ÉCRITURE, 258 scènes : 76 portent des terminaux sous un groupe, 7 y
  // cachent un inconnu, 6 passent de verte à rouge. Les trois consommateurs ont été prévenus À
  // L'ÉCRITURE avec la liste exacte — pas au push (règle du 2026-07-29).
  const seen = new Set();
  // ⚠️ LA LISTE DES CHAMPS PORTEURS SE MESURE, ELLE NE SE DEVINE PAS. Mon premier jet en oubliait
  // deux —  et , ceux de l'événement simultané — et le garde l'a dit tout
  // de suite parce qu'il éprouve l'ESPACE des contenants et pas le groupe qui s'était montré.
  // C'est précisément ce qu'une matrice achète : la faute que j'allais refaire au même endroit.
  const COMPOSITES = ['voices', 'elements', 'content', 'symbol', 'triggers', 'primary', 'secondaries'];
  const verifier = (el) => {
    if (!el || typeof el !== 'object') return;
    if (Array.isArray(el)) { el.forEach(verifier); return; }
    // L'OBJET SONORE COMPOSÉ — `|[C4 E4 G4]` : le nom formé est un terminal, et ce sont ses
    // PARTIES qui se contrôlent. `LANGUAGE.md` §« L'objet sonore composé » dit que le nom formé
    // « se pose dans le flux comme un terminal ORDINAIRE » — aucun alphabet ne portera jamais le
    // concaténé, donc le chercher tel quel refusait toujours. Opaque à la DÉRIVATION ne veut pas
    // dire opaque au vocabulaire : une faute de frappe à l'intérieur crie, à sa place.
    if (el.type === 'Symbol' && Array.isArray(el.compose) && el.compose.length) {
      for (const part of el.compose) {
        // Silence, prolongation et sous-blocs polymétriques sont ce qui s'écrit à l'intérieur
        // (bible, même section) : ce ne sont pas des noms à chercher dans un alphabet.
        if (/^[-_.]+$/.test(part) || /[{},]/.test(part)) continue;
        if (known.has(part) || declared.has(part) || seen.has(part)) continue;
        seen.add(part);
        errors.push({
          message: `dans l'objet sonore composé '|[…]' : '${part}' n'est déclaré nulle part — `
                 + `absent des alphabets en portée`,
          line: el.line,
        });
      }
      return;
    }
    if (el.type === 'Symbol' && el.name
        && el.role !== 'homomorphism'            // marqueur d'invocation d'homo, pas un terminal
        && !(el.payload && codeVoice.has(el.payload.actor))   // voix-code : terminal arbitraire
        && !known.has(el.name) && !declared.has(el.name) && !seen.has(el.name)) {
      seen.add(el.name);
      // ⛔ LE REFUS NOMME LE RESTE, PAS LE MOT. La segmentation est passée avant et a buté sur un
      // bout précis ; c'est lui qui manque à l'alphabet, et le natif le dit ainsi — « Can't make
      // sense of "a" ». Dire le mot entier envoie chercher un terminal qui n'a jamais eu à exister.
      const reste = restesDeSegmentation.get(el);
      errors.push({
        message: reste && reste !== el.name
          ? `terminal '${el.name}' non déclaré — segmentation bloquée sur '${reste}', absent des alphabets en portée`
          : `terminal '${el.name}' non déclaré — absent des alphabets en portée`,
        line: el.line,
      });
    }
    for (const k of COMPOSITES) if (el[k]) verifier(el[k]);
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) verifier(r.rhs || []);
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
        // Mesuré le 2026-07-26 sur le témoin de bpx : `ins(12)` sans `core` dégénérait en
        // note, et mon premier message affirmait « 'ins' n'existe pas », ce qui est FAUX.
        const auRegistre = universeControlNames().has(n.name);
        errors.push({
          message: auRegistre
            ? `appel '${citer(n)}' : '${n.name}' est un contrôle du registre, mais cette scène ne `
              + `l'a pas importé — il a donc été reclassé en TERMINAL SONNANT, c'est-à-dire en note. `
              + `Déclarer le socle en tête de scène ('core')`
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

/**
 * UNE SCÈNE NE DÉCLARE QU'UN ALPHABET — l'acteur implicite est UNIQUE.
 *
 * ⚠️ RÈGLE DE ROMAIN, 2026-08-07, mot pour mot : « on ne déclare pas plusieurs acteurs implicites,
 * un seul ; sinon c'est explicite. » Combinée à « un alphabet par acteur » (même jour), elle ferme
 * la question : deux vocabulaires — a fortiori liés à deux sorties — demandent deux acteurs, et
 * deux acteurs se DÉCLARENT.
 *
 * ⚠️ AVANT CE REFUS, LE SECOND ALPHABET ÉTAIT IGNORÉ EN SILENCE : le calcul des terminaux lisait
 * le premier et jetait les autres. Une ligne entière ne servait à rien et rien ne le disait — le
 * mode d'échec muet, pire qu'un refus. La `LANGUAGE.md` §« Déclarer un symbole » écrit encore la
 * forme à deux alphabets ; elle est donc à corriger vers `actor`, et c'est une décision de
 * langage, pas une déduction : le cliquet des exemples la porte, datée.
 *
 * Mesuré avant de livrer : ZÉRO scène du corpus (274) déclare plus d'un `alphabet`. Ce fail-loud
 * n'invalide aucune écriture vivante.
 */
function refuserAlphabetsMultiples(ast) {
  const alphabets = (ast?.directives || []).filter((d) => d.name === 'alphabet' && d.subkey);
  if (alphabets.length <= 1) return [];
  const second = alphabets[1];
  return [{
    message: `une scène ne déclare qu'UN alphabet, et 'alphabet.${second.subkey}' est le `
           + `${alphabets.length === 2 ? 'second' : alphabets.length + 'e'} — l'acteur implicite `
           + `est unique et ne porte qu'un vocabulaire. Pour en jouer plusieurs, les déclarer : `
           + `'actor <nom>' avec sa clé 'alphabet.<nom>' et sa clé 'out.<canal>', un bloc par voix`,
    line: second.line || 0,
  }];
}

function applyDefaultActor(ast) {
  if (!ast) return [];
  const errors = [];
  // Le binding de sortie de l'alphabet de scène (`alphabet.X:midi` → runtime:'midi') est la
  // clé de connexion transport (+eval) de l'UNIQUE acteur implicite (AST.md:94). Décision Romain
  // 2026-07-05 (acteur unique implicite) : sans actor, ce binding renseigne le transport de
  // l'acteur synthétique ; AVEC un actor, c'est un CHEVAUCHEMENT interdit (implicite XOR explicite).
  const alphaBinding = (ast.directives || []).find((d) => d.name === 'alphabet' && d.runtime);
  if ((ast.actors || []).length > 0) {
    if (alphaBinding) {
      errors.push({
        message: `chevauchement d'acteurs : un binding de sortie sur l'alphabet (@alphabet.${alphaBinding.subkey}:${alphaBinding.runtime}) désigne un acteur implicite, incompatible avec un @actor explicite — choisis l'un OU l'autre`,
        line: alphaBinding.line || 0,
      });
    }
    return errors; // au moins un actor déclaré → pas d'acteur implicite (pas de chevauchement)
  }
  // LA SORTIE DE L'ACTEUR IMPLICITE — cascade complète (`sortieHeritee`), plus une lecture partielle.
  // ⚠️ CE QUI ÉTAIT ÉCRIT ICI IGNORAIT LA SCÈNE : la clé venait du raccord d'alphabet ou du socle,
  // jamais de `out.midi`. La directive était refusée au parse, donc rien ne pouvait le révéler —
  // et le jour où elle a été acceptée, l'acteur a continué à sortir `audio` sans un mot. Une valeur
  // par défaut et une valeur IGNORÉE ont exactement la même tête ; c'est pourquoi la cascade est
  // définie une seule fois, à côté des trois autres axes, et pas reconstituée à chaque appelant.
  const sortie = sortieHeritee(ast);
  if (sortie.conflit) {
    errors.push({
      message: `deux sorties pour la même scène : 'out.${sortie.conflit.ecrite}' et le raccord `
             + `'alphabet.${sortie.conflit.alphabet}:${sortie.conflit.raccord}' désignent des `
             + `canaux différents — les deux écritures disent la MÊME chose, il faut n'en garder `
             + `qu'une`,
      line: sortie.conflit.line,
    });
  }
  const transportKey = sortie.key;
  const transport = { type: 'TransportRef', key: transportKey, params: sortie.params };
  // ⚠️ ET SON ALPHABET — il naissait SANS, et c'était le trou (Romain 2026-07-29, « ça ne devrait
  // JAMAIS ARRIVER »). L'ancien commentaire ici disait « pas d'alphabet : pitch via le résolveur de
  // scène » : il n'existait aucun résolveur de scène en aval pour le remplir, donc l'AST partait
  // muet et le consommateur devait deviner. La cascade est la MÊME que pour un acteur déclaré
  // (`alphabetHerite`, définie une seule fois) : scène → socle core, ABSENT si la hauteur est
  // opaque. Une voix-code pure n'est pas concernée : elle n'a pas d'alphabet DÉCLARÉ ici, et
  // l'acteur implicite n'existe que faute de tout actor — il n'y a donc aucun eval à hériter.
  const alphabetKey = alphabetHerite(ast);
  const properties = { transport };
  const references = [{ type: 'ActorReference', category: 'transport', name: transportKey, line: 0 }];
  if (alphabetKey) {
    properties.alphabet = alphabetKey;
    references.push({ type: 'ActorReference', category: 'alphabet', name: alphabetKey, line: 0 });
    const oct = octavesHerite(ast, alphabetKey);   // les registres suivent l'alphabet, même cascade
    if (oct) {
      properties.octaves = oct;
      references.push({ type: 'ActorReference', category: 'octaves', name: oct, line: 0 });
    }
    // L'ACCORDAGE vient de l'ALPHABET, jamais du socle core (Romain 2026-07-29).
    const tun = tuningHerite(ast, alphabetKey);
    if (tun) {
      properties.tuning = tun;
      references.push({ type: 'ActorReference', category: 'tuning', name: tun, line: 0 });
    }
  }
  // L'INTERPRÈTE PAR DÉFAUT — cinquième et dernière des clés d'acteur à descendre (Romain,
  // 2026-08-07 : « toutes ces directives doivent descendre dans l'acteur implicite »). Il ne
  // descendait pas DU TOUT : `eval.strudel` en tête de scène était lu par le validateur et par
  // personne d'autre. Et il ne dépend PAS de l'alphabet — une scène qui ne joue aucune note
  // déclare quand même par quoi ses backtiques sont lus — donc il vit hors du bloc ci-dessus.
  const interprete = evalHerite(ast);
  if (interprete) {
    properties.eval = interprete;
    references.push({ type: 'ActorReference', category: 'eval', name: interprete, line: 0 });
  }
  // ⚠️ IL S'APPELAIT `default` JUSQU'AU 2026-07-30 (décision Romain, en direct :
  // `hub/decisions/2026-07-30-l-acteur-implicite-s-appelle-scene.md`). Son motif n'est pas
  // esthétique : il refusait que ce qui s'appelle normalement en notation pointée remonte en `@`.
  // Nommer l'acteur implicite `scene` donne à l'auteur de quoi DÉSIGNER ce qui n'appartient à
  // personne — quand rien n'est déclaré, le contenu appartient bien à la scène.
  // LE MOT N'ÉTAIT PAS LIBRE : trois scènes de la bibliothèque l'employaient comme nom de drapeau.
  // Elles sont refusées par la règle d'unicité et migrées par leur propriétaire — c'est le mode qui
  // CRIE, pas celui qui se tait, et c'est pour ça qu'on peut le prendre.
  ast.actors = [{
    type: 'ActorDirective',
    name: 'scene',
    properties,
    references,
    // Frontière AST (Palier 3) : pas de `soundAssignments:null` — champ non canonique.
    // Canonique = `assignments?` OPTIONNEL (absent ici : l'acteur implicite n'affecte aucun son).
    synthetic: true, // acteur implicite (aucun actor déclaré) — panneau Acteurs vide
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
   * 1. `diapason:261.63` était plié tel quel : l'arbre portait `"261.63"`, et Kairos le
   *    refusait à juste titre (« un diapason est un nombre fini > 0 »). L'entier `262`, lui,
   *    passait. Une scène pouvait donc déclarer un diapason parfaitement valide et être
   *    rejetée en aval pour une raison de TYPE, sans que rien ne le dise ici.
   * 2. Plus grave : le contrôle de plage ci-dessous ne s'applique QUE si la valeur est déjà un
   *    nombre. Une chaîne le traversait sans être vérifiée — `diapason:"99999"` passait le
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

  // Niveau SCÈNE : nom:valeur (forme deux-points = valeur, règle ':'/'.')
  const sceneVals = {};
  for (const d of ast.directives || []) {
    const spec = registry[d.name];
    if (!spec) continue;
    if (d.value == null) {
      errors.push({ message: `'${d.name}' attend une VALEUR (ex. @${d.name}:440) — pas un nom`, line: d.line });
      continue;
    }
    const valeur = versNombre(spec, d.value);
    if (checkDomain(d.name, spec, valeur, d.line)) sceneVals[d.name] = valeur;
  }

  // Composant d'un AXE déclaré au niveau SCÈNE, lu en forme POINT uniquement (`tuning.X`
  // → `subkey`). SÉMANTIQUE `.`/`:` (Romain) : `.` APPELLE un composant, `:` affecte une
  // VALEUR. Un accordage est un COMPOSANT → point. `tuning:X` (deux-points) = forme v0.7
  // PÉRIMÉE (affecterait une « valeur » à un axe de composant, non-sens) : NON accommodée
  // ici — elle relève de la migration v0.7→v0.8, pas d'un chemin de code.
  const defaultComponents = (libCtx && libCtx.defaultComponents) || {};
  const sceneComponent = (axis) => {
    const d = (ast.directives || []).find((x) => x.name === axis && x.subkey);
    return d ? d.subkey : undefined;
  };
  // Défaut EFFECTIF (niveaux 2-1) : `spec.overriddenBy = "axe.champ"` = le champ du composant
  // EFFECTIF de l'axe (acteur ?? scène ?? défaut core) donne le défaut. RÈGLE DURE (kairos [310]) :
  // si un composant est en portée mais NON RÉSOLU, on renvoie `undefined` (valeur ABSENTE, l'aval
  // résout) — JAMAIS un littéral global par-dessus un composant déclaré. Un `spec.default` littéral
  // n'est le socle QUE pour une valeur SANS composant (pas d'`overriddenBy`, ex. tempo).
  // RÈGLE DE CASCADE (loi 35, constitution:175 ; docs/design/SCENE_DEFAULTS_CASCADE.md, Romain
  // 2026-07-04) : « un pli qui ne sait PAS résoudre le composant INVOQUÉ laisse la valeur ABSENTE,
  // le résolveur (Kairos) la remplit depuis la lib invoquée ». Le socle core (defaultComponents,
  // lu depuis lib/core.json `defaults.components` — PAS un hardcode) ne s'applique QUE si AUCUN
  // composant n'est invoqué (scène nue). Un axe d'ancre est « invoqué » si un DIRECTIVE legacy le
  // nomme (alphabet.X/tuning.X) OU si une invocation par le canal NEUTRE (libRefs) porte
  // l'identité de hauteur — opaque ici (domaine déclaré DANS le fichier, résolu chez Kairos, L27).
  // Jamais le socle par-dessus un composant invoqué (même classe que le bug diapason 2026-07-04
  // où core écrasait le composant déclaré). FIX [394]/[395].
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
          compName = defaultComponents[axis]; // AUCUN composant invoqué (scène nue) → socle core
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
  // par valeur : acteur (4) → scène (3) → composant invoqué (2) → socle core (1).
  for (const actor of ast.actors || []) {
    const props = actor.properties || {};
    const eParams = props.entityParams || {};
    for (const [axis, params] of Object.entries(eParams)) {
      // UN PARAMÈTRE PEUT ÊTRE INTRINSÈQUE À L'ENTRÉE, PAS SEULEMENT GLOBAL (décision Romain
      // 2026-08-06, sur `eval.strudel(bank:…)` : « bank est intrinsèque à strudel, c'est pas
      // générique »). Avant, un paramètre de clé d'acteur devait être une valeur DÉCLARÉE au
      // registre global — donc valable pour tous les langages, ce qui est faux : une banque
      // d'échantillons n'a de sens que pour le moteur qui sait la charger.
      // On regarde donc d'abord l'ENTRÉE elle-même (`lib/<axe>.json` → `objects.<entrée>.
      // parameters`), exactement comme `lib/mod.json` déclare `attack`/`release` sur `adsr`.
      const entree = props[axis];
      const propres = (typeof entree === 'string' && loadLib(axis, entree)?.parameters) || null;
      for (const k of Object.keys(params)) {
        if (propres && propres[k] !== undefined) continue;   // propre à l'entrée : accepté
        if (!registry[k]) {
          errors.push({ message: `'${axis}.${entree ?? '…'}(${k}:…)' : '${k}' n'est ni un paramètre `
            + `de '${entree ?? axis}' ni une valeur déclarée (socle @core ou librairie invoquée)`,
            line: actor.line });
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
      if (v === undefined) v = cascadeDefault(spec, props); // niveaux 2-1 (composant invoqué → socle core)
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
 * dérivation. Une référence — VALEUR (`X:v`, occurrence `(k:v)`) ou COMPOSANT
 * (`alphabet.X`, `tuning.X`, `octaves.X`) — qui n'existe pas dans les librairies
 * chargées → ERREUR CLAIRE (nom fautif). Kairos garde son filet défensif en aval.
 * ZÉRO HARDCODE : tout le vocabulaire (contrôles/valeurs/fonctions/adresses/axes) vient
 * des libs chargées + du schéma @core → une user library l'étend automatiquement.
 * @returns {Array<{message, line?, col?}>}
 */
/**
 * OÙ UN SAC SE TROUVE, LU SUR LE NŒUD QUI LE PORTE — la table qui traduit l'arbre en vocabulaire
 * de portée. Elle vient de la MESURE des dix porteurs de sac de l'arbre, pas d'une intuition :
 * un réglage s'accroche aussi à un silence, à une prolongation, à un joker et aux deux membres
 * d'un gabarit, et tous relèvent de `symbol` — écrire « note » aurait rétréci le vocabulaire sous
 * l'usage réel. Ajouter un porteur au langage l'inscrit ici, et il est validé aussitôt.
 */
const REFUS_HORS_PORTEE_ACTIF = true;   // cf. la note au point de confrontation, plus bas
const PORTEE_DU_PORTEUR = {
  Rule: 'rule',
  Polymetric: 'group', RawBrace: 'group',
  InstantControl: 'flow',
  Symbol: 'symbol', SymbolCall: 'symbol', Wildcard: 'symbol', Prolongation: 'symbol',
  Rest: 'symbol', TemplateMaster: 'symbol', TemplateSlave: 'symbol',
};
/** Les mots du vocabulaire, dits en français dans les messages — l'auteur ne lit pas la donnée. */
const NOM_DE_PLACE = {
  scene: 'en tête de scène', subgrammar: 'en tête de sous-grammaire', rule: 'sur une règle',
  group: 'sur un groupe', symbol: 'sur un élément', flow: 'dans le flux',
};

/**
 * Les portées permises par clé, ramassées dans TOUTES les librairies qui en portent.
 * ⚠️ Trois sources, et il faut les trois : le sac ne porte pas que des contrôles. Mesuré sur les
 * 274 scènes — `cutoff` y est écrit vingt fois et vient de la librairie des modulations, `ch` une
 * fois et vient du socle. Bâtir sur la seule librairie des contrôles les refuserait à tort.
 */
/**
 * ⛔ DEUX TABLES, PAS UNE — décision de Romain, 2026-08-15, portée comme une CORRECTION.
 *
 * `pan` est écrit deux fois dans le vocabulaire, et ce ne sont PAS deux réalisations d'un même
 * concept : ce sont DEUX CONCEPTS qui portent le même nom. L'un est une VALEUR qu'on écrit —
 * `!(pan:64)`, un contrôle d'expression 0..127 ; l'autre est une CIBLE où un CV se branche —
 * `(pan: env1)`, une entrée de modulation −1..1. Ils ne s'écrivent même pas pareil.
 *
 * CE QUE LA TABLE UNIQUE FAISAIT : la boucle des modulations passait APRÈS celle des contrôles,
 * donc la portée de l'entrée de modulation ÉCRASAIT celle du contrôle, dernière écriture gagnante.
 * Mesuré le 2026-08-15 : `pan` avait bien reçu `scene` dans sa déclaration — sur arbitrage de
 * Romain — et `pan:64` en tête de scène restait refusé, en récitant les quatre places de l'AUTRE
 * `pan`. Ni l'auteur ni le mainteneur n'avaient de quoi comprendre le refus.
 *
 * Une entrée de modulation n'a aucune raison de gouverner où un CONTRÔLE s'écrit. Les deux tables
 * sont donc tenues séparément, et la lecture dit son ordre : le contrôle d'abord, la modulation en
 * repli pour les noms qu'aucun contrôle ne porte (`cutoff`, `amplitude`…).
 *
 * PÉRIMÈTRE MESURÉ : `pan` est le SEUL homonyme strict entre les deux familles — confirmé par
 * runtime-audio le même jour, rien sur cutoff, amplitude, resonance, pitch. La séparation n'est
 * donc pas un filet posé au hasard : elle règle un cas connu et empêche le suivant.
 */
let _porteesPermises = null;
function chargerPorteesPermises() {
  if (_porteesPermises) return _porteesPermises;
  const controles = new Map();
  const modulation = new Map();
  const m = controles;
  const w = (o) => {
    for (const [k, v] of Object.entries(o || {})) {
      if (!v || typeof v !== 'object') continue;
      if ('args' in v && 'description' in v) { if (Array.isArray(v.scope)) m.set(k, v.scope); }
      else w(v);
    }
  };
  // `controls.json` SCINDÉ le 2026-08-10 (une librairie, un destinataire — LIBRAIRIES.md:213) en
  // quatre fichiers ; `controls` lui-même n'est plus qu'un stub d'`apporte` (aucun contrôle
  // propre), donc les QUATRE remplacent l'ancien `w(LIBS.controls)` seul.
  w(LIBS.expression);
  w(LIBS.midi);
  w(LIBS.audio);
  w(LIBS.transpo);
  // Les procédures MOTEUR (mode/scan/weight/goto/rndtime, destru/randomize…) ont rejoint
  // lib/engine.bpsl le 2026-08-10 (une clé ne vit que dans UNE librairie) — leur `scope` doit
  // continuer à alimenter cette table, sinon `(scan:…)`/`(weight:…)` redeviennent « inconnu ».
  w(LIBS.engine);
  for (const [type, entrees] of Object.entries(LIBS.modulation || {})) {
    if (type.startsWith('_') || !entrees || typeof entrees !== 'object') continue;
    for (const [k, v] of Object.entries(entrees)) if (v && Array.isArray(v.scope)) modulation.set(k, v.scope);
  }
  // ── UNE CLÉ D'ADRESSE PORTE SA PROPRE PORTÉE, comme tout le reste du vocabulaire ────────────
  // Elles ont quitté le socle le 2026-08-15 (décision Romain : « dans midi ») pour la librairie du
  // canal qui les porte. Leur portée les suit : elle vivait dans une liste unique du schéma
  // (`channelParamsScope`), qui donnait la MÊME portée aux cinq et n'avait nulle part où en dire
  // une autre. Chaque clé la déclare désormais elle-même, et ce code ne nomme aucune clé.
  for (const lib of Object.values(LIBS)) {
    const cles = lib?.schema?.addressKeys;
    if (!cles || Array.isArray(cles) || typeof cles !== 'object') continue;
    for (const [k, def] of Object.entries(cles)) {
      if (k.startsWith('_') || !def || !Array.isArray(def.scope)) continue;
      m.set(k, def.scope);
    }
  }
  // LA LECTURE DIT SON ORDRE, et elle ne le devine pas : le CONTRÔLE gouverne où son nom s'écrit ;
  // la modulation ne répond que pour les noms qu'aucun contrôle ne porte.
  _porteesPermises = {
    get: (cle) => (controles.has(cle) ? controles.get(cle) : modulation.get(cle)),
    has: (cle) => controles.has(cle) || modulation.has(cle),
    controles,
    modulation,
  };
  return _porteesPermises;
}

/**
 * ⛔ UN POINT D'ATTENTE NOMME CE QU'IL ATTEND, ET CE NOM SE DÉCLARE.
 *
 * DÉCISION DE ROMAIN, 2026-08-15 : « oui il doit être déclaré, sinon on ne sait pas ce qu'on
 * attend ». La forme de déclaration existe depuis le 2026-08-04 — `var <nom> in.<canal>` — et
 * c'est son EXIGENCE qui manquait, pas sa graphie.
 *
 * CE QUI PASSAIT : `<!depart` et `<!depatr` étaient deux points d'attente valides et sans rapport,
 * en silence. Une coquille ne casse rien — elle fabrique une seconde attente que rien ne viendra
 * jamais satisfaire, et la dérivation s'arrête pour toujours sans un mot.
 *
 * ⛔ LE REFUS PORTE SUR LA RACINE, ADRESSÉE OU NON — une seule règle, pas deux. Dans `<!p.60`, `p`
 * est le RÔLE et `.60` est l'ADRESSE : c'est `p` qui se déclare, jamais l'adresse
 * (`LANGUAGE.md:1517` : « l'adresse de la source se colle au point d'attente — `<!sync1.60` écoute
 * le numéro 60 de l'entrée `sync1` »). Romain, même jour : « bien oui, sinon comment on sait ce
 * qu'est `p` ? ».
 *
 * CE QUI COMPTE COMME DÉCLARATION : tout ce qui CRÉE le nom dans la scène — une entrée
 * (`var <rôle> in.<canal>`), une variable de travail, une déclaration de porte ou de trigger, un
 * acteur. On ne restreint pas à la seule entrée : la question est « ce nom existe-t-il », pas
 * « par quel mot ».
 *
 * ⛔ DEUX RACINES, ET CE NE SONT PAS DEUX FORMES RIVALES — arbitrage de Romain, 2026-08-15 : « un
 * point de synchronisation, dans tous les cas, attend un ÉVÉNEMENT. Un événement peut être
 * déclenché par une infinité de choses. » La DÉCLARATION dit D'OÙ ça vient, la QUALIFICATION dit
 * QUOI exactement, et ce sont deux questions :
 *     <!sync1                        tout événement de `sync1` lève le point
 *     <!sync1.60                     seulement l'adresse 60
 *     <!in.midi(note:60, channel:3)  pleinement qualifié, sans passer par un rôle
 * La racine est donc SOIT un rôle déclaré, SOIT une DIRECTION — et une direction n'a rien à
 * déclarer, elle nomme le canal lui-même. La liste des directions se lit dans la DONNÉE (les mots
 * de direction du socle) : aucun nom n'est écrit ici, et le jour où une direction s'ajoute, ce
 * refus la suit sans une ligne.
 */
function refuserAttenteNonDeclaree(ast) {
  const connus = new Set();
  for (const i of (ast.inputs || [])) for (const n of (i.names || (i.name ? [i.name] : []))) connus.add(n);
  for (const v of (ast.vars || [])) for (const n of (v.names || [])) connus.add(n);
  for (const d of (ast.declarations || [])) if (d && d.name) connus.add(d.name);
  for (const a of (ast.actors || [])) if (a && a.name) connus.add(a.name);

  // LES MOTS DE DIRECTION, DÉRIVÉS DU CATALOGUE DES CANAUX : chaque canal déclare les directions
  // qu'il autorise (`midi: {in:true, out:true}`), donc les mots de direction sont exactement les
  // champs booléens que ce catalogue emploie. Aucun nom n'est écrit ici, et le jour où une
  // direction s'ajoute au catalogue, ce refus la suit sans une ligne.
  // ⚠️ ET LA DÉRIVATION NE PASSE PAS PAR `reservedDirectives` : cette liste porte `transport`, un
  // mot RETIRÉ du langage, dont la légende parle encore de direction. On aurait exempté une racine
  // morte. Le catalogue, lui, ne décrit que ce qui existe.
  const directions = new Set();
  for (const canal of Object.values(LIBS.core?.schema?.channels || {})) {
    if (!canal || typeof canal !== 'object') continue;
    for (const [cle, valeur] of Object.entries(canal)) {
      if (typeof valeur === 'boolean' && valeur === true && cle !== 'writable') directions.add(cle);
    }
  }

  const erreurs = [];
  const vus = new Set();
  (function marcher(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const e of n) marcher(e); return; }
    if (n.type === 'Wait' && typeof n.name === 'string'
        && !connus.has(n.name) && !directions.has(n.name) && !vus.has(n.name)) {
      vus.add(n.name);
      erreurs.push({
        message: `'<!${n.name}' attend un signal que rien ne déclare — aucune entrée, variable, `
          + `porte ni acteur de cette scène ne porte le nom '${n.name}'. Le déclarer : `
          + `'var ${n.name} in.<canal>'. Sans déclaration, une coquille fabrique une SECONDE `
          + `attente que rien ne viendra satisfaire, et la dérivation s'arrête pour toujours `
          + `sans un mot.`,
        line: n.line,
      });
    }
    for (const k in n) marcher(n[k]);
  })(ast);
  return erreurs;
}

function validateReferences(ast, libCtx = {}) {
  const errors = [];
  const porteesPermises = chargerPorteesPermises();
  // ⛔ LE VOCABULAIRE D'UNE SCÈNE EST CELUI QU'ELLE INVOQUE (Romain, 2026-08-08) : « invoquer
  // commande, systématiquement — si un mot est inconnu dans le corpus invoqué, alors erreur ».
  //
  // ⚠️ CETTE LIGNE DISAIT L'INVERSE, et c'est elle qui laissait tout passer : « agrégat de TOUTES
  // les libs disponibles. Un mot usable est valide. » Un réglage était donc accepté dès qu'une
  // librairie du dépôt le déclarait, même si la scène n'en invoquait aucune — l'invocation ne
  // commandait rien. Les acteurs comptent comme des invocations : ils portent leurs propres
  // références de librairie (alphabet, accordage, registres).
  const vocab = describeVocabulary([...(ast.directives || []), ...(ast.actors || [])]);
  const controlNames = new Set(vocab.controls.map((c) => c.name));
  const registry = new Set(vocab.values.map((v) => v.name));
  const modInputs = new Set(vocab.modulationInputs);
  const reserved = new Set(vocab.keywords);
  const digitalFns = new Set(vocab.functions);
  const addressKeys = new Set(vocab.addressKeys);
  // Réglages RÉSERVÉS (mode/scan/weight/on_fail/tempx/meter) — écrits en '()' depuis la décision
  // Romain 2026-08-02 (LANGUAGE.md:773-800). Sans cette entrée, `knownParamKey` les refusait
  // comme « attribut inconnu » : le vocabulaire des `(k:v)` ne les avait jamais portés, ils ne
  // vivaient QUE côté `[]` (checkQualifierKey, parser.js).
  const qualifierKeys = new Set(vocab.qualifierKeys);
  const catalogAxes = Object.keys(vocab.components);
  const componentExists = (axis, name) => (vocab.components[axis] || []).includes(name);

  // 1. Occurrence / paramètres `(k:v)` — clé connue = contrôle ∪ valeur ∪ entrée modulation ∪
  //    adresse ∪ fonction digitale ∪ réglage réservé. Les paires d'occurrence vivent dans
  //    `payload.params` (note ou groupe/règle, foldées par le parser) ET dans les
  //    `SettingBag.pairs`.
  // Les INSTANCES de module que la scène déclare (`var lpf1 lpf`) : un réglage peut nommer le
  // PORT de l'une d'elles (`(lpf1.cutoff:400)`, `AST.md` §Setting). Le nom d'une instance est
  // choisi par l'auteur — aucun registre de librairie ne peut le connaître, il faut le lire dans
  // la scène. Sans cela, sept exemples de la bible tombaient sur « attribut inconnu ».
  const instancesDeclarees = new Set(
    (ast.vars || []).flatMap((v) => (v && Array.isArray(v.names) ? v.names : [])));

  // ── LE MODE D'UN PARAMÈTRE DÉCLARÉ — `slidecont`, `slidestep`, `slidefixed` ─────────────────
  // FORME RATIFIÉE PAR ROMAIN le 2026-08-13, et c'est la MÊME construction que les vingt-sept mots
  // des neuf paramètres de jeu : le mode se COLLE au nom du paramètre, et le collage réunit deux
  // termes en un seul. `velstep` et `slidestep` ne sont pas deux graphies, c'est la même.
  //
  // ⚠️ CE QU'ELLE REMPLACE, ET POURQUOI L'ANCIENNE ÉTAIT FAUSSE. On écrivait `!(cont:slide)` :
  // le `:` LIE UN SUJET À UNE VALEUR, or le sujet écrit était `cont` et la « valeur » était
  // `slide` — l'inverse du sens. Et `!(value:slide 101)` cachait le SUJET DANS LA VALEUR, deux
  // termes dont le premier est un nom. Aucune des deux ne dit de quoi on parle en tête de clé.
  // La forme canonique remet le paramètre en clé : `!(slide:101)` et `!(slidecont)`.
  //
  // LE PARAMÈTRE DOIT ÊTRE DÉCLARÉ (`var slide signal` — « un flux de nombres, sans convention de
  // lecture », LANGUAGE.md). Sans déclaration le nom est refusé, et c'est le but : un mot inconnu
  // collé à `cont` ne doit pas devenir un paramètre par accident.
  const MODES = ['fixed', 'step', 'cont'];
  const signauxDeclares = new Set(
    (ast.vars || [])
      .filter((v) => v && v.varType && v.varType.kind === 'convention')
      .flatMap((v) => (Array.isArray(v.names) ? v.names : [])));
  const estModeDeParametre = (k) => MODES.some((mode) =>
    k.endsWith(mode) && signauxDeclares.has(k.slice(0, -mode.length)));

  const knownParamKey = (k) => controlNames.has(k) || registry.has(k) || modInputs.has(k) || addressKeys.has(k) || digitalFns.has(k) || qualifierKeys.has(k) || instancesDeclarees.has(k) || estModeDeParametre(k);
  // DÉDUPLICATION PAR CLÉ ET PAR LIGNE — et surtout : une paire vue DEUX FOIS ne compte qu'une.
  //
  // La même paire est collectée à deux endroits : dans `payload.params` (replié par le parser,
  // SANS position) et dans `SettingBag.pairs` (AVEC ligne et colonne). L'identifiant de
  // déduplication valait `clé + ':' + (ligne || 0)` : les deux passages produisaient donc deux
  // identifiants différents, et l'attribut inconnu était signalé DEUX FOIS — une fois sans
  // position, une fois avec. Pire, la version SANS position arrivait en premier, donc le
  // premier message rendu à l'appelant n'avait ni ligne ni colonne.
  // Mesuré : `(mysteryParam:42)` rendait 2 erreurs, `(cutof:env1)` en rendait 3.
  //
  // On déduplique donc par CLÉ, et on garde la position dès qu'un des passages la porte.
  // ⛔ UN NOM QUE DEUX LIBRAIRIES DÉCLARENT NE S'ÉCRIT PAS NU — il ne dit pas de quoi on parle.
  //
  // RÈGLE DE ROMAIN (2026-08-13) : deux déclarations d'un même contrôle sont permises, et l'appel
  // se préfixe alors `<librairie>.<contrôle>`. Le refus porte donc sur l'APPEL AMBIGU, jamais sur
  // la déclaration — c'est l'inverse de ce que j'avais écrit le 2026-08-12.
  //
  // ⚠️ CE QUE ÇA REMPLACE EST UN CHOIX SILENCIEUX, et c'est le seul mode d'échec qui compte ici :
  // sans ce refus, le chargeur garde la DERNIÈRE déclaration lue et le réglage part au destinataire
  // de celle-là. Mesuré en posant un `pan` de témoin dans `audio.json` : `(pan:20)` était jugé sur
  // la plage d'`audio` (-1..1) et sortait « hors plage », alors que l'auteur écrivait le `pan` de
  // `expression` (0..127). Aucune erreur ne nommait l'ambiguïté ; l'ordre de chargement décidait.
  //
  // LE REFUS PORTE SA RÉÉCRITURE — la liste des préfixes possibles, nommés. Un refus qui dit
  // seulement « ambigu » laisse l'auteur chercher quelles librairies se disputent le nom.
  const ambigus = libCtx.ambiguousControls || new Set();
  const prefixesDe = (nom) => Object.keys(libCtx.controlsQualified || {})
    .filter((q) => q.endsWith(`.${nom}`)).sort();
  const vusAmbigus = new Set();
  const signalerAmbiguite = (key, line, col) => {
    if (!ambigus.has(key) || vusAmbigus.has(key)) return;
    vusAmbigus.add(key);
    const choix = prefixesDe(key);
    errors.push({
      message: `'${key}' est déclaré par ${choix.length} librairies et ne peut pas s'écrire NU — `
        + `il ne dit pas de quel '${key}' on parle, et le destinataire du réglage en dépend. `
        + `Écrire ${choix.map((c) => `'${c}:…'`).join(' ou ')}.`,
      line,
      col,
    });
  };

  // ── UN MOT GÉNÉRIQUE ÉCRIT POUR UNE SORTIE QUI NE LE RÉALISE PAS ────────────────────────────
  // RÈGLE DE ROMAIN (2026-08-15) : « si certains sont en attente d'une implémentation, il faut
  // mettre l'implémentation au backlog et s'assurer qu'on a un message d'erreur si on l'utilise ».
  //
  // ⛔ C'EST UN REFUS D'USAGE, PAS DE DÉCLARATION, et la distinction porte tout le mécanisme. Le
  // chargeur refuse déjà une déclaration incohérente — un `implements` qui pointe dans le vide.
  // Ici, la déclaration est juste et c'est l'ÉCRITURE qui n'a nulle part où aller : `!(volume:90)`
  // chez un acteur qui sort en `audio`, quand seul `midi` réalise `volume`. Sans ce refus, le mot
  // compile et ne fait RIEN — le défaut que le langage refuse partout ailleurs.
  //
  // LE CANAL D'UNE RÉALISATION EST LE NOM DE SA LIBRAIRIE, quand ce nom est un canal déclaré
  // (`midi.volume` → canal `midi`). Aucun nom n'est écrit ici : le catalogue des canaux et les
  // liens de réalisation sont tous deux de la donnée.
  const canauxDeclares = new Set(Object.keys(LIBS.core?.schema?.channels || {}));
  const realisationsPar = {};      // nom nu → Set des canaux qui le réalisent
  for (const [face, reals] of Object.entries(libCtx.implementations || {})) {
    const nom = face.slice(face.indexOf('.') + 1);
    const canaux = new Set(reals.map((q) => q.slice(0, q.indexOf('.'))).filter((l) => canauxDeclares.has(l)));
    if (canaux.size > 0) realisationsPar[nom] = canaux;
  }
  // LES SORTIES ACTIVES DE LA SCÈNE. `applyDefaultActor` a déjà tourné : `ast.actors` est peuplé,
  // acteur implicite compris, et chacun porte sa clé de transport. Une scène peut en avoir
  // plusieurs — c'est le cas réel de Kanopi, qui joue MIDI et audio ensemble.
  const sortiesActives = [...new Set((ast.actors || [])
    .map((a) => a && a.properties && a.properties.transport && a.properties.transport.key)
    .filter((k) => typeof k === 'string' && canauxDeclares.has(k)))];
  const vusSansRealisation = new Set();
  const signalerRealisationManquante = (key, line, col) => {
    const canaux = realisationsPar[key];
    if (!canaux || vusSansRealisation.has(key) || sortiesActives.length === 0) return;
    const orphelines = sortiesActives.filter((s) => !canaux.has(s));
    if (orphelines.length === 0) return;
    vusSansRealisation.add(key);
    errors.push({
      message: `'${key}' est un mot GÉNÉRIQUE : chaque sortie déclare comment elle le réalise, et `
        + `${orphelines.map((s) => `'${s}'`).join(' et ')} ne le réalise${orphelines.length > 1 ? 'nt' : ''} `
        + `pas. Écrit ici, il ne ferait rien. Réalisé aujourd'hui par : `
        + `${[...canaux].sort().map((c) => `'${c}.${key}'`).join(', ')}.`,
      line,
      col,
    });
  };

  // ── UN TAG DE BACKTICK NOMME UN ÉVALUATEUR DÉCLARÉ, PAS N'IMPORTE QUEL MOT ──────────────────
  // ⚠️ CE QUI PASSAIT : `` `zz: du code` `` compilait. Le lecteur de tag ne vérifiait que sa FORME
  // — une expression régulière « une lettre puis des caractères de mot » — jamais son appartenance
  // à une liste. Une COQUILLE (`jss:` pour `js:`) créait donc un interprète fantôme EN SILENCE, et
  // la scène compilait : le code partait à un évaluateur qui n'existe pas, sans une erreur. Même
  // famille que le drapeau qui confisquait un nom, réparé le 2026-08-12.
  //
  // LA LISTE EST UNE DONNÉE, jamais un tableau en dur : `lib/eval.json` déclare les évaluateurs et
  // `core` l'apporte depuis le 2026-08-13, pour qu'une scène ordinaire l'ait en portée. Ajouter un
  // langage se fait donc dans la librairie, et ce refus le suit sans une ligne de code.
  const evaluateurs = new Set((vocab.components && vocab.components.eval) || []);
  const tagsVus = new Set();
  const verifierTag = (tag, line, col) => {
    if (typeof tag !== 'string' || !tag || evaluateurs.has(tag) || tagsVus.has(tag)) return;
    tagsVus.add(tag);
    errors.push({
      message: `'\`${tag}: …\`' nomme un évaluateur qui n'est pas déclaré. Un tag de backtick désigne `
        + `QUI exécute le code, et la liste vit dans la librairie 'eval' : `
        + `${[...evaluateurs].sort().join(', ')}. Une coquille y créerait un interprète fantôme, et `
        + `la scène compilerait sans que le code parte nulle part.`,
      line,
      col,
    });
  };

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
    if (typeof node.tag === 'string' && typeof node.code === 'string') {
      verifierTag(node.tag, node.line, node.col);
    }
    if (node.payload && node.payload.params) {
      // ⚠️ L'AMBIGUÏTÉ SE JUGE SUR LA FORME ÉCRITE, JAMAIS SUR LE REPLI. `payload.params` est
      // keyé par le nom CANONIQUE du contrôle : le préfixe qui levait l'ambiguïté n'y figure
      // plus, et juger ici accuserait `audio.pan:0.5` d'être écrit nu. On lit donc les sacs
      // COLLÉS à ce nœud pour savoir si la clé y est arrivée préfixée.
      // DEUX SOURCES, et n'en lire qu'une laissait passer le cas le plus courant : un SAC porte
      // lui-même un `payload.params` replié de SES PROPRES paires — il n'a pas de
      // `suffixQualifiers`, il EST le qualifieur. Ne regarder que les sacs collés accusait donc
      // tout sac préfixé d'être écrit nu.
      const prefixees = new Set();
      const noter = (liste) => { for (const pr of liste || []) if (pr && pr.lib) prefixees.add(pr.key); };
      noter(node.pairs);
      for (const sq of (node.suffixQualifiers || [])) noter(sq && sq.pairs);
      for (const k of Object.keys(node.payload.params)) {
        if (!prefixees.has(k)) { signalerAmbiguite(k, node.line); signalerRealisationManquante(k, node.line); }
        flag(k, node.line);
      }
    }
    // ⚠️ LES DEUX SIGNES, PAS UN SEUL. Le mode s'écrit aussi bien entre parenthèses (`SettingBag`)
    // qu'entre crochets (`Qualifier`) — et mon premier refus ne visait que le premier. Mesuré dans
    // la foulée : `S -> C4 [mode:random]` PASSAIT, alors qu'il était refusé la minute d'avant.
    // J'avais donc fermé la porte d'un côté en en ouvrant une de l'autre, dans le même geste.
    // C'est la faute « énumérer TOUTES les formes que le parser peut produire », commise en
    // écrivant le correctif qui la cite.
    if ((node.type === 'SettingBag' || node.type === 'Qualifier') && Array.isArray(node.pairs)) {
      for (const p of node.pairs) {
        if (node.type === 'SettingBag') {
          // Une paire ÉCRITE sans préfixe : c'est ici, et seulement ici, que l'ambiguïté se voit.
          if (!p.lib) { signalerAmbiguite(p.key, p.line, p.col); signalerRealisationManquante(p.key, p.line, p.col); }
          flag(p.key, p.line, p.col);
        }
        // ⛔ LE MODE NE CHANGE PAS EN COURS DE TIRAGE — décision de Romain, 2026-08-08.
        //
        // Il vaut pour un BLOC et s'écrit `mode:<valeur>` en tête de sous-grammaire, point. La
        // forme en sac — suffixe de règle, flux, ou n'importe quelle autre position — est SUPPRIMÉE.
        //
        // ⚠️ CE QUI A CONDUIT À CETTE DÉCISION, et c'est une leçon sur les références. La spec
        // écrivait `S -> A B C (mode:random)` et lui consacrait un paragraphe entier expliquant
        // qu'un mode écrit sur une règle gouverne le bloc. Mesuré sur les trois sources : le corpus
        // écrit `mode` en tête **287 fois** et la forme en sac **ZÉRO** ; le moteur d'origine met
        // son mode en tête de bloc, seul sur sa ligne, jamais en suffixe. La spec décrivait donc
        // une forme que ni le moteur ni aucune scène ne connaît — et mon arbre ne l'appliquait
        // nulle part : le mode restait sur la règle, le bloc restait sans mode.
        // Romain a tranché en supprimant la forme plutôt qu'en la faisant vivre.
        // ⚠️ Elle avait essaimé : DIX-SEPT occurrences dans les trois spécifications, alors que je
        // n'en avais vu qu'une. Un balayage, jamais une correction sur place.
        //
        // On refuse ICI, sur l'arbre entier, et non dans une branche du parseur : le mode ne doit
        // apparaître dans AUCUN sac, quelle qu'en soit la position — règle, groupe, symbole, flux,
        // accolade fermante. Une garde écrite pour la position qui s'est montrée laisserait vivre
        // les cinq autres.
        if (p.key === 'mode') {
          errors.push({
            message: `'(mode:…)' n'a plus sa place dans une règle : le mode vaut pour un BLOC et ne `
              + `change pas en cours de tirage (décision Romain 2026-08-08). L'écrire `
              + `'mode:${p.value ?? '<valeur>'}' en tête de la sous-grammaire concernée — une `
              + `ligne seule, avant ses règles.`,
            line: p.line, col: p.col,
          });
        }
      }
    }
    // ⛔ UN RÉGLAGE ÉCRIT HORS DE SA PORTÉE EST REFUSÉ — décision de Romain, 2026-08-08 :
    // « le poids n'a de sens que sur une RÈGLE, et une écriture hors portée doit être REFUSÉE avec
    // une erreur explicite nommant la ligne, le contrôle et la portée ».
    //
    // C'est le seul office de la déclaration de portée. L'accrochage dans l'arbre DIT déjà où le
    // réglage est ; la librairie dit où il A LE DROIT d'être. Sans cette confrontation, on lit
    // n'importe quel réglage n'importe où sans jamais pouvoir dire qu'il est mal placé — c'est ce
    // qui a rendu un poids muet pendant quatre jours, le défaut du moteur appliqué à sa place.
    //
    // La place se lit sur le NŒUD QUI PORTE le sac, jamais sur une liste de noms : ajouter un
    // porteur au langage suffit à l'inscrire ici. Les portées permises viennent de la DONNÉE
    // (chaque clé, dans SA librairie) — ce code ne nomme aucun contrôle.
    // ⏸️ REFUS SUSPENDU — les portées déclarées ne sont pas encore INSTRUITES (Romain, 2026-08-08).
    //
    // Le mécanisme est complet et mesuré, mais il confronte l'écriture à des portées que j'avais
    // tirées d'un inventaire d'USAGE. Romain a posé la méthode : « il faut inspecter pour chaque
    // contrôle, en fonction de ce qu'il EXPRIME, ce qui a du sens ou non » — en restant conforme
    // aux limites du moteur d'origine QUI FONT SENS, et en étendant délibérément avec le sac collé
    // et le sac de flux.
    // Refuser sur des déclarations non fondées casserait des écritures légitimes en se réclamant
    // d'une règle que personne n'a arrêtée. Le refus se rebranche quand les 70 clés sont instruites
    // une par une ; d'ici là il ne mord pas, et ce commentaire dit pourquoi plutôt que de le taire.
    const place = REFUS_HORS_PORTEE_ACTIF ? PORTEE_DU_PORTEUR[node.type] : null;
    if (place) {
      for (const sac of [node.settings, node.qualifier, ...(node.suffixQualifiers || [])]) {
        if (!sac || !Array.isArray(sac.pairs)) continue;
        for (const p of sac.pairs) {
          const cle = String(p.key).split('.')[0];
          const permis = porteesPermises.get(cle);
          if (!permis || permis.includes(place)) continue;
          errors.push({
            message: `'${cle}' ne peut pas s'écrire ${NOM_DE_PLACE[place]} — `
              + (permis.length === 1
                  ? `il ne vaut QUE ${NOM_DE_PLACE[permis[0]] ?? permis[0]}`
                  : `il vaut ${permis.slice(0, -1).map((s) => NOM_DE_PLACE[s] ?? s).join(', ')}`
                    + ` ou ${NOM_DE_PLACE[permis[permis.length - 1]] ?? permis[permis.length - 1]}`)
              + `. Le déplacer là, ou employer un réglage qui vaut ici.`,
            line: p.line ?? node.line, col: p.col,
          });
        }
      }
    }
    for (const k in node) { if (k !== 'params' && node[k] && typeof node[k] === 'object') collect(node[k]); }
  })(ast.subgrammars);
  // ⚠️ LE CONTRÔLE DES TAGS NE S'ARRÊTE PAS AUX SOUS-GRAMMAIRES. `init` porte du code hors de
  // toute règle : un tag inconnu y passait, alors qu'il est refusé partout ailleurs. Trouvé par le
  // garde de l'état de départ. On repasse sur `init` — les autres volets, eux, n'ont rien à y voir.
  for (const e of (ast.init || [])) {
    if (e && typeof e.tag === 'string' && typeof e.code === 'string') verifierTag(e.tag, e.line, e.col);
  }

  // ── LES DEUX PLACES QUI N'ONT PAS DE SAC : la tête de scène et la tête de sous-grammaire ────
  //
  // ⚠️ MON REFUS NE GARDAIT QUE QUATRE PLACES SUR SIX, et c'est le produit croisé qui l'a montré —
  // 85 cellules « déclaré interdit mais accepté », toutes sur ces deux places. `weight:50` en tête
  // de scène passait, `stop` aussi. J'avais écrit la garde pour les endroits où un sac se pose
  // dans une règle, c'est-à-dire pour la forme que j'avais sous les yeux ; les deux places qui
  // s'écrivent AUTREMENT — une directive, un modificateur de mode — n'étaient pas gardées du tout.
  // C'est la faute « on répare l'endroit où le défaut s'est montré », commise sur une garde dont
  // c'est précisément le sujet.
  if (REFUS_HORS_PORTEE_ACTIF) {
    const dire = (cle, place, line) => {
      const permis = porteesPermises.get(cle);
      if (!permis || permis.includes(place)) return;
      errors.push({
        message: `'${cle}' ne peut pas s'écrire ${NOM_DE_PLACE[place]} — `
          + (permis.length === 1
              ? `il ne vaut QUE ${NOM_DE_PLACE[permis[0]] ?? permis[0]}`
              : `il vaut ${permis.slice(0, -1).map((x) => NOM_DE_PLACE[x] ?? x).join(', ')}`
                + ` ou ${NOM_DE_PLACE[permis[permis.length - 1]] ?? permis[permis.length - 1]}`)
          + `. Le déplacer là, ou employer un réglage qui vaut ici.`,
        line,
      });
    };
    // ⚠️ UNE DIRECTIVE DE TÊTE N'EST PAS TOUJOURS UN RÉGLAGE — et l'homonymie est réelle.
    // `mod` INVOQUE la librairie des modulations ; elle ne pose pas le contrôle MIDI `mod`.
    // Mesuré : sans ce tri, cinq scènes du corpus étaient refusées à tort, toutes pour ce seul
    // mot. Une invocation se reconnaît à ce qu'un fichier de librairie porte son nom — c'est le
    // même critère que le chargeur emploie, pas une liste de noms à écarter.
    for (const d of (ast.directives || [])) {
      if (!d || !d.name) continue;
      // ⛔ UNE DECLARATION N EST PAS UN USAGE — corrige le 2026-08-09.
      // `def mute drum.on` DECLARE un nom ; il n ECRIT pas le controle `mute` en tete de scene.
      // Ce parcours prenait le `name` de TOUTE directive, donc une declaration dont le nom se
      // trouve etre celui d un controle se faisait refuser pour une place qu elle n occupe pas.
      // ⚠️ ET C EST EXACTEMENT LE SUJET DU GARDE QUI L A TROUVE — « le nom declare par la scene
      // gagne ». La regle etait ecrite, appliquee ailleurs, et ce parcours-ci ne la connaissait
      // pas : il ne distinguait pas ce qui S ECRIT de ce qui SE DECLARE.
      if (d.type && d.type !== 'Directive') continue;
      // ⚠️ UNE CLÉ DE SCÈNE S'ÉCRIT DE DEUX FAÇONS, et je n'en gardais qu'une : nue (`tempo:120`) ou
      // QUALIFIÉE PAR SON DOMAINE (`engine.mode:random`, la forme que le tableau des invocations
      // de la référence emploie). Mesuré le 2026-08-08 : après avoir retiré `mode` des clés de
      // scène, `mode` refusait bien — et `engine.mode` passait toujours. Deux graphies de la même
      // chose, une seule gardée : le refus se contournait en écrivant le nom complet.
      const clesEcrites = [];
      if (!loadLib(d.name)) clesEcrites.push(d.name);   // nue ; une invocation de librairie n'en est pas une
      if (d.subkey && porteesPermises.has(d.subkey)) clesEcrites.push(d.subkey);  // qualifiée
      for (const cle of clesEcrites) dire(cle, 'scene', d.line);
    }
    for (const sg of (ast.subgrammars || [])) {
      for (const m of (sg.modifiers || [])) {
        const nom = typeof m === 'string' ? m : (m && m.name);
        if (nom) dire(nom, 'subgrammar', sg.line);
      }
    }
  }

  // 2. Existence d'un COMPOSANT référencé dans un axe à catalogue.
  const checkComponent = (axis, name, line) => {
    if (!name) return;
    if (componentExists(axis, name)) return;
    // Un alphabet peut vivre HORS du catalogue standard, dans une librairie que la scène a
    // elle-même déclarée (`test_alphabets` par exemple). La validation doit donc poser la MÊME
    // question que la résolution — sinon elle refuse un nom que le resolveur sait charger, et on
    // a deux vérités sur « cet alphabet existe-t-il ».
    if (axis === 'alphabet' && resolveActorAlphabet(name, ast.directives)) return;
    errors.push({ message: `${axis} '${name}' introuvable dans le catalogue (référence inexistante)`, line });
  };

  // 3bis. LIBRAIRIE SANS CATALOGUE — une ENTRÉE INCONNUE y crie aussi (arbitrage architecte
  // 2026-07-27, sur le cas `dhin1`). Les axes à CATALOGUE crient depuis toujours ; les autres —
  // `transcription`, `test_alphabets`, `settings`, `mapping`… — acceptaient n'importe quel nom EN
  // SILENCE. Payé sur pièce : `homomorphism.dhinOO` a traversé toute la migration sans un mot ;
  // la scène croyait charger un homomorphisme et n'en chargeait AUCUN, depuis des mois.
  //
  // L'ARGUMENT QUI TRANCHE : ne rien pouvoir vérifier n'est pas une raison de ne rien vérifier,
  // c'est une raison de vérifier AUTRE CHOSE. Ici le vérifiable est trivial — l'entrée existe-t-elle
  // dans le fichier invoqué. Aucun catalogue n'est requis pour poser cette question.
  //
  // FRONTIÈRE MESURÉE AVANT DE LIVRER, sur 447 fichiers de scène (bibliothèque Kanopi entière,
  // démos, scènes de BPx) : QUATRE invocations ne résolvent pas, et les quatre sont déjà refusées
  // aujourd'hui (`alphabet.raga`, axe à catalogue). Ce fail-loud n'ajoute donc AUCUNE casse.
  const libExiste = (nom) => !!loadLib(nom);
  const motsDuLangage = new Set(loadLib('core')?.schema?.reservedDirectives || []);
  for (const d of ast.directives || []) {
    if (!d || !d.name || !d.subkey) continue;
    if (catalogAxes.includes(d.name)) continue;   // déjà couvert par checkComponent, ci-dessous
    // ⛔ UN AXE QUE PERSONNE NE SERT EST REFUSE. Cette ligne disait « pas une librairie : autre
    // faute, autre message » — et AUCUN autre message n'existait. `module.adsr`, `patch.x`,
    // `devices.x` passaient donc en silence, et `zzzinvente.quoi` aussi : le trou n'etait pas de
    // trois noms, il etait OUVERT A L'INFINI. Mesure du 2026-08-17, cas fabrique par l'architecte.
    //
    // ⚠️ RIEN N'EST EN DUR NI D'UN COTE NI DE L'AUTRE. Les trois noms venaient de la SPEC, jamais
    // du code — il ne les a jamais connus. Et ce qui est epargne ici se lit dans la DONNEE : les
    // mots du langage que `core.schema.reservedDirectives` recense, dont `out`, `in` et `var`, qui
    // portent une sous-cle sans etre des invocations de librairie.
    if (!libExiste(d.name)) {
      if (motsDuLangage.has(d.name)) continue;
      errors.push({
        message: `'${d.name}.${d.subkey}' : aucune librairie ne sert l'axe '${d.name}'. Une `
               + `invocation dont l'axe n'est porte par aucune donnee ne charge RIEN, et rien ne `
               + `distingue ce silence d'une scene qui n'a pas declare.`,
        line: d.line,
      });
      continue;
    }
    if (loadLib(d.name, d.subkey)) continue;
    errors.push({
      message: `'${d.name}.${d.subkey}' : l'entrée '${d.subkey}' n'existe pas dans la librairie `
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
      message: `'in ${e.name} … mapping.${e.mapping}' : la table '${e.mapping}' n'existe pas dans `
             + `la librairie 'mapping'. Une entrée qui invoque une table inexistante croirait `
             + `traduire et ne traduirait rien. Sans table, écrire l'entrée seule et employer des `
             + `adresses nues ('<!${e.name}.60').`,
      line: e.line,
    });
  }

  // 3. Directives de scène : invocation de composant (axis.X) OU override de valeur (X:v).
  for (const d of ast.directives || []) {
    if (d.subkey && catalogAxes.includes(d.name)) { checkComponent(d.name, d.subkey, d.line); continue; }
    if (d.value != null && d.value !== true && !registry.has(d.name) && !reserved.has(d.name)) {
      errors.push({ message: `valeur '${d.name}:…' inconnue — non déclarée par une librairie chargée`, line: d.line });
      continue;
    }
    // ⚠️ ET LA FORME NUE AUSSI — c'est la moitié qui avait régressé. Le refus ci-dessus ne mordait
    // que sur `X:valeur` : toute directive écrite SANS valeur passait, quel que soit son nom.
    // Mesuré le 2026-08-10 : `zorglub42` compilait sans un mot, exactement comme `sub`.
    //
    // C'est la règle 1 de Romain dans son état le plus nu — « tous les mots acceptés par le parseur
    // doivent venir des librairies invoquées dans la scène ». L'union des vocabulaires ne sert à
    // rien tant qu'un nom absent de l'union est accepté quand même : le vocabulaire existe, il
    // n'est simplement pas OPPOSÉ à l'auteur.
    //
    // Une invocation de librairie (`core`, `alphabet.western`) porte son nom dans le registre ou
    // un `subkey` — elle ne tombe pas ici.
    // ⚠️ ET SEULEMENT LES DIRECTIVES QUI INVOQUENT. Une directive qui DÉCLARE (`def`, `var`,
    // `actor`…) porte le nom que l'AUTEUR crée, pas un mot de librairie : son nœud a son propre
    // type, et l'aval le lit ainsi. Sans ce filtre, la garde refuse `def m C4 D4` en accusant
    // « 'm' n'est déclaré par aucune librairie » — elle reproche à l'auteur d'avoir nommé ce
    // qu'il déclare. Mesuré le 2026-08-10 : j'ai d'abord pris ce refus pour un défaut du parseur
    // et je l'ai inscrit au backlog ; c'était la garde qui ne savait pas distinguer.
    if (d.type && d.type !== 'Directive') continue;
    if (d.value == null && !d.subkey && !d.runtime
        && !registry.has(d.name) && !reserved.has(d.name) && !loadLib(d.name)) {
      errors.push({
        message: `'${d.name}' n'est déclaré par aucune librairie chargée — un mot de tête vient `
               + `d'une librairie invoquée, jamais de nulle part. Invoquer la librairie qui le `
               + `porte, ou retirer la ligne.`,
        line: d.line,
      });
    }
  }

  // 4bis. UN RÉGLAGE QUI NE SE POSE QU'UNE FOIS NE SE POSE PAS DEUX — et le groupe est DANS LA
  //       DONNÉE, jamais ici.
  //
  // Le moteur natif tient deux compteurs (CompileGrammar.c:1535-1551) et refuse par `return(7)` :
  // la grammaire entière ne compile pas. `NotFoundMetronom` couvre `_mm` ; `NotFoundNatureTime` est
  // PARTAGÉ par `_striated` et `_smooth`, qui tombent dans le même `case` par fall-through.
  //
  // ⚠️ C'EST POURQUOI LA DONNÉE NOMME UN GROUPE ET NON UN BOOLÉEN. Un `unique:true` par mot aurait
  // laissé passer `striated` suivi de `smooth` — deux mots différents, un seul réglage : la nature
  // du temps, qu'on ne règle pas deux fois. C'est le cas qu'une formulation par mot rate, et il a
  // fallu que bp3-frontend aille lire le C pour qu'il apparaisse : mon signalement d'origine ne
  // parlait que de deux mots sur trois, et les donnait pour indépendants.
  //
  // TOUTES LES POSITIONS COMPTENT DANS LE MÊME SEAU, parce que le natif compte sur la GRAMMAIRE
  // entière : la tête de scène et les modificateurs de sous-grammaire. Compter la surface à part de
  // la graphie de sous-grammaire laisserait passer `tempo:120` suivi de `mode:ord(tempo:90)`.
  {
    const groupes = new Map();          // groupe -> [{mot, line}]
    const noter = (nom, line) => {
      if (!nom) return;
      const g = groupeDUnicite(nom);
      if (!g) return;
      if (!groupes.has(g)) groupes.set(g, []);
      groupes.get(g).push({ mot: nom, line });
    };
    for (const d of ast.directives || []) {
      if (!d || (d.type && d.type !== 'Directive')) continue;
      noter(d.name, d.line);
      for (const m of d.modifiers || []) noter(m && m.name, d.line);
    }
    for (const sg of ast.subgrammars || []) {
      for (const m of sg.modifiers || []) noter(m && m.name, sg.line);
    }
    for (const [groupe, vus] of groupes) {
      if (vus.length < 2) continue;
      const mots = [...new Set(vus.map((v) => v.mot))];
      errors.push({
        message: `'${groupe}' est réglé ${vus.length} fois (${mots.map((m) => `'${m}'`).join(', ')}) `
               + `— il ne se règle qu'une fois par scène. `
               + (mots.length > 1
                 ? `Ces mots règlent LA MÊME CHOSE : en garder un seul.`
                 : `Retirer les occurrences en trop.`)
               + ` Le moteur natif refuse la grammaire entière dans ce cas.`,
        line: vus[vus.length - 1].line,
      });
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
 * SCÈNE (`test_alphabets.abc`), le nom nu est une impasse : Kairos ne connaît pas `abc`, et
 * il ne DOIT pas le deviner — il lit le domaine déclaré DANS le fichier, il ne l'infère jamais
 * d'une adresse. Sans provenance, sa seule issue serait de renifler, c'est-à-dire d'inventer.
 *
 * CE QU'ELLE ÉMET, et rien de plus. L'adresse canonique `<fichier>.<entrée>`, UNIQUEMENT quand
 * l'entrée vient d'une librairie déclarée par la scène. Une liaison servie par le catalogue
 * standard n'émet RIEN : elle se retrouve déjà par son nom, et lui poser une adresse ferait du
 * bruit là où il n'y a pas de question. Champ OMIS si vide, jamais `[]` (patron `cvInstances`).
 *
 * POURQUOI CE N'EST PAS LE MIROIR DE LA PORTÉE SCÈNE. `ast.libRefs` naît des invocations par
 * provenance (`factory.` / `mine.`) — mesuré sur le corpus des 95 : ZÉRO scène en émet. Le
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
 * LE DÉFAUT QUE ÇA CORRIGE, mesuré : une scène qui écrit `test_alphabets.structural` déclare bien
 * un alphabet — `lib/core.json` le dit noir sur blanc, `test_alphabets` = « référence-librairie,
 * MÊME AXE CATALOGUE que `alphabet` ». Mais j'émettais la directive sous le NOM DE SA LIBRAIRIE, et
 * l'aval ne lit que `name === 'alphabet'` (`BPx/src/session.ts:2124`) : l'alphabet n'arrivait donc
 * jamais. `ames` sortait `scenePitch {alphabet:'western', …}`, `negative-context` sortait
 * `scenePitch {tokens:[…]}` — sans rien. Et pour Kairos, « scène sans alphabet » et « scène dont
 * l'alphabet ne m'est pas parvenu » sont indistinguables : il devinait, et donnait 440 Hz au
 * symbole STRUCTUREL `A` d'une grammaire qui se déclare « test de grammaire pure ».
 * Rayon mesuré avant correctif : 10 scènes sur 95, et TOUTES en `test_alphabets.X` — aucune scène
 * en `alphabet.X` n'était touchée.
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
 * règle n'atteint personne — c'était l'état mesuré : `meter:4/4` compilait et n'était consommé
 * par rien.
 *
 * Une règle qui porte déjà un mètre n'est PAS touchée : c'est le recouvrement.
 */
/**
 * GARDE — UN SEUL ESPACE DE NOMS. Rien ne peut porter le nom d'autre chose.
 *
 * Règle de Romain (2026-07-28) : « il ne faut AUCUNE AMBIGUÏTÉ POSSIBLE. RIEN ne peut avoir des
 * noms identiques. À chaque fois qu'on déclare un truc dont le nom existe déjà, ça doit être
 * signalé par une ERREUR. »
 *
 * ⚠️ LE CRITÈRE EST L'EFFET, JAMAIS LA FORME DE LA LIGNE. Ce qui est refusé, c'est ce qui CRÉE un
 * nom. Une écriture qui pose une PROPRIÉTÉ sur un nom existant reste permise — `gate Sa:sc` dit
 * le type temporel et le routage d'un terminal, elle ne crée aucun nom rival : mesuré, le nœud
 * produit est identique avec et sans elle. Un garde qui filtrerait sur « ça commence par une
 * directive » refuserait cette forme ratifiée et laisserait passer une tête de règle ambiguë.
 *
 * DEUX ÉNONCÉS, TOUS DEUX GLOBAUX — aucune portée, et c'est mesuré, pas supposé :
 *   A. une TÊTE DE RÈGLE ne peut porter le nom d'aucune AUTRE SORTE de chose (terminal de
 *      l'alphabet actif, macro, alias, entrée, acteur, variable de travail, scène, objet CV,
 *      DRAPEAU) ;
 *   B. deux déclarations qui CRÉENT un nom ne peuvent pas porter le même, ni le nom d'un terminal.
 *
 * ⚠️ CE QUI N'EST PAS DEDANS, ET C'EST LA MOITIÉ DU TRAVAIL : les têtes de règle ne se heurtent
 * JAMAIS entre elles. Une tête répétée n'est pas un conflit, c'est une ALTERNATIVE — le choix et
 * les poids, c'est-à-dire le mécanisme même d'une grammaire stochastique ; et deux sous-grammaires
 * sont des PASSES successives, pas des espaces parallèles, donc un même nom y est le même symbole
 * réécrit plus tard. Un témoin de garde m'avait été prescrit qui refusait ce cas : mesuré, il
 * aurait refusé 120 scènes sur 333. C'est en le mesurant qu'il est tombé, pas en le relisant.
 *
 * ⚠️ UN DRAPEAU CRÉE UN NOM, DEPUIS LE 2026-07-30 (Romain, `hub/decisions/2026-07-30-trois-
 * arbitrages-nature-fabrique-drapeaux.md`) : « les drapeaux doivent être inclus dans l'espace de
 * déduplication des noms ». C'était un TROU, pas un espace séparé légitime — mesuré sur les 272
 * scènes du corpus : 3 portent un drapeau, toutes nommées `section`, zéro homonymie, donc le
 * corpus ne bouge pas en fermant le trou. Ce qui crée le nom, c'est le drapeau LUI-MÊME
 * (`var section flag: …`, ex-`flag section: …` — la forme de tête de scène est tombée le
 * 2026-08-05), PAS ses états : `calm`/`full` dans `var section flag: calm:1, full:2` ne sont
 * que des étiquettes internes au drapeau, jamais des noms globaux — les y faire entrer
 * déborderait la règle. Une LECTURE du drapeau (`[section==calm]`, une mutation `[section=full]`)
 * n'en crée pas non plus : comme `declarations` (gate/trigger/cv), c'est une propriété posée sur
 * un nom existant, pas une création.
 */
function refuserNomsEnDouble(ast, libCtx) {
  const erreurs = [];
  const { terminaux } = terminauxEnPortee(ast);

  // Ce qui CRÉE un nom, par sorte. `declarations` (gate/trigger/cv) n'y est PAS : elle pose une
  // propriété sur un nom existant. Les têtes de règle sont à part — elles ne se heurtent pas
  // entre elles, donc elles ne peuvent pas servir de « déjà pris » les unes pour les autres.
  const creesParDeclaration = new Map();   // nom → { sorte, line }
  const noter = (nom, sorte, line) => {
    if (!nom || typeof nom !== 'string') return;
    if (creesParDeclaration.has(nom)) {
      const p = creesParDeclaration.get(nom);
      erreurs.push({
        message: `le nom '${nom}' est déjà pris : ${p.sorte} l'a déclaré${p.line ? ` ligne ${p.line}` : ''}, `
          + `et ${sorte} le redéclare. Un nom ne désigne qu'UNE chose dans une scène — sinon, en le `
          + `lisant dans une règle, on ne sait plus de quoi on parle. Choisir un autre nom.`,
        line,
      });
      return;
    }
    creesParDeclaration.set(nom, { sorte, line });
    if (terminaux.has(nom)) {
      erreurs.push({
        message: `'${nom}' est un TERMINAL de l'alphabet actif, et ${sorte} en fait un nom — une `
          + `règle qui écrirait '${nom}' ne dirait plus si elle joue la note ou l'autre chose. `
          + `Choisir un autre nom. Le refus tombe à la DÉCLARATION : le nom n'a pas besoin d'être `
          + `employé pour que l'ambiguïté existe.`,
        line,
      });
    }
  };
  for (const e of ast.inputs || []) noter(e?.name, 'une entrée', e?.line);
  // ⚠️ `ast.vars` porte la DIRECTIVE ENTIÈRE (`VarDirective`) depuis le 2026-08-05, pas un nom nu :
  // une ligne peut en porter PLUSIEURS (`names`). Un drapeau (Romain 2026-07-30, `varType.kind ===
  // 'flag'`, ex-`@flag`) CRÉE un nom comme toute autre variable — le nom est `names[0]`, jamais
  // les états (`varType.states[].name`), qui sont des étiquettes internes.
  for (const v of ast.vars || []) {
    const sorte = v?.varType?.kind === 'flag' ? 'un drapeau' : 'une variable de travail';
    for (const n of v?.names || []) noter(n, sorte, v?.line);
  }
  // ⚠️ L'ACTEUR EST LÀ, ET IL Y EST REVENU LE 2026-07-28 AU SOIR. Je l'en avais écarté le matin,
  // en croyant protéger la voix de code : `actor viz eval.hydra` puis `viz -> <code>` était la
  // forme du corpus, et je l'avais remontée comme un « conflit dans la décision » à arbitrer.
  // Romain a tranché l'inverse, et il avait raison depuis le début : cette écriture AMALGAME un
  // nom d'acteur et un nom de règle, et c'est précisément ce que la règle existe pour interdire.
  // J'avais donc écrit une exception pour protéger la faute.
  // Ce qui donne son langage au code est le TAG, pas le nom de la règle — 44 scènes migrées chez
  // Kanopi, zéro amalgame restant, mesuré avant de poser ceci.
  for (const a of ast.actors || []) if (!a?.synthetic) noter(a?.name, 'un acteur', a?.line);
  for (const sc of ast.scenes || []) noter(sc?.name, 'une scène', sc?.line);
  // ⚠️ LES DEFINITIONS MANQUAIENT A CE RECENSEMENT, et le trou s est vu le jour ou `def` a
  // remplace `macro` (2026-08-09) : `var C4 adsr` refusait le conflit de nom, `def C4 …` passait.
  // L invariant — un nom ne designe qu UNE chose — etait donc garde pour six sortes de declaration
  // et pas pour la septieme, la plus recente. Une garde ecrite avant une forme ne la connait pas :
  // c est a l ajout de la forme qu il faut y penser, et rien ne le rappelle.
  // ⚠️ ET SEULEMENT CELLES QUI NE DECLARENT PAS UN TERMINAL. Une definition de terminal
  // (`def ka voice.sec`) ne PREND pas un nom, elle en CREE un — la recenser comme un conflit
  // interdisait de declarer quoi que ce soit, et mes deux gardes de `def` sont tombes dessus
  // dans la minute. Le conflit ne vaut que pour une definition qui reinvoque autre chose sous
  // un nom deja porte par un terminal.
  for (const d of ast.directives || []) {
    if (d && d.type === 'DefDirective' && d.kind !== 'terminal') {
      noter(d.name, 'une définition', d.line);
    }
  }
  // Un drapeau CRÉE un nom (Romain 2026-07-30) — voir la boucle sur `ast.vars` ci-dessus, qui le
  // couvre depuis que `flag` est tombé (2026-08-05) : `FlagStatesDirective` n'est plus produite.

  // ⚠️ LES TÊTES DE RÈGLE NE SONT PLUS CONTRÔLÉES ICI — décision Romain du 2026-08-03,
  // `hub/decisions/2026-08-03-une-tete-de-regle-peut-etre-un-terminal.md`, appliquée le 2026-08-07.
  //
  // « Une tête de règle a le droit de porter le nom d'un terminal. Le frontal doit accepter
  // `C4 -> G4`, `?1 D4 -> ?1 E4`, `#K1 #K2 #K3 M -> C4`. » Le motif est le mécanisme lui-même :
  // c'est le principe du mode `sub`/`sub1` — une règle de SUBSTITUTION réécrit un terminal, elle a
  // donc forcément un terminal en tête. Le refus invoquait « la note devient inatteignable », qui
  // est exactement ce que la substitution fait EXPRÈS.
  //
  // ⚠️ ET LA RÈGLE D'UNICITÉ N'EST PAS ROUVERTE — c'est le point à ne pas confondre. Son critère
  // est l'EFFET (`2026-07-28-unicite-des-noms.md`) : « poser une propriété sur un nom existant
  // reste permis — aucun nom rival créé ». Une tête de règle ne CRÉE aucun nom, elle pose une
  // réécriture sur un nom qui existe déjà. C'est le frontal qui la traitait comme une DÉCLARATION ;
  // l'application était trop large, pas la règle. Tout ce qui déclare vraiment — `macro`, `var`,
  // `alias`, `actor`, un objet CV — reste contrôlé au-dessus, y compris contre les terminaux.
  //
  // CE QUE ÇA DÉBLOQUE, et ce n'était pas un détail : aucune grammaire de substitution ne compilait
  // en BPScript. Donc aucun mécanisme de motif — captures, contextes, dièses, gabarits — n'était
  // mesurable de bout en bout depuis une scène ; il fallait passer par la graphie BP3 et le moteur
  // natif. C'est le préalable à mesurer l'ISO de ces mécanismes sur la chaîne complète.
  //
  // ⚠️ CE QUI RESTE CONTRÔLÉ, ET POURQUOI JE NE SUIS PAS ALLÉ PLUS LOIN. La décision NOMME ses
  // trois formes : `C4 -> G4` (un terminal), `?1 D4 -> ?1 E4` (un terminal sous un joker),
  // `#K1 #K2 #K3 M -> C4` avec `var M` (une variable de travail). Elle lève donc DEUX collisions :
  // le TERMINAL et la VARIABLE. Elle ne dit rien des autres.
  //
  // Or l'AMALGAME acteur / tête de règle a été tranché NEUF JOURS PLUS TÔT, en sens inverse et dans
  // ces termes : « erreur grave » (Romain, 2026-07-28) — `actor viz` puis `viz -> <code>` mélange
  // un nom d'acteur et un nom de règle, et 44 scènes de Kanopi ont été migrées pour l'éliminer.
  // Ma première écriture retirait le contrôle EN ENTIER, donc levait aussi ce cas-là : c'était
  // faire dire à une décision plus que ce qu'elle écrit, exactement la faute de la veille sur
  // `out`. Je m'en tiens aux deux collisions nommées ; les autres restent, et le résidu
  // (macro, alias, scène, objet CV — jamais tranchés dans un sens ni dans l'autre) est une
  // question pour Romain, pas une déduction pour moi.
  const LEVEES = new Set(['une variable de travail']);
  const tetesVues = new Set();
  for (const sg of ast.subgrammars || []) {
    for (const r of sg.rules || []) {
      for (const t of r.lhs || []) {
        // Un CONTEXTE n'est pas une tête — il DÉSIGNE un terminal, c'est sa raison d'être.
        // `#C4 S -> G4` dit « S, à condition de ne pas être précédé de C4 » (mesuré par BPx,
        // 2026-07-28). Le contexte POSITIF ne passe pas par ici : le parser le range dans
        // `rule.contexts`, hors du membre gauche.
        if (t?.negated) continue;
        const nom = t?.name;
        if (!nom || tetesVues.has(nom)) continue;
        tetesVues.add(nom);
        const declare = creesParDeclaration.get(nom);
        if (declare && !LEVEES.has(declare.sorte)) {
          erreurs.push({
            message: `la règle '${nom}' porte un nom déjà pris par ${declare.sorte} — `
              + `en lisant '${nom}' dans une séquence, on ne sait plus de quoi on parle. `
              + `Choisir un autre nom pour l'un des deux.`,
            line: r.line,
          });
        }
      }
    }
  }

  // ⛔ UN DRAPEAU CRÉE UN NOM, MÊME SANS `var` — et ce nom était pris à n'importe qui, en silence.
  //
  // CE QUI PASSAIT, mesuré : `S -> C4 [velcont]` compile. `velcont` est un RÉGLAGE du vocabulaire,
  // et le sac de drapeaux en faisait un drapeau sans un mot. Idem pour `[C4]`, le nom d'un
  // terminal de l'alphabet actif. Le sac de drapeaux acceptait TOUT NOM, quelle que soit la sorte
  // à laquelle il appartenait déjà — c'est la seule porte du langage qui restait ouverte, quand
  // `var`, `alias`, `actor`, `def` et les objets CV sont contrôlés depuis longtemps.
  //
  // LA RÈGLE EST CELLE DE LA BIBLE, appliquée à une sorte qui y échappait : les noms de toutes les
  // sortes vivent dans le même espace, chacun n'appartient qu'à une seule, et le contrôle a lieu à
  // la déclaration. Un drapeau se déclare par `var … flag` OU par sa première mutation — les deux
  // créent le nom, donc les deux se contrôlent.
  //
  // ⚠️ CE QUI N'EST PAS REFUSÉ, ET C'EST DÉLIBÉRÉ. Le même drapeau muté dans dix règles reste UN
  // nom, pas dix déclarations. Et une TÊTE DE RÈGLE n'est pas un rival : elle ne crée aucun nom
  // (décision Romain 2026-08-03), donc `[S=1]` à côté d'une règle `S` n'est pas traité ici.
  //
  // ⚠️ TOUTES LES SORTES, SANS EXCEPTION — arbitrage de Romain, 2026-08-12 : « un drapeau doit
  // porter uniquement un nom de drapeau ; un drapeau qui porte le nom de n'importe quoi d'autre
  // devrait générer une erreur ». J'avais laissé passer le TERMINAL, en jugeant l'ambiguïté
  // douteuse puisque les crochets disent déjà qu'on parle d'un drapeau. Romain a tranché l'inverse
  // et la règle est plus simple ainsi : la sorte se décide au nom, pas au signe qui l'entoure.
  // La TÊTE DE RÈGLE y entre aussi — elle ne crée pas de nom (décision 2026-08-03) mais elle en
  // PORTE un, et un drapeau qui le reprend fait exactement ce que ce refus existe pour empêcher.
  const drapeaux = new Set();
  const collecterDrapeaux = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(collecterDrapeaux); return; }
    // DEUX NŒUDS POUR UNE MÊME SORTE, et n'en voir qu'un laissait la moitié de l'espace ouverte :
    // `FlagExpr` est la MUTATION en fin de règle, `Guard` est le TEST devant le membre gauche.
    // Les deux nomment un drapeau, donc les deux confisquent un nom.
    if ((n.type === 'FlagExpr' || n.type === 'Guard') && typeof n.flag === 'string') drapeaux.add(n.flag);
    for (const v of Object.values(n)) collecterDrapeaux(v);
  };
  collecterDrapeaux(ast.subgrammars);
  // Les têtes de règle, recensées à part : elles ne se heurtent pas ENTRE elles (une tête répétée
  // est une alternative) mais un drapeau qui reprend l'une d'elles est un vol de nom.
  const tetesDeRegle = new Map();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) {
    for (const t of r.lhs || []) if (t?.name && !t.negated && !tetesDeRegle.has(t.name)) {
      tetesDeRegle.set(t.name, r.line);
    }
  }
  for (const nom of drapeaux) {
    const declare = creesParDeclaration.get(nom);
    if (declare && declare.sorte !== 'un drapeau') {
      erreurs.push({
        message: `le drapeau '${nom}' porte un nom déjà pris par ${declare.sorte}`
          + `${declare.line ? ` ligne ${declare.line}` : ''} — un nom ne désigne qu'UNE chose dans `
          + `une scène. Choisir un autre nom pour le drapeau.`,
      });
      continue;
    }
    if (tetesDeRegle.has(nom)) {
      erreurs.push({
        message: `le drapeau '${nom}' porte le nom d'une RÈGLE de la grammaire`
          + `${tetesDeRegle.get(nom) ? ` ligne ${tetesDeRegle.get(nom)}` : ''} — un nom ne désigne `
          + `qu'UNE chose dans une scène. Choisir un autre nom pour le drapeau.`,
      });
      continue;
    }
    if (terminaux.has(nom)) {
      erreurs.push({
        message: `le drapeau '${nom}' porte le nom d'un TERMINAL de l'alphabet actif — un nom ne `
          + `désigne qu'UNE chose dans une scène, et un drapeau ne porte qu'un nom de drapeau. `
          + `Choisir un autre nom pour le drapeau.`,
      });
      continue;
    }
    if (libCtx?.controlNames?.has(nom)) {
      erreurs.push({
        message: `le drapeau '${nom}' porte le nom d'un RÉGLAGE du vocabulaire — le sac de `
          + `drapeaux en ferait un drapeau sans un mot, et le réglage deviendrait inatteignable `
          + `sous ce nom. Choisir un autre nom pour le drapeau.`,
      });
      continue;
    }
  }
  return erreurs;
}

/**
 * L'ARBRE DIT LUI-MÊME QUELS NOMS SONT DES NOTES — `ast.noteTerminals`.
 *
 * ORDRE de l'architecte (2026-07-29), sur une règle que Romain venait de graver le matin même
 * (`hub/decisions/2026-07-29-notre-mecanique-n-utilise-que-des-alphabets.md`) : « notre mécanique
 * ne doit utiliser QUE des alphabets ; les conventions ne doivent être connues QUE du frontend
 * BP3 ». Et sa consigne pour ici : l'arbre porte LE FAIT, pas un nom d'alphabet que le
 * consommateur devrait interpréter.
 *
 * ⚠️ POURQUOI CE N'EST PAS UNE FORME QUE J'INVENTE — je n'ai pas à décider du formalisme du
 * langage (règle gravée par Romain le 2026-07-29). Le champ EXISTE, ratifié et daté :
 * `hub/decisions/2026-07-28-le-fait-ce-nom-est-une-note-vient-du-frontal.md` le définit pour
 * bp3-frontend — liste PLATE de noms nus, au niveau SCÈNE, ABSENT ≠ VIDE, contenant « les noms
 * présents dans la scène qu'il reconnaît comme notes : pas le catalogue, pas une table, la
 * résolution DÉJÀ FAITE ». On généralise ce champ, on n'en crée pas un second.
 *
 * CE QUE ÇA RETIRE À L'AVAL, et c'est la raison d'être : Kanopi interrogeait un prédicat à TROIS
 * conventions BP3 (anglaise, française, indienne). La bibliothèque déclare DOUZE alphabets —
 * gamelan_pelog, shruti23, bohlen_pierce et shakuhachi n'ont AUCUNE image dans ces trois-là. Un
 * consommateur qui pose la question porte donc une décision sémantique qui ne lui appartient pas,
 * et qui n'a pas de réponse pour les trois quarts du catalogue. Ici elle en a une, toujours :
 * c'est moi qui possède les alphabets.
 *
 * ABSENT ≠ VIDE, et la distinction porte du sens :
 *   · champ ABSENT  = aucun alphabet résolvable ici (hauteur opaque, voix-code pure) — je ne sais
 *     PAS, et l'aval ne doit pas lire mon silence comme « aucune note » ;
 *   · liste VIDE    = un alphabet est en portée et AUCUN nom de la scène n'est une note. C'est un
 *     fait, pas une ignorance.
 */
function emitNoteTerminals(ast) {
  const { terminaux, aUnAlphabet } = terminauxEnPortee(ast);
  if (!aUnAlphabet) return;                       // je ne sais pas → champs ABSENTS, jamais []
  // Les noms PRÉSENTS dans la scène, des deux côtés de la flèche : une tête de règle qui porte un
  // nom de note en est un cas, et c'est justement celui que l'aval cherche à écarter de sa lecture
  // de structure. Descendre jusqu'aux FEUILLES — un nom sous un groupe polymétrique ou sous une
  // note ancrée compte autant qu'un voisin de surface (faute payée quatre fois en juillet).
  const presents = new Set();
  const recolter = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(recolter);
    if (typeof n.name === 'string') presents.add(n.name);
    for (const k in n) if (n[k] && typeof n[k] === 'object') recolter(n[k]);
  };
  recolter(ast.subgrammars || []);

  // ⚠️ LE PARTAGE EN DEUX — CORRECTION D'UN DÉFAUT QUE J'AI LIVRÉ, PAS UNE EXTENSION (2026-07-29).
  // J'ai d'abord émis UN champ, en reprenant le NOM que la décision du 2026-07-28 définit sans
  // reprendre la DISTINCTION qui le justifie — elle écrit pourtant « champ DISTINCT de
  // alphabetTerminals : deux sources, deux sens ; les fondre est INTERDIT ». Résultat mesuré :
  // mon arbre AFFIRMAIT que `dha`, `dhin`, `ka` (frappes de tabla) et `a`, `b`, `c` (symboles
  // abstraits) SONT des notes, quand la donnée dit l'inverse en toutes lettres. Trouvé par
  // bp3-frontend, qui émet les deux champs depuis le début.
  //
  // ⚠️ LE CRITÈRE NE SE DÉDUIT PLUS, IL SE LIT — REMPLACEMENT, PAS AJOUT (Romain, 2026-07-30,
  // `hub/decisions/2026-07-30-ce-qui-sonne-ce-qui-dure-ce-qui-resout-une-hauteur-se-declare.md`) :
  // « il faut que soit spécifié non seulement si c'est un objet sonnant mais aussi s'il résout une
  // hauteur », et « aucune des trois propriétés ne se déduit ». L'alphabet le DÉCLARE, par
  // `resolvesPitch`.
  //
  // CE QUE LE CRITÈRE DÉDUIT MANQUAIT, ET C'EST CE QUI L'A FAIT RETIRER. Je lisais `defaultTuning`
  // — un alphabet sans accordage ne résolvait pas de hauteur. Mesuré sur les 22 entrées des deux
  // catalogues : UN SEUL faux négatif, mais il est réel — `shakuhachi`. Il ne porte aucun
  // accordage et résout pourtant une hauteur : `lib/octaves.json` lui déclare des registres nommés
  // (otsu, kan, daikan) et ses altérations *meri* et *kari* valent un demi-ton. Les quatre autres
  // sans accordage (tabla, simple, dhadhatite, tryCsoundObjects) étaient bien classés.
  // Un critère juste 21 fois sur 22 reste un critère qui DEVINE ; celui-ci LIT.
  //
  // ⚠️ ET IL RESTE UN TROU QUE CE CHANGEMENT DÉPLACE SANS LE FERMER, dit ici pour qu'on ne le
  // cherche pas ailleurs : `shakuhachi` est désormais une NOTE et ne porte AUCUNE ancre — ni
  // accordage, ni diapason, ni note de base. La donnée dit qu'il résout une hauteur, pas PAR
  // RAPPORT À QUOI. Kairos l'avait signalé le 2026-07-29 ; le combler ici reviendrait à choisir une
  // règle que la donnée n'énonce pas. Consommateurs prévenus avant écriture (préavis du
  // 2026-07-30 à bpx, kairos, bp3-frontend).
  //
  // PRÉCÉDENCE, et elle n'est pas de moi : la décision du 2026-07-28 la fixe — « un nom présent
  // dans les deux champs est traité comme NOTE, c'est l'ordre du C » (SEARCHNOTE avant
  // SEARCHTERMINAL). On émet donc fidèlement dans les deux ; c'est au lecteur d'appliquer la
  // règle, pas à moi de trancher en amputant un champ.
  const aHauteur = (nomAlphabet) => {
    const lib = resolveActorAlphabet(nomAlphabet, ast.directives);
    return !!(lib && lib.resolvesPitch);
  };
  const notes = new Set();
  const sansHauteur = new Set();
  const verser = (nomAlphabet, octaves) => {
    const lib = resolveActorAlphabet(nomAlphabet, ast.directives);
    if (!lib || !nomsDeTerminaux(lib)) return;
    const cible = aHauteur(nomAlphabet) ? notes : sansHauteur;
    for (const t of expandAlphabetTerminals(lib, octaves)) cible.add(t);
    const alts = lib.alterations && typeof lib.alterations === 'object' && !Array.isArray(lib.alterations)
      ? Object.keys(lib.alterations) : [''];
    for (const note of nomsDeTerminaux(lib)) for (const alt of alts) cible.add(note + alt); // forme nue
  };
  const sceneAlpha = (ast.directives || []).find((d) => d.name === 'alphabet' && d.subkey);
  const sceneOct = (ast.directives || []).find((d) => d.name === 'octaves' && (d.subkey || d.runtime));
  if (sceneAlpha) verser(sceneAlpha.subkey, sceneOct ? (sceneOct.subkey || sceneOct.runtime) : null);
  for (const a of ast.actors || []) {
    const p = a.properties || {};
    if (p.alphabet) verser(p.alphabet, p.octaves || null);
  }

  const dansLaScene = (ens) => [...presents].filter((n) => ens.has(n)).sort();
  ast.noteTerminals = dansLaScene(notes);
  ast.alphabetTerminals = dansLaScene(sansHauteur);
}

function emitSceneMeter(ast) {
  // `meter` s'écrit en PARENTHÈSES depuis la décision Romain 2026-08-02 (LANGUAGE.md:773-800) :
  // l'injection du défaut de scène rejoint donc `r.settings.pairs` (le crochet REFUSE désormais
  // `[meter:…]`, cf. checkQualifierKey, parser.js). `r.qualifiers` (sac bracket, procédures de
  // niveau règle) n'est PAS concerné — meter n'y a jamais vécu.
  const dir = (ast.directives || []).find((d) => d && d.name === 'meter' && d.value != null);
  if (!dir) return;
  const valeur = String(dir.value);
  for (const sg of ast.subgrammars || []) {
    for (const r of sg.rules || []) {
      const porteDeja = (r.settings?.pairs || []).some((p) => p && p.key === 'meter');
      if (porteDeja) continue;   // la règle recouvre le défaut de scène, pour elle seule
      r.settings = r.settings || { type: 'SettingBag', pairs: [] };
      r.settings.pairs.push({ key: 'meter', value: valeur, decrement: null });
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
    // lesquels je l'avais écrit. `sound.tabla_perc` résolvait sans rien émettre : l'invocation
    // était acceptée et ne PRODUISAIT rien. Accepter n'est pas transmettre — c'est le même défaut
    // que la directive de mètre qui parlait dans le vide. Corrigé le 2026-07-26 : toute entrée
    // résoluble émet son adresse, quel que soit ce qu'elle contient.
    const adresse = `${d.name}.${d.subkey}`;
    if (!refs.includes(adresse)) refs.push(adresse);
  }
  // TABLE DE CORRESPONDANCE d'une ENTRÉE (`in pedale transport.midi mapping.<table>`). C'est une
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
    const ast = parse(tokenize(source), { onWarning: (w) => result.warnings.push(w),
      // La SOURCE accompagne les jetons : une entrée de catalogue de gabarits se transporte
      // VERBATIM (AST_SPEC §1.9), et aucun jeton ne peut rendre les espaces d'origine.
      source });
    // Résolution d'acteur (décision 2026-07-03 note-nue, option A) : attribution
    // implicite mono-propriétaire + erreur d'ambiguïté « Use dot notation », MÊME
    // sémantique que la voie héritée, compileBPS (supprimée le 2026-07-19, commit
    // 1b974f5, cf. index.js). L'aval ne résout
    // rien (BPx/Kairos lisent `payload.actor` opaque) → sans cette passe, toute
    // note nue part acteur-nulle dans l'arbre.
    //
    // ⚠️ CET APPEL A ÉTÉ REMONTÉ ICI LE 2026-07-29, ET IL CORRIGE UN DÉFAUT QUE J'AI INTRODUIT LE
    // JOUR MÊME. La cascade d'alphabet (`alphabetHerite`) laisse la valeur ABSENTE quand la scène
    // invoque une hauteur OPAQUE — c'est la loi 35, la seule absence légitime. Elle lit ça dans
    // `ast.libRefs`… qui était rempli DEUX PASSES PLUS BAS pour les invocations de SCÈNE. Une
    // scène `test_alphabets.abc` recevait donc le socle core PAR-DESSUS son alphabet invoqué,
    // et ses terminaux `a b c` étaient refusés comme inconnus. C'est très exactement le bug
    // diapason du 2026-07-04 (« jamais le socle par-dessus un composant invoqué »), rejoué sur un
    // autre axe. Trouvé par un témoin que j'écrivais pour AUTRE CHOSE : l'ordre des passes est
    // une donnée du calcul, pas de la mise en page.
    emitSceneLibRefs(ast);         // invocations de librairie en portée SCÈNE — AVANT toute cascade qui les lit
    deriveAlphabetFromTuning(ast); // alphabet ← accordage quand alphabet absent (bug 1.1) — AVANT resolveActors
    result.errors.push(...resolveActors(ast).errors);
    // Une macro ne peut pas porter le nom d'un terminal de l'alphabet actif (Romain 2026-07-28).

    canonicalizeContexts(ast); // frontière AST Palier 3 : contextes → forme canonique (inline/remote)
    result.errors.push(...annotateBackticks(ast));   // _btName + payload.interp/nature:'code' ; CRIE si backtick orphelin sans langage
    applyEnvironmentDefaults(ast, environnement);  // défauts d'environnement → AST (point 1)
    result.errors.push(...refuserAlphabetsMultiples(ast));
    result.errors.push(...applyDefaultActor(ast));   // acteur implicite `default` (transport ← binding alphabet) + garde anti-chevauchement (LAN-5 / KAI-9 / décision 2026-07-05)
    resolveHomomorphismMarkers(ast);  // symbole nu → marqueur d'invocation d'homo par nom (AVANT les validateurs : le marqueur n'est pas un terminal)
    emitActorLibRefs(ast);           // provenance des liaisons d'acteur → `actors[].libRefs` (contrat bpx-kairos-arbre §2.1)
    emitNoteTerminals(ast);          // l'arbre dit LUI-MÊME quels noms sont des notes (ordre architecte 2026-07-29)
    emitSceneMeter(ast);             // `meter` de scène → défaut sur chaque règle qui n'en porte pas (cascade par portée)
    result.ast = ast;

    // Validation sémantique des valeurs de contrôle contre la lib controls
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
    // Les commodités d'écriture se déplient AVANT tout le reste de cette séquence : le destinataire
    // qui suit, la validation des contrôles et le recensement des noms doivent tous voir le
    // vocabulaire CANONIQUE, jamais le raccourci.
    // Le destinataire de chaque réglage, posé sur son sac — une seule passe, après le chargement
    // des librairies qui seul connaît la table (cf. l'en-tête de la fonction).
    poserLeDestinataireDesReglages(ast, libCtx);
    result.errors.push(...applySceneValues(ast, libCtx)); // SCENE_VALUES : pli acteur + validation 3 niveaux
    result.errors.push(...validateReferences(ast, libCtx)); // fail-fast : références (valeur/composant) inexistantes → erreur (univers = describeVocabulary)
    // Le nom d'une macro se vérifie ICI, avec les terminaux de règle : même question, même
    // définition, et les acteurs sont pliés à ce stade (avant, `ast.actors` est encore vide —
    // mesuré : une garde posée plus haut ne voyait AUCUN terminal, donc n'aurait jamais mordu).
    result.errors.push(...refuserNomsEnDouble(ast, libCtx));
    // La segmentation passe AVANT la validation : un nom qu'elle sait lire ne doit pas être
    // refusé pour n'avoir pas été déclaré.
    { const { terminaux, paquets } = terminauxEnPortee(ast); segmenterLesTerminaux(ast, terminaux, paquets); }
    result.errors.push(...validateTerminals(ast)); // fail-loud : terminal de règle absent des alphabets en portée → erreur
    poserLaVoixDesTerminaux(ast);
    result.errors.push(...validateControls(ast, libCtx.controls, libCtx.controlsQualified || {}));
    result.errors.push(...validateModulation(ast, libCtx));
    result.errors.push(...refuserAttenteNonDeclaree(ast));  // un point d'attente nomme ce qu'il attend

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
    // Un caractère illisible est une erreur de COMPILATION, pas un plantage. Elle arrivait ici en
    // `Error` nue et repartait par le `throw` ci-dessous : l'appelant qui attend `{ast, errors}`
    // recevait une exception. Mesuré le 2026-07-28 sur une faute de frappe d'UN caractère.
    else if (e instanceof LexError) result.errors.push({ message: e.message, line: e.line });
    else throw e;
  }
  return result;
}

export default compileToBPxAST;
