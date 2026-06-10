/**
 * bp3ToScene — Transpileur inverse BP3 → BPscript
 *
 * Entrée  : texte d'une grammaire BP3 (fichier -gr.xxx)
 * Sortie  : source BPscript (.bps) prêt à être compilé par compileBPS()
 *           OU chaîne "NON GÉRÉ: <construct>" si un construct non supporté est rencontré
 *
 * Fidélité : compileBPS(bp3ToScene(gr)).grammar doit produire un jeu de règles
 *            équivalent à gr (modulo commentaires, refs -se/-al/-ho, espaces).
 *
 * Constructs gérés :
 *   - Modes : ORD, RND, LIN, SUB, SUB1, TEM, POSLONG  (+ absence de mode)
 *   - Poids : <N>, <N-D>, <inf>, <KN=N> (k-param weights)
 *   - Scan : LEFT, RIGHT (sur la règle)
 *   - Gardes /flag=N/ (test) et /flag+N/ /flag-N/ (mutation) dans LHS
 *   - Flags /flag=N/ /flag+N/ /flag-N/ dans RHS
 *   - Flèches : -->, <--, <->
 *   - Séparateurs : -----
 *   - Preamble : _mm(...), _striated, _smooth, _destru, INIT:
 *   - Templates (=X) (:X) → BPscript $X &X / ${...} &{...}
 *   - Variables |x| → passées telles quelles
 *   - Wildcards ?, ?1 → passés tels quels
 *   - Contextes (A B) et #X → passés tels quels
 *   - Polymetrie {N,A B} → champs convertis (liés &→~, prolongations, contrôles)
 *   - Opérateurs BP3 +, ;, * (bare) → noms BPscript plus/fin/star
 *   - lambda (nil) → passé tel quel
 *   - Silence -, prolongation _
 *   - Contrôles BP3 présents dans lib/controls.json (_pitchbend, _volume,
 *     _scale, _tempo, _retro, _legato, …) :
 *       en tête de RHS → suffixe de règle (ctrl:val)   [E2/E3/E3bis]
 *       ailleurs (trailing, milieu, dans {…}) → FORME APPEL ctrl(args)
 *       positionnelle [E4] — la scène charge alors @controls
 *
 * Constructs NON GÉRÉS (stop-and-report par grammaire) :
 *   - Contrôles _xxx absents de lib/controls.json (_srand, _print, …) et _script
 *   - TEMPLATES: / TIMEPATTERNS: sections (non gérées via compileBPS)
 *   - Opérateurs tempo nus /N \N dans le RHS
 *
 * Note sur les preambles :
 *   Les lignes de preamble (_mm, _striated, etc.) sont passées verbatim
 *   dans le .bps. Le parser BPscript ne les gère pas directement, mais
 *   elles sont ignorées sans erreur et l'encodeur les réinjecte via les
 *   directives @mode:X(mm:N,striated).
 *   Pour un round-trip fidèle du preamble, on utilise @mode:X(modifiers).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ─── Contrôles BP3 connus (lib/controls.json = autorité engine-vs-runtime) ───
//
// Forme appel (E4) : un contrôle BP3 `_xxx(args)` en position non couverte par
// les formes existantes (tête de RHS → suffixe de règle) est traduit en forme
// appel BPscript `xxx(args)` à la position exacte du .gr. compileBPS émet :
//   - runtime : _script(CT n) positionné (résolu via controlTable)
//   - engine  : _xxx(args) verbatim à la même position
// La scène générée doit alors charger @controls.
const _bp3ToSceneDir = dirname(fileURLToPath(import.meta.url));
const _controlsLib = JSON.parse(
  readFileSync(join(_bp3ToSceneDir, '..', '..', 'lib', 'controls.json'), 'utf-8')
);

/**
 * Construit la map token BP3 (_xxx) → { bps, kind, noArg } depuis lib/controls.json.
 *   - runtime : token BP3 implicite '_' + clé (pas de champ bp3 dans le JSON)
 *   - engine  : champ bp3 explicite (_tempo, _rndseq, …)
 * Exclusions :
 *   - 'script' : _script(CT n) est l'encodage compilé BPscript — un _script
 *     au niveau source ne peut pas faire de round-trip.
 *   - collisions runtime/engine (ex: rotate) : runtime prioritaire
 *     (autorité controls.json : transpose/rotate/keyxpand sont runtime).
 */
function buildControlMap(lib) {
  const map = new Map();
  for (const group of Object.values(lib.runtime)) {
    if (typeof group !== 'object' || group === null) continue;  // _comment
    for (const [key, def] of Object.entries(group)) {
      if (key === '_comment' || key === 'script') continue;
      map.set('_' + key, { bps: key, kind: 'runtime', noArg: !(def.args && def.args.length) });
    }
  }
  for (const [key, def] of Object.entries(lib.engine)) {
    if (key === '_comment' || !def || !def.bp3) continue;
    if (map.has(def.bp3)) continue;  // runtime prioritaire
    map.set(def.bp3, { bps: key, kind: 'engine', noArg: !(def.args && def.args.length) });
  }
  return map;
}

const BP3_CONTROL_MAP = buildControlMap(_controlsLib);

// Token contrôle BP3 : _name ou _name(args) (après tokenizeBP3Line, les args
// arrivent généralement dans un token séparé "(args)" — fusion au cas par cas).
const BP3_CTRL_TOKEN_RE = /^(_[A-Za-z]+)(?:\(([^)]*)\))?$/;

// ─── Mappings inverse ────────────────────────────────────────────────────────

// BP3 mode → BPscript mode
const BP3_TO_BPS_MODE = {
  RND: 'random', ORD: 'ord', LIN: 'lin',
  SUB: 'sub', SUB1: 'sub1', TEM: 'tem', POSLONG: 'poslong',
};

// BP3 flèche → BPscript flèche
const BP3_TO_BPS_ARROW = {
  '-->': '->', '<--': '<-', '<->': '<>',
};

// Contrôles BP3 engine qui ne peuvent pas être représentés fidèlement en BPscript
// Présence dans le RHS d'une règle → NON GÉRÉ
const BP3_ENGINE_CONTROLS_RHS = new Set([
  '_vel', '_chan', '_transpose', '_script', '_rotate', '_retro',
  '_shuffle', '_srand', '_rndseq', '_goto', '_failed', '_repeat',
  '_stop', '_destru_inrhs',  // _destru en RHS (pas preamble) serait une anomalie
  '_print',
]);

// ─── Types de lignes BP3 ─────────────────────────────────────────────────────

const MODE_RE = /^(RND|ORD|LIN|SUB1?|TEM|POSLONG)\b/;
// Séparateurs BP3 : minimum 4 tirets (certaines grammaires utilisent ----)
const SEP_RE = /^-{4,}$/;
// gram#N[M] ou GRAM#N[M] (éventuellement avec espaces dans les crochets)
const RULE_RE = /^(?:GRAM|gram)#(\d+)\s*\[\s*(\d+)\s*\]\s*(.*)/i;
// Poids BP3 : <inf>, <N>, <N-D>, <KN>, <KN=N>, <KN-N>
const WEIGHT_RE = /^<([^>]+)>$/;
// Gardes BP3 : /flag=N/, /flag>N/, /flag<N/, /flag≥N/, /flag+N/, /flag-N/, /flag/
// Accepte espaces autour de l'opérateur
const GUARD_RE = /^\/[^/]+\/$/;
// Scan direction (LEFT, RIGHT)
const SCAN_KEYWORDS = new Set(['LEFT', 'RIGHT']);
// Preamble
const PREAMBLE_RE = /^(_[a-zA-Z]|INIT:)/;
// Annotations libres [text] (BP2)
const FREE_ANNOTATION_RE = /^\[.*\]$/;
// Entêtes BP2 legacy
const BP2_VERSION_RE = /^V\.\d+/;
const BP2_DATE_RE = /^Date:/;

// Contrôles engine dans RHS : _vel(...) _chan(...) _script(...) etc.
// Ces contrôles NE SONT PAS convertibles en syntaxe BPscript → bloquent le round-trip.
// Note : _transpose, _scale, _pitchrange, _pitchbend, _pitchcont, _volumecont, _volume,
//        _cont, _value SONT convertibles (voir RUNTIME_CTRL_CONVERTIBLE_RE ci-dessous).
// Note : _srand est converti en [shuffle:N] sur le groupe {…} suivant → retiré de cette liste.
//        _rndseq est dans BP3_CONTROL_MAP (controls.json) → masqué par stripMapControls → pas ici.
const ENGINE_CTRL_RHS_RE = /\b_(vel|chan|script|rotate|retro|shuffle|rndseq|goto|failed|repeat|stop|print|ins|step|fixed|key|note|time|dur|pitch|tempo|smooth|striated|legato|staccato|modwheel|aftertouch|sustain|portamento|expression|breath|pan|reverb|chorus|delay|distortion|phaser|flanger|eq|compress|expand|limit|gate|noise|filter|lfo|env|osc)\b/;

// Contrôles runtime convertibles en syntaxe BPscript (ctrl:val).
// Chaque token _xxx(args) ou _xxx (sans args) est converti en (xxx:args) ou (xxx:1).
// La conversion est appliquée dans convertBP3TokensToBPS AVANT le test ENGINE_CTRL_RHS_RE.
const RUNTIME_CTRL_CONVERTIBLE_RE = /^_(transpose|scale|pitchrange|pitchbend|pitchcont|volumecont|volume|cont|value)\b/;

// Opérateur tempo BP3 /N dans le RHS : token séparé « /N » (suivi d'un espace ou en fin)
// Depuis E5, /N est converti en X[/N] sur l'élément suivant → plus de NON GÉRÉ.
// Regex pour détecter le token /N dans le flux (pas pour bloquer, mais pour la détection).
const FORWARD_SLASH_TEMPO_RE = /(?:^|\s)(\/\d+(?:\/\d+)?)(?:\s|$)/;
// Opérateur tempo BP3 \N dans le RHS — toujours NON GÉRÉ (\N n'est pas tokenisé par BPscript).
const BACKSLASH_TEMPO_RHS_RE = /(?:^|\s)\\(\d+(?:\/\d+)?)(?:\s|$)/;
// TEMPO_OP_RHS_RE : alias de compatibilité — bloque uniquement \N désormais (plus /N).
// Utilisé dans checkLhsForUnsupported pour les deux (LHS avec /N reste NON GÉRÉ).
const TEMPO_OP_RHS_RE = /(?:^|\s)(?:\/|\\)\d+(?:\s|$)/;
// Token durée BP3 N/N/N... avec 3+ segments (ex: 4/4/4, non représentable en BPscript).
// Les ratios simples N/N (ex: 11/10, 137/100, 3/2) sont valides en BPscript.
// On bloque uniquement les formes N/N/N... avec au moins deux "/" séparés par des chiffres.
const DURATION_SLASH_RE = /\b\d+\/\d+\/\d/;

