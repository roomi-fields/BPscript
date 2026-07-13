// Preuve du canal NEUTRE d'invocation par provenance (chantier libs-provenance,
// décision hub ef75ec6 ; contrat contrats/bpscript-bpx.md §libRefs ; co-seing bpscript 2026-07-13).
//
// Modèle : une librairie = un FICHIER qui DÉCLARE son domaine dedans ; l'invocation =
// provenance + chemin-de-fichier + entrée (dernier segment = entrée). Le domaine n'est PAS
// dans l'adresse (Kairos le lit au résolveur — L27 : BPScript PORTE opaque).
//
// Émission : ast.libRefs (scène, frère de cvInstances) — adresses canoniques opaques.
//   - nu @alphabet.X          → canal LEGACY (slot inchangé), PAS de libRefs.
//   - @factory.<chemin>.<e>   → NEUTRE, adresse NUE (sucre factory. normalisé).
//   - @mine.<chemin>.<e>      → NEUTRE, adresse préfixée 'mine.'.

import { compileToBPxAST } from '../src/transpiler/bpxAst.js';

let ok = 0, ko = 0;
function assert(label, cond, detail) {
  if (cond) { ok++; console.log(`OK  ${label}`); }
  else { ko++; console.log(`KO  ${label}${detail !== undefined ? '  → ' + detail : ''}`); }
}
function astOf(dir) {
  const { ast } = compileToBPxAST(`${dir}\ngate T:sc\nT -> T5\nT5 -> C4 D4\n`);
  return ast || {};
}
function errsOf(dir) {
  const { errors } = compileToBPxAST(`${dir}\ngate T:sc\nT -> T5\nT5 -> C4 D4\n`);
  return (errors || []).map((e) => e.message);
}

console.log('\n=== Forme 1 : nu → LEGACY (pas de libRefs) ===');
{
  const ast = astOf('@alphabet.sargam');
  assert('nu @alphabet.sargam : libRefs OMIS', ast.libRefs === undefined, JSON.stringify(ast.libRefs));
  const slots = (ast.directives || []).filter((d) => d.name === 'alphabet' && d.subkey).map((d) => d.subkey);
  assert('nu @alphabet.sargam : slot legacy présent', slots.includes('sargam'), JSON.stringify(slots));
}

console.log('\n=== Forme 2 : @factory. → NEUTRE (adresse nue, sucre normalisé) ===');
{
  const ast = astOf('@factory.alphabet.sargam');
  assert('@factory.alphabet.sargam → libRefs=["alphabet.sargam"]',
    JSON.stringify(ast.libRefs) === '["alphabet.sargam"]', JSON.stringify(ast.libRefs));
  const slots = (ast.directives || []).filter((d) => d.name === 'alphabet' && d.subkey);
  assert('@factory. : AUCUN slot legacy alphabet', slots.length === 0, JSON.stringify(slots));
}

console.log('\n=== Forme 3 : @mine.chemin.entrée → NEUTRE (préfixe mine.) ===');
{
  const ast = astOf('@mine.ragas.mes-svaras.sa');
  assert('@mine.ragas.mes-svaras.sa → libRefs=["mine.ragas.mes-svaras.sa"] (tiret recollé)',
    JSON.stringify(ast.libRefs) === '["mine.ragas.mes-svaras.sa"]', JSON.stringify(ast.libRefs));
}

console.log('\n=== Dédup + ordre source préservé ===');
{
  const ast = astOf('@mine.ragas.sa\n@mine.ragas.sa\n@factory.tuning.just_intonation');
  assert('dédup + ordre : ["mine.ragas.sa","tuning.just_intonation"]',
    JSON.stringify(ast.libRefs) === '["mine.ragas.sa","tuning.just_intonation"]', JSON.stringify(ast.libRefs));
}

console.log('\n=== Malformé → CRIE en nommant la faute ===');
{
  assert('@mine seul (entrée sans fichier) crie',
    /invocation de librairie malformee '@mine'/.test(errsOf('@mine.sa').join(' | ') || ''), errsOf('@mine.sa').join(' | '));
  assert('@factory seul crie',
    /invocation de librairie malformee '@factory'/.test(errsOf('@factory').join(' | ') || ''), errsOf('@factory').join(' | '));
}

console.log('\n=== Additif : la garde terminaux LEGACY reste factory-seule ===');
{
  // nu @alphabet.sargam + terminaux hors-sargam → la garde fail-loud (Romain 2026-07-05) DOIT crier (legacy intact).
  const errsLegacy = errsOf('@alphabet.sargam');
  assert('legacy : garde terminaux fire (C4 hors sargam)', errsLegacy.some((m) => /terminal 'C4'/.test(m)), errsLegacy.join(' | '));
  // @mine.* (alphabet perso, opaque) : PAS de garde terminaux chez moi (Kairos valide à la résolution).
  const errsMine = errsOf('@mine.ragas.mes-svaras.sa');
  assert('@mine.* : PAS de garde terminaux au compile (opaque)', !errsMine.some((m) => /terminal/.test(m)), errsMine.join(' | '));
}

console.log('\n=== FIX 1 (forme co-signée [338]) : ZÉRO pliage diapason-catalogue pour le canal neutre ===');
{
  const diapasonOf = (dir) => {
    const { ast } = compileToBPxAST(`@core\n@controls\n${dir}\nS -> sa re\n`);
    const def = ((ast && ast.actors) || []).find((a) => a.name === 'default') || ((ast && ast.actors) || [])[0];
    return def && def.values && def.values.diapason;
  };
  assert('@mine.* : diapason NON plié (absent → Kairos résout l\'ancre perso)', diapasonOf('@mine.ragas.sargam') === undefined, String(diapasonOf('@mine.ragas.sargam')));
  assert('@factory.* : diapason NON plié (absent)', diapasonOf('@factory.alphabet.sargam') === undefined, String(diapasonOf('@factory.alphabet.sargam')));
  assert('@diapason:432 EXPLICITE prime toujours (même avec @mine.*)', diapasonOf('@mine.ragas.sargam\n@diapason:432') === 432, String(diapasonOf('@mine.ragas.sargam\n@diapason:432')));
  assert('LEGACY @alphabet.sargam : ancre 240 INCHANGÉE (legacy intact)', diapasonOf('@alphabet.sargam') === 240, String(diapasonOf('@alphabet.sargam')));
  // Non-régression cascade : une scène NUE (aucun composant invoqué) plie TOUJOURS le socle @core.
  // La règle générale ne sur-supprime PAS — le socle ne saute QUE si un composant est invoqué.
  assert('scène NUE (@core seul) : socle @core plié (western 440), PAS absent', diapasonOf('') === 440, String(diapasonOf('')));
}

console.log('\n=== FIX 2 : entrée d\'invocation commençant par un CHIFFRE (accordages 12TET, 22shruti) ===');
{
  const a1 = astOf('@factory.temperaments.12TET');
  assert('@factory.temperaments.12TET parse → libRefs=["temperaments.12TET"]',
    JSON.stringify(a1.libRefs) === '["temperaments.12TET"]', JSON.stringify(a1.libRefs));
  const a2 = astOf('@mine.ragas.22shruti');
  assert('@mine.ragas.22shruti parse → libRefs=["mine.ragas.22shruti"]',
    JSON.stringify(a2.libRefs) === '["mine.ragas.22shruti"]', JSON.stringify(a2.libRefs));
}

console.log(`\n${ko === 0 ? 'OK' : 'ÉCHEC'} — ${ok} passés, ${ko} échoués`);
if (ko > 0) process.exit(1);
