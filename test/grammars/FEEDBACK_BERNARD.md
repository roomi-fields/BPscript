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

## Notes pour référence

- Build natif testé : v3.3.16 (gcc Linux, Mar 23 2026)
- Build WASM : bp3-engine branche wasm (v3.3.15 + portage)
- Interface settings WASM : `bp3_load_settings_params(noteConv, quantize, timeRes, natureOfTime, seed, maxTime)` — 6 paramètres seulement
- `bp3_load_settings()` WASM est cassée (passe du JSON au parser texte plat)
- Fichier `settings_names.tab` reçu de Bernard avec le mapping complet des 84 paramètres

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

## 13. `<°>` poids infini non supporté en natif 3.3.17

La grammaire `-gr.Nadaka-1er-essai` utilise `<°>` (degree sign, U+00B0) comme poids infini sur les règles LIN. Le natif 3.3.17 produit `Error code 20: incorrect weight` sur toutes les règles avec `<°>`. Le WASM aussi.

C'est probablement un problème d'encodage UTF-8 du caractère `°`. Dans les anciennes versions de Bernard ça fonctionnait peut-être en MacRoman.

---

## 14. `-gr.Nadaka-1er-essai` (anciennement `-gr.hamsad`) — variable `A8` non définie

La grammaire produit `A8 A8 A8 A8` sur les deux moteurs (natif 3.3.17 et WASM) avec le message `Undefined variable(s) found and ignored: A8`.

La sous-grammaire 1 fait :
```
S --> A32
A32 --> A8 A8 A8 A8
```

Mais `A8` n'est défini par aucune règle. La sous-grammaire 2 (LIN avec `<inf>`) substitue `G`, `P`, `N`, `R`, `S` en notes indiennes (`ga4`, `pa4`, etc.) mais ces variables n'apparaissent jamais dans le flux car `A8` n'est pas développé.

Il manque probablement des règles du type `A8 --> G P N R G S G P` dans la sous-grammaire 1 pour que les règles LIN de la sous-grammaire 2 puissent s'appliquer.

Note : `<°>` a été remplacé par `<inf>` dans le fichier (l'ancien format BP2 n'est plus supporté).
