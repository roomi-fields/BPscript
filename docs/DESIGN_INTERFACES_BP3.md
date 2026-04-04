# Interface BP3 WASM — Spécification in/out

Version 1.0 — mars 2026

Ce document spécifie l'interface complète entre BPscript (JavaScript) et le moteur BP3 (WebAssembly). C'est le contrat entre le transpileur/dispatcher et le moteur d'ordonnancement.

## Principe

BP3 est un **ordonnanceur symbolique pur**. Il reçoit des noms, les dérive selon les règles de grammaire, résout la polymétrie, et retourne les noms horodatés. Il ne sait pas ce que les noms signifient — pas de MIDI, pas de son, pas d'interprétation.

```
BPscript transpileur
        │
        ▼
┌─────────────────────────────────────┐
│  ENTRÉES (JavaScript → WASM)        │
│                                     │
│  alphabet : liste de noms           │
│  grammaire : règles de dérivation   │
│  settings : tempo, seed, etc.       │
│                                     │
├─────────────────────────────────────┤
│  MOTEUR BP3 WASM                    │
│                                     │
│  Dérivation + polymétrie + timing   │
│  Silent sound objects (auto)        │
│                                     │
├─────────────────────────────────────┤
│  SORTIES (WASM → JavaScript)        │
│                                     │
│  timed tokens : noms + timestamps   │
│  texte : résultat de dérivation     │
│  messages : erreurs, warnings       │
│                                     │
└─────────────────────────────────────┘
        │
        ▼
BPscript dispatcher (routage → transports)
```

---

## Entrées

### 1. Initialisation — `bp3_init()`

```javascript
const init = bp3.cwrap('bp3_init', 'number', []);
init();  // retourne 0 = OK, <0 = erreur
```

**Obligatoire** avant chaque cycle de production. Reset complet : alphabet, grammaire, état de compilation, compteurs, buffers.

Les silent sound objects sont créés à la volée par `FillPhaseDiagram` — pas besoin de les déclarer explicitement.

### 2. Alphabet — `bp3_load_alphabet(text)`

```javascript
const loadAlphabet = bp3.cwrap('bp3_load_alphabet', 'number', ['string']);
loadAlphabet("C4\nD4\nE4\nenv1\nKick\n");
```

**Format** : un terminal par ligne, terminé par `\n`. Pas de `OCT`, pas de `-->`.

**Nommage** : tous les caractères alphanumériques + `#`, `@`, `%`, `'`, `"`. Refusés : `_` (silence BP3), `-` (silence), `.`, `^`, `~`, `!`, `*`, `+`.

Les noms de notes standard (`C4`, `sa4`, `re4`, `do3`) fonctionnent directement — BP3 les traite comme des silent sound objects, pas comme des notes MIDI.

**Variables** : les symboles commençant par une majuscule qui apparaissent en LHS d'une règle sont des variables (non-terminaux). Ils n'ont pas besoin d'être dans l'alphabet. Les variables non-remplacées en fin de dérivation sont **préservées** dans la sortie comme des terminaux horodatés.

### 3. Grammaire — `bp3_load_grammar(text)`

```javascript
const loadGrammar = bp3.cwrap('bp3_load_grammar', 'number', ['string']);
loadGrammar("ORD\ngram#1[1] S --> C4 D4 E4\n");
```

**Format** : format standard BP3 (`-gr.`).

Structure :
```
MODE                           // ORD, RND, SUB1, LIN, etc.
gram#N[M] LHS --> RHS          // règles
-----                          // séparateur de sous-grammaire
MODE
gram#N[M] LHS --> RHS
```

