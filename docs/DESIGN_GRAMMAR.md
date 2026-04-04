# BPscript -> BP3 Grammar Mapping

## Principe

BPscript compile vers le format de grammaire BP3 (`-gr.`). Ce document decrit
comment les constructions BPscript se traduisent en instructions BP3.

> Voir [DESIGN_INTERFACES_BP3.md](DESIGN_INTERFACES_BP3.md) pour l'interface WASM complete.
> Voir [DESIGN_LANGUAGE.md](DESIGN_LANGUAGE.md) pour la specification du langage.

---

## Format de grammaire BP3

Structure du fichier :
```
MODE                           // ORD, RND, SUB1, LIN, TEM, POSLONG
gram#N[M] LHS --> RHS          // regles
-----                          // separateur de sous-grammaire
MODE
gram#N[M] LHS --> RHS
```

### Sous-grammaires et modes

Chaque bloc entre `-----` est une sous-grammaire avec son propre mode de derivation.

| Mode BPscript      | BP3     | Comportement                              |
| ------------------- | ------- | ----------------------------------------- |
| `[mode:ord]`        | `ORD`   | ordonne -- les regles s'appliquent en ordre |
| `[mode:random]`     | `RND`   | aleatoire parmi les regles applicables    |
| `[mode:sub1]`       | `SUB1`  | substitution (une seule application)      |
| `[mode:lin]`        | `LIN`   | lineaire                                  |
| `[mode:tem]`        | `TEM`   | template matching                         |
| `[mode:poslong]`    | `POSLONG` | position la plus longue                 |

Le compilateur regroupe les regles par non-terminal et mode, inserant `-----`
entre les blocs de modes differents.

### Directions

| BPscript | BP3     | Sens                     |
| -------- | ------- | ------------------------ |
| `->`     | `-->`   | production (gauche droite) |
| `<-`     | `<--`   | analyse (droite gauche)  |
| `<>`     | `<->`   | bidirectionnel           |

---

## Traduction des constructions

### Symboles terminaux -- alphabet plat

BP3 recoit des **noms opaques** prefixes `bol`. Il ne sait rien des frequences,
des acteurs, des transports.

```
Source BPscript :
  Sa Re Ga Pa

Alphabet plat :
  bolSa
  bolRe
  bolGa
  bolPa

Grammaire BP3 :
  gram#1[1] S --> bolSa bolRe bolGa bolPa
```

Les noms de notes standard (`C4`, `sa`, `re`) deviennent des silent sound objects
dans BP3 -- pas de NoteConvention, pas de MIDI.

### Polymetrie

Transmise telle quelle a BP3 :

```
// BPscript
S -> { melodie, rythme }

// BP3
gram#1[1] S --> {melodie, rythme}
```

### Speed sur un groupe

Le `[speed:N]` est traduit en ratio de tempo BP3 :

```
// BPscript
{C3, E3, G3, C4}[speed:2]

// BP3
{2, bolC3, bolE3, bolG3, bolC4}
```

### Operateurs temporels

Les operateurs `[/N]`, `[\N]`, `[*N]`, `[**N]` sont traduits en position prefixe BP3 :

```
// BPscript                  -> BP3
A[/2] B C                    -> /2 bolA bolB bolC
{A B C}[\3]                  -> \3 bolA bolB bolC
```

### Guards et flags

```
// BPscript                              -> BP3
[phase==1] S -> Sa Re Ga Pa             -> /phase=1/ gram#N[M] S --> bolSa bolRe bolGa bolPa
[Ideas-1] I -> R1 A R2                  -> /Ideas-1/ gram#N[M] I --> R1 A R2
S -> A B [count+1] C                    -> gram#N[M] S --> bolA bolB /count+1/ bolC
[phase==1] S -> Ga [phase=2] Re         -> /phase=1/ gram#N[M] S --> bolGa /phase=2/ bolRe
```

### Poids

```
// BPscript                              -> BP3
S -> A B C [weight:50]                   -> <50> gram#N[M] S --> bolA bolB bolC
```

### Controles runtime `()` -- _script(CTn)

Les parametres runtime sont compiles en tokens de controle opaques :

```
// BPscript                              -> BP3
Sa(vel:120)                              -> _script(CT0) bolSa
Bass -> C2 C2 - C2 (vel:100)            -> gram#N[M] Bass --> _script(CT1) bolC2 bolC2 - bolC2
{A B}(filter:lp)                         -> {_script(CT2_start) bolA bolB _script(CT2_end)}
```

Le transpileur emet une **controlTable** a cote de la grammaire :
```json
{
  "CT0": { "scope": "symbol", "params": { "vel": 120 } },
  "CT1": { "scope": "rule", "params": { "vel": 100 } },
  "CT2": { "scope": "group", "params": { "filter": "lp" } }
}
```

### Cascading des controles (spec < CT < CV)

Quand plusieurs sources definissent le meme parametre, l'ordre de priorite est :

1. **spec** (defauts de la librairie) -- plus basse
2. **CT** (controles inline `()`) -- surcharge la spec
3. **CV** (objets temporels continus) -- plus haute priorite

Le dispatcher applique ce cascading a chaque timed token.

### Silences et prolongation

Transmis directement :
```
// BPscript    -> BP3
-              -> -
_              -> _
...            -> ... (repos indetermine)
```

### Period notation

