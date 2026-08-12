#!/usr/bin/env node
/**
 * VOIE B — statut par grammaire, EN SORTIE DE CHAÎNE COMPLÈTE.
 *
 * Chaîne mesurée : `.bps` → compileToBPxAST → BPx (dérivation) → KAIROS (hauteur) → KRONOS (temps).
 *
 * ⚠️ CE HARNAIS APPELAIT `compileBPS` — la façade HÉRITÉE, « vouée au retrait »
 * (`ARCHITECTURE.md:168-169`). Il ne mesurait pas le texte BP3 pour autant : il passait déjà
 * `out.ast` à BPx. Mais cet arbre-là N'EST PAS le canonique — mesuré sur `bells`,
 * `compileToBPxAST().ast` fait 16939 octets avec `actors: []`, quand `compileToBPxAST().ast` en fait
 * 18870 et SYNTHÉTISE l'acteur par défaut avec son transport (les défauts d'environnement).
 * On mesurait donc le produit à travers une façade en retrait, sur un arbre moins complet.
 *
 * Bascule faite APRÈS mesure, jamais avant : les deux façades ont été comparées sur TOUT le
 * corpus, jeton par jeton, bornes et hauteurs comprises — 87 identiques, 0 divergente. Le
 * compte ISO obtenu avant la bascule reste donc valide ; seul le tuyau était le mauvais.
 *
 * ⚠️ CE FICHIER MESURAIT AUTREFOIS EN SORTIE BPx (`session.emit('timed-tokens')`), ce qui est
 * PRÉ-RÉSOLUTION : ni la hauteur ni le temps n'y sont résolus. Recadrage Romain (note [651]) :
 * on ne mesure ni ne classe rien avant Kairos et Kronos. Les comptes publiés avant ce
 * rebranchement étaient donc ininterprétables — ils imputaient au langage des écarts qui
 * n'étaient que « la chaîne n'est pas branchée ».
 *
 * RÉPLIQUER LA MÊME ACTION QUE LE NATIF (baseline v5, champ `action`) :
 *   - `single`      → le moteur JOUE un morceau : UNE réalisation, graine 1. C'est mesurable ici.
 *   - `produce-all` → production purement SYMBOLIQUE : le moteur ÉNUMÈRE des chaînes, il ne joue
 *                     pas. Répliqué par `session.produceAll()` (BPx bb4e622) : un item par ligne,
 *                     terminaux séparés par des espaces — la forme exacte des captures natives.
 *                     Un REFUS du moteur (sous-grammaire SUB/SUB1/POSLONG, ProduceItems.c:770)
 *                     n'est pas une panne mais une information : on retombe alors sur le jeu
 *                     simple, comme le natif.
 *
 * Ce fichier ne compare RIEN lui-même : il produit et délègue à `compare_modal.cjs`, juge unique
 * des deux voies.
 *
 * Usage :  node test/voie_b_status.mjs [--json] [grammaire…]
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { DIR_BPS, bpsPath, nomsBps, exigerCorpus } from './corpus.mjs';
import { empreinteVoisins, exigerVoisinsStables, direEmpreinte } from './empreinte_voisins.mjs';

const require = createRequire(import.meta.url);
const { compare, loadBaseline, soundingOnly, printedText } = require('./compare_modal.cjs');
const { compileToBPxAST } = require('../src/transpiler/index.js');
const { createSession, renderChain } = await import('/home/romi/dev/bp/BPx/dist/index.js');
const { rendreChaineFinale } = await import('/home/romi/dev/bp/kairos/dist/index.js');
const { resoudreViaKairos } = await import('./kairos_bridge.mjs');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GRAMMARS = DIR_BPS;  // corpus emprunté à la bibliothèque Kanopi (test/corpus.mjs)

/** Produit la Voie B d'une grammaire, en sortie de chaîne, dans la modalité demandée. */
async function produceB(name, modalite) {
  const bps = bpsPath(name);
  if (!existsSync(bps)) return { absent: true };
  let out;
  try {
    out = compileToBPxAST(readFileSync(bps, 'utf-8'));
    if (out.errors.length) return { erreur: `compilation : ${out.errors[0].message}` };
  } catch (e) { return { erreur: `compilation : ${e.message}` }; }
  try {
    const session = createSession(out.ast, { seed: 1 });
    const { tokens, tousLesJetons, typeIndisponible, avantOrigine } = await resoudreViaKairos(session);
    // UNE MESURE TRONQUÉE NE REND PAS DE VERDICT SUR L'AXE SONNANT.
    //
    // Kronos fait partir sa tête de lecture de l'origine ; une scène translatée d'un décalage
    // d'origine a des événements AVANT zéro, qui ne sont jamais ordonnancés. Les bornes de l'axe
    // sonnant venant de lui, il en manque — et un ISO obtenu sur une production amputée est un
    // vert qui ment. L'axe TEXTE, lui, reste mesurable : il compare des noms, et le flux complet
    // les porte tous (seules leurs bornes manquent). Où repart la tête est un arbitrage en cours
    // chez Romain ; d'ici là on le DIT, on ne le devine pas.
    if (avantOrigine && modalite === 'MIDI') return { nonMesurable: `mesure tronquée — ${avantOrigine}` };
    // ⚠️ LE TYPE VIENT DU PONT, IL NE SE POSE PAS ICI. Ce harnais écrivait `type: 'terminal'` sur
    // chaque jeton avant de les tendre au filtre partagé : le filtre exigeait bien un type, mais
    // celui qu'il lisait était celui que je venais d'inventer, donc son critère était neutralisé.
    // Conséquence mesurée : les marqueurs de bloc que BPx type `control` entraient dans la
    // comparaison et faisaient diverger `bells`, `kss2` et `templates` AU RANG 0.
    if (typeIndisponible) return { nonMesurable: `type déclaré non reportable — ${typeIndisponible}` };
    // La scène déclare-t-elle avoir appliqué le décalage de registre ? Le comparateur
    // n'a le droit de normaliser un NOM que si la voie ATTESTE que le SON est déjà juste
    // (règle [642]) : sans cette attestation, normaliser masquerait un vrai défaut.
    const shiftApplied = (out.ast.directives || []).some((d) => d.name === 'transpose');
    // La capture native ne porte que nom + bornes ; la fréquence résolue sert la chaîne,
    // pas la comparaison — on ne confronte que ce que la référence contient réellement.
    // ⚠️ ON COMPARE LE NOM RÉSOLU (`nomResolu`), PAS LE TERMINAL ÉCRIT (arbitrage archi [907]).
    // Les captures natives portent des noms RÉSOLUS : une scène qui écrit `E2` puis demande
    // `chromashift:12` sonne — et le natif nomme — `E3`. Comparer le littéral de la scène imputait
    // un écart d'octave à une hauteur JUSTE. Le pont expose les deux ; ici, et ici seulement, on
    // prend le résolu. Repli sur l'écrit quand il n'y a pas de hauteur (percussion : le nu EST le nom).
    const nom = (t) => t.nomResolu ?? t.token;
    const comparable = (t) => ({ type: t.type, token: nom(t), start: t.start, end: t.end });
    // AXE SONNANT pour la modalité MIDI, AXE TEXTE pour la modalité TEXTE — les deux périmètres
    // vivent chez le juge partagé, et chacun se prend sur le TYPE DÉCLARÉ que le pont reporte.
    // L'axe texte se sert du flux COMPLET : Kronos ordonnance ce qui s'exécute et retire les
    // silences, or c'est précisément ce que le natif imprime.
    if (modalite === 'MIDI') {
      return { shiftApplied, tokens: soundingOnly(tokens.map(comparable)) };
    }
    return { shiftApplied, text: printedText(tousLesJetons.map(comparable)) };
  } catch (e) { return { erreur: `chaîne : ${e.message}` }; }
}