**Éléments reconnus dans le RHS** :
- Terminaux (déclarés dans l'alphabet) : `C4`, `env1`, `Kick`
- Variables (non-terminaux, majuscule) : `S`, `Bass`, `Arp1`
- Silences : `-` (= 1 beat), `- - -` (= 3 beats)
- Prolongation : `_` (étend le terminal précédent)
- Fractions : `3/4` (= silence de durée 3/4 beat)
- Polymétrie : `{voix1, voix2}`
- Contrôles BP3 : `_tempo(2)`, `_mm(120)`, `_scale(...)`, `_script(CTn)`
- Out-time objects : `<<symbol>>` (durée 0, hors-temps)

**Contrôles traduits par le transpileur** :

| BPscript | BP3 |
|----------|-----|
| `[mode:random]` | `RND` (mode de sous-grammaire) |
| `[weight:50]` | `<50>` |
| `[/2]` | `/2` (opérateur temporel) |
| `@tempo:120` ou `@mm:120` | `_mm(120)` |
| `(vel:100)` | `_script(CTn)` (passé au dispatcher) |

### 4. Settings — `bp3_load_settings(json)` ou `bp3_load_settings_params(...)`

```javascript
// Option A : JSON BP3 (fichier -se.xxx)
const loadSettings = bp3.cwrap('bp3_load_settings', 'number', ['string']);
loadSettings(jsonContent);

// Option B : paramètres directs
const loadSettingsParams = bp3.cwrap('bp3_load_settings_params', 'number',
    ['number', 'number', 'number', 'number', 'number', 'number']);
loadSettingsParams(noteConvention, quantize, timeRes, natureOfTime, seed, maxTime);
```

**Paramètres de `loadSettingsParams`** :

| Paramètre | Description | Défaut |
|-----------|-------------|--------|
| `noteConvention` | 0=English, 1=French, 2=Indian | 0 |
| `quantize` | Quantization en ms | 0 |
| `timeRes` | Résolution temporelle en ms | 10 |
| `natureOfTime` | 0=smooth, 1=striated | 1 |
| `seed` | Random seed (0 = ne pas changer) | 0 |
| `maxTime` | Temps max de calcul en secondes (0 = illimité) | 0 |

### 5. Prototypes (optionnel) — `bp3_load_prototypes(content)`

```javascript
const loadPrototypes = bp3.cwrap('bp3_load_prototypes', 'number', ['string']);
loadPrototypes(soFileContent);
```

**Normalement inutile** avec les silent sound objects. Utile seulement pour charger de vrais prototypes MIDI de Bernard (fichiers `-so.xxx`).

### 6. Tonalité (optionnel) — `bp3_load_tonality(content)`

```javascript
const loadTonality = bp3.cwrap('bp3_load_tonality', 'number', ['string']);
loadTonality(toFileContent);
```

Pour les gammes microtonales. Format : fichier `-to.xxx` standard BP3.

---

## Production — `bp3_produce()`

```javascript
const produce = bp3.cwrap('bp3_produce', 'number', []);
const result = produce();
// 1 = OK, 0 = MISS (dérivation échouée), <0 = erreur
```

Dérive la grammaire, résout la polymétrie, calcule les timestamps. Les résultats sont disponibles via les fonctions de sortie.

---

## Sorties

### 1. Timed tokens — `bp3_get_timed_tokens()` ⭐ sortie principale (feuilles)

> **Note** : cette sortie est une liste plate — l'arbre structurel (polymétrie,
> proportions, contraintes) n'est pas exposé. Voir
> [DESIGN_TEMPORAL_DEFORMATION.md](DESIGN_TEMPORAL_DEFORMATION.md) pour la vision
> d'une sortie `bp3_get_structure_tree()` complémentaire.

```javascript
const getTimedTokens = bp3.cwrap('bp3_get_timed_tokens', 'string', []);
const tokens = JSON.parse(getTimedTokens());
```

**Format JSON** :
```json
[
  {"token": "_script(CT0)", "start": 0,    "end": 0},
  {"token": "C4",           "start": 0,    "end": 1000},
  {"token": "-",            "start": 1000, "end": 2000},
  {"token": "D4",           "start": 2000, "end": 3000},
  {"token": "env1",         "start": 0,    "end": 1000}
]
```

**Types de tokens** :

| Type | `start` vs `end` | Exemple |
|------|-------------------|---------|
| Terminal (note, CV, drum) | `start < end` (durée = beat) | `C4:0-1000` |
| Silence | `start < end` (durée du gap) | `-:1000-2000` |
| Contrôle (`_script`, `_tempo`) | `start == end` (instantané) | `_script(CT0):0-0` |
| Out-time object (`<<x>>`) | `start == end` | `?:0-0` |
| Variable préservée | `start < end` (durée = beat) | `Truc:0-1000` |

