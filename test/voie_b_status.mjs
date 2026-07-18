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
    const r = session.produceAll();
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
