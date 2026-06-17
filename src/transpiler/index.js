/**
 * BPScript Transpiler — Facade
 *
 * DEUX modes SÉPARÉS (directive Romain 2026-06-17) :
 *   - compileBPS(source)       → ancienne voie BP3 : { grammar, alphabet, settings, … }.
 *                                 Voie 2 héritée (encodeur), vouée au retrait.
 *   - compileToBPxAST(source)  → voie AST BPx : { ast, backticks, flagStates, libraries, … }.
 *                                 Produit l'arbre COMPLET SANS l'ancien format (aucun encode).
 */

import { tokenize } from './tokenizer.js';
import { parse, ParseError } from './parser.js';
import { encode } from './encoder.js';
import { generatePrototypes } from './prototypes.js';
import { resolveActors } from './actorResolver.js';
import { compileToBPxAST } from './bpxAst.js';

function compileBPS(source) {
  const result = { grammar: '', alphabet: [], settings: [], alphabetFile: null, prototypesFile: null, ast: null, errors: [], warnings: [] };

  try {
    // 1. Tokenize
    const tokens = tokenize(source);

    // 2. Parse → AST
    // warnings : avertissements non fatals (ex. @-formes de production
    // dépréciées, décision 2026-06-11) — canal séparé de errors.
    const ast = parse(tokens, { onWarning: (w) => result.warnings.push(w) });
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
    result.backticks = encoded.backticks;   // lot 4: table id BT<interp><id> → {interp, code}
    result.flagStates = encoded.flagStates;  // A5: états de drapeau nommés { flag → {alias→int} }
    result.libraries = encoded.libraries;    // @library.<moteur> "nom" → { moteur → [noms] }
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
    result.routingTable = encoded.routingTable;   // Z1 (#105): loaded @routing config
    result.labelIndex = encoded.labelIndex;        // Z2 (#106): label → targeted RHS elements
    result.ccAliases = encoded.ccAliases;          // Z5 (#109): named MIDI CC → number (runtime inbound)
    result.homomorphisms = encoded.homomorphisms;  // Contrat BPx: HomomorphismDeclAST[] (ast.ts:150-157)

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

export { compileBPS, compileToBPxAST };
