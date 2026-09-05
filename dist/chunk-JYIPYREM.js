import {
  ParseError,
  brancherLeCompilateur,
  canaux,
  clesDActeur,
  describeVocabulary,
  famille,
  familles,
  formeDuMot,
  groupeDUnicite,
  leRegistre,
  lesDefauts,
  librairiesQuiDeclarent,
  loadLib,
  loadLibsFromDirectives,
  motReserve,
  motsInvoques,
  nomsDeTerminaux,
  objet,
  parse,
  resolveActorAlphabet,
  resolveActorAlphabetSource,
  universeControlNames,
  versionDuRegistre
} from "./chunk-4DYSJXLL.js";
import {
  LexError,
  diagnostic,
  tokenize
} from "./chunk-S3UVLV7L.js";

// src/transpiler/actorResolver.js
function expandAlphabetTerminals(alphabetLib, octavesOverride) {
  const terminals = /* @__PURE__ */ new Set();
  if (!alphabetLib || !nomsDeTerminaux(alphabetLib)) return terminals;
  const octaveConvention = octavesOverride != null ? octavesOverride : alphabetLib.octaves;
  const candidate = octaveConvention && alphabetLib.resolvesPitch !== false ? loadLib("octaves", octaveConvention) : null;
  const octaveDef = candidate && Array.isArray(candidate.registers) ? candidate : null;
  const alts = alphabetLib.alterations && typeof alphabetLib.alterations === "object" && !Array.isArray(alphabetLib.alterations) ? Object.keys(alphabetLib.alterations) : Array.isArray(alphabetLib.alterations) && alphabetLib.alterations.length > 0 ? alphabetLib.alterations : [""];
  for (const note of nomsDeTerminaux(alphabetLib)) {
    if (octaveDef) {
      for (const alt of alts) {
        for (const reg of octaveDef.registers) {
          const noteAlt = note + alt;
          const terminal = octaveDef.position === "suffix" ? noteAlt + octaveDef.separator + reg : reg + octaveDef.separator + noteAlt;
          terminals.add(terminal);
        }
      }
    } else {
      terminals.add(note);
    }
  }
  return terminals;
}
function alphabetHerite(ast) {
  const sceneAlpha = (ast.directives || []).find((d) => d.name === "alphabet" && d.subkey);
  if (sceneAlpha) {
    return resolveActorAlphabet(sceneAlpha.subkey, ast.directives) ? sceneAlpha.subkey : null;
  }
  return (lesDefauts(ast) || {}).alphabet || null;
}
function octavesHerite(ast, alphabetKey) {
  const connu = (nom) => {
    if (!nom) return false;
    const o2 = objet(`octaves.${nom}`);
    return !!(o2 && !o2.ambigu);
  };
  const sceneOct = (ast.directives || []).find((d) => d.name === "octaves" && (d.subkey || d.runtime));
  if (sceneOct) {
    const nom = sceneOct.subkey || sceneOct.runtime;
    return connu(nom) ? nom : void 0;
  }
  if (!alphabetKey) return void 0;
  const o = objet(`alphabet.${alphabetKey}`);
  const oct = o && !o.ambigu ? o.membres.octaves : void 0;
  return connu(oct) ? oct : void 0;
}
function tuningHerite(ast, alphabetKey) {
  const connu = (nom) => !!(nom && loadLib("tuning", nom));
  const sceneTun = (ast.directives || []).find((d) => d.name === "tuning" && d.subkey);
  if (sceneTun) return connu(sceneTun.subkey) ? sceneTun.subkey : void 0;
  if (!alphabetKey) return void 0;
  const lib = resolveActorAlphabet(alphabetKey, ast.directives);
  return connu(lib && lib.tuning) ? lib.tuning : void 0;
}
function defaultActorTransport(ast) {
  return (lesDefauts(ast) || {}).transport || "audio";
}
function sortieHeritee(ast) {
  const sceneOut = (ast.directives || []).find((d) => d.name === "out" && d.subkey);
  const alphaBinding = (ast.directives || []).find((d) => d.name === "alphabet" && d.runtime);
  if (sceneOut && alphaBinding && alphaBinding.runtime !== sceneOut.subkey) {
    return {
      key: sceneOut.subkey,
      params: sceneOut.params || {},
      conflit: {
        ecrite: sceneOut.subkey,
        raccord: alphaBinding.runtime,
        alphabet: alphaBinding.subkey,
        line: sceneOut.line || 0
      }
    };
  }
  if (sceneOut) return { key: sceneOut.subkey, params: sceneOut.params || {}, conflit: null };
  if (alphaBinding) return { key: alphaBinding.runtime, params: {}, conflit: null };
  return { key: defaultActorTransport(ast), params: {}, conflit: null };
}
function evalHerite(ast) {
  const sceneEval = (ast.directives || []).find((d) => d.name === "eval" && d.subkey);
  if (!sceneEval) return void 0;
  const connus = new Set((famille("eval")?.entrees || []).map((o) => o.nom));
  return connus.has(sceneEval.subkey) ? sceneEval.subkey : void 0;
}
function resolveActors(ast) {
  const errors = [];
  const actorTable = {};
  const terminalActorMap = {};
  verifierActeursReferences(ast, errors);
  if (!ast.actors || ast.actors.length === 0) {
    return { actorTable, terminalActorMap, errors };
  }
  const symbolActorMap = /* @__PURE__ */ new Map();
  for (const actor of ast.actors) {
    const name = actor.name;
    const props = actor.properties;
    let alphabetKey = props.alphabet;
    const herite = [];
    if (!alphabetKey) {
      alphabetKey = alphabetHerite(ast);
      if (alphabetKey) {
        props.alphabet = alphabetKey;
        herite.push({ category: "alphabet", name: alphabetKey });
      }
    }
    if (props.octaves == null && alphabetKey) {
      const oct = octavesHerite(ast, alphabetKey);
      if (oct) {
        props.octaves = oct;
        herite.push({ category: "octaves", name: oct });
      }
    }
    if (props.tuning == null && alphabetKey) {
      const tun = tuningHerite(ast, alphabetKey);
      if (tun) {
        props.tuning = tun;
        herite.push({ category: "tuning", name: tun });
      }
    }
    if (props.transport == null) {
      const sortie = sortieHeritee(ast);
      props.transport = { type: "TransportRef", key: sortie.key, params: sortie.params };
      herite.push({ category: "transport", name: sortie.key, params: sortie.params });
    }
    if (props.eval == null) {
      const interprete = evalHerite(ast);
      if (interprete) {
        props.eval = interprete;
        herite.push({ category: "eval", name: interprete });
      }
    }
    for (const ref of herite) {
      actor.references = actor.references || [];
      if (!actor.references.some((r) => r.category === ref.category)) {
        actor.references.push({ type: "ActorReference", line: actor.line, ...ref });
      }
    }
    let terminals = [];
    if (alphabetKey) {
      const alphabetLib = resolveActorAlphabet(alphabetKey, ast.directives);
      if (!alphabetLib) {
        errors.push(diagnostic("ACTOR_ALPHABET_FOUND_ACTOR", { alphabetKey, name }, { line: actor.line }));
        continue;
      }
      terminals = [...expandAlphabetTerminals(alphabetLib, props.octaves)];
      const alts = alphabetLib.alterations && typeof alphabetLib.alterations === "object" && !Array.isArray(alphabetLib.alterations) ? Object.keys(alphabetLib.alterations) : [""];
      for (const note of nomsDeTerminaux(alphabetLib) || []) for (const alt of alts) terminals.push(note + alt);
    }
    actorTable[name] = {
      alphabet: alphabetKey || null,
      scale: props.scale || null,
      // v0.8 : la clé canonique est `sound` (singulier) ; on lit aussi `sounds`
      // pour rétrocompat avec les sorties de parseur antérieures.
      sounds: props.sound || props.sounds || null,
      transport: props.transport || null,
      eval: props.eval || null,
      symbols: terminals
    };
    for (const terminal of terminals) {
      if (!symbolActorMap.has(terminal)) {
        symbolActorMap.set(terminal, /* @__PURE__ */ new Set());
      }
      symbolActorMap.get(terminal).add(name);
    }
  }
  const actorNames = new Set(Object.keys(actorTable));
  for (const decl of ast.declarations || []) {
    if (decl.runtime && actorNames.has(decl.runtime)) {
      terminalActorMap[decl.name] = decl.runtime;
    }
  }
  for (const sg of ast.subgrammars || []) {
    for (const rule of sg.rules || []) {
      resolveSymbolsInRhs(rule.rhs, symbolActorMap, actorTable, terminalActorMap, errors);
    }
  }
  return { actorTable, terminalActorMap, errors };
}
function verifierActeursReferences(ast, errors) {
  const declares = new Set((ast.actors || []).map((a) => a.name));
  if (declares.size === 0) declares.add("scene");
  for (const d of ast.directives || []) {
    if (d && d.name === "homomorphism" && d.subkey) declares.add(d.subkey);
  }
  const vus = /* @__PURE__ */ new Set();
  const visiter = (elements) => {
    if (!elements) return;
    for (const el of elements) {
      if (!el || typeof el !== "object") continue;
      if (el.actor && !declares.has(el.actor) && !vus.has(el.actor)) {
        vus.add(el.actor);
        const connus = declares.size ? `Declared actors: ${[...declares].join(", ")}.` : "This scene declares no actor.";
        errors.push(diagnostic("ACTOR_UNKNOWN_ACTOR_DOTTED_REFERENCE", { p1: el.actor, p2: el.name, connus }, { line: el.line }));
      }
      if (el.voices) for (const voix of el.voices) visiter(voix);
      if (el.primary) visiter([el.primary]);
      if (el.secondaries) visiter(el.secondaries);
      if (el.elements) visiter(el.elements);
    }
  };
  for (const sg of ast.subgrammars || []) {
    for (const rule of sg.rules || []) {
      visiter(rule.rhs);
      visiter(rule.lhs);
    }
  }
}
function assignActor(el, actorName) {
  el.actor = actorName;
  if (el.payload && typeof el.payload === "object") el.payload.actor = actorName;
}
function resolveSymbolsInRhs(elements, symbolActorMap, actorTable, terminalActorMap, errors) {
  if (!elements) return;
  for (const el of elements) {
    if (el.type === "Symbol" || el.type === "SymbolCall") {
      if (el.actor) {
        terminalActorMap[el.name] = el.actor;
      } else {
        const actors = symbolActorMap.get(el.name);
        if (actors && actors.size === 1) {
          const actorName = [...actors][0];
          assignActor(el, actorName);
          terminalActorMap[el.name] = actorName;
        } else if (actors && actors.size > 1) {
          if (!terminalActorMap[el.name]) {
            const actorList = [...actors].join(", ");
            errors.push(diagnostic("ACTOR_AMBIGUOUS_SYMBOL_OWNED_ACTORS", { p1: el.name, actorList, p2: [...actors][0] }, { line: el.line }));
          } else {
            assignActor(el, terminalActorMap[el.name]);
          }
        }
      }
    }
    if (el.type === "Polymetric" && el.voices) {
      for (const voice of el.voices) {
        resolveSymbolsInRhs(voice, symbolActorMap, actorTable, terminalActorMap, errors);
      }
    }
    if (el.type === "SimultaneousGroup") {
      if (el.primary) resolveSymbolsInRhs([el.primary], symbolActorMap, actorTable, terminalActorMap, errors);
      if (el.secondaries) resolveSymbolsInRhs(el.secondaries, symbolActorMap, actorTable, terminalActorMap, errors);
    }
  }
}

