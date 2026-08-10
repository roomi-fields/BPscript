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
import { DIR_BPS, exigerCorpus } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const scene = (regles) => `@core\n@alphabet.western:midi\n@mode:ord\n${regles}\n`;
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
// ⚠️ L'EXIGENCE A ÉTÉ REFORMULÉE LE 2026-08-08, PAS AFFAIBLIE — et la raison est structurelle.
// Ce volet exigeait que le refus cite l'écriture ENTIÈRE, parce que TOUT `nom(…)` était alors lu
// comme un appel et refusé d'un bloc. Depuis que la bascule se décide sur le NOM et non sur la clé
// (`LANGUAGE.md` §« quatre rôles »), deux constructions différentes se cachent sous la même allure :
//   · `script(MIDI program 5)` n'est lisible NI comme un sac (son contenu n'est pas fait de paires)
//     NI comme un appel (aucune définition ne porte ce nom) → un seul refus, qui cite tout ;
//   · `script(Beep)` EST un sac bien formé — une clé nue — posé sur un élément `script` : deux
//     choses inconnues, donc DEUX refus, chacun nommant la sienne.
// Exiger « cite l'écriture entière » sur le second réclamerait un message qui ment sur ce qui a été
// lu. Ce qui compte reste : ça refuse, et TOUT ce qui est fautif est NOMMÉ. C'est ce qu'on mesure.
for (const [appel, ce_que_c_est, aNommer] of [
  ['script(MIDI program 5)', 'la forme historique la plus fréquente', ['script(MIDI program 5)']],
  ['script(Beep)', 'un script sans argument numérique', ['Beep', 'script']],
  ['foobar(3)', "un nom quelconque : la règle vaut pour tout le vocabulaire, pas pour 'script' seul", ['foobar(3)']],
]) {
  const errs = erreursDe(scene(`S -> ${appel} C4`));
  ok(errs.length > 0, `§2 '${appel}' (${ce_que_c_est}) doit être refusé — il est passé en silence`);
  for (const mot of aNommer) {
    ok(errs.some((m) => m.includes(mot)),
       `§2 le refus de '${appel}' doit NOMMER '${mot}' — reçu : ${errs.join(' | ') || '(aucune erreur)'}`);
  }
}

// Niché dans un groupe : rien ne se cache derrière des accolades.
ok(erreursDe(scene('S -> {C4 script(Beep)} D4')).some((m) => m.includes('script')),
   '§2 un nom hors vocabulaire NICHÉ dans un groupe doit être refusé lui aussi');