// Caractères BP2 non gérés par le tokenizer BPscript (ex: ¥ = prolongement BP2)
// BP2 legacy characters: ¥ (prolongation), ³ (≥ in old BP2), § © ® ™ °
const BP2_CHAR_RE = /[¥§©®™°³]/;

// Lié BP3 : note suivie de & (ex: G#5&) — ambiguïté avec template slave (&X)
// En BP3, X& = note liée. En BPscript, le lié = ~. La conversion est ambiguë.
const TIE_BP3_RE = /[A-Za-z0-9]&/;

// Annotation libre BP3 en fin de RHS : [texte libre] (pas un qualifier BPscript [key:val])
// Ces annotations contiennent souvent des espaces, ponctuation, !, etc.
// On détecte la présence d'un crochet ouvrant qui n'est pas suivi d'un identifiant + opérateur.
const FREE_ANNOT_RHS_RE = /\[(?![a-zA-Z][a-zA-Z0-9_]*\s*(?:==|!=|>=|<=|>|<|\+|-|=|:)[^\]]*\])/;

// Chaînes entre guillemets doubles dans le RHS — syntaxe BP3 non gérée.
// Note : les apostrophes simples ' font partie des identifiants BP3 (ex: A'8, a')
// et ne doivent PAS déclencher ce check. Seuls les guillemets doubles " bloquent.
const STRING_IN_RHS_RE = /"/;

// Guillemets typographiques — caractères non-ASCII spéciaux uniquement.
// Attention : l'apostrophe droite U+0027 (') est un caractère valide dans les identifiants BP3
// (ex: a', A'8). Elle ne doit PAS être listée ici.
// U+2018 ' U+2019 ' U+201C " U+201D " U+00AB « U+00BB » U+2039 ‹ U+203A ›
const TYPOGRAPHIC_QUOTE_RE = /[‘’“”«»‹›]/;

// Opérateurs BP3 nus : + ; * en dehors des templates
// Dans le RHS BP3, + est un opérateur de continuité, ; est fin de séquence, * est marqueur homo.
// En BPscript, ces opérateurs ne sont pas tokenisés comme des identifiants.
// Ils doivent être traduits avec les identifiants BPscript correspondants : plus/fin/star.
// MAIS : dans les templates (=+ ...) les + et ; sont des tokens opérateur.
// Stratégie : on recopie le RHS verbatim (tel quel), car l'encodeur BPscript les
// tokenise correctement quand ils sont bien espacés (+ → PLUS, etc.).

// ─── Fonction principale ─────────────────────────────────────────────────────

/**
 * @param {string} grammarText  Contenu complet d'un fichier -gr.xxx BP3
 * @param {{ hoText?: string, hoKey?: string }} [opts]
 *   opts.hoText : contenu du fichier -ho compagnon (optionnel)
 *   opts.hoKey  : clé lib (nom de l'homomorphisme, ex: 'tryhomomorphism')
 *
 * Sans opts → retourne string (rétrocompatibilité).
 * Avec opts → retourne { bps: string, transcriptionEntry: object }.
 *
 * @returns {string | { bps: string, transcriptionEntry: object }}
 */
