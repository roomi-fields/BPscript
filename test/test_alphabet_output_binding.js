// Canon 'alphabet.X:<sortie>' = transport de l'ACTEUR IMPLICITE + SUPPRESSION browser/webaudio/routing.
// Chantier hub [421]/[423] ; décision 2026-07-16-sortie-acteur-implicite-browser-audio-routing-obsolete.
//   - 'alphabet.X:<sortie>' nomme le transport de l'acteur implicite (décision 2026-07-05 §2 ;
//     bpxAst.applyDefaultActor). Canal canonique = {audio, midi, osc} (EBNF:182).
//   - browser/webaudio SUPPRIMÉS : REJET fail-loud au parse (PAS de normalisation — Romain 2026-07-16).
//   - routing.json SUPPRIMÉ (les deux copies) ; routing rejeté au parse.
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

// --- 'alphabet.X:<sortie>' CANON : le binding est le transport de l'acteur implicite ---
for (const chan of ['audio', 'midi', 'osc']) {
  const { key, errors } = transportKey(`alphabet.western:${chan}\n-----\nS -> C`);
  check(errors.length === 0, `alphabet.western:${chan} compile sans erreur : ${JSON.stringify(errors)}`);
  check(key === chan, `alphabet.western:${chan} → acteur implicite transport '${chan}', obtenu '${key}'`);
}

// --- Noms PÉRIMÉS browser/webaudio → REJETÉS (pas normalisés) ---
rejects('alphabet.western:browser\n-----\nS -> C', 'PÉRIMÉ', 'alphabet.western:browser');
rejects('actor v alphabet.western out.browser\n-----\nS -> v.C', 'PÉRIMÉ', 'out.browser');
rejects('actor v alphabet.western out.webaudio\n-----\nS -> v.C', 'PÉRIMÉ', 'out.webaudio');

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
rejectsBothPaths('alphabet.western:sc\n-----\nS -> C', 'ABOLI', ':sc (ancien sucre transport+eval)');
rejectsBothPaths('alphabet.western:video\n-----\nS -> C', 'liste positive', ':video');
rejectsBothPaths('alphabet.western:foo\n-----\nS -> C', 'liste positive', ':foo (inconnu)');
for (const chan of ['audio', 'midi', 'osc']) {
  acceptsBothPaths(`alphabet.western:${chan}\n-----\nS -> C`, `:${chan} (liste positive)`);
}

// --- routing SUPPRIMÉ → rejeté au parse ---
rejects('routing.studio\nalphabet.western\n-----\nS -> C', "routing", 'routing.studio');
rejects('routing\nalphabet.western\n-----\nS -> C', "routing", 'routing (nu)');

// --- Canon direct inchangé (non-régression) ---
for (const chan of ['audio', 'midi', 'osc']) {
  const { key } = transportKey(`actor v alphabet.western out.${chan}\n-----\nS -> v.C`);
  check(key === chan, `out.${chan} (canon) inchangé, obtenu '${key}'`);
}
{
  const { key } = transportKey('actor v alphabet.western out.midi(ch:3)\n-----\nS -> v.C');
  check(key === 'midi', `out.midi(ch:3) → 'midi', obtenu '${key}'`);
}

// --- routing.json SUPPRIMÉ du dépôt (les deux copies) ---
check(!existsSync(new URL('../lib/routing.json', import.meta.url)), 'lib/routing.json supprimé');

// --- public/lib SUPPRIMÉ EN ENTIER (directive Romain 2026-07-26 : « fais partir la copie ») ---
// `public/lib/` était un MIROIR PÉRIMÉ de `lib/` : 10 des 12 fichiers JSON divergeaient de leur
// original, et trois n'existaient plus que là (`filter.json`, `tuning.json` au singulier,
// `sounds/tabla_perc.json`) — des artefacts d'avant les renommages. Une autorité dupliquée sans
// marqueur de fraîcheur est pire qu'une autorité absente : rien ne permet de dire laquelle est à
// jour, et un lecteur de bonne foi lit la périmée. Le garde porte sur le RÉPERTOIRE, pas sur un
// fichier : c'est le miroir entier qui ne doit pas repousser, pas seulement l'entrée qu'on a
// remarquée. (La vérification jumelle de `routing.json` ci-dessus est ce qui a mis la piste.)
check(!existsSync(new URL('../public/lib', import.meta.url)), 'public/lib/ supprimé (miroir périmé de lib/)');

console.log(`\n${fail === 0 ? 'OK' : 'ÉCHEC'} — ${pass} passés, ${fail} échoués`);
process.exit(fail ? 1 : 0);