// Sans alphabet de notes en portée (scène à gates), le vocabulaire reste vérifié.
ok(erreursDe('@core\n@gate a:midi\n@mode:ord\nS -> a script(Beep) a\n').some((m) => m.includes('script')),
   "§2 un nom hors vocabulaire doit être refusé même SANS alphabet de notes (scène à gates)");

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
  for (const [nom, entete] of [['sans import', '@core\n'], ['avec import', '@core\n']]) {
    const errs = erreursDe(`${entete}@alphabet.western:midi\n@mode:ord\n${REGLES}\n`);
    ok(errs.length > 0, `§2bis témoin bpx (${nom}) : la forme d'appel doit être refusée`);
    // Deux chemins, deux messages, et c'est correct : AVEC import, le parseur reconnaît le nom
    // et refuse la GRAPHIE ; SANS import, le nom n'est pas un contrôle pour cette scène et c'est
    // la garde de vocabulaire qui refuse. Ce qui compte est qu'aucun des deux ne laisse passer.
    ok(errs.some((m) => /n'existe pas|forme d'appel|pas importé/.test(m)),
       `§2bis témoin bpx (${nom}) : le refus doit être motivé — reçu : ${errs.join(' | ')}`);
  }
  // Et l'écriture qui la remplace passe, elle, dans les deux régimes.
  ok(erreursDe('@core\n@alphabet.western:midi\n@mode:ord\nS -> !(vel:80) C4 D4\n').length === 0,
     '§2bis la nouvelle écriture !(vel:80) doit rester acceptée');
  ok(erreursDe('@core\n@alphabet.western:midi\n@mode:ord\nS -> C4 D4 (vel:80)\n').length === 0,
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
  ok(erreursDe(`@core\n@alphabet.western:midi\n@mode:ord\n${forme}\n`).length > 0,
     `§2ter ${quoi} : '${forme.replace('S -> ', '').replace(' C4', '')}' doit être refusé`);
}
// Et les écritures ratifiées passent — sinon ce garde interdirait tout, ce qui ne prouverait rien.
// ⚠️ `legato` a rejoint les RÉGLAGES RÉSERVÉS le 2026-08-06 (usage FLUX uniquement au corpus,
// sûr côté BPx — cf. lib/core.json `_qualifierKeys_doc`) : `![legato:100]` (l'ancienne écriture
// ratifiée) est désormais REFUSÉ, remplacé par `!(legato:100)`.
for (const forme of [
  'S -> !(vel:80) C4', 'S -> !(vel:80, pan:64) C4', 'S -> C4 D4 [goto:3 0]',
  'S -> !(keymap:C3 C3 C5 C5) C4', 'S -> !(cc.98:45) C4', 'S -> C4 D4 (vel:80)',
  'S -> C4 [repeat:K1]', 'S -> !(keyxpand:B3 -1) C4', 'S -> !(legato:100) C4',
]) {
  const e = erreursDe(`@core\n@alphabet.western:midi\n@mode:ord\n${forme}\n`);
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
  // ⚠️ `weight` s'écrit en PARENTHÈSES depuis la décision Romain 2026-08-02 (LANGUAGE.md:773-800) —
  // `[weight:…]` est désormais refusé quelle que soit la présence d'un espace. Le cas qui teste
  // GENUINEMENT la règle de l'espace pour une clé réservée doit donc s'écrire dans son sac d'accueil.
  ['S -> C4 (weight: 50)', 'clé réservée du langage'],
  ['S -> !(cc.98: 45) C4', 'composant numéroté'],
]) {
  ok(erreursDe(`@core\n@alphabet.western:midi\n@mode:ord\n${forme}\n`).length > 0,
     `§2quater ${ou} : l'espace après le deux-points doit être refusé — '${forme.replace('S -> ', '')}'`);
}
// ⚠️ LE FAUX POSITIF À NE PAS FABRIQUER : l'espace reste LÉGITIME entre les PARTIES d'une valeur.
// Une garde qui interdirait les valeurs à plusieurs parties casserait ce qu'on vient de construire.
for (const forme of [
  'S -> !(keymap:C3 C3 C5 C5) C4', 'S -> C4 D4 [goto:3 0]', 'S -> !(scale:just_intonation C4) C4',
  'S -> !(keyxpand:B3 -1) C4', 'S -> !(vel:80, pan:64) C4', 'S -> C4 (scan:left, weight:50)',
]) {
  const e = erreursDe(`@core\n@alphabet.western:midi\n@mode:ord\n${forme}\n`);
  ok(e.length === 0, `§2quater l'espace ENTRE PARTIES reste légitime : '${forme}' — reçu : ${e.join(' | ')}`);
}

