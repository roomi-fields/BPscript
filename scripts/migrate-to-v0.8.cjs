#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * BPscript v0.7 → v0.8 grammar migration script.
 *
 * Brief: docs/design/v0.8-decisions-final.md, section "Plan de migration".
 *
 * Transformations applied:
 *   T1  alphabet:NAME       → alphabet.NAME        (inside @actor block only)
 *   T2  tuning:NAME         → tuning.NAME          (inside @actor block only)
 *   T3  transport:TYPE(...) → transport.TYPE(...)  (inside @actor block only)
 *   T4  sounds:NAME         → sound.NAME           (inside @actor block only)
 *   T5  @templates          → @template            (top-level directive)
 *
 * Side rules (escalation in dry-run report):
 *   T4b @sounds:NAME (top-level directive) — ambiguous w.r.t. brief PM:
 *       transformation IS applied to `@sound.NAME` per design decision 7
 *       (lib externe en notation pointée), but flagged in the report.
 *
 * Untouched (out of scope):
 *   - Runtime params inside `(...)`     e.g. (vel:80, pan:64)
 *   - Engine instructions inside `[...]` e.g. [mode:tem], [*1/2]
 *   - Comments (line `//` and block style)
 *   - Already-dotted forms: alphabet.X, tuning.X, transport.X, sound.X
 *   - Variant suffix on dotted names: @alphabet.X:variant remains valid
 *   - Numeric/scalar top-level directives: @mm:88, @core, @controls, etc.
 *
 * Usage:
 *   node scripts/migrate-to-v0.8.cjs [--apply | --verify] [--root <dir>]
 *
 * Default mode = dry-run (lists transformations without writing).
 * --apply  : writes the migrated content back to disk.
 * --verify : runs migration in-memory then re-runs it — second pass must
 *            produce zero transformations (idempotence).
 * --root   : override root path (default: <repo>/test/grammars).
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Tokenize a single line into "code" and "comment" parts.
// We do NOT touch the inside of // line-comments. Block /* ... */ comments
// are stripped from code-side processing on a per-line basis (we keep the
// whole line of comment unchanged in the output).
// ---------------------------------------------------------------------------

