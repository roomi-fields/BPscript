/**
 * BPScript Tokenizer
 * Source: BPSCRIPT_EBNF.md — Couche 5 (Lexèmes)
 *
 * Converts .bps source text into a flat array of tokens.
 * Each token: { type, value, line, col }
 */

const T = Object.freeze({
  // Structural symbols (24)
  AT:           'AT',           // @
  ARROW_R:      'ARROW_R',     // ->
  ARROW_L:      'ARROW_L',     // <-
  ARROW_BI:     'ARROW_BI',    // <>
  LBRACE:       'LBRACE',      // {
  RBRACE:       'RBRACE',      // }
  COMMA:        'COMMA',       // ,
  LPAREN:       'LPAREN',      // (
  RPAREN:       'RPAREN',      // )
  COLON:        'COLON',       // :
  EQUALS:       'EQUALS',      // =
  LBRACKET:     'LBRACKET',    // [
  RBRACKET:     'RBRACKET',    // ]
  BACKTICK:     'BACKTICK',    // ` ... `
  REST:         'REST',        // -
  PROLONG:      'PROLONG',     // _
  PERIOD:       'PERIOD',      // .
  UNDETERMINED: 'UNDETERMINED',// ...
  BANG:         'BANG',        // !
  TRIGGER_IN:   'TRIGGER_IN',  // <!
  HASH:         'HASH',        // #
  QUESTION:     'QUESTION',    // ?
  DOLLAR:       'DOLLAR',      // $
  AMPERSAND:    'AMPERSAND',   // &
  TILDE:        'TILDE',       // ~
  PIPE:         'PIPE',        // |

  // Tempo operators (in [] qualifiers)
  STAR:         'STAR',        // *
  DOUBLESTAR:   'DOUBLESTAR',  // **
  BACKSLASH:    'BACKSLASH',   // \

  // Flag operators (7)
  EQ:           'EQ',          // ==
  NEQ:          'NEQ',         // !=
  GT:           'GT',          // >
  LT:           'LT',         // <
  GTE:          'GTE',         // >=
  LTE:          'LTE',         // <=
  PLUS:         'PLUS',        // +

  // Keywords (4 + 1)
  GATE:         'GATE',        // gate
  TRIGGER:      'TRIGGER',     // trigger
  CV:           'CV',          // cv
  WHEN:         'WHEN',        // when
  LAMBDA:       'LAMBDA',      // lambda

  // Literals
  INT:          'INT',         // 123
  FLOAT:        'FLOAT',       // 0.5  (only in params, not period)
  IDENT:        'IDENT',       // Sa, melodie, phase, etc.
  SLASH:        'SLASH',       // /  (for ratios like 3/2)

  // Structure
  SEPARATOR:    'SEPARATOR',   // -----
  COMMENT:      'COMMENT',     // // ...
  NEWLINE:      'NEWLINE',     // end of line
  EOF:          'EOF',
});

const KEYWORDS = {
  'gate': T.GATE,
  'trigger': T.TRIGGER,
  'cv': T.CV,
  'when': T.WHEN,
  'lambda': T.LAMBDA,
};

