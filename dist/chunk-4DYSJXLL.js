import {
  T,
  diagnostic,
  texteDuDiagnostic
} from "./chunk-S3UVLV7L.js";
import {
  CHAMPS_DE_FICHIER,
  CHAMPS_DU_PAQUET,
  entreesDe
} from "./chunk-JWEI77WV.js";
import {
  SYNTAXE
} from "./chunk-7IMIRTTZ.js";

// src/transpiler/librairies.js
var places = {};
var noterPlace = (lib, cle) => {
  (places[lib] = places[lib] || /* @__PURE__ */ new Set()).add(cle);
};
var ecritesDansLeLangage = /* @__PURE__ */ new Set();
var estUneSuite = (sac) => Boolean(sac && sac.type === "SettingBag" && (sac.pairs || []).length && sac.pairs.every((m) => m.value === true));
var FauteDeLibrairie = class extends Error {
};
function rangerConteneur(ou, nom, val, fichier, place) {
  if (!val || val.type !== "SettingBag") {
    ou[nom] = valeurDeCle({ kind: "value", value: val });
    return;
  }
  const pairs = val.pairs || [];
  if (pairs.length && pairs.every((p) => p.value === true)) {
    ou[nom] = suite(val, fichier, place, nom);
    return;
  }
  if (pairs.length && pairs.every((p) => p.value && p.value.type === "SettingBag")) {
    const sous = ou[nom] = ou[nom] || {};
    for (const p of pairs) rangerConteneur(sous, p.key, p.value, fichier, `${place}.${nom}`);
    return;
  }
  const entree = ou[nom] = {};
  for (const p of pairs) {
    if (p.value && p.value.type === "SettingBag") {
      entree[p.key] = estUneSuite(p.value) ? suite(p.value, fichier, nom, p.key) : sacEnObjet(p.value, fichier, nom);
      continue;
    }
    entree[p.key] = valeurDeCle({ kind: "value", value: p.value, ...p.texte ? { texte: true } : {} });
  }
}
function valeurDeCle(v) {
  if (v && v.kind === "suite") return v.value;
  if (v && v.texte) return v.value;
  const brut = v && v.kind === "value" ? v.value : v && v.value;
  const un = (x) => {
    if (typeof x !== "string") return x;
    if (x === "true") return true;
    if (x === "false") return false;
    return /^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x;
  };
  return Array.isArray(brut) ? brut.map(un) : un(brut);
}
function suite(sac, fichier, declaration, cle) {
  const porteurs = (sac.pairs || []).filter((p) => p.value !== true);
  if (porteurs.length) {
    throw new FauteDeLibrairie(`lib/${fichier} \xB7 ${declaration} : '${cle}' est une cl\xE9-liste \u2014 ses membres sont des noms nus, et ${porteurs.map((p) => `'${p.key}'`).join(", ")} porte(nt) une valeur. Une cl\xE9-liste ne lit que le RANG ; cette valeur serait perdue sans un mot.`);
  }
  return (sac.pairs || []).map((p) => p.texte ? p.key : /^-?\d+(\.\d+)?$/.test(p.key) ? Number(p.key) : p.key);
}
function sacEnObjet(sac, fichier = "?", declaration = "?") {
  const out = {};
  for (const p of sac.pairs || []) {
    if (p.value && p.value.type === "SettingBag" && (p.value.pairs || []).length && (p.value.pairs || []).every((q) => q.value === true)) {
      out[p.key] = suite(p.value, fichier, declaration, p.key);
      continue;
    }
    out[p.key] = p.value && p.value.type === "SettingBag" ? sacEnObjet(p.value, fichier, declaration) : valeurDeCle({ kind: "value", value: p.value, ...p.texte ? { texte: true } : {} });
  }
  return out;
}
var MARQUE_DESCRIPTION = /^[ \t]*\/\/[ \t]*@description[ \t]+(.*\S)[ \t]*$/;
var SUITE_DE_MARQUE = /^[ \t]*\/\/[ \t]*(?!@)(.*\S)[ \t]*$/;
function placesQuiPortentUneProse(ast) {
  const table = /* @__PURE__ */ new Map();
  const vus = /* @__PURE__ */ new Set();
  const visiterSac = (sac) => {
    if (!sac || sac.type !== "SettingBag" || vus.has(sac)) return;
    vus.add(sac);
    for (const p of sac.pairs || []) {
      if (p.value && p.value.type === "SettingBag") {
        if (p.line != null && !table.has(p.line)) table.set(p.line, p.value);
        visiterSac(p.value);
      }
    }
  };
  for (const d of [...ast.defs || [], ...ast.vars || []]) {
    if (d.line != null) {
      if (!d.settings) d.settings = { type: "SettingBag", pairs: [] };
      table.set(d.line, d.settings);
    }
    visiterSac(d.settings);
  }
  return table;
}
function* toutesLesPaires(ast) {
  const vus = /* @__PURE__ */ new Set();
  const descendre = function* (sac) {
    if (!sac || sac.type !== "SettingBag" || vus.has(sac)) return;
    vus.add(sac);
    for (const p of sac.pairs || []) {
      yield p;
      if (p.value && p.value.type === "SettingBag") yield* descendre(p.value);
    }
  };
  for (const d of [...ast.defs || [], ...ast.vars || []]) yield* descendre(d.settings);
}
function poserLesDescriptions(texte, ast, fichier) {
  for (const p of toutesLesPaires(ast)) {
    if (p.key === "description") {
      throw new FauteDeLibrairie(`lib/${fichier}:${p.line} : 'description' ne s'\xE9crit plus dans un sac \u2014 la prose d'un objet se porte en pr\xE9fixe, sur une ligne '// @description \u2026' (Romain, 2026-09-04).`);
    }
  }
  const lignes = String(texte).split("\n");
  const places2 = placesQuiPortentUneProse(ast);
  let posees = 0;
  for (let i = 0; i < lignes.length; i += 1) {
    const m = MARQUE_DESCRIPTION.exec(lignes[i]);
    if (!m) continue;
    const morceaux = [m[1]];
    let j = i + 1;
    for (; j < lignes.length; j += 1) {
      const s = SUITE_DE_MARQUE.exec(lignes[j]);
      if (!s) break;
      morceaux.push(s[1]);
    }
    i = j - 1;
    while (j < lignes.length && !lignes[j].trim()) j += 1;
    const sac = places2.get(j + 1);
    if (!sac) {
      throw new FauteDeLibrairie(`lib/${fichier}:${i + 1} : '// @description' ne pr\xE9c\xE8de aucun objet \u2014 la marque se pose en pr\xE9fixe d'une d\xE9claration ou d'un membre qui ouvre une parenth\xE8se.`);
    }
    sac.pairs.unshift({ key: "description", value: morceaux.join(" "), texte: true, line: i + 1, col: 1 });
    posees += 1;
  }
  return posees;
}
function construireLaLibrairie(nom, fichier, ast, documente) {
  const lib = { controls: {} };
  let sectionDuFichier = null;
  const aUneValeur = (d) => d.value != null || d.runtime != null;
  const invoquees = (ast.directives || []).filter((d) => d.type !== "FileDirective" && d.name && !d.subkey && !aUneValeur(d)).map((d) => d.name);
  if (invoquees.length) lib.apporte = invoquees;
  const fichiersDeCorps = (ast.directives || []).filter((d) => d.type === "FileDirective").map((d) => `${d.name}/${d.fichier}`);
  if (fichiersDeCorps.length) Object.defineProperty(lib, "_fichiersDeCorps", {
    value: fichiersDeCorps,
    enumerable: false,
    configurable: true
  });
  const reglages = (ast.directives || []).filter((d) => d.name && !d.subkey && aUneValeur(d));
  const valeurDeTete = (d) => {
    const v = d.value != null ? d.value : d.runtime;
    return v === "true" ? true : v === "false" ? false : v;
  };
  if (reglages.length) lib.reglages = Object.fromEntries(reglages.map((d) => [d.name, valeurDeTete(d)]));
  lib.documented = Boolean(documente);
  const clesDeLaDeclaration = (d) => {
    if (d.keys) return d.keys;
    if (!d.settings || !Array.isArray(d.settings.pairs)) return null;
    const out = {};
    for (const p of d.settings.pairs) {
      if (p.herite) continue;
      if (p.type) {
        const contenu = p.value && p.value.type === "SettingBag" ? sacEnObjet(p.value, fichier, d.name) : {};
        out[p.key] = { kind: "value", value: { ...contenu, _derive: p.type } };
        continue;
      }
      out[p.key] = p.value && p.value.type === "SettingBag" ? estUneSuite(p.value) ? { kind: "suite", value: suite(p.value, fichier, d.name, p.key) } : { kind: "value", value: sacEnObjet(p.value, fichier, d.name), sac: p.value } : { kind: "value", value: p.value, ...p.texte ? { texte: true } : {} };
    }
    return out;
  };
  const sacVide = { type: "SettingBag", pairs: [] };
  const declarations = [
    ...ast.defs || [],
    ...(ast.vars || []).filter((v) => v.varType?.kind === "type" || v.varType?.kind === "convention").map((v) => ({
      type: "DefDirective",
      name: v.names[0],
      settings: v.settings || sacVide,
      derivedeDe: v.varType.kind === "type" ? v.varType.type : v.varType.convention,
      line: v.line
    }))
  ];
  const nomDuFichier = fichier.replace(/^.*\//, "").replace(/\.bpsl$/, "");
  for (const d of declarations) {
    if (d.type !== "DefDirective") continue;
    d.keys = clesDeLaDeclaration(d);
    if (!d.keys) continue;
    const chemin = d.keys && d.keys.section ? valeurDeCle(d.keys.section) : sectionDuFichier;
    let cible;
    let aEcrireEnQueue = null;
    if (d.name === nomDuFichier) {
      cible = lib;
    } else {
      let ou = lib;
      if (chemin) {
        const segs = String(chemin).split(".");
        for (const seg of segs) {
          ou[seg] = ou[seg] || {};
          ou = ou[seg];
        }
        noterPlace(nom, segs[0]);
      }
      cible = ou[d.name] = {};
      aEcrireEnQueue = d.derivedeDe && d.derivedeDe !== "object" ? d.derivedeDe : null;
    }
    for (const [cle, v] of Object.entries(d.keys)) {
      if (cle === "section") {
        if (cible === lib) sectionDuFichier = valeurDeCle(v);
        continue;
      }
      if (cle === "documented" && cible === lib) {
        throw new FauteDeLibrairie(`lib/${fichier} : 'documented' ne s'\xE9crit plus dans le sac de la racine \u2014 un catalogue document\xE9 porte la ligne '// @documented' en t\xEAte (Romain, 2026-09-02).`);
      }
      const val = valeurDeCle(v);
      if (cible === lib && !CHAMPS_DE_FICHIER.has(cle)) {
        const sac = v && v.sac;
        if (sac && sac.type === "SettingBag") {
          const ou = lib[cle] = lib[cle] || {};
          noterPlace(nom, cle);
          for (const p2 of sac.pairs || []) rangerConteneur(ou, p2.key, p2.value, fichier, cle);
          continue;
        }
        throw new FauteDeLibrairie(`lib/${fichier} : '${cle}' n'est pas un champ de FICHIER (${[...CHAMPS_DE_FICHIER].join(", ")}), et sa valeur n'est pas un objet. Une entr\xE9e se d\xE9clare par son propre 'def', ou s'\xE9crit DANS une place \u2014 '${cle}(<nom>(\u2026), \u2026)'.`);
      }
      cible[cle] = val;
    }
    if (aEcrireEnQueue) cible._derive = aEcrireEnQueue;
  }
  const sections = [lib.controls, lib.engine, lib.subgrammar].filter(Boolean);
  for (const sec of sections) {
    for (const c of Object.values(sec)) {
      if (c && typeof c === "object" && c.args === void 0 && ("bp3" in c || "description" in c)) c.args = [];
    }
  }
  if (!Object.keys(lib.controls).length) delete lib.controls;
  return lib;
}
function chargerLesLibrairies(sources, compiler, registerLib2) {
  for (const s of sources) {
    if (s.format !== "json") continue;
    registerLib2(s.nom, JSON.parse(s.texte));
  }
  let restants = sources.filter((s) => s.format === "bpsl" && !s.nom.includes("/"));
  const corpsAcompiler = sources.filter((s) => s.format === "bpsl" && s.nom.includes("/"));
  const construites = {};
  for (; ; ) {
    const encore = [];
    const refus = [];
    for (const s of restants) {
      ecritesDansLeLangage.add(s.nom);
      const r = compiler(s.texte, { librairie: true });
      if ((r.errors || []).length) {
        encore.push(s);
        refus.push(`lib/${s.fichier} NE COMPILE PAS : ${r.errors[0].message}`);
        continue;
      }
      const documente = /^\s*\/\/\s*@documented\b/m.test(s.texte);
      poserLesDescriptions(s.texte, r.ast, s.fichier);
      const lib = construireLaLibrairie(s.nom, s.fichier, r.ast, documente);
      construites[s.nom] = lib;
      registerLib2(s.nom, lib);
    }
    if (!encore.length) break;
    if (encore.length === restants.length) {
      throw new FauteDeLibrairie(`${refus.length} source(s) de librairie ne compilent pas :
  ` + refus.join("\n  "));
    }
    restants = encore;
  }
  const corpsLus = /* @__PURE__ */ new Map();
  for (const s of corpsAcompiler) {
    const [nomLib] = s.nom.split("/");
    const racine = construites[nomLib];
    const invoque = [...racine && racine.apporte ? racine.apporte : [], nomLib].join("\n");
    const r = compiler(`${invoque}
${s.texte}`, { librairie: true });
    if ((r.errors || []).length) {
      throw new FauteDeLibrairie(`lib/${s.fichier} NE COMPILE PAS : ${r.errors[0].message}`);
    }
    const lus = [];
    for (const v of r.ast && r.ast.vars || []) {
      const nom = (v.names || [])[0];
      if (!nom || !v.corps) continue;
      lus.push({ nom, corps: v.corps.code, tag: v.corps.tag });
    }
    corpsLus.set(s.nom, lus);
  }
  const corpsParLibrairie = /* @__PURE__ */ new Map();
  for (const s of corpsAcompiler) {
    const [lib] = s.nom.split("/");
    if (!corpsParLibrairie.has(lib)) corpsParLibrairie.set(lib, []);
    corpsParLibrairie.get(lib).push(s);
  }
  for (const [lib, fichiers] of corpsParLibrairie) {
    const racine = construites[lib];
    if (!racine) continue;
    const declares = new Set(racine._fichiersDeCorps || []);
    for (const s of fichiers) {
      if (!declares.has(s.nom)) {
        throw new FauteDeLibrairie(`lib/${s.fichier} : la librairie '${lib}' ne D\xC9CLARE pas ce fichier de corps \u2014 l'\xE9crire en t\xEAte de 'lib/${lib}.bpsl' sur une ligne \xE0 elle : '${s.nom}'. Un corps que rien ne d\xE9clare ne se charge pas sur la foi de son nom.`);
      }
      declares.delete(s.nom);
      const lus = corpsLus.get(s.nom) || [];
      if (!lus.length) {
        throw new FauteDeLibrairie(`lib/${s.fichier} ne porte AUCUN corps \u2014 un fichier d\xE9clar\xE9 comme corps \xE9crit son code apr\xE8s l'en-t\xEAte repris, entre backticks tagu\xE9s.`);
      }
      const texteRacine = (sources.find((x) => x.nom === lib) || {}).texte || "";
      for (const { nom, corps } of lus) {
        const cible = nom === lib ? racine : racine[nom] && typeof racine[nom] === "object" && !Array.isArray(racine[nom]) ? racine[nom] : Object.values(racine).find((place) => place && typeof place === "object" && !Array.isArray(place) && place[nom] && typeof place[nom] === "object")?.[nom];
        if (!cible) {
          throw new FauteDeLibrairie(`lib/${s.fichier} reprend l'en-t\xEAte de '${nom}', et la librairie '${lib}' ne d\xE9clare aucun objet de ce nom \u2014 un corps reprend l'en-t\xEAte d'une d\xE9claration qui existe.`);
        }
        if (!memeEnTete(texteRacine, s.texte, nom)) {
          throw new FauteDeLibrairie(`lib/${s.fichier} : l'en-t\xEAte repris de '${nom}' DIVERGE de sa d\xE9claration dans 'lib/${lib}.bpsl' \u2014 un corps reprend EXACTEMENT le m\xEAme en-t\xEAte.`);
        }
        cible.body = corps;
      }
      registerLib2(lib, racine);
    }
    for (const manque of declares) {
      throw new FauteDeLibrairie(`lib/${lib}.bpsl d\xE9clare le fichier de corps '${manque}', et aucune source ne le fournit \u2014 \xE9crire 'lib/${manque}.bpsl', ou retirer la ligne.`);
    }
  }
}
function enTeteEcrit(texte, nom) {
  const L = String(texte || "").split("\n");
  const i = L.findIndex((l) => new RegExp(`^[a-z_]+ ${nom}\\(|^def ${nom}\\(`).test(l));
  if (i < 0) return null;
  let prof = 0;
  for (let j = i; j < L.length; j++) {
    for (let k = 0; k < L[j].length; k++) {
      const c = L[j][k];
      if (c === "(") prof++;
      else if (c === ")") {
        prof--;
        if (prof <= 0) return L.slice(i, j).concat(L[j].slice(0, k + 1)).join("\n");
      }
    }
  }
  return null;
}
function memeEnTete(texteRacine, texteCorps, nom) {
  const a = enTeteEcrit(texteRacine, nom);
  const b = enTeteEcrit(texteCorps, nom);
  if (a == null || b == null) return false;
  const nu = (x) => x.replace(/\s+/g, " ").replace(/\s*([(),])\s*/g, "$1").trim();
  return nu(a) === nu(b);
}
function placesDesLibrairies(registre) {
  const tousObjets = (v) => {
    const m = Object.keys(v).filter((k) => !k.startsWith("_"));
    return m.length > 0 && m.every((k) => v[k] && typeof v[k] === "object" && !Array.isArray(v[k])) && m.some((k) => Object.keys(v[k]).some((x) => !x.startsWith("_")));
  };
  const PLACES = {};
  const deduites = [];
  for (const [nom, data] of Object.entries(registre).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (ecritesDansLeLangage.has(nom)) {
      PLACES[nom] = [...places[nom] || []].sort();
      continue;
    }
    const parLaForme = Object.keys(data || {}).filter((k) => !k.startsWith("_") && !CHAMPS_DE_FICHIER.has(k) && data[k] && typeof data[k] === "object" && !Array.isArray(data[k]) && tousObjets(data[k]));
    PLACES[nom] = parLaForme.sort();
    deduites.push(nom);
  }
  PLACES._deduites = deduites.sort();
  return PLACES;
}

// bpscript-sources:sources-de-librairie
var SOURCES = [{ "nom": "alphabets", "format": "bpsl", "texte": 'types\n\n// @documented\ndef alphabets(resolvedBy:Kairos, resolves:alphabet)\n\n// @description Western chromatic \u2014 7 natural notes, 5 alteration levels\nalphabet western(\n  runtime:audio,\n  tuning:western_12TET,\n  octaves:western,\n  diapason:440,\n  resolvesPitch:true,\n  alterations(bb:-2, b:-1, "":0, "#":1, "##":2),\n  baseNote:A,\n  baseRegister:"4",\n  terminals(C(), D(), E(), F(), G(), A(), B())\n)\n\n// @description Indian sargam \u2014 7 svaras\nalphabet sargam(\n  runtime:audio,\n  tuning:sargam_12TET,\n  octaves:saptak,\n  diapason:240,\n  resolvesPitch:true,\n  alterations(komal:-1, "":0, tivra:1),\n  baseNote:sa,\n  baseRegister:madhya,\n  terminals(sa(), re(), ga(), ma(), pa(), dha(), ni())\n)\n\n// @description Sargam AS THE NATIVE BP3 ENGINE NAMES IT (INDIAN note convention) \u2014 BP3 test alphabet, alongside the others.\nalphabet bp3_indian(\n  runtime:audio,\n  tuning:bp3_indian_12TET,\n  octaves:bp3,\n  diapason:440,\n  resolvesPitch:true,\n  alterations(k:-1, "":0, "#":1),\n  baseNote:dha,\n  baseRegister:"4",\n  terminals(sa(), re(), ga(), ma(), pa(), dha(), ni())\n)\n\n// @description ENGLISH note convention of the native BP3 engine \u2014 BP3 test alphabet, alongside the others.\nalphabet bp3_english(\n  runtime:audio,\n  tuning:bp3_english_12TET,\n  octaves:bp3,\n  diapason:440,\n  resolvesPitch:true,\n  alterations(b:-1, "":0, "#":1),\n  baseNote:A,\n  baseRegister:"4",\n  terminals(C(), D(), E(), F(), G(), A(), B())\n)\n\n// @description FRENCH note convention of the native BP3 engine \u2014 BP3 test alphabet, alongside the others.\nalphabet bp3_fr(\n  runtime:audio,\n  tuning:bp3_fr_12TET,\n  octaves:bp3_fr,\n  diapason:440,\n  resolvesPitch:true,\n  alterations(b:-1, "":0, "#":1),\n  baseNote:la,\n  baseRegister:"3",\n  terminals(do(), re(), mi(), fa(), sol(), la(), si())\n)\n\n// @description Latin solf\xE8ge \u2014 do r\xE9 mi fa sol la si\nalphabet solfege(\n  runtime:audio,\n  tuning:solfege_12TET,\n  octaves:western,\n  diapason:440,\n  resolvesPitch:true,\n  alterations(bb:-2, b:-1, "":0, "#":1, "##":2),\n  baseNote:la,\n  baseRegister:"4",\n  terminals(do(), re(), mi(), fa(), sol(), la(), si())\n)\n\n// @description Arabic \u2014 7 perde (degree names) with quarter-tone alterations. rast\u2248do, sikah = neutral third, awj = neutral seventh.\nalphabet arabic(\n  runtime:audio,\n  tuning:arabic_24TET,\n  diapason:440,\n  resolvesPitch:true,\n  alterations(bb:-4, b:-2, half_b:-1, "":0, "half_#":1, "#":2, "##":4),\n  baseNote:husayni,\n  terminals(rast(), dukah(), sikah(), jaharkah(), nawa(), husayni(), awj())\n)\n\n// @description Turkish makam \u2014 note names from Ottoman/Turkish tradition\nalphabet turkish(\n  runtime:audio,\n  tuning:turkish_53TET,\n  octaves:turkish,\n  diapason:440,\n  resolvesPitch:true,\n  alterations(bakiye:4, kucuk_mucenneb:5, "":0, buyuk_mucenneb:8, tanini:9),\n  baseNote:neva,\n  baseRegister:"",\n  terminals(\n    kaba_cargah(),\n    yegah(),\n    huseyni_asiran(),\n    acem_asiran(),\n    irak(),\n    rast(),\n    dugah(),\n    segah(),\n    buselik(),\n    cargah(),\n    neva(),\n    huseyni(),\n    acem(),\n    evic(),\n    mahur(),\n    gerdaniye()\n  )\n)\n\n// @description Javanese gamelan pelog \u2014 7 tones\nalphabet gamelan_pelog(\n  runtime:audio,\n  tuning:gamelan_pelog,\n  diapason:282,\n  resolvesPitch:true,\n  alterations(),\n  baseNote:nem,\n  terminals(nem(), barang(), bem(), gulu(), lima(), enam(), pitu())\n)\n\n// @description Javanese gamelan slendro \u2014 5 tones\nalphabet gamelan_slendro(\n  runtime:audio,\n  tuning:gamelan_slendro,\n  diapason:282,\n  resolvesPitch:true,\n  alterations(),\n  baseNote:nem,\n  terminals(nem(), barang(), gulu(), dada(), lima())\n)\n\n// @description Shakuhachi \u2014 5 base fingerings (Kinko-ry\u016B)\nalphabet shakuhachi(\n  runtime:audio,\n  tuning:shakuhachi_12TET,\n  octaves:shakuhachi,\n  diapason:293.66,\n  resolvesPitch:true,\n  alterations(meri:-1, "":0, kari:1),\n  baseNote:ro,\n  baseRegister:otsu,\n  terminals(ro(), tsu(), re(), chi(), ri())\n)\n\n// @description Bohlen-Pierce \u2014 13 pitch classes in a tritave\nalphabet bohlen_pierce(\n  runtime:audio,\n  tuning:bohlen_pierce_equal,\n  diapason:440,\n  resolvesPitch:true,\n  alterations(),\n  baseNote:C,\n  terminals(C(), Db(), D(), E(), F(), Gb(), G(), H(), Jb(), J(), A(), Bb(), B())\n)\n\n// @description Tabla bols \u2014 the ATOMIC syllables, those that no other one composes\nalphabet tabla(\n  runtime:audio,\n  resolvesPitch:false,\n  alterations(),\n  terminals(\n    dha(voice:bayan_open),\n    ta(voice:dayan_tap),\n    dhin(voice:bayan_open),\n    tin(voice:dayan_ring),\n    dhee(),\n    tee(voice:dayan_open),\n    ge(voice:bayan_open),\n    ke(voice:bayan_muted),\n    ra(),\n    tr(),\n    kt(voice:dayan_dry),\n    ti(voice:dayan_tap),\n    ne(),\n    na(voice:dayan_ring),\n    tk(),\n    dhr(),\n    ng(),\n    gr(),\n    te(),\n    tt(),\n    ki(),\n    ka(voice:bayan_muted)\n  )\n)\n\n// @description Abstract symbols \u2014 single lowercase letters, no pitch. For structural test scenes.\nalphabet simple(\n  runtime:audio,\n  resolvesPitch:false,\n  alterations(),\n  terminals(\n    a(),\n    b(),\n    c(),\n    d(),\n    e(),\n    f(),\n    g(),\n    h(),\n    i(),\n    j(),\n    k(),\n    l(),\n    m(),\n    n(),\n    o(),\n    p(),\n    q(),\n    r(),\n    s(),\n    t(),\n    u(),\n    v(),\n    w(),\n    x(),\n    y(),\n    z(),\n    Z(),\n    filler(),\n    b1(),\n    c1(),\n    d1()\n  )\n)\n\n// @description 22-shruti as named by BP3 \u2014 23 microtonal degrees (sa, r1..r4, g1..g4, m1, m2, m3p1, m4p2, p3, p4, d1..d4, n1..n4). Names\n// verbatim from -to.tryShruti, tonic sa.\nalphabet shruti23(\n  runtime:audio,\n  tuning:shruti23_native,\n  octaves:saptak_us,\n  diapason:261.625,\n  resolvesPitch:true,\n  alterations("":0),\n  baseNote:sa,\n  baseRegister:"4",\n  terminals(\n    sa(),\n    r1(),\n    r2(),\n    r3(),\n    r4(),\n    g1(),\n    g2(),\n    g3(),\n    g4(),\n    m1(),\n    m2(),\n    m3p1(),\n    m4p2(),\n    p3(),\n    p4(),\n    d1(),\n    d2(),\n    d3(),\n    d4(),\n    n1(),\n    n2(),\n    n3(),\n    n4()\n  )\n)\n\n// @description Csound sound objects from the tryCsoundObjects test grammar (pitchless)\nalphabet tryCsoundObjects(\n  runtime:audio,\n  resolvesPitch:false,\n  alterations(),\n  terminals(\n    a(voice:dummy_csound_a),\n    b(voice:dummy_csound_b),\n    c(voice:dummy_csound_c),\n    d(voice:dummy_csound_d),\n    e(voice:dummy_csound_e),\n    f(voice:dummy_csound_f),\n    midiobject(voice:dummy_csound_midiobject)\n  )\n)\n', "fichier": "alphabets.bpsl" }, { "nom": "audio", "format": "bpsl", "texte": `types

// @documented
// @description Controls specific to the Web Audio transport \u2014 EXACT match with LIBRAIRIES.md:173.
def audio(
  resolves:audio,
  name:audio,
  resolvedBy:"runtime-audio",
  section:controls
)

// @description Oscillator waveform (Web Audio)
control wave(
  args(type),
  values(sine, triangle, square, sawtooth),
  value:triangle,
  scope(symbol, group, rule, flow)
)

// @description Envelope attack in ms (Web Audio)
control attack(
  args(ms),
  range(1, 5000),
  unit:"ms",
  value:20,
  scope(symbol, group, rule, flow)
)

// @description Envelope release in ms (Web Audio)
control release(
  args(ms),
  range(1, 5000),
  unit:"ms",
  value:100,
  scope(symbol, group, rule, flow)
)

// @description Detune in cents (Web Audio)
control detune(
  args(cents),
  range(-1200, 1200),
  unit:"cents",
  value:0,
  scope(symbol, group, rule, flow)
)

// @description Lowpass filter cutoff Hz (Web Audio)
control filter(
  args(freq),
  range(20, 20000),
  unit:"Hz",
  value:20000,
  scope(symbol, group, rule, flow)
)

// @description Filter resonance Q (Web Audio)
control filterQ(
  args(value),
  range(0, 30),
  value:1,
  scope(symbol, group, rule, flow)
)

// @description Actor gain \u2014 a permanent stage between an actor's voices and the master. The audio runtime converts this value into linear
// gain.
control volume(
  implements:expression.volume,
  args(value),
  range(0, 127),
  scope(symbol, group, rule, flow, scene)
)
`, "fichier": "audio.bpsl" }, { "nom": "core", "format": "bpsl", "texte": 'expression\nmidi\naudio\ntranspo\nengine\ntime\nvariation\neval\nmidi_default\n\n// @documented\n// @description BPscript core \u2014 rests, prolongation, engine controls, BASE for scene defaults\ndef core(\n  resolves:core,\n  name:core,\n  version:"0.2.0",\n  symbols(),\n  section:defaults\n)\n\ndef components(alphabet:western, tuning:western_12TET, transport:audio, eval:js)\n\ndef values(\n  // @description Reference pitch (Hz). The default comes from the `diapason` field of the EFFECTIVE ALPHABET (actor ?? scene `alphabet.X`\n  // ?? default alphabet `core`, `components.alphabet`) \u2014 the anchor is a property of the note system, not of the tuning (see\n  // SCENE_DEFAULTS_CASCADE.md). Overridable with `diapason:N` at the head of a scene, or `(diapason:N)` on one occurrence. When the\n  // alphabet is unresolved, the value stays ABSENT (downstream resolves it).\n  diapason(\n    range(16, 8000),\n    unit:Hz,\n    overriddenBy(tuning.diapason, alphabet.diapason)\n  )\n)\n\n// @description Derivation failure handling\ndef on_fail(\n  section:settings,\n  type:directive,\n  values("skip", "retry", "fallback"),\n  value:skip\n)\n', "fichier": "core.bpsl" }, { "nom": "engine", "format": "bpsl", "texte": `types

// @documented
// @description The keys the DERIVATION ENGINE consumes \u2014 what governs how production unfolds, as opposed to what it produces. HEADER
// library, resolved by BPx.
def engine(
  resolves:engine,
  resolvedBy:"BPx",
  name:engine,
  version:1.0.0
)

// @description NATIVE gesture: reseeds the random generator DURING derivation. In-flow reseeding is written ![seed:42] and reaches the tree
// as an InstantControl carrying flux:true, distinct from the scene setting seed:42.
control srand(
  bp3:_srand,
  bpscript:false,
  args(seed),
  section:controls
)
// @description NATIVE gesture: prints the work string in the trace window of the original engine. BPScript has no such window and no reason
// to expose the word; it is declared so that the BP3 frontend can route the grammars that write it.
control print(
  bp3:_print,
  bpscript:false,
  section:controls
)

// @description Derivation mode of the block/subgrammar (rnd, ord, sub, sub1, lin, tem, poslong) -- default: ord.
control mode(
  args(mode),
  values(rnd, ord, sub, sub1, lin, tem, poslong),
  value:ord,
  scope(subgrammar),
  section:engine
)
// @description Traversal direction per rule (left, right, rnd) -- default: rnd.
control scan(
  args(direction),
  values(left, right, rnd),
  value:rnd,
  scope(scene, rule),
  section:engine
)
// @description Rule weight -- an integer, 'inf' for absolute priority, or a K-param.
control weight(
  args(value),
  scope(rule),
  section:engine
)
// @description Rule weights go back to the value written in the grammar. Image of ResetWeights in the native engine.
control resetweights(
  bp3:ResetWeights,
  bp3value:1,
  scope(scene),
  section:engine
)
// @description Rule weights keep the value where derivation left them. Image of ResetWeights in the native engine.
control keepweights(
  bp3:ResetWeights,
  bp3value:0,
  scope(scene),
  section:engine
)
// @description Derivation failure handling (skip, retry(N), fallback(X)) -- default: skip. No 'values' enum: retry and fallback take an
// ARGUMENT ('retry(2)', 'fallback(Autre)').
control on_fail(
  args(strategy),
  value:skip,
  scope(scene, rule),
  section:engine
)
// @description Signature rythmique -- (meter:7/8), (meter:4+4/4).
control meter(
  args(signature),
  scope(scene, rule),
  section:engine
)
// @description Controlled repetition. expr = K-param or K-param=value.
control repeat(
  bp3:_repeat,
  scope(rule),
  args(expr),
  section:engine
)
// @description Jump on derivation failure.
control failed(
  bp3:_failed,
  scope(rule),
  args(subgrammar, rule),
  section:engine
)
// @description Stop derivation.
control stop(bp3:_stop, scope(rule), section:engine)
// @description Jump to specific subgrammar and rule.
control goto(
  bp3:_goto,
  scope(rule),
  args(subgrammar, rule),
  section:engine
)
// @description Retrograde \u2014 reverse element order. flow SCOPE ONLY: the marker acts on what FOLLOWS, and its reach stops on a closing
// bracket.
control retro(
  bp3:_retro,
  scope(flow),
  section:engine
)
// @description Shuffle \u2014 random reordering of sequence elements. seed arg \u2192 _srand(N) prefix. flow SCOPE ONLY: the marker acts on what
// FOLLOWS, like retro.
control shuffle(
  bp3:_rndseq,
  args(seed),
  scope(flow),
  section:engine
)
// @description Order \u2014 restore canonical order of sequence elements. PORTEE flow UNIQUEMENT : voir retro.
control order(
  bp3:_ordseq,
  scope(flow),
  section:engine
)
// @description Rotate \u2014 cyclic rotation of sequence by N positions (engine, temporal). PORTEE flow UNIQUEMENT : voir retro. Distinct from
// runtime (rotate) which is a pitch transformation.
control rotate(
  bp3:_rotate,
  args(degrees),
  scope(flow),
  section:engine
)
// @description Staccato \u2014 shorten note durations (affects temporal structure)
control staccato(
  bp3:_staccato,
  args(value),
  range(0, 127),
  scope(symbol, group, rule, flow),
  section:engine
)
// @description Legato \u2014 extend note durations (affects temporal structure)
control legato(
  bp3:_legato,
  args(value),
  range(0, 1000),
  scope(symbol, group, rule, flow),
  section:engine
)
// @description Random timing jitter \u2014 displaces note attacks by \xB1N ms (temporal). Like staccato/legato, a current-parameter control, not a
// reorder.
control rndtime(
  bp3:_rndtime,
  args(amount),
  range(0, 32767),
  unit:"ms",
  scope(scene, symbol, group, rule, flow),
  section:engine
)
// @description Destructure composed terminals based on alphabet
control destru(
  bp3:_destru,
  scope(subgrammar, rule),
  section:engine
)

// @description Random draw seed -- seed:N freezes the derivation; without it, the draw is random. BP3 Seed. Also written in the flow,
// ![seed:N], where it translates the native _srand(N).
control seed(
  args(value),
  scope(scene, flow),
  section:engine
)
// @description Maximum number of items produced by the derivation (BP3 MaxItemsProduce).
control maxitems(
  args(count),
  scope(scene),
  section:engine
)
// @description Alias of maxitems (BP3 MaxItemsProduce).
control items(
  args(count),
  scope(scene),
  section:engine
)
// @description Produces every possible item, disables improvize (BP3 AllItems).
control allitems(
  scope(scene),
  section:engine
)
// @description Alias of allitems (BP3 AllItems).
control all_items(scope(scene), section:engine)
// @description Endless continuous derivation (BP3 Improvize).
control improvize(
  scope(scene),
  section:engine
)
// @description Placement tolerance in ms (BP3 Quantization). Not a grid: no event boundary falls on a multiple of this value. It is
// compared to the piece's internal step u and yields a grouping factor k = floor(value/u)+1, which the engine reports as its compression
// rate. k=1 leaves the output unchanged to the byte. k>1 recasts instants onto a coarser table: distinct events share boundaries, the piece
// lengthens, the start leaves zero.
control quantization(
  args(value),
  unit:"ms",
  scope(scene),
  section:engine
)
// @description Period of the Q metronome (BP3 Qclock).
control qclock(
  args(period),
  scope(scene),
  section:engine
)
// @description A time pattern is a duration ratio carrying a name -- timepatterns: t1=1/1, t2=3/2, ... It is declared at the head, its name
// is then written in a polymetric expression, and it occupies time without sounding. LANGUAGE.md, section Les motifs temporels.
control timepatterns(
  args(patterns),
  scope(scene),
  section:engine
)

// @description Re-seed RNG from clock at production start (BP3 _randomize preamble, Encode.c case 50)
control randomize(
  bp3:_randomize,
  scope(subgrammar, flow, scene),
  bagOnly:true,
  section:subgrammar
)
// @description Striated time (pulsed)
control striated(
  bp3:_striated,
  scope(subgrammar, scene),
  unicite:nature-du-temps,
  section:subgrammar
)
// @description Smooth time (non-pulsed)
control smooth(
  bp3:_smooth,
  scope(subgrammar, scene),
  unicite:nature-du-temps,
  section:subgrammar
)
`, "fichier": "engine.bpsl" }, { "nom": "eval", "format": "bpsl", "texte": "// @documented\ndef eval(resolvedBy:runtime-codevoices, resolves:eval, name:eval, type:code, section:objects)\n\n// @description Patterns and samples, in the browser.\ndef strudel(\n  parameters(\n    // @description The sample bank the voice loads. Without it, a scene using sample names plays SILENT.\n    bank()\n  )\n)\n\n// @description Visual synthesis.\ndef hydra()\n\n// @description SuperCollider \u2014 audio synthesis, native backend.\ndef sc()\n\n// @description JavaScript evaluated by the runtime.\ndef js()\n\n// @description TypeScript \u2014 the language of library bodies, transpiled then executed by the resolver the library names.\ndef ts()\n\n// @description Croquis graphiques p5.js.\ndef p5()\n\n// @description Live coding minimal.\ndef mercury()\n\n// @description Csound \u2014 synthesis, native backend.\ndef csound()\n\n// @description TidalCycles \u2014 motifs, backend natif (SuperDirt).\ndef tidal()\n\n// @description Literal text, evaluated by no one. Carries a SENTENCE where the language has no escape character: a library description, a\n// label.\ndef txt()\n", "fichier": "eval.bpsl" }, { "nom": "expression", "format": "bpsl", "texte": `types

// @documented
// @description Controls describing HOW a note is played, valid for EVERY output \u2014 not one specific transport (LIBRAIRIES.md:171,217-219: \xAB
// expression is no exception\u2026 it is A destination, a class named by what it describes \xBB).
def expression(
  resolves:expression,
  resolvedBy:"toutes les sorties",
  name:expression,
  section:controls
)

// @description Volume of a voice. MIDI realizes it as CC7; every output declares its own realization.
control volume(
  args(value),
  range(0, 127),
  scope(symbol, group, rule, flow, scene)
)

// @description Velocity (0-127). WebAudio: gain, MIDI: NoteOn velocity
control vel(
  bp3:_vel,
  args(value),
  range(0, 127),
  value:64,
  scope(symbol, group, rule, flow, scene)
)

// @description Pan (0=left, 64=center, 127=right). WebAudio: StereoPanner, MIDI: CC10
control pan(
  bp3:_pan,
  args(value),
  range(0, 127),
  value:64,
  scope(symbol, group, rule, flow, scene)
)

// @description Panning in CONTINUOUS mode \u2014 the value glides DURING notes, through intermediate messages. Its two discrete siblings live in
// the variation library; their recipient is read on that file's resolvedBy field, never here.
control pancont(
  bp3:_pancont,
  scope(symbol, group, rule, flow)
)

// @description Random velocity +/-range
control rndvel(
  bp3:_rndvel,
  args(range),
  value:0,
  scope(symbol, group, rule, flow)
)

// @description Velocity in CONTINUOUS mode \u2014 the value glides DURING notes, through intermediate messages. Its two discrete siblings live
// in the variation library; their recipient is read on that file's resolvedBy field. On the native engine, continuous velocity yields bytes
// identical to steps.
control velcont(
  bp3:_velcont,
  scope(symbol, group, rule, flow)
)

// @description NoteOff velocity (0-127). Relevant for expressive controllers (Osmose, MPE)
control offvel(
  args(value),
  range(0, 127),
  value:64,
  scope(symbol, group, rule, flow)
)

// @description Articulation in CONTINUOUS mode \u2014 the value glides DURING notes. Its two discrete siblings, articulfixed and articulstep,
// live in the variation library. The native behaviour of this word is unsettled: on engine v3.5.1-iso.2 no mode moves articulation, fixed
// included.
control articulcont(
  bp3:_articulcont,
  scope(symbol, group, rule, flow)
)

// @description NATIVE gesture: gives a value to a named performance parameter. In BPScript the form is !(<param>:<value>), the parameter
// being declared by its TYPE at the head -- signal <param> -- and it is the KEY.
control value(
  bp3:_value,
  bpscript:false,
  args(param)
)

// @description NATIVE gesture: the named parameter DOES NOT VARY. In BPScript: !(<param>fixed), the mode glued to the parameter.
control fixed(
  bp3:_fixed,
  bpscript:false,
  args(param)
)

// @description NATIVE gesture: the named parameter varies CONTINUOUSLY. In BPScript: !(<param>cont).
control cont(
  bp3:_cont,
  bpscript:false,
  args(param)
)

// @description NATIVE gesture: the named parameter varies BY STEPS. In BPScript: !(<param>step). Never declared as a word of the language
// -- it enters here through the routing door, not the vocabulary one.
control step(
  bp3:_step,
  bpscript:false,
  args(param)
)

// @description Rate of intermediate values for continuous panning, in values per second. Default 50, like the native engine.
control panrate(
  bp3:_panrate,
  args(hz),
  range(0, 1000),
  unit:"Hz",
  value:50,
  scope(symbol, group, rule, flow)
)
`, "fichier": "expression.bpsl" }, { "nom": "homomorphism/homomorphism", "format": "bpsl", "texte": "def homomorphism(\n  resolvedBy:Kairos,\n  name:homomorphism,\n  type:homomorphism,\n  resolves:homomorphism,\n  section:tables\n) ``ts:\n// Corps du PROTOTYPE `homomorphism` \u2014 l'applicateur, AUTHORING F1 (vrai .ts TYP\xC9 contre le SDK Kairos).\n// Source de v\xE9rit\xE9 : ce fichier. Le chargeur le greffe sur le prototype de la famille, dont CHAQUE\n// table h\xE9rite (Romain, 2026-09-03) : la section de l'arbre joint donc l'applicateur avec la table\n// qui l'emploie. `substitute` n'est plus un objet \xE0 part \u2014 une manipulation est un mot, pas une entr\xE9e\n// d\xE9clar\xE9e dans lib/homomorphism.bpsl \u2192 libs-data.js.\n// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis ex\xE9cute au load, en BAC \xC0 SABLE d\xE9terministe.\n// \u26A0\uFE0F SUBSTITUTION DE SYMBOLE (homomorphisme BP3 `-ho`/`-al`) sortie de BPx \u2192 R\xC9SOLUTION Kairos, VIA\n//    LIBRAIRIE (d\xE9cision Romain/architecte 2026-07-17, hub/decisions/2026-07-17-bpx-ordonnanceur-opaque-\n//    homomorphisme-en-resolution-kairos-librairie.md, RATIFI\xC9E). BPx devient ordonnanceur PUR : il PORTE\n//    la port\xE9e opaque (`content.homoScope`) + les TABLES plates (`metadata.homomorphisms`), il NE SUBSTITUE\n//    PLUS. Kairos applique la substitution AVANT la r\xE9solution de hauteur, puis r\xE9sout nom\u2192hz/octave.\nimport type { HomomorphismFn } from '@kairos/core';\n\n/** substitute \u2014 applicateur G\xC9N\xC9RIQUE et UNIVERSEL d'homomorphisme (pure r\xE9\xE9criture de symbole). It\xE8re la\n *  port\xE9e active haut\u2192bas ; pour chaque nom d'homo, remplace le symbole courant par son image dans la TABLE\n *  PLATE (paires last-write-wins) que Kairos adosse via `ctx.image(nom, sym)`. Symbole absent d'une table =\n *  IDENTIT\xC9 (s\xE9mantique BP3 CompileGrammar.c:873, jamais un cri). Un m\xEAme homo empil\xE9 `k` fois s'applique\n *  `k` fois (la multiplicit\xE9 est port\xE9e par la port\xE9e) ; des homos diff\xE9rents s'appliquent en s\xE9quence.\n *  Mod\xE8le PROUV\xC9 sur l'oracle natif transposition1 ([373], BPx loadGrammar.ts:6370-6394) : table plate\n *  IT\xC9R\xC9E (C3 aux profondeurs 0/1/2/3 = C3/B4/F6/F6), PAS depth-index\xE9. PORTER\u2260R\xC9SOUDRE : je query, je ne\n *  d\xE9plie ni ne connais la table brute. */\nconst substitute: HomomorphismFn = (ctx) => {\n  let s = ctx.symbol;\n  for (const name of ctx.scope) s = ctx.image(name, s) ?? s;\n  ctx.setResult(s);\n};\n\nexport default substitute;\n``\n", "fichier": "homomorphism/homomorphism.bpsl" }, { "nom": "homomorphism", "format": "bpsl", "texte": `homomorphism/homomorphism
// @documented
def homomorphism(
  resolvedBy:Kairos,
  name:homomorphism,
  type:homomorphism,
  resolves:homomorphism,
  section:tables
)

// @description Tabla open\u2192closed stroke mapping (qa'ida)
homomorphism tabla_stroke(
  mappings(dha:ta, dhin:tin, ge:ke, ghe:khe, dhagena:takena, dheene:teene, dheena:teena)
)

// @description Ruwet \u2014 major \u2192 minor theme transformation (DEPRECATED)
homomorphism ruwet_mineur(
  mappings(fa4:re4, la4:fa4, sol4:mi4)
)

// @description Ruwet \u2014 3 melodic transformations (faithful to bp3-engine/test-data/-ho.Ruwet)
homomorphism ruwet(
  sections(m1(la4:sib4), m2(la4:sol4), mineur(fa4:re4, la4:fa4))
)

// @description Dhati \u2014 tabla homomorphism (faithful to -ho.dhati, section *, identities preserved)
homomorphism dhati(
  sections("*"(dha:ta, ti:ti, ge:ke, na:na, dhee:tee, tr:tr, kt:kt))
)

// @description Dhin -- tabla homomorphism (faithful to -ho.dhin--, section *, identities preserved)
homomorphism dhin(
  sections("*"(dha:ta, ta:ta, ti:ti, ra:ra, na:na, ki:ki, dhee:tee, ne:ne, ge:ke, ka:ka, dhin:tin))
)

// @description Test homomorphism (faithful to -ho.tryhomomorphism, chain c-->fa4-->d unfolded)
homomorphism tryhomomorphism(
  sections("*"(a:b, do4:re4, c:fa4, fa4:d))
)

// @description Test homomorphism \u2014 3 sections (*, H, TR)
homomorphism checkhomo(
  sections("*"(a:"a'", "a'":"a""", b:"b'", "b'":b), H(a:c, c:"c'", "c'":"a"""), TR("a'":"b'", "b'":b))
)

// @description Auto-transposer H. Visser 1997 \u2014 CHAIN homomorphism (faithful to bp3-engine/test-data/-ho.transposition, section TR, 3
// chains indexed by invocation depth)
homomorphism transposition(
  sections(TR(chains(C3(B3, F4, C6), B3(C3, B4, F6), F4(C6, F2, B5))))
)

// @description Ruwet homomorphism, faithful to bp3-engine/test-data/-ho.Ruwet, section by section and link by link.
homomorphism Ruwet(
  sections(m1(chains(la4(sib4))), m2(chains(la4(sol4))), mineur(chains(fa4(re4), la4(fa4))))
)

// @description Homomorphism faithful to bp3-engine/test-data/-ho.abc, section by section and link by link.
homomorphism abc(
  sections(
    "*"(
      chains(
        a("a'"),
        b("b'"),
        c("c'"),
        d("d'"),
        e("e'"),
        f("f'"),
        g("g'"),
        h("h'"),
        i("i'"),
        j("j'"),
        k("k'"),
        l("l'"),
        m("m'"),
        n("n'"),
        o("o'"),
        p("p'"),
        q("q'"),
        r("r'"),
        s("s'"),
        t("t'"),
        u("u'"),
        v("v'"),
        w("w'"),
        x("x'"),
        y("y'"),
        z("z'")
      )
    ),
    TR(chains(a(b), b(c), c(d)), sync:true)
  )
)

// @description Homomorphism faithful to bp3-engine/test-data/-ho.abc1, section by section and link by link.
homomorphism abc1(
  sections(chik(chains(a("a'"), b("b'"), c("c'"), d("d'"))), e(chains(f("f'"), g("g'"))))
)

// @description Homomorphism faithful to bp3-engine/test-data/-ho.abc2. Its section is \`sync\`, not \`*\`: the file writes \`*\` then \`sync\` with
// no separator, and a LABEL FOLLOWING A LABEL REPLACES IT \u2014 the native opens a section only on a separator.
homomorphism abc2(
  sections(
    sync(
      chains(
        a("a'"),
        b("b'"),
        c("c'"),
        d("d'"),
        e("e'"),
        f("f'"),
        g("g'"),
        h("h'"),
        i("i'"),
        j("j'"),
        k("k'"),
        l("l'"),
        m("m'"),
        n("n'"),
        o("o'"),
        p("p'"),
        q("q'"),
        r("r'"),
        s("s'"),
        t("t'"),
        u("u'"),
        v("v'"),
        w("w'"),
        x("x'"),
        y("y'"),
        z("z'")
      )
    )
  )
)

// @description Homomorphism faithful to bp3-engine/test-data/-ho.abc3, section by section and link by link.
homomorphism abc3(
  sections(
    "*"(
      chains(
        a("a'"),
        b("b'"),
        c("c'"),
        d("d'"),
        e("e'"),
        f("f'"),
        g("g'"),
        h("h'"),
        i("i'"),
        j("j'"),
        k("k'"),
        l("l'"),
        m("m'"),
        n("n'"),
        o("o'"),
        p("p'"),
        q("q'"),
        r("r'"),
        s("s'"),
        t("t'"),
        u("u'"),
        v("v'"),
        w("w'"),
        x("x'"),
        y("y'"),
        z("z'")
      )
    ),
    TR(chains(a(b), b(c), c(d)), sync:true)
  )
)

// @description Bells \u2014 CHAIN homomorphism, faithful to bp3-engine/test-data/-ho.cloches1 (section TR, 4 chains indexed by invocation
// depth). A chain does not say \xAB do3 becomes mib3 \xBB: it says \xAB on the first call mib3, on the second fa#3, on the third la4 \xBB.
homomorphism cloches1(
  sections(
    TR(
      chains(
        do3(mib3, fa#3, la4, do4, mib4, fa#4, la5),
        sol3(si4, re#4, sol4, si5),
        re3(mi4, fab4, fa3, fa4),
        mi3(re4, reb3, do#4)
      ),
      terminaux_sans_image(re5, mi5)
    )
  )
)

homomorphism dhadhatite(default(dha:ta, ti:ti, te:te, na:na, dhee:tee, tr:tr))

homomorphism dhin--(
  default(dha:ta, ta:ta, ti:ti, ra:ra, na:na, ki:ki, dhee:tee, ne:ne, ge:ke, ka:ka, dhin:tin)
)

homomorphism tabla(default(dha:ta, dhin:tin, dhee:tee, ge:ke))

// @description Homomorphism faithful to bp3-engine/test-data/-ho.trial.mohanam, section by section and link by link.
homomorphism trial_mohanam(
  sections(trn(chains(sa6(ga6), re6(pa6), ga6(dha6), pa6(sa7), dha6(re7), sa7(ga7))))
)
`, "fichier": "homomorphism.bpsl" }, { "nom": "midi", "format": "bpsl", "texte": 'types\n\n// @documented\n// @description Controls specific to the MIDI transport \u2014 EXACT match with LIBRAIRIES.md:172.\ndef midi(\n  resolves:midi,\n  resolvedBy:"runtime-MIDI",\n  name:midi,\n  section:controls\n)\n\n// @description Address channel, short form of channel.\ndef ch(\n  section:schema.addressKeys,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Address channel, long form of ch.\ndef channel(\n  section:schema.addressKeys,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Device targeted by the address.\ndef device(\n  section:schema.addressKeys,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Note number of an address \u2014 the source a wait point listens to, the event an occurrence targets.\ndef note(\n  section:schema.addressKeys,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Port targeted by the address.\ndef port(\n  section:schema.addressKeys,\n  scope(symbol, group, rule, flow)\n)\n\n// @description MIDI channel\ncontrol chan(\n  bp3:_chan,\n  args(channel),\n  range(1, 16),\n  scope(symbol, group, rule, flow)\n)\n\n// @description MIDI Program Change. The author writes the program number starting at 1, like the original engine; the byte transmitted is\n// that number minus one.\ncontrol ins(\n  bp3:_ins,\n  args(program),\n  range(1, 128),\n  scope(symbol, group, rule, flow, scene)\n)\n\n// @description MIDI Modulation (CC1)\ncontrol mod(\n  bp3:_mod,\n  args(value),\n  range(0, 127),\n  scope(symbol, group, rule, flow)\n)\n\n// @description Enable continuous modulation interpolation (CC1)\ncontrol modcont(\n  bp3:_modcont,\n  scope(symbol, group, rule, flow)\n)\n\n// @description MIDI Pitch Bend\ncontrol pitchbend(\n  bp3:_pitchbend,\n  args(value),\n  range(-8192, 8191),\n  scope(symbol, group, rule, flow)\n)\n\n// @description Pitch bend range in cents\ncontrol pitchrange(\n  bp3:_pitchrange,\n  args(cents),\n  unit:"cents",\n  scope(symbol, group, rule, flow)\n)\n\n// @description Enable continuous pitch bend interpolation\ncontrol pitchcont(\n  bp3:_pitchcont,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Key mapping \u2014 remap MIDI key range (p1,p2) to (q1,q2). Args are key numbers (0..127) or note names; p2 must be greater than\n// p1. BP3 _keymap \u2014 register of the native engine, bp3-engine `origin/wasm`: capture-run/console_strings.json carries \xAB 62 4 _keymap \xBB.\ncontrol keymap(\n  bp3:_keymap,\n  args(p1, q1, p2, q2),\n  range(0, 127),\n  scope(symbol, group, rule, flow)\n)\n\n// @description Key map in CONTINUOUS mode \u2014 the map glides DURING notes, through intermediate messages. BP3 _mapcont \u2014 register of the\n// native engine, bp3-engine `origin/wasm`: capture-run/console_strings.json carries \xAB 44 0 _mapcont \xBB. Its two discrete siblings live in\n// the variation library; their recipient is read on that file\'s resolvedBy field, never here.\ncontrol mapcont(\n  bp3:_mapcont,\n  scope(symbol, group, rule, flow)\n)\n\n// @description MIDI Channel Pressure (aftertouch)\ncontrol pressure(\n  bp3:_press,\n  args(value),\n  range(0, 127),\n  scope(symbol, group, rule, flow)\n)\n\n// @description Enable continuous channel pressure interpolation\ncontrol presscont(\n  bp3:_presscont,\n  scope(symbol, group, rule, flow)\n)\n\n// @description MIDI Volume (CC7)\ncontrol volume(\n  implements:expression.volume,\n  bp3:_volume,\n  args(value),\n  range(0, 127),\n  scope(symbol, group, rule, flow, scene)\n)\n\n// @description Enable continuous volume interpolation\ncontrol volumecont(\n  bp3:_volumecont,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Enable MIDI switch channel\ncontrol switchon(\n  bp3:_switchon,\n  args(channel),\n  scope(symbol, group, rule, flow)\n)\n\n// @description Disable MIDI switch channel\ncontrol switchoff(\n  bp3:_switchoff,\n  args(channel),\n  scope(symbol, group, rule, flow)\n)\n\n// @description Mutes the sound. Bare, (mute), mutes everything sounding; per component, (mute.all) or (mute.lead), mutes the named target.\ncontrol mute(\n  scope(flow),\n  bagOnly:true\n)\n\n// @description Restores the sound muted by mute. Same graphy: (unmute) or (unmute.lead).\ncontrol unmute(\n  scope(flow),\n  bagOnly:true\n)\n\n// @description Emergency stop: every note released, every controller reset flat. Image of MIDI all notes off. Takes no argument.\ncontrol panic(\n  scope(flow),\n  bagOnly:true\n)\n\n// @description Real-time system synchronization message: (sync:start), (sync:continue), (sync:stop). Image of the MIDI Start/Continue/Stop\n// messages.\ncontrol sync(\n  args(message),\n  values(start, continue, stop),\n  scope(flow)\n)\n\n// @description NUMBERED MIDI controller. Designated by its component number: (cc.98:45) in a container, !(cc.98:45) in flow. For\n// controllers with no named alias -- those that have one are written by their name (mod = CC1, volume = CC7). The dot CALLS the component,\n// the colon ASSIGNS the value.\ncontrol cc(\n  component:number,\n  args(value),\n  range(0, 127),\n  scope(symbol, group, rule, flow)\n)\n\n// @description Rate of intermediate values for continuous volume, in values per second. Default 50, like the native engine.\ncontrol volumerate(\n  bp3:_volumerate,\n  args(hz),\n  range(0, 1000),\n  unit:"Hz",\n  scope(symbol, group, rule, flow)\n)\n\n// @description Rate of intermediate values for continuous modulation, in values per second. Default 50, like the native engine.\ncontrol modrate(\n  bp3:_modrate,\n  args(hz),\n  range(0, 1000),\n  unit:"Hz",\n  scope(symbol, group, rule, flow)\n)\n\n// @description Rate of intermediate values for continuous pitch, in values per second. Default 50, like the native engine.\ncontrol pitchrate(\n  bp3:_pitchrate,\n  args(hz),\n  range(0, 1000),\n  unit:"Hz",\n  scope(symbol, group, rule, flow)\n)\n\n// @description Rate of intermediate values for continuous pressure, in values per second. Default 50, like the native engine.\ncontrol pressrate(\n  bp3:_pressrate,\n  args(hz),\n  range(0, 1000),\n  unit:"Hz",\n  scope(symbol, group, rule, flow)\n)\n\n// @description Rate of intermediate values for ALL continuous streams, in emissions per second. Sets in one word what volumerate, modrate,\n// pitchrate and pressrate set separately. Image of SamplingRate in the native engine.\ncontrol rate(\n  bp3:SamplingRate,\n  args(hz),\n  range(0, 1000),\n  unit:"Hz",\n  scope(scene)\n)\n\n// @description Number of the MIDI controller carrying volume. Image of VolumeController in the native engine. The channel is stated in the\n// same bag: !(chan:3, volumecontrol:11).\ncontrol volumecontrol(\n  bp3:_volumecontrol,\n  args(controller),\n  range(0, 127),\n  scope(symbol, group, rule, flow, scene)\n)\n\n// @description Number of the MIDI controller carrying panning. Image of PanoramicController in the native engine. The channel is stated in\n// the same bag: !(chan:3, pancontrol:11).\ncontrol pancontrol(\n  bp3:_pancontrol,\n  args(controller),\n  range(0, 127),\n  scope(symbol, group, rule, flow, scene)\n)\n\n// @description Sound fade-out at the end of the performance, in SECONDS. A value of zero or less removes the fade. Image of EndFadeOut in\n// the native engine.\ncontrol fadeout(\n  bp3:EndFadeOut,\n  args(duration),\n  unit:"s",\n  scope(scene)\n)\n\n// @description At the end of the scene, silence whatever is still sounding.\ncontrol resetnotes(\n  bp3:ResetNotes,\n  bp3value:1,\n  scope(flow, scene),\n  bagOnly:true,\n  unicite:fin-de-scene\n)\n\n// @description At the end of the scene, let whatever is still sounding ring on.\ncontrol letring(\n  bp3:ResetNotes,\n  bp3value:0,\n  scope(flow, scene),\n  bagOnly:true,\n  unicite:fin-de-scene\n)\n\n// @description A note already held that is replayed is RETRIGGERED \u2014 a new NoteOn.\ncontrol strikeagain(\n  bp3:StrikeAgainDefault,\n  bp3value:1,\n  scope(flow, scene),\n  bagOnly:true,\n  unicite:note-rejouee\n)\n\n// @description A note already held that is replayed stays HELD \u2014 no new NoteOn.\ncontrol sustain(\n  bp3:StrikeAgainDefault,\n  bp3value:0,\n  scope(flow, scene),\n  bagOnly:true,\n  unicite:note-rejouee\n)\n\n// @description A switch already pressed that is re-actuated is released then pressed again.\ncontrol pedalrelease(\n  scope(flow, scene),\n  bagOnly:true,\n  unicite:interrupteur-rejoue\n)\n\n// @description A switch already pressed that is re-actuated keeps its state.\ncontrol pedalhold(\n  scope(flow, scene),\n  bagOnly:true,\n  unicite:interrupteur-rejoue\n)\n\n// @description At the end of the scene, reset the controllers flat.\ncontrol resetcontrols(\n  bp3:ResetControllers,\n  bp3value:1,\n  scope(flow, scene),\n  bagOnly:true,\n  unicite:fin-des-controleurs\n)\n\n// @description At the end of the scene, leave the controllers in the state the scene put them in.\ncontrol keepcontrols(\n  bp3:ResetControllers,\n  bp3value:0,\n  scope(flow, scene),\n  bagOnly:true,\n  unicite:fin-des-controleurs\n)\n', "fichier": "midi.bpsl" }, { "nom": "midi_default", "format": "bpsl", "texte": 'types\n\n// @documented\n// @description THE DEFAULT MIDI ENVIRONMENT \u2014 the value each word of `midi` carries until a scene writes another.\ndef midi_default(\n  resolvedBy:runtime-MIDI,\n  resolves:midi_default,\n  name:midi_default,\n  version:"0.2.0"\n)\n\nchan:1\nmod:0\npitchbend:0\npitchrange:200\npressure:0\nvolume:90\nvolumerate:50\nmodrate:50\npitchrate:50\npressrate:50\nrate:50\nvolumecontrol:7\npancontrol:10\nfadeout:2\nresetnotes:false\nletring:true\nstrikeagain:true\nsustain:false\npedalrelease:true\npedalhold:false\nresetcontrols:false\nkeepcontrols:true\n', "fichier": "midi_default.bpsl" }, { "nom": "octaves", "format": "bpsl", "texte": 'types\n\n// @documented\ndef octaves(resolvedBy:"Kairos", resolves:octaves)\n\noctaves western(\n  position:suffix,\n  separator:"",\n  registers("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),\n  default:"4"\n)\n\noctaves arrows(position:suffix, separator:"_", registers(vv, v, "", "^", "^^"), default:"")\n\noctaves saptak(position:prefix, separator:"_", registers(mandra, madhya, taar), default:madhya)\n\noctaves turkish(position:prefix, separator:"_", registers("", tiz), default:"")\n\noctaves gamelan(position:prefix, separator:"_", registers(ageng, tengah, alit), default:tengah)\n\noctaves shakuhachi(position:prefix, separator:"_", registers(otsu, kan, daikan), default:otsu)\n\noctaves korean(position:prefix, separator:"_", registers(tak, jung, cheong), default:jung)\n\noctaves saptak_us(\n  position:suffix,\n  separator:"_",\n  registers("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),\n  default:"4"\n)\n\noctaves bp3(\n  position:suffix,\n  separator:"",\n  registers("00", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),\n  default:"4"\n)\n\noctaves bp3_fr(\n  position:suffix,\n  separator:"",\n  registers("000", "00", "0", "1", "2", "3", "4", "5", "6", "7", "8"),\n  default:"3"\n)\n', "fichier": "octaves.bpsl" }, { "nom": "scales", "format": "bpsl", "texte": `types

// @documented
def scales(resolvedBy:"Kairos", resolves:scale)

// @description Maqam Sikah \u2014 starts on sikah (E half-flat) \u2014 Ratios = zalzalian just intonation (5-limit; neutral third 27/22). Source of
// truth; 24-TET is a rendering projection, not the ontology. [jins decomposition TO BE ESTABLISHED (musicological verification); exact
// ratios kept meanwhile].
interval maqam_sikah(
  culture:arabic,
  notes_count:7,
  ratios(1, 12/11, 27/22, 4/3, 16/11, 18/11, 11/6),
  system:"zalzal-ji"
)
// @description Maqam Jiharkah \u2014 Rast-like with lowered 7th \u2014 Ratios = zalzalian just intonation (5-limit; neutral third 27/22). Source of
// truth; 24-TET is a rendering projection, not the ontology. [jins decomposition TO BE ESTABLISHED (musicological verification); exact
// ratios kept meanwhile].
interval maqam_jiharkah(
  culture:arabic,
  notes_count:7,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 5/3, 11/6),
  system:"zalzal-ji"
)
// @description Maqam Suzidil \u2014 Ajam lower + Hijaz Kar upper \u2014 Ratios = zalzalian just intonation (5-limit; neutral third 27/22). Source of
// truth; 24-TET is a rendering projection, not the ontology. [jins decomposition TO BE ESTABLISHED (musicological verification); exact
// ratios kept meanwhile].
interval maqam_suzidil(
  culture:arabic,
  notes_count:7,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 8/5, 15/8),
  system:"zalzal-ji"
)
// @description Maqam Shawq Afza \u2014 Sikah-based, emotional character \u2014 Ratios = zalzalian just intonation (5-limit; neutral third 27/22).
// Source of truth; 24-TET is a rendering projection, not the ontology. [jins decomposition TO BE ESTABLISHED (musicological verification);
// exact ratios kept meanwhile].
interval maqam_shawq_afza(
  culture:arabic,
  notes_count:7,
  ratios(1, 12/11, 6/5, 4/3, 3/2, 5/3, 11/6),
  system:"zalzal-ji"
)
// @description Jins Nikriz \u2014 4-note tetrachord with augmented second [zalzalian JI ratios (from 24-TET degrees)].
interval jins_nikriz(
  culture:arabic,
  temperament:"24TET",
  notes_count:4,
  ratios(1, 9/8, 6/5, 45/32)
)
// @description Jins Athar Kurd \u2014 Kurd variant with raised 3rd [zalzalian JI ratios (from 24-TET degrees)].
interval jins_athar_kurd(
  culture:arabic,
  temperament:"24TET",
  notes_count:4,
  ratios(1, 16/15, 6/5, 45/32)
)
// @description Jins Saba Zamzam \u2014 Saba variant with flat 2nd and 4th [zalzalian JI ratios (from 24-TET degrees)].
interval jins_saba_zamzam(
  culture:arabic,
  temperament:"24TET",
  notes_count:4,
  ratios(1, 16/15, 6/5, 5/4)
)
// @description Jins Mustaar \u2014 rare 3-note jins, narrow intervals [zalzalian JI ratios (from 24-TET degrees)].
interval jins_mustaar(
  culture:arabic,
  temperament:"24TET",
  notes_count:3,
  ratios(1, 12/11, 15/13)
)
// @description Gong mode \u2014 1st mode of Chinese pentatonic, Do position
interval gong(
  culture:chinese,
  ratios(1, 9/8, 81/64, 3/2, 27/16),
  notes_count:5
)
// @description Shang mode \u2014 2nd mode of Chinese pentatonic, Re position
interval shang(
  culture:chinese,
  ratios(1, 9/8, 4/3, 3/2, 16/9),
  notes_count:5
)
// @description Jue mode \u2014 3rd mode of Chinese pentatonic, Mi position
interval jue(
  culture:chinese,
  ratios(1, 32/27, 4/3, 128/81, 16/9),
  notes_count:5
)
// @description Zhi mode \u2014 4th mode of Chinese pentatonic, Sol position
interval zhi(
  culture:chinese,
  ratios(1, 9/8, 4/3, 3/2, 16/9),
  notes_count:5
)
// @description Yu mode \u2014 5th mode of Chinese pentatonic, La position
interval yu(
  culture:chinese,
  ratios(1, 32/27, 4/3, 3/2, 128/81),
  notes_count:5
)
// @description Yayue \u2014 Chinese ceremonial court music heptatonic scale
interval yayue(
  culture:chinese,
  ratios(1, 9/8, 81/64, 4/3, 3/2, 27/16, 243/128),
  notes_count:7
)
// @description Qingyue \u2014 Chinese folk heptatonic scale with minor 7th
interval qingyue(
  culture:chinese,
  ratios(1, 9/8, 81/64, 4/3, 3/2, 27/16, 16/9),
  notes_count:7
)
// @description Hirajoshi \u2014 Japanese pentatonic scale, melancholic character
interval hirajoshi(
  culture:japanese,
  ratios(1, 9/8, 6/5, 3/2, 8/5),
  notes_count:5
)
// @description In-sen \u2014 Japanese pentatonic, used in shakuhachi music
interval in_sen(
  culture:japanese,
  ratios(1, 16/15, 4/3, 3/2, 8/5),
  notes_count:5
)
// @description Yo \u2014 Japanese pentatonic, bright folk scale
interval yo(
  culture:japanese,
  ratios(1, 9/8, 4/3, 3/2, 16/9),
  notes_count:5
)
// @description Iwato \u2014 Japanese pentatonic, dark meditative scale
interval iwato(
  culture:japanese,
  ratios(1, 16/15, 4/3, 45/32, 8/5),
  notes_count:5
)
// @description Kumoi \u2014 Japanese pentatonic, koto tuning
interval kumoi(
  culture:japanese,
  ratios(1, 9/8, 6/5, 3/2, 9/5),
  notes_count:5
)
// @description Ryukyu \u2014 Okinawan pentatonic scale
interval ryukyu(
  culture:japanese,
  ratios(1, 5/4, 4/3, 3/2, 15/8),
  notes_count:5
)
// @description Miyako-bushi \u2014 Japanese urban pentatonic, used in koto and shamisen
interval miyako_bushi(
  culture:japanese,
  ratios(1, 16/15, 5/4, 3/2, 8/5),
  notes_count:5
)
// @description Pyeong-jo \u2014 Korean pentatonic mode, peaceful character
interval pyeong_jo(
  culture:korean,
  ratios(1, 9/8, 4/3, 3/2, 16/9),
  notes_count:5
)
// @description Gye-myeon-jo \u2014 Korean pentatonic mode, sorrowful character
interval gye_myeon_jo(
  culture:korean,
  ratios(1, 6/5, 4/3, 3/2, 8/5),
  notes_count:5
)
// @description Ancient Greek Dorian \u2014 descending E to E on white keys
interval dorian_ancient(
  culture:greek,
  ratios(1, 9/8, 32/27, 4/3, 3/2, 128/81, 16/9),
  notes_count:7
)
// @description Ancient Greek Phrygian \u2014 descending D to D on white keys
interval phrygian_ancient(
  culture:greek,
  ratios(1, 9/8, 81/64, 4/3, 3/2, 27/16, 243/128),
  notes_count:7
)
// @description Ancient Greek Lydian \u2014 descending C to C on white keys
interval lydian_ancient(
  culture:greek,
  ratios(1, 9/8, 81/64, 4/3, 3/2, 27/16, 16/9),
  notes_count:7
)
// @description Ancient Greek Mixolydian \u2014 descending B to B on white keys
interval mixolydian_ancient(
  culture:greek,
  ratios(1, 256/243, 32/27, 4/3, 3/2, 128/81, 16/9),
  notes_count:7
)
// @description Ancient Greek Chromatic genus tetrachord \u2014 narrow semitones + minor third
interval chromatic_genus(
  culture:greek,
  ratios(1, 28/27, 32/27, 4/3),
  notes_count:4
)
// @description Ancient Greek Enharmonic genus tetrachord \u2014 quarter-tones + major third
interval enharmonic_genus(
  culture:greek,
  ratios(1, 28/27, 16/15, 4/3),
  notes_count:4
)
// @description Medieval Ionian mode \u2014 C to C, equivalent to major scale
interval ionian(
  culture:medieval,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8),
  notes_count:7
)
// @description Medieval Dorian mode \u2014 D to D, minor with raised 6th
interval dorian(
  culture:medieval,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 5/3, 9/5),
  notes_count:7
)
// @description Medieval Phrygian mode \u2014 E to E, minor with flat 2nd
interval phrygian(
  culture:medieval,
  ratios(1, 16/15, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:7
)
// @description Medieval Lydian mode \u2014 F to F, major with raised 4th
interval lydian(
  culture:medieval,
  ratios(1, 9/8, 5/4, 45/32, 3/2, 5/3, 15/8),
  notes_count:7
)
// @description Medieval Mixolydian mode \u2014 G to G, major with flat 7th
interval mixolydian(
  culture:medieval,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 5/3, 9/5),
  notes_count:7
)
// @description Medieval Aeolian mode \u2014 A to A, natural minor
interval aeolian(
  culture:medieval,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:7
)
// @description Medieval Locrian mode \u2014 B to B, diminished mode
interval locrian(
  culture:medieval,
  ratios(1, 16/15, 6/5, 4/3, 64/45, 8/5, 9/5),
  notes_count:7
)
// @description Byzantine Protos \u2014 1st mode of Byzantine Octoechos
interval byzantine_protos(
  culture:byzantine,
  ratios(1, 9/8, 12/11, 4/3, 3/2, 27/16, 18/11),
  notes_count:7
)
// @description Byzantine Devteros \u2014 2nd mode of Byzantine Octoechos
interval byzantine_devteros(
  culture:byzantine,
  ratios(1, 12/11, 32/27, 4/3, 3/2, 18/11, 16/9),
  notes_count:7
)
// @description Tizita major \u2014 Ethiopian pentatonic, nostalgic mood
interval tizita_major(
  culture:ethiopian,
  ratios(1, 9/8, 5/4, 3/2, 5/3),
  notes_count:5
)
// @description Tizita minor \u2014 Ethiopian pentatonic, melancholic variant
interval tizita_minor(
  culture:ethiopian,
  ratios(1, 9/8, 6/5, 3/2, 8/5),
  notes_count:5
)
// @description Bati major \u2014 Ethiopian pentatonic, bright and festive
interval bati_major(
  culture:ethiopian,
  ratios(1, 6/5, 4/3, 3/2, 9/5),
  notes_count:5
)
// @description Bati minor \u2014 Ethiopian pentatonic, darker Bati variant
interval bati_minor(
  culture:ethiopian,
  ratios(1, 6/5, 4/3, 3/2, 8/5),
  notes_count:5
)
// @description Ambassel \u2014 Ethiopian pentatonic, spiritual and contemplative
interval ambassel(
  culture:ethiopian,
  ratios(1, 16/15, 5/4, 3/2, 8/5),
  notes_count:5
)
// @description Anchihoye \u2014 Ethiopian tetratonic, simplest Ethiopian mode
interval anchihoye(
  culture:ethiopian,
  ratios(1, 6/5, 3/2, 8/5),
  notes_count:4
)
// @description Pelog lima \u2014 5-note Javanese pelog, empirical tuning
interval pelog_lima(
  culture:indonesian,
  ratios(1, 120c, 260c, 540c, 675c),
  notes_count:5
)
// @description Slendro Balinese \u2014 5-tone quasi-equal Balinese slendro
interval slendro_balinese(
  culture:indonesian,
  ratios(1, 240c, 480c, 720c, 960c),
  notes_count:5
)
// @description Thai 7-TET \u2014 7 equal divisions of the octave
interval thai_7tet(
  culture:thai,
  ratios(1, 171c, 343c, 514c, 686c, 857c, 1029c),
  notes_count:7
)
// @description Thai pentatonic \u2014 5 of 7 equal steps, traditional Thai selection
interval thai_pentatonic(
  culture:thai,
  ratios(1, 171c, 514c, 686c, 857c),
  notes_count:5
)
// @description Blues scale \u2014 hexatonic with blue notes
interval blues(
  culture:western,
  ratios(1, 6/5, 4/3, 7/5, 3/2, 9/5),
  notes_count:6
)
// @description Whole tone scale \u2014 6 equal whole steps
interval whole_tone(
  culture:western,
  ratios(1, 200c, 400c, 600c, 800c, 1000c),
  notes_count:6
)
// @description Diminished scale (half-whole) \u2014 octatonic alternating H-W
interval diminished_hw(
  culture:western,
  ratios(1, 100c, 300c, 400c, 600c, 700c, 900c, 1000c),
  notes_count:8
)
// @description Diminished scale (whole-half) \u2014 octatonic alternating W-H
interval diminished_wh(
  culture:western,
  ratios(1, 200c, 300c, 500c, 600c, 800c, 900c, 1100c),
  notes_count:8
)
// @description Augmented scale \u2014 hexatonic symmetric scale
interval augmented(
  culture:western,
  ratios(1, 300c, 400c, 700c, 800c, 1100c),
  notes_count:6
)
// @description Harmonic minor \u2014 natural minor with raised 7th
interval harmonic_minor(
  culture:western,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 8/5, 15/8),
  notes_count:7
)
// @description Hungarian minor \u2014 double harmonic minor, gypsy scale
interval hungarian_minor(
  culture:western,
  ratios(1, 9/8, 6/5, 45/32, 3/2, 8/5, 15/8),
  notes_count:7
)
// @description Chromatic scale \u2014 all 12 semitones
interval chromatic(
  culture:western,
  ratios(1, 100c, 200c, 300c, 400c, 500c, 600c, 700c, 800c, 900c, 1000c, 1100c),
  notes_count:12
)
// @description Kurd \u2014 Aeolian / Natural Minor. The most popular handpan scale worldwide.
interval handpan_kurd(
  culture:handpan,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:7,
  layout:"D3 A3 Bb3 C4 D4 E4 F4 G4 A4"
)
// @description Integral \u2014 Aeolian without 4th. Created by PanArt (original Hang). Open, spacious.
interval handpan_integral(
  culture:handpan,
  ratios(1, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:6,
  layout:"D3 A3 Bb3 C4 D4 F4 A4 C5"
)
// @description Celtic / Amara \u2014 Dorian mode. Brighter minor with raised 6th. Folk/Celtic character.
interval handpan_celtic(
  culture:handpan,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 5/3, 9/5),
  notes_count:7,
  layout:"D3 A3 C4 D4 E4 F4 G4 A4 B4"
)
// @description Pygmy \u2014 Minor pentatonic + b6. African-inspired, warm and forgiving.
interval handpan_pygmy(
  culture:handpan,
  ratios(1, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:6,
  layout:"D3 A3 Bb3 C4 D4 F4 G4 A4 C5"
)
// @description Equinox \u2014 Phrygian mode. Dark, Spanish/Middle-Eastern flavor. Pantheon Steel.
interval handpan_equinox(
  culture:handpan,
  ratios(1, 16/15, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:7,
  layout:"D3 A3 Bb3 C4 D4 Eb4 F4 G4 A4"
)
// @description Hijaz \u2014 Phrygian Dominant (5th mode of Harmonic Minor). Arabic/Spanish feel.
interval handpan_hijaz(
  culture:handpan,
  ratios(1, 16/15, 5/4, 4/3, 3/2, 8/5, 9/5),
  notes_count:7,
  layout:"D3 A3 Bb3 C#4 D4 E4 F4 G4 A4"
)
// @description Hijaz Kar \u2014 Double Harmonic Major / Byzantine / Bhairav. Two Hijaz tetrachords.
interval handpan_hijaz_kar(
  culture:handpan,
  ratios(1, 16/15, 5/4, 4/3, 3/2, 8/5, 15/8),
  notes_count:7,
  layout:"D3 A3 Bb3 C#4 D4 E4 F4 G#4 A4"
)
// @description Golden Gate \u2014 Harmonic Minor. Classical sound, augmented second between b6 and 7.
interval handpan_golden_gate(
  culture:handpan,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 8/5, 15/8),
  notes_count:7,
  layout:"D3 A3 Bb3 C4 D4 E4 F4 G#4 A4"
)
// @description Romanian Hijaz \u2014 Hungarian/Double Harmonic Minor. Two augmented seconds, intense Eastern European feel.
interval handpan_romanian_hijaz(
  culture:handpan,
  ratios(1, 9/8, 6/5, 45/32, 3/2, 8/5, 15/8),
  notes_count:7,
  layout:"D3 A3 Bb3 C#4 D4 Eb4 F#4 G4 A4"
)
// @description Akebono \u2014 Japanese pentatonic (In scale variant). Contemplative, zen.
interval handpan_akebono(
  culture:handpan,
  ratios(1, 16/15, 4/3, 3/2, 8/5),
  notes_count:5,
  layout:"D3 A3 Bb3 D4 E4 F4 A4 Bb4 D5"
)
// @description Sabye \u2014 PanArt creation. Mysterious, African-inspired hexatonic.
interval handpan_sabye(
  culture:handpan,
  ratios(1, 16/15, 6/5, 3/2, 8/5),
  notes_count:5,
  layout:"D3 A3 Bb3 D4 E4 F4 G4 A4 D5"
)
// @description Mystic \u2014 Phrygian without 7th. Dark, introspective, spacious.
interval handpan_mystic(
  culture:handpan,
  ratios(1, 16/15, 6/5, 4/3, 3/2, 8/5),
  notes_count:6,
  layout:"D3 A3 Bb3 C4 D4 Eb4 G4 A4 Bb4"
)
// @description La Sirena \u2014 Phrygian Dominant. Spanish/Arabic dramatic character.
interval handpan_la_sirena(
  culture:handpan,
  ratios(1, 16/15, 5/4, 4/3, 3/2, 8/5, 9/5),
  notes_count:7,
  layout:"D3 A3 Bb3 D4 E4 F4 A4 Bb4 C#5"
)
// @description Oxalis \u2014 Dorian without 6th. Open, airy minor. Ayasa creation.
interval handpan_oxalis(
  culture:handpan,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 9/5),
  notes_count:6,
  layout:"D3 A3 C4 D4 E4 F4 A4 C5 D5"
)
// @description Jibuk \u2014 Mixolydian. Major-sounding with flatted 7th. Bright, festive.
interval handpan_jibuk(
  culture:handpan,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 5/3, 9/5),
  notes_count:7,
  layout:"D3 A3 C4 D4 E4 F#4 G4 A4 B4"
)
// @description Annaziska \u2014 Minor Pentatonic. Maximum consonance, impossible to play wrong.
interval handpan_annaziska(
  culture:handpan,
  ratios(1, 6/5, 4/3, 3/2, 9/5),
  notes_count:5,
  layout:"D3 A3 C4 D4 F4 G4 A4 C5 D5"
)
// @description Ashta Taki \u2014 Major without 6th. Bright, uplifting, rare major handpan.
interval handpan_ashta_taki(
  culture:handpan,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 15/8),
  notes_count:6,
  layout:"D3 A3 C4 D4 E4 F4 G4 B4 C5"
)
// @description Flamenco mode / Phrygian Dominant \u2014 the defining sound of flamenco. Hijaz maqam equivalent.
interval flamenco_phrygian(
  culture:flamenco,
  ratios(1, 16/15, 5/4, 4/3, 3/2, 8/5, 9/5),
  notes_count:7
)
// @description Flamenco por medio \u2014 Phrygian mode on A (guitar standard). Dark, intense.
interval flamenco_por_medio(
  culture:flamenco,
  ratios(1, 16/15, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:7
)
// @description Flamenco por arriba \u2014 Phrygian mode on E (guitar standard). Classic flamenco position.
interval flamenco_por_arriba(
  culture:flamenco,
  ratios(1, 16/15, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:7
)
// @description Escala andaluza / Double Harmonic Major \u2014 Hijaz Kar / Bhairav equivalent in flamenco context.
interval flamenco_double_harmonic(
  culture:flamenco,
  ratios(1, 16/15, 5/4, 4/3, 3/2, 8/5, 15/8),
  notes_count:7
)
// @description Flamenco minor \u2014 Harmonic minor with Andalusian cadence (iv-III-II-I).
interval flamenco_minor(
  culture:flamenco,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 8/5, 15/8),
  notes_count:7
)
// @description Messiaen mode 1 \u2014 Whole tone scale (6 equal divisions). Debussy, Messiaen.
interval messiaen_mode1(
  culture:contemporary,
  ratios(1, 200c, 400c, 600c, 800c, 1000c),
  notes_count:6
)
// @description Messiaen mode 2 \u2014 Octatonic / Diminished (half-whole). Messiaen, Bart\xF3k, Stravinsky.
interval messiaen_mode2(
  culture:contemporary,
  ratios(1, 100c, 300c, 400c, 600c, 700c, 900c, 1000c),
  notes_count:8
)
// @description Messiaen mode 3 \u2014 9 notes, period = major third (400c). Three transpositions.
interval messiaen_mode3(
  culture:contemporary,
  ratios(1, 200c, 300c, 400c, 600c, 700c, 800c, 1000c, 1100c),
  notes_count:9
)
// @description Messiaen mode 4 \u2014 8 notes, period = tritone (600c). Rare in practice.
interval messiaen_mode4(
  culture:contemporary,
  ratios(1, 100c, 200c, 500c, 600c, 700c, 800c, 1100c),
  notes_count:8
)
// @description Messiaen mode 5 \u2014 6 notes, period = tritone (600c).
interval messiaen_mode5(
  culture:contemporary,
  ratios(1, 100c, 500c, 600c, 700c, 1100c),
  notes_count:6
)
// @description Messiaen mode 6 \u2014 8 notes, period = tritone (600c). Augmented fourths.
interval messiaen_mode6(
  culture:contemporary,
  ratios(1, 200c, 400c, 500c, 600c, 800c, 1000c, 1100c),
  notes_count:8
)
// @description Messiaen mode 7 \u2014 10 notes, period = tritone (600c). Most dense of the modes.
interval messiaen_mode7(
  culture:contemporary,
  ratios(1, 100c, 200c, 300c, 500c, 600c, 700c, 800c, 900c, 1100c),
  notes_count:10
)
// @description Chromatic aggregate \u2014 all 12 pitch classes. Basis of serial/12-tone technique (Schoenberg, Webern, Boulez).
interval chromatic_12(
  culture:contemporary,
  ratios(1, 100c, 200c, 300c, 400c, 500c, 600c, 700c, 800c, 900c, 1000c, 1100c),
  notes_count:12
)
// @description Spectral scale (harmonics 8-16) \u2014 Grisey, Murail. Natural harmonic series from 8th partial.
interval spectral_harmonic_8(
  culture:contemporary,
  ratios(1, 9/8, 10/8, 11/8, 12/8, 13/8, 14/8, 15/8),
  notes_count:8
)
// @description Spectral scale (harmonics 1-16) \u2014 full harmonic series. Grisey Partiels, Haas.
interval spectral_harmonic_16(
  culture:contemporary,
  ratios(1, 9/8, 5/4, 11/8, 3/2, 13/8, 7/4, 15/8),
  notes_count:8
)
// @description Bart\xF3k scale / Acoustic scale / Lydian Dominant \u2014 Overtone scale (Bart\xF3k, Debussy).
interval bartok_acoustic(
  culture:contemporary,
  ratios(1, 9/8, 5/4, 45/32, 3/2, 5/3, 9/5),
  notes_count:7
)
// @description Scriabin Mystic Chord / Prometheus scale \u2014 C F# Bb E A D as scale. Scriabin late works.
interval scriabin_mystic_chord(
  culture:contemporary,
  ratios(1, 200c, 400c, 600c, 900c, 1000c),
  notes_count:6
)
// @description Tritone scale \u2014 Two augmented triads a semitone apart. Jazz/contemporary.
interval tritone_scale(
  culture:contemporary,
  ratios(1, 100c, 400c, 500c, 800c, 900c),
  notes_count:6
)
// @description Slonimsky scale 1 \u2014 Symmetric division of octave in minor thirds + chromatic fill. Used by Coltrane.
interval slonimsky_1(
  culture:contemporary,
  ratios(1, 100c, 300c, 400c, 600c, 700c, 900c, 1000c),
  notes_count:8
)
// @description Harry Partch 43-tone scale \u2014 11-limit just intonation. Microtonal pioneer.
interval harry_partch_43(
  culture:contemporary,
  ratios(
    1,
    81/80,
    33/32,
    21/20,
    16/15,
    12/11,
    11/10,
    10/9,
    9/8,
    8/7,
    7/6,
    32/27,
    6/5,
    11/9,
    5/4,
    14/11,
    9/7,
    21/16,
    4/3,
    27/20,
    11/8,
    7/5,
    10/7,
    16/11,
    40/27,
    3/2,
    32/21,
    14/9,
    11/7,
    8/5,
    18/11,
    5/3,
    27/16,
    12/7,
    7/4,
    16/9,
    9/5,
    20/11,
    11/6,
    15/8,
    40/21,
    64/33,
    160/81
  ),
  notes_count:43
)
// @description Wendy Carlos Alpha \u2014 15.385 steps per octave (78c per step). Non-octave scale.
interval wendy_carlos_alpha(
  culture:contemporary,
  ratios(1, 78c, 156c, 234c, 312c, 390c, 468c, 546c, 624c, 702c, 780c, 858c, 936c, 1014c, 1092c),
  notes_count:15
)
// @description Wendy Carlos Beta \u2014 18.809 steps per octave (63.8c per step). Non-octave scale.
interval wendy_carlos_beta(
  culture:contemporary,
  ratios(
    1,
    63.8c,
    127.6c,
    191.3c,
    255.1c,
    318.9c,
    382.7c,
    446.5c,
    510.3c,
    574.0c,
    637.8c,
    701.6c,
    765.4c,
    829.2c,
    893.0c,
    956.8c,
    1020.5c,
    1084.3c
  ),
  notes_count:18
)
// @description Bebop Dominant \u2014 Mixolydian + passing natural 7th. The quintessential bebop scale (Charlie Parker, Dizzy Gillespie).
interval bebop_dominant(
  culture:jazz,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 5/3, 9/5, 15/8),
  notes_count:8
)
// @description Bebop Major \u2014 Ionian + passing #5. Barry Harris method.
interval bebop_major(
  culture:jazz,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 800c, 5/3, 15/8),
  notes_count:8
)
// @description Bebop Dorian \u2014 Dorian + passing major 3rd. Minor bebop scale.
interval bebop_dorian(
  culture:jazz,
  ratios(1, 9/8, 6/5, 5/4, 4/3, 3/2, 5/3, 9/5),
  notes_count:8
)
// @description Bebop Melodic Minor \u2014 Melodic minor ascending + passing b6. David Baker.
interval bebop_melodic_minor(
  culture:jazz,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 800c, 5/3, 15/8),
  notes_count:8
)
// @description Altered scale / Super Locrian \u2014 7th mode of melodic minor. Essential for V7alt chords (Coltrane, Shorter, Henderson).
interval altered(
  culture:jazz,
  ratios(1, 16/15, 200c, 6/5, 600c, 800c, 9/5),
  notes_count:7
)
// @description Lydian Augmented \u2014 3rd mode of melodic minor. #4 + #5. George Russell Lydian Chromatic Concept.
interval lydian_augmented(
  culture:jazz,
  ratios(1, 9/8, 5/4, 600c, 800c, 5/3, 15/8),
  notes_count:7
)
// @description Lydian Dominant / Lydian b7 \u2014 4th mode of melodic minor. Dominant sound with #4. (= Bart\xF3k acoustic scale).
interval lydian_dominant(
  culture:jazz,
  ratios(1, 9/8, 5/4, 45/32, 3/2, 5/3, 9/5),
  notes_count:7
)
// @description Locrian #2 / Half-Diminished \u2014 6th mode of melodic minor. Used on minor7b5 chords.
interval locrian_natural2(
  culture:jazz,
  ratios(1, 9/8, 6/5, 4/3, 600c, 8/5, 9/5),
  notes_count:7
)
// @description Phrygian Dominant \u2014 5th mode of harmonic minor. Hijaz. Used on V7b9 in minor keys.
interval phrygian_dominant(
  culture:jazz,
  ratios(1, 16/15, 5/4, 4/3, 3/2, 8/5, 9/5),
  notes_count:7
)
// @description Major Pentatonic \u2014 1 2 3 5 6. Foundation of blues, rock, jazz melody.
interval pentatonic_major(
  culture:jazz,
  ratios(1, 9/8, 5/4, 3/2, 5/3),
  notes_count:5
)
// @description Minor Pentatonic \u2014 1 b3 4 5 b7. The most universal scale in popular music.
interval pentatonic_minor(
  culture:jazz,
  ratios(1, 6/5, 4/3, 3/2, 9/5),
  notes_count:5
)
// @description Coltrane Pentatonic \u2014 1 2 3 5 b7. Dominant pentatonic used by Coltrane on V7 chords.
interval coltrane_pentatonic(
  culture:jazz,
  ratios(1, 9/8, 5/4, 3/2, 9/5),
  notes_count:5
)
// @description Kumoi (jazz usage) \u2014 1 2 b3 5 6. Japanese-influenced pentatonic popular in jazz (McCoy Tyner).
interval kumoi_jazz(
  culture:jazz,
  ratios(1, 9/8, 6/5, 3/2, 5/3),
  notes_count:5
)
// @description In-Sen \u2014 1 b2 4 5 b7. Japanese scale used in jazz (John McLaughlin, Joe Henderson).
interval in_sen_jazz(
  culture:jazz,
  ratios(1, 16/15, 4/3, 3/2, 9/5),
  notes_count:5
)
// @description Augmented scale \u2014 Symmetric scale alternating m3 and H. Coltrane, Thelonious Monk.
interval augmented_scale(
  culture:jazz,
  ratios(1, 6/5, 5/4, 3/2, 8/5, 15/8),
  notes_count:6
)
// @description Tritone scale (dominant) \u2014 Two major triads a tritone apart. Mark Levine, modern jazz.
interval tritone_dominant(
  culture:jazz,
  ratios(1, 100c, 400c, 500c, 800c, 900c),
  notes_count:6
)
// @description Jins Rast \u2014 Rast tetrachord with a neutral third (C D E half-flat F). Zalzal's third 27/22 (~354.5c) = musicological
// signature of Arabic just intonation, NOT Zarlino's major third 5/4 (which would give an Ajam tetrachord). The data keeps the PURE ratio
// (ontological truth); the 24-TET projection (350c / 7 quarter-tones) is done at rendering by the engine.
interval jins_rast(
  ratios(1, 9/8, 27/22, 4/3)
)
// @description Jins Nahawand \u2014 minor tetrachord (C D Eb F)
interval jins_nahawand(
  ratios(1, 9/8, 6/5, 4/3)
)
// @description Jins Kurd \u2014 phrygian tetrachord (C Db Eb F)
interval jins_kurd(
  ratios(1, 16/15, 6/5, 4/3)
)
// @description Jins Hijaz \u2014 characteristic augmented second (C Db E F)
interval jins_hijaz(
  ratios(1, 16/15, 5/4, 4/3)
)
// @description Jins Bayati \u2014 Zalzal's NEUTRAL second (C D-half-flat Eb F): 12/11 (~151c), 6/5 (just minor third), 4/3. Zalzalian 5-limit
// just intonation (pythagorean alt. 32/27 for the third; the just 6/5 is kept for consistency of the Arabic system).
interval jins_bayati(
  ratios(1, 12/11, 6/5, 4/3)
)
// @description Jins Sikah \u2014 built on Zalzal's neutral second (C D-half-flat Eb F): 12/11 (~151c), 6/5, 4/3. Neutral second = 12/11,
// consistent with the Arabic table.
interval jins_sikah(
  ratios(1, 12/11, 6/5, 4/3)
)
// @description Jins Ajam \u2014 MAJOR tetrachord (C D E F): 9/8 (tone), 5/4 (Zarlino's major third), 4/3 (perfect fourth). It is the only Arabic
// jins with a pure 5/4 major third (\u2248 Western major). The tetrachord closes on the fourth 4/3.
interval jins_ajam(
  ratios(1, 9/8, 5/4, 4/3)
)
// @description Jins Saba \u2014 neutral second + minor third + DIMINISHED fourth (C D-half-flat Eb Fb): 12/11, 6/5, 13/10 (~454c); the
// diminished fourth is Saba's signature.
interval jins_saba(
  ratios(1, 12/11, 6/5, 13/10)
)
// @description Cins turc (cins_rast) \u2014 segment pythagoricien exact
interval cins_rast(
  system:"pythagorean",
  ratios(1, 9/8, 8192/6561, 4/3, 3/2)
)
// @description Cins turc (cins_rast4) \u2014 segment pythagoricien exact
interval cins_rast4(
  system:"pythagorean",
  ratios(1, 9/8, 8192/6561, 4/3)
)
// @description Cins turc (cins_ussak) \u2014 segment pythagoricien exact
interval cins_ussak(
  system:"pythagorean",
  ratios(1, 65536/59049, 32/27, 4/3, 3/2)
)
// @description Cins turc (cins_ussak4) \u2014 segment pythagoricien exact
interval cins_ussak4(
  system:"pythagorean",
  ratios(1, 65536/59049, 32/27, 4/3)
)
// @description Cins turc (cins_buselik4) \u2014 segment pythagoricien exact
interval cins_buselik4(
  system:"pythagorean",
  ratios(1, 9/8, 32/27, 4/3)
)
// @description Cins turc (cins_hicaz) \u2014 segment pythagoricien exact
interval cins_hicaz(
  system:"pythagorean",
  ratios(1, 2187/2048, 8192/6561, 4/3, 3/2)
)
// @description Cins turc (cins_buselik) \u2014 segment pythagoricien exact
interval cins_buselik(
  system:"pythagorean",
  ratios(1, 9/8, 32/27, 4/3, 3/2)
)
// @description Cins turc (cins_kurdi4) \u2014 segment pythagoricien exact
interval cins_kurdi4(
  system:"pythagorean",
  ratios(1, 256/243, 32/27, 4/3)
)
// @description Cins turc (cins_kurdi) \u2014 segment pythagoricien exact
interval cins_kurdi(
  system:"pythagorean",
  ratios(1, 256/243, 32/27, 4/3, 3/2)
)
// @description Cins turc (cins_segah) \u2014 segment pythagoricien exact
interval cins_segah(
  system:"pythagorean",
  ratios(1, 256/243, 9/8, 4/3, 3/2)
)
// @description Cins turc (cins_cargah4) \u2014 segment pythagoricien exact
interval cins_cargah4(
  system:"pythagorean",
  ratios(1, 256/243, 9/8, 4/3)
)
// @description Cins turc (cins_saba) \u2014 segment pythagoricien exact
interval cins_saba(
  system:"pythagorean",
  ratios(1, 65536/59049, 32/27, 81/64, 3/2)
)
// @description Cins turc (cins_huseyni4) \u2014 segment pythagoricien exact
interval cins_huseyni4(
  system:"pythagorean",
  ratios(1, 65536/59049, 8192/6561, 4/3)
)
// @description Cins turc (cins_segah4) \u2014 segment pythagoricien exact
interval cins_segah4(
  system:"pythagorean",
  ratios(1, 256/243, 8192/6561, 4/3)
)
// @description Cins turc (cins_huzzam) \u2014 segment pythagoricien exact
interval cins_huzzam(
  system:"pythagorean",
  ratios(1, 2187/2048, 32/27, 4/3, 3/2)
)

// @description Bilaval thaat \u2014 equivalent to Western major scale
degree bilaval(
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 4, 7, 9, 13, 17, 20),
  notes_count:7
)
// @description Khamaj thaat \u2014 komal Ni
degree khamaj(
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 4, 7, 9, 13, 17, 18),
  notes_count:7
)
// @description Kafi thaat \u2014 komal Ga, komal Ni
degree kafi(
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 4, 5, 9, 13, 17, 18),
  notes_count:7
)
// @description Asavari thaat \u2014 komal Ga, Dha, Ni
degree asavari(
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 4, 5, 9, 13, 15, 18),
  notes_count:7
)
// @description Bhairavi thaat \u2014 all komal (Re, Ga, Dha, Ni)
degree bhairavi(
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 2, 5, 9, 13, 15, 18),
  notes_count:7
)
// @description Kalyan thaat \u2014 tivra Ma
degree kalyan(
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 4, 7, 11, 13, 17, 20),
  notes_count:7
)
// @description Marva thaat \u2014 komal Re, tivra Ma
degree marva(
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 2, 7, 11, 13, 17, 20),
  notes_count:7
)
// @description Purvi thaat \u2014 komal Re, tivra Ma, komal Dha
degree purvi(
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 2, 7, 11, 13, 15, 20),
  notes_count:7
)
// @description Todi thaat \u2014 komal Re, Ga, tivra Ma, komal Dha
degree todi(
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 2, 5, 11, 13, 15, 20),
  notes_count:7
)
// @description Shankarabharanam melakarta (72 #29) \u2014 equivalent to Bilaval/major
degree shankarabharanam(
  culture:carnatic,
  temperament:"22shruti",
  degrees(0, 4, 7, 9, 13, 17, 20),
  notes_count:7
)
// @description Kalyani melakarta (72 #65) \u2014 equivalent to Kalyan/Lydian
degree kalyani(
  culture:carnatic,
  temperament:"22shruti",
  degrees(0, 4, 7, 11, 13, 17, 20),
  notes_count:7
)
// @description Kharaharapriya melakarta (72 #22) \u2014 equivalent to Kafi/Dorian
degree kharaharapriya(
  culture:carnatic,
  temperament:"22shruti",
  degrees(0, 4, 5, 9, 13, 17, 18),
  notes_count:7
)
// @description Shubhapantuvarali melakarta (72 #45) \u2014 equivalent to Todi thaat
degree todi_carnatic(
  culture:carnatic,
  temperament:"22shruti",
  degrees(0, 2, 5, 11, 13, 15, 20),
  notes_count:7
)
// @description Harikambhoji melakarta (72 #28) \u2014 equivalent to Khamaj/Mixolydian
degree harikambhoji(
  culture:carnatic,
  temperament:"22shruti",
  degrees(0, 4, 7, 9, 13, 17, 18),
  notes_count:7
)
// @description Raga Malkauns \u2014 audava (pentatonic), deep night raga
degree malkauns(
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 5, 9, 15, 18),
  notes_count:5
)
// @description Thaat Bhairav \u2014 komal re, shuddh ga, komal dha, shuddh ni. Double Harmonic Major. Morning raga.
degree thaat_bhairav(
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 2, 7, 9, 13, 15, 20),
  notes_count:7
)
// @description Quarter-tone chromatic \u2014 24 equal divisions. Haba, Wyschnegradsky, Boulez (Marteau sans ma\xEEtre).
degree quarter_tone_chromatic(
  culture:contemporary,
  temperament:"24TET",
  degrees(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23),
  notes_count:24
)

// @description Raga Bageshri \u2014 different notes in ascent and descent
directional bageshri(
  culture:hindustani,
  temperament:"22shruti",
  ascending(0, 5, 9, 13, 15, 18),
  descending(0, 18, 17, 15, 13, 9, 5, 4),
  notes_count:7
)
// @description Raga Bhairav \u2014 different aroha and avaroha. komal re and dha ascending, shuddh descending. Aroha = thaat Bhairav; avaroha a
// variant. The SCALE aspect of a raga lives here; intonation is stated by the referenced temperament.
directional raga_bhairav(
  culture:hindustani,
  temperament:"22shruti",
  ascending(0, 2, 7, 9, 13, 15, 20),
  descending(0, 4, 7, 9, 13, 17, 20),
  notes_count:7
)
// @description Raga Yaman (Kalyan) \u2014 ma tivra ascending, shuddh descending in some interpretations. Aroha = thaat Kalyan.
directional raga_yaman(
  culture:hindustani,
  temperament:"22shruti",
  ascending(0, 4, 7, 11, 13, 17, 20),
  descending(0, 4, 7, 9, 13, 17, 20),
  notes_count:7
)
// @description Raga Darbari Kanada \u2014 andolit komal Ga, majestic night raga
directional darbari_kanada(
  culture:hindustani,
  temperament:"22shruti",
  ascending(0, 4, 5, 9, 13, 15, 18),
  descending(0, 18, 15, 13, 9, 7, 5, 4),
  notes_count:7
)
// @description Raga Desh \u2014 komal Ni in descent, romantic evening raga
directional desh(
  culture:hindustani,
  temperament:"22shruti",
  ascending(0, 4, 7, 9, 13, 17, 20),
  descending(0, 20, 18, 17, 13, 9, 7, 4),
  notes_count:7
)
// @description Raga Bihag \u2014 both Ma used, late night raga
directional bihag(
  culture:hindustani,
  temperament:"22shruti",
  ascending(0, 4, 7, 11, 13, 17, 20),
  descending(0, 20, 17, 13, 11, 9, 7, 4),
  notes_count:7
)
// @description Melodic minor \u2014 different ascending and descending forms
directional melodic_minor(
  culture:western,
  ascending(1, 9/8, 6/5, 4/3, 3/2, 5/3, 15/8),
  descending(1, 9/8, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:7
)

// @description Maqam Ajam \u2014 equivalent to Western major \u2014 Ratios = zalzalian just intonation (5-limit; neutral third 27/22). Source of
// truth; 24-TET is a rendering projection, not the ontology. [compose(jins)+junction = ontological source; the engine computes the ratios
// from the jins].
composite maqam_ajam(
  culture:arabic,
  notes_count:7,
  system:"zalzal-ji",
  compose(jins_ajam, jins_ajam),
  junction:3/2
)
// @description Maqam Kurd \u2014 starts with jins Kurd \u2014 Ratios = zalzalian just intonation (5-limit; neutral third 27/22). Source of truth;
// 24-TET is a rendering projection, not the ontology. [compose(jins)+junction = ontological source; the engine computes the ratios from the
// jins].
composite maqam_kurd(
  culture:arabic,
  notes_count:7,
  system:"zalzal-ji",
  compose(jins_kurd, jins_kurd),
  junction:3/2
)
// @description Maqam Suznak \u2014 Rast lower + Hijaz upper \u2014 Ratios = zalzalian just intonation (5-limit; neutral third 27/22). Source of
// truth; 24-TET is a rendering projection, not the ontology. [compose(jins)+junction = ontological source; the engine computes the ratios
// from the jins].
composite maqam_suznak(
  culture:arabic,
  compose(jins_rast, jins_hijaz),
  junction:3/2,
  notes_count:7,
  system:"zalzal-ji"
)
// @description Maqam Nawa Athar \u2014 double augmented second \u2014 Ratios = zalzalian just intonation (5-limit; neutral third 27/22). Source of
// truth; 24-TET is a rendering projection, not the ontology. [compose(jins)+junction = source].
composite maqam_nawa_athar(
  culture:arabic,
  notes_count:7,
  system:"zalzal-ji",
  compose(jins_nikriz, jins_hijaz),
  junction:3/2
)
// @description Maqam Athar Kurd \u2014 Kurd with augmented second \u2014 Ratios = zalzalian just intonation (5-limit; neutral third 27/22). Source of
// truth; 24-TET is a rendering projection, not the ontology. [compose(jins)+junction = source].
composite maqam_athar_kurd(
  culture:arabic,
  notes_count:7,
  system:"zalzal-ji",
  compose(jins_athar_kurd, jins_hijaz),
  junction:3/2
)
// @description Maqam Hijaz Kar \u2014 double harmonic major \u2014 Ratios = zalzalian just intonation (5-limit; neutral third 27/22). Source of
// truth; 24-TET is a rendering projection, not the ontology. [compose(jins)+junction = ontological source; the engine computes the ratios
// from the jins].
composite maqam_hijaz_kar(
  culture:arabic,
  notes_count:7,
  system:"zalzal-ji",
  compose(jins_hijaz, jins_hijaz),
  junction:3/2
)
// @description Maqam Nikriz \u2014 Nikriz tetrachord + Rast upper \u2014 Ratios = zalzalian just intonation (5-limit; neutral third 27/22). Source of
// truth; 24-TET is a rendering projection, not the ontology. [compose(jins)+junction = ontological source; the engine computes the ratios
// from the jins].
composite maqam_nikriz(
  culture:arabic,
  compose(jins_nikriz, jins_rast),
  junction:3/2,
  notes_count:7,
  system:"zalzal-ji"
)
// @description Maqam Husayni \u2014 Bayati variant with Husayni emphasis \u2014 Ratios = zalzalian just intonation (5-limit; neutral third 27/22).
// Source of truth; 24-TET is a rendering projection, not the ontology. [compose(jins)+junction = ontological source; the engine computes
// the ratios from the jins].
composite maqam_husayni(
  culture:arabic,
  compose(jins_bayati, jins_bayati),
  junction:3/2,
  notes_count:7,
  system:"zalzal-ji"
)
// @description Maqam Farahfaza \u2014 Nahawand with Sikah flavor \u2014 Ratios = zalzalian just intonation (5-limit; neutral third 27/22). Source of
// truth; 24-TET is a rendering projection, not the ontology. [compose(jins)+junction = ontological source; the engine computes the ratios
// from the jins].
composite maqam_farahfaza(
  culture:arabic,
  compose(jins_nahawand, jins_bayati),
  junction:3/2,
  notes_count:7,
  system:"zalzal-ji"
)
// @description Makam Rast \u2014 fundamental Turkish makam \u2014 Ratios = Pythagorean (3-limit, chain of fifths of the Ottoman 53-comma
// Arel-Ezgi-Uzdilmek system). Source of truth; 53-TET is a projection. [Turkish system: Pythagorean (3-limit); cins = exact segments; name
// = family (provisional for the rare d\xF6rtl\xFC)].
composite makam_rast(
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_rast, cins_rast4),
  junction:3/2
)
// @description Makam Ussak \u2014 one of the most common Turkish makams \u2014 Ratios = Pythagorean (3-limit, chain of fifths of the Ottoman 53-comma
// Arel-Ezgi-Uzdilmek system). Source of truth; 53-TET is a projection. [Turkish system: Pythagorean (3-limit); cins = exact segments; name
// = family (provisional for the rare d\xF6rtl\xFC)].
composite makam_ussak(
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_ussak, cins_ussak4),
  junction:3/2
)
// @description Makam Huseyni \u2014 similar to Ussak with different upper tetrachord \u2014 Ratios = Pythagorean (3-limit, chain of fifths of the
// Ottoman 53-comma Arel-Ezgi-Uzdilmek system). Source of truth; 53-TET is a projection. [Turkish system: Pythagorean (3-limit); cins =
// exact segments; name = family (provisional for the rare d\xF6rtl\xFC)].
composite makam_huseyni(
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_ussak, cins_buselik4),
  junction:3/2
)
// @description Makam Hicaz \u2014 augmented second in lower tetrachord \u2014 Ratios = Pythagorean (3-limit, chain of fifths of the Ottoman 53-comma
// Arel-Ezgi-Uzdilmek system). Source of truth; 53-TET is a projection. [Turkish system: Pythagorean (3-limit); cins = exact segments; name
// = family (provisional for the rare d\xF6rtl\xFC)].
composite makam_hicaz(
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_hicaz, cins_ussak4),
  junction:3/2
)
// @description Makam Nihavend \u2014 Turkish minor, similar to harmonic minor \u2014 Ratios = Pythagorean (3-limit, chain of fifths of the Ottoman
// 53-comma Arel-Ezgi-Uzdilmek system). Source of truth; 53-TET is a projection. [Turkish system: Pythagorean (3-limit); cins = exact
// segments; name = family (provisional for the rare d\xF6rtl\xFC)].
composite makam_nihavend(
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_buselik, cins_kurdi4),
  junction:3/2
)
// @description Makam Kurdi \u2014 starts with minor second \u2014 Ratios = Pythagorean (3-limit, chain of fifths of the Ottoman 53-comma
// Arel-Ezgi-Uzdilmek system). Source of truth; 53-TET is a projection. [Turkish system: Pythagorean (3-limit); cins = exact segments; name
// = family (provisional for the rare d\xF6rtl\xFC)].
composite makam_kurdi(
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_kurdi, cins_kurdi4),
  junction:3/2
)
// @description Makam Segah \u2014 starts on segah pitch, meditative character \u2014 Ratios = Pythagorean (3-limit, chain of fifths of the Ottoman
// 53-comma Arel-Ezgi-Uzdilmek system). Source of truth; 53-TET is a projection. [Turkish system: Pythagorean (3-limit); cins = exact
// segments; name = family (provisional for the rare d\xF6rtl\xFC)].
composite makam_segah(
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_segah, cins_cargah4),
  junction:3/2
)
// @description Makam Huzzam \u2014 Segah variant with diminished fifth \u2014 Ratios = Pythagorean (3-limit, chain of fifths of the Ottoman 53-comma
// Arel-Ezgi-Uzdilmek system). Source of truth; 53-TET is a projection. [Turkish system: Pythagorean (3-limit); cins = exact segments; name
// = family (provisional for the rare d\xF6rtl\xFC)].
composite makam_huzzam(
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_cargah4, cins_huzzam),
  junction:4/3
)
// @description Makam Saba \u2014 distinctive Turkish makam with narrow intervals \u2014 Ratios = Pythagorean (3-limit, chain of fifths of the Ottoman
// 53-comma Arel-Ezgi-Uzdilmek system). Source of truth; 53-TET is a projection. [Turkish system: Pythagorean (3-limit); cins = exact
// segments; name = family (provisional for the rare d\xF6rtl\xFC)].
composite makam_saba(
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_saba, cins_kurdi4),
  junction:3/2
)
// @description Makam Buselik \u2014 Turkish natural minor equivalent \u2014 Ratios = Pythagorean (3-limit, chain of fifths of the Ottoman 53-comma
// Arel-Ezgi-Uzdilmek system). Source of truth; 53-TET is a projection. [Turkish system: Pythagorean (3-limit); cins = exact segments; name
// = family (provisional for the rare d\xF6rtl\xFC)].
composite makam_buselik(
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_buselik, cins_ussak4),
  junction:3/2
)
// @description Makam Sultaniyegah \u2014 Rast transposed, majestic character \u2014 Ratios = Pythagorean (3-limit, chain of fifths of the Ottoman
// 53-comma Arel-Ezgi-Uzdilmek system). Source of truth; 53-TET is a projection. [Turkish system: Pythagorean (3-limit); cins = exact
// segments; name = family (provisional for the rare d\xF6rtl\xFC)].
composite makam_sultaniyegah(
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_rast, cins_huseyni4),
  junction:3/2
)
// @description Makam Karcigar \u2014 mixed Turkish-Arabic makam \u2014 Ratios = Pythagorean (3-limit, chain of fifths of the Ottoman 53-comma
// Arel-Ezgi-Uzdilmek system). Source of truth; 53-TET is a projection. [Turkish system: Pythagorean (3-limit); cins = exact segments; name
// = family (provisional for the rare d\xF6rtl\xFC)].
composite makam_karcigar(
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_ussak, cins_segah4),
  junction:3/2
)
// @description Maqam Rast \u2014 Rast + Rast on the fifth [compose(jins)+junction = source; the engine computes the ratios from the jins].
composite maqam_rast(
  culture:arabic,
  system:"zalzal-ji",
  compose(jins_rast, jins_rast),
  junction:3/2
)
// @description Maqam Nahawand \u2014 Nahawand (lower) + Kurd (upper) [compose(jins)+junction = source; the engine computes the ratios from the
// jins].
composite maqam_nahawand(
  culture:arabic,
  system:"zalzal-ji",
  compose(jins_nahawand, jins_kurd),
  junction:3/2
)
// @description Maqam Hijaz \u2014 Hijaz (lower) + Rast (upper) [compose(jins)+junction = source; the engine computes the ratios from the jins].
composite maqam_hijaz(
  culture:arabic,
  system:"zalzal-ji",
  compose(jins_hijaz, jins_rast),
  junction:3/2
)
// @description Maqam Bayati \u2014 Bayati (lower) + Nahawand (upper) [compose(jins)+junction = source; the engine computes the ratios from the
// jins].
composite maqam_bayati(
  culture:arabic,
  system:"zalzal-ji",
  compose(jins_bayati, jins_nahawand),
  junction:3/2
)
// @description Maqam Saba \u2014 Saba (lower) + Hijaz (upper) + Rast (topmost, 3 jins) [compose(jins)+junction = source; the engine computes the
// ratios from the jins].
composite maqam_saba(
  culture:arabic,
  system:"zalzal-ji",
  compose(jins_saba, jins_hijaz, jins_rast),
  junction(13/10, 26/15)
)
`, "fichier": "scales.bpsl" }, { "nom": "settings/notreich", "format": "json", "texte": `{
  "documented": false,
  "Quantization": {
    "name": "Quantization",
    "value": "50",
    "unit": "ms (deft 10)",
    "boolean": "0"
  },
  "Quantize": {
    "name": "Quantize",
    "value": "1",
    "unit": "",
    "boolean": "1"
  },
  "Time_res": {
    "name": "Time resolution",
    "value": "10",
    "unit": "ms (deft 10)",
    "boolean": "0"
  },
  "MIDIsyncDelay": {
    "name": "Sync delay",
    "value": "100",
    "unit": "ms after wait (deft 380)",
    "boolean": "0"
  },
  "Nature_of_time": {
    "name": "Striated time",
    "value": "1",
    "unit": "",
    "boolean": "1"
  },
  "Pclock": {
    "name": "Pclock",
    "value": "1",
    "unit": "Pclock/Qclock is the period of metronome (seconds)",
    "boolean": "0"
  },
  "Qclock": {
    "name": "Qclock",
    "value": "1",
    "unit": "",
    "boolean": "0"
  },
  "NoteConvention": {
    "name": "Note convention",
    "value": "0",
    "unit": "0 = English: C, D, E...<br />1 = Italian/Spanish/French: do, re, mi...<br />2 = Indian: sa, re, ga...<br />3 = Keys<br />4 = Only from tonal scales(s)",
    "boolean": "0"
  },
  "B#_instead_of_C": {
    "name": "B# instead of C",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "Db_instead_of_C#": {
    "name": "Db instead of C#",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "Eb_instead_of_D#": {
    "name": "Eb instead of D#",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "Fb_instead_of_E": {
    "name": "Fb instead of E",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "E#_instead_of_F": {
    "name": "E# instead of F",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "Gb_instead_of_F#": {
    "name": "Gb instead of F#",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "Ab_instead_of_G#": {
    "name": "Ab instead of G#",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "Bb_instead_of_A#": {
    "name": "Bb instead of A#",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "Cb_instead_of_B": {
    "name": "Cb instead of B",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "TraceMicrotonality": {
    "name": "Trace microtonality",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "DisplayItems": {
    "name": "Display final score",
    "value": "0",
    "unit": "Bol Processor score",
    "boolean": "1"
  },
  "ShowGraphic": {
    "name": "Show graphics",
    "value": "1",
    "unit": "Object graph or Pianoroll, see below",
    "boolean": "1"
  },
  "ShowObjectGraph": {
    "name": "Show object graph",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "ShowAllObjects": {
    "name": "Show all objects",
    "value": "0",
    "unit": "including inaudible ones (for geeks)",
    "boolean": "1"
  },
  "ShowPianoRoll": {
    "name": "Show pianoroll",
    "value": "1",
    "unit": "",
    "boolean": "1"
  },
  "GraphicScaleP": {
    "name": "Graphic scale P",
    "value": "1",
    "unit": "",
    "boolean": "0"
  },
  "GraphicScaleQ": {
    "name": "Graphic scale Q",
    "value": "2",
    "unit": "",
    "boolean": "0"
  },
  "DisplayProduce": {
    "name": "Display production",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "SplitTimeObjects": {
    "name": "Split terminal symbols",
    "value": "1",
    "unit": "",
    "boolean": "1"
  },
  "SplitVariables": {
    "name": "Split |variables|",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "CsoundTrace": {
    "name": "Trace Csound",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "Improvize": {
    "name": "Non-stop improvize",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "MaxItemsProduce": {
    "name": "Max items produced",
    "value": "20",
    "unit": "Except in real-time MIDI (deft 20)",
    "boolean": "0"
  },
  "AllItems": {
    "name": "Produce all items",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "UseEachSub": {
    "name": "Play each substitution",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "StepProduce": {
    "name": "Step-by-step produce",
    "value": "0",
    "unit": "(not implemented)",
    "boolean": "1"
  },
  "TraceProduce": {
    "name": "Trace production",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "PlanProduce": {
    "name": "Choose candidate rule",
    "value": "0",
    "unit": "(not implemented)",
    "boolean": "1"
  },
  "DeftBufferSize": {
    "name": "Default buffer size",
    "value": "1002",
    "unit": "symbols",
    "boolean": "0"
  },
  "MaxConsoleTime": {
    "name": "Max computation time",
    "value": "3600",
    "unit": "seconds. Time for console's work (0 = no limit) Except in Improvize mode",
    "boolean": "0"
  },
  "ComputeWhilePlay": {
    "name": "Compute while playing",
    "value": "1",
    "unit": "true by default",
    "boolean": "1"
  },
  "AdvanceTime": {
    "name": "Max advance time",
    "value": "10.5",
    "unit": "seconds (if not compute while playing)",
    "boolean": "0"
  },
  "AllowRandomize": {
    "name": "Allow randomize",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "Seed": {
    "name": "Seed for randomization",
    "value": "15524",
    "unit": "Positive integer, or 0 if cards need to be shuffled",
    "boolean": "0"
  },
  "ResetNotes": {
    "name": "Reset Notes",
    "value": "1",
    "unit": "Send AllNotesOff, pedals off and reset pitchbend at the end of item",
    "boolean": "1"
  },
  "ResetWeights": {
    "name": "Reset rule weights",
    "value": "1",
    "unit": "",
    "boolean": "1"
  },
  "ResetFlags": {
    "name": "Reset rule flags",
    "value": "1",
    "unit": "/this is a flag/",
    "boolean": "1"
  },
  "ResetControllers": {
    "name": "Reset controllers",
    "value": "1",
    "unit": "volume, panoramic, pressure, pitchbend, modulation",
    "boolean": "1"
  },
  "EndFadeOut": {
    "name": "Fade-out time",
    "value": "2",
    "unit": "seconds (end of MIDI files and Csound scores)",
    "boolean": "0"
  },
  "NoConstraint": {
    "name": "Ignore constraints in time setting",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "DisplayTimeSet": {
    "name": "Time setting display",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "TraceTimeSet": {
    "name": "Time setting trace",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "StepTimeSet": {
    "name": "Time setting step",
    "value": "0",
    "unit": "(not implemented)",
    "boolean": "1"
  },
  "TraceMIDIinteraction": {
    "name": "Trace MIDI interactions",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "TraceNoteOn": {
    "name": "Trace NoteOn/NoteOff",
    "value": "0",
    "unit": "(only for short items)",
    "boolean": "1"
  },
  "SamplingRate": {
    "name": "Sampling rate",
    "value": "50",
    "unit": "samples per second, usually 50",
    "boolean": "0"
  },
  "C4key": {
    "name": "C4 (middle C) key number",
    "value": "60",
    "unit": "(0..127) usually 60",
    "boolean": "0"
  },
  "A4freq": {
    "name": "A4 frequency (diapason)",
    "value": "440.0000",
    "unit": "Hz (usually 440)",
    "boolean": "0"
  },
  "StrikeAgainDefault": {
    "name": "Strike again NoteOn's",
    "value": "1",
    "unit": "Keep checked unless you know why!<br>(Read https://bolprocessor.org/control-noteon-noteoff/)",
    "boolean": "1"
  },
  "DeftVelocity": {
    "name": "Default velocity",
    "value": "64",
    "unit": "(1..127)",
    "boolean": "0"
  },
  "DeftVolume": {
    "name": "Default volume",
    "value": "90",
    "unit": "(1..127)",
    "boolean": "0"
  },
  "VolumeController": {
    "name": "Volume controller",
    "value": "7",
    "unit": "(0..127) usually 7",
    "boolean": "0"
  },
  "DeftPanoramic": {
    "name": "Default panoramic",
    "value": "64",
    "unit": "(0..127)",
    "boolean": "0"
  },
  "PanoramicController": {
    "name": "Panoramic controller",
    "value": "10",
    "unit": "(0..127) usually 10",
    "boolean": "0"
  },
  "StopPauseContinue": {
    "name": "Respond to  Stop/Continue",
    "value": "1",
    "unit": "(if a MIDI input is active)",
    "boolean": "1"
  },
  "DefaultBlockKey": {
    "name": "Default block key",
    "value": "60",
    "unit": "(0..127) e.g. 60 for 'C4' or 69 for 'A4'",
    "boolean": "0"
  },
  "MinPeriod": {
    "name": "Minimum period",
    "value": "200",
    "unit": "ms (deft 200, at least 2 times the Quantization)<br>This is used for positioning sound-objects<br>(Read https://bolprocessor.org/control-noteon-noteoff/)",
    "boolean": "0"
  },
  "TraceCaptureAnalysis": {
    "name": "Trace this analysis",
    "value": "1",
    "unit": "",
    "boolean": "1"
  },
  "LiveGrammar": {
    "name": "Follow grammar(s)",
    "value": "0",
    "unit": "(Read https://bolprocessor.org/live-coding/)",
    "boolean": "1"
  },
  "LiveSettings": {
    "name": "Follow settings",
    "value": "0",
    "unit": "",
    "boolean": "1"
  },
  "TraceLive": {
    "name": "Trace changes",
    "value": "0",
    "unit": "",
    "boolean": "1"
  }
}
`, "fichier": "settings/notreich.json" }, { "nom": "settings/pattern_grammar", "format": "json", "texte": '{\n  "documented": false,\n  "AllItems": {\n    "name": "Produce all items",\n    "value": "1",\n    "boolean": "1"\n  },\n  "MaxItemsProduce": {\n    "name": "Max items to produce",\n    "value": "20",\n    "boolean": "0"\n  },\n  "AllowRandomize": {\n    "name": "Allow randomize",\n    "value": "1",\n    "boolean": "1"\n  }\n}', "fichier": "settings/pattern_grammar.json" }, { "nom": "settings/test1", "format": "json", "texte": '{\n  "documented": false,\n  "AllItems": {\n    "name": "Produce all items",\n    "value": "1",\n    "boolean": "1"\n  },\n  "MaxItemsProduce": {\n    "name": "Max items to produce",\n    "value": "50",\n    "boolean": "0"\n  },\n  "Quantization": {\n    "name": "Quantization",\n    "value": "5",\n    "unit": "ms",\n    "boolean": "0"\n  }\n}', "fichier": "settings/test1.json" }, { "nom": "settings", "format": "bpsl", "texte": '// @documented\n// @description Default BP3 engine settings. Overridden by @ directives. Used to generate the settings string for bp3_load_settings().\ndef settings(\n  resolvedBy:BPx,\n  resolves:settings,\n  name:settings,\n  version:"0.2.0",\n  section:bp3_defaults\n)\n\ndef Quantization(name:Quantization, value:"10", unit:ms, boolean:"0")\n\ndef Quantize(name:Quantize, value:"1", boolean:"1")\n\ndef Time_res(name:"Time resolution", value:"10", unit:ms, boolean:"0")\n\ndef MIDIsyncDelay(name:"MIDI sync delay", value:"100", unit:ms, boolean:"0")\n\ndef Nature_of_time(name:"Nature of time", value:"1", boolean:"0")\n\ndef NoteConvention(name:"Note convention", value:"0", boolean:"0")\n\ndef Pclock(name:"P clock", value:"1", boolean:"0")\n\ndef Qclock(name:"Q clock", value:"1", boolean:"0")\n\ndef ShowGraphic(name:"Show graphic", value:"0", boolean:"1")\n\ndef ShowObjectGraph(name:"Show object graphic", value:"0", boolean:"1")\n\ndef ShowPianoRoll(name:"Show piano roll", value:"0", boolean:"1")\n\ndef GraphicScaleP(name:"Graphic scale P", value:"0", boolean:"0")\n\ndef GraphicScaleQ(name:"Graphic scale Q", value:"0", boolean:"0")\n\ndef DisplayItems(name:"Display items", value:"1", boolean:"1")\n\ndef DisplayProduce(name:"Display produce", value:"0", boolean:"1")\n\ndef SplitTimeObjects(name:"Split time objects", value:"1", boolean:"1")\n\ndef SplitVariables(name:"Split variables", value:"0", boolean:"1")\n\ndef CsoundTrace(name:"Csound trace", value:"0", boolean:"1")\n\ndef Improvize(name:Improvize, value:"0", boolean:"1")\n\ndef DeftBufferSize(name:"Default buffer size", value:"1000", boolean:"0")\n\ndef ComputeWhilePlay(name:"Compute while playing", value:"1", boolean:"1")\n\ndef MaxConsoleTime(name:"Max console time", value:"60", boolean:"0")\n\ndef ResetNotes(name:"Reset notes between items", value:"1", boolean:"1")\n\ndef ResetWeights(name:"Reset rule weights", value:"1", boolean:"1")\n\ndef ResetFlags(name:"Reset flags", value:"1", boolean:"1")\n\ndef ResetControllers(name:"Reset controllers", value:"0", boolean:"1")\n\ndef EndFadeOut(name:"End fade out", value:"2.00", boolean:"0")\n\ndef C4key(name:"C4 key number", value:"60", boolean:"0")\n\ndef A4freq(name:"A4 frequency", value:"440.0000", boolean:"0")\n\ndef StrikeAgainDefault(name:"Strike again default", value:"1", boolean:"0")\n\ndef DeftVolume(name:"Default volume", value:"90", boolean:"0")\n\ndef VolumeController(name:"Volume controller", value:"7", boolean:"0")\n\ndef DeftVelocity(name:"Default velocity", value:"64", boolean:"0")\n\ndef DeftPanoramic(name:"Default panoramic", value:"64", boolean:"0")\n\ndef PanoramicController(name:"Panoramic controller", value:"10", boolean:"0")\n\ndef SamplingRate(name:"Sampling rate", value:"50", boolean:"0")\n\ndef TraceMicrotonality(name:"Trace microtonality", value:"0", boolean:"1")\n\ndef DisplayTimeSet(name:"Display time set", value:"0", boolean:"1")\n\ndef AllItems(name:"Produce all items", value:"0", boolean:"1")\n\ndef MaxItemsProduce(name:"Max items to produce", value:"20", boolean:"0")\n\ndef Seed(name:"Random seed", value:"0", boolean:"0")\n\ndef improvize(section:directive_map, Improvize:"1")\n\ndef allitems(section:directive_map, AllItems:"1", Improvize:"0")\n\ndef all_items(section:directive_map, AllItems:"1", Improvize:"0")\n\ndef maxitems(section:directive_map, MaxItemsProduce:"@value")\n\ndef items(section:directive_map, MaxItemsProduce:"@value")\n\ndef quantize(section:directive_map, Quantization:"@value")\n\ndef quantization(section:directive_map, Quantization:"@value")\n\ndef qclock(section:directive_map, Qclock:"@value")\n\ndef seed(section:directive_map, Seed:"@value")\n\ndef vel(section:directive_map, DeftVelocity:"@value")\n\ndef pan(section:directive_map, DeftPanoramic:"@value")\n\ndef volume(section:directive_map, DeftVolume:"@value")\n\ndef a4(section:directive_map, A4freq:"@value")\n\ndef timeres(section:directive_map, Time_res:"@value")\n\ndef note_conventions(section:"", western:1, raga:2, keys:3)\n', "fichier": "settings.bpsl" }, { "nom": "sounds", "format": "bpsl", "texte": 'types\n\n// @documented\ndef sounds(resolvedBy:"BPx", resolves:sound, name:sounds)\n\n// @description Tabla percussion \u2014 bols of bayan (low) and dayan (high). Prototype AT ENGINE DEFAULTS: it overrides no metric property.\n// Invoked by dhati, dhin and their twins (6 scenes of the corpus). The name comes from the corpus, not from an external catalogue.\nsound tabla_perc(\n)\n', "fichier": "sounds.bpsl" }, { "nom": "temperaments", "format": "bpsl", "texte": `types

// @documented
def temperaments(resolvedBy:Kairos, resolves:temperament)

// @description Equal temperament, 12 divisions of the octave
temperament 12TET(
  period_ratio:2,
  divisions:12,
  ratios(1, 100c, 200c, 300c, 400c, 500c, 600c, 700c, 800c, 900c, 1000c, 1100c)
)

// @description Quarter-tone equal temperament, 24 divisions of the octave
temperament 24TET(
  period_ratio:2,
  divisions:24,
  ratios(
    1,
    50c,
    100c,
    150c,
    200c,
    250c,
    300c,
    350c,
    400c,
    450c,
    500c,
    550c,
    600c,
    650c,
    700c,
    750c,
    800c,
    850c,
    900c,
    950c,
    1000c,
    1050c,
    1100c,
    1150c
  )
)

// @description Holdrian comma system, 53 divisions of the octave. Used in Turkish makam theory. 1 step \u2248 22.64 cents.
temperament 53TET(
  period_ratio:2,
  divisions:53,
  ratios(
    1,
    22.642c,
    45.283c,
    67.925c,
    90.566c,
    113.208c,
    135.849c,
    158.491c,
    181.132c,
    203.774c,
    226.415c,
    249.057c,
    271.698c,
    294.340c,
    316.981c,
    339.623c,
    362.264c,
    384.906c,
    407.547c,
    430.189c,
    452.830c,
    475.472c,
    498.113c,
    520.755c,
    543.396c,
    566.038c,
    588.679c,
    611.321c,
    633.962c,
    656.604c,
    679.245c,
    701.887c,
    724.528c,
    747.170c,
    769.811c,
    792.453c,
    815.094c,
    837.736c,
    860.377c,
    883.019c,
    905.660c,
    928.302c,
    950.943c,
    973.585c,
    996.226c,
    1018.868c,
    1041.509c,
    1064.151c,
    1086.792c,
    1109.434c,
    1132.075c,
    1154.717c,
    1177.358c
  )
)

// @description Pythagorean tuning \u2014 pure fifths (3/2). Comma: 531441/524288 \u2248 23.46 cents.
temperament pythagorean(
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 729/512, 3/2, 128/81, 27/16, 16/9, 243/128)
)

// @description 5-limit just intonation \u2014 pure thirds and fifths.
temperament just_5limit(
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 5/4, 4/3, 45/32, 3/2, 8/5, 5/3, 9/5, 15/8)
)

// @description 1/4-comma meantone \u2014 major thirds exactly 5/4. Fifths narrowed by 1/4 syntonic comma.
temperament meantone_quarter(
  period_ratio:2,
  divisions:12,
  ratios(
    1,
    1.044907,
    1.118034,
    1.196279,
    1.25,
    1.337481,
    1.397542,
    1.495349,
    1.5625,
    1.671851,
    1.788854,
    1.869186
  )
)

// @description 22 shruti \u2014 Indian tradition, 5-limit just intonation. Unequal steps (pramana ~22c, nyuna ~70c, purna ~90c).
temperament 22shruti(
  period_ratio:2,
  divisions:22,
  ratios(
    1,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    4/3,
    27/20,
    45/32,
    729/512,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128
  )
)

// @description Bohlen-Pierce just \u2014 7-limit, tritave (3:1). 13 steps.
temperament bohlen_pierce_just(
  period_ratio:3,
  divisions:13,
  ratios(1, 27/25, 25/21, 9/7, 7/5, 75/49, 5/3, 9/5, 49/25, 15/7, 7/3, 63/25, 25/9)
)

// @description Bohlen-Pierce equal \u2014 13 equal divisions of the tritave (3:1).
temperament bohlen_pierce_equal(
  period_ratio:3,
  divisions:13,
  ratios(
    1,
    146.3c,
    292.6c,
    438.9c,
    585.2c,
    731.5c,
    877.8c,
    1024.1c,
    1170.4c,
    1316.7c,
    1463.0c,
    1609.3c,
    1755.6c
  )
)

// @description Gamelan pelog \u2014 7-tone, Central Javanese approximation. Stretched octave. Varies by ensemble.
temperament gamelan_pelog(
  period_ratio:2.02,
  divisions:7,
  ratios(1, 1.126, 1.244, 1.351, 1.496, 1.683, 1.894)
)

// @description Gamelan slendro \u2014 near-equal pentatonic, Central Javanese approximation. Stretched octave.
temperament gamelan_slendro(
  period_ratio:2.01,
  divisions:5,
  ratios(1, 1.143, 1.317, 1.516, 1.741)
)

// @description This is a reduction to 12 grades of scale "Ma05" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'Bb'
// Created on 2021-01-05 18:34:29 Scale aligned ratio 1.0125 (2022-03-11 07:57:41)
temperament bp3_Abmaj(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 4/3, 64/45, 3/2, 8/5, 27/16, 9/5, 243/128),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma08" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:09:51 Scale aligned
// ratio 1.0125 (2022-03-11 07:56:59)
temperament bp3_Abmin(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 64/45, 3/2, 405/256, 27/16, 3645/2048, 243/128),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma10" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'B'
// Created 2021-01-05 18:56:02
temperament bp3_Amaj(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 243/128),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma01" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:00:08
temperament bp3_Amin(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 10/9, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma03" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'C'
// Created 2021-01-05 18:31:20
temperament bp3_Bbmaj(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 10/9, 32/27, 5/4, 4/3, 45/32, 40/27, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma06" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:08:40
temperament bp3_Bbmin(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:12,
  ratios(80/81, 256/243, 10/9, 75/64, 5/4, 320/243, 45/32, 40/27, 128/81, 5/3, 225/128, 15/8),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma08" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'Db'
// Created 2021-01-05 19:37:40
temperament bp3_Bmaj(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 32/27, 81/64, 4/3, 729/512, 3/2, 128/81, 27/16, 16/9, 243/128),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma11" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:12:50
temperament bp3_Bmin(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 15/8),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma01" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'D'
// Created 2021-01-05 18:29:30
temperament bp3_Cmaj(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma04" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 17:49:25
temperament bp3_Cmin(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:12,
  ratios(80/81, 256/243, 10/9, 32/27, 5/4, 320/243, 45/32, 40/27, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma06" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'Eb'
// Created 2021-01-05 18:35:44Scale aligned ratio 1.0125 (2022-03-11 07:59:19)
temperament bp3_Dbmaj(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 4/3, 64/45, 3/2, 8/5, 27/16, 3645/2048, 243/128),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma09" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:10:26 Scale aligned
// ratio 1.0125 (2022-03-11 07:59:30)
temperament bp3_Dbmin(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 45/32, 3/2, 405/256, 27/16, 3645/2048, 243/128),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma11" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'E'
// Created 2021-01-05 18:48:23
temperament bp3_Dmaj(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 15/8),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma02" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:06:48
temperament bp3_Dmin(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 10/9, 32/27, 5/4, 4/3, 45/32, 40/27, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma04" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'F'
// Created 2021-01-05 18:33:09Scale aligned ratio 1.0125 (2022-03-11 07:50:02)
temperament bp3_Ebmaj(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 27/20, 64/45, 3/2, 8/5, 27/16, 9/5, 243/128),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma07" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:09:20 Scale aligned
// ratio 1.0125 (2022-03-11 07:59:38)
temperament bp3_Ebmin(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 32/27, 81/64, 4/3, 64/45, 3/2, 405/256, 27/16, 3645/2048, 243/128),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma09" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'F#'
// Created 2021-01-05 19:38:38
temperament bp3_Emaj(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 729/512, 3/2, 128/81, 27/16, 16/9, 243/128),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma12" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:13:25
temperament bp3_Emin(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma07" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'Ab'
// Created 2021-01-05 19:36:32
temperament bp3_F_maj(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 32/27, 81/64, 4/3, 729/512, 3/2, 8/5, 27/16, 16/9, 243/128),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma10" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:10:57
temperament bp3_F_min(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 15/8),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma02" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'G'
// Created 2021-01-05 18:30:32
temperament bp3_Fmaj(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 10/9, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma05" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:07:58 Scale aligned
// ratio 1.0125 (2022-03-11 07:59:51)
temperament bp3_Fmin(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 4/3, 64/45, 3/2, 8/5, 27/16, 3645/2048, 243/128),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma12" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'A'
// Created 2021-01-05 18:49:22
temperament bp3_Gmaj(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 15/8),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma03" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:15:32Scale aligned
// ratio 1.0125 (2022-03-11 07:54:43)
temperament bp3_Gmin(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 27/20, 64/45, 3/2, 8/5, 27/16, 9/5, 243/128),
  comma:81/80
)

// @description Scale "Ma01" from Bernard Bel / Bol Processor
temperament bp3_Ma01(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    4/3,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Ma01" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2020-11-28 16:51:26
temperament bp3_Ma02(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    4/3,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Ma2" (23 grades) From \u2018C\u2019 to \u2018F\u2019 Created 2020-11-27 18:26:51
temperament bp3_Ma03(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:23,
  ratios(
    80/81,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    4/3,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Ma3" (23 grades) From \u2018E\u2019 to \u2018A\u2019 Created 2020-11-27 19:34:18
temperament bp3_Ma04(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:23,
  ratios(
    80/81,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    320/243,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Ma4" (23 grades) From \u2018Eb\u2019 to \u2018Ab\u2019 Created 2020-11-28 07:25:59
temperament bp3_Ma05(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:23,
  ratios(
    80/81,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    320/243,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    225/128,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Ma5" (23 grades) From \u2018D\u2019 to \u2018G\u2019 Created 2020-11-28 07:48:18
temperament bp3_Ma06(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:23,
  ratios(
    80/81,
    256/243,
    16/15,
    10/9,
    9/8,
    75/64,
    6/5,
    5/4,
    81/64,
    320/243,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    225/128,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Ma6" (23 grades) From \u2018D\u2019 to \u2018G\u2019 Created 2020-11-28 08:01:21
temperament bp3_Ma07(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:23,
  ratios(
    80/81,
    256/243,
    16/15,
    10/9,
    9/8,
    75/64,
    6/5,
    5/4,
    81/64,
    320/243,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    25/16,
    8/5,
    5/3,
    27/16,
    225/128,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Ma7" (23 grades) From \u2018C\u2019 to \u2018F\u2019 Created 2020-11-28 08:11:34
temperament bp3_Ma08(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:23,
  ratios(
    80/81,
    50/48,
    16/15,
    10/9,
    9/8,
    75/64,
    6/5,
    5/4,
    81/64,
    320/243,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    25/16,
    8/5,
    5/3,
    27/16,
    225/128,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Ma08" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2020-11-28 19:09:43
temperament bp3_Ma09(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:23,
  ratios(
    80/81,
    50/48,
    16/15,
    10/9,
    9/8,
    75/64,
    6/5,
    5/4,
    81/64,
    320/243,
    27/20,
    25/18,
    64/45,
    40/27,
    3/2,
    25/16,
    8/5,
    5/3,
    27/16,
    225/128,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Ma09" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 17:41:33
temperament bp3_Ma10(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    4/3,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Ma10" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:42:40
temperament bp3_Ma11(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    9/8,
    729/640,
    32/27,
    6/5,
    5/4,
    6561/5120,
    4/3,
    27/20,
    45/32,
    64/45,
    3/2,
    243/160,
    128/81,
    8/5,
    27/16,
    2187/1280,
    16/9,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Ma11" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:43:43
temperament bp3_Ma12(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    9/8,
    729/640,
    32/27,
    6/5,
    5/4,
    6561/5120,
    4/3,
    27/20,
    45/32,
    64/45,
    3/2,
    243/160,
    128/81,
    8/5,
    5/3,
    2187/1280,
    16/9,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Ma12" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:44:52
temperament bp3_Ma13(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    10/9,
    729/640,
    32/27,
    6/5,
    5/4,
    6561/5120,
    4/3,
    27/20,
    45/32,
    64/45,
    3/2,
    243/160,
    128/81,
    8/5,
    5/3,
    2187/1280,
    16/9,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description Scale "Ma_grama" from Bernard Bel / Bol Processor
temperament bp3_Ma_grama(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    4/3,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a derivation of scale "Ma01" (23 grades) in major tonality. Sensitive note = 'D' Created 2020-12-05 21:18:01
temperament bp3_Sa01(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    4/3,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128
  )
)

// @description This is a derivation of scale "Ma02" (23 grades) in major tonality. Sensitive note = 'G' Created 2020-12-05 21:18:59
temperament bp3_Sa02(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    4/3,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128
  )
)

// @description This is a derivation of scale "Ma03" (23 grades) in major tonality. Sensitive note = 'C' Created 2020-12-05 22:00:48
temperament bp3_Sa03(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    4/3,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128
  )
)

// @description This is a derivation of scale "Ma04" (23 grades) in major tonality. Sensitive note = 'F' Created 2020-12-05 21:26:05
temperament bp3_Sa04(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:23,
  ratios(
    80/81,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    320/243,
    4/3,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128
  )
)

// @description This is a derivation of scale "Ma05" (23 grades) in major tonality. Sensitive note = 'Bb' Created 2020-12-05 21:26:54
temperament bp3_Sa05(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:23,
  ratios(
    80/81,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    320/243,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    1280/729,
    16/9,
    15/8,
    243/128
  )
)

// @description This is a derivation of scale "Ma06" (23 grades) in major tonality. Sensitive note = 'Eb' Created 2020-12-05 21:27:42
temperament bp3_Sa06(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:23,
  ratios(
    80/81,
    256/243,
    16/15,
    10/9,
    9/8,
    75/64,
    32/27,
    5/4,
    81/64,
    320/243,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    225/128,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a derivation of scale "Ma07" (23 grades) in major tonality. Sensitive note = 'Ab' Created 2020-12-05 21:28:36
temperament bp3_Sa07(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:23,
  ratios(
    80/81,
    256/243,
    16/15,
    10/9,
    9/8,
    75/64,
    6/5,
    5/4,
    81/64,
    320/243,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    25/16,
    128/81,
    5/3,
    27/16,
    225/128,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a derivation of scale "Ma08" (23 grades) in major tonality. Sensitive note = 'Db' Created 2020-12-05 21:29:15
temperament bp3_Sa08(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:23,
  ratios(
    80/81,
    25/24,
    256/243,
    10/9,
    9/8,
    75/64,
    6/5,
    5/4,
    81/64,
    320/243,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    25/16,
    8/5,
    5/3,
    27/16,
    225/128,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a derivation of scale "Ma09" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'F#' Created
// 2021-01-05 14:44:42
temperament bp3_Sa09(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:23,
  ratios(
    80/81,
    50/48,
    16/15,
    10/9,
    9/8,
    75/64,
    6/5,
    5/4,
    81/64,
    320/243,
    27/20,
    25/18,
    45/32,
    40/27,
    3/2,
    25/16,
    8/5,
    5/3,
    27/16,
    225/128,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Sa09" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:11:29
temperament bp3_Sa10(
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:23,
  ratios(
    80/81,
    50/48,
    16/15,
    10/9,
    9/8,
    75/64,
    6/5,
    5/4,
    81/64,
    320/243,
    27/20,
    25/18,
    45/32,
    40/27,
    3/2,
    25/16,
    8/5,
    5/3,
    27/16,
    225/128,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Sa10" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:49:01
temperament bp3_Sa11(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    9/8,
    729/640,
    32/27,
    6/5,
    81/64,
    6561/5120,
    4/3,
    27/20,
    45/32,
    64/45,
    3/2,
    243/160,
    128/81,
    8/5,
    27/16,
    2187/1280,
    16/9,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Sa11" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:51:22
temperament bp3_Sa12(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    9/8,
    729/640,
    32/27,
    6/5,
    5/4,
    6561/5120,
    4/3,
    27/20,
    45/32,
    64/45,
    3/2,
    243/160,
    128/81,
    8/5,
    27/16,
    2187/1280,
    16/9,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Sa12" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:52:00
temperament bp3_Sa13(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    9/8,
    729/640,
    32/27,
    6/5,
    5/4,
    6561/5120,
    4/3,
    27/20,
    45/32,
    64/45,
    3/2,
    243/160,
    128/81,
    8/5,
    5/3,
    2187/1280,
    16/9,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description A "5-limit" tuning framework for constructing chromatic scales using exclusively ratios of integers 2, 3, 5. Read:
// http://www.tonalsoft.com/enc/j/just.aspx
temperament bp3_base(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    4/3,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128
  )
)

// @description The Indian grama scale as conceptualized by E. J. Arnold. Publication: \u2018L'intonation juste dans la th\xE9orie ancienne de
// l'Inde : les applications aux musiques modale et harmonique\u2019. Revue de Musicologie, vol. 71c n\xB0 1-2, 1985, p. 11-38. Edited and
// translated by Bernard Bel This version has been modified to define 22 notes on 23 intervals: it has no "m4" (Ma tivra + pramana shruti).
temperament bp3_grama(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    4/3,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description Two series of perfect fifths including ascending major thirds (Asselin 2000 p.62) Created 2021-01-08 09:02:23
temperament bp3_2_cycles_of_fifths(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:29,
  ratios(
    1,
    25/24,
    256/243,
    16/15,
    10/9,
    9/8,
    75/64,
    32/27,
    6/5,
    5/4,
    81/64,
    320/243,
    4/3,
    25/18,
    45/32,
    64/45,
    40/27,
    3/2,
    25/16,
    128/81,
    8/5,
    5/3,
    27/16,
    225/128,
    16/9,
    9/5,
    15/8,
    243/128,
    160/81
  ),
  comma:81/80
)

// @description Three series of perfect fifths including ascending and descending major thirds (Asselin 2000 p.62) Created 2021-01-08
// 09:02:23
temperament bp3_3_cycles_of_fifths(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:41,
  ratios(
    1,
    81/80,
    25/24,
    256/243,
    16/15,
    27/25,
    10/9,
    9/8,
    256/225,
    75/64,
    32/27,
    6/5,
    243/200,
    5/4,
    81/64,
    32/25,
    320/243,
    4/3,
    27/20,
    25/18,
    45/32,
    64/45,
    36/25,
    40/27,
    3/2,
    243/160,
    25/16,
    128/81,
    8/5,
    81/50,
    5/3,
    27/16,
    128/75,
    225/128,
    16/9,
    9/5,
    729/400,
    15/8,
    243/128,
    48/25,
    160/81
  ),
  comma:81/80
)

// @description Created meantone upwards notes \u201Cdo, sol, re, la, mi, si, fa#, do#, sol#\u201D ratio 3/2 -2/7 comma (2021-01-11 18:00:22) Created
// meantone downwards notes \u201Cdo, fa, sib, mib\u201D ratio 3/2 -2/7 comma (2021-01-11 18:05:45) Created meantone upwards notes \u201Cdo, sol\u201D ratio 3/2
// -2/7 comma (2021-01-11 18:06:40)
temperament bp3_Zarlino_temp(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.042, 1.117, 1.198, 1.248, 1.338, 1.394, 1.495, 1.557, 1.67, 1.79, 1.865),
  comma:81/80
)

// @description Created 2021-01-14 09:31:50 Created meantone upward notes \u201Cdo,mi,sol2#\u201D fraction 5/4 (2021-01-14 09:32:46) Created meantone
// downward notes \u201Csol2#,do#\u201D fraction 3/2 (2021-01-14 09:33:55) Equalized intervals over series \u201Cdo,sol,re,la,mi,si,fa#,do#\u201D approx
// fraction 3/2 adjusted -6.1 cents to ratio = 1.495 (2021-01-14 09:34:42) Created meantone downward notes \u201Csol,mib\u201D fraction 5/4
// (2021-01-14 09:37:02) Equalized intervals over series \u201Cmib,sib,fa,do\u201D approx fraction 3/2 adjusted -5.2 cents to ratio = 1.495
// (2021-01-14 09:38:54)
temperament bp3_Zarlino_temp2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:13,
  ratios(1, 1.042, 1.117, 1.196, 1.248, 1.25, 1.337, 1.394, 1.495, 1.563, 1.67, 1.789, 1.865),
  comma:81/80
)

// @description Kellner's BACH meantone temperament (Asselin 2000 p.101) Created 2021-01-15 16:02:04Created meantone upward notes
// \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/5 comma (2021-01-15 16:10:04) Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting
// fraction 1/1 (2021-01-15 16:11:48) Created meantone upward notes \u201Cmi,si\u201D fraction 3/2 (2021-01-15 16:13:36)
temperament bp3_meantone_BACH(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.119, 1.185, 1.253, 1.333, 1.406, 1.496, 1.58, 1.675, 1.778, 1.88),
  comma:81/80
)

// @description Barca meantone temperament (Asselin 2000 p.106) Created 2021-01-16 17:56:02 Added fifths down: \u201Cdo,fa,sib\u201D starting fraction
// 1/1 (2021-01-16 17:57:57) Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#\u201D fraction 3/2 adjusted -1/6 comma (2021-01-16 18:02:25)
// Created meantone upward notes \u201Cfa#,do#,sol#,re#\u201D fraction 3/2 (2021-01-16 18:03:49)
temperament bp3_meantone_barca(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.055, 1.12, 1.186, 1.255, 1.333, 1.406, 1.497, 1.582, 1.677, 1.778, 1.879),
  comma:81/80
)

// @description B\xE9thisy meantone temperament (Asselin 2000 p.121) Created 2021-01-16 19:21:57 Created meantone upward notes
// \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:23:36) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2
// adjusted 1/12 comma (2021-01-16 19:25:49) Created meantone downward notes \u201Cmib,sol#\u201D fraction 3/2 (2021-01-16 19:26:26) Equalized
// intervals over series \u201Cmi,si,fa#,do#,sol#\u201D approx fraction 3/2 adjusted -1.7 cents to ratio = 1.499 (2021-01-16 19:28:09)
temperament bp3_meantone_bethisy(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.052, 1.118, 1.182, 1.25, 1.332, 1.404, 1.495, 1.576, 1.672, 1.774, 1.873),
  comma:81/80
)

// @description Chaumont meantone temperament (Asselin 2000 p.109) Created 2021-01-16 18:06:34 Created meantone upward notes
// \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:08:41) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D
// fraction 3/2 adjusted -1/4 comma (2021-01-16 18:09:41)
temperament bp3_meantone_chaumont(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.196, 1.25, 1.337, 1.398, 1.495, 1.563, 1.672, 1.789, 1.869),
  comma:81/80
)

// @description This is an equal-tempered scale for BP3 + Csound. Created 2021-01-14 15:38:08 Created meantone upward notes
// \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-14 15:40:20) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D
// fraction 3/2 adjusted -1/4 comma (2021-01-14 15:40:57) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/4 comma
// (2021-01-14 15:43:44)
temperament bp3_meantone_classic(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.196, 1.25, 1.337, 1.398, 1.495, 1.563, 1.672, 1.789, 1.869),
  comma:81/80
)

// @description Corrette meantone temperament (Asselin 2000 p.111) Created 2021-01-16 18:13:10 Created meantone upward notes
// \u201Cfa,do,sol,re,la,mi,si,fa#,do#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:16:40) Created meantone downward notes \u201Cfa,sib,mib\u201D
// fraction 3/2 adjusted 1/12 comma (2021-01-16 18:34:13) Created meantone upward notes \u201Cdo#,sol#\u201D fraction 3/2 adjusted 1/12 comma
// (2021-01-16 18:38:14) Base note reset to \u2018do\u2019 (2021-01-16 18:40:53)
temperament bp3_meantone_corrette(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.187, 1.25, 1.338, 1.398, 1.496, 1.569, 1.672, 1.782, 1.87),
  comma:81/80
)

// @description D'Alembert-Rousseau meantone temperament (Asselin 2000 p.119) Created 2021-01-16 19:04:44 Created meantone upward notes
// \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:12:08) Created meantone downward notes \u201Cdo,fa,sib,mib,sol#\u201D fraction
// 3/2 adjusted 1/12 comma (2021-01-16 19:17:25) Equalized intervals over series \u201Csol#,do#,fa#,si,mi\u201D approx fraction 2/3 adjusted 2.2 cents
// to ratio = 0.668 (2021-01-16 19:19:34)
temperament bp3_meantone_d_alembert_rousseau(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.051, 1.118, 1.182, 1.25, 1.332, 1.403, 1.495, 1.574, 1.672, 1.774, 1.873),
  comma:81/80
)

// @description Kirnberger II meantone temperament (Asselin 2000 p. 90) Created 2021-01-16 11:52:39 Added fifths down:
// \u201Cdo,fa,sib,mib,lab,reb\u201D starting fraction 1/1 (2021-01-16 11:54:59) Added fifths up: \u201Cdo,sol,re\u201D starting fraction 1/1 (2021-01-16
// 11:55:59) Created meantone upward notes \u201Cre,la,mi\u201D fraction 3/2 adjusted -1/2 comma (2021-01-16 11:57:13) Created meantone upward notes
// \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 11:58:24)
temperament bp3_meantone_kirnberger_2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.125, 1.185, 1.25, 1.333, 1.406, 1.5, 1.58, 1.677, 1.778, 1.875),
  comma:81/80
)

// @description Kirnberger III meantone temperament (Asselin 2000 p.92) Created 2021-01-16 12:02:11 Added fifths down:
// \u201Cdo,fa,sib,mib,lab,reb\u201D starting fraction 1/1 (2021-01-16 12:03:52) Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted
// -1/4 comma (2021-01-16 12:05:20) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 12:06:10)
temperament bp3_meantone_kirnberger_3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.118, 1.185, 1.25, 1.333, 1.406, 1.495, 1.58, 1.672, 1.778, 1.875),
  comma:81/80
)

// @description Marpourg meantone temperament (Asselin 2000 p.117) Created 2021-01-16 18:58:49 Created meantone upward notes
// \u201Cfa,do,sol,re,la,mi,si,fa#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:00:42) Equalized intervals over series
// \u201Cfa,la#,re#,sol#,do#,fa#\u201D approx fraction 2/3 adjusted -2.8 cents to ratio = 0.666 (2021-01-16 19:02:32) Base note reset to \u2018do\u2019
// (2021-01-16 19:03:15)
temperament bp3_meantone_marpourg(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.05, 1.118, 1.185, 1.25, 1.338, 1.398, 1.496, 1.577, 1.672, 1.781, 1.87),
  comma:81/80
)

// @description Pure minor-thirds temperament (Asselin 2000 p.82) Created 2021-01-15 15:13:09 Created meantone upward notes
// \u201Cmib,sib,fa,do,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-15 15:15:22) Base note reset to \u2018do\u2019 (2021-01-15
// 15:16:00)
temperament bp3_meantone_pure_minor-thirds(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.037, 1.116, 1.2, 1.244, 1.339, 1.388, 1.494, 1.549, 1.666, 1.792, 1.86),
  comma:81/80
)

// @description Rameau meantone in C temperament (Asselin 2000 p.113) Created 2021-01-16 18:41:56 Created meantone upward notes
// \u201Cdo,sol,re,la,mi,si,fa#,do#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:44:03) Added fifths down: \u201Cdo,fa\u201D starting fraction 1/1
// (2021-01-16 18:49:25) Created meantone upward notes \u201Cdo#,sol#\u201D fraction 3/2 adjusted -1/12 comma (2021-01-16 18:51:19) Created meantone
// downward notes \u201Cfa,la#\u201D fraction 3/2 (2021-01-16 18:54:20) Equalized intervals over series \u201Csol#,re#,la#\u201D approx fraction 3/2 adjusted
// 7.5 cents to ratio = 1.506 (2021-01-16 18:55:25)
temperament bp3_meantone_rameau_en_do(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.18, 1.25, 1.333, 1.398, 1.495, 1.566, 1.672, 1.777, 1.869),
  comma:81/80
)

// @description Sauveur meantone temperament (Asselin 2000 p. 81) Created 2021-01-16 10:37:52 Created meantone downward notes
// \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/5 comma (2021-01-16 10:44:41) Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D
// fraction 3/2 adjusted -1/5 comma (2021-01-16 10:48:56)
temperament bp3_meantone_sauveur(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.049, 1.119, 1.194, 1.253, 1.337, 1.403, 1.496, 1.57, 1.675, 1.787, 1.875),
  comma:81/80
)

// @description Schlick meantone temperament (Asselin 2000 p.88) Created 2021-01-16 10:56:35 Created meantone downward notes
// \u201Cla,re,sol,do,fa\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 10:58:50) Created meantone upward notes \u201Cla,mi,si\u201D fraction 3/2 adjusted
// -1/4 comma (2021-01-16 10:59:48) Created meantone upward notes \u201Cla,do#\u201D fraction 5/4 (2021-01-16 11:04:11) Equalized intervals over
// series \u201Csi,fa#,do#\u201D approx fraction 3/2 adjusted -5.4 cents to ratio = 1.495 (2021-01-16 11:05:59) Created meantone downward notes
// \u201Csol,mib\u201D fraction 5/4 (2021-01-16 11:07:31) Equalized intervals over series \u201Cmib,sib,fa\u201D approx fraction 3/2 adjusted -5.3 cents to
// ratio = 1.495 (2021-01-16 11:08:47) Created meantone downward notes \u201Cdo,lab\u201D fraction 5/4 (2021-01-16 11:13:58) Created meantone upward
// notes \u201Cmi,sol#\u201D fraction 5/4 adjusted 2/3 comma (2021-01-16 11:23:39) [estimation] Base note reset to \u2018do\u2019 (2021-01-16 11:25:48)
temperament bp3_meantone_schlick(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:13,
  ratios(1, 1.045, 1.118, 1.196, 1.25, 1.338, 1.398, 1.496, 1.575, 1.6, 1.672, 1.789, 1.87),
  comma:81/80
)

// @description Tartini-Vallotti meantone temperament (Asselin 2000 p.104) Created 2021-01-16 17:45:36 Added fifths down:
// \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-16 17:47:11) Created meantone upward notes \u201Cdo,sol,re,la,mi,si\u201D fraction 3/2
// adjusted -1/6 comma (2021-01-16 17:48:49)
temperament bp3_meantone_tartini-vallotti(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.12, 1.185, 1.255, 1.333, 1.406, 1.497, 1.58, 1.677, 1.778, 1.879),
  comma:81/80
)

// @description Werckmeister III meantone temperament (Asselin 2000 p.94) Created 2021-01-16 16:53:15 Added fifths down:
// \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-16 16:55:35) Created meantone upward notes \u201Cdo,sol,re,la\u201D fraction 3/2
// adjusted -1/4 comma (2021-01-16 16:57:00) Created meantone upward notes \u201Cla,mi,si\u201D fraction 3/2 (2021-01-16 16:58:34)
temperament bp3_meantone_werckmeister_3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.118, 1.185, 1.254, 1.333, 1.406, 1.495, 1.58, 1.672, 1.778, 1.881),
  comma:81/80
)

// @description Werckmeister IV meantone temperament (Asselin 2000 p.96) Created 2021-01-16 17:02:48 Added fifths down: \u201Cdo,fa\u201D starting
// fraction 1/1 (2021-01-16 17:07:10) Created meantone downward notes \u201Cfa,sib\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:08:04)
// Created meantone downward notes \u201Csib,mib,sol#\u201D fraction 3/2 adjusted 1/3 comma (2021-01-16 17:09:18) Created meantone downward notes
// \u201Csol#,do#\u201D fraction 3/2 (2021-01-16 17:11:01) Created meantone downward notes \u201Cdo#,fa#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16
// 17:12:07) Created meantone downward notes \u201Cfa#,si\u201D fraction 3/2 (2021-01-16 17:13:21) Created meantone downward notes \u201Csi,mi\u201D fraction
// 3/2 adjusted -1/3 comma (2021-01-16 17:14:45) Created meantone downward notes \u201Cmi,la\u201D fraction 3/2 (2021-01-16 17:16:07) Created meantone
// upward notes \u201Cdo,sol\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:17:11) Created meantone upward notes \u201Csol,re\u201D fraction 3/2
// (2021-01-16 17:17:49)
temperament bp3_meantone_werckmeister_4(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.049, 1.121, 1.185, 1.253, 1.333, 1.404, 1.494, 1.574, 1.671, 1.785, 1.872),
  comma:81/80
)

// @description Werckmeister V meantone temperament (Asselin 2000 p.99) Created 2021-01-16 17:29:54 Added fifths up: \u201Cdo,sol,re\u201D starting
// fraction 1/1 (2021-01-16 17:31:53) Created meantone upward notes \u201Cre,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:33:19)
// Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 17:34:05) Created meantone upward notes \u201Cfa#,do#,lab\u201D fraction 3/2
// adjusted -1/4 comma (2021-01-16 17:35:20) Created meantone downward notes \u201Cdo,fa\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:36:08)
// Created meantone downward notes \u201Cfa,sib,mib\u201D fraction 3/2 (2021-01-16 17:37:05)
temperament bp3_meantone_werckmeister_5(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.058, 1.125, 1.188, 1.258, 1.337, 1.415, 1.5, 1.582, 1.682, 1.783, 1.887),
  comma:81/80
)

// @description Zarlino meantone temperament (Asselin 2000 p.85) Created meantone upwards notes \u201Cdo, sol, re, la, mi, si, fa#, do#, sol#\u201D
// ratio 3/2 -2/7 comma (2021-01-11 18:00:22) Created meantone downwards notes \u201Cdo, fa, sib, mib\u201D ratio 3/2 -2/7 comma (2021-01-11 18:05:45)
// Created meantone upwards notes \u201Cdo, sol\u201D ratio 3/2 -2/7 comma (2021-01-11 18:06:40)
temperament bp3_meantone_zarlino(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.042, 1.117, 1.198, 1.248, 1.338, 1.394, 1.495, 1.557, 1.67, 1.79, 1.865),
  comma:81/80
)

// @description Tuning of a piano with perfect fifths and stretched octave
temperament bp3_piano(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2.004,
  divisions:12,
  ratios(1, 1.06, 1.123, 1.19, 1.261, 1.336, 1.416, 1.5, 1.59, 1.684, 1.785, 1.891)
)

// @description Tuning of a piano with perfect fifths and stretched octave
temperament bp3_stretched_octave-Indian(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2.004,
  divisions:12,
  ratios(1, 1.06, 1.123, 1.19, 1.261, 1.336, 1.416, 1.5, 1.59, 1.685, 1.785, 1.891),
  comma:81/80
)

// @description This is an equal-tempered scale for BP3 + Csound. Created 2021-01-15 16:02:04Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D
// fraction 3/2 adjusted -1/5 comma (2021-01-15 16:10:04) Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-15
// 16:11:48) Created meantone upward notes \u201Cmi,si\u201D fraction 3/2 (2021-01-15 16:13:36)
temperament bp3_bach_temperament(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.119, 1.185, 1.253, 1.333, 1.406, 1.496, 1.58, 1.675, 1.778, 1.88),
  comma:81/80
)

// @description This is an equal-tempered scale for BP3 + Csound. Created 2021-01-15 15:13:09 Created meantone upward notes
// \u201Cmib,sib,fa,do,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-15 15:15:22) Base note reset to \u2018do\u2019 (2021-01-15
// 15:16:00)
temperament bp3_pure_minor-third_meantone(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.037, 1.116, 1.2, 1.244, 1.339, 1.388, 1.494, 1.549, 1.666, 1.792, 1.86),
  comma:81/80
)

// @description A traditional scale constructed with 'simple' integer ratios
temperament bp3_just_intonation(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 5/4, 4/3, 64/45, 3/2, 8/5, 5/3, 16/9, 15/8),
  comma:81/80
)

// @description Rameau meantone in B flat temperament (Asselin 2000 p.115) Created 2021-01-16 18:41:56 Created meantone upward notes
// \u201Cdo,sol,re,la,mi,si\u201D fraction 3/2 adjusted -1/4 comma (2022-02-04 16:38:50) Created meantone downward notes \u201Cdo,fa,sib\u201D fraction 3/2
// adjusted -1/4 comma (2022-02-04 16:40:08) Created meantone downward notes \u201Csib,mib\u201D fraction 3/2 (2022-02-04 16:58:49) Created meantone
// upward notes \u201Csi,fa#\u201D fraction 3/2 adjusted -1/4 comma (2022-02-04 17:10:32) Created meantone downward notes \u201Cmib,lab\u201D fraction 3/2
// (2022-02-04 17:16:00) Equalized intervals over series \u201Cfa#,reb,lab\u201D approx fraction 3/2 adjusted 10.6 cents to ratio = 1.509 (2022-02-04
// 17:20:39)
temperament bp3_rameau_en_sib(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.054, 1.118, 1.193, 1.25, 1.337, 1.397, 1.495, 1.591, 1.672, 1.789, 1.869),
  comma:81/80
)

// @description This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018dhak\u2019 to \u2018sa\u2019. Created 2020-12-17 17:19:51
temperament bp3_Dha1_murcchana(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 15/8),
  comma:81/80
)

// @description This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018dha\u2019 to \u2018sa\u2019. Created 2020-12-17 17:55:10
temperament bp3_Dha3_murcchana(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 4/3, 64/45, 3/2, 8/5, 27/16, 16/9, 243/128),
  comma:81/80
)

// @description This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018gak\u2019 to \u2018sa\u2019. Created 2020-12-17 17:13:32
temperament bp3_Ga1_murcchana(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 15/8),
  comma:81/80
)

// @description This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018ga\u2019 to \u2018sa\u2019. Created 2020-12-17 17:52:29
temperament bp3_Ga3_murcchana(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 32/27, 81/64, 4/3, 64/45, 3/2, 8/5, 27/16, 16/9, 243/128),
  comma:81/80
)

// @description This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018ma\u2019 to \u2018sa\u2019. Created 2020-12-17 16:59:54
temperament bp3_Ma1_murcchana(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 10/9, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

// @description This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018ma#\u2019 to \u2018sa\u2019. Created 2020-12-17 19:45:32
temperament bp3_Ma3_murcchana(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 64/45, 3/2, 128/81, 27/16, 16/9, 243/128),
  comma:81/80
)

// @description This is a derivation of scale "Ma01" (23 grades) in \u2018-cs.raga\u2019 Created 2020-12-07 09:27:54
temperament bp3_Ma_grama_full(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    4/3,
    27/20,
    45/32,
    64/45,
    40/27,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128
  ),
  comma:81/80
)

// @description This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018nik\u2019 to \u2018sa\u2019. Created 2020-12-17 17:09:41
temperament bp3_Ni1_murcchana(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

// @description This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018ni\u2019 to \u2018sa\u2019. Created 2020-12-17 17:43:30
temperament bp3_Ni3_murcchana(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 32/27, 81/64, 4/3, 64/45, 3/2, 128/81, 27/16, 16/9, 243/128),
  comma:81/80
)

// @description This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018pa\u2019 to \u2018sa\u2019. Created 2020-12-17 18:03:15
temperament bp3_Pa3_murcchana(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 27/20, 64/45, 3/2, 8/5, 27/16, 9/5, 243/128),
  comma:81/80
)

// @description This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018rek\u2019 to \u2018sa\u2019. Created 2020-12-17 17:27:47
temperament bp3_Re1_murcchana(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 243/128),
  comma:81/80
)

// @description This is a transposition of scale "Sa_murcchana" (12 grades). From \u2018re\u2019 to \u2018sa\u2019. Created 2020-12-17 18:00:02
temperament bp3_Re3_murcchana(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 4/3, 64/45, 3/2, 8/5, 27/16, 9/5, 243/128),
  comma:81/80
)

// @description This is a reduction to 12 grades of scale "Ma_grama_full" (23 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 15:44:19
temperament bp3_Sa_murcchana(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 10/9, 32/27, 5/4, 4/3, 45/32, 40/27, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Dha3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:57:24
temperament bp3_asavari1(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 8/5, 16/9),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Re3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:01:33
temperament bp3_asavari2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 8/5, 9/5),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Pa3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:04:25
temperament bp3_asavari3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 6/5, 27/20, 3/2, 8/5, 9/5),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Sa_murcchana" (12 grades) in \u2018-cs.raga\u2019 Created 2020-12-17 18:45:55
temperament bp3_bad-scale(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 10/9, 32/27, 4/3, 40/27, 5/3, 15/8),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ma3_murcchana" (12 grades) in \u2018-cs.raga\u2019 Created 2020-12-17 19:50:06
temperament bp3_bhairao1(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 81/64, 4/3, 3/2, 128/81, 243/128),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ni3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:51:30
temperament bp3_bhairao2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 16/15, 81/64, 4/3, 3/2, 128/81, 243/128),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ni3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:48:21
temperament bp3_bhairavi1(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 16/15, 32/27, 4/3, 3/2, 128/81, 16/9),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ga3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:54:29
temperament bp3_bhairavi2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 16/15, 32/27, 4/3, 3/2, 8/5, 16/9),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Dha3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:59:10
temperament bp3_bhairavi3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 16/15, 6/5, 4/3, 3/2, 8/5, 16/9),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Re3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:00:44
temperament bp3_bhairavi4(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 16/15, 6/5, 4/3, 3/2, 8/5, 9/5),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Sa_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 15:49:41
temperament bp3_bilaval1(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 10/9, 5/4, 4/3, 40/27, 5/3, 15/8),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ma_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:02:10
temperament bp3_bilaval2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 10/9, 5/4, 4/3, 3/2, 5/3, 15/8),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ni_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:10:33
temperament bp3_bilaval3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ma_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:07:12
temperament bp3_kalyan1(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 10/9, 5/4, 45/32, 3/2, 5/3, 15/8),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ni_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:11:52
temperament bp3_kalyan2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 5/4, 45/32, 3/2, 5/3, 15/8),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ga_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:14:50
temperament bp3_kalyan3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 5/4, 45/32, 3/2, 27/16, 15/8),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Sa_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 15:46:42
temperament bp3_kaphi1(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 10/9, 32/27, 4/3, 40/27, 5/3, 16/9),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Re3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:02:27
temperament bp3_kaphi2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 27/16, 9/5),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Pa3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:05:03
temperament bp3_kaphi3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 6/5, 27/20, 3/2, 27/16, 9/5),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Sa_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 15:48:50
temperament bp3_khamaj1(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 10/9, 5/4, 4/3, 40/27, 5/3, 16/9),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ma_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:04:13
temperament bp3_khamaj2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 10/9, 5/4, 4/3, 3/2, 5/3, 16/9),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Pa3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:06:06
temperament bp3_khamaj3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 81/64, 27/20, 3/2, 27/16, 9/5),
  comma:81/80
)

// @description This is a reduction to 8 grades of scale "Ma3_murcchana" (12 grades) in \u2018-cs.raga\u2019 Created 2020-12-19 14:23:28
temperament bp3_lalit1(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:8,
  ratios(1, 256/243, 81/64, 4/3, 64/45, 3/2, 128/81, 243/128),
  comma:81/80
)

// @description This is a reduction to 8 grades of scale "Ni3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:50:24
temperament bp3_lalit2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:8,
  ratios(1, 16/15, 81/64, 4/3, 64/45, 3/2, 128/81, 243/128),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ni_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:12:34
temperament bp3_marva1(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 5/4, 45/32, 3/2, 5/3, 15/8),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ga_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:17:10
temperament bp3_marva2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 5/4, 45/32, 3/2, 27/16, 15/8),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Dha_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:24:35
temperament bp3_marva3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 81/64, 45/32, 3/2, 27/16, 15/8),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ga_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:18:42
temperament bp3_purvi1(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 5/4, 45/32, 3/2, 128/81, 15/8),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Dha_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:26:08
temperament bp3_purvi2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 81/64, 45/32, 3/2, 128/81, 15/8),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Re_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:06
temperament bp3_purvi3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 81/64, 45/32, 3/2, 128/81, 243/128),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Dha_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:26:59
temperament bp3_todi1(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 32/27, 45/32, 3/2, 128/81, 15/8),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Re_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38
temperament bp3_todi2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 32/27, 45/32, 3/2, 128/81, 243/128),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ma3_murcchana" (12 grades) in \u2018-cs.raga\u2019 Created 2020-12-17 19:47:44
temperament bp3_todi3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 32/27, 64/45, 3/2, 128/81, 243/128),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Ga3_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:53:30
temperament bp3_todi4(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 16/15, 32/27, 64/45, 3/2, 8/5, 243/128),
  comma:81/80
)

// @description This is a reduction to 7 grades of scale "Re_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38
temperament bp3_todi_aak_2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:2,
  ratios(1, 3/2)
)

// @description This is a reduction to 7 grades of scale "Re_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38
temperament bp3_todi_aak_3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:2,
  ratios(1, 3/2)
)

// @description This is a reduction to 7 grades of scale "Re_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38
temperament bp3_todi_ka_3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:3,
  ratios(1, 3/2, 243/128)
)

// @description This is a reduction to 7 grades of scale "Re_murcchana" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38
temperament bp3_todi_ka_4(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:4,
  ratios(1, 3/2, 128/81, 243/128)
)

// @description Bohlen-Pierce scale "just intonation" https://midi.org/microtuning-and-alternative-intonation-systems
// https://en.wikipedia.org/wiki/Bohlen-Pierce_scale Created 2024-10-03 12:33:18
temperament bp3_Bohlen-Pierce(
  source:"Bernard Bel / Bol Processor",
  period_ratio:3,
  divisions:13,
  ratios(1, 27/25, 25/21, 9/7, 7/5, 75/49, 5/3, 9/5, 49/25, 15/7, 7/3, 63/25, 25/9),
  comma:81/80
)

// @description This is a new scale for BP3. Creation 2020-11-17 22:55:31 This scale has been imported from a SCALA file. Created 2024-08-22
// 07:14:33
temperament bp3_meantone_try(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2.022,
  divisions:12,
  ratios(1, 1.066, 1.125, 1.199, 1.265, 1.349, 1.422, 1.5, 1.599, 1.687, 1.799, 1.896),
  comma:81/80
)

// @description This is a new scale for BP3. Creation 2020-11-17 22:55:31 Same as meantone_try except that the base key is #64. Created
// 2024-08-22 07:14:33
temperament bp3_meantone_try2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2.022,
  divisions:12,
  ratios(1, 1.066, 1.125, 1.199, 1.265, 1.349, 1.422, 1.5, 1.599, 1.687, 1.799, 1.896),
  comma:81/80
)

// @description Goya-17 plus 484, 676, and 1180 cents This scale has been imported from a SCALA file. Created 2024-08-22 07:41:27
temperament bp3_zest24-supergoya17plus3_Db(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:20,
  ratios(
    1,
    1.03,
    1.104,
    1.133,
    1.167,
    1.233,
    1.285,
    1.323,
    1.338,
    1.377,
    1.435,
    1.478,
    1.505,
    1.55,
    1.65,
    1.707,
    1.757,
    1.844,
    1.92,
    1.977
  ),
  comma:81/80
)

// @description Quarter-comma meantone (Pietro Aron, 1523): the fifth is narrowed by a quarter of a syntonic comma, the major third 5/4 and
// the minor sixth 8/5 are pure. Twelve degrees on the table C Db D Eb E F Gb G Ab A Bb B.
temperament bp3_meantone1(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(
    1,
    1.069984,
    1.118034,
    1.196279,
    1.25,
    1.337481,
    1.431084,
    1.495349,
    1.6,
    1.671851,
    1.788854,
    1.869186
  )
)

// @description Kellner's BACH temperament (Asselin 2000 p.101) Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/5
// comma (2021-01-15 16:10:04) Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-15 16:11:48) Created meantone
// upward notes \u201Cmi,si\u201D fraction 3/2 (2021-01-15 16:13:36)
temperament bp3_BACH(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.119, 1.185, 1.253, 1.333, 1.406, 1.496, 1.58, 1.675, 1.778, 1.88),
  comma:81/80
)

// @description A traditional scale constructed with simple integer ratios
temperament bp3_Zarlino_natural(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 5/4, 4/3, 64/45, 3/2, 8/5, 5/3, 16/9, 15/8)
)

// @description Barca temperament (Asselin 2000 p.106) Created 2021-01-16 17:56:02 Added fifths down: \u201Cdo,fa,sib\u201D starting fraction 1/1
// (2021-01-16 17:57:57) Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#\u201D fraction 3/2 adjusted -1/6 comma (2021-01-16 18:02:25)
// Created meantone upward notes \u201Cfa#,do#,sol#,re#\u201D fraction 3/2 (2021-01-16 18:03:49)
temperament bp3_barca(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.055, 1.12, 1.186, 1.255, 1.333, 1.406, 1.497, 1.582, 1.677, 1.778, 1.879),
  comma:81/80
)

// @description B\xE9thisy temperament (Asselin 2000 p.121) Created 2021-01-16 19:21:57 Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D
// fraction 3/2 adjusted -1/4 comma (2021-01-16 19:23:36) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted 1/12 comma
// (2021-01-16 19:25:49) Created meantone downward notes \u201Cmib,sol#\u201D fraction 3/2 (2021-01-16 19:26:26) Equalized intervals over series
// \u201Cmi,si,fa#,do#,sol#\u201D approx fraction 3/2 adjusted -1.7 cents to ratio = 1.499 (2021-01-16 19:28:09)
temperament bp3_bethisy(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.052, 1.118, 1.182, 1.25, 1.332, 1.404, 1.495, 1.576, 1.672, 1.774, 1.873),
  comma:81/80
)

// @description Chaumont temperament (Asselin 2000 p.109) Created 2021-01-16 18:06:34 Created meantone upward notes
// \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:08:41) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D
// fraction 3/2 adjusted -1/4 comma (2021-01-16 18:09:41)
temperament bp3_chaumont(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.196, 1.25, 1.337, 1.398, 1.495, 1.563, 1.672, 1.789, 1.869),
  comma:81/80
)

// @description Classic temperament (Asselin 2000 p.76) Equivalent to Chaumont (p.109) Created 2021-01-14 15:38:08 Created meantone upward
// notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-14 15:40:20) Created meantone downward notes
// \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/4 comma (2021-01-14 15:40:57)
temperament bp3_classic(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.196, 1.25, 1.337, 1.398, 1.495, 1.563, 1.672, 1.789, 1.869),
  comma:81/80
)

// @description Corrette temperament (Asselin 2000 p.111) Created 2021-01-16 18:13:10 Created meantone upward notes
// \u201Cfa,do,sol,re,la,mi,si,fa#,do#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:16:40) Created meantone downward notes \u201Cfa,sib,mib\u201D
// fraction 3/2 adjusted 1/12 comma (2021-01-16 18:34:13) Created meantone upward notes \u201Cdo#,sol#\u201D fraction 3/2 adjusted 1/12 comma
// (2021-01-16 18:38:14) Base note reset to \u2018do\u2019 (2021-01-16 18:40:53)
temperament bp3_corrette(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.187, 1.25, 1.338, 1.398, 1.496, 1.569, 1.672, 1.782, 1.87),
  comma:81/80
)

// @description D'Alembert-Rousseau temperament (Asselin 2000 p.119) Created 2021-01-16 19:04:44 Created meantone upward notes
// \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:12:08) Created meantone downward notes \u201Cdo,fa,sib,mib,sol#\u201D fraction
// 3/2 adjusted 1/12 comma (2021-01-16 19:17:25) Equalized intervals over series \u201Csol#,do#,fa#,si,mi\u201D approx fraction 2/3 adjusted 2.2 cents
// to ratio = 0.668 (2021-01-16 19:19:34)
temperament bp3_d_alembert_rousseau(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.051, 1.118, 1.182, 1.25, 1.332, 1.403, 1.495, 1.574, 1.672, 1.774, 1.873),
  comma:81/80
)

// @description This is an equal-tempered scale for BP3 + Csound. Created 2021-02-13 19:09:08
temperament bp3_equal_tempered(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.059, 1.122, 1.189, 1.26, 1.335, 1.414, 1.498, 1.587, 1.682, 1.782, 1.888),
  comma:81/80
)

// @description Kirnberger II temperament (Asselin 2000 p. 90) Created 2021-01-16 11:52:39 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb\u201D
// starting fraction 1/1 (2021-01-16 11:54:59) Added fifths up: \u201Cdo,sol,re\u201D starting fraction 1/1 (2021-01-16 11:55:59) Created meantone
// upward notes \u201Cre,la,mi\u201D fraction 3/2 adjusted -1/2 comma (2021-01-16 11:57:13) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2
// (2021-01-16 11:58:24)
temperament bp3_kirnberger_2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.125, 1.185, 1.25, 1.333, 1.406, 1.5, 1.58, 1.677, 1.778, 1.875),
  comma:81/80
)

// @description Kirnberger III temperament (Asselin 2000 p.93) Created 2021-01-16 12:02:11 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb\u201D
// starting fraction 1/1 (2021-01-16 12:03:52) Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16
// 12:05:20) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 12:06:10)
temperament bp3_kirnberger_3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.118, 1.185, 1.25, 1.333, 1.406, 1.495, 1.58, 1.672, 1.778, 1.875),
  comma:81/80
)

// @description Marpourg temperament (Asselin 2000 p.117) Created 2021-01-16 18:58:49 Created meantone upward notes
// \u201Cfa,do,sol,re,la,mi,si,fa#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:00:42) Equalized intervals over series
// \u201Cfa,la#,re#,sol#,do#,fa#\u201D approx fraction 2/3 adjusted -2.8 cents to ratio = 0.666 (2021-01-16 19:02:32) Base note reset to \u2018do\u2019
// (2021-01-16 19:03:15)
temperament bp3_marpourg(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.05, 1.118, 1.185, 1.25, 1.338, 1.398, 1.496, 1.577, 1.672, 1.781, 1.87),
  comma:81/80
)

// @description Pure minor-thirds temperament (Asselin 2000 p.82) Created 2021-01-15 15:13:09 Created meantone upward notes
// \u201Cmib,sib,fa,do,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-15 15:15:22) Base note reset to \u2018do\u2019 (2021-01-15
// 15:16:00)
temperament bp3_pure_minor-thirds(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.037, 1.116, 1.2, 1.244, 1.339, 1.388, 1.494, 1.549, 1.666, 1.792, 1.86),
  comma:81/80
)

// @description Rameau meantone in C temperament (Asselin 2000 p.113) Created 2021-01-16 18:41:56 Created meantone upward notes
// \u201Cdo,sol,re,la,mi,si,fa#,do#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:44:03) Added fifths down: \u201Cdo,fa\u201D starting fraction 1/1
// (2021-01-16 18:49:25) Created meantone upward notes \u201Cdo#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2022-02-04 18:09:16) Created meantone
// downward notes \u201Cfa,la#\u201D fraction 3/2 (2021-01-16 18:54:20) Equalized intervals over series \u201Csol#,re#,la#\u201D approx fraction 3/2 adjusted
// 9.1 cents to ratio = 1.508 (2022-02-04 18:10:27)
temperament bp3_rameau_en_do(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.178, 1.25, 1.333, 1.398, 1.495, 1.563, 1.672, 1.777, 1.869),
  comma:81/80
)

// @description Sauveur temperament (Asselin 2000 p. 81) Created 2021-01-16 10:37:52 Created meantone downward notes \u201Cdo,fa,sib,mib\u201D
// fraction 3/2 adjusted -1/5 comma (2021-01-16 10:44:41) Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2
// adjusted -1/5 comma (2021-01-16 10:48:56)
temperament bp3_sauveur(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.049, 1.119, 1.194, 1.253, 1.337, 1.403, 1.496, 1.57, 1.675, 1.787, 1.875),
  comma:81/80
)

// @description Two series of perfect fifths including ascending major thirds (Asselin 2000 p.62) Created 2021-01-08 09:02:23
temperament bp3_scale_1(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:29,
  ratios(
    1,
    1.042,
    1.053,
    1.067,
    1.111,
    1.125,
    1.172,
    1.185,
    1.2,
    1.25,
    1.266,
    1.317,
    1.333,
    1.389,
    1.406,
    1.422,
    1.481,
    1.5,
    1.563,
    1.58,
    1.6,
    1.667,
    1.688,
    1.758,
    1.778,
    1.8,
    1.875,
    1.898,
    1.975
  )
)

// @description Schlick temperament (Asselin 2000 p.88) Created 2021-01-16 10:56:35 [INCORRECT] Created meantone downward notes
// \u201Cla,re,sol,do,fa\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 10:58:50) Created meantone upward notes \u201Cla,mi,si\u201D fraction 3/2 adjusted
// -1/4 comma (2021-01-16 10:59:48) Created meantone upward notes \u201Cla,do#\u201D fraction 5/4 (2021-01-16 11:04:11) Equalized intervals over
// series \u201Csi,fa#,do#\u201D approx fraction 3/2 adjusted -5.4 cents to ratio = 1.495 (2021-01-16 11:05:59) Created meantone downward notes
// \u201Csol,mib\u201D fraction 5/4 (2021-01-16 11:07:31) Equalized intervals over series \u201Cmib,sib,fa\u201D approx fraction 3/2 adjusted -5.3 cents to
// ratio = 1.495 (2021-01-16 11:08:47) Created meantone downward notes \u201Cdo,lab\u201D fraction 5/4 (2021-01-16 11:13:58) Created meantone upward
// notes \u201Cmi,sol#\u201D fraction 5/4 adjusted 2/3 comma (2021-01-16 11:23:39) [estimation] Base note reset to \u2018do\u2019 (2021-01-16 11:25:48)
temperament bp3_schlick_bad(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:13,
  ratios(1, 1.045, 1.118, 1.196, 1.25, 1.338, 1.398, 1.496, 1.575, 1.6, 1.672, 1.789, 1.87),
  comma:81/80
)

// @description Tartini-Vallotti temperament (Asselin 2000 p.104) Created 2021-01-16 17:45:36 Added fifths down:
// \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-16 17:47:11) Created meantone upward notes \u201Cdo,sol,re,la,mi,si\u201D fraction 3/2
// adjusted -1/6 comma (2021-01-16 17:48:49)
temperament bp3_tartini-vallotti(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.12, 1.185, 1.255, 1.333, 1.406, 1.497, 1.58, 1.677, 1.778, 1.879),
  comma:81/80
)

// @description Werckmeister III temperament (Asselin 2000 p.94) Created 2021-01-16 16:53:15 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D
// starting fraction 1/1 (2021-01-16 16:55:35) Created meantone upward notes \u201Cdo,sol,re,la\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16
// 16:57:00) Created meantone upward notes \u201Cla,mi,si\u201D fraction 3/2 (2021-01-16 16:58:34)
temperament bp3_werckmeister_3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.118, 1.185, 1.254, 1.333, 1.406, 1.495, 1.58, 1.672, 1.778, 1.881),
  comma:81/80
)

// @description Werckmeister IV temperament (Asselin 2000 p.96) Created 2021-01-16 17:02:48 Added fifths down: \u201Cdo,fa\u201D starting fraction 1/1
// (2021-01-16 17:07:10) Created meantone downward notes \u201Cfa,sib\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:08:04) Created meantone
// downward notes \u201Csib,mib,sol#\u201D fraction 3/2 adjusted 1/3 comma (2021-01-16 17:09:18) Created meantone downward notes \u201Csol#,do#\u201D fraction
// 3/2 (2021-01-16 17:11:01) Created meantone downward notes \u201Cdo#,fa#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:12:07) Created
// meantone downward notes \u201Cfa#,si\u201D fraction 3/2 (2021-01-16 17:13:21) Created meantone downward notes \u201Csi,mi\u201D fraction 3/2 adjusted -1/3
// comma (2021-01-16 17:14:45) Created meantone downward notes \u201Cmi,la\u201D fraction 3/2 (2021-01-16 17:16:07) Created meantone upward notes
// \u201Cdo,sol\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:17:11) Created meantone upward notes \u201Csol,re\u201D fraction 3/2 (2021-01-16 17:17:49)
temperament bp3_werckmeister_4(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.049, 1.121, 1.185, 1.253, 1.333, 1.404, 1.494, 1.574, 1.671, 1.785, 1.872),
  comma:81/80
)

// @description Werckmeister V temperament (Asselin 2000 p.99) Created 2021-01-16 17:29:54 Added fifths up: \u201Cdo,sol,re\u201D starting fraction
// 1/1 (2021-01-16 17:31:53) Created meantone upward notes \u201Cre,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:33:19) Created
// meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 17:34:05) Created meantone upward notes \u201Cfa#,do#,lab\u201D fraction 3/2 adjusted
// -1/4 comma (2021-01-16 17:35:20) Created meantone downward notes \u201Cdo,fa\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:36:08) Created
// meantone downward notes \u201Cfa,sib,mib\u201D fraction 3/2 (2021-01-16 17:37:05)
temperament bp3_werckmeister_5(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.058, 1.125, 1.188, 1.258, 1.337, 1.415, 1.5, 1.582, 1.682, 1.783, 1.887),
  comma:81/80
)

// @description Zarlino temperament (Asselin 2000 p.85) Created meantone upwards notes \u201Cdo, sol, re, la, mi, si, fa#, do#, sol#\u201D ratio 3/2
// -2/7 comma (2021-01-11 18:00:22) Created meantone downwards notes \u201Cdo, fa, sib, mib\u201D ratio 3/2 -2/7 comma (2021-01-11 18:05:45) Created
// meantone upwards notes \u201Cdo, sol\u201D ratio 3/2 -2/7 comma (2021-01-11 18:06:40)
temperament bp3_zarlino(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.042, 1.117, 1.198, 1.248, 1.338, 1.394, 1.495, 1.557, 1.67, 1.79, 1.865),
  comma:81/80
)

// @description Johnston final lattice for "The Un-tempered Pianos" and "K" This scale has been imported from a SCALA file. Created
// 2024-08-22 07:44:18
temperament bp3_johnston_unt3(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:25,
  ratios(
    1,
    1029/1024,
    33/32,
    35/32,
    36015/32768,
    147/128,
    2401/2048,
    19/16,
    5/4,
    5145/4096,
    21/16,
    343/256,
    11/8,
    735/512,
    12005/8192,
    3/2,
    49/32,
    49/32,
    13/8,
    105/64,
    1715/1024,
    7/4,
    7203/4096,
    15/8,
    245/128
  )
)

// @description Henri Arnaut De Zwolle's modified meantone tuning (c. 1440) This scale has been imported from a SCALA file. Created
// 2024-08-22 07:39:55
temperament bp3_zwolle2(
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:3,
  ratios(1, 5/4, 25/16),
  comma:81/80
)

// @description Native 22-shruti table from -to.tryShruti (BP3, 23 ratios over 23 degrees). Pythagorean convention at degree 12 (729/512).
// DISTINCT from bp3_grama (Arnold's scholarly edition by B. Bel, 64/45 at the same degree) \u2014 two valid systems, this one is the native
// engine's table.
temperament bp3_shruti23_native(
  source:bp3-engine/test-data/-to.tryShruti,
  period_ratio:2,
  divisions:23,
  ratios(
    1,
    256/243,
    16/15,
    10/9,
    9/8,
    32/27,
    6/5,
    5/4,
    81/64,
    4/3,
    27/20,
    45/32,
    729/512,
    3/2,
    128/81,
    8/5,
    5/3,
    27/16,
    16/9,
    9/5,
    15/8,
    243/128,
    48/25
  )
)
`, "fichier": "temperaments.bpsl" }, { "nom": "test_alphabets", "format": "bpsl", "texte": `types

def test_alphabets(resolvedBy:Kairos, resolves:alphabet)

// @description Single-character alphabet a-z (Bernard's -al.abc / -ho.abc)
alphabet abc(
  runtime:audio,
  resolvesPitch:false,
  alterations(),
  terminals(
    a(),
    b(),
    c(),
    d(),
    e(),
    f(),
    g(),
    h(),
    i(),
    j(),
    k(),
    l(),
    m(),
    n(),
    o(),
    p(),
    q(),
    r(),
    s(),
    t(),
    u(),
    v(),
    w(),
    x(),
    y(),
    z(),
    "a'"(),
    "b'"(),
    "c'"(),
    "d'"(),
    "e'"(),
    "f'"(),
    "g'"(),
    "h'"(),
    "i'"(),
    "j'"(),
    "k'"(),
    "l'"(),
    "m'"(),
    "n'"(),
    "o'"(),
    "p'"(),
    "q'"(),
    "r'"(),
    "s'"(),
    "t'"(),
    "u'"(),
    "v'"(),
    "w'"(),
    "x'"(),
    "y'"(),
    "z'"()
  )
)

// @description Single-character alphabet a-h (Bernard's -al.abc1 / -ho.abc1)
alphabet abc1(
  runtime:audio,
  resolvesPitch:false,
  alterations(),
  terminals(
    chik(),
    a(),
    "a'"(),
    b(),
    c(),
    "c'"(),
    d(),
    "d'"(),
    e(),
    f(),
    "f'"(),
    g(),
    "g'"(),
    h(),
    cycle1(),
    cycle2()
  )
)

// @description Conway look-and-say sequence digits
alphabet conway(
  runtime:audio,
  resolvesPitch:false,
  alterations(),
  terminals(d1(), d2(), d3())
)

// @description Kathak counting bols (ek-do-tin)
alphabet kathak_count(
  runtime:audio,
  resolvesPitch:false,
  alterations(),
  terminals(
    ek(),
    do(),
    tin(),
    char(),
    panch(),
    che(),
    sat(),
    at(),
    nau(),
    das(),
    gyara(),
    bara(),
    tera(),
    chauda(),
    pandra(),
    sola()
  )
)

// @description Opaque structural symbols for grammar tests (no pitch, no sound)
alphabet structural(
  runtime:audio,
  resolvesPitch:false,
  alterations(),
  terminals(
    A(),
    A1(),
    A2(),
    A3(),
    B(),
    C(),
    D(),
    E(),
    F(),
    G(),
    H(),
    I(),
    J(),
    K(),
    L(),
    M(),
    N(),
    S1(),
    S2(),
    T(),
    X(),
    Y(),
    Z()
  )
)

// @description The ten bols of the native alphabet \`-al.dhati\`, reproduced as they stand
alphabet dhati(
  runtime:audio,
  resolvesPitch:false,
  alterations(),
  terminals(dha(), dhee(), ge(), ke(), kt(), na(), ta(), tee(), ti(), tr())
)

// @description The seven terms of the native alphabet \`-al.checkhomo\`
alphabet checkhomo(
  runtime:audio,
  resolvesPitch:false,
  alterations(),
  terminals(a(), "a'"(), "a"""(), b(), "b'"(), c(), "c'"())
)

// @description The fourteen bols of the native alphabet \`-al.dhin--\`
alphabet dhin(
  runtime:audio,
  resolvesPitch:false,
  alterations(),
  terminals(dha(), ta(), ti(), ra(), na(), ki(), dhee(), tee(), ne(), ge(), ke(), ka(), dhin(), tin())
)
`, "fichier": "test_alphabets.bpsl" }, { "nom": "time", "format": "bpsl", "texte": `types

// @documented
// @description Time that ELAPSES \u2014 the scene's metronome. HEADER library, resolved by KRONOS.
def time(
  resolvedBy:Kronos,
  resolves:time,
  name:time,
  version:"1.0.0",
  section:subgrammar
)

// @description Absolute metronome of the scene or subgrammar, in BPM.
def tempo(
  bp3:_mm,
  args("bpm"),
  unit:bpm,
  scope("subgrammar", "scene"),
  unicite:metronome
)

// @description Clock catch-up delay when resuming after a wait point, in MILLISECONDS. Image of MIDIsyncDelay in the native engine.
control syncdelay(
  section:controls,
  bp3:MIDIsyncDelay,
  args("duration"),
  unit:ms,
  scope("scene")
)
`, "fichier": "time.bpsl" }, { "nom": "transpo/chromashift", "format": "bpsl", "texte": "// @description Chromatic transposition on the 12-key grid \u2014 shift N chromatic keys (semitones), rename to target key + its tuning. Image of\n// BP3 _transpose. Shifts CHROMATIC keys; scaleshift shifts diatonic degrees, transpose preserves note names.\ncontrol chromashift(\n  bp3:_transpose,\n  args(keys),\n  value:0,\n  scope(symbol, group, rule, flow, scene),\n  rank:10,\n  params(\n    // @description Number of chromatic keys (semitones) of shift on the 12-grid (may be negative; wraps at the octave).\n    n(\n      from:value,\n      coerce:raw,\n      default:0\n    )\n  )\n) ``ts:\n// Corps de la MANIPULATION `chromashift` \u2014 AUTHORING F1 (vrai .ts TYP\xC9 contre le SDK Kairos).\n// Source de v\xE9rit\xE9 : ce fichier. Le chargeur le greffe sur le CONTR\xD4LE `chromashift` de `transpo`, qui\n// porte le mot \u2014 arbitrage de Romain, 2026-09-03 : le corps se rattache \xE0 l'objet qui le nomme.\n// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis ex\xE9cute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.\n// \u26A0\uFE0F TRANSPOSITION CHROMATIQUE (grille 12 cl\xE9s) : image de BP3 _transpose (d\xE9cision Romain\n//    2026-07-17, hub/decisions/2026-07-17-bp3-transpose-est-scaleshift-sur-grille-12-cles.md).\n//    D\xE9cale le pas ABSOLU de N cl\xE9s chromatiques (N demi-tons) ; Kairos renomme vers la cl\xE9 cible\n//    et prend SON tuning (transposeToken). DISTINCT de `scaleshift` (diatonique, N degr\xE9s d'alphabet)\n//    et de `transpose` (r\xE9el, frameRatio, nom PR\xC9SERV\xC9). Trois gestes nets (Romain, option B).\nimport type { DigitalFn } from '@kairos/core';\n\n/** chromashift \u2014 transposition sur la GRILLE 12 CL\xC9S chromatiques : d\xE9cale le pas absolu de N\n *  positions (N demi-tons). `ctx.target.pitch.step` = pas ABSOLU sur la grille du temp\xE9rament\n *  (confirm\xE9 Kairos [504] : degr\xE9 + alt\xE9ration + registre\xB7divisions). Kairos re-projette le delta\n *  de step \u2192 renomme chromatiquement + retune sur la cl\xE9 d'arriv\xE9e. = BP3 _transpose(N)\n *  (Zouleb.c:555-574, key += Round(trans/100)). PORTER\u2260R\xC9SOUDRE : je d\xE9cale le pas, je ne r\xE9sous rien. */\nconst chromashift: DigitalFn = (ctx) => {\n  const p = ctx.target.pitch;\n  if (!p) return;\n  p.step += Number(ctx.params.n ?? 0);\n};\n\nexport default chromashift;\n``\n", "fichier": "transpo/chromashift.bpsl" }, { "nom": "transpo/keyxpand", "format": "bpsl", "texte": "// @description Interval expansion/contraction around a pivot. factor=2 doubles, factor=-1 inverts, factor=0.5 contracts.\ncontrol keyxpand(\n  bp3:_keyxpand,\n  args(pivot, factor),\n  value(pivot:0, factor:1),\n  scope(symbol, group, rule, flow),\n  rank:20,\n  params(\n    // @description Pivot: note token resolved into grid steps by Kairos's token-step coercion (cries if unresolvable); stays fixed.\n    pivotStep(\n      from:pivot,\n      coerce:token-step,\n      default:0\n    ),\n    // @description Scale factor of the distance to the pivot (1 = identity, 2 = doubled, 0.5 = folded; may be negative = mirror).\n    factor(\n      from:factor,\n      coerce:raw,\n      default:1\n    )\n  )\n) ``ts:\n// Corps de la MANIPULATION `keyxpand` \u2014 AUTHORING F1 (vrai .ts TYP\xC9 contre le SDK Kairos).\n// Source de v\xE9rit\xE9 : ce fichier. Le chargeur le greffe sur le CONTR\xD4LE `keyxpand` de `transpo`, qui\n// porte le mot \u2014 arbitrage de Romain, 2026-09-03 : le corps se rattache \xE0 l'objet qui le nomme.\n// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis ex\xE9cute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.\nimport type { DigitalFn } from '@kairos/core';\n\n/** keyxpand \u2014 dilate/contracte l'\xE9cart au pivot d'un facteur (le pivot reste fixe). facteur 1 = identit\xE9,\n *  2 = intervalles doubl\xE9s, 0,5 = repli\xE9s de moiti\xE9. R\xE9sultat arrondi au pas de grille le plus proche.\n *  Kairos pr\xE9-r\xE9sout le token pivot en `pivotStep` et passe `{pivotStep, factor}`. */\nconst keyxpand: DigitalFn = (ctx) => {\n  // Mutation de la COPIE (ctx.target) ; Kairos d\xE9rive le Hz APR\xC8S (delta net). `step` = axe de grille absolu.\n  if (ctx.target.pitch) {\n    const pivotStep = Number(ctx.params.pivotStep ?? 0);\n    const factor = Number(ctx.params.factor ?? 1);\n    ctx.target.pitch.step = pivotStep + Math.round((ctx.target.pitch.step - pivotStep) * factor);\n  }\n};\n\nexport default keyxpand;\n``\n", "fichier": "transpo/keyxpand.bpsl" }, { "nom": "transpo/scaleshift", "format": "bpsl", "texte": "// @description Scalar (diatonic) transposition \u2014 shift N degrees in the alphabet. (scaleshift:2): Sa->Ga, etc. Preserves degrees, not\n// intervals (in unequal scales). Acts on PITCH; the ![rotate] STRUCTURE control rotates a sequence.\ncontrol scaleshift(\n  args(degrees),\n  value:0,\n  scope(symbol, group, rule, flow),\n  rank:10,\n  params(\n    // @description Number of degrees of shift in the alphabet (may be negative; register carry at the bounds).\n    n(\n      from:value,\n      coerce:raw,\n      default:0\n    )\n  )\n) ``ts:\n// Corps de la MANIPULATION `scaleshift` \u2014 AUTHORING F1 (vrai .ts TYP\xC9 contre le SDK Kairos).\n// Source de v\xE9rit\xE9 : ce fichier. Le chargeur le greffe sur le CONTR\xD4LE `scaleshift` de `transpo`, qui\n// porte le mot \u2014 arbitrage de Romain, 2026-09-03 : le corps se rattache \xE0 l'objet qui le nomme.\n// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis ex\xE9cute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.\n// \u26A0\uFE0F TRANSPOSITION SCALAIRE (diatonique) : d\xE9calage de N DEGR\xC9S d'alphabet (Sa +2 \u2192 Ga), report de\n//    registre aux bornes. Anciennement `rotate` de HAUTEUR \u2014 renomm\xE9 (d\xE9cision 2026-07-11 : deux\n//    transpositions nomm\xE9es, r\xE9elle vs scalaire). RIEN \xC0 VOIR avec le ![rotate] de STRUCTURE\n//    (RotateSequence, rotation de s\xE9quence, moteur BPx), qui garde son nom.\nimport type { DigitalFn } from '@kairos/core';\n\n/** scaleshift \u2014 transposition scalaire : d\xE9cale de N degr\xE9s dans l'alphabet (Sa +2 \u2192 Ga). Recouvre le\n *  degr\xE9 depuis le pas via `models.alphabet.degrees`, tourne l'index (mod taille alphabet, avec report\n *  de registre), recompose. Pr\xE9serve les DEGR\xC9S, pas les intervalles (en gamme in\xE9gale). */\nconst scaleshift: DigitalFn = (ctx) => {\n  const p = ctx.target.pitch;\n  if (!p) return;\n  const degs = ctx.models.alphabet.degrees;   // pas de grille de chaque degr\xE9, ordonn\xE9 (ex. 12-TET [0,2,4,5,7,9,11])\n  const div = ctx.models.temperament.divisions;\n  const n = Number(ctx.params.n ?? 0);\n  const reg = Math.floor(p.step / div);\n  const inOct = ((p.step % div) + div) % div;\n  const idx = degs.indexOf(inOct);\n  if (idx < 0) return;                          // pas hors alphabet : identit\xE9 (best-effort)\n  const len = degs.length, raw = idx + n;\n  const ni = ((raw % len) + len) % len;\n  p.step = degs[ni] + (reg + Math.floor(raw / len)) * div;\n};\n\nexport default scaleshift;\n``\n", "fichier": "transpo/scaleshift.bpsl" }, { "nom": "transpo/transpose", "format": "bpsl", "texte": "// @description Real (chromatic) transposition \u2014 shift the alphabet anchor by a fixed interval (fraction 3/2, cents 700c, decimal 1.5).\n// Preserves intervals AND note names; works in any tuning. A bare integer is a ratio N:1 (N-th harmonic): 2/4/8 = octaves; for semitones\n// use cents (12 semitones = 1200c). The old grid-step regime is removed.\ncontrol transpose(\n  args(interval),\n  argType:interval,\n  scope(symbol, group, rule, flow, scene),\n  rank:30,\n  params(\n    // @description Interval normalized into a ratio by Kairos from the 3-format string. A NUMERIC transpose cries here (migration cry: the\n    // old grid-step regime is removed).\n    ratio(\n      from:value,\n      coerce:interval-ratio\n    ),\n    // @description The raw interval string (diagnostic); the body does not parse it.\n    interval(\n      from:value,\n      coerce:raw\n    )\n  )\n) ``ts:\n// Corps de la MANIPULATION `transpose` \u2014 AUTHORING F1 (vrai .ts TYP\xC9 contre le SDK Kairos).\n// Source de v\xE9rit\xE9 : ce fichier. Le chargeur le greffe sur le CONTR\xD4LE `transpose` de `transpo`, qui\n// porte le mot \u2014 arbitrage de Romain, 2026-09-03 : le corps se rattache \xE0 l'objet qui le nomme.\n// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis ex\xE9cute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.\n// \u26A0\uFE0F TRANSPOSITION R\xC9ELLE (chromatique) : d\xE9calage de l'ANCRE par un INTERVALLE fixe. Pr\xE9serve les\n//    intervalles ET le nom de chaque note (on d\xE9place le cadre, pas les notes contre un cadre fig\xE9).\n//    Marche dans TOUT accordage (\xE9gal ET in\xE9gal), et m\xEAme en temp\xE9rament param\xE9trique (sans grille).\n//    D\xE9cision 2026-07-11 : deux transpositions nomm\xE9es, r\xE9elle (ici) vs scalaire (scaleshift).\nimport type { DigitalFn } from '@kairos/core';\n\n/** transpose \u2014 transposition r\xE9elle : multiplie le facteur de cadre `frameRatio` par l'intervalle.\n *  `ctx.params.ratio` = intervalle D\xC9J\xC0 NORMALIS\xC9 par Kairos (fraction 3/2 | cents 700c | d\xE9cimal 1.5) ;\n *  `ctx.params.interval` = la cha\xEEne brute (diagnostic). Kairos SEUL applique `hz \xD7 frameRatio` en fin de\n *  r\xE9solution, APR\xC8S les ops de grille \u2014 noms/registres pr\xE9serv\xE9s par construction. Je ne parse RIEN. */\nconst transpose: DigitalFn = (ctx) => {\n  if (ctx.target.pitch) {\n    ctx.target.pitch.frameRatio = (ctx.target.pitch.frameRatio ?? 1) * Number(ctx.params.ratio);\n  }\n};\n\nexport default transpose;\n``\n", "fichier": "transpo/transpose.bpsl" }, { "nom": "transpo", "format": "bpsl", "texte": `transpo/transpose
transpo/chromashift
transpo/scaleshift
transpo/keyxpand
types

// @documented
// @description Pitch transformations resolved by Kairos.
def transpo(
  resolves:transpo,
  resolvedBy:"Kairos",
  name:transpo,
  section:controls
)

// @description Real (chromatic) transposition \u2014 shift the alphabet anchor by a fixed interval (fraction 3/2, cents 700c, decimal 1.5).
// Preserves intervals AND note names; works in any tuning. A bare integer is a ratio N:1 (N-th harmonic): 2/4/8 = octaves; for semitones
// use cents (12 semitones = 1200c). The old grid-step regime is removed.
control transpose(
  args(interval),
  argType:interval,
  scope(symbol, group, rule, flow, scene),
  rank:30,
  params(
    // @description Interval normalized into a ratio by Kairos from the 3-format string. A NUMERIC transpose cries here (migration cry: the
    // old grid-step regime is removed).
    ratio(
      from:value,
      coerce:interval-ratio
    ),
    // @description The raw interval string (diagnostic); the body does not parse it.
    interval(
      from:value,
      coerce:raw
    )
  )
)

// @description Microtonal scale \u2014 name + base note. (scale:0 0) returns to equal temperament. The name and the base note are TWO values,
// separated by a comma in the declarative part and by a space in the flow.
control scale(
  bp3:_scale,
  args(name, blockkey),
  value(name:0, blockkey:0),
  scope(symbol, group, rule, flow)
)

// @description Scalar (diatonic) transposition \u2014 shift N degrees in the alphabet. (scaleshift:2): Sa->Ga, etc. Preserves degrees, not
// intervals (in unequal scales). Acts on PITCH; the ![rotate] STRUCTURE control rotates a sequence.
control scaleshift(
  args(degrees),
  value:0,
  scope(symbol, group, rule, flow),
  rank:10,
  params(
    // @description Number of degrees of shift in the alphabet (may be negative; register carry at the bounds).
    n(
      from:value,
      coerce:raw,
      default:0
    )
  )
)

// @description Chromatic transposition on the 12-key grid \u2014 shift N chromatic keys (semitones), rename to target key + its tuning. Image of
// BP3 _transpose. Shifts CHROMATIC keys; scaleshift shifts diatonic degrees, transpose preserves note names.
control chromashift(
  bp3:_transpose,
  args(keys),
  value:0,
  scope(symbol, group, rule, flow, scene),
  rank:10,
  params(
    // @description Number of chromatic keys (semitones) of shift on the 12-grid (may be negative; wraps at the octave).
    n(
      from:value,
      coerce:raw,
      default:0
    )
  )
)

// @description Interval expansion/contraction around a pivot. factor=2 doubles, factor=-1 inverts, factor=0.5 contracts.
control keyxpand(
  bp3:_keyxpand,
  args(pivot, factor),
  value(pivot:0, factor:1),
  scope(symbol, group, rule, flow),
  rank:20,
  params(
    // @description Pivot: note token resolved into grid steps by Kairos's token-step coercion (cries if unresolvable); stays fixed.
    pivotStep(
      from:pivot,
      coerce:token-step,
      default:0
    ),
    // @description Scale factor of the distance to the pivot (1 = identity, 2 = doubled, 0.5 = folded; may be negative = mirror).
    factor(
      from:factor,
      coerce:raw,
      default:1
    )
  )
)

// @description Transposition in CONTINUOUS mode \u2014 the value glides DURING notes. Its two discrete siblings, transposefixed and
// transposestep, live in the variation library. It names its own resolver, the one that realizes its parameter. On the native engine,
// continuous transposition yields bytes identical to steps.
control transposecont(
  bp3:_transposecont,
  resolvedBy:"toutes les sorties",
  scope(symbol, group, rule, flow)
)
`, "fichier": "transpo.bpsl" }, { "nom": "tunings", "format": "bpsl", "texte": "types\n\n// @documented\ndef tunings(resolvedBy:Kairos, resolves:tuning)\n\n// @description Standard Western equal temperament\ntuning western_12TET(\n  alphabet:western,\n  temperament:12TET,\n  degrees(0, 2, 4, 5, 7, 9, 11)\n)\n\n// @description Western in Pythagorean tuning \u2014 pure fifths\ntuning western_pythagorean(\n  alphabet:western,\n  temperament:pythagorean,\n  degrees(0, 2, 4, 5, 7, 9, 11)\n)\n\n// @description Western in 5-limit just intonation\ntuning western_just(\n  alphabet:western,\n  temperament:just_5limit,\n  degrees(0, 2, 4, 5, 7, 9, 11)\n)\n\n// @description Western in 1/4-comma meantone\ntuning western_meantone(\n  alphabet:western,\n  temperament:meantone_quarter,\n  degrees(0, 2, 4, 5, 7, 9, 11)\n)\n\n// @description Indian sargam in 12-TET (simplified, equal temperament)\ntuning sargam_12TET(\n  alphabet:sargam,\n  temperament:12TET,\n  degrees(0, 2, 4, 5, 7, 9, 11)\n)\n\n// @description INDIAN note convention of the native BP3 engine, in 12-TET\ntuning bp3_indian_12TET(\n  alphabet:bp3_indian,\n  temperament:12TET,\n  degrees(0, 2, 4, 5, 7, 9, 11)\n)\n\n// @description ENGLISH note convention of the native BP3 engine, in 12-TET\ntuning bp3_english_12TET(\n  alphabet:bp3_english,\n  temperament:12TET,\n  degrees(0, 2, 4, 5, 7, 9, 11)\n)\n\n// @description FRENCH note convention of the native BP3 engine, in 12-TET\ntuning bp3_fr_12TET(\n  alphabet:bp3_fr,\n  temperament:12TET,\n  degrees(0, 2, 4, 5, 7, 9, 11)\n)\n\n// @description Indian sargam in 22-shruti system \u2014 full microtonal resolution\ntuning sargam_22shruti(\n  alphabet:sargam,\n  temperament:22shruti,\n  degrees(0, 4, 8, 9, 13, 17, 21)\n)\n\n// @description Latin solf\xE8ge in 12-TET\ntuning solfege_12TET(\n  alphabet:solfege,\n  temperament:12TET,\n  degrees(0, 2, 4, 5, 7, 9, 11)\n)\n\n// @description Arabic maqam system \u2014 quarter-tone grid\ntuning arabic_24TET(\n  alphabet:arabic,\n  temperament:24TET,\n  degrees(0, 4, 8, 10, 14, 18, 22)\n)\n\n// @description Turkish makam \u2014 53-comma system\ntuning turkish_53TET(\n  alphabet:turkish,\n  temperament:53TET,\n  degrees(0, 4, 9, 13, 17, 22, 26, 31, 35, 39, 44, 48, 4, 9, 13, 17)\n)\n\n// @description Javanese gamelan pelog \u2014 7-tone stretched octave\ntuning gamelan_pelog(\n  alphabet:gamelan_pelog,\n  temperament:gamelan_pelog,\n  degrees(0, 1, 2, 3, 4, 5, 6)\n)\n\n// @description Javanese gamelan slendro \u2014 5-tone near-equal, stretched octave\ntuning gamelan_slendro(\n  alphabet:gamelan_slendro,\n  temperament:gamelan_slendro,\n  degrees(0, 1, 2, 3, 4)\n)\n\n// @description Bohlen-Pierce just \u2014 13 tones in a tritave (3:1)\ntuning bohlen_pierce_just(\n  alphabet:bohlen_pierce,\n  temperament:bohlen_pierce_just,\n  degrees(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)\n)\n\n// @description Bohlen-Pierce equal \u2014 13 equal divisions of the tritave\ntuning bohlen_pierce_equal(\n  alphabet:bohlen_pierce,\n  temperament:bohlen_pierce_equal,\n  degrees(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)\n)\n\n// @description 22-shruti as named by BP3 \u2014 23 degrees on the bp3_shruti23_native temperament (native table -to.tryShruti verbatim,\n// 729/512). Distinct from bp3_grama (Arnold).\ntuning shruti23_native(\n  alphabet:shruti23,\n  temperament:bp3_shruti23_native,\n  degrees(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22)\n)\n\n// @description Western in BP3 just intonation, C-anchored (tonic C4 = 261.63 Hz, native table -to.tryOneScale). The 'j' in Cj/Aj/Gj =\n// degree marker, parsed C/A/G; ALL notes are rendered by this same just scale \u2014 one tuning, no parallel alphabet. Distinct from\n// western_just (A440-anchored). Temperament bp3_just_intonation coincides with just_5limit on C/D/E/F/G/A (degrees 0,2,4,5,7,9).\ntuning western_just_c(\n  alphabet:western,\n  temperament:bp3_just_intonation,\n  degrees(0, 2, 4, 5, 7, 9, 11),\n  baseNote:C,\n  diapason:261.63\n)\n\n// @description Shakuhachi 1.8 shaku \u2014 the five base fingerings on equal temperament\ntuning shakuhachi_12TET(\n  alphabet:shakuhachi,\n  temperament:12TET,\n  degrees(0, 3, 5, 7, 10)\n)\n", "fichier": "tunings.bpsl" }, { "nom": "types", "format": "bpsl", "texte": '// @documented\ndef types(resolves:types)\n\ndef scale(scope(scene))\nscale interval\nscale degree\ndegree directional\nscale composite\n\ndef sound(scope(scene))\n\ndef alphabet(scope(scene), octaves:western, sound terminals())\n\ndef temperament\ndef tuning(scope(scene))\ndef octaves(scope(scene))\ndef voice(scope(scene))\ndef eval(scope(scene))\ndef midi_default\n\ndef control\ndef addresskey\ndef enum\ndef flag\ndef symbol\n\ndef destination\ndestination audio(out:true, writable:true, params(gain:1))\ndestination midi(in:true, out:true, writable:true, params(ch:1))\ndestination osc(\n  in:true,\n  out:true,\n  writable:true,\n  params(host:"127.0.0.1", port:57120, addr:/kanopi)\n)\ndestination keyboard(in:true, writable:true)\ndestination dmx(out:true, writable:true, params(universe:0))\ndestination text(out:true, writable:false)\n\ndef actor(alphabet alphabet, tuning tuning, octaves octaves, destination out, eval eval)\n\ndef signal\nsignal pitch\nsignal phase\nsignal logic\n', "fichier": "types.bpsl" }, { "nom": "variation", "format": "bpsl", "texte": 'types\n\n// @documented\n// @description DISCRETE variation modes of playing parameters \u2014 fixed and steps. Between two written values of the same parameter, the mode\n// says whether the first HOLDS until the second (fixed) or GLIDES from note to note (steps). These two modes resolve at the note, hence\n// before any sound is emitted: they belong to Kairos. The third mode \u2014 continuous \u2014 glides DURING notes, through intermediate messages: it\n// can only be rendered by whoever emits, and it therefore lives in the library of its parameter.\ndef variation(\n  resolves:variation,\n  resolvedBy:"Kairos",\n  name:variation,\n  version:0.1.0,\n  section:controls\n)\n\n// @description Velocity in FIXED mode \u2014 the written value holds until the next one, clean jump.\ncontrol velfixed(\n  bp3:_velfixed,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Velocity BY STEPS \u2014 the value glides from note to note between two written values.\ncontrol velstep(\n  bp3:_velstep,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Modulation in FIXED mode \u2014 the written value holds until the next one, clean jump.\ncontrol modfixed(\n  bp3:_modfixed,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Modulation BY STEPS \u2014 the value glides from note to note between two written values.\ncontrol modstep(\n  bp3:_modstep,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Pitchbend in FIXED mode \u2014 the written value holds until the next one, clean jump.\ncontrol pitchfixed(\n  bp3:_pitchfixed,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Pitchbend BY STEPS \u2014 the value glides from note to note between two written values.\ncontrol pitchstep(\n  bp3:_pitchstep,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Pressure in FIXED mode \u2014 the written value holds until the next one, clean jump.\ncontrol pressfixed(\n  bp3:_pressfixed,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Pressure BY STEPS \u2014 the value glides from note to note between two written values.\ncontrol presstep(\n  bp3:_presstep,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Volume in FIXED mode \u2014 the written value holds until the next one, clean jump.\ncontrol volumefixed(\n  bp3:_volumefixed,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Volume BY STEPS \u2014 the value glides from note to note between two written values.\ncontrol volumestep(\n  bp3:_volumestep,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Articulation in FIXED mode \u2014 the written value holds until the next one, clean jump. Articulation is set by legato and\n// staccato.\ncontrol articulfixed(\n  bp3:_articulfixed,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Articulation BY STEPS \u2014 the value glides from note to note between two written values.\ncontrol articulstep(\n  bp3:_articulstep,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Panning in FIXED mode \u2014 the written value holds until the next one, clean jump.\ncontrol panfixed(\n  bp3:_panfixed,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Panning BY STEPS \u2014 the value glides from note to note between two written values.\ncontrol panstep(\n  bp3:_panstep,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Key map in FIXED mode \u2014 the written map holds until the next one, clean jump.\ncontrol mapfixed(\n  bp3:_mapfixed,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Key map BY STEPS \u2014 the map glides from note to note between two written maps.\ncontrol mapstep(\n  bp3:_mapstep,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Transposition in FIXED mode \u2014 the written value holds until the next one, clean jump.\ncontrol transposefixed(\n  bp3:_transposefixed,\n  scope(symbol, group, rule, flow)\n)\n\n// @description Transposition BY STEPS \u2014 the value glides from note to note between two written values.\ncontrol transposestep(\n  bp3:_transposestep,\n  scope(symbol, group, rule, flow)\n)\n', "fichier": "variation.bpsl" }, { "nom": "voices", "format": "bpsl", "texte": 'types\n\n// @documented\ndef voices(resolvedBy:Kairos, name:voices, resolves:voice)\n\nvoice wobble(\n  audio:"`js: (t, dur, env) => (2*((t*env.pitch)%1)-1) * (0.55+0.45*Math.sin(2*Math.PI*5.5*t)) * Math.max(0,1-t/dur)`",\n  section:objects\n)\nvoice fatbass(\n  audio:"`js: (t, dur, env) => ((2*((t*env.pitch)%1)-1) + (2*((t*env.pitch*1.01)%1)-1)) * 0.4 * Math.max(0,1-t/dur)`",\n  for(sub37(device(preset:bass-init, glide:0.2, osc1-wave:saw))),\n  section:objects\n)\nvoice bayan_open(\n  audio:"`js: (t) => { const h = Math.sin(t*99991)*43758.5453; const b = 2*(h-Math.floor(h))-1; return (Math.sin(2*Math.PI*80*t)*0.8 + b*0.2) * Math.exp(-t/0.35); }`",\n  section:objects\n)\nvoice bayan_muted(\n  audio:"`js: (t) => { const h = Math.sin(t*99991)*43758.5453; const b = 2*(h-Math.floor(h))-1; return (Math.sin(2*Math.PI*120*t)*0.5 + b*0.5) * Math.exp(-t/0.08); }`",\n  section:objects\n)\nvoice dayan_ring(\n  audio:"`js: (t) => (Math.sin(2*Math.PI*320*t) + Math.sin(2*Math.PI*480*t)) * 0.5 * Math.exp(-t/0.4)`",\n  section:objects\n)\nvoice dayan_tap(\n  audio:"`js: (t) => { const h = Math.sin(t*99991)*43758.5453; return (2*(h-Math.floor(h))-1) * Math.exp(-t/0.06); }`",\n  section:objects\n)\nvoice dayan_dry(\n  audio:"`js: (t) => (Math.sin(2*Math.PI*494*t) + Math.sin(2*Math.PI*587*t)) * 0.5 * Math.exp(-t/0.06)`",\n  section:objects\n)\nvoice dayan_open(\n  audio:"`js: (t) => (Math.sin(2*Math.PI*392*t) + Math.sin(2*Math.PI*494*t) + Math.sin(2*Math.PI*523*t) + Math.sin(2*Math.PI*587*t)) * 0.25 * Math.exp(-t/0.22)`",\n  section:objects\n)\nvoice dummy_csound_a(\n  audio:"`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`",\n  section:objects\n)\nvoice dummy_csound_b(\n  audio:"`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`",\n  section:objects\n)\nvoice dummy_csound_c(\n  audio:"`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`",\n  section:objects\n)\nvoice dummy_csound_d(\n  audio:"`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`",\n  section:objects\n)\nvoice dummy_csound_e(\n  audio:"`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`",\n  section:objects\n)\nvoice dummy_csound_f(\n  audio:"`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`",\n  section:objects\n)\nvoice dummy_csound_midiobject(\n  audio:"`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`",\n  section:objects\n)\n', "fichier": "voices.bpsl" }];
function sourcesDeLibrairie() {
  return SOURCES.map((s) => ({ ...s }));
}

// src/transpiler/libs.js
var _registre = {};
var _charge = false;
var _compiler = null;
function brancherLeCompilateur(compiler) {
  _compiler = compiler;
}
function assurerLeRegistre() {
  if (_charge) return;
  if (typeof _compiler !== "function") {
    throw new Error("le registre des librairies ne peut pas se construire : aucun compilateur n'est branch\xE9 \u2014 entrer par la porte 'index.js', qui le branche \xE0 son chargement");
  }
  _charge = true;
  chargerLesLibrairies(sourcesDeLibrairie(), _compiler, registerLib);
}
var _version = 0;
function versionDuRegistre() {
  return _version;
}
function leRegistre() {
  assurerLeRegistre();
  return _registre;
}
var cache = {};
function registerLib(name, data) {
  leRegistre()[name] = data;
  cache[name] = data;
  _version++;
  _universeControls = null;
}
var _universeControls = null;
function universeControlNames() {
  if (!_universeControls) {
    const allDirs = Object.keys(leRegistre()).map((name) => ({ name }));
    _universeControls = loadLibsFromDirectives(allDirs).controlNames;
  }
  return _universeControls;
}
function motsDInvocation() {
  const table = /* @__PURE__ */ new Map();
  for (const fichier of Object.keys(leRegistre()).sort()) {
    const lib = leRegistre()[fichier];
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
  const regData = leRegistre()[canonical] || leRegistre()[name];
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
function librairiesQuiDeclarent(nom) {
  if (!nom) return [];
  const mots = [];
  for (const [cle, lib] of Object.entries(leRegistre())) {
    if (!lib || typeof lib !== "object" || cle.includes("/")) continue;
    const mot = typeof lib.resolves === "string" && lib.resolves || cle;
    let declare = false;
    const marcher = (o) => {
      for (const [k, v] of Object.entries(o || {})) {
        if (k.startsWith("_") || !v || typeof v !== "object" || Array.isArray(v)) continue;
        if (k === nom && Array.isArray(v.scope) && v.bpscript !== false) declare = true;
        else marcher(v);
      }
    };
    marcher(lib);
    const adresses = lib.schema && lib.schema.addressKeys;
    if (adresses && !Array.isArray(adresses) && typeof adresses === "object" && Object.prototype.hasOwnProperty.call(adresses, nom)) declare = true;
    if (declare && !mots.includes(mot)) mots.push(mot);
  }
  return mots;
}
function groupeDUnicite(nom) {
  if (!nom) return null;
  for (const lib of Object.values(leRegistre())) {
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
      return { entry, lib: i === 0 ? null : (leRegistre()[fichiers[i]] || {}).resolves || fichiers[i] };
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
  return Object.keys(alphabetLib.terminals).filter((k) => !k.startsWith("_"));
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
  const grammaire = SYNTAXE.grammarWords;
  ctx.reservedDirectiveNames = new Set(grammaire && Array.isArray(grammaire.mots) ? grammaire.mots : []);
  ctx.addressKeys = /* @__PURE__ */ new Set();
  ctx.portees = /* @__PURE__ */ new Map();
  const tombale = SYNTAXE.bracketRewrites;
  ctx.qualifierKeys = new Set(tombale && Array.isArray(tombale.mots) ? tombale.mots : []);
  ctx.defaultComponents = coreLib.defaults && coreLib.defaults.components || {};
  const mergeValueRegistry = (file, axis) => {
    if (!file || !file.values || typeof file.values !== "object") return;
    for (const [vname, spec] of Object.entries(file.values)) {
      if (vname.startsWith("_") || !spec || typeof spec !== "object") continue;
      if (ctx.reservedDirectiveNames.has(vname) || ctx.controlNames.has(vname)) {
        ctx.valueRegistryErrors.push(diagnostic("LIBS_VALUE_NAME_RESERVED", { vname }));
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
  const settingsLib = loadLib("settings");
  if (settingsLib) ctx._libs["settings"] = settingsLib;
  const invoquees = new Set((directives || []).flatMap((d) => d ? [d.name, d.lib] : []).filter(Boolean));
  const apportees = [];
  const aTraiter = [...directives || []];
  for (const d of directives || []) {
    if (!d || !d.lib || (directives || []).some((x) => x && x.name === d.lib && !x.lib)) continue;
    const nommee = { type: "Directive", name: d.lib, subkey: null };
    apportees.push(nommee);
    aTraiter.push(nommee);
  }
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
  for (const dir of aCharger) {
    const lib = dir && dir.name ? loadJsonFile(dir.name) : null;
    if (!lib || typeof lib !== "object") continue;
    const s = lib.schema;
    if (s && s.reservedDirectives) for (const n of nomsReserves(s.reservedDirectives)) ctx.reservedDirectiveNames.add(n);
    if (s && s.addressKeys) {
      const cles = Array.isArray(s.addressKeys) ? s.addressKeys : Object.keys(s.addressKeys);
      for (const n of cles) {
        if (n.startsWith("_")) continue;
        ctx.addressKeys.add(n);
        const def = Array.isArray(s.addressKeys) ? null : s.addressKeys[n];
        if (def && Array.isArray(def.scope) && !ctx.portees.has(n)) ctx.portees.set(n, def.scope);
      }
    }
    for (const section of Object.values(lib)) {
      if (!section || typeof section !== "object" || Array.isArray(section)) continue;
      for (const [nom, def] of Object.entries(section)) {
        if (nom.startsWith("_") || !def || typeof def !== "object" || !Array.isArray(def.scope)) continue;
        if (def.bpscript === false) continue;
        if (def.scope.includes("scene")) ctx.reservedDirectiveNames.add(nom);
        if (!ctx.portees.has(nom)) ctx.portees.set(nom, def.scope);
      }
    }
  }
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
          ccNumber: cc.number
        };
        const resolveurDeLaDirective = (loadJsonFile(dir.name) || {}).resolvedBy;
        if (resolveurDeLaDirective) ctx.controlResolvedBy[cc.name] = resolveurDeLaDirective;
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
    const lib = leRegistre()[qualifie.slice(0, point)];
    const nom = qualifie.slice(point + 1);
    if (!lib || typeof lib !== "object") return "librairie absente";
    for (const section of Object.values(lib)) {
      if (!section || typeof section !== "object" || Array.isArray(section)) continue;
      if (section[nom] && typeof section[nom] === "object") return true;
    }
    return false;
  };
  for (const [qual, cible] of Object.entries(ctx.implementedInterface)) {
    const declaree = declareDansLeRegistre(cible);
    if (declaree === "librairie absente") continue;
    if (!declaree) {
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
  for (const dir of aCharger) {
    const lib = dir && dir.name ? loadJsonFile(dir.name) : null;
    const reglages = lib && lib.reglages;
    if (!reglages || typeof reglages !== "object" || Array.isArray(reglages)) continue;
    for (const [nom, valeur] of Object.entries(reglages)) {
      const def = ctx.controls[nom];
      if (!def || typeof def !== "object") continue;
      ctx.controls[nom] = { ...def, value: valeur };
    }
  }
  return ctx;
}

// src/transpiler/index-des-objets.js
function motDe(cle, lib) {
  return lib && typeof lib.resolves === "string" && lib.resolves || cle;
}
function membresDe(objet2, exclure = /* @__PURE__ */ new Set()) {
  const out = {};
  for (const [k, v] of Object.entries(objet2 || {})) {
    if (k === "_derive" || k.startsWith("_") || exclure.has(k)) continue;
    out[k] = v;
  }
  return out;
}
var _index = null;
var _versionIndexee = -1;
function index() {
  const LIBS = leRegistre();
  const version = versionDuRegistre();
  if (_index && _versionIndexee === version) return _index;
  const familles2 = /* @__PURE__ */ new Map();
  const objets2 = /* @__PURE__ */ new Map();
  const poser = (o) => {
    if (!objets2.has(o.nom)) objets2.set(o.nom, []);
    objets2.get(o.nom).push(o);
  };
  const PLACES = placesDesLibrairies(LIBS);
  const familleDe = (mot) => {
    if (!familles2.has(mot)) familles2.set(mot, { nom: mot, membres: {}, entrees: [], places: [], contributeurs: [] });
    return familles2.get(mot);
  };
  for (const [cle, lib] of Object.entries(LIBS)) {
    if (!lib || typeof lib !== "object" || Array.isArray(lib)) continue;
    const barre = cle.indexOf("/");
    if (barre > 0) {
      const dossier = cle.slice(0, barre);
      const mot2 = motDe(dossier, LIBS[dossier]);
      const fam2 = familleDe(mot2);
      fam2.contributeurs.push(cle);
      const o = {
        nom: cle.slice(barre + 1),
        famille: mot2,
        derive: null,
        membres: membresDe(lib, CHAMPS_DE_FICHIER),
        place: null,
        chaine: [mot2, cle.slice(barre + 1)],
        librairie: cle,
        documented: Boolean(lib.documented)
      };
      fam2.entrees.push(o);
      poser(o);
      continue;
    }
    const mot = motDe(cle, lib);
    const places2 = new Set((PLACES[cle] || []).filter((p) => p !== "_deduites"));
    const fam = familleDe(mot);
    fam.contributeurs.push(cle);
    for (const place of places2) if (!fam.places.includes(place)) fam.places.push(place);
    for (const [k, v] of Object.entries(lib)) {
      if (k.startsWith("_") || CHAMPS_DU_PAQUET.has(k) || places2.has(k)) continue;
      if (v && typeof v === "object" && !Array.isArray(v)) continue;
      if (!(k in fam.membres)) fam.membres[k] = v;
    }
    const entree = (nom, brut, place) => {
      const o = {
        nom,
        famille: mot,
        derive: typeof brut._derive === "string" ? brut._derive : null,
        membres: membresDe(brut),
        place,
        chaine: [mot, nom],
        // ⛔ D'OÙ VIENT CET OBJET — champ posé le 2026-09-03 sur la mesure de bp3-frontend. Deux
        // catalogues servent la famille `alphabet` : `alphabets` (16) et `test_alphabets` (8). La
        // porte les aplatissait en 24 objets INDISCERNABLES, quand le bundle les séparait par ses
        // sections. Ce n'était pas un choix : une information que le paquet portait avait disparu.
        // ⚠️ ET SÛREMENT PAS `documented` À SA PLACE : il vaut `false` sur les alphabets de test et
        // `true` ailleurs, donc il COÏNCIDE aujourd'hui — mais il dit « ce catalogue est documenté »,
        // pas « il vient d'ici ». Un champ qui coïncide n'est pas un champ qui signifie ; le jour où
        // un alphabet de test serait documenté, un garde bâti dessus deviendrait faux sans rougir.
        // bp3-frontend a refusé de s'en servir, et il avait raison.
        librairie: cle,
        documented: Boolean(lib.documented)
      };
      fam.entrees.push(o);
      poser(o);
    };
    for (const nom of entreesDe(lib)) {
      if (places2.has(nom)) continue;
      entree(nom, lib[nom], null);
    }
    for (const place of places2) {
      const contenu = lib[place];
      if (!contenu || typeof contenu !== "object" || Array.isArray(contenu)) continue;
      for (const nom of entreesDe(contenu)) entree(nom, contenu[nom], place);
    }
  }
  const parNom = (nom) => objets2.get(nom) || [];
  const prototypeDe = (nom) => {
    const candidats = parNom(nom);
    if (candidats.length === 1) return candidats[0];
    const racines = candidats.filter((c) => !c.derive);
    return racines.length === 1 ? racines[0] : null;
  };
  for (const liste of objets2.values()) {
    for (const o of liste) {
      if (!o.derive) continue;
      const vus = /* @__PURE__ */ new Set([o]);
      let proto = prototypeDe(o.derive);
      while (proto && !vus.has(proto)) {
        vus.add(proto);
        for (const [k, v] of Object.entries(proto.membres)) if (!(k in o.membres)) o.membres[k] = v;
        proto = proto.derive ? prototypeDe(proto.derive) : null;
      }
    }
  }
  for (const fam of familles2.values()) {
    for (const o of fam.entrees) {
      for (const [k, v] of Object.entries(fam.membres)) {
        if (k === "documented" || k === "apporte" || CHAMPS_DE_FICHIER.has(k)) continue;
        if (!(k in o.membres)) o.membres[k] = v;
      }
    }
  }
  _index = { familles: familles2, objets: objets2 };
  _versionIndexee = version;
  return _index;
}
var copie = (o) => ({ ...o, membres: { ...o.membres }, chaine: [...o.chaine] });
function familles() {
  return [...index().familles.keys()];
}
function famille(mot) {
  const f = index().familles.get(mot);
  if (!f) return null;
  return { nom: f.nom, membres: { ...f.membres }, places: [...f.places], entrees: f.entrees.map(copie) };
}
function objet(chaine) {
  const segments = String(chaine || "").split(".").filter(Boolean);
  if (!segments.length) return null;
  const nom = segments[segments.length - 1];
  const candidats = (index().objets.get(nom) || []).filter((o) => {
    const c = o.chaine;
    if (segments.length > c.length) return false;
    for (let i = 1; i <= segments.length; i++) if (c[c.length - i] !== segments[segments.length - i]) return false;
    return true;
  });
  if (candidats.length === 1) return copie(candidats[0]);
  if (candidats.length === 0) return null;
  return { ambigu: candidats.map((o) => o.chaine.join(".")) };
}
function objets() {
  const out = [];
  for (const liste of index().objets.values()) for (const o of liste) out.push(copie(o));
  return out;
}
function motsDeLaGrammaire() {
  const g = SYNTAXE.grammarWords;
  return new Set(g && Array.isArray(g.mots) ? g.mots : []);
}
function formeDuMot(nom) {
  const s = SYNTAXE.grammarWords && SYNTAXE.grammarWords.syntaxe;
  const f = s && s[nom];
  return typeof f === "string" ? f : null;
}
function motReserve(nom) {
  return motsDeLaGrammaire().has(nom);
}
function axesDeCatalogue() {
  const types = index().familles.get("types");
  if (!types) return [];
  return types.entrees.filter((e) => !e.derive && Array.isArray(e.membres.scope) && e.membres.scope.includes("scene")).map((e) => e.nom);
}
function clesDActeur() {
  const o = objet("types.actor");
  const out = /* @__PURE__ */ new Map();
  if (!o || o.ambigu) return out;
  for (const [k, v] of Object.entries(o.membres || {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof v._derive === "string") out.set(k, v._derive);
  }
  return out;
}
function canaux() {
  const out = {};
  for (const o of index().objets.values()) {
    for (const e of o) {
      if (e.derive !== "destination") continue;
      const m = {};
      for (const [k, v] of Object.entries(e.membres || {})) if (!k.startsWith("_")) m[k] = v;
      out[e.nom] = m;
    }
  }
  return out;
}
function lesDefauts(ast) {
  const o = ast ? objetEnPortee("components", ast) : objet("components");
  if (!o) return null;
  if (o.ambigu) throw new Error(`'components' est d\xE9clar\xE9 par plusieurs librairies \u2014 ${o.ambigu.join(", ")}`);
  return o.membres;
}
function motsInvoques(ast) {
  const LIBS = leRegistre();
  const apportePar = /* @__PURE__ */ new Map();
  for (const [cle, lib] of Object.entries(LIBS)) {
    if (!lib || typeof lib !== "object") continue;
    const mot = motDe(cle.split("/")[0], LIBS[cle.split("/")[0]]);
    if (!apportePar.has(mot)) apportePar.set(mot, /* @__PURE__ */ new Set());
    for (const a of Array.isArray(lib.apporte) ? lib.apporte : []) apportePar.get(mot).add(a);
  }
  const vus = /* @__PURE__ */ new Set();
  const file = (ast && ast.directives || []).flatMap((d) => d ? [d.name, d.lib] : []).filter(Boolean);
  while (file.length) {
    const mot = file.shift();
    if (vus.has(mot)) continue;
    vus.add(mot);
    for (const a of apportePar.get(mot) || []) file.push(a);
  }
  return vus;
}
function objetEnPortee(nom, ast) {
  const o = objet(nom);
  if (!o) return null;
  if (o.ambigu) throw new Error(`'${nom}' est d\xE9clar\xE9 par plusieurs librairies \u2014 ${o.ambigu.join(", ")} \u2014 et le compilateur ne peut pas choisir`);
  return motsInvoques(ast).has(o.famille) ? o : null;
}

// src/transpiler/vocabulaire.js
var nomsDe = (mot) => {
  const f = famille(mot);
  return f ? f.entrees.filter((e) => e.documented).map((e) => e.nom) : [];
};
var pick = (def, keys) => {
  const o = {};
  for (const k of keys) if (def[k] !== void 0) o[k] = def[k];
  return o;
};
function describeVocabulary(directives = []) {
  const aUneScene = Array.isArray(directives) && directives.length > 0;
  const allDirs = aUneScene ? directives : Object.keys(leRegistre()).map((name) => ({ name }));
  const ctx = loadLibsFromDirectives(allDirs);
  const components = {};
  for (const axis of axesDeCatalogue()) components[axis] = nomsDe(axis);
  return {
    voices: nomsDe("voice"),
    keywords: [...ctx.reservedDirectiveNames],
    controls: Object.entries(ctx.controls).map(([name, def]) => ({ name, ...pick(def || {}, ["args", "range", "values", "value", "description", "resolvedBy"]) })),
    values: Object.entries(ctx.valueRegistry).map(([name, spec]) => ({ name, ...pick(spec || {}, ["range", "unit", "values", "description"]) })),
    // ⛔ UNE FONCTION EST UN MOT QUI PORTE SON CORPS — arbitrage de Romain, 2026-09-03 : une
    // manipulation est un contrôle du langage, et son corps se rattache à lui (`lib/transpo/
    // transpose.ts`). La famille `function` a disparu avec cette forme ; l'éditeur propose donc
    // les mots qui portent une réalisation, quelle que soit la librairie qui les déclare.
    // Une manipulation porte SES PARAMÈTRES avec son corps ; une table d'homomorphisme hérite le
    // corps de son applicateur sans en être une — elle est la donnée sur laquelle il travaille.
    functions: objets().filter((o) => o.documented && typeof o.membres.body === "string" && o.membres.params).map((o) => o.nom),
    components,
    addressKeys: [...ctx.addressKeys],
    qualifierKeys: [...ctx.qualifierKeys],
    directiveValues: SYNTAXE.directiveValues || {},
    syntaxWords: SYNTAXE.syntaxWords || {}
  };
}

// src/transpiler/constants.js
var BP3_OPERATORS = Object.freeze({ plus: "+", fin: ";", star: "*" });

// src/transpiler/parser.js
var ParseError = class extends Error {
  constructor(code, params, token) {
    super(`${texteDuDiagnostic(code, { ...params, line: token.line, col: token.col })} at line ${token.line}:${token.col}`);
    this.code = code;
    this.token = token;
  }
};
var memoDuRegistre = (calcul) => {
  let valeur = null, version = -1;
  return () => {
    const v = versionDuRegistre();
    if (valeur === null || version !== v) {
      valeur = calcul();
      version = v;
    }
    return valeur;
  };
};
var actorKeysData = memoDuRegistre(() => {
  const valides = new Set(clesDActeur().keys());
  const t = SYNTAXE.actorKeyRewrites;
  const perimees = new Set(t && Array.isArray(t.mots) ? t.mots.filter((m) => !valides.has(m)) : []);
  return { valides, perimees, toutes: /* @__PURE__ */ new Set([...valides, ...perimees]) };
});
var catalogAxisKeys = memoDuRegistre(() => new Set(axesDeCatalogue()));
var channelCatalog = memoDuRegistre(() => canaux());
var outChannels = memoDuRegistre(() => {
  const cat = channelCatalog();
  return new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].out));
});
function refuserCanalDeSortieInconnu(name, subkey, tok) {
  if (name !== "out" || !subkey) return;
  if (!outChannels().has(subkey)) {
    throw new ParseError("PARSE_SUBKEY_OUTPUT_OUTPUT_CHANNELS", { subkey, p1: [...outChannels()].join(", ") }, tok);
  }
  if (!writableChannels().has(subkey)) {
    throw new ParseError("PARSE_OUT_SUBKEY_REFUSED_CHANNEL", { subkey }, tok);
  }
}
function refuserModeInvalide(name, runtime, value, tok) {
  if (name !== "mode") return;
  const declares = ((SYNTAXE.directiveValues.mode || {}).values || []).map((v) => v.name);
  const ecrit = runtime ?? (value == null ? null : String(value));
  if (ecrit == null) {
    throw new ParseError("PARSE_MODE_EXPECTS_DERIVATION_MODE", { p1: declares.join(", ") }, tok);
  }
  if (!declares.includes(ecrit)) {
    throw new ParseError("PARSE_MODE_ECRIT_ECRIT_DERIVATION", { ecrit, p1: declares.join(", ") }, tok);
  }
}
var inChannels = memoDuRegistre(() => {
  const cat = channelCatalog();
  return new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].in));
});
var writableChannels = memoDuRegistre(() => {
  const cat = channelCatalog();
  return new Set(Object.keys(cat).filter((c) => cat[c] && cat[c].writable));
});
var voicesIndex = memoDuRegistre(() => {
  const _voicesIndex = /* @__PURE__ */ new Map();
  const voix = (famille("voice")?.entrees || []).map((o) => [o.nom, o.membres]);
  for (const [name, def] of voix) {
    const forDevices = def && typeof def.for === "object" && def.for ? { ...def.for } : {};
    _voicesIndex.set(name, { base: def, forDevices });
  }
  return _voicesIndex;
});
function isTypedBacktick(v) {
  return typeof v === "string" && /^`\s*[A-Za-z_][\w-]*\s*:/.test(v);
}
function assertVoiceRef(name, where, token) {
  const entry = voicesIndex().get(name);
  if (!entry) {
    throw new ParseError("PARSE_WHERE_UNKNOWN_VOICE_NAME", { where, name }, token);
  }
  const defs = [...entry.base ? [entry.base] : [], ...Object.values(entry.forDevices)];
  for (const def of defs) {
    if (def.audio !== void 0 && !isTypedBacktick(def.audio)) {
      throw new ParseError("PARSE_WHERE_VOICE_NAME_INVALID", { where, name, p1: JSON.stringify(def.audio) }, token);
    }
  }
}
var _alphabetVoicesChecked = /* @__PURE__ */ new Set();
function assertAlphabetVoices(alphabetName, token) {
  if (_alphabetVoicesChecked.has(alphabetName)) return;
  const alpha = loadLib("alphabet", alphabetName);
  if (alpha) {
    for (const [terminal, def] of Object.entries(alpha.terminals || {})) {
      if (terminal.startsWith("_")) continue;
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
  const refusDeRegle = [];
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
    ambiguousControls: /* @__PURE__ */ new Set(),
    // ⛔ CE QUE LA SCÈNE A EN PORTÉE SE LIT ICI, ET NULLE PART AILLEURS — principe 1 de Romain
    // (2026-09-02) : l'invocation met en portée ce qu'une librairie déclare, rien d'autre. Le
    // contexte se RECHARGE à chaque ligne de tête qui invoque (voir la boucle de tête), donc un
    // mot n'est connu qu'après la ligne qui l'apporte. Les sept « univers » du registre entier
    // que le parseur lisait avant ce chargement n'existent plus.
    addressKeys: /* @__PURE__ */ new Set(),
    reservedDirectiveNames: /* @__PURE__ */ new Set(),
    portees: /* @__PURE__ */ new Map(),
    componentControls: /* @__PURE__ */ new Set(),
    ruleScopeControls: /* @__PURE__ */ new Set(),
    ruleAllowedControls: /* @__PURE__ */ new Set(),
    engineBagControls: /* @__PURE__ */ new Set(),
    runtimeBagControls: /* @__PURE__ */ new Set()
  };
  let directivesChargees = 0;
  const definitionsDeclarees = /* @__PURE__ */ new Set();
  const nomsDeclaresLocalement = /* @__PURE__ */ new Set();
  const acteursDeclares = /* @__PURE__ */ new Set();
  const prototypesDeclares = /* @__PURE__ */ new Set();
  const derivations = /* @__PURE__ */ new Map();
  const racineDe = (nom) => {
    let courant = nom;
    const vus = /* @__PURE__ */ new Set();
    while (courant && !vus.has(courant)) {
      vus.add(courant);
      const p = derivations.get(courant);
      if (!p) return courant;
      courant = p;
    }
    return courant;
  };
  const nomsVariables = /* @__PURE__ */ new Set();
  const membresDesVariables = /* @__PURE__ */ new Map();
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
    if (tok.type !== type) throw new ParseError("PARSE_EXPECTED_TYPE_GOT", { type, p1: tok.type, p2: tok.value }, tok);
    return advance();
  }
  function lireNomDEntree(tok) {
    if (!at(T.IDENT) && !at(T.INT)) {
      throw new ParseError("PARSE_EXPECTED_GOT", { p1: T.IDENT, p2: current().type, p3: current().value }, tok || current());
    }
    const chiffreDAbord = at(T.INT);
    const depart = current();
    let nom = String(advance().value);
    while ((at(T.IDENT) || at(T.INT) || at(T.REST)) && !current().spaceBefore) nom += String(advance().value);
    if (chiffreDAbord && !/[A-Za-z]/.test(nom)) {
      throw new ParseError("PARSE_NOM_NUMBER_NAME_NAME", { nom }, depart);
    }
    return nom;
  }
  function ouvreUnNom(offset = 0) {
    if (peek(offset).type === T.IDENT) return true;
    if (peek(offset).type !== T.INT) return false;
    const suite2 = peek(offset + 1);
    return (suite2.type === T.IDENT || suite2.type === T.INT) && suite2.spaceBefore === false;
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
        throw new ParseError("PARSE_RULE_WRITTEN_BEFORE_DELIMITER", {}, current());
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
            const paires = dir.settings && Array.isArray(dir.settings.pairs) ? dir.settings.pairs : [];
            membresDesVariables.set(n, Object.fromEntries(paires.filter((p) => p && p.key).map((p) => [p.key, p.value])));
          }
          if (dir.varType?.kind === "type") {
            for (const n of dir.names) {
              prototypesDeclares.add(n);
              if (dir.varType.type) derivations.set(n, dir.varType.type);
            }
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
          const placesDuRegistre = placesDesLibrairies(leRegistre());
          const librairiesVues = /* @__PURE__ */ new Set();
          const apporterLesPrototypesDe = (nomLib) => {
            if (!nomLib || librairiesVues.has(nomLib)) return;
            librairiesVues.add(nomLib);
            const lib = loadLib(nomLib) || {};
            const places2 = new Set((placesDuRegistre[nomLib] || []).filter((p) => p !== "_deduites"));
            for (const [nom, valeur] of Object.entries(lib)) {
              if (nom.startsWith("_") || !valeur || typeof valeur !== "object" || Array.isArray(valeur)) continue;
              if (places2.has(nom)) continue;
              prototypesDeclares.add(nom);
              if (typeof valeur._derive === "string" && valeur._derive) derivations.set(nom, valeur._derive);
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
      if (scene.directives.length !== directivesChargees) {
        directivesChargees = scene.directives.length;
        libCtx = loadLibsFromDirectives(scene.directives);
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
            throw new ParseError("PARSE_EXPANDS_WITHOUT_END_DEFINITION", { p1: el.name }, jetonDe(el));
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
        throw new ParseError("PARSE_PLACED_BARE_WITHOUT_ARGUMENTS", { p1: el.name, p2: def.kind === "prereglage" ? "a preset" : "a structure" }, jetonDe(el));
      }
      return corpsSubstitue(def, el);
    }
    if (el.type !== "Symbol") return null;
    if (def.kind === "transformation") {
      throw new ParseError("PARSE_TRANSFORMATION_CALLED_ARGUMENTS_WRITE", { p1: el.name, p2: def.params.join(", "), p3: def.params.map(() => "\u2026").join(", ") }, jetonDe(el));
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
      throw new ParseError("PARSE_TRANSFORMATION_ARGUMENT_GIVEN_POSITION", { p1: def.name, p2: nommes[0].key, p3: def.params.map(() => "\u2026").join(", "), p4: def.params.join(", ") }, jetonDe(appel));
    }
    if (args.length !== def.params.length) {
      throw new ParseError("PARSE_DEFINED_PARAMETER_CALLED_HERE", { p1: def.name, p2: def.params.length, p3: def.params.join(", "), p4: args.length }, jetonDe(appel));
    }
    const valeurs = /* @__PURE__ */ new Map();
    def.params.forEach((p, i) => {
      const v = args[i]?.value;
      if (!v || v.type !== "Literal" || typeof v.value !== "string" && typeof v.value !== "number") {
        throw new ParseError("PARSE_ARGUMENT_TERM_TRANSFORMATION_ARGUMENT", { p1: def.name, p }, jetonDe(appel));
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
          `${ou} '[${flag}\u2026]': the flag '${flag}' is not declared. A flag carries its initial value \u2014 'flag ${flag}:0' \u2014 before the delimiter. Without it, a rule that conditions on it never triggers, and nothing says so.`
        );
        return value;
      }
      if (typeof value !== "string") return value;
      const etats = flagStates[flag];
      if (etats && Object.prototype.hasOwnProperty.call(etats, value)) return etats[value];
      if (Object.prototype.hasOwnProperty.call(flagStates, value)) return value;
      criFlags.push(
        `${ou} '[${flag}${ou === "mutation" ? "=" : "=="}${value}]': '${value}' is not the name of a declared flag. A flag is compared to an INTEGER \u2014 '[${flag}==<integer>]' \u2014 or to the name of another flag, which must then be declared too: 'flag ${value}:<integer>'.`
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
      throw new ParseError("PARSE_FLAG_USAGES_DESIGNATE_NOTHING", {
        cri: criFlags.length === 1 ? criFlags[0] : `${criFlags.length} flag usages designate nothing:
  \xB7 ${criFlags.join("\n  \xB7 ")}`
      }, { line: 0, col: 0 });
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
      const estUnSon = estVariable && racineDe(nomPorte) === "sound";
      const membres = estUnSon ? membresDesVariables.get(nomPorte) || {} : null;
      const paramsPortes = estUnSon ? { ...membres, ...controls || {} } : controls;
      const aDesParams = paramsPortes !== null && Object.keys(paramsPortes).length > 0;
      el.payload = {
        nature: estVariable && !estUnSon ? "var" : "sounding",
        ...actor !== void 0 ? { actor } : {},
        ...aDesParams ? { params: paramsPortes } : {},
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
      if (libCtx.addressKeys.has(k)) {
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
    const suite2 = peek(1);
    if (!suite2 || suite2.type !== T.IDENT || suite2.spaceBefore) return null;
    advance();
    return "_" + advance().value;
  }
  function parseDirectiveColonValue(dirName) {
    let value = null, runtime = null;
    if (dirName && libCtx.intervalControls.has(dirName)) {
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
      throw new ParseError("PARSE_VALUE_DIRNAME_READS_ECRIT", { dirName, ecrit, reste }, current());
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
        throw new ParseError("PARSE_NAME_ECRIT_PRODUCTION_DIRECTIVE", { name, ecrit }, atTok);
      }
      if (name !== "seed") {
        throw new ParseError("PARSE_NAME_SEED_MAKES_SENSE", { name }, atTok);
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
    if (libCtx.portees.has(nom) || motReserve(nom)) return null;
    advance();
    advance();
    advance();
    return { type: "Declaration", name: nom, runtime: canal, line: tok.line };
  }
  function lireDeclarationParLeType() {
    if (!at(T.IDENT)) return null;
    const tok = current();
    const mot = tok.value;
    if (mot === "in" && peek(1).type === T.IDENT && !libCtx.portees.has("in")) {
      throw new ParseError("PARSE_REFUSED_INPUT_DECLARES_CHANNEL", { p1: peek(1).value, p2: [...inChannels()].join(", ") }, tok);
    }
    if (mot === "in" && peek(1).type === T.PERIOD && !peek(1).spaceBefore && peek(2).type === T.IDENT) {
      advance();
      advance();
      const canal = expect(T.IDENT).value;
      if (at(T.LPAREN)) {
        throw new ParseError("PARSE_CANAL_REFUSED_INPUT_CARRIES", { canal }, tok);
      }
      if (!inChannels().has(canal)) {
        throw new ParseError("PARSE_CANAL_INPUT_INPUT_CHANNELS", { canal, p1: [...inChannels()].join(", ") }, tok);
      }
      if (!at(T.IDENT)) {
        throw new ParseError("PARSE_CANAL_MUST_NAME_ROLE", { canal }, current());
      }
      const roleName = advance().value;
      let table = null;
      while (at(T.IDENT)) {
        const cle = advance().value;
        if (!at(T.PERIOD)) {
          throw new ParseError("PARSE_CANAL_ROLENAME_CLE_MUST", { canal, roleName, cle }, tok);
        }
        advance();
        const valeur = expect(T.IDENT).value;
        if (cle === "mapping") {
          table = valeur;
        } else if (cle === "alphabet") {
          throw new ParseError("PARSE_CANAL_ROLENAME_INPUT_CARRIES", { canal, roleName }, tok);
        } else {
          throw new ParseError("PARSE_CANAL_ROLENAME_UNKNOWN_PROPERTY", { canal, roleName, cle }, tok);
        }
      }
      return { type: "InDirective", name: roleName, transport: canal, mapping: table, line: tok.line };
    }
    if (mot === "def" || mot === "init") return null;
    if (mot === "object" && ouvreUnNom(1)) {
      throw new ParseError("PARSE_OBJECT_OBJECT_LEFT_LANGUAGE", { p1: peek(1).value }, tok);
    }
    if (mot === "actor" && ouvreUnNom(1)) {
      if (!prototypesDeclares.has("actor")) {
        throw new ParseError("PARSE_ACTOR_ACTOR_TYPE_SCOPE", { p1: peek(1).value }, tok);
      }
      return null;
    }
    if (!prototypesDeclares.has(mot)) {
      const apresLeNom = peek(2).type;
      const formeDeDeclaration = apresLeNom === T.NEWLINE || apresLeNom === T.EOF || apresLeNom === T.COMMENT || apresLeNom === T.COLON && !peek(2).spaceBefore;
      if (peek(1).type === T.IDENT && formeDeDeclaration && !motReserve(mot) && !libCtx.portees.has(mot)) {
        throw new ParseError("PARSE_MOT_MOT_TYPE_SCOPE", { mot, p1: peek(1).value }, tok);
      }
      return null;
    }
    if (!ouvreUnNom(1)) {
      if (peek(1).type === T.NEWLINE || peek(1).type === T.EOF) {
        if (loadLib(mot) || catalogAxisKeys().has(mot)) return null;
        throw new ParseError("PARSE_MOT_MUST_NAME_WHAT", { mot }, tok);
      }
      return null;
    }
    advance();
    const premier = lireNomDEntree(tok);
    if (mot === "flag") {
      if (!at(T.COLON)) {
        throw new ParseError("PARSE_FLAG_PREMIER_FLAG_CARRIES", { premier }, current());
      }
      advance();
      if (!at(T.INT)) {
        throw new ParseError("PARSE_FLAG_PREMIER_INITIAL_VALUE", { premier }, current());
      }
      const initiale = Number(advance().value);
      return {
        type: "VarDirective",
        names: [premier],
        varType: { kind: "flag", states: [], initiale },
        line: tok.line
      };
    }
    if (prototypesDeclares.has(mot) && racineDe(mot) !== "signal" && at(T.LPAREN)) {
      refuserEspaceAvantLeSac(`${mot} ${premier}`, tok);
      const sac = parseRuntimeQualifier();
      const corps = lireCorpsApresLeSac();
      return {
        type: "VarDirective",
        names: [premier],
        varType: { kind: "type", type: mot },
        settings: sac,
        ...corps ? { corps } : {},
        line: tok.line
      };
    }
    const lireDepart = (nom) => {
      if (!at(T.COLON)) return null;
      advance();
      const t = current();
      if (t.spaceBefore) {
        throw new ParseError("PARSE_MOT_NOM_STARTING_VALUE", { mot, nom }, t);
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
      throw new ParseError("PARSE_MOT_NOM_STARTING_VALUE_2", { mot, nom, p1: t.value ?? t.type }, t);
    };
    const departs = [];
    const d0 = lireDepart(premier);
    if (d0 !== null) departs.push({ name: premier, value: d0 });
    if (racineDe(mot) === "signal") {
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
  function lireFichierDeCorps() {
    if (!at(T.IDENT) || !peek(1) || peek(1).type !== T.SLASH) return null;
    if (!peek(2) || peek(2).type !== T.IDENT) return null;
    const tokDebut = current();
    const lib = advance().value;
    advance();
    const fichier = advance().value;
    return { type: "FileDirective", name: lib, fichier, line: tokDebut.line, col: tokDebut.col };
  }
  function lireCorpsApresLeSac() {
    if (!at(T.BACKTICK)) return null;
    const brut = expect(T.BACKTICK).value;
    const { tag, code } = splitBacktickTag(brut);
    return { tag, code };
  }
  function parseDirective() {
    {
      const parLeType = lireDeclarationParLeType();
      if (parLeType) return parLeType;
      const unTerminal = lireDeclarationDeTerminal();
      if (unTerminal) return unTerminal;
      const unFichier = lireFichierDeCorps();
      if (unFichier) return unFichier;
    }
    const tok = current();
    if (at(T.AT)) {
      const apres = peek(1);
      throw new ParseError("PARSE_SIGN_LEFT_LANGUAGE_WRITE", { p1: apres && apres.value ? apres.value : "<directive>" }, tok);
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
    let libDuPrefixe = null;
    if (subkey && directiveDeclareeParLaLibrairie(name, subkey)) {
      libDuPrefixe = name;
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
      throw new ParseError("PARSE_DIRECTIVE_NOM_SIGN_BEEN", { directive, nom }, current());
    }
    if (name === "def" || name === "terminal") {
      const motDeclarant = name;
      if (!ouvreUnNom()) {
        throw new ParseError("PARSE_MOTDECLARANT_MUST_NAME_WHAT", { motDeclarant, p1: JSON.stringify(String(current().value ?? current().type)) }, tok);
      }
      const defName = lireNomDEntree(tok);
      const apresLeNom = current();
      if (motDeclarant === "terminal") refuserEspaceAvantLeSac(`${motDeclarant} ${defName}`, tok);
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
          if (!at(T.IDENT)) throw new ParseError("PARSE_DEF_DEFNAME_NAME_EXPECTED", { defName, cle }, current());
          let val = String(advance().value);
          while ((at(T.IDENT) || at(T.INT)) && !current().spaceBefore) val += String(advance().value);
          if (at(T.PERIOD) && !current().spaceBefore) {
            const suite2 = peek(1);
            const interne = suite2 && suite2.value != null ? String(suite2.value) : null;
            throw new ParseError("PARSE_CLE_VAL_ADDRESSES_CATALOG", { cle, val, p1: interne ? `.${interne}` : "", p2: interne ?? "<entry>", p3: interne ?? "\u2026" }, kTok);
          }
          cles[cle] = { kind: "ref", value: val };
          lu++;
          return;
        }
        if (at(T.COLON) && !current().spaceBefore) {
          advance();
          if (atEnd() || at(T.NEWLINE)) throw new ParseError("PARSE_DEF_DEFNAME_VALUE_EXPECTED", { defName, cle }, current());
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
              throw new ParseError("PARSE_DEF_DEFNAME_TYPED_CODE", { defName, cle }, current());
            }
            if (!PARTIE.has(current().type)) {
              throw new ParseError("PARSE_DEF_DEFNAME_READABLE_VALUE", { defName, p1: current().value ?? current().type, cle }, current());
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
        throw new ParseError("PARSE_DEF_DEFNAME_CLE_NEITHER", { defName, cle }, kTok);
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
      if (at(T.IDENT) && racineDe(current().value) === "signal" && peek(1) && peek(1).type === T.BACKTICK) {
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
      if (at(T.LPAREN)) {
        const reprise = pos;
        advance();
        const params = [];
        while (!at(T.RPAREN) && !atEnd()) {
          while (at(T.NEWLINE) || at(T.COMMENT)) advance();
          if (at(T.RPAREN) || atEnd()) break;
          let j = 1;
          while (peek(j) && (peek(j).type === T.NEWLINE || peek(j).type === T.COMMENT)) j++;
          if (at(T.IDENT) && peek(j) && (peek(j).type === T.COMMA || peek(j).type === T.RPAREN)) params.push(advance().value);
          else if (at(T.COMMA)) advance();
          else {
            params.length = 0;
            break;
          }
        }
        const listeLue = params.length > 0 && at(T.RPAREN);
        const apres = listeLue ? peek(1) : null;
        const unCorpsSuit = apres && apres.type !== T.NEWLINE && apres.type !== T.EOF && apres.type !== T.COMMENT;
        if (!listeLue || !unCorpsSuit) {
          pos = reprise;
        } else {
          expect(T.RPAREN);
          const corps = parseRhsElements();
          if (corps.length === 0) {
            throw new ParseError("PARSE_DEF_DEFNAME_TRANSFORMATION_WITHOUT", { defName, p1: params.join(", ") }, tok);
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
      }
      if (at(T.LPAREN)) {
        refuserEspaceAvantLeSac(`def ${defName}`, tok);
        const sac = parseRuntimeQualifier();
        const corpsApres = lireCorpsApresLeSac();
        return {
          type: "VarDirective",
          names: [defName],
          varType: { kind: "type", type: null },
          ...corpsApres ? { corps: corpsApres } : {},
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
        throw new ParseError("PARSE_TERMINAL_DEFNAME_TERMINAL_DECLARED", { defName }, current());
      }
      if (at(T.IDENT) && !cleEnTete()) {
        const corps = parseRhsElements();
        if (corps.length === 0) {
          throw new ParseError("PARSE_DEF_DEFNAME_EMPTY_STRUCTURE", { defName }, tok);
        }
        const backtick = corps.find((e) => e && typeof e.type === "string" && e.type.includes("Backtick"));
        if (backtick) {
          throw new ParseError("PARSE_DEF_DEFNAME_CARRIES_CODE", { defName }, tok);
        }
        return { type: "DefDirective", name: defName, kind: "structure", body: corps, line: tok.line };
      }
      while (at(T.IDENT)) {
        lireUneCle();
        if (clesParenthesees && at(T.COMMA)) advance();
      }
      if (clesParenthesees) {
        if (!at(T.RPAREN)) {
          throw new ParseError("PARSE_TERMINAL_DEFNAME_BODY_OPENED", { defName }, current());
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
        throw new ParseError("PARSE_DECLARES_NOTHING", {
          // ⚠️ LE NOM CITÉ EST CELUI QUI A ÉTÉ LU, pas celui qui a été écrit. Quand un signe COLLÉ
          // l'a arrêté, le message doit le dire avant tout le reste : sans ça, l'auteur relit sa
          // ligne, y voit son nom entier, et cherche la faute dans le corps.
          arret: apresLeNom && apresLeNom.spaceBefore === false && apresLeNom.type !== T.EOF ? `the name read stops at '${defName}': the sign ${JSON.stringify(String(apresLeNom.value ?? apresLeNom.type))} that follows it does not belong to a name, and what remains does not read as any body. ` : "",
          motDeclarant,
          defName
        }, tok);
      }
      return { type: "DefDirective", name: defName, kind: "terminal", keys: cles, line: tok.line };
    }
    if (name === "init") {
      if (subkey) {
        const forme = formeDuMot("init");
        throw new ParseError("PARSE_INIT_SUBKEY_INIT_WORD", { subkey, p1: forme ? ` \u2014 it is written '${forme}'` : "" }, current());
      }
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
      if (subkey) {
        const forme = formeDuMot("actor");
        throw new ParseError("PARSE_ACTOR_SUBKEY_ACTOR_WORD", { subkey, p1: forme ? ` \u2014 it is written '${forme}'` : "" }, current());
      }
      let actorName = lireNomDEntree(tok);
      refuserEspaceAvantLeSac(`actor ${actorName}`, tok);
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
            if (brut === "") throw new ParseError("PARSE_VALUE_EXPECTED_AFTER_PARAMKEY", { paramKey }, current());
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
          throw new ParseError("PARSE_ACTOR_ACTORNAME_KEY_DOES", { actorName }, current());
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
            const ou = key === "voice" ? ` \u2014 a voice attaches to the TERMINAL, not to the actor` : key === "sound" || key === "sounds" ? ` \u2014 a sound object prototype lives in a library, it is not placed on the actor` : "";
            throw new ParseError("PARSE_KEY_ACTOR_KEY_KEYS", { key, p1: perimee ? " (removed)" : "", ou, p2: [...actorKeysData().valides].join(", ") }, current());
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
              "PARSE_COLON_ON_COMPONENT",
              {
                key,
                canon,
                params: key === "out" ? " with its params in () \u2014 e.g. out.midi(ch:3)" : ""
              },
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
        throw new ParseError("PARSE_ACTOR_ACTORNAME_BODY_OPENED", { actorName }, current());
      }
      if (corpsParenthese) advance();
      if (properties.eval && properties.transport) {
        throw new ParseError("PARSE_ACTOR_ACTORNAME_PRODUCER_EVAL", { actorName, p1: properties.eval }, tok);
      }
      if (properties.transport && (properties.transport.key === "video" || properties.transport.key === "visual")) {
        throw new ParseError("PARSE_ACTOR_ACTORNAME_OUT_DOES", { actorName, p1: properties.transport.key }, tok);
      }
      if (properties.transport && !outChannels().has(properties.transport.key)) {
        throw new ParseError("PARSE_ACTOR_ACTORNAME_OUTPUT_OUTPUT", { actorName, p1: properties.transport.key, p2: [...outChannels()].join(", ") }, tok);
      }
      if (properties.transport && outChannels().has(properties.transport.key) && !writableChannels().has(properties.transport.key)) {
        throw new ParseError("PARSE_ACTOR_ACTORNAME_OUT_REFUSED", { actorName, p1: properties.transport.key }, tok);
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
      throw new ParseError("PARSE_SOUND_REFUSED_DOES_ASSIGN", {}, tok);
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
      const hint = name === "tuning" ? " ; reference frequency \u2192 'diapason:<N>'" : "";
      throw new ParseError("PARSE_NAME_REFUSED_DOES_ASSIGN", { name, hint }, current());
    }
    if (at(T.COLON)) {
      advance();
      ({ value, runtime } = parseDirectiveColonValue(name));
    }
    if (name === "alphabet" && subkey && runtime && !outChannels().has(runtime)) {
      const hint = runtime === "sc" ? ` The old sugar ':sc' (= transport+eval sc) is ABOLISHED \u2014 an eval is declared on an actor ('eval.<X>'); the implicit actor's shorthand names only a channel.` : "";
      throw new ParseError("PARSE_ALPHABET_SUBKEY_RUNTIME_REFUSED", { subkey, runtime, hint }, current());
    }
    if (name === "alphabet" && subkey && runtime && outChannels().has(runtime) && !writableChannels().has(runtime)) {
      throw new ParseError("PARSE_ALPHABET_SUBKEY_RUNTIME_REFUSED_2", { subkey, runtime }, current());
    }
    if (name === "alphabet" && subkey) assertAlphabetVoices(subkey, current());
    let modifiers = null;
    if (name === "mode" && at(T.LPAREN)) {
      advance();
      modifiers = [];
      while (!at(T.RPAREN) && !atEnd()) {
        const tokModName = current();
        const modName = expect(T.IDENT).value;
        const portees = libCtx.portees.get(modName) || null;
        if (!portees) {
          const declarants = librairiesQuiDeclarent(modName);
          throw new ParseError("PARSE_MODE_MODNAME_MODNAME_DECLARED", { p1: runtime || "\u2026", modName, p2: declarants.length ? `invoke at the top the one that carries it (${declarants.map((l) => `'${l}'`).join(" or ")})` : "no library in the registry declares it: remove the word" }, tokModName);
        }
        if (!portees.includes("subgrammar")) {
          throw new ParseError("PARSE_MODNAME_DOES_APPLY_SUB", { modName, p1: JSON.stringify(portees), p2: portees.includes("scene") ? `It is written at the top of the scene: '${modName}'.` : `It is worth ${portees.map((p) => `'${p}'`).join(", ")}.` }, tokModName);
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
        ...libDuPrefixe ? { lib: libDuPrefixe } : {},
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
      ...libDuPrefixe ? { lib: libDuPrefixe } : {},
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
    throw new ParseError("PARSE_VALUE_EXPECTED_AFTER", {}, current());
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
      throw new ParseError("PARSE_MACRO_MACRONAME_PARAMETER_DECLARED", { macroName, p1: unused.join(", ") }, tok);
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
        else throw new ParseError("PARSE_EXPECTED_NUMBER_AFTER_PROP", {}, current());
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
        throw new ParseError("PARSE_EXPECTED_VALUE_INT_FLOAT", {}, current());
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
    let index2 = 1;
    let safety = 0;
    let currentMode = initialMode || null;
    let currentModifiers = initialModifiers || null;
    while (!atEnd()) {
      if (++safety > 200) throw new ParseError("PARSE_SUBGRAMMAR_PARSE_LOOP_SAFETY", {}, current());
      skipNewlines();
      if (atEnd()) break;
      if (atProductionBlock()) {
        throw new ParseError("PARSE_PRODUCTION_BLOCK_ALLOWED_TOP", {}, current());
      }
      if (at(T.BANG) && peek(1).type === T.LBRACKET && peek(2).type === T.AT) {
        throw new ParseError("PARSE_FORM_RESERVED_PRODUCTION_DIRECTIVE", {}, current());
      }
      let blockMode = currentMode;
      let blockModifiers = currentModifiers;
      while (!atEnd() && !at(T.SEPARATOR) && !at(T.NEWLINE) && ligneSansFleche()) {
        if (at(T.IDENT) && current().value === "template") break;
        if (at(T.IDENT) && current().value === "templates") {
          throw new ParseError("PARSE_TEMPLATES_PLURAL_LONGER_EXISTS", {}, current());
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
          const axes = catalogAxisKeys();
          const porteesDuMot = libCtx.portees.get(dirNom) || null;
          if (porteesDuMot && !porteesDuMot.includes("scene") && !axes.has(dirNom)) {
            const PLACE = {
              subgrammar: "at the top of a sub-grammar, in the parenthesis of the mode (`mode:<mode>(<setting>)`)",
              rule: "on a rule",
              group: "on a group",
              symbol: "on an element",
              flow: "in the flow"
            };
            const ou = porteesDuMot.map((x) => PLACE[x] ?? x);
            throw new ParseError("PARSE_DIRNOM_DECLARATION_SETTING_WRITTEN", { dirNom, p1: ou.length === 1 ? ou[0] : ou.slice(0, -1).join(", ") + " or " + ou[ou.length - 1] }, dirTok);
          }
          throw new ParseError("PARSE_DIRNOM_WRITTEN_AFTER_RULES", { dirNom }, dirTok);
        }
        skipNewlines();
      }
      const rules = [];
      let ruleSafety = 0;
      while (!atEnd() && !at(T.SEPARATOR)) {
        if (++ruleSafety > 200) throw new ParseError("PARSE_RULE_PARSE_LOOP_SAFETY", {}, current());
        skipNewlines();
        if (atEnd() || at(T.SEPARATOR)) break;
        if (at(T.IDENT) && current().value === "template") break;
        if (rules.length && ligneSansFleche()) break;
        if (isRuleStart()) {
          const avant = pos;
          try {
            rules.push(parseRule());
            if (!atEnd() && !at(T.NEWLINE) && !at(T.SEPARATOR) && !at(T.COMMENT)) {
              throw new ParseError(
                "PARSE_RULE_LEAVES_A_REMAINDER",
                { reste: String(current().value ?? current().type) },
                current()
              );
            }
          } catch (e) {
            if (!(e instanceof ParseError)) throw e;
            refusDeRegle.push(e);
            const ligneFautive = e.token && e.token.line;
            if (ligneFautive != null) {
              while (!atEnd() && !at(T.SEPARATOR) && current().line <= ligneFautive) advance();
            } else {
              while (!atEnd() && !at(T.NEWLINE) && !at(T.SEPARATOR)) advance();
            }
            if (pos === avant && !atEnd()) advance();
          }
        } else {
          if (!atEnd() && !at(T.SEPARATOR) && !at(T.AT)) {
            throw new ParseError("PARSE_UNRECOGNIZED_LINE_RULE_LEVEL", {}, current());
          }
          break;
        }
        skipNewlines();
      }
      if (rules.length > 0) {
        subs.push({ type: "Subgrammar", index: index2++, rules, mode: blockMode, modifiers: blockModifiers });
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
      throw new ParseError("PARSE_EXPECTED_TEMPLATE", {}, kw);
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
        throw new ParseError("PARSE_TEMPLATE_CATALOG_TRANSPORTED_VERBATIM", {}, ouvre);
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
          throw new ParseError("PARSE_NUMBERED_WILDCARD_MAKES_SENSE", { p1: current().value }, current());
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
    } else throw new ParseError("PARSE_EXPECTED_ARROW_GOT", { p1: current().type }, current());
    const rhs = parseRhsElements();
    if (at(T.COLON) && estNombreDeDuree(peek(1)) && rhs.length > 0) {
      const tokColon = current();
      advance();
      const dur = parseColonFrame(tokColon);
      const inner = rhs.splice(0, rhs.length);
      rhs.push(cadreDuree(dur, inner));
      if (atRhsElementStart()) {
        throw new ParseError("PARSE_DURATION_ISOLATED_FLOW_STICKS", {}, current());
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
    const scanValues = libCtx.controls.scan && libCtx.controls.scan.values || [];
    let ruleMode = null;
    for (const pair of settings ? settings.pairs : []) {
      if (pair.key === "scan" && libCtx.controls.scan && scanValues.includes(pair.value)) {
        ruleMode = pair.value;
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
        ...diagnostic(
          "PARSE_TEMPLATE_ANCHORS_ASYMMETRIC",
          { gauche: countAnchorsLhs, droite: countAnchorsRhs },
          { line: tok.line }
        )
      });
    }
    return { type: "Rule", guard, contexts, lhs, arrow, rhs, flags, qualifiers, settings, mode: ruleMode, line: tok.line, warnings };
  }
  const estProcedureNue = (mot) => libCtx.ruleScopeControls.has(mot);
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
        else throw new ParseError("PARSE_EXPECTED_FLAG_VALUE", {}, current());
      } else if (at(T.PLUS)) {
        operator = "+";
        advance();
        if (at(T.INT)) value = Number(advance().value);
        else if (at(T.IDENT)) value = advance().value;
        else throw new ParseError("PARSE_EXPECTED_FLAG_VALUE_2", {}, current());
      } else if (at(T.REST)) {
        operator = "-";
        advance();
        if (at(T.INT)) value = Number(advance().value);
        else if (at(T.IDENT)) value = advance().value;
        else throw new ParseError("PARSE_EXPECTED_FLAG_VALUE_3", {}, current());
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
        throw new ParseError("PARSE_GUARD_FLAG_MUTATION_WRITTEN", { flag }, current());
      } else {
        result = { type: "Guard", flag, operator: null, value: null, mutates: false };
        expect(T.RBRACKET);
        return result;
      }
      let value;
      if (at(T.INT)) value = Number(advance().value);
      else if (at(T.IDENT)) value = advance().value;
      else throw new ParseError("PARSE_EXPECTED_VALUE_AFTER_OPERATOR", {}, current());
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
          throw new ParseError("PARSE_CONTEXT_PLACED_EXTREMITIES_LEFT", { p1: elements.length }, current());
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
          throw new ParseError("PARSE_STUCK_IDENTIFIER_FORBIDDEN_LHS", {}, dollarTok);
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
      if (++safety > 500) throw new ParseError("PARSE_RHS_PARSE_LOOP_SAFETY", {}, current());
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
      throw new ParseError("PARSE_MALFORMED_INTERVAL_CTRLNAME_EXPECTED", { ctrlName, p1: why ? ": " + why : "" }, startTok);
    };
    let neg = "";
    if (at(T.REST)) {
      advance();
      neg = "-";
    }
    if (at(T.STRING)) {
      throw new ParseError("PARSE_INTERVAL_QUOTES_SUPPORTED_CTRLNAME", { ctrlName, p1: current().value }, startTok);
    }
    if (!at(T.INT) && !at(T.FLOAT)) bad(`'${current().value ?? current().type}' is not a number`);
    const a = advance().value;
    if (at(T.SLASH)) {
      if (neg) bad("a fraction is not written negative (use cents instead: -700c)");
      advance();
      if (!at(T.INT)) bad("fraction denominator missing");
      const b = advance().value;
      return `${a}/${b}`;
    }
    if (at(T.IDENT) && current().value === "c") {
      advance();
      return `${neg}${a}c`;
    }
    if (at(T.IDENT)) bad(`unknown unit '${current().value}' (cents are written 700c)`);
    return `${neg}${a}`;
  }
  function refuserEspaceAvantLeSac(nomDeclare, tokenDuNom) {
    if (!at(T.LPAREN) || current().spaceBefore !== true) return;
    throw new ParseError("PARSE_NOMDECLARE_SPACE_BETWEEN_DECLARED", { nomDeclare }, current());
  }
  function parseRuntimeQualifier({ imbrique = false } = {}) {
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
        throw new ParseError("PARSE_SIGN_READABLE_MEMBER_MEMBER", { p1: peek(k).value ?? peek(k).type, p2: pairs.map((p) => p.key).join(", ") }, peek(k));
      }
      throw new ParseError("PARSE_TERMS_SEPARATED_SPACE_BEFORE", { p1: pairs.map((p) => p.key).join(", "), p2: peek(k).value ?? "" }, peek(k));
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
      if (enDeclaratif && !imbrique && at(T.IDENT) && current().spaceBefore && prototypesDeclares.has(key)) {
        const type = key;
        key = advance().value;
        const pos3 = { line: keyTok.line, col: keyTok.col };
        const valeur = at(T.LPAREN) && !current().spaceBefore ? parseRuntimeQualifier({ imbrique: true }) : true;
        pairs.push({ key, type, value: valeur, ...subject !== null ? { subject } : {}, ...pos3 });
        finirTerme();
        continue;
      }
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
        pairs.push({ key, value: parseRuntimeQualifier({ imbrique: true }), ...sub, ...pos2 });
        finirTerme();
        continue;
      }
      if (at(T.PERIOD) && libCtx.componentControls.has(key)) {
        advance();
        if (!at(T.INT)) {
          throw new ParseError("PARSE_KEY_NAMES_NUMBERED_COMPONENT", { key, p1: current().value }, current());
        }
        const component = Number(advance().value);
        if (!at(T.COLON)) {
          throw new ParseError("PARSE_KEY_COMPONENT_NAMES_COMPONENT", { key, component }, current());
        }
        advance();
        if (current().spaceBefore) {
          throw new ParseError("PARSE_KEY_COMPONENT_SPACE_AFTER", { key, component, p1: current().value }, current());
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
          throw new ParseError("PARSE_KEY_COMPOSANT_SPACE_AFTER", { key, composant, p1: current().value }, current());
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
            throw new ParseError("PARSE_KEY_COMPOSANT_COMPOSANT_SCENE", { key, composant }, keyTok);
          }
          throw new ParseError("PARSE_KEY_COMPOSANT_LIBRARY_KEY", { key, composant }, keyTok);
        }
        const motsInvoques2 = /* @__PURE__ */ new Set();
        for (const [fichier, lib] of Object.entries(libCtx._libs || {})) {
          motsInvoques2.add(fichier);
          if (lib && typeof lib.resolves === "string" && lib.resolves) motsInvoques2.add(lib.resolves);
        }
        if (motsInvoques2.has(key)) {
          throw new ParseError("PARSE_KEY_COMPOSANT_LIBRARY_KEY_2", { key, composant }, keyTok);
        }
        throw new ParseError("PARSE_KEY_COMPOSANT_ASSIGNS_VALUE", { key, composant }, keyTok);
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
          throw new ParseError("PARSE_KEY_SPACE_AFTER_COLON", { key, p1: current().value }, current());
        }
        const specReglage = libCtx.controls[key];
        const reglageMultiPartie = specReglage && Array.isArray(specReglage.args) && specReglage.args.length > 1;
        if (libCtx.qualifierKeys.has(key) && !reglageMultiPartie) {
          const { value, decrement } = readQualifierValue();
          if (value === void 0) {
            const exemple = specReglage && Array.isArray(specReglage.values) && specReglage.values[0] || "\u2026";
            throw new ParseError("PARSE_KEY_ASSIGNS_VALUE_COLON", { key, exemple }, keyTok);
          }
          if (at(T.IDENT) && peek(1).type === T.COLON) {
            throw new ParseError("PARSE_KEY_ELEMENTS_BAG_SEPARATED", { key, p1: current().value }, current());
          }
          pairs.push({ key, value, decrement, ...sub, ...pos2 });
          finirTerme();
          continue;
        }
        if (libCtx.intervalControls.has(key)) {
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
        let sautDeLigne = false;
        while (!at(T.RPAREN) && !at(T.COMMA) && !atEnd()) {
          if (at(T.NEWLINE) || at(T.COMMENT)) {
            sautDeLigne = true;
            advance();
            continue;
          }
          if (monoPartie && parts.length > 0 && at(T.IDENT) && libCtx.controlNames.has(current().value)) {
            elementAvale = current();
            break;
          }
          if (at(T.COLON) && !deuxPointsEnTrop) deuxPointsEnTrop = current();
          if (parts.length > 0 && (current().spaceBefore || sautDeLigne)) {
            if (enDeclaratif) {
              throw new ParseError("PARSE_KEY_DECLARATIVE_PART_COMMA", { key, p1: parts.join(""), p2: current().value }, current());
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
          throw new ParseError("PARSE_KEY_BRUT_BRUT_LEFT", { key, brut }, current());
        }
        if (elementAvale) {
          throw new ParseError("PARSE_KEY_BRUT_KEY_EXPECTS", { key, brut, p1: elementAvale.value }, elementAvale);
        }
        if (deuxPointsEnTrop) {
          throw new ParseError("PARSE_KEY_BRUT_COLON_ASSIGNS", { key, brut, p1: brut.split(":")[0], p2: brut.split(":").slice(1).join(":") }, deuxPointsEnTrop);
        }
        if (jetons === 0) {
          throw new ParseError("PARSE_KEY_ASSIGNS_VALUE_COLON_2", { key }, keyTok);
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
          throw new ParseError("PARSE_KEY_BRUT_KEY_TAKES", { key, brut }, keyTok);
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
    throw new ParseError("PARSE_SUFFIX_NOM_ATTACHED_ELEMENT", { nom }, current());
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
        throw new ParseError("PARSE_NATIVE_UNDERSCORE_FORM", {
          nom,
          cle,
          renomme: renomme ? ` (the native "_${nom}" is called "${cle}" in BPScript, and the key "${nom}" designates a DIFFERENT gesture)` : ""
        }, peek(1));
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
      throw new ParseError("PARSE_EXPECTED_SYMBOL_AFTER", {}, tok);
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
          throw new ParseError("PARSE_ATTACHED_TERM_CARRIES_CONJOINT", { p1: peek(1).type === T.STAR ? "*N/M" : "/N" }, current());
        }
        return { type: "InstantControl", qualifier: parseVitesseParenthese(), conjoint: false };
      }
      if (sacBienForme()) {
        return { type: "InstantControl", qualifier: parseRuntimeQualifier(), conjoint: collated };
      }
      if (at(T.LBRACKET) && peek(1).type === T.IDENT) {
        const nom = peek(1).value;
        const CROCHET_EN_FLUX = /* @__PURE__ */ new Set(["seed"]);
        if (CROCHET_EN_FLUX.has(nom) && !libCtx.portees.has(nom) && !motReserve(nom)) {
          const declarants = librairiesQuiDeclarent(nom);
          throw new ParseError(
            declarants.length ? "PARSE_FLOW_WORD_NOT_IN_SCOPE" : "PARSE_FLOW_WORD_UNDECLARED",
            { nom, declarants: declarants.map((l) => `'${l}'`).join(" or ") },
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
          throw new ParseError("PARSE_SEED_SEEDING_FLOW_WRITTEN", {}, ouvre);
        }
        throw new ParseError("PARSE_NOM_SEEDING_MAKES_SENSE", { nom }, ouvre);
      }
      if (at(T.LBRACKET)) {
        const q = parseQualifier("relative");
        const procedure = (q.pairs || []).find((p) => p && libCtx.ruleScopeControls.has(p.key));
        if (procedure) {
          throw new ParseError("PARSE_RULE_LEVEL_PROCEDURE_PLACED", { p1: procedure.key, p2: procedure.value === true ? "\u2026" : procedure.value }, current());
        }
        throw new ParseError("PARSE_BRACKET_PLACED_FLOW_BRACKET", {}, current());
      }
      if (at(T.IDENT)) {
        const name = advance().value;
        return { type: "OutTimeObject", name };
      }
      throw new ParseError("PARSE_EXPECTED_SYMBOL_AFTER_2", {}, current());
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
        throw new ParseError("PARSE_CALL_FORM_DOES_NOT_EXIST", paramsFormeAppel(name), tok);
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
        const places2 = listePortees.map((p) => OU[p] || p);
        const commentEcrire = listePortees.includes("flow") ? `\xE9crire '!(${name})' pour le poser au fil de la s\xE9quence` : places2.length ? `its declaration gives it only ${places2.length > 1 ? "these places" : "this place"}: ${places2.join(", ")}` : `its declaration gives it no place in a rule`;
        throw new ParseError("PARSE_NAME_BARE_FORM_FLOW", { name, commentEcrire }, tok);
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
          if (isControlName(name)) throw new ParseError("PARSE_CALL_FORM_DOES_NOT_EXIST", paramsFormeAppel(name), tok);
          throw new ParseError("PARSE_NAME_READABLE_NEITHER_SETTING", { name, p1: texteDuSac() }, tok);
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
        throw new ParseError("PARSE_CALL_FORM_DOES_NOT_EXIST", paramsFormeAppel(name), tok);
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
  function paramsFormeAppel(name) {
    const moteur = libCtx.bp3NativeControls && libCtx.bp3NativeControls.has(name) && !(libCtx.dispatcherOnlyControls && libCtx.dispatcherOnlyControls.has(name));
    return {
      name,
      sac: texteDuSac(),
      flux: moteur ? `![${name}:\u2026]` : `!(${name}:\u2026)`,
      contenance: moteur ? `[${name}:\u2026]` : `(${name}:\u2026)`
    };
  }
  function isControlName(name) {
    return libCtx.controlNames.has(name);
  }
  function refuserCrochetColle() {
    parseQualifier();
    throw new ParseError("PARSE_BRACKET_ATTACHED_ELEMENT_LONGER", {}, current());
  }
  function refuserSecondSac(rang, el) {
    if (rang < 2) return;
    const nom = el && (el.name || el.symbol) ? `'${el.name || el.symbol}'` : "this element";
    throw new ParseError("PARSE_NOM_CARRIES_ATTACHED_SETTING", { nom }, current());
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
      const intervalHere = key && libCtx.intervalControls.has(key) || !key && libCtx.intervalControls.has(name);
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
        throw new ParseError("PARSE_EXPECTED_ARGUMENT_VALUE_NAME", { name }, current());
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
    if (libCtx.intervalControls.has(name)) {
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
            throw new ParseError("PARSE_MALFORMED_CONTROL_ARGUMENT_NAME", { name, arg, p1: t.value }, t);
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
            throw new ParseError("PARSE_UNEXPECTED_TOKEN_CONTROL_ARGS", { p1: t.type, p2: t.value }, t);
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
      throw new ParseError("PARSE_EXPECTED_SYMBOL_AFTER_3", {}, current());
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
        throw new ParseError("PARSE_NUM_DEN_NUMBERS_TOUCH", { num, den, p1: String(den).slice(0, 1) }, current());
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
    throw new ParseError("PARSE_NAME_NAME_BETWEEN_BARS", { name }, tok);
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
        throw new ParseError("PARSE_SIGIL_NOM_PLACE_ARGUMENTS", { sigil, nom, p1: current().value, p2: key || "key" }, current());
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
      throw new ParseError("PARSE_NOTHING_COMES_BETWEEN_WAIT", { p1: current().value }, current());
    }
    const name = expect(T.IDENT).value;
    let address = null;
    const colle = at(T.PERIOD) && !current().spaceBefore;
    if (colle && (peek(1).type === T.IDENT || peek(1).type === T.INT) && !peek(1).spaceBefore) {
      advance();
      const jeton = advance();
      address = jeton.type === T.INT ? Number(jeton.value) : jeton.value;
      if ((at(T.IDENT) || at(T.INT)) && !current().spaceBefore) {
        throw new ParseError("PARSE_NAME_ADDRESS_FOLLOWED_SEPARATOR", { name, p1: jeton.value, p2: current().value }, current());
      }
    } else if (colle) {
      throw new ParseError("PARSE_NAME_FOLLOWED_ADDRESS_ADDRESS", { name, p1: peek(1).value ?? peek(1).type }, current());
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
    throw new ParseError("PARSE_KEY_KEY_WRITTEN_RULE", { p1: signeOuvrant === "[" ? "[" : "(", key, p2: signeOuvrant === "[" ? "]" : ")" }, tok);
  }
  function checkQualifierKey(key, tok) {
    refuserTempx(key, tok, "[");
    if (key === "speed") {
      throw new ParseError("PARSE_SPEED_BEEN_REMOVED_DURATION", {}, tok);
    }
    if (key === "shuffle") {
      throw new ParseError("PARSE_SHUFFLE_REMOVED_SEED_WRITTEN", {}, tok);
    }
    if (libCtx.qualifierKeys.has(key)) {
      throw new ParseError("PARSE_KEY_KEY_SETTING_WRITTEN", { key }, tok);
    }
    if (libCtx.runtimeBagControls.has(key)) {
      const valeurNumerique = (at(T.INT) || at(T.FLOAT)) && (peek(1).type === T.RBRACKET || peek(1).type === T.COMMA || peek(1).type === T.SLASH);
      if (key === "scale" && valeurNumerique) {
        throw new ParseError("PARSE_SCALE_BEEN_REMOVED_TEMPORAL", {}, tok);
      }
      throw new ParseError("PARSE_KEY_KEY_RUNTIME_CONTROL", { key }, tok);
    }
    if (libCtx.controlNames.has(key)) {
      if (libCtx.ruleScopeControls.has(key)) return;
      if (!libCtx.ruleAllowedControls.has(key)) return;
      throw new ParseError("PARSE_KEY_BRACKET_CARRIES_WHAT", { key }, tok);
    }
    return;
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
      throw new ParseError("PARSE_OPERATOR_EXPECTS_NUMBER_FRACTION", { operator }, current());
    }
    expect(T.RPAREN);
    return { type: "Qualifier", pairs: [], tempoOp: { type: "TempoOp", operator, value, scope: "relative" } };
  }
  function parseQualifier(tempoScope = "absolute") {
    expect(T.LBRACKET);
    if (atAny(T.SLASH, T.STAR)) {
      const signe = at(T.STAR) ? "*" : "/";
      throw new ParseError("PARSE_SIGNE_SPEED_OPERATOR_WRITTEN", { signe }, current());
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
        throw new ParseError("PARSE_KEY_SPACE_AFTER_COLON_2", { key, p1: current().value }, current());
      }
      void apresDeuxPoints;
      if (libCtx.controlNames.has(key)) {
        let rawValue = "";
        while (!at(T.RBRACKET) && !atEnd()) {
          if (at(T.COMMA)) {
            const suite2 = peek(1);
            const ouvreUnElement = suite2.type === T.IDENT && (peek(2).type === T.COLON || peek(2).type === T.RBRACKET || peek(2).type === T.COMMA);
            if (!ouvreUnElement) {
              throw new ParseError("PARSE_KEY_COMMA_SEPARATES_ELEMENTS", { key, p1: rawValue.trim() }, current());
            }
            break;
          }
          const t = current();
          if (t.type === T.COLON) {
            throw new ParseError("PARSE_KEY_COLON_ASSIGNS_VALUE", { key, p1: rawValue.trim() }, t);
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
          throw new ParseError("PARSE_KEY_ASSIGNS_VALUE_COLON_3", { key }, keyTok);
        }
        pairs.push({ type: "QualPair", key, value: rawValue, decrement: null });
        if (at(T.COMMA)) advance();
        continue;
      }
      const gardeElement = () => {
        if (at(T.IDENT) && peek(1).type === T.COLON) {
          throw new ParseError("PARSE_KEY_ELEMENTS_BAG_SEPARATED_2", { key, p1: current().value }, current());
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
  const livrerLesRefus = () => {
    if (typeof opts.onError === "function") for (const e of refusDeRegle) opts.onError(e);
  };
  let arbre;
  try {
    arbre = parseScene();
  } catch (e) {
    livrerLesRefus();
    throw e;
  }
  if (refusDeRegle.length) {
    if (typeof opts.onError === "function") livrerLesRefus();
    else throw refusDeRegle[0];
  }
  return arbre;
}

export {
  brancherLeCompilateur,
  versionDuRegistre,
  leRegistre,
  universeControlNames,
  loadLib,
  librairiesQuiDeclarent,
  groupeDUnicite,
  resolveActorAlphabet,
  resolveActorAlphabetSource,
  nomsDeTerminaux,
  loadLibsFromDirectives,
  familles,
  famille,
  objet,
  objets,
  formeDuMot,
  motReserve,
  clesDActeur,
  canaux,
  lesDefauts,
  motsInvoques,
  describeVocabulary,
  ParseError,
  parse
};