// Split a line into segments: each segment is either:
//   { kind: 'code',   text }    — eligible for transformation
//   { kind: 'string', text }    — double-quoted string literal (skipped)
//   { kind: 'paren',  text }    — `(...)` runtime params (skipped)
//   { kind: 'bracket',text }    — `[...]` engine instructions (skipped)
//   { kind: 'comment',text }    — `// ...` or block-comment slice (skipped)
//
// `blockCommentDepth` is the depth at line start; the function returns the
// depth at line end so the caller can carry state across lines.
function segmentLine(line, blockCommentDepth) {
  const segs = [];
  let i = 0;
  let depth = blockCommentDepth;
  let codeStart = 0;

  const flushCode = (end) => {
    if (end > codeStart) {
      segs.push({ kind: 'code', text: line.slice(codeStart, end) });
    }
  };

  while (i < line.length) {
    // Inside a block comment: scan until `*/`.
    if (depth > 0) {
      const close = line.indexOf('*/', i);
      if (close === -1) {
        segs.push({ kind: 'comment', text: line.slice(i) });
        i = line.length;
        codeStart = i;
        break;
      } else {
        segs.push({ kind: 'comment', text: line.slice(i, close + 2) });
        depth -= 1;
        i = close + 2;
        codeStart = i;
        continue;
      }
    }

    const ch = line[i];
    const next = line[i + 1];

    // Line comment.
    if (ch === '/' && next === '/') {
      flushCode(i);
      segs.push({ kind: 'comment', text: line.slice(i) });
      i = line.length;
      codeStart = i;
      break;
    }

    // Block comment open.
    if (ch === '/' && next === '*') {
      flushCode(i);
      depth += 1;
      // segment will be emitted in the next loop iteration when we find `*/`.
      // We restart scanning at i; the depth>0 branch above takes over.
      codeStart = i;
      continue;
    }

    // String literal — double quotes only (BPscript uses "..." for samples).
    if (ch === '"') {
      flushCode(i);
      const start = i;
      i += 1;
      while (i < line.length && line[i] !== '"') {
        if (line[i] === '\\' && i + 1 < line.length) i += 2;
        else i += 1;
      }
      if (i < line.length) i += 1; // consume closing quote
      segs.push({ kind: 'string', text: line.slice(start, i) });
      codeStart = i;
      continue;
    }

    // Parenthesised runtime params — capture balanced (...) group.
    if (ch === '(') {
      flushCode(i);
      const start = i;
      let p = 1;
      i += 1;
      while (i < line.length && p > 0) {
        const c = line[i];
        if (c === '"') {
          i += 1;
          while (i < line.length && line[i] !== '"') {
            if (line[i] === '\\' && i + 1 < line.length) i += 2;
            else i += 1;
          }
          if (i < line.length) i += 1;
          continue;
        }
        if (c === '(') p += 1;
        else if (c === ')') p -= 1;
        i += 1;
      }
      segs.push({ kind: 'paren', text: line.slice(start, i) });
      codeStart = i;
      continue;
    }

    // Bracketed engine instructions — capture balanced [...] group.
    if (ch === '[') {
      flushCode(i);
      const start = i;
      let p = 1;
      i += 1;
      while (i < line.length && p > 0) {
        const c = line[i];
        if (c === '[') p += 1;
        else if (c === ']') p -= 1;
        i += 1;
      }
      segs.push({ kind: 'bracket', text: line.slice(start, i) });
      codeStart = i;
      continue;
    }

    i += 1;
  }
  flushCode(line.length);
  return { segs, blockCommentDepth: depth };
}

// ---------------------------------------------------------------------------
// Detect actor-block scope.
//
// In v0.7 the @actor declaration appears on a single line:
//   @actor melody  alphabet:western  transport:midi(ch:1)
//
// Therefore "inside @actor block" effectively means "on the same line as the
// @actor token, to the right of it, until end-of-line". There is no multi-
// line block syntax in the legacy grammars surveyed (0 matches across the
// 55 scene.bps files). The detector below is conservative: it considers a
// line to be `actorScope = true` for ALL its code segments if the code starts
// with `@actor` (whitespace-skipped), and false otherwise.
// ---------------------------------------------------------------------------

function lineStartsWithActor(line) {
  // Look at the first non-whitespace, non-comment token.
  const m = line.match(/^\s*@actor\b/);
  return !!m;
}

// ---------------------------------------------------------------------------
// Apply transformations to a code segment.
// Each call returns { text, hits: { T1, T2, T3, T4, T4b, T5 } }.
// ---------------------------------------------------------------------------

