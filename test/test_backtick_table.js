// Garde-fou : compileBPS expose la table des backticks (id → {interp, code}).
// Prérequis lot 4 Kanopi : router le code encapsulé vers son interpréteur (eval).
import { compileBPS } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }

const src = `@core
@controls
@alphabet.western:browser
S -> \`sc: Synth(\\default, [\\freq, 440])\` C4 \`strudel: s("bd*4")\``;

const r = compileBPS(src);
check(r.errors.length === 0, 'compile sans erreur : ' + JSON.stringify(r.errors));
check(r.backticks && typeof r.backticks === 'object', 'champ backticks présent');

const entries = Object.entries(r.backticks || {});
check(entries.length === 2, 'deux entrées backtick, obtenu ' + entries.length);

const sc = entries.find(([, v]) => v.interp === 'sc');
check(!!sc, 'entrée sc présente');
check(sc && sc[0].startsWith('BTsc'), 'clé sc = BTsc<id> : ' + (sc && sc[0]));
check(sc && sc[1].code.includes('Synth'), 'code sc préservé : ' + (sc && sc[1].code));

const strudel = entries.find(([, v]) => v.interp === 'strudel');
check(!!strudel, 'entrée strudel présente');
check(strudel && strudel[0].startsWith('BTstrudel'), 'clé strudel = BTstrudel<id>');
check(strudel && strudel[1].code.includes('bd*4'), 'code strudel préservé');

// La clé doit correspondre au token émis dans la grammaire (lookup côté Kanopi).
check(sc && r.grammar.includes(sc[0]), 'la clé BTsc<id> apparaît dans la grammaire émise');

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
