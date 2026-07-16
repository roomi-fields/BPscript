// Garde-fou : compileBPS expose la table des backticks (id → {interp, code}).
// Prérequis lot 4 Kanopi : router le code encapsulé vers son interpréteur (eval).
import { compileBPS } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }

const src = `@core
@controls
@alphabet.western:audio
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

// --- Voix-code (migration .kanopi→.bps) : acteur SANS alphabet + backtick NON taggé ---
// alphabet optionnel pour une voix-code (eval présent) ; l'interpréteur du backtick non
// taggé est résolu depuis l'eval de l'acteur propriétaire (tête de règle).
// Canon producteur/canal (Romain 2026-07-14) : un acteur `eval` sort en NATIF → PAS de transport.
const m = compileBPS(`@actor groove  eval.strudel
@actor viz     eval.hydra
S -> { groove, viz }
groove -> \`stack(note("c2*4"))\`
viz -> \`osc(60).out()\``);
check(m.errors.length === 0, 'voix-code sans alphabet : compile sans erreur : ' + JSON.stringify(m.errors));
const interps = Object.values(m.backticks || {}).map(v => v.interp).sort();
check(interps.length === 2, 'deux voix-code, obtenu ' + interps.length);
check(interps.includes('strudel'), 'backtick non taggé de groove → interp strudel (eval de l\'acteur)');
check(interps.includes('hydra'), 'backtick non taggé de viz → interp hydra (eval de l\'acteur)');
check(!interps.includes('auto'), 'aucun interp \'auto\' résiduel (tous résolus depuis l\'acteur)');

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
