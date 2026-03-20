# BPscript — Backlog

## Priorité haute

### Resolver musical complet
Le mapping note → fréquence est en dur (Western 12-TET, A=440).
- **Degrés** : mapping sargam (sa, re, ga...) → fréquences (données dans lib/alphabet.json)
- **Tempérament** : pythagoricien, meantone, just intonation, etc.
- **Référence configurable** : A=440 par défaut, modifiable via `@tuning:442`
- **Microtonalité** : échelles à N divisions de l'octave
- **Impact** : suppression du format OCT de BP3 → le transport JS gère tout

### Transpose dispatcher
La suppression de OCT a supprimé `_trns` interne de BP3.
- `(transpose:N)` existe dans BPscript mais pas implémenté côté audio
- Le resolver doit transposer dans le tempérament actif
- Support transposition par intervalle (pas seulement demi-tons)

## Priorité moyenne

### Routage CV multi-cibles
Actuellement le CV crée un bus audio global — toutes les notes passent à travers.
- Routage par cible : `env1(Phrase1, browser)` ne doit affecter que les notes de Phrase1
- Gestion de l'empilement de filtres
- Bus audio persistants par cible

### CV chaînage
- `env2(env1(Phrase1))` — un CV qui contrôle un autre CV
- Nécessite un graphe de routage

## Priorité basse

### Performance
- Recycler les AudioNode au lieu d'en créer de nouveaux à chaque note
- Pool de oscillateurs/filtres

### CV runtimes externes
- `env1(Phrase1, sc) = \`py: numpy.linspace(200, 2000, 1000)\``
- Bridge Python/SuperCollider pour les courbes CV
