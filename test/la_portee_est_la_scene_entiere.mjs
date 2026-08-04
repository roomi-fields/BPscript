#!/usr/bin/env node
/**
 * GARDE — PORTÉE UNIQUE : un nom déclaré vaut dans TOUTE la scène, et les QUATRE déclarations
 * de terminal restent.
 *
 * Deux points du lot de langage de Romain (2026-07-29), dont l'architecte dit lui-même qu'ils
 * « ne demandent que des gardes » — parce qu'ils DÉCRIVENT L'ÉTAT ACTUEL. Il les inscrit
 * « pour qu'ils cessent d'être implicites ».
 *
 * ⚠️ ET C'EST EXACTEMENT LÀ QUE CE FICHIER SERT, sinon il ne serait qu'une redite. Un comportement
 * qui n'est vrai que par accident se perd au premier refactor, sans que rien ne le signale : il n'y
 * a pas de rouge pour une règle que personne n'a écrite. J'ai payé cette forme quatre fois
 * aujourd'hui — le validateur qui ne descendait pas dans les groupes était lui aussi « l'état
 * actuel » que personne n'avait inscrit.
 *
 * POINT 1 — PORTÉE UNIQUE. Aucun nom n'est local à une sous-grammaire. Les trois seules exceptions
 * sont des CORPS DE BLOCS : propriétés d'un `@actor`, affectations de son d'un `@alphabet.X`,
 * paramètres d'une `@macro`.
 * POINT 5 — LES QUATRE DÉCLARATIONS DE TERMINAL RESTENT : `@gate X:cible`, `@trigger X:cible`,
 * `@cv X:cible`, `@var X`. Romain : « on garde les 4, ils ont bien leur utilité ». C'est la voie
 * qui permet de déclarer un terminal DIRECTEMENT dans la scène sans passer par un alphabet — et
 * c'est ce qui a sauvé `@var`, dont la suppression avait été proposée puis retirée.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const err = (src) => {
  try { return (compileToBPxAST(`@core\n@alphabet.western\n${src}`).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};

// ── 1. LES QUATRE DÉCLARATIONS — chacune déclare, et son nom est UTILISABLE dans le flux ────
// Il ne suffit pas qu'elles compilent : le nom doit ARRIVER quelque part. « Ça compile » n'est pas
// « ça arrive » — c'est le défaut trouvé le matin même sur `@cv` sans deux-points, rangé parmi les
// directives et invisible de tout ce qui cherche un modulateur.
const DECLARATIONS = [
  ['@gate',    '@gate C4:midi\nS -> C4',                        (a) => (a.declarations || []).some((d) => d.name === 'C4')],
  ['@trigger', '@controls\n@trigger sync1:midi\nS -> C4 <!sync1', (a) => (a.declarations || []).some((d) => d.name === 'sync1')],
  ['@cv',      '@mod\n@cv env1 mod.adsr(attack:5)\nS -> C4 env1', (a) => (a.cvInstances || []).some((c) => c.name === 'env1')],
  ['@var',     '@var travail\nS -> C4 travail',                   (a) => (a.vars || []).includes('travail')],
];
console.log(`[portée unique] ${DECLARATIONS.length} déclarations de terminal`);
for (const [nom, src, arrive] of DECLARATIONS) {
  const r = compileToBPxAST(`@core\n@alphabet.western\n${src}\n`);
  ok((r.errors || []).length === 0, `1. '${nom}' doit compiler — ${(r.errors || []).map((e) => e.message)[0] ?? ''}`);
  ok(r.ast ? arrive(r.ast) : false, `1. '${nom}' — le nom déclaré doit ARRIVER dans l'arbre, pas seulement compiler`);
}

// ── 2. LA PORTÉE EST LA SCÈNE ENTIÈRE — le séparateur de blocs ne coupe RIEN ────────────────
// C'est le cœur du point 1 : un nom déclaré avant le premier bloc vaut encore après le cinquième
// tiret. Si quelqu'un rendait un jour les noms locaux à une sous-grammaire, ces témoins rougissent.
const A_TRAVERS_LES_BLOCS = [
  ['une variable de travail', '@var v\nS -> C4 v\n-----\nT -> v C4\nS -> T'],
  ['une macro',               '@macro m saw >> audio\nS -> m C4\n-----\nT -> m\nS -> T'],
  ['un alias',                '@alias g cc:2\nS -> C4\n-----\nT -> C4\nS -> T'],
  ['une déclaration de gate', '@gate C4:midi\nS -> C4\n-----\nT -> C4\nS -> T'],
];
for (const [quoi, src] of A_TRAVERS_LES_BLOCS) {
  ok(err(src).length === 0,
    `2. ${quoi} déclarée avant le premier bloc vaut APRÈS le séparateur (reçu : ${err(src)[0] ?? ''})`);
}
// Et une TÊTE de règle traverse aussi — c'est ce qui fait de deux sous-grammaires deux PASSES.
// ⚠️ CE TÉMOIN A ÉTÉ RÉÉCRIT : mon premier jet passait par `err()`, qui préfixe déjà
// `@alphabet.western`, et j'y ajoutais `@alphabet.simple`. DEUX alphabets déclarés, le premier
// gagne, donc mes terminaux abstraits sortaient inconnus — et j'ai failli lire ça comme une
// portée qui coupe. L'instrument, encore : un témoin qui hérite d'un préfixe qu'il ne voit pas.
{
  const r = compileToBPxAST('@core\n@alphabet.simple\nS -> X\nX -> a b\n-----\nX -> c d\n');
  ok((r.errors || []).length === 0,
    `2. la même tête dans deux sous-grammaires reste légitime — deux passes, pas deux portées `
    + `(reçu : ${(r.errors || []).map((e) => e.message)[0] ?? ''})`);
}

// ── 3. LES TROIS EXCEPTIONS SONT DES CORPS DE BLOCS, ET ELLES RESTENT LOCALES ───────────────
// Un paramètre de macro ne fuit pas dans la scène : c'est la seule localité que le langage admet.
{
  const r = compileToBPxAST('@core\n@alphabet.western\n@macro accent(x) x(vel:120)\nS -> C4\n');
  ok((r.errors || []).length === 0, '3. un paramètre de macro doit compiler');
  ok(!(r.ast?.vars || []).includes('x') && !(r.ast?.declarations || []).some((d) => d.name === 'x'),
    '3. et il ne FUIT PAS dans les noms de la scène — la localité du corps est la seule admise');
}
{
  // Les propriétés d'un @actor sont un corps de bloc : elles ne déclarent pas des noms de scène.
  const r = compileToBPxAST('@core\n@actor v\n  alphabet.western\n  out.audio\nS -> v.C4\n');
  ok((r.errors || []).length === 0, '3. les propriétés d\'un @actor doivent compiler');
  ok(!(r.ast?.vars || []).includes('alphabet'),
    '3. et elles ne fuient pas non plus — un mot de propriété n\'est pas un nom de scène');
}

// ── 4. SOCLE ET TÉMOINS D'INSTRUMENT ────────────────────────────────────────────────────────
ok(DECLARATIONS.length === 4, `4. les QUATRE déclarations doivent être éprouvées — ${DECLARATIONS.length}`);
ok(A_TRAVERS_LES_BLOCS.length >= 4, '4. la matrice des traversées ne s\'est pas vidée');
// TÉMOIN — le garde doit savoir MORDRE : un nom JAMAIS déclaré reste refusé, séparateur ou pas.
ok(err('S -> C4\n-----\nT -> zzz\nS -> T').length >= 1,
  '4. TÉMOIN — un nom jamais déclaré reste refusé après un séparateur (sinon ce fichier ne prouve rien)');

if (echecs.length) {
  console.error(`[portée unique] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[portée unique] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