function transformCode(text, { inActor, atLineStart }) {
  const hits = { T1: 0, T2: 0, T3: 0, T4: 0, T4b: 0, T5: 0 };
  let out = text;

  // T5: @templates → @template (top-level only; never inside paren/bracket).
  // Match @templates as a whole token (word boundary), not followed by '.'
  // (to skip an already-pointed form like @templates.foo, defensively).
  out = out.replace(/@templates\b(?!\.)/g, (m, offset) => {
    hits.T5 += 1;
    return '@template';
  });

  // T4b: @sounds:NAME (top-level directive form) → @sound.NAME
  // Only at line start (atLineStart true) AND not preceded by alphanum.
  // We accept identifier chars [A-Za-z0-9_] for NAME.
  out = out.replace(/@sounds:([A-Za-z_][A-Za-z0-9_]*)/g, (m, name) => {
    hits.T4b += 1;
    return `@sound.${name}`;
  });

  // For T1..T4 (inside @actor only) we look at bare keywords (no leading @).
  if (inActor) {
    // T1: alphabet:NAME → alphabet.NAME
    out = out.replace(/(^|[^A-Za-z0-9_.@])alphabet:([A-Za-z_][A-Za-z0-9_]*)/g,
      (m, pre, name) => {
        hits.T1 += 1;
        return `${pre}alphabet.${name}`;
      });
    // T2: tuning:NAME → tuning.NAME
    out = out.replace(/(^|[^A-Za-z0-9_.@])tuning:([A-Za-z_][A-Za-z0-9_]*)/g,
      (m, pre, name) => {
        hits.T2 += 1;
        return `${pre}tuning.${name}`;
      });
    // T3: transport:TYPE → transport.TYPE
    //  (the (...) param block that may follow is preserved by segmentation)
    out = out.replace(/(^|[^A-Za-z0-9_.@])transport:([A-Za-z_][A-Za-z0-9_]*)/g,
      (m, pre, name) => {
        hits.T3 += 1;
        return `${pre}transport.${name}`;
      });
    // T4: sounds:NAME → sound.NAME (singular + dot)
    out = out.replace(/(^|[^A-Za-z0-9_.@])sounds:([A-Za-z_][A-Za-z0-9_]*)/g,
      (m, pre, name) => {
        hits.T4 += 1;
        return `${pre}sound.${name}`;
      });
  }

  return { text: out, hits };
}

// ---------------------------------------------------------------------------
// Per-file migration.
// ---------------------------------------------------------------------------

function migrateContent(content) {
  const lines = content.split('\n');
  const outLines = [];
  const hits = { T1: 0, T2: 0, T3: 0, T4: 0, T4b: 0, T5: 0 };
  const details = []; // { line, kind, before, after }
  let blockCommentDepth = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
    const original = lines[lineIdx];
    const { segs, blockCommentDepth: nextDepth } =
      segmentLine(original, blockCommentDepth);
    blockCommentDepth = nextDepth;

    const inActor = lineStartsWithActor(original);
    let rebuilt = '';
    let codeSeen = false;

    for (const seg of segs) {
      if (seg.kind !== 'code') {
        rebuilt += seg.text;
        continue;
      }
      const atLineStart = !codeSeen;
      codeSeen = true;
      const before = seg.text;
      const { text: after, hits: segHits } =
        transformCode(before, { inActor, atLineStart });
      rebuilt += after;
      for (const k of Object.keys(segHits)) hits[k] += segHits[k];
      // Record per-transformation details.
      if (before !== after) {
        details.push({
          line: lineIdx + 1,
          before,
          after,
          inActor,
          counters: segHits,
        });
      }
    }
    outLines.push(rebuilt);
  }

  return { content: outLines.join('\n'), hits, details };
}

// ---------------------------------------------------------------------------
// File discovery.
// ---------------------------------------------------------------------------

