// Enforcement du modèle producteur/canal (décision Romain 2026-07-14 ; chantier hub [419]).
// Source : hub/decisions/2026-07-14-modele-producteur-canal-eval-transport.md §Le modèle ;
// docs/spec/EBNF.md:185-188 ; docs/spec/AST.md:230-236.
// Deux fail-loud du frontal (parser.js, avant construction des references d'acteur) :
//   a. un producteur `eval.<X>` sort en NATIF → il ne porte PAS de transport ;
//   b. `transport.video` / `transport.visual` n'existent plus (axe visuel SUPPRIMÉ).
// La preuve exerce LES DEUX voies de compilation (BP3 legacy + AST BPx) : le rejet vit dans
// parse(), partagé par les deux.
import { compileToBPxAST } from '../src/transpiler/index.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } }

// Un compileur renvoie { errors[] } sans jamais throw : on prouve le rejet via errors[].
function errsOf(src) {
  return { bp3: compileToBPxAST(src).errors || [], bpx: compileToBPxAST(src).errors || [] };
}
function bothReject(src, needle, label) {
  const { bp3, bpx } = errsOf(src);
  const hit = (arr) => arr.some((e) => (e.message || '').includes(needle));
  check(bp3.length > 0 && hit(bp3), `${label} — voie BP3 CRIE (${needle})`);
  check(bpx.length > 0 && hit(bpx), `${label} — voie BPx CRIE (${needle})`);
}
function bothAccept(src, label) {
  const { bp3, bpx } = errsOf(src);
  check(bp3.length === 0, `${label} — voie BP3 sans erreur : ${JSON.stringify(bp3)}`);
  check(bpx.length === 0, `${label} — voie BPx sans erreur : ${JSON.stringify(bpx)}`);
}

// --- a. eval + transport → REJET ---
bothReject(
  '@actor viz  eval.hydra  transport.audio\nS -> viz\nviz -> `osc(4).out()`',
  'sort en natif',
  'a. eval.hydra + transport.audio',
);
bothReject(
  '@actor beat  transport.midi(ch:3)  eval.strudel\nS -> beat\nbeat -> `s("bd")`',
  'sort en natif',
  'a. transport.midi + eval.strudel (ordre inverse)',
);

// --- b. transport.video / transport.visual → REJET (canal supprimé) ---
bothReject(
  '@actor v  alphabet.western  transport.video\nS -> v.C',
  'SUPPRIMÉ',
  'b. transport.video (acteur de notes, sans eval)',
);
bothReject(
  '@actor v  alphabet.western  transport.visual\nS -> v.C',
  'SUPPRIMÉ',
  'b. transport.visual',
);

// --- Formes CANONIQUES toujours acceptées (non-régression) ---
bothAccept(
  '@actor viz  eval.hydra\nS -> viz\nviz -> `osc(4).out()`',
  'canon : eval SANS transport (sort en natif)',
);
bothAccept(
  '@actor v  alphabet.western  transport.audio\nS -> v.C',
  'canon : acteur de notes AVEC transport.audio',
);
bothAccept(
  '@actor v  alphabet.western  transport.midi(ch:10)\nS -> v.C',
  'canon : transport.midi(ch:10)',
);

console.log(`\n${fail === 0 ? 'OK' : 'ÉCHEC'} — ${pass} passés, ${fail} échoués`);
process.exit(fail ? 1 : 0);
