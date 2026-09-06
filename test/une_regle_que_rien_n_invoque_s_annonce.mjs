#!/usr/bin/env node
/**
 * GARDE — UNE RÈGLE QUE RIEN N'INVOQUE S'ANNONCE, ET L'AXIOME SE TAIT.
 *
 * Demande de Romain, 2026-09-06 : *« à un moment voir que ce non terminal n'est nommé qu'une seule
 * fois et présent dans aucune autre règle → à ce moment-là il peut émettre un warning ? »*
 *
 * ⛔ C'EST UN AVERTISSEMENT, PAS UN REFUS. Une règle morte ne rend pas la scène fausse : elle ne
 * s'exécute simplement jamais. Le canal est donc `warnings`, et ce garde vérifie AUSSI que `errors`
 * reste vide — mêler les deux ferait d'une règle morte une faute.
 *
 * ⛔ ET IL NE SE JUSTIFIE PAS PAR LE NATIF — mesuré par bp3-engine le 2026-09-06 : sur deux règles
 * mortes, le moteur produit sans un mot, `Errors: 0`, aucune trace. *« BPScript fait ce que BP3 sait
 * faire »* est satisfait par le SILENCE ; cet avertissement est un AJOUT délibéré. Sans cette ligne,
 * quelqu'un le supprimera un jour au nom de la conformité au moteur.
 *
 * ⛔ CE QUI REND CE GARDE NÉCESSAIRE : L'AXIOME ET UN ORPHELIN SONT STRUCTURELLEMENT IDENTIQUES —
 * définis tous les deux, invoqués ni l'un ni l'autre. Rien dans l'arbre ne les sépare, et deux
 * tentatives de les distinguer par CALCUL ont échoué sur mesure :
 *
 *     « la première règle écrite »          436 signalements, dont 3 FAUX
 *     « plusieurs points d'entrée par sg »  966 signalements — une sous-grammaire est invoquée
 *                                           depuis une AUTRE, et je ne cherchais que dans la sienne
 *     l'axiome DÉCLARÉ, lu au schéma        110, sur 28 scènes des 377 du corpus publié
 *
 * ⚠️ LES TROIS FAUX DE LA PREMIÈRE TENTATIVE ÉTAIENT `kairos-octave-transpose-*`, où `MOTIF` précède
 * `S`. Romain les soupçonnait non conformes ; bp3-engine a mesuré le contraire — le natif produit
 * cette forme sans un mot, l'ordre d'écriture n'ayant AUCUN effet sur le point de départ. Le volet C
 * ci-dessous fige ce cas, parce que c'est lui qui a démasqué le calcul fautif.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { SYNTAXE } from '../src/transpiler/syntaxe-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const S = 'core\nalphabet.western\n-----\n';
const lire = (corps) => {
  const r = compileToBPxAST(`${S}${corps}`);
  return {
    erreurs: (r.errors || []).map((e) => e.code || String(e)),
    morts: (r.warnings || []).filter((w) => w && w.code === 'RESOLVE_RULE_NEVER_REACHED')
      .map((w) => w.message),
  };
};

// ── SOCLE — l'axiome doit être DÉCLARÉ, sinon ce garde mesure un juge qui se tait ────────────────
// `avertirNonTerminalJamaisInvoque` rend [] quand l'axiome manque, et c'est la sortie JUSTE : sans
// lui, il crierait sur le point d'entrée des 372 scènes qui en portent un. Mais un garde qui compte
// zéro avertissement ne distingue alors pas « rien à signaler » de « juge débranché ».
ok(typeof SYNTAXE?.axiome?.mot === 'string' && SYNTAXE.axiome.mot.length > 0,
   `SOCLE : le schéma de syntaxe doit DÉCLARER l'axiome — reçu ${JSON.stringify(SYNTAXE?.axiome)}. `
   + `Sans lui le juge se tait par conception, et tous les volets ci-dessous passeraient sur du vide.`);
const AXIOME = SYNTAXE?.axiome?.mot;

// ── A. CE QUI DOIT AVERTIR ───────────────────────────────────────────────────────────────────────
{
  const un = lire(`${AXIOME} -> C4\nORPH -> E4\n`);
  ok(un.morts.length === 1, `A. une règle morte doit s'annoncer — reçu ${un.morts.length}`);
  ok(un.erreurs.length === 0,
     `A. et NE PAS être une erreur — reçu ${JSON.stringify(un.erreurs)}. Un avertissement qui remplit `
     + `'errors' arrête la compilation d'une scène valide.`);
  ok(/ORPH/.test(un.morts[0] || ''),
     `A. le message doit NOMMER la règle — reçu ${JSON.stringify(un.morts[0])}`);

  // DEUX règles mortes rendent DEUX avertissements : un juge qui s'arrête au premier laisse
  // l'auteur corriger, recompiler, et retrouver la suivante — un aller-retour par faute.
  const deux = lire(`${AXIOME} -> C4\nO1 -> E4\nO2 -> F4\n`);
  ok(deux.morts.length === 2, `A. DEUX règles mortes doivent rendre DEUX avertissements — reçu ${deux.morts.length}`);
}

// ── B. CE QUI DOIT SE TAIRE — la moitié qui démasque une règle trop large ────────────────────────
{
  const saine = lire(`${AXIOME} -> M\nM -> C4\n`);
  ok(saine.morts.length === 0, `B. une grammaire saine ne dit rien — reçu ${JSON.stringify(saine.morts)}`);

  // ⛔ L'AXIOME EST DÉFINI ET JAMAIS INVOQUÉ, comme un orphelin. C'est LE cas que seule la
  // déclaration sépare, et il vaut pour 372 des 377 scènes du corpus.
  const axiome = lire(`${AXIOME} -> C4 D4\n`);
  ok(axiome.morts.length === 0,
     `B. l'AXIOME ne s'annonce jamais — reçu ${JSON.stringify(axiome.morts)}. Il est défini et jamais `
     + `invoqué, exactement comme un orphelin : seule sa déclaration au schéma les sépare.`);

  // ⚠️ ET `S` INVOQUÉ PAR UNE AUTRE RÈGLE RESTE L'AXIOME — borne mesurée au natif par bp3-engine :
  // « être invoqué ne le disqualifie pas ». Un juge qui exigerait qu'il ne soit jamais invoqué
  // rendrait la scène ci-dessous fautive.
  const rappele = lire(`${AXIOME} -> M\nM -> C4 ${AXIOME}\n`);
  ok(rappele.morts.length === 0,
     `B. l'axiome INVOQUÉ par une autre règle reste l'axiome — reçu ${JSON.stringify(rappele.morts)}`);
}

// ── C. LE CAS QUI A DÉMASQUÉ LE CALCUL FAUTIF, ET QUI EST CONFORME ───────────────────────────────
// `MOTIF` écrit AVANT `S`. Mon premier juge prenait « la première règle écrite » pour l'axiome et
// signalait `S` — trois scènes du corpus, toutes justes. bp3-engine a mesuré le natif : cette forme
// produit sans un mot, l'ordre d'écriture n'a aucun effet sur le point de départ.
{
  const ordre = lire(`MOTIF -> C4\n${AXIOME} -> MOTIF MOTIF\n`);
  ok(ordre.morts.length === 0,
     `C. l'ordre d'écriture des règles n'a AUCUN effet sur le point de départ — reçu `
     + `${JSON.stringify(ordre.morts)}. Le natif produit cette forme sans un mot (bp3-engine, `
     + `2026-09-06) : un juge qui prend la PREMIÈRE RÈGLE ÉCRITE pour l'axiome signale ici à tort.`);
  ok(ordre.erreurs.length === 0, `C. et elle doit compiler — reçu ${JSON.stringify(ordre.erreurs)}`);
}

// ── D. LE TÉMOIN QUI DISCRIMINE — sans lui, un juge DÉBRANCHÉ passerait tout ────────────────────
// Les volets B et C attendent le SILENCE. Un juge qui ne tourne plus les passerait tous les trois,
// et seul le volet A le rattrape. Ce témoin le dit autrement : le mécanisme doit distinguer deux
// scènes qui ne diffèrent que par la règle morte.
{
  const avec = lire(`${AXIOME} -> C4\nORPH -> E4\n`);
  const sans = lire(`${AXIOME} -> C4\n`);
  ok(avec.morts.length > sans.morts.length,
     `D. TÉMOIN — le juge doit DISCRIMINER : la même scène avec et sans règle morte rend `
     + `${avec.morts.length} et ${sans.morts.length}. Égaux, il ne mesure rien.`);
}

if (echecs.length) {
  console.error(`[règle morte] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[règle morte] ${passe} PASS / 0 FAIL — ${passe} assertion(s) · une règle que rien `
  + `n'invoque s'annonce, l'axiome '${AXIOME}' se tait`);
