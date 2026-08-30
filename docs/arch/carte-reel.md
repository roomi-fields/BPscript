# Carte du réel — transpileur BPScript (`src/transpiler/`)

> **CE DOCUMENT SE GÉNÈRE** — `npm run carte`, appelé par le portillon. Toute édition à la
> main est écrasée à la passe suivante. Ce qui ENSEIGNE — la cible, l'écart, le jugement —
> vit dans le document d'architecture, chez Atlas, qui cite celui-ci.
## Ce qui est mesuré

- **20 modules** dans `src/transpiler/`, **15121 lignes**.
- Le **rôle** est lu dans l'en-tête de chaque fichier, verbatim — jamais interprété.
- Les **arêtes** sont les imports d'un module vers un voisin du même dossier.

## Modules

| Module | Lignes | Importe | Importé par | Rôle (lu dans l'en-tête) |
| --- | ---: | ---: | ---: | --- |
| `parser.js` | 7797 | 4 | 1 | BPScript Parser |
| `bpxAst.js` | 3279 | 8 | 1 | POSE LE DESTINATAIRE DE CHAQUE RÉGLAGE SUR LE SAC QUI LE PORTE. |
| `libs.js` | 1337 | 3 | 4 | BPScript Library Loader |
| `actorResolver.js` | 585 | 1 | 1 | BPScript Actor Resolver |
| `libs-bundle.js` | 556 | 2 | 0 | BPScript Libs Bundle Generator |
| `tokenizer.js` | 514 | 0 | 2 | BPScript Tokenizer |
| `resolution.js` | 187 | 0 | 1 | L'ÉTAGE QUI RÉSOUT — le troisième des quatre, et le seul qui n'avait pas de domicile. |
| `orderTokens.js` | 123 | 0 | 0 | — |
| `controlValidation.js` | 113 | 0 | 1 | Collecte récursivement toutes les paires de SettingBag de l'AST. |
| `segmentation.js` | 81 | 0 | 1 | LA SEGMENTATION D'UN NOM COLLÉ — plus long préfixe, glouton, sans retour arrière. |
| `syntaxe-data.js` *(généré)* | 79 | 0 | 2 | — |
| `libs-champs.js` | 78 | 0 | 2 | LES CHAMPS DE FICHIER D'UNE LIBRAIRIE — déclarés UNE FOIS, pour tous mes lecteurs. |
| `libs-bundle-check.js` | 76 | 0 | 0 | — |
| `syntaxe-bundle.mjs` | 64 | 0 | 0 | GÉNÉRATEUR DE LA PORTE DU SCHÉMA DE SYNTAXE. |
| `libs-data.js` *(généré)* | 60 | 0 | 3 | — |
| `gabarits-bundle.mjs` | 57 | 0 | 0 | GÉNÉRATEUR DE LA PORTE DES GABARITS DE RÉGLAGES NATIFS. |
| `libs-types.js` | 56 | 1 | 0 | GÉNÉRATEUR DU TYPE DU PAQUET — `libs-data.d.ts`. |
| `index.js` | 38 | 2 | 1 | BPScript Transpiler — Façade |
| `constants.js` | 33 | 0 | 1 | BPScript — constantes partagées transpileur |
| `gabarits-data.js` *(généré)* | 8 | 0 | 0 | — |

## Flux réel

```mermaid
flowchart LR
  actorResolver_js["actorResolver.js"]
  bpxAst_js["bpxAst.js"]
  constants_js["constants.js"]
  controlValidation_js["controlValidation.js"]
  gabarits_bundle_mjs["gabarits-bundle.mjs"]
  gabarits_data_js["gabarits-data.js"]
  index_js["index.js"]
  libs_bundle_check_js["libs-bundle-check.js"]
  libs_bundle_js["libs-bundle.js"]
  libs_champs_js["libs-champs.js"]
  libs_data_js["libs-data.js"]
  libs_types_js["libs-types.js"]
  libs_js["libs.js"]
  orderTokens_js["orderTokens.js"]
  parser_js["parser.js"]
  resolution_js["resolution.js"]
  segmentation_js["segmentation.js"]
  syntaxe_bundle_mjs["syntaxe-bundle.mjs"]
  syntaxe_data_js["syntaxe-data.js"]
  tokenizer_js["tokenizer.js"]
  actorResolver_js --> libs_js
  bpxAst_js --> tokenizer_js
  bpxAst_js --> parser_js
  bpxAst_js --> resolution_js
  bpxAst_js --> libs_js
  bpxAst_js --> libs_data_js
  bpxAst_js --> segmentation_js
  bpxAst_js --> actorResolver_js
  bpxAst_js --> controlValidation_js
  index_js --> bpxAst_js
  index_js --> libs_js
  libs_bundle_js --> libs_champs_js
  libs_bundle_js --> index_js
  libs_types_js --> libs_data_js
  libs_js --> libs_data_js
  libs_js --> syntaxe_data_js
  libs_js --> libs_champs_js
  parser_js --> tokenizer_js
  parser_js --> libs_js
  parser_js --> constants_js
  parser_js --> syntaxe_data_js
```

## Ce que la mesure trouve

- **Cycles d'import** : 0.
- **Modules sans aucune arête** : 5 — `gabarits-bundle.mjs`, `gabarits-data.js`, `libs-bundle-check.js`, `orderTokens.js`, `syntaxe-bundle.mjs`.
  Un module sans arête dans ce dossier n'est pas mort : il peut être un point d'entrée, ou
  être importé depuis `test/`, `scripts/` ou par un voisin. La mesure porte sur CE dossier.
- **Modules générés** : 3 — `gabarits-data.js`, `libs-data.js`, `syntaxe-data.js`.

