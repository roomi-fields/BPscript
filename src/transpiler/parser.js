/**
 * BPScript Parser
 * Source: BPSCRIPT_EBNF.md (Couches 1-4) + BPSCRIPT_AST.md
 *
 * Converts token array into AST (Scene node).
 * Recursive descent parser.
 */

import { T } from './tokenizer.js';
import { loadLibsFromDirectives } from './libs.js';
import { BP3_OPERATORS, PRODUCTION_DIRECTIVES } from './constants.js';

class ParseError extends Error {
  constructor(msg, token) {
    super(`${msg} at line ${token.line}:${token.col}`);
    this.token = token;
  }
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
        for (const [secName, mappings] of Object.entries(table.sections)) {
          const pairs = Object.entries(mappings); // already [from, to]
          result.push({ type: 'Homomorphism', name: secName, pairs, line });
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
      maps: [],
      aliases: [],
      labels: [],
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
        } else if (dir.type === 'MapDirective') {
          scene.maps.push(dir);
        } else if (dir.type === 'MacroDirective') {
          scene.macros.push(dir);
        } else if (dir.type === 'AliasDirective') {
          scene.aliases.push(dir);
        } else if (dir.type === 'LabelDirective') {
          scene.labels.push(dir);
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
            // décision PM : PAS de duplication ; on retire de l'ActorDirective
            delete dir.soundAssignments;
          }
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
        scene.declarations.push(parseDeclaration());
      } else if (at(T.BACKTICK)) {
        scene.backticks.push(parseBacktickOrphan());
      } else if (at(T.IDENT) && isLookaheadCVInstance()) {
        scene.cvInstances.push(parseCVInstance());
      } else if (at(T.IDENT) && isLookaheadMacro()) {
        scene.macros.push(parseMacro());
      } else if (isRuleStart()) {
        break; // Start of rules
      } else {
        break;
      }
      skipNewlines();
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

    // Parse optional @template (v0.8 singular) or @templates (v0.7 plural) section.
    // En v0.8, le champ AST canonique est `template` (singulier). On garde
    // `templates` pour rétrocompat avec les consommateurs existants (encoder).
    skipNewlines();
    scene.template = null;
    scene.templates = null;
    if (at(T.AT) && peek(1).type === T.IDENT &&
        (peek(1).value === 'template' || peek(1).value === 'templates')) {
      const entries = parseTemplateSection();
      scene.template = entries;
      scene.templates = entries;  // alias rétrocompat — même tableau (pas de copie)
    }

    return scene;
  }

  // ============================================================
  // Directives
  // ============================================================

  /**
   * Parse a @map endpoint: cc:N, osc:/path, <!trigger, [flag], or named-cc alias.
   * Returns { kind, ... } descriptor.
   */
  function parseMapEndpoint() {
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
        const params = at(T.LPAREN) ? parseMapParams() : null;
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
        const params = at(T.LPAREN) ? parseMapParams() : null;
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
    throw new ParseError('Expected cc:N, osc:/path, <!trigger, [flag] or alias in @map', current());
  }

  /** Parse optional (key:value, ...) params for @map endpoints */
  function parseMapParams() {
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
  function parseDirectiveColonValue() {
    let value = null, runtime = null;
    // Handle negative values: @transpose:-24
    let negative = false;
    if (at(T.REST)) { // - token
      negative = true;
      advance();
    }
    if (at(T.INT)) {
      const num = advance().value;
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
        ({ value, runtime } = parseDirectiveColonValue());
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
    // @alphabet.western — dot accessor for subkey within a lib
    if (at(T.PERIOD)) {
      advance();
      subkey = expect(T.IDENT).value;
    }
    let runtime = null, value = null, aliases = null;

    // @scene verse "verse.bps" — child scene declaration
    if (name === 'scene') {
      const sceneName = expect(T.IDENT).value;
      const file = expect(T.STRING).value;
      return { type: 'SceneDirective', name: sceneName, file, line: tok.line };
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

    // @macro kick = (vel:120) or @macro accent(x) = x(vel:120)
    if (name === 'macro') {
      const macroName = expect(T.IDENT).value;
      const params = [];
      // Params only if ( is followed by ) = (i.e. param list before =)
      if (at(T.LPAREN) && !current().spaceBefore) {
        // Lookahead: is there a ) then = ? If not, it's part of the body
        let j = pos + 1, depth = 1;
        while (j < tokens.length && depth > 0) {
          if (tokens[j].type === T.LPAREN) depth++;
          if (tokens[j].type === T.RPAREN) depth--;
          j++;
        }
        if (tokens[j]?.type === T.EQUALS) {
          advance(); // consume (
          while (!at(T.RPAREN) && !atEnd()) {
            params.push(expect(T.IDENT).value);
            if (at(T.COMMA)) advance();
          }
          expect(T.RPAREN);
        }
      }
      expect(T.EQUALS);
      // Body: if it starts with ( and looks like key:value → standalone runtime qualifier
      // parseRhsElements would reject floating () before libCtx is loaded, so handle directly
      let body;
      if (at(T.LPAREN) && peek(1).type === T.IDENT && peek(2).type === T.COLON) {
        body = [{ type: 'InstantControl', qualifier: parseRuntimeQualifier() }];
      } else {
        body = parseRhsElements();
      }
      return { type: 'MacroDirective', name: macroName, params, body, line: tok.line };
    }

    // @alias breath = cc:2
    if (name === 'alias') {
      const aliasName = expect(T.IDENT).value;
      expect(T.EQUALS);
      const source = parseMapEndpoint();
      return { type: 'AliasDirective', name: aliasName, source, line: tok.line };
    }

    // @label hat — named label for @ suffixe
    if (name === 'label') {
      const labelName = expect(T.IDENT).value;
      return { type: 'LabelDirective', name: labelName, line: tok.line };
    }

    // @gate Sa:midi, @trigger dha:sc, @cv ramp:sc — prefixed declarations
    if (name === 'gate' || name === 'trigger' || name === 'cv') {
      const declName = expect(T.IDENT).value;
      expect(T.COLON);
      const runtime = expect(T.IDENT).value;
      return { type: 'Declaration', temporalType: name, name: declName, runtime, line: tok.line };
    }

    // @map source -> target — I/O mapping (CC/OSC ↔ triggers/flags)
    if (name === 'map') {
      const source = parseMapEndpoint();
      // Arrow: -> or <-> or <-
      let arrow;
      if (at(T.ARROW_R))      { arrow = '->'; advance(); }
      else if (at(T.ARROW_BI)) { arrow = '<->'; advance(); }
      else if (at(T.ARROW_L))  { arrow = '<-'; advance(); }
      else throw new ParseError('Expected ->, <-> or <- in @map', current());
      const target = parseMapEndpoint();
      return { type: 'MapDirective', source, arrow, target, line: tok.line };
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

    // @flag scene: calm:1, full:2 — états de drapeau nommés (A5). Nomme les valeurs
    // entières d'un drapeau ; les gardes/mutations peuvent ensuite tester/poser par nom
    // ([scene==calm] → /scene=1/). Calqué sur @cc (name:int).
    if (name === 'flag') {
      const flagName = expect(T.IDENT).value;
      if (at(T.COLON)) advance();  // séparateur optionnel après le nom du drapeau
      const states = [];
      while (at(T.IDENT)) {
        const stName = advance().value;
        expect(T.COLON);
        const stVal = Number(expect(T.INT).value);
        states.push({ name: stName, value: stVal });
        if (at(T.COMMA)) advance();
      }
      return { type: 'FlagStatesDirective', flag: flagName, states, line: tok.line };
    }

    // @actor name <body>
    //
    // v0.8 (forme canonique) : références d'entités via `.`
    //   @actor sitar
    //     alphabet.sargam
    //     tuning.sargam_22shruti
    //     transport.midi(ch:3, vel:100)
    //     eval.python
    //     sound.bell_short            // équivaut à *:sound.bell_short
    //     *:sound.bell_short          // affectation défaut
    //     Sa:sound.drum_kick          // affectation note
    //
    // v0.7 (rétrocompat transitoire, accepté en silence) : références via `:`
    //   @actor sitar alphabet:sargam tuning:sargam_22shruti transport:midi(ch:3)
    //
    // Les deux formes peuvent être mêlées sur la même ligne et le parseur
    // bascule par token (le `*` ou un IDENT:sound.X = affectation, sinon
    // entity_ref).
    if (name === 'actor') {
      const actorName = expect(T.IDENT).value;
      const properties = {};
      const soundAssignments = [];

      // Helper: parser les params d'un transport `(ch:3, vel:100)`
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
      // (alphabet, tuning, transport, sound, eval).
      const setEntityRef = (key, value, params /* | null */) => {
        if (key === 'transport') {
          properties.transport = { type: 'TransportRef', key: value, params: params || {} };
        } else if (key === 'sound') {
          // sound.X dans @actor X = sucre pour *:sound.X (cf. EBNF v0.8 ligne 104).
          // On enregistre la référence sur properties.sound (pour l'actorResolver)
          // ET on émet une SoundAssignment scope=actor subject=*.
          properties.sound = value;
          soundAssignments.push({
            type: 'SoundAssignment',
            scope: { kind: 'actor', name: actorName },
            subject: '*',
            target: { kind: 'named-ref', name: value },
            line: tok.line,
          });
        } else {
          // alphabet, tuning, eval — référence simple
          properties[key] = value;
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
            scope: { kind: 'actor', name: actorName },
            subject: '*',
            target,
            line: tok.line,
          });
          continue;
        }

        if (!at(T.IDENT)) break;

        const key = current().value;
        const next = peek(1).type;

        // forme v0.8 : `alphabet.X`, `tuning.X`, `transport.X[(...)`, `sound.X`, `eval.X`
        if (next === T.PERIOD && !peek(1).spaceBefore) {
          // Vérifier qu'on est sur une clé reconnue (sinon, sortir : c'est un
          // symbole, début de règle).
          const isEntityKey = key === 'alphabet' || key === 'tuning' ||
                              key === 'transport' || key === 'sound' ||
                              key === 'eval';
          if (!isEntityKey) break;
          advance();           // consume key IDENT
          advance();           // consume PERIOD
          const value = expect(T.IDENT).value;
          let params = null;
          if (at(T.LPAREN) && !current().spaceBefore) params = parseRefParams();
          setEntityRef(key, value, params);
          continue;
        }

        // forme v0.7 : `alphabet:X`, `tuning:X`, `transport:X(...)`, `sounds:X`
        if (next === T.COLON && !peek(1).spaceBefore) {
          // Affectation : `Sa:sound.X` ou `Sa:{ ... }`. Détection : le 3e token
          // est IDENT "sound" PERIOD IDENT (affectation), ou LBRACE (inline).
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
              scope: { kind: 'actor', name: actorName },
              subject,
              target,
              line: tok.line,
            });
            continue;
          }

          // forme v0.7 entité — accepté en rétrocompat
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
      return {
        type: 'ActorDirective',
        name: actorName,
        properties,
        soundAssignments: soundAssignments.length > 0 ? soundAssignments : null,
        line: tok.line,
      };
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

    if (at(T.COLON)) {
      advance();
      ({ value, runtime } = parseDirectiveColonValue());
    }

    // Mode modifiers: @mode:random(destru, smooth, mm:60)
    let modifiers = null;
    if (name === 'mode' && at(T.LPAREN)) {
      advance();
      modifiers = [];
      while (!at(T.RPAREN) && !atEnd()) {
        const modName = expect(T.IDENT).value;
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
            scope: { kind: 'alphabet', name: subkey },
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
              scope: { kind: 'alphabet', name: subkey },
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
  // CV Instances — env1(Phrase1, browser) = filter.adsr(10, 200, 0.5, 300)
  // ============================================================

  function isLookaheadCVInstance() {
    // IDENT LPAREN ... RPAREN EQUALS (IDENT PERIOD IDENT LPAREN | BACKTICK)
    let j = pos;
    if (tokens[j]?.type !== T.IDENT) return false;
    j++;
    if (tokens[j]?.type !== T.LPAREN) return false;
    // Skip until matching RPAREN
    let depth = 1;
    j++;
    while (j < tokens.length && depth > 0) {
      if (tokens[j].type === T.LPAREN) depth++;
      else if (tokens[j].type === T.RPAREN) depth--;
      j++;
    }
    if (tokens[j]?.type !== T.EQUALS) return false;
    j++;
    // Skip newlines
    while (tokens[j]?.type === T.NEWLINE) j++;
    // Backtick form: name(target, transport) = `...`
    if (tokens[j]?.type === T.BACKTICK) return true;
    // Lib form: IDENT PERIOD IDENT LPAREN
    if (tokens[j]?.type === T.IDENT &&
        tokens[j+1]?.type === T.PERIOD &&
        tokens[j+2]?.type === T.IDENT &&
        tokens[j+3]?.type === T.LPAREN) return true;
    return false;
  }

  function parseCVInstance() {
    const tok = current();
    const name = expect(T.IDENT).value;

    // (target, transport)
    expect(T.LPAREN);
    const target = expect(T.IDENT).value;
    expect(T.COMMA);
    const transport = expect(T.IDENT).value;
    expect(T.RPAREN);

    expect(T.EQUALS);
    skipNewlines();

    // RHS: backtick or lib.objectType(args...)
    if (at(T.BACKTICK)) {
      const code = advance().value;
      return {
        type: 'CVInstance', name, target, transport,
        lib: null, objectType: 'backtick', args: [], namedArgs: {},
        code, line: tok.line
      };
    }

    // lib.objectType(args...)
    const lib = expect(T.IDENT).value;
    expect(T.PERIOD);
    const objectType = expect(T.IDENT).value;
    expect(T.LPAREN);

    const args = [];
    const namedArgs = {};
    while (!at(T.RPAREN) && !atEnd()) {
      // Check for named arg: key:value
      if (at(T.IDENT) && peek(1).type === T.COLON) {
        const key = advance().value;
        advance(); // :
        const val = at(T.IDENT) ? advance().value :
                    at(T.INT) ? Number(advance().value) :
                    at(T.FLOAT) ? Number(advance().value) :
                    advance().value;
        namedArgs[key] = val;
      } else {
        // Positional arg
        const val = at(T.INT) ? Number(advance().value) :
                    at(T.FLOAT) ? Number(advance().value) :
                    at(T.IDENT) ? advance().value :
                    advance().value;
        args.push(val);
      }
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);

    return {
      type: 'CVInstance', name, target, transport,
      lib, objectType, args, namedArgs, line: tok.line
    };
  }

  // ============================================================
  // Declarations
  // ============================================================

  function parseDeclaration() {
    const tok = current();
    const temporalType = advance().value; // gate | trigger | cv
    const name = expect(T.IDENT).value;
    expect(T.COLON);
    const runtime = expect(T.IDENT).value;
    return { type: 'Declaration', temporalType, name, runtime, line: tok.line };
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
    return { type: 'Macro', name, params, body, line: tok.line };
  }

  // ============================================================
  // Backtick orphan
  // ============================================================

  function parseBacktickOrphan() {
    const tok = current();
    const raw = expect(T.BACKTICK).value;
    const colonIdx = raw.indexOf(':');
    if (colonIdx === -1) throw new ParseError('Orphan backtick must be tagged (sc:, py:, tidal:)', tok);
    const tag = raw.substring(0, colonIdx).trim();
    const code = raw.substring(colonIdx + 1).trim();
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
      // Stop if @templates — that's a separate section after all subgrammars
      let blockMode = currentMode;
      let blockModifiers = currentModifiers;
      while (at(T.AT)) {
        // v0.8: la section template est en singulier ; v0.7 acceptée en alias.
        if (peek(1).type === T.IDENT &&
            (peek(1).value === 'template' || peek(1).value === 'templates')) break;
        const dir = parseDirective();
        if (dir.name === 'mode' && dir.runtime) {
          blockMode = dir.runtime;  // @mode:random → runtime='random'
          currentMode = blockMode;  // persists to following blocks
          blockModifiers = dir.modifiers || null;
          currentModifiers = blockModifiers;
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
          break;
        }
        skipNewlines();
      }

      if (rules.length > 0) {
        subs.push({ type: 'Subgrammar', index: index++, rules, mode: blockMode, modifiers: blockModifiers });
      } else {
        break; // No rules found → stop parsing subgrammars
      }

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
    const kw = expect(T.IDENT);    // template (v0.8) ou templates (v0.7 alias)
    if (kw.value !== 'template' && kw.value !== 'templates') {
      throw new ParseError(`Expected 'template' or 'templates' after @`, kw);
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

    // Runtime qualifier suffix on rule: S -> C2 C2 (vel:100)
    // Loose check: accept opaque keys even when no @controls lib is loaded
    // (EBNF couche 3 — rule = ... rhs , [ runtime_qualifier ]).
    let runtimeQualifier = null;
    if (isRuntimeQualifierLoose()) {
      runtimeQualifier = parseRuntimeQualifier();
    }

    // Qualifiers and RHS flags — both use []
    const qualifiers = [];
    const flags = [];
    while (at(T.LBRACKET)) {
      if (isFlagBracket()) {
        flags.push(...parseFlagBracket());
      } else {
        qualifiers.push(parseQualifier());
      }
    }

    // B2 : extraire rule.mode depuis le qualificateur [scan:left|right|rnd]
    // (BPx ast.ts:431-449 lit ast.mode ; l'encoder encoder.js:331-335 lit aussi
    //  le qualifier pour émettre le préfixe BP3 → la QualPair est conservée.)
    const VALID_SCAN_MODES = { left: 'left', right: 'right', rnd: 'rnd' };
    let ruleMode = null;
    for (const qual of qualifiers) {
      for (const pair of (qual.pairs || [])) {
        if (pair.key === 'scan') {
          if (VALID_SCAN_MODES[pair.value] !== undefined) {
            ruleMode = VALID_SCAN_MODES[pair.value];
          } else {
            throw new ParseError(
              `[scan:${pair.value}] : valeur inconnue (attendu : left, right, rnd)`,
              { line: tok.line, col: 0 }
            );
          }
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

    return { type: 'Rule', guard, contexts, lhs, arrow, rhs, flags, qualifiers, runtimeQualifier, mode: ruleMode, line: tok.line, warnings };
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
      if (at(T.LBRACKET) && current().spaceBefore) break;
      if (at(T.LPAREN) && current().spaceBefore && isRuntimeQualifierLoose()) break;
      if (++safety > 500) throw new ParseError('RHS parse loop safety limit', current());
      // Unbalanced } or , at top level — embedding pattern
      if (atAny(T.RBRACE, T.COMMA) && isNewRuleAhead()) break;
      if (at(T.RBRACE)) {
        advance();
        const rawBrace = { type: 'RawBrace', value: '}' };
        // Suffix qualifier on closing brace: }[speed:N] (no space)
        if (at(T.LBRACKET) && !current().spaceBefore && isPolymetricQualifier()) {
          rawBrace.qualifiers = [];
          while (at(T.LBRACKET) && !current().spaceBefore && isPolymetricQualifier()) {
            rawBrace.qualifiers.push(parseQualifier());
          }
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

      // @ suffixe: C4@kick — label attachment (no space before @)
      if (at(T.AT) && !current().spaceBefore) {
        advance();
        el.label = expect(T.IDENT).value;
      }

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

  function isRuntimeQualifierLoose() {
    // Syntactic check: `(IDENT:value...)` regardless of whether IDENT is a
    // known control. Used to detect rule-level / standalone runtime qualifiers
    // that should be opaque (passed through to the dispatcher even when no
    // @controls lib is loaded). The strict isRuntimeQualifier() is still used
    // for collé suffix attachment so SymbolCall vs Symbol+suffix routing stays
    // controlNames-driven.
    if (!at(T.LPAREN)) return false;
    if (peek(1).type !== T.IDENT) return false;
    return peek(2).type === T.COLON;
  }

  function parseRuntimeQualifier() {
    // (vel:80, wave:sawtooth, velcont) → runtime qualifier AST.
    // v0.8 : accepte aussi `(sound.NAME)` — référence pointée comme valeur ;
    // équivalent sémantique à `(sound:NAME)` mais notation plus lisible.
    expect(T.LPAREN);
    const pairs = [];
    while (!at(T.RPAREN) && !atEnd()) {
      const key = expect(T.IDENT).value;
      // v0.8 — référence pointée : `sound.bell_short` (sans COLON)
      if (at(T.PERIOD)) {
        advance(); // .
        const name = expect(T.IDENT).value;
        pairs.push({ key, value: name });
        if (at(T.COMMA)) advance();
        continue;
      }
      if (at(T.COLON)) {
        advance();
        // Raw value: everything until next key:value pair or )
        // Commas between args of the same control (e.g. keyxpand:G4,2)
        // are part of the value, not separator for next pair.
        // A comma is a pair separator only if followed by IDENT COLON.
        let val;
        if (at(T.REST)) { // negative number
          advance();
          val = -Number(expect(T.INT).value);
        } else if (at(T.INT) || at(T.FLOAT)) {
          val = Number(advance().value);
        } else {
          // String value — collect until next pair (IDENT:) or )
          let parts = [];
          while (!at(T.RPAREN) && !atEnd()) {
            // Stop at , only if followed by IDENT: (next qualifier pair)
            if (at(T.COMMA) && peek(1).type === T.IDENT && peek(2).type === T.COLON) break;
            // v0.8 : stop at , if followed by IDENT PERIOD IDENT (référence pointée
            // = nouvelle pair, e.g. `, sound.bell`).
            if (at(T.COMMA) && peek(1).type === T.IDENT && peek(2).type === T.PERIOD
                && libCtx.controlNames.has(peek(1).value)) break;
            // Stop at , if followed by bare IDENT ) — but only if IDENT is a known control
            if (at(T.COMMA) && peek(1).type === T.IDENT && peek(2).type === T.RPAREN
                && libCtx.controlNames.has(peek(1).value)) break;
            if (at(T.COMMA) && peek(1).type === T.IDENT && peek(2).type === T.COMMA
                && libCtx.controlNames.has(peek(1).value)) break;
            parts.push(advance().value);
          }
          val = parts.join('');
        }
        // If comma follows and next token is NOT IDENT: → multi-arg value, keep collecting
        while (at(T.COMMA) && !(peek(1).type === T.IDENT && peek(2).type === T.COLON)
                           && !(peek(1).type === T.IDENT && peek(2).type === T.PERIOD && libCtx.controlNames.has(peek(1).value))
                           && !(peek(1).type === T.IDENT && peek(2).type === T.RPAREN && libCtx.controlNames.has(peek(1).value))
                           && !(peek(1).type === T.IDENT && peek(2).type === T.COMMA && libCtx.controlNames.has(peek(1).value))
                           && !at(T.RPAREN) && !atEnd()) {
          advance(); // skip comma
          val = String(val) + ',';
          if (at(T.REST)) {
            advance();
            val += '-' + (at(T.INT) ? advance().value : '');
          } else if (at(T.INT) || at(T.FLOAT)) {
            val += advance().value;
          } else {
            while (!at(T.COMMA) && !at(T.RPAREN) && !atEnd()) {
              val += advance().value;
            }
          }
        }
        pairs.push({ key, value: val });
      } else {
        // Bare key (no-arg control like velcont, pitchcont)
        pairs.push({ key, value: true });
      }
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);
    return { type: 'RuntimeQualifier', pairs };
  }

  function isPerElementQualifier() {
    // [IDENT:...] or [IDENT] where IDENT is a known control name = per-element qualifier
    // Used for engine qualifier [speed:2]A or A[weight:50] or {[retro] A}
    if (!at(T.LBRACKET)) return false;
    const nextTok = peek(1);
    if (nextTok.type !== T.IDENT) return false;
    return libCtx.controlNames.has(nextTok.value);
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

    // Prolongation _
    if (at(T.PROLONG)) {
      advance();
      return { type: 'Prolongation' };
    }

    // Undetermined rest ...
    if (at(T.UNDETERMINED)) {
      advance();
      return { type: 'UndeterminedRest' };
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
      advance();
      // !(...) → instant runtime control
      if (isRuntimeQualifier()) {
        return { type: 'InstantControl', qualifier: parseRuntimeQualifier() };
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
        return { type: 'InstantControl', qualifier: parseQualifier('relative') };
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
      return parseTriggerIn();
    }

    // Hash (context in RHS)
    if (at(T.HASH)) {
      return parseContext();
    }

    // Backtick standalone (tagged)
    if (at(T.BACKTICK)) {
      const raw = advance().value;
      const colonIdx = raw.indexOf(':');
      if (colonIdx > 0) {
        return { type: 'BacktickStandalone', tag: raw.substring(0, colonIdx).trim(), code: raw.substring(colonIdx + 1).trim(), line: tok.line };
      }
      return { type: 'BacktickInline', code: raw, tag: null };
    }

    // Numeric duration: INT or INT/INT
    if (at(T.INT) && !isSymbolCallAhead()) {
      const num = Number(advance().value);
      if (at(T.SLASH) && peek(1).type === T.INT) {
        advance();
        const denom = Number(advance().value);
        return { type: 'NumericDuration', numerator: num, denominator: denom };
      }
      return { type: 'NumericDuration', numerator: num, denominator: 1 };
    }

    // Identifier — could be Symbol, SymbolCall, Control, or TieStart
    if (at(T.IDENT)) {
      const name = advance().value;

      // Actor dot notation: sitar.Sa → { type: 'Symbol', name: 'Sa', actor: 'sitar' }
      // Only if first IDENT is a known actor and followed by .IDENT (no space before .)
      if (at(T.PERIOD) && !current().spaceBefore && peek(1).type === T.IDENT
          && libCtx.actors && libCtx.actors[name]) {
        advance(); // consume PERIOD
        const terminal = advance().value;
        return { type: 'Symbol', name: normalizeName(terminal), actor: name, line: tok.line };
      }

      // Tie start: C4~
      if (at(T.TILDE)) {
        advance();
        return { type: 'TieStart', symbol: name };
      }

      // Control: vel(120), goto(2,1) — check BEFORE symbol call
      if (at(T.LPAREN) && isControlName(name)) {
        return parseControl(name, tok);
      }

      // Control without args: striated, smooth, destru, stop
      if (!at(T.LPAREN) && isControlName(name) && isNoArgControl(name)) {
        return { type: 'Control', name, args: [] };
      }

      // Runtime qualifier suffix: D4(vel:70) — no space = attached to symbol
      // Let parseRhsElements handle suffix attachment via spaceBefore
      // But we must check here to avoid confusing with symbol call
      if (isRuntimeQualifier() && !current().spaceBefore) {
        // Return bare symbol — suffix will be attached by parseRhsElements
        return { type: 'Symbol', name: normalizeName(name), line: tok.line };
      }

      // Symbol call: Sa(custom_param:120) — only if collé (no space) and NOT a known runtime control
      if (at(T.LPAREN) && !current().spaceBefore && !isContextLookahead()) {
        return parseSymbolCall(name, tok);
      }

      // Simultaneous: Sa!dha!phase=2
      // But NOT !() or ![] — those are standalone InstantControls for the next iteration
      if (at(T.BANG) && peek(1).type !== T.LPAREN && peek(1).type !== T.LBRACKET) {
        return parseSimultaneousGroup(name, tok);
      }

      // Trigger in on symbol: Sa<!sync1
      if (at(T.TRIGGER_IN)) {
        const triggerIns = [];
        while (at(T.TRIGGER_IN)) {
          triggerIns.push(parseTriggerIn());
        }
        return {
          type: 'SymbolWithTriggerIn',
          symbol: { type: 'Symbol', name: normalizeName(name), line: tok.line },
          triggers: triggerIns,
        };
      }

      // Plain symbol (might be a control like vel, tempo, goto)
      // Check if it's a control: name(args) without being a symbol call context
      if (at(T.LPAREN) && isControlName(name)) {
        return parseControl(name, tok);
      }

      return { type: 'Symbol', name: normalizeName(name), line: tok.line };
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

  function isControlName(name) {
    return libCtx.controlNames.has(name);
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
      if (at(T.BACKTICK)) {
        const raw = advance().value;
        value = { type: 'BacktickInline', code: raw, tag: null };
      } else if (at(T.INT)) {
        value = { type: 'Literal', value: Number(advance().value) };
      } else if (at(T.FLOAT)) {
        value = { type: 'Literal', value: Number(advance().value) };
      } else if (at(T.IDENT)) {
        value = { type: 'Literal', value: advance().value };
      } else {
        throw new ParseError('Expected argument value', current());
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

    // Check for ! after call
    if (at(T.BANG)) {
      return parseSimultaneousGroup(name, tok, args);
    }

    return { type: 'SymbolCall', name, args, line: tok.line };
  }

  function parseControl(name, tok) {
    expect(T.LPAREN);
    const args = [];
    while (!at(T.RPAREN) && !atEnd()) {
      // Build composite arg: K1=3, Cmaj, 120, etc.
      let arg = '';
      while (!at(T.RPAREN) && !at(T.COMMA) && !atEnd()) {
        const t = current();
        if (t.type === T.INT || t.type === T.FLOAT || t.type === T.IDENT) {
          // Preserve spaces between words: "MIDI send Continue", "wait for do#2 channel 1"
          // But NOT after # (so "#98" stays together)
          if (arg.length > 0 && !/[#=]$/.test(arg) && /[a-zA-Z0-9]$/.test(arg) && (t.type === T.IDENT || t.type === T.INT || t.type === T.FLOAT)) arg += ' ';
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
        } else if (t.type === T.HASH) {
          // Allow # in control args: "MIDI controller #98 = 0"
          if (arg.length > 0 && /[a-zA-Z0-9]$/.test(arg)) arg += ' ';
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

    // Runtime qualifier on group: {}(vel:100)
    let runtimeQualifier = null;
    if (isRuntimeQualifier()) {
      runtimeQualifier = parseRuntimeQualifier();
    }

    return { type: 'Polymetric', voices, qualifiers, runtimeQualifier, label: label || null };
  }

  function isPolymetricQualifier() {
    // Lookahead: check if [key:...] is a polymetric qualifier (speed, scale)
    if (!at(T.LBRACKET)) return false;
    const nextTok = peek(1);
    if (nextTok.type !== T.IDENT) return false;
    const key = nextTok.value;
    return key === 'speed' || key === 'scale';
  }

  function parseVariable() {
    expect(T.PIPE);
    const name = expect(T.IDENT).value;
    expect(T.PIPE);
    return { type: 'Variable', name };
  }

  function parseWildcard() {
    expect(T.QUESTION);
    let index = null;
    if (at(T.INT)) index = Number(advance().value);
    return { type: 'Wildcard', index };
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
    // Parse () as template params ONLY if not a runtime qualifier
    if (at(T.LPAREN) && !isRuntimeQualifier()) {
      args = [];
      advance();
      while (!at(T.RPAREN) && !atEnd()) {
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
      }
      expect(T.RPAREN);
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
      }
      expect(T.RBRACE);
      return { type: 'TemplateSlaveGroup', elements };
    }

    const name = expect(T.IDENT).value;
    let args = null;
    // Parse () as template params ONLY if not a runtime qualifier
    if (at(T.LPAREN) && !isRuntimeQualifier()) {
      args = [];
      advance();
      while (!at(T.RPAREN) && !atEnd()) {
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
      }
      expect(T.RPAREN);
    }
    return { type: 'TemplateSlave', name, args };
  }

  function parseTriggerIn() {
    expect(T.TRIGGER_IN);
    const name = expect(T.IDENT).value;
    const qualifiers = [];
    while (at(T.LBRACKET)) qualifiers.push(parseQualifier());
    return { type: 'TriggerIn', name, qualifiers };
  }

  // tempoScope : 'absolute' (défaut — A[/N] suffixe d'élément, [/N] niveau-règle)
  // ou 'relative' (forme ![/N] dans le flux). Porté sur le nœud TempoOp pour que
  // les consommateurs (BPx) lisent la décision au lieu de deviner par position.
  // Réf : hub/decisions/2026-06-10-tempo-absolu-vs-relatif.md.
  function parseQualifier(tempoScope = 'absolute') {
    expect(T.LBRACKET);

    // Check for tempo operator: [/2], [\2], [*3], [**3]
    if (atAny(T.SLASH, T.STAR)) {
      let operator;
      if (at(T.STAR)) { operator = '*'; advance(); }
      else if (at(T.SLASH)) { operator = '/'; advance(); }
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
        throw new ParseError('Expected number or fraction (e.g. /2, *3/2, /1.5) after tempo operator', current());
      }
      // If followed by , → mixed qualifier [/5, mode:random, transpose:-7]
      const tempoOp = { type: 'TempoOp', operator, value, scope: tempoScope };
      if (at(T.COMMA)) {
        advance(); // skip ,
        // Parse remaining pairs
        const pairs = [];
        while (!at(T.RBRACKET) && !atEnd()) {
          const key = expect(T.IDENT).value;
          if (!at(T.COLON)) {
            pairs.push({ type: 'QualPair', key, value: true, decrement: null });
            if (at(T.COMMA)) advance();
            continue;
          }
          expect(T.COLON);
          if (key === 'shuffle') {
            throw new ParseError(`'[shuffle:N]' retiré — la graine s'écrit '[@seed:N]' ou '![@seed:N]' ; '[shuffle]' brasse seul`, current());
          }
          let pval, decrement = null;
          if (at(T.INT)) {
            const num = advance().value;
            if (at(T.PLUS) && peek(1).type === T.INT) {
              let sig = num;
              while (at(T.PLUS) && peek(1).type === T.INT) { sig += advance().value; sig += advance().value; }
              if (at(T.SLASH) && peek(1).type === T.INT) { sig += advance().value; sig += advance().value; }
              pval = sig;
            } else if (at(T.SLASH) && peek(1).type === T.INT) {
              advance(); pval = `${num}/${advance().value}`;
            } else {
              pval = Number(num);
              if (at(T.REST) && peek(1).type === T.INT) { advance(); decrement = Number(advance().value); }
            }
          } else if (at(T.REST)) {
            // Negative number: transpose:-7
            const sign = advance().value;
            pval = sign + (at(T.INT) ? advance().value : '');
          } else if (at(T.IDENT)) {
            pval = advance().value;
            if (at(T.EQUALS) && peek(1).type === T.INT) { advance(); pval = `${pval}=${advance().value}`; }
          }
          pairs.push({ type: 'QualPair', key, value: pval, decrement });
          if (at(T.COMMA)) advance();
        }
        expect(T.RBRACKET);
        return { type: 'Qualifier', pairs, tempoOp };
      }
      expect(T.RBRACKET);
      return { type: 'Qualifier', pairs: [], tempoOp };
    }

    const pairs = [];
    while (!at(T.RBRACKET) && !atEnd()) {
      const key = expect(T.IDENT).value;
      // Bare key without value: [destru], [striated], [volumecont]
      if (!at(T.COLON)) {
        pairs.push({ type: 'QualPair', key, value: true, decrement: null });
        if (at(T.COMMA)) advance();
        continue;
      }
      expect(T.COLON);

      // [shuffle:N] RETIRÉ (décision 2026-06-14-shuffle-seed-orthogonaux) : brasser et
      // re-semer sont deux atomes BP3 distincts (_rndseq / _srand). La graine s'écrit
      // [@seed:N] (global) ou ![@seed:N] (dans le flux). [shuffle] (nu) reste = _rndseq.
      if (key === 'shuffle') {
        throw new ParseError(`'[shuffle:N]' retiré — la graine s'écrit '[@seed:N]' (global) ou '![@seed:N]' (dans le flux) ; '[shuffle]' brasse seul`, current());
      }

      // --- Control qualifier with raw value (CSS model) ---
      // For known controls, consume everything after : until ] as raw value.
      // Commas between arguments are part of the value: [goto:3,1] → "3,1"
      // Commas before a new key (IDENT:) separate qualifier pairs: [goto:3,1, scan:left]
      // Spaces are preserved: [keyxpand: B3 -1] → value = "B3 -1"
      // Encoder converts spaces to commas for BP3: _keyxpand(B3,-1)
      if (libCtx.controlNames.has(key)) {
        let rawValue = '';
        while (!at(T.RBRACKET) && !atEnd()) {
          // Stop at , if followed by IDENT: (next qualifier pair)
          if (at(T.COMMA) && peek(1).type === T.IDENT && peek(2).type === T.COLON) break;
          // Stop at , if followed by bare IDENT ] (next bare key qualifier)
          if (at(T.COMMA) && peek(1).type === T.IDENT && peek(2).type === T.RBRACKET) break;
          const t = current();
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
        pairs.push({ type: 'QualPair', key, value: rawValue || true, decrement: null });
        if (at(T.COMMA)) advance();
        continue;
      }

      // --- Standard qualifier value parsing (mode, weight, speed, etc.) ---
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
      } else if (at(T.INT)) {
        // ratio like speed:2/3
        value = advance().value;
        if (at(T.SLASH)) {
          advance();
          value = `${value}/${expect(T.INT).value}`;
        }
      }
      pairs.push({ type: 'QualPair', key, value, decrement });
      if (at(T.COMMA)) advance();
    }
    expect(T.RBRACKET);
    return { type: 'Qualifier', pairs, tempoOp: null };
  }

  // ============================================================
  // Entry point
  // ============================================================

  return parseScene();
}

export { parse, ParseError };