function findGrammarFiles(rootDir) {
  // Default mandate: BPscript/test/grammars/*/scene.bps
  const result = [];
  if (!fs.existsSync(rootDir)) return result;
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const scenePath = path.join(rootDir, e.name, 'scene.bps');
    if (fs.existsSync(scenePath)) result.push(scenePath);
  }
  // Brief PM also mentions BPscript/test/scenes/*.bps — include if present.
  const scenesDir = path.join(path.dirname(rootDir), 'scenes');
  if (fs.existsSync(scenesDir)) {
    for (const f of fs.readdirSync(scenesDir)) {
      if (f.endsWith('.bps')) result.push(path.join(scenesDir, f));
    }
  }
  return result.sort();
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  let mode = 'dry-run';
  let rootOverride = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') mode = 'apply';
    else if (a === '--verify') mode = 'verify';
    else if (a === '--root') {
      rootOverride = argv[i + 1];
      i += 1;
    } else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/migrate-to-v0.8.cjs ' +
        '[--apply | --verify] [--root <dir>]'
      );
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    }
  }

  const repoRoot = path.resolve(__dirname, '..');
  const rootDir = rootOverride
    ? path.resolve(rootOverride)
    : path.join(repoRoot, 'test', 'grammars');

  const files = findGrammarFiles(rootDir);
  if (files.length === 0) {
    console.error(`No grammar files found under ${rootDir}`);
    process.exit(2);
  }

  console.log(`Mode: ${mode}`);
  console.log(`Root: ${rootDir}`);
  console.log(`Discovered ${files.length} candidate file(s).`);
  console.log('');

  const totals = { T1: 0, T2: 0, T3: 0, T4: 0, T4b: 0, T5: 0 };
  const touched = [];
  const atypical = []; // entries needing PM attention

  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    const { content: migrated, hits, details } = migrateContent(original);
    const sum = Object.values(hits).reduce((a, b) => a + b, 0);

    if (sum > 0) {
      for (const k of Object.keys(hits)) totals[k] += hits[k];
      touched.push({ file, hits, details });
    }

    if (hits.T4b > 0) {
      atypical.push({
        file,
        reason:
          '`@sounds:NAME` top-level directive (not inside @actor) — '
          + 'brief PM table says T4 applies "inside @actor"; treated as '
          + 'design-decision-7 form (`@sound.libname`) and migrated to '
          + '`@sound.NAME`.',
      });
    }

    if (mode === 'apply' && sum > 0) {
      fs.writeFileSync(file, migrated, 'utf8');
    }

    if (mode === 'verify') {
      // Re-run migration on the migrated content — must produce zero hits.
      const second = migrateContent(migrated);
      const secondSum = Object.values(second.hits).reduce((a, b) => a + b, 0);
      if (secondSum !== 0) {
        console.error(
          `VERIFY FAIL: ${file} — second pass produced ${secondSum} `
          + `transformation(s).`
        );
        process.exitCode = 1;
      }
    }
  }

  // ---- Report ----------------------------------------------------------
  console.log(`Files that would be touched: ${touched.length}`);
  console.log('Transformation totals:');
  console.log(`  T1  alphabet:    → alphabet.   : ${totals.T1}`);
  console.log(`  T2  tuning:      → tuning.     : ${totals.T2}`);
  console.log(`  T3  transport:   → transport.  : ${totals.T3}`);
  console.log(`  T4  sounds:      → sound.      : ${totals.T4}`);
  console.log(`  T4b @sounds:     → @sound.     : ${totals.T4b}  (top-level)`);
  console.log(`  T5  @templates   → @template   : ${totals.T5}`);
  console.log('');

  if (touched.length > 0) {
    console.log('Per-file detail:');
    for (const t of touched) {
      const relpath = path.relative(repoRoot, t.file);
      const parts = [];
      for (const k of Object.keys(t.hits)) {
        if (t.hits[k] > 0) parts.push(`${k}=${t.hits[k]}`);
      }
      console.log(`  ${relpath}  [${parts.join(', ')}]`);
      for (const d of t.details) {
        console.log(`    L${d.line} ${d.inActor ? '(actor) ' : ''}` +
          `\n      - ${d.before.trim()}` +
          `\n      + ${d.after.trim()}`);
      }
    }
    console.log('');
  }

  if (atypical.length > 0) {
    console.log('Atypical cases (PM attention recommended):');
    for (const a of atypical) {
      console.log(`  ${path.relative(repoRoot, a.file)}`);
      console.log(`    ${a.reason}`);
    }
    console.log('');
  }

  if (mode === 'dry-run') {
    console.log('Dry-run only — no files were modified.');
    console.log('Re-run with --apply to commit the migration.');
  } else if (mode === 'apply') {
    console.log(`Applied migration to ${touched.length} file(s).`);
  } else if (mode === 'verify') {
    if (process.exitCode) {
      console.log('Idempotence verification FAILED. See messages above.');
    } else {
      console.log('Idempotence verified: second pass produced no changes.');
    }
  }
}

if (require.main === module) main();

module.exports = { migrateContent, segmentLine, transformCode };
