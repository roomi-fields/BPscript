# Acteurs — voix, sortie, code encapsulé

Modèle de l'acteur BPScript : une **scène** est un ensemble d'**acteurs** ; un acteur **est** une
voix. Ce document décrit le modèle validé (session design 2026-06-14/15). Grammaire normative :
`docs/spec/EBNF.md` (actor_directive, actor_body) et `docs/spec/AST.md` (`ActorDirective`,
`TransportRef`). Opérateurs : `.` **pointe** une entité, `:` **lie** un sujet, `@` **déclare**,
`` ` ` `` = code étranger (terminal de plein droit).

## 1. L'acteur est une voix

Un acteur lie six propriétés. Le niveau « voix » intermédiaire d'anciennes versions a été
**supprimé** : acteur = voix.

| Propriété | Rôle | Référence |
|---|---|---|
| `alphabet` | vocabulaire de symboles — **hérité par cascade** (acteur → scène `@alphabet.X` → socle @core), JAMAIS requis (modèle Romain 2026-07-13) ; si la scène invoque une hauteur opaque `@mine.`/`@factory.`, l'alphabet reste résolu en aval (Kairos) | `lib/alphabets.json` |
| `tuning` | tempérament / accordage (ex-`scale`) | `lib/tuning.json` |
| `octaves` | convention de registre / notation — **défaut hérité de l'alphabet**, surchargeable par acteur | `lib/octaves.json` |
| `sound` | son par défaut de l'acteur — **producteur PAR SYMBOLE** (banque, ou prospectif backtick-synthé) | `@sound` |
| `transport` | **canal de sortie** de NOTRE production (`audio`/`midi`/`osc`) — **optionnel**, défaut cascade @core `audio` ; **ABSENT (interdit) sur un acteur `eval`** (il sort en natif) | librairie `@devices` |
| `eval` | **producteur embarqué autonome** (`strudel`/`hydra`/`p5`/`csound`/`mercury`) : produit + sort en **natif** ; absence d'`eval` ⇒ producteur **défaut `js`** (notre code) | — |

### Modèle producteur / canal (décision Romain 2026-07-14, `hub/decisions/2026-07-14-modele-producteur-canal-eval-transport.md`)

Un acteur porte **deux axes orthogonaux** en plus de son alphabet/tuning/octaves :

