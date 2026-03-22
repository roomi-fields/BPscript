# Architecture: Sounds Implementation

## Vue d'ensemble

```
                    ┌──────────────────────────────────────────────────┐
                    │                   BPscript                       │
                    │                                                  │
                    │  @actor piano alphabet:western                    │
                    │                scale:western_12TET                │
                    │                sounds:piano_timbre                │
                    │                transport:webaudio                 │
                    │                                                  │
                    │  S -> C4 D4 E4 (vel:80)                          │
                    └────────────────────┬─────────────────────────────┘
                                         │
                              compile    │
                                         ▼
                    ┌──────────────────────────────────────────────────┐
                    │                  Encoder                         │
                    │                                                  │
                    │  grammar:  S --> C4 D4 E4 _script(CT0)           │
                    │  alphabet: C4, D4, E4                            │
                    │  CT table: [{id:CT0, assignments:{vel:80}}]      │
                    │  actorMap: {C4:"piano", D4:"piano", E4:"piano"}  │  ← NOUVEAU
                    └────────────────────┬─────────────────────────────┘
                                         │
                              BP3 WASM   │
                                         ▼
                    ┌──────────────────────────────────────────────────┐
                    │                 Dispatcher                       │
                    │                                                  │
                    │  Pour chaque token:                               │
                    │    1. CT → update controlState                    │
                    │    2. CV → route vers sendCV()                    │
                    │    3. Note → lookup actorMap → acteur             │
                    │            → acteur.resolve(token)                │
                    │            → {clé:valeur}                         │
                    │            → merge controlState                   │
                    │            → acteur.transport.send(merged)        │
                    └──────────────────────────────────────────────────┘
```

## Composants modifiés

### 1. ActorRegistry (NOUVEAU)

```
src/dispatcher/actorRegistry.js
```

Gère les acteurs. Chaque acteur contient un Resolver + un SoundsResolver + une référence transport.

```javascript
class ActorRegistry {
  constructor() {
    this.actors = {};        // name → Actor
    this.terminalMap = {};   // terminal → actor name
  }

  register(name, config) {
    // config = { alphabet, scale, sounds, transport, resolver }
    this.actors[name] = config;
    // Map each terminal in the alphabet to this actor
    for (const note of config.alphabet.notes) {
      this.terminalMap[note] = name;
    }
  }

  resolveTerminal(token) {
    const actorName = this.terminalMap[token];
    if (!actorName) return null;
    const actor = this.actors[actorName];
    return actor.resolve(token);
  }
}
```

### 2. SoundsResolver (NOUVEAU)

```
src/dispatcher/soundsResolver.js
```

Résout un terminal en dictionnaire de paramètres depuis un fichier sounds.

```javascript
class SoundsResolver {
  constructor(soundsData) {
    this.defaults = soundsData.defaults || {};
    this.templates = soundsData.templates || {};
    this.byTerminal = soundsData.by_terminal || {};
    this.byRegister = soundsData.by_register || null;
    this.parametric = soundsData.parametric || null;
  }

  resolve(noteName, register) {
    let params = { ...this.defaults };

    // By-register (for pitched + timbre)
    if (this.byRegister) {
      for (const [range, overrides] of Object.entries(this.byRegister)) {
        const [lo, hi] = range.split('-').map(Number);
        if (register >= lo && register <= hi) {
          params = { ...params, ...overrides };
          break;
        }
      }
    }

    // By-terminal (for percussion, samples)
    const entry = this.byTerminal[noteName];
    if (entry) {
      if (entry.layers) {
        // Template composition
        params.layers = entry.layers.map(name => {
          const tmpl = this.templates[name] || {};
          return entry.override ? { ...tmpl, ...entry.override } : tmpl;
        });
      } else {
        params = { ...params, ...entry };
      }
    }

    // Parametric (formula)
    if (this.parametric) {
      for (const [key, formula] of Object.entries(this.parametric)) {
        params[key] = this._evalFormula(formula, { register, index: 0 });
      }
    }

    return params;
  }

  _evalFormula(formula, vars) {
    // Simple formula evaluation: "50 + register * 80"
    let expr = formula;
    for (const [k, v] of Object.entries(vars)) {
      expr = expr.replace(new RegExp(k, 'g'), v);
    }
    try { return Function('"use strict"; return (' + expr + ')')(); }
    catch { return 0; }
  }
}
```

### 3. Resolver (MODIFIÉ)

```
src/dispatcher/resolver.js
```

Le Resolver existant (5-layer pitch) reste. Il ajoute la capacité de merger avec SoundsResolver :

```javascript
// Dans resolve():
resolve(token, direction) {
  // ... existing pitch resolution (steps 1-5) ...

  // Step 6: merge sounds params if available
  if (this.soundsResolver) {
    const soundParams = this.soundsResolver.resolve(noteName, register);
    result = { ...soundParams, ...result };  // pitch overrides sounds.freq
  }

  return result;
}
```

Pour les acteurs SANS scale (percussion), le Resolver fait uniquement le sounds lookup :

```javascript
resolve(token) {
  if (!this.notes.length && this.soundsResolver) {
    // No alphabet/scale → pure sounds lookup
    return this.soundsResolver.resolve(token, 0);
  }
  // ... existing pitch resolution ...
}
```

