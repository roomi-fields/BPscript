import {
  ParseError,
  describeVocabulary,
  groupeDUnicite,
  loadLib,
  loadLibsFromDirectives,
  nomsDeTerminaux,
  parse,
  resolveActorAlphabet,
  resolveActorAlphabetSource,
  universeControlNames
} from "./chunk-WQI74RJP.js";
import {
  LexError,
  tokenize
} from "./chunk-3Y64WDZ4.js";
import {
  LIBS
} from "./chunk-VEPRGLSC.js";

// src/transpiler/actorResolver.js
function expandAlphabetTerminals(alphabetLib, octavesOverride) {
  const terminals = /* @__PURE__ */ new Set();
  if (!alphabetLib || !nomsDeTerminaux(alphabetLib)) return terminals;
  const octaveConvention = octavesOverride != null ? octavesOverride : alphabetLib.octaves;
  const candidate = octaveConvention ? loadLib("octaves", octaveConvention) : null;
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
  if (ast.libRefs && ast.libRefs.length) return null;
  return loadLib("core")?.defaults?.components?.alphabet || null;
}
function octavesHerite(ast, alphabetKey) {
  const connu = (nom) => !!(nom && loadLib("octaves")?.[nom]);
  const sceneOct = (ast.directives || []).find((d) => d.name === "octaves" && (d.subkey || d.runtime));
  if (sceneOct) {
    const nom = sceneOct.subkey || sceneOct.runtime;
    return connu(nom) ? nom : void 0;
  }
  if (!alphabetKey) return void 0;
  const lib = resolveActorAlphabet(alphabetKey, ast.directives);
  return connu(lib && lib.octaves) ? lib.octaves : void 0;
}
function tuningHerite(ast, alphabetKey) {
  const connu = (nom) => !!(nom && loadLib("tuning", nom));
  const sceneTun = (ast.directives || []).find((d) => d.name === "tuning" && d.subkey);
  if (sceneTun) return connu(sceneTun.subkey) ? sceneTun.subkey : void 0;
  if (!alphabetKey) return void 0;
  const lib = resolveActorAlphabet(alphabetKey, ast.directives);
  return connu(lib && lib.tuning) ? lib.tuning : void 0;
}
function defaultActorTransport() {
  const core = loadLib("core");
  return core && core.defaults && core.defaults.components && core.defaults.components.transport || "audio";
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
  return { key: defaultActorTransport(), params: {}, conflit: null };
}
function evalHerite(ast) {
  const sceneEval = (ast.directives || []).find((d) => d.name === "eval" && d.subkey);
  if (!sceneEval) return void 0;
  const catalogue = loadLib("eval");
  const connus = catalogue && catalogue.objects || catalogue || {};
  return connus[sceneEval.subkey] ? sceneEval.subkey : void 0;
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
    const isCodeVoice = !!props.eval;
    if (!alphabetKey && !isCodeVoice) {
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
        errors.push({ message: `Alphabet "${alphabetKey}" not found for actor "${name}"`, line: actor.line });
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
        const connus = declares.size ? `Acteurs d\xE9clar\xE9s : ${[...declares].join(", ")}.` : "Cette sc\xE8ne ne d\xE9clare aucun acteur.";
        errors.push({
          message: `Acteur inconnu '${el.actor}' dans '${el.actor}.${el.name}' \u2014 un renvoi point\xE9 doit nommer un acteur d\xE9clar\xE9 par actor. ${connus}`,
          line: el.line
        });
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
            errors.push({
              message: `Ambiguous symbol "${el.name}" \u2014 owned by actors: ${actorList}. Use dot notation (e.g. ${[...actors][0]}.${el.name}) or declare with gate ${el.name}:<actor>`,
              line: el.line
            });
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
    erreurs.push({
      message: `'&${e.name}' rejoue un gabarit que rien ne capture \u2014 aucun '$${e.name}' dans cette sc\xE8ne. Le nom porte l'appariement entre le ma\xEEtre et l'esclave : sans ma\xEEtre, le rejeu n'a pas de choix \xE0 r\xE9p\xE9ter. \xC9crire '$${e.name}' l\xE0 o\xF9 le motif se capture.`,
      line: e.line
    });
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
      errors.push({
        message: `chevauchement d'acteurs : un binding de sortie sur l'alphabet (alphabet.${alphaBinding.subkey}:${alphaBinding.runtime}) d\xE9signe un acteur implicite, incompatible avec un 'actor' explicite \u2014 choisis l'un OU l'autre`,
        line: alphaBinding.line || 0
      });
    }
    return errors;
  }
  const sortie = sortieHeritee(ast);
  if (sortie.conflit) {
    errors.push({
      message: `deux sorties pour la m\xEAme sc\xE8ne : 'out.${sortie.conflit.ecrite}' et le raccord 'alphabet.${sortie.conflit.alphabet}:${sortie.conflit.raccord}' d\xE9signent des canaux diff\xE9rents \u2014 les deux \xE9critures disent la M\xCAME chose, il faut n'en garder qu'une`,
      line: sortie.conflit.line
    });
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
        errors.push({
          message: `valeur '${p.value}' interdite pour le contr\xF4le '${p.key}' (autoris\xE9es : ${def.values.join(", ")})`,
          ...where
        });
      }
      continue;
    }
    if (Array.isArray(def.range) && typeof p.value === "number") {
      const [min, max] = def.range;
      if (p.value < min || p.value > max) {
        errors.push({
          message: `valeur ${p.value} hors plage pour le contr\xF4le '${p.key}' (${min}..${max})`,
          ...where
        });
      }
    }
  }
  return errors;
}

