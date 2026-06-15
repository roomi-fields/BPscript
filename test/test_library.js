// @library.<moteur> "nom" — librairie de runtime liée à un moteur (valeur chaîne).
// Partagée par toutes les voix du moteur ; exposée dans compileBPS().libraries.
import { compileBPS } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }

const r = compileBPS(`@library.strudel "dirt-samples"
@actor beat  transport.audio  eval.strudel
S -> beat
beat -> \`note("c2*4").s("sawtooth")\``);
check(r.errors.length === 0, 'compile sans erreur : ' + JSON.stringify(r.errors));
check(r.libraries && r.libraries.strudel, 'libraries.strudel présent : ' + JSON.stringify(r.libraries));
check(r.libraries && Array.isArray(r.libraries.strudel) && r.libraries.strudel.includes('dirt-samples'),
      'banque "dirt-samples" (tiret préservé via chaîne) : ' + JSON.stringify(r.libraries));

// Plusieurs librairies pour le même moteur s'accumulent.
const r2 = compileBPS(`@library.strudel "dirt-samples"
@library.strudel "tidal-drum-machines"
@actor beat transport.audio eval.strudel
S -> beat
beat -> \`s("bd")\``);
check(r2.libraries.strudel.length === 2, 'deux banques accumulées pour strudel : ' + JSON.stringify(r2.libraries));

// @library sans moteur → erreur claire (pas un silence).
const bad = compileBPS(`@library "dirt-samples"
S -> C4`);
check(bad.errors.length > 0, '@library sans moteur → erreur');

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
