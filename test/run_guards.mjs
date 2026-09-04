#!/usr/bin/env node
/**
 * LE PORTILLON — lance TOUS les gardes du dépôt et échoue si l'un mord.
 *
 * POURQUOI CE FICHIER EXISTE. Jusqu'au 2026-07-19, le portillon ne lançait que DEUX
 * fichiers de test sur 41. Les 39 autres n'étaient exécutés par rien : ils étaient verts
 * par chance, et quinze avaient déjà pourri sans témoin — dont un qui PLANTAIT en cours de
 * route et annulait silencieusement 166 assertions. Un garde qu'on ne lance pas ne garde
 * rien ; il donne seulement l'impression d'être couvert.
 *
 * CE QUI EST LANCÉ ICI, et pourquoi ce découpage :
 *   - les GARDES : ils assertent et sortent en code non nul quand ils échouent, sans rien
 *     exiger de l'extérieur. Tout ce qui est dans ce lot DOIT rester vert.
 *   - les OUTILS À SEUIL : ils impriment un rapport et sortent TOUJOURS en zéro. Les lancer
 *     tels quels n'aurait aucun effet — ce sont des figurants. On leur donne donc un SEUIL
 *     mesurable et c'est nous qui échouons si le seuil n'est pas tenu.
 *
 * CE QUI N'EST PAS LANCÉ ICI, explicitement :
 *   - `test_wasm_all.js` et `run_bpx_scenes.cjs` — ils exigent le moteur CONSTRUIT (`--bin`).
 *     Lane séparée : le portillon doit pouvoir tourner sur un clone frais, sans build.
 *   - `compare_modal.cjs`, `kairos_bridge.mjs`, `resolve_bin.cjs` — des modules importés,
 *     jamais lancés ; ils sont couverts par ceux qui les utilisent.
 *   - `voie_b_status.mjs` — mesure de conformité à la baseline native, plusieurs minutes,
 *     et son verdict est un CONSTAT à lire (20 ISO / 54 DIFF), pas une régression. Le mettre
 *     au portillon rendrait le gate rouge en permanence pour un état connu.
 *
 * Usage :  node test/run_guards.mjs [--verbose]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const verbeux = process.argv.includes('--verbose');

import { LANE_MOTEUR, MODULES, MOI, SEUILS, HORS_PORTILLON } from './gate_classification.mjs';

const fichiers = readdirSync(ICI)
  .filter((f) => /\.(js|cjs|mjs)$/.test(f))
  .filter((f) => f !== MOI && !MODULES.has(f) && !LANE_MOTEUR.has(f) && !HORS_PORTILLON.has(f))
  .filter((f) => !SEUILS.some((s) => s.fichier === f))
  .sort();

let echecs = 0;
let passes = 0;
let assertions = 0;
let sansCompte = 0;

/**
 * COMPTE D'ASSERTIONS RÉELLEMENT EXÉCUTÉES — pas le nombre de fichiers verts.
 *
 * Un fichier qui PLANTE en cours de route compte pour UN échec alors qu'il annule des
 * centaines d'assertions : `test_v08_parser` en rapportait 4 et en cachait 166. Compter les
 * fichiers sous-estime donc structurellement ce qu'on ne surveille pas. On totalise ce qui
 * s'est réellement exécuté, et on dit combien de fichiers n'annoncent PAS leur compte —
 * parce qu'un total qui ignore ses trous serait le même mensonge en plus discret.
 */
const compterAssertions = (sortie) => {
  for (const re of [/(\d+)\s+passed/i, /Passé\s*:\s*(\d+)/i, /(\d+)\s+PASS\b/, /Results?:\s*(\d+)/i, /(\d+)\s+vérification\(s\) passée\(s\)/i, /Résultat[^:]*:\s*(\d+)\s+OK/i]) {
    const m = sortie.match(re);
    if (m) return Number(m[1]);
  }
  const n = (sortie.match(/^\s*(?:ok|OK|PASS|✓)\b/gm) || []).length;
  return n > 0 ? n : null;
};