/**
 * QUARANTAINE — grammaires dont `produceAll()` ne rend JAMAIS la main.
 *
 * Ce n'est pas une question de volume : mesuré, `produceAll({maxItems:2})` ne termine pas non
 * plus sur `dhati2`. Le plafond borne le RÉSULTAT, pas la RECHERCHE — une grammaire dont
 * l'espace d'énumération ne converge pas boucle quel que soit le cap. Leur natif, lui, n'énumère
 * qu'UN item (réglage MaxItemsProduce=0).
 *
 * Elles sont donc déclarées NON-MESURABLES, pas comparées : un verdict tiré d'une énumération
 * qui n'aboutit pas n'aurait aucun sens. Liste à VIDER dès que bpx corrige — ce n'est pas une
 * exclusion de principe, c'est une panne moteur mise de côté pour que le reste du corpus se mesure.
 */
const ENUMERATION_SANS_FIN = new Set(['dhadhatite_v2', 'dhati2', 'flags', 'dhati3', 'dhin']);
// `dhin` ajoutée le 2026-07-19, dès qu'elle est devenue productible (baseline v11). Même
// protocole que `dhati3`, deux observations concordantes : le balayage s'arrête net à
// `[27/87] dhin` et n'en repart pas ; et `produceAll()` sur cette seule grammaire ne rend pas
// la main en 115 s, machine libre. Son natif, lui, énumère 20 items.
// `dhati3` a été ajoutée le 2026-07-19, et c'est elle qui BLOQUAIT le recompte complet.
// Deux observations indépendantes, une fois la progression rendue visible : le balayage
// s'arrête net à `[25/86] dhati3` et n'en repart pas ; et `produceAll()` sur cette seule
// grammaire dépasse 120 s sans rendre la main ni imprimer un item.
// Ça explique rétrospectivement les deux exécutions de la nuit qui ont brûlé 10 h de
// processeur pour zéro octet : elles n'étaient pas LENTES, elles étaient BLOQUÉES ici.

