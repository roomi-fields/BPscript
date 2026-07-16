/**
 * BPScript Encoder
 * Source: BPSCRIPT_EBNF.md — Table de traduction BPscript → BP3
 *
 * Walks the AST and produces BP3 grammar text + alphabet + settings.
 * Controls loaded from lib/controls.json — single source of truth.
 */

import { loadLibsFromDirectives, loadLib } from './libs.js';
import { BP3_OPERATORS } from './constants.js';

// Valeurs canoniques BP3 des opérateurs (*,+,;) — pour filter idempotent dans
// l'encodeur. Après la normalisation parser, el.name est déjà '*'/'+'/ ';';
// le check `el.name in BP3_OPERATORS` ne match plus (les clés sont star/plus/fin).
// Ce set permet de reconnaître les formes canoniques et de ne pas les alphabétiser.
const BP3_OPERATOR_VALUES = new Set(Object.values(BP3_OPERATORS));

// Maps BPS mode names to BP3 mode names
const MODE_MAP = {
  random: 'RND', ord: 'ORD', sub1: 'SUB1', sub: 'SUB',
  lin: 'LIN', tem: 'TEM', poslong: 'POSLONG',
};

// Maps BPS scan names to BP3 derivation mode
const SCAN_MAP = {
  left: 'LEFT', right: 'RIGHT', rnd: 'RND',
};

// Maps BPS arrows to BP3 arrows
const ARROW_MAP = {
  '->': '-->', '<-': '<--', '<>': '<->',
};

// Module-level state for control token generation (reset per encode() call)
let _output = null;
let _ctIndex = 0;
let _cvIndex = 0;
let _cvNames = {};  // CV instance name → cvTable index mapping
let _nonTerminals = new Set();
let _usedTerminals = new Set();  // terminals actually referenced in grammar RHS
let _bp3Native = new Set();  // engine controls emitted as BP3 native (e.g. _staccato, _legato)
let _seqPrefix = new Set();  // engine controls with scope:seq_prefix (retro, shuffle, order, rotate)
let _dualCtx = new Set();   // controls in both engine and runtime — () always routes to _script
// Time pattern names from @timepatterns — these are duration symbols, NOT sound terminals.
// They must never be added to the sound alphabet (BP3 recognises them via TIMEPATTERNS: section).
let _timePatternNames = new Set();
// Homomorphism invocation names from @transcription — these are homo labels, NOT sound terminals.
// They must never be added to the sound alphabet (they name a transformation, not a bol).
// Built from libCtx.transcriptions: mappings → the subkey, sections → section names.
let _homoNames = new Set();

// BP3 reserved words must never appear in the alphabet (Error code 54).
// Module-scoped so both the alphabet-seeding pass in encode() and the RHS
// terminal encoders (encodeRhsElementInner) share the same filter.
const BP3_RESERVED = new Set(['lambda', 'nil', 'empty', 'null']);

// BP3_OPERATORS importé depuis constants.js (source unique partagée avec parser.js).
// Historique du commentaire conservé ici pour référence :
// `plus`→`+` jonction/continuation, `fin`→`;` terminateur de séquence,
// `star`→`*` marqueur homomorphisme/wildcard (Encode.c:1316-1338, BP3main.h:126).
// Ces opérateurs ne doivent JAMAIS être ajoutés à l'alphabet.

