# Dossier — faut-il généraliser le porteur verbatim ?

**Pour arbitrage : Romain.** Rédigé 2026-07-18 par bpscript, à la demande de l'architecte (note [670]).
**Statut : question ouverte.** Rien n'est implémenté, aucune syntaxe n'est proposée comme acquise.

> **Cadrage révisé.** La question n'est PAS « BPScript a-t-il besoin d'un littéral textuel ». Un
> porteur de texte opaque **existe déjà** — je l'avais raté et j'ai failli présenter un faux trou.
> La vraie question est : **faut-il généraliser ce porteur hors de son emploi actuel, et jusqu'où ?**

---

## POURQUOI — ce qui ne passe pas aujourd'hui

Deux grammaires natives du corpus (`gramgene1`, `gramgene2`) sont des **métagrammaires** : elles ne
produisent pas de musique, elles produisent **le texte d'une autre grammaire**. Leur sortie est donc
faite de fragments de syntaxe BP3 recrachés tels quels.

Extrait de `-gr.gramgene2` (13 règles) :

```
GRAM#1[1] S --> '-ho.abc'; 'RND'; 'S' '-->' Inc Var Inc Var; '--------------------' ;
GRAM#1[6] Inc Var --> 'X'
```

Les fragments entre apostrophes sont du **texte opaque** : le moteur ne les interprète pas, il les
écrit. C'est le seul mécanisme dont ces grammaires ont besoin, et c'est celui qui manque.

Conséquence concrète : ces deux grammaires ne peuvent pas être transcrites en `.bps`, donc la Voie B
n'a aucune fixture pour elles, donc elles restent hors de la mesure de conformité.

---

## L'EXISTANT — ce qui porte DÉJÀ du verbatim (vérifié à la source)

**Les marqueurs d'homomorphisme.** `docs/spec/EBNF.md:962-963` : les identifiants placés entre `$X`
et `&X` sont « des marqueurs inline **préservés verbatim** dans le RHS BP3 ». Vérifié au compilateur :

```bpscript
S -> $X monmarqueur &X        →  gram#1[1] S --> (=X) monmarqueur (:X)
```

`monmarqueur` traverse intact. **BPScript sait donc déjà transporter un jeton que le moteur recrache
sans l'interpréter.** C'est le point qui change le cadrage.

### Ce que j'ai écarté, et pourquoi

| Mécanisme | Verdict | Preuve |
|---|---|---|
| Templates `$X` / `&X` seuls | Ancres **structurelles** : marquent une position, ne transportent rien | `EBNF.md:958` (compilés en `(=X)`/`(:X)`) |
| Étiquetage `N%terminal` | Forme de **sortie**, pas d'entrée — rejetée au tokenizer | `S -> 2%dha` → `Caractère inattendu '%'` |
| Backticks | **Substitués**, pas transportés : portent du calcul, pas du texte | `` S -> `RND` `` → `S --> BTauto0` |
| Littéral `STRING` | **Existe**, mais scopé `@scene` ; rejeté en partie droite de règle | `EBNF.md:1122` ; `S -> "-->"` rejeté |
| Alphabets à noms libres | Fonctionnent, mais les noms doivent rester **tokenisables** | `@test_alphabets.abc` OK ; `-->` impossible |

---

## QUOI — le gap réel, étroit

Le porteur verbatim existe **mais n'accepte que des identifiants**. Ce qui manque est le texte
contenant des **glyphes d'opérateur**. Les littéraux de `gramgene2` se scindent proprement en deux :

- **forme identifiant** — `'RND'`, `'S'`, `'X'`, `'Y'`, `'Z'` : le mécanisme actuel les porterait déjà ;
- **forme opérateur** — `'-->'`, `'-ho.abc'`, `'--------------------'` : aucun mécanisme.

**Réserve à ne pas escamoter :** même pour le premier groupe, le marqueur verbatim est défini *pour*
l'homomorphisme et positionné *entre master et esclave*. S'en servir comme transport de texte général
serait un **détournement de son emplacement**, pas un usage. Il ne suffit donc pas de constater que
« ça passerait » — il faut décider si ce porteur a vocation à sortir de son slot.

---

## COMMENT — trois options

### (a) Généraliser le marqueur verbatim aux glyphes d'opérateur

Étendre ce qui existe : un marqueur pourrait contenir autre chose qu'un identifiant.

- **Coût** — faible en surface (le transport existe), mais il faut délimiter le marqueur : `-->` est
  déjà l'opérateur de règle, donc sa forme nue est ambiguë et il faudrait une borne quelconque.
- **Ouvre** — les métagrammaires, sans concept nouveau dans le langage.
- **Casse / risque** — le marqueur cesserait d'être « un nom d'homomorphisme » pour devenir « du texte
  quelconque ». On dilue un mot du langage qui a aujourd'hui un sens précis, et on rend l'intention
  d'une ligne moins lisible : `$X --> &X` peut-il encore se lire ?

### (b) Un littéral textuel de surface, distinct

Un porteur explicite, séparé de l'homomorphisme. La brique existe déjà à moitié : `STRING` est défini
(`EBNF.md:1122`) mais réservé à `@scene` — il s'agirait de l'admettre en partie droite de règle.

- **Coût** — le plus élevé des trois : un mot de plus dans un langage qui en revendique peu
  (3 mots réservés, 24 symboles), et une règle de résolution à écrire (un littéral est-il un terminal ?
  compte-t-il dans l'alphabet plat ? occupe-t-il une durée ?).
- **Ouvre** — le cas général proprement, sans détourner un mécanisme voisin ; sert au-delà des
  métagrammaires (tout texte à faire traverser sans interprétation).
- **Casse / risque** — aucune rétrocompat en jeu (`"…"` est aujourd'hui rejeté en règle, donc rien
  n'en dépend), mais c'est un ajout permanent à la surface du langage.

### (c) Métagrammaires hors périmètre

Acter que produire *du texte de grammaire* n'est pas un objet de BPScript.

- **Coût** — nul en implémentation.
- **Ouvre** — rien.
- **Casse / renonce** — `gramgene1` et `gramgene2` restent sans fixture Voie B, définitivement. Le
  corpus de conformité plafonne à 2 grammaires près, et il faut l'écrire quelque part pour que
  personne ne reprenne la question dans six mois.

---

## Ce que je ne tranche pas

Le choix est de langage, donc il revient à Romain. Deux remarques factuelles pour éclairer, sans
recommandation :

1. Le besoin est **avéré mais étroit** : 2 grammaires sur 113, et aucune n'est musicale.
2. L'option (a) est la moins chère et l'option (b) la plus propre ; elles ne s'excluent pas dans le
   temps — (a) débloquerait la mesure tout de suite, (b) resterait possible ensuite. Mais empiler les
   deux donnerait *deux* façons de porter du texte, ce que la sobriété du langage déconseille.
