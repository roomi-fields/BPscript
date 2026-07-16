// Garde-fou : préfixe de SUJET sur une paire de contrôle (décision Romain 2026-06-21).
// Forme `[sujet:]contrôle:valeur` dans () :
//   (cutoff:Env)    → sujet omis = la portée elle-même (la règle/le groupe comme unité)
//   (*:cutoff:Env)  → sujet '*' = chaque terminal (par note)
//   (C2:cutoff:Env) → sujet 'C2' = les terminaux C2 de la règle
// Cohérent avec l'existant `*:sound.X`. Le sujet décide l'horloge (unité vs par-terminal) ;
// la nature de la valeur ne décide plus rien.
import { compileToBPxAST } from '../src/transpiler/bpxAst.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }
const HEAD = '@mod\n@controls\n@alphabet.western:audio\ncv env1 : mod.adsr(attack:5, decay:120, sustain:0.2, release:300)\n';
function bassPairs(rhsLine) {
  const r = compileToBPxAST(HEAD + 'S -> Bass\n' + rhsLine + '\n');
  if (r.errors && r.errors.length) return { err: r.errors };
  const rule = r.ast.subgrammars[0].rules.find((rl) => (Array.isArray(rl.lhs) ? rl.lhs[0] : rl.lhs)?.name === 'Bass');
  return { pairs: rule.runtimeQualifier ? rule.runtimeQualifier.pairs : [] };
}
const get = (pairs, key) => pairs.find((p) => p.key === key) || {};

// 1. Défaut : pas de sujet (= la règle)
{
  const { pairs, err } = bassPairs('Bass -> C2 E2 (cutoff: env1, wave:square)');
  check(!err, '1: pas d\'erreur, ' + JSON.stringify(err));
  check(get(pairs, 'cutoff').subject === undefined, '1: cutoff sans sujet (défaut=règle), obtenu ' + JSON.stringify(get(pairs, 'cutoff')));
}

// 2. Sujet '*' = chaque terminal
{
  const { pairs } = bassPairs('Bass -> C2 E2 (*:cutoff: env1)');
  check(get(pairs, 'cutoff').subject === '*', '2: cutoff sujet=*, obtenu ' + JSON.stringify(get(pairs, 'cutoff')));
}

// 3. Sujet nommé 'C2'
{
  const { pairs } = bassPairs('Bass -> C2 E2 (C2:cutoff: env1)');
  check(get(pairs, 'cutoff').subject === 'C2', '3: cutoff sujet=C2, obtenu ' + JSON.stringify(get(pairs, 'cutoff')));
}

// 4. Mélange : cutoff par terminal, wave/vel pour la règle (sujets indépendants par paire)
{
  const { pairs } = bassPairs('Bass -> C2 E2 (*:cutoff: env1, wave:square, vel:100)');
  check(get(pairs, 'cutoff').subject === '*', '4: cutoff sujet=*');
  check(get(pairs, 'wave').subject === undefined, '4: wave sans sujet (règle)');
  check(get(pairs, 'vel').subject === undefined && get(pairs, 'vel').value === 100, '4: vel sans sujet, valeur 100');
}

// 5. La valeur reste correctement captée avec un sujet (pas de glissement)
{
  const { pairs } = bassPairs('Bass -> C2 E2 (*:cutoff: env1, vel:120)');
  check(get(pairs, 'cutoff').value === 'env1', '5: valeur cutoff=env1 préservée, obtenu ' + JSON.stringify(get(pairs, 'cutoff')));
  check(get(pairs, 'vel').value === 120, '5: vel=120 préservé');
}

// 6. ligne/col toujours présents avec sujet
{
  const { pairs } = bassPairs('Bass -> C2 E2 (*:cutoff: env1)');
  check(typeof get(pairs, 'cutoff').line === 'number', '6: cutoff porte une ligne');
}

console.log(`${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