function encode(ast) {
  const output = { grammar: '', alphabet: new Set(), settings: [], controlTable: [], cvTable: [], mapTable: [], sceneTable: {}, exposeTable: [], duration: null, macroTable: [], aliasTable: [], labelTable: [], labelIndex: {}, ccAliases: {}, backticks: {} };
  _output = output;
  _ctIndex = 0;
  _cvIndex = 0;
  _cvNames = {};
  _usedTerminals = new Set();
  _timePatternNames = new Set();
  _homoNames = new Set();

  // A5 — états de drapeau nommés (@flag scene: calm:1, full:2). Construit la table
  // { flag → { alias → entier } } AVANT l'encodage des règles, pour résoudre les
  // valeurs nommées dans les gardes et mutations.
  output.flagStates = {};
  for (const dir of (ast.directives || [])) {
    if (dir.type === 'FlagStatesDirective') {
      const m = output.flagStates[dir.flag] || {};
      for (const s of dir.states) m[s.name] = s.value;
      output.flagStates[dir.flag] = m;
    }
  }

  // Librairies de runtime (@library.<moteur> "nom") — partagées par toutes les voix du
  // moteur. { moteur → [noms] }. Résolution (chargement réel) = Kanopi/workspace.
  output.libraries = {};
  for (const dir of (ast.directives || [])) {
    if (dir.type === 'LibraryDirective') {
      (output.libraries[dir.engine] = output.libraries[dir.engine] || []).push(dir.name);
    }
  }

  const lines = [];

  // Load control map from libs based on @ directives
  const libCtx = loadLibsFromDirectives(ast.directives);
  const CONTROL_MAP = libCtx.controlMap;
  _bp3Native = libCtx.bp3NativeControls;
  _seqPrefix = libCtx.seqPrefixControls;
  _dualCtx = libCtx.dualContextControls;

  // Build set of homomorphism invocation names so they are never seeded into
  // the alphabet. For 'mappings' format the name is the subkey; for 'sections'
  // format the names are the section keys.
  for (const [subkey, table] of Object.entries(libCtx.transcriptions || {})) {
    if (table.sections) {
      for (const secName of Object.keys(table.sections)) {
        if (secName !== '*') _homoNames.add(secName);
      }
    } else if (table.mappings) {
      _homoNames.add(subkey);
    }
  }

  // Build CV table from cvInstances
  if (ast.cvInstances) {
    for (const cv of ast.cvInstances) {
      const cvId = `CV${_cvIndex++}`;
      _cvNames[cv.name] = cvId;

      // Resolve positional args to named parameters from lib definition
      const resolvedArgs = { ...cv.namedArgs };
      if (cv.lib && cv.objectType !== 'backtick') {
        const libKey = `${cv.lib}.${cv.objectType}`;
        const def = libCtx.cvObjects?.[libKey];
        if (def?.parameters) {
          const paramNames = Object.keys(def.parameters);
          for (let i = 0; i < cv.args.length; i++) {
            if (i < paramNames.length) {
              resolvedArgs[paramNames[i]] = cv.args[i];
            }
          }
        }
      }

      output.cvTable.push({
        id: cvId,
        name: cv.name,
        // Déclaration CV descriptive (design 2026-06-20) : plus de cible/route sur la
        // déclaration (le branchement se fait au point de paramètre). target/cvin/transport
        // restent null pour rétro-compat de la table héritée.
        target: cv.target ?? null,
        cvin: cv.cvin ?? null,
        transport: cv.transport ?? null,
        lib: cv.lib,
        objectType: cv.objectType,
        args: resolvedArgs,
        code: cv.code || null,
      });

      // Add CV name to alphabet so BP3 treats it as a terminal with duration
      output.alphabet.add(cv.name);
    }
  }

  // Build scene table from @scene directives — scene names become terminals
  const sceneNames = new Set();
  if (ast.scenes) {
    for (const sc of ast.scenes) {
      output.sceneTable[sc.name] = { file: sc.file };
      sceneNames.add(sc.name);
      output.alphabet.add(sc.name);
    }
  }

  // Build expose table from @expose directives
  if (ast.exposes) {
    for (const exp of ast.exposes) {
      for (const flag of exp.flags) {
        if (!output.exposeTable.includes(flag)) output.exposeTable.push(flag);
      }
    }
  }

  // Z2 (#106) — Build the label → targeted-elements index BEFORE resolving @map
  // endpoints, so a scoped endpoint like `kick.ratio` (LANGUAGE.md:1172) whose
  // scope is a label resolves to a `label` target instead of being mistaken for
  // an actor-scoped flag. The `@`-suffix labels on RHS elements (parser.js:1557)
  // were parsed but never emitted; this index locates each labelled element.
  output.labelIndex = buildLabelIndex(ast.subgrammars);

  // Known label names = @label declarations + every @-suffix label found in the
  // RHS (keys of the index just built).
  const labelNames = new Set(Object.keys(output.labelIndex));
  for (const l of (ast.labels || [])) labelNames.add(l.name);

  // Build map table from @map directives (I/O mappings: CC/OSC ↔ triggers/flags)
  // Resolve named CC aliases and scoped endpoints
  if (ast.maps) {
    for (const m of ast.maps) {
      const entry = { source: resolveMapEndpoint(m.source), arrow: m.arrow, target: resolveMapEndpoint(m.target) };
      output.mapTable.push(entry);
    }
  }

  function resolveMapEndpoint(ep) {
    if (!ep) return ep;
    // Resolve CC alias: @cc breath:2 + @map breath -> [x] → cc:2
    if (ep.kind === 'alias') {
      const def = libCtx.controls[ep.name];
      if (def?.ccNumber != null) {
        return { kind: 'cc', number: def.ccNumber, params: ep.params || null };
      }
      return ep;
    }
    // Resolve scoped: scene.X → sys command, label.X → label target, actor.X → flag
    if (ep.kind === 'scoped') {
      if (sceneNames.has(ep.scope)) {
        return { kind: 'sys', scene: ep.scope, command: ep.name };
      }
      // Z2 — label.param: @map cc:1 -> kick.ratio. `kick` is a known label, so
      // the endpoint targets every element carrying that label; `param` is the
      // controllable parameter (ratio, vel, ...). The concrete element list is
      // available in output.labelIndex[label].
      if (labelNames.has(ep.scope)) {
        return { kind: 'label', label: ep.scope, param: ep.name };
      }
      // Assume actor-scoped flag
      return { kind: 'flag', name: ep.name, actor: ep.scope };
    }
    return ep;
  }

  // Collect time pattern names from @timepatterns — they are duration symbols,
  // NOT sound terminals. Must be known before alphabet building so that
  // encodeRhsElementInner can skip adding them to the alphabet.
  for (const dir of ast.directives) {
    if (dir.timePatterns) {
      for (const p of dir.timePatterns) _timePatternNames.add(p.name);
    }
  }

  // Build alphabet from DECLARATIONS (gate/trigger/cv), loaded alphabets, and
  // bare RHS terminals — see BP3_RESERVED note at module scope.
  // 1. Explicit declarations: gate a:midi, trigger x:sc, cv lfo:webaudio
  if (ast.declarations) {
    for (const decl of ast.declarations) {
      // BP3_OPERATORS (plus/fin/star) are grammar operators, not bols: a
      // `@gate plus:midi` declaration in a ported Bernard grammar names the
      // `+` operator, which must stay out of the alphabet.
      if (!BP3_RESERVED.has(decl.name) && !(decl.name in BP3_OPERATORS)) {
        output.alphabet.add(decl.name);
      }
    }
  }
  // 2. Loaded alphabet libraries: @alphabet.western:midi → symbols from lib
  for (const [name, def] of Object.entries(libCtx.symbols)) {
    if (!BP3_RESERVED.has(name)) output.alphabet.add(name);
  }
  // NOTE: time pattern names are NOT added to the sound alphabet —
  // they live solely in TIMEPATTERNS: section (collected in _timePatternNames above).

  // Collect all non-terminals (symbols that appear as LHS of rules)
  // Exception: in SUB/SUB1 mode, LHS symbols are also terminals (substitution
  // rules replace patterns, and remaining symbols must be in the alphabet)
  _nonTerminals = new Set();
  for (const sub of ast.subgrammars) {
    const isSub = sub.mode === 'sub' || sub.mode === 'sub1';
    for (const rule of sub.rules) {
      for (const el of rule.lhs) {
        // Operator identifiers (star/plus/fin ou formes canoniques *,+,;) sur
        // un LHS sont des opérateurs BP3, pas des non-terminaux (ex: `+ M16 + * <-> ...`
        // dans -gr.dhati). Les exclure évite qu'ils soient traités comme des
        // variables réécrivables.
        const isOp = (el.name in BP3_OPERATORS) || BP3_OPERATOR_VALUES.has(el.name);
        if (el.type === 'Symbol' && !isSub && !isOp) {
          _nonTerminals.add(el.name);
        }
      }
    }
  }

  // --- Headers ---

  lines.push(`// Bol Processor BP3`);
  lines.push(`// Generated from BPScript`);

  // Directives → settings and file refs
  for (const dir of ast.directives) {
    if (dir.name === 'tempo' && dir.value != null) {
      output.settings.push(`-se.bpscript`);
    }
  }

  // Alphabet is loaded via bp3_load_alphabet() — NOT via -ho reference in grammar.
  // The grammar stays clean, the runtime layer handles alphabet loading.

  // Global preamble and RHS prefix from @ directives
  const subgrammarCtrl = libCtx.subgrammarControls;  // Map: name → { bp3, args }
  const preamble = [];    // Valid BP3 preamble items (subgrammar directives)
  const rhsPrefix = [];   // Controls injected at start of first rule's RHS

  for (const dir of ast.directives) {
    if (subgrammarCtrl.has(dir.name)) {
      // Subgrammar directive used as global (@striated, @smooth, @mm:60)
      const def = subgrammarCtrl.get(dir.name);
      preamble.push(dir.value != null ? `${def.bp3}(${dir.value})` : def.bp3);
    } else if (dir.name === 'tempo' && dir.value) {
      // @tempo → goes to settings file, not grammar
    } else if (CONTROL_MAP[dir.name] && dir.value != null) {
      if (_bp3Native.has(dir.name)) {
        rhsPrefix.push(formatNativeValue(CONTROL_MAP[dir.name], dir.value));
      } else {
        const ctName = `CT ${_ctIndex++}`;
        output.controlTable.push({ id: ctName, assignments: { [dir.name]: dir.value } });
        rhsPrefix.push(`_script(${ctName})`);
      }
    }
  }

  // --- Subgrammars ---

  for (let si = 0; si < ast.subgrammars.length; si++) {
    const sub = ast.subgrammars[si];
    const blockNum = sub.index;

    // Determine mode from @mode directive on subgrammar (null = no mode line emitted)
    let mode = null;
    if (sub.mode && MODE_MAP[sub.mode]) {
      mode = MODE_MAP[sub.mode];
    }

    // Mode line (only emit if explicitly set via @mode directive)
    if (mode) lines.push(mode);

    // Preamble: global (first subgrammar) + per-subgrammar modifiers from @mode:X(modifiers)
    const subPreamble = si === 0 ? [...preamble] : [];

    // Modifiers from @mode:X(destru, mm:60, striated)
    if (sub.modifiers) {
      for (const mod of sub.modifiers) {
        const def = subgrammarCtrl.get(mod.name);
        if (def) {
          subPreamble.push(mod.value === true ? def.bp3 : `${def.bp3}(${mod.value})`);
        }
      }
    }

    if (subPreamble.length > 0) {
      lines.push(subPreamble.join(' '));
    }

    // Pass 1: match unbalanced { and } across rules to propagate [speed:N]
    // When }[speed:N] closes a polymetric opened by { in another rule,
    // the ratio N must be emitted after { in BP3 output.
    annotateUnbalancedBraces(sub.rules);

    // Pass 2: encode rules
    for (let ri = 0; ri < sub.rules.length; ri++) {
      const rule = sub.rules[ri];
      const ruleNum = ri + 1;
      let parts = [];

      parts.push(`gram#${blockNum}[${ruleNum}]`);

      // Weight
      const weight = getQualValue(rule.qualifiers, 'weight');
      if (weight !== null) {
        if (weight === 'inf') {
          parts.push('<inf>');
        } else {
          const decrement = getQualDecrement(rule.qualifiers, 'weight');
          if (decrement !== null) {
            parts.push(`<${weight}-${decrement}>`);
          } else {
            parts.push(`<${weight}>`);
          }
        }
      }

      // Scan (derivation mode per rule)
      const scan = getQualValue(rule.qualifiers, 'scan');
      if (scan && SCAN_MAP[scan]) {
        parts.push(SCAN_MAP[scan]);
      }

      // Guard → flags on LHS
      // Guards (single or array)
      if (rule.guard) {
        const guardList = Array.isArray(rule.guard) ? rule.guard : [rule.guard];
        for (const g of guardList) {
          parts.push(encodeGuard(g));
        }
      }

      // Contexts
      for (const ctx of rule.contexts) {
        parts.push(encodeContext(ctx));
      }

      // LHS
      parts.push(encodeLhs(rule.lhs));

      // Arrow
      parts.push(ARROW_MAP[rule.arrow] || '-->');

      // Collect rule-level qualifiers that emit as RHS prefix
      const rhsPrefixParts = [];

      // Inline meter [meter:4+4/6]
      const meter = getQualValue(rule.qualifiers, 'meter');
      if (meter) rhsPrefixParts.push(meter);

      // Tempo / scale operator on rule, e.g. [/2] or [*1/2].
      //
      // Both surface in the AST as a `tempoOp` { operator, value }. They map
      // to BP3's *inline* RHS operators, NOT to the `_tempo(...)` enter/exit
      // bracket pair used for element-scoped [tempo:N] (see encodeRhsElement,
      // line ~1112). Per Encode.c:
      //   '*' → scale-up marker (Encode.c:102-117): `*1/2`, `*3`
      //   '/' followed by a digit → tempo/speed marker (Encode.c:418-425): `/2`
      // The native reference grammar -gr.checktemplates serialises these
      // rule-head qualifiers as `S <-> A A *1/2 A` and `S <-> A A /2 A`, i.e.
      // the bare `operator+value` token. Previously the raw tempoOp object was
      // pushed unstringified → `[object Object]` in the output grammar.
      const ruleTempoOp = getTempoOp(rule.qualifiers);
      if (ruleTempoOp) rhsPrefixParts.push(tempoOpToInline(ruleTempoOp));

      // Controls as rule qualifiers — always suffix (written after RHS in BPscript)
      // Exception: seq_prefix controls (shuffle, order, rotate, retro) → emitted as
      // prefix of the entire RHS (portée suffixe canonique: marqueur en tête de RHS)
      const ruleNativeSuffix = [];
      const ruleRuntimeAssignments = {};
      for (const q of rule.qualifiers) {
        for (const p of q.pairs) {
          if (CONTROL_MAP[p.key]) {
            if (_seqPrefix.has(p.key)) {
              // seq_prefix on a rule: goes to head of RHS
              rhsPrefixParts.push(formatSeqPrefixTokens(p.key, p.value, CONTROL_MAP));
            } else if (_bp3Native.has(p.key)) {
              ruleNativeSuffix.push(formatNativeValue(CONTROL_MAP[p.key], p.value));
            } else {
              ruleRuntimeAssignments[p.key] = p.value;
            }
          }
        }
      }
      if (Object.keys(ruleRuntimeAssignments).length > 0) {
        const ctName = `CT ${_ctIndex++}`;
        output.controlTable.push({ id: ctName, assignments: ruleRuntimeAssignments });
        ruleNativeSuffix.push(`_script(${ctName})`);
      }

      // RHS — inject global controls as prefix of first rule in first subgrammar
      let rhsStr = encodeRhs(rule.rhs, output.alphabet, CONTROL_MAP);
      if (rhsPrefixParts.length > 0) rhsStr = rhsPrefixParts.join(' ') + ' ' + rhsStr;
      if (si === 0 && ri === 0 && rhsPrefix.length > 0) {
        rhsStr = rhsPrefix.join(' ') + (rhsStr ? ' ' + rhsStr : '');
      }

      // Runtime qualifier on rule: S -> C2 C2 (vel:100)
      // Emits start/end pair: _script(CT0) ... _script(CT0_e)
      // Note: dual-context controls (in both engine and runtime) always route to _script in ().
      if (rule.runtimeQualifier) {
        const rqNative = [];
        const rqRuntime = {};
        for (const p of rule.runtimeQualifier.pairs) {
          if (CONTROL_MAP[p.key] && _bp3Native.has(p.key) && !_dualCtx.has(p.key)) {
            // Pure engine control used in () — preserve backward-compat BP3 native emit.
            rqNative.push(formatNativeValue(CONTROL_MAP[p.key], p.value));
          } else {
            rqRuntime[p.key] = p.value;
          }
        }
        const rqPrefix = [...rqNative];
        let rqSuffix = null;
        if (Object.keys(rqRuntime).length > 0) {
          const ctName = `CT ${_ctIndex++}`;
          const ctEndName = `${ctName}_e`;
          output.controlTable.push({ id: ctName, assignments: rqRuntime, scope: 'start' });
          output.controlTable.push({ id: ctEndName, assignments: {}, scope: 'end' });
          rqPrefix.push(`_script(${ctName})`);
          rqSuffix = `_script(${ctEndName})`;
        }
        if (rqPrefix.length > 0) {
          rhsStr = rqPrefix.join(' ') + ' ' + rhsStr;
        }
        if (rqSuffix) {
          rhsStr = rhsStr + ' ' + rqSuffix;
        }
      }

      parts.push(rhsStr);

      // Engine controls that go after RHS (goto, failed, repeat, stop)
      if (ruleNativeSuffix.length > 0) {
        parts.push(...ruleNativeSuffix);
      }

      // RHS flags [phase=2, Atrans, K1] → /phase=2/ /Atrans/ /K1/
      if (rule.flags && rule.flags.length > 0) {
        for (const f of rule.flags) {
          if (f.operator) {
            parts.push(`/${f.flag}${f.operator}${resolveFlagValue(f.flag, f.value)}/`);
          } else {
            parts.push(`/${f.flag}/`);
          }
        }
      }

      lines.push(parts.join(' '));
    }

    // Separator between subgrammars
    if (si < ast.subgrammars.length - 1) {
      lines.push('------------');
    }
  }

  // Optional TEMPLATES: section
  if (ast.templates && ast.templates.length > 0) {
    lines.push('TEMPLATES:');
    for (const entry of ast.templates) {
      const body = encodeTemplateBody(entry.body);
      lines.push(`[${entry.index}] ${entry.scale} ${body}`);
    }
    lines.push('------------');
  }

  // Optional TIMEPATTERNS: section from @timepatterns directive
  for (const dir of ast.directives) {
    if (dir.timePatterns && dir.timePatterns.length > 0) {
      lines.push('TIMEPATTERNS:');
      const patternStrs = dir.timePatterns.map(p => `${p.name}=${p.ratio}`);
      lines.push(patternStrs.join(' '));
    }
  }

  output.grammar = lines.join('\n');

  // D1 — Attache backtick↔acteur : un backtick NON taggé hérite de l'interpréteur de
  // l'acteur propriétaire (la tête de règle = nom de la voix). On résout l'`interp:'auto'`
  // de la table vers l'`eval` de cet acteur. Le tag explicite (override) n'est pas touché.
  const actorEval = {};
  for (const a of (ast.actors || [])) {
    if (a.properties && a.properties.eval) actorEval[a.name] = a.properties.eval;
  }
  const lhsHead = (lhs) => { const h = Array.isArray(lhs) ? lhs[0] : lhs; return h && h.name ? h.name : null; };
  const resolveBackticks = (elements, evalKey) => {
    for (const el of (elements || [])) {
      if (!el || typeof el !== 'object') continue;
      if (el._btName && output.backticks[el._btName] && output.backticks[el._btName].interp === 'auto') {
        output.backticks[el._btName].interp = evalKey;
      }
      if (el.elements) resolveBackticks(el.elements, evalKey);
      if (el.voices) for (const v of el.voices) resolveBackticks(v, evalKey);
    }
  };
  for (const sub of (ast.subgrammars || [])) {
    for (const rule of (sub.rules || [])) {
      const evalKey = actorEval[lhsHead(rule.lhs)];
      if (evalKey) resolveBackticks(rule.rhs, evalKey);
    }
  }

  // Generate alphabet file content from loaded libraries + custom terminals
  output.alphabetFile = generateAlphabetFile(libCtx, ast.directives, output.alphabet);

  // Collect @duration directive
  for (const dir of (ast.directives || [])) {
    if (dir.name === 'duration' && dir.value) {
      output.duration = dir.value;
    }
  }

  // Collect macros, aliases, labels from AST
  if (ast.macros) {
    output.macroTable = ast.macros.map(m => ({ name: m.name, params: m.params || [], body: m.body }));
  }
  if (ast.aliases) {
    output.aliasTable = ast.aliases.map(a => ({ name: a.name, source: a.source }));
  }
  if (ast.labels) {
    output.labelTable = ast.labels.map(l => l.name);
  }

  // Feature @routing / routingTable (Z1 #105) SUPPRIMÉE (décision 2026-07-16, Romain : modèle
  // profils d'environnement studio/live/browser abandonné ; c'était une feature de notre
  // transpileur, PAS le moteur BP3). Le canal de sortie se déclare via `transport.<audio|midi|osc>`
  // sur l'acteur ; @routing est rejeté au parse (parser.js tombstone).

  // Z5 (#109) — Expose named MIDI CC aliases so the downstream orchestrator can
  // resolve inbound CC by name at runtime (e.g. `cc:breath`). `@cc breath:2`
  // (parser.js:357-370 → dir.ccMappings) is already resolved at compile time
  // into mapTable (resolveMapEndpoint, this file: kind 'alias' → kind 'cc'),
  // but BPx never receives the name→number table needed for live inbound CC.
  // We surface it as the `ccAliases` sidecar, mirroring labelIndex.
  output.ccAliases = buildCcAliases(libCtx);

  // Generate settings JSON for BP3 WASM engine
  output.settingsJSON = generateSettingsJSON(libCtx, ast.directives);

  // Terminals actually used in the grammar (for prototype generation)
  output.usedTerminals = _usedTerminals;

  // Propagate scene.homomorphisms (built by the parser from libCtx.transcriptions).
  // Both parse()-direct callers (BPx tests) and compileBPS() callers get the table.
  output.homomorphisms = ast.homomorphisms || [];

  return output;
}