function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;

  function peek(offset = 0) { return source[i + offset]; }
  function advance() {
    const ch = source[i++];
    if (ch === '\n') { line++; col = 1; } else { col++; }
    return ch;
  }
  function match(str) {
    return source.substring(i, i + str.length) === str;
  }
  function emit(type, value) {
    tokens.push({ type, value, line, col: col - (value ? value.length : 0) });
  }

  while (i < source.length) {
    const ch = peek();
    const startLine = line;
    const startCol = col;

    // Whitespace (not newlines)
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      advance();
      continue;
    }

    // Newline
    if (ch === '\n') {
      advance();
      emit(T.NEWLINE, '\n');
      continue;
    }

    // Comment
    if (ch === '/' && peek(1) === '/') {
      let text = '';
      while (i < source.length && peek() !== '\n') text += advance();
      emit(T.COMMENT, text);
      continue;
    }

    // Separator -----
    if (ch === '-' && peek(1) === '-' && peek(2) === '-' && peek(3) === '-' && peek(4) === '-') {
      let sep = '';
      while (i < source.length && peek() === '-') sep += advance();
      emit(T.SEPARATOR, sep);
      continue;
    }

    // ... (undetermined rest — before . period)
    if (ch === '.' && peek(1) === '.' && peek(2) === '.') {
      advance(); advance(); advance();
      emit(T.UNDETERMINED, '...');
      continue;
    }

    // Backtick — read until closing backtick
    if (ch === '`') {
      advance(); // opening `
      let code = '';
      while (i < source.length && peek() !== '`') code += advance();
      if (i < source.length) advance(); // closing `
      emit(T.BACKTICK, code);
      continue;
    }

    // Multi-char operators
    if (ch === '<') {
      if (peek(1) === '!' ) { advance(); advance(); emit(T.TRIGGER_IN, '<!'); continue; }
      if (peek(1) === '-') { advance(); advance(); emit(T.ARROW_L, '<-'); continue; }
      if (peek(1) === '>') { advance(); advance(); emit(T.ARROW_BI, '<>'); continue; }
      if (peek(1) === '=') { advance(); advance(); emit(T.LTE, '<='); continue; }
      advance(); emit(T.LT, '<'); continue;
    }

    if (ch === '-' && peek(1) === '>') { advance(); advance(); emit(T.ARROW_R, '->'); continue; }

    if (ch === '>' && peek(1) === '=') { advance(); advance(); emit(T.GTE, '>='); continue; }
    if (ch === '>') { advance(); emit(T.GT, '>'); continue; }

    if (ch === '=' && peek(1) === '=') { advance(); advance(); emit(T.EQ, '=='); continue; }

    if (ch === '!' && peek(1) === '=') { advance(); advance(); emit(T.NEQ, '!='); continue; }

    // Tempo operators: ** before * (greedy)
    if (ch === '*' && peek(1) === '*') { advance(); advance(); emit(T.DOUBLESTAR, '**'); continue; }
    if (ch === '*') { advance(); emit(T.STAR, '*'); continue; }
    if (ch === '\\') { advance(); emit(T.BACKSLASH, '\\'); continue; }

    // Single-char symbols
    const singles = {
      '@': T.AT, '{': T.LBRACE, '}': T.RBRACE, ',': T.COMMA,
      '(': T.LPAREN, ')': T.RPAREN, ':': T.COLON, '=': T.EQUALS,
      '[': T.LBRACKET, ']': T.RBRACKET,
      '-': T.REST, '_': T.PROLONG, '.': T.PERIOD,
      '!': T.BANG, '#': T.HASH, '?': T.QUESTION,
      '$': T.DOLLAR, '&': T.AMPERSAND, '~': T.TILDE,
      '|': T.PIPE, '+': T.PLUS, '/': T.SLASH,
    };

    if (singles[ch]) {
      advance();
      emit(singles[ch], ch);
      continue;
    }

    // Numbers (INT or FLOAT)
    if (ch >= '0' && ch <= '9') {
      let num = '';
      while (i < source.length && peek() >= '0' && peek() <= '9') num += advance();
      if (peek() === '.' && peek(1) >= '0' && peek(1) <= '9') {
        num += advance(); // .
        while (i < source.length && peek() >= '0' && peek() <= '9') num += advance();
        emit(T.FLOAT, num);
      } else {
        emit(T.INT, num);
      }
      continue;
    }

    // Identifiers and keywords
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      let id = '';
      while (i < source.length && (
        (peek() >= 'a' && peek() <= 'z') ||
        (peek() >= 'A' && peek() <= 'Z') ||
        (peek() >= '0' && peek() <= '9') ||
        peek() === '_' || peek() === '#' ||  // allow # in identifiers like C#4
        peek() === "'" || peek() === '"'   // allow ' and " in identifiers like A', B", F'24
      )) {
        id += advance();
      }
      // Check keywords
      if (KEYWORDS[id]) {
        emit(KEYWORDS[id], id);
      } else {
        emit(T.IDENT, id);
      }
      continue;
    }

    // Unknown character — skip with warning
    console.warn(`Tokenizer: unexpected character '${ch}' at ${line}:${col}`);
    advance();
  }

  emit(T.EOF, null);
  return tokens;
}

export { tokenize, T };
