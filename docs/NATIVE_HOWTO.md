# BP3 Moteur Natif — Guide d'utilisation

## Vue d'ensemble

Le moteur BP3 natif est le binaire C compile par Bernard Bel. Il produit
du MIDI et du texte a partir de grammaires BP3. On l'utilise pour :
- **S1** dans le pipeline de test (reference absolue)
- **Comparaison** avec le WASM (validation du portage)
- **Production MIDI** directe

Binaire : `/mnt/d/Claude/bp3-engine/bp3` (Linux ELF x86-64)

---

## Build

```bash
cd /mnt/d/Claude/bp3-engine
make clean && make
# Produit: bp3 (Linux ELF)
```

Le Makefile utilise `source/BP3/*.c`. Nos modifications (PolyExpand iteratif,
`<inf>`) doivent etre dans `source/BP3/`, pas seulement dans `csrc/bp3/` :
```bash
cp csrc/bp3/Polymetric.c source/BP3/Polymetric.c
cp csrc/bp3/CompileProcs.c source/BP3/CompileProcs.c
make clean && make
```

---

## Ligne de commande

```bash
./bp3 produce [options] -gr <grammar_file> [aux_files...]
```

### Options principales

| Option | Description |
|--------|-------------|
| `-gr fname` | Grammaire (obligatoire) |
| `-se fname` | Settings JSON |
| `-al fname` | Alphabet ou homomorphisme (-al. ou -ho.) |
| `-to fname` | Tonalite |
| `-so fname` | Prototypes sound objects (-mi.) |
| `-cs fname` | Instruments Csound |
| `-gl fname` | Glossaire |
| `-D` | Afficher le texte produit sur stdout |
| `-e` | Messages sur stderr (separe du texte) |
| `--midiout fname` | Ecrire un fichier MIDI |
| `--seed N` | Seed du generateur aleatoire |
| `--english` | Convention de notes anglaise (C D E F G A B) |
| `--french` | Convention de notes francaise (do re mi fa sol la si) |
| `--indian` | Convention de notes indienne (sa re ga ma pa dha ni) |
| `--keys` | Convention numerique MIDI (0-127) |

### Exemples

```bash
# Grammaire simple
./bp3 produce -D -e -gr test-data/-gr.drum --seed 1

# Avec MIDI output
./bp3 produce -e --midiout /tmp/drum.mid -gr test-data/-gr.drum --seed 1

# Avec settings JSON
./bp3 produce -e --midiout /tmp/out.mid -gr test-data/-gr.765432 \
  -se test-data/-se.765432 --seed 1 --french

# Avec alphabet/homomorphisme
./bp3 produce -D -e -gr test-data/-gr.dhin -al test-data/-ho.dhati --seed 1
```

---

## Pieges connus

### 1. Segfault avec settings graphiques

`LoadSettings()` force `ShowObjectGraph = TRUE` (ligne 568 de SaveLoads1.c)
avant de lire le JSON. En mode console, le code graphique (`Graphic.c`)
fait `fputs(line, imagePtr)` avec `imagePtr = NULL` → segfault.

**Affecte** : toute grammaire dont le `-se.` est charge via `-se`.

**Solution** : neutraliser les flags graphiques dans le JSON AVANT de le
passer au natif :

```javascript
const o = JSON.parse(seContent);
// ALWAYS add — LoadSettings hardcodes ShowObjectGraph=TRUE
o.ShowGraphic = {name: "Show graphic", value: "0"};
o.ShowPianoRoll = {name: "Show piano roll", value: "0"};
o.ShowObjectGraph = {name: "Show object graph", value: "0"};
const cleanedSe = JSON.stringify(o);
fs.writeFileSync('/tmp/clean_se.json', cleanedSe);
// Puis: ./bp3 produce -se /tmp/clean_se.json ...
```

**Note** : meme si le JSON original contient deja ces cles a "0", il faut
les re-ajouter car `LoadSettings` ecrase avec TRUE avant le parse.

### 2. Les fichiers -se. format texte ne sont pas supportes

Le parser JSON de `LoadSettings()` echoue sur les vieux fichiers texte
(commencant par `//`). Seuls les fichiers JSON (commencant par `{`) passent.
~70% des fichiers -se. dans test-data sont en format texte ancien.

### 3. Les fichiers -ho. format V.x.x

Les fichiers homomorphisme au format BP2.5 (commencant par `V.x.x` puis
`Date:`) ne compilent pas. Le parser d'alphabet crashe sur le caractere
`:` dans la ligne `Date:`.

**Solution** : stripper les lignes `V.x.x` et `Date:` avant de passer
le fichier, ou utiliser un fichier au format `//` (BP2.8+).

### 4. Le retry sans settings dans s1_native.cjs

Le script `s1_native.cjs` (lignes 86-109) retry **sans** `-se` quand le
natif segfault. Ca produit des resultats avec les settings par defaut
(C4key=60, 60 BPM) au lieu des vrais settings → divergence S1 vs S2.

**Solution** : ne PAS retirer le `-se` au retry. Si le natif segfault avec
les settings, marquer S1 comme BLOCKED.

### 5. Le flag -D sur les grammmaires denses

