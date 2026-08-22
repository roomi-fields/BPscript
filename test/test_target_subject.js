// Garde-fou : préfixe de SUJET sur une paire de contrôle (décision Romain 2026-06-21).
// Forme `[sujet:]contrôle:valeur` dans () :
//   (filter:Env)    → sujet omis = la portée elle-même (la règle/le groupe comme unité)
//   (*:filter:Env)  → sujet '*' = chaque terminal (par note)
//   (C2:filter:Env) → sujet 'C2' = les terminaux C2 de la règle
// Cohérent avec l'existant `*:sound.X`. Le sujet décide l'horloge (unité vs par-terminal) ;
// la nature de la valeur ne décide plus rien.
import { compileToBPxAST } from '../src/transpiler/bpxAst.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }
const HEAD = 'mod\ncore\nalphabet.western:audio\nadsr env1\n-----\n';
function bassPairs(rhsLine) {
  const r = compileToBPxAST(HEAD + 'S -> Bass\n' + rhsLine + '\n');
  if (r.errors && r.errors.length) return { err: r.errors };
  const rule = r.ast.subgrammars[0].rules.find((rl) => (Array.isArray(rl.lhs) ? rl.lhs[0] : rl.lhs)?.name === 'Bass');
  return { pairs: rule.settings ? rule.settings.pairs : [] };
}
const get = (pairs, key) => pairs.find((p) => p.key === key) || {};

// 1. Défaut : pas de sujet (= la règle)
{
  const { pairs, err } = bassPairs('Bass -> C2 E2 (filter:400, wave:square)');
  check(!err, '1: pas d\'erreur, ' + JSON.stringify(err));
  check(get(pairs, 'filter').subject === undefined, '1: filter sans sujet (défaut=règle), obtenu ' + JSON.stringify(get(pairs, 'filter')));
}

// 2. Sujet '*' = chaque terminal
{
  const { pairs } = bassPairs('Bass -> C2 E2 (*:filter:400)');
  check(get(pairs, 'filter').subject === '*', '2: filter sujet=*, obtenu ' + JSON.stringify(get(pairs, 'filter')));
}

// 3. Sujet nommé 'C2'
{
  const { pairs } = bassPairs('Bass -> C2 E2 (C2:filter:400)');
  check(get(pairs, 'filter').subject === 'C2', '3: filter sujet=C2, obtenu ' + JSON.stringify(get(pairs, 'filter')));
}

// 4. Mélange : filter par terminal, wave/vel pour la règle (sujets indépendants par paire)
{
  const { pairs } = bassPairs('Bass -> C2 E2 (*:filter:400, wave:square, vel:100)');
  check(get(pairs, 'filter').subject === '*', '4: filter sujet=*');
  check(get(pairs, 'wave').subject === undefined, '4: wave sans sujet (règle)');
  check(get(pairs, 'vel').subject === undefined && get(pairs, 'vel').value === 100, '4: vel sans sujet, valeur 100');
}

// 5. La valeur reste correctement captée avec un sujet (pas de glissement)
{
  const { pairs } = bassPairs('Bass -> C2 E2 (*:filter:400, vel:120)');
  check(get(pairs, 'filter').value === 400, '5: valeur filter=400 préservée, obtenu ' + JSON.stringify(get(pairs, 'filter')));
  check(get(pairs, 'vel').value === 120, '5: vel=120 préservé');
}

// 6. ligne/col toujours présents avec sujet
{
  const { pairs } = bassPairs('Bass -> C2 E2 (*:filter:400)');
  check(typeof get(pairs, 'filter').line === 'number', '6: filter porte une ligne');
}

console.log(`${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
