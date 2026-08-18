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
  ['une définition',         (n) => `def ${n} C4 D4`],
  ['une entrée',             (n) => `in.midi ${n}`],
  ['une variable de travail', (n) => `symbol ${n}`],
  // Décision Romain 2026-07-30 (`hub/decisions/2026-07-30-trois-arbitrages-nature-fabrique-
  // drapeaux.md`) : un drapeau CRÉE un nom, comme les quatre sortes ci-dessus — c'était un TROU,
  // pas un espace séparé légitime.
  ['un drapeau',             (n) => `flag ${n}(a:1, b:2)`],
];
const CE_QUI_EST_DEJA_PRIS = [
  ['un TERMINAL de l\'alphabet', 'G4', (poseur) => `core\nalphabet.western\n${poseur}\n-----\nS -> C4 D4`],
  ['une DÉFINITION déjà déclarée', 'pris', (poseur) => `core\ndef pris C4 D4\n${poseur}\n-----\nS -> C4`],
  ['un DRAPEAU déjà déclaré',    'pris', (poseur) => `core\nflag pris(a:1, b:2)\n${poseur}\n-----\nS -> C4`],
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
  // ⚠️ LE TERMINAL ET LA VARIABLE DE TRAVAIL SONT SORTIS D'ICI le 2026-08-07 — décision Romain
  // `2026-08-03-une-tete-de-regle-peut-etre-un-terminal.md`, qui NOMME ses trois formes :
  // `C4 -> G4`, `?1 D4 -> ?1 E4`, `#K1 #K2 #K3 M -> C4` avec `var M`. Une règle de SUBSTITUTION
  // réécrit un terminal : elle en a forcément un en tête, et « la note devient inatteignable » est
  // ce qu'elle fait EXPRÈS. Elles sont désormais au lot B, celui de ce qui DOIT passer.
  ['contre une définition', 'core\ndef motif C4 D4\n-----\nmotif -> C4'],
  ['contre un drapeau',   'core\nflag motif(a:1, b:2)\n-----\nmotif -> C4'],
  // L'AMALGAME acteur / tête de règle — l'erreur grave tranchée par Romain le 2026-07-28.
  ['contre un ACTEUR (l\'amalgame)', 'core\nactor viz  eval.hydra\n-----\nS -> viz\nviz -> `hydra: osc(4).out()`'],
  ['contre un acteur de notes',      'core\nalphabet.western\nactor v\n  alphabet.western\n  out.audio\n-----\nS -> v\nv -> C4 D4'],
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
   'core\nalphabet.simple\n-----\nS -> X\nX -> a b\nX -> c d'],
  ['la même tête dans DEUX sous-grammaires = deux passes successives',
   'core\nalphabet.simple\n-----\nS -> X\nX -> a b\n-----\nX -> c d'],
  ['une PROPRIÉTÉ posée sur un nom existant : gate sur un terminal',
   'core\nalphabet.western\nC4:midi\n-----\nS -> C4 D4'],
  // LES TROIS FORMES DE LA DÉCISION DU 2026-08-03, mot pour mot. Elles étaient REFUSÉES ici même
  // jusqu'au 2026-08-07 : « aucune grammaire de substitution ne compilait en BPScript ».
  ['une SUBSTITUTION : la tête est un terminal (mode sub/sub1)',
   'core\nalphabet.western\n-----\nC4 -> G4\nS -> C4'],
  ['un JOKER devant un terminal en tête',
   'core\nalphabet.western\n?1 D4 -> ?1 E4\n-----\nS -> C4 D4'],
  ['une tête qui porte le nom d\'une variable de travail',
   'core\nalphabet.western\nsymbol M\n-----\nM -> C4\nS -> M'],
  ['un CONTEXTE positif devant un terminal en tête',
   'core\nalphabet.western\n(C4) D4 -> G4\n-----\nS -> C4 D4'],
  // ⚠️ CES DEUX TÉMOINS ONT ÉTÉ RETIRÉS LE 2026-07-28 AU SOIR, ET C'EST L'INVERSE D'UN
  // RÉTRÉCISSEMENT : ils affirmaient qu'un acteur et sa règle homonyme devaient PASSER. Romain a
  // tranché que c'est une ERREUR GRAVE — l'amalgame d'un nom d'acteur et d'un nom de règle. Les
  // garder aurait fait rougir la règle qu'ils étaient censés protéger. Ils deviennent des cas
  // REFUSÉS, plus bas.
  ['une voix de code à la forme RATIFIÉE : le code annonce son langage',
   'core\nactor viz  eval.hydra\n-----\nS -> voix\nvoix -> `hydra: osc(4).out()`'],
  // La forme décidée par Romain le 2026-07-28 : l'acteur QUALIFIE le bloc par le point, à droite,
  // là où il qualifie déjà une note. Elle donne le langage ET l'identité de la voix.
  ['un ACTEUR qui qualifie un bloc de code par le point',
   'core\nactor viz  eval.hydra\n-----\nS -> voix\nvoix -> viz.`osc(4).out()`'],
  ['des noms sans rapport entre eux',
   'core\nalphabet.western\ndef grondement saw >> audio\ndef souffle perc.tin\n-----\nmotif -> C4\nS -> motif'],
  ['un nom PROCHE d\'un terminal, mais qui n\'en est pas un',
   'core\nalphabet.western\ndef G4_v saw >> audio\n-----\nS -> C4'],
  ['un nom d\'une AUTRE convention que l\'alphabet actif',
   'core\nalphabet.western\ndef pa1 saw >> audio\n-----\nS -> C4'],
  // ⚠️ IL Y AVAIT ICI UN TÉMOIN « aucun alphabet résolu : rien à heurter » — RETOURNÉ le
  // 2026-07-29, et son retrait est un DURCISSEMENT. Il affirmait qu'une scène sans convention de
  // notes n'a rien à heurter, donc que `macro G4` y est légitime. C'était la description d'un
  // TROU, pas d'une règle : depuis la cascade core (SCENE_DEFAULTS_CASCADE.md, ratifié
  // 2026-07-04), une scène qui se tait HÉRITE de `western` — donc `G4` y est bien une note, et la
  // règle mord. L'ancien témoin gardait ma zone aveugle : 91 scènes sur 263 y vivaient.
  // Il devient un cas REFUSÉ, plus haut.
  ['une hauteur OPAQUE invoquée : l\'alphabet reste ABSENT, et c\'est la SEULE absence légitime (loi 35)',
   'core\ntest_alphabets.abc\ndef G4 saw >> audio\n-----\nS -> a b'],
  // ⚠️ LES CONTEXTES — régression mesurée par BPx le 2026-07-28. Un contexte n'est PAS une tête :
  // il DÉSIGNE un terminal, c'est sa raison d'être. « ne pas être précédé de C4 » ne peut pas
  // s'écrire sans nommer C4, et l'auteur n'a aucune issue — renommer change la condition,
  // renoncer supprime le mécanisme. Ma garde lisait le premier jeton du membre gauche.
  ['un contexte NÉGATIF en tête désigne un terminal, et c\'est son rôle',
   'core\nalphabet.western:midi\nmode:sub\n#C4 S -> G4\n-----\nS -> C4 D4 E4'],
  ['un contexte négatif en QUEUE aussi',
   'core\nalphabet.western:midi\nmode:sub\nS #C4 -> G4\n-----\nS -> C4 D4 E4'],
  ['plusieurs contextes négatifs',
   'core\nalphabet.western:midi\nmode:sub\n#C4 #D4 S -> G4\n-----\nS -> C4 D4'],
  ['un contexte POSITIF, que le parser range ailleurs',
   'core\nalphabet.western:midi\nmode:sub\n(C4) S -> G4\n-----\nS -> C4 D4'],
  // ⚠️ LES DRAPEAUX — décision Romain 2026-07-30. Le nom qui entre dans l'espace de noms est le
  // drapeau LUI-MÊME (`section`) ; ses ÉTATS (`calm`, `full`…) sont des étiquettes internes, pas
  // des noms globaux — les y faire entrer déborderait la règle.
  ['un ÉTAT de drapeau qui porte le nom d\'un terminal : ce n\'est pas un nom global',
   'core\nalphabet.western\nflag section(C4:1, D4:2)\n-----\nS -> C4'],
  ['un drapeau LU plusieurs fois en garde : une lecture ne crée rien',
   'core\nalphabet.simple\nflag section(calm:1, full:2)\n[section==calm] S -> X\n'
   + '[section==full] S -> X\n[section==calm] X -> a'],
];
for (const [quoi, src] of DOIVENT_PASSER) {
  const r = refus(src);
  ok(r.length === 0, `DOIT PASSER — ${quoi} (reçu : ${r.join(' | ').slice(0, 120)})`);
}

