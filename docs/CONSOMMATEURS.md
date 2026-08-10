# Qui lit ma surface — et ce qu'un préavis doit porter

Une forme du langage qui change casse ses lecteurs en minutes. Ce document dit **qui prévenir** et
**avec quoi**.

## Les lecteurs de la surface

| dépôt | ce qu'il lit de moi | comment le mesurer |
| --- | --- | --- |
| **kanopi** | les scènes de sa bibliothèque (`packages/library/scenes/`) | passer son dossier au compilateur |
| **BPx** | son corpus de scènes de test, et l'arbre que j'émets | passer `test/scenes/` au compilateur |
| **Kairos** | l'arbre — les acteurs, la hauteur, les contrôles résolus | ce qu'`ast.actors` et les références portent |
| **bp3-frontend** | les instantanés natifs et l'oracle | `test/grammars/*/snapshots/`, `test/oracles/` |
| **Atlas** | les exemples de la documentation utilisateur | son garde de liens et son extracteur d'exemples |

Une scène vit chez son propriétaire ; le compilateur vit ici. Mesurer le corpus d'un voisin avant de
livrer se fait de chez moi ; **committer chez lui reste à lui**.

## Les trois informations d'un préavis

Un préavis tient en trois lignes, et les trois sont nécessaires :

1. **la forme qui sort** — écrite telle qu'elle s'écrivait ;
2. **la forme qui entre** — écrite telle qu'elle s'écrira, avec la réécriture d'un cas groupé s'il
   en existe un ;
3. **les variantes voisines, concernées ou non, nommées une par une** — la forme en flux, les blocs
   de dérivation, les formes préfixées.

La troisième est celle qui manque le plus souvent. Sans elle, un lecteur migre par symétrie et casse
une forme qui était hors du changement.

## Ce qui déclenche un préavis

- une forme du langage devient invalide ;
- une forme nouvelle occupe un nom déjà employé ;
- un artefact dérivé lu par un autre dépôt change de contenu ou de format.

Le préavis part **avant** la frappe, et la mesure d'impact par dépôt l'accompagne : nombre de
fichiers et nombre de lignes, comptés sur la forme exacte et non sur le mot.

## Après la frappe

Le préavis se double d'un second message qui dit ce qui a été migré et par qui. Un lecteur qui
mesure son disque après une migration voit l'état d'arrivée sans savoir qu'il vient d'un tiers :
**l'état ne dit ni qui l'a produit ni quand**. Le message porte cette information, la mesure ne la
porte pas.
