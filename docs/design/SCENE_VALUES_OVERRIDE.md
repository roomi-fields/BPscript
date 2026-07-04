# Valeurs de scène — override générique des défauts de librairie

> **Statut : ✅ PRINCIPE RATIFIÉ (Romain, hub [292]) — RÉVISION v2 intégrant ses 3
> réponses. Le portage §3.4 (modèle contrôles, par-terminal) diffère SUBSTANTIELLEMENT
> de la v1 ratifiée (section scène-metadata) : FLAGGÉ à l'architecte pour
> re-vérification avant implémentation.** Rien n'est codé.

## 1. Principe (règle `:` / `.`)

- `.` **appelle un composant** de librairie : `@tuning.western_just` référence une
  structure nommée du catalogue. Un composant se référence, ne se redéfinit pas
  (tranché Romain, hub [289]).
- `:` **pose une valeur** : `@diapason:442` pose un scalaire.

**Règle systémique ratifiée (hub [292])** : toute valeur déclarée par une librairie
chargée — présente ou **future** — est posable/overridable en scène par sa forme `:`,
avec précédence **occurrence > acteur > scène > défaut de librairie**, résolue
génériquement. Une valeur ajoutée demain = 1 entrée JSON, zéro code.

## 2. Nommage (réponse Romain n°1 : un mot = une chose)

