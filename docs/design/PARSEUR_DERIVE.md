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
