# Dossier — 19 contrôles natifs BP3 sont classés « runtime » et sortent en `_script`

**Pour arbitrage : Romain.** Rédigé 2026-07-19 par bpscript, à la demande de l'architecte (note [698]).
**Statut : question ouverte.** Rien n'est appliqué. Aucune syntaxe ne change dans les scènes.

> **Pourquoi Romain et pas l'architecte** : la frontière runtime/engine est une décision d'architecture
> déjà prise (`controls.json` fait autorité ; `transpose`/`keyxpand` y sont classés *runtime*). Ce
> dossier crée une **tension** avec elle — le moteur BP3 émet ces contrôles *nommés*, et Kairos en
> résout certains en aval. « runtime » est peut-être un vestige d'avant Kairos. Ce n'est pas à moi
> de le trancher.

---

## POURQUOI — ce que ça casse aujourd'hui

Le natif écrit les contrôles **nommés** ; j'émets un script opaque :

```
natif : Part1 --> /8 _mapstep _keymap(C3,C3,C5,C5) M M …
émis  : Part1 --> /8 _script(CT 3) _script(CT 4)    M M …
```

BPx ne reçoit donc jamais un `_keymap` — il reçoit un `_script` qu'il ne peut pas interpréter. Le
mappage n'est pas appliqué, et les durées sortent fausses.

**Causalité PROUVÉE, pas supposée** (expérience locale, revertée) : en déplaçant `keymap`, `mapstep`,
`mapcont`, `mapfixed` et `vel` vers `engine`, l'émission devient identique au natif et la durée
mesurée passe de **8000 ms à 1000 ms** — un facteur 8 exact tombe. (Le facteur 8 restant est un
défaut distinct, chez BPx, déjà routé : l'opérateur nu `/N` multiplie le jeton suivant au lieu de
le diviser. 8 × 8 = 64, le facteur total observé.)

**Rayon mesuré** : **40 scènes sur 85** émettent `_script` là où le natif émet un contrôle nommé.
**30 de mes 53 DIFF** sont dans cette classe (57 %).

⚠️ **Réserve que je maintiens** : 2 scènes touchées sont **déjà ISO** (`checkVolMasterSlave`,
`tryMIDIfile`). La cause n'est donc **pas suffisante** — un `_vel` ne change ni le nom ni le minutage
d'un jeton, donc il ne se voit pas dans la comparaison ; un `_keymap` ou un `_transpose`, si. Corrélation
forte, causalité prouvée **là où le contrôle mord sur le temps ou la hauteur** — pas ailleurs.

---

## QUOI — les 21 contrôles, deux axes

**Axe 1 — le moteur les connaît-il ?** Relevé dans la source C : **les 21 sont NATIFS**, sans exception.

**Axe 2 — où vivent-ils dans le modèle Kairos ?** Selon `core.json` (`_destinations`).