// ─── §2quinquies. LE SAC DIT QUI REÇOIT ──────────────────────────────────────────────────────
// Crochets = moteur, parenthèses = runtime : un CONTRÔLE (déclaré dans `lib/controls.json`) ne
// vit pas dans les deux. La déclaration arbitre, JAMAIS le nombre — mesuré au corpus, la majorité
// se trompait pour deux contrôles sur cinq. Décision `hub/decisions/2026-06-14-locus-perf-controls.md`.
//
// ⚠️ `tempx` est SORTI DU LANGAGE le 2026-08-06 (décision Romain — doublon exact de l'opérateur
// de vitesse, qui s'écrit `! (/N)` dans le flux). Il ne figure plus dans ces deux listes : il
// n'est plus « un réglage mal signé », il n'est plus un mot. Son refus est vérifié à sa propre
// section (§2quinquies ter), avec la relève que le message doit nommer.
// ⚠️ `tempx` SORTAIT de cette règle depuis le 2026-08-02 (LANGUAGE.md:773-800) : c'était un RÉGLAGE
// réservé du langage (`@core.schema.qualifierKeys`), pas un contrôle au sens de cette section —
// « un signe, une nature » le fait toujours atterrir en parenthèses, même s'il est AUSSI déclaré
// dans la section `engine` de `controls.json`. Cf. §2quinquies (légitimes) plus bas.
// ⚠️ `rotate`/`legato`/`staccato` SORTENT de cette règle aussi depuis le 2026-08-06, même
// mécanisme, même raison — `rndtime` (usage rule-suffix côté BPx, hors périmètre de cette
// migration, cf. lib/core.json `_qualifierKeys_doc`) reprend leur place d'exemple ci-dessous.
// ⚠️ « UN CONTRÔLE MOTEUR DANS LE SAC RUNTIME » A ÉTÉ RETIRÉ D'ICI le 2026-08-07 : cette moitié
// contredisait la décision `2026-08-02-le-crochet-est-reserve-aux-gardes-les-reglages-passent-
// en-parentheses.md`, qui dit « TOUT réglage s'écrit entre parenthèses, MOTEUR COMPRIS » et
// « le signe n'adresse rien : le domaine de la clé le fait ». Un réglage moteur en parenthèses
// est désormais la forme NORMALE — et c'est celle du moteur natif, mesurée : `_rndtime(50)`
// posé dans le flux (`-da.checkNoteOff`).
// L'autre sens RESTE refusé et garde toute sa raison d'être : un réglage de RUNTIME écrit entre
// crochets n'a nulle part où aller, le crochet ne portant plus que ce qui gouverne la dérivation.
for (const [forme, quoi] of [
  ['S -> C4 [vel:80]', 'contrôle runtime écrit dans le sac moteur'],
  ['S -> C4 [keyxpand:B3 -1]', 'contrôle de dispatcher dans le sac moteur'],
  ['S -> {C4, D4}[scale:2]', "le `scale` MOTEUR, supprimé le 2026-07-26 : subsumé par la durée collée"],
]) {
  ok(erreursDe(`@core\n@alphabet.western:midi\n@mode:ord\n${forme}\n`).length > 0,
     `§2quinquies ${quoi} : '${forme.replace('S -> ', '')}' doit être refusé`);
}
// Ce qui reste légitime — dont le `rotate`/`legato` de SÉQUENCE, désormais des RÉGLAGES réservés
// (parenthèses, `!(…)` dans le flux) et non plus des contrôles du sac moteur (à ne pas confondre
// avec l'ancien rotate de hauteur, renommé `scaleshift` le 2026-07-11).
for (const forme of [
  'S -> {C4, D4}:2',
  'S -> !(vel:80) C4', 'S -> !(legato:100) C4', 'S -> !(scale:just_intonation C4) C4',
  'S -> {C4 D4}!(rotate:2)',
]) {
  const e = erreursDe(`@core\n@alphabet.western:midi\n@mode:ord\n${forme}\n`);
  ok(e.length === 0, `§2quinquies '${forme}' doit rester accepté — reçu : ${e.join(' | ')}`);
}

