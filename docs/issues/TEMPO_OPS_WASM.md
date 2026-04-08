# Tempo Operators: WASM vs Natif — Bugs identifiés

**Date**: 2026-04-08
**Contexte**: Investigation des opérateurs `/N`, `\N` et `_tempo()` en BP3 pour unifier la syntaxe BPscript.
**Méthode**: Tests MIDI comparés natif (bp3 v3.3.19 linux) vs WASM (dist/bp3.js).

## Résumé

Trois mécanismes de tempo existent en BP3 : `/N` (divise durée), `\N` (multiplie durée), `_tempo(x/y)` (ratio explicite). En natif, `/N`, `\N` et `_tempo()` fonctionnent correctement. En WASM, `\N` et `_tempo()` sont complètement cassés. Quelques bugs existent aussi en natif (décimaux, reset `\1`).

## Équivalences confirmées (natif)

```
/2 C4 D4 E4 F4          → 0, 500, 1000, 1500    (2x plus rapide)
_tempo(2/1) C4 D4 E4 F4 → 0, 500, 1000, 1500    IDENTIQUE à /2

\2 C4 D4 E4 F4          → 0, 2000, 4000, 6000   (2x plus lent)
_tempo(1/2) C4 D4 E4 F4 → 0, 2000, 4000, 6000   IDENTIQUE à \2
```

Donc : `/N` ≡ `_tempo(N/1)` et `\N` ≡ `_tempo(1/N)`.

---

## 1. Bugs WASM

### Bug WASM #1 — `\N` est un no-op

`\N` est complètement ignoré en WASM, dans tous les contextes.

| Grammaire | Natif | WASM |
|---|---|---|
| `\2 C4 D4 E4 F4` | 0, 2000, 4000, 6000 | 0, 1000, 2000, 3000 (**ignoré**) |
| `C4 D4 \2 E4 F4` | 0, 1500, 3000, 4500 | 0, 1000, 2000, 3000 (**ignoré**) |
| `C4 \2 D4 E4 \1 F4` | 0, 1500, 3000, 4500 | 0, 1000, 2000, 3000 (**ignoré**) |

### Bug WASM #2 — `\N` devant/entre `{}` crashe

| Grammaire | Natif | WASM |
|---|---|---|
| `\2 {C4 D4,E4 F4} {G4 A4,C4 D4}` | 0,2000,4000,6000 | **CRASH** (FillPhaseDiagram) |
| `{C4 D4,E4 F4} \2 {G4 A4,C4 D4}` | grp2 ralenti | **CRASH** |

### Bug WASM #3 — `/N` devant `{}` crashe

| Grammaire | Natif | WASM |
|---|---|---|
| `/2 {C4 D4,E4 F4} {G4 A4,C4 D4}` | 0,500,1000,1500 | **CRASH** (FillPhaseDiagram) |
| `{C4 D4,E4 F4} /2 {G4 A4,C4 D4}` | grp2 accéléré | OK |

Note : `/N` entre deux `{}` marche en WASM, mais `/N` en tête crashe.

### Bug WASM #4 — `_tempo()` crashe systématiquement

Tous les usages de `_tempo()` crashent en WASM (memory access out of bounds) :

| Grammaire | Natif | WASM |
|---|---|---|
| `_tempo(2/1) C4 D4 E4 F4` | 0, 500, 1000, 1500 | **CRASH** |
| `C4 D4 _tempo(2/1) E4 F4` | 0, 1000, 2000, 2500 | **CRASH** |
| `C4 _tempo(2/1) D4 E4 _tempo(1/2) F4` | 0, 1000, 1500, 2000 | **CRASH** |
| `_tempo(2/1) {C4 D4,E4 F4} _tempo(1/2) {G4 A4,C4 D4}` | bracket OK | TimeSet=-4 (no tokens) |
| `{_tempo(2/1) C4 D4, E4 F4}` | inside poly OK | **CRASH** |

