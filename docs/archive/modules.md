# Les modules — section retiree de LANGUAGE.md

**Sortie du langage le 2026-08-23**, avec `lib/mod.json` et la graphie `module.X`.
Decision de Romain : *« on sort `mod` et la section correspondante est sortie/archivee.
Idem pour `module.X` »* — `hub/decisions/2026-08-23-mod-sort-avec-les-modules-et-la-graphie-module-point.md`.

**Ce document ne fait autorite sur rien.** La reference du langage est `../spec/LANGUAGE.md`,
et elle seule. Il est garde parce que celui qui rouvrira le sujet voudra lire comment il etait
pense — c'est le geste employe pour `CV.md`.

Les trois entrees du catalogue etaient `adsr`, `lfo` et `ramp`. `adsr env1` compilait ; le lecteur
qui reconnaissait une instance de module a ete retire de `parser.js` dans le meme mouvement.

---

### Les modules

Un **module** est une fonction : une ou plusieurs **entrees**, du code, une ou plusieurs
**sorties**. C'est un module eurorack ecrit en code. Les modules vivent dans une librairie et
s'invoquent comme tout le reste.

```text
module.saw
module.lpf
module.adsr
```

**Un seul signal, des conventions de lecture.** Un signal est un flux de nombres, et la convention
dit **comment le recepteur le lit** -- une hauteur se transpose, une phase s'enroule, un etat
logique se seuille. La convention s'applique a la reception.

**`signal` est le cas ordinaire** -- un flux de nombres que le recepteur lit tel quel.

**Chaque port est type.** Un port porte la **convention** selon laquelle son contenu se lit :
`signal`, `pitch`, `phase` ou `logic`. Le type d'un port dit ce que son contenu signifie, et le
compilateur le verifie.

**Le point nomme un port** sur l'instance qui le porte :

```text
lpf1.cutoff
env1.attack
```

Un module est un **prototype** : il se declare une fois et s'instancie autant de fois qu'une piece en
a besoin, chaque instance portant ses propres valeurs de port.

**La librairie declare le TYPE, la scene declare l'INSTANCE, et c'est l'instance qu'on invoque.**
Un filtre passe-bas nomme `lpf` en librairie s'instancie avant de servir : la scene ecrit

```text
lpf lpf1
```

et c'est `lpf1` qui se regle. **Une instance est une variable** : son comportement vient
de son type. Deux filtres dans une piece
sont deux instances nommees, chacune avec ses valeurs de port.

#### Le prototype d'un module

**Les noms de champs sont en anglais** -- c'est du code. La prose qui les decrit reste en francais.

```json
{
  "name": "",
  "category": "",
  "description": "",
  "ports": {},
  "code": ""
}
```

**Trois sous-prototypes** couvrent les formes possibles, selon ce que le module recoit et rend.

| sous-prototype  | ce qu'il a                     |
| --------------- | ------------------------------ |
| **`source`**    | des sorties seulement          |
| **`processor`** | des entrées **et** des sorties |
| **`sink`**      | des entrées seulement          |

Un oscillateur, du bruit, un LFO sont des **sources**. Un filtre, un amplificateur, une enveloppe
sont des **traitements**. La sortie `out` est un **puits**.

**Le puits d'une chaine s'ecrit `out`.** Il designe la sortie de l'acteur, dont le canal --
`audio`, `midi`, `osc` ou `dmx` -- est celui que l'acteur declare.

**Le sous-prototype est structurel, la catégorie est descriptive.** Le premier dit ce que le module
peut recevoir et rendre ; la seconde le range et le rend trouvable. Un LFO et un oscillateur ont
deux catégories et la même forme.

| champ                               | ce qu'il porte                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `name` · `category` · `description` | identité, famille, prose d'aide                                                                                                |
| `ports`                             | les ports du module, par leur nom                                                                                              |
| `code`                              | le traitement                                                                                                                  |

#### Le prototype d'un port

```json
{
  "direction": "in",
  "convention": "signal",
  "voices": 1,
  "range": null,
  "unit": null,
  "description": ""
}
```

**Une entrée ajoute `default`** — la valeur qu'elle prend quand la scène ne l'écrit pas. C'est le
champ que les librairies portent pour les paramètres d'un module : un paramètre et une entrée sont
la même chose.

| champ            | ce qu'il porte                                                                  |
| ---------------- | ------------------------------------------------------------------------------- |
| `direction`      | `in` ou `out`                                                                   |
| `convention`     | comment le contenu du port se lit : `signal`, `pitch`, `phase`, `logic`         |
| `voices`         | combien de **voix** ce port accepte — `1` pour une seule, `8` pour jusqu'à huit |
| `range` · `unit` | les bornes et l'unité du signal attendu                                         |
| `default`        | *(entrée seulement)* la valeur prise quand la scène ne l'écrit pas             |

**Les conventions.** `signal` est un flux de nombres que le récepteur lit tel quel — le cas
courant. `pitch` se lit comme une hauteur, en logarithmique : 1,0 vaut une octave. `phase` se lit comme une position dans un cycle entre 0 et 1 ;
ce qui dépasse s'enroule. `logic` se lit comme un état haut ou bas, dont ce sont les **transitions**
qui font événement.

**Un paramètre est une entrée** avec un `default`. Régler un module, c'est écrire la valeur d'une
de ses entrées.

**La polyphonie appartient au port** : un filtre traite huit voix tout en gardant une seule coupure.

**Ces prototypes vivent avec les autres.** Un module, un port, un terminal, un alphabet suivent le meme
mecanisme : un socle, et un champ qui n'existe que si sa notion s'applique. La ou les formes se
distinguent par ce qu'elles peuvent recevoir et rendre, des sous-prototypes **ajoutent** les champs
de leur cas ; la ou elles se distinguent par des axes independants, le socle les porte tous.

**Aucun ne porte le nom du composant qui le resout.** Le langage dit ce qu'une piece veut ; quel
composant le calcule est une affaire d'architecture, et le nommer ici ferait d'un changement
d'architecture un changement de langage. Ce qu'un objet porte, c'est sa **destination** -- le
runtime de sortie d'un terminal.