/**
 * Z5 (#109) — Build the ccAliases sidecar: named MIDI CC → controller number.
 *
 * `@cc breath:2, expression:11` is parsed (parser.js:357-370) into
 * `dir.ccMappings` and registered by libs.js (libs.js:157-166) as
 * `ctx.controls[name] = { ..., ccNumber, transportGroup: 'midi' }`. The encoder
 * already resolves a `@map breath -> [x]` endpoint through this table at compile
 * time (resolveMapEndpoint, kind 'alias' → kind 'cc'), but the resulting BP3
 * artefacts carry only the numeric CC. For live inbound control by name
 * (e.g. `cc:breath`), the orchestrator needs the raw name → number table.
 *
 * Source of truth = libCtx.controls (the same table resolveMapEndpoint reads).
 * We keep only entries that carry a concrete `ccNumber`, which is exactly the
 * set produced from `@cc` directives — the built-in generic `cc` control has no
 * `ccNumber`, so it is excluded.
 *
 * Shape: { "<name>": <number>, ... }. Empty object when no `@cc` was used.
 * Additive: does not touch mapTable/controlTable.
 */
function buildCcAliases(libCtx) {
  const aliases = {};
  const controls = libCtx?.controls || {};
  for (const [name, def] of Object.entries(controls)) {
    if (def && def.ccNumber != null) {
      aliases[name] = def.ccNumber;
    }
  }
  return aliases;
}

