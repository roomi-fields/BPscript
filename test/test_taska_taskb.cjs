#!/usr/bin/env node
// test_taska_taskb.cjs — Tests unitaires tâches A et B
// Tâche A : espacement TIMEPATTERNS (pas d'espaces autour du =)
// Tâche B : rndtime engine control → _rndtime(N)
//
// Usage : node test/test_taska_taskb.cjs

'use strict';

let passed = 0;
let failed = 0;

async function run() {
  const { compileBPS } = await import('../src/transpiler/index.js');

  function assert(label, condition, got) {
    if (condition) {
      console.log(`  PASS  ${label}`);
      passed++;
    } else {
      console.log(`  FAIL  ${label}`);
      if (got !== undefined) console.log(`        got: ${JSON.stringify(got)}`);
      failed++;
    }
  }

  // =========================================================================
  // TÂCHE A — espacement TIMEPATTERNS
  // =========================================================================
  console.log('\n--- Tâche A : TIMEPATTERNS spacing ---');
  {
    const src = `
@core
@maxitems:0
@qclock:3
@controls
@alphabet.western:midi
@timepatterns: t1=1/1, t2=3/2, t3=4/3, t4=1/2
@mode:random
S -> {t1 t2, A B} [speed:10]
`;
    const r = compileBPS(src);
    const grammar = r.grammar || '';
    const lines = grammar.split('\n');
    const tpLine = lines.find(l => l.startsWith('t1='));

    // Doit contenir "TIMEPATTERNS:" suivi d'une ligne t1=1/1 t2=3/2 ...
    assert('TIMEPATTERNS: section présente', grammar.includes('TIMEPATTERNS:'), grammar);
    assert('Entrées sans espaces autour du =', tpLine === 't1=1/1 t2=3/2 t3=4/3 t4=1/2', tpLine);
    assert('Séparateur simple (pas double espace)', tpLine && !tpLine.includes('  '), tpLine);
    assert('Pas d\'espaces parasites (pas " = ")', tpLine && !tpLine.includes(' = '), tpLine);
    assert('Aucune erreur de compilation', r.errors.length === 0, r.errors);
  }

  // =========================================================================
  // TÂCHE B — rndtime engine control
  // =========================================================================
  console.log('\n--- Tâche B : rndtime engine control ---');

  // Cas 1 : sur un élément
  {
    const src = `
@core
@controls
gate A:midi
@mode:ord
S -> A[rndtime:10]
`;
    const r = compileBPS(src);
    const grammar = r.grammar || '';
    assert('rndtime sur élément : _rndtime(10) émis', grammar.includes('_rndtime(10)'), grammar);
    assert('rndtime sur élément : A avant _rndtime', /A _rndtime\(10\)/.test(grammar), grammar);
    assert('Aucune erreur', r.errors.length === 0, r.errors);
  }

  // Cas 2 : sur un groupe — même comportement que staccato/legato (suffixe non seq_prefix)
  {
    const src = `
@core
@controls
gate A:midi
gate B:midi
gate C:midi
gate D:midi
@mode:ord
S -> {A B C D}[rndtime:20]
`;
    const r = compileBPS(src);
    const grammar = r.grammar || '';
    // Le contrôle doit être APRES le groupe (suffixe), comme staccato/legato
    assert('rndtime sur groupe : _rndtime(20) émis', grammar.includes('_rndtime(20)'), grammar);
    assert('rndtime sur groupe : groupe avant _rndtime', /\{A B C D\} _rndtime\(20\)/.test(grammar), grammar);
    assert('Aucune erreur', r.errors.length === 0, r.errors);
  }

  // Référence staccato pour vérifier la cohérence comportementale
  {
    const src = `
@core
@controls
gate A:midi
gate B:midi
gate C:midi
gate D:midi
@mode:ord
S -> {A B C D}[staccato:50]
`;
    const r = compileBPS(src);
    const grammar = r.grammar || '';
    assert('staccato sur groupe (référence) : suffixe après }', /\{A B C D\} _staccato\(50\)/.test(grammar), grammar);
  }

  // =========================================================================
  console.log(`\nRésultat : ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