Transmise directement :
```
// BPscript                    -> BP3
S -> A B . C D . E F           -> gram#N[M] S --> bolA bolB . bolC bolD . bolE bolF
```

### Ties (liaisons)

`~` en BPscript -> `&` en BP3 :
```
// BPscript                    -> BP3
C4~ D4 E4 ~C4                 -> bolC4& bolD4 bolE4 &bolC4
```

### Captures

`?n` -> metavariables BP3 :
```
// BPscript                    -> BP3
?1 A ?1 -> ?1 B ?1             -> ?1 A ?1 --> ?1 B ?1
```

### Templates et transcriptions (homomorphismes)

`$` → `(=X)` et `&` → `(:X)`. Les noms de transcription entre master et slave
sont émis entre `(=X)` et `(:X)` dans la grammaire BP3.

```
// BPscript                              -> BP3
S <> $mel &mel                           -> S <-> (=mel) (:mel)
S -> $X tabla_stroke &X                  -> S --> (=X) tabla_stroke (:X)
S -> $X * &X                             -> S --> (=X) * (:X)
S -> $X * TR &X                          -> S --> (=X) * TR (:X)
Qaida <> $ {plus S64 fin}               -> Qaida <-> (= plus S64 fin)
```

**Étiquetage** : le fichier -ho. généré contient des étiquettes (`N@terminal`)
au lieu de vraies résolutions. BP3 applique `Image()` normalement et émet les
étiquettes dans les timed tokens. Le REPL résout les étiquettes post-dérivation.

> Voir [DESIGN_HOMOMORPHISM_LABELING.md](DESIGN_HOMOMORPHISM_LABELING.md) pour le mécanisme complet.

### Contextes

```
// BPscript                    -> BP3
(A B) C -> D E                 -> (A B) C --> D E
#(X Y) Z -> W                 -> #(X Y) Z --> W
```

### Homomorphismes

```
// BPscript                    -> BP3
|x| S x -> x S                -> |x| S x --> x S
```

### Out-time objects

`!symbole` standalone -> `<<symbole>>` :
```
// BPscript                    -> BP3
Y -> !f                        -> Y --> <<f>>
```

### Backticks

Les backticks orphelins et standalone sont encodes comme terminaux speciaux
dans la grammaire. Les backticks-parametres sont resolus via la controlTable.

---

## Meta-grammaires -- reecriture structurelle

BP3 est un systeme de reecriture de chaines -- `{`, `}`, `,` peuvent apparaitre
comme terminaux bruts. Le parser les traite comme des `RawBrace` quand ils ne
forment pas un polymetric balance dans la meme regle.

```
// BPscript: koto3 -- automate cellulaire avec meta-reecriture
#({) a b a -> {a c b, f f f - f}[speed:5]  // contexte negatif sur {
} -> }                                      // { et } comme terminaux
, -> ,                                      // , aussi
```

Deux usages distincts :
- **Embedding** : `{` et `}` distribues sur plusieurs regles, forment un polymetric
  valide apres derivation. `[speed:N]` sur `}` est propage au `{` correspondant.
- **Meta-grammaire** : `{`, `}`, `,` comme terminaux matchables sur le LHS et
  dans les contextes `#({)`. La grammaire construit des polymetriques par reecriture.

La validation structurelle des `{}` est **repoussee au moteur BP3**.

---

## Time signatures inline

```
// BPscript                              -> BP3
S <> S96 [meter:4+4/6]                  -> S <-> S96 4+4/6
S -> P1 P2 P3 [meter:4+4+4+4+4+4/4]    -> gram#N[M] S --> P1 P2 P3 4+4+4+4+4+4/4
```

---

## Extensions futures (necessitent modifications BP3)

### Capture de groupes

Actuellement `?` capture exactement **un** symbole. Pas de mecanisme
pour capturer un **groupe** de symboles de longueur variable.

### CV sur les parametres moteur (speed, scale, tempo)

Les parametres resolus par le moteur BP3 lui-meme ne supportent que des valeurs
discretes. Trois approches possibles :
1. Modifier le moteur BP3 pour supporter des durees variables
2. Discretiser au compilateur -- `ramp(1, 3)` -> serie de `/N`
3. Post-traiter -- deformer le timeline apres resolution BP3

### Quoted symbols

BP3 supporte les quoted symbols (`'1'`, `'texte'`). BPscript **ne porte pas**
cette syntaxe. Les grammaires BP3 qui les utilisent sont renommees dans la
traduction (ex: `'1'` -> `d1`).

### Conventions de notes

Le contournement actuel (flat alphabet + bol prefix + prototypes -so.) est
documente dans [DESIGN_PITCH.md](DESIGN_PITCH.md).
L'architecture cible (alphabets parametriques, temperaments, tunings)
rend obsolete le NoteConvention hardcode de BP3.

---

## Documents lies

- [DESIGN_INTERFACES_BP3.md](DESIGN_INTERFACES_BP3.md) -- Interface WASM complete (in/out)
- [DESIGN_LANGUAGE.md](DESIGN_LANGUAGE.md) -- Specification du langage
- [BPSCRIPT_EBNF.md](BPSCRIPT_EBNF.md) -- Grammaire formelle EBNF
- [BPSCRIPT_AST.md](BPSCRIPT_AST.md) -- Structure de l'AST
- [DESIGN_ARCHITECTURE.md](DESIGN_ARCHITECTURE.md) -- Architecture technique
