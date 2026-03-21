# Pitch Architecture — 5 Couches

## Vue d'ensemble

La résolution d'un symbole BPscript en fréquence traverse 5 couches indépendantes :

```
alphabet  →  noms + altérations (culturel)
octaves   →  convention de registre (notation)
temperament → grille d'intervalles (mathématique)
tuning    →  gamme concrète = alphabet + temperament + référence
resolver  →  token → fréquence (runtime)
```

Chaque couche a une seule responsabilité. Zéro redondance entre les fichiers.

---

## 1. Alphabet (`lib/alphabet.json`)

Définit une **séquence ordonnée de noms de notes** et les **altérations** disponibles.
L'alphabet est purement nominal — il ne contient aucune information de fréquence,
aucun MIDI, aucun ratio.

```json
{
  "western": {
    "notes": ["C", "D", "E", "F", "G", "A", "B"],
    "alterations": ["bb", "b", "", "#", "##"]
  }
}
```

- `notes` : séquence ordonnée, la position dans la liste est l'index (degree)
- `alterations` : modifications nommées applicables à toute note

### Conventions de nommage des altérations

| Tradition | Altérations                                            |
| --------- | ------------------------------------------------------ |
| Western   | `bb`, `b`, `#`, `##`                                   |
| Sargam    | `komal`, `tivra`                                       |
| Arabe     | `bb`, `b`, `half_b`, `half_#`, `#`, `##`               |
| Turc      | `bakiye`, `kucuk_mucenneb`, `buyuk_mucenneb`, `tanini` |

---

## 2. Octaves (`lib/octaves.json`)

Définit comment les **registres** (octaves) sont nommés. Convention paramétrique
supportant préfixe, suffixe, et séparateurs variables.

```json
{
  "western": {
    "position": "suffix",
    "separator": "",
    "registers": ["0","1","2","3","4","5","6","7","8","9"],
    "default": 4
  }
}
```

- `position` : `"prefix"` ou `"suffix"`
- `separator` : chaîne entre note et registre
- `registers` : liste ordonnée grave→aigu, `""` = pas de marqueur
- `default` : index du registre home

### Conventions non supportées

Lilypond (`,` conflit polymétrie), Jianpu (`.` conflit période), Helmholtz (casse).
`arrows` (`_v`/`_^`) proposé comme substitut compatible.

---

## 3. Tempérament (`lib/temperaments.json`)

Définit la **grille mathématique** des intervalles. Un tempérament est indépendant
de toute gamme ou alphabet — c'est une division de l'espace des fréquences.

```json
{
  "12TET": {
    "period_ratio": 2,
    "divisions": 12,
    "ratios": ["0c", "100c", "200c", ...]
  }
}
```

- `period_ratio` : intervalle de référence (2 = octave, 3 = tritave Bohlen-Pierce)
- `divisions` : nombre de steps dans la période
- `ratios` : ratio de chaque step — **3 formats acceptés** :
  - **Fraction** : `"9/8"` — exact, tempéraments historiques et intonation juste
  - **Décimal** : `1.05946` — approximation, gamelan et systèmes empiriques
  - **Cents** : `"100c"` — converti en `2^(cents/1200)` au chargement

### Pourquoi 3 formats

| Format   | Usage                                       | Précision                |
| -------- | ------------------------------------------- | ------------------------ |
| Fraction | Pythagoricien, just, shruti                 | Exacte (rationnels)      |
| Décimal  | Gamelan, systèmes mesurés                   | Approximation            |
| Cents    | Tempéraments égaux (12-TET, 24-TET, 53-TET) | Convertie en irrationnel |

Le resolver normalise tout en `float` au chargement. Un seul chemin de calcul.

### Deux types de tempéraments

#### Type "table" — ratios fixes (par défaut)

