# Les étages du langage — ce dont BPScript est fait

> Ce document décrit **ce dont le langage est fait**, entre `LANGUAGE.md` — qui dit ce qu'on écrit
> dans une scène — et `LIBRAIRIES.md` — qui dit ce qui est déclarable et comment on l'invoque. Ce
> qui est **décidé et pas encore câblé** y est marqué comme tel, jamais présenté comme un état.

BPScript a un cœur minimal et déclare le reste en librairie. Un mot que le compilateur connaît est
un mot qu'on ne peut ni lire ni surcharger : le nombre de ces mots est la mesure du cœur.

## Deux étages

Un objet appartient à l'un des deux, et cette appartenance ne dépend ni de sa librairie ni de sa
place dans un fichier.

| étage | ce qu'il contient | comment on le reconnaît |
| --- | --- | --- |
| **le plancher** | ce qui ne se décompose plus | un objet **vide** — un nom déclaré sans membres |
| **les descripteurs** | tout le reste | des membres, composés à partir du plancher |

Le plancher compte onze objets, tous déclarés dans `types` : `integer`, `float`, `boolean`,
`control`, `flag`, `symbol`, `enum`, `addresskey`, `temperament`, `midi_default`, `destination`.
Ils sont **écrits**, donc lisibles et surchargeables — c'est ce qui les sépare d'une valeur codée
en dur, dont personne ne connaît l'existence.

```bpscript
def integer                                          // plancher — ne se décompose plus
def unit(quantity(duration, interval), ratio:1)      // descripteur — composé
unit ms(quantity:duration, ratio:0.001)              // exemplaire d'un descripteur
```

Un descripteur se réutilise : il est déclaré une fois, et ses exemplaires en dérivent. Un membre
écrit sans exemplaire est obligatoire ; un membre qui porte un exemplaire est optionnel, et
l'exemplaire dit ce que le membre attend.

## Porter du code est un membre, pas un étage

Un objet peut porter son implémentation, dans un membre `body`. Cela ne change pas son étage : tout
objet qui porte un corps décrit également autre chose, et aucun ne porte que lui. Un descripteur
acquiert donc son code sans changer de nature, et le perd de même.

C'est ce qui rend une migration possible sans reclassement : un contrôle dont l'effet vit ailleurs
peut recevoir un corps, et rester le même objet.

## Où vit l'effet — quatre destinataires

Ce qu'un objet **est** et **qui l'exécute** sont deux questions indépendantes.

| destinataire | ce qui le désigne |
| --- | --- |
| le compilateur | rien : il interprète le membre lui-même |
| le moteur natif BP3 | `bp3:` — **le nom de la commande dans l'autre langage**, jamais un lieu d'exécution |
| un runtime | le résolveur nommé |
| l'objet lui-même | son membre `body` |

`bp3:` mérite sa précision : BP3 et BPScript sont deux langages qu'un même cœur interprète, avec
deux frontaux et une structure de librairie partagée. Un contrôle qui porte `bp3:_vel` dit comment
il s'appelle côté BP3 ; côté BPScript, son nom est son nom.

**Décidé, pas encore câblé** : chaque objet nomme son résolveur dans `resolvedBy`, qui accepte
**plusieurs valeurs**. Une intention rendue différemment par plusieurs sorties — le volume d'une
voix, que le MIDI envoie en CC7 et que le runtime audio convertit en gain — se déclare par le nom
partagé et les résolveurs de chaque réalisation.

## Ce qu'un membre attend

Un membre déclare le genre de sa valeur, son nom, et son défaut :

```
<type> <nom>            crée le membre ; sans défaut, il est obligatoire
<type> <nom>:<valeur>   crée en affectant ; la valeur est le défaut
<nom>:<valeur>          pose une propriété sur un membre qui existe déjà
```

**Décidé, pas encore câblé** : les bornes d'un membre se rattachent à l'argument qu'elles bornent,
dont elles héritent le genre — un intervalle d'entiers et un intervalle de flottants ne se
distinguent pas autrement. Un objet dont les membres sont numérotés les déclare comme les autres,
chacun portant son numéro, et la forme numérique reste écrivable pour ce qui n'a pas de nom.

## La limite du codé-en-dur

Un mot que le compilateur interprète lui-même est irréductible : quelqu'un doit le connaître. La
limite ne se pose donc pas sur **quels** mots, mais sur **combien de lecteurs** chacun a.

**Un mot interprété a un seul lecteur.** Plusieurs lecteurs d'un même mot divergent : chacun couvre
une population différente, et la place d'écriture décide lequel s'applique — ce que l'auteur d'une
scène ne peut pas savoir.

C'est la règle que la structure des librairies sert : chaque mot du cœur est lu une fois, et tout ce
qui peut se déclarer se déclare.
