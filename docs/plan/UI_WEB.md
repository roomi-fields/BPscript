# Plan d'action — UI Web BPscript

Version 1.1 — 7 avril 2026

## Contexte

L'UI web existe et fonctionne : éditeur BPscript, transpileur, WASM, dispatcher, Web Audio, timeline, live coding. Mais tout le contrôle passe par le code source. L'objectif est de transformer BPscript en **instrument interactif** : timeline visuelle, contrôles temps réel, déformation temporelle par gestes.

## Principes de design

1. **Les transports sont déclarés dans la scène**, pas dans l'UI. Le binding alphabet→transport (`@alphabet.western:midi`, `@alphabet.tabla:browser`) détermine la sortie. L'UI ne fait que refléter et permettre de configurer ces déclarations.

2. **Le dual output est une conséquence de la scène.** Deux alphabets avec deux transports différents = dual output automatique. Le dispatcher route déjà par transport.

3. **L'UI doit être interactive**, pas juste un éditeur de code. Les compositeurs ont besoin de visualiser la structure, manipuler les paramètres en temps réel, et entendre le résultat immédiatement.

## État actuel

### Fonctionnel
- Éditeur BPscript → transpileur → WASM → dispatcher → Web Audio → son
- Timeline multi-voix avec visualisation contrôles + CV
- Playback : Produce / Play / Loop / Stop
- Live coding avec hot-swap entre cycles
- Bibliothèque de scènes (demos, Bernard, localStorage)
- Help intégrée
- Resolver 5 couches (alphabets, tunings, tempéraments)
- CV objects (ADSR, LFO, ramp, backtick)
- Percussion/tabla synthèse

