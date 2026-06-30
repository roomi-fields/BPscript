# BPScript — Fonctions digitales (manipulations) — Design (DRAFT, à valider Romain)

## Date : 2026-06-30 · Statut : **BROUILLON** (PAS 3 du chantier « manipulations digitales »)

> Spec partagée BPScript ↔ Kairos. **Mon côté (BPScript)** : la FORME de lib + le chargement +
> l'authoring/typage. **Côté Kairos** : le runtime (transpilation/bac-à-sable/exécution) + l'API
> de contexte (les types du SDK). La frontière est en §4. Rien n'est implémenté — spec d'abord.
> Décision Romain (2026-06-30, via architecte [202]) : le comportement = **vrai code TS** évalué en
> interne (pas un pattern déclaratif), déterministe, embarqué navigateur (TS→JS au load).

## 1. Concept — le jumeau DIGITAL de l'objet CV

La cartographie (PAS 1) a révélé une symétrie qu'on exploite ici : une fonction digitale est le
**jumeau digital de l'objet CV**.

| Aspect | objet CV (analogique) | fonction digitale |
|---|---|---|
| Ce qu'est le comportement | courbe **déclarative** (donnée : `curve.segments`) | **vrai code TS** |
| Réalisé par | runtime **audio** (calcule le signal) | **Kairos** (exécute le code à la résolution) |
| Cible | un **signal** | la **hauteur canonique** (puis d'autres valeurs) |
| Forme de lib | `{type:'cv', objects:{adsr:{parameters,input,output,curve}}}` | `{type:'digital', objects:{transpose:{params,body}}}` |

Source du jumeau analogique : `lib/mod.json` (`{type:'cv', objects:{adsr,lfo,ramp}}`), `docs/design/CV.md`.
Première fonction visée : `transpose` (décalage de N pas de grille) ; puis `register_shift` (décalage
de N périodes/registres). Aujourd'hui `transpose` est DÉCLARÉ dans `lib/controls.json`
(`{args:["steps"], "grid shift of N steps in the temperament"}`) mais sa sémantique est **codée en
dur côté Kairos** (`resoudre-hauteur.ts:88` `resolveTransposed`) — c'est précisément ce qu'on
remplace par une **application de lib**.

## 2. La forme de lib (mon côté)

Une librairie de fonctions digitales suit la structure de `lib/mod.json`, `type:'digital'` :

```jsonc
{
  "name": "pitch",          // espace de noms de la lib
  "type": "digital",        // discriminant (cf. cv) — consommé par le chargeur + Kairos
  "objects": {
    "transpose": {
      "params": {           // SIGNATURE typée — même grammaire que CV `parameters`
        "steps": { "type": "int", "default": 0, "description": "Décalage en pas de grille" }
      },
      "body": "…code TS…"   // CORPS : vrai code TS, typé contre le SDK (§3)
    }
  }
}
```

- `params` réutilise la convention de typage des paramètres CV (`{unit|type, range, default, description}`,
  cf. `lib/mod.json` adsr/lfo). C'est la **signature** que la scène renseigne (`transpose(steps:2)`).
- `body` = le code TS de la transformation. Pur, déterministe, synchrone (chemin chaud : un appel par
  note à la résolution). Il cible le **SDK** (§3).

### Format du corps — RÉCONCILIÉ avec le runtime Kairos
Kairos transpile le **TS source au CHARGEMENT** de la lib (cache par lib, clé = provenance+version+hash
source ; KAI-B03 §1). Donc la lib **transporte du TS SOURCE** (texte). Les deux « formats » que j'avais
opposés (F1/F2) ne s'opposent PAS — ils se composent :
- **Authoring** : l'auteur écrit un module `.ts` **typé contre le SDK** (`DigitalFnContext`, fourni par
  Kairos) → typage réel à l'écriture (tout l'intérêt du « vrai code TS manipulable »).
- **Stockage/chargement** : un bundle (miroir de `src/transpiler/libs-bundle.js`) capte le **TS source**
  dans la lib (registre `libs-data.js`) ; Kairos le transpile au load.
→ Typage à l'écriture **ET** mécanisme de bundle existant. (Le détail du build = PAS 4.)

## 3. Le SDK — le contexte Kairos (ALIGNÉ avec KAI-B03)

Le **SDK** = les types du **contexte Kairos** que l'auteur d'une fonction cible. Kairos en est
propriétaire (il possède la résolution). Le contexte est défini dans `kairos/docs/KAI-B03-runtime-
fonctions-digitales.md §2` : `DigitalFnContext { target, models, params }` — `target` = vue
LECTURE/ÉCRITURE des facettes NON-temporelles du terminal (hauteur en COORDONNÉES canoniques
`step`/`register`/`degreeIndex`, vélocité, canal, contrôles) ; `models` = tempérament/accordage/
alphabet/registres en LECTURE SEULE ; `params` = les arguments de l'appel (`transpose:2 → {steps:2}`).