### 4. Dispatcher (MODIFIÉ)

```
src/dispatcher/dispatcher.js
```

Le dispatcher utilise l'ActorRegistry pour router chaque terminal :

```javascript
// Dans _schedule(), au lieu de:
//   transport.send({token, ...controlState}, absTime)
// Faire:

const actorResult = this._actorRegistry?.resolveTerminal(evt.token);
if (actorResult) {
  // Merge: actorResult (spec) < controlState (CT override)
  const merged = { ...actorResult, ...this.controlState, velocity: this.controlState.vel / 127 };
  merged.token = evt.token;
  merged.durSec = evt.durSec;

  // Route to the actor's transport
  const actorName = this._actorRegistry.terminalMap[evt.token];
  const actor = this._actorRegistry.actors[actorName];
  const transport = this.transports[actor.transportName] || this.transports['default'];

  if (merged.layers) {
    transport.sendLayers(merged, absTime);  // multi-voice
  } else {
    transport.send(merged, absTime);
  }
}
```

### 5. WebAudioTransport (MODIFIÉ)

```
src/dispatcher/transports/webaudio.js
```

Le transport interprète les clés qu'il connaît :

```javascript
send(event, absTime) {
  const freq = event.freq;
  if (!freq || freq <= 0) return;

  const dur = Math.max(0.05, event.durSec);
  const velocity = event.velocity || 0.5;
  const wave = event.wave || 'triangle';
  const attackSec = (event.attack || 20) / 1000;
  const releaseSec = (event.release || 100) / 1000;
  const brightness = event.brightness || 0;  // 0 = no filter
  const noise = event.noise || 0;
  const pitchDrop = event.pitch_drop || 0;
  const sample = event.sample || null;

  if (sample) {
    this._playSample(sample, event, absTime);
  } else if (noise > 0 || pitchDrop > 0) {
    this._playPercussion(freq, velocity, dur, noise, pitchDrop, brightness, event, absTime);
  } else {
    this._playOscillator(freq, velocity, dur, wave, attackSec, releaseSec, brightness, event, absTime);
  }
}

sendLayers(event, absTime) {
  for (const layer of event.layers) {
    this.send({ ...event, ...layer, layers: undefined }, absTime);
  }
}
```

### 6. Web Interface (MODIFIÉ)

```
web/index.html
```

- Charge les fichiers sounds au startup : `lib/sounds/*.json`
- Crée un ActorRegistry depuis les directives `@actor`
- Pour le mode legacy (pas d'@actor), crée un acteur implicite depuis @alphabet + @tuning

```javascript
function _createActorRegistry() {
  const registry = new ActorRegistry();

  // Implicit actor from @alphabet/@tuning directives (legacy mode)
  const alphabetKey = ...;  // from directives
  const scaleKey = ...;
  const soundsKey = ...;

  const resolver = new Resolver({
    alphabet: alphabets[alphabetKey],
    octaves: octaves[octavesKey],
    tuning: tunings[scaleKey],
    temperament: temperaments[tempKey]
  });

  if (soundsKey && soundsData[soundsKey]) {
    resolver.soundsResolver = new SoundsResolver(soundsData[soundsKey]);
  }

  registry.register('default', {
    alphabet: alphabets[alphabetKey],
    resolve: (token) => resolver.resolve(token),
    transportName: 'default'
  });

  return registry;
}
```

## Plan d'implémentation par étapes

### Phase 1 — SoundsResolver + tabla (une session)

1. Créer `lib/sounds/tabla_perc.json` avec templates + by_terminal
2. Créer `src/dispatcher/soundsResolver.js`
3. Brancher dans le Resolver existant (mode sans scale = sounds only)
4. Le WebAudioTransport reconnaît `noise`, `pitch_drop`, `brightness`, `layers`
5. Tester : ek-do-tin et dhin produisent des sons percussifs distincts

### Phase 2 — Piano timbre par registre (une session)

1. Créer `lib/sounds/piano_timbre.json` avec defaults + by_register
2. Le Resolver merge scale (freq) + sounds (timbre)
3. Tester : piano grave ≠ piano aigu

### Phase 3 — ActorRegistry + @actor (deux sessions)

1. Parser `@actor` dans le parser
2. Créer `src/dispatcher/actorRegistry.js`
3. Le dispatcher route par acteur via terminalMap
4. Tester : scène avec sitar + tabla simultanés

### Phase 4 — Samples (une session)

1. Ajouter `sample` key dans sounds
2. WebAudioTransport charge AudioBuffer et joue
3. Tester : drum kit avec samples WAV

### Phase 5 — Parametric sounds (une session)

1. Formules dans sounds (register, index)
2. Tester : marimba avec timbre paramétrique

### Phase 6 — Multi-transport (futures sessions)

1. MIDI transport interprete les clés MIDI
2. OSC transport envoie les clés comme args
3. Même scène, différents transports

## Compatibilité

- **Aucun changement aux fichiers existants** (alphabets, scales, temperaments)
- **Les scènes sans @actor continuent de fonctionner** (acteur implicite depuis @alphabet)
- **Le fallback percussion hash est remplacé** par le SoundsResolver
- **Les CV continuent de fonctionner** (chemin séparé via cvTable/sendCV)
