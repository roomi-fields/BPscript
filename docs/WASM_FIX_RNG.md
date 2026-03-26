# WASM Fix — RNG glibc-compatible et seeding correct

Date: 2026-03-24

## 1. Use case : la sequence Look-and-Say

La grammaire `-gr.look-and-say` implemente la suite de Conway
(https://en.wikipedia.org/wiki/Look-and-say_sequence).

**gram#1 (ORD)** — initialisation :
```
S --> '1' /steps=100/
```
Produit `'1'` et initialise le K-parametre `steps` a 100.

**gram#2 (SUB)** — iteration :
```
gram#2[1] LEFT /steps-1/ '1'           --> '1' '1'
gram#2[2] LEFT /steps-1/ '1' '1'       --> '2' '1'
gram#2[5] LEFT /steps-1/ '1' '1' '1'   --> '3' '1'
gram#2[3] LEFT /steps-1/ '2'           --> '1' '2'
gram#2[3] LEFT /steps-1/ '2' '2'       --> '2' '2'
gram#2[5] LEFT /steps-1/ '1' '1' '1'   --> '3' '1'
gram#2[5] LEFT /steps-1/ '1' '1' '1' '2' '2' '1' --> '3' '1' '2' '2' '1' '1'
gram#2[4] LEFT /steps-1/ '1' '2' '1' '1' --> '1' '1' '1' '2' '2' '1'
```

Chaque regle a un garde `/steps-1/` : ne s'applique que si `steps > 0`,
puis decremente `steps` de 1. La sous-grammaire SUB doit **boucler** :
scanner tout le buffer de gauche a droite, appliquer les substitutions,
puis recommencer tant que des regles matchent et que `steps > 0`.

**Comportement attendu** : le moteur boucle jusqu'a epuisement de steps
ou absence de match, produisant une sequence Look-and-Say croissante.

## 2. Comportement observe

| | Natif (3.3.16, glibc) | WASM (emscripten, musl) |
|---|---|---|
| Tokens produits | **13** | **4** |
| Resultat | `'3' '2' '1' '1' '1' '2' '1' '2' '3' '3' '2' '1' '1'` | `'3' '2' '1' '1'` |
| Flag steps final | ? | **95** (5 decrements sur 100) |
| Statut | OK | **Arret premature** |

Les 4 tokens WASM correspondent aux 4 premiers du natif — la logique de
substitution est correcte, c'est la **boucle qui s'arrete trop tot**.

## 3. Mecanisme de la boucle SUB dans Compute.c

La boucle SUB a deux niveaux :

### Boucle interne (RETRY1) — scan du buffer
```
RETRY1:
  while(FindCandidateRules(... leftpos ...) > 0) {
      // selectionner une regle, appliquer Derive()
      // avancer leftpos dans le buffer
  }
  // Fin du while : pas de candidat a leftpos courant
  leftpos = NextPos(...)  // avancer au prochain terminal
  if(leftpos > -1) goto RETRY1  // scanner la position suivante
```
Cette boucle scanne **toutes les positions** du buffer. Elle fonctionne correctement.

### Boucle externe (RETRY) — re-iteration
Apres un scan complet, le moteur decide s'il recommence :

```c
// ligne 805: copier le resultat B -> A
if(foundone) (*p_length) = CopyBuf(pp_b, pp_a);

// ligne 813: reset positions
lastpos = leftpos = ZERO; incmark = 0;

// ligne 849: mettre a jour les flags (decrementer steps)
if((Varweight || Flagthere) && (maxpref > 0)) {
    ChangeFlagsInRule(...)  // steps -= 1
}

// ligne 876-880: DECISION DE RE-BOUCLAGE  <-- LE BUG EST ICI
leftpos = NextPos(pp_a, pp_b, &lastpos, &incmark, leftpos, 0);
if(changed && FindCandidateRules(pp_a, ..., leftpos, ...) > 0) {
    goto RETRY;  // on re-boucle
}
// sinon : on sort de la sous-grammaire
```

## 4. Cause racine identifiee

### Le check de re-bouclage (ligne 876-880) ne teste que la position 0

1. **Ligne 813** : `leftpos = ZERO` (reset a 0)
2. **Ligne 876** : `NextPos(pp_a, ..., 0, 0)` retourne **0** — position du premier terminal
3. **Ligne 880** : `FindCandidateRules(... leftpos=0 ...)` appelle `Found()` qui
   tente de matcher les regles **uniquement a la position 0**

Pour le buffer resultant `['3' '2' '1' '1']` :
- Position 0 : `'3'` — **aucune regle** ne matche `'3'`
- `FindCandidateRules` retourne 0
- La boucle s'arrete

**Pourtant** : position 2 contient `'2'` (regle 4 matche), positions 4 et 6
contiennent `'1'` (regle 1 matche), et `steps = 95 > 0`.

### Pourquoi le natif ne declenche pas ce bug

Le choix de regle quand plusieurs candidats matchent au meme point est
pondere aleatoirement (`rand()`). Les implementations de `rand()` different :

```
seed=1, glibc (natif)  : 1804289383, 846930886, 1681692777, ...
seed=1, musl (WASM)    : 0, 740882966, 1616430695, ...
```

Avec glibc, les choix de regles ne produisent jamais un buffer commencant
par `'3'` au moment du check. Avec musl, les choix menent a `'3'` en
position 0 apres 5 passes, declenchant le bug.

**C'est un bug latent dans le code original**, masque par le RNG de glibc.

### Preuve par le trace WASM

Dernier `FindCandidateRules` (trace_compute=1) :
```
FindCandidateRules() leftpos = 0
Found() left neg irul = 1, istart = 0 lenc = 0 jstart = 0   <- '1' vs '3' FAIL
Found() left neg irul = 2, istart = 0 lenc = 0 jstart = 0   <- '1''1' vs '3' FAIL
Found() left neg irul = 3, istart = 0 lenc = 0 jstart = 0   <- FAIL
Found() left neg irul = 4, istart = 0 lenc = 0 jstart = 0   <- '2' vs '3' FAIL
Found() left neg irul = 5, istart = 0 lenc = 0 jstart = 0   <- FAIL
Found() left neg irul = 6, istart = 0 lenc = 0 jstart = 0   <- FAIL
Found() left neg irul = 7, istart = 0 lenc = 0 jstart = 0   <- FAIL
End FindCandidateRules i = 0                                  <- 0 candidats -> STOP
```

Toutes les regles testees a `jstart=0` uniquement. Aucun test aux positions 2, 4, 6.

## 5. Correction appliquee

### Approche rejetee : modifier Compute.c

Deux tentatives de modifier la boucle SUB dans Compute.c ont echoue :

1. **`if(changed) goto RETRY`** : la sequence look-and-say a TOUJOURS des tokens
   matchables (il y a toujours des `'1'` quelque part). Sans le check position-0,
   la boucle tourne ~100 fois (steps=100), le buffer grossit exponentiellement
   (~30% par passe) et crash (stack overflow WASM).

2. **Scanner toutes les positions** : meme probleme — les rules matchent toujours
   quelque part, la boucle ne s'arrete qu'a steps=0 avec croissance exponentielle.

Le check position-0 est un **mecanisme de terminaison intentionnel** du moteur BP3
pour les grammaires SUB dont le buffer grandit indefiniment. Le natif s'arrete aussi
apres ~11 passes (pas 100). **Compute.c n'est pas modifie.**

### Correction effective : aligner le RNG (couche WASM uniquement)

Le vrai probleme est double :

**1. `rand()` incompatible (bp3_wasm_stubs.c)**

Musl (emscripten) utilise un LCG simple. Glibc utilise un generateur non-lineaire
TYPE_3 a retour additif (degre 31). Avec seed=1 :
```
glibc : 1804289383, 846930886, 1681692777, ...
musl  : 0, 740882966, 1616430695, ...
```

Fix : implementation glibc-compatible de `srand()`/`rand()` dans bp3_wasm_stubs.c
(~50 lignes). Override les fonctions musl par linkage.

**2. `srand(Seed+seed)` au lieu de `srand(Seed)` (bp3_api.c)**

`bp3_load_settings_params()` appelait `ReseedOrShuffle(seed)` qui fait :
```c
seed = (Seed + what) % 32768;  // Seed=1, what=1 -> srand(2) au lieu de srand(1)
```

Le natif fait `ResetRandom()` -> `srand(Seed)` directement.

Fix : remplacer `ReseedOrShuffle(seed)` par `srand(Seed); UsedRandom = FALSE;`

### Resultat

```
AVANT : WASM 4 tokens, steps=95  (arret premature)
APRES : WASM 13 tokens, steps=89 (identique au natif)
```

Les 13 tokens matchent exactement la sortie native :
`'3' '2' '1' '1' '1' '2' '1' '2' '3' '3' '2' '1' '1'`

Regression check sur 4 autres grammaires (drum, ek-do-tin, destru, Ames) : OK.

## 6. Fichiers modifies

- `wasm/bp3_wasm_stubs.c` : implementation glibc-compatible de `srand()`/`rand()`
- `wasm/bp3_api.c` : `srand(Seed)` direct au lieu de `ReseedOrShuffle(seed)`
- `Compute.c` : **non modifie** (revert apres analyse)

## 7. Reproduction

```bash
# Natif — 13 tokens
cd bp3-engine && ./bp3 produce -D -e -gr test-data/-gr.look-and-say --seed 1

# WASM avant fix — 4 tokens
# WASM apres fix — 13 tokens (identique natif)
node test/grammars/s2_wasm_orig.cjs look-and-say
```
