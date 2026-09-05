export function tokenize(source: any, opts?: {}): any[];
export const T: Readonly<{
    AT: "AT";
    ARROW_R: "ARROW_R";
    ARROW_L: "ARROW_L";
    ARROW_BI: "ARROW_BI";
    LBRACE: "LBRACE";
    RBRACE: "RBRACE";
    COMMA: "COMMA";
    LPAREN: "LPAREN";
    RPAREN: "RPAREN";
    COLON: "COLON";
    EQUALS: "EQUALS";
    LBRACKET: "LBRACKET";
    RBRACKET: "RBRACKET";
    BACKTICK: "BACKTICK";
    REST: "REST";
    PROLONG: "PROLONG";
    PERIOD: "PERIOD";
    UNDETERMINED: "UNDETERMINED";
    BANG: "BANG";
    TRIGGER_IN: "TRIGGER_IN";
    HASH: "HASH";
    QUESTION: "QUESTION";
    DOLLAR: "DOLLAR";
    AMPERSAND: "AMPERSAND";
    TILDE: "TILDE";
    PIPE: "PIPE";
    COMPOUND: "COMPOUND";
    STAR: "STAR";
    EQ: "EQ";
    NEQ: "NEQ";
    GT: "GT";
    LT: "LT";
    GTE: "GTE";
    LTE: "LTE";
    PLUS: "PLUS";
    INT: "INT";
    FLOAT: "FLOAT";
    IDENT: "IDENT";
    STRING: "STRING";
    SLASH: "SLASH";
    SEPARATOR: "SEPARATOR";
    COMMENT: "COMMENT";
    NEWLINE: "NEWLINE";
    EOF: "EOF";
}>;
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
 *
 * ⛔ ET ELLE PORTE UN CODE, DEPUIS LE 2026-09-04. Le texte d'un refus était la seule surface à
 * laquelle un consommateur pouvait s'accrocher — kanopi y a perdu 11 bancs sur une TRADUCTION,
 * kairos un banc sur une REFORMULATION. Le code est ce qui ne bouge pas ; le message est écrit dans
 * `messages/<langue>.js` et il a le droit de changer. Décision de Romain.
 */
export class LexError extends Error {
    constructor(code: any, params: any, line: any, col: any);
    code: any;
    line: any;
    col: any;
}
