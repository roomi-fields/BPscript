// Corps de la fonction digitale `scaleshift` — AUTHORING F1 (vrai .ts TYPÉ contre le SDK Kairos).
// Source de vérité : ce fichier ; libs-bundle.js en capte le SOURCE dans lib/digital.json → libs-data.js.
// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis exécute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.
// ⚠️ TRANSPOSITION SCALAIRE (diatonique) : décalage de N DEGRÉS d'alphabet (Sa +2 → Ga), report de
//    registre aux bornes. Anciennement `rotate` de HAUTEUR — renommé (décision 2026-07-11 : deux
//    transpositions nommées, réelle vs scalaire). RIEN À VOIR avec le ![rotate] de STRUCTURE
//    (RotateSequence, rotation de séquence, moteur BPx), qui garde son nom.
import type { DigitalFn } from '@kairos/core';

/** scaleshift — transposition scalaire : décale de N degrés dans l'alphabet (Sa +2 → Ga). Recouvre le
 *  degré depuis le pas via `models.alphabet.degrees`, tourne l'index (mod taille alphabet, avec report
 *  de registre), recompose. Préserve les DEGRÉS, pas les intervalles (en gamme inégale). */
const scaleshift: DigitalFn = (ctx) => {
  const p = ctx.target.pitch;
  if (!p) return;
  const degs = ctx.models.alphabet.degrees;   // pas de grille de chaque degré, ordonné (ex. 12-TET [0,2,4,5,7,9,11])
  const div = ctx.models.temperament.divisions;
  const n = Number(ctx.params.n ?? 0);
  const reg = Math.floor(p.step / div);
  const inOct = ((p.step % div) + div) % div;
  const idx = degs.indexOf(inOct);
  if (idx < 0) return;                          // pas hors alphabet : identité (best-effort)
  const len = degs.length, raw = idx + n;
  const ni = ((raw % len) + len) % len;
  p.step = degs[ni] + (reg + Math.floor(raw / len)) * div;
};

export default scaleshift;