// src/transpiler/resolution.js
function* noeuds(n, vus = /* @__PURE__ */ new Set()) {
  if (!n || typeof n !== "object" || vus.has(n)) return;
  vus.add(n);
  if (Array.isArray(n)) {
    for (const e of n) yield* noeuds(e, vus);
    return;
  }
  yield n;
  for (const k of Object.keys(n)) yield* noeuds(n[k], vus);
}
function declarationsDe(ast) {
  const table = /* @__PURE__ */ new Map();
  const poser = (nom, parent, noeud) => {
    if (!nom || table.has(nom)) return;
    table.set(nom, { parent, noeud, origine: [...noeud.settings && noeud.settings.pairs || []] });
  };
  for (const d of ast && ast.defs || []) if (d) poser(d.name, null, d);
  for (const v of ast && ast.vars || []) {
    if (!v || !v.varType || v.varType.kind !== "type") continue;
    for (const n of v.names || []) poser(n, v.varType.type, v);
  }
  return table;
}
function heriterDesPrototypes(ast) {
  const table = declarationsDe(ast);
  let greffes = 0;
  for (const [nom, decl] of table) {
    if (!decl.parent) continue;
    const portees = new Set(decl.origine.map((p) => p.key));
    const vus = /* @__PURE__ */ new Set([nom]);
    let parent = decl.parent;
    while (parent && !vus.has(parent) && table.has(parent)) {
      vus.add(parent);
      const proto = table.get(parent);
      for (const par of proto.origine) {
        if (portees.has(par.key)) continue;
        portees.add(par.key);
        if (!decl.noeud.settings) decl.noeud.settings = { type: "SettingBag", pairs: [] };
        decl.noeud.settings.pairs.push({ ...par, herite: true });
        greffes++;
      }
      parent = proto.parent;
    }
  }
  return greffes;
}
function resoudre(ast, environnement) {
  const diagnostics = [];
  let examines = 0;
  for (const _ of noeuds(ast)) examines++;
  const greffes = heriterDesPrototypes(ast);
  void environnement;
  return { ast, diagnostics, examines, greffes };
}
function emitSceneMeter(ast) {
  const dir = (ast.directives || []).find((d) => d && d.name === "meter" && d.value != null);
  if (!dir) return;
  const valeur = String(dir.value);
  for (const sg of ast.subgrammars || []) {
    for (const r of sg.rules || []) {
      const porteDeja = (r.settings?.pairs || []).some((p) => p && p.key === "meter");
      if (porteDeja) continue;
      r.settings = r.settings || { type: "SettingBag", pairs: [] };
      r.settings.pairs.push({ key: "meter", value: valeur, decrement: null });
    }
  }
}
function refuserEsclaveSansMaitre(ast) {
  const maitres = /* @__PURE__ */ new Set();
  const esclaves = [];
  let ancre = false;
  (function marcher(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const e of n) marcher(e);
      return;
    }
    if (n.type === "TemplateMaster" && n.name) maitres.add(n.name);
    if (n.type === "TemplateAnchor") ancre = true;
    if (n.type === "TemplateSlave" && n.name) esclaves.push(n);
    for (const k in n) marcher(n[k]);
  })(ast);
  if (ancre) return [];
  const vus = /* @__PURE__ */ new Set();
  const erreurs = [];
  for (const e of esclaves) {
    if (maitres.has(e.name) || vus.has(e.name)) continue;
    vus.add(e.name);
    erreurs.push(diagnostic("RESOLVE_REPLAY_WITHOUT_MASTER", { name: e.name }, { line: e.line }));
  }
  return erreurs;
}
function poserLaVoixDesTerminaux(ast) {
  if (!ast) return;
  const parDef = /* @__PURE__ */ new Map();
  for (const d of ast.defs || []) {
    if (d && d.type === "DefDirective" && d.keys && d.keys.voice) parDef.set(d.name, d.keys.voice.value);
  }
  if (!parDef.size) return;
  const w = (n, vus = /* @__PURE__ */ new WeakSet()) => {
    if (!n || typeof n !== "object" || vus.has(n)) return;
    vus.add(n);
    if (Array.isArray(n)) {
      n.forEach((x) => w(x, vus));
      return;
    }
    if (n.payload && n.payload.nature === "sounding") {
      const nom = typeof n.symbol === "string" ? n.symbol : n.name;
      const voix = parDef.get(nom);
      if (voix !== void 0 && n.payload.voice === void 0) n.payload.voice = voix;
    }
    Object.values(n).forEach((v) => w(v, vus));
  };
  w(ast.subgrammars);
}
function retirerArdoiseAlphabet(ast) {
  for (const actor of ast.actors || []) {
    if (!actor.libRefs || !actor.libRefs.length) continue;
    if (actor.properties) delete actor.properties.alphabet;
    if (Array.isArray(actor.references)) {
      actor.references = actor.references.filter((r) => r && r.category !== "alphabet");
    }
  }
}
function applyDefaultActor(ast) {
  if (!ast) return [];
  const errors = [];
  const alphaBinding = (ast.directives || []).find((d) => d.name === "alphabet" && d.runtime);
  if ((ast.actors || []).length > 0) {
    if (alphaBinding) {
      errors.push(diagnostic("RESOLVE_OVERLAPPING_ACTORS_OUTPUT_BINDING", { p1: alphaBinding.subkey, p2: alphaBinding.runtime }, { line: alphaBinding.line || 0 }));
    }
    return errors;
  }
  const sortie = sortieHeritee(ast);
  if (sortie.conflit) {
    errors.push(diagnostic("RESOLVE_OUTPUTS_SAME_SCENE_OUT", { p1: sortie.conflit.ecrite, p2: sortie.conflit.alphabet, p3: sortie.conflit.raccord }, { line: sortie.conflit.line }));
  }
  const transportKey = sortie.key;
  const transport = { type: "TransportRef", key: transportKey, params: sortie.params };
  const alphabetKey = alphabetHerite(ast);
  const properties = { transport };
  const references = [{ type: "ActorReference", category: "transport", name: transportKey, line: 0 }];
  if (alphabetKey) {
    properties.alphabet = alphabetKey;
    references.push({ type: "ActorReference", category: "alphabet", name: alphabetKey, line: 0 });
    const oct = octavesHerite(ast, alphabetKey);
    if (oct) {
      properties.octaves = oct;
      references.push({ type: "ActorReference", category: "octaves", name: oct, line: 0 });
    }
    const tun = tuningHerite(ast, alphabetKey);
    if (tun) {
      properties.tuning = tun;
      references.push({ type: "ActorReference", category: "tuning", name: tun, line: 0 });
    }
  }
  const interprete = evalHerite(ast);
  if (interprete) {
    properties.eval = interprete;
    references.push({ type: "ActorReference", category: "eval", name: interprete, line: 0 });
  }
  ast.actors = [{
    type: "ActorDirective",
    name: "scene",
    properties,
    references,
    // Frontière AST (Palier 3) : pas de `soundAssignments:null` — champ non canonique.
    // Canonique = `assignments?` OPTIONNEL (absent ici : l'acteur implicite n'affecte aucun son).
    synthetic: true,
    // acteur implicite (aucun actor déclaré) — panneau Acteurs vide
    line: 0
  }];
  return errors;
}
function hasTempoDirective(ast) {
  return (ast.directives || []).some(
    (d) => d && d.type === "Directive" && d.name === "tempo"
  );
}
function applyEnvironmentDefaults(ast, env) {
  if (!ast || !env || typeof env !== "object") return;
  if (env.tempo != null && !hasTempoDirective(ast)) {
    (ast.directives = ast.directives || []).push({
      type: "Directive",
      name: "tempo",
      subkey: null,
      runtime: null,
      value: env.tempo,
      modifiers: null,
      fromEnvironment: true,
      // provenance : défaut d'environnement, pas déclaré dans la source
      line: 0
    });
  }
}
function canonicalizeLhsContext(ctx, line, asRuleContext) {
  const symbols = ctx.symbols || [];
  const single = symbols.length === 1;
  const allLiteral = symbols.every((s) => !isCtxWildcardName(s));
  const negated = ctx.positive === false;
  if (single && allLiteral && negated) {
    return { inline: { type: "Symbol", name: symbols[0], negated: true, line } };
  }
  if (single && !allLiteral) {
    if (symbols[0] === "?") return { inline: { type: "Wildcard", negated, line } };
    return { inline: { type: "Variable", index: parseInt(symbols[0].slice(1), 10), negated, line } };
  }
  const elements = symbols.map((s) => ctxSymbolToElement(s, line));
  if (asRuleContext) {
    return { remote: {
      type: "Context",
      side: "left",
      positive: !negated,
      kind: "remote",
      elements,
      symbols: [...symbols],
      line
    } };
  }
  return { remote: { type: "Context", negated, elements, line } };
}
function canonicalizeLhsElement(el) {
  if (!el || typeof el !== "object" || el.type !== "Context") return el;
  if (Array.isArray(el.elements)) return el;
  const conv = canonicalizeLhsContext(el, el.line ?? 0, false);
  return conv.inline || conv.remote;
}
function canonicalizeRhsElement(el) {
  if (!el || typeof el !== "object") return el;
  if (el.type === "Context") {
    const symbols = el.symbols || [];
    if (symbols.length === 1 && el.positive === false) {
      return { type: "Wildcard", negated: true };
    }
    return el;
  }
  if (el.type === "Polymetric" && Array.isArray(el.voices)) {
    return { ...el, voices: el.voices.map((v) => v.map((c) => canonicalizeRhsElement(c))) };
  }
  return el;
}
function canonicalizeContexts(ast) {
  for (const sub of ast.subgrammars || []) {
    for (const rule of sub.rules || []) {
      if (Array.isArray(rule.contexts) && rule.contexts.length > 0) {
        rule.contexts = rule.contexts.map((ctx) => enrichRemoteHeadContext(ctx, rule.line ?? 0));
      }
      if (INLINE_FLIP_PALIER4) {
        const seq = [];
        const remoteMarks = [];
        for (const ctx of rule.contexts || []) {
          if (ctx && Array.isArray(ctx.elements)) {
            const mark = { __remote: ctx };
            seq.push(mark);
            remoteMarks.push(mark);
            continue;
          }
          const conv = canonicalizeLhsContext(ctx, rule.line ?? 0, true);
          if (conv.inline) {
            seq.push(conv.inline);
          } else {
            const mark = { __remote: conv.remote };
            seq.push(mark);
            remoteMarks.push(mark);
          }
        }
        const assembled = [...seq, ...rule.lhs];
        const declared = [];
        for (const mark of remoteMarks) {
          const i = assembled.indexOf(mark);
          const rc = mark.__remote;
          if (i === 0) declared.push({ ...rc, side: "left" });
          else if (i === assembled.length - 1) declared.push({ ...rc, side: "right" });
          else {
            throw new ParseError(
              "RESOLVE_REMOTE_CONTEXT_MID_PATTERN",
              {},
              { line: rule.line ?? 0, col: 0 }
            );
          }
        }
        rule.lhs = assembled.filter((x) => !x || !x.__remote);
        rule.contexts = declared;
        rule.lhs = rule.lhs.map(canonicalizeLhsElement);
        rule.rhs = rule.rhs.map(canonicalizeRhsElement);
      }
    }
  }
}
function ctxSymbolToElement(sym, line) {
  if (sym === "?") return { type: "Wildcard", line };
  if (CTX_METAVAR_RE.test(sym)) return { type: "Variable", index: parseInt(sym.slice(1), 10), line };
  return { type: "Symbol", name: sym, line };
}
function enrichRemoteHeadContext(ctx, line) {
  if (!ctx || typeof ctx !== "object" || Array.isArray(ctx.elements)) return ctx;
  const symbols = ctx.symbols || [];
  const single = symbols.length === 1;
  const allLiteral = symbols.every((s) => !isCtxWildcardName(s));
  const inlineCategory = single && (!allLiteral || ctx.positive === false);
  if (inlineCategory) return ctx;
  return {
    type: "Context",
    positive: ctx.positive !== false,
    kind: "remote",
    elements: symbols.map((s) => ctxSymbolToElement(s, line)),
    symbols: ctx.symbols,
    line
  };
}
var INLINE_FLIP_PALIER4 = true;
var CTX_METAVAR_RE = /^\?\d+$/;
var isCtxWildcardName = (s) => s === "?" || CTX_METAVAR_RE.test(s);
function canalFautif(canal) {
  const cat = canaux();
  const c = cat[canal];
  if (!c) return `channel '${canal}' does not exist \u2014 the channels are ${Object.keys(cat).join(", ")}. The list is CLOSED.`;
  if (!c.out) return `'${canal}' is not an output \u2014 a terminal sounds, it is not read. The output channels are ${Object.keys(cat).filter((k) => cat[k].out).join(", ")}.`;
  if (!c.writable) return `'${canal}' is a DESTINATION of the architecture, routed like the other outputs, but WRITING it in a scene is still waiting for its dedicated device.`;
  return null;
}
function nomsDeclares(ast) {
  const declared = /* @__PURE__ */ new Set();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) (r.lhs || []).forEach((s) => s && declared.add(s.name));
  for (const d of ast.declarations || []) if (d && d.name) declared.add(d.name);
  for (const d of ast.defs || []) {
    if (d && d.type === "DefDirective" && d.name) declared.add(d.name);
  }
  for (const s of ast.scenes || []) if (s && s.name) declared.add(s.name);
  for (const d of ast.directives || []) if (d.name === "homomorphism" && d.subkey) declared.add(d.subkey);
  for (const h of ast.homomorphisms || []) if (h && h.name) declared.add(h.name);
  for (const d of ast.directives || []) if (d.name === "timepatterns" && Array.isArray(d.timePatterns)) {
    for (const tp of d.timePatterns) if (tp && tp.name) declared.add(tp.name);
  }
  for (const v of ast.vars || []) for (const n of v?.names || []) declared.add(n);
  return declared;
}
function validateCallVocabulary(ast, known, declared, codeVoice, anyAlphabet) {
  const errors = [];
  const seen = /* @__PURE__ */ new Set();
  const citer = (el) => {
    const parts = (el.args || []).map((a) => {
      const v = a && a.value ? a.value : a;
      const texte = v && Object.prototype.hasOwnProperty.call(v, "value") ? v.value : v;
      return (a && a.key ? `${a.key}:` : "") + texte;
    });
    return `${el.name}(${parts.join(" ")})`;
  };
  const visiter = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(visiter);
      return;
    }
    if (n.type === "SymbolCall" && n.name && !(n.payload && codeVoice.has(n.payload.actor)) && !known.has(n.name) && !declared.has(n.name) && !seen.has(n.name)) {
      const positionnel = (n.args || []).some((a) => a && a.key == null);
      if (anyAlphabet || positionnel) {
        seen.add(n.name);
        const auRegistre = universeControlNames().has(n.name);
        errors.push(diagnostic(
          auRegistre ? "RESOLVE_CALL_CONTROL_NOT_INVOKED" : "RESOLVE_CALL_DOES_NOT_EXIST",
          { appel: citer(n), name: n.name },
          { line: n.line }
        ));
      }
    }
    for (const k in n) {
      const v = n[k];
      if (v && typeof v === "object") visiter(v);
    }
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) visiter(r.rhs);
  return errors;
}
function terminauxEnPortee(ast) {
  const terminaux = /* @__PURE__ */ new Set();
  const paquets = [];
  const ajouter = (name, octaves) => {
    const lib = resolveActorAlphabet(name, ast.directives);
    if (!lib || !nomsDeTerminaux(lib)) return false;
    const paquet = /* @__PURE__ */ new Set();
    for (const t of expandAlphabetTerminals(lib, octaves)) {
      terminaux.add(t);
      paquet.add(t);
    }
    const alts = lib.alterations && typeof lib.alterations === "object" && !Array.isArray(lib.alterations) ? Object.keys(lib.alterations) : [""];
    for (const note of nomsDeTerminaux(lib)) for (const alt of alts) {
      terminaux.add(note + alt);
      paquet.add(note + alt);
    }
    paquets.push(paquet);
    return true;
  };
  let aUnAlphabet = false;
  const sceneAlpha = (ast.directives || []).find((d) => d.name === "alphabet" && d.subkey);
  const sceneOct = (ast.directives || []).find((d) => d.name === "octaves" && (d.subkey || d.runtime));
  if (sceneAlpha) {
    aUnAlphabet = ajouter(sceneAlpha.subkey, sceneOct ? sceneOct.subkey || sceneOct.runtime : null) || aUnAlphabet;
  }
  for (const a of ast.actors || []) {
    const p = a.properties || {};
    if (p.alphabet) aUnAlphabet = ajouter(p.alphabet, p.octaves || null) || aUnAlphabet;
  }
  for (const ref of ast.libRefs || []) {
    const parts = String(ref).split(".");
    const lib = loadLib(parts.slice(0, -1).join("."), parts[parts.length - 1]);
    if (!lib || !nomsDeTerminaux(lib)) continue;
    aUnAlphabet = ajouter(parts[parts.length - 1], sceneOct ? sceneOct.subkey || sceneOct.runtime : null) || aUnAlphabet;
  }
  for (const d of ast.defs || []) {
    if (d && d.type === "DefDirective" && d.kind === "terminal" && d.name) {
      terminaux.add(d.name);
      for (const paquet of paquets) paquet.add(d.name);
    }
  }
  return { terminaux, aUnAlphabet, paquets };
}
function validateTerminals(ast) {
  if (!ast) return [];
  const errors = [];
  const codeVoice = new Set((ast.actors || []).filter((a) => (a.properties || {}).eval).map((a) => a.name));
  const { terminaux: known, aUnAlphabet: anyAlphabet } = terminauxEnPortee(ast);
  const declared = nomsDeclares(ast);
  errors.push(...validateCallVocabulary(ast, known, declared, codeVoice, anyAlphabet));
  const seen = /* @__PURE__ */ new Set();
  const COMPOSITES = ["voices", "elements", "content", "symbol", "triggers", "primary", "secondaries"];
  const verifier = (el) => {
    if (!el || typeof el !== "object") return;
    if (Array.isArray(el)) {
      el.forEach(verifier);
      return;
    }
    if (el.type === "Symbol" && Array.isArray(el.compose) && el.compose.length) {
      for (const part of el.compose) {
        if (/^[-_.]+$/.test(part) || /[{},]/.test(part)) continue;
        if (known.has(part) || declared.has(part) || seen.has(part)) continue;
        seen.add(part);
        errors.push(diagnostic("RESOLVE_COMPOUND_SOUND_OBJECT_DECLARED", { part }, { line: el.line }));
      }
      return;
    }
    if ((el.type === "Symbol" || el.type === "OutTimeObject") && el.name && el.role !== "homomorphism" && !(el.payload && codeVoice.has(el.payload.actor)) && !known.has(el.name) && !declared.has(el.name) && !seen.has(el.name)) {
      seen.add(el.name);
      const reste = restesDeSegmentation.get(el);
      const ligne = (ast.directives || []).find((d) => d && d.type === "Directive" && d.name === el.name && typeof d.runtime === "string");
      const cause = ligne && canalFautif(ligne.runtime);
      errors.push(diagnostic(
        cause ? "RESOLVE_TERMINAL_DECL_CHANNEL" : !anyAlphabet ? "RESOLVE_TERMINAL_NO_ALPHABET" : reste && reste !== el.name ? "RESOLVE_TERMINAL_SEGMENTATION_STOPPED" : "RESOLVE_TERMINAL_UNDECLARED",
        { name: el.name, runtime: ligne && ligne.runtime, cause, reste },
        { line: el.line }
      ));
    }
    for (const k of COMPOSITES) if (el[k]) verifier(el[k]);
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) verifier(r.rhs || []);
  const sujetsVus = /* @__PURE__ */ new Set();
  const verifierLesSujets = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(verifierLesSujets);
      return;
    }
    const s = n.subject;
    if (typeof s === "string" && s && s !== "*" && !codeVoice.has(s) && !known.has(s) && !declared.has(s) && !sujetsVus.has(s)) {
      sujetsVus.add(s);
      errors.push(diagnostic("RESOLVE_SETTING_SUBJECT_NAMES_TERMINAL", { s }, { line: n.line }));
    }
    for (const v of Object.values(n)) if (v && typeof v === "object") verifierLesSujets(v);
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) verifierLesSujets(r);
  return errors;
}
var restesDeSegmentation = /* @__PURE__ */ new WeakMap();
function emitSceneLibRefs(ast) {
  const axesHauteur = /* @__PURE__ */ new Set(["alphabet", "tuning", "octaves", "scale"]);
  const refs = [];
  for (const d of ast.directives || []) {
    if (!d || !d.name || !d.subkey || axesHauteur.has(d.name)) continue;
    const entree = loadLib(d.name, d.subkey);
    if (!entree) continue;
    const adresse = `${d.name}.${d.subkey}`;
    if (!refs.includes(adresse)) refs.push(adresse);
  }
  for (const e of ast.inputs || []) {
    if (!e || !e.mapping) continue;
    const adresse = `mapping.${e.mapping}`;
    if (!refs.includes(adresse)) refs.push(adresse);
  }
  if (refs.length === 0) return;
  ast.libRefs = [...ast.libRefs || [], ...refs.filter((r) => !(ast.libRefs || []).includes(r))];
}
function deriveAlphabetFromTuning(ast) {
  if (!ast) return;
  const tuningAlpha = (tname) => {
    const t = loadLib("tuning", tname);
    return t && t.alphabet || null;
  };
  for (const actor of ast.actors || []) {
    const p = actor.properties || {};
    if (p.tuning && !p.alphabet) {
      const a = tuningAlpha(p.tuning);
      if (a) p.alphabet = a;
    }
  }
  const dirs = ast.directives || [];
  const tun = dirs.find((d) => d.name === "tuning" && d.subkey);
  const alph = dirs.find((d) => d.name === "alphabet" && d.subkey);
  if (tun && !alph) {
    const a = tuningAlpha(tun.subkey);
    if (a) dirs.push({
      type: "Directive",
      name: "alphabet",
      subkey: a,
      runtime: null,
      value: null,
      aliases: null,
      modifiers: null,
      line: tun.line
    });
  }
}
function emitActorLibRefs(ast) {
  for (const actor of ast.actors || []) {
    const alpha = (actor.properties || {}).alphabet;
    if (!alpha) continue;
    const src = resolveActorAlphabetSource(alpha, ast.directives);
    if (!src || !src.lib) continue;
    actor.libRefs = [`${src.lib}.${alpha}`];
  }
}
function emitNoteTerminals(ast) {
  const { terminaux, aUnAlphabet } = terminauxEnPortee(ast);
  if (!aUnAlphabet) return;
  const presents = /* @__PURE__ */ new Set();
  const recolter = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(recolter);
    if (typeof n.name === "string") presents.add(n.name);
    for (const k in n) if (n[k] && typeof n[k] === "object") recolter(n[k]);
  };
  recolter(ast.subgrammars || []);
  const aHauteur = (nomAlphabet) => {
    const lib = resolveActorAlphabet(nomAlphabet, ast.directives);
    return !!(lib && lib.resolvesPitch);
  };
  const notes = /* @__PURE__ */ new Set();
  const sansHauteur = /* @__PURE__ */ new Set();
  const verser = (nomAlphabet, octaves) => {
    const lib = resolveActorAlphabet(nomAlphabet, ast.directives);
    if (!lib || !nomsDeTerminaux(lib)) return;
    const cible = aHauteur(nomAlphabet) ? notes : sansHauteur;
    for (const t of expandAlphabetTerminals(lib, octaves)) cible.add(t);
    const alts = lib.alterations && typeof lib.alterations === "object" && !Array.isArray(lib.alterations) ? Object.keys(lib.alterations) : [""];
    for (const note of nomsDeTerminaux(lib)) for (const alt of alts) cible.add(note + alt);
  };
  const sceneAlpha = (ast.directives || []).find((d) => d.name === "alphabet" && d.subkey);
  const sceneOct = (ast.directives || []).find((d) => d.name === "octaves" && (d.subkey || d.runtime));
  if (sceneAlpha) verser(sceneAlpha.subkey, sceneOct ? sceneOct.subkey || sceneOct.runtime : null);
  for (const a of ast.actors || []) {
    const p = a.properties || {};
    if (p.alphabet) verser(p.alphabet, p.octaves || null);
  }
  const dansLaScene = (ens) => [...presents].filter((n) => ens.has(n)).sort();
  ast.noteTerminals = dansLaScene(notes);
  ast.alphabetTerminals = dansLaScene(sansHauteur);
}
function resolveHomomorphismMarkers(ast) {
  if (!ast || !Array.isArray(ast.homomorphisms) || ast.homomorphisms.length === 0) return;
  const homoNames = new Set(ast.homomorphisms.map((h) => h && h.name).filter(Boolean));
  if (homoNames.size === 0) return;
  const nonterminals = /* @__PURE__ */ new Set();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) (r.lhs || []).forEach((s) => s && s.name && nonterminals.add(s.name));
  const terminals = /* @__PURE__ */ new Set();
  const addAlphabet = (name, octaves) => {
    const lib = resolveActorAlphabet(name, ast.directives);
    if (!lib || !nomsDeTerminaux(lib)) return;
    for (const t of expandAlphabetTerminals(lib, octaves)) terminals.add(t);
    const alts = lib.alterations && typeof lib.alterations === "object" && !Array.isArray(lib.alterations) ? Object.keys(lib.alterations) : [""];
    for (const note of nomsDeTerminaux(lib)) for (const alt of alts) terminals.add(note + alt);
  };
  const sa = (ast.directives || []).find((d) => d.name === "alphabet" && d.subkey);
  const so = (ast.directives || []).find((d) => d.name === "octaves" && (d.subkey || d.runtime));
  if (sa) addAlphabet(sa.subkey, so ? so.subkey || so.runtime : null);
  for (const a of ast.actors || []) {
    const p = a.properties || {};
    if (p.alphabet) addAlphabet(p.alphabet, p.octaves || null);
  }
  const mark = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(mark);
      return;
    }
    if (node.type === "Symbol" && node.name && homoNames.has(node.name) && !nonterminals.has(node.name) && !terminals.has(node.name)) {
      node.role = "homomorphism";
    }
    for (const k in node) {
      const v = node[k];
      if (v && typeof v === "object") mark(v);
    }
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) mark(r.rhs);
}
function annotateBackticks(ast) {
  let counter = 0;
  const isBt = (el) => el && (el.type === "BacktickStandalone" || el.type === "BacktickInline");
  const label = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== "object") continue;
      if (isBt(el)) {
        el._btName = `BT${el.tag || "auto"}${counter++}`;
        el.payload = { ...el.payload || {}, nature: "code", interp: el.tag || "auto" };
      }
      if (el.elements) label(el.elements);
      if (el.voices) for (const v of el.voices) label(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) label(rule.rhs);
  const acteurEval = {};
  for (const a of ast.actors || []) if (a.properties && a.properties.eval) acteurEval[a.name] = a.properties.eval;
  const sceneEval = (ast.directives || []).find((d) => d.name === "eval" && (d.subkey || d.runtime));
  const socleEval = (lesDefauts(ast) || {}).eval;
  const parDefaut = sceneEval && (sceneEval.subkey || sceneEval.runtime) || socleEval || null;
  const resoudre2 = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== "object") continue;
      if (isBt(el) && el.payload && el.payload.interp === "auto") {
        const proche = el.actor && acteurEval[el.actor] || parDefaut;
        if (proche) el.payload.interp = proche;
      }
      if (el.elements) resoudre2(el.elements);
      if (el.voices) for (const v of el.voices) resoudre2(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) resoudre2(rule.rhs);
  if (parDefaut) {
    const poser = (n) => {
      if (n && typeof n === "object" && /^Backtick/.test(n.type || "") && !n.tag) n.tag = parDefaut;
    };
    for (const b of ast.backticks || []) poser(b);
    for (const e of ast.init || []) poser(e);
    for (const d of ast.defs || []) if (d && d.kind === "code" && !d.tag) d.tag = parDefaut;
    for (const dec of ast.declarations || []) if (dec && dec.curve && !dec.curve.tag) dec.curve.tag = parDefaut;
  }
  const errors = [];
  const scanOrphans = (els) => {
    for (const el of els || []) {
      if (!el || typeof el !== "object") continue;
      if (isBt(el) && el.payload && el.payload.interp === "auto") {
        errors.push(diagnostic("RESOLVE_BACKTICK_LANGUAGE_MUST_KNOWN", {}, { line: el.line }));
      }
      if (el.elements) scanOrphans(el.elements);
      if (el.voices) for (const v of el.voices) scanOrphans(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) scanOrphans(rule.rhs);
  return errors;
}
function poserLeDestinataireDesReglages(ast, libCtx) {
  const table = libCtx?.controlResolvedBy || {};
  const tableQualifiee = libCtx?.controlQualifiedResolvedBy || {};
  const vu = /* @__PURE__ */ new Set();
  const walk = (n) => {
    if (!n || typeof n !== "object" || vu.has(n)) return;
    vu.add(n);
    if (Array.isArray(n)) {
      for (const x of n) walk(x);
      return;
    }
    const params = n.payload && n.payload.params;
    if (params && typeof params === "object") {
      const origine = /* @__PURE__ */ new Map();
      const noter = (liste) => {
        for (const pr of liste || []) if (pr && pr.lib) origine.set(pr.key, pr.lib);
      };
      noter(n.pairs);
      for (const sq of n.suffixQualifiers || []) noter(sq && sq.pairs);
      const dest = {};
      for (const cle of Object.keys(params)) {
        const lib = origine.get(cle);
        const qualifie = lib ? tableQualifiee[`${lib}.${cle}`] : void 0;
        if (qualifie) dest[cle] = qualifie;
        else if (table[cle]) dest[cle] = table[cle];
      }
      if (Object.keys(dest).length) n.payload.resolvedBy = dest;
    }
    for (const v of Object.values(n)) walk(v);
  };
  walk(ast);
}
function refuserCleDeCrochetInconnue(ast, libCtx) {
  const erreurs = [];
  if (!libCtx || !libCtx.controlNames) return erreurs;
  const vus = /* @__PURE__ */ new Set();
  (function marcher(n, ligne) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const e of n) marcher(e, ligne);
      return;
    }
    const ici = typeof n.line === "number" ? n.line : ligne;
    if (n.type === "Qualifier") {
      for (const paire of n.pairs || []) {
        const cle = paire && paire.key;
        if (!cle || paire.value === true || vus.has(cle)) continue;
        if (libCtx.controlNames.has(cle) || libCtx.runtimeBagControls?.has(cle)) continue;
        vus.add(cle);
        erreurs.push(diagnostic("PARSE_UNKNOWN_KEY_KEY_NEITHER", { key: cle }, { line: ici }));
      }
    }
    for (const k in n) marcher(n[k], ici);
  })(ast, void 0);
  return erreurs;
}
function refuserAttenteNonDeclaree(ast) {
  const connus = /* @__PURE__ */ new Set();
  for (const i of ast.inputs || []) for (const n of i.names || (i.name ? [i.name] : [])) connus.add(n);
  for (const v of ast.vars || []) for (const n of v.names || []) connus.add(n);
  for (const d of ast.declarations || []) if (d && d.name) connus.add(d.name);
  for (const a of ast.actors || []) if (a && a.name) connus.add(a.name);
  const directions = /* @__PURE__ */ new Set();
  for (const canal of Object.values(canaux())) {
    if (!canal || typeof canal !== "object") continue;
    for (const [cle, valeur] of Object.entries(canal)) {
      if (typeof valeur === "boolean" && valeur === true && cle !== "writable") directions.add(cle);
    }
  }
  const erreurs = [];
  const vus = /* @__PURE__ */ new Set();
  (function marcher(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const e of n) marcher(e);
      return;
    }
    if (n.type === "Wait" && typeof n.name === "string" && !connus.has(n.name) && !directions.has(n.name) && !vus.has(n.name)) {
      vus.add(n.name);
      erreurs.push(diagnostic("RESOLVE_WAIT_UNDECLARED", { name: n.name }, { line: n.line }));
    }
    for (const k in n) marcher(n[k]);
  })(ast);
  return erreurs;
}
function refuserNomsEnDouble(ast, libCtx) {
  const erreurs = [];
  const { terminaux } = terminauxEnPortee(ast);
  const creesParDeclaration = /* @__PURE__ */ new Map();
  const noter = (nom, cle, sorte, line) => {
    if (!nom || typeof nom !== "string") return;
    if (creesParDeclaration.has(nom)) {
      const p = creesParDeclaration.get(nom);
      erreurs.push(diagnostic("RESOLVE_NAME_ALREADY_TAKEN", {
        nom,
        sortePrise: p.sorte,
        ou: p.line ? ` on line ${p.line}` : "",
        sorte
      }, { line }));
      return;
    }
    creesParDeclaration.set(nom, { cle, sorte, line });
    if (terminaux.has(nom)) {
      erreurs.push(diagnostic("RESOLVE_NAME_SHADOWS_TERMINAL", { nom, sorte }, { line }));
    }
  };
  for (const e of ast.inputs || []) noter(e?.name, "input", "an input", e?.line);
  for (const v of ast.vars || []) {
    const racine = v?.varType?.kind === "type" && v.varType.type === null;
    const cle = v?.varType?.kind === "flag" ? "flag" : racine ? "definition" : "working-var";
    const sorte = { flag: "a flag", definition: "a definition", "working-var": "a working variable" }[cle];
    for (const n of v?.names || []) noter(n, cle, sorte, v?.line);
  }
  for (const a of ast.actors || []) if (!a?.synthetic) noter(a?.name, "actor", "an actor", a?.line);
  for (const sc of ast.scenes || []) noter(sc?.name, "scene", "a scene", sc?.line);
  for (const d of ast.defs || []) {
    if (d && d.type === "DefDirective" && d.kind !== "terminal") {
      noter(d.name, "definition", "a definition", d.line);
    }
  }
  const LEVEES = /* @__PURE__ */ new Set(["working-var"]);
  const tetesVues = /* @__PURE__ */ new Set();
  for (const sg of ast.subgrammars || []) {
    for (const r of sg.rules || []) {
      const tetes = (r.lhs || []).filter((t) => t && !t.negated);
      if (tetes.length !== 1) continue;
      for (const t of tetes) {
        const nom = t?.name;
        if (!nom || tetesVues.has(nom)) continue;
        tetesVues.add(nom);
        const declare = creesParDeclaration.get(nom);
        if (declare && !LEVEES.has(declare.cle)) {
          erreurs.push(diagnostic(
            "RESOLVE_RULE_NAME_ALREADY_TAKEN",
            { nom, sorte: declare.sorte },
            { line: r.line }
          ));
        }
      }
    }
  }
  const drapeaux = /* @__PURE__ */ new Set();
  const collecterDrapeaux = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(collecterDrapeaux);
      return;
    }
    if ((n.type === "FlagExpr" || n.type === "Guard") && typeof n.flag === "string") drapeaux.add(n.flag);
    for (const v of Object.values(n)) collecterDrapeaux(v);
  };
  collecterDrapeaux(ast.subgrammars);
  const tetesDeRegle = /* @__PURE__ */ new Map();
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) {
    for (const t of r.lhs || []) if (t?.name && !t.negated && !tetesDeRegle.has(t.name)) {
      tetesDeRegle.set(t.name, r.line);
    }
  }
  for (const nom of drapeaux) {
    const declare = creesParDeclaration.get(nom);
    if (declare && declare.cle !== "flag") {
      erreurs.push(diagnostic("RESOLVE_FLAG_NAME_ALREADY_TAKEN", {
        nom,
        sorte: declare.sorte,
        ou: declare.line ? ` on line ${declare.line}` : ""
      }));
      continue;
    }
    if (tetesDeRegle.has(nom)) {
      erreurs.push(diagnostic("RESOLVE_FLAG_NAMES_RULE", {
        nom,
        ou: tetesDeRegle.get(nom) ? ` on line ${tetesDeRegle.get(nom)}` : ""
      }));
      continue;
    }
    if (terminaux.has(nom)) {
      erreurs.push(diagnostic("RESOLVE_FLAG_NAMES_TERMINAL", { nom }));
      continue;
    }
    if (libCtx?.controlNames?.has(nom)) {
      erreurs.push(diagnostic("RESOLVE_FLAG_NAMES_SETTING", { nom }));
      continue;
    }
  }
  return erreurs;
}
function applySceneValues(ast, libCtx) {
  const registry = libCtx && libCtx.valueRegistry || {};
  const errors = [...libCtx && libCtx.valueRegistryErrors || []];
  const names = Object.keys(registry);
  if (!names.length) return errors;
  const versNombre = (spec, v) => {
    if (!Array.isArray(spec.range) || typeof v !== "string") return v;
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : v;
  };
  const checkDomain = (name, spec, v, line) => {
    if (Array.isArray(spec.range) && typeof v !== "number") {
      errors.push(diagnostic("RESOLVE_NUMBER_EXPECTED", { name, v, p1: spec.range[0], p2: spec.range[1], p3: spec.unit ? " " + spec.unit : "" }, { line }));
      return false;
    }
    if (typeof v === "number" && Array.isArray(spec.range) && spec.range.length === 2 && (v < spec.range[0] || v > spec.range[1])) {
      errors.push(diagnostic("RESOLVE_OUT_RANGE", { name, v, p1: spec.range[0], p2: spec.range[1], p3: spec.unit ? " " + spec.unit : "" }, { line }));
      return false;
    }
    if (Array.isArray(spec.values) && !spec.values.includes(v)) {
      errors.push(diagnostic("RESOLVE_UNKNOWN_VALUE_ALLOWED", { name, v, p1: spec.values.join(", ") }, { line }));
      return false;
    }
    return true;
  };
  const sceneVals = {};
  for (const d of ast.directives || []) {
    const spec = registry[d.name];
    if (!spec) continue;
    if (d.value == null) {
      errors.push(diagnostic("RESOLVE_EXPECTS_VALUE_NAME", { p1: d.name }, { line: d.line }));
      continue;
    }
    const valeur = versNombre(spec, d.value);
    if (checkDomain(d.name, spec, valeur, d.line)) sceneVals[d.name] = valeur;
  }
  const defaultComponents = libCtx && libCtx.defaultComponents || {};
  const sceneComponent = (axis) => {
    const d = (ast.directives || []).find((x) => x.name === axis && x.subkey);
    return d ? d.subkey : void 0;
  };
  const hasNeutralPitch = !!(ast.libRefs && ast.libRefs.length);
  const cascadeDefault = (spec, props) => {
    if (spec.overriddenBy) {
      const chain = Array.isArray(spec.overriddenBy) ? spec.overriddenBy : [spec.overriddenBy];
      let anyAxisDeclared = false;
      for (const ref of chain) {
        const [axis, field] = ref.split(".");
        let compName = props && props[axis] || sceneComponent(axis);
        if (compName == null) {
          const axisInvoked = (ast.directives || []).some((x) => x.name === axis) || hasNeutralPitch;
          if (axisInvoked) {
            anyAxisDeclared = true;
            continue;
          }
          compName = defaultComponents[axis];
        }
        if (compName) {
          const comp = loadLib(axis, compName);
          if (comp && comp[field] != null) return comp[field];
        }
      }
      return anyAxisDeclared ? void 0 : spec.default;
    }
    return spec.default;
  };
  for (const actor of ast.actors || []) {
    const props = actor.properties || {};
    const eParams = props.entityParams || {};
    for (const [axis, params] of Object.entries(eParams)) {
      const entree = props[axis];
      const propres = typeof entree === "string" && loadLib(axis, entree)?.parameters || null;
      for (const k of Object.keys(params)) {
        if (propres && propres[k] !== void 0) continue;
        if (!registry[k]) {
          errors.push(diagnostic("RESOLVE_NEITHER_PARAMETER_NOR_DECLARED", { axis, p1: entree ?? "\u2026", k, p2: entree ?? axis }, { line: actor.line }));
        }
      }
    }
    const vals = {};
    for (const name of names) {
      const spec = registry[name];
      let v;
      for (const params of Object.values(eParams)) {
        if (params && params[name] != null) v = params[name];
      }
      if (v === void 0 && sceneVals[name] !== void 0) v = sceneVals[name];
      if (v === void 0) v = cascadeDefault(spec, props);
      if (v === void 0) continue;
      v = versNombre(spec, v);
      if (checkDomain(name, spec, v, actor.line)) vals[name] = v;
    }
    if (Object.keys(vals).length) actor.values = vals;
  }
  const walkParams = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walkParams);
      return;
    }
    const p = node.payload && node.payload.params;
    if (p) {
      for (const [k, v] of Object.entries(p)) {
        if (registry[k]) checkDomain(k, registry[k], v, node.line);
      }
    }
    for (const k in node) {
      if (k !== "payload" && node[k] && typeof node[k] === "object") walkParams(node[k]);
    }
  };
  walkParams(ast.subgrammars);
  return errors;
}
function validateReferences(ast, libCtx = {}, environnement = {}) {
  const errors = [];
  const porteesPermises = chargerPorteesPermises(ast);
  const horsInvocation = (cle, line, col) => {
    const declarants = librairiesQuiDeclarent(cle);
    if (!declarants.length) return false;
    errors.push(diagnostic("RESOLVE_SCOPE_INVOKED_LIBRARY_DECLARES", { cle, p1: declarants.map((l) => `'${l}'`).join(" or ") }, { line, col }));
    return true;
  };
  const vocab = describeVocabulary([...ast.directives || [], ...ast.actors || []]);
  const controlNames = new Set(vocab.controls.map((c) => c.name));
  const registry = new Set(vocab.values.map((v) => v.name));
  const reserved = new Set(vocab.keywords);
  const digitalFns = new Set(vocab.functions);
  const addressKeys = new Set(vocab.addressKeys);
  const qualifierKeys = new Set(vocab.qualifierKeys);
  const catalogAxes = Object.keys(vocab.components);
  const componentExists = (axis, name) => (vocab.components[axis] || []).includes(name);
  const instancesDeclarees = new Set(
    (ast.vars || []).flatMap((v) => v && Array.isArray(v.names) ? v.names : [])
  );
  const MODES = ["fixed", "step", "cont"];
  const signauxDeclares = new Set(
    (ast.vars || []).filter((v) => v && v.varType && v.varType.kind === "convention").flatMap((v) => Array.isArray(v.names) ? v.names : [])
  );
  const estModeDeParametre = (k) => MODES.some((mode) => k.endsWith(mode) && signauxDeclares.has(k.slice(0, -mode.length)));
  const connuNu = (k) => controlNames.has(k) || registry.has(k) || addressKeys.has(k) || digitalFns.has(k) || qualifierKeys.has(k) || instancesDeclarees.has(k) || estModeDeParametre(k);
  const knownParamKey = (k) => {
    if (connuNu(k)) return true;
    const point = typeof k === "string" ? k.indexOf(".") : -1;
    return point > 0 && connuNu(k.slice(0, point));
  };
  const ambigus = libCtx.ambiguousControls || /* @__PURE__ */ new Set();
  const prefixesDe = (nom) => Object.keys(libCtx.controlsQualified || {}).filter((q) => q.endsWith(`.${nom}`)).sort();
  const vusAmbigus = /* @__PURE__ */ new Set();
  const signalerAmbiguite = (key, line, col) => {
    if (!ambigus.has(key) || vusAmbigus.has(key)) return;
    vusAmbigus.add(key);
    const choix = prefixesDe(key);
    errors.push(diagnostic("RESOLVE_DECLARED_LIBRARIES_CANNOT_WRITTEN", { key, p1: choix.length, p2: choix.map((c) => `'${c}:\u2026'`).join(" or ") }, { line, col }));
  };
  const canauxDeclares = new Set(Object.keys(canaux()));
  const realisationsPar = {};
  for (const [face, reals] of Object.entries(libCtx.implementations || {})) {
    const nom = face.slice(face.indexOf(".") + 1);
    const canaux2 = new Set(reals.map((q) => q.slice(0, q.indexOf("."))).filter((l) => canauxDeclares.has(l)));
    if (canaux2.size > 0) realisationsPar[nom] = canaux2;
  }
  const sortiesActives = [...new Set((ast.actors || []).map((a) => a && a.properties && a.properties.transport && a.properties.transport.key).filter((k) => typeof k === "string" && canauxDeclares.has(k)))];
  const vusSansRealisation = /* @__PURE__ */ new Set();
  const signalerRealisationManquante = (key, line, col) => {
    const canaux2 = realisationsPar[key];
    if (!canaux2 || vusSansRealisation.has(key) || sortiesActives.length === 0) return;
    const orphelines = sortiesActives.filter((s) => !canaux2.has(s));
    if (orphelines.length === 0) return;
    vusSansRealisation.add(key);
    errors.push(diagnostic("RESOLVE_GENERIC_WORD_EVERY_OUTPUT", { key, p1: orphelines.map((s) => `'${s}'`).join(" and "), p2: orphelines.length > 1 ? "" : "es", p3: [...canaux2].sort().map((c) => `'${c}.${key}'`).join(", ") }, { line, col }));
  };
  const evaluateurs = new Set(vocab.components && vocab.components.eval || []);
  const tagsVus = /* @__PURE__ */ new Set();
  const verifierTag = (tag, line, col) => {
    if (typeof tag !== "string" || !tag || evaluateurs.has(tag) || tagsVus.has(tag)) return;
    tagsVus.add(tag);
    errors.push(diagnostic("RESOLVE_NAMES_EVALUATOR_DECLARED_BACKTICK", { tag, p1: [...evaluateurs].sort().join(", ") }, { line, col }));
  };
  const vus = /* @__PURE__ */ new Map();
  const flag = (key, line, col, ecritNu = false) => {
    if (knownParamKey(key)) return;
    const deja = vus.get(key);
    if (deja) {
      if (deja.line === void 0 && line !== void 0) {
        deja.line = line;
        deja.col = col;
      }
      return;
    }
    if (librairiesQuiDeclarent(key).length) return;
    const err = diagnostic(
      "RESOLVE_UNKNOWN_ATTRIBUTE",
      { key, nu: ecritNu ? "" : ":\u2026" },
      { line, col }
    );
    vus.set(key, err);
    errors.push(err);
  };
  (function collect(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const el of node) collect(el);
      return;
    }
    if (typeof node.tag === "string" && typeof node.code === "string") {
      verifierTag(node.tag, node.line, node.col);
    }
    if (node.payload && node.payload.params) {
      const prefixees = /* @__PURE__ */ new Set();
      const noter = (liste) => {
        for (const pr of liste || []) if (pr && pr.lib) prefixees.add(pr.key);
      };
      noter(node.pairs);
      for (const sq of node.suffixQualifiers || []) noter(sq && sq.pairs);
      for (const k of Object.keys(node.payload.params)) {
        if (!prefixees.has(k)) {
          signalerAmbiguite(k, node.line);
          signalerRealisationManquante(k, node.line);
        }
        flag(k, node.line, void 0, node.payload.params[k] === true);
      }
    }
    if ((node.type === "SettingBag" || node.type === "Qualifier") && Array.isArray(node.pairs)) {
      for (const p of node.pairs) {
        if (node.type === "SettingBag") {
          if (!p.lib) {
            signalerAmbiguite(p.key, p.line, p.col);
            signalerRealisationManquante(p.key, p.line, p.col);
          }
          flag(p.key, p.line, p.col, p.value === true);
        }
        if (p.key === "mode") {
          errors.push(diagnostic("RESOLVE_MODE_LONGER_BELONGS_RULE", { p1: p.value ?? "<value>" }, { line: p.line, col: p.col }));
        }
      }
    }
    const place = REFUS_HORS_PORTEE_ACTIF ? PORTEE_DU_PORTEUR[node.type] : null;
    if (place) {
      for (const sac of [node.settings, node.qualifier, ...node.suffixQualifiers || []]) {
        if (!sac || !Array.isArray(sac.pairs)) continue;
        for (const p of sac.pairs) {
          const cle = String(p.key).split(".")[0];
          const permis = porteesPermises.get(cle, p.lib);
          if (!permis) {
            if (!p.lib) horsInvocation(cle, p.line ?? node.line, p.col);
            continue;
          }
          if (permis.includes(place)) continue;
          errors.push(diagnostic("RESOLVE_KEY_WRONG_PLACE", {
            cle,
            place: NOM_DE_PLACE[place],
            permis: permis.length === 1 ? `it holds ONLY ${NOM_DE_PLACE[permis[0]] ?? permis[0]}` : `it holds ${permis.slice(0, -1).map((s) => NOM_DE_PLACE[s] ?? s).join(", ")} or ${NOM_DE_PLACE[permis[permis.length - 1]] ?? permis[permis.length - 1]}`
          }, { line: p.line ?? node.line, col: p.col }));
        }
      }
    }
    for (const k in node) {
      if (k !== "params" && node[k] && typeof node[k] === "object") collect(node[k]);
    }
  })(ast.subgrammars);
  for (const e of ast.init || []) {
    if (e && typeof e.tag === "string" && typeof e.code === "string") verifierTag(e.tag, e.line, e.col);
  }
  if (REFUS_HORS_PORTEE_ACTIF) {
    const dire = (cle, place, line) => {
      const permis = porteesPermises.get(cle);
      if (!permis) {
        horsInvocation(cle, line);
        return;
      }
      if (permis.includes(place)) return;
      errors.push(diagnostic("RESOLVE_KEY_WRONG_PLACE", {
        cle,
        place: NOM_DE_PLACE[place],
        permis: permis.length === 1 ? `it holds ONLY ${NOM_DE_PLACE[permis[0]] ?? permis[0]}` : `it holds ${permis.slice(0, -1).map((x) => NOM_DE_PLACE[x] ?? x).join(", ")} or ${NOM_DE_PLACE[permis[permis.length - 1]] ?? permis[permis.length - 1]}`
      }, { line }));
    };
    for (const d of ast.directives || []) {
      if (!d || !d.name) continue;
      if (d.type && d.type !== "Directive") continue;
      if (environnement && environnement.librairie && (d.value != null || d.runtime != null)) continue;
      const clesEcrites = [];
      if (!loadLib(d.name)) clesEcrites.push(d.name);
      if (d.subkey && porteesPermises.has(d.subkey)) clesEcrites.push(d.subkey);
      for (const cle of clesEcrites) dire(cle, "scene", d.line);
    }
    for (const sg of ast.subgrammars || []) {
      for (const m of sg.modifiers || []) {
        const nom = typeof m === "string" ? m : m && m.name;
        if (nom) dire(nom, "subgrammar", sg.line);
      }
    }
  }
  const checkComponent = (axis, name, line) => {
    if (!name) return;
    if (componentExists(axis, name)) return;
    if (axis === "alphabet" && resolveActorAlphabet(name, ast.directives)) return;
    errors.push(diagnostic("RESOLVE_FOUND_CATALOG_REFERENCE_DOES", { axis, name }, { line }));
  };
  const motsDeclares = () => new Set(
    Object.values(leRegistre()).map((l) => l && typeof l === "object" ? l.resolves : null).filter(Boolean)
  );
  const libExiste = (nom) => motsDeclares().has(nom);
  const motsDuLangage = { has: (nom) => motReserve(nom) };
  for (const d of ast.directives || []) {
    if (!d || !d.name) continue;
    if (!d.subkey) {
      const fichierNu = leRegistre()[d.name];
      const motNu = fichierNu && typeof fichierNu === "object" ? fichierNu.resolves : null;
      if (motNu && motNu !== d.name) {
        errors.push(diagnostic("RESOLVE_FILE_NAME_WORD_INVOKES", { p1: d.name, motNu }, { line: d.line }));
      }
      continue;
    }
    if (catalogAxes.includes(d.name)) continue;
    if (!libExiste(d.name)) {
      if (motsDuLangage.has(d.name)) {
        if (clesDActeur().has(d.name)) continue;
        const forme = formeDuMot(d.name);
        errors.push(diagnostic("RESOLVE_LANGUAGE_WORD_NOT_QUALIFIED", {
          name: d.name,
          subkey: d.subkey,
          forme: forme ? ` \u2014 it is written '${forme}'.` : "."
        }, { line: d.line }));
        continue;
      }
      const fichier = leRegistre()[d.name];
      const motAEcrire = fichier && typeof fichier === "object" ? fichier.resolves : null;
      errors.push(diagnostic(
        motAEcrire ? "RESOLVE_AXIS_IS_FILE_NAME" : "RESOLVE_AXIS_SERVED_BY_NONE",
        { name: d.name, subkey: d.subkey, motAEcrire },
        { line: d.line }
      ));
      continue;
    }
    if (loadLib(d.name, d.subkey)) continue;
    errors.push(diagnostic("RESOLVE_ENTRY_DOES_EXIST_LIBRARY", { p1: d.name, p2: d.subkey }, { line: d.line }));
  }
  for (const e of ast.inputs || []) {
    if (!e || !e.mapping) continue;
    if (loadLib("mapping", e.mapping)) continue;
    errors.push({
      // ⛔ CE REFUS NOMMAIT UNE LIBRAIRIE QUI N'EXISTE PLUS. `lib/mapping.json` est retiré le
      // 2026-08-24 — décision de Romain, une place qui ne porte aucune donnée n'a pas de fichier —
      // et le message envoyait l'auteur « ajouter la table dans la librairie 'mapping' », c'est-à-dire
      // dans un fichier supprimé. Le refus est le domicile où l'auteur apprend la règle : il dit
      // désormais ce qui EST, à savoir qu'aucune librairie ne déclare de table.
      ...diagnostic(
        "RESOLVE_MAPPING_TABLE_UNDECLARED",
        { name: e.name, mapping: e.mapping },
        { line: e.line }
      )
    });
  }
  for (const d of ast.directives || []) {
    if (d.subkey && catalogAxes.includes(d.name)) {
      checkComponent(d.name, d.subkey, d.line);
      continue;
    }
    const declareAilleurs = librairiesQuiDeclarent(d.name).length > 0;
    if (d.value != null && d.value !== true && !registry.has(d.name) && !reserved.has(d.name) && !declareAilleurs) {
      errors.push(diagnostic("RESOLVE_UNKNOWN_VALUE_DECLARED_ANY", { p1: d.name }, { line: d.line }));
      continue;
    }
    if (d.subkey == null && d.runtime != null && !registry.has(d.name) && !reserved.has(d.name) && !declareAilleurs) {
      errors.push(diagnostic("RESOLVE_DECLARED_LOADED_LIBRARY_TOP", { p1: d.name, p2: d.runtime }, { line: d.line }));
      continue;
    }
    if (d.type && d.type !== "Directive") continue;
    if (d.value == null && !d.subkey && !d.runtime && !registry.has(d.name) && !reserved.has(d.name) && !loadLib(d.name) && !declareAilleurs) {
      errors.push(diagnostic("RESOLVE_DECLARED_LOADED_LIBRARY_TOP_2", { p1: d.name }, { line: d.line }));
    }
  }
  {
    const groupes = /* @__PURE__ */ new Map();
    const noter = (nom, line) => {
      if (!nom) return;
      const g = groupeDUnicite(nom);
      if (!g) return;
      if (!groupes.has(g)) groupes.set(g, []);
      groupes.get(g).push({ mot: nom, line });
    };
    for (const d of ast.directives || []) {
      if (!d || d.type && d.type !== "Directive") continue;
      if (environnement && environnement.librairie && (d.value != null || d.runtime != null)) continue;
      noter(d.name, d.line);
      for (const m of d.modifiers || []) noter(m && m.name, d.line);
    }
    for (const sg of ast.subgrammars || []) {
      for (const m of sg.modifiers || []) noter(m && m.name, sg.line);
    }
    for (const [groupe, vus2] of groupes) {
      if (vus2.length < 2) continue;
      const mots = [...new Set(vus2.map((v) => v.mot))];
      errors.push(diagnostic("RESOLVE_GROUP_SET_TWICE", {
        groupe,
        fois: vus2.length,
        mots: mots.map((m) => `'${m}'`).join(", "),
        remede: mots.length > 1 ? "These words set THE SAME THING: keep only one." : "Remove the extra occurrences."
      }, { line: vus2[vus2.length - 1].line }));
    }
  }
  const tuningAlphabet = (tname) => {
    const t = loadLib("tuning", tname);
    return t && t.alphabet || null;
  };
  const sceneComp = (axis) => {
    const d = (ast.directives || []).find((x) => x.name === axis && x.subkey);
    return d ? d.subkey : null;
  };
  const checkCoherence = (alphaName, tuningName, line) => {
    if (!alphaName || !tuningName) return;
    const ta = tuningAlphabet(tuningName);
    if (ta && ta !== alphaName) {
      errors.push(diagnostic("RESOLVE_ALPHABET_INCONSISTENT_TUNING_WHICH", { alphaName, tuningName, ta }, { line: line || 0 }));
    }
  };
  checkCoherence(sceneComp("alphabet"), sceneComp("tuning"), 0);
  for (const actor of ast.actors || []) checkCoherence((actor.properties || {}).alphabet, (actor.properties || {}).tuning, actor.line);
  for (const actor of ast.actors || []) {
    const props = actor.properties || {};
    for (const axis of catalogAxes) if (props[axis]) checkComponent(axis, props[axis], actor.line);
  }
  const lesCanaux = canaux();
  const directionsDeCanal = new Set(Object.values(lesCanaux).flatMap((c) => Object.entries(c || {}).filter(([, v]) => typeof v === "boolean").map(([k]) => k)));
  const clesDeSortie = new Set([...clesDActeur().keys()].filter((k) => directionsDeCanal.has(k) && !catalogAxes.includes(k)));
  for (const def of ast.defs || []) {
    if (!def || def.kind !== "terminal" || !def.keys) continue;
    for (const [axe, ref] of Object.entries(def.keys)) {
      if (!ref || ref.kind !== "ref" || !ref.value) continue;
      if (catalogAxes.includes(axe)) {
        checkComponent(axe, ref.value, def.line);
        continue;
      }
      if (!clesDeSortie.has(axe)) continue;
      const cause = canalFautif(ref.value);
      if (cause) errors.push(diagnostic("RESOLVE_TERMINAL", { p1: def.name, cause }, { line: def.line }));
    }
  }
  return errors;
}
function splitCompoundTerminals(ast, libCtx) {
  const terminals = singleCharAlphabetSet(libCtx);
  if (!terminals) return;
  for (const sub of ast.subgrammars || []) {
    for (const rule of sub.rules || []) {
      rule.lhs = rule.lhs.flatMap((el) => splitLhsElement(el, terminals));
      rule.rhs = rule.rhs.flatMap((el) => splitRhsElement(el, terminals));
    }
  }
}
function chargerPorteesPermises(ast) {
  const registre = leRegistre();
  const version = versionDuRegistre();
  if (_versionDesTables !== version) {
    _tablesDesPortees.clear();
    _versionDesTables = version;
  }
  const mots = ast ? motsInvoques(ast) : new Set(familles());
  const cleEnsemble = [...mots].sort().join(" ");
  if (_tablesDesPortees.has(cleEnsemble)) return _tablesDesPortees.get(cleEnsemble);
  const declarations = /* @__PURE__ */ new Map();
  const noter = (mot, cle, scope, implemente) => {
    if (!declarations.has(cle)) declarations.set(cle, []);
    declarations.get(cle).push({ mot, scope, implemente: typeof implemente === "string" ? implemente : null });
  };
  const marcher = (mot, o) => {
    for (const [k, v] of Object.entries(o || {})) {
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      if ("args" in v && "description" in v) {
        if (Array.isArray(v.scope) && v.bpscript !== false) noter(mot, k, v.scope, v.implements);
      } else marcher(mot, v);
    }
  };
  for (const [cle, lib] of Object.entries(registre)) {
    if (!lib || typeof lib !== "object" || cle.includes("/")) continue;
    const mot = typeof lib.resolves === "string" && lib.resolves || cle;
    if (!mots.has(mot)) continue;
    marcher(mot, lib);
    const adresses = lib.schema && lib.schema.addressKeys;
    if (adresses && !Array.isArray(adresses) && typeof adresses === "object") {
      for (const [k, def] of Object.entries(adresses)) {
        if (k.startsWith("_") || !def || !Array.isArray(def.scope)) continue;
        noter(mot, k, def.scope, null);
      }
    }
  }
  const m = /* @__PURE__ */ new Map();
  const ambigus = /* @__PURE__ */ new Map();
  for (const [cle, decls] of declarations) {
    if (decls.length === 1) {
      m.set(cle, decls[0].scope);
      continue;
    }
    const interfaces = decls.filter((d) => !d.implemente);
    const realisations = decls.filter((d) => d.implemente);
    const uneInterface = interfaces.length === 1 && realisations.every((r) => r.implemente === `${interfaces[0].mot}.${cle}`);
    if (uneInterface) {
      m.set(cle, interfaces[0].scope);
      continue;
    }
    ambigus.set(cle, decls.map((d) => d.mot));
  }
  const table = {
    // nu : la portée du mot s'il n'a qu'une déclaration (ou une interface) ; préfixé : celle de sa librairie
    get: (cle, lib) => lib ? (declarations.get(cle) || []).find((d) => d.mot === lib)?.scope : m.get(cle),
    has: (cle) => m.has(cle) || ambigus.has(cle)
  };
  _tablesDesPortees.set(cleEnsemble, table);
  return table;
}
function singleCharAlphabetSet(libCtx) {
  const terms = libCtx && libCtx.alphabetTerminals || [];
  if (terms.length === 0) return null;
  for (const t of terms) {
    if (typeof t !== "string" || t.length !== 1) return null;
  }
  return new Set(terms);
}
function splitLhsElement(el, terminals) {
  if (!el || el.type !== "Symbol") return [el];
  const toks = tokenizeCompoundName(el.name, terminals);
  if (toks === null || toks.some((t) => t.kind === "number")) return [el];
  return toks.map((t, i) => makeSplitAtom(el, t.text, i === 0));
}
function splitRhsElement(el, terminals) {
  if (!el || typeof el !== "object") return [el];
  if (el.type === "Symbol") {
    const toks = tokenizeCompoundName(el.name, terminals);
    if (toks === null) return [el];
    return toks.map((t, i) => t.kind === "number" ? { type: "NumericDuration", numerator: Number(t.text), denominator: 1 } : makeSplitAtom(el, t.text, i === 0));
  }
  if (el.type === "Polymetric" && Array.isArray(el.voices)) {
    return [{ ...el, voices: el.voices.map((v) => v.flatMap((c) => splitRhsElement(c, terminals))) }];
  }
  if ((el.type === "TemplateMasterGroup" || el.type === "TemplateSlaveGroup") && Array.isArray(el.elements)) {
    return [{ ...el, elements: el.elements.flatMap((c) => splitRhsElement(c, terminals)) }];
  }
  return [el];
}
function tokenizeCompoundName(name, terminals) {
  if (name.length < 2) return null;
  const toks = [];
  let i = 0;
  while (i < name.length) {
    let best = null;
    for (const t of terminals) {
      if (name.startsWith(t, i) && (best === null || t.length > best.length)) best = t;
    }
    if (best !== null) {
      toks.push({ kind: "terminal", text: best });
      i += best.length;
      continue;
    }
    const ch = name[i];
    if (ch >= "A" && ch <= "Z") {
      let j = i + 1;
      while (j < name.length && /[A-Za-z0-9]/.test(name[j])) j++;
      toks.push({ kind: "variable", text: name.slice(i, j) });
      i = j;
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      let j = i + 1;
      while (j < name.length && name[j] >= "0" && name[j] <= "9") j++;
      toks.push({ kind: "number", text: name.slice(i, j) });
      i = j;
      continue;
    }
    return null;
  }
  return toks.length < 2 ? null : toks;
}
function makeSplitAtom(original, ch, isFirst) {
  const node = { type: "Symbol", name: ch };
  if (original.line !== void 0) node.line = original.line;
  if (original.actor !== void 0) node.actor = original.actor;
  if (isFirst && original.negated === true) node.negated = true;
  if (isFirst && original.payload !== void 0) node.payload = original.payload;
  return node;
}
var REFUS_HORS_PORTEE_ACTIF = true;
var PORTEE_DU_PORTEUR = {
  Rule: "rule",
  Polymetric: "group",
  RawBrace: "group",
  InstantControl: "flow",
  Symbol: "symbol",
  SymbolCall: "symbol",
  Wildcard: "symbol",
  Prolongation: "symbol",
  Rest: "symbol",
  TemplateMaster: "symbol",
  TemplateSlave: "symbol"
};
var NOM_DE_PLACE = {
  scene: "at the top of a scene",
  subgrammar: "at the top of a sub-grammar, inside the mode parentheses (`mode:<mode>(<setting>)`)",
  rule: "on a rule",
  group: "on a group",
  symbol: "on an element",
  flow: "in the flow"
};
var _tablesDesPortees = /* @__PURE__ */ new Map();
var _versionDesTables = -1;
var dernierCompte = null;
function noterLePassage(compte) {
  dernierCompte = compte;
}

