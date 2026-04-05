# Architecture : Déformation temporelle en temps réel

Version 1.0 — 26 mars 2026

## Vision

BP3 est un compilateur de structures temporelles. Il produit un résultat statique.
L'objectif est de le transformer en **instrument** : un système où l'utilisateur
peut déformer la dimension temporelle en continu, comme on tourne un potard
sur un synthé, sans recompiler, sans attendre le prochain cycle.

Ce document décrit l'architecture qui rend ça possible.

---

## Principe

BP3 produit une structure temporelle. Le constraint solver la déforme en temps
réel selon les gestes de l'utilisateur. Le dispatcher joue le résultat déformé.

```
BP3 = oscillateur          → produit la forme de base
Constraint solver = filtre → déforme la forme en continu
Dispatcher = ampli         → envoie le résultat aux sorties
```

On ne change pas le moteur. On ajoute un corps de résonance autour.

---

## Le problème avec la sortie actuelle

`bp3_get_timed_tokens()` retourne une liste plate :

```json
[
  {"token": "A",    "start": 0,    "end": 1000},
  {"token": "B",    "start": 1000, "end": 2000},
  {"token": "dhin", "start": 0,    "end": 1333},
  {"token": "dha",  "start": 1333, "end": 2666}
]
```

L'arbre structurel est perdu. On ne sait plus que `A` et `B` sont dans la même
voix, que `dhin` et `dha` sont dans une voix parallèle, ni que les deux voix
sont contraintes à la même durée totale.

Sans cette information, on ne peut pas déformer intelligemment : étirer `A`
sans savoir ce que ça implique pour `B` et pour `dhin`.

---

## Deux sorties complémentaires

### 1. Timed tokens (existant)

Liste plate des feuilles avec timestamps absolus. Inchangé.
C'est ce que le dispatcher consomme pour le playback.

### 2. Structure tree (nouveau)

Arbre de la dérivation avec proportions et contraintes.
C'est ce que le constraint solver consomme pour la déformation.

```json
{
  "root": "S",
  "span": [0, 4000],
  "children": [
    {
      "type": "polymetric",
      "span": [0, 4000],
      "constraint": "equal-span",
      "voices": [
        {
          "id": "melody",
          "proportions": [0.25, 0.25, 0.25, 0.25],
          "leaves": [
            {"token": "A",  "index": 0},
            {"token": "B",  "index": 1},
            {"token": "C",  "index": 2},
            {"token": "D",  "index": 3}
          ]
        },
        {
          "id": "rhythm",
          "proportions": [0.333, 0.333, 0.333],
          "leaves": [
            {"token": "dhin", "index": 0},
            {"token": "dha",  "index": 1},
            {"token": "ge",   "index": 2}
          ]
        }
      ]
    }
  ]
}
```

**Ce que l'arbre porte :**

| Champ | Rôle |
|-------|------|
| `span` | Durée totale du noeud (ms) |
| `proportions` | Part relative de chaque enfant dans le span |
| `constraint` | Règle de couplage entre voix parallèles |
| `leaves` | Référence vers les timed tokens (par index ou token) |
| `type` | `polymetric`, `sequence`, `group` |

