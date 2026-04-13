/**
 * BPScript Transpiler — Facade
 *
 * compileBPS(source) → { grammar, alphabet, settings, errors }
 */

import { tokenize } from './tokenizer.js';
import { parse, ParseError } from './parser.js';
import { encode } from './encoder.js';
import { generatePrototypes } from './prototypes.js';
import { resolveActors } from './actorResolver.js';

function compileBPS(source) {
  const result = { grammar: '', alphabet: [], settings: [], alphabetFile: null, prototypesFile: null, ast: null, errors: [] };

  try {
    // 1. Tokenize
    const tokens = tokenize(source);

    // 2. Parse → AST
    const ast = parse(tokens);
    result.ast = ast;

    // 2b. Resolve actors (between parser and encoder)
    const actorResult = resolveActors(ast);
    if (actorResult.errors.length > 0) {
      result.errors.push(...actorResult.errors);
    }

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
    result.actorTable = actorResult.actorTable;
    result.terminalActorMap = actorResult.terminalActorMap;
    result.mapTable = encoded.mapTable;
    result.sceneTable = encoded.sceneTable;
    result.exposeTable = encoded.exposeTable;
    result.duration = encoded.duration;
    result.macroTable = encoded.macroTable;
    result.aliasTable = encoded.aliasTable;
    result.labelTable = encoded.labelTable;

    // 4. Generate prototypes (-so. file) for all declared terminals
    if (result.alphabet.length > 0) {
      result.prototypesFile = generatePrototypes(result.alphabet);
    }

    // Propagate encoder errors (e.g. BOLSIZE violations)
    if (encoded.errors?.length) {
      result.errors.push(...encoded.errors.map(e => typeof e === 'string' ? { message: e } : e));
    }

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