function bp3ToScene(grammarText, opts) {
  const rawLines = grammarText.split('\n').map(l => l.trim());

  // ── Phase 1 : parser les lignes en segments ───────────────────────────────
  const segments = [];
  let i = 0;
  let inTemplates = false;
  let templateLines = [];
  let inTimePatterns = false;
  let tpLines = [];
  // Numéros automatiques pour règles nues (BP2 sans gram#N[M])
  let autoBlockNum = 1;
  let autoRuleNum = 1;

  while (i < rawLines.length) {
    const line = rawLines[i].trim();

    if (!line) { i++; continue; }

    // Commentaires
    if (line.startsWith('//')) { i++; continue; }

    // Références fichiers (-se., -al., -ho., -gl., etc.)
    if (/^-[a-z]{2}\./.test(line)) { i++; continue; }

    // Annotations BP2 libres [text seul]
    if (FREE_ANNOTATION_RE.test(line)) { i++; continue; }

    // Version BP2 et Date: — ignorer
    if (BP2_VERSION_RE.test(line)) { i++; continue; }
    if (BP2_DATE_RE.test(line)) { i++; continue; }

    // TEMPLATES: section
    if (line === 'TEMPLATES:') {
      inTemplates = true;
      templateLines = [];
      i++; continue;
    }

    // TIMEPATTERNS: section
    if (line === 'TIMEPATTERNS:') {
      inTimePatterns = true;
      tpLines = [];
      i++; continue;
    }

    // COMMENT: (fin de fichier BP3)
    if (line === 'COMMENT:') break;

    // Collecte TEMPLATES
    if (inTemplates) {
      if (SEP_RE.test(line)) {
        segments.push({ type: 'templates', lines: templateLines });
        inTemplates = false;
        i++; continue;
      }
      templateLines.push(line);
      i++; continue;
    }

    // Collecte TIMEPATTERNS
    if (inTimePatterns) {
      if (SEP_RE.test(line)) {
        segments.push({ type: 'timepatterns', lines: tpLines });
        inTimePatterns = false;
        i++; continue;
      }
      tpLines.push(line);
      i++; continue;
    }

    // INIT: ligne — ignorée dans le .bps généré
    if (line.startsWith('INIT:')) { i++; continue; }

    // Séparateur
    if (SEP_RE.test(line)) {
      segments.push({ type: 'separator' });
      autoBlockNum++;
      autoRuleNum = 1;
      i++; continue;
    }

    // Ligne de mode (seule sur la ligne, sans règle)
    if (MODE_RE.test(line) && !RULE_RE.test(line)) {
      const m = line.match(MODE_RE);
      segments.push({ type: 'mode', mode: m[1] });
      i++; continue;
    }

    // Règle gram#N[M]
    const ruleM = line.match(RULE_RE);
    if (ruleM) {
      const blockNum = parseInt(ruleM[1], 10);
      const ruleNum = parseInt(ruleM[2], 10);
      const rest = ruleM[3].trim();
      const parsed = parseRuleHead(rest);
      if (parsed.error) {
        return `NON GÉRÉ: ${parsed.error} (règle gram#${blockNum}[${ruleNum}]: ${line.substring(0, 80)})`;
      }
      // Vérifier si le LHS ou RHS contient des constructs non gérés
      const lhsCheck = checkLhsForUnsupported(parsed.lhs);
      if (lhsCheck) {
        return `NON GÉRÉ: ${lhsCheck} (gram#${blockNum}[${ruleNum}])`;
      }
      // Vérifier les gardes LHS (peuvent contenir des caractères BP2 ex: ³)
      for (const g of (parsed.lhsGuards || [])) {
        const gc = checkGuardForUnsupported(g);
        if (gc) return `NON GÉRÉ: ${gc} (garde LHS gram#${blockNum}[${ruleNum}])`;
      }
      const rhsCheck = checkRhsForUnsupported(parsed.rhs);
      if (rhsCheck) {
        return `NON GÉRÉ: ${rhsCheck} (gram#${blockNum}[${ruleNum}])`;
      }
      // Vérifier les gardes RHS
      for (const g of (parsed.rhsFlags || [])) {
        const gc = checkGuardForUnsupported(g);
        if (gc) return `NON GÉRÉ: ${gc} (garde RHS gram#${blockNum}[${ruleNum}])`;
      }
      segments.push({
        type: 'rule', blockNum, ruleNum,
        weight: parsed.weight,
        scan: parsed.scan,
        lhsGuards: parsed.lhsGuards,
        lhs: parsed.lhs,
        arrow: parsed.arrow,
        rhs: parsed.rhs,
        rhsFlags: parsed.rhsFlags,
      });
      i++; continue;
    }

    // Preamble (_mm, _striated, _smooth, _destru…)
    if (PREAMBLE_RE.test(line)) {
      segments.push({ type: 'preamble', text: line });
      i++; continue;
    }

    // Règle nue BP2 (sans gram#N[M])
    const bareMatch = matchBareRule(line);
    if (bareMatch) {
      const { lhsRaw, arrow, rhs: rhsRaw } = bareMatch;
      const parsed = parseBareHead(lhsRaw);
      if (parsed.error) {
        return `NON GÉRÉ: ${parsed.error} (règle BP2: ${line.substring(0, 80)})`;
      }
      const lhsCheckBare = checkLhsForUnsupported(parsed.lhs);
      if (lhsCheckBare) {
        return `NON GÉRÉ: ${lhsCheckBare} (règle BP2)`;
      }
      for (const g of (parsed.lhsGuards || [])) {
        const gc = checkGuardForUnsupported(g);
        if (gc) return `NON GÉRÉ: ${gc} (garde LHS règle BP2)`;
      }
      // parseRhsZone effectue le strip des annotations libres + extraction des gardes
      const rhsParsed = parseRhsZone(rhsRaw);
      if (rhsParsed.error) {
        return `NON GÉRÉ: ${rhsParsed.error} (règle BP2)`;
      }
      const rhsCheck = checkRhsForUnsupported(rhsParsed.rhs);
      if (rhsCheck) {
        return `NON GÉRÉ: ${rhsCheck} (règle BP2)`;
      }
      segments.push({
        type: 'rule',
        blockNum: autoBlockNum, ruleNum: autoRuleNum++,
        weight: parsed.weight,
        scan: parsed.scan,
        lhsGuards: parsed.lhsGuards,
        lhs: parsed.lhs,
        arrow,
        rhs: rhsParsed.rhs,
        rhsFlags: rhsParsed.rhsFlags,
      });
      i++; continue;
    }

    // Ligne non reconnue — ignorer silencieusement (bruit BP2)
    i++;
  }

  // Flush sections non terminées
  if (inTemplates && templateLines.length > 0) {
    segments.push({ type: 'templates', lines: templateLines });
  }
  if (inTimePatterns && tpLines.length > 0) {
    segments.push({ type: 'timepatterns', lines: tpLines });
  }

  // ── Phase 2 : regrouper en sous-grammaires ────────────────────────────────

  const subgrammars = [];
  let currentSub = null;

  function ensureSub(mode) {
    if (!currentSub) {
      currentSub = { mode: mode || null, preamble: [], rules: [], templates: null, timepatterns: null };
      subgrammars.push(currentSub);
    }
  }

  for (const seg of segments) {
    switch (seg.type) {
      case 'separator':
        currentSub = null;
        break;

      case 'mode':
        currentSub = { mode: seg.mode, preamble: [], rules: [], templates: null, timepatterns: null };
        subgrammars.push(currentSub);
        break;

      case 'preamble':
        ensureSub(null);
        currentSub.preamble.push(seg.text);
        break;

      case 'rule':
        ensureSub(null);
        currentSub.rules.push(seg);
        break;

      case 'templates':
        ensureSub(null);
        currentSub.templates = seg.lines;
        break;

      case 'timepatterns':
        ensureSub(null);
        currentSub.timepatterns = seg.lines;
        break;
    }
  }

  // ── Phase 3 : sérialiser en BPscript ─────────────────────────────────────

  const bpsLines = [];

  // BOLSIZE : table d'alias pour les terminaux dépassant 30 chars (limite moteur BP3)
  const bolsizeTable = new BolsizeTable();

  // E4 — décision au niveau GRAMMAIRE : si une règle exige la forme appel,
  // la scène charge @controls, et @controls change la position des _script(CT)
  // émis par la forme suffixe (E2/E3). Les deux formes ne cohabitent donc pas :
  // dès qu'une règle est en forme appel, TOUTES les règles à contrôles le sont.
  let grammarCallMode = false;
  for (const sub of subgrammars) {
    for (const rule of sub.rules) {
      if (decideRhsControlMode(rule.rhs).mode === 'call') { grammarCallMode = true; break; }
    }
    if (grammarCallMode) break;
  }
  // Les règles promues de legacy vers forme appel doivent aussi avoir des
  // arguments représentables (le check de phase 1 ne valide que le mode 'call').
  if (grammarCallMode) {
    for (const sub of subgrammars) {
      for (const rule of sub.rules) {
        const err = validateCallFormControls(rule.rhs);
        if (err) {
          return `NON GÉRÉ: ${err} (forme appel imposée par une autre règle — gram#${rule.blockNum}[${rule.ruleNum}])`;
        }
      }
    }
  }

  for (let si = 0; si < subgrammars.length; si++) {
    const sub = subgrammars[si];

    // Séparateur inter-sous-grammaires
    if (si > 0) bpsLines.push('-----');

    // Directive de mode
    if (sub.mode) {
      const bpsMode = BP3_TO_BPS_MODE[sub.mode];
      if (!bpsMode) return `NON GÉRÉ: mode BP3 inconnu "${sub.mode}"`;

      // Construire les modificateurs depuis le preamble
      const modifiers = extractPreambleModifiers(sub.preamble);
      if (modifiers.length > 0) {
        bpsLines.push(`@mode:${bpsMode}(${modifiers.join(',')})`);
      } else {
        bpsLines.push(`@mode:${bpsMode}`);
      }

      // Lignes de preamble qui ne sont PAS des modificateurs connus → conservées verbatim
      // (cas rare : _print, _destru, etc. qui ne s'encodent pas comme modificateurs)
      for (const p of sub.preamble) {
        const mod = preambleToModifier(p);
        if (!mod) {
          // Preamble inconnu : on l'ignore plutôt que de bloquer
          // (il peut être présent dans certaines grammaires BP3 anciennes)
        }
      }
    } else {
      // Pas de mode explicite
      if (sub.preamble.length > 0) {
        // Preamble sans mode — rare, on ignore
      }
    }

    // Règles
    for (const rule of sub.rules) {
      const parts = [];

      // Gardes LHS → préfixes [flag...] en BPscript
      for (const g of (rule.lhsGuards || [])) {
        parts.push(convertGuardToBPS(g, true));
      }

      // LHS
      const lhsBps = convertBP3TokensToBPS(rule.lhs, false, bolsizeTable);
      parts.push(lhsBps);

      // Flèche
      const bpsArrow = BP3_TO_BPS_ARROW[rule.arrow] || rule.arrow;
      parts.push(bpsArrow);

      // RHS — forme appel (E4) au niveau grammaire (voir pré-passe ci-dessus)
      const rhsBps = convertBP3TokensToBPS(rule.rhs, grammarCallMode, bolsizeTable);
      parts.push(rhsBps);

      // Flags RHS → suffixes [flag...] en BPscript
      for (const f of (rule.rhsFlags || [])) {
        parts.push(convertGuardToBPS(f, false));
      }

      // Qualifier weight → suffixe [weight:N] ou [weight:N-D]
      if (rule.weight !== null && rule.weight !== undefined) {
        const wStr = formatWeightQualifier(rule.weight);
        parts.push(wStr);
      }

      // Qualifier scan → préfixe ... mais en BPscript scan est dans [scan:left] qualifier
      // Le scan LEFT/RIGHT en BP3 correspond à un qualifier en BPscript
      if (rule.scan) {
        const scanKey = rule.scan === 'LEFT' ? 'left' : 'right';
        // Insérer le qualifier scan AVANT les autres qualifiers
        parts.push(`[scan:${scanKey}]`);
      }

      bpsLines.push(parts.join(' '));
    }

    // TEMPLATES section — NON GÉRÉ via compileBPS (pas de support round-trip)
    // On les marque mais ne bloque pas la compilation
    if (sub.templates && sub.templates.length > 0) {
      // TEMPLATES sont supportés par le parser BPscript via @templates
      // mais la sérialisation exacte est complexe. On les passe en commentaire.
      // POUR L'INSTANT : on ne les émet pas → DIFFÈRE pour les grammaires avec templates.
    }
  }

  // E4 : charger la librairie de contrôles pour les formes appel
  if (grammarCallMode) bpsLines.unshift('@controls');

  // BOLSIZE : injecter le commentaire de table d'alias en tête si des alias ont été créés
  if (bolsizeTable.hasAliases()) {
    bpsLines.unshift(bolsizeTable.headerComment());
  }

  // ── Résultat : avec ou sans opts -ho ─────────────────────────────────────

  if (opts && opts.hoText && opts.hoKey) {
    // Parsing du fichier -ho
    const transcriptionEntry = parseHoFile(opts.hoText);
    // Injecter @transcription.hoKey au début du BPS
    // Les tirets dans le hoKey sont remplacés par 'O' car le tokenizer BPscript
    // interprèterait '-' comme silence dans un identifiant de directive.
    const safeHoKey = opts.hoKey.replace(/-/g, 'O');
    const bpsWithHo = `@transcription.${safeHoKey}\n` + bpsLines.join('\n');
    return { bps: bpsWithHo, transcriptionEntry };
  }

  return bpsLines.join('\n');
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

/**
 * Détecte si le RHS commence par un préfixe de mètre BP3 N+N/M ou N+N+N+N/M.
 * Retourne le RHS sans le préfixe, ou le RHS intact si pas de préfixe.
 * Ex: "4+4/6 S48" → "S48"  /  "4+4+4+4/4 A B C" → "A B C"
 */
function stripMeterPrefix(rhs) {
  const m = rhs.match(/^(\d+(?:\+\d+)+\/\d+)\s+(.*)$/);
  if (m) return m[2];
  return rhs;
}

/**
 * Extrait le préfixe de mètre BP3 N+N/M ou N+N+N+N/M en tête du RHS.
 * Retourne { meter: "4+4/6", rest: "S48 ..." } ou null.
 */
function extractMeterPrefix(rhs) {
  const m = rhs.match(/^(\d+(?:\+\d+)+\/\d+)\s+(.*)/);
  if (m) return { meter: m[1], rest: m[2] };
  return null;
}

// ─── Analyse de la structure des contrôles dans le RHS ───────────────────────

/**
 * Analyse la position des contrôles runtime dans le RHS (flux de tokens de haut niveau).
 *
 * Retourne un objet :
 *   { headControls: string[], hasTrailingControls: bool, hasControlsInsidePolymetry: bool }
 *
 * headControls : tableau de tokens "_name(args)" consécutifs au début du RHS.
 * hasTrailingControls : vrai si un contrôle apparaît APRÈS un token non-contrôle.
 * hasControlsInsidePolymetry : vrai si un bloc {...} contient un pattern de contrôle.
 *
 * Note : tokenizeBP3Line traite {...} comme opaque. On détecte les contrôles à l'intérieur
 * en testant le contenu brut du bloc.
 */
function analyzeRhsControls(rhs) {
  if (!rhs) return { headControls: [], hasTrailingControls: false, hasControlsInsidePolymetry: false };

  const CONVERTIBLE_TOK_RE = RUNTIME_CTRL_CONVERTIBLE_RE;
  const CTRL_INSIDE_RE = /\b_(transpose|scale|pitchrange|pitchbend|pitchcont|volumecont|volume|cont|value)\b/;

  const tokens = tokenizeBP3Line(rhs);
  const headControls = [];
  let seenMusic = false;
  let hasTrailingControls = false;
  let hasControlsInsidePolymetry = false;
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];

    // Détecter un bloc polymetrique/groupe {...}
    if (tok.startsWith('{')) {
      // Contrôle à l'intérieur ? (détection sur le contenu brut)
      if (CTRL_INSIDE_RE.test(tok)) hasControlsInsidePolymetry = true;
      seenMusic = true;
      i++;
      continue;
    }

    // Contrôle runtime de haut niveau
    if (CONVERTIBLE_TOK_RE.test(tok)) {
      // Fusionner _name + (args) si token suivant est (args)
      let fullTok = tok;
      if (i + 1 < tokens.length) {
        const next = tokens[i + 1];
        if (next.startsWith('(') && next.endsWith(')') && !next.startsWith('(=') && !next.startsWith('(:')) {
          fullTok = tok + next;
          i++;
        }
      }
      if (!seenMusic) {
        headControls.push(fullTok);
      } else {
        hasTrailingControls = true;
      }
      i++;
      continue;
    }

    // Tout autre token → musique
    seenMusic = true;
    i++;
  }

  return { headControls, hasTrailingControls, hasControlsInsidePolymetry };
}

// ─── Forme appel (E4) : analyse et conversion positionnelle des contrôles ────

/**
 * Découpe un texte sur les virgules de profondeur 0 (hors {…} et (…)).
 * Utilisé pour séparer les champs d'une polymétrie {dur, seq1, seq2}.
 */
function splitTopLevelCommas(text) {
  const fields = [];
  let depth = 0;
  let cur = '';
  for (const c of text) {
    if (c === '{' || c === '(') depth++;
    else if (c === '}' || c === ')') depth--;
    if (c === ',' && depth === 0) { fields.push(cur); cur = ''; }
    else cur += c;
  }
  fields.push(cur);
  return fields;
}

/**
 * Collecte récursivement tous les tokens contrôle BP3 connus (BP3_CONTROL_MAP)
 * dans un texte de RHS, y compris à l'intérieur des polymétries {…}.
 * Retourne [{ bp3, args, inBrace }] dans l'ordre d'apparition.
 * args === null pour un contrôle sans parenthèses (_pitchcont, _retro).
 */
