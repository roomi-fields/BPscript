# Confrontation carte ↔ contrat — transpileur BPScript

> Liste des écarts entre **ce qui EST** (`carte-reel.md`) et **ce qui DOIT être**
> (`contrat-DRAFT.md` + étalon `hub/contrats/bpscript-bpx.md`). L'agent **liste** ;
> l'architecte inscrit le backlog ; Romain tranche le sémantique. 2026-06-29.

## A. Conformité à l'étalon `bpscript-bpx.md` (frontière BPx)

| Point étalon | État dans le code | Verdict |
|---|---|---|
| Source unique (zéro table parallèle) | `bpxAst.js:180` renvoie `{ ast, errors, warnings }` | ✅ conforme |
| AST agnostique (aucune notion BP3) | voie `bpxAst` ne touche pas `encoder/proto/orderTokens` | ✅ conforme (gardé) |
| `homomorphisms`, `TempoOp.scope`, seed, mode | nœuds présents (parser/encoder) | ⚠️ conformité de CONTENU = tests/Romain, hors carto structurelle |

**La frontière structurelle est conforme.** Les points de CONTENU (forme exacte des nœuds) relèvent
de la relecture sémantique + des oracles `test/grammars/`, pas de cette cartographie.

## B. Écarts STRUCTURELS / dérives de doc (→ backlog architecte)

| # | Écart | Pièce | Nature | Prio proposée |
|---|---|---|---|---|
| E1 | En-tête `index.js:7` décrit `compileToBPxAST → {ast, backticks, flagStates, libraries}` ; la sortie réelle est `{ast, errors, warnings}` | `index.js:7` vs `bpxAst.js:180` | dérive doc-dans-code (le code tranche) | basse, rapide |
| E2 | `orderTokens.js` : module **pendant** (aucun importeur dans le dépôt) | `orderTokens.js` | code mort résiduel OU consommé hors-dépôt | moyenne — **à confirmer** |
| E3 | `bp3ToScene.js` (1954 L) : île, atteinte seulement par tests | `bp3ToScene.js` | attendu (sens inverse) ; placement à documenter | basse |
| E4 | `constants.js` partagé parser↔encoder → flèche `SORTIE_BP3 → FRONTAL` | `constants.js` | placement de l'infra partagée | basse |
| E5 | Garde non branché au gate ; pas de script `arch` ; Node 18 par défaut (20+ requis) | `package.json` | infra de garde absente | moyenne |

## C. À ESCALADER à Romain (sémantique du langage — pas du code)

- **E2 `orderTokens` garder/retirer** : touche la **voie texte** (production canonique « par ordre »
  partagée avec le runtime texte Kanopi). Retirer du dépôt ou exporter proprement vers Kanopi =
  décision qui engage la voie texte, pas un simple ménage. → Romain.
- **E4 place de `constants.js`** (table opérateurs BP3) : infra partagée neutre ou rattachée à la
  zone BP3 héritée ? → arbitrage d'architecture.

Aucun écart ne casse la frontière BPx figée. Les écarts B sont des **dérives à corriger**, pas des
violations de contrat.
