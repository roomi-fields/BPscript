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
      advance();
      let code = "";
      while (i < source.length && peek() !== "`") code += advance();
      if (i < source.length) advance();
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

// src/transpiler/libs-data.js
var LIBS = {};
LIBS["alphabets"] = { "documented": true, "resolvedBy": "Kairos", "resolves": "alphabet", "western": { "description": "Western chromatic \u2014 7 natural notes, 5 alteration levels", "runtime": "audio", "tuning": "western_12TET", "octaves": "western", "diapason": 440, "resolvesPitch": true, "alterations": { "bb": -2, "b": -1, "": 0, "#": 1, "##": 2 }, "baseNote": "A", "baseRegister": "4", "terminals": { "C": {}, "D": {}, "E": {}, "F": {}, "G": {}, "A": {}, "B": {} } }, "sargam": { "description": "Indian sargam \u2014 7 svaras", "runtime": "audio", "tuning": "sargam_12TET", "octaves": "saptak", "diapason": 240, "resolvesPitch": true, "alterations": { "komal": -1, "": 0, "tivra": 1 }, "baseNote": "sa", "baseRegister": "madhya", "terminals": { "sa": {}, "re": {}, "ga": {}, "ma": {}, "pa": {}, "dha": {}, "ni": {} } }, "bp3_indian": { "description": "Sargam TEL QUE LE MOTEUR BP3 NATIF le nomme (convention de notes INDIAN) \u2014 alphabet de test BP3, \xE0 c\xF4t\xE9 des autres (arbitrage Romain 2026-07-19)", "runtime": "audio", "tuning": "bp3_indian_12TET", "octaves": "bp3", "diapason": 440, "resolvesPitch": true, "alterations": { "k": -1, "": 0, "#": 1 }, "baseNote": "dha", "baseRegister": "4", "terminals": { "sa": {}, "re": {}, "ga": {}, "ma": {}, "pa": {}, "dha": {}, "ni": {} } }, "bp3_english": { "description": "Convention de notes ENGLISH du moteur BP3 natif \u2014 alphabet de test BP3, \xE0 c\xF4t\xE9 des autres (d\xE9cision Romain 2026-07-29 : la m\xE9canique n'utilise que des alphabets)", "runtime": "audio", "tuning": "bp3_english_12TET", "octaves": "bp3", "diapason": 440, "resolvesPitch": true, "alterations": { "b": -1, "": 0, "#": 1 }, "baseNote": "A", "baseRegister": "4", "terminals": { "C": {}, "D": {}, "E": {}, "F": {}, "G": {}, "A": {}, "B": {} } }, "bp3_fr": { "description": "Convention de notes FRENCH du moteur BP3 natif \u2014 alphabet de test BP3, \xE0 c\xF4t\xE9 des autres (d\xE9cision Romain 2026-07-29)", "runtime": "audio", "tuning": "bp3_fr_12TET", "octaves": "bp3_fr", "diapason": 440, "resolvesPitch": true, "alterations": { "b": -1, "": 0, "#": 1 }, "baseNote": "la", "baseRegister": "3", "terminals": { "do": {}, "re": {}, "mi": {}, "fa": {}, "sol": {}, "la": {}, "si": {} } }, "solfege": { "description": "Solf\xE8ge latin \u2014 do r\xE9 mi fa sol la si", "runtime": "audio", "tuning": "solfege_12TET", "octaves": "western", "diapason": 440, "resolvesPitch": true, "alterations": { "bb": -2, "b": -1, "": 0, "#": 1, "##": 2 }, "baseNote": "la", "baseRegister": "4", "terminals": { "do": {}, "re": {}, "mi": {}, "fa": {}, "sol": {}, "la": {}, "si": {} } }, "arabic": { "description": "Arabic \u2014 7 perde (noms de degr\xE9s) with quarter-tone alterations. rast\u2248do, sikah=tierce neutre, awj=septi\xE8me neutre.", "runtime": "audio", "tuning": "arabic_24TET", "diapason": 440, "resolvesPitch": true, "alterations": { "bb": -4, "b": -2, "half_b": -1, "": 0, "half_#": 1, "#": 2, "##": 4 }, "baseNote": "husayni", "terminals": { "rast": {}, "dukah": {}, "sikah": {}, "jaharkah": {}, "nawa": {}, "husayni": {}, "awj": {} } }, "turkish": { "description": "Turkish makam \u2014 note names from Ottoman/Turkish tradition", "runtime": "audio", "tuning": "turkish_53TET", "octaves": "turkish", "diapason": 440, "resolvesPitch": true, "alterations": { "bakiye": 4, "kucuk_mucenneb": 5, "": 0, "buyuk_mucenneb": 8, "tanini": 9 }, "baseNote": "neva", "baseRegister": "", "terminals": { "kaba_cargah": {}, "yegah": {}, "huseyni_asiran": {}, "acem_asiran": {}, "irak": {}, "rast": {}, "dugah": {}, "segah": {}, "buselik": {}, "cargah": {}, "neva": {}, "huseyni": {}, "acem": {}, "evic": {}, "mahur": {}, "gerdaniye": {} } }, "gamelan_pelog": { "description": "Javanese gamelan pelog \u2014 7 tones", "runtime": "audio", "tuning": "gamelan_pelog", "diapason": 282, "resolvesPitch": true, "alterations": {}, "baseNote": "nem", "terminals": { "nem": {}, "barang": {}, "bem": {}, "gulu": {}, "lima": {}, "enam": {}, "pitu": {} } }, "gamelan_slendro": { "description": "Javanese gamelan slendro \u2014 5 tones", "runtime": "audio", "tuning": "gamelan_slendro", "diapason": 282, "resolvesPitch": true, "alterations": {}, "baseNote": "nem", "terminals": { "nem": {}, "barang": {}, "gulu": {}, "dada": {}, "lima": {} } }, "shakuhachi": { "description": "Shakuhachi \u2014 5 base fingerings (Kinko-ry\u016B)", "runtime": "audio", "tuning": "shakuhachi_12TET", "octaves": "shakuhachi", "diapason": 293.66, "resolvesPitch": true, "alterations": { "meri": -1, "": 0, "kari": 1 }, "baseNote": "ro", "baseRegister": "otsu", "terminals": { "ro": {}, "tsu": {}, "re": {}, "chi": {}, "ri": {} } }, "bohlen_pierce": { "description": "Bohlen-Pierce \u2014 13 pitch classes in a tritave", "runtime": "audio", "tuning": "bohlen_pierce_equal", "diapason": 440, "resolvesPitch": true, "alterations": {}, "baseNote": "C", "terminals": { "C": {}, "Db": {}, "D": {}, "E": {}, "F": {}, "Gb": {}, "G": {}, "H": {}, "Jb": {}, "J": {}, "A": {}, "Bb": {}, "B": {} } }, "tabla": { "description": "Bols de tabla \u2014 les syllabes ATOMIQUES, celles qu'aucune autre ne compose", "runtime": "audio", "resolvesPitch": false, "alterations": {}, "terminals": { "dha": { "voice": "bayan_open" }, "ta": { "voice": "dayan_tap" }, "dhin": { "voice": "bayan_open" }, "tin": { "voice": "dayan_ring" }, "dhee": {}, "tee": { "voice": "dayan_open" }, "ge": { "voice": "bayan_open" }, "ke": { "voice": "bayan_muted" }, "ra": {}, "tr": {}, "kt": { "voice": "dayan_dry" }, "ti": { "voice": "dayan_tap" }, "ne": {}, "na": { "voice": "dayan_ring" }, "tk": {}, "dhr": {}, "ng": {}, "gr": {}, "te": {}, "tt": {}, "ki": {}, "ka": { "voice": "bayan_muted" } } }, "simple": { "description": "Abstract symbols \u2014 single lowercase letters, no pitch. For structural test scenes.", "runtime": "audio", "resolvesPitch": false, "alterations": {}, "terminals": { "a": {}, "b": {}, "c": {}, "d": {}, "e": {}, "f": {}, "g": {}, "h": {}, "i": {}, "j": {}, "k": {}, "l": {}, "m": {}, "n": {}, "o": {}, "p": {}, "q": {}, "r": {}, "s": {}, "t": {}, "u": {}, "v": {}, "w": {}, "x": {}, "y": {}, "z": {}, "Z": {}, "filler": {}, "b1": {}, "c1": {}, "d1": {} } }, "shruti23": { "description": "22-shruti nomm\xE9 BP3 \u2014 23 degr\xE9s microtonaux (sa, r1..r4, g1..g4, m1, m2, m3p1, m4p2, p3, p4, d1..d4, n1..n4). Noms verbatim de -to.tryShruti, tonique sa.", "runtime": "audio", "tuning": "shruti23_native", "octaves": "saptak_us", "diapason": 261.625, "resolvesPitch": true, "alterations": { "": 0 }, "baseNote": "sa", "baseRegister": "4", "terminals": { "sa": {}, "r1": {}, "r2": {}, "r3": {}, "r4": {}, "g1": {}, "g2": {}, "g3": {}, "g4": {}, "m1": {}, "m2": {}, "m3p1": {}, "m4p2": {}, "p3": {}, "p4": {}, "d1": {}, "d2": {}, "d3": {}, "d4": {}, "n1": {}, "n2": {}, "n3": {}, "n4": {} } }, "tryCsoundObjects": { "description": "Objets sonores Csound de la grammaire de test tryCsoundObjects (sans hauteur)", "runtime": "audio", "resolvesPitch": false, "alterations": {}, "terminals": { "a": { "voice": "dummy_csound_a" }, "b": { "voice": "dummy_csound_b" }, "c": { "voice": "dummy_csound_c" }, "d": { "voice": "dummy_csound_d" }, "e": { "voice": "dummy_csound_e" }, "f": { "voice": "dummy_csound_f" }, "midiobject": { "voice": "dummy_csound_midiobject" } } } };
LIBS["audio"] = { "controls": { "wave": { "args": ["type"], "values": ["sine", "triangle", "square", "sawtooth"], "default": "triangle", "description": "Oscillator waveform (Web Audio)", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "audio" }, "attack": { "args": ["ms"], "range": [1, 5e3], "unit": "ms", "default": 20, "description": "Envelope attack in ms (Web Audio)", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "audio" }, "release": { "args": ["ms"], "range": [1, 5e3], "unit": "ms", "default": 100, "description": "Envelope release in ms (Web Audio)", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "audio" }, "detune": { "args": ["cents"], "range": [-1200, 1200], "unit": "cents", "default": 0, "description": "Detune in cents (Web Audio)", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "audio" }, "filter": { "args": ["freq"], "range": [20, 2e4], "unit": "Hz", "default": 2e4, "description": "Lowpass filter cutoff Hz (Web Audio)", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "audio" }, "filterQ": { "args": ["value"], "range": [0, 30], "default": 1, "description": "Filter resonance Q (Web Audio)", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "audio" }, "volume": { "implements": "expression.volume", "args": ["value"], "range": [0, 127], "description": "Gain d'acteur \u2014 un \xE9tage permanent entre les voix d'un acteur et le ma\xEEtre. Le runtime audio convertit cette valeur en gain lin\xE9aire.", "scope": ["symbol", "group", "rule", "flow", "scene"], "transportGroup": "audio" } }, "documented": true, "resolves": "audio", "name": "audio", "resolvedBy": "runtime-audio", "description": "Contr\xF4les sp\xE9cifiques au transport Web Audio \u2014 match EXACT LIBRAIRIES.md:173." };
LIBS["core"] = { "apporte": ["expression", "midi", "audio", "transpo", "engine", "time", "variation", "eval", "midi_default"], "documented": true, "resolves": "core", "name": "core", "description": "BPscript core \u2014 silences, prolongation, contr\xF4les moteur, SOCLE des d\xE9fauts de sc\xE8ne", "version": "0.2.0", "symbols": {}, "defaults": { "components": { "alphabet": "western", "tuning": "western_12TET", "transport": "audio", "eval": "js" }, "values": { "diapason": { "range": [16, 8e3], "unit": "Hz", "overriddenBy": ["tuning.diapason", "alphabet.diapason"], "description": "Hauteur de r\xE9f\xE9rence (Hz). Le d\xE9faut vient du champ `diapason` de l'ALPHABET EFFECTIF (acteur ?? sc\xE8ne `alphabet.X` ?? alphabet par d\xE9faut `core`, `components.alphabet`) \u2014 l'ancre est une propri\xE9t\xE9 du syst\xE8me de notes, pas de l'accordage (cf. SCENE_DEFAULTS_CASCADE.md). Surchargeable par `diapason:N` en t\xEAte de sc\xE8ne, ou `(diapason:N)` sur une occurrence. Si l'alphabet n'est pas r\xE9solu, la valeur reste ABSENTE (l'aval r\xE9sout)." } } }, "settings": { "on_fail": { "type": "directive", "values": ["skip", "retry", "fallback"], "default": "skip", "description": "Gestion d'\xE9chec de d\xE9rivation" } }, "schema": { "grammarWords": { "qualite": "plancher", "methode": "epreuve de substitution : la meme ligne ecrite deux fois \u2014 avec le mot puis avec un nom fabrique. Si la ligne cesse d etre lue de la meme facon alors le mot porte la structure. Un releve sur le code ne l etablit PAS : il rend un melange de natures de noeud et de mots du langage.", "perimetre": "19 candidats eprouves le 2026-08-24 depuis trois sources : les comparaisons du parseur \xB7 le schema de syntaxe publie \xB7 les cinq mots que la decision du 2026-08-21 nomme.", "mots": ["actor", "core", "def", "in", "init", "mode", "object", "out", "seed", "terminal"], "sortisDuLangage": ["object"] }, "catalogAxes": ["alphabet", "tuning", "octaves", "scale", "sound", "eval", "voice"], "deprecatedTransports": ["browser", "webaudio"], "channels": { "audio": { "out": true, "writable": true, "params": { "gain": 1 } }, "midi": { "in": true, "out": true, "writable": true, "params": { "ch": 1 } }, "osc": { "in": true, "out": true, "writable": true, "params": { "host": "127.0.0.1", "port": 57120, "addr": "/kanopi" } }, "keyboard": { "in": true, "writable": true }, "dmx": { "out": true, "writable": true, "params": { "universe": 0 } }, "text": { "out": true, "writable": false } }, "qualifierKeys": ["scan", "weight", "on_fail", "meter", "rotate", "legato", "staccato"], "reservedDirectives": ["scale", "alphabet", "tuning", "octaves", "sound", "eval", "def", "init", "actor", "core", "ins", "transpose", "scaleshift", "chromashift", "homomorphism", "settings", "filter", "modulation", "diapason", "out"], "actorKeys": ["alphabet", "tuning", "octaves", "out", "eval"], "deprecatedActorKeys": ["sound", "sounds", "voice"], "declarationTypes": ["flag", "symbol", "control", "addresskey", "native", "destination", "enum", "object"], "varConventions": ["signal", "pitch", "phase", "logic"] } };
LIBS["digital"] = { "documented": true, "resolvedBy": "Kairos", "resolves": "function", "name": "digital", "type": "digital", "objects": { "scaleshift": { "description": "Transposition SCALAIRE (diatonique) : d\xE9calage de N degr\xE9s d'alphabet (Sa +2 \u2192 Ga). Pr\xE9serve les degr\xE9s, pas les intervalles (en gamme in\xE9gale). Anciennement rotate-HAUTEUR ; distinct du ![rotate] de structure (moteur BPx).", "rank": 10, "params": { "n": { "from": "value", "coerce": "raw", "default": 0, "description": "Nombre de degr\xE9s de d\xE9calage dans l'alphabet (peut \xEAtre n\xE9gatif ; report de registre aux bornes)." } }, "body": "// Corps de la fonction digitale `scaleshift` \u2014 AUTHORING F1 (vrai .ts TYP\xC9 contre le SDK Kairos).\n// Source de v\xE9rit\xE9 : ce fichier ; libs-bundle.js greffe ce SOURCE sur l'entr\xE9e `objects.scaleshift`\n// d\xE9clar\xE9e dans lib/digital.bpsl \u2192 libs-data.js.\n// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis ex\xE9cute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.\n// \u26A0\uFE0F TRANSPOSITION SCALAIRE (diatonique) : d\xE9calage de N DEGR\xC9S d'alphabet (Sa +2 \u2192 Ga), report de\n//    registre aux bornes. Anciennement `rotate` de HAUTEUR \u2014 renomm\xE9 (d\xE9cision 2026-07-11 : deux\n//    transpositions nomm\xE9es, r\xE9elle vs scalaire). RIEN \xC0 VOIR avec le ![rotate] de STRUCTURE\n//    (RotateSequence, rotation de s\xE9quence, moteur BPx), qui garde son nom.\nimport type { DigitalFn } from '@kairos/core';\n\n/** scaleshift \u2014 transposition scalaire : d\xE9cale de N degr\xE9s dans l'alphabet (Sa +2 \u2192 Ga). Recouvre le\n *  degr\xE9 depuis le pas via `models.alphabet.degrees`, tourne l'index (mod taille alphabet, avec report\n *  de registre), recompose. Pr\xE9serve les DEGR\xC9S, pas les intervalles (en gamme in\xE9gale). */\nconst scaleshift: DigitalFn = (ctx) => {\n  const p = ctx.target.pitch;\n  if (!p) return;\n  const degs = ctx.models.alphabet.degrees;   // pas de grille de chaque degr\xE9, ordonn\xE9 (ex. 12-TET [0,2,4,5,7,9,11])\n  const div = ctx.models.temperament.divisions;\n  const n = Number(ctx.params.n ?? 0);\n  const reg = Math.floor(p.step / div);\n  const inOct = ((p.step % div) + div) % div;\n  const idx = degs.indexOf(inOct);\n  if (idx < 0) return;                          // pas hors alphabet : identit\xE9 (best-effort)\n  const len = degs.length, raw = idx + n;\n  const ni = ((raw % len) + len) % len;\n  p.step = degs[ni] + (reg + Math.floor(raw / len)) * div;\n};\n\nexport default scaleshift;\n" }, "chromashift": { "description": "Transposition CHROMATIQUE sur la grille 12 cl\xE9s : d\xE9cale de N cl\xE9s chromatiques (demi-tons), renomme vers la cl\xE9 cible + son tuning. Image de BP3 _transpose (d\xE9cision Romain 2026-07-17). Distinct de scaleshift (diatonique) et transpose (r\xE9el, nom pr\xE9serv\xE9).", "rank": 10, "params": { "n": { "from": "value", "coerce": "raw", "default": 0, "description": "Nombre de cl\xE9s chromatiques (demi-tons) de d\xE9calage sur la grille 12 (peut \xEAtre n\xE9gatif ; wrap \xE0 l'octave)." } }, "body": "// Corps de la fonction digitale `chromashift` \u2014 AUTHORING F1 (vrai .ts TYP\xC9 contre le SDK Kairos).\n// Source de v\xE9rit\xE9 : ce fichier ; libs-bundle.js greffe ce SOURCE sur l'entr\xE9e `objects.chromashift`\n// d\xE9clar\xE9e dans lib/digital.bpsl \u2192 libs-data.js.\n// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis ex\xE9cute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.\n// \u26A0\uFE0F TRANSPOSITION CHROMATIQUE (grille 12 cl\xE9s) : image de BP3 _transpose (d\xE9cision Romain\n//    2026-07-17, hub/decisions/2026-07-17-bp3-transpose-est-scaleshift-sur-grille-12-cles.md).\n//    D\xE9cale le pas ABSOLU de N cl\xE9s chromatiques (N demi-tons) ; Kairos renomme vers la cl\xE9 cible\n//    et prend SON tuning (transposeToken). DISTINCT de `scaleshift` (diatonique, N degr\xE9s d'alphabet)\n//    et de `transpose` (r\xE9el, frameRatio, nom PR\xC9SERV\xC9). Trois gestes nets (Romain, option B).\nimport type { DigitalFn } from '@kairos/core';\n\n/** chromashift \u2014 transposition sur la GRILLE 12 CL\xC9S chromatiques : d\xE9cale le pas absolu de N\n *  positions (N demi-tons). `ctx.target.pitch.step` = pas ABSOLU sur la grille du temp\xE9rament\n *  (confirm\xE9 Kairos [504] : degr\xE9 + alt\xE9ration + registre\xB7divisions). Kairos re-projette le delta\n *  de step \u2192 renomme chromatiquement + retune sur la cl\xE9 d'arriv\xE9e. = BP3 _transpose(N)\n *  (Zouleb.c:555-574, key += Round(trans/100)). PORTER\u2260R\xC9SOUDRE : je d\xE9cale le pas, je ne r\xE9sous rien. */\nconst chromashift: DigitalFn = (ctx) => {\n  const p = ctx.target.pitch;\n  if (!p) return;\n  p.step += Number(ctx.params.n ?? 0);\n};\n\nexport default chromashift;\n" }, "keyxpand": { "description": "Dilatation/contraction des pas autour d'un pivot (step = pivot + arrondi((step \u2212 pivot) \xD7 facteur)).", "rank": 20, "params": { "pivotStep": { "from": "pivot", "coerce": "token-step", "default": 0, "description": "Pivot : token de note r\xE9solu en pas de grille par la coercition token-step de Kairos (crie si irr\xE9soluble) ; reste fixe." }, "factor": { "from": "factor", "coerce": "raw", "default": 1, "description": "Facteur d'\xE9chelle de l'\xE9cart au pivot (1 = identit\xE9, 2 = doubl\xE9, 0,5 = repli\xE9 ; peut \xEAtre n\xE9gatif = miroir)." } }, "body": "// Corps de la fonction digitale `keyxpand` \u2014 AUTHORING F1 (vrai .ts TYP\xC9 contre le SDK Kairos).\n// Source de v\xE9rit\xE9 : ce fichier ; libs-bundle.js greffe ce SOURCE sur l'entr\xE9e `objects.keyxpand`\n// d\xE9clar\xE9e dans lib/digital.bpsl \u2192 libs-data.js.\n// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis ex\xE9cute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.\nimport type { DigitalFn } from '@kairos/core';\n\n/** keyxpand \u2014 dilate/contracte l'\xE9cart au pivot d'un facteur (le pivot reste fixe). facteur 1 = identit\xE9,\n *  2 = intervalles doubl\xE9s, 0,5 = repli\xE9s de moiti\xE9. R\xE9sultat arrondi au pas de grille le plus proche.\n *  Kairos pr\xE9-r\xE9sout le token pivot en `pivotStep` et passe `{pivotStep, factor}`. */\nconst keyxpand: DigitalFn = (ctx) => {\n  // Mutation de la COPIE (ctx.target) ; Kairos d\xE9rive le Hz APR\xC8S (delta net). `step` = axe de grille absolu.\n  if (ctx.target.pitch) {\n    const pivotStep = Number(ctx.params.pivotStep ?? 0);\n    const factor = Number(ctx.params.factor ?? 1);\n    ctx.target.pitch.step = pivotStep + Math.round((ctx.target.pitch.step - pivotStep) * factor);\n  }\n};\n\nexport default keyxpand;\n" }, "transpose": { "description": "Transposition R\xC9ELLE (chromatique) : d\xE9calage de l'ancre par un intervalle fixe. Pr\xE9serve les intervalles ET le nom de chaque note ; fonctionne dans tout accordage (\xE9gal, in\xE9gal, param\xE9trique). L'argument est un intervalle 3-formats (fraction 3/2, cents 700c, d\xE9cimal 1.5).", "rank": 30, "params": { "ratio": { "from": "value", "coerce": "interval-ratio", "description": "Intervalle normalis\xE9 en ratio par Kairos depuis la cha\xEEne 3-formats. Un transpose NUM\xC9RIQUE crie ici (cri de migration : l'ancien r\xE9gime par pas de grille est supprim\xE9)." }, "interval": { "from": "value", "coerce": "raw", "description": "La cha\xEEne d'intervalle brute (diagnostic) ; le corps ne la parse pas." } }, "body": "// Corps de la fonction digitale `transpose` \u2014 AUTHORING F1 (vrai .ts TYP\xC9 contre le SDK Kairos).\n// Source de v\xE9rit\xE9 : ce fichier ; libs-bundle.js greffe ce SOURCE sur l'entr\xE9e `objects.transpose`\n// d\xE9clar\xE9e dans lib/digital.bpsl \u2192 libs-data.js.\n// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis ex\xE9cute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.\n// \u26A0\uFE0F TRANSPOSITION R\xC9ELLE (chromatique) : d\xE9calage de l'ANCRE par un INTERVALLE fixe. Pr\xE9serve les\n//    intervalles ET le nom de chaque note (on d\xE9place le cadre, pas les notes contre un cadre fig\xE9).\n//    Marche dans TOUT accordage (\xE9gal ET in\xE9gal), et m\xEAme en temp\xE9rament param\xE9trique (sans grille).\n//    D\xE9cision 2026-07-11 : deux transpositions nomm\xE9es, r\xE9elle (ici) vs scalaire (scaleshift).\nimport type { DigitalFn } from '@kairos/core';\n\n/** transpose \u2014 transposition r\xE9elle : multiplie le facteur de cadre `frameRatio` par l'intervalle.\n *  `ctx.params.ratio` = intervalle D\xC9J\xC0 NORMALIS\xC9 par Kairos (fraction 3/2 | cents 700c | d\xE9cimal 1.5) ;\n *  `ctx.params.interval` = la cha\xEEne brute (diagnostic). Kairos SEUL applique `hz \xD7 frameRatio` en fin de\n *  r\xE9solution, APR\xC8S les ops de grille \u2014 noms/registres pr\xE9serv\xE9s par construction. Je ne parse RIEN. */\nconst transpose: DigitalFn = (ctx) => {\n  if (ctx.target.pitch) {\n    ctx.target.pitch.frameRatio = (ctx.target.pitch.frameRatio ?? 1) * Number(ctx.params.ratio);\n  }\n};\n\nexport default transpose;\n" } } };
LIBS["engine"] = { "controls": { "srand": { "bp3": "_srand", "bpscript": false, "args": ["seed"], "description": "Geste NATIF : reamorce le generateur aleatoire EN COURS de derivation. \u26A0\uFE0F BPScript PORTE CE GESTE, contrairement a ce que ce champ a affirme jusqu au 2026-08-13 : la re-semence en flux s ecrit ![seed:42] (nee le 2026-08-10, commit 750d457, qui lui a retire son arobase). Mesure : elle compile et atteint l arbre en InstantControl porteur de flux:true, distincte du reglage de scene seed:42. La prose disait ici que BPScript n exposait que la graine de scene, qui  n est pas le meme geste  -- c etait FAUX, et cette phrase est la raison pour laquelle ce mot est reste hors du vocabulaire. Le champ bpscript n est PAS touche : declarer un mot du langage est un arbitrage de Romain, jamais une consequence de ma mesure." }, "print": { "bp3": "_print", "bpscript": false, "description": "Geste NATIF : affiche la chaine de travail dans la fenetre de trace du moteur d origine. BPScript n a pas cette fenetre et n a aucune raison d exposer le mot ; il est declare pour que le frontal BP3 puisse router les grammaires qui l ecrivent.", "args": [] } }, "documented": true, "resolves": "engine", "resolvedBy": "BPx", "name": "engine", "description": "Les cl\xE9s que le MOTEUR DE D\xC9RIVATION consomme \u2014 ce qui gouverne comment la production se d\xE9roule, par opposition \xE0 ce qu'elle produit. Librairie d'EN-T\xCATE, r\xE9solue par BPx.", "version": "1.0.0", "engine": { "mode": { "args": ["mode"], "values": ["rnd", "ord", "sub", "sub1", "lin", "tem", "poslong"], "default": "ord", "description": "Mode de derivation du bloc/sous-grammaire (rnd, ord, sub, sub1, lin, tem, poslong) -- defaut : ord.", "scope": ["subgrammar"] }, "scan": { "args": ["direction"], "values": ["left", "right", "rnd"], "default": "rnd", "description": "Sens du parcours par regle (left, right, rnd) -- defaut : rnd.", "scope": ["scene", "rule"] }, "weight": { "args": ["value"], "description": "Poids de la regle -- un entier, 'inf' pour la priorite absolue, ou un K-param.", "scope": ["rule"] }, "resetweights": { "bp3": "ResetWeights", "bp3value": 1, "description": "Les poids des regles repartent de leur valeur ecrite dans la grammaire. Image de ResetWeights au moteur natif.", "scope": ["scene"], "args": [] }, "keepweights": { "bp3": "ResetWeights", "bp3value": 0, "description": "Les poids des regles gardent la valeur ou la derivation les a laisses. Image de ResetWeights au moteur natif.", "scope": ["scene"], "args": [] }, "on_fail": { "args": ["strategy"], "default": "skip", "description": "Gestion d'echec de derivation (skip, retry(N), fallback(X)) -- defaut : skip. PAS de 'values' enum (contrairement a mode/scan) : retry/fallback prennent un ARGUMENT ('retry(2)', 'fallback(Autre)'), que le validateur enum (controlValidation.js, comparaison EXACTE) rejetterait -- mesure par vocabulaire_appels.mjs section 2quinquies bis.", "scope": ["scene", "rule"] }, "meter": { "args": ["signature"], "description": "Signature rythmique -- (meter:7/8), (meter:4+4/4).", "scope": ["scene", "rule"] }, "repeat": { "bp3": "_repeat", "scope": ["rule"], "args": ["expr"], "description": "Controlled repetition. expr = K-param or K-param=value." }, "failed": { "bp3": "_failed", "scope": ["rule"], "args": ["subgrammar", "rule"], "description": "Jump on derivation failure." }, "stop": { "bp3": "_stop", "scope": ["rule"], "description": "Stop derivation.", "args": [] }, "goto": { "bp3": "_goto", "scope": ["rule"], "args": ["subgrammar", "rule"], "description": "Jump to specific subgrammar and rule." }, "retro": { "bp3": "_retro", "scope": ["flow"], "description": "Retrograde \u2014 reverse element order. PORTEE flow UNIQUEMENT : le marqueur agit sur ce qui SUIT. Mesure du moteur d origine (Zouleb.c:95-175, BPx 2026-08-09) : sur un outil seriel il avance APRES le marqueur et prend pour cible la suite, et sa boucle s arrete net sur une fermante \u2014 aucune branche ne regarde en arriere. La forme collee apres une fermante etait donc acceptee et SILENCIEUSEMENT INERTE.", "args": [] }, "shuffle": { "bp3": "_rndseq", "args": ["seed"], "scope": ["flow"], "description": "Shuffle \u2014 random reordering of sequence elements. seed arg \u2192 _srand(N) prefix. PORTEE flow UNIQUEMENT : voir retro. Corpus mesure : 32 occurrences de l outil AVANT un bloc contre 2 apres une fermante, et ces 2 portent sur la suite (S --> a b {_retro c d e} _retro f g)." }, "order": { "bp3": "_ordseq", "scope": ["flow"], "description": "Order \u2014 restore canonical order of sequence elements. PORTEE flow UNIQUEMENT : voir retro.", "args": [] }, "rotate": { "bp3": "_rotate", "args": ["degrees"], "scope": ["flow"], "description": "Rotate \u2014 cyclic rotation of sequence by N positions (engine, temporal). PORTEE flow UNIQUEMENT : voir retro. Distinct from runtime (rotate) which is a pitch transformation." }, "staccato": { "bp3": "_staccato", "args": ["value"], "range": [0, 127], "description": "Staccato \u2014 shorten note durations (affects temporal structure)", "scope": ["symbol", "group", "rule", "flow"] }, "legato": { "bp3": "_legato", "args": ["value"], "range": [0, 1e3], "description": "Legato \u2014 extend note durations (affects temporal structure)", "scope": ["symbol", "group", "rule", "flow"] }, "rndtime": { "bp3": "_rndtime", "args": ["amount"], "range": [0, 32767], "unit": "ms", "description": "Random timing jitter \u2014 displaces note attacks by \xB1N ms (temporal). Like staccato/legato, a current-parameter control, not a reorder.", "scope": ["scene", "symbol", "group", "rule", "flow"] }, "destru": { "bp3": "_destru", "description": "Destructure composed terminals based on alphabet", "scope": ["subgrammar", "rule"], "args": [] } }, "subgrammar": { "randomize": { "bp3": "_randomize", "description": "Re-seed RNG from clock at production start (BP3 _randomize preamble, Encode.c case 50)", "scope": ["subgrammar", "flow", "scene"], "bagOnly": true, "args": [] }, "striated": { "bp3": "_striated", "description": "Striated time (pulsed)", "scope": ["subgrammar", "scene"], "unicite": "nature-du-temps", "args": [] }, "smooth": { "bp3": "_smooth", "description": "Smooth time (non-pulsed)", "scope": ["subgrammar", "scene"], "unicite": "nature-du-temps", "args": [] } }, "schema": { "reservedDirectives": { "mode": { "description": "Mode de derivation du bloc/sous-grammaire (rnd, ord, sub, sub1, lin, tem, poslong) -- defaut : ord.", "scope": ["subgrammar"] }, "scan": { "description": "Sens du parcours par regle (left, right, rnd) -- defaut : rnd.", "scope": ["scene", "rule"] }, "weight": { "description": "Poids de la regle -- un entier, 'inf' pour la priorite absolue, ou un K-param.", "scope": ["rule"] }, "seed": { "description": "Graine du tirage aleatoire -- seed:N fige la derivation ; sans elle (ou absente), le tirage est aleatoire (decision Romain 2026-08-09). BP3 Seed. PORTEE flow AJOUTEE le 2026-08-10 : la graine s ecrit AUSSI dans le flux, ![seed:N] (forme validee par Romain), ou elle traduit le _srand(N) natif. La convention flow n est pas neuve \u2014 retro, shuffle, rotate, order et randomize la portent deja ; ce qui manquait etait de la declarer pour seed, dont le parseur connaissait la graphie sans que la donnee la dise.", "scope": ["scene", "flow"] }, "maxitems": { "description": "Nombre maximum d'items produits par la derivation (BP3 MaxItemsProduce).", "scope": ["scene"] }, "items": { "description": "Alias de maxitems (BP3 MaxItemsProduce).", "scope": ["scene"] }, "allitems": { "description": "Produit tous les items possibles, desactive improvize (BP3 AllItems).", "scope": ["scene"] }, "all_items": { "description": "Alias de allitems (BP3 AllItems).", "scope": ["scene"] }, "improvize": { "description": "Derivation continue sans fin (BP3 Improvize).", "scope": ["scene"] }, "on_fail": { "description": "Gestion d'echec de derivation (skip, retry(N), fallback(X)) -- defaut : skip. PAS de 'values' enum (contrairement a mode/scan) : retry/fallback prennent un ARGUMENT ('retry(2)', 'fallback(Autre)'), que le validateur enum (controlValidation.js, comparaison EXACTE) rejetterait -- mesure par vocabulaire_appels.mjs section 2quinquies bis.", "scope": ["scene", "rule"] }, "quantization": { "description": "Tolerance de placement en ms (BP3 Quantization). N'EST PAS une grille : mesure sur le moteur natif, aucune borne d'evenement ne tombe sur un multiple de cette valeur. Elle est comparee au pas interne u de la piece et rend un facteur de regroupement k = floor(valeur/u)+1, que le moteur annonce (compression rate). k=1 : sortie inchangee a l'octet. k>1 : les instants sont refondus sur une table plus grossiere \u2014 des evenements distincts partagent des bornes, la piece s'allonge, le depart quitte zero.", "scope": ["scene"] }, "qclock": { "description": "Periode du metronome Q (BP3 Qclock).", "scope": ["scene"] }, "repeat": { "description": "Controlled repetition. expr = K-param or K-param=value.", "scope": ["rule"] }, "goto": { "description": "Jump to specific subgrammar and rule.", "scope": ["rule"] }, "retro": { "description": "Retrograde \u2014 reverse element order. PORTEE flow UNIQUEMENT : le marqueur agit sur ce qui SUIT. Mesure du moteur d origine (Zouleb.c:95-175, BPx 2026-08-09) : sur un outil seriel il avance APRES le marqueur et prend pour cible la suite, et sa boucle s arrete net sur une fermante \u2014 aucune branche ne regarde en arriere. La forme collee apres une fermante etait donc acceptee et SILENCIEUSEMENT INERTE.", "scope": ["flow"] }, "shuffle": { "description": "Shuffle \u2014 random reordering of sequence elements. seed arg \u2192 _srand(N) prefix. PORTEE flow UNIQUEMENT : voir retro. Corpus mesure : 32 occurrences de l outil AVANT un bloc contre 2 apres une fermante, et ces 2 portent sur la suite (S --> a b {_retro c d e} _retro f g).", "scope": ["flow"] }, "rotate": { "description": "Rotate \u2014 cyclic rotation of sequence by N positions (engine, temporal). PORTEE flow UNIQUEMENT : voir retro. Distinct from runtime (rotate) which is a pitch transformation.", "scope": ["flow"] }, "order": { "description": "Order \u2014 restore canonical order of sequence elements. PORTEE flow UNIQUEMENT : voir retro.", "scope": ["flow"] }, "stop": { "description": "Stop derivation.", "scope": ["rule"] }, "failed": { "description": "Jump on derivation failure.", "scope": ["rule"] }, "randomize": { "description": "Re-seed RNG from clock at production start (BP3 _randomize preamble, Encode.c case 50)", "scope": ["subgrammar", "flow", "scene"] }, "rndtime": { "description": "Random timing jitter \u2014 displaces note attacks by \xB1N ms (temporal). Like staccato/legato, a current-parameter control, not a reorder.", "scope": ["scene", "symbol", "group", "rule", "flow"] }, "destru": { "description": "Destructure composed terminals based on alphabet", "scope": ["subgrammar", "rule"] }, "meter": { "description": "Signature rythmique -- (meter:7/8), (meter:4+4/4).", "scope": ["scene", "rule"] }, "timepatterns": { "description": "Un motif temporel est un rapport de duree qui porte un nom -- timepatterns: t1=1/1, t2=3/2, ... Il se declare en tete, son nom s ecrit ensuite dans une expression polymetrique, et il occupe le temps sans sonner. LANGUAGE.md, section Les motifs temporels.", "scope": ["scene"] }, "staccato": { "description": "Staccato \u2014 shorten note durations (affects temporal structure)", "scope": ["symbol", "group", "rule", "flow"] }, "legato": { "description": "Legato \u2014 extend note durations (affects temporal structure)", "scope": ["symbol", "group", "rule", "flow"] } } } };
LIBS["eval"] = { "documented": true, "resolvedBy": "runtime-codevoices", "resolves": "eval", "name": "eval", "type": "code", "objects": { "strudel": { "description": "Motifs et \xE9chantillons, dans le navigateur.", "parameters": { "bank": { "description": "La banque d'\xE9chantillons que la voix charge. Sans elle, une sc\xE8ne qui emploie des noms d'\xE9chantillons se joue en SILENCE \u2014 mesur\xE9 chez Kanopi : \xAB banque inconnue \u2192 son MUET \xBB." } } }, "hydra": { "description": "Synth\xE8se visuelle." }, "sc": { "description": "SuperCollider \u2014 synth\xE8se audio, backend natif." }, "js": { "description": "JavaScript \xE9valu\xE9 par le runtime." }, "p5": { "description": "Croquis graphiques p5.js." }, "mercury": { "description": "Live coding minimal." }, "csound": { "description": "Csound \u2014 synth\xE8se, backend natif." }, "tidal": { "description": "TidalCycles \u2014 motifs, backend natif (SuperDirt)." }, "txt": { "description": "Texte litteral, evalue par personne. Porte une PHRASE la ou le langage n a pas de caractere d echappement : une description de librairie, un libelle. Ratifie par Romain le 2026-08-13 -- le backtick tague est la seule graphie du depot qui delimite un contenu libre, et lui en ajouter un tag coute moins qu inventer un signe." } } };
LIBS["expression"] = { "controls": { "volume": { "args": ["value"], "range": [0, 127], "description": "Volume d'une voix. MIDI le r\xE9alise en CC7 ; chaque sortie d\xE9clare sa r\xE9alisation.", "scope": ["symbol", "group", "rule", "flow", "scene"], "transportGroup": "expression" }, "vel": { "bp3": "_vel", "args": ["value"], "range": [0, 127], "default": 64, "description": "Velocity (0-127). WebAudio: gain, MIDI: NoteOn velocity", "scope": ["symbol", "group", "rule", "flow", "scene"], "transportGroup": "expression" }, "pan": { "bp3": "_pan", "args": ["value"], "range": [0, 127], "default": 64, "description": "Pan (0=left, 64=center, 127=right). WebAudio: StereoPanner, MIDI: CC10", "scope": ["symbol", "group", "rule", "flow", "scene"], "transportGroup": "expression" }, "pancont": { "bp3": "_pancont", "description": "Panoramique en mode CONTINU \u2014 la valeur glisse PENDANT les notes, par messages interm\xE9diaires. Ses deux fr\xE8res discrets vivent dans la librairie variation ; leur destinataire se lit sur le champ resolvedBy de ce fichier-l\xE0, jamais ici.", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "expression", "args": [] }, "rndvel": { "bp3": "_rndvel", "args": ["range"], "default": 0, "description": "Random velocity +/-range", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "expression" }, "velcont": { "bp3": "_velcont", "description": "V\xE9locit\xE9 en mode CONTINU \u2014 la valeur glisse PENDANT les notes, par messages interm\xE9diaires. Ses deux fr\xE8res discrets vivent dans la librairie variation ; leur destinataire se lit sur le champ resolvedBy de ce fichier-l\xE0, jamais ici. Mesur\xE9 sur le moteur natif v3.5.1-iso.2 : sur la v\xE9locit\xE9, le continu rend des octets identiques aux paliers (FillPhaseDiagram.c porte 'not implemented' ligne 415).", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "expression", "args": [] }, "offvel": { "args": ["value"], "range": [0, 127], "default": 64, "description": "NoteOff velocity (0-127). Relevant for expressive controllers (Osmose, MPE)", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "expression" }, "articulcont": { "bp3": "_articulcont", "description": "Articulation en mode CONTINU \u2014 la valeur glisse PENDANT les notes. Ses deux fr\xE8res discrets, articulfixed et articulstep, vivent dans la librairie variation. Le comportement natif de ce mot n'est pas tranch\xE9 : aucun t\xE9moin construit sur le moteur v3.5.1-iso.2 n'a fait bouger l'articulation, le mode fixe compris.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "transposecont": { "bp3": "_transposecont", "description": "Transposition en mode CONTINU \u2014 la valeur glisse PENDANT les notes. Ses deux fr\xE8res discrets, transposefixed et transposestep, vivent dans la librairie variation ; celui-ci reste ici parce que la transposition se rend chez le m\xEAme r\xE9solveur que son param\xE8tre. Mesur\xE9 sur le moteur natif v3.5.1-iso.2 : le continu rend des octets identiques aux paliers (FillPhaseDiagram.c porte 'not implemented' ligne 608).", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "transpo", "args": [] }, "value": { "bp3": "_value", "bpscript": false, "args": ["param"], "description": "Geste NATIF : donne une valeur a un parametre de performance nomme. En BPScript la forme est !(<param>:<valeur>), le parametre etant declare par son TYPE en tete -- signal <param> -- et il est la CLE, cf. arbitrage du 2026-08-13." }, "fixed": { "bp3": "_fixed", "bpscript": false, "args": ["param"], "description": "Geste NATIF : le parametre nomme NE VARIE PAS. En BPScript : !(<param>fixed), le mode colle au parametre." }, "cont": { "bp3": "_cont", "bpscript": false, "args": ["param"], "description": "Geste NATIF : le parametre nomme varie CONTINUMENT. En BPScript : !(<param>cont)." }, "step": { "bp3": "_step", "bpscript": false, "args": ["param"], "description": "Geste NATIF : le parametre nomme varie PAR PALIERS. En BPScript : !(<param>step). Jamais declare comme mot du langage -- il entre ici par la porte du routage, pas par celle du vocabulaire." }, "panrate": { "bp3": "_panrate", "args": ["hz"], "range": [0, 1e3], "unit": "Hz", "default": 50, "description": "Cadence des valeurs intermediaires du continu de panoramique, en valeurs par seconde. Defaut 50, comme le moteur natif.", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "expression" } }, "documented": true, "resolves": "expression", "resolvedBy": "toutes les sorties", "name": "expression", "description": "Contr\xF4les qui d\xE9crivent COMMENT on joue une note, valables pour TOUTE sortie \u2014 pas un transport pr\xE9cis (LIBRAIRIES.md:171,217-219 : \xAB expression ne fait pas exception\u2026 c'est UNE destination, une classe nomm\xE9e par ce qu'elle d\xE9crit \xBB)." };
LIBS["homomorphism"] = { "documented": true, "resolvedBy": "Kairos", "name": "homomorphism", "type": "homomorphism", "resolves": "homomorphism", "objects": { "substitute": { "description": "Applicateur universel d'homomorphisme : it\xE8re la port\xE9e active et substitue chaque symbole par son image dans la table plate (last-write-wins), identit\xE9 si symbole absent. Image de l'ancien `applyImage` BPx, re-plac\xE9 en r\xE9solution Kairos (d\xE9cision 2026-07-17). C'est la seule fonction de la lib fournie : elle traite TOUS les homos en port\xE9e (multiplicit\xE9 = empilement, homos diff\xE9rents = s\xE9quence).", "body": "// Corps de la fonction d'HOMOMORPHISME `substitute` \u2014 AUTHORING F1 (vrai .ts TYP\xC9 contre le SDK Kairos).\n// Source de v\xE9rit\xE9 : ce fichier ; libs-bundle.js greffe ce SOURCE sur l'entr\xE9e `objects.substitute`\n// d\xE9clar\xE9e dans lib/homomorphism.bpsl \u2192 libs-data.js.\n// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis ex\xE9cute au load, en BAC \xC0 SABLE d\xE9terministe.\n// \u26A0\uFE0F SUBSTITUTION DE SYMBOLE (homomorphisme BP3 `-ho`/`-al`) sortie de BPx \u2192 R\xC9SOLUTION Kairos, VIA\n//    LIBRAIRIE (d\xE9cision Romain/architecte 2026-07-17, hub/decisions/2026-07-17-bpx-ordonnanceur-opaque-\n//    homomorphisme-en-resolution-kairos-librairie.md, RATIFI\xC9E). BPx devient ordonnanceur PUR : il PORTE\n//    la port\xE9e opaque (`content.homoScope`) + les TABLES plates (`metadata.homomorphisms`), il NE SUBSTITUE\n//    PLUS. Kairos applique la substitution AVANT la r\xE9solution de hauteur, puis r\xE9sout nom\u2192hz/octave.\nimport type { HomomorphismFn } from '@kairos/core';\n\n/** substitute \u2014 applicateur G\xC9N\xC9RIQUE et UNIVERSEL d'homomorphisme (pure r\xE9\xE9criture de symbole). It\xE8re la\n *  port\xE9e active haut\u2192bas ; pour chaque nom d'homo, remplace le symbole courant par son image dans la TABLE\n *  PLATE (paires last-write-wins) que Kairos adosse via `ctx.image(nom, sym)`. Symbole absent d'une table =\n *  IDENTIT\xC9 (s\xE9mantique BP3 CompileGrammar.c:873, jamais un cri). Un m\xEAme homo empil\xE9 `k` fois s'applique\n *  `k` fois (la multiplicit\xE9 est port\xE9e par la port\xE9e) ; des homos diff\xE9rents s'appliquent en s\xE9quence.\n *  Mod\xE8le PROUV\xC9 sur l'oracle natif transposition1 ([373], BPx loadGrammar.ts:6370-6394) : table plate\n *  IT\xC9R\xC9E (C3 aux profondeurs 0/1/2/3 = C3/B4/F6/F6), PAS depth-index\xE9. PORTER\u2260R\xC9SOUDRE : je query, je ne\n *  d\xE9plie ni ne connais la table brute. */\nconst substitute: HomomorphismFn = (ctx) => {\n  let s = ctx.symbol;\n  for (const name of ctx.scope) s = ctx.image(name, s) ?? s;\n  ctx.setResult(s);\n};\n\nexport default substitute;\n" } }, "tables": { "tabla_stroke": { "description": "Tabla open\u2192closed stroke mapping (qa'ida)", "mappings": { "dha": "ta", "dhin": "tin", "ge": "ke", "ghe": "khe", "dhagena": "takena", "dheene": "teene", "dheena": "teena" } }, "ruwet_mineur": { "description": "Ruwet \u2014 transformation th\xE8me majeur \u2192 mineur (D\xC9PR\xC9CI\xC9)", "mappings": { "fa4": "re4", "la4": "fa4", "sol4": "mi4" } }, "ruwet": { "description": "Ruwet \u2014 3 transformations m\xE9lodiques (fid\xE8le \xE0 bp3-engine/test-data/-ho.Ruwet)", "sections": { "m1": { "la4": "sib4" }, "m2": { "la4": "sol4" }, "mineur": { "fa4": "re4", "la4": "fa4" } } }, "dhati": { "description": "Dhati \u2014 homomorphisme tabla (fid\xE8le \xE0 -ho.dhati, section *, identit\xE9s conserv\xE9es)", "sections": { "*": { "dha": "ta", "ti": "ti", "ge": "ke", "na": "na", "dhee": "tee", "tr": "tr", "kt": "kt" } } }, "dhin": { "description": "Dhin -- homomorphisme tabla (fid\xE8le \xE0 -ho.dhin--, section *, identit\xE9s conserv\xE9es)", "sections": { "*": { "dha": "ta", "ta": "ta", "ti": "ti", "ra": "ra", "na": "na", "ki": "ki", "dhee": "tee", "ne": "ne", "ge": "ke", "ka": "ka", "dhin": "tin" } } }, "tryhomomorphism": { "description": "Homomorphisme de test (fid\xE8le \xE0 -ho.tryhomomorphism, cha\xEEne c-->fa4-->d d\xE9pli\xE9e)", "sections": { "*": { "a": "b", "do4": "re4", "c": "fa4", "fa4": "d" } } }, "checkhomo": { "description": "Test homomorphism \u2014 3 sections (*, H, TR)", "sections": { "*": { "a": "a'", "a'": 'a"', "b": "b'", "b'": "b" }, "H": { "a": "c", "c": "c'", "c'": 'a"' }, "TR": { "a'": "b'", "b'": "b" } } }, "transposition": { "description": "Auto-transposer H. Visser 1997 \u2014 homomorphisme \xE0 CHA\xCENES (fid\xE8le \xE0 bp3-engine/test-data/-ho.transposition, section TR, 3 cha\xEEnes index\xE9es par profondeur d'invocation)", "sections": { "TR": { "chains": { "C3": ["B3", "F4", "C6"], "B3": ["C3", "B4", "F6"], "F4": ["C6", "F2", "B5"] } } } }, "Ruwet": { "description": "Port\xE9 depuis bp3-engine/test-data/-ho.Ruwet le 2026-08-13, section par section et maillon par maillon. V\xE9rifi\xE9 : le d\xE9pliage en paires cons\xE9cutives redonne exactement le natif.", "sections": { "m1": { "chains": { "la4": ["sib4"] } }, "m2": { "chains": { "la4": ["sol4"] } }, "mineur": { "chains": { "fa4": ["re4"], "la4": ["fa4"] } } } }, "abc": { "description": "Port\xE9 depuis bp3-engine/test-data/-ho.abc le 2026-08-13, section par section et maillon par maillon. V\xE9rifi\xE9 : le d\xE9pliage en paires cons\xE9cutives redonne exactement le natif.", "sections": { "*": { "chains": { "a": ["a'"], "b": ["b'"], "c": ["c'"], "d": ["d'"], "e": ["e'"], "f": ["f'"], "g": ["g'"], "h": ["h'"], "i": ["i'"], "j": ["j'"], "k": ["k'"], "l": ["l'"], "m": ["m'"], "n": ["n'"], "o": ["o'"], "p": ["p'"], "q": ["q'"], "r": ["r'"], "s": ["s'"], "t": ["t'"], "u": ["u'"], "v": ["v'"], "w": ["w'"], "x": ["x'"], "y": ["y'"], "z": ["z'"] } }, "TR": { "chains": { "a": ["b"], "b": ["c"], "c": ["d"] }, "sync": true } } }, "abc1": { "description": "Port\xE9 depuis bp3-engine/test-data/-ho.abc1 le 2026-08-13, section par section et maillon par maillon. V\xE9rifi\xE9 : le d\xE9pliage en paires cons\xE9cutives redonne exactement le natif.", "sections": { "chik": { "chains": { "a": ["a'"], "b": ["b'"], "c": ["c'"], "d": ["d'"] } }, "e": { "chains": { "f": ["f'"], "g": ["g'"] } } } }, "abc2": { "description": "Port\xE9 depuis bp3-engine/test-data/-ho.abc2 le 2026-08-13. \u26A0\uFE0F La section est `sync` et non `*` : le fichier \xE9crit `*` puis `sync` sans s\xE9parateur entre les deux, et une \xC9TIQUETTE QUI SUIT UNE \xC9TIQUETTE LA REMPLACE \u2014 le natif n'ouvre une section que sur un s\xE9parateur. J'avais d'abord lu `sync` comme un MODIFICATEUR de la section courante ; c'\xE9tait une invention, le mot `sync` n'existe nulle part dans la source du moteur. Corrig\xE9 sur signalement de bp3-frontend, dont le crit\xE8re vient du moteur.", "sections": { "sync": { "chains": { "a": ["a'"], "b": ["b'"], "c": ["c'"], "d": ["d'"], "e": ["e'"], "f": ["f'"], "g": ["g'"], "h": ["h'"], "i": ["i'"], "j": ["j'"], "k": ["k'"], "l": ["l'"], "m": ["m'"], "n": ["n'"], "o": ["o'"], "p": ["p'"], "q": ["q'"], "r": ["r'"], "s": ["s'"], "t": ["t'"], "u": ["u'"], "v": ["v'"], "w": ["w'"], "x": ["x'"], "y": ["y'"], "z": ["z'"] } } } }, "abc3": { "description": "Port\xE9 depuis bp3-engine/test-data/-ho.abc3 le 2026-08-13, section par section et maillon par maillon. V\xE9rifi\xE9 : le d\xE9pliage en paires cons\xE9cutives redonne exactement le natif.", "sections": { "*": { "chains": { "a": ["a'"], "b": ["b'"], "c": ["c'"], "d": ["d'"], "e": ["e'"], "f": ["f'"], "g": ["g'"], "h": ["h'"], "i": ["i'"], "j": ["j'"], "k": ["k'"], "l": ["l'"], "m": ["m'"], "n": ["n'"], "o": ["o'"], "p": ["p'"], "q": ["q'"], "r": ["r'"], "s": ["s'"], "t": ["t'"], "u": ["u'"], "v": ["v'"], "w": ["w'"], "x": ["x'"], "y": ["y'"], "z": ["z'"] } }, "TR": { "chains": { "a": ["b"], "b": ["c"], "c": ["d"] }, "sync": true } } }, "cloches1": { "description": "Cloches \u2014 homomorphisme \xE0 CHA\xCENES, fid\xE8le \xE0 bp3-engine/test-data/-ho.cloches1 (section TR, 4 cha\xEEnes index\xE9es par profondeur d'invocation). \u26A0\uFE0F PORT\xC9 \xC0 NOUVEAU LE 2026-08-10 : la version pr\xE9c\xE9dente APLATISSAIT les cha\xEEnes en paires \u2014 elle gardait le premier maillon de chaque ligne et perdait les suivants, soit 15 maillons sur 19. Une cha\xEEne ne dit pas \xAB do3 devient mib3 \xBB : elle dit \xAB au premier appel mib3, au deuxi\xE8me fa#3, au troisi\xE8me la4 \xBB \u2014 l'aplatir change le sens, pas seulement la quantit\xE9.", "sections": { "TR": { "chains": { "do3": ["mib3", "fa#3", "la4", "do4", "mib4", "fa#4", "la5"], "sol3": ["si4", "re#4", "sol4", "si5"], "re3": ["mi4", "fab4", "fa3", "fa4"], "mi3": ["re4", "reb3", "do#4"] }, "terminaux_sans_image": ["re5", "mi5"] } } }, "dhadhatite": { "default": { "dha": "ta", "ti": "ti", "te": "te", "na": "na", "dhee": "tee", "tr": "tr" } }, "dhin--": { "default": { "dha": "ta", "ta": "ta", "ti": "ti", "ra": "ra", "na": "na", "ki": "ki", "dhee": "tee", "ne": "ne", "ge": "ke", "ka": "ka", "dhin": "tin" } }, "tabla": { "default": { "dha": "ta", "dhin": "tin", "dhee": "tee", "ge": "ke" } }, "trial_mohanam": { "description": "Port\xE9 depuis bp3-engine/test-data/-ho.trial.mohanam le 2026-08-13, section par section et maillon par maillon. V\xE9rifi\xE9 : le d\xE9pliage en paires cons\xE9cutives redonne exactement le natif.", "sections": { "trn": { "chains": { "sa6": ["ga6"], "re6": ["pa6"], "ga6": ["dha6"], "pa6": ["sa7"], "dha6": ["re7"], "sa7": ["ga7"] } } } } } };
LIBS["midi"] = { "controls": { "chan": { "bp3": "_chan", "args": ["channel"], "range": [1, 16], "description": "MIDI channel", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi" }, "ins": { "bp3": "_ins", "args": ["program"], "range": [1, 128], "description": "MIDI Program Change. L'auteur \xE9crit le num\xE9ro de programme \xE0 partir de 1, comme le moteur d'origine ; l'octet transmis vaut ce num\xE9ro moins un.", "scope": ["symbol", "group", "rule", "flow", "scene"], "transportGroup": "midi" }, "mod": { "bp3": "_mod", "args": ["value"], "range": [0, 127], "description": "MIDI Modulation (CC1)", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi" }, "modcont": { "bp3": "_modcont", "description": "Enable continuous modulation interpolation (CC1)", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi", "args": [] }, "pitchbend": { "bp3": "_pitchbend", "args": ["value"], "range": [-8192, 8191], "description": "MIDI Pitch Bend", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi" }, "pitchrange": { "bp3": "_pitchrange", "args": ["cents"], "unit": "cents", "description": "Pitch bend range in cents", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi" }, "pitchcont": { "bp3": "_pitchcont", "description": "Enable continuous pitch bend interpolation", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi", "args": [] }, "keymap": { "bp3": "_keymap", "args": ["p1", "q1", "p2", "q2"], "range": [0, 127], "description": "Key mapping \u2014 remap MIDI key range (p1,p2) to (q1,q2). Args are key numbers (0..127) or note names; p2 must be greater than p1. BP3 _keymap \u2014 registre du moteur natif, bp3-engine `origin/wasm` : capture-run/console_strings.json porte \xAB 62 4 _keymap \xBB.", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi" }, "mapcont": { "bp3": "_mapcont", "description": "Carte de touches en mode CONTINU \u2014 la carte glisse PENDANT les notes, par messages interm\xE9diaires. BP3 _mapcont \u2014 registre du moteur natif, bp3-engine `origin/wasm` : capture-run/console_strings.json porte \xAB 44 0 _mapcont \xBB. Ses deux fr\xE8res discrets vivent dans la librairie variation ; leur destinataire se lit sur le champ resolvedBy de ce fichier-l\xE0, jamais ici.", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi", "args": [] }, "pressure": { "args": ["value"], "range": [0, 127], "description": "MIDI Channel Pressure (aftertouch)", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi" }, "press": { "bp3": "_press", "args": ["value"], "range": [0, 127], "description": "MIDI Channel Pressure (alias for pressure)", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi" }, "presscont": { "bp3": "_presscont", "description": "Enable continuous channel pressure interpolation", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi", "args": [] }, "volume": { "implements": "expression.volume", "bp3": "_volume", "args": ["value"], "range": [0, 127], "description": "MIDI Volume (CC7)", "scope": ["symbol", "group", "rule", "flow", "scene"], "transportGroup": "midi" }, "volumecont": { "bp3": "_volumecont", "description": "Enable continuous volume interpolation", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi", "args": [] }, "switchon": { "bp3": "_switchon", "args": ["channel"], "description": "Enable MIDI switch channel", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi" }, "switchoff": { "bp3": "_switchoff", "args": ["channel"], "description": "Disable MIDI switch channel", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi" }, "mute": { "description": "Coupe le son. Nu, (mute), coupe tout ce qui sonne ; par composant, (mute.all) ou (mute.lead), coupe la cible nommee. Nomme le 2026-07-26 : remplace une des familles que script(...) portait sans nom.", "scope": ["flow"], "bagOnly": true, "transportGroup": "midi", "args": [] }, "unmute": { "description": "Retablit le son coupe par mute. Meme graphie : (unmute) ou (unmute.lead).", "scope": ["flow"], "bagOnly": true, "transportGroup": "midi", "args": [] }, "panic": { "description": "Arret d'urgence : toutes les notes relachees, tous les controleurs remis a plat. Image de MIDI all notes off. Ne prend aucun argument.", "scope": ["flow"], "bagOnly": true, "transportGroup": "midi", "args": [] }, "sync": { "args": ["message"], "values": ["start", "continue", "stop"], "description": "Message systeme temps reel de synchronisation : (sync:start), (sync:continue), (sync:stop). Image des messages MIDI Start/Continue/Stop. Remplace script(MIDI send Continue).", "scope": ["flow"], "transportGroup": "midi" }, "cc": { "component": "number", "args": ["value"], "range": [0, 127], "description": "Controleur MIDI NUMEROTE. Se designe par son numero de composant : (cc.98:45) en contenance, !(cc.98:45) en flux. Pour les controleurs sans alias nomme -- ceux qui en ont un s'ecrivent par leur nom (mod = CC1, volume = CC7). Graphie tranchee par Romain le 2026-07-26 : le point APPELLE le composant (le controleur 98), les deux points AFFECTENT la valeur.", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi" }, "volumerate": { "bp3": "_volumerate", "args": ["hz"], "range": [0, 1e3], "unit": "Hz", "description": "Cadence des valeurs intermediaires du continu de volume, en valeurs par seconde. Defaut 50, comme le moteur natif.", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi" }, "modrate": { "bp3": "_modrate", "args": ["hz"], "range": [0, 1e3], "unit": "Hz", "description": "Cadence des valeurs intermediaires du continu de modulation, en valeurs par seconde. Defaut 50, comme le moteur natif.", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi" }, "pitchrate": { "bp3": "_pitchrate", "args": ["hz"], "range": [0, 1e3], "unit": "Hz", "description": "Cadence des valeurs intermediaires du continu de hauteur, en valeurs par seconde. Defaut 50, comme le moteur natif.", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi" }, "pressrate": { "bp3": "_pressrate", "args": ["hz"], "range": [0, 1e3], "unit": "Hz", "description": "Cadence des valeurs intermediaires du continu de pression, en valeurs par seconde. Defaut 50, comme le moteur natif.", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "midi" }, "rate": { "bp3": "SamplingRate", "args": ["hz"], "range": [0, 1e3], "unit": "Hz", "description": "Cadence des valeurs interm\xE9diaires de TOUS les flux continus, en \xE9missions par seconde. R\xE8gle d'un mot ce que volumerate, modrate, pitchrate et pressrate r\xE8glent s\xE9par\xE9ment. Image de SamplingRate au moteur natif.", "scope": ["scene"], "transportGroup": "midi" }, "volumecontrol": { "bp3": "_volumecontrol", "args": ["controller"], "range": [0, 127], "description": "Num\xE9ro du contr\xF4leur MIDI qui porte le volume. Image de VolumeController au moteur natif. Le canal se dit dans le m\xEAme sac : !(chan:3, volumecontrol:11).", "scope": ["symbol", "group", "rule", "flow", "scene"], "transportGroup": "midi" }, "pancontrol": { "bp3": "_pancontrol", "args": ["controller"], "range": [0, 127], "description": "Num\xE9ro du contr\xF4leur MIDI qui porte le panoramique. Image de PanoramicController au moteur natif. Le canal se dit dans le m\xEAme sac : !(chan:3, pancontrol:11).", "scope": ["symbol", "group", "rule", "flow", "scene"], "transportGroup": "midi" }, "fadeout": { "bp3": "EndFadeOut", "args": ["duration"], "unit": "s", "description": "Extinction du son \xE0 la fin de la performance, en SECONDES. Une valeur inf\xE9rieure ou \xE9gale \xE0 z\xE9ro supprime le fondu. Image de EndFadeOut au moteur natif.", "scope": ["scene"], "transportGroup": "midi" }, "resetnotes": { "bp3": "ResetNotes", "bp3value": 1, "description": "\xC0 la fin de la sc\xE8ne, \xE9teindre ce qui sonne encore.", "scope": ["flow", "scene"], "bagOnly": true, "unicite": "fin-de-scene", "transportGroup": "midi", "args": [] }, "letring": { "bp3": "ResetNotes", "bp3value": 0, "description": "\xC0 la fin de la sc\xE8ne, laisser sonner ce qui sonne encore.", "scope": ["flow", "scene"], "bagOnly": true, "unicite": "fin-de-scene", "transportGroup": "midi", "args": [] }, "strikeagain": { "bp3": "StrikeAgainDefault", "bp3value": 1, "description": "Une note d\xE9j\xE0 tenue qu'on rejoue est RELANC\xC9E \u2014 nouveau NoteOn.", "scope": ["flow", "scene"], "bagOnly": true, "unicite": "note-rejouee", "transportGroup": "midi", "args": [] }, "sustain": { "bp3": "StrikeAgainDefault", "bp3value": 0, "description": "Une note d\xE9j\xE0 tenue qu'on rejoue reste TENUE \u2014 aucun nouveau NoteOn.", "scope": ["flow", "scene"], "bagOnly": true, "unicite": "note-rejouee", "transportGroup": "midi", "args": [] }, "pedalrelease": { "description": "Un interrupteur d\xE9j\xE0 enfonc\xE9 qu'on r\xE9-actionne est rel\xE2ch\xE9 puis repress\xE9.", "scope": ["flow", "scene"], "bagOnly": true, "unicite": "interrupteur-rejoue", "transportGroup": "midi", "args": [] }, "pedalhold": { "description": "Un interrupteur d\xE9j\xE0 enfonc\xE9 qu'on r\xE9-actionne garde son \xE9tat.", "scope": ["flow", "scene"], "bagOnly": true, "unicite": "interrupteur-rejoue", "transportGroup": "midi", "args": [] }, "resetcontrols": { "bp3": "ResetControllers", "bp3value": 1, "description": "\xC0 la fin de la sc\xE8ne, remettre les contr\xF4leurs \xE0 plat.", "scope": ["flow", "scene"], "bagOnly": true, "unicite": "fin-des-controleurs", "transportGroup": "midi", "args": [] }, "keepcontrols": { "bp3": "ResetControllers", "bp3value": 0, "description": "\xC0 la fin de la sc\xE8ne, laisser les contr\xF4leurs dans l'\xE9tat o\xF9 la sc\xE8ne les a mis.", "scope": ["flow", "scene"], "bagOnly": true, "unicite": "fin-des-controleurs", "transportGroup": "midi", "args": [] } }, "documented": true, "resolves": "midi", "resolvedBy": "runtime-MIDI", "name": "midi", "description": "Contr\xF4les sp\xE9cifiques au transport MIDI \u2014 match EXACT LIBRAIRIES.md:172.", "schema": { "addressKeys": { "ch": { "description": "Canal d'adresse, forme courte de channel.", "scope": ["symbol", "group", "rule", "flow"] }, "channel": { "description": "Canal d'adresse, forme longue de ch.", "scope": ["symbol", "group", "rule", "flow"] }, "device": { "description": "Appareil vis\xE9 par l'adresse.", "scope": ["symbol", "group", "rule", "flow"] }, "note": { "description": "Num\xE9ro de note d'une adresse \u2014 la source qu'un point d'attente \xE9coute, l'\xE9v\xE9nement qu'une occurrence vise.", "scope": ["symbol", "group", "rule", "flow"] }, "port": { "description": "Port vis\xE9 par l'adresse.", "scope": ["symbol", "group", "rule", "flow"] } } } };
LIBS["midi_default"] = { "documented": true, "resolvedBy": "runtime-MIDI", "resolves": "midi_default", "name": "midi_default", "description": "L'ENVIRONNEMENT MIDI PAR D\xC9FAUT \u2014 la valeur que porte chaque mot de `midi` tant qu'une sc\xE8ne n'en \xE9crit pas d'autre.", "version": "0.2.0", "controlDefaults": { "chan": 1, "mod": 0, "pitchbend": 0, "pitchrange": 200, "pressure": 0, "press": 0, "volume": 90, "volumerate": 50, "modrate": 50, "pitchrate": 50, "pressrate": 50, "rate": 50, "volumecontrol": 7, "pancontrol": 10, "fadeout": 2, "resetnotes": false, "letring": true, "strikeagain": true, "sustain": false, "pedalrelease": true, "pedalhold": false, "resetcontrols": false, "keepcontrols": true } };
LIBS["octaves"] = { "documented": true, "resolvedBy": "Kairos", "resolves": "octaves", "western": { "position": "suffix", "separator": "", "registers": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], "default": "4" }, "arrows": { "position": "suffix", "separator": "_", "registers": ["vv", "v", "", "^", "^^"], "default": "" }, "saptak": { "position": "prefix", "separator": "_", "registers": ["mandra", "madhya", "taar"], "default": "madhya" }, "turkish": { "position": "prefix", "separator": "_", "registers": ["", "tiz"], "default": "" }, "gamelan": { "position": "prefix", "separator": "_", "registers": ["ageng", "tengah", "alit"], "default": "tengah" }, "shakuhachi": { "position": "prefix", "separator": "_", "registers": ["otsu", "kan", "daikan"], "default": "otsu" }, "korean": { "position": "prefix", "separator": "_", "registers": ["tak", "jung", "cheong"], "default": "jung" }, "saptak_us": { "position": "suffix", "separator": "_", "registers": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], "default": "4" }, "bp3": { "position": "suffix", "separator": "", "registers": ["00", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], "default": "4" }, "bp3_fr": { "position": "suffix", "separator": "", "registers": ["000", "00", "0", "1", "2", "3", "4", "5", "6", "7", "8"], "default": "3" } };
LIBS["scales"] = { "apporte": ["types"], "documented": true, "resolvedBy": "Kairos", "resolves": "scale", "maqam_sikah": { "description": "Maqam Sikah \u2014 starts on sikah (E half-flat) \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [d\xE9composition en jins \xC0 \xC9TABLIR (v\xE9rification musicologique) ; ratios exacts conserv\xE9s en attendant].", "culture": "arabic", "notes_count": 7, "ratios": [1, "12/11", "27/22", "4/3", "16/11", "18/11", "11/6"], "system": "zalzal-ji" }, "maqam_jiharkah": { "description": "Maqam Jiharkah \u2014 Rast-like with lowered 7th \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [d\xE9composition en jins \xC0 \xC9TABLIR (v\xE9rification musicologique) ; ratios exacts conserv\xE9s en attendant].", "culture": "arabic", "notes_count": 7, "ratios": [1, "9/8", "5/4", "4/3", "3/2", "5/3", "11/6"], "system": "zalzal-ji" }, "maqam_suzidil": { "description": "Maqam Suzidil \u2014 Ajam lower + Hijaz Kar upper \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [d\xE9composition en jins \xC0 \xC9TABLIR (v\xE9rification musicologique) ; ratios exacts conserv\xE9s en attendant].", "culture": "arabic", "notes_count": 7, "ratios": [1, "9/8", "5/4", "4/3", "3/2", "8/5", "15/8"], "system": "zalzal-ji" }, "maqam_shawq_afza": { "description": "Maqam Shawq Afza \u2014 Sikah-based, emotional character \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [d\xE9composition en jins \xC0 \xC9TABLIR (v\xE9rification musicologique) ; ratios exacts conserv\xE9s en attendant].", "culture": "arabic", "notes_count": 7, "ratios": [1, "12/11", "6/5", "4/3", "3/2", "5/3", "11/6"], "system": "zalzal-ji" }, "jins_nikriz": { "description": "Jins Nikriz \u2014 4-note tetrachord with augmented second [ratios JI zalzaliens (depuis degr\xE9s 24-TET)].", "culture": "arabic", "temperament": "24TET", "notes_count": 4, "ratios": [1, "9/8", "6/5", "45/32"] }, "jins_athar_kurd": { "description": "Jins Athar Kurd \u2014 Kurd variant with raised 3rd [ratios JI zalzaliens (depuis degr\xE9s 24-TET)].", "culture": "arabic", "temperament": "24TET", "notes_count": 4, "ratios": [1, "16/15", "6/5", "45/32"] }, "jins_saba_zamzam": { "description": "Jins Saba Zamzam \u2014 Saba variant with flat 2nd and 4th [ratios JI zalzaliens (depuis degr\xE9s 24-TET)].", "culture": "arabic", "temperament": "24TET", "notes_count": 4, "ratios": [1, "16/15", "6/5", "5/4"] }, "jins_mustaar": { "description": "Jins Mustaar \u2014 rare 3-note jins, narrow intervals [ratios JI zalzaliens (depuis degr\xE9s 24-TET)].", "culture": "arabic", "temperament": "24TET", "notes_count": 3, "ratios": [1, "12/11", "15/13"] }, "gong": { "description": "Gong mode \u2014 1st mode of Chinese pentatonic, Do position", "culture": "chinese", "ratios": [1, "9/8", "81/64", "3/2", "27/16"], "notes_count": 5 }, "shang": { "description": "Shang mode \u2014 2nd mode of Chinese pentatonic, Re position", "culture": "chinese", "ratios": [1, "9/8", "4/3", "3/2", "16/9"], "notes_count": 5 }, "jue": { "description": "Jue mode \u2014 3rd mode of Chinese pentatonic, Mi position", "culture": "chinese", "ratios": [1, "32/27", "4/3", "128/81", "16/9"], "notes_count": 5 }, "zhi": { "description": "Zhi mode \u2014 4th mode of Chinese pentatonic, Sol position", "culture": "chinese", "ratios": [1, "9/8", "4/3", "3/2", "16/9"], "notes_count": 5 }, "yu": { "description": "Yu mode \u2014 5th mode of Chinese pentatonic, La position", "culture": "chinese", "ratios": [1, "32/27", "4/3", "3/2", "128/81"], "notes_count": 5 }, "yayue": { "description": "Yayue \u2014 Chinese ceremonial court music heptatonic scale", "culture": "chinese", "ratios": [1, "9/8", "81/64", "4/3", "3/2", "27/16", "243/128"], "notes_count": 7 }, "qingyue": { "description": "Qingyue \u2014 Chinese folk heptatonic scale with minor 7th", "culture": "chinese", "ratios": [1, "9/8", "81/64", "4/3", "3/2", "27/16", "16/9"], "notes_count": 7 }, "hirajoshi": { "description": "Hirajoshi \u2014 Japanese pentatonic scale, melancholic character", "culture": "japanese", "ratios": [1, "9/8", "6/5", "3/2", "8/5"], "notes_count": 5 }, "in_sen": { "description": "In-sen \u2014 Japanese pentatonic, used in shakuhachi music", "culture": "japanese", "ratios": [1, "16/15", "4/3", "3/2", "8/5"], "notes_count": 5 }, "yo": { "description": "Yo \u2014 Japanese pentatonic, bright folk scale", "culture": "japanese", "ratios": [1, "9/8", "4/3", "3/2", "16/9"], "notes_count": 5 }, "iwato": { "description": "Iwato \u2014 Japanese pentatonic, dark meditative scale", "culture": "japanese", "ratios": [1, "16/15", "4/3", "45/32", "8/5"], "notes_count": 5 }, "kumoi": { "description": "Kumoi \u2014 Japanese pentatonic, koto tuning", "culture": "japanese", "ratios": [1, "9/8", "6/5", "3/2", "9/5"], "notes_count": 5 }, "ryukyu": { "description": "Ryukyu \u2014 Okinawan pentatonic scale", "culture": "japanese", "ratios": [1, "5/4", "4/3", "3/2", "15/8"], "notes_count": 5 }, "miyako_bushi": { "description": "Miyako-bushi \u2014 Japanese urban pentatonic, used in koto and shamisen", "culture": "japanese", "ratios": [1, "16/15", "5/4", "3/2", "8/5"], "notes_count": 5 }, "pyeong_jo": { "description": "Pyeong-jo \u2014 Korean pentatonic mode, peaceful character", "culture": "korean", "ratios": [1, "9/8", "4/3", "3/2", "16/9"], "notes_count": 5 }, "gye_myeon_jo": { "description": "Gye-myeon-jo \u2014 Korean pentatonic mode, sorrowful character", "culture": "korean", "ratios": [1, "6/5", "4/3", "3/2", "8/5"], "notes_count": 5 }, "dorian_ancient": { "description": "Ancient Greek Dorian \u2014 descending E to E on white keys", "culture": "greek", "ratios": [1, "9/8", "32/27", "4/3", "3/2", "128/81", "16/9"], "notes_count": 7 }, "phrygian_ancient": { "description": "Ancient Greek Phrygian \u2014 descending D to D on white keys", "culture": "greek", "ratios": [1, "9/8", "81/64", "4/3", "3/2", "27/16", "243/128"], "notes_count": 7 }, "lydian_ancient": { "description": "Ancient Greek Lydian \u2014 descending C to C on white keys", "culture": "greek", "ratios": [1, "9/8", "81/64", "4/3", "3/2", "27/16", "16/9"], "notes_count": 7 }, "mixolydian_ancient": { "description": "Ancient Greek Mixolydian \u2014 descending B to B on white keys", "culture": "greek", "ratios": [1, "256/243", "32/27", "4/3", "3/2", "128/81", "16/9"], "notes_count": 7 }, "chromatic_genus": { "description": "Ancient Greek Chromatic genus tetrachord \u2014 narrow semitones + minor third", "culture": "greek", "ratios": [1, "28/27", "32/27", "4/3"], "notes_count": 4 }, "enharmonic_genus": { "description": "Ancient Greek Enharmonic genus tetrachord \u2014 quarter-tones + major third", "culture": "greek", "ratios": [1, "28/27", "16/15", "4/3"], "notes_count": 4 }, "ionian": { "description": "Medieval Ionian mode \u2014 C to C, equivalent to major scale", "culture": "medieval", "ratios": [1, "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"], "notes_count": 7 }, "dorian": { "description": "Medieval Dorian mode \u2014 D to D, minor with raised 6th", "culture": "medieval", "ratios": [1, "9/8", "6/5", "4/3", "3/2", "5/3", "9/5"], "notes_count": 7 }, "phrygian": { "description": "Medieval Phrygian mode \u2014 E to E, minor with flat 2nd", "culture": "medieval", "ratios": [1, "16/15", "6/5", "4/3", "3/2", "8/5", "9/5"], "notes_count": 7 }, "lydian": { "description": "Medieval Lydian mode \u2014 F to F, major with raised 4th", "culture": "medieval", "ratios": [1, "9/8", "5/4", "45/32", "3/2", "5/3", "15/8"], "notes_count": 7 }, "mixolydian": { "description": "Medieval Mixolydian mode \u2014 G to G, major with flat 7th", "culture": "medieval", "ratios": [1, "9/8", "5/4", "4/3", "3/2", "5/3", "9/5"], "notes_count": 7 }, "aeolian": { "description": "Medieval Aeolian mode \u2014 A to A, natural minor", "culture": "medieval", "ratios": [1, "9/8", "6/5", "4/3", "3/2", "8/5", "9/5"], "notes_count": 7 }, "locrian": { "description": "Medieval Locrian mode \u2014 B to B, diminished mode", "culture": "medieval", "ratios": [1, "16/15", "6/5", "4/3", "64/45", "8/5", "9/5"], "notes_count": 7 }, "byzantine_protos": { "description": "Byzantine Protos \u2014 1st mode of Byzantine Octoechos", "culture": "byzantine", "ratios": [1, "9/8", "12/11", "4/3", "3/2", "27/16", "18/11"], "notes_count": 7 }, "byzantine_devteros": { "description": "Byzantine Devteros \u2014 2nd mode of Byzantine Octoechos", "culture": "byzantine", "ratios": [1, "12/11", "32/27", "4/3", "3/2", "18/11", "16/9"], "notes_count": 7 }, "tizita_major": { "description": "Tizita major \u2014 Ethiopian pentatonic, nostalgic mood", "culture": "ethiopian", "ratios": [1, "9/8", "5/4", "3/2", "5/3"], "notes_count": 5 }, "tizita_minor": { "description": "Tizita minor \u2014 Ethiopian pentatonic, melancholic variant", "culture": "ethiopian", "ratios": [1, "9/8", "6/5", "3/2", "8/5"], "notes_count": 5 }, "bati_major": { "description": "Bati major \u2014 Ethiopian pentatonic, bright and festive", "culture": "ethiopian", "ratios": [1, "6/5", "4/3", "3/2", "9/5"], "notes_count": 5 }, "bati_minor": { "description": "Bati minor \u2014 Ethiopian pentatonic, darker Bati variant", "culture": "ethiopian", "ratios": [1, "6/5", "4/3", "3/2", "8/5"], "notes_count": 5 }, "ambassel": { "description": "Ambassel \u2014 Ethiopian pentatonic, spiritual and contemplative", "culture": "ethiopian", "ratios": [1, "16/15", "5/4", "3/2", "8/5"], "notes_count": 5 }, "anchihoye": { "description": "Anchihoye \u2014 Ethiopian tetratonic, simplest Ethiopian mode", "culture": "ethiopian", "ratios": [1, "6/5", "3/2", "8/5"], "notes_count": 4 }, "pelog_lima": { "description": "Pelog lima \u2014 5-note Javanese pelog, empirical tuning", "culture": "indonesian", "ratios": [1, "120c", "260c", "540c", "675c"], "notes_count": 5 }, "slendro_balinese": { "description": "Slendro Balinese \u2014 5-tone quasi-equal Balinese slendro", "culture": "indonesian", "ratios": [1, "240c", "480c", "720c", "960c"], "notes_count": 5 }, "thai_7tet": { "description": "Thai 7-TET \u2014 7 equal divisions of the octave", "culture": "thai", "ratios": [1, "171c", "343c", "514c", "686c", "857c", "1029c"], "notes_count": 7 }, "thai_pentatonic": { "description": "Thai pentatonic \u2014 5 of 7 equal steps, traditional Thai selection", "culture": "thai", "ratios": [1, "171c", "514c", "686c", "857c"], "notes_count": 5 }, "blues": { "description": "Blues scale \u2014 hexatonic with blue notes", "culture": "western", "ratios": [1, "6/5", "4/3", "7/5", "3/2", "9/5"], "notes_count": 6 }, "whole_tone": { "description": "Whole tone scale \u2014 6 equal whole steps", "culture": "western", "ratios": [1, "200c", "400c", "600c", "800c", "1000c"], "notes_count": 6 }, "diminished_hw": { "description": "Diminished scale (half-whole) \u2014 octatonic alternating H-W", "culture": "western", "ratios": [1, "100c", "300c", "400c", "600c", "700c", "900c", "1000c"], "notes_count": 8 }, "diminished_wh": { "description": "Diminished scale (whole-half) \u2014 octatonic alternating W-H", "culture": "western", "ratios": [1, "200c", "300c", "500c", "600c", "800c", "900c", "1100c"], "notes_count": 8 }, "augmented": { "description": "Augmented scale \u2014 hexatonic symmetric scale", "culture": "western", "ratios": [1, "300c", "400c", "700c", "800c", "1100c"], "notes_count": 6 }, "harmonic_minor": { "description": "Harmonic minor \u2014 natural minor with raised 7th", "culture": "western", "ratios": [1, "9/8", "6/5", "4/3", "3/2", "8/5", "15/8"], "notes_count": 7 }, "hungarian_minor": { "description": "Hungarian minor \u2014 double harmonic minor, gypsy scale", "culture": "western", "ratios": [1, "9/8", "6/5", "45/32", "3/2", "8/5", "15/8"], "notes_count": 7 }, "chromatic": { "description": "Chromatic scale \u2014 all 12 semitones", "culture": "western", "ratios": [1, "100c", "200c", "300c", "400c", "500c", "600c", "700c", "800c", "900c", "1000c", "1100c"], "notes_count": 12 }, "handpan_kurd": { "description": "Kurd \u2014 Aeolian / Natural Minor. The most popular handpan scale worldwide.", "culture": "handpan", "ratios": [1, "9/8", "6/5", "4/3", "3/2", "8/5", "9/5"], "notes_count": 7, "layout": "D3 A3 Bb3 C4 D4 E4 F4 G4 A4" }, "handpan_integral": { "description": "Integral \u2014 Aeolian without 4th. Created by PanArt (original Hang). Open, spacious.", "culture": "handpan", "ratios": [1, "6/5", "4/3", "3/2", "8/5", "9/5"], "notes_count": 6, "layout": "D3 A3 Bb3 C4 D4 F4 A4 C5" }, "handpan_celtic": { "description": "Celtic / Amara \u2014 Dorian mode. Brighter minor with raised 6th. Folk/Celtic character.", "culture": "handpan", "ratios": [1, "9/8", "6/5", "4/3", "3/2", "5/3", "9/5"], "notes_count": 7, "layout": "D3 A3 C4 D4 E4 F4 G4 A4 B4" }, "handpan_pygmy": { "description": "Pygmy \u2014 Minor pentatonic + b6. African-inspired, warm and forgiving.", "culture": "handpan", "ratios": [1, "6/5", "4/3", "3/2", "8/5", "9/5"], "notes_count": 6, "layout": "D3 A3 Bb3 C4 D4 F4 G4 A4 C5" }, "handpan_equinox": { "description": "Equinox \u2014 Phrygian mode. Dark, Spanish/Middle-Eastern flavor. Pantheon Steel.", "culture": "handpan", "ratios": [1, "16/15", "6/5", "4/3", "3/2", "8/5", "9/5"], "notes_count": 7, "layout": "D3 A3 Bb3 C4 D4 Eb4 F4 G4 A4" }, "handpan_hijaz": { "description": "Hijaz \u2014 Phrygian Dominant (5th mode of Harmonic Minor). Arabic/Spanish feel.", "culture": "handpan", "ratios": [1, "16/15", "5/4", "4/3", "3/2", "8/5", "9/5"], "notes_count": 7, "layout": "D3 A3 Bb3 C#4 D4 E4 F4 G4 A4" }, "handpan_hijaz_kar": { "description": "Hijaz Kar \u2014 Double Harmonic Major / Byzantine / Bhairav. Two Hijaz tetrachords.", "culture": "handpan", "ratios": [1, "16/15", "5/4", "4/3", "3/2", "8/5", "15/8"], "notes_count": 7, "layout": "D3 A3 Bb3 C#4 D4 E4 F4 G#4 A4" }, "handpan_golden_gate": { "description": "Golden Gate \u2014 Harmonic Minor. Classical sound, augmented second between b6 and 7.", "culture": "handpan", "ratios": [1, "9/8", "6/5", "4/3", "3/2", "8/5", "15/8"], "notes_count": 7, "layout": "D3 A3 Bb3 C4 D4 E4 F4 G#4 A4" }, "handpan_romanian_hijaz": { "description": "Romanian Hijaz \u2014 Hungarian/Double Harmonic Minor. Two augmented seconds, intense Eastern European feel.", "culture": "handpan", "ratios": [1, "9/8", "6/5", "45/32", "3/2", "8/5", "15/8"], "notes_count": 7, "layout": "D3 A3 Bb3 C#4 D4 Eb4 F#4 G4 A4" }, "handpan_akebono": { "description": "Akebono \u2014 Japanese pentatonic (In scale variant). Contemplative, zen.", "culture": "handpan", "ratios": [1, "16/15", "4/3", "3/2", "8/5"], "notes_count": 5, "layout": "D3 A3 Bb3 D4 E4 F4 A4 Bb4 D5" }, "handpan_sabye": { "description": "Sabye \u2014 PanArt creation. Mysterious, African-inspired hexatonic.", "culture": "handpan", "ratios": [1, "16/15", "6/5", "3/2", "8/5"], "notes_count": 5, "layout": "D3 A3 Bb3 D4 E4 F4 G4 A4 D5" }, "handpan_mystic": { "description": "Mystic \u2014 Phrygian without 7th. Dark, introspective, spacious.", "culture": "handpan", "ratios": [1, "16/15", "6/5", "4/3", "3/2", "8/5"], "notes_count": 6, "layout": "D3 A3 Bb3 C4 D4 Eb4 G4 A4 Bb4" }, "handpan_la_sirena": { "description": "La Sirena \u2014 Phrygian Dominant. Spanish/Arabic dramatic character.", "culture": "handpan", "ratios": [1, "16/15", "5/4", "4/3", "3/2", "8/5", "9/5"], "notes_count": 7, "layout": "D3 A3 Bb3 D4 E4 F4 A4 Bb4 C#5" }, "handpan_oxalis": { "description": "Oxalis \u2014 Dorian without 6th. Open, airy minor. Ayasa creation.", "culture": "handpan", "ratios": [1, "9/8", "6/5", "4/3", "3/2", "9/5"], "notes_count": 6, "layout": "D3 A3 C4 D4 E4 F4 A4 C5 D5" }, "handpan_jibuk": { "description": "Jibuk \u2014 Mixolydian. Major-sounding with flatted 7th. Bright, festive.", "culture": "handpan", "ratios": [1, "9/8", "5/4", "4/3", "3/2", "5/3", "9/5"], "notes_count": 7, "layout": "D3 A3 C4 D4 E4 F#4 G4 A4 B4" }, "handpan_annaziska": { "description": "Annaziska \u2014 Minor Pentatonic. Maximum consonance, impossible to play wrong.", "culture": "handpan", "ratios": [1, "6/5", "4/3", "3/2", "9/5"], "notes_count": 5, "layout": "D3 A3 C4 D4 F4 G4 A4 C5 D5" }, "handpan_ashta_taki": { "description": "Ashta Taki \u2014 Major without 6th. Bright, uplifting, rare major handpan.", "culture": "handpan", "ratios": [1, "9/8", "5/4", "4/3", "3/2", "15/8"], "notes_count": 6, "layout": "D3 A3 C4 D4 E4 F4 G4 B4 C5" }, "flamenco_phrygian": { "description": "Flamenco mode / Phrygian Dominant \u2014 the defining sound of flamenco. Hijaz maqam equivalent.", "culture": "flamenco", "ratios": [1, "16/15", "5/4", "4/3", "3/2", "8/5", "9/5"], "notes_count": 7 }, "flamenco_por_medio": { "description": "Flamenco por medio \u2014 Phrygian mode on A (guitar standard). Dark, intense.", "culture": "flamenco", "ratios": [1, "16/15", "6/5", "4/3", "3/2", "8/5", "9/5"], "notes_count": 7 }, "flamenco_por_arriba": { "description": "Flamenco por arriba \u2014 Phrygian mode on E (guitar standard). Classic flamenco position.", "culture": "flamenco", "ratios": [1, "16/15", "6/5", "4/3", "3/2", "8/5", "9/5"], "notes_count": 7 }, "flamenco_double_harmonic": { "description": "Escala andaluza / Double Harmonic Major \u2014 Hijaz Kar / Bhairav equivalent in flamenco context.", "culture": "flamenco", "ratios": [1, "16/15", "5/4", "4/3", "3/2", "8/5", "15/8"], "notes_count": 7 }, "flamenco_minor": { "description": "Flamenco minor \u2014 Harmonic minor with Andalusian cadence (iv-III-II-I).", "culture": "flamenco", "ratios": [1, "9/8", "6/5", "4/3", "3/2", "8/5", "15/8"], "notes_count": 7 }, "messiaen_mode1": { "description": "Messiaen mode 1 \u2014 Whole tone scale (6 equal divisions). Debussy, Messiaen.", "culture": "contemporary", "ratios": [1, "200c", "400c", "600c", "800c", "1000c"], "notes_count": 6 }, "messiaen_mode2": { "description": "Messiaen mode 2 \u2014 Octatonic / Diminished (half-whole). Messiaen, Bart\xF3k, Stravinsky.", "culture": "contemporary", "ratios": [1, "100c", "300c", "400c", "600c", "700c", "900c", "1000c"], "notes_count": 8 }, "messiaen_mode3": { "description": "Messiaen mode 3 \u2014 9 notes, period = major third (400c). Three transpositions.", "culture": "contemporary", "ratios": [1, "200c", "300c", "400c", "600c", "700c", "800c", "1000c", "1100c"], "notes_count": 9 }, "messiaen_mode4": { "description": "Messiaen mode 4 \u2014 8 notes, period = tritone (600c). Rare in practice.", "culture": "contemporary", "ratios": [1, "100c", "200c", "500c", "600c", "700c", "800c", "1100c"], "notes_count": 8 }, "messiaen_mode5": { "description": "Messiaen mode 5 \u2014 6 notes, period = tritone (600c).", "culture": "contemporary", "ratios": [1, "100c", "500c", "600c", "700c", "1100c"], "notes_count": 6 }, "messiaen_mode6": { "description": "Messiaen mode 6 \u2014 8 notes, period = tritone (600c). Augmented fourths.", "culture": "contemporary", "ratios": [1, "200c", "400c", "500c", "600c", "800c", "1000c", "1100c"], "notes_count": 8 }, "messiaen_mode7": { "description": "Messiaen mode 7 \u2014 10 notes, period = tritone (600c). Most dense of the modes.", "culture": "contemporary", "ratios": [1, "100c", "200c", "300c", "500c", "600c", "700c", "800c", "900c", "1100c"], "notes_count": 10 }, "chromatic_12": { "description": "Chromatic aggregate \u2014 all 12 pitch classes. Basis of serial/12-tone technique (Schoenberg, Webern, Boulez).", "culture": "contemporary", "ratios": [1, "100c", "200c", "300c", "400c", "500c", "600c", "700c", "800c", "900c", "1000c", "1100c"], "notes_count": 12 }, "spectral_harmonic_8": { "description": "Spectral scale (harmonics 8-16) \u2014 Grisey, Murail. Natural harmonic series from 8th partial.", "culture": "contemporary", "ratios": [1, "9/8", "10/8", "11/8", "12/8", "13/8", "14/8", "15/8"], "notes_count": 8 }, "spectral_harmonic_16": { "description": "Spectral scale (harmonics 1-16) \u2014 full harmonic series. Grisey Partiels, Haas.", "culture": "contemporary", "ratios": [1, "9/8", "5/4", "11/8", "3/2", "13/8", "7/4", "15/8"], "notes_count": 8 }, "bartok_acoustic": { "description": "Bart\xF3k scale / Acoustic scale / Lydian Dominant \u2014 Overtone scale (Bart\xF3k, Debussy).", "culture": "contemporary", "ratios": [1, "9/8", "5/4", "45/32", "3/2", "5/3", "9/5"], "notes_count": 7 }, "scriabin_mystic_chord": { "description": "Scriabin Mystic Chord / Prometheus scale \u2014 C F# Bb E A D as scale. Scriabin late works.", "culture": "contemporary", "ratios": [1, "200c", "400c", "600c", "900c", "1000c"], "notes_count": 6 }, "tritone_scale": { "description": "Tritone scale \u2014 Two augmented triads a semitone apart. Jazz/contemporary.", "culture": "contemporary", "ratios": [1, "100c", "400c", "500c", "800c", "900c"], "notes_count": 6 }, "slonimsky_1": { "description": "Slonimsky scale 1 \u2014 Symmetric division of octave in minor thirds + chromatic fill. Used by Coltrane.", "culture": "contemporary", "ratios": [1, "100c", "300c", "400c", "600c", "700c", "900c", "1000c"], "notes_count": 8 }, "harry_partch_43": { "description": "Harry Partch 43-tone scale \u2014 11-limit just intonation. Microtonal pioneer.", "culture": "contemporary", "ratios": [1, "81/80", "33/32", "21/20", "16/15", "12/11", "11/10", "10/9", "9/8", "8/7", "7/6", "32/27", "6/5", "11/9", "5/4", "14/11", "9/7", "21/16", "4/3", "27/20", "11/8", "7/5", "10/7", "16/11", "40/27", "3/2", "32/21", "14/9", "11/7", "8/5", "18/11", "5/3", "27/16", "12/7", "7/4", "16/9", "9/5", "20/11", "11/6", "15/8", "40/21", "64/33", "160/81"], "notes_count": 43 }, "wendy_carlos_alpha": { "description": "Wendy Carlos Alpha \u2014 15.385 steps per octave (78c per step). Non-octave scale.", "culture": "contemporary", "ratios": [1, "78c", "156c", "234c", "312c", "390c", "468c", "546c", "624c", "702c", "780c", "858c", "936c", "1014c", "1092c"], "notes_count": 15 }, "wendy_carlos_beta": { "description": "Wendy Carlos Beta \u2014 18.809 steps per octave (63.8c per step). Non-octave scale.", "culture": "contemporary", "ratios": [1, "63.8c", "127.6c", "191.3c", "255.1c", "318.9c", "382.7c", "446.5c", "510.3c", "574.0c", "637.8c", "701.6c", "765.4c", "829.2c", "893.0c", "956.8c", "1020.5c", "1084.3c"], "notes_count": 18 }, "bebop_dominant": { "description": "Bebop Dominant \u2014 Mixolydian + passing natural 7th. The quintessential bebop scale (Charlie Parker, Dizzy Gillespie).", "culture": "jazz", "ratios": [1, "9/8", "5/4", "4/3", "3/2", "5/3", "9/5", "15/8"], "notes_count": 8 }, "bebop_major": { "description": "Bebop Major \u2014 Ionian + passing #5. Barry Harris method.", "culture": "jazz", "ratios": [1, "9/8", "5/4", "4/3", "3/2", "800c", "5/3", "15/8"], "notes_count": 8 }, "bebop_dorian": { "description": "Bebop Dorian \u2014 Dorian + passing major 3rd. Minor bebop scale.", "culture": "jazz", "ratios": [1, "9/8", "6/5", "5/4", "4/3", "3/2", "5/3", "9/5"], "notes_count": 8 }, "bebop_melodic_minor": { "description": "Bebop Melodic Minor \u2014 Melodic minor ascending + passing b6. David Baker.", "culture": "jazz", "ratios": [1, "9/8", "6/5", "4/3", "3/2", "800c", "5/3", "15/8"], "notes_count": 8 }, "altered": { "description": "Altered scale / Super Locrian \u2014 7th mode of melodic minor. Essential for V7alt chords (Coltrane, Shorter, Henderson).", "culture": "jazz", "ratios": [1, "16/15", "200c", "6/5", "600c", "800c", "9/5"], "notes_count": 7 }, "lydian_augmented": { "description": "Lydian Augmented \u2014 3rd mode of melodic minor. #4 + #5. George Russell Lydian Chromatic Concept.", "culture": "jazz", "ratios": [1, "9/8", "5/4", "600c", "800c", "5/3", "15/8"], "notes_count": 7 }, "lydian_dominant": { "description": "Lydian Dominant / Lydian b7 \u2014 4th mode of melodic minor. Dominant sound with #4. (= Bart\xF3k acoustic scale).", "culture": "jazz", "ratios": [1, "9/8", "5/4", "45/32", "3/2", "5/3", "9/5"], "notes_count": 7 }, "locrian_natural2": { "description": "Locrian #2 / Half-Diminished \u2014 6th mode of melodic minor. Used on minor7b5 chords.", "culture": "jazz", "ratios": [1, "9/8", "6/5", "4/3", "600c", "8/5", "9/5"], "notes_count": 7 }, "phrygian_dominant": { "description": "Phrygian Dominant \u2014 5th mode of harmonic minor. Hijaz. Used on V7b9 in minor keys.", "culture": "jazz", "ratios": [1, "16/15", "5/4", "4/3", "3/2", "8/5", "9/5"], "notes_count": 7 }, "pentatonic_major": { "description": "Major Pentatonic \u2014 1 2 3 5 6. Foundation of blues, rock, jazz melody.", "culture": "jazz", "ratios": [1, "9/8", "5/4", "3/2", "5/3"], "notes_count": 5 }, "pentatonic_minor": { "description": "Minor Pentatonic \u2014 1 b3 4 5 b7. The most universal scale in popular music.", "culture": "jazz", "ratios": [1, "6/5", "4/3", "3/2", "9/5"], "notes_count": 5 }, "coltrane_pentatonic": { "description": "Coltrane Pentatonic \u2014 1 2 3 5 b7. Dominant pentatonic used by Coltrane on V7 chords.", "culture": "jazz", "ratios": [1, "9/8", "5/4", "3/2", "9/5"], "notes_count": 5 }, "kumoi_jazz": { "description": "Kumoi (jazz usage) \u2014 1 2 b3 5 6. Japanese-influenced pentatonic popular in jazz (McCoy Tyner).", "culture": "jazz", "ratios": [1, "9/8", "6/5", "3/2", "5/3"], "notes_count": 5 }, "in_sen_jazz": { "description": "In-Sen \u2014 1 b2 4 5 b7. Japanese scale used in jazz (John McLaughlin, Joe Henderson).", "culture": "jazz", "ratios": [1, "16/15", "4/3", "3/2", "9/5"], "notes_count": 5 }, "augmented_scale": { "description": "Augmented scale \u2014 Symmetric scale alternating m3 and H. Coltrane, Thelonious Monk.", "culture": "jazz", "ratios": [1, "6/5", "5/4", "3/2", "8/5", "15/8"], "notes_count": 6 }, "tritone_dominant": { "description": "Tritone scale (dominant) \u2014 Two major triads a tritone apart. Mark Levine, modern jazz.", "culture": "jazz", "ratios": [1, "100c", "400c", "500c", "800c", "900c"], "notes_count": 6 }, "jins_rast": { "ratios": [1, "9/8", "27/22", "4/3"], "description": "Jins Rast \u2014 t\xE9tracorde Rast \xE0 tierce neutre (C D E demi-b\xE9mol F). Tierce de Zalzal 27/22 (~354.5c) = signature musicologique de l'intonation juste arabe, PAS la tierce majeure 5/4 de Zarlino (qui donnerait un t\xE9tracorde Ajam). La donn\xE9e garde le ratio PUR (v\xE9rit\xE9 ontologique) ; la projection 24-TET (350c / 7 quarts de ton) est faite au rendu par le moteur." }, "jins_nahawand": { "ratios": [1, "9/8", "6/5", "4/3"], "description": "Jins Nahawand \u2014 t\xE9tracorde mineur (C D Eb F)" }, "jins_kurd": { "ratios": [1, "16/15", "6/5", "4/3"], "description": "Jins Kurd \u2014 t\xE9tracorde phrygien (C Db Eb F)" }, "jins_hijaz": { "ratios": [1, "16/15", "5/4", "4/3"], "description": "Jins Hijaz \u2014 seconde augment\xE9e caract\xE9ristique (C Db E F)" }, "jins_bayati": { "ratios": [1, "12/11", "6/5", "4/3"], "description": "Jins Bayati \u2014 seconde NEUTRE de Zalzal (C D-demi-b\xE9mol Eb F) : 12/11 (~151c), 6/5 (tierce mineure juste), 4/3. Intonation juste zalzalienne 5-limite (alt. pythagoricienne 32/27 pour la tierce ; on retient le juste 6/5 par coh\xE9rence du syst\xE8me arabe)." }, "jins_sikah": { "ratios": [1, "12/11", "6/5", "4/3"], "description": "Jins Sikah \u2014 assise sur la seconde neutre de Zalzal (C D-demi-b\xE9mol Eb F) : 12/11 (~151c), 6/5, 4/3. Seconde neutre = 12/11 (coh\xE9rent avec la table arabe ; remplace l'ancien 11/10 ~165c)." }, "jins_ajam": { "ratios": [1, "9/8", "5/4", "4/3"], "description": "Jins Ajam \u2014 t\xE9tracorde MAJEUR (C D E F) : 9/8 (ton), 5/4 (tierce majeure de Zarlino), 4/3 (quarte juste). C'est l'unique jins arabe \xE0 tierce majeure pure 5/4 (\u2248 majeur occidental). Le t\xE9tracorde ferme sur la quarte 4/3 (corrige l'ancien 45/32 triton, erron\xE9 pour un jins)." }, "jins_saba": { "ratios": [1, "12/11", "6/5", "13/10"], "description": "Jins Saba \u2014 seconde neutre + tierce mineure + quarte DIMINU\xC9E (C D-demi-b\xE9mol Eb Fb) : 12/11, 6/5, 13/10 (~454c) ; la quarte diminu\xE9e est la signature du Saba." }, "cins_rast": { "system": "pythagorean", "ratios": [1, "9/8", "8192/6561", "4/3", "3/2"], "description": "Cins turc (cins_rast) \u2014 segment pythagoricien exact" }, "cins_rast4": { "system": "pythagorean", "ratios": [1, "9/8", "8192/6561", "4/3"], "description": "Cins turc (cins_rast4) \u2014 segment pythagoricien exact" }, "cins_ussak": { "system": "pythagorean", "ratios": [1, "65536/59049", "32/27", "4/3", "3/2"], "description": "Cins turc (cins_ussak) \u2014 segment pythagoricien exact" }, "cins_ussak4": { "system": "pythagorean", "ratios": [1, "65536/59049", "32/27", "4/3"], "description": "Cins turc (cins_ussak4) \u2014 segment pythagoricien exact" }, "cins_buselik4": { "system": "pythagorean", "ratios": [1, "9/8", "32/27", "4/3"], "description": "Cins turc (cins_buselik4) \u2014 segment pythagoricien exact" }, "cins_hicaz": { "system": "pythagorean", "ratios": [1, "2187/2048", "8192/6561", "4/3", "3/2"], "description": "Cins turc (cins_hicaz) \u2014 segment pythagoricien exact" }, "cins_buselik": { "system": "pythagorean", "ratios": [1, "9/8", "32/27", "4/3", "3/2"], "description": "Cins turc (cins_buselik) \u2014 segment pythagoricien exact" }, "cins_kurdi4": { "system": "pythagorean", "ratios": [1, "256/243", "32/27", "4/3"], "description": "Cins turc (cins_kurdi4) \u2014 segment pythagoricien exact" }, "cins_kurdi": { "system": "pythagorean", "ratios": [1, "256/243", "32/27", "4/3", "3/2"], "description": "Cins turc (cins_kurdi) \u2014 segment pythagoricien exact" }, "cins_segah": { "system": "pythagorean", "ratios": [1, "256/243", "9/8", "4/3", "3/2"], "description": "Cins turc (cins_segah) \u2014 segment pythagoricien exact" }, "cins_cargah4": { "system": "pythagorean", "ratios": [1, "256/243", "9/8", "4/3"], "description": "Cins turc (cins_cargah4) \u2014 segment pythagoricien exact" }, "cins_saba": { "system": "pythagorean", "ratios": [1, "65536/59049", "32/27", "81/64", "3/2"], "description": "Cins turc (cins_saba) \u2014 segment pythagoricien exact" }, "cins_huseyni4": { "system": "pythagorean", "ratios": [1, "65536/59049", "8192/6561", "4/3"], "description": "Cins turc (cins_huseyni4) \u2014 segment pythagoricien exact" }, "cins_segah4": { "system": "pythagorean", "ratios": [1, "256/243", "8192/6561", "4/3"], "description": "Cins turc (cins_segah4) \u2014 segment pythagoricien exact" }, "cins_huzzam": { "system": "pythagorean", "ratios": [1, "2187/2048", "32/27", "4/3", "3/2"], "description": "Cins turc (cins_huzzam) \u2014 segment pythagoricien exact" }, "bilaval": { "description": "Bilaval thaat \u2014 equivalent to Western major scale", "culture": "hindustani", "temperament": "22shruti", "degrees": [0, 4, 7, 9, 13, 17, 20], "notes_count": 7 }, "khamaj": { "description": "Khamaj thaat \u2014 komal Ni", "culture": "hindustani", "temperament": "22shruti", "degrees": [0, 4, 7, 9, 13, 17, 18], "notes_count": 7 }, "kafi": { "description": "Kafi thaat \u2014 komal Ga, komal Ni", "culture": "hindustani", "temperament": "22shruti", "degrees": [0, 4, 5, 9, 13, 17, 18], "notes_count": 7 }, "asavari": { "description": "Asavari thaat \u2014 komal Ga, Dha, Ni", "culture": "hindustani", "temperament": "22shruti", "degrees": [0, 4, 5, 9, 13, 15, 18], "notes_count": 7 }, "bhairavi": { "description": "Bhairavi thaat \u2014 all komal (Re, Ga, Dha, Ni)", "culture": "hindustani", "temperament": "22shruti", "degrees": [0, 2, 5, 9, 13, 15, 18], "notes_count": 7 }, "kalyan": { "description": "Kalyan thaat \u2014 tivra Ma", "culture": "hindustani", "temperament": "22shruti", "degrees": [0, 4, 7, 11, 13, 17, 20], "notes_count": 7 }, "marva": { "description": "Marva thaat \u2014 komal Re, tivra Ma", "culture": "hindustani", "temperament": "22shruti", "degrees": [0, 2, 7, 11, 13, 17, 20], "notes_count": 7 }, "purvi": { "description": "Purvi thaat \u2014 komal Re, tivra Ma, komal Dha", "culture": "hindustani", "temperament": "22shruti", "degrees": [0, 2, 7, 11, 13, 15, 20], "notes_count": 7 }, "todi": { "description": "Todi thaat \u2014 komal Re, Ga, tivra Ma, komal Dha", "culture": "hindustani", "temperament": "22shruti", "degrees": [0, 2, 5, 11, 13, 15, 20], "notes_count": 7 }, "shankarabharanam": { "description": "Shankarabharanam melakarta (72 #29) \u2014 equivalent to Bilaval/major", "culture": "carnatic", "temperament": "22shruti", "degrees": [0, 4, 7, 9, 13, 17, 20], "notes_count": 7 }, "kalyani": { "description": "Kalyani melakarta (72 #65) \u2014 equivalent to Kalyan/Lydian", "culture": "carnatic", "temperament": "22shruti", "degrees": [0, 4, 7, 11, 13, 17, 20], "notes_count": 7 }, "kharaharapriya": { "description": "Kharaharapriya melakarta (72 #22) \u2014 equivalent to Kafi/Dorian", "culture": "carnatic", "temperament": "22shruti", "degrees": [0, 4, 5, 9, 13, 17, 18], "notes_count": 7 }, "todi_carnatic": { "description": "Shubhapantuvarali melakarta (72 #45) \u2014 equivalent to Todi thaat", "culture": "carnatic", "temperament": "22shruti", "degrees": [0, 2, 5, 11, 13, 15, 20], "notes_count": 7 }, "harikambhoji": { "description": "Harikambhoji melakarta (72 #28) \u2014 equivalent to Khamaj/Mixolydian", "culture": "carnatic", "temperament": "22shruti", "degrees": [0, 4, 7, 9, 13, 17, 18], "notes_count": 7 }, "malkauns": { "description": "Raga Malkauns \u2014 audava (pentatonic), deep night raga", "culture": "hindustani", "temperament": "22shruti", "degrees": [0, 5, 9, 15, 18], "notes_count": 5 }, "thaat_bhairav": { "description": "Thaat Bhairav \u2014 komal re, shuddh ga, komal dha, shuddh ni. Double Harmonic Major. Morning raga.", "culture": "hindustani", "temperament": "22shruti", "degrees": [0, 2, 7, 9, 13, 15, 20], "notes_count": 7 }, "quarter_tone_chromatic": { "description": "Quarter-tone chromatic \u2014 24 equal divisions. Haba, Wyschnegradsky, Boulez (Marteau sans ma\xEEtre).", "culture": "contemporary", "temperament": "24TET", "degrees": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], "notes_count": 24 }, "bageshri": { "description": "Raga Bageshri \u2014 different notes in ascent and descent", "culture": "hindustani", "temperament": "22shruti", "ascending": [0, 5, 9, 13, 15, 18], "descending": [0, 18, 17, 15, 13, 9, 5, 4], "notes_count": 7 }, "raga_bhairav": { "description": "Raga Bhairav \u2014 aroha et avaroha diff\xE9rents. komal re et dha \xE0 la mont\xE9e, shuddh \xE0 la descente. Aroha = thaat Bhairav ; avaroha variante. L'aspect GAMME d'une raga vit ici ; l'intonation se dit par le temp\xE9rament r\xE9f\xE9renc\xE9.", "culture": "hindustani", "temperament": "22shruti", "ascending": [0, 2, 7, 9, 13, 15, 20], "descending": [0, 4, 7, 9, 13, 17, 20], "notes_count": 7 }, "raga_yaman": { "description": "Raga Yaman (Kalyan) \u2014 ma tivra \xE0 la mont\xE9e, shuddh \xE0 la descente dans certaines interpr\xE9tations. Aroha = thaat Kalyan.", "culture": "hindustani", "temperament": "22shruti", "ascending": [0, 4, 7, 11, 13, 17, 20], "descending": [0, 4, 7, 9, 13, 17, 20], "notes_count": 7 }, "darbari_kanada": { "description": "Raga Darbari Kanada \u2014 andolit komal Ga, majestic night raga", "culture": "hindustani", "temperament": "22shruti", "ascending": [0, 4, 5, 9, 13, 15, 18], "descending": [0, 18, 15, 13, 9, 7, 5, 4], "notes_count": 7 }, "desh": { "description": "Raga Desh \u2014 komal Ni in descent, romantic evening raga", "culture": "hindustani", "temperament": "22shruti", "ascending": [0, 4, 7, 9, 13, 17, 20], "descending": [0, 20, 18, 17, 13, 9, 7, 4], "notes_count": 7 }, "bihag": { "description": "Raga Bihag \u2014 both Ma used, late night raga", "culture": "hindustani", "temperament": "22shruti", "ascending": [0, 4, 7, 11, 13, 17, 20], "descending": [0, 20, 17, 13, 11, 9, 7, 4], "notes_count": 7 }, "melodic_minor": { "description": "Melodic minor \u2014 different ascending and descending forms", "culture": "western", "ascending": [1, "9/8", "6/5", "4/3", "3/2", "5/3", "15/8"], "descending": [1, "9/8", "6/5", "4/3", "3/2", "8/5", "9/5"], "notes_count": 7 }, "maqam_ajam": { "description": "Maqam Ajam \u2014 equivalent to Western major \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source ontologique ; le moteur calcule les ratios depuis les jins].", "culture": "arabic", "notes_count": 7, "system": "zalzal-ji", "compose": ["jins_ajam", "jins_ajam"], "junction": "3/2" }, "maqam_kurd": { "description": "Maqam Kurd \u2014 starts with jins Kurd \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source ontologique ; le moteur calcule les ratios depuis les jins].", "culture": "arabic", "notes_count": 7, "system": "zalzal-ji", "compose": ["jins_kurd", "jins_kurd"], "junction": "3/2" }, "maqam_suznak": { "description": "Maqam Suznak \u2014 Rast lower + Hijaz upper \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source ontologique ; le moteur calcule les ratios depuis les jins].", "culture": "arabic", "compose": ["jins_rast", "jins_hijaz"], "junction": "3/2", "notes_count": 7, "system": "zalzal-ji" }, "maqam_nawa_athar": { "description": "Maqam Nawa Athar \u2014 double augmented second \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source].", "culture": "arabic", "notes_count": 7, "system": "zalzal-ji", "compose": ["jins_nikriz", "jins_hijaz"], "junction": "3/2" }, "maqam_athar_kurd": { "description": "Maqam Athar Kurd \u2014 Kurd with augmented second \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source].", "culture": "arabic", "notes_count": 7, "system": "zalzal-ji", "compose": ["jins_athar_kurd", "jins_hijaz"], "junction": "3/2" }, "maqam_hijaz_kar": { "description": "Maqam Hijaz Kar \u2014 double harmonic major \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source ontologique ; le moteur calcule les ratios depuis les jins].", "culture": "arabic", "notes_count": 7, "system": "zalzal-ji", "compose": ["jins_hijaz", "jins_hijaz"], "junction": "3/2" }, "maqam_nikriz": { "description": "Maqam Nikriz \u2014 Nikriz tetrachord + Rast upper \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source ontologique ; le moteur calcule les ratios depuis les jins].", "culture": "arabic", "compose": ["jins_nikriz", "jins_rast"], "junction": "3/2", "notes_count": 7, "system": "zalzal-ji" }, "maqam_husayni": { "description": "Maqam Husayni \u2014 Bayati variant with Husayni emphasis \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source ontologique ; le moteur calcule les ratios depuis les jins].", "culture": "arabic", "compose": ["jins_bayati", "jins_bayati"], "junction": "3/2", "notes_count": 7, "system": "zalzal-ji" }, "maqam_farahfaza": { "description": "Maqam Farahfaza \u2014 Nahawand with Sikah flavor \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source ontologique ; le moteur calcule les ratios depuis les jins].", "culture": "arabic", "compose": ["jins_nahawand", "jins_bayati"], "junction": "3/2", "notes_count": 7, "system": "zalzal-ji" }, "makam_rast": { "description": "Makam Rast \u2014 fundamental Turkish makam \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].", "culture": "turkish", "notes_count": 7, "system": "pythagorean", "compose": ["cins_rast", "cins_rast4"], "junction": "3/2" }, "makam_ussak": { "description": "Makam Ussak \u2014 one of the most common Turkish makams \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].", "culture": "turkish", "notes_count": 7, "system": "pythagorean", "compose": ["cins_ussak", "cins_ussak4"], "junction": "3/2" }, "makam_huseyni": { "description": "Makam Huseyni \u2014 similar to Ussak with different upper tetrachord \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].", "culture": "turkish", "notes_count": 7, "system": "pythagorean", "compose": ["cins_ussak", "cins_buselik4"], "junction": "3/2" }, "makam_hicaz": { "description": "Makam Hicaz \u2014 augmented second in lower tetrachord \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].", "culture": "turkish", "notes_count": 7, "system": "pythagorean", "compose": ["cins_hicaz", "cins_ussak4"], "junction": "3/2" }, "makam_nihavend": { "description": "Makam Nihavend \u2014 Turkish minor, similar to harmonic minor \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].", "culture": "turkish", "notes_count": 7, "system": "pythagorean", "compose": ["cins_buselik", "cins_kurdi4"], "junction": "3/2" }, "makam_kurdi": { "description": "Makam Kurdi \u2014 starts with minor second \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].", "culture": "turkish", "notes_count": 7, "system": "pythagorean", "compose": ["cins_kurdi", "cins_kurdi4"], "junction": "3/2" }, "makam_segah": { "description": "Makam Segah \u2014 starts on segah pitch, meditative character \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].", "culture": "turkish", "notes_count": 7, "system": "pythagorean", "compose": ["cins_segah", "cins_cargah4"], "junction": "3/2" }, "makam_huzzam": { "description": "Makam Huzzam \u2014 Segah variant with diminished fifth \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].", "culture": "turkish", "notes_count": 7, "system": "pythagorean", "compose": ["cins_cargah4", "cins_huzzam"], "junction": "4/3" }, "makam_saba": { "description": "Makam Saba \u2014 distinctive Turkish makam with narrow intervals \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].", "culture": "turkish", "notes_count": 7, "system": "pythagorean", "compose": ["cins_saba", "cins_kurdi4"], "junction": "3/2" }, "makam_buselik": { "description": "Makam Buselik \u2014 Turkish natural minor equivalent \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].", "culture": "turkish", "notes_count": 7, "system": "pythagorean", "compose": ["cins_buselik", "cins_ussak4"], "junction": "3/2" }, "makam_sultaniyegah": { "description": "Makam Sultaniyegah \u2014 Rast transposed, majestic character \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].", "culture": "turkish", "notes_count": 7, "system": "pythagorean", "compose": ["cins_rast", "cins_huseyni4"], "junction": "3/2" }, "makam_karcigar": { "description": "Makam Karcigar \u2014 mixed Turkish-Arabic makam \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].", "culture": "turkish", "notes_count": 7, "system": "pythagorean", "compose": ["cins_ussak", "cins_segah4"], "junction": "3/2" }, "maqam_rast": { "description": "Maqam Rast \u2014 Rast + Rast sur la quinte [compose(jins)+junction = source ; le moteur calcule les ratios depuis les jins].", "culture": "arabic", "system": "zalzal-ji", "compose": ["jins_rast", "jins_rast"], "junction": "3/2" }, "maqam_nahawand": { "description": "Maqam Nahawand \u2014 Nahawand (bas) + Kurd (haut) [compose(jins)+junction = source ; le moteur calcule les ratios depuis les jins].", "culture": "arabic", "system": "zalzal-ji", "compose": ["jins_nahawand", "jins_kurd"], "junction": "3/2" }, "maqam_hijaz": { "description": "Maqam Hijaz \u2014 Hijaz (bas) + Rast (haut) [compose(jins)+junction = source ; le moteur calcule les ratios depuis les jins].", "culture": "arabic", "system": "zalzal-ji", "compose": ["jins_hijaz", "jins_rast"], "junction": "3/2" }, "maqam_bayati": { "description": "Maqam Bayati \u2014 Bayati (bas) + Nahawand (haut) [compose(jins)+junction = source ; le moteur calcule les ratios depuis les jins].", "culture": "arabic", "system": "zalzal-ji", "compose": ["jins_bayati", "jins_nahawand"], "junction": "3/2" }, "maqam_saba": { "description": "Maqam Saba \u2014 Saba (bas) + Hijaz (haut) + Rast (tr\xE8s haut, 3 jins) [compose(jins)+junction = source ; le moteur calcule les ratios depuis les jins].", "culture": "arabic", "system": "zalzal-ji", "compose": ["jins_saba", "jins_hijaz", "jins_rast"], "junction": ["13/10", "26/15"] } };
LIBS["settings"] = { "documented": true, "resolvedBy": "BPx", "resolves": "settings", "name": "settings", "description": "Default BP3 engine settings. Overridden by @ directives. Used to generate the settings string for bp3_load_settings().", "version": "0.2.0", "bp3_defaults": { "Quantization": { "name": "Quantization", "value": "10", "unit": "ms", "boolean": "0" }, "Quantize": { "name": "Quantize", "value": "1", "boolean": "1" }, "Time_res": { "name": "Time resolution", "value": "10", "unit": "ms", "boolean": "0" }, "MIDIsyncDelay": { "name": "MIDI sync delay", "value": "100", "unit": "ms", "boolean": "0" }, "Nature_of_time": { "name": "Nature of time", "value": "1", "boolean": "0" }, "NoteConvention": { "name": "Note convention", "value": "0", "boolean": "0" }, "Pclock": { "name": "P clock", "value": "1", "boolean": "0" }, "Qclock": { "name": "Q clock", "value": "1", "boolean": "0" }, "ShowGraphic": { "name": "Show graphic", "value": "0", "boolean": "1" }, "ShowObjectGraph": { "name": "Show object graphic", "value": "0", "boolean": "1" }, "ShowPianoRoll": { "name": "Show piano roll", "value": "0", "boolean": "1" }, "GraphicScaleP": { "name": "Graphic scale P", "value": "0", "boolean": "0" }, "GraphicScaleQ": { "name": "Graphic scale Q", "value": "0", "boolean": "0" }, "DisplayItems": { "name": "Display items", "value": "1", "boolean": "1" }, "DisplayProduce": { "name": "Display produce", "value": "0", "boolean": "1" }, "SplitTimeObjects": { "name": "Split time objects", "value": "1", "boolean": "1" }, "SplitVariables": { "name": "Split variables", "value": "0", "boolean": "1" }, "CsoundTrace": { "name": "Csound trace", "value": "0", "boolean": "1" }, "Improvize": { "name": "Improvize", "value": "0", "boolean": "1" }, "DeftBufferSize": { "name": "Default buffer size", "value": "1000", "boolean": "0" }, "ComputeWhilePlay": { "name": "Compute while playing", "value": "1", "boolean": "1" }, "MaxConsoleTime": { "name": "Max console time", "value": "60", "boolean": "0" }, "ResetNotes": { "name": "Reset notes between items", "value": "1", "boolean": "1" }, "ResetWeights": { "name": "Reset rule weights", "value": "1", "boolean": "1" }, "ResetFlags": { "name": "Reset flags", "value": "1", "boolean": "1" }, "ResetControllers": { "name": "Reset controllers", "value": "0", "boolean": "1" }, "EndFadeOut": { "name": "End fade out", "value": "2.00", "boolean": "0" }, "C4key": { "name": "C4 key number", "value": "60", "boolean": "0" }, "A4freq": { "name": "A4 frequency", "value": "440.0000", "boolean": "0" }, "StrikeAgainDefault": { "name": "Strike again default", "value": "1", "boolean": "0" }, "DeftVolume": { "name": "Default volume", "value": "90", "boolean": "0" }, "VolumeController": { "name": "Volume controller", "value": "7", "boolean": "0" }, "DeftVelocity": { "name": "Default velocity", "value": "64", "boolean": "0" }, "DeftPanoramic": { "name": "Default panoramic", "value": "64", "boolean": "0" }, "PanoramicController": { "name": "Panoramic controller", "value": "10", "boolean": "0" }, "SamplingRate": { "name": "Sampling rate", "value": "50", "boolean": "0" }, "TraceMicrotonality": { "name": "Trace microtonality", "value": "0", "boolean": "1" }, "DisplayTimeSet": { "name": "Display time set", "value": "0", "boolean": "1" }, "AllItems": { "name": "Produce all items", "value": "0", "boolean": "1" }, "MaxItemsProduce": { "name": "Max items to produce", "value": "20", "boolean": "0" }, "Seed": { "name": "Random seed", "value": "0", "boolean": "0" } }, "directive_map": { "improvize": { "Improvize": "1" }, "allitems": { "AllItems": "1", "Improvize": "0" }, "all_items": { "AllItems": "1", "Improvize": "0" }, "maxitems": { "MaxItemsProduce": "@value" }, "items": { "MaxItemsProduce": "@value" }, "quantize": { "Quantization": "@value" }, "quantization": { "Quantization": "@value" }, "qclock": { "Qclock": "@value" }, "seed": { "Seed": "@value" }, "vel": { "DeftVelocity": "@value" }, "pan": { "DeftPanoramic": "@value" }, "volume": { "DeftVolume": "@value" }, "a4": { "A4freq": "@value" }, "timeres": { "Time_res": "@value" } }, "note_conventions": { "western": 1, "raga": 2, "keys": 3 } };
LIBS["settings/notreich"] = { "documented": false, "Quantization": { "name": "Quantization", "value": "50", "unit": "ms (deft 10)", "boolean": "0" }, "Quantize": { "name": "Quantize", "value": "1", "unit": "", "boolean": "1" }, "Time_res": { "name": "Time resolution", "value": "10", "unit": "ms (deft 10)", "boolean": "0" }, "MIDIsyncDelay": { "name": "Sync delay", "value": "100", "unit": "ms after wait (deft 380)", "boolean": "0" }, "Nature_of_time": { "name": "Striated time", "value": "1", "unit": "", "boolean": "1" }, "Pclock": { "name": "Pclock", "value": "1", "unit": "Pclock/Qclock is the period of metronome (seconds)", "boolean": "0" }, "Qclock": { "name": "Qclock", "value": "1", "unit": "", "boolean": "0" }, "NoteConvention": { "name": "Note convention", "value": "0", "unit": "0 = English: C, D, E...<br />1 = Italian/Spanish/French: do, re, mi...<br />2 = Indian: sa, re, ga...<br />3 = Keys<br />4 = Only from tonal scales(s)", "boolean": "0" }, "B#_instead_of_C": { "name": "B# instead of C", "value": "0", "unit": "", "boolean": "1" }, "Db_instead_of_C#": { "name": "Db instead of C#", "value": "0", "unit": "", "boolean": "1" }, "Eb_instead_of_D#": { "name": "Eb instead of D#", "value": "0", "unit": "", "boolean": "1" }, "Fb_instead_of_E": { "name": "Fb instead of E", "value": "0", "unit": "", "boolean": "1" }, "E#_instead_of_F": { "name": "E# instead of F", "value": "0", "unit": "", "boolean": "1" }, "Gb_instead_of_F#": { "name": "Gb instead of F#", "value": "0", "unit": "", "boolean": "1" }, "Ab_instead_of_G#": { "name": "Ab instead of G#", "value": "0", "unit": "", "boolean": "1" }, "Bb_instead_of_A#": { "name": "Bb instead of A#", "value": "0", "unit": "", "boolean": "1" }, "Cb_instead_of_B": { "name": "Cb instead of B", "value": "0", "unit": "", "boolean": "1" }, "TraceMicrotonality": { "name": "Trace microtonality", "value": "0", "unit": "", "boolean": "1" }, "DisplayItems": { "name": "Display final score", "value": "0", "unit": "Bol Processor score", "boolean": "1" }, "ShowGraphic": { "name": "Show graphics", "value": "1", "unit": "Object graph or Pianoroll, see below", "boolean": "1" }, "ShowObjectGraph": { "name": "Show object graph", "value": "0", "unit": "", "boolean": "1" }, "ShowAllObjects": { "name": "Show all objects", "value": "0", "unit": "including inaudible ones (for geeks)", "boolean": "1" }, "ShowPianoRoll": { "name": "Show pianoroll", "value": "1", "unit": "", "boolean": "1" }, "GraphicScaleP": { "name": "Graphic scale P", "value": "1", "unit": "", "boolean": "0" }, "GraphicScaleQ": { "name": "Graphic scale Q", "value": "2", "unit": "", "boolean": "0" }, "DisplayProduce": { "name": "Display production", "value": "0", "unit": "", "boolean": "1" }, "SplitTimeObjects": { "name": "Split terminal symbols", "value": "1", "unit": "", "boolean": "1" }, "SplitVariables": { "name": "Split |variables|", "value": "0", "unit": "", "boolean": "1" }, "CsoundTrace": { "name": "Trace Csound", "value": "0", "unit": "", "boolean": "1" }, "Improvize": { "name": "Non-stop improvize", "value": "0", "unit": "", "boolean": "1" }, "MaxItemsProduce": { "name": "Max items produced", "value": "20", "unit": "Except in real-time MIDI (deft 20)", "boolean": "0" }, "AllItems": { "name": "Produce all items", "value": "0", "unit": "", "boolean": "1" }, "UseEachSub": { "name": "Play each substitution", "value": "0", "unit": "", "boolean": "1" }, "StepProduce": { "name": "Step-by-step produce", "value": "0", "unit": "(not implemented)", "boolean": "1" }, "TraceProduce": { "name": "Trace production", "value": "0", "unit": "", "boolean": "1" }, "PlanProduce": { "name": "Choose candidate rule", "value": "0", "unit": "(not implemented)", "boolean": "1" }, "DeftBufferSize": { "name": "Default buffer size", "value": "1002", "unit": "symbols", "boolean": "0" }, "MaxConsoleTime": { "name": "Max computation time", "value": "3600", "unit": "seconds. Time for console's work (0 = no limit) Except in Improvize mode", "boolean": "0" }, "ComputeWhilePlay": { "name": "Compute while playing", "value": "1", "unit": "true by default", "boolean": "1" }, "AdvanceTime": { "name": "Max advance time", "value": "10.5", "unit": "seconds (if not compute while playing)", "boolean": "0" }, "AllowRandomize": { "name": "Allow randomize", "value": "0", "unit": "", "boolean": "1" }, "Seed": { "name": "Seed for randomization", "value": "15524", "unit": "Positive integer, or 0 if cards need to be shuffled", "boolean": "0" }, "ResetNotes": { "name": "Reset Notes", "value": "1", "unit": "Send AllNotesOff, pedals off and reset pitchbend at the end of item", "boolean": "1" }, "ResetWeights": { "name": "Reset rule weights", "value": "1", "unit": "", "boolean": "1" }, "ResetFlags": { "name": "Reset rule flags", "value": "1", "unit": "/this is a flag/", "boolean": "1" }, "ResetControllers": { "name": "Reset controllers", "value": "1", "unit": "volume, panoramic, pressure, pitchbend, modulation", "boolean": "1" }, "EndFadeOut": { "name": "Fade-out time", "value": "2", "unit": "seconds (end of MIDI files and Csound scores)", "boolean": "0" }, "NoConstraint": { "name": "Ignore constraints in time setting", "value": "0", "unit": "", "boolean": "1" }, "DisplayTimeSet": { "name": "Time setting display", "value": "0", "unit": "", "boolean": "1" }, "TraceTimeSet": { "name": "Time setting trace", "value": "0", "unit": "", "boolean": "1" }, "StepTimeSet": { "name": "Time setting step", "value": "0", "unit": "(not implemented)", "boolean": "1" }, "TraceMIDIinteraction": { "name": "Trace MIDI interactions", "value": "0", "unit": "", "boolean": "1" }, "TraceNoteOn": { "name": "Trace NoteOn/NoteOff", "value": "0", "unit": "(only for short items)", "boolean": "1" }, "SamplingRate": { "name": "Sampling rate", "value": "50", "unit": "samples per second, usually 50", "boolean": "0" }, "C4key": { "name": "C4 (middle C) key number", "value": "60", "unit": "(0..127) usually 60", "boolean": "0" }, "A4freq": { "name": "A4 frequency (diapason)", "value": "440.0000", "unit": "Hz (usually 440)", "boolean": "0" }, "StrikeAgainDefault": { "name": "Strike again NoteOn's", "value": "1", "unit": "Keep checked unless you know why!<br>(Read https://bolprocessor.org/control-noteon-noteoff/)", "boolean": "1" }, "DeftVelocity": { "name": "Default velocity", "value": "64", "unit": "(1..127)", "boolean": "0" }, "DeftVolume": { "name": "Default volume", "value": "90", "unit": "(1..127)", "boolean": "0" }, "VolumeController": { "name": "Volume controller", "value": "7", "unit": "(0..127) usually 7", "boolean": "0" }, "DeftPanoramic": { "name": "Default panoramic", "value": "64", "unit": "(0..127)", "boolean": "0" }, "PanoramicController": { "name": "Panoramic controller", "value": "10", "unit": "(0..127) usually 10", "boolean": "0" }, "StopPauseContinue": { "name": "Respond to  Stop/Continue", "value": "1", "unit": "(if a MIDI input is active)", "boolean": "1" }, "DefaultBlockKey": { "name": "Default block key", "value": "60", "unit": "(0..127) e.g. 60 for 'C4' or 69 for 'A4'", "boolean": "0" }, "MinPeriod": { "name": "Minimum period", "value": "200", "unit": "ms (deft 200, at least 2 times the Quantization)<br>This is used for positioning sound-objects<br>(Read https://bolprocessor.org/control-noteon-noteoff/)", "boolean": "0" }, "TraceCaptureAnalysis": { "name": "Trace this analysis", "value": "1", "unit": "", "boolean": "1" }, "LiveGrammar": { "name": "Follow grammar(s)", "value": "0", "unit": "(Read https://bolprocessor.org/live-coding/)", "boolean": "1" }, "LiveSettings": { "name": "Follow settings", "value": "0", "unit": "", "boolean": "1" }, "TraceLive": { "name": "Trace changes", "value": "0", "unit": "", "boolean": "1" } };
LIBS["settings/pattern_grammar"] = { "documented": false, "AllItems": { "name": "Produce all items", "value": "1", "boolean": "1" }, "MaxItemsProduce": { "name": "Max items to produce", "value": "20", "boolean": "0" }, "AllowRandomize": { "name": "Allow randomize", "value": "1", "boolean": "1" } };
LIBS["settings/test1"] = { "documented": false, "AllItems": { "name": "Produce all items", "value": "1", "boolean": "1" }, "MaxItemsProduce": { "name": "Max items to produce", "value": "50", "boolean": "0" }, "Quantization": { "name": "Quantization", "value": "5", "unit": "ms", "boolean": "0" } };
LIBS["sounds"] = { "documented": true, "resolvedBy": "BPx", "resolves": "sound", "name": "sounds", "tabla_perc": { "description": "Percussions de tabla \u2014 bols de bayan (grave) et de dayan (aigu). Prototype AUX D\xC9FAUTS MOTEUR : il ne surcharge aucune propri\xE9t\xE9 m\xE9trique. Invoqu\xE9 par dhati, dhin et leurs jumelles (6 sc\xE8nes du corpus). Le nom vient du corpus, pas d'un catalogue externe." } };
LIBS["temperaments"] = { "documented": true, "resolvedBy": "Kairos", "resolves": "temperament", "12TET": { "description": "Equal temperament, 12 divisions of the octave", "period_ratio": 2, "divisions": 12, "ratios": [1, "100c", "200c", "300c", "400c", "500c", "600c", "700c", "800c", "900c", "1000c", "1100c"] }, "24TET": { "description": "Quarter-tone equal temperament, 24 divisions of the octave", "period_ratio": 2, "divisions": 24, "ratios": [1, "50c", "100c", "150c", "200c", "250c", "300c", "350c", "400c", "450c", "500c", "550c", "600c", "650c", "700c", "750c", "800c", "850c", "900c", "950c", "1000c", "1050c", "1100c", "1150c"] }, "53TET": { "description": "Holdrian comma system, 53 divisions of the octave. Used in Turkish makam theory. 1 step \u2248 22.64 cents.", "period_ratio": 2, "divisions": 53, "ratios": [1, "22.642c", "45.283c", "67.925c", "90.566c", "113.208c", "135.849c", "158.491c", "181.132c", "203.774c", "226.415c", "249.057c", "271.698c", "294.340c", "316.981c", "339.623c", "362.264c", "384.906c", "407.547c", "430.189c", "452.830c", "475.472c", "498.113c", "520.755c", "543.396c", "566.038c", "588.679c", "611.321c", "633.962c", "656.604c", "679.245c", "701.887c", "724.528c", "747.170c", "769.811c", "792.453c", "815.094c", "837.736c", "860.377c", "883.019c", "905.660c", "928.302c", "950.943c", "973.585c", "996.226c", "1018.868c", "1041.509c", "1064.151c", "1086.792c", "1109.434c", "1132.075c", "1154.717c", "1177.358c"] }, "pythagorean": { "description": "Pythagorean tuning \u2014 pure fifths (3/2). Comma: 531441/524288 \u2248 23.46 cents.", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "81/64", "4/3", "729/512", "3/2", "128/81", "27/16", "16/9", "243/128"] }, "just_5limit": { "description": "5-limit just intonation \u2014 pure thirds and fifths.", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "6/5", "5/4", "4/3", "45/32", "3/2", "8/5", "5/3", "9/5", "15/8"] }, "meantone_quarter": { "description": "1/4-comma meantone \u2014 major thirds exactly 5/4. Fifths narrowed by 1/4 syntonic comma.", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.044907, 1.118034, 1.196279, 1.25, 1.337481, 1.397542, 1.495349, 1.5625, 1.671851, 1.788854, 1.869186] }, "22shruti": { "description": "22 shruti \u2014 Indian tradition, 5-limit just intonation. Unequal steps (pramana ~22c, nyuna ~70c, purna ~90c).", "period_ratio": 2, "divisions": 22, "ratios": [1, "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "4/3", "27/20", "45/32", "729/512", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128"] }, "bohlen_pierce_just": { "description": "Bohlen-Pierce just \u2014 7-limit, tritave (3:1). 13 steps.", "period_ratio": 3, "divisions": 13, "ratios": [1, "27/25", "25/21", "9/7", "7/5", "75/49", "5/3", "9/5", "49/25", "15/7", "7/3", "63/25", "25/9"] }, "bohlen_pierce_equal": { "description": "Bohlen-Pierce equal \u2014 13 equal divisions of the tritave (3:1).", "period_ratio": 3, "divisions": 13, "ratios": [1, "146.3c", "292.6c", "438.9c", "585.2c", "731.5c", "877.8c", "1024.1c", "1170.4c", "1316.7c", "1463.0c", "1609.3c", "1755.6c"] }, "gamelan_pelog": { "description": "Gamelan pelog \u2014 7-tone, Central Javanese approximation. Stretched octave. Varies by ensemble.", "period_ratio": 2.02, "divisions": 7, "ratios": [1, 1.126, 1.244, 1.351, 1.496, 1.683, 1.894] }, "gamelan_slendro": { "description": "Gamelan slendro \u2014 near-equal pentatonic, Central Javanese approximation. Stretched octave.", "period_ratio": 2.01, "divisions": 5, "ratios": [1, 1.143, 1.317, 1.516, 1.741] }, "bp3_Abmaj": { "description": `This is a reduction to 12 grades of scale "Ma05" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'Bb' Created on 2021-01-05 18:34:29 Scale aligned ratio 1.0125 (2022-03-11 07:57:41)`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "6/5", "81/64", "4/3", "64/45", "3/2", "8/5", "27/16", "9/5", "243/128"], "comma": "81/80" }, "bp3_Abmin": { "description": 'This is a reduction to 12 grades of scale "Ma08" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:09:51 Scale aligned ratio 1.0125 (2022-03-11 07:56:59)', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "81/64", "4/3", "64/45", "3/2", "405/256", "27/16", "3645/2048", "243/128"], "comma": "81/80" }, "bp3_Amaj": { "description": `This is a reduction to 12 grades of scale "Ma10" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'B' Created 2021-01-05 18:56:02`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "81/64", "4/3", "45/32", "3/2", "128/81", "27/16", "16/9", "243/128"], "comma": "81/80" }, "bp3_Amin": { "description": 'This is a reduction to 12 grades of scale "Ma01" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:00:08', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "10/9", "32/27", "5/4", "4/3", "45/32", "3/2", "128/81", "5/3", "16/9", "15/8"], "comma": "81/80" }, "bp3_Bbmaj": { "description": `This is a reduction to 12 grades of scale "Ma03" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'C' Created 2021-01-05 18:31:20`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "10/9", "32/27", "5/4", "4/3", "45/32", "40/27", "128/81", "5/3", "16/9", "15/8"], "comma": "81/80" }, "bp3_Bbmin": { "description": 'This is a reduction to 12 grades of scale "Ma06" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:08:40', "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 12, "ratios": ["80/81", "256/243", "10/9", "75/64", "5/4", "320/243", "45/32", "40/27", "128/81", "5/3", "225/128", "15/8"], "comma": "81/80" }, "bp3_Bmaj": { "description": `This is a reduction to 12 grades of scale "Ma08" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'Db' Created 2021-01-05 19:37:40`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "32/27", "81/64", "4/3", "729/512", "3/2", "128/81", "27/16", "16/9", "243/128"], "comma": "81/80" }, "bp3_Bmin": { "description": 'This is a reduction to 12 grades of scale "Ma11" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:12:50', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "5/4", "4/3", "45/32", "3/2", "128/81", "27/16", "16/9", "15/8"], "comma": "81/80" }, "bp3_Cmaj": { "description": `This is a reduction to 12 grades of scale "Ma01" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'D' Created 2021-01-05 18:29:30`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "5/4", "4/3", "45/32", "3/2", "128/81", "5/3", "16/9", "15/8"], "comma": "81/80" }, "bp3_Cmin": { "description": 'This is a reduction to 12 grades of scale "Ma04" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 17:49:25', "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 12, "ratios": ["80/81", "256/243", "10/9", "32/27", "5/4", "320/243", "45/32", "40/27", "128/81", "5/3", "16/9", "15/8"], "comma": "81/80" }, "bp3_Dbmaj": { "description": `This is a reduction to 12 grades of scale "Ma06" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'Eb' Created 2021-01-05 18:35:44Scale aligned ratio 1.0125 (2022-03-11 07:59:19)`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "6/5", "81/64", "4/3", "64/45", "3/2", "8/5", "27/16", "3645/2048", "243/128"], "comma": "81/80" }, "bp3_Dbmin": { "description": 'This is a reduction to 12 grades of scale "Ma09" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:10:26 Scale aligned ratio 1.0125 (2022-03-11 07:59:30)', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "81/64", "4/3", "45/32", "3/2", "405/256", "27/16", "3645/2048", "243/128"], "comma": "81/80" }, "bp3_Dmaj": { "description": `This is a reduction to 12 grades of scale "Ma11" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'E' Created 2021-01-05 18:48:23`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "81/64", "4/3", "45/32", "3/2", "128/81", "27/16", "16/9", "15/8"], "comma": "81/80" }, "bp3_Dmin": { "description": 'This is a reduction to 12 grades of scale "Ma02" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:06:48', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "10/9", "32/27", "5/4", "4/3", "45/32", "40/27", "128/81", "5/3", "16/9", "15/8"], "comma": "81/80" }, "bp3_Ebmaj": { "description": `This is a reduction to 12 grades of scale "Ma04" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'F' Created 2021-01-05 18:33:09Scale aligned ratio 1.0125 (2022-03-11 07:50:02)`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "6/5", "81/64", "27/20", "64/45", "3/2", "8/5", "27/16", "9/5", "243/128"], "comma": "81/80" }, "bp3_Ebmin": { "description": 'This is a reduction to 12 grades of scale "Ma07" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:09:20 Scale aligned ratio 1.0125 (2022-03-11 07:59:38)', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "32/27", "81/64", "4/3", "64/45", "3/2", "405/256", "27/16", "3645/2048", "243/128"], "comma": "81/80" }, "bp3_Emaj": { "description": `This is a reduction to 12 grades of scale "Ma09" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'F#' Created 2021-01-05 19:38:38`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "81/64", "4/3", "729/512", "3/2", "128/81", "27/16", "16/9", "243/128"], "comma": "81/80" }, "bp3_Emin": { "description": 'This is a reduction to 12 grades of scale "Ma12" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:13:25', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "5/4", "4/3", "45/32", "3/2", "128/81", "5/3", "16/9", "15/8"], "comma": "81/80" }, "bp3_F_maj": { "description": `This is a reduction to 12 grades of scale "Ma07" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'Ab' Created 2021-01-05 19:36:32`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "32/27", "81/64", "4/3", "729/512", "3/2", "8/5", "27/16", "16/9", "243/128"], "comma": "81/80" }, "bp3_F_min": { "description": 'This is a reduction to 12 grades of scale "Ma10" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:10:57', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "81/64", "4/3", "45/32", "3/2", "128/81", "27/16", "16/9", "15/8"], "comma": "81/80" }, "bp3_Fmaj": { "description": `This is a reduction to 12 grades of scale "Ma02" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'G' Created 2021-01-05 18:30:32`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "10/9", "32/27", "5/4", "4/3", "45/32", "3/2", "128/81", "5/3", "16/9", "15/8"], "comma": "81/80" }, "bp3_Fmin": { "description": 'This is a reduction to 12 grades of scale "Ma05" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:07:58 Scale aligned ratio 1.0125 (2022-03-11 07:59:51)', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "6/5", "81/64", "4/3", "64/45", "3/2", "8/5", "27/16", "3645/2048", "243/128"], "comma": "81/80" }, "bp3_Gmaj": { "description": `This is a reduction to 12 grades of scale "Ma12" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'A' Created 2021-01-05 18:49:22`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "5/4", "4/3", "45/32", "3/2", "128/81", "27/16", "16/9", "15/8"], "comma": "81/80" }, "bp3_Gmin": { "description": 'This is a reduction to 12 grades of scale "Ma03" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:15:32Scale aligned ratio 1.0125 (2022-03-11 07:54:43)', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "6/5", "81/64", "27/20", "64/45", "3/2", "8/5", "27/16", "9/5", "243/128"], "comma": "81/80" }, "bp3_Ma01": { "description": 'Scale "Ma01" from Bernard Bel / Bol Processor', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "4/3", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Ma02": { "description": 'This is a transposition of scale "Ma01" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2020-11-28 16:51:26', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "4/3", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Ma03": { "description": 'This is a transposition of scale "Ma2" (23 grades) From \u2018C\u2019 to \u2018F\u2019 Created 2020-11-27 18:26:51', "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 23, "ratios": ["80/81", "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "4/3", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Ma04": { "description": 'This is a transposition of scale "Ma3" (23 grades) From \u2018E\u2019 to \u2018A\u2019 Created 2020-11-27 19:34:18', "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 23, "ratios": ["80/81", "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "320/243", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Ma05": { "description": 'This is a transposition of scale "Ma4" (23 grades) From \u2018Eb\u2019 to \u2018Ab\u2019 Created 2020-11-28 07:25:59', "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 23, "ratios": ["80/81", "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "320/243", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "225/128", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Ma06": { "description": 'This is a transposition of scale "Ma5" (23 grades) From \u2018D\u2019 to \u2018G\u2019 Created 2020-11-28 07:48:18', "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 23, "ratios": ["80/81", "256/243", "16/15", "10/9", "9/8", "75/64", "6/5", "5/4", "81/64", "320/243", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "225/128", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Ma07": { "description": 'This is a transposition of scale "Ma6" (23 grades) From \u2018D\u2019 to \u2018G\u2019 Created 2020-11-28 08:01:21', "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 23, "ratios": ["80/81", "256/243", "16/15", "10/9", "9/8", "75/64", "6/5", "5/4", "81/64", "320/243", "27/20", "45/32", "64/45", "40/27", "3/2", "25/16", "8/5", "5/3", "27/16", "225/128", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Ma08": { "description": 'This is a transposition of scale "Ma7" (23 grades) From \u2018C\u2019 to \u2018F\u2019 Created 2020-11-28 08:11:34', "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 23, "ratios": ["80/81", "50/48", "16/15", "10/9", "9/8", "75/64", "6/5", "5/4", "81/64", "320/243", "27/20", "45/32", "64/45", "40/27", "3/2", "25/16", "8/5", "5/3", "27/16", "225/128", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Ma09": { "description": 'This is a transposition of scale "Ma08" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2020-11-28 19:09:43', "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 23, "ratios": ["80/81", "50/48", "16/15", "10/9", "9/8", "75/64", "6/5", "5/4", "81/64", "320/243", "27/20", "25/18", "64/45", "40/27", "3/2", "25/16", "8/5", "5/3", "27/16", "225/128", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Ma10": { "description": 'This is a transposition of scale "Ma09" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 17:41:33', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "4/3", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Ma11": { "description": 'This is a transposition of scale "Ma10" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:42:40', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "9/8", "729/640", "32/27", "6/5", "5/4", "6561/5120", "4/3", "27/20", "45/32", "64/45", "3/2", "243/160", "128/81", "8/5", "27/16", "2187/1280", "16/9", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Ma12": { "description": 'This is a transposition of scale "Ma11" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:43:43', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "9/8", "729/640", "32/27", "6/5", "5/4", "6561/5120", "4/3", "27/20", "45/32", "64/45", "3/2", "243/160", "128/81", "8/5", "5/3", "2187/1280", "16/9", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Ma13": { "description": 'This is a transposition of scale "Ma12" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:44:52', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "10/9", "729/640", "32/27", "6/5", "5/4", "6561/5120", "4/3", "27/20", "45/32", "64/45", "3/2", "243/160", "128/81", "8/5", "5/3", "2187/1280", "16/9", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Ma_grama": { "description": 'Scale "Ma_grama" from Bernard Bel / Bol Processor', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "4/3", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Sa01": { "description": `This is a derivation of scale "Ma01" (23 grades) in major tonality. Sensitive note = 'D' Created 2020-12-05 21:18:01`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "4/3", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128"] }, "bp3_Sa02": { "description": `This is a derivation of scale "Ma02" (23 grades) in major tonality. Sensitive note = 'G' Created 2020-12-05 21:18:59`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "4/3", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128"] }, "bp3_Sa03": { "description": `This is a derivation of scale "Ma03" (23 grades) in major tonality. Sensitive note = 'C' Created 2020-12-05 22:00:48`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "4/3", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128"] }, "bp3_Sa04": { "description": `This is a derivation of scale "Ma04" (23 grades) in major tonality. Sensitive note = 'F' Created 2020-12-05 21:26:05`, "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 23, "ratios": ["80/81", "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "320/243", "4/3", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128"] }, "bp3_Sa05": { "description": `This is a derivation of scale "Ma05" (23 grades) in major tonality. Sensitive note = 'Bb' Created 2020-12-05 21:26:54`, "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 23, "ratios": ["80/81", "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "320/243", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "1280/729", "16/9", "15/8", "243/128"] }, "bp3_Sa06": { "description": `This is a derivation of scale "Ma06" (23 grades) in major tonality. Sensitive note = 'Eb' Created 2020-12-05 21:27:42`, "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 23, "ratios": ["80/81", "256/243", "16/15", "10/9", "9/8", "75/64", "32/27", "5/4", "81/64", "320/243", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "225/128", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Sa07": { "description": `This is a derivation of scale "Ma07" (23 grades) in major tonality. Sensitive note = 'Ab' Created 2020-12-05 21:28:36`, "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 23, "ratios": ["80/81", "256/243", "16/15", "10/9", "9/8", "75/64", "6/5", "5/4", "81/64", "320/243", "27/20", "45/32", "64/45", "40/27", "3/2", "25/16", "128/81", "5/3", "27/16", "225/128", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Sa08": { "description": `This is a derivation of scale "Ma08" (23 grades) in major tonality. Sensitive note = 'Db' Created 2020-12-05 21:29:15`, "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 23, "ratios": ["80/81", "25/24", "256/243", "10/9", "9/8", "75/64", "6/5", "5/4", "81/64", "320/243", "27/20", "45/32", "64/45", "40/27", "3/2", "25/16", "8/5", "5/3", "27/16", "225/128", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Sa09": { "description": `This is a derivation of scale "Ma09" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'F#' Created 2021-01-05 14:44:42`, "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 23, "ratios": ["80/81", "50/48", "16/15", "10/9", "9/8", "75/64", "6/5", "5/4", "81/64", "320/243", "27/20", "25/18", "45/32", "40/27", "3/2", "25/16", "8/5", "5/3", "27/16", "225/128", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Sa10": { "description": 'This is a transposition of scale "Sa09" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:11:29', "source": "Bernard Bel / Bol Processor", "period_ratio": 1.9753, "divisions": 23, "ratios": ["80/81", "50/48", "16/15", "10/9", "9/8", "75/64", "6/5", "5/4", "81/64", "320/243", "27/20", "25/18", "45/32", "40/27", "3/2", "25/16", "8/5", "5/3", "27/16", "225/128", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Sa11": { "description": 'This is a transposition of scale "Sa10" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:49:01', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "9/8", "729/640", "32/27", "6/5", "81/64", "6561/5120", "4/3", "27/20", "45/32", "64/45", "3/2", "243/160", "128/81", "8/5", "27/16", "2187/1280", "16/9", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Sa12": { "description": 'This is a transposition of scale "Sa11" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:51:22', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "9/8", "729/640", "32/27", "6/5", "5/4", "6561/5120", "4/3", "27/20", "45/32", "64/45", "3/2", "243/160", "128/81", "8/5", "27/16", "2187/1280", "16/9", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Sa13": { "description": 'This is a transposition of scale "Sa12" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:52:00', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "9/8", "729/640", "32/27", "6/5", "5/4", "6561/5120", "4/3", "27/20", "45/32", "64/45", "3/2", "243/160", "128/81", "8/5", "5/3", "2187/1280", "16/9", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_base": { "description": 'A "5-limit" tuning framework for constructing chromatic scales using exclusively ratios of integers 2, 3, 5. Read: http://www.tonalsoft.com/enc/j/just.aspx', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "4/3", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128"] }, "bp3_grama": { "description": `The Indian grama scale as conceptualized by E. J. Arnold. Publication: \u2018L'intonation juste dans la th\xE9orie ancienne de l'Inde : les applications aux musiques modale et harmonique\u2019. Revue de Musicologie, vol. 71c n\xB0 1-2, 1985, p. 11-38. Edited and translated by Bernard Bel This version has been modified to define 22 notes on 23 intervals: it has no "m4" (Ma tivra + pramana shruti).`, "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "4/3", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_2_cycles_of_fifths": { "description": "Two series of perfect fifths including ascending major thirds (Asselin 2000 p.62) Created 2021-01-08 09:02:23", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 29, "ratios": [1, "25/24", "256/243", "16/15", "10/9", "9/8", "75/64", "32/27", "6/5", "5/4", "81/64", "320/243", "4/3", "25/18", "45/32", "64/45", "40/27", "3/2", "25/16", "128/81", "8/5", "5/3", "27/16", "225/128", "16/9", "9/5", "15/8", "243/128", "160/81"], "comma": "81/80" }, "bp3_3_cycles_of_fifths": { "description": "Three series of perfect fifths including ascending and descending major thirds (Asselin 2000 p.62) Created 2021-01-08 09:02:23", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 41, "ratios": [1, "81/80", "25/24", "256/243", "16/15", "27/25", "10/9", "9/8", "256/225", "75/64", "32/27", "6/5", "243/200", "5/4", "81/64", "32/25", "320/243", "4/3", "27/20", "25/18", "45/32", "64/45", "36/25", "40/27", "3/2", "243/160", "25/16", "128/81", "8/5", "81/50", "5/3", "27/16", "128/75", "225/128", "16/9", "9/5", "729/400", "15/8", "243/128", "48/25", "160/81"], "comma": "81/80" }, "bp3_Zarlino_temp": { "description": "Created meantone upwards notes \u201Cdo, sol, re, la, mi, si, fa#, do#, sol#\u201D ratio 3/2 -2/7 comma (2021-01-11 18:00:22) Created meantone downwards notes \u201Cdo, fa, sib, mib\u201D ratio 3/2 -2/7 comma (2021-01-11 18:05:45) Created meantone upwards notes \u201Cdo, sol\u201D ratio 3/2 -2/7 comma (2021-01-11 18:06:40)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.042, 1.117, 1.198, 1.248, 1.338, 1.394, 1.495, 1.557, 1.67, 1.79, 1.865], "comma": "81/80" }, "bp3_Zarlino_temp2": { "description": "Created 2021-01-14 09:31:50 Created meantone upward notes \u201Cdo,mi,sol2#\u201D fraction 5/4 (2021-01-14 09:32:46) Created meantone downward notes \u201Csol2#,do#\u201D fraction 3/2 (2021-01-14 09:33:55) Equalized intervals over series \u201Cdo,sol,re,la,mi,si,fa#,do#\u201D approx fraction 3/2 adjusted -6.1 cents to ratio = 1.495 (2021-01-14 09:34:42) Created meantone downward notes \u201Csol,mib\u201D fraction 5/4 (2021-01-14 09:37:02) Equalized intervals over series \u201Cmib,sib,fa,do\u201D approx fraction 3/2 adjusted -5.2 cents to ratio = 1.495 (2021-01-14 09:38:54)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 13, "ratios": [1, 1.042, 1.117, 1.196, 1.248, 1.25, 1.337, 1.394, 1.495, 1.563, 1.67, 1.789, 1.865], "comma": "81/80" }, "bp3_meantone_BACH": { "description": "Kellner's BACH meantone temperament (Asselin 2000 p.101) Created 2021-01-15 16:02:04Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/5 comma (2021-01-15 16:10:04) Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-15 16:11:48) Created meantone upward notes \u201Cmi,si\u201D fraction 3/2 (2021-01-15 16:13:36)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.053, 1.119, 1.185, 1.253, 1.333, 1.406, 1.496, 1.58, 1.675, 1.778, 1.88], "comma": "81/80" }, "bp3_meantone_barca": { "description": "Barca meantone temperament (Asselin 2000 p.106) Created 2021-01-16 17:56:02 Added fifths down: \u201Cdo,fa,sib\u201D starting fraction 1/1 (2021-01-16 17:57:57) Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#\u201D fraction 3/2 adjusted -1/6 comma (2021-01-16 18:02:25) Created meantone upward notes \u201Cfa#,do#,sol#,re#\u201D fraction 3/2 (2021-01-16 18:03:49)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.055, 1.12, 1.186, 1.255, 1.333, 1.406, 1.497, 1.582, 1.677, 1.778, 1.879], "comma": "81/80" }, "bp3_meantone_bethisy": { "description": "B\xE9thisy meantone temperament (Asselin 2000 p.121) Created 2021-01-16 19:21:57 Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:23:36) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 19:25:49) Created meantone downward notes \u201Cmib,sol#\u201D fraction 3/2 (2021-01-16 19:26:26) Equalized intervals over series \u201Cmi,si,fa#,do#,sol#\u201D approx fraction 3/2 adjusted -1.7 cents to ratio = 1.499 (2021-01-16 19:28:09)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.052, 1.118, 1.182, 1.25, 1.332, 1.404, 1.495, 1.576, 1.672, 1.774, 1.873], "comma": "81/80" }, "bp3_meantone_chaumont": { "description": "Chaumont meantone temperament (Asselin 2000 p.109) Created 2021-01-16 18:06:34 Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:08:41) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:09:41)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.045, 1.118, 1.196, 1.25, 1.337, 1.398, 1.495, 1.563, 1.672, 1.789, 1.869], "comma": "81/80" }, "bp3_meantone_classic": { "description": "This is an equal-tempered scale for BP3 + Csound. Created 2021-01-14 15:38:08 Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-14 15:40:20) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/4 comma (2021-01-14 15:40:57) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/4 comma (2021-01-14 15:43:44)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.045, 1.118, 1.196, 1.25, 1.337, 1.398, 1.495, 1.563, 1.672, 1.789, 1.869], "comma": "81/80" }, "bp3_meantone_corrette": { "description": "Corrette meantone temperament (Asselin 2000 p.111) Created 2021-01-16 18:13:10 Created meantone upward notes \u201Cfa,do,sol,re,la,mi,si,fa#,do#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:16:40) Created meantone downward notes \u201Cfa,sib,mib\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 18:34:13) Created meantone upward notes \u201Cdo#,sol#\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 18:38:14) Base note reset to \u2018do\u2019 (2021-01-16 18:40:53)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.045, 1.118, 1.187, 1.25, 1.338, 1.398, 1.496, 1.569, 1.672, 1.782, 1.87], "comma": "81/80" }, "bp3_meantone_d_alembert_rousseau": { "description": "D'Alembert-Rousseau meantone temperament (Asselin 2000 p.119) Created 2021-01-16 19:04:44 Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:12:08) Created meantone downward notes \u201Cdo,fa,sib,mib,sol#\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 19:17:25) Equalized intervals over series \u201Csol#,do#,fa#,si,mi\u201D approx fraction 2/3 adjusted 2.2 cents to ratio = 0.668 (2021-01-16 19:19:34)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.051, 1.118, 1.182, 1.25, 1.332, 1.403, 1.495, 1.574, 1.672, 1.774, 1.873], "comma": "81/80" }, "bp3_meantone_kirnberger_2": { "description": "Kirnberger II meantone temperament (Asselin 2000 p. 90) Created 2021-01-16 11:52:39 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb\u201D starting fraction 1/1 (2021-01-16 11:54:59) Added fifths up: \u201Cdo,sol,re\u201D starting fraction 1/1 (2021-01-16 11:55:59) Created meantone upward notes \u201Cre,la,mi\u201D fraction 3/2 adjusted -1/2 comma (2021-01-16 11:57:13) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 11:58:24)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.053, 1.125, 1.185, 1.25, 1.333, 1.406, 1.5, 1.58, 1.677, 1.778, 1.875], "comma": "81/80" }, "bp3_meantone_kirnberger_3": { "description": "Kirnberger III meantone temperament (Asselin 2000 p.92) Created 2021-01-16 12:02:11 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb\u201D starting fraction 1/1 (2021-01-16 12:03:52) Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 12:05:20) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 12:06:10)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.053, 1.118, 1.185, 1.25, 1.333, 1.406, 1.495, 1.58, 1.672, 1.778, 1.875], "comma": "81/80" }, "bp3_meantone_marpourg": { "description": "Marpourg meantone temperament (Asselin 2000 p.117) Created 2021-01-16 18:58:49 Created meantone upward notes \u201Cfa,do,sol,re,la,mi,si,fa#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:00:42) Equalized intervals over series \u201Cfa,la#,re#,sol#,do#,fa#\u201D approx fraction 2/3 adjusted -2.8 cents to ratio = 0.666 (2021-01-16 19:02:32) Base note reset to \u2018do\u2019 (2021-01-16 19:03:15)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.05, 1.118, 1.185, 1.25, 1.338, 1.398, 1.496, 1.577, 1.672, 1.781, 1.87], "comma": "81/80" }, "bp3_meantone_pure_minor-thirds": { "description": "Pure minor-thirds temperament (Asselin 2000 p.82) Created 2021-01-15 15:13:09 Created meantone upward notes \u201Cmib,sib,fa,do,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-15 15:15:22) Base note reset to \u2018do\u2019 (2021-01-15 15:16:00)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.037, 1.116, 1.2, 1.244, 1.339, 1.388, 1.494, 1.549, 1.666, 1.792, 1.86], "comma": "81/80" }, "bp3_meantone_rameau_en_do": { "description": "Rameau meantone in C temperament (Asselin 2000 p.113) Created 2021-01-16 18:41:56 Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:44:03) Added fifths down: \u201Cdo,fa\u201D starting fraction 1/1 (2021-01-16 18:49:25) Created meantone upward notes \u201Cdo#,sol#\u201D fraction 3/2 adjusted -1/12 comma (2021-01-16 18:51:19) Created meantone downward notes \u201Cfa,la#\u201D fraction 3/2 (2021-01-16 18:54:20) Equalized intervals over series \u201Csol#,re#,la#\u201D approx fraction 3/2 adjusted 7.5 cents to ratio = 1.506 (2021-01-16 18:55:25)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.045, 1.118, 1.18, 1.25, 1.333, 1.398, 1.495, 1.566, 1.672, 1.777, 1.869], "comma": "81/80" }, "bp3_meantone_sauveur": { "description": "Sauveur meantone temperament (Asselin 2000 p. 81) Created 2021-01-16 10:37:52 Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/5 comma (2021-01-16 10:44:41) Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/5 comma (2021-01-16 10:48:56)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.049, 1.119, 1.194, 1.253, 1.337, 1.403, 1.496, 1.57, 1.675, 1.787, 1.875], "comma": "81/80" }, "bp3_meantone_schlick": { "description": "Schlick meantone temperament (Asselin 2000 p.88) Created 2021-01-16 10:56:35 Created meantone downward notes \u201Cla,re,sol,do,fa\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 10:58:50) Created meantone upward notes \u201Cla,mi,si\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 10:59:48) Created meantone upward notes \u201Cla,do#\u201D fraction 5/4 (2021-01-16 11:04:11) Equalized intervals over series \u201Csi,fa#,do#\u201D approx fraction 3/2 adjusted -5.4 cents to ratio = 1.495 (2021-01-16 11:05:59) Created meantone downward notes \u201Csol,mib\u201D fraction 5/4 (2021-01-16 11:07:31) Equalized intervals over series \u201Cmib,sib,fa\u201D approx fraction 3/2 adjusted -5.3 cents to ratio = 1.495 (2021-01-16 11:08:47) Created meantone downward notes \u201Cdo,lab\u201D fraction 5/4 (2021-01-16 11:13:58) Created meantone upward notes \u201Cmi,sol#\u201D fraction 5/4 adjusted 2/3 comma (2021-01-16 11:23:39) [estimation] Base note reset to \u2018do\u2019 (2021-01-16 11:25:48)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 13, "ratios": [1, 1.045, 1.118, 1.196, 1.25, 1.338, 1.398, 1.496, 1.575, 1.6, 1.672, 1.789, 1.87], "comma": "81/80" }, "bp3_meantone_tartini-vallotti": { "description": "Tartini-Vallotti meantone temperament (Asselin 2000 p.104) Created 2021-01-16 17:45:36 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-16 17:47:11) Created meantone upward notes \u201Cdo,sol,re,la,mi,si\u201D fraction 3/2 adjusted -1/6 comma (2021-01-16 17:48:49)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.053, 1.12, 1.185, 1.255, 1.333, 1.406, 1.497, 1.58, 1.677, 1.778, 1.879], "comma": "81/80" }, "bp3_meantone_werckmeister_3": { "description": "Werckmeister III meantone temperament (Asselin 2000 p.94) Created 2021-01-16 16:53:15 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-16 16:55:35) Created meantone upward notes \u201Cdo,sol,re,la\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 16:57:00) Created meantone upward notes \u201Cla,mi,si\u201D fraction 3/2 (2021-01-16 16:58:34)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.053, 1.118, 1.185, 1.254, 1.333, 1.406, 1.495, 1.58, 1.672, 1.778, 1.881], "comma": "81/80" }, "bp3_meantone_werckmeister_4": { "description": "Werckmeister IV meantone temperament (Asselin 2000 p.96) Created 2021-01-16 17:02:48 Added fifths down: \u201Cdo,fa\u201D starting fraction 1/1 (2021-01-16 17:07:10) Created meantone downward notes \u201Cfa,sib\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:08:04) Created meantone downward notes \u201Csib,mib,sol#\u201D fraction 3/2 adjusted 1/3 comma (2021-01-16 17:09:18) Created meantone downward notes \u201Csol#,do#\u201D fraction 3/2 (2021-01-16 17:11:01) Created meantone downward notes \u201Cdo#,fa#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:12:07) Created meantone downward notes \u201Cfa#,si\u201D fraction 3/2 (2021-01-16 17:13:21) Created meantone downward notes \u201Csi,mi\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:14:45) Created meantone downward notes \u201Cmi,la\u201D fraction 3/2 (2021-01-16 17:16:07) Created meantone upward notes \u201Cdo,sol\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:17:11) Created meantone upward notes \u201Csol,re\u201D fraction 3/2 (2021-01-16 17:17:49)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.049, 1.121, 1.185, 1.253, 1.333, 1.404, 1.494, 1.574, 1.671, 1.785, 1.872], "comma": "81/80" }, "bp3_meantone_werckmeister_5": { "description": "Werckmeister V meantone temperament (Asselin 2000 p.99) Created 2021-01-16 17:29:54 Added fifths up: \u201Cdo,sol,re\u201D starting fraction 1/1 (2021-01-16 17:31:53) Created meantone upward notes \u201Cre,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:33:19) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 17:34:05) Created meantone upward notes \u201Cfa#,do#,lab\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:35:20) Created meantone downward notes \u201Cdo,fa\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:36:08) Created meantone downward notes \u201Cfa,sib,mib\u201D fraction 3/2 (2021-01-16 17:37:05)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.058, 1.125, 1.188, 1.258, 1.337, 1.415, 1.5, 1.582, 1.682, 1.783, 1.887], "comma": "81/80" }, "bp3_meantone_zarlino": { "description": "Zarlino meantone temperament (Asselin 2000 p.85) Created meantone upwards notes \u201Cdo, sol, re, la, mi, si, fa#, do#, sol#\u201D ratio 3/2 -2/7 comma (2021-01-11 18:00:22) Created meantone downwards notes \u201Cdo, fa, sib, mib\u201D ratio 3/2 -2/7 comma (2021-01-11 18:05:45) Created meantone upwards notes \u201Cdo, sol\u201D ratio 3/2 -2/7 comma (2021-01-11 18:06:40)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.042, 1.117, 1.198, 1.248, 1.338, 1.394, 1.495, 1.557, 1.67, 1.79, 1.865], "comma": "81/80" }, "bp3_piano": { "description": "Tuning of a piano with perfect fifths and stretched octave", "source": "Bernard Bel / Bol Processor", "period_ratio": 2.004, "divisions": 12, "ratios": [1, 1.06, 1.123, 1.19, 1.261, 1.336, 1.416, 1.5, 1.59, 1.684, 1.785, 1.891] }, "bp3_stretched_octave-Indian": { "description": "Tuning of a piano with perfect fifths and stretched octave", "source": "Bernard Bel / Bol Processor", "period_ratio": 2.004, "divisions": 12, "ratios": [1, 1.06, 1.123, 1.19, 1.261, 1.336, 1.416, 1.5, 1.59, 1.685, 1.785, 1.891], "comma": "81/80" }, "bp3_bach_temperament": { "description": "This is an equal-tempered scale for BP3 + Csound. Created 2021-01-15 16:02:04Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/5 comma (2021-01-15 16:10:04) Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-15 16:11:48) Created meantone upward notes \u201Cmi,si\u201D fraction 3/2 (2021-01-15 16:13:36)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.053, 1.119, 1.185, 1.253, 1.333, 1.406, 1.496, 1.58, 1.675, 1.778, 1.88], "comma": "81/80" }, "bp3_pure_minor-third_meantone": { "description": "This is an equal-tempered scale for BP3 + Csound. Created 2021-01-15 15:13:09 Created meantone upward notes \u201Cmib,sib,fa,do,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-15 15:15:22) Base note reset to \u2018do\u2019 (2021-01-15 15:16:00)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.037, 1.116, 1.2, 1.244, 1.339, 1.388, 1.494, 1.549, 1.666, 1.792, 1.86], "comma": "81/80" }, "bp3_just_intonation": { "description": "A traditional scale constructed with 'simple' integer ratios", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "6/5", "5/4", "4/3", "64/45", "3/2", "8/5", "5/3", "16/9", "15/8"], "comma": "81/80" }, "bp3_rameau_en_sib": { "description": "Rameau meantone in B flat temperament (Asselin 2000 p.115) Created 2021-01-16 18:41:56 Created meantone upward notes \u201Cdo,sol,re,la,mi,si\u201D fraction 3/2 adjusted -1/4 comma (2022-02-04 16:38:50) Created meantone downward notes \u201Cdo,fa,sib\u201D fraction 3/2 adjusted -1/4 comma (2022-02-04 16:40:08) Created meantone downward notes \u201Csib,mib\u201D fraction 3/2 (2022-02-04 16:58:49) Created meantone upward notes \u201Csi,fa#\u201D fraction 3/2 adjusted -1/4 comma (2022-02-04 17:10:32) Created meantone downward notes \u201Cmib,lab\u201D fraction 3/2 (2022-02-04 17:16:00) Equalized intervals over series \u201Cfa#,reb,lab\u201D approx fraction 3/2 adjusted 10.6 cents to ratio = 1.509 (2022-02-04 17:20:39)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.054, 1.118, 1.193, 1.25, 1.337, 1.397, 1.495, 1.591, 1.672, 1.789, 1.869], "comma": "81/80" }, "bp3_Dha1_murcchana": { "description": 'This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018dhak\u2019 to \u2018sa\u2019. Created 2020-12-17 17:19:51', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "81/64", "4/3", "45/32", "3/2", "128/81", "27/16", "16/9", "15/8"], "comma": "81/80" }, "bp3_Dha3_murcchana": { "description": 'This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018dha\u2019 to \u2018sa\u2019. Created 2020-12-17 17:55:10', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "6/5", "81/64", "4/3", "64/45", "3/2", "8/5", "27/16", "16/9", "243/128"], "comma": "81/80" }, "bp3_Ga1_murcchana": { "description": 'This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018gak\u2019 to \u2018sa\u2019. Created 2020-12-17 17:13:32', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "5/4", "4/3", "45/32", "3/2", "128/81", "27/16", "16/9", "15/8"], "comma": "81/80" }, "bp3_Ga3_murcchana": { "description": 'This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018ga\u2019 to \u2018sa\u2019. Created 2020-12-17 17:52:29', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "32/27", "81/64", "4/3", "64/45", "3/2", "8/5", "27/16", "16/9", "243/128"], "comma": "81/80" }, "bp3_Ma1_murcchana": { "description": 'This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018ma\u2019 to \u2018sa\u2019. Created 2020-12-17 16:59:54', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "10/9", "32/27", "5/4", "4/3", "45/32", "3/2", "128/81", "5/3", "16/9", "15/8"], "comma": "81/80" }, "bp3_Ma3_murcchana": { "description": 'This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018ma#\u2019 to \u2018sa\u2019. Created 2020-12-17 19:45:32', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "81/64", "4/3", "64/45", "3/2", "128/81", "27/16", "16/9", "243/128"], "comma": "81/80" }, "bp3_Ma_grama_full": { "description": 'This is a derivation of scale "Ma01" (23 grades) in \u2018-cs.raga\u2019 Created 2020-12-07 09:27:54', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "4/3", "27/20", "45/32", "64/45", "40/27", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128"], "comma": "81/80" }, "bp3_Ni1_murcchana": { "description": 'This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018nik\u2019 to \u2018sa\u2019. Created 2020-12-17 17:09:41', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "5/4", "4/3", "45/32", "3/2", "128/81", "5/3", "16/9", "15/8"], "comma": "81/80" }, "bp3_Ni3_murcchana": { "description": 'This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018ni\u2019 to \u2018sa\u2019. Created 2020-12-17 17:43:30', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "32/27", "81/64", "4/3", "64/45", "3/2", "128/81", "27/16", "16/9", "243/128"], "comma": "81/80" }, "bp3_Pa3_murcchana": { "description": 'This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018pa\u2019 to \u2018sa\u2019. Created 2020-12-17 18:03:15', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "6/5", "81/64", "27/20", "64/45", "3/2", "8/5", "27/16", "9/5", "243/128"], "comma": "81/80" }, "bp3_Re1_murcchana": { "description": 'This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018rek\u2019 to \u2018sa\u2019. Created 2020-12-17 17:27:47', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "9/8", "32/27", "81/64", "4/3", "45/32", "3/2", "128/81", "27/16", "16/9", "243/128"], "comma": "81/80" }, "bp3_Re3_murcchana": { "description": 'This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018re\u2019 to \u2018sa\u2019. Created 2020-12-17 18:00:02', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "6/5", "81/64", "4/3", "64/45", "3/2", "8/5", "27/16", "9/5", "243/128"], "comma": "81/80" }, "bp3_Sa_murcchana": { "description": 'This is a reduction to 12 grades of scale "Ma_grama_full" (23 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 15:44:19', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "256/243", "10/9", "32/27", "5/4", "4/3", "45/32", "40/27", "128/81", "5/3", "16/9", "15/8"], "comma": "81/80" }, "bp3_asavari1": { "description": 'This is a reduction to 7 grades of scale "Dha3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:57:24', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "9/8", "6/5", "4/3", "3/2", "8/5", "16/9"], "comma": "81/80" }, "bp3_asavari2": { "description": 'This is a reduction to 7 grades of scale "Re3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:01:33', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "9/8", "6/5", "4/3", "3/2", "8/5", "9/5"], "comma": "81/80" }, "bp3_asavari3": { "description": 'This is a reduction to 7 grades of scale "Pa3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:04:25', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "9/8", "6/5", "27/20", "3/2", "8/5", "9/5"], "comma": "81/80" }, "bp3_bad-scale": { "description": 'This is a reduction to 7 grades of scale "Sa_murcchana" (12 grades) in \u2018-cs.raga\u2019 Created 2020-12-17 18:45:55', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "10/9", "32/27", "4/3", "40/27", "5/3", "15/8"], "comma": "81/80" }, "bp3_bhairao1": { "description": 'This is a reduction to 7 grades of scale "Ma3_murcchana" (12 grades) in \u2018-cs.raga\u2019 Created 2020-12-17 19:50:06', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "256/243", "81/64", "4/3", "3/2", "128/81", "243/128"], "comma": "81/80" }, "bp3_bhairao2": { "description": 'This is a reduction to 7 grades of scale "Ni3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:51:30', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "16/15", "81/64", "4/3", "3/2", "128/81", "243/128"], "comma": "81/80" }, "bp3_bhairavi1": { "description": 'This is a reduction to 7 grades of scale "Ni3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:48:21', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "16/15", "32/27", "4/3", "3/2", "128/81", "16/9"], "comma": "81/80" }, "bp3_bhairavi2": { "description": 'This is a reduction to 7 grades of scale "Ga3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:54:29', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "16/15", "32/27", "4/3", "3/2", "8/5", "16/9"], "comma": "81/80" }, "bp3_bhairavi3": { "description": 'This is a reduction to 7 grades of scale "Dha3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:59:10', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "16/15", "6/5", "4/3", "3/2", "8/5", "16/9"], "comma": "81/80" }, "bp3_bhairavi4": { "description": 'This is a reduction to 7 grades of scale "Re3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:00:44', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "16/15", "6/5", "4/3", "3/2", "8/5", "9/5"], "comma": "81/80" }, "bp3_bilaval1": { "description": 'This is a reduction to 7 grades of scale "Sa_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 15:49:41', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "10/9", "5/4", "4/3", "40/27", "5/3", "15/8"], "comma": "81/80" }, "bp3_bilaval2": { "description": 'This is a reduction to 7 grades of scale "Ma_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:02:10', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "10/9", "5/4", "4/3", "3/2", "5/3", "15/8"], "comma": "81/80" }, "bp3_bilaval3": { "description": 'This is a reduction to 7 grades of scale "Ni_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:10:33', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"], "comma": "81/80" }, "bp3_kalyan1": { "description": 'This is a reduction to 7 grades of scale "Ma_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:07:12', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "10/9", "5/4", "45/32", "3/2", "5/3", "15/8"], "comma": "81/80" }, "bp3_kalyan2": { "description": 'This is a reduction to 7 grades of scale "Ni_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:11:52', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "9/8", "5/4", "45/32", "3/2", "5/3", "15/8"], "comma": "81/80" }, "bp3_kalyan3": { "description": 'This is a reduction to 7 grades of scale "Ga_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:14:50', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "9/8", "5/4", "45/32", "3/2", "27/16", "15/8"], "comma": "81/80" }, "bp3_kaphi1": { "description": 'This is a reduction to 7 grades of scale "Sa_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 15:46:42', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "10/9", "32/27", "4/3", "40/27", "5/3", "16/9"], "comma": "81/80" }, "bp3_kaphi2": { "description": 'This is a reduction to 7 grades of scale "Re3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:02:27', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "9/8", "6/5", "4/3", "3/2", "27/16", "9/5"], "comma": "81/80" }, "bp3_kaphi3": { "description": 'This is a reduction to 7 grades of scale "Pa3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:05:03', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "9/8", "6/5", "27/20", "3/2", "27/16", "9/5"], "comma": "81/80" }, "bp3_khamaj1": { "description": 'This is a reduction to 7 grades of scale "Sa_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 15:48:50', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "10/9", "5/4", "4/3", "40/27", "5/3", "16/9"], "comma": "81/80" }, "bp3_khamaj2": { "description": 'This is a reduction to 7 grades of scale "Ma_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:04:13', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "10/9", "5/4", "4/3", "3/2", "5/3", "16/9"], "comma": "81/80" }, "bp3_khamaj3": { "description": 'This is a reduction to 7 grades of scale "Pa3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:06:06', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "9/8", "81/64", "27/20", "3/2", "27/16", "9/5"], "comma": "81/80" }, "bp3_lalit1": { "description": 'This is a reduction to 8 grades of scale "Ma3_murcchana" (12 grades) in \u2018-cs.raga\u2019 Created 2020-12-19 14:23:28', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 8, "ratios": [1, "256/243", "81/64", "4/3", "64/45", "3/2", "128/81", "243/128"], "comma": "81/80" }, "bp3_lalit2": { "description": 'This is a reduction to 8 grades of scale "Ni3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:50:24', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 8, "ratios": [1, "16/15", "81/64", "4/3", "64/45", "3/2", "128/81", "243/128"], "comma": "81/80" }, "bp3_marva1": { "description": 'This is a reduction to 7 grades of scale "Ni_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:12:34', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "256/243", "5/4", "45/32", "3/2", "5/3", "15/8"], "comma": "81/80" }, "bp3_marva2": { "description": 'This is a reduction to 7 grades of scale "Ga_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:17:10', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "256/243", "5/4", "45/32", "3/2", "27/16", "15/8"], "comma": "81/80" }, "bp3_marva3": { "description": 'This is a reduction to 7 grades of scale "Dha_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:24:35', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "256/243", "81/64", "45/32", "3/2", "27/16", "15/8"], "comma": "81/80" }, "bp3_purvi1": { "description": 'This is a reduction to 7 grades of scale "Ga_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:18:42', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "256/243", "5/4", "45/32", "3/2", "128/81", "15/8"], "comma": "81/80" }, "bp3_purvi2": { "description": 'This is a reduction to 7 grades of scale "Dha_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:26:08', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "256/243", "81/64", "45/32", "3/2", "128/81", "15/8"], "comma": "81/80" }, "bp3_purvi3": { "description": 'This is a reduction to 7 grades of scale "Re_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:06', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "256/243", "81/64", "45/32", "3/2", "128/81", "243/128"], "comma": "81/80" }, "bp3_todi1": { "description": 'This is a reduction to 7 grades of scale "Dha_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:26:59', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "256/243", "32/27", "45/32", "3/2", "128/81", "15/8"], "comma": "81/80" }, "bp3_todi2": { "description": 'This is a reduction to 7 grades of scale "Re_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "256/243", "32/27", "45/32", "3/2", "128/81", "243/128"], "comma": "81/80" }, "bp3_todi3": { "description": 'This is a reduction to 7 grades of scale "Ma3_murcchana" (12 grades) in \u2018-cs.raga\u2019 Created 2020-12-17 19:47:44', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "256/243", "32/27", "64/45", "3/2", "128/81", "243/128"], "comma": "81/80" }, "bp3_todi4": { "description": 'This is a reduction to 7 grades of scale "Ga3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:53:30', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 7, "ratios": [1, "16/15", "32/27", "64/45", "3/2", "8/5", "243/128"], "comma": "81/80" }, "bp3_todi_aak_2": { "description": 'This is a reduction to 7 grades of scale "Re_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 2, "ratios": [1, "3/2"] }, "bp3_todi_aak_3": { "description": 'This is a reduction to 7 grades of scale "Re_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 2, "ratios": [1, "3/2"] }, "bp3_todi_ka_3": { "description": 'This is a reduction to 7 grades of scale "Re_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 3, "ratios": [1, "3/2", "243/128"] }, "bp3_todi_ka_4": { "description": 'This is a reduction to 7 grades of scale "Re_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 4, "ratios": [1, "3/2", "128/81", "243/128"] }, "bp3_Bohlen-Pierce": { "description": 'Bohlen-Pierce scale "just intonation" https://midi.org/microtuning-and-alternative-intonation-systems https://en.wikipedia.org/wiki/Bohlen-Pierce_scale Created 2024-10-03 12:33:18', "source": "Bernard Bel / Bol Processor", "period_ratio": 3, "divisions": 13, "ratios": [1, "27/25", "25/21", "9/7", "7/5", "75/49", "5/3", "9/5", "49/25", "15/7", "7/3", "63/25", "25/9"], "comma": "81/80" }, "bp3_meantone_try": { "description": "This is a new scale for BP3.  Creation 2020-11-17 22:55:31 This scale has been imported from a SCALA file. Created 2024-08-22 07:14:33", "source": "Bernard Bel / Bol Processor", "period_ratio": 2.022, "divisions": 12, "ratios": [1, 1.066, 1.125, 1.199, 1.265, 1.349, 1.422, 1.5, 1.599, 1.687, 1.799, 1.896], "comma": "81/80" }, "bp3_meantone_try2": { "description": "This is a new scale for BP3.  Creation 2020-11-17 22:55:31 Same as meantone_try except that the base key is #64. Created 2024-08-22 07:14:33", "source": "Bernard Bel / Bol Processor", "period_ratio": 2.022, "divisions": 12, "ratios": [1, 1.066, 1.125, 1.199, 1.265, 1.349, 1.422, 1.5, 1.599, 1.687, 1.799, 1.896], "comma": "81/80" }, "bp3_zest24-supergoya17plus3_Db": { "description": "Goya-17 plus 484, 676, and 1180 cents This scale has been imported from a SCALA file. Created 2024-08-22 07:41:27", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 20, "ratios": [1, 1.03, 1.104, 1.133, 1.167, 1.233, 1.285, 1.323, 1.338, 1.377, 1.435, 1.478, 1.505, 1.55, 1.65, 1.707, 1.757, 1.844, 1.92, 1.977], "comma": "81/80" }, "bp3_meantone1": { "description": "Mesotonique au quart de comma syntonique (Pietro Aron, 1523) : la quinte est diminuee d'un quart de comma, la tierce majeure 5/4 et la sixte mineure 8/5 sont pures. Douze degres sur la table C Db D Eb E F Gb G Ab A Bb B.", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.069984, 1.118034, 1.196279, 1.25, 1.337481, 1.431084, 1.495349, 1.6, 1.671851, 1.788854, 1.869186] }, "bp3_BACH": { "description": "Kellner's BACH temperament (Asselin 2000 p.101) Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/5 comma (2021-01-15 16:10:04) Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-15 16:11:48) Created meantone upward notes \u201Cmi,si\u201D fraction 3/2 (2021-01-15 16:13:36)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.053, 1.119, 1.185, 1.253, 1.333, 1.406, 1.496, 1.58, 1.675, 1.778, 1.88], "comma": "81/80" }, "bp3_Zarlino_natural": { "description": "A traditional scale constructed with simple integer ratios", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, "16/15", "9/8", "6/5", "5/4", "4/3", "64/45", "3/2", "8/5", "5/3", "16/9", "15/8"] }, "bp3_barca": { "description": "Barca temperament (Asselin 2000 p.106) Created 2021-01-16 17:56:02 Added fifths down: \u201Cdo,fa,sib\u201D starting fraction 1/1 (2021-01-16 17:57:57) Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#\u201D fraction 3/2 adjusted -1/6 comma (2021-01-16 18:02:25) Created meantone upward notes \u201Cfa#,do#,sol#,re#\u201D fraction 3/2 (2021-01-16 18:03:49)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.055, 1.12, 1.186, 1.255, 1.333, 1.406, 1.497, 1.582, 1.677, 1.778, 1.879], "comma": "81/80" }, "bp3_bethisy": { "description": "B\xE9thisy temperament (Asselin 2000 p.121) Created 2021-01-16 19:21:57 Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:23:36) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 19:25:49) Created meantone downward notes \u201Cmib,sol#\u201D fraction 3/2 (2021-01-16 19:26:26) Equalized intervals over series \u201Cmi,si,fa#,do#,sol#\u201D approx fraction 3/2 adjusted -1.7 cents to ratio = 1.499 (2021-01-16 19:28:09)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.052, 1.118, 1.182, 1.25, 1.332, 1.404, 1.495, 1.576, 1.672, 1.774, 1.873], "comma": "81/80" }, "bp3_chaumont": { "description": "Chaumont temperament (Asselin 2000 p.109) Created 2021-01-16 18:06:34 Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:08:41) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:09:41)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.045, 1.118, 1.196, 1.25, 1.337, 1.398, 1.495, 1.563, 1.672, 1.789, 1.869], "comma": "81/80" }, "bp3_classic": { "description": "Classic temperament (Asselin 2000 p.76) Equivalent to Chaumont (p.109) Created 2021-01-14 15:38:08 Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-14 15:40:20) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/4 comma (2021-01-14 15:40:57)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.045, 1.118, 1.196, 1.25, 1.337, 1.398, 1.495, 1.563, 1.672, 1.789, 1.869], "comma": "81/80" }, "bp3_corrette": { "description": "Corrette temperament (Asselin 2000 p.111) Created 2021-01-16 18:13:10 Created meantone upward notes \u201Cfa,do,sol,re,la,mi,si,fa#,do#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:16:40) Created meantone downward notes \u201Cfa,sib,mib\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 18:34:13) Created meantone upward notes \u201Cdo#,sol#\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 18:38:14) Base note reset to \u2018do\u2019 (2021-01-16 18:40:53)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.045, 1.118, 1.187, 1.25, 1.338, 1.398, 1.496, 1.569, 1.672, 1.782, 1.87], "comma": "81/80" }, "bp3_d_alembert_rousseau": { "description": "D'Alembert-Rousseau temperament (Asselin 2000 p.119) Created 2021-01-16 19:04:44 Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:12:08) Created meantone downward notes \u201Cdo,fa,sib,mib,sol#\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 19:17:25) Equalized intervals over series \u201Csol#,do#,fa#,si,mi\u201D approx fraction 2/3 adjusted 2.2 cents to ratio = 0.668 (2021-01-16 19:19:34)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.051, 1.118, 1.182, 1.25, 1.332, 1.403, 1.495, 1.574, 1.672, 1.774, 1.873], "comma": "81/80" }, "bp3_equal_tempered": { "description": "This is an equal-tempered scale for BP3 + Csound. Created 2021-02-13 19:09:08", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.059, 1.122, 1.189, 1.26, 1.335, 1.414, 1.498, 1.587, 1.682, 1.782, 1.888], "comma": "81/80" }, "bp3_kirnberger_2": { "description": "Kirnberger II temperament (Asselin 2000 p. 90) Created 2021-01-16 11:52:39 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb\u201D starting fraction 1/1 (2021-01-16 11:54:59) Added fifths up: \u201Cdo,sol,re\u201D starting fraction 1/1 (2021-01-16 11:55:59) Created meantone upward notes \u201Cre,la,mi\u201D fraction 3/2 adjusted -1/2 comma (2021-01-16 11:57:13) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 11:58:24)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.053, 1.125, 1.185, 1.25, 1.333, 1.406, 1.5, 1.58, 1.677, 1.778, 1.875], "comma": "81/80" }, "bp3_kirnberger_3": { "description": "Kirnberger III temperament (Asselin 2000 p.93) Created 2021-01-16 12:02:11 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb\u201D starting fraction 1/1 (2021-01-16 12:03:52) Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 12:05:20) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 12:06:10)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.053, 1.118, 1.185, 1.25, 1.333, 1.406, 1.495, 1.58, 1.672, 1.778, 1.875], "comma": "81/80" }, "bp3_marpourg": { "description": "Marpourg temperament (Asselin 2000 p.117) Created 2021-01-16 18:58:49 Created meantone upward notes \u201Cfa,do,sol,re,la,mi,si,fa#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:00:42) Equalized intervals over series \u201Cfa,la#,re#,sol#,do#,fa#\u201D approx fraction 2/3 adjusted -2.8 cents to ratio = 0.666 (2021-01-16 19:02:32) Base note reset to \u2018do\u2019 (2021-01-16 19:03:15)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.05, 1.118, 1.185, 1.25, 1.338, 1.398, 1.496, 1.577, 1.672, 1.781, 1.87], "comma": "81/80" }, "bp3_pure_minor-thirds": { "description": "Pure minor-thirds temperament (Asselin 2000 p.82) Created 2021-01-15 15:13:09 Created meantone upward notes \u201Cmib,sib,fa,do,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-15 15:15:22) Base note reset to \u2018do\u2019 (2021-01-15 15:16:00)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.037, 1.116, 1.2, 1.244, 1.339, 1.388, 1.494, 1.549, 1.666, 1.792, 1.86], "comma": "81/80" }, "bp3_rameau_en_do": { "description": "Rameau meantone in C temperament (Asselin 2000 p.113) Created 2021-01-16 18:41:56 Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:44:03) Added fifths down: \u201Cdo,fa\u201D starting fraction 1/1 (2021-01-16 18:49:25) Created meantone upward notes \u201Cdo#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2022-02-04 18:09:16) Created meantone downward notes \u201Cfa,la#\u201D fraction 3/2 (2021-01-16 18:54:20) Equalized intervals over series \u201Csol#,re#,la#\u201D approx fraction 3/2 adjusted 9.1 cents to ratio = 1.508 (2022-02-04 18:10:27)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.045, 1.118, 1.178, 1.25, 1.333, 1.398, 1.495, 1.563, 1.672, 1.777, 1.869], "comma": "81/80" }, "bp3_sauveur": { "description": "Sauveur temperament (Asselin 2000 p. 81) Created 2021-01-16 10:37:52 Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/5 comma (2021-01-16 10:44:41) Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/5 comma (2021-01-16 10:48:56)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.049, 1.119, 1.194, 1.253, 1.337, 1.403, 1.496, 1.57, 1.675, 1.787, 1.875], "comma": "81/80" }, "bp3_scale_1": { "description": "Two series of perfect fifths including ascending major thirds (Asselin 2000 p.62) Created 2021-01-08 09:02:23", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 29, "ratios": [1, 1.042, 1.053, 1.067, 1.111, 1.125, 1.172, 1.185, 1.2, 1.25, 1.266, 1.317, 1.333, 1.389, 1.406, 1.422, 1.481, 1.5, 1.563, 1.58, 1.6, 1.667, 1.688, 1.758, 1.778, 1.8, 1.875, 1.898, 1.975] }, "bp3_schlick_bad": { "description": "Schlick temperament (Asselin 2000 p.88) Created 2021-01-16 10:56:35 [INCORRECT] Created meantone downward notes \u201Cla,re,sol,do,fa\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 10:58:50) Created meantone upward notes \u201Cla,mi,si\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 10:59:48) Created meantone upward notes \u201Cla,do#\u201D fraction 5/4 (2021-01-16 11:04:11) Equalized intervals over series \u201Csi,fa#,do#\u201D approx fraction 3/2 adjusted -5.4 cents to ratio = 1.495 (2021-01-16 11:05:59) Created meantone downward notes \u201Csol,mib\u201D fraction 5/4 (2021-01-16 11:07:31) Equalized intervals over series \u201Cmib,sib,fa\u201D approx fraction 3/2 adjusted -5.3 cents to ratio = 1.495 (2021-01-16 11:08:47) Created meantone downward notes \u201Cdo,lab\u201D fraction 5/4 (2021-01-16 11:13:58) Created meantone upward notes \u201Cmi,sol#\u201D fraction 5/4 adjusted 2/3 comma (2021-01-16 11:23:39) [estimation] Base note reset to \u2018do\u2019 (2021-01-16 11:25:48)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 13, "ratios": [1, 1.045, 1.118, 1.196, 1.25, 1.338, 1.398, 1.496, 1.575, 1.6, 1.672, 1.789, 1.87], "comma": "81/80" }, "bp3_tartini-vallotti": { "description": "Tartini-Vallotti temperament (Asselin 2000 p.104) Created 2021-01-16 17:45:36 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-16 17:47:11) Created meantone upward notes \u201Cdo,sol,re,la,mi,si\u201D fraction 3/2 adjusted -1/6 comma (2021-01-16 17:48:49)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.053, 1.12, 1.185, 1.255, 1.333, 1.406, 1.497, 1.58, 1.677, 1.778, 1.879], "comma": "81/80" }, "bp3_werckmeister_3": { "description": "Werckmeister III temperament (Asselin 2000 p.94) Created 2021-01-16 16:53:15 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-16 16:55:35) Created meantone upward notes \u201Cdo,sol,re,la\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 16:57:00) Created meantone upward notes \u201Cla,mi,si\u201D fraction 3/2 (2021-01-16 16:58:34)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.053, 1.118, 1.185, 1.254, 1.333, 1.406, 1.495, 1.58, 1.672, 1.778, 1.881], "comma": "81/80" }, "bp3_werckmeister_4": { "description": "Werckmeister IV temperament (Asselin 2000 p.96) Created 2021-01-16 17:02:48 Added fifths down: \u201Cdo,fa\u201D starting fraction 1/1 (2021-01-16 17:07:10) Created meantone downward notes \u201Cfa,sib\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:08:04) Created meantone downward notes \u201Csib,mib,sol#\u201D fraction 3/2 adjusted 1/3 comma (2021-01-16 17:09:18) Created meantone downward notes \u201Csol#,do#\u201D fraction 3/2 (2021-01-16 17:11:01) Created meantone downward notes \u201Cdo#,fa#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:12:07) Created meantone downward notes \u201Cfa#,si\u201D fraction 3/2 (2021-01-16 17:13:21) Created meantone downward notes \u201Csi,mi\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:14:45) Created meantone downward notes \u201Cmi,la\u201D fraction 3/2 (2021-01-16 17:16:07) Created meantone upward notes \u201Cdo,sol\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:17:11) Created meantone upward notes \u201Csol,re\u201D fraction 3/2 (2021-01-16 17:17:49)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.049, 1.121, 1.185, 1.253, 1.333, 1.404, 1.494, 1.574, 1.671, 1.785, 1.872], "comma": "81/80" }, "bp3_werckmeister_5": { "description": "Werckmeister V temperament (Asselin 2000 p.99) Created 2021-01-16 17:29:54 Added fifths up: \u201Cdo,sol,re\u201D starting fraction 1/1 (2021-01-16 17:31:53) Created meantone upward notes \u201Cre,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:33:19) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 17:34:05) Created meantone upward notes \u201Cfa#,do#,lab\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:35:20) Created meantone downward notes \u201Cdo,fa\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:36:08) Created meantone downward notes \u201Cfa,sib,mib\u201D fraction 3/2 (2021-01-16 17:37:05)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.058, 1.125, 1.188, 1.258, 1.337, 1.415, 1.5, 1.582, 1.682, 1.783, 1.887], "comma": "81/80" }, "bp3_zarlino": { "description": "Zarlino temperament (Asselin 2000 p.85) Created meantone upwards notes \u201Cdo, sol, re, la, mi, si, fa#, do#, sol#\u201D ratio 3/2 -2/7 comma (2021-01-11 18:00:22) Created meantone downwards notes \u201Cdo, fa, sib, mib\u201D ratio 3/2 -2/7 comma (2021-01-11 18:05:45) Created meantone upwards notes \u201Cdo, sol\u201D ratio 3/2 -2/7 comma (2021-01-11 18:06:40)", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 12, "ratios": [1, 1.042, 1.117, 1.198, 1.248, 1.338, 1.394, 1.495, 1.557, 1.67, 1.79, 1.865], "comma": "81/80" }, "bp3_johnston_unt3": { "description": 'Johnston final lattice for "The Un-tempered Pianos" and "K" This scale has been imported from a SCALA file. Created 2024-08-22 07:44:18', "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 25, "ratios": [1, "1029/1024", "33/32", "35/32", "36015/32768", "147/128", "2401/2048", "19/16", "5/4", "5145/4096", "21/16", "343/256", "11/8", "735/512", "12005/8192", "3/2", "49/32", "49/32", "13/8", "105/64", "1715/1024", "7/4", "7203/4096", "15/8", "245/128"] }, "bp3_zwolle2": { "description": "Henri Arnaut De Zwolle's modified meantone tuning (c. 1440) This scale has been imported from a SCALA file. Created 2024-08-22 07:39:55", "source": "Bernard Bel / Bol Processor", "period_ratio": 2, "divisions": 3, "ratios": [1, "5/4", "25/16"], "comma": "81/80" }, "bp3_shruti23_native": { "description": "Table native 22-shruti de -to.tryShruti (BP3, 23 ratios sur 23 degr\xE9s). Convention pythagoricienne au degr\xE9 12 (729/512). DISTINCT de bp3_grama (\xE9dition savante d'Arnold par B. Bel, 64/45 au m\xEAme degr\xE9) \u2014 deux syst\xE8mes valides, celui-ci est la table du moteur natif.", "source": "bp3-engine/test-data/-to.tryShruti", "period_ratio": 2, "divisions": 23, "ratios": [1, "256/243", "16/15", "10/9", "9/8", "32/27", "6/5", "5/4", "81/64", "4/3", "27/20", "45/32", "729/512", "3/2", "128/81", "8/5", "5/3", "27/16", "16/9", "9/5", "15/8", "243/128", "48/25"] } };
LIBS["test_alphabets"] = { "documented": false, "resolvedBy": "Kairos", "resolves": "alphabet", "abc": { "description": "Single-character alphabet a-z (Bernard's -al.abc / -ho.abc)", "runtime": "audio", "resolvesPitch": false, "alterations": {}, "terminals": { "a": {}, "b": {}, "c": {}, "d": {}, "e": {}, "f": {}, "g": {}, "h": {}, "i": {}, "j": {}, "k": {}, "l": {}, "m": {}, "n": {}, "o": {}, "p": {}, "q": {}, "r": {}, "s": {}, "t": {}, "u": {}, "v": {}, "w": {}, "x": {}, "y": {}, "z": {}, "a'": {}, "b'": {}, "c'": {}, "d'": {}, "e'": {}, "f'": {}, "g'": {}, "h'": {}, "i'": {}, "j'": {}, "k'": {}, "l'": {}, "m'": {}, "n'": {}, "o'": {}, "p'": {}, "q'": {}, "r'": {}, "s'": {}, "t'": {}, "u'": {}, "v'": {}, "w'": {}, "x'": {}, "y'": {}, "z'": {} } }, "abc1": { "description": "Single-character alphabet a-h (Bernard's -al.abc1 / -ho.abc1)", "runtime": "audio", "resolvesPitch": false, "alterations": {}, "terminals": { "chik": {}, "a": {}, "a'": {}, "b": {}, "c": {}, "c'": {}, "d": {}, "d'": {}, "e": {}, "f": {}, "f'": {}, "g": {}, "g'": {}, "h": {}, "cycle1": {}, "cycle2": {} } }, "conway": { "description": "Conway look-and-say sequence digits", "runtime": "audio", "resolvesPitch": false, "alterations": {}, "terminals": { "d1": {}, "d2": {}, "d3": {} } }, "kathak_count": { "description": "Kathak counting bols (ek-do-tin)", "runtime": "audio", "resolvesPitch": false, "alterations": {}, "terminals": { "ek": {}, "do": {}, "tin": {}, "char": {}, "panch": {}, "che": {}, "sat": {}, "at": {}, "nau": {}, "das": {}, "gyara": {}, "bara": {}, "tera": {}, "chauda": {}, "pandra": {}, "sola": {} } }, "structural": { "description": "Opaque structural symbols for grammar tests (no pitch, no sound)", "runtime": "audio", "resolvesPitch": false, "alterations": {}, "terminals": { "A": {}, "A1": {}, "A2": {}, "A3": {}, "B": {}, "C": {}, "D": {}, "E": {}, "F": {}, "G": {}, "H": {}, "I": {}, "J": {}, "K": {}, "L": {}, "M": {}, "N": {}, "S1": {}, "S2": {}, "T": {}, "X": {}, "Y": {}, "Z": {} } }, "dhati": { "description": "Les dix bols de l'alphabet natif `-al.dhati`, reproduits tels quels", "runtime": "audio", "resolvesPitch": false, "alterations": {}, "terminals": { "dha": {}, "dhee": {}, "ge": {}, "ke": {}, "kt": {}, "na": {}, "ta": {}, "tee": {}, "ti": {}, "tr": {} } }, "checkhomo": { "description": "Les sept termes de l'alphabet natif `-al.checkhomo`", "runtime": "audio", "resolvesPitch": false, "alterations": {}, "terminals": { "a": {}, "a'": {}, 'a"': {}, "b": {}, "b'": {}, "c": {}, "c'": {} } }, "dhin": { "description": "Les quatorze bols de l'alphabet natif `-al.dhin--`", "runtime": "audio", "resolvesPitch": false, "alterations": {}, "terminals": { "dha": {}, "ta": {}, "ti": {}, "ra": {}, "na": {}, "ki": {}, "dhee": {}, "tee": {}, "ne": {}, "ge": {}, "ke": {}, "ka": {}, "dhin": {}, "tin": {} } } };
LIBS["time"] = { "controls": { "syncdelay": { "bp3": "MIDIsyncDelay", "args": ["duration"], "unit": "ms", "description": "Retard de rattrapage de l'horloge \xE0 la reprise apr\xE8s un point d'attente, en MILLISECONDES. Image de MIDIsyncDelay au moteur natif.", "scope": ["scene"] } }, "documented": true, "resolvedBy": "Kronos", "resolves": "time", "name": "time", "description": "Le temps qui S'\xC9COULE \u2014 le m\xE9tronome de la sc\xE8ne. Librairie d'EN-T\xCATE, r\xE9solue par KRONOS.", "version": "1.0.0", "subgrammar": { "tempo": { "bp3": "_mm", "args": ["bpm"], "unit": "bpm", "description": "Metronome absolu de la scene ou de la sous-grammaire, en BPM.", "scope": ["subgrammar", "scene"], "unicite": "metronome" } } };
LIBS["transpo"] = { "controls": { "transpose": { "args": ["interval"], "argType": "interval", "description": "Real (chromatic) transposition \u2014 shift the alphabet anchor by a fixed interval (fraction 3/2, cents 700c, decimal 1.5). Preserves intervals AND note names; works in any tuning. A bare integer is a ratio N:1 (N-th harmonic): 2/4/8 = octaves; for semitones use cents (12 semitones = 1200c). The old grid-step regime is removed.", "scope": ["symbol", "group", "rule", "flow", "scene"], "transportGroup": "transpo" }, "scale": { "bp3": "_scale", "args": ["name", "blockkey"], "default": { "name": 0, "blockkey": 0 }, "description": "Microtonal scale \u2014 name + base note. (scale:0 0) revient au temperament egal. Le nom et la note de base sont DEUX valeurs, separees par la virgule dans le declaratif et par l'espace dans le flux.", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "transpo" }, "scaleshift": { "args": ["degrees"], "default": 0, "description": "Scalar (diatonic) transposition \u2014 shift N degrees in the alphabet. (scaleshift:2) : Sa->Ga, etc. Preserves degrees, not intervals (in unequal scales). Formerly rotate-HAUTEUR; distinct from the ![rotate] STRUCTURE control.", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "transpo" }, "chromashift": { "bp3": "_transpose", "args": ["keys"], "default": 0, "description": "Chromatic transposition on the 12-key grid \u2014 shift N chromatic keys (semitones), rename to target key + its tuning. Image of BP3 _transpose (Romain decision 2026-07-17). Distinct from scaleshift (diatonic degrees) and transpose (real, name preserved).", "scope": ["symbol", "group", "rule", "flow", "scene"], "transportGroup": "transpo" }, "keyxpand": { "bp3": "_keyxpand", "args": ["pivot", "factor"], "default": { "pivot": 0, "factor": 1 }, "description": "Interval expansion/contraction around a pivot. factor=2 doubles, factor=-1 inverts, factor=0.5 contracts.", "scope": ["symbol", "group", "rule", "flow"], "transportGroup": "transpo" } }, "documented": true, "resolves": "transpo", "resolvedBy": "Kairos", "name": "transpo", "description": "Transformations de hauteur r\xE9solues par Kairos." };
LIBS["tunings"] = { "documented": true, "resolvedBy": "Kairos", "resolves": "tuning", "western_12TET": { "description": "Standard Western equal temperament", "alphabet": "western", "temperament": "12TET", "degrees": [0, 2, 4, 5, 7, 9, 11] }, "western_pythagorean": { "description": "Western in Pythagorean tuning \u2014 pure fifths", "alphabet": "western", "temperament": "pythagorean", "degrees": [0, 2, 4, 5, 7, 9, 11] }, "western_just": { "description": "Western in 5-limit just intonation", "alphabet": "western", "temperament": "just_5limit", "degrees": [0, 2, 4, 5, 7, 9, 11] }, "western_meantone": { "description": "Western in 1/4-comma meantone", "alphabet": "western", "temperament": "meantone_quarter", "degrees": [0, 2, 4, 5, 7, 9, 11] }, "sargam_12TET": { "description": "Indian sargam in 12-TET (simplified, equal temperament)", "alphabet": "sargam", "temperament": "12TET", "degrees": [0, 2, 4, 5, 7, 9, 11] }, "bp3_indian_12TET": { "description": "Convention de notes INDIAN du moteur BP3 natif, en 12-TET", "alphabet": "bp3_indian", "temperament": "12TET", "degrees": [0, 2, 4, 5, 7, 9, 11] }, "bp3_english_12TET": { "description": "Convention de notes ENGLISH du moteur BP3 natif, en 12-TET", "alphabet": "bp3_english", "temperament": "12TET", "degrees": [0, 2, 4, 5, 7, 9, 11] }, "bp3_fr_12TET": { "description": "Convention de notes FRENCH du moteur BP3 natif, en 12-TET", "alphabet": "bp3_fr", "temperament": "12TET", "degrees": [0, 2, 4, 5, 7, 9, 11] }, "sargam_22shruti": { "description": "Indian sargam in 22-shruti system \u2014 full microtonal resolution", "alphabet": "sargam", "temperament": "22shruti", "degrees": [0, 4, 8, 9, 13, 17, 21] }, "solfege_12TET": { "description": "Solf\xE8ge latin in 12-TET", "alphabet": "solfege", "temperament": "12TET", "degrees": [0, 2, 4, 5, 7, 9, 11] }, "arabic_24TET": { "description": "Arabic maqam system \u2014 quarter-tone grid", "alphabet": "arabic", "temperament": "24TET", "degrees": [0, 4, 8, 10, 14, 18, 22] }, "turkish_53TET": { "description": "Turkish makam \u2014 53-comma system", "alphabet": "turkish", "temperament": "53TET", "degrees": [0, 4, 9, 13, 17, 22, 26, 31, 35, 39, 44, 48, 4, 9, 13, 17] }, "gamelan_pelog": { "description": "Javanese gamelan pelog \u2014 7-tone stretched octave", "alphabet": "gamelan_pelog", "temperament": "gamelan_pelog", "degrees": [0, 1, 2, 3, 4, 5, 6] }, "gamelan_slendro": { "description": "Javanese gamelan slendro \u2014 5-tone near-equal, stretched octave", "alphabet": "gamelan_slendro", "temperament": "gamelan_slendro", "degrees": [0, 1, 2, 3, 4] }, "bohlen_pierce_just": { "description": "Bohlen-Pierce just \u2014 13 tones in a tritave (3:1)", "alphabet": "bohlen_pierce", "temperament": "bohlen_pierce_just", "degrees": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, "bohlen_pierce_equal": { "description": "Bohlen-Pierce equal \u2014 13 equal divisions of the tritave", "alphabet": "bohlen_pierce", "temperament": "bohlen_pierce_equal", "degrees": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, "shruti23_native": { "description": "22-shruti nomm\xE9 BP3 \u2014 23 degr\xE9s sur le temp\xE9rament bp3_shruti23_native (table native -to.tryShruti verbatim, 729/512). Distinct de bp3_grama (Arnold).", "alphabet": "shruti23", "temperament": "bp3_shruti23_native", "degrees": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] }, "western_just_c": { "description": "Western en intonation juste BP3, C-ancr\xE9 (tonique C4 = 261.63 Hz, table native -to.tryOneScale). Le 'j' de Cj/Aj/Gj = marqueur de degr\xE9, pars\xE9 C/A/G ; TOUTES les notes rendues par cette m\xEAme gamme juste (mod\xE8le Romain [428/429] : un tuning, pas d'alphabet parall\xE8le). Distinct de western_just (A440-ancr\xE9). Temp\xE9rament bp3_just_intonation = co\xEFncide avec just_5limit sur C/D/E/F/G/A (degr\xE9s 0,2,4,5,7,9).", "alphabet": "western", "temperament": "bp3_just_intonation", "degrees": [0, 2, 4, 5, 7, 9, 11], "baseNote": "C", "diapason": 261.63 }, "shakuhachi_12TET": { "description": "Shakuhachi 1.8 shaku \u2014 les cinq doigtes de base sur temperament egal", "alphabet": "shakuhachi", "temperament": "12TET", "degrees": [0, 3, 5, 7, 10] } };
LIBS["types"] = { "documented": true, "resolves": "types", "gamut": {}, "interval": {}, "degree": {}, "directional": {}, "composite": {} };
LIBS["variation"] = { "controls": { "velfixed": { "bp3": "_velfixed", "description": "V\xE9locit\xE9 en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "velstep": { "bp3": "_velstep", "description": "V\xE9locit\xE9 PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "modfixed": { "bp3": "_modfixed", "description": "Modulation en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "modstep": { "bp3": "_modstep", "description": "Modulation PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "pitchfixed": { "bp3": "_pitchfixed", "description": "Pitchbend en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "pitchstep": { "bp3": "_pitchstep", "description": "Pitchbend PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "pressfixed": { "bp3": "_pressfixed", "description": "Pression en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "presstep": { "bp3": "_presstep", "description": "Pression PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "volumefixed": { "bp3": "_volumefixed", "description": "Volume en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "volumestep": { "bp3": "_volumestep", "description": "Volume PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "articulfixed": { "bp3": "_articulfixed", "description": "Articulation en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net. L'articulation se pose par legato et staccato.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "articulstep": { "bp3": "_articulstep", "description": "Articulation PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "panfixed": { "bp3": "_panfixed", "description": "Panoramique en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "panstep": { "bp3": "_panstep", "description": "Panoramique PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "mapfixed": { "bp3": "_mapfixed", "description": "Carte de touches en mode FIXE \u2014 la carte \xE9crite tient jusqu'\xE0 la suivante, saut net.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "mapstep": { "bp3": "_mapstep", "description": "Carte de touches PAR PALIERS \u2014 la carte glisse de note en note entre deux cartes \xE9crites.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "transposefixed": { "bp3": "_transposefixed", "description": "Transposition en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net.", "scope": ["symbol", "group", "rule", "flow"], "args": [] }, "transposestep": { "bp3": "_transposestep", "description": "Transposition PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.", "scope": ["symbol", "group", "rule", "flow"], "args": [] } }, "documented": true, "resolves": "variation", "resolvedBy": "Kairos", "name": "variation", "description": "Modes de variation DISCRETS des param\xE8tres de jeu \u2014 fixe et paliers. Entre deux valeurs \xE9crites d'un m\xEAme param\xE8tre, le mode dit si la premi\xE8re TIENT jusqu'\xE0 la seconde (fixe) ou si elle GLISSE de note en note (paliers). Ces deux modes se r\xE9solvent \xE0 la note, donc avant qu'un son ne soit \xE9mis : ils appartiennent \xE0 Kairos. Le troisi\xE8me mode \u2014 continu \u2014 glisse PENDANT les notes, par messages interm\xE9diaires : il ne peut \xEAtre rendu que par celui qui \xE9met, et il vit donc dans la librairie de son param\xE8tre.", "version": "0.1.0" };
LIBS["voices"] = { "documented": true, "resolvedBy": "Kairos", "name": "voices", "objects": { "wobble": { "audio": "`js: (t, dur, env) => (2*((t*env.pitch)%1)-1) * (0.55+0.45*Math.sin(2*Math.PI*5.5*t)) * Math.max(0,1-t/dur)`" }, "fatbass": { "audio": "`js: (t, dur, env) => ((2*((t*env.pitch)%1)-1) + (2*((t*env.pitch*1.01)%1)-1)) * 0.4 * Math.max(0,1-t/dur)`", "for": { "sub37": { "device": { "preset": "bass-init", "glide": 0.2, "osc1-wave": "saw" } } } }, "bayan_open": { "audio": "`js: (t) => { const h = Math.sin(t*99991)*43758.5453; const b = 2*(h-Math.floor(h))-1; return (Math.sin(2*Math.PI*80*t)*0.8 + b*0.2) * Math.exp(-t/0.35); }`" }, "bayan_muted": { "audio": "`js: (t) => { const h = Math.sin(t*99991)*43758.5453; const b = 2*(h-Math.floor(h))-1; return (Math.sin(2*Math.PI*120*t)*0.5 + b*0.5) * Math.exp(-t/0.08); }`" }, "dayan_ring": { "audio": "`js: (t) => (Math.sin(2*Math.PI*320*t) + Math.sin(2*Math.PI*480*t)) * 0.5 * Math.exp(-t/0.4)`" }, "dayan_tap": { "audio": "`js: (t) => { const h = Math.sin(t*99991)*43758.5453; return (2*(h-Math.floor(h))-1) * Math.exp(-t/0.06); }`" }, "dayan_dry": { "audio": "`js: (t) => (Math.sin(2*Math.PI*494*t) + Math.sin(2*Math.PI*587*t)) * 0.5 * Math.exp(-t/0.06)`" }, "dayan_open": { "audio": "`js: (t) => (Math.sin(2*Math.PI*392*t) + Math.sin(2*Math.PI*494*t) + Math.sin(2*Math.PI*523*t) + Math.sin(2*Math.PI*587*t)) * 0.25 * Math.exp(-t/0.22)`" }, "dummy_csound_a": { "audio": "`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`" }, "dummy_csound_b": { "audio": "`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`" }, "dummy_csound_c": { "audio": "`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`" }, "dummy_csound_d": { "audio": "`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`" }, "dummy_csound_e": { "audio": "`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`" }, "dummy_csound_f": { "audio": "`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`" }, "dummy_csound_midiobject": { "audio": "`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`" } }, "resolves": "voice" };
var PLACES = { "alphabets": [], "audio": ["controls"], "core": ["defaults", "settings", "symbols"], "digital": ["objects"], "engine": ["controls", "engine", "schema", "subgrammar"], "eval": ["objects"], "expression": ["controls"], "homomorphism": ["objects", "tables"], "midi": ["controls", "schema"], "midi_default": [], "octaves": [], "scales": [], "settings": ["bp3_defaults", "directive_map"], "settings/notreich": [], "settings/pattern_grammar": [], "settings/test1": [], "sounds": [], "temperaments": [], "test_alphabets": [], "time": ["controls", "subgrammar"], "transpo": ["controls"], "tunings": [], "types": [], "variation": ["controls"], "voices": ["objects"] };
PLACES._deduites = ["settings/notreich", "settings/pattern_grammar", "settings/test1"];

// src/transpiler/syntaxe-data.js
var SYNTAXE = {
  "_source": "BPscript/schema-syntaxe/language.json",
  "syntaxWords": {
    "->": {
      "kind": "operator",
      "description": "R\xE8gle de production : le membre gauche est r\xE9\xE9crit en membre droit (d\xE9faut gauche\u2192droite)",
      "syntax": "LHS -> RHS"
    },
    "<-": {
      "kind": "operator",
      "description": "R\xE8gle d'analyse : la s\xE9quence droite est r\xE9duite au symbole gauche (droite\u2192gauche)",
      "syntax": "LHS <- RHS"
    },
    "<>": {
      "kind": "operator",
      "description": "R\xE8gle bidirectionnelle : production ET analyse",
      "syntax": "LHS <> RHS"
    }
  },
  "directiveValues": {
    "mode": {
      "description": "Mode de d\xE9rivation du sous-grammaire suivant",
      "values": [
        {
          "name": "ord",
          "description": "Ordonn\xE9 \u2014 r\xE8gles appliqu\xE9es s\xE9quentiellement (d\xE9faut)"
        },
        {
          "name": "rnd",
          "description": "Al\xE9atoire \u2014 s\xE9lection pond\xE9r\xE9e"
        },
        {
          "name": "lin",
          "description": "Lin\xE9aire \u2014 bouclage cyclique"
        },
        {
          "name": "sub",
          "description": "Substitution \u2014 remplacement simultan\xE9 de toutes les occurrences"
        },
        {
          "name": "sub1",
          "description": "Substitution du premier \u2014 occurrence la plus \xE0 gauche seulement"
        },
        {
          "name": "tem",
          "description": "Template \u2014 appariement structurel"
        },
        {
          "name": "poslong",
          "description": "Positional longest \u2014 plus longue correspondance d'abord"
        }
      ]
    },
    "scan": {
      "description": "Placement de la r\xE8gle candidate dans le contexte",
      "values": [
        {
          "name": "left",
          "description": "Argument gauche"
        },
        {
          "name": "right",
          "description": "Argument droit"
        },
        {
          "name": "rnd",
          "description": "Al\xE9atoire"
        }
      ]
    }
  }
};

// src/transpiler/libs-champs.js
var CHAMPS_DE_FICHIER = /* @__PURE__ */ new Set([
  "resolvedBy",
  "resolves",
  "name",
  "description",
  "version",
  "type",
  "section",
  "documented"
]);

// src/transpiler/libs.js
var registry = {};
var cache = {};
function registerLib(name, data) {
  registry[name] = data;
  cache[name] = data;
  _universeControls = null;
  _universeComponentControls = null;
  _universeRuleScope = null;
  _universeRuleAllowed = null;
  _universeSacs = null;
  _universeIntervalControls = null;
  _universeAddressKeys = null;
  _universeReservedDirectives = null;
}
function registerAll(libs) {
  for (const [name, data] of Object.entries(libs)) {
    registerLib(name, data);
  }
}
var _universeControls = null;
function universeControlNames() {
  if (!_universeControls) {
    const allDirs = Object.keys(registry).map((name) => ({ name }));
    _universeControls = loadLibsFromDirectives(allDirs).controlNames;
  }
  return _universeControls;
}
var _universeIntervalControls = null;
function universeIntervalControls() {
  if (!_universeIntervalControls) {
    const allDirs = Object.keys(registry).map((name) => ({ name }));
    _universeIntervalControls = loadLibsFromDirectives(allDirs).intervalControls;
  }
  return _universeIntervalControls;
}
var _universeComponentControls = null;
function universeComponentControls() {
  if (!_universeComponentControls) {
    const allDirs = Object.keys(registry).map((name) => ({ name }));
    _universeComponentControls = loadLibsFromDirectives(allDirs).componentControls;
  }
  return _universeComponentControls;
}
var _universeAddressKeys = null;
var _universeReservedDirectives = null;
function universeAddressKeys() {
  if (!_universeAddressKeys) {
    const allDirs = Object.keys(registry).map((name) => ({ name }));
    _universeAddressKeys = loadLibsFromDirectives(allDirs).addressKeys;
  }
  return _universeAddressKeys;
}
var _universeSacs = null;
function universeSacs() {
  if (!_universeSacs) {
    const allDirs = Object.keys(registry).map((name) => ({ name }));
    const c = loadLibsFromDirectives(allDirs);
    _universeSacs = { moteur: c.engineBagControls, runtime: c.runtimeBagControls, specs: c.controls };
  }
  return _universeSacs;
}
var _universeRuleScope = null;
function universeRuleScopeControls() {
  if (!_universeRuleScope) {
    const allDirs = Object.keys(registry).map((name) => ({ name }));
    _universeRuleScope = loadLibsFromDirectives(allDirs).ruleScopeControls;
  }
  return _universeRuleScope;
}
var _universeRuleAllowed = null;
function universeRuleAllowedControls() {
  if (!_universeRuleAllowed) {
    const allDirs = Object.keys(registry).map((name) => ({ name }));
    _universeRuleAllowed = loadLibsFromDirectives(allDirs).ruleAllowedControls;
  }
  return _universeRuleAllowed;
}
registerAll(LIBS);
function motsDInvocation() {
  const table = /* @__PURE__ */ new Map();
  for (const [fichier, lib] of Object.entries(registry)) {
    const mot = lib && typeof lib === "object" ? lib.resolves : null;
    if (!mot) continue;
    if (!table.has(mot)) table.set(mot, []);
    table.get(mot).push(fichier);
  }
  return table;
}
function fichierDeLAxe(axe) {
  const fichiers = motsDInvocation().get(axe);
  return fichiers && fichiers.length ? fichiers[0] : axe;
}
function loadJsonFile(name) {
  const canonical = fichierDeLAxe(name);
  if (cache[canonical]) return cache[canonical];
  const regData = registry[canonical] || registry[name];
  if (regData) {
    cache[canonical] = regData;
    return regData;
  }
  return null;
}
function loadLib(name, subkey) {
  if (subkey) {
    if (CHAMPS_DE_FICHIER.has(subkey)) return null;
    const fichiers = motsDInvocation().get(name);
    if (fichiers && fichiers.length > 1) {
      for (const f of fichiers) {
        const lib = loadJsonFile(f);
        const e = lib && (lib.alphabets?.[subkey] || lib.tables?.[subkey] || lib.objects?.[subkey] || lib[subkey]);
        if (e) return e;
      }
    }
    const file = loadJsonFile(name);
    if (file) {
      const entry = file.alphabets?.[subkey] || file.tables?.[subkey] || file.objects?.[subkey] || file[subkey];
      if (entry) return entry;
    }
    const subFile = loadJsonFile(name + "/" + subkey);
    if (subFile) return subFile;
    return null;
  }
  return loadJsonFile(name);
}
function porteesDeclarees(nom) {
  if (!nom) return null;
  for (const lib of Object.values(registry)) {
    if (!lib || typeof lib !== "object") continue;
    const res = lib.schema && lib.schema.reservedDirectives;
    if (res && !Array.isArray(res) && res[nom] && Array.isArray(res[nom].scope)) return res[nom].scope;
    for (const section of Object.values(lib)) {
      if (!section || typeof section !== "object" || Array.isArray(section)) continue;
      const def = section[nom];
      if (def && typeof def === "object" && Array.isArray(def.scope)) return def.scope;
    }
  }
  return null;
}
function groupeDUnicite(nom) {
  if (!nom) return null;
  for (const lib of Object.values(registry)) {
    if (!lib || typeof lib !== "object") continue;
    const res = lib.schema && lib.schema.reservedDirectives;
    if (res && !Array.isArray(res) && res[nom] && res[nom].unicite) return res[nom].unicite;
    for (const section of Object.values(lib)) {
      if (!section || typeof section !== "object" || Array.isArray(section)) continue;
      const def = section[nom];
      if (def && typeof def === "object" && def.unicite) return def.unicite;
    }
  }
  return null;
}
function directiveDeclareeParLaLibrairie(lib, nom) {
  const file = loadJsonFile(lib);
  if (!file || !nom) return false;
  const declareeIci = (f) => {
    if (!f) return false;
    const reserved = f.schema && f.schema.reservedDirectives || [];
    if (Array.isArray(reserved) && reserved.includes(nom)) return true;
    if (!Array.isArray(reserved) && Object.prototype.hasOwnProperty.call(reserved, nom)) return true;
    if (f.values && Object.prototype.hasOwnProperty.call(f.values, nom)) return true;
    if (f.controls && Object.prototype.hasOwnProperty.call(f.controls, nom)) return true;
    for (const section of Object.values(f)) {
      if (!section || typeof section !== "object" || Array.isArray(section)) continue;
      const def = section[nom];
      if (def && typeof def === "object" && Array.isArray(def.scope)) return true;
    }
    return false;
  };
  if (declareeIci(file)) return true;
  const vus = /* @__PURE__ */ new Set([lib]);
  const aTraiter = Array.isArray(file.apporte) ? [...file.apporte] : [];
  while (aTraiter.length) {
    const nomLib = aTraiter.shift();
    if (vus.has(nomLib)) continue;
    vus.add(nomLib);
    const f = loadJsonFile(nomLib);
    if (declareeIci(f)) return true;
    if (f && Array.isArray(f.apporte)) aTraiter.push(...f.apporte);
  }
  return false;
}
function resolveActorAlphabet(nom, directives) {
  const r = resolveActorAlphabetSource(nom, directives);
  return r ? r.entry : null;
}
function resolveActorAlphabetSource(nom, directives) {
  const fichiers = motsDInvocation().get("alphabet") || [];
  for (let i = 0; i < fichiers.length; i++) {
    const e = loadJsonFile(fichiers[i]);
    const entry = e && (e.alphabets?.[nom] || e[nom]);
    if (entry && nomsDeTerminaux(entry)) {
      return { entry, lib: i === 0 ? null : (registry[fichiers[i]] || {}).resolves || fichiers[i] };
    }
  }
  const standard = loadLib("alphabet", nom);
  if (standard && nomsDeTerminaux(standard)) return { entry: standard, lib: null };
  for (const d of directives || []) {
    if (!d || !d.name || d.name === "alphabet") continue;
    const entry = loadLib(d.name, nom);
    if (entry && nomsDeTerminaux(entry)) return { entry, lib: d.name };
  }
  return null;
}
function estUneDeclarationDeControle(def) {
  return def !== null && typeof def === "object" && !Array.isArray(def) && "args" in def && "description" in def;
}
function nomsDeTerminaux(alphabetLib) {
  if (!alphabetLib || !alphabetLib.terminals || typeof alphabetLib.terminals !== "object") return null;
  return Object.keys(alphabetLib.terminals);
}
function loadLibsFromDirectives(directives) {
  const ctx = {
    controls: {},
    // name → { bp3, args, ... }
    controlMap: {},
    // name → bp3 name (e.g. "vel" → "_vel")
    // ⛔ LE DESTINATAIRE D'UN CONTRÔLE — nom → l'outil qui le RÉSOUT, verbatim depuis le champ
    // `resolvedBy` de la librairie qui le déclare. C'est le principe de découpage des librairies
    // (une librairie, un destinataire) rendu LISIBLE : sans cette table, l'information s'arrêtait
    // au chargeur et l'aval devait redeviner la destination à partir du nom de la clé, avec une
    // table recopiée chez lui — qui dérive en silence le jour où une clé change de librairie.
    // La valeur n'est jamais traduite ni interprétée ici : elle est portée telle qu'elle est
    // écrite, et c'est le consommateur qui sait ce qu'il en fait.
    controlResolvedBy: {},
    // `<librairie>.<contrôle>` → la déclaration, pour lever l'ambiguïté quand deux librairies
    // portent le même nom (règle Romain 2026-08-13). Toujours peuplé, ambiguïté ou non : la forme
    // préfixée s'écrit et se lit dans les deux cas, elle n'est pas un mode de secours.
    controlsQualified: {},
    controlQualifiedResolvedBy: {},
    // Les noms qu'au moins DEUX librairies déclarent — écrits nus, ils sont refusés.
    ambiguousControls: /* @__PURE__ */ new Set(),
    // ── L'INTERFACE ET SA RÉALISATION ────────────────────────────────────────────────────────
    // `<librairie>.<contrôle>` de l'INTERFACE → les qualifiés qui la RÉALISENT. Doctrine de
    // Romain : « MIDI a toutes ses primitives, et `expression` est un sur-ensemble d'appel
    // générique qui va appeler les primitives d'expression du runtime sous-jacent quel qu'il
    // soit ». Un mot déclaré des deux côtés n'est donc pas une paire d'homonymes : il y a UNE
    // entrée publique — l'interface — et des réalisations qu'on vise par leur préfixe.
    implementations: {},
    // Le qualifié de la réalisation → le qualifié de l'interface qu'elle réalise (l'inverse).
    implementedInterface: {},
    controlNames: /* @__PURE__ */ new Set(),
    bp3NativeControls: /* @__PURE__ */ new Set(),
    // controls BP3 understands natively (no "transport" field)
    seqPrefixControls: /* @__PURE__ */ new Set(),
    // engine controls with scope:"seq_prefix" — emitted as prefix inside group/sequence
    dispatcherOnlyControls: /* @__PURE__ */ new Set(),
    // controls only the dispatcher understands (have "transport" field, e.g. audio)
    dualContextControls: /* @__PURE__ */ new Set(),
    // controls that appear in BOTH engine and runtime — in () always route to _script
    subgrammarControls: /* @__PURE__ */ new Map(),
    // subgrammar-level directives: name → { bp3, args }
    noArgControls: /* @__PURE__ */ new Set(),
    bagOnlyControls: /* @__PURE__ */ new Set(),
    // `bagOnly:true` — aucune forme nue dans le flux, cf. plus bas
    // ⛔ CES DEUX ENSEMBLES DISENT LE DESTINATAIRE, PAS LE SIGNE (rectifié 2026-08-08, Romain :
    // « le destinataire des contrôles est spécifié dans la LIBRAIRIE dans laquelle le contrôle est
    // listé, c'est la seule source de vérité »). Leur ancien commentaire — « déclarés sous `engine`
    // → sac MOTEUR `[…]` » — faisait dire à la librairie COMMENT une chose s'écrit alors qu'elle ne
    // répond qu'à QUI l'exécute. C'est cette confusion qui a fait croire qu'un contrôle exécuté par
    // le moteur devait s'écrire entre crochets : `shuffle`, `retro` et `order` sont bien moteur, et
    // s'écrivent entre PARENTHÈSES parce qu'ils manipulent ce qui est produit.
    // Le SIGNE dit ce que la chose EST — dérivation ou production. Chantier en cours.
    engineBagControls: /* @__PURE__ */ new Set(),
    // exécutés par le MOTEUR (déclarés sous `engine`)
    runtimeBagControls: /* @__PURE__ */ new Set(),
    // exécutés par le RUNTIME (déclarés sous `runtime.*`)
    // Un contrôle ne vit pas dans les deux.
    ruleAllowedControls: /* @__PURE__ */ new Set(),
    // portée INCLUANT `rule` — voir le commentaire du remplissage
    ruleScopeControls: /* @__PURE__ */ new Set(),
    // PROCÉDURES DE NIVEAU RÈGLE (`scope:"rule"` dans la lib) :
    // goto, failed, repeat, stop. Elles ne s'appliquent pas à une
    // POSITION mais à la RÈGLE entière — le moteur les extrait en
    // métadonnée (BPx loadGrammar.ts:3996 mergeQualifierProcedures).
    componentControls: /* @__PURE__ */ new Set(),
    // contrôles désignés par un NUMÉRO DE COMPOSANT : `(cc.98:45)`.
    // Marqués `component:"number"` dans la lib. Le point appelle le
    // composant, les deux points affectent la valeur.
    intervalControls: /* @__PURE__ */ new Set(),
    // controls whose argument is a MUSICAL INTERVAL (fraction 3/2, cents 700c,
    // decimal 1.5) — marqués `argType:"interval"` dans la lib. La valeur est
    // portée BRUTE (chaîne) et résolue en aval par normalizeRatio (Kairos).
    symbols: {},
    // name → { type, ... }
    alphabetTerminals: [],
    // terminaux issus des SEULS alphabets (sans core etc.) —
    // porte du découpeur mono-char (bpxAst.js, flip Palier 4 étape A)
    _libs: {},
    // directive name → raw lib data (for generator access)
    _alphabets: [],
    // loaded alphabet libs (deferred terminal generation)
    _octaveConvention: null,
    // resolved octave convention name
    transcriptions: {},
    // name → { mappings: { a: b, ... } }
    // SCENE_VALUES (hub [293]) : registre GÉNÉRIQUE des valeurs déclarées par les
    // librairies chargées (section top-level `values` d'un fichier lib). Une valeur
    // ajoutée demain à une lib = une entrée JSON, zéro code. nom → spec
    // { unit?, range?, values?, default?, componentDefault?, description?, _axis }.
    // `_axis` = clé d'entité d'acteur du fichier déclarant (tuning, alphabet…) —
    // sert à résoudre `componentDefault` sur le composant référencé par l'acteur.
    valueRegistry: {},
    valueRegistryErrors: []
    // collisions de noms (réservés/contrôles) — remontées à l'émission
  };
  const coreLib = loadJsonFile("core") || {};
  const schema = coreLib.schema || {};
  const nomsReserves = (rd) => Array.isArray(rd) ? rd : Object.keys(rd || {});
  ctx.reservedDirectiveNames = new Set(nomsReserves(schema.reservedDirectives));
  ctx.addressKeys = /* @__PURE__ */ new Set();
  for (const lib of Object.values(registry)) {
    const s = lib && lib.schema;
    if (s && s.reservedDirectives) for (const n of nomsReserves(s.reservedDirectives)) ctx.reservedDirectiveNames.add(n);
    if (s && s.addressKeys) for (const n of nomsReserves(s.addressKeys)) ctx.addressKeys.add(n);
    for (const section of Object.values(lib || {})) {
      if (!section || typeof section !== "object" || Array.isArray(section)) continue;
      for (const [nom, def] of Object.entries(section)) {
        if (nom.startsWith("_") || !def || typeof def !== "object") continue;
        if (Array.isArray(def.scope) && def.scope.includes("scene")) ctx.reservedDirectiveNames.add(nom);
      }
    }
  }
  ctx.qualifierKeys = new Set(schema.qualifierKeys || []);
  ctx.catalogAxes = Array.isArray(schema.catalogAxes) ? schema.catalogAxes.slice() : [];
  ctx.defaultComponents = coreLib.defaults && coreLib.defaults.components || {};
  const mergeValueRegistry = (file, axis) => {
    if (!file || !file.values || typeof file.values !== "object") return;
    for (const [vname, spec] of Object.entries(file.values)) {
      if (vname.startsWith("_") || !spec || typeof spec !== "object") continue;
      if (ctx.reservedDirectiveNames.has(vname) || ctx.controlNames.has(vname)) {
        ctx.valueRegistryErrors.push({
          message: `Valeur de librairie '${vname}' : nom r\xE9serv\xE9 (directive moteur ou contr\xF4le existant) \u2014 renommer dans la librairie`
        });
        continue;
      }
      ctx.valueRegistry[vname] = { ...spec, _axis: axis || null };
    }
  };
  if (coreLib.defaults && coreLib.defaults.values) {
    for (const [vname, spec] of Object.entries(coreLib.defaults.values)) {
      if (vname.startsWith("_") || !spec || typeof spec !== "object") continue;
      ctx.valueRegistry[vname] = { ...spec, _axis: null };
    }
  }
  const digitalLib = loadJsonFile("function");
  ctx.digitalFunctions = new Set(Object.keys(digitalLib && digitalLib.objects || {}));
  const settingsLib = loadLib("settings");
  if (settingsLib) ctx._libs["settings"] = settingsLib;
  const invoquees = new Set((directives || []).map((d) => d && d.name).filter(Boolean));
  const apportees = [];
  const aTraiter = [...directives || []];
  while (aTraiter.length) {
    const d = aTraiter.shift();
    const socle = d && d.name ? loadJsonFile(d.name) : null;
    for (const nom of socle && Array.isArray(socle.apporte) ? socle.apporte : []) {
      if (invoquees.has(nom)) continue;
      invoquees.add(nom);
      const nouvelle = { type: "Directive", name: nom, subkey: null };
      apportees.push(nouvelle);
      aTraiter.push(nouvelle);
    }
  }
  const aCharger = apportees.length ? [...apportees, ...directives || []] : directives || [];
  const provenance = /* @__PURE__ */ new Map();
  const declarer = (nom, origine) => {
    if (!provenance.has(nom)) provenance.set(nom, /* @__PURE__ */ new Set());
    provenance.get(nom).add(origine);
  };
  for (const dir of aCharger) {
    if (dir.name === "cc" && dir.ccMappings) {
      for (const cc of dir.ccMappings) {
        declarer(cc.name, `le contr\xF4leur nomm\xE9 'cc ${cc.name}' de la sc\xE8ne`);
        ctx.controls[cc.name] = {
          args: ["value"],
          range: [0, 127],
          default: 0,
          description: `User CC${cc.number}`,
          transportGroup: "midi",
          ccNumber: cc.number
        };
        ctx.controlNames.add(cc.name);
        ctx.dispatcherOnlyControls.add(cc.name);
      }
      continue;
    }
    if ((dir.type === "ActorDirective" || dir.name === "actor") && dir.properties) {
      for (const axis of ["alphabet", "tuning", "octaves"]) {
        if (dir.properties[axis]) mergeValueRegistry(loadJsonFile(axis), axis);
      }
      continue;
    }
    const lib = loadLib(dir.name, dir.subkey);
    mergeValueRegistry(loadJsonFile(dir.name), dir.name);
    if (!lib) continue;
    const libKey = dir.subkey ? `${dir.name}.${dir.subkey}` : dir.name;
    ctx._libs[libKey] = lib;
    if (lib.subgrammar) {
      for (const [name, def] of Object.entries(lib.subgrammar)) {
        if (name === "_comment") continue;
        ctx.subgrammarControls.set(name, def);
      }
    }
    const controlSources = [];
    if (lib.controls) controlSources.push({ source: lib.controls, isEngine: false, section: "controls" });
    if (lib.engine) controlSources.push({ source: lib.engine, isEngine: true, section: "engine" });
    if (lib.subgrammar) {
      const dansLeFlux = Object.fromEntries(Object.entries(lib.subgrammar).filter(
        ([nom, def]) => nom !== "_comment" && def && Array.isArray(def.scope) && def.scope.includes("flow")
      ));
      if (Object.keys(dansLeFlux).length) controlSources.push({ source: dansLeFlux, isEngine: true, section: "subgrammar" });
    }
    if (lib.groups && typeof lib.groups === "object" && !Array.isArray(lib.groups)) {
      for (const [groupName, groupContent] of Object.entries(lib.groups)) {
        if (groupName === "_comment") continue;
        if (typeof groupContent === "object" && groupContent !== null && !Array.isArray(groupContent)) {
          const hasNestedDefs = Object.values(groupContent).some(
            (v) => typeof v === "object" && v !== null && ("args" in v || "description" in v)
          );
          if (hasNestedDefs) {
            for (const [name, def] of Object.entries(groupContent)) {
              if (name.startsWith("_")) continue;
              controlSources.push({ source: { [name]: { ...def, transportGroup: groupName } }, isEngine: false, section: `groups.${groupName}` });
            }
            continue;
          }
        }
        controlSources.push({ source: { [groupName]: groupContent }, isEngine: false, section: "groups" });
      }
    }
    for (const { source, isEngine, section } of controlSources) {
      for (const [name, def] of Object.entries(source)) {
        if (name.startsWith("_")) continue;
        if (!estUneDeclarationDeControle(def)) {
          throw new Error(
            `lib '${dir.name}' : l'entr\xE9e '${name}' occupe une section de contr\xF4les sans \xEAtre une d\xE9claration de contr\xF4le (il lui faut 'args' ET 'description'). Une cl\xE9 de documentation se pr\xE9fixe par '_' ; sinon, c'est une entr\xE9e du VOCABULAIRE et elle doit se d\xE9clarer comme telle \u2014 un fichier de donn\xE9es n'agrandit pas le langage en le commentant.`
          );
        }
        declarer(name, `lib/${dir.name}.json \u2192 ${section}`);
        if (def.bpscript === false) continue;
        ctx.controls[name] = def;
        if (typeof def.bp3 === "string" && def.bp3) ctx.controlMap[name] = def.bp3;
        const parDefaut = (loadJsonFile(dir.name) || {}).resolvedBy;
        const destinataire = typeof def.resolvedBy === "string" && def.resolvedBy ? def.resolvedBy : parDefaut;
        if (destinataire) ctx.controlResolvedBy[name] = destinataire;
        ctx.controlsQualified[`${dir.name}.${name}`] = def;
        if (destinataire) ctx.controlQualifiedResolvedBy[`${dir.name}.${name}`] = destinataire;
        if (typeof def.implements === "string" && def.implements) {
          const qual = `${dir.name}.${name}`;
          ctx.implementedInterface[qual] = def.implements;
          (ctx.implementations[def.implements] = ctx.implementations[def.implements] || []).push(qual);
        }
        ctx.controlNames.add(name);
        if (isEngine) {
          ctx.bp3NativeControls.add(name);
          ctx.engineBagControls.add(name);
          if (def.scope === "seq_prefix") {
            ctx.seqPrefixControls.add(name);
          }
        } else {
          ctx.dispatcherOnlyControls.add(name);
          ctx.runtimeBagControls.add(name);
        }
        if (!def.args || def.args.length === 0) {
          ctx.noArgControls.add(name);
        }
        if (def.bagOnly === true) {
          ctx.bagOnlyControls.add(name);
        }
        if (def.component === "number") {
          ctx.componentControls.add(name);
        }
        const portees = Array.isArray(def.scope) ? def.scope : def.scope ? [def.scope] : [];
        if (portees.includes("rule") && typeof def.bp3 === "string" && !portees.includes("symbol") && !portees.includes("group")) {
          ctx.ruleScopeControls.add(name);
        }
        if (portees.includes("rule")) ctx.ruleAllowedControls.add(name);
        if (def.argType === "interval") {
          ctx.intervalControls.add(name);
        }
      }
    }
    for (const name of ctx.bp3NativeControls) {
      if (ctx.dispatcherOnlyControls.has(name)) {
        ctx.dualContextControls.add(name);
      }
    }
    if (lib.symbols) {
      for (const [name, def] of Object.entries(lib.symbols)) {
        ctx.symbols[name] = def;
      }
    }
    if (nomsDeTerminaux(lib)) {
      ctx._alphabets.push(lib);
      if (lib.octaves) ctx._octaveConvention = lib.octaves;
    }
    if (dir.name === "octaves" && dir.runtime) {
      ctx._octaveConvention = dir.runtime;
    }
    if (dir.name === "homomorphism" && dir.subkey && (lib?.mappings || lib?.sections)) {
      ctx.transcriptions[dir.subkey] = lib;
    }
  }
  const octaveDef = ctx._octaveConvention ? loadLib("octaves")?.[ctx._octaveConvention] : null;
  for (const lib of ctx._alphabets) {
    if (octaveDef) {
      const alts = lib.alterations && typeof lib.alterations === "object" && !Array.isArray(lib.alterations) ? Object.keys(lib.alterations) : Array.isArray(lib.alterations) && lib.alterations.length > 0 ? lib.alterations : [""];
      for (const note of nomsDeTerminaux(lib)) {
        for (const alt of alts) {
          for (const reg of octaveDef.registers) {
            const noteAlt = note + alt;
            const terminal = octaveDef.position === "suffix" ? noteAlt + octaveDef.separator + reg : reg + octaveDef.separator + noteAlt;
            ctx.alphabetTerminals.push(terminal);
          }
        }
      }
    } else {
      for (const note of nomsDeTerminaux(lib)) {
        ctx.alphabetTerminals.push(note);
      }
    }
  }
  const declareDansLeRegistre = (qualifie) => {
    const point = qualifie.indexOf(".");
    if (point < 0) return false;
    const lib = registry[qualifie.slice(0, point)];
    const nom = qualifie.slice(point + 1);
    if (!lib || typeof lib !== "object") return false;
    for (const section of Object.values(lib)) {
      if (!section || typeof section !== "object" || Array.isArray(section)) continue;
      if (section[nom] && typeof section[nom] === "object") return true;
      for (const sous of Object.values(section)) {
        if (sous && typeof sous === "object" && !Array.isArray(sous) && sous[nom] && typeof sous[nom] === "object" && ("args" in sous[nom] || "description" in sous[nom])) return true;
      }
    }
    return false;
  };
  for (const [qual, cible] of Object.entries(ctx.implementedInterface)) {
    if (!declareDansLeRegistre(cible)) {
      throw new Error(
        `'${qual}' d\xE9clare 'implements:${cible}', et '${cible}' n'est d\xE9clar\xE9 nulle part. Une r\xE9alisation vise une interface EXISTANTE, \xE9crite '<librairie>.<contr\xF4le>'.`
      );
    }
    if (cible === qual) {
      throw new Error(
        `'${qual}' d\xE9clare se r\xE9aliser lui-m\xEAme. Une r\xE9alisation vise l'interface d'une AUTRE librairie \u2014 celle que l'auteur \xE9crit, quand la r\xE9alisation est celle du runtime actif.`
      );
    }
  }
  for (const [nom, origines] of provenance) {
    if (origines.size <= 1) continue;
    const quals = Object.keys(ctx.controlsQualified).filter((q) => q.slice(q.indexOf(".") + 1) === nom);
    const interfaces = quals.filter((q) => !ctx.implementedInterface[q]);
    const implementations = quals.filter((q) => ctx.implementedInterface[q]);
    const toutesVersLaMeme = implementations.length > 0 && interfaces.length === 1 && implementations.every((q) => ctx.implementedInterface[q] === interfaces[0]);
    if (!toutesVersLaMeme) {
      ctx.ambiguousControls.add(nom);
      continue;
    }
    ctx.controls[nom] = ctx.controlsQualified[interfaces[0]];
    if (typeof ctx.controls[nom].bp3 === "string" && ctx.controls[nom].bp3) ctx.controlMap[nom] = ctx.controls[nom].bp3;
    const dest = ctx.controlQualifiedResolvedBy[interfaces[0]];
    if (dest) ctx.controlResolvedBy[nom] = dest;
  }
  for (const lib of Object.values(registry)) {
    const valeurs = lib && lib.controlDefaults;
    if (!valeurs || typeof valeurs !== "object" || Array.isArray(valeurs)) continue;
    for (const [nom, valeur] of Object.entries(valeurs)) {
      if (nom.startsWith("_")) continue;
      const def = ctx.controls[nom];
      if (!def || typeof def !== "object") continue;
      ctx.controls[nom] = { ...def, default: valeur };
    }
  }
  return ctx;
}
function describeVocabulary(directives = []) {
  const aUneScene = Array.isArray(directives) && directives.length > 0;
  const allDirs = aUneScene ? directives : Object.keys(registry).map((name) => ({ name }));
  const ctx = loadLibsFromDirectives(allDirs);
  const isEntry = (v) => v && typeof v === "object" && !Array.isArray(v);
  const META = CHAMPS_DE_FICHIER;
  const components = {};
  for (const axis of ctx.catalogAxes) {
    const file = loadLib(axis);
    components[axis] = file ? file.objects && isEntry(file.objects) ? Object.keys(file.objects).filter((k) => !k.startsWith("_")) : Object.keys(file).filter((k) => !k.startsWith("_") && !META.has(k) && isEntry(file[k])) : [];
  }
  const pick = (def, keys) => {
    const o = {};
    for (const k of keys) if (def[k] !== void 0) o[k] = def[k];
    return o;
  };
  const langLib = SYNTAXE;
  const voicesLib = loadJsonFile("voice");
  const voiceNames = Object.keys(voicesLib && voicesLib.objects || {});
  return {
    voices: voiceNames,
    keywords: [...ctx.reservedDirectiveNames],
    controls: Object.entries(ctx.controls).map(([name, def]) => ({ name, ...pick(def || {}, ["args", "range", "values", "default", "description", "transportGroup"]) })),
    values: Object.entries(ctx.valueRegistry).map(([name, spec]) => ({ name, ...pick(spec || {}, ["range", "unit", "values", "description"]) })),
    functions: [...ctx.digitalFunctions],
    components,
    addressKeys: [...ctx.addressKeys],
    // Réglages RÉSERVÉS (mode/scan/weight/on_fail/tempx/meter) — écrits en PARENTHÈSES depuis la
    // décision Romain 2026-08-02 (LANGUAGE.md:773-800). Exposé pour que le vocabulaire consommé
    // par validateReferences() les reconnaisse comme des attributs `(k:v)` connus.
    qualifierKeys: [...ctx.qualifierKeys],
    directiveValues: langLib.directiveValues || {},
    syntaxWords: langLib.syntaxWords || {}
  };
}

// src/transpiler/constants.js
var BP3_OPERATORS = Object.freeze({ plus: "+", fin: ";", star: "*" });

// src/transpiler/parser.js
var ParseError = class extends Error {
  constructor(msg, token) {
    super(`${msg} at line ${token.line}:${token.col}`);
    this.token = token;
  }
};
function addressKeys() {
  const keys = universeAddressKeys();
  if (!keys || keys.size === 0) {
    throw new Error("aucune cl\xE9 d'adresse d\xE9clar\xE9e dans les librairies \u2014 le parseur ne peut plus distinguer une adresse d'un contr\xF4le (elles vivent dans `midi`, section schema.addressKeys)");
  }
  return keys;
}
var _actorKeys = null;
function actorKeysData() {
  if (_actorKeys) return _actorKeys;
  const sch = (loadLib("core") || {}).schema || {};
  const valides = sch.actorKeys, perimees = sch.deprecatedActorKeys || [];
  if (!Array.isArray(valides) || valides.length === 0) {
    throw new Error("lib/core.json schema.actorKeys est vide ou absent \u2014 le parseur n'a plus de cl\xE9s d'acteur");
  }
  _actorKeys = {
    valides: new Set(valides),
    perimees: new Set(perimees),
    toutes: /* @__PURE__ */ new Set([...valides, ...perimees])
  };
  return _actorKeys;
}
var _varConventions = null;
function varConventions() {
  if (_varConventions) return _varConventions;
  const c = ((loadLib("core") || {}).schema || {}).varConventions;
  if (!Array.isArray(c) || c.length === 0) {
    throw new Error("lib/core.json schema.varConventions est vide ou absent");
  }
  _varConventions = new Set(c);
  return _varConventions;
}
var _typesDeclaratifs = null;
function typesDeclaratifs() {
  if (_typesDeclaratifs) return _typesDeclaratifs;
  const c = ((loadLib("core") || {}).schema || {}).declarationTypes;
  if (!Array.isArray(c) || c.length === 0) {
    throw new Error("lib/core.json schema.declarationTypes est vide ou absent");
  }
  _typesDeclaratifs = new Set(c);
  return _typesDeclaratifs;
}
var _catalogAxisKeys = null;
function catalogAxisKeys() {
  if (_catalogAxisKeys) return _catalogAxisKeys;
  const core = loadLib("core") || {};
  const axes = core?.schema?.catalogAxes;
  if (!Array.isArray(axes) || axes.length === 0) {
    throw new Error("lib/core.json schema.catalogAxes est vide ou absent \u2014 le parseur n'a plus d'axes de catalogue");
  }
  _catalogAxisKeys = new Set(axes);
  return _catalogAxisKeys;
}
var _deprecatedTransports = null;
function deprecatedTransports() {
  if (_deprecatedTransports) return _deprecatedTransports;
  const core = loadLib("core") || {};
  _deprecatedTransports = new Set(core.schema && core.schema.deprecatedTransports || []);
  return _deprecatedTransports;
}
var _channelCatalog = null;
function channelCatalog() {
  if (_channelCatalog) return _channelCatalog;
  const core = loadLib("core") || {};
  _channelCatalog = core.schema && core.schema.channels || {};
  return _channelCatalog;
}
var _outChannels = null;
function outChannels() {
  if (_outChannels) return _outChannels;
  const cat = channelCatalog();
  _outChannels = new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].out));
  return _outChannels;
}
function refuserCanalDeSortieInconnu(name, subkey, tok) {
  if (name !== "out" || !subkey) return;
  if (!outChannels().has(subkey)) {
    throw new ParseError(
      `'${subkey}' n'est pas une sortie \u2014 les canaux de sortie sont ${[...outChannels()].join(", ")}. La liste est FERM\xC9E.`,
      tok
    );
  }
  if (!writableChannels().has(subkey)) {
    throw new ParseError(
      `'out.${subkey}' est refus\xE9 \u2014 ce canal est une DESTINATION de l'architecture, rout\xE9e comme les autres sorties, mais son \xC9CRITURE dans une sc\xE8ne attend encore son appareil d\xE9di\xE9.`,
      tok
    );
  }
}
function refuserModeInvalide(name, runtime, value, tok) {
  if (name !== "mode") return;
  const declares = ((SYNTAXE.directiveValues.mode || {}).values || []).map((v) => v.name);
  const ecrit = runtime ?? (value == null ? null : String(value));
  if (ecrit == null) {
    throw new ParseError(
      `'mode' attend le mode de d\xE9rivation qu'il pose \u2014 'mode:<mode>'. \xC9crit seul, il ne gouverne RIEN : la sous-grammaire garde le mode qu'elle avait, et la ligne dispara\xEEt sans un signe. Les modes sont ${declares.join(", ")}.`,
      tok
    );
  }
  if (!declares.includes(ecrit)) {
    throw new ParseError(
      `'mode:${ecrit}' : '${ecrit}' n'est pas un mode de d\xE9rivation \u2014 les modes sont ${declares.join(", ")}. La liste est FERM\xC9E.`,
      tok
    );
  }
}
var _inChannels = null;
function inChannels() {
  if (_inChannels) return _inChannels;
  const cat = channelCatalog();
  _inChannels = new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].in));
  return _inChannels;
}
var _writableChannels = null;
function writableChannels() {
  if (_writableChannels) return _writableChannels;
  const cat = channelCatalog();
  _writableChannels = new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].writable));
  return _writableChannels;
}
var _voicesIndex = null;
function voicesIndex() {
  if (_voicesIndex) return _voicesIndex;
  _voicesIndex = /* @__PURE__ */ new Map();
  const lib = loadLib("voice");
  for (const [name, def] of Object.entries(lib && lib.objects || {})) {
    const forDevices = def && typeof def.for === "object" && def.for ? { ...def.for } : {};
    _voicesIndex.set(name, { base: def, forDevices });
  }
  return _voicesIndex;
}
function isTypedBacktick(v) {
  return typeof v === "string" && /^`\s*[A-Za-z_][\w-]*\s*:/.test(v);
}
function assertVoiceRef(name, where, token) {
  const entry = voicesIndex().get(name);
  if (!entry) {
    throw new ParseError(
      `${where} : voix '${name}' inconnue \u2014 aucune entr\xE9e '${name}' dans le catalogue du mot 'voice' (LANG-SONS \xA73).`,
      token
    );
  }
  const defs = [...entry.base ? [entry.base] : [], ...Object.values(entry.forDevices)];
  for (const def of defs) {
    if (def.audio !== void 0 && !isTypedBacktick(def.audio)) {
      throw new ParseError(
        `${where} : voix '${name}' \u2014 r\xE9alisation 'audio' invalide dans le catalogue du mot 'voice' : un backtick TYP\xC9 est requis (\`js: \u2026\`, \`faust: \u2026\`) ; re\xE7u ${JSON.stringify(def.audio)}.`,
        token
      );
    }
  }
}
var _alphabetVoicesChecked = /* @__PURE__ */ new Set();
function assertAlphabetVoices(alphabetName, token) {
  if (_alphabetVoicesChecked.has(alphabetName)) return;
  const alpha = loadLib("alphabet", alphabetName);
  if (alpha) {
    for (const [terminal, def] of Object.entries(alpha.terminals || {})) {
      if (def && def.voice) {
        assertVoiceRef(def.voice, `alphabet '${alphabetName}', terminal '${terminal}'`, token);
      }
    }
    if (alpha.voice) {
      assertVoiceRef(alpha.voice, `alphabet '${alphabetName}', voix de la collection`, token);
    }
  }
  _alphabetVoicesChecked.add(alphabetName);
}
function normalizeName(name) {
  return name in BP3_OPERATORS ? BP3_OPERATORS[name] : name;
}
function parse(tokens, opts = {}) {
  let pos = 0;
  const lignesSource = typeof opts.source === "string" ? opts.source.split(/\r\n?|\n/) : null;
  let libCtx = {
    controlNames: /* @__PURE__ */ new Set(),
    noArgControls: /* @__PURE__ */ new Set(),
    bagOnlyControls: /* @__PURE__ */ new Set(),
    dispatcherOnlyControls: /* @__PURE__ */ new Set(),
    engineControls: /* @__PURE__ */ new Set(),
    intervalControls: /* @__PURE__ */ new Set(),
    qualifierKeys: /* @__PURE__ */ new Set(),
    sceneNames: /* @__PURE__ */ new Set(),
    controlMap: {},
    controls: {},
    symbols: {},
    transcriptions: {},
    actors: {},
    controlsQualified: {},
    controlQualifiedResolvedBy: {},
    ambiguousControls: /* @__PURE__ */ new Set()
  };
  const definitionsDeclarees = /* @__PURE__ */ new Set();
  const nomsDeclaresLocalement = /* @__PURE__ */ new Set();
  const acteursDeclares = /* @__PURE__ */ new Set();
  const prototypesDeclares = /* @__PURE__ */ new Set();
  const nomsVariables = /* @__PURE__ */ new Set();
  function warn(message, line) {
    if (opts.onWarning) opts.onWarning({ message, line });
  }
  function current() {
    return tokens[pos] || { type: T.EOF, value: null, line: 0, col: 0 };
  }
  function peek(offset = 0) {
    return tokens[pos + offset] || { type: T.EOF };
  }
  function advance() {
    return tokens[pos++];
  }
  function expect(type) {
    const tok = current();
    if (tok.type !== type) throw new ParseError(`Expected ${type}, got ${tok.type} (${tok.value})`, tok);
    return advance();
  }
  function lireNomDEntree(tok) {
    if (!at(T.IDENT) && !at(T.INT)) {
      throw new ParseError(`Expected ${T.IDENT}, got ${current().type} (${current().value})`, tok || current());
    }
    const chiffreDAbord = at(T.INT);
    const depart = current();
    let nom = String(advance().value);
    while ((at(T.IDENT) || at(T.INT) || at(T.REST)) && !current().spaceBefore) nom += String(advance().value);
    if (chiffreDAbord && !/[A-Za-z]/.test(nom)) {
      throw new ParseError(
        `'${nom}' est un NOMBRE, pas un nom. Un nom qui commence par un chiffre porte au moins une lettre \u2014 '12TET' et '22shruti' sont des noms, '${nom}' n'en est pas un.`,
        depart
      );
    }
    return nom;
  }
  function ouvreUnNom(offset = 0) {
    if (peek(offset).type === T.IDENT) return true;
    if (peek(offset).type !== T.INT) return false;
    const suite = peek(offset + 1);
    return (suite.type === T.IDENT || suite.type === T.INT) && suite.spaceBefore === false;
  }
  function at(type) {
    return current().type === type;
  }
  function ligneSansFleche() {
    for (let j = pos; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type === T.NEWLINE || t.type === T.EOF) return true;
      if (t.type === T.ARROW_R || t.type === T.ARROW_L || t.type === T.ARROW_BI) return false;
    }
    return true;
  }
  function atAny(...types) {
    return types.includes(current().type);
  }
  function skipNewlines() {
    while (at(T.NEWLINE) || at(T.COMMENT)) advance();
  }
  function atEnd() {
    return at(T.EOF);
  }
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
    const lineMap = {};
    for (const dir of directives || []) {
      if (dir.name === "homomorphism" && dir.subkey) {
        lineMap[dir.subkey] = dir.line;
      }
    }
    for (const [subkey, table] of Object.entries(transcriptions)) {
      const line = lineMap[subkey];
      if (table.sections) {
        for (const [secName, body] of Object.entries(table.sections)) {
          if (body && body.chains) {
            result.push({ type: "Homomorphism", name: secName, pairs: unfoldChains(body.chains), line });
          } else {
            const pairs = Object.entries(body);
            result.push({ type: "Homomorphism", name: secName, pairs, line });
          }
        }
      } else if (table.mappings) {
        const pairs = Object.entries(table.mappings);
        result.push({ type: "Homomorphism", name: subkey, pairs, line });
      }
    }
    return result;
  }
  let enDeclaratif = false;
  function parseScene() {
    const scene = {
      type: "Scene",
      directives: [],
      // ⛔ LES DÉFINITIONS ONT LEUR PROPRE CHAMP, `defs: DefDirective[]` (AST.md:29), et elles
      // vivaient dans `directives`. La branche qui les range le disait elle-même : elle les avait
      // d'abord laissées tomber, six gardes étaient tombés en disant « accepter n'est pas
      // transmettre », et elles ont été poussées dans le SEAU LE PLUS PROCHE au lieu de leur
      // domicile contracté. Six gardes verts ne disent pas qu'un nœud est au bon endroit.
      // ⚠️ CE QUI L'A RÉVÉLÉ : le validateur de BPx, qui exige que `directives` ne porte QUE des
      // `Directive`. `dhati.bps` y émettait 39 `DefDirective` — la scène de tabla, celle-là même
      // dont Romain vient d'arbitrer la réécriture en `def`. Toute la migration à venir passait
      // par ce champ.
      defs: [],
      // `init: InitEntry[] | null` (AST.md:30) — NULL quand la scène n'en a pas, et non `undefined`
      // ni un tableau vide : « elle n'en a pas » et « elle en a un vide » doivent rester
      // distinguables par l'aval.
      init: null,
      actors: [],
      scenes: [],
      exposes: [],
      // VARIABLES DE TRAVAIL déclarées par `var` — noms de symboles qui ne sont l'écriture
      // d'aucune note (décision Romain 2026-07-27, voie 3).
      vars: [],
      // ENTRÉES déclarées par `var <rôle> in.<canal>` (ex-`in`, décision Romain 2026-08-04) —
      // un rôle, son canal, sa table éventuelle (décision Romain 2026-07-27, symétrie entrée/sortie).
      inputs: [],
      // `maps` SUPPRIMÉ le 2026-07-27 au soir, avec le mot : `map` est abandonné, le câblage passe
      // par les chevrons. Un champ ÉMIS ET TOUJOURS VIDE n'est pas neutre — un consommateur qui le
      // lit conclut « cette scène ne câble rien » au lieu de « ce canal n'existe plus ». On
      // supprime la donnée avec le mot, dans le même mouvement, sans voie parallèle.
      // `aliases` SUPPRIMÉ le 2026-08-15, par la même règle et pour la même raison : `alias` sort
      // du langage, donc son champ sort avec lui. Mesuré avant : aucun consommateur sur les 24
      // dépôts, et aucune scène du périmètre ne l'écrivait.
      // `labels` SUPPRIMÉ avec 'label' (2026-07-28) : un champ émis et toujours vide fait
      // conclure « cette scène n'étiquette rien » au lieu de « ce canal n'existe plus ».
      declarations: [],
      backticks: [],
      subgrammars: [],
      // v0.8 — sons (prototypes anonymes + nommés) et affectations sujet→son
      soundPrototypes: null,
      soundAssignments: null,
      // Contrat BPx (ast.ts:150-157) : table d'homomorphismes attachée par le parser
      // après chargement des libs. Vide si aucune directive @homomorphism.
      homomorphisms: []
    };
    skipNewlines();
    enDeclaratif = true;
    let initialMode = null;
    let initialModifiers = null;
    let premiereLigne = true;
    while (!atEnd() && !at(T.SEPARATOR)) {
      skipNewlines();
      if (atEnd()) break;
      if (premiereLigne && !ligneSansFleche()) break;
      if (!at(T.BACKTICK) && !atProductionBlock() && !ligneSansFleche()) {
        throw new ParseError(
          `une regle est ecrite AVANT le delimiteur : il manque la ligne '-----' entre la partie declarative et la production. Depuis que l arobase est sortie, c est la POSITION qui qualifie une ligne \u2014 avant le '-----' elle declare, apres elle produit.`,
          current()
        );
      }
      if (!at(T.BACKTICK) && !atProductionBlock()) {
        const dir = parseDirective();
        if (dir.type === "SceneDirective") {
          scene.scenes.push(dir);
        } else if (dir.type === "ExposeDirective") {
          scene.exposes.push(dir);
        } else if (dir.type === "InDirective") {
          scene.inputs = [...scene.inputs || [], dir];
        } else if (dir.type === "VarDirective") {
          scene.vars = [...scene.vars || [], dir];
          for (const n of dir.names) {
            nomsDeclaresLocalement.add(n);
            nomsVariables.add(n);
          }
          if (dir.varType?.kind === "type") {
            for (const n of dir.names) prototypesDeclares.add(n);
          }
        } else if (dir.type === "DefDirective") {
          definitionsDeclarees.add(dir.name);
          nomsDeclaresLocalement.add(dir.name);
          scene.defs.push(dir);
        } else if (dir.type === "Declaration") {
          scene.declarations.push(dir);
        } else if (dir.type === "InitDirective") {
          scene.init = [...scene.init || [], ...dir.entrees];
        } else if (dir.type === "ActorDirective") {
          scene.actors.push(dir);
          if (dir.name) acteursDeclares.add(dir.name);
          if (dir.soundAssignments && dir.soundAssignments.length > 0) {
            scene.soundAssignments = scene.soundAssignments || [];
            for (const sa of dir.soundAssignments) scene.soundAssignments.push(sa);
          }
          delete dir.soundAssignments;
        } else if (dir.type === "SoundSection") {
          scene.soundPrototypes = scene.soundPrototypes || [];
          for (const p of dir.prototypes) scene.soundPrototypes.push(p);
          if (dir.lib) {
            scene.directives.push({
              type: "Directive",
              name: "sound",
              subkey: dir.lib,
              binding: dir.libVariant || null,
              runtime: null,
              value: null,
              aliases: null,
              modifiers: null,
              line: dir.line
            });
          }
        } else if (dir.type === "AlphabetSoundAssignments") {
          scene.directives.push(dir.directive);
          scene.soundAssignments = scene.soundAssignments || [];
          for (const sa of dir.assignments) scene.soundAssignments.push(sa);
        } else if (dir.type === "LibRef") {
          (scene.libRefs || (scene.libRefs = [])).push(dir.address);
        } else if (dir.type === "Declaration") {
          scene.declarations.push(dir);
        } else if (dir.name === "mode" && dir.runtime) {
          initialMode = dir.runtime;
          initialModifiers = dir.modifiers || null;
        } else {
          scene.directives.push(dir);
          const reserves = new Set(((loadLib("core") || {}).schema || {}).reservedDirectives || []);
          for (const [nom, valeur] of Object.entries(loadLib(dir.name) || {})) {
            if (nom.startsWith("_") || !valeur || typeof valeur !== "object" || Array.isArray(valeur)) continue;
            if (reserves.has(nom)) continue;
            prototypesDeclares.add(nom);
          }
        }
      } else if (atProductionBlock()) {
        for (const d of parseProductionBlock()) scene.directives.push(d);
      } else {
        scene.backticks.push(parseBacktickOrphan());
      }
      premiereLigne = false;
      skipNewlines();
    }
    libCtx = loadLibsFromDirectives(scene.directives);
    scene.homomorphisms = buildHomomorphisms(libCtx.transcriptions, scene.directives);
    libCtx.actors = {};
    for (const actor of scene.actors) {
      libCtx.actors[actor.name] = actor.properties;
    }
    libCtx.sceneNames = /* @__PURE__ */ new Set();
    for (const sc of scene.scenes) {
      libCtx.sceneNames.add(sc.name);
      libCtx.symbols[sc.name] = { type: "scene" };
    }
    enDeclaratif = false;
    scene.subgrammars = parseSubgrammars(initialMode, initialModifiers);
    skipNewlines();
    scene.template = null;
    if (at(T.IDENT) && current().value === "template") {
      const entries = parseTemplateSection();
      scene.template = { destinataire: "bpscript", entrees: entries };
    }
    deplierLesCommodites(scene);
    annotateScene(scene);
    if (scene.libRefs) {
      const seen = /* @__PURE__ */ new Set();
      scene.libRefs = scene.libRefs.filter((a) => seen.has(a) ? false : (seen.add(a), true));
    }
    return scene;
  }
  function deplierLesCommodites(scene) {
    const formes = /* @__PURE__ */ new Map();
    for (const d of scene.defs || []) {
      if (!d || d.type !== "DefDirective") continue;
      if (d.kind === "prereglage") {
        formes.set(d.name, d);
        continue;
      }
      if (d.kind === "structure" || d.kind === "transformation") {
        formes.set(d.name, d);
      }
    }
    if (!formes.size) return;
    const membresDroits = [];
    for (const sg of scene.subgrammars || []) {
      for (const rule of sg.rules || []) if (rule && rule.rhs) membresDroits.push(rule.rhs);
    }
    for (let tour = 32; ; tour--) {
      if (!remplacerDans(membresDroits, formes, tour)) break;
    }
  }
  function remplacerDans(n, formes, reste) {
    if (!n || typeof n !== "object") return false;
    if (Array.isArray(n)) {
      let bouge2 = false;
      for (let i = 0; i < n.length; i++) {
        const el = n[i];
        const sortie = el && typeof el === "object" && el.name ? corpsPour(el, formes) : null;
        if (sortie) {
          if (!reste) {
            throw new ParseError(
              `'${el.name}' se d\xE9plie sans fin \u2014 une d\xE9finition finit par se r\xE9invoquer elle-m\xEAme. Une forme qui se contient ne se d\xE9plie pas.`,
              jetonDe(el)
            );
          }
          n.splice(i, 1, ...sortie);
          i += sortie.length - 1;
          bouge2 = true;
        } else if (remplacerDans(el, formes, reste)) bouge2 = true;
      }
      return bouge2;
    }
    let bouge = false;
    for (const v of Object.values(n)) if (remplacerDans(v, formes, reste)) bouge = true;
    return bouge;
  }
  const jetonDe = (el) => ({ line: el?.line ?? 0, col: el?.col ?? 0 });
  const copieProfonde = (n) => JSON.parse(JSON.stringify(n));
  function corpsPour(el, formes) {
    const def = formes.get(el.name);
    if (!def) return null;
    if (el.type === "SymbolCall") {
      if (def.kind !== "transformation") {
        throw new ParseError(
          `'${el.name}' est ${def.kind === "prereglage" ? "un pr\xE9r\xE9glage" : "une structure"} : il se pose NU, sans arguments. \xC9crire '${el.name}'. Une liste de param\xE8tres se d\xE9clare avec le nom ('def ${el.name}(x) \u2026'), et alors seulement l'appel en porte.`,
          jetonDe(el)
        );
      }
      return corpsSubstitue(def, el);
    }
    if (el.type !== "Symbol") return null;
    if (def.kind === "transformation") {
      throw new ParseError(
        `'${el.name}' est une transformation sur ${def.params.join(", ")} : elle s'appelle avec ses arguments. \xC9crire '${el.name}(${def.params.map(() => "\u2026").join(", ")})'. Pos\xE9 nu, le nom sortirait de l'arbre en terminal et sonnerait.`,
        jetonDe(el)
      );
    }
    if (def.kind === "prereglage") {
      return [{
        type: "InstantControl",
        qualifier: copieProfonde(def.settings),
        conjoint: false,
        line: el.line
      }];
    }
    return copieProfonde(def.body);
  }
  function corpsSubstitue(def, appel) {
    const args = appel.args || [];
    const nommes = args.filter((a) => a && a.key != null);
    if (nommes.length) {
      throw new ParseError(
        `'${def.name}(\u2026)' : un argument de transformation se donne par POSITION, jamais par nom \u2014 re\xE7u '${nommes[0].key}:'. \xC9crire '${def.name}(${def.params.map(() => "\u2026").join(", ")})', les param\xE8tres dans l'ordre de la d\xE9finition (${def.params.join(", ")}).`,
        jetonDe(appel)
      );
    }
    if (args.length !== def.params.length) {
      throw new ParseError(
        `'${def.name}' se d\xE9finit sur ${def.params.length} param\xE8tre(s) (${def.params.join(", ")}) et s'appelle ici avec ${args.length} argument(s). Une transformation appel\xE9e de travers laisserait un param\xE8tre non substitu\xE9 dans l'arbre, sous la forme d'un terminal qui sonnerait.`,
        jetonDe(appel)
      );
    }
    const valeurs = /* @__PURE__ */ new Map();
    def.params.forEach((p, i) => {
      const v = args[i]?.value;
      if (!v || v.type !== "Literal" || typeof v.value !== "string" && typeof v.value !== "number") {
        throw new ParseError(
          `'${def.name}(\u2026)' : l'argument '${p}' n'est pas un terme. Un argument de transformation est un NOM (un terminal, une t\xEAte de r\xE8gle), \xE9crit nu.`,
          jetonDe(appel)
        );
      }
      valeurs.set(p, String(v.value));
    });
    const substituer = (n) => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) {
        n.forEach(substituer);
        return;
      }
      if (n.type === "Symbol" && valeurs.has(n.name)) {
        const brut = valeurs.get(n.name);
        const point = brut.indexOf(".");
        if (point > 0) {
          n.actor = brut.slice(0, point);
          n.name = brut.slice(point + 1);
        } else n.name = brut;
      }
      for (const v of Object.values(n)) substituer(v);
    };
    const corps = copieProfonde(def.body);
    substituer(corps);
    return corps;
  }
  function annotateScene(scene) {
    const flagStates = {};
    for (const v of scene.vars || []) {
      if (v?.varType?.kind === "flag") {
        const mm = flagStates[v.names[0]] || {};
        for (const s of v.varType.states) mm[s.name] = s.value;
        flagStates[v.names[0]] = mm;
      }
    }
    const criFlags = [];
    const resolveFlag = (flag, value, ou) => {
      if (!Object.prototype.hasOwnProperty.call(flagStates, flag)) {
        criFlags.push(
          `${ou} '[${flag}\u2026]' : le drapeau '${flag}' n'est pas d\xE9clar\xE9. Un drapeau porte sa valeur initiale \u2014 'flag ${flag}:0' \u2014 avant le d\xE9limiteur. Sans elle, une r\xE8gle qui s'y conditionne ne se d\xE9clenche jamais, et rien ne le dit.`
        );
        return value;
      }
      if (typeof value !== "string") return value;
      const etats = flagStates[flag];
      if (etats && Object.prototype.hasOwnProperty.call(etats, value)) return etats[value];
      if (Object.prototype.hasOwnProperty.call(flagStates, value)) return value;
      criFlags.push(
        `${ou} '[${flag}${ou === "mutation" ? "=" : "=="}${value}]' : '${value}' n'est pas le nom d'un drapeau d\xE9clar\xE9. Un drapeau se compare \xE0 un ENTIER \u2014 '[${flag}==<entier>]' \u2014 ou au nom d'un autre drapeau, qui doit alors \xEAtre d\xE9clar\xE9 lui aussi : 'flag ${value}:<entier>'.`
      );
      return value;
    };
    for (const sg of scene.subgrammars) {
      for (const rule of sg.rules) {
        const guards = Array.isArray(rule.guard) ? rule.guard : rule.guard ? [rule.guard] : [];
        for (const g of guards) {
          if (g && g.flag != null && "value" in g) g.value = resolveFlag(g.flag, g.value, "garde");
        }
        for (const f of rule.flags || []) {
          if (f && f.flag != null && "value" in f) f.value = resolveFlag(f.flag, f.value, "mutation");
        }
        annotateRhsElements(rule.rhs, null);
        if (rule.settings && typeof rule.settings === "object") {
          const { address, controls } = splitAddress(extractOccurrenceParams([rule.settings]));
          rule.settings.payload = {
            nature: "transport-control",
            containment: true,
            scope: "rule",
            ...controls ? { params: controls } : {},
            ...address ? { address } : {}
          };
        }
      }
    }
    if (criFlags.length) {
      throw new ParseError(
        criFlags.length === 1 ? criFlags[0] : `${criFlags.length} usages de drapeau ne d\xE9signent rien :
  \xB7 ${criFlags.join("\n  \xB7 ")}`,
        { line: 0, col: 0 }
      );
    }
  }
  function annotateRhsElements(elements, ruleActor) {
    let prevSounding = false;
    for (const el of elements) {
      if (el && el.type === "InstantControl" && el.conjoint && !prevSounding) {
        el.conjoint = false;
      }
      annotateRhsNode(el, ruleActor);
      if (el && (el.type === "Symbol" || el.type === "SymbolCall" || el.type === "OutTimeObject" || el.type === "TieStart" || el.type === "TieContinue" || el.type === "TieEnd" || el.type === "SimultaneousGroup" || el.type === "Polymetric")) {
        prevSounding = true;
      }
    }
  }
  function annotateRhsNode(el, ruleActor) {
    if (!el || typeof el !== "object") return;
    const type = el.type;
    if (type === "Symbol" || type === "SymbolCall" || type === "OutTimeObject" || type === "TieStart" || type === "TieContinue" || type === "TieEnd") {
      const actor = el.actor || ruleActor || void 0;
      let params = extractOccurrenceParams(el.suffixQualifiers);
      for (const sq of el.suffixQualifiers || []) {
        if (!sq || sq.type !== "SettingBag") continue;
        const { address: adrSq, controls: ctrlSq } = splitAddress(extractOccurrenceParams([sq]));
        sq.payload = {
          nature: "transport-control",
          containment: true,
          scope: "symbol",
          ...ctrlSq ? { params: ctrlSq } : {},
          ...adrSq ? { address: adrSq } : {}
        };
      }
      const argParams = extractSymbolCallParams(el);
      if (argParams !== null) params = { ...params || {}, ...argParams };
      const { address, controls } = splitAddress(params);
      const nomPorte = typeof el.symbol === "string" ? el.symbol : el.name;
      const estVariable = nomsVariables.has(nomPorte);
      el.payload = {
        nature: estVariable ? "var" : "sounding",
        ...actor !== void 0 ? { actor } : {},
        ...controls !== null ? { params: controls } : {},
        ...address !== null ? { address } : {},
        ...controls !== null || address !== null ? { occurrence: true } : {}
        // flux absent (override d'occurrence, pas de propagation)
      };
      return;
    }
    if (type === "Wait") {
      el.payload = { nature: "wait" };
      return;
    }
    if (type === "SymbolWithWait" && el.symbol) {
      annotateRhsNode(el.symbol, ruleActor);
      for (const t of el.triggers || []) annotateRhsNode(t, ruleActor);
      return;
    }
    if (type === "Rest" || type === "UndeterminedRest" || type === "NumericTerminal" || type === "NumericDuration") {
      el.payload = { nature: "rest" };
      return;
    }
    if (type === "Prolongation") {
      el.payload = { nature: "prolongation" };
      return;
    }
    if (type === "Control") {
      const isEngine = libCtx.bp3NativeControls && libCtx.bp3NativeControls.has(el.name);
      const nature = isEngine ? "engine-control" : "transport-control";
      el.payload = {
        nature,
        // flux:true pour un transport-control standalone (propagation de flux)
        ...nature === "transport-control" ? { flux: true } : {}
      };
      return;
    }
    if (type === "InstantControl") {
      if (el.qualifier && el.qualifier.type === "SettingBag") {
        const { address: adrF, controls: ctrlF } = splitAddress(extractOccurrenceParams([el.qualifier]));
        el.qualifier.payload = {
          nature: "transport-control",
          containment: false,
          scope: "flow",
          ...ctrlF ? { params: ctrlF } : {},
          ...adrF ? { address: adrF } : {}
        };
      }
      el.payload = {
        nature: "instant",
        flux: true,
        // se propage aux tokens suivants du même acteur
        // conjoint (collé `C4!(...)`) = ancré au terminal précédent, voyage avec lui (régime
        // structurel) ; non conjoint (espacé `C4 !(...)`) = événement séparé (régime séquentiel).
        // Présent seulement pour les `!(...)` runtime (qui portent ce flag) ; absent sinon.
        ...el.conjoint !== void 0 ? { conjoint: el.conjoint } : {}
      };
      return;
    }
    if (type === "Polymetric") {
      if (el.settings && typeof el.settings === "object") {
        const { address, controls } = splitAddress(extractOccurrenceParams([el.settings]));
        el.settings.payload = {
          nature: "transport-control",
          containment: true,
          scope: "group",
          ...controls ? { params: controls } : {},
          ...address ? { address } : {}
        };
      }
      for (const voice of el.voices || []) {
        annotateRhsElements(voice, ruleActor);
      }
      return;
    }
    if (type === "SimultaneousGroup") {
      if (el.primary) annotateRhsNode(el.primary, ruleActor);
      for (const s of el.secondaries || []) annotateRhsNode(s, ruleActor);
      return;
    }
    if (type === "TemplateMaster" || type === "TemplateSlave") {
      for (const sq of el.suffixQualifiers || []) {
        if (!sq || sq.type !== "SettingBag") continue;
        const { address, controls } = splitAddress(extractOccurrenceParams([sq]));
        sq.payload = {
          nature: "transport-control",
          containment: true,
          scope: "template",
          ...controls ? { params: controls } : {},
          ...address ? { address } : {}
        };
      }
      return;
    }
    if (type === "RawBrace" && el.settings && typeof el.settings === "object") {
      const { address, controls } = splitAddress(extractOccurrenceParams([el.settings]));
      el.settings.payload = {
        nature: "transport-control",
        containment: true,
        scope: "group",
        ...controls ? { params: controls } : {},
        ...address ? { address } : {}
      };
      return;
    }
  }
  function extractOccurrenceParams(suffixQualifiers) {
    if (!suffixQualifiers || suffixQualifiers.length === 0) return null;
    const params = {};
    let hasParams = false;
    for (const sq of suffixQualifiers) {
      if (sq.type !== "SettingBag") continue;
      for (const pair of sq.pairs || []) {
        params[pair.key] = pair.value;
        hasParams = true;
      }
    }
    return hasParams ? params : null;
  }
  function extractSymbolCallParams(el) {
    if (!el || el.type !== "SymbolCall" || !Array.isArray(el.args)) return null;
    const params = {};
    let hasParams = false;
    for (const arg of el.args) {
      if (!arg || !arg.key) continue;
      const v = arg.value;
      params[arg.key] = v && v.type === "Literal" ? v.value : v;
      hasParams = true;
    }
    return hasParams ? params : null;
  }
  function splitAddress(params) {
    if (!params) return { address: null, controls: null };
    const address = {};
    const controls = {};
    let hasA = false;
    let hasC = false;
    for (const [k, v] of Object.entries(params)) {
      if (addressKeys().has(k)) {
        address[k] = v;
        hasA = true;
      } else {
        controls[k] = v;
        hasC = true;
      }
    }
    return { address: hasA ? address : null, controls: hasC ? controls : null };
  }
  function lireNomATiretBas() {
    if (!at(T.PROLONG)) return null;
    const suite = peek(1);
    if (!suite || suite.type !== T.IDENT || suite.spaceBefore) return null;
    advance();
    return "_" + advance().value;
  }
  function parseDirectiveColonValue(dirName) {
    let value = null, runtime = null;
    if (dirName && universeIntervalControls().has(dirName)) {
      return { value: readIntervalLiteral(dirName), runtime: null };
    }
    let negative = false;
    if (at(T.REST)) {
      negative = true;
      advance();
    }
    if (at(T.INT)) {
      const num = advance().value;
      if (at(T.PLUS) && peek(1).type === T.INT) {
        let sections = `${negative ? "-" : ""}${num}`;
        while (at(T.PLUS) && peek(1).type === T.INT) {
          sections += advance().value;
          sections += advance().value;
        }
        if (at(T.SLASH) && peek(1).type === T.INT) {
          sections += advance().value;
          sections += advance().value;
        }
        return { value: sections, runtime: null };
      }
      if (at(T.SLASH) && peek(1).type === T.INT) {
        advance();
        const denom = advance().value;
        value = `${negative ? "-" : ""}${num}/${denom}`;
      } else {
        value = Number(`${negative ? "-" : ""}${num}`);
      }
    } else if (at(T.FLOAT)) {
      const raw = advance().value;
      value = raw;
    } else if (at(T.IDENT) || at(T.PROLONG) && peek(1)?.type === T.IDENT && !peek(1).spaceBefore) {
      const v = lireNomATiretBas() ?? advance().value;
      if (at(T.SLASH) && peek(1).type === T.INT) {
        advance();
        const denom = advance().value;
        value = `${v}/${denom}`;
      } else {
        runtime = v;
      }
    }
    if (!atEnd() && !current().spaceBefore && (at(T.IDENT) || at(T.INT) || at(T.FLOAT))) {
      const reste = current().value;
      const ecrit = value != null ? String(value) : runtime != null ? String(runtime) : "";
      throw new ParseError(
        `la valeur de '${dirName}' se lit '${ecrit}', et '${reste}' lui reste coll\xE9 sans s'y lire. Une valeur de directive est NUE : un nombre, un rapport ('3/4'), ou un nom. Retirer '${reste}' si c'est une unit\xE9 \u2014 aucune directive n'en porte \u2014 ou l'espacer si ce qui suit est autre chose.`,
        current()
      );
    }
    return { value, runtime };
  }
  function atProductionBlock() {
    return at(T.LBRACKET) && peek(1).type === T.AT;
  }
  function parseProductionBlock(dansLeFlux = false) {
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
      if (!dansLeFlux) {
        const ecrit = value !== null && value !== void 0 ? `:${value}` : runtime ? `:${runtime}` : "";
        throw new ParseError(
          `'[${name}${ecrit}]' : une directive de production s'\xE9crit en t\xEAte de sc\xE8ne, avant le d\xE9limiteur \u2014 '${name}${ecrit}'. Un bloc qui groupait plusieurs cl\xE9s se r\xE9\xE9crit en autant de lignes. Le crochet porte ce qui appartient \xE0 la D\xC9RIVATION : un drapeau, une proc\xE9dure, un rang.`,
          atTok
        );
      }
      if (name !== "seed") {
        throw new ParseError(
          `'![${name}\u2026]' : seul 'seed' a un sens dans le flux (re-semence _srand) ; '${name}' se pose en t\xEAte de sc\xE8ne, '${name}'.`,
          atTok
        );
      }
      dirs.push({
        type: "Directive",
        name,
        subkey: null,
        runtime,
        value,
        aliases: null,
        modifiers: null,
        line: atTok.line
      });
      if (at(T.COMMA)) {
        advance();
        continue;
      }
      break;
    }
    expect(T.RBRACKET);
    return dirs;
  }
  function lireDeclarationDeTerminal() {
    if (!at(T.IDENT) || peek(1).type !== T.COLON || peek(2).type !== T.IDENT) return null;
    const finDeLigne = peek(3).type === T.NEWLINE || peek(3).type === T.EOF || peek(3).type === T.COMMENT;
    if (!finDeLigne) return null;
    const tok = current();
    const nom = tok.value;
    const canal = peek(2).value;
    if (!outChannels().has(canal) || !writableChannels().has(canal)) return null;
    if (porteesDeclarees(nom) !== null || directiveDeclareeParLaLibrairie("core", nom)) return null;
    advance();
    advance();
    advance();
    return { type: "Declaration", name: nom, runtime: canal, line: tok.line };
  }
  function lireDeclarationParLeType() {
    if (!at(T.IDENT)) return null;
    const tok = current();
    const mot = tok.value;
    if (mot === "in" && peek(1).type === T.IDENT && !directiveDeclareeParLaLibrairie("core", "in")) {
      throw new ParseError(`'in ${peek(1).value}' est refus\xE9 \u2014 une entr\xE9e d\xE9clare son CANAL : 'in.<canal> ${peek(1).value}'. Les canaux d'entr\xE9e sont ${[...inChannels()].join(", ")}. Sans lui, aucun runtime n'est adress\xE9 et rien ne d\xE9clenche.`, tok);
    }
    if (mot === "in" && peek(1).type === T.PERIOD && !peek(1).spaceBefore && peek(2).type === T.IDENT) {
      advance();
      advance();
      const canal = expect(T.IDENT).value;
      if (at(T.LPAREN)) {
        throw new ParseError(`'in.${canal}(\u2026)' est refus\xE9 \u2014 une entr\xE9e ne porte AUCUN nom de port. Un nom de port vient du syst\xE8me et change de machine en machine ; la sc\xE8ne nomme un R\xD4LE, l'utilisateur associe l'appareil, et l'association vit hors de la sc\xE8ne.`, tok);
      }
      if (!inChannels().has(canal)) {
        throw new ParseError(`'${canal}' n'est pas une entr\xE9e \u2014 les canaux d'entr\xE9e sont ${[...inChannels()].join(", ")}. La liste est FERM\xC9E.`, tok);
      }
      if (!at(T.IDENT)) {
        throw new ParseError(`'in.${canal}' doit nommer le R\xD4LE que tient l'entr\xE9e \u2014 'in.${canal} <r\xF4le>'. Le type vient en t\xEAte, le nom ensuite.`, current());
      }
      const roleName = advance().value;
      let table = null;
      while (at(T.IDENT)) {
        const cle = advance().value;
        if (!at(T.PERIOD)) {
          throw new ParseError(`in.${canal} ${roleName} : '${cle}' doit APPELER un composant avec un point ('mapping.<table>') \u2014 le point APPELLE, les deux points AFFECTENT.`, tok);
        }
        advance();
        const valeur = expect(T.IDENT).value;
        if (cle === "mapping") {
          table = valeur;
        } else if (cle === "alphabet") {
          throw new ParseError(`in.${canal} ${roleName} : une entr\xE9e ne porte AUCUN alphabet. Il n'y a rien \xE0 r\xE9soudre en entr\xE9e \u2014 l'\xE9v\xE9nement est DISCRET, pas un signal \xE0 interpr\xE9ter. C'est la TABLE (mapping.<nom>) qui d\xE9clare le vocabulaire o\xF9 les \xE9tiquettes puisent, et elle le fait en librairie, pas dans la sc\xE8ne.`, tok);
        } else {
          throw new ParseError(`in.${canal} ${roleName} : propri\xE9t\xE9 '${cle}' inconnue \u2014 une entr\xE9e d\xE9clare son canal et, facultativement, sa table ('mapping.<table>'). Rien d'autre.`, tok);
        }
      }
      return { type: "InDirective", name: roleName, transport: canal, mapping: table, line: tok.line };
    }
    if (!typesDeclaratifs().has(mot) && !varConventions().has(mot) && !prototypesDeclares.has(mot)) {
      const finDeLigne = peek(2).type === T.NEWLINE || peek(2).type === T.EOF || peek(2).type === T.COMMENT;
      if (peek(1).type === T.IDENT && finDeLigne && !directiveDeclareeParLaLibrairie("core", mot) && porteesDeclarees(mot) === null) {
        throw new ParseError(`'${mot} ${peek(1).value}' : '${mot}' n'est pas un type. Un type en t\xEAte vient des conventions (${[...varConventions()].join(", ")}) ou des types de base (${[...typesDeclaratifs()].join(", ")}, in.<canal>).`, tok);
      }
      return null;
    }
    if (!ouvreUnNom(1)) {
      if (peek(1).type === T.NEWLINE || peek(1).type === T.EOF) {
        throw new ParseError(`'${mot}' doit nommer ce qu'il d\xE9clare \u2014 le type vient en t\xEAte, le nom ensuite ('${mot} <nom>').`, tok);
      }
      return null;
    }
    advance();
    const premier = lireNomDEntree(tok);
    if (mot === "flag") {
      if (!at(T.COLON)) {
        throw new ParseError(
          `flag ${premier} : un drapeau porte sa valeur initiale \u2014 'flag ${premier}:<entier>'. C'est la seule forme : ni le nom seul, ni des \xE9tats nomm\xE9s entre parenth\xE8ses. Un drapeau compte et se compare \xE0 des entiers.`,
          current()
        );
      }
      advance();
      if (!at(T.INT)) {
        throw new ParseError(
          `flag ${premier} : la valeur initiale est un ENTIER \u2014 'flag ${premier}:<entier>'. Un drapeau compte et se compare \xE0 des entiers.`,
          current()
        );
      }
      const initiale = Number(advance().value);
      return {
        type: "VarDirective",
        names: [premier],
        varType: { kind: "flag", states: [], initiale },
        line: tok.line
      };
    }
    if ((typesDeclaratifs().has(mot) || prototypesDeclares.has(mot)) && at(T.LPAREN)) {
      const sac = parseRuntimeQualifier();
      return {
        type: "VarDirective",
        names: [premier],
        varType: { kind: "type", type: mot },
        settings: sac,
        line: tok.line
      };
    }
    const lireDepart = (nom) => {
      if (!at(T.COLON)) return null;
      advance();
      const t = current();
      if (t.spaceBefore) {
        throw new ParseError(`${mot} ${nom}: une valeur de d\xE9part se COLLE \xE0 son signe \u2014 '${nom}:<valeur>', jamais '${nom}: <valeur>'. L'espace s\xE9pare deux termes, le collage les r\xE9unit.`, t);
      }
      if (at(T.INT) || at(T.FLOAT)) {
        advance();
        return Number(t.value);
      }
      if (at(T.IDENT)) {
        advance();
        return t.value;
      }
      const aTiretBas = lireNomATiretBas();
      if (aTiretBas !== null) return aTiretBas;
      throw new ParseError(`${mot} ${nom} : une valeur de d\xE9part se pose apr\xE8s ':' \u2014 un nombre ou un nom. Re\xE7u '${t.value ?? t.type}'.`, t);
    };
    const departs = [];
    const d0 = lireDepart(premier);
    if (d0 !== null) departs.push({ name: premier, value: d0 });
    if (varConventions().has(mot)) {
      const varType = { kind: "convention", convention: mot };
      const d = { type: "VarDirective", names: [premier], varType, line: tok.line };
      return departs.length ? { ...d, initial: departs } : d;
    }
    const noms = [premier];
    while (at(T.COMMA) && advance()) {
      const n = lireNomDEntree(tok);
      noms.push(n);
      const dn = lireDepart(n);
      if (dn !== null) departs.push({ name: n, value: dn });
    }
    const type = typesDeclaratifs().has(mot) || prototypesDeclares.has(mot) ? { kind: "type", type: mot } : null;
    const nu = { type: "VarDirective", names: noms, varType: type, line: tok.line };
    return departs.length ? { ...nu, initial: departs } : nu;
  }
  function parseDirective() {
    {
      const parLeType = lireDeclarationParLeType();
      if (parLeType) return parLeType;
      const unTerminal = lireDeclarationDeTerminal();
      if (unTerminal) return unTerminal;
    }
    const tok = current();
    if (at(T.AT)) {
      const apres = peek(1);
      throw new ParseError(
        `l'arobase est SORTIE du langage (decision Romain, hub/decisions/2026-08-17-factory-et-mine-sortent-du-langage.md) \u2014 ecrire '${apres && apres.value ? apres.value : "<directive>"}' sans elle. Ce qui qualifie une ligne est sa POSITION : avant le '-----' elle declare, apres elle produit.`,
        tok
      );
    }
    let name, subkey = null, directiveParams = null;
    if (at(T.PLUS)) {
      advance();
      name = "+";
    } else {
      name = lireNomDEntree(tok);
    }
    if (at(T.PERIOD)) {
      advance();
      subkey = lireNomDEntree(tok);
    }
    if (subkey && directiveDeclareeParLaLibrairie(name, subkey)) {
      name = subkey;
      subkey = null;
    }
    if (subkey && at(T.LPAREN) && !current().spaceBefore && actorKeysData().valides.has(name)) {
      advance();
      directiveParams = {};
      while (!at(T.RPAREN) && !atEnd()) {
        const pk = expect(T.IDENT).value;
        expect(T.COLON);
        directiveParams[pk] = at(T.INT) || at(T.FLOAT) ? Number(advance().value) : advance().value;
        if (at(T.COMMA)) advance();
      }
      expect(T.RPAREN);
    }
    let runtime = null, value = null, aliases = null;
    function autresNomsDeLaDirective(directive) {
      const noms = [];
      for (let j = pos; j < tokens.length - 1; j++) {
        if (tokens[j].type !== T.AT) continue;
        if (tokens[j + 1] && tokens[j + 1].value === directive && tokens[j + 2] && tokens[j + 2].type === T.IDENT) {
          noms.push(tokens[j + 2].value);
        }
      }
      return noms;
    }
    function refuserLeSigneEgal(directive, nom) {
      if (!at(T.EQUALS)) return;
      throw new ParseError(
        `${directive} ${nom} : le signe '=' est SUPPRIME de tout le langage (decision Romain 2026-07-27) \u2014 ecrire '${directive} ${nom} <valeur>' sans rien entre les deux.`,
        current()
      );
    }
    if (name === "def" || name === "terminal") {
      const motDeclarant = name;
      if (!ouvreUnNom()) {
        throw new ParseError(
          `'${motDeclarant}' doit nommer ce qu'il d\xE9finit : '${motDeclarant} <nom> <corps>'. Le nom vient d'abord, ce qu'il vaut ensuite \u2014 comme 'actor'. UN NOM COMMENCE PAR UNE LETTRE, ou par un chiffre s'il porte au moins une lettre : 'western', 'a_b', '12TET' en sont ; '12', '_ab', '#a', '-ab' et '"ab"' n'en sont pas. Re\xE7u : ${JSON.stringify(String(current().value ?? current().type))}.`,
          tok
        );
      }
      const defName = lireNomDEntree(tok);
      const apresLeNom = current();
      const clesParenthesees = motDeclarant === "terminal" && at(T.LPAREN);
      if (clesParenthesees) advance();
      refuserLeSigneEgal("def", defName);
      const cles = {};
      let lu = 0;
      const lireUneCle = (dansUnBloc = false) => {
        const kTok = current();
        const cle = expect(T.IDENT).value;
        if (at(T.PERIOD) && !current().spaceBefore) {
          advance();
          if (!at(T.IDENT)) throw new ParseError(`'def ${defName}' : nom attendu apr\xE8s '${cle}.'`, current());
          let val = String(advance().value);
          while ((at(T.IDENT) || at(T.INT)) && !current().spaceBefore) val += String(advance().value);
          if (at(T.PERIOD) && !current().spaceBefore) {
            const suite = peek(1);
            const interne = suite && suite.value != null ? String(suite.value) : null;
            throw new ParseError(
              `'${cle}.${val}${interne ? `.${interne}` : ""}\u2026' adresse un catalogue par DEUX niveaux \u2014 un seul s'\xE9crit. Le point appelle une ENTR\xC9E, jamais la structure qui la range : \xE9crire '${cle}.${interne ?? "<entr\xE9e>"}' si '${interne ?? "\u2026"}' est l'entr\xE9e voulue, ou '${cle}.${val}' si c'est '${val}'.`,
              kTok
            );
          }
          cles[cle] = { kind: "ref", value: val };
          lu++;
          return;
        }
        if (at(T.COLON) && !current().spaceBefore) {
          advance();
          if (atEnd() || at(T.NEWLINE)) throw new ParseError(`'def ${defName}' : valeur attendue apr\xE8s '${cle}:'`, current());
          const ouvreUneCle = () => at(T.IDENT) && current().spaceBefore && (!dansUnBloc || peek(1).type === T.COLON || peek(1).type === T.PERIOD);
          const borneDuCorps = () => clesParenthesees && (at(T.RPAREN) || at(T.COMMA));
          const PARTIE = /* @__PURE__ */ new Set([
            T.IDENT,
            T.INT,
            T.FLOAT,
            T.STRING,
            T.SLASH,
            T.PERIOD,
            T.REST,
            T.PROLONG,
            T.HASH,
            T.PLUS,
            T.BACKTICK
          ]);
          const parties = [];
          let courante = "";
          while (!atEnd() && !at(T.NEWLINE) && !at(T.COMMENT) && !ouvreUneCle() && !borneDuCorps()) {
            if (current().type === T.BACKTICK && (parties.length || courante !== "")) {
              throw new ParseError(
                `'def ${defName}' : du code typ\xE9 ne peut pas suivre une autre partie dans la valeur de '${cle}'. Le code typ\xE9 EST la valeur \u2014 \xE9cris-le seul apr\xE8s le deux-points.`,
                current()
              );
            }
            if (!PARTIE.has(current().type)) {
              throw new ParseError(
                `'def ${defName}' : '${current().value ?? current().type}' n'est pas lisible dans la valeur de '${cle}'. Une valeur est faite de MOTS \u2014 un nom, un nombre, un texte entre guillemets, un rapport \u2014 et l'espace en s\xE9pare les parties. Ce signe ouvre une structure, et une structure ne se pose pas dans une valeur : \xE9cris-la dans le corps entre parenth\xE8ses de la d\xE9claration.`,
                current()
              );
            }
            if (courante !== "" && current().spaceBefore) {
              parties.push(courante);
              courante = "";
            }
            courante += String(advance().value);
          }
          if (courante !== "") parties.push(courante);
          cles[cle] = { kind: "value", value: parties.length === 1 ? parties[0] : parties };
          lu++;
          return;
        }
        throw new ParseError(
          `'def ${defName}' : '${cle}' n'est ni un appel de composant ni une affectation. Une cl\xE9 de terminal s'\xE9crit '${cle}.<nom>' pour appeler un composant, ou '${cle}:<valeur>' pour affecter une valeur \u2014 le point appelle, le deux-points affecte.`,
          kTok
        );
      };
      if (at(T.BACKTICK)) {
        const bt = current();
        const brut = expect(T.BACKTICK).value;
        const { tag, code } = splitBacktickTag(brut);
        return {
          type: "DefDirective",
          name: defName,
          kind: "code",
          convention: null,
          tag,
          code,
          line: tok.line
        };
      }
      if (at(T.IDENT) && varConventions().has(current().value) && peek(1) && peek(1).type === T.BACKTICK) {
        const convention = advance().value;
        const bt = current();
        const brut = expect(T.BACKTICK).value;
        const { tag, code } = splitBacktickTag(brut);
        return {
          type: "DefDirective",
          name: defName,
          kind: "code",
          convention,
          tag,
          code,
          line: tok.line
        };
      }
      if (at(T.LPAREN) && !current().spaceBefore) {
        advance();
        const params = [];
        while (!at(T.RPAREN) && !atEnd()) {
          while (at(T.NEWLINE) || at(T.COMMENT)) advance();
          if (at(T.RPAREN) || atEnd()) break;
          if (at(T.IDENT)) params.push(advance().value);
          else if (at(T.COMMA)) advance();
          else {
            throw new ParseError(
              `'def ${defName}(\u2026)' : la liste de parametres ne porte que des NOMS, separes par des virgules \u2014 recu '${current().value}'.`,
              current()
            );
          }
        }
        expect(T.RPAREN);
        if (params.length === 0) {
          throw new ParseError(
            `'def ${defName}()' : une liste de parametres VIDE ne parametre rien. Ecrire 'def ${defName} <corps>' sans parenthese collee, ou nommer au moins un parametre.`,
            tok
          );
        }
        const corps = parseRhsElements();
        if (corps.length === 0) {
          throw new ParseError(
            `'def ${defName}(${params.join(", ")})' : transformation sans corps. Ce que la definition FAIT de ses parametres s ecrit apres eux.`,
            tok
          );
        }
        return {
          type: "DefDirective",
          name: defName,
          kind: "transformation",
          params,
          body: corps,
          line: tok.line
        };
      }
      if (at(T.LPAREN)) {
        const sac = parseRuntimeQualifier();
        return {
          type: "DefDirective",
          name: defName,
          kind: "prereglage",
          settings: sac,
          line: tok.line
        };
      }
      const cleEnTete = () => {
        if (!at(T.IDENT)) return false;
        const apres = peek(1);
        return !!apres && (apres.type === T.PERIOD || apres.type === T.COLON) && !apres.spaceBefore;
      };
      if (motDeclarant === "terminal" && at(T.IDENT) && !cleEnTete()) {
        throw new ParseError(
          `'terminal ${defName}' : un terminal se d\xE9clare par ses CL\xC9S \u2014 'voice.<nom>', 'hz:<n>', 'degree:<n>', 'register:<n>', 'sounding:<vrai|faux>', 'duration:<n>', 'tuning.<nom>', 'octaves.<nom>'. Une suite de termes est une STRUCTURE, et elle s'\xE9crit 'def ${defName} <termes>'.`,
          current()
        );
      }
      if (at(T.IDENT) && !cleEnTete()) {
        const corps = parseRhsElements();
        if (corps.length === 0) {
          throw new ParseError(
            `'def ${defName}' : structure vide. Un nom qui ne vaut rien ne se r\xE9invoque pas.`,
            tok
          );
        }
        const backtick = corps.find((e) => e && typeof e.type === "string" && e.type.includes("Backtick"));
        if (backtick) {
          throw new ParseError(
            `'def ${defName}' porte du CODE, pas une structure \u2014 ce palier lit \xAB un nom vaut une suite de termes \xBB ('def cadence sa re ga pa'). Le corps de code typ\xE9 ('def ${defName} <type> \`langage: \u2026\`', types 'signal', 'pitch', 'phase', 'logic') n'est PAS encore lu ; il refuse ici plut\xF4t que d'\xEAtre lu de travers \u2014 sans quoi le type deviendrait un terminal et le code un \xE9l\xE9ment voisin.`,
            tok
          );
        }
        return { type: "DefDirective", name: defName, kind: "structure", body: corps, line: tok.line };
      }
      while (at(T.IDENT)) {
        lireUneCle();
        if (clesParenthesees && at(T.COMMA)) advance();
      }
      if (clesParenthesees) {
        if (!at(T.RPAREN)) {
          throw new ParseError(
            `'terminal ${defName}' : le corps ouvert par '(' n'est pas referm\xE9 \u2014 il manque ')'.`,
            current()
          );
        }
        advance();
      }
      while (at(T.NEWLINE) || at(T.COMMENT)) {
        let j = pos;
        while (tokens[j] && (tokens[j].type === T.NEWLINE || tokens[j].type === T.COMMENT)) j++;
        const suivant = tokens[j];
        if (!suivant || suivant.type !== T.IDENT || !(suivant.col > 1)) break;
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        lireUneCle(true);
      }
      if (lu === 0) {
        throw new ParseError(
          // ⚠️ LE NOM CITÉ EST CELUI QUI A ÉTÉ LU, pas celui qui a été écrit. Quand un signe COLLÉ
          // l'a arrêté, le message doit le dire avant tout le reste : sans ça, l'auteur relit sa
          // ligne, y voit son nom entier, et cherche la faute dans le corps.
          `${apresLeNom && apresLeNom.spaceBefore === false && apresLeNom.type !== T.EOF ? `le nom lu s'arr\xEAte \xE0 '${defName}' : le signe ${JSON.stringify(String(apresLeNom.value ?? apresLeNom.type))} qui le suit n'entre pas dans un nom, et ce qui reste ne se lit comme aucun corps. ` : ""}'${motDeclarant} ${defName}' ne d\xE9clare rien. Ce palier lit DEUX corps : la D\xC9CLARATION DE TERMINAL \u2014 un nom puis ses cl\xE9s, sur la m\xEAme ligne ('def ${defName}  voice.sec') ou dans un bloc indent\xE9, une cl\xE9 par ligne \u2014 et la STRUCTURE, un nom qui vaut une suite de termes ('def ${defName} sa re ga pa'). Les autres corps que la sp\xE9cification d\xE9crit \u2014 un branchement, du code typ\xE9, un pr\xE9r\xE9glage, une transformation param\xE9tr\xE9e ou structurelle \u2014 ne sont PAS encore lus ; ils le seront, et d'ici l\xE0 ils refusent ici plut\xF4t que d'\xEAtre lus de travers.`,
          tok
        );
      }
      return { type: "DefDirective", name: defName, kind: "terminal", keys: cles, line: tok.line };
    }
    if (name === "init") {
      const entrees = [];
      while (!atEnd()) {
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        if (atEnd()) break;
        if (at(T.BACKTICK)) {
          const tok2 = current();
          const t = splitBacktickTag(advance().value);
          entrees.push({ type: "BacktickOrphan", tag: t.tag, code: t.code, line: tok2.line });
          continue;
        }
        if (at(T.BANG) || at(T.LPAREN)) {
          if (at(T.BANG)) advance();
          entrees.push(parseRuntimeQualifier());
          continue;
        }
        break;
      }
      return { type: "InitDirective", entrees, line: tok.line };
    }
    if (name === "actor") {
      let actorName = lireNomDEntree(tok);
      while (at(T.PERIOD) && !current().spaceBefore && peek(1).type === T.IDENT) {
        advance();
        actorName += `.${advance().value}`;
      }
      const corpsParenthese = at(T.LPAREN);
      if (corpsParenthese) advance();
      const properties = {};
      const soundAssignments = [];
      const parseRefParams = () => {
        expect(T.LPAREN);
        const params = {};
        while (!at(T.RPAREN) && !atEnd()) {
          while (at(T.NEWLINE) || at(T.COMMENT)) advance();
          if (at(T.RPAREN) || atEnd()) break;
          const paramKey = expect(T.IDENT).value;
          expect(T.COLON);
          let paramVal;
          if (at(T.INT) || at(T.FLOAT)) {
            paramVal = Number(advance().value);
          } else {
            let brut = "";
            while (!atEnd() && !at(T.COMMA) && !at(T.RPAREN) && !at(T.NEWLINE)) {
              brut += advance().value;
            }
            if (brut === "") throw new ParseError(`valeur attendue apr\xE8s '${paramKey}:'`, current());
            paramVal = brut;
          }
          params[paramKey] = paramVal;
          if (at(T.COMMA)) advance();
        }
        expect(T.RPAREN);
        return params;
      };
      const setEntityRef = (key, value2, params, tokenDeLaCle) => {
        if (key === "out") {
          properties.transport = { type: "TransportRef", key: value2, params: params || {} };
        } else {
          properties[key] = value2;
          if (params) (properties.entityParams || (properties.entityParams = {}))[key] = params;
        }
      };
      while (!atEnd()) {
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        if (corpsParenthese && at(T.RPAREN)) break;
        if (corpsParenthese && at(T.COMMA)) {
          advance();
          continue;
        }
        if (at(T.STAR) && peek(1).type === T.COLON) {
          advance();
          advance();
          const target = parseSoundAssignmentTarget();
          soundAssignments.push({
            type: "SoundAssignment",
            scope: "actor",
            actor: actorName,
            subject: "*",
            target,
            line: tok.line
          });
          continue;
        }
        if (at(T.AT) && peek(1).type === T.IDENT && peek(1).value === "alphabet" && peek(2).type === T.PERIOD && !peek(2).spaceBefore) {
          advance();
          advance();
          advance();
          properties.alphabet = expect(T.IDENT).value;
          continue;
        }
        if (!corpsParenthese && at(T.IDENT) && current().col === 1 && current().line > tok.line) break;
        if (!at(T.IDENT)) break;
        const key = current().value;
        const next = peek(1).type;
        if (key === "transport" && (next === T.PERIOD || next === T.COLON) && !peek(1).spaceBefore) {
          throw new ParseError(
            `acteur '${actorName}' : cette cl\xE9 n'existe pas. La direction de sortie s'\xE9crit 'out.<canal>' \u2014 par exemple 'out.audio' ou 'out.midi(ch:3)'.`,
            current()
          );
        }
        if (next === T.PERIOD && !peek(1).spaceBefore) {
          if (!actorKeysData().valides.has(key)) {
            let k = 0, estRegle = false;
            while (peek(k) && peek(k).type !== T.NEWLINE && peek(k).type !== T.EOF) {
              const t = peek(k).type;
              if (t === T.ARROW_R || t === T.ARROW_L || t === T.ARROW_BI) {
                estRegle = true;
                break;
              }
              k++;
            }
            if (estRegle) break;
            const perimee = actorKeysData().perimees.has(key);
            const ou = key === "voice" ? ` \u2014 une voix s'attache au TERMINAL, pas \xE0 l'acteur` : key === "sound" || key === "sounds" ? ` \u2014 un prototype d'objet sonore vit en librairie, il ne se pose pas sur l'acteur` : "";
            throw new ParseError(
              `'${key}.\u2026' n'est pas une cl\xE9 d'acteur${perimee ? " (retir\xE9e le 2026-08-06)" : ""}${ou}. Les cl\xE9s d'un acteur sont : ${[...actorKeysData().valides].join(", ")}`,
              current()
            );
          }
          const jetonDeLaCle = current();
          advance();
          advance();
          const value2 = expect(T.IDENT).value;
          let params = null;
          if (at(T.LPAREN) && !current().spaceBefore) params = parseRefParams();
          setEntityRef(key, value2, params, jetonDeLaCle);
          continue;
        }
        if (next === T.COLON && !peek(1).spaceBefore) {
          const t3 = peek(2);
          const t4 = peek(3);
          const isSubjectSoundAssign = t3.type === T.IDENT && t3.value === "sound" && t4.type === T.PERIOD || t3.type === T.LBRACE;
          if (isSubjectSoundAssign) {
            const subject = advance().value;
            advance();
            const target = parseSoundAssignmentTarget();
            soundAssignments.push({
              type: "SoundAssignment",
              scope: "actor",
              actor: actorName,
              subject,
              target,
              line: tok.line
            });
            continue;
          }
          if (actorKeysData().toutes.has(key)) {
            const canon = key === "sounds" ? "sound" : key;
            throw new ParseError(
              `'${key}:\u2026' refus\xE9 \u2014 ':' n'affecte pas de valeur \xE0 un composant. \xC9cris '${canon}.<nom>'` + (key === "out" ? " avec ses params entre () \u2014 ex. out.midi(ch:3)" : "") + ` (r\xE8gle : '.' APPELLE le composant, ':' AFFECTE une valeur).`,
              current()
            );
          }
          advance();
          advance();
          if (at(T.IDENT)) {
            const value2 = advance().value;
            let params = null;
            if (at(T.LPAREN) && !current().spaceBefore) params = parseRefParams();
            const canonicalKey = key === "sounds" ? "sound" : key;
            setEntityRef(canonicalKey, value2, params, tok);
            continue;
          }
          if (at(T.INT)) {
            properties[key] = Number(advance().value);
            continue;
          }
          if (at(T.FLOAT)) {
            properties[key] = Number(advance().value);
            continue;
          }
          break;
        }
        break;
      }
      if (corpsParenthese && !at(T.RPAREN)) {
        throw new ParseError(
          `acteur '${actorName}' : le corps ouvert par '(' n'est pas referm\xE9 \u2014 il manque ')'.`,
          current()
        );
      }
      if (corpsParenthese) advance();
      if (properties.eval && properties.transport) {
        throw new ParseError(
          `acteur '${actorName}' : un producteur 'eval.${properties.eval}' sort en natif \u2014 pas de 'out' (il produit et sort par ses propres moyens ; on ne route pas sa sortie native). Retire le 'out' de cet acteur.`,
          tok
        );
      }
      if (properties.transport && (properties.transport.key === "video" || properties.transport.key === "visual")) {
        throw new ParseError(
          `acteur '${actorName}' : 'out.${properties.transport.key}' n'existe pas \u2014 le canal visuel a \xE9t\xE9 SUPPRIM\xC9 (les visuels embarqu\xE9s sortent en natif sur leur canvas). Canal de sortie = audio/midi/osc uniquement.`,
          tok
        );
      }
      if (properties.transport && deprecatedTransports().has(properties.transport.key)) {
        throw new ParseError(
          `acteur '${actorName}' : 'out.${properties.transport.key}' est un canal P\xC9RIM\xC9 (mod\xE8le profils d'environnement abandonn\xE9 2026-07-16). \xC9cris 'out.audio' (canal canonique : audio/midi/osc).`,
          tok
        );
      }
      if (properties.transport && !outChannels().has(properties.transport.key)) {
        throw new ParseError(
          `acteur '${actorName}' : '${properties.transport.key}' n'est pas une sortie \u2014 les canaux de sortie sont ${[...outChannels()].join(", ")}. La liste est FERM\xC9E.`,
          tok
        );
      }
      if (properties.transport && outChannels().has(properties.transport.key) && !writableChannels().has(properties.transport.key)) {
        throw new ParseError(
          `acteur '${actorName}' : 'out.${properties.transport.key}' est refus\xE9 \u2014 ce canal est une DESTINATION de l'architecture, rout\xE9e comme les autres sorties, mais son \xC9CRITURE dans une sc\xE8ne attend encore son appareil d\xE9di\xE9.`,
          tok
        );
      }
      if (properties.voice) assertVoiceRef(properties.voice, `acteur '${actorName}'`, tok);
      if (properties.alphabet) assertAlphabetVoices(properties.alphabet, tok);
      const references = [];
      const addRef = (category, name2, params) => {
        if (name2 == null) return;
        const r = { type: "ActorReference", category, name: name2, line: tok.line };
        if (params && Object.keys(params).length > 0) r.params = params;
        references.push(r);
      };
      addRef("alphabet", properties.alphabet);
      addRef("tuning", properties.tuning);
      addRef("octaves", properties.octaves);
      addRef("voice", properties.voice);
      if (properties.transport) addRef("transport", properties.transport.key, properties.transport.params);
      addRef("eval", properties.eval);
      return {
        type: "ActorDirective",
        name: actorName,
        properties,
        references,
        soundAssignments: soundAssignments.length > 0 ? soundAssignments : null,
        line: tok.line
      };
    }
    if (name === "sound" && !subkey && at(T.COLON) && peek(1).type === T.IDENT && (describeVocabulary().components.sound || []).includes(peek(1).value)) {
      throw new ParseError(
        `'sound:<X>' refus\xE9 \u2014 ':' n'affecte pas de valeur \xE0 un composant. \xC9cris 'sound.<nom>' (r\xE8gle : ':' affecte, '.' appelle).`,
        tok
      );
    }
    if (name === "sound") {
      let libVariant = null;
      if (subkey && at(T.COLON)) {
        advance();
        libVariant = expect(T.IDENT).value;
      }
      return parseSoundSection(tok.line, subkey, libVariant);
    }
    if (name === "timepatterns" && at(T.COLON)) {
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
      return {
        type: "Directive",
        name,
        subkey,
        runtime: null,
        value: null,
        aliases: null,
        modifiers: null,
        timePatterns: patterns,
        line: tok.line
      };
    }
    if (catalogAxisKeys().has(name) && !subkey && at(T.COLON)) {
      const hint = name === "tuning" ? " ; fr\xE9quence de r\xE9f\xE9rence \u2192 'diapason:<N>'" : "";
      throw new ParseError(
        `'${name}:<X>' refus\xE9 \u2014 ':' n'affecte pas de valeur \xE0 un composant. \xC9cris '${name}.<nom>' (r\xE8gle : ':' affecte, '.' appelle)${hint}.`,
        current()
      );
    }
    if (at(T.COLON)) {
      advance();
      ({ value, runtime } = parseDirectiveColonValue(name));
    }
    if (name === "alphabet" && subkey && runtime && !outChannels().has(runtime)) {
      const hint = deprecatedTransports().has(runtime) ? ` '${runtime}' est un canal P\xC9RIM\xC9 (mod\xE8le profils d'environnement abandonn\xE9 2026-07-16) \u2014 \xE9cris 'alphabet.${subkey}:audio'.` : runtime === "sc" ? ` L'ancien sucre ':sc' (= transport+eval sc) est ABOLI \u2014 un eval se d\xE9clare sur un actor ('eval.<X>') ; le raccord de l'acteur implicite ne nomme qu'un canal.` : "";
      throw new ParseError(
        `'alphabet.${subkey}:${runtime}' refus\xE9 \u2014 le raccord de sortie de l'acteur implicite n'accepte que {audio, midi, osc} (liste positive ferm\xE9e, d\xE9cision 2026-07-16).${hint}`,
        current()
      );
    }
    if (name === "alphabet" && subkey && runtime && outChannels().has(runtime) && !writableChannels().has(runtime)) {
      throw new ParseError(
        `'alphabet.${subkey}:${runtime}' refus\xE9 \u2014 ce canal est une DESTINATION de l'architecture, rout\xE9e comme les autres sorties, mais son \xC9CRITURE dans une sc\xE8ne attend encore son appareil d\xE9di\xE9.`,
        current()
      );
    }
    if (name === "alphabet" && subkey) assertAlphabetVoices(subkey, current());
    let modifiers = null;
    if (name === "mode" && at(T.LPAREN)) {
      advance();
      modifiers = [];
      while (!at(T.RPAREN) && !atEnd()) {
        const tokModName = current();
        const modName = expect(T.IDENT).value;
        const portees = porteesDeclarees(modName);
        if (!portees) {
          throw new ParseError(
            `'mode:${runtime || "\u2026"}(${modName})' : '${modName}' n'est d\xE9clar\xE9 par aucune librairie charg\xE9e. Un modificateur de sous-grammaire est un mot de librairie comme un autre \u2014 invoquer celle qui le porte, ou retirer le mot.`,
            tokModName
          );
        }
        if (!portees.includes("subgrammar")) {
          throw new ParseError(
            `'${modName}' ne se pose pas sur une sous-grammaire \u2014 sa port\xE9e d\xE9clar\xE9e est ${JSON.stringify(portees)}. ${portees.includes("scene") ? `Il s'\xE9crit en t\xEAte de sc\xE8ne : '${modName}'.` : `Il vaut ${portees.map((p) => `'${p}'`).join(", ")}.`}`,
            tokModName
          );
        }
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
      advance();
      aliases = [];
      while (!at(T.RPAREN) && !atEnd()) {
        const from = expect(T.IDENT).value;
        expect(T.COLON);
        const to = expect(T.IDENT).value;
        aliases.push({ type: "Alias", from, to });
        if (at(T.COMMA)) advance();
      }
      expect(T.RPAREN);
    }
    if (name === "alphabet" && subkey) {
      const assignments = [];
      while (!atEnd()) {
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        if (at(T.STAR) && peek(1).type === T.COLON) {
          const line = current().line;
          advance();
          advance();
          const target = parseSoundAssignmentTarget();
          assignments.push({
            type: "SoundAssignment",
            scope: "alphabet",
            alphabet: subkey,
            subject: "*",
            target,
            line
          });
          continue;
        }
        if (at(T.IDENT) && peek(1).type === T.COLON) {
          const t3 = peek(2);
          const t4 = peek(3);
          const isSoundAssign = t3.type === T.IDENT && t3.value === "sound" && t4.type === T.PERIOD || t3.type === T.LBRACE;
          if (isSoundAssign) {
            const line = current().line;
            const subject = advance().value;
            advance();
            const target = parseSoundAssignmentTarget();
            assignments.push({
              type: "SoundAssignment",
              scope: "alphabet",
              alphabet: subkey,
              subject,
              target,
              line
            });
            continue;
          }
          if (current().value === "notes") {
            advance();
            advance();
            while (at(T.IDENT)) advance();
            continue;
          }
        }
        break;
      }
      refuserCanalDeSortieInconnu(name, subkey, tok);
      refuserModeInvalide(name, runtime, value, tok);
      const dirNode = {
        type: "Directive",
        name,
        subkey,
        runtime,
        value,
        aliases,
        modifiers,
        ...directiveParams ? { params: directiveParams } : {},
        line: tok.line
      };
      if (assignments.length > 0) {
        return {
          type: "AlphabetSoundAssignments",
          directive: dirNode,
          assignments,
          line: tok.line
        };
      }
      return dirNode;
    }
    refuserCanalDeSortieInconnu(name, subkey, tok);
    refuserModeInvalide(name, runtime, value, tok);
    return {
      type: "Directive",
      name,
      subkey,
      runtime,
      value,
      aliases,
      modifiers,
      ...directiveParams ? { params: directiveParams } : {},
      line: tok.line
    };
  }
  function lireValeurDeMembre() {
    if (at(T.BACKTICK)) {
      const raw = advance().value;
      const t = tryBacktickTag(raw);
      return t ? { kind: "backtick", tag: t.tag, code: t.code } : { kind: "backtick", tag: null, code: raw };
    }
    if (at(T.INT)) {
      const n = Number(advance().value);
      if (at(T.IDENT) && !current().spaceBefore) return { kind: "number", value: n, unit: advance().value };
      return { kind: "number", value: n };
    }
    if (at(T.IDENT)) return { kind: "ref", name: advance().value };
    throw new ParseError("valeur attendue apr\xE8s \xAB : \xBB", current());
  }
  function isLookaheadMacro() {
    let j = pos;
    if (tokens[j]?.type !== T.IDENT) return false;
    j++;
    if (tokens[j]?.type !== T.LPAREN) return false;
    let depth = 1;
    j++;
    while (j < tokens.length && depth > 0) {
      if (tokens[j].type === T.LPAREN) depth++;
      if (tokens[j].type === T.RPAREN) depth--;
      j++;
    }
    return tokens[j]?.type === T.EQUALS;
  }
  function macroBodyMentions(body) {
    const names = /* @__PURE__ */ new Set();
    const walk = (n) => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) {
        for (const el of n) walk(el);
        return;
      }
      for (const key of ["name", "symbol", "actor", "tag"]) {
        if (typeof n[key] === "string") names.add(n[key]);
      }
      if (n.type === "Literal" && typeof n.value === "string") names.add(n.value);
      if (typeof n.code === "string") {
        for (const w of n.code.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []) names.add(w);
      }
      for (const k in n) {
        if (n[k] && typeof n[k] === "object") walk(n[k]);
      }
    };
    walk(body);
    return names;
  }
  function checkMacroParamsUsed(macroName, params, body, tok) {
    if (!params || params.length === 0) return;
    const used = macroBodyMentions(body);
    const unused = params.filter((p) => !used.has(p));
    if (unused.length > 0) {
      throw new ParseError(
        `Macro '${macroName}' : param\xE8tre(s) d\xE9clar\xE9(s) mais absent(s) du corps : ${unused.join(", ")}. Une macro est une substitution textuelle (EBNF \xA7macro l.59/273) \u2014 chaque param\xE8tre DOIT appara\xEEtre dans le corps (ex. accent(x) = x(vel:120)). Une d\xE9claration name(cible, transport) = courbe (forme CV/signal) n'est pas une macro valide : syntaxe en attente d'arbitrage.`,
        tok
      );
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
    return { type: "Macro", name, params, body, line: tok.line };
  }
  function tryBacktickTag(raw) {
    const colonIdx = raw.indexOf(":");
    const tag = colonIdx > 0 ? raw.slice(0, colonIdx).trim() : "";
    if (!/^[A-Za-z][\w+-]*$/.test(tag)) return null;
    return { tag, code: raw.slice(colonIdx + 1).trim() };
  }
  function splitBacktickTag(raw) {
    return tryBacktickTag(raw) || { tag: null, code: raw.trim() };
  }
  function parseBacktickOrphan() {
    const tok = current();
    const raw = expect(T.BACKTICK).value;
    const { tag, code } = splitBacktickTag(raw);
    return { type: "BacktickOrphan", tag, code, line: tok.line };
  }
  function parsePropPairs() {
    const props = {};
    while (!at(T.RBRACE) && !atEnd()) {
      if (at(T.NEWLINE) || at(T.COMMENT)) {
        advance();
        continue;
      }
      if (at(T.COMMA)) {
        advance();
        continue;
      }
      const key = expect(T.IDENT).value;
      if (!at(T.COLON)) {
        props[key] = true;
        continue;
      }
      advance();
      let val;
      if (at(T.REST)) {
        advance();
        if (at(T.INT)) val = -Number(advance().value);
        else if (at(T.FLOAT)) val = -Number(advance().value);
        else throw new ParseError("Expected number after - in prop value", current());
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
        if (id === "true") val = true;
        else if (id === "false") val = false;
        else val = id;
      } else {
        throw new ParseError("Expected value (INT/FLOAT/STRING/IDENT) in prop pair", current());
      }
      props[key] = val;
    }
    return props;
  }
  function parseSoundAssignmentTarget() {
    if (at(T.LBRACE)) {
      advance();
      const props = parsePropPairs();
      expect(T.RBRACE);
      return { kind: "inline-props", props };
    }
    const first = expect(T.IDENT).value;
    if (first === "sound" && at(T.PERIOD)) {
      advance();
      const name = expect(T.IDENT).value;
      return { kind: "named-ref", name };
    }
    return { kind: "named-ref", name: first };
  }
  function parseSoundSection(line, lib, libVariant) {
    const prototypes = [];
    while (at(T.NEWLINE) || at(T.COMMENT)) advance();
    while (!atEnd()) {
      if (at(T.LBRACE)) {
        advance();
        const config = parsePropPairs();
        expect(T.RBRACE);
        prototypes.push({ type: "SoundPrototype", name: null, config, line });
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        continue;
      }
      if (at(T.IDENT) && peek(1).type === T.LBRACE) {
        const protoName = advance().value;
        advance();
        const config = parsePropPairs();
        expect(T.RBRACE);
        prototypes.push({ type: "SoundPrototype", name: protoName, config, line });
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        continue;
      }
      break;
    }
    return {
      type: "SoundSection",
      lib: lib || null,
      libVariant: libVariant || null,
      prototypes,
      line
    };
  }
  function parseSoundAssignmentLocal(line) {
    let subject;
    if (at(T.STAR)) {
      advance();
      subject = "*";
    } else subject = expect(T.IDENT).value;
    expect(T.COLON);
    const target = parseSoundAssignmentTarget();
    return { type: "SoundAssignment", subject, target, line };
  }
  function parseSubgrammars(initialMode, initialModifiers) {
    const subs = [];
    let index = 1;
    let safety = 0;
    let currentMode = initialMode || null;
    let currentModifiers = initialModifiers || null;
    while (!atEnd()) {
      if (++safety > 200) throw new ParseError("Subgrammar parse loop safety limit", current());
      skipNewlines();
      if (atEnd()) break;
      if (atProductionBlock()) {
        throw new ParseError(`Bloc de production [@\u2026] : autoris\xE9 en en-t\xEAte de sc\xE8ne uniquement`, current());
      }
      if (at(T.BANG) && peek(1).type === T.LBRACKET && peek(2).type === T.AT) {
        throw new ParseError(`Forme '![@\u2026]' r\xE9serv\xE9e (directive de production dans le flux) \u2014 non impl\xE9ment\xE9e`, current());
      }
      let blockMode = currentMode;
      let blockModifiers = currentModifiers;
      while (!atEnd() && !at(T.SEPARATOR) && !at(T.NEWLINE) && ligneSansFleche()) {
        if (at(T.IDENT) && current().value === "template") break;
        if (at(T.IDENT) && current().value === "templates") {
          throw new ParseError(`'templates' (pluriel, v0.7) n'existe plus \u2014 \xE9crire 'template' (singulier)`, current());
        }
        const dirTok = current();
        const dirNom = current() && current().value ? String(current().value) : "?";
        const dir = parseDirective();
        if (dir.name === "mode" && dir.runtime) {
          blockMode = dir.runtime;
          currentMode = blockMode;
          blockModifiers = dir.modifiers || null;
          currentModifiers = blockModifiers;
        } else if (dir.name !== "mode") {
          const axes = new Set(loadLib("core")?.schema?.catalogAxes || []);
          const porteesDuMot = porteesDeclarees(dirNom);
          if (porteesDuMot && !porteesDuMot.includes("scene") && !axes.has(dirNom)) {
            const PLACE = {
              subgrammar: "en t\xEAte de sous-grammaire, dans la parenth\xE8se du mode (`mode:<mode>(<r\xE9glage>)`)",
              rule: "sur une r\xE8gle",
              group: "sur un groupe",
              symbol: "sur un \xE9l\xE9ment",
              flow: "dans le flux"
            };
            const ou = porteesDuMot.map((x) => PLACE[x] ?? x);
            throw new ParseError(
              `'${dirNom}' n'est pas une d\xE9claration : c'est un r\xE9glage, et il ne s'\xE9crit pas seul sur une ligne. Il vaut ${ou.length === 1 ? ou[0] : ou.slice(0, -1).join(", ") + " ou " + ou[ou.length - 1]}.`,
              dirTok
            );
          }
          throw new ParseError(
            `'${dirNom}' est \xE9crit APR\xC8S des r\xE8gles, et \xE0 cette place il ne d\xE9clare RIEN : il \xE9tait accept\xE9 puis jet\xE9 en silence. Les d\xE9clarations pr\xE9c\xE8dent les r\xE8gles \u2014 remonter cette ligne avant la premi\xE8re r\xE8gle de la sc\xE8ne. (Seul 'mode' se place ici : il gouverne la sous-grammaire qui suit.)`,
            dirTok
          );
        }
        skipNewlines();
      }
      const rules = [];
      let ruleSafety = 0;
      while (!atEnd() && !at(T.SEPARATOR)) {
        if (++ruleSafety > 200) throw new ParseError("Rule parse loop safety limit", current());
        skipNewlines();
        if (atEnd() || at(T.SEPARATOR)) break;
        if (at(T.IDENT) && current().value === "template") break;
        if (rules.length && ligneSansFleche()) break;
        if (isRuleStart()) {
          rules.push(parseRule());
        } else {
          if (!atEnd() && !at(T.SEPARATOR) && !at(T.AT)) {
            throw new ParseError(`ligne non reconnue au niveau des r\xE8gles : attendu une r\xE8gle, 'directive', '-----' ou la fin de la sc\xE8ne`, current());
          }
          break;
        }
        skipNewlines();
      }
      if (rules.length > 0) {
        subs.push({ type: "Subgrammar", index: index++, rules, mode: blockMode, modifiers: blockModifiers });
      } else if (at(T.SEPARATOR)) {
        advance();
        skipNewlines();
        continue;
      } else {
        break;
      }
      currentMode = null;
      if (at(T.SEPARATOR)) {
        advance();
        skipNewlines();
      }
    }
    return subs;
  }
  function parseTemplateSection() {
    const kw = expect(T.IDENT);
    if (kw.value !== "template") {
      throw new ParseError(`Expected 'template'`, kw);
    }
    skipNewlines();
    const entries = [];
    while (!atEnd()) {
      skipNewlines();
      if (atEnd()) break;
      if (!at(T.LBRACKET)) break;
      const ouvre = current();
      const brute = lignesSource ? lignesSource[ouvre.line - 1] : null;
      while (!atEnd() && current().line === ouvre.line) advance();
      if (brute == null) {
        throw new ParseError(
          `le catalogue de gabarits se transporte VERBATIM : le parseur a besoin de la SOURCE pour rendre la ligne telle qu'elle est \xE9crite. L'appelant doit passer 'source' \xE0 parse().`,
          ouvre
        );
      }
      entries.push({ type: "TemplateEntry", line: brute });
      skipNewlines();
    }
    return entries;
  }
  function parseTemplateBody() {
    const elements = [];
    while (!atAny(T.NEWLINE, T.EOF, T.RPAREN)) {
      if (at(T.QUESTION)) {
        let count = 0;
        while (at(T.QUESTION)) {
          advance();
          count++;
        }
        if (at(T.INT)) {
          throw new ParseError(
            `'?${current().value}' : un wildcard num\xE9rot\xE9 n'a de sens que dans une r\xE8gle (le num\xE9ro unifie avec la fl\xE8che, qui rejoue le choix). Une ligne de catalogue @template n'a pas de fl\xE8che \u2014 ses wildcards sont toujours anonymes ('?'), jamais num\xE9rot\xE9s.`,
            current()
          );
        }
        elements.push({ type: "TemplateWildcard", count });
      } else if (at(T.PERIOD)) {
        advance();
        elements.push({ type: "TemplatePeriod" });
      } else if (at(T.LPAREN)) {
        advance();
        expect(T.DOLLAR);
        const idx = Number(expect(T.INT).value);
        const body = parseTemplateBody();
        expect(T.RPAREN);
        elements.push({ type: "TemplateBracket", index: idx, body });
      } else {
        break;
      }
    }
    return elements;
  }
  function isRuleStart() {
    const t = current().type;
    return t === T.IDENT || t === T.HASH || t === T.LPAREN || t === T.QUESTION || t === T.PIPE || t === T.LBRACE || t === T.RBRACE || t === T.COMMA || t === T.REST || t === T.DOLLAR || t === T.RPAREN || t === T.LBRACKET && isGuardBracket();
  }
  function isGuardBracket() {
    let i = 1;
    while (pos + i < tokens.length) {
      const t = tokens[pos + i].type;
      if (t === T.RBRACKET || t === T.NEWLINE || t === T.EOF) break;
      if (t === T.COLON) return false;
      i++;
    }
    return true;
  }
  function parseRule() {
    const tok = current();
    let guard = null;
    const contexts = [];
    const guards = [];
    while (at(T.LBRACKET) && isGuardBracket()) {
      guards.push(parseGuard());
    }
    guard = guards.length > 0 ? guards : null;
    while (at(T.HASH) || at(T.LPAREN) && isContextLookahead()) {
      contexts.push(parseContext());
    }
    const lhs = parseLhsElements();
    let arrow;
    if (at(T.ARROW_R)) {
      arrow = "->";
      advance();
    } else if (at(T.ARROW_L)) {
      arrow = "<-";
      advance();
    } else if (at(T.ARROW_BI)) {
      arrow = "<>";
      advance();
    } else throw new ParseError(`Expected arrow (-> <- <>), got ${current().type}`, current());
    const rhs = parseRhsElements();
    if (at(T.COLON) && estNombreDeDuree(peek(1)) && rhs.length > 0) {
      const tokColon = current();
      advance();
      const dur = parseColonFrame(tokColon);
      const inner = rhs.splice(0, rhs.length);
      rhs.push(cadreDuree(dur, inner));
      if (atRhsElementStart()) {
        throw new ParseError(`dur\xE9e isol\xE9e dans le flux : ':N' se colle \xE0 un terminal (A4:1/2), un groupe ({A B}:2) ou toute la r\xE8gle (en fin de RHS) \u2014 jamais au milieu du flux`, current());
      }
    }
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
    const scanValues = universeSacs().specs.scan && universeSacs().specs.scan.values || [];
    let ruleMode = null;
    for (const pair of settings ? settings.pairs : []) {
      if (pair.key === "scan") {
        if (scanValues.includes(pair.value)) {
          ruleMode = pair.value;
        } else {
          throw new ParseError(
            `(scan:${pair.value}) : valeur inconnue (attendu : ${scanValues.join(", ")})`,
            { line: tok.line, col: 0 }
          );
        }
      }
    }
    const countAnchorsLhs = lhs.filter((e) => e.type === "TemplateAnchor").length;
    const countAnchorsRhs = (function countRhsAnchors(elements) {
      let n = 0;
      for (const e of elements) {
        if (e.type === "TemplateAnchor") n++;
        else if (e.elements) n += countRhsAnchors(e.elements);
      }
      return n;
    })(rhs);
    const warnings = [];
    if (countAnchorsLhs !== countAnchorsRhs && (countAnchorsLhs > 0 || countAnchorsRhs > 0)) {
      warnings.push({
        type: "warning",
        message: `ancres de gabarit asym\xE9triques : LHS a ${countAnchorsLhs}, RHS a ${countAnchorsRhs}`,
        line: tok.line
      });
    }
    return { type: "Rule", guard, contexts, lhs, arrow, rhs, flags, qualifiers, settings, mode: ruleMode, line: tok.line, warnings };
  }
  const estProcedureNue = (mot) => universeRuleScopeControls().has(mot);
  function isFlagBracket() {
    if (!at(T.LBRACKET)) return false;
    const t1 = peek(1);
    const t2 = peek(2);
    if (t1.type !== T.IDENT) return false;
    if (t2.type === T.COLON) return false;
    if (estProcedureNue(t1.value)) return false;
    if (t2.type === T.EQUALS || t2.type === T.PLUS || t2.type === T.REST || t2.type === T.RBRACKET || t2.type === T.COMMA) return true;
    if (t1.value.endsWith("-") && t2.type === T.INT) return true;
    if (t1.value.endsWith("+") && t2.type === T.INT) return true;
    return false;
  }
  function parseFlagBracket() {
    expect(T.LBRACKET);
    const flags = [];
    while (!at(T.RBRACKET) && !atEnd()) {
      let rawFlag = expect(T.IDENT).value;
      let operator = null, value = null;
      if (rawFlag.endsWith("-") && at(T.INT)) {
        operator = "-";
        rawFlag = rawFlag.slice(0, -1);
        value = Number(advance().value);
      } else if (rawFlag.endsWith("+") && at(T.INT)) {
        operator = "+";
        rawFlag = rawFlag.slice(0, -1);
        value = Number(advance().value);
      } else if (at(T.EQUALS)) {
        operator = "=";
        advance();
        if (at(T.INT)) value = Number(advance().value);
        else if (at(T.IDENT)) value = advance().value;
        else throw new ParseError("Expected flag value", current());
      } else if (at(T.PLUS)) {
        operator = "+";
        advance();
        if (at(T.INT)) value = Number(advance().value);
        else if (at(T.IDENT)) value = advance().value;
        else throw new ParseError("Expected flag value", current());
      } else if (at(T.REST)) {
        operator = "-";
        advance();
        if (at(T.INT)) value = Number(advance().value);
        else if (at(T.IDENT)) value = advance().value;
        else throw new ParseError("Expected flag value", current());
      }
      flags.push({ type: "FlagExpr", flag: rawFlag, operator, value });
      if (at(T.COMMA)) advance();
    }
    expect(T.RBRACKET);
    return flags;
  }
  function parseGuard() {
    advance();
    let flag = expect(T.IDENT).value;
    let result;
    if (flag.endsWith("-") && at(T.INT)) {
      const val = Number(advance().value);
      flag = flag.slice(0, -1);
      result = { type: "Guard", flag, operator: "-", value: val, mutates: true };
    } else if (flag.endsWith("+") && at(T.INT)) {
      const val = Number(advance().value);
      flag = flag.slice(0, -1);
      result = { type: "Guard", flag, operator: "+", value: val, mutates: true };
    } else if (at(T.REST)) {
      advance();
      const val = Number(expect(T.INT).value);
      result = { type: "Guard", flag, operator: "-", value: val, mutates: true };
    } else if (at(T.PLUS)) {
      advance();
      const val = Number(expect(T.INT).value);
      result = { type: "Guard", flag, operator: "+", value: val, mutates: true };
    } else {
      let op;
      if (at(T.EQ)) {
        op = "==";
        advance();
      } else if (at(T.NEQ)) {
        op = "!=";
        advance();
      } else if (at(T.GT)) {
        op = ">";
        advance();
      } else if (at(T.LT)) {
        op = "<";
        advance();
      } else if (at(T.GTE)) {
        op = ">=";
        advance();
      } else if (at(T.LTE)) {
        op = "<=";
        advance();
      } else if (at(T.EQUALS)) {
        throw new ParseError(
          `garde '[${flag}=\u2026]' : '=' est une MUTATION, elle s'\xE9crit en fin de r\xE8gle ('S -> C4 [${flag}=\u2026]'). Pour TESTER la valeur d'un drapeau avant le LHS, comparer avec '==' ('[${flag}==\u2026] S -> C4')`,
          current()
        );
      } else {
        result = { type: "Guard", flag, operator: null, value: null, mutates: false };
        expect(T.RBRACKET);
        return result;
      }
      let value;
      if (at(T.INT)) value = Number(advance().value);
      else if (at(T.IDENT)) value = advance().value;
      else throw new ParseError(`Expected value after operator`, current());
      result = { type: "Guard", flag, operator: op, value, mutates: false };
    }
    expect(T.RBRACKET);
    return result;
  }
  function isContextLookahead() {
    let j = pos + 1;
    let depth = 1;
    while (j < tokens.length && depth > 0) {
      if (tokens[j].type === T.LPAREN) depth++;
      if (tokens[j].type === T.RPAREN) depth--;
      j++;
    }
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
      if (at(T.QUESTION)) {
        advance();
        return { type: "Context", positive: false, symbols: ["?"] };
      }
      if (at(T.LPAREN)) {
        advance();
        const symbols2 = [];
        while (!at(T.RPAREN) && !atEnd()) {
          if (at(T.IDENT)) symbols2.push(advance().value);
          else if (at(T.QUESTION)) {
            advance();
            if (at(T.INT)) symbols2.push("?" + advance().value);
            else symbols2.push("?");
          } else if (at(T.LBRACE)) {
            symbols2.push(advance().value);
          } else if (at(T.RBRACE)) {
            symbols2.push(advance().value);
          } else if (at(T.COMMA)) {
            symbols2.push(advance().value);
          } else break;
        }
        expect(T.RPAREN);
        return { type: "Context", positive: false, symbols: symbols2 };
      } else if (atAny(T.LBRACE, T.RBRACE, T.COMMA)) {
        return { type: "Context", positive: false, symbols: [advance().value] };
      } else if (at(T.REST)) {
        advance();
        return { type: "Context", positive: false, symbols: ["-"] };
      } else if (at(T.PROLONG)) {
        advance();
        return { type: "Context", positive: false, symbols: ["_"] };
      } else {
        const sym = expect(T.IDENT).value;
        return { type: "Context", positive: false, symbols: [sym] };
      }
    }
    expect(T.LPAREN);
    const symbols = [];
    while (!at(T.RPAREN) && !atEnd()) {
      if (at(T.IDENT)) symbols.push(advance().value);
      else if (at(T.QUESTION)) {
        advance();
        if (at(T.INT)) symbols.push("?" + advance().value);
        else symbols.push("?");
      } else if (atAny(T.LBRACE, T.RBRACE, T.COMMA)) symbols.push(advance().value);
      else break;
    }
    expect(T.RPAREN);
    return { type: "Context", positive: true, symbols };
  }
  function finDeMembreGauche() {
    let j = pos, prof = 0;
    do {
      if (tokens[j].type === T.LPAREN) prof++;
      else if (tokens[j].type === T.RPAREN) prof--;
      j++;
    } while (prof > 0 && j < tokens.length);
    const t = tokens[j] && tokens[j].type;
    return t === T.ARROW_R || t === T.ARROW_L || t === T.ARROW_BI;
  }
  function parseLhsElements() {
    const elements = [];
    while (!atAny(T.ARROW_R, T.ARROW_L, T.ARROW_BI, T.EOF, T.NEWLINE, T.SEPARATOR)) {
      if (at(T.IDENT)) {
        elements.push({ type: "Symbol", name: normalizeName(advance().value), line: current().line });
      } else if (at(T.PIPE)) {
        elements.push(parseVariable());
      } else if (at(T.QUESTION)) {
        elements.push(parseWildcard());
      } else if (at(T.HASH)) {
        elements.push(parseContext());
      } else if (at(T.LPAREN) && current().spaceBefore && isContextLookahead()) {
        if (elements.length > 0 && !finDeMembreGauche()) {
          throw new ParseError(
            `un CONTEXTE ne se pose qu aux EXTREMITES du membre gauche \u2014 en tete ('(A) x B -> \u2026') ou en queue ('x B (A) -> \u2026'). Ici il suit '${elements.length}' element(s) et en precede d autres : le moteur ne connait pas cette place, et l arbre produit ne serait lisible par personne.`,
            current()
          );
        }
        elements.push(parseContext());
      } else if (at(T.PROLONG)) {
        advance();
        elements.push({ type: "Prolongation" });
      } else if (at(T.REST)) {
        advance();
        elements.push({ type: "Rest" });
      } else if (at(T.DOLLAR)) {
        const dollarTok = current();
        const nextTok = peek(1);
        if (!nextTok.spaceBefore && (nextTok.type === T.IDENT || nextTok.type === T.LBRACE)) {
          throw new ParseError(
            `"$" coll\xE9 \xE0 un identifiant interdit en LHS \u2014 utiliser "$ " (dollar isol\xE9 avec espace)`,
            dollarTok
          );
        }
        advance();
        elements.push({ type: "TemplateAnchor", kind: "master" });
      } else if (atAny(T.LBRACE, T.RBRACE, T.COMMA, T.RPAREN)) {
        elements.push({ type: "RawBrace", value: advance().value });
      } else {
        break;
      }
    }
    return elements;
  }
  function parseRhsElements() {
    const elements = [];
    let safety = 0;
    while (!atAny(T.NEWLINE, T.EOF, T.SEPARATOR, T.COMMENT)) {
      if (at(T.LBRACKET) && current().spaceBefore && isFlagPrefixOfControl()) {
        const line = current().line;
        elements.push({ type: "FlagSet", flags: parseFlagBracket(), line });
        continue;
      }
      if (at(T.LBRACKET) && current().spaceBefore) break;
      if (at(T.LPAREN) && current().spaceBefore && isRuntimeQualifierLoose() && isEndOfRhs()) break;
      if (at(T.LPAREN) && current().spaceBefore && isRuntimeQualifierLoose()) {
        elements.push({ type: "InstantControl", qualifier: parseRuntimeQualifier(), conjoint: false });
        continue;
      }
      if (++safety > 500) throw new ParseError("RHS parse loop safety limit", current());
      if (atAny(T.RBRACE, T.COMMA) && isNewRuleAhead()) break;
      if (at(T.RBRACE)) {
        advance();
        const rawBrace = { type: "RawBrace", value: "}" };
        if (at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier()) {
          rawBrace.settings = parseRuntimeQualifier();
        }
        if (at(T.COLON) && !current().spaceBefore && estNombreDeDuree(peek(1))) {
          const tokColon = current();
          advance();
          rawBrace.duree = parseColonFrame(tokColon);
        }
        elements.push(rawBrace);
        continue;
      }
      if (at(T.COMMA)) {
        elements.push({ type: "RawBrace", value: "," });
        advance();
        continue;
      }
      if (at(T.PLUS) || at(T.RPAREN)) {
        elements.push({ type: "RawBrace", value: advance().value });
        continue;
      }
      if (at(T.STAR)) {
        advance();
        elements.push({ type: "RawBrace", value: "*" });
        continue;
      }
      const el = parseRhsElement();
      if (!el) break;
      let sacsLus = 0;
      while (at(T.LBRACKET) && !current().spaceBefore || at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier()) {
        if (at(T.LBRACKET)) refuserCrochetColle();
        el.suffixQualifiers = el.suffixQualifiers || [];
        refuserSecondSac(++sacsLus, el);
        el.suffixQualifiers.push(parseRuntimeQualifier());
      }
      refuserSuffixeArobase();
      elements.push(envelopperEnAccord(el, current()));
    }
    return elements;
  }
  function isNewRuleAhead() {
    if (pos > 0 && tokens[pos - 1].type !== T.NEWLINE) return false;
    let j = pos + 1;
    while (j < tokens.length) {
      const t = tokens[j].type;
      if (t === T.ARROW_R || t === T.ARROW_L || t === T.ARROW_BI) return true;
      if (t === T.NEWLINE || t === T.EOF || t === T.SEPARATOR) return false;
      j++;
    }
    return false;
  }
  function isFlagPrefixOfControl() {
    if (!at(T.LBRACKET) || !isFlagBracket()) return false;
    let j = pos, depth = 0;
    for (; j < tokens.length; j++) {
      if (tokens[j].type === T.LBRACKET) depth++;
      else if (tokens[j].type === T.RBRACKET) {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    if (j >= tokens.length) return false;
    const t = tokens[j];
    if (t.type !== T.IDENT || !isControlName(t.value)) return false;
    return isNoArgControl(t.value);
  }
  function isTempoOpQualifier() {
    if (!at(T.LBRACKET)) return false;
    const next = peek(1).type;
    if (!(next === T.SLASH || next === T.STAR)) return false;
    let j = pos + 2;
    while (j < tokens.length && (tokens[j].type === T.INT || tokens[j].type === T.FLOAT || tokens[j].type === T.SLASH)) j++;
    return j < tokens.length && tokens[j].type === T.RBRACKET;
  }
  function isEndOfRhs() {
    let j = pos;
    if (tokens[j]?.type !== T.LPAREN) return false;
    while (tokens[j]?.type === T.LPAREN) {
      let depth = 1;
      j++;
      while (j < tokens.length && depth > 0) {
        if (tokens[j].type === T.LPAREN) depth++;
        else if (tokens[j].type === T.RPAREN) depth--;
        j++;
      }
    }
    const nextType = tokens[j]?.type;
    return !nextType || nextType === T.EOF || nextType === T.NEWLINE || nextType === T.SEPARATOR || nextType === T.LBRACKET || nextType === T.COMMENT;
  }
  function isRuntimeQualifier() {
    if (!at(T.LPAREN)) return false;
    const nextTok = peek(1);
    if (nextTok.type === T.STAR && peek(2).type === T.COLON) return true;
    if (nextTok.type === T.IDENT && peek(2).type === T.COLON && peek(3).type === T.IDENT && (peek(4).type === T.COLON || peek(4).type === T.PERIOD && peek(6).type === T.COLON)) return true;
    if (nextTok.type !== T.IDENT) return false;
    if (nomsVariables.has(nextTok.value) && peek(2).type === T.PERIOD && peek(3).type === T.IDENT && peek(4).type === T.COLON) return true;
    return sacBienForme();
  }
  function sacBienForme() {
    if (!at(T.LPAREN)) return false;
    let j = pos + 1;
    if (!tokens[j] || tokens[j].type === T.RPAREN) return false;
    while (j < tokens.length) {
      if (tokens[j].type === T.STAR && tokens[j + 1] && tokens[j + 1].type === T.COLON) {
        j += 2;
      } else if (tokens[j].type === T.IDENT && tokens[j + 1] && tokens[j + 1].type === T.COLON && tokens[j + 2] && tokens[j + 2].type === T.IDENT) {
        const apres = tokens[j + 3] && tokens[j + 3].type === T.PERIOD && tokens[j + 4] && (tokens[j + 4].type === T.IDENT || tokens[j + 4].type === T.INT) ? tokens[j + 5] : tokens[j + 3];
        if (apres && apres.type === T.COLON) j += 2;
      }
      if (!tokens[j] || tokens[j].type !== T.IDENT) return false;
      j++;
      if (tokens[j] && tokens[j].type === T.PERIOD && tokens[j + 1] && (tokens[j + 1].type === T.INT || tokens[j + 1].type === T.IDENT)) j += 2;
      if (tokens[j] && tokens[j].type === T.COLON) {
        j++;
        let prof = 0;
        while (j < tokens.length) {
          const t = tokens[j].type;
          if (t === T.NEWLINE || t === T.EOF) return false;
          if (t === T.LPAREN) prof++;
          else if (t === T.RPAREN) {
            if (prof === 0) break;
            prof--;
          } else if (t === T.COMMA && prof === 0) break;
          j++;
        }
      }
      if (!tokens[j]) return false;
      if (tokens[j].type === T.RPAREN) return true;
      if (tokens[j].type !== T.COMMA) return false;
      j++;
    }
    return false;
  }
  function isRuntimeQualifierLoose() {
    return sacBienForme();
  }
  function readIntervalLiteral(ctrlName) {
    const startTok = current();
    const bad = (why) => {
      throw new ParseError(
        `Intervalle malforme pour '${ctrlName}'${why ? " : " + why : ""} \u2014 attendu une fraction (3/2), des cents (700c) ou un decimal (1.5)`,
        startTok
      );
    };
    let neg = "";
    if (at(T.REST)) {
      advance();
      neg = "-";
    }
    if (at(T.STRING)) {
      throw new ParseError(
        `Intervalle entre guillemets non supporte pour '${ctrlName}' : ecris la forme NUE '${current().value}' (sans guillemets) \u2014 un intervalle se note fraction (3/2), cents (700c) ou decimal (1.5)`,
        startTok
      );
    }
    if (!at(T.INT) && !at(T.FLOAT)) bad(`'${current().value ?? current().type}' n'est pas un nombre`);
    const a = advance().value;
    if (at(T.SLASH)) {
      if (neg) bad("une fraction ne se note pas negative (utilise des cents : -700c)");
      advance();
      if (!at(T.INT)) bad("denominateur de fraction manquant");
      const b = advance().value;
      return `${a}/${b}`;
    }
    if (at(T.IDENT) && current().value === "c") {
      advance();
      return `${neg}${a}c`;
    }
    if (at(T.IDENT)) bad(`unite inconnue '${current().value}' (les cents s'ecrivent 700c)`);
    return `${neg}${a}`;
  }
  function parseRuntimeQualifier() {
    expect(T.LPAREN);
    const pairs = [];
    const finirTerme = () => {
      if (at(T.COMMA)) {
        advance();
        return;
      }
      if (!enDeclaratif) return;
      let k = 0;
      while (peek(k).type === T.NEWLINE || peek(k).type === T.COMMENT) k++;
      if (peek(k).type === T.RPAREN || peek(k).type === T.EOF) return;
      if (peek(k).spaceBefore === false && peek(k).type !== T.NEWLINE) {
        throw new ParseError(
          `le signe '${peek(k).value ?? peek(k).type}' n'est pas lisible dans un membre : un membre est un nom, un nombre ou un texte entre guillemets. Les membres deja lus sont '${pairs.map((p) => p.key).join(", ")}'.`,
          peek(k)
        );
      }
      throw new ParseError(
        `deux termes sont separes par une espace : avant le delimiteur, seule la virgule separe \u2014 l'espace n'y separe rien, il est de la mise en forme. Ecris '${pairs.map((p) => p.key).join(", ")}, ${peek(k).value ?? ""}'.`,
        peek(k)
      );
    };
    while (!at(T.RPAREN) && !atEnd()) {
      while (at(T.NEWLINE) || at(T.COMMENT)) advance();
      if (at(T.RPAREN) || atEnd()) break;
      let subject = null;
      if (at(T.STAR) && peek(1).type === T.COLON) {
        subject = "*";
        advance();
        advance();
      } else if (at(T.IDENT) && peek(1).type === T.COLON && peek(2).type === T.IDENT && (peek(3).type === T.COLON || peek(3).type === T.PERIOD && peek(5).type === T.COLON)) {
        subject = current().value;
        advance();
        advance();
      }
      const keyTok = current();
      if (at(T.STRING) && (peek(1).type === T.COLON || peek(1).type === T.LPAREN)) {
      } else if (!at(T.IDENT) && (at(T.INT) || at(T.FLOAT) || at(T.STRING) || at(T.REST) && (peek(1).type === T.INT || peek(1).type === T.FLOAT) && !peek(1).spaceBefore)) {
        const signe = at(T.REST) ? advance().value : "";
        const t = advance();
        let mot = signe + t.value;
        if (t.type !== T.STRING) {
          while ((at(T.IDENT) || at(T.INT) || at(T.FLOAT) || at(T.REST) || at(T.SLASH)) && !current().spaceBefore) {
            mot += String(advance().value);
          }
        }
        pairs.push({
          key: mot,
          value: true,
          ...t.type === T.STRING ? { texte: true } : {},
          ...subject !== null ? { subject } : {},
          line: keyTok.line,
          col: keyTok.col
        });
        finirTerme();
        continue;
      }
      let key = at(T.STRING) && (peek(1).type === T.COLON || peek(1).type === T.LPAREN) ? advance().value : expect(T.IDENT).value;
      let libDuReglage = null;
      if (at(T.PERIOD) && peek(1).type === T.IDENT && !nomsVariables.has(key) && Object.prototype.hasOwnProperty.call(
        libCtx.controlsQualified || {},
        `${key}.${peek(1).value}`
      )) {
        libDuReglage = key;
        advance();
        key = advance().value;
      }
      refuserTempx(key, keyTok, "(");
      const pos2 = { line: keyTok.line, col: keyTok.col };
      const sub = { ...subject !== null ? { subject } : {}, ...libDuReglage ? { lib: libDuReglage } : {} };
      if (at(T.LPAREN) && !current().spaceBefore) {
        pairs.push({ key, value: parseRuntimeQualifier(), ...sub, ...pos2 });
        finirTerme();
        continue;
      }
      if (at(T.PERIOD) && universeComponentControls().has(key)) {
        advance();
        if (!at(T.INT)) {
          throw new ParseError(
            `'${key}.\u2026' d\xE9signe un composant NUM\xC9ROT\xC9 : il attend un num\xE9ro, pas '${current().value}' (exemple : '(${key}.98:45)'). Les contr\xF4leurs qui ont un nom s'\xE9crivent par leur nom`,
            current()
          );
        }
        const component = Number(advance().value);
        if (!at(T.COLON)) {
          throw new ParseError(
            `'${key}.${component}' d\xE9signe un composant sans lui affecter de valeur \u2014 il manque ':valeur' (exemple : '(${key}.${component}:45)')`,
            current()
          );
        }
        advance();
        if (current().spaceBefore) {
          throw new ParseError(
            `'${key}.${component}: ' \u2014 pas d'espace apr\xE8s le deux-points : la valeur commence imm\xE9diatement ('${key}.${component}:${current().value}')`,
            current()
          );
        }
        let valeur;
        if (at(T.REST)) {
          advance();
          valeur = -Number(expect(T.INT).value);
        } else if (at(T.INT) || at(T.FLOAT)) valeur = Number(advance().value);
        else valeur = expect(T.IDENT).value;
        pairs.push({ key, component, value: valeur, ...sub, ...pos2 });
        finirTerme();
        continue;
      }
      if (at(T.PERIOD) && nomsVariables.has(key) && peek(1).type === T.IDENT && peek(2).type === T.COLON) {
        advance();
        const composant = advance().value;
        advance();
        if (current().spaceBefore) {
          throw new ParseError(
            `'${key}.${composant}: ' \u2014 pas d'espace apr\xE8s le deux-points : la valeur commence imm\xE9diatement ('${key}.${composant}:${current().value}')`,
            current()
          );
        }
        let valeur;
        if (at(T.REST)) {
          advance();
          valeur = -Number(expect(T.INT).value);
        } else if (at(T.INT) || at(T.FLOAT)) valeur = Number(advance().value);
        else valeur = expect(T.IDENT).value;
        pairs.push({ key, component: composant, value: valeur, ...sub, ...pos2 });
        finirTerme();
        continue;
      }
      if (at(T.PERIOD) && peek(1).type === T.IDENT && peek(2).type === T.COLON) {
        const composant = peek(1).value;
        const prefixesConnus = new Set(
          Object.keys(libCtx.controlsQualified || {}).map((q) => q.slice(0, q.indexOf(".")))
        );
        if (prefixesConnus.has(key)) {
          const estControle = (libCtx.controlNames || /* @__PURE__ */ new Set()).has(composant);
          if (!estControle && (libCtx.reservedDirectiveNames || /* @__PURE__ */ new Set()).has(composant)) {
            throw new ParseError(
              `'${key}.${composant}:\u2026' \u2014 '${composant}' est une directive de SC\xC8NE : elle s'\xE9crit en t\xEAte, avant le d\xE9limiteur, jamais dans une parenth\xE8se. Le pr\xE9fixe n'y change rien, '${composant}:\u2026' nu y est refus\xE9 aussi.`,
              keyTok
            );
          }
          throw new ParseError(
            `'${key}.${composant}:\u2026' \u2014 la librairie '${key}' ne d\xE9clare aucun contr\xF4le '${composant}'. Le pr\xE9fixe est bon, le contr\xF4le n'est pas chez lui.`,
            keyTok
          );
        }
        const motsInvoques = /* @__PURE__ */ new Set();
        for (const [fichier, lib] of Object.entries(libCtx._libs || {})) {
          motsInvoques.add(fichier);
          if (lib && typeof lib.resolves === "string" && lib.resolves) motsInvoques.add(lib.resolves);
        }
        if (motsInvoques.has(key)) {
          throw new ParseError(
            `'${key}.${composant}:\u2026' \u2014 la librairie '${key}' est bien invoqu\xE9e, et elle ne d\xE9clare AUCUN contr\xF4le : rien ne s'y affecte par une parenth\xE8se. Le pr\xE9fixe est bon, la librairie n'est pas de celles qui portent des contr\xF4les.`,
            keyTok
          );
        }
        throw new ParseError(
          `'${key}.${composant}:\u2026' affecte une valeur au composant '${composant}' de '${key}' \u2014 mais '${key}' n'est ni une librairie invoqu\xE9e, ni un contr\xF4le \xE0 composants, ni une instance d\xE9clar\xE9e dans cette sc\xE8ne. D\xE9clarer l'instance d'abord : '<module> ${key}'`,
          keyTok
        );
      }
      if (at(T.PERIOD)) {
        advance();
        const name = expect(T.IDENT).value;
        pairs.push({ key: `${key}.${name}`, value: true, reference: true, ...sub, ...pos2 });
        finirTerme();
        continue;
      }
      if (at(T.COLON)) {
        advance();
        if (!at(T.RPAREN) && !atEnd() && current().spaceBefore) {
          throw new ParseError(
            `'${key}: ' \u2014 pas d'espace apr\xE8s le deux-points : la valeur commence imm\xE9diatement ('${key}:${current().value}\u2026'). L'espace ne s\xE9pare que les PARTIES d'une valeur`,
            current()
          );
        }
        const specReglage = universeSacs().specs && universeSacs().specs[key];
        const reglageMultiPartie = specReglage && Array.isArray(specReglage.args) && specReglage.args.length > 1;
        if (libCtx.qualifierKeys.has(key) && !reglageMultiPartie) {
          const { value, decrement } = readQualifierValue();
          if (value === void 0) {
            const exemple = specReglage && Array.isArray(specReglage.values) && specReglage.values[0] || "\u2026";
            throw new ParseError(
              `'(${key}:)' n'affecte aucune valeur \u2014 le deux-points en attend une (par exemple '(${key}:${exemple})')`,
              keyTok
            );
          }
          if (at(T.IDENT) && peek(1).type === T.COLON) {
            throw new ParseError(
              `'(${key}:\u2026 ${current().value}:\u2026)' : deux \xC9L\xC9MENTS du sac s\xE9par\xE9s par une ESPACE \u2014 il leur manque une VIRGULE ('(${key}:\u2026, ${current().value}:\u2026)'). L'espace ne s\xE9pare que les PARTIES d'une m\xEAme valeur`,
              current()
            );
          }
          pairs.push({ key, value, decrement, ...sub, ...pos2 });
          finirTerme();
          continue;
        }
        if (libCtx.intervalControls && libCtx.intervalControls.has(key) || universeIntervalControls().has(key)) {
          pairs.push({ key, value: readIntervalLiteral(key), ...sub, ...pos2 });
          finirTerme();
          continue;
        }
        const specCle = libCtx.controls && libCtx.controls[key] || null;
        const monoPartie = specCle && Array.isArray(specCle.args) && specCle.args.length === 1;
        const parts = [];
        let deuxPointsEnTrop = null;
        let elementAvale = null;
        let jetons = 0;
        let texteSeul = null;
        let backtickSeul = null;
        while (!at(T.RPAREN) && !at(T.COMMA) && !atEnd()) {
          if (monoPartie && parts.length > 0 && at(T.IDENT) && libCtx.controlNames.has(current().value)) {
            elementAvale = current();
            break;
          }
          if (at(T.COLON) && !deuxPointsEnTrop) deuxPointsEnTrop = current();
          if (parts.length > 0 && current().spaceBefore) {
            if (enDeclaratif) {
              throw new ParseError(
                `'${key}:${parts.join("")} ${current().value}\u2026' : dans la partie D\xC9CLARATIVE, seule la virgule s\xE9pare \u2014 l'espace n'y s\xE9pare rien. Une valeur n'a qu'UNE partie ; plusieurs parties sont plusieurs valeurs, et elles s'\xE9crivent par une parenth\xE8se et des noms : '${key}(${parts.join("")}, ${current().value}\u2026)'. Dans le FLUX, apr\xE8s le d\xE9limiteur, l'espace s\xE9pare les termes comme avant.`,
                current()
              );
            }
            parts.push(" ");
          }
          texteSeul = jetons === 0 && at(T.STRING) ? current().value : null;
          backtickSeul = jetons === 0 && at(T.BACKTICK) ? current().value : null;
          jetons++;
          parts.push(advance().value);
        }
        const brut = parts.join("");
        if (enDeclaratif && (brut === "required" || brut === "many")) {
          throw new ParseError(
            `'${key}:${brut}' : '${brut}' est SORTI du langage (d\xE9cision Romain, 2026-08-20) \u2014 l'obligation se lit de l'ABSENCE de d\xE9faut, la multiplicit\xE9 de l'EXEMPLAIRE. \xC9crire '${key}' seul pour un membre obligatoire, ou '${key}()' pour une collection obligatoire ; une valeur donn\xE9e apr\xE8s ':' en fait un membre optionnel dont elle est le d\xE9faut.`,
            current()
          );
        }
        if (elementAvale) {
          throw new ParseError(
            `'(${key}:${brut} ${elementAvale.value}\u2026)' : '${key}' n'attend qu'UNE valeur, donc '${elementAvale.value}' est un autre \xC9L\xC9MENT du sac \u2014 il lui manque sa VIRGULE ('${key}:${brut}, ${elementAvale.value}\u2026'). L'espace ne s\xE9pare que les PARTIES d'une m\xEAme valeur`,
            elementAvale
          );
        }
        if (deuxPointsEnTrop) {
          throw new ParseError(
            `'(${key}:${brut})' : le deux-points AFFECTE une valeur, il n'en s\xE9pare pas les parties \u2014 une paire n'en porte qu'un. Pour d\xE9signer un composant num\xE9rot\xE9, le point l'appelle ('(${key}.${brut.split(":")[0]}:${brut.split(":").slice(1).join(":")})') ; pour plusieurs parties, l'espace les s\xE9pare`,
            deuxPointsEnTrop
          );
        }
        if (jetons === 0) {
          throw new ParseError(
            `'(${key}:)' n'affecte aucune valeur \u2014 le deux-points en attend une (par exemple '(${key}:80)'), et un contr\xF4le sans argument s'\xE9crit nu, sans deux-points. Un texte VIDE s'\xE9crit '${key}:""' : le d\xE9limiteur, sans rien dedans`,
            keyTok
          );
        }
        let val;
        if (jetons === 1 && backtickSeul !== null) {
          const t = tryBacktickTag(backtickSeul);
          val = !t ? backtickSeul : { type: "BacktickInline", code: t.code, tag: t.tag };
        } else {
          val = texteSeul !== null && jetons === 1 ? texteSeul : /^-?\d+(\.\d+)?$/.test(brut) ? Number(brut) : brut;
        }
        const valeurEstUnTexte = texteSeul !== null && jetons === 1;
        if (isNoArgControl(key)) {
          throw new ParseError(
            `'(${key}:${brut})' : '${key}' ne prend AUCUN argument \u2014 sa d\xE9claration n'en nomme pas. \xC9crire '${key}' seul. Une valeur pos\xE9e ici voyagerait jusqu'au runtime sans destinataire, sans que rien ne signale qu'elle ne sert \xE0 rien.`,
            keyTok
          );
        }
        pairs.push({ key, value: val, ...valeurEstUnTexte ? { texte: true } : {}, ...sub, ...pos2 });
      } else {
        pairs.push({ key, value: true, ...sub, ...pos2 });
      }
      finirTerme();
    }
    expect(T.RPAREN);
    return { type: "SettingBag", pairs };
  }
  function isPerElementQualifier() {
    if (!at(T.LBRACKET)) return false;
    const nextTok = peek(1);
    if (nextTok.type !== T.IDENT) return false;
    return libCtx.controlNames.has(nextTok.value);
  }
  function refuserSuffixeArobase() {
    if (!at(T.AT) || current().spaceBefore) return;
    const nom = peek(1).type === T.IDENT ? peek(1).value : "nom";
    throw new ParseError(
      `le suffixe '${nom}' coll\xE9 \xE0 un \xE9l\xE9ment est SUPPRIM\xC9 du langage (d\xE9cision Romain 2026-07-28). Deux \xE9critures le remplacent, selon ce qu'on voulait faire. Pour ASSOCIER un geste \xE0 un \xE9l\xE9ment DANS LA PRODUCTION : le point d'exclamation, 'C4!${nom}' \u2014 le geste se d\xE9clenche \xE0 l'instant du terminal sans occuper de pas. Pour D\xC9CLARER UNE \xC9TIQUETTE : la partie d\xE9clarative, par 'def'.`,
      current()
    );
  }
  function parseRhsElement() {
    const tok = current();
    if (at(T.REST)) {
      advance();
      return { type: "Rest" };
    }
    if (at(T.PROLONG)) {
      if (peek(1).type === T.IDENT && peek(2).type === T.LPAREN && !peek(1).spaceBefore) {
        const nom = peek(1).value;
        const cle = Object.keys(libCtx.controls || {}).find((k) => libCtx.controls[k].bp3 === `_${nom}`) || nom;
        const renomme = cle !== nom;
        throw new ParseError(
          `la graphie \xAB _${nom}(\u2026) \xBB est celle du moteur natif BP3, elle n'appartient pas \xE0 BPScript \u2014 \xE9crire \xAB !(${cle}:\u2026) \xBB \xE0 la place` + (renomme ? ` (le \xAB _${nom} \xBB natif se dit \xAB ${cle} \xBB en BPScript, et la cl\xE9 \xAB ${nom} \xBB d\xE9signe un AUTRE geste)` : ""),
          peek(1)
        );
      }
      advance();
      return { type: "Prolongation" };
    }
    if (at(T.UNDETERMINED)) {
      advance();
      return { type: "UndeterminedRest" };
    }
    if (at(T.COMPOUND)) {
      const t = advance();
      return { type: "Symbol", name: t.value, compose: t.parties || [], line: t.line };
    }
    if (at(T.PERIOD)) {
      advance();
      return { type: "Period" };
    }
    if (at(T.IDENT) && peek(1).type === T.COLON && peek(2).type === T.LBRACE) {
      const label = advance().value;
      advance();
      if (hasMatchingBrace()) {
        return parsePolymetric(label);
      }
      return { type: "Symbol", name: normalizeName(label), line: tok.line };
    }
    if (at(T.LBRACE)) {
      if (hasMatchingBrace()) {
        return parsePolymetric(null);
      }
      advance();
      return { type: "RawBrace", value: "{" };
    }
    if (at(T.PIPE)) {
      return parseVariable();
    }
    if (at(T.QUESTION)) {
      return parseWildcard();
    }
    if (at(T.DOLLAR)) {
      return parseTemplateMaster();
    }
    if (at(T.AMPERSAND)) {
      return parseTemplateSlave();
    }
    if (at(T.TILDE)) {
      advance();
      if (at(T.IDENT)) {
        const name = advance().value;
        if (at(T.TILDE)) {
          advance();
          return { type: "TieContinue", symbol: name };
        }
        return { type: "TieEnd", symbol: name };
      }
      throw new ParseError("Expected symbol after ~", tok);
    }
    if (at(T.BANG)) {
      const OUVRANTS = /* @__PURE__ */ new Set([
        T.LBRACE,
        T.LPAREN,
        T.LBRACKET,
        T.COMMA,
        T.ARROW_R,
        T.ARROW_L,
        T.ARROW_BI,
        T.NEWLINE
      ]);
      for (const t of OUVRANTS) if (t === void 0) throw new Error("OUVRANTS porte un type de jeton inexistant");
      const precedent = peek(-1);
      const collated = !current().spaceBefore && precedent !== void 0 && !OUVRANTS.has(precedent.type);
      advance();
      if (at(T.LPAREN) && (peek(1).type === T.SLASH || peek(1).type === T.STAR && peek(2).type !== T.COLON)) {
        if (collated) {
          throw new ParseError(
            `'!(\u2026)' coll\xE9 \xE0 un terme porte un flux CONJOINT, qui voyage avec ce terme et se r\xE9plique avec lui \u2014 une vitesse ne fait ni l'un ni l'autre : elle court \xE0 partir d'o\xF9 elle est pos\xE9e jusqu'\xE0 la fin du champ. Elle se d\xE9tache par une espace : '\u2026 ! (${peek(1).type === T.STAR ? "*N/M" : "/N"})'`,
            current()
          );
        }
        return { type: "InstantControl", qualifier: parseVitesseParenthese(), conjoint: false };
      }
      if (sacBienForme()) {
        return { type: "InstantControl", qualifier: parseRuntimeQualifier(), conjoint: collated };
      }
      if (at(T.LBRACKET) && peek(1).type === T.IDENT) {
        const nom = peek(1).value;
        const CROCHET_EN_FLUX = /* @__PURE__ */ new Set(["seed"]);
        if (CROCHET_EN_FLUX.has(nom) && !directiveDeclareeParLaLibrairie("engine", nom)) {
          throw new ParseError(
            `'![${nom}:\u2026]' : '${nom}' n'est plus d\xE9clar\xE9 par la librairie 'engine'. La re-semence en flux traduit le '_srand(N)' natif, et le mot qui la porte vient d'une librairie comme tous les autres.`,
            current()
          );
        }
        if (CROCHET_EN_FLUX.has(nom)) {
          const ouvre = current();
          advance();
          advance();
          let value = null, runtime = null;
          if (at(T.COLON)) {
            advance();
            ({ value, runtime } = parseDirectiveColonValue("seed"));
          }
          expect(T.RBRACKET);
          const dirs = [{
            type: "Directive",
            name: "seed",
            subkey: null,
            runtime,
            value,
            aliases: null,
            modifiers: null,
            line: ouvre.line
          }];
          return { type: "InstantControl", qualifier: { type: "ProductionInline", directives: dirs } };
        }
      }
      if (at(T.LBRACKET) && peek(1).type === T.AT) {
        const ouvre = current();
        const nom = peek(2).type === T.IDENT ? peek(2).value : "\u2026";
        if (nom === "seed") {
          throw new ParseError(
            `'![seed:N]' : la re-semence dans le flux s'\xE9crit SANS arobase \u2014 '![seed:N]'. Le crochet porte ce qui gouverne la d\xE9rivation, et une re-semence en est une proc\xE9dure ; l'arobase reste \xE0 la t\xEAte de sc\xE8ne, o\xF9 'seed:N' r\xE8gle la production.`,
            ouvre
          );
        }
        throw new ParseError(
          `'![${nom}\u2026]' : seule la re-semence a un sens dans le flux, et elle s'\xE9crit '![seed:N]' ; '${nom}' se pose en t\xEAte de sc\xE8ne, '${nom}'.`,
          ouvre
        );
      }
      if (at(T.LBRACKET)) {
        const q = parseQualifier("relative");
        const procedure = (q.pairs || []).find((p) => p && universeRuleScopeControls().has(p.key));
        if (procedure) {
          throw new ParseError(
            `'![${procedure.key}: \u2026]' : '${procedure.key}' est une proc\xE9dure de niveau R\xC8GLE, elle ne se pose pas dans le flux \u2014 elle vaut pour la r\xE8gle enti\xE8re. \xC9crire '[${procedure.key}:${procedure.value === true ? "\u2026" : procedure.value}]' en suffixe de r\xE8gle. Dans le flux, elle n'atteint jamais la r\xE8gle et laisse un jeton de contr\xF4le inerte dans la production`,
            current()
          );
        }
        throw new ParseError(
          `un crochet ne se pose PAS dans le flux (d\xE9cision Romain 2026-08-08) : le crochet gouverne la D\xC9RIVATION \u2014 une garde, une affectation de drapeau, une proc\xE9dure, un rang de gabarit \u2014 et rien de cela ne vaut \xE0 un instant. Un contr\xF4le pos\xE9 dans le flux s'\xE9crit entre PARENTH\xC8SES : '!(shuffle)', '!(retro)', '!(vel:80)'. (Seule '![seed:N]' reste, parce qu'elle re-s\xE8me la production et non la d\xE9rivation.)`,
          current()
        );
      }
      if (at(T.IDENT)) {
        const name = advance().value;
        return { type: "OutTimeObject", name };
      }
      throw new ParseError("Expected symbol, (...) or [...] after !", current());
    }
    if (at(T.TRIGGER_IN)) {
      return parseWait();
    }
    if (at(T.HASH)) {
      return parseContext();
    }
    if (at(T.BACKTICK)) {
      const raw = advance().value;
      const t = tryBacktickTag(raw);
      if (t) return { type: "BacktickStandalone", tag: t.tag, code: t.code, line: tok.line };
      return { type: "BacktickInline", code: raw, tag: null, line: tok.line };
    }
    if (at(T.INT) && !isSymbolCallAhead()) {
      const num = Number(advance().value);
      if (at(T.SLASH) && peek(1).type === T.INT) {
        advance();
        const denom = Number(advance().value);
        return { type: "NumericDuration", numerator: num, denominator: denom };
      }
      return { type: "NumericTerminal", kind: "numeric-terminal", value: num, line: tok.line };
    }
    if (at(T.IDENT)) {
      let name = advance().value;
      let actor = null;
      if (at(T.PERIOD) && !current().spaceBefore && peek(1).type === T.BACKTICK && (libCtx.actors && libCtx.actors[name] || acteursDeclares.has(name))) {
        advance();
        const raw = advance().value;
        const t = tryBacktickTag(raw);
        return t ? { type: "BacktickStandalone", tag: t.tag, code: t.code, actor: name, line: tok.line } : { type: "BacktickInline", code: raw, tag: null, actor: name, line: tok.line };
      }
      const gluedMember = at(T.PERIOD) && !current().spaceBefore && peek(1).type === T.IDENT;
      const knownActor = gluedMember && (libCtx.actors && libCtx.actors[name] || acteursDeclares.has(name));
      const opaqueComponent = gluedMember && !knownActor && !peek(1).spaceBefore;
      let componentOpaque = false;
      if (knownActor || opaqueComponent) {
        advance();
        actor = name;
        name = advance().value;
        componentOpaque = opaqueComponent;
      }
      if (componentOpaque && at(T.COLON) && !current().spaceBefore) {
        advance();
        const value = lireValeurDeMembre();
        return { type: "Symbol", name: normalizeName(name), line: tok.line, actor, value };
      }
      if (at(T.COLON) && !current().spaceBefore && estNombreDeDuree(peek(1))) {
        advance();
        const dur = parseColonFrame(tok);
        const sym = { type: "Symbol", name: normalizeName(name), line: tok.line, ...actor ? { actor } : {} };
        return cadreDuree(dur, [sym]);
      }
      if (at(T.TILDE)) {
        advance();
        return { type: "TieStart", symbol: name, ...actor ? { actor } : {} };
      }
      if (!actor && at(T.LPAREN) && isControlName(name)) {
        throw new ParseError(refusFormeAppel(name), tok);
      }
      if (!actor && !at(T.LPAREN) && isControlName(name) && libCtx.bagOnlyControls && libCtx.bagOnlyControls.has(name) && !nomsDeclaresLocalement.has(name)) {
        const portees = libCtx.controls?.[name]?.scope;
        const listePortees = Array.isArray(portees) ? portees : portees ? [portees] : [];
        const OU = {
          scene: "en t\xEAte de sc\xE8ne",
          subgrammar: "en t\xEAte de sous-grammaire",
          rule: "en suffixe de r\xE8gle",
          group: "sur un groupe",
          symbol: "sur un \xE9l\xE9ment",
          flow: "dans le flux"
        };
        const places = listePortees.map((p) => OU[p] || p);
        const commentEcrire = listePortees.includes("flow") ? `\xE9crire '!(${name})' pour le poser au fil de la s\xE9quence` : places.length ? `sa d\xE9claration ne lui donne que ${places.length > 1 ? "ces places" : "cette place"} : ${places.join(", ")}` : `sa d\xE9claration ne lui donne aucune place dans une r\xE8gle`;
        throw new ParseError(
          `'${name}' n'a pas de forme nue dans le flux \u2014 ${commentEcrire}. Un mot du vocabulaire rencontr\xE9 l\xE0 o\xF9 il ne peut pas l'\xEAtre refuse ; il ne dispara\xEEt pas.`,
          tok
        );
      }
      if (!actor && !at(T.LPAREN) && isControlName(name) && isNoArgControl(name)) {
        if (nomsDeclaresLocalement.has(name)) {
          warn(`'${name}' est d\xE9clar\xE9 par la sc\xE8ne ET port\xE9 par le vocabulaire comme contr\xF4le sans argument \u2014 la d\xE9claration de la sc\xE8ne l'emporte, le mot reste un symbole ici. Pour le contr\xF4le, \xE9crire '(${name})' ou '!(${name})'.`, tok.line);
        } else {
          return { type: "Control", name, args: [] };
        }
      }
      if (at(T.LPAREN) && !current().spaceBefore && !isContextLookahead() && !estUneDefinitionDeclaree(name)) {
        if (!sacBienForme()) {
          if (isControlName(name)) throw new ParseError(refusFormeAppel(name), tok);
          throw new ParseError(
            `'${name}(${texteDuSac()})' n'est lisible ni comme un SAC DE R\xC9GLAGES \u2014 son contenu n'est pas fait de paires 'cl\xE9:valeur' \u2014 ni comme un APPEL : appeler exige une d\xE9finition d\xE9clar\xE9e, et aucune ne porte le nom '${name}'. Pour r\xE9gler '${name}', \xE9crire '${name}(cl\xE9:valeur)' ; pour l'appeler, le d\xE9clarer d'abord avec 'def ${name}(x) \u2026'`,
            tok
          );
        }
        return { type: "Symbol", name: normalizeName(name), line: tok.line, ...actor ? { actor } : {} };
      }
      if (at(T.LPAREN) && !current().spaceBefore && !isContextLookahead()) {
        const node = parseSymbolCall(name, tok);
        if (actor) poserActeur(node, actor);
        return node;
      }
      if (at(T.BANG) && peek(1).type !== T.LPAREN && peek(1).type !== T.LBRACKET) {
        const node = parseSimultaneousGroup(name, tok);
        if (actor) poserActeur(node, actor);
        return node;
      }
      if (at(T.TRIGGER_IN)) {
        const triggerIns = [];
        while (at(T.TRIGGER_IN)) {
          triggerIns.push(parseWait());
        }
        return {
          type: "SymbolWithWait",
          symbol: { type: "Symbol", name: normalizeName(name), line: tok.line, ...actor ? { actor } : {} },
          triggers: triggerIns
        };
      }
      if (!actor && at(T.LPAREN) && isControlName(name)) {
        throw new ParseError(refusFormeAppel(name), tok);
      }
      return { type: "Symbol", name: normalizeName(name), line: tok.line, ...actor ? { actor } : {} };
    }
    return null;
  }
  function isSymbolCallAhead() {
    return false;
  }
  function isNoArgControl(name) {
    return libCtx.noArgControls.has(name);
  }
  function refusFormeAppel(name) {
    const moteur = libCtx.bp3NativeControls && libCtx.bp3NativeControls.has(name) && !(libCtx.dispatcherOnlyControls && libCtx.dispatcherOnlyControls.has(name));
    const cible = moteur ? `![${name}:\u2026]` : `!(${name}:\u2026)`;
    return `la forme d'appel '${name}(${texteDuSac()})' n'existe pas en BPScript (supprim\xE9e le 2026-07-26) \u2014 \xE9crire '${cible}' pour le poser dans le flux, ou '${moteur ? `[${name}:\u2026]` : `(${name}:\u2026)`}' en contenance. Les deux points AFFECTENT la valeur, l'espace en s\xE9pare les parties ('[goto:3 0]'), la virgule s\xE9pare les \xE9l\xE9ments du sac ('(vel:80, pan:64)')`;
  }
  function isControlName(name) {
    return libCtx.controlNames.has(name);
  }
  function refuserCrochetColle() {
    parseQualifier();
    throw new ParseError(
      `un crochet COLL\xC9 \xE0 un \xE9l\xE9ment n'existe plus (d\xE9cision Romain 2026-08-08) : le crochet gouverne la D\xC9RIVATION \u2014 un test de drapeau, une affectation, une proc\xE9dure ('[goto:\u2026]', '[repeat:\u2026]', '[failed:\u2026]', '[stop]'), un rang de gabarit \u2014 et aucune de ces places n'est un suffixe d'\xE9l\xE9ment. Un sac coll\xE9 s'\xE9crit entre PARENTH\xC8SES : '\u2026(shuffle)', '\u2026(retro)', '\u2026(vel:80)'.`,
      current()
    );
  }
  function refuserSecondSac(rang, el) {
    if (rang < 2) return;
    const nom = el && (el.name || el.symbol) ? `'${el.name || el.symbol}'` : "cet \xE9l\xE9ment";
    throw new ParseError(
      `${nom} porte DEUX sacs de r\xE9glages coll\xE9s \u2014 un \xE9l\xE9ment n'en porte qu'un. R\xE9unir les paires dans le m\xEAme sac : la virgule les s\xE9pare, '(cl\xE9:valeur, cl\xE9:valeur)'. Les deux \xE9critures disaient d\xE9j\xE0 la m\xEAme chose ; celle-ci n'en est plus une (d\xE9cision Romain 2026-08-08).`,
      current()
    );
  }
  function estUneDefinitionDeclaree(name) {
    return definitionsDeclarees.has(name);
  }
  function texteDuSac() {
    if (!at(T.LPAREN)) return "";
    let j = pos + 1, profondeur = 1;
    const morceaux = [];
    while (j < tokens.length && profondeur > 0) {
      const t = tokens[j];
      if (t.type === T.LPAREN) profondeur++;
      else if (t.type === T.RPAREN) {
        profondeur--;
        if (!profondeur) break;
      } else if (t.type === T.NEWLINE || t.type === T.EOF) break;
      morceaux.push((t.spaceBefore && morceaux.length ? " " : "") + (t.value ?? ""));
      j++;
    }
    return morceaux.join("");
  }
  function atRhsElementStart() {
    const t = current().type;
    return t === T.IDENT || t === T.LBRACE || t === T.REST || t === T.PROLONG || t === T.UNDETERMINED || t === T.PERIOD || t === T.PIPE || t === T.QUESTION || t === T.DOLLAR || t === T.AMPERSAND || t === T.TILDE || t === T.BANG || t === T.TRIGGER_IN || t === T.HASH || t === T.BACKTICK || t === T.INT;
  }
  function parseSymbolCall(name, tok) {
    expect(T.LPAREN);
    const args = [];
    while (!at(T.RPAREN) && !atEnd()) {
      let key = null;
      if (at(T.IDENT) && peek(1).type === T.COLON) {
        key = advance().value;
        advance();
      }
      let value;
      const intervalHere = key && universeIntervalControls().has(key) || !key && universeIntervalControls().has(name);
      if (intervalHere) {
        value = { type: "Literal", value: readIntervalLiteral(key || name) };
      } else if (at(T.BACKTICK)) {
        const raw = advance().value;
        const t = tryBacktickTag(raw);
        value = t ? { type: "BacktickInline", code: t.code, tag: t.tag } : { type: "BacktickInline", code: raw, tag: null };
      } else if (at(T.INT)) {
        const n = advance().value;
        if (at(T.SLASH) && peek(1).type === T.INT) {
          advance();
          value = { type: "Literal", value: `${n}/${advance().value}` };
        } else {
          value = { type: "Literal", value: Number(n) };
        }
      } else if (at(T.FLOAT)) {
        value = { type: "Literal", value: Number(advance().value) };
      } else if (at(T.IDENT)) {
        let nom = advance().value;
        while (at(T.PERIOD) && peek(1).type === T.IDENT && !current().spaceBefore) {
          advance();
          nom += `.${advance().value}`;
        }
        value = { type: "Literal", value: nom };
      } else {
        throw new ParseError(`Expected argument value in '${name}(\u2026)'`, current());
      }
      args.push({ type: "Arg", key, value });
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);
    if (at(T.TILDE)) {
      advance();
      return { type: "TieStart", symbol: name, args };
    }
    if (at(T.BANG) && peek(1).type !== T.LPAREN && peek(1).type !== T.LBRACKET) {
      return parseSimultaneousGroup(name, tok, args);
    }
    return { type: "SymbolCall", name, args, line: tok.line };
  }
  function parseControl(name, tok) {
    expect(T.LPAREN);
    const args = [];
    if (universeIntervalControls().has(name)) {
      args.push(readIntervalLiteral(name));
      expect(T.RPAREN);
      return { type: "Control", name, args };
    }
    while (!at(T.RPAREN) && !atEnd()) {
      let arg = "";
      while (!at(T.RPAREN) && !at(T.COMMA) && !atEnd()) {
        const t = current();
        if (t.type === T.INT || t.type === T.FLOAT || t.type === T.IDENT) {
          if (arg.length > 0 && /[a-zA-Z0-9]$/.test(arg)) {
            throw new ParseError(
              `argument de contr\xF4le mal form\xE9 dans '${name}(\u2026)' : '${arg} ${t.value}' \u2014 deux valeurs se suivent sans s\xE9parateur. Un contr\xF4le prend des arguments s\xE9par\xE9s par ',' ; il ne prend pas de phrase (la fonction g\xE9n\xE9rique 'script(\u2026)' a \xE9t\xE9 supprim\xE9e du langage)`,
              t
            );
          }
          arg += advance().value;
        } else if (t.type === T.EQUALS) {
          if (arg.length > 0) arg += " ";
          arg += advance().value + " ";
        } else if (t.type === T.SLASH) {
          arg += advance().value;
        } else if (t.type === T.REST) {
          arg += advance().value;
        } else if (t.type === T.PLUS) {
          arg += advance().value;
        } else {
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
    return { type: "Control", name, args };
  }
  function envelopperEnAccord(el, tok) {
    if (!at(T.BANG) || peek(1).type === T.LPAREN || peek(1).type === T.LBRACKET) return el;
    return { type: "SimultaneousGroup", primary: el, secondaries: lireSecondaires(tok) };
  }
  function poserActeur(node, actor) {
    if (node && node.type === "SimultaneousGroup" && node.primary) {
      poserActeur(node.primary, actor);
      return;
    }
    if (node) node.actor = actor;
  }
  function parseSimultaneousGroup(primaryName, tok, primaryArgs = null) {
    let primary;
    if (primaryArgs) {
      primary = { type: "SymbolCall", name: primaryName, args: primaryArgs, line: tok.line };
    } else {
      primary = { type: "Symbol", name: normalizeName(primaryName), line: tok.line };
    }
    return { type: "SimultaneousGroup", primary, secondaries: lireSecondaires(tok) };
  }
  function lireSecondaires(tok) {
    const secondaries = [];
    while (at(T.BANG)) {
      advance();
      if (at(T.IDENT)) {
        let name = advance().value;
        let acteurSec = null;
        if (at(T.PERIOD) && !current().spaceBefore && peek(1) && peek(1).type === T.IDENT && (libCtx.actors && libCtx.actors[name] || acteursDeclares.has(name))) {
          advance();
          acteurSec = name;
          name = advance().value;
        }
        if (at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier()) {
          const sec = { type: "Symbol", name: normalizeName(name), line: tok.line, suffixQualifiers: [], ...acteurSec ? { actor: acteurSec } : {} };
          while (at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier()) {
            sec.suffixQualifiers.push(parseRuntimeQualifier());
          }
          secondaries.push(sec);
        } else if (at(T.LPAREN)) {
          secondaries.push(parseSymbolCall(name, tok));
        } else {
          secondaries.push({ type: "Symbol", name: normalizeName(name), line: tok.line, ...acteurSec ? { actor: acteurSec } : {} });
        }
        continue;
      }
      throw new ParseError("Expected symbol after !", current());
    }
    return secondaries;
  }
  function hasMatchingBrace() {
    let depth = 0;
    let j = pos;
    let afterNewline = false;
    while (j < tokens.length) {
      const t = tokens[j].type;
      if (t === T.LBRACE) depth++;
      if (t === T.RBRACE) {
        depth--;
        if (depth === 0) return true;
      }
      if (t === T.EOF || t === T.SEPARATOR) return false;
      if (t === T.NEWLINE) {
        afterNewline = true;
        j++;
        continue;
      }
      if (afterNewline) {
        if (t === T.IDENT) {
          let k = j + 1;
          while (k < tokens.length && tokens[k].type === T.IDENT) k++;
          if (k < tokens.length && (tokens[k].type === T.ARROW_R || tokens[k].type === T.ARROW_L || tokens[k].type === T.ARROW_BI)) {
            return false;
          }
        }
      }
      afterNewline = false;
      j++;
    }
    return false;
  }
  function parsePolymetric(label) {
    let dureeCollee = null;
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
      if (at(T.NEWLINE)) {
        advance();
        continue;
      }
      if (at(T.LBRACKET) && current().spaceBefore) break;
      const el = parseRhsElement();
      if (!el) break;
      refuserSuffixeArobase();
      let sacsLusIci = 0;
      while (at(T.LBRACKET) && !current().spaceBefore || at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier()) {
        if (at(T.LBRACKET)) refuserCrochetColle();
        el.suffixQualifiers = el.suffixQualifiers || [];
        refuserSecondSac(++sacsLusIci, el);
        el.suffixQualifiers.push(parseRuntimeQualifier());
      }
      currentVoice.push(envelopperEnAccord(el, current()));
      if (at(T.LPAREN) && current().spaceBefore && isRuntimeQualifier() && currentVoice.length > 0) {
        const lastEl = currentVoice[currentVoice.length - 1];
        lastEl.suffixQualifiers = lastEl.suffixQualifiers || [];
        lastEl.suffixQualifiers.push(parseRuntimeQualifier());
      }
    }
    if (currentVoice.length > 0) voices.push(currentVoice);
    expect(T.RBRACE);
    const qualifiers = [];
    while (at(T.LBRACKET) && isPolymetricQualifier()) {
      qualifiers.push(parseQualifier());
    }
    if (at(T.COLON) && !current().spaceBefore && estNombreDeDuree(peek(1))) {
      const tokColon = current();
      advance();
      dureeCollee = parseColonFrame(tokColon);
    }
    let settings = null;
    if (isRuntimeQualifier() && !current().spaceBefore) {
      settings = parseRuntimeQualifier();
    }
    const groupe = { type: "Polymetric", voices, qualifiers, settings, label: label || null };
    return dureeCollee ? cadreDuree(dureeCollee, [groupe]) : groupe;
  }
  const estNombreDeDuree = (t) => t && (t.type === T.INT || t.type === T.FLOAT);
  function parseColonFrame(tok) {
    if (at(T.FLOAT)) {
      const brut = String(advance().value);
      const decimales = (brut.split(".")[1] || "").length;
      let n = Math.round(Number(brut) * 10 ** decimales), d = 10 ** decimales;
      const pgcd = (a, b) => b === 0 ? a : pgcd(b, a % b);
      const g = pgcd(n, d) || 1;
      n /= g;
      d /= g;
      if (d === 1) {
        return { type: "NumericTerminal", kind: "numeric-terminal", value: n, line: (tok || current()).line };
      }
      return { type: "NumericDuration", numerator: n, denominator: d };
    }
    const num = expect(T.INT).value;
    if (at(T.SLASH) && peek(1).type === T.INT) {
      advance();
      const den = expect(T.INT).value;
      if (at(T.SLASH) && !current().spaceBefore) {
        throw new ParseError(
          `'${num}/${den}/\u2026' : deux nombres se touchent, et rien ne dit o\xF9 le premier finit \u2014 '${num}/${den}' suivi d'un chiffre coll\xE9 se relit '${num}' puis '${String(den).slice(0, 1)}\u2026', ou autrement. On ne juxtapose jamais : s\xE9parer par une ESPACE`,
          current()
        );
      }
      return { type: "NumericDuration", numerator: Number(num), denominator: Number(den) };
    }
    return { type: "NumericTerminal", kind: "numeric-terminal", value: Number(num), line: (tok || current()).line };
  }
  function cadreDuree(premiereVoix, contenu) {
    return {
      type: "Polymetric",
      voices: [[premiereVoix], contenu],
      qualifiers: [],
      settings: null,
      label: null
    };
  }
  function isPolymetricQualifier() {
    return false;
  }
  function parseVariable() {
    const tok = current();
    expect(T.PIPE);
    const name = expect(T.IDENT).value;
    expect(T.PIPE);
    throw new ParseError(
      `'|${name}|' : le nom entre barres est sorti du langage \u2014 \xE9crire '${name}' nu. La graphie reste lisible en entr\xE9e BP3, elle ne s'\xE9crit plus dans une sc\xE8ne BPScript. \u26A0\uFE0F V\xE9rifier qu'aucun terminal de l'alphabet en port\xE9e ne s'appelle d\xE9j\xE0 '${name}' : la barre distinguait le non-terminal, le nom nu ne le distingue plus.`,
      tok
    );
  }
  function parseWildcard() {
    expect(T.QUESTION);
    if (at(T.INT)) return { type: "Wildcard", index: Number(advance().value) };
    return { type: "Wildcard" };
  }
  function lireArgumentsDeGabarit(sigil, nom) {
    const args = [];
    advance();
    while (!at(T.RPAREN) && !atEnd()) {
      const avant = pos;
      let key = null;
      if (at(T.IDENT) && peek(1).type === T.COLON) {
        key = advance().value;
        advance();
      }
      let value;
      if (at(T.INT)) value = { type: "Literal", value: Number(advance().value) };
      else if (at(T.IDENT)) value = { type: "Literal", value: advance().value };
      args.push({ type: "Arg", key, value });
      if (at(T.COMMA)) advance();
      if (pos === avant) {
        throw new ParseError(
          `'${sigil}${nom}(\u2026${current().value}\u2026)' : '${current().value}' n'a pas sa place dans les arguments d'un gabarit \u2014 ils s'\xE9crivent 'nom:valeur', s\xE9par\xE9s par des virgules. Pour poser un R\xC9GLAGE sur la r\xE8gle, une ESPACE le d\xE9tache du gabarit ('${sigil}${nom} (${key || "cl\xE9"}:\u2026)') ; pour une VITESSE, qui n'est pas une paire, le point d'exclamation la pose dans le flux ('${sigil}${nom} ! (*2/3)')`,
          current()
        );
      }
    }
    expect(T.RPAREN);
    return args;
  }
  function parseTemplateMaster() {
    expect(T.DOLLAR);
    if (at(T.LBRACE)) {
      advance();
      const elements = [];
      while (!at(T.RBRACE) && !atEnd()) {
        if (at(T.NEWLINE)) {
          advance();
          continue;
        }
        const el = parseRhsElement();
        if (el) elements.push(el);
        else break;
        refuserSuffixeArobase();
      }
      expect(T.RBRACE);
      return { type: "TemplateMasterGroup", elements };
    }
    if (!at(T.IDENT) || current().spaceBefore) {
      return { type: "TemplateAnchor", kind: "master" };
    }
    const name = expect(T.IDENT).value;
    let args = null;
    if (at(T.LPAREN) && !current().spaceBefore && !isRuntimeQualifier()) {
      args = lireArgumentsDeGabarit("$", name);
    }
    return { type: "TemplateMaster", name, args };
  }
  function parseTemplateSlave() {
    expect(T.AMPERSAND);
    if (at(T.LBRACE)) {
      advance();
      const elements = [];
      while (!at(T.RBRACE) && !atEnd()) {
        if (at(T.NEWLINE)) {
          advance();
          continue;
        }
        const el = parseRhsElement();
        if (el) elements.push(el);
        else break;
        refuserSuffixeArobase();
      }
      expect(T.RBRACE);
      return { type: "TemplateSlaveGroup", elements };
    }
    const name = expect(T.IDENT).value;
    let args = null;
    if (at(T.LPAREN) && !current().spaceBefore && !isRuntimeQualifier()) {
      args = lireArgumentsDeGabarit("&", name);
    }
    return { type: "TemplateSlave", name, args };
  }
  function parseWait() {
    expect(T.TRIGGER_IN);
    if (at(T.IDENT) && current().spaceBefore) {
      throw new ParseError(
        `'<! ${current().value}' : rien ne s'intercale entre le point d'attente et ce qu'il attend \u2014 ils forment un seul terme. \xC9crire '<!${current().value}'.`,
        current()
      );
    }
    const name = expect(T.IDENT).value;
    let address = null;
    const colle = at(T.PERIOD) && !current().spaceBefore;
    if (colle && (peek(1).type === T.IDENT || peek(1).type === T.INT) && !peek(1).spaceBefore) {
      advance();
      const jeton = advance();
      address = jeton.type === T.INT ? Number(jeton.value) : jeton.value;
      if ((at(T.IDENT) || at(T.INT)) && !current().spaceBefore) {
        throw new ParseError(
          `'<!${name}.${jeton.value}${current().value}' : l'adresse est SUIVIE DE '${current().value}' sans s\xE9parateur. Une adresse est UN seul jeton \u2014 un identifiant ('<!${name}.suivant') ou un entier ('<!${name}.60'). S\xE9parer par une espace ce qui doit \xEAtre un terme distinct.`,
          current()
        );
      }
    } else if (colle) {
      throw new ParseError(
        `'<!${name}.' suivi de '${peek(1).value ?? peek(1).type}' : ce n'est pas une adresse. Une adresse est un identifiant ('<!${name}.suivant') ou un entier ('<!${name}.60'), coll\xE9 au point des deux c\xF4t\xE9s. Sans adresse, \xE9crire '<!${name}' seul \u2014 l'attente se l\xE8ve alors sur n'importe quel \xE9v\xE9nement de ce r\xF4le, et c'est une forme diff\xE9rente, pas un raccourci.`,
        current()
      );
    }
    const qualifiers = [];
    if (at(T.LBRACKET)) refuserCrochetColle();
    const suffixQualifiers = [];
    while (at(T.LPAREN) && isRuntimeQualifier()) suffixQualifiers.push(parseRuntimeQualifier());
    return {
      type: "Wait",
      name,
      ...address !== null ? { address } : {},
      qualifiers,
      ...suffixQualifiers.length ? { suffixQualifiers } : {}
    };
  }
  function refuserTempx(key, tok, signeOuvrant) {
    if (key !== "tempx" && key !== "tempo") return;
    throw new ParseError(
      `'${signeOuvrant === "[" ? "[" : "("}${key}:\u2026${signeOuvrant === "[" ? "]" : ")"}' : '${key}' ne s'\xE9crit pas dans une r\xE8gle \u2014 le multiplicateur de vitesse EST l'op\xE9rateur, et il se pose dans le flux : '! (/N)' ralentit, '! (*N/M)' \xE9crit la m\xEAme chose en fraction inverse (d\xE9cision Romain 2026-08-06). Le m\xE9tronome de la sc\xE8ne, lui, s'\xE9crit en t\xEAte : 'tempo:120'`,
      tok
    );
  }
  function checkQualifierKey(key, tok) {
    refuserTempx(key, tok, "[");
    if (key === "speed") {
      throw new ParseError(`'[speed:N]' a \xE9t\xE9 supprim\xE9 (d\xE9cision 2026-06-26) \u2014 la dur\xE9e s'\xE9crit avec ':' : '{A B}:2' (groupe), 'A4:1/2' (note) ou '}:N' (embedding)`, tok);
    }
    if (key === "shuffle") {
      throw new ParseError(`'[shuffle:N]' retir\xE9 \u2014 la graine s'\xE9crit 'seed:N' (en t\xEAte de sc\xE8ne) ou '![seed:N]' (dans le flux) ; '[shuffle]' brasse seul`, tok);
    }
    if (libCtx.qualifierKeys.has(key)) {
      throw new ParseError(
        `'[${key}:\u2026]' : '${key}' est un r\xE9glage, il s'\xE9crit entre PARENTH\xC8SES \u2014 '(${key}:\u2026)' (d\xE9cision Romain 2026-08-02, LANGUAGE.md:773-800). Le crochet ne porte plus que ce qui gouverne la d\xE9rivation elle-m\xEAme : un test de drapeau ('[flag]', '[flag==1]'), une affectation ('[flag=1]'), ou le rang d'une forme de gabarit ('[3]')`,
        tok
      );
    }
    if (universeSacs().runtime.has(key)) {
      const valeurNumerique = (at(T.INT) || at(T.FLOAT)) && (peek(1).type === T.RBRACKET || peek(1).type === T.COMMA || peek(1).type === T.SLASH);
      if (key === "scale" && valeurNumerique) {
        throw new ParseError(
          `'[scale:N]' a \xE9t\xE9 SUPPRIM\xC9 (d\xE9cision Romain 2026-07-26) \u2014 la mise \xE0 l'\xE9chelle temporelle d'un groupe s'\xE9crit avec la DUR\xC9E COLL\xC9E : '{A B}:N'. (\xC0 ne pas confondre avec la gamme microtonale, qui est un contr\xF4le de runtime : '(scale:nom cl\xE9)'.)`,
          tok
        );
      }
      throw new ParseError(
        `'[${key}:\u2026]' : '${key}' est un contr\xF4le de RUNTIME, il s'\xE9crit entre PARENTH\xC8SES \u2014 '(${key}:\u2026)', ou '!(${key}:\u2026)' pour le poser dans le flux. Les crochets s'adressent au MOTEUR`,
        tok
      );
    }
    if (universeControlNames().has(key)) {
      if (universeRuleScopeControls().has(key)) return;
      if (!universeRuleAllowedControls().has(key)) return;
      throw new ParseError(
        `'[${key}:\u2026]' : le crochet ne porte que ce qui gouverne la D\xC9RIVATION \u2014 un test de drapeau ('[flag]', '[flag==1]'), une affectation ('[flag=1]'), une proc\xE9dure de d\xE9rivation ('[goto:\u2026]', '[repeat:\u2026]', '[failed:\u2026]', '[stop]') ou le rang d'une forme de gabarit ('[3]'). '${key}' d\xE9crit ce que la d\xE9rivation PRODUIT : il s'\xE9crit entre PARENTH\xC8SES (d\xE9cision Romain 2026-08-08, LANGUAGE.md \xA7\xAB Le crochet \xBB).`,
        tok
      );
    }
    throw new ParseError(
      `cl\xE9 '[${key}:\u2026]' inconnue \u2014 ni contr\xF4le de librairie, ni garde, ni affectation, ni rang de gabarit ; v\xE9rifier l'orthographe, ou la librairie qui la d\xE9clare. '[${key}:\u2026]' et '![${key}:\u2026]' (contr\xF4le moteur) ne sont PAS interchangeables avec '(${key}:\u2026)' (param\xE8tre de runtime)`,
      tok
    );
  }
  function parseVitesseParenthese() {
    expect(T.LPAREN);
    const operator = at(T.STAR) ? (advance(), "*") : (expect(T.SLASH), "/");
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
        `'! (${operator}\u2026)' attend un nombre ou une fraction \u2014 '! (/2)', '! (*3/2)', '! (/1.5)'`,
        current()
      );
    }
    expect(T.RPAREN);
    return { type: "Qualifier", pairs: [], tempoOp: { type: "TempoOp", operator, value, scope: "relative" } };
  }
  function parseQualifier(tempoScope = "absolute") {
    expect(T.LBRACKET);
    if (atAny(T.SLASH, T.STAR)) {
      const signe = at(T.STAR) ? "*" : "/";
      throw new ParseError(
        `'[${signe}N]' : l'op\xE9rateur de vitesse s'\xE9crit entre PARENTH\xC8SES et se pose dans le FLUX \u2014 '! (${signe}N)' (d\xE9cision Romain 2026-08-06). Il ne vit nulle part ailleurs : ni en suffixe de r\xE8gle, ni coll\xE9 \xE0 un \xE9l\xE9ment. '/N' acc\xE9l\xE8re, '*N/M' \xE9crit la m\xEAme chose en fraction inverse`,
        current()
      );
    }
    const pairs = [];
    while (!at(T.RBRACKET) && !atEnd()) {
      const keyTok = current();
      const key = expect(T.IDENT).value;
      if (!at(T.COLON)) {
        pairs.push({ type: "QualPair", key, value: true, decrement: null });
        if (at(T.COMMA)) advance();
        continue;
      }
      const apresDeuxPoints = current();
      expect(T.COLON);
      checkQualifierKey(key, keyTok);
      if (!at(T.RBRACKET) && !atEnd() && current().spaceBefore) {
        throw new ParseError(
          `'${key}: ' \u2014 pas d'espace apr\xE8s le deux-points : la valeur commence imm\xE9diatement ('${key}:${current().value}\u2026'). L'espace ne s\xE9pare que les PARTIES d'une valeur`,
          current()
        );
      }
      void apresDeuxPoints;
      if (libCtx.controlNames.has(key)) {
        let rawValue = "";
        while (!at(T.RBRACKET) && !atEnd()) {
          if (at(T.COMMA)) {
            const suite = peek(1);
            const ouvreUnElement = suite.type === T.IDENT && (peek(2).type === T.COLON || peek(2).type === T.RBRACKET || peek(2).type === T.COMMA);
            if (!ouvreUnElement) {
              throw new ParseError(
                `'[${key}: ${rawValue.trim()},\u2026]' : la virgule s\xE9pare les \xC9L\xC9MENTS du sac, pas les parties d'une valeur (liste positionnelle supprim\xE9e le 2026-07-26) \u2014 \xE9crire '[${key}:${rawValue.trim()} \u2026]', les parties s\xE9par\xE9es par une ESPACE`,
                current()
              );
            }
            break;
          }
          const t = current();
          if (t.type === T.COLON) {
            throw new ParseError(
              `'[${key}: ${rawValue.trim()}:\u2026]' : le deux-points AFFECTE une valeur, il n'en s\xE9pare pas les parties \u2014 une paire n'en porte qu'un. Les parties d'une valeur se s\xE9parent par une ESPACE ('[${key}:3 0]')`,
              t
            );
          }
          if (rawValue.length > 0 && t.type !== T.RPAREN && t.type !== T.COMMA) {
            const lastChar = rawValue[rawValue.length - 1];
            if (lastChar !== "(" && t.type !== T.LPAREN && lastChar !== ",") {
              const isSlash = t.type === T.SLASH || lastChar === "/";
              const isEquals = t.type === T.EQUALS || lastChar === "=";
              if (lastChar !== "-" && !isSlash && !isEquals) rawValue += " ";
            }
          }
          rawValue += advance().value;
        }
        rawValue = rawValue.trim();
        if (rawValue === "") {
          throw new ParseError(
            `'[${key}:]' n'affecte aucune valeur \u2014 le deux-points en attend une (par exemple '[${key}:3 0]'), et un contr\xF4le sans argument s'\xE9crit nu, sans deux-points`,
            keyTok
          );
        }
        pairs.push({ type: "QualPair", key, value: rawValue, decrement: null });
        if (at(T.COMMA)) advance();
        continue;
      }
      const gardeElement = () => {
        if (at(T.IDENT) && peek(1).type === T.COLON) {
          throw new ParseError(
            `'[${key}:\u2026 ${current().value}:\u2026]' : deux \xC9L\xC9MENTS du sac s\xE9par\xE9s par une ESPACE \u2014 il leur manque une VIRGULE ('[${key}:\u2026, ${current().value}:\u2026]'). L'espace ne s\xE9pare que les PARTIES d'une m\xEAme valeur`,
            current()
          );
        }
      };
      const { value, decrement } = readQualifierValue();
      gardeElement();
      pairs.push({ type: "QualPair", key, value, decrement });
      if (at(T.COMMA)) advance();
    }
    expect(T.RBRACKET);
    return { type: "Qualifier", pairs, tempoOp: null };
  }
  function readQualifierValue() {
    let value, decrement = null;
    if (at(T.INT)) {
      const num = advance().value;
      if (at(T.PLUS) && peek(1).type === T.INT) {
        let sig = num;
        while (at(T.PLUS) && peek(1).type === T.INT) {
          sig += advance().value;
          sig += advance().value;
        }
        if (at(T.SLASH) && peek(1).type === T.INT) {
          sig += advance().value;
          sig += advance().value;
        }
        value = sig;
      } else if (at(T.SLASH) && peek(1).type === T.INT) {
        advance();
        const denom = advance().value;
        value = `${num}/${denom}`;
      } else {
        value = Number(num);
        if (at(T.REST) && peek(1).type === T.INT) {
          advance();
          decrement = Number(advance().value);
        }
      }
    } else if (at(T.FLOAT)) {
      value = Number(advance().value);
    } else if (at(T.REST)) {
      const sign = advance().value;
      value = sign + (at(T.INT) ? advance().value : "");
    } else if (at(T.IDENT)) {
      value = advance().value;
      if (at(T.EQUALS) && peek(1).type === T.INT) {
        advance();
        value = `${value}=${advance().value}`;
      } else if (at(T.LPAREN)) {
        advance();
        const arg = at(T.IDENT) ? advance().value : expect(T.INT).value;
        expect(T.RPAREN);
        value = `${value}(${arg})`;
      }
    }
    return { value, decrement };
  }
  return parseScene();
}

// src/transpiler/resolution.js
function* noeuds(n, vus = /* @__PURE__ */ new Set()) {
  if (!n || typeof n !== "object" || vus.has(n)) return;
  vus.add(n);
  if (Array.isArray(n)) {
    for (const e of n) yield* noeuds(e, vus);
    return;
  }
  yield n;
  for (const k of Object.keys(n)) yield* noeuds(n[k], vus);
}
function declarationsDe(ast) {
  const table = /* @__PURE__ */ new Map();
  const poser = (nom, parent, noeud) => {
    if (!nom || table.has(nom)) return;
    table.set(nom, { parent, noeud, origine: [...noeud.settings && noeud.settings.pairs || []] });
  };
  for (const d of ast && ast.defs || []) if (d) poser(d.name, null, d);
  for (const v of ast && ast.vars || []) {
    if (!v || !v.varType || v.varType.kind !== "type") continue;
    for (const n of v.names || []) poser(n, v.varType.type, v);
  }
  return table;
}
function heriterDesPrototypes(ast) {
  const table = declarationsDe(ast);
  let greffes = 0;
  for (const [nom, decl] of table) {
    if (!decl.parent) continue;
    const portees = new Set(decl.origine.map((p) => p.key));
    const vus = /* @__PURE__ */ new Set([nom]);
    let parent = decl.parent;
    while (parent && !vus.has(parent) && table.has(parent)) {
      vus.add(parent);
      const proto = table.get(parent);
      for (const par of proto.origine) {
        if (portees.has(par.key)) continue;
        portees.add(par.key);
        if (!decl.noeud.settings) decl.noeud.settings = { type: "SettingBag", pairs: [] };
        decl.noeud.settings.pairs.push({ ...par, herite: true });
        greffes++;
      }
      parent = proto.parent;
    }
  }
  return greffes;
}
function resoudre(ast, environnement) {
  const diagnostics = [];
  let examines = 0;
  for (const _ of noeuds(ast)) examines++;
  const greffes = heriterDesPrototypes(ast);
  void environnement;
  return { ast, diagnostics, examines, greffes };
}
var dernierCompte = null;
function noterLePassage(compte) {
  dernierCompte = compte;
}

// src/transpiler/segmentation.js
function segmenter(nom, terminaux) {
  if (!nom || terminaux.has(nom)) return null;
  const longueurs = [...new Set([...terminaux].map((t) => t.length))].sort((a, b) => b - a);
  const parts = [];
  let i = 0;
  while (i < nom.length) {
    let pris = null;
    for (const L of longueurs) {
      if (L > nom.length - i) continue;
      const bout = nom.slice(i, i + L);
      if (terminaux.has(bout)) {
        pris = bout;
        break;
      }
    }
    if (!pris) return { parts: null, reste: nom.slice(i) };
    parts.push(pris);
    i += pris.length;
  }
  return parts.length > 1 ? { parts, reste: null } : null;
}

// src/transpiler/actorResolver.js
function expandAlphabetTerminals(alphabetLib, octavesOverride) {
  const terminals = /* @__PURE__ */ new Set();
  if (!alphabetLib || !nomsDeTerminaux(alphabetLib)) return terminals;
  const octaveConvention = octavesOverride != null ? octavesOverride : alphabetLib.octaves;
  const candidate = octaveConvention ? loadLib("octaves", octaveConvention) : null;
  const octaveDef = candidate && Array.isArray(candidate.registers) ? candidate : null;
  const alts = alphabetLib.alterations && typeof alphabetLib.alterations === "object" && !Array.isArray(alphabetLib.alterations) ? Object.keys(alphabetLib.alterations) : Array.isArray(alphabetLib.alterations) && alphabetLib.alterations.length > 0 ? alphabetLib.alterations : [""];
  for (const note of nomsDeTerminaux(alphabetLib)) {
    if (octaveDef) {
      for (const alt of alts) {
        for (const reg of octaveDef.registers) {
          const noteAlt = note + alt;
          const terminal = octaveDef.position === "suffix" ? noteAlt + octaveDef.separator + reg : reg + octaveDef.separator + noteAlt;
          terminals.add(terminal);
        }
      }
    } else {
      terminals.add(note);
    }
  }
  return terminals;
}
function alphabetHerite(ast) {
  const sceneAlpha = (ast.directives || []).find((d) => d.name === "alphabet" && d.subkey);
  if (sceneAlpha) {
    return resolveActorAlphabet(sceneAlpha.subkey, ast.directives) ? sceneAlpha.subkey : null;
  }
  if (ast.libRefs && ast.libRefs.length) return null;
  return loadLib("core")?.defaults?.components?.alphabet || null;
}
function octavesHerite(ast, alphabetKey) {
  const connu = (nom) => !!(nom && loadLib("octaves")?.[nom]);
  const sceneOct = (ast.directives || []).find((d) => d.name === "octaves" && (d.subkey || d.runtime));
  if (sceneOct) {
    const nom = sceneOct.subkey || sceneOct.runtime;
    return connu(nom) ? nom : void 0;
  }
  if (!alphabetKey) return void 0;
  const lib = resolveActorAlphabet(alphabetKey, ast.directives);
  return connu(lib && lib.octaves) ? lib.octaves : void 0;
}
function tuningHerite(ast, alphabetKey) {
  const connu = (nom) => !!(nom && loadLib("tuning", nom));
  const sceneTun = (ast.directives || []).find((d) => d.name === "tuning" && d.subkey);
  if (sceneTun) return connu(sceneTun.subkey) ? sceneTun.subkey : void 0;
  if (!alphabetKey) return void 0;
  const lib = resolveActorAlphabet(alphabetKey, ast.directives);
  return connu(lib && lib.tuning) ? lib.tuning : void 0;
}
function defaultActorTransport() {
  const core = loadLib("core");
  return core && core.defaults && core.defaults.components && core.defaults.components.transport || "audio";
}
function sortieHeritee(ast) {
  const sceneOut = (ast.directives || []).find((d) => d.name === "out" && d.subkey);
  const alphaBinding = (ast.directives || []).find((d) => d.name === "alphabet" && d.runtime);
  if (sceneOut && alphaBinding && alphaBinding.runtime !== sceneOut.subkey) {
    return {
      key: sceneOut.subkey,
      params: sceneOut.params || {},
      conflit: {
        ecrite: sceneOut.subkey,
        raccord: alphaBinding.runtime,
        alphabet: alphaBinding.subkey,
        line: sceneOut.line || 0
      }
    };
  }
  if (sceneOut) return { key: sceneOut.subkey, params: sceneOut.params || {}, conflit: null };
  if (alphaBinding) return { key: alphaBinding.runtime, params: {}, conflit: null };
  return { key: defaultActorTransport(), params: {}, conflit: null };
}
function evalHerite(ast) {
  const sceneEval = (ast.directives || []).find((d) => d.name === "eval" && d.subkey);
  if (!sceneEval) return void 0;
  const catalogue = loadLib("eval");
  const connus = catalogue && catalogue.objects || catalogue || {};
  return connus[sceneEval.subkey] ? sceneEval.subkey : void 0;
}
function resolveActors(ast) {
  const errors = [];
  const actorTable = {};
  const terminalActorMap = {};
  verifierActeursReferences(ast, errors);
  if (!ast.actors || ast.actors.length === 0) {
    return { actorTable, terminalActorMap, errors };
  }
  const symbolActorMap = /* @__PURE__ */ new Map();
  for (const actor of ast.actors) {
    const name = actor.name;
    const props = actor.properties;
    let alphabetKey = props.alphabet;
    const herite = [];
    const isCodeVoice = !!props.eval;
    if (!alphabetKey && !isCodeVoice) {
      alphabetKey = alphabetHerite(ast);
      if (alphabetKey) {
        props.alphabet = alphabetKey;
        herite.push({ category: "alphabet", name: alphabetKey });
      }
    }
    if (props.octaves == null && alphabetKey) {
      const oct = octavesHerite(ast, alphabetKey);
      if (oct) {
        props.octaves = oct;
        herite.push({ category: "octaves", name: oct });
      }
    }
    if (props.tuning == null && alphabetKey) {
      const tun = tuningHerite(ast, alphabetKey);
      if (tun) {
        props.tuning = tun;
        herite.push({ category: "tuning", name: tun });
      }
    }
    if (props.transport == null) {
      const sortie = sortieHeritee(ast);
      props.transport = { type: "TransportRef", key: sortie.key, params: sortie.params };
      herite.push({ category: "transport", name: sortie.key, params: sortie.params });
    }
    if (props.eval == null) {
      const interprete = evalHerite(ast);
      if (interprete) {
        props.eval = interprete;
        herite.push({ category: "eval", name: interprete });
      }
    }
    for (const ref of herite) {
      actor.references = actor.references || [];
      if (!actor.references.some((r) => r.category === ref.category)) {
        actor.references.push({ type: "ActorReference", line: actor.line, ...ref });
      }
    }
    let terminals = [];
    if (alphabetKey) {
      const alphabetLib = resolveActorAlphabet(alphabetKey, ast.directives);
      if (!alphabetLib) {
        errors.push({ message: `Alphabet "${alphabetKey}" not found for actor "${name}"`, line: actor.line });
        continue;
      }
      terminals = [...expandAlphabetTerminals(alphabetLib, props.octaves)];
      const alts = alphabetLib.alterations && typeof alphabetLib.alterations === "object" && !Array.isArray(alphabetLib.alterations) ? Object.keys(alphabetLib.alterations) : [""];
      for (const note of nomsDeTerminaux(alphabetLib) || []) for (const alt of alts) terminals.push(note + alt);
    }
    actorTable[name] = {
      alphabet: alphabetKey || null,
      scale: props.scale || null,
      // v0.8 : la clé canonique est `sound` (singulier) ; on lit aussi `sounds`
      // pour rétrocompat avec les sorties de parseur antérieures.
      sounds: props.sound || props.sounds || null,
      transport: props.transport || null,
      eval: props.eval || null,
      symbols: terminals
    };
    for (const terminal of terminals) {
      if (!symbolActorMap.has(terminal)) {
        symbolActorMap.set(terminal, /* @__PURE__ */ new Set());
      }
      symbolActorMap.get(terminal).add(name);
    }
  }
  const actorNames = new Set(Object.keys(actorTable));
  for (const decl of ast.declarations || []) {
    if (decl.runtime && actorNames.has(decl.runtime)) {
      terminalActorMap[decl.name] = decl.runtime;
    }
  }
  for (const sg of ast.subgrammars || []) {
    for (const rule of sg.rules || []) {
      resolveSymbolsInRhs(rule.rhs, symbolActorMap, actorTable, terminalActorMap, errors);
    }
  }
  return { actorTable, terminalActorMap, errors };
}
function verifierActeursReferences(ast, errors) {
  const declares = new Set((ast.actors || []).map((a) => a.name));
  if (declares.size === 0) declares.add("scene");
  for (const d of ast.directives || []) {
    if (d && d.name === "homomorphism" && d.subkey) declares.add(d.subkey);
  }
  const vus = /* @__PURE__ */ new Set();
  const visiter = (elements) => {
    if (!elements) return;
    for (const el of elements) {
      if (!el || typeof el !== "object") continue;
      if (el.actor && !declares.has(el.actor) && !vus.has(el.actor)) {
        vus.add(el.actor);
        const connus = declares.size ? `Acteurs d\xE9clar\xE9s : ${[...declares].join(", ")}.` : "Cette sc\xE8ne ne d\xE9clare aucun acteur.";
        errors.push({
          message: `Acteur inconnu '${el.actor}' dans '${el.actor}.${el.name}' \u2014 un renvoi point\xE9 doit nommer un acteur d\xE9clar\xE9 par actor. ${connus}`,
          line: el.line
        });
      }
      if (el.voices) for (const voix of el.voices) visiter(voix);
      if (el.primary) visiter([el.primary]);
      if (el.secondaries) visiter(el.secondaries);
      if (el.elements) visiter(el.elements);
    }
  };
  for (const sg of ast.subgrammars || []) {
    for (const rule of sg.rules || []) {
      visiter(rule.rhs);
      visiter(rule.lhs);
    }
  }
}
function assignActor(el, actorName) {
  el.actor = actorName;
  if (el.payload && typeof el.payload === "object") el.payload.actor = actorName;
}
function resolveSymbolsInRhs(elements, symbolActorMap, actorTable, terminalActorMap, errors) {
  if (!elements) return;
  for (const el of elements) {
    if (el.type === "Symbol" || el.type === "SymbolCall") {
      if (el.actor) {
        terminalActorMap[el.name] = el.actor;
      } else {
        const actors = symbolActorMap.get(el.name);
        if (actors && actors.size === 1) {
          const actorName = [...actors][0];
          assignActor(el, actorName);
          terminalActorMap[el.name] = actorName;
        } else if (actors && actors.size > 1) {
          if (!terminalActorMap[el.name]) {
            const actorList = [...actors].join(", ");
            errors.push({
              message: `Ambiguous symbol "${el.name}" \u2014 owned by actors: ${actorList}. Use dot notation (e.g. ${[...actors][0]}.${el.name}) or declare with gate ${el.name}:<actor>`,
              line: el.line
            });
          } else {
            assignActor(el, terminalActorMap[el.name]);
          }
        }
      }
    }
    if (el.type === "Polymetric" && el.voices) {
      for (const voice of el.voices) {
        resolveSymbolsInRhs(voice, symbolActorMap, actorTable, terminalActorMap, errors);
      }
    }
    if (el.type === "SimultaneousGroup") {
      if (el.primary) resolveSymbolsInRhs([el.primary], symbolActorMap, actorTable, terminalActorMap, errors);
      if (el.secondaries) resolveSymbolsInRhs(el.secondaries, symbolActorMap, actorTable, terminalActorMap, errors);
    }
  }
}

// src/transpiler/controlValidation.js
function collectQualifierPairs(node, out) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const el of node) collectQualifierPairs(el, out);
    return;
  }
  if (node.type === "SettingBag" && Array.isArray(node.pairs)) {
    for (const p of node.pairs) out.push(p);
  }
  for (const k in node) {
    if (k === "pairs") continue;
    const v = node[k];
    if (v && typeof v === "object") collectQualifierPairs(v, out);
  }
}
function collectDirectiveValues(ast, out) {
  for (const d of ast && ast.directives || []) {
    if (!d || d.type !== "Directive" || typeof d.name !== "string") continue;
    if (d.value === null || d.value === void 0) continue;
    out.push({ key: d.name, value: d.value, line: d.line });
  }
}
function validateControls(ast, controls, qualifies = {}) {
  if (!controls) return [];
  const pairs = [];
  collectQualifierPairs(ast, pairs);
  collectDirectiveValues(ast, pairs);
  const errors = [];
  for (const p of pairs) {
    const def = p.lib && qualifies[`${p.lib}.${p.key}`] || controls[p.key];
    if (!def) continue;
    if (p.value === true) continue;
    const where = { line: p.line, col: p.col };
    if (Array.isArray(def.values)) {
      const v = String(p.value);
      if (!def.values.includes(v)) {
        errors.push({
          message: `valeur '${p.value}' interdite pour le contr\xF4le '${p.key}' (autoris\xE9es : ${def.values.join(", ")})`,
          ...where
        });
      }
      continue;
    }
    if (Array.isArray(def.range) && typeof p.value === "number") {
      const [min, max] = def.range;
      if (p.value < min || p.value > max) {
        errors.push({
          message: `valeur ${p.value} hors plage pour le contr\xF4le '${p.key}' (${min}..${max})`,
          ...where
        });
      }
    }
  }
  return errors;
}

// src/transpiler/bpxAst.js
var restesDeSegmentation = /* @__PURE__ */ new WeakMap();
function poserLeDestinataireDesReglages(ast, libCtx) {
  const table = libCtx?.controlResolvedBy || {};
  const tableQualifiee = libCtx?.controlQualifiedResolvedBy || {};
  const vu = /* @__PURE__ */ new Set();
  const walk = (n) => {
    if (!n || typeof n !== "object" || vu.has(n)) return;
    vu.add(n);
    if (Array.isArray(n)) {
      for (const x of n) walk(x);
      return;
    }
    const params = n.payload && n.payload.params;
    if (params && typeof params === "object") {
      const origine = /* @__PURE__ */ new Map();
      const noter = (liste) => {
        for (const pr of liste || []) if (pr && pr.lib) origine.set(pr.key, pr.lib);
      };
      noter(n.pairs);
      for (const sq of n.suffixQualifiers || []) noter(sq && sq.pairs);
      const dest = {};
      for (const cle of Object.keys(params)) {
        const lib = origine.get(cle);
        const qualifie = lib ? tableQualifiee[`${lib}.${cle}`] : void 0;
        if (qualifie) dest[cle] = qualifie;
        else if (table[cle]) dest[cle] = table[cle];
      }
      if (Object.keys(dest).length) n.payload.resolvedBy = dest;
    }
    for (const v of Object.values(n)) walk(v);
  };
  walk(ast);
}
function annotateBackticks(ast) {
  let counter = 0;
  const isBt = (el) => el && (el.type === "BacktickStandalone" || el.type === "BacktickInline");
  const label = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== "object") continue;
      if (isBt(el)) {
        el._btName = `BT${el.tag || "auto"}${counter++}`;
        el.payload = { ...el.payload || {}, nature: "code", interp: el.tag || "auto" };
      }
      if (el.elements) label(el.elements);
      if (el.voices) for (const v of el.voices) label(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) label(rule.rhs);
  const acteurEval = {};
  for (const a of ast.actors || []) if (a.properties && a.properties.eval) acteurEval[a.name] = a.properties.eval;
  const sceneEval = (ast.directives || []).find((d) => d.name === "eval" && (d.subkey || d.runtime));
  const socleEval = loadLib("core")?.defaults?.components?.eval;
  const parDefaut = sceneEval && (sceneEval.subkey || sceneEval.runtime) || socleEval || null;
  const resoudre2 = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== "object") continue;
      if (isBt(el) && el.payload && el.payload.interp === "auto") {
        const proche = el.actor && acteurEval[el.actor] || parDefaut;
        if (proche) el.payload.interp = proche;
      }
      if (el.elements) resoudre2(el.elements);
      if (el.voices) for (const v of el.voices) resoudre2(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) resoudre2(rule.rhs);
  if (parDefaut) {
    const poser = (n) => {
      if (n && typeof n === "object" && /^Backtick/.test(n.type || "") && !n.tag) n.tag = parDefaut;
    };
    for (const b of ast.backticks || []) poser(b);
    for (const e of ast.init || []) poser(e);
    for (const d of ast.defs || []) if (d && d.kind === "code" && !d.tag) d.tag = parDefaut;
    for (const dec of ast.declarations || []) if (dec && dec.curve && !dec.curve.tag) dec.curve.tag = parDefaut;
  }
  const errors = [];
  const scanOrphans = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== "object") continue;
      if (isBt(el) && el.payload && el.payload.interp === "auto") {
        errors.push({
          message: `Backtick sans langage \u2014 il doit \xEAtre connu, jamais devin\xE9. Le langage vient de la place la plus proche qui le nomme : un TAG dans le bloc (\`js: \u2026\`), un ACTEUR qui qualifie le bloc par le point ('actor drums eval.<moteur>' puis \`drums.\`\u2026\`\`), une ligne 'eval.<moteur>' en t\xEAte de sc\xE8ne, ou le socle 'core' \u2014 qui porte 'js'. Aucun des quatre n'a r\xE9pondu : le catalogue 'core' n'expose pas 'defaults.components.eval'.`,
          line: el.line
        });
      }
      if (el.elements) scanOrphans(el.elements);
      if (el.voices) for (const v of el.voices) scanOrphans(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) scanOrphans(rule.rhs);
  return errors;
}
function applyEnvironmentDefaults(ast, env) {
  if (!ast || !env || typeof env !== "object") return;
  if (env.tempo != null && !hasTempoDirective(ast)) {
    (ast.directives = ast.directives || []).push({
      type: "Directive",
      name: "tempo",
      subkey: null,
      runtime: null,
      value: env.tempo,
      modifiers: null,
      fromEnvironment: true,
      // provenance : défaut d'environnement, pas déclaré dans la source
      line: 0
    });
  }
}
function hasTempoDirective(ast) {
  return (ast.directives || []).some(
    (d) => d && d.type === "Directive" && d.name === "tempo"
  );
}
var INLINE_FLIP_PALIER4 = true;
function singleCharAlphabetSet(libCtx) {
  const terms = libCtx && libCtx.alphabetTerminals || [];
  if (terms.length === 0) return null;
  for (const t of terms) {
    if (typeof t !== "string" || t.length !== 1) return null;
  }
  return new Set(terms);
}
function tokenizeCompoundName(name, terminals) {
  if (name.length < 2) return null;
  const toks = [];
  let i = 0;
  while (i < name.length) {
    let best = null;
    for (const t of terminals) {
      if (name.startsWith(t, i) && (best === null || t.length > best.length)) best = t;
    }
    if (best !== null) {
      toks.push({ kind: "terminal", text: best });
      i += best.length;
      continue;
    }
    const ch = name[i];
    if (ch >= "A" && ch <= "Z") {
      let j = i + 1;
      while (j < name.length && /[A-Za-z0-9]/.test(name[j])) j++;
      toks.push({ kind: "variable", text: name.slice(i, j) });
      i = j;
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      let j = i + 1;
      while (j < name.length && name[j] >= "0" && name[j] <= "9") j++;
      toks.push({ kind: "number", text: name.slice(i, j) });
      i = j;
      continue;
    }
    return null;
  }
  return toks.length < 2 ? null : toks;
}
function makeSplitAtom(original, ch, isFirst) {
  const node = { type: "Symbol", name: ch };
  if (original.line !== void 0) node.line = original.line;
  if (original.actor !== void 0) node.actor = original.actor;
  if (isFirst && original.negated === true) node.negated = true;
  if (isFirst && original.payload !== void 0) node.payload = original.payload;
  return node;
}
function splitLhsElement(el, terminals) {
  if (!el || el.type !== "Symbol") return [el];
  const toks = tokenizeCompoundName(el.name, terminals);
  if (toks === null || toks.some((t) => t.kind === "number")) return [el];
  return toks.map((t, i) => makeSplitAtom(el, t.text, i === 0));
}
function splitRhsElement(el, terminals) {
  if (!el || typeof el !== "object") return [el];
  if (el.type === "Symbol") {
    const toks = tokenizeCompoundName(el.name, terminals);
    if (toks === null) return [el];
    return toks.map((t, i) => t.kind === "number" ? { type: "NumericDuration", numerator: Number(t.text), denominator: 1 } : makeSplitAtom(el, t.text, i === 0));
  }
  if (el.type === "Polymetric" && Array.isArray(el.voices)) {
    return [{ ...el, voices: el.voices.map((v) => v.flatMap((c) => splitRhsElement(c, terminals))) }];
  }
  if ((el.type === "TemplateMasterGroup" || el.type === "TemplateSlaveGroup") && Array.isArray(el.elements)) {
    return [{ ...el, elements: el.elements.flatMap((c) => splitRhsElement(c, terminals)) }];
  }
  return [el];
}
function splitCompoundTerminals(ast, libCtx) {
  const terminals = singleCharAlphabetSet(libCtx);
  if (!terminals) return;
  for (const sub of ast.subgrammars || []) {
    for (const rule of sub.rules || []) {
      rule.lhs = rule.lhs.flatMap((el) => splitLhsElement(el, terminals));
      rule.rhs = rule.rhs.flatMap((el) => splitRhsElement(el, terminals));
    }
  }
}
var CTX_METAVAR_RE = /^\?\d+$/;
var isCtxWildcardName = (s) => s === "?" || CTX_METAVAR_RE.test(s);
function ctxSymbolToElement(sym, line) {
  if (sym === "?") return { type: "Wildcard", line };
  if (CTX_METAVAR_RE.test(sym)) return { type: "Variable", index: parseInt(sym.slice(1), 10), line };
  return { type: "Symbol", name: sym, line };
}
function canonicalizeLhsContext(ctx, line, asRuleContext) {
  const symbols = ctx.symbols || [];
  const single = symbols.length === 1;
  const allLiteral = symbols.every((s) => !isCtxWildcardName(s));
  const negated = ctx.positive === false;
  if (single && allLiteral && negated) {
    return { inline: { type: "Symbol", name: symbols[0], negated: true, line } };
  }
  if (single && !allLiteral) {
    if (symbols[0] === "?") return { inline: { type: "Wildcard", negated, line } };
    return { inline: { type: "Variable", index: parseInt(symbols[0].slice(1), 10), negated, line } };
  }
  const elements = symbols.map((s) => ctxSymbolToElement(s, line));
  if (asRuleContext) {
    return { remote: {
      type: "Context",
      side: "left",
      positive: !negated,
      kind: "remote",
      elements,
      symbols: [...symbols],
      line
    } };
  }
  return { remote: { type: "Context", negated, elements, line } };
}
function canonicalizeLhsElement(el) {
  if (!el || typeof el !== "object" || el.type !== "Context") return el;
  if (Array.isArray(el.elements)) return el;
  const conv = canonicalizeLhsContext(el, el.line ?? 0, false);
  return conv.inline || conv.remote;
}
function canonicalizeRhsElement(el) {
  if (!el || typeof el !== "object") return el;
  if (el.type === "Context") {
    const symbols = el.symbols || [];
    if (symbols.length === 1 && el.positive === false) {
      return { type: "Wildcard", negated: true };
    }
    return el;
  }
  if (el.type === "Polymetric" && Array.isArray(el.voices)) {
    return { ...el, voices: el.voices.map((v) => v.map((c) => canonicalizeRhsElement(c))) };
  }
  return el;
}
function enrichRemoteHeadContext(ctx, line) {
  if (!ctx || typeof ctx !== "object" || Array.isArray(ctx.elements)) return ctx;
  const symbols = ctx.symbols || [];
  const single = symbols.length === 1;
  const allLiteral = symbols.every((s) => !isCtxWildcardName(s));
  const inlineCategory = single && (!allLiteral || ctx.positive === false);
  if (inlineCategory) return ctx;
  return {
    type: "Context",
    positive: ctx.positive !== false,
    kind: "remote",
    elements: symbols.map((s) => ctxSymbolToElement(s, line)),
    symbols: ctx.symbols,
    line
  };
}
function canonicalizeContexts(ast) {
  for (const sub of ast.subgrammars || []) {
    for (const rule of sub.rules || []) {
      if (Array.isArray(rule.contexts) && rule.contexts.length > 0) {
        rule.contexts = rule.contexts.map((ctx) => enrichRemoteHeadContext(ctx, rule.line ?? 0));
      }
      if (INLINE_FLIP_PALIER4) {
        const seq = [];
        const remoteMarks = [];
        for (const ctx of rule.contexts || []) {
          if (ctx && Array.isArray(ctx.elements)) {
            const mark = { __remote: ctx };
            seq.push(mark);
            remoteMarks.push(mark);
            continue;
          }
          const conv = canonicalizeLhsContext(ctx, rule.line ?? 0, true);
          if (conv.inline) {
            seq.push(conv.inline);
          } else {
            const mark = { __remote: conv.remote };
            seq.push(mark);
            remoteMarks.push(mark);
          }
        }
        const assembled = [...seq, ...rule.lhs];
        const declared = [];
        for (const mark of remoteMarks) {
          const i = assembled.indexOf(mark);
          const rc = mark.__remote;
          if (i === 0) declared.push({ ...rc, side: "left" });
          else if (i === assembled.length - 1) declared.push({ ...rc, side: "right" });
          else {
            throw new ParseError(
              `contexte distant en milieu de motif (autoris\xE9 : d\xE9but ou fin de LHS)`,
              { line: rule.line ?? 0, col: 0 }
            );
          }
        }
        rule.lhs = assembled.filter((x) => !x || !x.__remote);
        rule.contexts = declared;
        rule.lhs = rule.lhs.map(canonicalizeLhsElement);
        rule.rhs = rule.rhs.map(canonicalizeRhsElement);
      }
    }
  }
}
function deriveAlphabetFromTuning(ast) {
  if (!ast) return;
  const tuningAlpha = (tname) => {
    const t = loadLib("tuning", tname);
    return t && t.alphabet || null;
  };
  for (const actor of ast.actors || []) {
    const p = actor.properties || {};
    if (p.tuning && !p.alphabet) {
      const a = tuningAlpha(p.tuning);
      if (a) p.alphabet = a;
    }
  }
  const dirs = ast.directives || [];
  const tun = dirs.find((d) => d.name === "tuning" && d.subkey);
  const alph = dirs.find((d) => d.name === "alphabet" && d.subkey);
  if (tun && !alph) {
    const a = tuningAlpha(tun.subkey);
    if (a) dirs.push({
      type: "Directive",
      name: "alphabet",
      subkey: a,
      runtime: null,
      value: null,
      aliases: null,
      modifiers: null,
      line: tun.line
    });
  }
}
function resolveHomomorphismMarkers(ast) {
  if (!ast || !Array.isArray(ast.homomorphisms) || ast.homomorphisms.length === 0) return;
  const homoNames = new Set(ast.homomorphisms.map((h) => h && h.name).filter(Boolean));
  if (homoNames.size === 0) return;
  const nonterminals = /* @__PURE__ */ new Set();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) (r.lhs || []).forEach((s) => s && s.name && nonterminals.add(s.name));
  const terminals = /* @__PURE__ */ new Set();
  const addAlphabet = (name, octaves) => {
    const lib = resolveActorAlphabet(name, ast.directives);
    if (!lib || !nomsDeTerminaux(lib)) return;
    for (const t of expandAlphabetTerminals(lib, octaves)) terminals.add(t);
    const alts = lib.alterations && typeof lib.alterations === "object" && !Array.isArray(lib.alterations) ? Object.keys(lib.alterations) : [""];
    for (const note of nomsDeTerminaux(lib)) for (const alt of alts) terminals.add(note + alt);
  };
  const sa = (ast.directives || []).find((d) => d.name === "alphabet" && d.subkey);
  const so = (ast.directives || []).find((d) => d.name === "octaves" && (d.subkey || d.runtime));
  if (sa) addAlphabet(sa.subkey, so ? so.subkey || so.runtime : null);
  for (const a of ast.actors || []) {
    const p = a.properties || {};
    if (p.alphabet) addAlphabet(p.alphabet, p.octaves || null);
  }
  const mark = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(mark);
      return;
    }
    if (node.type === "Symbol" && node.name && homoNames.has(node.name) && !nonterminals.has(node.name) && !terminals.has(node.name)) {
      node.role = "homomorphism";
    }
    for (const k in node) {
      const v = node[k];
      if (v && typeof v === "object") mark(v);
    }
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) mark(r.rhs);
}
function terminauxEnPortee(ast) {
  const terminaux = /* @__PURE__ */ new Set();
  const paquets = [];
  const ajouter = (name, octaves) => {
    const lib = resolveActorAlphabet(name, ast.directives);
    if (!lib || !nomsDeTerminaux(lib)) return false;
    const paquet = /* @__PURE__ */ new Set();
    for (const t of expandAlphabetTerminals(lib, octaves)) {
      terminaux.add(t);
      paquet.add(t);
    }
    const alts = lib.alterations && typeof lib.alterations === "object" && !Array.isArray(lib.alterations) ? Object.keys(lib.alterations) : [""];
    for (const note of nomsDeTerminaux(lib)) for (const alt of alts) {
      terminaux.add(note + alt);
      paquet.add(note + alt);
    }
    paquets.push(paquet);
    return true;
  };
  let aUnAlphabet = false;
  const sceneAlpha = (ast.directives || []).find((d) => d.name === "alphabet" && d.subkey);
  const sceneOct = (ast.directives || []).find((d) => d.name === "octaves" && (d.subkey || d.runtime));
  if (sceneAlpha) {
    aUnAlphabet = ajouter(sceneAlpha.subkey, sceneOct ? sceneOct.subkey || sceneOct.runtime : null) || aUnAlphabet;
  }
  for (const a of ast.actors || []) {
    const p = a.properties || {};
    if (p.alphabet) aUnAlphabet = ajouter(p.alphabet, p.octaves || null) || aUnAlphabet;
  }
  for (const ref of ast.libRefs || []) {
    const parts = String(ref).split(".");
    const lib = loadLib(parts.slice(0, -1).join("."), parts[parts.length - 1]);
    if (!lib || !nomsDeTerminaux(lib)) continue;
    aUnAlphabet = ajouter(parts[parts.length - 1], sceneOct ? sceneOct.subkey || sceneOct.runtime : null) || aUnAlphabet;
  }
  for (const d of ast.defs || []) {
    if (d && d.type === "DefDirective" && d.kind === "terminal" && d.name) {
      terminaux.add(d.name);
      for (const paquet of paquets) paquet.add(d.name);
    }
  }
  return { terminaux, aUnAlphabet, paquets };
}
function poserLaVoixDesTerminaux(ast) {
  if (!ast) return;
  const parDef = /* @__PURE__ */ new Map();
  for (const d of ast.defs || []) {
    if (d && d.type === "DefDirective" && d.keys && d.keys.voice) parDef.set(d.name, d.keys.voice.value);
  }
  if (!parDef.size) return;
  const w = (n, vus = /* @__PURE__ */ new WeakSet()) => {
    if (!n || typeof n !== "object" || vus.has(n)) return;
    vus.add(n);
    if (Array.isArray(n)) {
      n.forEach((x) => w(x, vus));
      return;
    }
    if (n.payload && n.payload.nature === "sounding") {
      const nom = typeof n.symbol === "string" ? n.symbol : n.name;
      const voix = parDef.get(nom);
      if (voix !== void 0 && n.payload.voice === void 0) n.payload.voice = voix;
    }
    Object.values(n).forEach((v) => w(v, vus));
  };
  w(ast.subgrammars);
}
function nomsDeclares(ast) {
  const declared = /* @__PURE__ */ new Set();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) (r.lhs || []).forEach((s) => s && declared.add(s.name));
  for (const d of ast.declarations || []) if (d && d.name) declared.add(d.name);
  for (const d of ast.defs || []) {
    if (d && d.type === "DefDirective" && d.name) declared.add(d.name);
  }
  for (const s of ast.scenes || []) if (s && s.name) declared.add(s.name);
  for (const d of ast.directives || []) if (d.name === "homomorphism" && d.subkey) declared.add(d.subkey);
  for (const h of ast.homomorphisms || []) if (h && h.name) declared.add(h.name);
  for (const d of ast.directives || []) if (d.name === "timepatterns" && Array.isArray(d.timePatterns)) {
    for (const tp of d.timePatterns) if (tp && tp.name) declared.add(tp.name);
  }
  for (const v of ast.vars || []) for (const n of v?.names || []) declared.add(n);
  return declared;
}
function segmenterLesTerminaux(ast, known, paquets) {
  const lire = (nom) => {
    let echec = null;
    for (const paquet of paquets) {
      const r = segmenter(nom, paquet);
      if (r && r.parts) return r;
      if (r && r.reste && !echec) echec = r;
    }
    return echec;
  };
  const intouchables = new Set([...nomsDeclares(ast)].filter((n) => !lire(n)?.parts));
  const dansUneListe = (liste) => {
    if (!Array.isArray(liste)) return liste;
    const sortie = [];
    for (const el of liste) {
      if (el && el.type === "Symbol" && el.name && !known.has(el.name) && !intouchables.has(el.name) && el.role !== "homomorphism" && !(Array.isArray(el.compose) && el.compose.length)) {
        const r = lire(el.name);
        if (r && r.parts) {
          for (const part of r.parts) sortie.push({ ...el, name: part });
          continue;
        }
        if (r && r.reste) restesDeSegmentation.set(el, r.reste);
      }
      sortie.push(descendre(el));
    }
    return sortie;
  };
  const CONTENANTS = ["voices", "elements", "content", "symbol", "triggers", "primary", "secondaries"];
  const descendre = (el) => {
    if (!el || typeof el !== "object") return el;
    if (Array.isArray(el)) return dansUneListe(el);
    for (const k of CONTENANTS) if (Array.isArray(el[k])) el[k] = dansUneListe(el[k]);
    return el;
  };
  for (const sg of ast.subgrammars || []) {
    for (const r of sg.rules || []) {
      if (Array.isArray(r.rhs)) r.rhs = dansUneListe(r.rhs);
      if (Array.isArray(r.lhs)) r.lhs = dansUneListe(r.lhs);
    }
  }
}
function validateTerminals(ast) {
  if (!ast) return [];
  const errors = [];
  const codeVoice = new Set((ast.actors || []).filter((a) => (a.properties || {}).eval).map((a) => a.name));
  const { terminaux: known, aUnAlphabet: anyAlphabet } = terminauxEnPortee(ast);
  const declared = nomsDeclares(ast);
  errors.push(...validateCallVocabulary(ast, known, declared, codeVoice, anyAlphabet));
  if (!anyAlphabet) return errors;
  const seen = /* @__PURE__ */ new Set();
  const COMPOSITES = ["voices", "elements", "content", "symbol", "triggers", "primary", "secondaries"];
  const verifier = (el) => {
    if (!el || typeof el !== "object") return;
    if (Array.isArray(el)) {
      el.forEach(verifier);
      return;
    }
    if (el.type === "Symbol" && Array.isArray(el.compose) && el.compose.length) {
      for (const part of el.compose) {
        if (/^[-_.]+$/.test(part) || /[{},]/.test(part)) continue;
        if (known.has(part) || declared.has(part) || seen.has(part)) continue;
        seen.add(part);
        errors.push({
          message: `dans l'objet sonore compos\xE9 '|[\u2026]' : '${part}' n'est d\xE9clar\xE9 nulle part \u2014 absent des alphabets en port\xE9e`,
          line: el.line
        });
      }
      return;
    }
    if ((el.type === "Symbol" || el.type === "OutTimeObject") && el.name && el.role !== "homomorphism" && !(el.payload && codeVoice.has(el.payload.actor)) && !known.has(el.name) && !declared.has(el.name) && !seen.has(el.name)) {
      seen.add(el.name);
      const reste = restesDeSegmentation.get(el);
      const ligne = (ast.directives || []).find((d) => d && d.type === "Directive" && d.name === el.name && typeof d.runtime === "string");
      const cause = ligne && canalFautif(ligne.runtime);
      errors.push({
        message: cause ? `'${el.name}:${ligne.runtime}' d\xE9clare un terminal, et ${cause} La d\xE9claration s'\xE9crit '<nom>:<canal>' \u2014 le terminal n'est pas en cause.` : reste && reste !== el.name ? `terminal '${el.name}' non d\xE9clar\xE9 \u2014 segmentation bloqu\xE9e sur '${reste}', absent des alphabets en port\xE9e` : `terminal '${el.name}' non d\xE9clar\xE9 \u2014 absent des alphabets en port\xE9e`,
        line: el.line
      });
    }
    for (const k of COMPOSITES) if (el[k]) verifier(el[k]);
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) verifier(r.rhs || []);
  const sujetsVus = /* @__PURE__ */ new Set();
  const verifierLesSujets = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(verifierLesSujets);
      return;
    }
    const s = n.subject;
    if (typeof s === "string" && s && s !== "*" && !codeVoice.has(s) && !known.has(s) && !declared.has(s) && !sujetsVus.has(s)) {
      sujetsVus.add(s);
      errors.push({
        message: `sujet de r\xE9glage '${s}:\u2026' : '${s}' ne d\xE9signe aucun terminal \u2014 absent des alphabets en port\xE9e et des noms d\xE9clar\xE9s. Un sujet vise les terminaux de son nom ; '*' vise chaque terminal de la port\xE9e, et l'absence de sujet vise la port\xE9e enti\xE8re`,
        line: n.line
      });
    }
    for (const v of Object.values(n)) if (v && typeof v === "object") verifierLesSujets(v);
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) verifierLesSujets(r);
  return errors;
}
function validateCallVocabulary(ast, known, declared, codeVoice, anyAlphabet) {
  const errors = [];
  const seen = /* @__PURE__ */ new Set();
  const citer = (el) => {
    const parts = (el.args || []).map((a) => {
      const v = a && a.value ? a.value : a;
      const texte = v && Object.prototype.hasOwnProperty.call(v, "value") ? v.value : v;
      return (a && a.key ? `${a.key}:` : "") + texte;
    });
    return `${el.name}(${parts.join(" ")})`;
  };
  const visiter = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(visiter);
      return;
    }
    if (n.type === "SymbolCall" && n.name && !(n.payload && codeVoice.has(n.payload.actor)) && !known.has(n.name) && !declared.has(n.name) && !seen.has(n.name)) {
      const positionnel = (n.args || []).some((a) => a && a.key == null);
      if (anyAlphabet || positionnel) {
        seen.add(n.name);
        const auRegistre = universeControlNames().has(n.name);
        errors.push({
          message: auRegistre ? `appel '${citer(n)}' : '${n.name}' est un contr\xF4le du registre, mais cette sc\xE8ne ne l'a pas import\xE9 \u2014 il a donc \xE9t\xE9 reclass\xE9 en TERMINAL SONNANT, c'est-\xE0-dire en note. D\xE9clarer le socle en t\xEAte de sc\xE8ne ('core')` : `appel '${citer(n)}' : '${n.name}' n'existe pas \u2014 ni contr\xF4le du registre, ni terminal des alphabets en port\xE9e, ni symbole d\xE9clar\xE9. Une fonction g\xE9n\xE9rique n'est pas du langage : chaque intention porte son nom ('[]' pour le moteur, '()' pour le runtime, en 'cl\xE9:valeur')`,
          line: n.line
        });
      }
    }
    for (const k in n) {
      const v = n[k];
      if (v && typeof v === "object") visiter(v);
    }
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) visiter(r.rhs);
  return errors;
}
function applyDefaultActor(ast) {
  if (!ast) return [];
  const errors = [];
  const alphaBinding = (ast.directives || []).find((d) => d.name === "alphabet" && d.runtime);
  if ((ast.actors || []).length > 0) {
    if (alphaBinding) {
      errors.push({
        message: `chevauchement d'acteurs : un binding de sortie sur l'alphabet (alphabet.${alphaBinding.subkey}:${alphaBinding.runtime}) d\xE9signe un acteur implicite, incompatible avec un 'actor' explicite \u2014 choisis l'un OU l'autre`,
        line: alphaBinding.line || 0
      });
    }
    return errors;
  }
  const sortie = sortieHeritee(ast);
  if (sortie.conflit) {
    errors.push({
      message: `deux sorties pour la m\xEAme sc\xE8ne : 'out.${sortie.conflit.ecrite}' et le raccord 'alphabet.${sortie.conflit.alphabet}:${sortie.conflit.raccord}' d\xE9signent des canaux diff\xE9rents \u2014 les deux \xE9critures disent la M\xCAME chose, il faut n'en garder qu'une`,
      line: sortie.conflit.line
    });
  }
  const transportKey = sortie.key;
  const transport = { type: "TransportRef", key: transportKey, params: sortie.params };
  const alphabetKey = alphabetHerite(ast);
  const properties = { transport };
  const references = [{ type: "ActorReference", category: "transport", name: transportKey, line: 0 }];
  if (alphabetKey) {
    properties.alphabet = alphabetKey;
    references.push({ type: "ActorReference", category: "alphabet", name: alphabetKey, line: 0 });
    const oct = octavesHerite(ast, alphabetKey);
    if (oct) {
      properties.octaves = oct;
      references.push({ type: "ActorReference", category: "octaves", name: oct, line: 0 });
    }
    const tun = tuningHerite(ast, alphabetKey);
    if (tun) {
      properties.tuning = tun;
      references.push({ type: "ActorReference", category: "tuning", name: tun, line: 0 });
    }
  }
  const interprete = evalHerite(ast);
  if (interprete) {
    properties.eval = interprete;
    references.push({ type: "ActorReference", category: "eval", name: interprete, line: 0 });
  }
  ast.actors = [{
    type: "ActorDirective",
    name: "scene",
    properties,
    references,
    // Frontière AST (Palier 3) : pas de `soundAssignments:null` — champ non canonique.
    // Canonique = `assignments?` OPTIONNEL (absent ici : l'acteur implicite n'affecte aucun son).
    synthetic: true,
    // acteur implicite (aucun actor déclaré) — panneau Acteurs vide
    line: 0
  }];
  return errors;
}
function applySceneValues(ast, libCtx) {
  const registry2 = libCtx && libCtx.valueRegistry || {};
  const errors = [...libCtx && libCtx.valueRegistryErrors || []];
  const names = Object.keys(registry2);
  if (!names.length) return errors;
  const versNombre = (spec, v) => {
    if (!Array.isArray(spec.range) || typeof v !== "string") return v;
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : v;
  };
  const checkDomain = (name, spec, v, line) => {
    if (Array.isArray(spec.range) && typeof v !== "number") {
      errors.push({ message: `'${name}': '${v}' n'est pas un nombre (attendu : ${spec.range[0]}..${spec.range[1]}${spec.unit ? " " + spec.unit : ""})`, line });
      return false;
    }
    if (typeof v === "number" && Array.isArray(spec.range) && spec.range.length === 2 && (v < spec.range[0] || v > spec.range[1])) {
      errors.push({ message: `'${name}': ${v} hors plage [${spec.range[0]}..${spec.range[1]}]${spec.unit ? " " + spec.unit : ""}`, line });
      return false;
    }
    if (Array.isArray(spec.values) && !spec.values.includes(v)) {
      errors.push({ message: `'${name}': valeur '${v}' inconnue (admises : ${spec.values.join(", ")})`, line });
      return false;
    }
    return true;
  };
  const sceneVals = {};
  for (const d of ast.directives || []) {
    const spec = registry2[d.name];
    if (!spec) continue;
    if (d.value == null) {
      errors.push({ message: `'${d.name}' attend une VALEUR (ex. @${d.name}:440) \u2014 pas un nom`, line: d.line });
      continue;
    }
    const valeur = versNombre(spec, d.value);
    if (checkDomain(d.name, spec, valeur, d.line)) sceneVals[d.name] = valeur;
  }
  const defaultComponents = libCtx && libCtx.defaultComponents || {};
  const sceneComponent = (axis) => {
    const d = (ast.directives || []).find((x) => x.name === axis && x.subkey);
    return d ? d.subkey : void 0;
  };
  const hasNeutralPitch = !!(ast.libRefs && ast.libRefs.length);
  const cascadeDefault = (spec, props) => {
    if (spec.overriddenBy) {
      const chain = Array.isArray(spec.overriddenBy) ? spec.overriddenBy : [spec.overriddenBy];
      let anyAxisDeclared = false;
      for (const ref of chain) {
        const [axis, field] = ref.split(".");
        let compName = props && props[axis] || sceneComponent(axis);
        if (compName == null) {
          const axisInvoked = (ast.directives || []).some((x) => x.name === axis) || hasNeutralPitch;
          if (axisInvoked) {
            anyAxisDeclared = true;
            continue;
          }
          compName = defaultComponents[axis];
        }
        if (compName) {
          const comp = loadLib(axis, compName);
          if (comp && comp[field] != null) return comp[field];
        }
      }
      return anyAxisDeclared ? void 0 : spec.default;
    }
    return spec.default;
  };
  for (const actor of ast.actors || []) {
    const props = actor.properties || {};
    const eParams = props.entityParams || {};
    for (const [axis, params] of Object.entries(eParams)) {
      const entree = props[axis];
      const propres = typeof entree === "string" && loadLib(axis, entree)?.parameters || null;
      for (const k of Object.keys(params)) {
        if (propres && propres[k] !== void 0) continue;
        if (!registry2[k]) {
          errors.push({
            message: `'${axis}.${entree ?? "\u2026"}(${k}:\u2026)' : '${k}' n'est ni un param\xE8tre de '${entree ?? axis}' ni une valeur d\xE9clar\xE9e (socle @core ou librairie invoqu\xE9e)`,
            line: actor.line
          });
        }
      }
    }
    const vals = {};
    for (const name of names) {
      const spec = registry2[name];
      let v;
      for (const params of Object.values(eParams)) {
        if (params && params[name] != null) v = params[name];
      }
      if (v === void 0 && sceneVals[name] !== void 0) v = sceneVals[name];
      if (v === void 0) v = cascadeDefault(spec, props);
      if (v === void 0) continue;
      v = versNombre(spec, v);
      if (checkDomain(name, spec, v, actor.line)) vals[name] = v;
    }
    if (Object.keys(vals).length) actor.values = vals;
  }
  const walkParams = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walkParams);
      return;
    }
    const p = node.payload && node.payload.params;
    if (p) {
      for (const [k, v] of Object.entries(p)) {
        if (registry2[k]) checkDomain(k, registry2[k], v, node.line);
      }
    }
    for (const k in node) {
      if (k !== "payload" && node[k] && typeof node[k] === "object") walkParams(node[k]);
    }
  };
  walkParams(ast.subgrammars);
  return errors;
}
var REFUS_HORS_PORTEE_ACTIF = true;
var PORTEE_DU_PORTEUR = {
  Rule: "rule",
  Polymetric: "group",
  RawBrace: "group",
  InstantControl: "flow",
  Symbol: "symbol",
  SymbolCall: "symbol",
  Wildcard: "symbol",
  Prolongation: "symbol",
  Rest: "symbol",
  TemplateMaster: "symbol",
  TemplateSlave: "symbol"
};
var NOM_DE_PLACE = {
  scene: "en t\xEAte de sc\xE8ne",
  subgrammar: "en t\xEAte de sous-grammaire, dans la parenth\xE8se du mode (`mode:<mode>(<r\xE9glage>)`)",
  rule: "sur une r\xE8gle",
  group: "sur un groupe",
  symbol: "sur un \xE9l\xE9ment",
  flow: "dans le flux"
};
var _porteesPermises = null;
function chargerPorteesPermises() {
  if (_porteesPermises) return _porteesPermises;
  const m = /* @__PURE__ */ new Map();
  const w = (o) => {
    for (const [k, v] of Object.entries(o || {})) {
      if (!v || typeof v !== "object") continue;
      if ("args" in v && "description" in v) {
        if (Array.isArray(v.scope)) m.set(k, v.scope);
      } else w(v);
    }
  };
  w(LIBS.expression);
  w(LIBS.midi);
  w(LIBS.audio);
  w(LIBS.transpo);
  w(LIBS.engine);
  for (const lib of Object.values(LIBS)) {
    const cles = lib?.schema?.addressKeys;
    if (!cles || Array.isArray(cles) || typeof cles !== "object") continue;
    for (const [k, def] of Object.entries(cles)) {
      if (k.startsWith("_") || !def || !Array.isArray(def.scope)) continue;
      m.set(k, def.scope);
    }
  }
  _porteesPermises = { get: (cle) => m.get(cle), has: (cle) => m.has(cle) };
  return _porteesPermises;
}
function refuserEsclaveSansMaitre(ast) {
  const maitres = /* @__PURE__ */ new Set();
  const esclaves = [];
  let ancre = false;
  (function marcher(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const e of n) marcher(e);
      return;
    }
    if (n.type === "TemplateMaster" && n.name) maitres.add(n.name);
    if (n.type === "TemplateAnchor") ancre = true;
    if (n.type === "TemplateSlave" && n.name) esclaves.push(n);
    for (const k in n) marcher(n[k]);
  })(ast);
  if (ancre) return [];
  const vus = /* @__PURE__ */ new Set();
  const erreurs = [];
  for (const e of esclaves) {
    if (maitres.has(e.name) || vus.has(e.name)) continue;
    vus.add(e.name);
    erreurs.push({
      message: `'&${e.name}' rejoue un gabarit que rien ne capture \u2014 aucun '$${e.name}' dans cette sc\xE8ne. Le nom porte l'appariement entre le ma\xEEtre et l'esclave : sans ma\xEEtre, le rejeu n'a pas de choix \xE0 r\xE9p\xE9ter. \xC9crire '$${e.name}' l\xE0 o\xF9 le motif se capture.`,
      line: e.line
    });
  }
  return erreurs;
}
function refuserAttenteNonDeclaree(ast) {
  const connus = /* @__PURE__ */ new Set();
  for (const i of ast.inputs || []) for (const n of i.names || (i.name ? [i.name] : [])) connus.add(n);
  for (const v of ast.vars || []) for (const n of v.names || []) connus.add(n);
  for (const d of ast.declarations || []) if (d && d.name) connus.add(d.name);
  for (const a of ast.actors || []) if (a && a.name) connus.add(a.name);
  const directions = /* @__PURE__ */ new Set();
  for (const canal of Object.values(LIBS.core?.schema?.channels || {})) {
    if (!canal || typeof canal !== "object") continue;
    for (const [cle, valeur] of Object.entries(canal)) {
      if (typeof valeur === "boolean" && valeur === true && cle !== "writable") directions.add(cle);
    }
  }
  const erreurs = [];
  const vus = /* @__PURE__ */ new Set();
  (function marcher(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const e of n) marcher(e);
      return;
    }
    if (n.type === "Wait" && typeof n.name === "string" && !connus.has(n.name) && !directions.has(n.name) && !vus.has(n.name)) {
      vus.add(n.name);
      erreurs.push({
        message: `'<!${n.name}' attend un signal que rien ne d\xE9clare \u2014 aucune entr\xE9e, variable, porte ni acteur de cette sc\xE8ne ne porte le nom '${n.name}'. Le d\xE9clarer : 'in.<canal> ${n.name}'. Sans d\xE9claration, une coquille fabrique une SECONDE attente que rien ne viendra satisfaire, et la d\xE9rivation s'arr\xEAte pour toujours sans un mot.`,
        line: n.line
      });
    }
    for (const k in n) marcher(n[k]);
  })(ast);
  return erreurs;
}
function canalFautif(canal) {
  const cat = LIBS.core?.schema?.channels || {};
  const c = cat[canal];
  if (!c) return `le canal '${canal}' n'existe pas \u2014 les canaux sont ${Object.keys(cat).join(", ")}. La liste est FERM\xC9E.`;
  if (!c.out) return `'${canal}' n'est pas une sortie \u2014 un terminal sonne, il ne se lit pas. Les canaux de sortie sont ${Object.keys(cat).filter((k) => cat[k].out).join(", ")}.`;
  if (!c.writable) return `'${canal}' est une DESTINATION de l'architecture, rout\xE9e comme les autres sorties, mais son \xC9CRITURE dans une sc\xE8ne attend encore son appareil d\xE9di\xE9.`;
  return null;
}
function validateReferences(ast, libCtx = {}) {
  const errors = [];
  const porteesPermises = chargerPorteesPermises();
  const vocab = describeVocabulary([...ast.directives || [], ...ast.actors || []]);
  const controlNames = new Set(vocab.controls.map((c) => c.name));
  const registry2 = new Set(vocab.values.map((v) => v.name));
  const reserved = new Set(vocab.keywords);
  const digitalFns = new Set(vocab.functions);
  const addressKeys2 = new Set(vocab.addressKeys);
  const qualifierKeys = new Set(vocab.qualifierKeys);
  const catalogAxes = Object.keys(vocab.components);
  const componentExists = (axis, name) => (vocab.components[axis] || []).includes(name);
  const instancesDeclarees = new Set(
    (ast.vars || []).flatMap((v) => v && Array.isArray(v.names) ? v.names : [])
  );
  const MODES = ["fixed", "step", "cont"];
  const signauxDeclares = new Set(
    (ast.vars || []).filter((v) => v && v.varType && v.varType.kind === "convention").flatMap((v) => Array.isArray(v.names) ? v.names : [])
  );
  const estModeDeParametre = (k) => MODES.some((mode) => k.endsWith(mode) && signauxDeclares.has(k.slice(0, -mode.length)));
  const connuNu = (k) => controlNames.has(k) || registry2.has(k) || addressKeys2.has(k) || digitalFns.has(k) || qualifierKeys.has(k) || instancesDeclarees.has(k) || estModeDeParametre(k);
  const knownParamKey = (k) => {
    if (connuNu(k)) return true;
    const point = typeof k === "string" ? k.indexOf(".") : -1;
    return point > 0 && connuNu(k.slice(0, point));
  };
  const ambigus = libCtx.ambiguousControls || /* @__PURE__ */ new Set();
  const prefixesDe = (nom) => Object.keys(libCtx.controlsQualified || {}).filter((q) => q.endsWith(`.${nom}`)).sort();
  const vusAmbigus = /* @__PURE__ */ new Set();
  const signalerAmbiguite = (key, line, col) => {
    if (!ambigus.has(key) || vusAmbigus.has(key)) return;
    vusAmbigus.add(key);
    const choix = prefixesDe(key);
    errors.push({
      message: `'${key}' est d\xE9clar\xE9 par ${choix.length} librairies et ne peut pas s'\xE9crire NU \u2014 il ne dit pas de quel '${key}' on parle, et le destinataire du r\xE9glage en d\xE9pend. \xC9crire ${choix.map((c) => `'${c}:\u2026'`).join(" ou ")}.`,
      line,
      col
    });
  };
  const canauxDeclares = new Set(Object.keys(LIBS.core?.schema?.channels || {}));
  const realisationsPar = {};
  for (const [face, reals] of Object.entries(libCtx.implementations || {})) {
    const nom = face.slice(face.indexOf(".") + 1);
    const canaux2 = new Set(reals.map((q) => q.slice(0, q.indexOf("."))).filter((l) => canauxDeclares.has(l)));
    if (canaux2.size > 0) realisationsPar[nom] = canaux2;
  }
  const sortiesActives = [...new Set((ast.actors || []).map((a) => a && a.properties && a.properties.transport && a.properties.transport.key).filter((k) => typeof k === "string" && canauxDeclares.has(k)))];
  const vusSansRealisation = /* @__PURE__ */ new Set();
  const signalerRealisationManquante = (key, line, col) => {
    const canaux2 = realisationsPar[key];
    if (!canaux2 || vusSansRealisation.has(key) || sortiesActives.length === 0) return;
    const orphelines = sortiesActives.filter((s) => !canaux2.has(s));
    if (orphelines.length === 0) return;
    vusSansRealisation.add(key);
    errors.push({
      message: `'${key}' est un mot G\xC9N\xC9RIQUE : chaque sortie d\xE9clare comment elle le r\xE9alise, et ${orphelines.map((s) => `'${s}'`).join(" et ")} ne le r\xE9alise${orphelines.length > 1 ? "nt" : ""} pas. \xC9crit ici, il ne ferait rien. R\xE9alis\xE9 aujourd'hui par : ${[...canaux2].sort().map((c) => `'${c}.${key}'`).join(", ")}.`,
      line,
      col
    });
  };
  const evaluateurs = new Set(vocab.components && vocab.components.eval || []);
  const tagsVus = /* @__PURE__ */ new Set();
  const verifierTag = (tag, line, col) => {
    if (typeof tag !== "string" || !tag || evaluateurs.has(tag) || tagsVus.has(tag)) return;
    tagsVus.add(tag);
    errors.push({
      message: `'\`${tag}: \u2026\`' nomme un \xE9valuateur qui n'est pas d\xE9clar\xE9. Un tag de backtick d\xE9signe QUI ex\xE9cute le code, et la liste vit dans la librairie 'eval' : ${[...evaluateurs].sort().join(", ")}. Une coquille y cr\xE9erait un interpr\xE8te fant\xF4me, et la sc\xE8ne compilerait sans que le code parte nulle part.`,
      line,
      col
    });
  };
  const vus = /* @__PURE__ */ new Map();
  const flag = (key, line, col, ecritNu = false) => {
    if (knownParamKey(key)) return;
    const deja = vus.get(key);
    if (deja) {
      if (deja.line === void 0 && line !== void 0) {
        deja.line = line;
        deja.col = col;
      }
      return;
    }
    const err = {
      message: `attribut '(${key}${ecritNu ? "" : ":\u2026"})' inconnu \u2014 ni contr\xF4le, ni valeur de librairie, ni adresse`,
      line,
      col
    };
    vus.set(key, err);
    errors.push(err);
  };
  (function collect(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const el of node) collect(el);
      return;
    }
    if (typeof node.tag === "string" && typeof node.code === "string") {
      verifierTag(node.tag, node.line, node.col);
    }
    if (node.payload && node.payload.params) {
      const prefixees = /* @__PURE__ */ new Set();
      const noter = (liste) => {
        for (const pr of liste || []) if (pr && pr.lib) prefixees.add(pr.key);
      };
      noter(node.pairs);
      for (const sq of node.suffixQualifiers || []) noter(sq && sq.pairs);
      for (const k of Object.keys(node.payload.params)) {
        if (!prefixees.has(k)) {
          signalerAmbiguite(k, node.line);
          signalerRealisationManquante(k, node.line);
        }
        flag(k, node.line, void 0, node.payload.params[k] === true);
      }
    }
    if ((node.type === "SettingBag" || node.type === "Qualifier") && Array.isArray(node.pairs)) {
      for (const p of node.pairs) {
        if (node.type === "SettingBag") {
          if (!p.lib) {
            signalerAmbiguite(p.key, p.line, p.col);
            signalerRealisationManquante(p.key, p.line, p.col);
          }
          flag(p.key, p.line, p.col, p.value === true);
        }
        if (p.key === "mode") {
          errors.push({
            message: `'(mode:\u2026)' n'a plus sa place dans une r\xE8gle : le mode vaut pour un BLOC et ne change pas en cours de tirage (d\xE9cision Romain 2026-08-08). L'\xE9crire 'mode:${p.value ?? "<valeur>"}' en t\xEAte de la sous-grammaire concern\xE9e \u2014 une ligne seule, avant ses r\xE8gles.`,
            line: p.line,
            col: p.col
          });
        }
      }
    }
    const place = REFUS_HORS_PORTEE_ACTIF ? PORTEE_DU_PORTEUR[node.type] : null;
    if (place) {
      for (const sac of [node.settings, node.qualifier, ...node.suffixQualifiers || []]) {
        if (!sac || !Array.isArray(sac.pairs)) continue;
        for (const p of sac.pairs) {
          const cle = String(p.key).split(".")[0];
          const permis = porteesPermises.get(cle);
          if (!permis || permis.includes(place)) continue;
          errors.push({
            message: `'${cle}' ne peut pas s'\xE9crire ${NOM_DE_PLACE[place]} \u2014 ` + (permis.length === 1 ? `il ne vaut QUE ${NOM_DE_PLACE[permis[0]] ?? permis[0]}` : `il vaut ${permis.slice(0, -1).map((s) => NOM_DE_PLACE[s] ?? s).join(", ")} ou ${NOM_DE_PLACE[permis[permis.length - 1]] ?? permis[permis.length - 1]}`) + `. Le d\xE9placer l\xE0, ou employer un r\xE9glage qui vaut ici.`,
            line: p.line ?? node.line,
            col: p.col
          });
        }
      }
    }
    for (const k in node) {
      if (k !== "params" && node[k] && typeof node[k] === "object") collect(node[k]);
    }
  })(ast.subgrammars);
  for (const e of ast.init || []) {
    if (e && typeof e.tag === "string" && typeof e.code === "string") verifierTag(e.tag, e.line, e.col);
  }
  if (REFUS_HORS_PORTEE_ACTIF) {
    const dire = (cle, place, line) => {
      const permis = porteesPermises.get(cle);
      if (!permis || permis.includes(place)) return;
      errors.push({
        message: `'${cle}' ne peut pas s'\xE9crire ${NOM_DE_PLACE[place]} \u2014 ` + (permis.length === 1 ? `il ne vaut QUE ${NOM_DE_PLACE[permis[0]] ?? permis[0]}` : `il vaut ${permis.slice(0, -1).map((x) => NOM_DE_PLACE[x] ?? x).join(", ")} ou ${NOM_DE_PLACE[permis[permis.length - 1]] ?? permis[permis.length - 1]}`) + `. Le d\xE9placer l\xE0, ou employer un r\xE9glage qui vaut ici.`,
        line
      });
    };
    for (const d of ast.directives || []) {
      if (!d || !d.name) continue;
      if (d.type && d.type !== "Directive") continue;
      const clesEcrites = [];
      if (!loadLib(d.name)) clesEcrites.push(d.name);
      if (d.subkey && porteesPermises.has(d.subkey)) clesEcrites.push(d.subkey);
      for (const cle of clesEcrites) dire(cle, "scene", d.line);
    }
    for (const sg of ast.subgrammars || []) {
      for (const m of sg.modifiers || []) {
        const nom = typeof m === "string" ? m : m && m.name;
        if (nom) dire(nom, "subgrammar", sg.line);
      }
    }
  }
  const checkComponent = (axis, name, line) => {
    if (!name) return;
    if (componentExists(axis, name)) return;
    if (axis === "alphabet" && resolveActorAlphabet(name, ast.directives)) return;
    errors.push({ message: `${axis} '${name}' introuvable dans le catalogue (r\xE9f\xE9rence inexistante)`, line });
  };
  const motsDeclares = () => new Set(
    Object.values(LIBS).map((l) => l && typeof l === "object" ? l.resolves : null).filter(Boolean)
  );
  const libExiste = (nom) => motsDeclares().has(nom);
  const motsDuLangage = new Set(loadLib("core")?.schema?.reservedDirectives || []);
  for (const d of ast.directives || []) {
    if (!d || !d.name) continue;
    if (!d.subkey) {
      const fichierNu = LIBS[d.name];
      const motNu = fichierNu && typeof fichierNu === "object" ? fichierNu.resolves : null;
      if (motNu && motNu !== d.name) {
        errors.push({
          message: `'${d.name}' : '${d.name}' est le NOM DU FICHIER, pas le mot qui l'invoque. Ecrire '${motNu}'. Une librairie s'invoque par le mot qu'elle DECLARE (decision Romain, 2026-08-17) : le nom logique se separe du nom physique, et un fichier se renomme sans qu'aucune scene change.`,
          line: d.line
        });
      }
      continue;
    }
    if (catalogAxes.includes(d.name)) continue;
    if (!libExiste(d.name)) {
      if (motsDuLangage.has(d.name)) continue;
      const fichier = LIBS[d.name];
      const motAEcrire = fichier && typeof fichier === "object" ? fichier.resolves : null;
      errors.push({
        message: motAEcrire ? `'${d.name}.${d.subkey}' : '${d.name}' est le NOM DU FICHIER, pas le mot qui l'invoque. Ecrire '${motAEcrire}.${d.subkey}'. Une librairie s'invoque par le mot qu'elle DECLARE (decision Romain, 2026-08-17) : le nom logique se separe du nom physique, et un fichier se renomme sans qu'aucune scene change.` : `'${d.name}.${d.subkey}' : aucune librairie ne sert l'axe '${d.name}'. Une invocation dont l'axe n'est porte par aucune donnee ne charge RIEN, et rien ne distingue ce silence d'une scene qui n'a pas declare.`,
        line: d.line
      });
      continue;
    }
    if (loadLib(d.name, d.subkey)) continue;
    errors.push({
      message: `'${d.name}.${d.subkey}' : l'entr\xE9e '${d.subkey}' n'existe pas dans la librairie '${d.name}'. Une invocation qui ne r\xE9sout rien est indistinguable, c\xF4t\xE9 consommateur, d'une sc\xE8ne qui n'a rien d\xE9clar\xE9 \u2014 elle ne peut donc pas \xEAtre accept\xE9e en silence.`,
      line: d.line
    });
  }
  for (const e of ast.inputs || []) {
    if (!e || !e.mapping) continue;
    if (loadLib("mapping", e.mapping)) continue;
    errors.push({
      // ⛔ CE REFUS NOMMAIT UNE LIBRAIRIE QUI N'EXISTE PLUS. `lib/mapping.json` est retiré le
      // 2026-08-24 — décision de Romain, une place qui ne porte aucune donnée n'a pas de fichier —
      // et le message envoyait l'auteur « ajouter la table dans la librairie 'mapping' », c'est-à-dire
      // dans un fichier supprimé. Le refus est le domicile où l'auteur apprend la règle : il dit
      // désormais ce qui EST, à savoir qu'aucune librairie ne déclare de table.
      message: `'in ${e.name} \u2026 mapping.${e.mapping}' : la table '${e.mapping}' n'est d\xE9clar\xE9e par aucune librairie charg\xE9e \u2014 aucune n'en porte aujourd'hui. Une entr\xE9e qui invoque une table inexistante croirait traduire et ne traduirait rien. \xC9crire l'entr\xE9e seule et employer des adresses nues ('<!${e.name}.60').`,
      line: e.line
    });
  }
  for (const d of ast.directives || []) {
    if (d.subkey && catalogAxes.includes(d.name)) {
      checkComponent(d.name, d.subkey, d.line);
      continue;
    }
    if (d.value != null && d.value !== true && !registry2.has(d.name) && !reserved.has(d.name)) {
      errors.push({ message: `valeur '${d.name}:\u2026' inconnue \u2014 non d\xE9clar\xE9e par une librairie charg\xE9e`, line: d.line });
      continue;
    }
    if (d.subkey == null && d.runtime != null && !registry2.has(d.name) && !reserved.has(d.name)) {
      errors.push({
        message: `'${d.name}:${d.runtime}' : '${d.name}' n'est d\xE9clar\xE9 par aucune librairie charg\xE9e. Une ligne de t\xEAte qu'aucune donn\xE9e ne porte ne r\xE8gle rien \u2014 elle serait lue, \xE9crite dans l'arbre, et sans effet.`,
        line: d.line
      });
      continue;
    }
    if (d.type && d.type !== "Directive") continue;
    if (d.value == null && !d.subkey && !d.runtime && !registry2.has(d.name) && !reserved.has(d.name) && !loadLib(d.name)) {
      errors.push({
        message: `'${d.name}' n'est d\xE9clar\xE9 par aucune librairie charg\xE9e \u2014 un mot de t\xEAte vient d'une librairie invoqu\xE9e, jamais de nulle part. Invoquer la librairie qui le porte, ou retirer la ligne.`,
        line: d.line
      });
    }
  }
  {
    const groupes = /* @__PURE__ */ new Map();
    const noter = (nom, line) => {
      if (!nom) return;
      const g = groupeDUnicite(nom);
      if (!g) return;
      if (!groupes.has(g)) groupes.set(g, []);
      groupes.get(g).push({ mot: nom, line });
    };
    for (const d of ast.directives || []) {
      if (!d || d.type && d.type !== "Directive") continue;
      noter(d.name, d.line);
      for (const m of d.modifiers || []) noter(m && m.name, d.line);
    }
    for (const sg of ast.subgrammars || []) {
      for (const m of sg.modifiers || []) noter(m && m.name, sg.line);
    }
    for (const [groupe, vus2] of groupes) {
      if (vus2.length < 2) continue;
      const mots = [...new Set(vus2.map((v) => v.mot))];
      errors.push({
        message: `'${groupe}' est r\xE9gl\xE9 ${vus2.length} fois (${mots.map((m) => `'${m}'`).join(", ")}) \u2014 il ne se r\xE8gle qu'une fois par sc\xE8ne. ` + (mots.length > 1 ? `Ces mots r\xE8glent LA M\xCAME CHOSE : en garder un seul.` : `Retirer les occurrences en trop.`) + ` Le moteur natif refuse la grammaire enti\xE8re dans ce cas.`,
        line: vus2[vus2.length - 1].line
      });
    }
  }
  const tuningAlphabet = (tname) => {
    const t = loadLib("tuning", tname);
    return t && t.alphabet || null;
  };
  const sceneComp = (axis) => {
    const d = (ast.directives || []).find((x) => x.name === axis && x.subkey);
    return d ? d.subkey : null;
  };
  const checkCoherence = (alphaName, tuningName, line) => {
    if (!alphaName || !tuningName) return;
    const ta = tuningAlphabet(tuningName);
    if (ta && ta !== alphaName) {
      errors.push({ message: `alphabet '${alphaName}' incoh\xE9rent avec l'accordage '${tuningName}' (qui appartient \xE0 l'alphabet '${ta}') \u2014 un accordage ne se combine qu'avec son alphabet`, line: line || 0 });
    }
  };
  checkCoherence(sceneComp("alphabet"), sceneComp("tuning"), 0);
  for (const actor of ast.actors || []) checkCoherence((actor.properties || {}).alphabet, (actor.properties || {}).tuning, actor.line);
  for (const actor of ast.actors || []) {
    const props = actor.properties || {};
    for (const axis of catalogAxes) if (props[axis]) checkComponent(axis, props[axis], actor.line);
  }
  const canaux = LIBS.core?.schema?.channels || {};
  const directionsDeCanal = new Set(Object.values(canaux).flatMap((c) => Object.entries(c || {}).filter(([, v]) => typeof v === "boolean").map(([k]) => k)));
  const clesDeSortie = new Set((LIBS.core?.schema?.actorKeys || []).filter((k) => directionsDeCanal.has(k) && !catalogAxes.includes(k)));
  for (const def of ast.defs || []) {
    if (!def || def.kind !== "terminal" || !def.keys) continue;
    for (const [axe, ref] of Object.entries(def.keys)) {
      if (!ref || ref.kind !== "ref" || !ref.value) continue;
      if (catalogAxes.includes(axe)) {
        checkComponent(axe, ref.value, def.line);
        continue;
      }
      if (!clesDeSortie.has(axe)) continue;
      const cause = canalFautif(ref.value);
      if (cause) errors.push({ message: `terminal '${def.name}' : ${cause}`, line: def.line });
    }
  }
  return errors;
}
function emitActorLibRefs(ast) {
  for (const actor of ast.actors || []) {
    const alpha = (actor.properties || {}).alphabet;
    if (!alpha) continue;
    const src = resolveActorAlphabetSource(alpha, ast.directives);
    if (!src || !src.lib) continue;
    actor.libRefs = [`${src.lib}.${alpha}`];
  }
}
function refuserNomsEnDouble(ast, libCtx) {
  const erreurs = [];
  const { terminaux } = terminauxEnPortee(ast);
  const creesParDeclaration = /* @__PURE__ */ new Map();
  const noter = (nom, sorte, line) => {
    if (!nom || typeof nom !== "string") return;
    if (creesParDeclaration.has(nom)) {
      const p = creesParDeclaration.get(nom);
      erreurs.push({
        message: `le nom '${nom}' est d\xE9j\xE0 pris : ${p.sorte} l'a d\xE9clar\xE9${p.line ? ` ligne ${p.line}` : ""}, et ${sorte} le red\xE9clare. Un nom ne d\xE9signe qu'UNE chose dans une sc\xE8ne \u2014 sinon, en le lisant dans une r\xE8gle, on ne sait plus de quoi on parle. Choisir un autre nom.`,
        line
      });
      return;
    }
    creesParDeclaration.set(nom, { sorte, line });
    if (terminaux.has(nom)) {
      erreurs.push({
        message: `'${nom}' est un TERMINAL de l'alphabet actif, et ${sorte} en fait un nom \u2014 une r\xE8gle qui \xE9crirait '${nom}' ne dirait plus si elle joue la note ou l'autre chose. Choisir un autre nom. Le refus tombe \xE0 la D\xC9CLARATION : le nom n'a pas besoin d'\xEAtre employ\xE9 pour que l'ambigu\xEFt\xE9 existe.`,
        line
      });
    }
  };
  for (const e of ast.inputs || []) noter(e?.name, "une entr\xE9e", e?.line);
  for (const v of ast.vars || []) {
    const sorte = v?.varType?.kind === "flag" ? "un drapeau" : "une variable de travail";
    for (const n of v?.names || []) noter(n, sorte, v?.line);
  }
  for (const a of ast.actors || []) if (!a?.synthetic) noter(a?.name, "un acteur", a?.line);
  for (const sc of ast.scenes || []) noter(sc?.name, "une sc\xE8ne", sc?.line);
  for (const d of ast.defs || []) {
    if (d && d.type === "DefDirective" && d.kind !== "terminal") {
      noter(d.name, "une d\xE9finition", d.line);
    }
  }
  const LEVEES = /* @__PURE__ */ new Set(["une variable de travail"]);
  const tetesVues = /* @__PURE__ */ new Set();
  for (const sg of ast.subgrammars || []) {
    for (const r of sg.rules || []) {
      const tetes = (r.lhs || []).filter((t) => t && !t.negated);
      if (tetes.length !== 1) continue;
      for (const t of tetes) {
        const nom = t?.name;
        if (!nom || tetesVues.has(nom)) continue;
        tetesVues.add(nom);
        const declare = creesParDeclaration.get(nom);
        if (declare && !LEVEES.has(declare.sorte)) {
          erreurs.push({
            message: `la r\xE8gle '${nom}' porte un nom d\xE9j\xE0 pris par ${declare.sorte} \u2014 en lisant '${nom}' dans une s\xE9quence, on ne sait plus de quoi on parle. Choisir un autre nom pour l'un des deux.`,
            line: r.line
          });
        }
      }
    }
  }
  const drapeaux = /* @__PURE__ */ new Set();
  const collecterDrapeaux = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(collecterDrapeaux);
      return;
    }
    if ((n.type === "FlagExpr" || n.type === "Guard") && typeof n.flag === "string") drapeaux.add(n.flag);
    for (const v of Object.values(n)) collecterDrapeaux(v);
  };
  collecterDrapeaux(ast.subgrammars);
  const tetesDeRegle = /* @__PURE__ */ new Map();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) {
    for (const t of r.lhs || []) if (t?.name && !t.negated && !tetesDeRegle.has(t.name)) {
      tetesDeRegle.set(t.name, r.line);
    }
  }
  for (const nom of drapeaux) {
    const declare = creesParDeclaration.get(nom);
    if (declare && declare.sorte !== "un drapeau") {
      erreurs.push({
        message: `le drapeau '${nom}' porte un nom d\xE9j\xE0 pris par ${declare.sorte}${declare.line ? ` ligne ${declare.line}` : ""} \u2014 un nom ne d\xE9signe qu'UNE chose dans une sc\xE8ne. Choisir un autre nom pour le drapeau.`
      });
      continue;
    }
    if (tetesDeRegle.has(nom)) {
      erreurs.push({
        message: `le drapeau '${nom}' porte le nom d'une R\xC8GLE de la grammaire${tetesDeRegle.get(nom) ? ` ligne ${tetesDeRegle.get(nom)}` : ""} \u2014 un nom ne d\xE9signe qu'UNE chose dans une sc\xE8ne. Choisir un autre nom pour le drapeau.`
      });
      continue;
    }
    if (terminaux.has(nom)) {
      erreurs.push({
        message: `le drapeau '${nom}' porte le nom d'un TERMINAL de l'alphabet actif \u2014 un nom ne d\xE9signe qu'UNE chose dans une sc\xE8ne, et un drapeau ne porte qu'un nom de drapeau. Choisir un autre nom pour le drapeau.`
      });
      continue;
    }
    if (libCtx?.controlNames?.has(nom)) {
      erreurs.push({
        message: `le drapeau '${nom}' porte le nom d'un R\xC9GLAGE du vocabulaire \u2014 le sac de drapeaux en ferait un drapeau sans un mot, et le r\xE9glage deviendrait inatteignable sous ce nom. Choisir un autre nom pour le drapeau.`
      });
      continue;
    }
  }
  return erreurs;
}
function emitNoteTerminals(ast) {
  const { terminaux, aUnAlphabet } = terminauxEnPortee(ast);
  if (!aUnAlphabet) return;
  const presents = /* @__PURE__ */ new Set();
  const recolter = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(recolter);
    if (typeof n.name === "string") presents.add(n.name);
    for (const k in n) if (n[k] && typeof n[k] === "object") recolter(n[k]);
  };
  recolter(ast.subgrammars || []);
  const aHauteur = (nomAlphabet) => {
    const lib = resolveActorAlphabet(nomAlphabet, ast.directives);
    return !!(lib && lib.resolvesPitch);
  };
  const notes = /* @__PURE__ */ new Set();
  const sansHauteur = /* @__PURE__ */ new Set();
  const verser = (nomAlphabet, octaves) => {
    const lib = resolveActorAlphabet(nomAlphabet, ast.directives);
    if (!lib || !nomsDeTerminaux(lib)) return;
    const cible = aHauteur(nomAlphabet) ? notes : sansHauteur;
    for (const t of expandAlphabetTerminals(lib, octaves)) cible.add(t);
    const alts = lib.alterations && typeof lib.alterations === "object" && !Array.isArray(lib.alterations) ? Object.keys(lib.alterations) : [""];
    for (const note of nomsDeTerminaux(lib)) for (const alt of alts) cible.add(note + alt);
  };
  const sceneAlpha = (ast.directives || []).find((d) => d.name === "alphabet" && d.subkey);
  const sceneOct = (ast.directives || []).find((d) => d.name === "octaves" && (d.subkey || d.runtime));
  if (sceneAlpha) verser(sceneAlpha.subkey, sceneOct ? sceneOct.subkey || sceneOct.runtime : null);
  for (const a of ast.actors || []) {
    const p = a.properties || {};
    if (p.alphabet) verser(p.alphabet, p.octaves || null);
  }
  const dansLaScene = (ens) => [...presents].filter((n) => ens.has(n)).sort();
  ast.noteTerminals = dansLaScene(notes);
  ast.alphabetTerminals = dansLaScene(sansHauteur);
}
function emitSceneMeter(ast) {
  const dir = (ast.directives || []).find((d) => d && d.name === "meter" && d.value != null);
  if (!dir) return;
  const valeur = String(dir.value);
  for (const sg of ast.subgrammars || []) {
    for (const r of sg.rules || []) {
      const porteDeja = (r.settings?.pairs || []).some((p) => p && p.key === "meter");
      if (porteDeja) continue;
      r.settings = r.settings || { type: "SettingBag", pairs: [] };
      r.settings.pairs.push({ key: "meter", value: valeur, decrement: null });
    }
  }
}
function emitSceneLibRefs(ast) {
  const axesHauteur = /* @__PURE__ */ new Set(["alphabet", "tuning", "octaves", "scale"]);
  const refs = [];
  for (const d of ast.directives || []) {
    if (!d || !d.name || !d.subkey || axesHauteur.has(d.name)) continue;
    const entree = loadLib(d.name, d.subkey);
    if (!entree) continue;
    const adresse = `${d.name}.${d.subkey}`;
    if (!refs.includes(adresse)) refs.push(adresse);
  }
  for (const e of ast.inputs || []) {
    if (!e || !e.mapping) continue;
    const adresse = `mapping.${e.mapping}`;
    if (!refs.includes(adresse)) refs.push(adresse);
  }
  if (refs.length === 0) return;
  ast.libRefs = [...ast.libRefs || [], ...refs.filter((r) => !(ast.libRefs || []).includes(r))];
}
function retirerArdoiseAlphabet(ast) {
  for (const actor of ast.actors || []) {
    if (!actor.libRefs || !actor.libRefs.length) continue;
    if (actor.properties) delete actor.properties.alphabet;
    if (Array.isArray(actor.references)) {
      actor.references = actor.references.filter((r) => r && r.category !== "alphabet");
    }
  }
}
function resoudreSource(source, environnement) {
  const result = { ast: null, errors: [], warnings: [] };
  try {
    const ast = parse(tokenize(source), {
      onWarning: (w) => result.warnings.push(w),
      // La SOURCE accompagne les jetons : une entrée de catalogue de gabarits se transporte
      // VERBATIM (AST_SPEC §1.9), et aucun jeton ne peut rendre les espaces d'origine.
      source
    });
    {
      const passe = resoudre(ast, environnement);
      result.errors.push(...passe.diagnostics);
      noterLePassage(passe.examines);
    }
    emitSceneLibRefs(ast);
    deriveAlphabetFromTuning(ast);
    result.errors.push(...resolveActors(ast).errors);
    canonicalizeContexts(ast);
    result.errors.push(...annotateBackticks(ast));
    applyEnvironmentDefaults(ast, environnement);
    result.errors.push(...applyDefaultActor(ast));
    resolveHomomorphismMarkers(ast);
    emitActorLibRefs(ast);
    emitNoteTerminals(ast);
    emitSceneMeter(ast);
    result.ast = ast;
    const directives = [
      ...ast.directives || [],
      ...(ast.scenes || []).flatMap((s) => s.directives || []),
      // SCENE_VALUES : les acteurs (hissés dans ast.actors par le parseur) touchent
      // leurs catalogues d'entité → sections `values` au registre (libs.js).
      ...ast.actors || []
    ];
    const libCtx = loadLibsFromDirectives(directives);
    poserLeDestinataireDesReglages(ast, libCtx);
    result.errors.push(...applySceneValues(ast, libCtx));
    result.errors.push(...validateReferences(ast, libCtx));
    result.errors.push(...refuserNomsEnDouble(ast, libCtx));
    {
      const { terminaux, paquets } = terminauxEnPortee(ast);
      segmenterLesTerminaux(ast, terminaux, paquets);
    }
    result.errors.push(...validateTerminals(ast));
    poserLaVoixDesTerminaux(ast);
    result.errors.push(...validateControls(ast, libCtx.controls, libCtx.controlsQualified || {}));
    result.errors.push(...refuserAttenteNonDeclaree(ast));
    result.errors.push(...refuserEsclaveSansMaitre(ast));
    splitCompoundTerminals(ast, libCtx);
    retirerArdoiseAlphabet(ast);
  } catch (e) {
    if (e instanceof ParseError) result.errors.push({ message: e.message, line: e.token && e.token.line });
    else if (e instanceof LexError) result.errors.push({ message: e.message, line: e.line });
    else throw e;
  }
  return result;
}
function compileToBPxAST(source, environnement) {
  const result = resoudreSource(source, environnement);
  if (result.errors.length) result.ast = null;
  return result;
}
export {
  compileToBPxAST,
  describeVocabulary
};
