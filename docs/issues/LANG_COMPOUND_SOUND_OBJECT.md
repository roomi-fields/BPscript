# Dossier langage — sound-object composé (`do5_do5do5`) vs notes plates

> Question à trancher par Romain (préparée par bpscript, drive dhati Cause B, 2026-07-18).
> Architecte présente. Ne rien coder avant décision.

## Le phénomène

Dans la mélodie Lahra de dhati, la grammaire BP3 d'origine groupe les notes en
**sound-objects composés** — une cellule = un seul terminal dont le nom concatène plusieurs
notes. La traduction `.bps` actuelle les a **aplaties** en notes séparées.

**BP3 natif** (`-gr.dhati:168`) :
```
Lahra --> do5_do5do5 do5_do5do5 si4_si4do5 la4_la4si4 lab4_lab4_ la4_si4mi5 do5_si4do5 la4_lab4la4
```
→ **8 cellules composées**, chacune UN terminal, chacune ~2000 unités de durée.

**`.bps` actuel** (`test/grammars/dhati/scene.bps`, sous-grammaire 7) :
```
Lahra -> do5 _ do5 do5 do5 _ do5 do5 si4 _ si4 do5 la4 _ la4 si4 ...
```
→ **~23 notes plates** séparées par des espaces, chacune UN terminal distinct.

## L'effet mesuré (A≡B, niveau BPx-AST)

| Côté | Ce que produit BPx | Compte |
|------|--------------------|--------|
| A (`.gr→BPx`) | `do5_do5do5@0-2000` — 1 token composé par cellule | 8 |
| B (`.bps→BPx`) | `do5@0-1000 do5@1000-1500 do5@1500-2000` — 3 tokens par cellule | ~23 |

C'est la principale divergence de dhati (24/32). Le modèle BP3 traite la cellule comme UN
sound-object nommé (le nom encode le rythme interne) ; BPScript émet chaque note.

## La question pour Romain

**BPScript doit-il représenter un sound-object composé** — un terminal unique agrégeant
plusieurs événements-notes (`do5` tenu + `do5` + `do5`), rendu comme UN objet — **distinct
d'une subdivision de période** (plusieurs terminaux en fragments égaux) ?

Aujourd'hui BPScript n'a que la note plate ; il ne peut pas exprimer « cette cellule EST un
seul objet mélismatique ». Deux directions :

### Option 1 — Introduire une graphie de sound-object composé (fidélité BP3)
Une notation qui **colle** des notes en un seul terminal, rendu comme un événement.
Ex. de graphies possibles (à discuter) :
- guillemets/quote : `"do5 _ do5 do5"` = un terminal composé ;
- opérateur de jonction dédié.
→ A≡B convergerait ; BPScript couvre le répertoire tabla/Lahra fidèlement.
→ Coût : un nouveau concept dans le langage (résolution, rendu, alphabet).

### Option 2 — Assumer la note plate (BPScript plus fin que BP3)
On acte que BPScript modélise chaque note comme un événement propre ; le regroupement
composé de BP3 est une particularité de rendu qu'on ne réplique pas.
→ Pas de nouveau concept ; dhati (et Lahra similaires) restent divergents « par modèle »,
documentés comme non-convergents volontaires (pas un bug).
→ Coût : renoncer à la fidélité 1:1 sur ce répertoire.

## Note de méthode
La cause « BOLSIZE » (alias tronqués) de dhati est déjà résolue (commit ba3cccc). Ce dossier
ne concerne QUE le regroupement composé de la Lahra. La cause « contexte négatif » (dhati2/3
16/12, résidu ti/M) est un bug d'émission parser séparé (route bpscript, en cours).
