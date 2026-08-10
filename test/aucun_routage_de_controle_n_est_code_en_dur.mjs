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
//   2. RÉGRESSION — `@duration`, retirée parce qu'elle faisait double emploi avec un refus
//      générique déjà data-driven (aucune librairie ne déclare plus 'duration'), reste REFUSÉE.
//      (`out.video`/`out.visual` NE SONT PAS ici : reclassés en tombstone légitime — case B, comme
//      `@mm`/`@scene`/`@routing`/`@library` — après que `test_eval_transport_reject.js` a montré
//      qu'un test VIVANT exige le mot 'SUPPRIMÉ', que le refus générique ne porte pas.)
//   3. LA LISTE FIGÉE DE DIRECTIVES DE PRODUCTION EST SORTIE (`PRODUCTION_DIRECTIVES`, morte).
//
// ⚠️ CASE E — HORS DE LA MATRICE A/B/C/D, NOMMÉE ET COMPTÉE À PART (team-lead, 2026-08-10, deux
// arbitrages successifs). `tempo` → `mm` (parser.js, tête de scène + ses modifiers + `@mode:X
// (tempo:N)`) n'est PAS un contrôle codé en dur par négligence : BPScript nomme `tempo`, BP3/BPx
// lisent ENCORE `mm`, et Romain a tranché le SENS de cette traduction le 2026-08-10 — le nom dans
// l'arbre devient `tempo` PARTOUT, `bp3-frontend` traduira `mm` en entrée. Un premier passage avait
// rendu ce renommage data-driven (`astName` + `universeDirectiveAstAlias()`) ; le geste a été
// DÉFAIT — le mécanisme n'avait de sens QUE si l'alias persistait, et Romain vient précisément de
// le condamner : construire une machinerie de donnée pour porter deux jours un fait qui va
// disparaître, c'était programmer du code mort. Trois comparaisons littérales NOMMÉES, qui
// s'effacent d'un bloc à la bascule de BPx, sont la forme juste — frontière multi-dépôts, son
// propre préavis, portée par l'architecte, hors mandat d'un chantier parseur seul.
//
// La table `EN_ARBITRAGE` ci-dessous NOMME les trois sites, comme `CONNUS` le fait dans
// `test/une_scene_porte_ce_qu_elle_ecrit.mjs:74-77` — et se vérifie dans LES DEUX SENS : la
// littérale doit être là (sinon l'arbitrage a bougé sans que ce garde le sache), et un
// `=== 'tempo'` non nommé doit sortir dans EN_ARBITRAGE ou se traiter en case A.
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
const SOCLE = '@core\n@alphabet.western\n';
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
// CASE E — `tempo` → `mm` : NOMMÉ, PAS COMPTÉ, ARBITRAGE EN COURS (architecte, hors mandat)
// ────────────────────────────────────────────────────────────────────────────
const EN_ARBITRAGE = new Map([
  ['parser.js|tête de scène, directive (d.name==="tempo")',
   { motif: /if\s*\(d\.name === 'tempo'\) d\.name = 'mm';/,
     raison: "réconciliation nominal BPScript (tempo) / historique BP3 (mm, lu par BPx) — sens de la traduction en arbitrage chez Romain, portée par l'architecte" }],
  ['parser.js|tête de scène, modifiers de directive (m.name==="tempo")',
   { motif: /if\s*\(m && m\.name === 'tempo'\) m\.name = 'mm';/,
     raison: "même réconciliation, même bloc — s'applique aux modificateurs d'une directive (`d.modifiers`)" }],
  ['parser.js|modificateurs @mode:X(tempo:N) (rawModName==="tempo")',
   { motif: /rawModName === 'tempo' \? 'mm' : rawModName/,
     raison: "même réconciliation, troisième site — @mode:X(tempo:N) → mm" }],
]);

