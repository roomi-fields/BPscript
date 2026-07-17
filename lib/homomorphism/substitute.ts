// Corps de la fonction d'HOMOMORPHISME `substitute` — AUTHORING F1 (vrai .ts TYPÉ contre le SDK Kairos).
// Source de vérité : ce fichier ; libs-bundle.js en capte le SOURCE dans lib/homomorphism.json → libs-data.js.
// Kairos transpile (sucrase, qui STRIPE l'`import type`) puis exécute au load, en BAC À SABLE déterministe.
// ⚠️ SUBSTITUTION DE SYMBOLE (homomorphisme BP3 `-ho`/`-al`) sortie de BPx → RÉSOLUTION Kairos, VIA
//    LIBRAIRIE (décision Romain/architecte 2026-07-17, hub/decisions/2026-07-17-bpx-ordonnanceur-opaque-
//    homomorphisme-en-resolution-kairos-librairie.md, RATIFIÉE). BPx devient ordonnanceur PUR : il PORTE
//    la portée opaque (`content.homoScope`) + les TABLES plates (`metadata.homomorphisms`), il NE SUBSTITUE
//    PLUS. Kairos applique la substitution AVANT la résolution de hauteur, puis résout nom→hz/octave.
import type { HomomorphismFn } from '@kairos/core';

/** substitute — applicateur GÉNÉRIQUE et UNIVERSEL d'homomorphisme (pure réécriture de symbole). Itère la
 *  portée active haut→bas ; pour chaque nom d'homo, remplace le symbole courant par son image dans la TABLE
 *  PLATE (paires last-write-wins) que Kairos adosse via `ctx.image(nom, sym)`. Symbole absent d'une table =
 *  IDENTITÉ (sémantique BP3 CompileGrammar.c:873, jamais un cri). Un même homo empilé `k` fois s'applique
 *  `k` fois (la multiplicité est portée par la portée) ; des homos différents s'appliquent en séquence.
 *  Modèle PROUVÉ sur l'oracle natif transposition1 ([373], BPx loadGrammar.ts:6370-6394) : table plate
 *  ITÉRÉE (C3 aux profondeurs 0/1/2/3 = C3/B4/F6/F6), PAS depth-indexé. PORTER≠RÉSOUDRE : je query, je ne
 *  déplie ni ne connais la table brute. */
const substitute: HomomorphismFn = (ctx) => {
  let s = ctx.symbol;
  for (const name of ctx.scope) s = ctx.image(name, s) ?? s;
  ctx.setResult(s);
};

export default substitute;
