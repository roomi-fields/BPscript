# dhadhatite_v2 — enquête sur les features « non supportées »

Transposition de `-gr.dhadhatite` en BPScript.

**Ce document a été RÉÉCRIT le 2026-07-18** après enquête forme par forme, chaque verdict
passé au **compilateur** (skill `bpscript-oracle` : vérifier à la source, jamais de mémoire).
La version précédente affirmait 5 gaps ; **3 étaient de faux problèmes** — la syntaxe existait
et n'avait pas été cherchée. Elle contenait aussi une **erreur de fait** : elle plaçait
l'annotation métrique en partie GAUCHE alors que le natif l'écrit **à droite de la flèche**
(`GRAM#1[1] <100> S <-> 4+4+4+4/4 S64`, `-gr.dhadhatite:18`).

| # | Feature | Verdict |
|---|---------|---------|
| F1 | Annotation métrique additive `4+4+4+4/4` | **gap d'IMPLÉMENTATION** (syntaxe déjà spécifiée) |
| F2 | Gabarits `(= …)` / `(: …)` | **FAUX PROBLÈME** |
| F3 | Marqueurs de profondeur de contexte `+` / `++` | **VRAI GAP** |
| F4 | Contexte négatif `#+` | **VRAI GAP, conditionné à F3** |
| F5 | Direction `<--` + « must be last » | **FAUX PROBLÈME (les deux volets)** |

---

## F1 — Annotation métrique additive → gap d'IMPLÉMENTATION, pas de design

Natif : `GRAM#1[1] <100> S <-> 4+4+4+4/4 S64` (en **RHS**, pas en LHS).

La syntaxe **est déjà spécifiée** : `docs/spec/EBNF.md:1297` documente
`[meter:4+4/6]` → `4+4/6` avant RHS, « time signature inline ». Elle étend `@meter:3/4`
(directive globale) en qualifieur de règle. **Syntaxe ratifiée par Romain (2026-07-18).**

Mais le parser la **refuse** aujourd'hui : `S <> [meter:4+4+4+4/4] S64` →
`Expected arrow (-> <- <>)`. Même famille que le cas `[flags] goto(...)` : un bracket
espacé en tête de RHS clôt la règle. C'est donc un écart **spec ↔ implémentation**,
à implémenter — pas une question de conception ouverte.

## F2 — Gabarits maître/esclave → FAUX PROBLÈME

Natif : `… (= V8 ) … (: V8 ) …`

BPScript l'écrit **`$X` (maître) / `&X` (esclave)**. Vérifié au compilateur :
`S <> $V8 &V8` émet `gram#1[1] S <-> (=V8) (:V8)` — exactement la forme native.
Aucune section `@template` n'est nécessaire pour ça.

## F3 — Profondeur de contexte `+` / `++` → VRAI GAP

Natif : `gram#5[1] + B2 <-> +teena`, `gram#5[8] ++ S2F <-- ++ …`

`+` et `++` marquent une **profondeur de contexte** propagée à travers l'arbre de
dérivation, qui départage ensuite les variantes d'un motif fixe. Vérifié :
`+ B2 <> +teena` → *ligne non reconnue au niveau des règles*. Aucune syntaxe
équivalente dans la spec — le `positive_context` de `EBNF.md:530` est un contexte
**parenthésé** `(X)`, mécanisme différent (voisinage, pas profondeur).

**Gap réel.** C'est le seul verrou de fond de cette grammaire.

## F4 — Contexte négatif `#+` → VRAI GAP, conditionné à F3

Natif : `gram#5[6] <100> #+ S1F <-> #+ dhadhatitedhadhadheena`

Contrairement à ce que disait la version précédente, **le contexte négatif existe bel et
bien** en BPScript (`EBNF.md:528-536`) et fonctionne — vérifié au compilateur :
`#- S1F <> dha` et `#(A B) S1F <> dha` compilent tous deux.

Ce qui manque est seulement `#+` : `context_sym` (`EBNF.md:533`) admet symbole, joker,
silence `-`, prolongation `_`, accolades et virgule — **pas** `+`. Et `+` n'aurait de sens
que si F3 existait. Donc : gap réel, mais **entièrement dérivé de F3**, pas indépendant.

## F5 — `<--` et « must be last » → FAUX PROBLÈME sur les deux volets

Natif : `gram#5[8] ++ S2F <-- ++ dhadhatitedhadhadheena [This rule must be last]`

**Volet direction** : la flèche BPScript `<-` **émet exactement `<--`**. Vérifié :
`S2F <- dha` → `gram#1[1] S2F <-- dha`. Il n'y a pas deux flèches à distinguer.
⚠️ Réserve sémantique à connaître : `<--` est l'opérateur 2 de BP3, **exclu de la
dérivation PROD** (`Compute.c:1280`) — fidèle au natif, mais sans effet en production.

**Volet ordre** : `[This rule must be last]` n'est **pas une directive moteur** mais une
**annotation libre** BP2, c'est-à-dire un commentaire (cf. `FREE_ANNOTATION_RE`,
`src/transpiler/bp3ToScene.js:143`, qui traite `[texte]` comme tel). L'ordre effectif des
règles est **positionnel**, en BP3 comme en BPScript : il suffit d'écrire la règle en
dernier. Rien à implémenter.

*(À ne pas confondre avec le qualifieur `[order]` de BPScript, qui est `_ordseq` et
restaure l'ordre canonique d'une séquence — `EBNF.md:689` — sans rapport avec l'ordre
des règles.)*

---

## Ce qui reste réellement à faire

1. **F1** — implémenter le qualifieur `[meter:…]` (syntaxe déjà spécifiée et ratifiée).
2. **F3** — concevoir la profondeur de contexte `+`/`++` ; **F4** en découle.

La section `TEMPLATES` de l'original dépendait, selon l'ancienne version de ce document,
de F2/F3/F4. Puisque **F2 est un faux problème**, elle ne dépend plus que de F3.