// ── C. TÉMOINS D'INSTRUMENT ET ANTI-RÉTRÉCISSEMENT ───────────────────────────
// Sans eux, une régression qui rendrait la règle muette laisserait tout ce fichier au vert :
// la moitié « doit passer » passerait encore mieux, et la moitié « doit être refusée » est la
// seule à mordre. C'est la forme exacte du piège payé sur l'outil de migration aujourd'hui.
// ⚠️ CE TÉMOIN A CHANGÉ DE SUJET le 2026-08-07, ET C'EST LE POINT DÉLICAT. Il prenait pour preuve
// de morsure `G4 -> C4` — une tête de règle nommée comme une note — devenu une forme LÉGITIME
// (décision du 2026-08-03). Le garder aurait exigé le refus d'une écriture ratifiée ; le retirer
// sans le remplacer aurait laissé tout ce fichier vert le jour où la règle deviendrait muette.
// Le témoin porte donc désormais sur une collision qui, elle, n'a jamais été levée : l'AMALGAME
// d'un nom d'acteur et d'un nom de règle (« erreur grave », Romain 2026-07-28).
ok(refus('core\nactor viz  eval.hydra\n-----\nS -> viz\nviz -> `hydra: osc(4).out()`').length >= 1,
  'TÉMOIN — la règle doit savoir MORDRE (sinon tout ce fichier ment)');
ok(refus('core\nalphabet.western\n-----\nmotif -> C4').length === 0,
  'TÉMOIN — et savoir se TAIRE (sinon elle refuserait tout, et mordrait aussi)');
// PLANCHERS INCHANGÉS APRÈS LE RETRAIT D'`alias` (2026-08-15) : la sorte et le conflit qu'il
// portait sortent tous deux, et les seuils restent au-dessus de ce qui subsiste. Ils ne se règlent
// jamais sur ce que les matrices rendent — ils disent ce qu'on refuse de descendre en dessous.
ok(SORTES.length >= 4 && CE_QUI_EST_DEJA_PRIS.length >= 3 && DOIVENT_PASSER.length >= 12,
  'les matrices ne se sont pas vidées');

if (echecs.length) {
  console.error(`[un seul espace de noms] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[un seul espace de noms] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
