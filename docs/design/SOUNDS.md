# Sounds — Unified Terminal Resolution

## Résumé

Ce document définit comment BPscript résout les terminaux (notes, percussions, samples, CV) en paramètres de rendu pour les transports. Le modèle unifié utilise des dictionnaires `{clé: valeur}` à trois échelles temporelles, avec cascading inspiré de CSS.

## Les trois couches

```
BPscript (langage)     alphabet, timing, grammaire, acteurs
                       → QUOI joue QUAND

Spec (acteur)          resolve(terminal) → {clé: valeur}
                       → CE QUE C'EST (propriétés du son)

Transport (runtime)    interprète les clés connues, ignore le reste
                       → COMMENT ça sonne
```

## Architecture fonctionnelle

### Le flux global

```
  Scène BPscript                  Moteur BP3              Dispatcher + Acteurs
  ───────────────                 ──────────              ────────────────────

  @actor sitar
    alphabet: sargam
    scale: sargam_22shruti                                 ┌─────────────┐
    transport: webaudio           ──── compile ────→       │ Acteur      │
                                                           │ "sitar"     │
  @actor tabla                                             ├─────────────┤
    alphabet: tabla                                        │ Alphabet    │
    sounds: tabla_perc                                     │ Scale       │
    transport: webaudio                                    │ Sounds      │
                                                           │ Transport   │
  S -> {Melody, Rhythm}           ──── BP3 WASM ──→       └──────┬──────┘
                                       timing                    │
  Melody -> sa re ga pa                                    ┌─────▼──────┐
  Rhythm -> dhin - dha ge                                  │ Dispatcher │
                                                           └─────┬──────┘
                                                                 │
                                                        pour chaque terminal
                                                                 │
                                                    ┌────────────┴───────────┐
                                                    ▼                        ▼
                                              Acteur sitar             Acteur tabla
                                              "sa" → résoudre         "dhin" → résoudre
                                                    │                        │
                                                    ▼                        ▼
                                              {freq: 240}             {layers: [
                                                                        {freq:80, noise:0.15},
                                                                        {freq:350, noise:0.4}
                                                                      ]}
                                                    │                        │
                                                    └────────┬───────────────┘
                                                             │
                                                    merge avec controlState
                                                    (vel, pan, filter...)
                                                             │
                                                             ▼
                                                       Transport
                                                       WebAudio
                                                             │
                                                             ▼
                                                          son
```

### Les entrées et sorties de chaque composant

#### Alphabet

```
Entrée :  nom de fichier (ex: "sargam")
Source :  lib/alphabets.json
Sortie :  liste ordonnée de noms de notes + altérations disponibles

Exemple :
  IN:  "sargam"
  OUT: { notes: [sa, re, ga, ma, pa, dha, ni], alterations: [komal, , tivra] }
```

#### Scale (gamme)

```
Entrée :  nom de fichier (ex: "sargam_22shruti")
Source :  lib/scales.json
Sortie :  mapping note → degré dans le tempérament + fréquence de référence

Exemple :
  IN:  "sargam_22shruti"
  OUT: { degrees: [0, 4, 7, 10, 13, 17, 20],
         baseHz: 240, baseNote: "sa", baseRegister: 4,
         temperament: "22shruti" }
```

#### Temperament

```
Entrée :  nom référencé par la scale (ex: "22shruti")
Source :  lib/temperaments.json
Sortie :  tableau de ratios de fréquence

Exemple :
  IN:  "22shruti"
  OUT: { period_ratio: 2, ratios: [1, 256/243, 16/15, 10/9, 9/8, ...] }
```

#### Sounds

```
Entrée :  nom de fichier (ex: "tabla_perc")
Source :  lib/sounds/tabla_perc.json
Sortie :  pour chaque terminal → dictionnaire {clé: valeur}

Exemple :
  IN:  "tabla_perc", terminal "dhin"
  OUT: { layers: [{freq:80, noise:0.15, decay:350}, {freq:350, noise:0.4, decay:250}] }

Exemple :
  IN:  "piano_timbre", register 4
  OUT: { brightness: 1500, release: 300, noise: 0.02, wave: "triangle" }
```

