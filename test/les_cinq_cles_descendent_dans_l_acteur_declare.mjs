#!/usr/bin/env node
/**
 * GARDE — LES CINQ CLÉS D'ACTEUR DESCENDENT, et NOMMER un acteur ne fait rien PERDRE.
 *
 * L'INVARIANT, et il n'est pas de moi : « un override RECOUVRE le défaut, il ne disparaît JAMAIS
 * en silence » (atlas/architecture/00-constitution.md:176-178, L35, contrat fondateur ratifié le
 * 2026-07-04). Et la bible : « Un acteur porte cinq clés… ce qui n'est pas écrit, l'acteur
 * l'HÉRITE de la scène » (docs/spec/LANGUAGE.md:377-378).
 *
 * CE QUE ÇA COÛTAIT, MESURÉ SUR PIÈCES le 2026-08-10. Trois axes sur cinq descendaient dans un
 * acteur DÉCLARÉ (alphabet, octaves, tuning) ; la sortie et l'interprète, non. L'acteur IMPLICITE,
 * lui, recevait les cinq. Nommer un acteur faisait donc PERDRE ce que ne rien nommer donnait.
 * Quatre scènes d'exemple de la bibliothèque compilaient SANS UNE ERREUR et ne produisaient AUCUN
 * SON — exactement les quatre déclarant un `@actor` sans `out`, zéro contre-exemple dans les deux
 * sens (discrimination de kanopi).
 *
 * ⚠️ POURQUOI C'EST LE PIRE MODE D'ÉCHEC. Rien ne manque à l'œil : la scène a l'air complète, le
 * compilateur se tait, et l'aval n'a AUCUN moyen de savoir qu'une sortie était due — une clé
 * absente et une clé jamais réclamée ont exactement la même tête. Le silence ne se signale pas
 * lui-même ; il se mesure ici, ou il ne se mesure nulle part.
 *
 * ⚠️ CE GARDE EST UNE MATRICE, PAS UNE LISTE. Le signalement ne nommait que la sortie. Les CINQ
 * clés sont éprouvées, dans les TROIS positions où chacune peut vivre (héritée de la scène, écrite
 * sur l'acteur, absente partout) — parce que réparer la seule clé signalée aurait laissé l'autre
 * trou ouvert, et c'est exactement ce qui s'était produit : `eval` était muet lui aussi.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compile = (src) => {
  const r = compileToBPxAST(src);
  return { errs: (r.errors || []).map((e) => e.message ?? String(e)), ast: r.ast };
};
const acteur = (src, nom) => {
  const { errs, ast } = compile(src);
  if (errs.length) return { erreur: errs[0] };
  return (ast.actors || []).find((a) => a.name === nom) || { absent: true };
};

// La scène écrit LES CINQ, pour qu'aucune ne puisse « passer » par hasard faute de source.
const SCENE_COMPLETE = '@core\n@alphabet.western\n@out.midi(ch:5)\n@eval.strudel\n'
                     + '@tuning.western_just\n@octaves.bp3\n';

// LES CINQ CLÉS — nom dans l'arbre, valeur attendue quand la scène la porte, et une écriture
// d'acteur qui la RECOUVRE avec une autre valeur.
// ⚠️ `alphabet` porte sa PROPRE scène témoin, et ce n'est pas une commodité : l'accordage et le
// registre APPARTIENNENT à un alphabet, et le compilateur refuse `alphabet.sargam` sous un
// `@tuning.western_just` de scène — à raison. Éprouver l'override d'alphabet sous la scène complète
// mesurerait ce refus de cohérence, pas la descente de la clé. L'instrument se règle sur ce qu'il
// veut voir ; sinon il rend un rouge qui parle d'autre chose.
const CLES = [
  { cle: 'alphabet',  herite: 'western',        ecrit: 'alphabet.sargam',       recouvre: 'sargam',
    scene: '@core\n@alphabet.western\n@out.midi(ch:5)\n@eval.strudel\n', terminal: 'sa' },
  { cle: 'tuning',    herite: 'western_just',   ecrit: 'tuning.western_12TET',  recouvre: 'western_12TET' },
  { cle: 'octaves',   herite: 'bp3',            ecrit: 'octaves.western',       recouvre: 'western' },
  { cle: 'transport', herite: 'midi',           ecrit: 'out.audio',             recouvre: 'audio',
    // La sortie est la seule à vivre dans un objet — on compare sa CLÉ, pas la coquille.
    lire: (v) => (v && typeof v === 'object' ? v.key : v) },
  { cle: 'eval',      herite: 'strudel',        ecrit: null,                    recouvre: null },
];
const lire = (a, c) => (c.lire ? c.lire(a.properties?.[c.cle]) : a.properties?.[c.cle]);

console.log(`[cinq cles] ${CLES.length} cles x 3 positions`);

for (const c of CLES) {
  const scene = c.scene || SCENE_COMPLETE;
  // 1. HÉRITÉE — l'acteur nu reçoit ce que la scène écrit. C'est la moitié qui était CASSÉE.
  const nu = acteur(`${scene}@actor nu\nS -> nu.C4`, 'nu');
  ok(!nu.erreur && !nu.absent, `1. '${c.cle}' — la scène témoin doit compiler (reçu : ${nu.erreur})`);
  ok(lire(nu, c) === c.herite,
    `1. '${c.cle}' doit DESCENDRE dans un acteur déclaré nu : attendu '${c.herite}', reçu `
    + `'${lire(nu, c)}'. Nommer un acteur ne fait rien perdre.`);

  // 2. ÉCRITE — un override RECOUVRE. Sans cette moitié, un pliage qui écraserait tout aurait
  //    l'air juste : les deux fautes rendent la même clé « présente ».
  if (c.ecrit) {
    const perso = acteur(`${scene}@actor perso\n  ${c.ecrit}\nS -> perso.${c.terminal || 'C4'}`, 'perso');
    ok(lire(perso, c) === c.recouvre,
      `2. '${c.cle}' — ce que l'acteur ÉCRIT gagne sur la scène : attendu '${c.recouvre}', reçu `
      + `'${lire(perso, c)}'`);
  }

  // 3. L'ACTEUR IMPLICITE EST L'ÉTALON — un acteur nommé nu porte EXACTEMENT ce que porterait la
  //    scène qui n'en déclare aucun. C'est l'invariant sous sa forme la plus dure : les deux
  //    chemins passent par les mêmes cascades, donc ils ne peuvent pas diverger.
  const implicite = acteur(`${scene}S -> C4`, 'scene');
  ok(lire(implicite, c) === lire(nu, c),
    `3. '${c.cle}' — l'acteur IMPLICITE porte '${lire(implicite, c)}' et l'acteur DÉCLARÉ NU porte `
    + `'${lire(nu, c)}' : les deux chemins ont divergé.`);
}

// ── L'INVARIANT PORTE SUR L'ARBRE ENTIER, PAS SUR LES SEULES PROPRIÉTÉS ──────────────────────
// ⚠️ CE BLOC EXISTE PARCE QUE CE GARDE A LAISSÉ PASSER LA MOITIÉ DU DÉFAUT (2026-08-10). Il
// comparait `properties` et s'arrêtait là. Résultat mesuré par kanopi : trois scènes portaient
// `properties.transport` et restaient MUETTES, pendant que ce garde était vert. Ce que l'aval lit
// est la RÉFÉRENCE — les scènes qui sonnaient portaient une `ActorReference` de catégorie
// `transport`, les muettes non ; coupure parfaite dans les deux sens.
//
// UNE EMPREINTE COMPARE TOUT, en retirant seulement ce qui est prouvé hors sujet. Choisir les
// champs comparés revient à choisir ce qu'on ne verra pas — et ici, ce qu'on n'a pas vu est
// exactement ce qui faisait la différence entre une scène qui sonne et une scène morte.
{
  const cats = (a) => [...new Set((a.references || []).map((r) => r.category))].sort().join(',');
  const nu = acteur(`${SCENE_COMPLETE}@actor nu\nS -> nu.C4`, 'nu');
  const implicite = acteur(`${SCENE_COMPLETE}S -> C4`, 'scene');
  ok(cats(nu) === cats(implicite),
    `7. LES RÉFÉRENCES aussi — l'acteur IMPLICITE annonce [${cats(implicite)}] et l'acteur DÉCLARÉ `
    + `NU annonce [${cats(nu)}]. C'est la référence que l'aval lit ; une propriété seule ne suffit `
    + `pas, et trois scènes muettes l'ont prouvé.`);
  ok(cats(nu).includes('transport'),
    `7. et 'transport' EST annoncé : reçu [${cats(nu)}]`);
}

// ── LE CAS QUI A COÛTÉ LE SIGNALEMENT — une scène sans AUCUNE directive de sortie ────────────
// Le socle @core porte le défaut (`defaults.components.transport`), et il doit atteindre l'acteur
// déclaré comme il atteint l'implicite. C'est la forme exacte des quatre scènes muettes.
{
  const S = '@core\n@alphabet.western\n';
  const a = acteur(`${S}@actor tempere\n  tuning.western_12TET\nS -> tempere.C4`, 'tempere');
  ok(a.properties?.transport?.key === 'audio',
    `4. LE CAS MESURÉ — un acteur qui n'écrit QUE son accordage doit recevoir la sortie du socle : `
    + `reçu ${JSON.stringify(a.properties?.transport)}. C'est cette absence qui rendait quatre `
    + `scènes d'exemple MUETTES sans une erreur.`);
}

// ── DEUX ACTEURS, DEUX HÉRITAGES INDÉPENDANTS ────────────────────────────────────────────────
// Un pliage écrit sur l'objet partagé au lieu de chaque acteur passerait tout ce qui précède.
{
  const src = '@core\n@alphabet.western\n@out.midi(ch:2)\n'
            + '@actor suit\n@actor propre\n  out.audio\nS -> suit.C4 propre.E4';
  ok(acteur(src, 'suit').properties?.transport?.key === 'midi',
    "5. deux acteurs — celui qui n'écrit rien garde la sortie de la scène");
  ok(acteur(src, 'propre').properties?.transport?.key === 'audio',
    "5. deux acteurs — celui qui écrit la sienne n'est pas contaminé par l'autre");
}

// ── TÉMOIN D'INSTRUMENT ───────────────────────────────────────────────────────────────────────
// Sans lui, un pliage devenu constant (posant 'audio' partout) rendrait tout le fichier vert.
{
  const a = acteur('@core\n@alphabet.western\n@out.midi(ch:9)\n@actor nu\nS -> nu.C4', 'nu');
  ok(a.properties?.transport?.key === 'midi' && a.properties?.transport?.params?.ch === 9,
    `6. TÉMOIN — la sortie héritée porte AUSSI ses réglages : reçu `
    + `${JSON.stringify(a.properties?.transport)}. Un pliage constant serait invisible sans ça.`);
}

if (echecs.length) {
  console.error(`[cinq cles] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[cinq cles] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
