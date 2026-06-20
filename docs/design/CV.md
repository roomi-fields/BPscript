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

### Trois dimensions séparées

Un CV a trois aspects **indépendants**, chacun exprimé à son endroit propre — c'est ce qui rend
le système déclaratif (chaque ligne décrit *une* chose, sans en appeler/affecter une autre) :

1. **Ce qu'EST le CV** (forme) — `cv env1 : mod.adsr(...)`. Pure description : un nom, un type de
   modulateur, ses paramètres. Aucune cible, aucune affectation.
2. **Où il s'applique** (cible) — au **point de paramètre** d'une note/voix : `(cutoff: env1)`.
   La cible est une **entrée de modulation de la sortie** (voir plus bas), jamais écrite sur le CV.
3. **Quand / combien de temps** (placement temporel) — donné par la grammaire, comme tout objet
   temporel : le CV (ou la voix qui le porte) occupe une durée dans une règle.

### Syntaxe (design validé Romain 2026-06-20)

**1. Déclaration — descriptive, sans route ni `=`-constructeur**

```bps
cv env1 : mod.adsr(attack:500, decay:2000, sustain:0.6, release:400)
//  │      │   │     └─ paramètres (convention () : key:value)
//  │      │   └─ type de modulateur dans la lib
//  │      └─ lib de modulateurs (adsr | lfo | ramp)
//  └─ nom du modulateur ; `cv` = mot-type ; `:` = « est un » (comme gate Sa:sc)
```

Se lit « env1 **est** une adsr de telle forme ». Pas de cible sur la déclaration, pas de `=`
(on n'« affecte » pas le résultat d'un constructeur), pas de `->` (réservé à la réécriture de
grammaire). C'est une **fiche**, pas une recette.

**2. Branchement — au point de paramètre, valeur dérivable**

La valeur d'un paramètre `()` peut être un **littéral** OU un **symbole dérivable de la grammaire** :

```bps
Bass -> C2 C2 C3 C2 (cutoff: Env, wave:square, vel:120, filterQ:8)
//                    │       │
//                    │       └─ Env est un non-terminal : Env -> env1 | env2 (la grammaire CHOISIT)
//                    └─ cutoff = entrée de modulation de la sortie de Bass
```

- `cutoff: 2000` (littéral) → **pose statique** d'une valeur.
- `cutoff: Env` (symbole résolvant en CV) → **modulation continue** : la courbe 0..1 du CV est
  mappée sur la plage de l'entrée `cutoff`.

C'est le cœur du design : **n'importe quel paramètre peut être branché sur n'importe quel symbole
dérivable**. La modulation hérite donc de toute la puissance de la grammaire (choix, poids, random,
polymétrie) sans syntaxe spéciale.

**3. Voix de modulation parallèle — aléa et structure propres**

```bps
S -> {Bass Bass Bass Bass, Env Env Env Env}     // deux voix parallèles, alignées par la polymétrie
-----
@mode:random
Bass -> C2 C2 C3 C2 - C2 Eb2 C2 (cutoff: Env, wave:square, vel:120) [weight:40]
Bass -> C2 - Eb2 F2 F#2 F2 Eb2 - (cutoff: Env, wave:triangle, vel:60) [weight:30]
Env  -> env1
Env  -> env2
```

`Env` est une **voix indépendante** : elle tire son propre aléa (env1/env2) et peut avoir sa propre
cadence (`{Bass×4, Env×3}` = 3 enveloppes sur 4 phrases). `(cutoff: Env)` **câble la sortie de la
voix sœur Env** dans l'entrée `cutoff` de Bass — **sans re-dériver** (référence post-dérivation).
Bass et Env restent deux processus séparés ; l'un module l'autre.

