# Le gabarit maître/esclave, mesuré sur le moteur NATIF

**Question posée par Romain (2026-08-07) :** les **paramètres d'invocation d'un gabarit** —
`$mel(x:1)` en BPScript, `TemplateMaster.args` dans `AST.md` — existent-ils en BP3 ?

## Pourquoi la question se pose

`LANGUAGE.md` §« Les gabarits » écrit que **« les paramètres d'une invocation gouvernent
l'expansion du gabarit : ils valent pour ce que cette invocation produit »**, et `AST.md` leur
donne un champ à eux (`TemplateMaster.args`).

**Mesuré côté BPScript : ce champ est produit par RIEN.** Aucune scène de l'écosystème ne le
remplit. Les trois seules invocations parenthésées qui existent — dans `ek-do-tin.bps` — écrivent
`$Tihai(transpose:-200c)`, `&Tihai(pitchcont, pitchbend:-200, transpose:-200c)`,
`&Tihai(pitchbend:200)` : **que des noms de contrôles**, qui atterrissent dans le sac de réglages,
pas dans `args`.

D'où la question de fond : ce mécanisme existe-t-il seulement dans le moteur ?

## La forme native

`(=X)` capture (maître), `(:X)` rejoue (esclave). BPScript écrit `$X` / `&X` et émet exactement
cette forme.

## Comment relancer la mesure

```
cd /home/romi/dev/bp/bp3-engine
for f in /home/romi/dev/bp/BPscript/test/gabarit-bp3/*.bpgr; do ./bp3 produce-all -gr "$f"; done
```

⚠️ **Le moteur doit être lancé depuis SON dossier** : il y cherche `console_strings.json` et sort
sinon sur « Could not find file », sans rien avoir compilé. Les lignes `Failed to open` /
`Error opening` de la sortie concernent les fichiers de sortie MIDI, **pas la grammaire** — ne pas
les lire comme un échec de compilation. Le verdict est la ligne `Errors: N`.

## Ce que le moteur répond — mesuré le 2026-08-07, BP3 v3.5.0

| grammaire | écriture essayée | verdict |
| --- | --- | --- |
| `1-temoin-gabarit` | `(=V8) (:V8)` | **0 erreur — 2 items**, les deux moitiés identiques |
| `2-temoin-sans-gabarit` | `V8 V8` | **0 erreur — 4 combinaisons**, chaque moitié tire la sienne |
| `3-parametre-colle` | `(=V8(x))` | **1 erreur — compilation échouée** |
| `4-parametre-separe` | `(=V8 x)` | **1 erreur — compilation échouée** |
| `5-controle-entre-les-deux` | `(=V8) _transpose(-2) (:V8)` | **0 erreur — 2 items**, le contrôle voyage dans le flux |

Les grammaires 1 et 2 sont là pour prouver que la mesure **discrimine** : sans elles, deux refus
en 3 et 4 pourraient venir d'une erreur d'écriture ailleurs dans le fichier. Elles montrent que le
mécanisme fonctionne, et qu'il fait bien deux choses différentes selon qu'on l'invoque ou non.
La 5 montre la forme qui, elle, existe.

## Conclusion

**Le moteur natif n'a pas de paramètre d'invocation de gabarit** — les deux positions plausibles
sont refusées. Ce qui existe est un **contrôle posé dans le flux**, et c'est exactement ce que les
scènes de l'écosystème écrivent : un réglage, pas un paramètre d'expansion.

`TemplateMaster.args` est donc un champ **déclaré par la spec, produit par rien, et sans
contrepartie native**. Le retirer d'`AST.md` ou lui donner un sens est une décision de langage —
elle appartient à Romain. La mesure ne la prend pas ; elle en donne la matière.

⚠️ **Ce que cette mesure NE dit PAS.** Elle établit que *ces deux écritures-là* sont refusées, pas
qu'aucune forme de paramètre n'existe nulle part dans le moteur. Une troisième graphie, ou une
section `TEMPLATES:` employée autrement, resterait à essayer — « vérifier une forme, c'est essayer
ses positions ». Ce qui est prouvé, c'est qu'il n'y a **rien à porter** tant que personne ne nomme
cette troisième forme.
