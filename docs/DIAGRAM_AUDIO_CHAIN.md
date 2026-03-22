# Audio Chain — du terminal au son

## Architecture actuelle

```
                    COMPILE TIME                              RUNTIME
                    ────────────                              ───────

  BPscript          ┌──────────┐         ┌────────┐
  source    ──────→ │ Encoder  │ ──────→ │  BP3   │
                    │          │         │  WASM  │
  @alphabet ──────→ │ alphabet │         │        │
  @tuning          │ CT table │         │ timing │
  (vel:80)         │ CV table │         │ derive │
                    └──────────┘         └───┬────┘
                                             │
                                      timed tokens
                                      (token + start + end)
                                             │
                                             ▼
                          ┌─────────────────────────────────────┐
                          │            DISPATCHER                │
                          │                                     │
                          │  _script(CT0) ──→ controlState      │
                          │                  {vel, wave, pan,   │
                          │                   attack, release,  │
                          │                   filter, ...}      │
                          │                                     │
                          │  CV tokens ────→ sendCV()           │
                          │                                     │
                          │  note tokens ──→ send()             │
                          └──────────┬──────────────────────────┘
                                     │
                          token + controlState + durée
                                     │
                                     ▼
                          ┌──────────────────┐
                          │     RESOLVER     │
                          │                  │
                          │  "C4" ──→        │
                          │   alphabet: C    │
                          │   register: 4    │
                          │   degree: 0      │
                          │   ratio: 1.0     │
                          │   ──→ 261.63 Hz  │
                          │                  │
                          │  "dhin" ──→      │
                          │   ??? NULL       │
                          └────────┬─────────┘
                                   │
                            freq (ou null)
                            + controlState
                                   │
                                   ▼
                          ┌──────────────────┐
                          │    TRANSPORT     │
                          │    (WebAudio)    │
                          │                  │
                          │  freq → osc      │
                          │  null → hack     │
                          │         perc     │
                          └──────────────────┘
                                   │
                                   ▼
                                🔊 son
```

## Problème

Le resolver retourne une **fréquence** — ça ne marche que pour les notes pitched.
Pour les percussions, samples, MIDI drums, OSC → le resolver dit NULL et le transport bidouille.

## Proposition A — Resolver retourne un degré, le transport calcule le son

```
                          ┌──────────────────┐
                          │     RESOLVER     │
                          │  (symbolique)    │
                          │                  │
                          │  "C4" ──→        │
                          │   note: C        │
                          │   register: 4    │
                          │   degree: 0      │
                          │                  │     PAS de fréquence
                          │  "dhin" ──→      │     Le resolver ne sait pas
                          │   note: dhin     │     ce qu'est un Hz
                          │   register: 0    │
                          │   degree: 3      │
                          └────────┬─────────┘
                                   │
                            degree + register
                            + controlState
                                   │
                          ┌────────┴─────────┐
                          │                  │
                    ┌─────▼──────┐    ┌──────▼─────┐
                    │ WebAudio   │    │   MIDI     │
                    │ Transport  │    │  Transport │
                    │            │    │            │
                    │ instrument │    │ instrument │
                    │ config:    │    │ config:    │
                    │            │    │            │
                    │ pitched:   │    │ note = 60  │
                    │ deg→ratio  │    │ + degree   │
                    │ →freq→osc  │    │ →NoteOn    │
                    │            │    │            │
                    │ percussion:│    │ drums:     │
                    │ deg→params │    │ deg→GM map │
                    │ →noise+osc │    │ →NoteOn    │
                    └────────────┘    └────────────┘

    Problème : le transport doit connaître le tuning/tempérament
    pour calculer les fréquences. Ça duplique la logique.
```

## Proposition B — Le resolver retourne tout, le transport rend