// ─── §2quinquies bis. UN SIGNE, UNE NATURE — le RÉGLAGE réservé change de sac (2026-08-02) ──
// Décision Romain 2026-08-02 (LANGUAGE.md:773-800) : `mode`/`scan`/`weight`/`on_fail`/`tempx`/
// `meter` sont des RÉGLAGES, pas des contrôles — ils décrivent une propriété PRODUITE, et
// s'écrivent désormais en PARENTHÈSES dans TOUS les cas, `tempx` compris (bien que ce dernier
// soit AUSSI déclaré dans la section `engine` de `controls.json` — cette déclaration ne le
// classe plus, sa nature de réglage l'emporte). Le crochet ne garde que trois emplois : garde,
// affectation de drapeau, rang de gabarit.
for (const [forme, quoi] of [
  // ⚠️ `mode` A CHANGÉ DE STATUT le 2026-08-08 : il n'est plus une clé de sac du tout (décision
  // Romain). Il reste refusé entre crochets — mais désormais parce qu'il ne s'écrit NULLE PART
  // dans une règle, et non parce qu'il faudrait des parenthèses. `scan` prend sa place ici :
  // c'est un réglage qui, lui, s'écrit bien entre parenthèses, ce que ce cas mesure.
  ['S -> C4 [scan:left]', 'scan : crochets refusés'],
  ['S -> C4 [scan:left]', 'scan : crochets refusés'],
  ['S -> C4 [weight:50]', 'weight : crochets refusés'],
  ['S -> C4 [on_fail:fallback(B)]', 'on_fail : crochets refusés'],
  ['S -> C4 [meter:4+4/6]', 'meter : crochets refusés'],
]) {
  const e = erreursDe(`@core\n@alphabet.western:midi\n@mode:ord\n${forme}\n`);
  ok(e.length > 0, `§2quinquies bis ${quoi} : '${forme.replace('S -> ', '')}' doit être refusé`);
  ok(e.some((m) => /est un réglage, il s'écrit entre PARENTHÈSES/.test(m)),
     `§2quinquies bis ${quoi} : le message doit donner la forme du jour — reçu : ${e.join(' | ')}`);
}
for (const forme of [
  'S -> C4 (on_fail:skip)', 'S -> C4 (scan:left)', 'S -> C4 (weight:50)',
  'S -> C4 (on_fail:fallback(B))', 'S -> C4 (meter:4+4/6)',
]) {
  const e = erreursDe(`@core\n@alphabet.western:midi\n@mode:ord\n${forme}\n`);
  ok(e.length === 0, `§2quinquies bis '${forme}' doit être accepté — reçu : ${e.join(' | ')}`);
}

// ─── §2quinquies ter. UN MOT SUPPRIMÉ REFUSE, ET NOMME SA RELÈVE ────────────────────────────
// `tempx` est SUPPRIMÉ (décision Romain 2026-08-06). Le retirer de la librairie ne suffisait
// PAS : une clé inconnue entre parenthèses est portée OPAQUEMENT jusqu'au runtime, donc
// `(tempx:2)` aurait été accepté et n'aurait plus atteint personne — un doublon bruyant devenu
// réglage MUET. Il refuse donc dans les DEUX signes, et le message donne l'écriture vivante.
for (const forme of ['S -> C4 [tempx:2]', 'S -> C4 (tempx:2)', 'S -> C4 ![tempx:2] D4']) {
  const e = erreursDe(`@core\n@alphabet.western:midi\n@mode:ord\n${forme}\n`);
  ok(e.length > 0, `§2quinquies ter '${forme}' doit être REFUSÉ — 'tempx' n'est plus un mot`);
  ok(e.some((m) => /! \(\/N\)/.test(m)),
     `§2quinquies ter '${forme}' : le refus doit nommer la relève '! (/N)' — reçu : ${e.join(' | ')}`);
}

// ⛔ §2sexies SUSPENDU le 2026-08-09 : il mesurait l argument POSITIONNEL dans une declaration de
// MODULATEUR, et la directive qui la portait est supprimee du langage. Sa forme de remplacement —
// les valeurs de depart d une instance de module — n est pas encore lue.
// ⚠️ CE QU IL AVAIT TROUVE MERITE D ETRE GARDE EN MEMOIRE : la declaration d un modulateur n est
// pas un sac de controle, donc la garde des sacs ne la voyait pas, et l argument positionnel y a
// survecu une journee entiere au menage general. Mesure par Atlas. C est l exemple type de la
// SOUS-ZONE qui echappe a une regle qu on croit appliquee partout — a rejouer sur la forme vivante
// des qu elle existera.
// ⚠️ ET UNE ASSERTION DU MEME BLOC SURVIT, PARCE QUE SON SUJET N EST PAS LE MODULATEUR :
// l instanciation NOMMEE d un composant reste legitime. Ma premiere coupure l avait emportee avec
// le reste — le fichier ne se chargeait meme plus. Une suppression au perimetre du COMMENTAIRE ne
// distingue pas ce que le bloc contient : c est le meme piege que le code mort et le code vivant
// dans une meme branche, ce matin.
// ⚠️ MESURE FAITE AVANT DE LA RALLUMER, et elle a tranche : son porteur non plus n existe pas —
// le module de sortie n est pas au catalogue. L assertion attendait donc une forme qui ne compile
// pour AUCUNE directive, ancienne ou nouvelle. Elle repart avec le bloc, et c est la bonne place :
// la rallumer  parce qu elle a l air independante  aurait fabrique un rouge de plus sans sujet.

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
  // ⚠️ `mode`/`weight` s'écrivent en PARENTHÈSES depuis la décision 2026-08-02 (LANGUAGE.md:773-800).
  ['S -> C4 (scan:left weight:50)', 'deux éléments, RÉGLAGES RÉSERVÉS — elles passaient par un autre lecteur, sans aucune garde'],
  ['S -> C2 (C2:cutoff: env1)', "espace après le SECOND deux-points (écriture à sujet) — un crible qui ne regarde que le premier le manque"],
  ['S -> C2 (*:cutoff: env1)', 'idem avec le sujet universel'],
]) {
  ok(erreursDe(`@core\n@alphabet.western:midi\n@mode:ord\n${forme}\n`).length > 0,
     `§2septies ${quoi} : '${forme.replace('S -> ', '')}' doit être refusé`);
}
// LES LÉGALES, indiscernables des précédentes au caractère près :
for (const forme of [
  'S -> {C4 D4}(vel:50, pan:7)', 'S -> C4 (keyxpand:B3 -1)', 'S -> C4 (keymap:C3 C3 C5 C5)',
  'S -> C4 (vel:50, velcont)', 'S -> C4 (scan:left, weight:50)', 'S -> C2 (C2:cutoff:env1)',
  'S -> C2 (*:cutoff:env1)',
]) {
  const e = erreursDe(`@core\n@alphabet.western:midi\n@mode:ord\n${forme}\n`);
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
    const o = compileToBPxAST(`@core\n@alphabet.western:midi\n@mode:ord\nS -> ${r}\n`);
    return JSON.stringify(o.ast?.subgrammars?.[0]?.rules?.[0]?.rhs);
  };
  ok(arbre(sucre) === arbre(deplie),
     `§2octies '${sucre}' doit produire EXACTEMENT l'arbre de '${deplie}'\n        sucre : ${arbre(sucre)}\n        déplié: ${arbre(deplie)}`);
}
// Et le mot supprimé ne doit survivre NULLE PART dans l'arbre.
{
  const o = compileToBPxAST('@core\n@alphabet.western:midi\n@mode:ord\nS -> {C4, D4}:2 A4:3\n');
  ok(!JSON.stringify(o.ast?.subgrammars || []).includes('"speed"'),
     "§2octies le mot 'speed', supprimé de la surface, ne doit pas survivre comme clé dans l'arbre");
}

