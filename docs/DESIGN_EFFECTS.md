# Effets et signal processing — pas de patching dans BPscript

## Principe

BPscript ne gère pas le graphe audio. Le **runtime** (SuperCollider, WebAudio, etc.)
câble les effets. BPscript scripte les **paramètres des effets dans le temps**.

Séparation des responsabilités :

| Couche | Responsabilité | Exemple |
|--------|---------------|---------|
| **Runtime** (backticks init) | câblage du graphe audio | `sitar → lpf → reverb → out` |
| **BPscript** (grammaire) | quand et comment les paramètres changent | `lpf.cutoff: ramp(200, 4000)` |
| **BP3** (moteur) | calcul des durées et de la synchronisation | polymétrie mélodie + courbe de filtre |

Pas de concept de patching, de bus, de chaîne, de `>` dans le langage.
Zéro mot en plus. Les effets sont pilotés avec les mécanismes existants :
CV, polymétrie, notation dot.

---

## Comment ça marche

### 1. Le runtime définit le graphe (backtick init)

Le câblage (serial, parallèle, send/return, sidechain) est dans le runtime.
C'est lui qui sait faire ça nativement.

**SuperCollider :**
```
`sc:
  ~sitar = Bus.audio(s, 2);
  ~lpf = Synth(\lpf, [\in, ~sitar, \out, 0, \cutoff, 1000]);
  ~reverb = Synth(\reverb, [\in, ~sitar, \out, 0, \mix, 0], addAction: \addAfter);
  ~reverb.run(false);
`
```

**WebAudio (browser) :**
```
`js:
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 1000;
  const reverb = ctx.createConvolver();
  sitar.connect(lpf).connect(reverb).connect(ctx.destination);
`
```

Le graphe peut être aussi simple ou complexe que le runtime le permet.
BPscript n'en sait rien et n'a pas besoin d'en savoir.

### 2. BPscript pilote les paramètres dans le temps

Les paramètres des effets sont placés en **polymétrie** — comme une voix
parallèle à la mélodie. BP3 calcule la synchronisation.

**Syntaxe :** `actor.effect.param(valeur)`

```
@actor sitar  alphabet:sargam  tuning:sargam_22shruti  transport:webaudio

// Phase 1 : mélodie + filtre qui s'ouvre
phrase1 -> { Sa Re Ga(vel:120) Pa Dha Ni Sa_^ _ , sitar.lpf.cutoff(ramp(200, 4000)) }

// Phase 2 : reverb activée + filtre grand ouvert
phrase2 -> `sc: ~reverb.run(true)`
           { Sa_^ Ni Dha Pa Ga Re Sa _ , sitar.lpf.cutoff(4000) sitar.reverb.mix(ramp(0, 0.4)) }
```

La mélodie et la courbe de filtre sont deux voix polymétriques.
L'ordre des voix n'a pas d'importance — elles sont simultanées.

### 3. Activation/désactivation d'effets

Allumer ou éteindre un effet à un moment précis se fait par backtick
dans le flux (c'est une opération du runtime, pas un paramètre) :

```
S -> phrase1 `sc: ~reverb.run(true)` phrase2 `sc: ~reverb.run(false)` phrase3
```

Ou via un paramètre conventionnel si le runtime le supporte :
```
S -> { phrase1 phrase2 phrase3 , sitar.reverb.active(0 0 _ _ 1 1 _ _ 0 0) }
```

---

## Portées des effets

Même pattern que partout dans BPscript :

| Portée | Syntaxe | Exemple |
|--------|---------|---------|
| **Acteur** | `actor.effect.param(...)` | `sitar.lpf.cutoff(ramp(200, 4000))` |
| **Scène** (master) | `effect.param(...)` (sans acteur) | `reverb.mix(0.3)` |

Sans qualificateur d'acteur → s'applique au master bus de la scène.
Avec acteur → dédié à cet acteur.

---

## Ce que BPscript NE fait PAS

- **Pas de câblage** — le graphe audio est dans le runtime
- **Pas d'ordre de chaîne** — serial/parallèle/send-return, c'est le runtime
- **Pas de DSP** — BPscript ne traite pas le signal
- **Pas de bus** — l'acteur est le seul niveau de granularité
- **Pas de nouveau mot-clé** — tout passe par la notation dot + polymétrie + CV

---

## Exemples complets

### Filtre qui s'ouvre sur un raga

```
@actor sitar  alphabet:sargam  tuning:sargam_22shruti  octaves:saptak  transport:webaudio

`js:
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  sitar.connect(lpf).connect(ctx.destination);
`

S -> { alap jor jhala , sitar.lpf.cutoff(ramp(200, 8000)) }

alap  -> Sa _ Re _ Ga _ Pa _
jor   -> Sa Re Ga Pa Dha Ni Sa_^ _
jhala -> {Sa Re Ga Pa Dha Ni Sa_^ Ni}[speed:4]
```

Le filtre s'ouvre progressivement sur toute la durée de la pièce (alap → jhala),
en parallèle avec la mélodie. BP3 synchronise les deux voix.

### Multi-effets temporels avec SuperCollider

```
@actor sitar  alphabet:sargam  transport:osc  eval:sclang

`sc:
  ~bus = Bus.audio(s, 2);
  ~lpf = Synth(\lpf, [\in, ~bus, \out, 0, \cutoff, 2000]);
  ~delay = Synth(\delay, [\in, ~bus, \out, 0, \time, 0.25, \mix, 0], addAction: \addAfter);
  ~reverb = Synth(\reverb, [\in, ~bus, \out, 0, \mix, 0], addAction: \addAfter);
`

S -> intro developpement climax

intro -> { Sa _ Re _ Ga _ , sitar.lpf.cutoff(ramp(2000, 800)) }

developpement -> `sc: ~delay.set(\mix, 0.3)`
                 { Sa Re Ga Pa Dha Ni , sitar.lpf.cutoff(ramp(800, 4000)) }

climax -> `sc: ~reverb.set(\mix, 0.4)`
          { {Sa Re Ga Pa Dha Ni Sa_^}[speed:2] , sitar.lpf.cutoff(4000) sitar.delay.time(ramp(0.25, 0.05)) }
```

Le delay entre au développement (backtick), la reverb au climax (backtick).
Le cutoff du filtre et le temps du delay sont pilotés par BPscript en polymétrie.

---

## Pourquoi pas de patching dans BPscript

1. **Le runtime sait mieux** — SuperCollider, WebAudio, Csound ont des graphes
   de signal natifs, optimisés, avec des possibilités (feedback, FFT, granulaire)
   qu'un langage déclaratif ne peut pas couvrir.

2. **Chaque runtime est différent** — WebAudio a des AudioNodes, SC a des Synths
   et des Bus, MIDI ne sait pas du tout faire du signal processing. Un patching
   dans BPscript serait implémentable sur certains transports et pas d'autres.

3. **Séparation des préoccupations** — BPscript sait le **quand**.
   Le runtime sait le **comment**. Comme pour les notes : BPscript dit
   "joue Sa à 240 Hz pendant 1s", pas "crée un oscillateur sinusoïdal
   avec une enveloppe ADSR".

4. **Zéro complexité ajoutée** — pas de nouveau symbole, pas de nouveau concept.
   Les effets sont pilotés avec ce qui existe déjà : CV, polymétrie, backticks.