// src/transpiler/segmentation.js
function segmenter(nom, terminaux) {
  if (!nom || terminaux.has(nom)) return null;
  const longueurs = [...new Set([...terminaux].map((t) => t.length))].sort((a, b) => b - a);
  const parts = [];
  let i = 0;
  while (i < nom.length) {
    let pris = null;
    for (const L of longueurs) {
      if (L > nom.length - i) continue;
      const bout = nom.slice(i, i + L);
      if (terminaux.has(bout)) {
        pris = bout;
        break;
      }
    }
    if (!pris) return { parts: null, reste: nom.slice(i) };
    parts.push(pris);
    i += pris.length;
  }
  return parts.length > 1 ? { parts, reste: null } : null;
}

// src/transpiler/controlValidation.js
function collectQualifierPairs(node, out) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const el of node) collectQualifierPairs(el, out);
    return;
  }
  if (node.type === "SettingBag" && Array.isArray(node.pairs)) {
    for (const p of node.pairs) out.push(p);
  }
  for (const k in node) {
    if (k === "pairs") continue;
    const v = node[k];
    if (v && typeof v === "object") collectQualifierPairs(v, out);
  }
}
function collectDirectiveValues(ast, out) {
  for (const d of ast && ast.directives || []) {
    if (!d || d.type !== "Directive" || typeof d.name !== "string") continue;
    if (d.value === null || d.value === void 0) continue;
    out.push({ key: d.name, value: d.value, line: d.line });
  }
}
function validateControls(ast, controls, qualifies = {}) {
  if (!controls) return [];
  const pairs = [];
  collectQualifierPairs(ast, pairs);
  collectDirectiveValues(ast, pairs);
  const errors = [];
  for (const p of pairs) {
    const def = p.lib && qualifies[`${p.lib}.${p.key}`] || controls[p.key];
    if (!def) continue;
    if (p.value === true) continue;
    const where = { line: p.line, col: p.col };
    if (Array.isArray(def.values)) {
      const v = String(p.value);
      if (!def.values.includes(v)) {
        errors.push(diagnostic("CONTROL_VALUE_ALLOWED_CONTROL_ALLOWED", { p1: p.value, p2: p.key, p3: def.values.join(", ") }, { ...where }));
      }
      continue;
    }
    if (Array.isArray(def.range) && typeof p.value === "number") {
      const [min, max] = def.range;
      if (p.value < min || p.value > max) {
        errors.push(diagnostic("CONTROL_VALUE_OUT_RANGE_CONTROL", { p1: p.value, p2: p.key, min, max }, { ...where }));
      }
    }
  }
  return errors;
}

