# BPscript — Vision

## Principe fondamental

BPscript est un **meta-ordonnanceur** : il derive des structures temporelles
et orchestre des comportements complexes ecrits dans des vrais langages
(SuperCollider, TidalCycles, Python, etc.) avec la puissance des grammaires
formelles pour decider **quand** ces comportements se declenchent.

Les symboles sont des noms avec un double contrat :
- **Type temporel** : comment ils se comportent dans le temps (gate, trigger, cv)
- **Runtime** : qui les manipule (sc, tidal, python, midi...)

Le langage connait trois mots et ne fait qu'une chose : ordonner dans le temps.

---

## Le langage : dense, pas simple

3 mots reserves, 24 symboles, 7 operateurs -- le vocabulaire est petit mais la
combinatoire est riche. Comme les echecs : 6 types de pieces, complexite infinie.

```
// Trivial -- une sequence de notes
S -> Sa Re Ga Pa

// Intermediaire -- polymetrie avec triggers et flags
[phase==1] S -> { Sa!dha Re!ti, -!spotlight _ }

// Complexe -- templates, captures, homomorphismes, multi-runtime
|x| (A) x!dha B -> x!ti $mel &mel [mode:random, phase+1]
```

La vraie promesse : un compositeur peut commencer avec `S -> Sa Re Ga` et
decouvrir progressivement la polymetrie, les flags, les captures, les backticks.
Chaque feature est optionnelle -- la complexite est **additive**, pas imposee.

---

## Concepts cles

### Double declaration (type + runtime)

Chaque symbole est declare avec son type temporel et son runtime :
```
gate Sa:sc                       // gate (duree) gere par SuperCollider
trigger flash:python             // trigger (instant) gere par Python
cv ramp:sc                       // cv (continu) gere par SuperCollider
```

### `[]` moteur vs `()` runtime

Deux destinataires distincts, toujours en suffixe :
- `[]` = instructions pour le **moteur BP3** : `[mode:random]`, `[speed:2]`, `[/2]`
- `()` = parametres pour le **runtime cible** : `(vel:120)`, `(wave:sawtooth)`

### Backticks -- code natif dans le flux

```
`sc: SynthDef(\grain, {...}).add`      // orphelin -- init avant derivation
Sa(vel:`rrand(40,127)`)                // inline -- evalue par le runtime du symbole
`sc: i = i + 1`                       // standalone -- execute au temps T
```

### Simultaneite `!` et synchronisation `<!`

```
Sa!dha!spotlight          // 3 runtimes au meme instant
<!sync1 Sa Re Ga          // attend un signal externe avant de jouer
```

### Acteur -- unite de binding

Un acteur lie alphabet + tuning + octaves + transport :
```
@actor sitar  alphabet:sargam  tuning:sargam_22shruti  octaves:saptak  transport:webaudio
```

### Sounds system -- cascading

Les parametres se combinent par priorite : **spec** (defauts librairie) < **CT** (controles inline `()`) < **CV** (objets temporels continus).

---

## Philosophie de separation

BPscript ne fait qu'une chose : **ordonner des symboles types dans le temps.**

- Logique algorithmique -> backticks (dans le langage du runtime cible)
- Traitement de signal -> runtime (SuperCollider, Csound, Web Audio)
- Sound design -> runtime (SynthDefs, instruments)
- Routage -> fichier de routage (JSON)
- Temperament et accordage -> fichier de tuning (JSON)

Comme HTML ne contient pas de boucles et CSS ne contient pas de fonctions.
Chaque couche fait ce qu'elle sait faire. BPscript sait faire le temps.

---

## Le meta-ordonnanceur

L'idee centrale : BP3 sait **quand**. SC, Tidal, Python savent **quoi**.
Les backticks connectent les deux dans un seul fichier.

```
// Initialisation -- chaque runtime prepare ses objets
`sc: SynthDef(\grain, { |freq, dens| GrainSin.ar(dens, freq) }).add`
`tidal: let pat = s "bd sd hh sd"`
`py: import dmx; d = dmx.open()`

// Structure temporelle -- BP3 orchestre tout
[phase==1] S -> { intro, rythme }
[phase==2] S -> { melodie, rythme, lumieres }
```

Un fichier. Trois langages. Un seul ordonnanceur. Live-codable.

Le meta-ordonnanceur est agnostique de la cible :
- **Audio** : SuperCollider, Csound, Web Audio
- **Patterns** : TidalCycles (via SuperDirt)
- **Lumieres** : DMX via Python/OSC
- **Video** : Processing, TouchDesigner via OSC
- **Eurorack** : gate/trigger/CV via OSC, MIDI
- **Graphiques** : Canvas, WebGL, SVG via JavaScript
- **Installations** : capteurs, actionneurs, IoT
- **Tout ce qui a besoin d'etre orchestre dans le temps**

---

## Documents de design detailles

### Langage et grammaire
- [DESIGN_LANGUAGE.md](DESIGN_LANGUAGE.md) -- Specification complete du langage : symboles, types, declarations, macros, flags, templates, liaisons, contextes, operateurs temporels
- [DESIGN_GRAMMAR.md](DESIGN_GRAMMAR.md) -- Mapping BPscript -> BP3 : regles, modes, sous-grammaires, derivation
- [BPSCRIPT_EBNF.md](BPSCRIPT_EBNF.md) -- Grammaire formelle EBNF
- [BPSCRIPT_AST.md](BPSCRIPT_AST.md) -- Structure de l'AST

### Architecture
- [DESIGN_ARCHITECTURE.md](DESIGN_ARCHITECTURE.md) -- Architecture technique : pipeline compile/runtime, dispatcher, transports, REPL adapters, live coding
- [DESIGN_INTERFACES_BP3.md](DESIGN_INTERFACES_BP3.md) -- Interface WASM BP3 : specification in/out

### Pitch et resolution
- [DESIGN_PITCH.md](DESIGN_PITCH.md) -- Architecture 5 couches pitch : alphabet, octaves, temperament, tuning, resolver
- [DESIGN_ACTOR.md](DESIGN_ACTOR.md) -- Concept d'acteur : binding alphabet + tuning + octaves + transport

### Son et controle
- [DESIGN_SOUNDS.md](DESIGN_SOUNDS.md) -- Systeme sounds : spec < CT < CV cascading
- [DESIGN_CV.md](DESIGN_CV.md) -- CV / signal objects : ADSR, LFO, ramp
- [DESIGN_EFFECTS.md](DESIGN_EFFECTS.md) -- Effets et signal processing (pas de patching dans BPscript)

### Execution et backticks
- [DESIGN_REPL.md](DESIGN_REPL.md) -- Architecture REPL adapters : backticks, sessions, timing

### Integration
- [DESIGN_INTEGRATIONS.md](DESIGN_INTEGRATIONS.md) -- Integrations externes : Ableton, VCV Rack, etc.
