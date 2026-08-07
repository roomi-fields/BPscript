#!/usr/bin/env node
/**
 * UNE SCÈNE NE DÉCLARE QU'UN ALPHABET — l'acteur implicite est UNIQUE.
 *
 * ⚠️ RÈGLE DE ROMAIN, 2026-08-07, mot pour mot : « on ne déclare pas plusieurs acteurs implicites,
 * un seul ; sinon c'est explicite. » Combinée à « un alphabet par acteur » (même jour) : deux
 * vocabulaires — a fortiori liés à deux sorties — demandent deux acteurs, et deux acteurs se
 * DÉCLARENT.
 *
 * ⚠️ CE FICHIER A PORTÉ LA RÈGLE INVERSE PENDANT UNE HEURE, ET C'EST LA LEÇON. La bible écrit
 * (§« Déclarer un symbole ») `@alphabet.sargam:audio` puis `@alphabet.tabla:osc`. J'en avais
 * conclu que plusieurs alphabets de scène devaient être en portée, et j'avais écrit un garde qui
 * l'exigeait. Romain a tranché l'inverse : cette forme demande des acteurs explicites. **La bible
 * est en avance sur le code, elle n'est pas pour autant la source de toute déduction** — ce qu'un
 * exemple laisse INFÉRER n'est pas ce qu'il spécifie, et la structure se décide, elle ne se déduit
 * pas d'un exemple.
 *
 * ⚠️ CE QUE LE REFUS REMPLACE, ET C'ÉTAIT PIRE. Avant lui, le second `@alphabet` était IGNORÉ en
 * silence : le calcul des terminaux lisait le premier et jetait les autres. Une ligne entière ne
 * servait à rien et rien ne le disait. Un refus se voit ; un abandon muet, jamais.
 *
 * MESURÉ AVANT DE LIVRER : zéro scène du corpus (274) déclare plus d'un `@alphabet`. Ce fail-loud
 * n'invalide aucune écriture vivante — c'est ce qui autorise à le poser sans préavis de rupture.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { toutesLesScenes } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compiler = (src) => {
  try { return compileToBPxAST(src); } catch (e) { return { errors: [{ message: e.message }] }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message || e).join(' | ');

// ── A. LE SECOND ALPHABET DE SCÈNE EST REFUSÉ, ET LE REFUS DONNE LA RÉÉCRITURE ────────────────
const DOIVENT_REFUSER = [
  ['deux alphabets avec leurs sorties (la forme de la bible)',
   '@core\n@alphabet.sargam:audio\n@alphabet.tabla:osc\nS -> sa dhin\n'],
  ['deux alphabets sans sortie',
   '@core\n@alphabet.sargam\n@alphabet.tabla\nS -> sa dhin\n'],
  ['trois alphabets',
   '@core\n@alphabet.sargam\n@alphabet.tabla\n@alphabet.western\nS -> sa dhin C4\n'],
];
for (const [quoi, src] of DOIVENT_REFUSER) {
  const msg = messages(compiler(src));
  ok(/ne déclare qu'UN alphabet/.test(msg),
     `A. ${quoi} — doit être REFUSÉ (reçu : ${msg.slice(0, 90) || 'aucune erreur'}). Un second `
     + `alphabet ACCEPTÉ serait ignoré en silence, ce qui est pire qu'un refus.`);
  ok(/@actor/.test(msg),
     `A. ${quoi} — le refus doit donner la RÉÉCRITURE ('@actor'), pas seulement constater. Un mot `
     + `refusé sans son remplacement laisse l'auteur sans issue.`);
}

// ── B. CE QUI DOIT PASSER — sans quoi le refus aurait débordé ─────────────────────────────────
// ⚠️ La moitié qui démasque : une règle qui refuserait TOUTE scène passerait le volet A entier.
const DOIVENT_PASSER = [
  ['un seul alphabet — le cas ordinaire',
   '@core\n@alphabet.sargam\nS -> sa re\n'],
  ['un alphabet avec sa sortie',
   '@core\n@alphabet.sargam:audio\nS -> sa re\n'],
  ['LA VOIE EXPLICITE — deux vocabulaires, deux acteurs déclarés, deux sorties',
   '@core\n@actor v1\n  alphabet.sargam\n  out.audio\n@actor v2\n  alphabet.tabla\n  out.osc\n'
   + 'S -> v1.sa v2.dhin\n'],
  ['aucun alphabet — la scène hérite du socle',
   '@core\nS -> C4 D4\n'],
];
for (const [quoi, src] of DOIVENT_PASSER) {
  const msg = messages(compiler(src));
  ok(msg === '', `B. ${quoi} — REFUSÉ à tort : ${msg.replace(/\s+/g, ' ').slice(0, 100)}`);
}

// ── C. LE CORPUS — le fail-loud n'invalide aucune écriture vivante ────────────────────────────
// ⚠️ Un fail-loud de langage est une action de FRONTIÈRE : huit dépôts lisent cette source. Ce
// volet REMESURE à chaque portillon ce qui a autorisé à le poser — si une scène venait à écrire
// deux alphabets, ce garde le dirait AVANT que son auteur le découvre à son propre portillon.
let multi = 0;
const coupables = [];
for (const [nom, src] of toutesLesScenes()) {
  const n = src.split('\n').filter((l) => /^\s*@alphabet[.:]/.test(l)).length;
  if (n > 1) { multi++; coupables.push(nom); }
}
ok(multi === 0,
   `C. ${multi} scène(s) du corpus déclarent plus d'un '@alphabet' et sont donc REFUSÉES par ce `
   + `fail-loud : ${coupables.slice(0, 4).join(', ')}. Les migrer vers '@actor' AVANT de garder `
   + `ce refus — on ne laisse pas un consommateur le découvrir à son portillon.`);

if (echecs.length) {
  console.error(`❌ l'alphabet de scène : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ une scène ne déclare qu'un alphabet, l'acteur implicite est unique — ${passe} `
          + `vérification(s) : ${DOIVENT_REFUSER.length} formes refusées avec leur réécriture, `
          + `${DOIVENT_PASSER.length} formes lues dont la voie explicite, et zéro scène du corpus `
          + `invalidée.`);
