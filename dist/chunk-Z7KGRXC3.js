// src/transpiler/libs-champs.js
var CHAMPS_DE_FICHIER = /* @__PURE__ */ new Set([
  "resolvedBy",
  "resolves",
  "name",
  "description",
  "version",
  "type",
  "section",
  "documented"
]);
function entreesDe(objet) {
  return Object.keys(objet || {}).filter((k) => {
    if (CHAMPS_DE_FICHIER.has(k) || k.startsWith("_")) return false;
    const v = objet[k];
    return !!v && typeof v === "object" && !Array.isArray(v);
  });
}

export {
  CHAMPS_DE_FICHIER,
  entreesDe
};