// ─── §2nonies. LES QUATRE FAMILLES NOMMÉES ──────────────────────────────────────────────────
// `script(…)` portait plusieurs intentions sans nom. Quatre d'entre elles en ont un depuis le
// 2026-07-26 : mute, unmute, panic, sync. Aucune n'est un cas neuf — treize contrôles sans
// argument existaient déjà au registre (velcont, retro, volumecont…), et la forme pointée passe
// par le chemin générique des références.
for (const forme of [
  '!(mute) C4', '!(unmute) C4', '!(panic) C4',
  '!(mute.all) C4', '!(mute.lead) C4',
  '!(sync:start) C4', '!(sync:continue) C4', '!(sync:stop) C4',
]) {
  const e = erreursDe(`@core\n@alphabet.western:midi\n@mode:ord\nS -> ${forme}\n`);
  ok(e.length === 0, `§2nonies '${forme}' doit être accepté — reçu : ${e.join(' | ')}`);
}
// La liste fermée des messages de synchronisation mord déjà, sans code neuf : c'est la validation
// de valeurs du registre qui s'en charge.
ok(erreursDe('@core\n@alphabet.western:midi\n@mode:ord\nS -> !(sync:nexistepas) C4\n').length > 0,
   "§2nonies un message de synchronisation hors de la liste déclarée doit être refusé");

