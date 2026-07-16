// modulationValidation.js — Validation des NOMS d'entrées de modulation au branchement.
//
// POURQUOI. Au point de paramètre, brancher un CV sur une entrée de modulation s'écrit
// `(cutoff: env1)`. Le nom de l'entrée (`cutoff`, `amplitude`, …) appartient à la SORTIE
// (registre lib/modulation.json par type de sortie). Sans garde-fou, une faute (`cutof: env1`)
// ou un mauvais ciblage (`vel: env1` — vel n'est pas une entrée de modulation) passe en silence.
//
// DÉCLENCHEUR PAR LA VALEUR (et pas par le transport). Une paire `(KEY: VALUE)` n'est validée
// comme branchement de modulation QUE si VALUE est une SOURCE DE MODULATION (un CV déclaré, ou un
// non-terminal dont toutes les productions sont des CV). Ainsi :
//   (pan: 100)   → 100 littéral, pas une source → contrôle MIDI/musical normal (0..127), non touché.
//   (pan: env1)  → env1 est un CV → branchement de modulation → 'pan' validé comme entrée webaudio.
// Ce déclencheur résout la collision de noms (`pan` contrôle 0..127 vs entrée webaudio −1..1) SANS
// dépendre de la résolution du transport.
//
// PORTÉE PAR TYPE DE SORTIE. Quand le type de sortie de la voix est résoluble (via @routing), on
// valide contre les entrées de CE type ; sinon (ou un seul type connu) on valide contre l'union de
// toutes les entrées connues (attrape la faute, sans faux positif). L'AST n'est pas modifié.

/** Collecte récursive des paires de RuntimeQualifier (mêmes que controlValidation). */
function collectQualifierPairs(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const el of node) collectQualifierPairs(el, out); return; }
  if (node.type === 'RuntimeQualifier' && Array.isArray(node.pairs)) {
    for (const p of node.pairs) out.push(p);
  }
  for (const k in node) {
    if (k === 'pairs') continue;
    const v = node[k];
    if (v && typeof v === 'object') collectQualifierPairs(v, out);
  }
}

/** Nom de tête d'une LHS de règle. Saute les atomes NIÉS de tête (`#X` inline,
 * negated:true) : ce sont des contextes, pas la tête (préparé P3, flip Palier 4 —
 * inerte tant que le flip inline n'émet pas ces atomes dans le LHS). */
function ruleHeadName(lhs) {
  const els = Array.isArray(lhs) ? lhs : [lhs];
  const h = els.find((e) => e && e.negated !== true);
  return h && h.name ? h.name : null;
}

/**
 * Ensemble des SYMBOLES qui sont des sources de modulation : les CV déclarés, plus (résolution
 * à plusieurs niveaux) les non-terminaux dont CHAQUE production est un unique symbole déjà source.
 * Couvre l'indirection `Env -> env1 | env2`.
 */
function modulationSourceSymbols(ast) {
  const sources = new Set((ast.cvInstances || []).map((c) => c.name));

  // Productions à symbole unique : head → [nom unique | null] par règle.
  const singleProd = {};
  for (const sg of ast.subgrammars || []) {
    for (const rule of sg.rules || []) {
      const head = ruleHeadName(rule.lhs);
      if (!head) continue;
      const els = (rule.rhs || []).filter((e) => e && typeof e === 'object');
      const sole = els.length === 1 && (els[0].type === 'Symbol' || els[0].type === 'SymbolCall')
        ? els[0].name : null;
      (singleProd[head] = singleProd[head] || []).push(sole);
    }
  }
  // Point fixe : un non-terminal est source si toutes ses productions sont des sources.
  let changed = true, guard = 0;
  while (changed && guard++ < 8) {
    changed = false;
    for (const [name, prods] of Object.entries(singleProd)) {
      if (sources.has(name)) continue;
      if (prods.length > 0 && prods.every((p) => p && sources.has(p))) {
        sources.add(name); changed = true;
      }
    }
  }
  return sources;
}

/**
 * Type de sortie de la scène (best-effort) : le binding `@alphabet.X:<sortie>` ou le
 * `transport.<sortie>` d'un acteur EST le canal canonique (audio/midi/osc) — depuis la suppression
 * de routing.json (2026-07-16), le nom de transport EST le type, plus d'indirection par profil.
 * Retourne null si non résoluble (→ l'appelant retombe sur l'union des entrées de modulation).
 */
function resolveOutputType(ast) {
  let transportName = null;
  for (const d of ast.directives || []) {
    if (d.name === 'alphabet' && d.runtime) { transportName = d.runtime; break; }
    if (d.name === 'actor' && d.properties && d.properties.transport) {
      transportName = d.properties.transport.key || transportName;
    }
  }
  return transportName;
}

/**
 * Valide les noms d'entrées de modulation au branchement.
 * @returns {Array<{message, line?, col?}>}
 */
export function validateModulation(ast, libCtx) {
  if (!libCtx || !libCtx.modulationInputsAll || libCtx.modulationInputsAll.size === 0) return [];
  const sources = modulationSourceSymbols(ast);
  if (sources.size === 0) return [];

  // Ensemble valide : type résolu si dispo, sinon union.
  const type = resolveOutputType(ast);
  const validSet = (type && libCtx.modulationInputs[type]) || libCtx.modulationInputsAll;
  const known = [...validSet].join(', ');

  const pairs = [];
  collectQualifierPairs(ast, pairs);
  const errors = [];
  for (const p of pairs) {
    if (p.value === true) continue;            // clé nue
    if (!sources.has(String(p.value))) continue; // valeur pas une source de modulation
    if (!validSet.has(p.key)) {
      errors.push({
        message: `'${p.key}' n'est pas une entrée de modulation`
               + (type ? ` de la sortie ${type}` : '')
               + ` (connues : ${known})`,
        line: p.line, col: p.col,
      });
    }
  }
  return errors;
}

export default validateModulation;
