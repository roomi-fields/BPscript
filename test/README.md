# Tests — comment lancer la non-régression

## La commande

```bash
npm run arch        # garde structurelle (dépendances) + fraîcheur du bundle de librairies
npm run typecheck   # types des librairies digital/homomorphism
npm run verify      # conformité AST_SPEC de tout le corpus + émission des opérateurs de tempo
```

**C'est le portillon.** Il est branché sur `pre-push` (`.git/hooks/pre-push`) : un push est refusé
si l'une des trois mord. Ce n'est pas une convention, c'est mécanique — inutile de se demander si
on a « pensé à lancer les tests ».

Deux suites complètent le portillon, à lancer à la main quand on touche à leur surface :

```bash
node test/scan_corpus.mjs        # aller-retour BP3 → BPScript → BP3 sur le corpus (13 FIDÈLE)
node test/test_bp3_to_scene.cjs  # convertisseur BP3 → scène
node test/voie_b_status.mjs      # comparaison à la baseline native, en sortie de chaîne
```

## Ce que mesure `voie_b_status.mjs`

La chaîne **complète** : `.bps` → `compileBPS` → BPx (dérivation) → **Kairos** (hauteur) →
**Kronos** (temps), confrontée à la baseline native de `bp3-engine/baseline-native/`.

⚠️ On ne mesure ni ne classe **rien** avant Kairos et Kronos. Mesurer en sortie de BPx est
pré-résolution : ni la hauteur ni le temps n'y sont résolus, et les comptes qu'on en tire sont
ininterprétables. C'est un piège qui a coûté plusieurs semaines de chiffres faux.

L'outil imprime sa progression sur la sortie d'erreur, une ligne par grammaire : une exécution
lente et une exécution **bloquée** ne doivent pas se ressembler.

## Les instantanés `grammars/*/snapshots/`

Les fichiers `s1_native.json` et `s3_native.json` sont de la **donnée d'oracle** capturée depuis le
moteur natif. Les scripts qui les produisaient ont été retirés (voir ci-dessous) — **les données,
elles, restent vivantes** et sont consommées par `order_parity.mjs` et `iso_chromashift_12tet.mjs`.
Un `grep s3_native` attrape les deux ensemble : ne pas les confondre.

### Ce qui reste ici est NOMMÉ, et rien d'autre n'y a sa place (purge du 2026-07-20)

Le préfixe `sN_` fait croire que tout ce dossier appartient au protocole S0-S5 abandonné. C'est faux
pour trois fichiers, et c'était vrai pour tous les autres. Après purge, il ne reste QUE ceci :

| Fichier | Lecteur vivant | Ce qu'il prouve |
|---|---|---|
| `s3_timed.json` (50) | `order_parity.mjs:160` | oracle WASM gelé de la parité texte ordre-à-ordre |
| `s3_native.json` (55) | `order_parity.mjs:175` | ordre natif de référence (posé par `--write`) |
| `transposition1/s1_native.json` | `iso_chromashift_12tet.mjs:88` | oracle du décalage chromatique 12-TET |

**Toute autre famille a été supprimée** (`ARCHIVE_*`, `s2_*`, `s5_*`, les `s1_*` des autres
grammaires, et les variantes `.wasm18`) : 703 fichiers, aucun lecteur. La décision datée
`hub/decisions/2026-07-18-procedure-test-suivi-normee-113-modalite.md` a retiré la parité par étapes
des critères — le seul critère est `original == A == B` en sortie de chaîne. Ces instantanés ne
prouvaient donc plus rien, tout en **ressemblant** à une mesure en vigueur.

⚠️ Le nom ne dit pas l'usage : trois fichiers en `sN_` servent un critère en vigueur, tous les autres
étaient des vestiges. Avant d'ajouter ou de supprimer ici, **retrouver le lecteur**, ne pas se fier
au préfixe.

## Retiré le 2026-07-19 — l'ancien pipeline S0-S5

Les étapes `s0_snapshot` … `s5_bpscript`, leurs comparateurs `compare_sN_sM`, leurs orchestrateurs
`runner.cjs` / `test_all.cjs` / `report.cjs` et leurs deux documents (`PROCEDURE.md`,
`RESULTATS.md`) ont été **supprimés**. C'était la procédure de test de l'ancienne version de
BPScript, remplacée par la reconstruction ci-dessus.

Ils n'étaient invoqués par **rien** de vivant — le portillon `pre-push` ne lance que `arch`,
`typecheck` et `verify` — mais ils restaient consultables, et on les a pris pour la procédure
courante. C'est le sens du retrait : de l'obsolète encore présent n'est pas neutre, il est lu et
il induit en erreur (charte `hub/decisions/2026-07-19-purge-obsolete-charte.md`).
