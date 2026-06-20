// Garde-fou : validation des noms d'entrées de modulation au branchement (cutoff/amplitude/...).
// Registre lib/modulation.json (5 entrées webaudio, source Kanopi). Déclencheur PAR LA VALEUR :
// une paire (KEY: VALUE) n'est validée que si VALUE est une source de modulation (CV déclaré ou
// non-terminal dérivant vers des CV). Résout la collision 'pan' (contrôle MIDI 0..127 vs entrée
// webaudio -1..1) sans dépendre du transport. Demande Romain 2026-06-20.
import { compileToBPxAST } from '../src/transpiler/bpxAst.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }
const HEAD = '@mod\n@controls\n@alphabet.western:browser\n';
function errs(src) { return compileToBPxAST(HEAD + src).errors || []; }

// 1. Branchement valide : cutoff <- CV → 0 erreur
{
  const e = errs('cv env1 : mod.adsr(attack:5, decay:150, sustain:0.2, release:400)\nS -> Bass\nBass -> C2 (cutoff: env1)\n');
  check(e.length === 0, '1: (cutoff: env1) valide, obtenu ' + JSON.stringify(e));
}

// 2. Faute de frappe sur l'entrée : cutof <- CV → erreur ligne/col
{
  const e = errs('cv env1 : mod.adsr(attack:5, decay:150, sustain:0.2, release:400)\nS -> Bass\nBass -> C2 (cutof: env1)\n');
  check(e.length === 1 && /cutof/.test(e[0].message), '2: (cutof: env1) -> erreur, obtenu ' + JSON.stringify(e));
  check(e[0] && typeof e[0].line === 'number', '2: erreur porte une ligne');
}

// 3. Toutes les entrées valides : pan/amplitude/resonance/pitch <- CV (une par règle)
{
  const e = errs('cv m : mod.lfo(rate:2, amplitude:0.8, shape:sine)\n'
    + 'S -> A B C D\n'
    + 'A -> C2 (pan: m)\nB -> D2 (amplitude: m)\nC -> E2 (resonance: m)\nD -> F2 (pitch: m)\n');
  check(e.length === 0, '3: pan/amplitude/resonance/pitch valides, obtenu ' + JSON.stringify(e));
}

// 4. Collision 'pan' : valeur LITTÉRALE → contrôle normal, PAS une modulation (pas d'erreur modulation)
{
  const e = errs('S -> Bass\nBass -> C2 (pan: 100)\n');
  check(e.length === 0, '4: (pan: 100) littéral = contrôle MIDI, pas validé en modulation, obtenu ' + JSON.stringify(e));
}

// 5. Brancher un CV sur un NON-entrée (vel n'est pas une entrée de modulation) → erreur
{
  const e = errs('cv env1 : mod.adsr(attack:5, decay:150, sustain:0.2, release:400)\nS -> Bass\nBass -> C2 (vel: env1)\n');
  check(e.length === 1 && /vel/.test(e[0].message), '5: (vel: env1) -> erreur (vel pas une entrée), obtenu ' + JSON.stringify(e));
}

// 6. Indirection : (cutoff: Env) où Env -> env1 | env2 → Env reconnu comme source → cutoff valide
{
  const e = errs('cv env1 : mod.adsr(attack:5, decay:150, sustain:0.2, release:400)\n'
    + 'cv env2 : mod.adsr(attack:3, decay:100, sustain:0.2, release:400)\n'
    + 'S -> {Bass Bass, Env Env}\nBass -> C2 C3 (cutoff: Env)\nEnv -> env1\nEnv -> env2\n');
  check(e.length === 0, '6: (cutoff: Env) indirection valide, obtenu ' + JSON.stringify(e));
}

// 7. Indirection + faute : (cutof: Env) → erreur
{
  const e = errs('cv env1 : mod.adsr(attack:5, decay:150, sustain:0.2, release:400)\n'
    + 'S -> {Bass, Env}\nBass -> C2 (cutof: Env)\nEnv -> env1\n');
  check(e.length === 1 && /cutof/.test(e[0].message), '7: (cutof: Env) -> erreur, obtenu ' + JSON.stringify(e));
}

// 8. Valeur quelconque non-CV (symbole normal) → pas de validation modulation (pas de faux positif)
{
  const e = errs('S -> Bass\nBass -> C2 (cutoff: 2000)\n');
  check(e.length === 0, '8: (cutoff: 2000) littéral non-CV -> pas validé en modulation, obtenu ' + JSON.stringify(e));
}

console.log(`${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
