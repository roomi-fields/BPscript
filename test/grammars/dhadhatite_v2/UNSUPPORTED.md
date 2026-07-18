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
| F1 | Annotation métrique additive `4+4+4+4/4` | **FAUX PROBLÈME** — la forme existe et émet le natif |
| F2 | Gabarits `(= …)` / `(: …)` | **FAUX PROBLÈME** |
| F3 | Marqueurs de profondeur de contexte `+` / `++` | **VRAI GAP** |
| F4 | Contexte négatif `#+` | **VRAI GAP, conditionné à F3** |
| F5 | Direction `<--` + « must be last » | **FAUX PROBLÈME (les deux volets)** |

---

## F1 — Annotation métrique additive → FAUX PROBLÈME (corrigé le 2026-07-19)

Natif : `GRAM#1[1] <100> S <-> 4+4+4+4/4 S64`.

**Cette section affirmait un « gap d'implémentation ». C'était FAUX.** La forme existe, elle
fonctionne, et elle émet exactement le natif :

```bpscript
S <> S64 [weight:100, meter:4+4+4+4/4]   →   gram#1[1] <100> S <-> 4+4+4+4/4 S64
```

**L'erreur était de POSITION, pas de syntaxe.** J'écrivais le qualifieur en TÊTE de la partie
droite (`S <> [meter:…] S64`), où un bracket espacé clôt effectivement la règle. Il se place en
FIN de règle, comme `[weight:…]` — et il se combine avec lui.

*Leçon : j'ai signalé ce gap deux fois (dans ce document, puis à l'architecte) sans avoir essayé
la position canonique des autres qualifieurs de règle. Vérifier une forme, c'est essayer ses
positions, pas seulement son orthographe.*

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

1. ~~F1~~ — **rien à faire** : la forme existe (`[meter:…]` en fin de règle). Faux problème.
2. **F3** — concevoir la profondeur de contexte `+`/`++` ; **F4** en découle.

La section `TEMPLATES` de l'original dépendait, selon l'ancienne version de ce document,
de F2/F3/F4. Puisque **F2 est un faux problème**, elle ne dépend plus que de F3.
