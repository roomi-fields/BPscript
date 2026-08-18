#!/usr/bin/env node
/**
 * GARDE — LE PRÉFIXE D'ACTEUR SE POSE SUR LE TERME, JAMAIS SUR LA CONSTRUCTION QUI L'ENVELOPPE.
 *
 * DÉCISION ROMAIN (2026-08-10), mot pour mot : « c'est correct, ça doit passer, l'acteur doit être
 * posé sur chaque terminal pas le groupe ».
 *
 * ⚠️ LE MODE D'ÉCHEC ÉTAIT UNE ACCUSATION À L'ENVERS. `chant.A2!chant.A4` était REFUSÉ pour
 * « Ambiguous symbol "A2" » alors que `chant.A2` seul passait — le refus reprochait à l'auteur une
 * ambiguïté qu'il avait précisément levée, et lui demandait d'écrire ce qu'il avait déjà écrit.
 * Cause : l'acteur atterrissait sur le nœud de la frappe commune, et la résolution ne le lit que
 * sur les Symbol et SymbolCall (actorResolver.js:439-442). Le préfixe était présent dans l'arbre et
 * invisible à qui devait s'en servir.
 *
 * ⚠️ CE GARDE ÉPROUVE L'ESPACE, PAS LA FORME SIGNALÉE. Le signalement portait sur une seule
 * écriture. Ce qui est éprouvé ici : les deux places du préfixe (à gauche, à droite), les deux
 * graphies du signe (collé, espacé), les termes simples ET les appels, la chaîne à trois termes, et
 * les constructions VOISINES qui enveloppent elles aussi un terme — parce qu'un préfixe perdu dans
 * un groupe ou une polymétrie aurait exactement le même mode d'échec, et personne ne l'a signalé.
 *
 * ⚠️ ET LA MOITIÉ « DOIT ÊTRE REFUSÉE » COMPTE AUTANT : le préfixe NE SE DISTRIBUE PAS aux
 * co-attaques. Le point collé qualifie le terme auquel il est collé ; un secondaire écrit nu reste
 * nu, et son ambiguïté est alors méritée. Sans ce témoin, une correction qui propagerait l'acteur à
 * tout le groupe passerait pour juste.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// DEUX acteurs qui revendiquent le même clavier : sans préfixe, chaque note est ambiguë. C'est ce
// qui rend la mesure possible — un préfixe perdu se voit immédiatement.
const S = 'core\nalphabet.western\nactor chant\n  out.audio\nactor basse\n  out.midi(ch:2)\n-----\n';
const err = (flux) => {
  try { return (compileToBPxAST(S + `S -> ${flux}`).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};

// ── 1. LA MATRICE — le préfixe survit à toutes les places et à toutes les graphies ───────────
const JUSTES = [
  ['gauche, collé',            'chant.A2!chant.A4'],
  ['gauche, autre acteur',     'basse.A2!chant.A4'],
  ['signe espacé',             'basse.A2 ! chant.A4'],
  ['droite seule',             'chant.A4!basse.A2'],
  ['appel puis frappe',        'chant.A2(vel:80)!chant.A4'],
  ['chaîne de trois',          'chant.A2!chant.A4!basse.E3'],
  ['réglage collé au terme',   'chant.A2!(vel:70)'],
  ['dans un groupe',           '{chant.A2!chant.A4 basse.E3}'],
  ['dans une polymétrie',      '{chant.A2!chant.A4, basse.E3}'],
  ['après un silence',         '- chant.A2!chant.A4'],
  ['deux frappes de suite',    'chant.A2!chant.A4 basse.E3!basse.G3'],
];
console.log(`[acteur sur le terme] ${JUSTES.length} écritures justes x 1 + les refus mérités`);
for (const [quoi, flux] of JUSTES) {
  const e = err(flux);
  ok(e.length === 0, `1. '${flux}' (${quoi}) doit PASSER — le préfixe est écrit, il doit être lu. `
    + `Reçu : ${e[0]}`);
}

// ── 2. ET L'ACTEUR EST SUR LE TERME, PAS SUR LA CONSTRUCTION ────────────────────────────────
// Sans ce bloc, une correction qui poserait l'acteur sur le groupe ET sur le terme passerait la
// matrice ci-dessus : la compilation réussirait pour la mauvaise raison.
{
  const r = compileToBPxAST(`${S}S -> basse.A2!chant.A4`);
  const el = r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs?.[0];
  ok(el?.type === 'SimultaneousGroup', `2. la frappe commune doit être un groupe (reçu ${el?.type})`);
  ok(el?.actor === undefined,
    `2. LE GROUPE NE PORTE PAS D'ACTEUR — c'est la faute exacte qu'on répare (reçu '${el?.actor}')`);
  ok(el?.primary?.actor === 'basse',
    `2. le TERME de gauche porte le sien (reçu '${el?.primary?.actor}')`);
  ok(el?.secondaries?.[0]?.actor === 'chant',
    `2. le TERME de droite porte le sien (reçu '${el?.secondaries?.[0]?.actor}')`);
}

// ── 3. LE PRÉFIXE NE SE DISTRIBUE PAS — la moitié qui démasque une correction trop large ─────
{
  const e = err('chant.A2!A4');
  ok(e.length >= 1,
    "3. un secondaire écrit NU reste nu : son ambiguïté est méritée. Le point collé qualifie le "
    + "terme auquel il est collé, il ne gouverne pas ses voisins.");
  ok(e.some((m) => /A4/.test(m)),
    `3. et le refus nomme le terme AMBIGU, pas l'autre (reçu : ${e[0]})`);
}

// ── 4. SOCLE ET TÉMOIN D'INSTRUMENT ─────────────────────────────────────────────────────────
ok(JUSTES.length >= 11, `4. la matrice ne s'est pas vidée — ${JUSTES.length} écritures`);
// Sans témoin, un compilateur devenu permissif (acceptant tout) rendrait ce fichier vert pour la
// pire des raisons : la moitié « doit passer » ne prouve rien si plus rien ne peut échouer.
ok(err('A2!A4').length >= 1,
  "4. TÉMOIN — deux termes NUS restent ambigus tous les deux ; le compilateur mord encore.");
ok(err('inconnu.A2!chant.A4').length >= 1,
  "4. TÉMOIN — un acteur NON DÉCLARÉ en tête de frappe commune reste refusé : la correction ouvre "
  + "la lecture du préfixe, pas la porte à n'importe quel nom.");

if (echecs.length) {
  console.error(`[acteur sur le terme] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[acteur sur le terme] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
