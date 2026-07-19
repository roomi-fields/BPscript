/**
 * bp3_indian — L'ANCRE EST LE CLAVIER OCCIDENTAL RENOMMÉ, pas le sargam traditionnel.
 *
 * POURQUOI CE GARDE EXISTE. `bp3_indian` reproduit la convention de notes INDIAN du moteur BP3
 * natif. Le piège est qu'il RESSEMBLE à l'alphabet `sargam`, qui vit à côté de lui dans le même
 * fichier et porte les mêmes noms de svaras — mais pas la même ancre. BP3 RENOMME le clavier
 * occidental, il ne le TRANSPOSE pas : ses trois conventions (ENGLISH/FRENCH/INDIAN) nomment les
 * MÊMES touches. Ancrer `bp3_indian` sur l'ancre traditionnelle (sa = 240 Hz, celle de `sargam`)
 * est musicalement légitime et infidèle au moteur — un rapport de 0.917, soit un demi-ton et demi
 * d'erreur sur tout le corpus indien.
 *
 * Ce garde n'est pas décoratif : au moment de l'ajout, l'instruction reçue disait « diapason par
 * défaut = ancre traditionnelle du sargam ». La source (`bp3-frontend/src/emit/bp3-alphabets.ts`
 * :18-20) dit l'inverse, et le note explicitement — le 240 du banc Kairos était un choix de TEST.
 * Une ancre qu'on ne mesure pas redevient fausse au premier qui la lit de bonne foi.
 *
 * CE QU'IL PROUVE, EN SORTIE DE CHAÎNE (jamais un calcul maison) :
 *   (A) bp3_indian et western rendent des fréquences IDENTIQUES pour les mêmes touches ;
 *   (B) sargam traditionnel en est bien DISTINCT — les deux alphabets ne sont pas redondants ;
 *   (C) le registre '00' est une octave sous '0' (quirk d'octave BP3, lecture plus-long-d'abord).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compileToBPxAST } = require('../src/transpiler/index.js');
const { createSession } = await import('/home/romi/dev/bp/BPx/dist/index.js');
const { resoudreViaKairos } = await import('./kairos_bridge.mjs');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  OK   ' + msg); } else { fail++; console.log('  FAIL ' + msg); } };

/** Hz de chaque nom, résolus par LE catalogue de la scène — jamais recalculés ici. */
async function hz(entete, noms) {
  const out = compileToBPxAST(`${entete}\ngate S:audio\nS -> ${noms.join(' ')}\n`);
  if (out.errors.length) throw new Error(`${entete} : ${out.errors[0].message}`);
  const { tokens } = await resoudreViaKairos(createSession(out.ast, { seed: 1 }));
  const carte = {};
  for (const t of tokens) if (carte[t.token] === undefined) carte[t.token] = t.hz;
  return carte;
}

// --- (A) BP3 renomme le clavier, il ne le transpose pas -----------------------------------
// dha/A = classe 9, sa/C = classe 0, ga/E = classe 4. Mêmes touches, deux nommages.
const ind = await hz('@alphabet.bp3_indian', ['sa4', 'dha4', 'ga4', 'sa5', 'sa0', 'sa00']);
const occ = await hz('@alphabet.western', ['C4', 'A4', 'E4', 'C5']);

for (const [i, o] of [['sa4', 'C4'], ['dha4', 'A4'], ['ga4', 'E4'], ['sa5', 'C5']]) {
  ok(Number.isFinite(ind[i]) && Math.abs(ind[i] - occ[o]) < 1e-6,
    `bp3_indian ${i} = western ${o} (${Number(ind[i]).toFixed(3)} Hz) — le clavier est RENOMMÉ, pas transposé`);
}
ok(Math.abs(ind.dha4 - 440) < 1e-6, `l'ancre porte sur la classe 9 : dha4 = ${Number(ind.dha4).toFixed(3)} Hz (attendu 440, le diapason natif BP3)`);

// --- (B) Témoin : l'alphabet sargam traditionnel est DISTINCT ------------------------------
// Sans ce témoin, (A) passerait aussi si les deux alphabets avaient fusionné par accident.
const trad = await hz('@alphabet.sargam', ['sa', 'dha']);
ok(Math.abs(trad.sa - 240) < 1e-6, `témoin — sargam traditionnel garde son ancre : sa = ${Number(trad.sa).toFixed(3)} Hz (attendu 240)`);
ok(Math.abs(trad.sa - ind.sa4) > 1,
  `témoin — les deux alphabets NE sont PAS redondants : sargam sa=${Number(trad.sa).toFixed(3)} contre bp3_indian sa4=${Number(ind.sa4).toFixed(3)} (rapport ${(trad.sa / ind.sa4).toFixed(4)})`);

// --- (C) Le quirk d'octave BP3 : '00' est une octave SOUS '0' -------------------------------
// Si la lecture du registre n'était pas plus-long-d'abord, '00' serait lu '0' suivi d'un '0'
// perdu, et sa00 vaudrait sa0. Ce test discrimine exactement ça.
ok(Math.abs(ind.sa00 - ind.sa0 / 2) < 1e-6,
  `quirk d'octave BP3 : sa00 (${Number(ind.sa00).toFixed(3)}) = sa0 (${Number(ind.sa0).toFixed(3)}) / 2 — '00' n'est jamais avalé par '0'`);

console.log(`\n--- bp3_indian, ancre native : ${pass} OK, ${fail} FAIL ---`);
process.exit(fail ? 1 : 0);