{
  const parserTxt = readFileSync(path.join(SRC, 'parser.js'), 'utf-8');
  for (const [cle, { motif, raison }] of EN_ARBITRAGE) {
    ok(motif.test(parserTxt),
       `case E '${cle}' (${raison}) : la littérale attendue est INTROUVABLE — soit l'arbitrage a `
       + `abouti (retirer cette ligne d'EN_ARBITRAGE), soit ce motif de recherche est devenu `
       + `obsolète (le code a changé de forme sans que la traduction change de sens) : à `
       + `distinguer avant de conclure.`);
  }
  // Une comparaison `=== 'tempo'` qui ne serait dans AUCUN de ces trois sites nommés serait un
  // QUATRIÈME hardcode de la même famille, ou un vrai contrôle en dur ailleurs — les trois motifs
  // ci-dessus couvrent la totalité des occurrences mesurée le 2026-08-10 (`grep -c "=== 'tempo'"`
  // = 3) ; un compte qui grandit sans entrée neuve dans EN_ARBITRAGE doit être remonté, pas absorbé.
  const occurrences = (parserTxt.match(/===\s*'tempo'/g) || []).length;
  ok(occurrences === EN_ARBITRAGE.size,
     `${occurrences} comparaison(s) littérale(s) à 'tempo' trouvée(s) dans parser.js, `
     + `${EN_ARBITRAGE.size} nommée(s) en case E — un écart signifie un site NON nommé : `
     + `l'ajouter à EN_ARBITRAGE avec sa raison, ou le traiter en case A s'il n'a rien à voir `
     + `avec la réconciliation tempo/mm`);
}

// ────────────────────────────────────────────────────────────────────────────
// 1. ÉNUMÉRATION DE VALEUR — engine.scan.values injecté
// ────────────────────────────────────────────────────────────────────────────
{
  const engineOriginal = LIBS.engine;
  try {
    // TÉMOIN — AVANT injection.
    ok(err('S -> C4 (scan:left)').length === 0, `TÉMOIN — '(scan:left)' doit compiler AVANT injection`);
    ok(err('S -> C4 (scan:nord)').length >= 1, `TÉMOIN — '(scan:nord)' doit être refusé AVANT injection (hors énumération)`);

    // INJECTION — une énumération DIFFÉRENTE, disjointe de l'ancienne. Si le parseur portait
    // encore sa propre copie ({left,right,rnd}), 'nord' resterait refusé ET 'left' resterait
    // accepté malgré l'injection : le garde ne mordrait pas.
    const modifie = clone(engineOriginal);
    modifie.engine.scan.values = ['nord', 'sud'];
    registerLib('engine', modifie);

    ok(err('S -> C4 (scan:nord)').length === 0,
       `INJECTION — '(scan:nord)' doit désormais PASSER (valeur ajoutée par la donnée injectée) ; `
       + `reçu : ${JSON.stringify(err('S -> C4 (scan:nord)'))}`);
    ok(err('S -> C4 (scan:left)').length >= 1,
       `INJECTION — '(scan:left)' doit désormais être REFUSÉ ('left' n'est plus dans l'énumération `
       + `injectée) ; si ça passe encore, le parseur garde sa propre copie de l'ancienne liste`);

    const rNord = ast('S -> C4 (scan:nord)');
    const mode = rNord.ast?.subgrammars?.[0]?.rules?.[0]?.mode;
    ok(mode === 'nord', `INJECTION — 'rule.mode' doit porter la valeur INJECTÉE 'nord' ; reçu '${mode}'`);
  } finally {
    registerLib('engine', engineOriginal);
  }
  ok(err('S -> C4 (scan:left)').length === 0, `RETRAIT — '(scan:left)' repasse après restauration`);
  ok(err('S -> C4 (scan:nord)').length >= 1, `RETRAIT — '(scan:nord)' redevient refusé après restauration`);
}

// ────────────────────────────────────────────────────────────────────────────
// 2. RÉGRESSION — un hardcode retiré (branche dédiée à `@duration`) reste un REFUS, sous le
//    mécanisme générique (aucune librairie ne déclare plus 'duration' — cf. le garde dédié
//    `une_forme_supprimee_ne_revient_pas_par_une_librairie.mjs`, éprouvé sur les 3 graphies).
// ────────────────────────────────────────────────────────────────────────────
{
  ok(err('@duration:16\nS -> C4').length >= 1,
     `'@duration:16' doit rester REFUSÉ ('duration' n'est déclarée par aucune librairie) — `
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
    ok(err(`@${clé}:1\nS -> C4`).length === 0,
       `'@${clé}:1' doit rester ACCEPTÉ — retirer la liste figée ne doit pas retirer le mot`);
  }
}

if (echecs.length) {
  console.error(`❌ un contrôle est routé en dur dans le parseur : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ aucun routage de contrôle codé en dur (hors case E, ${EN_ARBITRAGE.size} nommée(s)) — `
          + `${passe} vérification(s) : énumération (scan), 1 régression, PRODUCTION_DIRECTIVES sortie.`);
