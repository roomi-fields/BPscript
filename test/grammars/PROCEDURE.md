# Procédure de test — Pipeline grammaire par grammaire

## Principe

Pour chaque grammaire de Bernard (107 dans `bp3-engine/test-data/`), on valide 4 étapes séquentielles. Chaque étape doit produire exactement les mêmes événements temporels que la précédente. On avance des grammaires les plus simples aux plus complexes. Après chaque nouvelle grammaire validée, on relance les précédentes pour détecter les régressions.

## Les 4 étapes

```
S1  BP3 C natif       → référence absolue (MIDI events)
S2  BP3 WASM orig     → timed tokens (même grammaire que S1)
S3  BP3 WASM silent   → timed tokens (réécriture silent sound objects)
S4  BPscript          → timed tokens (scène .bps transpilée)
```

## Structure de répertoires

```
test/grammars/
  PROCEDURE.md          ← ce fichier
  runner.cjs            ← script pipeline
  <grammar>/
    silent.gr           ← réécriture silent sound objects
    silent.al           ← alphabet plat
    status.json         ← résultat de chaque étape
    snapshots/
      s1_native.json    ← [[name, startMs], ...] trié par start time
      s2_orig.json      ← [[name, start, end], ...] timed tokens
      s3_silent.json    ← [[name, start, end], ...] timed tokens
      s4_bps.json       ← [[name, start, end], ...] timed tokens
```

Les fichiers originaux de Bernard (`-gr.xxx`, `-se.xxx`, `-al.xxx`, `-to.xxx`) restent dans `bp3-engine/test-data/`. On ne les copie pas.

---

## S1 : BP3 C natif

### Commande

```bash
cd bp3-engine
./bp3 produce -e --midiout /tmp/output.mid -gr test-data/-gr.xxx --seed 1 [-se test-data/-se.xxx] [-to test-data/-to.xxx]
```

Les fichiers auxiliaires (-se, -to, -al) sont passés s'ils sont référencés dans le header de la grammaire.

### Sortie

Un fichier MIDI. On en extrait les NoteOn events : `[nom_note, start_ms]`. Le script `runner.cjs` parse le MIDI avec un script Python et produit `s1_native.json`.

### Format du snapshot

```json
{ "tokens": [["C8", 0], ["E7", 0], ["E7", 500], ["C7", 1000], ...] }
```

Note : le MIDI ne contient pas les end times (NoteOff sont séparés). On compare uniquement les **start times** entre S1 et S2.

---

## S2 : BP3 WASM avec grammaire originale

### Commande

```javascript
bp3_init()
bp3_load_settings_params(noteConv, quantize, timeRes, natureOfTime, seed, maxTime)
bp3_load_alphabet(content)     // si -al.xxx ou -ho.xxx référencé
bp3_load_tonality(content)     // si -to.xxx référencé ou inféré
bp3_load_grammar(content)      // -gr.xxx tel quel
bp3_produce()
bp3_get_timed_tokens()         // → JSON [{token, start, end}, ...]
```

### Extraction des settings

`bp3_load_settings_params()` prend 6 entiers extraits du fichier -se.xxx :
- `noteConvention` : ligne 10 du format texte plat, ou champ `NoteConvention.value` du JSON
- `quantize` : ligne 5 / `Quantization.value`
- `timeRes` : ligne 6 / `Time_res.value`
- `natureOfTime` : ligne 9 / `Nature_of_time.value`
- `seed` : toujours 1 (reproductibilité)
- `maxTime` : ligne 47 / `MaxConsoleTime.value`

**Important** : ne PAS utiliser `bp3_load_settings()` — elle est cassée (passe du JSON au parser texte plat de Bernard).

### Filtrage des tokens

On filtre les timed tokens pour ne garder que les terminaux sonores :
- Exclure `-` (silences)
- Exclure `&` (ties)
- Exclure `_xxx(...)` (contrôles : `_chan`, `_vel`, `_staccato`, `_script`, `_rest`, etc.)

