# Voix de code — langages backtickés

> **Brouillon source (bpscript) à router par l'architecte vers Atlas** pour intégration
> dans la doc utilisateur (MkDocs). Parties **ratifiées** ; la sous-section *Timing fin*
> est un **placeholder** jusqu'à ratification du chantier Kronos.
> Sources : décisions hub `2026-07-04-cv-curve-syntaxe-backtick-type.md` et
> `2026-07-04-modele-timing-voix-de-code.md`.

Une **voix de code** insère du code d'un autre langage (Strudel, Hydra, p5, Csound,
Mercury, TidalCycles, JavaScript…) directement dans une scène, entre **backticks**
`` ` ``. BPScript n'exécute pas ce code : il l'**ordonnance** (le place dans le temps) et
le route vers le moteur qui l'interprète.

## 1. Le langage est toujours connu — jamais deviné

Le langage d'un backtick est fixé de **deux** façons, jamais par supposition :

- **Tag explicite** en tête du backtick : `` `strudel: s("bd sd")` ``. Le tag (`strudel`,
  `js`, `sc`, `hydra`, `p5`, `csound`, `mercury`, `tidal`…) est la **clé d'interprète**.
- **Héritage** de l'`eval` d'un acteur : sous un `@actor … eval.X`, un backtick dans une
  règle de cet acteur **hérite** de `X` — le tag devient facultatif.

Un backtick **sans tag ET hors acteur à `eval`** (backtick isolé au niveau scène, courbe
CV, ou flux sans acteur) déclenche une **erreur claire** : le langage serait inconnu. Un
tag explicite **surcharge** un `eval` hérité (ex. une courbe `js:` dans une voix `strudel`).

```
@actor drums  eval.strudel  transport.osc

S -> drums drums drums drums
drums -> `s("bd sd hh hh")`        // hérite « strudel » de l'acteur drums
```

Forme équivalente par tag, sans acteur dédié :

```
S -> Beat Beat
Beat -> `strudel: s("bd sd hh hh")`
```

## 2. Un terminal routé vers un moteur

Un backtick est un **terminal de plein droit** : il occupe une position dans la structure
comme une note. `S -> drums` dérive le terminal `drums` ; à sa position temporelle, le code
est envoyé à son moteur (via `transport`) qui le rend (son, image, pattern…). Une voix de
code n'est pas forcément sonore : `eval.hydra` rend de l'**image**.

## 3. Courbes de modulation (CV)

Une **courbe custom** de modulation se déclare avec le mot-clé `cv` — qui type le **rôle**
(modulation) — et un backtick tagué — qui type le **langage** :

```
cv sweep : `js: (t, dur) => { return 0.5 + 0.5 * Math.sin(2 * Math.PI * t / dur); }`
```

La courbe reçoit le temps `t` et la durée `dur`, renvoie une valeur (typiquement 0..1).
Elle est **déclarée une fois, réutilisable**. Le **branchement** se fait **au point de
paramètre**, là où on l'applique :

```
Lead -> C4(cutoff:sweep) E4 G4(cutoff:sweep) _ (wave:sawtooth, vel:90)
```

`C4(cutoff:sweep)` module le paramètre `cutoff` de la note par la courbe `sweep`. Le
transport est celui de l'acteur. `cv` type le rôle, le tag type le langage — orthogonaux,
tous deux requis (une courbe CV est un backtick isolé : son tag est obligatoire).

## 4. Tempo — modèle DAW (ratifié)

Comme dans un DAW, **l'hôte possède le tempo maître et toute voix de code y est asservie.**

- **Une seule autorité de tempo** (le transport de Kanopi). Pas de second écrivain d'horloge.
- **Le tempo absolu déclaré dans un patch** (`set tempo 110`, `setcps 0.5`…) est **écrasé** :
  un patch est une voix asservie, pas un maître d'horloge. Sa **structure rythmique** (dans
  son cycle) est préservée et **s'échelonne** avec le tempo maître.
- **Polytempo = un ratio du maître** (« cette voix ×2 »), jamais un absolu enfermé dans le
  patch — comme le tempo-par-piste des DAW. Un maître + des ratios relatifs = sync préservée.

La convention live-coding (`setcps` dans le code) est donc **réinterprétée** : l'hôte pilote
l'horloge, le code exprime le rythme **relativement**. « Un DAW pour live-codeurs. »

## 5. Timing fin — *placeholder (en cours de ratification)*

> Cette section sera complétée à la ratification du chantier transport (Kronos). Cadre
> pressenti (non encore ratifié, **ne pas s'y fier**) : une voix de code est un **container**
> dont le début / fin / boucle appartiennent au transport ; l'invité **remplit** le container
> sans en dicter la taille ; à la couture de boucle, l'invité **redémarre**. Le mode
> d'expression de la **durée** d'un container par la scène (annotation ? multiplicateur ?)
> est une décision de surface **à trancher** — elle sera documentée ici une fois ratifiée.

## Récapitulatif des formes

| Forme | Exemple | Langage donné par |
|---|---|---|
| Tag explicite (flux) | `` `sc: Synth.new` `` | le tag |
| Héritage d'acteur | `@actor v eval.tidal` puis `v -> \`d1 $ …\`` | l'`eval` de l'acteur |
| Override sur héritage | dans une voix `strudel`, `` `js: 1+1` `` | le tag (prioritaire) |
| Courbe CV | `` cv w : `js: (t,dur)=>…` `` | le tag (obligatoire) |
| Branchement CV | `C4(cutoff:w)` | — (réfère la courbe `w`) |
