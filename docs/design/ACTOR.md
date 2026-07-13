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
| `sound` | son par défaut de l'acteur | `@sound` |
| `transport` | appareil de rendu typé (requis) | librairie `@devices` |
| `eval` | interpréteur du code encapsulé | — |

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

| | Voix de notes | Voix de code |
|---|---|---|
| Contenu | terminaux (notes/bols) résolus en hauteurs/sons | code étranger en backtick (terminal) |
| Interprétation | résolution pitch + son (cascades pitch/sons) | `eval` (interpréteur : `sc`, `py`, `tidal`, `strudel`, `js`…) |
| Sortie | `transport` (appareil) | `transport` (appareil) — **capture-pour-retransport** |
| Exemple | `S -> sitar.Sa sitar.Re` | `S -> ` `` `strudel: s("bd*4")` `` |

**Code encapsulé = toujours transporté.** Le code n'est pas rendu en place par son moteur natif de
façon opaque : sa sortie est **captée** à l'interprétation puis **placée** par le dispatcher vers le
`transport` de la voix. C'est nous qui plaçons l'événement dans le temps.

Le backtick est un **terminal de plein droit** : il occupe une position dans le flux comme une note
(cf. `BacktickStandalone`, EBNF §4.13). Le **tag** désigne l'interpréteur.

## 3. Appareils (`transport`)

`transport` pointe **toujours** un **appareil typé** d'une librairie `@devices`. `midi` est
l'appareil basique par défaut. Un appareil porte un type de sortie (notes, signal, lumière, vidéo,
OSC…) ; la compatibilité voix → appareil se vérifie sur ce type.

> Ouvert (backlog B2/B3) : format de la librairie `@devices`, appareil `midi` par défaut, et la
> clause d'interface des runtimes encapsulés (« comment j'expose ma sortie pour transport » +
> typage de la voix).

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

- **A1** — synchro temporelle moteurs-code (Strudel/Tidal ont leur horloge) ↔ timeline BPScript.
  Seul point pouvant remettre en cause l'archi ; à creuser avant l'implémentation cross-runtime.
  Le modèle d'horloge est **défini** dans `docs/design/ARCHITECTURE.md` (répartiteur = horloge,
  quantification au cycle façon TidalCycles, triggers `!sync`, code au temps T) — s'y aligner, ne
  rien réinventer.
- **A2** — niveaux exacts + syntaxe d'override de la cascade de sortie.
- **A3** — backtick-terminal : occupe du temps (gate) ou déclenche (trigger) ? Cas limites temporels.
- **B2/B3/B4** — librairie `@devices`, contrats d'interface des runtimes, capture-pour-retransport.
- **D2** — migration `.kanopi → .bps` + schéma de mapping (dev downstream, après spec ferme).