// src/transpiler/bpxAst.js
var restesDeSegmentation = /* @__PURE__ */ new WeakMap();
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
  const socleEval = loadLib("core")?.defaults?.components?.eval;
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
        errors.push({
          message: `Backtick sans langage \u2014 il doit \xEAtre connu, jamais devin\xE9. Le langage vient de la place la plus proche qui le nomme : un TAG dans le bloc (\`js: \u2026\`), un ACTEUR qui qualifie le bloc par le point ('actor drums eval.<moteur>' puis \`drums.\`\u2026\`\`), une ligne 'eval.<moteur>' en t\xEAte de sc\xE8ne, ou le socle 'core' \u2014 qui porte 'js'. Aucun des quatre n'a r\xE9pondu : le catalogue 'core' n'expose pas 'defaults.components.eval'.`,
          line: el.line
        });
      }
      if (el.elements) scanOrphans(el.elements);
      if (el.voices) for (const v of el.voices) scanOrphans(v);
    }
  };
  for (const sub of ast.subgrammars || []) for (const rule of sub.rules || []) scanOrphans(rule.rhs);
  return errors;
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
function hasTempoDirective(ast) {
  return (ast.directives || []).some(
    (d) => d && d.type === "Directive" && d.name === "tempo"
  );
}
var INLINE_FLIP_PALIER4 = true;
function singleCharAlphabetSet(libCtx) {
  const terms = libCtx && libCtx.alphabetTerminals || [];
  if (terms.length === 0) return null;
  for (const t of terms) {
    if (typeof t !== "string" || t.length !== 1) return null;
  }
  return new Set(terms);
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
var CTX_METAVAR_RE = /^\?\d+$/;
var isCtxWildcardName = (s) => s === "?" || CTX_METAVAR_RE.test(s);
function ctxSymbolToElement(sym, line) {
  if (sym === "?") return { type: "Wildcard", line };
  if (CTX_METAVAR_RE.test(sym)) return { type: "Variable", index: parseInt(sym.slice(1), 10), line };
  return { type: "Symbol", name: sym, line };
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
              `contexte distant en milieu de motif (autoris\xE9 : d\xE9but ou fin de LHS)`,
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
function validateTerminals(ast) {
  if (!ast) return [];
  const errors = [];
  const codeVoice = new Set((ast.actors || []).filter((a) => (a.properties || {}).eval).map((a) => a.name));
  const { terminaux: known, aUnAlphabet: anyAlphabet } = terminauxEnPortee(ast);
  const declared = nomsDeclares(ast);
  errors.push(...validateCallVocabulary(ast, known, declared, codeVoice, anyAlphabet));
  if (!anyAlphabet) return errors;
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
        errors.push({
          message: `dans l'objet sonore compos\xE9 '|[\u2026]' : '${part}' n'est d\xE9clar\xE9 nulle part \u2014 absent des alphabets en port\xE9e`,
          line: el.line
        });
      }
      return;
    }
    if ((el.type === "Symbol" || el.type === "OutTimeObject") && el.name && el.role !== "homomorphism" && !(el.payload && codeVoice.has(el.payload.actor)) && !known.has(el.name) && !declared.has(el.name) && !seen.has(el.name)) {
      seen.add(el.name);
      const reste = restesDeSegmentation.get(el);
      const ligne = (ast.directives || []).find((d) => d && d.type === "Directive" && d.name === el.name && typeof d.runtime === "string");
      const cause = ligne && canalFautif(ligne.runtime);
      errors.push({
        message: cause ? `'${el.name}:${ligne.runtime}' d\xE9clare un terminal, et ${cause} La d\xE9claration s'\xE9crit '<nom>:<canal>' \u2014 le terminal n'est pas en cause.` : reste && reste !== el.name ? `terminal '${el.name}' non d\xE9clar\xE9 \u2014 segmentation bloqu\xE9e sur '${reste}', absent des alphabets en port\xE9e` : `terminal '${el.name}' non d\xE9clar\xE9 \u2014 absent des alphabets en port\xE9e`,
        line: el.line
      });
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
      errors.push({
        message: `sujet de r\xE9glage '${s}:\u2026' : '${s}' ne d\xE9signe aucun terminal \u2014 absent des alphabets en port\xE9e et des noms d\xE9clar\xE9s. Un sujet vise les terminaux de son nom ; '*' vise chaque terminal de la port\xE9e, et l'absence de sujet vise la port\xE9e enti\xE8re`,
        line: n.line
      });
    }
    for (const v of Object.values(n)) if (v && typeof v === "object") verifierLesSujets(v);
  };
  for (const sg of ast.subgrammars || []) for (const r of sg.rules || []) verifierLesSujets(r);
  return errors;
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
        errors.push({
          message: auRegistre ? `appel '${citer(n)}' : '${n.name}' est un contr\xF4le du registre, mais cette sc\xE8ne ne l'a pas import\xE9 \u2014 il a donc \xE9t\xE9 reclass\xE9 en TERMINAL SONNANT, c'est-\xE0-dire en note. D\xE9clarer le socle en t\xEAte de sc\xE8ne ('core')` : `appel '${citer(n)}' : '${n.name}' n'existe pas \u2014 ni contr\xF4le du registre, ni terminal des alphabets en port\xE9e, ni symbole d\xE9clar\xE9. Une fonction g\xE9n\xE9rique n'est pas du langage : chaque intention porte son nom ('[]' pour le moteur, '()' pour le runtime, en 'cl\xE9:valeur')`,
          line: n.line
        });
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
      errors.push({ message: `'${name}': '${v}' n'est pas un nombre (attendu : ${spec.range[0]}..${spec.range[1]}${spec.unit ? " " + spec.unit : ""})`, line });
      return false;
    }
    if (typeof v === "number" && Array.isArray(spec.range) && spec.range.length === 2 && (v < spec.range[0] || v > spec.range[1])) {
      errors.push({ message: `'${name}': ${v} hors plage [${spec.range[0]}..${spec.range[1]}]${spec.unit ? " " + spec.unit : ""}`, line });
      return false;
    }
    if (Array.isArray(spec.values) && !spec.values.includes(v)) {
      errors.push({ message: `'${name}': valeur '${v}' inconnue (admises : ${spec.values.join(", ")})`, line });
      return false;
    }
    return true;
  };
  const sceneVals = {};
  for (const d of ast.directives || []) {
    const spec = registry[d.name];
    if (!spec) continue;
    if (d.value == null) {
      errors.push({ message: `'${d.name}' attend une VALEUR (ex. @${d.name}:440) \u2014 pas un nom`, line: d.line });
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
          errors.push({
            message: `'${axis}.${entree ?? "\u2026"}(${k}:\u2026)' : '${k}' n'est ni un param\xE8tre de '${entree ?? axis}' ni une valeur d\xE9clar\xE9e (socle @core ou librairie invoqu\xE9e)`,
            line: actor.line
          });
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
  scene: "en t\xEAte de sc\xE8ne",
  subgrammar: "en t\xEAte de sous-grammaire, dans la parenth\xE8se du mode (`mode:<mode>(<r\xE9glage>)`)",
  rule: "sur une r\xE8gle",
  group: "sur un groupe",
  symbol: "sur un \xE9l\xE9ment",
  flow: "dans le flux"
};
var _porteesPermises = null;
function chargerPorteesPermises() {
  if (_porteesPermises) return _porteesPermises;
  const m = /* @__PURE__ */ new Map();
  const w = (o) => {
    for (const [k, v] of Object.entries(o || {})) {
      if (!v || typeof v !== "object") continue;
      if ("args" in v && "description" in v) {
        if (Array.isArray(v.scope)) m.set(k, v.scope);
      } else w(v);
    }
  };
  w(LIBS.expression);
  w(LIBS.midi);
  w(LIBS.audio);
  w(LIBS.transpo);
  w(LIBS.engine);
  for (const lib of Object.values(LIBS)) {
    const cles = lib?.schema?.addressKeys;
    if (!cles || Array.isArray(cles) || typeof cles !== "object") continue;
    for (const [k, def] of Object.entries(cles)) {
      if (k.startsWith("_") || !def || !Array.isArray(def.scope)) continue;
      m.set(k, def.scope);
    }
  }
  _porteesPermises = { get: (cle) => m.get(cle), has: (cle) => m.has(cle) };
  return _porteesPermises;
}
function refuserAttenteNonDeclaree(ast) {
  const connus = /* @__PURE__ */ new Set();
  for (const i of ast.inputs || []) for (const n of i.names || (i.name ? [i.name] : [])) connus.add(n);
  for (const v of ast.vars || []) for (const n of v.names || []) connus.add(n);
  for (const d of ast.declarations || []) if (d && d.name) connus.add(d.name);
  for (const a of ast.actors || []) if (a && a.name) connus.add(a.name);
  const directions = /* @__PURE__ */ new Set();
  for (const canal of Object.values(LIBS.core?.schema?.channels || {})) {
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
      erreurs.push({
        message: `'<!${n.name}' attend un signal que rien ne d\xE9clare \u2014 aucune entr\xE9e, variable, porte ni acteur de cette sc\xE8ne ne porte le nom '${n.name}'. Le d\xE9clarer : 'in.<canal> ${n.name}'. Sans d\xE9claration, une coquille fabrique une SECONDE attente que rien ne viendra satisfaire, et la d\xE9rivation s'arr\xEAte pour toujours sans un mot.`,
        line: n.line
      });
    }
    for (const k in n) marcher(n[k]);
  })(ast);
  return erreurs;
}
function canalFautif(canal) {
  const cat = LIBS.core?.schema?.channels || {};
  const c = cat[canal];
  if (!c) return `le canal '${canal}' n'existe pas \u2014 les canaux sont ${Object.keys(cat).join(", ")}. La liste est FERM\xC9E.`;
  if (!c.out) return `'${canal}' n'est pas une sortie \u2014 un terminal sonne, il ne se lit pas. Les canaux de sortie sont ${Object.keys(cat).filter((k) => cat[k].out).join(", ")}.`;
  if (!c.writable) return `'${canal}' est une DESTINATION de l'architecture, rout\xE9e comme les autres sorties, mais son \xC9CRITURE dans une sc\xE8ne attend encore son appareil d\xE9di\xE9.`;
  return null;
}
function validateReferences(ast, libCtx = {}) {
  const errors = [];
  const porteesPermises = chargerPorteesPermises();
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
    errors.push({
      message: `'${key}' est d\xE9clar\xE9 par ${choix.length} librairies et ne peut pas s'\xE9crire NU \u2014 il ne dit pas de quel '${key}' on parle, et le destinataire du r\xE9glage en d\xE9pend. \xC9crire ${choix.map((c) => `'${c}:\u2026'`).join(" ou ")}.`,
      line,
      col
    });
  };
  const canauxDeclares = new Set(Object.keys(LIBS.core?.schema?.channels || {}));
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
    errors.push({
      message: `'${key}' est un mot G\xC9N\xC9RIQUE : chaque sortie d\xE9clare comment elle le r\xE9alise, et ${orphelines.map((s) => `'${s}'`).join(" et ")} ne le r\xE9alise${orphelines.length > 1 ? "nt" : ""} pas. \xC9crit ici, il ne ferait rien. R\xE9alis\xE9 aujourd'hui par : ${[...canaux2].sort().map((c) => `'${c}.${key}'`).join(", ")}.`,
      line,
      col
    });
  };
  const evaluateurs = new Set(vocab.components && vocab.components.eval || []);
  const tagsVus = /* @__PURE__ */ new Set();
  const verifierTag = (tag, line, col) => {
    if (typeof tag !== "string" || !tag || evaluateurs.has(tag) || tagsVus.has(tag)) return;
    tagsVus.add(tag);
    errors.push({
      message: `'\`${tag}: \u2026\`' nomme un \xE9valuateur qui n'est pas d\xE9clar\xE9. Un tag de backtick d\xE9signe QUI ex\xE9cute le code, et la liste vit dans la librairie 'eval' : ${[...evaluateurs].sort().join(", ")}. Une coquille y cr\xE9erait un interpr\xE8te fant\xF4me, et la sc\xE8ne compilerait sans que le code parte nulle part.`,
      line,
      col
    });
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
    const err = {
      message: `attribut '(${key}${ecritNu ? "" : ":\u2026"})' inconnu \u2014 ni contr\xF4le, ni valeur de librairie, ni adresse`,
      line,
      col
    };
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
          errors.push({
            message: `'(mode:\u2026)' n'a plus sa place dans une r\xE8gle : le mode vaut pour un BLOC et ne change pas en cours de tirage (d\xE9cision Romain 2026-08-08). L'\xE9crire 'mode:${p.value ?? "<valeur>"}' en t\xEAte de la sous-grammaire concern\xE9e \u2014 une ligne seule, avant ses r\xE8gles.`,
            line: p.line,
            col: p.col
          });
        }
      }
    }
    const place = REFUS_HORS_PORTEE_ACTIF ? PORTEE_DU_PORTEUR[node.type] : null;
    if (place) {
      for (const sac of [node.settings, node.qualifier, ...node.suffixQualifiers || []]) {
        if (!sac || !Array.isArray(sac.pairs)) continue;
        for (const p of sac.pairs) {
          const cle = String(p.key).split(".")[0];
          const permis = porteesPermises.get(cle);
          if (!permis || permis.includes(place)) continue;
          errors.push({
            message: `'${cle}' ne peut pas s'\xE9crire ${NOM_DE_PLACE[place]} \u2014 ` + (permis.length === 1 ? `il ne vaut QUE ${NOM_DE_PLACE[permis[0]] ?? permis[0]}` : `il vaut ${permis.slice(0, -1).map((s) => NOM_DE_PLACE[s] ?? s).join(", ")} ou ${NOM_DE_PLACE[permis[permis.length - 1]] ?? permis[permis.length - 1]}`) + `. Le d\xE9placer l\xE0, ou employer un r\xE9glage qui vaut ici.`,
            line: p.line ?? node.line,
            col: p.col
          });
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
      if (!permis || permis.includes(place)) return;
      errors.push({
        message: `'${cle}' ne peut pas s'\xE9crire ${NOM_DE_PLACE[place]} \u2014 ` + (permis.length === 1 ? `il ne vaut QUE ${NOM_DE_PLACE[permis[0]] ?? permis[0]}` : `il vaut ${permis.slice(0, -1).map((x) => NOM_DE_PLACE[x] ?? x).join(", ")} ou ${NOM_DE_PLACE[permis[permis.length - 1]] ?? permis[permis.length - 1]}`) + `. Le d\xE9placer l\xE0, ou employer un r\xE9glage qui vaut ici.`,
        line
      });
    };
    for (const d of ast.directives || []) {
      if (!d || !d.name) continue;
      if (d.type && d.type !== "Directive") continue;
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
    errors.push({ message: `${axis} '${name}' introuvable dans le catalogue (r\xE9f\xE9rence inexistante)`, line });
  };
  const motsDeclares = () => new Set(
    Object.values(LIBS).map((l) => l && typeof l === "object" ? l.resolves : null).filter(Boolean)
  );
  const libExiste = (nom) => motsDeclares().has(nom);
  const motsDuLangage = new Set(loadLib("core")?.schema?.reservedDirectives || []);
  for (const d of ast.directives || []) {
    if (!d || !d.name) continue;
    if (!d.subkey) {
      const fichierNu = LIBS[d.name];
      const motNu = fichierNu && typeof fichierNu === "object" ? fichierNu.resolves : null;
      if (motNu && motNu !== d.name) {
        errors.push({
          message: `'${d.name}' : '${d.name}' est le NOM DU FICHIER, pas le mot qui l'invoque. Ecrire '${motNu}'. Une librairie s'invoque par le mot qu'elle DECLARE (decision Romain, 2026-08-17) : le nom logique se separe du nom physique, et un fichier se renomme sans qu'aucune scene change.`,
          line: d.line
        });
      }
      continue;
    }
    if (catalogAxes.includes(d.name)) continue;
    if (!libExiste(d.name)) {
      if (motsDuLangage.has(d.name)) continue;
      const fichier = LIBS[d.name];
      const motAEcrire = fichier && typeof fichier === "object" ? fichier.resolves : null;
      errors.push({
        message: motAEcrire ? `'${d.name}.${d.subkey}' : '${d.name}' est le NOM DU FICHIER, pas le mot qui l'invoque. Ecrire '${motAEcrire}.${d.subkey}'. Une librairie s'invoque par le mot qu'elle DECLARE (decision Romain, 2026-08-17) : le nom logique se separe du nom physique, et un fichier se renomme sans qu'aucune scene change.` : `'${d.name}.${d.subkey}' : aucune librairie ne sert l'axe '${d.name}'. Une invocation dont l'axe n'est porte par aucune donnee ne charge RIEN, et rien ne distingue ce silence d'une scene qui n'a pas declare.`,
        line: d.line
      });
      continue;
    }
    if (loadLib(d.name, d.subkey)) continue;
    errors.push({
      message: `'${d.name}.${d.subkey}' : l'entr\xE9e '${d.subkey}' n'existe pas dans la librairie '${d.name}'. Une invocation qui ne r\xE9sout rien est indistinguable, c\xF4t\xE9 consommateur, d'une sc\xE8ne qui n'a rien d\xE9clar\xE9 \u2014 elle ne peut donc pas \xEAtre accept\xE9e en silence.`,
      line: d.line
    });
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
      message: `'in ${e.name} \u2026 mapping.${e.mapping}' : la table '${e.mapping}' n'est d\xE9clar\xE9e par aucune librairie charg\xE9e \u2014 aucune n'en porte aujourd'hui. Une entr\xE9e qui invoque une table inexistante croirait traduire et ne traduirait rien. \xC9crire l'entr\xE9e seule et employer des adresses nues ('<!${e.name}.60').`,
      line: e.line
    });
  }
  for (const d of ast.directives || []) {
    if (d.subkey && catalogAxes.includes(d.name)) {
      checkComponent(d.name, d.subkey, d.line);
      continue;
    }
    if (d.value != null && d.value !== true && !registry.has(d.name) && !reserved.has(d.name)) {
      errors.push({ message: `valeur '${d.name}:\u2026' inconnue \u2014 non d\xE9clar\xE9e par une librairie charg\xE9e`, line: d.line });
      continue;
    }
    if (d.subkey == null && d.runtime != null && !registry.has(d.name) && !reserved.has(d.name)) {
      errors.push({
        message: `'${d.name}:${d.runtime}' : '${d.name}' n'est d\xE9clar\xE9 par aucune librairie charg\xE9e. Une ligne de t\xEAte qu'aucune donn\xE9e ne porte ne r\xE8gle rien \u2014 elle serait lue, \xE9crite dans l'arbre, et sans effet.`,
        line: d.line
      });
      continue;
    }
    if (d.type && d.type !== "Directive") continue;
    if (d.value == null && !d.subkey && !d.runtime && !registry.has(d.name) && !reserved.has(d.name) && !loadLib(d.name)) {
      errors.push({
        message: `'${d.name}' n'est d\xE9clar\xE9 par aucune librairie charg\xE9e \u2014 un mot de t\xEAte vient d'une librairie invoqu\xE9e, jamais de nulle part. Invoquer la librairie qui le porte, ou retirer la ligne.`,
        line: d.line
      });
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
      noter(d.name, d.line);
      for (const m of d.modifiers || []) noter(m && m.name, d.line);
    }
    for (const sg of ast.subgrammars || []) {
      for (const m of sg.modifiers || []) noter(m && m.name, sg.line);
    }
    for (const [groupe, vus2] of groupes) {
      if (vus2.length < 2) continue;
      const mots = [...new Set(vus2.map((v) => v.mot))];
      errors.push({
        message: `'${groupe}' est r\xE9gl\xE9 ${vus2.length} fois (${mots.map((m) => `'${m}'`).join(", ")}) \u2014 il ne se r\xE8gle qu'une fois par sc\xE8ne. ` + (mots.length > 1 ? `Ces mots r\xE8glent LA M\xCAME CHOSE : en garder un seul.` : `Retirer les occurrences en trop.`) + ` Le moteur natif refuse la grammaire enti\xE8re dans ce cas.`,
        line: vus2[vus2.length - 1].line
      });
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
      errors.push({ message: `alphabet '${alphaName}' incoh\xE9rent avec l'accordage '${tuningName}' (qui appartient \xE0 l'alphabet '${ta}') \u2014 un accordage ne se combine qu'avec son alphabet`, line: line || 0 });
    }
  };
  checkCoherence(sceneComp("alphabet"), sceneComp("tuning"), 0);
  for (const actor of ast.actors || []) checkCoherence((actor.properties || {}).alphabet, (actor.properties || {}).tuning, actor.line);
  for (const actor of ast.actors || []) {
    const props = actor.properties || {};
    for (const axis of catalogAxes) if (props[axis]) checkComponent(axis, props[axis], actor.line);
  }
  const canaux = LIBS.core?.schema?.channels || {};
  const directionsDeCanal = new Set(Object.values(canaux).flatMap((c) => Object.entries(c || {}).filter(([, v]) => typeof v === "boolean").map(([k]) => k)));
  const clesDeSortie = new Set((LIBS.core?.schema?.actorKeys || []).filter((k) => directionsDeCanal.has(k) && !catalogAxes.includes(k)));
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
      if (cause) errors.push({ message: `terminal '${def.name}' : ${cause}`, line: def.line });
    }
  }
  return errors;
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
function refuserNomsEnDouble(ast, libCtx) {
  const erreurs = [];
  const { terminaux } = terminauxEnPortee(ast);
  const creesParDeclaration = /* @__PURE__ */ new Map();
  const noter = (nom, sorte, line) => {
    if (!nom || typeof nom !== "string") return;
    if (creesParDeclaration.has(nom)) {
      const p = creesParDeclaration.get(nom);
      erreurs.push({
        message: `le nom '${nom}' est d\xE9j\xE0 pris : ${p.sorte} l'a d\xE9clar\xE9${p.line ? ` ligne ${p.line}` : ""}, et ${sorte} le red\xE9clare. Un nom ne d\xE9signe qu'UNE chose dans une sc\xE8ne \u2014 sinon, en le lisant dans une r\xE8gle, on ne sait plus de quoi on parle. Choisir un autre nom.`,
        line
      });
      return;
    }
    creesParDeclaration.set(nom, { sorte, line });
    if (terminaux.has(nom)) {
      erreurs.push({
        message: `'${nom}' est un TERMINAL de l'alphabet actif, et ${sorte} en fait un nom \u2014 une r\xE8gle qui \xE9crirait '${nom}' ne dirait plus si elle joue la note ou l'autre chose. Choisir un autre nom. Le refus tombe \xE0 la D\xC9CLARATION : le nom n'a pas besoin d'\xEAtre employ\xE9 pour que l'ambigu\xEFt\xE9 existe.`,
        line
      });
    }
  };
  for (const e of ast.inputs || []) noter(e?.name, "une entr\xE9e", e?.line);
  for (const v of ast.vars || []) {
    const sorte = v?.varType?.kind === "flag" ? "un drapeau" : "une variable de travail";
    for (const n of v?.names || []) noter(n, sorte, v?.line);
  }
  for (const a of ast.actors || []) if (!a?.synthetic) noter(a?.name, "un acteur", a?.line);
  for (const sc of ast.scenes || []) noter(sc?.name, "une sc\xE8ne", sc?.line);
  for (const d of ast.defs || []) {
    if (d && d.type === "DefDirective" && d.kind !== "terminal") {
      noter(d.name, "une d\xE9finition", d.line);
    }
  }
  const LEVEES = /* @__PURE__ */ new Set(["une variable de travail"]);
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
        if (declare && !LEVEES.has(declare.sorte)) {
          erreurs.push({
            message: `la r\xE8gle '${nom}' porte un nom d\xE9j\xE0 pris par ${declare.sorte} \u2014 en lisant '${nom}' dans une s\xE9quence, on ne sait plus de quoi on parle. Choisir un autre nom pour l'un des deux.`,
            line: r.line
          });
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
    if (declare && declare.sorte !== "un drapeau") {
      erreurs.push({
        message: `le drapeau '${nom}' porte un nom d\xE9j\xE0 pris par ${declare.sorte}${declare.line ? ` ligne ${declare.line}` : ""} \u2014 un nom ne d\xE9signe qu'UNE chose dans une sc\xE8ne. Choisir un autre nom pour le drapeau.`
      });
      continue;
    }
    if (tetesDeRegle.has(nom)) {
      erreurs.push({
        message: `le drapeau '${nom}' porte le nom d'une R\xC8GLE de la grammaire${tetesDeRegle.get(nom) ? ` ligne ${tetesDeRegle.get(nom)}` : ""} \u2014 un nom ne d\xE9signe qu'UNE chose dans une sc\xE8ne. Choisir un autre nom pour le drapeau.`
      });
      continue;
    }
    if (terminaux.has(nom)) {
      erreurs.push({
        message: `le drapeau '${nom}' porte le nom d'un TERMINAL de l'alphabet actif \u2014 un nom ne d\xE9signe qu'UNE chose dans une sc\xE8ne, et un drapeau ne porte qu'un nom de drapeau. Choisir un autre nom pour le drapeau.`
      });
      continue;
    }
    if (libCtx?.controlNames?.has(nom)) {
      erreurs.push({
        message: `le drapeau '${nom}' porte le nom d'un R\xC9GLAGE du vocabulaire \u2014 le sac de drapeaux en ferait un drapeau sans un mot, et le r\xE9glage deviendrait inatteignable sous ce nom. Choisir un autre nom pour le drapeau.`
      });
      continue;
    }
  }
  return erreurs;
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
function resoudreSource(source, environnement) {
  const result = { ast: null, errors: [], warnings: [] };
  try {
    const ast = parse(tokenize(source), {
      onWarning: (w) => result.warnings.push(w),
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
    result.errors.push(...validateReferences(ast, libCtx));
    result.errors.push(...refuserNomsEnDouble(ast, libCtx));
    {
      const { terminaux, paquets } = terminauxEnPortee(ast);
      segmenterLesTerminaux(ast, terminaux, paquets);
    }
    result.errors.push(...validateTerminals(ast));
    poserLaVoixDesTerminaux(ast);
    result.errors.push(...validateControls(ast, libCtx.controls, libCtx.controlsQualified || {}));
    result.errors.push(...refuserAttenteNonDeclaree(ast));
    result.errors.push(...refuserEsclaveSansMaitre(ast));
    splitCompoundTerminals(ast, libCtx);
    retirerArdoiseAlphabet(ast);
  } catch (e) {
    if (e instanceof ParseError) result.errors.push({ message: e.message, line: e.token && e.token.line });
    else if (e instanceof LexError) result.errors.push({ message: e.message, line: e.line });
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

export {
  resoudreSource,
  compileToBPxAST,
  bpxAst_default
};
