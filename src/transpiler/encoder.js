/**
 * BPScript Encoder
 * Source: BPSCRIPT_EBNF.md — Table de traduction BPscript → BP3
 *
 * Walks the AST and produces BP3 grammar text + alphabet + settings.
 * Controls loaded from lib/controls.json — single source of truth.
 */

import { loadLibsFromDirectives } from './libs.js';

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

function encode(ast) {
  const output = { grammar: '', alphabet: new Set(), settings: [] };
  const lines = [];

  // Load control map from libs based on @ directives
  const libCtx = loadLibsFromDirectives(ast.directives);
  const CONTROL_MAP = libCtx.controlMap;

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

  // Global preamble from directives
  // BP3 only accepts certain items as preamble (between mode line and rules):
  // _mm(), _striated, _smooth — everything else must be inline in RHS
  const PREAMBLE_OK = new Set(['mm', 'striated', 'smooth']);

  const preamble = [];    // Valid BP3 preamble items
  const rhsPrefix = [];   // Controls injected at start of first rule's RHS

  for (const dir of ast.directives) {
    if (dir.name === 'mm' && dir.value != null) {
      preamble.push(`_mm(${dir.value})`);
    } else if (dir.name === 'striated') {
      preamble.push('_striated');
    } else if (dir.name === 'smooth') {
      preamble.push('_smooth');
    } else if (dir.name === 'tempo' && dir.value) {
      // @tempo → goes to settings file, not grammar
    } else if (['vel', 'chan', 'ins', 'transpose'].includes(dir.name) && dir.value != null) {
      // These controls are NOT valid BP3 preamble — inject as RHS prefix
      const bp3Name = CONTROL_MAP[dir.name] || `_${dir.name}`;
      rhsPrefix.push(`${bp3Name}(${dir.value})`);
    }
  }

  // --- Subgrammars ---

  for (let si = 0; si < ast.subgrammars.length; si++) {
    const sub = ast.subgrammars[si];
    const blockNum = sub.index;

    // Determine mode from qualifiers of first rule (or default ORD)
    let mode = 'RND';
    if (sub.rules.length > 0 && sub.rules[0].qualifiers.length > 0) {
      for (const q of sub.rules[0].qualifiers) {
        for (const p of q.pairs) {
          if (p.key === 'mode' && MODE_MAP[p.value]) {
            mode = MODE_MAP[p.value];
          }
        }
      }
    }

    // Mode line
    lines.push(mode);

    // Preamble: global (first subgrammar) + per-subgrammar qualifiers
    const subPreamble = si === 0 ? [...preamble] : [];

    // Collect preamble qualifiers from first rule: destru, striated, smooth
    const PREAMBLE_QUALS = ['destru', 'striated', 'smooth'];
    if (sub.rules.length > 0) {
      for (const q of sub.rules[0].qualifiers) {
        for (const p of q.pairs) {
          if (PREAMBLE_QUALS.includes(p.key) && p.value === true) {
            subPreamble.push(`_${p.key}`);
          }
        }
      }
    }

    if (subPreamble.length > 0) {
      lines.push(subPreamble.join(' '));
    }

    // Rules
    for (let ri = 0; ri < sub.rules.length; ri++) {
      const rule = sub.rules[ri];
      const ruleNum = ri + 1;
      let parts = [];

      parts.push(`gram#${blockNum}[${ruleNum}]`);

      // Weight
      const weight = getQualValue(rule.qualifiers, 'weight');
      if (weight !== null) {
        const decrement = getQualDecrement(rule.qualifiers, 'weight');
        if (decrement !== null) {
          parts.push(`<${weight}-${decrement}>`);
        } else {
          parts.push(`<${weight}>`);
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

      // RHS — inject global controls as prefix of first rule in first subgrammar
      let rhsStr = encodeRhs(rule.rhs, output.alphabet, CONTROL_MAP);
      if (si === 0 && ri === 0 && rhsPrefix.length > 0) {
        rhsStr = rhsPrefix.join(' ') + (rhsStr ? ' ' + rhsStr : '');
      }
      parts.push(rhsStr);

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

  output.grammar = lines.join('\n');

  // Generate alphabet file content from loaded libraries
  output.alphabetFile = generateAlphabetFile(libCtx, ast.directives);

  // Generate settings JSON for BP3 WASM engine
  output.settingsJSON = generateSettingsJSON(libCtx, ast.directives);

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

  // Apply overrides from @ directives
  for (const dir of directives) {
    // NoteConvention from alphabet library
    if (settingsLib.note_conventions?.[dir.name] != null) {
      settings.NoteConvention.value = String(settingsLib.note_conventions[dir.name]);
    }
    // @striated / @smooth
    if (dir.name === 'striated') settings.Nature_of_time.value = '1';
    if (dir.name === 'smooth') settings.Nature_of_time.value = '0';
    // @vel:N
    if (dir.name === 'vel' && dir.value != null) settings.DeftVelocity.value = String(dir.value);
  }

  return JSON.stringify(settings);
}

/**
 * Generate a BP3-compatible alphabet file (-ho format) from library data.
 * Format: OCT header followed by note_oct0 --> note_oct1 --> ... lines
 */
function generateAlphabetFile(libCtx, directives) {
  const lines = ['// Generated by BPScript', 'OCT'];
  let hasNotes = false;

  // Use generator from loaded libraries to produce all octaves
  for (const dir of directives) {
    const lib = libCtx._libs?.[dir.name];
    if (!lib?.generator) continue;
    const gen = lib.generator;
    const notes = gen.notes || [];
    const accidentals = gen.accidentals || [''];
    const octaves = gen.octaves || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    if (gen.semitones) {
      // Western-style: note + accidental + octave (C#4, Db4...)
      for (const note of notes) {
        for (const acc of accidentals) {
          const base = `${note}${acc}`;
          if (!(base in gen.semitones)) continue;
          const row = octaves.map(oct => `${base}${oct}`);
          lines.push(row.join(' --> '));
          hasNotes = true;
        }
      }
    } else {
      // Simple: note + octave (sa6, re6...)
      for (const note of notes) {
        const row = octaves.map(oct => `${note}${oct}`);
        lines.push(row.join(' --> '));
        hasNotes = true;
      }
    }
  }

  // Add custom terminals from declarations (gate a:midi, gate b:midi)
  // These don't have octaves — just declare as single terminals
  // BP3 won't recognize them without a -mi file, but at least the alphabet is complete

  return hasNotes ? lines.join('\n') : null;
}

// --- Guard encoding ---

function encodeGuard(guard) {
  if (guard.mutates) {
    // when Ideas-1 → /Ideas-1/
    return `/${guard.flag}${guard.operator}${guard.value}/`;
  }
  // when phase==1 → /phase=1/ (BP3 uses = for both test and assign based on position)
  const op = guard.operator === '==' ? '=' :
             guard.operator === '!=' ? '≠' :
             guard.operator === '>=' ? '≥' :
             guard.operator === '<=' ? '≤' :
             guard.operator;
  return `/${guard.flag}${op}${guard.value}/`;
}

// --- Context encoding ---

function encodeContext(ctx) {
  const prefix = ctx.positive ? '' : '#';
  if (ctx.symbols.length === 1) {
    return `${prefix}${ctx.symbols[0]}`;
  }
  return `${prefix}(${ctx.symbols.join(' ')})`;
}

// --- LHS encoding ---

function encodeLhs(elements) {
  return elements.map(el => {
    if (el.type === 'Symbol') return el.name;
    if (el.type === 'Variable') return `|${el.name}|`;
    if (el.type === 'Wildcard') return el.index != null ? `?${el.index}` : '?';
    if (el.type === 'Context') return encodeContext(el);
    return el.name || '?';
  }).join(' ');
}

// --- RHS encoding ---

function encodeRhs(elements, alphabet, controlMap) {
  return elements.map(el => encodeRhsElement(el, alphabet, controlMap)).join(' ');
}

function encodeRhsElement(el, alphabet, controlMap) {
  const raw = encodeRhsElementInner(el, alphabet, controlMap);
  // Apply tempo operator prefix if present: A[/2] → /2 A
  if (el.tempoOp) {
    return `${el.tempoOp.operator}${el.tempoOp.value} ${raw}`;
  }
  return raw;
}

function encodeRhsElementInner(el, alphabet, controlMap) {
  switch (el.type) {
    case 'Symbol':
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
      return '...';

    case 'Period':
      return '.';

    case 'NumericDuration':
      return el.denominator === 1 ? `${el.numerator}` : `${el.numerator}/${el.denominator}`;

    case 'NilString':
      return 'lambda';

    case 'Control': {
      const bp3Name = controlMap[el.name] || `_${el.name}`;
      if (el.args.length === 0) return bp3Name;
      // For _scale, replace underscores with spaces in name args (just_intonation → just intonation)
      const encodedArgs = el.args.map(a => typeof a === 'string' ? a.replace(/_/g, ' ') : a);
      return `${bp3Name}(${encodedArgs.join(',')})`;
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
      const voiceStrs = el.voices.map(v => v.map(e => encodeRhsElement(e, alphabet, controlMap)).join(' '));
      // Check for speed qualifier → ratio prefix (polymetric ratio)
      const speed = getQualValue(el.qualifiers, 'speed');
      let inner = voiceStrs.join(', ');
      if (speed !== null) {
        inner = `${speed},${inner}`;  // no space after ratio comma (BP3 convention)
      }
      let result = `{${inner}}`;
      // Check for tempo operator → prefix before braces
      const tempoOp = getTempoOp(el.qualifiers);
      if (tempoOp) {
        result = `${tempoOp} ${result}`;
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
      return el.value;  // { or } as-is for BP3 embedding patterns

    case 'BacktickStandalone':
    case 'BacktickInline':
      // Backticks → encoded as terminal for BP3 (dispatcher handles at runtime)
      return `_backtick_${el.tag || 'auto'}_${alphabet.size}`;

    case 'SymbolWithTriggerIn': {
      const sym = encodeRhsElement(el.symbol, alphabet, controlMap);
      const triggers = el.triggers.map(t => `<<W${t.name}>>`).join(' ');
      return `${sym} ${triggers}`;
    }

    default:
      return `/* unknown: ${el.type} */`;
  }
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
