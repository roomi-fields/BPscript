/**
 * BPScript Library Loader
 *
 * Loads lib/*.json files based on @ directives in the source.
 * Convention: @xxx → lib/xxx.json (except @+ → lib/controls.json)
 * Alphabets: if no lib/<name>.json exists, looks in lib/alphabets.json
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_DIR = join(__dirname, '../../lib');

// Only special case: @+ can't be a filename
const SPECIAL = { '+': 'controls' };

// Cache loaded libs
const cache = {};

function loadLib(name) {
  if (cache[name]) return cache[name];
  const fileName = SPECIAL[name] || name;

  // Try lib/<name>.json
  try {
    const data = JSON.parse(readFileSync(join(LIB_DIR, fileName + '.json'), 'utf-8'));
    cache[name] = data;
    return data;
  } catch {}

  // Fallback: try as entry in lib/alphabets.json
  try {
    if (!cache._alphabets) {
      cache._alphabets = JSON.parse(readFileSync(join(LIB_DIR, 'alphabets.json'), 'utf-8'));
    }
    const alpha = cache._alphabets.alphabets?.[name];
    if (alpha) {
      cache[name] = alpha;
      return alpha;
    }
  } catch {}

  return null;
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
    const lib = loadLib(dir.name);
    if (!lib) continue;
    ctx._libs[dir.name] = lib;

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
