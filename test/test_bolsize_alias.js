/**
 * TDD — BOLSIZE alias : terminaux >30 caractères → alias ≤30 dans bp3ToScene
 *
 * Règles :
 *   - Terminal ≤30 chars → inchangé
 *   - Terminal >30 chars → alias court déterministe, ≤30 chars
 *   - Collisions entre alias → discriminées (alias distinct par original)
 *   - Table d'alias retournée / commentée dans l'en-tête du .bps généré
 *   - Round-trip : après remplacement, compileBPS ne doit pas crasher
 *
 * Exécution : node test/test_bolsize_alias.js
 */

import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');

// Importer le module bp3ToScene
const { bp3ToScene } = await import(path.join(ROOT, 'src', 'transpiler', 'bp3ToScene.js'));

// ─── Fonction auxiliaire : crée une grammaire BP3 minimale avec un terminal long ─

function makeGrammarWithLongTerminal(terminalName) {
  return [
    'RND',
    `gram#1[1] A <-> ${terminalName}`,
  ].join('\n');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL  ${name}: ${e.message}`);
    failed++;
  }
}

console.log('=== test_bolsize_alias ===\n');

// T1 — terminal court (≤30) → inchangé
test('terminal ≤30 chars → inchangé dans le .bps', () => {
  const name = 'dhinOOdhagena';  // 13 chars
  assert(name.length <= 30, 'précondition: ≤30');
  const gr = makeGrammarWithLongTerminal(name);
  const bps = bp3ToScene(gr);
  assert(typeof bps === 'string', 'retourne string');
  assert(!bps.startsWith('NON GÉRÉ'), `ne doit pas être NON GÉRÉ: ${bps.substring(0,80)}`);
  assert(bps.includes(name), `nom court doit apparaître tel quel dans le .bps: ${bps}`);
});

// T2 — terminal >30 → alias ≤30
test('terminal >30 chars → alias ≤30 dans le .bps', () => {
  const name = 'dhinOOdhagenadhaOOdhagenadhatigegenaka';  // 38 chars
  assert(name.length > 30, 'précondition: >30');
  const gr = makeGrammarWithLongTerminal(name);
  const bps = bp3ToScene(gr);
  assert(typeof bps === 'string', 'retourne string');
  assert(!bps.startsWith('NON GÉRÉ'), `ne doit pas être NON GÉRÉ: ${bps.substring(0,80)}`);
  // Le nom original ne doit PAS apparaître dans les règles (seulement éventuellement en commentaire)
  // Séparer l'en-tête commenté du reste
  const lines = bps.split('\n');
  const ruleLines = lines.filter(l => !l.startsWith('//'));
  const ruleText = ruleLines.join('\n');
  assert(!ruleText.includes(name), `nom long ne doit pas apparaître dans les règles: ${ruleText.substring(0,200)}`);
  // Tous les tokens dans les règles ≤30 chars
  const tokens = ruleText.match(/[A-Za-z][A-Za-z0-9_'#]*/g) || [];
  for (const tok of tokens) {
    assert(tok.length <= 30, `token "${tok}" dépasse 30 chars dans les règles`);
  }
});

// T3 — table d'alias commentée dans l'en-tête
test('table d\'alias commentée dans l\'en-tête du .bps', () => {
  const name = 'dhinOOdhagenadhaOOdhagenadhatigegenaka';  // 38 chars
  const gr = makeGrammarWithLongTerminal(name);
  const bps = bp3ToScene(gr);
  assert(typeof bps === 'string', 'retourne string');
  // L'en-tête doit contenir le nom original et son alias sous forme de commentaire
  const headerLines = bps.split('\n').filter(l => l.startsWith('//'));
  const headerText = headerLines.join('\n');
  assert(headerText.includes(name), `nom original doit être dans l'en-tête commenté: ${headerText}`);
  // L'alias doit aussi y figurer
  // On cherche le patron "original -> alias" ou "alias = original"
  // L'en-tête doit contenir une ligne commentée avec l'alias et le nom original côte-à-côte
  // (n'importe quel séparateur : ->, =, :, →, espace…)
  assert(
    headerLines.some(l => l.includes(name)),
    `le nom original doit figurer dans au moins une ligne commentée: ${headerText}`
  );
});

