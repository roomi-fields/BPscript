import "./chunk-L2MRCLCI.js";
import {
  leRegistre,
  placesDesLibrairies
} from "./chunk-ERJ6VM3M.js";
import "./chunk-3Y64WDZ4.js";
import "./chunk-4TF53S6W.js";
import {
  CHAMPS_DU_PAQUET,
  entreesDe
} from "./chunk-JWEI77WV.js";
import "./chunk-YT6XIK2B.js";

// src/transpiler/objets.js
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
function index() {
  if (_index) return _index;
  const familles2 = /* @__PURE__ */ new Map();
  const objets2 = /* @__PURE__ */ new Map();
  const poser = (o) => {
    if (!objets2.has(o.nom)) objets2.set(o.nom, []);
    objets2.get(o.nom).push(o);
  };
  const LIBS = leRegistre();
  const PLACES = placesDesLibrairies(LIBS);
  for (const [cle, lib] of Object.entries(LIBS)) {
    if (!lib || typeof lib !== "object" || Array.isArray(lib)) continue;
    const mot = motDe(cle, lib);
    const places = new Set((PLACES[cle] || []).filter((p) => p !== "_deduites"));
    if (!familles2.has(mot)) familles2.set(mot, { nom: mot, membres: {}, entrees: [], contributeurs: [] });
    const fam = familles2.get(mot);
    fam.contributeurs.push(cle);
    for (const [k, v] of Object.entries(lib)) {
      if (k.startsWith("_") || CHAMPS_DU_PAQUET.has(k) || places.has(k)) continue;
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
        chaine: [mot, nom]
      };
      fam.entrees.push(o);
      poser(o);
    };
    for (const nom of entreesDe(lib)) {
      if (places.has(nom)) continue;
      entree(nom, lib[nom], null);
    }
    for (const place of places) {
      const contenu = lib[place];
      if (!contenu || typeof contenu !== "object" || Array.isArray(contenu)) continue;
      for (const nom of entreesDe(contenu)) entree(nom, contenu[nom], place);
    }
  }
  _index = { familles: familles2, objets: objets2 };
  return _index;
}
function familles() {
  return [...index().familles.keys()];
}
function famille(mot) {
  const f = index().familles.get(mot);
  if (!f) return null;
  return { nom: f.nom, membres: { ...f.membres }, entrees: f.entrees.map((o) => ({ ...o, membres: { ...o.membres }, chaine: [...o.chaine] })) };
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
  if (candidats.length === 1) return { ...candidats[0], membres: { ...candidats[0].membres }, chaine: [...candidats[0].chaine] };
  if (candidats.length === 0) return null;
  return { ambigu: candidats.map((o) => o.chaine.join(".")) };
}
function objets() {
  const out = [];
  for (const liste of index().objets.values()) for (const o of liste) out.push({ ...o, membres: { ...o.membres }, chaine: [...o.chaine] });
  return out;
}
export {
  famille,
  familles,
  objet,
  objets
};
