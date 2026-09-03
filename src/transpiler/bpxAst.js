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
import { resoudre, noterLePassage, emitSceneMeter, refuserEsclaveSansMaitre, poserLaVoixDesTerminaux, retirerArdoiseAlphabet, applyDefaultActor, hasTempoDirective, applyEnvironmentDefaults, canonicalizeLhsContext, canonicalizeLhsElement, canonicalizeRhsElement, canonicalizeContexts, ctxSymbolToElement, enrichRemoteHeadContext, canalFautif, nomsDeclares, validateCallVocabulary, terminauxEnPortee, validateTerminals, restesDeSegmentation, emitSceneLibRefs, deriveAlphabetFromTuning, emitActorLibRefs, emitNoteTerminals, resolveHomomorphismMarkers, annotateBackticks, poserLeDestinataireDesReglages, refuserAttenteNonDeclaree, refuserNomsEnDouble, applySceneValues, validateReferences, splitCompoundTerminals, chargerPorteesPermises, singleCharAlphabetSet, splitLhsElement, splitRhsElement, tokenizeCompoundName, makeSplitAtom } from './resolution.js';
import { loadLibsFromDirectives, loadLib, resolveActorAlphabet, resolveActorAlphabetSource, universeControlNames, nomsDeTerminaux, groupeDUnicite, brancherLeCompilateur } from './libs.js';
import { describeVocabulary } from './vocabulaire.js';
import { LIBS } from './libs-data.js';
import { segmenter } from './segmentation.js';

import { resolveActors, expandAlphabetTerminals, alphabetHerite, octavesHerite, tuningHerite,
         sortieHeritee, evalHerite, defaultActorTransport } from './actorResolver.js';
import { validateControls } from './controlValidation.js';
import { joindreLesLibrairies } from './librairies-jointes.js';

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
/** Vrai si la scène déclare déjà un tempo. Un seul nom depuis le 2026-08-10 : `tempo`. */
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
//   P3. Lecteur de tête côté BPScript : annotateBackticks (lhsHead, ci-
//       dessous) identifie la règle par lhs[0].name → un atome nié préfixé
//       masque l'acteur (interp 'strudel'→'auto'). → lui apprendre à sauter
//       les atomes niés de tête AVANT le flip.
//       (Ce point nommait AUSSI le validateur de modulation, élagué le
//       2026-08-22 avec le sujet `cv` — un seul lecteur reste concerné.)
//   P4. Kanopi bpx-adapter.ts:550 (table de backticks par lhs[0].name) : même
//       correction que P3, côté hôte.
// ============================================================================


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
/** Fabrique un atome découpé. line/actor sur CHAQUE atome ; negated/payload
 * sur le PREMIER seul (le `#`/la charge portent sur le token écrit entier,
 * BP3 les applique au premier terminal apparié — Encode.c:906/992). Miroir
 * exact de makeSplitSymbol (loadGrammar.ts:2425-2448). */
/** Découpe un élément de LHS (seuls les Symbol nus sont candidats).
 * terminal/variable → Symbol ; NOMBRE en LHS = non représentable dans
 * LhsElementAST et non prouvé au natif → nom INTACT (soumis à validation
 * bp3-engine, cas exotique `ab4 -> …`). */
/** Découpe un élément de RHS (Symbol nu ; récursion voix polymétriques et
 * groupes de gabarit — mêmes nœuds que le splitter vivant). terminal/variable
 * → Symbol ; nombre → NumericDuration (forme du parser pour un INT nu). */
/** Découpe les terminaux composés de toutes les règles (muté en place). */
/** Élément typé d'un contexte remote (miroir de la branche multi d'injectParserContext). */
/** Canonicalise un élément de LHS (seuls les Context parser sont touchés). */
/** Canonicalise un élément de RHS (récursif dans les voix polymétriques). */
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
// FAIL-LOUD terminaux (bug 1.1 couche 2, Romain 2026-07-05) : le vocabulaire UTILISÉ (les
// terminaux des règles) doit être DÉCLARÉ par un alphabet en portée. Un terminal-note qui
// n'appartient à aucun alphabet effectif (ex. `C4` dans une scène `alphabet.sargam`), et qui
// n'est ni un non-terminal, ni un symbole déclaré, ni du code → CRIE à la compilation.
// Union des alphabets effectifs = SÛRE (pas de faux positif cross-acteur).
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

