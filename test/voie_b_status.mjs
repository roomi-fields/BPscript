#!/usr/bin/env node
/**
 * VOIE B — statut par grammaire, EN SORTIE DE CHAÎNE COMPLÈTE.
 *
 * Chaîne mesurée : `.bps` → compileBPS → BPx (dérivation) → KAIROS (hauteur) → KRONOS (temps).
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

const require = createRequire(import.meta.url);
const { compare, loadBaseline, soundingText } = require('./compare_modal.cjs');
const { compileBPS } = require('../src/transpiler/index.js');
const { createSession } = await import('/home/romi/dev/bp/BPx/dist/index.js');
const { resoudreViaKairos } = await import('./kairos_bridge.mjs');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GRAMMARS = path.join(ROOT, 'test', 'grammars');

/** Produit la Voie B d'une grammaire, en sortie de chaîne, dans la modalité demandée. */
async function produceB(name, modalite) {
  const bps = path.join(GRAMMARS, name, 'scene.bps');
  if (!existsSync(bps)) return { absent: true };
  let out;
  try {
    out = compileBPS(readFileSync(bps, 'utf-8'));
    if (out.errors.length) return { erreur: `compilation : ${out.errors[0].message}` };
  } catch (e) { return { erreur: `compilation : ${e.message}` }; }
  try {
    const session = createSession(out.ast, { seed: 1 });
    const { tokens } = await resoudreViaKairos(session);
    // La scène déclare-t-elle avoir appliqué le décalage de registre ? Le comparateur
    // n'a le droit de normaliser un NOM que si la voie ATTESTE que le SON est déjà juste
    // (règle [642]) : sans cette attestation, normaliser masquerait un vrai défaut.
    const shiftApplied = (out.ast.directives || []).some((d) => d.name === 'transpose');
    // La capture native ne porte que nom + bornes ; la fréquence résolue sert la chaîne,
    // pas la comparaison — on ne confronte que ce que la référence contient réellement.
    if (modalite === 'MIDI') {
      return { shiftApplied, tokens: tokens.map((t) => ({ token: t.token, start: t.start, end: t.end })) };
    }
    return { shiftApplied, text: soundingText(tokens.map((t) => ({ type: 'terminal', token: t.token }))) };
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
const ENUMERATION_SANS_FIN = new Set(['dhadhatite_v2', 'dhati2', 'flags']);

/**
 * Produit la Voie B en ÉNUMÉRATION (action `produce-all`). Forme de sortie calquée sur la
 * capture native : un item par ligne, terminaux séparés par un espace.
 *
 * Un REFUS du moteur (`refused`) n'est pas un échec : le natif AVORTE lui aussi l'énumération
 * sur certaines sous-grammaires (SUB/SUB1/POSLONG, `ProduceItems.c:770`) et retombe sur le jeu
 * simple. On réplique ce repli plutôt que de le traiter en erreur.
 */
function produceAllB(name) {
  const bps = path.join(GRAMMARS, name, 'scene.bps');
  if (!existsSync(bps)) return { absent: true };
  let out;
  try {
    out = compileBPS(readFileSync(bps, 'utf-8'));
    if (out.errors.length) return { erreur: `compilation : ${out.errors[0].message}` };
  } catch (e) { return { erreur: `compilation : ${e.message}` }; }
  try {
    const session = createSession(out.ast, { seed: 1 });
    // PLAFOND — passe EXPLICITEMENT depuis la directive de MA scene. BPx ne reprend pas encore
    // `[@maxitems:N]` : ni `session.grammar.directives.maxItems` ni `instance.getStatus().maxItems`
    // ne la voient (mesuré : les deux restent absents et l'énumération file jusqu'à 100000, au
    // point que 4 grammaires ne rendent jamais la main). La scène reste la source de vérité —
    // je lis SA directive, je ne relis pas le `-se` natif : la Voie B doit rester autosuffisante.
    // Contournement à retirer dès que BPx honore la directive.
    const capDir = (out.ast.directives || []).find((d) => d.name === 'maxitems');
    const cap = capDir && Number(capDir.value) > 0 ? Number(capDir.value) : undefined;
    // GARDE-FOU quand la scène n'a AUCUN plafond : sans lui, 3 grammaires (dhadhatite_v2,
    // dhati2, flags) ne rendent jamais la main — leur natif, réglage MaxItemsProduce=0, n'énumère
    // pourtant qu'UN item. On borne largement (100× ce que le natif énumère) et, si la borne mord,
    // on refuse de conclure : comparer une énumération tronquée contre une énumération complète
    // serait un faux verdict. Le non-arrêt lui-même est un défaut moteur, remonté à bpx.
    // 10× ce que le natif énumère : assez large pour qu'une divergence de CARDINALITÉ reste
    // visible (on verrait un 2×, un 5×), assez serré pour que la borne se paie en secondes.
    const garde = cap || Math.max(50, 10 * (byName[name].items_enumeres || 20));
    if (ENUMERATION_SANS_FIN.has(name)) {
      return { nonMesurable: "l'énumération ne termine pas — le plafond borne le RÉSULTAT, pas la "
        + "RECHERCHE (mesuré : maxItems:2 ne rend pas la main non plus). Défaut moteur remonté à bpx, "
        + 'pas un écart de transcription' };
    }
    const r = session.produceAll({ maxItems: garde });
    // REFUS : le natif avorte lui aussi l'énumération sur SUB/SUB1/POSLONG et JOUE au lieu
    // d'énumérer. On réplique ce repli — le traiter en erreur inventerait un échec que le
    // natif n'a pas. (Bug de mon premier câblage : je documentais le repli sans le coder.)
    if (r.refused) return { replie: r.refusedReason || 'raison non déclarée' };
    return { text: r.items.map((i) => (i.terminals || []).join(' ')).join('\n'), tronque: !!r.truncated };
  } catch (e) { return { erreur: `énumération : ${e.message}` }; }
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const only = args.filter((a) => !a.startsWith('--'));

const { byName } = loadBaseline();
const withBps = readdirSync(GRAMMARS)
  .filter((d) => existsSync(path.join(GRAMMARS, d, 'scene.bps')))
  .filter((d) => byName[d])
  // DOUBLONS (champ doublon_de, baseline v8) : exports HTML dont les regles sont
  // IDENTIQUES a une grammaire deja presente. Les mesurer creerait un DOUBLE COMPTE contre
  // la meme reference — leur auteur a explicitement demande de les ecarter du denominateur.
  .filter((d) => !byName[d].doublon_de)
  .filter((d) => only.length === 0 || only.includes(d))
  .sort();

const rows = [];
for (const name of withBps) {
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
