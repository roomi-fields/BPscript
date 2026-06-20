# editor/ — Données d'éditeur du langage (source de vérité versionnée)

Données consommées par l'éditeur Kanopi pour coloration, complétion, info-bulles et validation.
Ces fichiers décrivent le **langage** (pas le moteur) : ils sont donc **versionnés ici**, contrairement
au reste de `public/` qui est ignoré par git (artefacts de build/runtime).

| Fichier | Rôle |
|---|---|
| `reference.json` | Référence du langage : directives, mots-clés, symboles, contrôles runtime/engine, **entrées de modulation**, concepts. Pilote complétion + info-bulles + aide. |
| `bpscript-lang.js` | Support CodeMirror 6 (styleTags) pour la coloration. Mapping token→style, agnostique de la forme. |

## Canonique vs runtime

- **Source de vérité = ce dossier `editor/`** (suivi par git).
- `public/help/reference.json` et `public/editor/bpscript-lang.js` sont des **miroirs runtime** (dans
  `public/`, ignoré par git). Les garder synchronisés depuis `editor/`.
- Kanopi récupère ces données **par copie de fichier** depuis le canonique (`editor/`), pas par `git pull`
  de `public/`.

## À maintenir à jour quand le langage change

- Nouveau contrôle / valeur / mot-clé → `reference.json`.
- Nouvelle **entrée de modulation** exposée par une sortie → section `modulation_inputs`
  (source des noms = le runtime qui implémente la sortie, ex. webaudio = Kanopi ; cf. `lib/modulation.json`).
- La **validation** des noms (erreur ligne/col) est faite par le transpileur
  (`src/transpiler/modulationValidation.js` + `controlValidation.js`), pas par ce fichier.

> Le parseur Lezer (`public/editor/bpscript-parser.js`) qui tokenise la grammaire pour CodeMirror est
> un artefact frontend généré, hors de ce dossier (non versionné).
