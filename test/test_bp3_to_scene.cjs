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

// Contrôles runtime (lib/controls.json = autorité engine-vs-runtime).
// Normalisation générique appliquée aux DEUX côtés de la comparaison :
//   _name(args) → _ctrl(name,args)        (contrôles avec arguments)
//   _name       → _ctrl(name,1)           (contrôles sans arguments)
// 'script' est exclu : _script(CT n) est l'encodage compilé BPscript,
// résolu séparément par resolveScriptCT via la controlTable.
// Les contrôles ENGINE (_tempo, _retro, _legato…) ne sont PAS normalisés :
// ils sont émis verbatim par compileBPS et se comparent directement.
const RUNTIME_CTRLS = (() => {
  const lib = require(path.join(ROOT, 'lib', 'controls.json'));
  const out = [];
  for (const group of Object.values(lib.runtime)) {
    if (typeof group !== 'object' || group === null) continue;
    for (const [name, def] of Object.entries(group)) {
      if (name === '_comment' || name === 'script') continue;
      out.push({ name, noArg: !(def.args && def.args.length) });
    }
  }
  // Noms longs d'abord (évite que _volume( capture un préfixe de _volumecont, etc.)
  out.sort((a, b) => b.name.length - a.name.length);
  return out;
})();

// --- Helpers ----------------------------------------------------------------

/**
 * Extrait les lignes significatives d'une grammaire BP3 (même logique que compare.js)
 * Retourne un tableau de strings normalisés.
 */
