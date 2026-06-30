// Corps de la fonction digitale `transpose` — AUTHORING F1 (vrai .ts TYPÉ contre le SDK Kairos).
// Source de vérité : ce fichier ; libs-bundle.js en capte le SOURCE dans lib/digital.json → libs-data.js.
// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis exécute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.
import type { DigitalFn } from '@kairos/core';

/** transpose — décalage de N pas sur la grille du tempérament (do4 +2 → ré4 en 12-TET). */
const transpose: DigitalFn = (ctx) => {
  // Mutation de la COPIE (ctx.target) ; Kairos dérive le Hz APRÈS (L16). `step` = axe de grille.
  if (ctx.target.pitch) ctx.target.pitch.step += Number(ctx.params.steps ?? 0);
};

export default transpose;
