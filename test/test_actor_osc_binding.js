/**
 * KAI-9 / GAP#1 — adressage de sortie par acteur, UNE seule forme (décision
 * 2026-06-26, supersède OSC-L1 « champ binding séparé »).
 *
 *   @actor <nom> transport.osc(device:<pont>, ch:<n>)     // OSC, iso-MIDI
 *   @actor <nom> transport.midi(ch:<n>)                    // MIDI
 *
 * Le TYPE de runtime est `transport.<type>` (references[transport].name) et les
 * DÉTAILS d'adresse (device/channel/port) sont ses PARAMS — pas un tiroir parallèle.
 * L'hôte reconstruit son routage depuis transport.params (plus depuis `binding`).
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
const transportRef = (a) => a?.references?.find((x) => x.category === 'transport');

// ── OSC device + ch dans les params du transport (forme multi-ligne) ─────
{
  const a = actor('@actor bass\n  alphabet.western\n  transport.osc(device:bridge1, ch:5)\nA -> C4', 'bass');
  assert('transport type = osc', a?.properties?.transport?.key === 'osc', JSON.stringify(a?.properties?.transport));
  assert('device dans transport.params', a?.properties?.transport?.params?.device === 'bridge1',
    JSON.stringify(a?.properties?.transport?.params));
  assert('ch (int) dans transport.params', a?.properties?.transport?.params?.ch === 5,
    JSON.stringify(a?.properties?.transport?.params));
  // Référence canonique (ce que lit l'aval) porte type + détails.
  assert('reference transport.name = osc', transportRef(a)?.name === 'osc');
  assert('reference transport.params = {device,ch}',
    transportRef(a)?.params?.device === 'bridge1' && transportRef(a)?.params?.ch === 5,
    JSON.stringify(transportRef(a)?.params));
  // Plus de champ parallèle `binding`.
  assert('plus de champ binding', a?.binding === undefined, JSON.stringify(a?.binding));
  // Pas de pollution de properties hors transport.
  assert('properties.device absent', a?.properties?.device === undefined);
  assert('alphabet préservé', a?.properties?.alphabet === 'western');
}

// ── MIDI iso : ch dans transport.params ─────────────────────────────────
{
  const a = actor('@actor lead transport.midi(ch:10)\nA -> C4', 'lead');
  assert('midi type', a?.properties?.transport?.key === 'midi');
  assert('midi ch=10 dans params', a?.properties?.transport?.params?.ch === 10,
    JSON.stringify(a?.properties?.transport?.params));
}

// ── device seul (ch optionnel) ──────────────────────────────────────────
{
  const a = actor('@actor pad transport.osc(device:b2)\nA -> C4', 'pad');
  assert('device seul → device=b2', a?.properties?.transport?.params?.device === 'b2',
    JSON.stringify(a?.properties?.transport?.params));
  assert('device seul → ch absent', a?.properties?.transport?.params?.ch === undefined,
    JSON.stringify(a?.properties?.transport?.params));
}

// ── acteur sans détails d'adresse → params vides ────────────────────────
{
  const a = actor('@actor plain\n  alphabet.western\n  transport.osc\nA -> C4', 'plain');
  assert('transport osc sans params', a?.properties?.transport?.key === 'osc' &&
    Object.keys(a?.properties?.transport?.params || {}).length === 0,
    JSON.stringify(a?.properties?.transport));
  assert('plus de champ binding', a?.binding === undefined);
}

// ── forme host : {acteur:{device, channel}} reconstructible depuis transport.params ─
{
  const r = compileToBPxAST(
    '@actor v1 transport.osc(device:d1, ch:1)\n@actor v2 transport.osc(device:d2, ch:2)\nA -> C4');
  const out = {};
  for (const a of r.ast.actors) {
    const p = a.properties?.transport?.params;
    if (p && (p.device !== undefined || p.ch !== undefined)) out[a.name] = { device: p.device, channel: p.ch };
  }
  assert('2 adresses reconstruites', Object.keys(out).length === 2, JSON.stringify(out));
  assert('v1 → {d1,1}', out.v1?.device === 'd1' && out.v1?.channel === 1);
  assert('v2 → {d2,2}', out.v2?.device === 'd2' && out.v2?.channel === 2);
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
