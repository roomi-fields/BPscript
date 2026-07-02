// Corps de la fonction digitale `keyxpand` — AUTHORING F1 (vrai .ts TYPÉ contre le SDK Kairos).
// Source de vérité : ce fichier ; libs-bundle.js en capte le SOURCE dans lib/digital.json → libs-data.js.
// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis exécute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.
import type { DigitalFn } from '@kairos/core';

/** keyxpand — dilate/contracte l'écart au pivot d'un facteur (le pivot reste fixe). facteur 1 = identité,
 *  2 = intervalles doublés, 0,5 = repliés de moitié. Résultat arrondi au pas de grille le plus proche.
 *  Kairos pré-résout le token pivot en `pivotStep` et passe `{pivotStep, factor}`. */
const keyxpand: DigitalFn = (ctx) => {
  // Mutation de la COPIE (ctx.target) ; Kairos dérive le Hz APRÈS (delta net). `step` = axe de grille absolu.
  if (ctx.target.pitch) {
    const pivotStep = Number(ctx.params.pivotStep ?? 0);
    const factor = Number(ctx.params.factor ?? 1);
    ctx.target.pitch.step = pivotStep + Math.round((ctx.target.pitch.step - pivotStep) * factor);
  }
};

export default keyxpand;
