/**
 * BPScript Tokenizer
 * Source: BPSCRIPT_EBNF.md — Couche 5 (Lexèmes)
 *
 * Converts .bps source text into a flat array of tokens.
 * Each token: { type, value, line, col }
 */

/**
 * Erreur de LECTURE — un caractère que le langage ne sait pas lire.
 *
 * Elle existe pour une raison précise : sans elle, le découpeur jetait une `Error` NUE, que la
 * façade ne reconnaissait pas et relançait telle quelle (`bpxAst.js`, la branche « sinon je
 * relance »). Résultat mesuré le 2026-07-28 : une faute de frappe d'UN caractère faisait PLANTER
 * le compilateur au lieu de remplir son canal d'erreurs — alors que le message, lui, était déjà
 * bon. Le défaut n'était pas ce qu'on disait, c'était par où on le disait.
 *
 * Le découpeur ne peut pas emprunter l'erreur de l'analyseur (l'analyseur importe le découpeur —
 * l'inverse ferait un cycle, et le portillon d'architecture le refuse). D'où un type à lui, que
 * la façade attrape au même endroit.
 */
class LexError extends Error {
  constructor(message, line, col) {
    super(message);
    this.name = 'LexError';
    this.line = line;
    this.col = col;
  }
}

/**
 * Ce que le langage sait dire à la place d'un caractère qu'il ne lit pas — TABLE, pas cascade.
 *
 * En liste et non en `if` enchaînés parce que c'est un ESPACE, pas une série de cas : ajouter une
 * entrée doit être une ligne de donnée. Chaque entrée donne la RÉÉCRITURE, jamais seulement le
 * constat — un refus qui n'apprend rien oblige à aller lire la spec pour une faute de frappe.
 */
const CARACTERES_CONNUS_MAIS_ETRANGERS = new Map([
  ["'", "BPScript n'a pas de littéral entre guillemets — un terminal s'écrit nu (X, pas 'X')."],
  ['"', "BPScript n'a pas de littéral entre guillemets — un terminal s'écrit nu (X, pas \"X\")."],
  [';', "le séparateur de séquence de BP2 n'existe pas — une règle par ligne."],
  // ⚠️ CETTE ENTRÉE DONNAIT UNE RÉÉCRITURE, ET LA RÉÉCRITURE ÉTAIT MORTE. Un refus qui nomme une
  // forme la ressuscite pour son lecteur : c'est le troisième domicile d'un mot retiré, après le
  // parser et les librairies, et aucun garde ne compile un message. Le refus reste NU tant qu'il
  // n'a pas de réécriture vivante à donner.
  ['\\', "l'antislash n'a aucun emploi dans le langage."],
  ['%', "le pourcentage n'est pas un signe du langage — un poids s'écrit '[weight:N]'."],
]);
// Volontairement COURTE : une entrée n'y figure que si sa réécriture est PROUVÉE sur pièces.
// L'accent circonflexe en a été retiré avant d'être livré — j'allais y écrire une graphie
// d'octave que je n'ai pas pu retrouver dans les specs. Un refus muet vaut mieux qu'un refus
// qui enseigne une forme inventée : le premier fait ouvrir la doc, le second fait écrire faux.

