# Inventaire des portées des contrôles

**Produit par BPscript le 2026-08-08**, sur commande de Romain (« c'est le rôle de BPScript de faire
l'inventaire ») — donnée d'entrée du temps 2 du chantier
`hub/projets/2026-08-08-sortir-le-code-en-dur-des-controles/`.

**Ce document est un inventaire, pas une décision.** Chaque ligne porte son **fondement** : ce qui
vient de la référence, ce qui vient du moteur d'origine, ce qui n'est qu'une mesure d'usage, et ce
qui n'est établi par rien. Rien n'y est tranché ; les portées proposées attendent Romain.

## 1. Le compte, vérifié plutôt que cru

L'architecte annonçait 65 contrôles, 5 en sous-grammaire, 17 moteur, 43 exécution répartis en cinq
sous-groupes (musical 5, midi 24, audio 6, dispatcher 5, generic 3), dont 8 seulement déclarent une
portée, toutes du côté moteur, le champ n'acceptant qu'une valeur.

**Mesuré : exact, sur tous les chiffres.** Les deux seules valeurs de portée existantes sont `rule`
(×4) et `seq_prefix` (×4), et jamais une liste.

Deux précisions que la mesure ajoute :

- **65 entrées, 64 noms.** `randomize` est déclaré **deux fois**, en sous-grammaire et côté moteur,
  avec la même correspondance native. Un nom, deux portées, deux déclarations — à trancher.
- **Le sac ne porte pas que des contrôles.** Deux clés du corpus vivent dans une AUTRE librairie et
  s'écrivent pourtant dans un sac : `cutoff` (×20, librairie des modulations) et `ch` (×1, paramètre
  d'adresse de sortie). Une validation bâtie sur la seule librairie des contrôles les refuserait à
  tort. La portée ne se déclare donc pas *dans les contrôles*, elle se déclare *pour toute clé de
  sac*.

## 2. Le fait central : la déclaration existante est démentie par les deux sources

**Aucun des 8 contrôles qui déclarent une portée n'est écrit à l'endroit qu'il déclare.**

| déclaré | contrôles | ce que les sources montrent |
| --- | --- | --- |
| `rule` | `repeat` `failed` `goto` | juste — le moteur d'origine les écrit en fin de règle |
| `rule` | `stop` | **rien ne le dit** : absent du corpus ET du moteur d'origine |
| `seq_prefix` | `retro` | **faux** — il s'écrit DANS le flux (×33 au natif, ×8 ici) |
| `seq_prefix` | `rotate` | tête de **groupe** au natif (×13), flux ici (×12) — pas un préfixe |
| `seq_prefix` | `shuffle` `order` | tête de **groupe** — c'est un réglage de groupe, pas un préfixe |

**`seq_prefix` n'est pas une portée, c'est une position dans le TEXTE du moteur d'origine** (« en
tête de séquence »). Le vocabulaire actuel mélange donc deux choses : *où le réglage s'écrit dans
une syntaxe étrangère* et *sur quoi il porte dans notre arbre*. C'est ce mélange qui rend la
déclaration inutilisable pour valider.

## 3. Le vocabulaire fermé — proposé, fondé sur la référence

`LANGUAGE.md` §« Résumé des portées » porte déjà un tableau, et c'est lui qui fait autorité :
**globale, groupe, règle, symbole**. La mesure en confirme trois et en ajoute deux que la référence
n'y met pas.

| portée | ce qui la porte dans l'arbre | fondement |
| --- | --- | --- |
| `scene` | une directive de tête | référence (« globale ») |
| `bloc` | une sous-grammaire | **mesuré, absent du tableau de la référence** |
| `regle` | une règle | référence |
| `groupe` | un groupe polymétrique | référence |
| `symbole` | tout élément du flux | référence |
| `flux` | un réglage posé avec `!` | référence, mais **nommée autrement** |

Trois remarques, et chacune est une question ouverte :

- **`symbole` couvre plus qu'une note.** La proposition qui circulait disait « note ». Mesuré, un
  réglage s'accroche aussi à un **silence**, à une **prolongation**, à un **joker** et aux deux
  membres d'un **gabarit** — 10 porteurs d'arbre au total. Écrire « note » rétrécirait le
  vocabulaire sous l'usage réel.
- **`bloc` manque à la référence.** Cinq contrôles ne s'écrivent que là (`mm`, `striated`, `smooth`,
  `destru`, `randomize`), et le corpus en emploie quatre. Soit le tableau de la référence est
  incomplet, soit ces cinq relèvent de `scene` — **question pour Romain**.
- **`flux` n'est pas une portée au sens de la référence**, qui en dit : « un état courant qui reste
  en vigueur d'une règle à l'autre », de portée **par voix**. Mais pour *valider*, il faut savoir si
  un contrôle a le droit d'y être posé — un poids dans le flux n'a aucun sens. Le faire entrer au
  vocabulaire est donc utile et contredit la référence sur le mot : **question pour Romain**.

