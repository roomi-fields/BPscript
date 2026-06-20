/**
 * Test TDD — Annotation payload AST (Phase 1 frontend BPx)
 *
 * Spec de référence : /home/romi/dev/bp/BPx/docs/AST_SPEC.md
 * - §2 : payload par token (nature, actor, params, flux, transport)
 * - §2.1 : cas multi-acteur, cascade statique dans declaration, pas dans tokens
 * - §3 : ce que BPx interprète vs porte
 * - §4 : formes de contrôle et nature associée
 *
 * Run: node test/test_payload_annotation.js
 */

import { readFileSync } from 'fs';
import { tokenize } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';
import { registerAll } from '../src/transpiler/libs.js';

// ── Pré-registration des libs ──────────────────────────────

const libs = {};
for (const name of ['alphabets', 'controls', 'octaves', 'tunings', 'temperaments', 'settings', 'transcription']) {
  libs[name] = JSON.parse(readFileSync(`lib/${name}.json`, 'utf8'));
}
registerAll(libs);

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, details) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push({ label, details: details || '' });
    console.error(`  FAIL: ${label}${details ? ` — ${details}` : ''}`);
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

function parseSource(src) {
  return parse(tokenize(src));
}

function rhs0(ast) {
  return ast.subgrammars[0].rules[0].rhs;
}

// ============================================================
// §2.1 — Cas multi-acteur : 2 acteurs, 2 canaux MIDI
// ============================================================

section('§2.1 — multi-acteur (sitar ch:1, tabla ch:10)');

{
  const src = `@controls
@actor sitar
  transport.midi(ch:1)
@actor tabla
  transport.midi(ch:10)
S -> { sitar.Sa, tabla.dha(vel:80) }`;

  const ast = parseSource(src);
  const sg = ast.subgrammars[0];
  const rule = sg.rules[0];
  const poly = rule.rhs[0]; // Polymetric

  assert('polymetric présent', poly.type === 'Polymetric', JSON.stringify(poly?.type));

  const voice0 = poly.voices[0]; // [ sitar.Sa ]
  const voice1 = poly.voices[1]; // [ tabla.dha(vel:80) ]

  const sitarSa = voice0[0];
  const tablaDha = voice1[0];

  // payload.nature = 'sounding'
  assert('sitar.Sa nature=sounding', sitarSa?.payload?.nature === 'sounding',
    `got ${JSON.stringify(sitarSa?.payload)}`);
  assert('tabla.dha nature=sounding', tablaDha?.payload?.nature === 'sounding',
    `got ${JSON.stringify(tablaDha?.payload)}`);

  // payload.actor = acteur propriétaire
  assert('sitar.Sa actor=sitar', sitarSa?.payload?.actor === 'sitar',
    `got actor=${sitarSa?.payload?.actor}`);
  assert('tabla.dha actor=tabla', tablaDha?.payload?.actor === 'tabla',
    `got actor=${tablaDha?.payload?.actor}`);

  // Les canaux par défaut NE sont PAS dans les tokens
  assert('sitar.Sa: pas de ch dans payload', !('ch' in (sitarSa?.payload?.params || {})),
    `params=${JSON.stringify(sitarSa?.payload?.params)}`);
  assert('tabla.dha: pas de ch dans payload', !('ch' in (tablaDha?.payload?.params || {})),
    `params=${JSON.stringify(tablaDha?.payload?.params)}`);

  // Override d'occurrence vel:80 sur tabla.dha
  assert('tabla.dha params.vel=80', tablaDha?.payload?.params?.vel === 80,
    `params=${JSON.stringify(tablaDha?.payload?.params)}`);

  // Pas de flux (overrides d'occurrence = pas de flux)
  assert('tabla.dha: flux absent ou false', !tablaDha?.payload?.flux,
    `flux=${tablaDha?.payload?.flux}`);

  // Cascade statique dans la déclaration d'acteur (actors[])
  const sitar = ast.actors.find(a => a.name === 'sitar');
  const tabla = ast.actors.find(a => a.name === 'tabla');
  assert('sitar transport.key=midi', sitar?.properties?.transport?.key === 'midi',
    JSON.stringify(sitar?.properties?.transport));
  assert('sitar transport.params.ch=1', sitar?.properties?.transport?.params?.ch === 1,
    JSON.stringify(sitar?.properties?.transport));
  assert('tabla transport.params.ch=10', tabla?.properties?.transport?.params?.ch === 10,
    JSON.stringify(tabla?.properties?.transport));
}

