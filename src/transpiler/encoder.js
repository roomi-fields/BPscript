/**
 * BPScript Encoder
 * Source: BPSCRIPT_EBNF.md — Table de traduction BPscript → BP3
 *
 * Walks the AST and produces BP3 grammar text + alphabet + settings.
 * Controls loaded from lib/controls.json — single source of truth.
 */

import { loadLibsFromDirectives, loadLib } from './libs.js';

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

function encode(ast) {
  const output = { grammar: '', alphabet: new Set(), settings: [], controlTable: [], cvTable: [] };
  _output = output;
  _ctIndex = 0;
  _cvIndex = 0;
  _cvNames = {};
  _usedTerminals = new Set();
  const lines = [];

  // Load control map from libs based on @ directives
  const libCtx = loadLibsFromDirectives(ast.directives);
  const CONTROL_MAP = libCtx.controlMap;
  _bp3Native = libCtx.bp3NativeControls;

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
        target: cv.target,
        transport: cv.transport,
        lib: cv.lib,
        objectType: cv.objectType,
        args: resolvedArgs,
        code: cv.code || null,
      });

      // Add CV name to alphabet so BP3 treats it as a terminal with duration
      output.alphabet.add(cv.name);
    }
  }

  // Build alphabet from DECLARATIONS (gate/trigger/cv) and loaded alphabets — never inferred
  // BP3 reserved words must never appear in the alphabet (Error code 54)
  const BP3_RESERVED = new Set(['lambda', 'nil', 'empty', 'null']);
  // 1. Explicit declarations: gate a:midi, trigger x:sc, cv lfo:webaudio
  if (ast.declarations) {
    for (const decl of ast.declarations) {
      if (!BP3_RESERVED.has(decl.name)) output.alphabet.add(decl.name);
    }
  }
  // 2. Loaded alphabet libraries: @alphabet.western:midi → symbols from lib
  for (const [name, def] of Object.entries(libCtx.symbols)) {
    if (!BP3_RESERVED.has(name)) output.alphabet.add(name);
  }
  // 3. Time pattern names from @timepatterns directive
  for (const dir of ast.directives) {
    if (dir.timePatterns) {
      for (const p of dir.timePatterns) output.alphabet.add(p.name);
    }
  }

  // Collect all non-terminals (symbols that appear as LHS of rules)
  // Exception: in SUB/SUB1 mode, LHS symbols are also terminals (substitution
  // rules replace patterns, and remaining symbols must be in the alphabet)
  _nonTerminals = new Set();
  for (const sub of ast.subgrammars) {
    const isSub = sub.mode === 'sub' || sub.mode === 'sub1';
    for (const rule of sub.rules) {
      for (const el of rule.lhs) {
        if (el.type === 'Symbol' && !isSub) _nonTerminals.add(el.name);
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

      // Tempo operator on rule [/5]
      const ruleTempoOp = getTempoOp(rule.qualifiers);
      if (ruleTempoOp) rhsPrefixParts.push(ruleTempoOp);

      // Controls as rule qualifiers — always suffix (written after RHS in BPscript)
      const ruleNativeSuffix = [];
      const ruleRuntimeAssignments = {};
      for (const q of rule.qualifiers) {
        for (const p of q.pairs) {
          if (CONTROL_MAP[p.key]) {
            if (_bp3Native.has(p.key)) {
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
      if (rule.runtimeQualifier) {
        const rqNative = [];
        const rqRuntime = {};
        for (const p of rule.runtimeQualifier.pairs) {
          if (CONTROL_MAP[p.key]) {
            if (_bp3Native.has(p.key)) {
              rqNative.push(formatNativeValue(CONTROL_MAP[p.key], p.value));
            } else {
              rqRuntime[p.key] = p.value;
            }
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
            parts.push(`/${f.flag}${f.operator}${f.value}/`);
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
      const patternStrs = dir.timePatterns.map(p => `${p.name} = ${p.ratio}`);
      lines.push(patternStrs.join('  '));
    }
  }

  output.grammar = lines.join('\n');

  // Generate alphabet file content from loaded libraries + custom terminals
  output.alphabetFile = generateAlphabetFile(libCtx, ast.directives, output.alphabet);

  // Generate settings JSON for BP3 WASM engine
  output.settingsJSON = generateSettingsJSON(libCtx, ast.directives);

  // Terminals actually used in the grammar (for prototype generation)
  output.usedTerminals = _usedTerminals;

  return output;
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

  // Collect all sections from all transcriptions
  const allSections = {};  // sectionName → { from: to, ... }
  for (const [, table] of Object.entries(libCtx.transcriptions)) {
    if (table.sections) {
      // Multi-sections: { "*": {...}, "TR": {...} }
      for (const [secName, mappings] of Object.entries(table.sections)) {
        allSections[secName] = { ...(allSections[secName] || {}), ...mappings };
      }
    } else if (table.mappings) {
      // Single section → implicit *
      allSections['*'] = { ...(allSections['*'] || {}), ...table.mappings };
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

function encodeGuard(guard) {
  if (guard.mutates) {
    return `/${guard.flag}${guard.operator}${guard.value}/`;
  }
  // Bare flag test: [Ideas] → /Ideas/
  if (guard.operator === null) {
    return `/${guard.flag}/`;
  }
  const op = guard.operator === '==' ? '=' :
             guard.operator;
  return `/${guard.flag}${op}${guard.value}/`;
}

// --- Context encoding ---

function encodeContext(ctx) {
  const prefix = ctx.positive ? '' : '#';
  if (ctx.symbols.length === 1) {
    const sym = ctx.symbols[0];
    // Force parentheses for non-IDENT symbols: #({) #(}) #(,)
    if (sym === '{' || sym === '}' || sym === ',') {
      return `${prefix}(${sym})`;
    }
    return `${prefix}${sym}`;
  }
  return `${prefix}(${ctx.symbols.join(' ')})`;
}

// --- LHS encoding ---

function encodeLhs(elements) {
  return elements.map(el => {
    if (el.type === 'Symbol') return el.name;
    if (el.type === 'Prolongation') return '_';
    if (el.type === 'Rest') return '-';
    if (el.type === 'Variable') return `|${el.name}|`;
    if (el.type === 'Wildcard') return el.index != null ? `?${el.index}` : '?';
    if (el.type === 'Context') return encodeContext(el);
    if (el.type === 'RawBrace') return el.value;
    return el.name || '?';
  }).join(' ');
}

// --- RHS encoding ---

function encodeRhs(elements, alphabet, controlMap) {
  return elements.map(el => encodeRhsElement(el, alphabet, controlMap)).join(' ');
}

function encodeRhsElement(el, alphabet, controlMap) {
  const raw = encodeRhsElementInner(el, alphabet, controlMap);
  let result = raw;
  // Legacy el.tempoOp from polymetric parser
  if (el.tempoOp) {
    result = `${el.tempoOp.operator}${el.tempoOp.value} ${result}`;
  }

  // SUFFIX qualifiers: A[weight:50], A(vel:80) — always after the element
  // [] and () are ALWAYS suffix in BPscript. Use ![] or !() for free positioning.
  const suffixTokens = [];
  if (el.suffixQualifiers) {
    for (const q of el.suffixQualifiers) {
      encodeQualifierTokens(q, controlMap, suffixTokens);
    }
  }

  if (suffixTokens.length > 0) result = result + ' ' + suffixTokens.join(' ');
  return result;
}

// Encode a single qualifier into tokens (engine native or runtime _script)
function encodeQualifierTokens(q, controlMap, tokens) {
  if (q.tempoOp) {
    tokens.push(`${q.tempoOp.operator}${q.tempoOp.value}`);
  }
  const runtimeAssignments = {};
  for (const p of (q.pairs || [])) {
    if (controlMap[p.key]) {
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

function encodeRhsElementInner(el, alphabet, controlMap) {
  switch (el.type) {
    case 'Symbol':
      // Alphabet is built from declarations and loaded libs — no inference
      if (!_nonTerminals.has(el.name)) _usedTerminals.add(el.name);
      return el.name;

    case 'SymbolCall': {
      // Sa(vel:120) → terminal opaque: Sa_vel~120
      // For now, encode as BP3-compatible terminal
      const paramParts = el.args.map(a => {
        const val = a.value.type === 'Literal' ? a.value.value : `?`;
        return a.key ? `${a.key}~${val}` : val;
      });
      const terminal = [el.name, ...paramParts].join('_');
      alphabet.add(terminal);
      return terminal;
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
      // Check for speed qualifier → ratio prefix (polymetric ratio)
      const speed = getQualValue(el.qualifiers, 'speed');
      let inner = voiceStrs.join(',');
      if (speed !== null) {
        inner = `${speed},${inner}`;  // no space after ratio comma (BP3 convention)
      }
      let result = `{${inner}}`;
      // Check for tempo operator → prefix before braces
      const tempoOp = getTempoOp(el.qualifiers);
      if (tempoOp) {
        result = `${tempoOp} ${result}`;
      }
      // Runtime qualifier on group: {A B}(vel:100) → _script(CTn) {A B} _script(CTn_e)
      if (el.runtimeQualifier) {
        const gNative = [];
        const gRuntime = {};
        for (const p of el.runtimeQualifier.pairs) {
          if (controlMap[p.key]) {
            if (_bp3Native.has(p.key)) {
              gNative.push(formatNativeValue(controlMap[p.key], p.value));
            } else {
              gRuntime[p.key] = p.value;
            }
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

      if (q.type === 'Qualifier') {
        // Engine qualifier: ![retro] → _retro, ![rotate:2] → _rotate(2)
        if (q.tempoOp) {
          parts.push(`${q.tempoOp.operator}${q.tempoOp.value}`);
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
        // Separate engine native from runtime — same as per-element logic
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

      return parts.join(' ');
    }

    case 'BacktickStandalone':
    case 'BacktickInline': {
      // Backticks → encoded as terminal for BP3 (dispatcher handles at runtime)
      // No _ prefix — BP3 treats _ as control prefix
      const btName = `BT${el.tag || 'auto'}${alphabet.size}`;
      alphabet.add(btName);
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
        // Check for [speed:N] qualifier on this }
        if (el.tempoOp || el.qualifiers) {
          const speed = el.tempoOp ? null : getQualValueFromElement(el, 'speed');
          if (speed !== null && openStack.length > 0) {
            // Annotate the matching { with this speed
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

function getTempoOp(qualifiers) {
  for (const q of qualifiers) {
    if (q.tempoOp) return `${q.tempoOp.operator}${q.tempoOp.value}`;
  }
  return null;
}

export { encode, MODE_MAP, ARROW_MAP };
