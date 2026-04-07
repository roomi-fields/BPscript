# Homomorphisms — Post-derivation Label Resolution

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

### Chaînes ordonnées (sans stacking)

Si une section contient une chaîne `C3 --> C4 --> C5`, ne PAS reproduire la chaîne.
Émettre des mappings individuels :
```
OCT
C3 --> 2%C3
C4 --> 2%C4
C5 --> 2%C5
2%C3
2%C4
2%C5
```

La logique de chaîne est dans le REPL, pas dans le fichier -ho.

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
- Ce document (`HOMOMORPHISMS.md`)
- `DESIGN_GRAMMAR.md` — section Templates/Homomorphismes
- [ARCHITECTURE.md](ARCHITECTURE.md) — pipeline avec étape REPL
- `BPSCRIPT_AST.md` — champ `transcriptions` sur TemplateSlave
- `BPSCRIPT_EBNF.md` — déjà correct

---

## Documents liés

- [ARCHITECTURE.md](ARCHITECTURE.md) — Pipeline compile/runtime
- [DESIGN_GRAMMAR.md](../DESIGN_GRAMMAR.md) — Mapping BPscript → BP3
- [INTERFACES_BP3.md](INTERFACES_BP3.md) — Interface WASM
- [REFERENCE_HO_FORMAT.md](../REFERENCE_HO_FORMAT.md) — Format fichiers -ho.
- [BPSCRIPT_EBNF.md](../BPSCRIPT_EBNF.md) — Grammaire formelle (§4.9 Templates)
- [BPSCRIPT_AST.md](../BPSCRIPT_AST.md) — AST (TemplateMaster/Slave)

---
---

## Instructions d'implémentation

### Dépendance inter-agents

```
moteur-wasm tâche 1 (valider % et .)  ──→  BLOQUANT pour transpileur tâche 2+
moteur-wasm tâche 2 (valider stacking)──→  BLOQUANT pour transpileur tâche 6

transpileur tâches 1-4 (compiler)     ──→  moteur-wasm tâche 3 (tester master/slave)
transpileur tâche 5 (REPL)            ──→  indépendant, peut avancer en parallèle
```

**L'agent moteur-wasm commence en premier** avec la validation du format `0.1%a`.
Dès que c'est confirmé, l'agent transpileur peut démarrer.

---

### Agent moteur-wasm

**Aucune modification du moteur WASM n'est nécessaire pour l'étiquetage.**

Le mécanisme repose entièrement sur le fait que BP3 traite les noms de terminaux
comme opaques. Le transpileur génère un fichier -ho. avec des étiquettes (`N%xxx`)
au lieu de vrais noms. BP3 applique `Image()` normalement et émet les étiquettes
dans les timed tokens.

#### Ce qui change

##### 1. Le fichier -ho. aura un format légèrement différent

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

##### 2. Les timed tokens contiendront des étiquettes

`bp3_get_timed_tokens()` retournera des tokens comme `0%dha`, `1%C3`, etc.
Ce sont des terminaux valides — BP3 les a trouvés dans l'alphabet via `Image()`.
Le dispatcher JS les résoudra.

#### Tâche 1 — Valider le caractère `%` et le format `.` dans les noms (BLOQUANT)

Tester que BP3 accepte `0.1%a` comme terminal dans l'alphabet.

Test minimal :

```javascript
bp3_init();
bp3_load_alphabet("*\na\n0.1%a\na --> 0.1%a\n");
// Vérifier : pas d'erreur, terminal 0.1%a reconnu
```

Si `.` ou `%` posent problème → signaler immédiatement à l'architecte.

#### Tâche 2 — Valider le stacking (Image itératif)

Tester que `Image()` chaîné fonctionne : `a → 0.1%a → 0.2%a`.

Test complet :

```
Alphabet (-ho.) :
*
a
b
0.1%a
0.2%a
0.1%b
a --> 0.1%a
0.1%a --> 0.2%a
b --> 0.1%b

Grammaire :
ORD
gram#1[1] S --> (=X) a b * (:X) ** (:X)
```

