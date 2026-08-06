# Dériver le parseur d'un formalisme — phase 0, la mesure de départ

**Romain, 2026-08-06.** *« Je veux que tu m'écrives un nouveau parseur à zéro qui utilise
uniquement des formalismes qu'on maintient du langage. Et je veux aussi que les erreurs soient
systématiquement remontées : tout ce qui n'est pas spécifié dans le langage est en erreur. »*

Ce document porte **ce qui a été mesuré**, pas ce qui est proposé. Il sert à dimensionner la
décision d'outil (phase 1) et à donner un point de comparaison à la phase 2.

## Ce qui existe aujourd'hui

| | mesure |
|---|---|
| parseur écrit à la main | **7 836 lignes** — `parser.js` 5 552 · `bpxAst.js` 1 834 · `tokenizer.js` 450 |
| `public/editor/bpscript.grammar` | **72 lignes, 24 règles** — et son en-tête dit son objet : *« tokenizer plat pour la coloration syntaxique, l'analyse complète est faite par le transpileur »* |
| `docs/spec/EBNF.md` | **116 productions**, notation ISO 14977, tenue à la main |
| corpus | **274 scènes, 0 refusée** |
| filet de sécurité | **86 gardes, 2 922 assertions** |

## La surface réelle du langage

Le parseur produit **56 natures de nœud**. Ce n'est pas une estimation : c'est le compte des
`type` distincts rencontrés en parcourant l'arbre des 274 scènes.

**Le cœur est étroit.** Les vingt natures les plus produites couvrent l'essentiel du corpus :

```
21924 Symbol        1311 Rest             532 Subgrammar
 5739 Polymetric    1176 Prolongation     286 ActorDirective
 4120 Rule          1054 InstantControl   274 Scene
 2628 SettingBag     888 ActorReference   228 TransportRef
 2020 NumericDuration 836 Directive       225 Qualifier
 1727 NumericTerminal 697 TieStart        180 TempoOp
```

**La queue est longue et rare** : 15 natures paraissent moins de dix fois dans tout le corpus —
groupe simultané, point d'attente, ancre de gabarit, objet hors-temps, câblage, macro.

⚠️ **Cette forme — un cœur étroit, une queue longue — est ce qui rend la phase 2 possible.**
Couvrir les vingt premières natures suffit à faire passer la quasi-totalité du corpus ; la queue
se traite ensuite, une famille à la fois, avec le corpus vert à chaque pas.

## L'écart à trois, mesuré

Sur les 56 natures que le parseur produit :

| | natures |
|---|---|
| nommées dans **les deux** formalismes | **2** |
| dans `EBNF.md` seulement | **30** |
| dans `bpscript.grammar` seulement | **2** |
| dans **aucun des deux** | **22** |

⚠️ **Vingt-deux natures produites ne sont nommées nulle part.** Parmi elles : la sortie d'un
acteur, la référence d'entité, le groupe simultané, le terminal numérique, le contrôle instantané,
l'opérateur de tempo, le câblage, la macro, l'instance de signal.

⚠️ **Et seulement deux natures sur cinquante-six sont connues des deux formalismes à la fois.**
Ce n'est pas un défaut d'entretien, c'est la conséquence directe de leur nature : `EBNF.md` décrit
la forme ÉCRITE, `bpscript.grammar` colore des jetons, et ni l'un ni l'autre n'a jamais eu pour
mission de décrire l'ARBRE. Personne n'a dérivé : les trois artefacts ont été écrits séparément.

## Ce que la mesure établit pour la suite

1. **Il n'y a pas de formalisme à « mettre à jour ».** `bpscript.grammar` ne décrit pas le
   langage — le remettre à niveau reviendrait à l'écrire. C'est une création, pas une reprise.
2. **`EBNF.md` est le seul texte qui décrive la forme du langage**, et il couvre 30 des 56
   natures. C'est le meilleur point de départ existant, à condition de le traiter comme une
   source à traduire, pas comme la référence exécutable.
3. **La dimension du travail est celle des vingt natures du cœur**, pas des cinquante-six.

## Faisabilité outillage — vérifié, pas supposé

Le registre de paquets est joignable et **Langium est disponible** (4.3.1 au 2026-08-06). C'est
celui des candidats qui tire d'**une seule grammaire** à la fois l'analyseur et les **types de
l'arbre** — donc les deux premiers formalismes du plan en un seul fichier maintenu.