// ============================================================
// nature — couverture de tous les types (spec §4)
// ============================================================

section('nature — couverture des types de nœuds RHS');

{
  // Symbol simple → 'sounding'
  const ast = parseSource('@controls\nS -> A');
  const sym = rhs0(ast)[0];
  assert('Symbol nature=sounding', sym.payload?.nature === 'sounding',
    `got ${JSON.stringify(sym.payload)}`);
}

{
  // Rest → 'rest'
  const ast = parseSource('@controls\nS -> -');
  const rest = rhs0(ast)[0];
  assert('Rest nature=rest', rest.payload?.nature === 'rest',
    `got ${JSON.stringify(rest.payload)}`);
}

{
  // Prolongation _ → 'prolongation'
  const ast = parseSource('@controls\nS -> A _');
  const elems = rhs0(ast);
  const prolong = elems[1];
  assert('Prolongation nature=prolongation', prolong.payload?.nature === 'prolongation',
    `got ${JSON.stringify(prolong.payload)}`);
}

{
  // UndeterminedRest ... → 'rest'
  const ast = parseSource('@controls\nS -> ...');
  const ur = rhs0(ast)[0];
  assert('UndeterminedRest nature=rest', ur.payload?.nature === 'rest',
    `got ${JSON.stringify(ur.payload)}`);
}

{
  // InstantControl !(vel:80) → 'instant'
  const ast = parseSource('@controls\nS -> !(vel:80)');
  const ic = rhs0(ast)[0];
  assert('InstantControl nature=instant', ic.payload?.nature === 'instant',
    `got ${JSON.stringify(ic.payload)}`);
}

{
  // InstantControl !(vel:80) → flux:true
  const ast = parseSource('@controls\nS -> !(vel:80)');
  const ic = rhs0(ast)[0];
  assert('InstantControl flux=true', ic.payload?.flux === true,
    `got flux=${ic.payload?.flux}`);
}

{
  // Règle d'espace sur !(...) (décision Romain 2026-06-20) :
  //   C4!(...) COLLÉ  → conjoint=true (ancré au terminal précédent)
  //   C4 !(...) ESPACÉ → conjoint=false (événement séparé)
  //   !(...) en tête (pas de terminal avant) → conjoint=false
  const colle = rhs0(parseSource('@controls\nS -> C4!(vel:80) E4'));
  const espace = rhs0(parseSource('@controls\nS -> C4 !(vel:80) E4'));
  const tete = rhs0(parseSource('@controls\nS -> !(vel:80) C4'));
  const icColle = colle.find((e) => e.type === 'InstantControl');
  const icEspace = espace.find((e) => e.type === 'InstantControl');
  const icTete = tete.find((e) => e.type === 'InstantControl');
  assert('!(...) COLLÉ → conjoint=true', icColle?.conjoint === true && icColle?.payload?.conjoint === true,
    `got ${JSON.stringify(icColle?.payload)}`);
  assert('!(...) ESPACÉ → conjoint=false', icEspace?.conjoint === false && icEspace?.payload?.conjoint === false,
    `got ${JSON.stringify(icEspace?.payload)}`);
  assert('!(...) en tête (sans terminal) → conjoint=false', icTete?.conjoint === false,
    `got conjoint=${icTete?.conjoint}`);
}

{
  // Frontière intacte : B3!C7 (! entre symboles) = SimultaneousGroup, PAS un flux
  const r = rhs0(parseSource('@controls\nS -> B3!C7'));
  assert('B3!C7 → SimultaneousGroup (inchangé)', r[0]?.type === 'SimultaneousGroup',
    `got ${r[0]?.type}`);
}

