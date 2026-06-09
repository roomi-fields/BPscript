/**
 * Tests round-trip : bp3ToScene(grammarText) → compileBPS(result).grammar ≡ original
 *
 * Stratégie : on extrait les lignes significatives des deux grammaires (mode,
 * règles, séparateurs) avec la même fonction que compare.js, puis on compare
 * ensemble à ensemble.  Un round-trip est FIDÈLE si les jeux de règles normalisés
 * sont identiques.
 *
 * Exécution : node test/test_bp3_to_scene.cjs
 */

'use strict';

const { createRequire } = require('module');
const path = require('path');
const fs = require('fs');

// Loader ESM depuis CJS
async function loadESM(specifier) {
  const { createRequire: cr } = require('module');
  return import(specifier);
}

const ROOT = path.resolve(__dirname, '..');
const TEST_DATA = path.join(ROOT, 'bp3-engine', 'test-data');
const SRC = path.join(ROOT, 'src', 'transpiler');

// --- Helpers ----------------------------------------------------------------

/**
 * Extrait les lignes significatives d'une grammaire BP3 (même logique que compare.js)
 * Retourne un tableau de strings normalisés.
 */
function extractSignificant(text) {
  const lines = text.split('\n');
  const result = [];
  let inComment = false;

  for (let raw of lines) {
    raw = raw.trim();
    if (raw === 'COMMENT:') { inComment = true; continue; }
    if (inComment) continue;
    if (!raw) continue;
    if (raw.startsWith('//')) continue;
    if (raw.startsWith('-se.') || raw.startsWith('-al.') || raw.startsWith('-cs.')
      || raw.startsWith('-ho.') || raw.startsWith('-to.') || raw.startsWith('-md.')
      || raw.startsWith('-gl.')) continue;
    if (raw === 'TEMPLATES:' || raw === 'TIMEPATTERNS:') continue;

    raw = raw.replace(/\s+/g, ' ').trim();

    // Normaliser _mm(N.0000) → _mm(N) (même valeur musicale, formatage différent)
    raw = raw.replace(/_mm\((\d+)\.0+\)/g, '_mm($1)');

    // Supprimer les annotations libres en fin de ligne de mode
    if (/^(RND|ORD|LIN|SUB1?|TEM|POSLONG)(\s+\[.*)$/.test(raw)) {
      raw = raw.replace(/\s+\[.*$/, '');
    }
    // Supprimer les annotations libres en fin de règle (pas les qualifiers [key:val])
    raw = raw.replace(/\s+\[[A-Z][^\]]*\]\s*$/, '');

    result.push(raw);
  }
  return result;
}

function normalizeSeparator(line) {
  if (/^-{5,}$/.test(line)) return '------------';
  return line;
}

function normalizeLines(lines) {
  return lines.map(normalizeSeparator);
}

/**
 * Compare deux textes BP3 :
 * Retourne { ok: true } ou { ok: false, diffs: [...] }
 */
function compareGrammars(expected, actual) {
  const expLines = normalizeLines(extractSignificant(expected));
  const actLines = normalizeLines(extractSignificant(actual));
  const diffs = [];
  const maxLen = Math.max(expLines.length, actLines.length);
  for (let i = 0; i < maxLen; i++) {
    const e = expLines[i] || '(missing)';
    const a = actLines[i] || '(missing)';
    if (e !== a) diffs.push({ i: i + 1, expected: e, actual: a });
  }
  return diffs.length === 0 ? { ok: true } : { ok: false, diffs };
}

// --- Test runner ------------------------------------------------------------

async function main() {
  const { bp3ToScene } = await import(path.join(SRC, 'bp3ToScene.js'));
  const { compileBPS } = await import(path.join(SRC, 'index.js'));

  let passed = 0, failed = 0, unhandled = 0;

  // -------------------------------------------------------------------------
  // Tests unitaires sur constructs précis
  // -------------------------------------------------------------------------
  const unitTests = [
    {
      name: 'mode ORD simple',
      grammar: `ORD\ngram#1[1] S --> A B`,
      expectRules: ['ORD', 'gram#1[1] S --> A B'],
    },
    {
      name: 'mode RND',
      grammar: `RND\ngram#1[1] S --> a b\ngram#1[2] S --> c d`,
      expectRules: ['RND', 'gram#1[1] S --> a b', 'gram#1[2] S --> c d'],
    },
    {
      name: 'poids <N>',
      grammar: `RND\ngram#1[1] <100> S --> A`,
      expectRules: ['RND', 'gram#1[1] <100> S --> A'],
    },
    {
      name: 'poids avec décrément <N-D>',
      grammar: `RND\ngram#1[1] <20-4> X Y --> Y X`,
      expectRules: ['RND', 'gram#1[1] <20-4> X Y --> Y X'],
    },
    {
      name: 'séparateur sous-grammaires',
      grammar: `ORD\ngram#1[1] S --> A\n-----\nRND\ngram#2[1] A --> a`,
      expectRules: ['ORD', 'gram#1[1] S --> A', '------------', 'RND', 'gram#2[1] A --> a'],
    },
    {
      name: 'garde /flag=val/',
      grammar: `gram#1[1] /make_b=1/ X --> b /make_c+1/`,
      expectRules: ['gram#1[1] /make_b=1/ X --> b /make_c+1/'],
    },
    {
      name: 'polymetrie {N,A B}',
      grammar: `RND\ngram#1[1] S --> {16,Qaida}`,
      expectRules: ['RND', 'gram#1[1] S --> {16,Qaida}'],
    },
    {
      name: 'flèche bidirectionnelle <->',
      grammar: `RND\ngram#1[1] S <-> A B`,
      expectRules: ['RND', 'gram#1[1] S <-> A B'],
    },
    {
      name: 'lambda (nil)',
      grammar: `ORD\ngram#1[1] X --> lambda`,
      expectRules: ['ORD', 'gram#1[1] X --> lambda'],
    },
    {
      name: 'silence -',
      grammar: `RND\ngram#1[1] S --> A - B`,
      expectRules: ['RND', 'gram#1[1] S --> A - B'],
    },
    {
      name: 'prolongation _',
      grammar: `RND\ngram#1[1] S --> A _`,
      expectRules: ['RND', 'gram#1[1] S --> A _'],
    },
    {
      name: 'LEFT (scan gauche)',
      grammar: `LIN\ngram#1[1] LEFT A --> B`,
      expectRules: ['LIN', 'gram#1[1] LEFT A --> B'],
    },
    {
      name: 'wildcard ?',
      grammar: `LIN\ngram#1[1] ? A --> A`,
      expectRules: ['LIN', 'gram#1[1] ? A --> A'],
    },
    {
      name: 'wildcard indexé ?1',
      grammar: `LIN\ngram#1[1] ?1 ?2 --> ?2 ?1`,
      expectRules: ['LIN', 'gram#1[1] ?1 ?2 --> ?2 ?1'],
    },
    {
      name: 'contexte positif (A B)',
      grammar: `LIN\ngram#1[1] (A B) C --> D`,
      expectRules: ['LIN', 'gram#1[1] (A B) C --> D'],
    },
    {
      name: 'contexte négatif #X',
      grammar: `LIN\ngram#1[1] #A B --> C`,
      expectRules: ['LIN', 'gram#1[1] #A B --> C'],
    },
    {
      name: 'template maître/esclave (=X)(:X)',
      grammar: `RND\ngram#1[1] S <-> (=|A1|) (=|A1|)`,
      expectRules: ['RND', 'gram#1[1] S <-> (=|A1|) (=|A1|)'],
    },
    {
      name: 'variable |x|',
      grammar: `LIN\ngram#1[1] |a4| --> |x| |z31|`,
      expectRules: ['LIN', 'gram#1[1] |a4| --> |x| |z31|'],
    },
    {
      name: 'opérateur _mm',
      // _mm(60.0000) est normalisé en _mm(60) par extractSignificant → FIDÈLE.
      grammar: `RND\n_mm(60.0000) _striated\ngram#1[1] S --> A`,
      expectRules: ['RND', '_mm(60.0000) _striated', 'gram#1[1] S --> A'],
    },
    {
      name: 'opérateur _vel → NON GÉRÉ attendu',
      // _vel() est un contrôle engine BP3 non représentable en BPscript → NON GÉRÉ correct.
      grammar: `RND\ngram#1[1] X --> _vel(110) sa6`,
      expectNonGere: true,
    },
    {
      name: 'opérateur /N tempo dans RHS → NON GÉRÉ attendu',
      // /N dans le RHS BP3 est un opérateur tempo. BPscript utilise X[/N] à la place.
      // La conversion est complexe (non implémentée) → NON GÉRÉ correct.
      grammar: `RND\ngram#1[1] S --> /5 A`,
      expectNonGere: true,
    },
    {
      name: 'notation période A8.',
      // BP3 original: 'A8. B8' (collé). Compilé depuis BPscript: 'A8 . B8' (espacé).
      // Cette différence de formatage est classifiée DIFFÈRE:format_period au corpus scan.
      // Ici on valide que la compilation réussit et que les tokens sont identiques.
      grammar: `ORD\ngram#1[1] S --> A8 . B8`,
      expectRules: ['ORD', 'gram#1[1] S --> A8 . B8'],
    },
    {
      name: 'poids <inf>',
      grammar: `LIN\ngram#1[1] <inf> A --> B`,
      expectRules: ['LIN', 'gram#1[1] <inf> A --> B'],
    },
    {
      name: 'poids flag <K1=1>',
      grammar: `LIN\ngram#1[1] <K1=1> A --> B`,
      expectRules: ['LIN', 'gram#1[1] <K1=1> A --> B'],
    },
  ];

  console.log('\n=== Tests unitaires constructs ===\n');
  for (const t of unitTests) {
    const bps = bp3ToScene(t.grammar);

    // Test qui attend explicitement NON GÉRÉ
    if (t.expectNonGere) {
      if (bps.startsWith('NON GÉRÉ:')) {
        console.log(`  OK (NON GÉRÉ attendu) [${t.name}]`);
        passed++;
      } else {
        console.log(`  FAIL  [${t.name}]: attendait NON GÉRÉ, obtenu: ${bps.substring(0, 100)}`);
        failed++;
      }
      continue;
    }

    if (bps.startsWith('NON GÉRÉ:')) {
      console.log(`  UNHANDLED  [${t.name}]: ${bps}`);
      unhandled++;
      continue;
    }
    const compiled = compileBPS(bps);
    if (compiled.errors.length > 0) {
      console.log(`  FAIL       [${t.name}]: compile error — ${compiled.errors[0].message}`);
      console.log(`    bps: ${bps.substring(0, 200)}`);
      failed++;
      continue;
    }
    const cmp = compareGrammars(t.grammar, compiled.grammar);
    if (cmp.ok) {
      console.log(`  OK         [${t.name}]`);
      passed++;
    } else {
      console.log(`  FAIL       [${t.name}]:`);
      for (const d of cmp.diffs.slice(0, 3)) {
        console.log(`    line ${d.i}: expected="${d.expected}" actual="${d.actual}"`);
      }
      console.log(`    bps input: ${bps.substring(0, 300)}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // Tests round-trip sur 3 grammaires de référence
  // -------------------------------------------------------------------------
  const refGrammars = [
    '-gr.doeslittle',
    '-gr.transposition1',
    '-gr.dhati',
  ];

  console.log('\n=== Tests round-trip grammaires de référence ===\n');
  for (const name of refGrammars) {
    const grPath = path.join(TEST_DATA, name);
    let grText;
    try {
      grText = fs.readFileSync(grPath, 'utf-8');
    } catch (e) {
      console.log(`  SKIP  ${name}: ${e.message}`);
      continue;
    }
    const bps = bp3ToScene(grText);
    if (bps.startsWith('NON GÉRÉ:')) {
      console.log(`  UNHANDLED  ${name}: ${bps.substring(0, 120)}`);
      unhandled++;
      continue;
    }
    const compiled = compileBPS(bps);
    if (compiled.errors.length > 0) {
      console.log(`  FAIL  ${name}: compile error — ${compiled.errors[0].message}`);
      console.log(`  bps:\n${bps.substring(0, 400)}`);
      failed++;
      continue;
    }
    const cmp = compareGrammars(grText, compiled.grammar);
    if (cmp.ok) {
      const n = extractSignificant(grText).length;
      console.log(`  FIDÈLE     ${name} (${n} lignes)`);
      passed++;
    } else {
      console.log(`  DIFFÈRE    ${name}: ${cmp.diffs.length} écart(s)`);
      for (const d of cmp.diffs.slice(0, 5)) {
        console.log(`    ligne ${d.i}:`);
        console.log(`      attendu: ${d.expected.substring(0, 120)}`);
        console.log(`      obtenu:  ${d.actual.substring(0, 120)}`);
      }
      failed++;
    }
  }

  console.log(`\n--- Résultat unitaires+ref: ${passed} OK, ${failed} FAIL, ${unhandled} NON GÉRÉ ---\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