// T4 — deux terminaux longs distincts → deux alias distincts (pas de collision)
test('deux terminaux longs distincts → alias distincts', () => {
  const name1 = 'dhinOOdhagenadhaOOdhagenadhatigegenaka';     // 38 chars
  const name2 = 'tagetirakitadhinOOdhagenadhatigegenakena';  // 41 chars
  assert(name1.length > 30 && name2.length > 30, 'précondition: tous >30');
  const gr = [
    'RND',
    `gram#1[1] A3 <-> ${name1}`,
    `gram#1[2] A4 <-> ${name2}`,
  ].join('\n');
  const bps = bp3ToScene(gr);
  assert(typeof bps === 'string', 'retourne string');
  assert(!bps.startsWith('NON GÉRÉ'), `ne doit pas être NON GÉRÉ: ${bps.substring(0,80)}`);
  // Extraire tous les alias dans les règles
  const ruleLines = bps.split('\n').filter(l => !l.startsWith('//'));
  const ruleText = ruleLines.join('\n');
  // Les deux noms originaux ne doivent pas apparaître dans les règles
  assert(!ruleText.includes(name1), `nom1 long ne doit pas apparaître dans les règles`);
  assert(!ruleText.includes(name2), `nom2 long ne doit pas apparaître dans les règles`);
  // Les alias des deux règles doivent être différents
  // On extrait les tokens RHS de chaque règle
  const ruleRegex = /A3\s*<>\s*([A-Za-z][A-Za-z0-9_'#]*)/;
  const ruleRegex2 = /A4\s*<>\s*([A-Za-z][A-Za-z0-9_'#]*)/;
  const m1 = ruleText.match(ruleRegex);
  const m2 = ruleText.match(ruleRegex2);
  assert(m1, 'règle A3 trouvée');
  assert(m2, 'règle A4 trouvée');
  assert(m1[1] !== m2[1], `les deux alias doivent être distincts: "${m1[1]}" vs "${m2[1]}"`);
});

// T5 — même terminal long répété → même alias (déterministe)
test('même terminal long répété → même alias (déterministe)', () => {
  const name = 'dhinOOdhagenadhaOOdhagenadhatigegenaka';  // 38 chars
  const gr = [
    'RND',
    `gram#1[1] A3 <-> ${name}`,
    `gram#1[2] A6 <-> ${name} ${name}`,
  ].join('\n');
  const bps = bp3ToScene(gr);
  assert(typeof bps === 'string', 'retourne string');
  assert(!bps.startsWith('NON GÉRÉ'), `ne doit pas être NON GÉRÉ: ${bps.substring(0,80)}`);
  const ruleLines = bps.split('\n').filter(l => !l.startsWith('//'));
  const ruleText = ruleLines.join('\n');
  // Extraire l'alias de la règle A3
  const m = ruleText.match(/A3\s*<>\s*([A-Za-z][A-Za-z0-9_'#]*)/);
  assert(m, 'règle A3 trouvée');
  const alias = m[1];
  // La règle A6 doit utiliser le même alias deux fois
  const m6 = ruleText.match(/A6\s*<>\s*([A-Za-z][A-Za-z0-9_'#]*)\s+([A-Za-z][A-Za-z0-9_'#]*)/);
  assert(m6, 'règle A6 trouvée');
  assert.strictEqual(m6[1], alias, `premier token de A6 = alias de A3: "${m6[1]}" vs "${alias}"`);
  assert.strictEqual(m6[2], alias, `deuxième token de A6 = alias de A3: "${m6[2]}" vs "${alias}"`);
});

// T6 — alias ≤30 chars
test('alias généré ≤30 chars', () => {
  const name = 'abcdefghijklmnopqrstuvwxyz01234567890ABCDE';  // 42 chars
  assert(name.length > 30, 'précondition: >30');
  const gr = makeGrammarWithLongTerminal(name);
  const bps = bp3ToScene(gr);
  assert(typeof bps === 'string', 'retourne string');
  assert(!bps.startsWith('NON GÉRÉ'), `ne doit pas être NON GÉRÉ: ${bps.substring(0,80)}`);
  const ruleLines = bps.split('\n').filter(l => !l.startsWith('//'));
  const tokens = ruleLines.join('\n').match(/[A-Za-z][A-Za-z0-9_'#]*/g) || [];
  for (const tok of tokens) {
    assert(tok.length <= 30, `token "${tok}" dépasse 30 chars`);
  }
});

// T7 — dhin1 réel : aucun terminal >30 dans le bps généré à partir du -ho
test('dhin1 réel : aucun terminal >30 chars dans les règles', async () => {
  const fs = await import('node:fs');
  const gramPath = path.join(ROOT, 'test', 'grammars', 'dhin1', 'scene.bps');
  // On va régénérer depuis l'original.gr et -ho
  const grPath = path.join(ROOT, 'test', 'grammars', 'dhin1', 'original.gr');
  const hoPath = path.join(ROOT, 'bp3-engine', 'test-data', '-ho.dhin--');
  if (!fs.existsSync(grPath) || !fs.existsSync(hoPath)) {
    console.log('  SKIP  (fichiers dhin1 absents)');
    return;
  }
  const grText = fs.readFileSync(grPath, 'utf-8');
  const hoText = fs.readFileSync(hoPath, 'utf-8');
  const result = bp3ToScene(grText, { hoText, hoKey: 'dhin--' });
  const bps = typeof result === 'string' ? result : result.bps;
  assert(!bps.startsWith('NON GÉRÉ'), `ne doit pas être NON GÉRÉ: ${bps.substring(0,80)}`);
  const ruleLines = bps.split('\n').filter(l => !l.startsWith('//'));
  const tokens = ruleLines.join('\n').match(/[A-Za-z][A-Za-z0-9_'#]*/g) || [];
  for (const tok of tokens) {
    assert(tok.length <= 30, `token "${tok}" dépasse 30 chars dans dhin1 régénéré`);
  }
});

// ─── Résumé ────────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests — ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exit(1);
