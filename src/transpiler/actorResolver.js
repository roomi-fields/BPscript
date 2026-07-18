// AUTORITÉ résolution acteur / pitch / contrôles : LIRE src/transpiler/_AUTORITE.md avant de modifier.
/**
 * BPScript Actor Resolver
 *
 * Resolves actor bindings at compile time:
 * 1. Loads each actor's alphabet → expands terminals (notes × alterations × registers)
 * 2. Builds symbolActorMap: terminal → actor(s) that own it
 * 3. Resolves implicit actor on Symbol nodes (when unambiguous)
 * 4. Detects conflicts (ambiguous symbol without dot notation)
 *
 * Called between parser and encoder. If no actors are declared, returns empty tables.
 */

import { loadLib } from './libs.js';

/**
 * Expand an alphabet lib into a set of terminal names.
 * Mirrors the logic in libs.js loadLibsFromDirectives (terminal generation).
 *
 * @param {Object} alphabetLib - alphabet entry from alphabets.json (has notes, alterations, octaves)
 * @returns {Set<string>} set of terminal names
 */
function expandAlphabetTerminals(alphabetLib, octavesOverride) {
  const terminals = new Set();
  if (!alphabetLib || !alphabetLib.notes) return terminals;

  // Resolve octave convention. Décision cles-acteur-six (Romain 2026-06-16) :
  // `@actor X octaves.Y` SURCHARGE la convention de registre ; sinon défaut =
  // convention héritée de l'alphabet (alphabetLib.octaves).
  const octaveConvention = octavesOverride != null ? octavesOverride : alphabetLib.octaves;
  const octaveDef = octaveConvention ? loadLib('octaves')?.[octaveConvention] : null;

  const alts = alphabetLib.alterations && typeof alphabetLib.alterations === 'object'
      && !Array.isArray(alphabetLib.alterations)
    ? Object.keys(alphabetLib.alterations)
    : (Array.isArray(alphabetLib.alterations) && alphabetLib.alterations.length > 0
        ? alphabetLib.alterations : ['']);

  for (const note of alphabetLib.notes) {
    if (octaveDef) {
      for (const alt of alts) {
        for (const reg of octaveDef.registers) {
          const noteAlt = note + alt;
          const terminal = octaveDef.position === 'suffix'
            ? noteAlt + octaveDef.separator + reg
            : reg + octaveDef.separator + noteAlt;
          terminals.add(terminal);
        }
      }
    } else {
      // No octaves — raw notes (e.g. tabla, abc)
      terminals.add(note);
    }
  }

  return terminals;
}

/**
 * Resolve actors for the AST.
 *
 * @param {Object} ast - parsed Scene AST (with actors[] and subgrammars[])
 * @returns {{ actorTable: Object, terminalActorMap: Object, errors: Array }}
 *
 * actorTable: { actorName → { alphabet, scale, sounds, transport, eval, symbols: string[] } }
 * terminalActorMap: { terminalName → actorName }
 */
