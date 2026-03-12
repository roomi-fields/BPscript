// BPscript compiler — AST → BP3 grammar text + alphabet + settings

import { CompileError } from './errors.js';

// Map BPscript option names to BP3 mode keywords
const MODE_MAP = {
  'ordered':  'ORD',
  'ord':      'ORD',
  'random':   'RND',
  'rnd':      'RND',
  'sub':      'SUB1',
  'sub1':     'SUB1',
  'subst':    'SUB1',
  'lin':      'LIN',
  'linear':   'LIN',
  'mix':      'MIX',
};

export function compile(ast) {
  const errors = [];
  const warnings = [];
  const directives = [];
  const rules = [];
  const definitions = [];
  const comments = [];

  // Classify AST nodes
  for (const node of ast.body) {
    switch (node.type) {
      case 'Directive':  directives.push(node); break;
      case 'Rule':       rules.push(node); break;
      case 'Definition': definitions.push(node); break;
      case 'Comment':    comments.push(node); break;
    }
  }

  // Build settings from directives
  const settings = buildSettings(directives);

  // Compile rules into grammar blocks
  const grammar = compileRules(rules, errors, warnings);

  // Definitions are post-MVP — emit warnings
  for (const def of definitions) {
    warnings.push({
      message: `Definition '${def.name}' ignored (not yet supported)`,
      line: def.line, col: def.col
    });
  }

  return { grammar, alphabet: '', settings, errors, warnings };
}

function buildSettings(directives) {
  const settings = {};
  for (const d of directives) {
    switch (d.name) {
      case 'core':
        // Core library — no special settings needed
        break;
      case 'western':
        settings.noteConvention = 'English';
        break;
      case 'raga':
      case 'indian':
        settings.noteConvention = 'Indian';
        break;
      default:
        // Unknown library — ignore for MVP
        break;
    }
  }
  return settings;
}

function compileRules(rules, errors, warnings) {
  if (rules.length === 0) return '';

  // Group rules into blocks by mode
  const blocks = groupIntoBlocks(rules);

  // Generate BP3 grammar text
  const parts = [];
  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    const blockNum = b + 1;

    // Mode keyword
    parts.push(block.mode);

    // Rules
    for (let r = 0; r < block.rules.length; r++) {
      const rule = block.rules[r];
      const ruleNum = r + 1;

      // Compile RHS to BP3 text
      const rhsText = compileExpr(rule.rhs);

      // Direction: LEFT or RIGHT goes between gram# and LHS
      let modePrefix = '';
      if (rule.arrow === '<-') modePrefix = 'LEFT ';
      else if (rule.arrow === '<>') modePrefix = 'RIGHT ';

      parts.push(`gram#${blockNum}[${ruleNum}] ${modePrefix}${rule.lhs} --> ${rhsText}`);
    }

    // Block separator (except after last block)
    if (b < blocks.length - 1) {
      parts.push('-----');
    }
  }

  return parts.join('\n');
}

function groupIntoBlocks(rules) {
  const blocks = [];
  let currentBlock = null;

  for (const rule of rules) {
    const mode = resolveMode(rule.options);

    if (!currentBlock || currentBlock.mode !== mode) {
      // Start new block
      currentBlock = { mode, rules: [] };
      blocks.push(currentBlock);
    }

    currentBlock.rules.push(rule);
  }

  return blocks;
}

function resolveMode(options) {
  if (!options || options.values.length === 0) return 'ORD';

  for (const opt of options.values) {
    const mapped = MODE_MAP[opt.toLowerCase()];
    if (mapped) return mapped;
  }

  // Unknown option — default to ORD, could warn
  return 'ORD';
}

function compileExpr(atoms) {
  return atoms.map(compileAtom).join(' ');
}

function compileAtom(node) {
  switch (node.type) {
    case 'Symbol':
      return compileSymbol(node.value);

    case 'Call':
      return compileCall(node);

    case 'Polymetry':
      return compilePolymetry(node);

    default:
      return node.value || '';
  }
}

function compileSymbol(value) {
  // Silence: _ → -
  if (value === '_') return '-';
  return value;
}

function compileCall(node) {
  // For MVP, emit as BP3-style: name(args)
  // BP3 performance controls like _tempo(2) pass through
  const args = node.args.map(compileAtom);
  const paramParts = Object.entries(node.params).map(
    ([k, v]) => `${k}:${compileAtom(v)}`
  );
  const allArgs = [...args, ...paramParts];

  if (allArgs.length === 0) {
    return `${compileSymbol(node.name)}()`;
  }
  return `${compileSymbol(node.name)}(${allArgs.join(',')})`;
}

function compilePolymetry(node) {
  const voices = node.voices.map(voice =>
    voice.map(compileAtom).join(' ')
  );
  return '{' + voices.join(', ') + '}';
}
