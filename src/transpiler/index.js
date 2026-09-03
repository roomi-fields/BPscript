/**
 * BPScript Transpiler — Façade
 *
 * UNE SEULE voie : `compileToBPxAST(source)` → `{ ast, errors, warnings }`, l'arbre agnostique
 * consommé par BPx, Kairos, Kronos et Kanopi.
 *
 * ⛔ L'ARBRE N'A DE SENS QU'À ERREURS NULLES — décision Romain du 2026-08-19,
 * `hub/decisions/2026-08-19-l-arbre-ne-se-lit-qu-apres-un-succes-du-compilateur.md`. Un compilateur
 * qui refuse ne livre rien en aval : ce qui établit le succès est L'ABSENCE D'ERREUR, jamais la
 * présence d'un arbre.
 *
 * ⚠️ CE QUI L'A MOTIVÉE, mesuré ici même le 2026-08-19 : un refus de SYNTAXE rend `ast` nul, un
 * refus de SENS et un refus de MOT INCONNU rendent un arbre COMPLET de dix-huit clés. Un
 * consommateur qui décide sur la présence de l'arbre conclut donc « pas de refus » sur DEUX refus
 * sur trois, et travaille sur un arbre mutilé — en croyant travailler sur une scène valide.
 *
 * LA PORTE D'ENTRÉE D'UN CONSOMMATEUR TESTE `errors`. Un chemin qui lit `ast` sans les avoir
 * regardées est un défaut, chez lui comme ici.
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
import { describeVocabulary } from './vocabulaire.js';

// describeVocabulary : autorité du vocabulaire du langage pour l'éditeur Kanopi
// (coloration/autocomplétion/erreurs) — même agrégation que le garde de compilation.
export { compileToBPxAST, describeVocabulary };
