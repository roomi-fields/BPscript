# BPscript — Architecture technique et fonctionnelle

## Principe

BPscript est un méta-ordonnanceur : il dérive des structures temporelles
via le moteur BP3 (WASM) et orchestre des acteurs multi-runtime dans une
seule timeline. BP3 sait **quand**, les runtimes savent **quoi**.

---

## Vue d'ensemble

```
┌───────────────────────────────────────────────────────────────────┐
│  COMPILE TIME                                                     │
│                                                                   │
│  Source .bps                                                      │
│       ↓                                                           │
│  Tokenizer → Parser → Macro-expander → Encoder                   │
│       ↑                                                           │
│  ┌────┴──────────────────────────┐                                │
│  │  Data files (lib/)            │                                │
│  │  alphabets.json               │                                │
│  │  octaves.json                 │                                │
│  │  tunings.json → temperaments  │                                │
│  │  controls.json                │                                │
│  │  routing.json                 │                                │
│  └───────────────────────────────┘                                │
│       ↓                                                           │
│  Grammaire BP3 + alphabet plat + prototypes -so. + settings       │
└───────────────────────────────────────────────────────────────────┘
                          ↓
                  BP3 WASM engine
                (dérivation temporelle)
                          ↓
                  Timed tokens (séquence horodatée)
                          ↓
┌───────────────────────────────────────────────────────────────────┐
│  RUNTIME                                                          │
│                                                                   │
│  Dispatcher (clock + routing par acteur)                          │
│       │                                                           │
│       │  Pour chaque timed token :                                │
│       │    1. Identifier l'acteur (via terminalActorMap)          │
│       │    2. Resolver du token → fréquence (via l'acteur)        │
│       │    3. Router vers la bonne sortie                         │
│       │                                                           │
│       ├────────────────────────────┬──────────────────────────┐   │
│       │                            │                          │   │
│       ▼                            ▼                          │   │
│  TERMINAUX TYPÉS              BACKTICKS TAGGÉS                │   │
│  (données horodatées)         (code à évaluer)                │   │
│       │                            │                          │   │
│       ▼                            ▼                          │   │
│  ┌─────────────────────┐   ┌──────────────────┐              │   │
│  │    TRANSPORTS       │   │  REPL ADAPTERS   │              │   │
│  │  (universels,       │   │  (sessions code, │              │   │
│  │   sans état)        │   │   état persistant)│             │   │
│  │                     │   │                   │              │   │
│  │  ┌────────┐ ┌────┐  │   │ ┌──────┐ ┌─────┐ │              │   │
│  │  │WebAudio│ │MIDI│  │   │ │sclang│ │ py  │ │              │   │
│  │  └───┬────┘ └─┬──┘  │   │ └──┬───┘ └──┬──┘ │              │   │
│  │  ┌───┴──┐ ┌───┴──┐  │   │ ┌──┴───┐ ┌──┴──┐ │              │   │
│  │  │ OSC  │ │ DMX  │  │   │ │ ghci │ │ ... │ │              │   │
│  │  └──────┘ └──────┘  │   │ └──────┘ └─────┘ │              │   │
│  └──────────┬──────────┘   └────────┬─────────┘              │   │
│             │                       │                         │   │
└─────────────┼───────────────────────┼─────────────────────────┘   │
              │                       │                             │
              ▼                       ▼                             │
     ┌────────────────┐     ┌─────────────────┐                    │
     │ speakers, DAW, │     │ scsynth (eval), │                    │
     │ scsynth (data),│     │ Tidal, DMX via  │                    │
     │ lights, synths │     │ Python, etc.    │                    │
     └────────────────┘     └─────────────────┘                    │
```

**Deux sorties fondamentalement différentes :**

- **Transports** = envoyer des **données** horodatées (freq, vel, durée).
  Universels, sans état, sans session. OSC bundles, MIDI messages, WebAudio API.
  Un fichier sans backticks n'utilise que les transports.

- **REPL adapters** = envoyer du **code** à évaluer dans une session persistante.
  État (variables, SynthDefs), scope par runtime. sclang, Python, ghci.
  Un fichier avec backticks utilise les deux.