## 4. Ce que la référence tranche déjà, et qu'il ne faut pas rouvrir

- **« Une règle porte UN sac de portée. Pour en poser plusieurs, chacun prend son `!` »**
  (§« Contrôles autonomes »). Le point de cardinalité est donc **déjà tranché pour la règle**, et le
  compilateur s'y conforme : deux sacs consécutifs en fin de règle fusionnent en un seul.
  Ce que la référence n'écrit nulle part, c'est le cas du **symbole** — et cinq scènes du corpus y
  collent deux sacs. C'est là, et là seulement, que la question reste ouverte.
- **`mode` porte plus loin que sa place** (§« Le sac dans le flux ») : écrit sur la règle, il vaut
  pour la sous-grammaire entière. **La portée d'écriture et la portée d'effet sont deux choses** —
  toute déclaration qui n'en porterait qu'une serait fausse pour ce contrôle.
- **Précédence**, en toutes lettres : réglage de symbole > flux > portée > défauts de déclaration.

## 5. L'inventaire des 65

Les colonnes disent, dans l'ordre : la portée **déclarée aujourd'hui** ; où le contrôle est
**réellement écrit** dans les 274 scènes du corpus ; où le **moteur d'origine** l'écrit ; la portée
**proposée** ; et le **fondement** de cette proposition. « — » en usage signifie que le contrôle
n'est écrit nulle part dans le corpus : **16 sont dans ce cas**, et pour eux la proposition ne
repose que sur la référence ou sur le moteur d'origine.


#### subgrammar — 5 contrôles

| contrôle | déclarée | écrit sur (corpus) | natif | portées proposées | fondement |
| --- | --- | --- | --- | --- | --- |
| `destru` | — | bloc·3 | préambule ×3 | bloc | natif |
| `striated` | — | scene·10 bloc·6 | préambule ×22 | bloc, scene | natif+mesure |
| `smooth` | — | scene·1 | — | bloc, scene | natif+mesure |
| `mm` | — | scene·128 bloc·7 | préambule ×25 | bloc, scene | natif+mesure |
| `randomize` | — | bloc·1 | préambule ×6 | bloc | natif |

#### engine — 17 contrôles

| contrôle | déclarée | écrit sur (corpus) | natif | portées proposées | fondement |
| --- | --- | --- | --- | --- | --- |
| `mode` | — | bloc·340 | — | regle | bible §1217 — écrit sur la règle, vaut pour le bloc |
| `scan` | — | regle·79 | — | regle | bible §1024 |
| `weight` | — | regle·1356 | — | regle | DÉCISION Romain 2026-08-08 |
| `on_fail` | — | — | — | regle | bible §1027 |
| `meter` | — | regle·13 | — | regle | bible §1028 |
| `repeat` | `rule` | — | fin de RHS ×8 | regle | natif |
| `failed` | `rule` | — | fin de RHS ×6 | regle | natif |
| `stop` | `rule` | — | absent | regle | ? natif muet |
| `goto` | `rule` | — | fin de RHS ×15 | regle | natif |
| `retro` | `seq_prefix` | flux·8 | dans le flux ×33 | flux, groupe | natif+mesure — PAS un préfixe |
| `shuffle` | `seq_prefix` | groupe·5 | tête de groupe ×17 | groupe | natif+mesure |
| `order` | `seq_prefix` | — | tête de groupe ×6 | groupe | natif |
| `rotate` | `seq_prefix` | flux·12 | tête de groupe ×13 | groupe, flux | natif+mesure |
| `staccato` | — | flux·7 | tête de groupe ×7 | groupe, flux | natif+mesure |
| `legato` | — | flux·11 | tête de groupe ×10 | groupe, flux | natif+mesure |
| `rndtime` | — | symbole·1 groupe·1 | absent | symbole, groupe, flux | mesure — natif muet |
| `randomize` | — | bloc·1 | préambule ×6 | bloc | natif |

#### runtime.musical — 5 contrôles

| contrôle | déclarée | écrit sur (corpus) | natif | portées proposées | fondement |
| --- | --- | --- | --- | --- | --- |
| `vel` | — | flux·322 regle·143 symbole·126 groupe·6 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `pan` | — | symbole·18 regle·16 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `rndvel` | — | flux·2 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `velcont` | — | flux·9 symbole·3 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `offvel` | — | — | — | symbole, groupe, regle, flux | bible §1118 (défaut) |

#### runtime.midi — 24 contrôles

