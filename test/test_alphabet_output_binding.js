// Canon '@alphabet.X:<sortie>' = transport de l'ACTEUR IMPLICITE + suppression de routing.json.
// Chantier hub [421] ; décision hub/decisions/2026-07-16-sortie-acteur-implicite-browser-audio-routing-obsolete.md.
//   - '@alphabet.X:<sortie>' nomme le transport de l'acteur implicite (décision 2026-07-05 §2 ;
//     bpxAst.applyDefaultActor). Canal canonique = {audio, midi, osc} (EBNF:182).
//   - Orthographes PÉRIMÉES normalisées → audio (schema.transportAliases, lib/core.json) :
//     'browser' (profil abandonné) et 'webaudio' (EBNF:189 alias de audio).
//   - routing.json SUPPRIMÉ : plus de map profils 'browser→webaudio'.
import { compileToBPxAST } from '../src/transpiler/index.js';
import { existsSync } from 'fs';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } }

// transport de l'acteur implicite après compile (l'acteur synthétique 'default' ou l'@actor).
function transportKey(src) {
  const r = compileToBPxAST(src);
  const a = (r.ast && r.ast.actors || [])[0];
  return { key: a && a.properties && a.properties.transport && a.properties.transport.key, errors: r.errors };
}

// --- '@alphabet.X:<sortie>' CANON : le binding est le transport de l'acteur implicite ---
for (const [chan, label] of [['audio', 'audio'], ['midi', 'midi'], ['osc', 'osc']]) {
  const { key, errors } = transportKey(`@alphabet.western:${chan}\nS -> C`);
  check(errors.length === 0, `@alphabet.western:${chan} compile sans erreur : ${JSON.stringify(errors)}`);
  check(key === label, `@alphabet.western:${chan} → acteur implicite transport '${label}', obtenu '${key}'`);
}

// --- ':browser' orthographe PÉRIMÉE → normalisée vers audio (tolérée, pas rejetée) ---
{
  const { key, errors } = transportKey('@alphabet.western:browser\nS -> C');
  check(errors.length === 0, `@alphabet.western:browser toléré (pas d'erreur) : ${JSON.stringify(errors)}`);
  check(key === 'audio', `@alphabet.western:browser (périmé) → 'audio', obtenu '${key}'`);
}

// --- 'transport.browser' / 'transport.webaudio' sur @actor explicite → audio ---
for (const legacy of ['browser', 'webaudio']) {
  const { key, errors } = transportKey(`@actor v alphabet.western transport.${legacy}\nS -> v.C`);
  check(errors.length === 0, `transport.${legacy} toléré : ${JSON.stringify(errors)}`);
  check(key === 'audio', `transport.${legacy} (périmé) → 'audio', obtenu '${key}'`);
}

// --- Canon direct inchangé (non-régression) ---
for (const chan of ['audio', 'midi', 'osc']) {
  const { key } = transportKey(`@actor v alphabet.western transport.${chan}\nS -> v.C`);
  check(key === chan, `transport.${chan} (canon) inchangé, obtenu '${key}'`);
}
{
  const { key } = transportKey('@actor v alphabet.western transport.midi(ch:3)\nS -> v.C');
  check(key === 'midi', `transport.midi(ch:3) → 'midi', obtenu '${key}'`);
}

// --- routing.json SUPPRIMÉ du dépôt ---
check(!existsSync(new URL('../lib/routing.json', import.meta.url)), 'lib/routing.json supprimé du dépôt');

console.log(`\n${fail === 0 ? 'OK' : 'ÉCHEC'} — ${pass} passés, ${fail} échoués`);
process.exit(fail ? 1 : 0);
