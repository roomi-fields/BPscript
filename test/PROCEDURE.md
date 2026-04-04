# Procédure de test — Pipeline grammaire par grammaire

## Principe

Pour chaque grammaire de Bernard, on valide une chaîne de 6 étapes. Chaque étape doit produire les mêmes résultats musicaux que la précédente. La source de vérité est `grammars.json` qui liste toutes les grammaires actives avec leurs paramètres.

## Les 6 étapes

```
S0  PHP bp.exe (Windows)  → référence absolue (MIDI ou texte)
S1  BP3 C natif (Linux)   → MIDI events ou texte (doit = S0)
S2  BP3 WASM              → MIDI events ou texte (doit = S1, même format)
S3  BP3 WASM              → timed tokens bruts (tous tokens avec timing)
S4  BP3 WASM silent       → timed tokens (réécriture silent sound objects)
S5  BPscript              → timed tokens (scène .bps transpilée)
```

## Comparateurs

```
compare_s0_s1.cjs   S0 vs S1 : midi/midi ou text/text (direct)
compare_s1_s2.cjs   S1 vs S2 : midi/midi ou text/text (normalisation enharmonique)
compare_s2_s3.cjs   S2 vs S3 : MIDI events vs timed tokens (normalisation notes + filtrage)
```

## Structure de répertoires

```
test/grammars/
  grammars.json         ← source de vérité (toutes les grammaires, params, statut)
  PROCEDURE.md          ← ce fichier
  RESULTATS.md          ← résultats des comparaisons
  FEEDBACK_BERNARD.md   ← notes et retours de Bernard
  runner.cjs            ← orchestrateur pipeline
  report.cjs            ← génération rapports par grammaire
  parse_midi.py         ← parseur MIDI (utilisé par S0/S1)
  s0_snapshot.cjs       ← S0 : PHP bp.exe → snapshot
  s1_native.cjs         ← S1 : BP3 natif Linux → snapshot
  s2_wasm_orig.cjs      ← S2+S3 : WASM → 2 snapshots (MIDI/text + timed tokens)
  s4_wasm_silent.cjs    ← S4 : WASM silent objects → snapshot
  s5_bpscript.cjs       ← S5 : BPscript → snapshot
  compare_s0_s1.cjs     ← comparateur S0/S1
  compare_s1_s2.cjs     ← comparateur S1/S2
  compare_s2_s3.cjs     ← comparateur S2/S3
  <grammar>/
    silent.gr           ← réécriture silent sound objects (S4)
    silent.al           ← alphabet plat (S4)
    status.json         ← résultat de chaque étape
    snapshots/
      s0_php.json       ← S0 : [name, start, end] ou [name]
      s1_native.json    ← S1 : [name, start, end] ou [name]
      s2_orig.json      ← S2 : [name, start, end] ou [name] (même format que S1)
      s3_timed.json     ← S3 : [name, start, end] timed tokens bruts
      s4_silent.json    ← S4 : [name, start, end] timed tokens
      s5_bps.json       ← S5 : [name, start, end] timed tokens
```

Les fichiers originaux de Bernard (`-gr.xxx`, `-se.xxx`, `-al.xxx`, `-to.xxx`) restent dans `bp3-engine/test-data/`. On ne les copie pas.

---

## S0 : PHP bp.exe (référence)

Le moteur original Windows via MAMP. C'est la source de vérité absolue.

### Commande

```bash
node s0_snapshot.cjs drum        # une grammaire
node s0_snapshot.cjs --all       # toutes les grammaires avec php_ref
```

### Configuration

Les paramètres php_ref sont dans `grammars.json` :
- `php_ref.settings` : fichier -se
- `php_ref.alphabet` : fichier -al
- `php_ref.tonality` : fichier -to (nouveau)

### Format du snapshot

```json
{ "source": "-gr.drum", "stage": "S0", "mode": "midi",
  "tokens": [["C8", 0, 40], ["E7", 0, 39], ...],
  "midi": [[108, 0, 40], [100, 0, 39], ...] }
```

