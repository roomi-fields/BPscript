# Directives pour l'agent moteur-wasm — Homomorphismes par étiquetage

**Contexte** : lire `docs/DESIGN_HOMOMORPHISM_LABELING.md` avant de commencer.

---

## Résumé

**Aucune modification du moteur WASM n'est nécessaire pour l'étiquetage.**

Le mécanisme repose entièrement sur le fait que BP3 traite les noms de terminaux
comme opaques. Le transpileur génère un fichier -ho. avec des étiquettes (`N%xxx`)
au lieu de vrais noms. BP3 applique `Image()` normalement et émet les étiquettes
dans les timed tokens.

---

## Ce qui change pour toi

### 1. Le fichier -ho. aura un format légèrement différent

Le transpileur va émettre des terminaux contenant `%` :

```
*
bolSa
bolRe
dha
0%dha
dha --> 0%dha
-----
TR
1%dha
dha --> 1%dha
```

**Vérifier** : est-ce que `%` est accepté dans les noms de terminaux par BP3 ?
Tester avec `bp3_load_alphabet()` un fichier contenant `0%dha` comme terminal.

Si `%` pose problème (parsing interne), signaler à l'architecte. Les autres
caractères autorisés (`#`, `'`, `"`) ont des conflits avec BPscript.

### 2. Les timed tokens contiendront des étiquettes

`bp3_get_timed_tokens()` retournera des tokens comme `0%dha`, `1%C3`, etc.
Ce sont des terminaux valides — BP3 les a trouvés dans l'alphabet via `Image()`.
Le dispatcher JS les résoudra.

### 3. Tests de validation

Créer un test qui vérifie que BP3 :
1. Accepte un fichier -ho. avec des étiquettes `N%terminal`
2. Applique correctement `Image()` (le slave contient les étiquettes)
3. Émet les étiquettes dans les timed tokens

**Test minimal** :

```javascript
// Alphabet (-ho.) avec étiquetage
const alphabet = `*
a
b
0%a
0%b
a --> 0%a
b --> 0%b`;

// Grammaire avec master/slave
const grammar = `ORD
gram#1[1] S --> (=X) a b * (:X)`;

bp3_init();
bp3_load_alphabet(alphabet);
bp3_load_grammar(grammar);
bp3_produce();
const tokens = JSON.parse(bp3_get_timed_tokens());

// Attendu : tokens contient "a", "b", "0%a", "0%b"
// (le master a "a" "b", le slave a "0%a" "0%b")
```

Si ce test passe → le mécanisme d'étiquetage fonctionne, aucune modification
du moteur n'est nécessaire.

Si ce test échoue → diagnostiquer :
- `%` refusé dans les noms ? → signaler à l'architecte
- `Image()` ne lookup pas correctement ? → vérifier le format -ho.
- Le slave n'est pas généré ? → vérifier la syntaxe `(=X) * (:X)`

### 4. Validation des scènes existantes

Les scènes qui utilisent déjà des templates SANS transcription (`$X &X`) ne doivent
pas être cassées. Vérifier :
- `checktemplates` — `$A &A` (pas de transcription)
- `simpletemplates` — `$A &A` avec period notation
- `templates` — templates variés

---

## Ce que tu ne dois PAS faire

- Ne pas modifier `bp3_api.c`
- Ne pas modifier le code C de Bernard
- Ne pas ajouter de parser JSON dans le moteur
- Ne pas changer le format de sortie de `bp3_get_timed_tokens()`

---

## Priorité

1. **Tester le caractère `%` dans les noms** — c'est le bloquant potentiel
2. **Tester le master/slave avec étiquettes** — valider que Image() fonctionne
3. **Régression templates existants** — vérifier que rien n'est cassé

---

## Références

- `docs/DESIGN_HOMOMORPHISM_LABELING.md` — spec architecturale
- `docs/DESIGN_INTERFACES_BP3.md` — interface WASM in/out
- `docs/REFERENCE_HO_FORMAT.md` — format fichier -ho.
- `wasm/bp3_api.c` — API WASM (ne pas modifier)
