// AUTORITÉ résolution acteur / pitch / contrôles : LIRE src/transpiler/_AUTORITE.md avant de modifier.
/**
 * BPScript Parser
 * Source: BPSCRIPT_EBNF.md (Couches 1-4) + BPSCRIPT_AST.md
 *
 * Converts token array into AST (Scene node).
 * Recursive descent parser.
 */

import { T } from './tokenizer.js';
import { loadLib, loadLibsFromDirectives, describeVocabulary, universeControlNames, universeIntervalControls, universeCompositeControls, universeComponentControls, universeRuleScopeControls, universeSacs } from './libs.js';
import { BP3_OPERATORS, PRODUCTION_DIRECTIVES } from './constants.js';

class ParseError extends Error {
  constructor(msg, token) {
    super(`${msg} at line ${token.line}:${token.col}`);
    this.token = token;
  }
}

/**
 * Schéma des CLÉS D'ADRESSE de sortie (KAI-9 / GAP#2, décision 2026-06-26).
 * Une clé d'override qui désigne OÙ va l'événement (canal/device/port) — par opposition
 * à un contrôle d'expression (vel/pan/wave…). Sépare `payload.address` de `payload.params`
 * (cf. splitAddress). `ch` et `channel` sont synonymes (forme courte/longue). Aligné sur les
 * params de `out.<type>(…)` côté acteur (canal/device/port).
 */
/**
 * Clés d'ADRESSE de sortie — lues dans la DONNÉE (`lib/core.json` schema.addressKeys).
 * ⚠️ Elles étaient codées en dur ICI en plus d'y être déclarées : deux exemplaires identiques,
 * donc un double qui n'attendait qu'une divergence. Retiré le 2026-08-06, dans le même geste que
 * les axes de catalogue, qui avaient déjà payé ce défaut le jour même.
 */
let _addressKeys = null;
function addressKeys() {
  if (_addressKeys) return _addressKeys;
  const core = loadLib('core') || {};
  const keys = core?.schema?.addressKeys;
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error("lib/core.json schema.addressKeys est vide ou absent — le parseur n'a plus de clés d'adresse");
  }
  _addressKeys = new Set(keys);
  return _addressKeys;
}

/**
 * CONVENTION — les quatre lectures d'un flux de nombres qu'un `@var` typé peut nommer
 * (EBNF.md:55 : `CONVENTION = "signal" | "pitch" | "phase" | "logic"`). Partagée par `@var` et
 * `@def` (`def_directive`, EBNF.md:66), qui portent les mêmes quatre mots.
 */
const VAR_CONVENTIONS = new Set(['signal', 'pitch', 'phase', 'logic']);

/**
 * Clés d'ENTITÉ (composants) admises sur la ligne d'acteur (décision cles-acteur-six,
 * Romain 2026-06-16). Toutes se NOMMENT avec `.` (`.` APPELLE le composant) — jamais `:`
 * (le `:` AFFECTE une valeur). Le CUTOVER graphie (Romain 2026-07-14) rejette la forme `:`
 * pour chacune. `sounds` = alias v0.7 de `sound` (rejeté avec renvoi vers `sound.`).
 * `voice` = 7e clé (LANG-SONS-2, GO Romain [438] 2026-07-16, spec hub/projets/2026-06-24-lang-sons-spec/README.md
 * §3) : la voix de l'acteur, entrée de lib/voices. NB : la spec §7 (2026-06-24, « illustratif —
 * syntaxe à raffiner » §8) écrivait `voice:wobble` — graphie ANTÉRIEURE au cutover ; le canon
 * postérieur s'applique : `voice.wobble`.
 * `out` = la DIRECTION de sortie (décision Romain 2026-08-04, remplace `transport` — le mot
 * `transport` est SORTI du langage, cf. `channelCatalog`/tombstone plus bas). Le champ interne
 * (`properties.transport`, `TransportRef`, `references[transport]`) NE CHANGE PAS de nom : seul
 * le mot que l'auteur ÉCRIT change.
 */
const ACTOR_ENTITY_KEYS = new Set(['alphabet', 'tuning', 'octaves', 'out', 'sound', 'sounds', 'eval', 'voice']);

/**
 * Axes à CATALOGUE au niveau SCÈNE (directive `@axe.<nom>`) : leur opérande est un NOM D'ENTRÉE
 * de catalogue (une lib par axe) — donc un COMPOSANT, nommé avec `.`. DOIT rester le miroir de
 * `lib/core.json` schema.catalogAxes (garde anti-dérive : test/test_catalog_axes_colon_reject.js
 * itère describeVocabulary().components et prouve que CHACUN rejette le `:`). Le CUTOVER universel
 * (Romain 2026-07-14, tour [412]) rejette `@axe:<X>` pour chacun — plus jamais d'axe-composant qui
 * tolère l'ancienne forme.
 */
/**
 * Axes dont les valeurs sont des ENTRÉES DE CATALOGUE — lus dans la DONNÉE, jamais listés ici.
 *
 * ⚠️ CETTE LISTE ÉTAIT CODÉE EN DUR, EN DOUBLE DE `lib/core.json` schema.catalogAxes. Le schéma
 * structurel est une donnée depuis le 2026-07-05 (Romain) précisément pour qu'un axe déclaré une
 * fois vaille partout. Le double a fait exactement ce qu'un double fait : le 2026-08-06, `eval`
 * a été ajouté à la donnée et n'a rien changé — le parseur lisait toujours ses cinq noms.
 * ⚠️ Et le défaut était MUET : la déclaration semblait posée, la garde ne mordait pas, et j'ai
 * conclu « configuration sans effet » sur une mesure qui ne mesurait pas ce que je croyais.
 */
let _catalogAxisKeys = null;
function catalogAxisKeys() {
  if (_catalogAxisKeys) return _catalogAxisKeys;
  const core = loadLib('core') || {};
  const axes = core?.schema?.catalogAxes;
  if (!Array.isArray(axes) || axes.length === 0) {
    throw new Error("lib/core.json schema.catalogAxes est vide ou absent — le parseur n'a plus d'axes de catalogue");
  }
  _catalogAxisKeys = new Set(axes);
  return _catalogAxisKeys;
}

/**
 * Noms de canal de sortie PÉRIMÉS → rejetés fail-loud au parse (décision 2026-07-16, Romain :
 * on supprime, pas de rétrocompat ni normalisation). Source unique = `lib/core.json`
 * schema.deprecatedTransports (le schéma structurel est une DONNÉE, pas un hardcode — _schema_doc,
 * Romain 2026-07-05). Mémoïsé. `browser`/`webaudio` = ancien modèle profils d'environnement
 * (routing.json, supprimé) ; le canal canonique {audio, midi, osc} s'écrit directement.
 */
let _deprecatedTransports = null;
function deprecatedTransports() {
  if (_deprecatedTransports) return _deprecatedTransports;
  const core = loadLib('core') || {};
  _deprecatedTransports = new Set((core.schema && core.schema.deprecatedTransports) || []);
  return _deprecatedTransports;
}

/**
 * UN SEUL CATALOGUE des canaux, chacun portant les DIRECTIONS qu'il autorise (décision Romain
 * 2026-08-04, hub/decisions/2026-08-04-la-direction-s-ecrit-in-et-out-remplacent-transport.md).
 * Remplace les deux listes distinctes `transportChannels`/`inputTransportChannels` qui coexistaient
 * sous le même mot `transport` selon l'endroit où on l'écrivait. Source unique = `lib/core.json`
 * schema.channels (donnée, pas un hardcode). Mémoïsé.
 */
let _channelCatalog = null;
function channelCatalog() {
  if (_channelCatalog) return _channelCatalog;
  const core = loadLib('core') || {};
  _channelCatalog = (core.schema && core.schema.channels) || {};
  return _channelCatalog;
}

/**
 * LISTE POSITIVE FERMÉE des canaux de SORTIE (`out.<canal>` sur un @actor, ou le raccord
 * `@alphabet.X:<sortie>` de l'acteur implicite). Addendum ratifié Romain 2026-07-16 (« on
 * n'autorise que ceux qu'on connaît ») : suffixe ∉ schema.channels{out:true} → rejet fail-loud.
 * `dmx` y est entré le 2026-08-04 (catalogue unique `lib/core.json`, légitime même sans runtime
 * dmx encore écrit). `text` y est PRÉSENT (il porte `out:true`, routé comme les autres sorties) —
 * son refus à l'écriture est une question SÉPARÉE, portée par `writableChannels` (DIRECTION ≠
 * ÉCRITURE, voir plus bas). Dérivée du catalogue unifié, jamais recopiée en dur ici.
 */
let _outChannels = null;
function outChannels() {
  if (_outChannels) return _outChannels;
  const cat = channelCatalog();
  _outChannels = new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].out));
  return _outChannels;
}

/**
 * LISTE POSITIVE FERMÉE des canaux d'ENTRÉE (`@var <rôle> in.<canal>`) — DISTINCTE de celle des
 * sorties, et c'est délibéré. La décision Romain du 2026-07-26 nomme TROIS périphériques
 * d'entrée — MIDI, OSC, CLAVIER. Le clavier entre donc ici et NULLE PART ailleurs :
 * `@alphabet.X:keyboard` reste refusé, une sortie clavier n'a pas de sens. Préservée à
 * l'identique de l'ancienne `inputTransportChannels`, dérivée du catalogue unifié.
 */
let _inChannels = null;
function inChannels() {
  if (_inChannels) return _inChannels;
  const cat = channelCatalog();
  _inChannels = new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].in));
  return _inChannels;
}

/**
 * DIRECTION ≠ ÉCRITURE (correction Romain 2026-08-04). `outChannels`/`inChannels` disent OÙ VA
 * le signal ; `writableChannels` dit si un AUTEUR peut TAPER ce canal dans une scène AUJOURD'HUI.
 * `text` est le premier cas des deux : il EST routé en sortie (`out:true`, comme les autres
 * destinations de l'architecture) mais son point d'écriture — son appareil dédié — n'existe pas
 * encore. Avant ce champ, le refus de 'out.text' répondait « text n'est pas une sortie » — FAUX,
 * text EST une sortie, seule son écriture attend son appareil. `writable` est déclaré EXPLICITEMENT
 * sur les SIX canaux de `lib/core.json` (jamais déduit d'une absence, cf. `_writable_doc`) : la
 * forme se reproduira, un canal peut exister dans l'architecture avant d'avoir sa graphie.
 */
let _writableChannels = null;
function writableChannels() {
  if (_writableChannels) return _writableChannels;
  const cat = channelCatalog();
  _writableChannels = new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].writable));
  return _writableChannels;
}

/**
 * Index des VOIX (lib/voices.json, LANG-SONS-2 [438], spec hub/projets/2026-06-24-lang-sons-spec/README.md §3-§5).
 * Une clé `nom for:<device>` = spécialisation par-device (cascade fin > général, résolue en
 * AVAL) ; ici on indexe par nom de base : { nom → { base?: def, forDevices: { device → def } } }.
 * Validation de FORME à l'indexation : une réalisation `audio` DOIT être un backtick TYPÉ
 * (`js:…`/`faust:…` — spec §3 : compilé par le runtime comme la CV expr). Donnée non conforme
 * = signalée quand la voix est référencée (fail-loud, jamais de son muet inventé).
 */
let _voicesIndex = null;
function voicesIndex() {
  if (_voicesIndex) return _voicesIndex;
  _voicesIndex = new Map();
  const lib = loadLib('voices');
  for (const [key, def] of Object.entries((lib && lib.objects) || {})) {
    const m = key.match(/^(\S+)\s+for:(\S+)$/);
    const name = m ? m[1] : key;
    const entry = _voicesIndex.get(name) || { base: null, forDevices: {} };
    if (m) entry.forDevices[m[2]] = def; else entry.base = def;
    _voicesIndex.set(name, entry);
  }
  return _voicesIndex;
}

/** Backtick TYPÉ : `js: …`, `faust: …` — le type nomme l'interpréteur (spec §3). */
function isTypedBacktick(v) {
  return typeof v === 'string' && /^`\s*[A-Za-z_][\w-]*\s*:/.test(v);
}

/**
 * Valide une référence de voix (`voice.<nom>` d'acteur, ou binding alphabet→voix) :
 * la voix existe (base ou spécialisation for:) et chaque réalisation `audio` portée
 * par ses définitions est un backtick typé. Jette ParseError sinon (fail-loud).
 */
function assertVoiceRef(name, where, token) {
  const entry = voicesIndex().get(name);
  if (!entry) {
    throw new ParseError(
      `${where} : voix '${name}' inconnue — aucune entrée '${name}' (ni '${name} for:<device>') `
      + `dans lib/voices.json (LANG-SONS §3).`, token,
    );
  }
  const defs = [...(entry.base ? [entry.base] : []), ...Object.values(entry.forDevices)];
  for (const def of defs) {
    if (def.audio !== undefined && !isTypedBacktick(def.audio)) {
      throw new ParseError(
        `${where} : voix '${name}' — réalisation 'audio' invalide dans lib/voices.json : un `
        + `backtick TYPÉ est requis (\`js: …\`, \`faust: …\`) ; reçu ${JSON.stringify(def.audio)}.`, token,
      );
    }
  }
}

/**
 * Valide le binding alphabet→voix (spec §7 : champ `voices` d'un alphabet = terminal → nom
 * de voix). Chaque nom doit exister dans lib/voices ; chaque terminal mappé doit être une
 * note de l'alphabet. Carte PARTIELLE admise (un terminal sans voix = résolution aval).
 * Mémoïsé par alphabet (une lib invalide casse au premier usage — donnée curée, fail-loud).
 */
const _alphabetVoicesChecked = new Set();
function assertAlphabetVoices(alphabetName, token) {
  if (_alphabetVoicesChecked.has(alphabetName)) return;
  const alpha = loadLib('alphabet', alphabetName);
  if (alpha && alpha.voices) {
    for (const [terminal, voiceName] of Object.entries(alpha.voices)) {
      if (Array.isArray(alpha.notes) && !alpha.notes.includes(terminal)) {
        throw new ParseError(
          `alphabet '${alphabetName}' : le binding de voix mappe '${terminal}' qui n'est pas `
          + `une note de cet alphabet (lib/alphabets.json).`, token,
        );
      }
      assertVoiceRef(voiceName, `alphabet '${alphabetName}', binding '${terminal}'`, token);
    }
  }
  _alphabetVoicesChecked.add(alphabetName);
}

/**
 * Normalise le nom d'un Symbol : si le nom est une clé de BP3_OPERATORS
 * (star→'*', plus→'+', fin→';'), retourne l'opérateur canonique BP3.
 * Cela garantit que l'AST reflète ce que BP3 aurait compilé (R1).
 * La déclaration `@gate star:midi` reste valide — seul le NOM porté par
 * les Symbol nodes de règle est normalisé ici.
 */
function normalizeName(name) {
  return name in BP3_OPERATORS ? BP3_OPERATORS[name] : name;
}

