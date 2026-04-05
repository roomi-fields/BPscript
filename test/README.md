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

| Stage | Script | Source | Produit |
|-------|--------|--------|---------|
| S0 | `s0_snapshot.cjs` | bp.exe (Windows) | Référence MIDI/TEXT via PHP |
| S1 | `s1_native.cjs` | bp3 (Linux natif) | MIDI/TEXT natif GCC |
| S2 | `s2_wasm_orig.cjs` | bp3.wasm | MIDI events depuis PlayBuffer1 |
| S3 | `s2_wasm_orig.cjs` | bp3.wasm | Timed tokens depuis p_Instance |
| S4 | `s4_wasm_silent.cjs` | bp3.wasm + silent.al | Timed tokens avec silent sound objects |
| S5 | `s5_bpscript.cjs` | transpiler + bp3.wasm | Pipeline BPscript complet (.bps → tokens) |

S2 et S3 sont produits par le même script (`s2_wasm_orig.cjs`).
S2 = MIDI events (comme le natif). S3 = timed tokens (lecture directe de p_Instance).

## Scripts

### Batch
- `test_all.cjs` — Lance S1 + S2/S3 + comparaisons S1vsS2 et S2vsS3 sur les 36 grammaires actives
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

36 grammaires actives définies dans `grammars/grammars.json`.

Champs principaux :
- `status` : `active`, `skip`, `excluded`, `to_be_tested`
- `production_mode` : `midi` ou `text`
- `aux` : fichiers auxiliaires nécessaires (`se`, `al`, `to`)
- `php_ref` : configuration pour S0 (référence PHP)
- `features` : tags (`sub:N`, `poly:N`, `improvize`, etc.)

Chaque grammaire a un répertoire `grammars/{name}/` contenant :
- `original.gr` — Grammaire BP3 originale (Bernard)
- `silent.gr` — Grammaire avec alphabet silent (pour S4)
- `silent.al` — Alphabet silent sound objects
- `scene.bps` — Source BPscript (pour S5)
- `snapshots/` — Résultats JSON de chaque stage

## resolve_bin.cjs

Module partagé par tous les scripts. `--bin` est obligatoire.

- `--bin last` : lit le tag depuis `bp3-engine/builds/LAST`
- `--bin v3.3.19-wasm.1` : version explicite
- Cherche d'abord le submodule `BPscript/bp3-engine/builds/`, puis le sibling `../bp3-engine/builds/`

## Résultats

- `RESULTATS.md` — Scores détaillés par stage et par grammaire
- `FEEDBACK_BERNARD.md` — Points ouverts signalés à Bernard