#### Resolver (par acteur)

```
Entrées :
  - token (ex: "sa" ou "dhin")
  - alphabet (liste de notes)
  - [scale + temperament] (si pitched)
  - [sounds] (si non-pitched ou timbre spécifique)

Sortie :
  dictionnaire {clé: valeur} avec toutes les propriétés résolues

Exemple pitched (sitar, "sa") :
  IN:  token="sa", alphabet=sargam, scale=sargam_22shruti, temperament=22shruti
  OUT: { freq: 240, noteName: "sa", register: 4 }

Exemple percussion (tabla, "dhin") :
  IN:  token="dhin", alphabet=tabla, sounds=tabla_perc
  OUT: { layers: [{freq:80, noise:0.15, decay:350}, {freq:350, noise:0.4, decay:250}] }

Exemple mixte (piano, "C4") :
  IN:  token="C4", alphabet=western, scale=western_12TET, sounds=piano_timbre
  OUT: { freq: 261.63, brightness: 1500, release: 300, noise: 0.02 }
```

#### ControlState (CT)

```
Entrée :  qualifiers () dans la scène
Source :  _script(CT n) dans les timed tokens
Sortie :  dictionnaire d'overrides instantanés

Exemple :
  IN:  (vel:80, pan:30)
  OUT: { vel: 80, pan: 30 }
```

#### Merge (cascading)

```
Entrées :
  - résolution du terminal (spec)    = valeurs de base
  - controlState (CT)                = overrides ponctuels
  - CV (temporel)                    = modulations continues

Sortie :
  dictionnaire fusionné, priorité : spec < CT < CV

Exemple :
  spec:  { freq: 80, decay: 350, noise: 0.15 }
  CT:    { vel: 100, decay: 50 }              ← override decay
  CV:    { filter: f(t) }                     ← modulation continue

  OUT:   { freq: 80, decay: 50, noise: 0.15, vel: 100, filter: f(t) }
```

#### Transport

```
Entrée :  dictionnaire fusionné {clé: valeur} + temps absolu
Sortie :  son (WebAudio), message MIDI, message OSC, code REPL

Comportement :
  - Lit les clés qu'il connaît
  - Ignore les clés inconnues (pas d'erreur)
  - Choisit le mode de rendu selon les clés présentes :
      freq seul         → oscillateur
      freq + noise      → synthèse percussive
      sample            → lecture de buffer audio
      layers            → multi-voix (un rendu par layer)
      midi_note         → NoteOn MIDI
      type: "envelope"  → bus de modulation CV
```

## L'acteur lie tout

```
@actor NAME  alphabet:X  [scale:Y]  [sounds:Z]  transport:T
```

| Propriété | Rôle | Requis |
|-----------|------|--------|
| `alphabet` | Vocabulaire (noms des symboles) | oui |
| `scale` | Sélection de degrés → pitch via temperament | si pitched |
| `sounds` | Définitions per-terminal (timbre, perc, sample) | si non-pitched ou timbre spécifique |
| `transport` | Destination de rendu | oui |

Exemples :

```
@actor sitar  alphabet:sargam   scale:sargam_22shruti   transport:webaudio
@actor tabla  alphabet:tabla    sounds:tabla_perc        transport:webaudio
@actor piano  alphabet:western  scale:western_12TET  sounds:piano_timbre  transport:webaudio
@actor drums  alphabet:tabla    sounds:tabla_gm          transport:midi
```

## Trois échelles temporelles

```
TERMINAL       spec → {freq, decay, noise, brightness, sample, layers...}
               Résolu une fois par la définition du son.
               Base permanente.

INSTANTANÉ     CT → {vel, pan, filter, wave, attack, release, detune...}
               Override ponctuel via () qualifier dans la scène.
               Change quand un nouveau () est rencontré.

TEMPOREL       CV → modulation continue (ADSR, LFO, ramp)
               Modifie une clé sur une durée.
               Objet temporel dans la grammaire.
```

