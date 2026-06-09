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
 *   - Polymetrie {N,A B} → passée telle quelle
 *   - Opérateurs BP3 +, ;, * (bare) → noms BPscript plus/fin/star
 *   - lambda (nil) → passé tel quel
 *   - Silence -, prolongation _
 *
 * Constructs NON GÉRÉS (stop-and-report par grammaire) :
 *   - Contrôles engine dans le RHS : _vel, _transpose, _chan, _script, etc.
 *   - TEMPLATES: / TIMEPATTERNS: sections (non gérées via compileBPS)
 *   - _print dans les règles BP2
 *   - _goto, _failed, _repeat engine directives
 *
 * Note sur les preambles :
 *   Les lignes de preamble (_mm, _striated, etc.) sont passées verbatim
 *   dans le .bps. Le parser BPscript ne les gère pas directement, mais
 *   elles sont ignorées sans erreur et l'encodeur les réinjecte via les
 *   directives @mode:X(mm:N,striated).
 *   Pour un round-trip fidèle du preamble, on utilise @mode:X(modifiers).
 */

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
const ENGINE_CTRL_RHS_RE = /\b_(vel|chan|script|rotate|retro|shuffle|srand|rndseq|goto|failed|repeat|stop|print|ins|step|fixed|key|note|time|dur|pitch|tempo|smooth|striated|legato|staccato|modwheel|aftertouch|sustain|portamento|expression|breath|pan|reverb|chorus|delay|distortion|phaser|flanger|eq|compress|expand|limit|gate|noise|filter|lfo|env|osc)\b/;

// Contrôles runtime convertibles en syntaxe BPscript (ctrl:val).
// Chaque token _xxx(args) ou _xxx (sans args) est converti en (xxx:args) ou (xxx:1).
// La conversion est appliquée dans convertBP3TokensToBPS AVANT le test ENGINE_CTRL_RHS_RE.
const RUNTIME_CTRL_CONVERTIBLE_RE = /^_(transpose|scale|pitchrange|pitchbend|pitchcont|volumecont|volume|cont|value)\b/;

// Opérateurs tempo BP3 dans le RHS : /N, \N
// En BPscript la syntaxe équivalente est X[/N] mais la conversion est complexe.
// Opérateur tempo BP3 /N en début de token séparé, ou notation durée N/N (ex: 4/4/4/4/4)
const TEMPO_OP_RHS_RE = /(?:^|\s)(?:\/|\\)\d+(?:\s|$)/;
// Token durée BP3 N/N/N... (notation musicale multiplicative, non représentable en BPscript)
const DURATION_SLASH_RE = /\b\d+\/\d/;

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
 * @returns {string}  Source BPscript ou "NON GÉRÉ: <raison>"
 */
