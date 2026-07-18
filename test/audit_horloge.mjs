#!/usr/bin/env node
/**
 * AUDIT D'HORLOGE — quelles scènes `.bps` ne déclarent pas l'horloge de leur natif ?
 *
 * POURQUOI. `bells` sortait DIFF avec toutes ses durées au facteur 2.5. J'avais attribué l'écart
 * au `CorrectionFactor` omis chez BPx — À TORT. Cause réelle : le natif tourne avec `-se.cloches`
 * (Pclock=2, Qclock=5 → période 2/5 s = 400 ms), ma scène ne déclarait aucun tempo, BPx tombait
 * sur son défaut 60 BPM (1000 ms), et 1000/400 = 2.5 exactement. Transcription incomplète, pas
 * bug moteur. Déclarer `@tempo:150` a suffi : bells est passée ISO.
 *
 * Le modèle l'exige : **la Voie B est autosuffisante**. L'horloge du natif doit vivre DANS la
 * scène (`@tempo`/`@mm`), jamais dépendre d'un `-se` BP3 qu'on ne lit pas.
 *
 * CE QUE L'AUDIT FAIT. Pour chaque grammaire ayant une `.bps`, il lit le `-se.*` que la baseline
 * lui associe, en extrait les réglages qui MORDENT SUR LE TEMPS, et regarde si la scène déclare
 * l'équivalent. Il ne corrige rien : il liste, pour que le reclassement se fasse sur pièces.
 *
 * Usage :  node test/audit_horloge.mjs [--tous]     (--tous = inclut les scènes conformes)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { loadBaseline } = require('./compare_modal.cjs');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GRAMMARS = path.join(ROOT, 'test', 'grammars');
const TESTDATA = path.resolve(ROOT, '..', 'bp3-engine', 'test-data');

/** Réglages du `-se` qui changent le TEMPS. Les autres (MIDI, affichage…) ne nous concernent pas ici. */
function reglagesTemps(nomSe) {
  const p = path.join(TESTDATA, nomSe);
  if (!existsSync(p)) return { absent: true };
  const brut = readFileSync(p, 'utf-8');
  if (!brut.trimStart().startsWith('{')) return { legacy: true }; // format BP2 positionnel
  let j; try { j = JSON.parse(brut); } catch { return { illisible: true }; }
  const v = (k) => (j[k] && j[k].value !== undefined ? Number(j[k].value) : undefined);
  const P = v('Pclock'), Q = v('Qclock');
  const out = {};
  // Période du métronome = Pclock/Qclock secondes ⇒ BPM = 60·Qclock/Pclock.
  if (Number.isFinite(P) && Number.isFinite(Q) && P > 0 && Q > 0) {
    out.periodeMs = (P / Q) * 1000;
    out.bpm = 60 * Q / P;
  }
  const quant = v('Quantization');
  if (Number.isFinite(quant)) out.quantization = quant;
  return out;
}

/** Ce que la scène DÉCLARE côté horloge. */
function declareParLaScene(nom) {
  const p = path.join(GRAMMARS, nom, 'scene.bps');
  if (!existsSync(p)) return null;
  const src = readFileSync(p, 'utf-8');
  const lire = (mot) => {
    const m = src.match(new RegExp(`^@${mot}\\s*:\\s*([0-9./]+)`, 'm'));
    return m ? m[1] : undefined;
  };
  return { tempo: lire('tempo'), mm: lire('mm'), quantization: lire('quantization'), qclock: lire('qclock') };
}

const tous = process.argv.includes('--tous');
const { byName } = loadBaseline();
const noms = readdirSync(GRAMMARS)
  .filter((d) => existsSync(path.join(GRAMMARS, d, 'scene.bps')))
  .filter((d) => byName[d])
  .sort();

const manquants = [], conformes = [], illisibles = [];
for (const nom of noms) {
  const se = byName[nom].config && byName[nom].config['-se'];
  if (!se) continue;                       // pas de réglages natifs : rien à transcrire
  const r = reglagesTemps(se);
  if (r.absent || r.illisible) { illisibles.push({ nom, se, pourquoi: r.absent ? 'fichier absent' : 'JSON illisible' }); continue; }
  if (r.legacy) { illisibles.push({ nom, se, pourquoi: 'format BP2 positionnel (non lu ici)' }); continue; }
  if (r.bpm === undefined && r.quantization === undefined) continue;

  const d = declareParLaScene(nom);
  const horlogeDeclaree = d && (d.tempo || d.mm || d.qclock);
  // Le défaut BPx est 60 BPM : un natif à 60 n'a rien à déclarer, ce n'est pas un manque.
  const besoinHorloge = r.bpm !== undefined && Math.abs(r.bpm - 60) > 0.01;

  if (besoinHorloge && !horlogeDeclaree) {
    manquants.push({ nom, se, bpm: r.bpm, periodeMs: r.periodeMs, facteurAttendu: 1000 / r.periodeMs });
  } else {
    conformes.push({ nom, se, bpm: r.bpm, declare: horlogeDeclaree || '(défaut 60 conforme)' });
  }
}

console.log(`AUDIT D'HORLOGE — ${noms.length} scènes .bps confrontées à leur -se natif\n`);
console.log(`HORLOGE NATIVE NON DÉCLARÉE — ${manquants.length} scène(s) :`);
for (const m of manquants) {
  console.log(`  ${m.nom.padEnd(22)} ${String(m.se).padEnd(20)} natif ${m.bpm.toFixed(2)} BPM `
    + `(${m.periodeMs.toFixed(0)} ms) → durées attendues au facteur ×${m.facteurAttendu.toFixed(2)}`);
}
if (illisibles.length) {
  console.log(`\nRÉGLAGES NON LUS — ${illisibles.length} (à instruire séparément) :`);
  for (const i of illisibles) console.log(`  ${i.nom.padEnd(22)} ${String(i.se).padEnd(20)} ${i.pourquoi}`);
}
if (tous) {
  console.log(`\nCONFORMES — ${conformes.length} :`);
  for (const c of conformes) console.log(`  ${c.nom.padEnd(22)} natif ${c.bpm === undefined ? '—' : c.bpm.toFixed(2)} BPM, scène : ${c.declare}`);
} else {
  console.log(`\nCONFORMES : ${conformes.length} (--tous pour les lister)`);
}
