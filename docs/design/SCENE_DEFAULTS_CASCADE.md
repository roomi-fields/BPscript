# Cascade de défauts de scène — principe fondateur

> **Statut : 🔶 CONTRAT (ratification Romain « ok vas y » 2026-07-04).** Principe FONDATEUR,
> universel. Origine : bug SCENE_VALUES (kairos [308]) — révélateur d'une absence de cascade.

## Principe (fondateur, universel)

**Tout ce qu'une scène peut définir a un défaut, et ce défaut vit dans une librairie — jamais
dans le code.** Une lib de base (**@core**) est la racine : elle fixe *quels* composants/valeurs
sont les défauts de scène. Toute déclaration d'une scène (alphabet, accordage, tempérament,
diapason, octaves, transport, tempo, son, contrôle…) est un **override d'un défaut toujours
présent** dans le cascade.

Conséquences (non négociables) :
- **Zéro valeur codée en dur.** Pas de `'audio'`, pas de `440`, pas de liste `['tunings']` dans le
  code. Tout défaut est une donnée de lib.
- **Toujours une valeur en portée.** Un paramètre définissable n'est jamais « inexistant » : @core
  lui donne un défaut. Donc un override le **recouvre** (placé dans l'arbre), il ne disparaît jamais
  en silence (loi « rien ne disparaît »).
- **Override d'un paramètre SANS défaut déclaré nulle part → erreur claire** (le seul cas d'erreur).

## Modèle : MULTI-NIVEAU — @core porte TOUTES les valeurs, les libs overrident (Romain 2026-07-04)

- **@core porte lui-même TOUTES les valeurs par défaut** (le socle) : diapason, transport, tempo,
  l'alphabet/accordage/octaves par défaut… chacune avec sa valeur ET son domaine de validation.
- **Une librairie invoquée OVERRIDE le défaut @core** : invoquer `@tuning.sargam_12TET` fait que son
  champ `diapason:240` recouvre le `440` de @core. Invoquer `@alphabet.X` recouvre l'octavation, etc.
- **Puis scène → acteur → occurrence** overrident. C'est un cascade **multi-niveau** dont @core est
  le socle universel (jamais vide).

## Cascade de résolution (par paramètre) — 5 niveaux

```
@core (socle, TOUTES les valeurs)  →  lib invoquée (override)  →  directive de scène
   →  acteur  →  occurrence
```
Le plus fin gagne ; le socle @core est toujours présent (aucun paramètre n'est « inexistant »). Le
frontend **plie** la cascade STATIQUE (niveaux 1-4) dans la déclaration d'acteur (AST_SPEC §0.1) ;
l'occurrence (niveau 5) reste par-nœud (`payload.params`). L'arbre porte l'**effectif** — l'aval
(Kairos) le lit, **sans aucun défaut en dur** (le `?? 440` de Kairos disparaît).

## Schéma @core (`lib/core.json`)

@core porte les valeurs ET leur spec (domaine). Un `overriddenBy` optionnel dit quel CHAMP d'une lib
invoquée recouvre le défaut (le mécanisme reste générique) :

```json
"values": {
  "diapason":  { "default": 440, "range": [16, 8000], "unit": "Hz", "overriddenBy": "tuning.diapason" },
  "transport": { "default": "audio" },
  "tempo":     { "default": 120, "range": [1, 1000] },
  "alphabet":  { "default": "western" },
  "tuning":    { "default": "western_12TET" },
  "octaves":   { "default": "western" }
}
```
@core est TOUJOURS chargé (racine, comme `settings`/`modulation`). `overriddenBy: "tuning.diapason"`
= « si un accordage est invoqué, son champ `diapason` recouvre ce défaut » — donnée, pas code.

## Migration des hardcodes (à éliminer)

| Hardcode actuel | Devient |
|---|---|
| `DEFAULT_ACTOR_TRANSPORT='audio'` (bpxAst.js) | `@core.defaults.transport` |
| diapason défaut = `A4freq:440` (settings) + `?? 440` (Kairos) épars | `@core.defaults.tuning`.diapason |
| `['tunings']` en dur au registre (retiré) | libs invoquées + composants @core |

## Résolution du registre de valeurs (générique)

Le registre des valeurs overridables = union des sections `values` des libs **invoquées** + des
**composants par défaut @core** (donc `tunings.json` est invoqué via le défaut d'accordage → `diapason`
toujours connu). Aucune liste en dur : on itère `@core.defaults` et les directives de la scène.

## Coordination

| Qui | Quoi |
|---|---|
| Romain | ratifie le principe + le schéma @core |
| bpscript | @core.defaults + résolveur de cascade générique + retrait des hardcodes bpscript |
| kairos | retrait du `?? 440` → lit l'effectif du cascade (via l'arbre) |
| atlas | si le principe monte en loi de constitution |

## Séquencement

1. Établir le mécanisme générique + @core.defaults, prouvé sur **diapason** (le bug) et **transport**
   (les 2 hardcodes vivants). 2. Étendre aux autres axes (octaves, tempo…) — 1 ligne @core.defaults
   chacun. 3. Coordonner Kairos (retrait `?? 440`). Chaque étape : compile + dérive + oracle vert.