### Bug WASM #5 — Décimaux incohérents

| Grammaire | Natif | WASM |
|---|---|---|
| `/0.5 C4 D4 E4 F4` | **ABORT** (bug natif aussi) | PolyMake=-4 |
| `\0.5 C4 D4 E4 F4` | résultats suspects | résultats incohérents |
| `/1.5 C4 D4 E4 F4` | résultats suspects | résultats incohérents |

### Ce qui fonctionne en WASM

- `/N` en séquence simple avec N entier — OK
- `/N` entre `{}` (pas en tête) — OK
- `/1` pour reset — OK
- Ratio `{N, voix1, voix2}` avec N entier ou 0.5 — OK

---

## 2. Bugs natif (BP3 v3.3.19)

### Bug natif #1 — `\1` ne reset pas

| Grammaire | Attendu | Obtenu |
|---|---|---|
| `C4 \2 D4 E4 \1 F4` | C4=0, D4=2000, E4=4000, **F4=5000** (reset) | F4=**4500** (pas de reset) |
| `C4 /2 D4 E4 /1 F4` | C4=0, D4=1000, E4=1500, F4=2000→3000 | **OK** (reset fonctionne) |

`\1` ne remet pas le tempo à 1 alors que `/1` le fait. Asymétrie `\` vs `/`.

### Bug natif #2 — `/0.5` ABORT

```
gram#1[1] S --> C4 /0.5 D4 E4 F4
=> Err. PolyExpand(). isequal == ABORT
```

`/N` avec N < 1 crashe. Pourtant `_tempo(0.5)` fonctionne (donne 0, 1000, 3000, 5000).

### Bug natif #3 — Décimaux `/\` suspects

`\0.5`, `/1.5` et `\1.5` donnent tous exactement le même résultat (0, 1625, 1750, 1875), ce qui est mathématiquement impossible si les opérateurs ont des sémantiques différentes.

En revanche `_tempo()` avec décimaux fonctionne correctement :
- `_tempo(0.5)` → 0, 2000, 4000, 6000 (2x plus lent, correct)
- `_tempo(1.5)` → 0, 666, 1333, 2000 (1.5x plus rapide, correct)

---

## 3. `_tempo()` en natif — Résultats complets

### Séquences

| Grammaire | Résultat | Commentaire |
|---|---|---|
| `_tempo(2/1) C4 D4 E4 F4` | 0, 500, 1000, 1500 | 2x rapide, ≡ `/2` |
| `_tempo(1/2) C4 D4 E4 F4` | 0, 2000, 4000, 6000 | 2x lent, ≡ `\2` |
| `C4 D4 _tempo(2/1) E4 F4` | 0, 1000, 2000, 2500 | accélère à partir de E4 |
| `C4 D4 _tempo(1/2) E4 F4` | 0, 1000, 2000, 4000 | ralentit à partir de E4 |
| `C4 _tempo(2/1) D4 E4 _tempo(1/2) F4` | 0, 1000, 1500, 2000 | **bracket fonctionne** |
| `C4 _tempo(1/2) D4 E4 _tempo(2/1) F4` | 0, 1000, 3000, 5000 | bracket inverse OK |
| `C4 _tempo(3/2) D4 _tempo(2/3) E4 F4` | 0, 1000, 1666, 3166 | ratios fractionnaires OK |
| `C4 _tempo(2/1) D4 _tempo(1) E4 F4` | 0, 1000, 1500, 2500 | `_tempo(1)` = **reset partiel** (E4=1000 attendu) |

### Polymétrie

| Grammaire | Résultat | Commentaire |
|---|---|---|
| `_tempo(2/1) {C4 D4,E4 F4} {G4 A4,C4 D4}` | tout 2x rapide | portée globale |
| `{} _tempo(2/1) {G4 A4,C4 D4}` | grp2 accéléré | portée locale OK |
| `_tempo(2/1) {} _tempo(1/2) {}` | grp1 rapide, grp2 lent | **bracket sur `{}` fonctionne** |
| `_tempo(1/2) {} _tempo(2/1) {}` | grp1 lent, grp2 rapide | bracket inverse OK |
| `{_tempo(2/1) C4 D4, E4 F4} {}` | voix1 accélérée dans le poly | **inside poly fonctionne** |
| `{C4 _tempo(2/1) D4, E4 F4} {}` | mid-voice accélération | fonctionne |

### Décimaux via `_tempo()`

| Grammaire | Résultat | Commentaire |
|---|---|---|
| `_tempo(0.5) C4 D4 E4 F4` | 0, 2000, 4000, 6000 | **OK** (2x lent) |
| `_tempo(1.5) C4 D4 E4 F4` | 0, 666, 1333, 2000 | **OK** (1.5x rapide) |
| `C4 _tempo(0.5) D4 E4 F4` | 0, 1000, 3000, 5000 | **OK** mid-stream |
| `C4 _tempo(1.5) D4 E4 F4` | 0, 1000, 1666, 2333 | **OK** mid-stream |

**`_tempo()` est le seul mécanisme qui gère correctement les décimaux en natif.**

---

## 4. Synthèse pour le portage WASM

### Priorité haute
1. **`\N` ignoré** — le backslash tempo operator n'a aucun effet (ni séquence ni poly)
2. **`_tempo()` crashe** — memory access out of bounds systématique
3. **`/N` devant `{}`** crashe — FillPhaseDiagram out of bounds

### Priorité moyenne
4. **Décimaux `/\`** incohérents (mais `_tempo()` décimal fonctionne en natif, donc si `_tempo` est fixé les décimaux marchent)

### Root cause probable
- `\N` : le caractère backslash est peut-être mal échappé dans la chaîne JavaScript → C (double-escape `\\` vs `\`)
- `_tempo()` : le token `_tempo(x/y)` n'est probablement pas reconnu par le parser WASM, ou le code de Polymetric.c qui le traite n'est pas compilé/lié dans le build WASM
- `/N` devant `{}` : bug spécifique à FillPhaseDiagram quand le premier élément de l'expression est un tempo op

### Fichiers concernés
- `bp3-engine/csrc/bp3/Polymetric.c` — PolyMake, FillPhaseDiagram, TimeSet
- `bp3-engine/csrc/wasm/bp3_api.c` — API WASM, passage des grammaires
- Vérifier aussi le parsing du `\` dans le code de compilation des grammaires

### Reproduction

Grammaires minimales (alphabet = `C4\nD4\nE4\nF4`) :

```
# Bug \N ignoré (WASM)
ORD
gram#1[1] S --> \2 C4 D4 E4 F4

# Bug _tempo crash (WASM)
ORD
gram#1[1] S --> _tempo(2/1) C4 D4 E4 F4

# Bug /N devant {} crash (WASM)
ORD
gram#1[1] S --> /2 {C4 D4,E4 F4} {C4 D4,E4 F4}

# Bug \1 ne reset pas (NATIF)
ORD
gram#1[1] S --> C4 \2 D4 E4 \1 F4

# Bug /0.5 ABORT (NATIF)
ORD
gram#1[1] S --> C4 /0.5 D4 E4 F4
```

## 5. Impact sur BPscript

Le design cible est d'unifier `/N` et `*N` en un seul opérateur BPscript dont la sémantique dépend du contexte (symbole vs `{}`). Mais cela nécessite que le moteur WASM supporte correctement les tempo operators, ce qui n'est pas le cas aujourd'hui.

**Workaround actuel** : utiliser `[speed:N]` → `{N, ...}` pour les groupes polymétrique (fonctionne en WASM et natif).

**Cible** : une fois les bugs WASM fixés, l'encoder pourra émettre `_tempo(x/y)` en bracket autour des `{}` pour le scoping local, car c'est le mécanisme le plus fiable et le seul qui supporte les décimaux correctement en natif.