- ~~`@tuning:442`~~ **écarté** : surchargerait `tuning` (déjà le nom de l'axe `.`).
- Champ réel des catalogues : `baseHz` (tunings.json, temperaments.json) ; le
  résolveur Kairos lit `config.tuning?.baseHz ?? 440` (`resolver.ts:151` — repli 440
  en dur). Terme musicologique du concept : **diapason** (cohérent avec la règle
  vocabulaire : musicologie avant jargon technique).
- **Nom proposé : `diapason`**, UN seul nom de bout en bout : surface `@diapason:442`
  → registre `values.diapason` → pli acteur `values.diapason` → occurrence
  `payload.params.diapason` → lecture Kairos `diapason`.
- **Option de cohérence totale (à trancher)** : renommer `baseHz` → `diapason` dans
  les 2 catalogues + la lecture Kairos (1 champ, ~3 sites) ; sinon `baseHz` reste le
  champ-donnée du composant, documenté comme « diapason par défaut du composant ».

## 3. Mécanisme (v2 — portage aligné sur le modèle CONTRÔLES, réponse Romain n°3)

### 3.1 Déclaration (librairies — source unique des défauts)

Section normalisée `values` admise dans toute librairie JSON :

```json
"values": {
  "diapason": { "unit": "Hz", "range": [220, 880], "description": "hauteur de référence",
                "componentDefault": "baseHz" }
}
```

`componentDefault` : le défaut vit dans le composant référencé (le `baseHz` du tuning
choisi), pas en constante de fichier. Une valeur simple déclarerait `default` directe
(même dualité que controls.json aujourd'hui).

### 3.2 Registre (chargement — générique)

`libs.js` collecte l'union des sections `values` des librairies chargées →
`ctx.valueRegistry` (nom → spec). Noms de directives moteur (`@mode`, `@mm`,
`@seed`…) réservés et exclus (vérifié au chargement). Un nom ne peut pas être à la
fois valeur portée et réglage moteur (§3.7).

### 3.3 Surface (3 niveaux, cascade complète dès la V1)

| Niveau | Forme | État parseur |
|---|---|---|
| Scène | `@diapason:442` | parse déjà (`parser.js:643` : nombre → `Directive.value`) |
| Acteur | `@actor X tuning.western_just(diapason:432)` | parse déjà (`parser.js:961-974`, `parseRefParams`) — params aujourd'hui JETÉS pour tuning (`:930`, seul transport les garde) → les CAPTER, même modèle que `TransportRef{key, params}` |
| Occurrence | `C4(diapason:428)` | parse déjà (qualifieur générique → `payload.params`) |

**Verdict niveau acteur (réponse Romain n°2) : PROPRE en V1** — réutilise le
mécanisme acteur existant (params d'entité, pattern TransportRef), zéro syntaxe
nouvelle, zéro verrue. Validation générique aux 3 niveaux : nom ∈ registre (sinon
erreur claire), domaine vérifié (même modèle que `controlValidation.js`).

### 3.4 Pliage + portage (modèle CONTRÔLES — la valeur suit les terminaux)

Conforme AST_SPEC §0.1 : « le frontend **plie la cascade statique** (scène→acteur)
dans la **déclaration d'acteur** ; un token ne recopie **jamais** la config complète —
uniquement ses overrides d'occurrence ». Donc :

- **Statique** (défaut composant ?? scène ?? acteur) : plié **à l'émission** dans
  chaque déclaration d'acteur → `actors[i].values = { diapason: <effectif> }`
  (l'acteur implicite `default` le porte pour les scènes sans `@actor`). BPx le
  **porte opaque** dans la fiche d'acteur de l'arbre (`ActorEntry`, qui porte déjà
  l'identité de hauteur alphabet/tuning/octaves — KAI-10). Amendement AST_SPEC +
  contrat bpscript-bpx : **une fois**, générique pour toutes les valeurs futures.
- **Occurrence** : `(diapason:428)` sur une note → `payload.params.diapason` — canal
  **déjà existant et générique**, rien à changer au portage.

La valeur est ainsi **naturellement exposée aux runtimes** exactement comme les
contrôles : fiche d'acteur pour le défaut effectif, params d'occurrence pour
l'exception — pas de section scène-metadata séparée (v1 abandonnée sur raffinement
Romain).

### 3.5 Résolution (aval, par nom)

Kairos (V1, par note) :

```
diapason effectif = payload.params.diapason ?? actorEntry.values.diapason ?? baseHz du tuning
```

(le dernier terme disparaît si l'option de renommage §2 est prise : le pli à
l'émission absorbe le défaut du composant). Toute valeur future : le consommateur la
lit **par nom** au même endroit ; parseur, pliage, portage inchangés.

### 3.6 Hors périmètre (inchangé)

Les valeurs **interprétées par le moteur** (tempo, seed, maxitems — elles pilotent la
dérivation) gardent leur canal moteur. Le générique couvre les valeurs **portées**.

## 4. Cas d'école : diapason

`@tuning.western_just` + `@diapason:442` : composant résolu au catalogue, son défaut
440 précédé par 442 pour tous les acteurs de la scène ; `@actor solo
tuning.western_just(diapason:432)` précède la scène pour cet acteur ;
`C4(diapason:428)` précède tout pour cette note. La démo `tuning-ref442.bps`
(inerte en silence depuis toujours) devient la preuve e2e, réécrite `@diapason:442`.

## 5. Coordination (après re-vérification du portage flaggé)

| Qui | Quoi |
|---|---|
| architecte | re-vérifie le portage v2 (changement substantiel vs v1 ratifiée) + tranche §2 (renommage `baseHz`) |
| bpx | amendement AST_SPEC (`values` dans la déclaration d'acteur + `ActorEntry`) + portage opaque (1 fois) |
| bpscript | sections `values` des libs + registre + validation 3 niveaux + capture params d'entité acteur + pli à l'émission |
| kairos | lecture `diapason` par note (occurrence ?? acteur ?? composant) ; option renommage `baseHz` |
| kanopi | rien (hôte pur) |

## Historique

- v1 (fc0a491) : principe + portage scène-metadata. Principe ratifié Romain [292].
- v2 (ce document) : nommage `diapason`, niveau acteur V1 (jugé propre sur pièces),
  portage re-modelé sur les contrôles (par-terminal via acteur+occurrence). La
  question « provenance exposée à l'UI » est abandonnée (Romain).