- **PRODUCTEUR** — ce qui fabrique le signal :
  - `eval.<X>` = **programme embarqué autonome** (strudel/hydra/p5/csound/mercury). Il **produit par
    ses propres moyens et sort en natif** (son propre audio, son propre canvas). ⇒ on ne lui donne
    **PAS** de `transport` (au plus l'horloge le déclenche ; on ne route pas sa sortie).
  - **Pas d'`eval` ⇒ producteur défaut = `js`** (IMPLICITE) — notre code, qui **produit dans NOTRE
    environnement** (nos primitives de sortie). Tient tant qu'on n'embarque qu'**un seul** langage de
    programmation (js). C'est le seul cas de voix de code où l'on utilise nos propres `transport`.
  - `sound.<X>` = producteur **par symbole** (transforme une note/fréquence résolue en son) : banque
    de sons **OU** — *prospectif, à spécifier* — backtick-synthé paramétré par la hauteur.
- **CANAL DE SORTIE** — `transport.<X>` = **NOS** runtimes de sortie (`audio`/`midi`/`osc`), appliqués
  **uniquement à NOTRE production** (le défaut `js` et les voix symboliques alphabet→`sound`).

**Il n'existe PAS de `transport.video` / `transport.visual`.** Les visuels embarqués (hydra/p5) sortent
en natif sur leur canvas → **rien à exprimer** côté transport. L'axe visuel est **supprimé**, pas
renommé (résout la question « video vs visual »).

Déclaration (les références d'entité utilisent `.`) :

```bpscript
@actor sitar
  alphabet.sargam
  tuning.sargam_22shruti
  transport.webaudio
```

Dans les règles, un terminal se qualifie par son acteur en **dot notation** : `sitar.Sa`
(→ `{ name:"Sa", actor:"sitar" }`). La forme legacy `terminal:acteur` n'est plus blessée par la spec.

`octaves` est une **étape de résolution distincte** (la notation du registre, `lib/octaves.json`),
rattachée au vocabulaire de symboles : par défaut un acteur **hérite** de la convention de son
alphabet ; `@actor X octaves.Y` la **surcharge** (ex. écrire du sargam avec des marqueurs d'octave
occidentaux). Décision *cles-acteur-six* (Romain 2026-06-16).

## 2. Voix de notes vs voix de code

Deux usages d'une même voix.

Deux usages d'une même voix. La **sortie** dépend du PRODUCTEUR (modèle producteur/canal, Romain
2026-07-14) : une voix de code sur `eval.<X>` (strudel/hydra…) sort **en natif** (pas de transport) ;
une voix de code SANS `eval` (producteur défaut `js`) et une voix de notes utilisent **NOTRE**
`transport`.

| | Voix de notes | Voix de code `eval.<X>` (natif) | Voix de code défaut `js` |
|---|---|---|---|
| Contenu | terminaux résolus en hauteurs/sons | code étranger en backtick | code étranger en backtick |
| Producteur | alphabet→`sound` | `eval.strudel`/`hydra`/`p5`/`csound`… | `js` (implicite, notre code) |
| Sortie | **notre** `transport` (audio/midi/osc) | **NATIVE** (son propre audio/canvas) — **pas de transport** | **notre** `transport` |
| Exemple | `S -> sitar.Sa sitar.Re` | `@actor viz eval.hydra` / `viz -> ` `` `osc(4)` `` | `@actor v` / `v -> ` `` `js: out(...)` `` |

**Ce qui est transporté = seulement NOTRE production** (voix de notes + producteur défaut `js`). Sa
sortie est **placée** par le dispatcher dans le temps vers le `transport` de la voix. Une voix `eval.<X>`
ne l'est PAS : elle **produit et sort par ses propres moyens** ; le rerouting de sa sortie native à
travers nos runtimes est **écarté** (décision 2026-07-14 — pixels/audio déjà synthétisés non routables).

Le backtick est un **terminal de plein droit** : il occupe une position dans le flux comme une note
(cf. `BacktickStandalone`, EBNF §4.13). Le **tag** désigne l'interpréteur.

### Durée d'une voix de code (TRANCHÉ — décision Romain, cohérente ARCHITECTURE.md ; hub backlog A3)

Un backtick étant un **terminal de plein droit ordonnancé par BPx**, il **a une durée** — la question
« durée ou pas » n'est **pas ouverte**. Deux durées **distinctes** coexistent :

- **Durée EXTÉRIEURE** = le **slot du terminal dans la dérivation**, calculé par **BPx** comme pour
  toute position de terminal : défaut = **une unité de pas**, ou la valeur d'une **durée explicite
  `:N`** collée (`` `js:…`:2 `` — notation de 1er rang, portées {terminal, groupe, règle},
  EBNF §Durée). C'est CETTE durée qu'affiche la vue Structure. **Réglé**, pas ouvert. Le code est
  déclenché **au temps T** (onset du slot) ET **occupe** ce slot — « les deux » (hub backlog A3,
  cohérent ARCHITECTURE.md : code envoyé au temps T + quantification au cycle).
- **Durée INTÉRIEURE** = la **séquence propre du moteur invité** (le code Strudel/Tidal/… a son
  déroulé interne). Elle n'est PAS le slot extérieur ; le langage invité doit pouvoir la **consulter
  via des variables** (durée du slot hôte exposée au code — spécifié par Romain de longue date), afin
  d'aligner sa séquence interne sur le cadre temporel du terminal hôte.

L'AST ne porte pas de champ « durée » sur `BacktickStandalone` **parce que** la durée extérieure EST
le slot de dérivation (résolu par BPx), pas une donnée gravée dans le nœud — et non parce qu'elle
serait indéfinie.

## 3. Appareils (`transport`)

`transport` est le **canal de NOTRE sortie** : il pointe un appareil typé d'une librairie `@devices`,
et ne concerne **QUE nos runtimes** — `audio`, `midi`, `osc` (défaut cascade @core = `audio`). Un
appareil porte un type de sortie (notes, signal, OSC…) ; la compatibilité voix → appareil se vérifie
sur ce type.

**Deux exclusions posées par le modèle producteur/canal (décision Romain 2026-07-14) :**
- **Pas de canal visuel** : `transport.video` / `transport.visual` **n'existent pas**. Les visuels
  embarqués (hydra/p5) sortent en natif ; on ne route pas leurs pixels.
- **Un acteur `eval` ne porte pas de `transport`** : il produit et sort en natif. Écrire un
  `transport` sur un acteur `eval` est une **contradiction** (voir §1) — à rejeter, pas à ignorer.

> Ouvert (backlog B2/B3) : format de la librairie `@devices` (désormais **audio/midi/osc seulement**,
> plus le visuel), appareil par défaut, et la clause d'interface des runtimes encapsulés (« comment
> j'expose ma sortie pour transport » + typage de la voix).

### Librairie de runtime (`@library.<moteur>`)

Un moteur (`eval`) peut avoir besoin d'une **librairie de runtime** (banque d'échantillons,
presets…) chargée avant exécution. Elle se déclare en en-tête, **liée au moteur**, et est **partagée
par toutes les voix de ce moteur** :