// src/transpiler/librairies-jointes.js
var NOM_D_ENTREE = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;
function estUnePlaceOuUnMembre(chaine) {
  const [mot, nom, ...reste] = chaine.split(".");
  if (reste.length) return false;
  const f = famille(mot);
  if (!f) return false;
  return nom in f.membres || f.entrees.some((e) => e.place === nom);
}
function referencesDe(ast) {
  const chaines = [];
  const mots = [];
  const vu = /* @__PURE__ */ new Set();
  const noter = (liste, x) => {
    if (!vu.has(x)) {
      vu.add(x);
      liste.push(x);
    }
  };
  const visiter = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) {
      for (const x of o) visiter(x);
      return;
    }
    for (const [k, v] of Object.entries(o)) {
      if (k === "librairies") continue;
      if (k === "libRefs" && Array.isArray(v)) {
        for (const r of v) if (typeof r === "string") noter(chaines, r);
      } else if (k === "references" && Array.isArray(v)) {
        for (const r of v) if (r && r.type === "ActorReference" && r.category !== "transport") noter(chaines, `${r.category}.${r.name}`);
      } else if (k === "pairs" && Array.isArray(v)) {
        for (const p of v) if (p && typeof p.key === "string") noter(mots, p.key);
      } else if (k === "directives" && Array.isArray(v)) {
        for (const d of v) if (d && typeof d.name === "string" && !d.subkey) noter(mots, d.name);
        visiter(v);
      } else visiter(v);
    }
  };
  visiter(ast);
  return { chaines, mots };
}
function suivreLesMembres(membres, FAMILLES, noter) {
  const visiter = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) {
      for (const x of o) visiter(x);
      return;
    }
    for (const [k, v] of Object.entries(o)) {
      if (FAMILLES.has(k) && typeof v === "string" && NOM_D_ENTREE.test(v)) noter(`${k}.${v}`);
      else visiter(v);
    }
  };
  visiter(membres);
}
function joindreLesLibrairies(ast) {
  const fautes = [];
  const FAMILLES = new Set(familles());
  const section = {};
  const { chaines, mots } = referencesDe(ast);
  const file = [...chaines];
  for (const mot of mots) {
    const o = objet(mot);
    if (!o) continue;
    if (o.ambigu) file.push(...o.ambigu);
    else file.push(o.chaine.join("."));
  }
  while (file.length) {
    const chaine = file.shift();
    if (chaine in section) continue;
    const segments = chaine.split(".");
    if (!FAMILLES.has(segments[0])) continue;
    if (!segments.every((s) => NOM_D_ENTREE.test(s))) continue;
    const o = objet(chaine);
    if (!o) {
      if (estUnePlaceOuUnMembre(chaine)) continue;
      fautes.push(diagnostic("JOIN_OBJECT_NOT_SERVED", { chaine }));
      continue;
    }
    if (o.ambigu) {
      fautes.push(diagnostic("JOIN_OBJECT_AMBIGUOUS", { chaine, ambigu: o.ambigu.join(", ") }));
      continue;
    }
    section[chaine] = o;
    suivreLesMembres(o.membres, FAMILLES, (chaine2) => file.push(chaine2));
  }
  ast.librairies = section;
  return fautes;
}

