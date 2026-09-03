// src/transpiler/tokenizer.js
var LexError = class extends Error {
  constructor(message, line, col) {
    super(message);
    this.name = "LexError";
    this.line = line;
    this.col = col;
  }
};
var CARACTERES_CONNUS_MAIS_ETRANGERS = /* @__PURE__ */ new Map([
  ["'", "BPScript n'a pas de litt\xE9ral entre guillemets \u2014 un terminal s'\xE9crit nu (X, pas 'X')."],
  ['"', `BPScript n'a pas de litt\xE9ral entre guillemets \u2014 un terminal s'\xE9crit nu (X, pas "X").`],
  [";", "le s\xE9parateur de s\xE9quence de BP2 n'existe pas \u2014 une r\xE8gle par ligne."],
  // ⚠️ CETTE ENTRÉE DONNAIT UNE RÉÉCRITURE, ET LA RÉÉCRITURE ÉTAIT MORTE. Un refus qui nomme une
  // forme la ressuscite pour son lecteur : c'est le troisième domicile d'un mot retiré, après le
  // parser et les librairies, et aucun garde ne compile un message. Le refus reste NU tant qu'il
  // n'a pas de réécriture vivante à donner.
  ["\\", "l'antislash n'a aucun emploi dans le langage."],
  ["%", "le pourcentage n'est pas un signe du langage \u2014 un poids s'\xE9crit '[weight:N]'."]
]);
var T = Object.freeze({
  // Structural symbols
  AT: "AT",
  // @
  ARROW_R: "ARROW_R",
  // ->
  ARROW_L: "ARROW_L",
  // <-
  ARROW_BI: "ARROW_BI",
  // <>
  LBRACE: "LBRACE",
  // {
  RBRACE: "RBRACE",
  // }
  COMMA: "COMMA",
  // ,
  LPAREN: "LPAREN",
  // (
  RPAREN: "RPAREN",
  // )
  COLON: "COLON",
  // :
  EQUALS: "EQUALS",
  // =
  LBRACKET: "LBRACKET",
  // [
  RBRACKET: "RBRACKET",
  // ]
  BACKTICK: "BACKTICK",
  // ` ... `
  REST: "REST",
  // -
  PROLONG: "PROLONG",
  // _
  PERIOD: "PERIOD",
  // .
  UNDETERMINED: "UNDETERMINED",
  // ...
  BANG: "BANG",
  // !
  TRIGGER_IN: "TRIGGER_IN",
  // <!
  HASH: "HASH",
  // #
  QUESTION: "QUESTION",
  // ?
  DOLLAR: "DOLLAR",
  // $
  AMPERSAND: "AMPERSAND",
  // &
  TILDE: "TILDE",
  // ~
  PIPE: "PIPE",
  // |
  COMPOUND: "COMPOUND",
  // |[ … ] objet sonore composé (ratifié Romain 2026-07-18)
  // Tempo operators (in [] qualifiers)
  STAR: "STAR",
  // *
  // Flag operators
  EQ: "EQ",
  // ==
  NEQ: "NEQ",
  // !=
  GT: "GT",
  // >
  LT: "LT",
  // <
  GTE: "GTE",
  // >=
  LTE: "LTE",
  // <=
  PLUS: "PLUS",
  // +
  // Keywords
  // Literals
  INT: "INT",
  // 123
  FLOAT: "FLOAT",
  // 0.5  (only in params, not period)
  IDENT: "IDENT",
  // Sa, melodie, phase, etc.
  STRING: "STRING",
  // "verse.bps" (quoted string)
  SLASH: "SLASH",
  // /  (for ratios like 3/2)
  // Structure
  SEPARATOR: "SEPARATOR",
  // -----
  COMMENT: "COMMENT",
  // // ...
  NEWLINE: "NEWLINE",
  // end of line
  EOF: "EOF"
});
var KEYWORDS = {
  // ⛔ `gate`, `trigger` ET `cv` ONT QUITTÉ CETTE TABLE LE 2026-08-24, et ils y confisquaient trois
  // noms pour rien. Les mots sont SORTIS du langage — `gate` et `trigger` le 2026-08-15, `cv` le
  // 2026-08-08 — et le compilateur les refusait déjà PARTOUT : en tête de scène, en clé de `def`, en
  // clé de sac, après `out.`. Tant qu'ils étaient des jetons ici, personne ne pouvait NOMMER un
  // terminal `gate`, `cv` ou `trigger`, et le refus rendu était « Expected IDENT, got GATE » — une
  // faute de lexeur pour un nom parfaitement ordinaire.
  //
  // ⚠️ ET LA VALEUR EST SORTIE À SON TOUR, le 2026-08-30. `gate` et `trigger` ont survécu au mot
  // comme les deux valeurs de `temporalType` sur une déclaration de terminal, émises par le
  // compilateur et lues par BPx. Décision de Romain : ils sortent COMME MOTS DU LANGAGE, et ce
  // champ était l'un de leurs deux référents de langage. ⇒ Le statut de terminal vient désormais de
  // la PRÉSENCE de l'entrée. ⇒ Ici, rien ne change : ces noms restent des identifiants ordinaires,
  // et un auteur peut nommer un terminal `gate` comme il le nommerait `zorglub` — mesuré.
};
function tokenize(source, opts = {}) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  function peek(offset = 0) {
    return source[i + offset];
  }
  function advance() {
    const ch = source[i++];
    if (ch === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }
  function match(str) {
    return source.substring(i, i + str.length) === str;
  }
  let _spaceBefore = true;
  let _profCrochet = 0;
  function emit(type, value) {
    tokens.push({ type, value, line, col: col - (value ? value.length : 0), spaceBefore: _spaceBefore });
    _spaceBefore = false;
  }
  while (i < source.length) {
    const ch = peek();
    const startLine = line;
    const startCol = col;
    if (ch === " " || ch === "	" || ch === "\r") {
      _spaceBefore = true;
      advance();
      continue;
    }
    if (ch === "\n") {
      advance();
      emit(T.NEWLINE, "\n");
      _spaceBefore = true;
      continue;
    }
    if (ch === "/" && peek(1) === "/") {
      let text = "";
      while (i < source.length && peek() !== "\n") text += advance();
      emit(T.COMMENT, text);
      continue;
    }
    if (ch === "-" && peek(1) === "-" && peek(2) === "-" && peek(3) === "-" && peek(4) === "-") {
      let sep = "";
      while (i < source.length && peek() === "-") sep += advance();
      emit(T.SEPARATOR, sep);
      continue;
    }
    if (ch === "." && peek(1) === "." && peek(2) === ".") {
      advance();
      advance();
      advance();
      emit(T.UNDETERMINED, "...");
      continue;
    }
    if (ch === '"') {
      advance();
      let str = "";
      const ouvert = { line, col };
      for (; ; ) {
        while (i < source.length && peek() !== '"') str += advance();
        if (i >= source.length) {
          throw new LexError(
            `Texte ouvert \xE0 la ligne ${ouvert.line}, colonne ${ouvert.col} et jamais ferm\xE9 \u2014 il avale tout ce qui suit, et la sc\xE8ne compile \xE0 vide. Un texte se ferme par un guillemet ; un guillemet \xC0 L'INT\xC9RIEUR d'un texte se double.`,
            ouvert.line,
            ouvert.col
          );
        }
        advance();
        if (peek() === '"') {
          str += advance();
          continue;
        }
        break;
      }
      emit(T.STRING, str);
      continue;
    }
    if (ch === "`") {
      const ouvert = { line, col };
      let n = 0;
      while (peek() === "`") {
        advance();
        n++;
      }
      const cloture = "`".repeat(n);
      let code = "";
      for (; ; ) {
        if (i >= source.length) {
          throw new LexError(
            `A code block opened with ${n} backtick${n > 1 ? "s" : ""} at line ${ouvert.line}, column ${ouvert.col} is never closed \u2014 it swallows everything that follows. Close it with the same run of ${n} backtick${n > 1 ? "s" : ""}.`,
            ouvert.line,
            ouvert.col
          );
        }
        if (peek() === "`" && source.startsWith(cloture, i) && source[i + n] !== "`") {
          i += n;
          col += n;
          break;
        }
        code += advance();
      }
      emit(T.BACKTICK, code);
      continue;
    }
    if (ch === "|" && peek(1) === "[") {
      advance();
      advance();
      let inner = "";
      while (i < source.length && peek() !== "]") inner += advance();
      if (i < source.length) advance();
      emit(T.COMPOUND, inner.replace(/\s+/g, ""));
      tokens[tokens.length - 1].parties = inner.trim().split(/\s+/).filter(Boolean);
      continue;
    }
    if (ch === "<") {
      if (peek(1) === "!") {
        advance();
        advance();
        emit(T.TRIGGER_IN, "<!");
        continue;
      }
      if (peek(1) === "-" && peek(2) === ">") {
        advance();
        advance();
        advance();
        emit(T.ARROW_BI, "<->");
        continue;
      }
      if (peek(1) === "-") {
        advance();
        advance();
        emit(T.ARROW_L, "<-");
        continue;
      }
      if (peek(1) === ">") {
        advance();
        advance();
        emit(T.ARROW_BI, "<>");
        continue;
      }
      if (peek(1) === "=") {
        advance();
        advance();
        emit(T.LTE, "<=");
        continue;
      }
      advance();
      emit(T.LT, "<");
      continue;
    }
    if (ch === "-" && peek(1) === "-") {
      let j = 1;
      while (peek(j) === "-") j++;
      if (peek(j) === ">") {
        const fleche = "-".repeat(j) + ">";
        throw new LexError(
          `'${fleche}' est la fl\xE8che du moteur historique, elle n'existe pas en BPScript \u2014 la r\xE8gle s'\xE9crit avec '->'. Ce sont deux langages distincts : ce qui s'\xE9crit ainsi dans une grammaire native ne se recopie pas ici. (Un SILENCE en membre gauche, lui, reste permis : il s'\xE9crit d\xE9tach\xE9, '- V V -> \u2026'.) Ligne ${line}, colonne ${col}.`,
          line,
          col
        );
      }
    }
    if (ch === "-" && peek(1) === ">") {
      advance();
      advance();
      emit(T.ARROW_R, "->");
      continue;
    }
    if (ch === ">" && peek(1) === "=") {
      advance();
      advance();
      emit(T.GTE, ">=");
      continue;
    }
    if (ch === ">") {
      advance();
      emit(T.GT, ">");
      continue;
    }
    if (ch === "=" && peek(1) === "=") {
      advance();
      advance();
      emit(T.EQ, "==");
      continue;
    }
    if (ch === "!" && peek(1) === "=") {
      advance();
      advance();
      emit(T.NEQ, "!=");
      continue;
    }
    if (ch === "*") {
      advance();
      emit(T.STAR, "*");
      continue;
    }
    const singles = {
      "@": T.AT,
      "{": T.LBRACE,
      "}": T.RBRACE,
      ",": T.COMMA,
      "(": T.LPAREN,
      ")": T.RPAREN,
      ":": T.COLON,
      "=": T.EQUALS,
      "[": T.LBRACKET,
      "]": T.RBRACKET,
      "-": T.REST,
      "_": T.PROLONG,
      ".": T.PERIOD,
      "!": T.BANG,
      "#": T.HASH,
      "?": T.QUESTION,
      "$": T.DOLLAR,
      "&": T.AMPERSAND,
      "~": T.TILDE,
      "|": T.PIPE,
      "+": T.PLUS,
      "/": T.SLASH
    };
    if (singles[ch]) {
      if (ch === "[") _profCrochet++;
      if (ch === "]") _profCrochet = Math.max(0, _profCrochet - 1);
      advance();
      emit(singles[ch], ch);
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      let num = "";
      while (i < source.length && peek() >= "0" && peek() <= "9") num += advance();
      if (peek() === "." && peek(1) >= "0" && peek(1) <= "9") {
        num += advance();
        while (i < source.length && peek() >= "0" && peek() <= "9") num += advance();
        emit(T.FLOAT, num);
      } else {
        emit(T.INT, num);
      }
      continue;
    }
    if (ch >= "a" && ch <= "z" || ch >= "A" && ch <= "Z") {
      let id = "";
      while (i < source.length) {
        const p = peek();
        if (p >= "a" && p <= "z" || p >= "A" && p <= "Z" || p >= "0" && p <= "9" || p === "#" || p === "'" || p === '"') {
          id += advance();
        } else if (p === "_") {
          const after = source[i + 1];
          if (after !== void 0 && /[a-zA-Z0-9]/.test(after)) {
            id += advance();
          } else {
            break;
          }
        } else {
          break;
        }
      }
      if (peek() === "-" && peek(1) !== ">" && _profCrochet === 0) {
        while (peek() === "-" && peek(1) !== ">") {
          id += advance();
          while (i < source.length && (peek() >= "a" && peek() <= "z" || peek() >= "A" && peek() <= "Z" || peek() >= "0" && peek() <= "9" || peek() === "_" || peek() === "#" || peek() === "'" || peek() === '"')) {
            id += advance();
          }
        }
      }
      if (KEYWORDS[id]) {
        emit(KEYWORDS[id], id);
      } else {
        emit(T.IDENT, id);
      }
      while (i < source.length && peek() === "_") {
        advance();
        emit(T.PROLONG, "_");
      }
      continue;
    }
    const aide = CARACTERES_CONNUS_MAIS_ETRANGERS.get(ch) ?? "ce caract\xE8re n'a aucun sens dans le langage \u2014 v\xE9rifier la frappe (docs/spec/LANGUAGE.md).";
    throw new LexError(
      `Caract\xE8re inattendu '${ch}' \xE0 la ligne ${line}, colonne ${col} \u2014 ${aide}`,
      line,
      col
    );
  }
  emit(T.EOF, null);
  refuserUnPointACheval(tokens);
  return tokens;
}
function refuserUnPointACheval(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== T.PERIOD) continue;
    const suivant = tokens[i + 1];
    const finDeLigne = !suivant || suivant.type === T.NEWLINE || suivant.type === T.EOF;
    const separeAvant = !!tokens[i].spaceBefore;
    const separeApres = finDeLigne ? true : !!suivant.spaceBefore;
    if (separeAvant === separeApres) continue;
    const gauche = i > 0 && tokens[i - 1].value != null ? String(tokens[i - 1].value) : "";
    const droite = finDeLigne ? "" : String(suivant.value ?? "");
    const { line, col } = tokens[i];
    if (!droite) {
      throw new LexError(
        `'${gauche}.' : nom attendu apr\xE8s le point \u2014 il est coll\xE9 \xE0 '${gauche}' et RIEN ne le suit, il n'a donc rien \xE0 qualifier. \xC9crire le nom ('${gauche}.<nom>'), ou le d\xE9tacher pour en faire une fronti\xE8re ('${gauche} .'). Ligne ${line}, colonne ${col}.`,
        line,
        col
      );
    }
    throw new LexError(
      `'${gauche}${separeAvant ? " " : ""}.${separeApres ? " " : ""}${droite}' : le point est ${separeAvant ? "D\xC9TACH\xC9 \xE0 gauche et COLL\xC9 \xE0 droite" : "COLL\xC9 \xE0 gauche et D\xC9TACH\xC9 \xE0 droite"}, et il ne dit alors ni l'un ni l'autre de ses deux r\xF4les. COLL\xC9 des deux c\xF4t\xE9s il QUALIFIE le terme de gauche par celui de droite ('${gauche}.${droite}') ; D\xC9TACH\xC9 des deux c\xF4t\xE9s il S\xC9PARE \u2014 fronti\xE8re entre fragments de dur\xE9e \xE9gale ('${gauche} . ${droite}'). \xC9crire l'une des deux. Ligne ${line}, colonne ${col}.`,
      line,
      col
    );
  }
}

export {
  LexError,
  T,
  tokenize
};
