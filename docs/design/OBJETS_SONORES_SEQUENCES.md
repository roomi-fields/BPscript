# Dossier — un terminal dont la réalisation est une SÉQUENCE ENREGISTRÉE

**Pour arbitrage : Romain.** Rédigé 2026-07-19 par bpscript, à la demande de l'architecte (notes [729]/[731]).
**Statut : question ouverte.** Rien n'est implémenté, aucune syntaxe n'est proposée.

> **La question n'est pas « comment déclarer un son ».** Le modèle son ratifié (LANG-SONS,
> 2026-06-24 + §8-11 du 2026-07-17) est riche et couvre trois natures. La question est de savoir
> s'il doit en accueillir une **quatrième**, ou si celle-ci est hors périmètre par construction.

---

## POURQUOI — trois grammaires produisent moins que leur référence

La baseline v10 a corrigé deux comptes, et l'écart restant est chez moi :

```
tryKeyMap    référence 410 jetons    ma Voie B 392    (−18)
```

bp3-engine précise que 410 est **exactement ce que dérive BPx** : sa capture ne chargeait pas les
fichiers d'objets sonores, la mienne ne les déclare pas. C'est un **provisionnement natif non
transcrit**, même famille que l'horloge (`-se`) traitée le même jour — sauf que là, je savais quoi
écrire.

**Portée mesurée** : `-so.<grammaire>` existe pour **trois** grammaires productibles, toutes trois
avec une `.bps` — `dhati`, `tryCsoundObjects`, `tryKeyMap`. Pas une de plus.

### Ce que le fichier contient réellement (lu, pas supposé)

`-so.tryKeyMap` définit deux objets sonores, `a` et `b`. Chacun porte **une séquence MIDI
enregistrée** — une liste d'événements horodatés (note-ons, contrôleurs, timestamps). Leurs scores
Csound sont **vides** :

```
_beginCsoundScore_
<HTML></HTML>
_endCsoundScore_
```

Malgré le nom du répertoire `csound_resources/`, **ce n'est pas du Csound**. Le fichier se décrit
lui-même : *« This sound-object accepts key mapping »* pour `a`, et pour `b` *« same to 'a' except
that it does not accept key mapping »* — c'est précisément ce que `tryKeyMap` teste. Les 18 jetons
manquants sont le contenu de ces phrases.

---

## QUOI — le modèle ratifié couvre trois natures, celle-ci en est une quatrième

Vérifié piste par piste, comme demandé :

| Piste | Ce qu'elle porte | Couvre une séquence enregistrée ? |
|---|---|---|
| `voices.json` → `audio:` | backtick typé `js:`/`faust:` — le code **synthétise** | ❌ synthèse, pas rejeu |
| `voices.json` → `device:` | `{preset, params}` — on **sélectionne** un patch | ❌ et le commentaire est explicite : « on ne synthétise pas sur MIDI » |
| **Modules** (spec §8, ratifiés) | fonction à ports typés, DSP embarqué (genish/Faust/csound/VCV) — le module **calcule** | ❌ calcul, pas événements stockés |
| `@sound.X` | référence-librairie vers le registre ci-dessus | ❌ ne crée pas de contenu |
| Backticks | portent du **calcul** — « BPScript ordonnance, le backtick calcule » | ❌ par principe |

**Le modèle sait synthétiser, sélectionner un patch, et calculer. Il ne sait pas rejouer une suite
d'événements stockée.** Ce n'est pas une syntaxe oubliée : c'est une nature de son que le modèle
n'adresse pas.

---

## COMMENT — trois options

| Option | Ce qu'elle fait | Coût / risque |
|---|---|---|
| **(a) Quatrième réalisation** — une voix pourrait porter une séquence d'événements en plus de `audio:` et `device:` | débloque les 3 grammaires | ajoute une nature au modèle son que Romain a figé ; et une séquence enregistrée est de la **donnée**, pas du code — le modèle est entièrement bâti sur « le module calcule » |
| **(b) Hors périmètre** — mécanisme legacy BP2 non porté | rien | les 3 grammaires restent en écart permanent, dont `tryKeyMap` qui est un **test de feature** (`_keymap` sur objets sonores) |
| **(c) Autre** (à ouvrir) | — | — |

---

## Ce que je ne tranche pas

Trois remarques factuelles, sans recommandation :

1. **Je ne sais pas distinguer « oublié » de « exclu volontairement ».** Le `-so` est un mécanisme
   **legacy BP2** (phrases MIDI enregistrées comme objets sonores) ; LANG-SONS est délibérément un
   modèle **généralisé** de synthèse et de patchs. Que la quatrième nature en soit absente peut être
   un choix, pas un oubli — et c'est exactement ce que je ne peux pas juger depuis mon poste.
2. **L'enjeu est plus faible qu'il n'y paraît.** Trois grammaires, dont une (`tryCsoundObjects`) a
   déjà 0 jeton de référence. L'écart réel porte sur `tryKeyMap` (−18 sur 410) et `dhati`.
3. **Une séquence enregistrée est de la DONNÉE.** Toutes les réalisations existantes sont du *code*
   (backtick) ou une *sélection* (preset). Accueillir des événements stockés changerait la nature de
   ce qu'une voix peut contenir — c'est ce qui rend la question structurante et non cosmétique.
