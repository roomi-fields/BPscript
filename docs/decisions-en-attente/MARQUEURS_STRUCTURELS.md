# Dossier — les MARQUEURS STRUCTURELS de BP3 : BPScript en porte 1 sur 4

**Pour arbitrage : Romain.** Rédigé 2026-07-19 par bpscript, à la demande de l'architecte (note [724]).
**Statut : question ouverte.** Rien n'est implémenté.

> **Ce dossier remplace deux exclusions que j'avais mal motivées.** J'ai classé `trySerial` hors
> périmètre pour « terminal à deux-points » et présenté le blocage de `dhadhatite` comme un
> « marqueur de profondeur ». **Les deux causes étaient inventées.** La documentation du moteur
> nomme une feature ; je ne l'avais pas lue.

---

## POURQUOI — une feature documentée que notre surface porte au quart

`BP3_help.txt:97-99`, section **Structural markers** :

> « The glyphs `'+'`, `':'`, `';'`, and `'='` can be used in grammar rules as structural markers.
> See for instance `-gr.dhadhatite` using `'+'`. »

Quatre glyphes, opaques, utilisables dans les règles. **BPScript en accepte un.**

### CE QUE LES MARQUEURS FONT — lu dans le moteur, pas déduit

La documentation dit « structural markers » sans dire ce que ça signifie. Le code le dit :
`ProduceItems.c:1085-1130`, fonction `StructuralRule()`.

> « Rule is structural if some structure markers are found in its **argument**, yet **not** in its
> left or right context. » (`ProduceItems.c:1090`)

**Un marqueur ne « fait » rien à la musique. Il CLASSE la règle qui le contient.** Une règle qui
porte un marqueur dans sa partie droite (hors contextes gauche/droit) est déclarée *structurelle*.

À quoi sert ce classement : `LastStructuralSubgrammar()` (`ProduceItems.c:1064-1082`) balaie les
sous-grammaires et retient **le rang de la dernière qui contient au moins une règle structurelle**.
C'est la **frontière** entre les sous-grammaires qui construisent la STRUCTURE (et donc réclament
des gabarits) et celles qui réalisent les terminaux. Le moteur le dit lui-même quand la frontière
est vide (`ProduceItems.c:711`) : *« This grammar has no structural rules and does not require
templates »*.

### Les quatre glyphes ont-ils quatre sens ? NON — vérifié.

C'est le point qui manquait pour décider, et la réponse est nette. Dans le `switch` qui les
reconnaît (`ProduceItems.c:1120-1128`), les quatre cas **tombent sur le même `return(TRUE)`** :

```c
case 3:   // '+'
case 4:   // ':'
case 5:   // ';'
case 6:   // '='
case 25:  // '\'
    return(TRUE);
```

Aucun traitement différencié nulle part ailleurs : `+` est simplement **sauté** à l'affichage
(`DisplayArg.c:223`, `continue`) et à la mise en page (`DisplayThings.c:804`). Les glyphes sont
donc **interchangeables** : ce sont quatre graphies d'**une seule fonction** — « cette règle est
structurelle ». Le choix entre eux est une commodité de lisibilité pour l'auteur de la grammaire,
pas une différence de sens.

Deux conséquences pour l'arbitrage :

1. **La question n'est pas « quel sens donner à `:` et `=` »** — ils n'en ont pas de propre. Elle
   est : *faut-il porter les trois graphies manquantes, alors qu'une seule suffit à exprimer la
   fonction ?*
2. **Le marqueur est un marqueur de RÈGLE, pas un événement.** Il ne s'entend pas. C'est pourquoi
   l'émettre fidèlement compte : il change la **frontière des gabarits**, donc ce que le moteur
   produit — sans rien ajouter au flux sonore.

Deux éléments de plus dans la même fonction, qui n'apparaissent pas dans la doc : les
**parenthèses** (`T2`) et les **homomorphismes** (`T5`) rendent aussi une règle structurelle
(`ProduceItems.c:1104-1106`), tout comme `\` (case 25). La feature est donc plus large que les
quatre glyphes nommés — et nous portons déjà parenthèses et homomorphismes.

| Glyphe | BPScript                                     | Vérifié                                   |
| ------ | -------------------------------------------- | ----------------------------------------- |
| `+`    | **accepté** — en tête, en fin, collé, espacé | `S <> a + b` → `S <-> a + b`              |
| `:`    | rejeté                                       | `S <> He Says : a` → *ligne non reconnue* |
| `;`    | rejeté                                       | `S <> a ; b` → *Caractère inattendu ';'*  |
| `=`    | rejeté                                       | `S <> a = b` → *ligne non reconnue*       |

**Et le seul que nous portons ne passe pas entre accolades** — c'est le second manque, distinct :

```bpscript
${S1F S2F}       →  (= S1F S2F )     ✅ l'ancre de groupe fonctionne, et émet le natif
${S1F ++ S2F}    →  REJET : Expected RBRACE, got PLUS
{a + b, c}       →  REJET : Expected RBRACE, got PLUS
```

Le mécanisme d'ancre de groupe marche ; c'est le marqueur **à l'intérieur des accolades** qui est
refusé, par le parseur d'accolades et non par celui des marqueurs.

### Ce que ça bloque, concrètement

- **`trySerial`** — règle 1 : `S --> He Says: _rndseq {…}`. Bloquée sur le marqueur `:`.
- **`dhadhatite`** — 9 des 10 règles de `GRAM#2` s'écrivent `(=++ A1 V7 )`, une ancre de groupe
  contenant le marqueur. Bloquée sur le marqueur entre accolades.