/**
 * Z2 (#106) — Build the labelIndex sidecar: label name → list of targeted RHS
 * elements, so @map endpoints like `kick.ratio` (LANGUAGE.md:1172) resolve to
 * the concrete elements they control.
 *
 * The parser attaches `el.label` (a string) to any RHS node carrying an
 * `@`-suffix (parser.js:1557). Labels can sit on nested elements (groups,
 * polymetric voices, simultaneous secondaries), so we walk each rule's RHS
 * tree. The same label may appear on several elements (multicast,
 * LANGUAGE.md:1177-1181) — hence a list per label.
 *
 * Shape:
 *   {
 *     "<label>": [
 *       {
 *         subgrammar: number,   // subgrammar index (sub.index)
 *         rule: number,         // 1-based rule number within the subgrammar
 *         path: (number|string)[], // path into the RHS tree: top-level index
 *                                  // then container keys ('primary','voices',i)
 *         element: string,      // element type (Symbol, SymbolCall, Polymetric, ...)
 *         symbol: string|null   // terminal/non-terminal name when applicable
 *       }, ...
 *     ]
 *   }
 *
 * The `path` lets the downstream orchestrator address the exact element; the
 * controllable parameter (e.g. `ratio`, `vel`) comes from the @map endpoint
 * itself (target.name), not from here — this index only locates the targets.
 *
 * Additive: does not alter labelTable (which lists @label declarations only).
 */
function buildLabelIndex(subgrammars) {
  const index = {};

  const record = (label, loc) => {
    if (!index[label]) index[label] = [];
    index[label].push(loc);
  };

  const elementSymbol = (el) => {
    if (el == null) return null;
    if (typeof el.name === 'string') return el.name;
    if (typeof el.symbol === 'string') return el.symbol;
    return null;
  };

  // Recursively walk an RHS element and its children, recording any labels.
  const walk = (el, ctx, path) => {
    if (el == null || typeof el !== 'object') return;

    if (el.label) {
      record(el.label, {
        subgrammar: ctx.subgrammar,
        rule: ctx.rule,
        path: [...path],
        element: el.type || null,
        symbol: elementSymbol(el),
      });
    }

    // Descend into nested element containers (mirrors encodeRhsElementInner).
    switch (el.type) {
      case 'SimultaneousGroup':
        walk(el.primary, ctx, [...path, 'primary']);
        (el.secondaries || []).forEach((sec, i) => walk(sec, ctx, [...path, 'secondaries', i]));
        break;
      case 'Polymetric':
        (el.voices || []).forEach((voice, vi) => {
          (voice || []).forEach((e, ei) => walk(e, ctx, [...path, 'voices', vi, ei]));
        });
        break;
      case 'TemplateMasterGroup':
      case 'TemplateSlaveGroup':
        (el.elements || []).forEach((e, i) => walk(e, ctx, [...path, 'elements', i]));
        break;
      default:
        break;
    }
  };

  for (const sub of (subgrammars || [])) {
    for (let ri = 0; ri < sub.rules.length; ri++) {
      const rule = sub.rules[ri];
      const ctx = { subgrammar: sub.index, rule: ri + 1 };
      (rule.rhs || []).forEach((el, i) => walk(el, ctx, [i]));
    }
  }

  return index;
}

/**
 * Generate BP3 settings JSON from defaults + @ directive overrides.
 */
function generateSettingsJSON(libCtx, directives) {
  const settingsLib = libCtx._libs?.['settings'];
  if (!settingsLib?.bp3_defaults) return null;

  // Clone defaults
  const settings = {};
  for (const [k, v] of Object.entries(settingsLib.bp3_defaults)) {
    settings[k] = { ...v };
  }

  // NoteConvention is ALWAYS 0 — all terminals are silent sound objects
  const directiveMap = settingsLib.directive_map || {};

  // Apply overrides from @ directives (in order — last wins)
  for (const dir of directives) {
    // @settings.name — load a settings file and merge (same format as BP3 -se. JSON)
    if (dir.name === 'settings' && dir.subkey) {
      const settingsFile = loadLib('settings', dir.subkey) || loadLib(dir.subkey);
      if (settingsFile) {
        for (const [k, v] of Object.entries(settingsFile)) {
          if (k.startsWith('_') || k === 'name' || k === 'description' || k === 'version') continue;
          if (typeof v === 'object' && v.value != null) {
            settings[k] = { ...v };
          }
        }
      }
    }
    const mapping = directiveMap[dir.name];
    if (mapping) {
      for (const [settingKey, settingVal] of Object.entries(mapping)) {
        if (settings[settingKey]) {
          settings[settingKey].value = settingVal === '@value' ? String(dir.value) : settingVal;
        }
      }
    }
  }

  // Subgrammar modifiers that affect settings (striated/smooth from @mode:X(...))
  for (const dir of directives) {
    if (dir.modifiers) {
      for (const mod of dir.modifiers) {
        if (mod.name === 'striated') settings.Nature_of_time.value = '1';
        if (mod.name === 'smooth') settings.Nature_of_time.value = '0';
        if (mod.name === 'mm' && mod.value !== true) {
          // mm affects Pclock/Qclock — handled separately
        }
      }
    }
  }

  // WASM invariants — always forced, never overridden by directives or settings files
  settings.NoteConvention.value = '0';   // always silent sound objects
  settings.DisplayItems.value = '1';     // always produce output

  return JSON.stringify(settings);
}

/**
 * Generate a flat alphabet of all terminals used in the grammar.
 * No OCT, no --> : all terminals are custom bols with equal duration.
 * BP3 treats them as opaque names; the dispatcher does the sound mapping.
 */