| Contrôle | Classement actuel | Jeton moteur (source C) | Destination déclarée |
|---|---|---|---|
| `legato` | **engine** ✅ | `T20` — `ProduceItems.c:1220` | — |
| `staccato` | **engine** ✅ | `Encode.c:200` case 20 | — |
| `vel` | runtime.musical | `T11` — `Polymetric.c:444` | (héritée) |
| `velcont` | runtime.musical | `T12` — `ProduceItems.c:1212` | (héritée) |
| `rndvel` | runtime.musical | `T38` — `ProduceItems.c:1236` | (héritée) |
| `keymap` | runtime.midi | `T37` — `SetObjectFeatures.c:1471` | (héritée) |
| `mapstep` | runtime.midi | `DisplayArg.c:873` case 27 | (héritée) |
| `mapcont` | runtime.midi | `Encode.c:295` case 54 | (héritée) |
| `mapfixed` | runtime.midi | `DisplayArg.c:871` case 25 | (héritée) |
| `pitchbend` | runtime.midi | `T15` — `ProduceItems.c:1215` | (héritée) |
| `pitchrange` | runtime.midi | `T21` — `ProduceItems.c:1221` | (héritée) |
| `volume` | runtime.midi | `DisplayArg.c:1413` | (héritée) |
| `mod` | runtime.midi | `T14` — `ProduceItems.c:1214` | (héritée) |
| `press` | runtime.midi | `T16` — `ProduceItems.c:1216` | (héritée) |
| `ins` | runtime.midi | `DisplayArg.c:1415` | **sortie (runtime)** |
| `value` | runtime.generic | `T35` — `ProduceItems.c:1234` | (héritée) |
| `cont` | runtime.generic | `T34` — `ProduceItems.c:1233` | (héritée) |
| `fixed` | runtime.generic | `T36` — `ProduceItems.c:1235` | (héritée) |
| `transpose` | runtime.dispatcher | `T26` — `ProduceItems.c:1225` | **résolution-hauteur (Kairos)** |
| `keyxpand` | runtime.dispatcher | `T40` — `DisplayArg.c:1022` | (héritée) |
| `scale` | runtime.dispatcher | `T44` — `ProduceItems.c:1240` | **résolution-hauteur (Kairos)** |

### Le groupe témoin qui rend la démonstration propre

`legato` et `staccato` sont **déjà** en `engine`, et ils émettent nativement :

```
M[legato:300]  →  M _legato(300)        M(legato:300)  →  M _legato(300)
M[vel:64]      →  M _script(CT 0)       M(vel:64)      →  M _script(CT 0)
```

**La graphie ne change RIEN** — crochets ou parenthèses donnent le même résultat. Seule la
**classification dans la lib** décide. Deux conséquences pour la décision :

1. **Aucune scène existante n'est réécrite.** Ce qui change est ce qui est *émis*, pas ce que
   l'auteur écrit. Le risque de migration est nul.
2. **Le correctif est exactement une reclassification** — pas de code, pas de syntaxe. `legato` et
   `staccato` prouvent que le mécanisme marche déjà.

---

## COMMENT — trois options

| Option | Ce qu'elle fait | Ce qu'elle coûte / risque |
|---|---|---|
| **(a) Tout reclasser en `engine`** | les 19 émettent nativement, comme le natif | efface la distinction runtime/engine pour ces mots ; si l'un d'eux est *vraiment* un contrôle de sortie (`ins` = Program Change MIDI ?), on le range au mauvais endroit |
| **(b) Reclasser SÉLECTIVEMENT** | seuls ceux qui mordent sur le temps ou la hauteur (`keymap`, `mapstep/cont/fixed`, `transpose`, `keyxpand`, `scale`, `pitchbend`, `pitchrange`) | demande de trancher cas par cas ; mais c'est le seul qui respecte l'intention d'origine de la frontière |
| **(c) Statu quo** | rien | 40 scènes continuent d'émettre autre chose que le natif, et l'iso reste hors d'atteinte pour elles |

---

## Ce que je ne tranche pas

Trois remarques factuelles, sans recommandation :

1. **La tension est réelle et ancienne.** `transpose` est classé *runtime.dispatcher* ET déclaré
   « résolution-hauteur (Kairos) » — donc déjà reconnu comme non-runtime dans le modèle. Le mot
   « runtime » y recouvre deux choses différentes : « exécuté par un transport aval » et « pas
   compris par le moteur BP3 ». Ces contrôles sont le second sans être le premier.
2. **`ins` est le cas le plus discutable.** C'est un Program Change MIDI, explicitement déclaré
   « sortie (runtime) » — l'argument « c'est un vrai contrôle de sortie » y est le plus fort, alors
   même que le moteur le connaît.
3. **Le coût du statu quo est quantifié** : 30 DIFF sur 53 dans la classe. Ce n'est pas une raison
   de décider vite, c'est une raison de décider.
