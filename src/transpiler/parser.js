/**
 * BPScript Parser
 * Source: BPSCRIPT_EBNF.md (Couches 1-4) + BPSCRIPT_AST.md
 *
 * Converts token array into AST (Scene node).
 * Recursive descent parser.
 */

import { T } from './tokenizer.js';
import { loadLibsFromDirectives } from './libs.js';

class ParseError extends Error {
  constructor(msg, token) {
    super(`${msg} at line ${token.line}:${token.col}`);
    this.token = token;
  }
}

function parse(tokens) {
  let pos = 0;
  let libCtx = { controlNames: new Set(), noArgControls: new Set(), controlMap: {}, symbols: {} };

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
  // Couche 1 — Scene
  // ============================================================

  function parseScene() {
    const scene = {
      type: 'Scene',
      directives: [],
      declarations: [],
      macros: [],
      backticks: [],
      cvInstances: [],
      subgrammars: [],
    };

    skipNewlines();

    // Parse header: directives, declarations, macros, backticks
    let initialMode = null;
    while (!atEnd() && !at(T.SEPARATOR)) {
      skipNewlines();
      if (atEnd()) break;

      if (at(T.AT)) {
        const dir = parseDirective();
        if (dir.name === 'mode' && dir.runtime) {
          // @mode:X is a block directive, not a lib directive
          initialMode = dir.runtime;
        } else {
          scene.directives.push(dir);
        }
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

    // Parse subgrammars
    scene.subgrammars = parseSubgrammars(initialMode);

    return scene;
  }

  // ============================================================
  // Directives
  // ============================================================

  function parseDirective() {
    const tok = expect(T.AT);
    // @+ is a special case — PLUS token instead of IDENT
    let name, subkey = null;
    if (at(T.PLUS)) {
      advance();
      name = '+';
    } else {
      name = expect(T.IDENT).value;
    }
    // @alphabet.western — dot accessor for subkey within a lib
    if (at(T.PERIOD)) {
      advance();
      subkey = expect(T.IDENT).value;
    }
    let runtime = null, value = null, aliases = null;

    if (at(T.COLON)) {
      advance();
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
      } else if (at(T.INT)) {
        // Could be ratio like 3/4
        const num = advance().value;
        if (at(T.SLASH)) {
          advance();
          const denom = expect(T.INT).value;
          value = `${num}/${denom}`;
        } else {
          value = Number(num);
        }
      }
    }

    if (at(T.LPAREN)) {
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

    return { type: 'Directive', name, subkey, runtime, value, aliases, line: tok.line };
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
  // Couche 2 — Subgrammars
  // ============================================================

  function parseSubgrammars(initialMode) {
    const subs = [];
    let index = 1;
    let safety = 0;
    let currentMode = initialMode || null;  // inherits across sub-grammars until overridden

    while (!atEnd()) {
      if (++safety > 200) throw new ParseError('Subgrammar parse loop safety limit', current());
      skipNewlines();
      if (atEnd()) break;

      // Parse @mode:X directive at the start of a sub-grammar block
      let blockMode = currentMode;
      while (at(T.AT)) {
        const dir = parseDirective();
        if (dir.name === 'mode' && dir.runtime) {
          blockMode = dir.runtime;  // @mode:random → runtime='random'
          currentMode = blockMode;  // persists to following blocks
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
        subs.push({ type: 'Subgrammar', index: index++, rules, mode: blockMode });
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
    let runtimeQualifier = null;
    if (isRuntimeQualifier()) {
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

    return { type: 'Rule', guard, contexts, lhs, arrow, rhs, flags, qualifiers, runtimeQualifier, line: tok.line };
  }

  // ============================================================
  // RHS Flags [X=N, Y, Z+1]
  // ============================================================

  function isFlagBracket() {
    // Lookahead: [ followed by IDENT then = + - , ] (NOT IDENT:value which is a qualifier)
    if (!at(T.LBRACKET)) return false;
    const t1 = peek(1);
    const t2 = peek(2);
    if (t1.type !== T.IDENT) return false;
    // If IDENT followed by : → qualifier, not flag
    if (t2.type === T.COLON) return false;
    // If IDENT followed by = + - ] , → flag
    if (t2.type === T.EQUALS || t2.type === T.PLUS || t2.type === T.REST ||
        t2.type === T.RBRACKET || t2.type === T.COMMA) return true;
    return false;
  }

  function parseFlagBracket() {
    expect(T.LBRACKET);
    const flags = [];
    while (!at(T.RBRACKET) && !atEnd()) {
      const flag = expect(T.IDENT).value;
      let operator = null, value = null;
      if (at(T.EQUALS)) {
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
      flags.push({ type: 'FlagExpr', flag, operator, value });
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

    const flag = expect(T.IDENT).value;

    let result;

    // Test+mutation: count-1, count+1
    if (at(T.REST)) { // - (REST token doubles as minus)
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

      // #symbol (single) or #(group) — group can contain {, }, ,
      if (at(T.LPAREN)) {
        advance();
        const symbols = [];
        while (!at(T.RPAREN) && !atEnd()) {
          if (at(T.IDENT)) symbols.push(advance().value);
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
      } else {
        const sym = expect(T.IDENT).value;
        return { type: 'Context', positive: false, symbols: [sym] };
      }
    }

    // Positive context: (A B) — can contain {, }, ,
    expect(T.LPAREN);
    const symbols = [];
    while (!at(T.RPAREN) && !atEnd()) {
      if (at(T.IDENT)) symbols.push(advance().value);
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
        elements.push({ type: 'Symbol', name: advance().value, line: current().line });
      } else if (at(T.PIPE)) {
        elements.push(parseVariable());
      } else if (at(T.QUESTION)) {
        elements.push(parseWildcard());
      } else if (at(T.HASH)) {
        elements.push(parseContext());
      } else if (at(T.PROLONG)) {
        // _ (prolongation) as terminal on LHS — e.g. Oc3 _ -> _ Oc3
        advance();
        elements.push({ type: 'Prolongation' });
      } else if (at(T.REST)) {
        // - (silence) as terminal on LHS
        advance();
        elements.push({ type: 'Rest' });
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
      // Stop at [ unless it's a tempo operator or per-element control qualifier
      if (at(T.LBRACKET) && !isTempoOpQualifier() && !isPerElementQualifier()) break;
      // Stop at ( if it's a rule-scope runtime qualifier at end of RHS
      if (isRuntimeQualifier() && isEndOfRhs()) break;
      if (++safety > 500) throw new ParseError('RHS parse loop safety limit', current());
      // Unbalanced } or , at top level — embedding pattern
      // But stop if } or , starts a new rule (followed by ->)
      if (atAny(T.RBRACE, T.COMMA) && isNewRuleAhead()) break;
      if (at(T.RBRACE)) {
        advance();
        const rawBrace = { type: 'RawBrace', value: '}' };
        // Check for [speed:N] qualifier on closing brace
        if (at(T.LBRACKET) && isPolymetricQualifier()) {
          rawBrace.qualifiers = [];
          while (at(T.LBRACKET) && isPolymetricQualifier()) {
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

      // PREFIX engine qualifier: [tempo:2]A (engine [] only, no () prefix)
      let prefixQuals = null;
      if (at(T.LBRACKET) && isPerElementQualifier()) {
        prefixQuals = parseQualifier();
      }

      const el = parseRhsElement();
      if (!el) {
        // Prefix without element — shouldn't happen but be safe
        break;
      }

      // Attach prefix qualifiers (from engine [tempo:2]A)
      if (prefixQuals) {
        el.controlQualifiers = el.controlQualifiers || [];
        el.controlQualifiers.unshift(prefixQuals);
        el.controlPrefix = true; // mark as prefix for encoder
      }

      // SUFFIX tempo operator: A[/2]
      if (at(T.LBRACKET) && isTempoOpQualifier()) {
        const qual = parseQualifier();
        el.tempoOp = qual.tempoOp;
      }

      // SUFFIX qualifier: A[speed:2] (engine) or A(vel:60) (runtime)
      // But NOT if () is at end of RHS — that's a rule-scope qualifier
      if (at(T.LBRACKET) && isPerElementQualifier()) {
        el.controlQualifiers = el.controlQualifiers || [];
        el.controlQualifiers.push(parseQualifier());
      } else if (isRuntimeQualifier() && !isEndOfRhs()) {
        el.controlQualifiers = el.controlQualifiers || [];
        el.controlQualifiers.push(parseRuntimeQualifier());
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
    if (!(next === T.SLASH || next === T.BACKSLASH || next === T.STAR || next === T.DOUBLESTAR)) return false;
    // Check it's pure (followed by number then ] or /number then ])
    let j = pos + 2; // after [ and operator
    if (next === T.DOUBLESTAR) j++; // ** is 2 tokens
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
    // (IDENT:...) where IDENT is a known control name = runtime qualifier
    if (!at(T.LPAREN)) return false;
    const nextTok = peek(1);
    if (nextTok.type !== T.IDENT) return false;
    // Must be followed by : to distinguish from context (A B) or other uses
    const afterName = peek(2);
    if (afterName.type !== T.COLON) return false;
    return libCtx.controlNames.has(nextTok.value);
  }

  function parseRuntimeQualifier() {
    // (vel:80, wave:sawtooth) → runtime qualifier AST
    expect(T.LPAREN);
    const pairs = [];
    while (!at(T.RPAREN) && !atEnd()) {
      const key = expect(T.IDENT).value;
      expect(T.COLON);
      // Raw value: everything until , or )
      let val;
      if (at(T.REST)) { // negative number
        advance();
        val = -Number(expect(T.INT).value);
      } else if (at(T.INT)) {
        val = Number(advance().value);
      } else if (at(T.FLOAT)) {
        val = Number(advance().value);
      } else {
        val = advance().value;
      }
      pairs.push({ key, value: val });
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);
    return { type: 'Qualifier', pairs, position: 'element' };
  }

  function isPerElementQualifier() {
    // [IDENT:...] where IDENT is a known control name = per-element qualifier
    // Used for engine qualifier [speed:2]A or A[weight:50]
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

    // Polymetric { ... } or unbalanced brace (embedding pattern)
    if (at(T.LBRACE)) {
      if (hasMatchingBrace()) {
        return parsePolymetric();
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

    // Standalone ! → out-time object (no primary symbol)
    if (at(T.BANG)) {
      advance();
      if (at(T.IDENT)) {
        const name = advance().value;
        return { type: 'OutTimeObject', name };
      }
      throw new ParseError('Expected symbol after !', current());
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

      // Runtime qualifier suffix: D4(vel:70) — check before symbol call
      // But NOT if () is at end of RHS (that's a rule-scope qualifier)
      if (isRuntimeQualifier()) {
        if (isEndOfRhs()) {
          // Leave () for parseRule — return bare symbol
          return { type: 'Symbol', name, line: tok.line };
        }
        const el = { type: 'Symbol', name, line: tok.line };
        el.controlQualifiers = [parseRuntimeQualifier()];
        return el;
      }

      // Symbol call: Sa(custom_param:120) — only if NOT a known runtime control
      if (at(T.LPAREN) && !isContextLookahead()) {
        return parseSymbolCall(name, tok);
      }

      // Simultaneous: Sa!dha!phase=2
      if (at(T.BANG)) {
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
          symbol: { type: 'Symbol', name, line: tok.line },
          triggers: triggerIns,
        };
      }

      // Plain symbol (might be a control like vel, tempo, goto)
      // Check if it's a control: name(args) without being a symbol call context
      if (at(T.LPAREN) && isControlName(name)) {
        return parseControl(name, tok);
      }

      return { type: 'Symbol', name, line: tok.line };
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
        } else {
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
      primary = { type: 'Symbol', name: primaryName, line: tok.line };
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
          secondaries.push({ type: 'Symbol', name, line: tok.line });
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

  function parsePolymetric() {
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
      // Stop at [ inside polymetric if it's NOT a per-element qualifier or tempo op
      if (at(T.LBRACKET) && !isPerElementQualifier() && !isTempoOpQualifier()) break;
      // PREFIX engine qualifier inside polymetric: [tempo:2]A
      let prefixQuals = null;
      if (at(T.LBRACKET) && isPerElementQualifier()) {
        prefixQuals = parseQualifier();
      }
      const el = parseRhsElement();
      if (!el) break;
      // Attach prefix qualifiers
      if (prefixQuals) {
        el.controlQualifiers = el.controlQualifiers || [];
        el.controlQualifiers.unshift(prefixQuals);
        el.controlPrefix = true;
      }
      // Check for tempo operator qualifier on this element inside polymetric
      if (at(T.LBRACKET) && isTempoOpQualifier()) {
        const qual = parseQualifier();
        el.tempoOp = qual.tempoOp;
      }
      // SUFFIX qualifier in polymetric: A[speed:2] or A(vel:60)
      if (at(T.LBRACKET) && isPerElementQualifier()) {
        el.controlQualifiers = el.controlQualifiers || [];
        el.controlQualifiers.push(parseQualifier());
      } else if (isRuntimeQualifier()) {
        el.controlQualifiers = el.controlQualifiers || [];
        el.controlQualifiers.push(parseRuntimeQualifier());
      }
      currentVoice.push(el);
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

    return { type: 'Polymetric', voices, qualifiers, runtimeQualifier };
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

    const name = expect(T.IDENT).value;
    let args = null;
    if (at(T.LPAREN)) {
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
    if (at(T.LPAREN)) {
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

  function parseQualifier() {
    expect(T.LBRACKET);

    // Check for tempo operator: [/2], [\2], [*3], [**3]
    if (atAny(T.SLASH, T.BACKSLASH, T.STAR, T.DOUBLESTAR)) {
      let operator;
      if (at(T.DOUBLESTAR)) { operator = '**'; advance(); }
      else if (at(T.STAR)) { operator = '*'; advance(); }
      else if (at(T.SLASH)) { operator = '/'; advance(); }
      else if (at(T.BACKSLASH)) { operator = '\\'; advance(); }
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
        throw new ParseError('Expected number after tempo operator', current());
      }
      // If followed by , → mixed qualifier [/5, mode:random, transpose:-7]
      const tempoOp = { type: 'TempoOp', operator, value };
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

      // --- Control qualifier with raw value (CSS model) ---
      // For known controls, consume everything after : until , or ] as raw value.
      // Spaces are preserved: [keyxpand: B3 -1] → value = "B3 -1"
      // Encoder converts spaces to commas for BP3: _keyxpand(B3,-1)
      if (libCtx.controlNames.has(key)) {
        let rawValue = '';
        while (!at(T.COMMA) && !at(T.RBRACKET) && !atEnd()) {
          const t = current();
          if (rawValue.length > 0 && t.type !== T.RPAREN) {
            const lastChar = rawValue[rawValue.length - 1];
            if (lastChar !== '(' && t.type !== T.LPAREN) {
              // No space after - (negative number: -7)
              // No space around / (ratio: 11/5)
              const isSlash = t.type === T.SLASH || lastChar === '/';
              if (lastChar !== '-' && !isSlash) rawValue += ' ';
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