---

## L'Acteur — unité centrale de binding

> Voir [DESIGN_ACTOR.md](DESIGN_ACTOR.md) pour le design complet.

L'acteur est le concept qui lie toutes les couches de données ensemble.
Chaque acteur porte son propre contexte de résolution :

```
@actor sitar   alphabet:sargam  tuning:sargam_22shruti  octaves:saptak  transport:webaudio
@actor tabla   alphabet:tabla_bols  transport:midi(ch:10)
@actor lights  alphabet:dmx_cues  transport:dmx
```

**Actor = alphabet + tuning + octaves + transport + eval**

Les symboles sont qualifiés par leur acteur via `:` :
```
gate Sa:sitar        // Sa résolu via sitar
trigger tin:tabla    // tin résolu via tabla
```

Résolution implicite quand non ambigu (un seul acteur contient le symbole).

### Impact architectural

- **Pas de resolver global** — un resolver par acteur
- **Pas d'alphabet global** — chaque acteur a le sien
- Le dispatcher identifie l'acteur d'un token et délègue à son resolver
- Le compilateur vérifie les conflits inter-acteurs à la compilation

---

## Les 6 couches de données (MusicOSI révisé)

| #   | Couche          | Fichier             | Rôle                      | Sait                  | Ne sait pas        |
| --- | --------------- | ------------------- | ------------------------- | --------------------- | ------------------ |
| 1   | **Définition**  | `.bps`              | acteurs, macros, types    | structure, bindings   | fréquences, output |
| 2   | **Composition** | `.bps`              | dérivation, polymétrie    | structure temporelle  | fréquences, output |
| 3   | **Alphabet**    | `alphabets.json`    | noms + altérations        | noms de notes         | fréquences, MIDI   |
| 4   | **Registre**    | `octaves.json`      | convention d'octave       | notation registres    | fréquences, MIDI   |
| 5   | **Tempérament** | `temperaments.json` | grille d'intervalles      | ratios mathématiques  | noms de notes      |
| 6   | **Tuning**      | `tunings.json`      | gamme concrète            | degrees + alterations | structure          |
| —   | **Routage**     | `routing.json`      | connexions                | adresses, ports       | musique, structure |
| —   | **Transport**   | runtime             | protocoles (OSC, MIDI...) | envoyer des données   | composition        |
| —   | **REPL**        | runtime             | sessions code             | évaluer du code       | composition        |

> Voir [DESIGN_PITCH.md](DESIGN_PITCH.md) pour l'architecture pitch (couches 3-6).

### Qui charge quoi

```
@actor sitar  alphabet:sargam  tuning:sargam_22shruti  octaves:saptak  transport:webaudio
       │         │                  │                      │                │
       │         │                  │                      │                └→ routing.json
       │         │                  │                      └→ octaves.json["saptak"]
       │         │                  └→ tunings.json["sargam_22shruti"]
       │         │                       └→ temperaments.json["22shruti"] (transitif)
       │         └→ alphabets.json["sargam"]
       └→ crée un Resolver configuré avec ces 4 sources
```

---

## Pipeline de compilation

### Étapes

```
Source .bps
  │
  ▼
1. Tokenizer
   │  Lit : octaves.json (reconnaître les suffixes/préfixes de registre)
   │        alphabets.json (reconnaître les noms de notes valides)
   │  Produit : flux de tokens
   │
  ▼
2. Parser
   │  Lit : alphabets.json (types gate/trigger/cv par symbole)
   │  Produit : AST (Program → Directives, Rules, Definitions, Macros)
   │
  ▼
3. Macro-expander
   │  Expansion textuelle pure (agnostique types/acteurs)
   │
  ▼
4. Encoder
   │  Lit : alphabets.json + octaves.json
   │  Traduit : BPscript → BP3
   │    - Noms de notes → noms BP3-safe (bol prefix)
   │    - [] qualifiers → instructions BP3 (/N, _tempo, mode, etc.)
   │    - () runtime → _script(CTn) start/end
   │    - Guards [X==N] → /X=N/
   │    - Flags [X=N] → /X=N/
   │    - Captures ?n → métavariables BP3
   │    - Templates $/& → (=X)/(:X)
   │    - Contextes #() → contextes négatifs BP3
   │    - Homomorphismes |x| → variables BP3
   │    - Ties ~ → &
   │  Produit : grammaire BP3 + alphabet plat + settings
   │
  ▼
5. Prototype generator
   │  Lit : alphabets.json + octaves.json
   │  Produit : fichier -so. (NoteOn/NoteOff pour chaque terminal)
   │
  ▼
Output : grammaire BP3 texte + alphabet + prototypes + settings + controlTable
```

