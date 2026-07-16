// Garde-fou : validation des VALEURS de contrôle contre la librairie @controls.
// La lib @controls (controls.json) est la SOURCE UNIQUE des valeurs permises :
//   - contrôle à liste fermée (wave: sine|triangle|square|sawtooth) → valeur hors-liste = ERREUR
//   - contrôle à plage (filterQ 0..30, attack 1..5000, vel 0..127…)   → valeur hors-plage = ERREUR
// compileToBPxAST émet ces erreurs (message + line/col) ; Kanopi les affiche en rouge à l'éval.
// Demande Kanopi [113] 2026-06-20. Territoire BPScript (la lib fait foi).
import { compileToBPxAST } from '../src/transpiler/bpxAst.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }
const HEAD = '@controls\n@alphabet.western:audio\n';
function errs(src) { return compileToBPxAST(HEAD + src).errors || []; }

// 1. Valeur hors-liste (enum) → erreur ciblée sur 'wave'
{
  const e = errs('S -> C4 (wave:triangle123, vel:100, filterQ:8)\n');
  check(e.length === 1, '1 erreur attendue (seul wave invalide), obtenu ' + e.length + ' :: ' + JSON.stringify(e));
  check(e[0] && /wave/.test(e[0].message), 'erreur mentionne wave');
  check(e[0] && /triangle123/.test(e[0].message), 'erreur cite la valeur fautive');
  check(e[0] && typeof e[0].line === 'number', 'erreur porte une ligne');
}

// 2. Valeurs valides → aucune erreur
{
  const e = errs('S -> C4 (wave:triangle, vel:100, filterQ:8, attack:20)\n');
  check(e.length === 0, 'valeurs valides : 0 erreur, obtenu ' + e.length + ' :: ' + JSON.stringify(e));
}

// 3. Hors-plage haute (filterQ max 30)
{
  const e = errs('S -> C4 (filterQ:99)\n');
  check(e.length === 1 && /filterQ/.test(e[0].message) && /30/.test(e[0].message),
    'filterQ:99 hors-plage, obtenu ' + JSON.stringify(e));
}

// 4. Hors-plage basse / négatif (vel min 0)
{
  const e = errs('S -> C4 (vel:-5)\n');
  check(e.length === 1 && /vel/.test(e[0].message), 'vel:-5 hors-plage, obtenu ' + JSON.stringify(e));
}

// 5. attack hors-plage (1..5000)
{
  const e = errs('S -> C4 (attack:99999)\n');
  check(e.length === 1 && /attack/.test(e[0].message), 'attack:99999 hors-plage, obtenu ' + JSON.stringify(e));
}

// 6. Contrôle inconnu de la lib → PAS d'erreur (pas de faux positif : alias @cc, controls custom)
{
  const e = errs('S -> C4 (mysteryParam:42)\n');
  check(e.length === 0, 'contrôle inconnu ignoré, obtenu ' + JSON.stringify(e));
}

// 7. Sans @controls chargé → pas de validation (aucune erreur)
{
  const r = compileToBPxAST('@alphabet.western:audio\nS -> C4 (wave:triangle123)\n');
  check((r.errors || []).length === 0, 'sans @controls : 0 erreur, obtenu ' + JSON.stringify(r.errors));
}

// 8. Plusieurs valeurs fautives → plusieurs erreurs
{
  const e = errs('S -> C4 (wave:zzz, filterQ:99)\n');
  check(e.length === 2, '2 erreurs attendues, obtenu ' + e.length + ' :: ' + JSON.stringify(e));
}

console.log(`${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
