# BPscript — Vision

## Principe fondamental

BP est un **ordonnanceur** : il dérive des structures temporelles de symboles.
Les symboles sont des noms. Ce que ces noms signifient est défini par des librairies.
Le langage lui-même ne connaît aucun mot.

## Trois types de signaux

Inspirés de l'eurorack (définis par la librairie `@core`, pas par le langage) :
- **Gate** — événement avec durée (start + end). Exemple : une note tenue, un pad.
- **Trigger** — déclenchement ponctuel (instant). Exemple : un coup de percussion, un changement de preset.
- **CV** — valeur continue qui évolue dans le temps. Exemple : un pitch bend, un filtre qui s'ouvre.

## Le langage : 9 symboles, zéro mot

```
@           directive système (import, config, méta)
-> <- <>    dérivation + direction
{ , }       polymétrie (simultané)
( )         arguments
:           paramètre (clé: valeur)
=           définition
[ ]         options (mode de dérivation, etc.)
```

Tout le reste — `gate`, `trigger`, `cv`, `_` (silence), `pluck`, `C4`, `attack`, `rate` —
vient des librairies importées via `@`. Le langage ne sait pas ce que ça veut dire.

**Pas de `|`, pas de `if`, pas de `for`, jamais.** BPscript décrit des structures
dans le temps. Toute logique conditionnelle, traitement de signal ou chaînage
algorithmique est du ressort d'un vrai langage de programmation (SuperCollider,
Python, JavaScript) exposé à BPscript via des noms simples.

## Trois natures syntaxiques

Le langage distingue structurellement :
1. **Symbole** — un nom dans le temps, dérivable et ordonnançable (`pluck`, `C4`, `hit`)
2. **Argument** — un symbole passé à un autre via `()` (`pluck(C4)`)
3. **Paramètre** — une paire clé:valeur qui qualifie un symbole (`brightness: 0.7`)

Le langage reconnaît ces trois formes mais n'en connaît pas la sémantique.
Les paramètres sont libres : `brightness`, `mood`, `banane` — le langage s'en fiche.
C'est le récepteur (SC, Python, Web Audio) qui les interprète.

## Trois couches (MusicOSI)

### Définition (le vocabulaire)

Décrire des comportements paramétrés, réutilisables, composables.
Comme des classes CSS : on nomme un comportement, on le réutilise partout.
Les mots utilisés viennent des librairies importées.

```
@audio
@raga

// Un gate paramétré : déclenche un son avec une attaque courte et un decay.
// `pitch` est obligatoire, `brightness` a une valeur par défaut.
// `gate`, `attack:`, `decay:`, `filter:` viennent de @audio.
pluck(pitch, brightness: 0.7) = gate(pitch) {
  attack: 5ms
  decay: 200ms
  filter: lp(brightness * 10000)
}

// Une macro : transforme un événement existant en raccourcissant sa durée à 30%.
// S'applique à n'importe quel gate, trigger ou CV.
staccato(x) = x { dur: 30% }

// Une macro chaînable : ajoute un trémolo à n'importe quel événement.
trem(x) = x { rate: 8hz, depth: 0.3 }

// Une gamme microtonale : utilise les mots de @raga.
ma_gamme = scale {
  notes: Sa re Ga ma Pa dha Ni
  ratios: 1/1 16/15 5/4 45/32 3/2 8/5 15/8
  base: C4
}
```

### Composition (la structure temporelle)

Le coeur BP : dérivation, polymétrie, proportions.
On compose des symboles dans le temps. Le moteur BP dérive et résout la structure.

```
// Trois notes pluckées en séquence, avec un filtre qui s'ouvre progressivement
// et une ambiance qui change. Chaque ligne est synchronisée sur les mêmes
// slots temporels.
S -> { pluck(C4)        pluck(E4)        pluck(G4),
       intensity(0.2)   intensity(0.5)   intensity(1.0),
       mood(dark)        mood(dark)        mood(bright) }

// Le moteur BP dérive et ordonnance. Il envoie chaque symbole avec ses
// paramètres au bon moment. Le récepteur (SC, Python) interprète
// intensity et mood comme il veut — BPscript ne sait pas ce que ça signifie.

// Dérivation avec mode aléatoire : le moteur choisit une branche au hasard.
S -> A B C [random]

// Direction inversée : le moteur dérive de droite à gauche.
S <- A B C

// Macros appliquées à une structure polymétrique.
// staccato raccourcit, trem fait vibrer.
S -> staccato(trem({ C4 E4 G4 }))

// Dérivation récursive : A se réécrit, créant des structures imbriquées.
A -> pluck(C4) B pluck(G4)
B -> hit hit _ hit

// Les paramètres sont dérivables comme les symboles.
// Ici la ligne mood est dérivée par une règle aléatoire :
M -> mood(dark) [random]
M -> mood(bright) [random]
S -> { pluck(C4) pluck(E4), M M }
```

### Exécution (le contexte)

Le binding vers le monde réel. Le même document BPscript est interprété
différemment selon le contexte — comme un navigateur pour HTML+CSS.