`dhadhatite` est une pièce **musicale** (qaïda de tabla, bols) — contrairement aux métagrammaires
écartées le 2026-07-18, ce blocage-ci porte sur du répertoire, pas sur un test de méta-programmation.

---

## QUOI — la vraie difficulté n'est pas « accepter un glyphe »

**Deux des trois glyphes manquants sont déjà des opérateurs BPScript.** C'est là qu'est la question
de design, et elle est de désambiguïsation, pas d'ajout :

| Glyphe | Occupé par                                                            | Occurrences comme littéral dans `EBNF.md` |
| ------ | --------------------------------------------------------------------- | ----------------------------------------- |
| `:`    | **affecte une valeur** — `ch:3`, `cc:74`, `@duration:16b`, `kv_pair`… | **34**                                    |
| `=`    | mutation de drapeau `[X=N]`, `@alias X = …`, ancres `(= …)`           | 5                                         |
| `;`    | **rien**                                                              | **0**                                     |

**`;` est libre.** Il n'apparaît nulle part dans la grammaire BPScript — il n'est rejeté que par le
fail-loud du tokenizer ajouté cette nuit, qui ne le connaît pas. Son ajout serait mécanique.

`:` et `=` sont un autre sujet : les admettre comme marqueurs demande une règle qui les distingue
de leur emploi d'opérateur. La forme native `Says:` (collée à un identifiant) suggère qu'une règle
positionnelle est possible, mais **je ne la propose pas** — c'est précisément le genre de choix qui
se ratifie et ne s'invente pas.

---

## COMMENT — quatre options, combinables

| Option                                    | Ce qu'elle débloque | Coût / risque                                                               |
| ----------------------------------------- | ------------------- | --------------------------------------------------------------------------- |
| **(a) `;` seul**                          | rien aujourd'hui    | ~nul, mais gain nul aussi                                                   |
| **(b) marqueur entre accolades** (le `+`) | **`dhadhatite`**    | contenu du parseur d'accolades à étendre ; aucune ambiguïté nouvelle        |
|                                           |                     | — `+` n'est pas un opérateur en position de contenu                         |
| **(c) `:` et `=` comme marqueurs**        | **`trySerial`**     | demande la règle de désambiguïsation ; `:` est le glyphe le plus            |
|                                           |                     | chargé du langage (34 emplois)                                              |
| **(d) hors périmètre**                    | rien                | `trySerial` et `dhadhatite` restent sans fixture — mais `dhadhatite` est du |
|                                           |                     | répertoire musical, pas un test                                             |

---

## Ce que je ne tranche pas

Trois remarques factuelles, sans recommandation :

1. **(b) et (c) sont de natures très différentes.** (b) étend un parseur sur un glyphe que nous
   portons déjà et qui n'est pas ambigu là où il manque. (c) touche la règle d'or de la surface
   (`:` affecte une valeur) et mérite un vrai arbitrage.
2. **L'enjeu n'est pas symétrique.** (b) débloque une pièce musicale ; (c) débloque une grammaire de
   test des opérateurs sériels. Si la sobriété doit trancher, elle ne tranche pas pareil des deux
   côtés.
3. **Le redoublement `++` est CLOS — vérifié à la source.** J'avais laissé ce point ouvert : le
   natif écrit `++`, j'émets `+ +`. **Les deux sont équivalents**, et le moteur le prouve.
   `CompileGrammar.c:1244-1272` définit les caractères admis dans un nom de terminal —
   `OkBolChar` (premier caractère : lettres et `'`) et `OkBolChar2` (suivants : chiffres, lettres,
   `-`, `@`, `%`, `#`, `"`, `'`, backtick). **`+` n'y figure pas.** Il ne peut donc jamais
   appartenir à un nom : il est toujours tokenisé séparément, et l'espace entre deux `+` est sans
   effet. Mon émission est fidèle ; (b) suffit.

4. **La même lecture CONFIRME le cadrage de `trySerial`.** `:` n'est pas davantage dans
   `OkBolChar2`. Donc `Says:` ne peut PAS être un terminal nommé « Says: » — c'est nécessairement
   `Says` suivi du marqueur `:`. La cause que j'avais d'abord inventée (« terminal à caractère
   exotique ») est réfutée par le moteur lui-même, et le rattachement à la feature *Structural
   markers* est le bon.