// ⛔ CE QU'UN GARDE VERT DIT DE SON RÉGIME DOIT SORTIR DU PORTILLON. La sortie d'un garde qui passe
// n'est JAMAIS réimprimée ici — seuls les échecs voient leur détail. Une déclaration de régime y
// mourait donc en silence : mesuré le 2026-08-30, la mention sortait quand le garde était lancé
// SEUL et ZÉRO fois dans la sortie du portillon, sur trois passages.
//
// ⇒ C'est « un garde hors du portillon est invisible » PRIS PAR L'AUTRE BOUT : il est DEDANS, et
// c'est sa SORTIE qui est jetée. Décision du 2026-08-19 — un verdict porte le régime sous lequel il
// est pris — branchée et muette. Trouvé par bp3-frontend chez lui (419 verdicts sur 424), relayé
// par l'architecte, et vérifié ici plutôt que supposé.
//
// ⚠️ LE CANAL EST UN PRÉFIXE DÉCLARÉ, jamais un motif sur un mot : un garde qui veut faire remonter
// son régime préfixe sa ligne de `[régime]`. Chercher le mot « régime » dans la sortie ramasserait
// des phrases de commentaire et manquerait une ligne qui le dirait autrement.
const PREFIXE_REGIME = '[régime]';
let mentionsDeRegime = 0;

// ⛔ LE NOM DE CHAQUE GARDE VERT, PAS SEULEMENT LEUR NOMBRE. Un compte ne distingue pas « un garde
// est parti » de « un garde est parti et un autre est arrivé » — les deux rendent le même nombre.
// La liste, elle, nomme le disparu. Voir la comparaison en fin de fichier.
const verts = [];

for (const f of fichiers) {
  const r = spawnSync('node', [path.join(ICI, f)], { encoding: 'utf-8', timeout: 300000 });
  const n = compterAssertions((r.stdout || '') + (r.stderr || ''));
  if (n === null) sansCompte++; else assertions += n;
  for (const ligne of ((r.stdout || '') + (r.stderr || '')).split('\n')) {
    if (!ligne.startsWith(PREFIXE_REGIME)) continue;
    mentionsDeRegime++;
    console.log(`  ${ligne.trim()}`);
  }
  if (r.status === 0) {
    passes++;
    verts.push(f);
    if (verbeux) console.log(`  ok   ${f}${n === null ? '' : `  (${n} assertions)`}`);
  } else {
    echecs++;
    console.error(`  ÉCHEC ${f}  (code ${r.status})`);
    const detail = ((r.stdout || '') + (r.stderr || '')).split('\n').filter((l) => /FAIL|Error|✗/.test(l)).slice(0, 3);
    for (const d of detail) console.error(`         ${d.trim().slice(0, 140)}`);
  }
}