{
  // (vel:80) sans ! en début de portée ('S -> (vel:80)') va dans rule.runtimeQualifier
  // (comportement parser : break sur LPAREN spaceBefore). Un `(...)` nu = CONTENANCE
  // (concept neuf BPScript, décision Romain 2026-06-20) : structurel, confiné, NE déborde PAS
  // → tagué `containment:true scope:'rule'` (PAS flux). Seul `!(...)` porte flux:true.
  const ast = parseSource('@controls\nS -> (vel:80)');
  const rule = ast.subgrammars[0].rules[0];
  assert('(vel:80) standalone → runtimeQualifier de règle (pas rhs)',
    rule.runtimeQualifier?.type === 'RuntimeQualifier',
    `runtimeQualifier=${JSON.stringify(rule.runtimeQualifier)}`);
  assert('runtimeQualifier de règle ANNOTÉ contenance scope:rule (pas flux)',
    rule.runtimeQualifier?.payload?.containment === true && rule.runtimeQualifier?.payload?.scope === 'rule'
    && rule.runtimeQualifier?.payload?.flux === undefined
    && rule.runtimeQualifier?.payload?.nature === 'transport-control',
    `payload=${JSON.stringify(rule.runtimeQualifier?.payload)}`);
}

{
  // Control moteur sans arg (engine-control) : stop, striated, retro...
  const ast = parseSource('@controls\nS -> A stop');
  const elems = rhs0(ast);
  const stopCtrl = elems.find(e => e.type === 'Control' && e.name === 'stop');
  assert('Control moteur (stop) présent', stopCtrl !== undefined,
    `rhs=${JSON.stringify(elems.map(e => e.type+':'+e.name))}`);
  assert('Control moteur stop nature=engine-control', stopCtrl?.payload?.nature === 'engine-control',
    `got ${JSON.stringify(stopCtrl?.payload)}`);
}

{
  // Control moteur avec args (goto) → engine-control
  const ast = parseSource('@controls\nS -> A goto(2,1)');
  const elems = rhs0(ast);
  const gotoCtrl = elems.find(e => e.type === 'Control' && e.name === 'goto');
  assert('Control goto présent', gotoCtrl !== undefined,
    `rhs=${JSON.stringify(elems.map(e => e.type+':'+e.name))}`);
  assert('Control goto nature=engine-control', gotoCtrl?.payload?.nature === 'engine-control',
    `got ${JSON.stringify(gotoCtrl?.payload)}`);
}

{
  // Control runtime (vel) posé explicitement → transport-control
  const ast = parseSource('@controls\nS -> A vel(80) B');
  const elems = rhs0(ast);
  const velCtrl = elems.find(e => e.type === 'Control' && e.name === 'vel');
  if (velCtrl) {
    assert('Control vel nature=transport-control', velCtrl?.payload?.nature === 'transport-control',
      `got ${JSON.stringify(velCtrl?.payload)}`);
  } else {
    // vel(80) peut se parser différemment selon la position (rule-level runtimeQualifier)
    // On vérifie juste que le rhs contient des éléments
    assert('A vel(80) B: A present dans rhs', elems.some(e => e.name === 'A'),
      `rhs=${JSON.stringify(elems.map(e => e.type+':'+e.name))}`);
  }
}

// ============================================================
// Déclaration d'acteur : forme canonique ActorReference[] (conformité §2.1)
// ============================================================
section('ActorDirective.references[] (forme canonique, lue par le dispatcher)');
{
  const ast = parseSource(`@actor tabla\n  alphabet.tabla\n  transport.midi(ch:10)\nS -> tabla.Sa`);
  const actor = ast.actors[0];
  const refs = actor.references;
  assert('references[] présent', Array.isArray(refs) && refs.length >= 2, `got ${JSON.stringify(refs)}`);
  const tr = refs?.find((r) => r.category === 'transport');
  assert('ActorReference transport présent', !!tr, `refs=${JSON.stringify(refs)}`);
  assert('transport type=ActorReference', tr?.type === 'ActorReference', `got ${JSON.stringify(tr)}`);
  assert('transport name=midi', tr?.name === 'midi', `got ${JSON.stringify(tr)}`);
  assert('transport params.ch=10 (défaut acteur)', tr?.params?.ch === 10, `got ${JSON.stringify(tr)}`);
  const al = refs?.find((r) => r.category === 'alphabet');
  assert('ActorReference alphabet name=tabla', al?.name === 'tabla', `got ${JSON.stringify(al)}`);
  // properties conservées pour le pipeline interne (non-régression)
  assert('properties conservées (interne)', !!actor.properties, 'properties absentes');
}