/**
 * ⛔ LE REFUS DU SECOND ALPHABET DE SCÈNE EST SORTI — arbitrage de Romain, 2026-08-23 :
 * « un axe redéclaré se redéfinit : le dernier écrit gagne, Y COMPRIS `alphabet`. LE REFUS et le
 * premier-qui-tient sortent tous les deux. »
 *
 * ⚠️ ET SON JUMEAU D'ACTEUR EST SORTI DANS LE MÊME COMMIT, mais celui-ci a failli rester : ma frappe
 * ne visait que la clé d'acteur, et le refus de SCÈNE vivait ici, dans un autre fichier, sous un
 * autre nom. C'est le TÉMOIN POSITIF de Kanopi qui l'a montré — elle compilait une scène à deux
 * alphabets pour prouver que sa sonde savait voir le cas, et la scène a été refusée. Sans ce témoin,
 * je poussais un geste à moitié fait : le doublon autorisé chez l'acteur, refusé chez la scène.
 *
 * ⚠️ LE MOTIF, POUR LA PROCHAINE FOIS : « le même fait vivait à deux places, une seule était gardée »
 * était écrit dans le refus que je retirais. Je l'ai lu en le supprimant sans voir qu'il décrivait
 * l'endroit où l'autre moitié m'attendait.
 */

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
 * ⛔ L'ÉTAGE DE RÉSOLUTION — ANALYSER puis RÉSOUDRE, sans rendre de verdict.
 *
 * Tous les langages ont trois étages : analyser, résoudre, vérifier. Les trois existaient ici et
 * tournaient à chaque compilation ; rien ne permettait de s'ARRÊTER au second. Cette fonction est
 * cet arrêt — elle n'ajoute aucun calcul, elle rend atteignable ce qui se faisait déjà.
 *
 * CE QU'ELLE REND, ET C'EST TOUTE LA DIFFÉRENCE AVEC LA PORTE :
 *   · la source NE PARSE PAS  → `ast: null`. Il n'y a pas d'arbre, personne ne peut rien en tirer.
 *   · la résolution REFUSE    → `ast` PRÉSENT, `errors` peuplé. Le refus de SENS est une INFORMATION
 *     SUR l'arbre, pas sa disparition.
 *
 * ⛔ POURQUOI CE SECOND CAS EXISTE. Un outil de migration, un formateur, un outil de renommage
 * travaillent sur du code que le compilateur refuse — c'est leur raison d'être. Le nôtre répare les
 * collisions définition/terminal, refusées depuis ac6fe6a : son entrée est PAR DÉFINITION une source
 * rejetée. Mesuré le 2026-08-20 : la même source rend une erreur par la porte et un arbre de seize
 * clés par le parseur — deux questions, deux réponses justes.
 *
 * ⚠️ ET IL NE SUFFIT PAS DE PARSER. Basculer l'outil sur `parse(tokenize(…))` seul fait tomber un
 * volet sur quatre : la détection de collisions a besoin d'annotations que la résolution POSE SUR
 * l'arbre — terminaux d'alphabet étendus, acteur attribué. La résolution ne s'applique pas À CÔTÉ du
 * parse, elle s'applique DESSUS. C'est ce qui fait de ceci un étage et non un chemin de service.
 */
