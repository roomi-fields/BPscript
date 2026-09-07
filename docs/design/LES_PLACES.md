# Les places du langage, et ce que chacune admet

Une **place** est une position où l'auteur écrit un nom. Ce document dit, pour chacune, **ce qui a
le droit d'y être écrit** — mesuré sur le compilateur, et confronté au moteur natif BP3.

> Ce document est une **proposition**. Les éléments de langage se définissent avec Romain ; ce qui
> est mesuré est marqué comme tel, ce qui attend une décision est nommé à la fin.

## 1. Il n'y a qu'une seule famille de places

Toute place d'usage est une **référence**. `S -> C4` écrit un nom qui doit résoudre vers un symbole ;
un garde de règle écrit un nom qui doit résoudre vers un drapeau ; `&x` écrit un nom qui doit
résoudre vers un gabarit ; `alphabet.western` écrit un nom qui doit résoudre vers une famille.

Il n'y a **jamais de valeur** écrite à une place — il y a toujours un nom, et le type dit vers
**quelle sorte de déclaration** il doit résoudre. Le socle sait déjà le faire : `flag` nomme une
chose qu'on déclare (`flag section:1`) et qu'on référence ailleurs (le garde d'une règle). `eval`,
`alphabet`, `destination` sont de la même nature.

⇒ Une place se déclare donc **par son type**, exactement comme un membre :
`def actor (alphabet alphabet, tuning tuning, destination out, eval eval)` — le type en tête, le nom
ensuite.

## 2. L'inventaire, mesuré

Le compilateur porte **vingt-trois** places : dix-sept d'usage, six de déclaration. Quatre des
dix-sept sont les mêmes places **rejouées** à une autre profondeur — trois dans une sous-grammaire,
une dans un `init` — et n'ajoutent aucune place propre. Restent **treize places d'usage distinctes**.

**Toutes les treize refusent un nom que rien ne déclare.** Le contrôle d'existence est acquis
partout ; ce qui manque à certaines est le contrôle de la **sorte**.

### Les huit places typées

Éprouvées en leur injectant neuf sortes de noms tous déclarés — un terminal, un drapeau, un rôle
d'entrée, un acteur, une définition, un évaluateur, un canal, une famille, et un inconnu. Ces huit
refusent les neuf sauf la leur :

| place | admet |
| --- | --- |
| garde de règle · mutation de drapeau | un drapeau |
| tag de backtick | un évaluateur |
| sortie d'acteur | un canal |
| axe d'invocation | une famille |
| entrée d'invocation | une entrée de *cette* famille |
| rejeu de gabarit `&` | un maître `$` de la **même règle** |
| valeur de départ d'un drapeau | un littéral, aucun nom |

### Les quatre places dont l'union n'est pas écrite

| place | admet aujourd'hui |
| --- | --- |
| terme du flux, à droite | terminal · définition · **drapeau** |
| corps d'un `def`, terme | terminal · définition · **drapeau** |
| point d'attente `<!`, le rôle | rôle d'entrée · **drapeau** · **acteur** |
| clé d'un sac | **drapeau** |

**Le drapeau est accepté à six places sur douze, dont quatre où il n'a rien à faire.** Ce n'est pas
quatre défauts : c'est un seul, à quatre endroits. La cause est une ligne — `nomsDeclares` verse tous
les noms de `vars` dans l'ensemble des déclarés **sans lire leur sorte**, alors que la sorte est dans
l'arbre (`varType.kind`). Le corpus en porte trois : `flag` (50), `type` (6), `convention` (3).

**Le moteur natif tranche cette fuite.** En BP3 un drapeau vit **entre barres obliques** —
`S --> X /Num_total = 20/`, `/Num_a > Num_b/ a --> b` — et il n'existe **aucune position** où un nom
de drapeau côtoie un terminal. La forme que le compilateur accepte n'a pas de contrepartie native.

### Une treizième place non mesurée

Le **membre imbriqué à l'usage** (`C4(w.a.b:1)`) : sa graphie saine n'est pas établie, donc son union
n'est pas mesurée.

## 3. Le point d'attente porte DEUX places

`<!<rôle>.<occurrence>` — et seul le rôle figurait à l'inventaire.

- Le **rôle** : `LANGUAGE.md` § « Une entrée nomme un RÔLE » écrit que le flux attend un trigger *de
  ce rôle*. L'union a un seul membre. Le compilateur en accepte quatre.
- L'**occurrence** : elle **n'est validée nulle part**. `resolution.js` le dit à sa place — « l'adresse
  ne se valide pas ici, et c'est un écart de spécification, pas un oubli ».

### Ce que le natif attend, relevé sur ses données livrées

BP3 n'a **aucune forme dédiée** à l'attente : il a une échappée générique, la primitive `_script`
posée dans le flux, dont l'argument est une ligne de script. « Wait for » est une ligne parmi
d'autres, à côté de `_script(MIDI program 43)` et `_script(Trace)`.

```
_script(Wait for space)             -da.SomeNotes · -gr.Rajeev
_script(Wait for g)                 -gr.checkVolChan
_script(Wait forever)               -da.tryWait
_script(Wait for do#3 channel 2)    -gr.Beatrix
_script(wait for E4 channel 1)      -da.Alan
_script(wait for Start)             -da.Beatrix
_script(wait for Continue)          -da.Alan
_script(wait for Stop)              -da.Beatrix
```

| ce qui suit `Wait for` | nature |
| --- | --- |
| `space`, `g` | une frappe de touche |
| `do#3 channel 2`, `E4 channel 1` | une note qualifiée d'un canal, dans **n'importe quelle convention** |
| `Start`, `Continue`, `Stop` | un message de transport MIDI |
| `forever` | ⛔ **ne passe pas** — décision de Romain, 2026-09-07 : « forever ne sert à rien chez nous » |

La casse est indifférente : `Wait` et `wait` coexistent dans les données livrées. Une note et son
canal se lisent dans la **convention active** — `do#3` et `E4` sont le même événement sous deux
conventions.

⇒ **Les trois membres retenus se dérivent tous du canal** du rôle : `destination midi (in:true,
out:true, params(ch:1))` déclare déjà ce qu'il reçoit. Le quatrième que le natif porte, `forever`,
est écarté — c'était le seul qui ne se dérivait d'aucun canal, et l'union n'a donc aucune exception.

## 4. Le refus se dérive du type, il ne se déclare pas

Un code de refus écrit à côté de la place ferait un registre de codes entretenu à côté du code qui
les lève, et les deux dérivent. `RESOLVE_<TYPE>_UNDECLARED` ne peut pas mentir.

**La place dit ce qu'elle admet, jamais où le chercher.** La portée se dérive — un `$x` se cherche
dans sa règle, un drapeau dans la scène, une famille dans le registre. Une place qui écrirait aussi
sa portée ferait deux mécanismes de résolution au lieu d'un.

## 5. Ce que le socle ne nomme pas encore

Le socle déclare quarante-quatre types. Trois places d'usage admettent une sorte qui n'en a pas :

| place | admet | type |
| --- | --- | --- |
| axe d'invocation | le mot d'une famille | manque |
| rejeu de gabarit `&` | un gabarit maître | manque |
| point d'attente, le rôle | un rôle d'entrée | manque — le pendant d'entrée de `destination` |

Le troisième n'est pas une notion neuve : la symétrie entrée/sortie est posée depuis le 2026-07-27,
et seul le côté sortie porte un nom.

⚠️ `def flag` et `symbol` déclarent aujourd'hui des membres **vides**. Tant qu'aucune propriété ne dit
quelles sortes ont droit au flux, fermer la fuite du drapeau reviendrait à écrire une liste de noms
en dur — ce que le compilateur ne fait pas.

## 6. Ce qui attend une décision

- Le **nom** des trois types ci-dessus.
- La graphie saine du **membre imbriqué à l'usage**, pour que sa place soit mesurable.

## Ce que ce document ne fait pas

Il ne définit aucun élément de langage et ne touche pas `docs/spec/LANGUAGE.md`. Les inventaires
viennent du compilateur et du moteur natif ; les tables des sections 2 et 3 sont des mesures, pas des
prescriptions.
