// Garde d'architecture du transpileur BPScript (dependency-cruiser).
// Lois STRUCTURELLES seulement (le sémantique = relecture Romain).
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', comment: 'aucune dépendance circulaire',
      from: {}, to: { circular: true } },
    // LOI BPx-only : la voie AST PROPRE (bpxAst) ne touche JAMAIS la sortie BP3 héritée.
    { name: 'bpx-clean-no-bp3', severity: 'error',
      comment: 'bpxAst (AST agnostique) ne doit pas dépendre de encoder/prototypes/orderTokens (BP3 hérité)',
      from: { path: 'src/transpiler/bpxAst\\.js$' },
      to: { path: 'src/transpiler/(encoder|prototypes|orderTokens)\\.js$' } },
    // LOI : le coeur (frontal + résolution) ne dépend pas de l'OUTILLAGE (tests/CLI).
    { name: 'core-no-tooling', severity: 'error',
      comment: 'le coeur ne doit pas importer les scripts CLI/test',
      from: { path: 'src/transpiler/(tokenizer|parser|bpxAst|index|constants|actorResolver|libs|encoder)\\.js$' },
      to: { path: 'src/transpiler/(compare|show-diffs|test|validate|validate-all|validate-wasm|libs-bundle|libs-bundle-check)\\.js$' } },
  ],
  options: { doNotFollow: { path: 'node_modules' }, tsPreCompilationDeps: true },
};
