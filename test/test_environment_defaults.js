/**
 * BPS-defaut-env / M5 — défauts d'environnement inscrits dans l'AST à la création
 * (point 1, hub/projets/spec-ecriture-structure.md §A ; décision archi Romain 2026-06-24).
 *
 *   compileToBPxAST(source, environnement) -> { ast, ... }
 *   environnement = { tempo?, octave?, division?, … }   // défauts portés par Kanopi
 *
 * BPScript inscrit le défaut EN DUR là où la scène ne déclare rien (pas de @mm →
 * tempo = environnement.tempo). Kanopi ne touche jamais l'AST. Remplace l'injection
 * côté Kanopi (KAN-A10). Le tempo est la seule clé câblée (seul lecteur aval existant).
 *
 * Preuve NON CIRCULAIRE : on vérifie via une réplique exacte du lecteur aval réel
 * (kanopi/.../bpx-adapter.ts mmFromAst), pas en relisant notre propre sortie.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function assert(label, cond, extra = '') {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL: ${label} ${extra}`); }
}

// Réplique EXACTE de kanopi bpx-adapter.ts `mmFromAst` (le consommateur réel du tempo).
function mmFromAst(a) {
  for (const d of a?.directives ?? []) {
    if (d.name === 'mm' && typeof d.value === 'number' && d.value > 0) return d.value;
  }
  return undefined;
}

// ── 1. scène sans tempo + env.tempo → défaut inscrit, lu par l'aval ─────
{
  const ast = compileToBPxAST('A -> C4', { tempo: 90 }).ast;
  assert('tempo défaut lu par mmFromAst = 90', mmFromAst(ast) === 90, `got ${mmFromAst(ast)}`);
  const dir = ast.directives.find((d) => d.name === 'mm');
  assert('directive @mm inscrite', dir != null);
  assert('value = 90 (en dur)', dir?.value === 90);
  assert('provenance fromEnvironment:true', dir?.fromEnvironment === true);
  assert('type Directive', dir?.type === 'Directive');
}

// ── 2. scène déclare @mm → la scène GAGNE (pas d'écrasement) ────────────
{
  const ast = compileToBPxAST('@mm:70\nA -> C4', { tempo: 90 }).ast;
  assert('@mm:70 préservé (scène gagne)', mmFromAst(ast) === 70, `got ${mmFromAst(ast)}`);
  const mmDirs = ast.directives.filter((d) => d.name === 'mm');
  assert('une seule directive @mm (pas de doublon)', mmDirs.length === 1, `got ${mmDirs.length}`);
  assert('pas d injection environnement', !mmDirs.some((d) => d.fromEnvironment));
}

// ── 3. scène déclare @tempo → pas d'injection (tempo déjà déclaré) ──────
{
  const ast = compileToBPxAST('@tempo:120\nA -> C4', { tempo: 90 }).ast;
  assert('@tempo:120 → pas d injection @mm défaut',
    !ast.directives.some((d) => d.name === 'mm' && d.fromEnvironment), JSON.stringify(ast.directives));
}

// ── 4. sans environnement → rétrocompatible (rien injecté) ──────────────
{
  const ast = compileToBPxAST('A -> C4').ast;
  assert('sans env → aucune directive', (ast.directives || []).length === 0, JSON.stringify(ast.directives));
}

// ── 5. environnement vide {} → rien injecté ─────────────────────────────
{
  const ast = compileToBPxAST('A -> C4', {}).ast;
  assert('env {} → aucune directive', (ast.directives || []).length === 0, JSON.stringify(ast.directives));
}

// ── 6. env.tempo = 0 ou absent → pas d'injection (garde-fou) ────────────
{
  const ast0 = compileToBPxAST('A -> C4', { tempo: 0 }).ast;
  // 0 est une valeur définie mais invalide comme tempo ; on l'inscrit telle quelle ?
  // Décision : env.tempo != null déclenche l'inscription ; mmFromAst (>0) la rejettera.
  // On documente le comportement plutôt que de le masquer.
  const dir0 = ast0.directives.find((d) => d.name === 'mm');
  assert('env.tempo=0 → inscrit mais rejeté par lecteur (>0)', dir0?.value === 0 && mmFromAst(ast0) === undefined);

  const astU = compileToBPxAST('A -> C4', { octave: 5 }).ast; // clé non câblée
  assert('env sans tempo (autre clé) → pas d injection tempo', (astU.directives || []).length === 0);
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
