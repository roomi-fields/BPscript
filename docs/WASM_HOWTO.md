# BP3 WASM Engine — Guide d'utilisation

## Vue d'ensemble

Le moteur BP3 de Bernard Bel est compile en WebAssembly via Emscripten.
Il expose une API JavaScript pour charger des grammaires, des settings,
des alphabets, et produire des sequences temporelles.

```
Source C (Bernard)     Couche WASM (portage)     JavaScript
bp3-engine/csrc/bp3/   wasm/bp3_api.c            require('bp3.js')
  30+ fichiers .c        wasm/bp3_wasm_stubs.c     .then(M => ...)
  CompileGrammar.c       wasm/bp3_wasm_platform.h
  Compute.c              wasm/Makefile.emscripten
  Polymetric.c
  ...
```

Artefacts de build : `dist/bp3.js` + `dist/bp3.wasm` + `dist/bp3.data`

---

## Build

```bash
# Prerequis : Emscripten SDK
source /mnt/d/Claude/emsdk/emsdk_env.sh

# Build WASM depuis les sources BP3
cd /mnt/d/Claude/BPscript
make -f wasm/Makefile.emscripten \
  BP3_SRC=/mnt/d/Claude/bp3-engine/csrc/bp3 \
  WASM_SRC=wasm \
  BUILD_DIR=dist \
  clean all

# Build natif (pour comparaison)
cd /mnt/d/Claude/bp3-engine
make clean && make
# Produit: bp3 (Linux ELF)
```

---

## Chargement du module

### Node.js
```javascript
const path = require('path');
process.chdir('/path/to/dist');
require('./bp3.js')().then(function(M) {
  // M est le module Emscripten
  var init = M.cwrap('bp3_init', 'number', []);
  var loadGr = M.cwrap('bp3_load_grammar', 'number', ['string']);
  // ... etc
});
```

### Navigateur
```html
<script src="bp3.js"></script>
<script>
BP3Module().then(function(M) {
  // meme API que Node.js
});
</script>
```

---

## API — Reference complete

### Initialisation

