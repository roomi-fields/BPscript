import {
  T
} from "./chunk-3Y64WDZ4.js";
import {
  LIBS
} from "./chunk-NGUE4MTO.js";
import {
  CHAMPS_DE_FICHIER
} from "./chunk-Z7KGRXC3.js";
import {
  SYNTAXE
} from "./chunk-YT6XIK2B.js";

// src/transpiler/libs.js
var registry = {};
var cache = {};
function registerLib(name, data) {
  registry[name] = data;
  cache[name] = data;
  _universeControls = null;
  _universeComponentControls = null;
  _universeRuleScope = null;
  _universeRuleAllowed = null;
  _universeSacs = null;
  _universeIntervalControls = null;
  _universeAddressKeys = null;
  _universeReservedDirectives = null;
}
function registerAll(libs) {
  for (const [name, data] of Object.entries(libs)) {
    registerLib(name, data);
  }
}
var _universeControls = null;
function universeControlNames() {
  if (!_universeControls) {
    const allDirs = Object.keys(registry).map((name) => ({ name }));
    _universeControls = loadLibsFromDirectives(allDirs).controlNames;
  }
  return _universeControls;
}
var _universeIntervalControls = null;
function universeIntervalControls() {
  if (!_universeIntervalControls) {
    const allDirs = Object.keys(registry).map((name) => ({ name }));
    _universeIntervalControls = loadLibsFromDirectives(allDirs).intervalControls;
  }
  return _universeIntervalControls;
}
var _universeComponentControls = null;
function universeComponentControls() {
  if (!_universeComponentControls) {
    const allDirs = Object.keys(registry).map((name) => ({ name }));
    _universeComponentControls = loadLibsFromDirectives(allDirs).componentControls;
  }
  return _universeComponentControls;
}
var _universeAddressKeys = null;
var _universeReservedDirectives = null;
function universeAddressKeys() {
  if (!_universeAddressKeys) {
    const allDirs = Object.keys(registry).map((name) => ({ name }));
    _universeAddressKeys = loadLibsFromDirectives(allDirs).addressKeys;
  }
  return _universeAddressKeys;
}
var _universeSacs = null;
function universeSacs() {
  if (!_universeSacs) {
    const allDirs = Object.keys(registry).map((name) => ({ name }));
    const c = loadLibsFromDirectives(allDirs);
    _universeSacs = { moteur: c.engineBagControls, runtime: c.runtimeBagControls, specs: c.controls };
  }
  return _universeSacs;
}
var _universeRuleScope = null;
function universeRuleScopeControls() {
  if (!_universeRuleScope) {
    const allDirs = Object.keys(registry).map((name) => ({ name }));
    _universeRuleScope = loadLibsFromDirectives(allDirs).ruleScopeControls;
  }
  return _universeRuleScope;
}
var _universeRuleAllowed = null;
function universeRuleAllowedControls() {
  if (!_universeRuleAllowed) {
    const allDirs = Object.keys(registry).map((name) => ({ name }));
    _universeRuleAllowed = loadLibsFromDirectives(allDirs).ruleAllowedControls;
  }
  return _universeRuleAllowed;
}
registerAll(LIBS);
function motsDInvocation() {
  const table = /* @__PURE__ */ new Map();
  for (const [fichier, lib] of Object.entries(registry)) {
    const mot = lib && typeof lib === "object" ? lib.resolves : null;
    if (!mot) continue;
    if (!table.has(mot)) table.set(mot, []);
    table.get(mot).push(fichier);
  }
  return table;
}
function fichierDeLAxe(axe) {
  const fichiers = motsDInvocation().get(axe);
  return fichiers && fichiers.length ? fichiers[0] : axe;
}
function loadJsonFile(name) {
  const canonical = fichierDeLAxe(name);
  if (cache[canonical]) return cache[canonical];
  const regData = registry[canonical] || registry[name];
  if (regData) {
    cache[canonical] = regData;
    return regData;
  }
  return null;
}
function loadLib(name, subkey) {
  if (subkey) {
    if (CHAMPS_DE_FICHIER.has(subkey)) return null;
    const fichiers = motsDInvocation().get(name);
    if (fichiers && fichiers.length > 1) {
      for (const f of fichiers) {
        const lib = loadJsonFile(f);
        const e = lib && (lib.alphabets?.[subkey] || lib.tables?.[subkey] || lib.objects?.[subkey] || lib[subkey]);
        if (e) return e;
      }
    }
    const file = loadJsonFile(name);
    if (file) {
      const entry = file.alphabets?.[subkey] || file.tables?.[subkey] || file.objects?.[subkey] || file[subkey];
      if (entry) return entry;
    }
    const subFile = loadJsonFile(name + "/" + subkey);
    if (subFile) return subFile;
    return null;
  }
  return loadJsonFile(name);
}
function porteesDeclarees(nom) {
  if (!nom) return null;
  for (const lib of Object.values(registry)) {
    if (!lib || typeof lib !== "object") continue;
    for (const section of Object.values(lib)) {
      if (!section || typeof section !== "object" || Array.isArray(section)) continue;
      const def = section[nom];
      if (def && typeof def === "object" && Array.isArray(def.scope)) return def.scope;
    }
  }
  return null;
}
function groupeDUnicite(nom) {
  if (!nom) return null;
  for (const lib of Object.values(registry)) {
    if (!lib || typeof lib !== "object") continue;
    for (const section of Object.values(lib)) {
      if (!section || typeof section !== "object" || Array.isArray(section)) continue;
      const def = section[nom];
      if (def && typeof def === "object" && def.unicite) return def.unicite;
    }
  }
  return null;
}
function directiveDeclareeParLaLibrairie(lib, nom) {
  const file = loadJsonFile(lib);
  if (!file || !nom) return false;
  const declareeIci = (f) => {
    if (!f) return false;
    const reserved = f.schema && f.schema.reservedDirectives || [];
    if (Array.isArray(reserved) && reserved.includes(nom)) return true;
    if (f.values && Object.prototype.hasOwnProperty.call(f.values, nom)) return true;
    if (f.controls && Object.prototype.hasOwnProperty.call(f.controls, nom)) return true;
    for (const section of Object.values(f)) {
      if (!section || typeof section !== "object" || Array.isArray(section)) continue;
      const def = section[nom];
      if (def && typeof def === "object" && Array.isArray(def.scope)) return true;
    }
    return false;
  };
  if (declareeIci(file)) return true;
  const vus = /* @__PURE__ */ new Set([lib]);
  const aTraiter = Array.isArray(file.apporte) ? [...file.apporte] : [];
  while (aTraiter.length) {
    const nomLib = aTraiter.shift();
    if (vus.has(nomLib)) continue;
    vus.add(nomLib);
    const f = loadJsonFile(nomLib);
    if (declareeIci(f)) return true;
    if (f && Array.isArray(f.apporte)) aTraiter.push(...f.apporte);
  }
  return false;
}
function resolveActorAlphabet(nom, directives) {
  const r = resolveActorAlphabetSource(nom, directives);
  return r ? r.entry : null;
}
function resolveActorAlphabetSource(nom, directives) {
  const fichiers = motsDInvocation().get("alphabet") || [];
  for (let i = 0; i < fichiers.length; i++) {
    const e = loadJsonFile(fichiers[i]);
    const entry = e && (e.alphabets?.[nom] || e[nom]);
    if (entry && nomsDeTerminaux(entry)) {
      return { entry, lib: i === 0 ? null : (registry[fichiers[i]] || {}).resolves || fichiers[i] };
    }
  }
  const standard = loadLib("alphabet", nom);
  if (standard && nomsDeTerminaux(standard)) return { entry: standard, lib: null };
  for (const d of directives || []) {
    if (!d || !d.name || d.name === "alphabet") continue;
    const entry = loadLib(d.name, nom);
    if (entry && nomsDeTerminaux(entry)) return { entry, lib: d.name };
  }
  return null;
}
function estUneDeclarationDeControle(def) {
  return def !== null && typeof def === "object" && !Array.isArray(def) && "args" in def && "description" in def;
}
function nomsDeTerminaux(alphabetLib) {
  if (!alphabetLib || !alphabetLib.terminals || typeof alphabetLib.terminals !== "object") return null;
  return Object.keys(alphabetLib.terminals);
}
function loadLibsFromDirectives(directives) {
  const ctx = {
    controls: {},
    // name → { bp3, args, ... }
    controlMap: {},
    // name → bp3 name (e.g. "vel" → "_vel")
    // ⛔ LE DESTINATAIRE D'UN CONTRÔLE — nom → l'outil qui le RÉSOUT, verbatim depuis le champ
    // `resolvedBy` de la librairie qui le déclare. C'est le principe de découpage des librairies
    // (une librairie, un destinataire) rendu LISIBLE : sans cette table, l'information s'arrêtait
    // au chargeur et l'aval devait redeviner la destination à partir du nom de la clé, avec une
    // table recopiée chez lui — qui dérive en silence le jour où une clé change de librairie.
    // La valeur n'est jamais traduite ni interprétée ici : elle est portée telle qu'elle est
    // écrite, et c'est le consommateur qui sait ce qu'il en fait.
    controlResolvedBy: {},
    // `<librairie>.<contrôle>` → la déclaration, pour lever l'ambiguïté quand deux librairies
    // portent le même nom (règle Romain 2026-08-13). Toujours peuplé, ambiguïté ou non : la forme
    // préfixée s'écrit et se lit dans les deux cas, elle n'est pas un mode de secours.
    controlsQualified: {},
    controlQualifiedResolvedBy: {},
    // Les noms qu'au moins DEUX librairies déclarent — écrits nus, ils sont refusés.
    ambiguousControls: /* @__PURE__ */ new Set(),
    // ── L'INTERFACE ET SA RÉALISATION ────────────────────────────────────────────────────────
    // `<librairie>.<contrôle>` de l'INTERFACE → les qualifiés qui la RÉALISENT. Doctrine de
    // Romain : « MIDI a toutes ses primitives, et `expression` est un sur-ensemble d'appel
    // générique qui va appeler les primitives d'expression du runtime sous-jacent quel qu'il
    // soit ». Un mot déclaré des deux côtés n'est donc pas une paire d'homonymes : il y a UNE
    // entrée publique — l'interface — et des réalisations qu'on vise par leur préfixe.
    implementations: {},
    // Le qualifié de la réalisation → le qualifié de l'interface qu'elle réalise (l'inverse).
    implementedInterface: {},
    controlNames: /* @__PURE__ */ new Set(),
    bp3NativeControls: /* @__PURE__ */ new Set(),
    // controls BP3 understands natively (no "transport" field)
    seqPrefixControls: /* @__PURE__ */ new Set(),
    // engine controls with scope:"seq_prefix" — emitted as prefix inside group/sequence
    dispatcherOnlyControls: /* @__PURE__ */ new Set(),
    // controls only the dispatcher understands (have "transport" field, e.g. audio)
    dualContextControls: /* @__PURE__ */ new Set(),
    // controls that appear in BOTH engine and runtime — in () always route to _script
    subgrammarControls: /* @__PURE__ */ new Map(),
    // subgrammar-level directives: name → { bp3, args }
    noArgControls: /* @__PURE__ */ new Set(),
    bagOnlyControls: /* @__PURE__ */ new Set(),
    // `bagOnly:true` — aucune forme nue dans le flux, cf. plus bas
    // ⛔ CES DEUX ENSEMBLES DISENT LE DESTINATAIRE, PAS LE SIGNE (rectifié 2026-08-08, Romain :
    // « le destinataire des contrôles est spécifié dans la LIBRAIRIE dans laquelle le contrôle est
    // listé, c'est la seule source de vérité »). Leur ancien commentaire — « déclarés sous `engine`
    // → sac MOTEUR `[…]` » — faisait dire à la librairie COMMENT une chose s'écrit alors qu'elle ne
    // répond qu'à QUI l'exécute. C'est cette confusion qui a fait croire qu'un contrôle exécuté par
    // le moteur devait s'écrire entre crochets : `shuffle`, `retro` et `order` sont bien moteur, et
    // s'écrivent entre PARENTHÈSES parce qu'ils manipulent ce qui est produit.
    // Le SIGNE dit ce que la chose EST — dérivation ou production. Chantier en cours.
    engineBagControls: /* @__PURE__ */ new Set(),
    // exécutés par le MOTEUR (déclarés sous `engine`)
    runtimeBagControls: /* @__PURE__ */ new Set(),
    // exécutés par le RUNTIME (déclarés sous `runtime.*`)
    // Un contrôle ne vit pas dans les deux.
    ruleAllowedControls: /* @__PURE__ */ new Set(),
    // portée INCLUANT `rule` — voir le commentaire du remplissage
    ruleScopeControls: /* @__PURE__ */ new Set(),
    // PROCÉDURES DE NIVEAU RÈGLE (`scope:"rule"` dans la lib) :
    // goto, failed, repeat, stop. Elles ne s'appliquent pas à une
    // POSITION mais à la RÈGLE entière — le moteur les extrait en
    // métadonnée (BPx loadGrammar.ts:3996 mergeQualifierProcedures).
    componentControls: /* @__PURE__ */ new Set(),
    // contrôles désignés par un NUMÉRO DE COMPOSANT : `(cc.98:45)`.
    // Marqués `component:"number"` dans la lib. Le point appelle le
    // composant, les deux points affectent la valeur.
    intervalControls: /* @__PURE__ */ new Set(),
    // controls whose argument is a MUSICAL INTERVAL (fraction 3/2, cents 700c,
    // decimal 1.5) — marqués `argType:"interval"` dans la lib. La valeur est
    // portée BRUTE (chaîne) et résolue en aval par normalizeRatio (Kairos).
    symbols: {},
    // name → { type, ... }
    alphabetTerminals: [],
    // terminaux issus des SEULS alphabets (sans core etc.) —
    // porte du découpeur mono-char (bpxAst.js, flip Palier 4 étape A)
    _libs: {},
    // directive name → raw lib data (for generator access)
    _alphabets: [],
    // loaded alphabet libs (deferred terminal generation)
    _octaveConvention: null,
    // resolved octave convention name
    transcriptions: {},
    // name → { mappings: { a: b, ... } }
    // SCENE_VALUES (hub [293]) : registre GÉNÉRIQUE des valeurs déclarées par les
    // librairies chargées (section top-level `values` d'un fichier lib). Une valeur
    // ajoutée demain à une lib = une entrée JSON, zéro code. nom → spec
    // { unit?, range?, values?, default?, componentDefault?, description?, _axis }.
    // `_axis` = clé d'entité d'acteur du fichier déclarant (tuning, alphabet…) —
    // sert à résoudre `componentDefault` sur le composant référencé par l'acteur.
    valueRegistry: {},
    valueRegistryErrors: []
    // collisions de noms (réservés/contrôles) — remontées à l'émission
  };
  const coreLib = loadJsonFile("core") || {};
  const schema = coreLib.schema || {};
  const nomsReserves = (rd) => Array.isArray(rd) ? rd : [];
  ctx.reservedDirectiveNames = new Set(nomsReserves(schema.reservedDirectives));
  ctx.addressKeys = /* @__PURE__ */ new Set();
  for (const lib of Object.values(registry)) {
    const s = lib && lib.schema;
    if (s && s.reservedDirectives) for (const n of nomsReserves(s.reservedDirectives)) ctx.reservedDirectiveNames.add(n);
    for (const section of Object.values(lib || {})) {
      if (!section || typeof section !== "object" || Array.isArray(section)) continue;
      for (const [nom, def] of Object.entries(section)) {
        if (nom.startsWith("_") || !def || typeof def !== "object") continue;
        if (Array.isArray(def.scope) && def.scope.includes("scene")) ctx.reservedDirectiveNames.add(nom);
      }
    }
    if (s && s.addressKeys) {
      for (const n of Array.isArray(s.addressKeys) ? s.addressKeys : Object.keys(s.addressKeys)) ctx.addressKeys.add(n);
    }
  }
  ctx.qualifierKeys = new Set(schema.qualifierKeys || []);
  ctx.catalogAxes = Array.isArray(schema.catalogAxes) ? schema.catalogAxes.slice() : [];
  ctx.defaultComponents = coreLib.defaults && coreLib.defaults.components || {};
  const mergeValueRegistry = (file, axis) => {
    if (!file || !file.values || typeof file.values !== "object") return;
    for (const [vname, spec] of Object.entries(file.values)) {
      if (vname.startsWith("_") || !spec || typeof spec !== "object") continue;
      if (ctx.reservedDirectiveNames.has(vname) || ctx.controlNames.has(vname)) {
        ctx.valueRegistryErrors.push({
          message: `Valeur de librairie '${vname}' : nom r\xE9serv\xE9 (directive moteur ou contr\xF4le existant) \u2014 renommer dans la librairie`
        });
        continue;
      }
      ctx.valueRegistry[vname] = { ...spec, _axis: axis || null };
    }
  };
  if (coreLib.defaults && coreLib.defaults.values) {
    for (const [vname, spec] of Object.entries(coreLib.defaults.values)) {
      if (vname.startsWith("_") || !spec || typeof spec !== "object") continue;
      ctx.valueRegistry[vname] = { ...spec, _axis: null };
    }
  }
  const digitalLib = loadJsonFile("function");
  ctx.digitalFunctions = new Set(Object.keys(digitalLib && digitalLib.objects || {}));
  const settingsLib = loadLib("settings");
  if (settingsLib) ctx._libs["settings"] = settingsLib;
  const invoquees = new Set((directives || []).map((d) => d && d.name).filter(Boolean));
  const apportees = [];
  const aTraiter = [...directives || []];
  while (aTraiter.length) {
    const d = aTraiter.shift();
    const socle = d && d.name ? loadJsonFile(d.name) : null;
    for (const nom of socle && Array.isArray(socle.apporte) ? socle.apporte : []) {
      if (invoquees.has(nom)) continue;
      invoquees.add(nom);
      const nouvelle = { type: "Directive", name: nom, subkey: null };
      apportees.push(nouvelle);
      aTraiter.push(nouvelle);
    }
  }
  const aCharger = apportees.length ? [...apportees, ...directives || []] : directives || [];
  const provenance = /* @__PURE__ */ new Map();
  const declarer = (nom, origine) => {
    if (!provenance.has(nom)) provenance.set(nom, /* @__PURE__ */ new Set());
    provenance.get(nom).add(origine);
  };
  for (const dir of aCharger) {
    if (dir.name === "cc" && dir.ccMappings) {
      for (const cc of dir.ccMappings) {
        declarer(cc.name, `le contr\xF4leur nomm\xE9 'cc ${cc.name}' de la sc\xE8ne`);
        ctx.controls[cc.name] = {
          args: ["value"],
          range: [0, 127],
          default: 0,
          description: `User CC${cc.number}`,
          transportGroup: "midi",
          ccNumber: cc.number
        };
        ctx.controlNames.add(cc.name);
        ctx.dispatcherOnlyControls.add(cc.name);
      }
      continue;
    }
    if ((dir.type === "ActorDirective" || dir.name === "actor") && dir.properties) {
      for (const axis of ["alphabet", "tuning", "octaves"]) {
        if (dir.properties[axis]) mergeValueRegistry(loadJsonFile(axis), axis);
      }
      continue;
    }
    const lib = loadLib(dir.name, dir.subkey);
    mergeValueRegistry(loadJsonFile(dir.name), dir.name);
    if (!lib) continue;
    const libKey = dir.subkey ? `${dir.name}.${dir.subkey}` : dir.name;
    ctx._libs[libKey] = lib;
    if (lib.subgrammar) {
      for (const [name, def] of Object.entries(lib.subgrammar)) {
        if (name === "_comment") continue;
        ctx.subgrammarControls.set(name, def);
      }
    }
    const controlSources = [];
    if (lib.controls) controlSources.push({ source: lib.controls, isEngine: false, section: "controls" });
    if (lib.engine) controlSources.push({ source: lib.engine, isEngine: true, section: "engine" });
    if (lib.subgrammar) {
      const dansLeFlux = Object.fromEntries(Object.entries(lib.subgrammar).filter(
        ([nom, def]) => nom !== "_comment" && def && Array.isArray(def.scope) && def.scope.includes("flow")
      ));
      if (Object.keys(dansLeFlux).length) controlSources.push({ source: dansLeFlux, isEngine: true, section: "subgrammar" });
    }
    if (lib.groups && typeof lib.groups === "object" && !Array.isArray(lib.groups)) {
      for (const [groupName, groupContent] of Object.entries(lib.groups)) {
        if (groupName === "_comment") continue;
        if (typeof groupContent === "object" && groupContent !== null && !Array.isArray(groupContent)) {
          const hasNestedDefs = Object.values(groupContent).some(
            (v) => typeof v === "object" && v !== null && ("args" in v || "description" in v)
          );
          if (hasNestedDefs) {
            for (const [name, def] of Object.entries(groupContent)) {
              if (name.startsWith("_")) continue;
              controlSources.push({ source: { [name]: { ...def, transportGroup: groupName } }, isEngine: false, section: `groups.${groupName}` });
            }
            continue;
          }
        }
        controlSources.push({ source: { [groupName]: groupContent }, isEngine: false, section: "groups" });
      }
    }
    for (const { source, isEngine, section } of controlSources) {
      for (const [name, def] of Object.entries(source)) {
        if (name.startsWith("_")) continue;
        if (!estUneDeclarationDeControle(def)) {
          throw new Error(
            `lib '${dir.name}' : l'entr\xE9e '${name}' occupe une section de contr\xF4les sans \xEAtre une d\xE9claration de contr\xF4le (il lui faut 'args' ET 'description'). Une cl\xE9 de documentation se pr\xE9fixe par '_' ; sinon, c'est une entr\xE9e du VOCABULAIRE et elle doit se d\xE9clarer comme telle \u2014 un fichier de donn\xE9es n'agrandit pas le langage en le commentant.`
          );
        }
        declarer(name, `lib/${dir.name}.json \u2192 ${section}`);
        if (def.bpscript === false) continue;
        ctx.controls[name] = def;
        if (typeof def.bp3 === "string" && def.bp3) ctx.controlMap[name] = def.bp3;
        const parDefaut = (loadJsonFile(dir.name) || {}).resolvedBy;
        const destinataire = typeof def.resolvedBy === "string" && def.resolvedBy ? def.resolvedBy : parDefaut;
        if (destinataire) ctx.controlResolvedBy[name] = destinataire;
        ctx.controlsQualified[`${dir.name}.${name}`] = def;
        if (destinataire) ctx.controlQualifiedResolvedBy[`${dir.name}.${name}`] = destinataire;
        if (typeof def.implements === "string" && def.implements) {
          const qual = `${dir.name}.${name}`;
          ctx.implementedInterface[qual] = def.implements;
          (ctx.implementations[def.implements] = ctx.implementations[def.implements] || []).push(qual);
        }
        ctx.controlNames.add(name);
        if (isEngine) {
          ctx.bp3NativeControls.add(name);
          ctx.engineBagControls.add(name);
          if (def.scope === "seq_prefix") {
            ctx.seqPrefixControls.add(name);
          }
        } else {
          ctx.dispatcherOnlyControls.add(name);
          ctx.runtimeBagControls.add(name);
        }
        if (!def.args || def.args.length === 0) {
          ctx.noArgControls.add(name);
        }
        if (def.bagOnly === true) {
          ctx.bagOnlyControls.add(name);
        }
        if (def.component === "number") {
          ctx.componentControls.add(name);
        }
        const portees = Array.isArray(def.scope) ? def.scope : def.scope ? [def.scope] : [];
        if (portees.includes("rule") && typeof def.bp3 === "string" && !portees.includes("symbol") && !portees.includes("group")) {
          ctx.ruleScopeControls.add(name);
        }
        if (portees.includes("rule")) ctx.ruleAllowedControls.add(name);
        if (def.argType === "interval") {
          ctx.intervalControls.add(name);
        }
      }
    }
    for (const name of ctx.bp3NativeControls) {
      if (ctx.dispatcherOnlyControls.has(name)) {
        ctx.dualContextControls.add(name);
      }
    }
    if (lib.symbols) {
      for (const [name, def] of Object.entries(lib.symbols)) {
        ctx.symbols[name] = def;
      }
    }
    if (nomsDeTerminaux(lib)) {
      ctx._alphabets.push(lib);
      if (lib.octaves) ctx._octaveConvention = lib.octaves;
    }
    if (dir.name === "octaves" && dir.runtime) {
      ctx._octaveConvention = dir.runtime;
    }
    if (dir.name === "homomorphism" && dir.subkey && (lib?.mappings || lib?.sections)) {
      ctx.transcriptions[dir.subkey] = lib;
    }
  }
  const octaveDef = ctx._octaveConvention ? loadLib("octaves")?.[ctx._octaveConvention] : null;
  for (const lib of ctx._alphabets) {
    if (octaveDef) {
      const alts = lib.alterations && typeof lib.alterations === "object" && !Array.isArray(lib.alterations) ? Object.keys(lib.alterations) : Array.isArray(lib.alterations) && lib.alterations.length > 0 ? lib.alterations : [""];
      for (const note of nomsDeTerminaux(lib)) {
        for (const alt of alts) {
          for (const reg of octaveDef.registers) {
            const noteAlt = note + alt;
            const terminal = octaveDef.position === "suffix" ? noteAlt + octaveDef.separator + reg : reg + octaveDef.separator + noteAlt;
            ctx.alphabetTerminals.push(terminal);
          }
        }
      }
    } else {
      for (const note of nomsDeTerminaux(lib)) {
        ctx.alphabetTerminals.push(note);
      }
    }
  }
  const declareDansLeRegistre = (qualifie) => {
    const point = qualifie.indexOf(".");
    if (point < 0) return false;
    const lib = registry[qualifie.slice(0, point)];
    const nom = qualifie.slice(point + 1);
    if (!lib || typeof lib !== "object") return false;
    for (const section of Object.values(lib)) {
      if (!section || typeof section !== "object" || Array.isArray(section)) continue;
      if (section[nom] && typeof section[nom] === "object") return true;
      for (const sous of Object.values(section)) {
        if (sous && typeof sous === "object" && !Array.isArray(sous) && sous[nom] && typeof sous[nom] === "object" && ("args" in sous[nom] || "description" in sous[nom])) return true;
      }
    }
    return false;
  };
  for (const [qual, cible] of Object.entries(ctx.implementedInterface)) {
    if (!declareDansLeRegistre(cible)) {
      throw new Error(
        `'${qual}' d\xE9clare 'implements:${cible}', et '${cible}' n'est d\xE9clar\xE9 nulle part. Une r\xE9alisation vise une interface EXISTANTE, \xE9crite '<librairie>.<contr\xF4le>'.`
      );
    }
    if (cible === qual) {
      throw new Error(
        `'${qual}' d\xE9clare se r\xE9aliser lui-m\xEAme. Une r\xE9alisation vise l'interface d'une AUTRE librairie \u2014 celle que l'auteur \xE9crit, quand la r\xE9alisation est celle du runtime actif.`
      );
    }
  }
  for (const [nom, origines] of provenance) {
    if (origines.size <= 1) continue;
    const quals = Object.keys(ctx.controlsQualified).filter((q) => q.slice(q.indexOf(".") + 1) === nom);
    const interfaces = quals.filter((q) => !ctx.implementedInterface[q]);
    const implementations = quals.filter((q) => ctx.implementedInterface[q]);
    const toutesVersLaMeme = implementations.length > 0 && interfaces.length === 1 && implementations.every((q) => ctx.implementedInterface[q] === interfaces[0]);
    if (!toutesVersLaMeme) {
      ctx.ambiguousControls.add(nom);
      continue;
    }
    ctx.controls[nom] = ctx.controlsQualified[interfaces[0]];
    if (typeof ctx.controls[nom].bp3 === "string" && ctx.controls[nom].bp3) ctx.controlMap[nom] = ctx.controls[nom].bp3;
    const dest = ctx.controlQualifiedResolvedBy[interfaces[0]];
    if (dest) ctx.controlResolvedBy[nom] = dest;
  }
  for (const lib of Object.values(registry)) {
    const valeurs = lib && lib.controlDefaults;
    if (!valeurs || typeof valeurs !== "object" || Array.isArray(valeurs)) continue;
    for (const [nom, valeur] of Object.entries(valeurs)) {
      if (nom.startsWith("_")) continue;
      const def = ctx.controls[nom];
      if (!def || typeof def !== "object") continue;
      ctx.controls[nom] = { ...def, default: valeur };
    }
  }
  return ctx;
}
function describeVocabulary(directives = []) {
  const aUneScene = Array.isArray(directives) && directives.length > 0;
  const allDirs = aUneScene ? directives : Object.keys(registry).map((name) => ({ name }));
  const ctx = loadLibsFromDirectives(allDirs);
  const isEntry = (v) => v && typeof v === "object" && !Array.isArray(v);
  const META = CHAMPS_DE_FICHIER;
  const components = {};
  for (const axis of ctx.catalogAxes) {
    const file = loadLib(axis);
    components[axis] = file ? file.objects && isEntry(file.objects) ? Object.keys(file.objects).filter((k) => !k.startsWith("_")) : Object.keys(file).filter((k) => !k.startsWith("_") && !META.has(k) && isEntry(file[k])) : [];
  }
  const pick = (def, keys) => {
    const o = {};
    for (const k of keys) if (def[k] !== void 0) o[k] = def[k];
    return o;
  };
  const langLib = SYNTAXE;
  const voicesLib = loadJsonFile("voice");
  const voiceNames = Object.keys(voicesLib && voicesLib.objects || {});
  return {
    voices: voiceNames,
    keywords: [...ctx.reservedDirectiveNames],
    controls: Object.entries(ctx.controls).map(([name, def]) => ({ name, ...pick(def || {}, ["args", "range", "values", "default", "description", "transportGroup"]) })),
    values: Object.entries(ctx.valueRegistry).map(([name, spec]) => ({ name, ...pick(spec || {}, ["range", "unit", "values", "description"]) })),
    functions: [...ctx.digitalFunctions],
    components,
    addressKeys: [...ctx.addressKeys],
    // Réglages RÉSERVÉS (mode/scan/weight/on_fail/tempx/meter) — écrits en PARENTHÈSES depuis la
    // décision Romain 2026-08-02 (LANGUAGE.md:773-800). Exposé pour que le vocabulaire consommé
    // par validateReferences() les reconnaisse comme des attributs `(k:v)` connus.
    qualifierKeys: [...ctx.qualifierKeys],
    directiveValues: langLib.directiveValues || {},
    syntaxWords: langLib.syntaxWords || {}
  };
}

