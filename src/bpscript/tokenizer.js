// BPscript tokenizer — source text → token stream

import { TokenError } from './errors.js';

export const T = {
  DIRECTIVE:   'DIRECTIVE',
  ARROW_RIGHT: 'ARROW_RIGHT',
  ARROW_LEFT:  'ARROW_LEFT',
  ARROW_BOTH:  'ARROW_BOTH',
  LBRACE:      'LBRACE',
  RBRACE:      'RBRACE',
  COMMA:       'COMMA',
  LPAREN:      'LPAREN',
  RPAREN:      'RPAREN',
  COLON:       'COLON',
  EQUALS:      'EQUALS',
  LBRACKET:    'LBRACKET',
  RBRACKET:    'RBRACKET',
  SYMBOL:      'SYMBOL',
  NEWLINE:     'NEWLINE',
  COMMENT:     'COMMENT',
  EOF:         'EOF',
};

export function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const len = source.length;

  function peek(offset = 0) {
    return i + offset < len ? source[i + offset] : null;
  }

  function advance() {
    const ch = source[i];
    i++;
    if (ch === '\n') { line++; col = 1; }
    else { col++; }
    return ch;
  }

  function token(type, value) {
    return { type, value, line, col };
  }

  function isSymbolChar(ch) {
    if (!ch) return false;
    // Symbol chars: letters, digits, underscore, dot, #, /, *, +, !, ?, ~, %
    // Basically anything that's not a BPscript operator or whitespace
    return /[a-zA-Z0-9_.\-#\/*+!?~%&'"]/.test(ch);
  }

  while (i < len) {
    const ch = peek();
    const startLine = line;
    const startCol = col;

    // Whitespace (not newline)
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      advance();
      continue;
    }

    // Newline
    if (ch === '\n') {
      advance();
      // Collapse consecutive newlines
      if (tokens.length === 0 || tokens[tokens.length - 1].type !== T.NEWLINE) {
        tokens.push({ type: T.NEWLINE, value: '\n', line: startLine, col: startCol });
      }
      continue;
    }

    // Comment
    if (ch === '/' && peek(1) === '/') {
      advance(); advance(); // skip //
      let text = '';
      while (i < len && peek() !== '\n') {
        text += advance();
      }
      tokens.push({ type: T.COMMENT, value: text.trim(), line: startLine, col: startCol });
      continue;
    }

    // Directive @name
    if (ch === '@') {
      advance(); // skip @
      let name = '';
      while (i < len && /[a-zA-Z0-9_\-]/.test(peek())) {
        name += advance();
      }
      if (!name) {
        throw new TokenError('Expected identifier after @', startLine, startCol);
      }
      tokens.push({ type: T.DIRECTIVE, value: name, line: startLine, col: startCol });
      continue;
    }

    // Arrows: -> <- <>
    if (ch === '-' && peek(1) === '>') {
      advance(); advance();
      // Check for BP3's --> (common mistake)
      if (peek() === '-' || (tokens.length > 0 && source.substring(i - 2, i + 1) === '-->')) {
        // Already consumed ->, not -->
      }
      tokens.push({ type: T.ARROW_RIGHT, value: '->', line: startLine, col: startCol });
      continue;
    }
    if (ch === '<' && peek(1) === '-') {
      advance(); advance();
      tokens.push({ type: T.ARROW_LEFT, value: '<-', line: startLine, col: startCol });
      continue;
    }
    if (ch === '<' && peek(1) === '>') {
      advance(); advance();
      tokens.push({ type: T.ARROW_BOTH, value: '<>', line: startLine, col: startCol });
      continue;
    }

    // Single-char tokens
    if (ch === '{') { advance(); tokens.push({ type: T.LBRACE, value: '{', line: startLine, col: startCol }); continue; }
    if (ch === '}') { advance(); tokens.push({ type: T.RBRACE, value: '}', line: startLine, col: startCol }); continue; }
    if (ch === ',') { advance(); tokens.push({ type: T.COMMA, value: ',', line: startLine, col: startCol }); continue; }
    if (ch === '(') { advance(); tokens.push({ type: T.LPAREN, value: '(', line: startLine, col: startCol }); continue; }
    if (ch === ')') { advance(); tokens.push({ type: T.RPAREN, value: ')', line: startLine, col: startCol }); continue; }
    if (ch === '[') { advance(); tokens.push({ type: T.LBRACKET, value: '[', line: startLine, col: startCol }); continue; }
    if (ch === ']') { advance(); tokens.push({ type: T.RBRACKET, value: ']', line: startLine, col: startCol }); continue; }
    if (ch === '=') { advance(); tokens.push({ type: T.EQUALS, value: '=', line: startLine, col: startCol }); continue; }
    if (ch === ':') { advance(); tokens.push({ type: T.COLON, value: ':', line: startLine, col: startCol }); continue; }

    // Symbol: anything else that forms a word
    if (isSymbolChar(ch)) {
      let sym = '';
      while (i < len && isSymbolChar(peek())) {
        sym += advance();
      }
      tokens.push({ type: T.SYMBOL, value: sym, line: startLine, col: startCol });
      continue;
    }

    throw new TokenError(`Unexpected character: '${ch}'`, startLine, startCol);
  }

  // Ensure no trailing NEWLINE before EOF
  if (tokens.length > 0 && tokens[tokens.length - 1].type === T.NEWLINE) {
    tokens.pop();
  }

  tokens.push({ type: T.EOF, value: null, line, col });
  return tokens;
}
