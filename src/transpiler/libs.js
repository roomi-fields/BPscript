/**
 * BPScript Library Loader
 *
 * Loads lib/*.json files based on @ directives in the source.
 * Convention: @file → lib/file.json
 *             @file.key → lib/file.json → entry "key"
 *             @file.key:runtime → load + bind to runtime
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_DIR = join(__dirname, '../../lib');

// Cache loaded libs
const cache = {};

function loadJsonFile(name) {
  if (cache[name]) return cache[name];
  try {
    const data = JSON.parse(readFileSync(join(LIB_DIR, name + '.json'), 'utf-8'));
    cache[name] = data;
    return data;
  } catch {}
  return null;
}

/**
 * Load a lib by name, with optional subkey.
 * @file → lib/file.json (whole file)
 * @file.subkey → lib/file.json → entry from the top-level collection
 *
 * For alphabets.json: the collection key is "alphabets"
 * For sub.json: the collection key is "tables"
 * Generic fallback: tries the subkey directly on the root object
 */
function loadLib(name, subkey) {
  if (subkey) {
    const file = loadJsonFile(name);
    if (!file) return null;
    // Look for subkey in known collection fields, or directly on root
    const entry = file.alphabets?.[subkey] || file.tables?.[subkey] || file[subkey];
    return entry || null;
  }

  // No subkey — load the whole file
  return loadJsonFile(name);
}

/**
 * Load all libraries referenced by @ directives in the AST.
 * Returns a merged context: { controls, controlMap, noArgControls, symbols }
 */
function loadLibsFromDirectives(directives) {
  const ctx = {
    controls: {},       // name → { bp3, args, ... }
    controlMap: {},     // name → bp3 name (e.g. "vel" → "_vel")
    controlNames: new Set(),
    noArgControls: new Set(),
    symbols: {},        // name → { type, ... }
    _libs: {},          // directive name → raw lib data (for generator access)
  };

  // Always load settings (engine defaults)
  const settingsLib = loadLib('settings');
  if (settingsLib) ctx._libs['settings'] = settingsLib;

  for (const dir of directives) {
    const lib = loadLib(dir.name, dir.subkey);
    if (!lib) continue;
    const libKey = dir.subkey ? `${dir.name}.${dir.subkey}` : dir.name;
    ctx._libs[libKey] = lib;

    // Merge controls
    if (lib.controls) {
      for (const [name, def] of Object.entries(lib.controls)) {
        ctx.controls[name] = def;
        ctx.controlMap[name] = def.bp3;
        ctx.controlNames.add(name);
        if (def.args.length === 0) {
          ctx.noArgControls.add(name);
        }
      }
    }

    // Merge symbols
    if (lib.symbols) {
      for (const [name, def] of Object.entries(lib.symbols)) {
        ctx.symbols[name] = def;
      }
    }
  }

  return ctx;
}

export { loadLib, loadLibsFromDirectives, LIB_DIR };
