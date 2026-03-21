/**
 * BPScript Transpiler — Facade
 *
 * compileBPS(source) → { grammar, alphabet, settings, errors }
 */

import { tokenize } from './tokenizer.js';
import { parse, ParseError } from './parser.js';
import { encode } from './encoder.js';

function compileBPS(source) {
  const result = { grammar: '', alphabet: [], settings: [], alphabetFile: null, ast: null, errors: [] };

  try {
    // 1. Tokenize
    const tokens = tokenize(source);

    // 2. Parse → AST
    const ast = parse(tokens);
    result.ast = ast;

    // 3. Encode → BP3
    const encoded = encode(ast);
    result.grammar = encoded.grammar;
    result.alphabet = Array.from(encoded.alphabet);
    result.settings = encoded.settings;
    result.alphabetFile = encoded.alphabetFile;
    result.settingsJSON = encoded.settingsJSON;
    result.controlTable = encoded.controlTable;
    result.cvTable = encoded.cvTable;
    result.directives = ast.directives;

  } catch (err) {
    if (err instanceof ParseError) {
      result.errors.push({ message: err.message, line: err.token?.line, col: err.token?.col });
    } else {
      result.errors.push({ message: err.message });
    }
  }

  return result;
}

export { compileBPS };
