import {
  T
} from "./chunk-HYO3M635.js";
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
var SOURCES = [{ "nom": "alphabets", "format": "bpsl", "texte": `types

// @documented
def alphabets(resolvedBy:Kairos, resolves:alphabet)

alphabet western(
  description:"Western chromatic \u2014 7 natural notes, 5 alteration levels",
  runtime:audio,
  tuning:western_12TET,
  octaves:western,
  diapason:440,
  resolvesPitch:true,
  alterations(bb:-2, b:-1, "":0, "#":1, "##":2),
  baseNote:A,
  baseRegister:"4",
  terminals(C(), D(), E(), F(), G(), A(), B())
)

alphabet sargam(
  description:"Indian sargam \u2014 7 svaras",
  runtime:audio,
  tuning:sargam_12TET,
  octaves:saptak,
  diapason:240,
  resolvesPitch:true,
  alterations(komal:-1, "":0, tivra:1),
  baseNote:sa,
  baseRegister:madhya,
  terminals(sa(), re(), ga(), ma(), pa(), dha(), ni())
)

alphabet bp3_indian(
  description:"Sargam TEL QUE LE MOTEUR BP3 NATIF le nomme (convention de notes INDIAN) \u2014 alphabet de test BP3, \xE0 c\xF4t\xE9 des autres (arbitrage Romain 2026-07-19)",
  runtime:audio,
  tuning:bp3_indian_12TET,
  octaves:bp3,
  diapason:440,
  resolvesPitch:true,
  alterations(k:-1, "":0, "#":1),
  baseNote:dha,
  baseRegister:"4",
  terminals(sa(), re(), ga(), ma(), pa(), dha(), ni())
)

alphabet bp3_english(
  description:"Convention de notes ENGLISH du moteur BP3 natif \u2014 alphabet de test BP3, \xE0 c\xF4t\xE9 des autres (d\xE9cision Romain 2026-07-29 : la m\xE9canique n'utilise que des alphabets)",
  runtime:audio,
  tuning:bp3_english_12TET,
  octaves:bp3,
  diapason:440,
  resolvesPitch:true,
  alterations(b:-1, "":0, "#":1),
  baseNote:A,
  baseRegister:"4",
  terminals(C(), D(), E(), F(), G(), A(), B())
)

alphabet bp3_fr(
  description:"Convention de notes FRENCH du moteur BP3 natif \u2014 alphabet de test BP3, \xE0 c\xF4t\xE9 des autres (d\xE9cision Romain 2026-07-29)",
  runtime:audio,
  tuning:bp3_fr_12TET,
  octaves:bp3_fr,
  diapason:440,
  resolvesPitch:true,
  alterations(b:-1, "":0, "#":1),
  baseNote:la,
  baseRegister:"3",
  terminals(do(), re(), mi(), fa(), sol(), la(), si())
)

alphabet solfege(
  description:"Solf\xE8ge latin \u2014 do r\xE9 mi fa sol la si",
  runtime:audio,
  tuning:solfege_12TET,
  octaves:western,
  diapason:440,
  resolvesPitch:true,
  alterations(bb:-2, b:-1, "":0, "#":1, "##":2),
  baseNote:la,
  baseRegister:"4",
  terminals(do(), re(), mi(), fa(), sol(), la(), si())
)

alphabet arabic(
  description:"Arabic \u2014 7 perde (noms de degr\xE9s) with quarter-tone alterations. rast\u2248do, sikah=tierce neutre, awj=septi\xE8me neutre.",
  runtime:audio,
  tuning:arabic_24TET,
  diapason:440,
  resolvesPitch:true,
  alterations(bb:-4, b:-2, half_b:-1, "":0, "half_#":1, "#":2, "##":4),
  baseNote:husayni,
  terminals(rast(), dukah(), sikah(), jaharkah(), nawa(), husayni(), awj())
)

alphabet turkish(
  description:"Turkish makam \u2014 note names from Ottoman/Turkish tradition",
  runtime:audio,
  tuning:turkish_53TET,
  octaves:turkish,
  diapason:440,
  resolvesPitch:true,
  alterations(bakiye:4, kucuk_mucenneb:5, "":0, buyuk_mucenneb:8, tanini:9),
  baseNote:neva,
  baseRegister:"",
  terminals(
    kaba_cargah(),
    yegah(),
    huseyni_asiran(),
    acem_asiran(),
    irak(),
    rast(),
    dugah(),
    segah(),
    buselik(),
    cargah(),
    neva(),
    huseyni(),
    acem(),
    evic(),
    mahur(),
    gerdaniye()
  )
)

alphabet gamelan_pelog(
  description:"Javanese gamelan pelog \u2014 7 tones",
  runtime:audio,
  tuning:gamelan_pelog,
  diapason:282,
  resolvesPitch:true,
  alterations(),
  baseNote:nem,
  terminals(nem(), barang(), bem(), gulu(), lima(), enam(), pitu())
)

alphabet gamelan_slendro(
  description:"Javanese gamelan slendro \u2014 5 tones",
  runtime:audio,
  tuning:gamelan_slendro,
  diapason:282,
  resolvesPitch:true,
  alterations(),
  baseNote:nem,
  terminals(nem(), barang(), gulu(), dada(), lima())
)

alphabet shakuhachi(
  description:"Shakuhachi \u2014 5 base fingerings (Kinko-ry\u016B)",
  runtime:audio,
  tuning:shakuhachi_12TET,
  octaves:shakuhachi,
  diapason:293.66,
  resolvesPitch:true,
  alterations(meri:-1, "":0, kari:1),
  baseNote:ro,
  baseRegister:otsu,
  terminals(ro(), tsu(), re(), chi(), ri())
)

alphabet bohlen_pierce(
  description:"Bohlen-Pierce \u2014 13 pitch classes in a tritave",
  runtime:audio,
  tuning:bohlen_pierce_equal,
  diapason:440,
  resolvesPitch:true,
  alterations(),
  baseNote:C,
  terminals(C(), Db(), D(), E(), F(), Gb(), G(), H(), Jb(), J(), A(), Bb(), B())
)

alphabet tabla(
  description:"Bols de tabla \u2014 les syllabes ATOMIQUES, celles qu'aucune autre ne compose",
  runtime:audio,
  resolvesPitch:false,
  alterations(),
  terminals(
    dha(voice:bayan_open),
    ta(voice:dayan_tap),
    dhin(voice:bayan_open),
    tin(voice:dayan_ring),
    dhee(),
    tee(voice:dayan_open),
    ge(voice:bayan_open),
    ke(voice:bayan_muted),
    ra(),
    tr(),
    kt(voice:dayan_dry),
    ti(voice:dayan_tap),
    ne(),
    na(voice:dayan_ring),
    tk(),
    dhr(),
    ng(),
    gr(),
    te(),
    tt(),
    ki(),
    ka(voice:bayan_muted)
  )
)

alphabet simple(
  description:"Abstract symbols \u2014 single lowercase letters, no pitch. For structural test scenes.",
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
    Z(),
    filler(),
    b1(),
    c1(),
    d1()
  )
)

alphabet shruti23(
  description:"22-shruti nomm\xE9 BP3 \u2014 23 degr\xE9s microtonaux (sa, r1..r4, g1..g4, m1, m2, m3p1, m4p2, p3, p4, d1..d4, n1..n4). Noms verbatim de -to.tryShruti, tonique sa.",
  runtime:audio,
  tuning:shruti23_native,
  octaves:saptak_us,
  diapason:261.625,
  resolvesPitch:true,
  alterations("":0),
  baseNote:sa,
  baseRegister:"4",
  terminals(
    sa(),
    r1(),
    r2(),
    r3(),
    r4(),
    g1(),
    g2(),
    g3(),
    g4(),
    m1(),
    m2(),
    m3p1(),
    m4p2(),
    p3(),
    p4(),
    d1(),
    d2(),
    d3(),
    d4(),
    n1(),
    n2(),
    n3(),
    n4()
  )
)

alphabet tryCsoundObjects(
  description:"Objets sonores Csound de la grammaire de test tryCsoundObjects (sans hauteur)",
  runtime:audio,
  resolvesPitch:false,
  alterations(),
  terminals(
    a(voice:dummy_csound_a),
    b(voice:dummy_csound_b),
    c(voice:dummy_csound_c),
    d(voice:dummy_csound_d),
    e(voice:dummy_csound_e),
    f(voice:dummy_csound_f),
    midiobject(voice:dummy_csound_midiobject)
  )
)
`, "fichier": "alphabets.bpsl" }, { "nom": "audio", "format": "bpsl", "texte": `types

// @documented
def audio(
  resolves:audio,
  name:audio,
  resolvedBy:"runtime-audio",
  description:"Contr\xF4les sp\xE9cifiques au transport Web Audio \u2014 match EXACT LIBRAIRIES.md:173.",
  section:controls
)

control wave(
  args(type),
  values(sine, triangle, square, sawtooth),
  value:triangle,
  description:"Oscillator waveform (Web Audio)",
  scope(symbol, group, rule, flow),
  transportGroup:audio
)

control attack(
  args(ms),
  range(1, 5000),
  unit:"ms",
  value:20,
  description:"Envelope attack in ms (Web Audio)",
  scope(symbol, group, rule, flow),
  transportGroup:audio
)

control release(
  args(ms),
  range(1, 5000),
  unit:"ms",
  value:100,
  description:"Envelope release in ms (Web Audio)",
  scope(symbol, group, rule, flow),
  transportGroup:audio
)

control detune(
  args(cents),
  range(-1200, 1200),
  unit:"cents",
  value:0,
  description:"Detune in cents (Web Audio)",
  scope(symbol, group, rule, flow),
  transportGroup:audio
)

control filter(
  args(freq),
  range(20, 20000),
  unit:"Hz",
  value:20000,
  description:"Lowpass filter cutoff Hz (Web Audio)",
  scope(symbol, group, rule, flow),
  transportGroup:audio
)

control filterQ(
  args(value),
  range(0, 30),
  value:1,
  description:"Filter resonance Q (Web Audio)",
  scope(symbol, group, rule, flow),
  transportGroup:audio
)

control volume(
  implements:expression.volume,
  args(value),
  range(0, 127),
  description:"Gain d'acteur \u2014 un \xE9tage permanent entre les voix d'un acteur et le ma\xEEtre. Le runtime audio convertit cette valeur en gain lin\xE9aire.",
  scope(symbol, group, rule, flow, scene),
  transportGroup:audio
)
`, "fichier": "audio.bpsl" }, { "nom": "core", "format": "bpsl", "texte": 'expression\nmidi\naudio\ntranspo\nengine\ntime\nvariation\neval\nmidi_default\n\n// @documented\ndef core(\n  resolves:core,\n  name:core,\n  description:"BPscript core \u2014 silences, prolongation, contr\xF4les moteur, SOCLE des d\xE9fauts de sc\xE8ne",\n  version:"0.2.0",\n  symbols(),\n  section:defaults\n)\n\ndef components(alphabet:western, tuning:western_12TET, transport:audio, eval:js)\n\ndef values(\n  diapason(\n    range(16, 8000),\n    unit:Hz,\n    overriddenBy(tuning.diapason, alphabet.diapason),\n    description:"Hauteur de r\xE9f\xE9rence (Hz). Le d\xE9faut vient du champ `diapason` de l\'ALPHABET EFFECTIF (acteur ?? sc\xE8ne `alphabet.X` ?? alphabet par d\xE9faut `core`, `components.alphabet`) \u2014 l\'ancre est une propri\xE9t\xE9 du syst\xE8me de notes, pas de l\'accordage (cf. SCENE_DEFAULTS_CASCADE.md). Surchargeable par `diapason:N` en t\xEAte de sc\xE8ne, ou `(diapason:N)` sur une occurrence. Si l\'alphabet n\'est pas r\xE9solu, la valeur reste ABSENTE (l\'aval r\xE9sout)."\n  )\n)\n\ndef on_fail(\n  section:settings,\n  type:directive,\n  values("skip", "retry", "fallback"),\n  value:skip,\n  description:"Gestion d\'\xE9chec de d\xE9rivation"\n)\n', "fichier": "core.bpsl" }, { "nom": "engine", "format": "bpsl", "texte": `types

// @documented
def engine(
  resolves:engine,
  resolvedBy:"BPx",
  name:engine,
  description:"Les cl\xE9s que le MOTEUR DE D\xC9RIVATION consomme \u2014 ce qui gouverne comment la production se d\xE9roule, par opposition \xE0 ce qu'elle produit. Librairie d'EN-T\xCATE, r\xE9solue par BPx.",
  version:1.0.0
)

control srand(
  bp3:_srand,
  bpscript:false,
  args(seed),
  description:"Geste NATIF : reamorce le generateur aleatoire EN COURS de derivation. \u26A0\uFE0F BPScript PORTE CE GESTE, contrairement a ce que ce champ a affirme jusqu au 2026-08-13 : la re-semence en flux s ecrit ![seed:42] (nee le 2026-08-10, commit 750d457, qui lui a retire son arobase). Mesure : elle compile et atteint l arbre en InstantControl porteur de flux:true, distincte du reglage de scene seed:42. La prose disait ici que BPScript n exposait que la graine de scene, qui  n est pas le meme geste  -- c etait FAUX, et cette phrase est la raison pour laquelle ce mot est reste hors du vocabulaire. Le champ bpscript n est PAS touche : declarer un mot du langage est un arbitrage de Romain, jamais une consequence de ma mesure.",
  section:controls
)
control print(
  bp3:_print,
  bpscript:false,
  description:"Geste NATIF : affiche la chaine de travail dans la fenetre de trace du moteur d origine. BPScript n a pas cette fenetre et n a aucune raison d exposer le mot ; il est declare pour que le frontal BP3 puisse router les grammaires qui l ecrivent.",
  section:controls
)

control mode(
  args(mode),
  values(rnd, ord, sub, sub1, lin, tem, poslong),
  value:ord,
  description:"Mode de derivation du bloc/sous-grammaire (rnd, ord, sub, sub1, lin, tem, poslong) -- defaut : ord.",
  scope(subgrammar),
  section:engine
)
control scan(
  args(direction),
  values(left, right, rnd),
  value:rnd,
  description:"Sens du parcours par regle (left, right, rnd) -- defaut : rnd.",
  scope(scene, rule),
  section:engine
)
control weight(
  args(value),
  description:"Poids de la regle -- un entier, 'inf' pour la priorite absolue, ou un K-param.",
  scope(rule),
  section:engine
)
control resetweights(
  bp3:ResetWeights,
  bp3value:1,
  description:"Les poids des regles repartent de leur valeur ecrite dans la grammaire. Image de ResetWeights au moteur natif.",
  scope(scene),
  section:engine
)
control keepweights(
  bp3:ResetWeights,
  bp3value:0,
  description:"Les poids des regles gardent la valeur ou la derivation les a laisses. Image de ResetWeights au moteur natif.",
  scope(scene),
  section:engine
)
control on_fail(
  args(strategy),
  value:skip,
  description:"Gestion d'echec de derivation (skip, retry(N), fallback(X)) -- defaut : skip. PAS de 'values' enum (contrairement a mode/scan) : retry/fallback prennent un ARGUMENT ('retry(2)', 'fallback(Autre)'), que le validateur enum (controlValidation.js, comparaison EXACTE) rejetterait -- mesure par vocabulaire_appels.mjs section 2quinquies bis.",
  scope(scene, rule),
  section:engine
)
control meter(
  args(signature),
  description:"Signature rythmique -- (meter:7/8), (meter:4+4/4).",
  scope(scene, rule),
  section:engine
)
control repeat(
  bp3:_repeat,
  scope(rule),
  args(expr),
  description:"Controlled repetition. expr = K-param or K-param=value.",
  section:engine
)
control failed(
  bp3:_failed,
  scope(rule),
  args(subgrammar, rule),
  description:"Jump on derivation failure.",
  section:engine
)
control stop(bp3:_stop, scope(rule), description:"Stop derivation.", section:engine)
control goto(
  bp3:_goto,
  scope(rule),
  args(subgrammar, rule),
  description:"Jump to specific subgrammar and rule.",
  section:engine
)
control retro(
  bp3:_retro,
  scope(flow),
  description:"Retrograde \u2014 reverse element order. PORTEE flow UNIQUEMENT : le marqueur agit sur ce qui SUIT. Mesure du moteur d origine (Zouleb.c:95-175, BPx 2026-08-09) : sur un outil seriel il avance APRES le marqueur et prend pour cible la suite, et sa boucle s arrete net sur une fermante \u2014 aucune branche ne regarde en arriere. La forme collee apres une fermante etait donc acceptee et SILENCIEUSEMENT INERTE.",
  section:engine
)
control shuffle(
  bp3:_rndseq,
  args(seed),
  scope(flow),
  description:"Shuffle \u2014 random reordering of sequence elements. seed arg \u2192 _srand(N) prefix. PORTEE flow UNIQUEMENT : voir retro. Corpus mesure : 32 occurrences de l outil AVANT un bloc contre 2 apres une fermante, et ces 2 portent sur la suite (S --> a b {_retro c d e} _retro f g).",
  section:engine
)
control order(
  bp3:_ordseq,
  scope(flow),
  description:"Order \u2014 restore canonical order of sequence elements. PORTEE flow UNIQUEMENT : voir retro.",
  section:engine
)
control rotate(
  bp3:_rotate,
  args(degrees),
  scope(flow),
  description:"Rotate \u2014 cyclic rotation of sequence by N positions (engine, temporal). PORTEE flow UNIQUEMENT : voir retro. Distinct from runtime (rotate) which is a pitch transformation.",
  section:engine
)
control staccato(
  bp3:_staccato,
  args(value),
  range(0, 127),
  description:"Staccato \u2014 shorten note durations (affects temporal structure)",
  scope(symbol, group, rule, flow),
  section:engine
)
control legato(
  bp3:_legato,
  args(value),
  range(0, 1000),
  description:"Legato \u2014 extend note durations (affects temporal structure)",
  scope(symbol, group, rule, flow),
  section:engine
)
control rndtime(
  bp3:_rndtime,
  args(amount),
  range(0, 32767),
  unit:"ms",
  description:"Random timing jitter \u2014 displaces note attacks by \xB1N ms (temporal). Like staccato/legato, a current-parameter control, not a reorder.",
  scope(scene, symbol, group, rule, flow),
  section:engine
)
control destru(
  bp3:_destru,
  description:"Destructure composed terminals based on alphabet",
  scope(subgrammar, rule),
  section:engine
)

control seed(
  args(value),
  description:"Graine du tirage aleatoire -- seed:N fige la derivation ; sans elle (ou absente), le tirage est aleatoire (decision Romain 2026-08-09). BP3 Seed. PORTEE flow AJOUTEE le 2026-08-10 : la graine s ecrit AUSSI dans le flux, ![seed:N] (forme validee par Romain), ou elle traduit le _srand(N) natif. La convention flow n est pas neuve \u2014 retro, shuffle, rotate, order et randomize la portent deja ; ce qui manquait etait de la declarer pour seed, dont le parseur connaissait la graphie sans que la donnee la dise.",
  scope(scene, flow),
  section:engine
)
control maxitems(
  args(count),
  description:"Nombre maximum d'items produits par la derivation (BP3 MaxItemsProduce).",
  scope(scene),
  section:engine
)
control items(
  args(count),
  description:"Alias de maxitems (BP3 MaxItemsProduce).",
  scope(scene),
  section:engine
)
control allitems(
  description:"Produit tous les items possibles, desactive improvize (BP3 AllItems).",
  scope(scene),
  section:engine
)
control all_items(description:"Alias de allitems (BP3 AllItems).", scope(scene), section:engine)
control improvize(
  description:"Derivation continue sans fin (BP3 Improvize).",
  scope(scene),
  section:engine
)
control quantization(
  args(value),
  unit:"ms",
  description:"Tolerance de placement en ms (BP3 Quantization). N'EST PAS une grille : mesure sur le moteur natif, aucune borne d'evenement ne tombe sur un multiple de cette valeur. Elle est comparee au pas interne u de la piece et rend un facteur de regroupement k = floor(valeur/u)+1, que le moteur annonce (compression rate). k=1 : sortie inchangee a l'octet. k>1 : les instants sont refondus sur une table plus grossiere \u2014 des evenements distincts partagent des bornes, la piece s'allonge, le depart quitte zero.",
  scope(scene),
  section:engine
)
control qclock(
  args(period),
  description:"Periode du metronome Q (BP3 Qclock).",
  scope(scene),
  section:engine
)
control timepatterns(
  args(patterns),
  description:"Un motif temporel est un rapport de duree qui porte un nom -- timepatterns: t1=1/1, t2=3/2, ... Il se declare en tete, son nom s ecrit ensuite dans une expression polymetrique, et il occupe le temps sans sonner. LANGUAGE.md, section Les motifs temporels.",
  scope(scene),
  section:engine
)

control randomize(
  bp3:_randomize,
  description:"Re-seed RNG from clock at production start (BP3 _randomize preamble, Encode.c case 50)",
  scope(subgrammar, flow, scene),
  bagOnly:true,
  section:subgrammar
)
control striated(
  bp3:_striated,
  description:"Striated time (pulsed)",
  scope(subgrammar, scene),
  unicite:nature-du-temps,
  section:subgrammar
)
control smooth(
  bp3:_smooth,
  description:"Smooth time (non-pulsed)",
  scope(subgrammar, scene),
  unicite:nature-du-temps,
  section:subgrammar
)
`, "fichier": "engine.bpsl" }, { "nom": "eval", "format": "bpsl", "texte": `// @documented
def eval(resolvedBy:runtime-codevoices, resolves:eval, name:eval, type:code, section:objects)

def strudel(
  description:"Motifs et \xE9chantillons, dans le navigateur.",
  parameters(
    bank(description:"La banque d'\xE9chantillons que la voix charge. Sans elle, une sc\xE8ne qui emploie des noms d'\xE9chantillons se joue en SILENCE \u2014 mesur\xE9 chez Kanopi : \xAB banque inconnue \u2192 son MUET \xBB.")
  )
)

def hydra(description:"Synth\xE8se visuelle.")

def sc(description:"SuperCollider \u2014 synth\xE8se audio, backend natif.")

def js(description:"JavaScript \xE9valu\xE9 par le runtime.")

def ts(description:"TypeScript \u2014 le langage des corps de librairie, transpil\xE9 puis ex\xE9cut\xE9 par le r\xE9solveur que la librairie nomme.")

def p5(description:"Croquis graphiques p5.js.")

def mercury(description:"Live coding minimal.")

def csound(description:"Csound \u2014 synth\xE8se, backend natif.")

def tidal(description:"TidalCycles \u2014 motifs, backend natif (SuperDirt).")

def txt(description:"Texte litteral, evalue par personne. Porte une PHRASE la ou le langage n a pas de caractere d echappement : une description de librairie, un libelle. Ratifie par Romain le 2026-08-13 -- le backtick tague est la seule graphie du depot qui delimite un contenu libre, et lui en ajouter un tag coute moins qu inventer un signe.")
`, "fichier": "eval.bpsl" }, { "nom": "expression", "format": "bpsl", "texte": `types

// @documented
def expression(
  resolves:expression,
  resolvedBy:"toutes les sorties",
  name:expression,
  description:"Contr\xF4les qui d\xE9crivent COMMENT on joue une note, valables pour TOUTE sortie \u2014 pas un transport pr\xE9cis (LIBRAIRIES.md:171,217-219 : \xAB expression ne fait pas exception\u2026 c'est UNE destination, une classe nomm\xE9e par ce qu'elle d\xE9crit \xBB).",
  section:controls
)

control volume(
  args(value),
  range(0, 127),
  description:"Volume d'une voix. MIDI le r\xE9alise en CC7 ; chaque sortie d\xE9clare sa r\xE9alisation.",
  scope(symbol, group, rule, flow, scene),
  transportGroup:expression
)

control vel(
  bp3:_vel,
  args(value),
  range(0, 127),
  value:64,
  description:"Velocity (0-127). WebAudio: gain, MIDI: NoteOn velocity",
  scope(symbol, group, rule, flow, scene),
  transportGroup:expression
)

control pan(
  bp3:_pan,
  args(value),
  range(0, 127),
  value:64,
  description:"Pan (0=left, 64=center, 127=right). WebAudio: StereoPanner, MIDI: CC10",
  scope(symbol, group, rule, flow, scene),
  transportGroup:expression
)

control pancont(
  bp3:_pancont,
  description:"Panoramique en mode CONTINU \u2014 la valeur glisse PENDANT les notes, par messages interm\xE9diaires. Ses deux fr\xE8res discrets vivent dans la librairie variation ; leur destinataire se lit sur le champ resolvedBy de ce fichier-l\xE0, jamais ici.",
  scope(symbol, group, rule, flow),
  transportGroup:expression
)

control rndvel(
  bp3:_rndvel,
  args(range),
  value:0,
  description:"Random velocity +/-range",
  scope(symbol, group, rule, flow),
  transportGroup:expression
)

control velcont(
  bp3:_velcont,
  description:"V\xE9locit\xE9 en mode CONTINU \u2014 la valeur glisse PENDANT les notes, par messages interm\xE9diaires. Ses deux fr\xE8res discrets vivent dans la librairie variation ; leur destinataire se lit sur le champ resolvedBy de ce fichier-l\xE0, jamais ici. Mesur\xE9 sur le moteur natif v3.5.1-iso.2 : sur la v\xE9locit\xE9, le continu rend des octets identiques aux paliers (FillPhaseDiagram.c porte 'not implemented' ligne 415).",
  scope(symbol, group, rule, flow),
  transportGroup:expression
)

control offvel(
  args(value),
  range(0, 127),
  value:64,
  description:"NoteOff velocity (0-127). Relevant for expressive controllers (Osmose, MPE)",
  scope(symbol, group, rule, flow),
  transportGroup:expression
)

control articulcont(
  bp3:_articulcont,
  description:"Articulation en mode CONTINU \u2014 la valeur glisse PENDANT les notes. Ses deux fr\xE8res discrets, articulfixed et articulstep, vivent dans la librairie variation. Le comportement natif de ce mot n'est pas tranch\xE9 : aucun t\xE9moin construit sur le moteur v3.5.1-iso.2 n'a fait bouger l'articulation, le mode fixe compris.",
  scope(symbol, group, rule, flow)
)

control transposecont(
  bp3:_transposecont,
  description:"Transposition en mode CONTINU \u2014 la valeur glisse PENDANT les notes. Ses deux fr\xE8res discrets, transposefixed et transposestep, vivent dans la librairie variation ; celui-ci reste ici parce que la transposition se rend chez le m\xEAme r\xE9solveur que son param\xE8tre. Mesur\xE9 sur le moteur natif v3.5.1-iso.2 : le continu rend des octets identiques aux paliers (FillPhaseDiagram.c porte 'not implemented' ligne 608).",
  scope(symbol, group, rule, flow),
  transportGroup:transpo
)

control value(
  bp3:_value,
  bpscript:false,
  args(param),
  description:"Geste NATIF : donne une valeur a un parametre de performance nomme. En BPScript la forme est !(<param>:<valeur>), le parametre etant declare par son TYPE en tete -- signal <param> -- et il est la CLE, cf. arbitrage du 2026-08-13."
)

control fixed(
  bp3:_fixed,
  bpscript:false,
  args(param),
  description:"Geste NATIF : le parametre nomme NE VARIE PAS. En BPScript : !(<param>fixed), le mode colle au parametre."
)

control cont(
  bp3:_cont,
  bpscript:false,
  args(param),
  description:"Geste NATIF : le parametre nomme varie CONTINUMENT. En BPScript : !(<param>cont)."
)

control step(
  bp3:_step,
  bpscript:false,
  args(param),
  description:"Geste NATIF : le parametre nomme varie PAR PALIERS. En BPScript : !(<param>step). Jamais declare comme mot du langage -- il entre ici par la porte du routage, pas par celle du vocabulaire."
)

control panrate(
  bp3:_panrate,
  args(hz),
  range(0, 1000),
  unit:"Hz",
  value:50,
  description:"Cadence des valeurs intermediaires du continu de panoramique, en valeurs par seconde. Defaut 50, comme le moteur natif.",
  scope(symbol, group, rule, flow),
  transportGroup:expression
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

homomorphism tabla_stroke(
  description:"Tabla open\u2192closed stroke mapping (qa'ida)",
  mappings(dha:ta, dhin:tin, ge:ke, ghe:khe, dhagena:takena, dheene:teene, dheena:teena)
)

homomorphism ruwet_mineur(
  description:"Ruwet \u2014 transformation th\xE8me majeur \u2192 mineur (D\xC9PR\xC9CI\xC9)",
  mappings(fa4:re4, la4:fa4, sol4:mi4)
)

homomorphism ruwet(
  description:"Ruwet \u2014 3 transformations m\xE9lodiques (fid\xE8le \xE0 bp3-engine/test-data/-ho.Ruwet)",
  sections(m1(la4:sib4), m2(la4:sol4), mineur(fa4:re4, la4:fa4))
)

homomorphism dhati(
  description:"Dhati \u2014 homomorphisme tabla (fid\xE8le \xE0 -ho.dhati, section *, identit\xE9s conserv\xE9es)",
  sections("*"(dha:ta, ti:ti, ge:ke, na:na, dhee:tee, tr:tr, kt:kt))
)

homomorphism dhin(
  description:"Dhin -- homomorphisme tabla (fid\xE8le \xE0 -ho.dhin--, section *, identit\xE9s conserv\xE9es)",
  sections("*"(dha:ta, ta:ta, ti:ti, ra:ra, na:na, ki:ki, dhee:tee, ne:ne, ge:ke, ka:ka, dhin:tin))
)

homomorphism tryhomomorphism(
  description:"Homomorphisme de test (fid\xE8le \xE0 -ho.tryhomomorphism, cha\xEEne c-->fa4-->d d\xE9pli\xE9e)",
  sections("*"(a:b, do4:re4, c:fa4, fa4:d))
)

homomorphism checkhomo(
  description:"Test homomorphism \u2014 3 sections (*, H, TR)",
  sections("*"(a:"a'", "a'":"a""", b:"b'", "b'":b), H(a:c, c:"c'", "c'":"a"""), TR("a'":"b'", "b'":b))
)

homomorphism transposition(
  description:"Auto-transposer H. Visser 1997 \u2014 homomorphisme \xE0 CHA\xCENES (fid\xE8le \xE0 bp3-engine/test-data/-ho.transposition, section TR, 3 cha\xEEnes index\xE9es par profondeur d'invocation)",
  sections(TR(chains(C3(B3, F4, C6), B3(C3, B4, F6), F4(C6, F2, B5))))
)

homomorphism Ruwet(
  description:"Port\xE9 depuis bp3-engine/test-data/-ho.Ruwet le 2026-08-13, section par section et maillon par maillon. V\xE9rifi\xE9 : le d\xE9pliage en paires cons\xE9cutives redonne exactement le natif.",
  sections(m1(chains(la4(sib4))), m2(chains(la4(sol4))), mineur(chains(fa4(re4), la4(fa4))))
)

homomorphism abc(
  description:"Port\xE9 depuis bp3-engine/test-data/-ho.abc le 2026-08-13, section par section et maillon par maillon. V\xE9rifi\xE9 : le d\xE9pliage en paires cons\xE9cutives redonne exactement le natif.",
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

homomorphism abc1(
  description:"Port\xE9 depuis bp3-engine/test-data/-ho.abc1 le 2026-08-13, section par section et maillon par maillon. V\xE9rifi\xE9 : le d\xE9pliage en paires cons\xE9cutives redonne exactement le natif.",
  sections(chik(chains(a("a'"), b("b'"), c("c'"), d("d'"))), e(chains(f("f'"), g("g'"))))
)

homomorphism abc2(
  description:"Port\xE9 depuis bp3-engine/test-data/-ho.abc2 le 2026-08-13. \u26A0\uFE0F La section est \`sync\` et non \`*\` : le fichier \xE9crit \`*\` puis \`sync\` sans s\xE9parateur entre les deux, et une \xC9TIQUETTE QUI SUIT UNE \xC9TIQUETTE LA REMPLACE \u2014 le natif n'ouvre une section que sur un s\xE9parateur. J'avais d'abord lu \`sync\` comme un MODIFICATEUR de la section courante ; c'\xE9tait une invention, le mot \`sync\` n'existe nulle part dans la source du moteur. Corrig\xE9 sur signalement de bp3-frontend, dont le crit\xE8re vient du moteur.",
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

homomorphism abc3(
  description:"Port\xE9 depuis bp3-engine/test-data/-ho.abc3 le 2026-08-13, section par section et maillon par maillon. V\xE9rifi\xE9 : le d\xE9pliage en paires cons\xE9cutives redonne exactement le natif.",
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

homomorphism cloches1(
  description:"Cloches \u2014 homomorphisme \xE0 CHA\xCENES, fid\xE8le \xE0 bp3-engine/test-data/-ho.cloches1 (section TR, 4 cha\xEEnes index\xE9es par profondeur d'invocation). \u26A0\uFE0F PORT\xC9 \xC0 NOUVEAU LE 2026-08-10 : la version pr\xE9c\xE9dente APLATISSAIT les cha\xEEnes en paires \u2014 elle gardait le premier maillon de chaque ligne et perdait les suivants, soit 15 maillons sur 19. Une cha\xEEne ne dit pas \xAB do3 devient mib3 \xBB : elle dit \xAB au premier appel mib3, au deuxi\xE8me fa#3, au troisi\xE8me la4 \xBB \u2014 l'aplatir change le sens, pas seulement la quantit\xE9.",
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

homomorphism trial_mohanam(
  description:"Port\xE9 depuis bp3-engine/test-data/-ho.trial.mohanam le 2026-08-13, section par section et maillon par maillon. V\xE9rifi\xE9 : le d\xE9pliage en paires cons\xE9cutives redonne exactement le natif.",
  sections(trn(chains(sa6(ga6), re6(pa6), ga6(dha6), pa6(sa7), dha6(re7), sa7(ga7))))
)
`, "fichier": "homomorphism.bpsl" }, { "nom": "midi", "format": "bpsl", "texte": `types

// @documented
def midi(
  resolves:midi,
  resolvedBy:"runtime-MIDI",
  name:midi,
  description:"Contr\xF4les sp\xE9cifiques au transport MIDI \u2014 match EXACT LIBRAIRIES.md:172.",
  section:controls
)

def ch(
  section:schema.addressKeys,
  description:"Canal d'adresse, forme courte de channel.",
  scope(symbol, group, rule, flow)
)

def channel(
  section:schema.addressKeys,
  description:"Canal d'adresse, forme longue de ch.",
  scope(symbol, group, rule, flow)
)

def device(
  section:schema.addressKeys,
  description:"Appareil vis\xE9 par l'adresse.",
  scope(symbol, group, rule, flow)
)

def note(
  section:schema.addressKeys,
  description:"Num\xE9ro de note d'une adresse \u2014 la source qu'un point d'attente \xE9coute, l'\xE9v\xE9nement qu'une occurrence vise.",
  scope(symbol, group, rule, flow)
)

def port(
  section:schema.addressKeys,
  description:"Port vis\xE9 par l'adresse.",
  scope(symbol, group, rule, flow)
)

control chan(
  bp3:_chan,
  args(channel),
  range(1, 16),
  description:"MIDI channel",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control ins(
  bp3:_ins,
  args(program),
  range(1, 128),
  description:"MIDI Program Change. L'auteur \xE9crit le num\xE9ro de programme \xE0 partir de 1, comme le moteur d'origine ; l'octet transmis vaut ce num\xE9ro moins un.",
  scope(symbol, group, rule, flow, scene),
  transportGroup:midi
)

control mod(
  bp3:_mod,
  args(value),
  range(0, 127),
  description:"MIDI Modulation (CC1)",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control modcont(
  bp3:_modcont,
  description:"Enable continuous modulation interpolation (CC1)",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control pitchbend(
  bp3:_pitchbend,
  args(value),
  range(-8192, 8191),
  description:"MIDI Pitch Bend",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control pitchrange(
  bp3:_pitchrange,
  args(cents),
  unit:"cents",
  description:"Pitch bend range in cents",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control pitchcont(
  bp3:_pitchcont,
  description:"Enable continuous pitch bend interpolation",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control keymap(
  bp3:_keymap,
  args(p1, q1, p2, q2),
  range(0, 127),
  description:"Key mapping \u2014 remap MIDI key range (p1,p2) to (q1,q2). Args are key numbers (0..127) or note names; p2 must be greater than p1. BP3 _keymap \u2014 registre du moteur natif, bp3-engine \`origin/wasm\` : capture-run/console_strings.json porte \xAB 62 4 _keymap \xBB.",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control mapcont(
  bp3:_mapcont,
  description:"Carte de touches en mode CONTINU \u2014 la carte glisse PENDANT les notes, par messages interm\xE9diaires. BP3 _mapcont \u2014 registre du moteur natif, bp3-engine \`origin/wasm\` : capture-run/console_strings.json porte \xAB 44 0 _mapcont \xBB. Ses deux fr\xE8res discrets vivent dans la librairie variation ; leur destinataire se lit sur le champ resolvedBy de ce fichier-l\xE0, jamais ici.",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control pressure(
  bp3:_press,
  args(value),
  range(0, 127),
  description:"MIDI Channel Pressure (aftertouch)",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control presscont(
  bp3:_presscont,
  description:"Enable continuous channel pressure interpolation",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control volume(
  implements:expression.volume,
  bp3:_volume,
  args(value),
  range(0, 127),
  description:"MIDI Volume (CC7)",
  scope(symbol, group, rule, flow, scene),
  transportGroup:midi
)

control volumecont(
  bp3:_volumecont,
  description:"Enable continuous volume interpolation",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control switchon(
  bp3:_switchon,
  args(channel),
  description:"Enable MIDI switch channel",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control switchoff(
  bp3:_switchoff,
  args(channel),
  description:"Disable MIDI switch channel",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control mute(
  description:"Coupe le son. Nu, (mute), coupe tout ce qui sonne ; par composant, (mute.all) ou (mute.lead), coupe la cible nommee. Nomme le 2026-07-26 : remplace une des familles que script(...) portait sans nom.",
  scope(flow),
  bagOnly:true,
  transportGroup:midi
)

control unmute(
  description:"Retablit le son coupe par mute. Meme graphie : (unmute) ou (unmute.lead).",
  scope(flow),
  bagOnly:true,
  transportGroup:midi
)

control panic(
  description:"Arret d'urgence : toutes les notes relachees, tous les controleurs remis a plat. Image de MIDI all notes off. Ne prend aucun argument.",
  scope(flow),
  bagOnly:true,
  transportGroup:midi
)

control sync(
  args(message),
  values(start, continue, stop),
  description:"Message systeme temps reel de synchronisation : (sync:start), (sync:continue), (sync:stop). Image des messages MIDI Start/Continue/Stop. Remplace script(MIDI send Continue).",
  scope(flow),
  transportGroup:midi
)

control cc(
  component:number,
  args(value),
  range(0, 127),
  description:"Controleur MIDI NUMEROTE. Se designe par son numero de composant : (cc.98:45) en contenance, !(cc.98:45) en flux. Pour les controleurs sans alias nomme -- ceux qui en ont un s'ecrivent par leur nom (mod = CC1, volume = CC7). Graphie tranchee par Romain le 2026-07-26 : le point APPELLE le composant (le controleur 98), les deux points AFFECTENT la valeur.",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control volumerate(
  bp3:_volumerate,
  args(hz),
  range(0, 1000),
  unit:"Hz",
  description:"Cadence des valeurs intermediaires du continu de volume, en valeurs par seconde. Defaut 50, comme le moteur natif.",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control modrate(
  bp3:_modrate,
  args(hz),
  range(0, 1000),
  unit:"Hz",
  description:"Cadence des valeurs intermediaires du continu de modulation, en valeurs par seconde. Defaut 50, comme le moteur natif.",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control pitchrate(
  bp3:_pitchrate,
  args(hz),
  range(0, 1000),
  unit:"Hz",
  description:"Cadence des valeurs intermediaires du continu de hauteur, en valeurs par seconde. Defaut 50, comme le moteur natif.",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control pressrate(
  bp3:_pressrate,
  args(hz),
  range(0, 1000),
  unit:"Hz",
  description:"Cadence des valeurs intermediaires du continu de pression, en valeurs par seconde. Defaut 50, comme le moteur natif.",
  scope(symbol, group, rule, flow),
  transportGroup:midi
)

control rate(
  bp3:SamplingRate,
  args(hz),
  range(0, 1000),
  unit:"Hz",
  description:"Cadence des valeurs interm\xE9diaires de TOUS les flux continus, en \xE9missions par seconde. R\xE8gle d'un mot ce que volumerate, modrate, pitchrate et pressrate r\xE8glent s\xE9par\xE9ment. Image de SamplingRate au moteur natif.",
  scope(scene),
  transportGroup:midi
)

control volumecontrol(
  bp3:_volumecontrol,
  args(controller),
  range(0, 127),
  description:"Num\xE9ro du contr\xF4leur MIDI qui porte le volume. Image de VolumeController au moteur natif. Le canal se dit dans le m\xEAme sac : !(chan:3, volumecontrol:11).",
  scope(symbol, group, rule, flow, scene),
  transportGroup:midi
)

control pancontrol(
  bp3:_pancontrol,
  args(controller),
  range(0, 127),
  description:"Num\xE9ro du contr\xF4leur MIDI qui porte le panoramique. Image de PanoramicController au moteur natif. Le canal se dit dans le m\xEAme sac : !(chan:3, pancontrol:11).",
  scope(symbol, group, rule, flow, scene),
  transportGroup:midi
)

control fadeout(
  bp3:EndFadeOut,
  args(duration),
  unit:"s",
  description:"Extinction du son \xE0 la fin de la performance, en SECONDES. Une valeur inf\xE9rieure ou \xE9gale \xE0 z\xE9ro supprime le fondu. Image de EndFadeOut au moteur natif.",
  scope(scene),
  transportGroup:midi
)

control resetnotes(
  bp3:ResetNotes,
  bp3value:1,
  description:"\xC0 la fin de la sc\xE8ne, \xE9teindre ce qui sonne encore.",
  scope(flow, scene),
  bagOnly:true,
  unicite:fin-de-scene,
  transportGroup:midi
)

control letring(
  bp3:ResetNotes,
  bp3value:0,
  description:"\xC0 la fin de la sc\xE8ne, laisser sonner ce qui sonne encore.",
  scope(flow, scene),
  bagOnly:true,
  unicite:fin-de-scene,
  transportGroup:midi
)

control strikeagain(
  bp3:StrikeAgainDefault,
  bp3value:1,
  description:"Une note d\xE9j\xE0 tenue qu'on rejoue est RELANC\xC9E \u2014 nouveau NoteOn.",
  scope(flow, scene),
  bagOnly:true,
  unicite:note-rejouee,
  transportGroup:midi
)

control sustain(
  bp3:StrikeAgainDefault,
  bp3value:0,
  description:"Une note d\xE9j\xE0 tenue qu'on rejoue reste TENUE \u2014 aucun nouveau NoteOn.",
  scope(flow, scene),
  bagOnly:true,
  unicite:note-rejouee,
  transportGroup:midi
)

control pedalrelease(
  description:"Un interrupteur d\xE9j\xE0 enfonc\xE9 qu'on r\xE9-actionne est rel\xE2ch\xE9 puis repress\xE9.",
  scope(flow, scene),
  bagOnly:true,
  unicite:interrupteur-rejoue,
  transportGroup:midi
)

control pedalhold(
  description:"Un interrupteur d\xE9j\xE0 enfonc\xE9 qu'on r\xE9-actionne garde son \xE9tat.",
  scope(flow, scene),
  bagOnly:true,
  unicite:interrupteur-rejoue,
  transportGroup:midi
)

control resetcontrols(
  bp3:ResetControllers,
  bp3value:1,
  description:"\xC0 la fin de la sc\xE8ne, remettre les contr\xF4leurs \xE0 plat.",
  scope(flow, scene),
  bagOnly:true,
  unicite:fin-des-controleurs,
  transportGroup:midi
)

control keepcontrols(
  bp3:ResetControllers,
  bp3value:0,
  description:"\xC0 la fin de la sc\xE8ne, laisser les contr\xF4leurs dans l'\xE9tat o\xF9 la sc\xE8ne les a mis.",
  scope(flow, scene),
  bagOnly:true,
  unicite:fin-des-controleurs,
  transportGroup:midi
)
`, "fichier": "midi.bpsl" }, { "nom": "midi_default", "format": "bpsl", "texte": `types

// @documented
def midi_default(
  resolvedBy:runtime-MIDI,
  resolves:midi_default,
  name:midi_default,
  description:"L'ENVIRONNEMENT MIDI PAR D\xC9FAUT \u2014 la valeur que porte chaque mot de \`midi\` tant qu'une sc\xE8ne n'en \xE9crit pas d'autre.",
  version:"0.2.0"
)

chan:1
mod:0
pitchbend:0
pitchrange:200
pressure:0
volume:90
volumerate:50
modrate:50
pitchrate:50
pressrate:50
rate:50
volumecontrol:7
pancontrol:10
fadeout:2
resetnotes:false
letring:true
strikeagain:true
sustain:false
pedalrelease:true
pedalhold:false
resetcontrols:false
keepcontrols:true
`, "fichier": "midi_default.bpsl" }, { "nom": "octaves", "format": "bpsl", "texte": 'types\n\n// @documented\ndef octaves(resolvedBy:"Kairos", resolves:octaves)\n\noctaves western(\n  position:suffix,\n  separator:"",\n  registers("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),\n  default:"4"\n)\n\noctaves arrows(position:suffix, separator:"_", registers(vv, v, "", "^", "^^"), default:"")\n\noctaves saptak(position:prefix, separator:"_", registers(mandra, madhya, taar), default:madhya)\n\noctaves turkish(position:prefix, separator:"_", registers("", tiz), default:"")\n\noctaves gamelan(position:prefix, separator:"_", registers(ageng, tengah, alit), default:tengah)\n\noctaves shakuhachi(position:prefix, separator:"_", registers(otsu, kan, daikan), default:otsu)\n\noctaves korean(position:prefix, separator:"_", registers(tak, jung, cheong), default:jung)\n\noctaves saptak_us(\n  position:suffix,\n  separator:"_",\n  registers("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),\n  default:"4"\n)\n\noctaves bp3(\n  position:suffix,\n  separator:"",\n  registers("00", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),\n  default:"4"\n)\n\noctaves bp3_fr(\n  position:suffix,\n  separator:"",\n  registers("000", "00", "0", "1", "2", "3", "4", "5", "6", "7", "8"),\n  default:"3"\n)\n', "fichier": "octaves.bpsl" }, { "nom": "scales", "format": "bpsl", "texte": `types

// @documented
def scales(resolvedBy:"Kairos", resolves:scale)

interval maqam_sikah(
  description:"Maqam Sikah \u2014 starts on sikah (E half-flat) \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [d\xE9composition en jins \xC0 \xC9TABLIR (v\xE9rification musicologique) ; ratios exacts conserv\xE9s en attendant].",
  culture:arabic,
  notes_count:7,
  ratios(1, 12/11, 27/22, 4/3, 16/11, 18/11, 11/6),
  system:"zalzal-ji"
)
interval maqam_jiharkah(
  description:"Maqam Jiharkah \u2014 Rast-like with lowered 7th \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [d\xE9composition en jins \xC0 \xC9TABLIR (v\xE9rification musicologique) ; ratios exacts conserv\xE9s en attendant].",
  culture:arabic,
  notes_count:7,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 5/3, 11/6),
  system:"zalzal-ji"
)
interval maqam_suzidil(
  description:"Maqam Suzidil \u2014 Ajam lower + Hijaz Kar upper \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [d\xE9composition en jins \xC0 \xC9TABLIR (v\xE9rification musicologique) ; ratios exacts conserv\xE9s en attendant].",
  culture:arabic,
  notes_count:7,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 8/5, 15/8),
  system:"zalzal-ji"
)
interval maqam_shawq_afza(
  description:"Maqam Shawq Afza \u2014 Sikah-based, emotional character \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [d\xE9composition en jins \xC0 \xC9TABLIR (v\xE9rification musicologique) ; ratios exacts conserv\xE9s en attendant].",
  culture:arabic,
  notes_count:7,
  ratios(1, 12/11, 6/5, 4/3, 3/2, 5/3, 11/6),
  system:"zalzal-ji"
)
interval jins_nikriz(
  description:"Jins Nikriz \u2014 4-note tetrachord with augmented second [ratios JI zalzaliens (depuis degr\xE9s 24-TET)].",
  culture:arabic,
  temperament:"24TET",
  notes_count:4,
  ratios(1, 9/8, 6/5, 45/32)
)
interval jins_athar_kurd(
  description:"Jins Athar Kurd \u2014 Kurd variant with raised 3rd [ratios JI zalzaliens (depuis degr\xE9s 24-TET)].",
  culture:arabic,
  temperament:"24TET",
  notes_count:4,
  ratios(1, 16/15, 6/5, 45/32)
)
interval jins_saba_zamzam(
  description:"Jins Saba Zamzam \u2014 Saba variant with flat 2nd and 4th [ratios JI zalzaliens (depuis degr\xE9s 24-TET)].",
  culture:arabic,
  temperament:"24TET",
  notes_count:4,
  ratios(1, 16/15, 6/5, 5/4)
)
interval jins_mustaar(
  description:"Jins Mustaar \u2014 rare 3-note jins, narrow intervals [ratios JI zalzaliens (depuis degr\xE9s 24-TET)].",
  culture:arabic,
  temperament:"24TET",
  notes_count:3,
  ratios(1, 12/11, 15/13)
)
interval gong(
  description:"Gong mode \u2014 1st mode of Chinese pentatonic, Do position",
  culture:chinese,
  ratios(1, 9/8, 81/64, 3/2, 27/16),
  notes_count:5
)
interval shang(
  description:"Shang mode \u2014 2nd mode of Chinese pentatonic, Re position",
  culture:chinese,
  ratios(1, 9/8, 4/3, 3/2, 16/9),
  notes_count:5
)
interval jue(
  description:"Jue mode \u2014 3rd mode of Chinese pentatonic, Mi position",
  culture:chinese,
  ratios(1, 32/27, 4/3, 128/81, 16/9),
  notes_count:5
)
interval zhi(
  description:"Zhi mode \u2014 4th mode of Chinese pentatonic, Sol position",
  culture:chinese,
  ratios(1, 9/8, 4/3, 3/2, 16/9),
  notes_count:5
)
interval yu(
  description:"Yu mode \u2014 5th mode of Chinese pentatonic, La position",
  culture:chinese,
  ratios(1, 32/27, 4/3, 3/2, 128/81),
  notes_count:5
)
interval yayue(
  description:"Yayue \u2014 Chinese ceremonial court music heptatonic scale",
  culture:chinese,
  ratios(1, 9/8, 81/64, 4/3, 3/2, 27/16, 243/128),
  notes_count:7
)
interval qingyue(
  description:"Qingyue \u2014 Chinese folk heptatonic scale with minor 7th",
  culture:chinese,
  ratios(1, 9/8, 81/64, 4/3, 3/2, 27/16, 16/9),
  notes_count:7
)
interval hirajoshi(
  description:"Hirajoshi \u2014 Japanese pentatonic scale, melancholic character",
  culture:japanese,
  ratios(1, 9/8, 6/5, 3/2, 8/5),
  notes_count:5
)
interval in_sen(
  description:"In-sen \u2014 Japanese pentatonic, used in shakuhachi music",
  culture:japanese,
  ratios(1, 16/15, 4/3, 3/2, 8/5),
  notes_count:5
)
interval yo(
  description:"Yo \u2014 Japanese pentatonic, bright folk scale",
  culture:japanese,
  ratios(1, 9/8, 4/3, 3/2, 16/9),
  notes_count:5
)
interval iwato(
  description:"Iwato \u2014 Japanese pentatonic, dark meditative scale",
  culture:japanese,
  ratios(1, 16/15, 4/3, 45/32, 8/5),
  notes_count:5
)
interval kumoi(
  description:"Kumoi \u2014 Japanese pentatonic, koto tuning",
  culture:japanese,
  ratios(1, 9/8, 6/5, 3/2, 9/5),
  notes_count:5
)
interval ryukyu(
  description:"Ryukyu \u2014 Okinawan pentatonic scale",
  culture:japanese,
  ratios(1, 5/4, 4/3, 3/2, 15/8),
  notes_count:5
)
interval miyako_bushi(
  description:"Miyako-bushi \u2014 Japanese urban pentatonic, used in koto and shamisen",
  culture:japanese,
  ratios(1, 16/15, 5/4, 3/2, 8/5),
  notes_count:5
)
interval pyeong_jo(
  description:"Pyeong-jo \u2014 Korean pentatonic mode, peaceful character",
  culture:korean,
  ratios(1, 9/8, 4/3, 3/2, 16/9),
  notes_count:5
)
interval gye_myeon_jo(
  description:"Gye-myeon-jo \u2014 Korean pentatonic mode, sorrowful character",
  culture:korean,
  ratios(1, 6/5, 4/3, 3/2, 8/5),
  notes_count:5
)
interval dorian_ancient(
  description:"Ancient Greek Dorian \u2014 descending E to E on white keys",
  culture:greek,
  ratios(1, 9/8, 32/27, 4/3, 3/2, 128/81, 16/9),
  notes_count:7
)
interval phrygian_ancient(
  description:"Ancient Greek Phrygian \u2014 descending D to D on white keys",
  culture:greek,
  ratios(1, 9/8, 81/64, 4/3, 3/2, 27/16, 243/128),
  notes_count:7
)
interval lydian_ancient(
  description:"Ancient Greek Lydian \u2014 descending C to C on white keys",
  culture:greek,
  ratios(1, 9/8, 81/64, 4/3, 3/2, 27/16, 16/9),
  notes_count:7
)
interval mixolydian_ancient(
  description:"Ancient Greek Mixolydian \u2014 descending B to B on white keys",
  culture:greek,
  ratios(1, 256/243, 32/27, 4/3, 3/2, 128/81, 16/9),
  notes_count:7
)
interval chromatic_genus(
  description:"Ancient Greek Chromatic genus tetrachord \u2014 narrow semitones + minor third",
  culture:greek,
  ratios(1, 28/27, 32/27, 4/3),
  notes_count:4
)
interval enharmonic_genus(
  description:"Ancient Greek Enharmonic genus tetrachord \u2014 quarter-tones + major third",
  culture:greek,
  ratios(1, 28/27, 16/15, 4/3),
  notes_count:4
)
interval ionian(
  description:"Medieval Ionian mode \u2014 C to C, equivalent to major scale",
  culture:medieval,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8),
  notes_count:7
)
interval dorian(
  description:"Medieval Dorian mode \u2014 D to D, minor with raised 6th",
  culture:medieval,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 5/3, 9/5),
  notes_count:7
)
interval phrygian(
  description:"Medieval Phrygian mode \u2014 E to E, minor with flat 2nd",
  culture:medieval,
  ratios(1, 16/15, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:7
)
interval lydian(
  description:"Medieval Lydian mode \u2014 F to F, major with raised 4th",
  culture:medieval,
  ratios(1, 9/8, 5/4, 45/32, 3/2, 5/3, 15/8),
  notes_count:7
)
interval mixolydian(
  description:"Medieval Mixolydian mode \u2014 G to G, major with flat 7th",
  culture:medieval,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 5/3, 9/5),
  notes_count:7
)
interval aeolian(
  description:"Medieval Aeolian mode \u2014 A to A, natural minor",
  culture:medieval,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:7
)
interval locrian(
  description:"Medieval Locrian mode \u2014 B to B, diminished mode",
  culture:medieval,
  ratios(1, 16/15, 6/5, 4/3, 64/45, 8/5, 9/5),
  notes_count:7
)
interval byzantine_protos(
  description:"Byzantine Protos \u2014 1st mode of Byzantine Octoechos",
  culture:byzantine,
  ratios(1, 9/8, 12/11, 4/3, 3/2, 27/16, 18/11),
  notes_count:7
)
interval byzantine_devteros(
  description:"Byzantine Devteros \u2014 2nd mode of Byzantine Octoechos",
  culture:byzantine,
  ratios(1, 12/11, 32/27, 4/3, 3/2, 18/11, 16/9),
  notes_count:7
)
interval tizita_major(
  description:"Tizita major \u2014 Ethiopian pentatonic, nostalgic mood",
  culture:ethiopian,
  ratios(1, 9/8, 5/4, 3/2, 5/3),
  notes_count:5
)
interval tizita_minor(
  description:"Tizita minor \u2014 Ethiopian pentatonic, melancholic variant",
  culture:ethiopian,
  ratios(1, 9/8, 6/5, 3/2, 8/5),
  notes_count:5
)
interval bati_major(
  description:"Bati major \u2014 Ethiopian pentatonic, bright and festive",
  culture:ethiopian,
  ratios(1, 6/5, 4/3, 3/2, 9/5),
  notes_count:5
)
interval bati_minor(
  description:"Bati minor \u2014 Ethiopian pentatonic, darker Bati variant",
  culture:ethiopian,
  ratios(1, 6/5, 4/3, 3/2, 8/5),
  notes_count:5
)
interval ambassel(
  description:"Ambassel \u2014 Ethiopian pentatonic, spiritual and contemplative",
  culture:ethiopian,
  ratios(1, 16/15, 5/4, 3/2, 8/5),
  notes_count:5
)
interval anchihoye(
  description:"Anchihoye \u2014 Ethiopian tetratonic, simplest Ethiopian mode",
  culture:ethiopian,
  ratios(1, 6/5, 3/2, 8/5),
  notes_count:4
)
interval pelog_lima(
  description:"Pelog lima \u2014 5-note Javanese pelog, empirical tuning",
  culture:indonesian,
  ratios(1, 120c, 260c, 540c, 675c),
  notes_count:5
)
interval slendro_balinese(
  description:"Slendro Balinese \u2014 5-tone quasi-equal Balinese slendro",
  culture:indonesian,
  ratios(1, 240c, 480c, 720c, 960c),
  notes_count:5
)
interval thai_7tet(
  description:"Thai 7-TET \u2014 7 equal divisions of the octave",
  culture:thai,
  ratios(1, 171c, 343c, 514c, 686c, 857c, 1029c),
  notes_count:7
)
interval thai_pentatonic(
  description:"Thai pentatonic \u2014 5 of 7 equal steps, traditional Thai selection",
  culture:thai,
  ratios(1, 171c, 514c, 686c, 857c),
  notes_count:5
)
interval blues(
  description:"Blues scale \u2014 hexatonic with blue notes",
  culture:western,
  ratios(1, 6/5, 4/3, 7/5, 3/2, 9/5),
  notes_count:6
)
interval whole_tone(
  description:"Whole tone scale \u2014 6 equal whole steps",
  culture:western,
  ratios(1, 200c, 400c, 600c, 800c, 1000c),
  notes_count:6
)
interval diminished_hw(
  description:"Diminished scale (half-whole) \u2014 octatonic alternating H-W",
  culture:western,
  ratios(1, 100c, 300c, 400c, 600c, 700c, 900c, 1000c),
  notes_count:8
)
interval diminished_wh(
  description:"Diminished scale (whole-half) \u2014 octatonic alternating W-H",
  culture:western,
  ratios(1, 200c, 300c, 500c, 600c, 800c, 900c, 1100c),
  notes_count:8
)
interval augmented(
  description:"Augmented scale \u2014 hexatonic symmetric scale",
  culture:western,
  ratios(1, 300c, 400c, 700c, 800c, 1100c),
  notes_count:6
)
interval harmonic_minor(
  description:"Harmonic minor \u2014 natural minor with raised 7th",
  culture:western,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 8/5, 15/8),
  notes_count:7
)
interval hungarian_minor(
  description:"Hungarian minor \u2014 double harmonic minor, gypsy scale",
  culture:western,
  ratios(1, 9/8, 6/5, 45/32, 3/2, 8/5, 15/8),
  notes_count:7
)
interval chromatic(
  description:"Chromatic scale \u2014 all 12 semitones",
  culture:western,
  ratios(1, 100c, 200c, 300c, 400c, 500c, 600c, 700c, 800c, 900c, 1000c, 1100c),
  notes_count:12
)
interval handpan_kurd(
  description:"Kurd \u2014 Aeolian / Natural Minor. The most popular handpan scale worldwide.",
  culture:handpan,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:7,
  layout:"D3 A3 Bb3 C4 D4 E4 F4 G4 A4"
)
interval handpan_integral(
  description:"Integral \u2014 Aeolian without 4th. Created by PanArt (original Hang). Open, spacious.",
  culture:handpan,
  ratios(1, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:6,
  layout:"D3 A3 Bb3 C4 D4 F4 A4 C5"
)
interval handpan_celtic(
  description:"Celtic / Amara \u2014 Dorian mode. Brighter minor with raised 6th. Folk/Celtic character.",
  culture:handpan,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 5/3, 9/5),
  notes_count:7,
  layout:"D3 A3 C4 D4 E4 F4 G4 A4 B4"
)
interval handpan_pygmy(
  description:"Pygmy \u2014 Minor pentatonic + b6. African-inspired, warm and forgiving.",
  culture:handpan,
  ratios(1, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:6,
  layout:"D3 A3 Bb3 C4 D4 F4 G4 A4 C5"
)
interval handpan_equinox(
  description:"Equinox \u2014 Phrygian mode. Dark, Spanish/Middle-Eastern flavor. Pantheon Steel.",
  culture:handpan,
  ratios(1, 16/15, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:7,
  layout:"D3 A3 Bb3 C4 D4 Eb4 F4 G4 A4"
)
interval handpan_hijaz(
  description:"Hijaz \u2014 Phrygian Dominant (5th mode of Harmonic Minor). Arabic/Spanish feel.",
  culture:handpan,
  ratios(1, 16/15, 5/4, 4/3, 3/2, 8/5, 9/5),
  notes_count:7,
  layout:"D3 A3 Bb3 C#4 D4 E4 F4 G4 A4"
)
interval handpan_hijaz_kar(
  description:"Hijaz Kar \u2014 Double Harmonic Major / Byzantine / Bhairav. Two Hijaz tetrachords.",
  culture:handpan,
  ratios(1, 16/15, 5/4, 4/3, 3/2, 8/5, 15/8),
  notes_count:7,
  layout:"D3 A3 Bb3 C#4 D4 E4 F4 G#4 A4"
)
interval handpan_golden_gate(
  description:"Golden Gate \u2014 Harmonic Minor. Classical sound, augmented second between b6 and 7.",
  culture:handpan,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 8/5, 15/8),
  notes_count:7,
  layout:"D3 A3 Bb3 C4 D4 E4 F4 G#4 A4"
)
interval handpan_romanian_hijaz(
  description:"Romanian Hijaz \u2014 Hungarian/Double Harmonic Minor. Two augmented seconds, intense Eastern European feel.",
  culture:handpan,
  ratios(1, 9/8, 6/5, 45/32, 3/2, 8/5, 15/8),
  notes_count:7,
  layout:"D3 A3 Bb3 C#4 D4 Eb4 F#4 G4 A4"
)
interval handpan_akebono(
  description:"Akebono \u2014 Japanese pentatonic (In scale variant). Contemplative, zen.",
  culture:handpan,
  ratios(1, 16/15, 4/3, 3/2, 8/5),
  notes_count:5,
  layout:"D3 A3 Bb3 D4 E4 F4 A4 Bb4 D5"
)
interval handpan_sabye(
  description:"Sabye \u2014 PanArt creation. Mysterious, African-inspired hexatonic.",
  culture:handpan,
  ratios(1, 16/15, 6/5, 3/2, 8/5),
  notes_count:5,
  layout:"D3 A3 Bb3 D4 E4 F4 G4 A4 D5"
)
interval handpan_mystic(
  description:"Mystic \u2014 Phrygian without 7th. Dark, introspective, spacious.",
  culture:handpan,
  ratios(1, 16/15, 6/5, 4/3, 3/2, 8/5),
  notes_count:6,
  layout:"D3 A3 Bb3 C4 D4 Eb4 G4 A4 Bb4"
)
interval handpan_la_sirena(
  description:"La Sirena \u2014 Phrygian Dominant. Spanish/Arabic dramatic character.",
  culture:handpan,
  ratios(1, 16/15, 5/4, 4/3, 3/2, 8/5, 9/5),
  notes_count:7,
  layout:"D3 A3 Bb3 D4 E4 F4 A4 Bb4 C#5"
)
interval handpan_oxalis(
  description:"Oxalis \u2014 Dorian without 6th. Open, airy minor. Ayasa creation.",
  culture:handpan,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 9/5),
  notes_count:6,
  layout:"D3 A3 C4 D4 E4 F4 A4 C5 D5"
)
interval handpan_jibuk(
  description:"Jibuk \u2014 Mixolydian. Major-sounding with flatted 7th. Bright, festive.",
  culture:handpan,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 5/3, 9/5),
  notes_count:7,
  layout:"D3 A3 C4 D4 E4 F#4 G4 A4 B4"
)
interval handpan_annaziska(
  description:"Annaziska \u2014 Minor Pentatonic. Maximum consonance, impossible to play wrong.",
  culture:handpan,
  ratios(1, 6/5, 4/3, 3/2, 9/5),
  notes_count:5,
  layout:"D3 A3 C4 D4 F4 G4 A4 C5 D5"
)
interval handpan_ashta_taki(
  description:"Ashta Taki \u2014 Major without 6th. Bright, uplifting, rare major handpan.",
  culture:handpan,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 15/8),
  notes_count:6,
  layout:"D3 A3 C4 D4 E4 F4 G4 B4 C5"
)
interval flamenco_phrygian(
  description:"Flamenco mode / Phrygian Dominant \u2014 the defining sound of flamenco. Hijaz maqam equivalent.",
  culture:flamenco,
  ratios(1, 16/15, 5/4, 4/3, 3/2, 8/5, 9/5),
  notes_count:7
)
interval flamenco_por_medio(
  description:"Flamenco por medio \u2014 Phrygian mode on A (guitar standard). Dark, intense.",
  culture:flamenco,
  ratios(1, 16/15, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:7
)
interval flamenco_por_arriba(
  description:"Flamenco por arriba \u2014 Phrygian mode on E (guitar standard). Classic flamenco position.",
  culture:flamenco,
  ratios(1, 16/15, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:7
)
interval flamenco_double_harmonic(
  description:"Escala andaluza / Double Harmonic Major \u2014 Hijaz Kar / Bhairav equivalent in flamenco context.",
  culture:flamenco,
  ratios(1, 16/15, 5/4, 4/3, 3/2, 8/5, 15/8),
  notes_count:7
)
interval flamenco_minor(
  description:"Flamenco minor \u2014 Harmonic minor with Andalusian cadence (iv-III-II-I).",
  culture:flamenco,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 8/5, 15/8),
  notes_count:7
)
interval messiaen_mode1(
  description:"Messiaen mode 1 \u2014 Whole tone scale (6 equal divisions). Debussy, Messiaen.",
  culture:contemporary,
  ratios(1, 200c, 400c, 600c, 800c, 1000c),
  notes_count:6
)
interval messiaen_mode2(
  description:"Messiaen mode 2 \u2014 Octatonic / Diminished (half-whole). Messiaen, Bart\xF3k, Stravinsky.",
  culture:contemporary,
  ratios(1, 100c, 300c, 400c, 600c, 700c, 900c, 1000c),
  notes_count:8
)
interval messiaen_mode3(
  description:"Messiaen mode 3 \u2014 9 notes, period = major third (400c). Three transpositions.",
  culture:contemporary,
  ratios(1, 200c, 300c, 400c, 600c, 700c, 800c, 1000c, 1100c),
  notes_count:9
)
interval messiaen_mode4(
  description:"Messiaen mode 4 \u2014 8 notes, period = tritone (600c). Rare in practice.",
  culture:contemporary,
  ratios(1, 100c, 200c, 500c, 600c, 700c, 800c, 1100c),
  notes_count:8
)
interval messiaen_mode5(
  description:"Messiaen mode 5 \u2014 6 notes, period = tritone (600c).",
  culture:contemporary,
  ratios(1, 100c, 500c, 600c, 700c, 1100c),
  notes_count:6
)
interval messiaen_mode6(
  description:"Messiaen mode 6 \u2014 8 notes, period = tritone (600c). Augmented fourths.",
  culture:contemporary,
  ratios(1, 200c, 400c, 500c, 600c, 800c, 1000c, 1100c),
  notes_count:8
)
interval messiaen_mode7(
  description:"Messiaen mode 7 \u2014 10 notes, period = tritone (600c). Most dense of the modes.",
  culture:contemporary,
  ratios(1, 100c, 200c, 300c, 500c, 600c, 700c, 800c, 900c, 1100c),
  notes_count:10
)
interval chromatic_12(
  description:"Chromatic aggregate \u2014 all 12 pitch classes. Basis of serial/12-tone technique (Schoenberg, Webern, Boulez).",
  culture:contemporary,
  ratios(1, 100c, 200c, 300c, 400c, 500c, 600c, 700c, 800c, 900c, 1000c, 1100c),
  notes_count:12
)
interval spectral_harmonic_8(
  description:"Spectral scale (harmonics 8-16) \u2014 Grisey, Murail. Natural harmonic series from 8th partial.",
  culture:contemporary,
  ratios(1, 9/8, 10/8, 11/8, 12/8, 13/8, 14/8, 15/8),
  notes_count:8
)
interval spectral_harmonic_16(
  description:"Spectral scale (harmonics 1-16) \u2014 full harmonic series. Grisey Partiels, Haas.",
  culture:contemporary,
  ratios(1, 9/8, 5/4, 11/8, 3/2, 13/8, 7/4, 15/8),
  notes_count:8
)
interval bartok_acoustic(
  description:"Bart\xF3k scale / Acoustic scale / Lydian Dominant \u2014 Overtone scale (Bart\xF3k, Debussy).",
  culture:contemporary,
  ratios(1, 9/8, 5/4, 45/32, 3/2, 5/3, 9/5),
  notes_count:7
)
interval scriabin_mystic_chord(
  description:"Scriabin Mystic Chord / Prometheus scale \u2014 C F# Bb E A D as scale. Scriabin late works.",
  culture:contemporary,
  ratios(1, 200c, 400c, 600c, 900c, 1000c),
  notes_count:6
)
interval tritone_scale(
  description:"Tritone scale \u2014 Two augmented triads a semitone apart. Jazz/contemporary.",
  culture:contemporary,
  ratios(1, 100c, 400c, 500c, 800c, 900c),
  notes_count:6
)
interval slonimsky_1(
  description:"Slonimsky scale 1 \u2014 Symmetric division of octave in minor thirds + chromatic fill. Used by Coltrane.",
  culture:contemporary,
  ratios(1, 100c, 300c, 400c, 600c, 700c, 900c, 1000c),
  notes_count:8
)
interval harry_partch_43(
  description:"Harry Partch 43-tone scale \u2014 11-limit just intonation. Microtonal pioneer.",
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
interval wendy_carlos_alpha(
  description:"Wendy Carlos Alpha \u2014 15.385 steps per octave (78c per step). Non-octave scale.",
  culture:contemporary,
  ratios(1, 78c, 156c, 234c, 312c, 390c, 468c, 546c, 624c, 702c, 780c, 858c, 936c, 1014c, 1092c),
  notes_count:15
)
interval wendy_carlos_beta(
  description:"Wendy Carlos Beta \u2014 18.809 steps per octave (63.8c per step). Non-octave scale.",
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
interval bebop_dominant(
  description:"Bebop Dominant \u2014 Mixolydian + passing natural 7th. The quintessential bebop scale (Charlie Parker, Dizzy Gillespie).",
  culture:jazz,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 5/3, 9/5, 15/8),
  notes_count:8
)
interval bebop_major(
  description:"Bebop Major \u2014 Ionian + passing #5. Barry Harris method.",
  culture:jazz,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 800c, 5/3, 15/8),
  notes_count:8
)
interval bebop_dorian(
  description:"Bebop Dorian \u2014 Dorian + passing major 3rd. Minor bebop scale.",
  culture:jazz,
  ratios(1, 9/8, 6/5, 5/4, 4/3, 3/2, 5/3, 9/5),
  notes_count:8
)
interval bebop_melodic_minor(
  description:"Bebop Melodic Minor \u2014 Melodic minor ascending + passing b6. David Baker.",
  culture:jazz,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 800c, 5/3, 15/8),
  notes_count:8
)
interval altered(
  description:"Altered scale / Super Locrian \u2014 7th mode of melodic minor. Essential for V7alt chords (Coltrane, Shorter, Henderson).",
  culture:jazz,
  ratios(1, 16/15, 200c, 6/5, 600c, 800c, 9/5),
  notes_count:7
)
interval lydian_augmented(
  description:"Lydian Augmented \u2014 3rd mode of melodic minor. #4 + #5. George Russell Lydian Chromatic Concept.",
  culture:jazz,
  ratios(1, 9/8, 5/4, 600c, 800c, 5/3, 15/8),
  notes_count:7
)
interval lydian_dominant(
  description:"Lydian Dominant / Lydian b7 \u2014 4th mode of melodic minor. Dominant sound with #4. (= Bart\xF3k acoustic scale).",
  culture:jazz,
  ratios(1, 9/8, 5/4, 45/32, 3/2, 5/3, 9/5),
  notes_count:7
)
interval locrian_natural2(
  description:"Locrian #2 / Half-Diminished \u2014 6th mode of melodic minor. Used on minor7b5 chords.",
  culture:jazz,
  ratios(1, 9/8, 6/5, 4/3, 600c, 8/5, 9/5),
  notes_count:7
)
interval phrygian_dominant(
  description:"Phrygian Dominant \u2014 5th mode of harmonic minor. Hijaz. Used on V7b9 in minor keys.",
  culture:jazz,
  ratios(1, 16/15, 5/4, 4/3, 3/2, 8/5, 9/5),
  notes_count:7
)
interval pentatonic_major(
  description:"Major Pentatonic \u2014 1 2 3 5 6. Foundation of blues, rock, jazz melody.",
  culture:jazz,
  ratios(1, 9/8, 5/4, 3/2, 5/3),
  notes_count:5
)
interval pentatonic_minor(
  description:"Minor Pentatonic \u2014 1 b3 4 5 b7. The most universal scale in popular music.",
  culture:jazz,
  ratios(1, 6/5, 4/3, 3/2, 9/5),
  notes_count:5
)
interval coltrane_pentatonic(
  description:"Coltrane Pentatonic \u2014 1 2 3 5 b7. Dominant pentatonic used by Coltrane on V7 chords.",
  culture:jazz,
  ratios(1, 9/8, 5/4, 3/2, 9/5),
  notes_count:5
)
interval kumoi_jazz(
  description:"Kumoi (jazz usage) \u2014 1 2 b3 5 6. Japanese-influenced pentatonic popular in jazz (McCoy Tyner).",
  culture:jazz,
  ratios(1, 9/8, 6/5, 3/2, 5/3),
  notes_count:5
)
interval in_sen_jazz(
  description:"In-Sen \u2014 1 b2 4 5 b7. Japanese scale used in jazz (John McLaughlin, Joe Henderson).",
  culture:jazz,
  ratios(1, 16/15, 4/3, 3/2, 9/5),
  notes_count:5
)
interval augmented_scale(
  description:"Augmented scale \u2014 Symmetric scale alternating m3 and H. Coltrane, Thelonious Monk.",
  culture:jazz,
  ratios(1, 6/5, 5/4, 3/2, 8/5, 15/8),
  notes_count:6
)
interval tritone_dominant(
  description:"Tritone scale (dominant) \u2014 Two major triads a tritone apart. Mark Levine, modern jazz.",
  culture:jazz,
  ratios(1, 100c, 400c, 500c, 800c, 900c),
  notes_count:6
)
interval jins_rast(
  ratios(1, 9/8, 27/22, 4/3),
  description:"Jins Rast \u2014 t\xE9tracorde Rast \xE0 tierce neutre (C D E demi-b\xE9mol F). Tierce de Zalzal 27/22 (~354.5c) = signature musicologique de l'intonation juste arabe, PAS la tierce majeure 5/4 de Zarlino (qui donnerait un t\xE9tracorde Ajam). La donn\xE9e garde le ratio PUR (v\xE9rit\xE9 ontologique) ; la projection 24-TET (350c / 7 quarts de ton) est faite au rendu par le moteur."
)
interval jins_nahawand(
  ratios(1, 9/8, 6/5, 4/3),
  description:"Jins Nahawand \u2014 t\xE9tracorde mineur (C D Eb F)"
)
interval jins_kurd(
  ratios(1, 16/15, 6/5, 4/3),
  description:"Jins Kurd \u2014 t\xE9tracorde phrygien (C Db Eb F)"
)
interval jins_hijaz(
  ratios(1, 16/15, 5/4, 4/3),
  description:"Jins Hijaz \u2014 seconde augment\xE9e caract\xE9ristique (C Db E F)"
)
interval jins_bayati(
  ratios(1, 12/11, 6/5, 4/3),
  description:"Jins Bayati \u2014 seconde NEUTRE de Zalzal (C D-demi-b\xE9mol Eb F) : 12/11 (~151c), 6/5 (tierce mineure juste), 4/3. Intonation juste zalzalienne 5-limite (alt. pythagoricienne 32/27 pour la tierce ; on retient le juste 6/5 par coh\xE9rence du syst\xE8me arabe)."
)
interval jins_sikah(
  ratios(1, 12/11, 6/5, 4/3),
  description:"Jins Sikah \u2014 assise sur la seconde neutre de Zalzal (C D-demi-b\xE9mol Eb F) : 12/11 (~151c), 6/5, 4/3. Seconde neutre = 12/11 (coh\xE9rent avec la table arabe ; remplace l'ancien 11/10 ~165c)."
)
interval jins_ajam(
  ratios(1, 9/8, 5/4, 4/3),
  description:"Jins Ajam \u2014 t\xE9tracorde MAJEUR (C D E F) : 9/8 (ton), 5/4 (tierce majeure de Zarlino), 4/3 (quarte juste). C'est l'unique jins arabe \xE0 tierce majeure pure 5/4 (\u2248 majeur occidental). Le t\xE9tracorde ferme sur la quarte 4/3 (corrige l'ancien 45/32 triton, erron\xE9 pour un jins)."
)
interval jins_saba(
  ratios(1, 12/11, 6/5, 13/10),
  description:"Jins Saba \u2014 seconde neutre + tierce mineure + quarte DIMINU\xC9E (C D-demi-b\xE9mol Eb Fb) : 12/11, 6/5, 13/10 (~454c) ; la quarte diminu\xE9e est la signature du Saba."
)
interval cins_rast(
  system:"pythagorean",
  ratios(1, 9/8, 8192/6561, 4/3, 3/2),
  description:"Cins turc (cins_rast) \u2014 segment pythagoricien exact"
)
interval cins_rast4(
  system:"pythagorean",
  ratios(1, 9/8, 8192/6561, 4/3),
  description:"Cins turc (cins_rast4) \u2014 segment pythagoricien exact"
)
interval cins_ussak(
  system:"pythagorean",
  ratios(1, 65536/59049, 32/27, 4/3, 3/2),
  description:"Cins turc (cins_ussak) \u2014 segment pythagoricien exact"
)
interval cins_ussak4(
  system:"pythagorean",
  ratios(1, 65536/59049, 32/27, 4/3),
  description:"Cins turc (cins_ussak4) \u2014 segment pythagoricien exact"
)
interval cins_buselik4(
  system:"pythagorean",
  ratios(1, 9/8, 32/27, 4/3),
  description:"Cins turc (cins_buselik4) \u2014 segment pythagoricien exact"
)
interval cins_hicaz(
  system:"pythagorean",
  ratios(1, 2187/2048, 8192/6561, 4/3, 3/2),
  description:"Cins turc (cins_hicaz) \u2014 segment pythagoricien exact"
)
interval cins_buselik(
  system:"pythagorean",
  ratios(1, 9/8, 32/27, 4/3, 3/2),
  description:"Cins turc (cins_buselik) \u2014 segment pythagoricien exact"
)
interval cins_kurdi4(
  system:"pythagorean",
  ratios(1, 256/243, 32/27, 4/3),
  description:"Cins turc (cins_kurdi4) \u2014 segment pythagoricien exact"
)
interval cins_kurdi(
  system:"pythagorean",
  ratios(1, 256/243, 32/27, 4/3, 3/2),
  description:"Cins turc (cins_kurdi) \u2014 segment pythagoricien exact"
)
interval cins_segah(
  system:"pythagorean",
  ratios(1, 256/243, 9/8, 4/3, 3/2),
  description:"Cins turc (cins_segah) \u2014 segment pythagoricien exact"
)
interval cins_cargah4(
  system:"pythagorean",
  ratios(1, 256/243, 9/8, 4/3),
  description:"Cins turc (cins_cargah4) \u2014 segment pythagoricien exact"
)
interval cins_saba(
  system:"pythagorean",
  ratios(1, 65536/59049, 32/27, 81/64, 3/2),
  description:"Cins turc (cins_saba) \u2014 segment pythagoricien exact"
)
interval cins_huseyni4(
  system:"pythagorean",
  ratios(1, 65536/59049, 8192/6561, 4/3),
  description:"Cins turc (cins_huseyni4) \u2014 segment pythagoricien exact"
)
interval cins_segah4(
  system:"pythagorean",
  ratios(1, 256/243, 8192/6561, 4/3),
  description:"Cins turc (cins_segah4) \u2014 segment pythagoricien exact"
)
interval cins_huzzam(
  system:"pythagorean",
  ratios(1, 2187/2048, 32/27, 4/3, 3/2),
  description:"Cins turc (cins_huzzam) \u2014 segment pythagoricien exact"
)

degree bilaval(
  description:"Bilaval thaat \u2014 equivalent to Western major scale",
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 4, 7, 9, 13, 17, 20),
  notes_count:7
)
degree khamaj(
  description:"Khamaj thaat \u2014 komal Ni",
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 4, 7, 9, 13, 17, 18),
  notes_count:7
)
degree kafi(
  description:"Kafi thaat \u2014 komal Ga, komal Ni",
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 4, 5, 9, 13, 17, 18),
  notes_count:7
)
degree asavari(
  description:"Asavari thaat \u2014 komal Ga, Dha, Ni",
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 4, 5, 9, 13, 15, 18),
  notes_count:7
)
degree bhairavi(
  description:"Bhairavi thaat \u2014 all komal (Re, Ga, Dha, Ni)",
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 2, 5, 9, 13, 15, 18),
  notes_count:7
)
degree kalyan(
  description:"Kalyan thaat \u2014 tivra Ma",
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 4, 7, 11, 13, 17, 20),
  notes_count:7
)
degree marva(
  description:"Marva thaat \u2014 komal Re, tivra Ma",
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 2, 7, 11, 13, 17, 20),
  notes_count:7
)
degree purvi(
  description:"Purvi thaat \u2014 komal Re, tivra Ma, komal Dha",
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 2, 7, 11, 13, 15, 20),
  notes_count:7
)
degree todi(
  description:"Todi thaat \u2014 komal Re, Ga, tivra Ma, komal Dha",
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 2, 5, 11, 13, 15, 20),
  notes_count:7
)
degree shankarabharanam(
  description:"Shankarabharanam melakarta (72 #29) \u2014 equivalent to Bilaval/major",
  culture:carnatic,
  temperament:"22shruti",
  degrees(0, 4, 7, 9, 13, 17, 20),
  notes_count:7
)
degree kalyani(
  description:"Kalyani melakarta (72 #65) \u2014 equivalent to Kalyan/Lydian",
  culture:carnatic,
  temperament:"22shruti",
  degrees(0, 4, 7, 11, 13, 17, 20),
  notes_count:7
)
degree kharaharapriya(
  description:"Kharaharapriya melakarta (72 #22) \u2014 equivalent to Kafi/Dorian",
  culture:carnatic,
  temperament:"22shruti",
  degrees(0, 4, 5, 9, 13, 17, 18),
  notes_count:7
)
degree todi_carnatic(
  description:"Shubhapantuvarali melakarta (72 #45) \u2014 equivalent to Todi thaat",
  culture:carnatic,
  temperament:"22shruti",
  degrees(0, 2, 5, 11, 13, 15, 20),
  notes_count:7
)
degree harikambhoji(
  description:"Harikambhoji melakarta (72 #28) \u2014 equivalent to Khamaj/Mixolydian",
  culture:carnatic,
  temperament:"22shruti",
  degrees(0, 4, 7, 9, 13, 17, 18),
  notes_count:7
)
degree malkauns(
  description:"Raga Malkauns \u2014 audava (pentatonic), deep night raga",
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 5, 9, 15, 18),
  notes_count:5
)
degree thaat_bhairav(
  description:"Thaat Bhairav \u2014 komal re, shuddh ga, komal dha, shuddh ni. Double Harmonic Major. Morning raga.",
  culture:hindustani,
  temperament:"22shruti",
  degrees(0, 2, 7, 9, 13, 15, 20),
  notes_count:7
)
degree quarter_tone_chromatic(
  description:"Quarter-tone chromatic \u2014 24 equal divisions. Haba, Wyschnegradsky, Boulez (Marteau sans ma\xEEtre).",
  culture:contemporary,
  temperament:"24TET",
  degrees(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23),
  notes_count:24
)

directional bageshri(
  description:"Raga Bageshri \u2014 different notes in ascent and descent",
  culture:hindustani,
  temperament:"22shruti",
  ascending(0, 5, 9, 13, 15, 18),
  descending(0, 18, 17, 15, 13, 9, 5, 4),
  notes_count:7
)
directional raga_bhairav(
  description:"Raga Bhairav \u2014 aroha et avaroha diff\xE9rents. komal re et dha \xE0 la mont\xE9e, shuddh \xE0 la descente. Aroha = thaat Bhairav ; avaroha variante. L'aspect GAMME d'une raga vit ici ; l'intonation se dit par le temp\xE9rament r\xE9f\xE9renc\xE9.",
  culture:hindustani,
  temperament:"22shruti",
  ascending(0, 2, 7, 9, 13, 15, 20),
  descending(0, 4, 7, 9, 13, 17, 20),
  notes_count:7
)
directional raga_yaman(
  description:"Raga Yaman (Kalyan) \u2014 ma tivra \xE0 la mont\xE9e, shuddh \xE0 la descente dans certaines interpr\xE9tations. Aroha = thaat Kalyan.",
  culture:hindustani,
  temperament:"22shruti",
  ascending(0, 4, 7, 11, 13, 17, 20),
  descending(0, 4, 7, 9, 13, 17, 20),
  notes_count:7
)
directional darbari_kanada(
  description:"Raga Darbari Kanada \u2014 andolit komal Ga, majestic night raga",
  culture:hindustani,
  temperament:"22shruti",
  ascending(0, 4, 5, 9, 13, 15, 18),
  descending(0, 18, 15, 13, 9, 7, 5, 4),
  notes_count:7
)
directional desh(
  description:"Raga Desh \u2014 komal Ni in descent, romantic evening raga",
  culture:hindustani,
  temperament:"22shruti",
  ascending(0, 4, 7, 9, 13, 17, 20),
  descending(0, 20, 18, 17, 13, 9, 7, 4),
  notes_count:7
)
directional bihag(
  description:"Raga Bihag \u2014 both Ma used, late night raga",
  culture:hindustani,
  temperament:"22shruti",
  ascending(0, 4, 7, 11, 13, 17, 20),
  descending(0, 20, 17, 13, 11, 9, 7, 4),
  notes_count:7
)
directional melodic_minor(
  description:"Melodic minor \u2014 different ascending and descending forms",
  culture:western,
  ascending(1, 9/8, 6/5, 4/3, 3/2, 5/3, 15/8),
  descending(1, 9/8, 6/5, 4/3, 3/2, 8/5, 9/5),
  notes_count:7
)

composite maqam_ajam(
  description:"Maqam Ajam \u2014 equivalent to Western major \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source ontologique ; le moteur calcule les ratios depuis les jins].",
  culture:arabic,
  notes_count:7,
  system:"zalzal-ji",
  compose(jins_ajam, jins_ajam),
  junction:3/2
)
composite maqam_kurd(
  description:"Maqam Kurd \u2014 starts with jins Kurd \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source ontologique ; le moteur calcule les ratios depuis les jins].",
  culture:arabic,
  notes_count:7,
  system:"zalzal-ji",
  compose(jins_kurd, jins_kurd),
  junction:3/2
)
composite maqam_suznak(
  description:"Maqam Suznak \u2014 Rast lower + Hijaz upper \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source ontologique ; le moteur calcule les ratios depuis les jins].",
  culture:arabic,
  compose(jins_rast, jins_hijaz),
  junction:3/2,
  notes_count:7,
  system:"zalzal-ji"
)
composite maqam_nawa_athar(
  description:"Maqam Nawa Athar \u2014 double augmented second \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source].",
  culture:arabic,
  notes_count:7,
  system:"zalzal-ji",
  compose(jins_nikriz, jins_hijaz),
  junction:3/2
)
composite maqam_athar_kurd(
  description:"Maqam Athar Kurd \u2014 Kurd with augmented second \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source].",
  culture:arabic,
  notes_count:7,
  system:"zalzal-ji",
  compose(jins_athar_kurd, jins_hijaz),
  junction:3/2
)
composite maqam_hijaz_kar(
  description:"Maqam Hijaz Kar \u2014 double harmonic major \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source ontologique ; le moteur calcule les ratios depuis les jins].",
  culture:arabic,
  notes_count:7,
  system:"zalzal-ji",
  compose(jins_hijaz, jins_hijaz),
  junction:3/2
)
composite maqam_nikriz(
  description:"Maqam Nikriz \u2014 Nikriz tetrachord + Rast upper \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source ontologique ; le moteur calcule les ratios depuis les jins].",
  culture:arabic,
  compose(jins_nikriz, jins_rast),
  junction:3/2,
  notes_count:7,
  system:"zalzal-ji"
)
composite maqam_husayni(
  description:"Maqam Husayni \u2014 Bayati variant with Husayni emphasis \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source ontologique ; le moteur calcule les ratios depuis les jins].",
  culture:arabic,
  compose(jins_bayati, jins_bayati),
  junction:3/2,
  notes_count:7,
  system:"zalzal-ji"
)
composite maqam_farahfaza(
  description:"Maqam Farahfaza \u2014 Nahawand with Sikah flavor \u2014 Ratios = intonation juste zalzalienne (5-limite ; tierce neutre 27/22). Source de v\xE9rit\xE9 ; le 24-TET est une projection de rendu, pas l'ontologie. [compose(jins)+junction = source ontologique ; le moteur calcule les ratios depuis les jins].",
  culture:arabic,
  compose(jins_nahawand, jins_bayati),
  junction:3/2,
  notes_count:7,
  system:"zalzal-ji"
)
composite makam_rast(
  description:"Makam Rast \u2014 fundamental Turkish makam \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].",
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_rast, cins_rast4),
  junction:3/2
)
composite makam_ussak(
  description:"Makam Ussak \u2014 one of the most common Turkish makams \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].",
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_ussak, cins_ussak4),
  junction:3/2
)
composite makam_huseyni(
  description:"Makam Huseyni \u2014 similar to Ussak with different upper tetrachord \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].",
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_ussak, cins_buselik4),
  junction:3/2
)
composite makam_hicaz(
  description:"Makam Hicaz \u2014 augmented second in lower tetrachord \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].",
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_hicaz, cins_ussak4),
  junction:3/2
)
composite makam_nihavend(
  description:"Makam Nihavend \u2014 Turkish minor, similar to harmonic minor \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].",
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_buselik, cins_kurdi4),
  junction:3/2
)
composite makam_kurdi(
  description:"Makam Kurdi \u2014 starts with minor second \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].",
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_kurdi, cins_kurdi4),
  junction:3/2
)
composite makam_segah(
  description:"Makam Segah \u2014 starts on segah pitch, meditative character \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].",
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_segah, cins_cargah4),
  junction:3/2
)
composite makam_huzzam(
  description:"Makam Huzzam \u2014 Segah variant with diminished fifth \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].",
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_cargah4, cins_huzzam),
  junction:4/3
)
composite makam_saba(
  description:"Makam Saba \u2014 distinctive Turkish makam with narrow intervals \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].",
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_saba, cins_kurdi4),
  junction:3/2
)
composite makam_buselik(
  description:"Makam Buselik \u2014 Turkish natural minor equivalent \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].",
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_buselik, cins_ussak4),
  junction:3/2
)
composite makam_sultaniyegah(
  description:"Makam Sultaniyegah \u2014 Rast transposed, majestic character \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].",
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_rast, cins_huseyni4),
  junction:3/2
)
composite makam_karcigar(
  description:"Makam Karcigar \u2014 mixed Turkish-Arabic makam \u2014 Ratios = Pythagore (3-limite, cha\xEEne de quintes du syst\xE8me ottoman 53-comma Arel-Ezgi-Uzdilmek). Source de v\xE9rit\xE9 ; le 53-TET est une projection. [syst\xE8me turc : Pythagore (3-limite) ; cins = segments exacts ; nom = famille (provisoire pour les d\xF6rtl\xFC rares)].",
  culture:turkish,
  notes_count:7,
  system:"pythagorean",
  compose(cins_ussak, cins_segah4),
  junction:3/2
)
composite maqam_rast(
  description:"Maqam Rast \u2014 Rast + Rast sur la quinte [compose(jins)+junction = source ; le moteur calcule les ratios depuis les jins].",
  culture:arabic,
  system:"zalzal-ji",
  compose(jins_rast, jins_rast),
  junction:3/2
)
composite maqam_nahawand(
  description:"Maqam Nahawand \u2014 Nahawand (bas) + Kurd (haut) [compose(jins)+junction = source ; le moteur calcule les ratios depuis les jins].",
  culture:arabic,
  system:"zalzal-ji",
  compose(jins_nahawand, jins_kurd),
  junction:3/2
)
composite maqam_hijaz(
  description:"Maqam Hijaz \u2014 Hijaz (bas) + Rast (haut) [compose(jins)+junction = source ; le moteur calcule les ratios depuis les jins].",
  culture:arabic,
  system:"zalzal-ji",
  compose(jins_hijaz, jins_rast),
  junction:3/2
)
composite maqam_bayati(
  description:"Maqam Bayati \u2014 Bayati (bas) + Nahawand (haut) [compose(jins)+junction = source ; le moteur calcule les ratios depuis les jins].",
  culture:arabic,
  system:"zalzal-ji",
  compose(jins_bayati, jins_nahawand),
  junction:3/2
)
composite maqam_saba(
  description:"Maqam Saba \u2014 Saba (bas) + Hijaz (haut) + Rast (tr\xE8s haut, 3 jins) [compose(jins)+junction = source ; le moteur calcule les ratios depuis les jins].",
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
`, "fichier": "settings/notreich.json" }, { "nom": "settings/pattern_grammar", "format": "json", "texte": '{\n  "documented": false,\n  "AllItems": {\n    "name": "Produce all items",\n    "value": "1",\n    "boolean": "1"\n  },\n  "MaxItemsProduce": {\n    "name": "Max items to produce",\n    "value": "20",\n    "boolean": "0"\n  },\n  "AllowRandomize": {\n    "name": "Allow randomize",\n    "value": "1",\n    "boolean": "1"\n  }\n}', "fichier": "settings/pattern_grammar.json" }, { "nom": "settings/test1", "format": "json", "texte": '{\n  "documented": false,\n  "AllItems": {\n    "name": "Produce all items",\n    "value": "1",\n    "boolean": "1"\n  },\n  "MaxItemsProduce": {\n    "name": "Max items to produce",\n    "value": "50",\n    "boolean": "0"\n  },\n  "Quantization": {\n    "name": "Quantization",\n    "value": "5",\n    "unit": "ms",\n    "boolean": "0"\n  }\n}', "fichier": "settings/test1.json" }, { "nom": "settings", "format": "bpsl", "texte": '// @documented\ndef settings(\n  resolvedBy:BPx,\n  resolves:settings,\n  name:settings,\n  description:"Default BP3 engine settings. Overridden by @ directives. Used to generate the settings string for bp3_load_settings().",\n  version:"0.2.0",\n  section:bp3_defaults\n)\n\ndef Quantization(name:Quantization, value:"10", unit:ms, boolean:"0")\n\ndef Quantize(name:Quantize, value:"1", boolean:"1")\n\ndef Time_res(name:"Time resolution", value:"10", unit:ms, boolean:"0")\n\ndef MIDIsyncDelay(name:"MIDI sync delay", value:"100", unit:ms, boolean:"0")\n\ndef Nature_of_time(name:"Nature of time", value:"1", boolean:"0")\n\ndef NoteConvention(name:"Note convention", value:"0", boolean:"0")\n\ndef Pclock(name:"P clock", value:"1", boolean:"0")\n\ndef Qclock(name:"Q clock", value:"1", boolean:"0")\n\ndef ShowGraphic(name:"Show graphic", value:"0", boolean:"1")\n\ndef ShowObjectGraph(name:"Show object graphic", value:"0", boolean:"1")\n\ndef ShowPianoRoll(name:"Show piano roll", value:"0", boolean:"1")\n\ndef GraphicScaleP(name:"Graphic scale P", value:"0", boolean:"0")\n\ndef GraphicScaleQ(name:"Graphic scale Q", value:"0", boolean:"0")\n\ndef DisplayItems(name:"Display items", value:"1", boolean:"1")\n\ndef DisplayProduce(name:"Display produce", value:"0", boolean:"1")\n\ndef SplitTimeObjects(name:"Split time objects", value:"1", boolean:"1")\n\ndef SplitVariables(name:"Split variables", value:"0", boolean:"1")\n\ndef CsoundTrace(name:"Csound trace", value:"0", boolean:"1")\n\ndef Improvize(name:Improvize, value:"0", boolean:"1")\n\ndef DeftBufferSize(name:"Default buffer size", value:"1000", boolean:"0")\n\ndef ComputeWhilePlay(name:"Compute while playing", value:"1", boolean:"1")\n\ndef MaxConsoleTime(name:"Max console time", value:"60", boolean:"0")\n\ndef ResetNotes(name:"Reset notes between items", value:"1", boolean:"1")\n\ndef ResetWeights(name:"Reset rule weights", value:"1", boolean:"1")\n\ndef ResetFlags(name:"Reset flags", value:"1", boolean:"1")\n\ndef ResetControllers(name:"Reset controllers", value:"0", boolean:"1")\n\ndef EndFadeOut(name:"End fade out", value:"2.00", boolean:"0")\n\ndef C4key(name:"C4 key number", value:"60", boolean:"0")\n\ndef A4freq(name:"A4 frequency", value:"440.0000", boolean:"0")\n\ndef StrikeAgainDefault(name:"Strike again default", value:"1", boolean:"0")\n\ndef DeftVolume(name:"Default volume", value:"90", boolean:"0")\n\ndef VolumeController(name:"Volume controller", value:"7", boolean:"0")\n\ndef DeftVelocity(name:"Default velocity", value:"64", boolean:"0")\n\ndef DeftPanoramic(name:"Default panoramic", value:"64", boolean:"0")\n\ndef PanoramicController(name:"Panoramic controller", value:"10", boolean:"0")\n\ndef SamplingRate(name:"Sampling rate", value:"50", boolean:"0")\n\ndef TraceMicrotonality(name:"Trace microtonality", value:"0", boolean:"1")\n\ndef DisplayTimeSet(name:"Display time set", value:"0", boolean:"1")\n\ndef AllItems(name:"Produce all items", value:"0", boolean:"1")\n\ndef MaxItemsProduce(name:"Max items to produce", value:"20", boolean:"0")\n\ndef Seed(name:"Random seed", value:"0", boolean:"0")\n\ndef improvize(section:directive_map, Improvize:"1")\n\ndef allitems(section:directive_map, AllItems:"1", Improvize:"0")\n\ndef all_items(section:directive_map, AllItems:"1", Improvize:"0")\n\ndef maxitems(section:directive_map, MaxItemsProduce:"@value")\n\ndef items(section:directive_map, MaxItemsProduce:"@value")\n\ndef quantize(section:directive_map, Quantization:"@value")\n\ndef quantization(section:directive_map, Quantization:"@value")\n\ndef qclock(section:directive_map, Qclock:"@value")\n\ndef seed(section:directive_map, Seed:"@value")\n\ndef vel(section:directive_map, DeftVelocity:"@value")\n\ndef pan(section:directive_map, DeftPanoramic:"@value")\n\ndef volume(section:directive_map, DeftVolume:"@value")\n\ndef a4(section:directive_map, A4freq:"@value")\n\ndef timeres(section:directive_map, Time_res:"@value")\n\ndef note_conventions(section:"", western:1, raga:2, keys:3)\n', "fichier": "settings.bpsl" }, { "nom": "sounds", "format": "bpsl", "texte": `types

// @documented
def sounds(resolvedBy:"BPx", resolves:sound, name:sounds)

sound tabla_perc(
  description:"Percussions de tabla \u2014 bols de bayan (grave) et de dayan (aigu). Prototype AUX D\xC9FAUTS MOTEUR : il ne surcharge aucune propri\xE9t\xE9 m\xE9trique. Invoqu\xE9 par dhati, dhin et leurs jumelles (6 sc\xE8nes du corpus). Le nom vient du corpus, pas d'un catalogue externe."
)
`, "fichier": "sounds.bpsl" }, { "nom": "temperaments", "format": "bpsl", "texte": `types

// @documented
def temperaments(resolvedBy:Kairos, resolves:temperament)

temperament 12TET(
  description:"Equal temperament, 12 divisions of the octave",
  period_ratio:2,
  divisions:12,
  ratios(1, 100c, 200c, 300c, 400c, 500c, 600c, 700c, 800c, 900c, 1000c, 1100c)
)

temperament 24TET(
  description:"Quarter-tone equal temperament, 24 divisions of the octave",
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

temperament 53TET(
  description:"Holdrian comma system, 53 divisions of the octave. Used in Turkish makam theory. 1 step \u2248 22.64 cents.",
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

temperament pythagorean(
  description:"Pythagorean tuning \u2014 pure fifths (3/2). Comma: 531441/524288 \u2248 23.46 cents.",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 729/512, 3/2, 128/81, 27/16, 16/9, 243/128)
)

temperament just_5limit(
  description:"5-limit just intonation \u2014 pure thirds and fifths.",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 5/4, 4/3, 45/32, 3/2, 8/5, 5/3, 9/5, 15/8)
)

temperament meantone_quarter(
  description:"1/4-comma meantone \u2014 major thirds exactly 5/4. Fifths narrowed by 1/4 syntonic comma.",
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

temperament 22shruti(
  description:"22 shruti \u2014 Indian tradition, 5-limit just intonation. Unequal steps (pramana ~22c, nyuna ~70c, purna ~90c).",
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

temperament bohlen_pierce_just(
  description:"Bohlen-Pierce just \u2014 7-limit, tritave (3:1). 13 steps.",
  period_ratio:3,
  divisions:13,
  ratios(1, 27/25, 25/21, 9/7, 7/5, 75/49, 5/3, 9/5, 49/25, 15/7, 7/3, 63/25, 25/9)
)

temperament bohlen_pierce_equal(
  description:"Bohlen-Pierce equal \u2014 13 equal divisions of the tritave (3:1).",
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

temperament gamelan_pelog(
  description:"Gamelan pelog \u2014 7-tone, Central Javanese approximation. Stretched octave. Varies by ensemble.",
  period_ratio:2.02,
  divisions:7,
  ratios(1, 1.126, 1.244, 1.351, 1.496, 1.683, 1.894)
)

temperament gamelan_slendro(
  description:"Gamelan slendro \u2014 near-equal pentatonic, Central Javanese approximation. Stretched octave.",
  period_ratio:2.01,
  divisions:5,
  ratios(1, 1.143, 1.317, 1.516, 1.741)
)

temperament bp3_Abmaj(
  description:"This is a reduction to 12 grades of scale ""Ma05"" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'Bb' Created on 2021-01-05 18:34:29 Scale aligned ratio 1.0125 (2022-03-11 07:57:41)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 4/3, 64/45, 3/2, 8/5, 27/16, 9/5, 243/128),
  comma:81/80
)

temperament bp3_Abmin(
  description:"This is a reduction to 12 grades of scale ""Ma08"" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:09:51 Scale aligned ratio 1.0125 (2022-03-11 07:56:59)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 64/45, 3/2, 405/256, 27/16, 3645/2048, 243/128),
  comma:81/80
)

temperament bp3_Amaj(
  description:"This is a reduction to 12 grades of scale ""Ma10"" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'B' Created 2021-01-05 18:56:02",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 243/128),
  comma:81/80
)

temperament bp3_Amin(
  description:"This is a reduction to 12 grades of scale ""Ma01"" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:00:08",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 10/9, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

temperament bp3_Bbmaj(
  description:"This is a reduction to 12 grades of scale ""Ma03"" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'C' Created 2021-01-05 18:31:20",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 10/9, 32/27, 5/4, 4/3, 45/32, 40/27, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

temperament bp3_Bbmin(
  description:"This is a reduction to 12 grades of scale ""Ma06"" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:08:40",
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:12,
  ratios(80/81, 256/243, 10/9, 75/64, 5/4, 320/243, 45/32, 40/27, 128/81, 5/3, 225/128, 15/8),
  comma:81/80
)

temperament bp3_Bmaj(
  description:"This is a reduction to 12 grades of scale ""Ma08"" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'Db' Created 2021-01-05 19:37:40",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 32/27, 81/64, 4/3, 729/512, 3/2, 128/81, 27/16, 16/9, 243/128),
  comma:81/80
)

temperament bp3_Bmin(
  description:"This is a reduction to 12 grades of scale ""Ma11"" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:12:50",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 15/8),
  comma:81/80
)

temperament bp3_Cmaj(
  description:"This is a reduction to 12 grades of scale ""Ma01"" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'D' Created 2021-01-05 18:29:30",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

temperament bp3_Cmin(
  description:"This is a reduction to 12 grades of scale ""Ma04"" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 17:49:25",
  source:"Bernard Bel / Bol Processor",
  period_ratio:1.9753,
  divisions:12,
  ratios(80/81, 256/243, 10/9, 32/27, 5/4, 320/243, 45/32, 40/27, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

temperament bp3_Dbmaj(
  description:"This is a reduction to 12 grades of scale ""Ma06"" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'Eb' Created 2021-01-05 18:35:44Scale aligned ratio 1.0125 (2022-03-11 07:59:19)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 4/3, 64/45, 3/2, 8/5, 27/16, 3645/2048, 243/128),
  comma:81/80
)

temperament bp3_Dbmin(
  description:"This is a reduction to 12 grades of scale ""Ma09"" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:10:26 Scale aligned ratio 1.0125 (2022-03-11 07:59:30)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 45/32, 3/2, 405/256, 27/16, 3645/2048, 243/128),
  comma:81/80
)

temperament bp3_Dmaj(
  description:"This is a reduction to 12 grades of scale ""Ma11"" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'E' Created 2021-01-05 18:48:23",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 15/8),
  comma:81/80
)

temperament bp3_Dmin(
  description:"This is a reduction to 12 grades of scale ""Ma02"" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:06:48",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 10/9, 32/27, 5/4, 4/3, 45/32, 40/27, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

temperament bp3_Ebmaj(
  description:"This is a reduction to 12 grades of scale ""Ma04"" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'F' Created 2021-01-05 18:33:09Scale aligned ratio 1.0125 (2022-03-11 07:50:02)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 27/20, 64/45, 3/2, 8/5, 27/16, 9/5, 243/128),
  comma:81/80
)

temperament bp3_Ebmin(
  description:"This is a reduction to 12 grades of scale ""Ma07"" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:09:20 Scale aligned ratio 1.0125 (2022-03-11 07:59:38)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 32/27, 81/64, 4/3, 64/45, 3/2, 405/256, 27/16, 3645/2048, 243/128),
  comma:81/80
)

temperament bp3_Emaj(
  description:"This is a reduction to 12 grades of scale ""Ma09"" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'F#' Created 2021-01-05 19:38:38",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 729/512, 3/2, 128/81, 27/16, 16/9, 243/128),
  comma:81/80
)

temperament bp3_Emin(
  description:"This is a reduction to 12 grades of scale ""Ma12"" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:13:25",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

temperament bp3_F_maj(
  description:"This is a reduction to 12 grades of scale ""Ma07"" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'Ab' Created 2021-01-05 19:36:32",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 32/27, 81/64, 4/3, 729/512, 3/2, 8/5, 27/16, 16/9, 243/128),
  comma:81/80
)

temperament bp3_F_min(
  description:"This is a reduction to 12 grades of scale ""Ma10"" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:10:57",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 15/8),
  comma:81/80
)

temperament bp3_Fmaj(
  description:"This is a reduction to 12 grades of scale ""Ma02"" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'G' Created 2021-01-05 18:30:32",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 10/9, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

temperament bp3_Fmin(
  description:"This is a reduction to 12 grades of scale ""Ma05"" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:07:58 Scale aligned ratio 1.0125 (2022-03-11 07:59:51)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 4/3, 64/45, 3/2, 8/5, 27/16, 3645/2048, 243/128),
  comma:81/80
)

temperament bp3_Gmaj(
  description:"This is a reduction to 12 grades of scale ""Ma12"" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'A' Created 2021-01-05 18:49:22",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 15/8),
  comma:81/80
)

temperament bp3_Gmin(
  description:"This is a reduction to 12 grades of scale ""Ma03"" (23 grades) in \u2018-cs.12_scales\u2019 Created 2021-01-05 18:15:32Scale aligned ratio 1.0125 (2022-03-11 07:54:43)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 27/20, 64/45, 3/2, 8/5, 27/16, 9/5, 243/128),
  comma:81/80
)

temperament bp3_Ma01(
  description:"Scale ""Ma01"" from Bernard Bel / Bol Processor",
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

temperament bp3_Ma02(
  description:"This is a transposition of scale ""Ma01"" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2020-11-28 16:51:26",
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

temperament bp3_Ma03(
  description:"This is a transposition of scale ""Ma2"" (23 grades) From \u2018C\u2019 to \u2018F\u2019 Created 2020-11-27 18:26:51",
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

temperament bp3_Ma04(
  description:"This is a transposition of scale ""Ma3"" (23 grades) From \u2018E\u2019 to \u2018A\u2019 Created 2020-11-27 19:34:18",
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

temperament bp3_Ma05(
  description:"This is a transposition of scale ""Ma4"" (23 grades) From \u2018Eb\u2019 to \u2018Ab\u2019 Created 2020-11-28 07:25:59",
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

temperament bp3_Ma06(
  description:"This is a transposition of scale ""Ma5"" (23 grades) From \u2018D\u2019 to \u2018G\u2019 Created 2020-11-28 07:48:18",
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

temperament bp3_Ma07(
  description:"This is a transposition of scale ""Ma6"" (23 grades) From \u2018D\u2019 to \u2018G\u2019 Created 2020-11-28 08:01:21",
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

temperament bp3_Ma08(
  description:"This is a transposition of scale ""Ma7"" (23 grades) From \u2018C\u2019 to \u2018F\u2019 Created 2020-11-28 08:11:34",
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

temperament bp3_Ma09(
  description:"This is a transposition of scale ""Ma08"" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2020-11-28 19:09:43",
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

temperament bp3_Ma10(
  description:"This is a transposition of scale ""Ma09"" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 17:41:33",
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

temperament bp3_Ma11(
  description:"This is a transposition of scale ""Ma10"" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:42:40",
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

temperament bp3_Ma12(
  description:"This is a transposition of scale ""Ma11"" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:43:43",
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

temperament bp3_Ma13(
  description:"This is a transposition of scale ""Ma12"" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:44:52",
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

temperament bp3_Ma_grama(
  description:"Scale ""Ma_grama"" from Bernard Bel / Bol Processor",
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

temperament bp3_Sa01(
  description:"This is a derivation of scale ""Ma01"" (23 grades) in major tonality. Sensitive note = 'D' Created 2020-12-05 21:18:01",
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

temperament bp3_Sa02(
  description:"This is a derivation of scale ""Ma02"" (23 grades) in major tonality. Sensitive note = 'G' Created 2020-12-05 21:18:59",
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

temperament bp3_Sa03(
  description:"This is a derivation of scale ""Ma03"" (23 grades) in major tonality. Sensitive note = 'C' Created 2020-12-05 22:00:48",
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

temperament bp3_Sa04(
  description:"This is a derivation of scale ""Ma04"" (23 grades) in major tonality. Sensitive note = 'F' Created 2020-12-05 21:26:05",
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

temperament bp3_Sa05(
  description:"This is a derivation of scale ""Ma05"" (23 grades) in major tonality. Sensitive note = 'Bb' Created 2020-12-05 21:26:54",
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

temperament bp3_Sa06(
  description:"This is a derivation of scale ""Ma06"" (23 grades) in major tonality. Sensitive note = 'Eb' Created 2020-12-05 21:27:42",
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

temperament bp3_Sa07(
  description:"This is a derivation of scale ""Ma07"" (23 grades) in major tonality. Sensitive note = 'Ab' Created 2020-12-05 21:28:36",
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

temperament bp3_Sa08(
  description:"This is a derivation of scale ""Ma08"" (23 grades) in major tonality. Sensitive note = 'Db' Created 2020-12-05 21:29:15",
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

temperament bp3_Sa09(
  description:"This is a derivation of scale ""Ma09"" (23 grades) in \u2018-cs.12_scales\u2019 in major tonality. Sensitive note = 'F#' Created 2021-01-05 14:44:42",
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

temperament bp3_Sa10(
  description:"This is a transposition of scale ""Sa09"" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:11:29",
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

temperament bp3_Sa11(
  description:"This is a transposition of scale ""Sa10"" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:49:01",
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

temperament bp3_Sa12(
  description:"This is a transposition of scale ""Sa11"" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:51:22",
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

temperament bp3_Sa13(
  description:"This is a transposition of scale ""Sa12"" (23 grades). From \u2018C\u2019 to \u2018F\u2019. Created 2021-01-05 15:52:00",
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

temperament bp3_base(
  description:"A ""5-limit"" tuning framework for constructing chromatic scales using exclusively ratios of integers 2, 3, 5. Read: http://www.tonalsoft.com/enc/j/just.aspx",
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

temperament bp3_grama(
  description:"The Indian grama scale as conceptualized by E. J. Arnold. Publication: \u2018L'intonation juste dans la th\xE9orie ancienne de l'Inde : les applications aux musiques modale et harmonique\u2019. Revue de Musicologie, vol. 71c n\xB0 1-2, 1985, p. 11-38. Edited and translated by Bernard Bel This version has been modified to define 22 notes on 23 intervals: it has no ""m4"" (Ma tivra + pramana shruti).",
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

temperament bp3_2_cycles_of_fifths(
  description:"Two series of perfect fifths including ascending major thirds (Asselin 2000 p.62) Created 2021-01-08 09:02:23",
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

temperament bp3_3_cycles_of_fifths(
  description:"Three series of perfect fifths including ascending and descending major thirds (Asselin 2000 p.62) Created 2021-01-08 09:02:23",
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

temperament bp3_Zarlino_temp(
  description:"Created meantone upwards notes \u201Cdo, sol, re, la, mi, si, fa#, do#, sol#\u201D ratio 3/2 -2/7 comma (2021-01-11 18:00:22) Created meantone downwards notes \u201Cdo, fa, sib, mib\u201D ratio 3/2 -2/7 comma (2021-01-11 18:05:45) Created meantone upwards notes \u201Cdo, sol\u201D ratio 3/2 -2/7 comma (2021-01-11 18:06:40)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.042, 1.117, 1.198, 1.248, 1.338, 1.394, 1.495, 1.557, 1.67, 1.79, 1.865),
  comma:81/80
)

temperament bp3_Zarlino_temp2(
  description:"Created 2021-01-14 09:31:50 Created meantone upward notes \u201Cdo,mi,sol2#\u201D fraction 5/4 (2021-01-14 09:32:46) Created meantone downward notes \u201Csol2#,do#\u201D fraction 3/2 (2021-01-14 09:33:55) Equalized intervals over series \u201Cdo,sol,re,la,mi,si,fa#,do#\u201D approx fraction 3/2 adjusted -6.1 cents to ratio = 1.495 (2021-01-14 09:34:42) Created meantone downward notes \u201Csol,mib\u201D fraction 5/4 (2021-01-14 09:37:02) Equalized intervals over series \u201Cmib,sib,fa,do\u201D approx fraction 3/2 adjusted -5.2 cents to ratio = 1.495 (2021-01-14 09:38:54)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:13,
  ratios(1, 1.042, 1.117, 1.196, 1.248, 1.25, 1.337, 1.394, 1.495, 1.563, 1.67, 1.789, 1.865),
  comma:81/80
)

temperament bp3_meantone_BACH(
  description:"Kellner's BACH meantone temperament (Asselin 2000 p.101) Created 2021-01-15 16:02:04Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/5 comma (2021-01-15 16:10:04) Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-15 16:11:48) Created meantone upward notes \u201Cmi,si\u201D fraction 3/2 (2021-01-15 16:13:36)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.119, 1.185, 1.253, 1.333, 1.406, 1.496, 1.58, 1.675, 1.778, 1.88),
  comma:81/80
)

temperament bp3_meantone_barca(
  description:"Barca meantone temperament (Asselin 2000 p.106) Created 2021-01-16 17:56:02 Added fifths down: \u201Cdo,fa,sib\u201D starting fraction 1/1 (2021-01-16 17:57:57) Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#\u201D fraction 3/2 adjusted -1/6 comma (2021-01-16 18:02:25) Created meantone upward notes \u201Cfa#,do#,sol#,re#\u201D fraction 3/2 (2021-01-16 18:03:49)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.055, 1.12, 1.186, 1.255, 1.333, 1.406, 1.497, 1.582, 1.677, 1.778, 1.879),
  comma:81/80
)

temperament bp3_meantone_bethisy(
  description:"B\xE9thisy meantone temperament (Asselin 2000 p.121) Created 2021-01-16 19:21:57 Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:23:36) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 19:25:49) Created meantone downward notes \u201Cmib,sol#\u201D fraction 3/2 (2021-01-16 19:26:26) Equalized intervals over series \u201Cmi,si,fa#,do#,sol#\u201D approx fraction 3/2 adjusted -1.7 cents to ratio = 1.499 (2021-01-16 19:28:09)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.052, 1.118, 1.182, 1.25, 1.332, 1.404, 1.495, 1.576, 1.672, 1.774, 1.873),
  comma:81/80
)

temperament bp3_meantone_chaumont(
  description:"Chaumont meantone temperament (Asselin 2000 p.109) Created 2021-01-16 18:06:34 Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:08:41) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:09:41)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.196, 1.25, 1.337, 1.398, 1.495, 1.563, 1.672, 1.789, 1.869),
  comma:81/80
)

temperament bp3_meantone_classic(
  description:"This is an equal-tempered scale for BP3 + Csound. Created 2021-01-14 15:38:08 Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-14 15:40:20) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/4 comma (2021-01-14 15:40:57) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/4 comma (2021-01-14 15:43:44)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.196, 1.25, 1.337, 1.398, 1.495, 1.563, 1.672, 1.789, 1.869),
  comma:81/80
)

temperament bp3_meantone_corrette(
  description:"Corrette meantone temperament (Asselin 2000 p.111) Created 2021-01-16 18:13:10 Created meantone upward notes \u201Cfa,do,sol,re,la,mi,si,fa#,do#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:16:40) Created meantone downward notes \u201Cfa,sib,mib\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 18:34:13) Created meantone upward notes \u201Cdo#,sol#\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 18:38:14) Base note reset to \u2018do\u2019 (2021-01-16 18:40:53)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.187, 1.25, 1.338, 1.398, 1.496, 1.569, 1.672, 1.782, 1.87),
  comma:81/80
)

temperament bp3_meantone_d_alembert_rousseau(
  description:"D'Alembert-Rousseau meantone temperament (Asselin 2000 p.119) Created 2021-01-16 19:04:44 Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:12:08) Created meantone downward notes \u201Cdo,fa,sib,mib,sol#\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 19:17:25) Equalized intervals over series \u201Csol#,do#,fa#,si,mi\u201D approx fraction 2/3 adjusted 2.2 cents to ratio = 0.668 (2021-01-16 19:19:34)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.051, 1.118, 1.182, 1.25, 1.332, 1.403, 1.495, 1.574, 1.672, 1.774, 1.873),
  comma:81/80
)

temperament bp3_meantone_kirnberger_2(
  description:"Kirnberger II meantone temperament (Asselin 2000 p. 90) Created 2021-01-16 11:52:39 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb\u201D starting fraction 1/1 (2021-01-16 11:54:59) Added fifths up: \u201Cdo,sol,re\u201D starting fraction 1/1 (2021-01-16 11:55:59) Created meantone upward notes \u201Cre,la,mi\u201D fraction 3/2 adjusted -1/2 comma (2021-01-16 11:57:13) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 11:58:24)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.125, 1.185, 1.25, 1.333, 1.406, 1.5, 1.58, 1.677, 1.778, 1.875),
  comma:81/80
)

temperament bp3_meantone_kirnberger_3(
  description:"Kirnberger III meantone temperament (Asselin 2000 p.92) Created 2021-01-16 12:02:11 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb\u201D starting fraction 1/1 (2021-01-16 12:03:52) Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 12:05:20) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 12:06:10)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.118, 1.185, 1.25, 1.333, 1.406, 1.495, 1.58, 1.672, 1.778, 1.875),
  comma:81/80
)

temperament bp3_meantone_marpourg(
  description:"Marpourg meantone temperament (Asselin 2000 p.117) Created 2021-01-16 18:58:49 Created meantone upward notes \u201Cfa,do,sol,re,la,mi,si,fa#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:00:42) Equalized intervals over series \u201Cfa,la#,re#,sol#,do#,fa#\u201D approx fraction 2/3 adjusted -2.8 cents to ratio = 0.666 (2021-01-16 19:02:32) Base note reset to \u2018do\u2019 (2021-01-16 19:03:15)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.05, 1.118, 1.185, 1.25, 1.338, 1.398, 1.496, 1.577, 1.672, 1.781, 1.87),
  comma:81/80
)

temperament bp3_meantone_pure_minor-thirds(
  description:"Pure minor-thirds temperament (Asselin 2000 p.82) Created 2021-01-15 15:13:09 Created meantone upward notes \u201Cmib,sib,fa,do,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-15 15:15:22) Base note reset to \u2018do\u2019 (2021-01-15 15:16:00)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.037, 1.116, 1.2, 1.244, 1.339, 1.388, 1.494, 1.549, 1.666, 1.792, 1.86),
  comma:81/80
)

temperament bp3_meantone_rameau_en_do(
  description:"Rameau meantone in C temperament (Asselin 2000 p.113) Created 2021-01-16 18:41:56 Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:44:03) Added fifths down: \u201Cdo,fa\u201D starting fraction 1/1 (2021-01-16 18:49:25) Created meantone upward notes \u201Cdo#,sol#\u201D fraction 3/2 adjusted -1/12 comma (2021-01-16 18:51:19) Created meantone downward notes \u201Cfa,la#\u201D fraction 3/2 (2021-01-16 18:54:20) Equalized intervals over series \u201Csol#,re#,la#\u201D approx fraction 3/2 adjusted 7.5 cents to ratio = 1.506 (2021-01-16 18:55:25)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.18, 1.25, 1.333, 1.398, 1.495, 1.566, 1.672, 1.777, 1.869),
  comma:81/80
)

temperament bp3_meantone_sauveur(
  description:"Sauveur meantone temperament (Asselin 2000 p. 81) Created 2021-01-16 10:37:52 Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/5 comma (2021-01-16 10:44:41) Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/5 comma (2021-01-16 10:48:56)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.049, 1.119, 1.194, 1.253, 1.337, 1.403, 1.496, 1.57, 1.675, 1.787, 1.875),
  comma:81/80
)

temperament bp3_meantone_schlick(
  description:"Schlick meantone temperament (Asselin 2000 p.88) Created 2021-01-16 10:56:35 Created meantone downward notes \u201Cla,re,sol,do,fa\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 10:58:50) Created meantone upward notes \u201Cla,mi,si\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 10:59:48) Created meantone upward notes \u201Cla,do#\u201D fraction 5/4 (2021-01-16 11:04:11) Equalized intervals over series \u201Csi,fa#,do#\u201D approx fraction 3/2 adjusted -5.4 cents to ratio = 1.495 (2021-01-16 11:05:59) Created meantone downward notes \u201Csol,mib\u201D fraction 5/4 (2021-01-16 11:07:31) Equalized intervals over series \u201Cmib,sib,fa\u201D approx fraction 3/2 adjusted -5.3 cents to ratio = 1.495 (2021-01-16 11:08:47) Created meantone downward notes \u201Cdo,lab\u201D fraction 5/4 (2021-01-16 11:13:58) Created meantone upward notes \u201Cmi,sol#\u201D fraction 5/4 adjusted 2/3 comma (2021-01-16 11:23:39) [estimation] Base note reset to \u2018do\u2019 (2021-01-16 11:25:48)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:13,
  ratios(1, 1.045, 1.118, 1.196, 1.25, 1.338, 1.398, 1.496, 1.575, 1.6, 1.672, 1.789, 1.87),
  comma:81/80
)

temperament bp3_meantone_tartini-vallotti(
  description:"Tartini-Vallotti meantone temperament (Asselin 2000 p.104) Created 2021-01-16 17:45:36 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-16 17:47:11) Created meantone upward notes \u201Cdo,sol,re,la,mi,si\u201D fraction 3/2 adjusted -1/6 comma (2021-01-16 17:48:49)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.12, 1.185, 1.255, 1.333, 1.406, 1.497, 1.58, 1.677, 1.778, 1.879),
  comma:81/80
)

temperament bp3_meantone_werckmeister_3(
  description:"Werckmeister III meantone temperament (Asselin 2000 p.94) Created 2021-01-16 16:53:15 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-16 16:55:35) Created meantone upward notes \u201Cdo,sol,re,la\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 16:57:00) Created meantone upward notes \u201Cla,mi,si\u201D fraction 3/2 (2021-01-16 16:58:34)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.118, 1.185, 1.254, 1.333, 1.406, 1.495, 1.58, 1.672, 1.778, 1.881),
  comma:81/80
)

temperament bp3_meantone_werckmeister_4(
  description:"Werckmeister IV meantone temperament (Asselin 2000 p.96) Created 2021-01-16 17:02:48 Added fifths down: \u201Cdo,fa\u201D starting fraction 1/1 (2021-01-16 17:07:10) Created meantone downward notes \u201Cfa,sib\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:08:04) Created meantone downward notes \u201Csib,mib,sol#\u201D fraction 3/2 adjusted 1/3 comma (2021-01-16 17:09:18) Created meantone downward notes \u201Csol#,do#\u201D fraction 3/2 (2021-01-16 17:11:01) Created meantone downward notes \u201Cdo#,fa#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:12:07) Created meantone downward notes \u201Cfa#,si\u201D fraction 3/2 (2021-01-16 17:13:21) Created meantone downward notes \u201Csi,mi\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:14:45) Created meantone downward notes \u201Cmi,la\u201D fraction 3/2 (2021-01-16 17:16:07) Created meantone upward notes \u201Cdo,sol\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:17:11) Created meantone upward notes \u201Csol,re\u201D fraction 3/2 (2021-01-16 17:17:49)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.049, 1.121, 1.185, 1.253, 1.333, 1.404, 1.494, 1.574, 1.671, 1.785, 1.872),
  comma:81/80
)

temperament bp3_meantone_werckmeister_5(
  description:"Werckmeister V meantone temperament (Asselin 2000 p.99) Created 2021-01-16 17:29:54 Added fifths up: \u201Cdo,sol,re\u201D starting fraction 1/1 (2021-01-16 17:31:53) Created meantone upward notes \u201Cre,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:33:19) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 17:34:05) Created meantone upward notes \u201Cfa#,do#,lab\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:35:20) Created meantone downward notes \u201Cdo,fa\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:36:08) Created meantone downward notes \u201Cfa,sib,mib\u201D fraction 3/2 (2021-01-16 17:37:05)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.058, 1.125, 1.188, 1.258, 1.337, 1.415, 1.5, 1.582, 1.682, 1.783, 1.887),
  comma:81/80
)

temperament bp3_meantone_zarlino(
  description:"Zarlino meantone temperament (Asselin 2000 p.85) Created meantone upwards notes \u201Cdo, sol, re, la, mi, si, fa#, do#, sol#\u201D ratio 3/2 -2/7 comma (2021-01-11 18:00:22) Created meantone downwards notes \u201Cdo, fa, sib, mib\u201D ratio 3/2 -2/7 comma (2021-01-11 18:05:45) Created meantone upwards notes \u201Cdo, sol\u201D ratio 3/2 -2/7 comma (2021-01-11 18:06:40)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.042, 1.117, 1.198, 1.248, 1.338, 1.394, 1.495, 1.557, 1.67, 1.79, 1.865),
  comma:81/80
)

temperament bp3_piano(
  description:"Tuning of a piano with perfect fifths and stretched octave",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2.004,
  divisions:12,
  ratios(1, 1.06, 1.123, 1.19, 1.261, 1.336, 1.416, 1.5, 1.59, 1.684, 1.785, 1.891)
)

temperament bp3_stretched_octave-Indian(
  description:"Tuning of a piano with perfect fifths and stretched octave",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2.004,
  divisions:12,
  ratios(1, 1.06, 1.123, 1.19, 1.261, 1.336, 1.416, 1.5, 1.59, 1.685, 1.785, 1.891),
  comma:81/80
)

temperament bp3_bach_temperament(
  description:"This is an equal-tempered scale for BP3 + Csound. Created 2021-01-15 16:02:04Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/5 comma (2021-01-15 16:10:04) Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-15 16:11:48) Created meantone upward notes \u201Cmi,si\u201D fraction 3/2 (2021-01-15 16:13:36)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.119, 1.185, 1.253, 1.333, 1.406, 1.496, 1.58, 1.675, 1.778, 1.88),
  comma:81/80
)

temperament bp3_pure_minor-third_meantone(
  description:"This is an equal-tempered scale for BP3 + Csound. Created 2021-01-15 15:13:09 Created meantone upward notes \u201Cmib,sib,fa,do,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-15 15:15:22) Base note reset to \u2018do\u2019 (2021-01-15 15:16:00)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.037, 1.116, 1.2, 1.244, 1.339, 1.388, 1.494, 1.549, 1.666, 1.792, 1.86),
  comma:81/80
)

temperament bp3_just_intonation(
  description:"A traditional scale constructed with 'simple' integer ratios",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 5/4, 4/3, 64/45, 3/2, 8/5, 5/3, 16/9, 15/8),
  comma:81/80
)

temperament bp3_rameau_en_sib(
  description:"Rameau meantone in B flat temperament (Asselin 2000 p.115) Created 2021-01-16 18:41:56 Created meantone upward notes \u201Cdo,sol,re,la,mi,si\u201D fraction 3/2 adjusted -1/4 comma (2022-02-04 16:38:50) Created meantone downward notes \u201Cdo,fa,sib\u201D fraction 3/2 adjusted -1/4 comma (2022-02-04 16:40:08) Created meantone downward notes \u201Csib,mib\u201D fraction 3/2 (2022-02-04 16:58:49) Created meantone upward notes \u201Csi,fa#\u201D fraction 3/2 adjusted -1/4 comma (2022-02-04 17:10:32) Created meantone downward notes \u201Cmib,lab\u201D fraction 3/2 (2022-02-04 17:16:00) Equalized intervals over series \u201Cfa#,reb,lab\u201D approx fraction 3/2 adjusted 10.6 cents to ratio = 1.509 (2022-02-04 17:20:39)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.054, 1.118, 1.193, 1.25, 1.337, 1.397, 1.495, 1.591, 1.672, 1.789, 1.869),
  comma:81/80
)

temperament bp3_Dha1_murcchana(
  description:"This is a transposition of scale ""Sa_murcchana"" (12 grades). From \u2018dhak\u2019 to \u2018sa\u2019. Created 2020-12-17 17:19:51",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 15/8),
  comma:81/80
)

temperament bp3_Dha3_murcchana(
  description:"This is a transposition of scale ""Sa_murcchana"" (12 grades). From \u2018dha\u2019 to \u2018sa\u2019. Created 2020-12-17 17:55:10",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 4/3, 64/45, 3/2, 8/5, 27/16, 16/9, 243/128),
  comma:81/80
)

temperament bp3_Ga1_murcchana(
  description:"This is a transposition of scale ""Sa_murcchana"" (12 grades). From \u2018gak\u2019 to \u2018sa\u2019. Created 2020-12-17 17:13:32",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 15/8),
  comma:81/80
)

temperament bp3_Ga3_murcchana(
  description:"This is a transposition of scale ""Sa_murcchana"" (12 grades). From \u2018ga\u2019 to \u2018sa\u2019. Created 2020-12-17 17:52:29",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 32/27, 81/64, 4/3, 64/45, 3/2, 8/5, 27/16, 16/9, 243/128),
  comma:81/80
)

temperament bp3_Ma1_murcchana(
  description:"This is a transposition of scale ""Sa_murcchana"" (12 grades). From \u2018ma\u2019 to \u2018sa\u2019. Created 2020-12-17 16:59:54",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 10/9, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

temperament bp3_Ma3_murcchana(
  description:"This is a transposition of scale ""Sa_murcchana"" (12 grades). From \u2018ma#\u2019 to \u2018sa\u2019. Created 2020-12-17 19:45:32",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 64/45, 3/2, 128/81, 27/16, 16/9, 243/128),
  comma:81/80
)

temperament bp3_Ma_grama_full(
  description:"This is a derivation of scale ""Ma01"" (23 grades) in \u2018-cs.raga\u2019 Created 2020-12-07 09:27:54",
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

temperament bp3_Ni1_murcchana(
  description:"This is a transposition of scale ""Sa_murcchana"" (12 grades). From \u2018nik\u2019 to \u2018sa\u2019. Created 2020-12-17 17:09:41",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 5/4, 4/3, 45/32, 3/2, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

temperament bp3_Ni3_murcchana(
  description:"This is a transposition of scale ""Sa_murcchana"" (12 grades). From \u2018ni\u2019 to \u2018sa\u2019. Created 2020-12-17 17:43:30",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 32/27, 81/64, 4/3, 64/45, 3/2, 128/81, 27/16, 16/9, 243/128),
  comma:81/80
)

temperament bp3_Pa3_murcchana(
  description:"This is a transposition of scale ""Sa_murcchana"" (12 grades). From \u2018pa\u2019 to \u2018sa\u2019. Created 2020-12-17 18:03:15",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 27/20, 64/45, 3/2, 8/5, 27/16, 9/5, 243/128),
  comma:81/80
)

temperament bp3_Re1_murcchana(
  description:"This is a transposition of scale ""Sa_murcchana"" (12 grades). From \u2018rek\u2019 to \u2018sa\u2019. Created 2020-12-17 17:27:47",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 9/8, 32/27, 81/64, 4/3, 45/32, 3/2, 128/81, 27/16, 16/9, 243/128),
  comma:81/80
)

temperament bp3_Re3_murcchana(
  description:"This is a transposition of scale ""Sa_murcchana"" (12 grades). From \u2018re\u2019 to \u2018sa\u2019. Created 2020-12-17 18:00:02",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 81/64, 4/3, 64/45, 3/2, 8/5, 27/16, 9/5, 243/128),
  comma:81/80
)

temperament bp3_Sa_murcchana(
  description:"This is a reduction to 12 grades of scale ""Ma_grama_full"" (23 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 15:44:19",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 256/243, 10/9, 32/27, 5/4, 4/3, 45/32, 40/27, 128/81, 5/3, 16/9, 15/8),
  comma:81/80
)

temperament bp3_asavari1(
  description:"This is a reduction to 7 grades of scale ""Dha3_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:57:24",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 8/5, 16/9),
  comma:81/80
)

temperament bp3_asavari2(
  description:"This is a reduction to 7 grades of scale ""Re3_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:01:33",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 8/5, 9/5),
  comma:81/80
)

temperament bp3_asavari3(
  description:"This is a reduction to 7 grades of scale ""Pa3_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:04:25",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 6/5, 27/20, 3/2, 8/5, 9/5),
  comma:81/80
)

temperament bp3_bad-scale(
  description:"This is a reduction to 7 grades of scale ""Sa_murcchana"" (12 grades) in \u2018-cs.raga\u2019 Created 2020-12-17 18:45:55",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 10/9, 32/27, 4/3, 40/27, 5/3, 15/8),
  comma:81/80
)

temperament bp3_bhairao1(
  description:"This is a reduction to 7 grades of scale ""Ma3_murcchana"" (12 grades) in \u2018-cs.raga\u2019 Created 2020-12-17 19:50:06",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 81/64, 4/3, 3/2, 128/81, 243/128),
  comma:81/80
)

temperament bp3_bhairao2(
  description:"This is a reduction to 7 grades of scale ""Ni3_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:51:30",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 16/15, 81/64, 4/3, 3/2, 128/81, 243/128),
  comma:81/80
)

temperament bp3_bhairavi1(
  description:"This is a reduction to 7 grades of scale ""Ni3_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:48:21",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 16/15, 32/27, 4/3, 3/2, 128/81, 16/9),
  comma:81/80
)

temperament bp3_bhairavi2(
  description:"This is a reduction to 7 grades of scale ""Ga3_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:54:29",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 16/15, 32/27, 4/3, 3/2, 8/5, 16/9),
  comma:81/80
)

temperament bp3_bhairavi3(
  description:"This is a reduction to 7 grades of scale ""Dha3_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:59:10",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 16/15, 6/5, 4/3, 3/2, 8/5, 16/9),
  comma:81/80
)

temperament bp3_bhairavi4(
  description:"This is a reduction to 7 grades of scale ""Re3_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:00:44",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 16/15, 6/5, 4/3, 3/2, 8/5, 9/5),
  comma:81/80
)

temperament bp3_bilaval1(
  description:"This is a reduction to 7 grades of scale ""Sa_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 15:49:41",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 10/9, 5/4, 4/3, 40/27, 5/3, 15/8),
  comma:81/80
)

temperament bp3_bilaval2(
  description:"This is a reduction to 7 grades of scale ""Ma_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:02:10",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 10/9, 5/4, 4/3, 3/2, 5/3, 15/8),
  comma:81/80
)

temperament bp3_bilaval3(
  description:"This is a reduction to 7 grades of scale ""Ni_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:10:33",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8),
  comma:81/80
)

temperament bp3_kalyan1(
  description:"This is a reduction to 7 grades of scale ""Ma_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:07:12",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 10/9, 5/4, 45/32, 3/2, 5/3, 15/8),
  comma:81/80
)

temperament bp3_kalyan2(
  description:"This is a reduction to 7 grades of scale ""Ni_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:11:52",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 5/4, 45/32, 3/2, 5/3, 15/8),
  comma:81/80
)

temperament bp3_kalyan3(
  description:"This is a reduction to 7 grades of scale ""Ga_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:14:50",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 5/4, 45/32, 3/2, 27/16, 15/8),
  comma:81/80
)

temperament bp3_kaphi1(
  description:"This is a reduction to 7 grades of scale ""Sa_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 15:46:42",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 10/9, 32/27, 4/3, 40/27, 5/3, 16/9),
  comma:81/80
)

temperament bp3_kaphi2(
  description:"This is a reduction to 7 grades of scale ""Re3_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:02:27",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 6/5, 4/3, 3/2, 27/16, 9/5),
  comma:81/80
)

temperament bp3_kaphi3(
  description:"This is a reduction to 7 grades of scale ""Pa3_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:05:03",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 6/5, 27/20, 3/2, 27/16, 9/5),
  comma:81/80
)

temperament bp3_khamaj1(
  description:"This is a reduction to 7 grades of scale ""Sa_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 15:48:50",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 10/9, 5/4, 4/3, 40/27, 5/3, 16/9),
  comma:81/80
)

temperament bp3_khamaj2(
  description:"This is a reduction to 7 grades of scale ""Ma_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:04:13",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 10/9, 5/4, 4/3, 3/2, 5/3, 16/9),
  comma:81/80
)

temperament bp3_khamaj3(
  description:"This is a reduction to 7 grades of scale ""Pa3_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 18:06:06",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 9/8, 81/64, 27/20, 3/2, 27/16, 9/5),
  comma:81/80
)

temperament bp3_lalit1(
  description:"This is a reduction to 8 grades of scale ""Ma3_murcchana"" (12 grades) in \u2018-cs.raga\u2019 Created 2020-12-19 14:23:28",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:8,
  ratios(1, 256/243, 81/64, 4/3, 64/45, 3/2, 128/81, 243/128),
  comma:81/80
)

temperament bp3_lalit2(
  description:"This is a reduction to 8 grades of scale ""Ni3_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:50:24",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:8,
  ratios(1, 16/15, 81/64, 4/3, 64/45, 3/2, 128/81, 243/128),
  comma:81/80
)

temperament bp3_marva1(
  description:"This is a reduction to 7 grades of scale ""Ni_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:12:34",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 5/4, 45/32, 3/2, 5/3, 15/8),
  comma:81/80
)

temperament bp3_marva2(
  description:"This is a reduction to 7 grades of scale ""Ga_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:17:10",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 5/4, 45/32, 3/2, 27/16, 15/8),
  comma:81/80
)

temperament bp3_marva3(
  description:"This is a reduction to 7 grades of scale ""Dha_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:24:35",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 81/64, 45/32, 3/2, 27/16, 15/8),
  comma:81/80
)

temperament bp3_purvi1(
  description:"This is a reduction to 7 grades of scale ""Ga_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:18:42",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 5/4, 45/32, 3/2, 128/81, 15/8),
  comma:81/80
)

temperament bp3_purvi2(
  description:"This is a reduction to 7 grades of scale ""Dha_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:26:08",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 81/64, 45/32, 3/2, 128/81, 15/8),
  comma:81/80
)

temperament bp3_purvi3(
  description:"This is a reduction to 7 grades of scale ""Re_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:06",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 81/64, 45/32, 3/2, 128/81, 243/128),
  comma:81/80
)

temperament bp3_todi1(
  description:"This is a reduction to 7 grades of scale ""Dha_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:26:59",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 32/27, 45/32, 3/2, 128/81, 15/8),
  comma:81/80
)

temperament bp3_todi2(
  description:"This is a reduction to 7 grades of scale ""Re_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 32/27, 45/32, 3/2, 128/81, 243/128),
  comma:81/80
)

temperament bp3_todi3(
  description:"This is a reduction to 7 grades of scale ""Ma3_murcchana"" (12 grades) in \u2018-cs.raga\u2019 Created 2020-12-17 19:47:44",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 256/243, 32/27, 64/45, 3/2, 128/81, 243/128),
  comma:81/80
)

temperament bp3_todi4(
  description:"This is a reduction to 7 grades of scale ""Ga3_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:53:30",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:7,
  ratios(1, 16/15, 32/27, 64/45, 3/2, 8/5, 243/128),
  comma:81/80
)

temperament bp3_todi_aak_2(
  description:"This is a reduction to 7 grades of scale ""Re_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:2,
  ratios(1, 3/2)
)

temperament bp3_todi_aak_3(
  description:"This is a reduction to 7 grades of scale ""Re_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:2,
  ratios(1, 3/2)
)

temperament bp3_todi_ka_3(
  description:"This is a reduction to 7 grades of scale ""Re_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:3,
  ratios(1, 3/2, 243/128)
)

temperament bp3_todi_ka_4(
  description:"This is a reduction to 7 grades of scale ""Re_murcchana"" (12 grades) in \u2018-cs.raga2\u2019 Created 2020-12-17 17:35:38",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:4,
  ratios(1, 3/2, 128/81, 243/128)
)

temperament bp3_Bohlen-Pierce(
  description:"Bohlen-Pierce scale ""just intonation"" https://midi.org/microtuning-and-alternative-intonation-systems https://en.wikipedia.org/wiki/Bohlen-Pierce_scale Created 2024-10-03 12:33:18",
  source:"Bernard Bel / Bol Processor",
  period_ratio:3,
  divisions:13,
  ratios(1, 27/25, 25/21, 9/7, 7/5, 75/49, 5/3, 9/5, 49/25, 15/7, 7/3, 63/25, 25/9),
  comma:81/80
)

temperament bp3_meantone_try(
  description:"This is a new scale for BP3.  Creation 2020-11-17 22:55:31 This scale has been imported from a SCALA file. Created 2024-08-22 07:14:33",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2.022,
  divisions:12,
  ratios(1, 1.066, 1.125, 1.199, 1.265, 1.349, 1.422, 1.5, 1.599, 1.687, 1.799, 1.896),
  comma:81/80
)

temperament bp3_meantone_try2(
  description:"This is a new scale for BP3.  Creation 2020-11-17 22:55:31 Same as meantone_try except that the base key is #64. Created 2024-08-22 07:14:33",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2.022,
  divisions:12,
  ratios(1, 1.066, 1.125, 1.199, 1.265, 1.349, 1.422, 1.5, 1.599, 1.687, 1.799, 1.896),
  comma:81/80
)

temperament bp3_zest24-supergoya17plus3_Db(
  description:"Goya-17 plus 484, 676, and 1180 cents This scale has been imported from a SCALA file. Created 2024-08-22 07:41:27",
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

temperament bp3_meantone1(
  description:"Mesotonique au quart de comma syntonique (Pietro Aron, 1523) : la quinte est diminuee d'un quart de comma, la tierce majeure 5/4 et la sixte mineure 8/5 sont pures. Douze degres sur la table C Db D Eb E F Gb G Ab A Bb B.",
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

temperament bp3_BACH(
  description:"Kellner's BACH temperament (Asselin 2000 p.101) Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/5 comma (2021-01-15 16:10:04) Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-15 16:11:48) Created meantone upward notes \u201Cmi,si\u201D fraction 3/2 (2021-01-15 16:13:36)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.119, 1.185, 1.253, 1.333, 1.406, 1.496, 1.58, 1.675, 1.778, 1.88),
  comma:81/80
)

temperament bp3_Zarlino_natural(
  description:"A traditional scale constructed with simple integer ratios",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 16/15, 9/8, 6/5, 5/4, 4/3, 64/45, 3/2, 8/5, 5/3, 16/9, 15/8)
)

temperament bp3_barca(
  description:"Barca temperament (Asselin 2000 p.106) Created 2021-01-16 17:56:02 Added fifths down: \u201Cdo,fa,sib\u201D starting fraction 1/1 (2021-01-16 17:57:57) Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#\u201D fraction 3/2 adjusted -1/6 comma (2021-01-16 18:02:25) Created meantone upward notes \u201Cfa#,do#,sol#,re#\u201D fraction 3/2 (2021-01-16 18:03:49)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.055, 1.12, 1.186, 1.255, 1.333, 1.406, 1.497, 1.582, 1.677, 1.778, 1.879),
  comma:81/80
)

temperament bp3_bethisy(
  description:"B\xE9thisy temperament (Asselin 2000 p.121) Created 2021-01-16 19:21:57 Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:23:36) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 19:25:49) Created meantone downward notes \u201Cmib,sol#\u201D fraction 3/2 (2021-01-16 19:26:26) Equalized intervals over series \u201Cmi,si,fa#,do#,sol#\u201D approx fraction 3/2 adjusted -1.7 cents to ratio = 1.499 (2021-01-16 19:28:09)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.052, 1.118, 1.182, 1.25, 1.332, 1.404, 1.495, 1.576, 1.672, 1.774, 1.873),
  comma:81/80
)

temperament bp3_chaumont(
  description:"Chaumont temperament (Asselin 2000 p.109) Created 2021-01-16 18:06:34 Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:08:41) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:09:41)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.196, 1.25, 1.337, 1.398, 1.495, 1.563, 1.672, 1.789, 1.869),
  comma:81/80
)

temperament bp3_classic(
  description:"Classic temperament (Asselin 2000 p.76) Equivalent to Chaumont (p.109) Created 2021-01-14 15:38:08 Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-14 15:40:20) Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/4 comma (2021-01-14 15:40:57)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.196, 1.25, 1.337, 1.398, 1.495, 1.563, 1.672, 1.789, 1.869),
  comma:81/80
)

temperament bp3_corrette(
  description:"Corrette temperament (Asselin 2000 p.111) Created 2021-01-16 18:13:10 Created meantone upward notes \u201Cfa,do,sol,re,la,mi,si,fa#,do#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:16:40) Created meantone downward notes \u201Cfa,sib,mib\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 18:34:13) Created meantone upward notes \u201Cdo#,sol#\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 18:38:14) Base note reset to \u2018do\u2019 (2021-01-16 18:40:53)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.187, 1.25, 1.338, 1.398, 1.496, 1.569, 1.672, 1.782, 1.87),
  comma:81/80
)

temperament bp3_d_alembert_rousseau(
  description:"D'Alembert-Rousseau temperament (Asselin 2000 p.119) Created 2021-01-16 19:04:44 Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:12:08) Created meantone downward notes \u201Cdo,fa,sib,mib,sol#\u201D fraction 3/2 adjusted 1/12 comma (2021-01-16 19:17:25) Equalized intervals over series \u201Csol#,do#,fa#,si,mi\u201D approx fraction 2/3 adjusted 2.2 cents to ratio = 0.668 (2021-01-16 19:19:34)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.051, 1.118, 1.182, 1.25, 1.332, 1.403, 1.495, 1.574, 1.672, 1.774, 1.873),
  comma:81/80
)

temperament bp3_equal_tempered(
  description:"This is an equal-tempered scale for BP3 + Csound. Created 2021-02-13 19:09:08",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.059, 1.122, 1.189, 1.26, 1.335, 1.414, 1.498, 1.587, 1.682, 1.782, 1.888),
  comma:81/80
)

temperament bp3_kirnberger_2(
  description:"Kirnberger II temperament (Asselin 2000 p. 90) Created 2021-01-16 11:52:39 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb\u201D starting fraction 1/1 (2021-01-16 11:54:59) Added fifths up: \u201Cdo,sol,re\u201D starting fraction 1/1 (2021-01-16 11:55:59) Created meantone upward notes \u201Cre,la,mi\u201D fraction 3/2 adjusted -1/2 comma (2021-01-16 11:57:13) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 11:58:24)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.125, 1.185, 1.25, 1.333, 1.406, 1.5, 1.58, 1.677, 1.778, 1.875),
  comma:81/80
)

temperament bp3_kirnberger_3(
  description:"Kirnberger III temperament (Asselin 2000 p.93) Created 2021-01-16 12:02:11 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb\u201D starting fraction 1/1 (2021-01-16 12:03:52) Created meantone upward notes \u201Cdo,sol,re,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 12:05:20) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 12:06:10)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.118, 1.185, 1.25, 1.333, 1.406, 1.495, 1.58, 1.672, 1.778, 1.875),
  comma:81/80
)

temperament bp3_marpourg(
  description:"Marpourg temperament (Asselin 2000 p.117) Created 2021-01-16 18:58:49 Created meantone upward notes \u201Cfa,do,sol,re,la,mi,si,fa#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 19:00:42) Equalized intervals over series \u201Cfa,la#,re#,sol#,do#,fa#\u201D approx fraction 2/3 adjusted -2.8 cents to ratio = 0.666 (2021-01-16 19:02:32) Base note reset to \u2018do\u2019 (2021-01-16 19:03:15)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.05, 1.118, 1.185, 1.25, 1.338, 1.398, 1.496, 1.577, 1.672, 1.781, 1.87),
  comma:81/80
)

temperament bp3_pure_minor-thirds(
  description:"Pure minor-thirds temperament (Asselin 2000 p.82) Created 2021-01-15 15:13:09 Created meantone upward notes \u201Cmib,sib,fa,do,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-15 15:15:22) Base note reset to \u2018do\u2019 (2021-01-15 15:16:00)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.037, 1.116, 1.2, 1.244, 1.339, 1.388, 1.494, 1.549, 1.666, 1.792, 1.86),
  comma:81/80
)

temperament bp3_rameau_en_do(
  description:"Rameau meantone in C temperament (Asselin 2000 p.113) Created 2021-01-16 18:41:56 Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 18:44:03) Added fifths down: \u201Cdo,fa\u201D starting fraction 1/1 (2021-01-16 18:49:25) Created meantone upward notes \u201Cdo#,sol#\u201D fraction 3/2 adjusted -1/4 comma (2022-02-04 18:09:16) Created meantone downward notes \u201Cfa,la#\u201D fraction 3/2 (2021-01-16 18:54:20) Equalized intervals over series \u201Csol#,re#,la#\u201D approx fraction 3/2 adjusted 9.1 cents to ratio = 1.508 (2022-02-04 18:10:27)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.045, 1.118, 1.178, 1.25, 1.333, 1.398, 1.495, 1.563, 1.672, 1.777, 1.869),
  comma:81/80
)

temperament bp3_sauveur(
  description:"Sauveur temperament (Asselin 2000 p. 81) Created 2021-01-16 10:37:52 Created meantone downward notes \u201Cdo,fa,sib,mib\u201D fraction 3/2 adjusted -1/5 comma (2021-01-16 10:44:41) Created meantone upward notes \u201Cdo,sol,re,la,mi,si,fa#,do#,sol#\u201D fraction 3/2 adjusted -1/5 comma (2021-01-16 10:48:56)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.049, 1.119, 1.194, 1.253, 1.337, 1.403, 1.496, 1.57, 1.675, 1.787, 1.875),
  comma:81/80
)

temperament bp3_scale_1(
  description:"Two series of perfect fifths including ascending major thirds (Asselin 2000 p.62) Created 2021-01-08 09:02:23",
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

temperament bp3_schlick_bad(
  description:"Schlick temperament (Asselin 2000 p.88) Created 2021-01-16 10:56:35 [INCORRECT] Created meantone downward notes \u201Cla,re,sol,do,fa\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 10:58:50) Created meantone upward notes \u201Cla,mi,si\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 10:59:48) Created meantone upward notes \u201Cla,do#\u201D fraction 5/4 (2021-01-16 11:04:11) Equalized intervals over series \u201Csi,fa#,do#\u201D approx fraction 3/2 adjusted -5.4 cents to ratio = 1.495 (2021-01-16 11:05:59) Created meantone downward notes \u201Csol,mib\u201D fraction 5/4 (2021-01-16 11:07:31) Equalized intervals over series \u201Cmib,sib,fa\u201D approx fraction 3/2 adjusted -5.3 cents to ratio = 1.495 (2021-01-16 11:08:47) Created meantone downward notes \u201Cdo,lab\u201D fraction 5/4 (2021-01-16 11:13:58) Created meantone upward notes \u201Cmi,sol#\u201D fraction 5/4 adjusted 2/3 comma (2021-01-16 11:23:39) [estimation] Base note reset to \u2018do\u2019 (2021-01-16 11:25:48)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:13,
  ratios(1, 1.045, 1.118, 1.196, 1.25, 1.338, 1.398, 1.496, 1.575, 1.6, 1.672, 1.789, 1.87),
  comma:81/80
)

temperament bp3_tartini-vallotti(
  description:"Tartini-Vallotti temperament (Asselin 2000 p.104) Created 2021-01-16 17:45:36 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-16 17:47:11) Created meantone upward notes \u201Cdo,sol,re,la,mi,si\u201D fraction 3/2 adjusted -1/6 comma (2021-01-16 17:48:49)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.12, 1.185, 1.255, 1.333, 1.406, 1.497, 1.58, 1.677, 1.778, 1.879),
  comma:81/80
)

temperament bp3_werckmeister_3(
  description:"Werckmeister III temperament (Asselin 2000 p.94) Created 2021-01-16 16:53:15 Added fifths down: \u201Cdo,fa,sib,mib,lab,reb,solb\u201D starting fraction 1/1 (2021-01-16 16:55:35) Created meantone upward notes \u201Cdo,sol,re,la\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 16:57:00) Created meantone upward notes \u201Cla,mi,si\u201D fraction 3/2 (2021-01-16 16:58:34)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.053, 1.118, 1.185, 1.254, 1.333, 1.406, 1.495, 1.58, 1.672, 1.778, 1.881),
  comma:81/80
)

temperament bp3_werckmeister_4(
  description:"Werckmeister IV temperament (Asselin 2000 p.96) Created 2021-01-16 17:02:48 Added fifths down: \u201Cdo,fa\u201D starting fraction 1/1 (2021-01-16 17:07:10) Created meantone downward notes \u201Cfa,sib\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:08:04) Created meantone downward notes \u201Csib,mib,sol#\u201D fraction 3/2 adjusted 1/3 comma (2021-01-16 17:09:18) Created meantone downward notes \u201Csol#,do#\u201D fraction 3/2 (2021-01-16 17:11:01) Created meantone downward notes \u201Cdo#,fa#\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:12:07) Created meantone downward notes \u201Cfa#,si\u201D fraction 3/2 (2021-01-16 17:13:21) Created meantone downward notes \u201Csi,mi\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:14:45) Created meantone downward notes \u201Cmi,la\u201D fraction 3/2 (2021-01-16 17:16:07) Created meantone upward notes \u201Cdo,sol\u201D fraction 3/2 adjusted -1/3 comma (2021-01-16 17:17:11) Created meantone upward notes \u201Csol,re\u201D fraction 3/2 (2021-01-16 17:17:49)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.049, 1.121, 1.185, 1.253, 1.333, 1.404, 1.494, 1.574, 1.671, 1.785, 1.872),
  comma:81/80
)

temperament bp3_werckmeister_5(
  description:"Werckmeister V temperament (Asselin 2000 p.99) Created 2021-01-16 17:29:54 Added fifths up: \u201Cdo,sol,re\u201D starting fraction 1/1 (2021-01-16 17:31:53) Created meantone upward notes \u201Cre,la,mi\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:33:19) Created meantone upward notes \u201Cmi,si,fa#\u201D fraction 3/2 (2021-01-16 17:34:05) Created meantone upward notes \u201Cfa#,do#,lab\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:35:20) Created meantone downward notes \u201Cdo,fa\u201D fraction 3/2 adjusted -1/4 comma (2021-01-16 17:36:08) Created meantone downward notes \u201Cfa,sib,mib\u201D fraction 3/2 (2021-01-16 17:37:05)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.058, 1.125, 1.188, 1.258, 1.337, 1.415, 1.5, 1.582, 1.682, 1.783, 1.887),
  comma:81/80
)

temperament bp3_zarlino(
  description:"Zarlino temperament (Asselin 2000 p.85) Created meantone upwards notes \u201Cdo, sol, re, la, mi, si, fa#, do#, sol#\u201D ratio 3/2 -2/7 comma (2021-01-11 18:00:22) Created meantone downwards notes \u201Cdo, fa, sib, mib\u201D ratio 3/2 -2/7 comma (2021-01-11 18:05:45) Created meantone upwards notes \u201Cdo, sol\u201D ratio 3/2 -2/7 comma (2021-01-11 18:06:40)",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:12,
  ratios(1, 1.042, 1.117, 1.198, 1.248, 1.338, 1.394, 1.495, 1.557, 1.67, 1.79, 1.865),
  comma:81/80
)

temperament bp3_johnston_unt3(
  description:"Johnston final lattice for ""The Un-tempered Pianos"" and ""K"" This scale has been imported from a SCALA file. Created 2024-08-22 07:44:18",
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

temperament bp3_zwolle2(
  description:"Henri Arnaut De Zwolle's modified meantone tuning (c. 1440) This scale has been imported from a SCALA file. Created 2024-08-22 07:39:55",
  source:"Bernard Bel / Bol Processor",
  period_ratio:2,
  divisions:3,
  ratios(1, 5/4, 25/16),
  comma:81/80
)

temperament bp3_shruti23_native(
  description:"Table native 22-shruti de -to.tryShruti (BP3, 23 ratios sur 23 degr\xE9s). Convention pythagoricienne au degr\xE9 12 (729/512). DISTINCT de bp3_grama (\xE9dition savante d'Arnold par B. Bel, 64/45 au m\xEAme degr\xE9) \u2014 deux syst\xE8mes valides, celui-ci est la table du moteur natif.",
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

alphabet abc(
  description:"Single-character alphabet a-z (Bernard's -al.abc / -ho.abc)",
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

alphabet abc1(
  description:"Single-character alphabet a-h (Bernard's -al.abc1 / -ho.abc1)",
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

alphabet conway(
  description:"Conway look-and-say sequence digits",
  runtime:audio,
  resolvesPitch:false,
  alterations(),
  terminals(d1(), d2(), d3())
)

alphabet kathak_count(
  description:"Kathak counting bols (ek-do-tin)",
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

alphabet structural(
  description:"Opaque structural symbols for grammar tests (no pitch, no sound)",
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

alphabet dhati(
  description:"Les dix bols de l'alphabet natif \`-al.dhati\`, reproduits tels quels",
  runtime:audio,
  resolvesPitch:false,
  alterations(),
  terminals(dha(), dhee(), ge(), ke(), kt(), na(), ta(), tee(), ti(), tr())
)

alphabet checkhomo(
  description:"Les sept termes de l'alphabet natif \`-al.checkhomo\`",
  runtime:audio,
  resolvesPitch:false,
  alterations(),
  terminals(a(), "a'"(), "a"""(), b(), "b'"(), c(), "c'"())
)

alphabet dhin(
  description:"Les quatorze bols de l'alphabet natif \`-al.dhin--\`",
  runtime:audio,
  resolvesPitch:false,
  alterations(),
  terminals(dha(), ta(), ti(), ra(), na(), ki(), dhee(), tee(), ne(), ge(), ke(), ka(), dhin(), tin())
)
`, "fichier": "test_alphabets.bpsl" }, { "nom": "time", "format": "bpsl", "texte": `types

// @documented
def time(
  resolvedBy:Kronos,
  resolves:time,
  name:time,
  description:"Le temps qui S'\xC9COULE \u2014 le m\xE9tronome de la sc\xE8ne. Librairie d'EN-T\xCATE, r\xE9solue par KRONOS.",
  version:"1.0.0",
  section:subgrammar
)

def tempo(
  bp3:_mm,
  args("bpm"),
  unit:bpm,
  description:"Metronome absolu de la scene ou de la sous-grammaire, en BPM.",
  scope("subgrammar", "scene"),
  unicite:metronome
)

control syncdelay(
  section:controls,
  bp3:MIDIsyncDelay,
  args("duration"),
  unit:ms,
  description:"Retard de rattrapage de l'horloge \xE0 la reprise apr\xE8s un point d'attente, en MILLISECONDES. Image de MIDIsyncDelay au moteur natif.",
  scope("scene")
)
`, "fichier": "time.bpsl" }, { "nom": "transpo/chromashift", "format": "bpsl", "texte": "control chromashift(\n  bp3:_transpose,\n  args(keys),\n  value:0,\n  description:\"Chromatic transposition on the 12-key grid \u2014 shift N chromatic keys (semitones), rename to target key + its tuning. Image of BP3 _transpose (Romain decision 2026-07-17). Distinct from scaleshift (diatonic degrees) and transpose (real, name preserved).\",\n  scope(symbol, group, rule, flow, scene),\n  transportGroup:transpo,\n  rank:10,\n  params(\n    n(\n      from:value,\n      coerce:raw,\n      default:0,\n      description:\"Nombre de cl\xE9s chromatiques (demi-tons) de d\xE9calage sur la grille 12 (peut \xEAtre n\xE9gatif ; wrap \xE0 l'octave).\"\n    )\n  )\n) ``ts:\n// Corps de la MANIPULATION `chromashift` \u2014 AUTHORING F1 (vrai .ts TYP\xC9 contre le SDK Kairos).\n// Source de v\xE9rit\xE9 : ce fichier. Le chargeur le greffe sur le CONTR\xD4LE `chromashift` de `transpo`, qui\n// porte le mot \u2014 arbitrage de Romain, 2026-09-03 : le corps se rattache \xE0 l'objet qui le nomme.\n// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis ex\xE9cute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.\n// \u26A0\uFE0F TRANSPOSITION CHROMATIQUE (grille 12 cl\xE9s) : image de BP3 _transpose (d\xE9cision Romain\n//    2026-07-17, hub/decisions/2026-07-17-bp3-transpose-est-scaleshift-sur-grille-12-cles.md).\n//    D\xE9cale le pas ABSOLU de N cl\xE9s chromatiques (N demi-tons) ; Kairos renomme vers la cl\xE9 cible\n//    et prend SON tuning (transposeToken). DISTINCT de `scaleshift` (diatonique, N degr\xE9s d'alphabet)\n//    et de `transpose` (r\xE9el, frameRatio, nom PR\xC9SERV\xC9). Trois gestes nets (Romain, option B).\nimport type { DigitalFn } from '@kairos/core';\n\n/** chromashift \u2014 transposition sur la GRILLE 12 CL\xC9S chromatiques : d\xE9cale le pas absolu de N\n *  positions (N demi-tons). `ctx.target.pitch.step` = pas ABSOLU sur la grille du temp\xE9rament\n *  (confirm\xE9 Kairos [504] : degr\xE9 + alt\xE9ration + registre\xB7divisions). Kairos re-projette le delta\n *  de step \u2192 renomme chromatiquement + retune sur la cl\xE9 d'arriv\xE9e. = BP3 _transpose(N)\n *  (Zouleb.c:555-574, key += Round(trans/100)). PORTER\u2260R\xC9SOUDRE : je d\xE9cale le pas, je ne r\xE9sous rien. */\nconst chromashift: DigitalFn = (ctx) => {\n  const p = ctx.target.pitch;\n  if (!p) return;\n  p.step += Number(ctx.params.n ?? 0);\n};\n\nexport default chromashift;\n``\n", "fichier": "transpo/chromashift.bpsl" }, { "nom": "transpo/keyxpand", "format": "bpsl", "texte": "control keyxpand(\n  bp3:_keyxpand,\n  args(pivot, factor),\n  value(pivot:0, factor:1),\n  description:\"Interval expansion/contraction around a pivot. factor=2 doubles, factor=-1 inverts, factor=0.5 contracts.\",\n  scope(symbol, group, rule, flow),\n  transportGroup:transpo,\n  rank:20,\n  params(\n    pivotStep(\n      from:pivot,\n      coerce:token-step,\n      default:0,\n      description:\"Pivot : token de note r\xE9solu en pas de grille par la coercition token-step de Kairos (crie si irr\xE9soluble) ; reste fixe.\"\n    ),\n    factor(\n      from:factor,\n      coerce:raw,\n      default:1,\n      description:\"Facteur d'\xE9chelle de l'\xE9cart au pivot (1 = identit\xE9, 2 = doubl\xE9, 0,5 = repli\xE9 ; peut \xEAtre n\xE9gatif = miroir).\"\n    )\n  )\n) ``ts:\n// Corps de la MANIPULATION `keyxpand` \u2014 AUTHORING F1 (vrai .ts TYP\xC9 contre le SDK Kairos).\n// Source de v\xE9rit\xE9 : ce fichier. Le chargeur le greffe sur le CONTR\xD4LE `keyxpand` de `transpo`, qui\n// porte le mot \u2014 arbitrage de Romain, 2026-09-03 : le corps se rattache \xE0 l'objet qui le nomme.\n// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis ex\xE9cute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.\nimport type { DigitalFn } from '@kairos/core';\n\n/** keyxpand \u2014 dilate/contracte l'\xE9cart au pivot d'un facteur (le pivot reste fixe). facteur 1 = identit\xE9,\n *  2 = intervalles doubl\xE9s, 0,5 = repli\xE9s de moiti\xE9. R\xE9sultat arrondi au pas de grille le plus proche.\n *  Kairos pr\xE9-r\xE9sout le token pivot en `pivotStep` et passe `{pivotStep, factor}`. */\nconst keyxpand: DigitalFn = (ctx) => {\n  // Mutation de la COPIE (ctx.target) ; Kairos d\xE9rive le Hz APR\xC8S (delta net). `step` = axe de grille absolu.\n  if (ctx.target.pitch) {\n    const pivotStep = Number(ctx.params.pivotStep ?? 0);\n    const factor = Number(ctx.params.factor ?? 1);\n    ctx.target.pitch.step = pivotStep + Math.round((ctx.target.pitch.step - pivotStep) * factor);\n  }\n};\n\nexport default keyxpand;\n``\n", "fichier": "transpo/keyxpand.bpsl" }, { "nom": "transpo/scaleshift", "format": "bpsl", "texte": "control scaleshift(\n  args(degrees),\n  value:0,\n  description:\"Scalar (diatonic) transposition \u2014 shift N degrees in the alphabet. (scaleshift:2) : Sa->Ga, etc. Preserves degrees, not intervals (in unequal scales). Formerly rotate-HAUTEUR; distinct from the ![rotate] STRUCTURE control.\",\n  scope(symbol, group, rule, flow),\n  transportGroup:transpo,\n  rank:10,\n  params(\n    n(\n      from:value,\n      coerce:raw,\n      default:0,\n      description:\"Nombre de degr\xE9s de d\xE9calage dans l'alphabet (peut \xEAtre n\xE9gatif ; report de registre aux bornes).\"\n    )\n  )\n) ``ts:\n// Corps de la MANIPULATION `scaleshift` \u2014 AUTHORING F1 (vrai .ts TYP\xC9 contre le SDK Kairos).\n// Source de v\xE9rit\xE9 : ce fichier. Le chargeur le greffe sur le CONTR\xD4LE `scaleshift` de `transpo`, qui\n// porte le mot \u2014 arbitrage de Romain, 2026-09-03 : le corps se rattache \xE0 l'objet qui le nomme.\n// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis ex\xE9cute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.\n// \u26A0\uFE0F TRANSPOSITION SCALAIRE (diatonique) : d\xE9calage de N DEGR\xC9S d'alphabet (Sa +2 \u2192 Ga), report de\n//    registre aux bornes. Anciennement `rotate` de HAUTEUR \u2014 renomm\xE9 (d\xE9cision 2026-07-11 : deux\n//    transpositions nomm\xE9es, r\xE9elle vs scalaire). RIEN \xC0 VOIR avec le ![rotate] de STRUCTURE\n//    (RotateSequence, rotation de s\xE9quence, moteur BPx), qui garde son nom.\nimport type { DigitalFn } from '@kairos/core';\n\n/** scaleshift \u2014 transposition scalaire : d\xE9cale de N degr\xE9s dans l'alphabet (Sa +2 \u2192 Ga). Recouvre le\n *  degr\xE9 depuis le pas via `models.alphabet.degrees`, tourne l'index (mod taille alphabet, avec report\n *  de registre), recompose. Pr\xE9serve les DEGR\xC9S, pas les intervalles (en gamme in\xE9gale). */\nconst scaleshift: DigitalFn = (ctx) => {\n  const p = ctx.target.pitch;\n  if (!p) return;\n  const degs = ctx.models.alphabet.degrees;   // pas de grille de chaque degr\xE9, ordonn\xE9 (ex. 12-TET [0,2,4,5,7,9,11])\n  const div = ctx.models.temperament.divisions;\n  const n = Number(ctx.params.n ?? 0);\n  const reg = Math.floor(p.step / div);\n  const inOct = ((p.step % div) + div) % div;\n  const idx = degs.indexOf(inOct);\n  if (idx < 0) return;                          // pas hors alphabet : identit\xE9 (best-effort)\n  const len = degs.length, raw = idx + n;\n  const ni = ((raw % len) + len) % len;\n  p.step = degs[ni] + (reg + Math.floor(raw / len)) * div;\n};\n\nexport default scaleshift;\n``\n", "fichier": "transpo/scaleshift.bpsl" }, { "nom": "transpo/transpose", "format": "bpsl", "texte": "control transpose(\n  args(interval),\n  argType:interval,\n  description:\"Real (chromatic) transposition \u2014 shift the alphabet anchor by a fixed interval (fraction 3/2, cents 700c, decimal 1.5). Preserves intervals AND note names; works in any tuning. A bare integer is a ratio N:1 (N-th harmonic): 2/4/8 = octaves; for semitones use cents (12 semitones = 1200c). The old grid-step regime is removed.\",\n  scope(symbol, group, rule, flow, scene),\n  transportGroup:transpo,\n  rank:30,\n  params(\n    ratio(\n      from:value,\n      coerce:interval-ratio,\n      description:\"Intervalle normalis\xE9 en ratio par Kairos depuis la cha\xEEne 3-formats. Un transpose NUM\xC9RIQUE crie ici (cri de migration : l'ancien r\xE9gime par pas de grille est supprim\xE9).\"\n    ),\n    interval(\n      from:value,\n      coerce:raw,\n      description:\"La cha\xEEne d'intervalle brute (diagnostic) ; le corps ne la parse pas.\"\n    )\n  )\n) ``ts:\n// Corps de la MANIPULATION `transpose` \u2014 AUTHORING F1 (vrai .ts TYP\xC9 contre le SDK Kairos).\n// Source de v\xE9rit\xE9 : ce fichier. Le chargeur le greffe sur le CONTR\xD4LE `transpose` de `transpo`, qui\n// porte le mot \u2014 arbitrage de Romain, 2026-09-03 : le corps se rattache \xE0 l'objet qui le nomme.\n// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis ex\xE9cute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.\n// \u26A0\uFE0F TRANSPOSITION R\xC9ELLE (chromatique) : d\xE9calage de l'ANCRE par un INTERVALLE fixe. Pr\xE9serve les\n//    intervalles ET le nom de chaque note (on d\xE9place le cadre, pas les notes contre un cadre fig\xE9).\n//    Marche dans TOUT accordage (\xE9gal ET in\xE9gal), et m\xEAme en temp\xE9rament param\xE9trique (sans grille).\n//    D\xE9cision 2026-07-11 : deux transpositions nomm\xE9es, r\xE9elle (ici) vs scalaire (scaleshift).\nimport type { DigitalFn } from '@kairos/core';\n\n/** transpose \u2014 transposition r\xE9elle : multiplie le facteur de cadre `frameRatio` par l'intervalle.\n *  `ctx.params.ratio` = intervalle D\xC9J\xC0 NORMALIS\xC9 par Kairos (fraction 3/2 | cents 700c | d\xE9cimal 1.5) ;\n *  `ctx.params.interval` = la cha\xEEne brute (diagnostic). Kairos SEUL applique `hz \xD7 frameRatio` en fin de\n *  r\xE9solution, APR\xC8S les ops de grille \u2014 noms/registres pr\xE9serv\xE9s par construction. Je ne parse RIEN. */\nconst transpose: DigitalFn = (ctx) => {\n  if (ctx.target.pitch) {\n    ctx.target.pitch.frameRatio = (ctx.target.pitch.frameRatio ?? 1) * Number(ctx.params.ratio);\n  }\n};\n\nexport default transpose;\n``\n", "fichier": "transpo/transpose.bpsl" }, { "nom": "transpo", "format": "bpsl", "texte": `transpo/transpose
transpo/chromashift
transpo/scaleshift
transpo/keyxpand
types

// @documented
def transpo(
  resolves:transpo,
  resolvedBy:"Kairos",
  name:transpo,
  description:"Transformations de hauteur r\xE9solues par Kairos.",
  section:controls
)

control transpose(
  args(interval),
  argType:interval,
  description:"Real (chromatic) transposition \u2014 shift the alphabet anchor by a fixed interval (fraction 3/2, cents 700c, decimal 1.5). Preserves intervals AND note names; works in any tuning. A bare integer is a ratio N:1 (N-th harmonic): 2/4/8 = octaves; for semitones use cents (12 semitones = 1200c). The old grid-step regime is removed.",
  scope(symbol, group, rule, flow, scene),
  transportGroup:transpo,
  rank:30,
  params(
    ratio(
      from:value,
      coerce:interval-ratio,
      description:"Intervalle normalis\xE9 en ratio par Kairos depuis la cha\xEEne 3-formats. Un transpose NUM\xC9RIQUE crie ici (cri de migration : l'ancien r\xE9gime par pas de grille est supprim\xE9)."
    ),
    interval(
      from:value,
      coerce:raw,
      description:"La cha\xEEne d'intervalle brute (diagnostic) ; le corps ne la parse pas."
    )
  )
)

control scale(
  bp3:_scale,
  args(name, blockkey),
  value(name:0, blockkey:0),
  description:"Microtonal scale \u2014 name + base note. (scale:0 0) revient au temperament egal. Le nom et la note de base sont DEUX valeurs, separees par la virgule dans le declaratif et par l'espace dans le flux.",
  scope(symbol, group, rule, flow),
  transportGroup:transpo
)

control scaleshift(
  args(degrees),
  value:0,
  description:"Scalar (diatonic) transposition \u2014 shift N degrees in the alphabet. (scaleshift:2) : Sa->Ga, etc. Preserves degrees, not intervals (in unequal scales). Formerly rotate-HAUTEUR; distinct from the ![rotate] STRUCTURE control.",
  scope(symbol, group, rule, flow),
  transportGroup:transpo,
  rank:10,
  params(
    n(
      from:value,
      coerce:raw,
      default:0,
      description:"Nombre de degr\xE9s de d\xE9calage dans l'alphabet (peut \xEAtre n\xE9gatif ; report de registre aux bornes)."
    )
  )
)

control chromashift(
  bp3:_transpose,
  args(keys),
  value:0,
  description:"Chromatic transposition on the 12-key grid \u2014 shift N chromatic keys (semitones), rename to target key + its tuning. Image of BP3 _transpose (Romain decision 2026-07-17). Distinct from scaleshift (diatonic degrees) and transpose (real, name preserved).",
  scope(symbol, group, rule, flow, scene),
  transportGroup:transpo,
  rank:10,
  params(
    n(
      from:value,
      coerce:raw,
      default:0,
      description:"Nombre de cl\xE9s chromatiques (demi-tons) de d\xE9calage sur la grille 12 (peut \xEAtre n\xE9gatif ; wrap \xE0 l'octave)."
    )
  )
)

control keyxpand(
  bp3:_keyxpand,
  args(pivot, factor),
  value(pivot:0, factor:1),
  description:"Interval expansion/contraction around a pivot. factor=2 doubles, factor=-1 inverts, factor=0.5 contracts.",
  scope(symbol, group, rule, flow),
  transportGroup:transpo,
  rank:20,
  params(
    pivotStep(
      from:pivot,
      coerce:token-step,
      default:0,
      description:"Pivot : token de note r\xE9solu en pas de grille par la coercition token-step de Kairos (crie si irr\xE9soluble) ; reste fixe."
    ),
    factor(
      from:factor,
      coerce:raw,
      default:1,
      description:"Facteur d'\xE9chelle de l'\xE9cart au pivot (1 = identit\xE9, 2 = doubl\xE9, 0,5 = repli\xE9 ; peut \xEAtre n\xE9gatif = miroir)."
    )
  )
)
`, "fichier": "transpo.bpsl" }, { "nom": "tunings", "format": "bpsl", "texte": `types

// @documented
def tunings(resolvedBy:Kairos, resolves:tuning)

tuning western_12TET(
  description:"Standard Western equal temperament",
  alphabet:western,
  temperament:12TET,
  degrees(0, 2, 4, 5, 7, 9, 11)
)

tuning western_pythagorean(
  description:"Western in Pythagorean tuning \u2014 pure fifths",
  alphabet:western,
  temperament:pythagorean,
  degrees(0, 2, 4, 5, 7, 9, 11)
)

tuning western_just(
  description:"Western in 5-limit just intonation",
  alphabet:western,
  temperament:just_5limit,
  degrees(0, 2, 4, 5, 7, 9, 11)
)

tuning western_meantone(
  description:"Western in 1/4-comma meantone",
  alphabet:western,
  temperament:meantone_quarter,
  degrees(0, 2, 4, 5, 7, 9, 11)
)

tuning sargam_12TET(
  description:"Indian sargam in 12-TET (simplified, equal temperament)",
  alphabet:sargam,
  temperament:12TET,
  degrees(0, 2, 4, 5, 7, 9, 11)
)

tuning bp3_indian_12TET(
  description:"Convention de notes INDIAN du moteur BP3 natif, en 12-TET",
  alphabet:bp3_indian,
  temperament:12TET,
  degrees(0, 2, 4, 5, 7, 9, 11)
)

tuning bp3_english_12TET(
  description:"Convention de notes ENGLISH du moteur BP3 natif, en 12-TET",
  alphabet:bp3_english,
  temperament:12TET,
  degrees(0, 2, 4, 5, 7, 9, 11)
)

tuning bp3_fr_12TET(
  description:"Convention de notes FRENCH du moteur BP3 natif, en 12-TET",
  alphabet:bp3_fr,
  temperament:12TET,
  degrees(0, 2, 4, 5, 7, 9, 11)
)

tuning sargam_22shruti(
  description:"Indian sargam in 22-shruti system \u2014 full microtonal resolution",
  alphabet:sargam,
  temperament:22shruti,
  degrees(0, 4, 8, 9, 13, 17, 21)
)

tuning solfege_12TET(
  description:"Solf\xE8ge latin in 12-TET",
  alphabet:solfege,
  temperament:12TET,
  degrees(0, 2, 4, 5, 7, 9, 11)
)

tuning arabic_24TET(
  description:"Arabic maqam system \u2014 quarter-tone grid",
  alphabet:arabic,
  temperament:24TET,
  degrees(0, 4, 8, 10, 14, 18, 22)
)

tuning turkish_53TET(
  description:"Turkish makam \u2014 53-comma system",
  alphabet:turkish,
  temperament:53TET,
  degrees(0, 4, 9, 13, 17, 22, 26, 31, 35, 39, 44, 48, 4, 9, 13, 17)
)

tuning gamelan_pelog(
  description:"Javanese gamelan pelog \u2014 7-tone stretched octave",
  alphabet:gamelan_pelog,
  temperament:gamelan_pelog,
  degrees(0, 1, 2, 3, 4, 5, 6)
)

tuning gamelan_slendro(
  description:"Javanese gamelan slendro \u2014 5-tone near-equal, stretched octave",
  alphabet:gamelan_slendro,
  temperament:gamelan_slendro,
  degrees(0, 1, 2, 3, 4)
)

tuning bohlen_pierce_just(
  description:"Bohlen-Pierce just \u2014 13 tones in a tritave (3:1)",
  alphabet:bohlen_pierce,
  temperament:bohlen_pierce_just,
  degrees(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
)

tuning bohlen_pierce_equal(
  description:"Bohlen-Pierce equal \u2014 13 equal divisions of the tritave",
  alphabet:bohlen_pierce,
  temperament:bohlen_pierce_equal,
  degrees(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
)

tuning shruti23_native(
  description:"22-shruti nomm\xE9 BP3 \u2014 23 degr\xE9s sur le temp\xE9rament bp3_shruti23_native (table native -to.tryShruti verbatim, 729/512). Distinct de bp3_grama (Arnold).",
  alphabet:shruti23,
  temperament:bp3_shruti23_native,
  degrees(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22)
)

tuning western_just_c(
  description:"Western en intonation juste BP3, C-ancr\xE9 (tonique C4 = 261.63 Hz, table native -to.tryOneScale). Le 'j' de Cj/Aj/Gj = marqueur de degr\xE9, pars\xE9 C/A/G ; TOUTES les notes rendues par cette m\xEAme gamme juste (mod\xE8le Romain [428/429] : un tuning, pas d'alphabet parall\xE8le). Distinct de western_just (A440-ancr\xE9). Temp\xE9rament bp3_just_intonation = co\xEFncide avec just_5limit sur C/D/E/F/G/A (degr\xE9s 0,2,4,5,7,9).",
  alphabet:western,
  temperament:bp3_just_intonation,
  degrees(0, 2, 4, 5, 7, 9, 11),
  baseNote:C,
  diapason:261.63
)

tuning shakuhachi_12TET(
  description:"Shakuhachi 1.8 shaku \u2014 les cinq doigtes de base sur temperament egal",
  alphabet:shakuhachi,
  temperament:12TET,
  degrees(0, 3, 5, 7, 10)
)
`, "fichier": "tunings.bpsl" }, { "nom": "types", "format": "bpsl", "texte": '// @documented\ndef types(resolves:types)\n\ndef scale(scope(scene))\nscale interval\nscale degree\ndegree directional\nscale composite\n\ndef sound(scope(scene))\n\ndef alphabet(scope(scene), octaves:western, sound terminals())\n\ndef temperament\ndef tuning(scope(scene))\ndef octaves(scope(scene))\ndef voice(scope(scene))\ndef eval(scope(scene))\ndef midi_default\n\ndef control\ndef addresskey\ndef enum\ndef flag\ndef symbol\n\ndef destination\ndestination audio(out:true, writable:true, params(gain:1))\ndestination midi(in:true, out:true, writable:true, params(ch:1))\ndestination osc(\n  in:true,\n  out:true,\n  writable:true,\n  params(host:"127.0.0.1", port:57120, addr:/kanopi)\n)\ndestination keyboard(in:true, writable:true)\ndestination dmx(out:true, writable:true, params(universe:0))\ndestination text(out:true, writable:false)\n\ndef actor(alphabet alphabet, tuning tuning, octaves octaves, destination out, eval eval)\n\ndef signal\nsignal pitch\nsignal phase\nsignal logic\n', "fichier": "types.bpsl" }, { "nom": "variation", "format": "bpsl", "texte": `types

// @documented
def variation(
  resolves:variation,
  resolvedBy:"Kairos",
  name:variation,
  description:"Modes de variation DISCRETS des param\xE8tres de jeu \u2014 fixe et paliers. Entre deux valeurs \xE9crites d'un m\xEAme param\xE8tre, le mode dit si la premi\xE8re TIENT jusqu'\xE0 la seconde (fixe) ou si elle GLISSE de note en note (paliers). Ces deux modes se r\xE9solvent \xE0 la note, donc avant qu'un son ne soit \xE9mis : ils appartiennent \xE0 Kairos. Le troisi\xE8me mode \u2014 continu \u2014 glisse PENDANT les notes, par messages interm\xE9diaires : il ne peut \xEAtre rendu que par celui qui \xE9met, et il vit donc dans la librairie de son param\xE8tre.",
  version:0.1.0,
  section:controls
)

control velfixed(
  bp3:_velfixed,
  description:"V\xE9locit\xE9 en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net.",
  scope(symbol, group, rule, flow)
)

control velstep(
  bp3:_velstep,
  description:"V\xE9locit\xE9 PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.",
  scope(symbol, group, rule, flow)
)

control modfixed(
  bp3:_modfixed,
  description:"Modulation en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net.",
  scope(symbol, group, rule, flow)
)

control modstep(
  bp3:_modstep,
  description:"Modulation PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.",
  scope(symbol, group, rule, flow)
)

control pitchfixed(
  bp3:_pitchfixed,
  description:"Pitchbend en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net.",
  scope(symbol, group, rule, flow)
)

control pitchstep(
  bp3:_pitchstep,
  description:"Pitchbend PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.",
  scope(symbol, group, rule, flow)
)

control pressfixed(
  bp3:_pressfixed,
  description:"Pression en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net.",
  scope(symbol, group, rule, flow)
)

control presstep(
  bp3:_presstep,
  description:"Pression PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.",
  scope(symbol, group, rule, flow)
)

control volumefixed(
  bp3:_volumefixed,
  description:"Volume en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net.",
  scope(symbol, group, rule, flow)
)

control volumestep(
  bp3:_volumestep,
  description:"Volume PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.",
  scope(symbol, group, rule, flow)
)

control articulfixed(
  bp3:_articulfixed,
  description:"Articulation en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net. L'articulation se pose par legato et staccato.",
  scope(symbol, group, rule, flow)
)

control articulstep(
  bp3:_articulstep,
  description:"Articulation PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.",
  scope(symbol, group, rule, flow)
)

control panfixed(
  bp3:_panfixed,
  description:"Panoramique en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net.",
  scope(symbol, group, rule, flow)
)

control panstep(
  bp3:_panstep,
  description:"Panoramique PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.",
  scope(symbol, group, rule, flow)
)

control mapfixed(
  bp3:_mapfixed,
  description:"Carte de touches en mode FIXE \u2014 la carte \xE9crite tient jusqu'\xE0 la suivante, saut net.",
  scope(symbol, group, rule, flow)
)

control mapstep(
  bp3:_mapstep,
  description:"Carte de touches PAR PALIERS \u2014 la carte glisse de note en note entre deux cartes \xE9crites.",
  scope(symbol, group, rule, flow)
)

control transposefixed(
  bp3:_transposefixed,
  description:"Transposition en mode FIXE \u2014 la valeur \xE9crite tient jusqu'\xE0 la suivante, saut net.",
  scope(symbol, group, rule, flow)
)

control transposestep(
  bp3:_transposestep,
  description:"Transposition PAR PALIERS \u2014 la valeur glisse de note en note entre deux valeurs \xE9crites.",
  scope(symbol, group, rule, flow)
)
`, "fichier": "variation.bpsl" }, { "nom": "voices", "format": "bpsl", "texte": 'types\n\n// @documented\ndef voices(resolvedBy:Kairos, name:voices, resolves:voice)\n\nvoice wobble(\n  audio:"`js: (t, dur, env) => (2*((t*env.pitch)%1)-1) * (0.55+0.45*Math.sin(2*Math.PI*5.5*t)) * Math.max(0,1-t/dur)`",\n  section:objects\n)\nvoice fatbass(\n  audio:"`js: (t, dur, env) => ((2*((t*env.pitch)%1)-1) + (2*((t*env.pitch*1.01)%1)-1)) * 0.4 * Math.max(0,1-t/dur)`",\n  for(sub37(device(preset:bass-init, glide:0.2, osc1-wave:saw))),\n  section:objects\n)\nvoice bayan_open(\n  audio:"`js: (t) => { const h = Math.sin(t*99991)*43758.5453; const b = 2*(h-Math.floor(h))-1; return (Math.sin(2*Math.PI*80*t)*0.8 + b*0.2) * Math.exp(-t/0.35); }`",\n  section:objects\n)\nvoice bayan_muted(\n  audio:"`js: (t) => { const h = Math.sin(t*99991)*43758.5453; const b = 2*(h-Math.floor(h))-1; return (Math.sin(2*Math.PI*120*t)*0.5 + b*0.5) * Math.exp(-t/0.08); }`",\n  section:objects\n)\nvoice dayan_ring(\n  audio:"`js: (t) => (Math.sin(2*Math.PI*320*t) + Math.sin(2*Math.PI*480*t)) * 0.5 * Math.exp(-t/0.4)`",\n  section:objects\n)\nvoice dayan_tap(\n  audio:"`js: (t) => { const h = Math.sin(t*99991)*43758.5453; return (2*(h-Math.floor(h))-1) * Math.exp(-t/0.06); }`",\n  section:objects\n)\nvoice dayan_dry(\n  audio:"`js: (t) => (Math.sin(2*Math.PI*494*t) + Math.sin(2*Math.PI*587*t)) * 0.5 * Math.exp(-t/0.06)`",\n  section:objects\n)\nvoice dayan_open(\n  audio:"`js: (t) => (Math.sin(2*Math.PI*392*t) + Math.sin(2*Math.PI*494*t) + Math.sin(2*Math.PI*523*t) + Math.sin(2*Math.PI*587*t)) * 0.25 * Math.exp(-t/0.22)`",\n  section:objects\n)\nvoice dummy_csound_a(\n  audio:"`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`",\n  section:objects\n)\nvoice dummy_csound_b(\n  audio:"`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`",\n  section:objects\n)\nvoice dummy_csound_c(\n  audio:"`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`",\n  section:objects\n)\nvoice dummy_csound_d(\n  audio:"`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`",\n  section:objects\n)\nvoice dummy_csound_e(\n  audio:"`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`",\n  section:objects\n)\nvoice dummy_csound_f(\n  audio:"`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`",\n  section:objects\n)\nvoice dummy_csound_midiobject(\n  audio:"`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`",\n  section:objects\n)\n', "fichier": "voices.bpsl" }];
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
    const lib = leRegistre()[qualifie.slice(0, point)];
    const nom = qualifie.slice(point + 1);
    if (!lib || typeof lib !== "object") return "librairie absente";
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
    controls: Object.entries(ctx.controls).map(([name, def]) => ({ name, ...pick(def || {}, ["args", "range", "values", "value", "description", "transportGroup"]) })),
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
  constructor(msg, token) {
    super(`${msg} at line ${token.line}:${token.col}`);
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
    throw new ParseError(
      `'${subkey}' is not an output \u2014 the output channels are ${[...outChannels()].join(", ")}. The list is CLOSED.`,
      tok
    );
  }
  if (!writableChannels().has(subkey)) {
    throw new ParseError(
      `'out.${subkey}' is refused \u2014 this channel is a DESTINATION of the architecture, routed like the other outputs, but its WRITE from a scene still awaits its dedicated device.`,
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
      `'mode' expects the derivation mode it sets \u2014 'mode:<mode>'. Written alone, it governs NOTHING: the sub-grammar keeps the mode it had, and the line disappears without a trace. The modes are ${declares.join(", ")}.`,
      tok
    );
  }
  if (!declares.includes(ecrit)) {
    throw new ParseError(
      `'mode:${ecrit}': '${ecrit}' is not a derivation mode \u2014 the modes are ${declares.join(", ")}. The list is CLOSED.`,
      tok
    );
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
    throw new ParseError(
      `${where}: unknown voice '${name}' \u2014 no entry '${name}' in the catalog of the 'voice' word (LANG-SONS \xA73).`,
      token
    );
  }
  const defs = [...entry.base ? [entry.base] : [], ...Object.values(entry.forDevices)];
  for (const def of defs) {
    if (def.audio !== void 0 && !isTypedBacktick(def.audio)) {
      throw new ParseError(
        `${where}: voice '${name}' \u2014 invalid 'audio' realization in the catalog of the 'voice' word: a TYPED backtick is required (\`js: \u2026\`, \`faust: \u2026\`); received ${JSON.stringify(def.audio)}.`,
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
        `'${nom}' is a NUMBER, not a name. A name that starts with a digit carries at least one letter \u2014 '12TET' and '22shruti' are names, '${nom}' is not one.`,
        depart
      );
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
        throw new ParseError(
          `a rule is written BEFORE the delimiter: the line '-----' is missing between the declarative part and the production. Since the at-sign left the language, it is POSITION that qualifies a line \u2014 before the '-----' it declares, after it produces.`,
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
            throw new ParseError(
              `'${el.name}' expands without end \u2014 a definition ends up invoking itself. A form that contains itself does not expand.`,
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
          `'${el.name}' is ${def.kind === "prereglage" ? "a preset" : "a structure"}: it is placed BARE, without arguments. Write '${el.name}'. A parameter list is declared with the name ('def ${el.name}(x) \u2026'), and only then does the call carry any.`,
          jetonDe(el)
        );
      }
      return corpsSubstitue(def, el);
    }
    if (el.type !== "Symbol") return null;
    if (def.kind === "transformation") {
      throw new ParseError(
        `'${el.name}' is a transformation on ${def.params.join(", ")}: it is called with its arguments. Write '${el.name}(${def.params.map(() => "\u2026").join(", ")})'. Placed bare, the name would come out of the tree as a terminal and sound.`,
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
        `'${def.name}(\u2026)': a transformation argument is given by POSITION, never by name \u2014 received '${nommes[0].key}:'. Write '${def.name}(${def.params.map(() => "\u2026").join(", ")})', the parameters in the order of the definition (${def.params.join(", ")}).`,
        jetonDe(appel)
      );
    }
    if (args.length !== def.params.length) {
      throw new ParseError(
        `'${def.name}' is defined with ${def.params.length} parameter(s) (${def.params.join(", ")}) and is called here with ${args.length} argument(s). A transformation called wrongly would leave a parameter unsubstituted in the tree, in the form of a terminal that would sound.`,
        jetonDe(appel)
      );
    }
    const valeurs = /* @__PURE__ */ new Map();
    def.params.forEach((p, i) => {
      const v = args[i]?.value;
      if (!v || v.type !== "Literal" || typeof v.value !== "string" && typeof v.value !== "number") {
        throw new ParseError(
          `'${def.name}(\u2026)': the argument '${p}' is not a term. A transformation argument is a NAME (a terminal, a rule head), written bare.`,
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
      throw new ParseError(
        criFlags.length === 1 ? criFlags[0] : `${criFlags.length} flag usages designate nothing:
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
      throw new ParseError(
        `the value of '${dirName}' reads '${ecrit}', and '${reste}' remains stuck to it without being read as part of it. A directive value is BARE: a number, a ratio ('3/4'), or a name. Remove '${reste}' if it is a unit \u2014 no directive carries one \u2014 or space it out if what follows is something else.`,
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
          `'[${name}${ecrit}]': a production directive is written at the top of the scene, before the delimiter \u2014 '${name}${ecrit}'. A block that grouped several keys is rewritten as that many lines. The bracket carries what belongs to DERIVATION: a flag, a procedure, a rank.`,
          atTok
        );
      }
      if (name !== "seed") {
        throw new ParseError(
          `'![${name}\u2026]': only 'seed' makes sense in the flow (re-seed _srand); '${name}' is placed at the top of the scene, '${name}'.`,
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
      throw new ParseError(`'in ${peek(1).value}' is refused \u2014 an input declares its CHANNEL: 'in.<channel> ${peek(1).value}'. The input channels are ${[...inChannels()].join(", ")}. Without it, no runtime is addressed and nothing triggers.`, tok);
    }
    if (mot === "in" && peek(1).type === T.PERIOD && !peek(1).spaceBefore && peek(2).type === T.IDENT) {
      advance();
      advance();
      const canal = expect(T.IDENT).value;
      if (at(T.LPAREN)) {
        throw new ParseError(`'in.${canal}(\u2026)' is refused \u2014 an input carries NO port name. A port name comes from the system and changes from machine to machine; the scene names a ROLE, the user associates the device, and the association lives outside the scene.`, tok);
      }
      if (!inChannels().has(canal)) {
        throw new ParseError(`'${canal}' is not an input \u2014 the input channels are ${[...inChannels()].join(", ")}. The list is CLOSED.`, tok);
      }
      if (!at(T.IDENT)) {
        throw new ParseError(`'in.${canal}' must name the ROLE that the input holds \u2014 'in.${canal} <role>'. The type comes first, the name next.`, current());
      }
      const roleName = advance().value;
      let table = null;
      while (at(T.IDENT)) {
        const cle = advance().value;
        if (!at(T.PERIOD)) {
          throw new ParseError(`in.${canal} ${roleName}: '${cle}' must CALL a component with a period ('mapping.<table>') \u2014 the period CALLS, the colon ASSIGNS.`, tok);
        }
        advance();
        const valeur = expect(T.IDENT).value;
        if (cle === "mapping") {
          table = valeur;
        } else if (cle === "alphabet") {
          throw new ParseError(`in.${canal} ${roleName}: an input carries NO alphabet. There is nothing to resolve on input \u2014 the event is DISCRETE, not a signal to interpret. It is the TABLE (mapping.<name>) that declares the vocabulary the labels draw from, and it does so in a library, not in the scene.`, tok);
        } else {
          throw new ParseError(`in.${canal} ${roleName}: unknown property '${cle}' \u2014 an input declares its channel and, optionally, its table ('mapping.<table>'). Nothing else.`, tok);
        }
      }
      return { type: "InDirective", name: roleName, transport: canal, mapping: table, line: tok.line };
    }
    if (mot === "def" || mot === "init") return null;
    if (mot === "object" && ouvreUnNom(1)) {
      throw new ParseError(
        `'object ${peek(1).value}': 'object' has LEFT the language \u2014 the root of a family is declared with 'def ${peek(1).value}(\u2026)', and an instance by its type in front ('${peek(1).value} <name>(\u2026)'). Only one word declares: 'def'.`,
        tok
      );
    }
    if (mot === "actor" && ouvreUnNom(1)) {
      if (!prototypesDeclares.has("actor")) {
        throw new ParseError(`'actor ${peek(1).value}': 'actor' is not a type in scope. It is an object of 'types' \u2014 invoke 'types', 'core', or a library that invokes 'types'.`, tok);
      }
      return null;
    }
    if (!prototypesDeclares.has(mot)) {
      const apresLeNom = peek(2).type;
      const formeDeDeclaration = apresLeNom === T.NEWLINE || apresLeNom === T.EOF || apresLeNom === T.COMMENT || apresLeNom === T.COLON && !peek(2).spaceBefore;
      if (peek(1).type === T.IDENT && formeDeDeclaration && !motReserve(mot) && !libCtx.portees.has(mot)) {
        throw new ParseError(`'${mot} ${peek(1).value}': '${mot}' is not a type in scope. A type in front is an object in scope \u2014 declared by the scene, or brought by a library invoked at the top (the base lives in 'types') \u2014 or in.<channel>.`, tok);
      }
      return null;
    }
    if (!ouvreUnNom(1)) {
      if (peek(1).type === T.NEWLINE || peek(1).type === T.EOF) {
        if (loadLib(mot) || catalogAxisKeys().has(mot)) return null;
        throw new ParseError(`'${mot}' must name what it declares \u2014 the type comes first, the name next ('${mot} <name>').`, tok);
      }
      return null;
    }
    advance();
    const premier = lireNomDEntree(tok);
    if (mot === "flag") {
      if (!at(T.COLON)) {
        throw new ParseError(
          `flag ${premier}: a flag carries its initial value \u2014 'flag ${premier}:<integer>'. That is the only form: neither the name alone, nor named states in parentheses. A flag counts and is compared to integers.`,
          current()
        );
      }
      advance();
      if (!at(T.INT)) {
        throw new ParseError(
          `flag ${premier}: the initial value is an INTEGER \u2014 'flag ${premier}:<integer>'. A flag counts and is compared to integers.`,
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
        throw new ParseError(`${mot} ${nom}: a starting value STICKS to its sign \u2014 '${nom}:<value>', never '${nom}: <value>'. The space separates two terms, sticking them together joins them.`, t);
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
      throw new ParseError(`${mot} ${nom}: a starting value is placed after ':' \u2014 a number or a name. Received '${t.value ?? t.type}'.`, t);
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
      throw new ParseError(
        `the at-sign has LEFT the language \u2014 write '${apres && apres.value ? apres.value : "<directive>"}' without it. What qualifies a line is its POSITION: before the '-----' it declares, after it produces.`,
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
      throw new ParseError(
        `${directive} ${nom}: the sign '=' has been REMOVED from the whole language \u2014 write '${directive} ${nom} <value>' with nothing between the two.`,
        current()
      );
    }
    if (name === "def" || name === "terminal") {
      const motDeclarant = name;
      if (!ouvreUnNom()) {
        throw new ParseError(
          `'${motDeclarant}' must name what it defines: '${motDeclarant} <name> <body>'. The name comes first, what it is worth next \u2014 like 'actor'. A NAME STARTS WITH A LETTER, or with a digit if it carries at least one letter: 'western', 'a_b', '12TET' are ones; '12', '_ab', '#a', '-ab' and '"ab"' are not. Received: ${JSON.stringify(String(current().value ?? current().type))}.`,
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
          if (!at(T.IDENT)) throw new ParseError(`'def ${defName}': name expected after '${cle}.'`, current());
          let val = String(advance().value);
          while ((at(T.IDENT) || at(T.INT)) && !current().spaceBefore) val += String(advance().value);
          if (at(T.PERIOD) && !current().spaceBefore) {
            const suite2 = peek(1);
            const interne = suite2 && suite2.value != null ? String(suite2.value) : null;
            throw new ParseError(
              `'${cle}.${val}${interne ? `.${interne}` : ""}\u2026' addresses a catalog by TWO levels \u2014 only one is written. The period calls an ENTRY, never the structure that holds it: write '${cle}.${interne ?? "<entry>"}' if '${interne ?? "\u2026"}' is the entry wanted, or '${cle}.${val}' if it is '${val}'.`,
              kTok
            );
          }
          cles[cle] = { kind: "ref", value: val };
          lu++;
          return;
        }
        if (at(T.COLON) && !current().spaceBefore) {
          advance();
          if (atEnd() || at(T.NEWLINE)) throw new ParseError(`'def ${defName}': value expected after '${cle}:'`, current());
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
                `'def ${defName}': typed code cannot follow another part in the value of '${cle}'. Typed code IS the value \u2014 write it alone after the colon.`,
                current()
              );
            }
            if (!PARTIE.has(current().type)) {
              throw new ParseError(
                `'def ${defName}': '${current().value ?? current().type}' is not readable in the value of '${cle}'. A value is made of WORDS \u2014 a name, a number, a text in quotes, a ratio \u2014 and the space separates its parts. This sign opens a structure, and a structure is not placed in a value: write it in the body in parentheses of the declaration.`,
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
          `'def ${defName}': '${cle}' is neither a component call nor an assignment. A terminal key is written '${cle}.<name>' to call a component, or '${cle}:<value>' to assign a value \u2014 the period calls, the colon assigns.`,
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
            throw new ParseError(
              `'def ${defName}(${params.join(", ")})': transformation without a body. What the definition DOES with its parameters is written after them.`,
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
        throw new ParseError(
          `'terminal ${defName}': a terminal is declared by its KEYS \u2014 'voice.<name>', 'hz:<n>', 'degree:<n>', 'register:<n>', 'sounding:<true|false>', 'duration:<n>', 'tuning.<name>', 'octaves.<name>'. A sequence of terms is a STRUCTURE, and it is written 'def ${defName} <terms>'.`,
          current()
        );
      }
      if (at(T.IDENT) && !cleEnTete()) {
        const corps = parseRhsElements();
        if (corps.length === 0) {
          throw new ParseError(
            `'def ${defName}': empty structure. A name worth nothing is not reinvoked.`,
            tok
          );
        }
        const backtick = corps.find((e) => e && typeof e.type === "string" && e.type.includes("Backtick"));
        if (backtick) {
          throw new ParseError(
            `'def ${defName}' carries CODE, not a structure \u2014 this stage reads "a name is worth a sequence of terms" ('def cadence sa re ga pa'). The typed code body ('def ${defName} <type> \`language: \u2026\`', types 'signal', 'pitch', 'phase', 'logic') is NOT yet read; it is refused here rather than being read the wrong way \u2014 otherwise the type would become a terminal and the code a neighboring element.`,
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
            `'terminal ${defName}': the body opened by '(' is not closed \u2014 ')' is missing.`,
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
          `${apresLeNom && apresLeNom.spaceBefore === false && apresLeNom.type !== T.EOF ? `the name read stops at '${defName}': the sign ${JSON.stringify(String(apresLeNom.value ?? apresLeNom.type))} that follows it does not belong to a name, and what remains does not read as any body. ` : ""}'${motDeclarant} ${defName}' declares nothing. This stage reads TWO bodies: the TERMINAL DECLARATION \u2014 a name then its keys, on the same line ('def ${defName}  voice.sec') or in an indented block, one key per line \u2014 and the STRUCTURE, a name that is worth a sequence of terms ('def ${defName} sa re ga pa'). The other bodies the specification describes \u2014 a wiring, typed code, a preset, a parameterized or structural transformation \u2014 are NOT yet read; they will be, and until then they are refused here rather than being read the wrong way.`,
          tok
        );
      }
      return { type: "DefDirective", name: defName, kind: "terminal", keys: cles, line: tok.line };
    }
    if (name === "init") {
      if (subkey) {
        const forme = formeDuMot("init");
        throw new ParseError(
          `'init.${subkey}': 'init' is a word of the LANGUAGE, it is not qualified by a period${forme ? ` \u2014 it is written '${forme}'` : ""}, and gathers what belongs to the whole scene: tagged code, or a bag of starting values.`,
          current()
        );
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
        throw new ParseError(
          `'actor.${subkey}': 'actor' is a word of the LANGUAGE, it is not qualified by a period${forme ? ` \u2014 it is written '${forme}'` : ""}. The period carries the DERIVATION of an actor, after its name: 'actor <name>.<kind>'.`,
          current()
        );
      }
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
            if (brut === "") throw new ParseError(`value expected after '${paramKey}:'`, current());
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
            `actor '${actorName}': this key does not exist. The output direction is written 'out.<channel>' \u2014 for example 'out.audio' or 'out.midi(ch:3)'.`,
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
            const ou = key === "voice" ? ` \u2014 a voice attaches to the TERMINAL, not to the actor` : key === "sound" || key === "sounds" ? ` \u2014 a sound object prototype lives in a library, it is not placed on the actor` : "";
            throw new ParseError(
              `'${key}.\u2026' is not an actor key${perimee ? " (removed)" : ""}${ou}. The keys of an actor are: ${[...actorKeysData().valides].join(", ")}`,
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
              `'${key}:\u2026' refused \u2014 ':' does not assign a value to a component. Write '${canon}.<name>'` + (key === "out" ? " with its params in () \u2014 e.g. out.midi(ch:3)" : "") + ` (rule: '.' CALLS the component, ':' ASSIGNS a value).`,
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
          `actor '${actorName}': the body opened by '(' is not closed \u2014 ')' is missing.`,
          current()
        );
      }
      if (corpsParenthese) advance();
      if (properties.eval && properties.transport) {
        throw new ParseError(
          `actor '${actorName}': a producer 'eval.${properties.eval}' outputs natively \u2014 no 'out' (it produces and outputs by its own means; its native output is not routed). Remove the 'out' from this actor.`,
          tok
        );
      }
      if (properties.transport && (properties.transport.key === "video" || properties.transport.key === "visual")) {
        throw new ParseError(
          `actor '${actorName}': 'out.${properties.transport.key}' does not exist \u2014 the visual channel has been REMOVED (embedded visuals output natively on their canvas). Output channel = audio/midi/osc only.`,
          tok
        );
      }
      if (properties.transport && !outChannels().has(properties.transport.key)) {
        throw new ParseError(
          `actor '${actorName}': '${properties.transport.key}' is not an output \u2014 the output channels are ${[...outChannels()].join(", ")}. The list is CLOSED.`,
          tok
        );
      }
      if (properties.transport && outChannels().has(properties.transport.key) && !writableChannels().has(properties.transport.key)) {
        throw new ParseError(
          `actor '${actorName}': 'out.${properties.transport.key}' is refused \u2014 this channel is a DESTINATION of the architecture, routed like the other outputs, but its WRITE from a scene still awaits its dedicated device.`,
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
        `'sound:<X>' refused \u2014 ':' does not assign a value to a component. Write 'sound.<name>' (rule: ':' assigns, '.' calls).`,
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
      const hint = name === "tuning" ? " ; reference frequency \u2192 'diapason:<N>'" : "";
      throw new ParseError(
        `'${name}:<X>' refused \u2014 ':' does not assign a value to a component. Write '${name}.<name>' (rule: ':' assigns, '.' calls)${hint}.`,
        current()
      );
    }
    if (at(T.COLON)) {
      advance();
      ({ value, runtime } = parseDirectiveColonValue(name));
    }
    if (name === "alphabet" && subkey && runtime && !outChannels().has(runtime)) {
      const hint = runtime === "sc" ? ` The old sugar ':sc' (= transport+eval sc) is ABOLISHED \u2014 an eval is declared on an actor ('eval.<X>'); the implicit actor's shorthand names only a channel.` : "";
      throw new ParseError(
        `'alphabet.${subkey}:${runtime}' refused \u2014 the output shorthand of the implicit actor only accepts {audio, midi, osc} (closed positive list).${hint}`,
        current()
      );
    }
    if (name === "alphabet" && subkey && runtime && outChannels().has(runtime) && !writableChannels().has(runtime)) {
      throw new ParseError(
        `'alphabet.${subkey}:${runtime}' refused \u2014 this channel is a DESTINATION of the architecture, routed like the other outputs, but its WRITE from a scene still awaits its dedicated device.`,
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
        const portees = libCtx.portees.get(modName) || null;
        if (!portees) {
          const declarants = librairiesQuiDeclarent(modName);
          throw new ParseError(
            `'mode:${runtime || "\u2026"}(${modName})': '${modName}' is not declared by any invoked library. A sub-grammar modifier is a library word like any other \u2014 ${declarants.length ? `invoke at the top the one that carries it (${declarants.map((l) => `'${l}'`).join(" or ")})` : "no library in the registry declares it: remove the word"}.`,
            tokModName
          );
        }
        if (!portees.includes("subgrammar")) {
          throw new ParseError(
            `'${modName}' does not apply to a sub-grammar \u2014 its declared scope is ${JSON.stringify(portees)}. ${portees.includes("scene") ? `It is written at the top of the scene: '${modName}'.` : `It is worth ${portees.map((p) => `'${p}'`).join(", ")}.`}`,
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
    throw new ParseError('value expected after ":"', current());
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
        `Macro '${macroName}': parameter(s) declared but absent from the body: ${unused.join(", ")}. A macro is a textual substitution (EBNF \xA7macro l.59/273) \u2014 each parameter MUST appear in the body (e.g. accent(x) = x(vel:120)). A declaration name(target, transport) = curve (CV/signal form) is not a valid macro: syntax pending arbitration.`,
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
    let index2 = 1;
    let safety = 0;
    let currentMode = initialMode || null;
    let currentModifiers = initialModifiers || null;
    while (!atEnd()) {
      if (++safety > 200) throw new ParseError("Subgrammar parse loop safety limit", current());
      skipNewlines();
      if (atEnd()) break;
      if (atProductionBlock()) {
        throw new ParseError(`Production block [@\u2026]: allowed at the top of the scene only`, current());
      }
      if (at(T.BANG) && peek(1).type === T.LBRACKET && peek(2).type === T.AT) {
        throw new ParseError(`Form '![@\u2026]' reserved (production directive in the flow) \u2014 not implemented`, current());
      }
      let blockMode = currentMode;
      let blockModifiers = currentModifiers;
      while (!atEnd() && !at(T.SEPARATOR) && !at(T.NEWLINE) && ligneSansFleche()) {
        if (at(T.IDENT) && current().value === "template") break;
        if (at(T.IDENT) && current().value === "templates") {
          throw new ParseError(`'templates' (plural, v0.7) no longer exists \u2014 write 'template' (singular)`, current());
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
            throw new ParseError(
              `'${dirNom}' is not a declaration: it is a setting, and it is not written alone on a line. It applies ${ou.length === 1 ? ou[0] : ou.slice(0, -1).join(", ") + " or " + ou[ou.length - 1]}.`,
              dirTok
            );
          }
          throw new ParseError(
            `'${dirNom}' is written AFTER rules, and in this place it declares NOTHING: it was accepted then silently discarded. Declarations precede the rules \u2014 move this line up before the scene's first rule. (Only 'mode' is placed here: it governs the sub-grammar that follows.)`,
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
            throw new ParseError(`unrecognized line at rule level: expected a rule, 'directive', '-----' or the end of the scene`, current());
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
          `the template catalog is transported VERBATIM: the parser needs the SOURCE to render the line as it is written. The caller must pass 'source' to parse().`,
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
            `'?${current().value}': a numbered wildcard only makes sense in a rule (the number unifies with the arrow, which replays the choice). A @template catalog line has no arrow \u2014 its wildcards are always anonymous ('?'), never numbered.`,
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
        throw new ParseError(`duration isolated in the flow: ':N' sticks to a terminal (A4:1/2), a group ({A B}:2) or the whole rule (at the end of the RHS) \u2014 never in the middle of the flow`, current());
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
      if (pair.key === "scan") {
        if (!libCtx.controls.scan) continue;
        if (scanValues.includes(pair.value)) {
          ruleMode = pair.value;
        } else {
          throw new ParseError(
            `(scan:${pair.value}): unknown value (expected: ${scanValues.join(", ")})`,
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
          `guard '[${flag}=\u2026]': '=' is a MUTATION, it is written at the end of the rule ('S -> C4 [${flag}=\u2026]'). To TEST the value of a flag before the LHS, compare with '==' ('[${flag}==\u2026] S -> C4')`,
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
            `a CONTEXT is only placed at the EXTREMITIES of the left-hand side \u2014 at the front ('(A) x B -> \u2026') or at the tail ('x B (A) -> \u2026'). Here it follows '${elements.length}' element(s) and precedes others: the engine does not know this place, and the tree produced would be readable by no one.`,
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
            `"$" stuck to an identifier is forbidden in LHS \u2014 use "$ " (dollar isolated with a space)`,
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
        `Malformed interval for '${ctrlName}'${why ? ": " + why : ""} \u2014 expected a fraction (3/2), cents (700c) or a decimal (1.5)`,
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
        `Interval in quotes not supported for '${ctrlName}': write the BARE form '${current().value}' (without quotes) \u2014 an interval is written as a fraction (3/2), cents (700c) or a decimal (1.5)`,
        startTok
      );
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
    throw new ParseError(
      `'${nomDeclare} (\u2026)': a space between a declared word and its bag separates them into two terms \u2014 a bag is attached to the word it describes. Write '${nomDeclare}(\u2026)'.`,
      current()
    );
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
        throw new ParseError(
          `the sign '${peek(k).value ?? peek(k).type}' is not readable in a member: a member is a name, a number or a text in quotes. The members already read are '${pairs.map((p) => p.key).join(", ")}'.`,
          peek(k)
        );
      }
      throw new ParseError(
        `two terms are separated by a space: before the delimiter, only the comma separates \u2014 the space separates nothing there, it is formatting. Write '${pairs.map((p) => p.key).join(", ")}, ${peek(k).value ?? ""}'.`,
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
          throw new ParseError(
            `'${key}.\u2026' names a NUMBERED component: it expects a number, not '${current().value}' (example: '(${key}.98:45)'). Controllers that have a name are written by their name`,
            current()
          );
        }
        const component = Number(advance().value);
        if (!at(T.COLON)) {
          throw new ParseError(
            `'${key}.${component}' names a component without assigning it a value \u2014 ':value' is missing (example: '(${key}.${component}:45)')`,
            current()
          );
        }
        advance();
        if (current().spaceBefore) {
          throw new ParseError(
            `'${key}.${component}: ' \u2014 no space after the colon: the value begins immediately ('${key}.${component}:${current().value}')`,
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
            `'${key}.${composant}: ' \u2014 no space after the colon: the value begins immediately ('${key}.${composant}:${current().value}')`,
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
              `'${key}.${composant}:\u2026' \u2014 '${composant}' is a SCENE directive: it is written at the top, before the delimiter, never in a parenthesis. The prefix changes nothing here, '${composant}:\u2026' bare is refused too.`,
              keyTok
            );
          }
          throw new ParseError(
            `'${key}.${composant}:\u2026' \u2014 the library '${key}' does not declare any control '${composant}'. The prefix is correct, the control is not part of it.`,
            keyTok
          );
        }
        const motsInvoques2 = /* @__PURE__ */ new Set();
        for (const [fichier, lib] of Object.entries(libCtx._libs || {})) {
          motsInvoques2.add(fichier);
          if (lib && typeof lib.resolves === "string" && lib.resolves) motsInvoques2.add(lib.resolves);
        }
        if (motsInvoques2.has(key)) {
          throw new ParseError(
            `'${key}.${composant}:\u2026' \u2014 the library '${key}' is indeed invoked, and it does not declare ANY control: nothing is assigned there through a parenthesis. The prefix is correct, the library is not one of those that carry controls.`,
            keyTok
          );
        }
        throw new ParseError(
          `'${key}.${composant}:\u2026' assigns a value to the component '${composant}' of '${key}' \u2014 but '${key}' is neither an invoked library, nor a control with components, nor an instance declared in this scene. Declare the instance first: '<module> ${key}'`,
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
            `'${key}: ' \u2014 no space after the colon: the value begins immediately ('${key}:${current().value}\u2026'). The space only separates the PARTS of a value`,
            current()
          );
        }
        const specReglage = libCtx.controls[key];
        const reglageMultiPartie = specReglage && Array.isArray(specReglage.args) && specReglage.args.length > 1;
        if (libCtx.qualifierKeys.has(key) && !reglageMultiPartie) {
          const { value, decrement } = readQualifierValue();
          if (value === void 0) {
            const exemple = specReglage && Array.isArray(specReglage.values) && specReglage.values[0] || "\u2026";
            throw new ParseError(
              `'(${key}:)' assigns no value \u2014 the colon expects one (for example '(${key}:${exemple})')`,
              keyTok
            );
          }
          if (at(T.IDENT) && peek(1).type === T.COLON) {
            throw new ParseError(
              `'(${key}:\u2026 ${current().value}:\u2026)': two ELEMENTS of the bag separated by a SPACE \u2014 they are missing a COMMA ('(${key}:\u2026, ${current().value}:\u2026)'). The space only separates the PARTS of a single value`,
              current()
            );
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
              throw new ParseError(
                `'${key}:${parts.join("")} ${current().value}\u2026': in the DECLARATIVE part, only the comma separates \u2014 the space separates nothing there. A value has only ONE part; several parts are several values, and they are written with a parenthesis and names: '${key}(${parts.join("")}, ${current().value}\u2026)'. In the FLOW, after the delimiter, the space separates terms as before.`,
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
            `'${key}:${brut}': '${brut}' has LEFT the language \u2014 the requirement is read from the ABSENCE of a default, the multiplicity from the EXEMPLAR. Write '${key}' alone for a required member, or '${key}()' for a required collection; a value given after ':' makes it an optional member for which it is the default.`,
            current()
          );
        }
        if (elementAvale) {
          throw new ParseError(
            `'(${key}:${brut} ${elementAvale.value}\u2026)': '${key}' expects only ONE value, so '${elementAvale.value}' is another ELEMENT of the bag \u2014 it is missing its COMMA ('${key}:${brut}, ${elementAvale.value}\u2026'). The space only separates the PARTS of a single value`,
            elementAvale
          );
        }
        if (deuxPointsEnTrop) {
          throw new ParseError(
            `'(${key}:${brut})': the colon ASSIGNS a value, it does not separate its parts \u2014 a pair carries only one. To name a numbered component, the period calls it ('(${key}.${brut.split(":")[0]}:${brut.split(":").slice(1).join(":")})'); for several parts, the space separates them`,
            deuxPointsEnTrop
          );
        }
        if (jetons === 0) {
          throw new ParseError(
            `'(${key}:)' assigns no value \u2014 the colon expects one (for example '(${key}:80)'), and a control without an argument is written bare, without a colon. An EMPTY text is written '${key}:""': the delimiter, with nothing inside`,
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
            `'(${key}:${brut})': '${key}' takes NO argument \u2014 its declaration names none. Write '${key}' alone. A value placed here would travel all the way to the runtime with no recipient, with nothing signaling it serves no purpose.`,
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
      `the suffix '${nom}' attached to an element has been REMOVED from the language. Two forms replace it, depending on what was intended. To ASSOCIATE a gesture with an element IN THE PRODUCTION: the exclamation mark, 'C4!${nom}' \u2014 the gesture triggers at the instant of the terminal without occupying a step. To DECLARE A LABEL: the declarative part, with 'def'.`,
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
          `the form "_${nom}(\u2026)" is that of the native BP3 engine, it does not belong to BPScript \u2014 write "!(${cle}:\u2026)" instead` + (renomme ? ` (the native "_${nom}" is called "${cle}" in BPScript, and the key "${nom}" designates a DIFFERENT gesture)` : ""),
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
            `'!(\u2026)' attached to a term carries a CONJOINT flow, which travels with that term and replicates with it \u2014 a speed change does neither: it runs from where it is placed to the end of the field. It is detached by a space: '\u2026 ! (${peek(1).type === T.STAR ? "*N/M" : "/N"})'`,
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
        if (CROCHET_EN_FLUX.has(nom) && !libCtx.portees.has(nom) && !motReserve(nom)) {
          const declarants = librairiesQuiDeclarent(nom);
          throw new ParseError(
            declarants.length ? `'![${nom}:\u2026]': '${nom}' is not in scope: no invoked library declares it \u2014 invoke it at the top (${declarants.map((l) => `'${l}'`).join(" or ")}).` : `'![${nom}:\u2026]': '${nom}' is not declared by any library. The re-seeding in the flow translates the native '_srand(N)', and the word that carries it comes from a library like all the others.`,
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
            `'![seed:N]': re-seeding in the flow is written WITHOUT the at-sign \u2014 '![seed:N]'. The bracket carries what governs the derivation, and re-seeding is such a procedure; the at-sign remains at the top of the scene, where 'seed:N' sets the production.`,
            ouvre
          );
        }
        throw new ParseError(
          `'![${nom}\u2026]': only re-seeding makes sense in the flow, and it is written '![seed:N]'; '${nom}' is placed at the top of the scene, '${nom}'.`,
          ouvre
        );
      }
      if (at(T.LBRACKET)) {
        const q = parseQualifier("relative");
        const procedure = (q.pairs || []).find((p) => p && libCtx.ruleScopeControls.has(p.key));
        if (procedure) {
          throw new ParseError(
            `'![${procedure.key}: \u2026]': '${procedure.key}' is a RULE-level procedure, it is not placed in the flow \u2014 it applies to the whole rule. Write '[${procedure.key}:${procedure.value === true ? "\u2026" : procedure.value}]' as a rule suffix. In the flow, it never reaches the rule and leaves an inert control token in the production`,
            current()
          );
        }
        throw new ParseError(
          `a bracket is NOT placed in the flow: the bracket governs DERIVATION \u2014 a guard, a flag assignment, a procedure, a template rank \u2014 and none of that applies at an instant. A control placed in the flow is written in PARENTHESES: '!(shuffle)', '!(retro)', '!(vel:80)'. (Only '![seed:N]' remains, because it re-seeds the production and not the derivation.)`,
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
        const places2 = listePortees.map((p) => OU[p] || p);
        const commentEcrire = listePortees.includes("flow") ? `\xE9crire '!(${name})' pour le poser au fil de la s\xE9quence` : places2.length ? `its declaration gives it only ${places2.length > 1 ? "these places" : "this place"}: ${places2.join(", ")}` : `its declaration gives it no place in a rule`;
        throw new ParseError(
          `'${name}' has no bare form in the flow \u2014 ${commentEcrire}. A word of the vocabulary encountered where it cannot be is refused; it does not disappear.`,
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
            `'${name}(${texteDuSac()})' is readable neither as a SETTING BAG \u2014 its content is not made of 'key:value' pairs \u2014 nor as a CALL: calling requires a declared definition, and none carries the name '${name}'. To set '${name}', write '${name}(key:value)'; to call it, declare it first with 'def ${name}(x) \u2026'`,
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
    return `the call form '${name}(${texteDuSac()})' does not exist in BPScript \u2014 write '${cible}' to place it in the flow, or '${moteur ? `[${name}:\u2026]` : `(${name}:\u2026)`}' as containment. The colon ASSIGNS the value, the space separates its parts ('[goto:3 0]'), the comma separates the elements of the bag ('(vel:80, pan:64)')`;
  }
  function isControlName(name) {
    return libCtx.controlNames.has(name);
  }
  function refuserCrochetColle() {
    parseQualifier();
    throw new ParseError(
      `a bracket ATTACHED to an element no longer exists: the bracket governs DERIVATION \u2014 a flag test, an assignment, a procedure ('[goto:\u2026]', '[repeat:\u2026]', '[failed:\u2026]', '[stop]'), a template rank \u2014 and none of these places is an element suffix. An attached bag is written in PARENTHESES: '\u2026(shuffle)', '\u2026(retro)', '\u2026(vel:80)'.`,
      current()
    );
  }
  function refuserSecondSac(rang, el) {
    if (rang < 2) return;
    const nom = el && (el.name || el.symbol) ? `'${el.name || el.symbol}'` : "this element";
    throw new ParseError(
      `${nom} carries TWO attached setting bags \u2014 an element carries only one. Merge the pairs into the same bag: the comma separates them, '(key:value, key:value)'. The two forms already said the same thing; this one no longer is one.`,
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
            throw new ParseError(
              `malformed control argument in '${name}(\u2026)': '${arg} ${t.value}' \u2014 two values follow each other without a separator. A control takes arguments separated by ','; it does not take a sentence (the generic function 'script(\u2026)' has been removed from the language)`,
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
          `'${num}/${den}/\u2026': two numbers touch, and nothing says where the first ends \u2014 '${num}/${den}' followed by an attached digit can be read '${num}' then '${String(den).slice(0, 1)}\u2026', or otherwise. Numbers are never juxtaposed: separate with a SPACE`,
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
      `'|${name}|': the name between bars has left the language \u2014 write '${name}' bare. The form remains readable on BP3 input, it is no longer written in a BPScript scene. \u26A0\uFE0F Check that no terminal of the alphabet in scope is already named '${name}': the bars used to distinguish the non-terminal, the bare name no longer does.`,
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
          `'${sigil}${nom}(\u2026${current().value}\u2026)': '${current().value}' has no place in the arguments of a template \u2014 they are written 'name:value', separated by commas. To place a SETTING on the rule, a SPACE detaches it from the template ('${sigil}${nom} (${key || "key"}:\u2026)'); for a SPEED, which is not a pair, the exclamation mark places it in the flow ('${sigil}${nom} ! (*2/3)')`,
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
        `'<! ${current().value}': nothing comes between the wait point and what it waits for \u2014 they form a single term. Write '<!${current().value}'.`,
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
          `'<!${name}.${jeton.value}${current().value}': the address is FOLLOWED BY '${current().value}' with no separator. An address is A SINGLE token \u2014 an identifier ('<!${name}.next') or an integer ('<!${name}.60'). Separate with a space what must be a distinct term.`,
          current()
        );
      }
    } else if (colle) {
      throw new ParseError(
        `'<!${name}.' followed by '${peek(1).value ?? peek(1).type}': this is not an address. An address is an identifier ('<!${name}.next') or an integer ('<!${name}.60'), attached to the period on both sides. Without an address, write '<!${name}' alone \u2014 the wait then lifts on any event of that role, and that is a different form, not a shortcut.`,
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
      `'${signeOuvrant === "[" ? "[" : "("}${key}:\u2026${signeOuvrant === "[" ? "]" : ")"}': '${key}' is not written in a rule \u2014 the speed multiplier IS the operator, and it is placed in the flow: '! (/N)' slows down, '! (*N/M)' writes the same thing in inverse fraction. The scene's metronome, on the other hand, is written at the top: 'tempo:120'`,
      tok
    );
  }
  function checkQualifierKey(key, tok) {
    refuserTempx(key, tok, "[");
    if (key === "speed") {
      throw new ParseError(`'[speed:N]' has been removed \u2014 duration is written with ':': '{A B}:2' (group), 'A4:1/2' (note) or '}:N' (embedding)`, tok);
    }
    if (key === "shuffle") {
      throw new ParseError(`'[shuffle:N]' removed \u2014 the seed is written 'seed:N' (at the top of the scene) or '![seed:N]' (in the flow); '[shuffle]' shuffles alone`, tok);
    }
    if (libCtx.qualifierKeys.has(key)) {
      throw new ParseError(
        `'[${key}:\u2026]': '${key}' is a setting, it is written in PARENTHESES \u2014 '(${key}:\u2026)' . The bracket now carries only what governs the derivation itself: a flag test ('[flag]', '[flag==1]'), an assignment ('[flag=1]'), or the rank of a template form ('[3]')`,
        tok
      );
    }
    if (libCtx.runtimeBagControls.has(key)) {
      const valeurNumerique = (at(T.INT) || at(T.FLOAT)) && (peek(1).type === T.RBRACKET || peek(1).type === T.COMMA || peek(1).type === T.SLASH);
      if (key === "scale" && valeurNumerique) {
        throw new ParseError(
          `'[scale:N]' has been REMOVED \u2014 the temporal scaling of a group is written with the ATTACHED DURATION: '{A B}:N'. (Not to be confused with the microtonal scale, which is a runtime control: '(scale:name key)'.)`,
          tok
        );
      }
      throw new ParseError(
        `'[${key}:\u2026]': '${key}' is a RUNTIME control, it is written in PARENTHESES \u2014 '(${key}:\u2026)', or '!(${key}:\u2026)' to place it in the flow. Brackets are addressed to the ENGINE`,
        tok
      );
    }
    if (libCtx.controlNames.has(key)) {
      if (libCtx.ruleScopeControls.has(key)) return;
      if (!libCtx.ruleAllowedControls.has(key)) return;
      throw new ParseError(
        `'[${key}:\u2026]': the bracket carries only what governs DERIVATION \u2014 a flag test ('[flag]', '[flag==1]'), an assignment ('[flag=1]'), a derivation procedure ('[goto:\u2026]', '[repeat:\u2026]', '[failed:\u2026]', '[stop]') or the rank of a template form ('[3]'). '${key}' describes what the derivation PRODUCES: it is written in PARENTHESES .`,
        tok
      );
    }
    throw new ParseError(
      `unknown key '[${key}:\u2026]' \u2014 neither a library control, a guard, an assignment, nor a template rank; check the spelling, or the library that declares it. '[${key}:\u2026]' and '![${key}:\u2026]' (engine control) are NOT interchangeable with '(${key}:\u2026)' (runtime parameter)`,
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
        `'! (${operator}\u2026)' expects a number or a fraction \u2014 '! (/2)', '! (*3/2)', '! (/1.5)'`,
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
        `'[${signe}N]': the speed operator is written in PARENTHESES and placed in the FLOW \u2014 '! (${signe}N)'. It lives nowhere else: neither as a rule suffix, nor attached to an element. '/N' speeds up, '*N/M' writes the same thing in inverse fraction`,
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
          `'${key}: ' \u2014 no space after the colon: the value begins immediately ('${key}:${current().value}\u2026'). The space only separates the PARTS of a value`,
          current()
        );
      }
      void apresDeuxPoints;
      if (libCtx.controlNames.has(key)) {
        let rawValue = "";
        while (!at(T.RBRACKET) && !atEnd()) {
          if (at(T.COMMA)) {
            const suite2 = peek(1);
            const ouvreUnElement = suite2.type === T.IDENT && (peek(2).type === T.COLON || peek(2).type === T.RBRACKET || peek(2).type === T.COMMA);
            if (!ouvreUnElement) {
              throw new ParseError(
                `'[${key}: ${rawValue.trim()},\u2026]': the comma separates the ELEMENTS of the bag, not the parts of a value (positional list removed) \u2014 write '[${key}:${rawValue.trim()} \u2026]', the parts separated by a SPACE`,
                current()
              );
            }
            break;
          }
          const t = current();
          if (t.type === T.COLON) {
            throw new ParseError(
              `'[${key}: ${rawValue.trim()}:\u2026]': the colon ASSIGNS a value, it does not separate its parts \u2014 a pair carries only one. The parts of a value are separated by a SPACE ('[${key}:3 0]')`,
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
            `'[${key}:]' assigns no value \u2014 the colon expects one (for example '[${key}:3 0]'), and a control without an argument is written bare, without a colon`,
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
            `'[${key}:\u2026 ${current().value}:\u2026]': two ELEMENTS of the bag separated by a SPACE \u2014 they are missing a COMMA ('[${key}:\u2026, ${current().value}:\u2026]'). The space only separates the PARTS of a single value`,
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