// ─── §2decies. LA CLÉ NUE SE COMPORTE PAREIL DANS LES DEUX RÉGIMES ──────────────────────────
// Asymétrie mesurée et fermée le 2026-07-26 : un sac dont la PREMIÈRE clé est nue n'était pas
// reconnu en suffixe de règle — `C4 !(velcont)` compilait, `C4 (velcont)` sortait « flèche
// attendue ». Et seule la POSITION décidait : `(vel:80, velcont)` passait quand
// `(velcont, vel:80)` échouait.
// La page de référence dit que les quatre signes se comportent à l'identique dans les deux sacs
// et à toute profondeur — « rien de ce qui est écrit ici ne cache une exception plus loin ».
// Une forme acceptée dans le flux et refusée en contenance EST une exception cachée.
for (const forme of [
  'S -> C4 (velcont)', 'S -> C4 (velcont, pitchcont)', 'S -> C4 (velcont, vel:80)',
  'S -> C4 (vel:80, velcont)', 'S -> C4 !(mute)', 'S -> {C4 D4}(velcont)', 'S -> C4(velcont) D4',
  'S -> C4 !(velcont) D4', 'S -> C4 !(velcont, pitchcont) D4',
]) {
  const e = erreursDe(`@core\n@alphabet.western:midi\n@mode:ord\n${forme}\n`);
  ok(e.length === 0, `§2decies '${forme}' doit être accepté — reçu : ${e.join(' | ')}`);
}
// Et le balayage ne doit pas happer ce qui n'est PAS un sac de clés.
ok(erreursDe('@core\n@alphabet.western:midi\n@mode:ord\nS -> C4 (vel:50 pan:7)\n').length > 0,
   '§2decies le balayage ne doit pas rendre légal un sac écrit avec des espaces');

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
ok(erreursDe(scene('S -> motif(vel:80)\nmotif -> C4 D4')).length === 0,
   '§3 un non-terminal DÉCLARÉ appelé avec arguments doit rester accepté');

// ─── §4. Aucun appelant VIVANT dans le corpus ────────────────────────────────────────────────
// « Vivant » = qui compile encore. Les scènes qui portent une famille sans nom gardent leur
// `script(…)` écrit — et doivent échouer. Ce test mord si l'une d'elles redevient verte.
// ⚠️ SOCLE — ce §4 conclut SUR LE CORPUS, donc il refuse d'en examiner zéro. Mesuré le 2026-07-27
// (question de l'architecte : « ton garde peut-il rendre un verdict vert sans avoir rien examiné ? ») :
// pointé sur un corpus vide, il annonçait « 0 scène(s) portant script(…) refusée(s) » et sortait
// VERT, alors qu'il en refuse trois quand il lit vraiment. Son silence ressemblait à un succès.
const { bps: nbScenes } = exigerCorpus();
ok(nbScenes > 40, `§4 le corpus doit fournir de quoi conclure — ${nbScenes} scène(s) lisible(s)`);

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
  console.log(`✅ vocabulaire des appels — ${passe} vérification(s) passée(s) ; `
            + `${porteuses.length} scène(s) portant script(…) refusée(s) comme prévu, `
            + `sur ${nbScenes} scène(s) du corpus EXAMINÉES`);
}
