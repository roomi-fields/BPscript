/**
 * LAN-5 / KAI-9 — acteur IMPLICITE `default` matérialisé DANS L'AST (validé Romain 2026-06-26).
 *
 * Quand une scène ne déclare AUCUN @actor (`.bps` simple, `.gr`, cv-adsr), BPScript inscrit un
 * acteur `default` (transport `audio`, marqué `synthetic:true`, sans alphabet) dans `ast.actors`,
 * pour qu'une scène simple emprunte le MÊME chemin orchestré qu'une scène multi-acteurs. Avant,
 * c'était l'HÔTE (kanopi bpx-adapter.ts:282-283) qui le synthétisait ; KAI-9 supprime la résolution
 * hôte → le défaut vit dans l'AST, BPx ne fait que le porter.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function assert(label, cond, extra = '') {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL: ${label} ${extra}`); }
}
const actors = (src) => compileToBPxAST(src).ast.actors;

// ── 1. scène sans @actor → un acteur `default` transport audio, synthetic ─
{
  const a = actors('A -> C4');
  assert('un seul acteur', a.length === 1, JSON.stringify(a.map((x) => x.name)));
  const d = a[0];
  assert('nom = default', d.name === 'default');
  assert('transport.key = audio', d.properties?.transport?.key === 'audio', JSON.stringify(d.properties?.transport));
  assert('reference transport = audio', d.references?.find((r) => r.category === 'transport')?.name === 'audio');
  assert('marqué synthetic:true', d.synthetic === true);
  assert('pas d alphabet (pitch via résolveur de scène)', d.properties?.alphabet === undefined);
}

// ── 2. .gr / scène solfège sans @actor → aussi un default (pas de lock alphabet) ─
{
  const a = actors('@mm:60\nGamme -> do4 re4 mi4');
  assert('default injecté même avec directives', a.length === 1 && a[0].name === 'default', JSON.stringify(a));
  assert('default sans alphabet (sniff tokens)', a[0].properties?.alphabet === undefined);
}

// ── 3. scène AVEC @actor → PAS de default, pas de synthetic ──────────────
{
  const a = actors('@actor sitar transport.midi(ch:3)\nsitar -> C4');
  assert('un acteur déclaré', a.length === 1 && a[0].name === 'sitar');
  assert('pas synthetic', a[0].synthetic !== true);
  assert('pas d acteur default ajouté', !a.some((x) => x.name === 'default' && x.synthetic));
}

// ── 4. plusieurs @actor → aucun default ─────────────────────────────────
{
  const a = actors('@actor a1 transport.midi(ch:1)\n@actor a2 transport.osc(device:x)\na1 -> C4\na2 -> E4');
  assert('2 acteurs déclarés, pas de default', a.length === 2 && !a.some((x) => x.synthetic));
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
