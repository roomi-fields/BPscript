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

  // Flag operators (7)
  EQ:           'EQ',          // ==
  NEQ:          'NEQ',         // !=
  GT:           'GT',          // >
  LT:           'LT',         // <
  GTE:          'GTE',         // >=
  LTE:          'LTE',         // <=
  PLUS:         'PLUS',        // +

  // Keywords (3 + 1)
  GATE:         'GATE',        // gate
  TRIGGER:      'TRIGGER',     // trigger
  CV:           'CV',          // cv
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
  'lambda': T.LAMBDA,
};

/**
 * Pre-scan: collect all LHS identifiers (non-terminals) that contain '-'.
 * These need to be tokenized as single IDENT tokens.
 * BP3 allows '-' in non-terminal names but not in terminals (Bernard Bel convention).
 */
function prescanHyphenatedNonTerminals(source) {
  const ids = new Set();
  // Match LHS symbols before arrows: word-word -> or word-word <-
  // Also handle multi-symbol LHS: contextual rules with multiple symbols before ->
  const arrowRe = /^.*?(?:->|<-|<>)/gm;
  let m;
  while ((m = arrowRe.exec(source)) !== null) {
    // Strip guard brackets [..] before scanning — K1-1 inside guards is NOT a non-terminal
    const lhs = m[0].replace(/->|<-|<>/, '').replace(/\[[^\]]*\]/g, '').trim();
    // Extract identifiers containing '-' from the LHS
    // Match sequences of alphanumeric/_ chars joined by hyphens: Tr-11, my-var-3
    const identRe = /[a-zA-Z][a-zA-Z0-9_#'"]*(?:-[a-zA-Z0-9_#'"]+)+/g;
    let im;
    while ((im = identRe.exec(lhs)) !== null) {
      ids.add(im[0]);
    }
  }
  return ids;
}

function tokenize(source, opts = {}) {
  // Collect hyphenated non-terminals from LHS pre-scan
  const hyphenatedIds = opts.hyphenatedIds || prescanHyphenatedNonTerminals(source);

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
  let _spaceBefore = true;  // track whitespace before current token (start of line = true)

  function emit(type, value) {
    tokens.push({ type, value, line, col: col - (value ? value.length : 0), spaceBefore: _spaceBefore });
    _spaceBefore = false;  // reset after emit
  }

  while (i < source.length) {
    const ch = peek();
    const startLine = line;
    const startCol = col;

    // Whitespace (not newlines)
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      _spaceBefore = true;
      advance();
      continue;
    }

    // Newline
    if (ch === '\n') {
      advance();
      emit(T.NEWLINE, '\n');
      _spaceBefore = true;  // start of new line
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

    // Tempo operator: * (multiply duration)
    if (ch === '*') { advance(); emit(T.STAR, '*'); continue; }

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
      // Check for hyphenated identifier:
      // 1. Hyphenated non-terminal (pre-scanned): Tr-11, my-var
      // 2. Trailing hyphen on any identifier: do4-, mi4- (BP3 convention)
      //    Rule: `-` immediately after an ident (no space) = part of the name
      //    But `-` after space = REST (silence)
      if (peek() === '-') {
        let candidate = id;
        let savedI = i, savedLine = line, savedCol = col;
        // Try consuming hyphen(s) and following chars for hyphenated non-terminals
        while (peek() === '-') {
          candidate += advance(); // consume -
          while (i < source.length && (
            (peek() >= 'a' && peek() <= 'z') ||
            (peek() >= 'A' && peek() <= 'Z') ||
            (peek() >= '0' && peek() <= '9') ||
            peek() === '_' || peek() === '#' ||
            peek() === "'" || peek() === '"'
          )) {
            candidate += advance();
          }
        }
        if (hyphenatedIds.has(candidate)) {
          id = candidate; // accept the hyphenated non-terminal form
        } else {
          // rollback — not a known non-terminal
          i = savedI; line = savedLine; col = savedCol;
          // Check for trailing hyphen: ident immediately followed by `-`
          // where `-` is NOT followed by `>` (arrow) and NOT part of a separator
          if (peek() === '-' && peek(1) !== '>' && peek(1) !== '-') {
            // Trailing hyphen — consume it as part of the identifier
            id += advance();
          }
        }
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
