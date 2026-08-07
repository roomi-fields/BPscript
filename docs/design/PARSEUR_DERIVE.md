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

**3. Les messages d'erreur — ⚠️ MA PREMIÈRE CONCLUSION ÉTAIT FAUSSE, DEUX FOIS. Voir plus bas.**
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


---

# Phase 2 bis — je m'étais trompé sur les diagnostics, deux fois

**Mesuré une heure après la première conclusion**, sur les mêmes trois fautes.

J'avais écrit : *« les messages d'erreur par défaut ne valent rien, c'est inutilisable tel quel,
l'exigence de Romain ne vient pas avec l'outil »*. C'était faux pour **deux raisons distinctes**,
et aucune des deux n'était l'outil.

## Première erreur : j'ai mesuré les réglages par défaut sans chercher le point d'accroche

L'outil expose `LangiumParserErrorMessageProvider`, fait pour être remplacé. Un **catalogue de
diagnostics** de vingt lignes — le troisième formalisme du plan, en miniature — suffit à traduire
« ce que la grammaire attendait » en « ce que l'auteur doit écrire ».

⚠️ **Condamner un outil sur ses défauts sans chercher ses réglages, c'est mesurer sa configuration
et croire mesurer ses capacités.** Je l'avais écrit à Romain comme un fait.

## Seconde erreur, et c'est la plus instructive : le coupable était MA GRAMMAIRE

Même avec le catalogue branché, les trois fautes rendaient encore le **même message** à la **même
position « ligne 1, colonne 1 »**. La cause n'était pas dans la traduction des messages : elle
était dans la **forme de la grammaire**.

J'avais écrit une répétition englobante au sommet — `rules+=Rule+` dans un `Subgrammar`, lui-même
répété dans la scène. **Une itération au sommet avale l'échec de ce qu'elle répète** : toute faute,
même à la ligne 40, remonte au premier caractère du fichier. Les règles rendues **filles directes
de la scène**, chacune échoue à sa place.

## Le résultat, sur les mêmes trois fautes

```
"S -> "         ligne 1, colonne  6 — il en faut au moins un — attendu : {, -, _, NUMBER, ID
"S C4 D4"       ligne 1, colonne  3 — aucune écriture connue ne commence ainsi — attendu : ->, <-, <>
"S -> {A B, C"  ligne 1, colonne 13 — attendu : }
```

Trois fautes, trois positions, trois messages, avec les jetons attendus. **C'est la gestion
d'erreur des compilateurs standards**, et elle est atteinte.

## Ce que ça change au plan — dans le bon sens

- **L'exigence de Romain est tenable** : « tout ce qui n'est pas spécifié est en erreur », avec des
  erreurs explicites. Rien dans la mesure ne s'y oppose.
- **Le catalogue reste nécessaire** — mais c'est vingt lignes plus une entrée par forme retirée,
  pas la moitié du travail que j'annonçais.
- ⚠️ **Et une exigence nouvelle, qu'aucun document ne portait : la QUALITÉ DES DIAGNOSTICS EST UNE
  PROPRIÉTÉ DE LA GRAMMAIRE.** Une grammaire mal découpée rend des erreurs inutilisables sans que
  rien ne le signale. Ce sera à garder : un garde qui vérifie qu'une faute est rapportée À SA
  PLACE, sur un jeu de fautes témoins.

## Vitesse — mesurée, et ce n'est pas un critère

274 scènes, 417 Ko : **1,13 ms par scène** pour l'analyseur engendré, **2,94 ms** pour le parseur
actuel (qui fait en plus la résolution et le scellement). Les 283 ms cités plus haut sont le temps
d'ENGENDRER l'analyseur — une étape de construction, faite une fois. La confusion était dans ma
rédaction.


---

# Phase 3 — la grammaire couvre 60 % du corpus, mesuré pas à pas

**2026-08-06, en fin de session.** Cinq passes successives, chacune guidée par le **motif de refus
le plus fréquent**, jamais par ce que je croyais manquer.

| passe | ce qu'elle a ajouté | acceptées |
|---|---|---|
| fragment initial | six natures du cœur | **0 / 274** |
| 1 | déclaratif, gardes, sacs, instantané, backticks, durée collée | **89** |
| 2 | sac en fin de règle · tête à plusieurs symboles · directive en crochets | **132** |
| 3 | valeur multi-parties · décrément · joker numéroté · procédure en crochets | **145** |
| 4 | K-paramètre · crochets multiples · composant numéroté | **147** |
| 5 | apostrophe interne · sac de voix · joker en tête · directive de ligne | **163** |
| 6 | instantané en crochets · groupe de gabarit | **164** |
| 7 | contexte négatif groupé · appel de code libre | **167** |
| 8 | liaison en tête (`~G#5`) · argument pointé de directive | **174** |
| 9 | point d'attente · membre droit vide · joker après contexte | **180** |
| 10 | directive avec sac · étoile d'homomorphisme · contexte joker | **188** |
| 11 | le bloc traverse les lignes | **191** |