```bpscript
@library.strudel "dirt-samples"
```

Le nom est une **chaîne** (convention B5 : un nom = IDENT | chaîne ; chaîne ici car tiret / ressource
externe). BPScript ne fait que **porter** le nom ; le chargement réel est résolu en aval
(Kanopi/workspace). Exposé dans `compileBPS().libraries` (`{ strudel: ["dirt-samples"] }`).

La **sortie** (paramètres de rendu : vélocité, pan, canal, params de transport…) suit une cascade à
**trois niveaux**, l'override le plus fin l'emportant. Elle est **distincte** de la cascade des sons
(8 niveaux, `docs/spec/AST.md`) : ne pas en calquer la liste. On dit « terminal » et non « note » :
tout n'est pas une note (bol, backtick…).

| Niveau | Portée | Override |
|---|---|---|
| 1. scène | défauts de la scène | (à préciser — backlog A2) |
| 2. acteur | tous les terminaux de la voix | bindings `transport`/`eval` ; qualifiers acteur (backlog A2) |
| 3. terminal | une occurrence | `Sa(vel:80)`, `acteur.terminal(...)` |

> Ouvert (backlog A2) : lister exactement les niveaux et la **syntaxe d'override** à chaque niveau
> (scène et acteur ne disposent pas encore d'une forme d'override de sortie dédiée).

## 5. Points ouverts (renvoi backlog)

`hub/projets/backlog-langage-bps.md` :

> **A3 (durée d'un backtick) = TRANCHÉ**, retiré de cette liste (il n'a jamais été ouvert) :
> voir ci-dessus §2 « Durée d'une voix de code » — terminal à durée BPx (extérieure) + durée
> intérieure du moteur invité consultable par variables. Aligné sur `backlog-langage-bps.md` §A
> (« Points déjà DÉFINIS — ne pas rouvrir »).

- **A1** — synchro temporelle moteurs-code (Strudel/Tidal ont leur horloge) ↔ timeline BPScript.
  Seul point pouvant remettre en cause l'archi ; à creuser avant l'implémentation cross-runtime.
  Le modèle d'horloge est **défini** dans `docs/design/ARCHITECTURE.md` (répartiteur = horloge,
  quantification au cycle façon TidalCycles, triggers `!sync`, code au temps T) — s'y aligner, ne
  rien réinventer.
- **A2** — niveaux exacts + syntaxe d'override de la cascade de sortie.
- **B2/B3** — librairie `@devices` (désormais **audio/midi/osc seulement**, plus de visuel), contrats
  d'interface des runtimes de sortie. **B4 (capture-pour-retransport) = ÉCARTÉ** (décision 2026-07-14 :
  les `eval.<X>` sortent en natif, on ne reroute pas leurs sorties déjà synthétisées).
- **D2** — migration `.kanopi → .bps` + schéma de mapping (dev downstream, après spec ferme).
