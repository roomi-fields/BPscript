---
À : Bernard
Objet : v3.4.2 — tests OK sur dhadhatite/kathak, deux petites corrections à intégrer
---

Bonjour Bernard,

Super travail sur v3.4.2 ! J'ai mergé localement tes changements par-dessus notre branche WASM, exécuté toute la non-régression (36 grammaires, S1+S2+S4+S5) et testé spécifiquement le mode ANAL sur tes grammaires `dhadhatite` et `kathak`. Je te résume.

## 1. Ce qui marche

- **ANAL mode sur dhadhatite** (analyse via templates) : parfait, 4/6 templates acceptés, 2 rejetés, aucun crash :
  ```
  Item matching template [1] rejected ❌
  Item matching template [2] accepted ✅
  Item matching template [3] rejected ❌
  Item matching template [4] accepted ✅
  Item matching template [5] accepted ✅
  Item matching template [6] accepted ✅
  ```
- **kathak** : `expand` fonctionne sur toutes les compositions (speed markers `/4 /6 /8`, polymetries, period notation).
- **watch** : ton fix Kpress/Quantization passe maintenant la non-régression S4 (35→36 OK).
- **Zéro heap-buffer-overflow** détecté par AddressSanitizer sur dhadhatite/kathak/Ruwet/Visser3.

## 2. Deux régressions détectées, deux corrections à intégrer

### 2a) Un debug trace oublié dans `Compute.c:803`

Tu as laissé un `BPPrintMessage(1,...,"@@@ PrintWorkString()\n")` non commenté. En mode text, ça se retrouve capturé comme tokens dans les sorties. Sur `koto3` ça me faisait perdre **32 tokens** dans la comparaison S1/S2.

**À faire** : commenter la ligne 803 de `Compute.c` :

```c
// AVANT (ligne 803)
hastabs = FALSE; // 2026-04-12
BPPrintMessage(1,odInfo,"@@@ PrintWorkString()\n");
if((rep=PrintWorkString(datamode && hastabs,OutputWindow,hastabs,ifunc,pp_b)) != OK) {

// APRÈS
hastabs = FALSE; // 2026-04-12
// BPPrintMessage(1,odInfo,"@@@ PrintWorkString()\n");
if((rep=PrintWorkString(datamode && hastabs,OutputWindow,hastabs,ifunc,pp_b)) != OK) {
```

### 2b) `copy_grammar()` est TOUJOURS utilisé — ton fix LengthOf contourne sans corriger la racine

Tu m'écrivais « *copy_grammar() n'est plus utilisé, donc ne peut pas être une cause de crash* ». En fait elle l'est encore :

```c
// Interface2.c ligne 416 (v3.4.2)
if(!check_no_copy) CopyGramcompileToGram(FirstGrammar);
// → appelle copy_grammar() en interne
// check_no_copy = 0 par défaut
```

Ton workaround dans `LengthOf()` (scan `TEND TEND` au lieu de lire `MyGetHandleSize`) fonctionne **pour LengthOf**, mais :

