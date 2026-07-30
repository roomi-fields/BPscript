// BPscript language support for CodeMirror 6
import { parser as bpsParser } from './bpscript-parser.js';
import { parser as bp3Parser } from './bp3-parser.js';
import { LRLanguage, LanguageSupport } from '@codemirror/language';
import { styleTags, tags as t } from '@lezer/highlight';

// --- BPscript highlighting ---
const bpsHighlight = styleTags({
  LineComment: t.lineComment,
  Separator: t.processingInstruction,
  Directive: t.keyword,
  RulePrefix: t.labelName,
  Arrow: t.operator,
  BacktickCode: t.special(t.string),
  Variable: t.special(t.variableName),
  FlagExpr: t.annotation,
  Weight: t.meta,
  TypeKeyword: t.typeName,
  LambdaKeyword: t.keyword,
  Number: t.number,
  Symbol: t.variableName,
  Operator: t.punctuation,
});

const bpsLang = LRLanguage.define({
  name: 'bpscript',
  parser: bpsParser.configure({ props: [bpsHighlight] }),
  languageData: {
    commentTokens: { line: '//' },
  },
});

export const bpscriptLanguage = new LanguageSupport(bpsLang);

// --- BP3 highlighting ---
const bp3Highlight = styleTags({
  LineComment: t.lineComment,
  Separator: t.processingInstruction,
  ModeLine: t.keyword,
  RulePrefix: t.labelName,
  Arrow: t.operator,
  SpecialFn: t.function(t.variableName),
  Flag: t.annotation,
  Weight: t.meta,
  Variable: t.special(t.variableName),
  SpeedRatio: t.modifier,
  OutTimeObject: t.special(t.atom),
  TemplateRef: t.special(t.typeName),
  FileRef: t.link,
  InitDirective: t.processingInstruction,
  Tie: t.operator,
  Rest: t.null,
  Prolongation: t.null,
  Period: t.punctuation,
  Wildcard: t.atom,
  NilString: t.null,
  PolyBrace: t.brace,
  Mode: t.keyword,
  Number: t.number,
  Symbol: t.variableName,
  Operator: t.punctuation,
});

const bp3Lang = LRLanguage.define({
  name: 'bp3',
  parser: bp3Parser.configure({ props: [bp3Highlight] }),
  languageData: {
    commentTokens: { line: '//' },
  },
});

export const bp3Language = new LanguageSupport(bp3Lang);