```json
{
  "pythagorean": {
    "type": "table",
    "period_ratio": 2,
    "divisions": 12,
    "ratios": [1, "256/243", "9/8", "32/27", "81/64", "4/3", "729/512", "3/2", "128/81", "27/16", "16/9", "243/128"]
  }
}
```

Les ratios sont fixes — le tempérament sonne toujours pareil.
C'est le mode par défaut (si `type` est omis, c'est `"table"`).

#### Type "parametric" — Dynamic Tonality

Inspiré de la [Dynamic Tonality](https://www.dynamictonality.com/) (Milne, Sethares, Plamondon).
Au lieu de ratios fixes, le tempérament est défini par un **period** et un **generator**
dont la taille peut varier continûment.

```json
{
  "meantone": {
    "type": "parametric",
    "period": 1200,
    "generator": 697,
    "generator_range": [685, 720],
    "mapping": [[1,0], [1,1], [0,4]],
    "primes": [2, 3, 5],
    "commas": ["81/80"],
    "mos_steps": [7, 12],
    "description": "Meantone family — syntonic comma tempered out"
  }
}
```

- `period` : en cents (1200 = octave, 1902 = tritave)
- `generator` : valeur par défaut en cents
- `generator_range` : bornes du continuum (au-delà, le MOS pattern change)
- `mapping` : matrice [prime → [a_period, b_generator]] — comment les harmoniques
  naturels se projettent sur period et generator
- `primes` : quels harmoniques le mapping couvre (2, 3, 5 = 5-limit)
- `commas` : intervalles tempérés (rendus = 0)
- `mos_steps` : tailles de gammes MOS naturelles (7 = diatonic, 12 = chromatic)

**Calcul des ratios à la volée :**

Chaque note de la gamme est un point `(a, b)` dans le réseau period×generator.
Sa fréquence relative est :

```
ratio = 2^((a × period + b × generator) / 1200)
```

Pour la gamme diatonic MOS (7 notes) de meantone avec g=697 :
- Unison = (0,0) → 0¢ → ratio 1.0
- Seconde = (0,1) - P réduit → 697¢ - 1200¢ = ... voir ci-dessous
- Les 7 notes sont les 7 premiers termes de la chaîne de generators, réduits dans la période

**Le generator est un CV :**

Le generator peut varier dans le temps via la polymétrie, comme un paramètre d'effet :

```
// Morphe du pythagoricien (702¢) au mésotonique (697¢)
S -> { Sa Re Ga Pa , sitar.tuning.generator(ramp(702, 697)) }
```

En faisant varier le generator, toutes les fréquences changent simultanément
tout en conservant la structure de la gamme (mêmes degrés, mêmes intervalles
fonctionnels, seule la couleur change).

**Couplage timbre-tuning :**

Pour maintenir la consonance pendant le morph, le timbre doit suivre le tuning
(spectral matching — Sethares). C'est le **runtime** qui gère ça (ajustement
des partiels dans SuperCollider ou WebAudio). BPscript envoie la valeur du
generator, le runtime ajuste à la fois les pitches ET le spectre.

**Continuum meantone — exemples :**

| Generator | Tempérament | Tierce (4g-2P) | Quinte (g) | Caractère |
|-----------|-------------|----------------|------------|-----------|
| 685¢ | (borne basse) | 340¢ | 685¢ | *seuil — le MOS change* |
| 694.7¢ | 2/7-comma | 378.9¢ | 694.7¢ | très doux |
| 696.6¢ | 1/3-comma | 386.3¢ | 696.6¢ | tierces pures |
| 697¢ | 1/4-comma | 388¢ | 697¢ | mésotonique classique |
| 700¢ | 12-TET | 400¢ | 700¢ | égal |
| 702¢ | pythagoricien | 407.8¢ | 702¢ | brillant |
| 720¢ | (borne haute) | 480¢ | 720¢ | *seuil — le MOS change* |

Tous partagent le **même mapping** (tierce = 4g-2P, quinte = g).
Seule la valeur du generator change.

---