### Ce que BP3 voit

BP3 reçoit des **noms opaques** : `bolSa`, `bolga_komal`, `bolC4`.
Il ne sait rien des fréquences, des acteurs, des transports.
Il fait une seule chose : dériver la grammaire et produire une séquence
horodatée de ces noms opaques.

---

## Pipeline runtime

### Dispatcher

Le dispatcher est la boucle centrale du runtime. Il reçoit la séquence
horodatée de BP3 et orchestre les acteurs.

```
Séquence horodatée (timed tokens)
  │
  ▼
Pour chaque token à l'instant T :
  │
  ├─ 1. Strip "bol" prefix → nom original
  │
  ├─ 2. Identifier l'acteur
  │     │  Le compilateur a associé chaque terminal à un acteur
  │     │  via une table terminal → actor (émise pendant la compilation)
  │     └→ actor = terminalActorMap[terminal]
  │
  ├─ 3. Résoudre le pitch (si l'acteur a un tuning)
  │     │  actor.resolver.resolve(token)
  │     └→ { frequency, register, noteName, alteration }
  │
  ├─ 4. Résoudre les contrôles (controlTable)
  │     │  Si le token a des _script(CTn), consulter la controlTable
  │     └→ { vel, pan, wave, filter... }
  │
  ├─ 5. Router vers le transport de l'acteur
  │     │  actor.transport.send({
  │     │    frequency, duration, onset, controls
  │     │  })
  │     └→ WebAudio / MIDI / OSC / DMX
  │
  └─ 6. Si backtick → eval via l'actor.eval (ou tag pour orphelins)
```

### Resolver par acteur

Chaque acteur instancie son propre Resolver configuré au chargement :

```js
class Resolver {
  constructor(alphabet, octaves, tuning, temperament) {
    this.alphabet = alphabet;       // notes[], alterations[]
    this.octaves = octaves;         // position, separator, registers[]
    this.tuning = tuning;           // degrees[], alterations{}, baseHz
    this.temperament = temperament; // period_ratio, ratios[]
    this._cache = {};
  }

  resolve(token) {
    // 1. Parse registre (via octaves config)
    // 2. Parse note + altération (via alphabet)
    // 3. Lookup degree (position dans alphabet.notes)
    // 4. Lookup step = tuning.degrees[degree]
    // 5. Lookup ratio = temperament.ratios[step]
    // 6. Apply alteration ratio
    // 7. freq = baseHz × period_ratio^(Δregister) × ratio × alteration
    return { frequency, register, noteName, alteration };
  }
}
```

### Formule de résolution

```
freq = baseHz × period_ratio^(register - baseRegister) × temperament.ratios[step] × alteration_ratio
```

Où :
- `baseHz` : fréquence de référence (440 Hz, 240 Hz...)
- `period_ratio` : intervalle de référence (2 = octave, 3 = tritave)
- `register` : registre du token (parsé via octaves.json)
- `step` : `tuning.degrees[indexOf(note dans alphabet)]`
- `alteration_ratio` : ratio de l'altération (fraction, décimal ou cents → float)

> Voir [DESIGN_PITCH.md](DESIGN_PITCH.md) pour les détails et exemples.

---

## Transports et REPL adapters

### Deux flux, une timeline

Le dispatcher produit deux types de sorties :

