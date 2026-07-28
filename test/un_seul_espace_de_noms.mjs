#!/usr/bin/env node
/**
 * GARDE — UN SEUL ESPACE DE NOMS. Rien ne porte le nom d'autre chose.
 *
 * Règle de Romain (2026-07-28, décision `2026-07-28-unicite-des-noms.md`) : « il ne faut AUCUNE
 * AMBIGUÏTÉ POSSIBLE. RIEN ne peut avoir des noms identiques. » L'intention n'est pas technique :
 * il refuse qu'un auteur puisse lire un nom dans une règle sans savoir de quoi il parle. Même
 * quand une précédence fonctionne, l'ÉCRITURE reste ambiguë pour l'humain.
 *
 * ⚠️ CE GARDE VÉRIFIE AUTANT CE QUI DOIT PASSER QUE CE QUI DOIT ÊTRE REFUSÉ, et la moitié
 * « doit passer » est la plus importante — c'est celle qu'on casse sans s'en rendre compte.
 * Un témoin de garde m'avait été prescrit qui exigeait le refus de deux têtes homonymes dans une
 * même sous-grammaire : mesuré, il aurait refusé 120 scènes sur 333, parce qu'une tête répétée
 * n'est pas un conflit mais une ALTERNATIVE. Il est tombé en le mesurant, pas en le relisant.
 *
 * LE CRITÈRE EST L'EFFET, JAMAIS LA FORME DE LA LIGNE : ce qui est refusé, c'est ce qui CRÉE un
 * nom. Une écriture qui pose une PROPRIÉTÉ sur un nom existant reste permise, et c'est mesurable —
 * les nœuds produits sont identiques avec et sans elle.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const refus = (src) => (compileToBPxAST(src).errors || [])
  .map((e) => e.message ?? String(e))
  .filter((m) => /TERMINAL de l'alphabet actif|déjà pris/.test(m));

// ── A. CE QUI DOIT ÊTRE REFUSÉ ───────────────────────────────────────────────
// L'espace : chaque SORTE qui crée un nom × ce qu'elle peut heurter.
const SORTES = [
  ['une macro',              (n) => `@macro ${n} saw >> audio`],
  ['un alias',               (n) => `@alias ${n} cc:2`],
  ['une entrée',             (n) => `@in ${n} transport.midi`],
  ['une variable de travail', (n) => `@var ${n}`],
];
const CE_QUI_EST_DEJA_PRIS = [
  ['un TERMINAL de l\'alphabet', 'G4', (poseur) => `@core\n@alphabet.western\n${poseur}\nS -> C4 D4`],
  ['une MACRO déjà déclarée',    'pris', (poseur) => `@core\n@macro pris saw >> audio\n${poseur}\nS -> C4`],
  ['un ALIAS déjà déclaré',      'pris', (poseur) => `@core\n@alias pris cc:9\n${poseur}\nS -> C4`],
];
console.log(`[un seul espace de noms] ${SORTES.length} sortes × ${CE_QUI_EST_DEJA_PRIS.length} conflits`);
for (const [sorte, ligne] of SORTES) {
  for (const [quoi, nom, scene] of CE_QUI_EST_DEJA_PRIS) {
    const src = scene(ligne(nom));
    const r = refus(src);
    // Une sorte ne peut pas se heurter elle-même dans ce montage (le poseur EST la 2e occurrence).
    ok(r.length >= 1, `${sorte} nommée comme ${quoi} — doit être refusée`);
    ok(r.some((m) => m.includes(nom)), `${sorte} contre ${quoi} — le refus doit NOMMER le conflit`);
    ok(r.some((m) => /Choisir un autre nom/.test(m)), `${sorte} contre ${quoi} — doit proposer la sortie`);
  }
}
// La TÊTE DE RÈGLE, contre tout le reste — portée globale.
const TETES_REFUSEES = [
  ['contre un terminal',  '@core\n@alphabet.western\nG4 -> C4 D4'],
  ['contre une macro',    '@core\n@macro motif saw >> audio\nmotif -> C4'],
  ['contre un alias',     '@core\n@alias motif cc:2\nmotif -> C4'],
  ['contre une variable', '@core\n@var motif\nmotif -> C4'],
  ['contre une entrée',   '@core\n@in motif transport.midi\nmotif -> C4'],
  // L'AMALGAME acteur / tête de règle — l'erreur grave tranchée par Romain le 2026-07-28.
  ['contre un ACTEUR (l\'amalgame)', '@core\n@actor viz  eval.hydra\nS -> viz\nviz -> `hydra: osc(4).out()`'],
  ['contre un acteur de notes',      '@core\n@alphabet.western\n@actor v\n  alphabet.western\n  transport.audio\nS -> v\nv -> C4 D4'],
];
for (const [quoi, src] of TETES_REFUSEES) {
  const r = refus(src);
  ok(r.length >= 1, `une tête de règle ${quoi} — doit être refusée`);
  ok(r.some((m) => /règle/.test(m)), `tête ${quoi} — le refus doit dire que c'est la RÈGLE qui heurte`);
}

// ── B. CE QUI DOIT PASSER, ET C'EST LA MOITIÉ QU'ON CASSE ────────────────────
// Chacune de ces lignes est une forme RATIFIÉE. Si l'une rougit, la règle a débordé.
const DOIVENT_PASSER = [
  ['une tête RÉPÉTÉE = les alternatives d\'une règle (120 scènes sur 333 en vivent)',
   '@core\n@alphabet.simple\nS -> X\nX -> a b\nX -> c d'],
  ['la même tête dans DEUX sous-grammaires = deux passes successives',
   '@core\n@alphabet.simple\nS -> X\nX -> a b\n-----\nX -> c d'],
  ['une PROPRIÉTÉ posée sur un nom existant : gate sur un terminal',
   '@core\n@alphabet.western\ngate C4:midi\nS -> C4 D4'],
  // ⚠️ CES DEUX TÉMOINS ONT ÉTÉ RETIRÉS LE 2026-07-28 AU SOIR, ET C'EST L'INVERSE D'UN
  // RÉTRÉCISSEMENT : ils affirmaient qu'un acteur et sa règle homonyme devaient PASSER. Romain a
  // tranché que c'est une ERREUR GRAVE — l'amalgame d'un nom d'acteur et d'un nom de règle. Les
  // garder aurait fait rougir la règle qu'ils étaient censés protéger. Ils deviennent des cas
  // REFUSÉS, plus bas.
  ['une voix de code à la forme RATIFIÉE : le code annonce son langage',
   '@core\n@actor viz  eval.hydra\nS -> voix\nvoix -> `hydra: osc(4).out()`'],
  // La forme décidée par Romain le 2026-07-28 : l'acteur QUALIFIE le bloc par le point, à droite,
  // là où il qualifie déjà une note. Elle donne le langage ET l'identité de la voix.
  ['un ACTEUR qui qualifie un bloc de code par le point',
   '@core\n@actor viz  eval.hydra\nS -> voix\nvoix -> viz.`osc(4).out()`'],
  ['des noms sans rapport entre eux',
   '@core\n@alphabet.western\n@macro grondement saw >> audio\n@alias souffle cc:2\nmotif -> C4\nS -> motif'],
  ['un nom PROCHE d\'un terminal, mais qui n\'en est pas un',
   '@core\n@alphabet.western\n@macro G4_v saw >> audio\nS -> C4'],
  ['un nom d\'une AUTRE convention que l\'alphabet actif',
   '@core\n@alphabet.western\n@macro pa1 saw >> audio\nS -> C4'],
  ['aucun alphabet résolu : rien à heurter',
   '@core\n@macro G4 saw >> audio\nS -> C4'],
  // ⚠️ LES CONTEXTES — régression mesurée par BPx le 2026-07-28. Un contexte n'est PAS une tête :
  // il DÉSIGNE un terminal, c'est sa raison d'être. « ne pas être précédé de C4 » ne peut pas
  // s'écrire sans nommer C4, et l'auteur n'a aucune issue — renommer change la condition,
  // renoncer supprime le mécanisme. Ma garde lisait le premier jeton du membre gauche.
  ['un contexte NÉGATIF en tête désigne un terminal, et c\'est son rôle',
   '@core\n@alphabet.western:midi\n@mode:sub\n#C4 S -> G4\nS -> C4 D4 E4'],
  ['un contexte négatif en QUEUE aussi',
   '@core\n@alphabet.western:midi\n@mode:sub\nS #C4 -> G4\nS -> C4 D4 E4'],
  ['plusieurs contextes négatifs',
   '@core\n@alphabet.western:midi\n@mode:sub\n#C4 #D4 S -> G4\nS -> C4 D4'],
  ['un contexte POSITIF, que le parser range ailleurs',
   '@core\n@alphabet.western:midi\n@mode:sub\n(C4) S -> G4\nS -> C4 D4'],
];
for (const [quoi, src] of DOIVENT_PASSER) {
  const r = refus(src);
  ok(r.length === 0, `DOIT PASSER — ${quoi} (reçu : ${r.join(' | ').slice(0, 120)})`);
}

// ── C. TÉMOINS D'INSTRUMENT ET ANTI-RÉTRÉCISSEMENT ───────────────────────────
// Sans eux, une régression qui rendrait la règle muette laisserait tout ce fichier au vert :
// la moitié « doit passer » passerait encore mieux, et la moitié « doit être refusée » est la
// seule à mordre. C'est la forme exacte du piège payé sur l'outil de migration aujourd'hui.
ok(refus('@core\n@alphabet.western\nG4 -> C4').length >= 1,
  'TÉMOIN — la règle doit savoir MORDRE (sinon tout ce fichier ment)');
ok(refus('@core\n@alphabet.western\nmotif -> C4').length === 0,
  'TÉMOIN — et savoir se TAIRE (sinon elle refuserait tout, et mordrait aussi)');
ok(SORTES.length >= 4 && CE_QUI_EST_DEJA_PRIS.length >= 3 && DOIVENT_PASSER.length >= 12,
  'les matrices ne se sont pas vidées');

if (echecs.length) {
  console.error(`[un seul espace de noms] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[un seul espace de noms] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
