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
  return Object.keys(objet || {}).filter((k) => !CHAMPS_DE_FICHIER.has(k) && !k.startsWith("_"));
}
export {
  CHAMPS_DE_FICHIER,
  entreesDe
};