### Cascading (priorité croissante)

```
spec (défaut) < CT override < CV modulation
```

- Le spec définit `decay: 200` pour le kick
- Le CT `(decay: 50)` override ponctuellement → kick court
- Le CV `env1 = filter.adsr(...)` module `filter` continûment

Même modèle que CSS : user-agent defaults < stylesheet < inline style.

### Règle de priorité pour `freq`

- Si l'acteur a `scale:` → freq vient du calcul scale+temperament. Les sounds ne peuvent PAS override freq.
- Si l'acteur n'a PAS de `scale:` → freq vient de sounds (per-terminal).
- Le CT ne peut PAS override freq directement. Seuls `(transpose:N)` et `(detune:N)` modifient le pitch.

## Format des sounds

### Structure de fichier

Un fichier par instrument dans `lib/sounds/` :

```
lib/sounds/tabla_perc.json
lib/sounds/piano_timbre.json
lib/sounds/drum_808.json
```

### Modes de résolution (inférés, pas déclarés)

Le resolver détecte le mode depuis la structure des données :

- `by_terminal` présent → lookup per-terminal (table)
- `templates` présent → composition de templates
- `parametric` présent → calcul par formule
- `by_register` présent → variation par registre (complément de scale)
- Plusieurs présents → mode mixte (tout coexiste)

### Format: table (per-terminal)

```json
{
  "description": "808 Drum Machine",
  "by_terminal": {
    "kick":  { "freq": 50, "decay": 300, "noise": 0.05, "pitch_drop": 0.8 },
    "snare": { "freq": 200, "decay": 150, "noise": 0.7, "brightness": 4000 },
    "hat":   { "freq": 800, "decay": 30, "noise": 0.95, "brightness": 8000 }
  }
}
```

### Format: template (composition réutilisable)

```json
{
  "description": "Tabla percussion synthesis",
  "templates": {
    "bayan_open":   { "freq": 80,  "noise": 0.15, "decay": 350, "brightness": 1200, "pitch_drop": 0.6 },
    "bayan_muted":  { "freq": 80,  "noise": 0.1,  "decay": 60,  "brightness": 600,  "pitch_drop": 0.3 },
    "dayan_ring":   { "freq": 350, "noise": 0.4,  "decay": 250, "brightness": 4000, "pitch_drop": 0.1 },
    "dayan_sharp":  { "freq": 400, "noise": 0.85, "decay": 25,  "brightness": 6000, "pitch_drop": 0.05 }
  },
  "by_terminal": {
    "dhin": { "layers": ["bayan_open", "dayan_ring"] },
    "dha":  { "layers": ["bayan_open", "dayan_ring"] },
    "ge":   { "layers": ["bayan_open"] },
    "ka":   { "layers": ["bayan_muted"] },
    "na":   { "layers": ["dayan_ring"] },
    "ta":   { "layers": ["dayan_sharp"] },
    "tin":  { "layers": ["dayan_ring"], "override": { "freq": 500, "decay": 150 } }
  }
}
```

Templates sont flat (pas de nesting). Override permet d'ajuster un template pour un terminal spécifique. `layers` superpose plusieurs templates (dhin = bass + treble).

### Format: paramétrique (formule)

```json
{
  "description": "Marimba — timbre varies by register",
  "parametric": {
    "decay": "50 + register * 80",
    "brightness": "800 + register * 600",
    "noise": "0.15 - register * 0.02"
  }
}
```