## 4. Tuning (`lib/tuning.json`)

Une **gamme concrète** qui associe un alphabet à un tempérament avec une référence pitch.
C'est la couche qui fait le pont entre les noms (culturels) et les positions (mathématiques).

```json
{
  "Cmaj_just": {
    "temperament": "just_5limit",
    "degrees": [0, 2, 4, 5, 7, 9, 11],
    "alterations": {
      "#": "25/24",
      "b": "24/25"
    },
    "baseHz": 440,
    "baseNote": "A",
    "baseRegister": 4
  }
}
```

- `temperament` : référence vers `temperaments.json`
- `degrees` : quels steps de la grille du tempérament sont utilisés (dans l'ordre de l'alphabet)
- `alterations` : modifications nommées en **ratios** (mêmes 3 formats)
- `baseHz` / `baseNote` / `baseRegister` : la note de référence

### Altérations et enharmonie

`C## = D` si et seulement si `degrees[C] + 2 == degrees[D]` dans le tempérament.
- En 12-TET : `degrees[C]=0`, `#=+1 step`, `C##=2`, `degrees[D]=2` → **oui**
- En just intonation : `C## = 1 × (25/24)² = 625/576`, `D = 9/8 = 648/576` → **non**

Les altérations sont des **ratios**, pas des offsets de steps. Ça permet la précision
dans les systèmes non égaux.

### Gammes composées (tétracordes / jins)

Dans les traditions arabe, turque et grecque, les gammes sont construites
par **empilement de fragments** (tétracordes = 4 notes couvrant une quarte,
jins = terme arabe pour le même concept).

Les fragments sont définis comme des tunings avec `"fragment": true` :

```json
{
  "jins_rast": {
    "fragment": true,
    "ratios": [1, "9/8", "5/4", "4/3"],
    "description": "Jins Rast — tétracorde majeur (do ré mi fa)"
  },
  "jins_nahawand": {
    "fragment": true,
    "ratios": [1, "9/8", "6/5", "4/3"],
    "description": "Jins Nahawand — tétracorde mineur"
  },
  "jins_hijaz": {
    "fragment": true,
    "ratios": [1, "16/15", "5/4", "4/3"],
    "description": "Jins Hijaz — seconde augmentée caractéristique"
  }
}
```

Les gammes composées référencent ces fragments et les empilent :

```json
{
  "maqam_rast": {
    "temperament": "24TET",
    "compose": ["jins_rast", "jins_rast"],
    "junction": "3/2",
    "degrees": "auto",
    "baseHz": 440,
    "baseNote": "do",
    "baseRegister": 4,
    "description": "Maqam Rast = Rast + Rast sur la quinte"
  },
  "maqam_nahawand": {
    "temperament": "24TET",
    "compose": ["jins_nahawand", "jins_kurd"],
    "junction": "3/2",
    "degrees": "auto",
    "description": "Maqam Nahawand = Nahawand + Kurd"
  }
}
```

- `compose` : liste ordonnée de fragments à empiler
- `junction` : le ratio où le second fragment commence (typiquement `"3/2"` = la quinte)
- `degrees: "auto"` : le resolver calcule les degrees en concaténant les ratios des fragments

Le resolver résout la composition au chargement → produit un tableau de degrees
comme un tuning normal. La composition est un raccourci d'écriture, pas un
mécanisme runtime.

### Gammes directionnelles (aroha / avaroha)

Dans la musique indienne, certains ragas ont des gammes différentes à la montée
(aroha) et à la descente (avaroha). Dans les maqams arabes, le sayr (parcours)
peut aussi différer.

```json
{
  "bhairav": {
    "temperament": "22shruti",
    "ascending":  [0, 2, 7, 9, 13, 15, 20],
    "descending": [0, 4, 7, 9, 13, 17, 20],
    "baseHz": 240,
    "baseNote": "sa",
    "baseRegister": 1,
    "description": "Raga Bhairav — aroha et avaroha différents"
  }
}
```

