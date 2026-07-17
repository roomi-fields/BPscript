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
  WIRE:         'WIRE',        // >> (câbler série — LANG-SONS §9)
  WIRE_CUT:     'WIRE_CUT',    // !>> (couper un câble — LANG-SONS §9)
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
  STRING:       'STRING',      // "verse.bps" (quoted string)
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

    // Quoted string — "file.bps" (for @scene paths)
    if (ch === '"') {
      advance(); // opening "
      let str = '';
      while (i < source.length && peek() !== '"') str += advance();
      if (i < source.length) advance(); // closing "
      emit(T.STRING, str);
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
      if (peek(1) === '-' && peek(2) === '>') { advance(); advance(); advance(); emit(T.ARROW_BI, '<->'); continue; }
      if (peek(1) === '-') { advance(); advance(); emit(T.ARROW_L, '<-'); continue; }
      if (peek(1) === '>') { advance(); advance(); emit(T.ARROW_BI, '<>'); continue; }
      if (peek(1) === '=') { advance(); advance(); emit(T.LTE, '<='); continue; }
      advance(); emit(T.LT, '<'); continue;
    }

    if (ch === '-' && peek(1) === '>') { advance(); advance(); emit(T.ARROW_R, '->'); continue; }

    // Câblage son (LANG-SONS §9) : >> câbler série, !>> couper. Munch maximal AVANT >=/!=.
    if (ch === '>' && peek(1) === '>') { advance(); advance(); emit(T.WIRE, '>>'); continue; }
    if (ch === '>' && peek(1) === '=') { advance(); advance(); emit(T.GTE, '>='); continue; }
    if (ch === '>') { advance(); emit(T.GT, '>'); continue; }

    if (ch === '=' && peek(1) === '=') { advance(); advance(); emit(T.EQ, '=='); continue; }

    if (ch === '!' && peek(1) === '>' && peek(2) === '>') { advance(); advance(); advance(); emit(T.WIRE_CUT, '!>>'); continue; }
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
      while (i < source.length) {
        const p = peek();
        // Alphanum, #, quotes : absorbed unconditionally
        if ((p >= 'a' && p <= 'z') || (p >= 'A' && p <= 'Z') ||
            (p >= '0' && p <= '9') || p === '#' ||
            p === "'" || p === '"') {
          id += advance();
        } else if (p === '_') {
          // '_' absorbed into ident ONLY if followed by an alphanumeric char.
          // If trailing (end of word), it becomes a separate PROLONG token below.
          // BP3 rule (OkBolChar2 / Encode.c:415): '_' is not a valid char inside
          // a terminal — trailing underscores are prolongation objects.
          const after = source[i + 1];
          if (after !== undefined && /[a-zA-Z0-9]/.test(after)) {
            id += advance(); // absorb internal '_' (e.g. Up_Down, sa_4, Num_total)
          } else {
            break; // trailing '_' → stop, emit ident then PROLONG tokens below
          }
        } else {
          break;
        }
      }
      // Check for hyphenated identifier:
      // 1. Hyphenated non-terminal (pre-scanned): A8-2, my-var — IDENT unique
      // 2. Flag decrement / qualifier value: K1-1, pure_minor-third_meantone
      //    BP3 rule (CompileGrammar.c:1196): un terminal ne peut jamais contenir '-'.
      //    Encode.c:140 : un '-' dans le texte de règle → silence autonome (SEARCHTERMINAL2).
      //    On n'absorbe le '-' collé que si le caractère suivant est alphanumérique
      //    [a-zA-Z0-9], pour préserver les décréments de flag [K1-1] (IDENT "K1-" + INT)
      //    et les valeurs de qualifier (pure_minor-third_meantone).
      //    "do4-" (fin de mot) → IDENT(do4) + REST séparé (parité BP3).
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
          // BP3 : un terminal ne contient jamais '-' (GetBol, CompileGrammar.c:1196) ;
          // un '-' en fin de mot est un silence séparé que le moteur pèle
          // (Encode.c:140 -> SEARCHTERMINAL2). On n'absorbe le '-' collé que
          // s'il est suivi d'un alphanumérique : décrément de flag [K1-1]
          // (IDENT "K1-" + INT) et valeurs à tiret (pure_minor-third_meantone).
          // "do4-" / "re6-" => IDENT + REST (deux tokens, parité BP3).
          const after = peek(1);
          if (peek() === '-' && after !== '>' && after !== '-' &&
              after !== undefined && /[a-zA-Z0-9]/.test(after)) {
            id += advance();
          }
        }
      }
      // Emit ident (keyword or plain)
      if (KEYWORDS[id]) {
        emit(KEYWORDS[id], id);
      } else {
        emit(T.IDENT, id);
      }
      // Emit trailing '_' as separate PROLONG tokens (BP3 OkBolChar2 / Encode.c:415:
      // '_' is a prolongation object, never part of a terminal name).
      // Example : si3_____ → IDENT(si3) + PROLONG×5 ; pa3_ → IDENT(pa3) + PROLONG×1
      while (i < source.length && peek() === '_') {
        advance();
        emit(T.PROLONG, '_');
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