| 12 | clé d'acteur arobasée · directive à paires · contexte sur silence | **194** |
| 13 | joker à sac · prolongation en tête de règle · objet composé | **199** |
| 14 | guillemet et tiret-chiffre dans un nom | **201** |

| 15 | argument à signe égal · objet composé (deux graphies) | **205** |
| 16 | silence à sac · **tête de règle composée** | **208** |

| 17 | **le fichier peut ne pas finir par un saut de ligne** | **213** |
| 18 | sacs multiples collés · crochet après un bloc | **219** |
| 19 | crochet collé à un terminal · tiret entre deux mots | **221** |
| 20 | argument de directive en backtick | **225** |

| 21 | type de variable suivi d'une liste de paires (`flag: a:1, b:2`) | **230** |

| 22 | **durée collée à un bloc de code** · catalogue de gabarits | **260** |
| 23 | sac sur argument de directive · groupes d'une forme de gabarit | **265** |
| 24 | **sujet d'un réglage** (`*:cutoff:env1`) · coupure de câblage | **268** |
| 25 | code en valeur de branchement · coupure en tête de directive | **270** |

**270 sur 270 — la totalité du corpus**, une fois écartées les quatre scènes que la décision du
2026-08-06 rend incompatibles. Grammaire : **220 lignes**, contre 7 836 lignes de parseur écrit à
la main.

⚠️ Le dénominateur est passé de 274 à **271** : les trois scènes que la décision du 2026-08-06
rend incompatibles sortent de la mesure. Les compter serait prendre un refus VOULU pour un manque
de la grammaire.

## Ce que la montée a appris sur le langage lui-même

Chaque passe a révélé une propriété que **ni la bible ni la grammaire ne portaient** :

- **la fin de ligne termine une règle** — sans quoi deux règles se fondent en une ;
- **l'apostrophe vit à l'intérieur d'un nom** (`A'8`, `F'24`), pas seulement à la fin ;
- **une voix polymétrique porte son propre sac** — `{C5 E5 (vel:100), E4 (vel:70)}` ;
- **une valeur a plusieurs parties séparées par l'espace** — la virgule sépare les éléments du sac,
  l'espace les parties d'une valeur ;
- **un crochet peut porter plusieurs mutations** — `[Ideas=20, Notes=32]`.

⚠️ **C'est le bénéfice qu'on n'attendait pas.** Écrire la grammaire ne fait pas que produire un
analyseur : elle **oblige à dire** ce que le parseur fait sans l'avoir écrit nulle part. Chacune de
ces cinq propriétés était vraie depuis toujours, appliquée par 7 836 lignes de code, et absente des
trois documents.

## Ce qui reste — la queue longue, et elle est nommée

Les 110 scènes restantes butent sur des constructions rares, chacune sur deux à quatre scènes :
entrées du catalogue de gabarits (`[1] /1 ???????`), contexte négatif groupé (`#(?1 ?3 ?2)`),
appel de code libre (`script(wait for do#2 channel 1)`), objet sonore composé (`|`), guillemet
dans un nom. Aucune n'est un obstacle de principe ; ce sont des lignes de grammaire à écrire.

## Ce que cette phase établit pour la décision

1. **La méthode tient sur le langage réel**, pas seulement sur un fragment jouet.
2. **La montée est régulière et guidée par la mesure** — pas d'effet falaise.
3. **Le coût est celui de la queue**, pas du cœur : 60 % en six passes courtes, les 40 % restants
   demanderont plus de passes pour moins de scènes chacune.


## La contrainte la plus profonde, trouvée à la onzième passe

**La fin de ligne termine une RÈGLE, mais pas un BLOC.**

```
S -> {
  !(chan:1, vel:120) C8 - - -,
  !(chan:1, vel:120) - C7 C7 C7
}
```

Trois scènes du corpus écrivent une voix par ligne. À l'intérieur des accolades, le retour à la
ligne **redevient de la mise en page** — c'est la seule place du langage où ce signe change de
sens, et il a fallu le dire à la grammaire pour que ces scènes passent.