```
                          ┌──────────────────┐
                          │     RESOLVER     │
                          │  (complet)       │
                          │                  │
                          │  Entrées:        │
                          │   alphabet       │
                          │   octaves        │
                          │   tuning         │
                          │   temperament    │
                          │   instrument  ←──── NOUVEAU
                          │                  │
                          │  "C4" ──→        │
                          │   {type: pitch   │
                          │    freq: 261 Hz  │
                          │    wave: sine}   │
                          │                  │
                          │  "dhin" ──→      │
                          │   {type: perc    │
                          │    pitch: 80 Hz  │
                          │    noise: 0.3    │
                          │    decay: 200    │
                          │    drop: 0.7}    │
                          │                  │
                          │  "kick" ──→      │
                          │   {type: sample  │
                          │    file: kick.wav│
                          │    gain: 0.8}    │
                          │                  │
                          │  "pad" ──→       │
                          │   {type: midi    │
                          │    note: 60      │
                          │    chan: 1}       │
                          └────────┬─────────┘
                                   │
                           résolution complète
                           (type + params)
                           + controlState
                                   │
                          ┌────────┴─────────┐
                          │                  │
                    ┌─────▼──────┐    ┌──────▼─────┐
                    │ WebAudio   │    │   MIDI     │
                    │ Transport  │    │  Transport │
                    │            │    │            │
                    │ pitch →    │    │ midi →     │
                    │  osc+env   │    │  NoteOn    │
                    │            │    │            │
                    │ perc →     │    │ (ignore    │
                    │  noise+osc │    │  perc/     │
                    │            │    │  sample)   │
                    │ sample →   │    │            │
                    │  buffer    │    │            │
                    └────────────┘    └────────────┘

    Problème : le resolver mélange résolution symbolique
    et définition d'instrument. Gros objet.
```

## Proposition C — Couche instrument entre resolver et transport

```
                          ┌──────────────────┐
                          │     RESOLVER     │
                          │  (symbolique)    │
                          │                  │
                          │  "C4" ──→        │
                          │   {note: C       │
                          │    degree: 0     │
                          │    register: 4}  │
                          │                  │      Pas de fréquence
                          │  "dhin" ──→      │      Pas de synthèse
                          │   {note: dhin    │      Juste le symbole
                          │    degree: 3     │      décomposé
                          │    register: 0}  │
                          └────────┬─────────┘
                                   │
                            degree + register
                                   │
                                   ▼
                          ┌──────────────────┐
                          │   INSTRUMENT     │  ← NOUVEAU
                          │                  │
                          │  pitched:        │
                          │   degree 0 →     │
                          │   ratio 1.0 →    │
                          │   freq 261 Hz    │
                          │   {type: pitch,  │
                          │    freq: 261}    │
                          │                  │
                          │  tabla_perc:     │
                          │   degree 3 →     │
                          │   {type: perc,   │
                          │    pitch: 80,    │
                          │    noise: 0.3,   │
                          │    decay: 200}   │
                          │                  │
                          │  gm_drums:       │
                          │   degree 3 →     │
                          │   {type: midi,   │
                          │    note: 38}     │
                          └────────┬─────────┘
                                   │
                            résolution complète
                            + controlState
                                   │
                                   ▼
                          ┌──────────────────┐
                          │    TRANSPORT     │
                          │                  │
                          │  pitch → osc     │
                          │  perc → noise    │
                          │  midi → NoteOn   │
                          │  sample → buffer │
                          └──────────────────┘


    L'acteur lie tout :
    ┌────────────────────────────────────────────────┐
    │  @actor tabla                                  │
    │    alphabet:  tabla    (noms des bols)          │
    │    octaves:   none     (pas de registres)      │
    │    tuning:    tabla    (degrés ordonnés)        │
    │    instrument: tabla_perc  (synthèse percussive)│
    │    transport: webaudio                          │
    └────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────┐
    │  @actor sitar                                  │
    │    alphabet:  sargam   (sa re ga ma...)         │
    │    octaves:   arrows   (_v _^)                 │
    │    tuning:    sargam_22shruti                   │
    │    instrument: pitched (ratio → fréquence)     │
    │    transport: webaudio                          │
    └────────────────────────────────────────────────┘

    ┌────────────────────────────────────────────────┐
    │  @actor drums                                  │
    │    alphabet:  tabla    (mêmes noms)             │
    │    octaves:   none                              │
    │    tuning:    tabla                             │
    │    instrument: gm_drums (degree → MIDI note)   │
    │    transport: midi                              │
    └────────────────────────────────────────────────┘
```

## Comparaison

```
              Resolver       Instrument     Transport      Séparation
              ────────       ──────────     ─────────      ──────────

Actuel        freq           (aucun)        rend freq      ❌ pitched only

Prop A        degree         dans transport rend degree    ❌ transport trop gros
                                                            duplique tuning

Prop B        tout           dans resolver  rend params    ❌ resolver trop gros
                                                            mélange tout

Prop C        symbolique     couche séparée rend params    ✅ chaque couche
              (degree)       (freq ou perc  (pitch/perc/     fait une chose
                              ou midi...)    midi/sample)
```