function parse(tokens, opts = {}) {
  let pos = 0;
  let libCtx = { controlNames: new Set(), noArgControls: new Set(), controlMap: {}, symbols: {} };

  // Noms que LA SCÈNE déclare elle-même. Rempli à la lecture des directives, donc connu avant la
  // première règle (l'en-tête précède toujours les règles). Sert à trancher un homonyme entre un
  // mot du vocabulaire et une déclaration locale — cf. `estDeclareLocalement`.
  const nomsDeclaresLocalement = new Set();

  // VARIABLES DE TRAVAIL déclarées par `@var`. Sous-ensemble du précédent, tenu à part parce
  // qu'elles font plus que gagner sur un homonyme : elles portent leur PROPRE NATURE dans l'arbre.
  const nomsVariables = new Set();
  // Les noms de MACRO dont le corps est un CÂBLAGE. Rempli à la déclaration, lu au moment où la
  // nature d'un symbole de flux se décide — les déclarations précèdent les règles (fail-loud du
  // 2026-07-29), donc l'information est là quand on en a besoin, sans passe supplémentaire.
  const nomsCablage = new Set();

  // Avertissements non fatals (ex. dépréciation des @-formes de production).
  // Canal séparé des erreurs : remonté via opts.onWarning (compileBPS →
  // result.warnings), jamais dans l'AST (contrat BPx : AST inchangé).
  function warn(message, line) {
    if (opts.onWarning) opts.onWarning({ message, line });
  }

  function current() { return tokens[pos] || { type: T.EOF, value: null, line: 0, col: 0 }; }
  function peek(offset = 0) { return tokens[pos + offset] || { type: T.EOF }; }
  function advance() { return tokens[pos++]; }
  function expect(type) {
    const tok = current();
    if (tok.type !== type) throw new ParseError(`Expected ${type}, got ${tok.type} (${tok.value})`, tok);
    return advance();
  }
  function at(type) { return current().type === type; }
  function atAny(...types) { return types.includes(current().type); }
  function skipNewlines() { while (at(T.NEWLINE) || at(T.COMMENT)) advance(); }
  function atEnd() { return at(T.EOF); }

  // ============================================================
  // Homomorphisms helper
  // ============================================================

  /**
   * Build scene.homomorphisms (HomomorphismDeclAST[]) from loaded transcription tables.
   *
   * Contract (BPx ast.ts:150-157):
   *   { type:'Homomorphism', name:string, pairs:[string,string][], line?:number }
   *
   * Formats:
   *   - 'sections': one decl per section, name = section key ('*', 'm1', 'TR'…)
   *   - 'mappings': one decl, name = the subkey used to invoke it (@transcription.<subkey>)
   *
   * Identity pairs (a→a) are KEPT (Bernard fidelity).
   * Chain pairs (a→b→c) are already expanded to [a,b],[b,c] in the JSON.
   *
   * @param {Object} transcriptions  - libCtx.transcriptions: { subkey → lib }
   * @param {Array}  directives      - scene.directives (to recover line numbers)
   */
  // Déplie une déclaration `chains` en PAIRES PLATES last-write-wins (mécanisme natif réel).
  // `{C3:[B3,F4,C6], B3:[C3,B4,F6]}` → séquences [C3,B3,F4,C6],[B3,C3,B4,F6] → paires
  // consécutives fusionnées, dernière écriture gagne (C3→B3 puis C3→B4 = B4). Cf. buildHomomorphisms.
  function unfoldChains(chains) {
    const flat = {};
    for (const [key, imgs] of Object.entries(chains)) {
      const seq = [key, ...imgs];
      for (let i = 0; i < seq.length - 1; i++) flat[seq[i]] = seq[i + 1];
    }
    return Object.entries(flat);
  }

  function buildHomomorphisms(transcriptions, directives) {
    const result = [];
    if (!transcriptions || Object.keys(transcriptions).length === 0) return result;

    // Build a map from subkey → directive line number
    const lineMap = {};
    for (const dir of (directives || [])) {
      if (dir.name === 'transcription' && dir.subkey) {
        lineMap[dir.subkey] = dir.line;
      }
    }

    for (const [subkey, table] of Object.entries(transcriptions)) {
      const line = lineMap[subkey];

      if (table.sections) {
        // Multi-section format: one decl per named section
        for (const [secName, body] of Object.entries(table.sections)) {
          if (body && body.chains) {
            // `chains` = SUCRE de saisie pour déclarer des paires en CHAÎNE (`note --> a --> b`).
            // Le mécanisme réel (infirmation depth-indexed, oracle natif 2026-07-17 ; BPx
            // loadGrammar.ts:6368-6396 ; concession bpscript après contre-preuve kairos [493]) :
            // déplier chaque chaîne en PAIRES CONSÉCUTIVES, TOUTES fusionnées, DERNIÈRE ÉCRITURE
            // GAGNE, puis appliquées par Image() (une par portée empilée). On émet donc des
            // PAIRS PLATES last-write-wins — PORTER≠RÉSOUDRE : le consommateur (Kairos) ne déplie
            // rien, il query image(name,sym) 2-arg. `chains se compile en pairs, point`.
            result.push({ type: 'Homomorphism', name: secName, pairs: unfoldChains(body.chains), line });
          } else {
            const pairs = Object.entries(body); // already [from, to]
            result.push({ type: 'Homomorphism', name: secName, pairs, line });
          }
        }
      } else if (table.mappings) {
        // Single-section format: name = the invocation key (subkey)
        const pairs = Object.entries(table.mappings);
        result.push({ type: 'Homomorphism', name: subkey, pairs, line });
      }
    }

    return result;
  }

  // ============================================================
  // Couche 1 — Scene
  // ============================================================

  function parseScene() {
    const scene = {
      type: 'Scene',
      directives: [],
      actors: [],
      scenes: [],
      exposes: [],
      // VARIABLES DE TRAVAIL déclarées par `@var` — noms de symboles qui ne sont l'écriture
      // d'aucune note (décision Romain 2026-07-27, voie 3).
      vars: [],
      // ENTRÉES déclarées par `@var <rôle> in.<canal>` (ex-`@in`, décision Romain 2026-08-04) —
      // un rôle, son canal, sa table éventuelle (décision Romain 2026-07-27, symétrie entrée/sortie).
      inputs: [],
      // `maps` SUPPRIMÉ le 2026-07-27 au soir, avec le mot : `@map` est abandonné, le câblage passe
      // par les chevrons. Un champ ÉMIS ET TOUJOURS VIDE n'est pas neutre — un consommateur qui le
      // lit conclut « cette scène ne câble rien » au lieu de « ce canal n'existe plus ». On
      // supprime la donnée avec le mot, dans le même mouvement, sans voie parallèle.
      aliases: [],
      // `labels` SUPPRIMÉ avec '@label' (2026-07-28) : un champ émis et toujours vide fait
      // conclure « cette scène n'étiquette rien » au lieu de « ce canal n'existe plus ».
      declarations: [],
      macros: [],
      backticks: [],
      cvInstances: [],
      subgrammars: [],
      // v0.8 — sons (prototypes anonymes + nommés) et affectations sujet→son
      soundPrototypes: null,
      soundAssignments: null,
      // Contrat BPx (ast.ts:150-157) : table d'homomorphismes attachée par le parser
      // après chargement des libs. Vide si aucune directive @transcription.
      homomorphisms: [],
    };

    skipNewlines();

    // Parse header: directives, declarations, macros, backticks
    let initialMode = null;
    let initialModifiers = null;
    while (!atEnd() && !at(T.SEPARATOR)) {
      skipNewlines();
      if (atEnd()) break;

      if (at(T.AT)) {
        const dir = parseDirective();
        if (dir.type === 'SceneDirective') {
          scene.scenes.push(dir);
        } else if (dir.type === 'ExposeDirective') {
          scene.exposes.push(dir);
        } else if (dir.type === 'InDirective') {
          scene.inputs = [...(scene.inputs || []), dir];
        } else if (dir.type === 'VarDirective') {
          // Les lignes s'ACCUMULENT — plusieurs `@var` ne se remplacent pas, elles s'ajoutent.
          // `scene.vars` porte la DIRECTIVE ENTIÈRE (AST.md:28, `vars: VarDirective[]`), pas ses
          // noms nus réduits en chaînes — sinon le type (`varType`) n'a nulle part où survivre
          // jusqu'à l'arbre (décision Romain, référence EBNF.md:47-57, 2026-08-05).
          scene.vars = [...(scene.vars || []), dir];
          // Une variable de travail est un nom que LA SCÈNE possède : elle gagne donc, comme une
          // macro, sur un mot homonyme du vocabulaire (cascade, le plus local l'emporte).
          for (const n of dir.names) { nomsDeclaresLocalement.add(n); nomsVariables.add(n); }
        } else if (dir.type === 'AliasDirective') {
          scene.aliases.push(dir);
          // Un alias est un nom que LA SCÈNE possède : il gagne sur un mot homonyme du vocabulaire
          // (cascade, le plus local l'emporte) — même règle que macros et variables de travail.
          nomsDeclaresLocalement.add(dir.name);
        } else if (dir.type === 'MacroDirective') {
          scene.macros.push(dir);
          nomsDeclaresLocalement.add(dir.name);
        } else if (dir.type === 'Declaration') {
          // @gate, @trigger, @cv — prefixed declarations
          scene.declarations.push(dir);
        } else if (dir.type === 'ActorDirective') {
          scene.actors.push(dir);
          // v0.8: soundAssignments collectées dans le bloc @actor sont remontées
          // top-level avec scope { kind:"actor", name:<actorName> }.
          if (dir.soundAssignments && dir.soundAssignments.length > 0) {
            scene.soundAssignments = scene.soundAssignments || [];
            for (const sa of dir.soundAssignments) scene.soundAssignments.push(sa);
          }
          // Frontière AST (Palier 3) : `soundAssignments` est un porteur TRANSITOIRE
          // (hoisté top-level ci-dessus) ; on le retire TOUJOURS de l'ActorDirective.
          // Canonique = `assignments?` OPTIONNEL, jamais `soundAssignments:null`.
          // décision PM : pas de duplication.
          delete dir.soundAssignments;
        } else if (dir.type === 'SoundSection') {
          // v0.8 — @sound { ... } / @sound bell { ... } / @sound.libname[:variant]
          scene.soundPrototypes = scene.soundPrototypes || [];
          for (const p of dir.prototypes) scene.soundPrototypes.push(p);
          // mémoriser la directive (utile pour lib externe ou variante)
          if (dir.lib) {
            scene.directives.push({
              type: 'Directive', name: 'sound', subkey: dir.lib,
              binding: dir.libVariant || null, runtime: null, value: null,
              aliases: null, modifiers: null, line: dir.line,
            });
          }
        } else if (dir.type === 'AlphabetSoundAssignments') {
          // v0.8 — affectations sujet→son collectées dans un @alphabet.X.
          // Le wrapper contient la Directive d'origine (à pousser comme d'hab)
          // et les affectations (à pousser top-level dans soundAssignments).
          scene.directives.push(dir.directive);
          scene.soundAssignments = scene.soundAssignments || [];
          for (const sa of dir.assignments) scene.soundAssignments.push(sa);
        } else if (dir.type === 'LibRef') {
          // Canal NEUTRE des invocations par provenance (@factory.*/@mine.*).
          // Adresse canonique opaque ; ordre source préservé ; dédup en fin de parseScene ;
          // champ OMIS si vide (jamais `[]`) — contrat bpscript-bpx.md §libRefs.
          (scene.libRefs || (scene.libRefs = [])).push(dir.address);
        } else if (dir.type === 'Wiring') {
          // `@wire saw >> lpf >> audio` — le CÂBLAGE INITIAL vit à la RACINE, pas dans
          // `directives` : demandé par BPx, qui a mesuré avant que j'écrive. Sans champ propre,
          // leur repli attrape-tout le collerait sur CHAQUE FEUILLE — le risque n'était pas la
          // casse mais le PLACEMENT SILENCIEUX. ABSENT ≠ VIDE, comme `libRefs`.
          (scene.wires || (scene.wires = [])).push(dir);
        } else if (dir.type === 'CVInstance') {
          // `@cv env1 mod.adsr(…)` — une DÉCLARATION qui crée un nom, pas une directive de
          // scène. Elle vit dans `cvInstances`, comme la forme nue le faisait avant sa
          // suppression : sans ce routage, le modulateur était parsé puis rangé parmi les
          // directives, donc invisible de tout ce qui le cherche — un objet déclaré que rien
          // ne peut invoquer. Même famille que la directive jetée après les règles, à un
          // aiguillage près.
          scene.cvInstances.push(dir);
        } else if (dir.type === 'Declaration') {
          scene.declarations.push(dir);   // `@gate Sa:midi` — propriété sur un nom existant
        } else if (dir.name === 'mode' && dir.runtime) {
          // @mode:X is a block directive, not a lib directive
          initialMode = dir.runtime;
          initialModifiers = dir.modifiers || null;
        } else {
          scene.directives.push(dir);
        }
      } else if (atProductionBlock()) {
        // [@seed:1, @items:20] — bloc de production (niveau scène), dans
        // l'ordre source (l'ordre des directives est sémantique : last wins).
        for (const d of parseProductionBlock()) scene.directives.push(d);
      } else if (atAny(T.GATE, T.TRIGGER, T.CV)) {
        // ─── PIERRE TOMBALE — L'AROBASE EST OBLIGATOIRE EN PARTIE DÉCLARATIVE ───────────────
        // Décision Romain, 2026-07-29. La forme NUE (`gate Sa:midi`, `cv env1 : …`) est
        // SUPPRIMÉE, pas dépréciée : ma grammaire l'annonçait comme « format legacy toujours
        // supporté », donc c'était de la rétrocompatibilité conservée, et elle tombe sous la
        // règle du 2026-07-19. Une partie déclarative se lit à l'œil quand toutes ses lignes
        // commencent par le même signe ; une exception par type le défait.
        // FRONTIÈRE MESURÉE AVANT LIVRAISON : 12 scènes sur 263, 27 occurrences.
        const nu = current();
        throw new ParseError(
          `'${nu.value}' sans arobase n'existe plus (décision Romain 2026-07-29) — la partie `
          + `déclarative s'écrit TOUJOURS avec l'arobase : '@${nu.value} …'. `
          + `Et depuis la même décision, le DEUX-POINTS tranche : '@${nu.value} <nom>:<cible>' pose `
          + `une PROPRIÉTÉ sur un nom qui existe, '@${nu.value} <nom> <valeur>' DÉCLARE un nom neuf.`,
          nu,
        );
        // (Le corps de l'ancienne voie a été SUPPRIMÉ ici, pas neutralisé : signalé par bpx, et
        // ils ont raison — un `else if (false)` avec le code derrière est littéralement la forme
        // que la règle anti-rétrocompat du 2026-07-19 veut voir disparaître dans le même
        // mouvement. La pierre tombale ci-dessus suffit.)
      } else if (at(T.BACKTICK)) {
        scene.backticks.push(parseBacktickOrphan());
      } else if (at(T.IDENT) && isLookaheadMacro()) {
        const m = parseMacro();
        scene.macros.push(m);
        if (m && m.name) nomsDeclaresLocalement.add(m.name);
      } else if (isRuleStart()) {
        break; // Start of rules
      } else {
        break;
      }
      skipNewlines();
    }

    // ALIAS @tempo → @mm (décision Romain 2026-07-05) : `tempo` est la surface préférée,
    // mais BPx LIT le directive `mm` (nœud tempo NATIF BPScript ; `_mm` est le nœud BP3 du
    // grammar, hors chemin BPScript). On normalise `tempo`→`mm` sur le DIRECTIVE top-level ET
    // le modifieur de mode `@mode:X(tempo:N)`, avant tout consommateur (libCtx, encodeur BP3,
    // AST BPx). Le bloc ENGINE `[tempx:N]` (relatif → `_tempo`, renommé tempo→tempx le
    // 2026-08-04, décision 2026-08-04-le-multiplicateur-de-vitesse-d-une-regle-s-appelle-tempx)
    // N'EST PAS un scene.directive : il n'est pas touché. Rétrocompat : @mm continue de
    // marcher (déprécié-doux).
    for (const d of scene.directives) {
      if (!d || d.type !== 'Directive') continue;
      if (d.name === 'tempo') d.name = 'mm';
      if (Array.isArray(d.modifiers)) for (const m of d.modifiers) if (m && m.name === 'tempo') m.name = 'mm';
    }

    // Load libraries based on @ directives — determines known controls
    libCtx = loadLibsFromDirectives(scene.directives);

    // Build scene.homomorphisms (contrat BPx ast.ts:150-157) from loaded
    // transcription tables. Called after loadLibsFromDirectives so that
    // libCtx.transcriptions is fully populated.
    scene.homomorphisms = buildHomomorphisms(libCtx.transcriptions, scene.directives);

    // Process actor directives — add to libCtx for dot notation lookup
    libCtx.actors = {};
    for (const actor of scene.actors) {
      libCtx.actors[actor.name] = actor.properties;
    }

    // Process scene directives — scene names become known terminals
    libCtx.sceneNames = new Set();
    for (const sc of scene.scenes) {
      libCtx.sceneNames.add(sc.name);
      libCtx.symbols[sc.name] = { type: 'scene' };
    }

    // Parse subgrammars
    scene.subgrammars = parseSubgrammars(initialMode, initialModifiers);

    // Parse optional @template section (SINGULIER — seule graphie acceptée).
    // ⚠️ La graphie plurielle `@templates` (v0.7) est REFUSÉE depuis le 2026-07-19. bpx a migré
    // ses scènes vers `@template` et retiré ses alias ; plus aucun consommateur ne l'écrit.
    // Un alias qui survit à ses derniers usagers est du poison différé, pas de la prudence.
    skipNewlines();
    scene.template = null;
    // ⚠️ PAS d'alias `scene.templates` : le champ canonique est `template` (SINGULIER),
    // normatif dans `AST.md:40`. L'alias pluriel a été SUPPRIMÉ le 2026-07-19 (arbitrage
    // Romain : le rétrocompat s'enlève, un seul nom). Scan aval fait par bpx AVANT le
    // retrait : aucun consommateur ne lisait `scene.templates` — ni Kanopi, ni Kairos, ni
    // les runtimes, ni bp3-frontend ; seul BPx avait un repli `ast.template ?? ast.templates`,
    // qu'il retire dans le même mouvement.
    if (at(T.AT) && peek(1).type === T.IDENT && peek(1).value === 'template') {
      const entries = parseTemplateSection();
      scene.template = entries;
    }

    // ── Post-pass : annotation payload (AST_SPEC v1 §2) ───────────────────────
    // Parcourt récursivement tous les éléments RHS et attache un `payload` à
    // chaque nœud annatable. Le payload est ADDITIF (l'encodeur BP3 ignore les
    // champs inconnus) et AGNOSTIQUE (zéro notion BP3 : pas de _script, flavor…).
    //
    // Règle de résolution d'acteur :
    //   1. Acteur explicite sur le nœud (dot-notation `sitar.Sa`).
    //   2. Acteur unique de la règle (quand la LHS est un symbole unique d'acteur).
    //   3. Omis (le dispatcher résout via la déclaration actors[]).
    //
    // Règle flux :
    //   - `InstantControl` → flux:true (toujours)
    //   - `Control` standalone de nature transport-control → flux:true
    //   - Override d'occurrence collé sur un Symbol (suffixQualifiers) → pas de flux
    annotateScene(scene);

    // libRefs (canal neutre provenance) : dédup en préservant l'ordre source (contrat §libRefs).
    // Le champ reste OMIS si aucune invocation par provenance (jamais `[]`).
    if (scene.libRefs) {
      const seen = new Set();
      scene.libRefs = scene.libRefs.filter((a) => (seen.has(a) ? false : (seen.add(a), true)));
    }

    return scene;
  }

  // ============================================================
  // Post-pass annotation payload (AST_SPEC v1 §2)
  // ============================================================

  /**
   * Annote récursivement toute la scène (entrée : après parseSubgrammars).
   * Modifie les nœuds en place (payload additif).
   */
  function annotateScene(scene) {
    // États de drapeau nommés (`@var section flag: calm:1, full:2` — ex-`@flag`, tombée le
    // 2026-08-05) résolus DANS L'AST : une garde `[scene==calm]` ou une mutation `[scene=calm]`
    // portant un alias DÉCLARÉ voit sa `value` résolue en ENTIER (calm → 1). Un IDENT NON déclaré
    // reste tel quel (référence à un autre drapeau, fidèle BP3). Indispensable à la voie AST
    // directe (BPx lit l'AST, pas la table) ; le texte BP3 reste identique (l'encodeur reçoit
    // alors un entier, no-op). Bug remonté par bpx (G2), directive « source unique = AST ».
    const flagStates = {};
    for (const v of scene.vars || []) {
      if (v?.varType?.kind === 'flag') {
        const mm = flagStates[v.names[0]] || {};
        for (const s of v.varType.states) mm[s.name] = s.value;
        flagStates[v.names[0]] = mm;
      }
    }
    const resolveFlag = (flag, value) =>
      (typeof value === 'string' && flagStates[flag]
        && Object.prototype.hasOwnProperty.call(flagStates[flag], value))
        ? flagStates[flag][value] : value;

    for (const sg of scene.subgrammars) {
      for (const rule of sg.rules) {
        // Gardes + mutations : résoudre les états de drapeau nommés DÉCLARÉS en entier.
        const guards = Array.isArray(rule.guard) ? rule.guard : (rule.guard ? [rule.guard] : []);
        for (const g of guards) {
          if (g && g.flag != null && 'value' in g) g.value = resolveFlag(g.flag, g.value);
        }
        for (const f of rule.flags || []) {
          if (f && f.flag != null && 'value' in f) f.value = resolveFlag(f.flag, f.value);
        }

        // Résolution de l'acteur de règle : quand tous les symboles LHS appartiennent
        // au même acteur (cas fréquent), on peut pré-remplir l'acteur.
        // En Phase 1 on passe null : l'acteur est résolu au niveau token (dot-notation).
        annotateRhsElements(rule.rhs, null);

        // Qualifier de NIVEAU RÈGLE `S -> … (vel:80)` : CONTENANCE (concept neuf BPScript,
        // décision Romain 2026-06-20). Un `(...)` nu est STRUCTUREL et CONFINÉ : il gouverne
        // toute sa portée (y compris les notes écrites avant lui) et s'arrête au bord — il ne
        // DÉBORDE pas. C'est l'inverse du flux `!(...)` (iso-BP3, forward, déborde). On le tague
        // `containment` (PAS `flux`) : BPx route contenance→structurel, flux→séquentiel.
        if (rule.settings && typeof rule.settings === 'object') {
          const { address, controls } = splitAddress(extractOccurrenceParams([rule.settings]));
          rule.settings.payload = {
            nature: 'transport-control',
            containment: true,
            scope: 'rule',
            ...(controls ? { params: controls } : {}),
            ...(address ? { address } : {}),
          };
        }
      }
    }
  }

  /**
   * Annote une liste plate d'éléments RHS (ou une voix polymétrique).
   * @param {Array} elements  - liste de nœuds RHS
   * @param {string|null} ruleActor - acteur déduit du contexte (null en Phase 1)
   */
  function annotateRhsElements(elements, ruleActor) {
    // Validation de l'ancrage conjoint PAR VOIX : un `!(...)` collé n'est CONJOINT que s'il
    // existe un terminal sonnant AVANT lui dans cette même séquence ; sinon il retombe en
    // événement séparé (non conjoint). On parcourt en suivant le dernier sonnant rencontré.
    let prevSounding = false;
    for (const el of elements) {
      if (el && el.type === 'InstantControl' && el.conjoint && !prevSounding) {
        el.conjoint = false;
      }
      annotateRhsNode(el, ruleActor);
      if (el && (el.type === 'Symbol' || el.type === 'SymbolCall' || el.type === 'OutTimeObject' ||
                 el.type === 'TieStart' || el.type === 'TieContinue' || el.type === 'TieEnd' ||
                 el.type === 'SimultaneousGroup' || el.type === 'Polymetric')) {
        prevSounding = true;
      }
    }
  }

  /**
   * Annote un nœud RHS individuel avec `payload`.
   * Rec dans Polymetric.voices.
   *
   * Nœuds qui reçoivent un payload.nature :
   *   Symbol, SymbolCall, OutTimeObject, TieStart, TieContinue, TieEnd → 'sounding'
   *   Rest, UndeterminedRest                                            → 'rest'
   *   Prolongation                                                      → 'prolongation'
   *   Control  → 'engine-control' (bp3NativeControls) ou 'transport-control'
   *   InstantControl                                                     → 'instant'
   *   Wait                                                          → 'wait'
   *
   * Nœuds sans payload.nature (structurels) :
   *   Period, NumericDuration, NilString, RawBrace, Polymetric,
   *   Wildcard, Variable, Homomorphism, gabarits…
   *   (on récurse dans Polymetric)
   */
  function annotateRhsNode(el, ruleActor) {
    if (!el || typeof el !== 'object') return;

    const type = el.type;

    // ── Nœuds sonnants ────────────────────────────────────────────────
    if (type === 'Symbol' || type === 'SymbolCall' ||
        type === 'OutTimeObject' ||
        type === 'TieStart' || type === 'TieContinue' || type === 'TieEnd') {

      // Acteur : dot-notation (el.actor) ou ruleActor
      const actor = el.actor || ruleActor || undefined;

      // Overrides d'occurrence collés sur la note. Deux origines, MÊME notion
      // (charge d'occurrence sur la note), repliées dans le MÊME payload.params
      // pour que l'aval (BPx) lise payload.params PARTOUT, uniforme :
      //   - suffixQualifiers : `dha(vel:80)` quand `vel` est un contrôle connu
      //     (la note reste Symbol + qualifieur collé) ;
      //   - args de SymbolCall : `dha(vel:80)` sans lib de contrôles chargée,
      //     OU dans un accord `C4!E4(vel:90)` (le secondaire est toujours un
      //     SymbolCall) — décision frontière R4 (architecte 2026-06-23).
      let params = extractOccurrenceParams(el.suffixQualifiers);
      const argParams = extractSymbolCallParams(el);
      if (argParams !== null) params = { ...(params || {}), ...argParams };

      // GAP#2 : la charge se range en DEUX tiroirs — `address` (canal/device/port, lu par
      // Kairos pour matérialiser event.output) et `params` (contrôles vel/pan/wave…).
      const { address, controls } = splitAddress(params);
      // ⚠️ UNE VARIABLE DE TRAVAIL N'EST PAS UNE NOTE, et sa nature doit le dire — sinon `@var`
      // serait une porte nommée qui ne change RIEN : la scène compilerait et l'aval continuerait
      // d'inventer une hauteur pour un symbole qui n'en a pas. C'est le défaut mesuré par Kairos
      // sur `Nadaka-1er-essai` : le symbole `A8` sortait SONNANT, et sa résolution lui donnait
      // 7040 Hz. Accepter n'est pas transmettre.
      //
      // Même mécanisme que la nature `wait`, posée deux jours plus tôt pour la même raison mot pour
      // mot : un jeton qui n'est pas une note et que l'aval ne doit pas traiter comme telle. On
      // n'invente pas un mécanisme, on applique celui qui vient d'être éprouvé.
      // Le NOM se lit à deux endroits selon la forme : `el.name` pour un symbole, `el.symbol` pour
      // une note LIÉE (`a~` produit un `TieStart` qui range son nom là). Mesuré le 2026-07-27 :
      // sans le second, `a~` sortait SONNANT alors que `a` seul sortait variable — la même faute
      // que l'attente ancrée deux jours plus tôt, une forme dérivée qui perd ce que la forme nue
      // porte. On lit donc les deux, pas celle du cas qu'on vient d'écrire.
      const nomPorte = typeof el.symbol === 'string' ? el.symbol : el.name;
      const estVariable = nomsVariables.has(nomPorte);
      // ⚠️ LE CÂBLAGE NE SONNE PAS, ET IL NE DOIT PAS DURER (Romain, 2026-07-29 : « une macro de
      // câblage est juste, et elle doit avoir une place SANS DURÉE dans la production »).
      //
      // CE QUE ÇA COÛTAIT, mesuré des deux bouts et pas déduit : BPx émettait `chain@0-500` en
      // TERMINAL et repoussait C4 de 0 à 500 — à 120 au tempo, UN TEMPS ENTIER de musique avalé.
      // Sur `patchbay.bps`, 8 jetons sur 8 sont des macros, ZÉRO note : 100 % de la pièce.
      //
      // ⚠️ ET LA CAUSE ÉTAIT UNE CONTRADICTION ENTRE DEUX DE MES PROPRES SIGNAUX : je publiais
      // `noteTerminals` SANS ce nom — donc je disais moi-même qu'il ne sonne pas — et je posais
      // `nature:'sounding'` DESSUS. BPx suit la nature (contrat d'opacité, ils portent et ne
      // fabriquent pas) : ils ne pouvaient qu'émettre un sonnant. L'information juste circulait
      // déjà jusqu'à eux par `scene.macros`, contredite par le champ qu'ils sont obligés de suivre.
      //
      // LE NOM EST DE MOI, et la frontière a été posée le jour même : la GRAPHIE (ce que l'auteur
      // écrit) est à Romain, un NOM INTERNE D'AST ne l'est pas. `wire` parce que la directive
      // s'appelle `@wire` et le nœud `Wiring` — un même fait, un même mot, la discipline qui m'a
      // fait réutiliser le nœud existant au lieu d'en créer un second.
      //
      // ⚠️ PÉRIMÈTRE VOLONTAIREMENT ÉTROIT : le câblage STRICT, corps de type `Wiring`. Les
      // appels-composants opaques (`lpf.cutoff:12000`) N'Y SONT PAS — ils ne sonnent pas non plus
      // et durent aussi, mais savoir si un RÉGLAGE doit suivre le même sort que le BRANCHEMENT est
      // une question ouverte chez Romain. Élargir ici trancherait à sa place.
      const estCablage = nomsCablage.has(nomPorte);
      el.payload = {
        nature: estCablage ? 'wire' : (estVariable ? 'var' : 'sounding'),
        ...(actor !== undefined ? { actor } : {}),
        ...(controls !== null ? { params: controls } : {}),
        ...(address !== null ? { address } : {}),
        ...((controls !== null || address !== null) ? { occurrence: true } : {}),
        // flux absent (override d'occurrence, pas de propagation)
      };
      return;
    }

    // ── POINT D'ATTENTE — `<!nom` ──────────────────────────────────────
    // Nature `wait`, posée au contrat le 2026-07-26 (BPx AST_SPEC.md:461-486, c96deb3), en
    // conséquence de la décision Romain « le point d'attente doit vivre dans l'arbre ». C'était le
    // SEUL élément de membre droit sans nature — et un élément qui vit dans l'arbre sans en porter
    // une n'y vit qu'à moitié : un consommateur qui trie les feuilles par nature le perdait en
    // silence, alors qu'il est là POUR être observable.
    //
    // Le nom dit le RÔLE, pas la graphie : `<!nom` est la surface, `Wait` le type de nœud,
    // `wait` ce que le jeton EST pour le temps — cohérent avec les six autres valeurs.
    //
    // ⚠️ NE PAS CONFONDRE AVEC UN SILENCE : un silence OCCUPE du temps, une attente le SUSPEND.
    // Durée nulle, ne fait pas avancer la grille — même ressort qu'`instant`. Les deux se
    // ressemblent en prose et se comportent à l'opposé.
    if (type === 'Wait') {
      el.payload = { nature: 'wait' };
      return;
    }

    // ── Note PORTANT UN POINT D'ATTENTE — `C4<!sync1` ──────────────────
    // Le symbole reste une NOTE : le point d'attente est ancré SUR lui, il ne le remplace pas.
    // Mesuré le 2026-07-26 : l'annotateur ne descendait pas dans `el.symbol`, donc `C4<!sync1`
    // perdait sa nature `sounding` — la même note écrite sans point d'attente la portait. Un
    // consommateur qui trie les feuilles par nature perdait donc la note en silence.
    //
    // ⚠️ ET LE POINT D'ATTENTE ANCRÉ EN PORTE UNE AUSSI. Mesuré par BPx le 2026-07-27 : cette
    // branche descendait dans `el.symbol` puis RETOURNAIT — les attentes ancrées n'étaient jamais
    // annotées. Ce n'est pas un cas de bord : le parser ancre l'attente sur le symbole qui précède
    // MÊME séparée par une espace (`C4 <!sync1`), donc toute attente précédée d'une note tombait
    // dans le trou. L'aval découpe le flux sur la NATURE, plus sur un nom : sans elle, l'attente
    // arrive en position et en durée mais rien ne s'arme dessus.
    if (type === 'SymbolWithWait' && el.symbol) {
      annotateRhsNode(el.symbol, ruleActor);
      for (const t of (el.triggers || [])) annotateRhsNode(t, ruleActor);
      return;
    }

    // ── Silence ────────────────────────────────────────────────────────
    if (type === 'Rest' || type === 'UndeterminedRest') {
      el.payload = { nature: 'rest' };
      return;
    }

    // ── Prolongation ───────────────────────────────────────────────────
    if (type === 'Prolongation') {
      el.payload = { nature: 'prolongation' };
      return;
    }

    // ── Contrôles ──────────────────────────────────────────────────────
    if (type === 'Control') {
      const isEngine = libCtx.bp3NativeControls && libCtx.bp3NativeControls.has(el.name);
      const nature = isEngine ? 'engine-control' : 'transport-control';
      el.payload = {
        nature,
        // flux:true pour un transport-control standalone (propagation de flux)
        ...(nature === 'transport-control' ? { flux: true } : {}),
      };
      return;
    }

    // ── Contrôle instantané !(…) ou ![@seed] ──────────────────────────
    if (type === 'InstantControl') {
      el.payload = {
        nature: 'instant',
        flux: true,  // se propage aux tokens suivants du même acteur
        // conjoint (collé `C4!(...)`) = ancré au terminal précédent, voyage avec lui (régime
        // structurel) ; non conjoint (espacé `C4 !(...)`) = événement séparé (régime séquentiel).
        // Présent seulement pour les `!(...)` runtime (qui portent ce flag) ; absent sinon.
        ...(el.conjoint !== undefined ? { conjoint: el.conjoint } : {}),
      };
      return;
    }

    // ── Câblage posé dans le flux (`!osc >> filtre`, `!\>> out.in`) ───
    // Même nature que les autres instantanés : ZÉRO DURÉE, jamais un pas (Romain 2026-07-28).
    // Un câblage écrit dans un corps de `@macro` ne passe pas ici — cette annotation ne parcourt
    // que les membres droits — et il reste donc sans `payload`, comme avant.
    if (type === 'Wiring') {
      el.payload = { nature: 'instant', flux: true };
      return;
    }

    // ── Polymetric — récursion dans les voix ──────────────────────────
    if (type === 'Polymetric') {
      // Pas de payload sur le nœud Polymetric lui-même (structurel).
      // Mais un qualificateur de GROUPE `{…}(vel:80)` est de la CONTENANCE (même concept
      // neuf que le `(...)` de règle, décision Romain 2026-06-20) : structurel, confiné au
      // groupe, ne déborde pas. On le tague `containment` (PAS `flux`) pour que BPx le route
      // au régime structurel. (Les Polymetric imbriqués sont atteints par la récursion.)
      if (el.settings && typeof el.settings === 'object') {
        const { address, controls } = splitAddress(extractOccurrenceParams([el.settings]));
        el.settings.payload = {
          nature: 'transport-control',
          containment: true,
          scope: 'group',
          ...(controls ? { params: controls } : {}),
          ...(address ? { address } : {}),
        };
      }
      for (const voice of (el.voices || [])) {
        annotateRhsElements(voice, ruleActor);
      }
      return;
    }

    // ── SimultaneousGroup — récursion ──────────────────────────────────
    if (type === 'SimultaneousGroup') {
      if (el.primary) annotateRhsNode(el.primary, ruleActor);
      for (const s of (el.secondaries || [])) annotateRhsNode(s, ruleActor);
      return;
    }

    // ── Invocation de GABARIT `$A(…)` / `&A(…)` — portée EXPLICITE ────────
    // La portée était déjà celle-ci (déduite de la position, `AST.md:923-924`) : un suffixe
    // sur une invocation de gabarit gouverne l'EXPANSION du gabarit et ne déborde pas —
    // même régime de contenance que le groupe et la règle, jamais du flux.
    // Ce qui manquait, c'est de le DIRE. Le cas groupe portait `scope:'group'` en clair
    // pendant que celui-ci n'avait aucun payload : le consommateur devait déduire une portée
    // là où son voisin la lui donnait. bpx a lu cette asymétrie comme une invitation à
    // traiter le cas en flux, et sa descente template/bloc s'est trompée — ma surface a
    // une part dans son bug. On émet donc explicitement ce qui était déjà vrai.
    // ADDITIF : qui déduisait de la position reste juste ; qui veut lire le peut.
    if (type === 'TemplateMaster' || type === 'TemplateSlave') {
      for (const sq of (el.suffixQualifiers || [])) {
        if (!sq || sq.type !== 'SettingBag') continue;
        const { address, controls } = splitAddress(extractOccurrenceParams([sq]));
        sq.payload = {
          nature: 'transport-control',
          containment: true,
          scope: 'template',
          ...(controls ? { params: controls } : {}),
          ...(address ? { address } : {}),
        };
      }
      return;
    }

    // Tous les autres types (Period, NumericDuration, NilString, RawBrace,
    // Wildcard, Variable, Homomorphism, Wait…) : pas de payload.
  }

  /**
   * Extrait les overrides d'occurrence depuis `suffixQualifiers` d'un nœud.
   * Retourne un objet {key:val, …} ou null si aucun override.
   * Seules les SettingBag (paires key:val) sont extraites.
   */
  function extractOccurrenceParams(suffixQualifiers) {
    if (!suffixQualifiers || suffixQualifiers.length === 0) return null;
    const params = {};
    let hasParams = false;
    for (const sq of suffixQualifiers) {
      if (sq.type !== 'SettingBag') continue;
      for (const pair of (sq.pairs || [])) {
        // value:true = bare key sans valeur (ex. velcont) — on inclut quand même
        params[pair.key] = pair.value;
        hasParams = true;
      }
    }
    return hasParams ? params : null;
  }

  /**
   * Replie les arguments NOMMÉS d'un nœud SymbolCall sonnant en {key:val, …}
   * (charge d'occurrence). Retourne null si le nœud n'est pas un SymbolCall,
   * n'a pas d'argument nommé, ou n'a que des arguments positionnels.
   * Les args originaux (el.args) sont CONSERVÉS (voie BP3 héritée).
   */
  function extractSymbolCallParams(el) {
    if (!el || el.type !== 'SymbolCall' || !Array.isArray(el.args)) return null;
    const params = {};
    let hasParams = false;
    for (const arg of el.args) {
      if (!arg || !arg.key) continue; // ignore les args positionnels
      const v = arg.value;
      // Literal → valeur brute (nombre/chaîne) ; sinon on garde le nœud (ex. BacktickInline).
      params[arg.key] = (v && v.type === 'Literal') ? v.value : v;
      hasParams = true;
    }
    return hasParams ? params : null;
  }

  /**
   * Sépare les DÉTAILS D'ADRESSE des CONTRÔLES dans une charge d'override (KAI-9 / GAP#2,
   * décision 2026-06-26). Les clés d'adresse (canal/device/port) vont dans un TIROIR DÉDIÉ
   * `payload.address`, distinct des contrôles (vel/pan/wave…) qui restent dans `payload.params`.
   * La syntaxe utilisateur (`(ch:5)`) ne change PAS — c'est interne à l'AST. Kairos lit le tiroir
   * adresse pour matérialiser `event.output`, sans le confondre avec un contrôle.
   * @param {object|null} params  charge brute {clé:val, …}
   * @returns {{ address: object|null, controls: object|null }}
   */
  function splitAddress(params) {
    if (!params) return { address: null, controls: null };
    const address = {};
    const controls = {};
    let hasA = false;
    let hasC = false;
    for (const [k, v] of Object.entries(params)) {
      if (addressKeys().has(k)) { address[k] = v; hasA = true; }
      else { controls[k] = v; hasC = true; }
    }
    return { address: hasA ? address : null, controls: hasC ? controls : null };
  }

  // ============================================================
  // Directives
  // ============================================================

  /**
   * Parse la VALEUR d'un `@alias` : cc:N, osc:/path, <!trigger, [flag], un nom, ou un nom pointé
   * (`kick.vel`, `sys.tempo`, `verse.X`). Rend un descripteur `{ kind, … }`.
   *
   * ⚠️ CE QUE CETTE FONCTION N'A PAS CHANGÉ le 2026-07-27 au soir, et pourquoi. `@map` est abandonné
   * et `@alias` revient à sa place : c'est un RENOMMAGE de la directive, pas une refonte de ce
   * qu'elle peut désigner. L'espace de valeurs reste EXACTEMENT celui d'avant — restreindre serait
   * trancher, et deux des restrictions envisageables sont justement des QUESTIONS OUVERTES chez
   * Romain (le numéro de contrôleur brut comme source, qu'il a déclaré hors langage mais dont le
   * retrait reste à confirmer ; et où s'écrit un câblage de contrôle). Je ne rétrécis pas une
   * directive sur une déduction : coût mesuré du statu quo = nul, aucune pièce n'écrit ces formes.
   */
  function parseAliasValue() {
    // <!trigger
    if (at(T.TRIGGER_IN)) {
      advance();
      const trigName = expect(T.IDENT).value;
      return { kind: 'trigger', name: trigName };
    }
    // [flag] or actor.flag
    if (at(T.LBRACKET)) {
      advance();
      const flagName = expect(T.IDENT).value;
      expect(T.RBRACKET);
      return { kind: 'flag', name: flagName };
    }
    // cc:N or cc:N(params) or osc:/path or osc:/path(params) or named-cc alias
    if (at(T.IDENT)) {
      const id = advance().value;
      if (id === 'cc' && at(T.COLON)) {
        advance();
        const number = Number(expect(T.INT).value);
        const params = at(T.LPAREN) ? parseAliasParams() : null;
        return { kind: 'cc', number, params };
      }
      if (id === 'osc' && at(T.COLON)) {
        advance();
        // OSC address: /path/segments — SLASH followed by IDENT or INT
        let address = '';
        while (at(T.SLASH)) {
          advance();
          const seg = at(T.IDENT) ? advance().value : at(T.INT) ? advance().value : '';
          address += '/' + seg;
        }
        const params = at(T.LPAREN) ? parseAliasParams() : null;
        return { kind: 'osc', address, params };
      }
      // sys.command, scene.command, or actor.flag
      if (at(T.PERIOD) && peek(1).type === T.IDENT) {
        advance();
        const secondId = advance().value;
        if (id === 'sys') {
          // sys is reserved — always a system command
          return { kind: 'sys', scene: null, command: secondId };
        }
        // Generic scoped reference — encoder resolves using scene/actor context
        return { kind: 'scoped', scope: id, name: secondId };
      }
      // Named CC alias (e.g. "breath" from @cc breath:2)
      return { kind: 'alias', name: id };
    }
    throw new ParseError("@alias : valeur attendue — un nom ('kick.vel'), un point d'attente ('<!depart'), un drapeau ('[tension]'), 'cc:N' ou 'osc:/chemin'.", current());
  }

  /** Paramètres facultatifs `(clé:valeur, …)` d'une valeur d'alias. */
  function parseAliasParams() {
    expect(T.LPAREN);
    const params = {};
    while (!at(T.RPAREN) && !atEnd()) {
      const key = expect(T.IDENT).value;
      expect(T.COLON);
      const val = at(T.INT) ? Number(advance().value)
                : at(T.FLOAT) ? Number(advance().value)
                : advance().value;
      params[key] = val;
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);
    return params;
  }

  /**
   * Valeur de directive après ':' — logique PARTAGÉE entre la @-forme
   * historique (@seed:7) et le bloc de production ([@seed:7]) pour garantir
   * des nœuds Directive identiques par construction (contrat BPx).
   *   INT → value Number (négatif via '-') ; ratio N/M → value String ;
   *   FLOAT → value String brute (sortie BP3 exacte) ; IDENT → champ runtime.
   */
  function parseDirectiveColonValue(dirName) {
    let value = null, runtime = null;
    // Directive interval-typée (ex. @transpose global) : lire un littéral d'INTERVALLE et le porter
    // BRUT (chaîne), comme la forme inline. Univers du registre car libCtx n'est pas encore chargé.
    if (dirName && universeIntervalControls().has(dirName)) {
      return { value: readIntervalLiteral(dirName), runtime: null };
    }
    // Handle negative values: @transpose:-24
    let negative = false;
    if (at(T.REST)) { // - token
      negative = true;
      advance();
    }
    if (at(T.INT)) {
      const num = advance().value;
      // MÈTRE ADDITIF — `@meter:3+4+2/4`, la graphie de BP3 reprise telle quelle (décision Romain
      // 2026-07-26, `hub/decisions/2026-07-26-trois-manques-du-temps-…`) : des sections de 3, 4 et
      // 2 battements. Motif : « c'est plus clair à comprendre ».
      //
      // ⚠️ LE `+` VIT ICI DANS UN SECOND RÔLE — séparateur de sections, alors qu'il est opérateur
      // de drapeau ailleurs. C'est un ÉCART ASSUMÉ à « un signe, un rôle », pas un oubli : deux
      // options étaient posées, Atlas recommandait `@meter:3 4 2/4` (application littérale de la
      // règle), et Romain a tranché pour la fidélité à BP3 au nom de la lisibilité. À NE PAS
      // « corriger » plus tard au nom de la règle générale — l'exception est datée et motivée.
      //
      // La forme additive était déjà lue dans le sac moteur (`[meter:4+4/6]`) ; seule la directive
      // `@meter` la refusait, alors qu'elle est le point d'entrée naturel.
      if (at(T.PLUS) && peek(1).type === T.INT) {
        let sections = `${negative ? '-' : ''}${num}`;
        while (at(T.PLUS) && peek(1).type === T.INT) {
          sections += advance().value;  // +
          sections += advance().value;  // INT
        }
        if (at(T.SLASH) && peek(1).type === T.INT) {
          sections += advance().value;  // /
          sections += advance().value;  // INT
        }
        return { value: sections, runtime: null };
      }
      // Check for ratio: 3/4, 7/8
      if (at(T.SLASH) && peek(1).type === T.INT) {
        advance(); // /
        const denom = advance().value;
        value = `${negative ? '-' : ''}${num}/${denom}`;
      } else {
        value = Number(`${negative ? '-' : ''}${num}`);
      }
    } else if (at(T.FLOAT)) {
      const raw = advance().value;
      value = raw;  // Preserve raw float string for exact BP3 output (e.g. 60.0000)
    } else if (at(T.IDENT)) {
      // Could be runtime or string value
      const v = advance().value;
      // Check for ratio like 7/8
      if (at(T.SLASH) && peek(1).type === T.INT) {
        advance(); // /
        const denom = advance().value;
        value = `${v}/${denom}`;
      } else {
        runtime = v;
      }
    }
    return { value, runtime };
  }

  /**
   * Bloc de directives de production : `[@seed:1, @items:20]`
   * (EBNF §production_block, décision 2026-06-11). Niveau scène uniquement.
   * Le `@` est répété sur chaque clé ; chaque clé produit le MÊME nœud
   * Directive que la @-forme historique. Détection sur LBRACKET suivi de AT
   * (un `@` entre crochets était une erreur de syntaxe avant la décision).
   */
  function atProductionBlock() {
    return at(T.LBRACKET) && peek(1).type === T.AT;
  }

  function parseProductionBlock() {
    expect(T.LBRACKET);
    const dirs = [];
    while (true) {
      const atTok = expect(T.AT);
      const name = expect(T.IDENT).value;
      let value = null, runtime = null;
      if (at(T.COLON)) {
        advance();
        ({ value, runtime } = parseDirectiveColonValue(name));
      }
      // Le bloc est réservé aux directives de production (décision 2026-06-11).
      // Une autre clé y est parsée (EBNF : IDENT) mais poussée comme Directive
      // SIMPLE — les noms à traitement spécial (@mode, @scene, @duration…)
      // y perdraient leur effet en silence : on avertit.
      if (!PRODUCTION_DIRECTIVES.includes(name)) {
        warn(`Clé '@${name}' hors des directives de production — son effet n'est pas garanti dans un bloc [@…] ; préférer la forme @${name}…`, atTok.line);
      }
      dirs.push({ type: 'Directive', name, subkey: null, runtime, value,
                  aliases: null, modifiers: null, line: atTok.line });
      if (at(T.COMMA)) { advance(); continue; }
      break;
    }
    expect(T.RBRACKET);
    return dirs;
  }

  function parseDirective() {
    const tok = expect(T.AT);
    // @+ is a special case — PLUS token instead of IDENT
    let name, subkey = null;
    if (at(T.PLUS)) {
      advance();
      name = '+';
    } else if (atAny(T.GATE, T.TRIGGER, T.CV)) {
      // @gate, @trigger, @cv — keywords used as directive names
      name = advance().value;
    } else {
      name = expect(T.IDENT).value;
    }
    // Invocation par PROVENANCE (chantier libs-provenance, décision hub ef75ec6 ;
    // contrat contrats/bpscript-bpx.md §libRefs) : `@factory.<chemin-fichier>.<entrée>` et
    // `@mine.<chemin-fichier>.<entrée>`. `factory`/`mine` sont des préfixes RÉSERVÉS. Le
    // domaine est déclaré DANS le fichier — on ne le connaît PAS ici (L27 : on PORTE opaque,
    // Kairos résout). Découpage POSITIONNEL : dernier segment = entrée ; le milieu = chemin.
    // → canal NEUTRE `ast.libRefs` (adresse canonique opaque), PAS un slot legacy.
    if (name === 'factory' || name === 'mine') {
      const segs = [];
      // Un segment recolle les IDENT/INT collés (sans espace) : tirets (`mes-` + `svaras`)
      // ET entrées NUMÉRIQUES (`12` + `TET` → `12TET`, `22` + `shruti` — les accordages
      // commencent souvent par un chiffre : 12TET, 22shruti). FIX 2 architecte [394].
      const readSeg = () => {
        if (!at(T.IDENT) && !at(T.INT)) {
          throw new ParseError(
            `invocation de librairie malformee '@${name}' — segment de nom attendu ` +
            `(ex. @${name}.<chemin-fichier>.<entree>)`, tok);
        }
        let s = String(advance().value);
        while ((at(T.IDENT) || at(T.INT)) && !current().spaceBefore) s += String(advance().value);
        return s;
      };
      while (at(T.PERIOD)) { advance(); segs.push(readSeg()); }
      if (segs.length < 2) {
        throw new ParseError(
          `invocation de librairie malformee '@${name}' — attendu ` +
          `@${name}.<chemin-fichier>.<entree> (ex. @${name === 'mine' ? 'mine.ragas.mes-svaras.sa' : 'alphabet.sargam'})`,
          tok
        );
      }
      // Adresse canonique OPAQUE : `mine.` préfixe le perso ; le sucre `@factory.` est NORMALISÉ
      // au nu (nom nu et `@factory.` confondus AVANT émission — contrat bpscript-bpx.md).
      const address = name === 'mine' ? `mine.${segs.join('.')}` : segs.join('.');
      return { type: 'LibRef', address, provenance: name, line: tok.line };
    }
    // @alphabet.western — dot accessor for subkey within a lib
    if (at(T.PERIOD)) {
      advance();
      subkey = expect(T.IDENT).value;
    }

    // ─── PIERRE TOMBALE — `@scene` est SUPPRIMÉE de la graphie (Romain, 2026-07-29) ──────────
    // Ses mots : « on n'a ni la maturité ni le besoin de déclarer des sous-scènes », puis, une fois
    // la pièce sur la table : « je propose de LAISSER scenes dans BPx, ça peut servir plus tard,
    // mais on le retire du RESTE ».
    //
    // ⚠️ CE QUE ÇA RETIRE N'EST PAS RIEN, ET LA PIÈCE A ÉTÉ MESURÉE AVANT LA DÉCISION. J'avais
    // annoncé que cette suppression « ne touche personne », sur la foi d'un zéro mesuré chez UN
    // consommateur. Mesuré chez BPx avant d'écrire : leur orchestrateur multi-scène EXPORTE une
    // surface publique, LIT `ast.scenes` à trois endroits, et dix cas d'intégration en dépendent.
    // Ils ne CASSENT pas — le champ est optionnel chez eux — mais ils perdent l'ENTRÉE de ce
    // chemin et le SUJET de ces dix cas. Leur orchestrateur reste, comme capacité conservée en
    // attente d'usage. Ce n'est PAS de la rétrocompatibilité : rien ne l'appelle plus côté langage.
    //
    // LA LEÇON, ET ELLE VAUT AU-DELÀ D'ICI : UN ZÉRO CHEZ UN CONSOMMATEUR N'EST PAS UN ZÉRO
    // PARTOUT. Et sa réciproque, apprise le même jour et plus vicieuse : chercher les OCCURRENCES
    // dans les données ne trouve pas les LECTEURS — BPx n'avait aucune scène employant `@scene`, et
    // c'est pourtant chez eux que la suppression mord, parce que c'est leur CODE qui lit le champ.
    if (name === 'scene') {
      throw new ParseError(
        `'@scene' est SUPPRIMÉE du langage (décision Romain 2026-07-29) : « on n'a ni la maturité `
        + `ni le besoin de déclarer des sous-scènes ». Une scène ne déclare plus de sous-scènes — `
        + `la composition multi-scène, si elle revient, se fera hors du langage.`, tok);
    }

    // TOMBSTONE : la feature @routing (profils d'environnement studio/live/browser + routingTable
    // Z1 #105) est SUPPRIMÉE (décision 2026-07-16, Romain : modèle d'environnements abandonné —
    // ce n'était pas le moteur BP3 mais une feature de notre transpileur). Rejet nommé plutôt
    // qu'un silence : le canal de sortie se déclare par `out.<audio|midi|osc>` sur l'acteur.
    if (name === 'routing') {
      throw new ParseError(
        `'@routing' n'existe plus — la feature de profils d'environnement (studio/live/browser) a `
        + `été SUPPRIMÉE (2026-07-16). Le canal de sortie se déclare par 'out.<audio|midi|osc>' `
        + `sur l'acteur (ou '@alphabet.X:<sortie>' pour l'acteur implicite).`,
        tok,
      );
    }

    let runtime = null, value = null, aliases = null;

    // @scene verse "verse.bps" — child scene declaration
    if (name === 'scene') {
      const sceneName = expect(T.IDENT).value;
      const file = expect(T.STRING).value;
      return { type: 'SceneDirective', name: sceneName, file, line: tok.line };
    }

    // ⛔ PIERRE TOMBALE — `@library` est SUPPRIMÉE du langage (décision Romain 2026-08-06).
    //
    // POURQUOI ELLE PART. C'était la seule des quinze librairies dont ce qui suit le point n'était
    // pas l'ENTRÉE du catalogue mais le MOTEUR, l'entrée venant après entre guillemets : trois
    // pièces là où toutes les autres en ont deux. Mesuré avant de trancher : sa forme nue
    // `@library.strudel` — celle que la bible imprimait — ne compilait même pas.
    //
    // CE QUI LA REMPLACE : la banque est un paramètre INTRINSÈQUE du moteur, déclaré sur l'entrée
    // `strudel` de `lib/eval.json` (Romain : « bank est intrinsèque à strudel, c'est pas
    // générique »). Elle se pose donc sur l'ACTEUR, à côté du moteur qui la charge — et l'écriture
    // existait déjà, c'est celle de `out.midi(ch:3)`. Gain de passage : deux voix Strudel peuvent
    // désormais porter deux banques différentes dans une même scène, ce que la directive de scène
    // rendait impossible.
    if (name === 'library') {
      throw new ParseError(
        `'@library' est SUPPRIMÉE du langage (décision Romain 2026-08-06) : la banque n'est pas une `
        + `librairie, c'est un paramètre du moteur qui la charge. Elle se pose sur l'acteur — `
        + `'@actor <nom> eval.${subkey || '<moteur>'}(bank:<banque>)'. Deux voix du même moteur `
        + `peuvent ainsi porter deux banques différentes`,
        tok);
    }

    // @expose [intensity] [energy] — expose flags to parent scene
    if (name === 'expose') {
      const flags = [];
      while (at(T.LBRACKET)) {
        advance();
        flags.push(expect(T.IDENT).value);
        expect(T.RBRACKET);
      }
      return { type: 'ExposeDirective', flags, line: tok.line };
    }

    // ─── PIERRE TOMBALE — `@transport`/`@out` ne sont PAS des directives de scène (Romain,
    // 2026-08-04) ─────────────────────────────────────────────────────────────────────────────
    // Signalé par Atlas, mesuré avant correction : le tombstone `transport` posé DANS un bloc
    // `@actor` (plus bas, `ACTOR_ENTITY_KEYS`) ne couvrait pas l'écriture en TÊTE de scène —
    // `@transport.midi` et `@out.midi` compilaient tous les deux SANS ERREUR et SANS AUCUN EFFET
    // (l'acteur implicite garde `{type:'TransportRef', key:'audio'}` quoi qu'on écrive : la
    // directive produisait un nœud que rien ne consomme). Le trou est PRÉEXISTANT — `@transport`
    // compilait déjà avant le lot de renommage du 2026-08-04, ce n'est pas une régression de ce
    // lot, c'est ce que ce lot aurait dû fermer.
    //
    // Les deux mots restent dans `schema.reservedDirectives` (`lib/core.json`) — ce refus
    // s'AJOUTE, il ne les en retire pas : c'est ce qui empêche une librairie de déclarer une
    // valeur portant ce nom (cf. `_destinations.transport`/`_destinations.out` du même fichier).
    if (name === 'transport') {
      throw new ParseError(
        `'@transport' n'existe plus en directive de scène (décision Romain 2026-08-04) — le mot `
        + `'transport' est SORTI du langage. La direction se déclare sur l'acteur, dans un bloc `
        + `'@actor' : 'out.<canal>' (ex-'transport.<canal>'). `
        + `Exemple : '@actor S\\n  out.audio'.`, tok);
    }
    if (name === 'out') {
      throw new ParseError(
        `'@out' n'est pas une directive de scène (décision Romain 2026-08-04) — 'out' est une clé `
        + `d'ACTEUR, elle s'écrit 'out.<canal>' à l'intérieur d'un bloc '@actor', jamais en tête `
        + `de scène. Exemple : '@actor S\\n  out.audio'.`, tok);
    }

    // ─── PIERRE TOMBALE — `@in` n'existe plus (Romain, 2026-08-04) ────────────────────────────
    // `hub/decisions/2026-08-04-la-direction-s-ecrit-in-et-out-remplacent-transport.md`. La bible
    // (`docs/spec/LANGUAGE.md` §« @var — déclarer une variable ») écrivait déjà `@var <rôle>
    // in.<canal>` : ce n'était pas une nouvelle forme, c'est le code qui divergeait. La déclaration
    // d'entrée vit désormais dans `@var`, avec les autres variables — voir plus bas.
    if (name === 'in') {
      throw new ParseError(
        `'@in' n'existe plus (décision Romain 2026-08-04) — la direction s'écrit : `
        + `'@var <rôle> in.<canal>' remplace '@in <rôle> transport.<canal>'. `
        + `Exemple : '@var pedale in.midi mapping.fcb_std'.`, tok);
    }

    // @var A8   /   @var a, b, c — VARIABLES DE TRAVAIL
    // @var touches in.keyboard    — DÉCLARATION D'UNE ENTRÉE
    //
    // Décision Romain 2026-07-27, voie 3 : « on déclare les symboles non-alphabet terminaux en
    // plus, avec une directive @. Ce sont des VARIABLES DE TRAVAIL. »
    //
    // CE QUE ÇA DÉBLOQUE : une scène peut déclarer SA CONVENTION de notes ET porter un symbole qui
    // n'est l'écriture d'aucune note. Mesuré sur `Nadaka-1er-essai` : sa grammaire d'origine écrit
    // `A8`, qui n'a AUCUNE règle et n'est une note dans aucun alphabet — le moteur natif l'émet
    // littéralement comme jeton. Annoter la convention indienne de cette scène la faisait REFUSER
    // par mon propre compilateur. La déclaration lève la contradiction sans affaiblir le refus :
    // une COQUILLE reste attrapée (elle n'est déclarée nulle part), un symbole VOULU passe.
    //
    // LA GRAPHIE ne crée aucune syntaxe : pas de deux-points parce qu'on ÉNUMÈRE sans affecter
    // (règle de Romain du 2026-07-26, comme `@expose`/`@label`) ; la virgule sépare des éléments de
    // même rang, exactement comme dans un sac ; plusieurs lignes s'ACCUMULENT, comme plusieurs
    // invocations de librairie.
    //
    // ⚠️ PÉRIMÈTRE (2026-08-04) : `docs/spec/LANGUAGE.md` documente un `@var` typé bien plus large
    // (flag, signal, pitch, phase, logic, module — table « `@var` — déclarer une variable »). CE
    // CHANTIER (transport → in/out) n'ajoute QUE la forme d'entrée `<rôle> in.<canal>`, ex-`@in` —
    // les autres types restent hors périmètre, non implémentés ici.
    if (name === 'var') {
      if (!at(T.IDENT)) {
        throw new ParseError("@var doit nommer au moins un symbole : '@var A8', '@var a, b, c' "
          + "pour plusieurs, ou déclarer une entrée : '@var <rôle> in.<canal>'. Ce sont des "
          + "variables de travail — des symboles du flux qui ne sont l'écriture d'aucune note, "
          + 'ou le rôle que tient une entrée.', tok);
      }
      const first = expect(T.IDENT).value;

      // @var <rôle> in.<canal> [mapping.<table>] — DÉCLARATION D'UNE ENTRÉE
      //
      // Décision Romain 2026-07-27 (`hub/decisions/2026-07-27-forme-des-entrees-in-mapping-adresse-
      // nue.md`), en conséquence de la symétrie entrée/sortie du même jour : une sortie est routée
      // PAR LE NOM, AU POINT OÙ ELLE SERT (`sitar1.Sa`) ; une entrée l'est de la même façon, au point
      // de RÉCEPTION — le point d'attente. Pas de directive de routage, pas de flèche. Réécrite en
      // `@var` par la décision du 2026-08-04 (transport → in/out), qui abandonne `@in`.
      //
      // TROIS CONTRAINTES, chacune refusée bruyamment plus bas :
      //  1. AUCUN NOM DE PORT. La scène nomme un RÔLE ; le nom d'un port vient du système et change
      //     de machine en machine — une scène qui le porterait ne s'ouvrirait plus ailleurs.
      //     L'association rôle → appareil réel vit HORS de la scène.
      //  2. AUCUN ALPHABET. Il n'y a RIEN à résoudre en entrée : l'événement est DISCRET (Romain :
      //     « si sur mon entrée je fais un glissando, ça va activer au croisement de la fréquence ?
      //     on attend un événement DISCRET, pas un traitement de signal »). Le mécanisme est
      //     événement brut → table → étiquette interne ; l'alphabet n'est qu'un réservoir de NOMS où
      //     les étiquettes puisent, et c'est LA TABLE qui le déclare, en librairie.
      //  3. AUCUNE TABLE PAR DÉFAUT. Sans table déclarée on écrit des adresses nues, et c'est
      //     EXPLICITE dans la scène — poser une identité implicite rendrait indistinguables « je
      //     n'ai pas de table » et « ma table ne fait rien ».
      if (at(T.IDENT) && current().value === 'in' && peek(1).type === T.PERIOD && !peek(1).spaceBefore) {
        const roleName = first;
        advance(); // in
        advance(); // .
        const canal = expect(T.IDENT).value;
        // ⚠️ CONTRAINTE 1 — un nom de port dans la scène est REFUSÉ, pas ignoré.
        if (at(T.LPAREN)) {
          throw new ParseError(`@var ${roleName} : 'in.${canal}(…)' est refusé — une entrée `
            + `ne porte AUCUN nom de port. Un nom de port vient du système et change de machine `
            + `en machine ; la scène nomme un RÔLE, l'utilisateur associe l'appareil, et `
            + `l'association vit hors de la scène.`, tok);
        }
        // LISTE FERMÉE PROPRE AUX ENTRÉES — voir `inChannels`/`lib/core.json` schema.channels :
        // le clavier y entre (décision Romain 2026-07-26, trois périphériques d'entrée nommés)
        // et NULLE PART ailleurs. On n'a relâché aucune règle en fusionnant les catalogues.
        if (!inChannels().has(canal)) {
          throw new ParseError(`@var ${roleName} : '${canal}' n'est pas une entrée — les canaux `
            + `d'entrée sont ${[...inChannels()].join(', ')}. La liste est FERMÉE.`, tok);
        }
        let table = null;
        while (at(T.IDENT)) {
          const cle = advance().value;
          if (!at(T.PERIOD)) {
            throw new ParseError(`@var ${roleName} : '${cle}' doit APPELER un composant avec un `
              + `point ('mapping.<table>') — le point APPELLE, les deux points AFFECTENT.`, tok);
          }
          advance();
          const valeur = expect(T.IDENT).value;
          if (cle === 'mapping') {
            table = valeur;
          } else if (cle === 'alphabet') {
            // ⚠️ CONTRAINTE 2 — et c'est la correction la plus importante de la décision.
            throw new ParseError(`@var ${roleName} : une entrée ne porte AUCUN alphabet. Il n'y a `
              + `rien à résoudre en entrée — l'événement est DISCRET, pas un signal à interpréter. `
              + `C'est la TABLE (mapping.<nom>) qui déclare le vocabulaire où les étiquettes `
              + `puisent, et elle le fait en librairie, pas dans la scène.`, tok);
          } else {
            throw new ParseError(`@var ${roleName} : propriété '${cle}' inconnue — une entrée `
              + `déclare son canal ('in.<canal>') et, facultativement, sa table `
              + `('mapping.<table>'). Rien d'autre.`, tok);
          }
        }
        // CONTRAINTE 3 : `table` reste null quand rien n'est déclaré. On n'invente AUCUN défaut.
        return { type: 'InDirective', name: roleName, transport: canal, mapping: table, line: tok.line };
      }

      // @var <nom> <var_type> — UNE VARIABLE TYPÉE (EBNF.md:47-57, AST.md:119-150, référence
      // 2026-08-05). Le nom vient d'abord, le type ensuite. Trois familles, dans l'ordre où la
      // grammaire les distingue :
      //   1. "flag" ":" flag_state {"," flag_state}   — un drapeau et ses états nommés
      //   2. CONVENTION ("signal"|"pitch"|"phase"|"logic")  — un flux lu selon une convention
      //   3. IDENT nu                                  — une INSTANCE d'un module du catalogue
      // La forme SANS type (un nom seul, ou une liste séparée par des virgules) reste plus bas.
      if (at(T.IDENT)) {
        const typeTok = current();
        const typeWord = typeTok.value;

        if (typeWord === 'flag') {
          advance();
          if (!at(T.COLON)) {
            throw new ParseError(`@var ${first} flag : un drapeau nomme ses états après un ':' — `
              + `'@var ${first} flag: <nom>:<entier>, ...'. Le deux-points AFFECTE, ici il introduit `
              + `l'énumération des états.`, typeTok);
          }
          advance(); // :
          const states = [];
          while (at(T.IDENT)) {
            const stName = advance().value;
            if (!at(T.COLON)) {
              throw new ParseError(`@var ${first} flag : l'état '${stName}' doit porter sa valeur `
                + `entière après ':' — '${stName}:<entier>'.`, typeTok);
            }
            advance(); // :
            const stVal = Number(expect(T.INT).value);
            states.push({ name: stName, value: stVal });
            if (at(T.COMMA)) advance();
          }
          if (!states.length) {
            throw new ParseError(`@var ${first} flag : au moins un état est requis — `
              + `'@var ${first} flag: <nom>:<entier>, ...'.`, typeTok);
          }
          return { type: 'VarDirective', names: [first], varType: { kind: 'flag', states }, line: tok.line };
        }

        if (VAR_CONVENTIONS.has(typeWord)) {
          advance();
          return { type: 'VarDirective', names: [first],
                   varType: { kind: 'convention', convention: typeWord }, line: tok.line };
        }

        // Reste des IDENT nus : un MODULE — une INSTANCE de ce module (`@var lpf1 lpf`). Résolu
        // contre le catalogue `lib/mod.json`. « Une entrée introuvable est nommée. RIEN NE SE
        // RÉSOUT PAR DÉFAUT EN SILENCE » (LANGUAGE.md) — vaut pour un module comme pour un
        // alphabet : un IDENT absent du catalogue est REFUSÉ, jamais accepté à l'aveugle.
        advance();
        const modules = loadLib('mod')?.objects || {};
        if (!Object.prototype.hasOwnProperty.call(modules, typeWord)) {
          throw new ParseError(`@var ${first} ${typeWord} : '${typeWord}' est absent du catalogue `
            + `de modules ('lib/mod.json') — modules connus : ${Object.keys(modules).join(', ') || '(aucun)'}. `
            + `Rien ne se résout par défaut en silence : une entrée absente du catalogue se nomme, `
            + `elle ne s'invente pas.`, typeTok);
        }
        return { type: 'VarDirective', names: [first],
                 varType: { kind: 'module', module: typeWord }, line: tok.line };
      }

      // Forme nue : VARIABLES DE TRAVAIL, sans type — un nom, ou plusieurs séparés par des virgules.
      const noms = [first];
      while (at(T.COMMA) && advance()) noms.push(expect(T.IDENT).value);
      return { type: 'VarDirective', names: noms, varType: null, line: tok.line };
    }

    // @macro kick = (vel:120) or @macro accent(x) = x(vel:120)
    if (name === 'macro') {
      const macroName = expect(T.IDENT).value;
      const params = [];
      // LISTE DE PARAMÈTRES — collée au nom, `@macro accent(x) x(vel:120)`. Elle se distingue d'un
      // corps qui commencerait par une parenthèse (`@macro kick (vel:120)`) par le COLLAGE : la
      // liste est collée au nom, le corps est séparé par une espace. Même règle que partout
      // ailleurs — l'espace est le délimiteur de termes.
      if (at(T.LPAREN) && !current().spaceBefore) {
        advance(); // consume (
        while (!at(T.RPAREN) && !atEnd()) {
          params.push(expect(T.IDENT).value);
          if (at(T.COMMA)) advance();
        }
        expect(T.RPAREN);
      }
      // ⚠️ LE SIGNE `=` A DISPARU DE TOUT LE LANGAGE, `@macro` comprise (décision Romain
      // 2026-07-27, amendement `hub afbd88a`). UNE SEULE FORME PARTOUT — `@<directive> <nom>
      // <valeur>` : rien à retenir, aucune exception à expliquer.
      //
      // L'ARGUMENT ÉCARTÉ, et il était le mien : « une fois `@alias` disparu, le signe redevient
      // univoque, donc `@macro` peut le garder ». Romain tranche que ce n'est PAS une information
      // mais une CONVENTION — et qu'une convention qui ne vaut que pour une directive coûte plus à
      // retenir qu'elle ne rapporte.
      //
      // Tombstone NOMMÉ : sans lui, la ligne retombait sur un message de grammaire illisible.
      if (at(T.EQUALS)) {
        throw new ParseError(`@macro ${macroName} : le signe '=' a DISPARU de tout le langage `
          + `(décision Romain 2026-07-27) — écrire '@macro ${macroName} <corps>', comme toutes les `
          + `autres directives : le nom, puis la valeur, sans rien entre les deux.`, current());
      }
      // Body: câblage (corps avec >>/\>> = voix/patch) ; sinon
      // substitution existante. Le corps câblage est dispatché par la présence de
      // l'opérateur de câblage (>> ou \>>) avant le saut de ligne.
      // parseRhsElements would reject floating () before libCtx is loaded, so handle directly.
      let body;
      if (bodyIsWiring()) {
        body = [parseWiring(tok.line)];
      } else if (at(T.LPAREN) && peek(1).type === T.IDENT && peek(2).type === T.COLON) {
        body = [{ type: 'InstantControl', qualifier: parseRuntimeQualifier() }];
      } else {
        body = parseRhsElements();
      }
      // ⚠️ PÉRIMÈTRE ÉLARGI LE 2026-07-29, sur arbitrage de Romain : « régler un paramètre ne doit
      // pas avoir de durée ». Le critère n'est donc plus le câblage strict mais CE QUI AGIT SUR UN
      // MODULE SANS PRODUIRE DE SON — brancher, couper, régler, même traitement.
      // Deux corps entrent : `Wiring` (`saw >> lpf >> audio`) et l'APPEL-COMPOSANT, un `Symbol` qui
      // porte un ACTEUR (`lpf.cutoff:12000` → {Symbol, name:cutoff, actor:lpf, value:…}).
      // C'est l'ACTEUR qui discrimine : un corps de `Symbol` SANS acteur est une macro de
      // substitution ordinaire, et elle garde sa durée — celle de son contenu (arbitrage Romain).
      // MESURÉ sur 196 scènes : quatre macros entrent (un câblage, trois réglages), ZÉRO macro
      // ordinaire n'est touchée. J'avais signalé que mon registre était trop étroit sans l'élargir
      // moi-même : l'élargissement vient de la décision, pas de mon intuition.
      const agitSurUnModule = (body || []).some((b) => b
        && (b.type === 'Wiring' || (b.type === 'Symbol' && b.actor)));
      if (agitSurUnModule) nomsCablage.add(macroName);
      else checkMacroParamsUsed(macroName, params, body, tok);
      return { type: 'MacroDirective', name: macroName, params, body, line: tok.line };
    }

    // PIERRE TOMBALE — `@label` part AVEC le suffixe qu'elle servait (Romain 2026-07-28). Elle
    // DÉCLARAIT un nom que le suffixe APPLIQUAIT : ce sont bien deux choses distinctes, mesurées
    // comme telles, mais rien ne les liait et aucune scène n'écrivait ni l'une ni l'autre. Retirer
    // le suffixe en laissant la directive aurait laissé un mot qui ne peut plus rien nommer —
    // c'est-à-dire une voie en attente de se rouvrir.
    if (name === 'label') {
      const nom = at(T.IDENT) ? current().value : 'nom';
      throw new ParseError(
        `'@label' est SUPPRIMÉE du langage (décision Romain 2026-07-28), en même temps que le `
        + `suffixe '@${nom}' qu'elle servait à déclarer. Pour ASSOCIER un geste à un élément dans `
        + `la production : le point d'exclamation ('C4!${nom}'). Pour NOMMER quelque chose dans la `
        + `partie déclarative : '@macro ${nom} <corps>' ou '@alias ${nom} <valeur>'.`, tok);
    }

    // ─── @wire — LE CÂBLAGE INITIAL (Romain, 2026-07-29) ─────────────────────────────────────
    //
    //     @wire saw >> lpf >> audio
    //
    // Il pose l'ÉTAT DE DÉPART du branchement ; le flux le modifie ensuite avec les chevrons
    // existants (`>>` brancher, `\>>` couper). Ça ne rouvre PAS la directive de correspondance
    // abandonnée le 2026-07-27 : l'argument qui l'avait tuée était qu'UNE DIRECTIVE NE SE
    // DÉBRANCHE PAS — or un câblage INITIAL n'a pas à se débrancher, c'est précisément sa
    // définition.
    //
    // ⚠️ LE NŒUD N'EST PAS NEUF — c'est le `Wiring` que produisent déjà les corps de macro, à
    // l'identique. Inventer un second nœud pour le même fait aurait été une seconde source de
    // vérité, et c'est la faute que j'ai payée le matin même en fondant `noteTerminals` avec
    // `alphabetTerminals`. Un même fait, un même nœud.
    //
    // ⚠️ ET IL VIT À LA RACINE, PAS DANS `directives` — demandé par BPx, qui a mesuré avant que
    // j'écrive : sans champ propre, leur repli attrape-tout le collerait sur CHAQUE FEUILLE. Le
    // risque n'était pas la casse (leurs trois formes d'essai chargent vertes) mais le PLACEMENT
    // SILENCIEUX. `scene.wires` le met là où vivent déjà les acteurs et la config de hauteur.
    // ABSENT ≠ VIDE, comme `libRefs` : le champ est OMIS quand la scène ne câble rien.
    // On REND le nœud et l'appelant le range : `scene` n'est pas dans la portée ici, et le même
    // aiguillage sert déjà au modulateur `@cv`. Un seul mécanisme de routage, pas deux.
    if (name === 'wire') return parseWiring(tok.line);

    // @gate Sa:midi · @cv env1 mod.adsr(…) — LE DEUX-POINTS TRANCHE (Romain, 2026-07-29).
    //
    // ⚠️ CE N'EST PAS UN ÉLARGISSEMENT, C'EST LE RETRAIT D'UNE DEVINETTE. Le compilateur
    // distinguait ces deux formes d'après ce qui SUIVAIT le deux-points (`isCVModulatorBody` :
    // est-ce `lib.type(…)` ou un bloc de code ?). C'est exactement le mécanisme qui a condamné
    // le signe `=` le 27 juillet — un mot dont le sens dépend du contexte. Désormais la
    // PRÉSENCE du deux-points décide, et rien d'autre :
    //   · AVEC `:` → une PROPRIÉTÉ posée sur un nom qui existe déjà (`@gate Sa:midi`) ;
    //   · SANS `:` → une DÉCLARATION qui CRÉE un nom (`@cv env1 mod.adsr(…)`), et c'est la
    //     forme unique du langage depuis le 27 juillet : `@<directive> <nom> <valeur>`.
    // Romain généralise aux QUATRE types : « en toute logique les 2 formes s'appliquent aux 4 ».
    if (name === 'gate' || name === 'trigger' || name === 'cv') {
      const declName = expect(T.IDENT).value;
      if (at(T.COLON)) {                     // PROPRIÉTÉ sur un nom existant
        advance();
        // ⚠️ SAUF SI CE QUI SUIT EST UN CORPS DE MODULATEUR — signalé par kairos via bpx, et le
        // défaut est de moi : mon refus de la forme nue ENSEIGNE que le deux-points pose une
        // propriété. Qui migre `cv env1 : mod.adsr(…)` en lisant ce message garde donc
        // naturellement le deux-points… et tombait sur « ligne non reconnue au niveau des
        // règles », un générique qui ne dit plus rien du modulateur.
        // UNE ERREUR QUI APPREND UNE GRAPHIE NE DOIT PAS MENER À UNE ERREUR QUI N'APPREND RIEN :
        // c'est le deuxième pas de la migration, et c'est là qu'on abandonne l'auteur.
        if (isCVModulatorBody()) {
          throw new ParseError(
            `'@${name} ${declName} : …' — le deux-points n'a pas de sens ici : ce qui suit DÉCLARE `
            + `un modulateur, ça ne pose pas une propriété sur un nom qui existe. Retirer le `
            + `deux-points : '@${name} ${declName} <valeur>'. `
            + `(Le deux-points ne sert qu'à la forme '@${name} <nom>:<cible>', qui vise un nom déjà là.)`,
            tok,
          );
        }
        const runtime = expect(T.IDENT).value;
        return { type: 'Declaration', temporalType: name, name: declName, runtime, line: tok.line };
      }
      if (name === 'cv') return parseCVModulator(declName, tok);   // DÉCLARATION d'un modulateur
      throw new ParseError(
        `'@${name} ${declName}' sans valeur ne déclare rien. Écrire '@${name} ${declName}:<cible>' `
        + `pour poser une propriété sur un nom qui existe, ou donner une valeur pour en créer un.`,
        tok,
      );
    }

    // ─── PIERRE TOMBALE — `@map` est ABANDONNÉ (décision Romain 2026-07-27 au soir) ───────────
    // `hub/decisions/2026-07-27-map-abandonne-alias-revient-le-cablage-passe-par-les-chevrons.md`
    //
    // L'ARGUMENT QUI A TRANCHÉ, et il n'était dans aucun inventaire : **une directive ne se
    // débranche pas.** La coupure de câblage coupe un câble PENDANT QUE ÇA JOUE, et le branchement se reconfigure
    // au fil de la pièce ; aucune déclaration ne sait faire ça, et il n'existe pas de
    // « dé-déclaration ». Deux écritures pour brancher A sur B, dont l'une strictement moins
    // puissante : c'est la moins puissante qui part.
    //
    // ⚠️ ET LA LEÇON DE MÉTHODE, qui est de moi : mon inventaire du matin comparait cette directive
    // à `@macro` et concluait JUSTE sur ce couple — il ne l'avait jamais comparée au CÂBLAGE, qui
    // était pourtant le geste qu'elle finissait par faire. Une comparaison bien menée sur le
    // mauvais couple donne une réponse correcte et sans valeur.
    if (name === 'map') {
      throw new ParseError("'@map' est ABANDONNÉ (décision Romain 2026-07-27, le soir) — le câblage "
        + "passe par les chevrons '>>' et '\\>>', qui savent aussi DÉBRANCHER pendant que ça joue, "
        + "ce qu'une directive ne sait pas faire. Pour ÉTIQUETER un nom ou DÉSIGNER des éléments "
        + "marqués, écrire '@alias <nom> <valeur>'. Pour attendre un geste, rien à câbler : "
        + "'@var <rôle> in.<canal>' puis l'adresse collée au point d'attente.", tok);
    }

    // @alias <nom> <valeur> — DÉSIGNER : donner un nom à une chose technique ou répétitive, ou
    // désigner ensemble les éléments marqués d'un label (`kick.vel`).
    //
    // ⚠️ `@alias` REVIENT le 2026-07-27 au soir, après avoir été absorbé le matin même. Ce n'est pas
    // une rétrocompatibilité : c'est la directive qui reste quand le CÂBLAGE en sort. Elle DÉSIGNE,
    // elle ne branche pas — brancher est le geste des chevrons.
    //
    // LE SIGNE '=' NE REVIENT PAS AVEC ELLE. Cette partie du matin tient (décision Romain,
    // uniformité déclarative) : une seule forme dans tout le langage, `@directive <nom> <valeur>`.
    //
    // ⚠️ CE QUE ÇA N'EST PAS — question posée DEUX fois par Romain, donc fermée ici : ce n'est pas
    // une MACRO. Une macro s'écrit DANS LA MUSIQUE, à sa place dans la règle, et Kairos la résout à
    // la PROJECTION, feuille par feuille, déclenchée par un MOT qui paraît dans le flux. Un alias
    // ne s'écrit jamais comme un mot du flux et n'a ni corps ni paramètres. Ni le même composant,
    // ni le même moment, ni le même déclencheur.
    if (name === 'alias') {
      if (!at(T.IDENT)) {
        throw new ParseError("@alias doit NOMMER avant de désigner : '@alias <nom> <valeur>' — par "
          + "exemple '@alias frappe kick.vel'. Le nom d'abord, comme toutes les autres directives.", tok);
      }
      const aliasName = advance().value;
      if (at(T.EQUALS)) {
        throw new ParseError(`@alias ${aliasName} : le signe '=' est SUPPRIMÉ de tout le langage `
          + `(décision Romain 2026-07-27) — écrire '@alias ${aliasName} <valeur>' sans rien entre `
          + `les deux. Le retour de '@alias' ne ramène pas le signe avec lui.`, current());
      }
      if (at(T.ARROW_R) || at(T.ARROW_L) || at(T.ARROW_BI)) {
        throw new ParseError(`@alias ${aliasName} : la flèche n'entre pas dans une directive — elle `
          + `est EXCLUSIVEMENT une règle de production, et ne l'a jamais été d'autre chose. Pour `
          + `désigner : '@alias ${aliasName} <valeur>'. Pour BRANCHER : les chevrons '>>'.`, current());
      }
      const source = parseAliasValue();
      return { type: 'AliasDirective', name: aliasName, source, line: tok.line };
    }

    // @cc breath:2, expression:11 — named MIDI CC declarations
    if (name === 'cc') {
      if (at(T.COLON)) advance();  // optional colon: @cc: breath:2 or @cc breath:2
      const ccMappings = [];
      while (at(T.IDENT)) {
        const ccName = advance().value;
        expect(T.COLON);
        const ccNumber = Number(expect(T.INT).value);
        ccMappings.push({ name: ccName, number: ccNumber });
        if (at(T.COMMA)) advance();
      }
      return { type: 'Directive', name, subkey, runtime: null, value: null, aliases: null,
               modifiers: null, ccMappings, line: tok.line };
    }

    // ─── PIERRE TOMBALE — `@flag` (directive de tête de scène) n'existe plus (référence
    // 2026-08-05) ─────────────────────────────────────────────────────────────────────────────
    // La référence ne connaît que QUATRE mots déclaratifs — `actor`, `var`, `def`, `init`
    // (EBNF.md:29-33, `docs/spec/LANGUAGE.md` §« Quatre mots »). Un drapeau n'en est pas un
    // cinquième : c'est une VARIABLE, comme les autres, qui se déclare par `@var` (EBNF.md:47-57,
    // `var_type = "flag" , ":" , flag_state, ...`). La forme unique est désormais
    // `@var <nom> flag: <état>:<entier>, ...`.
    if (name === 'flag') {
      throw new ParseError(
        `'@flag' n'est pas une directive de tête de scène — un drapeau se déclare par `
        + `'@var <nom> flag: <état>:<entier>, ...', comme toute variable (le nom vient d'abord, `
        + `le type ensuite). Exemple : '@var section flag: calm:1, full:2' remplace `
        + `'@flag section: calm:1, full:2'.`, tok);
    }

    // @actor name <body>
    //
    // v0.8 (forme canonique) : références d'entités via `.`
    //   @actor sitar
    //     alphabet.sargam
    //     tuning.sargam_22shruti
    //     out.midi(ch:3, vel:100)
    //     eval.python
    //     sound.bell_short            // équivaut à *:sound.bell_short
    //     *:sound.bell_short          // affectation défaut
    //     Sa:sound.drum_kick          // affectation note
    //
    // v0.7 (rétrocompat transitoire, accepté en silence) : références via `:`
    //   @actor sitar alphabet:sargam tuning:sargam_22shruti out:midi(ch:3)
    //
    // Les deux formes peuvent être mêlées sur la même ligne et le parseur
    // bascule par token (le `*` ou un IDENT:sound.X = affectation, sinon
    // entity_ref).
    //
    // ⚠️ `out` remplace `transport` (Romain, 2026-08-04) — le mot `transport` est SORTI du
    // langage, la direction s'écrit. Le CHAMP interne reste `properties.transport`/`TransportRef`
    // (`references[transport]`) : seul le mot que l'auteur ÉCRIT change, pas le nœud d'arbre.
    if (name === 'actor') {
      const actorName = expect(T.IDENT).value;
      const properties = {};
      const soundAssignments = [];
      // Adressage de sortie : UNE seule forme d'adresse partout (KAI-9, décision
      // 2026-06-26 / GAP#1). Le type de runtime est `out.<midi|osc|...>` et les
      // DÉTAILS d'adresse (canal/device/port) sont ses PARAMS, iso-MIDI :
      //   out.midi(ch:3)              out.osc(device:reaper, ch:7)
      // (Remplace l'ancien champ séparé `ActorDirective.binding` OSC-L1, supprimé : les
      //  détails OSC vivaient dans un tiroir parallèle au lieu de out.params.)

      // Helper: parser les params d'une sortie `(ch:3, vel:100)` / `(device:reaper, ch:7)`
      const parseRefParams = () => {
        expect(T.LPAREN);
        const params = {};
        while (!at(T.RPAREN) && !atEnd()) {
          const paramKey = expect(T.IDENT).value;
          expect(T.COLON);
          const paramVal = at(T.INT) ? Number(advance().value)
                         : at(T.FLOAT) ? Number(advance().value)
                         : advance().value;
          params[paramKey] = paramVal;
          if (at(T.COMMA)) advance();
        }
        expect(T.RPAREN);
        return params;
      };

      // Helper : enregistre une référence d'entité dans `properties`
      // (alphabet, tuning, out, sound, eval). `out` (ex-`transport`) alimente TOUJOURS le champ
      // interne `properties.transport`/`TransportRef` — seul le mot ÉCRIT par l'auteur a changé.
      const setEntityRef = (key, value, params /* | null */) => {
        if (key === 'out') {
          properties.transport = { type: 'TransportRef', key: value, params: params || {} };
        } else if (key === 'sound') {
          // sound.X dans @actor X = sucre pour *:sound.X (cf. EBNF v0.8 ligne 104).
          // On enregistre la référence sur properties.sound (pour l'actorResolver)
          // ET on émet une SoundAssignment scope=actor subject=*.
          properties.sound = value;
          soundAssignments.push({
            type: 'SoundAssignment',
            scope: 'actor', actor: actorName,
            subject: '*',
            target: { kind: 'named-ref', name: value },
            line: tok.line,
          });
        } else {
          // alphabet, tuning, eval — référence simple
          properties[key] = value;
          // Valeurs d'entité (SCENE_VALUES, hub [293]) : les params collés à une
          // référence d'entité NON-`out` (ex. `tuning.western_just(diapason:432)`)
          // sont CAPTÉS ici (avant : jetés en silence) et pliés à l'émission BPx
          // (bpxAst.applySceneValues). Additif — l'encodeur BP3 les ignore. La
          // sortie garde son canal propre (params = ADRESSE, concept distinct).
          if (params) (properties.entityParams || (properties.entityParams = {}))[key] = params;
        }
      };

      // Boucle de body : actor_prop | sound_assignment | NEWLINE
      while (!atEnd()) {
        // Sauter les NEWLINEs / commentaires : autorisés en v0.8 multi-ligne
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();

        // Affectation `*:sound.X` (défaut acteur)
        if (at(T.STAR) && peek(1).type === T.COLON) {
          advance(); // *
          advance(); // :
          const target = parseSoundAssignmentTarget();
          soundAssignments.push({
            type: 'SoundAssignment',
            scope: 'actor', actor: actorName,
            subject: '*',
            target,
            line: tok.line,
          });
          continue;
        }

        // LAN-8 (canon graphie bindings d'acteur — décision hub 2026-06-26 + invocation
        // 2026-07-13) : l'alphabet SUR LA LIGNE D'ACTEUR s'écrit `@alphabet.<nom>` — le `.`
        // APPELLE le composant. C'est le SUCRE FACTORY legacy (fichier `alphabet`, entrée
        // <nom>) : canal legacy, `properties.alphabet` résolu au compile (note attribution
        // inchangée). Les provenances `@factory.`/`@mine.` NE se posent PAS sur la ligne
        // d'acteur : une hauteur perso est un libRef de SCÈNE + un acteur transport-seul
        // (décision 2026-07-13 §Raccord sortie). On les laisse donc au parseur de directives
        // (on ROMPT ici) → `@mine.…` devient une directive de scène, exactement le modèle §71.
        if (at(T.AT) && peek(1).type === T.IDENT && peek(1).value === 'alphabet'
            && peek(2).type === T.PERIOD && !peek(2).spaceBefore) {
          advance(); // @
          advance(); // alphabet
          advance(); // .
          properties.alphabet = expect(T.IDENT).value;
          continue;
        }

        if (!at(T.IDENT)) break;

        const key = current().value;
        const next = peek(1).type;

        // ─── PIERRE TOMBALE — `transport` n'existe plus sur un acteur (Romain, 2026-08-04) ───
        // Le mot est SORTI du langage : `transport` n'est plus dans `ACTOR_ENTITY_KEYS`, donc
        // sans ce garde il tomberait en silence hors de la boucle (traité comme début de règle)
        // au lieu de crier. `out` porte désormais la direction de sortie.
        if (key === 'transport' && (next === T.PERIOD || next === T.COLON) && !peek(1).spaceBefore) {
          throw new ParseError(
            `acteur '${actorName}' : 'transport' n'existe plus (décision Romain 2026-08-04) — la `
            + `direction s'écrit : 'out.<canal>' remplace 'transport.<canal>'. `
            + `Exemple : 'out.audio', 'out.midi(ch:3)'.`,
            current(),
          );
        }

        // forme v0.8 : `alphabet.X`, `tuning.X`, `octaves.X`, `out.X[(...)`, `sound.X`, `eval.X`
        // SIX clés d'entité (décision cles-acteur-six, Romain 2026-06-16).
        if (next === T.PERIOD && !peek(1).spaceBefore) {
          // Vérifier qu'on est sur une clé reconnue (sinon, sortir : c'est un
          // symbole, début de règle).
          const isEntityKey = ACTOR_ENTITY_KEYS.has(key) && key !== 'sounds';
          if (!isEntityKey) break;
          advance();           // consume key IDENT
          advance();           // consume PERIOD
          const value = expect(T.IDENT).value;
          let params = null;
          if (at(T.LPAREN) && !current().spaceBefore) params = parseRefParams();
          setEntityRef(key, value, params);
          continue;
        }

        if (next === T.COLON && !peek(1).spaceBefore) {
          // Affectation : `Sa:sound.X` ou `Sa:{ ... }`. Détection : le 3e token
          // est IDENT "sound" PERIOD IDENT (affectation), ou LBRACE (inline).
          // Ici `:` AFFECTE une valeur à un SUJET (une note) — forme légitime, conservée.
          const t3 = peek(2);
          const t4 = peek(3);
          const isSubjectSoundAssign =
              (t3.type === T.IDENT && t3.value === 'sound' &&
               t4.type === T.PERIOD)
            || (t3.type === T.LBRACE);

          if (isSubjectSoundAssign) {
            // C'est `Sa:sound.X` ou `Sa:{...}` → SoundAssignment
            const subject = advance().value; // Sa
            advance(); // :
            const target = parseSoundAssignmentTarget();
            soundAssignments.push({
              type: 'SoundAssignment',
              scope: 'actor', actor: actorName,
              subject,
              target,
              line: tok.line,
            });
            continue;
          }

          // CUTOVER graphie (Romain GO 2026-07-14, tour [411] ; décision hub 2026-06-26) :
          // une référence d'ENTITÉ (composant : alphabet, tuning, octaves, out, sound,
          // eval) se NOMME avec `.` — `.` APPELLE le composant. Le `:` n'affecte QUE des
          // valeurs (SCENE_VALUES, `sujet:sound.X`). L'ancienne forme v0.7 `alphabet:X` /
          // `out:X(...)` est REJETÉE (fail-loud) — plus AUCUNE rétrocompat, migration
          // totale (non-négociable Romain). Une sortie prend des params (canal/device) →
          // c'est un composant, pas une valeur : `out.midi(ch:3)`.
          if (ACTOR_ENTITY_KEYS.has(key)) {
            const canon = key === 'sounds' ? 'sound' : key;
            throw new ParseError(
              `'${key}:…' refusé — ':' n'affecte pas de valeur à un composant. `
              + `Écris '${canon}.<nom>'`
              + (key === 'out' ? ' avec ses params entre () — ex. out.midi(ch:3)' : '')
              + ` (règle : '.' APPELLE le composant, ':' AFFECTE une valeur).`,
              current(),
            );
          }

          // forme non-entité `sujet:valeur` (fallback historique, non-composant)
          advance();   // key
          advance();   // :
          if (at(T.IDENT)) {
            const value = advance().value;
            let params = null;
            if (at(T.LPAREN) && !current().spaceBefore) params = parseRefParams();
            // Renommage : v0.7 `sounds:` → propriété canonique `sound`
            const canonicalKey = key === 'sounds' ? 'sound' : key;
            setEntityRef(canonicalKey, value, params);
            continue;
          }
          if (at(T.INT)) { properties[key] = Number(advance().value); continue; }
          if (at(T.FLOAT)) { properties[key] = Number(advance().value); continue; }
          break;
        }

        // Sortie : token inconnu (probable début de règle)
        break;
      }

      // ENFORCEMENT modèle producteur/canal (décision Romain 2026-07-14 ; chantier hub [419]).
      // Source : hub/decisions/2026-07-14-modele-producteur-canal-eval-transport.md §Le modèle ;
      // docs/spec/EBNF.md:185-188 ; docs/spec/AST.md:230-236. Le formalisme ENFORCE le canon
      // (filet mécanique anti-régression) — sans ça le corpus dérive en silence (~45 scènes eval
      // portaient une sortie morte). Deux fail-loud au niveau du frontal (les deux voies compilent
      // via parse()) :
      //   a. un producteur `eval.<X>` sort en NATIF → il ne porte PAS de sortie routée.
      //   b. `out.video` / `out.visual` n'existent plus (axe visuel SUPPRIMÉ, pas renommé).
      if (properties.eval && properties.transport) {
        throw new ParseError(
          `acteur '${actorName}' : un producteur 'eval.${properties.eval}' sort en natif — `
          + `pas de 'out' (il produit et sort par ses propres moyens ; on ne route pas sa `
          + `sortie native). Retire le 'out' de cet acteur.`,
          tok,
        );
      }
      if (properties.transport && (properties.transport.key === 'video' || properties.transport.key === 'visual')) {
        throw new ParseError(
          `acteur '${actorName}' : 'out.${properties.transport.key}' n'existe pas — le canal `
          + `visuel a été SUPPRIMÉ (les visuels embarqués sortent en natif sur leur canvas). `
          + `Canal de sortie = audio/midi/osc uniquement.`,
          tok,
        );
      }
      // Noms de canal PÉRIMÉS (browser/webaudio — modèle profils d'environnement supprimé
      // 2026-07-16) : REJET fail-loud, PAS de normalisation (Romain : on supprime).
      if (properties.transport && deprecatedTransports().has(properties.transport.key)) {
        throw new ParseError(
          `acteur '${actorName}' : 'out.${properties.transport.key}' est un canal PÉRIMÉ `
          + `(modèle profils d'environnement abandonné 2026-07-16). Écris 'out.audio' `
          + `(canal canonique : audio/midi/osc).`,
          tok,
        );
      }
      // LISTE POSITIVE FERMÉE de sortie (décision Romain 2026-08-04, catalogue unifié
      // `lib/core.json` schema.channels) : un canal qui ne porte pas la direction `out` est
      // REFUSÉ, et le refus NOMME la direction — ex. 'out.keyboard' répond « keyboard n'est
      // pas une sortie » (keyboard ne porte que l'entrée). Ferme le trou hérité de l'ancien
      // `transport.<X>` explicite, qui acceptait tout IDENT libre côté @actor (device @devices,
      // résolu aval) : la fusion des deux catalogues applique désormais la MÊME liste fermée
      // aux deux formes (@actor explicite ET raccord `@alphabet.X:<sortie>` implicite).
      if (properties.transport && !outChannels().has(properties.transport.key)) {
        throw new ParseError(
          `acteur '${actorName}' : '${properties.transport.key}' n'est pas une sortie — les `
          + `canaux de sortie sont ${[...outChannels()].join(', ')}. La liste est FERMÉE.`,
          tok,
        );
      }
      // DIRECTION ≠ ÉCRITURE (décision Romain 2026-08-04). Un canal peut porter la sortie
      // (vérifié ci-dessus) et rester REFUSÉ à l'écriture : c'est le cas de 'text', routé comme
      // les autres sorties mais sans point d'écriture en scène. Le refus NOMME la vraie raison —
      // jamais « n'est pas une sortie », qui serait FAUX ici (`writableChannels`, lib/core.json
      // `schema.channels.<canal>.writable`).
      if (properties.transport && outChannels().has(properties.transport.key)
          && !writableChannels().has(properties.transport.key)) {
        throw new ParseError(
          `acteur '${actorName}' : 'out.${properties.transport.key}' est refusé — ce canal est `
          + `une DESTINATION de l'architecture, routée comme les autres sorties, mais son `
          + `ÉCRITURE dans une scène attend encore son appareil dédié.`,
          tok,
        );
      }
      // LANG-SONS-2 ([438], spec §2-§3) : `voice.<nom>` doit référencer une voix de lib/voices
      // (formes valides : audio = backtick typé) ; le binding alphabet→voix de l'alphabet lié
      // est validé au même point. La hauteur est STRUCTURELLE (alphabet+tuning) : une voix
      // sans tuning est LÉGITIME (percussion) — aucun couplage voice↔tuning n'est vérifié ici.
      if (properties.voice) assertVoiceRef(properties.voice, `acteur '${actorName}'`, tok);
      if (properties.alphabet) assertAlphabetVoices(properties.alphabet, tok);

      // Forme CANONIQUE v0.8 (conformité AST_SPEC §2.1, décision architecte 2026-06-17) :
      // `references: ActorReference[]` = ce que le dispatcher lit (UNE seule forme, comme .gr).
      // `properties` reste pour le pipeline interne BPScript (actorResolver/encodeur) ; BPx/.gr
      // consomment `references`. Mapping lossless (category/name/params).
      const references = [];
      const addRef = (category, name, params) => {
        if (name == null) return;
        const r = { type: 'ActorReference', category, name, line: tok.line };
        if (params && Object.keys(params).length > 0) r.params = params;
        references.push(r);
      };
      addRef('alphabet', properties.alphabet);
      addRef('tuning', properties.tuning);
      addRef('octaves', properties.octaves);
      addRef('sound', properties.sound);
      addRef('voice', properties.voice);
      if (properties.transport) addRef('transport', properties.transport.key, properties.transport.params);
      addRef('eval', properties.eval);

      return {
        type: 'ActorDirective',
        name: actorName,
        properties,
        references,
        soundAssignments: soundAssignments.length > 0 ? soundAssignments : null,
        line: tok.line,
      };
    }

    // `@sound:<X>` — REFUS, comme pour tout axe à catalogue. Ce cas doit être traité ICI, AVANT la
    // section déclarative : `@sound` est à la fois un axe-composant et un mot de SECTION, et le
    // chemin de la section happait le `:` sans passer par la garde universelle plus bas. Résultat
    // mesuré : `@sound:tabla_perc` sortait un « ligne non reconnue » générique là où `@alphabet:X`
    // nomme la faute et donne la réécriture. Un refus qui ne nomme pas la cause vaut à peine mieux
    // qu'un silence — c'est la leçon de la journée, appliquée à ma propre addition.
    if (name === 'sound' && !subkey && at(T.COLON) && peek(1).type === T.IDENT
        && (describeVocabulary().components.sound || []).includes(peek(1).value)) {
      throw new ParseError(
        `'@sound:<X>' refusé — ':' n'affecte pas de valeur à un composant. Écris '@sound.<nom>' `
        + `(règle : ':' affecte, '.' appelle).`,
        tok);
    }

    // @sound [.libname[:variant]] [{ ... }|name { ... }]+ — bloc déclaratif (v0.8)
    if (name === 'sound') {
      // À ce point, `subkey` a déjà absorbé `.libname` si présent.
      // Variante éventuelle après : `@sound.libname:variant`.
      let libVariant = null;
      if (subkey && at(T.COLON)) {
        advance();
        libVariant = expect(T.IDENT).value;
      }
      return parseSoundSection(tok.line, subkey, libVariant);
    }

    // @timepatterns: t1=1/1, t2=3/2, t3=4/3, t4=1/2
    // @duration:16b or @duration:8s or @duration:4.5s — scene duration hint
    if (name === 'duration' && at(T.COLON)) {
      advance();
      let amount;
      if (at(T.INT)) amount = Number(advance().value);
      else if (at(T.FLOAT)) amount = Number(advance().value);
      else throw new ParseError('Expected number after @duration:', current());
      // Unit: b (beats) or s (seconds), default b
      let unit = 'b';
      if (at(T.IDENT) && (current().value === 'b' || current().value === 's')) {
        unit = advance().value;
      }
      return { type: 'Directive', name, subkey, runtime: null, value: { amount, unit },
               aliases: null, modifiers: null, line: tok.line };
    }

    if (name === 'timepatterns' && at(T.COLON)) {
      advance();
      const patterns = [];
      while (at(T.IDENT)) {
        const patName = advance().value;
        expect(T.EQUALS);
        const num = expect(T.INT).value;
        expect(T.SLASH);
        const denom = expect(T.INT).value;
        patterns.push({ name: patName, ratio: `${num}/${denom}` });
        if (at(T.COMMA)) advance();
      }
      return { type: 'Directive', name, subkey, runtime: null, value: null, aliases: null,
               modifiers: null, timePatterns: patterns, line: tok.line };
    }

    // CUTOVER graphie UNIVERSEL (Romain 2026-07-14, tour [412]) : un axe-COMPOSANT (opérande =
    // nom d'entrée de catalogue : alphabet/tuning/octaves/scale) se NOMME avec `.` — `@axe.<nom>`.
    // Le `:` n'affecte QUE des valeurs (@tempo:120, @diapason:N…). On REJETTE `@axe:<X>` pour TOUT
    // axe à catalogue, sans trou. Le garde `!subkey` préserve `@alphabet.western:midi` (subkey =
    // composant résolu, puis `:` affecte une valeur). Pour tuning, `@diapason:<N>` porte la freq.
    if (catalogAxisKeys().has(name) && !subkey && at(T.COLON)) {
      const hint = name === 'tuning'
        ? " ; fréquence de référence → '@diapason:<N>' ; tuning personnel → '@mine.<chemin>.<nom>'"
        : '';
      throw new ParseError(
        `'@${name}:<X>' refusé — ':' n'affecte pas de valeur à un composant. Écris '@${name}.<nom>' `
        + `(règle : ':' affecte, '.' appelle)${hint}.`,
        current(),
      );
    }

    if (at(T.COLON)) {
      advance();
      ({ value, runtime } = parseDirectiveColonValue(name));
    }

    // '@alphabet.X:<sortie>' = sortie de l'acteur implicite (canon, décision 2026-07-05 ;
    // applyDefaultActor lit directive.runtime). LISTE POSITIVE FERMÉE (addendum ratifié Romain
    // 2026-07-16, « on n'autorise que les 3 qu'on connaît ») : suffixe ∉ {audio, midi, osc} →
    // REJET fail-loud. Couvre les périmés browser/webaudio (hint dédié), l'ancien sucre ':sc'
    // (= transport+eval sc, ABOLI par l'addendum), :video, :foo…
    if (name === 'alphabet' && subkey && runtime && !outChannels().has(runtime)) {
      const hint = deprecatedTransports().has(runtime)
        ? ` '${runtime}' est un canal PÉRIMÉ (modèle profils d'environnement abandonné 2026-07-16) — écris '@alphabet.${subkey}:audio'.`
        : runtime === 'sc'
          ? ` L'ancien sucre ':sc' (= transport+eval sc) est ABOLI — un eval se déclare sur un @actor ('eval.<X>') ; le raccord de l'acteur implicite ne nomme qu'un canal.`
          : '';
      throw new ParseError(
        `'@alphabet.${subkey}:${runtime}' refusé — le raccord de sortie de l'acteur implicite `
        + `n'accepte que {audio, midi, osc} (liste positive fermée, décision 2026-07-16).${hint}`,
        current(),
      );
    }
    // DIRECTION ≠ ÉCRITURE, même règle qu'au raccord explicite `@actor … out.<canal>` ci-dessus :
    // un canal peut être une sortie du catalogue (vérifié juste au-dessus) et rester refusé à
    // l'écriture ('text', routé mais sans point d'écriture en scène). Le refus NOMME la vraie
    // raison, jamais « n'est pas une sortie ».
    if (name === 'alphabet' && subkey && runtime && outChannels().has(runtime)
        && !writableChannels().has(runtime)) {
      throw new ParseError(
        `'@alphabet.${subkey}:${runtime}' refusé — ce canal est une DESTINATION de l'architecture, `
        + `routée comme les autres sorties, mais son ÉCRITURE dans une scène attend encore son `
        + `appareil dédié.`,
        current(),
      );
    }
    // LANG-SONS-2 ([438]) : liaison d'alphabet à la scène (acteur implicite) → même validation
    // du binding alphabet→voix qu'à la ligne d'acteur (spec §7, champ `voices` de l'alphabet).
    if (name === 'alphabet' && subkey) assertAlphabetVoices(subkey, current());

    // Mode modifiers: @mode:random(destru, smooth, mm:60)
    let modifiers = null;
    if (name === 'mode' && at(T.LPAREN)) {
      advance();
      modifiers = [];
      while (!at(T.RPAREN) && !atEnd()) {
        // Alias @mode:X(tempo:N) → mm (BPx lit mm ; cf. normalisation top-level plus haut).
        const rawModName = expect(T.IDENT).value;
        const modName = rawModName === 'tempo' ? 'mm' : rawModName;
        let modValue = true;
        if (at(T.COLON)) {
          advance();
          if (at(T.INT)) modValue = Number(advance().value);
          else if (at(T.FLOAT)) modValue = Number(advance().value);
          else if (at(T.IDENT)) modValue = advance().value;
        }
        modifiers.push({ name: modName, value: modValue });
        if (at(T.COMMA)) advance();
      }
      expect(T.RPAREN);
    } else if (at(T.LPAREN)) {
      // Alias resolution: @western(A:La)
      advance();
      aliases = [];
      while (!at(T.RPAREN) && !atEnd()) {
        const from = expect(T.IDENT).value;
        expect(T.COLON);
        const to = expect(T.IDENT).value;
        aliases.push({ type: 'Alias', from, to });
        if (at(T.COMMA)) advance();
      }
      expect(T.RPAREN);
    }

    // v0.8 — corps de `@alphabet.X` : peut contenir des `*:sound.X` et
    // `Sa:sound.X` (sound_assignment) et le binding `notes: Sa Re ga ...`.
    // EBNF Couche 1 § alphabet_section (étendu v0.8).
    // Sortie : tableau d'AlphabetSoundAssignments si présents.
    if (name === 'alphabet' && subkey) {
      const assignments = [];
      while (!atEnd()) {
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();

        // *:sound.X
        if (at(T.STAR) && peek(1).type === T.COLON) {
          const line = current().line;
          advance(); advance(); // * :
          const target = parseSoundAssignmentTarget();
          assignments.push({
            type: 'SoundAssignment',
            scope: 'alphabet', alphabet: subkey,
            subject: '*',
            target,
            line,
          });
          continue;
        }

        // IDENT:sound.X (affectation par note) — distinguer d'un terminal LHS de règle.
        // Heuristique : `IDENT:` n'est PAS une affectation sound si le 3e
        // token n'est pas `sound` ou `{`. (Une règle commence par `IDENT IDENT* ARROW`,
        // or aucun IDENT ne peut être suivi de COLON dans une LHS de règle.)
        if (at(T.IDENT) && peek(1).type === T.COLON) {
          const t3 = peek(2);
          const t4 = peek(3);
          const isSoundAssign =
              (t3.type === T.IDENT && t3.value === 'sound' && t4.type === T.PERIOD)
            || (t3.type === T.LBRACE);
          if (isSoundAssign) {
            const line = current().line;
            const subject = advance().value;
            advance(); // :
            const target = parseSoundAssignmentTarget();
            assignments.push({
              type: 'SoundAssignment',
              scope: 'alphabet', alphabet: subkey,
              subject,
              target,
              line,
            });
            continue;
          }
          // notes: Sa Re ga ma Pa dha ni — déclaration de notes (v0.8 EBNF).
          // Pas porté en ce milestone (les notes sont calculées via lib JSON) :
          // on consomme silencieusement la ligne pour ne pas casser le flow.
          if (current().value === 'notes') {
            advance(); advance(); // notes :
            while (at(T.IDENT)) advance();
            continue;
          }
        }

        break;
      }
      const dirNode = { type: 'Directive', name, subkey, runtime, value, aliases, modifiers, line: tok.line };
      if (assignments.length > 0) {
        // On retourne un nœud composite : le caller détecte AlphabetSoundAssignments
        // et l'ajoute à scene.soundAssignments tout en gardant la Directive.
        return {
          type: 'AlphabetSoundAssignments',
          directive: dirNode,
          assignments,
          line: tok.line,
        };
      }
      return dirNode;
    }

    // Rejet franc (arbitrage utilisateur 2026-06-11, durci le même jour) :
    // les directives de production s'écrivent en bloc [@clé:valeur] —
    // la @-forme historique est une erreur qui pointe la nouvelle écriture.
    if (!subkey && PRODUCTION_DIRECTIVES.includes(name)) {
      const suggestion = value !== null ? `:${value}` : (runtime ? `:${runtime}` : '');
      throw new ParseError(`Directive '@${name}' retirée — écrire [@${name}${suggestion}] (bloc de production)`, tok);
    }

    return { type: 'Directive', name, subkey, runtime, value, aliases, modifiers, line: tok.line };
  }

  // ============================================================
  // CV Instances — déclaration descriptive : `cv env1 : mod.adsr(...)`
  // (parsée dans parseDeclaration via parseCVModulator ; branchement au point de paramètre)
  // ============================================================

  // ============================================================
  // Declarations
  // ============================================================

  function parseDeclaration() {
    const tok = current();
    const temporalType = advance().value; // gate | trigger | cv
    const name = expect(T.IDENT).value;
    expect(T.COLON);
    // Déclaration de MODULATEUR CV (design Romain 2026-06-20) : `cv env1 : mod.adsr(...)` ou
    // `cv env1 : `js: …``. Purement descriptive — AUCUNE cible/route (le branchement se fait
    // au point de paramètre `(cutoff: env1)`). À distinguer de la double-déclaration temporelle
    // `cv ramp:sc` (type temporel + runtime) par le lookahead : lib.type( … ) ou backtick.
    if (temporalType === 'cv' && isCVModulatorBody()) {
      return parseCVModulator(name, tok);
    }
    const runtime = expect(T.IDENT).value;
    return { type: 'Declaration', temporalType, name, runtime, line: tok.line };
  }

  /** Le corps après `cv NAME :` est-il un modulateur (lib.type(...) ou backtick) ? */
  function isCVModulatorBody() {
    if (at(T.BACKTICK)) return true;
    // IDENT . IDENT (   → lib.objectType(params)
    return at(T.IDENT) && peek(1).type === T.PERIOD &&
           peek(2).type === T.IDENT && peek(3).type === T.LPAREN;
  }

  /**
   * Parse le corps d'un modulateur CV : `mod.adsr(params)` ou backtick inline.
   * Forme déclarative pure : pas de cible, pas de sortie (résolus au branchement).
   * @returns CVInstance { name, lib, objectType, args, namedArgs, code }
   */
  function parseCVModulator(name, tok) {
    // Backtick : `cv custom : `js: …`` — tag OBLIGATOIRE (langage de la courbe).
    if (at(T.BACKTICK)) {
      const btTok = current();
      const { tag, code } = splitBacktickTag(advance().value, btTok);
      return {
        type: 'CVInstance', name,
        lib: null, objectType: 'backtick', args: [], namedArgs: {},
        tag, code, line: tok.line,
      };
    }
    // lib.objectType(args…)
    const lib = expect(T.IDENT).value;
    expect(T.PERIOD);
    const objectType = expect(T.IDENT).value;
    expect(T.LPAREN);
    const args = [];
    const namedArgs = {};
    while (!at(T.RPAREN) && !atEnd()) {
      if (at(T.IDENT) && peek(1).type === T.COLON) {
        const key = advance().value;
        advance(); // :
        const val = at(T.INT) ? Number(advance().value) :
                    at(T.FLOAT) ? Number(advance().value) :
                    at(T.IDENT) ? advance().value :
                    advance().value;
        namedArgs[key] = val;
      } else {
        // ARGUMENT POSITIONNEL — refusé, comme partout ailleurs dans le langage (décision Romain
        // 2026-07-26). Cette sous-zone y avait échappé : la déclaration d'un modulateur n'est pas
        // un sac de contrôle, donc la garde des sacs ne la voyait pas. Aucune sous-zone du langage
        // n'échappe à la règle.
        // ⚠️ La forme NOMMÉE reste la bonne — `mod.adsr(attack:5, decay:150)`, comme
        // `out.midi(ch:3)`. Ce n'est pas la parenthèse qu'on supprime, c'est l'argument dont
        // la place tient lieu de nom. Mesuré : le corpus n'écrit QUE la forme nommée, 0 positionnel.
        const t = current();
        // Les paramètres vivent sous `objects.<type>.parameters` (lib/mod.json) ; on les nomme dans
        // le message pour que l'utilisateur n'ait pas à les deviner. Silencieux si la lib n'est pas
        // chargée — un message générique vaut mieux qu'un message faux.
        const defObj = loadLib(lib)?.objects?.[objectType] || loadLib(lib, objectType);
        const params = Object.keys(defObj?.parameters || {});
        throw new ParseError(
          `'${lib}.${objectType}(${t.value}…)' : argument POSITIONNEL — sa place tient lieu de nom. `
          + `Nommer chaque paramètre : '${lib}.${objectType}(`
          + `${params.length ? params.slice(0, 2).map((k) => `${k}:…`).join(', ') + (params.length > 2 ? ', …' : '') : 'nom:valeur'})'`,
          t);
      }
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);
    return {
      type: 'CVInstance', name, lib, objectType, args, namedArgs, code: null, line: tok.line,
    };
  }

  // ============================================================
  // Câblage (modules à ports, opérateurs >> / \>>) — corps de @macro ET flux d'une règle
  // ============================================================

  // Le corps d'un @macro est un CÂBLAGE (Wiring) ssi il porte >> ou \>> avant le saut de ligne.
  // Le parser NE CLASSE PAS son-vs-substitution (décision [489], PORTER≠RÉSOUDRE) : hors câblage,
  // le corps est émis STRUCTUREL et OPAQUE (appel-composant via le point, ou symboles nus) ; la
  // classe (module=son / acteur=hauteur / homo=substitution) est décidée à la RÉSOLUTION (aval).
  // Un `!` du FLUX ouvre-t-il un câblage ? On regarde ce qui suit, jusqu'à la fin de l'élément.
  //
  // La borne est le POINT D'EXCLAMATION SUIVANT autant que la fin de ligne : sans elle,
  // `C4 !dha !osc >> filtre` lirait le premier `!dha` comme le début d'un câblage, parce qu'un
  // chevron traîne plus loin sur la ligne. Chaque instantané s'arrête où commence le suivant.
  function fluxIsWiring(from = pos) {
    if (tokens[from]?.type === T.WIRE_CUT) return true;   // `!\>> out.in` — coupure sans étage amont
    let j = from;
    while (j < tokens.length) {
      const t = tokens[j].type;
      if (t === T.NEWLINE || t === T.EOF || t === T.SEPARATOR || t === T.COMMENT) return false;
      if (t === T.BANG) return false;  // l'élément suivant commence : ce `!`-ci n'était pas un câblage
      if (t === T.WIRE || t === T.WIRE_CUT) return true;
      j++;
    }
    return false;
  }

  function bodyIsWiring() {
    if (at(T.WIRE) || at(T.WIRE_CUT)) return true;
    let j = pos;
    while (j < tokens.length) {
      const t = tokens[j].type;
      if (t === T.NEWLINE || t === T.EOF || t === T.SEPARATOR) return false;
      if (t === T.WIRE || t === T.WIRE_CUT) return true;
      j++;
    }
    return false;
  }

  // Valeur affectée à un port (`: <valeur>`) : nombre (+unité collée), référence
  // (ident, ex. `pitch`), ou backtick typé (ex. `` `js: lfo(2)` ``).
  function parseWireValue() {
    if (at(T.BACKTICK)) {
      const raw = advance().value;
      const t = tryBacktickTag(raw);
      return t ? { kind: 'backtick', tag: t.tag, code: t.code } : { kind: 'backtick', tag: null, code: raw };
    }
    if (at(T.INT)) {
      const n = Number(advance().value);
      if (at(T.IDENT) && !current().spaceBefore) return { kind: 'number', value: n, unit: advance().value };
      return { kind: 'number', value: n };
    }
    if (at(T.IDENT)) return { kind: 'ref', name: advance().value };
    throw new ParseError('valeur de câblage attendue après « : »', current());
  }

  // Un étage de câblage : `module (. port)? (: valeur)?`. `cut` = le lien qui l'atteint
  // est un `\>>` (débranchement) plutôt qu'un `>>` (câbler).
  function parseWireStage(cut) {
    const line = current().line;
    const module = expect(T.IDENT).value;
    let port = null, value = null;
    if (at(T.PERIOD) && !current().spaceBefore && peek(1).type === T.IDENT) {
      advance(); // consume PERIOD
      port = advance().value;
    }
    if (at(T.COLON) && !current().spaceBefore) {
      advance(); // consume COLON
      value = parseWireValue();
    }
    return { module, port, value, cut };
  }

  // Câblage complet : `[\>>] stage ((>> | \>>) stage)*`. Une LIGNE = une chaîne série
  // (longueur quelconque, précision Romain) ; le multi-ligne (plusieurs @macro du même
  // nom) sert au parallélisme. `>>` câble, `\>>` coupe (patchbay dynamique).
  function parseWiring(line) {
    const stages = [];
    let cut = false;
    if (at(T.WIRE_CUT)) { cut = true; advance(); }
    stages.push(parseWireStage(cut));
    while (at(T.WIRE) || at(T.WIRE_CUT)) {
      const linkCut = at(T.WIRE_CUT);
      advance();
      stages.push(parseWireStage(linkCut));
    }
    return { type: 'Wiring', cut, stages, line };
  }

  // ============================================================
  // Macros
  // ============================================================

  function isLookaheadMacro() {
    // name ( params ) = ...
    let j = pos;
    if (tokens[j]?.type !== T.IDENT) return false;
    j++;
    if (tokens[j]?.type !== T.LPAREN) return false;
    // Skip until )
    let depth = 1;
    j++;
    while (j < tokens.length && depth > 0) {
      if (tokens[j].type === T.LPAREN) depth++;
      if (tokens[j].type === T.RPAREN) depth--;
      j++;
    }
    return tokens[j]?.type === T.EQUALS;
  }

  /**
   * Collecte tous les identifiants MENTIONNÉS dans un corps de macro : noms de
   * symboles/acteurs/tags, valeurs littérales chaîne (param passé en valeur d'arg,
   * ex. `C4(vel:x)`), et mots d'un backtick (substitution textuelle dans le code).
   * Volontairement LARGE : on veut « le param apparaît-il quelque part ? » — la
   * leniency évite de rejeter une macro valide (un faux positif casserait le langage).
   */
  function macroBodyMentions(body) {
    const names = new Set();
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { for (const el of n) walk(el); return; }
      for (const key of ['name', 'symbol', 'actor', 'tag']) {
        if (typeof n[key] === 'string') names.add(n[key]);
      }
      if (n.type === 'Literal' && typeof n.value === 'string') names.add(n.value);
      if (typeof n.code === 'string') {
        for (const w of n.code.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []) names.add(w);
      }
      for (const k in n) { if (n[k] && typeof n[k] === 'object') walk(n[k]); }
    };
    walk(body);
    return names;
  }

  /**
   * FAIL-LOUD (Romain confirmé, hub [296]) : une macro dont un paramètre déclaré
   * n'apparaît JAMAIS dans le corps est MALFORMÉE — jamais un `continue` silencieux
   * qui la transforme en note muette. Une macro est une SUBSTITUTION TEXTUELLE
   * (EBNF §macro, l.59/273 ; « les params doivent apparaître dans le rhs », cf.
   * `@macro accent(x)=x(vel:120)`). Le cas vécu `wobble(Bass, browser) = \`courbe\``
   * (forme CV/signal `name(cible, transport)=courbe`) n'est PAS une macro valide :
   * sa syntaxe est en attente d'arbitrage Romain (A/B) — d'ici là, elle CRIE.
   */
  function checkMacroParamsUsed(macroName, params, body, tok) {
    if (!params || params.length === 0) return;
    const used = macroBodyMentions(body);
    const unused = params.filter((p) => !used.has(p));
    if (unused.length > 0) {
      throw new ParseError(
        `Macro '${macroName}' : paramètre(s) déclaré(s) mais absent(s) du corps : `
        + `${unused.join(', ')}. Une macro est une substitution textuelle `
        + `(EBNF §macro l.59/273) — chaque paramètre DOIT apparaître dans le corps `
        + `(ex. accent(x) = x(vel:120)). Une déclaration name(cible, transport) = courbe `
        + `(forme CV/signal) n'est pas une macro valide : syntaxe en attente d'arbitrage.`,
        tok);
    }
  }

  function parseMacro() {
    const tok = current();
    const name = expect(T.IDENT).value;
    expect(T.LPAREN);
    const params = [];
    while (!at(T.RPAREN) && !atEnd()) {
      params.push(expect(T.IDENT).value);
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);
    expect(T.EQUALS);
    const body = parseRhsElements();
    checkMacroParamsUsed(name, params, body, tok);
    return { type: 'Macro', name, params, body, line: tok.line };
  }

  // ============================================================
  // Backtick orphan
  // ============================================================

  /**
   * Sépare le TAG de langage (clé d'interprète) du CODE d'un backtick, SI présent.
   * Le tag = un identifiant AVANT le premier `:` (`js:`, `sc:`, `python:`…). Retourne
   * `null` si aucun tag valide (le `:` est alors dans le code, ou il n'y en a pas).
   */
  function tryBacktickTag(raw) {
    const colonIdx = raw.indexOf(':');
    const tag = colonIdx > 0 ? raw.slice(0, colonIdx).trim() : '';
    if (!/^[A-Za-z][\w+-]*$/.test(tag)) return null;
    return { tag, code: raw.slice(colonIdx + 1).trim() };
  }

  /**
   * Comme `tryBacktickTag`, mais le tag est OBLIGATOIRE : sites ORPHELINS où AUCUN
   * héritage de langage n'est possible (backtick top-level, courbe `cv NAME : …`).
   * Décision hub 2026-07-04-cv-curve-syntaxe-backtick-type.md + AJUSTEMENT [299] :
   * le langage doit TOUJOURS être connu (tag OU eval d'acteur déclaré, jamais deviné) ;
   * hors acteur-à-eval, seul le tag le donne → erreur claire sinon. Les backticks de
   * FLUX (RHS/arg) sous un `@actor …eval.X` héritent de X (résolu en aval, annotateBackticks).
   */
  function splitBacktickTag(raw, tok) {
    const t = tryBacktickTag(raw);
    if (!t) {
      throw new ParseError(
        `Backtick orphelin sans tag de langage : \`${raw.slice(0, 30)}${raw.length > 30 ? '…' : ''}\` — le `
        + `TAG d'interprète est OBLIGATOIRE hors voix-code d'acteur (ex. \`js: …\`, \`sc: …\`, `
        + `\`python: …\`). Jamais de langage deviné (décision CV-curve 2026-07-04 + [299]).`,
        tok);
    }
    return t;
  }

  function parseBacktickOrphan() {
    const tok = current();
    const raw = expect(T.BACKTICK).value;
    const { tag, code } = splitBacktickTag(raw, tok);
    return { type: 'BacktickOrphan', tag, code, line: tok.line };
  }

  // ============================================================
  // v0.8 — Sons : prototypes et affectations
  // ============================================================

  /**
   * Parse une liste de paires `key:value, key:value, key` (booléen nu).
   * Suppose que `{` est déjà consommé ; consomme jusqu'à `}` inclus.
   * Référence EBNF : Couche 1 § sound_section, `prop_pairs`.
   */
  function parsePropPairs() {
    const props = {};
    while (!at(T.RBRACE) && !atEnd()) {
      if (at(T.NEWLINE) || at(T.COMMENT)) { advance(); continue; }
      if (at(T.COMMA)) { advance(); continue; }
      const key = expect(T.IDENT).value;
      // Booléen nu : `{ breakTempo, contBeg }` ≡ `breakTempo:true, contBeg:true`
      if (!at(T.COLON)) {
        props[key] = true;
        continue;
      }
      advance(); // :
      // Valeur : INT, FLOAT, STRING, IDENT, ou INT/INT (ratio)
      let val;
      if (at(T.REST)) {
        // valeur négative : `transpose:-12`
        advance();
        if (at(T.INT)) val = -Number(advance().value);
        else if (at(T.FLOAT)) val = -Number(advance().value);
        else throw new ParseError('Expected number after - in prop value', current());
      } else if (at(T.INT)) {
        const num = advance().value;
        if (at(T.SLASH) && peek(1).type === T.INT) {
          advance();
          val = `${num}/${advance().value}`;
        } else {
          val = Number(num);
        }
      } else if (at(T.FLOAT)) {
        val = Number(advance().value);
      } else if (at(T.STRING)) {
        val = advance().value;
      } else if (at(T.IDENT)) {
        const id = advance().value;
        // Promotion canonique : booléens littéraux en string → booléen JS.
        if (id === 'true') val = true;
        else if (id === 'false') val = false;
        else val = id;
      } else {
        throw new ParseError('Expected value (INT/FLOAT/STRING/IDENT) in prop pair', current());
      }
      props[key] = val;
    }
    return props;
  }

  /**
   * Parse une cible d'affectation son : `sound.NAME` ou `{ props }`.
   * Référence EBNF v0.8 § sound_assignment, sound_target.
   */
  function parseSoundAssignmentTarget() {
    // Bloc inline anonyme : `Sa:{ dur:300 }`
    if (at(T.LBRACE)) {
      advance();
      const props = parsePropPairs();
      expect(T.RBRACE);
      return { kind: 'inline-props', props };
    }
    // Référence nommée : `Sa:sound.bell_short` (v0.8 canonique).
    // Rétrocompat v0.7 : on accepte aussi `Sa:NAME` nu (sucre = sound.NAME).
    const first = expect(T.IDENT).value;
    if (first === 'sound' && at(T.PERIOD)) {
      advance();
      const name = expect(T.IDENT).value;
      return { kind: 'named-ref', name };
    }
    // Cas rétrocompat : `Sa:bell_short` (forme v0.7 sans namespace explicite).
    return { kind: 'named-ref', name: first };
  }

  /**
   * Parse la section `@sound` (ou `@sound.libname[:variant]`).
   *
   * Forme EBNF v0.8 :
   *   sound_section = "@" "sound" [ "." IDENT [ ":" IDENT ] ] NEWLINE sound_entry+
   *   sound_entry   = anonymous_prototype | named_prototype
   *   anonymous_prototype = "{" prop_pairs "}"
   *   named_prototype     = IDENT "{" prop_pairs "}"
   *
   * À l'entrée : tous les tokens jusqu'au `@sound` + subkey éventuel + variant
   * éventuel ont été consommés. On parse maintenant le bloc d'entrées qui suit.
   */
  function parseSoundSection(line, lib, libVariant) {
    const prototypes = [];

    // Si lib spécifiée : `@sound.libname` charge une lib externe ; aucun
    // bloc inline obligatoire. On accepte des entrées si elles existent
    // (ex : surcharge locale après chargement).
    // Sinon : bloc inline obligatoire (sons anonymes/nommés).

    // Sauter le NEWLINE après `@sound` ou `@sound.lib`.
    while (at(T.NEWLINE) || at(T.COMMENT)) advance();

    // Boucle d'entrées : tant qu'on voit `{` (anonyme) ou `IDENT {` (nommé).
    while (!atEnd()) {
      // Entrée anonyme : `{ ... }`
      if (at(T.LBRACE)) {
        advance();
        const config = parsePropPairs();
        expect(T.RBRACE);
        prototypes.push({ type: 'SoundPrototype', name: null, config, line });
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        continue;
      }
      // Entrée nommée : `IDENT { ... }`
      if (at(T.IDENT) && peek(1).type === T.LBRACE) {
        const protoName = advance().value;
        advance(); // {
        const config = parsePropPairs();
        expect(T.RBRACE);
        prototypes.push({ type: 'SoundPrototype', name: protoName, config, line });
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        continue;
      }
      // Fin de bloc — token suivant n'appartient pas à @sound.
      break;
    }

    return {
      type: 'SoundSection',
      lib: lib || null,
      libVariant: libVariant || null,
      prototypes,
      line,
    };
  }

  /**
   * Parse une affectation `subject:sound_target` ou `*:sound_target`
   * dans un corps d'alphabet ou d'acteur. Retourne le nœud
   * SoundAssignmentAST sans champ `scope` (rempli par l'appelant).
   *
   * Le cas particulier `Sa:sound.X` est distingué d'un terminal `Sa` suivi
   * d'une déclaration de type — l'appelant doit faire le lookahead.
   */
  function parseSoundAssignmentLocal(line) {
    let subject;
    if (at(T.STAR)) { advance(); subject = '*'; }
    else subject = expect(T.IDENT).value;
    expect(T.COLON);
    const target = parseSoundAssignmentTarget();
    return { type: 'SoundAssignment', subject, target, line };
  }

  // ============================================================
  // Couche 2 — Subgrammars
  // ============================================================

  function parseSubgrammars(initialMode, initialModifiers) {
    const subs = [];
    let index = 1;
    let safety = 0;
    let currentMode = initialMode || null;
    let currentModifiers = initialModifiers || null;

    while (!atEnd()) {
      if (++safety > 200) throw new ParseError('Subgrammar parse loop safety limit', current());
      skipNewlines();
      if (atEnd()) break;

      // Bloc de production hors en-tête : erreur franche (la place niveau
      // règle/sous-grammaire n'est pas dans la décision 2026-06-11), plutôt
      // qu'une troncature silencieuse de la scène.
      if (atProductionBlock()) {
        throw new ParseError(`Bloc de production [@…] : autorisé en en-tête de scène uniquement`, current());
      }
      // ![@…] : réserve de composition future (re-semer PENDANT le jeu,
      // hub/principes-syntaxe.md §3) — non implémentée. Erreur franche plutôt
      // que l'absorption silencieuse de la scène.
      if (at(T.BANG) && peek(1).type === T.LBRACKET && peek(2).type === T.AT) {
        throw new ParseError(`Forme '![@…]' réservée (directive de production dans le flux) — non implémentée`, current());
      }

      // Parse @mode:X(modifiers) directive at the start of a sub-grammar block
      // Stop if @template — that's a separate section after all subgrammars
      // `currentMode` ne porte QUE le @mode du bloc courant : il est remis à zéro à la fin
      // de chaque sous-grammaire (voir plus bas). On le lit ici parce que le @mode de la
      // PREMIÈRE sous-grammaire est consommé en amont, hors de la boucle @ ci-dessous.
      let blockMode = currentMode;
      let blockModifiers = currentModifiers;
      while (at(T.AT)) {
        // La section template est en SINGULIER, sans alias (cf. parseScene).
        if (peek(1).type === T.IDENT && peek(1).value === 'template') break;
        // Refus NOMMÉ de l'ex-graphie plurielle : c'est ICI qu'on la voit passer. Sans ce
        // branchement, elle tomberait dans le rejet générique des directives inconnues et
        // rendrait « ligne non reconnue » — un message qui ressemble à une coquille et n'aide
        // personne à migrer.
        if (peek(1).type === T.IDENT && peek(1).value === 'templates') {
          throw new ParseError(`'@templates' (pluriel, v0.7) n'existe plus — écrire '@template' (singulier)`, peek(1));
        }
        const dirTok = current();
        // Le NOM se lit sur le jeton, pas sur le nœud produit : certaines directives (`@var`…)
        // rendent un nœud sans champ `name`, et le message annonçait alors « @undefined » — un
        // refus qui ne nomme pas la faute vaut à peine mieux qu'un silence.
        const dirNom = peek(1) && peek(1).value ? String(peek(1).value) : '?';
        const dir = parseDirective();
        if (dir.name === 'mode' && dir.runtime) {
          blockMode = dir.runtime;  // @mode:random → runtime='random'
          currentMode = blockMode;  // portée du bloc courant seulement (pas d'héritage)
          blockModifiers = dir.modifiers || null;
          currentModifiers = blockModifiers;
        } else if (dir.name !== 'mode') {
          // ⚠️ ELLES ÉTAIENT PARSÉES PUIS JETÉES — SANS UN MOT (Romain, 2026-07-29).
          //
          // Ce `while` lisait toute directive posée entre deux blocs de règles et ne gardait que
          // `@mode`. Les autres étaient construites, puis abandonnées ici même : l'auteur écrivait
          // `@var v` ou `@alphabet.sargam`, la scène compilait sans une erreur, et RIEN n'avait été
          // déclaré. C'est le mode d'échec de la flèche du moteur historique, en pire — là au moins
          // ça ne compilait pas.
          //
          // MESURÉ, ET C'EST L'ESPACE QUI COMPTE, PAS LA FORME DU TICKET : le signalement portait
          // sur `@var`. Le balayage des directives réservées en trouve VINGT-QUATRE dans le même
          // cas — alphabet, tuning, octaves, transport, eval, actor, controls, var, in, alias, mm,
          // tempo, duration, meter, quantization, qclock, transpose, diapason, transcription,
          // settings, filter, modulation, ins, test_alphabets. Garder la seule forme signalée aurait
          // laissé vivre les vingt-trois autres.
          //
          // ⚠️ ET `@mode` RESTE LÉGITIME ICI, ce n'est pas une exception de complaisance : il porte
          // le mode de la sous-grammaire QUI SUIT, et 67 scènes du corpus sur 263 en vivent. Un
          // refus en bloc les aurait toutes cassées — la même faute que le témoin qui aurait refusé
          // 120 scènes sur 333 le 2026-07-28. Le corpus a été mesuré AVANT d'écrire ce refus : une
          // seule scène y perd quelque chose (`bells.bps`, trois directives aujourd'hui muettes).
          throw new ParseError(
            `'@${dirNom}' est écrit APRÈS des règles, et à cette place il ne déclare RIEN : `
            + `il était accepté puis jeté en silence. Les déclarations précèdent les règles — `
            + `remonter cette ligne avant la première règle de la scène. `
            + `(Seul '@mode' se place ici : il gouverne la sous-grammaire qui suit.)`,
            dirTok,
          );
        }
        skipNewlines();
      }

      const rules = [];
      let ruleSafety = 0;
      while (!atEnd() && !at(T.SEPARATOR)) {
        if (++ruleSafety > 200) throw new ParseError('Rule parse loop safety limit', current());
        skipNewlines();
        if (atEnd() || at(T.SEPARATOR)) break;
        if (isRuleStart()) {
          rules.push(parseRule());
        } else {
          // Seuls EOF, `-----` et `@…` terminent légitimement un bloc de règles. Tout
          // autre jeton ici serait une TRONCATURE SILENCIEUSE de la scène (la boucle
          // sortait, `rules` restait vide, la grammaire disparaissait sans une erreur).
          // Erreur franche — même parti que le bloc de production `[@…]` ci-dessus.
          if (!atEnd() && !at(T.SEPARATOR) && !at(T.AT)) {
            throw new ParseError(`ligne non reconnue au niveau des règles : attendu une règle, '@directive', '-----' ou la fin de la scène`, current());
          }
          break;
        }
        skipNewlines();
      }

      if (rules.length > 0) {
        subs.push({ type: 'Subgrammar', index: index++, rules, mode: blockMode, modifiers: blockModifiers });
      } else if (at(T.SEPARATOR)) {
        // BLOC VIDE, MAIS LA SCÈNE CONTINUE APRÈS LE `-----`.
        //
        // Ici se trouvait un `break` qui arrêtait TOUT le parcours des sous-grammaires. Une
        // scène commençant par un séparateur (directives, `-----`, puis les règles) perdait
        // donc l'INTÉGRALITÉ de ses règles, sans une erreur ni un avertissement : l'AST
        // sortait avec zéro sous-grammaire et l'encodeur rendait un en-tête nu.
        // Mesuré sur Mozartexpression : 373 lignes en entrée, 0 erreur, 47 octets en sortie.
        //
        // Un bloc vide ne porte rien — le sauter ne perd rien. Ce qui était inacceptable,
        // c'est qu'il emporte tout ce qui le suit. On avance donc d'un séparateur et on
        // continue ; le `break` ne subsiste que pour la vraie fin de scène, ci-dessous.
        advance();
        skipNewlines();
        currentMode = null;
        continue;
      } else {
        break; // Plus de règles ET plus de séparateur → fin légitime de la scène.
      }

      // Le mode NE S'HÉRITE PAS d'une sous-grammaire à l'autre : BP3 repart du défaut
      // (RNDtype) à CHAQUE sous-grammaire et ne l'écrase que si un mot-clé de mode est
      // présent — CompileGrammar.c:1427 (défaut) puis :1488 (override conditionnel),
      // zéro héritage inter-bloc. Laisser `currentMode` persister faisait fuiter le mode
      // d'un bloc @mode:ord vers les blocs SUIVANTS sans @mode, qui doivent rester au
      // défaut. Mesuré sur asymmetric1 : sous-gram 6 en ORD au lieu de RND décalait les
      // tirages aléatoires. Réfute « ORD explicite ≡ héritage implicite » (bpx [613]).
      currentMode = null;

      if (at(T.SEPARATOR)) {
        advance();
        skipNewlines();
      }
    }

    return subs;
  }

  // ============================================================
  // Templates section
  // ============================================================

  function parseTemplateSection() {
    expect(T.AT);       // @
    const kw = expect(T.IDENT);    // template — SINGULIER, sans alias
    // Le refus NOMMÉ de l'ex-graphie plurielle ne vit PAS ici : `@templates` n'atteint jamais
    // cette fonction (l'appelant ne l'invoque que sur `template`). Il est posé dans la boucle
    // de sous-grammaires, seul point où la forme est réellement vue. Écrit ici, il aurait été
    // du code mort qui rassure — le contraire d'un fail-loud.
    if (kw.value !== 'template') {
      throw new ParseError(`Expected 'template' after @`, kw);
    }
    skipNewlines();

    const entries = [];
    while (!atEnd()) {
      skipNewlines();
      if (atEnd()) break;
      if (!at(T.LBRACKET)) break;

      // [N] scale body
      expect(T.LBRACKET);
      const index = Number(expect(T.INT).value);
      expect(T.RBRACKET);

      // Scale factor: /N or *N/N
      let scale;
      if (at(T.SLASH)) {
        advance();
        scale = '/' + expect(T.INT).value;
      } else if (at(T.STAR)) {
        advance();
        const num = expect(T.INT).value;
        expect(T.SLASH);
        const denom = expect(T.INT).value;
        scale = '*' + num + '/' + denom;
      } else {
        scale = '/1';  // default
      }

      // Template body — until newline/EOF
      const body = parseTemplateBody();
      entries.push({ type: 'TemplateEntry', index, scale, body });
      skipNewlines();
    }
    return entries;
  }

  function parseTemplateBody() {
    const elements = [];
    while (!atAny(T.NEWLINE, T.EOF, T.RPAREN)) {
      // Wildcard: ? or ????
      if (at(T.QUESTION)) {
        let count = 0;
        while (at(T.QUESTION)) { advance(); count++; }
        // `?N` (numéroté) n'a de sens que dans une RÈGLE : le numéro unifie avec la
        // flèche qui rejoue le choix (`$X`/`&X` gabarit). Une ligne de catalogue n'a
        // pas de flèche — décision 2026-08-04 (« Le `?` est un wildcard ; `$X`/`&X`
        // restent des gabarits », `hub/decisions/2026-08-04-le-signe-interrogation-
        // est-un-wildcard-le-gabarit-garde-capturer.md ») : « les mêmes `?` que dans
        // une règle, un par terminal effacé, et toujours ANONYMES : une ligne de
        // catalogue n'a pas de flèche, donc rien à rejouer et pas de numéro. »
        //
        // Avant ce refus, `?N` ici n'était atteint par AUCUNE branche : le `?` était
        // compté comme wildcard nu, puis l'INT restant ne correspondait à aucun cas
        // du `if/else if` ci-dessous → le `else break` final sortait de la boucle EN
        // SILENCE, tronquant tout le reste de la ligne de catalogue sans une erreur.
        // Mesuré : `[1] /1 ?1 ? .` ne gardait qu'un seul `TemplateWildcard`, ' ? .'
        // disparaissait de l'AST sans warning ni erreur.
        if (at(T.INT)) {
          throw new ParseError(
            `'?${current().value}' : un wildcard numéroté n'a de sens que dans une règle `
            + `(le numéro unifie avec la flèche, qui rejoue le choix). Une ligne de catalogue `
            + `@template n'a pas de flèche — ses wildcards sont toujours anonymes ('?'), jamais numérotés.`,
            current(),
          );
        }
        elements.push({ type: 'TemplateWildcard', count });
      }
      // Period
      else if (at(T.PERIOD)) {
        advance();
        elements.push({ type: 'TemplatePeriod' });
      }
      // Bracket: ($N body)
      else if (at(T.LPAREN)) {
        advance();
        expect(T.DOLLAR);
        const idx = Number(expect(T.INT).value);
        const body = parseTemplateBody();  // recursive — stops at RPAREN
        expect(T.RPAREN);
        elements.push({ type: 'TemplateBracket', index: idx, body });
      }
      else {
        break;
      }
    }
    return elements;
  }

  function isRuleStart() {
    // A rule starts with: [guard] | IDENT | # | ( | ? | | | { | } | , | - | $
    const t = current().type;
    return t === T.IDENT || t === T.HASH ||
           t === T.LPAREN || t === T.QUESTION || t === T.PIPE ||
           t === T.LAMBDA || t === T.LBRACE || t === T.RBRACE || t === T.COMMA ||
           t === T.REST || t === T.DOLLAR || t === T.RPAREN ||
           (t === T.LBRACKET && isGuardBracket());
  }

  // Lookahead to distinguish guard [count-1] from engine qualifier [speed:2]
  // Guard: [IDENT op value] where op is -/+/==/!=/>/</>=/<=
  // Qualifier: [key:value, ...] — has a colon
  function isGuardBracket() {
    let i = 1;
    // Look for colon before ] — if found, it's a qualifier not a guard
    while (pos + i < tokens.length) {
      const t = tokens[pos + i].type;
      if (t === T.RBRACKET || t === T.NEWLINE || t === T.EOF) break;
      if (t === T.COLON) return false; // qualifier
      i++;
    }
    return true; // no colon found → guard
  }

  // ============================================================
  // Couche 3 — Rules
  // ============================================================

  function parseRule() {
    const tok = current();
    let guard = null;
    const contexts = [];

    // Guards: [flag-1] — multiple allowed, AND'd
    const guards = [];
    while (at(T.LBRACKET) && isGuardBracket()) {
      guards.push(parseGuard());
    }
    guard = guards.length > 0 ? guards : null;

    // Contexts before LHS: (A B) or #(A B) or #A
    while (at(T.HASH) || (at(T.LPAREN) && isContextLookahead())) {
      contexts.push(parseContext());
    }

    // LHS
    const lhs = parseLhsElements();

    // Arrow
    let arrow;
    if (at(T.ARROW_R)) { arrow = '->'; advance(); }
    else if (at(T.ARROW_L)) { arrow = '<-'; advance(); }
    else if (at(T.ARROW_BI)) { arrow = '<>'; advance(); }
    else throw new ParseError(`Expected arrow (-> <- <>), got ${current().type}`, current());

    // RHS
    const rhs = parseRhsElements();

    // Durée NIVEAU-RÈGLE : `S -> A B C :2` (espacé, en fin de RHS) → tout le RHS dans le cadre
    // {2, …}. C'est la portée `règle` de la durée (règle universelle de portée, cf. AST_SPEC).
    // Le désucrage passe par le MÊME qualifier `speed` que les portées terminal/groupe (contrat AST).
    // Si un élément RHS SUIT le `:N`, la durée est ISOLÉE au milieu du flux (portée inline —
    // INTERDITE pour la durée, qui exige un hôte) → erreur claire (fail-loud), pas d'avalement.
    if (at(T.COLON) && peek(1).type === T.INT && rhs.length > 0) {
      const tokColon = current();
      advance(); // consume COLON
      const dur = parseColonFrame(tokColon);
      const inner = rhs.splice(0, rhs.length);
      rhs.push(cadreDuree(dur, inner));
      if (atRhsElementStart()) {
        throw new ParseError(`durée isolée dans le flux : ':N' se colle à un terminal (A4:1/2), un groupe ({A B}:2) ou toute la règle (en fin de RHS) — jamais au milieu du flux`, current());
      }
    }

    // Suffixe de règle — DEUX sacs disjoints, `()` (réglage/contrôle runtime) et `[]` (garde/
    // affectation de drapeau, qualifieur moteur non réservé), qui peuvent s'écrire dans N'IMPORTE
    // QUEL ORDRE, y compris en alternance (`S -> C4 [B=3] (weight:3)` comme `S -> C4 (weight:3)
    // [B=3]`) : la position de l'un ne ferme pas l'autre — un signe n'annonce pas la fin de la
    // règle, seule l'ABSENCE des deux le fait.
    //
    // AVANT ce correctif, `()` n'était regardé qu'UNE FOIS, avant la boucle `[]` (EBNF couche 3 :
    // `rule = ... rhs , [ runtime_qualifier ] , { flag_bracket | qualifier }`, un ordre figé qui
    // ne correspond à aucune règle du langage — les deux sacs sont orthogonaux). Un `()` après un
    // `[]` cassait avec « Expected arrow », un message qui pointe vers la règle SUIVANTE au lieu
    // de nommer le vrai problème : mesuré sur `S -> C4 [B=3] (weight:3)`.
    //
    // Plusieurs groupes `()` sont fusionnés dans UN SEUL `settings` (mêmes paires, ordre
    // d'écriture préservé) : le reste du compilateur (extraction de `scan`, etc.) lit un unique
    // nœud SettingBag par règle. `qualifiers` (crochet) reste un sac SÉPARÉ et disjoint : il ne
    // porte QUE ce que `checkQualifierKey` laisse encore passer en `[]` — garde/mutation de
    // drapeau, rang de gabarit, procédures de niveau règle (goto/failed/repeat/rndtime) et
    // opérateur de tempo — aucune de ces natures n'est un `Setting` au sens `AST.md:642-659`
    // (cf. rapport de session : `qualifiers` n'a PAS été plié dans `SettingBag`, ambiguïté
    // remontée plutôt que tranchée).
    // Loose check : accepte les clés opaques même sans `@controls` chargé (EBNF couche 3).
    let settings = null;
    const qualifiers = [];
    const flags = [];
    while (true) {
      if (isRuntimeQualifierLoose()) {
        const rq = parseRuntimeQualifier();
        if (settings) settings.pairs.push(...rq.pairs);
        else settings = rq;
        continue;
      }
      if (at(T.LBRACKET)) {
        if (isFlagBracket()) {
          flags.push(...parseFlagBracket());
        } else {
          qualifiers.push(parseQualifier());
        }
        continue;
      }
      break;
    }

    // B2 : extraire rule.mode depuis le réglage (scan:left|right|rnd) — écrit en PARENTHÈSES
    // depuis la décision Romain 2026-08-02 (LANGUAGE.md:773-800), plus en crochets.
    // (BPx ast.ts:431-449 lit ast.mode : le champ DÉRIVÉ ne change pas, seule sa source le fait.)
    const VALID_SCAN_MODES = { left: 'left', right: 'right', rnd: 'rnd' };
    let ruleMode = null;
    for (const pair of (settings ? settings.pairs : [])) {
      if (pair.key === 'scan') {
        if (VALID_SCAN_MODES[pair.value] !== undefined) {
          ruleMode = VALID_SCAN_MODES[pair.value];
        } else {
          throw new ParseError(
            `(scan:${pair.value}) : valeur inconnue (attendu : left, right, rnd)`,
            { line: tok.line, col: 0 }
          );
        }
      }
    }

    // Garde-fou lint : avertissement si le nombre d'ancres LHS ≠ RHS.
    // Le corpus connu est symétrique ; une asymétrie peut indiquer une erreur.
    // (pas une erreur bloquante — Bernard pourrait avoir des cas asymétriques)
    const countAnchorsLhs = lhs.filter(e => e.type === 'TemplateAnchor').length;
    const countAnchorsRhs = (function countRhsAnchors(elements) {
      let n = 0;
      for (const e of elements) {
        if (e.type === 'TemplateAnchor') n++;
        else if (e.elements) n += countRhsAnchors(e.elements);
      }
      return n;
    })(rhs);
    const warnings = [];
    if (countAnchorsLhs !== countAnchorsRhs && (countAnchorsLhs > 0 || countAnchorsRhs > 0)) {
      warnings.push({
        type: 'warning',
        message: `ancres de gabarit asymétriques : LHS a ${countAnchorsLhs}, RHS a ${countAnchorsRhs}`,
        line: tok.line,
      });
    }

    return { type: 'Rule', guard, contexts, lhs, arrow, rhs, flags, qualifiers, settings, mode: ruleMode, line: tok.line, warnings };
  }

  // ============================================================
  // RHS Flags [X=N, Y, Z+1]
  // ============================================================

  // Engine qualifier keys that may appear bare (without a value) in [key] brackets.
  // These must NOT be treated as flags even when followed by ] with no colon.
  const ENGINE_BARE_KEYS = new Set([
    'retro', 'shuffle', 'order', 'stop', 'destru', 'striated', 'smooth',
  ]);

  function isFlagBracket() {
    // Lookahead: [ followed by IDENT then = + - , ] (NOT IDENT:value which is a qualifier)
    if (!at(T.LBRACKET)) return false;
    const t1 = peek(1);
    const t2 = peek(2);
    if (t1.type !== T.IDENT) return false;
    // If IDENT followed by : → qualifier, not flag
    if (t2.type === T.COLON) return false;
    // If the key is a known engine bare key → qualifier, not flag
    if (ENGINE_BARE_KEYS.has(t1.value)) return false;
    // If IDENT followed by = + - ] , → flag
    if (t2.type === T.EQUALS || t2.type === T.PLUS || t2.type === T.REST ||
        t2.type === T.RBRACKET || t2.type === T.COMMA) return true;
    // Trailing-dash absorbed by tokenizer: [times-1] → IDENT("times-") INT(1)
    // Detect IDENT ending with "-" followed by INT → flag mutation
    if (t1.value.endsWith('-') && t2.type === T.INT) return true;
    if (t1.value.endsWith('+') && t2.type === T.INT) return true;
    return false;
  }

  function parseFlagBracket() {
    expect(T.LBRACKET);
    const flags = [];
    while (!at(T.RBRACKET) && !atEnd()) {
      let rawFlag = expect(T.IDENT).value;
      let operator = null, value = null;
      // Trailing-dash absorbed by tokenizer: [times-1] → IDENT("times-") INT(1)
      // Detect IDENT ending with "-" or "+" and split off the operator
      if (rawFlag.endsWith('-') && at(T.INT)) {
        operator = '-';
        rawFlag = rawFlag.slice(0, -1);
        value = Number(advance().value);
      } else if (rawFlag.endsWith('+') && at(T.INT)) {
        operator = '+';
        rawFlag = rawFlag.slice(0, -1);
        value = Number(advance().value);
      } else if (at(T.EQUALS)) {
        operator = '='; advance();
        if (at(T.INT)) value = Number(advance().value);
        else if (at(T.IDENT)) value = advance().value;
        else throw new ParseError('Expected flag value', current());
      } else if (at(T.PLUS)) {
        operator = '+'; advance();
        if (at(T.INT)) value = Number(advance().value);
        else if (at(T.IDENT)) value = advance().value;
        else throw new ParseError('Expected flag value', current());
      } else if (at(T.REST)) {
        operator = '-'; advance();
        if (at(T.INT)) value = Number(advance().value);
        else if (at(T.IDENT)) value = advance().value;
        else throw new ParseError('Expected flag value', current());
      }
      // else: bare flag [Atrans] → operator=null, value=null
      flags.push({ type: 'FlagExpr', flag: rawFlag, operator, value });
      if (at(T.COMMA)) advance();
    }
    expect(T.RBRACKET);
    return flags;
  }

  // ============================================================
  // Guard
  // ============================================================

  function parseGuard() {
    // Guard syntax: [flag-1], [phase==1], [Ideas]
    advance(); // consume [

    let flag = expect(T.IDENT).value;

    let result;

    // Trailing-dash absorbed by tokenizer: [times-1] → IDENT("times-") INT(1)
    if (flag.endsWith('-') && at(T.INT)) {
      const val = Number(advance().value);
      flag = flag.slice(0, -1);
      result = { type: 'Guard', flag, operator: '-', value: val, mutates: true };
    } else if (flag.endsWith('+') && at(T.INT)) {
      const val = Number(advance().value);
      flag = flag.slice(0, -1);
      result = { type: 'Guard', flag, operator: '+', value: val, mutates: true };
    // Test+mutation: count-1, count+1
    } else if (at(T.REST)) { // - (REST token doubles as minus)
      advance();
      const val = Number(expect(T.INT).value);
      result = { type: 'Guard', flag, operator: '-', value: val, mutates: true };
    } else if (at(T.PLUS)) {
      advance();
      const val = Number(expect(T.INT).value);
      result = { type: 'Guard', flag, operator: '+', value: val, mutates: true };
    } else {
      // Test pure: phase==1, count>3
      let op;
      if (at(T.EQ)) { op = '=='; advance(); }
      else if (at(T.NEQ)) { op = '!='; advance(); }
      else if (at(T.GT)) { op = '>'; advance(); }
      else if (at(T.LT)) { op = '<'; advance(); }
      else if (at(T.GTE)) { op = '>='; advance(); }
      else if (at(T.LTE)) { op = '<='; advance(); }
      else if (at(T.EQUALS)) {
        // `[scene=1]` en PRÉFIXE : `=` est l'opérateur de MUTATION, il n'a pas cours dans une
        // garde (docs/spec/LANGUAGE.md:301 — comparaison avant le LHS, calcul dans la RHS).
        // Le parseur criait déjà, mais par un « Expected RBRACKET » illisible (constat atlas
        // 2026-07-10, qui l'a pris pour une troncature silencieuse). On nomme la faute.
        throw new ParseError(
          `garde '[${flag}=…]' : '=' est une MUTATION, elle s'écrit en fin de règle ` +
          `('S -> C4 [${flag}=…]'). Pour TESTER la valeur d'un drapeau avant le LHS, comparer ` +
          `avec '==' ('[${flag}==…] S -> C4')`,
          current());
      }
      else {
        // Bare flag test: [Ideas] → non-zero test
        result = { type: 'Guard', flag, operator: null, value: null, mutates: false };
        expect(T.RBRACKET);
        return result;
      }

      let value;
      if (at(T.INT)) value = Number(advance().value);
      else if (at(T.IDENT)) value = advance().value;
      else throw new ParseError(`Expected value after operator`, current());

      result = { type: 'Guard', flag, operator: op, value, mutates: false };
    }

    expect(T.RBRACKET);
    return result;
  }

  // ============================================================
  // Context
  // ============================================================

  function isContextLookahead() {
    // ( at start of rule, before LHS — check if followed by symbols then ) then more symbols then ->
    // Heuristic: if we see ( symbols ) symbol -> then it's a context
    let j = pos + 1;
    let depth = 1;
    while (j < tokens.length && depth > 0) {
      if (tokens[j].type === T.LPAREN) depth++;
      if (tokens[j].type === T.RPAREN) depth--;
      j++;
    }
    // After ), look for arrow eventually
    while (j < tokens.length) {
      const t = tokens[j].type;
      if (t === T.ARROW_R || t === T.ARROW_L || t === T.ARROW_BI) return true;
      if (t === T.NEWLINE || t === T.EOF) return false;
      j++;
    }
    return false;
  }

  function parseContext() {
    let positive = true;

    if (at(T.HASH)) {
      advance();
      positive = false;

      // #? (boundary — no symbol at this position)
      if (at(T.QUESTION)) {
        advance();
        return { type: 'Context', positive: false, symbols: ['?'] };
      }

      // #symbol (single) or #(group) — group can contain {, }, , and wildcards ?N
      if (at(T.LPAREN)) {
        advance();
        const symbols = [];
        while (!at(T.RPAREN) && !atEnd()) {
          if (at(T.IDENT)) symbols.push(advance().value);
          else if (at(T.QUESTION)) {
            advance();
            // ?N wildcard in context
            if (at(T.INT)) symbols.push('?' + advance().value);
            else symbols.push('?');
          }
          else if (at(T.LBRACE)) { symbols.push(advance().value); }
          else if (at(T.RBRACE)) { symbols.push(advance().value); }
          else if (at(T.COMMA)) { symbols.push(advance().value); }
          else break;
        }
        expect(T.RPAREN);
        return { type: 'Context', positive: false, symbols };
      } else if (atAny(T.LBRACE, T.RBRACE, T.COMMA)) {
        // #{ or #} or #, — single structural char as negative context
        return { type: 'Context', positive: false, symbols: [advance().value] };
      } else if (at(T.REST)) {
        // #- — negative context for silence (le '-' est le silence en BPscript)
        advance();
        return { type: 'Context', positive: false, symbols: ['-'] };
      } else if (at(T.PROLONG)) {
        // #_ — negative context for prolongation
        advance();
        return { type: 'Context', positive: false, symbols: ['_'] };
      } else {
        const sym = expect(T.IDENT).value;
        return { type: 'Context', positive: false, symbols: [sym] };
      }
    }

    // Positive context: (A B) — can contain {, }, , and wildcards ?N
    expect(T.LPAREN);
    const symbols = [];
    while (!at(T.RPAREN) && !atEnd()) {
      if (at(T.IDENT)) symbols.push(advance().value);
      else if (at(T.QUESTION)) {
        advance();
        if (at(T.INT)) symbols.push('?' + advance().value);
        else symbols.push('?');
      }
      else if (atAny(T.LBRACE, T.RBRACE, T.COMMA)) symbols.push(advance().value);
      else break;
    }
    expect(T.RPAREN);
    return { type: 'Context', positive: true, symbols };
  }

  // ============================================================
  // LHS elements
  // ============================================================

  function parseLhsElements() {
    const elements = [];
    while (!atAny(T.ARROW_R, T.ARROW_L, T.ARROW_BI, T.EOF, T.NEWLINE, T.SEPARATOR)) {
      if (at(T.IDENT) || at(T.LAMBDA)) {
        elements.push({ type: 'Symbol', name: normalizeName(advance().value), line: current().line });
      } else if (at(T.PIPE)) {
        elements.push(parseVariable());
      } else if (at(T.QUESTION)) {
        elements.push(parseWildcard());
      } else if (at(T.HASH)) {
        elements.push(parseContext());
      } else if (at(T.LPAREN) && current().spaceBefore && isContextLookahead()) {
        // Right positive context: `Sym (B) -> X`. `(` must have a space before
        // (sinon c'est un runtime qualifier suffixe sur le LHS précédent : `C(vel:80)`).
        // isContextLookahead() vérifie que le `(...)` est suivi de `->`/`<-`/`<>` (pas une
        // déclaration ou un appel). Cf. spec EBNF.md `context` (Couche 3 § contexte droit).
        elements.push(parseContext());
      } else if (at(T.PROLONG)) {
        // _ (prolongation) as terminal on LHS — e.g. Oc3 _ -> _ Oc3
        advance();
        elements.push({ type: 'Prolongation' });
      } else if (at(T.REST)) {
        // - (silence) as terminal on LHS
        advance();
        elements.push({ type: 'Rest' });
      } else if (at(T.DOLLAR)) {
        // $ nu (ancre de gabarit maître) — le $ doit être isolé (espace après).
        // Un $ collé à un IDENT/LBRACE sans espace est interdit en LHS.
        const dollarTok = current();
        const nextTok = peek(1);
        if (!nextTok.spaceBefore && (nextTok.type === T.IDENT || nextTok.type === T.LBRACE)) {
          throw new ParseError(
            `"$" collé à un identifiant interdit en LHS — utiliser "$ " (dollar isolé avec espace)`,
            dollarTok
          );
        }
        advance();  // consomme le $
        elements.push({ type: 'TemplateAnchor', kind: 'master' });
      } else if (atAny(T.LBRACE, T.RBRACE, T.COMMA, T.RPAREN)) {
        // Raw structural chars on LHS (meta-grammars: koto3, dhin)
        elements.push({ type: 'RawBrace', value: advance().value });
      } else {
        break;
      }
    }
    return elements;
  }

  // ============================================================
  // RHS elements
  // ============================================================

  function parseRhsElements() {
    const elements = [];
    let safety = 0;
    while (!atAny(T.NEWLINE, T.EOF, T.SEPARATOR, T.COMMENT, T.GATE, T.TRIGGER, T.CV)) {
      // [] or () with SPACE before → not attached to previous element → end of RHS
      // (rule-level qualifiers/flags handled by parseRule after this returns)
      // EXCEPTION (décision ratifiée 2026-07-18) : un flag qui PRÉFIXE un contrôle reste
      // dans le RHS, émis AVANT le nœud contrôle — cf. isFlagPrefixOfControl.
      if (at(T.LBRACKET) && current().spaceBefore && isFlagPrefixOfControl()) {
        const line = current().line;
        elements.push({ type: 'FlagSet', flags: parseFlagBracket(), line });
        continue;
      }
      if (at(T.LBRACKET) && current().spaceBefore) break;
      if (at(T.LPAREN) && current().spaceBefore && isRuntimeQualifierLoose()) break;
      if (++safety > 500) throw new ParseError('RHS parse loop safety limit', current());
      // Unbalanced } or , at top level — embedding pattern
      if (atAny(T.RBRACE, T.COMMA) && isNewRuleAhead()) break;
      if (at(T.RBRACE)) {
        advance();
        const rawBrace = { type: 'RawBrace', value: '}' };
        // Suffix qualifier on closing brace: }[speed:N] (no space) — legacy le temps de la migration
        if (at(T.LBRACKET) && !current().spaceBefore && isPolymetricQualifier()) {
          rawBrace.qualifiers = [];
          while (at(T.LBRACKET) && !current().spaceBefore && isPolymetricQualifier()) {
            rawBrace.qualifiers.push(parseQualifier());
          }
        }
        // Durée collée sur l'accolade fermante d'un embedding inter-règles : }:N (décision 2026-06-26).
        // Même sémantique que `}[speed:N]` — poussée comme qualifier `speed` (contrat AST), propagée
        // au `{` correspondant par la 2e passe (annotateUnbalancedBraces). Forme canonique déséquilibrée.
        if (at(T.COLON) && !current().spaceBefore && peek(1).type === T.INT) {
          const tokColon = current();
          advance(); // consume COLON
          // La durée d'une accolade DÉSÉQUILIBRÉE ne peut pas s'envelopper ici : le `{` correspondant
          // est dans une autre règle, et c'est une seconde passe qui les réunit. On la porte donc sur
          // un champ NOMMÉ, au lieu de la glisser dans `qualifiers` — qui n'accepte que des nœuds
          // `Qualifier`. Depuis que le désucrage ne produit plus de qualificatif `speed`, l'y pousser
          // y aurait mis un nœud du mauvais type : défaut introduit puis corrigé le 2026-07-26.
          rawBrace.duree = parseColonFrame(tokColon);
        }
        elements.push(rawBrace);
        continue;
      }
      if (at(T.COMMA)) {
        elements.push({ type: 'RawBrace', value: ',' });
        advance();
        continue;
      }
      // Raw tokens: + ) for time signatures and meta-grammars
      if (at(T.PLUS) || at(T.RPAREN)) {
        elements.push({ type: 'RawBrace', value: advance().value });
        continue;
      }
      // Bare `*` in the RHS flow = BP3 homomorphism / wildcard marker
      // (LANGUAGE.md:1500 `S -> $X * &X` → `S --> (=X) * (:X)`). This is the
      // marker form, distinct from the `[*N]` scale qualifier (inside brackets,
      // handled by isTempoOpQualifier) and from `*:sound.X` (assignment subject,
      // parsed in the directive path, not here). BP3 tokenises a bare `*` as
      // (T0, 21) via FindCode (Encode.c:1335). Emitted as a raw `*` token.
      if (at(T.STAR)) {
        advance();
        elements.push({ type: 'RawBrace', value: '*' });
        continue;
      }

      const el = parseRhsElement();
      if (!el) break;

      // SUFFIX qualifiers: A[X] or A(X) — no space before [ or (
      // [] and () are ALWAYS suffix (attached to the element that precedes them)
      while ((at(T.LBRACKET) && !current().spaceBefore) ||
             (at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier())) {
        el.suffixQualifiers = el.suffixQualifiers || [];
        if (at(T.LBRACKET)) {
          el.suffixQualifiers.push(parseQualifier());
        } else {
          el.suffixQualifiers.push(parseRuntimeQualifier());
        }
      }

      refuserSuffixeArobase();
      elements.push(el);
    }
    return elements;
  }

  function isNewRuleAhead() {
    // Check if } or , at start of a NEW LINE is a new rule (} -> })
    // Only true if preceded by a NEWLINE (not inline like F2 B3})
    if (pos > 0 && tokens[pos - 1].type !== T.NEWLINE) return false;
    // Look for arrow after the } or ,
    let j = pos + 1;
    while (j < tokens.length) {
      const t = tokens[j].type;
      if (t === T.ARROW_R || t === T.ARROW_L || t === T.ARROW_BI) return true;
      if (t === T.NEWLINE || t === T.EOF || t === T.SEPARATOR) return false;
      j++;
    }
    return false;
  }

  // Flag en PRÉFIXE d'un CONTRÔLE dans le RHS : `[B=3, A=3] goto(3,0)`.
  // Décision LANGAGE ratifiée Romain 2026-07-18 (flag-prefixe-sur-controle-rhs, option b) :
  // poser le flag APRÈS un goto n'a pas de sens — goto est un SAUT, le flag doit être posé
  // AVANT. Exception ENCADRÉE : le flag-préfixe n'est autorisé QUE devant un contrôle ;
  // la règle générale « [] = suffixe » reste vraie pour les notes et terminaux.
  // Byte-id BP3 : émet /B=3/ /A=3/ _goto(3,0), l'ordre du natif.
  function isFlagPrefixOfControl() {
    if (!at(T.LBRACKET) || !isFlagBracket()) return false;
    // Avancer jusqu'au ] appariré, puis regarder si un contrôle suit.
    let j = pos, depth = 0;
    for (; j < tokens.length; j++) {
      if (tokens[j].type === T.LBRACKET) depth++;
      else if (tokens[j].type === T.RBRACKET) { depth--; if (depth === 0) { j++; break; } }
    }
    if (j >= tokens.length) return false;
    const t = tokens[j];
    // ⚠️ J'AI EU TORT ICI LE 2026-07-26, et le retrait de cette branche est la correction.
    // J'avais fait reconnaître `[B=3, A=3] ![goto: 3 0]` en jugeant que `[goto: 3 0]` « perdait »
    // l'ordre, parce que le nœud quittait la séquence pour devenir un qualificatif de règle.
    // J'ai jugé sur la FORME DE L'ARBRE au lieu de l'EFFET : `goto` est une procédure de niveau
    // RÈGLE, et c'est justement en qualificatif de règle que le moteur la lit
    // (BPx `mergeQualifierProcedures`, loadGrammar.ts:3996). La forme que je croyais fidèle était
    // celle qui n'arrivait nulle part, et laissait un jeton inerte dans la production.
    // Écriture correcte : `[B=3, A=3] [goto: 3 0]`, les deux au niveau de la règle.
    if (t.type !== T.IDENT || !isControlName(t.value)) return false;
    // Contrôle nu `striated`. (La forme d'appel `goto(3,0)` a été supprimée du langage le
    // 2026-07-26 — voir hub/decisions/2026-07-26-ecriture-des-controles-….)
    return isNoArgControl(t.value);
  }

  function isTempoOpQualifier() {
    // Lookahead: [/N] or [*N] — pure tempo op on element (not mixed [/5, mode:random])
    if (!at(T.LBRACKET)) return false;
    const next = peek(1).type;
    if (!(next === T.SLASH || next === T.STAR)) return false;
    // Check it's pure (followed by number then ] or /number then ])
    let j = pos + 2; // after [ and operator
    while (j < tokens.length && (tokens[j].type === T.INT || tokens[j].type === T.FLOAT || tokens[j].type === T.SLASH)) j++;
    return j < tokens.length && tokens[j].type === T.RBRACKET; // ] immediately after number = pure
  }



  function isEndOfRhs() {
    // Check if after the () there's nothing more in this RHS
    // (next non-whitespace is NEWLINE, [, EOF, SEPARATOR, or RBRACE)
    // Scan past the () to see what follows
    let j = pos;
    if (tokens[j]?.type !== T.LPAREN) return false;
    let depth = 1;
    j++;
    while (j < tokens.length && depth > 0) {
      if (tokens[j].type === T.LPAREN) depth++;
      else if (tokens[j].type === T.RPAREN) depth--;
      j++;
    }
    // After ), what's next?
    while (j < tokens.length && tokens[j].type === T.NEWLINE) j++;
    const nextType = tokens[j]?.type;
    return !nextType || nextType === T.EOF || nextType === T.SEPARATOR ||
           nextType === T.LBRACKET || nextType === T.NEWLINE;
  }

  function isRuntimeQualifier() {
    // (IDENT:...) or (IDENT,...) or (IDENT) where IDENT is a known control name.
    // v0.8 : on accepte aussi `(IDENT.IDENT)` (référence pointée, e.g.
    // `(sound.bell_short)`) — décision PM 4, valeur runtime qualifier pointée.
    if (!at(T.LPAREN)) return false;
    const nextTok = peek(1);
    if (nextTok.type !== T.IDENT) return false;
    if (!libCtx.controlNames.has(nextTok.value)) return false;
    // Known control followed by : , ) or . (référence pointée v0.8) = runtime qualifier
    const afterName = peek(2);
    return afterName.type === T.COLON || afterName.type === T.COMMA ||
           afterName.type === T.RPAREN || afterName.type === T.PERIOD;
  }

  // (mode:…) / (weight:…) / (tempx:…)… — un RÉGLAGE RÉSERVÉ (lib/core.json
  // schema.qualifierKeys) est un mot du LANGAGE, pas un contrôle optionnel de librairie : il doit
  // être reconnu que `@controls` soit chargé ou non. `isRuntimeQualifier()` ci-dessus dépend de
  // `libCtx.controlNames`, peuplé UNIQUEMENT par `@controls` — c'est déjà contourné au suffixe de
  // règle par `isRuntimeQualifierLoose()` (syntaxique, aucune dépendance au registre). Le marqueur
  // AUTONOME `!(…)` dans le flux n'avait PAS cet assouplissement : `!(mode:random)` sans
  // `@controls` échouait avec « Expected symbol, (...) or [...] after ! » — un message qui NOMME
  // '(...)' comme forme attendue puis la refuse. Mesuré par bpx, 117 sites.
  function isReservedSettingParen() {
    if (!at(T.LPAREN)) return false;
    const nextTok = peek(1);
    return nextTok.type === T.IDENT && libCtx.qualifierKeys.has(nextTok.value)
        && peek(2).type === T.COLON;
  }

  function isRuntimeQualifierLoose() {
    // Syntactic check: `(IDENT:value...)` regardless of whether IDENT is a
    // known control. Used to detect rule-level / standalone runtime qualifiers
    // that should be opaque (passed through to the dispatcher even when no
    // @controls lib is loaded). The strict isRuntimeQualifier() is still used
    // for collé suffix attachment so SymbolCall vs Symbol+suffix routing stays
    // controlNames-driven.
    if (!at(T.LPAREN)) return false;
    // `(*:cutoff:Env …)` — qualificateur dont la 1re paire porte un sujet '*' (chaque terminal).
    if (peek(1).type === T.STAR && peek(2).type === T.COLON) return true;
    if (peek(1).type !== T.IDENT) return false;
    // `(cc.98:45)` — contrôleur NUMÉROTÉ en contenance. Reconnaissance SYNTAXIQUE, comme le reste
    // de ce test : `IDENT . NOMBRE :` ne peut être rien d'autre. Sans ce cas, la graphie de Romain
    // ne marchait qu'en flux `!(…)` — le suffixe de règle butait sur le point et lisait « flèche
    // attendue ». Les deux régimes doivent l'accepter, sinon on n'aurait déplacé le trou.
    if (peek(2).type === T.PERIOD && peek(3).type === T.INT && peek(4).type === T.COLON) return true;
    if (peek(2).type === T.COLON) return true;
    // CLÉ NUE EN CONTENANCE — `S -> C4 (velcont)`, `S -> C4 (velcont, pitchcont)`.
    //
    // Ce test exigeait que la PREMIÈRE paire soit VALUÉE (`peek(2) === COLON`). Un sac dont la
    // première clé est nue n'était donc pas reconnu comme suffixe de règle, et la ligne sortait
    // « flèche attendue ». Asymétrie mesurée : `!(velcont)` compile dans le flux, `{C4 D4}(velcont)`
    // sur un groupe, `C4(velcont)` collé au terminal — mais `C4 (velcont)` en suffixe de règle, non.
    // Et `(vel:80, velcont)` passait quand `(velcont, vel:80)` échouait : seule la POSITION de la
    // clé nue décidait.
    //
    // La page de référence dit que les quatre signes se comportent à l'identique dans les deux sacs
    // et à toute profondeur — « rien de ce qui est écrit ici ne cache une exception plus loin ».
    // Une forme acceptée dans le flux et refusée en contenance EST une exception cachée.
    //
    // Reconnaissance SYNTAXIQUE, comme le reste de ce test : on regarde jusqu'à la parenthèse
    // fermante que TOUT élément est une clé, nue ou valuée. Sans ce balayage, `( IDENT )` happerait
    // des formes qui n'ont rien d'un sac.
    if (peek(2).type === T.COMMA || peek(2).type === T.RPAREN) {
      let j = pos + 1;                       // sur la 1re clé
      while (j < tokens.length) {
        if (tokens[j].type !== T.IDENT) return false;
        j++;
        if (tokens[j] && tokens[j].type === T.COLON) {        // clé valuée : sauter sa valeur
          j++;
          while (j < tokens.length && tokens[j].type !== T.COMMA && tokens[j].type !== T.RPAREN) j++;
        }
        if (!tokens[j]) return false;
        if (tokens[j].type === T.RPAREN) return true;
        if (tokens[j].type !== T.COMMA) return false;
        j++;
      }
      return false;
    }
    return false;
  }

  // Lit un littéral d'INTERVALLE MUSICAL pour un contrôle interval-typé (transpose…).
  // Trois formes, identiques aux ratios de tempérament (lib/temperaments.json) :
  //   fraction 3/2 · cents 700c · décimal 1.5 (un entier nu = ratio brut, 2 = octave).
  // La valeur est portée BRUTE (chaîne) ; la résolution (Kairos, normalizeRatio) la normalise.
  // Malformé → crie en NOMMANT la faute (pas de repli silencieux, L26).
  /** Lit une valeur COMPOSITE brute jusqu'à la parenthèse fermante : les virgules
   *  INTERNES sont conservées (elles font partie de la valeur, ex. `C4,2`). L'aval
   *  (BPx puis Kairos) la re-découpe, lui seul connaît la forme attendue. */
  function readCompositeLiteral() {
    let out = '';
    while (!at(T.RPAREN) && !atEnd()) out += advance().value;
    return out;
  }

  function readIntervalLiteral(ctrlName) {
    const startTok = current();
    const bad = (why) => {
      throw new ParseError(
        `Intervalle malforme pour '${ctrlName}'${why ? ' : ' + why : ''} — attendu une fraction (3/2), des cents (700c) ou un decimal (1.5)`,
        startTok
      );
    };
    let neg = '';
    if (at(T.REST)) { advance(); neg = '-'; }   // intervalle descendant : -200c, -1.5
    // Guillemets : la valeur canonique d'un intervalle est NUE (transpose:1200c, pas
    // transpose:"1200c") — cf. décision architecte 2026-07-11 (forme (A) nue en source).
    // Nommer les guillemets plutôt que laisser croire que la forme en cents serait refusée.
    if (at(T.STRING)) {
      throw new ParseError(
        `Intervalle entre guillemets non supporte pour '${ctrlName}' : ecris la forme NUE '${current().value}' (sans guillemets) — un intervalle se note fraction (3/2), cents (700c) ou decimal (1.5)`,
        startTok
      );
    }
    if (!at(T.INT) && !at(T.FLOAT)) bad(`'${current().value ?? current().type}' n'est pas un nombre`);
    const a = advance().value;
    // Fraction : INT '/' INT
    if (at(T.SLASH)) {
      if (neg) bad('une fraction ne se note pas negative (utilise des cents : -700c)');
      advance();
      if (!at(T.INT)) bad('denominateur de fraction manquant');
      const b = advance().value;
      return `${a}/${b}`;
    }
    // Cents : nombre suivi de l'unite 'c'
    if (at(T.IDENT) && current().value === 'c') {
      advance();
      return `${neg}${a}c`;
    }
    // Decimal / entier (ratio brut) : aucune unite ne doit suivre.
    if (at(T.IDENT)) bad(`unite inconnue '${current().value}' (les cents s'ecrivent 700c)`);
    return `${neg}${a}`;
  }

  function parseRuntimeQualifier() {
    // (vel:80, wave:sawtooth, velcont) → runtime qualifier AST.
    // v0.8 : accepte aussi `(sound.NAME)` — référence pointée comme valeur ;
    // équivalent sémantique à `(sound:NAME)` mais notation plus lisible.
    expect(T.LPAREN);
    const pairs = [];
    while (!at(T.RPAREN) && !atEnd()) {
      // Préfixe de SUJET (cible) devant le contrôle (décision Romain 2026-06-21,
      // cohérent avec l'existant `*:sound.X`) :
      //   `*:cutoff:Env`   → sujet '*' = chaque terminal de la portée  (par note)
      //   `C2:cutoff:Env`  → sujet 'C2' = les terminaux C2 de la règle
      //   `cutoff:Env`     → sujet omis = défaut : la portée elle-même (la règle/le groupe)
      // Détection : `* :`  OU  `IDENT : IDENT :` (deux ':' → le 1er IDENT est le sujet).
      let subject = null;
      if (at(T.STAR) && peek(1).type === T.COLON) {
        subject = '*'; advance(); advance(); // * :
      } else if (at(T.IDENT) && peek(1).type === T.COLON &&
                 peek(2).type === T.IDENT && peek(3).type === T.COLON) {
        subject = current().value; advance(); advance(); // <sujet> :
      }
      const keyTok = current();
      const key = expect(T.IDENT).value;
      refuserTempx(key, keyTok, '(');
      const pos = { line: keyTok.line, col: keyTok.col };
      const sub = subject !== null ? { subject } : {};
      // CONTRÔLEUR NUMÉROTÉ — `cc.98:45` (graphie tranchée par Romain le 2026-07-26).
      // La règle d'or du langage appliquée à un cas qui n'avait pas été traité : le point APPELLE
      // le composant (le contrôleur numéro 98), les deux points AFFECTENT la valeur. Le langage
      // savait déjà nommer les contrôleurs qui ont un ALIAS (`mod` = CC1, `volume` = CC7) ; il ne
      // savait pas en désigner un QUELCONQUE, et c'est ce trou que la forme positionnelle
      // `cc(98,45)` bouchait de travers — en fabriquant du flux sans le point d'exclamation.
      // Déclaratif : `component:"number"` dans la lib, aucun nom de contrôle en dur ici.
      if (at(T.PERIOD) && universeComponentControls().has(key)) {
        advance(); // .
        if (!at(T.INT)) {
          throw new ParseError(
            `'${key}.…' désigne un composant NUMÉROTÉ : il attend un numéro, pas '${current().value}' `
            + `(exemple : '(${key}.98:45)'). Les contrôleurs qui ont un nom s'écrivent par leur nom`,
            current());
        }
        const component = Number(advance().value);
        if (!at(T.COLON)) {
          throw new ParseError(
            `'${key}.${component}' désigne un composant sans lui affecter de valeur — il manque `
            + `':valeur' (exemple : '(${key}.${component}:45)')`,
            current());
        }
        advance(); // :
        // Même règle que partout : la valeur commence immédiatement après le deux-points.
        if (current().spaceBefore) {
          throw new ParseError(
            `'${key}.${component}: ' — pas d'espace après le deux-points : la valeur commence `
            + `immédiatement ('${key}.${component}:${current().value}')`,
            current());
        }
        let valeur;
        if (at(T.REST)) { advance(); valeur = -Number(expect(T.INT).value); }
        else if (at(T.INT) || at(T.FLOAT)) valeur = Number(advance().value);
        else valeur = expect(T.IDENT).value;
        // `component` est un champ ADDITIF sur la paire : le contrat déclare les paires portées
        // OPAQUEMENT par BPx (AST_SPEC §« il ne les interprète jamais »), un champ de plus les
        // traverse donc sans rien casser. C'est le runtime de sortie qui sait qu'un CC a un numéro.
        pairs.push({ key, component, value: valeur, ...sub, ...pos });
        if (at(T.COMMA)) advance();
        continue;
      }
      // v0.8 — référence pointée : `sound.bell_short` (sans COLON)
      if (at(T.PERIOD)) {
        advance(); // .
        const name = expect(T.IDENT).value;
        pairs.push({ key, value: name, ...sub, ...pos });
        if (at(T.COMMA)) advance();
        continue;
      }
      // UN SIGNE, UNE NATURE (décision Romain 2026-08-02, LANGUAGE.md:773-800) : un réglage
      // RÉSERVÉ (`mode`, `scan`, `weight`, `on_fail`, `tempx`, `meter`) s'écrit désormais en
      // PARENTHÈSES comme tout réglage — même `tempx`, bien que `lib/controls.json` le déclare
      // aussi dans sa section `engine`. Cette déclaration ne tranche plus : la nature de réglage
      // l'emporte sur l'ancienne structure engine/runtime de `controls.json`.
      if (universeSacs().moteur.has(key) && !libCtx.qualifierKeys.has(key)) {
        throw new ParseError(
          `'(${key}:…)' : '${key}' est un contrôle MOTEUR, il s'écrit entre CROCHETS — `
          + `'[${key}:…]', ou '![${key}:…]' pour le poser dans le flux. Les parenthèses s'adressent `
          + `au RUNTIME`,
          keyTok);
      }
      if (at(T.COLON)) {
        advance();
        // JAMAIS D'ESPACE APRÈS LE DEUX-POINTS (arbitrage Romain 2026-07-26). La valeur commence
        // immédiatement ; l'espace ne sert QU'À séparer les parties d'une valeur. Deux espacements
        // pour la même règle, et un lecteur ne peut plus déduire ce que l'espace signifie — c'est
        // le signe à deux métiers qu'on a passé la journée à supprimer.
        // ⚠️ L'espace ENTRE les parties reste légitime : `(keymap:C3 C3 C5 C5)` est juste.
        if (!at(T.RPAREN) && !atEnd() && current().spaceBefore) {
          throw new ParseError(
            `'${key}: ' — pas d'espace après le deux-points : la valeur commence immédiatement `
            + `('${key}:${current().value}…'). L'espace ne sépare que les PARTIES d'une valeur`,
            current());
        }
        // RÉGLAGE RÉSERVÉ — même lecteur de valeur que le résidu `[]` (readQualifierValue),
        // pour que `(weight:50-12)` et `(meter:4+4/6)` gardent le même format qu'avant leur
        // migration en parenthèses (décrément et signature temporelle compris).
        //
        // ⚠️ SAUF pour un réglage dont la valeur porte PLUSIEURS PARTIES séparées par une espace
        // (`goto:2 1`, `failed:3 2` — `args` en déclare deux dans lib/controls.json) : lecteur
        // MONO-valeur, `readQualifierValue` ne lit qu'un seul jeton et laisse pendre le reste
        // (`Expected IDENT, got INT`). Ces clés tombent donc dans le lecteur générique
        // multi-parties plus bas (celui qui sert déjà `keyxpand`), piloté par la DONNÉE
        // (`args.length`), jamais par un nom en dur — et lu à l'échelle de l'UNIVERS
        // (`universeSacs().specs`) pour rester disponible sans `@controls`, comme tout réglage
        // réservé.
        const specReglage = universeSacs().specs && universeSacs().specs[key];
        const reglageMultiPartie = specReglage && Array.isArray(specReglage.args) && specReglage.args.length > 1;
        if (libCtx.qualifierKeys.has(key) && !reglageMultiPartie) {
          const { value, decrement } = readQualifierValue();
          if (value === undefined) {
            throw new ParseError(
              `'(${key}:)' n'affecte aucune valeur — le deux-points en attend une (par exemple `
              + `'(${key}:${key === 'mode' ? 'random' : '…'})')`,
              keyTok);
          }
          // DEUX ÉLÉMENTS SÉPARÉS PAR UNE ESPACE, SANS VIRGULE — même garde que le résidu `[]`
          // (gardeElement, parseQualifier) : sans elle, `(mode:random weight:50)` avalait le
          // second élément en silence au lieu de réclamer sa virgule.
          if (at(T.IDENT) && peek(1).type === T.COLON) {
            throw new ParseError(
              `'(${key}:… ${current().value}:…)' : deux ÉLÉMENTS du sac séparés par une ESPACE — `
              + `il leur manque une VIRGULE ('(${key}:…, ${current().value}:…)'). L'espace ne `
              + `sépare que les PARTIES d'une même valeur`,
              current());
          }
          pairs.push({ key, value, decrement, ...sub, ...pos });
          if (at(T.COMMA)) advance();
          continue;
        }
        // Contrôle interval-typé (transpose…) : lire un littéral d'intervalle, porté brut.
        // Univers du registre (pas seulement le libCtx de la scène) : un mot USABLE est valide
        // qu'on ait chargé @controls ou non — cohérent avec la directive globale et le garde des `[]`.
        if ((libCtx.intervalControls && libCtx.intervalControls.has(key)) || universeIntervalControls().has(key)) {
          pairs.push({ key, value: readIntervalLiteral(key), ...sub, ...pos });
          if (at(T.COMMA)) advance();
          continue;
        }
        // VALEUR D'UNE PAIRE — la VIRGULE la ferme, et rien d'autre (décision Romain
        // 2026-07-26, « un rôle par signe »). L'espace sépare les PARTIES d'une valeur,
        // la virgule sépare les ÉLÉMENTS du sac : `(keymap: C3 C3 C5 C5, vel:80)` = deux
        // éléments, dont le premier a quatre parties.
        //
        // CE QUE CETTE SIMPLICITÉ REMPLACE. Ce lecteur portait sept conditions d'arrêt et une
        // boucle de continuation, toutes nées d'un seul défaut : la virgule faisait DEUX métiers
        // (séparer les paires ET joindre les parties d'une valeur, `keyxpand:C4,2`). Il fallait
        // donc deviner, à chaque virgule, lequel des deux — et la devinette s'appuyait sur le
        // registre des contrôles, ce qui couplait le parseur au vocabulaire. Ne laisser à la
        // virgule qu'un seul métier supprime la question au lieu de la contourner.
        // Effet de bord réparé au passage : une valeur qui COMMENÇAIT par un nombre ne
        // collectait pas sa suite (`switchon: 64 1` échouait là où `scale: todi_ka_4 0` passait).
        // Combien de PARTIES ce contrôle attend-il ? La donnée le dit (`args` dans la lib) — c'est
        // la seule façon de trancher, et aucune expression régulière ne le peut : `(keyxpand:B3 -1)`
        // est JUSTE (deux parties d'UNE valeur) tandis que `(vel:50 pan:7)` est FAUX (deux ÉLÉMENTS
        // d'un sac, qui se séparent par une virgule). Les caractères sont les mêmes ; seul le
        // registre distingue. Constat bpx [806].
        const specCle = (libCtx.controls && libCtx.controls[key]) || null;
        const monoPartie = specCle && Array.isArray(specCle.args) && specCle.args.length === 1;
        const parts = [];
        let deuxPointsEnTrop = null;
        let elementAvale = null;
        while (!at(T.RPAREN) && !at(T.COMMA) && !atEnd()) {
          // Un contrôle qui n'attend QU'UNE partie ne peut pas en avaler une seconde : ce qui suit
          // est un autre ÉLÉMENT du sac, et il lui manque sa virgule.
          if (monoPartie && parts.length > 0 && at(T.IDENT) && libCtx.controlNames.has(current().value)) {
            elementAvale = current(); break;
          }
          // Un SECOND deux-points dans la valeur : `(cc:98:45)`. Le deux-points AFFECTE, il ne
          // sépare pas — une paire en porte donc exactement UN. C'est la graphie qu'on obtient en
          // cherchant à désigner un composant sans connaître le point : elle doit tomber, sinon
          // elle fabrique la valeur muette « 98:45 » que personne en aval ne sait relire.
          if (at(T.COLON) && !deuxPointsEnTrop) deuxPointsEnTrop = current();
          if (parts.length > 0 && current().spaceBefore) parts.push(' ');
          parts.push(advance().value);
        }
        const brut = parts.join('');
        if (elementAvale) {
          throw new ParseError(
            `'(${key}:${brut} ${elementAvale.value}…)' : '${key}' n'attend qu'UNE valeur, donc `
            + `'${elementAvale.value}' est un autre ÉLÉMENT du sac — il lui manque sa VIRGULE `
            + `('${key}:${brut}, ${elementAvale.value}…'). L'espace ne sépare que les PARTIES d'une `
            + `même valeur`,
            elementAvale);
        }
        if (deuxPointsEnTrop) {
          throw new ParseError(
            `'(${key}:${brut})' : le deux-points AFFECTE une valeur, il n'en sépare pas les parties `
            + `— une paire n'en porte qu'un. Pour désigner un composant numéroté, le point l'appelle `
            + `('(${key}.${brut.split(':')[0]}:${brut.split(':').slice(1).join(':')})') ; pour plusieurs `
            + `parties, l'espace les sépare`,
            deuxPointsEnTrop);
        }
        if (brut === '') {
          throw new ParseError(
            `'(${key}:)' n'affecte aucune valeur — le deux-points en attend une (par exemple `
            + `'(${key}:80)'), et un contrôle sans argument s'écrit nu, sans deux-points`,
            keyTok);
        }
        // Une valeur d'UNE SEULE partie numérique reste un NOMBRE (`vel:80` → 80, `pan:-1` → -1) :
        // les consommateurs la lisent ainsi. Plusieurs parties = chaîne portée brute, découpée
        // par l'aval qui seul connaît l'opération.
        const val = /^-?\d+(\.\d+)?$/.test(brut) ? Number(brut) : brut;
        pairs.push({ key, value: val, ...sub, ...pos });
      } else {
        // Bare key (no-arg control like velcont, pitchcont)
        pairs.push({ key, value: true, ...sub, ...pos });
      }
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);
    return { type: 'SettingBag', pairs };
  }

  function isPerElementQualifier() {
    // [IDENT:...] or [IDENT] where IDENT is a known control name = per-element qualifier
    // Used for engine qualifier [speed:2]A or A[weight:50] or {[retro] A}
    if (!at(T.LBRACKET)) return false;
    const nextTok = peek(1);
    if (nextTok.type !== T.IDENT) return false;
    return libCtx.controlNames.has(nextTok.value);
  }

  // PIERRE TOMBALE — le suffixe arobase (`C4@kick`, `{A B}@groove`) est SUPPRIMÉ du langage
  // (Romain, 2026-07-28 : « on supprime, tu n'as pas pu me prouver que ça avait une utilité
  // quelconque »). Son motif, mot pour mot : ASSOCIER DANS LA PRODUCTION se fait déjà avec le
  // point d'exclamation ; DÉCLARER UNE ÉTIQUETTE se fait dans la partie déclarative. Deux voies
  // existantes couvraient les deux besoins — cette forme n'en avait aucun à elle.
  // État mesuré au retrait : aucune décision datée ne la fondait, sa seule caractérisation écrite
  // la disait ignorée, son usage documenté visait la directive de correspondance désormais morte,
  // et ZÉRO scène l'écrivait sur tout l'écosystème.
  //
  // ⚠️ EN FONCTION, appelée par TOUS les endroits qui lisent un élément — pas seulement le flux de
  // premier niveau. Écrite d'abord à un seul endroit, elle laissait le suffixe se faire refuser
  // DANS UNE VOIX POLYMÉTRIQUE par un message générique (« accolade fermante attendue ») : la
  // forme disparaissait bien, mais celui qui l'écrivait n'apprenait rien. Trouvé par la matrice
  // du garde, pas par relecture.
  function refuserSuffixeArobase() {
    if (!at(T.AT) || current().spaceBefore) return;
    const nom = peek(1).type === T.IDENT ? peek(1).value : 'nom';
    throw new ParseError(
      `le suffixe '@${nom}' collé à un élément est SUPPRIMÉ du langage (décision Romain `
      + `2026-07-28). Deux écritures le remplacent, selon ce qu'on voulait faire. Pour ASSOCIER `
      + `un geste à un élément DANS LA PRODUCTION : le point d'exclamation, `
      + `'C4!${nom}' — le geste se déclenche à l'instant du terminal sans occuper de pas. Pour `
      + `DÉCLARER UNE ÉTIQUETTE : la partie déclarative, une macro ou un alias.`, current());
  }

  function parseRhsElement() {
    const tok = current();

    // Lambda (check for ! after)
    if (at(T.LAMBDA)) {
      advance();
      if (at(T.BANG)) {
        return parseSimultaneousGroup('lambda', tok);
      }
      return { type: 'NilString' };
    }

    // Silence -
    if (at(T.REST)) {
      advance();
      return { type: 'Rest' };
    }

    // Prolongation _ — ou forme legacy _(ident)( normalisée en transport-control (spec §4)
    // La forme `_(ident)(args)` est héritée du moteur historique pour le transport (BP3 legacy).
    // Un frontend conforme AST_SPEC v1 §4 n'émet jamais `_(…)` : le `_` est consommé et le
    // nœud est normalisé en Control de nature transport-control (traité dans le post-pass).
    if (at(T.PROLONG)) {
      // Forme legacy `_name(args)` (transport-control) : le `_` est le PRÉFIXE COLLÉ du contrôle.
      // On ne la reconnaît QUE si l'IDENT est collé au `_` (pas d'espace) — disambiguation
      // collé/espacé, cohérente avec |[…]. Un `_` suivi d'un ESPACE puis d'un contrôle en forme
      // nue (`_ value(…)`, `_ _ vel(…)`) est une PROLONGATION AUTONOME + un contrôle séparé :
      // sans ce garde, le legacy happait le `_` de prolongation → corruption SILENCIEUSE du
      // compte de prolongations (constaté kss2 → RNG divergent, tryCsoundObjects → 5 `_` perdus).
      if (peek(1).type === T.IDENT && peek(2).type === T.LPAREN && !peek(1).spaceBefore) {
        advance(); // consomme _
        const ctrlName = advance().value;
        return parseControl(ctrlName, tok);
      }
      advance();
      return { type: 'Prolongation' };
    }

    // Undetermined rest ...
    if (at(T.UNDETERMINED)) {
      advance();
      return { type: 'UndeterminedRest' };
    }

    // Objet sonore composé |[ … ] (ratifié Romain 2026-07-18) : Symbol dont le nom est la suite
    // concaténée (le tokenizer a déjà strippé les blancs, ex. do5_do5do5). Forme canonique alignée
    // sur ce que le frontal émet pour do5_do5do5 : Symbol{name, payload:{nature:'sounding'}} — le
    // payload est posé par annotateRhsNode (type 'Symbol'). Nom littéral : pas de normalizeName.
    if (at(T.COMPOUND)) {
      const t = advance();
      return { type: 'Symbol', name: t.value, line: t.line };
    }

    // Period .
    if (at(T.PERIOD)) {
      advance();
      return { type: 'Period' };
    }

    // Labeled polymetric: label:{...}
    if (at(T.IDENT) && peek(1).type === T.COLON && peek(2).type === T.LBRACE) {
      const label = advance().value;  // consume IDENT
      advance();                       // consume COLON
      if (hasMatchingBrace()) {
        return parsePolymetric(label);
      }
      // Unbalanced { after label: — emit label as symbol, colon was consumed
      return { type: 'Symbol', name: normalizeName(label), line: tok.line };
    }

    // Polymetric { ... } or unbalanced brace (embedding pattern)
    if (at(T.LBRACE)) {
      if (hasMatchingBrace()) {
        return parsePolymetric(null);
      }
      // Unbalanced { — emit as raw token for BP3 embedding patterns
      advance();
      return { type: 'RawBrace', value: '{' };
    }


    // Variable |x|
    if (at(T.PIPE)) {
      return parseVariable();
    }

    // Wildcard ?  ?1
    if (at(T.QUESTION)) {
      return parseWildcard();
    }

    // Template master $X
    if (at(T.DOLLAR)) {
      return parseTemplateMaster();
    }

    // Template slave &X
    if (at(T.AMPERSAND)) {
      return parseTemplateSlave();
    }

    // Tilde ~ (tie)
    if (at(T.TILDE)) {
      advance();
      if (at(T.IDENT)) {
        const name = advance().value;
        if (at(T.TILDE)) {
          advance();
          return { type: 'TieContinue', symbol: name };
        }
        return { type: 'TieEnd', symbol: name };
      }
      throw new ParseError('Expected symbol after ~', tok);
    }

    // Standalone ! → out-time object, instant control, or simultaneous
    if (at(T.BANG)) {
      // RÈGLE D'ESPACE sur `!(...)` (décision Romain 2026-06-20) : `C4!(...)` COLLÉ (pas d'espace
      // avant `!`) = flux CONJOINT ancré au terminal précédent (voyage avec lui, répliqué si lui).
      // `C4 !(...)` ESPACÉ = flux ÉVÉNEMENT SÉPARÉ (non conjoint, posé seul). On capte l'espace
      // ici ; la validation « il existe bien un terminal précédent » est faite à l'annotation.
      // ⚠️ « COLLÉ » VEUT DIRE COLLÉ À UN TERME, PAS « SANS ESPACE À GAUCHE ». Un `!` qui ouvre
      // une voix, un groupe ou un membre droit n'a AUCUN terme derrière lui : il ne peut pas être
      // conjoint, quoi que dise l'espace. `{! (/2) C4, D4}` pose la vitesse en TÊTE de voix,
      // exactement comme `{ ! (/2) C4, D4}` — l'accolade n'est pas un terminal.
      //
      // Mesuré le 2026-08-06 par Kanopi, reproduit ici : la seconde écriture passait, la première
      // était REFUSÉE, et mon message accusait l'espace — que l'auteur avait pourtant mis. Coût
      // réel : 178 espaces posés après des accolades pour réparer quatre scènes, en cherchant du
      // côté que mon message désignait. Un refus JUSTE dont la CAUSE est fausse envoie son lecteur
      // corriger ce qui n'a rien à voir ; c'est la même famille que « ça compile ≠ ça veut dire ce
      // que la phrase dit », côté diagnostic.
      // ⚠️ Et ce n'était pas qu'un défaut de message : le refus LUI-MÊME était faux.
      // Noms pris dans le tokenizer, pas de mémoire : j'en avais inventé trois sur quatre au
      // premier jet (`T.ARROW`, `T.ARROW_LEFT`, `T.ARROW_BOTH` n'existent pas), ce qui met
      // `undefined` dans l'ensemble et le fait correspondre à tort.
      const OUVRANTS = new Set([T.LBRACE, T.LPAREN, T.LBRACKET, T.COMMA,
                                T.ARROW_R, T.ARROW_L, T.ARROW_BI, T.NEWLINE]);
      for (const t of OUVRANTS) if (t === undefined) throw new Error('OUVRANTS porte un type de jeton inexistant');
      const precedent = peek(-1);
      const collated = !current().spaceBefore && precedent !== undefined
                    && !OUVRANTS.has(precedent.type);
      advance();
      // `!osc >> filtre` / `!\>> out.in` → CÂBLAGE posé DANS LE FLUX.
      //
      // Décidé par Romain le 2026-07-28, sur sa propre écriture `!eltA\>>eltB` : un câblage
      // N'OCCUPE PAS DE TEMPS — il se pose en instantané dans une règle, et c'est le point
      // d'exclamation qui le dit, comme pour tout ce qui est dans le flux sans prendre un pas.
      // Il devient un ÉLÉMENT DE SÉQUENCE À PART ENTIÈRE : le précédent est uniforme sur tous
      // les autres contrôles du langage, aucun n'est une marque accrochée à son voisin.
      // Le MULTIPLE ne demande aucun séparateur — chaque câblage porte SON point d'exclamation
      // et ils se suivent (`!a >> b !c >> d`), exactement comme s'enchaînent les instantanés.
      if (fluxIsWiring()) {
        return parseWiring(tok.line);
      }
      // ! (/N) · ! (*N/M) → CHANGEMENT DE VITESSE posé dans le flux.
      // La bible en donne l'écriture et la place : LANGUAGE.md:1249 (« ! (/N) · ! (*N/M) —
      // changement de vitesse posé dans le flux ») et :2267 (« /N accélère, et *N/M écrit la
      // MÊME chose en fraction inverse : *a/b vaut /(b/a) »). Un seul opérateur, deux graphies.
      //
      // ⚠️ IL SE POSE SEUL, JAMAIS COLLÉ À UN TERME. La vitesse court « à partir d'ici » et
      // jusqu'à la fin du champ (LANGUAGE.md:2254) : elle ne voyage pas avec un terminal et ne
      // se réplique pas avec lui. C'est ce que dit le tableau des portées d'`AST.md` — ❌ en
      // `!accolé`, ✅ en `!inline` seulement. `C4!(/2)` est donc refusé, et nommé.
      if (at(T.LPAREN) && (peek(1).type === T.SLASH || peek(1).type === T.STAR)) {
        if (collated) {
          throw new ParseError(
            `'!(…)' collé à un terme porte un flux CONJOINT, qui voyage avec ce terme et se `
            + `réplique avec lui — une vitesse ne fait ni l'un ni l'autre : elle court à partir `
            + `d'où elle est posée jusqu'à la fin du champ. Elle se détache par une espace : `
            + `'… ! (${peek(1).type === T.STAR ? '*N/M' : '/N'})'`,
            current());
        }
        return { type: 'InstantControl', qualifier: parseVitesseParenthese(), conjoint: false };
      }
      // !(...) → instant runtime control (flux). Le second test admet les réglages RÉSERVÉS
      // même sans `@controls` (cf. isReservedSettingParen ci-dessus).
      if (isRuntimeQualifier() || isReservedSettingParen()) {
        return { type: 'InstantControl', qualifier: parseRuntimeQualifier(), conjoint: collated };
      }
      // ![@seed:N] → directive de production DANS LE FLUX. Restreint à `seed` :
      // seul `_srand` existe comme contrôle de flux BP3 (décision 2026-06-14). Émet _srand(N).
      if (at(T.LBRACKET) && peek(1).type === T.AT) {
        const dirs = parseProductionBlock();
        for (const d of dirs) {
          if (d.name !== 'seed') {
            throw new ParseError(`![@${d.name}…] : seul @seed a un sens dans le flux (re-semence _srand) ; maxitems/allitems/improvize n'ont pas de contrôle de flux BP3`, current());
          }
        }
        return { type: 'InstantControl', qualifier: { type: 'ProductionInline', directives: dirs } };
      }
      // ![...] → instant engine control. Un tempo y est RELATIF (décision 2026-06-10).
      if (at(T.LBRACKET)) {
        {
          // Une PROCÉDURE DE NIVEAU RÈGLE (`goto`, `failed`, `repeat`, `stop`) ne s'applique pas
          // à une POSITION : elle vaut pour la règle entière, et le moteur l'extrait en
          // MÉTADONNÉE (BPx `mergeQualifierProcedures`, loadGrammar.ts:3996, qui lit
          // `ast.qualifiers`). L'écrire dans le flux la laisse dans la séquence : elle n'atteint
          // jamais la règle, et un jeton de contrôle INERTE reste dans la production.
          //
          // Mesuré sur `repeat.bps` : `![repeat: K1=3]` laisse `{ctrl}` dans les jetons produits
          // et `rule.qualifiers` ne porte que `weight` ; `[repeat: K1=3]` fait arriver
          // `repeat=K1=3` en qualificatif de règle et le jeton inerte disparaît.
          //
          // C'est MON erreur de migration du 2026-07-26 : j'ai traduit toute forme d'appel
          // autonome par `!(…)`/`![…]` — la position — sans distinguer les procédures qui n'en
          // ont pas. On refuse plutôt qu'on relève en silence : deux écritures pour une même
          // chose, c'est précisément ce que la décision d'écriture supprime.
          const q = parseQualifier('relative');
          const procedure = (q.pairs || []).find((p) => p && universeRuleScopeControls().has(p.key));
          if (procedure) {
            throw new ParseError(
              `'![${procedure.key}: …]' : '${procedure.key}' est une procédure de niveau RÈGLE, elle `
              + `ne se pose pas dans le flux — elle vaut pour la règle entière. Écrire `
              + `'[${procedure.key}:${procedure.value === true ? '…' : procedure.value}]' en `
              + `suffixe de règle. Dans le flux, elle n'atteint jamais la règle et laisse un jeton `
              + `de contrôle inerte dans la production`,
              current());
          }
          return { type: 'InstantControl', qualifier: q };
        }
      }
      // !symbol → out-time object
      if (at(T.IDENT)) {
        const name = advance().value;
        return { type: 'OutTimeObject', name };
      }
      throw new ParseError('Expected symbol, (...) or [...] after !', current());
    }

    // Trigger in <!
    if (at(T.TRIGGER_IN)) {
      return parseWait();
    }

    // Hash (context in RHS)
    if (at(T.HASH)) {
      return parseContext();
    }

    // Backtick de FLUX : taggé → BacktickStandalone ; NON taggé → hérite du langage
    // de l'acteur eval en tête de règle (résolu en annotateBackticks ; CRIE si orphelin).
    // Ajustement [299] : héritage rétabli, borné à l'eval d'acteur déclaré.
    if (at(T.BACKTICK)) {
      const raw = advance().value;
      const t = tryBacktickTag(raw);
      if (t) return { type: 'BacktickStandalone', tag: t.tag, code: t.code, line: tok.line };
      return { type: 'BacktickInline', code: raw, tag: null, line: tok.line };
    }

    // Chiffre nu en flux RHS.
    if (at(T.INT) && !isSymbolCallAhead()) {
      const num = Number(advance().value);
      if (at(T.SLASH) && peek(1).type === T.INT) {
        advance();
        const denom = Number(advance().value);
        return { type: 'NumericDuration', numerator: num, denominator: denom };
      }
      // TERMINAL NEUTRE (ratifié Romain 2026-07-17, GO architecte [468]) : un entier nu
      // SONNE (fidèle BP3 — Encode.c:87 isdigit→FindNumber produit un token, ce n'est PAS
      // une durée). Kind sonnant DISTINCT 'numeric-terminal', pas NumericDuration, pas de
      // drapeau. Le 2-limbes base 2^31 vit SEUL dans l'encodeur plat aval (bpx flatLength) ;
      // l'AST reste propre. Le chemin BP3 hérité émet le même chiffre (encoder.js cas
      // NumericTerminal → byte-id préservé).
      return { type: 'NumericTerminal', kind: 'numeric-terminal', value: num, line: tok.line };
    }

    // Identifier — could be Symbol, SymbolCall, Control, or TieStart
    if (at(T.IDENT)) {
      let name = advance().value;
      let actor = null;

      // Actor dot notation: sitar.Sa → { type: 'Symbol', name: 'Sa', actor: 'sitar' }
      // Only if first IDENT is a known actor and followed by .IDENT (no space before .).
      // On NE retourne PAS ici : on capte l'acteur puis on RETOMBE dans le même traitement
      // que le terminal nu (suffixe (...), appel-symbole, ~, !, <!), afin que
      // `acteur.terminal(...)` se comporte EXACTEMENT comme `terminal(...)`. Avant ce fix,
      // le retour anticipé laissait tout `(...)` collé non consommé → rejet « Expected RBRACE
      // got LPAREN » dès qu'un préfixe d'acteur côtoyait un override inconnu, ex. (ch:N) (LAN-9).
      // Appel-composant par le POINT (design_dot_notation ; décision [489], loi de graphie).
      // Point GLUÉ (pas d'espace avant) suivi d'un IDENT = accès à un membre d'un composant.
      // Composant CONNU (acteur) → chemin existant. Composant INCONNU mais point glué DES DEUX
      // CÔTÉS (`drum.on`) → porté OPAQUE (même nœud {Symbol,name,actor}, `opaqueComponent:true`) :
      // le parser N'INTERPRÈTE PAS (PORTER≠RÉSOUDRE) — module(son)/acteur(hauteur)/homo décidé à
      // la RÉSOLUTION aval. byte-id sûr : aucune grammaire n'utilise un point glué-des-deux-côtés.
      // ── L'ACTEUR QUALIFIE UN BLOC DE CODE, PAR LE POINT, À DROITE ────────────────
      // `drums.\`note("c3")\`` — décidé par Romain le 2026-07-28, et c'est la forme qui manquait.
      //
      // ⚠️ POURQUOI ELLE EXISTE, et ce n'est pas un confort d'écriture. L'ancienne forme faisait
      // porter le nom de l'acteur À LA TÊTE DE RÈGLE — un amalgame, refusé depuis. Or cet amalgame
      // faisait DEUX choses : il donnait son langage au code, ET son identité à la voix. Le tag
      // (`\`strudel: …\``) ne remplace que la première : mesuré, un bloc tagué ne porte AUCUN acteur,
      // donc tout ce qui est clé par acteur en aval cesse de le trouver — Kanopi a mesuré un voyant
      // de santé resté AU VERT sur une voix qui erreure en continu.
      // Cette forme rend les deux : le point qualifie le bloc comme il qualifie une note
      // (`sitar.Sa`), l'acteur garde son nom, et la règle n'est qu'une règle.
      if (at(T.PERIOD) && !current().spaceBefore && peek(1).type === T.BACKTICK
          && libCtx.actors && libCtx.actors[name]) {
        advance();                                  // le point
        const raw = advance().value;                // le bloc
        const t = tryBacktickTag(raw);
        // Un tag EXPLICITE reste prioritaire — il surcharge l'héritage, comme partout ailleurs.
        return t
          ? { type: 'BacktickStandalone', tag: t.tag, code: t.code, actor: name, line: tok.line }
          : { type: 'BacktickInline', code: raw, tag: null, actor: name, line: tok.line };
      }

      const gluedMember = at(T.PERIOD) && !current().spaceBefore && peek(1).type === T.IDENT;
      const knownActor = gluedMember && libCtx.actors && libCtx.actors[name];
      const opaqueComponent = gluedMember && !knownActor && !peek(1).spaceBefore;
      let componentOpaque = false;
      if (knownActor || opaqueComponent) {
        advance(); // consume PERIOD
        actor = name; // composant (acteur connu, ou opaque : résolu aval sur la liste d'acteurs/modules)
        name = advance().value; // membre
        componentOpaque = opaqueComponent;
      }

      // Valeur affectée à un membre de composant OPAQUE (loi de graphie : `:` = valeur ; §4/§9
      // activés [502]). `lpf.cutoff: 8000` (cv-set), `saw.freq: pitch` (ref), `env.decay: 350ms`.
      // Distinct de la durée de note (`A4:1/2`) : ne vaut que pour un appel-composant OPAQUE. Porté
      // OPAQUE (kind number|ref|backtick) ; la classe trig/cv-set/gate = résolution aval (Kairos,
      // content.action, catalogue de ports). PORTER≠RÉSOUDRE : je ne classe pas, je porte la valeur.
      if (componentOpaque && at(T.COLON) && !current().spaceBefore) {
        advance(); // consume COLON
        const value = parseWireValue();
        return { type: 'Symbol', name: normalizeName(name), line: tok.line, actor, value };
      }

      // Durée collée sur terminal : A4:1/2 → {1/2, A4} (décision 2026-06-26 trois-concepts-temps-duree).
      // `:` COLLÉ (pas d'espace) suivi d'un nombre = durée de note ; désucré en cadre polymétrique.
      // Se distingue de `label:{…}` (capté plus haut, peek(2)=LBRACE) et de `A4 1/2` ESPACÉ
      // (ancien sens : A4 puis un silence, NumericDuration). L'espace tranche (EBNF.md:943).
      if (at(T.COLON) && !current().spaceBefore && peek(1).type === T.INT) {
        advance(); // consume COLON
        const dur = parseColonFrame(tok);
        const sym = { type: 'Symbol', name: normalizeName(name), line: tok.line, ...(actor ? { actor } : {}) };
        return cadreDuree(dur, [sym]);
      }

      // Tie start: C4~
      if (at(T.TILDE)) {
        advance();
        return { type: 'TieStart', symbol: name, ...(actor ? { actor } : {}) };
      }

      // Control: vel(120), goto(2,1) — check BEFORE symbol call.
      // Jamais pour un terminal préfixé d'acteur (acteur.terminal n'est pas un contrôle).
      // FORME D'APPEL `nom(param)` SUPPRIMÉE DU LANGAGE (décision Romain 2026-07-26,
      // hub/decisions/2026-07-26-ecriture-des-controles-…). « fonction() n'existe pas et n'a
      // jamais existé en BPScript ». Elle avait déjà été pesée et écartée le 2026-07-02
      // (DIGITAL_FUNCTIONS.md §7). Un contrôle s'écrit `(nom:valeur)` au runtime, `[nom:valeur]`
      // au moteur, `!` devant pour le poser dans le flux.
      //
      // On ne se contente pas de retirer la branche : sans message, l'appel retomberait en
      // `SymbolCall` et sonnerait comme une note — le mode d'échec le plus coûteux, mesuré le
      // 2026-07-26. On le NOMME donc, avec sa réécriture, et le sac dépend de la nature du
      // contrôle : la donnée le dit, on ne le devine pas.
      if (!actor && at(T.LPAREN) && isControlName(name)) {
        throw new ParseError(refusFormeAppel(name), tok);
      }

      // Control without args: striated, smooth, destru, stop
      //
      // ⚠️ LA DÉCLARATION DE LA SCÈNE PASSE AVANT LE MOT DU VOCABULAIRE. Mesuré par Kairos le
      // 2026-07-27 : `patchbay-demo.bps` déclare `@macro mute` et écrit sept mots dans sa règle ;
      // il en arrivait SIX. Le mot y devenait un contrôle sans un mot d'erreur, parce que j'ai
      // déclaré `mute`/`unmute`/`panic` sans argument le 2026-07-26 — un mot jusque-là libre est
      // devenu un mot du vocabulaire, et toute scène qui le portait déjà a été tronquée en
      // silence. C'est le pire mode d'échec : côté consommateur, rien ne distingue une scène qui a
      // changé d'une scène qui a été amputée.
      //
      // La règle est celle de la cascade, déjà posée pour tout le langage (décision
      // 2026-06-26) : LE PLUS LOCAL GAGNE. La scène qui déclare un nom le possède. Le contrôle
      // reste joignable dans son sac — `(mute)`, `!(mute)` — position syntaxique distincte, aucun
      // conflit. Et l'ombrage se DIT : il est légitime, il n'est pas anodin.
      //
      // ⚠️ ET UN MOT QUI N'A PAS DE FORME NUE REFUSE, il ne disparaît pas. « Sans argument » ne
      // veut pas dire « s'écrit nu au fil de la séquence » : les contrôles continus hérités de BP3
      // s'écrivent nus, `mute`/`unmute`/`panic` non — leur seule graphie est le sac. La donnée le
      // déclare (`sacSeul`), le code ne nomme aucun contrôle.
      if (!actor && !at(T.LPAREN) && isControlName(name)
          && libCtx.bagOnlyControls && libCtx.bagOnlyControls.has(name)
          && !nomsDeclaresLocalement.has(name)) {
        throw new ParseError(
          `'${name}' n'a pas de forme nue dans le flux — écrire '!(${name})' pour le poser au fil `
          + `de la séquence, ou '(${name})' en contenance sur un élément. Un mot du vocabulaire `
          + `rencontré là où il ne peut pas l'être refuse ; il ne disparaît pas.`, tok);
      }

      if (!actor && !at(T.LPAREN) && isControlName(name) && isNoArgControl(name)) {
        if (nomsDeclaresLocalement.has(name)) {
          warn(`'${name}' est déclaré par la scène ET porté par le vocabulaire comme contrôle sans `
             + `argument — la déclaration de la scène l'emporte, le mot reste un symbole ici. Pour `
             + `le contrôle, écrire '(${name})' ou '!(${name})'.`, tok.line);
        } else {
          return { type: 'Control', name, args: [] };
        }
      }

      // Runtime qualifier suffix: D4(vel:70) — no space = attached to symbol
      // Let parseRhsElements handle suffix attachment via spaceBefore
      // But we must check here to avoid confusing with symbol call
      if (isRuntimeQualifier() && !current().spaceBefore) {
        // Return bare symbol — suffix will be attached by parseRhsElements
        return { type: 'Symbol', name: normalizeName(name), line: tok.line, ...(actor ? { actor } : {}) };
      }

      // Symbol call: Sa(custom_param:120) — only if collé (no space) and NOT a known runtime control
      if (at(T.LPAREN) && !current().spaceBefore && !isContextLookahead()) {
        const node = parseSymbolCall(name, tok);
        if (actor) node.actor = actor;
        return node;
      }

      // Simultaneous: Sa!dha!phase=2
      // But NOT !() or ![] — those are standalone InstantControls for the next iteration
      // NI un CÂBLAGE (`C4 !osc >> filtre`) : le `!` y ouvre un élément à part entière, qu'on
      // laisse au tour suivant de la boucle du flux. Sans ce test, l'accord avalait le premier
      // étage puis butait sur le chevron, et la ligne tombait sur un refus GÉNÉRIQUE — un
      // câblage lu comme un accord, exactement le mode d'échec payé en juillet sur `!(…)`.
      if (at(T.BANG) && peek(1).type !== T.LPAREN && peek(1).type !== T.LBRACKET
          && !fluxIsWiring(pos + 1)) {
        const node = parseSimultaneousGroup(name, tok);
        if (actor) node.actor = actor;
        return node;
      }

      // Trigger in on symbol: Sa<!sync1
      if (at(T.TRIGGER_IN)) {
        const triggerIns = [];
        while (at(T.TRIGGER_IN)) {
          triggerIns.push(parseWait());
        }
        return {
          type: 'SymbolWithWait',
          symbol: { type: 'Symbol', name: normalizeName(name), line: tok.line, ...(actor ? { actor } : {}) },
          triggers: triggerIns,
        };
      }

      // Plain symbol (might be a control like vel, tempo, goto)
      // Check if it's a control: name(args) without being a symbol call context
      // FORME D'APPEL `nom(param)` SUPPRIMÉE DU LANGAGE (décision Romain 2026-07-26,
      // hub/decisions/2026-07-26-ecriture-des-controles-…). « fonction() n'existe pas et n'a
      // jamais existé en BPScript ». Elle avait déjà été pesée et écartée le 2026-07-02
      // (DIGITAL_FUNCTIONS.md §7). Un contrôle s'écrit `(nom:valeur)` au runtime, `[nom:valeur]`
      // au moteur, `!` devant pour le poser dans le flux.
      //
      // On ne se contente pas de retirer la branche : sans message, l'appel retomberait en
      // `SymbolCall` et sonnerait comme une note — le mode d'échec le plus coûteux, mesuré le
      // 2026-07-26. On le NOMME donc, avec sa réécriture, et le sac dépend de la nature du
      // contrôle : la donnée le dit, on ne le devine pas.
      if (!actor && at(T.LPAREN) && isControlName(name)) {
        throw new ParseError(refusFormeAppel(name), tok);
      }

      return { type: 'Symbol', name: normalizeName(name), line: tok.line, ...(actor ? { actor } : {}) };
    }

    return null; // No valid RHS element found
  }

  function isSymbolCallAhead() {
    // INT followed by non-slash = not a duration
    return false;
  }

  function isNoArgControl(name) {
    return libCtx.noArgControls.has(name);
  }

  /** Message de refus de la forme d'appel — il RÉÉCRIT au lieu de constater. Le sac vient de la
   *  DONNÉE (`libCtx.engineControls`), jamais d'une liste de noms en dur ici. */
  function refusFormeAppel(name) {
    const moteur = libCtx.bp3NativeControls && libCtx.bp3NativeControls.has(name)
                && !(libCtx.dispatcherOnlyControls && libCtx.dispatcherOnlyControls.has(name));
    const cible = moteur ? `![${name}:…]` : `!(${name}:…)`;
    return `la forme d'appel '${name}(…)' n'existe pas en BPScript (supprimée le 2026-07-26) — `
      + `écrire '${cible}' pour le poser dans le flux, ou '${moteur ? `[${name}:…]` : `(${name}:…)`}' `
      + `en contenance. Les deux points AFFECTENT la valeur, l'espace en sépare les parties `
      + `('[goto:3 0]'), la virgule sépare les éléments du sac ('(vel:80, pan:64)')`;
  }

  function isControlName(name) {
    return libCtx.controlNames.has(name);
  }

  // Vrai si le jeton courant peut DÉMARRER un élément RHS (cf. parseRhsElement). Sert à distinguer
  // une durée en FIN de règle (`A B C :2`, portée règle, valide) d'une durée ISOLÉE au milieu du
  // flux (`A :2 B`, portée inline — INTERDITE pour la durée). Les terminateurs de règle (NEWLINE,
  // [], (), flèches) ne démarrent pas d'élément.
  function atRhsElementStart() {
    const t = current().type;
    return t === T.IDENT || t === T.LBRACE || t === T.REST || t === T.PROLONG
        || t === T.UNDETERMINED || t === T.PERIOD || t === T.PIPE || t === T.QUESTION
        || t === T.DOLLAR || t === T.AMPERSAND || t === T.TILDE || t === T.BANG
        || t === T.TRIGGER_IN || t === T.HASH || t === T.BACKTICK || t === T.LAMBDA || t === T.INT;
  }

  // ============================================================
  // Compound RHS elements
  // ============================================================

  function parseSymbolCall(name, tok) {
    expect(T.LPAREN);
    const args = [];
    while (!at(T.RPAREN) && !atEnd()) {
      let key = null;
      // Check for named arg: key:value
      if (at(T.IDENT) && peek(1).type === T.COLON) {
        key = advance().value;
        advance(); // :
      }
      let value;
      // Argument d'un contrôle interval-typé (transpose) : soit `transpose(3/2)` (callee interval-typé,
      // arg positionnel), soit `Sym(transpose:3/2)` (clé interval-typée). Lu comme INTERVALLE, porté brut.
      const intervalHere = (key && universeIntervalControls().has(key))
                        || (!key && universeIntervalControls().has(name));
      // Valeur COMPOSITE (`keyxpand:C4,2`) : la virgule appartient à la VALEUR. Sans ce cas,
      // la liste d'arguments la consomme comme séparateur et le contrôle ne reçoit que sa
      // première moitié — l'aval criait alors « needs a pivot note and a factor ».
      const compositeHere = (key && universeCompositeControls().has(key))
                         || (!key && universeCompositeControls().has(name));
      if (compositeHere) {
        value = { type: 'Literal', value: readCompositeLiteral() };
      } else if (intervalHere) {
        value = { type: 'Literal', value: readIntervalLiteral(key || name) };
      } else if (at(T.BACKTICK)) {
        // Valeur calculée : taggée si tag présent, sinon héritage (résolu en aval).
        const raw = advance().value;
        const t = tryBacktickTag(raw);
        value = t ? { type: 'BacktickInline', code: t.code, tag: t.tag }
                  : { type: 'BacktickInline', code: raw, tag: null };
      } else if (at(T.INT)) {
        // RAPPORT `N/D` (ex. tempx:11/5) : même lecture que `TempoOp`/`readIntervalLiteral`
        // ailleurs dans ce fichier (le glyphe SLASH y porte déjà ce sens, jamais une division
        // calculée). Sans ce embranchement, le RESTE de la fraction (`/5`) retombait comme un
        // second argument sans clé et sans forme reconnue — « Expected argument value » sur une
        // valeur qui compile pourtant dans TOUTE autre position de sac (runtime qualifier connu,
        // qualifier moteur). Un entier seul (pas suivi de '/') garde son ancienne lecture NUMBER.
        const n = advance().value;
        if (at(T.SLASH) && peek(1).type === T.INT) {
          advance();
          value = { type: 'Literal', value: `${n}/${advance().value}` };
        } else {
          value = { type: 'Literal', value: Number(n) };
        }
      } else if (at(T.FLOAT)) {
        value = { type: 'Literal', value: Number(advance().value) };
      } else if (at(T.IDENT)) {
        value = { type: 'Literal', value: advance().value };
      } else {
        // Nommer l'APPELÉ : sans lui, un appel dont un argument n'est pas une valeur ne dit ni
        // qui il est ni pourquoi il échoue. Cas mesuré (2026-07-26) : `script(MIDI controller #98
        // = 0 channel 1)` sortait un « Expected argument value » orphelin, alors que la vraie
        // cause est que `script` n'est pas un contrôle et que sa prose n'est pas une liste
        // d'arguments.
        throw new ParseError(`Expected argument value in '${name}(…)'`, current());
      }
      args.push({ type: 'Arg', key, value });
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);

    // Check for tie start after call
    if (at(T.TILDE)) {
      advance();
      return { type: 'TieStart', symbol: name, args };
    }

    // `!` après un appel : ACCORD (`B3!C7`) ou CONTRÔLE DE FLUX (`Sym(…) !(vel:80)`) ?
    // C'est ce qui SUIT le `!` qui tranche, pas le `!` lui-même — il est surchargé
    // (LANGUAGE.md, table de syntaxe). Devant `(` ou `[`, c'est un contrôle posé dans le flux ;
    // le lire comme un accord fait échouer la ligne sur « symbole attendu après ! ».
    // Payé le 2026-07-26 : la migration du corpus pose des `!(…)` partout, et une scène tombait
    // sur cette lecture — donc pour une raison FAUSSE, masquant celle qu'on voulait lui voir.
    if (at(T.BANG) && peek(1).type !== T.LPAREN && peek(1).type !== T.LBRACKET
        && !fluxIsWiring(pos + 1)) {
      return parseSimultaneousGroup(name, tok, args);
    }

    return { type: 'SymbolCall', name, args, line: tok.line };
  }

  function parseControl(name, tok) {
    expect(T.LPAREN);
    const args = [];
    // Contrôle interval-typé (transpose) : l'unique argument est un INTERVALLE, lu proprement
    // (fraction/cents/décimal) et porté brut — sans la jointure de tokens qui insérerait un espace
    // parasite ("1100 c" au lieu de "1100c"), ce que la résolution (normalizeRatio) rejetterait.
    if (universeIntervalControls().has(name)) {
      args.push(readIntervalLiteral(name));
      expect(T.RPAREN);
      return { type: 'Control', name, args };
    }
    while (!at(T.RPAREN) && !atEnd()) {
      // Build composite arg: K1=3, Cmaj, 120, etc.
      let arg = '';
      while (!at(T.RPAREN) && !at(T.COMMA) && !atEnd()) {
        const t = current();
        if (t.type === T.INT || t.type === T.FLOAT || t.type === T.IDENT) {
          // PROSE INTERDITE dans un argument de contrôle (chantier `_script`, GO Romain
          // 2026-07-26). Ce lecteur recollait autrefois les mots successifs avec des espaces —
          // « MIDI send Continue », « wait for do#2 channel 1 » — ce qui n'existait QUE pour
          // porter la phrase libre de `script(…)`. `script` supprimé, la prose n'a plus de
          // destinataire : deux valeurs qui se suivent sans séparateur sont une faute, et on la
          // NOMME plutôt que de la recoller en silence. Mesuré sur les deux corpus consommateurs
          // (Kanopi + BPx) : 0 argument de contrôle contient un espace hors `repeat(K1 = 3)`,
          // dont l'espace vient de la branche `=` ci-dessous.
          // Seul le cas que le collage servait est refusé : une valeur DÉJÀ COMPLÈTE (elle finit
          // par un alphanumérique) suivie d'une autre. Un signe en attente de son nombre
          // (`pitchbend(+200)`, `chromashift(-12)`) ou un `=` en attente de sa valeur
          // (`repeat(K1 = 3)`) ne finit pas par un alphanumérique et reste légitime.
          if (arg.length > 0 && /[a-zA-Z0-9]$/.test(arg)) {
            throw new ParseError(
              `argument de contrôle mal formé dans '${name}(…)' : '${arg} ${t.value}' — deux valeurs `
              + `se suivent sans séparateur. Un contrôle prend des arguments séparés par ',' ; il ne `
              + `prend pas de phrase (la fonction générique 'script(…)' a été supprimée du langage)`,
              t);
          }
          arg += advance().value;
        } else if (t.type === T.EQUALS) {
          // Add spaces around = for readability: "controller #98 = 0"
          if (arg.length > 0) arg += ' ';
          arg += advance().value + ' ';
        } else if (t.type === T.SLASH) {
          arg += advance().value;
        } else if (t.type === T.REST) {
          // negative number in control args
          arg += advance().value;
        } else if (t.type === T.PLUS) {
          // positive sign in control args: pitchbend(+200) — symmetric with REST (-)
          arg += advance().value;
        } else {
          // Unexpected token in args — break inner loop to avoid infinite loop.
          // If no arg was accumulated, throw to signal the unexpected token explicitly.
          if (arg.length === 0) {
            throw new ParseError(`Unexpected token ${t.type} (${t.value}) in control args`, t);
          }
          break;
        }
      }
      if (arg) args.push(arg);
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);
    return { type: 'Control', name, args };
  }

  function parseSimultaneousGroup(primaryName, tok, primaryArgs = null) {
    let primary;
    if (primaryName === 'lambda') {
      primary = { type: 'NilString' };
    } else if (primaryArgs) {
      primary = { type: 'SymbolCall', name: primaryName, args: primaryArgs, line: tok.line };
    } else {
      primary = { type: 'Symbol', name: normalizeName(primaryName), line: tok.line };
    }
    const secondaries = [];

    while (at(T.BANG)) {
      // Un `!` qui ouvre un CÂBLAGE n'est pas un secondaire d'accord : `C4 !dha !osc >> filtre`
      // est un accord PUIS un câblage, deux éléments frères. Sans ce test, l'accord absorbait
      // `!osc` et butait sur le chevron — le premier `!` était bien lu, c'est le DEUXIÈME qui
      // se perdait. La garde du haut ne suffisait pas : elle ne voit que l'entrée dans l'accord.
      if (fluxIsWiring(pos + 1)) break;
      advance(); // !

      // ! is exclusively temporal — only symbols/symbol calls
      if (at(T.IDENT)) {
        const name = advance().value;
        if (at(T.LPAREN)) {
          const call = parseSymbolCall(name, tok);
          secondaries.push(call);
        } else {
          secondaries.push({ type: 'Symbol', name: normalizeName(name), line: tok.line });
        }
        continue;
      }

      throw new ParseError('Expected symbol after !', current());
    }

    return { type: 'SimultaneousGroup', primary, secondaries };
  }

  function hasMatchingBrace() {
    // Lookahead: is there a } that matches this { within the SAME rule?
    // A new rule starts after NEWLINE(s) when we see: IDENT ARROW
    let depth = 0;
    let j = pos;
    let afterNewline = false;
    while (j < tokens.length) {
      const t = tokens[j].type;
      if (t === T.LBRACE) depth++;
      if (t === T.RBRACE) { depth--; if (depth === 0) return true; }
      if (t === T.EOF || t === T.SEPARATOR) return false;
      // After a newline, check if next non-newline token starts a new rule
      if (t === T.NEWLINE) { afterNewline = true; j++; continue; }
      if (afterNewline) {
        // New rule starts with: IDENT/LAMBDA at line start (outside braces)
        if (t === T.LAMBDA) return false;
        if (t === T.IDENT) {
          // Look ahead for arrow
          let k = j + 1;
          while (k < tokens.length && tokens[k].type === T.IDENT) k++;
          if (k < tokens.length && (tokens[k].type === T.ARROW_R || tokens[k].type === T.ARROW_L || tokens[k].type === T.ARROW_BI)) {
            return false; // New rule detected
          }
        }
      }
      afterNewline = false;
      j++;
    }
    return false;
  }

  function parsePolymetric(label) {
    let dureeCollee = null;   // `{A B}:N` — désucré en `{N, {A B}}` à la sortie
    expect(T.LBRACE);
    const voices = [];
    let currentVoice = [];

    while (!at(T.RBRACE) && !atEnd()) {
      if (at(T.COMMA)) {
        voices.push(currentVoice);
        currentVoice = [];
        advance();
        continue;
      }
      if (at(T.NEWLINE)) { advance(); continue; }
      // [] with space before inside polymetric → break (not attached to element)
      if (at(T.LBRACKET) && current().spaceBefore) break;

      const el = parseRhsElement();
      if (!el) break;
      refuserSuffixeArobase();   // même refus nommé partout où un élément se lit

      // SUFFIX qualifiers: A[X] or A(X) — no space before [ or (
      while ((at(T.LBRACKET) && !current().spaceBefore) ||
             (at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier())) {
        el.suffixQualifiers = el.suffixQualifiers || [];
        if (at(T.LBRACKET)) {
          el.suffixQualifiers.push(parseQualifier());
        } else {
          el.suffixQualifiers.push(parseRuntimeQualifier());
        }
      }
      currentVoice.push(el);

      // EBNF §4.2: "A (vel:80)" with space = suffix of A if end of voice
      // Attach spaced () as suffix of last element when at end of voice (, or })
      if (at(T.LPAREN) && current().spaceBefore && isRuntimeQualifier() && currentVoice.length > 0) {
        const lastEl = currentVoice[currentVoice.length - 1];
        lastEl.suffixQualifiers = lastEl.suffixQualifiers || [];
        lastEl.suffixQualifiers.push(parseRuntimeQualifier());
      }
    }
    if (currentVoice.length > 0) voices.push(currentVoice);
    expect(T.RBRACE);

    // Qualifiers after } — engine [] and runtime ()
    const qualifiers = [];
    while (at(T.LBRACKET) && isPolymetricQualifier()) {
      qualifiers.push(parseQualifier());
    }

    // Durée collée sur groupe : {A B}:2 → cadre {2, A B} (décision 2026-06-26 trois-concepts).
    // `:` COLLÉ au `}` suivi d'un nombre = durée du groupe ; poussée comme qualifier `speed`
    // dans `qualifiers` (contrat AST_SPEC:1024,1037) — pas un champ ad hoc.
    if (at(T.COLON) && !current().spaceBefore && peek(1).type === T.INT) {
      const tokColon = current();
      advance(); // consume COLON
      dureeCollee = parseColonFrame(tokColon);
    }

    // Setting bag on group: {}(vel:100)
    let settings = null;
    if (isRuntimeQualifier()) {
      settings = parseRuntimeQualifier();
    }

    const groupe = { type: 'Polymetric', voices, qualifiers, settings, label: label || null };
    // `{A B}:2` → `{2, {A B}}` : le groupe reste UN élément dans le cadre, il ne s'y disperse pas.
    return dureeCollee ? cadreDuree(dureeCollee, [groupe]) : groupe;
  }

  // Durée collée : consomme un nombre (INT) ou un ratio (INT/INT) APRÈS un COLON déjà consommé,
  // et renvoie la PREMIÈRE VOIX du cadre polymétrique — exactement ce qu'aurait produit l'écriture
  // développée. Le désucrage est celui que la décision écrit noir sur blanc
  // (`hub/decisions/2026-06-26-trois-concepts-temps-duree.md`) : `{A B}:1/2` → `{1/2, {A B}}`.
  //
  // ⚠️ CE QUE ÇA CORRIGE, mesuré par bpx sur l'AST brut, et c'était DEUX fautes dans une ligne :
  //  1. j'émettais un qualificatif de clé `speed` — le mot que cette même décision SUPPRIME, et
  //     qu'elle supprime parce qu'il était MAL NOMMÉ (il ne désigne pas une vitesse mais un
  //     étirement). Un mot retiré de la surface qui survit à l'intérieur de l'arbre, c'est la
  //     survivance exacte qui a laissé vivre la forme d'appel quatre mois.
  //  2. je gardais le contenu en voix PARALLÈLES au lieu de l'IMBRIQUER : `{2, C4, D4}` est deux
  //     voix dans un cadre 2 ; `{2, {C4, D4}}` est UNE voix qui contient le groupe. Ce n'est pas
  //     la même musique, même si le son coïncidait sur le cas mesuré.
  // La forme rendue est celle que produit déjà l'écriture développée : `NumericTerminal` pour un
  // entier, `NumericDuration` pour un ratio — vérifié en comparant les deux arbres.
  function parseColonFrame(tok) {
    const num = expect(T.INT).value;
    if (at(T.SLASH) && peek(1).type === T.INT) {
      advance(); // consume SLASH
      return { type: 'NumericDuration', numerator: Number(num), denominator: Number(expect(T.INT).value) };
    }
    return { type: 'NumericTerminal', kind: 'numeric-terminal', value: Number(num), line: (tok || current()).line };
  }

  /** Enveloppe un contenu dans le cadre `{durée, contenu}` — la forme canonique du désucrage. */
  function cadreDuree(premiereVoix, contenu) {
    return {
      type: 'Polymetric',
      voices: [[premiereVoix], contenu],
      qualifiers: [], settings: null, label: null,
    };
  }

  // Les DEUX qualificatifs polymétriques historiques sont supprimés du langage : `[speed:N]` le
  // 2026-06-26 et `[scale:N]` le 2026-07-26, tous deux SUBSUMÉS par la durée collée `{A B}:N`.
  // La fonction ne reconnaît donc plus rien — on la garde le temps que ses appelants soient
  // retirés, mais elle ne doit plus jamais rendre vrai : un mot supprimé qui survit à l'intérieur
  // est la survivance qui a laissé vivre la forme d'appel quatre mois.
  function isPolymetricQualifier() {
    return false;
  }

  function parseVariable() {
    expect(T.PIPE);
    const name = expect(T.IDENT).value;
    expect(T.PIPE);
    // Frontière AST (Palier 3) : `|x|` = non-terminal nommé (BP3 T4/GetVar, même
    // token qu'un non-terminal `S`) → s'abaisse en `Symbol{name}`. `Variable` est
    // RÉSERVÉ au métavariable `?N` (T6, index requis). Cf. AST_SPEC §1.2.1.
    return { type: 'Symbol', name };
  }

  function parseWildcard() {
    expect(T.QUESTION);
    // Frontière AST (Palier 3) : bare `?` = index ABSENT (wildcard anonyme (T0,1),
    // indépendant) ; `?n` = index:n (wildcard numéroté / métavariable (T6,n), unification).
    // DISTINCTS au moteur — le `?` nu ne porte JAMAIS d'`index`. Cf. AST_SPEC §1.2.1.
    if (at(T.INT)) return { type: 'Wildcard', index: Number(advance().value) };
    return { type: 'Wildcard' };
  }

  // LECTURE DES ARGUMENTS D'UN GABARIT — UNE SEULE, pour le maître (`$nom(…)`) ET pour l'esclave
  // (`&nom(…)`).
  //
  // ⚠️ ELLE EXISTE PARCE QUE LA MÊME BOUCLE VIVAIT À DEUX ENDROITS, ET QUE J'EN AI RÉPARÉ UN SEUL.
  // Le 2026-08-06 au matin, la boucle du MAÎTRE piétinait sur un jeton qu'aucune branche ne
  // consommait : elle empilait sans fin et emportait la machine (6,6 Go). Corrigée là où le défaut
  // s'était MONTRÉ — et l'ESCLAVE, copie exacte, est resté intact jusqu'à ce que `&mel(tempx:1)` le
  // réveille l'après-midi même. « On répare l'endroit où le défaut s'est montré, pas l'espace où il
  // peut vivre », payé deux fois dans la journée sur le même code.
  // La parade n'est pas d'y penser : c'est qu'il n'y ait plus qu'un seul corps à réparer.
  function lireArgumentsDeGabarit(sigil, nom) {
    const args = [];
    advance(); // (
    while (!at(T.RPAREN) && !atEnd()) {
      const avant = pos;
      let key = null;
      if (at(T.IDENT) && peek(1).type === T.COLON) {
        key = advance().value;
        advance();
      }
      let value;
      if (at(T.INT)) value = { type: 'Literal', value: Number(advance().value) };
      else if (at(T.IDENT)) value = { type: 'Literal', value: advance().value };
      args.push({ type: 'Arg', key, value });
      if (at(T.COMMA)) advance();
      // ⛔ CETTE BOUCLE NE DOIT JAMAIS PIÉTINER — un tour qui ne consomme aucun jeton tourne sans
      // fin. Un refus nommé vaut toujours mieux qu'une machine à genoux.
      if (pos === avant) {
        throw new ParseError(
          `'${sigil}${nom}(…${current().value}…)' : '${current().value}' n'a pas sa place dans les `
          + `arguments d'un gabarit — ils s'écrivent 'nom:valeur', séparés par des virgules. `
          + `Pour poser un RÉGLAGE sur la règle, une ESPACE le détache du gabarit `
          + `('${sigil}${nom} (${key || 'clé'}:…)')`,
          current());
      }
    }
    expect(T.RPAREN);
    return args;
  }

  function parseTemplateMaster() {
    expect(T.DOLLAR);

    // Template group: ${...} → (= ...)
    if (at(T.LBRACE)) {
      advance();
      const elements = [];
      while (!at(T.RBRACE) && !atEnd()) {
        if (at(T.NEWLINE)) { advance(); continue; }
        const el = parseRhsElement();
        if (el) elements.push(el);
        else break;
        refuserSuffixeArobase();   // même refus nommé partout où un élément se lit
      }
      expect(T.RBRACE);
      return { type: 'TemplateMasterGroup', elements };
    }

    // $ nu (ancre de gabarit maître) — le token suivant a un espace (spaceBefore=true)
    // ou n'est pas un IDENT/LBRACE. Retourner TemplateAnchor au lieu d'erreur.
    if (!at(T.IDENT) || current().spaceBefore) {
      return { type: 'TemplateAnchor', kind: 'master' };
    }

    const name = expect(T.IDENT).value;
    let args = null;
    // ARGUMENTS DE GABARIT vs SAC DE RÉGLAGES — c'est l'ESPACE qui tranche, comme partout
    // ailleurs dans le langage (AST.md, tableau des portées : un suffixe COLLÉ porte sur
    // l'élément, un suffixe ESPACÉ porte sur la règle). `$Tihai(transpose:-200c)` donne ses
    // arguments au gabarit ; `$A16 (meter:4/4)` pose un réglage de règle.
    //
    // ⚠️ SANS LA CONDITION D'ESPACE, un réglage de règle écrit après une ancre de gabarit
    // tombait dans la lecture d'arguments ci-dessous. `isRuntimeQualifier()` ne le rattrapait
    // pas : il exige que le nom soit un contrôle CONNU, et il ne l'est que si la scène a
    // chargé `@controls` — ce que ces scènes ne font pas. Mesuré : une seule écriture de
    // l'écosystème donne des arguments à un gabarit, et elle est COLLÉE.
    if (at(T.LPAREN) && !current().spaceBefore && !isRuntimeQualifier()) {
      args = lireArgumentsDeGabarit('$', name);
    }
    return { type: 'TemplateMaster', name, args };
  }

  function parseTemplateSlave() {
    expect(T.AMPERSAND);

    // Template group: &{...} → (: ...)
    if (at(T.LBRACE)) {
      advance();
      const elements = [];
      while (!at(T.RBRACE) && !atEnd()) {
        if (at(T.NEWLINE)) { advance(); continue; }
        const el = parseRhsElement();
        if (el) elements.push(el);
        else break;
        refuserSuffixeArobase();   // même refus nommé partout où un élément se lit
      }
      expect(T.RBRACE);
      return { type: 'TemplateSlaveGroup', elements };
    }

    const name = expect(T.IDENT).value;
    let args = null;
    // Même loi que le maître : c'est l'ESPACE qui sépare les arguments de gabarit du sac de
    // réglages, et c'est la MÊME lecture (`lireArgumentsDeGabarit`) — plus deux corps à tenir
    // synchronisés.
    if (at(T.LPAREN) && !current().spaceBefore && !isRuntimeQualifier()) {
      args = lireArgumentsDeGabarit('&', name);
    }
    return { type: 'TemplateSlave', name, args };
  }

  function parseWait() {
    expect(T.TRIGGER_IN);
    const name = expect(T.IDENT).value;
    // ADRESSE DE LA SOURCE, collée au point de réception — symétrique de l'adresse de destination
    // collée au terminal (`sitar1.Sa`). Décision Romain 2026-07-27 : une entrée se route PAR LE NOM,
    // AU POINT OÙ ELLE AGIT, comme une sortie ; pas de directive, pas de flèche.
    //
    // ⚠️ COLLÉ = UNE ADRESSE, ESPACE = UN DÉCOUPAGE (règle validée par Romain le 2026-07-27).
    //
    //   `<!brut.60`     → une adresse : le point d'attente écoute le numéro 60 de l'entrée `brut`
    //   `<!brut . 60`   → le point d'attente `brut`, puis un DÉCOUPAGE, puis le terminal 60
    //
    // CE N'EST PAS UNE RÈGLE NOUVELLE, et il faut le lire ainsi plutôt que comme un choix : le
    // langage COLLE déjà le marqueur de registre au nom de note, jamais une espace, parce que
    // l'espace est le délimiteur de termes (LANGUAGE.md:107-111) ; et la doc écrit déjà le
    // découpage AVEC des espaces autour (`A B . C D`, LANGUAGE.md:273). Les deux graphies étaient
    // donc déjà distinguées dans l'usage — on rend explicite ce qui l'était de fait.
    //
    // POURQUOI IL A FALLU UNE RÈGLE : un point suivi d'un NOMBRE est une lecture valide des DEUX
    // façons, l'adresse et le découpage suivi d'un terminal numérique. Mesuré avant de trancher, et
    // c'est ce chiffre qui dit que la règle n'a rien brisé : ZÉRO point d'attente dans tout
    // l'écosystème, ZÉRO séquence découpage-puis-nombre en flux hors d'un bloc Csound. Aucune scène
    // ne casse, quelle que soit la sortie.
    let address = null;
    const colle = at(T.PERIOD) && !current().spaceBefore;
    if (colle && (peek(1).type === T.IDENT || peek(1).type === T.INT) && !peek(1).spaceBefore) {
      advance();
      const jeton = advance();
      // Le TYPE dit ce que l'adresse EST, et l'aval n'a rien à deviner : un NOMBRE est le numéro
      // brut de l'appareil, tel quel (décision 2026-07-27, point 3) ; un IDENTIFIANT est une
      // étiquette, celle que la table a produite. Même convention que les extrémités `cc:N`, dont
      // le numéro sort en nombre.
      address = jeton.type === T.INT ? Number(jeton.value) : jeton.value;
      // ⚠️ ET L'ADRESSE S'ARRÊTE À UN DÉLIMITEUR. Signalé par BPx le 2026-07-27 : `<!pedale.1e999`
      // donnait l'adresse 1 PLUS un terminal `e999` injecté dans la pièce — l'auteur écrit une
      // adresse, il obtient une note qu'il n'a pas écrite. Ça ne se voyait que si le nom parasite
      // tombait hors alphabet ; dans le cas contraire, la note serait passée sans un mot.
      if ((at(T.IDENT) || at(T.INT)) && !current().spaceBefore) {
        throw new ParseError(
          `'<!${name}.${jeton.value}${current().value}' : l'adresse est SUIVIE DE '${current().value}' `
          + `sans séparateur. Une adresse est UN seul jeton — un identifiant ('<!${name}.suivant') ou `
          + `un entier ('<!${name}.60'). Séparer par une espace ce qui doit être un terme distinct.`,
          current());
      }
    } else if (colle && (peek(1).type === T.IDENT || peek(1).type === T.INT)) {
      // ⚠️ LE CAS MIXTE — point collé au nom, mais valeur détachée. Il n'est ni l'un ni l'autre, et
      // je REFUSE de choisir à la place de l'auteur : le lire en silence comme un découpage
      // trahirait une intention d'adresse manifeste, le lire comme une adresse contredirait la
      // règle. Signalé à l'architecte avant l'arbitrage, non tranché depuis — donc on ne devine pas.
      throw new ParseError(
        `'<!${name}.' suivi d'une espace : forme ambiguë. COLLÉ des deux côtés c'est une ADRESSE `
        + `('<!${name}.${peek(1).value}'), ESPACÉ des deux côtés c'est un DÉCOUPAGE suivi d'un `
        + `terminal ('<!${name} . ${peek(1).value}'). Écrire l'une des deux.`, current());
    } else if (colle) {
      // ⚠️ LE TROU QUE BPx A MESURÉ le 2026-07-27, et c'était le pire mode d'échec possible : point
      // COLLÉ au nom, mais suivi de quelque chose qui n'est ni un identifiant ni un entier — un
      // signe moins, un nombre décimal, une chaîne. AUCUNE des deux branches ci-dessus ne tirait,
      // le point restait dans le flux, et la ligne se relisait en éléments FANTÔMES : `<!pedale.-1`
      // devenait un point d'attente SANS ADRESSE, puis un découpage, puis un silence, puis un
      // terminal numérique. Trois éléments que personne n'a écrits.
      //
      // POURQUOI CE N'EST PAS COSMÉTIQUE, et c'est BPx qui l'a vu de son côté : une attente SANS
      // adresse se lève sur N'IMPORTE QUEL événement de son rôle — c'est la forme voulue, celle du
      // sustain. Une adresse qui s'évapore transforme donc une barrière PRÉCISE en barrière
      // PROMISCUE : la pièce repart au premier événement venu, l'exact contraire de ce qui est
      // écrit. Et l'aval ne peut RIEN rattraper : il ne distingue pas une attente écrite sans
      // adresse d'une adresse évaporée. L'information est détruite ici, donc le refus est ici.
      throw new ParseError(
        `'<!${name}.' suivi de '${peek(1).value ?? peek(1).type}' : ce n'est pas une adresse. Une `
        + `adresse est un identifiant ('<!${name}.suivant') ou un entier ('<!${name}.60'), collé au `
        + `point des deux côtés. Sans adresse, écrire '<!${name}' seul — l'attente se lève alors sur `
        + `n'importe quel événement de ce rôle, et c'est une forme différente, pas un raccourci.`,
        current());
    }
    const qualifiers = [];
    while (at(T.LBRACKET)) qualifiers.push(parseQualifier());
    // ⚠️ LE SAC D'ANNOTATIONS APPARTIENT AU POINT D'ATTENTE, dans TOUTES ses écritures.
    //
    // Mesuré le 2026-07-27 : écrit SEUL (`<!p(chan:1)`) le sac atterrissait sur le point d'attente ;
    // écrit ANCRÉ à une note (`C4 <!p(chan:1)`, la forme la plus courante) il atterrissait sur
    // l'ASSEMBLAGE `SymbolWithWait`. La même écriture, deux propriétaires — un consommateur
    // qui lit le sac du point n'en trouvait aucun, alors que la donnée était là, sous un autre nœud.
    //
    // ⚠️ CE N'ÉTAIT PAS UNE PERTE, C'ÉTAIT UN DÉPLACEMENT — et c'est pire à sa façon : rien ne
    // manque, donc rien ne peut le signaler ; il faut regarder au bon endroit pour voir que ce n'est
    // pas le bon endroit. (Je l'avais d'abord rapporté comme une perte, à tort.)
    //
    // Le sac est donc consommé ICI, par le point lui-même, avant que l'attachement de suffixe au
    // niveau de l'élément ne s'en saisisse. La note garde le sien : `C4(vel:80)<!p` — le sac écrit
    // AVANT le point d'attente appartient toujours à la note, mesuré.
    const suffixQualifiers = [];
    while (at(T.LPAREN) && isRuntimeQualifier()) suffixQualifiers.push(parseRuntimeQualifier());
    return {
      type: 'Wait', name, ...(address !== null ? { address } : {}), qualifiers,
      ...(suffixQualifiers.length ? { suffixQualifiers } : {}),
    };
  }

  // Garde de clé `[clé:valeur]` — UNIFORME quelle que soit la position (suffixe de règle,
  // flux `![…]`, préfixe, polymétrie) : parseQualifier est le passage obligé de toutes.
  // Loi : « Toute clé non reservee dans [] est une erreur de compilation »
  // (docs/spec/LANGUAGE.md:486). L'univers vient de la DONNÉE, jamais d'une liste en dur :
  // contrôles de TOUTES les libs du REGISTRE + @core.schema.qualifierKeys.
  // L'univers est celui du registre, PAS des seules libs chargées par la scène : `[rotate:2]`
  // reste une clé connue dans une scène sans `@controls` (cas des scènes de BPx). Exiger
  // `@controls` pour employer un contrôle serait une décision de SURFACE, non tranchée — le
  // garde ne rejette donc QUE l'inconnu, sans reclasser ni restreindre aucune clé existante.
  // ⛔ PIERRE TOMBALE PARTAGÉE — `tempx` est SUPPRIMÉ du langage (décision Romain 2026-08-06,
  // hub/decisions/2026-08-06-tempx-est-supprime-doublon-exact-de-l-operateur-de-vitesse.md) :
  // « si tempx fait la même chose que `*` on le supprime et c'est tout ». La mesure qui l'établit
  // est du 3 août : `![tempo:2]` et `![/2]` rendent 500/500/500, le même flux.
  //
  // ⚠️ POURQUOI UNE PIERRE TOMBALE ET PAS UN SIMPLE RETRAIT DE LA LIBRAIRIE. Retirer l'entrée
  // suffit à ce que le mot cesse d'être un contrôle CONNU — mais une clé inconnue entre
  // parenthèses est portée OPAQUEMENT jusqu'au runtime : `(tempx:2)` serait alors accepté et
  // n'atteindrait plus personne. Le retrait seul aurait transformé un doublon bruyant en réglage
  // MUET, le pire des deux. Le mot doit REFUSER, et nommer sa relève.
  function refuserTempx(key, tok, signeOuvrant) {
    if (key !== 'tempx' && key !== 'tempo') return;
    throw new ParseError(
      `'${signeOuvrant === '[' ? '[' : '('}${key}:…${signeOuvrant === '[' ? ']' : ')'}' : `
      + `'${key}' ne s'écrit pas dans une règle — le multiplicateur de vitesse EST l'opérateur, `
      + `et il se pose dans le flux : '! (/N)' ralentit, '! (*N/M)' écrit la même chose en `
      + `fraction inverse (décision Romain 2026-08-06). Le métronome de la scène, lui, s'écrit `
      + `en tête : '@tempo:120'`,
      tok);
  }

  function checkQualifierKey(key, tok) {
    refuserTempx(key, tok, '[');
    // `[speed:N]` SUPPRIMÉ (décision 2026-06-26-trois-concepts-temps-duree) : `speed` est
    // subsumé par la DURÉE, qui s'écrit avec ':' collé — `{A B}:2`, `A4:1/2`, `}:N`.
    if (key === 'speed') {
      throw new ParseError(`'[speed:N]' a été supprimé (décision 2026-06-26) — la durée s'écrit avec ':' : '{A B}:2' (groupe), 'A4:1/2' (note) ou '}:N' (embedding)`, tok);
    }
    // `[shuffle:N]` RETIRÉ (décision 2026-06-14-shuffle-seed-orthogonaux) : brasser et
    // re-semer sont deux atomes BP3 distincts. `[shuffle]` (nu) reste = _rndseq.
    if (key === 'shuffle') {
      throw new ParseError(`'[shuffle:N]' retiré — la graine s'écrit '[@seed:N]' (global) ou '![@seed:N]' (dans le flux) ; '[shuffle]' brasse seul`, tok);
    }
    // UN SIGNE, UNE NATURE (décision Romain 2026-08-02, LANGUAGE.md:773-800). Le crochet ne
    // garde que trois emplois : un test de drapeau (garde), une affectation de drapeau (fin de
    // règle), un rang de forme (`@template`). Un RÉGLAGE — même réservé au langage — décrit une
    // propriété PRODUITE, et le domaine de sa clé suffit à le router : il s'écrit désormais entre
    // PARENTHÈSES, dans TOUS les cas, sans exception pour les mots réservés `mode`/`scan`/
    // `weight`/`on_fail`/`tempx`/`meter`. L'ancien raisonnement « tempx est un contrôle MOTEUR
    // donc crochets » disparaît avec cette décision : ce n'est plus la déclaration `engine` de
    // `controls.json` qui tranche pour un réglage réservé, c'est sa nature de réglage.
    if (libCtx.qualifierKeys.has(key)) {
      throw new ParseError(
        `'[${key}:…]' : '${key}' est un réglage, il s'écrit entre PARENTHÈSES — '(${key}:…)' `
        + `(décision Romain 2026-08-02, LANGUAGE.md:773-800). Le crochet ne porte plus que ce qui `
        + `gouverne la dérivation elle-même : un test de drapeau ('[flag]', '[flag==1]'), une `
        + `affectation ('[flag=1]'), ou le rang d'une forme de gabarit ('[3]')`,
        tok);
    }
    // LE SAC DIT QUI REÇOIT — crochets = moteur, parenthèses = runtime. Un contrôle ne vit pas dans
    // les deux : `lib/controls.json` le déclare par sa STRUCTURE (section `engine` contre section
    // `runtime.*`), et cette structure fait autorité (décision 2026-06-14, « controls.json EST
    // L'AUTORITÉ ; transpose, rotate, keyxpand, vel… sont des contrôles RUNTIME, appliqués par le
    // DISPATCHER, JAMAIS par le moteur », qui se qualifie elle-même de règle établie).
    // Mesuré au corpus : 76 emplois étaient du mauvais côté, et la MAJORITÉ se trompait pour deux
    // d'entre eux — l'arbitre est la déclaration, jamais le nombre.
    if (universeSacs().runtime.has(key)) {
      // NOMMER LA BONNE RÉÉCRITURE. `[scale:2]` — valeur unique et numérique — n'est pas la gamme
      // microtonale mal rangée : c'est le contrôle moteur SUPPRIMÉ le 2026-07-26, subsumé par la
      // DURÉE COLLÉE. Renvoyer vers `(scale:2)` enverrait l'utilisateur écrire une gamme dont le
      // nom serait « 2 ». Deux choses portaient le même mot ; le message doit les distinguer.
      // À ce point le deux-points est déjà consommé : la valeur est le jeton COURANT.
      const valeurNumerique = (at(T.INT) || at(T.FLOAT))
        && (peek(1).type === T.RBRACKET || peek(1).type === T.COMMA || peek(1).type === T.SLASH);
      if (key === 'scale' && valeurNumerique) {
        throw new ParseError(
          `'[scale:N]' a été SUPPRIMÉ (décision Romain 2026-07-26) — la mise à l'échelle temporelle `
          + `d'un groupe s'écrit avec la DURÉE COLLÉE : '{A B}:N'. (À ne pas confondre avec la gamme `
          + `microtonale, qui est un contrôle de runtime : '(scale:nom clé)'.)`,
          tok);
      }
      throw new ParseError(
        `'[${key}:…]' : '${key}' est un contrôle de RUNTIME, il s'écrit entre PARENTHÈSES — `
        + `'(${key}:…)', ou '!(${key}:…)' pour le poser dans le flux. Les crochets s'adressent au `
        + `MOTEUR`,
        tok);
    }
    if (universeControlNames().has(key)) return;
    // Ne JAMAIS suggérer « utiliser (clé:…) » : les deux formes ne sont pas des synonymes
    // (constat bpx 2026-07-10). `![rotate:N]` réordonne la séquence (contrôle moteur sériel) ;
    // `(rotate:N)` transpose (paramètre de runtime, opaque). Suivre la suggestion ferait perdre
    // le réordre EN SILENCE. On nomme les deux familles, on n'en recommande aucune.
    throw new ParseError(
      `clé '[${key}:…]' inconnue — ni contrôle de librairie, ni garde, ni affectation, ni rang de ` +
      `gabarit ; vérifier l'orthographe, ou la librairie qui la déclare. '[${key}:…]' et ` +
      `'![${key}:…]' (contrôle moteur) ne sont PAS interchangeables avec '(${key}:…)' (paramètre ` +
      `de runtime)`,
      tok);
  }

  // tempoScope : 'absolute' (défaut — A[/N] suffixe d'élément, [/N] niveau-règle)
  // ou 'relative' (forme ![/N] dans le flux). Porté sur le nœud TempoOp pour que
  // les consommateurs (BPx) lisent la décision au lieu de deviner par position.
  // Réf : hub/decisions/2026-06-10-tempo-absolu-vs-relatif.md.
  // `(/N)` · `(*N/M)` — la VALEUR d'un changement de vitesse, lue après le `!` qui la pose dans
  // le flux. Le nœud produit est IDENTIQUE à celui que la forme en crochets rendait avant son
  // retrait : seule la GRAPHIE change, l'arbre ne bouge pas — donc aucun consommateur aval n'a
  // à s'adapter, et le lot reste une affaire de surface.
  function parseVitesseParenthese() {
    expect(T.LPAREN);
    const operator = at(T.STAR) ? (advance(), '*') : (expect(T.SLASH), '/');
    let value;
    if (at(T.INT)) {
      value = Number(advance().value);
      if (at(T.SLASH) && peek(1).type === T.INT) {
        const denom = (advance(), Number(advance().value));
        value = `${value}/${denom}`;
      }
    } else if (at(T.FLOAT)) {
      value = Number(advance().value);
    } else {
      throw new ParseError(
        `'! (${operator}…)' attend un nombre ou une fraction — '! (/2)', '! (*3/2)', '! (/1.5)'`,
        current());
    }
    expect(T.RPAREN);
    // `scope: 'relative'` — une vitesse posée dans le flux se compose avec celle en cours ; c'est
    // ce que portait déjà la forme de flux avant ce changement de graphie (décision 2026-06-10).
    return { type: 'Qualifier', pairs: [], tempoOp: { type: 'TempoOp', operator, value, scope: 'relative' } };
  }

  function parseQualifier(tempoScope = 'absolute') {
    expect(T.LBRACKET);

    // ⛔ PIERRE TOMBALE — L'OPÉRATEUR DE VITESSE NE S'ÉCRIT PLUS ENTRE CROCHETS.
    // Décision Romain 2026-08-06 (hub/decisions/2026-08-06-tempx-est-supprime-doublon-exact-de-
    // l-operateur-de-vitesse.md) : « la graphie est la parenthèse : (/2), (*2) — jamais le
    // crochet ». La bible ne connaît qu'une écriture, et elle est dans le FLUX
    // (LANGUAGE.md:1249 « ! (/N) · ! (*N/M) — changement de vitesse posé dans le flux »).
    //
    // ⚠️ LE REFUS NOMME LA POSITION AUTANT QUE LE SIGNE. La vitesse ne vit QUE dans le flux :
    // ni en suffixe de règle, ni collée à un élément (`AST.md`, tableau des portées — ❌ partout
    // sauf `!inline`). Mesuré au corpus le jour du retrait : 18 écritures au crochet, dont 15
    // déjà dans le flux — celles-là changent de signe et rien d'autre. Les 3 autres (2 en
    // suffixe de règle, 1 collée à un élément) n'ont PAS d'équivalent : elles doivent devenir
    // un élément de flux, ce que le message dit.
    if (atAny(T.SLASH, T.STAR)) {
      const signe = at(T.STAR) ? '*' : '/';
      throw new ParseError(
        `'[${signe}N]' : l'opérateur de vitesse s'écrit entre PARENTHÈSES et se pose dans le `
        + `FLUX — '! (${signe}N)' (décision Romain 2026-08-06). Il ne vit nulle part ailleurs : `
        + `ni en suffixe de règle, ni collé à un élément. '/N' accélère, '*N/M' écrit la même `
        + `chose en fraction inverse`,
        current());
    }

    const pairs = [];
    while (!at(T.RBRACKET) && !atEnd()) {
      const keyTok = current();
      const key = expect(T.IDENT).value;
      // Bare key without value: [destru], [striated], [volumecont]
      if (!at(T.COLON)) {
        pairs.push({ type: 'QualPair', key, value: true, decrement: null });
        if (at(T.COMMA)) advance();
        continue;
      }
      const apresDeuxPoints = current();
      expect(T.COLON);
      checkQualifierKey(key, keyTok);
      // Même règle dans le sac moteur — le format est le MÊME des deux côtés.
      if (!at(T.RBRACKET) && !atEnd() && current().spaceBefore) {
        throw new ParseError(
          `'${key}: ' — pas d'espace après le deux-points : la valeur commence immédiatement `
          + `('${key}:${current().value}…'). L'espace ne sépare que les PARTIES d'une valeur`,
          current());
      }
      void apresDeuxPoints;

      // --- Valeur d'une paire MOTEUR (modèle CSS) ---
      // L'espace sépare les PARTIES d'une valeur (`[goto: 3 0]`), la VIRGULE sépare les ÉLÉMENTS
      // du sac (`[mode:random, weight:50]`) — un rôle par signe, décision Romain 2026-07-26, et
      // la même règle que dans le sac runtime.
      //
      // AVANT, la virgule faisait les deux ici aussi : `[goto:3,1]` rendait la valeur « 3,1 »,
      // c'est-à-dire une LISTE POSITIONNELLE, supprimée par la même décision. On la refuse au
      // lieu de l'absorber en silence — 8 occurrences dans le corpus, migrées en `[goto: 3 1]`.
      if (libCtx.controlNames.has(key)) {
        let rawValue = '';
        while (!at(T.RBRACKET) && !atEnd()) {
          if (at(T.COMMA)) {
            // La virgule ferme la valeur. Si ce qui suit n'ouvre pas un nouvel ÉLÉMENT (une clé,
            // nue ou suivie de ':'), c'est le reste d'une liste positionnelle : on le NOMME.
            const suite = peek(1);
            const ouvreUnElement = suite.type === T.IDENT
              && (peek(2).type === T.COLON || peek(2).type === T.RBRACKET || peek(2).type === T.COMMA);
            if (!ouvreUnElement) {
              throw new ParseError(
                `'[${key}: ${rawValue.trim()},…]' : la virgule sépare les ÉLÉMENTS du sac, pas les `
                + `parties d'une valeur (liste positionnelle supprimée le 2026-07-26) — écrire `
                + `'[${key}:${rawValue.trim()} …]', les parties séparées par une ESPACE`,
                current());
            }
            break;
          }
          const t = current();
          // Mêmes deux règles que dans le sac runtime — le format est le MÊME dans les deux sacs :
          // le deux-points AFFECTE (une paire n'en porte qu'un), et il attend une valeur.
          if (t.type === T.COLON) {
            throw new ParseError(
              `'[${key}: ${rawValue.trim()}:…]' : le deux-points AFFECTE une valeur, il n'en sépare `
              + `pas les parties — une paire n'en porte qu'un. Les parties d'une valeur se séparent `
              + `par une ESPACE ('[${key}:3 0]')`,
              t);
          }
          if (rawValue.length > 0 && t.type !== T.RPAREN && t.type !== T.COMMA) {
            const lastChar = rawValue[rawValue.length - 1];
            if (lastChar !== '(' && t.type !== T.LPAREN && lastChar !== ',') {
              // No space after - (negative number: -7)
              // No space around / (ratio: 11/5)
              // No space around = (K-param: K1=2)
              const isSlash = t.type === T.SLASH || lastChar === '/';
              const isEquals = t.type === T.EQUALS || lastChar === '=';
              if (lastChar !== '-' && !isSlash && !isEquals) rawValue += ' ';
            }
          }
          rawValue += advance().value;
        }
        rawValue = rawValue.trim();
        if (rawValue === '') {
          throw new ParseError(
            `'[${key}:]' n'affecte aucune valeur — le deux-points en attend une (par exemple `
            + `'[${key}:3 0]'), et un contrôle sans argument s'écrit nu, sans deux-points`,
            keyTok);
        }
        pairs.push({ type: 'QualPair', key, value: rawValue, decrement: null });
        if (at(T.COMMA)) advance();
        continue;
      }

      // --- Standard qualifier value parsing ---
      // Ce chemin ne sert plus les clés réservées (`mode`, `weight`… REFUSÉES plus haut par
      // checkQualifierKey) : il reste pour un contrôle du REGISTRE non chargé par cette scène
      // (`universeControlNames()` sans `libCtx.controlNames`), cf. commentaire de checkQualifierKey.
      const gardeElement = () => {
        if (at(T.IDENT) && peek(1).type === T.COLON) {
          throw new ParseError(
            `'[${key}:… ${current().value}:…]' : deux ÉLÉMENTS du sac séparés par une ESPACE — `
            + `il leur manque une VIRGULE ('[${key}:…, ${current().value}:…]'). L'espace ne sépare `
            + `que les PARTIES d'une même valeur`,
            current());
        }
      };
      const { value, decrement } = readQualifierValue();
      gardeElement();
      pairs.push({ type: 'QualPair', key, value, decrement });
      if (at(T.COMMA)) advance();
    }
    expect(T.RBRACKET);
    return { type: 'Qualifier', pairs, tempoOp: null };
  }

  // Lecture de la VALEUR d'un réglage (entier, fraction, décimal, décrément `50-12`, signature
  // temporelle `4+4/6`, K-param `K1=3`, fallback `fallback(B)`). PARTAGÉE entre `parseQualifier`
  // (le résidu `[]` d'un contrôle du registre non chargé) et `parseRuntimeQualifier` (les
  // réglages réservés `mode`/`scan`/`weight`/`on_fail`/`tempx`/`meter`, désormais en `()`,
  // décision Romain 2026-08-02) — même format des deux côtés du sac, un seul lecteur.
  function readQualifierValue() {
    let value, decrement = null;
    if (at(T.INT)) {
      const num = advance().value;
      // Check for time signature: meter:4+4/6, meter:4+4+4+4/6
      if (at(T.PLUS) && peek(1).type === T.INT) {
        let sig = num;
        while (at(T.PLUS) && peek(1).type === T.INT) {
          sig += advance().value; // +
          sig += advance().value; // INT
        }
        if (at(T.SLASH) && peek(1).type === T.INT) {
          sig += advance().value; // /
          sig += advance().value; // INT
        }
        value = sig;
      // Check for ratio: speed:1/2
      } else if (at(T.SLASH) && peek(1).type === T.INT) {
        advance();
        const denom = advance().value;
        value = `${num}/${denom}`;
      } else {
        value = Number(num);
        // Check for decremental weight: 50-12
        if (at(T.REST) && peek(1).type === T.INT) {
          advance();
          decrement = Number(advance().value);
        }
      }
    } else if (at(T.FLOAT)) {
      value = Number(advance().value);
    } else if (at(T.REST)) {
      // Negative number: transpose:-12
      const sign = advance().value;
      value = sign + (at(T.INT) ? advance().value : '');
    } else if (at(T.IDENT)) {
      value = advance().value;
      // Check for K-param assignment: weight:K1=3
      if (at(T.EQUALS) && peek(1).type === T.INT) {
        advance(); // =
        value = `${value}=${advance().value}`;
      }
      // Check for on_fail:fallback(B)
      else if (at(T.LPAREN)) {
        advance();
        const arg = at(T.IDENT) ? advance().value : expect(T.INT).value;
        expect(T.RPAREN);
        value = `${value}(${arg})`;
      }
    }
    return { value, decrement };
  }

  // ============================================================
  // Entry point
  // ============================================================

  return parseScene();
}

export { parse, ParseError };