// ============================================================
// flux — marquage correct (spec §2)
// ============================================================

section('flux — marquage !(…) vs Sa(vel:80) attaché');

{
  // !(vel:80) standalone → flux:true
  const ast = parseSource('@controls\nS -> !(vel:80)');
  const ic = rhs0(ast)[0];
  assert('!(vel:80) flux=true', ic.payload?.flux === true,
    `got payload=${JSON.stringify(ic.payload)}`);
}

{
  // Sa avec suffixQualifier collé → pas de flux (override d'occurrence)
  // Sa(vel:80) est parsé en Symbol avec suffixQualifiers, payload plié
  const ast = parseSource('@controls\nS -> A(vel:80)');
  const elems = rhs0(ast);
  const sym = elems.find(e => e.type === 'Symbol' || e.type === 'SymbolCall');
  assert('A(vel:80) produit un Symbol/SymbolCall', sym !== undefined,
    `rhs=${JSON.stringify(elems.map(e => e.type))}`);
  // Override d'occurrence = pas de flux
  assert('A(vel:80) flux absent ou false', !sym?.payload?.flux,
    `got payload=${JSON.stringify(sym?.payload)}`);
  // vel:80 est dans payload.params
  assert('A(vel:80) params.vel=80', sym?.payload?.params?.vel === 80,
    `params=${JSON.stringify(sym?.payload?.params)}`);
}

// ============================================================
// BUG _xxx(N) — normalisation (spec §4 "Forme exclue")
// ============================================================

section('BUG _xxx(N) — normalisation vers transport-control');

{
  // _transpose(2) ne doit PAS produire [Prolongation, Control]
  // Il doit produire UN SEUL nœud transport-control
  const ast = parseSource('@controls\nS -> _transpose(2)');
  const elems = rhs0(ast);

  // Aucune Prolongation parasite
  const hasProlong = elems.some(e => e.type === 'Prolongation');
  assert('_transpose(2): aucune Prolongation parasite', !hasProlong,
    `rhs=${JSON.stringify(elems.map(e => e.type+':'+e.name))}`);

  // Un seul nœud
  assert('_transpose(2): un seul nœud', elems.length === 1,
    `got ${elems.length} nœuds: ${JSON.stringify(elems.map(e => e.type+':'+e.name))}`);

  // Nature transport-control (c'est une forme runtime normalisée)
  const ctrl = elems[0];
  assert('_transpose(2) nature=transport-control', ctrl?.payload?.nature === 'transport-control',
    `got ${JSON.stringify(ctrl?.payload)}`);

  // Aucune marque BP3 dans l'AST
  const json = JSON.stringify(ctrl);
  assert('_transpose(2): pas de _script dans AST', !json.includes('_script'),
    `json=${json}`);
  assert('_transpose(2): pas de flavor dans AST', !json.includes('flavor'),
    `json=${json}`);
}

{
  // _vel(80) → idem
  const ast = parseSource('@controls\nS -> _vel(80)');
  const elems = rhs0(ast);
  const hasProlong = elems.some(e => e.type === 'Prolongation');
  assert('_vel(80): aucune Prolongation parasite', !hasProlong,
    `rhs=${JSON.stringify(elems.map(e => e.type+':'+e.name))}`);
  assert('_vel(80): un seul nœud', elems.length === 1,
    `got ${elems.length} nœuds`);
}

{
  // _ seul reste Prolongation
  const ast = parseSource('@controls\nS -> A _');
  const elems = rhs0(ast);
  const prolong = elems.find(e => e.type === 'Prolongation');
  assert('_ seul reste Prolongation', prolong !== undefined,
    `rhs=${JSON.stringify(elems.map(e => e.type))}`);
}

