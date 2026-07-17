// Corps de la fonction digitale `chromashift` — AUTHORING F1 (vrai .ts TYPÉ contre le SDK Kairos).
// Source de vérité : ce fichier ; libs-bundle.js en capte le SOURCE dans lib/digital.json → libs-data.js.
// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis exécute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.
// ⚠️ TRANSPOSITION CHROMATIQUE (grille 12 clés) : image de BP3 _transpose (décision Romain
//    2026-07-17, hub/decisions/2026-07-17-bp3-transpose-est-scaleshift-sur-grille-12-cles.md).
//    Décale le pas ABSOLU de N clés chromatiques (N demi-tons) ; Kairos renomme vers la clé cible
//    et prend SON tuning (transposeToken). DISTINCT de `scaleshift` (diatonique, N degrés d'alphabet)
//    et de `transpose` (réel, frameRatio, nom PRÉSERVÉ). Trois gestes nets (Romain, option B).
import type { DigitalFn } from '@kairos/core';

/** chromashift — transposition sur la GRILLE 12 CLÉS chromatiques : décale le pas absolu de N
 *  positions (N demi-tons). `ctx.target.pitch.step` = pas ABSOLU sur la grille du tempérament
 *  (confirmé Kairos [504] : degré + altération + registre·divisions). Kairos re-projette le delta
 *  de step → renomme chromatiquement + retune sur la clé d'arrivée. = BP3 _transpose(N)
 *  (Zouleb.c:555-574, key += Round(trans/100)). PORTER≠RÉSOUDRE : je décale le pas, je ne résous rien. */
const chromashift: DigitalFn = (ctx) => {
  const p = ctx.target.pitch;
  if (!p) return;
  p.step += Number(ctx.params.n ?? 0);
};

export default chromashift;