> **Faisabilité confirmée par BPx (2026-06-20)** : voix Env dérivée normalement, référence
> `cutoff ← Env` **établie par le résolveur post-dérivation** (qui LIT l'arbre, ne dérive ni
> n'échantillonne), alignement par la polymétrie (équi-span), aléas indépendants prouvés bit-à-bit.
> Frontière stricte : BPx établit le câblage + l'alignement structurel ; l'**échantillonnage** de la
> courbe et le **mappage** sur la plage se font **en aval** (dispatcher/webaudio), pas dans BPx.

### Librairie des modulateurs (lib/mod.json)

> Renommée `filter` → `mod` (validé Romain 2026-06-20). Structure inchangée.

```json
{
  "name": "mod",
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

## Entrées de modulation — déclarées sur la SORTIE

Une entrée modulable (`cutoff`, `amplitude`, `resonance`, `pitch`…) **n'appartient pas à la voix**.
Elle appartient à la **sortie** (le transport) : c'est la sortie qui expose ses points de modulation
et leur **type/plage**. Bass n'a pas de propriété `cutoff` — `Bass.cutoff` est un **chemin de
résolution**, pas un accès membre :

```
Bass → joue l'alphabet western → @alphabet.western:browser → transport browser (webaudio)
       → la sortie webaudio expose { cutoff: Hz 20–20000, amplitude: 0–1, resonance: 0–30, … }
.cutoff → est-ce une entrée de CETTE sortie ?  oui → valide ; sinon → erreur (line/col)
```

- On nomme **la voix** (pas la sortie) car la modulation est **par voix** : plusieurs voix peuvent
  partager une sortie ; `Bass.cutoff` dit « la coupure, **sur Bass** ».
- Le **type/plage** de l'entrée n'est pas décoratif : un CV sort **normalisé** (adsr → 0..1) ; c'est
  la plage de l'entrée (`cutoff` : 20–20000 Hz) qui dit comment étaler ce 0..1 en valeurs réelles.
  Ce mappage est fait **en aval** (dispatcher/webaudio), pas par BPx.

> **État data :**
> 1. **Registre des entrées de modulation par type de sortie** — EN COURS (passe Kanopi). Pour
>    webaudio : `{ cutoff:Hz 20–20000, amplitude:0–1, resonance:0–30, pitch:±1200c, pan:… }` (noms de
>    **synthèse**, source de vérité = le runtime webaudio de Kanopi). Tant que le registre n'est pas
>    figé, `cutoff` etc. sont acceptés comme valeurs libres NON validées par le transpileur ; la
>    validation des noms (erreur ligne/col si inconnu) se branchera quand Kanopi aura confirmé la liste.
> 2. ~~Renommer la lib `filter` → `mod`~~ **FAIT** (lib/mod.json). `cv env1 : mod.adsr(...)`.

## Contrat temporel des paramètres dérivés

La valeur d'un paramètre `()` est résolue ainsi :
- **littéral** (`cutoff: 2000`) → valeur posée, statique.
- **symbole dérivable** (`cutoff: Env`, `Env → env1 | env2`) → la grammaire dérive le symbole ; s'il
  résout en CV, sa courbe module l'entrée ; s'il résout en littéral, pose statique.
- **voix sœur** (`cutoff: Env` où Env est une voix parallèle) → câblage croisé : la sortie CV de la
  voix Env alimente l'entrée, alignée par la polymétrie, **sans re-dérivation** (réf. post-dérivation).

## Code du CV

Le comportement du modulateur est défini par du code **externe à BPScript** :

1. **Librairie JSON** — paramètres déclaratifs **ET la courbe** (bloc `curve`). La courbe vit dans
   la lib (pas dans le moteur) : segments déclaratifs (`to`/`dur`/`shape`, phase `hold`…`until`),
   ou `periodic` (LFO), ou `samples`, ou `expr`. Le **renderer est générique** : il lit `curve`
   sample-par-sample et ne connaît ni l'ADSR ni le LFO.
2. **Backtick inline** — code brut pour le live coding :
   ```bps
   cv env1 : `js: new Float32Array([0, 0.5, 1, 0.8, 0])`
   ```
3. **Runtime externe** — Python, SuperCollider via bridge :
   ```bps
   cv env1 : `py: numpy.linspace(200, 2000, 1000)`
   ```

BPScript ne sait pas ce qu'il y a dedans. C'est une étiquette avec une durée et un binding.

## Questions ouvertes

- ~~Comment exprimer le routing vers un paramètre spécifique ?~~ **Résolu (Romain 2026-06-20)** :
  pas de route sur la déclaration. La déclaration est descriptive (`cv env1 : mod.adsr(...)`) ; le
  branchement se fait **au point de paramètre** (`(cutoff: Env)`), où la valeur est un symbole
  dérivable de la grammaire. Faisabilité confirmée BPx (référence post-dérivation, voir plus haut).
- Peut-on chaîner des CV ? `(cutoff: env2)` où env2 module à son tour un autre CV ?
- Comment le transport Web Audio implémente-t-il l'échantillonnage + mappage sur plage ?
  `setValueCurveAtTime()` ?
- Faut-il un mécanisme de "bus" pour partager une voix CV entre plusieurs cibles ?

## Exemples

### ADSR sur filtre (branchement direct)
```bps
@filter
@core
@controls
@alphabet.western:browser

cv env1 : mod.adsr(attack:10, decay:200, sustain:0.5, release:300)

S -> Phrase1

Phrase1 -> C3 E3 G3 C4 (cutoff: env1, wave:sawtooth)
```

### LFO sur amplitude
```bps
@filter
@core
@controls
@alphabet.western:browser

cv wobble : mod.lfo(rate:2, amplitude:0.8, shape:sine)

S -> Melody

Melody -> C4 D4 E4 F4 G4 A4 B4 C5 (amplitude: wobble)
```

### Choix dérivé de modulation (voix parallèle)
```bps
@filter
@core
@controls
@alphabet.western:browser

cv env1 : mod.adsr(attack:500, decay:2000, sustain:0.6, release:400)
cv env2 : mod.adsr(attack:300, decay:1000, sustain:0.6, release:400)

S -> {Bass Bass Bass Bass, Env Env Env Env}
-----
@mode:random
Bass -> C2 C2 C3 C2 - C2 Eb2 C2 (cutoff: Env, wave:square, vel:120) [weight:40]
Bass -> C2 - Eb2 F2 F#2 F2 Eb2 - (cutoff: Env, wave:triangle, vel:60) [weight:30]
Bass -> C2 C2 C2 - G2 - Eb2 C2 (cutoff: Env, wave:sawtooth, vel:100)
Env  -> env1
Env  -> env2
```

### Backtick CV (live coding)
```bps
@core
@controls
@alphabet.western:browser

cv custom : `js: (t, dur) => Math.sin(t / dur * Math.PI * 8) * 0.5 + 0.5`

S -> Phrase1

Phrase1 -> C3 E3 G3 C4 (amplitude: custom)
```
