// controlValidation.js — Validation sémantique des VALEURS de contrôle runtime.
//
// POURQUOI. Les librairies runtime (`lib/expression.json`, `lib/midi.json`, `lib/audio.json`,
// `lib/transpo.json` — ex-`controls.json`, scindé et supprimé le 2026-08-10, mise en conformité
// des librairies) sont la SOURCE UNIQUE des valeurs permises pour chaque contrôle runtime :
// liste fermée (`values`, ex. wave) ou plage (`range`, ex. filterQ 0..30, attack 1..5000). Sans
// garde-fou, `(wave:triangle123)` ou `(filterQ:99)` compilent en silence. Ce module relit l'AST
// et émet une ERREUR (message + line/col) pour toute valeur hors-liste / hors-plage. Demande
// Kanopi [113].
//
// PORTÉE. On ne valide QUE les contrôles présents dans la lib chargée. Un nom inconnu
// (alias @cc, contrôle custom) est laissé passer — pas de faux positif. Les clés nues
// (velcont…) et les valeurs non numériques face à une plage sont ignorées.
//
// L'AST n'est PAS modifié (contrat BPx) : on lit, on retourne une liste d'erreurs.

/**
 * Collecte récursivement toutes les paires de SettingBag de l'AST.
 * Chaque paire porte { key, value, line, col } (posé par le parser).
 */
function collectQualifierPairs(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const el of node) collectQualifierPairs(el, out); return; }
  if (node.type === 'SettingBag' && Array.isArray(node.pairs)) {
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
/**
 * ⛔ LA TÊTE DE SCÈNE EST UNE PLACE D'ÉCRITURE COMME UNE AUTRE — Romain, 2026-08-15, « à corriger ».
 *
 * CE QUI PASSAIT : `@vel:200`, `@midi.ins:129` et `@midi.rate:1001` COMPILAIENT, alors que
 * `!(vel:200)` était refusé en nommant la plage. La collecte ci-dessus ne ramasse que les paires
 * d'un SAC (`SettingBag`) ; une directive de tête n'est pas un sac, c'est un nœud `Directive`. La
 * validation ne voyait donc jamais la moitié des écritures.
 *
 * CE QUI L'A RENDU BLOQUANT : `rate` et `fadeout`, entrés le même jour, ne s'écrivent QU'en tête de
 * scène. Leurs bornes — mesurées sur les sources du moteur, que le natif fait respecter en
 * ARRÊTANT la compilation — ne mordaient nulle part. Des plages déclarées qui ne validaient rien.
 *
 * LA FORME EST NORMALISÉE AVANT D'ARRIVER ICI : `@midi.rate:50` rend `{name:'rate', value:50}`,
 * préfixe résolu. On lit donc le même couple clé/valeur que dans un sac, et le juge est le même —
 * un seul endroit décide ce qu'une valeur a le droit d'être.
 *
 * UNE DIRECTIVE QUI N'EST PAS UN CONTRÔLE PASSE SANS BRUIT : la validation ne connaît que les mots
 * de la librairie chargée (`if (!def) continue`), et `@alphabet.western` ou `@core` n'en sont pas.
 */
function collectDirectiveValues(ast, out) {
  for (const d of (ast && ast.directives) || []) {
    if (!d || d.type !== 'Directive' || typeof d.name !== 'string') continue;
    if (d.value === null || d.value === undefined) continue;   // mot nu : rien à valider
    out.push({ key: d.name, value: d.value, line: d.line });
  }
}

export function validateControls(ast, controls, qualifies = {}) {
  if (!controls) return [];
  const pairs = [];
  collectQualifierPairs(ast, pairs);
  collectDirectiveValues(ast, pairs);
  const errors = [];

  for (const p of pairs) {
    // ⚠️ UNE PAIRE PRÉFIXÉE SE VALIDE SUR LA DÉCLARATION QU'ELLE DÉSIGNE, pas sur la table par nom
    // nu — sinon deux librairies qui portent le même contrôle partagent la plage de la DERNIÈRE
    // chargée, et `expression.pan:20` sortait « hors plage (-1..1) » en étant jugé par `audio`.
    // Le nom nu ne peut pas trancher ici : c'est précisément ce que le préfixe existe pour dire.
    const def = (p.lib && qualifies[`${p.lib}.${p.key}`]) || controls[p.key];
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
