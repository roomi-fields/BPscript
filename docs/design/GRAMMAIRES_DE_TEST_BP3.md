# Dossier — les grammaires de TEST des features BP3 : par grammaire ou par CLASSE ?

**Pour arbitrage : Romain.** Rédigé 2026-07-19 par bpscript, à la demande de l'architecte (note [677]).
**Statut : question ouverte.** Rien n'est implémenté, aucune syntaxe n'est proposée comme acquise.

> **Suite de `PORTEUR_VERBATIM.md`**, clos par la décision « métagrammaires hors périmètre »
> (2026-07-18). En instruisant la fixture suivante, `trytemplates`, deux gaps sont apparus — dont
> **un identique** à celui qui vient d'être tranché, mais dans une grammaire qui **n'est pas** une
> métagrammaire. D'où la question de cadrage ci-dessous.

---

## POURQUOI — une CLASSE semble se dessiner

`gramgene1`, `gramgene2` (déjà exclues) et `trytemplates` ne sont pas des pièces musicales : ce sont
des **grammaires de test des features du moteur BP3**. Elles exercent la *métaprogrammation* — produire
du texte de grammaire, des gabarits, des opérateurs bruts — plutôt que la musique.

Le corpus les distingue d'ailleurs : `trytemplates` produit une section `TEMPLATES:` (des gabarits),
pas des notes. Aucune n'a de sortie musicale.

**La question de cadrage** : « hors périmètre » est-il un appel **par grammaire** (on tranche
`trytemplates` séparément) ou **par CLASSE** (les grammaires de test de métaprogrammation sortent en
bloc, et la question ne se repose plus à chaque fixture) ?

---

## QUOI — les deux gaps de `trytemplates`, prouvés à la source

### Gap (a) — le ratio NU `N/M` en séquence

Le natif **distingue délibérément deux formes dans la MÊME sous-grammaire** :

```
gram#2[4] Y <-> A _tempo(2) A        ← le contrôle explicite
gram#2[5] Y <-> A 5/3 A              ← le ratio NU
```

Ce ne sont donc pas deux graphies d'une même chose — la grammaire les emploie côte à côte.

Vérifié au compilateur, BPScript n'a **aucune surface** pour le ratio nu complet :

| Écrit | Émis | Verdict |
|---|---|---|
| `A A[/2]` | `A /2 A` | ✅ le raccourci `/N` a bien une émission **nue** (`EBNF.md:576`) |
| `A[tempo:5/3] A` | `A _tempo(5/3) A` | ✅ mais c'est le **contrôle**, pas le nu |
| `A[5/3] A` | *rejeté* : `Expected IDENT, got INT (5)` | ❌ aucune surface |

`EBNF.md:794` ne documente que les opérateurs `/N \N *N` — la forme `N/M` complète n'y figure pas.
**Seul le numérateur 1 est exprimable nu.**

*(Note de méthode : j'avais d'abord cru à un écart de PLACEMENT — le natif écrit `A /2 A`, ma première
tentative rendait `/2 A A`. C'était une erreur de lecture : `A A[/2]` donne exactement le natif,
l'opérateur se colle au symbole qu'il qualifie. Pas un gap.)*

### Gap (b) — le littéral textuel, hors métagrammaire

```
gram#4[1] ) Laststuff <-> ) 'AlongStory.'
gram#4[2] #) Laststuff <-> #) 'AshortStory.'
```

**Exactement le gap tranché le 2026-07-18** (le porteur verbatim n'accepte que des identifiants,
`'AlongStory.'` porte un point). Mais `trytemplates` **n'est pas une métagrammaire** : elle ne produit
pas de texte de grammaire, elle produit des gabarits. La décision, qui vise nommément les
métagrammaires, **ne la couvre donc pas** — et je ne l'étends pas de moi-même.

---

## COMMENT — trois options par gap

Elles se combinent : on peut trancher (a) et (b) différemment.

### Pour (a), le ratio nu

| Option | Coût | Ouvre | Casse / risque |
|---|---|---|---|
| **surface dédiée** — admettre `[N/M]` en émission nue, à côté de `[/N]` | faible : le mécanisme d'émission nue existe déjà pour `/N`, c'est son domaine de valeurs qui s'élargit | la fidélité au natif sur toute grammaire employant un ratio nu | aucune rétrocompat en jeu (`[5/3]` est rejeté aujourd'hui) ; mais deux formes proches à distinguer en lecture (`[5/3]` nu vs `[tempo:5/3]` contrôle) |
| **hors périmètre** | nul | rien | ❌ **écarté par la mesure** : le ratio nu est employé par des grammaires MUSICALES (voir ci-dessous). L'exclure exclurait des pièces, pas des tests |
| **autre** (à ouvrir) | — | — | — |

### Pour (b), le littéral textuel

| Option | Coût | Ouvre | Casse / risque |
|---|---|---|---|
| **surface dédiée** | le plus élevé : un mot de plus dans un langage qui en revendique peu — c'est précisément ce qui a été refusé le 2026-07-18 | le cas général | rouvrirait une question tranchée il y a un jour |
| **hors périmètre** (par classe) | nul | rien | cohérent avec la décision existante, et **clôt la question pour toute la classe** au lieu de la reposer à chaque fixture |
| **autre** (à ouvrir) | — | — | — |

---

## Ce que je ne tranche pas

Trois remarques factuelles, sans recommandation :