/**
 * Produit la Voie B en ÉNUMÉRATION (action `produce-all`). Forme de sortie calquée sur la
 * capture native : un item par ligne, terminaux séparés par un espace.
 *
 * Un REFUS du moteur (`refused`) n'est pas un échec : le natif AVORTE lui aussi l'énumération
 * sur certaines sous-grammaires (SUB/SUB1/POSLONG, `ProduceItems.c:770`) et retombe sur le jeu
 * simple. On réplique ce repli plutôt que de le traiter en erreur.
 */
function produceAllB(name) {
  const bps = bpsPath(name);
  if (!existsSync(bps)) return { absent: true };
  let out;
  try {
    out = compileToBPxAST(readFileSync(bps, 'utf-8'));
    if (out.errors.length) return { erreur: `compilation : ${out.errors[0].message}` };
  } catch (e) { return { erreur: `compilation : ${e.message}` }; }
  try {
    if (ENUMERATION_SANS_FIN.has(name)) {
      return { nonMesurable: "l'énumération ne termine pas — le plafond borne le RÉSULTAT, pas la "
        + 'RECHERCHE (mesuré : maxItems:2 ne rend pas la main non plus). Défaut moteur remonté à bpx, '
        + 'pas un écart de transcription' };
    }
    const session = createSession(out.ast, { seed: 1 });
    // Le PLAFOND vient de la directive `@maxitems:N` de la scène, et BPx l'honore désormais
    // seul (fix bpx af30c16, vérifié : tryflags2/tryLIN → 25, dhin1 → 20 sans option explicite).
    // Le contournement qui lisait la directive à la main est retiré.
    const r = session.produceAll();
    // REFUS : le natif avorte lui aussi l'énumération sur SUB/SUB1/POSLONG et JOUE au lieu
    // d'énumérer. On réplique ce repli — le traiter en erreur inventerait un échec que le
    // natif n'a pas. (Bug de mon premier câblage : je documentais le repli sans le coder.)
    if (r.refused) return { replie: r.refusedReason || 'raison non déclarée' };
    // LA STRUCTURE SE REND PAR LA RÈGLE PUBLIÉE, ET IL FAUT LUI DONNER `chainIds`.
    //
    // Je recollais `terminals` avec une espace : une suite PLATE, où la polymétrie, l'imbrication
    // et les virgules de simultaneité disparaissaient. J'en avais conclu — et écrit — que le
    // moteur ne savait pas rendre la structure sur ce chemin. C'était faux, et bp3-frontend l'a
    // réfuté mesure à l'appui : j'appelais le rendu sur `item.ids`. Rejoué sur le même item,
    // `ids` rend `a b a c` quand `chainIds` rend `a{- b,a c}`. Le rendu existait ; c'est mon
    // producteur qui ne l'employait pas.
    //
    // Repli HONNÊTE et jamais silencieux : si le rendu échoue sur un item, on retombe sur la
    // suite plate pour CET item et on le dit — une chaîne inventée serait pire que l'aveu.
    // ⚠️ L'ORDRE N'EST PAS LIBRE, ET JE L'AI PAYÉ. Le résolveur de noms vit dans le contexte de
    // projection, que BPx refuse de rendre avant une dérivation. J'avais donc appelé `derive()`
    // AVANT `produceAll()` — et la dérivation CONSOMME du tirage : sur une grammaire à choix,
    // l'énumération changeait. Mesuré : `tryflags2` passait d'identique à divergente sans qu'une
    // ligne de la scène ait bougé. On énumère d'abord, on dérive ensuite : les items sont déjà en
    // main, et le résolveur ne lit que la table de symboles de la grammaire — il ne dépend pas du
    // tirage. Une dérivation qui échoue ne coûte que le rendu structuré, jamais l'énumération.
    let resoudreNom;
    try { session.derive(); resoudreNom = session.buildProjectionContext('chronological').resolveName; }
    catch (e) {
      process.stderr.write(`[rendu] ${name} — pas de résolveur de noms (${e.message}) : suite plate\n`);
      return { text: r.items.map((i) => (i.terminals || []).join(' ')).join('\n'), tronque: !!r.truncated };
    }
    const echecs = [];
    const lignes = r.items.map((it, rang) => {
      try {
        return rendreChaineFinale(it.chainIds, it.chainMarkers, resoudreNom, renderChain);
      } catch (e) { echecs.push(`item ${rang} : ${e.message}`); return (it.terminals || []).join(' '); }
    });
    if (echecs.length) process.stderr.write(`[rendu] ${name} — ${echecs.length} item(s) rendus à plat : ${echecs[0]}\n`);
    return { text: lignes.join('\n'), tronque: !!r.truncated };
  } catch (e) { return { erreur: `énumération : ${e.message}` }; }
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const only = args.filter((a) => !a.startsWith('--'));

const { byName } = loadBaseline();
exigerCorpus();
const withBps = nomsBps()
  .filter(() => true)
  .filter((d) => byName[d])
  // DOUBLONS (champ doublon_de, baseline v8) : exports HTML dont les regles sont
  // IDENTIQUES a une grammaire deja presente. Les mesurer creerait un DOUBLE COMPTE contre
  // la meme reference — leur auteur a explicitement demande de les ecarter du denominateur.
  .filter((d) => !byName[d].doublon_de)
  .filter((d) => only.length === 0 || only.includes(d))
  .sort();

// ⚠️ LA CHAÎNE MESURÉE VIT CHEZ TROIS VOISINS, DONT DEUX NE VERSIONNENT PAS LEUR BUILD.
// On relève leur empreinte AVANT le balayage et on la revérifie APRÈS : une campagne à cheval sur
// une reconstruction rend un effondrement qui n'existe pas (mesuré le 2026-08-12 : 66 « ne produit
// pas » sur 87, dont 60 dus à `kairos/dist/index.js` disparu en cours de route).
const _empreinteAvant = empreinteVoisins();
process.stderr.write(`[chaine] ${direEmpreinte(_empreinteAvant).replace(/\n {2}/g, '\n[chaine] ')}\n`);

const rows = [];
// PROGRESSION SUR LA SORTIE D ERREUR — pas cosmétique.
// Cet outil n'imprimait qu'à la toute fin : une exécution de vingt minutes était
// indiscernable d'une exécution BLOQUÉE, et j'ai laissé tourner deux fois des recomptes
// qui ne rendaient jamais la main (10 h de processeur, zéro octet). Un harnais dont on ne
// peut pas dire s'il avance est un harnais qui cache ses propres pannes. La ligne part sur
// stderr pour ne jamais polluer le `--json` de stdout.
let _rang = 0;
for (const name of withBps) {
  process.stderr.write(`[${++_rang}/${withBps.length}] ${name}\n`);
  const ref = byName[name];
  let b = ref.produit && ref.action === 'produce-all'
    ? produceAllB(name)
    : await produceB(name, ref.modalite);
  // Énumération refusée par le moteur → on joue, comme le natif.
  if (b && b.replie) b = await produceB(name, ref.modalite);
  if (b && b.nonMesurable) { rows.push({ grammaire: name, modalite: ref.modalite ?? '—', status: 'NON-MESURABLE', detail: b.nonMesurable }); continue; }
  let res;
  if (b.absent) res = { status: 'ABSENT', detail: 'pas de scene.bps' };
  else if (b.erreur) res = { status: 'NE PRODUIT PAS', modalite: ref.modalite, detail: b.erreur };
  else res = compare(name, b);
  rows.push({ grammaire: name, modalite: ref.modalite ?? '—', ...res });
}

// Le verdict ne sort QU'APRÈS avoir prouvé que la chaîne n'a pas bougé sous la mesure.
const _empreinteApres = exigerVoisinsStables(_empreinteAvant);

if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const tally = {};
  for (const r of rows) tally[r.status] = (tally[r.status] || 0) + 1;
  console.log(`Voie B — ${rows.length} grammaires avec .bps, EN SORTIE DE CHAÎNE (BPx → Kairos → Kronos)\n`);
  for (const r of rows) {
    const d = r.detail ? `  ${String(r.detail).slice(0, 70)}` : '';
    console.log(`  ${r.grammaire.padEnd(22)} ${String(r.modalite).padEnd(6)} ${r.status.padEnd(15)}${d}`);
  }
  console.log('\nBilan :');
  for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(16)} ${n}`);
  }
}