**Durées** : relatives au tempo.
- 60 BPM → 1000ms/beat
- 120 BPM → 500ms/beat
- `_tempo(2)` → divise par 2 les durées suivantes

**Silences** : détectés comme des gaps temporels entre deux objets consécutifs. Les doubles silences (`- -`) sont fusionnés en un seul gap.

**Contrôles `_script(CTn)`** : le transpileur maintient une table de mapping `CTn → { scope, params }`. Le dispatcher combine les timestamps avec cette table.

### 2. Texte — `bp3_get_result()`

```javascript
const getResult = bp3.cwrap('bp3_get_result', 'string', []);
const text = getResult();
// → "C4 D4 - E4" ou "{C4 D4, env1 env1}"
```

Le résultat textuel de la dérivation. Contient les mêmes tokens que les timed tokens mais sans timestamps. Utile pour le debug et l'affichage.

### 3. Messages — `bp3_get_messages()`

```javascript
const getMessages = bp3.cwrap('bp3_get_messages', 'string', []);
const messages = getMessages();
```

Contient les messages de compilation et de production : erreurs, warnings, trace. Le format est du texte libre. Chercher `Errors: N` pour le nombre d'erreurs.

### 4. Événements MIDI — `bp3_get_midi_events()` (legacy)

```javascript
const getMidiEvents = bp3.cwrap('bp3_get_midi_events', 'string', []);
const getMidiCount = bp3.cwrap('bp3_get_midi_event_count', 'number', []);
```

**Non utilisé dans le modèle silent sound objects.** Retourne 0 événements quand l'alphabet est plat (pas de OCT). Conservé pour compatibilité avec les grammaires classiques de Bernard.

---

## Flux d'appels

### Cycle standard

```javascript
bp3_init();                           // 1. Reset
bp3_load_alphabet("C4\nD4\nenv1\n");  // 2. Alphabet plat
bp3_load_grammar(grammarText);        // 3. Grammaire BP3
bp3_produce();                        // 4. Dérivation + timing
const tokens = JSON.parse(
    bp3_get_timed_tokens()            // 5. Récupérer les tokens horodatés
);
```

### Reseed (même grammaire, seed différent)

```javascript
// Cycle 1
bp3_init();
bp3_load_alphabet(al);
bp3_load_grammar(gr);
bp3_produce();
getTimedTokens();

// Cycle 2 — PAS de bp3_init()
bp3_load_settings_params(0, 10, 10, 1, 42, 0);  // nouveau seed
bp3_produce();                                    // même grammaire
getTimedTokens();
```

### Multi-cycle (grammaires différentes)

```javascript
for (const scene of scenes) {
    bp3_init();                    // obligatoire entre chaque scène
    bp3_load_alphabet(scene.al);
    bp3_load_grammar(scene.gr);
    bp3_produce();
    dispatch(getTimedTokens());
}
```

---

## Limitations connues

### vina3 — stack overflow JS

La grammaire vina3 (5 sous-grammaires, gamakas) provoque "Maximum call stack size exceeded" en WASM. Limitation fondamentale de la récursion WASM→JS.

### Ties (`&`) sur silent sound objects

`z& a &z` ne fonctionne pas correctement — Bernard a signalé que les prolongations/liaisons sur les silent sound objects sont difficiles à implémenter. Contournement : utiliser `_` (prolongation) à la place.

### Variables entre `||`

Les variables commençant par une minuscule doivent être entre `|barres|` dans la grammaire BP3 : `|maVariable|`. Le transpileur doit les wrapper.

---

## Valeurs de retour BP3

| Constante | Valeur | Signification |
|-----------|--------|---------------|
| `OK` | 1 | Succès |
| `MISSED` | 0 | Dérivation échouée (pas de règle applicable) |
| `ABORT` | -4 | Erreur fatale |
| `TRUE` | 1 | |
| `FALSE` | 0 | |

**Attention** : `OK = 1`, pas 0 comme en C standard. `bp3_init()` retourne 0 pour OK (convention WASM), pas 1.
