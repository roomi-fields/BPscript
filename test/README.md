# Test Infrastructure

## Prérequis

Compiler le moteur avec `build.sh` dans `bp3-engine/` (voir README principal).
Les tests nécessitent `--bin <tag>` pour spécifier la version du moteur.

```bash
# Utiliser la dernière version archivée
node test/test_all.cjs --bin last

# Utiliser une version spécifique
node test/test_all.cjs --bin v3.3.19-wasm.1
```

## Stages

> **Oracle = bp3 natif Linux** (décision `hub/decisions/2026-06-14-oracle-natif-trois-voies.md`).
> Le générateur aléatoire de Windows a été porté dans le moteur (`bp3_random.c`, RNG_PORTABLE
> RÉSOLU) → le natif reproduit bp.exe, **plus besoin de Windows**. S0 a été recâblé sur le natif
> (2026-06-14). Le **WASM est en retrait** : ce n'est plus le moteur (c'est BPx) ni l'oracle
> cible. Transition en cours : le dump timed-tokens natif est à porter (ordre moteur) ; d'ici là
> S2/S3 restent produits par le WASM (gelés). Cible : 3 voies — oracle natif + `.gr`→BPx + `.bps`→BPx.

| Stage | Script | Source | Produit |
|-------|--------|--------|---------|
| S0 | `s0_snapshot.cjs` | **bp3 natif** (ex bp.exe Windows ; recâblé 2026-06-14) | Référence MIDI/TEXT (fichier `s0_php.json`, nom hérité) |
| S1 | `s1_native.cjs` | bp3 (Linux natif) | MIDI/TEXT natif GCC |
| S2 | `s2_wasm_orig.cjs` | bp3.wasm | MIDI events depuis PlayBuffer1 |
| S3 | `s2_wasm_orig.cjs` | bp3.wasm | Timed tokens depuis p_Instance |
| S4 | `s4_wasm_silent.cjs` | bp3.wasm + silent.al | Timed tokens avec silent sound objects |
| S5 | `s5_bpscript.cjs` | transpiler + bp3.wasm | Pipeline BPscript complet (.bps → tokens) |

S2 et S3 sont produits par le même script (`s2_wasm_orig.cjs`).
S2 = MIDI events (comme le natif). S3 = timed tokens (lecture directe de p_Instance).

## Scripts

### Batch
- `test_all.cjs` — Lance S1 + S2/S3 + S4 + S5 + comparaisons sur les grammaires actives
- `run_s5_all.cjs` — Lance S5 sur toutes les grammaires actives

### Par grammaire
```bash
node test/s1_native.cjs drum --bin last
node test/s4_wasm_silent.cjs drum --bin last
node test/s5_bpscript.cjs drum --bin last
```

### Comparaisons
- `compare_s1_s2.cjs` — Compare snapshots S1 et S2 (token names, timing tolerance)
- `compare_s2_s3.cjs` — Compare snapshots S2 et S3
- `compare_s4_s5.cjs` — Compare snapshots S4 et S5

## Grammaires

`grammars/grammars.json` est le registre : 111 entrées (110 grammaires + le placeholder
`_comment`). Seules les `active` entrent dans les suites batch (`test_all`, `run_s5_all`) —
**ne jamais itérer les dossiers directement**.

### Statuts valides (`status`)

| Statut | Sens | Effet harnais |
|---|---|---|
| `active` | baseline native + pipeline complet | testée par toutes les suites batch |
| `to_be_tested` | pas encore triée ou baseline partielle | ignorée par les suites, testable à la main |
| `excluded` | hors baseline — `reason` **datée obligatoire** | refusée par s1_native, ignorée partout |
| `skip` | active sur le papier mais fichiers manquants (ex. bells) | sautée |
| `partial` | transposition BPscript partielle (ex. dhadhatite_v2) | hors suites |

### Champs

- `bernard` : nom du fichier original (`-gr.<bernard>` dans `bp3-engine/test-data/`)
- `production_mode` : `midi` ou `text` (pilote S1/S2/S5)
- `aux` : fichiers auxiliaires nécessaires (`se`, `al`, `to`)
- `php_ref` : configuration pour S0 (référence PHP) ; `php_ref.blocked` = motif texte quand
  bp.exe ne produit pas (constat S0, distinct du `status`)
- `features` : tags (`sub:N`, `poly:N`, `improvize`, etc.)
- `reason` : motif d'exclusion — **toujours daté** (`Exclusion datée YYYY-MM-DD` ou
  `[constat YYYY-MM-DD]`)
- `note` : commentaire libre daté (récupérations, promotions, caveats)
- `scene_bps` : `true` si un `scene.bps` existe alors que le statut ne l'implique pas
- `trou_langage` : construct BP3 non représentable en BPscript (bp3ToScene émet NON GÉRÉ) —
  ex. templates BP2 en LHS, opérateurs tempo `/N`, `_&`
- `s1_args` : arguments supplémentaires pour le run natif S1
- `s4s5_skip` / `s3s4_skip` : exclusions motivées d'une comparaison précise
- `c4key` : convention d'octave de la grammaire (ex. 48)

Chaque grammaire a un répertoire `grammars/{name}/` contenant :
- `original.gr` — Grammaire BP3 originale (Bernard)
- `silent.gr` — Grammaire avec alphabet silent (pour S4)
- `silent.al` — Alphabet silent sound objects
- `scene.bps` — Source BPscript (pour S5)
- `status.json` — état par grammaire (dates, notes de validation)
- `snapshots/` — Résultats JSON de chaque stage

L'état de couverture (qui a une baseline, qui a une scène) : `grammars/BASELINE_COVERAGE.md`.

## resolve_bin.cjs

Module partagé par tous les scripts. `--bin` est obligatoire.

- `--bin last` : lit le tag depuis `bp3-engine/builds/LAST`
- `--bin v3.3.19-wasm.1` : version explicite
- Cherche d'abord le submodule `BPscript/bp3-engine/builds/`, puis le sibling `../bp3-engine/builds/`

## Résultats

- `RESULTATS.md` — Scores détaillés par stage et par grammaire
- Registre Bernard : déplacé dans la tour de contrôle (`/home/romi/dev/bp/hub/courrier/bernard.md`)