Résultat attendu dans les timed tokens :
- Master : `a`, `b`
- Premier slave (`*`) : `0.1%a`, `0.1%b`
- Deuxième slave (`**`) : `0.2%a`, `0.1%b` (b n'a pas de profondeur 2)

**Note** : si `b` n'a pas d'entrée pour `0.1%b → 0.2%b`, le deuxième `*`
retourne `0.1%b` inchangé (identité). Vérifier ce comportement.

#### Tâche 3 — Valider master/slave simple (sans stacking)

```
Alphabet :
*
a
b
0.1%a
0.1%b
a --> 0.1%a
b --> 0.1%b

Grammaire :
ORD
gram#1[1] S --> (=X) a b * (:X)
```

Résultat attendu : `a`, `b`, `0.1%a`, `0.1%b`.

#### Tâche 4 — Régression templates existants

Vérifier que les scènes sans transcription ne sont pas cassées :
- `checktemplates`
- `simpletemplates`
- `templates`

#### Ce que tu ne dois PAS faire

- Modifier `bp3_api.c`
- Modifier le code C de Bernard
- Ajouter du code dans le moteur

---

### Agent transpileur

#### Tâche 1 — Parser : capturer les transcriptions entre master/slave

**Fichier** : `src/transpiler/parser.js`

**Quoi** : entre un `$X` (TemplateMaster) et le `&X` (TemplateSlave) correspondant,
il peut y avoir des noms de transcription. Le parser doit les collecter.

**Syntaxe** :
```bpscript
S -> $X tabla_stroke &X       // transcriptions: ["tabla_stroke"]
S -> $X * &X                  // transcriptions: ["*"]
S -> $X ** &X                 // transcriptions: ["**"]
S -> $X * TR &X               // transcriptions: ["*", "TR"]
S -> $X &X                    // transcriptions: null (pas de transcription)
```

**AST attendu** (champ ajouté sur TemplateSlave) :
```
TemplateSlave {
  type: "TemplateSlave",
  name: "X",
  args: null,
  transcriptions: ["tabla_stroke"]    // NOUVEAU — ou null si absent
}
```

**Logique** : quand le parser lit un `&` (slave), il regarde les éléments
RHS déjà parsés depuis le dernier `$` (master) correspondant. Les identifiants
nus (pas des symboles déclarés, pas des non-terminaux) entre les deux sont
des noms de transcription. Le `*` est un identifiant spécial valide.

**Attention** : ne pas confondre avec des terminaux ou non-terminaux légitimes.
Les noms de transcription sont des IDENT simples qui correspondent à des sections
dans `lib/transcription.json` ou `lib/sub.json`. Le parser peut vérifier via
`libCtx.transcriptions` si le nom est une section connue.

**Stacking** : `**` est un token unique signifiant "appliquer * deux fois".
Le parser doit le capturer tel quel. L'encoder se charge de générer les profondeurs.

**Test** : `$X tabla_stroke &X` doit produire un AST avec
`TemplateSlave.transcriptions = ["tabla_stroke"]`.

#### Tâche 2 — Encoder : générer le fichier -ho. avec étiquettes chaînées

**Fichier** : `src/transpiler/encoder.js`, fonction `generateAlphabetFile()`

##### Table d'indices

Construire une table `sectionIndex` pendant la compilation :
```
0 → *        (section par défaut, toujours index 0)
1 → tabla_stroke
2 → TR
3 → OCT
...
```

Les indices sont attribués dans l'ordre d'apparition des sections dans les
transcriptions chargées.

##### Format du fichier -ho. généré

```
// Generated by BPScript
*
bolSa
bolRe
dha
dhin
dha --> 0%dha
dhin --> 0%dhin
0%dha
0%dhin
-----
tabla_stroke
dha --> 1%dha
dhin --> 1%dhin
ge --> 1%ge
1%dha
1%dhin
1%ge
```

**Règles** :
1. Section `*` en premier, contient TOUS les terminaux de la grammaire
2. Chaque section nommée contient les mappings étiquetés + les étiquettes déclarées comme terminaux
3. Les étiquettes elles-mêmes (`N%xxx`) DOIVENT être déclarées comme terminaux
   dans la section pour que BP3 les accepte dans le résultat
4. Séparateur `-----` entre sections

#### Tâche 3 — Encoder : émettre les labels dans la grammaire

**Fichier** : `src/transpiler/encoder.js`, traitement de `TemplateSlave`

**Quoi** : si le slave a des transcriptions, les émettre entre `(=X)` et `(:X)`.

**Avant** (actuel) :
```javascript
case 'TemplateSlave':
  return `(:${el.name})`;
```

**Après** :
```javascript
case 'TemplateSlave':
  const labels = el.transcriptions ? el.transcriptions.join(' ') + ' ' : '';
  return `${labels}(:${el.name})`;
```

Résultat : `$X tabla_stroke &X` → `(=X) tabla_stroke (:X)`

#### Tâche 4 — Encoder : émettre la transcriptionTable

**Fichiers** : `src/transpiler/encoder.js` + `src/transpiler/index.js`

```json
{
  "sections": {
    "0": {
      "name": "*",
      "chains": {
        "a": { "values": ["a", "a'", "a''"], "cyclic": true },
        "b": { "values": ["b", "b'"], "cyclic": false }
      }
    },
    "1": {
      "name": "TR",
      "mappings": { "dha": "ta", "dhin": "tin", "ge": "ke" }
    },
    "2": {
      "name": "OCT",
      "chains": {
        "C3": { "values": ["C3","C4","C5","C6","C7"], "cyclic": false }
      }
    }
  }
}
```

Trois formats de données :
- `mappings` : lookup direct, profondeur 1 uniquement
- `chains` non-cyclique : avancer de `depth` pas, plafonner au dernier
- `chains` cyclique : avancer de `depth % period` pas

Exposer dans la sortie de `compileBPS()` :

```javascript
return { grammar, alphabetFile, controlTable, transcriptionTable, errors };
```

#### Tâche 5 — Dispatcher : résolution REPL post-dérivation

**Fichier** : `src/dispatcher/dispatcher.js`

Après réception des timed tokens, AVANT le strip `bol` et le routing par acteur,
résoudre les étiquettes :

```javascript
function resolveLabels(timedTokens, transcriptionTable) {
  if (!transcriptionTable) return timedTokens;
  return timedTokens.map(tt => {
    const match = tt.token.match(/^(\d+)\.(\d+)%(.+)$/);
    if (!match) return tt;
    const [, sectionStr, depthStr, original] = match;
    const section = transcriptionTable.sections[sectionStr];
    if (!section) return tt;
    const depth = parseInt(depthStr);

    let resolved;
    if (section.chains?.[original]) {
      const chain = section.chains[original];
      const values = chain.values || chain;
      const cyclic = chain.cyclic || false;
      const idx = cyclic ? (depth % values.length) : Math.min(depth, values.length - 1);
      resolved = values[idx];
    } else if (section.mappings?.[original]) {
      // Pour les mappings simples, appliquer depth fois itérativement
      resolved = original;
      for (let i = 0; i < depth; i++) {
        resolved = section.mappings[resolved] || resolved;
      }
    } else {
      resolved = original;
    }
    return { ...tt, token: resolved };
  });
}
```

**Position dans le pipeline** : AVANT `stripBolPrefix()` et AVANT `identifyActor()`.
Les étiquettes ne portent pas le prefix `bol` (elles ont été générées sans).

#### Tâche 6 — Tests

##### Test stacking

Créer `test/grammars/labeling_stack/scene.bps` :

```bpscript
@core
@transcription.checkhomo
gate a:midi
S -> $X * &X ** &X
X -> a
```

Vérifier :
1. Le -ho. contient `a → 0.1%a` ET `0.1%a → 0.2%a`
2. La grammaire contient `(=X) * (:X) ** (:X)`
3. Les timed tokens BP3 contiennent `a`, `0.1%a`, `0.2%a`
4. Après résolution REPL : `a`, `a'`, `a''`

##### Test simple

Créer `test/grammars/labeling/scene.bps` :

```bpscript
@core
@transcription.checkhomo

gate a:midi
gate b:midi

S -> $X * &X
X -> a b
```

Vérifier :
1. Le fichier -ho. contient `a --> 0%a` (pas `a --> a'`)
2. La grammaire contient `(=X) * (:X)`
3. Les timed tokens de BP3 contiennent `0%a` et `0%b`
4. Après résolution REPL : `a'` et `b'`

##### Scènes existantes

Scènes à valider : `checkhomo`, `dhati`, `ruwet`

#### Ordre d'exécution recommandé

1. Parser (tâche 1) — car l'encoder en dépend
2. Encoder -ho. (tâche 2) — coeur du mécanisme
3. Encoder grammaire (tâche 3) — émission des labels
4. transcriptionTable (tâche 4) — sortie pour le REPL
5. Dispatcher REPL (tâche 5) — résolution
6. Tests (tâche 6) — validation end-to-end

---

## Références

- [ARCHITECTURE.md](ARCHITECTURE.md) — Pipeline compile/runtime
- [INTERFACES_BP3.md](INTERFACES_BP3.md) — Interface WASM in/out
- [REFERENCE_HO_FORMAT.md](../REFERENCE_HO_FORMAT.md) — Format fichier -ho. BP3
- [BPSCRIPT_AST.md](../BPSCRIPT_AST.md) — AST (champ `transcriptions` sur TemplateSlave)
- `lib/transcription.json` — Tables de transcription existantes
- `wasm/bp3_api.c` — API WASM (ne pas modifier)