La logique complexe (conditions, boucles, traitement de signal) est écrite
dans un vrai langage de programmation côté récepteur, pas dans BPscript.

```
@supercollider

// Côté SC, le développeur a écrit les SynthDefs avec toute la logique
// nécessaire (if, boucles, UGens, etc.). BPscript ne voit que les noms.
pluck => synth(\PluckString, freq: from_pitch)
hit => sample("kick.wav")
intensity => param(\filter, cutoff)
mood => param(\filter, type)    // SC décide que dark = lp(400), bright = lp(4000)
```

```
@midi

// En contexte MIDI : pluck devient un NoteOn, hit une note sur canal 10 (drums).
pluck => note(from_pitch, channel: 1)
hit => note(36, channel: 10)
```

```
@dmx

// En contexte lumières : on ignore les sons, on réagit aux hits et moods.
hit => flash(color: red)
mood => ambient(from_value)
```

Le compositeur ne touche pas les bindings. Il écrit sa structure,
quelqu'un d'autre (ou un preset) connecte au monde réel.

## Communication avec les récepteurs

BPscript envoie des événements typés avec leurs paramètres via OSC.
Chaque symbole devient un message :

```
// BPscript :
wobble(C4, intensity: 0.9, mood: dark)

// Ce qui part en OSC au temps t :
/bp/wobble  261.63  0.9  "dark"

// SC reçoit et fait ce qu'il veut avec — y compris de la logique complexe :
// if(mood == 'dark') { cutoff = 400 } else { cutoff = 4000 }
```

BPscript ne sait pas ce que `dark` veut dire. SC si.

## Modes et directions BP3

Les 7 modes de dérivation et 3 directions de BP3 sont préservés.
Ils deviennent des options entre crochets, pas des mots-clés :

```
S -> A B C             // par défaut : ordered, gauche à droite
S -> A B C [random]    // mode aléatoire
S <- A B C             // droite à gauche
S <> A B C             // bidirectionnel
```

Un débutant n'a pas besoin de connaître les modes. Il écrit `S -> A B C` et ça marche.
Un utilisateur avancé ajoute `[random]` ou `<-` quand il en a besoin.

## Librairies

Le langage ne connaît aucun mot. Les librairies apportent le vocabulaire.
Elles sont **écrites** dans un vrai langage (JS, Python, SC) et **utilisées**
en BPscript via des noms simples.

```
@core               // gate, trigger, cv, _ (silence) — les types de base
@audio              // attack:, decay:, filter:, rate:, depth:
@midi               // note, channel:, velocity:, cc:
@raga               // Sa, Re, Ga, Ma, Pa, Dha, Ni, meend, gamak
@western            // C, D, E, F, G, A, B, sharp, flat
@patterns           // fast(), slow(), rev(), every(), euclid()
@dmx                // color:, intensity:, fade:, flash, strobe
@supercollider      // synth(), sample(), param(), bus:
@osc                // addr:, port:
```

Quelqu'un qui fait de la musique indienne importe `@raga`.
Quelqu'un qui fait du VJing importe `@dmx`.
Quelqu'un qui fait les deux importe les deux.
On peut créer et partager ses propres librairies.

## Live coding

Modifier en live, recompiler à chaud :
- Changer une **définition** -> le timbre/comportement change, la structure reste
- Changer la **composition** -> la structure change, les timbres restent
- Changer un **binding** -> la destination change, la musique reste

Trois leviers indépendants. Le moteur BP3 re-dérive en temps réel.
Compatible avec SuperCollider pour le live coding hybride :
BPscript génère la structure, SuperCollider produit le son.

## Philosophie de séparation

BPscript ne fait qu'une chose : **ordonner des symboles dans le temps.**

- Logique conditionnelle -> SuperCollider, Python, JavaScript
- Traitement de signal -> SuperCollider, Csound, Web Audio
- Sound design -> SuperCollider SynthDefs, Csound instruments
- Boucles et algorithmes -> le langage de programmation de votre choix

Comme HTML ne contient pas de `if` et CSS ne contient pas de `for`.
Chaque langage fait ce qu'il sait faire. BPscript sait faire le temps.

## Architecture technique

```
BPscript (navigateur)
  -> Parser (traduit la syntaxe en format BP3 interne)
  -> Moteur BP3 WASM (dérive et résout la structure temporelle)
  -> Événements typés (gate/trigger/CV avec paramètres)
  -> Sorties :
       Web Audio / Csound WASM (dans le navigateur, direct)
       OSC via WebSocket bridge (~50 lignes) -> SuperCollider
       OSC -> Python
       Web MIDI API -> instruments MIDI hardware
       DMX, vidéo, etc. via librairies
```

- Moteur BP3 WASM = dérivation + résolution temporelle (existant, compilé)
- BPscript parser = traduit la syntaxe minimale vers le moteur BP3 (à créer)
- Librairies = écrites en JS/Python/SC, exposent des noms à BPscript
- Le parser et le moteur tournent dans le navigateur
