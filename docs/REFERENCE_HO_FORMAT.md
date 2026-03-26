# Format des fichiers -ho. (Homomorphism / Alphabet)

> Analyse basee sur les 38 fichiers -ho. de bp3-engine/test-data/
> et le code source CompileGrammar.c (ReadAlphabet, GetHomomorph, GetBols).

---

## Vue d'ensemble

Le fichier `-ho.` est le **fichier alphabet complet** de BP2/BP3. Malgre son
nom ("homomorphism"), il contient bien plus que des homomorphismes :

1. **Declarations d'alphabet** — les terminaux disponibles pour la grammaire
2. **Tables d'homomorphismes** — transformations 1:1 nommees entre terminaux
3. **Terminaux speciaux** — `sync`, `cycle1`, `cycle2`
4. **Sections embarquees** — `TIMEPATTERNS:`, references `-mi.`, `-or.`

C'est l'equivalent d'un fichier `-al.` (alphabet simple) enrichi. Le moteur
charge les deux formats dans `TEH[wAlphabet]` et les compile via `ReadAlphabet()`.

---

## Structure du fichier

```
[header optionnel]
[reference -mi.xxx]
[reference -or.xxx]

[homomorphisme par defaut ou terminaux]
[section homomorphisme 1]
-----
[section homomorphisme 2]
-----
...

[section TIMEPATTERNS:]
```

---

## 1. Header (optionnel)

Deux formats observes :

### Format BP2.8+ (commentaires `//`)
```
// Bol Processor version BP2.8.0
// Alphabet file saved as '-ho.abc'. Date: Lun 30 Mars 1998 -- 17:34
```
Ignore par le compilateur (lignes `//` sautees).

### Format BP2.5 (legacy)
```
V.2.5
Date: Sun, May 21, 1995 -- 10:18
```
**Problematique** : `Date:` contient `:` qui fait crasher `GetBols()` dans
CompileGrammar.c v3.3.16. Contourne en WASM par strip des lignes `V.x.x`
et `Date:` avant chargement.

11 fichiers sur 38 utilisent ce format.

---

## 2. References fichiers

Lignes en debut de fichier qui referencent d'autres fichiers :

```
-mi.abc        ← prototypes MIDI des sound objects (durees, canaux, velocites)
-or.allpianos  ← fichier orchestra MIDI
```

Le compilateur les detecte via `FilePrefix[iObjects]` et les skippe pendant
la lecture de l'alphabet. Le moteur natif les utilise pour charger les fichiers
referencees. En WASM, il faut les provisionner via `bp3_provision_file()`.

**Fichiers -mi. observes** : abc, abc1, abc2, dhati, EkDoTin, Frenchnotes,
makePrototypes, MyFile, Sargam, preroll, tryCsound, etc.

---

## 3. Declarations d'alphabet (terminaux nus)

Terminaux listes sans `-->` — ils existent dans l'alphabet mais ne sont
pas transformes par l'homomorphisme courant.

```
*
chik          ← terminal nu, pas de mapping
a --> a'      ← terminal avec mapping
e             ← terminal nu
cycle1        ← terminal special
sync          ← terminal special
```

Chaque terminal declare ici recoit un index interne (`Jbol++`) et peut
etre utilise dans les regles de grammaire.

---

## 4. Homomorphismes

### Label

Chaque homomorphisme commence par un **label** sur une ligne seule :

```
*              ← homomorphisme par defaut (index 0)
TR             ← "transposition"
OCT            ← "octaviation"
TRANS          ← "transposition chromatique"
H              ← generique
m1, m2         ← noms libres (Ruwet)
mineur         ← nom libre (Ruwet)
```

Le `*` est le label par defaut. Les autres sont des noms arbitraires
definis par le compositeur.

### Regles de mapping

Chaque regle definit un remplacement pour un terminal :

**Mapping simple** (1:1) :
```
a --> a'       ← appliquer l'homomorphisme sur 'a' donne 'a'
dha --> ta     ← appliquer l'homomorphisme sur 'dha' donne 'ta'
```

**Chaine ordonnee** (1:1 par pas) :
```
C3 --> C4 --> C5 --> C6 --> C7
```
Signifie : appliquer l'homomorphisme 1 fois sur C3 donne C4.
Appliquer 2 fois donne C5. Appliquer -1 fois donne... le precedent
dans la chaine (si circulaire) ou rien.

Utilise principalement pour :

- **OCT** (octaviation) : `C3 --> C4 --> C5 --> C6 --> C7`
  Chaque application monte d'une octave.

