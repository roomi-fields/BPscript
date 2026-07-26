#!/usr/bin/env node
/**
 * GARDE DU VOCABULAIRE DES APPELS `nom(…)` — et acte de décès de `script(…)`.
 *
 * POURQUOI CE GARDE EXISTE. `script(…)` était une FONCTION GÉNÉRIQUE : un seul mot qui portait
 * n'importe quelle intention (changer d'instrument, envoyer un CC, attendre une note, faire un
 * bip). Romain, 2026-07-26 : « en BPScript on n'est pas censés avoir de _script qui est une
 * fonction générique. On a remplacé par crochets == instruction moteur et parenthèses ==
 * instruction runtime » — « ce sont des erreurs GRAVES ». Une fonction générique dans un langage,
 * c'est une décision non prise qu'on repousse sur l'utilisateur.
 *
 * CE QUE LE GARDE PROTÈGE, et pas seulement pour `script`. Le retrait de `runtime.midi.script` de
 * `lib/controls.json` ne suffisait PAS : mesuré le 2026-07-26, un nom absent de tout vocabulaire
 * mais suivi d'une parenthèse était accepté comme TERMINAL SONNANT (`payload.nature:'sounding'`)
 * et traversait la chaîne en silence — 3 des 5 scènes concernées compilaient toujours sans un mot.
 * Le vrai fail-loud est donc la GARDE DE VOCABULAIRE (`validateCallVocabulary`, bpxAst.js), pas
 * une ligne retirée d'un JSON.
 *
 * PAS DE LISTE EN DUR : `script` tombe parce qu'il n'est plus DANS LA DONNÉE. Le garde vérifie
 * l'absence dans l'autorité (§1), le refus à la compilation (§2), l'absence de faux positif (§3),
 * et qu'AUCUN APPELANT VIVANT ne subsiste dans le corpus (§4) — « vivant » = qui passe encore.
 * Les 4 familles sans nom (Beep, Tick cycle, MIDI send Continue, wait for) restent écrites dans
 * les scènes et DOIVENT échouer : c'est l'intention, en attendant l'arbitrage de nommage.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { universeControlNames } from '../src/transpiler/libs.js';
import { DIR_BPS } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const scene = (regles) => `@core\n@controls\n@alphabet.western:midi\n@mode:ord\n${regles}\n`;
const erreursDe = (src) => {
  try { return (compileToBPxAST(src).errors || []).map((e) => (typeof e === 'string' ? e : e.message || '')); }
  catch (e) { return ['THROW ' + e.message]; }
};

// ─── §1. L'autorité ne déclare plus `script` ────────────────────────────────────────────────
ok(!universeControlNames().has('script'),
   "§1 'script' est encore déclaré dans l'univers des contrôles (lib/controls.json + bundle)");
ok(universeControlNames().has('ins') && universeControlNames().has('cc') && universeControlNames().has('chan'),
   '§1 les contrôles nommés qui remplacent script (ins, cc, chan) doivent exister');

// ─── §2. Un appel hors vocabulaire est REFUSÉ, et le message CITE le texte écrit ─────────────
for (const [appel, ce_que_c_est] of [
  ['script(MIDI program 5)', 'la forme historique la plus fréquente'],
  ['script(Beep)', 'un script sans argument numérique'],
  ['foobar(3)', "un nom quelconque : la règle vaut pour tout le vocabulaire, pas pour 'script' seul"],
]) {
  const errs = erreursDe(scene(`S -> ${appel} C4`));
  ok(errs.length > 0, `§2 '${appel}' (${ce_que_c_est}) doit être refusé — il est passé en silence`);
  ok(errs.some((m) => m.includes(appel)),
     `§2 le message d'erreur doit CITER l'appel tel qu'écrit '${appel}' — reçu : ${errs.join(' | ') || '(aucune erreur)'}`);
}

// Niché dans un groupe : un appel ne se cache pas derrière des accolades.
ok(erreursDe(scene('S -> {C4 script(Beep)} D4')).some((m) => m.includes('script(Beep)')),
   '§2 un appel hors vocabulaire NICHÉ dans un groupe doit être refusé lui aussi');

// Sans alphabet de notes en portée (scène à gates), le vocabulaire des appels reste vérifié.
ok(erreursDe('@core\n@controls\n@gate a:midi\n@mode:ord\nS -> a script(Beep) a\n').some((m) => m.includes('script(Beep)')),
   "§2 un appel hors vocabulaire doit être refusé même SANS alphabet de notes (scène à gates)");

// ─── §2bis. LE TÉMOIN DE BPx — refermé À LA SOURCE le 2026-07-26 ─────────────────────────────
// Constat `hub/constats/2026-07-26-controle-non-declare-degenere-en-note.md` (bpx [790]) : sans
// la déclaration d'import, `ins(12)` n'était pas refusé — il était reclassé en appel de symbole
// SONNANT, donc en note, et le moteur le dérivait fidèlement, sans un mot.
//
// La décision d'écriture du même jour a supprimé la FORME D'APPEL elle-même. Le mode d'échec
// n'est donc plus seulement attrapé, il est DEVENU IMPOSSIBLE : il n'y a plus d'appel à
// reclasser. Ce paragraphe vérifie que le refus tient AVEC et SANS import — parce qu'une forme
// qui n'existe pas ne doit pas dépendre de ce que la scène a chargé.
{
  const REGLES = 'S -> ins(12) chan(3) vel(80) C4 D4';
  for (const [nom, entete] of [['sans import', '@core\n'], ['avec import', '@core\n@controls\n']]) {
    const errs = erreursDe(`${entete}@alphabet.western:midi\n@mode:ord\n${REGLES}\n`);
    ok(errs.length > 0, `§2bis témoin bpx (${nom}) : la forme d'appel doit être refusée`);
    // Deux chemins, deux messages, et c'est correct : AVEC import, le parseur reconnaît le nom
    // et refuse la GRAPHIE ; SANS import, le nom n'est pas un contrôle pour cette scène et c'est
    // la garde de vocabulaire qui refuse. Ce qui compte est qu'aucun des deux ne laisse passer.
    ok(errs.some((m) => /n'existe pas|forme d'appel|pas importé/.test(m)),
       `§2bis témoin bpx (${nom}) : le refus doit être motivé — reçu : ${errs.join(' | ')}`);
  }
  // Et l'écriture qui la remplace passe, elle, dans les deux régimes.
  ok(erreursDe('@core\n@controls\n@alphabet.western:midi\n@mode:ord\nS -> !(vel:80) C4 D4\n').length === 0,
     '§2bis la nouvelle écriture !(vel:80) doit rester acceptée');
  ok(erreursDe('@core\n@controls\n@alphabet.western:midi\n@mode:ord\nS -> C4 D4 (vel:80)\n').length === 0,
     '§2bis la contenance (vel:80) doit rester acceptée');
}

// ─── §2ter. LES TROIS DÉRIVES D'ÉCRITURE ne peuvent pas revenir ──────────────────────────────
// Décision Romain 2026-07-26 (hub/decisions/2026-07-26-ecriture-des-controles-…) : un rôle par
// signe. Ce paragraphe est le garde demandé au point 7 du chantier — il tient les TROIS formes
// supprimées, pas seulement celle qui a déclenché l'affaire.
for (const [forme, quoi] of [
  ['S -> vel(80) C4', "forme d'appel, contrôle runtime"],
  ['S -> goto(3,0) C4', "forme d'appel, contrôle moteur"],
  ['S -> keymap(C3,C3,C5,C5) C4', "forme d'appel à plusieurs valeurs"],
  ['S -> !(cc:98,45) C4', 'liste positionnelle après le deux-points, sac runtime'],
  ['S -> ![goto:3, 0] C4', 'liste positionnelle après le deux-points, sac moteur'],
  ['S -> !(keyxpand:(B3, -1)) C4', 'valeur-groupe entre parenthèses (superseded)'],
]) {
  ok(erreursDe(`@core\n@controls\n@alphabet.western:midi\n@mode:ord\n${forme}\n`).length > 0,
     `§2ter ${quoi} : '${forme.replace('S -> ', '').replace(' C4', '')}' doit être refusé`);
}
// Et les écritures ratifiées passent — sinon ce garde interdirait tout, ce qui ne prouverait rien.
for (const forme of [
  'S -> !(vel:80) C4', 'S -> !(vel:80, pan:64) C4', 'S -> C4 D4 [goto:3 0]',
  'S -> !(keymap:C3 C3 C5 C5) C4', 'S -> !(cc.98:45) C4', 'S -> C4 D4 (vel:80)',
  'S -> C4 [repeat:K1]', 'S -> !(keyxpand:B3 -1) C4', 'S -> ![legato:100] C4',
]) {
  const e = erreursDe(`@core\n@controls\n@alphabet.western:midi\n@mode:ord\n${forme}\n`);
  ok(e.length === 0, `§2ter l'écriture ratifiée '${forme}' doit être acceptée — reçu : ${e.join(' | ')}`);
}

// ─── §2quater. PAS D'ESPACE APRÈS LE DEUX-POINTS ─────────────────────────────────────────────
// Arbitrage Romain 2026-07-26 : la valeur commence immédiatement ; l'espace ne sert QU'À séparer
// les parties d'une valeur. Deux espacements pour la même règle, et un lecteur ne peut plus
// déduire ce que l'espace signifie — le signe à deux métiers, encore.
// C'est MOI qui les ai écrits : ma migration posait `!(vel: 80)`. 1023 emplois, tous repris.
for (const [forme, ou] of [
  ['S -> !(vel: 80) C4', 'sac runtime, dans le flux'],
  ['S -> C4 D4 (vel: 80)', 'sac runtime, en contenance de règle'],
  ['S -> {C4 D4}(vel: 80)', 'sac runtime, en contenance de groupe'],
  ['S -> C4(vel: 80) D4', 'sac runtime, collé au terminal'],
  ['S -> C4 D4 [goto: 3 0]', 'sac moteur'],
  ['S -> C4 [weight: 50]', 'clé réservée du langage'],
  ['S -> !(cc.98: 45) C4', 'composant numéroté'],
]) {
  ok(erreursDe(`@core\n@controls\n@alphabet.western:midi\n@mode:ord\n${forme}\n`).length > 0,
     `§2quater ${ou} : l'espace après le deux-points doit être refusé — '${forme.replace('S -> ', '')}'`);
}
// ⚠️ LE FAUX POSITIF À NE PAS FABRIQUER : l'espace reste LÉGITIME entre les PARTIES d'une valeur.
// Une garde qui interdirait les valeurs à plusieurs parties casserait ce qu'on vient de construire.
for (const forme of [
  'S -> !(keymap:C3 C3 C5 C5) C4', 'S -> C4 D4 [goto:3 0]', 'S -> !(scale:just_intonation C4) C4',
  'S -> !(keyxpand:B3 -1) C4', 'S -> !(vel:80, pan:64) C4', 'S -> C4 [mode:random, weight:50]',
]) {
  const e = erreursDe(`@core\n@controls\n@alphabet.western:midi\n@mode:ord\n${forme}\n`);
  ok(e.length === 0, `§2quater l'espace ENTRE PARTIES reste légitime : '${forme}' — reçu : ${e.join(' | ')}`);
}

// ─── §2quinquies. LE SAC DIT QUI REÇOIT ──────────────────────────────────────────────────────
// Crochets = moteur, parenthèses = runtime : un contrôle ne vit pas dans les deux. La déclaration
// arbitre, JAMAIS le nombre — mesuré au corpus, la majorité se trompait pour deux contrôles sur
// cinq. Décision `hub/decisions/2026-06-14-locus-perf-controls.md`.
for (const [forme, quoi] of [
  ['S -> C4 [vel:80]', 'contrôle runtime écrit dans le sac moteur'],
  ['S -> C4 [keyxpand:B3 -1]', 'contrôle de dispatcher dans le sac moteur'],
  ['S -> C4 !(legato:100) D4', 'contrôle moteur écrit dans le sac runtime'],
  ['S -> C4 (tempo:2)', 'contrôle moteur écrit dans le sac runtime'],
  ['S -> {C4, D4}[scale:2]', "le `scale` MOTEUR, supprimé le 2026-07-26 : subsumé par la durée collée"],
]) {
  ok(erreursDe(`@core\n@controls\n@alphabet.western:midi\n@mode:ord\n${forme}\n`).length > 0,
     `§2quinquies ${quoi} : '${forme.replace('S -> ', '')}' doit être refusé`);
}
// Ce qui reste légitime — dont les CLÉS RÉSERVÉES du langage, qui ne sont pas des contrôles, et
// le `rotate` de SÉQUENCE, moteur et déclaré (à ne pas confondre avec l'ancien rotate de hauteur,
// renommé `scaleshift` le 2026-07-11).
for (const forme of [
  'S -> {C4, D4}:2', 'S -> C4 [weight:50]', 'S -> C4 [mode:random]', 'S -> C4 [tempo:2]',
  'S -> !(vel:80) C4', 'S -> ![legato:100] C4', 'S -> !(scale:just_intonation C4) C4',
  'S -> {C4 D4}![rotate:2]',
]) {
  const e = erreursDe(`@core\n@controls\n@alphabet.western:midi\n@mode:ord\n${forme}\n`);
  ok(e.length === 0, `§2quinquies '${forme}' doit rester accepté — reçu : ${e.join(' | ')}`);
}

// ─── §2sexies. AUCUNE SOUS-ZONE N'ECHAPPE À LA RÈGLE ────────────────────────────────────────
// La déclaration d'un modulateur n'est pas un sac de contrôle : la garde des sacs ne la voyait
// pas, et l'argument positionnel y a survécu une journée entière au ménage. Mesuré par Atlas.
// Ce n'est pas la parenthèse qu'on supprime — c'est l'argument dont la PLACE tient lieu de nom.
{
  const entete = '@core\n@controls\n@mod\n@alphabet.western:midi\n@mode:ord\n';
  const positionnel = erreursDe(`${entete}cv env : mod.adsr(5, 120)\nS -> C4\n`);
  ok(positionnel.length > 0, "§2sexies un argument POSITIONNEL dans une déclaration de modulateur doit être refusé");
  ok(positionnel.some((m) => /POSITIONNEL/.test(m) && /attack:/.test(m)),
     `§2sexies le refus doit NOMMER les paramètres attendus — reçu : ${positionnel.join(' | ')}`);
  ok(erreursDe(`${entete}cv env : mod.adsr(attack:5, decay:120)\nS -> C4\n`).length === 0,
     '§2sexies la forme NOMMÉE reste la bonne — mod.adsr(attack:5, decay:120)');
  ok(erreursDe(`@core\n@controls\n@actor v alphabet.western transport.midi(ch:3)\n@mode:ord\nS -> v.C4\n`).length === 0,
     "§2sexies l'instanciation nommée d'un composant reste légitime — transport.midi(ch:3)");
}

// ─── §2septies. LE SAC ÉCRIT AVEC DES ESPACES — la forme que nul crible ne voit ─────────────
// Constat bpx [806]. `(vel:50 pan:7)` est FAUX (deux ÉLÉMENTS d'un sac) et `(keyxpand:B3 -1)` est
// JUSTE (deux PARTIES d'une valeur) : les CARACTÈRES sont les mêmes. Seul le REGISTRE tranche —
// combien de parties le contrôle attend-il. C'est la plus dangereuse des formes fautives, parce
// qu'elle charge parfois sans erreur et peut vivre longtemps sans que rien ne la signale.
// Étendue mesurée par bpx : zéro dans les scènes et la bibliothèque ; zéro aujourd'hui ne veut
// pas dire zéro demain.
for (const [forme, quoi] of [
  ['S -> {C4 D4}(vel:50 pan:7)', 'deux éléments valués, espace au lieu de virgule'],
  ['S -> C4 (vel:50 velcont)', 'un élément valué puis une clé nue, sans virgule'],
  ['S -> C4 (wave:sine detune:5)', 'deux éléments, sac runtime'],
  ['S -> C4 [mode:random weight:50]', 'deux éléments, sac moteur et CLÉS RÉSERVÉES — elles passaient par un autre lecteur, sans aucune garde'],
  ['S -> C2 (C2:cutoff: env1)', "espace après le SECOND deux-points (écriture à sujet) — un crible qui ne regarde que le premier le manque"],
  ['S -> C2 (*:cutoff: env1)', 'idem avec le sujet universel'],
]) {
  ok(erreursDe(`@core\n@controls\n@alphabet.western:midi\n@mode:ord\n${forme}\n`).length > 0,
     `§2septies ${quoi} : '${forme.replace('S -> ', '')}' doit être refusé`);
}
// LES LÉGALES, indiscernables des précédentes au caractère près :
for (const forme of [
  'S -> {C4 D4}(vel:50, pan:7)', 'S -> C4 (keyxpand:B3 -1)', 'S -> C4 (keymap:C3 C3 C5 C5)',
  'S -> C4 (vel:50, velcont)', 'S -> C4 [mode:random, weight:50]', 'S -> C2 (C2:cutoff:env1)',
  'S -> C2 (*:cutoff:env1)',
]) {
  const e = erreursDe(`@core\n@controls\n@alphabet.western:midi\n@mode:ord\n${forme}\n`);
  ok(e.length === 0, `§2septies '${forme}' est LÉGAL et doit passer — reçu : ${e.join(' | ')}`);
}

// ─── §2octies. LE SUCRE EST STRICTEMENT SON DÉPLIÉ ──────────────────────────────────────────
// Constat bpx : `{C4, D4}:2` rendait un cadre à DEUX VOIX portant un qualificatif de clé `speed`.
// Deux fautes dans une ligne — le mot `speed` est SUPPRIMÉ du langage depuis le 2026-06-26 (et
// supprimé parce qu'il était MAL NOMMÉ), et le contenu doit être IMBRIQUÉ, pas dispersé :
// `{2, C4, D4}` est deux voix dans un cadre 2 ; `{2, {C4, D4}}` est UNE voix qui contient le
// groupe. Ce n'est pas la même musique, même quand le son coïncide.
// La vérification ne lit pas la forme attendue : elle COMPARE le sucre à son écriture dépliée.
// Un oracle qui décrit ce qu'on croit juste se trompe avec nous ; une équivalence, non.
for (const [sucre, deplie] of [
  ['{C4, D4}:2', '{2, {C4, D4}}'],
  ['{C4, D4}:1/2', '{1/2, {C4, D4}}'],
  ['{C4 D4}:3', '{3, {C4 D4}}'],
  ['A4:2 C4', '{2, A4} C4'],
  ['A4:1/2 C4', '{1/2, A4} C4'],
]) {
  const arbre = (r) => {
    const o = compileToBPxAST(`@core\n@controls\n@alphabet.western:midi\n@mode:ord\nS -> ${r}\n`);
    return JSON.stringify(o.ast?.subgrammars?.[0]?.rules?.[0]?.rhs);
  };
  ok(arbre(sucre) === arbre(deplie),
     `§2octies '${sucre}' doit produire EXACTEMENT l'arbre de '${deplie}'\n        sucre : ${arbre(sucre)}\n        déplié: ${arbre(deplie)}`);
}
// Et le mot supprimé ne doit survivre NULLE PART dans l'arbre.
{
  const o = compileToBPxAST('@core\n@controls\n@alphabet.western:midi\n@mode:ord\nS -> {C4, D4}:2 A4:3\n');
  ok(!JSON.stringify(o.ast?.subgrammars || []).includes('"speed"'),
     "§2octies le mot 'speed', supprimé de la surface, ne doit pas survivre comme clé dans l'arbre");
}

// ─── §3. Aucun faux positif : ce qui est légitime passe toujours ─────────────────────────────
for (const [appel, pourquoi] of [
  ['!(ins:5)', 'contrôle nommé, dans le flux — la traduction de script(MIDI program 5)'],
  ['!(cc.98:0)', 'contrôleur NUMÉROTÉ — la traduction du controller'],
  ['!(chan:1)', 'contrôle nommé, dans le flux'],
  ['C4(vel:80)', 'terminal d\'alphabet porteur d\'un qualificatif de runtime'],
]) {
  const errs = erreursDe(scene(`S -> ${appel} C4`));
  ok(errs.length === 0, `§3 '${appel}' (${pourquoi}) doit rester accepté — reçu : ${errs.join(' | ')}`);
}
// Un non-terminal déclaré, appelé avec des arguments, reste valide.
ok(erreursDe(scene('S -> A(vel:80)\nA -> C4 D4')).length === 0,
   '§3 un non-terminal DÉCLARÉ appelé avec arguments doit rester accepté');

// ─── §4. Aucun appelant VIVANT dans le corpus ────────────────────────────────────────────────
// « Vivant » = qui compile encore. Les scènes qui portent une famille sans nom gardent leur
// `script(…)` écrit — et doivent échouer. Ce test mord si l'une d'elles redevient verte.
const RE_APPEL_SCRIPT = /(^|[^\w.])script\s*\(/;
const porteuses = readdirSync(DIR_BPS).filter((f) => f.endsWith('.bps')).filter((f) => {
  const lignes = readFileSync(path.join(DIR_BPS, f), 'utf8').split('\n')
    .filter((l) => !l.trimStart().startsWith('//'));   // le code seul : les notes de conversion en parlent
  return lignes.some((l) => RE_APPEL_SCRIPT.test(l));
});
for (const f of porteuses) {
  const errs = erreursDe(readFileSync(path.join(DIR_BPS, f), 'utf8'));
  ok(errs.length > 0, `§4 ${f} porte encore un appel script(…) ET COMPILE — appelant vivant, interdit`);
}
// Le corpus ne doit plus porter AUCUNE des deux familles traduisibles : elles ont un nom.
const TRADUISIBLES = /script\s*\(\s*MIDI\s+(program|controller)/i;
for (const f of readdirSync(DIR_BPS).filter((x) => x.endsWith('.bps'))) {
  const code = readFileSync(path.join(DIR_BPS, f), 'utf8').split('\n')
    .filter((l) => !l.trimStart().startsWith('//')).join('\n');
  ok(!TRADUISIBLES.test(code),
     `§4 ${f} porte encore une famille TRADUISIBLE (MIDI program → ins(N), MIDI controller → chan(N) cc(C,V))`);
}

// ─── Verdict ─────────────────────────────────────────────────────────────────────────────────
if (echecs.length) {
  console.error(`❌ vocabulaire des appels : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error('   -', e);
  process.exitCode = 1;
} else {
  console.log(`✅ vocabulaire des appels — ${passe} vérification(s) passée(s) ; ${porteuses.length} scène(s) portant script(…) refusée(s) comme prévu`);
}