function collectMapControls(text, inBrace = false, acc = []) {
  const tokens = tokenizeBP3Line(text);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.startsWith('{') && tok.endsWith('}')) {
      for (const field of splitTopLevelCommas(tok.slice(1, -1))) {
        collectMapControls(field, true, acc);
      }
      continue;
    }
    const m = tok.match(BP3_CTRL_TOKEN_RE);
    if (m && BP3_CONTROL_MAP.has(m[1])) {
      let args = m[2] !== undefined ? m[2] : null;
      if (args === null && i + 1 < tokens.length) {
        const nx = tokens[i + 1];
        if (nx.startsWith('(') && nx.endsWith(')') && !nx.startsWith('(=') && !nx.startsWith('(:')) {
          args = nx.slice(1, -1);
          i++;
        }
      }
      acc.push({ bp3: m[1], args, inBrace });
    }
  }
  return acc;
}

/**
 * Reconstruit le texte sans les tokens contrôle connus (récursif dans {…}).
 * Sert à masquer les contrôles convertibles avant les checks génériques
 * (ENGINE_CTRL_RHS_RE, opérateurs tempo /N, durées N/N/N).
 */
function stripMapControls(text) {
  const tokens = tokenizeBP3Line(text);
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.startsWith('{') && tok.endsWith('}')) {
      const fields = splitTopLevelCommas(tok.slice(1, -1)).map(f => stripMapControls(f));
      out.push('{' + fields.join(',') + '}');
      continue;
    }
    const m = tok.match(BP3_CTRL_TOKEN_RE);
    if (m && BP3_CONTROL_MAP.has(m[1])) {
      if (m[2] === undefined && i + 1 < tokens.length) {
        const nx = tokens[i + 1];
        if (nx.startsWith('(') && nx.endsWith(')') && !nx.startsWith('(=') && !nx.startsWith('(:')) i++;
      }
      continue;
    }
    out.push(tok);
  }
  return out.join(' ');
}

/**
 * Décide la stratégie de conversion des contrôles d'un RHS :
 *   { mode: 'none' }    — aucun contrôle connu
 *   { mode: 'legacy' }  — contrôles runtime convertibles uniquement en TÊTE
 *                         (ou standalone) → forme suffixe de règle (E2/E3)
 *   { mode: 'call' }    — au moins un contrôle en position trailing/milieu/{…}
 *                         ou un contrôle engine → forme appel positionnelle (E4)
 *   { error: '…' }      — contrôle non représentable en forme appel
 *
 */
function decideRhsControlMode(rhs) {
  if (!rhs) return { mode: 'none' };
  const all = collectMapControls(rhs);
  if (all.length === 0) return { mode: 'none' };

  const allLegacySet = all.every(c => !c.inBrace && RUNTIME_CTRL_CONVERTIBLE_RE.test(c.bp3));
  if (allLegacySet) {
    const a = analyzeRhsControls(rhs);
    if (!a.hasTrailingControls && !a.hasControlsInsidePolymetry) return { mode: 'legacy' };
  }

  const err = validateCallFormControls(rhs);
  if (err) return { error: err };
  return { mode: 'call' };
}

/**
 * Vérifie que tous les contrôles connus d'un RHS sont représentables en
 * forme appel (arguments parsables par parseControl).
 * Retourne une description d'erreur ou null.
 */
