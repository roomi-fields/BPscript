/**
 * LE CATALOGUE DES MESSAGES — une langue par fichier, un code par diagnostic.
 *
 * ⛔ CE FICHIER EST UNE SOURCE. Rien ne le génère, rien ne le périme : il EST la donnée. Le traduire
 * se fait en le copiant sous un autre nom de langue et en réécrivant les valeurs — les clés ne
 * bougent jamais, ce sont elles que les consommateurs opposent.
 *
 * ⛔ ET IL NE PORTE AUCUNE LOGIQUE. Les trous se remplissent par SUBSTITUTION, `{nom}` ; ce qui
 * demande un calcul se calcule au site du refus et arrive rempli. Un catalogue traduisible par
 * quelqu'un qui ne lit pas le code ne peut pas contenir de code.
 *
 * ⚠️ LES MESSAGES DU COMPILATEUR SONT EN ANGLAIS — décision de Romain, 2026-09-04. Ceux qui restent
 * en français sont marqués `[À TRADUIRE]` : la migration des textes les a rendus visibles, ce qu'un
 * balayage du code n'avait pas su faire.
 */
export const MESSAGES = {
  // ── LE DÉCOUPEUR ────────────────────────────────────────────────────────────────────────────
  // [À TRADUIRE]
  LEX_TEXT_UNCLOSED:
    'Texte ouvert à la ligne {line}, colonne {col} et jamais fermé — il avale tout ce qui suit, et '
    + 'la scène compile à vide. Un texte se ferme par un guillemet ; un guillemet À L\'INTÉRIEUR '
    + 'd\'un texte se double.',

  LEX_CODE_BLOCK_UNCLOSED:
    'A code block opened with {n} backtick{s} at line {line}, column {col} is never closed — it '
    + 'swallows everything that follows. Close it with the same run of {n} backtick{s}.',

  // [À TRADUIRE]
  LEX_NATIVE_ARROW:
    '\'{fleche}\' est la flèche du moteur historique, elle n\'existe pas en BPScript — la règle '
    + 's\'écrit avec \'->\'. Ce sont deux langages distincts : ce qui s\'écrit ainsi dans une '
    + 'grammaire native ne se recopie pas ici. (Un SILENCE en membre gauche, lui, reste permis : il '
    + 's\'écrit détaché, \'- V V -> …\'.) Ligne {line}, colonne {col}.',

  // [À TRADUIRE]
  LEX_UNEXPECTED_CHAR:
    'Caractère inattendu \'{ch}\' à la ligne {line}, colonne {col} — {aide}',

  // [À TRADUIRE]
  LEX_DOT_TRAILING:
    '\'{gauche}.\' : nom attendu après le point — il est collé à \'{gauche}\' et RIEN ne le suit, il '
    + 'n\'a donc rien à qualifier. Écrire le nom (\'{gauche}.<nom>\'), ou le détacher pour en faire '
    + 'une frontière (\'{gauche} .\'). Ligne {line}, colonne {col}.',

  // [À TRADUIRE]
  LEX_DOT_HALF_ATTACHED:
    '\'{ecrit}\' : le point est {cote}, et il ne dit alors ni l\'un ni l\'autre de ses deux rôles. '
    + 'COLLÉ des deux côtés il QUALIFIE le terme de gauche par celui de droite '
    + '(\'{gauche}.{droite}\') ; DÉTACHÉ des deux côtés il SÉPARE — frontière entre fragments de '
    + 'durée égale (\'{gauche} . {droite}\'). Écrire l\'une des deux. Ligne {line}, colonne {col}.',

  // ── L'ANALYSEUR ─────────────────────────────────────────────────────────────────────────────
  PARSE_ACTOR_ACTORNAME_BODY_OPENED:
    'actor \'{actorName}\': the body opened by \'(\' is not closed — \')\' is missing.',
  PARSE_ACTOR_ACTORNAME_KEY_DOES:
    'actor \'{actorName}\': this key does not exist. The output direction is written '
    + '\'out.<channel>\' — for example \'out.audio\' or \'out.midi(ch:3)\'.',
  PARSE_ACTOR_ACTORNAME_OUTPUT_OUTPUT:
    'actor \'{actorName}\': \'{p1}\' is not an output — the output channels are {p2}. The list is '
    + 'CLOSED.',
  PARSE_ACTOR_ACTORNAME_OUT_DOES:
    'actor \'{actorName}\': \'out.{p1}\' does not exist — the visual channel has been REMOVED '
    + '(embedded visuals output natively on their canvas). Output channel = audio/midi/osc only.',
  PARSE_ACTOR_ACTORNAME_OUT_REFUSED:
    'actor \'{actorName}\': \'out.{p1}\' is refused — this channel is a DESTINATION of the '
    + 'architecture, routed like the other outputs, but its WRITE from a scene still awaits its '
    + 'dedicated device.',
  PARSE_ACTOR_ACTORNAME_PRODUCER_EVAL:
    'actor \'{actorName}\': a producer \'eval.{p1}\' outputs natively — no \'out\' (it produces '
    + 'and outputs by its own means; its native output is not routed). Remove the \'out\' from this '
    + 'actor.',
  PARSE_ACTOR_ACTOR_TYPE_SCOPE:
    '\'actor {p1}\': \'actor\' is not a type in scope. It is an object of \'types\' — invoke '
    + '\'types\', \'core\', or a library that invokes \'types\'.',
  PARSE_ACTOR_SUBKEY_ACTOR_WORD:
    '\'actor.{subkey}\': \'actor\' is a word of the LANGUAGE, it is not qualified by a '
    + 'period{p1}. The period carries the DERIVATION of an actor, after its name: \'actor '
    + '<name>.<kind>\'.',
  PARSE_ALPHABET_SUBKEY_RUNTIME_REFUSED:
    '\'alphabet.{subkey}:{runtime}\' refused — the output shorthand of the implicit actor only '
    + 'accepts {audio, midi, osc} (closed positive list).{hint}',
  PARSE_ALPHABET_SUBKEY_RUNTIME_REFUSED_2:
    '\'alphabet.{subkey}:{runtime}\' refused — this channel is a DESTINATION of the architecture, '
    + 'routed like the other outputs, but its WRITE from a scene still awaits its dedicated device.',
  PARSE_ARGUMENT_TERM_TRANSFORMATION_ARGUMENT:
    '\'{p1}(…)\': the argument \'{p}\' is not a term. A transformation argument is a NAME (a '
    + 'terminal, a rule head), written bare.',
  PARSE_ATTACHED_TERM_CARRIES_CONJOINT:
    '\'!(…)\' attached to a term carries a CONJOINT flow, which travels with that term and '
    + 'replicates with it — a speed change does neither: it runs from where it is placed to the end '
    + 'of the field. It is detached by a space: \'… ! ({p1})\'',
  PARSE_BRACKET_ATTACHED_ELEMENT_LONGER:
    'a bracket ATTACHED to an element no longer exists: the bracket governs DERIVATION — a flag '
    + 'test, an assignment, a procedure (\'[goto:…]\', \'[repeat:…]\', \'[failed:…]\', \'[stop]\'), '
    + 'a template rank — and none of these places is an element suffix. An attached bag is written '
    + 'in PARENTHESES: \'…(shuffle)\', \'…(retro)\', \'…(vel:80)\'.',
  PARSE_BRACKET_PLACED_FLOW_BRACKET:
    'a bracket is NOT placed in the flow: the bracket governs DERIVATION — a guard, a flag '
    + 'assignment, a procedure, a template rank — and none of that applies at an instant. A control '
    + 'placed in the flow is written in PARENTHESES: \'!(shuffle)\', \'!(retro)\', \'!(vel:80)\'. '
    + '(Only \'![seed:N]\' remains, because it re-seeds the production and not the derivation.)',
  PARSE_CANAL_INPUT_INPUT_CHANNELS:
    '\'{canal}\' is not an input — the input channels are {p1}. The list is CLOSED.',
  PARSE_CANAL_MUST_NAME_ROLE:
    '\'in.{canal}\' must name the ROLE that the input holds — \'in.{canal} <role>\'. The type '
    + 'comes first, the name next.',
  PARSE_CANAL_REFUSED_INPUT_CARRIES:
    '\'in.{canal}(…)\' is refused — an input carries NO port name. A port name comes from the '
    + 'system and changes from machine to machine; the scene names a ROLE, the user associates the '
    + 'device, and the association lives outside the scene.',
  PARSE_CANAL_ROLENAME_CLE_MUST:
    'in.{canal} {roleName}: \'{cle}\' must CALL a component with a period (\'mapping.<table>\') — '
    + 'the period CALLS, the colon ASSIGNS.',
  PARSE_CANAL_ROLENAME_INPUT_CARRIES:
    'in.{canal} {roleName}: an input carries NO alphabet. There is nothing to resolve on input — '
    + 'the event is DISCRETE, not a signal to interpret. It is the TABLE (mapping.<name>) that '
    + 'declares the vocabulary the labels draw from, and it does so in a library, not in the scene.',
  PARSE_CANAL_ROLENAME_UNKNOWN_PROPERTY:
    'in.{canal} {roleName}: unknown property \'{cle}\' — an input declares its channel and, '
    + 'optionally, its table (\'mapping.<table>\'). Nothing else.',
  PARSE_CLE_VAL_ADDRESSES_CATALOG:
    '\'{cle}.{val}{p1}…\' addresses a catalog by TWO levels — only one is written. The period '
    + 'calls an ENTRY, never the structure that holds it: write \'{cle}.{p2}\' if \'{p3}\' is the '
    + 'entry wanted, or \'{cle}.{val}\' if it is \'{val}\'.',
  PARSE_CONTEXT_PLACED_EXTREMITIES_LEFT:
    'a CONTEXT is only placed at the EXTREMITIES of the left-hand side — at the front (\'(A) x B '
    + '-> …\') or at the tail (\'x B (A) -> …\'). Here it follows \'{p1}\' element(s) and precedes '
    + 'others: the engine does not know this place, and the tree produced would be readable by no '
    + 'one.',
  PARSE_DEFINED_PARAMETER_CALLED_HERE:
    '\'{p1}\' is defined with {p2} parameter(s) ({p3}) and is called here with {p4} argument(s). '
    + 'A transformation called wrongly would leave a parameter unsubstituted in the tree, in the '
    + 'form of a terminal that would sound.',
  PARSE_DEF_DEFNAME_CARRIES_CODE:
    '\'def {defName}\' carries CODE, not a structure — this stage reads "a name is worth a '
    + 'sequence of terms" (\'def cadence sa re ga pa\'). The typed code body (\'def {defName} '
    + '<type> \\`language: …\\`\', types \'signal\', \'pitch\', \'phase\', \'logic\') is NOT yet '
    + 'read; it is refused here rather than being read the wrong way — otherwise the type would '
    + 'become a terminal and the code a neighboring element.',
  PARSE_DEF_DEFNAME_CLE_NEITHER:
    '\'def {defName}\': \'{cle}\' is neither a component call nor an assignment. A terminal key '
    + 'is written \'{cle}.<name>\' to call a component, or \'{cle}:<value>\' to assign a value — '
    + 'the period calls, the colon assigns.',
  PARSE_DEF_DEFNAME_EMPTY_STRUCTURE:
    '\'def {defName}\': empty structure. A name worth nothing is not reinvoked.',
  PARSE_DEF_DEFNAME_NAME_EXPECTED:
    '\'def {defName}\': name expected after \'{cle}.\'',
  PARSE_DEF_DEFNAME_READABLE_VALUE:
    '\'def {defName}\': \'{p1}\' is not readable in the value of \'{cle}\'. A value is made of '
    + 'WORDS — a name, a number, a text in quotes, a ratio — and the space separates its parts. '
    + 'This sign opens a structure, and a structure is not placed in a value: write it in the body '
    + 'in parentheses of the declaration.',
  PARSE_DEF_DEFNAME_TRANSFORMATION_WITHOUT:
    '\'def {defName}({p1})\': transformation without a body. What the definition DOES with its '
    + 'parameters is written after them.',
  PARSE_DEF_DEFNAME_TYPED_CODE:
    '\'def {defName}\': typed code cannot follow another part in the value of \'{cle}\'. Typed '
    + 'code IS the value — write it alone after the colon.',
  PARSE_DEF_DEFNAME_VALUE_EXPECTED:
    '\'def {defName}\': value expected after \'{cle}:\'',
  PARSE_DIRECTIVE_NOM_SIGN_BEEN:
    '{directive} {nom}: the sign \'=\' has been REMOVED from the whole language — write '
    + '\'{directive} {nom} <value>\' with nothing between the two.',
  PARSE_DIRNOM_DECLARATION_SETTING_WRITTEN:
    '\'{dirNom}\' is not a declaration: it is a setting, and it is not written alone on a line. '
    + 'It applies {p1}.',
  PARSE_DIRNOM_WRITTEN_AFTER_RULES:
    '\'{dirNom}\' is written AFTER rules, and in this place it declares NOTHING: it was accepted '
    + 'then silently discarded. Declarations precede the rules — move this line up before the '
    + 'scene\'s first rule. (Only \'mode\' is placed here: it governs the sub-grammar that '
    + 'follows.)',
  PARSE_DURATION_ISOLATED_FLOW_STICKS:
    'duration isolated in the flow: \':N\' sticks to a terminal (A4:1/2), a group ({A B}:2) or '
    + 'the whole rule (at the end of the RHS) — never in the middle of the flow',
  PARSE_EXPANDS_WITHOUT_END_DEFINITION:
    '\'{p1}\' expands without end — a definition ends up invoking itself. A form that contains '
    + 'itself does not expand.',
  PARSE_EXPECTED_ARGUMENT_VALUE_NAME:
    'Expected argument value in \'{name}(…)\'',
  PARSE_EXPECTED_ARROW_GOT:
    'Expected arrow (-> <- <>), got {p1}',
  PARSE_EXPECTED_FLAG_VALUE:
    'Expected flag value',
  PARSE_EXPECTED_FLAG_VALUE_2:
    'Expected flag value',
  PARSE_EXPECTED_FLAG_VALUE_3:
    'Expected flag value',
  PARSE_EXPECTED_GOT:
    'Expected {p1}, got {p2} ({p3})',
  PARSE_EXPECTED_NUMBER_AFTER_PROP:
    'Expected number after - in prop value',
  PARSE_EXPECTED_SYMBOL_AFTER:
    'Expected symbol after ~',
  PARSE_EXPECTED_SYMBOL_AFTER_2:
    'Expected symbol, (...) or [...] after !',
  PARSE_EXPECTED_SYMBOL_AFTER_3:
    'Expected symbol after !',
  PARSE_EXPECTED_TEMPLATE:
    'Expected \'template\'',
  PARSE_EXPECTED_TYPE_GOT:
    'Expected {type}, got {p1} ({p2})',
  PARSE_EXPECTED_VALUE_AFTER_OPERATOR:
    'Expected value after operator',
  PARSE_EXPECTED_VALUE_INT_FLOAT:
    'Expected value (INT/FLOAT/STRING/IDENT) in prop pair',
  PARSE_FLAG_PREMIER_FLAG_CARRIES:
    'flag {premier}: a flag carries its initial value — \'flag {premier}:<integer>\'. That is the '
    + 'only form: neither the name alone, nor named states in parentheses. A flag counts and is '
    + 'compared to integers.',
  PARSE_FLAG_PREMIER_INITIAL_VALUE:
    'flag {premier}: the initial value is an INTEGER — \'flag {premier}:<integer>\'. A flag '
    + 'counts and is compared to integers.',
  PARSE_FORM_RESERVED_PRODUCTION_DIRECTIVE:
    'Form \'![@…]\' reserved (production directive in the flow) — not implemented',
  PARSE_GUARD_FLAG_MUTATION_WRITTEN:
    'guard \'[{flag}=…]\': \'=\' is a MUTATION, it is written at the end of the rule (\'S -> C4 '
    + '[{flag}=…]\'). To TEST the value of a flag before the LHS, compare with \'==\' '
    + '(\'[{flag}==…] S -> C4\')',
  PARSE_INIT_SUBKEY_INIT_WORD:
    '\'init.{subkey}\': \'init\' is a word of the LANGUAGE, it is not qualified by a period{p1}, '
    + 'and gathers what belongs to the whole scene: tagged code, or a bag of starting values.',
  PARSE_INTERVAL_QUOTES_SUPPORTED_CTRLNAME:
    'Interval in quotes not supported for \'{ctrlName}\': write the BARE form \'{p1}\' (without '
    + 'quotes) — an interval is written as a fraction (3/2), cents (700c) or a decimal (1.5)',
  PARSE_KEY_ACTOR_KEY_KEYS:
    '\'{key}.…\' is not an actor key{p1}{ou}. The keys of an actor are: {p2}',
  PARSE_KEY_ASSIGNS_VALUE_COLON:
    '\'({key}:)\' assigns no value — the colon expects one (for example \'({key}:{exemple})\')',
  PARSE_KEY_ASSIGNS_VALUE_COLON_2:
    '\'({key}:)\' assigns no value — the colon expects one (for example \'({key}:80)\'), and a '
    + 'control without an argument is written bare, without a colon. An EMPTY text is written '
    + '\'{key}:""\': the delimiter, with nothing inside',
  PARSE_KEY_ASSIGNS_VALUE_COLON_3:
    '\'[{key}:]\' assigns no value — the colon expects one (for example \'[{key}:3 0]\'), and a '
    + 'control without an argument is written bare, without a colon',
  PARSE_KEY_BRACKET_CARRIES_WHAT:
    '\'[{key}:…]\': the bracket carries only what governs DERIVATION — a flag test (\'[flag]\', '
    + '\'[flag==1]\'), an assignment (\'[flag=1]\'), a derivation procedure (\'[goto:…]\', '
    + '\'[repeat:…]\', \'[failed:…]\', \'[stop]\') or the rank of a template form (\'[3]\'). '
    + '\'{key}\' describes what the derivation PRODUCES: it is written in PARENTHESES .',
  PARSE_KEY_BRUT_BRUT_LEFT:
    '\'{key}:{brut}\': \'{brut}\' has LEFT the language — the requirement is read from the '
    + 'ABSENCE of a default, the multiplicity from the EXEMPLAR. Write \'{key}\' alone for a '
    + 'required member, or \'{key}()\' for a required collection; a value given after \':\' makes '
    + 'it an optional member for which it is the default.',
  PARSE_KEY_BRUT_COLON_ASSIGNS:
    '\'({key}:{brut})\': the colon ASSIGNS a value, it does not separate its parts — a pair '
    + 'carries only one. To name a numbered component, the period calls it (\'({key}.{p1}:{p2})\'); '
    + 'for several parts, the space separates them',
  PARSE_KEY_BRUT_KEY_EXPECTS:
    '\'({key}:{brut} {p1}…)\': \'{key}\' expects only ONE value, so \'{p1}\' is another ELEMENT '
    + 'of the bag — it is missing its COMMA (\'{key}:{brut}, {p1}…\'). The space only separates the '
    + 'PARTS of a single value',
  PARSE_KEY_BRUT_KEY_TAKES:
    '\'({key}:{brut})\': \'{key}\' takes NO argument — its declaration names none. Write '
    + '\'{key}\' alone. A value placed here would travel all the way to the runtime with no '
    + 'recipient, with nothing signaling it serves no purpose.',
  PARSE_KEY_COLON_ASSIGNS_VALUE:
    '\'[{key}: {p1}:…]\': the colon ASSIGNS a value, it does not separate its parts — a pair '
    + 'carries only one. The parts of a value are separated by a SPACE (\'[{key}:3 0]\')',
  PARSE_KEY_COMMA_SEPARATES_ELEMENTS:
    '\'[{key}: {p1},…]\': the comma separates the ELEMENTS of the bag, not the parts of a value '
    + '(positional list removed) — write \'[{key}:{p1} …]\', the parts separated by a SPACE',
  PARSE_KEY_COMPONENT_NAMES_COMPONENT:
    '\'{key}.{component}\' names a component without assigning it a value — \':value\' is missing '
    + '(example: \'({key}.{component}:45)\')',
  PARSE_KEY_COMPONENT_SPACE_AFTER:
    '\'{key}.{component}: \' — no space after the colon: the value begins immediately '
    + '(\'{key}.{component}:{p1}\')',
  PARSE_KEY_COMPOSANT_ASSIGNS_VALUE:
    '\'{key}.{composant}:…\' assigns a value to the component \'{composant}\' of \'{key}\' — but '
    + '\'{key}\' is neither an invoked library, nor a control with components, nor an instance '
    + 'declared in this scene. Declare the instance first: \'<module> {key}\'',
  PARSE_KEY_COMPOSANT_COMPOSANT_SCENE:
    '\'{key}.{composant}:…\' — \'{composant}\' is a SCENE directive: it is written at the top, '
    + 'before the delimiter, never in a parenthesis. The prefix changes nothing here, '
    + '\'{composant}:…\' bare is refused too.',
  PARSE_KEY_COMPOSANT_LIBRARY_KEY:
    '\'{key}.{composant}:…\' — the library \'{key}\' does not declare any control '
    + '\'{composant}\'. The prefix is correct, the control is not part of it.',
  PARSE_KEY_COMPOSANT_LIBRARY_KEY_2:
    '\'{key}.{composant}:…\' — the library \'{key}\' is indeed invoked, and it does not declare '
    + 'ANY control: nothing is assigned there through a parenthesis. The prefix is correct, the '
    + 'library is not one of those that carry controls.',
  PARSE_KEY_COMPOSANT_SPACE_AFTER:
    '\'{key}.{composant}: \' — no space after the colon: the value begins immediately '
    + '(\'{key}.{composant}:{p1}\')',
  PARSE_KEY_DECLARATIVE_PART_COMMA:
    '\'{key}:{p1} {p2}…\': in the DECLARATIVE part, only the comma separates — the space '
    + 'separates nothing there. A value has only ONE part; several parts are several values, and '
    + 'they are written with a parenthesis and names: \'{key}({p1}, {p2}…)\'. In the FLOW, after '
    + 'the delimiter, the space separates terms as before.',
  PARSE_KEY_ELEMENTS_BAG_SEPARATED:
    '\'({key}:… {p1}:…)\': two ELEMENTS of the bag separated by a SPACE — they are missing a '
    + 'COMMA (\'({key}:…, {p1}:…)\'). The space only separates the PARTS of a single value',
  PARSE_KEY_ELEMENTS_BAG_SEPARATED_2:
    '\'[{key}:… {p1}:…]\': two ELEMENTS of the bag separated by a SPACE — they are missing a '
    + 'COMMA (\'[{key}:…, {p1}:…]\'). The space only separates the PARTS of a single value',
  PARSE_KEY_KEY_RUNTIME_CONTROL:
    '\'[{key}:…]\': \'{key}\' is a RUNTIME control, it is written in PARENTHESES — \'({key}:…)\', '
    + 'or \'!({key}:…)\' to place it in the flow. Brackets are addressed to the ENGINE',
  PARSE_KEY_KEY_SETTING_WRITTEN:
    '\'[{key}:…]\': \'{key}\' is a setting, it is written in PARENTHESES — \'({key}:…)\' . The '
    + 'bracket now carries only what governs the derivation itself: a flag test (\'[flag]\', '
    + '\'[flag==1]\'), an assignment (\'[flag=1]\'), or the rank of a template form (\'[3]\')',
  PARSE_KEY_KEY_WRITTEN_RULE:
    '\'{p1}{key}:…{p2}\': \'{key}\' is not written in a rule — the speed multiplier IS the '
    + 'operator, and it is placed in the flow: \'! (/N)\' slows down, \'! (*N/M)\' writes the same '
    + 'thing in inverse fraction. The scene\'s metronome, on the other hand, is written at the top: '
    + '\'tempo:120\'',
  PARSE_KEY_NAMES_NUMBERED_COMPONENT:
    '\'{key}.…\' names a NUMBERED component: it expects a number, not \'{p1}\' (example: '
    + '\'({key}.98:45)\'). Controllers that have a name are written by their name',
  PARSE_KEY_SPACE_AFTER_COLON:
    '\'{key}: \' — no space after the colon: the value begins immediately (\'{key}:{p1}…\'). The '
    + 'space only separates the PARTS of a value',
  PARSE_KEY_SPACE_AFTER_COLON_2:
    '\'{key}: \' — no space after the colon: the value begins immediately (\'{key}:{p1}…\'). The '
    + 'space only separates the PARTS of a value',
  PARSE_MACRO_MACRONAME_PARAMETER_DECLARED:
    'Macro \'{macroName}\': parameter(s) declared but absent from the body: {p1}. A macro is a '
    + 'textual substitution (EBNF §macro l.59/273) — each parameter MUST appear in the body (e.g. '
    + 'accent(x) = x(vel:120)). A declaration name(target, transport) = curve (CV/signal form) is '
    + 'not a valid macro: syntax pending arbitration.',
  PARSE_MALFORMED_CONTROL_ARGUMENT_NAME:
    'malformed control argument in \'{name}(…)\': \'{arg} {p1}\' — two values follow each other '
    + 'without a separator. A control takes arguments separated by \',\'; it does not take a '
    + 'sentence (the generic function \'script(…)\' has been removed from the language)',
  PARSE_MALFORMED_INTERVAL_CTRLNAME_EXPECTED:
    'Malformed interval for \'{ctrlName}\'{p1} — expected a fraction (3/2), cents (700c) or a '
    + 'decimal (1.5)',
  PARSE_MODE_ECRIT_ECRIT_DERIVATION:
    '\'mode:{ecrit}\': \'{ecrit}\' is not a derivation mode — the modes are {p1}. The list is CLOSED.',
  PARSE_MODE_EXPECTS_DERIVATION_MODE:
    '\'mode\' expects the derivation mode it sets — \'mode:<mode>\'. Written alone, it governs '
    + 'NOTHING: the sub-grammar keeps the mode it had, and the line disappears without a trace. The '
    + 'modes are {p1}.',
  PARSE_MODE_MODNAME_MODNAME_DECLARED:
    '\'mode:{p1}({modName})\': \'{modName}\' is not declared by any invoked library. A '
    + 'sub-grammar modifier is a library word like any other — {p2}.',
  PARSE_MODNAME_DOES_APPLY_SUB:
    '\'{modName}\' does not apply to a sub-grammar — its declared scope is {p1}. {p2}',
  PARSE_MOTDECLARANT_MUST_NAME_WHAT:
    '\'{motDeclarant}\' must name what it defines: \'{motDeclarant} <name> <body>\'. The name '
    + 'comes first, what it is worth next — like \'actor\'. A NAME STARTS WITH A LETTER, or with a '
    + 'digit if it carries at least one letter: \'western\', \'a_b\', \'12TET\' are ones; \'12\', '
    + '\'_ab\', \'#a\', \'-ab\' and \'"ab"\' are not. Received: {p1}.',
  PARSE_MOT_MOT_TYPE_SCOPE:
    '\'{mot} {p1}\': \'{mot}\' is not a type in scope. A type in front is an object in scope — '
    + 'declared by the scene, or brought by a library invoked at the top (the base lives in '
    + '\'types\') — or in.<channel>.',
  PARSE_MOT_MUST_NAME_WHAT:
    '\'{mot}\' must name what it declares — the type comes first, the name next (\'{mot} <name>\').',
  PARSE_MOT_NOM_STARTING_VALUE:
    '{mot} {nom}: a starting value STICKS to its sign — \'{nom}:<value>\', never \'{nom}: '
    + '<value>\'. The space separates two terms, sticking them together joins them.',
  PARSE_MOT_NOM_STARTING_VALUE_2:
    '{mot} {nom}: a starting value is placed after \':\' — a number or a name. Received \'{p1}\'.',
  PARSE_NAME_ADDRESS_FOLLOWED_SEPARATOR:
    '\'<!{name}.{p1}{p2}\': the address is FOLLOWED BY \'{p2}\' with no separator. An address is '
    + 'A SINGLE token — an identifier (\'<!{name}.next\') or an integer (\'<!{name}.60\'). Separate '
    + 'with a space what must be a distinct term.',
  PARSE_NAME_BARE_FORM_FLOW:
    '\'{name}\' has no bare form in the flow — {commentEcrire}. A word of the vocabulary '
    + 'encountered where it cannot be is refused; it does not disappear.',
  PARSE_NAME_ECRIT_PRODUCTION_DIRECTIVE:
    '\'[{name}{ecrit}]\': a production directive is written at the top of the scene, before the '
    + 'delimiter — \'{name}{ecrit}\'. A block that grouped several keys is rewritten as that many '
    + 'lines. The bracket carries what belongs to DERIVATION: a flag, a procedure, a rank.',
  PARSE_NAME_FOLLOWED_ADDRESS_ADDRESS:
    '\'<!{name}.\' followed by \'{p1}\': this is not an address. An address is an identifier '
    + '(\'<!{name}.next\') or an integer (\'<!{name}.60\'), attached to the period on both sides. '
    + 'Without an address, write \'<!{name}\' alone — the wait then lifts on any event of that '
    + 'role, and that is a different form, not a shortcut.',
  PARSE_NAME_NAME_BETWEEN_BARS:
    '\'|{name}|\': the name between bars has left the language — write \'{name}\' bare. The form '
    + 'remains readable on BP3 input, it is no longer written in a BPScript scene. ⚠️ Check that no '
    + 'terminal of the alphabet in scope is already named \'{name}\': the bars used to distinguish '
    + 'the non-terminal, the bare name no longer does.',
  PARSE_NAME_READABLE_NEITHER_SETTING:
    '\'{name}({p1})\' is readable neither as a SETTING BAG — its content is not made of '
    + '\'key:value\' pairs — nor as a CALL: calling requires a declared definition, and none '
    + 'carries the name \'{name}\'. To set \'{name}\', write \'{name}(key:value)\'; to call it, '
    + 'declare it first with \'def {name}(x) …\'',
  PARSE_NAME_REFUSED_DOES_ASSIGN:
    '\'{name}:<X>\' refused — \':\' does not assign a value to a component. Write '
    + '\'{name}.<name>\' (rule: \':\' assigns, \'.\' calls){hint}.',
  PARSE_NAME_SEED_MAKES_SENSE:
    '\'![{name}…]\': only \'seed\' makes sense in the flow (re-seed _srand); \'{name}\' is placed '
    + 'at the top of the scene, \'{name}\'.',
  PARSE_NOMDECLARE_SPACE_BETWEEN_DECLARED:
    '\'{nomDeclare} (…)\': a space between a declared word and its bag separates them into two '
    + 'terms — a bag is attached to the word it describes. Write \'{nomDeclare}(…)\'.',
  PARSE_NOM_CARRIES_ATTACHED_SETTING:
    '{nom} carries TWO attached setting bags — an element carries only one. Merge the pairs into '
    + 'the same bag: the comma separates them, \'(key:value, key:value)\'. The two forms already '
    + 'said the same thing; this one no longer is one.',
  PARSE_NOM_NUMBER_NAME_NAME:
    '\'{nom}\' is a NUMBER, not a name. A name that starts with a digit carries at least one '
    + 'letter — \'12TET\' and \'22shruti\' are names, \'{nom}\' is not one.',
  PARSE_NOM_SEEDING_MAKES_SENSE:
    '\'![{nom}…]\': only re-seeding makes sense in the flow, and it is written \'![seed:N]\'; '
    + '\'{nom}\' is placed at the top of the scene, \'{nom}\'.',
  PARSE_NOTHING_COMES_BETWEEN_WAIT:
    '\'<! {p1}\': nothing comes between the wait point and what it waits for — they form a single '
    + 'term. Write \'<!{p1}\'.',
  PARSE_NUMBERED_WILDCARD_MAKES_SENSE:
    '\'?{p1}\': a numbered wildcard only makes sense in a rule (the number unifies with the '
    + 'arrow, which replays the choice). A @template catalog line has no arrow — its wildcards are '
    + 'always anonymous (\'?\'), never numbered.',
  PARSE_NUM_DEN_NUMBERS_TOUCH:
    '\'{num}/{den}/…\': two numbers touch, and nothing says where the first ends — '
    + '\'{num}/{den}\' followed by an attached digit can be read \'{num}\' then \'{p1}…\', or '
    + 'otherwise. Numbers are never juxtaposed: separate with a SPACE',
  PARSE_OBJECT_OBJECT_LEFT_LANGUAGE:
    '\'object {p1}\': \'object\' has LEFT the language — the root of a family is declared with '
    + '\'def {p1}(…)\', and an instance by its type in front (\'{p1} <name>(…)\'). Only one word '
    + 'declares: \'def\'.',
  PARSE_OPERATOR_EXPECTS_NUMBER_FRACTION:
    '\'! ({operator}…)\' expects a number or a fraction — \'! (/2)\', \'! (*3/2)\', \'! (/1.5)\'',
  PARSE_OUT_SUBKEY_REFUSED_CHANNEL:
    '\'out.{subkey}\' is refused — this channel is a DESTINATION of the architecture, routed like '
    + 'the other outputs, but its WRITE from a scene still awaits its dedicated device.',
  PARSE_PLACED_BARE_WITHOUT_ARGUMENTS:
    '\'{p1}\' is {p2}: it is placed BARE, without arguments. Write \'{p1}\'. A parameter list is '
    + 'declared with the name (\'def {p1}(x) …\'), and only then does the call carry any.',
  PARSE_PRODUCTION_BLOCK_ALLOWED_TOP:
    'Production block [@…]: allowed at the top of the scene only',
  PARSE_REFUSED_INPUT_DECLARES_CHANNEL:
    '\'in {p1}\' is refused — an input declares its CHANNEL: \'in.<channel> {p1}\'. The input '
    + 'channels are {p2}. Without it, no runtime is addressed and nothing triggers.',
  PARSE_RHS_PARSE_LOOP_SAFETY:
    'RHS parse loop safety limit',
  PARSE_RULE_LEVEL_PROCEDURE_PLACED:
    '\'![{p1}: …]\': \'{p1}\' is a RULE-level procedure, it is not placed in the flow — it '
    + 'applies to the whole rule. Write \'[{p1}:{p2}]\' as a rule suffix. In the flow, it never '
    + 'reaches the rule and leaves an inert control token in the production',
  PARSE_RULE_PARSE_LOOP_SAFETY:
    'Rule parse loop safety limit',
  PARSE_RULE_WRITTEN_BEFORE_DELIMITER:
    'a rule is written BEFORE the delimiter: the line \'-----\' is missing between the '
    + 'declarative part and the production. Since the at-sign left the language, it is POSITION '
    + 'that qualifies a line — before the \'-----\' it declares, after it produces.',
  PARSE_SCALE_BEEN_REMOVED_TEMPORAL:
    '\'[scale:N]\' has been REMOVED — the temporal scaling of a group is written with the '
    + 'ATTACHED DURATION: \'{A B}:N\'. (Not to be confused with the microtonal scale, which is a '
    + 'runtime control: \'(scale:name key)\'.)',
  PARSE_SCAN_UNKNOWN_VALUE_EXPECTED:
    '(scan:{p1}): unknown value (expected: {p2})',
  PARSE_SEED_SEEDING_FLOW_WRITTEN:
    '\'![seed:N]\': re-seeding in the flow is written WITHOUT the at-sign — \'![seed:N]\'. The '
    + 'bracket carries what governs the derivation, and re-seeding is such a procedure; the at-sign '
    + 'remains at the top of the scene, where \'seed:N\' sets the production.',
  PARSE_SHUFFLE_REMOVED_SEED_WRITTEN:
    '\'[shuffle:N]\' removed — the seed is written \'seed:N\' (at the top of the scene) or '
    + '\'![seed:N]\' (in the flow); \'[shuffle]\' shuffles alone',
  PARSE_SIGIL_NOM_PLACE_ARGUMENTS:
    '\'{sigil}{nom}(…{p1}…)\': \'{p1}\' has no place in the arguments of a template — they are '
    + 'written \'name:value\', separated by commas. To place a SETTING on the rule, a SPACE '
    + 'detaches it from the template (\'{sigil}{nom} ({p2}:…)\'); for a SPEED, which is not a pair, '
    + 'the exclamation mark places it in the flow (\'{sigil}{nom} ! (*2/3)\')',
  PARSE_SIGNE_SPEED_OPERATOR_WRITTEN:
    '\'[{signe}N]\': the speed operator is written in PARENTHESES and placed in the FLOW — \'! '
    + '({signe}N)\'. It lives nowhere else: neither as a rule suffix, nor attached to an element. '
    + '\'/N\' speeds up, \'*N/M\' writes the same thing in inverse fraction',
  PARSE_SIGN_LEFT_LANGUAGE_WRITE:
    'the at-sign has LEFT the language — write \'{p1}\' without it. What qualifies a line is its '
    + 'POSITION: before the \'-----\' it declares, after it produces.',
  PARSE_SIGN_READABLE_MEMBER_MEMBER:
    'the sign \'{p1}\' is not readable in a member: a member is a name, a number or a text in '
    + 'quotes. The members already read are \'{p2}\'.',
  PARSE_SOUND_REFUSED_DOES_ASSIGN:
    '\'sound:<X>\' refused — \':\' does not assign a value to a component. Write \'sound.<name>\' '
    + '(rule: \':\' assigns, \'.\' calls).',
  PARSE_SPEED_BEEN_REMOVED_DURATION:
    '\'[speed:N]\' has been removed — duration is written with \':\': \'{A B}:2\' (group), '
    + '\'A4:1/2\' (note) or \'}:N\' (embedding)',
  PARSE_STUCK_IDENTIFIER_FORBIDDEN_LHS:
    '"$" stuck to an identifier is forbidden in LHS — use "$ " (dollar isolated with a space)',
  PARSE_SUBGRAMMAR_PARSE_LOOP_SAFETY:
    'Subgrammar parse loop safety limit',
  PARSE_SUBKEY_OUTPUT_OUTPUT_CHANNELS:
    '\'{subkey}\' is not an output — the output channels are {p1}. The list is CLOSED.',
  PARSE_SUFFIX_NOM_ATTACHED_ELEMENT:
    'the suffix \'{nom}\' attached to an element has been REMOVED from the language. Two forms '
    + 'replace it, depending on what was intended. To ASSOCIATE a gesture with an element IN THE '
    + 'PRODUCTION: the exclamation mark, \'C4!{nom}\' — the gesture triggers at the instant of the '
    + 'terminal without occupying a step. To DECLARE A LABEL: the declarative part, with \'def\'.',
  PARSE_TEMPLATES_PLURAL_LONGER_EXISTS:
    '\'templates\' (plural, v0.7) no longer exists — write \'template\' (singular)',
  PARSE_TEMPLATE_CATALOG_TRANSPORTED_VERBATIM:
    'the template catalog is transported VERBATIM: the parser needs the SOURCE to render the line '
    + 'as it is written. The caller must pass \'source\' to parse().',
  PARSE_TERMINAL_DEFNAME_BODY_OPENED:
    '\'terminal {defName}\': the body opened by \'(\' is not closed — \')\' is missing.',
  PARSE_TERMINAL_DEFNAME_TERMINAL_DECLARED:
    '\'terminal {defName}\': a terminal is declared by its KEYS — \'voice.<name>\', \'hz:<n>\', '
    + '\'degree:<n>\', \'register:<n>\', \'sounding:<true|false>\', \'duration:<n>\', '
    + '\'tuning.<name>\', \'octaves.<name>\'. A sequence of terms is a STRUCTURE, and it is written '
    + '\'def {defName} <terms>\'.',
  PARSE_TERMS_SEPARATED_SPACE_BEFORE:
    'two terms are separated by a space: before the delimiter, only the comma separates — the '
    + 'space separates nothing there, it is formatting. Write \'{p1}, {p2}\'.',
  PARSE_TRANSFORMATION_ARGUMENT_GIVEN_POSITION:
    '\'{p1}(…)\': a transformation argument is given by POSITION, never by name — received '
    + '\'{p2}:\'. Write \'{p1}({p3})\', the parameters in the order of the definition ({p4}).',
  PARSE_TRANSFORMATION_CALLED_ARGUMENTS_WRITE:
    '\'{p1}\' is a transformation on {p2}: it is called with its arguments. Write \'{p1}({p3})\'. '
    + 'Placed bare, the name would come out of the tree as a terminal and sound.',
  PARSE_UNEXPECTED_TOKEN_CONTROL_ARGS:
    'Unexpected token {p1} ({p2}) in control args',
  PARSE_UNKNOWN_KEY_KEY_NEITHER:
    'unknown key \'[{key}:…]\' — neither a library control, a guard, an assignment, nor a '
    + 'template rank; check the spelling, or the library that declares it. \'[{key}:…]\' and '
    + '\'![{key}:…]\' (engine control) are NOT interchangeable with \'({key}:…)\' (runtime '
    + 'parameter)',
  PARSE_UNRECOGNIZED_LINE_RULE_LEVEL:
    'unrecognized line at rule level: expected a rule, \'directive\', \'-----\' or the end of the '
    + 'scene',
  PARSE_VALUE_DIRNAME_READS_ECRIT:
    'the value of \'{dirName}\' reads \'{ecrit}\', and \'{reste}\' remains stuck to it without '
    + 'being read as part of it. A directive value is BARE: a number, a ratio (\'3/4\'), or a name. '
    + 'Remove \'{reste}\' if it is a unit — no directive carries one — or space it out if what '
    + 'follows is something else.',
  PARSE_VALUE_EXPECTED_AFTER:
    'value expected after ":"',
  PARSE_VALUE_EXPECTED_AFTER_PARAMKEY:
    'value expected after \'{paramKey}:\'',
  PARSE_WHERE_UNKNOWN_VOICE_NAME:
    '{where}: unknown voice \'{name}\' — no entry \'{name}\' in the catalog of the \'voice\' word '
    + '(LANG-SONS §3).',
  PARSE_WHERE_VOICE_NAME_INVALID:
    '{where}: voice \'{name}\' — invalid \'audio\' realization in the catalog of the \'voice\' '
    + 'word: a TYPED backtick is required (\\`js: …\\`, \\`faust: …\\`); received {p1}.',
  PARSE_COLON_ON_COMPONENT:
    '\'{key}:…\' refused — \':\' does not assign a value to a component. Write '
    + '\'{canon}.<name>\'{params} (rule: \'.\' CALLS the component, \':\' ASSIGNS a value).',
  PARSE_DECLARES_NOTHING:
    '{arret}\'{motDeclarant} {defName}\' declares nothing. This stage reads TWO bodies: the '
    + 'TERMINAL DECLARATION — a name then its keys, on the same line (\'def {defName}  voice.sec\') '
    + 'or in an indented block, one key per line — and the STRUCTURE, a name that is worth a '
    + 'sequence of terms (\'def {defName} sa re ga pa\'). The other bodies the specification '
    + 'describes — a wiring, typed code, a preset, a parameterized or structural transformation — '
    + 'are NOT yet read; they will be, and until then they are refused here rather than being read '
    + 'the wrong way.',
  PARSE_FLAG_USAGES_DESIGNATE_NOTHING:
    '{cri}',
  PARSE_FLOW_WORD_NOT_IN_SCOPE:
    '\'![{nom}:…]\': \'{nom}\' is not in scope: no invoked library declares it — invoke it at the '
    + 'top ({declarants}).',
  PARSE_FLOW_WORD_UNDECLARED:
    '\'![{nom}:…]\': \'{nom}\' is not declared by any library. The re-seeding in the flow '
    + 'translates the native \'_srand(N)\', and the word that carries it comes from a library like '
    + 'all the others.',
  PARSE_NATIVE_UNDERSCORE_FORM:
    'the form "_{nom}(…)" is that of the native BP3 engine, it does not belong to BPScript — '
    + 'write "!({cle}:…)" instead{renomme}',

  // ── L'ÉTAGE DE RÉSOLUTION ───────────────────────────────────────────────────────────────────
  // [À TRADUIRE]
  RESOLVE_REMOTE_CONTEXT_MID_PATTERN:
    'contexte distant en milieu de motif (autorisé : début ou fin de LHS)',
  PARSE_CALL_FORM_DOES_NOT_EXIST:
    'the call form \'{name}({sac})\' does not exist in BPScript — write \'{flux}\' to place it '
    + 'in the flow, or \'{contenance}\' as containment. The colon ASSIGNS the value, the space '
    + 'separates its parts (\'[goto:3 0]\'), the comma separates the elements of the bag '
    + '(\'(vel:80, pan:64)\')',
};