---

## S1 : BP3 C natif (Linux)

Le même moteur C compilé pour Linux. Doit reproduire exactement S0.

### Commande

```bash
node s1_native.cjs drum          # une grammaire
```

Les fichiers auxiliaires sont déterminés par `s1_args` dans grammars.json ou par le header de la grammaire.

### Format du snapshot

Même format que S0. Pour les grammaires MIDI : `[noteName, start, end]`. Pour les grammaires texte : `[name]`.

### Comparaison S0 → S1

`compare_s0_s1.cjs` : comparaison directe, tolérance ±2ms (Windows/Linux float).

---

## S2 : BP3 WASM (même format que S1)

Le moteur C compilé en WebAssembly via Emscripten. La sortie S2 est dans le **même format** que S1 :
- Mode MIDI : MIDI events convertis en `[noteName, start, end]`
- Mode texte : tokens texte `[name]`

### Commande

```bash
node s2_wasm_orig.cjs drum       # génère S2 ET S3
```

Le script produit **deux** snapshots :
- `s2_orig.json` : MIDI events ou texte (comparable à S1)
- `s3_timed.json` : timed tokens bruts (tous tokens avec timing)

### Mode (s1_mode dans grammars.json)

- `midi` : le moteur produit des MIDI events → on extrait les NoteOn/NoteOff
- `text` : le moteur produit du texte → on parse les tokens depuis `getResult()`

### Normalisation enharmonique (S1 vs S2)

S1 natif peut produire F#3 là où S2 WASM produit Gb3 (même note, notation différente). Le comparateur normalise : sharps → flats.

### Comparaison S1 → S2

`compare_s1_s2.cjs` : comparaison midi/midi ou text/text avec normalisation enharmonique.

---

## S3 : WASM timed tokens

Les timed tokens bruts de `bp3_get_timed_tokens()`. Inclut tous les tokens : notes, contrôles (`_chan`, `_vel`...), silences (`-`).

Généré automatiquement par `s2_wasm_orig.cjs` (même run WASM que S2).

### Comparaison S2 → S3

`compare_s2_s3.cjs` : compare MIDI events (S2) vs timed tokens filtrés et normalisés (S3).
- Filtrage : suppression des contrôles et silences
- Normalisation : convention de notes (français→anglais, indien→anglais, enharmoniques)

---

## S4 : WASM silent sound objects (ex-S3)

Réécriture de la grammaire avec des silent sound objects. Les noms des notes restent les mêmes mais sont déclarés dans un alphabet plat. BP3 les traite comme des objets silencieux au lieu de notes MIDI.

### Commande

```bash
node s4_wasm_silent.cjs drum
```

---

## S5 : BPscript (ex-S4)

La scène `.bps` est la traduction BPscript de la grammaire. Elle doit produire une grammaire BP3 identique (ou fonctionnellement équivalente).

### Commande

```bash
node s5_bpscript.cjs drum
```

---

## Exécution

```bash
# Tester une grammaire de bout en bout
node test/grammars/runner.cjs drum

# Vérifier les régressions
node test/grammars/runner.cjs --check

# Afficher le statut
node test/grammars/runner.cjs --status

# Comparaisons globales
node test/grammars/compare_s0_s1.cjs        # tous les S0 vs S1
node test/grammars/compare_s1_s2.cjs        # tous les S1 vs S2
node test/grammars/compare_s2_s3.cjs        # tous les S2 vs S3
node test/grammars/compare_s0_s1.cjs drum   # un seul
```

---

## Conventions

- `grammars.json` est la source de vérité pour les grammaires actives, paramètres, et mode
- Le seed est toujours 1 pour la reproductibilité
- Les comparateurs S0/S1 et S1/S2 ont une tolérance de ±5ms (arrondis float entre plateformes)
- Les enharmoniques sont normalisés (sharps → flats) dans les comparateurs
- Les conventions de notes (français, indien) sont normalisées vers l'anglais dans compare_s2_s3.cjs