1. **`copy_grammar()` continue d'allouer de faux handles** de 8 octets au lieu de `s_handle_priv` de 16 octets (`malloc(sizeof(tokenbyte *))` au lieu de `GiveSpace`). Les données du buffer sont copiées correctement mais le handle n'a pas la taille bien enregistrée.
2. **~30 autres appels à `MyGetHandleSize`** dans le code lisent cette taille et planteront pareil sur ces handles corrompus : `Polymetric.c:71,91`, `DisplayArg.c:74`, `FillPhaseDiagram.c`, `Automata.c`, `Misc.c`, `Encode.c:1466`, etc. N'importe lequel peut réveiller le bug selon le chemin d'exécution.
3. Ta nouvelle `LengthOf` est aussi un peu dangereuse : la boucle `while(TRUE)` n'a plus de garde-fou. Si un buffer n'a pas `TEND TEND` (cas d'erreur), lecture infinie hors buffer jusqu'à segfault. Le `BPPrintMessage + Panic = TRUE` en bas est du code mort — jamais atteint.

**Ce que je propose** : remplacer les 4 sites `malloc/malloc` dans `copy_grammar()` par un seul `GiveSpace()` qui crée des handles corrects. Le reste du code ne change pas, car `*p_X` donne le `memblock` dans les deux cas (premier champ de `s_handle_priv`). Et tu peux remettre la vieille `LengthOf` avec `MyGetHandleSize` qui marchera de nouveau.

**4 remplacements dans `CompileGrammar.c`**, fonction `copy_grammar()` (vers ligne 1970-2130) :

#### Bloc 1 — `p_leftarg` (ligne ~1975)

```c
// AVANT
dest_rule->p_leftarg = (tokenbyte **)malloc(sizeof(tokenbyte *));
if (!dest_rule->p_leftarg) {
    if(verbose) BPPrintMessage(0,odError, "=> Memory allocation failed for left arg tokens\n");
    return;
    }
*dest_rule->p_leftarg = (tokenbyte *)malloc(leftarg_count * sizeof(tokenbyte));
if (!*dest_rule->p_leftarg) {
    if(verbose) BPPrintMessage(0,odError, "=> Memory allocation failed for left arg tokens\n");
    free(dest_rule->p_leftarg);
    dest_rule->p_leftarg = NULL;
    return;
    }
// Copy the token array
memcpy(*dest_rule->p_leftarg, *src_rule->p_leftarg, leftarg_count * sizeof(tokenbyte));

// APRÈS
dest_rule->p_leftarg = (tokenbyte **)GiveSpace((Size)(leftarg_count * sizeof(tokenbyte)));
if (dest_rule->p_leftarg == NULL) {
    if(verbose) BPPrintMessage(0,odError, "=> GiveSpace failed for left arg tokens\n");
    return;
    }
memcpy(*dest_rule->p_leftarg, *src_rule->p_leftarg, leftarg_count * sizeof(tokenbyte));
```

#### Bloc 2 — `p_rightarg` (ligne ~2003)

```c
// AVANT
dest_rule->p_rightarg = (tokenbyte **)malloc(sizeof(tokenbyte *));
if (!dest_rule->p_rightarg) {
    if(verbose) BPPrintMessage(0,odError, "=> Memory allocation failed for right arg tokens\n");
    return;
    }
*dest_rule->p_rightarg = (tokenbyte *)malloc(rightarg_count * sizeof(tokenbyte));
if (!*dest_rule->p_rightarg) {
    if(verbose) BPPrintMessage(0,odError, "=> Memory allocation failed for right arg tokens\n");
    free(dest_rule->p_rightarg);
    dest_rule->p_rightarg = NULL;
    return;
    }
memcpy(*dest_rule->p_rightarg, *src_rule->p_rightarg, rightarg_count * sizeof(tokenbyte));

// APRÈS
dest_rule->p_rightarg = (tokenbyte **)GiveSpace((Size)(rightarg_count * sizeof(tokenbyte)));
if (dest_rule->p_rightarg == NULL) {
    if(verbose) BPPrintMessage(0,odError, "=> GiveSpace failed for right arg tokens\n");
    return;
    }
memcpy(*dest_rule->p_rightarg, *src_rule->p_rightarg, rightarg_count * sizeof(tokenbyte));
```

#### Bloc 3 — `leftcontext->p_arg` (ligne ~2050)

```c
// AVANT
(*dest_rule->p_leftcontext)->p_arg = (tokenbyte **)malloc(sizeof(tokenbyte *));
if (!(*dest_rule->p_leftcontext)->p_arg) {
    if(verbose) BPPrintMessage(0,odError, "=> Memory allocation failed for left context args\n");
    return;
    }
*(*dest_rule->p_leftcontext)->p_arg = (tokenbyte *)malloc(arg_count * sizeof(tokenbyte));
if (!*(*dest_rule->p_leftcontext)->p_arg) {
    if(verbose) BPPrintMessage(0,odError, "=> Memory allocation failed for left context arg tokens\n");
    free((*dest_rule->p_leftcontext)->p_arg);
    (*dest_rule->p_leftcontext)->p_arg = NULL;
    return;
    }
// Copy the token array
if ((*src_rule->p_leftcontext)->p_arg == NULL || (*dest_rule->p_leftcontext)->p_arg == NULL) {
    fprintf(stderr, "Error: p_arg is NULL!\n");
    if(verbose) BPPrintMessage(0,odError, "=> Error: igram = %d, irule = %d, p_arg is NULL!\n",igram,irul);
    return;
    }
memcpy(*(*dest_rule->p_leftcontext)->p_arg, *(*src_rule->p_leftcontext)->p_arg, arg_count * sizeof(tokenbyte));

// APRÈS
(*dest_rule->p_leftcontext)->p_arg = (tokenbyte **)GiveSpace((Size)(arg_count * sizeof(tokenbyte)));
if ((*dest_rule->p_leftcontext)->p_arg == NULL) {
    if(verbose) BPPrintMessage(0,odError, "=> GiveSpace failed for left context arg tokens\n");
    return;
    }
if ((*src_rule->p_leftcontext)->p_arg == NULL) {
    fprintf(stderr, "Error: p_arg is NULL!\n");
    if(verbose) BPPrintMessage(0,odError, "=> Error: igram = %d, irule = %d, p_arg is NULL!\n",igram,irul);
    return;
    }
memcpy(*(*dest_rule->p_leftcontext)->p_arg, *(*src_rule->p_leftcontext)->p_arg, arg_count * sizeof(tokenbyte));
```

#### Bloc 4 — `rightcontext->p_arg` (ligne ~2105)

Symétrique du bloc 3, même pattern.

```c
// AVANT
(*dest_rule->p_rightcontext)->p_arg = (tokenbyte **)malloc(sizeof(tokenbyte *));
if (!(*dest_rule->p_rightcontext)->p_arg) {
    if(verbose) BPPrintMessage(0,odError, "=> Memory allocation failed for right context args\n");
    return;
    }
*(*dest_rule->p_rightcontext)->p_arg = (tokenbyte *)malloc(arg_count * sizeof(tokenbyte));
if (!*(*dest_rule->p_rightcontext)->p_arg) {
    if(verbose) BPPrintMessage(0,odError, "=> Memory allocation failed for right context arg tokens\n");
    free((*dest_rule->p_rightcontext)->p_arg);
    (*dest_rule->p_rightcontext)->p_arg = NULL;
    return;
    }
if ((*src_rule->p_rightcontext)->p_arg == NULL || (*dest_rule->p_rightcontext)->p_arg == NULL) {
    fprintf(stderr, "Error: p_arg is NULL!\n");
    if(verbose) BPPrintMessage(0,odError, "=> Error: igram = %d, irule = %d, p_arg is NULL!\n",igram,irul);
    return;
    }
memcpy(*(*dest_rule->p_rightcontext)->p_arg, *(*src_rule->p_rightcontext)->p_arg, arg_count * sizeof(tokenbyte));

// APRÈS
(*dest_rule->p_rightcontext)->p_arg = (tokenbyte **)GiveSpace((Size)(arg_count * sizeof(tokenbyte)));
if ((*dest_rule->p_rightcontext)->p_arg == NULL) {
    if(verbose) BPPrintMessage(0,odError, "=> GiveSpace failed for right context arg tokens\n");
    return;
    }
if ((*src_rule->p_rightcontext)->p_arg == NULL) {
    fprintf(stderr, "Error: p_arg is NULL!\n");
    if(verbose) BPPrintMessage(0,odError, "=> Error: igram = %d, irule = %d, p_arg is NULL!\n",igram,irul);
    return;
    }
memcpy(*(*dest_rule->p_rightcontext)->p_arg, *(*src_rule->p_rightcontext)->p_arg, arg_count * sizeof(tokenbyte));
```

**Pourquoi ça marche** : `GiveSpace` renvoie un `Handle` (= pointeur sur `s_handle_priv` qui est `{void* memblock; Size size;}`). Comme `memblock` est le premier champ, `*handle` donne toujours le pointeur vers les tokens. Les `memcpy(*dest, *src, ...)` continuent donc de fonctionner à l'identique, mais maintenant `MyGetHandleSize()` sait lire la taille correctement. Et tu peux restaurer l'ancienne `LengthOf()` qui redevient fiable.

## 3. Vérification

Après les deux correctifs ci-dessus, sur ma non-régression :

|                    | Baseline v3.3.19 | v3.4.2 brut | v3.4.2 + 2 corrections |
| ------------------ | :--------------: | :---------: | :--------------------: |
| S1 native          |      36 OK       |    36 OK    |         36 OK          |
| S4 silent          | 35 OK (watch KO) |  **36 OK**  |       **36 OK**        |
| S1 vs S2 EXACT     |        26        |   24 (−2)   |        25 (−1)         |
| ANAL               |     indispo      |    ✅      |          ✅            |
| ASan heap-overflow |      clean       |    clean    |         clean          |

La dernière différence restante (templates grammar S1=36634 vs S2=36635) vient d'un changement volontaire de parsing des contextes `(= ... )` → il merge maintenant les marqueurs différemment. C'est un choix à confirmer de ton côté.

## 4. Bonus — tes grammaires illustrent la généralité

Juste une note sur ton message « grammaires/données hors tabla pour illustrer la généralité » : tes deux nouvelles données `-da.kathak` m'ont permis de tester le pipeline sur un cas totalement différent (kathak, 53 bols, multi-speed markers + polymetries + period notation + tihai in 12 beats). C'est parfait pour le benchmark.

La couche de synthèse des bols `dha`, `tite`, etc. on peut l'ajouter côté Kanopi/BPscript (alphabet → samples), il suffit que tu produises les silent sound-objects comme tu le fais déjà.

Je te joins tout ça sous forme de patch unifié `v3.4.2-integration.patch` si tu préfères l'appliquer avec `git apply`. Sinon, les 4+1 remplacements ci-dessus sont directement copiables dans les deux fichiers.

À bientôt,
Romain