function generateAlphabetFile(libCtx, directives, customTerminals) {
  if ((!customTerminals || customTerminals.size === 0) &&
      Object.keys(libCtx.transcriptions).length === 0) return null;

  const lines = ['// Generated by BPScript'];

  const hasTranscriptions = Object.keys(libCtx.transcriptions).length > 0;

  // Collect all sections from all transcriptions.
  // For 'sections' format: section name comes from the JSON key.
  // For 'mappings' format: section name = the invocation key (subkey), NOT '*'.
  //   This ensures the grammar file references like `(=tabla_stroke)` resolve
  //   correctly against the section named 'tabla_stroke' in the alphabet file.
  const allSections = {};  // sectionName → { from: to, ... }
  for (const [subkey, table] of Object.entries(libCtx.transcriptions)) {
    if (table.sections) {
      // Multi-sections: { "*": {...}, "TR": {...} }
      for (const [secName, mappings] of Object.entries(table.sections)) {
        allSections[secName] = { ...(allSections[secName] || {}), ...mappings };
      }
    } else if (table.mappings) {
      // Single-section format: use the invocation name (subkey) as section name.
      // Using '*' was a bug — the grammar invokes it by subkey, not by '*'.
      allSections[subkey] = { ...(allSections[subkey] || {}), ...table.mappings };
    }
  }

  // Emit default section (*) with terminals + mappings
  if (hasTranscriptions || Object.keys(allSections).length > 0) {
    lines.push('*');
  }
  for (const t of customTerminals) {
    lines.push(t);
  }
  // Add default section mappings if any
  if (allSections['*']) {
    for (const [from, to] of Object.entries(allSections['*'])) {
      lines.push(`${from} --> ${to}`);
    }
  }

  // Emit named sections
  for (const [secName, mappings] of Object.entries(allSections)) {
    if (secName === '*') continue;  // already emitted above
    lines.push('-----');
    lines.push(secName);
    for (const [from, to] of Object.entries(mappings)) {
      lines.push(`${from} --> ${to}`);
    }
  }

  return lines.join('\n');
}

// --- Guard encoding ---

// A5 — résout un état de drapeau nommé (value = alias déclaré via @flag) en entier.
// Un IDENT non déclaré reste tel quel (référence à un autre drapeau, comportement BP3).
function resolveFlagValue(flag, value) {
  if (typeof value === 'string' && _output && _output.flagStates &&
      _output.flagStates[flag] &&
      Object.prototype.hasOwnProperty.call(_output.flagStates[flag], value)) {
    return _output.flagStates[flag][value];
  }
  return value;
}

function encodeGuard(guard) {
  const value = resolveFlagValue(guard.flag, guard.value);
  if (guard.mutates) {
    return `/${guard.flag}${guard.operator}${value}/`;
  }
  // Bare flag test: [Ideas] → /Ideas/
  if (guard.operator === null) {
    return `/${guard.flag}/`;
  }
  // BP3 expects Unicode operators for compound comparisons (Encode.c:548-561).
  // ASCII `>=`, `<=`, `!=` are parsed as single-char `>`, `<`, `=` → off-by-one bug.
  const op = guard.operator === '==' ? '=' :
             guard.operator === '>=' ? '≥' :  // ≥
             guard.operator === '<=' ? '≤' :  // ≤
             guard.operator === '!=' ? '≠' :  // ≠
             guard.operator;
  return `/${guard.flag}${op}${value}/`;
}

// --- Context encoding ---

// BP3 natif distingue contexte vs symbole LHS uniquement par la présence des
// parenthèses (cf. Encode.c:730-768 — `(` au début de l'argument gauche
// déclenche GetContext, sinon les tokens sont encodés comme symboles LHS
// consommés). On les préserve donc toujours pour les contextes positifs.
//
// Pour les contextes négatifs, BP3 accepte `#X` (un seul symbole, sans parens)
// car le `#` préfixe lève déjà l'ambiguïté avec le LHS. On garde la forme
// compacte `#X` pour un seul symbole IDENT (ainsi que `#?` boundary).
function encodeContext(ctx) {
  // Positive context: always wrap in parens — sans elles, BP3 traite les
  // symboles comme du LHS consommé (Encode.c:730).
  if (ctx.positive) {
    return `(${ctx.symbols.join(' ')})`;
  }
  // Negative context (#) : forme compacte `#X` pour un seul symbole, sinon
  // `#(X Y ...)`. Les caractères structurels (`{`, `}`, `,`) doivent rester
  // entre parens même seuls : `#({)`, `#(})`, `#(,)`.
  if (ctx.symbols.length === 1) {
    const sym = ctx.symbols[0];
    if (sym === '{' || sym === '}' || sym === ',') {
      return `#(${sym})`;
    }
    return `#${sym}`;
  }
  return `#(${ctx.symbols.join(' ')})`;
}

// --- Variable / non-terminal name encoding ---

// BP3 requires every *variable* (non-terminal) to start with an uppercase
// character or be wrapped in '|...|'. Encode.c:GetVar (lines 1227-1243):
//   if(!isupper(c) && !bracket) { ... "Variable must start with uppercase
//   character or '|'. Can't make sense of \"%s\"." ... return(ABORT); }
// A bare lowercase token only survives compilation if it matches an alphabet
// bol first (Encode.c:SEARCHTERMINAL, lines 888-918, runs before the variable
// parser). Terminals are therefore left bare (they are seeded into the
// alphabet); only non-terminals that start lowercase need the pipe wrap.
//
// Confirmed against a real BP3 grammar (test-data/-gr.Ruwet): lowercase
// non-terminals are written `|a4|`, `|x|`, `|z31|` while terminals/notes
// (`fa4`, `do5`, `la4`) stay bare.
//
// `start with an uppercase character` follows the C `isupper()` semantics:
// only an uppercase ASCII letter as the first character keeps the token bare.
//
// A name that is ALSO an alphabet terminal (declared gate/trigger, lib symbol,
// or seeded RHS terminal) is left bare even when it appears as an LHS: BP3
// matches it at SEARCHTERMINAL (lines 888-918) before reaching the variable
// parser, so it is a terminal, not a variable. This mirrors the original BP3
// `flags` grammar where `a`/`b` are declared in the alphabet yet rewritten by
// `a --> b`, and stay bare in the .gr.
function encodeNonTerminalName(name) {
  if (/^[A-Z]/.test(name)) return name;
  if (_output && _output.alphabet && _output.alphabet.has(name)) return name;
  return `|${name}|`;
}

// --- LHS encoding ---

function encodeLhs(elements) {
  return elements.map(el => {
    // A Symbol on the LHS is a non-terminal — except in SUB/SUB1 mode where it
    // is a terminal pattern (not collected into _nonTerminals, see encode()).
    // Only wrap genuine non-terminals; terminals are alphabet bols.
    if (el.type === 'Symbol') {
      // Forme ancienne (identifiant): star/plus/fin → opérateur BP3 (rétro-compat)
      if (el.name in BP3_OPERATORS) return BP3_OPERATORS[el.name];  // + ; *
      // Forme canonique (après normalisation parser): '*'/'+'/';' émis tel quel
      if (BP3_OPERATOR_VALUES.has(el.name)) return el.name;
      return _nonTerminals.has(el.name) ? encodeNonTerminalName(el.name) : el.name;
    }
    if (el.type === 'Prolongation') return '_';
    if (el.type === 'Rest') return '-';
    if (el.type === 'Variable') return `|${el.name}|`;
    if (el.type === 'Wildcard') return el.index != null ? `?${el.index}` : '?';
    if (el.type === 'Context') return encodeContext(el);
    if (el.type === 'RawBrace') return el.value;
    // TemplateAnchor : ancre de gabarit maître « $ nu » → token BP3 « (= » (sans fermeture)
    // Encode.c:1341-1364 : T2,0 — token littéral, ré-émis tel quel au RHS.
    if (el.type === 'TemplateAnchor' && el.kind === 'master') return '(=';
    return el.name || '?';
  }).join(' ');
}

// --- RHS encoding ---

function encodeRhs(elements, alphabet, controlMap) {
  return elements.map(el => encodeRhsElement(el, alphabet, controlMap)).join(' ');
}

