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

### Format du corps — point à coordonner (Kairos = runtime)
Le `body` est du **TS** transpilé au load. Deux options, à trancher avec Kairos (qui tient la
transpilation/bac-à-sable) et Romain :
- **(F1) `.ts` authored + bundlé** : l'auteur écrit un module `.ts` typé contre le SDK ; un bundle
  (miroir de `src/transpiler/libs-bundle.js`) le transpile et l'enregistre. Donne le **typage réel à
  l'écriture** (le SDK est importé), au prix d'une étape de build.
- **(F2) code-en-chaîne dans le JSON** : `body` est une chaîne TS ; transpilée au load. Aligné sur le
  bundle JSON actuel, mais **pas de typage à l'écriture** (juste un contrat de signature).
Recommandation : **F1 pour le jeu FOURNI + les libs perso** (le typage contre le SDK est tout l'intérêt
du « vrai code TS manipulable »), F2 toléré pour des bouts simples. À valider.

## 3. Le SDK — frontière de typage (défini PAR Kairos, référencé par moi)

Le **SDK** = les types du **contexte Kairos** que l'auteur d'une fonction cible. Kairos en est
propriétaire (il possède la résolution) ; mon rôle est de définir comment l'entrée de lib **déclare sa
signature** et **importe/cible** ce SDK.

Surface PROPOSÉE (à confirmer/définir par Kairos) — une fonction de hauteur reçoit un contexte typé
exposant la **hauteur canonique** + ses params, et renvoie une hauteur transformée :

```ts
// fourni par Kairos (le runtime), importé par l'auteur de fonction
export interface PitchCtx {
  readonly degreeIndex: number;     // degré dans l'alphabet
  readonly step: number;            // pas sur la grille du tempérament
  readonly register: number;        // registre/période
  // … helpers déterministes exposés par Kairos (grid, period, degrés…)
}
// l'auteur écrit :
export default (ctx: PitchCtx, p: { steps: number }) => ({ ...ctx, step: ctx.step + p.steps });
```

Pureté/déterminisme exigés (rejouable, embarquable, pas d'I/O ni d'aléatoire non-graine).

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

## 6. Points ouverts (à trancher avec Romain / Kairos)

1. **Format du corps** : F1 (`.ts` bundlé, typé) vs F2 (chaîne dans le JSON). §2.
2. **Types exacts du SDK** : appartiennent à Kairos (§3) — coordination en cours.
3. **Syntaxe d'application côté scène** : hors PAS 3 (transpose passe déjà par `controls`/`[]`) ; à
   confirmer que l'application réutilise le câblage existant.