**Signature (contrat partagé — SCELLÉE, Romain GO [207])** : `(ctx: DigitalFnContext) => void` — la
fonction **modifie `ctx.target`** (PAS un retour de `Partial`). Raison du fond (mutation > pure-return) :
l'enveloppe `{target, models, params}` est **extensible en v2** à un nœud/sous-arbre sans changer la
forme ; la mutation de `target` passe à l'échelle de cette v2, là où un `Partial<TerminalView>` ne le
ferait pas. Elle gère aussi proprement l'écriture **multi-facettes** (hauteur + vélocité + canal). Reste
**déterministe/mémoïsable** (snapshot des facettes d'entrée ; aucun I/O/horloge/aléa).

> **INVARIANT COPIE (SCELLÉ, Romain [207]) — à respecter par les deux côtés.** La fonction modifie une
> **COPIE** des facettes que Kairos prépare et lui passe (`ctx.target`), **JAMAIS l'arbre réel par
> référence**. **KAIROS SEUL** applique le résultat de la copie à la sortie canonique (`content.pitch`…).
> Raison : Kairos est l'**autorité d'écriture de l'arbre** ; le code de lib (3 provenances, dont
> **perso/communautaire**) est **NON FIABLE** — la copie **protège l'arbre** (un code fautif n'altère
> jamais l'arbre réel) et **garantit le déterminisme/la mémoïsation** (le snapshot d'entrée est la clé,
> la copie l'isole). « `mutation in-place` » = mutation **de la copie**, pas de l'arbre.

```ts
// l'auteur écrit, typé contre le SDK de Kairos (DigitalFnContext) :
export default (ctx: DigitalFnContext): void => {
  ctx.target.pitch!.step += Number(ctx.params.steps);   // transpose = décalage de grille
};
```

Pureté/déterminisme exigés (rejouable, embarquable, pas d'I/O ni d'aléatoire non-graine).
**Général, pas hauteur-only** : `target` porte aussi vélocité/canal/contrôles → `accent`, routage, etc.
(la hauteur est le premier cas, pas le seul).

## 4. Frontière BPScript ↔ Kairos (résumé)

| Côté | Responsabilité |
|---|---|
| **BPScript (moi)** | forme de lib `{nom, type:'digital', objects:{nom:{params, body}}}` ; chargement par le **mécanisme existant** (bundle → `registry` → `loadLib` via `@directive` ; 3-provenances via `registerLib`, `libs.js:32-45`) ; convention de signature des params (jumelle CV) ; authoring/typage contre le SDK |
| **Kairos** | runtime : transpilation TS→JS au load (esbuild-wasm/sucrase), bac-à-sable, exécution déterministe ; **API/contexte** (les types concrets du SDK) ; application de la fonction à la hauteur (remplace le `resolveTransposed` codé en dur, `resoudre-hauteur.ts:88`) |

## 5. Chargement — réutilise l'existant (zéro infra neuve)

- La lib vit dans un fichier (ex. `lib/pitch.json` ou `lib/digital.json`), pré-bundlé dans
  `src/transpiler/libs-data.js` (généré par `src/transpiler/libs-bundle.js`), auto-enregistré au load
  (`libs.js:21,58`).
- Chargée par `@directive` via `loadLib(name, subkey)` (`libs.js:86-102`).
- **3 provenances** (fournie lecture-seule / perso / communautaire) : l'hôte injecte/surcharge via
  `registerLib`/`registerAll` (`libs.js:32-45`, commentaire `libs.js:14-15`). Conforme à la décision
  `hub/decisions/2026-06-29-tout-par-librairies.md` (l'hôte FOURNIT, Kairos RÉSOUT).

## 6. Alignement avec Kairos (KAI-B03) — SCELLÉ (Romain GO [207]) vs PAS 4

**Scellé (frontière emboîtée, validée Romain [207])** :
- **Signature** = `(ctx: DigitalFnContext) => void`, la fonction modifie `ctx.target` (§3). Convergée
  avec Kairos (meilleure pour la v2 arbre/sous-arbre + multi-facettes).
- **Invariant COPIE** : la fonction modifie une COPIE préparée par Kairos, jamais l'arbre réel ; Kairos
  SEUL applique le résultat (autorité d'écriture + code de lib non fiable). Détail §3.
- **SDK** = `DigitalFnContext` de Kairos (KAI-B03 §2) ; ma forme de lib le cible.
- **Vrai code TS, pas compo de primitives** : les `models` (lecture seule) + helpers du sandbox sont
  DISPONIBLES au code TS libre ; la fonction n'est PAS restreinte à composer des primitives. Ma
  proposition antérieure « compo de primitives » est **superséquée** par la décision Romain.
- **Nom** : le nom déclaré (clé `objects` de la lib) = la référence de scène = porté **verbatim/opaque**
  par BPx = **clé de résolution** dans la lib FOURNIE (KAI-B03 §3). Confirmé.
- **Format du corps** : authoring `.ts` typé + bundle source-texte (§2) — composé, plus un either/or.

**PAS 4 (implémentation, après relecture courte archi)** :
- Transpileur navigateur tranché : **sucrase** (strip de types au load), repli esbuild-wasm — côté Kairos.
- Jeu minimal de **helpers** offerts dans le sandbox (navigation de grille, conversions de registre) —
  côté Kairos.
- **Migration de `transpose`** : aujourd'hui déclaré dans `lib/controls.json` (`{args:[steps]}`) ; la
  lib digitale devient autorité du **comportement** (corps TS). La surface de scène (`transpose(steps:2)`)
  réutilise le câblage de contrôle existant — à confirmer en PAS 4.