⚠️ **C'est le genre de règle qu'un parseur écrit à la main applique sans que personne l'écrive.**
Elle n'est dans aucun des trois documents. La grammaire, elle, ne laisse pas le choix : ou on la
déclare, ou les scènes tombent.

## Où en est la queue

Les 83 scènes restantes butent sur des formes rares et souvent anciennes : accolades réellement
déséquilibrées d'une règle à l'autre, catalogue de gabarits (`[1] /1 ???????`), objet sonore
composé (`|`), guillemet dans un nom, contexte négatif sur un silence (`#-`). Chacune concerne une
à trois scènes.

⚠️ **Une seule est un vrai problème de conception** : l'accolade qui s'ouvre dans une règle et se
ferme dans une AUTRE. Le parseur actuel la résout par une seconde passe ; une grammaire, par
construction, ne le peut pas. C'est le point à trancher avant la phase 4, et il est structurel —
pas une ligne de grammaire à écrire.


## Ce que la montée a encore appris — un nom porte plus que des lettres

Passe 14, la plus instructive du lot. Un identifiant du langage peut contenir :

| signe | ce qu'il marque | exemple |
|---|---|---|
| `'` et `"` | le registre | `A'8`, `B"8` |
| `#` | l'altération | `G#5` |
| `-` suivi d'un chiffre | une variante | `Tr-11`, `A'6-2` |

⚠️ **Aucun des trois documents ne le disait.** Le tokenizer écrit à la main l'applique depuis
toujours ; il a fallu qu'une grammaire refuse deux familles de scènes pour que ça se voie.

⚠️ Et c'est un **conflit lexical** à garder en tête pour la suite : `#` est à la fois un caractère
de nom et l'opérateur de contexte négatif ; `-` est à la fois un caractère de nom et le silence.
Le parseur actuel tranche par le contexte ; une grammaire doit le dire explicitement, et c'est
elle qui a rendu le conflit visible.


## Passe 16 — une tête de règle n'est pas un nom

La dernière passe a fait tomber une idée que je portais sans l'avoir vérifiée : que le membre
gauche d'une règle soit un **identifiant**. Mesuré sur le corpus, il peut être :

- un **objet sonore composé** — `|a4| -> |x| |z31|`
- un **gabarit** — `$ V1 #tr <> $ ti #tr`
- une **prolongation** ou un **silence** — `re5_r _ G ->`, `#- V1 <>`
- un **joker**, seul ou groupé — `#? ?1 -> #? ?1`, `#(?1 ?3 ?2 ?4) …`

⚠️ **Une tête de règle est un MOTIF à reconnaître dans la dérivation, pas un nom.** C'est ce qui
distingue ce langage d'une grammaire ordinaire, et aucun des trois documents ne le formulait.

⚠️ **Et une régression que je me suis infligée dans la même session** : en resserrant la liste des
arguments d'une directive, j'ai interdit sans le voir les arguments séparés par une ESPACE — une
scène est tombée. Le compte l'a dit tout de suite (201 → 201, avec un motif nouveau). Sans mesure
à chaque pas, une passe qui « ajoute » peut retirer en silence.


## Passe 17 — la faute la plus bête, et la plus coûteuse

**Cinquante-neuf scènes tombaient parce que leur fichier ne finit pas par un saut de ligne.**

Ma règle exigeait `NL+` pour terminer une règle ; la dernière ligne d'un fichier n'en a pas. Un
quart du corpus refusé, et le message ne disait rien du langage — seulement que ma grammaire était
trop stricte.

⚠️ **C'est la leçon la plus utile de la série** : un motif de refus qui touche beaucoup de scènes
n'est PAS le signe d'une lacune profonde. Ici, un caractère. Le réflexe de chercher grand devant un
grand nombre est exactement ce qui fait perdre du temps — j'ai d'abord soupçonné les commentaires
de tête, puis les directives, avant de mesurer le dernier caractère du fichier.

⚠️ **Et j'ai vérifié que la relâche ne rouvrait pas la faille précédente** : un témoin dédié
confirme que deux règles sur deux lignes font toujours DEUX règles, pas une. Relâcher une
contrainte sans re-tester celle qu'elle protégeait est le meilleur moyen de payer deux fois.


## Passe 21 — le gain est venu avec une ambiguïté, et je ne l'ai pas gardée

La première rédaction de cette passe faisait passer 5 scènes de plus **et** faisait apparaître un
avertissement : `Ambiguous Alternatives Detected`. J'offrais deux chemins — « une liste de paires
OU une valeur » — et les deux commencent par un identifiant.

