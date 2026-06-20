// Garde-fou : syntaxe du patch CV/modulation (décision Romain 2026-06-20, courrier Kanopi).
// Forme UNIQUE (route, v0.9) : `env1:Bass.cutoff = filter.adsr(...)` — cible = acteur.cvin,
// transport DÉDUIT de la voix. La cible nommée réutilise la notation pointée acteur.membre déjà
// dans le langage. La forme appel legacy `env1(Phrase1, browser) = ...` est SUPPRIMÉE (pas de
// rétrocompat, bêta — une seule forme propre, validée Romain 2026-06-20).
import { tokenize } from '../src/transpiler/tokenizer.js';
import { parse } from '../src/transpiler/parser.js';

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } }
function cvOf(src) {
  const ast = parse(tokenize(src));
  return (ast.cvInstances || []).concat((ast.scenes || []).flatMap((s) => s.cvInstances || []));
}

// 1. Forme route : acteur.cvin, transport déduit (null)
{
  const cvs = cvOf(`env1:Bass.cutoff = filter.adsr(attack:5, decay:150, sustain:0.2, release:400)
S -> {Bass, env1 -}
Bass -> C4 E4`);
  check(cvs.length === 1, 'route : 1 CVInstance, obtenu ' + cvs.length);
  const c = cvs[0] || {};
  check(c.name === 'env1', 'route : name=env1, obtenu ' + c.name);
  check(c.target === 'Bass', 'route : target=Bass (voix), obtenu ' + c.target);
  check(c.cvin === 'cutoff', 'route : cvin=cutoff, obtenu ' + c.cvin);
  check(c.transport === null, 'route : transport déduit (null), obtenu ' + c.transport);
  check(c.lib === 'filter' && c.objectType === 'adsr', 'route : objet filter.adsr');
  check(c.namedArgs && c.namedArgs.release === 400, 'route : namedArgs.release=400');
}

// 2. Forme appel legacy SUPPRIMÉE : `env1(Phrase1, browser) = ...` ne doit PLUS être
//    reconnue comme une déclaration CV (pas de rétrocompat). Le lookahead échoue → ce n'est
//    plus une CVInstance (0 collecté ; le parser la traite autrement / la rejette).
{
  let cvs = [];
  try {
    cvs = cvOf(`env1(Phrase1, browser) = filter.adsr(10, 200, 0.5, 300)
S -> {Phrase1, env1 -}
Phrase1 -> C4 E4`);
  } catch (e) { cvs = []; } // une ParseError est un rejet acceptable
  check(cvs.length === 0, 'legacy supprimé : 0 CVInstance reconnue, obtenu ' + cvs.length);
}

// 3. Forme route avec backtick (modulateur custom)
{
  const cvs = cvOf("wob:Mel.freq = `js: t => Math.sin(t)`\nS -> {Mel, wob -}\nMel -> C4 E4");
  const c = cvs[0] || {};
  check(c.target === 'Mel' && c.cvin === 'freq', 'route backtick : Mel.freq');
  check(c.objectType === 'backtick' && c.transport === null, 'route backtick : objectType=backtick, transport déduit');
}

console.log(`${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
