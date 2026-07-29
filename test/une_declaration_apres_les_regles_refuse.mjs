#!/usr/bin/env node
/**
 * GARDE — une DÉCLARATION écrite après les règles est REFUSÉE, elle ne se perd plus en silence.
 *
 * Décision Romain, transmise le 2026-07-29 : « une directive après les règles doit être une
 * erreur ». Mesure de l'architecte, reproduite ici : elle était ACCEPTÉE ET SILENCIEUSEMENT
 * IGNORÉE — `@var v` posé après une règle compilait sans un mot, et `v` n'existait dans aucun
 * arbre. La même ligne posée avant la règle le crée.
 *
 * ⚠️ POURQUOI C'EST LE PIRE MODE D'ÉCHEC, et pas une coquille : l'auteur CROIT avoir déclaré.
 * Rien ne le détrompe — ni le compilateur, ni l'arbre, ni l'aval. C'est le mode d'échec de la
 * flèche du moteur historique, en pire : celle-là au moins ne compilait pas.
 *
 * ⚠️ LE GARDE PORTE SUR L'ESPACE, PAS SUR LA FORME DU TICKET. Le signalement nommait `@var`. Le
 * balayage des directives réservées en a trouvé VINGT-QUATRE dans le même cas. Réparer la seule
 * forme signalée aurait laissé vivre les vingt-trois autres — c'est la faute que je paie le plus
 * souvent, et elle est ici mécanisée : la liste des directives est CONSTRUITE, pas écrite à la
 * main, et chacune est éprouvée dans les deux positions.
 *
 * ⚠️ ET `@mode` DOIT PASSER — ce n'est pas une exception de complaisance. Il porte le mode de la
 * sous-grammaire QUI SUIT, et 67 scènes du corpus en vivent. Un refus en bloc les aurait toutes
 * cassées : exactement le témoin qui aurait refusé 120 scènes sur 333 le 2026-07-28, retrouvé une
 * semaine plus tard sur un autre sujet. C'est la moitié « doit passer » qui démasque une règle
 * trop large, et elle est ici la plus fournie.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const err = (src) => {
  try { return (compileToBPxAST(src).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};
const S = '@core\n@alphabet.western\n';

// ── 1. LA MATRICE — chaque déclaration, dans les DEUX positions ──────────────────────────────
// Une écriture plausible par directive. Elles ne sont pas inventées : chacune est la forme que le
// parseur accepte AVANT les règles, vérifiée par la moitié « doit passer » de cette même matrice.
const DECLARATIONS = [
  ['alphabet', '@alphabet.sargam'], ['tuning', '@tuning.western_just'], ['octaves', '@octaves.bp3'],
  ['transport', '@transport.midi'], ['eval', '@eval.sc'], ['actor', '@actor v\n  transport.audio'],
  ['controls', '@controls'], ['var', '@var v'], ['in', '@in touches transport.keyboard'],
  ['alias', '@alias g cc:2'], ['mm', '@mm:60'], ['tempo', '@tempo:90'], ['duration', '@duration:4'],
  ['meter', '@meter:4'], ['quantization', '@quantization:50'], ['qclock', '@qclock:10'],
  ['transpose', '@transpose:2'], ['diapason', '@diapason:442'], ['transcription', '@transcription.dhati'],
  ['settings', '@settings'], ['filter', '@filter'], ['modulation', '@modulation'], ['ins', '@ins:3'],
  ['test_alphabets', '@test_alphabets.abc'],
];
console.log(`[declaration apres regles] ${DECLARATIONS.length} declarations x 2 positions`);
for (const [nom, forme] of DECLARATIONS) {
  // APRÈS une règle → REFUSÉE, et le refus doit NOMMER la directive et donner la réécriture.
  const apres = err(`${S}S -> C4\n${forme}\nT -> D4\n`);
  ok(apres.length >= 1, `1. '@${nom}' après une règle doit être REFUSÉE (elle se perdait en silence)`);
  ok(apres.some((m) => m.includes(`'@${nom}'`)),
    `1. '@${nom}' — le refus doit NOMMER la directive, pas dire « ligne non reconnue » (reçu : ${apres[0]})`);
  ok(apres.some((m) => /avant la première règle/.test(m)),
    `1. '@${nom}' — le refus doit donner la RÉÉCRITURE, sinon il constate sans aider`);
  // AVANT les règles → PASSE. Sans cette moitié, une règle qui refuserait tout aurait l'air juste.
  ok(err(`${S}${forme}\nS -> C4\n`).length === 0,
    `1. '@${nom}' AVANT les règles doit PASSER — c'est la moitié qu'on casse sans s'en apercevoir`);
}

// ── 2. `@mode` EST LA SEULE LÉGITIME À CETTE PLACE ───────────────────────────────────────────
// 67 scènes du corpus sur 263 en vivent. Ce témoin est la preuve que la règle ne déborde pas.
ok(err(`${S}S -> C4\n@mode:sub\nT -> D4\n`).length === 0,
  '2. SE TAIT — `@mode` après une règle gouverne la sous-grammaire suivante, et doit passer');
{
  const r = compileToBPxAST(`${S}S -> C4\n@mode:sub\nT -> D4\n`);
  ok((r.ast?.subgrammars || []).some((g) => g.mode === 'sub'),
    '2. et il AGIT — sinon il « passerait » en ne faisant rien, ce qui est le défaut qu\'on répare');
}
ok(err(`${S}S -> C4\n-----\n@mode:lin\nT -> D4\n`).length === 0,
  '2. SE TAIT — `@mode` après un séparateur de bloc aussi');

// ── 3. LE REFUS NE DÉBORDE PAS SUR LES AUTRES FORMES DE FIN DE SCÈNE ─────────────────────────
// La section `@template` vient APRÈS toutes les sous-grammaires : c'est sa place, pas une faute.
ok(err(`${S}S -> C4\n@template\n  t1 = C4 D4\n`).length === 0,
  '3. SE TAIT — la section `@template` se place après les règles, c\'est sa définition');
ok(err(`${S}S -> C4\n-----\nT -> D4\n`).length === 0,
  '3. SE TAIT — un séparateur de bloc n\'est pas une directive');

// ── 4. SOCLE ET ANTI-RÉTRÉCISSEMENT ─────────────────────────────────────────────────────────
// L'espace se lit dans la DONNÉE : si le vocabulaire de directives grandit, ce compte le dit.
const RESERVEES = (LIBS['core']?.schema?.reservedDirectives || []).length;
ok(RESERVEES >= 40, `4. le vocabulaire de directives doit être chargé — ${RESERVEES} mot(s)`);
ok(DECLARATIONS.length >= 24,
  `4. la matrice ne s'est pas vidée — ${DECLARATIONS.length} déclarations éprouvées`);
// TÉMOIN D'INSTRUMENT : sans lui, une régression rendant le refus muet laisserait tout au vert.
ok(err(`${S}S -> C4\n@var v\n`).length >= 1,
  '4. TÉMOIN — la règle doit savoir MORDRE même en toute fin de scène (aucune règle après)');

if (echecs.length) {
  console.error(`[declaration apres regles] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[declaration apres regles] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
