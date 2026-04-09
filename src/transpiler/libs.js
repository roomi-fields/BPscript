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

// Canonical filenames (directive name → JSON file name)
const fileAliases = { alphabet: 'alphabets' };

function loadJsonFile(name) {
  const canonical = fileAliases[name] || name;
  if (cache[canonical]) return cache[canonical];

  // Try registry first (canonical then original name)
  const regData = registry[canonical] || registry[name];
  if (regData) {
    cache[canonical] = regData;
    return regData;
  }

  // Node.js filesystem fallback
  if (_readFileSync && _LIB_DIR) {
    try {
      const data = JSON.parse(_readFileSync(_LIB_DIR + '/' + canonical + '.json', 'utf-8'));
      cache[canonical] = data;
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
    if (file) {
      // Look for subkey in known collection fields, or directly on root
      const entry = file.alphabets?.[subkey] || file.tables?.[subkey] || file[subkey];
      if (entry) return entry;
    }
    // Fallback: try name/subkey as a separate file (e.g. settings/visser2.json)
    const subFile = loadJsonFile(name + '/' + subkey);
    if (subFile) return subFile;
    return null;
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
    bp3NativeControls: new Set(),  // controls BP3 understands natively (no "transport" field)
    dispatcherOnlyControls: new Set(),  // controls only the dispatcher understands (have "transport" field, e.g. webaudio)
    subgrammarControls: new Map(),  // subgrammar-level directives: name → { bp3, args }
    noArgControls: new Set(),
    symbols: {},        // name → { type, ... }
    cvObjects: {},      // "lib.type" → def (e.g. "filter.adsr" → { parameters, ... })
    _libs: {},          // directive name → raw lib data (for generator access)
    _alphabets: [],     // loaded alphabet libs (deferred terminal generation)
    _octaveConvention: null,  // resolved octave convention name
    transcriptions: {},  // name → { mappings: { a: b, ... } }
  };

  // Always load settings (engine defaults)
  const settingsLib = loadLib('settings');
  if (settingsLib) ctx._libs['settings'] = settingsLib;

  for (const dir of directives) {
    const lib = loadLib(dir.name, dir.subkey);
    if (!lib) continue;
    const libKey = dir.subkey ? `${dir.name}.${dir.subkey}` : dir.name;
    ctx._libs[libKey] = lib;

    // Merge subgrammar-level directives (destru, striated, smooth, mm)
    if (lib.subgrammar) {
      for (const [name, def] of Object.entries(lib.subgrammar)) {
        if (name === '_comment') continue;
        ctx.subgrammarControls.set(name, def);
      }
    }

    // Merge controls — engine (BP3 native) and runtime (dispatcher)
    const controlSources = [];
    if (lib.controls) controlSources.push({ source: lib.controls, isEngine: false });
    if (lib.engine) controlSources.push({ source: lib.engine, isEngine: true });
    if (lib.runtime) controlSources.push({ source: lib.runtime, isEngine: false });
    for (const { source, isEngine } of controlSources) {
      for (const [name, def] of Object.entries(source)) {
        if (name === '_comment') continue;
        ctx.controls[name] = def;
        ctx.controlMap[name] = def.bp3 || `_${name}`;
        ctx.controlNames.add(name);
        // Engine section = BP3 native (temporal/structural: goto, tempo, repeat...)
        // Runtime section = dispatcher (sound/performance: vel, chan, wave...)
        if (isEngine) {
          ctx.bp3NativeControls.add(name);
        } else {
          ctx.dispatcherOnlyControls.add(name);
        }
        if (!def.args || def.args.length === 0) {
          ctx.noArgControls.add(name);
        }
      }
    }

    // Merge symbols from lib.symbols
    if (lib.symbols) {
      for (const [name, def] of Object.entries(lib.symbols)) {
        ctx.symbols[name] = def;
      }
    }
    // Alphabet libs: defer terminal generation (needs octave convention resolved first)
    if (lib.notes && Array.isArray(lib.notes)) {
      ctx._alphabets.push(lib);
      // Set default octave convention from alphabet (can be overridden by @octaves)
      if (lib.octaves) ctx._octaveConvention = lib.octaves;
    }
    // @octaves:xxx — override octave convention
    if (dir.name === 'octaves' && dir.runtime) {
      ctx._octaveConvention = dir.runtime;
    }
    // @transcription.xxx — load transcription table (homomorphism)
    if (dir.name === 'transcription' && dir.subkey && (lib?.mappings || lib?.sections)) {
      ctx.transcriptions[dir.subkey] = lib;
    }

    // Merge CV objects (lib.type === "cv")
    if (lib.type === 'cv' && lib.objects) {
      const libName = lib.name || dir.name;
      for (const [objName, def] of Object.entries(lib.objects)) {
        ctx.cvObjects[`${libName}.${objName}`] = def;
      }
    }
  }

  // Generate terminals from deferred alphabets (after all directives processed)
  // Octave convention is now fully resolved (alphabet default + @octaves override)
  const octaveDef = ctx._octaveConvention
    ? loadLib('octaves')?.[ctx._octaveConvention]
    : null;

  for (const lib of ctx._alphabets) {
    if (octaveDef) {
      // Generate all combinations: note + alteration + register
      const alts = lib.alterations && typeof lib.alterations === 'object' && !Array.isArray(lib.alterations)
        ? Object.keys(lib.alterations)
        : (Array.isArray(lib.alterations) && lib.alterations.length > 0 ? lib.alterations : ['']);
      for (const note of lib.notes) {
        for (const alt of alts) {
          for (const reg of octaveDef.registers) {
            const noteAlt = note + alt;
            const terminal = octaveDef.position === 'suffix'
              ? noteAlt + octaveDef.separator + reg
              : reg + octaveDef.separator + noteAlt;
            ctx.symbols[terminal] = { type: 'gate' };
          }
        }
      }
    } else {
      // No octaves — terminals are just the raw notes (e.g. tabla, abc)
      for (const note of lib.notes) {
        ctx.symbols[note] = { type: 'gate' };
      }
    }
  }

  return ctx;
}

export { loadLib, loadLibsFromDirectives, registerLib, registerAll, clearRegistry, LIB_DIR };
