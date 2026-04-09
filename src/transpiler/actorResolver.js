/**
 * BPScript Actor Resolver
 *
 * Resolves actor bindings at compile time:
 * 1. Loads each actor's alphabet → expands terminals (notes × alterations × registers)
 * 2. Builds symbolActorMap: terminal → actor(s) that own it
 * 3. Resolves implicit actor on Symbol nodes (when unambiguous)
 * 4. Detects conflicts (ambiguous symbol without dot notation)
 *
 * Called between parser and encoder. If no actors are declared, returns empty tables.
 */

import { loadLib } from './libs.js';

/**
 * Expand an alphabet lib into a set of terminal names.
 * Mirrors the logic in libs.js loadLibsFromDirectives (terminal generation).
 *
 * @param {Object} alphabetLib - alphabet entry from alphabets.json (has notes, alterations, octaves)
 * @returns {Set<string>} set of terminal names
 */
function expandAlphabetTerminals(alphabetLib) {
  const terminals = new Set();
  if (!alphabetLib || !alphabetLib.notes) return terminals;

  // Resolve octave convention
  const octaveConvention = alphabetLib.octaves;
  const octaveDef = octaveConvention ? loadLib('octaves')?.[octaveConvention] : null;

  const alts = alphabetLib.alterations && typeof alphabetLib.alterations === 'object'
      && !Array.isArray(alphabetLib.alterations)
    ? Object.keys(alphabetLib.alterations)
    : (Array.isArray(alphabetLib.alterations) && alphabetLib.alterations.length > 0
        ? alphabetLib.alterations : ['']);

  for (const note of alphabetLib.notes) {
    if (octaveDef) {
      for (const alt of alts) {
        for (const reg of octaveDef.registers) {
          const noteAlt = note + alt;
          const terminal = octaveDef.position === 'suffix'
            ? noteAlt + octaveDef.separator + reg
            : reg + octaveDef.separator + noteAlt;
          terminals.add(terminal);
        }
      }
    } else {
      // No octaves — raw notes (e.g. tabla, abc)
      terminals.add(note);
    }
  }

  return terminals;
}

/**
 * Resolve actors for the AST.
 *
 * @param {Object} ast - parsed Scene AST (with actors[] and subgrammars[])
 * @returns {{ actorTable: Object, terminalActorMap: Object, errors: Array }}
 *
 * actorTable: { actorName → { alphabet, scale, sounds, transport, eval, symbols: string[] } }
 * terminalActorMap: { terminalName → actorName }
 */
function resolveActors(ast) {
  const errors = [];
  const actorTable = {};
  const terminalActorMap = {};

  if (!ast.actors || ast.actors.length === 0) {
    return { actorTable, terminalActorMap, errors };
  }

  // 1. Build actor table — load alphabet for each actor, expand terminals
  const symbolActorMap = new Map(); // terminal → Set<actorName>

  for (const actor of ast.actors) {
    const name = actor.name;
    const props = actor.properties;
    const alphabetKey = props.alphabet;

    if (!alphabetKey) {
      errors.push({ message: `Actor "${name}" has no alphabet property`, line: actor.line });
      continue;
    }

    // Load alphabet from alphabets.json
    const alphabetLib = loadLib('alphabet', alphabetKey);
    if (!alphabetLib) {
      errors.push({ message: `Alphabet "${alphabetKey}" not found for actor "${name}"`, line: actor.line });
      continue;
    }

    // Expand terminals
    const terminals = expandAlphabetTerminals(alphabetLib);

    actorTable[name] = {
      alphabet: alphabetKey,
      scale: props.scale || null,
      sounds: props.sounds || null,
      transport: props.transport || null,
      eval: props.eval || null,
      symbols: [...terminals],
    };

    // Register each terminal → actor
    for (const terminal of terminals) {
      if (!symbolActorMap.has(terminal)) {
        symbolActorMap.set(terminal, new Set());
      }
      symbolActorMap.get(terminal).add(name);
    }
  }

  // 2. Build terminalActorMap from declarations (gate Sa:sitar)
  //    Declarations with a runtime that matches an actor name → actor binding
  const actorNames = new Set(Object.keys(actorTable));

  for (const decl of (ast.declarations || [])) {
    if (decl.runtime && actorNames.has(decl.runtime)) {
      terminalActorMap[decl.name] = decl.runtime;
    }
  }

  // 3. Walk AST — resolve implicit actor on Symbol nodes + detect conflicts
  for (const sg of (ast.subgrammars || [])) {
    for (const rule of (sg.rules || [])) {
      resolveSymbolsInRhs(rule.rhs, symbolActorMap, actorTable, terminalActorMap, errors);
    }
  }

  return { actorTable, terminalActorMap, errors };
}

/**
 * Walk RHS elements recursively, resolving actor on Symbol nodes.
 */
function resolveSymbolsInRhs(elements, symbolActorMap, actorTable, terminalActorMap, errors) {
  if (!elements) return;

  for (const el of elements) {
    if (el.type === 'Symbol') {
      if (el.actor) {
        // Explicit dot notation: sitar.Sa → already resolved by parser
        terminalActorMap[el.name] = el.actor;
      } else {
        // Implicit: check symbolActorMap
        const actors = symbolActorMap.get(el.name);
        if (actors && actors.size === 1) {
          // Unambiguous — assign actor implicitly
          const actorName = [...actors][0];
          el.actor = actorName;
          terminalActorMap[el.name] = actorName;
        } else if (actors && actors.size > 1) {
          // Ambiguous — check if declaration resolved it
          if (!terminalActorMap[el.name]) {
            const actorList = [...actors].join(', ');
            errors.push({
              message: `Ambiguous symbol "${el.name}" — owned by actors: ${actorList}. Use dot notation (e.g. ${[...actors][0]}.${el.name}) or declare with gate ${el.name}:<actor>`,
              line: el.line,
            });
          } else {
            // Declaration resolved it — propagate to element
            el.actor = terminalActorMap[el.name];
          }
        }
        // If symbol is not in any actor's alphabet, leave actor null (not an actor-managed terminal)
      }
    }

    // Recurse into nested structures
    if (el.type === 'Polymetric' && el.voices) {
      for (const voice of el.voices) {
        resolveSymbolsInRhs(voice, symbolActorMap, actorTable, terminalActorMap, errors);
      }
    }
    if (el.type === 'SimultaneousGroup') {
      if (el.primary) resolveSymbolsInRhs([el.primary], symbolActorMap, actorTable, terminalActorMap, errors);
      if (el.secondaries) resolveSymbolsInRhs(el.secondaries, symbolActorMap, actorTable, terminalActorMap, errors);
    }
  }
}

export { resolveActors, expandAlphabetTerminals };
