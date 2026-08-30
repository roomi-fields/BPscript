#!/usr/bin/env node
/**
 * DUMP VOIE B — texte+trace d'UNE grammaire, pour le comparateur 3-chaînes (natif / A / B).
 *
 * POURQUOI CE FICHIER EXISTE (demande architecte [903]). `voie_b_status.mjs` ne SORT que des
 * jetons RÉSOLUS pour le compte ISO. La décision Romain du 2026-07-25 — comparer les productions
 * TEXTE grammaire par grammaire, et sur écart décortiquer règle par règle — demande un autre
 * artefact : pour UNE grammaire, la chaîne d'items en graphie moteur ET la trace de dérivation
 * pas-à-pas, en fichier, à graine posée. C'est ce que produit ce script. Le comparateur (hub)
 * l'invoque tel quel ; le JSON ci-dessous est le contrat.
 *
 * CE QU'IL FAIT :  `.bps` → compileToBPxAST → createSession({seed, trace:true}) → derive →
 * Kairos REND (chaîne d'items + trace), et écrit UN JSON sur STDOUT.
 *
 * ⚠️ JE N'ÉCRIS AUCUNE GRAPHIE. La chaîne et chaque pas sont rendus par la règle PUBLIÉE :
 * `renderChain` (BPx, `trace/surface.ts`) pour l'assemblage, `rendreChaineFinale` /
 * `chargerTraceSeule`+`traceCourante` (Kairos, `trace/vue-trace.ts`) pour la résolution des noms
 * et des contrôles. Deux graphies seraient exactement la divergence que ce lot combat.
 *
 * POURQUOI `chargerTraceSeule` ET PAS `charger` : un dump texte+trace est un « dépôt d'un compagnon
 * de LECTURE » (kairos.ts:231) — il ne joue rien, ne résout ni hauteur ni temps. `chargerTraceSeule`
 * est exactement cette porte : elle ne touche ni l'arbre ni la vue à plat et n'appelle PAS `projeter`.
 * Un refus de projection (fail-loud L26 sur un domaine de hauteur) n'a donc aucune raison d'avaler
 * la trace de DÉRIVATION, qui est pré-résolution. Le résolveur de noms vient de
 * `buildProjectionContext().resolveName`, qui ne lit que la table de symboles de la grammaire et
 * fonctionne donc AVANT comme APRÈS une dérivation refusée (session.ts:1988).
 *
 * CONTRAT DE ROBUSTESSE (demande [903]) : STDOUT = le JSON SEUL, tout log sur STDERR ; jamais un
 * crash, jamais un JSON invalide. Une grammaire qui échoue (compilation KO, dérivation KO) rend un
 * JSON avec `erreur` renseignée et `trace` partielle si BPx l'a attachée (`error.derivationTrace`).
 *
 * ADDITIF : ne touche ni `voie_b_status.mjs` ni le chemin de mesure ISO — il n'importe que le
 * corpus partagé (`corpus.mjs`).
 *
 * Usage :  node test/dump-voie-b.mjs <grammaire> [--graine 42]
 */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { bpsPath } from './corpus.mjs';
import { importerArtefact } from './artefact_voisin.mjs';

const require = createRequire(import.meta.url);
const { compileToBPxAST } = require('../src/transpiler/index.js');
const { createSession, renderChain } = await importerArtefact('BPx');
const { Kairos, rendreChaineFinale } = await importerArtefact('kairos');

/** Journal STDERR — jamais STDOUT (réservé au JSON, contrat [903]). */
const journal = (msg) => process.stderr.write(`${msg}\n`);

/**
 * Émet le JSON de sortie UNE fois, sur STDOUT, et rend la main. Champs manquants comblés par leurs
 * défauts neutres — le contrat garantit une forme stable même en cas d'échec.
 *
 * UNE SEULE LIGNE (pas d'indentation) : un JSON UNIQUE compact, plus sûr à travers un pipe.
 *
 * ⚠️ NE JAMAIS `process.exit()` APRÈS avoir écrit ici. `process.stdout` est ASYNCHRONE sur un PIPE :
 * `process.exit()` termine le processus AVANT le vidage du tampon et coupe la sortie net à 64 Ko
 * (bug [905] : 20 grosses traces tronquées pile à 65536 octets). Le code de sortie passe donc par
 * `process.exitCode` et le script se termine NATURELLEMENT — node draine alors stdout avant de rendre
 * la main. Aucun `process.exit()` dans ce fichier.
 */
function emettre({ grammaire, graine, chaineItems = null, trace = [], annonces = [], erreur = null }) {
  process.stdout.write(
    JSON.stringify({ grammaire, graine, voie: 'B', chaineItems, trace, annonces, erreur }) + '\n',
  );
}

/**
 * Résout la poignée de trace Kairos en deux tableaux (pas résolus, annonces résolues). Les
 * abonnements rejouent SYNCHRONEMENT tout le journal déjà collecté — on accumule et on rend.
 */
