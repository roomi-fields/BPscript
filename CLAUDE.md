# BPScript — le langage et son transpileur

Je tiens la grammaire du langage, son transpileur et ses librairies. Voie unique de compilation :
`compileToBPxAST`.

L'AST est **agnostique du moteur** : sa taxonomie se dit par ce que la chose fait, jamais par le nom
d'un moteur.

## RTFM — base de connaissances indexée

Ce projet est indexé par RTFM (docs, code, specs, notes).

Pour toute **recherche exploratoire** — trouver quels fichiers, modules ou concepts concernent un
sujet — utiliser `rtfm_search` plutôt que Glob, find, ls ou un Grep large.

Il rend des chemins de fichiers et des métadonnées de contexte. Ensuite on continue normalement :
lire les fichiers, chercher les motifs exacts à l'intérieur, éditer.

## CodeGraph — graphe de code indexé

Ce dépôt est indexé par CodeGraph (`.codegraph/`). Pour **comprendre ou localiser du code** —
symboles, appelants et appelés, rayon d'impact d'un changement — utiliser
`codegraph explore "<question | symbole>"` **avant** grep, find ou lecture de fichiers.

RTFM répond au quoi et au où documentaire ; CodeGraph répond à la structure d'appel du code.

## Trouver l'autorité sur un sujet

1. La **carte d'autorités d'Atlas** (`atlas/carte-autorites/`) dit où vit l'autorité sur un sujet.
2. Le **fichier de référence** qu'elle désigne porte la règle.
3. **Demander à Atlas** quand l'information reste introuvable.

Une recherche qui ne trouve rien renseigne sur la recherche.

## Trancher un comportement : « comment ça fonctionne en BP3 natif ? »

Toute question de **comportement, de fonction ou de primitive** se tranche sur le **moteur natif
BP3**. On couvre **a minima ce que fait le natif**, sauf dérogation explicite de Romain.

## ⛔ Le langage se définit avec Romain, et par lui seul

`docs/spec/LANGUAGE.md` est la bible du langage — elle **est ce que le code doit dire**, et un écart
entre les deux est un défaut du code. `AST.md` et `EBNF.md` en sont des dérivés que tu dois faire correspondre.

- **Interdiction formelle d'écrire dans `LANGUAGE.md`** sans autorisation explicite de Romain pour le
  geste précis. Cela couvre l'ajout, le retrait, la réécriture, la correction d'une forme, et
  **l'ajout d'un socle à un exemple qui ne compile pas**.
- **Interdiction formelle de définir un élément de langage** sans son autorisation.
- Un arbitrage de Romain **sur** le langage autorise le changement, jamais l'écriture dans le fichier.

**À la place** : mesurer, remonter l'écart avec sa pièce — `fichier:ligne` du code et section nommée
de la bible — et attendre son mot. Un écart reste un **écart signalé**.

**Un exemple est une prescription.** Une forme retirée du langage revient dans la référence par
l'exemple qu'on répare, jamais par une décision.

## Vérifier une forme du langage

Toute forme sortante passe **au compilateur** avant livraison. Les ressources qui tranchent : le
tokenizer, le parser, l'EBNF, l'oracle, et la bible.

**Une négative sur le langage exige le code** : « ne fait pas », « seulement », « pas encore » se
prouvent sur le tokenizer, le parser et l'EBNF. **Ce qui n'est pas mesuré se dit tel quel.**

## Carte d'autorités — signaler toute modification

Toute modification d'un document de la carte d'autorités est **systématiquement signalée et reportée
à Romain**. Leur **mise en conformité est un objectif permanent**.

## ⛔ Aucune voie parallèle — on migre, ça casse, on répare

Remplacer X par Y = **supprimer X dans le même mouvement**. On migre, on regarde où ça casse, on
répare.

## Coder

- **Le code mort s'élague** dans le mouvement qui le rend mort. Une branche sans appelant vivant sort.
- **La librairie d'abord** : ce qui peut se déclarer ou se retrouver en librairie y vit.
- **Les commentaires sont utiles et proportionnés** : ils disent ce que le code ne montre pas.

## Écrire un document

- **Descriptif et factuel** : le document décrit **ce qui est**, dans son état d'aujourd'hui.
- **Affirmatif** : on décrit l'objet. La forme négative se réécrit en énoncé positif.
- **Sans justification narrative** : ni citation d'une personne, ni cause, ni date, ni renvoi à une
  décision, ni contraste avec une forme antérieure. Le pourquoi vit dans sa décision datée.

## Écrire un garde

- **Réparer l'espace où le défaut peut vivre**, jamais l'endroit où il s'est montré. Un balayage a
  une portée : écrire la portée **et son complément**.
- **Un garde s'écrit pour la construction**, jamais pour la forme signalée. Il énumère toutes les
  formes que le parser produit, dans **toutes** ses sections. Une matrice, pas une liste.
- **Injecter la faute dans l'accusé, puis dans le juge** — le rendre constant, aveugle, muet — et
  exiger que le garde rougisse.
- **Une empreinte compare tout**, en retirant seulement ce qui est prouvé hors sujet. Choisir les
  champs comparés revient à choisir ce qu'on ne verra pas.
- **Suspecter l'instrument avant le sujet** quand un chiffre surprend, et le vérifier **avant**
  d'envoyer la mesure.