**Ce que l'arbre ne porte PAS :**
- Pas de fréquences, pas de contrôles (c'est le REPL et le dispatcher)
- Pas de contenu sémantique (c'est opaque, comme toujours)

---

## Le constraint solver

### Rôle

Prend le structure tree + les gestes utilisateur → recalcule les timestamps
de tous les timed tokens. Purement JS, temps réel, pas de WASM.

### Entrées

```
Structure tree (de BP3, une fois)
  +
Gestes utilisateur (continus) :
  - Modifier la proportion d'un élément (potard, drag, MIDI CC)
  - Relâcher/resserrer une contrainte
  - Sélectionner un mode de propagation
```

### Sortie

Timed tokens avec timestamps recalculés. Même format que BP3, le dispatcher
ne voit pas la différence.

### Modes de contrainte

Quand l'utilisateur étire un élément, le solver doit décider comment les
autres s'adaptent. Trois modes fondamentaux :

#### Mode 1 — Span fixe

Le conteneur garde sa durée totale. Les fratries se compriment pour compenser.

```
Avant :  A(1/4)  B(1/4)  C(1/4)  D(1/4)     dans 4000ms
Geste :  étirer A à 1/3
Après :  A(1/3)  B(2/9)  C(2/9)  D(2/9)     dans 4000ms

Voix parallèle (rhythm) : inchangée (même span)
```

Usage : garder la structure métrique intacte, redistribuer l'espace interne.

#### Mode 2 — Proportions fratries fixes

Les fratries gardent leur durée absolue. Le conteneur s'étire ou se comprime.
La contrainte polymétrique propage le changement aux voix parallèles.

```
Avant :  A(1000ms) B(1000ms) C(1000ms) D(1000ms)    total: 4000ms
Geste :  étirer A à 1333ms
Après :  A(1333ms) B(1000ms) C(1000ms) D(1000ms)    total: 4333ms

rhythm (contrainte equal-span) :
  → dhin(1444ms) dha(1444ms) ge(1444ms)              total: 4333ms

S : 4000ms → 4333ms
```

Usage : donner plus d'espace à un élément, laisser la pièce respirer.

#### Mode 3 — Contrainte relâchée

Les voix parallèles ne sont plus liées. Elles dérivent l'une par rapport à l'autre.

```
melody : A(1333ms) B(1000ms) C(1000ms) D(1000ms)   total: 4333ms
rhythm : dhin(1333ms) dha(1333ms) ge(1333ms)        total: 4000ms (inchangé)

→ déphasage progressif entre les deux voix
```

Usage : créer du phasing à la Steve Reich, désynchroniser des couches.

### Propagation

Les modifications se propagent dans l'arbre selon deux directions :

**Vers le bas** : quand un conteneur change de durée, ses enfants sont
redimensionnés proportionnellement (sauf si une proportion enfant a été
explicitement modifiée).

**Vers le haut** : quand un enfant change de taille en mode 2, le conteneur
parent s'adapte, et ses frères et soeurs aussi (selon les contraintes actives).

Le solver parcourt l'arbre et résout les contraintes en un seul pass
(les arbres sont peu profonds — rarement plus de 5-6 niveaux).

---

## Pipeline complet

```
┌──────────────────────────────────────────────────────────┐
│  COUCHE 1 — STRUCTURE (BP3 WASM)                         │
│                                                          │
│  Grammaire → dérivation → polymétrie → phase diagram     │
│                                                          │
│  Sortie :                                                │
│    - timed tokens (feuilles avec timestamps)             │
│    - structure tree (proportions + contraintes)           │
│                                                          │
│  Opère en cycles. Batch. Pas de temps réel.              │
└────────────────────┬─────────────────────────────────────┘
                     │ (une fois, ou à chaque re-dérivation)
                     ▼
┌──────────────────────────────────────────────────────────┐
│  COUCHE 2a — REPL (résolution contenu)                   │
│                                                          │
│  Étiquettes homomorphismes → noms résolus                │
│  Pitch resolution → fréquences                           │
│  Contrôles CT → paramètres son                           │
│                                                          │
│  Opère une fois après chaque dérivation.                 │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│  COUCHE 2b — CONSTRAINT SOLVER (déformation temporelle)  │
│                                                          │
│  Entrées continues :                                     │
│    - potards physiques (WebMIDI)                         │
│    - MIDI CC / OSC                                       │
│    - CV internes (LFO, ramp, ADSR)                       │
│    - drag sur l'interface web                            │
│    - code live (backticks)                               │
│                                                          │
│  Opérations :                                            │
│    - modifier proportion d'un élément                    │
│    - changer le mode de contrainte                       │
│    - recalculer tous les timestamps                      │
│                                                          │
│  Opère en temps réel. Chaque geste → nouveau scheduling. │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│  COUCHE 3 — DISPATCHER + TRANSPORTS                      │
│                                                          │
│  Reçoit les timed tokens (déformés ou non).              │
│  Schedule et envoie aux sorties.                         │
│  WebAudio, MIDI, OSC, DMX.                               │
└──────────────────────────────────────────────────────────┘
```

### Notes sur l'ordre des couches

Le REPL (2a) résout le **contenu** (quels noms, quelles fréquences).
Le solver (2b) résout le **temps** (quand, combien de temps).

Les deux sont indépendants : changer un nom ne change pas un timestamp,
changer un timestamp ne change pas un nom. Ils peuvent opérer en parallèle
ou dans n'importe quel ordre.

Le dispatcher reçoit le produit final : des événements avec noms résolus
ET timestamps déformés.

---

## Contrôle en live

### Sources de contrôle

| Source | Protocole | Latence | Usage |
|--------|-----------|---------|-------|
| Potards physiques | WebMIDI CC | <5ms | performance live |
| Faders OSC | OSC over UDP | <10ms | installation, TouchOSC |
| Interface web | DOM events | <16ms | souris, drag, sliders |
| CV internes | LFO/ramp JS | <1ms | automation programmée |
| Code live | backtick eval | variable | manipulation par script |

### Mapping

Chaque source de contrôle est mappée à un paramètre du solver :

```
MIDI CC 1  →  proportion de "melody.A"     (range 0.05 — 0.8)
MIDI CC 2  →  contrainte "polymetric.1"    (0=fixed, 0.5=semi, 1=free)
MIDI CC 3  →  swing global                 (0 — 1)
LFO 1      →  proportion de "rhythm.dhin"  (oscille entre 0.2 et 0.5)
```

Le mapping est déclaré dans la scène BPscript (syntaxe à définir) ou
dans un fichier de configuration.

---

## Ce qui existe vs ce qui est à construire

### Existe déjà

- BP3 WASM : dérivation, polymétrie, phase diagram ✅
- Timed tokens : sortie plate ✅
- REPL : résolution étiquettes (Phase 1, en cours) ✅
- Dispatcher : scheduling et routing ✅
- CV objects : LFO, ramp, ADSR (design) ✅
- Web interface : affichage résultat ✅

### À construire

| Composant | Priorité | Dépend de |
|-----------|----------|-----------|
| `bp3_get_structure_tree()` | Phase 2 | Vérifier que l'info existe en mémoire WASM |
| Constraint solver (JS) | Phase 2 | Structure tree |
| Modes de contrainte (3 modes) | Phase 2 | Solver |
| WebMIDI input | Phase 3 | Solver |
| Mapping contrôles → paramètres | Phase 3 | WebMIDI + solver |
| Interface web : visualisation arbre | Phase 3 | Structure tree |
| Interface web : drag pour déformer | Phase 4 | Visualisation + solver |
| Morphing entre dérivations | Phase 5 | Solver + multi-dérivation |

### Question ouverte pour le moteur WASM

**L'information structurelle existe-t-elle en mémoire après `bp3_produce()` ?**

BP3 résout la polymétrie via un phase diagram pendant la production. Après
production, les timestamps sont calculés et stockés. Mais l'arbre structurel
(quels tokens appartiennent à quelle voix, quelles proportions, quelles
contraintes) est-il encore accessible, ou est-il jeté après résolution ?

Si l'arbre est encore en mémoire → exposer via `bp3_get_structure_tree()`.
Si l'arbre est jeté → deux options :
  1. Modifier le moteur pour le conserver (changement Bernard)
  2. Reconstruire l'arbre côté JS à partir du texte de dérivation
     (`bp3_get_result()` retourne `{A B C D, dhin dha ge}` — la structure
     polymétrique est visible dans le texte)

L'option 2 est préférable (pas de changement moteur).

---

## Relation avec les autres documents

Ce document décrit la vision de la déformation temporelle. Il s'appuie sur :

- [DESIGN_ARCHITECTURE.md](DESIGN_ARCHITECTURE.md) — Pipeline compile/runtime
- [DESIGN_HOMOMORPHISM_LABELING.md](DESIGN_HOMOMORPHISM_LABELING.md) — REPL (résolution contenu)
- [DESIGN_INTERFACES_BP3.md](DESIGN_INTERFACES_BP3.md) — Sorties BP3 actuelles
- [DESIGN_CV.md](DESIGN_CV.md) — CV objects (sources de contrôle continu)

Et il prépare les phases futures :

- Callbacks WASM→JS (Phase 3 homomorphismes) — influencer la dérivation en live
- Morphing structural (Phase 5) — interpolation entre dérivations
