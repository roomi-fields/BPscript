#!/usr/bin/env node
/**
 * GARDE — l'AROBASE est obligatoire en partie déclarative, et le DEUX-POINTS tranche le sens.
 *
 * Deux décisions de Romain du 2026-07-29, livrées ensemble parce qu'elles touchent LES MÊMES
 * LIGNES — 12 scènes sur 263, 27 occurrences. Les livrer séparément aurait fait migrer Kanopi
 * deux fois pour les mêmes lignes ; c'est un choix de séquencement, pas de périmètre.
 *
 * 1. LA FORME NUE EST SUPPRIMÉE, pas dépréciée. Ma grammaire l'annonçait comme « format legacy
 *    toujours supporté » : c'était de la rétrocompatibilité conservée, donc elle tombe sous la
 *    règle du 2026-07-19. Une partie déclarative se lit à l'œil quand toutes ses lignes portent le
 *    même signe ; une exception par type le défait.
 *
 * 2. LE DEUX-POINTS TRANCHE, ET C'EST LE RETRAIT D'UNE DEVINETTE. Le compilateur distinguait la
 *    déclaration d'un modulateur de la pose d'une propriété d'après ce qui SUIVAIT le deux-points
 *    (`lib.type(…)` ou un bloc de code ?). C'est exactement le mécanisme qui a condamné le signe
 *    `=` le 27 juillet — un sens qui dépend du contexte. Désormais :
 *      · AVEC `:` → PROPRIÉTÉ posée sur un nom qui existe ;
 *      · SANS `:` → DÉCLARATION qui crée un nom, forme unique `@<directive> <nom> <valeur>`.
 *    Romain généralise aux QUATRE types : « en toute logique les 2 formes s'appliquent aux 4 ».
 *
 * ⚠️ ET UN DÉFAUT TROUVÉ EN LIVRANT, de la famille exacte que je répare ce matin : la déclaration
 * sans deux-points était PARSÉE PUIS RANGÉE PARMI LES DIRECTIVES — donc invisible de tout ce qui
 * cherche un modulateur. Un objet déclaré que rien ne pouvait invoquer, sans une erreur. Le §3 le
 * garde : il ne suffit pas que ça compile, il faut que l'objet ARRIVE.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const err = (src) => {
  try { return (compileToBPxAST(src).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};
const S = '@core\n@alphabet.western\n';

// ── 1. LA FORME NUE — refusée, avec la réécriture ───────────────────────────────────────────
// ⚠️ TROIS TYPES, PAS QUATRE, ET C'EST MESURÉ. J'avais écrit ce bloc sur les quatre types que
// Romain nomme — puis mesuré que `var` n'a JAMAIS eu de forme nue : le lexeur ne connaît que
// `gate`, `trigger` et `cv` comme mots de déclaration (tokenizer.js:115-117), il n'y a pas de
// jeton `var`. Exiger une pierre tombale pour une forme qui n'a jamais existé aurait été un
// témoin qui décrit mon intention plutôt que le langage. `var` est éprouvé au §2, sur ses deux
// formes arobasées, qui sont les seules qu'il ait.
const TYPES = ['gate', 'trigger', 'cv'];
console.log(`[arobase obligatoire] ${TYPES.length} types a forme nue x formes nue / arobasée`);
for (const t of TYPES) {
  const nu = err(`${S}${t} X:midi\nS -> C4\n`);
  ok(nu.length >= 1, `1. '${t}' sans arobase doit être REFUSÉ`);
  ok(nu.some((m) => m.includes(`'${t}' sans arobase`)),
    `1. '${t}' — le refus doit NOMMER la forme morte (reçu : ${nu[0]})`);
  ok(nu.some((m) => m.includes(`'@${t}`)),
    `1. '${t}' — le refus doit donner la RÉÉCRITURE, sinon il constate sans aider`);
}

// ── 2. LES DEUX FORMES AROBASÉES — chacune à sa place ───────────────────────────────────────
ok(err(`${S}@gate C4:midi\nS -> C4\n`).length === 0,
  '2. PROPRIÉTÉ — `@gate C4:midi` pose une propriété sur un nom qui existe');
ok(err(`${S}@cv env1 mod.adsr(attack:5)\nS -> C4\n`).length === 0,
  '2. DÉCLARATION — `@cv env1 mod.adsr(…)` crée un nom, sans deux-points');
ok(err(`${S}@cv w \`js: (t,d) => 0.5\`\nS -> C4\n`).length === 0,
  '2. DÉCLARATION par bloc de code — même forme, sans deux-points');
// Une déclaration SANS valeur ne déclare rien : elle doit le dire plutôt que passer.
{
  const e = err(`${S}@gate X\nS -> C4\n`);
  ok(e.length >= 1, '2. `@gate X` sans valeur ne déclare rien et doit être refusé');
  ok(e.some((m) => /ne déclare rien/.test(m)), '2. et le refus doit dire POURQUOI');
}

// ── 3. L'OBJET DÉCLARÉ DOIT ARRIVER — pas seulement compiler ────────────────────────────────
// ⚠️ C'EST ICI QUE LE DÉFAUT S'EST MONTRÉ. La déclaration sans deux-points compilait proprement
// et le modulateur était rangé parmi les directives : déclaré, invisible, non invocable. « Ça
// compile » n'est pas « ça arrive » — c'est la même famille que la directive jetée après les
// règles, à un aiguillage près.
{
  const r = compileToBPxAST(`${S}@cv env1 mod.adsr(attack:5)\nS -> C4 env1\n`);
  ok((r.errors || []).length === 0, '3. la scène doit compiler');
  ok((r.ast?.cvInstances || []).some((c) => c.name === 'env1'),
    `3. le modulateur déclaré doit ARRIVER dans l'arbre (reçu : ${JSON.stringify((r.ast?.cvInstances || []).map((c) => c.name))})`);
  ok(!(r.ast?.directives || []).some((d) => d && d.name === 'cv'),
    '3. et il ne doit PAS traîner parmi les directives de scène');
}
{
  const r = compileToBPxAST(`${S}@gate C4:midi\nS -> C4\n`);
  ok((r.ast?.declarations || []).some((d) => d.name === 'C4' && d.runtime === 'midi'),
    `3. la PROPRIÉTÉ doit arriver dans les déclarations (reçu : ${JSON.stringify(r.ast?.declarations)})`);
}

// ── 4. SOCLE ET ANTI-RÉTRÉCISSEMENT ─────────────────────────────────────────────────────────
ok(TYPES.length === 3, `4. les trois types À FORME NUE doivent être éprouvés — ${TYPES.length}`);
ok(err(`${S}@var v\nS -> C4 v\n`).length === 0,
  '4. `@var` n\'a jamais eu de forme nue : sa forme arobasée doit passer');
ok(err(`${S}gate C4:midi\nS -> C4\n`).length >= 1,
  '4. TÉMOIN — la pierre tombale doit MORDRE (sinon tout ce fichier ment)');
ok(err(`${S}@gate C4:midi\nS -> C4\n`).length === 0,
  '4. TÉMOIN — et se TAIRE sur la forme vivante (sinon elle refuserait tout)');

if (echecs.length) {
  console.error(`[arobase obligatoire] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[arobase obligatoire] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