- **TRANS** (transposition chromatique) :
  `C1 --> C#1 --> D1 --> D#1 --> E1 --> F1 --> ... --> B7 --> C1`
  Chaque application monte d'un demi-ton. La chaine boucle (C1 a la fin).

- **Homomorphismes generiques** :
  `a --> a' --> a"` signifie 3 niveaux de transformation.

### Separateur de sections

```
-----          ← 5+ tirets separent les homomorphismes
```

Exemple complet avec 3 homomorphismes :
```
*
a --> a'
b --> b'
-----------
TR
a --> b
b --> c
sync
```

`sync` apres les regles dans une section signifie que `sync` est un
terminal connu mais non transforme par cet homomorphisme.

---

## 5. Terminaux speciaux

### `sync`

Point de synchronisation dans les expressions polymetriques. Quand le
moteur rencontre `sync` pendant la production, il synchronise les
differentes voix de la polymetrie.

Declare dans l'alphabet (soit comme terminal nu, soit en fin de section
homomorphisme).

### `cycle1`, `cycle2`

Marqueurs de rebouclage pour les patterns cycliques. Definissent les
points de depart et fin d'une boucle dans la sequence temporelle.

---

## 6. Section TIMEPATTERNS:

Embarquee en fin de fichier, definit des patterns temporels (equivalent
d'un fichier `-tb.` inline) :

```
TIMEPATTERNS:
t1 = 1/1  t2 = 3/2   t3 = 4/3
t4 = 1/2
```

Chaque pattern est un ratio qui definit une duree relative. Utilise
avec le mode `_smooth` (temps non metrique).

2 fichiers sur 38 contiennent cette section.

---

## 7. Application dans les grammaires

Les homomorphismes sont references dans les regles de grammaire via
les operateurs de pattern `(=X)` et `(:X)` :

```
gram#1[1] S --> (=OCT) A B C      ← appliquer OCT aux terminaux
gram#1[2] S --> (:TR) A B C       ← appliquer TR aux terminaux
```

L'operateur specifie quel homomorphisme (par son label) est applique
aux terminaux du pattern pendant la derivation.

---

## Inventaire des 38 fichiers -ho. par type

### Alphabet simple (terminaux nus, pas de `-->`)
- `-ho.abcd` : a b c d e f
- `-ho.keys` : k1..k127 (128 touches MIDI)
- `-ho.makePrototypes` : object1, object2

### Alphabet + homomorphisme par defaut (`*`)
- `-ho.abc`, `-ho.abc1`, `-ho.abc2`, `-ho.abc3` : a→a', b→b', ...
- `-ho.dhati`, `-ho.dhadhatite` : tabla (dha→ta, ti→ti, ...)
- `-ho.tabla` : tabla (variante)
- `-ho.kathak` : kathak
- `-ho.tryhomomorphism` : mixte (notes + bols)

### Homomorphismes multiples (avec separateurs `-----`)
- `-ho.Ruwet` : m1, m2, mineur (3 transformations musicales)
- `-ho.checkhomo` : *, H, TR (test)
- `-ho.abc`, `-ho.abc3` : *, TR

### Octaviation (OCT)
- `-ho.Englishnotes`, `-ho.Frenchnotes`, `-ho.Indiannotes`, `-ho.Mozartnotes`
- `-ho.engine` : OCT + TRANS

### Transposition (TR / TRANS)
- `-ho.transposition` : TR (C3→B3→F4→C6)
- `-ho.engine` : TRANS (chaine chromatique complete C1→...→B7→C1)

### Avec TIMEPATTERNS:
- `-ho.tryQuantize`, `-ho.tryTimePatterns`

---

## Resume des elements

| Element | Role | Exemple |
|---------|------|---------|
| `//` commentaire | Header ignore | `// Bol Processor...` |
| `V.x.x` | Version legacy (problematique) | `V.2.5` |
| `Date:` | Date legacy (problematique) | `Date: Sun, May 21, 1995` |
| `-mi.xxx` | Reference prototypes MIDI | `-mi.abc` |
| `-or.xxx` | Reference orchestra | `-or.allpianos` |
| `*` | Label homomorphisme par defaut | `*` |
| `TR`, `OCT`, etc. | Label homomorphisme nomme | `TR` |
| `a --> b` | Mapping simple | `dha --> ta` |
| `a --> b --> c` | Chaine ordonnee | `C3 --> C4 --> C5` |
| `a` (nu) | Terminal sans mapping | `chik` |
| `sync` | Synchronisation polymetrique | `sync` |
| `cycle1` | Marqueur de boucle | `cycle1` |
| `-----` | Separateur d'homomorphismes | `-----` |
| `TIMEPATTERNS:` | Patterns temporels inline | `t1 = 1/1` |
