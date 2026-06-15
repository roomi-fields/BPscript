// A5 (partie langage) — états de drapeau nommés.
// @flag <nom>: <alias>:<int>, ... nomme les valeurs entières d'un drapeau ;
// les gardes peuvent alors tester par nom : [scene==calm] → /scene=1/.
// compileBPS().flagStates expose la table (Kanopi : commande par nom).
import { compileBPS } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }

const src = `@flag scene: calm:1, full:2
[scene==calm] S -> A
[scene==full] S -> { A, B }
A -> C4
B -> E4`;

const r = compileBPS(src);
check(r.errors.length === 0, 'compile sans erreur : ' + JSON.stringify(r.errors));

// Table exposée
check(r.flagStates && r.flagStates.scene, 'flagStates.scene présent');
check(r.flagStates && r.flagStates.scene && r.flagStates.scene.calm === 1, 'calm = 1');
check(r.flagStates && r.flagStates.scene && r.flagStates.scene.full === 2, 'full = 2');

// Résolution dans les gardes : calm→1, full→2
check(r.grammar.includes('/scene=1/'), 'garde [scene==calm] → /scene=1/ : ' + (r.grammar.match(/\/scene=\d\//g) || []));
check(r.grammar.includes('/scene=2/'), 'garde [scene==full] → /scene=2/');
check(!r.grammar.includes('/scene=calm/'), 'aucun /scene=calm/ non résolu');

// Un IDENT non déclaré comme état reste tel quel (autre drapeau) — pas de fausse résolution.
const r2 = compileBPS(`[phase==other] S -> C4`);
check(r2.errors.length === 0 && r2.grammar.includes('/phase=other/'), 'IDENT non-état inchangé (/phase=other/)');

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
