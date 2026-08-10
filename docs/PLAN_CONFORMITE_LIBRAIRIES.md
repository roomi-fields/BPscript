# Plan de mise en conformité — BPScript et les librairies

Cinq règles de Romain (2026-08-10) tiennent le sujet. Ce document dit l'écart mesuré pour chacune,
et l'ordre dans lequel il se ferme.

## Les cinq règles

1. Tous les mots acceptés par le parseur viennent des librairies invoquées dans la scène.
2. `core` est un point d'entrée qui instancie des valeurs par défaut et appelle des librairies de base.
3. Tous les contrôles acceptés, avec leurs portées, sont définis dans les librairies uniquement.
4. Une librairie n'a qu'un seul destinataire, spécifié dans la librairie.
5. Aucun contrôle codé en dur dans le parseur, quel qu'il soit.

## L'écart, mesuré le 2026-08-10

| règle | état | pièce |
| --- | --- | --- |
| 1 | **écart** | le vocabulaire de tête se construit depuis `core.schema` seul, une fois, avant le chargement — `src/transpiler/libs.js:381` |
| 2 | **tenu** | `core.apporte` vaut `["controls"]` et le code le lit — `libs.js:485-494`, prouvé dans les deux sens par le comportement |
| 3 | **partiel** | les contrôles de flux et de règle portent leurs portées ; `lib/engine.json` et `lib/time.json` n'en portent aucune |
| 4 | **partiel** | 15 librairies sur 22 déclarent leur domaine ; 7 n'en déclarent aucun, dont les deux créées le 2026-08-10 |
| 5 | **écart** | une trentaine de noms cités en dur dans `src/transpiler/parser.js`, plus une liste figée dans `constants.js:39` |

La règle 5 est la racine des autres : tant que le parseur nomme des mots lui-même, déplacer une clé
d'une librairie à l'autre ne change rien pour lui, et la cascade ne peut pas être l'autorité.

## L'ordre, et pourquoi il est celui-là

**Étape 1 — les librairies portent ce qu'il faut lire.** Un destinataire par librairie nommant
l'outil, en remplacement de `domain` et `runtime` qui sortent dans le même mouvement ; les portées
sur chaque contrôle ; une clé dans une seule librairie. *Confiée à un agent, en cours.*

**Étape 2 — la résolution suit la cascade.** Le vocabulaire de tête se construit depuis toutes les
librairies chargées — socle, apportées, invoquées — et non depuis le socle seul. Deux porteuses du
même nom : refus qui nomme les deux candidates. Une résolution par ordre d'interrogation serait une
résolution par accident.

*Cette étape ne peut pas passer avant la première* : agréger aujourd'hui donnerait quinze noms
ambigus, et quatre procédures de dérivation deviendraient écrivables en tête de scène.

**Étape 3 — le parseur cesse de nommer les mots.** Chaque nom cité en dur est remplacé par une
lecture de librairie, ou disparaît. La liste figée des directives de production sort.

*Le témoin de cette étape est un garde*, pas une relecture : aucun nom de contrôle ni de directive
n'apparaît en littéral dans le parseur, hors les mots de structure du langage.

**Étape 4 — les librairies qui manquent naissent.** `transpo`, `expression`, `midi`, `audio`, plus
le cas `transcription` à trancher par mesure. Chaque clé quitte son ancien domicile dans le même
mouvement. `module` et `patch` restent gelées avec le patching.

## Ce que chaque étape doit prouver

Un portillon vert ne prouve rien. Chaque étape se prouve **par le refus** :

- une clé déplacée qui répond encore depuis son ancien domicile n'a pas déménagé ;
- un nom retiré du parseur qui résout encore n'a pas été retiré ;
- deux librairies portant le même nom doivent faire échouer la compilation, nommément.

## Les frontières à préavis

`domain` et `runtime` sont lus hors d'ici. Leur retrait se préavise aux lecteurs de la surface —
`docs/CONSOMMATEURS.md` porte la liste et les trois informations qu'un préavis doit contenir, plus
la quatrième que BPx a demandée : ce que devient l'objet dans l'arbre quand une forme change de
famille.
