#!/usr/bin/env node
// AUCUN ROUTAGE DE CONTRÔLE N'EST CODÉ EN DUR DANS LE PARSEUR — la donnée dit le COMPORTEMENT
// (l'énumération d'une valeur), le parseur le LIT.
//
// ⚠️ CE GARDE COMPLÈTE `aucune_liste_du_langage_n_est_codee_en_dur.mjs`, IL NE LE DOUBLE PAS.
// Ce dernier confronte les LISTES de `lib/core.json` schema à des littéraux `[...]`/`new Set([...])`
// reproduits dans le code — il ne voit ni un OBJET littéral (`{left:'left', right:'right', …}`),
// ni les données d'`engine.json`/`time.json`. C'est exactement là que vivait le hardcode que ce
// garde tient (étape 3, mise en conformité des librairies, règle 5 de Romain : « aucun contrôle
// codé en dur dans le parseur »).
//
// CE QU'IL VÉRIFIE, PAR INJECTION — pas par lecture de source. Un texte peut ressembler à une
// lecture de donnée et rester un hardcode déguisé (ex. une valeur par défaut recopiée). La seule
// preuve qui tient : changer la DONNÉE et observer que la SORTIE du compilateur suit.
//   1. ÉNUMÉRATION DE VALEUR d'un réglage réservé (`engine.<clé>.values`, ex. scan → left/right/rnd) :
//      injecter une énumération différente et vérifier que le parseur ACCEPTE les valeurs neuves
//      ET REFUSE les anciennes — la preuve qu'aucune copie locale ne subsiste en parallèle.
//   2. RÉGRESSION — `duration`, retirée parce qu'elle faisait double emploi avec un refus
//      générique déjà data-driven (aucune librairie ne déclare plus 'duration'), reste REFUSÉE.
//      (`out.video`/`out.visual` NE SONT PAS ici : reclassés en tombstone légitime — case B, comme
//      `mm`/`scene`/`routing`/`library` — après que `test_eval_transport_reject.js` a montré
//      qu'un test VIVANT exige le mot 'SUPPRIMÉ', que le refus générique ne porte pas.)
//   3. LA LISTE FIGÉE DE DIRECTIVES DE PRODUCTION EST SORTIE (`PRODUCTION_DIRECTIVES`, morte).
//
//   4. LE MÉTRONOME PORTE UN SEUL NOM, `tempo`, DE LA SURFACE JUSQU'À L'ARBRE.
//
// ⚠️ CE QUATRIÈME POINT A VÉCU QUELQUES HEURES COMME UNE EXCEPTION NOMMÉE, ET C'EST CE QUI A
// SERVI. `tempo` → `mm` était une RÉCONCILIATION de convention — l'auteur écrivait `tempo`,
// l'arbre portait `mm` parce que BPx lisait ce mot — donc ni un contrôle en dur par négligence,
// ni un mot de structure. Une table `EN_ARBITRAGE` a nommé ses sites le temps que la frontière se
// règle, sur le motif de `CONNUS` dans `test/une_scene_porte_ce_qu_elle_ecrit.mjs:74-77`. Romain a
// tranché le 2026-08-10 (« notre nominal c'est BPScript »), BPx a mesuré que son chargeur
// acceptait déjà `tempo`, la table est sortie et sa vérification en sens inverse a exigé qu'elle
// sorte — une exception qui survit à sa raison masque la suivante.
//
// CE QUI SE VÉRIFIE ICI EST DONC L'ÉTAT FINAL, pas l'exception : l'arbre porte `tempo`, et `mm`
// n'y apparaît plus comme nom de directive, quelle que soit la porte d'entrée — directive de
// tête, modificateur de `mode:X(...)`, ou défaut d'environnement inscrit par le compilateur. Ce
// dernier est le site que la première mesure avait manqué : il ÉCRIT le nom au lieu de le
// comparer, donc aucune recherche de comparaison littérale ne pouvait le trouver.
//
// MATRICE, PAS UNE LISTE DE CAS : le mécanisme que `libs.js` expose au parseur pour cette étape
// (`universeSacs().specs.<clé>.values`) est éprouvé dans TOUTES les sections qui le consomment.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileToBPxAST } from '../src/transpiler/index.js';
import { registerLib } from '../src/transpiler/libs.js';
import { LIBS } from '../src/transpiler/libs-data.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ICI, '..', 'src', 'transpiler');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const clone = (o) => JSON.parse(JSON.stringify(o));
const SOCLE = 'core\nalphabet.western\n';
const err = (src) => {
  try { return (compileToBPxAST(SOCLE + src).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};
const ast = (src) => {
  try { return compileToBPxAST(SOCLE + src); }
  catch (e) { return { errors: [{ message: 'JETÉ : ' + String(e.message) }] }; }
};

// SOCLE — la lib que ce garde injecte doit exister sous la forme attendue, sinon l'injection ne
// teste rien (un socle disparu rendrait ce garde muet et vert).
ok(Array.isArray(LIBS?.engine?.engine?.scan?.values) && LIBS.engine.engine.scan.values.length === 3,
   `SOCLE : lib/engine.json engine.scan.values absent ou de forme différente`);

// ────────────────────────────────────────────────────────────────────────────
// 4. LE MÉTRONOME PORTE UN SEUL NOM DANS L'ARBRE — `tempo`, par TOUTES ses portes d'entrée
// ────────────────────────────────────────────────────────────────────────────
// La portée ET son complément : il ne suffit pas que `tempo` arrive, il faut que `mm` n'arrive
// PLUS — un renommage qui laisserait une porte ouverte produirait deux noms pour une chose, ce
// que ce chantier vient précisément de fermer.
{
  // ⚠️ LES DEUX PORTES N'ABOUTISSENT PAS AU MÊME ENDROIT DE L'ARBRE, et une sonde qui ne
  // regarderait qu'un seul endroit serait verte sans rien prouver de l'autre : une directive de
  // tête vit dans `ast.directives`, tandis que `mode:X(...)` est traité à part et dépose ses
  // modificateurs sur la SOUS-GRAMMAIRE. Chaque porte est donc lue là où elle arrive.
  const PORTES = [
    ['directive de tête', 'tempo:120\n-----\nS -> C4', (a) => (a?.directives || [])
      .flatMap((d) => [d.name, ...((d.modifiers || []).map((m) => m && m.name))])],
    ['forme préfixée par sa librairie', 'time.tempo:120\n-----\nS -> C4', (a) => (a?.directives || [])
      .flatMap((d) => [d.name, ...((d.modifiers || []).map((m) => m && m.name))])],
    // ⚠️ LA TROISIÈME PORTE EST REVENUE LE 2026-08-18, ET AVEC LE MÊME NOM. `mm` est sorti du
    // langage sur arbitrage de Romain ; son câblage natif (`bp3:_mm`) et sa portée `subgrammar`
    // sont passés à `tempo`, dans le domicile que la bible lui donne — `lib/time.json`. Le mot
    // s'écrit donc aux DEUX places. Cette ligne mesurait auparavant le REFUS du modificateur —
    // elle mesure maintenant qu'il aboutit, et sous le nom unique.
    ['modificateur de sous-grammaire', 'mode:random(tempo:60)\n-----\nS -> C4',
      (a) => (a?.subgrammars || []).flatMap((s) => (s.modifiers || []).map((m) => m && m.name))],
  ];
  for (const [quoi, src, lire] of PORTES) {
    const r = ast(src);
    const noms = lire(r.ast).filter(Boolean);
    ok(noms.includes('tempo'),
       `porte '${quoi}' : l'arbre doit porter le nom 'tempo' ; reçu ${JSON.stringify(noms)}`);
    ok(!noms.includes('mm'),
       `porte '${quoi}' : l'arbre ne doit PLUS porter 'mm' — le métronome a un seul nom depuis le `
       + `2026-08-10 ; reçu ${JSON.stringify(noms)}`);
  }

  // LA PORTE QUE LA PREMIÈRE MESURE AVAIT MANQUÉE — le défaut d'ENVIRONNEMENT est ÉCRIT par le
  // compilateur (`bpxAst.js:applyEnvironmentDefaults`), pas comparé : aucune recherche de
  // comparaison littérale ne pouvait le trouver, et c'est le garde des défauts d'environnement qui
  // l'a fait tomber. Il s'éprouve donc ici par la SORTIE, seule façon de voir un nom qu'on écrit.
  const envAst = compileToBPxAST('-----\nS -> C4', { tempo: 90 }).ast;
  const envDirs = (envAst?.directives || []).filter((d) => d && d.fromEnvironment);
  ok(envDirs.length === 1 && envDirs[0].name === 'tempo',
     `porte 'défaut d'environnement' : le compilateur doit INSCRIRE le nom 'tempo' ; reçu `
     + `${JSON.stringify(envDirs.map((d) => d.name))}`);

  // LA SURFACE RESTE FERMÉE — sans ce témoin, retirer le renommage pourrait rouvrir `mm`.
  ok(err('mm:120\n-----\nS -> C4').length >= 1,
     `TÉMOIN — 'mm:120' reste REFUSÉ en surface (sortie du langage le 2026-06-26) : le nom de `
     + `l'arbre a changé, pas ce qu'un auteur a le droit d'écrire`);
}

// ────────────────────────────────────────────────────────────────────────────
// 1. ÉNUMÉRATION DE VALEUR — engine.scan.values injecté
// ────────────────────────────────────────────────────────────────────────────
{
  const engineOriginal = LIBS.engine;
  try {
    // TÉMOIN — AVANT injection.
    ok(err('-----\nS -> C4 (scan:left)').length === 0, `TÉMOIN — '(scan:left)' doit compiler AVANT injection`);
    ok(err('-----\nS -> C4 (scan:nord)').length >= 1, `TÉMOIN — '(scan:nord)' doit être refusé AVANT injection (hors énumération)`);

    // INJECTION — une énumération DIFFÉRENTE, disjointe de l'ancienne. Si le parseur portait
    // encore sa propre copie ({left,right,rnd}), 'nord' resterait refusé ET 'left' resterait
    // accepté malgré l'injection : le garde ne mordrait pas.
    const modifie = clone(engineOriginal);
    modifie.engine.scan.values = ['nord', 'sud'];
    registerLib('engine', modifie);

    ok(err('-----\nS -> C4 (scan:nord)').length === 0,
       `INJECTION — '(scan:nord)' doit désormais PASSER (valeur ajoutée par la donnée injectée) ; `
       + `reçu : ${JSON.stringify(err('-----\nS -> C4 (scan:nord)'))}`);
    ok(err('-----\nS -> C4 (scan:left)').length >= 1,
       `INJECTION — '(scan:left)' doit désormais être REFUSÉ ('left' n'est plus dans l'énumération `
       + `injectée) ; si ça passe encore, le parseur garde sa propre copie de l'ancienne liste`);

    const rNord = ast('-----\nS -> C4 (scan:nord)');
    const mode = rNord.ast?.subgrammars?.[0]?.rules?.[0]?.mode;
    ok(mode === 'nord', `INJECTION — 'rule.mode' doit porter la valeur INJECTÉE 'nord' ; reçu '${mode}'`);
  } finally {
    registerLib('engine', engineOriginal);
  }
  ok(err('-----\nS -> C4 (scan:left)').length === 0, `RETRAIT — '(scan:left)' repasse après restauration`);
  ok(err('-----\nS -> C4 (scan:nord)').length >= 1, `RETRAIT — '(scan:nord)' redevient refusé après restauration`);
}

// ────────────────────────────────────────────────────────────────────────────
// 2. RÉGRESSION — un hardcode retiré (branche dédiée à `duration`) reste un REFUS, sous le
//    mécanisme générique (aucune librairie ne déclare plus 'duration' — cf. le garde dédié
//    `une_forme_supprimee_ne_revient_pas_par_une_librairie.mjs`, éprouvé sur les 3 graphies).
// ────────────────────────────────────────────────────────────────────────────
{
  ok(err('duration:16\n-----\nS -> C4').length >= 1,
     `'duration:16' doit rester REFUSÉ ('duration' n'est déclarée par aucune librairie) — `
     + `la forme dédiée en dur a été retirée, pas le refus`);
}

// ────────────────────────────────────────────────────────────────────────────
// 3. LA LISTE FIGÉE DE DIRECTIVES DE PRODUCTION EST SORTIE (plan étape 3, dernière ligne)
// ────────────────────────────────────────────────────────────────────────────
{
  // On cherche la DÉCLARATION/L'IMPORT vivant, pas le mot — constants.js documente en commentaire
  // POURQUOI la liste est partie, et ce commentaire cite forcément son nom. Une citation dans une
  // explication n'est pas un double, exactement le principe déjà posé par le garde voisin
  // (aucune_liste_du_langage_n_est_codee_en_dur.mjs) pour les mêmes raisons.
  const constantsTxt = readFileSync(path.join(SRC, 'constants.js'), 'utf-8');
  const parserTxt = readFileSync(path.join(SRC, 'parser.js'), 'utf-8');
  ok(!/export\s+const\s+PRODUCTION_DIRECTIVES/.test(constantsTxt),
     `'PRODUCTION_DIRECTIVES' ne doit plus être DÉCLARÉE (export const) dans constants.js`);
  ok(!/\bPRODUCTION_DIRECTIVES\b/.test(parserTxt),
     `'PRODUCTION_DIRECTIVES' ne doit plus être importée/citée dans parser.js (aucune raison `
     + `documentaire de la nommer là — le fichier qui explique le retrait est constants.js)`);
  // Les cinq clés qu'elle portait restent des directives VIVANTES, déclarées en librairie —
  // leur retrait n'a pas dû faire sortir les mots du langage avec la liste qui les recopiait.
  for (const clé of ['seed', 'items', 'maxitems', 'allitems', 'all_items', 'improvize']) {
    ok(err(`${clé}:1\n-----\nS -> C4`).length === 0,
       `'${clé}:1' doit rester ACCEPTÉ — retirer la liste figée ne doit pas retirer le mot`);
  }
}

if (echecs.length) {
  console.error(`❌ un contrôle est routé en dur dans le parseur : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ aucun routage de contrôle codé en dur — ${passe} vérification(s) : énumération `
          + `(scan), 1 régression, PRODUCTION_DIRECTIVES sortie, métronome à un seul nom `
          + `(4 portes).`);