function validateCallFormControls(rhs) {
  for (const c of collectMapControls(rhs)) {
    // '+' est maintenant consommé par parseControl (fix F1) — plus de blocage.
    if (c.args !== null && !/^[A-Za-z0-9_,.\/\-\+#= ]*$/.test(c.args)) {
      return `contrôle ${c.bp3}(${c.args}) : caractères d'argument non gérés en forme appel`;
    }
  }
  return null;
}

/**
 * Émet la forme appel BPscript d'un contrôle BP3.
 *   _pitchbend + "100"  → pitchbend(100)
 *   _pitchcont + null   → pitchcont        (contrôle sans argument)
 *   _tempo + "3/4"      → tempo(3/4)
 */
function emitCallForm(bp3Name, args) {
  const def = BP3_CONTROL_MAP.get(bp3Name);
  if (args === undefined || args === null || args.trim() === '') {
    return def.noArg ? def.bps : `${def.bps}()`;
  }
  return `${def.bps}(${args.trim()})`;
}

/**
 * Détecte les seq_prefix BP3 en tête d'un champ de groupe {…} et les extrait
 * comme qualifier BPscript [shuffle:N] ou [shuffle] à apposer sur le groupe.
 *
 * Formes reconnues (uniquement en PREMIER champ, sans virgule en tête) :
 *   _srand(N) _rndseq [rest]  →  { qualifier: '[shuffle:N]', rest }
 *   _rndseq [rest]            →  { qualifier: '[shuffle]', rest }
 *
 * Note : on traite UNIQUEMENT le premier champ (cas à une voix). Les groupes
 * polymètriques à plusieurs voix séparées par des virgules ne sont pas traités ici
 * (chaque champ est indépendant).
 *
 * Retourne null si aucun seq_prefix n'est détecté.
 */
function extractGroupSeqPrefix(inner) {
  // Détecter _srand(N) _rndseq [reste]
  const srandRndseq = inner.match(/^_srand\((\d+(?:\/\d+)?)\)\s+_rndseq(?:\s+(.*))?$/);
  if (srandRndseq) {
    return { qualifier: `[shuffle:${srandRndseq[1]}]`, rest: (srandRndseq[2] || '').trim() };
  }
  // Détecter _rndseq [reste]  (sans _srand → shuffle sans seed)
  // NOTE : ce cas est aussi géré par emitCallForm('_rndseq', null) → shuffle() en callMode,
  // mais la forme suffix qualifier [shuffle] est plus idiomatique en BPscript.
  const rndseq = inner.match(/^_rndseq(?:\s+(.*))?$/);
  if (rndseq) {
    return { qualifier: '[shuffle]', rest: (rndseq[1] || '').trim() };
  }
  return null;
}

/**
 * Convertit un groupe polymétrique {…} BP3 en BPscript.
 * Appliqué dans les DEUX modes (legacy et forme appel) :
 *   - liés X& → X~ et &X → ~X ('&' nu dans {…} n'est pas accepté par compileBPS)
 *   - prolongations collées X__ → X _ _ et ____ → _ _ _ _
 *   - alias des identifiants à tirets (dhin-- → dhinOO)
 *   - en mode forme appel : contrôles _xxx(args) → xxx(args)
 * Les champs (séparés par des virgules de profondeur 0) sont convertis
 * indépendamment puis rejoints.
 */
function convertBraceGroup(tok, callMode, bolsizeTable) {
  if (!tok.startsWith('{') || !tok.endsWith('}')) return tok;
  const fields = splitTopLevelCommas(tok.slice(1, -1))
    .map(f => convertSequenceInBrace(f, callMode, bolsizeTable));
  return '{' + fields.join(', ') + '}';
}

function convertSequenceInBrace(field, callMode, bolsizeTable) {
  const tokens = tokenizeBP3Line(field);
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    // Polymétrie imbriquée
    if (tok.startsWith('{') && tok.endsWith('}')) {
      out.push(convertBraceGroup(tok, callMode, bolsizeTable));
      continue;
    }

    // Contrôle connu → forme appel (mode E4 uniquement)
    if (callMode) {
      const cm = tok.match(BP3_CTRL_TOKEN_RE);
      if (cm && BP3_CONTROL_MAP.has(cm[1])) {
        let args = cm[2];
        if (args === undefined && i + 1 < tokens.length) {
          const nx = tokens[i + 1];
          if (nx.startsWith('(') && nx.endsWith(')') && !nx.startsWith('(=') && !nx.startsWith('(:')) {
            args = nx.slice(1, -1);
            i++;
          }
        }
        out.push(emitCallForm(cm[1], args));
        continue;
      }
    }

    // Prolongations collées
    if (/^_{2,}$/.test(tok)) {
      for (let k = 0; k < tok.length; k++) out.push('_');
      continue;
    }
    {
      const um = tok.match(/^(.+?)(_{2,})$/);
      if (um) {
        out.push(aliasTerminalDashes(um[1], bolsizeTable));
        for (let k = 0; k < um[2].length; k++) out.push('_');
        continue;
      }
    }

    // Liés X& → X~ et &X → ~X
    if (/^[A-Za-z0-9][A-Za-z0-9#'_]*&$/.test(tok)) {
      out.push(aliasTerminalDashes(tok.slice(0, -1), bolsizeTable) + '~');
      continue;
    }
    if (/^&[A-Za-z0-9]/.test(tok) && !tok.startsWith('(:')) {
      out.push('~' + aliasTerminalDashes(tok.slice(1), bolsizeTable));
      continue;
    }

    out.push(aliasTerminalDashes(tok, bolsizeTable));
  }
  return out.join(' ');
}

// ─── Vérification du RHS ──────────────────────────────────────────────────────

/**
 * Vérifie si le RHS contient des constructs BP3 non gérés par le round-trip.
 * Retourne une description de l'erreur, ou null si tout est OK.
 *
 * Extensions E1/E2/E3/E3bis :
 *   E1    — N/N simple (un seul "/") n'est plus bloqué (DURATION_SLASH_RE élargi)
 *   E2    — Contrôle unique en TÊTE + musique → émis en suffixe de règle (valide)
 *   E3    — Plusieurs contrôles consécutifs en TÊTE → mergés en () suffixe (valide)
 *   E3bis — Valeurs négatives dans les contrôles → acceptées en form rule-suffix
 *
 * NON GÉRÉ si :
 *   - Contrôle APRÈS un token musical (position trailing)
 *   - Contrôle INSIDE un groupe {...} polymetrique
 */
function checkRhsForUnsupported(rhs) {
  if (!rhs) return null;

  // ── Contrôles connus (E2/E3/E3bis legacy + E4 forme appel) ────────────────
  // decideRhsControlMode valide la représentabilité :
  //   - mode 'legacy' : contrôles runtime en tête → suffixe de règle (inchangé)
  //   - mode 'call'   : positions trailing/milieu/{…} et contrôles engine
  //                     → forme appel positionnelle (nécessite @controls)
  //   - error         : argument non parsable en forme appel (ex: '+')
  const decision = decideRhsControlMode(rhs);
  if (decision.error) return decision.error;

  // Masquer les contrôles convertibles avant les checks génériques :
  // _tempo(3/4) ne doit plus déclencher ENGINE_CTRL_RHS_RE ni TEMPO_OP_RHS_RE.
  const masked = decision.mode === 'none' ? rhs : stripMapControls(rhs);

  const m = masked.match(ENGINE_CTRL_RHS_RE);
  if (m) {
    return `contrôle engine "_${m[1]}" dans RHS (absent de lib/controls.json — non convertible en forme appel)`;
  }
  // \N : non tokenisé par BPscript → NON GÉRÉ
  if (BACKSLASH_TEMPO_RHS_RE.test(masked)) {
    return `opérateur tempo \\N dans RHS (\\N non tokenisé par BPscript — non convertible)`;
  }
  // /N est désormais converti en X[/N] dans convertBP3TokensToBPS → pas de NON GÉRÉ ici.
  // DURATION_SLASH_RE : bloquer uniquement si ce n'est pas un préfixe de mètre N+N/M
  // Les mètres N+N/M sont convertis en qualifier [meter:...] par convertBP3TokensToBPS.
  // On teste après avoir retiré le préfixe de mètre éventuel.
  {
    const withoutMeter = stripMeterPrefix(masked);
    if (DURATION_SLASH_RE.test(withoutMeter)) {
      return `notation durée multiplicative N/N dans RHS (ex: 4/4/4, non représentable en BPscript)`;
    }
  }
  // _& (prolongation liée) : pas d'équivalent direct en BPscript (~ doit s'attacher à un symbole)
  if (/\b_&\b|(?<!\S)_&/.test(rhs)) {
    return `lié sur prolongation _& dans RHS (non représentable en BPscript : ~ requiert un symbole)`;
  }
  if (BP2_CHAR_RE.test(rhs)) {
    return `caractère BP2 non géré par BPscript dans RHS (ex: ¥ prolongement)`;
  }
  if (STRING_IN_RHS_RE.test(rhs)) {
    return `chaîne entre guillemets dans RHS (syntaxe BP3 non gérée par le tokenizer BPscript)`;
  }
  if (TYPOGRAPHIC_QUOTE_RE.test(rhs)) {
    return `guillemet typographique dans RHS (caractère non géré par le tokenizer BPscript)`;
  }
  return null;
}

/**
 * Vérifie si une garde /.../ contient des constructs non gérés.
 */
function checkGuardForUnsupported(guardStr) {
  if (BP2_CHAR_RE.test(guardStr)) {
    return `caractère BP2 dans garde "${guardStr.substring(0, 30)}" (ex: ³=≥ BP2 vieux format)`;
  }
  // Expression arithmétique dans la valeur (K1+K2) → non supporté en BPscript
  const inner = guardStr.replace(/^\//, '').replace(/\/$/, '').trim();
  // Détecter K1=K1+K2 style (valeur arithmétique)
  if (/=\s*[A-Za-z_][A-Za-z0-9_]*\s*[+\-*]\s*[A-Za-z_][A-Za-z0-9_]/.test(inner)) {
    return `valeur arithmétique dans garde "${guardStr.substring(0, 30)}" (K1=K1+K2 non supporté en BPscript)`;
  }
  return null;
}

/**
 * Vérifie si le LHS contient des constructs non gérés.
 */
function checkLhsForUnsupported(lhs) {
  if (!lhs) return null;
  // Note : (= NON FERMÉ en tête de LHS est maintenant géré via l'ancre de gabarit maître
  // (graphie BPscript : « $ nu »). On ne le bloque plus ici.
  // En revanche (: (esclave) reste réservé/non implémenté.
  const lhsTrimmed = lhs.trimStart();
  if (lhsTrimmed.startsWith('(:')) {
    return `template esclave BP2 nue en LHS ("${lhs.substring(0, 30)}") — non représentable en BPscript (ancre esclave réservée, non implémentée)`;
  }
  if (TEMPO_OP_RHS_RE.test(lhs)) {
    return `opérateur tempo /N ou \\N dans LHS (non géré)`;
  }
  if (BP2_CHAR_RE.test(lhs)) {
    return `caractère BP2 non géré par BPscript dans LHS (ex: ¥ prolongement)`;
  }
  return null;
}

// ─── Conversion tokens BP3 → BPscript ────────────────────────────────────────────────

/**
 * Convertit un token BP3 individuel en son équivalent BPscript.
 * Les opérateurs nus + ; * ont des mappings spéciaux.
 * Les identifiants avec "-" internes sont aliasés (ex: dhin-- → dhinOO).
 */
function convertSingleToken(tok, bolsizeTable) {
  if (tok === '+') return 'plus';
  if (tok === ';') return 'fin';
  if (tok === '*') return 'star';
  return aliasTerminalDashes(tok, bolsizeTable);
}

/**
 * Aliase un token BP3 dont le nom contient des "-" internes.
 * En BPscript, "-" est le symbole de silence — un identifiant contenant "-" serait
 * tokenisé comme plusieurs tokens (ex: "dhin--" → "dhin" "-" "-").
 * Convention : remplacer chaque "-" par "O" dans les noms d'identifiants.
 * Ex: dhin-- → dhinOO, dha-dha-dha- → dhaOdhaOdhaO
 *
 * Ne s'applique QUE aux tokens commençant par une lettre (identifiants) et
 * contenant au moins un "-".
 *
 * @param {string} tok  Token BP3 brut
 * @returns {string}  Token aliasé (ou inchangé si pas de tirets)
 */
function aliasTerminalDashes(tok, bolsizeTable) {
  let result = tok;
  if (/^[A-Za-z]/.test(tok) && tok.includes('-')) {
    result = tok.replace(/-/g, 'O');
  }
  if (bolsizeTable) {
    result = bolsizeTable.alias(result);
  }
  return result;
}

// ─── Table BOLSIZE : alias déterministe pour les terminaux >30 chars ──────────

const BOLSIZE_LIMIT = 30;

/**
 * Gère les alias de terminaux dépassant la limite BOLSIZE (30 chars) du moteur BP3.
 *
 * Stratégie :
 *   - alias = 24 premiers chars + 'X' + compteur 3 chiffres (total ≤28 chars)
 *   - Déterministe : même original → même alias (même instance)
 *   - Sans collision : si le préfixe 24c est partagé par deux originaux distincts,
 *     le compteur les discrimine.
 *
 * Utilisation :
 *   const table = new BolsizeTable();
 *   const alias = table.alias('longterminalname...');  // ≤30 → unchanged, >30 → short alias
 *   const header = table.headerComment();              // lignes commentées pour le .bps
 */
class BolsizeTable {
  constructor() {
    this._map = new Map();  // original → alias
    this._counter = 0;
  }

  alias(tok) {
    if (tok.length <= BOLSIZE_LIMIT) return tok;
    if (this._map.has(tok)) return this._map.get(tok);
    this._counter++;
    const prefix = tok.slice(0, 24);
    const suffix = String(this._counter).padStart(3, '0');
    const short = `${prefix}X${suffix}`;
    this._map.set(tok, short);
    return short;
  }

  hasAliases() {
    return this._map.size > 0;
  }

  headerComment() {
    if (this._map.size === 0) return '';
    const lines = [
      '// BOLSIZE aliases (terminaux >30 chars tronqués pour la limite moteur BP3)',
    ];
    for (const [original, alias] of this._map.entries()) {
      lines.push(`//   ${alias} → ${original}`);
    }
    lines.push('//');
    return lines.join('\n');
  }
}

/**
 * Convertit un token atomique de template BP3 en BPscript.
 * tok est un groupe entier comme "(=X)", "(=+ L16)", "(:X)", etc.
 * ismaster = true pour (=...), false pour (:...)
 * Retourne la chaîne BPscript ou null si non reconnu.
 */
function convertTemplateToken(tok, isMaster) {
  // Ex: "(=X)", "(=|A1|)", "(=+ L16 ;)" — sans espace interne varié
  // On extrait le contenu entre ( et ) exclus
  const inner = tok.slice(1, -1).trim();  // ex: "=X", "=|A1|", "= X ;", ":X"
  const prefix = isMaster ? '=' : ':';

  if (!inner.startsWith(prefix)) return null;

  // Extraire le body après le préfixe
  const bodyRaw = inner.slice(prefix.length).trim();
  if (!bodyRaw) return isMaster ? '\${}' : '&{}';

  // Tokeniser le body pour convertir les opérateurs
  const bodyParts = bodyRaw.split(/\s+/).map(t => convertSingleToken(t));
  const bodyBps = bodyParts.join(' ').trim();

  // Si un seul identifiant simple (pas variable |x|) → forme courte $name / &name
  const shortForm = /^[A-Za-z][A-Za-z0-9_#'\"]*$/.test(bodyBps);
  if (isMaster) {
    return shortForm ? `$${bodyBps}` : `\${${bodyBps}}`;
  } else {
    return shortForm ? `&${bodyBps}` : `&{${bodyBps}}`;
  }
}

/**
 * Convertit un token de contrôle runtime BP3 en syntaxe BPscript (ctrl:val).
 *
 * Formes supportées :
 *   _transpose(N)   → (transpose:N)
 *   _scale(a,b)     → (scale:a,b)
 *   _pitchrange(N)  → (pitchrange:N)
 *   _pitchbend(N)   → (pitchbend:N)   (N peut être +N ou -N)
 *   _pitchcont      → (pitchcont:1)   (sans arguments)
 *   _volumecont     → (volumecont:1)  (sans arguments)
 *   _volume(N)      → (volume:N)
 *   _cont(param)    → (cont:param)
 *   _value(p,N)     → (value:p,N)
 *
 * Retourne null si le token n'est pas un contrôle runtime convertible.
 */
function convertRuntimeControlToBPS(tok) {
  if (!RUNTIME_CTRL_CONVERTIBLE_RE.test(tok)) return null;
  // Contrôles sans arguments
  if (tok === '_pitchcont')  return '(pitchcont:1)';
  if (tok === '_volumecont') return '(volumecont:1)';
  // Contrôles avec arguments : _name(args)
  const m = tok.match(/^_([a-z]+)\(([^)]*)\)$/);
  if (!m) {
    // Token _name sans "()" — traiter comme no-arg
    const name = tok.replace(/^_/, '');
    return `(${name}:1)`;
  }
  const name = m[1];
  const args = m[2].trim();
  if (!args) return `(${name}:0)`;
  return `(${name}:${args})`;
}

/**
 * Convertit une chaîne de tokens BP3 (LHS ou RHS) en tokens BPscript équivalents.
 *
 * Utilise tokenizeBP3Line pour préserver les groupes {...} et (...) entiers.
 * Les polymetries {N,A B} sont passées verbatim.
 * Les templates (=...) et (:...) sont convertis en $X et &X.
 * Les contextes positifs (A B C) sans = ni : sont passés verbatim.
 *
 * Conversions supplémentaires :
 *   - Préfixe de mètre N+N/M → qualifier [meter:N+N/M] en suffixe
 *   - Token X& → X~ (lié avant) — distingué des templates (:X) car en tête
 *   - Token &X → ~X (lié arrière) — distingué de (:X) par absence de parens
 *   - Token __ (N underscores) → _ _ _ ... (N tokens séparés)
 *   - Annotations libres [texte libre] → supprimées (extractSignificant les ignore aussi)
 *   - Polymétries {…} : liés/prolongations convertis dans les champs (les deux modes)
 *
 * @param {string} text      Texte BP3 (LHS ou RHS)
 * @param {boolean} callMode E4 : émettre les contrôles connus en FORME APPEL
 *                           positionnelle xxx(args) au lieu du suffixe de règle.
 */
function convertBP3TokensToBPS(text, callMode = false, bolsizeTable = null) {
  if (!text) return '';

  // ── Ancre de gabarit maître/esclave BP2 nue : "(= X Y Z" ou "(: X Y Z" sans ")" ──
  // En BP3, "(=" NON FERMÉ est un token T2,0 (Encode.c:1341-1364) — l'ancre de gabarit.
  // Elle n'est PAS un conteneur : les éléments suivants (X Y Z) sont des tokens frères.
  // En BPscript : "$ " (dollar isolé, espace après) = ancre maître.
  // Ex: "(= M V1 #tr" → "$ M V1 #tr"  ;  "(= ti M #tr" → "$ ti M #tr"
  // L'ancre esclave "(: ..." est réservée (zéro occurrence corpus), non implémentée.
  {
    const trimmed = text.trimStart();
    if (trimmed.startsWith('(=') && !trimmed.includes(')')) {
      // Extraire les tokens frères après l'ancre
      const body = trimmed.slice(2).trim();  // tout après "(="
      if (!body) return '$';  // ancre seule (rare)
      const bodyToks = body.split(/\s+/).map(t => convertSingleToken(t, bolsizeTable));
      return '$ ' + bodyToks.join(' ');
    }
    // Ancre esclave "(: ..." — réservée, non implémentée → laissée verbatim
    // (ne devrait pas arriver : checkLhsForUnsupported bloque le chemin LHS)
  }

  // ── E2/E3/E3bis : contrôles en TÊTE du RHS → rule-suffix ─────────────────
  // Si le RHS commence par des contrôles runtime convertibles suivis de musique,
  // on émet la musique d'abord, puis les contrôles en suffixe de règle :
  //   _pitchbend(-200) a → a (pitchbend:-200)          [E3bis]
  //   _scale(X,0) music  → music (scale:X,0)            [E2]
  //   _r(200) _pb(0) a   → a (pitchrange:200, pitchbend:0)  [E3]
  // Si le RHS ne contient QUE des contrôles (standalone), on les émet inline.
  // En mode forme appel (E4), ce bloc est court-circuité : les contrôles sont
  // émis positionnellement par la boucle principale.
  if (!callMode && RUNTIME_CTRL_CONVERTIBLE_RE.test(text)) {
    const analysis = analyzeRhsControls(text);
    const hasMusic = analysis.headControls.length < tokenizeBP3Line(text).filter(t => !t.startsWith('(')).length + analysis.headControls.length;
    // Vérifier s'il y a des tokens non-contrôle après les headControls
    const allTokens = tokenizeBP3Line(text);
    let numCtrlTokens = 0;
    let idx = 0;
    while (idx < allTokens.length) {
      const t = allTokens[idx];
      if (RUNTIME_CTRL_CONVERTIBLE_RE.test(t)) {
        numCtrlTokens++;
        // Sauter le token d'args si présent
        if (idx + 1 < allTokens.length) {
          const nx = allTokens[idx + 1];
          if (nx.startsWith('(') && nx.endsWith(')') && !nx.startsWith('(=') && !nx.startsWith('(:')) {
            numCtrlTokens++;
            idx++;
          }
        }
        idx++;
      } else {
        break;  // premier token non-contrôle
      }
    }
    const hasNonCtrlAfterHead = idx < allTokens.length;

    if (analysis.headControls.length > 0 && hasNonCtrlAfterHead) {
      // E2/E3/E3bis : contrôles en tête + musique → rule-suffix
      // Construire le suffixe : (name1:val1, name2:val2, ...)
      const ctrlParts = analysis.headControls.map(fullTok => {
        const converted = convertRuntimeControlToBPS(fullTok);
        // Extraire "name:val" de "(name:val)"
        return converted ? converted.slice(1, -1) : null;
      }).filter(Boolean);
      const ctrlSuffix = `(${ctrlParts.join(', ')})`;

      // Construire le texte sans les contrôles de tête (la partie musique)
      const musicTokens = allTokens.slice(numCtrlTokens);
      const musicText = musicTokens.join(' ');
      // Convertir récursivement la partie musicale (sans contrôles en tête)
      const musicBps = convertBP3TokensToBPS(musicText, false, bolsizeTable);
      return musicBps ? `${musicBps} ${ctrlSuffix}` : ctrlSuffix;
    }
    // Sinon : standalone ou autre → continuer avec le traitement normal
  }

  // ── Préfixe de mètre N+N/M ──────────────────────────────────────────────
  let meterQualifier = null;
  const meterInfo = extractMeterPrefix(text);
  if (meterInfo) {
    meterQualifier = `[meter:${meterInfo.meter}]`;
    text = meterInfo.rest;
  }

  const tokens = tokenizeBP3Line(text);
  const out = [];

  for (let ti = 0; ti < tokens.length; ti++) {
    const tok = tokens[ti];

    // ── Polymétries {…} : conversion des champs (liés, prolongations, contrôles E4)
    // Détection préalable des seq_prefix BP3 (_srand/_rndseq) en tête du premier
    // champ : convertis en qualifier [shuffle:N] ou [shuffle] en suffixe du groupe.
    if (tok.startsWith('{') && tok.endsWith('}')) {
      const inner = tok.slice(1, -1).trim();
      // Ne traiter la détection seq_prefix que si le groupe n'est pas polymétrique
      // (pas de virgule de niveau 0 — groupes à une seule voix).
      const hasTopComma = splitTopLevelCommas(inner).length > 1;
      if (!hasTopComma) {
        const seqPfx = extractGroupSeqPrefix(inner);
        if (seqPfx) {
          // Convertir le reste du groupe (après le seq_prefix) sans les contrôles en tête
          const restGroup = seqPfx.rest ? '{' + seqPfx.rest + '}' : '{}';
          const convertedGroup = convertBraceGroup(restGroup, callMode, bolsizeTable);
          out.push(convertedGroup + seqPfx.qualifier);
          continue;
        }
      }
      out.push(convertBraceGroup(tok, callMode, bolsizeTable));
      continue;
    }

    // ── E4 : contrôles connus → forme appel positionnelle ───────────────────
    if (callMode) {
      const cm = tok.match(BP3_CTRL_TOKEN_RE);
      if (cm && BP3_CONTROL_MAP.has(cm[1])) {
        let args = cm[2];
        if (args === undefined && ti + 1 < tokens.length) {
          const nx = tokens[ti + 1];
          if (nx.startsWith('(') && nx.endsWith(')') && !nx.startsWith('(=') && !nx.startsWith('(:')) {
            args = nx.slice(1, -1);
            ti++;
          }
        }
        out.push(emitCallForm(cm[1], args));
        continue;
      }
    }

    // ── Contrôles runtime convertibles en (ctrl:val) ─────────────────────────
    // BP3 tokenise _transpose(0) en deux tokens : "_transpose" et "(0)".
    // On détecte le token _xxx et on fusionne avec le suivant si c'est (args).
    if (RUNTIME_CTRL_CONVERTIBLE_RE.test(tok)) {
      const nextTok = tokens[ti + 1];
      let fullTok = tok;
      if (nextTok && nextTok.startsWith('(') && nextTok.endsWith(')') && !nextTok.startsWith('(=') && !nextTok.startsWith('(:')) {
        // Fusionner _name avec (args) → _name(args)
        fullTok = tok + nextTok;
        ti++;  // sauter le token d'args
      }
      const converted = convertRuntimeControlToBPS(fullTok);
      if (converted !== null) {
        out.push(converted);
        continue;
      }
    }

    // ── Opérateur tempo absolu /N dans RHS → attacher comme qualifier [/N] sur l'élément suivant
    // BP3 sémantique : /N = vitesse ABSOLUE N, persistant jusqu'au prochain opérateur tempo
    // ou fin de champ. En BPscript : A[/N] (qualifier sur l'élément suivant).
    // Formes reconnues : /5  /3/2  (fraction N/M aussi valide en BPscript)
    // Si aucun élément suivant : token orphelin, émis verbatim (cas dégénéré non géré).
    {
      const slashTempoM = tok.match(/^\/(\d+(?:\/\d+)?)$/);
      if (slashTempoM) {
        const ratio = slashTempoM[1];
        // Look ahead to find the next non-empty token to attach to
        let nextIdx = ti + 1;
        if (nextIdx < tokens.length) {
          // Convert the next token first, then attach the qualifier
          const nextTok = tokens[nextIdx];
          ti = nextIdx; // advance iterator
          let convertedNext;
          if (nextTok.startsWith('{') && nextTok.endsWith('}')) {
            convertedNext = convertBraceGroup(nextTok, callMode, bolsizeTable);
          } else {
            convertedNext = aliasTerminalDashes(nextTok, bolsizeTable);
          }
          // Attach [/ratio] directly to the converted token (no space before [)
          out.push(`${convertedNext}[/${ratio}]`);
        } else {
          // Orphan /N at end of RHS — emit verbatim (case not covered, documented)
          out.push(tok);
        }
        continue;
      }
    }

    // Template maître : (=...) ou (= ...)
    if (tok.startsWith('(') && tok.endsWith(')')) {
      const inner = tok.slice(1, -1).trim();
      if (inner.startsWith('=')) {
        const converted = convertTemplateToken(tok, true);
        out.push(converted !== null ? converted : tok);
        continue;
      }
      if (inner.startsWith(':')) {
        const converted = convertTemplateToken(tok, false);
        out.push(converted !== null ? converted : tok);
        continue;
      }
      // Contexte positif ou autre groupe (A B C) → verbatim
      out.push(tok);
      continue;
    }

    // Annotation libre BP3 [texte libre] — strippée silencieusement
    // Distinction : une annotation libre a des espaces ou des lettres majuscules seules
    // sans opérateur qualifier. Les vrais qualifiers [flag==N] sont dans parseRhsZone.
    // Ici les crochets restants (après extraction des gardes) sont des annotations.
    if (tok.startsWith('[') && tok.endsWith(']')) {
      const inner = tok.slice(1, -1);
      // Si c'est un qualifier BPscript valide (flag op val) on le garde
      const isQualifier = /^[a-zA-Z][a-zA-Z0-9_]*\s*(==|!=|>=|<=|>|<|\+|-|=|:)/.test(inner);
      if (!isQualifier) {
        // Annotation libre → supprimée
        continue;
      }
      out.push(tok);
      continue;
    }

    // Prolongation collée __ → _ _ _ ... (N underscores séparés)
    // Cas 1 : token entièrement underscores : ____ → _ _ _ _
    if (/^_{2,}$/.test(tok)) {
      const count = tok.length;
      for (let k = 0; k < count; k++) out.push('_');
      continue;
    }
    // Cas 2 : token terminé par underscores : do3__ → do3 _ _
    {
      const umatch = tok.match(/^(.+?)(_{2,})$/);
      if (umatch) {
        out.push(aliasTerminalDashes(umatch[1], bolsizeTable));
        const count = umatch[2].length;
        for (let k = 0; k < count; k++) out.push('_');
        continue;
      }
    }

    // Lié BP3 X& (note liée vers l'avant) → X~ en BPscript
    // Pattern : token se terminant par & (ex: do3& G#5& A'8&)
    if (/^[A-Za-z0-9][A-Za-z0-9#'_]*&$/.test(tok)) {
      out.push(aliasTerminalDashes(tok.slice(0, -1), bolsizeTable) + '~');
      continue;
    }

    // Lié BP3 &X (note liée vers l'arrière) → ~X en BPscript
    // ATTENTION : &X standalone ≠ template slave (:X). On vérifie qu'il n'y a pas de parens.
    if (/^&[A-Za-z0-9]/.test(tok) && !tok.startsWith('(:')) {
      out.push('~' + aliasTerminalDashes(tok.slice(1), bolsizeTable));
      continue;
    }

    // Tout le reste verbatim (terminaux, non-terminaux, polymetries, wildcards, etc.)
    // Aliaser les identifiants avec "-" internes (ex: dhin-- → dhinOO)
    out.push(aliasTerminalDashes(tok, bolsizeTable));
  }

  // Ajouter le qualifier de mètre en suffixe si présent
  if (meterQualifier) out.push(meterQualifier);

  return out.join(' ').replace(/\s+/g, ' ').trim();
}

// ─── Conversion des gardes BP3 ────────────────────────────────────────────────

/**
 * Convertit une garde BP3 /flag op val/ en qualifier BPscript [flag op val].
 *
 * En BPscript :
 *   - Garde LHS (test) : [flag==N], [flag>N], [flag<N], [flag>=N], [flag<=N], [flag!=N]
 *   - Mutation : [flag=N] (assign), [flag+N] (increment), [flag-N] (decrement)
 *   - Garde nue : [flag] (non-zero test)
 *
 * La règle pour distinguer test de mutation :
 *   - Les gardes en LHS (isLhsGuard=true) : /flag=N/ → test → [flag==N]
 *   - Les flags en RHS (isLhsGuard=false) : /flag=N/ → mutation → [flag=N]
 *   - /flag+N/ et /flag-N/ → toujours mutation dans les deux positions
 */
function convertGuardToBPS(guardStr, isLhsGuard) {
  // Retirer les /
  const inner = guardStr.replace(/^\//, '').replace(/\/$/, '').trim();
  if (!inner) return guardStr;

  // Analyser le contenu (les espaces autour de l'opérateur sont tolérés pour BP3 legacy)
  // Patterns possibles : flag=N, flag >N, flag >= N, flag != N, flag+N, flag-N, flag
  const m = inner.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*([=+\-><≥≤≠][^]*)?$/);
  if (!m) return `[${inner}]`;

  const flag = m[1];
  const rest = (m[2] || '').trim();

  if (!rest) {
    // Bare flag
    return `[${flag}]`;
  }

  // Opérateur et valeur
  let op = '';
  let val = '';

  if (rest.startsWith('≥')) { op = '>='; val = rest.slice(1).trim(); }
  else if (rest.startsWith('≤')) { op = '<='; val = rest.slice(1).trim(); }
  else if (rest.startsWith('≠')) { op = '!='; val = rest.slice(1).trim(); }
  else if (rest.startsWith('=')) { op = '='; val = rest.slice(1).trim(); }
  else if (rest.startsWith('+')) { op = '+'; val = rest.slice(1).trim(); }
  else if (rest.startsWith('-')) { op = '-'; val = rest.slice(1).trim(); }
  else if (rest.startsWith('>')) { op = '>'; val = rest.slice(1).trim(); }
  else if (rest.startsWith('<')) { op = '<'; val = rest.slice(1).trim(); }
  else { return `[${inner}]`; }

  // Convertir l'opérateur selon le contexte
  if (op === '=') {
    if (isLhsGuard) {
      // Test : /flag=N/ dans LHS → [flag==N]
      return `[${flag}==${val}]`;
    } else {
      // Mutation : /flag=N/ dans RHS → [flag=N]
      return `[${flag}=${val}]`;
    }
  }

  // +, - → toujours mutation (et doivent être espacés pour le tokeniseur)
  if (op === '+') return `[${flag}+${val}]`;
  if (op === '-') return `[${flag}-${val}]`;

  // >, <, >=, <=, != → comparaison (uniquement LHS)
  return `[${flag}${op}${val}]`;
}

// ─── Formatage du poids ───────────────────────────────────────────────────────

/**
 * Convertit un poids BP3 "N", "N-D", "inf", "KN=M" en qualifier BPscript [weight:...].
 */
function formatWeightQualifier(weightStr) {
  const s = String(weightStr).trim();
  if (s === 'inf') return '[weight:inf]';

  // K-param: K1=3, K1, etc.
  if (/^[A-Za-z]/.test(s)) {
    // K-param style: weight:K1=3 ou weight:K1
    return `[weight:${s}]`;
  }

  // Numérique: N ou N-D
  const dm = s.match(/^(\d+)-(\d+)$/);
  if (dm) return `[weight:${dm[1]}-${dm[2]}]`;

  return `[weight:${s}]`;
}

// ─── Preamble → modificateurs @mode ──────────────────────────────────────────

/**
 * Convertit une ligne de preamble BP3 en modificateur BPscript pour @mode:X(...).
 * Retourne le modificateur string ou null si non reconnu.
 */
function preambleToModifier(preambleLine) {
  const line = preambleLine.trim();

  // _mm(N) ou _mm(N.NNN)
  const mmM = line.match(/^_mm\(([^)]+)\)/);
  if (mmM) return `mm:${mmM[1]}`;

  if (line === '_striated') return 'striated';
  if (line === '_smooth') return 'smooth';
  if (line === '_destru') return 'destru';

  // Lignes de preamble composites : _mm(60.0000) _striated
  // Traitées en les décomposant dans extractPreambleModifiers
  return null;
}

/**
 * Extrait les modificateurs de mode depuis les lignes de preamble d'une sous-grammaire.
 * Gère les lignes composites comme "_mm(60.0000) _striated".
 * Retourne un tableau de strings modificateurs.
 */
function extractPreambleModifiers(preambleLines) {
  const mods = [];
  for (const line of preambleLines) {
    // Découper la ligne en mots-clés BP3
    const parts = line.split(/\s+/).filter(p => p.length > 0);
    for (const part of parts) {
      const mod = preambleToModifier(part);
      if (mod) mods.push(mod);
      // Cas des parties sans parens dans une ligne composée
    }
  }
  return mods;
}

// ─── Parsers de tête de règle ─────────────────────────────────────────────────

/**
 * Parse la zone après gram#N[M] :
 * [weight]? [scan]? [lhsGuards]* LHS arrow RHS [rhsFlags]*
 *
 * Les gardes LHS en BP3 sont de la forme /flag=N/ et apparaissent avant le LHS.
 * Les flags RHS apparaissent après le LHS et après la flèche.
 *
 * Retourne { weight, scan, lhsGuards, lhs, arrow, rhs, rhsFlags } ou { error }
 */
function parseRuleHead(rest) {
  // Chercher la flèche : --> ou <-- ou <->
  // On utilise un regex qui respecte les groupes parenthésés/accolades
  const arrowMatch = findArrowInText(rest);
  if (!arrowMatch) {
    // Si une flèche existe dans le texte brut mais pas à depth=0,
    // c'est probablement un template avec fermeture implicite (BP3 ancien) → NON GÉRÉ
    if (/-->|<--|<->/.test(rest)) {
      return { error: `template BP3 avec fermeture implicite (flèche imbriquée dans un template non fermé): "${rest.substring(0, 60)}"` };
    }
    return { error: `pas de flèche dans: "${rest.substring(0, 60)}"` };
  }

  const arrow = arrowMatch.arrow;
  const lhsRaw = rest.substring(0, arrowMatch.start).trim();
  const rhsRaw = rest.substring(arrowMatch.end).trim();

  // Parser la zone LHS : poids + scan + gardes + symboles LHS
  const lhsParsed = parseLhsZone(lhsRaw);

  // Parser la zone RHS : tokens + flags RHS
  const rhsParsed = parseRhsZone(rhsRaw);
  if (rhsParsed.error) {
    return { error: rhsParsed.error };
  }

  return {
    weight: lhsParsed.weight,
    scan: lhsParsed.scan,
    lhsGuards: lhsParsed.guards,
    lhs: lhsParsed.lhs,
    arrow,
    rhs: rhsParsed.rhs,
    rhsFlags: rhsParsed.rhsFlags,
  };
}

/**
 * Cherche la flèche (-->, <--, <->) dans un texte en respectant les groupes imbriqués.
 * Retourne { arrow, start, end } ou null.
 *
 * On doit ignorer les flèches à l'intérieur des groupes parenthésés { } ( ).
 */
function findArrowInText(text) {
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '{') { depth++; i++; continue; }
    if (c === ')' || c === '}') { depth--; i++; continue; }
    if (c === '(') {
      // Templates BP2 nues "(= X Y Z" et "(: X Y Z" sans ")" de fermeture.
      // Ces tokens ne constituent PAS un groupe imbriqué — ne pas incrémenter depth.
      const next = text[i + 1];
      if (next === '=' || next === ':') { i++; continue; }
      depth++;
      i++;
      continue;
    }
    if (depth > 0) { i++; continue; }

    // Chercher <-> en priorité (bidirectionnel)
    if (c === '<' && text[i+1] === '-' && text[i+2] === '>') {
      return { arrow: '<->', start: i, end: i + 3 };
    }
    // --> (production)
    if (c === '-' && text[i+1] === '-' && text[i+2] === '>') {
      return { arrow: '-->', start: i, end: i + 3 };
    }
    // <-- (analyse)
    if (c === '<' && text[i+1] === '-' && text[i+2] === '-') {
      return { arrow: '<--', start: i, end: i + 3 };
    }
    i++;
  }
  return null;
}