function recolterTrace(poignee) {
  if (poignee === null) return { trace: [], annonces: [] };
  const trace = [];
  const annonces = [];
  poignee.onStep((pas) => trace.push(pas));
  poignee.onAnnonce((a) => annonces.push(a));
  return { trace, annonces };
}

/**
 * Corps du dump : rend le CODE DE SORTIE plutôt que d'appeler `process.exit()`. Le code est ensuite
 * posé sur `process.exitCode` et le script se termine NATURELLEMENT — c'est ce qui laisse node vider
 * stdout à travers un pipe (fix [905], voir `emettre`).
 */
function principal() {
  const args = process.argv.slice(2);
  const positionnels = args.filter((a) => !a.startsWith('--'));
  const grammaire = positionnels[0];
  // Graine EXPLICITE, défaut 42 (celle du natif) — le garde de mesure BPx exige une graine posée sur
  // toute session de mesure, et ce dump en est une.
  const iGraine = args.indexOf('--graine');
  const graine = iGraine >= 0 && args[iGraine + 1] !== undefined ? Number(args[iGraine + 1]) : 42;

  if (grammaire === undefined) {
    journal('usage : node test/dump-voie-b.mjs <grammaire> [--graine 42]');
    emettre({ grammaire: null, graine, erreur: 'grammaire manquante en argument' });
    return 2;
  }
  if (!Number.isFinite(graine)) {
    emettre({ grammaire, graine: null, erreur: `graine invalide : ${args[iGraine + 1]}` });
    return 2;
  }

  try {
    const bps = bpsPath(grammaire);
    if (!existsSync(bps)) {
      emettre({ grammaire, graine, erreur: `pas de .bps pour '${grammaire}' dans le corpus` });
      return 0;
    }

    // 1. COMPILATION — un échec sort en `erreur`, sans trace (rien n'a encore dérivé).
    let out;
    try {
      out = compileToBPxAST(readFileSync(bps, 'utf-8'));
    } catch (e) {
      emettre({ grammaire, graine, erreur: `compilation : ${e.message}` });
      return 0;
    }
    if (out.errors.length) {
      emettre({ grammaire, graine, erreur: `compilation : ${out.errors[0].message}` });
      return 0;
    }

    // 2. SESSION à graine posée, trace ACTIVÉE. Le résolveur de noms ne dépend que de la table de
    //    symboles — construit dès maintenant, il servira même si la dérivation refuse.
    const session = createSession(out.ast, { seed: graine, trace: true });
    const resoudreNom = session.buildProjectionContext().resolveName;
    const kairos = new Kairos();

    // 3. DÉRIVATION. Sur refus, BPx attache la trace collectée à l'erreur (`derivationTrace`) : on la
    //    remet à Kairos par `chargerTraceSeule` pour rendre une trace PARTIELLE lisible, et on sort
    //    en `erreur` avec `chaineItems: null` (aucune chaîne finale n'existe).
    let deriveResult;
    try {
      deriveResult = session.derive();
    } catch (e) {
      const entrees = e.derivationTrace;
      let trace = [];
      let annonces = [];
      if (entrees !== undefined) {
        kairos.chargerTraceSeule({ entrees, rendreChaine: renderChain, resoudreNom, grammaire });
        ({ trace, annonces } = recolterTrace(kairos.traceCourante()));
      }
      emettre({ grammaire, graine, chaineItems: null, trace, annonces, erreur: `dérivation : ${e.message}` });
      return 0;
    }

    // 4. CHAÎNE D'ITEMS en graphie moteur — la règle publiée `renderChain`, via `rendreChaineFinale`
    //    (Kairos), sur `ids` + `chainMarkers` du résultat. Dégradation honnête : un échec de rendu
    //    pose `null`, jamais une chaîne inventée.
    let chaineItems = null;
    try {
      chaineItems = rendreChaineFinale(deriveResult.ids, deriveResult.chainMarkers, resoudreNom, renderChain);
    } catch (e) {
      journal(`chaîne d'items : ${e.message}`);
      chaineItems = null;
    }

    // 5. TRACE de dérivation — même compagnon de lecture, résolu par Kairos.
    kairos.chargerTraceSeule({
      entrees: deriveResult.trace ?? [],
      rendreChaine: renderChain,
      resoudreNom,
      grammaire,
    });
    const { trace, annonces } = recolterTrace(kairos.traceCourante());

    emettre({ grammaire, graine, chaineItems, trace, annonces, erreur: null });
    return 0;
  } catch (e) {
    // Filet ultime : aucune exception ne doit sortir en crash — toujours un JSON valide.
    journal(`inattendu : ${e && e.stack ? e.stack : e}`);
    emettre({ grammaire, graine, erreur: `inattendu : ${e && e.message ? e.message : String(e)}` });
    return 1;
  }
}

// Pose le code de sortie SANS forcer la terminaison : le script finit naturellement et node draine
// stdout (fix [905]). Aucun `process.exit()` dans ce fichier.
process.exitCode = principal();
