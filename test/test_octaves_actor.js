// Garde-fou : `octaves` = 6e clé d'entité d'acteur (décision cles-acteur-six, Romain 2026-06-16).
// `@actor X octaves.Y` SURCHARGE la convention de registre ; défaut = héritée de l'alphabet.
// Résolu en amont (actorResolver) : ne traverse pas l'AST vers BPx.
import { tokenize } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';
import { resolveActors } from '../src/transpiler/actorResolver.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }

function resolve(src) {
  const ast = parse(tokenize(src));
  return { ast, res: resolveActors(ast) };
}

// 1. Parser : octaves.Y est reconnu comme clé d'entité (properties.octaves)
{
  const { ast } = resolve(`@actor sitar
  alphabet.sargam
  octaves.arrows
  transport.webaudio
S -> sitar.sa`);
  const a = ast.actors.find((x) => x.name === 'sitar');
  check(!!a, 'acteur sitar parsé');
  check(a && a.properties.octaves === 'arrows', 'properties.octaves = "arrows", obtenu ' + (a && a.properties.octaves));
  check(a && a.properties.alphabet === 'sargam', 'properties.alphabet = "sargam"');
}

// 2. Défaut : sans octaves, hérite de la convention de l'alphabet (sargam → saptak, préfixe)
{
  const { res } = resolve(`@actor sitar
  alphabet.sargam
  transport.webaudio
S -> sitar.sa`);
  check(res.errors.length === 0, 'résolution sans erreur (défaut) : ' + JSON.stringify(res.errors));
  const syms = res.actorTable.sitar.symbols;
  check(syms.includes('madhya sa'), 'défaut saptak : "madhya sa" présent, symboles=' + JSON.stringify(syms.slice(0, 4)));
  check(!syms.some((s) => s.includes('_^^')), 'défaut saptak : pas de marqueur arrows');
}

// 3. Surcharge : octaves.arrows change la convention de registre (suffixe _, vv/v//^/^^)
{
  const { res } = resolve(`@actor sitar
  alphabet.sargam
  octaves.arrows
  transport.webaudio
S -> sitar.sa`);
  check(res.errors.length === 0, 'résolution sans erreur (surcharge) : ' + JSON.stringify(res.errors));
  const syms = res.actorTable.sitar.symbols;
  check(syms.some((s) => s.includes('sa_^^')), 'surcharge arrows : "sa_^^" présent, symboles=' + JSON.stringify(syms.slice(0, 4)));
  check(!syms.includes('madhya sa'), 'surcharge arrows : plus de marqueur saptak "madhya sa"');
}

console.log(`\n${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