/**
 * Parse la zone LHS d'une règle BP3 :
 * [weight]? [scan]? [guards]* lhs_symbols
 *
 * Les gardes /flag op val/ peuvent être intercalées avec des symboles.
 * On collecte les gardes qui précèdent le premier symbole non-garde.
 */
function parseLhsZone(lhsRaw) {
  // Extraire les gardes /.../ en préfixe du texte brut (avant tokenisation)
  // Supporte les espaces internes : /times > 0/, /flag = 3/, etc.
  const prefixGuards = [];
  let remaining = lhsRaw.trim();
  {
    const GUARD_PREFIX_RE = /^(\/[^/]+\/)\s*/;
    let m;
    while ((m = remaining.match(GUARD_PREFIX_RE))) {
      prefixGuards.push(m[1]);
      remaining = remaining.slice(m[0].length);
    }
  }

  const tokens = tokenizeBP3Line(remaining);
  const weight = extractWeightToken(tokens);
  const scan = extractScanToken(tokens);
  // Gardes restantes sans espaces (style compact /flag=N/)
  const guards = [...prefixGuards, ...extractGuardTokens(tokens)];
  // Les tokens restants = LHS
  const lhs = tokens.join(' ').trim();
  return { weight, scan, guards, lhs };
}

/**
 * Parse la zone RHS d'une règle BP3 :
 * tokens... [/flags/]*
 *
 * Les flags /flag op val/ qui se trouvent à la fin du RHS (et qui existent
 * aussi dispersés dans le RHS pour certaines grammaires BP3) sont extraits.
 *
 * Stratégie : on scanne de droite à gauche pour extraire les flags de fin.
 */
