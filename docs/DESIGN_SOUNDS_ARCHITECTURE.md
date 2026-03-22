# Architecture fonctionnelle: Sounds

## Le flux global

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
                                                          🔊 son
```

## Les entrées et sorties de chaque composant

### Alphabet

```
Entrée :  nom de fichier (ex: "sargam")
Source :  lib/alphabets.json
Sortie :  liste ordonnée de noms de notes + altérations disponibles

Exemple :
  IN:  "sargam"
  OUT: { notes: [sa, re, ga, ma, pa, dha, ni], alterations: [komal, , tivra] }
```

### Scale (gamme)

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

### Temperament

```
Entrée :  nom référencé par la scale (ex: "22shruti")
Source :  lib/temperaments.json
Sortie :  tableau de ratios de fréquence

Exemple :
  IN:  "22shruti"
  OUT: { period_ratio: 2, ratios: [1, 256/243, 16/15, 10/9, 9/8, ...] }
```

### Sounds

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

### Resolver (par acteur)

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

### ControlState (CT)

```
Entrée :  qualifiers () dans la scène
Source :  _script(CTn) dans les timed tokens
Sortie :  dictionnaire d'overrides instantanés

Exemple :
  IN:  (vel:80, pan:30)
  OUT: { vel: 80, pan: 30 }
```

### Merge (cascading)

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

### Transport

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

## Règles

### Priorité pour freq
- Si l'acteur a `scale:` → freq vient de scale+temperament (calcul). Sounds ne peut PAS override freq.
- Si l'acteur n'a PAS `scale:` → freq vient de sounds (per-terminal).
- CT ne peut PAS override freq directement. Seuls `transpose` et `detune` modifient le pitch.

### Dégradation gracieuse
- Transport WebAudio : interprète freq, noise, decay, brightness, pitch_drop, sample, layers
- Transport MIDI : interprète midi_note, midi_channel, vel
- Transport OSC : envoie toutes les clés comme arguments
- Clés inconnues : silencieusement ignorées, signalées dans le debug panel

### Compatibilité
- Scènes sans @actor : acteur implicite créé depuis @alphabet + @tuning
- Scènes sans sounds : pas de timbre spécifique, le transport utilise ses défauts
- Les CV continuent de fonctionner via leur chemin existant (cvTable/sendCV)