⚠️ **Une grammaire ambiguë analyse de travers en silence : c'est pire qu'un refus.** L'outil
arbitre alors selon l'ordre d'écriture, ce qui n'est pas une décision de langage mais un accident
de rédaction.

Réécrit en **une seule voie** — une paire dont la valeur est facultative couvre les deux cas — le
gain est conservé et l'ambiguïté disparaît au lieu d'être arbitrée au hasard.

⚠️ **À retenir pour la phase 4** : le nombre de scènes acceptées n'est pas le seul critère de
qualité d'une grammaire. Une passe peut faire monter le compte **et** dégrader la grammaire. Le
compte ne le dit pas ; l'outil, lui, le dit — encore faut-il lire ce qu'il écrit avant de se
réjouir du chiffre.


## Le chantier atteint la totalité du corpus

**270 scènes sur 270.** Les quatre écartées relèvent toutes de la même décision de Romain — une
accolade, ou une parenthèse, qui s'ouvre dans une règle et se ferme dans une autre.

⚠️ **La dernière, `dhin`, n'a été identifiée qu'à la mesure** : sa ligne 83 écrit `) B12 <> ) A4 B8`
— une **parenthèse** en tête de règle. Même famille que l'accolade, forme différente. Sans la
mesure, elle serait restée comptée comme une lacune de la grammaire.

## La passe 22 — trente scènes d'un coup, pour une durée

`` `…` :18 `` — un bloc de code porte sa durée, collée à l'accent grave fermant. Trente scènes
Csound tombaient là-dessus. C'est, avec le saut de ligne final, le second cas où **un motif de
refus massif tenait à un détail d'écriture**, pas à une lacune de conception.

## Ce que le chantier a établi, au total

| | |
|---|---|
| couverture | **0 → 270 / 270** |
| grammaire | **220 lignes** |
| parseur écrit à la main | **7 836 lignes** |
| passes | **25**, chacune guidée par le motif de refus le plus fréquent |
| ambiguïtés introduites puis levées | **2**, dont aucune conservée |

**La méthode est prouvée sur le langage entier.** Ce qui reste pour la phase 4 n'est plus la
reconnaissance — c'est la construction de l'arbre, les diagnostics, et la frontière avec les huit
dépôts qui lisent l'arbre.


---

# Phase 3 bis — l'arbre est construit, et l'écart dit ce qui n'est PAS de la syntaxe

**2026-08-07.** La maquette ne faisait que reconnaître. Elle **produit** désormais un arbre, et
`maquette/parseur-derive/arbre.mjs` le compare à celui du parseur de production, sur 270 scènes.

| nature | engendré | production | écart |
|---|---|---|---|
| `Rule` | 3 953 | 3 953 | **=** |
| `Rest` | 1 254 | 1 257 | **=** |
| `Scene` | 270 | 270 | **=** |
| `InstantControl` | 989 | 975 | +1 % |
| `SettingBag` | 2 500 | 2 455 | +2 % |
| `Symbol` | 18 653 | 21 180 | −12 % |
| `Polymetric` | 5 027 | 5 699 | −12 % |
| `Prolongation` | 1 011 | 1 176 | −14 % |
| `Wildcard` | 303 | 498 | −39 % |
| `NumericDuration` | 696 | 2 013 | −65 % |
| `NumericTerminal` | 3 010 | 1 692 | +78 % |
| `ActorReference` | 84 | 878 | −90 % |
| `ActorDirective` | 70 | 282 | −75 % |
| `Guard` | 236 | 130 | +82 % |
| `BacktickStandalone` | 65 | 7 | +829 % |

**Cinq natures sur seize à moins de 5 % d'écart** — dont `Rule`, au nombre exact.

## ⚠️ Ce que l'écart mesure vraiment : la part SÉMANTIQUE de l'arbre

Aucune de ces divergences n'est un défaut d'analyse. Chacune nomme un endroit où l'arbre de
production **contient ce que le texte ne dit pas** :

- **`ActorDirective` −75 %, `ActorReference` −90 %** — la production fabrique un **acteur
  synthétique** pour toute scène qui n'en déclare aucun, avec ses quatre références par défaut. Le
  texte n'en porte pas un mot.
- **`NumericDuration` −65 % contre `NumericTerminal` +78 %** — la production **désucre** la durée
  collée en cadre polymétrique, et distingue durée et terminal selon la position. Ma grammaire ne
  voit que des nombres.
