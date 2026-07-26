# Table de traduction `script(…)` + classification `[]` / `()`

> **Livrable [908]** (mandats 1b et 2), demandé par l'architecte, consommé par **bp3-frontend**
> pour la voie A. Établi sur mesure du corpus au 2026-07-25.
> Corpus mesuré : `kanopi/packages/library/scenes/BPScript-tests` (95 scènes `.bps`).

---

## 0. Constat préalable — le cadrage reçu était inexact sur la cause

Le lot annonçait « le transpileur tolère un mot qui n'existe pas dans le langage ». **Mesuré : faux.**
`script` **est déclaré** dans l'autorité des contrôles :

```
lib/controls.json  →  runtime.midi.script
    { "args": ["command"], "description": "MIDI script command (program change sequences, etc.)" }
```

Le transpileur n'invente donc rien : il applique fidèlement la librairie qui fait autorité
(`feedback_controls_json_authority`). **La faute est dans la librairie, pas dans le code du parseur.**

**Corollaire mesuré, et il change le correctif** : un contrôle *totalement inconnu* est **accepté** —

```
@core / @controls / @alphabet.western:midi / @mode:ord
S -> foobar(3) C4        →  ACCEPTÉ, 0 erreur
```

Il n'existe **aucune validation du vocabulaire des contrôles**. Retirer `script` de la librairie ne
produirait donc **aucune erreur** : `script(…)` continuerait de passer, exactement comme `foobar(3)`.
Le fail-loud demandé (mandat 1a) **n'est pas un ajustement de `script`, c'est une garde qui n'existe
pas encore**, et sa portée dépasse ce lot.

**Rayon d'impact de cette garde, mesuré AVANT correctif** : 37 contrôles distincts sont utilisés dans
le corpus, **0 hors vocabulaire**. Une fois `script` retiré de la librairie, **seules les 5 scènes qui
le portent tombent** — aucune autre régression. Le rayon est borné et connu.

---

## 1. Table de traduction — `script(X)` → directive correcte

Inventaire **en code actif** (les lignes de commentaire sont exclues : `CT n` / `CTn` / `CT 0`
n'apparaissent QUE dans des commentaires et ne sont pas du code) :
**34 occurrences, 5 fichiers, 6 familles.**

| # | Forme `script(…)` | Occ. | Traduction | Classe | Autorité |
|---|---|---|---|---|---|
| 1 | `script(MIDI program N)` | 24 | **`ins(N)`** | `()` runtime | `controls.json` `runtime.midi.ins` — *MIDI Program Change*, `args:["program"]`, range 1-128 |
| 2 | `script(MIDI controller #C = V channel N)` | 3 | **`cc(C,V)`** (+ canal, cf. note) | `()` runtime | `controls.json` `runtime.midi.cc` — `args:["number","value"]` |
| 3 | `script(wait for <note> channel N)` | 2 | **aucune cible** → §2 | — | — |
| 4 | `script(Tick cycle ON/OFF)`, `script(Reset tick cycle)` | 3 | **aucune cible** → §2 | — | — |
| 5 | `script(MIDI send Continue)` | 1 | **aucune cible** → §2 | — | — |
| 6 | `script(Beep)` | 1 | **aucune cible** → §2 | — | — |

**La traduction 1 et 2 est mot-à-mot, à position et nature identiques.** Vérifié sur l'arbre émis :
`script(MIDI program 1)` et `ins(95)` produisent tous deux un nœud
`{type:'Control', name:…, args:[…], payload:{nature:'transport-control', flux:true}}`.
La forme d'appel `nom(args)` est bien celle qui convient — un contrôle autonome **dans le flux**,
là où `script(…)` occupe déjà seul son emplacement de règle (`765432.bps:254-256`,
`shapes-rhythm.bps:255-278`).

> ⚠️ **Point non tranché — le canal du CC.** `cc` déclare `args:["number","value"]` : **aucun
> paramètre de canal**. Or les trois occurrences portent `channel 1`. Deux options, à arbitrer :
> (a) `chan(1) cc(98,V)` — le canal posé séparément, mais il vaut alors pour la suite du flux ;
> (b) étendre `cc` à un 3ᵉ argument de canal. À noter : `switchon(64,1)` est déjà appelé avec deux
> arguments alors que sa déclaration n'en annonce qu'un (`args:["channel"]`) — les déclarations
> d'arité ne sont donc pas strictement tenues aujourd'hui, ce qui doit être tranché avec (b).

---

## 2. Les 4 familles sans cible — propositions pour Romain

**On ne crée pas de syntaxe sans lui.** Ces formes sont **proposées**, pas décidées. Chacune s'ancre
sur un mécanisme **existant** plutôt que d'ouvrir un canal parallèle (`docs/design/SCENES.md` §6 :
`@map` = pont I/O externe ↔ langage, pour CC, OSC **et `sys`** ; `sys.reset` / `sys.destroy` existent).