#### `bp3_init() → int`
Initialise le moteur. Doit etre appele avant toute autre fonction.
Peut etre appele plusieurs fois (reinitialise l'etat entre les productions).

Retourne : 0 = OK, -1 = echec Inits(), -2 = echec allocation MIDI.

```javascript
var init = M.cwrap('bp3_init', 'number', []);
init();
```

---

### Chargement des donnees

#### `bp3_load_settings(json) → int`
Charge les settings complets depuis le format JSON de Bernard (84+ parametres).
Parse avec cJSON. Affecte tous les parametres C correspondants : AllItems,
MaxItemsProduce, Quantize, NatureOfTime, Improvize, etc.

**Ne fonctionne qu'avec les fichiers JSON** (commencant par `{`).
Les fichiers texte ancien (commencant par `//`) ne sont pas supportes.

Retourne : 0 = OK, -1 = vide, -2 = erreur fichier, -3 = echec parsing.

```javascript
var loadSettings = M.cwrap('bp3_load_settings', 'number', ['string']);
loadSettings('{"AllItems":{"value":"1"},"MaxItemsProduce":{"value":"20"}}');
```

#### `bp3_load_settings_params(noteConv, quantize, timeRes, natureOfTime, seed, maxTime) → int`
Version legere : 6 parametres essentiels seulement.
Utile quand on n'a pas de fichier -se. ou pour overrider le seed.

| Parametre | Valeurs | Defaut |
|-----------|---------|--------|
| noteConv | 0=English, 1=French, 2=Indian, 3=Keys | 0 |
| quantize | ms (0=off) | 10 |
| timeRes | ms | 10 |
| natureOfTime | 0=smooth, 1=striated | 1 |
| seed | entier > 0 (0=ne pas changer) | 1 |
| maxTime | secondes (0=pas de limite) | 60 |

```javascript
var SP = M.cwrap('bp3_load_settings_params', 'number',
  ['number','number','number','number','number','number']);
SP(0, 10, 10, 1, 1, 60);
```

**Attention** : `SP()` ecrase les 6 parametres, y compris ceux charges par
`loadSettings()`. Si vous utilisez `loadSettings()` avec le JSON complet,
ne PAS appeler `SP()` apres — utiliser `bp3_set_seed()` pour overrider
uniquement le seed.

#### `bp3_load_grammar(text) → int`
Charge la grammaire dans TEH[wGrammar]. Force recompilation au prochain produce.

```javascript
var loadGr = M.cwrap('bp3_load_grammar', 'number', ['string']);
loadGr('RND\ngram#1[1] S --> C4 D4 E4');
```

#### `bp3_load_alphabet(text) → int`
Charge un alphabet (-al.) ou homomorphisme (-ho.) dans TEH[wAlphabet].

Pour les fichiers -ho. au format BP2.5 (commencant par `V.x.x`),
**stripper les lignes `V.x.x` et `Date:` avant** de passer le contenu.
Les formats `//` (BP2.8+) et sans header fonctionnent directement.

```javascript
var loadAl = M.cwrap('bp3_load_alphabet', 'number', ['string']);
loadAl('a b c d e f');
```

#### `bp3_load_tonality(text) → int`
Charge un fichier de tonalite (-to.) pour les gammes microtonales.

```javascript
var loadTo = M.cwrap('bp3_load_tonality', 'number', ['string']);
loadTo(tonalityContent);
```

#### `bp3_load_object_prototypes(text) → int`
Charge des prototypes MIDI (-mi.) pour les sound objects.
Necessite que l'alphabet soit deja charge.

Retourne : 0 = OK, -4 = MISSED (prototypes non trouves).

#### `bp3_load_csound_resources(text) → int`
Charge des instruments Csound (-cs.).

#### `bp3_provision_file(filename, content) → int`
Ecrit un fichier dans le filesystem virtuel Emscripten a la racine "/".
Le moteur peut le trouver via fopen() pendant la compilation ou la production.

Utiliser pour :
- `-mi.xxx` (references depuis les -ho.)
- `-tb.xxx` (time base patterns)
- `-gl.xxx` (glossary)
- Tout fichier que le moteur cherche a ouvrir

**Appeler AVANT `bp3_load_grammar()`** pour que les fichiers soient
disponibles pendant la compilation.

```javascript
var provision = M.cwrap('bp3_provision_file', 'number', ['string','string']);
provision('-mi.dhati', miContent);
provision('-tb.tryTimePatterns', tbContent);
```

---

### Production

#### `bp3_produce() → int`
Compile la grammaire (si necessaire) et produit les items.
Retourne le code de retour BP3 : 1 = OK, 0 = MISSED, -4 = ABORT.

**Attention** : les codes BP3 ne suivent PAS la convention C (OK=1, pas 0).

```javascript
var produce = M.cwrap('bp3_produce', 'number', []);
var result = produce(); // 1 = OK
```

---

### Extraction des resultats

#### `bp3_get_result() → string`
Retourne le texte brut produit (contenu de TEH[OutputWindow]).
Equivalent de la sortie `-D` du natif.

En mode AllItems, contient TOUS les items (un par ligne).
En mode normal, contient UN item.

```javascript
var getResult = M.cwrap('bp3_get_result', 'string', []);
var text = getResult(); // "C4 D4 E4\n"
```

#### `bp3_get_timed_tokens() → string`
Retourne un JSON avec les tokens et leurs timings (start/end en ms).
Correle le texte de sortie avec les donnees de p_Instance (TimeSet).

```javascript
var getTT = M.cwrap('bp3_get_timed_tokens', 'string', []);
var tokens = JSON.parse(getTT());
// [{token:"C4", start:0, end:1000}, {token:"D4", start:1000, end:2000}, ...]
```

**Limitations** :
- En mode AllItems, ne contient que le **dernier** item (utiliser `bp3_get_result()` a la place)
- Si le buffer contient des variables non resolues (T4), TimeSet est skippe et les tokens sont vides
- Les polymeries tres profondes peuvent causer un timeout dans TimeSet

Filtrage recommande :
```javascript
var sounding = tokens.filter(t =>
  t.token !== '-' && t.token !== '&' && !t.token.startsWith('_')
);
```

#### `bp3_get_messages() → string`
Retourne les messages du moteur (compilation, erreurs, traces).

```javascript
var getMsg = M.cwrap('bp3_get_messages', 'string', []);
var msgs = getMsg();
if (msgs.indexOf('Compilation failed') >= 0) { /* erreur */ }
```

#### `bp3_get_midi_events() → string`
Retourne les evenements MIDI en JSON.
```javascript
var getMidi = M.cwrap('bp3_get_midi_events', 'string', []);
var events = JSON.parse(getMidi());
// [{time:0, type:144, note:60, velocity:80, channel:1, scale:0}, ...]
```

#### `bp3_get_midi_event_count() → int`
Nombre d'evenements MIDI produits.

**Limite** : le buffer MIDI est de 50000 evenements (configurable dans
bp3_api.c, `MaxMIDIMessages`). Au-dela, les evenements sont tronques.

#### `bp3_get_timed_token_count() → int`
Nombre total de tokens dans la sortie texte (incluant silences et controles).

---

### Seed

#### `bp3_set_seed(seed) → void`
Setter le seed aleatoire sans toucher les autres settings.
A utiliser apres `bp3_load_settings()` pour la reproductibilite.

```javascript
var setSeed = M.cwrap('bp3_set_seed', 'void', ['number']);
setSeed(1);  // seed=1 sans écraser NoteConvention, Pclock, etc.
```

---

### Debug

#### `bp3_set_trace(compute, weights) → void`
Active le tracing dans Compute.c (derivation) et les poids.
```javascript
var setTrace = M.cwrap('bp3_set_trace', 'void', ['number','number']);
setTrace(1, 1); // active les deux
```

#### `bp3_get_flag_state() → string`
Retourne l'etat des K-parametres (flags) en JSON.
```javascript
var getFlags = M.cwrap('bp3_get_flag_state', 'string', []);
console.log(getFlags());
// {"Jflag":1,"Flagthere":1,"Varweight":0,"flags":[95],"names":["steps"]}
```

---

## Patterns d'utilisation

### Grammaire simple (pas de fichiers auxiliaires)
```javascript
init();
SP(0, 10, 10, 1, 1, 60);       // English, seed=1
loadGr('RND\ngram#1[1] S --> C4 D4 E4');
produce();
var tokens = JSON.parse(getTT());
```

### Grammaire avec settings JSON (recommande pour S2)
```javascript
init();
loadSettings(seJsonContent);     // 84 parametres (NoteConvention, Pclock, Qclock, C4key, etc.)
setSeed(1);                      // override seed uniquement, sans toucher les autres params
loadGr(grammarContent);
produce();
// NE PAS utiliser SP() apres loadSettings() — ca ecrase les settings JSON
```

### Grammaire avec alphabet -ho. (homomorphisme)
```javascript
init();
SP(0, 10, 10, 1, 1, 60);

// Provisionner les dependances AVANT
provision('-mi.dhati', miContent);

// Charger l'alphabet (stripper header V.x.x/Date: si necessaire)
var hoLines = hoContent.split('\n');
var start = 0;
if (/^V\.\d/.test(hoLines[0])) start++;
if (/^Date:/.test(hoLines[start])) start++;
loadAl(hoLines.slice(start).join('\n'));

// Charger et produire
loadGr(grammarContent);
produce();
```

### Grammaire avec tonalite microtonale
```javascript
init();
SP(0, 10, 10, 1, 1, 60);
loadAl(alphabetContent);
loadTo(tonalityContent);
loadGr(grammarContent);
produce();
```

### Mode AllItems (tous les items)
```javascript
init();
loadSettings(seWithAllItems);  // AllItems=1
loadGr(grammarContent);
produce();
var allItems = getResult();     // texte complet, un item par ligne
// NE PAS utiliser getTT() — ne contient que le dernier item
```

---

## Ordre d'appel

```
bp3_init()
  |
  v
bp3_provision_file()     ← fichiers -mi., -tb., -gl. (optionnel)
  |
  v
bp3_load_settings()      ← JSON complet (recommande si -se. JSON disponible)
  ou
bp3_load_settings_params() ← 6 params (si pas de -se. ou format texte)
  |
  v
bp3_set_seed(1)          ← override seed pour reproductibilite (apres loadSettings)
  |
  v
bp3_load_alphabet()      ← -al. ou -ho. (optionnel)
bp3_load_tonality()      ← -to. (optionnel)
  |
  v
bp3_load_grammar()       ← -gr. (obligatoire)
  |
  v
bp3_produce()            ← lance la production
  |
  v
bp3_get_result()         ← texte brut
bp3_get_timed_tokens()   ← tokens avec timings
bp3_get_midi_events()    ← evenements MIDI
bp3_get_messages()       ← messages/erreurs
```

---

## Compatibilite des fichiers

### Formats OK

| Extension | Description | API |
|-----------|-------------|-----|
| `-gr.` | Grammaire | `bp3_load_grammar()` |
| `-al.` | Alphabet simple | `bp3_load_alphabet()` |
| `-ho.` format `//` | Homomorphisme (BP2.8+) | `bp3_load_alphabet()` |
| `-ho.` format `V.x.x` | Homomorphisme (BP2.5) | `bp3_load_alphabet()` apres strip header |
| `-se.` format JSON | Settings (interface PHP) | `bp3_load_settings()` |
| `-to.` | Tonalite | `bp3_load_tonality()` |
| `-tb.` | Time base | `bp3_provision_file()` |
| `-gl.` | Glossary | `bp3_provision_file()` |
| `-mi.` | Prototypes MIDI | `bp3_provision_file()` |

### Formats KO (natif ET WASM)

| Extension | Probleme |
|-----------|----------|
| `-se.` format texte | "Could not parse JSON" (~70% des fichiers) |
| `-cs.` | Hang sur certains fichiers |
| `-or.` | Non supporte en console |
| `-in.` | Non supporte en console |

---

## Performance

| Complexite | Natif | WASM | Ratio |
|------------|-------|------|-------|
| Simple (drum, 12 tokens) | ~80ms | ~400ms* | ~1.2x (hors boot) |
| Moyen (ruwet, 129 tokens) | ~155ms | ~1200ms* | ~6x (hors boot) |
| Complexe (NotReich, 580 tokens) | ~260ms | ~1800ms* | ~6x (hors boot) |

*inclut ~300ms de boot Node.js + chargement module WASM.
En navigateur, le boot est fait une seule fois.

Le ratio 5-6x est structurel au runtime WASM (bounds checking V8,
indirections memoire des Handles BP3). Pas d'amelioration facile.

---

## Erreurs courantes

### `Compilation failed`
La grammaire ou l'alphabet n'a pas compile. Verifier `bp3_get_messages()`.
Causes frequentes : NoteConvention incorrecte, fichiers auxiliaires manquants.

### `memory access out of bounds`
TimeSet crashe sur des donnees corrompues. Causes :
- Variables non resolues (T4) dans le buffer — le guard T4 devrait les intercepter
- Polymerie tres complexe avec _legato/_staccato

### `Maximum call stack size exceeded`
PolyExpand deborde la stack V8 (devrait etre resolu par la version iterative).
Si ca arrive encore : grammaire avec nesting `{}` extreme.

### 0 tokens
- Settings manquants (MaxItemsProduce, AllItems)
- NoteConvention incorrecte (notes non reconnues)
- Erreurs de compilation silencieuses (verifier messages)

### Resultats differents du natif
- Verifier le seed (doit etre identique, utiliser `setSeed(1)`)
- Verifier que `loadSettings()` charge le meme JSON que le natif
- NE PAS utiliser `SP()` apres `loadSettings()` — ca ecrase Pclock, Qclock, etc.
- NoteConvention doit matcher la notation de la grammaire
- `C4key` dans les settings decale les pitches (48 = -12 demi-tons vs defaut 60)
- `Pclock`/`Qclock` changent le tempo (Qclock*60/Pclock BPM)

### Piege : bp3_load_settings_params() ecrase les settings JSON
Si vous appelez `SP()` apres `loadSettings()`, les 6 parametres de `SP()`
ecrasent les valeurs du JSON. Notamment :
- `NoteConvention` : le JSON peut avoir 1 (French), SP() le remet a 0
- `Quantize` : le JSON peut avoir 50, SP() le remet a 10
- `Pclock`/`Qclock` ne sont PAS dans SP() donc ils survivent, mais le tempo
  peut diverger si d'autres params sont ecrases

**Regle** : utiliser `loadSettings()` + `setSeed()`, ou `SP()` seul. Pas les deux.

---

## Fichiers source WASM

| Fichier | Role |
|---------|------|
| `wasm/bp3_api.c` | API JavaScript : init, load, produce, get |
| `wasm/bp3_wasm_stubs.c` | Stubs MIDI/Audio/Graphic + PlayBuffer1 + glibc rand() |
| `wasm/bp3_wasm_platform.h` | Types et headers pour Emscripten |
| `wasm/Makefile.emscripten` | Build WASM |
| `wasm/console_strings.json` | Messages console |
| `wasm/build.sh` | Script de build autonome (clone + compile) |