- **Un garde hors du portillon est invisible** : il ne préviendra jamais.

## Franchir une frontière

- **Rendre une forme invalide casse les consommateurs en minutes** : passer leur corpus au
  compilateur **avant** de livrer, puis les prévenir avec la liste exacte des formes invalidées et la
  migration attendue, forme par forme.
- **Déclarer un mot confisque un nom**, et la casse est **muette** : une scène qui portait ce nom est
  tronquée sans un signe. Même condition de livraison qu'une forme invalidée. Le plus local gagne,
  l'ombrage s'annonce, et un mot rencontré hors de sa place est **refusé avec sa réécriture**.
- **Un artefact dérivé lu par un autre dépôt est une frontière.** Avant de committer un changement de
  scène ou de fixture : quel artefact devient faux ? Le régénérer dans le même commit, et **valider
  sur un lot**.
- **Écrire chez un autre : signer, prévenir, ne rien déclarer.** L'écriture est livrée quand son
  propriétaire l'a committée.

## Les signes de base

Repris de `docs/spec/LANGUAGE.md`, qui porte le vocabulaire complet et fait foi. **Toute forme absente
de ce tableau se lit là-bas**, jamais dans un résumé.

| signe | sens |
| --- | --- |
| espace | sépare deux termes ; leur **collage** les réunit en un seul |
| `.` | désigne un élément dans un espace de noms |
| `:` | lie un sujet à une valeur |
| `()` | réglages — le **domaine de la clé** adresse le destinataire |
| `[]` | ce qui appartient à la dérivation : drapeau qui la conditionne, rang de forme |
| `@` | ouvre une ligne de la partie déclarative |
| `->` | **production** : le membre gauche est réécrit en membre droit |
| `<-` | **analyse** : la séquence droite est réduite au symbole gauche |
| `<>` | **production et analyse** : la règle vaut dans les deux sens |
| `-` | silence — il occupe du temps |
| `_` | prolongation — elle étend l'événement précédent |
| `...` | repos indéterminé, de durée calculée par le moteur |
| `!` | simultanéité : ce qui suit partage l'instant d'attaque de ce qui précède |
| `<!` | point d'attente : la dérivation attend le trigger nommé après le signe |
| `?` | joker : un symbole quelconque |
| `$` | gabarit maître : capture un motif · `&` le rejoue |
| `` ` `` | code externe, exécuté par l'interpréteur que son tag nomme |
| `#` | contexte négatif · `#?` apparie la frontière de la chaîne |
| `//` | commentaire |

## Librairies — toute édition passe par le bundle

`src/transpiler/libs-data.js` est le bundle que **tous les consommateurs chargent** ; `lib/*.json` et
`lib/digital/*.ts` en sont les sources. Éditer une source et régénérer le bundle se font **dans le
même mouvement** — sinon le code lit l'ancienne valeur en silence.

## Changelogs moteur

Après toute modification dans `bp3-engine/csrc/` :

- `csrc/bp3/` → mettre à jour `bp3-engine/CHANGELOG_ENGINE.md`
- Nouveau défaut moteur → l'ajouter dans `hub/courrier/bernard.md`

## Sous-agents de développement

Un sous-agent de développement se lance **toujours** en `claude-sonnet-5`.

## Backlog

`BACKLOG.md` à la racine porte ma **dette interne** — défauts, remaniements, limites — avec un
identifiant court et un statut par entrée.

- Un item qui touche le **langage** remonte au **backlog central** du hub par `tour`, jamais dans le
  local.
- La vue globale se consulte avec `tour backlog`. **Aucun backlog parallèle ailleurs.**
- **Un item inscrit au backlog est traité** : le relister comme ouvert rouvre une question déjà
  tranchée.

## Tour de contrôle

Mon identité : `BP_AGENT=bpscript`. Elle ne persiste pas entre appels shell, donc chaque commande se
préfixe : `BP_AGENT=bpscript ~/dev/bp/hub/tour <commande>`.

1. **Au réveil, le courrier d'abord** : `tour inbox`, puis `TABLEAU.md` et mes contrats.
   `tour inbox --ack` une fois traité.
2. **Un livrable poussé se route aussitôt**, dans le même geste que le push : `tour send architecte`.
   Sans cela, personne ne sait qu'il faut le confronter, et le chantier se cale en silence.
3. **La dernière action avant de rendre la main est un courrier à l'architecte** : fini avec sa
   preuve, en cours avec le prochain pas, ou bloqué avec ce qu'il me faut. Un commit ne vaut pas
   rapport.
4. `tour send <dest>` porte une **demande** et réveille le destinataire ; `tour note <dest>` porte
   une **information**, lue à la prochaine levée. Le réveil appartient au démon : je dépose, je ne
   pingue personne.
5. **Un contrat partagé se propose avant d'être figé**, par `tour`. Le code interne au dépôt reste
   autonome.
6. **Prévenir un voisin** : une écriture qui touche une surface qu'il consomme se préavise, par celui
   qui écrit.
7. **Fin de session** : je mets à jour ma ligne du `TABLEAU.md`, ma fiche projet et ma colonne de
   `baseline-status.json`. **Le code fait foi** : un statut se vérifie sur pièces.