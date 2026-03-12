// BPscript — facade module
// compileBPScript(source) → { grammar, alphabet, settings, errors, warnings }

import { tokenize } from './tokenizer.js';
import { parse } from './parser.js';
import { compile } from './compiler.js';

export function compileBPScript(source) {
  const tokens = tokenize(source);
  const ast = parse(tokens);
  return compile(ast);
}