function encodeRhsElement(el, alphabet, controlMap) {
  // For Polymetric, seq_prefix qualifiers (retro, shuffle, order, rotate) must
  // be injected INSIDE the group as a prefix, not emitted as external suffix.
  // Collect them before calling encodeRhsElementInner so they can be threaded in.
  let groupSeqPrefixTokens = null;
  if (el.type === 'Polymetric' && el.suffixQualifiers && el.suffixQualifiers.length > 0) {
    const seqParts = [];
    const remaining = [];
    for (const q of el.suffixQualifiers) {
      let hadSeqPrefix = false;
      if (q.pairs) {
        for (const p of q.pairs) {
          if (_seqPrefix.has(p.key)) {
            seqParts.push(formatSeqPrefixTokens(p.key, p.value, controlMap));
            hadSeqPrefix = true;
          }
        }
      }
      if (!hadSeqPrefix) remaining.push(q);
    }
    if (seqParts.length > 0) {
      groupSeqPrefixTokens = seqParts.join(' ');
      // Rebuild suffixQualifiers without seq_prefix entries for this call
      el = { ...el, suffixQualifiers: remaining.length > 0 ? remaining : null };
    }
  }

  const raw = encodeRhsElementInner(el, alphabet, controlMap, groupSeqPrefixTokens);
  let result = raw;
  // Legacy el.tempoOp from polymetric parser
  if (el.tempoOp) {
    if (el.tempoOp.operator === '/') {
      // Bare absolute operator: /N A (no bracket, no exit)
      result = `${tempoOpToBarePrefix(el.tempoOp)} ${result}`;
    } else {
      const pair = tempoOpToPair(el.tempoOp);
      result = `${pair.enter} ${result} ${pair.exit}`;
    }
  }

  // SUFFIX qualifiers: A[weight:50], A(vel:80) — always after the element
  // [] and () are ALWAYS suffix in BPscript. Use ![] or !() for free positioning.
  // tempoOp '/' → bare prefix /N (absolute, persistent, reference duration of field)
  // tempoOp '*' → _tempo(1/N) bracket: enter before, exit _tempo(1/1) after
  const enterTokens = [];
  const exitTokens = [];
  const suffixTokens = [];
  if (el.suffixQualifiers) {
    for (const q of el.suffixQualifiers) {
      if (q.tempoOp) {
        if (q.tempoOp.operator === '/') {
          // Bare absolute operator: /N A — no exit needed (persists until next op/end of field)
          enterTokens.push(tempoOpToBarePrefix(q.tempoOp));
        } else {
          // '*' (slow down): _tempo(1/N) bracket with _tempo(1/1) exit to restore
          const pair = tempoOpToPair(q.tempoOp);
          enterTokens.push(pair.enter);
          exitTokens.push(pair.exit);
        }
      }
      encodeQualifierTokens(q, controlMap, suffixTokens);
    }
  }

  if (enterTokens.length > 0) result = enterTokens.join(' ') + ' ' + result;
  if (suffixTokens.length > 0) result = result + ' ' + suffixTokens.join(' ');
  if (exitTokens.length > 0) result = result + ' ' + exitTokens.join(' ');
  return result;
}

// Encode a single qualifier into tokens (engine native or runtime _script)
// Note: tempoOp (/N, \N) is handled as PREFIX in encodeRhsElement, not here
// Note: dual-context controls (in both engine and runtime) always route to _script in ().
function encodeQualifierTokens(q, controlMap, tokens) {
  const isRuntime = q.type === 'RuntimeQualifier';
  const runtimeAssignments = {};
  for (const p of (q.pairs || [])) {
    if (isRuntime) {
      // () context: dual-context controls route to _script; pure engine controls preserve native.
      if (controlMap[p.key] && _bp3Native.has(p.key) && !_dualCtx.has(p.key)) {
        // Pure engine control in () — preserve backward-compat BP3 native emit.
        tokens.push(formatNativeValue(controlMap[p.key], p.value));
      } else {
        runtimeAssignments[p.key] = p.value;
      }
    } else if (controlMap[p.key]) {
      if (_bp3Native.has(p.key)) {
        tokens.push(formatNativeValue(controlMap[p.key], p.value));
      } else {
        runtimeAssignments[p.key] = p.value;
      }
    }
  }
  if (Object.keys(runtimeAssignments).length > 0) {
    const ctName = `CT ${_ctIndex++}`;
    _output.controlTable.push({ id: ctName, assignments: runtimeAssignments });
    tokens.push(`_script(${ctName})`);
  }
}