| contrôle | déclarée | écrit sur (corpus) | natif | portées proposées | fondement |
| --- | --- | --- | --- | --- | --- |
| `chan` | — | flux·244 symbole·24 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `ins` | — | flux·25 regle·4 scene·1 | — | symbole, groupe, regle, flux, scene | bible + mesure |
| `mod` | — | symbole·12 groupe·1 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `modcont` | — | symbole·1 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `pitchbend` | — | flux·23 symbole·6 groupe·1 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `pitchrange` | — | flux·8 regle·1 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `pitchcont` | — | symbole·3 flux·1 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `pitchfixed` | — | — | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `keymap` | — | flux·11 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `mapstep` | — | — | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `mapcont` | — | — | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `mapfixed` | — | — | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `pressure` | — | — | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `press` | — | symbole·2 groupe·1 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `presscont` | — | symbole·1 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `volume` | — | flux·18 regle·4 symbole·3 groupe·1 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `volumecont` | — | regle·2 groupe·1 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `switchon` | — | flux·2 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `switchoff` | — | flux·2 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `mute` | — | — | — | ? sac seul | non établi |
| `unmute` | — | — | — | ? sac seul | non établi |
| `panic` | — | — | — | ? sac seul | non établi |
| `sync` | — | flux·1 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `cc` | — | flux·3 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |

#### runtime.audio — 6 contrôles

| contrôle | déclarée | écrit sur (corpus) | natif | portées proposées | fondement |
| --- | --- | --- | --- | --- | --- |
| `wave` | — | regle·63 symbole·7 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `attack` | — | regle·14 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `release` | — | regle·14 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `detune` | — | regle·12 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `filter` | — | regle·8 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `filterQ` | — | regle·18 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |

#### runtime.dispatcher — 5 contrôles

| contrôle | déclarée | écrit sur (corpus) | natif | portées proposées | fondement |
| --- | --- | --- | --- | --- | --- |
| `transpose` | — | scene·7 symbole·2 | — | symbole, groupe, regle, flux, scene | bible + mesure |
| `scale` | — | flux·54 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `scaleshift` | — | — | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `chromashift` | — | flux·78 symbole·5 groupe·4 scene·1 | — | symbole, groupe, regle, flux, scene | bible + mesure |
| `keyxpand` | — | flux·18 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |

#### runtime.generic — 3 contrôles

| contrôle | déclarée | écrit sur (corpus) | natif | portées proposées | fondement |
| --- | --- | --- | --- | --- | --- |
| `value` | — | flux·29 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `fixed` | — | flux·3 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |
| `cont` | — | flux·6 | — | symbole, groupe, regle, flux | bible §1118 (défaut) |

TOTAL 65 · déclarent une portée : 8 · jamais écrits : 16

## 6. Ce qui manque, et ce que je n'ai pas pu établir

**a. Ce que le code de BPx applique réellement comme portée — je ne l'ai pas.** C'est la donnée qui
manque le plus, et elle n'est pas chez moi. Cet inventaire dit ce que la librairie DÉCLARE, ce que
le corpus ÉCRIT et ce que le moteur d'origine FAIT ; il ne dit pas ce que l'aval APPLIQUE. Sans
elle, on ne peut pas savoir si une portée proposée est déjà tenue ou reste à construire. Je ne l'ai
pas déduite de la librairie et je ne l'ai pas demandée.

**b. `stop` n'est fondé par rien.** Il déclare `rule` et n'existe ni dans le corpus, ni dans le
moteur d'origine. Sa portée est reprise de sa famille (`repeat`, `failed`, `goto`), pas mesurée.

**c. Les trois contrôles « sac seul » (`mute`, `unmute`, `panic`) n'ont aucune portée établie.**
Nommés le 2026-07-26, jamais écrits dans une scène, absents du moteur d'origine. Toute portée que je
leur donnerais serait une invention.

**d. 16 contrôles ne sont écrits nulle part.** Leur ligne repose entièrement sur la référence ou sur
le moteur d'origine. C'est légitime — l'usage n'est pas l'autorité — mais il faut le savoir : pour
eux, aucune mesure ne viendra contredire une erreur de proposition.

**e. La portée d'ÉCRITURE et la portée d'EFFET ne sont pas distinguées dans ce document.** `mode`
prouve qu'elles diffèrent. Si la déclaration doit servir à refuser une écriture mal placée, c'est la
portée d'ÉCRITURE qu'elle doit porter — et alors `mode` se déclare `regle`, ce qui est contre-intuitif
puisqu'il gouverne le bloc. À trancher avant d'écrire le champ dans la librairie.

**f. Le format du champ n'est pas proposé ici.** Passer d'une valeur à une liste est le temps 2 ; ce
document en est l'entrée, pas l'exécution. Il faudra aussi décider ce que signifie **l'absence** de
déclaration : aujourd'hui 57 contrôles n'en portent aucune, et « aucune » ne peut pas vouloir dire
« partout » si la déclaration doit servir à refuser.

## 7. Comment ce document se refait

Les tableaux ne sont pas écrits à la main : ils sont produits en compilant les 274 scènes du corpus
et en relevant, pour chaque clé de sac, la nature du nœud qui la porte. Les colonnes du moteur
d'origine viennent d'un comptage sur les grammaires natives de la bibliothèque. Une mesure recopiée
à la main serait une mesure de plus à ne pas croire.