### Manquant
- Contrôles interactifs (sliders, knobs)
- Web MIDI (transport codé, pas branché à l'UI)
- Visualisation de la structure polymétrique
- Constraint solver (déformation temporelle)
- Mapping contrôleurs physiques → paramètres

---

## Phase 1 — Panneau de contrôle interactif

**Dépendance :** aucune — `dispatcher.controlState` est déjà modifiable en temps réel pendant le playback (lu paresseusement par `_schedule()` pour chaque événement)

**Résultat :** l'utilisateur manipule le son pendant le playback

### 1.1 — Contrôles sonores

Nouvel onglet output "Controls" ou panneau latéral droit.

| Contrôle  | Widget   | Range                            | Default  | Source        |
| --------- | -------- | -------------------------------- | -------- | ------------- |
| `vel`     | slider   | 0–127                            | 64       | controls.json |
| `pan`     | slider   | 0–127 (L–R)                      | 64       | controls.json |
| `wave`    | dropdown | sine, triangle, square, sawtooth | triangle | controls.json |
| `attack`  | slider   | 1–5000 ms                        | 20       | controls.json |
| `release` | slider   | 1–5000 ms                        | 100      | controls.json |
| `filter`  | slider   | 20–20000 Hz                      | 0 (off)  | controls.json |
| `filterQ` | slider   | 0–30                             | 1        | controls.json |
| `detune`  | slider   | -1200–1200 cents                 | 0        | controls.json |

Chaque slider wired à `dispatcher.controlState.xxx = value`. Ranges et defaults lus dynamiquement depuis `controls.json` (déjà chargé au boot).

### 1.2 — Contrôles de pitch

| Contrôle    | Widget                   | Range         | Description                         |
| ----------- | ------------------------ | ------------- | ----------------------------------- |
| `transpose` | slider + input           | ±24 demi-tons | Grid shift sur le tempérament       |
| `rotate`    | slider + input           | 0 à N degrés  | Rotation cyclique dans l'alphabet   |
| `keyxpand`  | 2 inputs (pivot, factor) | —             | Expansion/contraction d'intervalles |
| `scale`     | dropdown                 | tunings.json  | Changement de tuning en temps réel  |

### 1.3 — Inspector temps réel

- Pendant le playback, highlight du token courant sur la timeline
- Affichage en temps réel des valeurs de `controlState` (celles qui changent via les `_script(CTn)` de la grammaire)
- Distinction visuelle : valeurs provenant de la grammaire vs valeurs modifiées par l'utilisateur (slider)

---

## Phase 2 — Web MIDI

**Dépendance :** aucune — `src/dispatcher/transports/midi.js` est implémenté

**Résultat :** BPscript pilote des synthés externes et reçoit des contrôleurs physiques

### 2.1 — Initialisation MIDI

- `navigator.requestMIDIAccess()` au démarrage (Chrome, Edge, Opera)
- Détection automatique des ports MIDI input et output
- Les ports disponibles sont exposés à la couche de configuration

### 2.2 — Configuration dans la scène

Les sorties MIDI sont déclarées dans la scène via les directives d'alphabet :
- `@alphabet.western:midi` → le transport MIDI est activé pour cet alphabet
- Le canal et l'instrument sont des contrôles runtime dans la scène : `(chan:2)`, `(ins:45)`
- L'UI reflète cette configuration et permet de la modifier (ce qui met à jour le code source)

### 2.3 — MIDI input (contrôleurs physiques)

- Écoute des CC entrants depuis les contrôleurs connectés
- Utilisé en Phase 4 pour le mapping vers les paramètres du solver et du dispatcher

---

## Phase 3 — Timeline interactive

**Dépendance :** `bp3_get_timed_tokens()` verbose=2 (marqueurs structurels `{`, `,`, `}` dans le flux de tokens — agent WASM)

### Choix technique : Canvas 2D from scratch

Après analyse des bibliothèques existantes :
- **animation-timeline-js** : le plus proche (Canvas, MIT, zéro dépendance) mais modèle keyframe, pas polymétrique
- **openDAW** : UI excellente mais AGPL contaminante, timeline non séparable (~2000 fichiers couplés au système Box/Adapter)
- **Konva.js / PixiJS** : frameworks Canvas/WebGL génériques, tout à construire

**Décision :** construire la timeline en Canvas 2D natif. BPscript a un modèle de données unique (structure polymétrique imbriquée) qui ne correspond à aucune bibliothèque existante. Le rendu est plus simple qu'un DAW (pas de waveforms, pas de recording, pas de mixer — juste des blocs avec des proportions dans un arbre).

**Référence visuelle :** openDAW pour le style (sombre, accents colorés par voix, rendu Canvas anti-aliasé, layout 3 zones synchronisées).

### 3.1 — Fondations timeline Canvas

Nouveau module `web/timeline.js` (ou `src/ui/timeline.js`).

**Primitives :**
- `TimelineRange` : conversion temps↔pixels, zoom continu (scroll wheel centré sur curseur), scroll horizontal
- `TimeRuler` : graduation adaptative (ticks ajustés au zoom : ms, beats, mesures)
- `TrackRenderer` : rendu d'une piste (liste de blocs rectangulaires avec label)
- Layout : track headers (gauche, fixe) | contenu (scrollable) | minimap optionnel

**Interactions de base :**
- Zoom : Ctrl+scroll wheel (centré sur la position du curseur)
- Scroll horizontal : scroll wheel ou drag
- Scroll vertical : si plusieurs voix
- Sélection : clic sur un bloc → highlight + affichage info dans l'inspector

### 3.2 — Visualisation structure polymétrique

**Dépendance :** verbose=2 WASM + parser structure tree

**Parser** (`src/dispatcher/structureParser.js`) :
- Entrée : timed tokens verbose=2 (avec `{`, `,`, `}`)
- Sortie : arbre structurel

```json
{
  "type": "polymetric",
  "span": [0, 4000],
  "constraint": "equal-span",
  "voices": [
    {
      "proportions": [0.25, 0.25, 0.25, 0.25],
      "leaves": [
        {"token": "A", "start": 0, "end": 1000, "index": 0},
        {"token": "B", "start": 1000, "end": 2000, "index": 1}
      ]
    },
    {
      "proportions": [0.333, 0.333, 0.333],
      "leaves": [
        {"token": "dhin", "start": 0, "end": 1333, "index": 4},
        {"token": "dha", "start": 1333, "end": 2666, "index": 5}
      ]
    }
  ]
}
```

**Rendu :**
- Les groupes polymétrique `{...}` rendus comme des conteneurs (bracket ou fond coloré)
- Chaque voix sur une piste séparée au sein du conteneur
- Proportions visibles (largeur des blocs proportionnelle à la durée)
- Couleur distincte par voix
- Imbrication visible (indentation ou nesting visuel)

### 3.3 — Constraint solver

**Dépendance :** 3.2

Nouveau module JS `src/dispatcher/constraintSolver.js`.

**Entrée :** structure tree + geste utilisateur (quelle proportion change, de combien)

**Sortie :** timed tokens recalculés (même format `{token, start, end}`, le dispatcher ne voit pas la différence)

Trois modes (cf. [DESIGN_TEMPORAL_DEFORMATION.md](DESIGN_TEMPORAL_DEFORMATION.md)) :

#### Mode 1 — Span fixe
Le conteneur garde sa durée totale. Les fratries se compriment pour compenser.
```
Avant :  A(1/4)  B(1/4)  C(1/4)  D(1/4)     dans 4000ms
Geste :  étirer A à 1/3
Après :  A(1/3)  B(2/9)  C(2/9)  D(2/9)     dans 4000ms
Voix parallèle (rhythm) : inchangée (même span)
```

#### Mode 2 — Proportions fratries fixes
Les fratries gardent leur durée absolue. Le conteneur s'étire. La contrainte polymétrique propage aux voix parallèles.
```
Avant :  A(1000ms) B(1000ms) C(1000ms) D(1000ms)    total: 4000ms
Geste :  étirer A à 1333ms
Après :  A(1333ms) B(1000ms) C(1000ms) D(1000ms)    total: 4333ms
rhythm → dhin(1444ms) dha(1444ms) ge(1444ms)         total: 4333ms
```

#### Mode 3 — Contrainte relâchée
Les voix parallèles ne sont plus liées. Déphasage progressif (phasing).
```
melody : 4333ms total
rhythm : 4000ms total (inchangé)
→ déphasage progressif entre les deux voix
```

### 3.4 — Manipulation sur la timeline

**Dépendance :** 3.3 + fondations timeline (3.1)

- Drag horizontal sur les bordures de blocs → modifie la proportion
- Sélecteur de mode de contrainte (3 boutons : fixe / respire / libre)
- À chaque drag : solver recalcule → `dispatcher.load()` avec les nouveaux timings → playback adapté
- En mode loop : la déformation persiste d'un cycle à l'autre
- Curseur de playback visible et synchronisé

---

## Phase 4 — Mapping contrôles → structure

**Dépendance :** Phase 2.3 (MIDI input) + Phase 3.3 (solver)

**Résultat :** des potards physiques déforment la structure temporelle en live

### 4.1 — Mapping MIDI CC → paramètres

- Mapping UI : CC N → paramètre (proportion d'un élément, mode de contrainte, controlState.xxx)
- Learn mode : toucher un potard physique → sélectionner une cible → mapping créé

### 4.2 — CV internes comme source de modulation

- Les CV objects (LFO, ramp, ADSR) déjà implémentés en Web Audio
- Les connecter comme sources de modulation pour le solver
- Exemple : LFO → proportion d'une voix → oscillation temporelle automatique

### 4.3 — Interface de mapping

- Panneau ou modal : colonne gauche = sources (MIDI CC, LFO, slider UI), colonne droite = cibles (proportion voice.N, mode contrainte, controlState.xxx)
- Persisté dans la scène .bps (syntaxe à définir dans DESIGN_LANGUAGE.md)

---

## Ordre et dépendances

```
Phase 1 ─────────────────────────── immédiat (aucune dépendance)
Phase 2.1–2.2 ───────────────────── immédiat (parallèle à Phase 1)
Phase 3.1 ───────────────────────── immédiat (fondations Canvas)
Phase 3.2 ───────────────────────── après verbose=2 WASM
Phase 3.3 ───────────────────────── après 3.2
Phase 3.4 ───────────────────────── après 3.1 + 3.3
Phase 4 ─────────────────────────── après Phase 2.3 + Phase 3.3
```

---

## Références visuelles

- **openDAW** (github.com/andremichelle/openDAW) — UI de référence pour le style visuel : thème sombre, accents colorés par type de piste, rendu Canvas anti-aliasé, layout headers | contenu | minimap, zoom fluide. Non forké (AGPL, couplage fort) mais étudié comme référence de design.
- **web-synth** (github.com/Ameobea/web-synth) — MIDI editor PixiJS, référence pour le rendu performant de milliers de blocs.
- **animation-timeline-js** — Référence pour les primitives Canvas timeline (ruler, zoom, drag).

---

## Relation avec les autres documents

- [DESIGN_TEMPORAL_DEFORMATION.md](DESIGN_TEMPORAL_DEFORMATION.md) — Architecture du constraint solver et des 3 modes
- [DESIGN_ARCHITECTURE.md](DESIGN_ARCHITECTURE.md) — Pipeline compile/runtime, dispatcher, transports
- [DESIGN_CV.md](DESIGN_CV.md) — CV objects comme sources de modulation
- [DESIGN_INTERFACES_BP3.md](DESIGN_INTERFACES_BP3.md) — API WASM (verbose=2 à venir)
