// controlValidation.js — Validation sémantique des VALEURS de contrôle runtime.
//
// POURQUOI. La librairie @controls (controls.json) est la SOURCE UNIQUE des valeurs
// permises pour chaque contrôle runtime : liste fermée (`values`, ex. wave) ou plage
// (`range`, ex. filterQ 0..30, attack 1..5000). Sans garde-fou, `(wave:triangle123)` ou
// `(filterQ:99)` compilent en silence. Ce module relit l'AST et émet une ERREUR
// (message + line/col) pour toute valeur hors-liste / hors-plage. Demande Kanopi [113].
//
// PORTÉE. On ne valide QUE les contrôles présents dans la lib chargée. Un nom inconnu
// (alias @cc, contrôle custom) est laissé passer — pas de faux positif. Les clés nues
// (velcont…) et les valeurs non numériques face à une plage sont ignorées.
//
// L'AST n'est PAS modifié (contrat BPx) : on lit, on retourne une liste d'erreurs.

/**
 * Collecte récursivement toutes les paires de RuntimeQualifier de l'AST.
 * Chaque paire porte { key, value, line, col } (posé par le parser).
 */
function collectQualifierPairs(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const el of node) collectQualifierPairs(el, out); return; }
  if (node.type === 'RuntimeQualifier' && Array.isArray(node.pairs)) {
    for (const p of node.pairs) out.push(p);
  }
  for (const k in node) {
    if (k === 'pairs') continue; // déjà traité ci-dessus
    const v = node[k];
    if (v && typeof v === 'object') collectQualifierPairs(v, out);
  }
}

/**
 * Valide les valeurs de contrôle d'un AST contre les métadonnées de la lib.
 * @param {object} ast      AST produit par le parser.
 * @param {object} controls map name → def (libCtx.controls), porte values / range.
 * @returns {Array<{message:string, line?:number, col?:number}>}
 */
export function validateControls(ast, controls) {
  if (!controls) return [];
  const pairs = [];
  collectQualifierPairs(ast, pairs);
  const errors = [];

  for (const p of pairs) {
    const def = controls[p.key];
    if (!def) continue;                 // contrôle hors-lib → pas notre autorité
    if (p.value === true) continue;     // clé nue (velcont, pitchcont…)
    const where = { line: p.line, col: p.col };

    // Liste fermée (enum)
    if (Array.isArray(def.values)) {
      const v = String(p.value);
      if (!def.values.includes(v)) {
        errors.push({
          message: `valeur '${p.value}' interdite pour le contrôle '${p.key}' `
                 + `(autorisées : ${def.values.join(', ')})`,
          ...where,
        });
      }
      continue;
    }

    // Plage numérique
    if (Array.isArray(def.range) && typeof p.value === 'number') {
      const [min, max] = def.range;
      if (p.value < min || p.value > max) {
        errors.push({
          message: `valeur ${p.value} hors plage pour le contrôle '${p.key}' `
                 + `(${min}..${max})`,
          ...where,
        });
      }
    }
  }
  return errors;
}

export default validateControls;
