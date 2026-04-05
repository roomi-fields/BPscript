# Architecture : Homomorphismes par étiquetage

Version 2.0 — 26 mars 2026

## Principe fondamental

BP3 est un **ordonnanceur temporel pur**. Il gère la structure (durées, polymétrie,
contraintes master/slave). Il ne gère **jamais** le contenu des objets temporels.

Les homomorphismes BP3 actuels violent ce principe : le moteur connaît les tables
de transformation de noms (`dha → ta`). L'étiquetage corrige ça en séparant :

- **BP3** : contrainte structurelle + étiquetage opaque
- **REPL** : résolution sémantique des étiquettes (post-dérivation)

---

## Fonctionnement réel des homomorphismes BP3

Source : analyse du code C de Bernard + échanges directs.

### Syntaxe

L'homomorphisme `*` est un **opérateur préfixe** sur une expression parenthésée
(master ou slave).

```
* (= content)       appliquer * une fois au contenu du master
* (: name)          appliquer * une fois au slave (qui pointe vers le master)
** (: name)         appliquer * deux fois
*** (: name)        appliquer * trois fois
```

Exemples avec l'alphabet :
```
*
a --> a' --> a'' --> a     (cyclique, période 3)
b --> b'
c                          (identité — pas de mapping)
```

```
S --> a * (= a') * * (= a) * (= a') * b (= a c)
→ produit : a a' a'' a'' b a' c
```

```
S --> (= A) * (: A) ** (: A) * B (= A C)
A → a,  B → b,  C → c
→ produit : a a' a'' b a' c
```

### Points clés (confirmés par Bernard)

1. `*` est un préfixe qui s'applique au `(=...)` ou `(:...)` suivant
2. Les `*` s'empilent : `**` = appliquer deux fois, `***` = trois fois
3. L'image d'un terminal non mappé est lui-même (identité pour `c`)
4. Les chaînes peuvent être cycliques (`a → a' → a'' → a`)
5. Le remplacement se fait **à la fin de la production** (`SearchOrigin()` dans
   `DisplayArg.c`), pas pendant la dérivation
6. Le slave `(:A)` contient un **pointeur** vers le master `(=A)`, pas une copie
7. Les homomorphismes ne jouent **aucun rôle** dans les choix de règles ni
   dans la structure temporelle
8. `Image()` est appliqué **itérativement** : `** (: A)` → `Image(Image(a))`

---

## Mécanisme d'étiquetage

### Le problème du stacking

L'étiquetage simple `Image(a) = 0%a` ne suffit pas pour `**` :

```
* (: A)   →  Image(a)         = 0%a     ← OK
** (: A)  →  Image(Image(a))  = Image(0%a) = ???   ← pas d'entrée !
```

Le deuxième `*` cherche `0%a` dans la table et ne le trouve pas.

### Solution : profondeur dans l'étiquette

Le format encode la section ET la profondeur d'application :

```
{sectionIndex}.{depth}%{terminal_original}
```

- `sectionIndex` : entier identifiant la section (0 = `*` défaut, 1+ = nommés)
- `depth` : nombre d'applications de l'homomorphisme
- `%` : séparateur
- `terminal_original` : le terminal source, inchangé

Le fichier -ho. chaîne les profondeurs :

```
*
a
0.1%a
0.2%a
0.3%a
a --> 0.1%a
0.1%a --> 0.2%a
0.2%a --> 0.3%a
```

BP3 applique `Image()` itérativement :
- `* (: A)` avec A→a : `Image(a) = 0.1%a` → timed token `0.1%a`
- `** (: A)` : `Image(Image(a)) = Image(0.1%a) = 0.2%a` → timed token `0.2%a`
- `*** (: A)` : `Image(0.2%a) = 0.3%a` → timed token `0.3%a`

Le REPL voit `0.2%a`, parse `section=0, depth=2, terminal=a`, consulte la chaîne
`[a, a', a'', a]`, avance de 2 pas → résout en `a''`.

### Profondeur maximale

Déterminée par la longueur de la chaîne dans l'alphabet :
- `a --> a' --> a'' --> a` → période 3, profondeur max = 3
- `C3 --> C4 --> C5 --> C6 --> C7` → longueur 5, profondeur max = 4
- `dha --> ta` → longueur 2, profondeur max = 1

Le transpileur connaît les chaînes (elles viennent de `transcription.json`)
et génère les entrées pour toutes les profondeurs.

**Choix du séparateur** : `@` éliminé (directive BPscript), `'`/`"` éliminés
(terminaux transformés `a'`, `a"`), `#` éliminé (contexte négatif).
`%` est le seul caractère autorisé par BP3 et libre en BPscript.

### Exemples

