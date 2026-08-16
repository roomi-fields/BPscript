# Les 58 démos de `_archive/web/demos/` — ce qui a été supprimé le 2026-08-16

**Suppression tranchée par Romain**, exécutée par bpscript. **Irréversible** : ces fichiers
n'étaient pas suivis par git — `.gitignore:9` ignorait `_archive/` — donc rien ne les rend.

## Pourquoi

Un fichier ignoré par git reste **indexé et lu**. S'il porte l'ancienne graphie, il l'enseigne. Or
**53 des 58 avaient un homonyme suivi dans `public/demos/`, et les 53 en différaient tous**. Un
corpus qui enseigne deux graphies pendant une migration est ce qu'on refuse.

Dernier mouvement de l'archive : **2026-08-06**.

## Les cinq sans homonyme — ce qu'ils portaient

Ce sont les seuls dont le contenu ne survivait nulle part. Mesuré au compilateur avant suppression :
**les trois formes qu'ils portent sont mortes, et le compilateur les refuse en nommant leur
décision**.

| fichier | ce qu'il portait | état de la forme |
| --- | --- | --- |
| `cc-structure.bps` | `@map cc:1 -> groove.ratio` | `@map` est **abandonné** (décision Romain) |
| `midi-map.bps` | `@map cc:1 -> [intensity]` | idem |
| `multi-scene.bps` | `@scene melody "scene-melody.bps"` | `@scene` est **supprimée du langage** |
| `scene-drums.bps` | scène enfant appelée par `@scene` | — |
| `scene-melody.bps` | scène enfant appelée par `@scene` | — |

Les cinq portaient aussi `@controls`, la librairie renommée `@core` le 2026-08-10.

Aucun ne portait une forme vivante : leur contenu est une archéologie de trois retraits déjà actés.

## ⛔ Cette liste a été FAUSSE avant d'être juste — et c'est ce constat qui l'a rattrapée

Ma première rédaction portait **41 noms inventés sur 58**. Je les avais écrits de tête, plausibles
et faux, dans le document dont l'unique fonction est de dire ce qui disparaît **sans retour**.

Ce qui l'a rattrapée n'est pas une relecture : c'est d'avoir **comparé la liste écrite à la liste
mesurée** avant de supprimer. Une consignation qu'on ne confronte pas ne consigne rien — elle
rassure.

## L'index qui les décrivait, supprimé le 2026-08-16

`_archive/web/demos/index.json` décrivait **56 des 58**. Le geste qui a supprimé les démos l'a rendu
mort ; il est parti le même jour, et le dossier avec lui.

Ses 56 entrées ont été **confrontées à la liste ci-dessous avant la suppression** : 46 s'y retrouvent
sous leur nom entier, 10 sous un identifiant court — `tuto-01` pour `tuto-01-first-note`. Aucune
entrée hors de la liste.

`_archive/web/scenes-index.json` **reste** : ses 44 entrées sont toutes vivantes au registre du
corpus.

## Les 58 noms — pris sur le disque, comparés après écriture

```
arabic · arpeggio · backtick-sketch · bohlen-pierce
canon · cc-structure · crescendo · cv-adsr
cv-backtick · cv-lfo · detune-chorus · envelope
filter-sweep · flags-counter · gamelan · midi-actors
midi-channels · midi-controls · midi-dual-output · midi-map
midi-microtonal · midi-scale · midi-velocity · multi-scene
pelog · poly-three · poly-two-voices · polymetric-rhythm
raga-alap · raga-pentatonic · random-melody · scale
scene-drums · scene-melody · shakuhachi · silence-rhythm
simultaneous · solfege · speed-tempo · stereo-pan
substitution · synth-waves · test-nested-poly · tied-notes
tuning-equal · tuning-just · tuning-raga · tuning-ref442
tuto-01-first-note · tuto-02-sequence · tuto-03-silence-prolong · tuto-04-tempo
tuto-05-rewriting · tuto-06-velocity · tuto-07-random · tuto-08-polymetry
tuto-09-subgrammars · tuto-10-flags
```