function resolveActors(ast) {
  const errors = [];
  const actorTable = {};
  const terminalActorMap = {};

  // Un renvoi POINTÉ (`sitar.C4`) doit désigner un acteur DÉCLARÉ — y compris quand la scène
  // n'en déclare aucun, cas qui filait autrefois par le retour anticipé ci-dessous.
  verifierActeursReferences(ast, errors);

  if (!ast.actors || ast.actors.length === 0) {
    return { actorTable, terminalActorMap, errors };
  }

  // 1. Build actor table — load alphabet for each actor, expand terminals
  const symbolActorMap = new Map(); // terminal → Set<actorName>

  for (const actor of ast.actors) {
    const name = actor.name;
    const props = actor.properties;
    let alphabetKey = props.alphabet;

    // Voix-code (eval présent) : porte du code étranger, pas un vocabulaire de notes →
    // alphabet OPTIONNEL (pas d'héritage). Cf. docs/design/ACTOR.md §2.
    const isCodeVoice = !!props.eval;

    // RESOLVER-CASCADE-ALPHABET (modèle Romain 2026-07-13) : la cascade de défauts s'applique
    // AUSSI à l'alphabet — « PAS D'ALPHABET » N'EXISTE PAS. Un acteur sans alphabet HÉRITE :
    // scène (@alphabet.X) → sinon socle @core (western, lib/core.json defaults.components). On ne
    // REJETTE JAMAIS pour 'no alphabet' (le rejet violait la cascade — bug §71 : bloquait le son
    // d'une scène + acteur transport-seul). Loi 35 : si la scène INVOQUE une hauteur OPAQUE
    // (@mine./@factory. libRef, résolue par Kairos), l'alphabet reste ABSENT ici (l'aval le
    // remplit — @mine/@factory n'est qu'un préfixe de PROVENANCE, décision 2026-07-13) ; le socle
    // @core ne s'applique QUE si RIEN n'est invoqué. Une voix-code n'hérite pas (pas de notes).
    if (!alphabetKey && !isCodeVoice) {
      const sceneAlpha = (ast.directives || []).find((d) => d.name === 'alphabet' && d.subkey);
      const sceneInvokesOpaquePitch = !!(ast.libRefs && ast.libRefs.length);
      if (sceneAlpha) {
        alphabetKey = sceneAlpha.subkey;                                  // héritage de scène (résolvable)
      } else if (!sceneInvokesOpaquePitch) {
        alphabetKey = loadLib('core')?.defaults?.components?.alphabet || null; // socle @core
      }
      // sinon (hauteur opaque invoquée) : alphabetKey reste absent → Kairos résout (loi 35).
      if (alphabetKey) props.alphabet = alphabetKey;                      // matérialise l'héritage dans l'AST
    }

    // Expand terminals depuis l'alphabet (voix de notes) ; voix-code = pas de terminaux.
    let terminals = [];
    if (alphabetKey) {
      const alphabetLib = loadLib('alphabet', alphabetKey);
      if (!alphabetLib) {
        errors.push({ message: `Alphabet "${alphabetKey}" not found for actor "${name}"`, line: actor.line });
        continue;
      }
      // props.octaves surcharge la convention de registre de l'alphabet (décision cles-acteur-six).
      terminals = [...expandAlphabetTerminals(alphabetLib, props.octaves)];
      // expandAlphabetTerminals ne produit que les formes DÉCORÉES de registre (madhya_sa…).
      // La forme NUE (registre par défaut : `sa`) est la façon idiomatique d'écrire une note et
      // est reconnue par validateTerminals (bpxAst.js:639-641). Sans elle ICI, une note nue
      // n'est attribuée à AUCUN acteur → orpheline → muette avec un acteur explicite (aucun
      // `default` synthétique pour la recueillir). On l'ajoute au vocabulaire de l'acteur.
      const alts = alphabetLib.alterations && typeof alphabetLib.alterations === 'object' && !Array.isArray(alphabetLib.alterations)
        ? Object.keys(alphabetLib.alterations) : [''];
      for (const note of (alphabetLib.notes || [])) for (const alt of alts) terminals.push(note + alt);
    }

    actorTable[name] = {
      alphabet: alphabetKey || null,
      scale: props.scale || null,
      // v0.8 : la clé canonique est `sound` (singulier) ; on lit aussi `sounds`
      // pour rétrocompat avec les sorties de parseur antérieures.
      sounds: props.sound || props.sounds || null,
      transport: props.transport || null,
      eval: props.eval || null,
      symbols: terminals,
    };

    // Register each terminal → actor
    for (const terminal of terminals) {
      if (!symbolActorMap.has(terminal)) {
        symbolActorMap.set(terminal, new Set());
      }
      symbolActorMap.get(terminal).add(name);
    }
  }

  // 2. Build terminalActorMap from declarations (gate Sa:sitar)
  //    Declarations with a runtime that matches an actor name → actor binding
  const actorNames = new Set(Object.keys(actorTable));

  for (const decl of (ast.declarations || [])) {
    if (decl.runtime && actorNames.has(decl.runtime)) {
      terminalActorMap[decl.name] = decl.runtime;
    }
  }

  // 3. Walk AST — resolve implicit actor on Symbol nodes + detect conflicts
  for (const sg of (ast.subgrammars || [])) {
    for (const rule of (sg.rules || [])) {
      resolveSymbolsInRhs(rule.rhs, symbolActorMap, actorTable, terminalActorMap, errors);
    }
  }

  return { actorTable, terminalActorMap, errors };
}

/**
 * Garde des renvois pointés — FAIL-LOUD (2026-07-18).
 *
 * `sitar.C4` nomme l'acteur qui porte le terminal. Un nom NON DÉCLARÉ était accepté en
 * silence : le préfixe survivait dans l'AST, aucun consommateur ne le reconnaissait, et le
 * terminal retombait sur les défauts de scène. MESURÉ : dans une scène où `sitar` est déclaré
 * avec `tuning.western_just`, `sitar.C4` sonne 264.00 Hz ; `inconnu.C4` sonne 261.63 Hz —
 * exactement comme si aucun acteur n'était écrit. Une faute de frappe sur un nom d'acteur
 * changeait donc la HAUTEUR sans un mot, jusqu'au bout de la chaîne (Kairos ne crie pas : il
 * ne peut pas savoir qu'un nom qu'il ne connaît pas était censé exister).
 *
 * Le mauvais silence n'est pas ici l'absence d'erreur, c'est le REPLI : se rabattre sur un
 * défaut plausible masque la faute au lieu de la révéler.
 *
 * Rayon de casse mesuré AVANT durcissement (règle de frontière, CLAUDE.md) : 0 sur les 93
 * scènes de `test/grammars`, et sur les 188 `.bps` du corpus BPx les 2 seules scènes à
 * notation pointée (`kai9_actor_address`, `kai10_pitch_config`) DÉCLARENT leurs acteurs
 * (`@actor bass…`, `@actor lead…`) — donc aucune ne casse.
 */