`-D` affiche le texte sur stdout. Pour les grammaires avec polymetrie dense
(livecode2, Visser3), ca genere des dizaines de MB → OOM ou timeout.

**Solution** : pour la production MIDI, ne PAS utiliser `-D`. Utiliser
uniquement `--midiout`.

### 6. Le flag --french/--english est obligatoire

Le natif ne detecte pas automatiquement la convention de notes. Sans
`--french` pour une grammaire francaise, les notes ne sont pas reconnues.

L'auto-detection doit etre faite dans le script :
```javascript
const hasFrench = /\b(do|re|mi|fa|sol|la|si)\d\b/.test(grammarContent);
const hasIndian = /\b(sa|ga)\d\b/.test(grammarContent);
if (hasIndian) args.push('--indian');
else if (hasFrench) args.push('--french');
```

---

## Ordre de chargement

Le natif charge les fichiers dans l'ordre des arguments en ligne de commande.
L'ordre recommande :

```
./bp3 produce -e \
  -se settings.json \     ← settings d'abord (configure le moteur)
  -al alphabet.txt \      ← alphabet (declare les terminaux)
  -to tonality.txt \      ← tonalite (si microtonale)
  -so prototypes.txt \    ← prototypes sound objects (si -mi.)
  -gr grammar.txt \       ← grammaire en dernier (declenche la compilation)
  --midiout output.mid \
  --seed 1 --french
```

En pratique, le natif gere l'ordre automatiquement via `LoadInputFiles()`
qui trie par type de fichier. Mais mettre `-se` avant `-gr` est plus sur.

---

## Codes de retour BP3

```
OK = 1          (pas 0 !)
MISSED = 0
ABORT = -4
```

**Attention** : BP3 retourne 1 pour succes, pas 0 (convention C inversee).
Le binaire retourne 0 au shell dans tous les cas (le code BP3 est interne).

---

## Production MIDI

Le natif produit un fichier MIDI standard via `--midiout`. Le fichier contient :
- NoteOn/NoteOff avec timestamps en ticks
- Tempo events
- Channel assignments

Pour extraire les notes :
```bash
python3 test/grammars/parse_midi.py /tmp/output.mid
# → JSON: {"tokens": [["C4", 0, 1000], ...], "midi": [[60, 0, 1000], ...]}
```

### Comparaison avec le WASM (S1 vs S2)

Le natif produit un fichier `.mid`. Le WASM produit du JSON via
`bp3_get_midi_events()`. Pour comparer :

1. Parser le MIDI natif → `[note, start, end]`
2. Parser le JSON WASM → `[note, start, end]`
3. Comparer les listes triees par start time

Les pitches doivent etre identiques. Les timings doivent etre identiques
(meme moteur C, memes settings) a 1ms pres (arrondis FP).

---

## Settings critiques

| Parametre | Effet | Defaut |
|-----------|-------|--------|
| `NoteConvention` | 0=EN, 1=FR, 2=IN, 3=Keys | 0 |
| `C4key` | Numero MIDI de do3/C4 | 60 |
| `Pclock` / `Qclock` | Tempo = (Qclock*60)/Pclock BPM | 1/1 = 60 BPM |
| `Nature_of_time` | 0=smooth, 1=striated | 1 |
| `Quantization` | Quantisation en ms | 10 |
| `AllItems` | 1=produire tous les items | 0 |
| `MaxItemsProduce` | Limite d'items | 20 |
| `ShowObjectGraph` | Active les graphiques (CRASH en console!) | TRUE |
| `ShowPianoRoll` | Active le piano roll (CRASH en console!) | FALSE |
| `DisplayItems` | Affiche les items produits | TRUE |

---

## Grammaires qui ne fonctionnent pas en natif console

| Grammaire | Probleme |
|-----------|----------|
| Visser3 | Segfault dans TimeSet (polymetrie trop complexe pour FillPhaseDiagram) |
| Grammaires -cs. | Hang sur certains fichiers Csound |
| Grammaires -in. | "unsupported" (interactive MIDI) |
| Grammaires -or. | "Unknown option" (orchestra) |
| Grammaires -se. texte | "Could not parse JSON" |

---

## Fichiers source

| Fichier | Role |
|---------|------|
| `source/BP3/ConsoleMain.c` | Point d'entree, LoadInputFiles, LoadSettings |
| `source/BP3/CompileGrammar.c` | Compilation grammaire + alphabet |
| `source/BP3/CompileProcs.c` | Parsing des poids, flags, `<inf>` |
| `source/BP3/Compute.c` | Derivation (Compute, ComputeInGram) |
| `source/BP3/Polymetric.c` | Expansion polymetrique (PolyExpand iteratif) |
| `source/BP3/FillPhaseDiagram.c` | Phase diagram pour TimeSet |
| `source/BP3/TimeSet.c` | Calcul des timings |
| `source/BP3/SaveLoads1.c` | LoadSettings (JSON), LoadObjectPrototypes |
| `source/BP3/Graphic.c` | Graphiques (fputs segfault si imagePtr=NULL) |
| `source/BP3/Encode.c` | Encodage des regles, homomorphismes |
| `Makefile` | Build natif (gcc, SRCDIR=source/BP3) |