export function resoudreSource(source, environnement) {
  const result = { ast: null, errors: [], warnings: [] };
  try {
    const ast = parse(tokenize(source), { onWarning: (w) => result.warnings.push(w),
      // La SOURCE accompagne les jetons : une entrée de catalogue de gabarits se transporte
      // VERBATIM (AST_SPEC §1.9), et aucun jeton ne peut rendre les espaces d'origine.
      source });
    // ⛔ L'ÉTAGE QUI RÉSOUT, EN TÊTE DE CE QUI SUIT — décision de Romain, 2026-08-24. Ce qui vient
    // après lui dans cette fonction résout aussi, aujourd'hui : c'est justement le défaut que son
    // domicile existe pour absorber, passe par passe. Il est ici pour que ce qui descend d'un étage
    // ait où descendre, et il est TRAVERSÉ avant de porter la moindre décision — le branchement se
    // prouve avant l'effet.
    {
      const passe = resoudre(ast, environnement);
      result.errors.push(...passe.diagnostics);
      noterLePassage(passe.examines);
    }
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
    result.errors.push(...refuserAttenteNonDeclaree(ast));  // un point d'attente nomme ce qu'il attend
    result.errors.push(...refuserEsclaveSansMaitre(ast));   // un rejeu de gabarit a un maître à rejouer

    // ⛔ LE DÉDOUBLONNAGE DES DIAGNOSTICS EST ÉLAGUÉ — il n'avait plus de producteur vivant.
    //
    // Il retirait le message générique « attribut inconnu » pour une clé portant déjà un diagnostic
    // nommé (arbitrage architecte, 2026-08-22). Mesuré le 2026-08-24 sur le corpus entier, par la
    // porte `corpus.mjs` : **89 scènes, 12 messages, ZÉRO générique — et le débrancher ne changeait
    // AUCUN message.** Les diagnostics nommés lèvent depuis le PARSEUR, donc le générique de cet
    // étage ne s'exécute jamais sur la même clé.
    //
    // ⇒ **Le code mort s'élague dans le mouvement qui le rend mort.** Je l'avais inscrit au backlog
    // au lieu de le retirer ; l'architecte a tranché le même soir, et il a raison : une protection
    // sans producteur reste VERTE POUR TOUJOURS, et le jour où un producteur revient, personne ne
    // sait si elle mord encore. L'inscrire ne change pas ça — un backlog n'est pas exécuté.
    //
    // ⚠️ CE QUI LE RAMÈNERAIT : un diagnostic nommé posé à CET étage plutôt qu'au parseur. Il
    // doublerait alors le générique, et c'est visible — deux messages pour une faute.

    // Découpeur frontal mono-char (flip Palier 4, étape A) — EN DERNIER :
    // annotateBackticks et les validateurs ci-dessus voient l'AST NON découpé,
    // exactement comme quand la découpe vivait en aval dans BPx.
    splitCompoundTerminals(ast, libCtx);
    retirerArdoiseAlphabet(ast);  // EN DERNIER : l'adresse remplace l'ardoise pour l'aval, jamais pour le pipeline interne
    // L'ARBRE JOINT LE CONTENU DES LIBRAIRIES QU'IL INVOQUE — décision de Romain, 2026-09-02. Après
    // tout ce qui pose une référence (liaisons d'acteur, défauts, adresses) : la section lit l'arbre
    // FINAL, et elle est la dernière chose qui s'y ajoute.
    result.errors.push(...joindreLesLibrairies(ast));
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

/**
 * LA PORTE — le VERDICT par-dessus l'étage de résolution.
 *
 * ⛔ UN COMPILATEUR QUI REFUSE NE LIVRE RIEN EN AVAL (décision Romain 2026-08-19). Ce qui établit le
 * succès est l'ABSENCE D'ERREUR, jamais la présence d'un arbre. Rust n'émet aucun binaire quand il
 * échoue, GCC aucun objet ; TypeScript peut émettre malgré les erreurs, c'est une OPTION, et celle
 * qu'on recommande est de ne pas le faire.
 *
 * ⚠️ CE QUE ÇA CORRIGE, ET C'ÉTAIT MUET. Un refus de SENS laissait sortir un arbre COMPLET et
 * plausible à côté des erreurs. BPx l'a mesuré sur les 51 clés de la structure : AUCUNE n'évoque un
 * état de compilation, donc rien ne distinguait l'arbre d'un refus de celui d'un succès. Trois de
 * ses refus ont dérivé sans un mot, sortie identique au témoin.
 *
 * ⛔ ET ÇA AVEUGLAIT MES PROPRES GARDES AVANT CEUX DES AUTRES : quatre de mes bancs affirmaient des
 * choses sur des scènes que ce compilateur refuse, verts depuis toujours. L'un d'eux était invalidé
 * par un cri posé le matin même, et le portillon est resté vert toute la journée.
 *
 * QUI A BESOIN DE L'ARBRE D'UN REFUS passe par `resoudreSource` — c'est l'étage, il est juste
 * au-dessus, et il ne refait aucun calcul.
 */
export function compileToBPxAST(source, environnement) {
  const result = resoudreSource(source, environnement);
  if (result.errors.length) result.ast = null;
  return result;
}


export default compileToBPxAST;

// ⛔ LE COMPILATEUR SE BRANCHE SUR SON CHARGEUR ICI, À SA DÉFINITION — et nulle part ailleurs. Le
// chargeur lit les librairies dans leurs sources PAR le compilateur (2026-09-02) ; l'importer depuis
// le chargeur fermerait un cycle. Quiconque entre par une porte qui porte cette fonction — `index`,
// `bpxAst` — trouve le registre prêt à se construire ; entrer par le parseur seul n'est pas un chemin.
brancherLeCompilateur(compileToBPxAST);
