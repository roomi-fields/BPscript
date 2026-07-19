// Canon '@alphabet.X:<sortie>' = transport de l'ACTEUR IMPLICITE + SUPPRESSION browser/webaudio/routing.
// Chantier hub [421]/[423] ; décision 2026-07-16-sortie-acteur-implicite-browser-audio-routing-obsolete.
//   - '@alphabet.X:<sortie>' nomme le transport de l'acteur implicite (décision 2026-07-05 §2 ;
//     bpxAst.applyDefaultActor). Canal canonique = {audio, midi, osc} (EBNF:182).
//   - browser/webaudio SUPPRIMÉS : REJET fail-loud au parse (PAS de normalisation — Romain 2026-07-16).
//   - routing.json SUPPRIMÉ (les deux copies) ; @routing rejeté au parse.
import { compileToBPxAST } from '../src/transpiler/index.js';
import { existsSync } from 'fs';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } }

function transportKey(src) {
  const r = compileToBPxAST(src);
  const a = (r.ast && r.ast.actors || [])[0];
  return { key: a && a.properties && a.properties.transport && a.properties.transport.key, errors: r.errors };
}
function rejects(src, needle, label) {
  const { errors } = transportKey(src);
  const hit = errors.some((e) => (e.message || '').includes(needle));
  check(errors.length > 0 && hit, `${label} — REJET fail-loud (${needle}) ; obtenu ${JSON.stringify(errors.map((e) => e.message))}`);
}

// --- '@alphabet.X:<sortie>' CANON : le binding est le transport de l'acteur implicite ---
for (const chan of ['audio', 'midi', 'osc']) {
  const { key, errors } = transportKey(`@alphabet.western:${chan}\nS -> C`);
  check(errors.length === 0, `@alphabet.western:${chan} compile sans erreur : ${JSON.stringify(errors)}`);
  check(key === chan, `@alphabet.western:${chan} → acteur implicite transport '${chan}', obtenu '${key}'`);
}

// --- Noms PÉRIMÉS browser/webaudio → REJETÉS (pas normalisés) ---
rejects('@alphabet.western:browser\nS -> C', 'PÉRIMÉ', '@alphabet.western:browser');
rejects('@actor v alphabet.western transport.browser\nS -> v.C', 'PÉRIMÉ', 'transport.browser');
rejects('@actor v alphabet.western transport.webaudio\nS -> v.C', 'PÉRIMÉ', 'transport.webaudio');

// --- LISTE POSITIVE FERMÉE (addendum ratifié Romain 2026-07-16 : « on n'autorise que les 3
// qu'on connaît ») : tout suffixe ∉ {audio, midi, osc} → rejet, sur LES DEUX voies. ':sc'
// (ancien sucre transport+eval, ABOLI), ':video' (axe supprimé), ':foo' (inconnu). ---
function rejectsBothPaths(src, needle, label) {
  for (const [path, fn] of [['BPx', compileToBPxAST]]) {  // voie BP3 retirée le 2026-07-19 (façade héritée supprimée)
    const errors = fn(src).errors || [];
    const hit = errors.some((e) => (e.message || '').includes(needle));
    check(errors.length > 0 && hit, `${label} — voie ${path} CRIE (${needle})`);
  }
}
function acceptsBothPaths(src, label) {
  for (const [path, fn] of [['BPx', compileToBPxAST]]) {  // voie BP3 retirée le 2026-07-19 (façade héritée supprimée)
    const errors = fn(src).errors || [];
    check(errors.length === 0, `${label} — voie ${path} sans erreur : ${JSON.stringify(errors)}`);
  }
}
rejectsBothPaths('@alphabet.western:sc\nS -> C', 'ABOLI', ':sc (ancien sucre transport+eval)');
rejectsBothPaths('@alphabet.western:video\nS -> C', 'liste positive', ':video');
rejectsBothPaths('@alphabet.western:foo\nS -> C', 'liste positive', ':foo (inconnu)');
for (const chan of ['audio', 'midi', 'osc']) {
  acceptsBothPaths(`@alphabet.western:${chan}\nS -> C`, `:${chan} (liste positive)`);
}

// --- @routing SUPPRIMÉ → rejeté au parse ---
rejects('@routing.studio\n@alphabet.western\nS -> C', "@routing", '@routing.studio');
rejects('@routing\n@alphabet.western\nS -> C', "@routing", '@routing (nu)');

// --- Canon direct inchangé (non-régression) ---
for (const chan of ['audio', 'midi', 'osc']) {
  const { key } = transportKey(`@actor v alphabet.western transport.${chan}\nS -> v.C`);
  check(key === chan, `transport.${chan} (canon) inchangé, obtenu '${key}'`);
}
{
  const { key } = transportKey('@actor v alphabet.western transport.midi(ch:3)\nS -> v.C');
  check(key === 'midi', `transport.midi(ch:3) → 'midi', obtenu '${key}'`);
}

// --- routing.json SUPPRIMÉ du dépôt (les deux copies) ---
check(!existsSync(new URL('../lib/routing.json', import.meta.url)), 'lib/routing.json supprimé');
check(!existsSync(new URL('../public/lib/routing.json', import.meta.url)), 'public/lib/routing.json supprimé');

console.log(`\n${fail === 0 ? 'OK' : 'ÉCHEC'} — ${pass} passés, ${fail} échoués`);
process.exit(fail ? 1 : 0);