Les formules utilisent `register`, `index` (position dans l'alphabet), `degree` (si scale présent). Évalué au resolve.

### Format: par registre (complément de scale)

```json
{
  "description": "Piano acoustic timbre",
  "defaults": {
    "wave": "triangle",
    "attack": 5,
    "release": 300
  },
  "by_register": {
    "0-2": { "wave": "sawtooth", "brightness": 400, "attack": 8, "release": 500, "noise": 0.05 },
    "3-4": { "brightness": 1500, "release": 300, "noise": 0.02 },
    "5-7": { "brightness": 4000, "attack": 2, "release": 150, "noise": 0.01 }
  }
}
```

Utilisé AVEC scale+temperament. Le scale fournit freq, le sounds fournit le timbre par registre.

### Format: samples

```json
{
  "description": "808 Sample Kit",
  "by_terminal": {
    "kick":  { "sample": "808/kick.wav",  "gain": 0.9 },
    "snare": { "sample": "808/snare.wav", "gain": 0.7, "freq": 200 },
    "hat":   { "sample": "808/hat.wav",   "gain": 0.5, "decay": 100 }
  }
}
```

`sample` est une clé comme une autre. Le transport qui sait jouer des samples (WebAudio AudioBuffer, sampler SFZ) l'utilise. Les autres l'ignorent.

### Format: CV/modulateurs

```json
{
  "description": "Filter modulation library",
  "by_terminal": {
    "adsr": { "type": "envelope", "params": ["attack", "decay", "sustain", "release"] },
    "lfo":  { "type": "oscillator", "params": ["rate", "amplitude", "shape"] },
    "ramp": { "type": "ramp", "params": ["from", "to"] }
  }
}
```

Les CV sont des terminaux dont le `type` indique "modulateur, pas son". Le transport les traite différemment (crée un bus de modulation au lieu d'un son).

## Dictionnaire de paramètres

### Clés universelles (tout transport peut les interpréter)

| Clé | Type | Description |
|-----|------|-------------|
| `freq` | Hz | Fréquence fondamentale |
| `amp` | 0-1 | Amplitude |

### Clés descriptives (convention partagée, transports capables les interprètent)

| Clé | Type | Description | MIDI equiv |
|-----|------|-------------|------------|
| `decay` | ms | Durée de décroissance | — |
| `brightness` | Hz | Centre spectral / cutoff filtre | CC#74 |
| `noise` | 0-1 | Ratio bruit/tonal | — |
| `pitch_drop` | ratio | Chute de pitch pendant le decay | — |
| `sample` | path | Référence fichier audio | — |
| `layers` | array | Voix simultanées (composition) | — |

### Clés de contrôle (controlState, via CT)

| Clé | Type | Description |
|-----|------|-------------|
| `vel` | 0-127 | Vélocité |
| `pan` | 0-127 | Panoramique |
| `wave` | string | Forme d'onde |
| `attack` | ms | Temps d'attaque |
| `release` | ms | Temps de relâchement |
| `filter` | Hz | Cutoff filtre |
| `filterQ` | float | Résonance filtre |
| `detune` | cents | Désaccordage |
| `transpose` | demi-tons | Transposition |

### Clés transport-spécifiques (ignorées par les autres)

| Clé | Transport | Description |
|-----|-----------|-------------|
| `midi_note` | MIDI | Numéro de note |
| `midi_channel` | MIDI | Canal |
| `midi_program` | MIDI | Program Change |
| `osc_address` | OSC | Adresse OSC |
| `synth_def` | SC | Nom du SynthDef |

## Résolution par transport — qui traduit quoi

### Principe

Le resolver produit des données **musicales** (fréquence, step, register, alteration). La conversion vers le protocole de sortie (MIDI note, OSC message, etc.) est la responsabilité du **transport**, pas du resolver.

```
resolver.resolve("C#4")
    → { frequency: 277.18, step: 1, register: 4, degreeIndex: 0, alteration: "#", noteName: "C" }

transport.send(event)
    ├── WebAudio : lit frequency → oscillator.frequency = 277.18
    ├── MIDI :     lit frequency → note 61 + pitchBend 0 → NoteOn(61, vel, chan)
    ├── OSC/SC :   lit token brut → osc.send("/note", "C#4", dur, vel)
    └── DMX :      ignore le pitch → lit chan, vel
```

### Pourquoi le resolver ne produit pas de MIDI note

- Le resolver est **agnostique du transport**. Il résout le pitch musical.
- La conversion fréquence → MIDI est triviale (`Math.round(69 + 12 * log2(freq/440))`) et appartient au transport MIDI.
- Pour les tempéraments non-12-TET, la note MIDI la plus proche + pitch bend est un détail de protocole MIDI, pas de musique.
- SuperCollider et Tidal font **leur propre résolution de pitch** — on leur envoie le token brut.

### Données exposées par le resolver

Le resolver retourne un objet riche. Chaque transport prend ce dont il a besoin :

```js
{
  frequency,    // Hz — pour WebAudio (oscillateur)
  step,         // position sur la grille du tempérament — pour MIDI (calcul direct note+bend)
  register,     // octave — pour MIDI (register * 12 + step)
  degreeIndex,  // index dans l'alphabet — pour résolution structurelle
  noteName,     // nom de la note ("C", "Sa", etc.) — pour OSC/SC (envoi symbolique)
  alteration,   // "#", "b", null — pour affichage et MIDI (alteration steps)
}
```

### Conversion par transport

| Transport | Entrée consommée | Conversion | Sortie |
|-----------|-----------------|------------|--------|
| WebAudio | `frequency` | directe | `oscillator.frequency` |
| MIDI (12-TET) | `frequency` | `round(69 + 12*log2(f/440))` | NoteOn(note, vel, chan) |
| MIDI (microtonal) | `frequency` | note + pitch bend (écart en cents) | NoteOn + PitchBend |
| OSC/SC | `token` (brut) | aucune — SC résout | `/note "C#4" dur vel` |
| Tidal | `token` (brut) | reformatage minimal | pattern string |
| DMX | aucun pitch | — | canal + valeur |

### Un resolver, N transports

Il n'y a pas de "MIDIResolver" ou "SCResolver". Le resolver est **un seul type**, instancié **une fois par acteur** (binding alphabet+tuning+tempérament). Chaque transport décide :
- S'il utilise le resolver ou pas (SC/Tidal n'en ont pas besoin)
- Quelles données il consomme (frequency, token, step+register)
- Comment il convertit vers son protocole

## Dégradation gracieuse

Chaque transport interprète les clés qu'il connaît et ignore le reste :

```
Même dictionnaire: { freq: 80, noise: 0.3, decay: 200, brightness: 2000 }

WebAudio  → utilise freq, noise, decay, brightness → synthèse
MIDI      → convertit freq → NoteOn(36, ch10)
SC        → envoie token brut → Synth(\tabla, \freq, 80)
Sampler   → utilise sample (si présent) → joue le fichier
```

Les clés inconnues ne provoquent PAS d'erreur. Le debug panel les signale comme "ignored by [transport]" pour aider l'utilisateur.

## Résolution complète — exemple piano

```
Entrée: terminal "C4", acteur piano (scale:western_12TET + sounds:piano_timbre)

1. Alphabet:     "C" → note index 0
2. Octaves:      "4" → register 4
3. Scale:        degree[0] = 0 dans le temperament
4. Temperament:  ratio[0] = 1.0
5. Calcul:       freq = 440 / ratio(A) × 1.0 × 2^(4-4) = 261.63 Hz
6. Sounds:       by_register "3-4" → { brightness: 1500, release: 300, noise: 0.02 }
7. Defaults:     { wave: "triangle", attack: 5 }
8. Merge:        { freq: 261.63, wave: "triangle", attack: 5, brightness: 1500,
                   release: 300, noise: 0.02 }
9. CT override:  (vel: 80) → { ...merged, vel: 80 }
10. Transport:   WebAudio crée oscillateur triangle 261.63 Hz + filtre 1500 Hz + envelope
```

## Résolution complète — exemple dhin

```
Entrée: terminal "dhin", acteur tabla (sounds:tabla_perc, pas de scale)

1. Alphabet:     "dhin" → trouvé dans tabla
2. Sounds:       by_terminal["dhin"] → layers: ["bayan_open", "dayan_ring"]
3. Templates:    bayan_open = { freq: 80, noise: 0.15, decay: 350, brightness: 1200 }
                 dayan_ring = { freq: 350, noise: 0.4, decay: 250, brightness: 4000 }
4. Résultat:     { layers: [
                     { freq: 80, noise: 0.15, decay: 350, brightness: 1200 },
                     { freq: 350, noise: 0.4, decay: 250, brightness: 4000 }
                 ]}
5. CT override:  (vel: 100) → { ...résultat, vel: 100 }
6. Transport:    WebAudio crée 2 voix simultanées (bass + treble)
```

## Fichiers et arborescence

```
lib/
  alphabets.json          ← vocabulaires (existant)
  scales.json             ← gammes/degrés (existant, renommé de tunings.json)
  temperaments.json       ← grilles de ratios (existant)
  sounds/                 ← NOUVEAU répertoire
    tabla_perc.json       ← synthèse tabla
    piano_timbre.json     ← timbre piano par registre
    drum_808.json         ← drum machine samples/synth
    gm_drums.json         ← mapping MIDI General MIDI drums
    filter_cv.json        ← types de modulateurs CV
```

## Implémentation

### Vue d'ensemble

```
                    ┌──────────────────────────────────────────────────┐
                    │                   BPscript                       │
                    │                                                  │
                    │  @actor piano alphabet:western                    │
                    │                scale:western_12TET                │
                    │                sounds:piano_timbre                │
                    │                transport:webaudio                 │
                    │                                                  │
                    │  S -> C4 D4 E4 (vel:80)                          │
                    └────────────────────┬─────────────────────────────┘
                                         │
                              compile    │
                                         ▼
                    ┌──────────────────────────────────────────────────┐
                    │                  Encoder                         │
                    │                                                  │
                    │  grammar:  S --> C4 D4 E4 _script(CT 0)           │
                    │  alphabet: C4, D4, E4                            │
                    │  CT table: [{id:CT0, assignments:{vel:80}}]      │
                    │  actorMap: {C4:"piano", D4:"piano", E4:"piano"}  │  ← NOUVEAU
                    └────────────────────┬─────────────────────────────┘
                                         │
                              BP3 WASM   │
                                         ▼
                    ┌──────────────────────────────────────────────────┐
                    │                 Dispatcher                       │
                    │                                                  │
                    │  Pour chaque token:                               │
                    │    1. CT → update controlState                    │
                    │    2. CV → route vers sendCV()                    │
                    │    3. Note → lookup actorMap → acteur             │
                    │            → acteur.resolve(token)                │
                    │            → {clé:valeur}                         │
                    │            → merge controlState                   │
                    │            → acteur.transport.send(merged)        │
                    └──────────────────────────────────────────────────┘
```

### Composants modifiés

#### 1. ActorRegistry (NOUVEAU)

```
src/dispatcher/actorRegistry.js
```

Gère les acteurs. Chaque acteur contient un Resolver + un SoundsResolver + une référence transport.

```javascript
class ActorRegistry {
  constructor() {
    this.actors = {};        // name → Actor
    this.terminalMap = {};   // terminal → actor name
  }

  register(name, config) {
    // config = { alphabet, scale, sounds, transport, resolver }
    this.actors[name] = config;
    // Map each terminal in the alphabet to this actor
    for (const note of config.alphabet.notes) {
      this.terminalMap[note] = name;
    }
  }

  resolveTerminal(token) {
    const actorName = this.terminalMap[token];
    if (!actorName) return null;
    const actor = this.actors[actorName];
    return actor.resolve(token);
  }
}
```

#### 2. SoundsResolver (NOUVEAU)

```
src/dispatcher/soundsResolver.js
```

Résout un terminal en dictionnaire de paramètres depuis un fichier sounds.

```javascript
class SoundsResolver {
  constructor(soundsData) {
    this.defaults = soundsData.defaults || {};
    this.templates = soundsData.templates || {};
    this.byTerminal = soundsData.by_terminal || {};
    this.byRegister = soundsData.by_register || null;
    this.parametric = soundsData.parametric || null;
  }

  resolve(noteName, register) {
    let params = { ...this.defaults };

    // By-register (for pitched + timbre)
    if (this.byRegister) {
      for (const [range, overrides] of Object.entries(this.byRegister)) {
        const [lo, hi] = range.split('-').map(Number);
        if (register >= lo && register <= hi) {
          params = { ...params, ...overrides };
          break;
        }
      }
    }

    // By-terminal (for percussion, samples)
    const entry = this.byTerminal[noteName];
    if (entry) {
      if (entry.layers) {
        // Template composition
        params.layers = entry.layers.map(name => {
          const tmpl = this.templates[name] || {};
          return entry.override ? { ...tmpl, ...entry.override } : tmpl;
        });
      } else {
        params = { ...params, ...entry };
      }
    }

    // Parametric (formula)
    if (this.parametric) {
      for (const [key, formula] of Object.entries(this.parametric)) {
        params[key] = this._evalFormula(formula, { register, index: 0 });
      }
    }

    return params;
  }

  _evalFormula(formula, vars) {
    // Simple formula evaluation: "50 + register * 80"
    let expr = formula;
    for (const [k, v] of Object.entries(vars)) {
      expr = expr.replace(new RegExp(k, 'g'), v);
    }
    try { return Function('"use strict"; return (' + expr + ')')(); }
    catch { return 0; }
  }
}
```

#### 3. Resolver (MODIFIE)

```
src/dispatcher/resolver.js
```

Le Resolver existant (5-layer pitch) reste. Il ajoute la capacite de merger avec SoundsResolver :

```javascript
// Dans resolve():
resolve(token, direction) {
  // ... existing pitch resolution (steps 1-5) ...

  // Step 6: merge sounds params if available
  if (this.soundsResolver) {
    const soundParams = this.soundsResolver.resolve(noteName, register);
    result = { ...soundParams, ...result };  // pitch overrides sounds.freq
  }

  return result;
}
```

Pour les acteurs SANS scale (percussion), le Resolver fait uniquement le sounds lookup :

```javascript
resolve(token) {
  if (!this.notes.length && this.soundsResolver) {
    // No alphabet/scale → pure sounds lookup
    return this.soundsResolver.resolve(token, 0);
  }
  // ... existing pitch resolution ...
}
```

#### 4. Dispatcher (MODIFIE)

```
src/dispatcher/dispatcher.js
```

Le dispatcher utilise l'ActorRegistry pour router chaque terminal :

```javascript
// Dans _schedule(), au lieu de:
//   transport.send({token, ...controlState}, absTime)
// Faire:

const actorResult = this._actorRegistry?.resolveTerminal(evt.token);
if (actorResult) {
  // Merge: actorResult (spec) < controlState (CT override)
  const merged = { ...actorResult, ...this.controlState, velocity: this.controlState.vel / 127 };
  merged.token = evt.token;
  merged.durSec = evt.durSec;

  // Route to the actor's transport
  const actorName = this._actorRegistry.terminalMap[evt.token];
  const actor = this._actorRegistry.actors[actorName];
  const transport = this.transports[actor.transportName] || this.transports['default'];

  if (merged.layers) {
    transport.sendLayers(merged, absTime);  // multi-voice
  } else {
    transport.send(merged, absTime);
  }
}
```

#### 5. WebAudioTransport (MODIFIE)

```
src/dispatcher/transports/webaudio.js
```

Le transport interprete les cles qu'il connait :

```javascript
send(event, absTime) {
  const freq = event.freq;
  if (!freq || freq <= 0) return;

  const dur = Math.max(0.05, event.durSec);
  const velocity = event.velocity || 0.5;
  const wave = event.wave || 'triangle';
  const attackSec = (event.attack || 20) / 1000;
  const releaseSec = (event.release || 100) / 1000;
  const brightness = event.brightness || 0;  // 0 = no filter
  const noise = event.noise || 0;
  const pitchDrop = event.pitch_drop || 0;
  const sample = event.sample || null;

  if (sample) {
    this._playSample(sample, event, absTime);
  } else if (noise > 0 || pitchDrop > 0) {
    this._playPercussion(freq, velocity, dur, noise, pitchDrop, brightness, event, absTime);
  } else {
    this._playOscillator(freq, velocity, dur, wave, attackSec, releaseSec, brightness, event, absTime);
  }
}

sendLayers(event, absTime) {
  for (const layer of event.layers) {
    this.send({ ...event, ...layer, layers: undefined }, absTime);
  }
}
```

#### 6. Web Interface (MODIFIE)

```
web/index.html
```

- Charge les fichiers sounds au startup : `lib/sounds/*.json`
- Cree un ActorRegistry depuis les directives `@actor`
- Pour le mode legacy (pas d'@actor), cree un acteur implicite depuis @alphabet + @tuning

```javascript
function _createActorRegistry() {
  const registry = new ActorRegistry();

  // Implicit actor from @alphabet/@tuning directives (legacy mode)
  const alphabetKey = ...;  // from directives
  const scaleKey = ...;
  const soundsKey = ...;

  const resolver = new Resolver({
    alphabet: alphabets[alphabetKey],
    octaves: octaves[octavesKey],
    tuning: tunings[scaleKey],
    temperament: temperaments[tempKey]
  });

  if (soundsKey && soundsData[soundsKey]) {
    resolver.soundsResolver = new SoundsResolver(soundsData[soundsKey]);
  }

  registry.register('default', {
    alphabet: alphabets[alphabetKey],
    resolve: (token) => resolver.resolve(token),
    transportName: 'default'
  });

  return registry;
}
```

### Plan d'implementation par etapes

#### Phase 1 — SoundsResolver + tabla (une session)

1. Creer `lib/sounds/tabla_perc.json` avec templates + by_terminal
2. Creer `src/dispatcher/soundsResolver.js`
3. Brancher dans le Resolver existant (mode sans scale = sounds only)
4. Le WebAudioTransport reconnait `noise`, `pitch_drop`, `brightness`, `layers`
5. Tester : ek-do-tin et dhin produisent des sons percussifs distincts

#### Phase 2 — Piano timbre par registre (une session)

1. Creer `lib/sounds/piano_timbre.json` avec defaults + by_register
2. Le Resolver merge scale (freq) + sounds (timbre)
3. Tester : piano grave != piano aigu

#### Phase 3 — ActorRegistry + @actor (deux sessions)

1. Parser `@actor` dans le parser
2. Creer `src/dispatcher/actorRegistry.js`
3. Le dispatcher route par acteur via terminalMap
4. Tester : scene avec sitar + tabla simultanes

#### Phase 4 — Samples (une session)

1. Ajouter `sample` key dans sounds
2. WebAudioTransport charge AudioBuffer et joue
3. Tester : drum kit avec samples WAV

#### Phase 5 — Parametric sounds (une session)

1. Formules dans sounds (register, index)
2. Tester : marimba avec timbre parametrique

#### Phase 6 — Multi-transport (futures sessions)

1. MIDI transport interprete les cles MIDI
2. OSC transport envoie les cles comme args
3. Meme scene, differents transports

### Compatibilite

- **Aucun changement aux fichiers existants** (alphabets, scales, temperaments)
- **Les scenes sans @actor continuent de fonctionner** (acteur implicite depuis @alphabet)
- **Le fallback percussion hash est remplace** par le SoundsResolver
- **Les CV continuent de fonctionner** (chemin separe via cvTable/sendCV)
