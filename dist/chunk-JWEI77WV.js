// src/transpiler/libs-champs.js
var CHAMPS_DU_PAQUET = /* @__PURE__ */ new Set(["resolves", "name", "section", "type", "version"]);
var MEMBRES_DE_RACINE = /* @__PURE__ */ new Set(["resolvedBy", "description", "documented"]);
var CHAMPS_DE_FICHIER = /* @__PURE__ */ new Set([...CHAMPS_DU_PAQUET, ...MEMBRES_DE_RACINE]);
function entreesDe(objet) {
  return Object.keys(objet || {}).filter((k) => {
    if (CHAMPS_DE_FICHIER.has(k) || k.startsWith("_")) return false;
    const v = objet[k];
    return !!v && typeof v === "object" && !Array.isArray(v);
  });
}

export {
  CHAMPS_DU_PAQUET,
  MEMBRES_DE_RACINE,
  CHAMPS_DE_FICHIER,
  entreesDe
};