### Format du snapshot

```json
{ "tokens": [["C8", 0, 40], ["C7", 1000, 1040], ...] }
```

Chaque token est `[nom, start_ms, end_ms]`.

### Comparaison S1 → S2

- Trier les deux listes par start time puis par nom (le MIDI entrelace les voix, les timed tokens les groupent)
- Comparer les **noms** : doivent être identiques
- Comparer les **start times** : doivent être identiques (tolérance 0ms — le même moteur C compilé différemment doit donner le même résultat)
- Les end times ne sont pas comparés (pas disponibles dans le MIDI NoteOn)

---

## S3 : BP3 WASM avec silent sound objects

### Réécriture de la grammaire

Créer `silent.gr` et `silent.al` manuellement pour chaque grammaire :

1. **Structure identique** : polymétrie, sous-grammaires, ratios, modes (ORD/RND/SUB1) — inchangés
2. **Terminaux** : les noms des notes restent les mêmes (C8, E7, etc.) mais sont déclarés dans un alphabet plat (`silent.al`). BP3 les traite comme des silent sound objects au lieu de notes MIDI.
3. **Contrôles temporels** : garder tels quels dans la grammaire
   - `_staccato(N)`, `_legato(N)` → garder (engine, affectent les end times)
   - `_tempo(N)`, `_mm(N)`, `_striated`, `_smooth` → garder (engine)
   - `_rest` → garder (silence indéterminé)
   - `_goto(N,M)`, `_failed(N,M)`, `_repeat(N)`, `_stop` → garder (engine, flux de contrôle)
4. **Contrôles non-temporels** : remplacer par `_script(CTn)`
   - `_chan(N)` → `_script(CTn)` avec `{chan: N}` dans le controlTable
   - `_vel(N)` → `_script(CTn)` avec `{vel: N}`
   - `_pan(N)`, `_pitchbend(N)`, etc. → `_script(CTn)`
5. **Alphabet** : lister tous les terminaux dans `silent.al`, un par ligne

### Commande WASM

Même que S2, mais avec `silent.gr` + `silent.al` au lieu de la grammaire originale.

### Format du snapshot

Même format que S2 : `[nom, start_ms, end_ms]`.

### Comparaison S2 → S3

- Mêmes noms de tokens (on garde les noms originaux)
- Mêmes start times (tolérance 0ms — même moteur, même structure)
- Mêmes end times (tolérance 0ms — staccato/legato traités par le moteur dans les deux cas)

---

## S4 : BPscript

### Traduction de silent.gr vers BPscript

La scène `.bps` dans `scenes/` est la traduction BPscript de la grammaire. Elle doit produire une grammaire BP3 identique (ou fonctionnellement équivalente) à `silent.gr`.

Correspondances :
- `ORD` / `RND` / `SUB1` → `@mode:ordered` / `@mode:random` / `@mode:sub1`
- `gram#1[1] S --> A B C` → `S -> A B C`
- `{A, B, C}` (polymétrie) → `{A, B, C}`
- `{2, A B}` (ratio de vitesse) → `{A B}[speed:2]`
- `_staccato(96)` dans un qualifier → `(staccato:96)`
- `_script(CTn)` avec `{chan:1, vel:120}` → `(chan:1, vel:120)`
- `_tempo(2)` → `[tempo:2]`
- `_mm(60)` → `@mm:60` ou `[mm:60]`
- `_rest` → `...` (silence indéterminé BPscript) — **encodé comme `_rest` dans la grammaire BP3**
- `_goto(3,1)` → `[goto:3,1]`
- Sous-grammaires : séparées par `-----`

### Compilation et exécution

```bash
# Compilation BPscript → grammaire BP3
node --input-type=module -e "
  import { compileBPS } from './src/transpiler/index.js';
  // ... → grammar, alphabetFile, settingsJSON, controlTable
"

# Exécution WASM avec la grammaire compilée
bp3_init()
bp3_load_settings_params(...)
bp3_load_alphabet(compiledAlphabet)
bp3_load_grammar(compiledGrammar)
bp3_produce()
bp3_get_timed_tokens()
```

