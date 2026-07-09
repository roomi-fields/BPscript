# `_goto` / `_failed` / `on_fail` — non branchés dans le transpileur

**Date**: 2026-05-21
**Contexte**: Audit du contrôle de flux sur échec de dérivation. Vérifié par
compilation (`compileBPS`) et lecture du moteur BP3 (`Compute.c`, `ProduceItems.c`,
`CompileProcs.c`).

## Résumé

Les primitives de saut de dérivation existent **côté moteur BP3** et sont
**déclarées dans la lib** (`@core`/controls), mais **aucune syntaxe BPScript ne les
compile correctement**. Ni l'abstraction lisible `on_fail`, ni le passe-plat brut
`goto()` / `failed()`.

## Sémantique moteur (vérifiée)

| Primitive | Déclenchement | Effet | Source |
|---|---|---|---|
| `_goto(g, r)` | **inconditionnel** | après la règle, saute vers sous-grammaire `g`, règle `r` | `Compute.c:785`, `ProduceItems.c:804` |
| `_failed(g, r)` | **sur échec** (LHS non applicable) | saute vers `g`, règle `r` | `Compute.c:330,772`, `ProduceItems.c:854` |

Les deux ciblent un couple **(sous-grammaire, règle) par index numérique**.
Important : `_goto` **n'est pas** un mécanisme d'échec — c'est un saut
inconditionnel. Il ne peut donc pas vivre sous `on_fail`.

Contrainte : `_goto` / `_failed` / `_repeat` sont marqués `NotBPCase[7]` dans
`CompileProcs.c:565` → une grammaire qui les utilise **perd la capacité "produce
all items"**. À documenter pour l'utilisateur.

## Bugs / manques constatés

### 1. Contrôles bruts `goto()` / `failed()` — sortie cassée

Déclarés dans la lib (`bp3:"_goto"` / `"_failed"`, args `subgrammar, rule`), mais
à la compilation :

```
S -> A failed(2,1)   →   gram#1[1] S --> A failed     ❌ pas de "_", args perdus
S -> A goto(2,1)     →   gram#1[1] S --> A goto        ❌ idem
```

Attendu : `_failed(2,1)` / `_goto(2,1)`. En l'état BP3 lirait `failed` / `goto`
comme des terminaux sonores minuscules. **Bug concret, le plus simple à corriger.**

### 2. Abstraction `on_fail` — non branchée

- `@on_fail:skip` (directive globale) : parsée, **inerte** (aucune émission encodeur).
- `[on_fail:retry(3)]` / `[on_fail:fallback(X)]` (forme locale, préfixe de règle) :
  **suppriment la règle silencieusement** — grammaire vide, aucune erreur. Même
  classe de bug que `[weight:N]` en préfixe de règle (cf. crochet non-garde en
  tête de règle avalé).

L'encodeur n'a **aucun** code traitant `on_fail` / `retry` / `fallback` /
`_goto` / `_failed` (grep vide).

## À faire (backlog, par ordre de faisabilité)

1. **Corriger `goto()` / `failed()` bruts** → émettre `_goto(g,r)` / `_failed(g,r)`
   valides (passer par le chemin natif `_bp3Native` avec arguments). Faisable
   immédiatement, indépendant de l'abstraction.
2. **Corriger le bug "crochet non-garde en préfixe de règle"** (touche aussi
   `[weight:N]`, `[on_fail:…]`) : soit lever une erreur claire, soit gérer la
   sémantique — ne plus avaler la règle en silence.
3. **`on_fail:fallback(X)` → `_failed`** : seul mapping fidèle et réalisable de
   l'abstraction. Résoudre le nom de sous-grammaire `X` → index `gram#`, émettre
   `_failed(g, 1)`. (Adressage d'une *règle* précise non couvert : BPScript ne
   nomme pas les règles → fallback vers une sous-grammaire, règle 1.)
4. **Séparer `_goto` de `on_fail`** : c'est un saut inconditionnel. S'il faut
   l'exposer, prévoir une primitive/directive distincte (`goto`/jump), pas `on_fail`.
5. **`on_fail:skip`** : trancher son sort. En BP3, échec = "essaie la candidate
   suivante" est déjà le défaut → `skip` est soit un no-op, soit à retirer.
6. **`on_fail:retry(N)`** : pas de primitive moteur (≠ `_repeat`), sens uniquement
   sous `@mode:random`. → reporter à BPx (voir `../BPx/backlog/boolean-guards.md`
   pour le pattern "fonctionnalité qui ne mappe pas sur BP3 → BPx").

## Doc à corriger une fois traité

`docs/spec/*` (EBNF/LANGUAGE) : l'encadré « État actuel » de `on_fail` doit dire
que les jetons sont parsés mais que **rien ne compile vers `_goto`/`_failed`**, que
`@on_fail:skip` est inerte et que la forme locale supprime la règle (bug).
