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

| Glyphe | BPScript | Vérifié |
|---|---|---|
| `+` | **accepté** — en tête, en fin, collé, espacé | `S <> a + b` → `S <-> a + b` |
| `:` | rejeté | `S <> He Says : a` → *ligne non reconnue* |
| `;` | rejeté | `S <> a ; b` → *Caractère inattendu ';'* |
| `=` | rejeté | `S <> a = b` → *ligne non reconnue* |

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

| Glyphe | Occupé par | Occurrences comme littéral dans `EBNF.md` |
|---|---|---|
| `:` | **affecte une valeur** — `ch:3`, `cc:74`, `@duration:16b`, `kv_pair`… | **34** |
| `=` | mutation de drapeau `[X=N]`, `@alias X = …`, ancres `(= …)` | 5 |
| `;` | **rien** | **0** |

**`;` est libre.** Il n'apparaît nulle part dans la grammaire BPScript — il n'est rejeté que par le
fail-loud du tokenizer ajouté cette nuit, qui ne le connaît pas. Son ajout serait mécanique.

`:` et `=` sont un autre sujet : les admettre comme marqueurs demande une règle qui les distingue
de leur emploi d'opérateur. La forme native `Says:` (collée à un identifiant) suggère qu'une règle
positionnelle est possible, mais **je ne la propose pas** — c'est précisément le genre de choix qui
se ratifie et ne s'invente pas.

---

## COMMENT — quatre options, combinables

| Option | Ce qu'elle débloque | Coût / risque |
|---|---|---|
| **(a) `;` seul** | rien aujourd'hui (aucune grammaire du corpus ne l'emploie) | ~nul, mais gain nul aussi |
| **(b) marqueur entre accolades** (le `+` que nous portons déjà) | **`dhadhatite`** | contenu du parseur d'accolades à étendre ; aucune ambiguïté nouvelle — `+` n'est pas un opérateur en position de contenu |
| **(c) `:` et `=` comme marqueurs** | **`trySerial`** | demande la règle de désambiguïsation ; `:` est le glyphe le plus chargé du langage (34 emplois) |
| **(d) hors périmètre** | rien | `trySerial` et `dhadhatite` restent sans fixture — mais `dhadhatite` est du répertoire musical, pas un test |

---

## Ce que je ne tranche pas

Trois remarques factuelles, sans recommandation :

1. **(b) et (c) sont de natures très différentes.** (b) étend un parseur sur un glyphe que nous
   portons déjà et qui n'est pas ambigu là où il manque. (c) touche la règle d'or de la surface
   (`:` affecte une valeur) et mérite un vrai arbitrage.
2. **L'enjeu n'est pas symétrique.** (b) débloque une pièce musicale ; (c) débloque une grammaire de
   test des opérateurs sériels. Si la sobriété doit trancher, elle ne tranche pas pareil des deux
   côtés.
3. **Le redoublement `++` reste ouvert même après (b).** Le natif écrit `++`, j'émets `+ +`. Je n'ai
   pas prouvé que le moteur les lit identiquement — à vérifier avant de conclure que (b) suffit.
