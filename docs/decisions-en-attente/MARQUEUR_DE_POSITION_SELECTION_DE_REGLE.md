# Dossier — le marqueur de POSITION qui sélectionne une règle : BPScript ne l'exprime pas

**Pour arbitrage : Romain.** Rédigé 2026-07-19 par bpscript, à la demande de l'architecte ([751]).
**Statut : GAP PROUVÉ.** C'est le seul rôle de marqueur encore ouvert ; les quatre autres
(`=`/`:` maître-esclave, `+` mesure additive, `\`, le `;` saut-de-ligne) sont couverts ou exclus par
`hub/decisions/2026-07-19-marqueurs-structurels-aucun-travail-langage.md`.

> **On m'a demandé de ne pas reclore en « rien à porter » sans preuve.** Je ne le fais pas :
> l'existant **ne couvre pas** ce rôle, et voici la démonstration.

---

## POURQUOI — ce que fait le marqueur dans `-gr.dhati`

Les règles de `gram#3` portent le marqueur **des deux côtés de la flèche**, à la même position :

```
gram#3 [26] <100> LEFT N16 + <-> V8 A8 +
gram#3 [32] <100> LEFT N14 + <-> V6 A8 +
gram#3 [33] <100> LEFT O8  ; <-> A8 ;
gram#3 [36] <100> LEFT O16 ; <-> V8 A8 ;
gram#3 [37] <100> LEFT + O16 ; <-> + A16 ;
```

Trois faits se lisent directement :

1. **Le marqueur est DANS le membre gauche.** Il fait donc partie du motif à apparier : `N16 +`
   ne s'apparie que là où `N16` est suivi de `+`. C'est *lui* qui décide quelle règle s'applique.
2. **Il est REPRODUIT dans le membre droit**, à la même place. Il n'est pas consommé : il persiste
   dans la dérivation et reste disponible pour les règles suivantes.
3. **Les deux glyphes sont utilisés SIMULTANÉMENT et distinctement.** La règle `[37]` porte `+` en
   tête *et* `;` en fin, dans la même règle. Ce ne sont pas deux graphies d'une même chose : ce sont
   deux marqueurs qu'il faut pouvoir distinguer en même temps.

C'est de la **dérivation contextuelle** : `[26]` et `[36]` ont le même membre droit utile
(`V8 A8`), des membres gauches différents, et se départagent par le marqueur.

---

## QUOI — ce que BPScript sait faire, et l'endroit exact où ça casse

### BPScript porte bien une dérivation contextuelle… mais pas celle-ci

Le langage a des contextes (`EBNF.md:525-536`) : positif `( … )`, négatif `#X` / `#( … )`, plaçables
avant le LHS, après le RHS ou dans le RHS. Vérifié, ils compilent :

| Forme | Résultat |
|---|---|
| `(X) N16 <> V8 A8` | ✅ accepté |
| `#X N16 <> V8 A8` | ✅ accepté |

**Mais un contexte n'est pas un marqueur de position**, et deux mesures le montrent :

| Forme | Résultat |
|---|---|
| `(+) N16 <> V8 A8` | ❌ *Expected RPAREN, got PLUS* — un contexte ne peut pas porter le glyphe |
| `N16 <> V8 A8 (+)` | ❌ *Expected arrow* |
| `N16@ctx <> V8 A8` | ❌ *Expected arrow, got AT* |

S'ajoute une différence de **nature** : un contexte est un *entourage* qui n'est pas réécrit, alors
que le marqueur de dhati traverse la règle et persiste. Les deux mécanismes ne se substituent pas.

### L'asymétrie décisive : le marqueur s'ÉMET mais ne s'APPARIE pas

`+` est le seul des cinq glyphes que BPScript tokenise. Testé **dans toutes les positions des deux
côtés** — la leçon des positions, appliquée :

| Membre | Tête | Milieu | Fin | Collé |
|---|---|---|---|---|
| **droit** (RHS) | ✅ `S <> + a b` | ✅ `S <> a + b` | ✅ `S <> a b +` | — |
| **gauche** (LHS) | ❌ | ❌ | ❌ | ❌ |

Les quatre rejets du LHS : *Expected arrow (-> <- <>), got PLUS*. Et l'EBNF le confirme —
`lhs_element` (`EBNF.md:547-551`) énumère `symbol | variable | wildcard | context |
template_anchor | "{" | "}" | ","`. **Aucune production de marqueur.** Il est absent du membre
gauche par construction, pas par oubli d'implémentation.

**Conclusion : le marqueur peut être produit, jamais apparié.** Or apparier est précisément son
rôle. Ce que BPScript sait faire de `+` est le seul usage qui ne sert pas ici.

### Et le second marqueur n'existe pas du tout

`;` est rejeté partout (*Caractère inattendu ';'*). Donc même si le LHS acceptait `+`, la règle
`[37]` (`+ O16 ; <-> + A16 ;`) resterait intranscriptible : elle a besoin de **deux marqueurs
distincts dans la même règle**.

---

## COMMENT — ce que je ne tranche pas

1. **Ce n'est pas « ajouter un glyphe ».** Le manque est dans le membre gauche : il faudrait qu'un
   marqueur y soit un élément d'appariement à part entière, reproduit à droite. C'est une
   extension du modèle de règle, pas une tolérance de tokenizer.
2. **Un contournement existe mais serait un faux ami.** On peut déclarer des pseudo-terminaux
   (`plus`, `pv`) et les apparier comme des symboles ordinaires. Le comportement de dérivation
   serait proche — mais la grammaire BP3 émise ne serait plus celle du natif, et la fidélité
   byte-à-byte tomberait. Je le signale pour qu'on ne le prenne pas pour une solution.
3. **La portée réelle reste à mesurer.** Je sais que `dhati` en dépend (`gram#3`, une douzaine de
   règles) et que `dhadhatite` emploie `+`. Je n'ai pas chiffré le reste du corpus — je peux le
   faire si l'arbitrage le demande, mais je préfère ne pas avancer un nombre non mesuré.
