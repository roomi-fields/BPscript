/**
 * BPScript Library Loader
 *
 * Loads lib/*.json files based on @ directives in the source.
 * Convention: @file → lib/file.json
 *             @file.key → lib/file.json → entry "key"
 *             @file.key:runtime → load + bind to runtime
 *
 * Browser-compatible: use registerLib() / registerAll() to pre-load libs.
 * Node.js fallback: readFileSync if no registry entry found.
 */

// Registry: pre-loaded libs (browser or Node pre-registration)
const registry = {};

// Cache loaded libs (from filesystem or registry)
const cache = {};

/**
 * Register a single lib by name (e.g. "controls" → contents of lib/controls.json).
 */
function registerLib(name, data) {
  registry[name] = data;
  cache[name] = data;  // also populate cache
}

/**
 * Register multiple libs at once.
 * @param {Object} libs - { name: data, ... }
 */
function registerAll(libs) {
  for (const [name, data] of Object.entries(libs)) {
    registerLib(name, data);
  }
}

/**
 * Clear all registered libs and cache (for testing).
 */
function clearRegistry() {
  for (const k of Object.keys(registry)) delete registry[k];
  for (const k of Object.keys(cache)) delete cache[k];
}

// Node.js filesystem fallback (only available in Node)
let _readFileSync = null;
let _LIB_DIR = null;

try {
  // Dynamic import of Node.js modules — will fail silently in browser
  const fs = await import('fs');
  const url = await import('url');
  const path = await import('path');
  _readFileSync = fs.readFileSync;
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  _LIB_DIR = path.join(__dirname, '../../lib');
} catch {
  // Browser environment — no filesystem access, registry only
}

const LIB_DIR = _LIB_DIR;

function loadJsonFile(name) {
  if (cache[name]) return cache[name];

  // Try registry first
  if (registry[name]) {
    cache[name] = registry[name];
    return registry[name];
  }

  // Node.js filesystem fallback
  if (_readFileSync && _LIB_DIR) {
    try {
      const data = JSON.parse(_readFileSync(_LIB_DIR + '/' + name + '.json', 'utf-8'));
      cache[name] = data;
      return data;
    } catch {}
  }

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
    cvObjects: {},      // "lib.type" → def (e.g. "filter.adsr" → { parameters, ... })
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

    // Merge CV objects (lib.type === "cv")
    if (lib.type === 'cv' && lib.objects) {
      const libName = lib.name || dir.name;
      for (const [objName, def] of Object.entries(lib.objects)) {
        ctx.cvObjects[`${libName}.${objName}`] = def;
      }
    }
  }

  return ctx;
}

export { loadLib, loadLibsFromDirectives, registerLib, registerAll, clearRegistry, LIB_DIR };
