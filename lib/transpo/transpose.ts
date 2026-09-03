// Corps de la MANIPULATION `transpose` — AUTHORING F1 (vrai .ts TYPÉ contre le SDK Kairos).
// Source de vérité : ce fichier. Le chargeur le greffe sur le CONTRÔLE `transpose` de `transpo`, qui
// porte le mot — arbitrage de Romain, 2026-09-03 : le corps se rattache à l'objet qui le nomme.
// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis exécute au load. Spec : docs/design/DIGITAL_FUNCTIONS.md.
// ⚠️ TRANSPOSITION RÉELLE (chromatique) : décalage de l'ANCRE par un INTERVALLE fixe. Préserve les
//    intervalles ET le nom de chaque note (on déplace le cadre, pas les notes contre un cadre figé).
//    Marche dans TOUT accordage (égal ET inégal), et même en tempérament paramétrique (sans grille).
//    Décision 2026-07-11 : deux transpositions nommées, réelle (ici) vs scalaire (scaleshift).
import type { DigitalFn } from '@kairos/core';

/** transpose — transposition réelle : multiplie le facteur de cadre `frameRatio` par l'intervalle.
 *  `ctx.params.ratio` = intervalle DÉJÀ NORMALISÉ par Kairos (fraction 3/2 | cents 700c | décimal 1.5) ;
 *  `ctx.params.interval` = la chaîne brute (diagnostic). Kairos SEUL applique `hz × frameRatio` en fin de
 *  résolution, APRÈS les ops de grille — noms/registres préservés par construction. Je ne parse RIEN. */
const transpose: DigitalFn = (ctx) => {
  if (ctx.target.pitch) {
    ctx.target.pitch.frameRatio = (ctx.target.pitch.frameRatio ?? 1) * Number(ctx.params.ratio);
  }
};

export default transpose;