Quand `ascending` et `descending` sont présents (au lieu de `degrees`),
le resolver choisit selon la direction mélodique. La direction est
déterminée par le contexte (note précédente vs note courante).

### Tuning paramétrique (Dynamic Tonality)

Quand le tuning référence un tempérament `"type": "parametric"`, les `degrees`
sont des positions dans la **chaîne de generators**, pas des indices dans un tableau.

```json
{
  "western_meantone_dt": {
    "temperament": "meantone",
    "degrees": [0, 2, 4, -1, 1, 3, 5],
    "alterations": {
      "#": "100c",
      "b": "-100c"
    },
    "baseHz": 440,
    "baseNote": "A",
    "baseRegister": 4
  }
}
```

Ici `degrees` = nombre de generators depuis l'origine :
- C = 0g, D = 2g, E = 4g, F = -1g, G = 1g, A = 3g, B = 5g

Le resolver calcule : `pitch_cents = degree × generator` (réduit mod period).
Le generator peut varier en temps réel via CV.

---

## 5. Resolver (`src/dispatcher/resolver.js`)

Le resolver n'est pas un singleton global — il est **instancié par acteur**.
Chaque acteur (`@actor`) porte son propre contexte de résolution
(alphabet + octaves + tuning + tempérament). Voir [DESIGN_ACTOR.md](DESIGN_ACTOR.md).

Lit les 4 fichiers et résout un token BPscript en fréquence.

### Pipeline

```
Token "Re_komal_^"
  ↓
1. Octaves  → parse registre : note="Re_komal", registre=default+1
  ↓
2. Alphabet → parse altération : note="Re", altération="komal"
              → degree index = 1 (position de "Re" dans la séquence)
  ↓
3. Tuning   → degrees[1] = step 4 dans le tempérament
              → alteration "komal" = ratio 16/15 ÷ 9/8 (ou via table)
  ↓
4. Tempérament → ratios[4] = "9/8"
  ↓
5. Calcul   → freq = baseHz × period_ratio^(registre - baseRegister) × ratio × alteration_ratio
```

### Deux modes de résolution

#### Mode table (tempéraments à ratios fixes)

```
freq = baseHz × period_ratio^(register - baseRegister) × temperament.ratios[step] × alteration_ratio
```

Où `step = tuning.degrees[degree_index]` — lookup dans le tableau de ratios.

#### Mode paramétrique (Dynamic Tonality)

```
pitch_cents = tuning.degrees[degree_index] × generator
pitch_cents_reduced = pitch_cents mod period        (réduction dans la période)
pitch_cents_absolute = pitch_cents_reduced + register × period

freq = baseHz × 2^((pitch_cents_absolute - baseNote_cents) / 1200) × alteration_ratio
```

Où `generator` est une valeur continue qui peut varier en temps réel via CV.
Le `period` est en cents (1200 = octave). Les `degrees` sont des nombres
de generators (entiers, possiblement négatifs : F = -1g dans meantone).

Les deux formules produisent une fréquence en Hz. Le resolver choisit le mode
selon `temperament.type` (`"table"` ou `"parametric"`).

---

## Exemples de chaînes complètes

### Western : `C#5` en 12-TET

| Couche      | Donnée                                         |
| ----------- | ---------------------------------------------- |
| Alphabet    | `C` = degree 0, altération `#`                 |
| Octaves     | convention `western`, registre `5`             |
| Tuning      | `degrees[0]` = step 0, `#` = `"100c"` → step 1 |
| Tempérament | 12-TET `ratios[1]` = `"100c"` → 2^(100/1200)   |
| Résultat    | `440 × 2^(5-4) × 2^(1/12) = 554.37 Hz`         |

### Indian : `ga_komal` (madhya saptak) en 22 shruti