- **`Symbol` −12 %, `Polymetric` −12 %** — même cause : le désucrage crée des nœuds.
- **`BacktickStandalone` +829 %** — la production distingue le code **isolé** du code **attaché à
  une voix** ; ma table les confond. C'est une erreur de ma table, pas de la grammaire.

**Conclusion, et elle dimensionne toute la suite** : la reconnaissance est faite, mais **l'arbre de
production est pour une part notable un produit de la RÉSOLUTION**, pas de la lecture. Un parseur
engendré donnera l'ossature ; l'acteur implicite, le désucrage, la distinction terminal/durée
resteront du code — pilotés par le schéma d'arbre, mais du code.

⚠️ **Et la mesure est de PREMIER ORDRE** : même distribution ne veut pas dire même arbre.
L'imbrication n'est pas comparée. Une nature au compte exact peut être placée ailleurs.


---

# L'architecture est tranchée — Romain, 2026-08-07

La comparaison des deux arbres a fait apparaître deux endroits où l'analyseur actuel **ne lit pas,
mais complète et réécrit**. Romain a tranché : **les deux sont voulus, et ils restent.**

| ce que fait l'analyseur actuel | ce qu'en dit Romain |
|---|---|
| **inventer un acteur** quand la scène n'en déclare aucun, avec ses défauts | *« j'ai dit plusieurs fois qu'il fallait le faire »* |
| **transformer `A:1/2` en `{1/2, A}`** avant de rendre l'arbre | *« c'est ma demande, car BPx ne sait pas interpréter ça »* |

**Verdict : *« ok pour avoir des points de code écrit qui continuent à gérer ça ».***

## Ce que ça fixe, et c'est structurant

**Le partage est net, et il ne bougera plus :**

- **la grammaire LIT** — elle reconnaît ce qui est écrit, et refuse le reste ;
- **du code COMPLÈTE et RÉÉCRIT** — l'acteur implicite, le désucrage de la durée, et tout ce qui
  fait qu'un arbre porte davantage que son texte.

⚠️ **Ce partage n'était écrit nulle part avant cette mesure.** Je pensais qu'un formalisme
remplacerait le parseur ; il en remplacera **l'ossature**, et le reste restera du code — mais du
code dont on sait désormais POURQUOI il existe, ce qui n'était pas le cas ce matin.

⚠️ **Et une conséquence pour la phase 4** : la comparaison d'arbres ne se fera jamais entre l'arbre
engendré NU et l'arbre de production. Elle se fera **après la passe de complétion**. Comparer
avant, c'est mesurer un écart voulu et le prendre pour un défaut — l'erreur que j'ai failli
commettre en présentant ces pourcentages comme des divergences.


---

# La passe de complétion — l'arbitrage de Romain, mis en œuvre et mesuré

**2026-08-07.** Les deux complétions que Romain a confirmées sont désormais appliquées à l'arbre
engendré avant comparaison : l'**acteur implicite** et le **désucrage de la durée collée**.

**Résultat immédiat, sur 270 scènes :**

| nature | avant complétion | après |
|---|---|---|
| `ActorDirective` | −75 % | **= (282 contre 282)** |
| `Polymetric` | −12 % | **= (5 723 contre 5 699)** |
| `ActorReference` | −90 % | +6 % |

**Sept natures sur quinze coïncident à moins de 5 %**, contre cinq avant.

⚠️ **La complétion doit REPRODUIRE la règle, pas l'approcher.** Ma première version créait un bloc
pour **toute** durée ; or seule la durée **collée** en crée un — une fraction posée seule dans le
flux (`A 1/2 B`) est un silence, elle n'emballe rien. Le compte est passé de +35 % à l'égalité
quand j'ai distingué les deux.

⚠️ **Et deux écarts venaient de MA TABLE, pas du langage** — comptés d'abord comme des divergences
réelles : une fraction est une **durée**, pas un terminal ; et le bloc de code ne porte pas en
production la nature que je lui prêtais. Le second fabriquait un écart de +999 %.

## Ce qui reste à expliquer

Quatre écarts n'ont pas encore de cause établie : les symboles (−12 %), les prolongations (−14 %),
les jokers (−39 %), les directives (+54 %) et les gardes (+82 %). ⚠️ **Je ne les explique pas, et
je ne les range pas** — les trois causes trouvées jusqu'ici étaient toutes soit une complétion
voulue, soit une erreur de mon instrument. Il serait commode de supposer la même chose ici ; ce
serait supposer, pas mesurer.