| Famille | Ce que ça fait | Existant le plus proche | Proposition |
|---|---|---|---|
| `wait for <note> channel N` | **Attend une note MIDI entrante** avant de poursuivre — synchronisation d'entrée | `@map cc:N -> [flag]` (lecture externe → flag, `SCENES.md:174`) | Étendre `@map` à la note entrante : `@map note:do#2 ch:1 -> [start]`, la règle étant gardée par `[start==1]`. Réutilise le pont et les gardes, n'invente aucun mot. |
| `Tick cycle ON` / `OFF` / `Reset tick cycle` | Pilote une **horloge de cycle** | commandes `sys.` (`SCENES.md:67,233`) | `sys.tick_on` / `sys.tick_off` / `sys.tick_reset`. ⚠️ Le domaine est **Kronos** (transport) : à co-signer avec lui, la sémantique d'horloge ne m'appartient pas. |
| `MIDI send Continue` | Message **système temps réel** MIDI (transport) | idem `sys.` | `sys.midi_continue` — même remarque : transport, donc Kronos. |
| `Beep` | Signal sonore **système**, non musical | aucun | Le seul cas sans ancrage. Question préalable à toute syntaxe : **est-ce que ça a sa place dans une partition ?** Ma recommandation est de **ne rien créer** et de laisser cette occurrence tomber en erreur. |

---

## 3. Classification `[]` / `()` — l'autorité est **structurelle**

`lib/controls.json` est organisé en **trois groupes de premier niveau**, et c'est cette structure qui
porte la classification — elle n'est ni à déduire ni à inventer :

| Groupe de `controls.json` | Graphie | Nature |
|---|---|---|
| `subgrammar` | `@directive` en tête de sous-grammaire | nature du temps, destru, mm, randomize |
| `engine` | **`[]`** | instruction **MOTEUR**, lue par BPx |
| `runtime.*` (`musical`, `midi`, `audio`, `dispatcher`, `generic`) | **`()`** | instruction **RUNTIME**, portée opaque jusqu'à la sortie |

