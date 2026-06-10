# Mécanismes avancés (contexte, wildcard, homomorphisme) — ne produisent pas / compilent faux

**Date**: 2026-05-21
**Contexte**: Repro des mécanismes de l'article S8 (wildcards, variables,
homomorphismes, contextes). Vérifié par dérivation réelle
(transpileur → WASM `bp3-engine/builds/v3.4.4-wasm.1`, text mode, seed=1).
Repro : `_test_s8_repro/` (gitignoré).
Fonctionnent : sanity (`S -> A B C ...`), variable (`|x|`).

## 0. Transverse — `rc=-4` sur sortie à un seul terminal

Toute dérivation aboutissant à **un unique terminal** échoue (rc=-4, sortie vide).
Dès 2 items, OK. Garde moteur `(*p_length) < 3L` dans `Compute.c`.

| Grammaire | Sortie | rc |
|---|---|---|
| `S -> Sa` | — | **-4** |
| `S -> Sa Re` | `Sa Re` | 1 |
| `S -> A` / `A -> Sa` | — | **-4** |
| `S -> A` / `A -> Sa Re` | `Sa Re` | 1 |
| `S -> A A` / `A -> Sa` | `Sa Sa` | 1 |

Indépendant des cas ci-dessous (qui produisent 2+ items), mais piège réel pour
scènes minimales. À documenter (et éventuellement signaler à Bernard : un item
unique devrait produire, pas aborter).

## 1. Contexte positif `(Pa) Dha -> Dha Ma` — BUG TRANSPILEUR confirmé

`encodeContext` (`src/transpiler/encoder.js`) **perd les parenthèses** pour un
contexte positif à symbole unique :

```js
if (ctx.symbols.length === 1) {
  ...
  return `${prefix}${sym}`;   // (Pa) → "Pa" : marqueur de contexte perdu
}
```

Compile en `gram#2[1] Pa Dha --> Dha Ma` (LHS context-free 2 symboles) →
**Pa consommé** → `Dha Ma Ni` au lieu de `Pa Dha Ma Ni`.

État moteur :
- Contexte **négatif** `#(...)` prouvé fonctionnel (koto3 l'utilise partout).
- Contexte **positif** adjacent : tests à la main de `(Pa) Dha` (gauche) et
  `Dha (Ni)` (droit) → tous deux rc=-4, **pas** le résultat attendu. BP3 parse
  `(...)` comme « remote context » (`Encode.c:735`), pas forcément contexte
  adjacent. **La notation BP3 cible n'est PAS confirmée.**

**À faire** : (a) confirmer la notation BP3 du contexte positif adjacent (test
propre négatif-vs-positif, ou Bernard) ; (b) seulement ensuite, corriger
`encodeContext` pour préserver le marqueur.

## 2. Wildcard `deb ?1 fin -> ?1 ?1` — repro réel, précondition non isolée

`?N` matche **exactement un item** (vérifié bells/koto3/vina). Mais ce n'est pas
la cause : toutes les variantes minimales testées échouent (rc=0) —
ord, sub, 1 vs 3 symboles, couverture complète des symboles, pattern koto3
`?1 ?1 -> ?1` sur seed `a a`. Le wildcard **ne s'arme pas** en grammaire isolée.

Dans koto3 il marche au sein d'une dérivation SUB complète (gram#2 SUB atteint
après un gram#1 RND qui sème, `@improvize`, K-params, poids, clôture de règles).
**Précondition exacte non isolée.**

**À faire** : dérivation tracée (`trace_produce`) sur un wildcard minimal, ou
question Bernard : quel mode/contexte arme la réécriture par `?N` ?

## 3. Homomorphisme `(=motif) … (:motif)` — notation OK, mécanisme non câblé

Forme compilée `gram#1[1] S --> (=motif) tin (:motif)` **identique** à dhin
(`dhin/silent.gr` : `(=F48) … (:F48)`, qui produit). Mais :
- dhin a une structure différente (gram#2, poids, `<->`, meter, polymétrie) ;
- `dhin/scene.bps` avoue : *« homomorphisme pas encore implémenté, traduit comme
  &X (replay sans substitution) »*.

Le maître/esclave `(=)/(:)`  n'est donc pas câblé pour un cas ord simple — même
côté dhin c'est une approximation par rejeu. **Précondition non isolée**, même
statut que le wildcard.

## Bilan

| Cas | Verdict | Action |
|---|---|---|
| Contexte | Bug transpileur **certain** | confirmer notation BP3 → puis fixer `encodeContext` |
| Wildcard | Repro réel, précondition **non isolée** | trace moteur / Bernard |
| Homomorphisme | Notation correcte, mécanisme **non câblé** | Bernard / spec |
| rc=-4 | Garde moteur mono-terminal | documenter (+ signaler ?) |