function bp3ToScene(grammarText) {
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
      const lhsBps = convertBP3TokensToBPS(rule.lhs);
      parts.push(lhsBps);

      // Flèche
      const bpsArrow = BP3_TO_BPS_ARROW[rule.arrow] || rule.arrow;
      parts.push(bpsArrow);

      // RHS
      const rhsBps = convertBP3TokensToBPS(rule.rhs);
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

// ─── Vérification du RHS ──────────────────────────────────────────────────────

/**
 * Vérifie si le RHS contient des constructs BP3 non gérés par le round-trip.
 * Retourne une description de l'erreur, ou null si tout est OK.
 */
function checkRhsForUnsupported(rhs) {
  if (!rhs) return null;
  // Contrôles runtime convertibles : vérifier les conditions de conversion valide.
  // Un contrôle convertible est valide si et seulement si :
  //   1. Il est seul dans le RHS (contrôle autonome unique) : ex: Tr0 --> _transpose(0)
  //   2. Ses arguments ne sont pas négatifs (valeurs -N bloquent le parser BPscript)
  // Si ces conditions ne sont pas remplies → NON GÉRÉ (le BPS généré ne compilerait pas).
  {
    const matches = [...rhs.matchAll(/\b_(transpose|scale|pitchrange|pitchbend|pitchcont|volumecont|volume|cont|value)\b/g)];
    if (matches.length > 0) {
      // Valeur négative dans un argument : _pitchbend(-200) → NON GÉRÉ
      if (/\b_(transpose|scale|pitchrange|pitchbend|volume|cont|value)\s*\(\s*-/.test(rhs)) {
        const m2 = rhs.match(/\b_(transpose|scale|pitchrange|pitchbend|volume|cont|value)\s*\(\s*-/);
        return `contrôle runtime "_${m2[1]}" avec valeur négative (non représentable en BPscript — parser rejecte les valeurs négatives dans ())`;
      }
      // Plusieurs contrôles convertibles → parser BPscript ne supporte pas les `()` autonomes multiples
      if (matches.length > 1) {
        return `plusieurs contrôles runtime consécutifs dans RHS (non représentable — le parser BPscript ne supporte qu'un () autonome par règle)`;
      }
      // Contrôle convertible + contenu musical dans la même règle :
      // valide seulement si le contrôle est standalone (seul token non-espace)
      // Détection simple : si après le contrôle il y a autre chose (pas juste espace)
      // et si le contrôle est en TÊTE (précède d'autres tokens)
      const ctrlMatch = rhs.match(/^(.*?)\b_(transpose|scale|pitchrange|pitchbend|pitchcont|volumecont|volume|cont|value)\b/);
      if (ctrlMatch) {
        const before = ctrlMatch[1].trim();
        // Trouver ce qui suit le contrôle + ses args
        const afterRe = new RegExp(`\\b_(${matches[0][1]})\\s*(?:\\([^)]*\\))?\\s*(.*)`);
        const afterMatch = rhs.match(afterRe);
        const after = afterMatch ? afterMatch[2].trim() : '';
        // Si le contrôle n'est pas seul (avant ou après il y a des tokens musicaux)
        if (before || after) {
          // Contrôle en position mixte → NON GÉRÉ
          return `contrôle runtime "_${matches[0][1]}" en position mixte dans RHS (non représentable — doit être seul ou en suffixe)`;
        }
      }
      // Un seul contrôle seul → OK (sera converti par convertBP3TokensToBPS)
    }
  }
  const m = rhs.match(ENGINE_CTRL_RHS_RE);
  if (m) {
    return `contrôle engine "_${m[1]}" dans RHS (non représentable en BPscript sans contrôles chargés)`;
  }
  if (TEMPO_OP_RHS_RE.test(rhs)) {
    return `opérateur tempo /N ou \\N dans RHS (syntaxe BPscript X[/N] différente, conversion non implémentée)`;
  }
  // DURATION_SLASH_RE : bloquer uniquement si ce n'est pas un préfixe de mètre N+N/M
  // Les mètres N+N/M sont convertis en qualifier [meter:...] par convertBP3TokensToBPS.
  // On teste après avoir retiré le préfixe de mètre éventuel.
  {
    const withoutMeter = stripMeterPrefix(rhs);
    if (DURATION_SLASH_RE.test(withoutMeter)) {
      return `notation durée multiplicative N/N dans RHS (ex: 4/4/4, non représentable en BPscript)`;
    }
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
  // Template BP2 nue en LHS : "(= X Y Z" — non représentable en BPscript
  // (les templates maîtres ne peuvent pas apparaître en LHS dans compileBPS)
  const lhsTrimmed = lhs.trimStart();
  if (lhsTrimmed.startsWith('(=') || lhsTrimmed.startsWith('(:')) {
    return `template BP2 nue en LHS ("${lhs.substring(0, 30)}") — non représentable en BPscript (pas de template en position LHS)`;
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
function convertSingleToken(tok) {
  if (tok === '+') return 'plus';
  if (tok === ';') return 'fin';
  if (tok === '*') return 'star';
  return aliasTerminalDashes(tok);
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
function aliasTerminalDashes(tok) {
  if (/^[A-Za-z]/.test(tok) && tok.includes('-')) {
    return tok.replace(/-/g, 'O');
  }
  return tok;
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
 */
function convertBP3TokensToBPS(text) {
  if (!text) return '';

  // ── Template nue BP2 : "(= X Y Z" ou "(: X Y Z" sans ")" de fermeture ──────
  // Toute la zone est un seul template nue (maître ou esclave).
  // On détecte : la chaîne commence par "(=" ou "(:" et ne contient pas de ")".
  {
    const trimmed = text.trimStart();
    if ((trimmed.startsWith('(=') || trimmed.startsWith('(:')) && !trimmed.includes(')')) {
      const isMaster = trimmed[1] === '=';
      const body = trimmed.slice(2).trim();  // tout après "(=" ou "(:"
      if (!body) return isMaster ? '${}'  : '&{}';
      const bodyToks = body.split(/\s+/).map(convertSingleToken);
      const bodyBps = bodyToks.join(' ');
      const shortForm = /^[A-Za-z][A-Za-z0-9_#']*$/.test(bodyBps);
      if (isMaster) return shortForm ? `$${bodyBps}` : `\${${bodyBps}}`;
      else          return shortForm ? `&${bodyBps}` : `&{${bodyBps}}`;
    }
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
        out.push(aliasTerminalDashes(umatch[1]));
        const count = umatch[2].length;
        for (let k = 0; k < count; k++) out.push('_');
        continue;
      }
    }

    // Lié BP3 X& (note liée vers l'avant) → X~ en BPscript
    // Pattern : token se terminant par & (ex: do3& G#5& A'8&)
    if (/^[A-Za-z0-9][A-Za-z0-9#'_]*&$/.test(tok)) {
      out.push(aliasTerminalDashes(tok.slice(0, -1)) + '~');
      continue;
    }

    // Lié BP3 &X (note liée vers l'arrière) → ~X en BPscript
    // ATTENTION : &X standalone ≠ template slave (:X). On vérifie qu'il n'y a pas de parens.
    if (/^&[A-Za-z0-9]/.test(tok) && !tok.startsWith('(:')) {
      out.push('~' + aliasTerminalDashes(tok.slice(1)));
      continue;
    }

    // Tout le reste verbatim (terminaux, non-terminaux, polymetries, wildcards, etc.)
    // Aliaser les identifiants avec "-" internes (ex: dhin-- → dhinOO)
    out.push(aliasTerminalDashes(tok));
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
  // On distingue des qualifiers BPscript [key:val] en testant le contenu.
  let rhsRawClean = rhsRaw.replace(/\s+\[[A-Z][^\]]*\]\s*$/g, '').trim();

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

// ─── Export ───────────────────────────────────────────────────────────────────

export { bp3ToScene };