function encodeRhsElementInner(el, alphabet, controlMap, groupSeqPrefixTokens) {
  switch (el.type) {
    case 'Symbol':
      // Forme ancienne (identifiant): star/plus/fin → opérateur BP3 (rétro-compat)
      if (el.name in BP3_OPERATORS) return BP3_OPERATORS[el.name];
      // Forme canonique (après normalisation parser): '*'/'+'/';' émis tel quel,
      // PAS ajoutés à l'alphabet (ce sont des opérateurs, pas des bols).
      if (BP3_OPERATOR_VALUES.has(el.name)) return el.name;
      // Time pattern names (t1, t2, …) are duration symbols, recognised by BP3
      // via the TIMEPATTERNS: section — NOT via the sound alphabet.  Emit the
      // name literally but do NOT add it to the alphabet.
      if (_timePatternNames.has(el.name)) return el.name;
      // Homomorphism invocation names (e.g. 'tabla_stroke', 'mineur', 'm1') are
      // transformation labels that appear between $X and &X in the grammar.
      // They are NOT sound terminals — BP3 recognises them as homo names via the
      // alphabet file -ho. sections. Emit verbatim, do NOT add to the alphabet.
      if (_homoNames.has(el.name)) return el.name;
      // BP3: every RHS token that is never rewritten (no LHS rule) is a bol of
      // the alphabet (CompileGrammar.c, Encode/AddBolsInGrammar). A bare
      // terminal must therefore be seeded into the output alphabet, exactly
      // like the SymbolCall case below — otherwise libs are the only source of
      // terminals and grammars whose terminals come purely from the RHS
      // produce an empty alphabet (alphabetSize=0 → nothing to produce).
      if (!_nonTerminals.has(el.name)) {
        if (!BP3_RESERVED.has(el.name)) alphabet.add(el.name);
        _usedTerminals.add(el.name);
        return el.name;
      }
      // Non-terminal reference: wrap if lowercase (BP3 GetVar rule).
      return encodeNonTerminalName(el.name);

    case 'SymbolCall': {
      // Sa(vel:120), Hit(vel:80) → emit `_script(CT n) Sym _script(CT n_e)`
      // around the bare symbol. The dispatcher consumes the start/end pair as
      // a contextual scope, and the bare Sym either matches a rule (Hit -> -)
      // or stays as a terminal in the alphabet (C4). The legacy `Sym#key#val`
      // encoding is rejected by BP3's grammar tokenizer (which splits on `#`
      // and refuses non-uppercase fragments like `vel#80`).
      const assignments = {};
      for (const arg of el.args) {
        if (!arg.key) continue;
        const v = arg.value;
        if (v.type === 'Literal') assignments[arg.key] = v.value;
      }
      const tokens = [];
      let ctName = null;
      let ctEndName = null;
      if (Object.keys(assignments).length > 0) {
        ctName = `CT ${_ctIndex++}`;
        ctEndName = `${ctName}_e`;
        _output.controlTable.push({ id: ctName, assignments, scope: 'start' });
        _output.controlTable.push({ id: ctEndName, assignments: {}, scope: 'end' });
        tokens.push(`_script(${ctName})`);
      }
      // Non-terminal: rewrite rule applies (wrap if lowercase, BP3 GetVar
      // rule). Terminal: must exist in alphabet, left bare.
      // Homo names: emit verbatim without alphabet seeding (same as Symbol case).
      if (!_nonTerminals.has(el.name)) {
        if (!BP3_RESERVED.has(el.name) && !_homoNames.has(el.name)) alphabet.add(el.name);
        _usedTerminals.add(el.name);
        tokens.push(el.name);
      } else {
        tokens.push(encodeNonTerminalName(el.name));
      }
      if (ctEndName) tokens.push(`_script(${ctEndName})`);
      return tokens.join(' ');
    }

    case 'Rest':
      return '-';

    case 'Prolongation':
      return '_';

    case 'UndeterminedRest':
      return '_rest';

    case 'Period':
      return '.';

    case 'NumericDuration':
      return el.denominator === 1 ? `${el.numerator}` : `${el.numerator}/${el.denominator}`;

    case 'NilString':
      return 'lambda';

    case 'Control': {
      if (_bp3Native.has(el.name)) {
        // Engine control → BP3 native format
        const bp3Name = controlMap[el.name] || `_${el.name}`;
        if (el.args.length === 0) return bp3Name;
        const argStr = el.args.join(',');
        return `${bp3Name}(${argStr})`;
      }
      // Runtime control → _script(CTn)
      const assignments = {};
      if (el.args.length === 0) {
        assignments[el.name] = true;
      } else {
        assignments[el.name] = el.args.join(',');
      }
      const ctName = `CT ${_ctIndex++}`;
      _output.controlTable.push({ id: ctName, assignments });
      return `_script(${ctName})`;
    }

    case 'SimultaneousGroup': {
      // Sa!dha → Sa <<dha>> (! is exclusively temporal now)
      const parts = [encodeRhsElement(el.primary, alphabet, controlMap)];
      for (const sec of el.secondaries) {
        if (sec.type === 'Symbol') {
          parts.push(`<<${sec.name}>>`);
        } else if (sec.type === 'SymbolCall') {
          parts.push(`<<${encodeRhsElement(sec, alphabet, controlMap)}>>`);
        }
      }
      return parts.join(' ');
    }

    case 'TriggerIn':
      // <!sync1 → <<Wn>> (need sync tag mapping)
      return `<<W${el.name}>>`;

    case 'Polymetric': {
      const voiceStrs = el.voices.map(v => {
        return v.map(e => encodeRhsElement(e, alphabet, controlMap)).join(' ');
      });
      // Cadre polymétrique (1er champ `{M, …}`) : ratio porté par le qualifier `speed` de
      // `Polymetric.qualifiers` (contrat AST_SPEC:1024,1037). La durée de surface `:M` désucre
      // vers CE qualifier (cf. parseColonFrame) — un seul chemin, lu identiquement par BP3 et BPx.
      const speed = getQualValue(el.qualifiers, 'speed');
      let inner = voiceStrs.join(',');
      if (speed !== null) {
        inner = `${speed},${inner}`;  // no space after ratio comma (BP3 convention)
      }
      // seq_prefix qualifiers (retro, shuffle, order, rotate) — injected as prefix
      // INSIDE the group: {_rndseq a b c d} instead of {a b c d} _rndseq.
      // groupSeqPrefixTokens is passed from encodeRhsElement after extraction from suffixQualifiers.
      if (groupSeqPrefixTokens) {
        inner = `${groupSeqPrefixTokens} ${inner}`;
      }
      let result = `{${inner}}`;
      // Check for scale qualifier → BP3 native `*N` / `**N` prefix.
      //
      // Ports BP3 textual scaling markers from Encode.c:102-117
      // (`*` → T0/21 scale up, `**` → T0/24 scale down) and the consumer
      // in Polymetric.c:229-244, 293-302 (`case 21 / case 24` update the
      // `scaling` variable, distinct from `speed`/`_tempo`).
      //
      // BP3 convention (LANGUAGE.md:1235) places the marker BEFORE the
      // group: `A[*3]` → `*3 A`, so `{C4,D4}[scale:2]` → `*2 {C4,D4}`.
      // For N >= 1 we emit `*N` (scale up). For 0 < N < 1 we emit `**M`
      // with M = 1/N (scale down, BP3 reciprocal form).
      //
      // Scale is semantically distinct from `[*N]` TempoOp (which the
      // encoder translates to `_tempo(...)` enter/exit) — scale touches
      // `scaling` directly in BP3, not the tempo ratio.
      const scaleRaw = getQualValue(el.qualifiers, 'scale');
      if (scaleRaw !== null) {
        const sn = Number(scaleRaw);
        if (Number.isFinite(sn) && sn > 0) {
          if (sn >= 1) {
            result = `*${sn} ${result}`;
          } else {
            // 0 < N < 1 → reciprocal form `**M` with M = 1/N (BP3 scale down)
            const inv = 1 / sn;
            result = `**${inv} ${result}`;
          }
        }
      }
      // NOTE: embedding case ({ in one rule, }[scale:N] in another) is not
      // handled here — see annotateUnbalancedBraces / polySpeed for the
      // speed analogue. Add a polyScale annotation if needed in the future.
      // Check for tempo operator on group:
      // '/' → bare prefix /N {…} (absolute, persistent)
      // '*' → _tempo(1/N) {…} _tempo(1/1) bracket (relative, scoped)
      const tempoOp = getTempoOp(el.qualifiers);
      if (tempoOp) {
        if (tempoOp.operator === '/') {
          result = `${tempoOpToBarePrefix(tempoOp)} ${result}`;
        } else {
          const pair = tempoOpToPair(tempoOp);
          result = `${pair.enter} ${result} ${pair.exit}`;
        }
      }
      // Runtime qualifier on group: {A B}(vel:100) → _script(CTn) {A B} _script(CTn_e)
      // Note: dual-context controls (in both engine and runtime) always route to _script in ().
      if (el.runtimeQualifier) {
        const gNative = [];
        const gRuntime = {};
        for (const p of el.runtimeQualifier.pairs) {
          if (controlMap[p.key] && _bp3Native.has(p.key) && !_dualCtx.has(p.key)) {
            // Pure engine control used in () — preserve backward-compat BP3 native emit.
            gNative.push(formatNativeValue(controlMap[p.key], p.value));
          } else {
            gRuntime[p.key] = p.value;
          }
        }
        const grpPrefix = [...gNative];
        let grpSuffix = null;
        if (Object.keys(gRuntime).length > 0) {
          const ctName = `CT ${_ctIndex++}`;
          const ctEndName = `${ctName}_e`;
          _output.controlTable.push({ id: ctName, assignments: gRuntime, scope: 'start' });
          _output.controlTable.push({ id: ctEndName, assignments: {}, scope: 'end' });
          grpPrefix.push(`_script(${ctName})`);
          grpSuffix = `_script(${ctEndName})`;
        }
        if (grpPrefix.length > 0) {
          result = grpPrefix.join(' ') + ' ' + result;
        }
        if (grpSuffix) {
          result = result + ' ' + grpSuffix;
        }
      }
      return result;
    }

    case 'Variable':
      return `|${el.name}|`;

    case 'Wildcard':
      return el.index != null ? `?${el.index}` : '?';

    case 'TemplateAnchor':
      // Ancre de gabarit maître « $ nu » → token BP3 « (= » (sans fermeture)
      // Encode.c:1341-1364 : T2,0 — token littéral, ré-émis tel quel au RHS.
      return '(=';

    case 'TemplateMaster': {
      const args = el.args ? `(${el.args.map(a => a.key ? `${a.key}:${a.value.value}` : a.value.value).join(',')})` : '';
      return `(=${el.name}${args})`;
    }

    case 'TemplateSlave': {
      const args = el.args ? `(${el.args.map(a => a.key ? `${a.key}:${a.value.value}` : a.value.value).join(',')})` : '';
      return `(:${el.name}${args})`;
    }

    case 'TemplateMasterGroup': {
      const inner = el.elements.map(e => encodeRhsElement(e, alphabet, controlMap)).join(' ');
      return `(=${inner})`;
    }

    case 'TemplateSlaveGroup': {
      const inner = el.elements.map(e => encodeRhsElement(e, alphabet, controlMap)).join(' ');
      return `(:${inner})`;
    }

    case 'TieStart':
      return `${el.symbol}&`;

    case 'TieContinue':
      return `&${el.symbol}&`;

    case 'TieEnd':
      return `&${el.symbol}`;

    case 'Context':
      return encodeContext(el);

    case 'RawBrace':
      // Embedding: { with polySpeed from matched }[speed:N] → {N,
      if (el.value === '{' && el.polySpeed) return `{${el.polySpeed},`;
      return el.value;

    case 'OutTimeObject':
      return `<<${el.name}>>`;

    case 'InstantControl': {
      const q = el.qualifier;
      const parts = [];

      // ![@seed:N] → _srand(N) : re-semence dans le flux (décision 2026-06-14).
      if (q.type === 'ProductionInline') {
        for (const d of q.directives) {
          if (d.name === 'seed') parts.push(`_srand(${d.value})`);
        }
      }

      if (q.type === 'Qualifier') {
        // Engine qualifier: ![retro] → _retro, ![rotate:2] → _rotate(2)
        if (q.tempoOp) {
          // Instant control: free-standing tempo change in the flow (no bracket)
          parts.push(tempoOpToBP3Enter(q.tempoOp));
        }
        const runtimeAssignments = {};
        for (const p of q.pairs) {
          if (controlMap[p.key]) {
            if (_bp3Native.has(p.key)) {
              parts.push(formatNativeValue(controlMap[p.key], p.value));
            } else {
              runtimeAssignments[p.key] = p.value;
            }
          }
        }
        if (Object.keys(runtimeAssignments).length > 0) {
          const ctName = `CT ${_ctIndex++}`;
          _output.controlTable.push({ id: ctName, assignments: runtimeAssignments });
          parts.push(`_script(${ctName})`);
        }
      }

      if (q.type === 'RuntimeQualifier') {
        // () context: dual-context controls route to _script; pure engine controls preserve native.
        const runtimeAssignments = {};
        for (const p of q.pairs) {
          if (controlMap[p.key] && _bp3Native.has(p.key) && !_dualCtx.has(p.key)) {
            // Pure engine control — preserve backward-compat BP3 native emit.
            parts.push(formatNativeValue(controlMap[p.key], p.value));
          } else {
            runtimeAssignments[p.key] = p.value;
          }
        }
        if (Object.keys(runtimeAssignments).length > 0) {
          const ctName = `CT ${_ctIndex++}`;
          _output.controlTable.push({ id: ctName, assignments: runtimeAssignments });
          parts.push(`_script(${ctName})`);
        }
      }

      return parts.join(' ');
    }

    case 'BacktickStandalone':
    case 'BacktickInline': {
      // Backticks → encoded as terminal for BP3 (dispatcher handles at runtime)
      // No _ prefix — BP3 treats _ as control prefix
      const btName = `BT${el.tag || 'auto'}${alphabet.size}`;
      alphabet.add(btName);
      // Table des backticks (prérequis lot 4 Kanopi) : le token BT<interp><id> est une
      // RÉFÉRENCE ; le code encapsulé doit être récupérable pour router vers l'interpréteur (eval).
      el._btName = btName;   // annoté pour la post-passe d'attache backtick↔acteur (D1)
      if (_output) _output.backticks[btName] = { interp: el.tag || 'auto', code: el.code };
      return btName;
    }

    case 'SymbolWithTriggerIn': {
      const sym = encodeRhsElement(el.symbol, alphabet, controlMap);
      const triggers = el.triggers.map(t => `<<W${t.name}>>`).join(' ');
      return `${sym} ${triggers}`;
    }

    default:
      return `/* unknown: ${el.type} */`;
  }
}

