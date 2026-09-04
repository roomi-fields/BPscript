// src/transpiler/messages/en.js
var MESSAGES = {
  // ── LE DÉCOUPEUR ────────────────────────────────────────────────────────────────────────────
  // [À TRADUIRE]
  LEX_TEXT_UNCLOSED: "Texte ouvert \xE0 la ligne {line}, colonne {col} et jamais ferm\xE9 \u2014 il avale tout ce qui suit, et la sc\xE8ne compile \xE0 vide. Un texte se ferme par un guillemet ; un guillemet \xC0 L'INT\xC9RIEUR d'un texte se double.",
  LEX_CODE_BLOCK_UNCLOSED: "A code block opened with {n} backtick{s} at line {line}, column {col} is never closed \u2014 it swallows everything that follows. Close it with the same run of {n} backtick{s}.",
  // [À TRADUIRE]
  LEX_NATIVE_ARROW: "'{fleche}' est la fl\xE8che du moteur historique, elle n'existe pas en BPScript \u2014 la r\xE8gle s'\xE9crit avec '->'. Ce sont deux langages distincts : ce qui s'\xE9crit ainsi dans une grammaire native ne se recopie pas ici. (Un SILENCE en membre gauche, lui, reste permis : il s'\xE9crit d\xE9tach\xE9, '- V V -> \u2026'.) Ligne {line}, colonne {col}.",
  // [À TRADUIRE]
  LEX_UNEXPECTED_CHAR: "Caract\xE8re inattendu '{ch}' \xE0 la ligne {line}, colonne {col} \u2014 {aide}",
  // [À TRADUIRE]
  LEX_DOT_TRAILING: "'{gauche}.' : nom attendu apr\xE8s le point \u2014 il est coll\xE9 \xE0 '{gauche}' et RIEN ne le suit, il n'a donc rien \xE0 qualifier. \xC9crire le nom ('{gauche}.<nom>'), ou le d\xE9tacher pour en faire une fronti\xE8re ('{gauche} .'). Ligne {line}, colonne {col}.",
  // [À TRADUIRE]
  LEX_DOT_HALF_ATTACHED: "'{ecrit}' : le point est {cote}, et il ne dit alors ni l'un ni l'autre de ses deux r\xF4les. COLL\xC9 des deux c\xF4t\xE9s il QUALIFIE le terme de gauche par celui de droite ('{gauche}.{droite}') ; D\xC9TACH\xC9 des deux c\xF4t\xE9s il S\xC9PARE \u2014 fronti\xE8re entre fragments de dur\xE9e \xE9gale ('{gauche} . {droite}'). \xC9crire l'une des deux. Ligne {line}, colonne {col}.",
  // ── L'ANALYSEUR ─────────────────────────────────────────────────────────────────────────────
  PARSE_ACTOR_ACTORNAME_BODY_OPENED: "actor '{actorName}': the body opened by '(' is not closed \u2014 ')' is missing.",
  PARSE_ACTOR_ACTORNAME_KEY_DOES: "actor '{actorName}': this key does not exist. The output direction is written 'out.<channel>' \u2014 for example 'out.audio' or 'out.midi(ch:3)'.",
  PARSE_ACTOR_ACTORNAME_OUTPUT_OUTPUT: "actor '{actorName}': '{p1}' is not an output \u2014 the output channels are {p2}. The list is CLOSED.",
  PARSE_ACTOR_ACTORNAME_OUT_DOES: "actor '{actorName}': 'out.{p1}' does not exist \u2014 the visual channel has been REMOVED (embedded visuals output natively on their canvas). Output channel = audio/midi/osc only.",
  PARSE_ACTOR_ACTORNAME_OUT_REFUSED: "actor '{actorName}': 'out.{p1}' is refused \u2014 this channel is a DESTINATION of the architecture, routed like the other outputs, but its WRITE from a scene still awaits its dedicated device.",
  PARSE_ACTOR_ACTORNAME_PRODUCER_EVAL: "actor '{actorName}': a producer 'eval.{p1}' outputs natively \u2014 no 'out' (it produces and outputs by its own means; its native output is not routed). Remove the 'out' from this actor.",
  PARSE_ACTOR_ACTOR_TYPE_SCOPE: "'actor {p1}': 'actor' is not a type in scope. It is an object of 'types' \u2014 invoke 'types', 'core', or a library that invokes 'types'.",
  PARSE_ACTOR_SUBKEY_ACTOR_WORD: "'actor.{subkey}': 'actor' is a word of the LANGUAGE, it is not qualified by a period{p1}. The period carries the DERIVATION of an actor, after its name: 'actor <name>.<kind>'.",
  PARSE_ALPHABET_SUBKEY_RUNTIME_REFUSED: "'alphabet.{subkey}:{runtime}' refused \u2014 the output shorthand of the implicit actor only accepts {audio, midi, osc} (closed positive list).{hint}",
  PARSE_ALPHABET_SUBKEY_RUNTIME_REFUSED_2: "'alphabet.{subkey}:{runtime}' refused \u2014 this channel is a DESTINATION of the architecture, routed like the other outputs, but its WRITE from a scene still awaits its dedicated device.",
  PARSE_ARGUMENT_TERM_TRANSFORMATION_ARGUMENT: "'{p1}(\u2026)': the argument '{p}' is not a term. A transformation argument is a NAME (a terminal, a rule head), written bare.",
  PARSE_ATTACHED_TERM_CARRIES_CONJOINT: "'!(\u2026)' attached to a term carries a CONJOINT flow, which travels with that term and replicates with it \u2014 a speed change does neither: it runs from where it is placed to the end of the field. It is detached by a space: '\u2026 ! ({p1})'",
  PARSE_BRACKET_ATTACHED_ELEMENT_LONGER: "a bracket ATTACHED to an element no longer exists: the bracket governs DERIVATION \u2014 a flag test, an assignment, a procedure ('[goto:\u2026]', '[repeat:\u2026]', '[failed:\u2026]', '[stop]'), a template rank \u2014 and none of these places is an element suffix. An attached bag is written in PARENTHESES: '\u2026(shuffle)', '\u2026(retro)', '\u2026(vel:80)'.",
  PARSE_BRACKET_PLACED_FLOW_BRACKET: "a bracket is NOT placed in the flow: the bracket governs DERIVATION \u2014 a guard, a flag assignment, a procedure, a template rank \u2014 and none of that applies at an instant. A control placed in the flow is written in PARENTHESES: '!(shuffle)', '!(retro)', '!(vel:80)'. (Only '![seed:N]' remains, because it re-seeds the production and not the derivation.)",
  PARSE_CANAL_INPUT_INPUT_CHANNELS: "'{canal}' is not an input \u2014 the input channels are {p1}. The list is CLOSED.",
  PARSE_CANAL_MUST_NAME_ROLE: "'in.{canal}' must name the ROLE that the input holds \u2014 'in.{canal} <role>'. The type comes first, the name next.",
  PARSE_CANAL_REFUSED_INPUT_CARRIES: "'in.{canal}(\u2026)' is refused \u2014 an input carries NO port name. A port name comes from the system and changes from machine to machine; the scene names a ROLE, the user associates the device, and the association lives outside the scene.",
  PARSE_CANAL_ROLENAME_CLE_MUST: "in.{canal} {roleName}: '{cle}' must CALL a component with a period ('mapping.<table>') \u2014 the period CALLS, the colon ASSIGNS.",
  PARSE_CANAL_ROLENAME_INPUT_CARRIES: "in.{canal} {roleName}: an input carries NO alphabet. There is nothing to resolve on input \u2014 the event is DISCRETE, not a signal to interpret. It is the TABLE (mapping.<name>) that declares the vocabulary the labels draw from, and it does so in a library, not in the scene.",
  PARSE_CANAL_ROLENAME_UNKNOWN_PROPERTY: "in.{canal} {roleName}: unknown property '{cle}' \u2014 an input declares its channel and, optionally, its table ('mapping.<table>'). Nothing else.",
  PARSE_CLE_VAL_ADDRESSES_CATALOG: "'{cle}.{val}{p1}\u2026' addresses a catalog by TWO levels \u2014 only one is written. The period calls an ENTRY, never the structure that holds it: write '{cle}.{p2}' if '{p3}' is the entry wanted, or '{cle}.{val}' if it is '{val}'.",
  PARSE_CONTEXT_PLACED_EXTREMITIES_LEFT: "a CONTEXT is only placed at the EXTREMITIES of the left-hand side \u2014 at the front ('(A) x B -> \u2026') or at the tail ('x B (A) -> \u2026'). Here it follows '{p1}' element(s) and precedes others: the engine does not know this place, and the tree produced would be readable by no one.",
  PARSE_DEFINED_PARAMETER_CALLED_HERE: "'{p1}' is defined with {p2} parameter(s) ({p3}) and is called here with {p4} argument(s). A transformation called wrongly would leave a parameter unsubstituted in the tree, in the form of a terminal that would sound.",
  PARSE_DEF_DEFNAME_CARRIES_CODE: "'def {defName}' carries CODE, not a structure \u2014 this stage reads \"a name is worth a sequence of terms\" ('def cadence sa re ga pa'). The typed code body ('def {defName} <type> \\`language: \u2026\\`', types 'signal', 'pitch', 'phase', 'logic') is NOT yet read; it is refused here rather than being read the wrong way \u2014 otherwise the type would become a terminal and the code a neighboring element.",
  PARSE_DEF_DEFNAME_CLE_NEITHER: "'def {defName}': '{cle}' is neither a component call nor an assignment. A terminal key is written '{cle}.<name>' to call a component, or '{cle}:<value>' to assign a value \u2014 the period calls, the colon assigns.",
  PARSE_DEF_DEFNAME_EMPTY_STRUCTURE: "'def {defName}': empty structure. A name worth nothing is not reinvoked.",
  PARSE_DEF_DEFNAME_NAME_EXPECTED: "'def {defName}': name expected after '{cle}.'",
  PARSE_DEF_DEFNAME_READABLE_VALUE: "'def {defName}': '{p1}' is not readable in the value of '{cle}'. A value is made of WORDS \u2014 a name, a number, a text in quotes, a ratio \u2014 and the space separates its parts. This sign opens a structure, and a structure is not placed in a value: write it in the body in parentheses of the declaration.",
  PARSE_DEF_DEFNAME_TRANSFORMATION_WITHOUT: "'def {defName}({p1})': transformation without a body. What the definition DOES with its parameters is written after them.",
  PARSE_DEF_DEFNAME_TYPED_CODE: "'def {defName}': typed code cannot follow another part in the value of '{cle}'. Typed code IS the value \u2014 write it alone after the colon.",
  PARSE_DEF_DEFNAME_VALUE_EXPECTED: "'def {defName}': value expected after '{cle}:'",
  PARSE_DIRECTIVE_NOM_SIGN_BEEN: "{directive} {nom}: the sign '=' has been REMOVED from the whole language \u2014 write '{directive} {nom} <value>' with nothing between the two.",
  PARSE_DIRNOM_DECLARATION_SETTING_WRITTEN: "'{dirNom}' is not a declaration: it is a setting, and it is not written alone on a line. It applies {p1}.",
  PARSE_DIRNOM_WRITTEN_AFTER_RULES: "'{dirNom}' is written AFTER rules, and in this place it declares NOTHING: it was accepted then silently discarded. Declarations precede the rules \u2014 move this line up before the scene's first rule. (Only 'mode' is placed here: it governs the sub-grammar that follows.)",
  PARSE_DURATION_ISOLATED_FLOW_STICKS: "duration isolated in the flow: ':N' sticks to a terminal (A4:1/2), a group ({A B}:2) or the whole rule (at the end of the RHS) \u2014 never in the middle of the flow",
  PARSE_EXPANDS_WITHOUT_END_DEFINITION: "'{p1}' expands without end \u2014 a definition ends up invoking itself. A form that contains itself does not expand.",
  PARSE_EXPECTED_ARGUMENT_VALUE_NAME: "Expected argument value in '{name}(\u2026)'",
  PARSE_EXPECTED_ARROW_GOT: "Expected arrow (-> <- <>), got {p1}",
  PARSE_EXPECTED_FLAG_VALUE: "Expected flag value",
  PARSE_EXPECTED_FLAG_VALUE_2: "Expected flag value",
  PARSE_EXPECTED_FLAG_VALUE_3: "Expected flag value",
  PARSE_EXPECTED_GOT: "Expected {p1}, got {p2} ({p3})",
  PARSE_EXPECTED_NUMBER_AFTER_PROP: "Expected number after - in prop value",
  PARSE_EXPECTED_SYMBOL_AFTER: "Expected symbol after ~",
  PARSE_EXPECTED_SYMBOL_AFTER_2: "Expected symbol, (...) or [...] after !",
  PARSE_EXPECTED_SYMBOL_AFTER_3: "Expected symbol after !",
  PARSE_EXPECTED_TEMPLATE: "Expected 'template'",
  PARSE_EXPECTED_TYPE_GOT: "Expected {type}, got {p1} ({p2})",
  PARSE_EXPECTED_VALUE_AFTER_OPERATOR: "Expected value after operator",
  PARSE_EXPECTED_VALUE_INT_FLOAT: "Expected value (INT/FLOAT/STRING/IDENT) in prop pair",
  PARSE_FLAG_PREMIER_FLAG_CARRIES: "flag {premier}: a flag carries its initial value \u2014 'flag {premier}:<integer>'. That is the only form: neither the name alone, nor named states in parentheses. A flag counts and is compared to integers.",
  PARSE_FLAG_PREMIER_INITIAL_VALUE: "flag {premier}: the initial value is an INTEGER \u2014 'flag {premier}:<integer>'. A flag counts and is compared to integers.",
  PARSE_FORM_RESERVED_PRODUCTION_DIRECTIVE: "Form '![@\u2026]' reserved (production directive in the flow) \u2014 not implemented",
  PARSE_GUARD_FLAG_MUTATION_WRITTEN: "guard '[{flag}=\u2026]': '=' is a MUTATION, it is written at the end of the rule ('S -> C4 [{flag}=\u2026]'). To TEST the value of a flag before the LHS, compare with '==' ('[{flag}==\u2026] S -> C4')",
  PARSE_INIT_SUBKEY_INIT_WORD: "'init.{subkey}': 'init' is a word of the LANGUAGE, it is not qualified by a period{p1}, and gathers what belongs to the whole scene: tagged code, or a bag of starting values.",
  PARSE_INTERVAL_QUOTES_SUPPORTED_CTRLNAME: "Interval in quotes not supported for '{ctrlName}': write the BARE form '{p1}' (without quotes) \u2014 an interval is written as a fraction (3/2), cents (700c) or a decimal (1.5)",
  PARSE_KEY_ACTOR_KEY_KEYS: "'{key}.\u2026' is not an actor key{p1}{ou}. The keys of an actor are: {p2}",
  PARSE_KEY_ASSIGNS_VALUE_COLON: "'({key}:)' assigns no value \u2014 the colon expects one (for example '({key}:{exemple})')",
  PARSE_KEY_ASSIGNS_VALUE_COLON_2: `'({key}:)' assigns no value \u2014 the colon expects one (for example '({key}:80)'), and a control without an argument is written bare, without a colon. An EMPTY text is written '{key}:""': the delimiter, with nothing inside`,
  PARSE_KEY_ASSIGNS_VALUE_COLON_3: "'[{key}:]' assigns no value \u2014 the colon expects one (for example '[{key}:3 0]'), and a control without an argument is written bare, without a colon",
  PARSE_KEY_BRACKET_CARRIES_WHAT: "'[{key}:\u2026]': the bracket carries only what governs DERIVATION \u2014 a flag test ('[flag]', '[flag==1]'), an assignment ('[flag=1]'), a derivation procedure ('[goto:\u2026]', '[repeat:\u2026]', '[failed:\u2026]', '[stop]') or the rank of a template form ('[3]'). '{key}' describes what the derivation PRODUCES: it is written in PARENTHESES .",
  PARSE_KEY_BRUT_BRUT_LEFT: "'{key}:{brut}': '{brut}' has LEFT the language \u2014 the requirement is read from the ABSENCE of a default, the multiplicity from the EXEMPLAR. Write '{key}' alone for a required member, or '{key}()' for a required collection; a value given after ':' makes it an optional member for which it is the default.",
  PARSE_KEY_BRUT_COLON_ASSIGNS: "'({key}:{brut})': the colon ASSIGNS a value, it does not separate its parts \u2014 a pair carries only one. To name a numbered component, the period calls it ('({key}.{p1}:{p2})'); for several parts, the space separates them",
  PARSE_KEY_BRUT_KEY_EXPECTS: "'({key}:{brut} {p1}\u2026)': '{key}' expects only ONE value, so '{p1}' is another ELEMENT of the bag \u2014 it is missing its COMMA ('{key}:{brut}, {p1}\u2026'). The space only separates the PARTS of a single value",
  PARSE_KEY_BRUT_KEY_TAKES: "'({key}:{brut})': '{key}' takes NO argument \u2014 its declaration names none. Write '{key}' alone. A value placed here would travel all the way to the runtime with no recipient, with nothing signaling it serves no purpose.",
  PARSE_KEY_COLON_ASSIGNS_VALUE: "'[{key}: {p1}:\u2026]': the colon ASSIGNS a value, it does not separate its parts \u2014 a pair carries only one. The parts of a value are separated by a SPACE ('[{key}:3 0]')",
  PARSE_KEY_COMMA_SEPARATES_ELEMENTS: "'[{key}: {p1},\u2026]': the comma separates the ELEMENTS of the bag, not the parts of a value (positional list removed) \u2014 write '[{key}:{p1} \u2026]', the parts separated by a SPACE",
  PARSE_KEY_COMPONENT_NAMES_COMPONENT: "'{key}.{component}' names a component without assigning it a value \u2014 ':value' is missing (example: '({key}.{component}:45)')",
  PARSE_KEY_COMPONENT_SPACE_AFTER: "'{key}.{component}: ' \u2014 no space after the colon: the value begins immediately ('{key}.{component}:{p1}')",
  PARSE_KEY_COMPOSANT_ASSIGNS_VALUE: "'{key}.{composant}:\u2026' assigns a value to the component '{composant}' of '{key}' \u2014 but '{key}' is neither an invoked library, nor a control with components, nor an instance declared in this scene. Declare the instance first: '<module> {key}'",
  PARSE_KEY_COMPOSANT_COMPOSANT_SCENE: "'{key}.{composant}:\u2026' \u2014 '{composant}' is a SCENE directive: it is written at the top, before the delimiter, never in a parenthesis. The prefix changes nothing here, '{composant}:\u2026' bare is refused too.",
  PARSE_KEY_COMPOSANT_LIBRARY_KEY: "'{key}.{composant}:\u2026' \u2014 the library '{key}' does not declare any control '{composant}'. The prefix is correct, the control is not part of it.",
  PARSE_KEY_COMPOSANT_LIBRARY_KEY_2: "'{key}.{composant}:\u2026' \u2014 the library '{key}' is indeed invoked, and it does not declare ANY control: nothing is assigned there through a parenthesis. The prefix is correct, the library is not one of those that carry controls.",
  PARSE_KEY_COMPOSANT_SPACE_AFTER: "'{key}.{composant}: ' \u2014 no space after the colon: the value begins immediately ('{key}.{composant}:{p1}')",
  PARSE_KEY_DECLARATIVE_PART_COMMA: "'{key}:{p1} {p2}\u2026': in the DECLARATIVE part, only the comma separates \u2014 the space separates nothing there. A value has only ONE part; several parts are several values, and they are written with a parenthesis and names: '{key}({p1}, {p2}\u2026)'. In the FLOW, after the delimiter, the space separates terms as before.",
  PARSE_KEY_ELEMENTS_BAG_SEPARATED: "'({key}:\u2026 {p1}:\u2026)': two ELEMENTS of the bag separated by a SPACE \u2014 they are missing a COMMA ('({key}:\u2026, {p1}:\u2026)'). The space only separates the PARTS of a single value",
  PARSE_KEY_ELEMENTS_BAG_SEPARATED_2: "'[{key}:\u2026 {p1}:\u2026]': two ELEMENTS of the bag separated by a SPACE \u2014 they are missing a COMMA ('[{key}:\u2026, {p1}:\u2026]'). The space only separates the PARTS of a single value",
  PARSE_KEY_KEY_RUNTIME_CONTROL: "'[{key}:\u2026]': '{key}' is a RUNTIME control, it is written in PARENTHESES \u2014 '({key}:\u2026)', or '!({key}:\u2026)' to place it in the flow. Brackets are addressed to the ENGINE",
  PARSE_KEY_KEY_SETTING_WRITTEN: "'[{key}:\u2026]': '{key}' is a setting, it is written in PARENTHESES \u2014 '({key}:\u2026)' . The bracket now carries only what governs the derivation itself: a flag test ('[flag]', '[flag==1]'), an assignment ('[flag=1]'), or the rank of a template form ('[3]')",
  PARSE_KEY_KEY_WRITTEN_RULE: "'{p1}{key}:\u2026{p2}': '{key}' is not written in a rule \u2014 the speed multiplier IS the operator, and it is placed in the flow: '! (/N)' slows down, '! (*N/M)' writes the same thing in inverse fraction. The scene's metronome, on the other hand, is written at the top: 'tempo:120'",
  PARSE_KEY_NAMES_NUMBERED_COMPONENT: "'{key}.\u2026' names a NUMBERED component: it expects a number, not '{p1}' (example: '({key}.98:45)'). Controllers that have a name are written by their name",
  PARSE_KEY_SPACE_AFTER_COLON: "'{key}: ' \u2014 no space after the colon: the value begins immediately ('{key}:{p1}\u2026'). The space only separates the PARTS of a value",
  PARSE_KEY_SPACE_AFTER_COLON_2: "'{key}: ' \u2014 no space after the colon: the value begins immediately ('{key}:{p1}\u2026'). The space only separates the PARTS of a value",
  PARSE_MACRO_MACRONAME_PARAMETER_DECLARED: "Macro '{macroName}': parameter(s) declared but absent from the body: {p1}. A macro is a textual substitution (EBNF \xA7macro l.59/273) \u2014 each parameter MUST appear in the body (e.g. accent(x) = x(vel:120)). A declaration name(target, transport) = curve (CV/signal form) is not a valid macro: syntax pending arbitration.",
  PARSE_MALFORMED_CONTROL_ARGUMENT_NAME: "malformed control argument in '{name}(\u2026)': '{arg} {p1}' \u2014 two values follow each other without a separator. A control takes arguments separated by ','; it does not take a sentence (the generic function 'script(\u2026)' has been removed from the language)",
  PARSE_MALFORMED_INTERVAL_CTRLNAME_EXPECTED: "Malformed interval for '{ctrlName}'{p1} \u2014 expected a fraction (3/2), cents (700c) or a decimal (1.5)",
  PARSE_MODE_ECRIT_ECRIT_DERIVATION: "'mode:{ecrit}': '{ecrit}' is not a derivation mode \u2014 the modes are {p1}. The list is CLOSED.",
  PARSE_MODE_EXPECTS_DERIVATION_MODE: "'mode' expects the derivation mode it sets \u2014 'mode:<mode>'. Written alone, it governs NOTHING: the sub-grammar keeps the mode it had, and the line disappears without a trace. The modes are {p1}.",
  PARSE_MODE_MODNAME_MODNAME_DECLARED: "'mode:{p1}({modName})': '{modName}' is not declared by any invoked library. A sub-grammar modifier is a library word like any other \u2014 {p2}.",
  PARSE_MODNAME_DOES_APPLY_SUB: "'{modName}' does not apply to a sub-grammar \u2014 its declared scope is {p1}. {p2}",
  PARSE_MOTDECLARANT_MUST_NAME_WHAT: `'{motDeclarant}' must name what it defines: '{motDeclarant} <name> <body>'. The name comes first, what it is worth next \u2014 like 'actor'. A NAME STARTS WITH A LETTER, or with a digit if it carries at least one letter: 'western', 'a_b', '12TET' are ones; '12', '_ab', '#a', '-ab' and '"ab"' are not. Received: {p1}.`,
  PARSE_MOT_MOT_TYPE_SCOPE: "'{mot} {p1}': '{mot}' is not a type in scope. A type in front is an object in scope \u2014 declared by the scene, or brought by a library invoked at the top (the base lives in 'types') \u2014 or in.<channel>.",
  PARSE_MOT_MUST_NAME_WHAT: "'{mot}' must name what it declares \u2014 the type comes first, the name next ('{mot} <name>').",
  PARSE_MOT_NOM_STARTING_VALUE: "{mot} {nom}: a starting value STICKS to its sign \u2014 '{nom}:<value>', never '{nom}: <value>'. The space separates two terms, sticking them together joins them.",
  PARSE_MOT_NOM_STARTING_VALUE_2: "{mot} {nom}: a starting value is placed after ':' \u2014 a number or a name. Received '{p1}'.",
  PARSE_NAME_ADDRESS_FOLLOWED_SEPARATOR: "'<!{name}.{p1}{p2}': the address is FOLLOWED BY '{p2}' with no separator. An address is A SINGLE token \u2014 an identifier ('<!{name}.next') or an integer ('<!{name}.60'). Separate with a space what must be a distinct term.",
  PARSE_NAME_BARE_FORM_FLOW: "'{name}' has no bare form in the flow \u2014 {commentEcrire}. A word of the vocabulary encountered where it cannot be is refused; it does not disappear.",
  PARSE_NAME_ECRIT_PRODUCTION_DIRECTIVE: "'[{name}{ecrit}]': a production directive is written at the top of the scene, before the delimiter \u2014 '{name}{ecrit}'. A block that grouped several keys is rewritten as that many lines. The bracket carries what belongs to DERIVATION: a flag, a procedure, a rank.",
  PARSE_NAME_FOLLOWED_ADDRESS_ADDRESS: "'<!{name}.' followed by '{p1}': this is not an address. An address is an identifier ('<!{name}.next') or an integer ('<!{name}.60'), attached to the period on both sides. Without an address, write '<!{name}' alone \u2014 the wait then lifts on any event of that role, and that is a different form, not a shortcut.",
  PARSE_NAME_NAME_BETWEEN_BARS: "'|{name}|': the name between bars has left the language \u2014 write '{name}' bare. The form remains readable on BP3 input, it is no longer written in a BPScript scene. \u26A0\uFE0F Check that no terminal of the alphabet in scope is already named '{name}': the bars used to distinguish the non-terminal, the bare name no longer does.",
  PARSE_NAME_READABLE_NEITHER_SETTING: "'{name}({p1})' is readable neither as a SETTING BAG \u2014 its content is not made of 'key:value' pairs \u2014 nor as a CALL: calling requires a declared definition, and none carries the name '{name}'. To set '{name}', write '{name}(key:value)'; to call it, declare it first with 'def {name}(x) \u2026'",
  PARSE_NAME_REFUSED_DOES_ASSIGN: "'{name}:<X>' refused \u2014 ':' does not assign a value to a component. Write '{name}.<name>' (rule: ':' assigns, '.' calls){hint}.",
  PARSE_NAME_SEED_MAKES_SENSE: "'![{name}\u2026]': only 'seed' makes sense in the flow (re-seed _srand); '{name}' is placed at the top of the scene, '{name}'.",
  PARSE_NOMDECLARE_SPACE_BETWEEN_DECLARED: "'{nomDeclare} (\u2026)': a space between a declared word and its bag separates them into two terms \u2014 a bag is attached to the word it describes. Write '{nomDeclare}(\u2026)'.",
  PARSE_NOM_CARRIES_ATTACHED_SETTING: "{nom} carries TWO attached setting bags \u2014 an element carries only one. Merge the pairs into the same bag: the comma separates them, '(key:value, key:value)'. The two forms already said the same thing; this one no longer is one.",
  PARSE_NOM_NUMBER_NAME_NAME: "'{nom}' is a NUMBER, not a name. A name that starts with a digit carries at least one letter \u2014 '12TET' and '22shruti' are names, '{nom}' is not one.",
  PARSE_NOM_SEEDING_MAKES_SENSE: "'![{nom}\u2026]': only re-seeding makes sense in the flow, and it is written '![seed:N]'; '{nom}' is placed at the top of the scene, '{nom}'.",
  PARSE_NOTHING_COMES_BETWEEN_WAIT: "'<! {p1}': nothing comes between the wait point and what it waits for \u2014 they form a single term. Write '<!{p1}'.",
  PARSE_NUMBERED_WILDCARD_MAKES_SENSE: "'?{p1}': a numbered wildcard only makes sense in a rule (the number unifies with the arrow, which replays the choice). A @template catalog line has no arrow \u2014 its wildcards are always anonymous ('?'), never numbered.",
  PARSE_NUM_DEN_NUMBERS_TOUCH: "'{num}/{den}/\u2026': two numbers touch, and nothing says where the first ends \u2014 '{num}/{den}' followed by an attached digit can be read '{num}' then '{p1}\u2026', or otherwise. Numbers are never juxtaposed: separate with a SPACE",
  PARSE_OBJECT_OBJECT_LEFT_LANGUAGE: "'object {p1}': 'object' has LEFT the language \u2014 the root of a family is declared with 'def {p1}(\u2026)', and an instance by its type in front ('{p1} <name>(\u2026)'). Only one word declares: 'def'.",
  PARSE_OPERATOR_EXPECTS_NUMBER_FRACTION: "'! ({operator}\u2026)' expects a number or a fraction \u2014 '! (/2)', '! (*3/2)', '! (/1.5)'",
  PARSE_OUT_SUBKEY_REFUSED_CHANNEL: "'out.{subkey}' is refused \u2014 this channel is a DESTINATION of the architecture, routed like the other outputs, but its WRITE from a scene still awaits its dedicated device.",
  PARSE_PLACED_BARE_WITHOUT_ARGUMENTS: "'{p1}' is {p2}: it is placed BARE, without arguments. Write '{p1}'. A parameter list is declared with the name ('def {p1}(x) \u2026'), and only then does the call carry any.",
  PARSE_PRODUCTION_BLOCK_ALLOWED_TOP: "Production block [@\u2026]: allowed at the top of the scene only",
  PARSE_REFUSED_INPUT_DECLARES_CHANNEL: "'in {p1}' is refused \u2014 an input declares its CHANNEL: 'in.<channel> {p1}'. The input channels are {p2}. Without it, no runtime is addressed and nothing triggers.",
  PARSE_RHS_PARSE_LOOP_SAFETY: "RHS parse loop safety limit",
  PARSE_RULE_LEVEL_PROCEDURE_PLACED: "'![{p1}: \u2026]': '{p1}' is a RULE-level procedure, it is not placed in the flow \u2014 it applies to the whole rule. Write '[{p1}:{p2}]' as a rule suffix. In the flow, it never reaches the rule and leaves an inert control token in the production",
  PARSE_RULE_PARSE_LOOP_SAFETY: "Rule parse loop safety limit",
  PARSE_RULE_WRITTEN_BEFORE_DELIMITER: "a rule is written BEFORE the delimiter: the line '-----' is missing between the declarative part and the production. Since the at-sign left the language, it is POSITION that qualifies a line \u2014 before the '-----' it declares, after it produces.",
  PARSE_SCALE_BEEN_REMOVED_TEMPORAL: "'[scale:N]' has been REMOVED \u2014 the temporal scaling of a group is written with the ATTACHED DURATION: '{A B}:N'. (Not to be confused with the microtonal scale, which is a runtime control: '(scale:name key)'.)",
  PARSE_SCAN_UNKNOWN_VALUE_EXPECTED: "(scan:{p1}): unknown value (expected: {p2})",
  PARSE_SEED_SEEDING_FLOW_WRITTEN: "'![seed:N]': re-seeding in the flow is written WITHOUT the at-sign \u2014 '![seed:N]'. The bracket carries what governs the derivation, and re-seeding is such a procedure; the at-sign remains at the top of the scene, where 'seed:N' sets the production.",
  PARSE_SHUFFLE_REMOVED_SEED_WRITTEN: "'[shuffle:N]' removed \u2014 the seed is written 'seed:N' (at the top of the scene) or '![seed:N]' (in the flow); '[shuffle]' shuffles alone",
  PARSE_SIGIL_NOM_PLACE_ARGUMENTS: "'{sigil}{nom}(\u2026{p1}\u2026)': '{p1}' has no place in the arguments of a template \u2014 they are written 'name:value', separated by commas. To place a SETTING on the rule, a SPACE detaches it from the template ('{sigil}{nom} ({p2}:\u2026)'); for a SPEED, which is not a pair, the exclamation mark places it in the flow ('{sigil}{nom} ! (*2/3)')",
  PARSE_SIGNE_SPEED_OPERATOR_WRITTEN: "'[{signe}N]': the speed operator is written in PARENTHESES and placed in the FLOW \u2014 '! ({signe}N)'. It lives nowhere else: neither as a rule suffix, nor attached to an element. '/N' speeds up, '*N/M' writes the same thing in inverse fraction",
  PARSE_SIGN_LEFT_LANGUAGE_WRITE: "the at-sign has LEFT the language \u2014 write '{p1}' without it. What qualifies a line is its POSITION: before the '-----' it declares, after it produces.",
  PARSE_SIGN_READABLE_MEMBER_MEMBER: "the sign '{p1}' is not readable in a member: a member is a name, a number or a text in quotes. The members already read are '{p2}'.",
  PARSE_SOUND_REFUSED_DOES_ASSIGN: "'sound:<X>' refused \u2014 ':' does not assign a value to a component. Write 'sound.<name>' (rule: ':' assigns, '.' calls).",
  PARSE_SPEED_BEEN_REMOVED_DURATION: "'[speed:N]' has been removed \u2014 duration is written with ':': '{A B}:2' (group), 'A4:1/2' (note) or '}:N' (embedding)",
  PARSE_STUCK_IDENTIFIER_FORBIDDEN_LHS: '"$" stuck to an identifier is forbidden in LHS \u2014 use "$ " (dollar isolated with a space)',
  PARSE_SUBGRAMMAR_PARSE_LOOP_SAFETY: "Subgrammar parse loop safety limit",
  PARSE_SUBKEY_OUTPUT_OUTPUT_CHANNELS: "'{subkey}' is not an output \u2014 the output channels are {p1}. The list is CLOSED.",
  PARSE_SUFFIX_NOM_ATTACHED_ELEMENT: "the suffix '{nom}' attached to an element has been REMOVED from the language. Two forms replace it, depending on what was intended. To ASSOCIATE a gesture with an element IN THE PRODUCTION: the exclamation mark, 'C4!{nom}' \u2014 the gesture triggers at the instant of the terminal without occupying a step. To DECLARE A LABEL: the declarative part, with 'def'.",
  PARSE_TEMPLATES_PLURAL_LONGER_EXISTS: "'templates' (plural, v0.7) no longer exists \u2014 write 'template' (singular)",
  PARSE_TEMPLATE_CATALOG_TRANSPORTED_VERBATIM: "the template catalog is transported VERBATIM: the parser needs the SOURCE to render the line as it is written. The caller must pass 'source' to parse().",
  PARSE_TERMINAL_DEFNAME_BODY_OPENED: "'terminal {defName}': the body opened by '(' is not closed \u2014 ')' is missing.",
  PARSE_TERMINAL_DEFNAME_TERMINAL_DECLARED: "'terminal {defName}': a terminal is declared by its KEYS \u2014 'voice.<name>', 'hz:<n>', 'degree:<n>', 'register:<n>', 'sounding:<true|false>', 'duration:<n>', 'tuning.<name>', 'octaves.<name>'. A sequence of terms is a STRUCTURE, and it is written 'def {defName} <terms>'.",
  PARSE_TERMS_SEPARATED_SPACE_BEFORE: "two terms are separated by a space: before the delimiter, only the comma separates \u2014 the space separates nothing there, it is formatting. Write '{p1}, {p2}'.",
  PARSE_TRANSFORMATION_ARGUMENT_GIVEN_POSITION: "'{p1}(\u2026)': a transformation argument is given by POSITION, never by name \u2014 received '{p2}:'. Write '{p1}({p3})', the parameters in the order of the definition ({p4}).",
  PARSE_TRANSFORMATION_CALLED_ARGUMENTS_WRITE: "'{p1}' is a transformation on {p2}: it is called with its arguments. Write '{p1}({p3})'. Placed bare, the name would come out of the tree as a terminal and sound.",
  PARSE_UNEXPECTED_TOKEN_CONTROL_ARGS: "Unexpected token {p1} ({p2}) in control args",
  PARSE_UNKNOWN_KEY_KEY_NEITHER: "unknown key '[{key}:\u2026]' \u2014 neither a library control, a guard, an assignment, nor a template rank; check the spelling, or the library that declares it. '[{key}:\u2026]' and '![{key}:\u2026]' (engine control) are NOT interchangeable with '({key}:\u2026)' (runtime parameter)",
  PARSE_UNRECOGNIZED_LINE_RULE_LEVEL: "unrecognized line at rule level: expected a rule, 'directive', '-----' or the end of the scene",
  PARSE_VALUE_DIRNAME_READS_ECRIT: "the value of '{dirName}' reads '{ecrit}', and '{reste}' remains stuck to it without being read as part of it. A directive value is BARE: a number, a ratio ('3/4'), or a name. Remove '{reste}' if it is a unit \u2014 no directive carries one \u2014 or space it out if what follows is something else.",
  PARSE_VALUE_EXPECTED_AFTER: 'value expected after ":"',
  PARSE_VALUE_EXPECTED_AFTER_PARAMKEY: "value expected after '{paramKey}:'",
  PARSE_WHERE_UNKNOWN_VOICE_NAME: "{where}: unknown voice '{name}' \u2014 no entry '{name}' in the catalog of the 'voice' word (LANG-SONS \xA73).",
  PARSE_WHERE_VOICE_NAME_INVALID: "{where}: voice '{name}' \u2014 invalid 'audio' realization in the catalog of the 'voice' word: a TYPED backtick is required (\\`js: \u2026\\`, \\`faust: \u2026\\`); received {p1}.",
  PARSE_COLON_ON_COMPONENT: "'{key}:\u2026' refused \u2014 ':' does not assign a value to a component. Write '{canon}.<name>'{params} (rule: '.' CALLS the component, ':' ASSIGNS a value).",
  PARSE_DECLARES_NOTHING: "{arret}'{motDeclarant} {defName}' declares nothing. This stage reads TWO bodies: the TERMINAL DECLARATION \u2014 a name then its keys, on the same line ('def {defName}  voice.sec') or in an indented block, one key per line \u2014 and the STRUCTURE, a name that is worth a sequence of terms ('def {defName} sa re ga pa'). The other bodies the specification describes \u2014 a wiring, typed code, a preset, a parameterized or structural transformation \u2014 are NOT yet read; they will be, and until then they are refused here rather than being read the wrong way.",
  PARSE_FLAG_USAGES_DESIGNATE_NOTHING: "{cri}",
  PARSE_FLOW_WORD_NOT_IN_SCOPE: "'![{nom}:\u2026]': '{nom}' is not in scope: no invoked library declares it \u2014 invoke it at the top ({declarants}).",
  PARSE_FLOW_WORD_UNDECLARED: "'![{nom}:\u2026]': '{nom}' is not declared by any library. The re-seeding in the flow translates the native '_srand(N)', and the word that carries it comes from a library like all the others.",
  PARSE_NATIVE_UNDERSCORE_FORM: 'the form "_{nom}(\u2026)" is that of the native BP3 engine, it does not belong to BPScript \u2014 write "!({cle}:\u2026)" instead{renomme}',
  // ── L'ÉTAGE DE RÉSOLUTION ───────────────────────────────────────────────────────────────────
  // [À TRADUIRE]
  RESOLVE_REMOTE_CONTEXT_MID_PATTERN: "contexte distant en milieu de motif (autoris\xE9 : d\xE9but ou fin de LHS)",
  PARSE_CALL_FORM_DOES_NOT_EXIST: "the call form '{name}({sac})' does not exist in BPScript \u2014 write '{flux}' to place it in the flow, or '{contenance}' as containment. The colon ASSIGNS the value, the space separates its parts ('[goto:3 0]'), the comma separates the elements of the bag ('(vel:80, pan:64)')",
  ACTOR_ALPHABET_FOUND_ACTOR: 'Alphabet "{alphabetKey}" not found for actor "{name}"',
  ACTOR_AMBIGUOUS_SYMBOL_OWNED_ACTORS: 'Ambiguous symbol "{p1}" \u2014 owned by actors: {actorList}. Use dot notation (e.g. {p2}.{p1}) or declare with gate {p1}:<actor>',
  ACTOR_UNKNOWN_ACTOR_DOTTED_REFERENCE: "unknown actor '{p1}' in '{p1}.{p2}' \u2014 a dotted reference must name an actor declared by actor. {connus}",
  RESOLVE_ALPHABET_INCONSISTENT_TUNING_WHICH: "alphabet '{alphaName}' is inconsistent with tuning '{tuningName}' (which belongs to alphabet '{ta}') \u2014 a tuning combines only with its own alphabet",
  RESOLVE_BACKTICK_LANGUAGE_MUST_KNOWN: "Backtick with no language \u2014 it must be known, never guessed. The language comes from the nearest place that names it: a TAG inside the block (\\`js: \u2026\\`), an ACTOR qualifying the block with a dot ('actor drums eval.<engine>' then \\`drums.\\`\u2026\\`\\`), an 'eval.<engine>' line at the top of the scene, or the base library 'core' \u2014 which carries 'js'. None of the four answered: the 'core' catalog does not expose 'defaults.components.eval'.",
  RESOLVE_COMPOUND_SOUND_OBJECT_DECLARED: "in the compound sound object '|[\u2026]': '{part}' is declared nowhere \u2014 absent from the alphabets in scope",
  RESOLVE_DECLARED_LIBRARIES_CANNOT_WRITTEN: "'{key}' is declared by {p1} libraries and cannot be written BARE \u2014 it does not say which '{key}' is meant, and the recipient of the setting depends on it. Write {p2}.",
  RESOLVE_DECLARED_LOADED_LIBRARY_TOP: "'{p1}:{p2}': '{p1}' is declared by no loaded library. A top-of-scene line that no data carries settles nothing \u2014 it would be read, written into the tree, and have no effect.",
  RESOLVE_DECLARED_LOADED_LIBRARY_TOP_2: "'{p1}' is declared by no loaded library \u2014 a top-of-scene word comes from an invoked library, never from nowhere. Invoke the library that carries it, or remove the line.",
  RESOLVE_ENTRY_DOES_EXIST_LIBRARY: "'{p1}.{p2}': entry '{p2}' does not exist in library '{p1}'. An invocation that resolves to nothing is indistinguishable, on the consumer side, from a scene that declared nothing \u2014 it therefore cannot be accepted silently.",
  RESOLVE_EXPECTS_VALUE_NAME: "'{p1}' expects a VALUE (e.g. @{p1}:440) \u2014 not a name",
  RESOLVE_FILE_NAME_WORD_INVOKES: "'{p1}': '{p1}' is the FILE NAME, not the word that invokes it. Write '{motNu}'. A library is invoked by the word it DECLARES: the logical name is separate from the physical one, and a file can be renamed without any scene changing.",
  RESOLVE_FOUND_CATALOG_REFERENCE_DOES: "{axis} '{name}' not found in the catalog (reference does not exist)",
  RESOLVE_GENERIC_WORD_EVERY_OUTPUT: "'{key}' is a GENERIC word: every output declares how it implements it, and {p1} do{p2} not. Written here, it would do nothing. Implemented today by: {p3}.",
  RESOLVE_MODE_LONGER_BELONGS_RULE: "'(mode:\u2026)' no longer belongs on a rule: the mode holds for a BLOCK and does not change mid-derivation. Write it 'mode:{p1}' at the top of the sub-grammar concerned \u2014 on a line of its own, before its rules.",
  RESOLVE_NAMES_EVALUATOR_DECLARED_BACKTICK: "'\\`{tag}: \u2026\\`' names an evaluator that is not declared. A backtick tag says WHO runs the code, and the list lives in the 'eval' library: {p1}. A typo there would create a phantom interpreter, and the scene would compile while the code went nowhere.",
  RESOLVE_NEITHER_PARAMETER_NOR_DECLARED: "'{axis}.{p1}({k}:\u2026)': '{k}' is neither a parameter of '{p2}' nor a declared value (base library @core or an invoked library)",
  RESOLVE_NUMBER_EXPECTED: "'{name}': '{v}' is not a number (expected: {p1}..{p2}{p3})",
  RESOLVE_OUTPUTS_SAME_SCENE_OUT: "two outputs for the same scene: 'out.{p1}' and the binding 'alphabet.{p2}:{p3}' name different channels \u2014 both spellings say the SAME thing, keep only one",
  RESOLVE_OUT_RANGE: "'{name}': {v} out of range [{p1}..{p2}]{p3}",
  RESOLVE_OVERLAPPING_ACTORS_OUTPUT_BINDING: "overlapping actors: an output binding on the alphabet (alphabet.{p1}:{p2}) names an implicit actor, which cannot coexist with an explicit 'actor' \u2014 keep one OR the other",
  RESOLVE_SCOPE_INVOKED_LIBRARY_DECLARES: "'{cle}' is not in scope: no invoked library declares it \u2014 invoke it at the top ({p1}).",
  RESOLVE_SETTING_SUBJECT_NAMES_TERMINAL: "setting subject '{s}:\u2026': '{s}' names no terminal \u2014 absent from the alphabets in scope and from the declared names. A subject targets the terminals bearing its name; '*' targets every terminal in scope, and no subject targets the whole scope",
  RESOLVE_TERMINAL: "terminal '{p1}': {cause}",
  RESOLVE_UNKNOWN_VALUE_ALLOWED: "'{name}': unknown value '{v}' (allowed: {p1})",
  RESOLVE_UNKNOWN_VALUE_DECLARED_ANY: "unknown value '{p1}:\u2026' \u2014 not declared by any loaded library",
  RESOLVE_AXIS_IS_FILE_NAME: "'{name}.{subkey}': '{name}' is the FILE NAME, not the word that invokes it. Write '{motAEcrire}.{subkey}'. A library is invoked by the word it DECLARES: the logical name is separate from the physical one, and a file can be renamed without any scene changing.",
  RESOLVE_AXIS_SERVED_BY_NONE: "'{name}.{subkey}': no library serves the axis '{name}'. An invocation whose axis no data carries loads NOTHING, and nothing tells that silence apart from a scene that declared nothing.",
  RESOLVE_CALL_CONTROL_NOT_INVOKED: "call '{appel}': '{name}' is a control of the registry, but this scene has not invoked it \u2014 it was therefore reclassified as a SOUNDING TERMINAL, that is, a note. Invoke the base library at the top of the scene ('core')",
  RESOLVE_CALL_DOES_NOT_EXIST: "call '{appel}': '{name}' does not exist \u2014 neither a control of the registry, nor a terminal of the alphabets in scope, nor a declared symbol. A generic function is not part of the language: every intent carries its own name ('[]' for the engine, '()' for the runtime, as 'key:value')",
  RESOLVE_GROUP_SET_TWICE: "'{groupe}' is set {fois} times ({mots}) \u2014 it is set only once per scene. {remede} The native engine rejects the whole grammar in this case.",
  RESOLVE_KEY_WRONG_PLACE: "'{cle}' cannot be written {place} \u2014 {permis}. Move it there, or use a setting that holds here.",
  RESOLVE_LANGUAGE_WORD_NOT_QUALIFIED: "'{name}.{subkey}': '{name}' is a word of the LANGUAGE, it is not qualified by a dot{forme} A line that no data serves is read, written into the tree, and has no effect.",
  RESOLVE_MAPPING_TABLE_UNDECLARED: "'in {name} \u2026 mapping.{mapping}': table '{mapping}' is declared by no loaded library \u2014 none carries one today. An input invoking a table that does not exist would believe it translates and would translate nothing. Write the input alone and use bare addresses ('<!{name}.60').",
  RESOLVE_TERMINAL_DECL_CHANNEL: "'{name}:{runtime}' declares a terminal, and {cause} The declaration is written '<name>:<channel>' \u2014 the terminal itself is not at fault.",
  RESOLVE_TERMINAL_NO_ALPHABET: "terminal '{name}' undeclared \u2014 no alphabet in scope: invoke 'core', which declares the default alphabet, or declare an alphabet",
  RESOLVE_TERMINAL_SEGMENTATION_STOPPED: "terminal '{name}' undeclared \u2014 segmentation stopped at '{reste}', absent from the alphabets in scope",
  RESOLVE_TERMINAL_UNDECLARED: "terminal '{name}' undeclared \u2014 absent from the alphabets in scope",
  CONTROL_VALUE_ALLOWED_CONTROL_ALLOWED: "value '{p1}' is not allowed for control '{p2}' (allowed: {p3})",
  CONTROL_VALUE_OUT_RANGE_CONTROL: "value {p1} is out of range for control '{p2}' ({min}..{max})",
  RESOLVE_UNKNOWN_ATTRIBUTE: "unknown attribute '({key}{nu})' \u2014 neither a control, nor a library value, nor an address",
  // [À TRADUIRE]
  LIBS_VALUE_NAME_RESERVED: "Valeur de librairie '{vname}' : nom r\xE9serv\xE9 (directive moteur ou contr\xF4le existant) \u2014 renommer dans la librairie",
  // [À TRADUIRE]
  PARSE_TEMPLATE_ANCHORS_ASYMMETRIC: "ancres de gabarit asym\xE9triques : LHS a {gauche}, RHS a {droite}",
  RESOLVE_REPLAY_WITHOUT_MASTER: "'&{name}' replays a template that nothing captures \u2014 no '${name}' in this scene. The name is what pairs the master with the slave: with no master, the replay has no choice to repeat. Write '${name}' where the pattern is captured.",
  // [À TRADUIRE]
  JOIN_OBJECT_AMBIGUOUS: "librairies jointes : '{chaine}' d\xE9signe plusieurs objets \u2014 {ambigu}. Pr\xE9fixer par sa famille pour lever l'ambigu\xEFt\xE9.",
  // [À TRADUIRE]
  JOIN_OBJECT_NOT_SERVED: "librairies jointes : '{chaine}' est invoqu\xE9 par la sc\xE8ne et la porte des objets ne le rend pas \u2014 l'objet n'existe pas, ou son nom a chang\xE9 sans que la sc\xE8ne suive.",
  RESOLVE_NAME_ALREADY_TAKEN: "the name '{nom}' is already taken: {sortePrise} declared it{ou}, and {sorte} redeclares it. A name designates only ONE thing in a scene \u2014 otherwise, reading it in a rule, one no longer knows what it refers to. Choose another name.",
  RESOLVE_NAME_SHADOWS_TERMINAL: "'{nom}' is a TERMINAL of the active alphabet, and {sorte} makes it a name \u2014 a rule writing '{nom}' would no longer say whether it plays the note or the other thing. Choose another name. The refusal falls at DECLARATION: the name need not be used for the ambiguity to exist.",
  RESOLVE_WAIT_UNDECLARED: "'<!{name}' waits for a signal that nothing declares \u2014 no input, variable, gate or actor of this scene bears the name '{name}'. Declare it: 'in.<channel> {name}'. Without a declaration, a typo builds a SECOND wait that nothing will ever satisfy, and the derivation stops forever without a word.",
  RESOLVE_FLAG_NAMES_RULE: "flag '{nom}' bears the name of a RULE of the grammar{ou} \u2014 a name designates only ONE thing in a scene. Choose another name for the flag.",
  RESOLVE_FLAG_NAMES_SETTING: "flag '{nom}' bears the name of a SETTING of the vocabulary \u2014 the flag bag would silently turn it into a flag, and the setting would become unreachable under that name. Choose another name for the flag.",
  RESOLVE_FLAG_NAMES_TERMINAL: "flag '{nom}' bears the name of a TERMINAL of the active alphabet \u2014 a name designates only ONE thing in a scene, and a flag bears only a flag name. Choose another name for the flag.",
  RESOLVE_FLAG_NAME_ALREADY_TAKEN: "flag '{nom}' bears a name already taken by {sorte}{ou} \u2014 a name designates only ONE thing in a scene. Choose another name for the flag.",
  RESOLVE_RULE_NAME_ALREADY_TAKEN: "rule '{nom}' bears a name already taken by {sorte} \u2014 reading '{nom}' in a sequence, one no longer knows what it refers to. Choose another name for one of the two."
};