1. **Le gap (b) est le même qu'hier.** Si la réponse d'hier tenait pour les métagrammaires, la même
   raison (sobriété du langage, besoin étroit, aucune sortie musicale) semble tenir ici — mais c'est un
   raisonnement par analogie, et l'analogie n'est pas une décision.
2. **Le gap (a) n'appartient PAS à la classe — vérifié sur le corpus, et c'est le point qui tranche.**
   J'avais écrit qu'il « faudrait vérifier » ; je l'ai fait plutôt que de laisser la réserve en
   suspens. Le ratio nu apparaît dans **15 grammaires natives**, et les plus parlantes sont
   franchement musicales :

   ```
   polyphony1    <1> S --> ij{ijk,ab 5/3 cd}lm        ← ratio nu DANS un groupe polymétrique
   Visser.Waves  Frase1 1 Frase1 Frase2 1/2 {…} 1/4 {…}  ← truffée de 1, 2, 1/2, 1/4 nus
   ```

   Également : `checkrests` (7/4), `checktemplates` (3/2), `tryRagas` (11/10, 12/10),
   `Mozartexpression` (96/100…), `trySerial` (5/4, 2/3), `tryKeyMap`, `tryRotate`, `livecode2`,
   `Watch_What_Happens`, `Visser.Shapes`, `trytemplates2`.
   *(Écarté : `ShapesInRhythm`, dont les `88/60` sont des affectations de variable `t1 = 88/60`,
   un autre construct.)*

   **Conséquence** : « hors périmètre » est un mauvais choix pour (a) — il exclurait des pièces
   musicales, pas des grammaires de test. Le gap (a) ne se range donc PAS dans la classe, quelle que
   soit la réponse donnée à la classe elle-même.

   Deux remarques qui vont dans le même sens : `Visser.Waves` emploie aussi des **entiers nus**
   (`Frase1 1 Frase1`), donc le construct est plus large que la fraction ; et `visser-waves`,
   `visser-shapes`, `tryRagas`, `trySerial` **sont déjà dans mon corpus Voie B et déjà en DIFF** —
   ce gap explique peut-être une part de leur divergence, ce que je n'ai pas encore vérifié.
3. **Un arbitrage par CLASSE économise les prochains tours.** Il reste 4 fixtures à instruire
   (`trySerial`, `dhadhatite`, `watch`, `Mozartexpression`) ; si d'autres appartiennent à cette classe,
   une règle générale évite de rouvrir le dossier à chaque fois.

---

## DÉTERMINATION SÉMANTIQUE DU RATIO NU (2026-07-19, demandée par Romain)

**Question posée** : `A 5/3 A` a-t-il un sens musical, comme les silences `2 3 4` ? Et que fait-il
par rapport à `_tempo(2)` ?

**Réponse : OUI, et les deux sont des objets DIFFÉRENTS — c'est déjà spécifié et vérifié au moteur.**

| Forme | Sémantique | Source |
|---|---|---|
| `/N` (nu) | tempo **ABSOLU + persistant** (`fixtempo`) — impose la durée de référence du champ, persiste jusqu'au prochain opérateur ou la fin du champ | `EBNF.md:657` ; `Polymetric.c:1061,1709` posent `fixtempo = TRUE` |
| `_tempo(p/q)` | tempo **RELATIF** — `speed = oldspeed × p`, `scaling = oldscaling × q`, avec entrée/sortie de bracket | `EBNF.md:659` ; `Polymetric.c:1244-1245` |

Ce ne sont donc pas deux graphies d'une même chose : l'un **impose**, l'autre **multiplie l'hérité**.
C'est pourquoi `trytemplates` les emploie côte à côte (`gram#2[4]` vs `[5]`). Et l'usage relevé dans
15 grammaires — `1`, `2`, `1/2`, `1/4`, `5/3` posés en séquence — est bien celui d'une **durée de
champ**, l'analogie que Romain faisait avec les silences.

### CE QUI EXISTE DÉJÀ — et que j'ai failli proposer d'inventer

**`[/N/M]` est déjà spécifié ET implémenté.** `EBNF.md:655` donne
`tempo_op = ( "/" | "*" ) , ( INT | FLOAT | INT , "/" , INT )` — l'opérande fractionnaire y est.
Vérifié au compilateur : `A A[/5/3]` compile et émet `A /5/3 A`.

C'est le **cinquième** faux problème de cette série (après les gabarits, l'étiquetage, le placement
du tempo, le porteur verbatim). J'allais proposer une surface qui existe.

### LE GAP RÉEL, ce qu'il reste

Le natif écrit **`A 5/3 A` — sans barre de tête**, là où ma surface produit `/5/3`. Ce sont deux
écritures différentes dans la même grammaire native :

```
gram#2[3] Y <-> A /2 A       ← opérateur, avec barre
gram#2[5] Y <-> A 5/3 A      ← ratio NU, sans barre
```

Le gap n'est donc **pas** « exprimer un tempo fractionnaire » (fait), mais « exprimer la forme
SANS opérateur ». Reste à établir si le BP3 leur donne deux sens distincts ou si `5/3` est un
raccourci de `/5/3` — **je ne l'ai pas prouvé** et je ne propose pas de surface avant de l'avoir
fait. Proposer sur une équivalence supposée serait exactement l'erreur que les cinq faux problèmes
précédents m'ont apprise.