Cohérent avec `CLAUDE.md` (« `[]` = instructions moteur ; `()` = instructions runtime, annotation
opaque portée sur l'événement ») et avec le modèle rappelé par Romain.

**Le cas d'école est confirmé** : `vel` ∈ `runtime.musical` ⇒ **`(vel:80)`**, parenthèses.
Notre chaîne l'affiche `[vel:80]` — **c'est le rendu qui est faux, pas la classification.**
(Correction côté Kairos, sur cette table ; je classe, je ne change pas le rendu.)

### Classification de chaque contrôle utilisé par le corpus

37 contrôles distincts, **0 hors vocabulaire**. `#` = nombre de scènes.

**MOTEUR → `[]`** (8)

| Contrôle | # | Contrôle | # |
|---|---|---|---|
| `legato` | 6 | `tempo` | 2 |
| `staccato` | 5 | `retro` | 1 |
| `goto` | 3 | `rotate` | 1 |
| `repeat` | 3 | `randomize` | 1 |

**RUNTIME → `()`** (29)

| Sous-groupe | Contrôles (avec # de scènes) |
|---|---|
| `runtime.musical` | `vel` 21, `velcont` 3, `rndvel` 2 |
| `runtime.midi` | `volume` 9, `pitchcont` 7, `pitchbend` 7, `chan` 6, `volumecont` 6, `pitchrange` 6, **`script` 5**, `ins` 3, `pitchfixed` 3, `switchon` 2, `switchoff` 2, `mod` 1, `modcont` 1, `press` 1, `presscont` 1, `keymap` 1, `mapstep` 1, `mapcont` 1, `mapfixed` 1 |
| `runtime.dispatcher` | `chromashift` 12, `scale` 5, `transpose` 1, `keyxpand` 1 |
| `runtime.generic` | `cont` 4, `value` 4, `fixed` 3 |

`script` y figure **au titre du constat** (§0) : il est aujourd'hui déclaré runtime MIDI. **Il doit
disparaître de la librairie** — c'est le premier geste du mandat 1a.

---

## 4. FAIT — mise en œuvre du 2026-07-26 (GO Romain)

`script` **n'existe plus**. Ce qui a été livré, et ce que ça a coûté de plus que prévu :

| Geste | Où |
|---|---|
| `runtime.midi.script` retiré + bundle régénéré | `lib/controls.json`, `src/transpiler/libs-data.js` |
| **Garde de vocabulaire des appels** (le vrai fail-loud) | `src/transpiler/bpxAst.js` `validateCallVocabulary` |
| Refus de la prose en argument de contrôle | `src/transpiler/parser.js` `parseControl` |
| Garde de non-régression + preuve d'appelant vivant | `test/vocabulaire_appels.mjs` |
| 21 `ins(N)` + 2 `chan(N) cc(C,V)` | `shapes-rhythm.bps` |
| 2 `ins(N)` + 1 `chan(N) cc(C,V)` | `765432.bps` |

**Deux critères, pas un** — le premier ne suffisait pas :

- **(a) vocabulaire** — nom d'appel absent des alphabets/déclarations. Exige un alphabet en portée,
  sinon il refuse à tort un fragment légitime (`sitar -> C4 C4(ch:5)`, mesuré).
- **(b) forme de l'argument** — un argument **positionnel** sur un nom qui n'est pas un contrôle
  déclaré : `()` porte une annotation `clé:valeur`, pas une phrase. Indépendant de l'alphabet, donc
  il ferme le cas des scènes qui n'en ont pas (`koto3`, scène à gates, passait indemne par (a)).
  Mesuré sur les **deux** corpus consommateurs : le seul appel à argument positionnel est `script`.

**Rayon mesuré** : Kanopi `BPScript-tests` 95 scènes → **4 refusées** (les 4 familles sans nom) ;
BPx `test/scenes` 19 scènes → **0**. `765432` compile désormais sans erreur.

**Nettoyage anti-rétrocompat** : `parseControl` recollait les mots successifs par des espaces et
acceptait `#` — deux accommodements qui n'existaient **que** pour la prose de `script` (vérifié :
`do#3` est un seul jeton, la branche `#` ne servait donc pas les noms de notes). Supprimés,
remplacés par un refus qui nomme le contrôle fautif.

---

## 5. Ce que la mise en œuvre exigeait (analyse du 2026-07-25, conservée)

Dans le même mouvement, sans migration douce :

1. **Retirer `runtime.midi.script`** de `lib/controls.json`, **et régénérer le bundle**
   (`npm run bundle:libs` — obligatoire, sinon divergence silencieuse : le code lit encore l'ancienne
   valeur ; la garde de fraîcheur est branchée au portillon).
2. **Ajouter la garde de vocabulaire** : un contrôle absent de `controls.json` ⇒ **erreur de
   compilation bloquante**. Elle n'existe pas (mesure §0) et c'est elle, le vrai fail-loud.
3. **Reconvertir** les 5 scènes : familles 1 et 2 traduites, familles 3 à 6 laissées telles quelles
   pour tomber en erreur — c'est l'intention de Romain.

> ⚠️ **Action de FRONTIÈRE.** Le point 2 invalide des formes jusque-là acceptées : prévenir **BPx**
> et **Kanopi** (le corpus lui appartient) dans le même geste, avec la liste exacte des formes
> invalidées et la migration attendue. Le corpus vit chez Kanopi : j'écris les fichiers, **Kanopi
> commite**.