for (const s of SEUILS) {
  const r = spawnSync('node', [path.join(ICI, s.fichier)], { encoding: 'utf-8', timeout: 900000 });
  const n = s.mesure((r.stdout || '') + (r.stderr || ''));
  if (n >= s.plancher) {
    passes++;
    verts.push(`${s.fichier} [seuil]`);
    if (verbeux) console.log(`  ok   ${s.fichier} — ${n} ${s.unite} (plancher ${s.plancher})`);
  } else {
    echecs++;
    console.error(`  ÉCHEC ${s.fichier} — ${n} ${s.unite}, plancher ${s.plancher} (${s.quoi})`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-VACUITÉ — tout garde d'ENSEMBLE doit prouver qu'il regarde quelque chose.
//
// Un garde qui balaie un ensemble et le trouve vide passe au vert sans rien vérifier.
// C'est l'erreur exacte que j'ai commise dans la première version du méta-garde : elle
// cherchait des orphelins dans un ensemble qui ne pouvait pas en contenir, et elle
// verdissait toujours. Un contrôle vide est indiscernable d'un contrôle satisfait.
// On exige donc un TÉMOIN POSITIF : chaque garde d'ensemble déclare le nombre minimal
// d'éléments qu'il doit voir. S'il en voit moins, c'est qu'il ne regarde plus au bon
// endroit — et c'est LUI qui est cassé, pas le dépôt qui est devenu parfait.
{
  const temoins = [
    { quoi: 'gardes lancés par le portillon', vu: fichiers.length, minimum: 35 },
    // Le témoin des outils à seuil est tombé à ZÉRO le 2026-07-19 : les deux qui y vivaient
    // gardaient l'émission BP3, supprimée avec elle. Un minimum de 0 serait un témoin creux —
    // on le retire donc plutôt que de le laisser passer au vert sans rien vérifier. Il
    // reviendra le jour où un outil à seuil existera de nouveau.
    // plancher 8 depuis le 2026-07-19 (lane moteur videe, cf. gate_classification.mjs)
    { quoi: 'exclusions motivées', vu: LANE_MOTEUR.size + MODULES.size + HORS_PORTILLON.size, minimum: 8 },
    // ⛔ ET LE PORTILLON DOIT DIRE SOUS QUEL RÉGIME IL JUGE. Réimprimer les lignes `[régime]` ne
    // suffit pas : un jour où plus aucun garde n'en émet, la sortie redeviendrait muette et rien
    // ne rougirait — j'aurais remplacé un silence par une promesse. Ce témoin refuse ce zéro.
    // ⚠️ Il est posé APRÈS la boucle qui compte, donc il mesure ce qui est RÉELLEMENT SORTI, pas
    // ce qu'un garde prétend émettre.
    { quoi: 'mentions de régime remontées', vu: mentionsDeRegime, minimum: 1 },
  ];
  const creux = temoins.filter((t) => t.vu < t.minimum);
  if (creux.length > 0) {
    echecs++;
    for (const t of creux) {
      console.error(`  ÉCHEC anti-vacuité — ${t.quoi} : ${t.vu} vu(s), minimum attendu ${t.minimum}.`);
      console.error('         Un garde qui ne voit plus rien ne prouve rien : vérifiez qu il regarde au bon endroit.');
    }
  } else {
    passes++;
    verts.push('anti-vacuité [interne]');
    if (verbeux) console.log(`  ok   anti-vacuité — ${temoins.map((t) => `${t.vu} ${t.quoi}`).join(', ')}`);
  }
}

console.log(`\n[gardes] ${passes} garde(s) vert(s), ${echecs} en échec.`);
console.log(`[gardes] ${assertions} assertion(s) RÉELLEMENT exécutée(s)`
  + (sansCompte ? ` — ${sansCompte} fichier(s) n'annoncent pas leur compte, non totalisés.` : '.'));

// ⛔ CE COMPTE ÉTAIT AFFICHÉ ET COMPARÉ À RIEN — « refuser zéro n'est pas refuser une baisse ».
//
// ⚠️ MESURÉ PAR INJECTION RÉELLE, le 2026-08-25 : en retirant UNE entrée d'une librairie
// (`expression.offvel`), le portillon est passé de **10074 assertions à 9413** — **661 de moins** —
// et **211 gardes sur 213 sont restés VERTS**. Deux seulement ont vu le retrait, dont un posé le
// jour même parce qu'il compare à une RÉFÉRENCE ENREGISTRÉE.
//
// ⇒ **La forme qui voit une baisse est la référence, pas le seuil.** Un garde qui refuse zéro
// protège d'une assiette illisible ; seul un nombre ÉCRIT protège d'un retrait — et l'écrire une
// fois pour 213 gardes coûte moins que de le poser dans chacun.
//
// ⇒ La référence ne monte JAMAIS toute seule : `--maj` est un geste explicite, et le diff le montre.
// Une hausse est annoncée sans mordre — ajouter un garde est légitime ; c'est la BAISSE qui se refuse.
// ⛔ ET LE COMPTE DE GARDES ÉTAIT ÉCRIT SANS ÊTRE JAMAIS RELU — le même défaut d'un cran plus haut.
// La référence portait `"gardes": 236` depuis qu'elle existe, et aucune ligne ne le comparait : un
// garde renommé, déplacé hors du portillon ou supprimé sortait des DEUX ensembles comparés et ne
// laissait aucune trace. Ses assertions manquaient, mais une hausse ailleurs les compense — et une
// hausse « ne mord pas ».
//
// ⇒ **La forme qui voit un garde partir est la LISTE, pas le nombre.** Un compte ne distingue pas
// « il en manque un » de « il en manque un et un autre est arrivé » : les deux rendent 236. La liste
// nomme le disparu, ce qui est précisément ce qu'un compte ne peut pas faire.
const REFERENCE = new URL('./assertions-du-portillon.json', import.meta.url);
verts.sort();
if (process.argv.includes('--maj')) {
  writeFileSync(REFERENCE, `${JSON.stringify({ assertions, gardes: verts }, null, 1)}\n`);
  console.log(`[gardes] référence mise à jour — ${assertions} assertion(s), ${verts.length} garde(s).`);
} else if (existsSync(REFERENCE)) {
  const ref = JSON.parse(readFileSync(REFERENCE, 'utf8'));
  if (!Array.isArray(ref.gardes)) {
    echecs++;
    console.error("  ÉCHEC — la référence ne porte pas la LISTE de ses gardes, seulement un compte :");
    console.error('         node test/run_guards.mjs --maj');
  } else {
    const ici = new Set(verts);
    const partis = ref.gardes.filter((g) => !ici.has(g));
    const neufs = verts.filter((g) => !ref.gardes.includes(g));
    if (partis.length > 0) {
      echecs++;
      console.error(`  ÉCHEC ⛔ ${partis.length} GARDE(S) ONT DISPARU DU PORTILLON :`);
      for (const g of partis) console.error(`         · ${g}`);
      console.error('         Renommé, déplacé hors du portillon, supprimé, ou en échec : un garde absent '
        + 'ne préviendra jamais.');
      console.error('         Vérifier CE QUI A DISPARU, puis, si le retrait est voulu : '
        + 'node test/run_guards.mjs --maj');
    }
    if (neufs.length > 0) {
      console.log(`[gardes] +${neufs.length} garde(s) depuis la référence — une hausse ne mord pas. `
        + "'--maj' pour la fixer.");
    }
  }
  if (assertions < ref.assertions) {
    echecs++;
    console.error(`  ÉCHEC ⛔ LE PORTILLON A PERDU ${ref.assertions - assertions} ASSERTION(S) — `
      + `${ref.assertions} attendues, ${assertions} exécutées.`);
    console.error(`         Aucun garde n'a rougi : ils refusent tous ZÉRO, aucun ne refuse une BAISSE. `
      + `Une entrée retirée d'une librairie en emporte des centaines sans un mot.`);
    console.error(`         Vérifier CE QUI A DISPARU, puis, si le retrait est voulu : `
      + `node test/run_guards.mjs --maj`);
  } else if (assertions > ref.assertions) {
    console.log(`[gardes] +${assertions - ref.assertions} assertion(s) depuis la référence — `
      + `une hausse ne mord pas. '--maj' pour la fixer.`);
  }
} else {
  console.error(`  ÉCHEC — la référence d'assertions est absente : node test/run_guards.mjs --maj`);
  echecs++;
}
if (echecs === 0) {
  console.log(`[gardes] lane séparée : ${LANE_MOTEUR.size} test(s) exigeant un binaire construit.`);
}
process.exit(echecs ? 1 : 0);
