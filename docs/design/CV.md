# BPScript CV / Signal Objects — Design Document

## Date: 2026-03-18

> Voir aussi : [DESIGN_LANGUAGE.md](../spec/LANGUAGE.md) pour le type `cv` dans le système de types,
> [DESIGN_SOUNDS.md](SOUNDS.md) pour le cascading spec < CT < CV.

## Concept

Les CV (Control Voltage) sont des **objets temporels** dans BPScript qui produisent des courbes de valeurs continues. Ils s'appliquent à un signal d'entrée pour produire un signal de sortie, comme dans un synthé modulaire.

### Les 3 types d'objets temporels BPScript

| Type | Comportement | Exemple |
|------|-------------|---------|
| `gate` | on/off avec durée | une note : C4 |
| `trigger` | impulsion instantanée | un événement ponctuel |
| `cv` | courbe continue sur une durée | enveloppe, LFO, rampe |

## Architecture

### Deux dimensions séparées

Un CV a deux aspects indépendants :

1. **Routing (statique)** — à quoi il s'applique. Déclaré une fois dans les déclarations, ne change pas pendant la scène.
2. **Placement temporel (dynamique)** — quand et combien de temps. Exprimé dans la grammaire comme n'importe quel objet temporel.

### Syntaxe

```bps
@filter                                              // charge lib/filter.json

// Déclaration : modulateur : cible = objet de lib (paramètres)
env1:Bass.cutoff = filter.adsr(attack:5, decay:150, sustain:0.2, release:400)
//    │   │   │     │      │
//    │   │   │     │      └─ paramètres (nommés ou positionnels)
//    │   │   │     └─ type d'objet dans la lib
//    │   │   └─ CVin cible : paramètre modulé (amp | freq | cutoff)
//    │   └─ voix (acteur) ; le transport est DÉDUIT de la voix (l'acteur le binde déjà)
//    └─ nom du modulateur (instance)

// Grammaire : placement temporel
S -> {Bass, env1 -}
//          │    │
//          │    └─ silence : env1 dure plus longtemps que Bass
//          └─ env1 est un objet temporel comme une note
```

> **Forme legacy (transport explicite)** : `env1(Bass, browser) = filter.adsr(...)` reste acceptée
> (cible et transport positionnels, sans CVin nommée). Préférer la forme route `env1:Bass.cutoff`
> qui nomme le paramètre cible et déduit le transport de la voix.

### Librairie (lib/filter.json)

```json
{
  "name": "filter",
  "type": "cv",
  "objects": {
    "adsr": {
      "parameters": {
        "attack":  { "unit": "ms", "default": 10 },
        "decay":   { "unit": "ms", "default": 100 },
        "sustain": { "unit": "ratio", "range": [0, 1], "default": 0.7 },
        "release": { "unit": "ms", "default": 200 },
        "stretch": { "type": "boolean", "default": false }
      },
      "input": "signal",
      "output": { "range": [0, 1], "description": "Normalized envelope curve" }
    },
    "lfo": {
      "parameters": {
        "rate":      { "unit": "Hz", "default": 4 },
        "amplitude": { "unit": "ratio", "range": [0, 1], "default": 0.5 },
        "shape":     { "values": ["sine", "triangle", "square", "saw"], "default": "sine" }
      },
      "input": "signal",
      "output": { "range": [-1, 1] }
    },
    "ramp": {
      "parameters": {
        "from": { "default": 0 },
        "to":   { "default": 1 }
      },
      "input": "signal",
      "output": { "range": [0, 1] }
    }
  }
}
```

## Contrat temporel

- L'objet CV reçoit sa **durée** de la grammaire (comme une note reçoit sa durée).
- C'est l'objet qui décide comment utiliser cette durée :
  - **stretch:true** → l'ADSR répartit ses phases proportionnellement dans la durée
  - **stretch:false** → l'ADSR joue A+D normalement, tient S, lance R quand la durée expire
- Si l'objet dépasse la durée allouée → **coupure** (même contrat qu'une note)
- Le silence `-` dans la grammaire permet d'allonger la durée du CV au-delà de l'entrée

## Niveaux d'entrée

L'entrée d'un CV peut être à n'importe quel niveau de la hiérarchie :

| Niveau | Syntaxe | Signification |
|--------|---------|---------------|
| Terminal | `env1(C4, browser)` | Enveloppe sur une note |
| Séquence polymétrique | `env1(Phrase1, browser)` | Enveloppe sur une voix |
| Sous-grammaire | `env1(gram2, browser)` | Enveloppe sur un bloc |
| Scène entière | `env1(*, browser)` | Enveloppe globale |

## Code du CV

Le comportement du CV est défini par du code **externe à BPScript** :

1. **Librairie JSON** — paramètres déclaratifs **ET la courbe** (bloc `curve`). La courbe vit dans
   la lib (pas dans le moteur) : segments déclaratifs (`to`/`dur`/`shape`, phase `hold`…`until`),
   ou `periodic` (LFO), ou `samples`, ou `expr`. Le **renderer est générique** : il lit `curve`
   sample-par-sample et ne connaît ni l'ADSR ni le LFO.
2. **Backtick inline** — code brut pour le live coding :
   ```bps
   env1(Phrase1, browser) = `js: new Float32Array([0, 0.5, 1, 0.8, 0])`
   ```
3. **Runtime externe** — Python, SuperCollider via bridge :
   ```bps
   env1(Phrase1, browser) = `py: numpy.linspace(200, 2000, 1000)`
   ```

BPScript ne sait pas ce qu'il y a dedans. C'est une étiquette avec une durée et un binding.

## Questions ouvertes

- ~~Comment exprimer le routing vers un paramètre spécifique ?~~ **Résolu (Romain 2026-06-19)** :
  forme route `env1:Bass.cutoff = filter.adsr(...)` — la CVin cible est nommée par la notation
  pointée `acteur.cvin`, le transport est déduit de la voix. Override de transport par patch =
  extension ultérieure.
- Peut-on chaîner des CV ? `env2(env1(Phrase1))` ?
- Comment le transport Web Audio implémente-t-il un CV ? `setValueCurveAtTime()` ?
- Faut-il un mécanisme de "bus" pour partager un CV entre plusieurs cibles ?

## Exemples

### ADSR sur filtre
```bps
@filter
@core
@controls
@alphabet.western:browser

env1(Phrase1, browser) = filter.adsr(10, 200, 0.5, 300)

S -> {Phrase1, env1 -}

Phrase1 -> C3 E3 G3 C4 (wave:sawtooth, filter:2000)
```

### LFO sur pan
```bps
@filter
@core
@controls
@alphabet.western:browser

wobble(Melody, browser) = filter.lfo(2, 80, shape:sine)

S -> {Melody, wobble}

Melody -> C4 D4 E4 F4 G4 A4 B4 C5
```

### Backtick CV (live coding)
```bps
@core
@controls
@alphabet.western:browser

custom(Phrase1, browser) = `js: (t, dur) => Math.sin(t / dur * Math.PI * 8) * 0.5 + 0.5`

S -> {Phrase1, custom}

Phrase1 -> C3 E3 G3 C4
```
