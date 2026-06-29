# Garde d'architecture — transpileur BPScript (preuve qu'il mord)

> Le garde branche les **lois STRUCTURELLES** (qui dépend de qui, sens des flux, pas de cycle)
> dans dependency-cruiser. Le sémantique reste la relecture de Romain. **Proposé, non branché**
> au gate tant que non ratifié. Config : `docs/arch/garde.cjs` (à promouvoir en
> `.dependency-cruiser.cjs` + script `arch` une fois ratifié). Node 20+ requis.

## Lois encodées

| Règle | Sens | Statut code |
|---|---|---|
| `no-circular` | aucune dépendance circulaire | respecté (0 cycle) |
| `bpx-clean-no-bp3` | `bpxAst.js` ne dépend pas de `encoder`/`prototypes`/`orderTokens` (BPx-only) | respecté |
| `core-no-tooling` | le cœur (frontal+résolution+encoder) n'importe pas les scripts CLI/test | respecté |

## Commande proposée

```jsonc
// package.json
"scripts": { "arch": "depcruise \"src/transpiler/**/*.js\" --config .dependency-cruiser.cjs" }
```

## Preuve qu'il mord (3 sorties)

**1) Vert — code actuel :**
```
✔ no dependency violations found (25 modules, 52 dependencies cruised)
exit=0
```

**2) Injection d'une vraie divergence** (`bpxAst.js` importe `encoder.js`, viole BPx-only) :
```
error bpx-clean-no-bp3: src/transpiler/bpxAst.js → src/transpiler/encoder.js
x 1 dependency violations (1 errors, 0 warnings). 25 modules, 53 dependencies cruised.
exit=1
```

**3) Retrait → re-vert :**
```
✔ no dependency violations found (25 modules, 52 dependencies cruised)
exit=0
```

Fichier `bpxAst.js` restauré à l'identique (aucun diff git). Le garde **capture** une nouvelle
divergence à la frontière BPx-only (exit≠0), donc il protège l'assainissement contre la rechute.