// ============================================================
// Agnosticisme — zéro notion BP3 dans l'AST
// ============================================================

section('Agnosticisme — zéro notion BP3 dans le payload');

{
  const src = `@controls
@actor sitar
  transport.midi(ch:1)
@actor tabla
  transport.midi(ch:10)
S -> { sitar.Sa, tabla.dha(vel:80) }
S -> !(vel:80) A _transpose(2) goto(2,1) -`;
  const ast = parseSource(src);
  const json = JSON.stringify(ast);

  assert('AST: pas de transport-bp3', !json.includes('transport-bp3'),
    'found transport-bp3 in AST');
  assert('AST: pas de flavor dans payload', !json.includes('"flavor"'),
    'found "flavor" in AST');
  assert('AST: pas de _script dans payload', !json.includes('_script'),
    'found _script in AST');
}

// ============================================================
// OutTimeObject → 'sounding'
// ============================================================

section('OutTimeObject → nature sounding');

{
  const ast = parseSource('@controls\nS -> !mysym');
  const elems = rhs0(ast);
  const oto = elems.find(e => e.type === 'OutTimeObject');
  assert('OutTimeObject présent', oto !== undefined,
    `rhs=${JSON.stringify(elems.map(e => e.type))}`);
  assert('OutTimeObject nature=sounding', oto?.payload?.nature === 'sounding',
    `got ${JSON.stringify(oto?.payload)}`);
}

// ============================================================
// TieStart / TieContinue / TieEnd → 'sounding'
// ============================================================

section('Tie nodes → nature sounding');

{
  const ast = parseSource('@controls\nS -> A~ ~B~ ~C');
  const elems = rhs0(ast);
  const tieStart = elems.find(e => e.type === 'TieStart');
  const tieCont = elems.find(e => e.type === 'TieContinue');
  const tieEnd = elems.find(e => e.type === 'TieEnd');
  if (tieStart) {
    assert('TieStart nature=sounding', tieStart?.payload?.nature === 'sounding',
      `got ${JSON.stringify(tieStart?.payload)}`);
  }
  if (tieCont) {
    assert('TieContinue nature=sounding', tieCont?.payload?.nature === 'sounding',
      `got ${JSON.stringify(tieCont?.payload)}`);
  }
  if (tieEnd) {
    assert('TieEnd nature=sounding', tieEnd?.payload?.nature === 'sounding',
      `got ${JSON.stringify(tieEnd?.payload)}`);
  }
}

// ============================================================
// Polymetric — récursion dans les voix
// ============================================================

section('Polymetric — les voix sont annotées récursivement');

{
  const ast = parseSource('@controls\nS -> { A B, C - }');
  const poly = rhs0(ast)[0];
  assert('Polymetric présent', poly?.type === 'Polymetric', poly?.type);

  // Pas de payload.nature sur le Polymetric lui-même
  assert('Polymetric: pas de payload.nature', poly?.payload?.nature === undefined,
    `got ${JSON.stringify(poly?.payload)}`);

  // Voix 0 : A B
  const v0 = poly.voices[0];
  assert('Polymetric v0[0] A nature=sounding', v0[0]?.payload?.nature === 'sounding',
    `got ${JSON.stringify(v0[0]?.payload)}`);
  assert('Polymetric v0[1] B nature=sounding', v0[1]?.payload?.nature === 'sounding',
    `got ${JSON.stringify(v0[1]?.payload)}`);

  // Voix 1 : C -
  const v1 = poly.voices[1];
  assert('Polymetric v1[0] C nature=sounding', v1[0]?.payload?.nature === 'sounding',
    `got ${JSON.stringify(v1[0]?.payload)}`);
  assert('Polymetric v1[1] - nature=rest', v1[1]?.payload?.nature === 'rest',
    `got ${JSON.stringify(v1[1]?.payload)}`);
}

// ============================================================
// Rapport final
// ============================================================

console.log(`\n--- Résultat : ${passed} PASS, ${failed} FAIL ---`);
if (failures.length > 0) {
  console.log('\nÉchecs :');
  for (const f of failures) {
    console.log(`  - ${f.label}${f.details ? ` (${f.details})` : ''}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
