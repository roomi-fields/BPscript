#!/usr/bin/env node
/**
 * GARDE — un wildcard NUMÉROTÉ (`?N`) en ligne de catalogue `@template` est REFUSÉ, pas tronqué.
 *
 * Décision : `hub/decisions/2026-08-04-le-signe-interrogation-est-un-wildcard-le-gabarit-garde-
 * capturer.md`. Le `?` est un wildcard, `$X`/`&X` restent des gabarits. La partie documentaire
 * (LANGUAGE.md:1683-1684) dit déjà : « les mêmes `?` que dans une règle, un par terminal effacé,
 * et toujours ANONYMES : une ligne de catalogue n'a pas de flèche, donc rien à rejouer et pas de
 * numéro. »
 *
 * ⚠️ LE DÉFAUT RÉPARÉ ICI, mesuré AVANT correction (`parseTemplateBody`, parser.js ~2787-2816) :
 * `?N` n'était atteint par AUCUNE branche du `if/else if` de la boucle. Le `?` était compté comme
 * wildcard NU (la boucle `while (at(T.QUESTION))` s'arrête dès qu'elle voit l'INT), puis l'INT
 * restant tombait dans le `else break` final — qui sortait de la boucle EN SILENCE, tronquant tout
 * le reste de la ligne de catalogue sans une erreur. `[1] /1 ?1 ? .` ne gardait qu'un seul
 * `TemplateWildcard` ; ' ? .' disparaissait de l'AST sans warning.
 *
 * C'est le pire mode d'échec : pas de rouge, une ligne de catalogue amputée sans que rien ne le
 * dise. Le correctif REFUSE nommément au lieu de tronquer.
 *
 * ⚠️ CE QUE CE GARDE NE COUVRE PAS : aucun autre comportement du gabarit (le `?` nu en catalogue,
 * le `?N` en règle, les groupes `${...}`/`&{...}`) — ces trois cas sont ici uniquement comme
 * TÉMOINS anti-régression, pour prouver que le refus ne mord QUE la forme numérotée en catalogue.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── 1. LE REFUS — `?N` en ligne de catalogue est une erreur nommée, pas une troncature ─────
{
  const src = `@alphabet.western\n\nS -> C4 D4\n\n@template\n[1] /1 ?1 ? .\n`;
  const r = compileToBPxAST(src);
  ok((r.errors || []).length > 0, `1. '?1' en catalogue doit produire une erreur (reçu ${JSON.stringify(r.errors)})`);
  const msg = (r.errors || [])[0]?.message || '';
  ok(/n'a de sens que dans une règle/.test(msg) && /catalogue/.test(msg) && /flèche/.test(msg),
    `1. le message doit nommer la cause (flèche/catalogue) — reçu : ${msg}`);
  // Et surtout : la ligne ne doit pas être avalée en silence — pas de template tronqué en sortie.
  ok(!r.ast?.template || r.ast.template.length === 0,
    "1. la ligne refusée ne doit pas apparaître amputée dans l'AST (fail-loud, pas de sortie partielle)");
}

// ── 2. TÉMOIN — le signe NU en catalogue reste valide ───────────────────────────────────────
{
  const src = `@alphabet.western\n\nS -> C4 D4\n\n@template\n[1] /1 ? ? .\n`;
  const r = compileToBPxAST(src);
  ok((r.errors || []).length === 0, `2. '?' nu en catalogue doit compiler sans erreur (reçu ${JSON.stringify(r.errors)})`);
  const body = r.ast?.template?.[0]?.body || [];
  ok(body.length === 2 && body[0]?.type === 'TemplateWildcard' && body[0]?.count === 2 && body[1]?.type === 'TemplatePeriod',
    `2. le corps doit garder les TROIS éléments écrits, rien tronqué (reçu ${JSON.stringify(body)})`);
}

// ── 3. TÉMOIN — le signe NUMÉROTÉ dans une RÈGLE (avec flèche) reste valide ─────────────────
{
  const src = `@core\n@alphabet.western\n\n?1 ?1 -> G4\n`;
  const r = compileToBPxAST(src);
  ok((r.errors || []).length === 0, `3. '?1' dans une règle doit compiler sans erreur (reçu ${JSON.stringify(r.errors)})`);
  const lhs = r.ast?.subgrammars?.[0]?.rules?.[0]?.lhs || [];
  ok(lhs.length === 2 && lhs.every(e => e.type === 'Wildcard' && e.index === 1),
    `3. le LHS doit porter deux 'Wildcard' d'index 1 (reçu ${JSON.stringify(lhs)})`);
}

// ── 4. TÉMOIN — gabarit maître/esclave ordinaire (`${...}` / `&{...}`) reste valide ─────────
{
  const src = `@core\n@alphabet.western\n\nS -> \${ C4 D4 } &{ }\n`;
  const r = compileToBPxAST(src);
  ok((r.errors || []).length === 0, `4. gabarit maître/esclave doit compiler sans erreur (reçu ${JSON.stringify(r.errors)})`);
  const rhs = r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [];
  ok(rhs.length === 2 && rhs[0]?.type === 'TemplateMasterGroup' && rhs[1]?.type === 'TemplateSlaveGroup',
    `4. le RHS doit porter un 'TemplateMasterGroup' puis un 'TemplateSlaveGroup' (reçu ${JSON.stringify(rhs.map(e => e.type))})`);
}

if (echecs.length) {
  console.error(`[wildcard numéroté en catalogue] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[wildcard numéroté en catalogue] ${passe} PASS / 0 FAIL`);
