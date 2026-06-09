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

    // Normaliser la casse GRAM# → gram# (BP3 old style vs compileBPS output)
    raw = raw.replace(/^GRAM#/i, 'gram#');

    // Normaliser les numéros de règle gram#N[M] → gram#N[*] (les numéros M peuvent varier)
    // car BP3 original peut avoir des numéros non consécutifs (ex: gram#1[1], gram#1[3])
    // tandis que compileBPS renuméroté consécutivement.
    raw = raw.replace(/^(gram#\d+)\[\d+\]/, '$1[*]');

    // Supprimer le préfixe gram#N[*] pour normaliser les règles BP2 (sans numéro de bloc)
    // et les règles compilées (avec numéro de bloc). On garde uniquement le corps de règle.
    raw = raw.replace(/^gram#\d+\[\*\]\s*/, '');

    // Normaliser espaces internes des templates : (= X) → (=X), (: X) → (:X)
    raw = raw.replace(/\(=\s+/g, '(=').replace(/\(:\s+/g, '(:');
    // Normaliser espaces avant ) dans templates : (=X ) → (=X), (:X ) → (:X)
    raw = raw.replace(/\s+\)/g, ')');
    // Normaliser l'opérateur homo * collé à un template : *(... → * (...
    raw = raw.replace(/\*\(/g, '* (');

    // Normaliser les tokens adjacents sans espace : )(  → ) ( (templates collés en BP3)
    raw = raw.replace(/\)\s*\(/g, ') (');

    // Normaliser la notation de lié BP3 : X& Y → X &Y (forme canonique avec & préfixe)
    raw = raw.replace(/([A-Za-z0-9'_#]+)&\s+/g, '$1 &');

    // Normaliser les prolongations collées : do3__ → do3 _ _ (espace entre chaque token)
    raw = raw.replace(/([A-Za-z0-9'#.]+)(_{2,})/g, (_, id, us) => {
      return id + ' ' + us.split('').join(' ');
    });

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
  if (/^-{4,}$/.test(line)) return '------------';
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
    // --- Constructs nouveaux ---

    // Meter N+N/M dans le RHS — doit devenir [meter:N+N/M] qualifier suffixe
    {
      name: 'meter 4+4/6 en RHS',
      grammar: `RND\ngram#1[1] S <-> 4+4/6 S48`,
      expectRules: ['RND', 'gram#1[1] S <-> 4+4/6 S48'],
    },
    {
      name: 'meter 4+4+4+4/4 en RHS',
      grammar: `RND\nGRAM#1[1] S <-> 4+4+4+4/4 (=A16)(=V8)(=A8)`,
      expectRules: ['RND', 'gram#1[1] S <-> 4+4+4+4/4 (=A16) (=V8) (=A8)'],
    },

    // Annotations libres [Keep ...] dans le RHS — doivent être strippées (pas NON GÉRÉ)
    {
      name: 'annotation libre [Keep leftmost] strippée',
      grammar: `SUB\n#? ? --> #? ?  [Keep leftmost symbol]`,
      expectRules: ['SUB', 'gram#1[1] #? ? --> #? ?'],
    },
    {
      name: 'annotation libre [Append "d"] strippée',
      grammar: `ORD\n<1-1> ? #? --> d #? [Append "d" at the end of the item]`,
      expectRules: ['ORD', 'gram#1[1] <1-1> ? #? --> d #?'],
    },

    // Liens X& et &X — doivent devenir X~ et ~X
    {
      name: 'lié do3& → do3~',
      grammar: `RND\ngram#1[1] S --> do3& re3 do3`,
      expectRules: ['RND', 'gram#1[1] S --> do3& re3 do3'],
    },
    {
      name: 'lié &do3 → ~do3',
      grammar: `RND\ngram#1[1] S --> re3 &do3`,
      expectRules: ['RND', 'gram#1[1] S --> re3 &do3'],
    },

    // Double underscore __ → _ _ (prolongation collée)
    {
      name: 'prolongation collée __ → _ _',
      grammar: `RND\ngram#1[1] S --> do3__ mi3`,
      expectRules: ['RND', 'gram#1[1] S --> do3 _ _ mi3'],
    },

    // Apostrophe dans identifiant a' (ne pas bloquer STRING_IN_RHS_RE)
    {
      name: "apostrophe dans identifiant a'",
      grammar: `gram#1[1] S --> a' a' c' b`,
      expectRules: [`gram#1[1] S --> a' a' c' b`],
    },

    {
      name: 'opérateur _vel → NON GÉRÉ attendu',
      // _vel() est un contrôle runtime BP3 sans round-trip fidèle (compileBPS → _script(CT))
      // → NON GÉRÉ correct.
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
    // Niveau 1 (baseline)
    '-gr.doeslittle',
    '-gr.transposition1',
    '-gr.dhati',
    '-gr.koto1',
    '-gr.koto2',
    '-gr.checkBT',
    '-gr.checkSUB1',
    '-gr.tryhomomorphism',
    // Niveau 2 — priorités [BPx]
    '-gr.dhin1',
    '-gr.dhati2',
    '-gr.dhati3',
    // Niveau 2 — autres
    '-gr.check&',
    '-gr.tryCsoundObjects',
    '-gr.tryRagas',
    '-gr.tryShruti',
    '-gr.trySrand',
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