| Couche      | Donnée                                           |
| ----------- | ------------------------------------------------ |
| Alphabet    | `ga` = degree 2, altération `komal`              |
| Octaves     | convention `saptak`, registre `madhya` (default) |
| Tuning      | `degrees[2]` = step 7, `komal` → step 5          |
| Tempérament | 22shruti `ratios[5]` = `"32/27"`                 |
| Résultat    | `240 × 2^(1-1) × 32/27 = 284.44 Hz`              |

### Turkish : `tiz segah` en 53-TET

| Couche      | Donnée                                            |
| ----------- | ------------------------------------------------- |
| Alphabet    | `segah` dans la séquence turque                   |
| Octaves     | convention `turkish`, préfixe `tiz` = registre +1 |
| Tuning      | degree → step dans la grille 53-TET               |
| Tempérament | 53-TET `ratios[step]` = `"Nc"`                    |
| Résultat    | `baseHz × 2^(1) × 2^(step/53)`                    |

---

## Architecture de traitement

### Deux phases, deux consommateurs

Les 5 couches sont consommées à **deux moments** par **deux modules** différents :

```
┌─────────────────────────────────────────────────────────────┐
│  COMPILE TIME (transpiler)                                  │
│                                                             │
│  Source BPscript                                            │
│       ↓                                                     │
│  Tokenizer  ← octaves.json (parse registres dans tokens)   │
│       ↓        alphabets.json (reconnaître notes valides)   │
│  Parser     ← alphabets.json (type gate pour les notes)    │
│       ↓                                                     │
│  Encoder    ← alphabets.json + octaves.json                │
│       │        → génère noms BP3-safe (bol prefix)          │
│       │        → émet terminaux dans la grammaire           │
│       ↓                                                     │
│  Prototypes ← alphabets.json + octaves.json                │
│                → génère fichier -so. pour tous les          │
│                  terminaux possibles (notes × registres)    │
│                                                             │
│  Output: grammaire BP3 + alphabet plat + prototypes -so.    │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    BP3 WASM engine
                   (dérivation temporelle)
                          ↓
                    Timed tokens
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  RUNTIME (dispatcher)                                       │
│                                                             │
│  Timed token "bolC_^4" (nom BP3-safe)                      │
│       ↓                                                     │
│  Dispatcher  → strip "bol" prefix → "C_^4"                 │
│       ↓                                                     │
│  Resolver    ← octaves.json   (parse registre)              │
│              ← alphabets.json (parse note + altération)     │
│              ← tunings.json   (degree → step, altération)   │
│              ← temperaments.json (step → ratio)             │
│       ↓                                                     │
│  Calcul: freq = baseHz × period^Δregister × ratio × alt    │
│       ↓                                                     │
│  Transport (WebAudio, MIDI, OSC...)  → son                  │
└─────────────────────────────────────────────────────────────┘
```

### Chargement et configuration

```
@alphabet:western        → charge alphabets.json["western"]
@octaves:arrows          → charge octaves.json["arrows"]
@tuning:western_just     → charge tunings.json["western_just"]
                            → charge automatiquement temperaments.json["just_5limit"]
@reference:442           → override baseHz = 442
```

Les directives `@` dans le source BPscript configurent les couches.
Le tuning référence son tempérament → le chargement est transitif.
`@reference` permet de changer la fréquence de base sans changer le tuning.

### Cycle de vie des données

```
                 JSON files (statiques)
                        ↓
              Chargement (au parse des @directives)
                        ↓
              Normalisation des ratios
              (fraction→float, cents→float, décimal tel quel)
                        ↓
              Cache par token (resolver._cache)
                        ↓
              Invalidation si @directive change en live
```

Le resolver normalise **une seule fois** au chargement :
- `"9/8"` → `1.125`
- `"100c"` → `Math.pow(2, 100/1200)` → `1.05946...`
- `1.05946` → tel quel

Après normalisation, tout est `float`. Le calcul runtime est une multiplication,
pas de parsing de chaînes.

### Modules et responsabilités