// src/transpiler/constants.js
var BP3_OPERATORS = Object.freeze({ plus: "+", fin: ";", star: "*" });

// src/transpiler/parser.js
var ParseError = class extends Error {
  constructor(msg, token) {
    super(`${msg} at line ${token.line}:${token.col}`);
    this.token = token;
  }
};
function addressKeys() {
  const keys = universeAddressKeys();
  if (!keys || keys.size === 0) {
    throw new Error("aucune cl\xE9 d'adresse d\xE9clar\xE9e dans les librairies \u2014 le parseur ne peut plus distinguer une adresse d'un contr\xF4le (elles vivent dans `midi`, section schema.addressKeys)");
  }
  return keys;
}
var _actorKeys = null;
function actorKeysData() {
  if (_actorKeys) return _actorKeys;
  const sch = (loadLib("core") || {}).schema || {};
  const valides = sch.actorKeys, perimees = sch.deprecatedActorKeys || [];
  if (!Array.isArray(valides) || valides.length === 0) {
    throw new Error("lib/core.json schema.actorKeys est vide ou absent \u2014 le parseur n'a plus de cl\xE9s d'acteur");
  }
  _actorKeys = {
    valides: new Set(valides),
    perimees: new Set(perimees),
    toutes: /* @__PURE__ */ new Set([...valides, ...perimees])
  };
  return _actorKeys;
}
var _varConventions = null;
function varConventions() {
  if (_varConventions) return _varConventions;
  const c = ((loadLib("core") || {}).schema || {}).varConventions;
  if (!Array.isArray(c) || c.length === 0) {
    throw new Error("lib/core.json schema.varConventions est vide ou absent");
  }
  _varConventions = new Set(c);
  return _varConventions;
}
var _catalogAxisKeys = null;
function catalogAxisKeys() {
  if (_catalogAxisKeys) return _catalogAxisKeys;
  const core = loadLib("core") || {};
  const axes = core?.schema?.catalogAxes;
  if (!Array.isArray(axes) || axes.length === 0) {
    throw new Error("lib/core.json schema.catalogAxes est vide ou absent \u2014 le parseur n'a plus d'axes de catalogue");
  }
  _catalogAxisKeys = new Set(axes);
  return _catalogAxisKeys;
}
var _deprecatedTransports = null;
function deprecatedTransports() {
  if (_deprecatedTransports) return _deprecatedTransports;
  const core = loadLib("core") || {};
  _deprecatedTransports = new Set(core.schema && core.schema.deprecatedTransports || []);
  return _deprecatedTransports;
}
var _channelCatalog = null;
function channelCatalog() {
  if (_channelCatalog) return _channelCatalog;
  const core = loadLib("core") || {};
  _channelCatalog = core.schema && core.schema.channels || {};
  return _channelCatalog;
}
var _outChannels = null;
function outChannels() {
  if (_outChannels) return _outChannels;
  const cat = channelCatalog();
  _outChannels = new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].out));
  return _outChannels;
}
function refuserCanalDeSortieInconnu(name, subkey, tok) {
  if (name !== "out" || !subkey) return;
  if (!outChannels().has(subkey)) {
    throw new ParseError(
      `'${subkey}' n'est pas une sortie \u2014 les canaux de sortie sont ${[...outChannels()].join(", ")}. La liste est FERM\xC9E.`,
      tok
    );
  }
  if (!writableChannels().has(subkey)) {
    throw new ParseError(
      `'out.${subkey}' est refus\xE9 \u2014 ce canal est une DESTINATION de l'architecture, rout\xE9e comme les autres sorties, mais son \xC9CRITURE dans une sc\xE8ne attend encore son appareil d\xE9di\xE9.`,
      tok
    );
  }
}
function refuserModeInvalide(name, runtime, value, tok) {
  if (name !== "mode") return;
  const declares = ((SYNTAXE.directiveValues.mode || {}).values || []).map((v) => v.name);
  const ecrit = runtime ?? (value == null ? null : String(value));
  if (ecrit == null) {
    throw new ParseError(
      `'mode' attend le mode de d\xE9rivation qu'il pose \u2014 'mode:<mode>'. \xC9crit seul, il ne gouverne RIEN : la sous-grammaire garde le mode qu'elle avait, et la ligne dispara\xEEt sans un signe. Les modes sont ${declares.join(", ")}.`,
      tok
    );
  }
  if (!declares.includes(ecrit)) {
    throw new ParseError(
      `'mode:${ecrit}' : '${ecrit}' n'est pas un mode de d\xE9rivation \u2014 les modes sont ${declares.join(", ")}. La liste est FERM\xC9E.`,
      tok
    );
  }
}
var _inChannels = null;
function inChannels() {
  if (_inChannels) return _inChannels;
  const cat = channelCatalog();
  _inChannels = new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].in));
  return _inChannels;
}
var _writableChannels = null;
function writableChannels() {
  if (_writableChannels) return _writableChannels;
  const cat = channelCatalog();
  _writableChannels = new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].writable));
  return _writableChannels;
}
var _voicesIndex = null;
function voicesIndex() {
  if (_voicesIndex) return _voicesIndex;
  _voicesIndex = /* @__PURE__ */ new Map();
  const lib = loadLib("voice");
  for (const [name, def] of Object.entries(lib && lib.objects || {})) {
    const forDevices = def && typeof def.for === "object" && def.for ? { ...def.for } : {};
    _voicesIndex.set(name, { base: def, forDevices });
  }
  return _voicesIndex;
}
function isTypedBacktick(v) {
  return typeof v === "string" && /^`\s*[A-Za-z_][\w-]*\s*:/.test(v);
}
function assertVoiceRef(name, where, token) {
  const entry = voicesIndex().get(name);
  if (!entry) {
    throw new ParseError(
      `${where} : voix '${name}' inconnue \u2014 aucune entr\xE9e '${name}' dans le catalogue du mot 'voice' (LANG-SONS \xA73).`,
      token
    );
  }
  const defs = [...entry.base ? [entry.base] : [], ...Object.values(entry.forDevices)];
  for (const def of defs) {
    if (def.audio !== void 0 && !isTypedBacktick(def.audio)) {
      throw new ParseError(
        `${where} : voix '${name}' \u2014 r\xE9alisation 'audio' invalide dans le catalogue du mot 'voice' : un backtick TYP\xC9 est requis (\`js: \u2026\`, \`faust: \u2026\`) ; re\xE7u ${JSON.stringify(def.audio)}.`,
        token
      );
    }
  }
}
var _alphabetVoicesChecked = /* @__PURE__ */ new Set();
function assertAlphabetVoices(alphabetName, token) {
  if (_alphabetVoicesChecked.has(alphabetName)) return;
  const alpha = loadLib("alphabet", alphabetName);
  if (alpha) {
    for (const [terminal, def] of Object.entries(alpha.terminals || {})) {
      if (def && def.voice) {
        assertVoiceRef(def.voice, `alphabet '${alphabetName}', terminal '${terminal}'`, token);
      }
    }
    if (alpha.voice) {
      assertVoiceRef(alpha.voice, `alphabet '${alphabetName}', voix de la collection`, token);
    }
  }
  _alphabetVoicesChecked.add(alphabetName);
}
function normalizeName(name) {
  return name in BP3_OPERATORS ? BP3_OPERATORS[name] : name;
}
function parse(tokens, opts = {}) {
  let pos = 0;
  const lignesSource = typeof opts.source === "string" ? opts.source.split(/\r\n?|\n/) : null;
  let libCtx = {
    controlNames: /* @__PURE__ */ new Set(),
    noArgControls: /* @__PURE__ */ new Set(),
    bagOnlyControls: /* @__PURE__ */ new Set(),
    dispatcherOnlyControls: /* @__PURE__ */ new Set(),
    engineControls: /* @__PURE__ */ new Set(),
    intervalControls: /* @__PURE__ */ new Set(),
    qualifierKeys: /* @__PURE__ */ new Set(),
    sceneNames: /* @__PURE__ */ new Set(),
    controlMap: {},
    controls: {},
    symbols: {},
    transcriptions: {},
    actors: {},
    controlsQualified: {},
    controlQualifiedResolvedBy: {},
    ambiguousControls: /* @__PURE__ */ new Set()
  };
  const definitionsDeclarees = /* @__PURE__ */ new Set();
  const nomsDeclaresLocalement = /* @__PURE__ */ new Set();
  const acteursDeclares = /* @__PURE__ */ new Set();
  const prototypesDeclares = /* @__PURE__ */ new Set();
  const nomsVariables = /* @__PURE__ */ new Set();
  function warn(message, line) {
    if (opts.onWarning) opts.onWarning({ message, line });
  }
  function current() {
    return tokens[pos] || { type: T.EOF, value: null, line: 0, col: 0 };
  }
  function peek(offset = 0) {
    return tokens[pos + offset] || { type: T.EOF };
  }
  function advance() {
    return tokens[pos++];
  }
  function expect(type) {
    const tok = current();
    if (tok.type !== type) throw new ParseError(`Expected ${type}, got ${tok.type} (${tok.value})`, tok);
    return advance();
  }
  function lireNomDEntree(tok) {
    if (!at(T.IDENT) && !at(T.INT)) {
      throw new ParseError(`Expected ${T.IDENT}, got ${current().type} (${current().value})`, tok || current());
    }
    const chiffreDAbord = at(T.INT);
    const depart = current();
    let nom = String(advance().value);
    while ((at(T.IDENT) || at(T.INT) || at(T.REST)) && !current().spaceBefore) nom += String(advance().value);
    if (chiffreDAbord && !/[A-Za-z]/.test(nom)) {
      throw new ParseError(
        `'${nom}' est un NOMBRE, pas un nom. Un nom qui commence par un chiffre porte au moins une lettre \u2014 '12TET' et '22shruti' sont des noms, '${nom}' n'en est pas un.`,
        depart
      );
    }
    return nom;
  }
  function ouvreUnNom(offset = 0) {
    if (peek(offset).type === T.IDENT) return true;
    if (peek(offset).type !== T.INT) return false;
    const suite = peek(offset + 1);
    return (suite.type === T.IDENT || suite.type === T.INT) && suite.spaceBefore === false;
  }
  function at(type) {
    return current().type === type;
  }
  function ligneSansFleche() {
    for (let j = pos; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type === T.NEWLINE || t.type === T.EOF) return true;
      if (t.type === T.ARROW_R || t.type === T.ARROW_L || t.type === T.ARROW_BI) return false;
    }
    return true;
  }
  function atAny(...types) {
    return types.includes(current().type);
  }
  function skipNewlines() {
    while (at(T.NEWLINE) || at(T.COMMENT)) advance();
  }
  function atEnd() {
    return at(T.EOF);
  }
  function unfoldChains(chains) {
    const flat = {};
    for (const [key, imgs] of Object.entries(chains)) {
      const seq = [key, ...imgs];
      for (let i = 0; i < seq.length - 1; i++) flat[seq[i]] = seq[i + 1];
    }
    return Object.entries(flat);
  }
  function buildHomomorphisms(transcriptions, directives) {
    const result = [];
    if (!transcriptions || Object.keys(transcriptions).length === 0) return result;
    const lineMap = {};
    for (const dir of directives || []) {
      if (dir.name === "homomorphism" && dir.subkey) {
        lineMap[dir.subkey] = dir.line;
      }
    }
    for (const [subkey, table] of Object.entries(transcriptions)) {
      const line = lineMap[subkey];
      if (table.sections) {
        for (const [secName, body] of Object.entries(table.sections)) {
          if (body && body.chains) {
            result.push({ type: "Homomorphism", name: secName, pairs: unfoldChains(body.chains), line });
          } else {
            const pairs = Object.entries(body);
            result.push({ type: "Homomorphism", name: secName, pairs, line });
          }
        }
      } else if (table.mappings) {
        const pairs = Object.entries(table.mappings);
        result.push({ type: "Homomorphism", name: subkey, pairs, line });
      }
    }
    return result;
  }
  let enDeclaratif = false;
  function parseScene() {
    const scene = {
      type: "Scene",
      directives: [],
      // ⛔ LES DÉFINITIONS ONT LEUR PROPRE CHAMP, `defs: DefDirective[]` (AST.md:29), et elles
      // vivaient dans `directives`. La branche qui les range le disait elle-même : elle les avait
      // d'abord laissées tomber, six gardes étaient tombés en disant « accepter n'est pas
      // transmettre », et elles ont été poussées dans le SEAU LE PLUS PROCHE au lieu de leur
      // domicile contracté. Six gardes verts ne disent pas qu'un nœud est au bon endroit.
      // ⚠️ CE QUI L'A RÉVÉLÉ : le validateur de BPx, qui exige que `directives` ne porte QUE des
      // `Directive`. `dhati.bps` y émettait 39 `DefDirective` — la scène de tabla, celle-là même
      // dont Romain vient d'arbitrer la réécriture en `def`. Toute la migration à venir passait
      // par ce champ.
      defs: [],
      // `init: InitEntry[] | null` (AST.md:30) — NULL quand la scène n'en a pas, et non `undefined`
      // ni un tableau vide : « elle n'en a pas » et « elle en a un vide » doivent rester
      // distinguables par l'aval.
      init: null,
      actors: [],
      scenes: [],
      exposes: [],
      // VARIABLES DE TRAVAIL déclarées par `var` — noms de symboles qui ne sont l'écriture
      // d'aucune note (décision Romain 2026-07-27, voie 3).
      vars: [],
      // ENTRÉES déclarées par `var <rôle> in.<canal>` (ex-`in`, décision Romain 2026-08-04) —
      // un rôle, son canal, sa table éventuelle (décision Romain 2026-07-27, symétrie entrée/sortie).
      inputs: [],
      // `maps` SUPPRIMÉ le 2026-07-27 au soir, avec le mot : `map` est abandonné, le câblage passe
      // par les chevrons. Un champ ÉMIS ET TOUJOURS VIDE n'est pas neutre — un consommateur qui le
      // lit conclut « cette scène ne câble rien » au lieu de « ce canal n'existe plus ». On
      // supprime la donnée avec le mot, dans le même mouvement, sans voie parallèle.
      // `aliases` SUPPRIMÉ le 2026-08-15, par la même règle et pour la même raison : `alias` sort
      // du langage, donc son champ sort avec lui. Mesuré avant : aucun consommateur sur les 24
      // dépôts, et aucune scène du périmètre ne l'écrivait.
      // `labels` SUPPRIMÉ avec 'label' (2026-07-28) : un champ émis et toujours vide fait
      // conclure « cette scène n'étiquette rien » au lieu de « ce canal n'existe plus ».
      declarations: [],
      backticks: [],
      subgrammars: [],
      // v0.8 — sons (prototypes anonymes + nommés) et affectations sujet→son
      soundPrototypes: null,
      soundAssignments: null,
      // Contrat BPx (ast.ts:150-157) : table d'homomorphismes attachée par le parser
      // après chargement des libs. Vide si aucune directive @homomorphism.
      homomorphisms: []
    };
    skipNewlines();
    enDeclaratif = true;
    let initialMode = null;
    let initialModifiers = null;
    let premiereLigne = true;
    while (!atEnd() && !at(T.SEPARATOR)) {
      skipNewlines();
      if (atEnd()) break;
      if (premiereLigne && !ligneSansFleche()) break;
      if (!at(T.BACKTICK) && !atProductionBlock() && !ligneSansFleche()) {
        throw new ParseError(
          `une regle est ecrite AVANT le delimiteur : il manque la ligne '-----' entre la partie declarative et la production. Depuis que l arobase est sortie, c est la POSITION qui qualifie une ligne \u2014 avant le '-----' elle declare, apres elle produit.`,
          current()
        );
      }
      if (!at(T.BACKTICK) && !atProductionBlock()) {
        const dir = parseDirective();
        if (dir.type === "SceneDirective") {
          scene.scenes.push(dir);
        } else if (dir.type === "ExposeDirective") {
          scene.exposes.push(dir);
        } else if (dir.type === "InDirective") {
          scene.inputs = [...scene.inputs || [], dir];
        } else if (dir.type === "VarDirective") {
          scene.vars = [...scene.vars || [], dir];
          for (const n of dir.names) {
            nomsDeclaresLocalement.add(n);
            nomsVariables.add(n);
          }
          if (dir.varType?.kind === "type") {
            for (const n of dir.names) prototypesDeclares.add(n);
            if (dir.varType.type === null) for (const n of dir.names) definitionsDeclarees.add(n);
          }
        } else if (dir.type === "DefDirective") {
          definitionsDeclarees.add(dir.name);
          nomsDeclaresLocalement.add(dir.name);
          scene.defs.push(dir);
        } else if (dir.type === "Declaration") {
          scene.declarations.push(dir);
        } else if (dir.type === "InitDirective") {
          scene.init = [...scene.init || [], ...dir.entrees];
        } else if (dir.type === "ActorDirective") {
          scene.actors.push(dir);
          if (dir.name) acteursDeclares.add(dir.name);
          if (dir.soundAssignments && dir.soundAssignments.length > 0) {
            scene.soundAssignments = scene.soundAssignments || [];
            for (const sa of dir.soundAssignments) scene.soundAssignments.push(sa);
          }
          delete dir.soundAssignments;
        } else if (dir.type === "SoundSection") {
          scene.soundPrototypes = scene.soundPrototypes || [];
          for (const p of dir.prototypes) scene.soundPrototypes.push(p);
          if (dir.lib) {
            scene.directives.push({
              type: "Directive",
              name: "sound",
              subkey: dir.lib,
              binding: dir.libVariant || null,
              runtime: null,
              value: null,
              aliases: null,
              modifiers: null,
              line: dir.line
            });
          }
        } else if (dir.type === "AlphabetSoundAssignments") {
          scene.directives.push(dir.directive);
          scene.soundAssignments = scene.soundAssignments || [];
          for (const sa of dir.assignments) scene.soundAssignments.push(sa);
        } else if (dir.type === "LibRef") {
          (scene.libRefs || (scene.libRefs = [])).push(dir.address);
        } else if (dir.type === "Declaration") {
          scene.declarations.push(dir);
        } else if (dir.name === "mode" && dir.runtime) {
          initialMode = dir.runtime;
          initialModifiers = dir.modifiers || null;
        } else {
          scene.directives.push(dir);
          const reserves = new Set(((loadLib("core") || {}).schema || {}).reservedDirectives || []);
          const librairiesVues = /* @__PURE__ */ new Set();
          const apporterLesPrototypesDe = (nomLib) => {
            if (!nomLib || librairiesVues.has(nomLib)) return;
            librairiesVues.add(nomLib);
            const lib = loadLib(nomLib) || {};
            for (const [nom, valeur] of Object.entries(lib)) {
              if (nom.startsWith("_") || !valeur || typeof valeur !== "object" || Array.isArray(valeur)) continue;
              if (reserves.has(nom)) continue;
              prototypesDeclares.add(nom);
            }
            for (const a of Array.isArray(lib.apporte) ? lib.apporte : []) apporterLesPrototypesDe(a);
          };
          apporterLesPrototypesDe(dir.name);
        }
      } else if (atProductionBlock()) {
        for (const d of parseProductionBlock()) scene.directives.push(d);
      } else {
        scene.backticks.push(parseBacktickOrphan());
      }
      premiereLigne = false;
      skipNewlines();
    }
    libCtx = loadLibsFromDirectives(scene.directives);
    scene.homomorphisms = buildHomomorphisms(libCtx.transcriptions, scene.directives);
    libCtx.actors = {};
    for (const actor of scene.actors) {
      libCtx.actors[actor.name] = actor.properties;
    }
    libCtx.sceneNames = /* @__PURE__ */ new Set();
    for (const sc of scene.scenes) {
      libCtx.sceneNames.add(sc.name);
      libCtx.symbols[sc.name] = { type: "scene" };
    }
    enDeclaratif = false;
    scene.subgrammars = parseSubgrammars(initialMode, initialModifiers);
    skipNewlines();
    scene.template = null;
    if (at(T.IDENT) && current().value === "template") {
      const entries = parseTemplateSection();
      scene.template = { destinataire: "bpscript", entrees: entries };
    }
    deplierLesCommodites(scene);
    annotateScene(scene);
    if (scene.libRefs) {
      const seen = /* @__PURE__ */ new Set();
      scene.libRefs = scene.libRefs.filter((a) => seen.has(a) ? false : (seen.add(a), true));
    }
    return scene;
  }
  function deplierLesCommodites(scene) {
    const formes = /* @__PURE__ */ new Map();
    for (const d of scene.defs || []) {
      if (!d || d.type !== "DefDirective") continue;
      if (d.kind === "structure" || d.kind === "transformation") {
        formes.set(d.name, d);
      }
    }
    for (const v of scene.vars || []) {
      if (!v || v.varType?.kind !== "type" || v.varType.type !== null || !v.settings) continue;
      for (const n of v.names || []) formes.set(n, { kind: "prereglage", name: n, settings: v.settings, line: v.line });
    }
    if (!formes.size) return;
    const membresDroits = [];
    for (const sg of scene.subgrammars || []) {
      for (const rule of sg.rules || []) if (rule && rule.rhs) membresDroits.push(rule.rhs);
    }
    for (let tour = 32; ; tour--) {
      if (!remplacerDans(membresDroits, formes, tour)) break;
    }
  }
  function remplacerDans(n, formes, reste) {
    if (!n || typeof n !== "object") return false;
    if (Array.isArray(n)) {
      let bouge2 = false;
      for (let i = 0; i < n.length; i++) {
        const el = n[i];
        const sortie = el && typeof el === "object" && el.name ? corpsPour(el, formes) : null;
        if (sortie) {
          if (!reste) {
            throw new ParseError(
              `'${el.name}' se d\xE9plie sans fin \u2014 une d\xE9finition finit par se r\xE9invoquer elle-m\xEAme. Une forme qui se contient ne se d\xE9plie pas.`,
              jetonDe(el)
            );
          }
          n.splice(i, 1, ...sortie);
          i += sortie.length - 1;
          bouge2 = true;
        } else if (remplacerDans(el, formes, reste)) bouge2 = true;
      }
      return bouge2;
    }
    let bouge = false;
    for (const v of Object.values(n)) if (remplacerDans(v, formes, reste)) bouge = true;
    return bouge;
  }
  const jetonDe = (el) => ({ line: el?.line ?? 0, col: el?.col ?? 0 });
  const copieProfonde = (n) => JSON.parse(JSON.stringify(n));
  function corpsPour(el, formes) {
    const def = formes.get(el.name);
    if (!def) return null;
    if (el.type === "SymbolCall") {
      if (def.kind !== "transformation") {
        throw new ParseError(
          `'${el.name}' est ${def.kind === "prereglage" ? "un pr\xE9r\xE9glage" : "une structure"} : il se pose NU, sans arguments. \xC9crire '${el.name}'. Une liste de param\xE8tres se d\xE9clare avec le nom ('def ${el.name}(x) \u2026'), et alors seulement l'appel en porte.`,
          jetonDe(el)
        );
      }
      return corpsSubstitue(def, el);
    }
    if (el.type !== "Symbol") return null;
    if (def.kind === "transformation") {
      throw new ParseError(
        `'${el.name}' est une transformation sur ${def.params.join(", ")} : elle s'appelle avec ses arguments. \xC9crire '${el.name}(${def.params.map(() => "\u2026").join(", ")})'. Pos\xE9 nu, le nom sortirait de l'arbre en terminal et sonnerait.`,
        jetonDe(el)
      );
    }
    if (def.kind === "prereglage") {
      return [{
        type: "InstantControl",
        qualifier: copieProfonde(def.settings),
        conjoint: false,
        line: el.line
      }];
    }
    return copieProfonde(def.body);
  }
  function corpsSubstitue(def, appel) {
    const args = appel.args || [];
    const nommes = args.filter((a) => a && a.key != null);
    if (nommes.length) {
      throw new ParseError(
        `'${def.name}(\u2026)' : un argument de transformation se donne par POSITION, jamais par nom \u2014 re\xE7u '${nommes[0].key}:'. \xC9crire '${def.name}(${def.params.map(() => "\u2026").join(", ")})', les param\xE8tres dans l'ordre de la d\xE9finition (${def.params.join(", ")}).`,
        jetonDe(appel)
      );
    }
    if (args.length !== def.params.length) {
      throw new ParseError(
        `'${def.name}' se d\xE9finit sur ${def.params.length} param\xE8tre(s) (${def.params.join(", ")}) et s'appelle ici avec ${args.length} argument(s). Une transformation appel\xE9e de travers laisserait un param\xE8tre non substitu\xE9 dans l'arbre, sous la forme d'un terminal qui sonnerait.`,
        jetonDe(appel)
      );
    }
    const valeurs = /* @__PURE__ */ new Map();
    def.params.forEach((p, i) => {
      const v = args[i]?.value;
      if (!v || v.type !== "Literal" || typeof v.value !== "string" && typeof v.value !== "number") {
        throw new ParseError(
          `'${def.name}(\u2026)' : l'argument '${p}' n'est pas un terme. Un argument de transformation est un NOM (un terminal, une t\xEAte de r\xE8gle), \xE9crit nu.`,
          jetonDe(appel)
        );
      }
      valeurs.set(p, String(v.value));
    });
    const substituer = (n) => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) {
        n.forEach(substituer);
        return;
      }
      if (n.type === "Symbol" && valeurs.has(n.name)) {
        const brut = valeurs.get(n.name);
        const point = brut.indexOf(".");
        if (point > 0) {
          n.actor = brut.slice(0, point);
          n.name = brut.slice(point + 1);
        } else n.name = brut;
      }
      for (const v of Object.values(n)) substituer(v);
    };
    const corps = copieProfonde(def.body);
    substituer(corps);
    return corps;
  }
  function annotateScene(scene) {
    const flagStates = {};
    for (const v of scene.vars || []) {
      if (v?.varType?.kind === "flag") {
        const mm = flagStates[v.names[0]] || {};
        for (const s of v.varType.states) mm[s.name] = s.value;
        flagStates[v.names[0]] = mm;
      }
    }
    const criFlags = [];
    const resolveFlag = (flag, value, ou) => {
      if (!Object.prototype.hasOwnProperty.call(flagStates, flag)) {
        criFlags.push(
          `${ou} '[${flag}\u2026]' : le drapeau '${flag}' n'est pas d\xE9clar\xE9. Un drapeau porte sa valeur initiale \u2014 'flag ${flag}:0' \u2014 avant le d\xE9limiteur. Sans elle, une r\xE8gle qui s'y conditionne ne se d\xE9clenche jamais, et rien ne le dit.`
        );
        return value;
      }
      if (typeof value !== "string") return value;
      const etats = flagStates[flag];
      if (etats && Object.prototype.hasOwnProperty.call(etats, value)) return etats[value];
      if (Object.prototype.hasOwnProperty.call(flagStates, value)) return value;
      criFlags.push(
        `${ou} '[${flag}${ou === "mutation" ? "=" : "=="}${value}]' : '${value}' n'est pas le nom d'un drapeau d\xE9clar\xE9. Un drapeau se compare \xE0 un ENTIER \u2014 '[${flag}==<entier>]' \u2014 ou au nom d'un autre drapeau, qui doit alors \xEAtre d\xE9clar\xE9 lui aussi : 'flag ${value}:<entier>'.`
      );
      return value;
    };
    for (const sg of scene.subgrammars) {
      for (const rule of sg.rules) {
        const guards = Array.isArray(rule.guard) ? rule.guard : rule.guard ? [rule.guard] : [];
        for (const g of guards) {
          if (g && g.flag != null && "value" in g) g.value = resolveFlag(g.flag, g.value, "garde");
        }
        for (const f of rule.flags || []) {
          if (f && f.flag != null && "value" in f) f.value = resolveFlag(f.flag, f.value, "mutation");
        }
        annotateRhsElements(rule.rhs, null);
        if (rule.settings && typeof rule.settings === "object") {
          const { address, controls } = splitAddress(extractOccurrenceParams([rule.settings]));
          rule.settings.payload = {
            nature: "transport-control",
            containment: true,
            scope: "rule",
            ...controls ? { params: controls } : {},
            ...address ? { address } : {}
          };
        }
      }
    }
    if (criFlags.length) {
      throw new ParseError(
        criFlags.length === 1 ? criFlags[0] : `${criFlags.length} usages de drapeau ne d\xE9signent rien :
  \xB7 ${criFlags.join("\n  \xB7 ")}`,
        { line: 0, col: 0 }
      );
    }
  }
  function annotateRhsElements(elements, ruleActor) {
    let prevSounding = false;
    for (const el of elements) {
      if (el && el.type === "InstantControl" && el.conjoint && !prevSounding) {
        el.conjoint = false;
      }
      annotateRhsNode(el, ruleActor);
      if (el && (el.type === "Symbol" || el.type === "SymbolCall" || el.type === "OutTimeObject" || el.type === "TieStart" || el.type === "TieContinue" || el.type === "TieEnd" || el.type === "SimultaneousGroup" || el.type === "Polymetric")) {
        prevSounding = true;
      }
    }
  }
  function annotateRhsNode(el, ruleActor) {
    if (!el || typeof el !== "object") return;
    const type = el.type;
    if (type === "Symbol" || type === "SymbolCall" || type === "OutTimeObject" || type === "TieStart" || type === "TieContinue" || type === "TieEnd") {
      const actor = el.actor || ruleActor || void 0;
      let params = extractOccurrenceParams(el.suffixQualifiers);
      for (const sq of el.suffixQualifiers || []) {
        if (!sq || sq.type !== "SettingBag") continue;
        const { address: adrSq, controls: ctrlSq } = splitAddress(extractOccurrenceParams([sq]));
        sq.payload = {
          nature: "transport-control",
          containment: true,
          scope: "symbol",
          ...ctrlSq ? { params: ctrlSq } : {},
          ...adrSq ? { address: adrSq } : {}
        };
      }
      const argParams = extractSymbolCallParams(el);
      if (argParams !== null) params = { ...params || {}, ...argParams };
      const { address, controls } = splitAddress(params);
      const nomPorte = typeof el.symbol === "string" ? el.symbol : el.name;
      const estVariable = nomsVariables.has(nomPorte);
      el.payload = {
        nature: estVariable ? "var" : "sounding",
        ...actor !== void 0 ? { actor } : {},
        ...controls !== null ? { params: controls } : {},
        ...address !== null ? { address } : {},
        ...controls !== null || address !== null ? { occurrence: true } : {}
        // flux absent (override d'occurrence, pas de propagation)
      };
      return;
    }
    if (type === "Wait") {
      el.payload = { nature: "wait" };
      return;
    }
    if (type === "SymbolWithWait" && el.symbol) {
      annotateRhsNode(el.symbol, ruleActor);
      for (const t of el.triggers || []) annotateRhsNode(t, ruleActor);
      return;
    }
    if (type === "Rest" || type === "UndeterminedRest" || type === "NumericTerminal" || type === "NumericDuration") {
      el.payload = { nature: "rest" };
      return;
    }
    if (type === "Prolongation") {
      el.payload = { nature: "prolongation" };
      return;
    }
    if (type === "Control") {
      const isEngine = libCtx.bp3NativeControls && libCtx.bp3NativeControls.has(el.name);
      const nature = isEngine ? "engine-control" : "transport-control";
      el.payload = {
        nature,
        // flux:true pour un transport-control standalone (propagation de flux)
        ...nature === "transport-control" ? { flux: true } : {}
      };
      return;
    }
    if (type === "InstantControl") {
      if (el.qualifier && el.qualifier.type === "SettingBag") {
        const { address: adrF, controls: ctrlF } = splitAddress(extractOccurrenceParams([el.qualifier]));
        el.qualifier.payload = {
          nature: "transport-control",
          containment: false,
          scope: "flow",
          ...ctrlF ? { params: ctrlF } : {},
          ...adrF ? { address: adrF } : {}
        };
      }
      el.payload = {
        nature: "instant",
        flux: true,
        // se propage aux tokens suivants du même acteur
        // conjoint (collé `C4!(...)`) = ancré au terminal précédent, voyage avec lui (régime
        // structurel) ; non conjoint (espacé `C4 !(...)`) = événement séparé (régime séquentiel).
        // Présent seulement pour les `!(...)` runtime (qui portent ce flag) ; absent sinon.
        ...el.conjoint !== void 0 ? { conjoint: el.conjoint } : {}
      };
      return;
    }
    if (type === "Polymetric") {
      if (el.settings && typeof el.settings === "object") {
        const { address, controls } = splitAddress(extractOccurrenceParams([el.settings]));
        el.settings.payload = {
          nature: "transport-control",
          containment: true,
          scope: "group",
          ...controls ? { params: controls } : {},
          ...address ? { address } : {}
        };
      }
      for (const voice of el.voices || []) {
        annotateRhsElements(voice, ruleActor);
      }
      return;
    }
    if (type === "SimultaneousGroup") {
      if (el.primary) annotateRhsNode(el.primary, ruleActor);
      for (const s of el.secondaries || []) annotateRhsNode(s, ruleActor);
      return;
    }
    if (type === "TemplateMaster" || type === "TemplateSlave") {
      for (const sq of el.suffixQualifiers || []) {
        if (!sq || sq.type !== "SettingBag") continue;
        const { address, controls } = splitAddress(extractOccurrenceParams([sq]));
        sq.payload = {
          nature: "transport-control",
          containment: true,
          scope: "template",
          ...controls ? { params: controls } : {},
          ...address ? { address } : {}
        };
      }
      return;
    }
    if (type === "RawBrace" && el.settings && typeof el.settings === "object") {
      const { address, controls } = splitAddress(extractOccurrenceParams([el.settings]));
      el.settings.payload = {
        nature: "transport-control",
        containment: true,
        scope: "group",
        ...controls ? { params: controls } : {},
        ...address ? { address } : {}
      };
      return;
    }
  }
  function extractOccurrenceParams(suffixQualifiers) {
    if (!suffixQualifiers || suffixQualifiers.length === 0) return null;
    const params = {};
    let hasParams = false;
    for (const sq of suffixQualifiers) {
      if (sq.type !== "SettingBag") continue;
      for (const pair of sq.pairs || []) {
        params[pair.key] = pair.value;
        hasParams = true;
      }
    }
    return hasParams ? params : null;
  }
  function extractSymbolCallParams(el) {
    if (!el || el.type !== "SymbolCall" || !Array.isArray(el.args)) return null;
    const params = {};
    let hasParams = false;
    for (const arg of el.args) {
      if (!arg || !arg.key) continue;
      const v = arg.value;
      params[arg.key] = v && v.type === "Literal" ? v.value : v;
      hasParams = true;
    }
    return hasParams ? params : null;
  }
  function splitAddress(params) {
    if (!params) return { address: null, controls: null };
    const address = {};
    const controls = {};
    let hasA = false;
    let hasC = false;
    for (const [k, v] of Object.entries(params)) {
      if (addressKeys().has(k)) {
        address[k] = v;
        hasA = true;
      } else {
        controls[k] = v;
        hasC = true;
      }
    }
    return { address: hasA ? address : null, controls: hasC ? controls : null };
  }
  function lireNomATiretBas() {
    if (!at(T.PROLONG)) return null;
    const suite = peek(1);
    if (!suite || suite.type !== T.IDENT || suite.spaceBefore) return null;
    advance();
    return "_" + advance().value;
  }
  function parseDirectiveColonValue(dirName) {
    let value = null, runtime = null;
    if (dirName && universeIntervalControls().has(dirName)) {
      return { value: readIntervalLiteral(dirName), runtime: null };
    }
    let negative = false;
    if (at(T.REST)) {
      negative = true;
      advance();
    }
    if (at(T.INT)) {
      const num = advance().value;
      if (at(T.PLUS) && peek(1).type === T.INT) {
        let sections = `${negative ? "-" : ""}${num}`;
        while (at(T.PLUS) && peek(1).type === T.INT) {
          sections += advance().value;
          sections += advance().value;
        }
        if (at(T.SLASH) && peek(1).type === T.INT) {
          sections += advance().value;
          sections += advance().value;
        }
        return { value: sections, runtime: null };
      }
      if (at(T.SLASH) && peek(1).type === T.INT) {
        advance();
        const denom = advance().value;
        value = `${negative ? "-" : ""}${num}/${denom}`;
      } else {
        value = Number(`${negative ? "-" : ""}${num}`);
      }
    } else if (at(T.FLOAT)) {
      const raw = advance().value;
      value = raw;
    } else if (at(T.IDENT) || at(T.PROLONG) && peek(1)?.type === T.IDENT && !peek(1).spaceBefore) {
      const v = lireNomATiretBas() ?? advance().value;
      if (at(T.SLASH) && peek(1).type === T.INT) {
        advance();
        const denom = advance().value;
        value = `${v}/${denom}`;
      } else {
        runtime = v;
      }
    }
    if (!atEnd() && !current().spaceBefore && (at(T.IDENT) || at(T.INT) || at(T.FLOAT))) {
      const reste = current().value;
      const ecrit = value != null ? String(value) : runtime != null ? String(runtime) : "";
      throw new ParseError(
        `la valeur de '${dirName}' se lit '${ecrit}', et '${reste}' lui reste coll\xE9 sans s'y lire. Une valeur de directive est NUE : un nombre, un rapport ('3/4'), ou un nom. Retirer '${reste}' si c'est une unit\xE9 \u2014 aucune directive n'en porte \u2014 ou l'espacer si ce qui suit est autre chose.`,
        current()
      );
    }
    return { value, runtime };
  }
  function atProductionBlock() {
    return at(T.LBRACKET) && peek(1).type === T.AT;
  }
  function parseProductionBlock(dansLeFlux = false) {
    expect(T.LBRACKET);
    const dirs = [];
    while (true) {
      const atTok = expect(T.AT);
      const name = expect(T.IDENT).value;
      let value = null, runtime = null;
      if (at(T.COLON)) {
        advance();
        ({ value, runtime } = parseDirectiveColonValue(name));
      }
      if (!dansLeFlux) {
        const ecrit = value !== null && value !== void 0 ? `:${value}` : runtime ? `:${runtime}` : "";
        throw new ParseError(
          `'[${name}${ecrit}]' : une directive de production s'\xE9crit en t\xEAte de sc\xE8ne, avant le d\xE9limiteur \u2014 '${name}${ecrit}'. Un bloc qui groupait plusieurs cl\xE9s se r\xE9\xE9crit en autant de lignes. Le crochet porte ce qui appartient \xE0 la D\xC9RIVATION : un drapeau, une proc\xE9dure, un rang.`,
          atTok
        );
      }
      if (name !== "seed") {
        throw new ParseError(
          `'![${name}\u2026]' : seul 'seed' a un sens dans le flux (re-semence _srand) ; '${name}' se pose en t\xEAte de sc\xE8ne, '${name}'.`,
          atTok
        );
      }
      dirs.push({
        type: "Directive",
        name,
        subkey: null,
        runtime,
        value,
        aliases: null,
        modifiers: null,
        line: atTok.line
      });
      if (at(T.COMMA)) {
        advance();
        continue;
      }
      break;
    }
    expect(T.RBRACKET);
    return dirs;
  }
  function lireDeclarationDeTerminal() {
    if (!at(T.IDENT) || peek(1).type !== T.COLON || peek(2).type !== T.IDENT) return null;
    const finDeLigne = peek(3).type === T.NEWLINE || peek(3).type === T.EOF || peek(3).type === T.COMMENT;
    if (!finDeLigne) return null;
    const tok = current();
    const nom = tok.value;
    const canal = peek(2).value;
    if (!outChannels().has(canal) || !writableChannels().has(canal)) return null;
    if (porteesDeclarees(nom) !== null || directiveDeclareeParLaLibrairie("core", nom)) return null;
    advance();
    advance();
    advance();
    return { type: "Declaration", name: nom, runtime: canal, line: tok.line };
  }
  function lireDeclarationParLeType() {
    if (!at(T.IDENT)) return null;
    const tok = current();
    const mot = tok.value;
    if (mot === "in" && peek(1).type === T.IDENT && !directiveDeclareeParLaLibrairie("core", "in")) {
      throw new ParseError(`'in ${peek(1).value}' est refus\xE9 \u2014 une entr\xE9e d\xE9clare son CANAL : 'in.<canal> ${peek(1).value}'. Les canaux d'entr\xE9e sont ${[...inChannels()].join(", ")}. Sans lui, aucun runtime n'est adress\xE9 et rien ne d\xE9clenche.`, tok);
    }
    if (mot === "in" && peek(1).type === T.PERIOD && !peek(1).spaceBefore && peek(2).type === T.IDENT) {
      advance();
      advance();
      const canal = expect(T.IDENT).value;
      if (at(T.LPAREN)) {
        throw new ParseError(`'in.${canal}(\u2026)' est refus\xE9 \u2014 une entr\xE9e ne porte AUCUN nom de port. Un nom de port vient du syst\xE8me et change de machine en machine ; la sc\xE8ne nomme un R\xD4LE, l'utilisateur associe l'appareil, et l'association vit hors de la sc\xE8ne.`, tok);
      }
      if (!inChannels().has(canal)) {
        throw new ParseError(`'${canal}' n'est pas une entr\xE9e \u2014 les canaux d'entr\xE9e sont ${[...inChannels()].join(", ")}. La liste est FERM\xC9E.`, tok);
      }
      if (!at(T.IDENT)) {
        throw new ParseError(`'in.${canal}' doit nommer le R\xD4LE que tient l'entr\xE9e \u2014 'in.${canal} <r\xF4le>'. Le type vient en t\xEAte, le nom ensuite.`, current());
      }
      const roleName = advance().value;
      let table = null;
      while (at(T.IDENT)) {
        const cle = advance().value;
        if (!at(T.PERIOD)) {
          throw new ParseError(`in.${canal} ${roleName} : '${cle}' doit APPELER un composant avec un point ('mapping.<table>') \u2014 le point APPELLE, les deux points AFFECTENT.`, tok);
        }
        advance();
        const valeur = expect(T.IDENT).value;
        if (cle === "mapping") {
          table = valeur;
        } else if (cle === "alphabet") {
          throw new ParseError(`in.${canal} ${roleName} : une entr\xE9e ne porte AUCUN alphabet. Il n'y a rien \xE0 r\xE9soudre en entr\xE9e \u2014 l'\xE9v\xE9nement est DISCRET, pas un signal \xE0 interpr\xE9ter. C'est la TABLE (mapping.<nom>) qui d\xE9clare le vocabulaire o\xF9 les \xE9tiquettes puisent, et elle le fait en librairie, pas dans la sc\xE8ne.`, tok);
        } else {
          throw new ParseError(`in.${canal} ${roleName} : propri\xE9t\xE9 '${cle}' inconnue \u2014 une entr\xE9e d\xE9clare son canal et, facultativement, sa table ('mapping.<table>'). Rien d'autre.`, tok);
        }
      }
      return { type: "InDirective", name: roleName, transport: canal, mapping: table, line: tok.line };
    }
    if (mot === "object" && ouvreUnNom(1)) {
      throw new ParseError(
        `'object ${peek(1).value}' : 'object' est SORTI du langage \u2014 la racine d'une famille se d\xE9clare par 'def ${peek(1).value} (\u2026)', et un exemplaire par son type en t\xEAte ('${peek(1).value} <nom> (\u2026)'). Un seul mot d\xE9clare : 'def'.`,
        tok
      );
    }
    if (mot === "actor" && ouvreUnNom(1)) {
      if (!prototypesDeclares.has("actor")) {
        throw new ParseError(`'actor ${peek(1).value}' : 'actor' n'est pas un type en port\xE9e. Il est un objet de 'types' \u2014 invoquer 'types', 'core', ou une librairie qui invoque 'types'.`, tok);
      }
      return null;
    }
    if (!varConventions().has(mot) && !prototypesDeclares.has(mot)) {
      const apresLeNom = peek(2).type;
      const formeDeDeclaration = apresLeNom === T.NEWLINE || apresLeNom === T.EOF || apresLeNom === T.COMMENT || apresLeNom === T.COLON && !peek(2).spaceBefore;
      if (peek(1).type === T.IDENT && formeDeDeclaration && !directiveDeclareeParLaLibrairie("core", mot) && porteesDeclarees(mot) === null) {
        throw new ParseError(`'${mot} ${peek(1).value}' : '${mot}' n'est pas un type en port\xE9e. Un type en t\xEAte vient des conventions (${[...varConventions()].join(", ")}), de in.<canal>, ou d'un objet en port\xE9e \u2014 d\xE9clar\xE9 par la sc\xE8ne, ou apport\xE9 par une librairie invoqu\xE9e en t\xEAte (le socle vit dans 'types').`, tok);
      }
      return null;
    }
    if (!ouvreUnNom(1)) {
      if (peek(1).type === T.NEWLINE || peek(1).type === T.EOF) {
        if (loadLib(mot) || catalogAxisKeys().has(mot)) return null;
        throw new ParseError(`'${mot}' doit nommer ce qu'il d\xE9clare \u2014 le type vient en t\xEAte, le nom ensuite ('${mot} <nom>').`, tok);
      }
      return null;
    }
    advance();
    const premier = lireNomDEntree(tok);
    if (mot === "flag") {
      if (!at(T.COLON)) {
        throw new ParseError(
          `flag ${premier} : un drapeau porte sa valeur initiale \u2014 'flag ${premier}:<entier>'. C'est la seule forme : ni le nom seul, ni des \xE9tats nomm\xE9s entre parenth\xE8ses. Un drapeau compte et se compare \xE0 des entiers.`,
          current()
        );
      }
      advance();
      if (!at(T.INT)) {
        throw new ParseError(
          `flag ${premier} : la valeur initiale est un ENTIER \u2014 'flag ${premier}:<entier>'. Un drapeau compte et se compare \xE0 des entiers.`,
          current()
        );
      }
      const initiale = Number(advance().value);
      return {
        type: "VarDirective",
        names: [premier],
        varType: { kind: "flag", states: [], initiale },
        line: tok.line
      };
    }
    if (prototypesDeclares.has(mot) && at(T.LPAREN)) {
      const sac = parseRuntimeQualifier();
      return {
        type: "VarDirective",
        names: [premier],
        varType: { kind: "type", type: mot },
        settings: sac,
        line: tok.line
      };
    }
    const lireDepart = (nom) => {
      if (!at(T.COLON)) return null;
      advance();
      const t = current();
      if (t.spaceBefore) {
        throw new ParseError(`${mot} ${nom}: une valeur de d\xE9part se COLLE \xE0 son signe \u2014 '${nom}:<valeur>', jamais '${nom}: <valeur>'. L'espace s\xE9pare deux termes, le collage les r\xE9unit.`, t);
      }
      if (at(T.INT) || at(T.FLOAT)) {
        advance();
        return Number(t.value);
      }
      if (at(T.IDENT)) {
        advance();
        return t.value;
      }
      const aTiretBas = lireNomATiretBas();
      if (aTiretBas !== null) return aTiretBas;
      throw new ParseError(`${mot} ${nom} : une valeur de d\xE9part se pose apr\xE8s ':' \u2014 un nombre ou un nom. Re\xE7u '${t.value ?? t.type}'.`, t);
    };
    const departs = [];
    const d0 = lireDepart(premier);
    if (d0 !== null) departs.push({ name: premier, value: d0 });
    if (varConventions().has(mot)) {
      const varType = { kind: "convention", convention: mot };
      const d = { type: "VarDirective", names: [premier], varType, line: tok.line };
      return departs.length ? { ...d, initial: departs } : d;
    }
    const noms = [premier];
    while (at(T.COMMA) && advance()) {
      const n = lireNomDEntree(tok);
      noms.push(n);
      const dn = lireDepart(n);
      if (dn !== null) departs.push({ name: n, value: dn });
    }
    const type = prototypesDeclares.has(mot) ? { kind: "type", type: mot } : null;
    const nu = { type: "VarDirective", names: noms, varType: type, line: tok.line };
    return departs.length ? { ...nu, initial: departs } : nu;
  }
  function parseDirective() {
    {
      const parLeType = lireDeclarationParLeType();
      if (parLeType) return parLeType;
      const unTerminal = lireDeclarationDeTerminal();
      if (unTerminal) return unTerminal;
    }
    const tok = current();
    if (at(T.AT)) {
      const apres = peek(1);
      throw new ParseError(
        `l'arobase est SORTIE du langage (decision Romain, hub/decisions/2026-08-17-factory-et-mine-sortent-du-langage.md) \u2014 ecrire '${apres && apres.value ? apres.value : "<directive>"}' sans elle. Ce qui qualifie une ligne est sa POSITION : avant le '-----' elle declare, apres elle produit.`,
        tok
      );
    }
    let name, subkey = null, directiveParams = null;
    if (at(T.PLUS)) {
      advance();
      name = "+";
    } else {
      name = lireNomDEntree(tok);
    }
    if (at(T.PERIOD)) {
      advance();
      subkey = lireNomDEntree(tok);
    }
    if (subkey && directiveDeclareeParLaLibrairie(name, subkey)) {
      name = subkey;
      subkey = null;
    }
    if (subkey && at(T.LPAREN) && !current().spaceBefore && actorKeysData().valides.has(name)) {
      advance();
      directiveParams = {};
      while (!at(T.RPAREN) && !atEnd()) {
        const pk = expect(T.IDENT).value;
        expect(T.COLON);
        directiveParams[pk] = at(T.INT) || at(T.FLOAT) ? Number(advance().value) : advance().value;
        if (at(T.COMMA)) advance();
      }
      expect(T.RPAREN);
    }
    let runtime = null, value = null, aliases = null;
    function autresNomsDeLaDirective(directive) {
      const noms = [];
      for (let j = pos; j < tokens.length - 1; j++) {
        if (tokens[j].type !== T.AT) continue;
        if (tokens[j + 1] && tokens[j + 1].value === directive && tokens[j + 2] && tokens[j + 2].type === T.IDENT) {
          noms.push(tokens[j + 2].value);
        }
      }
      return noms;
    }
    function refuserLeSigneEgal(directive, nom) {
      if (!at(T.EQUALS)) return;
      throw new ParseError(
        `${directive} ${nom} : le signe '=' est SUPPRIME de tout le langage (decision Romain 2026-07-27) \u2014 ecrire '${directive} ${nom} <valeur>' sans rien entre les deux.`,
        current()
      );
    }
    if (name === "def" || name === "terminal") {
      const motDeclarant = name;
      if (!ouvreUnNom()) {
        throw new ParseError(
          `'${motDeclarant}' doit nommer ce qu'il d\xE9finit : '${motDeclarant} <nom> <corps>'. Le nom vient d'abord, ce qu'il vaut ensuite \u2014 comme 'actor'. UN NOM COMMENCE PAR UNE LETTRE, ou par un chiffre s'il porte au moins une lettre : 'western', 'a_b', '12TET' en sont ; '12', '_ab', '#a', '-ab' et '"ab"' n'en sont pas. Re\xE7u : ${JSON.stringify(String(current().value ?? current().type))}.`,
          tok
        );
      }
      const defName = lireNomDEntree(tok);
      const apresLeNom = current();
      const clesParenthesees = motDeclarant === "terminal" && at(T.LPAREN);
      if (clesParenthesees) advance();
      refuserLeSigneEgal("def", defName);
      const cles = {};
      let lu = 0;
      const lireUneCle = (dansUnBloc = false) => {
        const kTok = current();
        const cle = expect(T.IDENT).value;
        if (at(T.PERIOD) && !current().spaceBefore) {
          advance();
          if (!at(T.IDENT)) throw new ParseError(`'def ${defName}' : nom attendu apr\xE8s '${cle}.'`, current());
          let val = String(advance().value);
          while ((at(T.IDENT) || at(T.INT)) && !current().spaceBefore) val += String(advance().value);
          if (at(T.PERIOD) && !current().spaceBefore) {
            const suite = peek(1);
            const interne = suite && suite.value != null ? String(suite.value) : null;
            throw new ParseError(
              `'${cle}.${val}${interne ? `.${interne}` : ""}\u2026' adresse un catalogue par DEUX niveaux \u2014 un seul s'\xE9crit. Le point appelle une ENTR\xC9E, jamais la structure qui la range : \xE9crire '${cle}.${interne ?? "<entr\xE9e>"}' si '${interne ?? "\u2026"}' est l'entr\xE9e voulue, ou '${cle}.${val}' si c'est '${val}'.`,
              kTok
            );
          }
          cles[cle] = { kind: "ref", value: val };
          lu++;
          return;
        }
        if (at(T.COLON) && !current().spaceBefore) {
          advance();
          if (atEnd() || at(T.NEWLINE)) throw new ParseError(`'def ${defName}' : valeur attendue apr\xE8s '${cle}:'`, current());
          const ouvreUneCle = () => at(T.IDENT) && current().spaceBefore && (!dansUnBloc || peek(1).type === T.COLON || peek(1).type === T.PERIOD);
          const borneDuCorps = () => clesParenthesees && (at(T.RPAREN) || at(T.COMMA));
          const PARTIE = /* @__PURE__ */ new Set([
            T.IDENT,
            T.INT,
            T.FLOAT,
            T.STRING,
            T.SLASH,
            T.PERIOD,
            T.REST,
            T.PROLONG,
            T.HASH,
            T.PLUS,
            T.BACKTICK
          ]);
          const parties = [];
          let courante = "";
          while (!atEnd() && !at(T.NEWLINE) && !at(T.COMMENT) && !ouvreUneCle() && !borneDuCorps()) {
            if (current().type === T.BACKTICK && (parties.length || courante !== "")) {
              throw new ParseError(
                `'def ${defName}' : du code typ\xE9 ne peut pas suivre une autre partie dans la valeur de '${cle}'. Le code typ\xE9 EST la valeur \u2014 \xE9cris-le seul apr\xE8s le deux-points.`,
                current()
              );
            }
            if (!PARTIE.has(current().type)) {
              throw new ParseError(
                `'def ${defName}' : '${current().value ?? current().type}' n'est pas lisible dans la valeur de '${cle}'. Une valeur est faite de MOTS \u2014 un nom, un nombre, un texte entre guillemets, un rapport \u2014 et l'espace en s\xE9pare les parties. Ce signe ouvre une structure, et une structure ne se pose pas dans une valeur : \xE9cris-la dans le corps entre parenth\xE8ses de la d\xE9claration.`,
                current()
              );
            }
            if (courante !== "" && current().spaceBefore) {
              parties.push(courante);
              courante = "";
            }
            courante += String(advance().value);
          }
          if (courante !== "") parties.push(courante);
          cles[cle] = { kind: "value", value: parties.length === 1 ? parties[0] : parties };
          lu++;
          return;
        }
        throw new ParseError(
          `'def ${defName}' : '${cle}' n'est ni un appel de composant ni une affectation. Une cl\xE9 de terminal s'\xE9crit '${cle}.<nom>' pour appeler un composant, ou '${cle}:<valeur>' pour affecter une valeur \u2014 le point appelle, le deux-points affecte.`,
          kTok
        );
      };
      if (at(T.BACKTICK)) {
        const bt = current();
        const brut = expect(T.BACKTICK).value;
        const { tag, code } = splitBacktickTag(brut);
        return {
          type: "DefDirective",
          name: defName,
          kind: "code",
          convention: null,
          tag,
          code,
          line: tok.line
        };
      }
      if (at(T.IDENT) && varConventions().has(current().value) && peek(1) && peek(1).type === T.BACKTICK) {
        const convention = advance().value;
        const bt = current();
        const brut = expect(T.BACKTICK).value;
        const { tag, code } = splitBacktickTag(brut);
        return {
          type: "DefDirective",
          name: defName,
          kind: "code",
          convention,
          tag,
          code,
          line: tok.line
        };
      }
      if (at(T.LPAREN) && !current().spaceBefore) {
        advance();
        const params = [];
        while (!at(T.RPAREN) && !atEnd()) {
          while (at(T.NEWLINE) || at(T.COMMENT)) advance();
          if (at(T.RPAREN) || atEnd()) break;
          if (at(T.IDENT)) params.push(advance().value);
          else if (at(T.COMMA)) advance();
          else {
            throw new ParseError(
              `'def ${defName}(\u2026)' : la liste de parametres ne porte que des NOMS, separes par des virgules \u2014 recu '${current().value}'.`,
              current()
            );
          }
        }
        expect(T.RPAREN);
        if (params.length === 0) {
          throw new ParseError(
            `'def ${defName}()' : une liste de parametres VIDE ne parametre rien. Ecrire 'def ${defName} <corps>' sans parenthese collee, ou nommer au moins un parametre.`,
            tok
          );
        }
        const corps = parseRhsElements();
        if (corps.length === 0) {
          throw new ParseError(
            `'def ${defName}(${params.join(", ")})' : transformation sans corps. Ce que la definition FAIT de ses parametres s ecrit apres eux.`,
            tok
          );
        }
        return {
          type: "DefDirective",
          name: defName,
          kind: "transformation",
          params,
          body: corps,
          line: tok.line
        };
      }
      if (at(T.LPAREN)) {
        const sac = parseRuntimeQualifier();
        return {
          type: "VarDirective",
          names: [defName],
          varType: { kind: "type", type: null },
          settings: sac,
          line: tok.line
        };
      }
      const cleEnTete = () => {
        if (!at(T.IDENT)) return false;
        const apres = peek(1);
        return !!apres && (apres.type === T.PERIOD || apres.type === T.COLON) && !apres.spaceBefore;
      };
      if (motDeclarant === "terminal" && at(T.IDENT) && !cleEnTete()) {
        throw new ParseError(
          `'terminal ${defName}' : un terminal se d\xE9clare par ses CL\xC9S \u2014 'voice.<nom>', 'hz:<n>', 'degree:<n>', 'register:<n>', 'sounding:<vrai|faux>', 'duration:<n>', 'tuning.<nom>', 'octaves.<nom>'. Une suite de termes est une STRUCTURE, et elle s'\xE9crit 'def ${defName} <termes>'.`,
          current()
        );
      }
      if (at(T.IDENT) && !cleEnTete()) {
        const corps = parseRhsElements();
        if (corps.length === 0) {
          throw new ParseError(
            `'def ${defName}' : structure vide. Un nom qui ne vaut rien ne se r\xE9invoque pas.`,
            tok
          );
        }
        const backtick = corps.find((e) => e && typeof e.type === "string" && e.type.includes("Backtick"));
        if (backtick) {
          throw new ParseError(
            `'def ${defName}' porte du CODE, pas une structure \u2014 ce palier lit \xAB un nom vaut une suite de termes \xBB ('def cadence sa re ga pa'). Le corps de code typ\xE9 ('def ${defName} <type> \`langage: \u2026\`', types 'signal', 'pitch', 'phase', 'logic') n'est PAS encore lu ; il refuse ici plut\xF4t que d'\xEAtre lu de travers \u2014 sans quoi le type deviendrait un terminal et le code un \xE9l\xE9ment voisin.`,
            tok
          );
        }
        return { type: "DefDirective", name: defName, kind: "structure", body: corps, line: tok.line };
      }
      while (at(T.IDENT)) {
        lireUneCle();
        if (clesParenthesees && at(T.COMMA)) advance();
      }
      if (clesParenthesees) {
        if (!at(T.RPAREN)) {
          throw new ParseError(
            `'terminal ${defName}' : le corps ouvert par '(' n'est pas referm\xE9 \u2014 il manque ')'.`,
            current()
          );
        }
        advance();
      }
      while (at(T.NEWLINE) || at(T.COMMENT)) {
        let j = pos;
        while (tokens[j] && (tokens[j].type === T.NEWLINE || tokens[j].type === T.COMMENT)) j++;
        const suivant = tokens[j];
        if (!suivant || suivant.type !== T.IDENT || !(suivant.col > 1)) break;
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        lireUneCle(true);
      }
      if (lu === 0 && motDeclarant === "def" && (apresLeNom.type === T.NEWLINE || apresLeNom.type === T.EOF || apresLeNom.type === T.COMMENT)) {
        return {
          type: "VarDirective",
          names: [defName],
          varType: { kind: "type", type: null },
          settings: { type: "SettingBag", pairs: [] },
          line: tok.line
        };
      }
      if (lu === 0) {
        throw new ParseError(
          // ⚠️ LE NOM CITÉ EST CELUI QUI A ÉTÉ LU, pas celui qui a été écrit. Quand un signe COLLÉ
          // l'a arrêté, le message doit le dire avant tout le reste : sans ça, l'auteur relit sa
          // ligne, y voit son nom entier, et cherche la faute dans le corps.
          `${apresLeNom && apresLeNom.spaceBefore === false && apresLeNom.type !== T.EOF ? `le nom lu s'arr\xEAte \xE0 '${defName}' : le signe ${JSON.stringify(String(apresLeNom.value ?? apresLeNom.type))} qui le suit n'entre pas dans un nom, et ce qui reste ne se lit comme aucun corps. ` : ""}'${motDeclarant} ${defName}' ne d\xE9clare rien. Ce palier lit DEUX corps : la D\xC9CLARATION DE TERMINAL \u2014 un nom puis ses cl\xE9s, sur la m\xEAme ligne ('def ${defName}  voice.sec') ou dans un bloc indent\xE9, une cl\xE9 par ligne \u2014 et la STRUCTURE, un nom qui vaut une suite de termes ('def ${defName} sa re ga pa'). Les autres corps que la sp\xE9cification d\xE9crit \u2014 un branchement, du code typ\xE9, un pr\xE9r\xE9glage, une transformation param\xE9tr\xE9e ou structurelle \u2014 ne sont PAS encore lus ; ils le seront, et d'ici l\xE0 ils refusent ici plut\xF4t que d'\xEAtre lus de travers.`,
          tok
        );
      }
      return { type: "DefDirective", name: defName, kind: "terminal", keys: cles, line: tok.line };
    }
    if (name === "init") {
      const entrees = [];
      while (!atEnd()) {
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        if (atEnd()) break;
        if (at(T.BACKTICK)) {
          const tok2 = current();
          const t = splitBacktickTag(advance().value);
          entrees.push({ type: "BacktickOrphan", tag: t.tag, code: t.code, line: tok2.line });
          continue;
        }
        if (at(T.BANG) || at(T.LPAREN)) {
          if (at(T.BANG)) advance();
          entrees.push(parseRuntimeQualifier());
          continue;
        }
        break;
      }
      return { type: "InitDirective", entrees, line: tok.line };
    }
    if (name === "actor") {
      let actorName = lireNomDEntree(tok);
      while (at(T.PERIOD) && !current().spaceBefore && peek(1).type === T.IDENT) {
        advance();
        actorName += `.${advance().value}`;
      }
      const corpsParenthese = at(T.LPAREN);
      if (corpsParenthese) advance();
      const properties = {};
      const soundAssignments = [];
      const parseRefParams = () => {
        expect(T.LPAREN);
        const params = {};
        while (!at(T.RPAREN) && !atEnd()) {
          while (at(T.NEWLINE) || at(T.COMMENT)) advance();
          if (at(T.RPAREN) || atEnd()) break;
          const paramKey = expect(T.IDENT).value;
          expect(T.COLON);
          let paramVal;
          if (at(T.INT) || at(T.FLOAT)) {
            paramVal = Number(advance().value);
          } else {
            let brut = "";
            while (!atEnd() && !at(T.COMMA) && !at(T.RPAREN) && !at(T.NEWLINE)) {
              brut += advance().value;
            }
            if (brut === "") throw new ParseError(`valeur attendue apr\xE8s '${paramKey}:'`, current());
            paramVal = brut;
          }
          params[paramKey] = paramVal;
          if (at(T.COMMA)) advance();
        }
        expect(T.RPAREN);
        return params;
      };
      const setEntityRef = (key, value2, params, tokenDeLaCle) => {
        if (key === "out") {
          properties.transport = { type: "TransportRef", key: value2, params: params || {} };
        } else {
          properties[key] = value2;
          if (params) (properties.entityParams || (properties.entityParams = {}))[key] = params;
        }
      };
      while (!atEnd()) {
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        if (corpsParenthese && at(T.RPAREN)) break;
        if (corpsParenthese && at(T.COMMA)) {
          advance();
          continue;
        }
        if (at(T.STAR) && peek(1).type === T.COLON) {
          advance();
          advance();
          const target = parseSoundAssignmentTarget();
          soundAssignments.push({
            type: "SoundAssignment",
            scope: "actor",
            actor: actorName,
            subject: "*",
            target,
            line: tok.line
          });
          continue;
        }
        if (at(T.AT) && peek(1).type === T.IDENT && peek(1).value === "alphabet" && peek(2).type === T.PERIOD && !peek(2).spaceBefore) {
          advance();
          advance();
          advance();
          properties.alphabet = expect(T.IDENT).value;
          continue;
        }
        if (!corpsParenthese && at(T.IDENT) && current().col === 1 && current().line > tok.line) break;
        if (!at(T.IDENT)) break;
        const key = current().value;
        const next = peek(1).type;
        if (key === "transport" && (next === T.PERIOD || next === T.COLON) && !peek(1).spaceBefore) {
          throw new ParseError(
            `acteur '${actorName}' : cette cl\xE9 n'existe pas. La direction de sortie s'\xE9crit 'out.<canal>' \u2014 par exemple 'out.audio' ou 'out.midi(ch:3)'.`,
            current()
          );
        }
        if (next === T.PERIOD && !peek(1).spaceBefore) {
          if (!actorKeysData().valides.has(key)) {
            let k = 0, estRegle = false;
            while (peek(k) && peek(k).type !== T.NEWLINE && peek(k).type !== T.EOF) {
              const t = peek(k).type;
              if (t === T.ARROW_R || t === T.ARROW_L || t === T.ARROW_BI) {
                estRegle = true;
                break;
              }
              k++;
            }
            if (estRegle) break;
            const perimee = actorKeysData().perimees.has(key);
            const ou = key === "voice" ? ` \u2014 une voix s'attache au TERMINAL, pas \xE0 l'acteur` : key === "sound" || key === "sounds" ? ` \u2014 un prototype d'objet sonore vit en librairie, il ne se pose pas sur l'acteur` : "";
            throw new ParseError(
              `'${key}.\u2026' n'est pas une cl\xE9 d'acteur${perimee ? " (retir\xE9e le 2026-08-06)" : ""}${ou}. Les cl\xE9s d'un acteur sont : ${[...actorKeysData().valides].join(", ")}`,
              current()
            );
          }
          const jetonDeLaCle = current();
          advance();
          advance();
          const value2 = expect(T.IDENT).value;
          let params = null;
          if (at(T.LPAREN) && !current().spaceBefore) params = parseRefParams();
          setEntityRef(key, value2, params, jetonDeLaCle);
          continue;
        }
        if (next === T.COLON && !peek(1).spaceBefore) {
          const t3 = peek(2);
          const t4 = peek(3);
          const isSubjectSoundAssign = t3.type === T.IDENT && t3.value === "sound" && t4.type === T.PERIOD || t3.type === T.LBRACE;
          if (isSubjectSoundAssign) {
            const subject = advance().value;
            advance();
            const target = parseSoundAssignmentTarget();
            soundAssignments.push({
              type: "SoundAssignment",
              scope: "actor",
              actor: actorName,
              subject,
              target,
              line: tok.line
            });
            continue;
          }
          if (actorKeysData().toutes.has(key)) {
            const canon = key === "sounds" ? "sound" : key;
            throw new ParseError(
              `'${key}:\u2026' refus\xE9 \u2014 ':' n'affecte pas de valeur \xE0 un composant. \xC9cris '${canon}.<nom>'` + (key === "out" ? " avec ses params entre () \u2014 ex. out.midi(ch:3)" : "") + ` (r\xE8gle : '.' APPELLE le composant, ':' AFFECTE une valeur).`,
              current()
            );
          }
          advance();
          advance();
          if (at(T.IDENT)) {
            const value2 = advance().value;
            let params = null;
            if (at(T.LPAREN) && !current().spaceBefore) params = parseRefParams();
            const canonicalKey = key === "sounds" ? "sound" : key;
            setEntityRef(canonicalKey, value2, params, tok);
            continue;
          }
          if (at(T.INT)) {
            properties[key] = Number(advance().value);
            continue;
          }
          if (at(T.FLOAT)) {
            properties[key] = Number(advance().value);
            continue;
          }
          break;
        }
        break;
      }
      if (corpsParenthese && !at(T.RPAREN)) {
        throw new ParseError(
          `acteur '${actorName}' : le corps ouvert par '(' n'est pas referm\xE9 \u2014 il manque ')'.`,
          current()
        );
      }
      if (corpsParenthese) advance();
      if (properties.eval && properties.transport) {
        throw new ParseError(
          `acteur '${actorName}' : un producteur 'eval.${properties.eval}' sort en natif \u2014 pas de 'out' (il produit et sort par ses propres moyens ; on ne route pas sa sortie native). Retire le 'out' de cet acteur.`,
          tok
        );
      }
      if (properties.transport && (properties.transport.key === "video" || properties.transport.key === "visual")) {
        throw new ParseError(
          `acteur '${actorName}' : 'out.${properties.transport.key}' n'existe pas \u2014 le canal visuel a \xE9t\xE9 SUPPRIM\xC9 (les visuels embarqu\xE9s sortent en natif sur leur canvas). Canal de sortie = audio/midi/osc uniquement.`,
          tok
        );
      }
      if (properties.transport && deprecatedTransports().has(properties.transport.key)) {
        throw new ParseError(
          `acteur '${actorName}' : 'out.${properties.transport.key}' est un canal P\xC9RIM\xC9 (mod\xE8le profils d'environnement abandonn\xE9 2026-07-16). \xC9cris 'out.audio' (canal canonique : audio/midi/osc).`,
          tok
        );
      }
      if (properties.transport && !outChannels().has(properties.transport.key)) {
        throw new ParseError(
          `acteur '${actorName}' : '${properties.transport.key}' n'est pas une sortie \u2014 les canaux de sortie sont ${[...outChannels()].join(", ")}. La liste est FERM\xC9E.`,
          tok
        );
      }
      if (properties.transport && outChannels().has(properties.transport.key) && !writableChannels().has(properties.transport.key)) {
        throw new ParseError(
          `acteur '${actorName}' : 'out.${properties.transport.key}' est refus\xE9 \u2014 ce canal est une DESTINATION de l'architecture, rout\xE9e comme les autres sorties, mais son \xC9CRITURE dans une sc\xE8ne attend encore son appareil d\xE9di\xE9.`,
          tok
        );
      }
      if (properties.voice) assertVoiceRef(properties.voice, `acteur '${actorName}'`, tok);
      if (properties.alphabet) assertAlphabetVoices(properties.alphabet, tok);
      const references = [];
      const addRef = (category, name2, params) => {
        if (name2 == null) return;
        const r = { type: "ActorReference", category, name: name2, line: tok.line };
        if (params && Object.keys(params).length > 0) r.params = params;
        references.push(r);
      };
      addRef("alphabet", properties.alphabet);
      addRef("tuning", properties.tuning);
      addRef("octaves", properties.octaves);
      addRef("voice", properties.voice);
      if (properties.transport) addRef("transport", properties.transport.key, properties.transport.params);
      addRef("eval", properties.eval);
      return {
        type: "ActorDirective",
        name: actorName,
        properties,
        references,
        soundAssignments: soundAssignments.length > 0 ? soundAssignments : null,
        line: tok.line
      };
    }
    if (name === "sound" && !subkey && at(T.COLON) && peek(1).type === T.IDENT && (describeVocabulary().components.sound || []).includes(peek(1).value)) {
      throw new ParseError(
        `'sound:<X>' refus\xE9 \u2014 ':' n'affecte pas de valeur \xE0 un composant. \xC9cris 'sound.<nom>' (r\xE8gle : ':' affecte, '.' appelle).`,
        tok
      );
    }
    if (name === "sound") {
      let libVariant = null;
      if (subkey && at(T.COLON)) {
        advance();
        libVariant = expect(T.IDENT).value;
      }
      return parseSoundSection(tok.line, subkey, libVariant);
    }
    if (name === "timepatterns" && at(T.COLON)) {
      advance();
      const patterns = [];
      while (at(T.IDENT)) {
        const patName = advance().value;
        expect(T.EQUALS);
        const num = expect(T.INT).value;
        expect(T.SLASH);
        const denom = expect(T.INT).value;
        patterns.push({ name: patName, ratio: `${num}/${denom}` });
        if (at(T.COMMA)) advance();
      }
      return {
        type: "Directive",
        name,
        subkey,
        runtime: null,
        value: null,
        aliases: null,
        modifiers: null,
        timePatterns: patterns,
        line: tok.line
      };
    }
    if (catalogAxisKeys().has(name) && !subkey && at(T.COLON)) {
      const hint = name === "tuning" ? " ; fr\xE9quence de r\xE9f\xE9rence \u2192 'diapason:<N>'" : "";
      throw new ParseError(
        `'${name}:<X>' refus\xE9 \u2014 ':' n'affecte pas de valeur \xE0 un composant. \xC9cris '${name}.<nom>' (r\xE8gle : ':' affecte, '.' appelle)${hint}.`,
        current()
      );
    }
    if (at(T.COLON)) {
      advance();
      ({ value, runtime } = parseDirectiveColonValue(name));
    }
    if (name === "alphabet" && subkey && runtime && !outChannels().has(runtime)) {
      const hint = deprecatedTransports().has(runtime) ? ` '${runtime}' est un canal P\xC9RIM\xC9 (mod\xE8le profils d'environnement abandonn\xE9 2026-07-16) \u2014 \xE9cris 'alphabet.${subkey}:audio'.` : runtime === "sc" ? ` L'ancien sucre ':sc' (= transport+eval sc) est ABOLI \u2014 un eval se d\xE9clare sur un actor ('eval.<X>') ; le raccord de l'acteur implicite ne nomme qu'un canal.` : "";
      throw new ParseError(
        `'alphabet.${subkey}:${runtime}' refus\xE9 \u2014 le raccord de sortie de l'acteur implicite n'accepte que {audio, midi, osc} (liste positive ferm\xE9e, d\xE9cision 2026-07-16).${hint}`,
        current()
      );
    }
    if (name === "alphabet" && subkey && runtime && outChannels().has(runtime) && !writableChannels().has(runtime)) {
      throw new ParseError(
        `'alphabet.${subkey}:${runtime}' refus\xE9 \u2014 ce canal est une DESTINATION de l'architecture, rout\xE9e comme les autres sorties, mais son \xC9CRITURE dans une sc\xE8ne attend encore son appareil d\xE9di\xE9.`,
        current()
      );
    }
    if (name === "alphabet" && subkey) assertAlphabetVoices(subkey, current());
    let modifiers = null;
    if (name === "mode" && at(T.LPAREN)) {
      advance();
      modifiers = [];
      while (!at(T.RPAREN) && !atEnd()) {
        const tokModName = current();
        const modName = expect(T.IDENT).value;
        const portees = porteesDeclarees(modName);
        if (!portees) {
          throw new ParseError(
            `'mode:${runtime || "\u2026"}(${modName})' : '${modName}' n'est d\xE9clar\xE9 par aucune librairie charg\xE9e. Un modificateur de sous-grammaire est un mot de librairie comme un autre \u2014 invoquer celle qui le porte, ou retirer le mot.`,
            tokModName
          );
        }
        if (!portees.includes("subgrammar")) {
          throw new ParseError(
            `'${modName}' ne se pose pas sur une sous-grammaire \u2014 sa port\xE9e d\xE9clar\xE9e est ${JSON.stringify(portees)}. ${portees.includes("scene") ? `Il s'\xE9crit en t\xEAte de sc\xE8ne : '${modName}'.` : `Il vaut ${portees.map((p) => `'${p}'`).join(", ")}.`}`,
            tokModName
          );
        }
        let modValue = true;
        if (at(T.COLON)) {
          advance();
          if (at(T.INT)) modValue = Number(advance().value);
          else if (at(T.FLOAT)) modValue = Number(advance().value);
          else if (at(T.IDENT)) modValue = advance().value;
        }
        modifiers.push({ name: modName, value: modValue });
        if (at(T.COMMA)) advance();
      }
      expect(T.RPAREN);
    } else if (at(T.LPAREN)) {
      advance();
      aliases = [];
      while (!at(T.RPAREN) && !atEnd()) {
        const from = expect(T.IDENT).value;
        expect(T.COLON);
        const to = expect(T.IDENT).value;
        aliases.push({ type: "Alias", from, to });
        if (at(T.COMMA)) advance();
      }
      expect(T.RPAREN);
    }
    if (name === "alphabet" && subkey) {
      const assignments = [];
      while (!atEnd()) {
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        if (at(T.STAR) && peek(1).type === T.COLON) {
          const line = current().line;
          advance();
          advance();
          const target = parseSoundAssignmentTarget();
          assignments.push({
            type: "SoundAssignment",
            scope: "alphabet",
            alphabet: subkey,
            subject: "*",
            target,
            line
          });
          continue;
        }
        if (at(T.IDENT) && peek(1).type === T.COLON) {
          const t3 = peek(2);
          const t4 = peek(3);
          const isSoundAssign = t3.type === T.IDENT && t3.value === "sound" && t4.type === T.PERIOD || t3.type === T.LBRACE;
          if (isSoundAssign) {
            const line = current().line;
            const subject = advance().value;
            advance();
            const target = parseSoundAssignmentTarget();
            assignments.push({
              type: "SoundAssignment",
              scope: "alphabet",
              alphabet: subkey,
              subject,
              target,
              line
            });
            continue;
          }
          if (current().value === "notes") {
            advance();
            advance();
            while (at(T.IDENT)) advance();
            continue;
          }
        }
        break;
      }
      refuserCanalDeSortieInconnu(name, subkey, tok);
      refuserModeInvalide(name, runtime, value, tok);
      const dirNode = {
        type: "Directive",
        name,
        subkey,
        runtime,
        value,
        aliases,
        modifiers,
        ...directiveParams ? { params: directiveParams } : {},
        line: tok.line
      };
      if (assignments.length > 0) {
        return {
          type: "AlphabetSoundAssignments",
          directive: dirNode,
          assignments,
          line: tok.line
        };
      }
      return dirNode;
    }
    refuserCanalDeSortieInconnu(name, subkey, tok);
    refuserModeInvalide(name, runtime, value, tok);
    return {
      type: "Directive",
      name,
      subkey,
      runtime,
      value,
      aliases,
      modifiers,
      ...directiveParams ? { params: directiveParams } : {},
      line: tok.line
    };
  }
  function lireValeurDeMembre() {
    if (at(T.BACKTICK)) {
      const raw = advance().value;
      const t = tryBacktickTag(raw);
      return t ? { kind: "backtick", tag: t.tag, code: t.code } : { kind: "backtick", tag: null, code: raw };
    }
    if (at(T.INT)) {
      const n = Number(advance().value);
      if (at(T.IDENT) && !current().spaceBefore) return { kind: "number", value: n, unit: advance().value };
      return { kind: "number", value: n };
    }
    if (at(T.IDENT)) return { kind: "ref", name: advance().value };
    throw new ParseError("valeur attendue apr\xE8s \xAB : \xBB", current());
  }
  function isLookaheadMacro() {
    let j = pos;
    if (tokens[j]?.type !== T.IDENT) return false;
    j++;
    if (tokens[j]?.type !== T.LPAREN) return false;
    let depth = 1;
    j++;
    while (j < tokens.length && depth > 0) {
      if (tokens[j].type === T.LPAREN) depth++;
      if (tokens[j].type === T.RPAREN) depth--;
      j++;
    }
    return tokens[j]?.type === T.EQUALS;
  }
  function macroBodyMentions(body) {
    const names = /* @__PURE__ */ new Set();
    const walk = (n) => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) {
        for (const el of n) walk(el);
        return;
      }
      for (const key of ["name", "symbol", "actor", "tag"]) {
        if (typeof n[key] === "string") names.add(n[key]);
      }
      if (n.type === "Literal" && typeof n.value === "string") names.add(n.value);
      if (typeof n.code === "string") {
        for (const w of n.code.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []) names.add(w);
      }
      for (const k in n) {
        if (n[k] && typeof n[k] === "object") walk(n[k]);
      }
    };
    walk(body);
    return names;
  }
  function checkMacroParamsUsed(macroName, params, body, tok) {
    if (!params || params.length === 0) return;
    const used = macroBodyMentions(body);
    const unused = params.filter((p) => !used.has(p));
    if (unused.length > 0) {
      throw new ParseError(
        `Macro '${macroName}' : param\xE8tre(s) d\xE9clar\xE9(s) mais absent(s) du corps : ${unused.join(", ")}. Une macro est une substitution textuelle (EBNF \xA7macro l.59/273) \u2014 chaque param\xE8tre DOIT appara\xEEtre dans le corps (ex. accent(x) = x(vel:120)). Une d\xE9claration name(cible, transport) = courbe (forme CV/signal) n'est pas une macro valide : syntaxe en attente d'arbitrage.`,
        tok
      );
    }
  }
  function parseMacro() {
    const tok = current();
    const name = expect(T.IDENT).value;
    expect(T.LPAREN);
    const params = [];
    while (!at(T.RPAREN) && !atEnd()) {
      params.push(expect(T.IDENT).value);
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);
    expect(T.EQUALS);
    const body = parseRhsElements();
    checkMacroParamsUsed(name, params, body, tok);
    return { type: "Macro", name, params, body, line: tok.line };
  }
  function tryBacktickTag(raw) {
    const colonIdx = raw.indexOf(":");
    const tag = colonIdx > 0 ? raw.slice(0, colonIdx).trim() : "";
    if (!/^[A-Za-z][\w+-]*$/.test(tag)) return null;
    return { tag, code: raw.slice(colonIdx + 1).trim() };
  }
  function splitBacktickTag(raw) {
    return tryBacktickTag(raw) || { tag: null, code: raw.trim() };
  }
  function parseBacktickOrphan() {
    const tok = current();
    const raw = expect(T.BACKTICK).value;
    const { tag, code } = splitBacktickTag(raw);
    return { type: "BacktickOrphan", tag, code, line: tok.line };
  }
  function parsePropPairs() {
    const props = {};
    while (!at(T.RBRACE) && !atEnd()) {
      if (at(T.NEWLINE) || at(T.COMMENT)) {
        advance();
        continue;
      }
      if (at(T.COMMA)) {
        advance();
        continue;
      }
      const key = expect(T.IDENT).value;
      if (!at(T.COLON)) {
        props[key] = true;
        continue;
      }
      advance();
      let val;
      if (at(T.REST)) {
        advance();
        if (at(T.INT)) val = -Number(advance().value);
        else if (at(T.FLOAT)) val = -Number(advance().value);
        else throw new ParseError("Expected number after - in prop value", current());
      } else if (at(T.INT)) {
        const num = advance().value;
        if (at(T.SLASH) && peek(1).type === T.INT) {
          advance();
          val = `${num}/${advance().value}`;
        } else {
          val = Number(num);
        }
      } else if (at(T.FLOAT)) {
        val = Number(advance().value);
      } else if (at(T.STRING)) {
        val = advance().value;
      } else if (at(T.IDENT)) {
        const id = advance().value;
        if (id === "true") val = true;
        else if (id === "false") val = false;
        else val = id;
      } else {
        throw new ParseError("Expected value (INT/FLOAT/STRING/IDENT) in prop pair", current());
      }
      props[key] = val;
    }
    return props;
  }
  function parseSoundAssignmentTarget() {
    if (at(T.LBRACE)) {
      advance();
      const props = parsePropPairs();
      expect(T.RBRACE);
      return { kind: "inline-props", props };
    }
    const first = expect(T.IDENT).value;
    if (first === "sound" && at(T.PERIOD)) {
      advance();
      const name = expect(T.IDENT).value;
      return { kind: "named-ref", name };
    }
    return { kind: "named-ref", name: first };
  }
  function parseSoundSection(line, lib, libVariant) {
    const prototypes = [];
    while (at(T.NEWLINE) || at(T.COMMENT)) advance();
    while (!atEnd()) {
      if (at(T.LBRACE)) {
        advance();
        const config = parsePropPairs();
        expect(T.RBRACE);
        prototypes.push({ type: "SoundPrototype", name: null, config, line });
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        continue;
      }
      if (at(T.IDENT) && peek(1).type === T.LBRACE) {
        const protoName = advance().value;
        advance();
        const config = parsePropPairs();
        expect(T.RBRACE);
        prototypes.push({ type: "SoundPrototype", name: protoName, config, line });
        while (at(T.NEWLINE) || at(T.COMMENT)) advance();
        continue;
      }
      break;
    }
    return {
      type: "SoundSection",
      lib: lib || null,
      libVariant: libVariant || null,
      prototypes,
      line
    };
  }
  function parseSoundAssignmentLocal(line) {
    let subject;
    if (at(T.STAR)) {
      advance();
      subject = "*";
    } else subject = expect(T.IDENT).value;
    expect(T.COLON);
    const target = parseSoundAssignmentTarget();
    return { type: "SoundAssignment", subject, target, line };
  }
  function parseSubgrammars(initialMode, initialModifiers) {
    const subs = [];
    let index = 1;
    let safety = 0;
    let currentMode = initialMode || null;
    let currentModifiers = initialModifiers || null;
    while (!atEnd()) {
      if (++safety > 200) throw new ParseError("Subgrammar parse loop safety limit", current());
      skipNewlines();
      if (atEnd()) break;
      if (atProductionBlock()) {
        throw new ParseError(`Bloc de production [@\u2026] : autoris\xE9 en en-t\xEAte de sc\xE8ne uniquement`, current());
      }
      if (at(T.BANG) && peek(1).type === T.LBRACKET && peek(2).type === T.AT) {
        throw new ParseError(`Forme '![@\u2026]' r\xE9serv\xE9e (directive de production dans le flux) \u2014 non impl\xE9ment\xE9e`, current());
      }
      let blockMode = currentMode;
      let blockModifiers = currentModifiers;
      while (!atEnd() && !at(T.SEPARATOR) && !at(T.NEWLINE) && ligneSansFleche()) {
        if (at(T.IDENT) && current().value === "template") break;
        if (at(T.IDENT) && current().value === "templates") {
          throw new ParseError(`'templates' (pluriel, v0.7) n'existe plus \u2014 \xE9crire 'template' (singulier)`, current());
        }
        const dirTok = current();
        const dirNom = current() && current().value ? String(current().value) : "?";
        const dir = parseDirective();
        if (dir.name === "mode" && dir.runtime) {
          blockMode = dir.runtime;
          currentMode = blockMode;
          blockModifiers = dir.modifiers || null;
          currentModifiers = blockModifiers;
        } else if (dir.name !== "mode") {
          const axes = new Set(loadLib("core")?.schema?.catalogAxes || []);
          const porteesDuMot = porteesDeclarees(dirNom);
          if (porteesDuMot && !porteesDuMot.includes("scene") && !axes.has(dirNom)) {
            const PLACE = {
              subgrammar: "en t\xEAte de sous-grammaire, dans la parenth\xE8se du mode (`mode:<mode>(<r\xE9glage>)`)",
              rule: "sur une r\xE8gle",
              group: "sur un groupe",
              symbol: "sur un \xE9l\xE9ment",
              flow: "dans le flux"
            };
            const ou = porteesDuMot.map((x) => PLACE[x] ?? x);
            throw new ParseError(
              `'${dirNom}' n'est pas une d\xE9claration : c'est un r\xE9glage, et il ne s'\xE9crit pas seul sur une ligne. Il vaut ${ou.length === 1 ? ou[0] : ou.slice(0, -1).join(", ") + " ou " + ou[ou.length - 1]}.`,
              dirTok
            );
          }
          throw new ParseError(
            `'${dirNom}' est \xE9crit APR\xC8S des r\xE8gles, et \xE0 cette place il ne d\xE9clare RIEN : il \xE9tait accept\xE9 puis jet\xE9 en silence. Les d\xE9clarations pr\xE9c\xE8dent les r\xE8gles \u2014 remonter cette ligne avant la premi\xE8re r\xE8gle de la sc\xE8ne. (Seul 'mode' se place ici : il gouverne la sous-grammaire qui suit.)`,
            dirTok
          );
        }
        skipNewlines();
      }
      const rules = [];
      let ruleSafety = 0;
      while (!atEnd() && !at(T.SEPARATOR)) {
        if (++ruleSafety > 200) throw new ParseError("Rule parse loop safety limit", current());
        skipNewlines();
        if (atEnd() || at(T.SEPARATOR)) break;
        if (at(T.IDENT) && current().value === "template") break;
        if (rules.length && ligneSansFleche()) break;
        if (isRuleStart()) {
          rules.push(parseRule());
        } else {
          if (!atEnd() && !at(T.SEPARATOR) && !at(T.AT)) {
            throw new ParseError(`ligne non reconnue au niveau des r\xE8gles : attendu une r\xE8gle, 'directive', '-----' ou la fin de la sc\xE8ne`, current());
          }
          break;
        }
        skipNewlines();
      }
      if (rules.length > 0) {
        subs.push({ type: "Subgrammar", index: index++, rules, mode: blockMode, modifiers: blockModifiers });
      } else if (at(T.SEPARATOR)) {
        advance();
        skipNewlines();
        continue;
      } else {
        break;
      }
      currentMode = null;
      if (at(T.SEPARATOR)) {
        advance();
        skipNewlines();
      }
    }
    return subs;
  }
  function parseTemplateSection() {
    const kw = expect(T.IDENT);
    if (kw.value !== "template") {
      throw new ParseError(`Expected 'template'`, kw);
    }
    skipNewlines();
    const entries = [];
    while (!atEnd()) {
      skipNewlines();
      if (atEnd()) break;
      if (!at(T.LBRACKET)) break;
      const ouvre = current();
      const brute = lignesSource ? lignesSource[ouvre.line - 1] : null;
      while (!atEnd() && current().line === ouvre.line) advance();
      if (brute == null) {
        throw new ParseError(
          `le catalogue de gabarits se transporte VERBATIM : le parseur a besoin de la SOURCE pour rendre la ligne telle qu'elle est \xE9crite. L'appelant doit passer 'source' \xE0 parse().`,
          ouvre
        );
      }
      entries.push({ type: "TemplateEntry", line: brute });
      skipNewlines();
    }
    return entries;
  }
  function parseTemplateBody() {
    const elements = [];
    while (!atAny(T.NEWLINE, T.EOF, T.RPAREN)) {
      if (at(T.QUESTION)) {
        let count = 0;
        while (at(T.QUESTION)) {
          advance();
          count++;
        }
        if (at(T.INT)) {
          throw new ParseError(
            `'?${current().value}' : un wildcard num\xE9rot\xE9 n'a de sens que dans une r\xE8gle (le num\xE9ro unifie avec la fl\xE8che, qui rejoue le choix). Une ligne de catalogue @template n'a pas de fl\xE8che \u2014 ses wildcards sont toujours anonymes ('?'), jamais num\xE9rot\xE9s.`,
            current()
          );
        }
        elements.push({ type: "TemplateWildcard", count });
      } else if (at(T.PERIOD)) {
        advance();
        elements.push({ type: "TemplatePeriod" });
      } else if (at(T.LPAREN)) {
        advance();
        expect(T.DOLLAR);
        const idx = Number(expect(T.INT).value);
        const body = parseTemplateBody();
        expect(T.RPAREN);
        elements.push({ type: "TemplateBracket", index: idx, body });
      } else {
        break;
      }
    }
    return elements;
  }
  function isRuleStart() {
    const t = current().type;
    return t === T.IDENT || t === T.HASH || t === T.LPAREN || t === T.QUESTION || t === T.PIPE || t === T.LBRACE || t === T.RBRACE || t === T.COMMA || t === T.REST || t === T.DOLLAR || t === T.RPAREN || t === T.LBRACKET && isGuardBracket();
  }
  function isGuardBracket() {
    let i = 1;
    while (pos + i < tokens.length) {
      const t = tokens[pos + i].type;
      if (t === T.RBRACKET || t === T.NEWLINE || t === T.EOF) break;
      if (t === T.COLON) return false;
      i++;
    }
    return true;
  }
  function parseRule() {
    const tok = current();
    let guard = null;
    const contexts = [];
    const guards = [];
    while (at(T.LBRACKET) && isGuardBracket()) {
      guards.push(parseGuard());
    }
    guard = guards.length > 0 ? guards : null;
    while (at(T.HASH) || at(T.LPAREN) && isContextLookahead()) {
      contexts.push(parseContext());
    }
    const lhs = parseLhsElements();
    let arrow;
    if (at(T.ARROW_R)) {
      arrow = "->";
      advance();
    } else if (at(T.ARROW_L)) {
      arrow = "<-";
      advance();
    } else if (at(T.ARROW_BI)) {
      arrow = "<>";
      advance();
    } else throw new ParseError(`Expected arrow (-> <- <>), got ${current().type}`, current());
    const rhs = parseRhsElements();
    if (at(T.COLON) && estNombreDeDuree(peek(1)) && rhs.length > 0) {
      const tokColon = current();
      advance();
      const dur = parseColonFrame(tokColon);
      const inner = rhs.splice(0, rhs.length);
      rhs.push(cadreDuree(dur, inner));
      if (atRhsElementStart()) {
        throw new ParseError(`dur\xE9e isol\xE9e dans le flux : ':N' se colle \xE0 un terminal (A4:1/2), un groupe ({A B}:2) ou toute la r\xE8gle (en fin de RHS) \u2014 jamais au milieu du flux`, current());
      }
    }
    let settings = null;
    const qualifiers = [];
    const flags = [];
    while (true) {
      if (isRuntimeQualifierLoose()) {
        const rq = parseRuntimeQualifier();
        if (settings) settings.pairs.push(...rq.pairs);
        else settings = rq;
        continue;
      }
      if (at(T.LBRACKET)) {
        if (isFlagBracket()) {
          flags.push(...parseFlagBracket());
        } else {
          qualifiers.push(parseQualifier());
        }
        continue;
      }
      break;
    }
    const scanValues = universeSacs().specs.scan && universeSacs().specs.scan.values || [];
    let ruleMode = null;
    for (const pair of settings ? settings.pairs : []) {
      if (pair.key === "scan") {
        if (scanValues.includes(pair.value)) {
          ruleMode = pair.value;
        } else {
          throw new ParseError(
            `(scan:${pair.value}) : valeur inconnue (attendu : ${scanValues.join(", ")})`,
            { line: tok.line, col: 0 }
          );
        }
      }
    }
    const countAnchorsLhs = lhs.filter((e) => e.type === "TemplateAnchor").length;
    const countAnchorsRhs = (function countRhsAnchors(elements) {
      let n = 0;
      for (const e of elements) {
        if (e.type === "TemplateAnchor") n++;
        else if (e.elements) n += countRhsAnchors(e.elements);
      }
      return n;
    })(rhs);
    const warnings = [];
    if (countAnchorsLhs !== countAnchorsRhs && (countAnchorsLhs > 0 || countAnchorsRhs > 0)) {
      warnings.push({
        type: "warning",
        message: `ancres de gabarit asym\xE9triques : LHS a ${countAnchorsLhs}, RHS a ${countAnchorsRhs}`,
        line: tok.line
      });
    }
    return { type: "Rule", guard, contexts, lhs, arrow, rhs, flags, qualifiers, settings, mode: ruleMode, line: tok.line, warnings };
  }
  const estProcedureNue = (mot) => universeRuleScopeControls().has(mot);
  function isFlagBracket() {
    if (!at(T.LBRACKET)) return false;
    const t1 = peek(1);
    const t2 = peek(2);
    if (t1.type !== T.IDENT) return false;
    if (t2.type === T.COLON) return false;
    if (estProcedureNue(t1.value)) return false;
    if (t2.type === T.EQUALS || t2.type === T.PLUS || t2.type === T.REST || t2.type === T.RBRACKET || t2.type === T.COMMA) return true;
    if (t1.value.endsWith("-") && t2.type === T.INT) return true;
    if (t1.value.endsWith("+") && t2.type === T.INT) return true;
    return false;
  }
  function parseFlagBracket() {
    expect(T.LBRACKET);
    const flags = [];
    while (!at(T.RBRACKET) && !atEnd()) {
      let rawFlag = expect(T.IDENT).value;
      let operator = null, value = null;
      if (rawFlag.endsWith("-") && at(T.INT)) {
        operator = "-";
        rawFlag = rawFlag.slice(0, -1);
        value = Number(advance().value);
      } else if (rawFlag.endsWith("+") && at(T.INT)) {
        operator = "+";
        rawFlag = rawFlag.slice(0, -1);
        value = Number(advance().value);
      } else if (at(T.EQUALS)) {
        operator = "=";
        advance();
        if (at(T.INT)) value = Number(advance().value);
        else if (at(T.IDENT)) value = advance().value;
        else throw new ParseError("Expected flag value", current());
      } else if (at(T.PLUS)) {
        operator = "+";
        advance();
        if (at(T.INT)) value = Number(advance().value);
        else if (at(T.IDENT)) value = advance().value;
        else throw new ParseError("Expected flag value", current());
      } else if (at(T.REST)) {
        operator = "-";
        advance();
        if (at(T.INT)) value = Number(advance().value);
        else if (at(T.IDENT)) value = advance().value;
        else throw new ParseError("Expected flag value", current());
      }
      flags.push({ type: "FlagExpr", flag: rawFlag, operator, value });
      if (at(T.COMMA)) advance();
    }
    expect(T.RBRACKET);
    return flags;
  }
  function parseGuard() {
    advance();
    let flag = expect(T.IDENT).value;
    let result;
    if (flag.endsWith("-") && at(T.INT)) {
      const val = Number(advance().value);
      flag = flag.slice(0, -1);
      result = { type: "Guard", flag, operator: "-", value: val, mutates: true };
    } else if (flag.endsWith("+") && at(T.INT)) {
      const val = Number(advance().value);
      flag = flag.slice(0, -1);
      result = { type: "Guard", flag, operator: "+", value: val, mutates: true };
    } else if (at(T.REST)) {
      advance();
      const val = Number(expect(T.INT).value);
      result = { type: "Guard", flag, operator: "-", value: val, mutates: true };
    } else if (at(T.PLUS)) {
      advance();
      const val = Number(expect(T.INT).value);
      result = { type: "Guard", flag, operator: "+", value: val, mutates: true };
    } else {
      let op;
      if (at(T.EQ)) {
        op = "==";
        advance();
      } else if (at(T.NEQ)) {
        op = "!=";
        advance();
      } else if (at(T.GT)) {
        op = ">";
        advance();
      } else if (at(T.LT)) {
        op = "<";
        advance();
      } else if (at(T.GTE)) {
        op = ">=";
        advance();
      } else if (at(T.LTE)) {
        op = "<=";
        advance();
      } else if (at(T.EQUALS)) {
        throw new ParseError(
          `garde '[${flag}=\u2026]' : '=' est une MUTATION, elle s'\xE9crit en fin de r\xE8gle ('S -> C4 [${flag}=\u2026]'). Pour TESTER la valeur d'un drapeau avant le LHS, comparer avec '==' ('[${flag}==\u2026] S -> C4')`,
          current()
        );
      } else {
        result = { type: "Guard", flag, operator: null, value: null, mutates: false };
        expect(T.RBRACKET);
        return result;
      }
      let value;
      if (at(T.INT)) value = Number(advance().value);
      else if (at(T.IDENT)) value = advance().value;
      else throw new ParseError(`Expected value after operator`, current());
      result = { type: "Guard", flag, operator: op, value, mutates: false };
    }
    expect(T.RBRACKET);
    return result;
  }
  function isContextLookahead() {
    let j = pos + 1;
    let depth = 1;
    while (j < tokens.length && depth > 0) {
      if (tokens[j].type === T.LPAREN) depth++;
      if (tokens[j].type === T.RPAREN) depth--;
      j++;
    }
    while (j < tokens.length) {
      const t = tokens[j].type;
      if (t === T.ARROW_R || t === T.ARROW_L || t === T.ARROW_BI) return true;
      if (t === T.NEWLINE || t === T.EOF) return false;
      j++;
    }
    return false;
  }
  function parseContext() {
    let positive = true;
    if (at(T.HASH)) {
      advance();
      positive = false;
      if (at(T.QUESTION)) {
        advance();
        return { type: "Context", positive: false, symbols: ["?"] };
      }
      if (at(T.LPAREN)) {
        advance();
        const symbols2 = [];
        while (!at(T.RPAREN) && !atEnd()) {
          if (at(T.IDENT)) symbols2.push(advance().value);
          else if (at(T.QUESTION)) {
            advance();
            if (at(T.INT)) symbols2.push("?" + advance().value);
            else symbols2.push("?");
          } else if (at(T.LBRACE)) {
            symbols2.push(advance().value);
          } else if (at(T.RBRACE)) {
            symbols2.push(advance().value);
          } else if (at(T.COMMA)) {
            symbols2.push(advance().value);
          } else break;
        }
        expect(T.RPAREN);
        return { type: "Context", positive: false, symbols: symbols2 };
      } else if (atAny(T.LBRACE, T.RBRACE, T.COMMA)) {
        return { type: "Context", positive: false, symbols: [advance().value] };
      } else if (at(T.REST)) {
        advance();
        return { type: "Context", positive: false, symbols: ["-"] };
      } else if (at(T.PROLONG)) {
        advance();
        return { type: "Context", positive: false, symbols: ["_"] };
      } else {
        const sym = expect(T.IDENT).value;
        return { type: "Context", positive: false, symbols: [sym] };
      }
    }
    expect(T.LPAREN);
    const symbols = [];
    while (!at(T.RPAREN) && !atEnd()) {
      if (at(T.IDENT)) symbols.push(advance().value);
      else if (at(T.QUESTION)) {
        advance();
        if (at(T.INT)) symbols.push("?" + advance().value);
        else symbols.push("?");
      } else if (atAny(T.LBRACE, T.RBRACE, T.COMMA)) symbols.push(advance().value);
      else break;
    }
    expect(T.RPAREN);
    return { type: "Context", positive: true, symbols };
  }
  function finDeMembreGauche() {
    let j = pos, prof = 0;
    do {
      if (tokens[j].type === T.LPAREN) prof++;
      else if (tokens[j].type === T.RPAREN) prof--;
      j++;
    } while (prof > 0 && j < tokens.length);
    const t = tokens[j] && tokens[j].type;
    return t === T.ARROW_R || t === T.ARROW_L || t === T.ARROW_BI;
  }
  function parseLhsElements() {
    const elements = [];
    while (!atAny(T.ARROW_R, T.ARROW_L, T.ARROW_BI, T.EOF, T.NEWLINE, T.SEPARATOR)) {
      if (at(T.IDENT)) {
        elements.push({ type: "Symbol", name: normalizeName(advance().value), line: current().line });
      } else if (at(T.PIPE)) {
        elements.push(parseVariable());
      } else if (at(T.QUESTION)) {
        elements.push(parseWildcard());
      } else if (at(T.HASH)) {
        elements.push(parseContext());
      } else if (at(T.LPAREN) && current().spaceBefore && isContextLookahead()) {
        if (elements.length > 0 && !finDeMembreGauche()) {
          throw new ParseError(
            `un CONTEXTE ne se pose qu aux EXTREMITES du membre gauche \u2014 en tete ('(A) x B -> \u2026') ou en queue ('x B (A) -> \u2026'). Ici il suit '${elements.length}' element(s) et en precede d autres : le moteur ne connait pas cette place, et l arbre produit ne serait lisible par personne.`,
            current()
          );
        }
        elements.push(parseContext());
      } else if (at(T.PROLONG)) {
        advance();
        elements.push({ type: "Prolongation" });
      } else if (at(T.REST)) {
        advance();
        elements.push({ type: "Rest" });
      } else if (at(T.DOLLAR)) {
        const dollarTok = current();
        const nextTok = peek(1);
        if (!nextTok.spaceBefore && (nextTok.type === T.IDENT || nextTok.type === T.LBRACE)) {
          throw new ParseError(
            `"$" coll\xE9 \xE0 un identifiant interdit en LHS \u2014 utiliser "$ " (dollar isol\xE9 avec espace)`,
            dollarTok
          );
        }
        advance();
        elements.push({ type: "TemplateAnchor", kind: "master" });
      } else if (atAny(T.LBRACE, T.RBRACE, T.COMMA, T.RPAREN)) {
        elements.push({ type: "RawBrace", value: advance().value });
      } else {
        break;
      }
    }
    return elements;
  }
  function parseRhsElements() {
    const elements = [];
    let safety = 0;
    while (!atAny(T.NEWLINE, T.EOF, T.SEPARATOR, T.COMMENT)) {
      if (at(T.LBRACKET) && current().spaceBefore && isFlagPrefixOfControl()) {
        const line = current().line;
        elements.push({ type: "FlagSet", flags: parseFlagBracket(), line });
        continue;
      }
      if (at(T.LBRACKET) && current().spaceBefore) break;
      if (at(T.LPAREN) && current().spaceBefore && isRuntimeQualifierLoose() && isEndOfRhs()) break;
      if (at(T.LPAREN) && current().spaceBefore && isRuntimeQualifierLoose()) {
        elements.push({ type: "InstantControl", qualifier: parseRuntimeQualifier(), conjoint: false });
        continue;
      }
      if (++safety > 500) throw new ParseError("RHS parse loop safety limit", current());
      if (atAny(T.RBRACE, T.COMMA) && isNewRuleAhead()) break;
      if (at(T.RBRACE)) {
        advance();
        const rawBrace = { type: "RawBrace", value: "}" };
        if (at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier()) {
          rawBrace.settings = parseRuntimeQualifier();
        }
        if (at(T.COLON) && !current().spaceBefore && estNombreDeDuree(peek(1))) {
          const tokColon = current();
          advance();
          rawBrace.duree = parseColonFrame(tokColon);
        }
        elements.push(rawBrace);
        continue;
      }
      if (at(T.COMMA)) {
        elements.push({ type: "RawBrace", value: "," });
        advance();
        continue;
      }
      if (at(T.PLUS) || at(T.RPAREN)) {
        elements.push({ type: "RawBrace", value: advance().value });
        continue;
      }
      if (at(T.STAR)) {
        advance();
        elements.push({ type: "RawBrace", value: "*" });
        continue;
      }
      const el = parseRhsElement();
      if (!el) break;
      let sacsLus = 0;
      while (at(T.LBRACKET) && !current().spaceBefore || at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier()) {
        if (at(T.LBRACKET)) refuserCrochetColle();
        el.suffixQualifiers = el.suffixQualifiers || [];
        refuserSecondSac(++sacsLus, el);
        el.suffixQualifiers.push(parseRuntimeQualifier());
      }
      refuserSuffixeArobase();
      elements.push(envelopperEnAccord(el, current()));
    }
    return elements;
  }
  function isNewRuleAhead() {
    if (pos > 0 && tokens[pos - 1].type !== T.NEWLINE) return false;
    let j = pos + 1;
    while (j < tokens.length) {
      const t = tokens[j].type;
      if (t === T.ARROW_R || t === T.ARROW_L || t === T.ARROW_BI) return true;
      if (t === T.NEWLINE || t === T.EOF || t === T.SEPARATOR) return false;
      j++;
    }
    return false;
  }
  function isFlagPrefixOfControl() {
    if (!at(T.LBRACKET) || !isFlagBracket()) return false;
    let j = pos, depth = 0;
    for (; j < tokens.length; j++) {
      if (tokens[j].type === T.LBRACKET) depth++;
      else if (tokens[j].type === T.RBRACKET) {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    if (j >= tokens.length) return false;
    const t = tokens[j];
    if (t.type !== T.IDENT || !isControlName(t.value)) return false;
    return isNoArgControl(t.value);
  }
  function isTempoOpQualifier() {
    if (!at(T.LBRACKET)) return false;
    const next = peek(1).type;
    if (!(next === T.SLASH || next === T.STAR)) return false;
    let j = pos + 2;
    while (j < tokens.length && (tokens[j].type === T.INT || tokens[j].type === T.FLOAT || tokens[j].type === T.SLASH)) j++;
    return j < tokens.length && tokens[j].type === T.RBRACKET;
  }
  function isEndOfRhs() {
    let j = pos;
    if (tokens[j]?.type !== T.LPAREN) return false;
    while (tokens[j]?.type === T.LPAREN) {
      let depth = 1;
      j++;
      while (j < tokens.length && depth > 0) {
        if (tokens[j].type === T.LPAREN) depth++;
        else if (tokens[j].type === T.RPAREN) depth--;
        j++;
      }
    }
    const nextType = tokens[j]?.type;
    return !nextType || nextType === T.EOF || nextType === T.NEWLINE || nextType === T.SEPARATOR || nextType === T.LBRACKET || nextType === T.COMMENT;
  }
  function isRuntimeQualifier() {
    if (!at(T.LPAREN)) return false;
    const nextTok = peek(1);
    if (nextTok.type === T.STAR && peek(2).type === T.COLON) return true;
    if (nextTok.type === T.IDENT && peek(2).type === T.COLON && peek(3).type === T.IDENT && (peek(4).type === T.COLON || peek(4).type === T.PERIOD && peek(6).type === T.COLON)) return true;
    if (nextTok.type !== T.IDENT) return false;
    if (nomsVariables.has(nextTok.value) && peek(2).type === T.PERIOD && peek(3).type === T.IDENT && peek(4).type === T.COLON) return true;
    return sacBienForme();
  }
  function sacBienForme() {
    if (!at(T.LPAREN)) return false;
    let j = pos + 1;
    if (!tokens[j] || tokens[j].type === T.RPAREN) return false;
    while (j < tokens.length) {
      if (tokens[j].type === T.STAR && tokens[j + 1] && tokens[j + 1].type === T.COLON) {
        j += 2;
      } else if (tokens[j].type === T.IDENT && tokens[j + 1] && tokens[j + 1].type === T.COLON && tokens[j + 2] && tokens[j + 2].type === T.IDENT) {
        const apres = tokens[j + 3] && tokens[j + 3].type === T.PERIOD && tokens[j + 4] && (tokens[j + 4].type === T.IDENT || tokens[j + 4].type === T.INT) ? tokens[j + 5] : tokens[j + 3];
        if (apres && apres.type === T.COLON) j += 2;
      }
      if (!tokens[j] || tokens[j].type !== T.IDENT) return false;
      j++;
      if (tokens[j] && tokens[j].type === T.PERIOD && tokens[j + 1] && (tokens[j + 1].type === T.INT || tokens[j + 1].type === T.IDENT)) j += 2;
      if (tokens[j] && tokens[j].type === T.COLON) {
        j++;
        let prof = 0;
        while (j < tokens.length) {
          const t = tokens[j].type;
          if (t === T.NEWLINE || t === T.EOF) return false;
          if (t === T.LPAREN) prof++;
          else if (t === T.RPAREN) {
            if (prof === 0) break;
            prof--;
          } else if (t === T.COMMA && prof === 0) break;
          j++;
        }
      }
      if (!tokens[j]) return false;
      if (tokens[j].type === T.RPAREN) return true;
      if (tokens[j].type !== T.COMMA) return false;
      j++;
    }
    return false;
  }
  function isRuntimeQualifierLoose() {
    return sacBienForme();
  }
  function readIntervalLiteral(ctrlName) {
    const startTok = current();
    const bad = (why) => {
      throw new ParseError(
        `Intervalle malforme pour '${ctrlName}'${why ? " : " + why : ""} \u2014 attendu une fraction (3/2), des cents (700c) ou un decimal (1.5)`,
        startTok
      );
    };
    let neg = "";
    if (at(T.REST)) {
      advance();
      neg = "-";
    }
    if (at(T.STRING)) {
      throw new ParseError(
        `Intervalle entre guillemets non supporte pour '${ctrlName}' : ecris la forme NUE '${current().value}' (sans guillemets) \u2014 un intervalle se note fraction (3/2), cents (700c) ou decimal (1.5)`,
        startTok
      );
    }
    if (!at(T.INT) && !at(T.FLOAT)) bad(`'${current().value ?? current().type}' n'est pas un nombre`);
    const a = advance().value;
    if (at(T.SLASH)) {
      if (neg) bad("une fraction ne se note pas negative (utilise des cents : -700c)");
      advance();
      if (!at(T.INT)) bad("denominateur de fraction manquant");
      const b = advance().value;
      return `${a}/${b}`;
    }
    if (at(T.IDENT) && current().value === "c") {
      advance();
      return `${neg}${a}c`;
    }
    if (at(T.IDENT)) bad(`unite inconnue '${current().value}' (les cents s'ecrivent 700c)`);
    return `${neg}${a}`;
  }
  function parseRuntimeQualifier() {
    expect(T.LPAREN);
    const pairs = [];
    const finirTerme = () => {
      if (at(T.COMMA)) {
        advance();
        return;
      }
      if (!enDeclaratif) return;
      let k = 0;
      while (peek(k).type === T.NEWLINE || peek(k).type === T.COMMENT) k++;
      if (peek(k).type === T.RPAREN || peek(k).type === T.EOF) return;
      if (peek(k).spaceBefore === false && peek(k).type !== T.NEWLINE) {
        throw new ParseError(
          `le signe '${peek(k).value ?? peek(k).type}' n'est pas lisible dans un membre : un membre est un nom, un nombre ou un texte entre guillemets. Les membres deja lus sont '${pairs.map((p) => p.key).join(", ")}'.`,
          peek(k)
        );
      }
      throw new ParseError(
        `deux termes sont separes par une espace : avant le delimiteur, seule la virgule separe \u2014 l'espace n'y separe rien, il est de la mise en forme. Ecris '${pairs.map((p) => p.key).join(", ")}, ${peek(k).value ?? ""}'.`,
        peek(k)
      );
    };
    while (!at(T.RPAREN) && !atEnd()) {
      while (at(T.NEWLINE) || at(T.COMMENT)) advance();
      if (at(T.RPAREN) || atEnd()) break;
      let subject = null;
      if (at(T.STAR) && peek(1).type === T.COLON) {
        subject = "*";
        advance();
        advance();
      } else if (at(T.IDENT) && peek(1).type === T.COLON && peek(2).type === T.IDENT && (peek(3).type === T.COLON || peek(3).type === T.PERIOD && peek(5).type === T.COLON)) {
        subject = current().value;
        advance();
        advance();
      }
      const keyTok = current();
      if (at(T.STRING) && (peek(1).type === T.COLON || peek(1).type === T.LPAREN)) {
      } else if (!at(T.IDENT) && (at(T.INT) || at(T.FLOAT) || at(T.STRING) || at(T.REST) && (peek(1).type === T.INT || peek(1).type === T.FLOAT) && !peek(1).spaceBefore)) {
        const signe = at(T.REST) ? advance().value : "";
        const t = advance();
        let mot = signe + t.value;
        if (t.type !== T.STRING) {
          while ((at(T.IDENT) || at(T.INT) || at(T.FLOAT) || at(T.REST) || at(T.SLASH)) && !current().spaceBefore) {
            mot += String(advance().value);
          }
        }
        pairs.push({
          key: mot,
          value: true,
          ...t.type === T.STRING ? { texte: true } : {},
          ...subject !== null ? { subject } : {},
          line: keyTok.line,
          col: keyTok.col
        });
        finirTerme();
        continue;
      }
      let key = at(T.STRING) && (peek(1).type === T.COLON || peek(1).type === T.LPAREN) ? advance().value : expect(T.IDENT).value;
      let libDuReglage = null;
      if (at(T.PERIOD) && peek(1).type === T.IDENT && !nomsVariables.has(key) && Object.prototype.hasOwnProperty.call(
        libCtx.controlsQualified || {},
        `${key}.${peek(1).value}`
      )) {
        libDuReglage = key;
        advance();
        key = advance().value;
      }
      refuserTempx(key, keyTok, "(");
      const pos2 = { line: keyTok.line, col: keyTok.col };
      const sub = { ...subject !== null ? { subject } : {}, ...libDuReglage ? { lib: libDuReglage } : {} };
      if (at(T.LPAREN) && !current().spaceBefore) {
        pairs.push({ key, value: parseRuntimeQualifier(), ...sub, ...pos2 });
        finirTerme();
        continue;
      }
      if (at(T.PERIOD) && universeComponentControls().has(key)) {
        advance();
        if (!at(T.INT)) {
          throw new ParseError(
            `'${key}.\u2026' d\xE9signe un composant NUM\xC9ROT\xC9 : il attend un num\xE9ro, pas '${current().value}' (exemple : '(${key}.98:45)'). Les contr\xF4leurs qui ont un nom s'\xE9crivent par leur nom`,
            current()
          );
        }
        const component = Number(advance().value);
        if (!at(T.COLON)) {
          throw new ParseError(
            `'${key}.${component}' d\xE9signe un composant sans lui affecter de valeur \u2014 il manque ':valeur' (exemple : '(${key}.${component}:45)')`,
            current()
          );
        }
        advance();
        if (current().spaceBefore) {
          throw new ParseError(
            `'${key}.${component}: ' \u2014 pas d'espace apr\xE8s le deux-points : la valeur commence imm\xE9diatement ('${key}.${component}:${current().value}')`,
            current()
          );
        }
        let valeur;
        if (at(T.REST)) {
          advance();
          valeur = -Number(expect(T.INT).value);
        } else if (at(T.INT) || at(T.FLOAT)) valeur = Number(advance().value);
        else valeur = expect(T.IDENT).value;
        pairs.push({ key, component, value: valeur, ...sub, ...pos2 });
        finirTerme();
        continue;
      }
      if (at(T.PERIOD) && nomsVariables.has(key) && peek(1).type === T.IDENT && peek(2).type === T.COLON) {
        advance();
        const composant = advance().value;
        advance();
        if (current().spaceBefore) {
          throw new ParseError(
            `'${key}.${composant}: ' \u2014 pas d'espace apr\xE8s le deux-points : la valeur commence imm\xE9diatement ('${key}.${composant}:${current().value}')`,
            current()
          );
        }
        let valeur;
        if (at(T.REST)) {
          advance();
          valeur = -Number(expect(T.INT).value);
        } else if (at(T.INT) || at(T.FLOAT)) valeur = Number(advance().value);
        else valeur = expect(T.IDENT).value;
        pairs.push({ key, component: composant, value: valeur, ...sub, ...pos2 });
        finirTerme();
        continue;
      }
      if (at(T.PERIOD) && peek(1).type === T.IDENT && peek(2).type === T.COLON) {
        const composant = peek(1).value;
        const prefixesConnus = new Set(
          Object.keys(libCtx.controlsQualified || {}).map((q) => q.slice(0, q.indexOf(".")))
        );
        if (prefixesConnus.has(key)) {
          const estControle = (libCtx.controlNames || /* @__PURE__ */ new Set()).has(composant);
          if (!estControle && (libCtx.reservedDirectiveNames || /* @__PURE__ */ new Set()).has(composant)) {
            throw new ParseError(
              `'${key}.${composant}:\u2026' \u2014 '${composant}' est une directive de SC\xC8NE : elle s'\xE9crit en t\xEAte, avant le d\xE9limiteur, jamais dans une parenth\xE8se. Le pr\xE9fixe n'y change rien, '${composant}:\u2026' nu y est refus\xE9 aussi.`,
              keyTok
            );
          }
          throw new ParseError(
            `'${key}.${composant}:\u2026' \u2014 la librairie '${key}' ne d\xE9clare aucun contr\xF4le '${composant}'. Le pr\xE9fixe est bon, le contr\xF4le n'est pas chez lui.`,
            keyTok
          );
        }
        const motsInvoques = /* @__PURE__ */ new Set();
        for (const [fichier, lib] of Object.entries(libCtx._libs || {})) {
          motsInvoques.add(fichier);
          if (lib && typeof lib.resolves === "string" && lib.resolves) motsInvoques.add(lib.resolves);
        }
        if (motsInvoques.has(key)) {
          throw new ParseError(
            `'${key}.${composant}:\u2026' \u2014 la librairie '${key}' est bien invoqu\xE9e, et elle ne d\xE9clare AUCUN contr\xF4le : rien ne s'y affecte par une parenth\xE8se. Le pr\xE9fixe est bon, la librairie n'est pas de celles qui portent des contr\xF4les.`,
            keyTok
          );
        }
        throw new ParseError(
          `'${key}.${composant}:\u2026' affecte une valeur au composant '${composant}' de '${key}' \u2014 mais '${key}' n'est ni une librairie invoqu\xE9e, ni un contr\xF4le \xE0 composants, ni une instance d\xE9clar\xE9e dans cette sc\xE8ne. D\xE9clarer l'instance d'abord : '<module> ${key}'`,
          keyTok
        );
      }
      if (at(T.PERIOD)) {
        advance();
        const name = expect(T.IDENT).value;
        pairs.push({ key: `${key}.${name}`, value: true, reference: true, ...sub, ...pos2 });
        finirTerme();
        continue;
      }
      if (at(T.COLON)) {
        advance();
        if (!at(T.RPAREN) && !atEnd() && current().spaceBefore) {
          throw new ParseError(
            `'${key}: ' \u2014 pas d'espace apr\xE8s le deux-points : la valeur commence imm\xE9diatement ('${key}:${current().value}\u2026'). L'espace ne s\xE9pare que les PARTIES d'une valeur`,
            current()
          );
        }
        const specReglage = universeSacs().specs && universeSacs().specs[key];
        const reglageMultiPartie = specReglage && Array.isArray(specReglage.args) && specReglage.args.length > 1;
        if (libCtx.qualifierKeys.has(key) && !reglageMultiPartie) {
          const { value, decrement } = readQualifierValue();
          if (value === void 0) {
            const exemple = specReglage && Array.isArray(specReglage.values) && specReglage.values[0] || "\u2026";
            throw new ParseError(
              `'(${key}:)' n'affecte aucune valeur \u2014 le deux-points en attend une (par exemple '(${key}:${exemple})')`,
              keyTok
            );
          }
          if (at(T.IDENT) && peek(1).type === T.COLON) {
            throw new ParseError(
              `'(${key}:\u2026 ${current().value}:\u2026)' : deux \xC9L\xC9MENTS du sac s\xE9par\xE9s par une ESPACE \u2014 il leur manque une VIRGULE ('(${key}:\u2026, ${current().value}:\u2026)'). L'espace ne s\xE9pare que les PARTIES d'une m\xEAme valeur`,
              current()
            );
          }
          pairs.push({ key, value, decrement, ...sub, ...pos2 });
          finirTerme();
          continue;
        }
        if (libCtx.intervalControls && libCtx.intervalControls.has(key) || universeIntervalControls().has(key)) {
          pairs.push({ key, value: readIntervalLiteral(key), ...sub, ...pos2 });
          finirTerme();
          continue;
        }
        const specCle = libCtx.controls && libCtx.controls[key] || null;
        const monoPartie = specCle && Array.isArray(specCle.args) && specCle.args.length === 1;
        const parts = [];
        let deuxPointsEnTrop = null;
        let elementAvale = null;
        let jetons = 0;
        let texteSeul = null;
        let backtickSeul = null;
        while (!at(T.RPAREN) && !at(T.COMMA) && !atEnd()) {
          if (monoPartie && parts.length > 0 && at(T.IDENT) && libCtx.controlNames.has(current().value)) {
            elementAvale = current();
            break;
          }
          if (at(T.COLON) && !deuxPointsEnTrop) deuxPointsEnTrop = current();
          if (parts.length > 0 && current().spaceBefore) {
            if (enDeclaratif) {
              throw new ParseError(
                `'${key}:${parts.join("")} ${current().value}\u2026' : dans la partie D\xC9CLARATIVE, seule la virgule s\xE9pare \u2014 l'espace n'y s\xE9pare rien. Une valeur n'a qu'UNE partie ; plusieurs parties sont plusieurs valeurs, et elles s'\xE9crivent par une parenth\xE8se et des noms : '${key}(${parts.join("")}, ${current().value}\u2026)'. Dans le FLUX, apr\xE8s le d\xE9limiteur, l'espace s\xE9pare les termes comme avant.`,
                current()
              );
            }
            parts.push(" ");
          }
          texteSeul = jetons === 0 && at(T.STRING) ? current().value : null;
          backtickSeul = jetons === 0 && at(T.BACKTICK) ? current().value : null;
          jetons++;
          parts.push(advance().value);
        }
        const brut = parts.join("");
        if (enDeclaratif && (brut === "required" || brut === "many")) {
          throw new ParseError(
            `'${key}:${brut}' : '${brut}' est SORTI du langage (d\xE9cision Romain, 2026-08-20) \u2014 l'obligation se lit de l'ABSENCE de d\xE9faut, la multiplicit\xE9 de l'EXEMPLAIRE. \xC9crire '${key}' seul pour un membre obligatoire, ou '${key}()' pour une collection obligatoire ; une valeur donn\xE9e apr\xE8s ':' en fait un membre optionnel dont elle est le d\xE9faut.`,
            current()
          );
        }
        if (elementAvale) {
          throw new ParseError(
            `'(${key}:${brut} ${elementAvale.value}\u2026)' : '${key}' n'attend qu'UNE valeur, donc '${elementAvale.value}' est un autre \xC9L\xC9MENT du sac \u2014 il lui manque sa VIRGULE ('${key}:${brut}, ${elementAvale.value}\u2026'). L'espace ne s\xE9pare que les PARTIES d'une m\xEAme valeur`,
            elementAvale
          );
        }
        if (deuxPointsEnTrop) {
          throw new ParseError(
            `'(${key}:${brut})' : le deux-points AFFECTE une valeur, il n'en s\xE9pare pas les parties \u2014 une paire n'en porte qu'un. Pour d\xE9signer un composant num\xE9rot\xE9, le point l'appelle ('(${key}.${brut.split(":")[0]}:${brut.split(":").slice(1).join(":")})') ; pour plusieurs parties, l'espace les s\xE9pare`,
            deuxPointsEnTrop
          );
        }
        if (jetons === 0) {
          throw new ParseError(
            `'(${key}:)' n'affecte aucune valeur \u2014 le deux-points en attend une (par exemple '(${key}:80)'), et un contr\xF4le sans argument s'\xE9crit nu, sans deux-points. Un texte VIDE s'\xE9crit '${key}:""' : le d\xE9limiteur, sans rien dedans`,
            keyTok
          );
        }
        let val;
        if (jetons === 1 && backtickSeul !== null) {
          const t = tryBacktickTag(backtickSeul);
          val = !t ? backtickSeul : { type: "BacktickInline", code: t.code, tag: t.tag };
        } else {
          val = texteSeul !== null && jetons === 1 ? texteSeul : /^-?\d+(\.\d+)?$/.test(brut) ? Number(brut) : brut;
        }
        const valeurEstUnTexte = texteSeul !== null && jetons === 1;
        if (isNoArgControl(key)) {
          throw new ParseError(
            `'(${key}:${brut})' : '${key}' ne prend AUCUN argument \u2014 sa d\xE9claration n'en nomme pas. \xC9crire '${key}' seul. Une valeur pos\xE9e ici voyagerait jusqu'au runtime sans destinataire, sans que rien ne signale qu'elle ne sert \xE0 rien.`,
            keyTok
          );
        }
        pairs.push({ key, value: val, ...valeurEstUnTexte ? { texte: true } : {}, ...sub, ...pos2 });
      } else {
        pairs.push({ key, value: true, ...sub, ...pos2 });
      }
      finirTerme();
    }
    expect(T.RPAREN);
    return { type: "SettingBag", pairs };
  }
  function isPerElementQualifier() {
    if (!at(T.LBRACKET)) return false;
    const nextTok = peek(1);
    if (nextTok.type !== T.IDENT) return false;
    return libCtx.controlNames.has(nextTok.value);
  }
  function refuserSuffixeArobase() {
    if (!at(T.AT) || current().spaceBefore) return;
    const nom = peek(1).type === T.IDENT ? peek(1).value : "nom";
    throw new ParseError(
      `le suffixe '${nom}' coll\xE9 \xE0 un \xE9l\xE9ment est SUPPRIM\xC9 du langage (d\xE9cision Romain 2026-07-28). Deux \xE9critures le remplacent, selon ce qu'on voulait faire. Pour ASSOCIER un geste \xE0 un \xE9l\xE9ment DANS LA PRODUCTION : le point d'exclamation, 'C4!${nom}' \u2014 le geste se d\xE9clenche \xE0 l'instant du terminal sans occuper de pas. Pour D\xC9CLARER UNE \xC9TIQUETTE : la partie d\xE9clarative, par 'def'.`,
      current()
    );
  }
  function parseRhsElement() {
    const tok = current();
    if (at(T.REST)) {
      advance();
      return { type: "Rest" };
    }
    if (at(T.PROLONG)) {
      if (peek(1).type === T.IDENT && peek(2).type === T.LPAREN && !peek(1).spaceBefore) {
        const nom = peek(1).value;
        const cle = Object.keys(libCtx.controls || {}).find((k) => libCtx.controls[k].bp3 === `_${nom}`) || nom;
        const renomme = cle !== nom;
        throw new ParseError(
          `la graphie \xAB _${nom}(\u2026) \xBB est celle du moteur natif BP3, elle n'appartient pas \xE0 BPScript \u2014 \xE9crire \xAB !(${cle}:\u2026) \xBB \xE0 la place` + (renomme ? ` (le \xAB _${nom} \xBB natif se dit \xAB ${cle} \xBB en BPScript, et la cl\xE9 \xAB ${nom} \xBB d\xE9signe un AUTRE geste)` : ""),
          peek(1)
        );
      }
      advance();
      return { type: "Prolongation" };
    }
    if (at(T.UNDETERMINED)) {
      advance();
      return { type: "UndeterminedRest" };
    }
    if (at(T.COMPOUND)) {
      const t = advance();
      return { type: "Symbol", name: t.value, compose: t.parties || [], line: t.line };
    }
    if (at(T.PERIOD)) {
      advance();
      return { type: "Period" };
    }
    if (at(T.IDENT) && peek(1).type === T.COLON && peek(2).type === T.LBRACE) {
      const label = advance().value;
      advance();
      if (hasMatchingBrace()) {
        return parsePolymetric(label);
      }
      return { type: "Symbol", name: normalizeName(label), line: tok.line };
    }
    if (at(T.LBRACE)) {
      if (hasMatchingBrace()) {
        return parsePolymetric(null);
      }
      advance();
      return { type: "RawBrace", value: "{" };
    }
    if (at(T.PIPE)) {
      return parseVariable();
    }
    if (at(T.QUESTION)) {
      return parseWildcard();
    }
    if (at(T.DOLLAR)) {
      return parseTemplateMaster();
    }
    if (at(T.AMPERSAND)) {
      return parseTemplateSlave();
    }
    if (at(T.TILDE)) {
      advance();
      if (at(T.IDENT)) {
        const name = advance().value;
        if (at(T.TILDE)) {
          advance();
          return { type: "TieContinue", symbol: name };
        }
        return { type: "TieEnd", symbol: name };
      }
      throw new ParseError("Expected symbol after ~", tok);
    }
    if (at(T.BANG)) {
      const OUVRANTS = /* @__PURE__ */ new Set([
        T.LBRACE,
        T.LPAREN,
        T.LBRACKET,
        T.COMMA,
        T.ARROW_R,
        T.ARROW_L,
        T.ARROW_BI,
        T.NEWLINE
      ]);
      for (const t of OUVRANTS) if (t === void 0) throw new Error("OUVRANTS porte un type de jeton inexistant");
      const precedent = peek(-1);
      const collated = !current().spaceBefore && precedent !== void 0 && !OUVRANTS.has(precedent.type);
      advance();
      if (at(T.LPAREN) && (peek(1).type === T.SLASH || peek(1).type === T.STAR && peek(2).type !== T.COLON)) {
        if (collated) {
          throw new ParseError(
            `'!(\u2026)' coll\xE9 \xE0 un terme porte un flux CONJOINT, qui voyage avec ce terme et se r\xE9plique avec lui \u2014 une vitesse ne fait ni l'un ni l'autre : elle court \xE0 partir d'o\xF9 elle est pos\xE9e jusqu'\xE0 la fin du champ. Elle se d\xE9tache par une espace : '\u2026 ! (${peek(1).type === T.STAR ? "*N/M" : "/N"})'`,
            current()
          );
        }
        return { type: "InstantControl", qualifier: parseVitesseParenthese(), conjoint: false };
      }
      if (sacBienForme()) {
        return { type: "InstantControl", qualifier: parseRuntimeQualifier(), conjoint: collated };
      }
      if (at(T.LBRACKET) && peek(1).type === T.IDENT) {
        const nom = peek(1).value;
        const CROCHET_EN_FLUX = /* @__PURE__ */ new Set(["seed"]);
        if (CROCHET_EN_FLUX.has(nom) && !directiveDeclareeParLaLibrairie("engine", nom)) {
          throw new ParseError(
            `'![${nom}:\u2026]' : '${nom}' n'est plus d\xE9clar\xE9 par la librairie 'engine'. La re-semence en flux traduit le '_srand(N)' natif, et le mot qui la porte vient d'une librairie comme tous les autres.`,
            current()
          );
        }
        if (CROCHET_EN_FLUX.has(nom)) {
          const ouvre = current();
          advance();
          advance();
          let value = null, runtime = null;
          if (at(T.COLON)) {
            advance();
            ({ value, runtime } = parseDirectiveColonValue("seed"));
          }
          expect(T.RBRACKET);
          const dirs = [{
            type: "Directive",
            name: "seed",
            subkey: null,
            runtime,
            value,
            aliases: null,
            modifiers: null,
            line: ouvre.line
          }];
          return { type: "InstantControl", qualifier: { type: "ProductionInline", directives: dirs } };
        }
      }
      if (at(T.LBRACKET) && peek(1).type === T.AT) {
        const ouvre = current();
        const nom = peek(2).type === T.IDENT ? peek(2).value : "\u2026";
        if (nom === "seed") {
          throw new ParseError(
            `'![seed:N]' : la re-semence dans le flux s'\xE9crit SANS arobase \u2014 '![seed:N]'. Le crochet porte ce qui gouverne la d\xE9rivation, et une re-semence en est une proc\xE9dure ; l'arobase reste \xE0 la t\xEAte de sc\xE8ne, o\xF9 'seed:N' r\xE8gle la production.`,
            ouvre
          );
        }
        throw new ParseError(
          `'![${nom}\u2026]' : seule la re-semence a un sens dans le flux, et elle s'\xE9crit '![seed:N]' ; '${nom}' se pose en t\xEAte de sc\xE8ne, '${nom}'.`,
          ouvre
        );
      }
      if (at(T.LBRACKET)) {
        const q = parseQualifier("relative");
        const procedure = (q.pairs || []).find((p) => p && universeRuleScopeControls().has(p.key));
        if (procedure) {
          throw new ParseError(
            `'![${procedure.key}: \u2026]' : '${procedure.key}' est une proc\xE9dure de niveau R\xC8GLE, elle ne se pose pas dans le flux \u2014 elle vaut pour la r\xE8gle enti\xE8re. \xC9crire '[${procedure.key}:${procedure.value === true ? "\u2026" : procedure.value}]' en suffixe de r\xE8gle. Dans le flux, elle n'atteint jamais la r\xE8gle et laisse un jeton de contr\xF4le inerte dans la production`,
            current()
          );
        }
        throw new ParseError(
          `un crochet ne se pose PAS dans le flux (d\xE9cision Romain 2026-08-08) : le crochet gouverne la D\xC9RIVATION \u2014 une garde, une affectation de drapeau, une proc\xE9dure, un rang de gabarit \u2014 et rien de cela ne vaut \xE0 un instant. Un contr\xF4le pos\xE9 dans le flux s'\xE9crit entre PARENTH\xC8SES : '!(shuffle)', '!(retro)', '!(vel:80)'. (Seule '![seed:N]' reste, parce qu'elle re-s\xE8me la production et non la d\xE9rivation.)`,
          current()
        );
      }
      if (at(T.IDENT)) {
        const name = advance().value;
        return { type: "OutTimeObject", name };
      }
      throw new ParseError("Expected symbol, (...) or [...] after !", current());
    }
    if (at(T.TRIGGER_IN)) {
      return parseWait();
    }
    if (at(T.HASH)) {
      return parseContext();
    }
    if (at(T.BACKTICK)) {
      const raw = advance().value;
      const t = tryBacktickTag(raw);
      if (t) return { type: "BacktickStandalone", tag: t.tag, code: t.code, line: tok.line };
      return { type: "BacktickInline", code: raw, tag: null, line: tok.line };
    }
    if (at(T.INT) && !isSymbolCallAhead()) {
      const num = Number(advance().value);
      if (at(T.SLASH) && peek(1).type === T.INT) {
        advance();
        const denom = Number(advance().value);
        return { type: "NumericDuration", numerator: num, denominator: denom };
      }
      return { type: "NumericTerminal", kind: "numeric-terminal", value: num, line: tok.line };
    }
    if (at(T.IDENT)) {
      let name = advance().value;
      let actor = null;
      if (at(T.PERIOD) && !current().spaceBefore && peek(1).type === T.BACKTICK && (libCtx.actors && libCtx.actors[name] || acteursDeclares.has(name))) {
        advance();
        const raw = advance().value;
        const t = tryBacktickTag(raw);
        return t ? { type: "BacktickStandalone", tag: t.tag, code: t.code, actor: name, line: tok.line } : { type: "BacktickInline", code: raw, tag: null, actor: name, line: tok.line };
      }
      const gluedMember = at(T.PERIOD) && !current().spaceBefore && peek(1).type === T.IDENT;
      const knownActor = gluedMember && (libCtx.actors && libCtx.actors[name] || acteursDeclares.has(name));
      const opaqueComponent = gluedMember && !knownActor && !peek(1).spaceBefore;
      let componentOpaque = false;
      if (knownActor || opaqueComponent) {
        advance();
        actor = name;
        name = advance().value;
        componentOpaque = opaqueComponent;
      }
      if (componentOpaque && at(T.COLON) && !current().spaceBefore) {
        advance();
        const value = lireValeurDeMembre();
        return { type: "Symbol", name: normalizeName(name), line: tok.line, actor, value };
      }
      if (at(T.COLON) && !current().spaceBefore && estNombreDeDuree(peek(1))) {
        advance();
        const dur = parseColonFrame(tok);
        const sym = { type: "Symbol", name: normalizeName(name), line: tok.line, ...actor ? { actor } : {} };
        return cadreDuree(dur, [sym]);
      }
      if (at(T.TILDE)) {
        advance();
        return { type: "TieStart", symbol: name, ...actor ? { actor } : {} };
      }
      if (!actor && at(T.LPAREN) && isControlName(name)) {
        throw new ParseError(refusFormeAppel(name), tok);
      }
      if (!actor && !at(T.LPAREN) && isControlName(name) && libCtx.bagOnlyControls && libCtx.bagOnlyControls.has(name) && !nomsDeclaresLocalement.has(name)) {
        const portees = libCtx.controls?.[name]?.scope;
        const listePortees = Array.isArray(portees) ? portees : portees ? [portees] : [];
        const OU = {
          scene: "en t\xEAte de sc\xE8ne",
          subgrammar: "en t\xEAte de sous-grammaire",
          rule: "en suffixe de r\xE8gle",
          group: "sur un groupe",
          symbol: "sur un \xE9l\xE9ment",
          flow: "dans le flux"
        };
        const places = listePortees.map((p) => OU[p] || p);
        const commentEcrire = listePortees.includes("flow") ? `\xE9crire '!(${name})' pour le poser au fil de la s\xE9quence` : places.length ? `sa d\xE9claration ne lui donne que ${places.length > 1 ? "ces places" : "cette place"} : ${places.join(", ")}` : `sa d\xE9claration ne lui donne aucune place dans une r\xE8gle`;
        throw new ParseError(
          `'${name}' n'a pas de forme nue dans le flux \u2014 ${commentEcrire}. Un mot du vocabulaire rencontr\xE9 l\xE0 o\xF9 il ne peut pas l'\xEAtre refuse ; il ne dispara\xEEt pas.`,
          tok
        );
      }
      if (!actor && !at(T.LPAREN) && isControlName(name) && isNoArgControl(name)) {
        if (nomsDeclaresLocalement.has(name)) {
          warn(`'${name}' est d\xE9clar\xE9 par la sc\xE8ne ET port\xE9 par le vocabulaire comme contr\xF4le sans argument \u2014 la d\xE9claration de la sc\xE8ne l'emporte, le mot reste un symbole ici. Pour le contr\xF4le, \xE9crire '(${name})' ou '!(${name})'.`, tok.line);
        } else {
          return { type: "Control", name, args: [] };
        }
      }
      if (at(T.LPAREN) && !current().spaceBefore && !isContextLookahead() && !estUneDefinitionDeclaree(name)) {
        if (!sacBienForme()) {
          if (isControlName(name)) throw new ParseError(refusFormeAppel(name), tok);
          throw new ParseError(
            `'${name}(${texteDuSac()})' n'est lisible ni comme un SAC DE R\xC9GLAGES \u2014 son contenu n'est pas fait de paires 'cl\xE9:valeur' \u2014 ni comme un APPEL : appeler exige une d\xE9finition d\xE9clar\xE9e, et aucune ne porte le nom '${name}'. Pour r\xE9gler '${name}', \xE9crire '${name}(cl\xE9:valeur)' ; pour l'appeler, le d\xE9clarer d'abord avec 'def ${name}(x) \u2026'`,
            tok
          );
        }
        return { type: "Symbol", name: normalizeName(name), line: tok.line, ...actor ? { actor } : {} };
      }
      if (at(T.LPAREN) && !current().spaceBefore && !isContextLookahead()) {
        const node = parseSymbolCall(name, tok);
        if (actor) poserActeur(node, actor);
        return node;
      }
      if (at(T.BANG) && peek(1).type !== T.LPAREN && peek(1).type !== T.LBRACKET) {
        const node = parseSimultaneousGroup(name, tok);
        if (actor) poserActeur(node, actor);
        return node;
      }
      if (at(T.TRIGGER_IN)) {
        const triggerIns = [];
        while (at(T.TRIGGER_IN)) {
          triggerIns.push(parseWait());
        }
        return {
          type: "SymbolWithWait",
          symbol: { type: "Symbol", name: normalizeName(name), line: tok.line, ...actor ? { actor } : {} },
          triggers: triggerIns
        };
      }
      if (!actor && at(T.LPAREN) && isControlName(name)) {
        throw new ParseError(refusFormeAppel(name), tok);
      }
      return { type: "Symbol", name: normalizeName(name), line: tok.line, ...actor ? { actor } : {} };
    }
    return null;
  }
  function isSymbolCallAhead() {
    return false;
  }
  function isNoArgControl(name) {
    return libCtx.noArgControls.has(name);
  }
  function refusFormeAppel(name) {
    const moteur = libCtx.bp3NativeControls && libCtx.bp3NativeControls.has(name) && !(libCtx.dispatcherOnlyControls && libCtx.dispatcherOnlyControls.has(name));
    const cible = moteur ? `![${name}:\u2026]` : `!(${name}:\u2026)`;
    return `la forme d'appel '${name}(${texteDuSac()})' n'existe pas en BPScript (supprim\xE9e le 2026-07-26) \u2014 \xE9crire '${cible}' pour le poser dans le flux, ou '${moteur ? `[${name}:\u2026]` : `(${name}:\u2026)`}' en contenance. Les deux points AFFECTENT la valeur, l'espace en s\xE9pare les parties ('[goto:3 0]'), la virgule s\xE9pare les \xE9l\xE9ments du sac ('(vel:80, pan:64)')`;
  }
  function isControlName(name) {
    return libCtx.controlNames.has(name);
  }
  function refuserCrochetColle() {
    parseQualifier();
    throw new ParseError(
      `un crochet COLL\xC9 \xE0 un \xE9l\xE9ment n'existe plus (d\xE9cision Romain 2026-08-08) : le crochet gouverne la D\xC9RIVATION \u2014 un test de drapeau, une affectation, une proc\xE9dure ('[goto:\u2026]', '[repeat:\u2026]', '[failed:\u2026]', '[stop]'), un rang de gabarit \u2014 et aucune de ces places n'est un suffixe d'\xE9l\xE9ment. Un sac coll\xE9 s'\xE9crit entre PARENTH\xC8SES : '\u2026(shuffle)', '\u2026(retro)', '\u2026(vel:80)'.`,
      current()
    );
  }
  function refuserSecondSac(rang, el) {
    if (rang < 2) return;
    const nom = el && (el.name || el.symbol) ? `'${el.name || el.symbol}'` : "cet \xE9l\xE9ment";
    throw new ParseError(
      `${nom} porte DEUX sacs de r\xE9glages coll\xE9s \u2014 un \xE9l\xE9ment n'en porte qu'un. R\xE9unir les paires dans le m\xEAme sac : la virgule les s\xE9pare, '(cl\xE9:valeur, cl\xE9:valeur)'. Les deux \xE9critures disaient d\xE9j\xE0 la m\xEAme chose ; celle-ci n'en est plus une (d\xE9cision Romain 2026-08-08).`,
      current()
    );
  }
  function estUneDefinitionDeclaree(name) {
    return definitionsDeclarees.has(name);
  }
  function texteDuSac() {
    if (!at(T.LPAREN)) return "";
    let j = pos + 1, profondeur = 1;
    const morceaux = [];
    while (j < tokens.length && profondeur > 0) {
      const t = tokens[j];
      if (t.type === T.LPAREN) profondeur++;
      else if (t.type === T.RPAREN) {
        profondeur--;
        if (!profondeur) break;
      } else if (t.type === T.NEWLINE || t.type === T.EOF) break;
      morceaux.push((t.spaceBefore && morceaux.length ? " " : "") + (t.value ?? ""));
      j++;
    }
    return morceaux.join("");
  }
  function atRhsElementStart() {
    const t = current().type;
    return t === T.IDENT || t === T.LBRACE || t === T.REST || t === T.PROLONG || t === T.UNDETERMINED || t === T.PERIOD || t === T.PIPE || t === T.QUESTION || t === T.DOLLAR || t === T.AMPERSAND || t === T.TILDE || t === T.BANG || t === T.TRIGGER_IN || t === T.HASH || t === T.BACKTICK || t === T.INT;
  }
  function parseSymbolCall(name, tok) {
    expect(T.LPAREN);
    const args = [];
    while (!at(T.RPAREN) && !atEnd()) {
      let key = null;
      if (at(T.IDENT) && peek(1).type === T.COLON) {
        key = advance().value;
        advance();
      }
      let value;
      const intervalHere = key && universeIntervalControls().has(key) || !key && universeIntervalControls().has(name);
      if (intervalHere) {
        value = { type: "Literal", value: readIntervalLiteral(key || name) };
      } else if (at(T.BACKTICK)) {
        const raw = advance().value;
        const t = tryBacktickTag(raw);
        value = t ? { type: "BacktickInline", code: t.code, tag: t.tag } : { type: "BacktickInline", code: raw, tag: null };
      } else if (at(T.INT)) {
        const n = advance().value;
        if (at(T.SLASH) && peek(1).type === T.INT) {
          advance();
          value = { type: "Literal", value: `${n}/${advance().value}` };
        } else {
          value = { type: "Literal", value: Number(n) };
        }
      } else if (at(T.FLOAT)) {
        value = { type: "Literal", value: Number(advance().value) };
      } else if (at(T.IDENT)) {
        let nom = advance().value;
        while (at(T.PERIOD) && peek(1).type === T.IDENT && !current().spaceBefore) {
          advance();
          nom += `.${advance().value}`;
        }
        value = { type: "Literal", value: nom };
      } else {
        throw new ParseError(`Expected argument value in '${name}(\u2026)'`, current());
      }
      args.push({ type: "Arg", key, value });
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);
    if (at(T.TILDE)) {
      advance();
      return { type: "TieStart", symbol: name, args };
    }
    if (at(T.BANG) && peek(1).type !== T.LPAREN && peek(1).type !== T.LBRACKET) {
      return parseSimultaneousGroup(name, tok, args);
    }
    return { type: "SymbolCall", name, args, line: tok.line };
  }
  function parseControl(name, tok) {
    expect(T.LPAREN);
    const args = [];
    if (universeIntervalControls().has(name)) {
      args.push(readIntervalLiteral(name));
      expect(T.RPAREN);
      return { type: "Control", name, args };
    }
    while (!at(T.RPAREN) && !atEnd()) {
      let arg = "";
      while (!at(T.RPAREN) && !at(T.COMMA) && !atEnd()) {
        const t = current();
        if (t.type === T.INT || t.type === T.FLOAT || t.type === T.IDENT) {
          if (arg.length > 0 && /[a-zA-Z0-9]$/.test(arg)) {
            throw new ParseError(
              `argument de contr\xF4le mal form\xE9 dans '${name}(\u2026)' : '${arg} ${t.value}' \u2014 deux valeurs se suivent sans s\xE9parateur. Un contr\xF4le prend des arguments s\xE9par\xE9s par ',' ; il ne prend pas de phrase (la fonction g\xE9n\xE9rique 'script(\u2026)' a \xE9t\xE9 supprim\xE9e du langage)`,
              t
            );
          }
          arg += advance().value;
        } else if (t.type === T.EQUALS) {
          if (arg.length > 0) arg += " ";
          arg += advance().value + " ";
        } else if (t.type === T.SLASH) {
          arg += advance().value;
        } else if (t.type === T.REST) {
          arg += advance().value;
        } else if (t.type === T.PLUS) {
          arg += advance().value;
        } else {
          if (arg.length === 0) {
            throw new ParseError(`Unexpected token ${t.type} (${t.value}) in control args`, t);
          }
          break;
        }
      }
      if (arg) args.push(arg);
      if (at(T.COMMA)) advance();
    }
    expect(T.RPAREN);
    return { type: "Control", name, args };
  }
  function envelopperEnAccord(el, tok) {
    if (!at(T.BANG) || peek(1).type === T.LPAREN || peek(1).type === T.LBRACKET) return el;
    return { type: "SimultaneousGroup", primary: el, secondaries: lireSecondaires(tok) };
  }
  function poserActeur(node, actor) {
    if (node && node.type === "SimultaneousGroup" && node.primary) {
      poserActeur(node.primary, actor);
      return;
    }
    if (node) node.actor = actor;
  }
  function parseSimultaneousGroup(primaryName, tok, primaryArgs = null) {
    let primary;
    if (primaryArgs) {
      primary = { type: "SymbolCall", name: primaryName, args: primaryArgs, line: tok.line };
    } else {
      primary = { type: "Symbol", name: normalizeName(primaryName), line: tok.line };
    }
    return { type: "SimultaneousGroup", primary, secondaries: lireSecondaires(tok) };
  }
  function lireSecondaires(tok) {
    const secondaries = [];
    while (at(T.BANG)) {
      advance();
      if (at(T.IDENT)) {
        let name = advance().value;
        let acteurSec = null;
        if (at(T.PERIOD) && !current().spaceBefore && peek(1) && peek(1).type === T.IDENT && (libCtx.actors && libCtx.actors[name] || acteursDeclares.has(name))) {
          advance();
          acteurSec = name;
          name = advance().value;
        }
        if (at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier()) {
          const sec = { type: "Symbol", name: normalizeName(name), line: tok.line, suffixQualifiers: [], ...acteurSec ? { actor: acteurSec } : {} };
          while (at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier()) {
            sec.suffixQualifiers.push(parseRuntimeQualifier());
          }
          secondaries.push(sec);
        } else if (at(T.LPAREN)) {
          secondaries.push(parseSymbolCall(name, tok));
        } else {
          secondaries.push({ type: "Symbol", name: normalizeName(name), line: tok.line, ...acteurSec ? { actor: acteurSec } : {} });
        }
        continue;
      }
      throw new ParseError("Expected symbol after !", current());
    }
    return secondaries;
  }
  function hasMatchingBrace() {
    let depth = 0;
    let j = pos;
    let afterNewline = false;
    while (j < tokens.length) {
      const t = tokens[j].type;
      if (t === T.LBRACE) depth++;
      if (t === T.RBRACE) {
        depth--;
        if (depth === 0) return true;
      }
      if (t === T.EOF || t === T.SEPARATOR) return false;
      if (t === T.NEWLINE) {
        afterNewline = true;
        j++;
        continue;
      }
      if (afterNewline) {
        if (t === T.IDENT) {
          let k = j + 1;
          while (k < tokens.length && tokens[k].type === T.IDENT) k++;
          if (k < tokens.length && (tokens[k].type === T.ARROW_R || tokens[k].type === T.ARROW_L || tokens[k].type === T.ARROW_BI)) {
            return false;
          }
        }
      }
      afterNewline = false;
      j++;
    }
    return false;
  }
  function parsePolymetric(label) {
    let dureeCollee = null;
    expect(T.LBRACE);
    const voices = [];
    let currentVoice = [];
    while (!at(T.RBRACE) && !atEnd()) {
      if (at(T.COMMA)) {
        voices.push(currentVoice);
        currentVoice = [];
        advance();
        continue;
      }
      if (at(T.NEWLINE)) {
        advance();
        continue;
      }
      if (at(T.LBRACKET) && current().spaceBefore) break;
      const el = parseRhsElement();
      if (!el) break;
      refuserSuffixeArobase();
      let sacsLusIci = 0;
      while (at(T.LBRACKET) && !current().spaceBefore || at(T.LPAREN) && !current().spaceBefore && isRuntimeQualifier()) {
        if (at(T.LBRACKET)) refuserCrochetColle();
        el.suffixQualifiers = el.suffixQualifiers || [];
        refuserSecondSac(++sacsLusIci, el);
        el.suffixQualifiers.push(parseRuntimeQualifier());
      }
      currentVoice.push(envelopperEnAccord(el, current()));
      if (at(T.LPAREN) && current().spaceBefore && isRuntimeQualifier() && currentVoice.length > 0) {
        const lastEl = currentVoice[currentVoice.length - 1];
        lastEl.suffixQualifiers = lastEl.suffixQualifiers || [];
        lastEl.suffixQualifiers.push(parseRuntimeQualifier());
      }
    }
    if (currentVoice.length > 0) voices.push(currentVoice);
    expect(T.RBRACE);
    const qualifiers = [];
    while (at(T.LBRACKET) && isPolymetricQualifier()) {
      qualifiers.push(parseQualifier());
    }
    if (at(T.COLON) && !current().spaceBefore && estNombreDeDuree(peek(1))) {
      const tokColon = current();
      advance();
      dureeCollee = parseColonFrame(tokColon);
    }
    let settings = null;
    if (isRuntimeQualifier() && !current().spaceBefore) {
      settings = parseRuntimeQualifier();
    }
    const groupe = { type: "Polymetric", voices, qualifiers, settings, label: label || null };
    return dureeCollee ? cadreDuree(dureeCollee, [groupe]) : groupe;
  }
  const estNombreDeDuree = (t) => t && (t.type === T.INT || t.type === T.FLOAT);
  function parseColonFrame(tok) {
    if (at(T.FLOAT)) {
      const brut = String(advance().value);
      const decimales = (brut.split(".")[1] || "").length;
      let n = Math.round(Number(brut) * 10 ** decimales), d = 10 ** decimales;
      const pgcd = (a, b) => b === 0 ? a : pgcd(b, a % b);
      const g = pgcd(n, d) || 1;
      n /= g;
      d /= g;
      if (d === 1) {
        return { type: "NumericTerminal", kind: "numeric-terminal", value: n, line: (tok || current()).line };
      }
      return { type: "NumericDuration", numerator: n, denominator: d };
    }
    const num = expect(T.INT).value;
    if (at(T.SLASH) && peek(1).type === T.INT) {
      advance();
      const den = expect(T.INT).value;
      if (at(T.SLASH) && !current().spaceBefore) {
        throw new ParseError(
          `'${num}/${den}/\u2026' : deux nombres se touchent, et rien ne dit o\xF9 le premier finit \u2014 '${num}/${den}' suivi d'un chiffre coll\xE9 se relit '${num}' puis '${String(den).slice(0, 1)}\u2026', ou autrement. On ne juxtapose jamais : s\xE9parer par une ESPACE`,
          current()
        );
      }
      return { type: "NumericDuration", numerator: Number(num), denominator: Number(den) };
    }
    return { type: "NumericTerminal", kind: "numeric-terminal", value: Number(num), line: (tok || current()).line };
  }
  function cadreDuree(premiereVoix, contenu) {
    return {
      type: "Polymetric",
      voices: [[premiereVoix], contenu],
      qualifiers: [],
      settings: null,
      label: null
    };
  }
  function isPolymetricQualifier() {
    return false;
  }
  function parseVariable() {
    const tok = current();
    expect(T.PIPE);
    const name = expect(T.IDENT).value;
    expect(T.PIPE);
    throw new ParseError(
      `'|${name}|' : le nom entre barres est sorti du langage \u2014 \xE9crire '${name}' nu. La graphie reste lisible en entr\xE9e BP3, elle ne s'\xE9crit plus dans une sc\xE8ne BPScript. \u26A0\uFE0F V\xE9rifier qu'aucun terminal de l'alphabet en port\xE9e ne s'appelle d\xE9j\xE0 '${name}' : la barre distinguait le non-terminal, le nom nu ne le distingue plus.`,
      tok
    );
  }
  function parseWildcard() {
    expect(T.QUESTION);
    if (at(T.INT)) return { type: "Wildcard", index: Number(advance().value) };
    return { type: "Wildcard" };
  }
  function lireArgumentsDeGabarit(sigil, nom) {
    const args = [];
    advance();
    while (!at(T.RPAREN) && !atEnd()) {
      const avant = pos;
      let key = null;
      if (at(T.IDENT) && peek(1).type === T.COLON) {
        key = advance().value;
        advance();
      }
      let value;
      if (at(T.INT)) value = { type: "Literal", value: Number(advance().value) };
      else if (at(T.IDENT)) value = { type: "Literal", value: advance().value };
      args.push({ type: "Arg", key, value });
      if (at(T.COMMA)) advance();
      if (pos === avant) {
        throw new ParseError(
          `'${sigil}${nom}(\u2026${current().value}\u2026)' : '${current().value}' n'a pas sa place dans les arguments d'un gabarit \u2014 ils s'\xE9crivent 'nom:valeur', s\xE9par\xE9s par des virgules. Pour poser un R\xC9GLAGE sur la r\xE8gle, une ESPACE le d\xE9tache du gabarit ('${sigil}${nom} (${key || "cl\xE9"}:\u2026)') ; pour une VITESSE, qui n'est pas une paire, le point d'exclamation la pose dans le flux ('${sigil}${nom} ! (*2/3)')`,
          current()
        );
      }
    }
    expect(T.RPAREN);
    return args;
  }
  function parseTemplateMaster() {
    expect(T.DOLLAR);
    if (at(T.LBRACE)) {
      advance();
      const elements = [];
      while (!at(T.RBRACE) && !atEnd()) {
        if (at(T.NEWLINE)) {
          advance();
          continue;
        }
        const el = parseRhsElement();
        if (el) elements.push(el);
        else break;
        refuserSuffixeArobase();
      }
      expect(T.RBRACE);
      return { type: "TemplateMasterGroup", elements };
    }
    if (!at(T.IDENT) || current().spaceBefore) {
      return { type: "TemplateAnchor", kind: "master" };
    }
    const name = expect(T.IDENT).value;
    let args = null;
    if (at(T.LPAREN) && !current().spaceBefore && !isRuntimeQualifier()) {
      args = lireArgumentsDeGabarit("$", name);
    }
    return { type: "TemplateMaster", name, args };
  }
  function parseTemplateSlave() {
    expect(T.AMPERSAND);
    if (at(T.LBRACE)) {
      advance();
      const elements = [];
      while (!at(T.RBRACE) && !atEnd()) {
        if (at(T.NEWLINE)) {
          advance();
          continue;
        }
        const el = parseRhsElement();
        if (el) elements.push(el);
        else break;
        refuserSuffixeArobase();
      }
      expect(T.RBRACE);
      return { type: "TemplateSlaveGroup", elements };
    }
    const name = expect(T.IDENT).value;
    let args = null;
    if (at(T.LPAREN) && !current().spaceBefore && !isRuntimeQualifier()) {
      args = lireArgumentsDeGabarit("&", name);
    }
    return { type: "TemplateSlave", name, args };
  }
  function parseWait() {
    expect(T.TRIGGER_IN);
    if (at(T.IDENT) && current().spaceBefore) {
      throw new ParseError(
        `'<! ${current().value}' : rien ne s'intercale entre le point d'attente et ce qu'il attend \u2014 ils forment un seul terme. \xC9crire '<!${current().value}'.`,
        current()
      );
    }
    const name = expect(T.IDENT).value;
    let address = null;
    const colle = at(T.PERIOD) && !current().spaceBefore;
    if (colle && (peek(1).type === T.IDENT || peek(1).type === T.INT) && !peek(1).spaceBefore) {
      advance();
      const jeton = advance();
      address = jeton.type === T.INT ? Number(jeton.value) : jeton.value;
      if ((at(T.IDENT) || at(T.INT)) && !current().spaceBefore) {
        throw new ParseError(
          `'<!${name}.${jeton.value}${current().value}' : l'adresse est SUIVIE DE '${current().value}' sans s\xE9parateur. Une adresse est UN seul jeton \u2014 un identifiant ('<!${name}.suivant') ou un entier ('<!${name}.60'). S\xE9parer par une espace ce qui doit \xEAtre un terme distinct.`,
          current()
        );
      }
    } else if (colle) {
      throw new ParseError(
        `'<!${name}.' suivi de '${peek(1).value ?? peek(1).type}' : ce n'est pas une adresse. Une adresse est un identifiant ('<!${name}.suivant') ou un entier ('<!${name}.60'), coll\xE9 au point des deux c\xF4t\xE9s. Sans adresse, \xE9crire '<!${name}' seul \u2014 l'attente se l\xE8ve alors sur n'importe quel \xE9v\xE9nement de ce r\xF4le, et c'est une forme diff\xE9rente, pas un raccourci.`,
        current()
      );
    }
    const qualifiers = [];
    if (at(T.LBRACKET)) refuserCrochetColle();
    const suffixQualifiers = [];
    while (at(T.LPAREN) && isRuntimeQualifier()) suffixQualifiers.push(parseRuntimeQualifier());
    return {
      type: "Wait",
      name,
      ...address !== null ? { address } : {},
      qualifiers,
      ...suffixQualifiers.length ? { suffixQualifiers } : {}
    };
  }
  function refuserTempx(key, tok, signeOuvrant) {
    if (key !== "tempx" && key !== "tempo") return;
    throw new ParseError(
      `'${signeOuvrant === "[" ? "[" : "("}${key}:\u2026${signeOuvrant === "[" ? "]" : ")"}' : '${key}' ne s'\xE9crit pas dans une r\xE8gle \u2014 le multiplicateur de vitesse EST l'op\xE9rateur, et il se pose dans le flux : '! (/N)' ralentit, '! (*N/M)' \xE9crit la m\xEAme chose en fraction inverse (d\xE9cision Romain 2026-08-06). Le m\xE9tronome de la sc\xE8ne, lui, s'\xE9crit en t\xEAte : 'tempo:120'`,
      tok
    );
  }
  function checkQualifierKey(key, tok) {
    refuserTempx(key, tok, "[");
    if (key === "speed") {
      throw new ParseError(`'[speed:N]' a \xE9t\xE9 supprim\xE9 (d\xE9cision 2026-06-26) \u2014 la dur\xE9e s'\xE9crit avec ':' : '{A B}:2' (groupe), 'A4:1/2' (note) ou '}:N' (embedding)`, tok);
    }
    if (key === "shuffle") {
      throw new ParseError(`'[shuffle:N]' retir\xE9 \u2014 la graine s'\xE9crit 'seed:N' (en t\xEAte de sc\xE8ne) ou '![seed:N]' (dans le flux) ; '[shuffle]' brasse seul`, tok);
    }
    if (libCtx.qualifierKeys.has(key)) {
      throw new ParseError(
        `'[${key}:\u2026]' : '${key}' est un r\xE9glage, il s'\xE9crit entre PARENTH\xC8SES \u2014 '(${key}:\u2026)' (d\xE9cision Romain 2026-08-02, LANGUAGE.md:773-800). Le crochet ne porte plus que ce qui gouverne la d\xE9rivation elle-m\xEAme : un test de drapeau ('[flag]', '[flag==1]'), une affectation ('[flag=1]'), ou le rang d'une forme de gabarit ('[3]')`,
        tok
      );
    }
    if (universeSacs().runtime.has(key)) {
      const valeurNumerique = (at(T.INT) || at(T.FLOAT)) && (peek(1).type === T.RBRACKET || peek(1).type === T.COMMA || peek(1).type === T.SLASH);
      if (key === "scale" && valeurNumerique) {
        throw new ParseError(
          `'[scale:N]' a \xE9t\xE9 SUPPRIM\xC9 (d\xE9cision Romain 2026-07-26) \u2014 la mise \xE0 l'\xE9chelle temporelle d'un groupe s'\xE9crit avec la DUR\xC9E COLL\xC9E : '{A B}:N'. (\xC0 ne pas confondre avec la gamme microtonale, qui est un contr\xF4le de runtime : '(scale:nom cl\xE9)'.)`,
          tok
        );
      }
      throw new ParseError(
        `'[${key}:\u2026]' : '${key}' est un contr\xF4le de RUNTIME, il s'\xE9crit entre PARENTH\xC8SES \u2014 '(${key}:\u2026)', ou '!(${key}:\u2026)' pour le poser dans le flux. Les crochets s'adressent au MOTEUR`,
        tok
      );
    }
    if (universeControlNames().has(key)) {
      if (universeRuleScopeControls().has(key)) return;
      if (!universeRuleAllowedControls().has(key)) return;
      throw new ParseError(
        `'[${key}:\u2026]' : le crochet ne porte que ce qui gouverne la D\xC9RIVATION \u2014 un test de drapeau ('[flag]', '[flag==1]'), une affectation ('[flag=1]'), une proc\xE9dure de d\xE9rivation ('[goto:\u2026]', '[repeat:\u2026]', '[failed:\u2026]', '[stop]') ou le rang d'une forme de gabarit ('[3]'). '${key}' d\xE9crit ce que la d\xE9rivation PRODUIT : il s'\xE9crit entre PARENTH\xC8SES (d\xE9cision Romain 2026-08-08, LANGUAGE.md \xA7\xAB Le crochet \xBB).`,
        tok
      );
    }
    throw new ParseError(
      `cl\xE9 '[${key}:\u2026]' inconnue \u2014 ni contr\xF4le de librairie, ni garde, ni affectation, ni rang de gabarit ; v\xE9rifier l'orthographe, ou la librairie qui la d\xE9clare. '[${key}:\u2026]' et '![${key}:\u2026]' (contr\xF4le moteur) ne sont PAS interchangeables avec '(${key}:\u2026)' (param\xE8tre de runtime)`,
      tok
    );
  }
  function parseVitesseParenthese() {
    expect(T.LPAREN);
    const operator = at(T.STAR) ? (advance(), "*") : (expect(T.SLASH), "/");
    let value;
    if (at(T.INT)) {
      value = Number(advance().value);
      if (at(T.SLASH) && peek(1).type === T.INT) {
        const denom = (advance(), Number(advance().value));
        value = `${value}/${denom}`;
      }
    } else if (at(T.FLOAT)) {
      value = Number(advance().value);
    } else {
      throw new ParseError(
        `'! (${operator}\u2026)' attend un nombre ou une fraction \u2014 '! (/2)', '! (*3/2)', '! (/1.5)'`,
        current()
      );
    }
    expect(T.RPAREN);
    return { type: "Qualifier", pairs: [], tempoOp: { type: "TempoOp", operator, value, scope: "relative" } };
  }
  function parseQualifier(tempoScope = "absolute") {
    expect(T.LBRACKET);
    if (atAny(T.SLASH, T.STAR)) {
      const signe = at(T.STAR) ? "*" : "/";
      throw new ParseError(
        `'[${signe}N]' : l'op\xE9rateur de vitesse s'\xE9crit entre PARENTH\xC8SES et se pose dans le FLUX \u2014 '! (${signe}N)' (d\xE9cision Romain 2026-08-06). Il ne vit nulle part ailleurs : ni en suffixe de r\xE8gle, ni coll\xE9 \xE0 un \xE9l\xE9ment. '/N' acc\xE9l\xE8re, '*N/M' \xE9crit la m\xEAme chose en fraction inverse`,
        current()
      );
    }
    const pairs = [];
    while (!at(T.RBRACKET) && !atEnd()) {
      const keyTok = current();
      const key = expect(T.IDENT).value;
      if (!at(T.COLON)) {
        pairs.push({ type: "QualPair", key, value: true, decrement: null });
        if (at(T.COMMA)) advance();
        continue;
      }
      const apresDeuxPoints = current();
      expect(T.COLON);
      checkQualifierKey(key, keyTok);
      if (!at(T.RBRACKET) && !atEnd() && current().spaceBefore) {
        throw new ParseError(
          `'${key}: ' \u2014 pas d'espace apr\xE8s le deux-points : la valeur commence imm\xE9diatement ('${key}:${current().value}\u2026'). L'espace ne s\xE9pare que les PARTIES d'une valeur`,
          current()
        );
      }
      void apresDeuxPoints;
      if (libCtx.controlNames.has(key)) {
        let rawValue = "";
        while (!at(T.RBRACKET) && !atEnd()) {
          if (at(T.COMMA)) {
            const suite = peek(1);
            const ouvreUnElement = suite.type === T.IDENT && (peek(2).type === T.COLON || peek(2).type === T.RBRACKET || peek(2).type === T.COMMA);
            if (!ouvreUnElement) {
              throw new ParseError(
                `'[${key}: ${rawValue.trim()},\u2026]' : la virgule s\xE9pare les \xC9L\xC9MENTS du sac, pas les parties d'une valeur (liste positionnelle supprim\xE9e le 2026-07-26) \u2014 \xE9crire '[${key}:${rawValue.trim()} \u2026]', les parties s\xE9par\xE9es par une ESPACE`,
                current()
              );
            }
            break;
          }
          const t = current();
          if (t.type === T.COLON) {
            throw new ParseError(
              `'[${key}: ${rawValue.trim()}:\u2026]' : le deux-points AFFECTE une valeur, il n'en s\xE9pare pas les parties \u2014 une paire n'en porte qu'un. Les parties d'une valeur se s\xE9parent par une ESPACE ('[${key}:3 0]')`,
              t
            );
          }
          if (rawValue.length > 0 && t.type !== T.RPAREN && t.type !== T.COMMA) {
            const lastChar = rawValue[rawValue.length - 1];
            if (lastChar !== "(" && t.type !== T.LPAREN && lastChar !== ",") {
              const isSlash = t.type === T.SLASH || lastChar === "/";
              const isEquals = t.type === T.EQUALS || lastChar === "=";
              if (lastChar !== "-" && !isSlash && !isEquals) rawValue += " ";
            }
          }
          rawValue += advance().value;
        }
        rawValue = rawValue.trim();
        if (rawValue === "") {
          throw new ParseError(
            `'[${key}:]' n'affecte aucune valeur \u2014 le deux-points en attend une (par exemple '[${key}:3 0]'), et un contr\xF4le sans argument s'\xE9crit nu, sans deux-points`,
            keyTok
          );
        }
        pairs.push({ type: "QualPair", key, value: rawValue, decrement: null });
        if (at(T.COMMA)) advance();
        continue;
      }
      const gardeElement = () => {
        if (at(T.IDENT) && peek(1).type === T.COLON) {
          throw new ParseError(
            `'[${key}:\u2026 ${current().value}:\u2026]' : deux \xC9L\xC9MENTS du sac s\xE9par\xE9s par une ESPACE \u2014 il leur manque une VIRGULE ('[${key}:\u2026, ${current().value}:\u2026]'). L'espace ne s\xE9pare que les PARTIES d'une m\xEAme valeur`,
            current()
          );
        }
      };
      const { value, decrement } = readQualifierValue();
      gardeElement();
      pairs.push({ type: "QualPair", key, value, decrement });
      if (at(T.COMMA)) advance();
    }
    expect(T.RBRACKET);
    return { type: "Qualifier", pairs, tempoOp: null };
  }
  function readQualifierValue() {
    let value, decrement = null;
    if (at(T.INT)) {
      const num = advance().value;
      if (at(T.PLUS) && peek(1).type === T.INT) {
        let sig = num;
        while (at(T.PLUS) && peek(1).type === T.INT) {
          sig += advance().value;
          sig += advance().value;
        }
        if (at(T.SLASH) && peek(1).type === T.INT) {
          sig += advance().value;
          sig += advance().value;
        }
        value = sig;
      } else if (at(T.SLASH) && peek(1).type === T.INT) {
        advance();
        const denom = advance().value;
        value = `${num}/${denom}`;
      } else {
        value = Number(num);
        if (at(T.REST) && peek(1).type === T.INT) {
          advance();
          decrement = Number(advance().value);
        }
      }
    } else if (at(T.FLOAT)) {
      value = Number(advance().value);
    } else if (at(T.REST)) {
      const sign = advance().value;
      value = sign + (at(T.INT) ? advance().value : "");
    } else if (at(T.IDENT)) {
      value = advance().value;
      if (at(T.EQUALS) && peek(1).type === T.INT) {
        advance();
        value = `${value}=${advance().value}`;
      } else if (at(T.LPAREN)) {
        advance();
        const arg = at(T.IDENT) ? advance().value : expect(T.INT).value;
        expect(T.RPAREN);
        value = `${value}(${arg})`;
      }
    }
    return { value, decrement };
  }
  return parseScene();
}

export {
  universeControlNames,
  loadLib,
  groupeDUnicite,
  resolveActorAlphabet,
  resolveActorAlphabetSource,
  nomsDeTerminaux,
  loadLibsFromDirectives,
  describeVocabulary,
  ParseError,
  parse
};
