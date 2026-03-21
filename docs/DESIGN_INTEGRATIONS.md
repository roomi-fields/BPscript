# Intégrations externes — Ableton, VCV Rack, et autres

## Philosophie

BPscript est un méta-ordonnanceur agnostique. Il n'est couplé à aucune cible.
L'intégration passe par les **transports universels** (OSC, MIDI) — le même
output alimente Ableton, VCV Rack, Processing, SuperCollider, etc.

---

## VCV Rack (eurorack virtuel)

**Statut : résolu par l'architecture existante.**

VCV Rack dispose de modules OSC (cvOSCcv, trowaSoft) qui convertissent
des messages OSC en signaux CV/gate/trigger.

Les types BPscript (gate, trigger, cv) correspondent exactement aux signaux
eurorack — c'est pour ça qu'on les a choisis.

Configuration dans `routing.json` :
```json
{
  "eurorack": {
    "transports": {
      "vcv": { "type": "osc", "host": "127.0.0.1", "port": 7000 }
    }
  }
}
```

Pas d'architecture spécifique requise. C'est de la plomberie OSC.

---

## Ableton / Max for Live

### Stratégie court terme : OSC bridge

Un device M4L minimal (~10 lignes Max) reçoit du OSC et le convertit
en MIDI dans Ableton. BPscript tourne en standalone, envoie via le
transport OSC existant.

Avantages :
- Fonctionne avec l'architecture actuelle
- Zéro couplage — BPscript ne sait pas qu'Ableton existe
- Même device réutilisable pour n'importe quelle source OSC

### Stratégie moyen terme : Ableton Link

Ableton Link est un protocole ouvert pour la synchronisation de tempo
entre applications (réseau local, zéro config).

BPscript pourrait supporter Link pour :
- Synchroniser le clock BP3 avec le tempo d'Ableton
- Permettre le live coding à côté d'Ableton (pas dedans)
- Fonctionner aussi avec d'autres apps Link (Reason, Traktor, etc.)

C'est le meilleur rapport effort/valeur pour l'intégration Ableton
sans s'engager sur un format M4L.

### Stratégie long terme : device Max for Live

> **Non mûr pour décision.** Les questions ci-dessous restent ouvertes.
> La réponse viendra du dog-fooding — composer avec BPscript d'abord,
> designer l'intégration ensuite.

Questions ouvertes :

1. **Format du device** — jweb (navigateur embarqué) ? External Max
   avec WASM ? Simple bridge OSC amélioré ?

2. **Clock** — qui tient l'horloge ? Ableton (via Link/MIDI clock)
   ou BP3 ? Comment synchroniser les deux ?

3. **Clips vs grammaires** — un clip Ableton = une scène BPscript ?
   Les clips contiennent du BPscript source ou des grammaires dérivées ?

4. **MIDI output** — le device produit du MIDI dans Ableton que les
   autres pistes reçoivent ? Ou de l'audio direct ?

5. **Paramètres automatisables** — les flags BPscript exposés comme
   paramètres M4L ? Le compositeur dessine des automations Ableton
   sur les flags ?

### Séquence recommandée

```
1. OSC bridge (maintenant)
   → BPscript standalone → OSC → device M4L minimal → MIDI dans Ableton

2. Ableton Link (quand le dispatcher est stable)
   → clock synchronisé, BPscript à côté d'Ableton

3. Dog-fooding (avant toute décision M4L)
   → composer avec BPscript, découvrir le workflow réel

4. Device M4L (quand le workflow est prouvé)
   → intégration profonde, format à déterminer
```

---

## Autres cibles

Toutes les cibles OSC/MIDI sont supportées par le transport existant :

| Cible | Transport | Notes |
|-------|-----------|-------|
| SuperCollider (scsynth) | OSC | cible principale |
| Processing / p5.js | OSC | visuels |
| TouchDesigner | OSC | visuels live |
| DMX (lumières) | OSC via bridge | Python ou OLA |
| MIDI hardware | MIDI | synthés, contrôleurs |
| Web Audio | API directe (browser) | démo, prototypage |
| Csound | OSC | synthèse |
| Max/MSP (standalone) | OSC | sans Ableton |
| Robots / IoT | OSC / serial | installations |
