// BPscript parser — token stream → AST

import { T } from './tokenizer.js';
import { ParseError } from './errors.js';

export function parse(tokens) {
  let pos = 0;

  function current() { return tokens[pos]; }
  function peek(offset = 0) { return tokens[pos + offset]; }

  function advance() {
    const tok = tokens[pos];
    pos++;
    return tok;
  }

  function expect(type) {
    const tok = current();
    if (tok.type !== type) {
      throw new ParseError(
        `Expected ${type}, got ${tok.type} ('${tok.value}')`,
        tok.line, tok.col
      );
    }
    return advance();
  }

  function skipNewlines() {
    while (pos < tokens.length && current().type === T.NEWLINE) {
      advance();
    }
  }

  function isArrow(tok) {
    return tok.type === T.ARROW_RIGHT ||
           tok.type === T.ARROW_LEFT ||
           tok.type === T.ARROW_BOTH;
  }

  // Check if current position starts a rule: SYMBOL ARROW
  function isRuleStart() {
    if (current().type !== T.SYMBOL) return false;
    const next = peek(1);
    return next && isArrow(next);
  }

  // Check if current position starts a definition: SYMBOL (LPAREN | EQUALS)
  function isDefinitionStart() {
    if (current().type !== T.SYMBOL) return false;
    const next = peek(1);
    if (!next) return false;
    if (next.type === T.EQUALS) return true;
    if (next.type === T.LPAREN) {
      // Look for closing paren then equals: name(...) =
      let depth = 0;
      for (let j = pos + 1; j < tokens.length; j++) {
        if (tokens[j].type === T.LPAREN) depth++;
        else if (tokens[j].type === T.RPAREN) {
          depth--;
          if (depth === 0) {
            return j + 1 < tokens.length && tokens[j + 1].type === T.EQUALS;
          }
        }
        else if (tokens[j].type === T.NEWLINE || tokens[j].type === T.EOF) break;
      }
    }
    return false;
  }

  // Parse a polymetric expression: { expr, expr, ... }
  function parsePolymetry() {
    const tok = expect(T.LBRACE);
    const voices = [];
    let currentVoice = [];

    while (current().type !== T.RBRACE && current().type !== T.EOF) {
      if (current().type === T.COMMA) {
        voices.push(currentVoice);
        currentVoice = [];
        advance();
        continue;
      }
      if (current().type === T.NEWLINE) {
        advance();
        continue;
      }
      currentVoice.push(parseAtom());
    }

    if (currentVoice.length > 0) {
      voices.push(currentVoice);
    }

    expect(T.RBRACE);
    return { type: 'Polymetry', voices, line: tok.line, col: tok.col };
  }

  // Parse a single atom (symbol, call, or polymetry)
  function parseAtom() {
    const tok = current();

    if (tok.type === T.LBRACE) {
      return parsePolymetry();
    }

    if (tok.type === T.SYMBOL) {
      advance();
      // Check for call: symbol(...)
      if (current().type === T.LPAREN) {
        return parseCall(tok);
      }
      return { type: 'Symbol', value: tok.value, line: tok.line, col: tok.col };
    }

    throw new ParseError(
      `Expected symbol or '{', got ${tok.type} ('${tok.value}')`,
      tok.line, tok.col
    );
  }

  // Parse a function call: name(arg1, arg2, key: val, ...)
  function parseCall(nameTok) {
    expect(T.LPAREN);
    const args = [];
    const params = {};

    while (current().type !== T.RPAREN && current().type !== T.EOF) {
      if (current().type === T.COMMA) {
        advance();
        continue;
      }
      if (current().type === T.NEWLINE) {
        advance();
        continue;
      }

      // Check for key: value parameter
      if (current().type === T.SYMBOL && peek(1) && peek(1).type === T.COLON) {
        const key = advance().value;
        advance(); // skip colon
        if (current().type === T.EOF || current().type === T.RPAREN) {
          throw new ParseError(`Expected value after '${key}:'`, current().line, current().col);
        }
        // Value can be a symbol or a nested call
        const val = parseAtom();
        params[key] = val;
      } else {
        args.push(parseAtom());
      }
    }

    expect(T.RPAREN);
    return {
      type: 'Call',
      name: nameTok.value,
      args,
      params,
      line: nameTok.line,
      col: nameTok.col
    };
  }

  // Parse expression: sequence of atoms
  function parseExpr() {
    const atoms = [];
    while (
      current().type !== T.NEWLINE &&
      current().type !== T.EOF &&
      current().type !== T.LBRACKET &&
      current().type !== T.RBRACE &&
      current().type !== T.COMMA &&
      current().type !== T.RPAREN
    ) {
      atoms.push(parseAtom());
    }
    return atoms;
  }

  // Parse options: [random], [sub], [ordered], etc.
  function parseOptions() {
    if (current().type !== T.LBRACKET) return null;
    const tok = advance(); // skip [
    const opts = [];
    while (current().type !== T.RBRACKET && current().type !== T.EOF) {
      if (current().type === T.SYMBOL) {
        opts.push(advance().value);
      } else if (current().type === T.COMMA) {
        advance();
      } else {
        throw new ParseError(
          `Unexpected ${current().type} in options`,
          current().line, current().col
        );
      }
    }
    expect(T.RBRACKET);
    return { type: 'Options', values: opts, line: tok.line, col: tok.col };
  }

  // Parse a derivation rule: LHS arrow RHS [options]
  function parseRule() {
    const lhsTok = expect(T.SYMBOL);
    const arrowTok = advance(); // arrow token
    const rhs = parseExpr();
    const options = parseOptions();

    let arrow;
    if (arrowTok.type === T.ARROW_RIGHT) arrow = '->';
    else if (arrowTok.type === T.ARROW_LEFT) arrow = '<-';
    else arrow = '<>';

    return {
      type: 'Rule',
      lhs: lhsTok.value,
      arrow,
      rhs,
      options,
      line: lhsTok.line,
      col: lhsTok.col
    };
  }

  // Parse a definition: name = expr  or  name(params) = expr { body }
  function parseDefinition() {
    const nameTok = advance(); // symbol name
    let defParams = [];
    let defParamDefaults = {};

    // Optional parameter list
    if (current().type === T.LPAREN) {
      advance(); // skip (
      while (current().type !== T.RPAREN && current().type !== T.EOF) {
        if (current().type === T.COMMA) { advance(); continue; }
        if (current().type === T.SYMBOL) {
          const paramName = advance().value;
          if (current().type === T.COLON) {
            advance(); // skip :
            const defaultVal = parseAtom();
            defParams.push(paramName);
            defParamDefaults[paramName] = defaultVal;
          } else {
            defParams.push(paramName);
          }
        } else {
          throw new ParseError(
            `Expected parameter name, got ${current().type}`,
            current().line, current().col
          );
        }
      }
      expect(T.RPAREN);
    }

    expect(T.EQUALS);
    const body = parseExpr();

    // Optional body block { key: value ... }
    let block = null;
    if (current().type === T.LBRACE) {
      block = parseBlock();
    }

    return {
      type: 'Definition',
      name: nameTok.value,
      params: defParams,
      defaults: defParamDefaults,
      body,
      block,
      line: nameTok.line,
      col: nameTok.col
    };
  }

  // Parse a block: { key: value, ... } (for definitions)
  function parseBlock() {
    expect(T.LBRACE);
    const entries = {};

    while (current().type !== T.RBRACE && current().type !== T.EOF) {
      if (current().type === T.NEWLINE || current().type === T.COMMA) {
        advance();
        continue;
      }
      if (current().type === T.SYMBOL) {
        const key = advance().value;
        expect(T.COLON);
        // Consume value until newline, comma, or closing brace
        let val = '';
        while (
          current().type !== T.NEWLINE &&
          current().type !== T.COMMA &&
          current().type !== T.RBRACE &&
          current().type !== T.EOF
        ) {
          val += (val ? ' ' : '') + advance().value;
        }
        entries[key] = val;
      } else {
        throw new ParseError(
          `Expected key in block, got ${current().type}`,
          current().line, current().col
        );
      }
    }

    expect(T.RBRACE);
    return entries;
  }

  // Main parse loop
  function parseProgram() {
    const body = [];
    skipNewlines();

    while (current().type !== T.EOF) {
      const tok = current();

      if (tok.type === T.NEWLINE) {
        skipNewlines();
        continue;
      }

      if (tok.type === T.COMMENT) {
        body.push({ type: 'Comment', value: tok.value, line: tok.line, col: tok.col });
        advance();
        continue;
      }

      if (tok.type === T.DIRECTIVE) {
        body.push({ type: 'Directive', name: tok.value, line: tok.line, col: tok.col });
        advance();
        continue;
      }

      if (isRuleStart()) {
        body.push(parseRule());
        continue;
      }

      if (isDefinitionStart()) {
        body.push(parseDefinition());
        continue;
      }

      throw new ParseError(
        `Unexpected ${tok.type} ('${tok.value}')`,
        tok.line, tok.col
      );
    }

    return { type: 'Program', body };
  }

  return parseProgram();
}