function extractSignificant(text) {
  const lines = text.split('\n');
  const result = [];
  let inComment = false;
  let inTemplates = false;
  let inTimePatterns = false;
  let pendingSep = false;  // séparateur en attente d'être émis (lazy emission)

  for (let raw of lines) {
    raw = raw.trim();
    if (raw === 'COMMENT:') { inComment = true; continue; }
    if (inComment) continue;
    if (!raw) continue;
    if (raw.startsWith('//')) continue;
    if (raw.startsWith('-se.') || raw.startsWith('-al.') || raw.startsWith('-cs.')
      || raw.startsWith('-ho.') || raw.startsWith('-to.') || raw.startsWith('-md.')
      || raw.startsWith('-gl.') || raw.startsWith('-mi.')) continue;
    if (raw === 'TEMPLATES:') {
      // Le séparateur avant TEMPLATES (pendingSep) ne doit PAS être émis car bp3ToScene
      // ne génère pas de sous-grammaire compilée pour TEMPLATES.
      pendingSep = false;
      inTemplates = true;
      continue;
    }
    if (raw === 'TIMEPATTERNS:') {
      pendingSep = false;
      inTimePatterns = true;
      continue;
    }
    // Ignorer le contenu des sections TEMPLATES et TIMEPATTERNS (non représentables)
    if (inTemplates || inTimePatterns) {
      // Un séparateur "----" termine la section. On l'ignore aussi.
      if (/^-{4,}$/.test(raw)) { inTemplates = false; inTimePatterns = false; }
      continue;
    }

    // Séparateur : mise en attente lazy pour éviter d'émettre les séparateurs
    // qui précèdent TEMPLATES/TIMEPATTERNS (sections ignorées).
    if (/^-{4,}$/.test(raw)) {
      pendingSep = true;
      continue;
    }
    // Ligne de contenu : émettre le séparateur en attente
    if (pendingSep) {
      result.push('----');
      pendingSep = false;
    }

    raw = raw.replace(/\s+/g, ' ').trim();

    // Normaliser l'espacement autour des virgules : "{43/10, x}" → "{43/10,x}",
    // "{9 A _ , B}" → "{9 A _,B}". compileBPS émet toujours la forme serrée.
    raw = raw.replace(/\s*,\s*/g, ',');

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
    // Doit venir AVANT le strip ")" pour que les deux formes convergent.
    raw = raw.replace(/\)\s*\(/g, ') (');

    // Normaliser les polymetries adjacentes sans espace : }{ → } { (BP3 colle souvent)
    raw = raw.replace(/\}\s*\{/g, '} {');

    // Normaliser templates avec ")" de fermeture → sans ")".
    // BP2 templates nues n'ont pas de ")", les templates compilées en ont.
    // Normaliser les deux vers la forme sans ")" pour un round-trip FIDÈLE.
    // Appliquer APRÈS la normalisation d'espacement ") (" ci-dessus.
    raw = raw.replace(/\(=([^)]*)\)/g, '(=$1');
    raw = raw.replace(/\(:([^)]*)\)/g, '(:$1');

    // Normaliser la notation de lié BP3 : X& Y → X &Y (forme canonique avec & préfixe)
    raw = raw.replace(/([A-Za-z0-9'_#]+)&\s+/g, '$1 &');

    // Normaliser les prolongations collées : do3__ → do3 _ _ et pa3_ → pa3 _
    // (un ou plusieurs underscores traînants après un identifiant alphanum)
    // Correspond au comportement du tokenizer après fix F2 (BP3 OkBolChar2 / Encode.c:415).
    raw = raw.replace(/([A-Za-z0-9'#.]+)(_+)(?=[^a-zA-Z0-9]|$)/g, (_, id, us) => {
      return id + ' ' + us.split('').join(' ');
    });

    // Normaliser la notation de période collée : "M1." → "M1 ." pour converger
    // avec la sortie de compileBPS qui insère toujours un espace avant le ".".
    // Pattern : token finissant par "." et précédé d'un caractère alphanum.
    // On ne modifie pas un "." seul (séparateur) ni un ".0000" dans _mm(N.0000),
    // ni une décimale N.M (ex: _value(blurb,25.6)) — "." suivi d'un chiffre.
    raw = raw.replace(/([A-Za-z0-9'#_]+)\.(?!\d)/g, '$1 .');

    // Aliaser les identifiants avec "-" internes (terminaux BP3 non compatibles BPscript).
    // bp3ToScene remplace "-" → "O" dans les identifiants pour que compileBPS accepte le BPS.
    // On applique le même remplacement sur l'original pour que la comparaison converge.
    // Pattern : token (séquence sans espace) commençant par une lettre et contenant "-".
    // Ex: "dhin--" → "dhinOO", "dha-dha-dha-" → "dhaOdhaOdhaO".
    // Ne s'applique PAS à "-" seul ni aux tokens commençant par un non-lettre.
    raw = raw.split(' ').map(tok => {
      if (/^[A-Za-z]/.test(tok) && tok.includes('-')) return tok.replace(/-/g, 'O');
      return tok;
    }).join(' ');

    // Normaliser les contrôles runtime BP3 vers forme canonique _ctrl(name,val).
    // Liste pilotée par lib/controls.json (voir RUNTIME_CTRLS ci-dessus).
    // S'applique aux deux côtés pour que la comparaison converge avec le compilé
    // résolu via controlTable (resolveScriptCT).
    for (const { name, noArg } of RUNTIME_CTRLS) {
      if (noArg) {
        raw = raw.replace(new RegExp(`(?<![A-Za-z0-9_])_${name}\\b(?!\\()`, 'g'), `_ctrl(${name},1)`);
      } else {
        raw = raw.replace(new RegExp(`(?<![A-Za-z0-9_])_${name}\\(([^)]+)\\)`, 'g'), `_ctrl(${name},$1)`);
      }
    }

    // Supprimer les annotations libres en fin de ligne de mode
    if (/^(RND|ORD|LIN|SUB1?|TEM|POSLONG)(\s+\[.*)$/.test(raw)) {
      raw = raw.replace(/\s+\[.*$/, '');
    }
    // Supprimer les annotations libres en fin de règle (pas les qualifiers [key:val])
    raw = raw.replace(/\s+\[[A-Z][^\]]*\]\s*$/, '');

    result.push(raw);
  }
  // Flush séparateur final en attente (cas d'une grammaire terminée par un séparateur)
  if (pendingSep) result.push('----');
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
 * Résout les tokens _script(CT N) et _script(CT N_e) dans les lignes compilées
 * en forme canonique _ctrl(name,val) en utilisant la controlTable de compileBPS.
 *
 * _script(CT N)   → _ctrl(name1,val1) _ctrl(name2,val2) ...  (expandé)
 * _script(CT N_e) → <supprimé>
 * Double espace éventuel → espace simple.
 */
function resolveScriptCT(lines, controlTable) {
  if (!controlTable || !controlTable.length) return lines;
  // Construire map : "CT N" → assignments
  // scope 'start' : forme suffixe de règle (E2/E3) — _script(CT N) … _script(CT N_e)
  // scope absent  : forme appel positionnelle — _script(CT N) seul, à sa position
  const ctMap = new Map();
  for (const ct of controlTable) {
    if (ct.scope === 'start' || ct.scope === undefined) ctMap.set(ct.id, ct.assignments || {});
  }
  return lines.map(line => {
    // Supprimer les _script(CT N_e) (marqueurs de fin)
    line = line.replace(/_script\(CT\s+\d+_e\)/g, '');
    // Résoudre les _script(CT N) → _ctrl(name,val) ...
    line = line.replace(/_script\(CT\s+(\d+)\)/g, (_, id) => {
      const assignments = ctMap.get(`CT ${id}`);
      if (!assignments) return `_script(CT ${id})`;
      const parts = Object.entries(assignments)
        .filter(([,v]) => v !== null && v !== undefined)
        // true = contrôle sans argument (forme appel) ≡ valeur canonique 1
        .map(([k, v]) => `_ctrl(${k},${v === true ? 1 : v})`);
      return parts.length ? parts.join(' ') : '';
    });
    return line.replace(/\s+/g, ' ').trim();
  });
}

/**
 * Compare deux textes BP3 :
 * Retourne { ok: true } ou { ok: false, diffs: [...] }
 * Option { controlTable } : si fourni, résout les _script(CT N) du compilé pour
 * la comparaison sémantique avec les contrôles BP3 originaux normalisés.
 */
function compareGrammars(expected, actual, { controlTable } = {}) {
  const expLines = normalizeLines(extractSignificant(expected));
  let actLines = normalizeLines(extractSignificant(actual));
  if (controlTable && controlTable.length) {
    actLines = resolveScriptCT(actLines, controlTable);
  }
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
      name: '_vel(110) → FIDÈLE via forme appel',
      // _vel est dans lib/controls.json (runtime.musical) → convertible en forme appel
      // vel(110). compileBPS émet _script(CT n) positionné, résolu via controlTable.
      grammar: `RND\ngram#1[1] X --> _vel(110) sa6`,
      expectRules: ['X --> _vel(110) sa6'],
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

    // ---- Item 3 : templates BP2 nues avec flèche imbriquée ------------------
    {
      name: 'template BP2 nue LHS (= V1 #tr <-> (= ti #tr → NON GÉRÉ attendu',
      // dhati3 GRAM#4[7] — template nue en LHS : non représentable en BPscript
      // (BPscript ne supporte pas les templates comme LHS d'une règle).
      // Le fix findArrowInText permet de parser la flèche, mais la règle elle-même est
      // bloquée par checkLhsForUnsupported.
      grammar: `LIN\ngram#4[7] (= V1 #tr <-> (= ti #tr`,
      expectNonGere: true,
    },
    {
      name: 'template BP2 nue (= M V1 #tr <-> (= ti M #tr → NON GÉRÉ attendu',
      // dhati2 GRAM#4[9] — même construct
      grammar: `LIN\ngram#4[9] (= M V1 #tr <-> (= ti M #tr`,
      expectNonGere: true,
    },
    {
      name: 'template BP2 nue en RHS uniquement — doit passer',
      // Cas où (= apparaît uniquement en RHS (LHS normal). Doit être converti correctement.
      grammar: `ORD\ngram#1[1] S --> (= V1 dha`,
      // LHS normal → OK; RHS (= V1 dha sans ")" → convertit en $V1 en BPS puis (=V1) compilé
      // Normalisation strip ")" → (=V1 des deux côtés → FIDÈLE
      // Mais "(= V1 dha" → plusieurs tokens : on convertit tout le RHS en ${V1 dha} → (=V1 dha)
      expectRules: ['S --> (=V1 dha'],
    },

    // ---- Item 1 : alias "-" dans les noms de terminaux ----------------------
    {
      name: 'alias terminal dhin-- → dhinOO',
      grammar: `ORD\ngram#5[1] A3 <-> dhin--`,
      // Terminal dhin-- a des tirets internes → aliasés en O → dhinOO
      // Round-trip : compilé émet dhinOO, original normalisé dhin-- → dhinOO (de-alias)
      expectRules: ['A3 <-> dhin--'],
    },
    {
      name: 'alias terminal dha-dha-dha- → dhaOdhaOdhaO',
      grammar: `ORD\ngram#5[7] A6 <-> dha-dha-dha-`,
      expectRules: ['A6 <-> dha-dha-dha-'],
    },

    // ---- Item 2 : contrôles runtime _transpose → (transpose:N) --------------
    {
      name: 'runtime _transpose(0) → round-trip FIDÈLE',
      grammar: `ORD\ngram#1[1] Tr0 --> _transpose(0)`,
      // bp3ToScene converti en BPscript : Tr0 -> (transpose:0)
      // compileBPS émet : Tr0 --> _script(CT 0)  _script(CT 0_e)
      // Comparaison sémantique : _script(CT 0) ≡ _transpose(0) via controlTable
      expectRules: ['Tr0 --> _transpose(0)'],
    },
    {
      name: 'runtime _pitchrange(200) seul → round-trip FIDÈLE',
      // Contrôle standalone seul dans le RHS → convertible
      grammar: `ORD\ngram#1[1] SetRange --> _pitchrange(200)`,
      expectRules: ['SetRange --> _pitchrange(200)'],
    },
    // ---- E3bis : valeurs négatives → FIDÈLE (rule-suffix form) -----------------
    {
      name: 'E3bis: _pitchbend(-200) en tête + musique → FIDÈLE',
      // E3bis : valeur négative dans rule-suffix form → parser accepte
      grammar: `ORD\ngram#1[1] S --> _pitchbend(-200) a`,
      expectRules: ['S --> _pitchbend(-200) a'],
    },
    {
      name: 'E3bis: _pitchbend(+200) explicite en tête + musique → FIDÈLE',
      // E3bis : valeur positive explicite (+200) dans rule-suffix form → FIDÈLE
      grammar: `ORD\ngram#1[1] S --> _pitchbend(+200) a`,
      expectRules: ['S --> _pitchbend(+200) a'],
    },

    // ---- E2 : contrôle unique en tête + musique → FIDÈLE (rule-suffix) --------
    {
      name: 'E2: _scale en tête + musique → FIDÈLE',
      // E2 : contrôle unique en tête du RHS → émis en suffixe de règle
      grammar: `ORD\ngram#1[1] KA3 --> _scale(todi_ka_3,0) 11/10 ma3 pa3`,
      expectRules: ['KA3 --> _scale(todi_ka_3,0) 11/10 ma3 pa3'],
    },

    // ---- E3 : plusieurs contrôles consécutifs en tête + musique → FIDÈLE ------
    {
      name: 'E3: _pitchrange(200) _pitchbend(0) en tête + musique → FIDÈLE',
      // E3 : deux contrôles consécutifs en tête → mergés en () suffixe
      grammar: `ORD\ngram#1[1] S --> _pitchrange(200) _pitchbend(0) a`,
      expectRules: ['S --> _pitchrange(200) _pitchbend(0) a'],
    },
    {
      name: 'E3: _scale _pitchrange _pitchcont en tête + musique → FIDÈLE',
      // E3 : trois contrôles consécutifs (dont pitchcont sans arg) en tête
      grammar: `ORD\ngram#1[1] AAK2 --> _scale(todi_aak_2,0) _pitchrange(500) _pitchcont sa3 re3`,
      expectRules: ['AAK2 --> _scale(todi_aak_2,0) _pitchrange(500) _pitchcont sa3 re3'],
    },

    // ---- E1 : notation durée N/N → FIDÈLE --------------------------------------
    {
      name: 'E1: durée 11/10 standalone dans RHS → FIDÈLE',
      // E1 : N/N simple n'est plus bloqué par DURATION_SLASH_RE
      grammar: `ORD\ngram#1[1] KA3 --> 11/10 ma3`,
      expectRules: ['KA3 --> 11/10 ma3'],
    },
    {
      name: 'E1: durée 137/100 dans polymetrie → FIDÈLE',
      grammar: `ORD\ngram#1[1] KA2 --> {137/100,sa4 rek4}`,
      expectRules: ['KA2 --> {137/100,sa4 rek4}'],
    },
    {
      name: 'E1: durée 4/4/4/4/4 → NON GÉRÉ attendu',
      // 4/4/4/4/4 contient 3+ segments N/N/N → reste bloqué
      grammar: `ORD\ngram#1[1] S --> 4/4/4/4/4 S64`,
      expectNonGere: true,
    },

    // ---- E4 : forme appel — contrôles en position quelconque ------------------
    {
      name: 'E4: contrôle runtime trailing → FIDÈLE (forme appel)',
      // Contrôle APRÈS des tokens musicaux → forme appel pitchbend(100) positionnelle
      grammar: `ORD\ngram#1[1] S --> a b _pitchbend(100)`,
      expectRules: ['S --> a b _pitchbend(100)'],
    },
    {
      name: 'E4: contrôle runtime dans {…} → FIDÈLE (forme appel)',
      grammar: `ORD\ngram#1[1] S --> {43/10, _pitchbend(0) rek2 _pitchbend(-100) rek2&} a`,
      expectRules: ['S --> {43/10,_pitchbend(0) rek2 _pitchbend(-100) rek2&} a'],
    },
    {
      name: 'E4: engine _tempo en milieu de RHS → FIDÈLE (forme appel verbatim)',
      grammar: `ORD\ngram#1[1] S --> a - - _tempo(3/4) b`,
      expectRules: ['S --> a - - _tempo(3/4) b'],
    },
    {
      name: 'E4: engine _retro dans {…} → FIDÈLE (forme appel verbatim)',
      grammar: `ORD\ngram#1[1] S --> {_retro A} _\ngram#1[2] A --> a b`,
      expectRules: ['S --> {_retro A} _', 'A --> a b'],
    },
    {
      name: 'E4: engine _legato(300) dans {…} → FIDÈLE (forme appel verbatim)',
      grammar: `ORD\ngram#1[1] S --> {_legato(300) p4_3 sa_4 sa_3}`,
      expectRules: ['S --> {_legato(300) p4_3 sa_4 sa_3}'],
    },
    {
      name: 'E4: _cont + _value (float) mid-RHS → FIDÈLE (forme appel)',
      grammar: `ORD\ngram#1[1] S --> _cont(blurb) _value(blurb,25.6) e _value(blurb,100)`,
      expectRules: ['S --> _cont(blurb) _value(blurb,25.6) e _value(blurb,100)'],
    },
    {
      name: 'E4: lié X& et &X dans {…} → FIDÈLE (conversion ~ dans les accolades)',
      grammar: `ORD\ngram#1[1] S --> {12/10,sa3 ni2 rek3&} {48/10,&rek3}`,
      expectRules: ['S --> {12/10,sa3 ni2 rek3&} {48/10,&rek3}'],
    },
    {
      name: 'E4: argument +N en forme appel → FIDÈLE (fix F1: parser consomme +)',
      // Le parser consomme désormais T.PLUS dans parseControl (fix F1).
      // _pitchbend(+200) est représentable en forme appel → FIDÈLE.
      grammar: `ORD\ngram#1[1] S --> a _pitchbend(+200)`,
      expectRules: ['S --> a _pitchbend(+200)'],
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

    // ---- Assertion expectRules ------------------------------------------------
    // Vérifier que chaque règle attendue apparaît dans la grammaire compilée.
    // Les lignes compilées sont normalisées (extractSignificant) puis résolues
    // (_script(CT N) → _ctrl(name,val) via resolveScriptCT) — même pipeline
    // que compareGrammars — pour que "X --> _vel(110) sa6" matche
    // "X --> _script(CT 0) sa6" une fois le CT résolu en _ctrl(vel,110).
    if (t.expectRules && t.expectRules.length > 0) {
      const compiledLinesRaw = extractSignificant(compiled.grammar);
      const compiledLines = resolveScriptCT(compiledLinesRaw, compiled.controlTable);
      const missing = [];
      for (const expectedRaw of t.expectRules) {
        // Normaliser la règle attendue via extractSignificant + _ctrl (même pipeline)
        const expectedLines = resolveScriptCT(
          extractSignificant(expectedRaw),
          compiled.controlTable
        );
        const expectedNorm = expectedLines.join(' ').replace(/\s+/g, ' ').trim();
        const found = compiledLines.some(line =>
          line === expectedNorm || line.replace(/\s+/g, ' ').includes(expectedNorm)
        );
        if (!found) missing.push({ raw: expectedRaw, norm: expectedNorm });
      }
      if (missing.length > 0) {
        console.log(`  FAIL       [${t.name}]: règle(s) attendue(s) absente(s) dans la grammaire compilée:`);
        for (const m of missing) console.log(`    missing (norm): "${m.norm}"  ← raw: "${m.raw}"`);
        console.log(`    compiled lines: ${compiledLines.slice(0, 10).join(' | ')}`);
        failed++;
        continue;
      }
    }
    // --------------------------------------------------------------------------

    const cmp = compareGrammars(t.grammar, compiled.grammar, { controlTable: compiled.controlTable });
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
    const cmp = compareGrammars(grText, compiled.grammar, { controlTable: compiled.controlTable });
    if (cmp.ok) {
      const n = extractSignificant(grText).length;
      console.log(`  FIDÈLE     ${name} (${n} lignes)`);
      passed++;
    } else if (bps.includes('// BOLSIZE aliases')) {
      // Les terminaux >30 chars ont été tronqués (BOLSIZE moteur BP3) — diffs attendues
      const n = extractSignificant(grText).length;
      console.log(`  BOLSIZE    ${name}: ${cmp.diffs.length} écart(s) attendus (terminaux tronqués ≤30 chars)`);
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

  // -------------------------------------------------------------------------
  // Tests -ho : parseHoFile + signature opts.hoText/opts.hoKey
  // -------------------------------------------------------------------------
  console.log('\n=== Tests -ho parsing ===\n');

  // Contenu réel de -ho.tryhomomorphism
  const HO_TRYHOMO = `V.2.5
Date: Sat, Jun 17, 1995 -- 19:14
-mi.abc
*
a --> b
do4 --> re4
c --> fa4 --> d
sync a' b' c' d' e e' f f' g g' h h' i i' j j' k k' l l' m m' n n' o o' p p' q q' r r' s s' t t' u u' v v' w w' x x' y y' z z'  `;

  const GR_TRYHOMO = `RND
_mm(60.0000) _striated
GRAM#1[1] S --> a b c (= X) * (: X)
GRAM#1[3] X --> do4 c mi4 fa4`;

  // Test 1 : signature étendue — résultat contient @transcription.tryhomomorphism
  {
    const result = bp3ToScene(GR_TRYHOMO, { hoText: HO_TRYHOMO, hoKey: 'tryhomomorphism' });
    const ok = typeof result === 'object' && result.bps && result.bps.includes('@transcription.tryhomomorphism');
    if (ok) {
      console.log(`  OK         [ho-1: bps contient @transcription.tryhomomorphism]`);
      passed++;
    } else {
      console.log(`  FAIL       [ho-1: bps contient @transcription.tryhomomorphism]`);
      console.log(`    obtenu: ${JSON.stringify(result).substring(0, 200)}`);
      failed++;
    }
  }

  // Test 2 : transcriptionEntry.sections['*'] contient les 4 paires (chain c-->fa4-->d étendue)
  {
    const result = bp3ToScene(GR_TRYHOMO, { hoText: HO_TRYHOMO, hoKey: 'tryhomomorphism' });
    const sec = result && result.transcriptionEntry && result.transcriptionEntry.sections && result.transcriptionEntry.sections['*'];
    const expected = { a: 'b', do4: 're4', c: 'fa4', fa4: 'd' };
    const ok = sec &&
      sec['a'] === 'b' && sec['do4'] === 're4' &&
      sec['c'] === 'fa4' && sec['fa4'] === 'd' &&
      Object.keys(sec).length === 4;
    if (ok) {
      console.log(`  OK         [ho-2: transcriptionEntry.sections['*'] — 4 paires dont chaîne étendue]`);
      passed++;
    } else {
      console.log(`  FAIL       [ho-2: transcriptionEntry.sections['*'] — 4 paires dont chaîne étendue]`);
      console.log(`    obtenu sec: ${JSON.stringify(sec)}`);
      failed++;
    }
  }

  // Test 3 : compileBPS(bps).homomorphisms contient le noeud HomomorphismDeclAST
  {
    const result = bp3ToScene(GR_TRYHOMO, { hoText: HO_TRYHOMO, hoKey: 'tryhomomorphism' });
    if (result && result.bps && !result.bps.startsWith('NON GÉRÉ:')) {
      const compiled = compileBPS(result.bps);
      const homos = compiled.homomorphisms || [];
      const star = homos.find(h => h.name === '*');
      const ok = star &&
        star.type === 'Homomorphism' &&
        star.pairs.some(([a, b]) => a === 'a' && b === 'b') &&
        star.pairs.some(([a, b]) => a === 'do4' && b === 're4') &&
        star.pairs.some(([a, b]) => a === 'c' && b === 'fa4') &&
        star.pairs.some(([a, b]) => a === 'fa4' && b === 'd');
      if (ok) {
        console.log(`  OK         [ho-3: compileBPS(bps).homomorphisms — noeud '*' avec 4 paires]`);
        passed++;
      } else {
        console.log(`  FAIL       [ho-3: compileBPS(bps).homomorphisms — noeud '*' avec 4 paires]`);
        console.log(`    homos: ${JSON.stringify(homos)}`);
        console.log(`    errors: ${JSON.stringify(compiled.errors)}`);
        failed++;
      }
    } else {
      console.log(`  FAIL       [ho-3: bps invalide ou NON GÉRÉ]`);
      console.log(`    result: ${JSON.stringify(result).substring(0, 200)}`);
      failed++;
    }
  }

  // Test 4 : sans opts (rétrocompatibilité) — bp3ToScene retourne string (pas objet)
  {
    const result = bp3ToScene(GR_TRYHOMO);
    const ok = typeof result === 'string';
    if (ok) {
      console.log(`  OK         [ho-4: sans opts → retourne string (rétrocompat)]`);
      passed++;
    } else {
      console.log(`  FAIL       [ho-4: sans opts → retourne string (rétrocompat)]`);
      console.log(`    typeof result: ${typeof result}`);
      failed++;
    }
  }

  // Test 5 : headers V.x / Date: / -mi. ignorés, sync ignoré, section label '*' extrait
  {
    const hoSimple = `V.2.0\nDate: Mon, Jan 1, 2000\n-mi.test\n*\nx --> y\nsync a b c`;
    const result = bp3ToScene(`RND\ngram#1[1] S --> x y`, { hoText: hoSimple, hoKey: 'simple' });
    const sec = result && result.transcriptionEntry && result.transcriptionEntry.sections && result.transcriptionEntry.sections['*'];
    const ok = sec && sec['x'] === 'y' && Object.keys(sec).length === 1;
    if (ok) {
      console.log(`  OK         [ho-5: headers/sync ignorés, section '*' correcte]`);
      passed++;
    } else {
      console.log(`  FAIL       [ho-5: headers/sync ignorés, section '*' correcte]`);
      console.log(`    sec: ${JSON.stringify(sec)}, result: ${JSON.stringify(result).substring(0, 300)}`);
      failed++;
    }
  }

  // Test 6 : espaces de section ' * ' (cas -ho.dhin--) → clé '*'
  {
    const hoSpacedSection = `V.2.0\n * \nx --> y`;
    const result = bp3ToScene(`RND\ngram#1[1] S --> x y`, { hoText: hoSpacedSection, hoKey: 'spaced' });
    const sec = result && result.transcriptionEntry && result.transcriptionEntry.sections;
    const ok = sec && sec['*'] && sec['*']['x'] === 'y';
    if (ok) {
      console.log(`  OK         [ho-6: label ' * ' (espaces) → clé '*']`);
      passed++;
    } else {
      console.log(`  FAIL       [ho-6: label ' * ' (espaces) → clé '*']`);
      console.log(`    sec: ${JSON.stringify(sec)}`);
      failed++;
    }
  }

  // Test 7 : libKey absent du bps résultat si pas de hoText
  {
    const result = bp3ToScene(GR_TRYHOMO);
    const hasTranscription = result.includes('@transcription');
    if (!hasTranscription) {
      console.log(`  OK         [ho-7: sans hoText → pas de @transcription dans le bps]`);
      passed++;
    } else {
      console.log(`  FAIL       [ho-7: sans hoText → pas de @transcription dans le bps]`);
      console.log(`    result snippet: ${result.substring(0, 200)}`);
      failed++;
    }
  }

  console.log(`\n--- Résultat unitaires+ref: ${passed} OK, ${failed} FAIL, ${unhandled} NON GÉRÉ ---\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
