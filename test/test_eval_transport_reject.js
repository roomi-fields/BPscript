// Enforcement du modèle producteur/canal (décision Romain 2026-07-14 ; chantier hub [419]).
// Source : hub/decisions/2026-07-14-modele-producteur-canal-eval-transport.md §Le modèle ;
// docs/spec/EBNF.md:185-188 ; docs/spec/AST.md:230-236.
// Deux fail-loud du frontal (parser.js, avant construction des references d'acteur) :
//   a. un producteur `eval.<X>` sort en NATIF → il ne porte PAS de sortie routée (`out`) ;
//   b. `out.video` / `out.visual` n'existent plus (axe visuel SUPPRIMÉ).
// `out` remplace `transport` (décision Romain 2026-08-04) — le nom de ce fichier reste
// historique, la surface qu'il garde est celle de la sortie de l'acteur.
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

// --- a. eval + out → REJET ---
bothReject(
  '@actor viz  eval.hydra  out.audio\nS -> voix\nvoix -> `hydra: osc(4).out()`',
  'sort en natif',
  'a. eval.hydra + out.audio',
);
bothReject(
  '@actor beat  out.midi(ch:3)  eval.strudel\nS -> voix\nvoix -> `strudel: s("bd")`',
  'sort en natif',
  'a. out.midi + eval.strudel (ordre inverse)',
);

// --- b. out.video / out.visual → REJET (canal supprimé) ---
bothReject(
  '@actor v  alphabet.western  out.video\nS -> v.C',
  'SUPPRIMÉ',
  'b. out.video (acteur de notes, sans eval)',
);
bothReject(
  '@actor v  alphabet.western  out.visual\nS -> v.C',
  'SUPPRIMÉ',
  'b. out.visual',
);

// --- Formes CANONIQUES toujours acceptées (non-régression) ---
bothAccept(
  '@actor viz  eval.hydra\nS -> voix\nvoix -> `hydra: osc(4).out()`',
  'canon : eval SANS out (sort en natif)',
);
bothAccept(
  '@actor v  alphabet.western  out.audio\nS -> v.C',
  'canon : acteur de notes AVEC out.audio',
);
bothAccept(
  '@actor v  alphabet.western  out.midi(ch:10)\nS -> v.C',
  'canon : out.midi(ch:10)',
);

console.log(`\n${fail === 0 ? 'OK' : 'ÉCHEC'} — ${pass} passés, ${fail} échoués`);
process.exit(fail ? 1 : 0);
