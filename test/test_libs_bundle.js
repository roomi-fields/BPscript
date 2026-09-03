/**
 * Garde-fou : le bundle pré-exporté (libs-data.js) DOIT refléter lib/*.json.
 *
 * Le chargeur (libs.js) auto-enregistre libs-data.js et n'a plus de fallback
 * disque. Si le bundle est périmé (lib/*.json édité sans régénérer), le
 * transpileur utilise des données fausses EN SILENCE — c'est exactement le
 * piège qui a fait diverger settingsJSON sur not-reich/all-items1 (2026-06-14).
 *
 * Ce test reconstruit l'index attendu depuis le disque (récursif, hors
 * tuning.json) et le compare au bundle committé.
 *
 * Run: node test/test_libs_bundle.js
 * Fix en cas d'échec: node src/transpiler/libs-bundle.js > src/transpiler/libs-data.js
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { LIBS } from '../src/transpiler/libs-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_DIR = join(__dirname, '../lib');

// Reconstruit ce que le bundle DEVRAIT contenir (même logique que libs-bundle.js).
const expected = {};
function collect(dir, prefix) {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) { collect(full, prefix + entry + '/'); continue; }
    // ⚠️ DEUX EXTENSIONS DEPUIS LE 2026-08-13, et n'en compter qu'une rendait ce garde AVEUGLE :
    // une librairie s'écrit désormais en BPScript(`lib/audio.bpsl`) aussi bien qu'en JSON. Ne lire
    // que le `.json` faisait sortir « EN TROP dans le bundle : audio » — le garde accusait le
    // bundle d'un excès qui était son propre angle mort.
    if (!entry.endsWith('.json') && !entry.endsWith('.bpsl')) continue;
    const key = prefix + entry.replace(/\.(json|bpsl)$/, '');
    if (key === 'tuning') continue; // 177 Ko, non utilisé par le transpileur
    // Une librairie en BPScript n'est pas du JSON : son CONTENU se vérifie par la régénération
    // (`bundle:check`, qui relance le générateur et compare au commité), pas ici. Ce garde-ci tient
    // la LISTE DES CLÉS — que le bundle porte exactement les librairies présentes sur le disque.
    // ⛔ UN FICHIER DE CORPS N'EST PAS UNE LIBRAIRIE — depuis le 2026-09-03, une librairie DÉCLARE
    //   ses fichiers de corps (`transpo/foobar` en tête) et leur contenu se pose sur ses objets. Ils
    //   ne portent donc AUCUNE clé au bundle, et les attendre en ferait des librairies manquantes.
    //   La déclaration se lit dans la source de la racine, jamais dans le bundle.
    if (prefix) {
      const parent = prefix.replace(/\/$/, '');
      let racine = '';
      try { racine = readFileSync(join(LIB_DIR, `${parent}.bpsl`), 'utf-8'); } catch { /* pas une librairie du langage */ }
      if (new RegExp(`^${key}\\s*$`, 'm').test(racine)) continue;
    }
    if (entry.endsWith('.bpsl')) { expected[key] = null; continue; }
    expected[key] = JSON.parse(readFileSync(full, 'utf-8'));
  }
}
collect(LIB_DIR, '');

// Capture des corps .ts (fonctions digitales/homomorphisme) — MÊME logique que libs-bundle.js
// (captureDigitalBodies) : lib/<name>/<fn>.ts → expected[<name>].objects[<fn>].body. Sans ça, la
// reconstruction disque diverge du bundle sur `digital`/`homomorphism` (qui portent leurs corps captés).
function captureBodies(dir) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    const lib = expected[name];
    if (!lib || !lib.objects) continue;
    for (const entry of readdirSync(full).sort()) {
      if (!entry.endsWith('.ts')) continue;
      const fn = entry.replace('.ts', '');
      if (lib.objects[fn]) lib.objects[fn].body = readFileSync(join(full, entry), 'utf-8');
    }
  }
}
captureBodies(LIB_DIR);

let failed = 0;
const problems = [];

// 1. Chaque fichier disque doit être dans le bundle, à l'identique.
for (const [key, data] of Object.entries(expected)) {
  if (!(key in LIBS)) { problems.push(`MANQUE du bundle : "${key}"`); failed++; continue; }
  if (data === null) continue;   // librairie en BPScript : contenu vérifié par la régénération
  if (JSON.stringify(LIBS[key]) !== JSON.stringify(data)) { problems.push(`PÉRIMÉ : "${key}" diffère du disque`); failed++; }
}
// 2. Pas de clé fantôme dans le bundle (sauf tuning volontairement exclu).
for (const key of Object.keys(LIBS)) {
  if (!(key in expected) && key !== 'tuning') { problems.push(`EN TROP dans le bundle : "${key}"`); failed++; }
}

console.log(`\n=== Bundle libs-data.js vs lib/*.json + lib/*.bps ===`);
console.log(`Clés disque (hors tuning) : ${Object.keys(expected).length} | clés bundle : ${Object.keys(LIBS).length}`);
if (failed === 0) {
  console.log(`Résultat : ${Object.keys(expected).length} PASS, 0 FAIL (bundle à jour)`);
} else {
  for (const p of problems) console.log(`  FAIL: ${p}`);
  console.log(`\nRésultat : ${failed} FAIL — régénère le bundle :`);
  console.log(`  node src/transpiler/libs-bundle.js > src/transpiler/libs-data.js`);
  process.exit(1);
}
