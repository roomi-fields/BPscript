# Feedback pour Bernard — Moteur BP3

Points identifiés pendant les tests systématiques des 107 grammaires sur le moteur C natif 3.3.16 et le portage WASM.

---

## 1. LoadSettings() segfault sur certains fichiers JSON (3.3.16)

Le binaire natif 3.3.16 crashe (segfault) en chargeant certains fichiers settings JSON recyclés par l'interface PHP.

**Reproduction :**
```bash
cd bp3-engine
./bp3 produce -e --midiout /tmp/test.mid -gr test-data/-gr.acceleration -se test-data/-se.Visser2 --seed 1
# → Segmentation fault (core dumped)
```

Sans `-se`, la même grammaire fonctionne parfaitement (78 sound-objects produits).

Le fichier `-se.Visser2` est en format JSON (recyclé par l'interface PHP, commence par `{`).

---

## 2. Espacement et calcul des ratios temporels

Dans la grammaire livecode2 :
```
Cas 1 (grammaire BP3) :  re4{17/120,fa1 fa2}17/1920{119/1920,la2}
Cas 2 (transpilé)     :  re4 {17/120,fa1 fa2} 17/1920 {119/1920,la2}
```

Le cas 1 produit `la2` à start=1161ms. Le cas 2 produit `la2` à start=1158ms. L'écart s'accumule sur la séquence (3ms → 42ms sur 29 tokens).

**Question : est-ce que l'absence d'espace entre un terminal et `{` a une signification syntaxique dans BP3, ou est-ce que les deux formes devraient produire exactement le même résultat ?**

---

## 3. Vieux fichiers settings — format texte plat incompatible avec 3.3.16

Beaucoup de fichiers `-se.xxx` dans `test-data/` sont encore en format texte plat (lignes positionnelles, commencent par `//`). Le binaire 3.3.16 ne les charge pas :

```
=> Could not parse JSON settings: // Bol Processor version BP2.7
```

Et il ne produit pas de MIDI dans ce cas. Bernard a mentionné que son interface PHP recycle ces fichiers automatiquement. Mais pour les tests en ligne de commande, on ne peut pas charger les settings de ~90% des grammaires du test-data.

**Suggestion :** soit ajouter un mode de compatibilité dans `LoadSettings()` pour l'ancien format, soit fournir un script de conversion batch (Bernard a mentionné `convert_to_json()` dans `_basic_tasks.php`).

---

## 4. Encodage MacOS dans les vieux fichiers

Certains vieux fichiers (pré-2000) contiennent des caractères MacOS non-UTF8 :
- `¥` (U+00A5) à la place de `.` (séparateur de périodes)
- `ž` dans les dates ("Aož" pour "Août")

Exemple : `-gr.doeslittle` (1998) contient `S --> C3 ¥ C4 ¥ D4 C4 F#3 ¥ A3 ¥ C4`.

Le remplacement `¥ → .` corrige le problème. Bernard a confirmé que l'interface PHP fait `mb_convert_encoding($content,'UTF-8','UTF-8')` automatiquement.

**Suggestion :** un passage de nettoyage sur les 515 fichiers de test-data, ou un flag dans le binaire console pour activer le nettoyage automatique.

---

## 5. `_transpose()` — comportement attendu ?

La grammaire `acceleration` commence par `_transpose(12)`. Le C natif applique la transposition aux noms de notes dans la sortie MIDI (E2 → E3). Le WASM ne l'applique pas (les timed tokens gardent E2).

C'est cohérent avec notre architecture (transpose = dispatcher), mais ça veut dire que les sorties C natif et WASM ne sont pas directement comparables sur les noms de notes quand `_transpose` est utilisé.

**Question : est-ce que `_transpose` modifie les noms dans la sortie texte de la console aussi, ou seulement dans le MIDI ?**

---

## 6. Différence d'arrondi C natif vs WASM (1ms)

Sur la grammaire `drum`, les end times des notes E7 diffèrent de 1ms entre le C natif (gcc) et le WASM (emscripten) :
- C natif : E7 500-539
- WASM : E7 500-540

C'est un artefact d'arrondi dans le calcul du staccato (96% de la durée). Non bloquant — on utilise une tolérance de 1ms dans nos comparaisons.

---

## 7. _pitchbend out of range dans 12345678 (ek-do-tin)

La grammaire `-gr.12345678` échoue en natif :
```
=> Pitchbend value (200 cents) on channel 1 out of range (-200..200 cents)
```

La grammaire fait `_pitchrange(200)` puis `_pitchbend(-200)` et `_pitchbend(+200)`. La valeur 200 devrait être dans la range puisque `_pitchrange(200)` la définit. Possible bug dans l'ordre d'application de `_pitchrange` vs `_pitchbend` dans le moteur console.

---

## 8. Pas d'API WASM pour charger les sound object prototypes (-so.)

Le WASM expose `bp3_load_grammar`, `bp3_load_alphabet`, `bp3_load_settings_params`, `bp3_load_tonality`, `bp3_load_csound_resources` mais **pas de fonction pour charger les fichiers `-so.xxx`** (sound object prototypes).

La grammaire `-gr.12345678` (ek-do-tin) utilise un alphabet tabla (`-al.EkDoTin`) avec des sound objects définis dans `-so.EkDoTin`. Sans le chargement de ces prototypes, le WASM produit des tokens avec des timings aberrants (start=0, end=11 au lieu de start=0, end=170).

**Suggestion :** ajouter `bp3_load_object_prototypes(const char* content)` à l'API WASM dans `bp3_api.c`, équivalent à `LoadObjectPrototypes()`.

---

## 9. checktemplates — natif ne produit que 7 tokens avec seed=1

La grammaire `-gr.checktemplates` est RND avec 6 règles et des TEMPLATES. Avec `--seed 1`, le natif choisit une règle différente du WASM (7 vs 3 tokens). C'est normal (rand() différent) mais à noter : les grammaires RND ne sont pas comparables S1 vs S2 en terme de contenu.

---

## 10. Pas d'API WASM pour charger les time patterns (-tb.)

La grammaire `-gr.tryTimePatterns` référence `-tb.tryTimePatterns` qui définit `t1=1/1 t2=3/2 t3=4/3 t4=1/2`. Sans ce fichier, le WASM traite `t1`, `t2`, etc. comme des terminaux inconnus (affichés `?` dans les timed tokens).

Le C natif 3.3.16 les résout correctement (8 notes avec les bons timings).

**Suggestion :** ajouter `bp3_load_timebase(const char* content)` à l'API WASM, ou intégrer les TIMEPATTERNS directement dans la grammaire.

---

## 11. Résumé des API WASM manquantes

Sur 63 grammaires avec des règles, 19 sont bloquées par des fichiers de dépendances non chargeables :

| Type | Fichier | API WASM | Grammaires bloquées |
|------|---------|----------|---------------------|
| Sound object prototypes | `-mi.xxx` | ❌ manquante | 15 |
| Orchestra | `-or.xxx` | ❌ manquante | 5 |
| Time patterns | `-tb.xxx` | ❌ manquante | 2 |

Les API existantes (`bp3_load_alphabet`, `bp3_load_tonality`, `bp3_load_csound_resources`) couvrent les 44 autres grammaires.

**Le blocage principal est `-mi.xxx`** (prototypes MIDI des sound objects). L'alphabet (`-al` ou `-ho`) référence un fichier `-mi.xxx` qui définit les durées et les mappings MIDI de chaque sound object. Sans ce fichier, le WASM traite les terminaux comme des silent sound objects de durée uniforme → les timings sont faux en S2.

Pour les tests S3/S4 (silent sound objects + BPscript) ce n'est pas un blocage — on utilise notre propre alphabet plat.

---

*(Point 12 retiré — la divergence look-and-say était due au RNG musl/glibc et au seeding WASM, pas au moteur. Corrigé côté WASM uniquement. Voir [look-and-say/report.md](look-and-say/report.md).)*

Résultat : WASM produit maintenant 13 tokens, identiques au natif.

---

*(Point 13 retiré — transposition3 : le natif produit juste "S" (pas d'expansion), le WASM produit 48 tokens dont 1 aberrant. C'est un problème de portage WASM, pas un bug moteur.)*

---

## 14. Fichiers `-ho.` (homomorphism) : CompileAlphabet échoue sur le header `Date:`

Les fichiers `-ho.xxx` au format BP2 contiennent un header :
```
V.2.5
Date: Sun, May 21, 1995 -- 10:18
-mi.dhati
*
dha --> ta
ti --> ti
...
```

`ReadAlphabet()` dans `CompileGrammar.c` traite la ligne `V.2.5` comme un label d'homomorphisme (`GetHomomorph`), puis la ligne `Date: Sun...` arrive dans `GetBols()` qui échoue sur le caractère `:` :

```
Can't accept character ":" in alphabet
=> Can't compile alphabet
```

**Ce n'est PAS un problème WASM** — le natif 3.3.17 échoue aussi :
```bash
cd bp3-engine && ./bp3 produce -D -e -gr test-data/-gr.dhati --seed 1
# → "=> Problem compiling grammar and/or alphabet"
```

**Impact** : 11 fichiers `-ho.` sur 38 dans test-data utilisent le format `V.x.x` avec `Date:` hors commentaire.

**Contournement WASM** : on strippe les lignes `V.x.x` et `Date:` avant de passer à `loadAl()`. Les 11/11 fichiers compilent après strip. Intégré dans `s2_wasm_orig.cjs`.

Le binaire natif v3.3.17 (compilé par Bernard le 24 mars) compile `-ho.dhati` sans erreur. Le `CompileGrammar.c` publié (v3.3.16 upstream) échoue. **Bernard a un fix dans son CompileGrammar.c local pas encore pushé.**

**Question** : est-ce que `ReadAlphabet()` pourrait skipper les lignes `V.x.x` et `Date:` automatiquement ? 11 fichiers `-ho.` dans test-data en ont besoin.

---

## 15. Audit complet — compatibilité des formats de fichiers auxiliaires

Testé sur le natif 3.3.17 (binaire Bernard du 24 mars) et le WASM (même source v3.3.16/17).

### Formats qui fonctionnent (natif + WASM)

| Format | Description | Fichiers dans test-data |
|--------|-------------|------------------------|
| `-gr.` | Grammaire | 103 |
| `-al.` | Alphabet simple | 12 |
| `-ho.` format `//` | Homomorphism, header en commentaire (BP2.8+) | 19/38 |
| `-ho.` format `-mi.` direct | Homomorphism, commence par `-mi.xxx` | 2/38 |
| `-ho.` format `*` direct | Homomorphism, commence par `*` | 2/38 |
| `-se.` format JSON | Settings (recyclés par l'interface PHP) | ~30% des 126 |
| `-to.` | Tonalité | 13 |
| `-tb.` | Time base / patterns | 23 |
| `-gl.` | Glossary | 2 |

### Formats qui ne fonctionnent PAS (natif ET WASM)

| Format | Description | Problème | Fichiers |
|--------|-------------|----------|----------|
| `-ho.` format `V.x.x` | Homomorphism ancien (BP2.5) | `Date:` hors `//` → "Can't accept character". **Contourné côté WASM** par strip header. | 11/38 |
| `-se.` format texte | Settings ancien (BP2) | "Could not parse JSON" (voir point 3) | ~70% des 126 |
| `-cs.` | Csound resources | Hang (timeout) sur certains fichiers | 13 |
| `-so./-mi.` | Prototypes MIDI | Échec en cascade quand `-ho.` échoue | 14 |
| `-or.` | Orchestra | "Unknown option" — non supporté en console | 14 |
| `-in.` | Interactive MIDI | "unsupported" en console | 3 |

### Note

Aucun de ces problèmes n'est spécifique au WASM — ce sont des limitations du moteur BP3 natif. Le WASM a des APIs pour tous les formats qui fonctionnent en natif (`bp3_load_alphabet`, `bp3_load_tonality`, `bp3_load_settings_params`, `bp3_provision_file`).

---

## 16. Poids infini `<°>` — syntaxe `<inf>` ajoutée

Le symbole `°` (poids infini BP2) ne fonctionne plus en UTF-8 ni en natif ni en WASM :
`GetArgument()` dans `CompileProcs.c:357` teste `c == -80` (byte 0xB0 Latin-1), mais en
UTF-8 le `°` fait 2 octets (0xC2 0xB0) → Error code 20 sur toutes les règles.

**Fix appliqué dans `CompileProcs.c`** : ajout de la syntaxe `<inf>` comme alternative
UTF-8-safe à `<°>`. Le legacy `<°>` est conservé pour les fichiers Latin-1.

```c
if(!control && (mode == 1) && (c == 'i' || c == -80)) {
    /* Infinite weight: <inf> (preferred) or legacy <°> (Latin-1 only) */
    if(c == 'i' && *((*qq)+1) == 'n' && *((*qq)+2) == 'f') {
        (*qq) += 3;
    } else if(c == -80) {
        (*qq)++;
    } else goto NOT_INF;
    n = INT_MIN;    /* Infinite weight */
    ...
```

**4 grammaires converties** de `<°>` vers `<inf>` dans test-data :
- `-gr.Nadaka-1er-essai` (35 occurrences)
- `-gr.bells` (1)
- `-gr.cloches1` (1)
- `-gr.tryflags3` (4)

Testé : Nadaka produit 4 tokens, 0 erreurs.

---

## 13bis. `<°>` poids infini non supporté en natif 3.3.17 (obsolète — voir point 16)

La grammaire `-gr.Nadaka-1er-essai` utilise `<°>` (degree sign, U+00B0) comme poids infini sur les règles LIN. Le natif 3.3.17 produit `Error code 20: incorrect weight` sur toutes les règles avec `<°>`. Le WASM aussi.

C'est probablement un problème d'encodage UTF-8 du caractère `°`. Dans les anciennes versions de Bernard ça fonctionnait peut-être en MacRoman.

---

## 14bis. `-gr.Nadaka-1er-essai` (anciennement `-gr.hamsad`) — variable `A8` non définie

La grammaire produit `A8 A8 A8 A8` sur les deux moteurs (natif 3.3.17 et WASM) avec le message `Undefined variable(s) found and ignored: A8`.

La sous-grammaire 1 fait :
```
S --> A32
A32 --> A8 A8 A8 A8
```

Mais `A8` n'est défini par aucune règle. La sous-grammaire 2 (LIN avec `<inf>`) substitue `G`, `P`, `N`, `R`, `S` en notes indiennes (`ga4`, `pa4`, etc.) mais ces variables n'apparaissent jamais dans le flux car `A8` n'est pas développé.

Il manque probablement des règles du type `A8 --> G P N R G S G P` dans la sous-grammaire 1 pour que les règles LIN de la sous-grammaire 2 puissent s'appliquer.

Note : `<°>` a été remplacé par `<inf>` dans le fichier (l'ancien format BP2 n'est plus supporté).

---

## 17. FIELDSIZE trop petit — crash PolyExpand sur transposition3

La grammaire `-gr.transposition3` (Harm Visser, 1997) crashe le natif avec :
```
=> Err. PolyExpand() j > jmax
```

**Cause :** `FIELDSIZE` est défini à 100 dans `-BP3.h:852`, ce qui donne `jmax = FIELDSIZE - 16 = 84`. La grammaire a une structure récursive profonde (RND + SUB1 + `_repeat(4)` + `/numtimes=5/`) qui produit une expression polymétriqe de plus de 84 paires de tokens après expansion. Le buffer d'entrée de PolyExpand (`p_e`) est alloué à `FIELDSIZE` et ne grandit pas dynamiquement — contrairement au buffer de sortie (`pp_c`) qui est agrandi par `Check_ic()`.

**Reproduction :**
```bash
cd bp3-engine
# Nettoyer la grammaire (format BP2, CR line endings)
./bp3 produce -se /tmp/clean_se.json -gr /tmp/gr_clean.txt --seed 1 --english -e
# → "Err. PolyExpand() j > jmax" → ABORT, 0 tokens
```

**Fix proposé :** augmenter `FIELDSIZE` de 100 à 1000 dans `-BP3.h:852` :
```c
#define FIELDSIZE 1000  /* standard size of field in poly structure */
```

Ça donne `jmax = 984`, largement suffisant pour transposition3. Le coût mémoire est négligeable (chaque buffer passe de 100 à 1000 octets). Le buffer de sortie (`pp_c`) grandit déjà dynamiquement — seul le buffer d'entrée (`p_e`) est limité par `FIELDSIZE`.

J'ai testé avec FIELDSIZE=1000 : le natif produit l'expression polymétriqe complète, aucune régression sur les autres grammaires (drum, look-and-say, negative-context, etc.).

**Alternative :** rendre `p_e` dynamique (comme `pp_c` avec `Check_ic()`), mais augmenter la constante est plus simple et suffisant.

---

## 18. Use-after-free dans la réécriture itérative de PolyExpand

**Ce bug est dans le code que nous avons écrit** (réécriture itérative de PolyExpand, intégrée en v3.3.18). Il n'existait pas dans l'ancien code récursif.

**Symptôme :** segfault dans PolyExpand sur `-gr.transposition3` quand `--midiout` est utilisé. AddressSanitizer rapporte :
```
heap-use-after-free on address ... in PolyExpand source/BP3/Polymetric.c:1506
freed by realloc in PolyExpand source/BP3/Polymetric.c:1348
```

**Cause :** le PUSH sauvegarde les variables du parent dans un frame du `_poly_stack`, puis fait pointer `pp_a`, `p_pos`, `p_P`, `p_Q`, `p_fixtempo`, `p_onefielduseful`, `p_maxid` directement dans ce frame (via `&_sf->p_e`, `&_sf->i`, etc.). Quand un descendant fait un PUSH qui déclenche un `realloc` (doublement de capacité), le `_poly_stack` est déplacé en mémoire et ces 7 pointeurs deviennent invalides.

**Fix appliqué dans `Polymetric.c` :**

1. Ajout de `_refs_frame_idx` (variable statique) — stocke l'index du frame dans `_poly_stack` référencé par les pointeurs actifs (`-1` = externe, pas dans le stack)
2. Après chaque `realloc`, recalcul des 7 pointeurs depuis l'index :
   ```c
   if(_refs_frame_idx >= 0) {
       pp_a = (tokenbyte ***)&(_poly_stack[_refs_frame_idx].p_e);
       p_pos = &(_poly_stack[_refs_frame_idx].i);
       // ... etc.
   }
   ```
3. Au POP, recalcul des pointeurs depuis l'index restauré (au lieu de restaurer les anciennes valeurs de pointeurs qui peuvent être invalides)
4. `_refs_frame_idx` sauvegardé/restauré dans chaque frame (`_refs_idx`)
5. Pré-allocation initiale à 256 frames (au lieu de 16) pour minimiser les reallocs

**Testé avec AddressSanitizer :** plus de use-after-free. Le natif produit correctement sur `-gr.transposition3` avec `--midiout` (exit=0). Aucune régression sur drum, look-and-say, etc.

---

## 19. Overflow des timestamps MIDI sur `-gr.transposition3`

La grammaire `-gr.transposition3` (Harm Visser, 1997) produit des timestamps MIDI aberrants :
```
startime = 4294967297, endtime = 47244640256
=> Err. WriteVarLenQuantity(): value 4294961914 is out of range in chunk #1
=> Canceling creation of MIDIfile
```

`4294967297 = 2^32 + 1` — c'est un overflow entier. La grammaire a une structure récursive profonde (RND + SUB1 + `_repeat(4)` + `/numtimes=5/` + `_transpose` croisé entre A↔B↔C↔D) qui produit une expression polymétriqe très longue. Les durées calculées par TimeSet/MakeSound dépassent la capacité d'un entier 32 bits.

**Ce bug est pré-existant dans le moteur original.** J'ai testé avec trois binaires différents — tous produisent la même erreur :
- `bp3.orig` (binaire Bernard v3.3.18 non modifié)
- `bp3_fs100_fixed` (FIELDSIZE=100 + fix use-after-free)
- `bp3_fs1000_fixed` (FIELDSIZE=1000 + fix use-after-free)

La production texte fonctionne (l'expression est produite correctement), seule l'écriture MIDI échoue à cause de l'overflow.

**Question :** est-ce que `WriteVarLenQuantity()` ou les timestamps dans `MakeSound.c` devraient utiliser des `unsigned long long` (64 bits) au lieu de `unsigned long` (32 bits sur certaines plateformes) pour supporter les grammaires avec des durées très longues ?

---

## 20. `_pitchbend` off-by-one dans `SetObjectFeatures.c` (check&, ek-do-tin)

La grammaire `-gr.check&` (rule 7) fait `_pitchrange(200) _pitchbend(-200) ... _pitchbend(+200)`.

Le `_pitchbend(-200)` fonctionne : `x = 8192 + (-200 × 8192 / 200) = 0` → OK.
Le `_pitchbend(+200)` échoue : `x = 8192 + (200 × 8192 / 200) = 16384` → **> 16383** → out of range.

Le calcul dans `SetObjectFeatures.c:1498` :
```c
x = DEFTPITCHBEND + ((double) x * DEFTPITCHBEND / (double) PitchbendRange[chan]);
```

Avec `DEFTPITCHBEND = 8192`, le max théorique est `8192 + 8192 = 16384`, mais la range MIDI pitchbend est `0..16383`. C'est un off-by-one : la borne positive dépasse de 1.

Le natif émet l'erreur et renvoie `Infpos`, ce qui fait échouer `SetVariation()` → `v = Infpos` → l'item est corrompu. En WASM, ça provoquait un crash dans `TimeSet` (kmax garbage) — corrigé côté WASM par une protection sur kmax, mais le bug de calcul reste dans le moteur C.

**Suggestion :** clamp à 16383 au lieu de rejeter :
```c
if(x > 16383) x = 16383;
if(x < 0) x = 0;
```
Ou ajuster la formule pour que `+PitchbendRange` donne exactement 16383.

---

## 21. `LoadSettings()` — clés JSON inversées (`MaxItemsProduce` → `UseEachSub`)

Dans `SaveLoads1.c:637`, le parsing JSON des settings avait deux bugs :

```c
// AVANT (bugué) :
else if(strcmp(key,"Max_items_produced") == 0) MaxItemsProduce = intvalue;
else if(strcmp(key,"MaxItemsProduce") == 0) UseEachSub = intvalue;

// APRÈS (corrigé) :
else if(strcmp(key,"MaxItemsProduce") == 0) MaxItemsProduce = intvalue;
else if(strcmp(key,"UseEachSub") == 0) UseEachSub = intvalue;
```

1. La clé `"Max_items_produced"` n'existe dans aucun fichier `-se.` JSON — c'est `"MaxItemsProduce"`.
2. La ligne suivante chargeait `"MaxItemsProduce"` dans `UseEachSub` au lieu de `MaxItemsProduce`.

**Impact :** quand un fichier `-se.` JSON contient `"MaxItemsProduce": {"value": "10"}`, la valeur 10 était assignée à `UseEachSub` (qui attend 0/1). Le vrai `MaxItemsProduce` gardait sa valeur par défaut.

**Corrigé dans `SaveLoads1.c:637-638`.**

---

## 22. Priorité seed : `--seed` en ligne de commande vs fichier `-se.`

`LoadSettings()` écrasait le seed passé en `--seed` avec celui du fichier `-se.`. Maintenant, si `Seed > 0` (déjà positionné par `--seed`), le seed du fichier est ignoré.

**Changements :**
- `ConsoleMain.c:874` : `Seed = 0L` au début de `ParsePostInitArgs()` (valeur initiale neutre)
- `ConsoleMain.c:1009` : `Seed = opts->seed` immédiat au parsing de `--seed` (pas seulement dans `ApplyArgs`)
- `SaveLoads1.c:666-671` : si `Seed > 0` au moment de charger `-se.`, ignorer le seed du fichier

**Motivation :** les tests de parité S1/S2 passent `--seed 1` puis chargent `-se.`. Sans cette priorité, le seed du fichier écrase `--seed 1` → résultats non reproductibles.

---

## 23. `MakeEmptyTokensSilent()` — refactoring de la gestion T4 dans TimeSet

Le code qui convertissait les variables non résolues (T4) en silent sound objects était inline dans `FillPhaseDiagram()` (ligne ~619). Problème : il créait des sound objects (incrémentait `Jbol`) au milieu du parcours du phase diagram, ce qui pouvait causer des incohérences.

**Refactoring :**
- Code extrait dans une nouvelle fonction `MakeEmptyTokensSilent()` (déclarée dans `-BP3.proto.h`)
- Appelée dans `TimeSet.c` **avant** `FillPhaseDiagram()` — les variables sont converties en amont
- La double vérification `CreateSilentSoundObject` pour les bols sans MIDI/Csound data (lignes ~636-639 de l'ancien code) est aussi retirée de `FillPhaseDiagram()`

**Fichiers modifiés :** `FillPhaseDiagram.c`, `TimeSet.c`, `-BP3.proto.h`

---

## 24. `BalancedPoly()` — guard contre les structures polymétriques invalides

Nouvelle fonction dans `DisplayThings.c` qui vérifie qu'un buffer de tokens a :
1. Des accolades polymétriques équilibrées (T0/12 ouvrante, T0/13 fermante)
2. Au moins un terminal (T3) ou une variable (T4)

**Utilisée dans `Compute.c`** (2 endroits) : `PrintResult()` n'est appelé que si `BalancedPoly(pp_b)` retourne TRUE. Empêche l'affichage de structures vides ou malformées pendant les substitutions intermédiaires (`UseEachSub`).

**Motivation :** sans ce guard, les grammaires `UseEachSub` produisaient des items intermédiaires vides qui polluaient la sortie (ex: `templates` produisait 36635 items au lieu des ~25000 réels).

**Fichiers modifiés :** `DisplayThings.c` (nouvelle fonction), `Compute.c` (2 appels), `-BP3.proto.h` (déclaration)

---

## 25. `ItemNumber` / `MaxItemsProduce` — refactoring du comptage de production

Plusieurs fixes interconnectés dans le comptage des items produits :

### a) `Compute.c:162` — `ItemNumber = 0 → 1` commenté
L'ancien code forçait `ItemNumber = 1` à la fin de `Compute()`. Ça faussait le comptage quand `MaxItemsProduce` était utilisé avec `UseEachSub`.

### b) `Compute.c:793-830` — ItemNumber incrémenté avant PrintResult
L'ancien code appelait `PrintResult()` puis incrémentait implicitement le compteur. Maintenant : `ItemNumber++` → check `MaxItemsProduce` → `PrintResult()`. Le flag `done_print` empêche le double affichage (deux blocs `UseEachSub` pouvaient imprimer le même item).

### c) `Compute.c:830` — condition `changed` ajoutée
`if(!SkipFlag)` → `if(foundone && !SkipFlag && changed)`. Sans `changed`, des items identiques étaient comptés et affichés à chaque passe de substitution.

### d) `ProduceItems.c:53` — guard `!WriteMIDIfile`
Le message "Most of the messages will be discarded during the improvisation" n'est plus affiché en mode MIDI file (pas pertinent).

### e) `ProduceItems.c:200` — check `MaxItemsProduce > 0`
L'ancien code comparait `ItemNumber > MaxItemsProduce` même quand `MaxItemsProduce == 0` (pas de limite). Ajout du guard `MaxItemsProduce > 0`.

### f) `ProduceItems.c:283-309` — ItemNumber dans le mode MIDI
Logique de comptage séparée pour `WriteMIDIfile`, `rtMIDI`, et mode texte. L'ancien `ItemNumber++` unique ne fonctionnait pas correctement dans tous les modes.

### g) `MakeSound.c:122-130` — ItemNumber incrémenté au début de MakeSound
Pour le mode `WriteMIDIfile`/`OutCsound`, `ItemNumber++` et check `MaxItemsProduce` sont maintenant en début de `MakeSound()`, avant la production du son. Évite de produire un item de plus que demandé.

**Fichiers modifiés :** `Compute.c`, `ProduceItems.c`, `MakeSound.c`

---

## 26. `MakeSoundObjectSpace()` — initialisation complète des champs

Dans `GetRelease.c:936-972`, l'allocation de nouveaux sound objects n'initialisait que `p_MIDIsize` et `p_CsoundSize` à ZERO. Tous les autres champs (36+ pointeurs, flags, paramètres) restaient non initialisés.

**Ajout :** initialisation explicite de tous les champs pour chaque objet `j` de 2 à `jmax` :
- Pointeurs MIDI/Csound : `pp_MIDIcode`, `pp_CsoundTime`, `pp_Comment`, `pp_CsoundScoreText`, `pp_CsoundScore` → NULL
- Flags booléens : `p_OkTransp`, `p_OkPan`, `p_OkMap`, `p_OkVolume`, `p_OkArticul`, `p_OkVelocity`, etc. → FALSE
- Valeurs par défaut : `p_StrikeAgain` → -1, `p_BreakTempo` → TRUE, `p_OkExpand`/`p_OkCompress` → TRUE
- Bornes : `p_MaxBegGap`/`p_MaxEndGap` → Infpos, `p_AlphaMax` → 100, etc.

**Motivation :** sans initialisation, les sound objects créés dynamiquement (ex: `CreateSilentSoundObject`) pouvaient lire des valeurs garbage, causant des comportements aléatoires ou des crashs en WASM.

---

## 27. `BPPrintMessage()` — NULL check sur les destinations de sortie

Dans `ConsoleMessages.c`, chaque écriture vers une destination (`gOutDestinations[...]`) vérifie maintenant que le pointeur n'est pas NULL avant d'appeler `vfprintf()`.

**Avant :**
```c
if(dest & odDisplay) {
    vfprintf(gOutDestinations[odiDisplay], format, args);  // crash si NULL
```

**Après :**
```c
if((dest & odDisplay) && gOutDestinations[odiDisplay]) {
    vfprintf(gOutDestinations[odiDisplay], format, args);
```

Appliqué à 6 destinations : `odDisplay`, `odMidiDump`, `odCsScore`, `odTrace`, `odUserInt`, `odWarning`.

**Aussi :** `NumberMessages++` déplacé dans le bloc `#ifndef __BP3_WASM__` / `odInfo` pour éviter le double-comptage.

---

## 28. `NoTracePath` — protection contre les écritures graphiques sans chemin

Nouvelle variable globale `NoTracePath` (déclarée dans `-BP3decl.h`, définie dans `-BP3main.h`).

- Initialisée à `TRUE` dans `ConsoleMain.c:PrepareTraceDestination()`
- Mise à `FALSE` seulement si un chemin trace est effectivement ouvert avec succès
- `CreateImageFile()` modifiée : quand pas de chemin trace, met `N_image = 0` au lieu de désactiver `ShowGraphic`/`ShowPianoRoll` (qui affectait le reste de la production)

**Motivation :** en mode console sans `-T` (trace), les appels graphiques échouaient silencieusement puis désactivaient des flags globaux, affectant la suite de la production.

---

## 29. `cJSON.c` — buffer overflow potentiel dans `snprintf`

`cJSON.c:364` : le buffer `output_pointer` était utilisé avec une taille hardcodée `5` dans un `snprintf`. Changé pour `sizeof(output_pointer)`.

---

## 30. Guard `NoTracePath` après `LoadSettings()` — crash graphiques console

**Bug :** vina, vina2, Watch_What_Happens crashent (segfault) ou bouclent en mode console sans `--trace`.

**Cause :** `-se.Vina` a `ShowObjectGraph=1`. `SaveLoads1.c:758` force `ShowGraphic=TRUE`. Le guard `NoTracePath` (ligne 704) était commenté. Même décommenté, il ne fonctionne pas car `LoadSettings()` s'exécute AVANT `PrepareTraceDestination()` (qui positionne `NoTracePath`).

**Fix :** Guard dans `ConsoleMain.c` après `PrepareTraceDestination()` :
```c
if(NoTracePath) {
    ShowObjectGraph = ShowPianoRoll = ShowGraphic = FALSE;
}
```
Plus décommentage du guard dans `SaveLoads1.c:704`.

**Suggestion :** Le guard `SaveLoads1.c:704-707` ne devrait pas être commenté (double protection), mais le fix principal est dans `ConsoleMain.c`.

---

## 31. `bp3_random.c/.h` — RNG portable MSVC

**Problème :** `rand()`/`srand()` de glibc (Linux) et MSVC (Windows) produisent des séquences complètement différentes pour le même seed. 6 grammaires avec sélection aléatoire (SUB, RND) divergeaient entre bp.exe et bp3.

**Solution :** Nouveau fichier `bp3_random.c` + `bp3_random.h` implémentant le LCG MSVC :
```c
void bp3_srand(unsigned int seed) { bp3_rng_state = seed; }
int bp3_rand(void) {
    bp3_rng_state = bp3_rng_state * 214013 + 2531011;
    return (bp3_rng_state >> 16) & 0x7fff;
}
#define BP3_RAND_MAX 32767
```

**Fichiers modifiés :** Tous les appels `rand()` → `bp3_rand()`, `srand()` → `bp3_srand()`, `RAND_MAX` → `BP3_RAND_MAX` dans : `Misc.c`, `Compute.c`, `Zouleb.c`, `SetObjectFeatures.c`, `MakeSound.c`, `ScriptUtils.c`. Include via `-BP3.h`.

**Suggestion pour Bernard :** Intégrer `bp3_random.c`/`.h` et les remplacements dans `source/BP3/`. Cela garantit que bp.exe Windows et bp3 Linux/WASM produisent exactement les mêmes séquences aléatoires pour le même seed. Le LCG MSVC est trivial et portable sur toutes les plateformes.

**Résultat :** Score S0=S1 : **26/30 EXACT** (était ~18/30). Les 3 grammaires purement RNG-dépendantes (destru, kss2, asymmetric) sont passées de DIFF → EXACT.

---

## Notes pour référence (mise à jour)

- Build natif testé : v3.3.19 (gcc Linux, Apr 2 2026) — sources = branche wasm + Bernard post-v3.3.18 (2026-03-31)
- Build WASM : même sources, compilées avec Emscripten
- **Score S0=S1 : 26/30 EXACT** — bp3 Linux aligne sur bp.exe Windows (RNG MSVC portable)
- Les 6 anciennes NOTES_DIFF (alan-dice, beatrix-dice, mozart-dice, livecode1, mohanam, ruwet) sont maintenant IDENTICAL — confirmé que c'était le moteur qui avait changé, pas un bug WASM
