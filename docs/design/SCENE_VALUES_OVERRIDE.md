# Valeurs de scène — override générique des défauts de librairie

> **Statut : 🔶 PROPOSITION** (chantier hub [291], mené par bpscript). À ratifier par
> Romain (assisté de l'architecte) AVANT toute implémentation. Rien de ce document
> n'est codé.

## 1. Principe (règle `:` / `.`)

- `.` **appelle un composant** de librairie : `@tuning.western_just` référence une
  structure nommée du catalogue. Un composant se référence, ne se redéfinit pas
  (tranché Romain, hub [289]).
- `:` **pose une valeur** : `@tuning:442` pose un scalaire (diapason 442 Hz).

**Règle systémique voulue (Romain, hub [291])** : toute valeur déclarée par une
librairie chargée — présente ou **future** — est posable/overridable en scène par sa
forme `:`, avec précédence **scène > défaut de librairie**, résolue **une fois,
génériquement**. Ajouter une valeur à une librairie demain ne touche ni le parseur,
ni le moteur, ni l'hôte.

## 2. Diagnostic de l'existant (sur pièces, 2026-07-04)

| Valeur | Défaut déclaré où | Consommateur | Câblage |
|---|---|---|---|
| tempo (`@mm`/`@tempo`) | — (défaut moteur) | BPx `loadGrammar.ts:1592` (`case 'tempo'`) | bespoke |
| seed, maxitems, mode… | — | réglages moteur (BP3 settings / session BPx) | bespoke |
| contrôles (vel, chan, wave…) | `controls.json` `runtime.*` (`default`, `range`/`values`) | runtimes via `payload.params` ; validation `controlValidation.js` | registre EXISTANT, niveaux occurrence + acteur seulement |
| diapason | `tunings.json` `<tuning>.baseHz` (ex. `western_just` 440, `sargam_12TET` 240) | résolveur Kairos | **AUCUN canal scène** : `@tuning:442` parse (`Directive{value:442}`) et voyage, personne ne le lit (constat hub [289]) |
| états de drapeau (`@flag`) | — | résolus dans l'AST au parse | local par définition |

Symptôme confirmé : chaque valeur a son câblage **par-valeur** ; le trou du diapason
est structurel, pas accidentel.

Acquis réutilisables :
- Le parseur discrimine **déjà** génériquement : `@nom:NOMBRE` → `Directive.value`,
  `@nom:IDENT` → `Directive.runtime` (`parser.js:643-677`). La surface est prête.
- `controls.json` déclare **déjà** des valeurs avec `default` + domaine — le format
  de déclaration existe, il manque son extension aux autres librairies et le niveau
  scène.

## 3. Mécanisme proposé

### 3.1 Déclaration (librairies — source unique des défauts)

Section normalisée `values` admise dans **toute** librairie JSON :

```json
"values": {
  "<nom>": { "default": 440, "range": [300, 500], "unit": "Hz", "description": "…" }
}
```

Cas particulier « valeur d'axe » : une librairie d'axe (tunings) peut lier la valeur
au composant référencé — le défaut du diapason est le `baseHz` **du tuning
référencé**, pas une constante de fichier.

### 3.2 Registre (chargement — générique)

`libs.js` collecte l'union des sections `values` des librairies chargées →
`ctx.valueRegistry` (nom → spec). Une valeur ajoutée demain = **une entrée JSON**,
zéro code (même mécanique que la collecte des contrôles aujourd'hui).

### 3.3 Surface (scène)

`@<nom>:<valeur>` — parse déjà générique. **Nouvelle validation générique** (même
modèle que `controlValidation.js`) : nom ∈ registre sinon erreur claire ; valeur dans
le domaine déclaré. Les noms de directives moteur (`@mode`, `@mm`, `@seed`…) sont
**réservés** et exclus du registre (vérifié au chargement de la librairie).

### 3.4 Pliage + portage (AST → arbre)

Conformément à AST_SPEC §0.1 (« le frontend **plie la cascade statique** »), BPScript
résout la précédence **à l'émission** :

```
effectif(nom) = valeur de scène (@nom:v)  ??  défaut de librairie
```

et émet **une section canonique unique** `values: { nom → valeurEffective }` dans
l'AST. BPx la **porte opaque** dans `metadata` (un seul changement, générique pour
toujours — amendement AST_SPEC + contrat bpscript-bpx à l'appui). Aucune logique
moteur par valeur, jamais.

### 3.5 Résolution (aval)

Les consommateurs lisent `metadata.values.<nom>` :
- **Kairos** (V1) : `diapason` présent → remplace le `baseHz` du tuning référencé.
- Valeur future : le consommateur qui en a besoin la lit **par nom** ; parseur,
  émission et portage inchangés.

### 3.6 Précédence complète (cohérente avec `SOUNDS.md:263`)

```
occurrence ()  >  acteur (props)  >  scène @nom:v  >  défaut de librairie
```

V1 = niveau **scène** (le manquant). Occurrence et acteur existent déjà pour les
contrôles et restent inchangés.

### 3.7 Hors périmètre (honnêteté)

Les valeurs **interprétées par le moteur** (tempo, seed, maxitems — elles pilotent la
dérivation elle-même) gardent leur canal moteur existant. Le mécanisme générique
couvre les valeurs **portées** (opaques au moteur). Un nom ne peut pas appartenir aux
deux classes (vérifié au chargement).

## 4. Cas d'école : diapason

`@tuning.western_just` (point = composant) + `@tuning:442` (deux-points = valeur de
l'axe) dans la même scène : le tuning est résolu au catalogue, son `baseHz` 440 est
précédé par 442. La démo `tuning-ref442.bps` (inerte en silence depuis toujours)
devient la preuve e2e du chantier.

## 5. Coordination (après ratification)

| Qui | Quoi |
|---|---|
| Romain | ratifie le principe + questions §6 |
| bpx | amendement AST_SPEC (`values` en métadonnées) + portage opaque (1 fois) |
| bpscript | section `values` des libs + registre + validation + pliage + émission |
| kairos | lecture `metadata.values.diapason` dans le résolveur |
| kanopi | rien (hôte pur) |

## 6. Questions à Romain

1. **Nommage surface** : `@tuning:442` (valeur d'axe — même nom, deux formes) ou
   `@diapason:442` (nom propre au registre) ?
2. **Niveau acteur** en V1 (`@actor X … (diapason:432)`) ou différé ?
3. La **provenance** (override vs défaut) doit-elle être exposée à l'UI, ou la
   valeur effective seule suffit-elle ?
