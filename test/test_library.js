// @library.<moteur> "nom" — librairie de runtime liée à un moteur (valeur chaîne).
// Partagée par toutes les voix du moteur.
//
// ⚠️ Ce test lisait `compileBPS().libraries`, une TABLE PARALLÈLE que seule la façade héritée
// exposait. Elle est supprimée avec elle (arbitrage Romain 2026-07-19). On lit désormais la
// SOURCE UNIQUE — l'arbre : la directive vit dans `ast.directives` sous forme
// `LibraryDirective { engine, name }`. C'est la directive « source unique = l'arbre, zéro table
// parallèle » (Romain 2026-06-17) appliquée : l'information n'a pas disparu, elle est lue là où
// elle vit réellement au lieu d'une vue recopiée à côté.
import { compileToBPxAST } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }

const r = compileToBPxAST(`@library.strudel "dirt-samples"
@actor beat  eval.strudel
S -> beat
beat -> \`note("c2*4").s("sawtooth")\``);
check(r.errors.length === 0, 'compile sans erreur : ' + JSON.stringify(r.errors));
const libs = (r.ast.directives || []).filter((d) => d.type === 'LibraryDirective');
check(libs.some((d) => d.engine === 'strudel'), 'LibraryDirective strudel présente : ' + JSON.stringify(libs));
check(libs.some((d) => d.engine === 'strudel' && d.name === 'dirt-samples'),
      'banque "dirt-samples" (tiret préservé via chaîne) : ' + JSON.stringify(libs));

// Plusieurs librairies pour le même moteur s'accumulent.
const r2 = compileToBPxAST(`@library.strudel "dirt-samples"
@library.strudel "tidal-drum-machines"
@actor beat eval.strudel
S -> beat
beat -> \`s("bd")\``);
const libs2 = (r2.ast.directives || []).filter((d) => d.type === 'LibraryDirective' && d.engine === 'strudel');
check(libs2.length === 2, 'deux banques accumulées pour strudel : ' + JSON.stringify(libs2));

// @library sans moteur → erreur claire (pas un silence).
const bad = compileToBPxAST(`@library "dirt-samples"
S -> C4`);
check(bad.errors.length > 0, '@library sans moteur → erreur');

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