// --- Unbalanced brace annotation (2-pass for embedding patterns) ---

function annotateUnbalancedBraces(rules) {
  // Collect all RawBrace elements across rules in order
  const openStack = [];  // stack of { RawBrace elements

  for (const rule of rules) {
    for (const el of rule.rhs) {
      if (el.type === 'RawBrace' && el.value === '{') {
        openStack.push(el);
      } else if (el.type === 'RawBrace' && el.value === '}') {
        // Cadre porté par cette `}` : qualifier `speed` de `Polymetric.qualifiers` (contrat AST) —
        // la durée `}:N` désucre vers ce qualifier. Propagé au `{` correspondant par cette 2e passe.
        if (el.tempoOp || el.qualifiers) {
          const speed = el.tempoOp ? null : getQualValueFromElement(el, 'speed');
          if (speed !== null && openStack.length > 0) {
            // Annotate the matching { with this frame ratio
            const matchingOpen = openStack.pop();
            matchingOpen.polySpeed = speed;
          } else {
            if (openStack.length > 0) openStack.pop();
          }
        } else {
          if (openStack.length > 0) openStack.pop();
        }
      }
    }
  }
}

// Format a native engine control value for BP3: spaces → commas, _→space
function formatNativeValue(bp3Name, value) {
  if (value === true) return bp3Name;
  const str = String(value).replace(/\s+/g, ',');
  return `${bp3Name}(${str})`;
}

/**
 * Format a seq_prefix control as one or more BP3 tokens.
 * Special case: shuffle with seed → "_srand(N) _rndseq"
 * Other seq_prefix with value → "_name(value)"
 * seq_prefix without value (true) → "_name"
 */
function formatSeqPrefixTokens(key, value, controlMap) {
  const bp3Name = controlMap[key] || `_${key}`;
  if (key === 'shuffle') {
    // shuffle without seed (value === true): just _rndseq
    if (value === true || value === null || value === undefined) {
      return bp3Name;  // _rndseq
    }
    // shuffle with seed: _srand(N) _rndseq
    return `_srand(${value}) ${bp3Name}`;
  }
  // Other seq_prefix controls
  return formatNativeValue(bp3Name, value);
}

// Encode template body: ? → _, ($N ...) → (@N ...)
function encodeTemplateBody(elements) {
  return elements.map(el => {
    switch (el.type) {
      case 'TemplateWildcard':
        return '_'.repeat(el.count);
      case 'TemplatePeriod':
        return '.';
      case 'TemplateBracket': {
        const inner = el.body.length > 0 ? encodeTemplateBody(el.body) : '';
        return `(@${el.index} ${inner})`;
      }
      default:
        return '';
    }
  }).join('');
}

function getQualValueFromElement(el, key) {
  if (!el.qualifiers) return null;
  for (const q of el.qualifiers) {
    for (const p of q.pairs) {
      if (p.key === key) return p.value;
    }
  }
  return null;
}

// --- Qualifier helpers ---

function getQualValue(qualifiers, key) {
  for (const q of qualifiers) {
    for (const p of q.pairs) {
      if (p.key === key) return p.value;
    }
  }
  return null;
}

function getQualDecrement(qualifiers, key) {
  for (const q of qualifiers) {
    for (const p of q.pairs) {
      if (p.key === key) return p.decrement;
    }
  }
  return null;
}

// Convert a BPscript TempoOp (operator '*' or '\') to a _tempo(x/y) pair [enter, exit].
// Used ONLY for the '*N' (slow down) and '\N' operators — NOT for '/' (see tempoOpToBarePrefix).
//
// Exit is always _tempo(1/1) to restore the inherited tempo at the bracket boundary,
// matching BP3 semantics (the fixtempo flag is cleared when the bracket closes).
// Previous exit = _tempo(num/den) was incorrect: it would set an absolute speed rather
// than restoring to the parent's inherited tempo.
//
// BPscript * = slow down (multiply duration): [*2] → _tempo(1/2) ... _tempo(1/1)
// Values: integer (2), fraction (3/2), decimal (1.5)
// _tempo accepts decimals natively
function tempoOpToPair(op) {
  const v = op.value;
  let num, den;
  if (typeof v === 'string' && v.includes('/')) {
    const parts = v.split('/');
    num = Number(parts[0]);
    den = Number(parts[1]);
  } else {
    num = Number(v);
    den = 1;
  }
  // BP3 _tempo requires integer fractions — rationalize any floats
  const r = _toIntFraction(num, den);
  num = r[0]; den = r[1];
  // Exit is always _tempo(1/1) — restores inherited tempo (NOT the reciprocal).
  if (op.operator === '/') {
    return { enter: `_tempo(${num}/${den})`, exit: `_tempo(1/1)` };
  } else {
    // '*' (slow down) → enter = 1/N
    return { enter: `_tempo(${den}/${num})`, exit: `_tempo(1/1)` };
  }
}

// Convert a BPscript TempoOp with operator '/' to its bare BP3 inline token.
// '/' = tempo ABSOLU + persistant + durée de référence du champ (BP3 Encode.c:418-425).
// Syntax: A[/2] → /2 A  (opérateur NU devant l'élément, PAS de bracket _tempo).
// This is distinct from _tempo(x/y) (relatif) used for InstantControl '![/N]'.
function tempoOpToBarePrefix(op) {
  // op.value is already the textual ratio ("1/2") or integer (2)
  return `${op.operator}${op.value}`;
}

// Convert possibly-float num/den to [intNum, intDen]
function _toIntFraction(num, den) {
  if (Number.isInteger(num) && Number.isInteger(den)) return [num, den];
  let scale = 1;
  while (scale < 1e6 && (!Number.isInteger(Math.round(num * scale * 1e9) / 1e9) || !Number.isInteger(Math.round(den * scale * 1e9) / 1e9))) {
    scale *= 10;
  }
  let n = Math.round(num * scale);
  let d = Math.round(den * scale);
  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
  const g = gcd(Math.abs(n), Math.abs(d));
  return [n / g, d / g];
}

// Legacy: for backward compat, still used for rule-level prefix (no reset needed)
function tempoOpToBP3Enter(op) {
  return tempoOpToPair(op).enter;
}

// Serialise a rule-head tempo/scale operator to its bare inline BP3 token.
//
// BP3 reads these directly in Encode.c: `*` is the scale-up marker
// (Encode.c:102, followed by the ratio, e.g. `*1/2`, `*3`); `/` followed by a
// digit is the tempo/speed marker (Encode.c:418-425, e.g. `/2`, `/3/2`). The
// value field is already the textual ratio (`"1/2"`) or an integer (`2`), so
// we emit `operator + value` verbatim — matching the native -gr.checktemplates
// grammar (`A A *1/2 A`, `A A /2 A`). This is distinct from tempoOpToPair,
// which wraps an element in a `_tempo(x/y)` enter/exit pair for [tempo:N].
function tempoOpToInline(op) {
  return `${op.operator}${op.value}`;
}

function getTempoOp(qualifiers) {
  for (const q of qualifiers) {
    if (q.tempoOp) return q.tempoOp;
  }
  return null;
}

export { encode, MODE_MAP, ARROW_MAP };