// Flag BP3 avec espaces : /flag = val/, /flag+ val/, etc.
// GUARD_RE_SPACED permet de les détecter avant tokenisation.
const GUARD_SPACED_RE = /\/[^/]+\//g;

function parseRhsZone(rhsRaw) {
  // Supprimer les annotations libres BP3 [texte libre] en fin de RHS.
  // Ces annotations ont un contenu avec espaces et/ou majuscules sans opérateur qualifier.
  // Exemple : "A B [Keep leftmost symbol]", "d #? [Append "d" at the end]"
  // Cas spécial : annotations BP3 commençant par un caractère non-ASCII (ex: [Ô#(M)Õ...])
  //   — elles utilisent les caractères spéciaux BP3 comme délimiteurs de citation.
  // On distingue des qualifiers BPscript [key:val] en testant le contenu.
  // Règle : si le premier caractère dans [...] n'est pas un identifiant ASCII minuscule
  // (i.e., pas a-z) suivi de ':' ou d'un opérateur qualifier, c'est une annotation libre.
  let rhsRawClean = rhsRaw
    // Annotations démarrant par [A-Z] (ex: [Keep leftmost...])
    .replace(/\s+\[[A-Z][^\]]*\]\s*$/g, '')
    // Annotations démarrant par un caractère non-ASCII ou non-identifiant (ex: [Ô#(M)Õ...])
    .replace(/\s+\[[^\x00-\x7F][^\]]*\]\s*$/g, '')
    .trim();

  // Extraire toutes les gardes /.../ directement dans le texte brut (avant tokenisation)
  // Cas BP3 : gardes peuvent avoir des espaces internes (/K2 = 11/)
  const rhsFlags = [];
  let stripped = rhsRawClean;

  // Extraire les gardes en queue (itère depuis la fin)
  // On utilise une regex globale pour trouver toutes les occurrences /.../ non imbriquées
  let guardMatches = [...rhsRaw.matchAll(GUARD_SPACED_RE)];
  if (guardMatches.length > 0) {
    // Retirer les gardes de la fin du texte brut
    let cursor = rhsRaw.length;
    for (let gi = guardMatches.length - 1; gi >= 0; gi--) {
      const gm = guardMatches[gi];
      const gEnd = gm.index + gm[0].length;
      // La garde doit être immédiatement suivie de fin ou d'autres gardes (avec espaces)
      const trailing = rhsRaw.slice(gEnd).trim();
      // Si le reste ne contient que des espaces ou d'autres gardes, c'est une garde de fin
      const trailingIsOnlyGuards = /^(\s*\/[^/]+\/\s*)*$/.test(trailing);
      if (trailingIsOnlyGuards) {
        // Flag avec ou sans espaces internes : on accepte, convertGuardToBPS gère les deux.
        rhsFlags.unshift(gm[0]);
        cursor = gm.index;
      } else {
        break;
      }
    }
    stripped = rhsRaw.slice(0, cursor).trim();
  }

  const tokens = tokenizeBP3Line(stripped);
  const rhs = tokens.join(' ').trim();
  return { rhs, rhsFlags };
}

