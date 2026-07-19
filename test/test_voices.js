/**
 * test_voices.js — LANG-SONS-2 : modèle de VOIX ([438], spec hub/projets/lang-sons-spec.md).
 *
 * Couvre :
 *   1. `voice.<nom>` = 7e clé d'entité d'acteur → ActorReference {category:'voice'} (2 voies).
 *   2. PREUVE ORDONNÉE [438] : une voix avec réalisation audio SANS hauteur (alphabet sans
 *      tuning, percussion) est ACCEPTÉE — la hauteur est structurelle (spec §2), pas un flag.
 *   3. Fail-loud : voix inconnue (pas dans lib/voices) ; graphie `voice:` (cutover 2026-07-14).
 *   4. Binding alphabet→voix (champ `voices` de l'alphabet tabla) : validé au parse.
 *   5. Spécialisation `for:<device>` : indexée sous le nom de base (voice.fatbass référable).
 *   6. describeVocabulary expose le catalogue des voix (éditeur).
 *   7. Non-régression : les formes canoniques sans voix compilent inchangées.
 */
import { compileToBPxAST, describeVocabulary } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else { console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); fail++; }
}

// La voie BP3 (compileBPS) a été RETIRÉE de cette table le 2026-07-19 : la façade héritée est
// supprimée (arbitrage Romain — seule la PRODUCTION doit être identique, pas la grammaire).
// Ce test comparait les deux voies ; il ne reste qu'une voie, et c'est le produit.
const PATHS = [['BPx', compileToBPxAST]];
function acceptsBothPaths(label, src) {
  for (const [tag, compile] of PATHS) {
    const r = compile(src);
    check(`${label} [${tag}]`, r.errors.length === 0, JSON.stringify(r.errors[0] || ''));
  }
}
function rejectsBothPaths(label, src, needle) {
  for (const [tag, compile] of PATHS) {
    const r = compile(src);
    const hit = r.errors.some(e => (e.message || '').includes(needle));
    check(`${label} [${tag}]`, hit, `attendu '${needle}', reçu ${JSON.stringify(r.errors[0] || 'aucune erreur')}`);
  }
}

const HDR = '@core\n@controls\n';

console.log('--- 1. voice.<nom> = référence d\'entité (ActorReference) ---');
{
  const src = HDR + '@actor lead @alphabet.western tuning.western_12TET voice.wobble transport.audio\nS -> C4 E4\n';
  const r = compileToBPxAST(src);
  check('compile sans erreur', r.errors.length === 0, JSON.stringify(r.errors[0] || ''));
  const lead = r.ast && r.ast.actors.find(a => a.name === 'lead');
  const vref = lead && lead.references.find(x => x.category === 'voice');
  check('ActorReference category voice présent', !!vref && vref.name === 'wobble', JSON.stringify(lead && lead.references));
  check('properties.voice porté (pipeline interne)', lead && lead.properties.voice === 'wobble');
}

console.log('--- 2. PREUVE [438] : voix audio SANS hauteur (percussion, pas de tuning) ---');
{
  const src = HDR + '@actor tabla @alphabet.tabla voice.bayan_open transport.audio\nS -> dhin ka dhin ti\n';
  acceptsBothPaths('tabla + voice sans tuning accepté', src);
  const r = compileToBPxAST(src);
  const tabla = r.ast && r.ast.actors.find(a => a.name === 'tabla');
  check('aucune référence tuning (hauteur structurelle absente)',
    tabla && !tabla.references.some(x => x.category === 'tuning'));
  check('référence voice posée', tabla && tabla.references.some(x => x.category === 'voice' && x.name === 'bayan_open'));
}

console.log('--- 3. Fail-loud ---');
rejectsBothPaths('voix inconnue rejetée',
  HDR + '@actor x @alphabet.western tuning.western_12TET voice.inexistante transport.audio\nS -> C4\n',
  "voix 'inexistante' inconnue");
rejectsBothPaths('graphie voice: rejetée (cutover : \'.\' appelle un composant)',
  HDR + '@actor x @alphabet.western tuning.western_12TET voice:wobble transport.audio\nS -> C4\n',
  "Écris 'voice.<nom>'");

console.log('--- 4. Binding alphabet→voix (tabla.voices) validé au parse ---');
{
  // La tabla porte une carte voices (lib/alphabets.json) : sa validation passe au bind,
  // par la ligne d'acteur ET par le raccord de scène '@alphabet.tabla:audio'.
  acceptsBothPaths('bind par ligne d\'acteur', HDR + '@actor t @alphabet.tabla transport.audio\nS -> dhin ka\n');
  acceptsBothPaths('bind par raccord de scène', HDR + '@alphabet.tabla:audio\nS -> dhin ka\n');
}

console.log('--- 5. Spécialisation for:<device> — référable par nom de base ---');
acceptsBothPaths('voice.fatbass (base + \'fatbass for:sub37\' en lib)',
  HDR + '@actor bass @alphabet.western tuning.western_12TET voice.fatbass transport.midi(ch:1)\nS -> C2 G2\n');

console.log('--- 6. describeVocabulary expose les voix ---');
{
  const v = describeVocabulary();
  check('catalogue voices présent', Array.isArray(v.voices) && v.voices.length > 0);
  check('noms de base dédupliqués (fatbass unique malgré for:sub37)',
    v.voices.filter(n => n === 'fatbass').length === 1, JSON.stringify(v.voices));
  check('wobble et bayan_open exposés', v.voices.includes('wobble') && v.voices.includes('bayan_open'));
}

console.log('--- 7. Non-régression : formes canoniques sans voix ---');
acceptsBothPaths('acteur canonique sans voix',
  HDR + '@actor sitar @alphabet.sargam tuning.sargam_22shruti transport.midi(ch:3)\nS -> sa re\n');
acceptsBothPaths('acteur NOMMÉ voice (nom libre, pas la clé)',
  HDR + '@actor voice @alphabet.sargam transport.audio\nS -> sa re\n');

console.log(`\n${pass} OK / ${fail} KO`);
process.exit(fail ? 1 : 0);
