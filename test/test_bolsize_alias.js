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

// ⚠️ T2 à T4 ONT ÉTÉ RETIRÉS le 2026-07-19 — ils testaient une feature SUPPRIMÉE.
//
// Ils exigeaient que le convertisseur ALIASE les terminaux de plus de 30 caractères et
// grave la table d'alias en commentaire d'en-tête du `.bps`. La décision d'architecture du
// 2026-07-18 ([566]) a retiré ce mécanisme : le porteur ne grave plus la troncature du
// moteur BP3 dans le `.bps` (`bp3ToScene.js` : « bolsizeTable reste vide (sans effet) »).
// La limite BOLSIZE est une contrainte du MOTEUR, pas une propriété de la scène — l'inscrire
// dans le `.bps` faisait remonter une limite d'implémentation dans la source de l'auteur.
//
// Ces trois tests ont survécu à la décision et échouaient donc en présentant un retrait
// délibéré comme une régression. On les remplace par l'assertion inverse, qui est la vérité
// ratifiée et qui garde quelque chose de réel : le nom long doit passer TEL QUEL.

test('terminal >30 chars → passe TEL QUEL (plus d\'alias, décision 2026-07-18)', () => {
  const name = 'dhinOOdhagenadhaOOdhagenadhatigegenaka';  // 38 chars
  assert(name.length > 30, 'précondition: >30');
  const gr = makeGrammarWithLongTerminal(name);
  const bps = bp3ToScene(gr);
  assert(typeof bps === 'string', 'retourne string');
  assert(!bps.startsWith('NON GÉRÉ'), `ne doit pas être NON GÉRÉ: ${bps.substring(0,80)}`);
  const ruleText = bps.split('\n').filter((l) => !l.startsWith('//')).join('\n');
  assert(ruleText.includes(name), `le nom long doit apparaître TEL QUEL dans les règles: ${ruleText.substring(0,200)}`);
});

test('aucune table d\'alias n\'est gravée dans l\'en-tête', () => {
  const name = 'dhinOOdhagenadhaOOdhagenadhatigegenaka';
  const gr = makeGrammarWithLongTerminal(name);
  const bps = bp3ToScene(gr);
  const headerText = bps.split('\n').filter((l) => l.startsWith('//')).join('\n');
  assert(!/BOLSIZE|alias/i.test(headerText), `l'en-tête ne doit plus porter de table d'alias: ${headerText}`);
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

// ⚠️ T6 RETIRÉ le 2026-07-19 — même motif que T2-T4.
//
// Il vérifiait que l'ALIAS généré tenait sous 30 caractères. Il n'y a plus d'alias
// (décision 2026-07-18, [566]) : un nom de 42 caractères ressort donc à 42 caractères, et
// c'est le comportement voulu. Le test échouait en signalant comme une faute exactement ce
// que la décision demande.
//
// Ce qu'il reste à garder est en T7, et c'est le test qui vaut : sur une grammaire RÉELLE
// (`dhin1`, via son `-ho`), aucun terminal ne dépasse 30 caractères. Celui-là mesure une
// propriété du corpus, pas une feature retirée.

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