| Module           | Phase   | Lit                                       | Produit                               |
| ---------------- | ------- | ----------------------------------------- | ------------------------------------- |
| `tokenizer.js`   | compile | octaves, alphabets                        | tokens avec note/registre reconnus    |
| `parser.js`      | compile | alphabets                                 | AST avec nodes Symbol typés           |
| `encoder.js`     | compile | alphabets, octaves                        | noms BP3-safe (bol prefix), grammaire |
| `prototypes.js`  | compile | alphabets, octaves                        | fichier -so. (durées de référence)    |
| `resolver.js`    | runtime | octaves, alphabets, tunings, temperaments | fréquence (float)                     |
| `dispatcher.js`  | runtime | —                                         | orchestre resolver + transport        |
| `transport/*.js` | runtime | —                                         | consomme la fréquence, produit du son |

### Ce que BP3 voit vs ce que le dispatcher voit

BP3 ne voit que des **noms opaques** (`bolC_^4`, `bolSa`, `bolga_komal_v`).
Il ne sait rien des fréquences — il gère uniquement le temps.

Le dispatcher reçoit ces noms avec un **timing** (onset, durée).
Il strip le prefix `bol`, passe au resolver, et envoie la fréquence au transport.

```
BP3:        "bolga_komal  200ms  at  1500ms"
                 ↓
Dispatcher: strip "bol" → "ga_komal"
                 ↓
Resolver:   ga_komal → { freq: 284.44, register: 1 }
                 ↓
Transport:  oscillator.frequency = 284.44 at t=1500ms for 200ms
```

---

## Impact sur le code existant

| Fichier                        | Action                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| `lib/alphabet.json`            | Retirer midi, semitones, generator.octaves, octaveChains. Garder : notes + alterations             |
| `lib/tuning.json`              | Restructurer : temperament ref + degrees + alterations + baseHz. Les scales BP3 existantes migrées |
| `lib/temperaments.json`        | **Nouveau** : grilles mathématiques pures                                                          |
| `lib/octaves.json`             | Déjà créé                                                                                          |
| `src/dispatcher/resolver.js`   | Réécrire : lire les 4 fichiers, formule générique                                                  |
| `src/transpiler/prototypes.js` | Ne plus hardcoder `bolC0-bolB9`, lire alphabet + octaves                                           |
| `src/transpiler/encoder.js`    | Adapter le `bol` prefix dynamiquement                                                              |

---

## Références

### Dynamic Tonality
- **Milne, A.J., Sethares, W.A., & Plamondon, J.** (2007). "Isomorphic Controllers and Dynamic Tuning." *Computer Music Journal* 31(4).
- **Milne, A.J., Sethares, W.A., & Plamondon, J.** (2008). "Tuning Continua and Keyboard Layouts." *Journal of Mathematics and Music* 2(1).
- **Site web** : [dynamictonality.com](https://www.dynamictonality.com/)

### Psychoacoustique et consonance
- **Sethares, W.A.** (2005). *Tuning, Timbre, Spectrum, Scale.* Springer. 2nd edition.
- **Plomp, R. & Levelt, W.J.M.** (1965). "Tonal Consonance and Critical Bandwidth." *Journal of the Acoustical Society of America* 38(4).

### Regular Temperament Theory
- **Erlich, P.** (2006). "A Middle Path Between Just Intonation and the Equal Temperaments." *Xenharmonikon* 18.
- **Breed, G.** Regular temperament resources : [x31eq.com](https://x31eq.com/)

### MOS Scales
- **Wilson, E.** Papers on Moment of Symmetry scales and combination product sets : [anaphoria.com](https://www.anaphoria.com/)

### Bol Processor
- **Bel, B.** Temperaments and tuning systems in BP3 : [bolprocessor.org](https://bolprocessor.org/)
- 162 gammes converties depuis les fichiers `-to.*` de BP3 (source : Bernard Bel)