// src/transpiler/bpxAst.js
function segmenterLesTerminaux(ast, known, paquets) {
  const lire = (nom) => {
    let echec = null;
    for (const paquet of paquets) {
      const r = segmenter(nom, paquet);
      if (r && r.parts) return r;
      if (r && r.reste && !echec) echec = r;
    }
    return echec;
  };
  const intouchables = new Set([...nomsDeclares(ast)].filter((n) => !lire(n)?.parts));
  const dansUneListe = (liste) => {
    if (!Array.isArray(liste)) return liste;
    const sortie = [];
    for (const el of liste) {
      if (el && el.type === "Symbol" && el.name && !known.has(el.name) && !intouchables.has(el.name) && el.role !== "homomorphism" && !(Array.isArray(el.compose) && el.compose.length)) {
        const r = lire(el.name);
        if (r && r.parts) {
          for (const part of r.parts) sortie.push({ ...el, name: part });
          continue;
        }
        if (r && r.reste) restesDeSegmentation.set(el, r.reste);
      }
      sortie.push(descendre(el));
    }
    return sortie;
  };
  const CONTENANTS = ["voices", "elements", "content", "symbol", "triggers", "primary", "secondaries"];
  const descendre = (el) => {
    if (!el || typeof el !== "object") return el;
    if (Array.isArray(el)) return dansUneListe(el);
    for (const k of CONTENANTS) if (Array.isArray(el[k])) el[k] = dansUneListe(el[k]);
    return el;
  };
  for (const sg of ast.subgrammars || []) {
    for (const r of sg.rules || []) {
      if (Array.isArray(r.rhs)) r.rhs = dansUneListe(r.rhs);
      if (Array.isArray(r.lhs)) r.lhs = dansUneListe(r.lhs);
    }
  }
}
function refusMisEnForme(e) {
  if (!(e instanceof ParseError) && !(e instanceof LexError)) return e;
  return { code: e.code, message: e.message, line: e.token ? e.token.line : e.line };
}
function resoudreSource(source, environnement) {
  const result = { ast: null, errors: [], warnings: [] };
  try {
    const ast = parse(tokenize(source), {
      onWarning: (w) => result.warnings.push(w),
      // ⛔ LE CANAL DES REFUS DE RÈGLE — un seul canal, décision de Romain 2026-08-24. Sans lui, le
      // parseur levait sur la première faute de forme et l'auteur perdait tout le reste, y compris
      // des fautes de NOM écrites AVANT elle dans son fichier.
      onError: (e) => result.errors.push(refusMisEnForme(e)),
      // La SOURCE accompagne les jetons : une entrée de catalogue de gabarits se transporte
      // VERBATIM (AST_SPEC §1.9), et aucun jeton ne peut rendre les espaces d'origine.
      source
    });
    {
      const passe = resoudre(ast, environnement);
      result.errors.push(...passe.diagnostics);
      noterLePassage(passe.examines);
    }
    emitSceneLibRefs(ast);
    deriveAlphabetFromTuning(ast);
    result.errors.push(...resolveActors(ast).errors);
    canonicalizeContexts(ast);
    result.errors.push(...annotateBackticks(ast));
    applyEnvironmentDefaults(ast, environnement);
    result.errors.push(...applyDefaultActor(ast));
    resolveHomomorphismMarkers(ast);
    emitActorLibRefs(ast);
    emitNoteTerminals(ast);
    emitSceneMeter(ast);
    result.ast = ast;
    const directives = [
      ...ast.directives || [],
      ...(ast.scenes || []).flatMap((s) => s.directives || []),
      // SCENE_VALUES : les acteurs (hissés dans ast.actors par le parseur) touchent
      // leurs catalogues d'entité → sections `values` au registre (libs.js).
      ...ast.actors || []
    ];
    const libCtx = loadLibsFromDirectives(directives);
    poserLeDestinataireDesReglages(ast, libCtx);
    result.errors.push(...applySceneValues(ast, libCtx));
    result.errors.push(...validateReferences(ast, libCtx, environnement));
    result.errors.push(...refuserNomsEnDouble(ast, libCtx));
    {
      const { terminaux, paquets } = terminauxEnPortee(ast);
      segmenterLesTerminaux(ast, terminaux, paquets);
    }
    result.errors.push(...validateTerminals(ast));
    poserLaVoixDesTerminaux(ast);
    result.errors.push(...validateControls(ast, libCtx.controls, libCtx.controlsQualified || {}));
    result.errors.push(...refuserAttenteNonDeclaree(ast));
    result.errors.push(...refuserCleDeCrochetInconnue(ast, libCtx));
    result.errors.push(...refuserEsclaveSansMaitre(ast));
    splitCompoundTerminals(ast, libCtx);
    retirerArdoiseAlphabet(ast);
    result.errors.push(...joindreLesLibrairies(ast));
  } catch (e) {
    if (e instanceof ParseError || e instanceof LexError) result.errors.push(refusMisEnForme(e));
    else throw e;
  }
  return result;
}
function compileToBPxAST(source, environnement) {
  const result = resoudreSource(source, environnement);
  if (result.errors.length) result.ast = null;
  return result;
}
var bpxAst_default = compileToBPxAST;
brancherLeCompilateur(compileToBPxAST);

export {
  resoudreSource,
  compileToBPxAST,
  bpxAst_default
};