/**
 * Tokenise une ligne BP3 en tokens, en préservant les groupes (=...) (:...) {...}.
 * Retourne un tableau de strings.
 *
 * Note : on ne décompose PAS les groupes — ils sont retournés comme tokens atomiques
 * pour la détection des gardes et du scan.
 */
function tokenizeBP3Line(text) {
  const tokens = [];
  let i = 0;
  let cur = '';
  let depth = 0;

  function flush() {
    const t = cur.trim();
    if (t) tokens.push(t);
    cur = '';
  }

  while (i < text.length) {
    const c = text[i];
    if (c === '(' || c === '{') {
      if (depth === 0 && cur.trim()) flush();
      depth++;
      cur += c;
    } else if (c === ')' || c === '}') {
      depth--;
      cur += c;
      if (depth === 0) flush();
    } else if (depth === 0 && (c === ' ' || c === '\t')) {
      flush();
    } else {
      cur += c;
    }
    i++;
  }
  flush();
  return tokens.filter(t => t.length > 0);
}

/**
 * Extrait et retire le poids BP3 <...> en tête du tableau de tokens.
 */
function extractWeightToken(tokens) {
  if (tokens.length === 0) return null;
  const m = tokens[0].match(WEIGHT_RE);
  if (m) { tokens.shift(); return m[1]; }
  return null;
}

/**
 * Extrait et retire le scan (LEFT, RIGHT) en tête du tableau.
 */
function extractScanToken(tokens) {
  if (tokens.length > 0 && SCAN_KEYWORDS.has(tokens[0])) {
    return tokens.shift();
  }
  return null;
}

/**
 * Extrait et retire les gardes /.../ en tête du tableau.
 */
function extractGuardTokens(tokens) {
  const guards = [];
  while (tokens.length > 0 && GUARD_RE.test(tokens[0])) {
    guards.push(tokens.shift());
  }
  return guards;
}

/**
 * Parse la tête d'une règle nue BP2.
 * lhsPart : ce qui précède la flèche.
 */
function parseBareHead(lhsPart) {
  const tokens = tokenizeBP3Line(lhsPart);
  const weight = extractWeightToken(tokens);
  const scan = extractScanToken(tokens);
  const guards = extractGuardTokens(tokens);
  const lhs = tokens.join(' ').trim();
  return { weight, scan, lhsGuards: guards, lhs };
}

/**
 * Détecte une règle nue BP2 (sans gram#N[M]) sur la ligne.
 * Retourne { lhsRaw, arrow, rhs } ou null.
 */
function matchBareRule(line) {
  const m = findArrowInText(line);
  if (!m) return null;
  const lhsRaw = line.substring(0, m.start).trim();
  const rhs = line.substring(m.end).trim();
  return { lhsRaw, arrow: m.arrow, rhs };
}

// ─── Parsing de fichiers -ho ─────────────────────────────────────────────────

/**
 * Parse le contenu d'un fichier -ho.xxx BP3 et retourne un objet sections.
 *
 * Format réel des fichiers -ho :
 *   V.x.x          → header version, ignoré
 *   Date: ...      → header date, ignoré
 *   -mi.xxx        → référence fichier, ignorée
 *   -kb.xxx        → référence fichier, ignorée
 *   -or.xxx        → référence fichier, ignorée
 *   //             → commentaire, ignoré
 *   *              → label de section (nom = '*', trimé)
 *   Nom            → label de section nommé (une seule ligne, pas de -->)
 *   a --> b        → paire simple
 *   a --> b --> c  → chaîne déplié en a→b et b→c
 *   sync a b c...  → liste de sync, ignorée
 *   -----          → séparateur, ignoré
 *   ligne nue (terminal sans -->) → ignorée
 *
 * @param {string} hoText  Contenu brut d'un fichier -ho
 * @returns {{ sections: Object.<string, Object.<string, string>> }}
 */
function parseHoFile(hoText) {
  const lines = hoText.split('\n');
  const sections = {};
  let currentSection = '*';  // section par défaut si pas de label
  sections[currentSection] = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Ligne vide
    if (!line) continue;

    // Headers version/date → ignorés
    if (/^V\.\d/.test(line)) continue;
    if (/^Date:/.test(line)) continue;

    // Références fichiers (-mi., -kb., -or., -se., -al., -ho.) → ignorées
    if (/^-[a-z]{2}\./.test(line)) continue;

    // Commentaires //
    if (line.startsWith('//')) continue;

    // Séparateurs -----
    if (/^-{5,}$/.test(line)) continue;

    // sync ... → ignoré
    if (/^sync\b/.test(line)) continue;

    // Paire ou chaîne : contient -->
    if (line.includes('-->')) {
      // Découper sur -->
      const parts = line.split('-->').map(p => p.trim());
      // Expand en paires successives : a --> b --> c → (a,b) (b,c)
      for (let pi = 0; pi < parts.length - 1; pi++) {
        const src = parts[pi];
        const tgt = parts[pi + 1];
        if (src && tgt) {
          sections[currentSection][src] = tgt;
        }
      }
      continue;
    }

    // Label de section : ligne sans --> qui n'est pas un header/ref/sync/commentaire/séparateur
    // On accepte tout ce qui reste comme label de section (ex: '*', 'mineur', 'm1')
    const candidateLabel = line;  // déjà trimé
    // Vérifier que c'est un identifiant plausible (pas trop long, pas de caractères bizarres)
    // Les terminaux nus dans -ho sont ignorés (convention : lignes nues = sync identifiers)
    // On les traite comme labels de section si la section courante est vide,
    // sinon on démarre une nouvelle section.
    currentSection = candidateLabel;
    if (!sections[currentSection]) {
      sections[currentSection] = {};
    }
  }

  // Nettoyer les sections vides
  for (const key of Object.keys(sections)) {
    if (Object.keys(sections[key]).length === 0) {
      delete sections[key];
    }
  }

  return { sections };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export { bp3ToScene, parseHoFile };
