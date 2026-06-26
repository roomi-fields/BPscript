/**
 * KAI-9 / GAP#2 — tiroir d'adresse dédié dans le payload (décision 2026-06-26).
 *
 * Les clés d'ADRESSE de sortie (canal/device/port) se rangent dans `payload.address`,
 * DISTINCT des contrôles d'expression (vel/pan/wave…) qui restent dans `payload.params`.
 * Séparation pilotée par schéma (ADDRESS_KEYS), syntaxe utilisateur `(ch:5)` INCHANGÉE.
 * Kairos lit `payload.address` pour matérialiser event.output sans le confondre avec un contrôle.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function assert(label, cond, extra = '') {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL: ${label} ${extra}`); }
}

function payloads(src) {
  const r = compileToBPxAST(src);
  if (r.errors && r.errors.length) { console.log('  PARSE ERROR:', JSON.stringify(r.errors)); return []; }
  const acc = [];
  const walk = (rhs) => {
    for (const el of rhs || []) {
      if (el && el.payload) acc.push({ s: el.symbol || el.name, p: el.payload });
      if (el && el.elements) walk(el.elements);
      if (el && el.voices) for (const v of el.voices) walk(v);
    }
  };
  for (const sub of r.ast.subgrammars || []) for (const rl of sub.rules || []) walk(rl.rhs);
  return acc;
}
const find = (acc, sym, i = 0) => acc.filter((n) => n.s === sym)[i]?.p;

// ── 1. override d'adresse pur (ch) → tiroir address, pas de params ───────
{
  const a = payloads('sitar -> C4 C4(ch:5)');
  const p = find(a, 'C4', 1);
  assert('address.ch=5', p?.address?.ch === 5, JSON.stringify(p));
  assert('pas de params (pas de contrôle)', p?.params === undefined, JSON.stringify(p));
  assert('occurrence:true', p?.occurrence === true);
}

// ── 2. contrôle pur (vel) → params, pas de tiroir address ───────────────
{
  const a = payloads('sitar -> E4(vel:80)');
  const p = find(a, 'E4');
  assert('params.vel=80', p?.params?.vel === 80, JSON.stringify(p));
  assert('pas de tiroir address', p?.address === undefined, JSON.stringify(p));
}

// ── 3. mixte (ch + vel + pan) → SÉPARÉS proprement ──────────────────────
{
  const a = payloads('sitar -> G4(ch:2, vel:90, pan:64)');
  const p = find(a, 'G4');
  assert('address = {ch:2} seul', p?.address?.ch === 2 && Object.keys(p.address).length === 1, JSON.stringify(p?.address));
  assert('params = {vel,pan} sans ch', p?.params?.vel === 90 && p?.params?.pan === 64 && p?.params?.ch === undefined,
    JSON.stringify(p?.params));
}

// ── 4. device + port → reconnus comme adresse ───────────────────────────
{
  const a = payloads('sitar -> A4(device:reaper, port:57110)');
  const p = find(a, 'A4');
  assert('address.device=reaper', p?.address?.device === 'reaper', JSON.stringify(p?.address));
  assert('address.port=57110', p?.address?.port === 57110, JSON.stringify(p?.address));
  assert('pas de params', p?.params === undefined, JSON.stringify(p));
}

// ── 5. channel (forme longue) = synonyme de ch ──────────────────────────
{
  const a = payloads('sitar -> B4(channel:3)');
  const p = find(a, 'B4');
  assert('channel rangé en address', p?.address?.channel === 3, JSON.stringify(p?.address));
  assert('pas de params', p?.params === undefined);
}

// ── 6. note nue → aucun tiroir ──────────────────────────────────────────
{
  const a = payloads('sitar -> C4');
  const p = find(a, 'C4');
  assert('note nue : ni address ni params', p?.address === undefined && p?.params === undefined, JSON.stringify(p));
  assert('occurrence absent', p?.occurrence === undefined);
}

// ── 7. qualifieur de CONTENANCE (règle) {…}(ch:4, vel:70) → adresse + contrôle séparés ─
{
  const r = compileToBPxAST('sitar -> {C4 E4}(ch:4, vel:70)');
  const q = r.ast.subgrammars?.[0]?.rules?.[0]?.runtimeQualifier?.payload;
  assert('contenance : address.ch=4', q?.address?.ch === 4, JSON.stringify(q));
  assert('contenance : params.vel=70 (contrôle reste)', q?.params?.vel === 70, JSON.stringify(q));
  assert('contenance : containment/scope préservés', q?.containment === true && q?.scope === 'rule', JSON.stringify(q));
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