// src/transpiler/diagnostics.js
function texteDuDiagnostic(code, params = {}) {
  const gabarit = MESSAGES[code];
  if (typeof gabarit !== "string") {
    throw new Error(`diagnostic '${code}' absent du catalogue \u2014 un refus sans texte n'enseigne rien`);
  }
  const manquants = [];
  const texte = gabarit.replace(/\{(\w+)\}/g, (_, cle) => {
    if (!(cle in params)) {
      manquants.push(cle);
      return `{${cle}}`;
    }
    const v = params[cle];
    return v === null || v === void 0 ? "" : String(v);
  });
  if (manquants.length) {
    throw new Error(`diagnostic '${code}' : trou(s) non rempli(s) \u2014 ${manquants.join(", ")}`);
  }
  return texte;
}
function diagnostic(code, params, extra = {}) {
  return { code, message: texteDuDiagnostic(code, params), ...extra };
}

// src/transpiler/tokenizer.js
var LexError = class extends Error {
  constructor(code, params, line, col) {
    super(texteDuDiagnostic(code, { ...params, line, col }));
    this.name = "LexError";
    this.code = code;
    this.line = line;
    this.col = col;
  }
};
var CARACTERES_CONNUS_MAIS_ETRANGERS = /* @__PURE__ */ new Map([
  ["'", "BPScript n'a pas de litt\xE9ral entre guillemets \u2014 un terminal s'\xE9crit nu (X, pas 'X')."],
  ['"', `BPScript n'a pas de litt\xE9ral entre guillemets \u2014 un terminal s'\xE9crit nu (X, pas "X").`],
  [";", "le s\xE9parateur de s\xE9quence de BP2 n'existe pas \u2014 une r\xE8gle par ligne."],
  // ⚠️ CETTE ENTRÉE DONNAIT UNE RÉÉCRITURE, ET LA RÉÉCRITURE ÉTAIT MORTE. Un refus qui nomme une
  // forme la ressuscite pour son lecteur : c'est le troisième domicile d'un mot retiré, après le
  // parser et les librairies, et aucun garde ne compile un message. Le refus reste NU tant qu'il
  // n'a pas de réécriture vivante à donner.
  ["\\", "l'antislash n'a aucun emploi dans le langage."],
  ["%", "le pourcentage n'est pas un signe du langage \u2014 un poids s'\xE9crit '[weight:N]'."]
]);
var T = Object.freeze({
  // Structural symbols
  AT: "AT",
  // @
  ARROW_R: "ARROW_R",
  // ->
  ARROW_L: "ARROW_L",
  // <-
  ARROW_BI: "ARROW_BI",
  // <>
  LBRACE: "LBRACE",
  // {
  RBRACE: "RBRACE",
  // }
  COMMA: "COMMA",
  // ,
  LPAREN: "LPAREN",
  // (
  RPAREN: "RPAREN",
  // )
  COLON: "COLON",
  // :
  EQUALS: "EQUALS",
  // =
  LBRACKET: "LBRACKET",
  // [
  RBRACKET: "RBRACKET",
  // ]
  BACKTICK: "BACKTICK",
  // ` ... `
  REST: "REST",
  // -
  PROLONG: "PROLONG",
  // _
  PERIOD: "PERIOD",
  // .
  UNDETERMINED: "UNDETERMINED",
  // ...
  BANG: "BANG",
  // !
  TRIGGER_IN: "TRIGGER_IN",
  // <!
  HASH: "HASH",
  // #
  QUESTION: "QUESTION",
  // ?
  DOLLAR: "DOLLAR",
  // $
  AMPERSAND: "AMPERSAND",
  // &
  TILDE: "TILDE",
  // ~
  PIPE: "PIPE",
  // |
  COMPOUND: "COMPOUND",
  // |[ … ] objet sonore composé (ratifié Romain 2026-07-18)
  // Tempo operators (in [] qualifiers)
  STAR: "STAR",
  // *
  // Flag operators
  EQ: "EQ",
  // ==
  NEQ: "NEQ",
  // !=
  GT: "GT",
  // >
  LT: "LT",
  // <
  GTE: "GTE",
  // >=
  LTE: "LTE",
  // <=
  PLUS: "PLUS",
  // +
  // Keywords
  // Literals
  INT: "INT",
  // 123
  FLOAT: "FLOAT",
  // 0.5  (only in params, not period)
  IDENT: "IDENT",
  // Sa, melodie, phase, etc.
  STRING: "STRING",
  // "verse.bps" (quoted string)
  SLASH: "SLASH",
  // /  (for ratios like 3/2)
  // Structure
  SEPARATOR: "SEPARATOR",
  // -----
  COMMENT: "COMMENT",
  // // ...
  NEWLINE: "NEWLINE",
  // end of line
  EOF: "EOF"
});
var KEYWORDS = {
  // ⛔ `gate`, `trigger` ET `cv` ONT QUITTÉ CETTE TABLE LE 2026-08-24, et ils y confisquaient trois
  // noms pour rien. Les mots sont SORTIS du langage — `gate` et `trigger` le 2026-08-15, `cv` le
  // 2026-08-08 — et le compilateur les refusait déjà PARTOUT : en tête de scène, en clé de `def`, en
  // clé de sac, après `out.`. Tant qu'ils étaient des jetons ici, personne ne pouvait NOMMER un
  // terminal `gate`, `cv` ou `trigger`, et le refus rendu était « Expected IDENT, got GATE » — une
  // faute de lexeur pour un nom parfaitement ordinaire.
  //
  // ⚠️ ET LA VALEUR EST SORTIE À SON TOUR, le 2026-08-30. `gate` et `trigger` ont survécu au mot
  // comme les deux valeurs de `temporalType` sur une déclaration de terminal, émises par le
  // compilateur et lues par BPx. Décision de Romain : ils sortent COMME MOTS DU LANGAGE, et ce
  // champ était l'un de leurs deux référents de langage. ⇒ Le statut de terminal vient désormais de
  // la PRÉSENCE de l'entrée. ⇒ Ici, rien ne change : ces noms restent des identifiants ordinaires,
  // et un auteur peut nommer un terminal `gate` comme il le nommerait `zorglub` — mesuré.
};
function tokenize(source, opts = {}) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  function peek(offset = 0) {
    return source[i + offset];
  }
  function advance() {
    const ch = source[i++];
    if (ch === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }
  function match(str) {
    return source.substring(i, i + str.length) === str;
  }
  let _spaceBefore = true;
  let _profCrochet = 0;
  function emit(type, value) {
    tokens.push({ type, value, line, col: col - (value ? value.length : 0), spaceBefore: _spaceBefore });
    _spaceBefore = false;
  }
  while (i < source.length) {
    const ch = peek();
    const startLine = line;
    const startCol = col;
    if (ch === " " || ch === "	" || ch === "\r") {
      _spaceBefore = true;
      advance();
      continue;
    }
    if (ch === "\n") {
      advance();
      emit(T.NEWLINE, "\n");
      _spaceBefore = true;
      continue;
    }
    if (ch === "/" && peek(1) === "/") {
      let text = "";
      while (i < source.length && peek() !== "\n") text += advance();
      emit(T.COMMENT, text);
      continue;
    }
    if (ch === "-" && peek(1) === "-" && peek(2) === "-" && peek(3) === "-" && peek(4) === "-") {
      let sep = "";
      while (i < source.length && peek() === "-") sep += advance();
      emit(T.SEPARATOR, sep);
      continue;
    }
    if (ch === "." && peek(1) === "." && peek(2) === ".") {
      advance();
      advance();
      advance();
      emit(T.UNDETERMINED, "...");
      continue;
    }
    if (ch === '"') {
      advance();
      let str = "";
      const ouvert = { line, col };
      for (; ; ) {
        while (i < source.length && peek() !== '"') str += advance();
        if (i >= source.length) {
          throw new LexError("LEX_TEXT_UNCLOSED", {}, ouvert.line, ouvert.col);
        }
        advance();
        if (peek() === '"') {
          str += advance();
          continue;
        }
        break;
      }
      emit(T.STRING, str);
      continue;
    }
    if (ch === "`") {
      const ouvert = { line, col };
      let n = 0;
      while (peek() === "`") {
        advance();
        n++;
      }
      const cloture = "`".repeat(n);
      let code = "";
      for (; ; ) {
        if (i >= source.length) {
          throw new LexError("LEX_CODE_BLOCK_UNCLOSED", { n, s: n > 1 ? "s" : "" }, ouvert.line, ouvert.col);
        }
        if (peek() === "`" && source.startsWith(cloture, i) && source[i + n] !== "`") {
          i += n;
          col += n;
          break;
        }
        code += advance();
      }
      emit(T.BACKTICK, code);
      continue;
    }
    if (ch === "|" && peek(1) === "[") {
      advance();
      advance();
      let inner = "";
      while (i < source.length && peek() !== "]") inner += advance();
      if (i < source.length) advance();
      emit(T.COMPOUND, inner.replace(/\s+/g, ""));
      tokens[tokens.length - 1].parties = inner.trim().split(/\s+/).filter(Boolean);
      continue;
    }
    if (ch === "<") {
      if (peek(1) === "!") {
        advance();
        advance();
        emit(T.TRIGGER_IN, "<!");
        continue;
      }
      if (peek(1) === "-" && peek(2) === ">") {
        advance();
        advance();
        advance();
        emit(T.ARROW_BI, "<->");
        continue;
      }
      if (peek(1) === "-") {
        advance();
        advance();
        emit(T.ARROW_L, "<-");
        continue;
      }
      if (peek(1) === ">") {
        advance();
        advance();
        emit(T.ARROW_BI, "<>");
        continue;
      }
      if (peek(1) === "=") {
        advance();
        advance();
        emit(T.LTE, "<=");
        continue;
      }
      advance();
      emit(T.LT, "<");
      continue;
    }
    if (ch === "-" && peek(1) === "-") {
      let j = 1;
      while (peek(j) === "-") j++;
      if (peek(j) === ">") {
        const fleche = "-".repeat(j) + ">";
        throw new LexError("LEX_NATIVE_ARROW", { fleche }, line, col);
      }
    }
    if (ch === "-" && peek(1) === ">") {
      advance();
      advance();
      emit(T.ARROW_R, "->");
      continue;
    }
    if (ch === ">" && peek(1) === "=") {
      advance();
      advance();
      emit(T.GTE, ">=");
      continue;
    }
    if (ch === ">") {
      advance();
      emit(T.GT, ">");
      continue;
    }
    if (ch === "=" && peek(1) === "=") {
      advance();
      advance();
      emit(T.EQ, "==");
      continue;
    }
    if (ch === "!" && peek(1) === "=") {
      advance();
      advance();
      emit(T.NEQ, "!=");
      continue;
    }
    if (ch === "*") {
      advance();
      emit(T.STAR, "*");
      continue;
    }
    const singles = {
      "@": T.AT,
      "{": T.LBRACE,
      "}": T.RBRACE,
      ",": T.COMMA,
      "(": T.LPAREN,
      ")": T.RPAREN,
      ":": T.COLON,
      "=": T.EQUALS,
      "[": T.LBRACKET,
      "]": T.RBRACKET,
      "-": T.REST,
      "_": T.PROLONG,
      ".": T.PERIOD,
      "!": T.BANG,
      "#": T.HASH,
      "?": T.QUESTION,
      "$": T.DOLLAR,
      "&": T.AMPERSAND,
      "~": T.TILDE,
      "|": T.PIPE,
      "+": T.PLUS,
      "/": T.SLASH
    };
    if (singles[ch]) {
      if (ch === "[") _profCrochet++;
      if (ch === "]") _profCrochet = Math.max(0, _profCrochet - 1);
      advance();
      emit(singles[ch], ch);
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      let num = "";
      while (i < source.length && peek() >= "0" && peek() <= "9") num += advance();
      if (peek() === "." && peek(1) >= "0" && peek(1) <= "9") {
        num += advance();
        while (i < source.length && peek() >= "0" && peek() <= "9") num += advance();
        emit(T.FLOAT, num);
      } else {
        emit(T.INT, num);
      }
      continue;
    }
    if (ch >= "a" && ch <= "z" || ch >= "A" && ch <= "Z") {
      let id = "";
      while (i < source.length) {
        const p = peek();
        if (p >= "a" && p <= "z" || p >= "A" && p <= "Z" || p >= "0" && p <= "9" || p === "#" || p === "'" || p === '"') {
          id += advance();
        } else if (p === "_") {
          const after = source[i + 1];
          if (after !== void 0 && /[a-zA-Z0-9]/.test(after)) {
            id += advance();
          } else {
            break;
          }
        } else {
          break;
        }
      }
      if (peek() === "-" && peek(1) !== ">" && _profCrochet === 0) {
        while (peek() === "-" && peek(1) !== ">") {
          id += advance();
          while (i < source.length && (peek() >= "a" && peek() <= "z" || peek() >= "A" && peek() <= "Z" || peek() >= "0" && peek() <= "9" || peek() === "_" || peek() === "#" || peek() === "'" || peek() === '"')) {
            id += advance();
          }
        }
      }
      if (KEYWORDS[id]) {
        emit(KEYWORDS[id], id);
      } else {
        emit(T.IDENT, id);
      }
      while (i < source.length && peek() === "_") {
        advance();
        emit(T.PROLONG, "_");
      }
      continue;
    }
    const aide = CARACTERES_CONNUS_MAIS_ETRANGERS.get(ch) ?? "ce caract\xE8re n'a aucun sens dans le langage \u2014 v\xE9rifier la frappe (docs/spec/LANGUAGE.md).";
    throw new LexError("LEX_UNEXPECTED_CHAR", { ch, aide }, line, col);
  }
  emit(T.EOF, null);
  refuserUnPointACheval(tokens);
  return tokens;
}
function refuserUnPointACheval(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== T.PERIOD) continue;
    const suivant = tokens[i + 1];
    const finDeLigne = !suivant || suivant.type === T.NEWLINE || suivant.type === T.EOF;
    const separeAvant = !!tokens[i].spaceBefore;
    const separeApres = finDeLigne ? true : !!suivant.spaceBefore;
    if (separeAvant === separeApres) continue;
    const gauche = i > 0 && tokens[i - 1].value != null ? String(tokens[i - 1].value) : "";
    const droite = finDeLigne ? "" : String(suivant.value ?? "");
    const { line, col } = tokens[i];
    if (!droite) {
      throw new LexError("LEX_DOT_TRAILING", { gauche }, line, col);
    }
    throw new LexError("LEX_DOT_HALF_ATTACHED", {
      ecrit: `${gauche}${separeAvant ? " " : ""}.${separeApres ? " " : ""}${droite}`,
      cote: separeAvant ? "D\xC9TACH\xC9 \xE0 gauche et COLL\xC9 \xE0 droite" : "COLL\xC9 \xE0 gauche et D\xC9TACH\xC9 \xE0 droite",
      gauche,
      droite
    }, line, col);
  }
}

export {
  texteDuDiagnostic,
  diagnostic,
  LexError,
  T,
  tokenize
};