⚠️ **`@lezer/generator`, déjà installé ici, est le mauvais outil pour cet usage** — et il faut le
dire avant que sa présence ne le désigne par défaut. Il est conçu pour les éditeurs : tolérant aux
fautes par construction, il fabrique des nœuds d'erreur au lieu de refuser. C'est l'inverse exact
de l'exigence « tout ce qui n'est pas spécifié est en erreur ». Il reste le bon outil pour la
coloration, et `bpscript.grammar` garde ce rôle.

## Ce que la phase 0 ne dit pas

- **Quel outil choisir** — c'est la phase 1, et c'est une décision de Romain.
- **Si l'arbre engendré coïncidera avec l'arbre actuel** — c'est la phase 2, et elle se mesure
  scène par scène sur les 274.
- **Le coût des diagnostics.** Les outils donnent la gestion d'erreur des compilateurs standards :
  position, jetons attendus, reprise. Ce qu'ils ne donnent pas, c'est le message qui nomme la
  relève d'une forme retirée — celui-là vient d'un catalogue à tenir, quel que soit l'outil.


---

# Phase 2 — la maquette, et ce qu'elle a mesuré

**Faite le 2026-08-06** avec Langium 4.3.1, sur un fragment choisi par la phase 0 : les six natures
les plus produites (règle, symbole, bloc polymétrique, silence, prolongation, nombre).
Fichiers : `maquette/parseur-derive/` — une grammaire de **60 lignes**.

## Ce qui marche, et il faut le dire d'abord

**La chaîne complète tient.** Une grammaire → un analyseur → un arbre typé → une coloration, en
une commande et 283 ms. Les cinq formes du fragment sont acceptées, et l'arbre produit se lit :

```
regle : S ->
    SymbolRef        "C4"
    Polymetric       "A B | C"
    Rest             "-"
```

**Les types de l'arbre sont ENGENDRÉS** depuis la même grammaire. C'est le point qui compte pour
le chantier : les deux premiers formalismes du plan n'en font qu'un seul à maintenir.

## Trois contraintes mesurées, qu'aucune description ne donnait

**1. `Symbol` est un nom interdit.** L'outil refuse les noms réservés du runtime JavaScript. Le
nœud le plus produit du langage — 21 924 occurrences — ne peut pas garder son nom. L'arbre engendré
ne portera donc pas partout les noms actuels : c'est une **action de frontière** pour les huit
dépôts qui lisent l'arbre, à planifier, pas à découvrir.

**2. LA FIN DE LIGNE FAIT PARTIE DE LA GRAMMAIRE.** Avec l'espace entièrement caché — le réglage
naturel — deux règles qui se suivent **se fondent en une** : le membre droit de la première avale
la tête de la seconde, puis la flèche échoue. Le retour à la ligne n'est pas de la mise en page
dans ce langage, il **termine une règle**. Une fois déclaré, les cinq formes passent.
⚠️ Cette contrainte ne se voyait dans aucun des trois documents. Elle s'est vue à la première
exécution.

**3. ⚠️ LES MESSAGES D'ERREUR PAR DÉFAUT NE VALENT RIEN — et c'est moi qui avais sur-affirmé.**
J'avais écrit à Romain que ces outils donnent « la gestion d'erreur des compilateurs standards :
position, jetons attendus, reprise ». Mesuré sur trois fautes évidentes :

```
"S -> "        ligne 1, colonne 1 — Expecting: expecting at least one iteration which starts with…
"S C4 D4"      ligne 1, colonne 1 — (le même)
"S -> {A B, C" ligne 1, colonne 1 — (le même)
```

**La position est fausse** (toujours 1,1) et **le texte est le même pour trois fautes différentes**.
Ce n'est pas « standard mais générique » : c'est inutilisable tel quel. La gestion d'erreur
demandée par Romain — « tout ce qui n'est pas spécifié est en erreur, et je veux des erreurs
explicites » — **ne vient pas gratuitement avec l'outil**. Elle est à construire, et son coût
n'était pas dans mon plan.

## Ce que la maquette change au plan

- **La phase 1 n'est plus un choix d'outil sur description** : il faut mesurer les diagnostics de
  chaque candidat sur les mêmes trois fautes. C'est le critère qui départage, pas la génération
  d'arbre — que tous savent faire.
- **Le troisième formalisme monte en importance.** Le catalogue de diagnostics n'est pas un
  complément : c'est la moitié du travail.
- **Le renommage des nœuds est une frontière**, à annoncer avant d'écrire.