| Flux          | Contenu                                | Destinataire | Protocole            |
| ------------- | -------------------------------------- | ------------ | -------------------- |
| **Terminaux** | données horodatées (freq, dur, vel...) | Transport    | OSC, MIDI, WebAudio  |
| **Backticks** | code à évaluer                         | REPL adapter | sclang, Python, ghci |

Un fichier sans backticks ne démarre aucun REPL — le dispatcher est un pur
séquenceur de données.

### Transports

Les transports sont **universels** — ils ne connaissent pas les runtimes :

```js
// Interface transport
{
  send(event) {
    // event = { frequency, duration, onset, controls }
    // Le transport convertit en son format natif
  }
}
```

| Transport | Format                    | Cible                              |
| --------- | ------------------------- | ---------------------------------- |
| WebAudio  | API navigateur directe    | speakers (browser)                 |
| MIDI      | note-on/off, CC           | DAW, hardware, synthés             |
| OSC       | bundles horodatés         | scsynth, Processing, TouchDesigner |
| DMX       | canaux DMX via OSC/serial | lumières, moteurs                  |

### REPL adapters

Chaque adapter est une session code persistante :

```js
// Interface REPL adapter
{
  connect()              // ouvrir la session
  eval(code, time)       // envoyer du code au temps T
  getValue(expr)         // évaluer et retourner une valeur
  close()                // fermer la session
}
```

Trois moments d'exécution :
1. **Init** : backticks orphelins top-level → avant la dérivation
2. **Playback** : backticks dans le flux → au temps T
3. **Résolution** : backticks-paramètres → évalués pour obtenir une valeur

---

## Routage (`lib/routing.json`)

Le routage configure les connexions par **environnement** (studio, live, browser).
Les acteurs référencent des clés de transport et d'eval définies ici.

```json
{
  "studio": {
    "transports": {
      "webaudio": { "type": "webaudio" },
      "sc":       { "type": "osc",  "host": "127.0.0.1", "port": 57110 },
      "midi":     { "type": "midi", "device": "IAC Driver" },
      "dmx":      { "type": "osc",  "host": "127.0.0.1", "port": 9000 }
    },
    "evals": {
      "sclang": { "type": "sclang", "host": "127.0.0.1", "port": 57120 },
      "python": { "type": "exec",   "command": "python3" },
      "tidal":  { "type": "ghci",   "host": "127.0.0.1", "port": 6010 }
    }
  },
  "browser": {
    "transports": {
      "webaudio": { "type": "webaudio" }
    },
    "evals": {}
  }
}
```

---

## Interfaces entre composants

### Interface 1 : Compilateur → BP3 WASM (existe)

```
Grammaire BP3 texte (format -gr.) + alphabet plat + prototypes -so. + settings
```

Le compilateur produit ce format natif BP3. Inchangé.

### Interface 2 : BP3 WASM → Dispatcher (existe)

```js
[
  { terminal: "bolSa",      start: 0,    duration: 1000 },
  { terminal: "bolRe",      start: 1000, duration: 1000 },
  { terminal: "_script(CT0)", start: 0,  duration: 0    },
  ...
]
```

Tableau d'événements horodatés. Les backticks sont encodés comme terminaux
spéciaux. Les `_script(CTn)` sont des contrôles opaques.

### Interface 3 : Dispatcher → Transport (à adapter)

```js
actor.transport.send({
  type: "gate",              // gate | trigger | cv
  frequency: 261.63,         // Hz (résolu par actor.resolver)
  duration: 1000,            // ms
  onset: 0,                  // ms
  controls: { vel: 120 }     // depuis controlTable
})
```

### Interface 4 : Dispatcher → REPL adapter (à créer)

```js
// Init (avant playback)
actor.eval.eval("SynthDef(\\grain, {...}).add", -1)

// Playback (au temps T)
actor.eval.eval("i = i + 1", 1000)

// Résolution (synchrone, attend la réponse)
const val = await actor.eval.getValue("rrand(40,127)")
```

---

## Live coding

### Hot-swap