// ⛔ AUCUN COMPTE DANS UN INTITULÉ. Les trois rubriques de cette table en portaient un — « (24) »,
// « (7) », « (3 + 1) » — et deux étaient FAUX le 2026-08-24 : 27 signes structurels pour 24
// annoncés, et le « + 1 » désignait `lambda`, sorti du langage la veille. Un compte figé dans un
// commentaire est un recensement tenu à la main : il se périme au premier ajout, sans rougir, et
// il se lit comme une mesure. Atlas l'a relevé en comparant sa fiche à cette table.
const T = Object.freeze({
  // Structural symbols
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
  COMPOUND:     'COMPOUND',    // |[ … ] objet sonore composé (ratifié Romain 2026-07-18)

  // Tempo operators (in [] qualifiers)
  STAR:         'STAR',        // *

  // Flag operators
  EQ:           'EQ',          // ==
  NEQ:          'NEQ',         // !=
  GT:           'GT',          // >
  LT:           'LT',         // <
  GTE:          'GTE',         // >=
  LTE:          'LTE',         // <=
  PLUS:         'PLUS',        // +

  // Keywords
  GATE:         'GATE',        // gate
  TRIGGER:      'TRIGGER',     // trigger
  CV:           'CV',          // cv

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
};

function tokenize(source, opts = {}) {
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
  // ⛔ DANS UN CROCHET, LE TIRET EST UN OPERATEUR, PAS UNE LETTRE. Le crochet porte ce qui
  // conditionne la derivation — `[Flag-1]` DECREMENTE un drapeau, `[Notes-4]` le compare. Le
  // collage y ferait un nom `Flag-1` et le decrement disparaitrait sans un refus. Cette
  // distinction existait deja avant la decision du 2026-08-17 ; elle n'est pas neuve, elle est
  // PRESERVEE. Le tiret du FLUX est une lettre, celui du CROCHET reste un signe.
  let _profCrochet = 0;

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

    // Quoted string — "file.bps" (for scene paths)
    //
    // ⛔ LE GUILLEMET SE DOUBLE DANS UNE CHAÎNE — arbitrage de Romain, 2026-08-23. La règle n'était
    // écrite NULLE PART : ni dans les 244 décisions de l'index, ni dans `LANGUAGE.md`, ni dans
    // `FORME-OBJET.md`. Elle est consignée ICI, en étant câblée, parce qu'un mot de langage qui ne
    // vit dans aucun code n'est pas une règle, c'est un souvenir.
    //
    // ⚠️ CE QUI SE PASSAIT AVANT N'ÉTAIT PAS UN REFUS, ET C'EST PIRE. Le lecteur fermait au premier
    // guillemet puis rouvrait : `"scale ""Ma05"" fin"` rendait TROIS jetons — `scale `, `Ma05`,
    // ` fin` — que la suite concaténait en `scale Ma05 fin`. Les guillemets DISPARAISSAIENT, le
    // texte sortait faux, et rien ne le disait. C'est le patron du poids muet : une graphie
    // acceptée qui rend autre chose que ce qu'elle écrit.
    //
    // ⚠️ ET LA CHAÎNE VIDE N'EST PAS UN DOUBLEMENT : `separator:""` ferme sur un guillemet suivi
    // d'une virgule, pas d'un guillemet. `lib/octaves.bpsl` s'en sert huit fois — c'est le seul
    // fichier du dépôt qui écrit deux guillemets accolés, et il ne doit pas bouger d'un octet.
    if (ch === '"') {
      advance(); // opening "
      let str = '';
      const ouvert = { line, col };
      for (;;) {
        while (i < source.length && peek() !== '"') str += advance();
        // ⛔ UN TEXTE OUVERT ET JAMAIS FERMÉ AVALE LE RESTE DU FICHIER, ET LA SCÈNE COMPILE À VIDE.
        // Cette sortie était MUETTE — ma propre frappe du guillemet doublé l'a laissée telle quelle.
        // Mesuré le 2026-08-24 : `def x a:1 "b` compile et rend ZÉRO règle au lieu d'une ; le
        // séparateur `-----` et la grammaire entière partent dans la valeur, sans un mot.
        // ⚠️ LE REFUS SE POSE À LA FIN DU FICHIER, PAS À LA FIN DE LIGNE : un texte sur plusieurs
        // lignes est légitime et vit dans la donnée. La fin de ligne refuserait une forme vivante.
        if (i >= source.length) {
          // ⚠️ ET LE CANAL EST `LexError`, PAS UNE `Error` NUE. Le commentaire du refus de caractère,
          // vingt lignes plus bas, décrit exactement la faute que ma première écriture a refaite :
          // « il partait en Error nue, que la façade relançait, donc l'appelant PLANTAIT au lieu de
          // recevoir une erreur de compilation ». La forme d'un refus compte autant que le refus.
          throw new LexError(
            `Texte ouvert à la ligne ${ouvert.line}, colonne ${ouvert.col} et jamais fermé — il avale `
            + `tout ce qui suit, et la scène compile à vide. Un texte se ferme par un guillemet ; un `
            + `guillemet À L'INTÉRIEUR d'un texte se double.`, ouvert.line, ouvert.col);
        }
        advance();                              // le guillemet qui ferme… ou le premier des deux
        if (peek() === '"') { str += advance(); continue; }   // doublé → un guillemet littéral
        break;
      }
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

    // Objet sonore composé |[ … ] (ratifié Romain 2026-07-18) : une suite de notes/prolongations
    // (et poly imbriquée) occupant UNE unité d'ordonnancement. Ouverture |[ , fermeture ] (ASYMÉTRIQUE).
    // Capture brute puis strip des blancs → nom canonique concaténé (do5 _ do5 do5 → do5_do5do5),
    // aligné sur la forme que le frontal émet pour do5_do5do5 : Symbol{name, payload:{nature:'sounding'}}.
    if (ch === '|' && peek(1) === '[') {
      advance(); advance(); // |[
      let inner = '';
      while (i < source.length && peek() !== ']') inner += advance();
      if (i < source.length) advance(); // ]
      // Le nom canonique est la suite CONCATÉNÉE ; les PARTIES sont conservées à côté. Sans
      // elles, une faute de frappe à l'intérieur d'un objet composé serait indétectable — le
      // nom formé est opaque à la dérivation (bible), pas au contrôle du vocabulaire.
      emit(T.COMPOUND, inner.replace(/\s+/g, ''));
      tokens[tokens.length - 1].parties = inner.trim().split(/\s+/).filter(Boolean);
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

    // PIERRE TOMBALE — la flèche du moteur historique (`-->`) n'existe pas en BPScript.
    //
    // ⚠️ ELLE ÉTAIT ACCEPTÉE EN SILENCE, et c'est le pire mode d'échec : le tiret de trop était
    // avalé comme un SILENCE dans le membre gauche, la règle compilait, et l'arbre produit était
    // celui de `->` — donc rien ne pouvait le signaler. Mesuré le 2026-07-28 : l'architecte a
    // montré à Romain un exemple qui « compilait », donc qu'il croyait juste.
    // Deux langages, deux frontaux, aucun code partagé : avaler la graphie de l'autre, c'est
    // faire passer pour du BPScript une ligne qui n'en est pas.
    //
    // ⚠️ ET LE REFUS EST ÉTROIT, PAR MESURE : un SILENCE en membre gauche est une forme
    // LÉGITIME — `- V V <> - tidha` existe dans le corpus (dhati, 4 scènes). Ce qui est refusé,
    // c'est le tiret COLLÉ à la flèche, que personne n'écrit pour dire un silence.
    if (ch === '-' && peek(1) === '-') {
      let j = 1;
      while (peek(j) === '-') j++;
      if (peek(j) === '>') {
        const fleche = '-'.repeat(j) + '>';
        throw new LexError(
          `'${fleche}' est la flèche du moteur historique, elle n'existe pas en BPScript — la règle `
          + `s'écrit avec '->'. Ce sont deux langages distincts : ce qui s'écrit ainsi dans une `
          + `grammaire native ne se recopie pas ici. (Un SILENCE en membre gauche, lui, reste `
          + `permis : il s'écrit détaché, '- V V -> …'.) Ligne ${line}, colonne ${col}.`, line, col);
      }
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
      if (ch === '[') _profCrochet++;
      if (ch === ']') _profCrochet = Math.max(0, _profCrochet - 1);
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
      // ── LE TIRET COLLE EST UNE LETTRE DU NOM ──────────────────────────────────────────
      // Decision Romain, 2026-08-17 : un tiret ENTRE ESPACES est un silence ; colle a des
      // lettres, il appartient au nom. `dha-dha` est le terminal de ce nom, `dha - dha` est
      // deux bols separes par un silence.
      //
      // ⛔ CE QUI A ETE RETIRE ICI, ET POURQUOI CE N'EST PAS UNE SIMPLIFICATION. La condition
      // consultait une liste de noms PRE-SCANNES sur les membres GAUCHES : le meme texte se
      // lisait donc de deux façons selon qu'un membre gauche l'avait declare ou non. Mesure du
      // jour : `Tr-11 -> a` rendait UN symbole `Tr-11`, et `S -> Tr-11` rendait `Tr` silence
      // `11`. Le tokenizer dependait de ce qu'il avait deja lu ailleurs dans le fichier ; la
      // regle aligne la droite sur la gauche et le rend local.
      //
      // ⚠️ ET L'ESPACE PORTE LE SENS, comme pour le point d'exclamation colle ou espace. C'est
      // une divergence ASSUMEE avec le moteur natif, du meme ordre que celle sur la casse : le
      // natif ne met jamais de tiret dans un terminal. Rayon mesure avant la frappe — DEUX
      // scenes du corpus de 397 y perdaient leur silence, reecrites dans le meme mouvement.
      // ⛔ UNE FLECHE N'EST PAS UN TIRET DE NOM : `a->b` porte `->`, et l'absorber rendait
      // `IDENT(a-) GT(>) IDENT(b)` — la regle perdait sa fleche sans un refus.
      if (peek() === '-' && peek(1) !== '>' && _profCrochet === 0) {
        while (peek() === '-' && peek(1) !== '>') {
          id += advance();
          while (i < source.length && (
            (peek() >= 'a' && peek() <= 'z') ||
            (peek() >= 'A' && peek() <= 'Z') ||
            (peek() >= '0' && peek() <= '9') ||
            peek() === '_' || peek() === '#' ||
            peek() === "'" || peek() === '"'
          )) {
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

    // Caractère inconnu — FAIL-LOUD (2026-07-18). Il était auparavant AVALÉ avec un simple
    // `console.warn`, hors de `errors` ET de `warnings` : l'appelant recevait une compilation
    // « réussie » sur une grammaire CORROMPUE. Cas mesuré : `S -> 'X' 'Y'` rendait
    // `S --> X' Y'` avec errors:[] — le guillemet ouvrant avalé, le fermant COLLÉ au terminal,
    // donc deux terminaux inventés. Avaler un caractère qu'on ne sait pas lire ne peut jamais
    // produire autre chose qu'un texte différent de celui qui a été écrit.
    // Rayon de casse mesuré AVANT de durcir : 0 sur 93 scènes de test/grammars et 0 sur les
    // 188 .bps du corpus BPx — aucune forme existante n'en dépend.
    // Le message était déjà bon ; ce qui manquait, c'était le CANAL — il partait en `Error` nue,
    // que la façade relançait, donc l'appelant PLANTAIT au lieu de recevoir une erreur de
    // compilation. Une faute de frappe d'un caractère ne doit jamais tomber hors du canal.
    const aide = CARACTERES_CONNUS_MAIS_ETRANGERS.get(ch)
      ?? "ce caractère n'a aucun sens dans le langage — vérifier la frappe (docs/spec/LANGUAGE.md).";
    throw new LexError(
      `Caractère inattendu '${ch}' à la ligne ${line}, colonne ${col} — ${aide}`, line, col);
  }

  emit(T.EOF, null);
  return tokens;
}

export { tokenize, T, LexError };
