# Design: Sounds — Unified Terminal Resolution

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

## Dégradation gracieuse

Chaque transport interprète les clés qu'il connaît et ignore le reste :

```
Même dictionnaire: { freq: 80, noise: 0.3, decay: 200, midi_note: 36, brightness: 2000 }

WebAudio  → utilise freq, noise, decay, brightness → synthèse
MIDI      → utilise midi_note → NoteOn(36, ch10)
SC        → utilise freq → Synth(\tabla, \freq, 80)
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