function verifierActeursReferences(ast, errors) {
  const declares = new Set((ast.actors || []).map((a) => a.name));
  const vus = new Set();

  const visiter = (elements) => {
    if (!elements) return;
    for (const el of elements) {
      if (!el || typeof el !== 'object') continue;
      if (el.actor && !declares.has(el.actor) && !vus.has(el.actor)) {
        vus.add(el.actor);
        const connus = declares.size
          ? `Acteurs déclarés : ${[...declares].join(', ')}.`
          : "Cette scène ne déclare aucun acteur.";
        errors.push({
          message: `Acteur inconnu '${el.actor}' dans '${el.actor}.${el.name}'`
            + ` — un renvoi pointé doit nommer un acteur déclaré par @actor. ${connus}`,
          line: el.line,
        });
      }
      // Un acteur peut se nicher dans une voix polymétrique ou un groupe.
      if (el.voices) for (const voix of el.voices) visiter(voix);
      if (el.primary) visiter([el.primary]);
      if (el.secondaries) visiter(el.secondaries);
      if (el.elements) visiter(el.elements);
    }
  };

  for (const sg of (ast.subgrammars || [])) {
    for (const rule of (sg.rules || [])) {
      visiter(rule.rhs);
      visiter(rule.lhs);
    }
  }
}

/**
 * Attribue un acteur à un nœud sonnant. TROU 2 (décision Romain
 * 2026-07-03-note-nue-ch-implique-sortie-midi.md) : SEUL le payload voyage dans
 * l'arbre dérivé (BPx types/node.ts:619 — Kairos lit `node.payload.actor`).
 * Écrire `el.actor` sans `el.payload.actor` = feuille droppée en aval. Les DEUX.
 */
function assignActor(el, actorName) {
  el.actor = actorName;
  if (el.payload && typeof el.payload === 'object') el.payload.actor = actorName;
}

/**
 * Walk RHS elements recursively, resolving actor on Symbol/SymbolCall nodes.
 */
function resolveSymbolsInRhs(elements, symbolActorMap, actorTable, terminalActorMap, errors) {
  if (!elements) return;

  for (const el of elements) {
    // TROU 1 (même décision) : un SymbolCall (note nue AVEC suffixe, ex `E4(ch:5)`)
    // porte l'acteur au même titre qu'un Symbol — même attribution implicite, même
    // erreur d'ambiguïté (option A tranchée : REJET, pas d'héritage intra-règle).
    if (el.type === 'Symbol' || el.type === 'SymbolCall') {
      if (el.actor) {
        // Explicit dot notation: sitar.Sa → already resolved by parser
        terminalActorMap[el.name] = el.actor;
      } else {
        // Implicit: check symbolActorMap
        const actors = symbolActorMap.get(el.name);
        if (actors && actors.size === 1) {
          // Unambiguous — assign actor implicitly
          const actorName = [...actors][0];
          assignActor(el, actorName);
          terminalActorMap[el.name] = actorName;
        } else if (actors && actors.size > 1) {
          // Ambiguous — check if declaration resolved it
          if (!terminalActorMap[el.name]) {
            const actorList = [...actors].join(', ');
            errors.push({
              message: `Ambiguous symbol "${el.name}" — owned by actors: ${actorList}. Use dot notation (e.g. ${[...actors][0]}.${el.name}) or declare with gate ${el.name}:<actor>`,
              line: el.line,
            });
          } else {
            // Declaration resolved it — propagate to element
            assignActor(el, terminalActorMap[el.name]);
          }
        }
        // If symbol is not in any actor's alphabet, leave actor null (not an actor-managed terminal)
      }
    }

    // Recurse into nested structures
    if (el.type === 'Polymetric' && el.voices) {
      for (const voice of el.voices) {
        resolveSymbolsInRhs(voice, symbolActorMap, actorTable, terminalActorMap, errors);
      }
    }
    if (el.type === 'SimultaneousGroup') {
      if (el.primary) resolveSymbolsInRhs([el.primary], symbolActorMap, actorTable, terminalActorMap, errors);
      if (el.secondaries) resolveSymbolsInRhs(el.secondaries, symbolActorMap, actorTable, terminalActorMap, errors);
    }
  }
}

export { resolveActors, expandAlphabetTerminals };