| Expression BP3 | Profondeur | Étiquette | REPL résout |
|----------------|-----------|-----------|-------------|
| `* (= a)` | 1 | `0.1%a` | chaîne pas 1 → `a'` |
| `** (= a)` | 2 | `0.2%a` | chaîne pas 2 → `a''` |
| `*** (= a)` | 3 | `0.3%a` | chaîne pas 3 → `a` (cyclique) |
| `* (= dha)` section TR | 1 | `1.1%dha` | mapping → `ta` |
| `* (= c)` | 1 | identité | `c` (pas de mapping, pas d'étiquette) |

### Contrainte BOLSIZE

BP3 limite les terminaux à 30 caractères.

Budget : `{index}.{depth}%` = 4-5 chars + terminal.

| Cas | Étiquette | Longueur |
|-----|-----------|----------|
| `0.1%a` | simple | 5 |
| `1.1%bolC4` | note | 10 |
| `0.2%dhatidhagedheenagena` | tabla long | 26 |
| `0.3%boldhatidhagedheenagena` | pire cas | 29 |

Passe sous 30 dans tous les cas pratiques.

---

## Génération du fichier -ho. (encoder)

### Section par défaut (`*`)

Contient :
1. Tous les terminaux de la grammaire (déclaration d'alphabet)
2. Les étiquettes à toutes les profondeurs pour chaque terminal mappé
3. Les chaînes d'étiquettes (chaque profondeur pointe vers la suivante)

```
*
bolSa
bolRe
dha
dhin
ge
0.1%dha
0.2%dha
0.1%dhin
dha --> 0.1%dha
0.1%dha --> 0.2%dha
dhin --> 0.1%dhin
ge --> 0.1%ge
0.1%ge
```

**Important** : les étiquettes elles-mêmes (`0.1%dha`, etc.) DOIVENT être
déclarées comme terminaux dans l'alphabet pour que BP3 les accepte.

### Sections nommées

```
-----
TR
dha --> 1.1%dha
dhin --> 1.1%dhin
1.1%dha
1.1%dhin
-----
OCT
C3 --> 2.1%C3
C4 --> 2.1%C4
2.1%C3 --> 2.2%C3
2.2%C3 --> 2.3%C3
2.1%C3
2.2%C3
2.3%C3
2.1%C4
```

### Chaînes ordonnées / cycliques

Alphabet original :
```
*
a --> a' --> a'' --> a
```

Chaîne de période 3. Profondeurs 1, 2, 3 :

```
*
a
0.1%a
0.2%a
0.3%a
a --> 0.1%a
0.1%a --> 0.2%a
0.2%a --> 0.3%a
```

REPL : chaîne `[a, a', a'', a]` (cyclique)
- `0.1%a` → pas 1 → `a'`
- `0.2%a` → pas 2 → `a''`
- `0.3%a` → pas 3 → `a` (retour au début)

### Terminaux sans mapping (identité)

Si un terminal `c` n'a pas de mapping dans la section, aucune entrée n'est
générée. `Image(c)` retourne `c` inchangé. Le REPL ne voit pas d'étiquette,
pas de transformation.

---

## Résolution REPL (post-dérivation)

### Entrée

Timed tokens de BP3 : `[{token: "0.2%a", start: 2000, end: 3000}, ...]`

### Algorithme

```
Pour chaque timed token :
  1. Parser le token : match /^(\d+)\.(\d+)%(.+)$/
     → sectionIndex, depth, originalTerminal
  2. Si pas de match : token inchangé (pas une étiquette)
  3. Consulter transcriptionTable.sections[sectionIndex]
  4. Résoudre :
     - Si section.chains[originalTerminal] existe :
         chaîne = section.chains[originalTerminal]
         résultat = chaîne[depth % chaîne.length]  (modulo pour cyclique)
     - Si section.mappings[originalTerminal] existe :
         résultat = section.mappings[originalTerminal]
         (depth > 1 : ré-appliquer le mapping itérativement)
     - Sinon : résultat = originalTerminal (identité)
  5. Remplacer le token par le résultat
```

### Sortie

Timed tokens avec noms résolus, prêts pour le resolver pitch / transport.

### transcriptionTable (émise par l'encoder)

```json
{
  "sections": {
    "0": {
      "name": "*",
      "chains": {
        "a": ["a", "a'", "a''"],
        "b": ["b", "b'"]
      }
    },
    "1": {
      "name": "TR",
      "mappings": { "dha": "ta", "dhin": "tin", "ge": "ke" }
    },
    "2": {
      "name": "OCT",
      "chains": {
        "C3": ["C3", "C4", "C5", "C6", "C7"]
      }
    }
  }
}
```

Pour les chaînes cycliques, la propriété `cyclic: true` peut être ajoutée :
```json
"a": { "values": ["a", "a'", "a''"], "cyclic": true }
```

Le REPL utilise `depth % length` pour les chaînes cycliques.

---

## Impact sur le pipeline

### Pipeline avec étiquetage

```
Source .bps → Tokenizer → Parser → Encoder → { grammar, alphabetFile, controlTable,
                                                transcriptionTable }       ← NOUVEAU
                                                       ↓
                                               BP3 WASM (dérivation)
                                                       ↓
                                               timed tokens (avec étiquettes N.D%xxx)
                                                       ↓
                                               REPL : résolution des étiquettes  ← NOUVEAU
                                                       ↓
                                               timed tokens (noms résolus)
                                                       ↓
                                               Dispatcher → Transport
```

---

## Syntaxe BP3 des homomorphismes (référence)

D'après Bernard, la syntaxe BP3 réelle est :

```
* (= content)              master avec * appliqué une fois
* (: name)                 slave avec * appliqué une fois
** (: name)                slave avec * appliqué deux fois
*** (: name)               slave avec * appliqué trois fois
* (= * (= A))             nesting explicite (équivalent de **)
```

Le `*` (ou nom d'homomorphisme) est un **préfixe** sur le `(=...)` ou `(:...)`.
Il s'empile par concaténation (`**`) ou par nesting (`* (= * (= ...))`).

### Correspondance BPscript → BP3

```bpscript
S -> $X * &X                →  S --> (= X) * (: X)
S -> $X ** &X               →  S --> (= X) ** (: X)
S -> $X TR &X               →  S --> (= X) TR (: X)
S -> $X * TR &X             →  S --> (= X) * TR (: X)
```

---

## Cas couverts

| Cas | Fichier -ho. | BP3 émet | REPL résout |
|-----|-------------|----------|-------------|
| Simple `* (= dha)` | `dha → 0.1%dha` | `0.1%dha` | → `ta` |
| Double `** (= a)` | `a → 0.1%a`, `0.1%a → 0.2%a` | `0.2%a` | → `a''` |
| Triple cyclique `*** (= a)` | + `0.2%a → 0.3%a` | `0.3%a` | → `a` |
| Identité `* (= c)` | pas d'entrée | `c` | inchangé |
| Section nommée `TR (= dha)` | `dha → 1.1%dha` | `1.1%dha` | → `ta` |
| Chaîne ordonnée `OCT (= C3)` | `C3 → 2.1%C3` | `2.1%C3` | → `C4` |

### Cas non couvert (hors scope Phase 1)

- Homomorphismes dynamiques (calculés par code externe) → Phase 3 (callback)
- Transpositions paramétriques (degree+N, step+N) → backlog

---

## Fichiers impactés

### Transpileur (agent `transpileur`)
- `src/transpiler/parser.js` — capturer le label de transcription dans l'AST
- `src/transpiler/encoder.js` — générer le -ho. avec étiquettes chainées + transcriptionTable
- `src/transpiler/index.js` — exposer transcriptionTable dans la sortie de compileBPS()
- `src/transpiler/libs.js` — charger @transcription depuis transcription.json

### Runtime (agent `transpileur`)
- `src/dispatcher/dispatcher.js` — résolution REPL post-dérivation

### Moteur WASM (agent `moteur-wasm`)
- **Aucun changement.** C'est le point.

### Données
- `lib/transcription.json` — existe déjà, format OK
- `lib/sub.json` — compatibilité arrière (tables compilées Bernard)

### Tests
- Scènes à valider : `checkhomo`, `dhati`, `ruwet`
- Nouveau test : `test/grammars/labeling/` — test unitaire du stacking

### Docs (agent `architecte`)
- Ce document (`DESIGN_HOMOMORPHISM_LABELING.md`)
- `DESIGN_GRAMMAR.md` — section Templates/Homomorphismes
- `DESIGN_ARCHITECTURE.md` — pipeline avec étape REPL
- `BPSCRIPT_AST.md` — champ `transcriptions` sur TemplateSlave
- `BPSCRIPT_EBNF.md` — déjà correct

---

## Documents liés

- [DESIGN_ARCHITECTURE.md](DESIGN_ARCHITECTURE.md) — Pipeline compile/runtime
- [DESIGN_GRAMMAR.md](DESIGN_GRAMMAR.md) — Mapping BPscript → BP3
- [DESIGN_INTERFACES_BP3.md](DESIGN_INTERFACES_BP3.md) — Interface WASM
- [REFERENCE_HO_FORMAT.md](REFERENCE_HO_FORMAT.md) — Format fichiers -ho.
- [BPSCRIPT_EBNF.md](BPSCRIPT_EBNF.md) — Grammaire formelle (§4.9 Templates)
- [BPSCRIPT_AST.md](BPSCRIPT_AST.md) — AST (TemplateMaster/Slave)