| Ce qui change          | Ce qui se passe                  |
| ---------------------- | -------------------------------- |
| Définition/macro       | recompile, re-dérive             |
| Composition (règle)    | recompile, re-dérive             |
| Alphabet/tuning        | resolver rechargé                |
| Routage                | transport reconnecté             |
| Backtick init          | REPL re-évalue                   |
| Flag (dans les règles) | réinitialisé (repart de zéro)    |
| Session REPL           | préservée (variables, SynthDefs) |

### Stratégies de transition

| Stratégie     | Comportement                 | Usage              |
| ------------- | ---------------------------- | ------------------ |
| **Quantized** | changement au prochain cycle | défaut, prévisible |
| **Immediate** | remplacement immédiat        | réactif            |
| **Queued**    | attend un point de sync      | musical            |

Commencer par quantized (comme TidalCycles).

### Latence estimée

- Compilation BPscript → BP3 : < 10ms
- Dérivation BP3 : 10-500ms selon la grammaire
- Total réaliste : **50-100ms**

---

## Composition distribuée

Plusieurs instances BPscript/BP3 synchronisées par triggers :

```
┌────────────────┐          ┌────────────────┐
│  Instance A    │   !sync  │  Instance B    │
│  (mélodie)     │─────────→│  (percussion)  │
│                │          │                │
│  Sa!sync Re    │   <!sync │  <!sync -!dha  │
└────────────────┘←─────────└────────────────┘
                    !reply
```

Les messages transitent par MIDI, OSC, ou tout protocole configuré.
Le langage ne connaît que `!nom` et `<!nom` — le transport est transparent.

---

## Fichiers de données — résumé

| Fichier                 | Contenu                                  | Consommé par                         |
| ----------------------- | ---------------------------------------- | ------------------------------------ |
| `lib/alphabets.json`    | notes ordonnées + altérations            | tokenizer, parser, encoder, resolver |
| `lib/octaves.json`      | conventions de registre                  | tokenizer, encoder, resolver         |
| `lib/temperaments.json` | grilles d'intervalles (ratios)           | resolver                             |
| `lib/tunings.json`      | gammes concrètes (degrees + alterations) | resolver                             |
| `lib/controls.json`     | contrôles runtime (vel, pan, wave...)    | encoder, dispatcher                  |
| `lib/routing.json`      | connexions transport/eval                | dispatcher                           |
| `lib/sub.json`          | tables de substitution                   | encoder                              |
| `lib/filter.json`       | CV objects (ADSR, LFO, ramp)             | encoder, dispatcher                  |

Anciens fichiers préservés pour compatibilité BP3 :
- `lib/alphabet.json` — format BP3 legacy (octaveChains, terminals)
- `lib/tuning.json` — scales BP3 legacy (162 gammes Bernard Bel)

---

## Documents de design liés

- [BPSCRIPT_VISION.md](BPSCRIPT_VISION.md) — Vue d'ensemble du projet
- [DESIGN_LANGUAGE.md](DESIGN_LANGUAGE.md) — Spécification du langage (syntaxe, types, symboles, opérateurs)
- [DESIGN_GRAMMAR.md](DESIGN_GRAMMAR.md) — Mapping BPscript → BP3 (règles, modes, sous-grammaires)
- [DESIGN_PITCH.md](DESIGN_PITCH.md) — Architecture 5 couches pitch : alphabet, octaves, temperament, tuning, resolver
- [DESIGN_ACTOR.md](DESIGN_ACTOR.md) — Concept d'acteur : binding alphabet + tuning + octaves + transport
- [DESIGN_CV.md](DESIGN_CV.md) — CV / signal objects
- [DESIGN_REPL.md](DESIGN_REPL.md) — Architecture des backticks et REPL adapters
- [DESIGN_EFFECTS.md](DESIGN_EFFECTS.md) — Effets et signal processing
- [DESIGN_SOUNDS.md](DESIGN_SOUNDS.md) — Système sounds (spec < CT < CV cascading)
- [DESIGN_INTERFACES_BP3.md](DESIGN_INTERFACES_BP3.md) — Interface WASM BP3 (in/out)
