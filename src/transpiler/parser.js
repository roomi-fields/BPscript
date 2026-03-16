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
      subgrammars: [],
    };

    skipNewlines();

    // Parse header: directives, declarations, macros, backticks
    while (!atEnd() && !isRuleStart() && !at(T.SEPARATOR)) {
      skipNewlines();
      if (atEnd()) break;

      if (at(T.AT)) {
        scene.directives.push(parseDirective());
      } else if (atAny(T.GATE, T.TRIGGER, T.CV)) {
        scene.declarations.push(parseDeclaration());
      } else if (at(T.BACKTICK)) {
        scene.backticks.push(parseBacktickOrphan());
      } else if (at(T.IDENT) && isLookaheadMacro()) {
        scene.macros.push(parseMacro());
      } else {
        break; // Start of rules
      }
      skipNewlines();
    }

    // Load libraries based on @ directives — determines known controls
    libCtx = loadLibsFromDirectives(scene.directives);

    // Parse subgrammars
    scene.subgrammars = parseSubgrammars();

    return scene;
  }

  // ============================================================
  // Directives
  // ============================================================

  function parseDirective() {
    const tok = expect(T.AT);
    // @+ is a special case — PLUS token instead of IDENT
    let name;
    if (at(T.PLUS)) {
      advance();
      name = '+';
    } else {
      name = expect(T.IDENT).value;
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
        value = Number(advance().value);
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

    return { type: 'Directive', name, runtime, value, aliases, line: tok.line };
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

  function parseSubgrammars() {
    const subs = [];
    let index = 1;
    let safety = 0;

    while (!atEnd()) {
      if (++safety > 200) throw new ParseError('Subgrammar parse loop safety limit', current());
      skipNewlines();
      if (atEnd()) break;

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
        subs.push({ type: 'Subgrammar', index: index++, rules });
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
    // A rule starts with: when | IDENT | # | ( | ? | | | { | } | , (meta-grammars)
    const t = current().type;
    return t === T.WHEN || t === T.IDENT || t === T.HASH ||
           t === T.LPAREN || t === T.QUESTION || t === T.PIPE ||
           t === T.LAMBDA || t === T.LBRACE || t === T.RBRACE || t === T.COMMA;
  }

  // ============================================================
  // Couche 3 — Rules
  // ============================================================

  function parseRule() {
    const tok = current();
    let guard = null;
    const contexts = [];

    // Guards: when ... (multiple allowed, AND'd together)
    const guards = [];
    while (at(T.WHEN)) {
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

    return { type: 'Rule', guard, contexts, lhs, arrow, rhs, flags, qualifiers, line: tok.line };
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
    expect(T.WHEN);
    const flag = expect(T.IDENT).value;

    // Test+mutation: when Ideas-1, when count+1
    if (at(T.REST)) { // - (REST token doubles as minus)
      advance();
      const val = Number(expect(T.INT).value);
      return { type: 'Guard', flag, operator: '-', value: val, mutates: true };
    }
    if (at(T.PLUS)) {
      advance();
      const val = Number(expect(T.INT).value);
      return { type: 'Guard', flag, operator: '+', value: val, mutates: true };
    }

    // Test pure: when phase==1, when count>3
    let op;
    if (at(T.EQ)) { op = '=='; advance(); }
    else if (at(T.NEQ)) { op = '!='; advance(); }
    else if (at(T.GT)) { op = '>'; advance(); }
    else if (at(T.LT)) { op = '<'; advance(); }
    else if (at(T.GTE)) { op = '>='; advance(); }
    else if (at(T.LTE)) { op = '<='; advance(); }
    else throw new ParseError(`Expected comparison operator after flag name`, current());

    let value;
    if (at(T.INT)) value = Number(advance().value);
    else if (at(T.IDENT)) value = advance().value;
    else throw new ParseError(`Expected value after operator`, current());

    return { type: 'Guard', flag, operator: op, value, mutates: false };
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
      } else if (atAny(T.LBRACE, T.RBRACE, T.COMMA)) {
        // Raw structural chars on LHS (meta-grammars like koto3)
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
    while (!atAny(T.NEWLINE, T.EOF, T.SEPARATOR, T.COMMENT, T.WHEN, T.GATE, T.TRIGGER, T.CV)) {
      // Stop at [ unless it's a tempo operator on the previous element
      if (at(T.LBRACKET) && !isTempoOpQualifier()) break;
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

      const el = parseRhsElement();
      if (!el) break;

      // Check for tempo operator qualifier on this element: A[/2]
      if (at(T.LBRACKET) && isTempoOpQualifier()) {
        const qual = parseQualifier();
        el.tempoOp = qual.tempoOp;
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
    // Lookahead: [ followed by /, \, *, ** = tempo operator
    if (!at(T.LBRACKET)) return false;
    const next = peek(1).type;
    return next === T.SLASH || next === T.BACKSLASH || next === T.STAR || next === T.DOUBLESTAR;
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

      // Symbol call: Sa(vel:120)
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
          // Preserve spaces between words: "MIDI send Continue"
          if (arg.length > 0 && t.type === T.IDENT && /[a-zA-Z]$/.test(arg)) arg += ' ';
          arg += advance().value;
        } else if (t.type === T.EQUALS) {
          arg += advance().value;
        } else if (t.type === T.SLASH) {
          arg += advance().value;
        } else if (t.type === T.REST) {
          // negative number in control args
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
    // A new rule starts after NEWLINE(s) when we see: IDENT ARROW or WHEN
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
        // New rule starts with: IDENT/WHEN/LAMBDA at line start (outside braces)
        if (t === T.WHEN || t === T.LAMBDA) return false;
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
      const el = parseRhsElement();
      if (el) currentVoice.push(el);
      else break;
    }
    if (currentVoice.length > 0) voices.push(currentVoice);
    expect(T.RBRACE);

    // Qualifiers after } — only take polymetric-specific ones (speed, scale)
    const qualifiers = [];
    while (at(T.LBRACKET) && isPolymetricQualifier()) {
      qualifiers.push(parseQualifier());
    }

    return { type: 'Polymetric', voices, qualifiers };
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
      expect(T.RBRACKET);
      return { type: 'Qualifier', pairs: [], tempoOp: { type: 'TempoOp', operator, value } };
    }

    const pairs = [];
    while (!at(T.RBRACKET) && !atEnd()) {
      const key = expect(T.IDENT).value;
      // Bare key without value: [destru], [striated]
      if (!at(T.COLON)) {
        pairs.push({ type: 'QualPair', key, value: true, decrement: null });
        if (at(T.COMMA)) advance();
        continue;
      }
      expect(T.COLON);
      let value, decrement = null;
      if (at(T.INT)) {
        const num = advance().value;
        // Check for ratio: speed:1/2
        if (at(T.SLASH) && peek(1).type === T.INT) {
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
