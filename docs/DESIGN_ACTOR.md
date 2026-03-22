# Actor — Unité de binding dans BPscript

> Voir aussi : [DESIGN_PITCH.md](DESIGN_PITCH.md) pour le resolver pitch par acteur,
> [DESIGN_ARCHITECTURE.md](DESIGN_ARCHITECTURE.md) pour le pipeline compile/runtime.

## Le problème

Une scène BPscript peut contenir plusieurs instruments qui partagent le même
alphabet. Deux sitaristes jouent les mêmes notes (sargam) mais :
- vont vers des sorties différentes (MIDI ch1 vs ch3, ou WebAudio vs OSC)
- peuvent utiliser des tunings différents (22 shruti vs 12-TET)
- peuvent avoir des conventions d'octave différentes

L'alphabet seul ne suffit pas comme unité de résolution — il manque le **contexte**.

## L'acteur

L'acteur est l'unité qui lie toutes les couches de résolution ensemble :

```
@actor sitar1  alphabet:sargam  tuning:sargam_22shruti  octaves:saptak  transport:webaudio
@actor sitar2  alphabet:sargam  tuning:sargam_12TET     octaves:saptak  transport:midi(ch:3)
@actor tabla   alphabet:tabla_bols  transport:midi(ch:10)
@actor lights  alphabet:dmx_fixtures  transport:dmx
```

Un acteur = **alphabet + tuning + octaves + transport**. C'est le contexte complet
de résolution d'un symbole.

### Syntaxe de la directive `@actor`

```
@actor <nom>  <clé:valeur>  <clé:valeur>  ...
```

Clés disponibles :

| Clé | Obligatoire | Valeur | Exemple |
|-----|-------------|--------|---------|
| `alphabet` | oui | référence vers `alphabets.json` | `alphabet:sargam` |
| `tuning` | non | référence vers `tunings.json` | `tuning:sargam_22shruti` |
| `octaves` | non | référence vers `octaves.json` | `octaves:saptak` |
| `transport` | oui | clé de transport (+params optionnels) | `transport:midi(ch:3)` |
| `eval` | non | clé d'eval pour les backticks | `eval:sclang` |

Si `tuning` est omis → pas de résolution de fréquence (percussions, DMX, etc.).
Si `octaves` est omis → convention par défaut du tuning ou `western` si pas de tuning.
Si `eval` est omis → même valeur que `transport` (cas courant).

### Utilisation dans les règles

Le `:` après un symbole référence l'acteur :

```
gate Sa:sitar1       // Sa résolu via sitar1 (sargam + 22shruti + webaudio)
gate Sa:sitar2       // même note, autre acteur (sargam + 12TET + midi ch3)
trigger tin:tabla    // tin résolu via tabla (bols + midi ch10)
trigger spot:lights  // spot résolu via lights (dmx)
```

### Import en bloc

Un `@actor` avec un alphabet importe tous les symboles de cet alphabet,
liés à cet acteur :

```
@actor sitar1  alphabet:sargam  tuning:sargam_22shruti  transport:webaudio

// Tous les symboles de sargam (sa, re, ga, ma, pa, dha, ni) sont
// automatiquement déclarés comme gate:sitar1
// Pas besoin de "gate Sa:sitar1" pour chaque note
```

Surcharge individuelle possible :
```
trigger dha:sitar1   // override : dha est un trigger, pas un gate
```

## Resolver par acteur

Chaque acteur a son propre contexte de résolution. Le resolver n'est plus
un singleton global — c'est une instance par acteur.

```
┌─────────────────────────────────────────────┐
│  Actor "sitar1"                             │
│                                             │
│  alphabet  : sargam (sa, re, ga...)         │
│  octaves   : saptak (mandra, madhya, taar)  │
│  tuning    : sargam_22shruti                │
│  temperament: 22shruti (auto via tuning)    │
│  transport : webaudio                       │
│                                             │
│  Resolver: token → freq                     │
│  "Sa_^" → parse → sa, taar → freq           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Actor "sitar2"                             │
│                                             │
│  alphabet  : sargam (même noms)             │
│  octaves   : saptak (même convention)       │
│  tuning    : sargam_12TET (autre tuning!)   │
│  temperament: 12TET                         │
│  transport : midi(ch:3)                     │
│                                             │
│  Resolver: token → freq (résultat différent)│
│  "Sa_^" → parse → sa, taar → freq           │
└─────────────────────────────────────────────┘
```

Même symbole `Sa`, même octave, fréquences différentes — parce que le tuning
(et donc le tempérament) est différent.

## Conflits de noms

Deux acteurs peuvent partager le même alphabet (sitar1 et sitar2 utilisent
tous les deux sargam). Les symboles sont distingués par le `:actor` :

```
// Pas de conflit — le :actor désambiguïse
Sa:sitar1    // résolu via sitar1
Sa:sitar2    // résolu via sitar2
```

Si un symbole est utilisé **sans** `:actor`, le compilateur cherche un
acteur non ambigu. Si plusieurs acteurs contiennent ce symbole → erreur :

```
@actor sitar1  alphabet:sargam  ...
@actor sitar2  alphabet:sargam  ...

Sa Re Ga Pa    // ❌ Erreur : 'Sa' est dans sitar1 et sitar2 — préciser l'acteur
Sa:sitar1 Re:sitar1 Ga:sitar1 Pa:sitar1   // ✓ OK
```

