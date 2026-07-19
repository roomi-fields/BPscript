/**
 * BPScript Transpiler — Façade
 *
 * UNE SEULE voie : `compileToBPxAST(source)` → `{ ast, errors, warnings }`, l'arbre agnostique
 * consommé par BPx, Kairos, Kronos et Kanopi.
 *
 * ⚠️ `compileBPS` — la voie 2, qui encodait une grammaire BP3 en texte — A ÉTÉ SUPPRIMÉE le
 * 2026-07-19, sur arbitrage de Romain : « pour la compatibilité bps/gr, la seule chose que je
 * veux c'est que la PRODUCTION soit identique, pas la grammaire. » La conformité au moteur
 * natif se mesure donc sur les JETONS PRODUITS (comparaison à la baseline native), plus sur le
 * texte de grammaire émis.
 *
 * Ce qui a déclenché la suppression : la mesure ISO passait encore par cette façade héritée,
 * « vouée au retrait » depuis des mois. Du code que personne n'assumait plus continuait d'être
 * réutilisé et de gagner des fonctionnalités. Il n'y a pas de dépréciation douce ici, pas de
 * repli « au cas où » : ce qui est mort est retiré.
 */

import { compileToBPxAST } from './bpxAst.js';
import { describeVocabulary } from './libs.js';

// describeVocabulary : autorité du vocabulaire du langage pour l'éditeur Kanopi
// (coloration/autocomplétion/erreurs) — même agrégation que le garde de compilation.
export { compileToBPxAST, describeVocabulary };
