// Garde d'ÉMISSION de la frontière bpscript-bpx (FRONTIÈRES-V2, modèle G1 :
// « l'autorité fournit le validateur, l'émetteur l'exécute »).
//
// POURQUOI. La parité prouve le COMPORTEMENT (dérivation ≡ oracle natif), pas la
// FORME : une émission hors AST_SPEC tolérée par l'absorption passe la parité verte
// (vu au Palier 3 : soundAssignments:null, Variable{name}, contextes bruts). Ce test
// mord AU BON BORD : il casse MON push si compileToBPxAST émet une forme hors-spec.
//
// AUTORITÉ. validateSceneAST est exporté par BPx (src/index.ts, commit 27ac59d) —
// zéro schéma dupliqué ici. Il vérifie champs requis + interdictions canoniques par
// forme (AST_SPEC §1.1/§1.2.1/§1.3) et laisse libres les clés opaques (payload…).
//
// CORPUS. Les grammaires actives de test/grammars (même résolution de source que les
// harnais S1) + les démos public/demos si présentes (dossier non versionné, hérité).
//
// USAGE. node test/ast_conformance.mjs [moduleValidateur]
//   Sans argument : importe la dist canonique BPx (dépôt frère ../BPx).
//   L'argument (dev seulement) pointe un module alternatif exportant validateSceneAST.
import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { compileToBPxAST } from '../src/transpiler/bpxAst.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const VALIDATOR_MODULE = process.argv[2]
  ? pathToFileURL(path.resolve(process.argv[2])).href
  : pathToFileURL(path.join(ROOT, '..', 'BPx', 'dist', 'index.js')).href;

const { validateSceneAST } = await import(VALIDATOR_MODULE);
if (typeof validateSceneAST !== 'function') {
  console.error(`[ast-conformance] validateSceneAST introuvable dans ${VALIDATOR_MODULE}`
    + ' — dist BPx périmée ? (npm run build côté BPx)');
  process.exit(1);
}

// ── Corpus : grammaires actives + démos ────────────────────────────────────
const targets = [];
const skipped = [];
const grammars = JSON.parse(readFileSync(path.join(ROOT, 'test/grammars/grammars.json'), 'utf8'));
for (const [name, meta] of Object.entries(grammars)) {
  if (!meta || meta.status !== 'active') continue;
  const dir = path.join(ROOT, 'test/grammars', name);
  const src = ['scene.bps', 'original.bps', 'input.bps']
    .map((f) => path.join(dir, f)).find((p) => existsSync(p));
  if (!src) { skipped.push(name); continue; } // grammaire .gr seule : n'exerce pas l'émission .bps
  targets.push({ label: name, file: src });
}
const demosDir = path.join(ROOT, 'public/demos');
if (existsSync(demosDir)) {
  for (const f of readdirSync(demosDir).filter((f) => f.endsWith('.bps')).sort()) {
    targets.push({ label: `demo:${f}`, file: path.join(demosDir, f) });
  }
}

// ── Validation ─────────────────────────────────────────────────────────────
let bad = 0;
for (const { label, file } of targets) {
  const r = compileToBPxAST(readFileSync(file, 'utf8'));
  if (!r.ast) {
    console.error(`✗ ${label} : compileToBPxAST sans AST (${(r.errors[0] || {}).message || '?'})`);
    bad++;
    continue;
  }
  const v = validateSceneAST(r.ast);
  if (!v.valid) {
    bad++;
    console.error(`✗ ${label} : ${v.issues.length} non-conformité(s) de forme`);
    for (const issue of v.issues) console.error(`    ${issue.path} — ${issue.message}`);
  }
}
const demosCount = targets.filter((t) => t.label.startsWith('demo:')).length;
console.log(`[ast-conformance] ${targets.length} sources (${targets.length - demosCount} actives + ${demosCount} démos`
  + (skipped.length ? ` ; ${skipped.length} sans .bps ignorée(s) : ${skipped.join(', ')}` : '') + ') — '
  + (bad ? `${bad} NON CONFORME(S)` : 'émission conforme AST_SPEC'));
process.exit(bad ? 1 : 0);
