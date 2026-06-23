/**
 * OSC-5 / OSC-L1 — adressage de sortie OSC par acteur (syntaxe figée Romain 2026-06-23).
 *
 *   @actor <nom> device:<nom-osc-bridge> ch:<n>
 *
 * Cible : le binding acteur→device (device:string, channel:int) est porté dans
 * la scène compilée (ActorDirective.binding), lu par l'hôte (Kanopi) qui appelle
 * runtime-OSC.setBindings({<acteur>:{device, channel}}).
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function assert(label, cond, extra = '') {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL: ${label} ${extra}`); }
}

function actor(src, name) {
  const r = compileToBPxAST(src);
  if (r.errors && r.errors.length) { console.log('  PARSE ERROR:', JSON.stringify(r.errors)); return null; }
  return r.ast.actors.find(a => a.name === name) || r.ast.actors[0];
}

// ── device + ch (forme multi-ligne) ─────────────────────────────────────
{
  const a = actor('@actor bass\n  alphabet.western\n  transport.osc\n  device:bridge1 ch:5\nA -> C4', 'bass');
  assert('binding présent', a?.binding != null, JSON.stringify(a?.binding));
  assert('binding.device=bridge1', a?.binding?.device === 'bridge1', JSON.stringify(a?.binding));
  assert('binding.channel=5 (int)', a?.binding?.channel === 5, JSON.stringify(a?.binding));
  // Pas de pollution de properties (le binding ne s'y trouve PAS).
  assert('properties.device absent', a?.properties?.device === undefined);
  assert('properties.ch absent', a?.properties?.ch === undefined);
  // Les autres entités restent intactes.
  assert('alphabet préservé', a?.properties?.alphabet === 'western');
  assert('transport préservé', a?.properties?.transport?.key === 'osc');
}

// ── forme inline sur la ligne @actor ────────────────────────────────────
{
  const a = actor('@actor lead device:mybridge ch:10\nA -> C4', 'lead');
  assert('inline binding.device=mybridge', a?.binding?.device === 'mybridge', JSON.stringify(a?.binding));
  assert('inline binding.channel=10', a?.binding?.channel === 10, JSON.stringify(a?.binding));
}

// ── device seul (ch optionnel) ──────────────────────────────────────────
{
  const a = actor('@actor pad device:b2\nA -> C4', 'pad');
  assert('device seul → device=b2', a?.binding?.device === 'b2', JSON.stringify(a?.binding));
  assert('device seul → channel absent', a?.binding?.channel === undefined, JSON.stringify(a?.binding));
}

// ── acteur sans OSC → binding null ──────────────────────────────────────
{
  const a = actor('@actor plain\n  alphabet.western\nA -> C4', 'plain');
  assert('sans OSC → binding null', a?.binding === null, JSON.stringify(a?.binding));
}

// ── forme host : {acteur:{device, channel}} reconstructible ─────────────
{
  const r = compileToBPxAST('@actor v1 device:d1 ch:1\n@actor v2 device:d2 ch:2\nA -> C4');
  const bindings = {};
  for (const a of r.ast.actors) if (a.binding) bindings[a.name] = a.binding;
  assert('2 bindings reconstruits', Object.keys(bindings).length === 2, JSON.stringify(bindings));
  assert('v1 → {d1,1}', bindings.v1?.device === 'd1' && bindings.v1?.channel === 1);
  assert('v2 → {d2,2}', bindings.v2?.device === 'd2' && bindings.v2?.channel === 2);
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