Si un seul acteur contient le symbole → résolution implicite :

```
@actor sitar1  alphabet:sargam  ...
@actor tabla   alphabet:tabla_bols  ...

Sa Re Ga Pa    // ✓ OK — seul sitar1 a ces symboles
tin ta ke      // ✓ OK — seul tabla a ces symboles
```

## Compilation — comment l'acteur traverse le pipeline

### Tokenizer

Le tokenizer reconnaît `@actor` comme une directive. Le reste de la ligne
est parsé comme des paires `clé:valeur` séparées par des espaces.

```
@actor sitar  alphabet:sargam  tuning:sargam_22shruti  transport:webaudio
│      │      │                │                        │
DIRECTIVE      IDENT            PAIR                     PAIR
       NAME
```

Le tokenizer reconnaît aussi `:actor` sur les symboles comme un qualifier :
```
Sa:sitar
│  │
IDENT ACTOR_QUALIFIER
```

### Parser — node AST

Le parser produit un node `ActorDirective` :

```js
{
  type: 'ActorDirective',
  name: 'sitar',
  properties: {
    alphabet: 'sargam',
    tuning: 'sargam_22shruti',
    octaves: 'saptak',
    transport: { key: 'webaudio', params: {} }
  },
  line: 3
}
```

Les symboles qualifiés par `:actor` produisent un `Symbol` avec un champ `actor` :
```js
{ type: 'Symbol', name: 'Sa', actor: 'sitar', line: 12 }
```

### Actor resolver (phase de compilation)

Après le parsing, une phase dédiée :

1. **Collecte** : parcourir les `ActorDirective` → construire la table des acteurs
2. **Chargement** : pour chaque acteur, charger alphabet, tuning, octaves depuis les JSON
3. **Expansion** : chaque acteur importe les symboles de son alphabet avec leurs types
4. **Vérification conflits** : si un symbole apparaît dans 2+ acteurs sans `:actor` explicite → erreur
5. **Résolution implicite** : si un `Symbol` n'a pas de champ `actor`, chercher l'unique acteur qui le contient

### Encoder — aplatissement pour BP3

BP3 ne connaît pas les acteurs. L'encoder **aplatit** :

```
Source BPscript :
  Sa:sitar Re:sitar tin:tabla

Grammaire BP3 :
  bolSa bolRe boltin

terminalActorMap (émise en parallèle, pour le dispatcher) :
  { "bolSa": "sitar", "bolRe": "sitar", "boltin": "tabla" }
```

Le `terminalActorMap` est un dictionnaire `terminal BP3 → nom d'acteur`.
Il est produit par l'encoder et transmis au dispatcher avec la grammaire.

BP3 voit des noms opaques. Le dispatcher utilise le map pour retrouver
l'acteur et donc le resolver + transport approprié.

### Prototypes

Le prototype generator utilise les acteurs pour savoir quels terminaux générer :
- Pour chaque acteur qui a un tuning → générer les terminaux `bol` + notes × registres
- Pour les acteurs sans tuning (percussions, DMX) → générer les terminaux simples

---

## Relation avec les concepts existants

### Remplacement de `@alphabet.X:runtime`

L'ancienne syntaxe :
```
@alphabet.raga:supercollider
@alphabet.western:midi
```

Devient :
```
@actor melodie  alphabet:sargam  tuning:sargam_22shruti  octaves:saptak  transport:osc(port:57110)  eval:sclang
@actor keys     alphabet:western  tuning:western_12TET  octaves:western  transport:midi(ch:1)
```

Plus verbeux mais plus explicite — chaque dimension est nommée.

### Raccourci pour les cas simples

Si un seul acteur suffit et qu'on veut rester concis :

```
@actor default  alphabet:western  tuning:western_12TET  transport:webaudio
```

Ou une syntaxe courte possible (à discuter) :
```
@actor default  western  12TET  webaudio
```

### Backticks et acteurs

Les backticks attachés à un symbole utilisent l'`eval` de l'acteur du symbole :

```
@actor mel  alphabet:sargam  transport:osc  eval:sclang

Sa(vel:`rrand(40,127)`)   // Sa est dans mel → eval = sclang → SC évalue
```

Les backticks orphelins gardent le tag obligatoire :
```
`sc: SynthDef(\grain, {...}).add`   // tag explicite, pas d'acteur
```

## Exemple complet

```
// Acteurs
@actor sitar   alphabet:sargam       tuning:sargam_22shruti  octaves:saptak  transport:osc(port:57110) eval:sclang
@actor tabla   alphabet:tabla_bols   transport:midi(ch:10)
@actor lights  alphabet:dmx_cues     transport:dmx

// Inits
`sc: SynthDef(\sitar, { |freq, vel=80| ... }).add`

// Composition — les acteurs résolvent automatiquement
S -> { melodie, rythme, eclairage }

melodie -> Sa Re Ga(vel:120) Pa      // → sitar (seul à avoir sa, re, ga, pa)
rythme  -> tin ta ke dha             // → tabla (seul à avoir tin, ta, ke, dha)
eclairage -> -!spot _ _ -!fade       // → lights (seul à avoir spot, fade)
```