### Format du snapshot

Même format : `[nom, start_ms, end_ms]`.

### Comparaison S3 → S4

- Mêmes noms de tokens (le transpileur doit produire les mêmes terminaux)
- Mêmes start times (tolérance 0ms en théorie, mais les arrondis de ratios peuvent causer des écarts ≤ 10ms — documentés cas par cas)
- Mêmes end times (tolérance 0ms, sauf si staccato/legato n'est pas encore en mode engine côté transpileur)

---

## Exécution

```bash
# Tester une grammaire de bout en bout
node test/grammars/runner.cjs drum

# Vérifier les régressions sur toutes les grammaires déjà PASS
node test/grammars/runner.cjs --check

# Afficher le statut de toutes les grammaires
node test/grammars/runner.cjs --status
```

---

## Compatibilité des fichiers auxiliaires

### Formats OK (natif + WASM)

| Format | Description | API WASM |
|--------|-------------|----------|
| `-gr.` | Grammaire | `bp3_load_grammar()` |
| `-al.` | Alphabet simple | `bp3_load_alphabet()` |
| `-ho.` format `//` | Homomorphism (BP2.8+, header en commentaire) | `bp3_load_alphabet()` |
| `-ho.` format `V.x.x` | Homomorphism (BP2.5, header legacy) | `bp3_load_alphabet()` après strip `V.x.x`/`Date:` |
| `-ho.` sans header | Homomorphism (commence par `-mi.` ou `*`) | `bp3_load_alphabet()` |
| `-se.` format JSON | Settings (recyclés par l'interface PHP) | `bp3_load_settings_params()` |
| `-to.` | Tonalité | `bp3_load_tonality()` |
| `-tb.` | Time base / patterns | `bp3_provision_file()` |
| `-gl.` | Glossary | `bp3_provision_file()` |
| `-so./-mi.` | Prototypes MIDI (quand -ho. fonctionne) | `bp3_load_object_prototypes()` ou `bp3_provision_file()` |

### Formats KO (natif ET WASM — problèmes moteur BP3)

| Format | Problème | Impact |
|--------|----------|--------|
| `-ho.` format `V.x.x` | `Date:` hors `//` — **contourné en WASM** par strip header, KO en natif v3.3.16 | 11 fichiers sur 38 |
| `-se.` format texte | Format ancien (BP2) → "Could not parse JSON" | ~70% des fichiers settings |
| `-cs.` | Hang (timeout) sur certains fichiers | 13 fichiers |
| `-or.` | Non supporté par la console BP3 ("Unknown option") | 14 fichiers |
| `-in.` | Non supporté par la console BP3 ("unsupported") | 3 fichiers |

Aucun de ces problèmes n'est spécifique au WASM.

---

## Bugs moteur connus

1. **`bp3_load_settings()` cassée** — utiliser `bp3_load_settings_params()`
2. **`_scale()` inopérante sur WASM** — grammaires avec `_scale()` échouent (r=0)
3. **Stack overflow WASM** — grammaires complexes (polymétrie profonde, récursion) — voir `docs/WASM_ISSUE_POLYMAKE_STACK.md`
4. **Noms vides dans timed tokens** — certaines grammaires indiennes (NoteConvention=2)
5. **`_script(CTend)` en suffixe** dans les braces polymétriques → TimeSet ABORT

## Conventions

- Les contrôles **temporels** (staccato, legato, tempo, mm, striated, smooth) sont traités par le moteur BP3 (section `engine` de `lib/controls.json`)
- Les contrôles **sonores** (vel, chan, pan, pitchbend...) sont transportés par `_script(CTn)` pour le dispatcher JS (section `runtime`)
- Le seed est toujours 1 pour la reproductibilité
- La tolérance de comparaison est 0ms par défaut ; les écarts > 0ms sont documentés dans le `status.json` de chaque grammaire
