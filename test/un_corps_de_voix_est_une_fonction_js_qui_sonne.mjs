#!/usr/bin/env node
/**
 * UN CORPS DE VOIX EST UNE FONCTION JAVASCRIPT SIMPLE, ET IL SONNE.
 *
 * Décision de Romain, 2026-08-30 — `un-corps-de-voix-est-une-fonction-js-simple-et-les-types-de-
 * ports-sortent.md` : « je veux que ça soit remplacé par des fonctions js simples qui produisent du
 * son sans chercher à faire d'imbrication de couches/fonctions, je ne veux pas que ça reproduise du
 * patching en js, juste que ça produise du son proche de ce qui est attendu ».
 *
 * ⛔ POURQUOI COMPTER LES CORPS NE SUFFIT PAS, et c'est tout l'objet de ce garde. Le mode d'échec
 *    n'est pas le refus, c'est le SILENCE : un corps qui EST une fonction, qui compile, et qui rend
 *    zéro ou `NaN` a EXACTEMENT la même empreinte qu'un corps juste pour qui vérifie seulement que
 *    la donnée est là. Éprouvé sur la donnée réelle : `(t) => 0 * Math.sin(2*Math.PI*320*t)` mis à
 *    la place de `dayan_ring` passe toute vérification de présence et de forme.
 *    ⇒ On EXERCE donc chaque corps sur toute sa durée et on mesure son ÉNERGIE.
 *
 * ⚠️ LA FORME D'AVANT, ELLE, EST REFUSÉE DÈS LA COMPILATION — mesuré, et j'avais écrit l'inverse.
 *    `saw(pitch) >> lpf(cutoff) >> adsr(gate)` ne devient jamais une fonction : le corps est une
 *    EXPRESSION évaluée immédiatement, donc `saw is not defined` tombe à la construction, pas à
 *    l'appel. Et `adsr(decay:60ms)` est une erreur de syntaxe. Le § 2 la refuse néanmoins par sa
 *    graphie : `>>` reste un opérateur JavaScript valide, et un corps qui en porterait un DANS une
 *    fonction — `(t) => t >> 1` — compilerait et sonnerait. C'est ce cas-là que la graphie tient.
 *
 * ⛔⛔ ET CE GARDE A LUI-MÊME CAUSÉ UN DÉFAUT DE LA DONNÉE — c'est pour cela que le § 3 existe.
 *    Sa première écriture exigeait que les quinze sonnent AVEC et SANS hauteur gravée. Les deux
 *    voix pitchées ne peuvent pas sonner sans hauteur — j'y ai répondu par un repli DANS LA DONNÉE,
 *    `env.pitch||110`, au lieu de corriger l'exigence. **La voix inventait alors une hauteur que
 *    personne n'avait demandée** : mesuré chez runtime-audio, `wobble` rendait 7.52e-2 sans hauteur
 *    gravée là où la forme d'avant se taisait, et là où sa page des voix publie « pas de hauteur
 *    inventée ». C'est la forme la plus discrète du repli : ajuster la donnée à ce que l'instrument
 *    accepte. ⇒ L'exigence est maintenant CONDITIONNELLE au fait que la voix lise la hauteur.
 *
 * ⚠️ CE GARDE NE TOUCHE PAS AU DÉPÔT DU VOISIN. La porte qui accueille ces corps vit chez
 *    runtime-audio ; l'appeler d'ici prouverait SA porte, jamais MA donnée. On reproduit donc la
 *    convention d'accueil — `(t, dur, env) => échantillon`, `env.pitch` en Hz, non fini ramené à
 *    zéro — et on garde ce qui est à moi : que chacune des quinze valeurs publiées soit une
 *    fonction qui produit le son attendu.
 */
import { LIBS } from '../src/transpiler/libs-data.js';

// ⛔ LA CONVENTION DE MESURE SE NOMME, SANS QUOI LE NIVEAU NE VEUT RIEN DIRE. Un rms ne se compare
//    qu'à convention égale : la même voix rend 0.2164 sur une fenêtre de 0,24 s et 0.1108 sur une
//    fenêtre de 1,00 s — la queue de silence divise l'énergie. **Le niveau n'est pas une propriété
//    du son, c'est une propriété de la fenêtre.** Relevé par runtime-audio le 2026-08-30, quand mes
//    chiffres et les siens différaient d'un facteur deux et ressemblaient à une perte chez lui.
//    ⇒ CONVENTION DE CE GARDE : fenêtre de 1,00 s, 8000 échantillons par seconde, rms sur la
//      fenêtre ENTIÈRE — queue de silence comprise. Toute comparaison à un chiffre venu d'ailleurs
//      exige que l'autre convention soit dite.
const SR = 8000;        // suffisant pour l'énergie ; le garde doit rester rapide
const DUR = 1.0;        // la FENÊTRE, pas la durée du son — une percussion s'éteint bien avant
const RMS_MIN = 0.01;   // sous ce seuil, la voix est inaudible SUR CETTE FENÊTRE

let passees = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passees++; else echecs.push(quoi); };

/** Compile un corps comme le fait la porte : le préfixe `js:` et les backticks sont optionnels. */
function compiler(brut) {
  const inner = String(brut).trim().replace(/^`/, '').replace(/`$/, '').trim();
  const m = inner.match(/^([a-z]+):/i);
  const type = m ? m[1].toLowerCase() : 'js';
  const corps = (m ? inner.slice(m[0].length) : inner).trim();
  if (type !== 'js') return { type, fn: null };
  try { return { type, fn: new Function(`return (${corps});`)() }; }
  catch (e) { return { type, fn: null, erreur: e.message }; }
}

/** REND le corps sur toute sa durée, comme la porte : tout non-fini devient zéro. */
function rendre(fn, env) {
  const out = new Float64Array(Math.floor(SR * DUR));
  let leve = null;
  for (let i = 0; i < out.length; i++) {
    let s;
    try { s = fn(i / SR, DUR, env); } catch (e) { leve = leve || e.message; s = NaN; }
    out[i] = Number.isFinite(s) ? s : 0;
  }
  return { buffer: out, leve };
}
const rms = (b) => { let s = 0; for (const v of b) s += v * v; return Math.sqrt(s / b.length); };
const pic = (b) => { let p = 0; for (const v of b) if (Math.abs(v) > p) p = Math.abs(v); return p; };

/** Le corps lit-il la hauteur ? `Math.random` est figé — sans quoi un bruit se lit comme un pitch. */
function litLaHauteur(fn) {
  const vrai = Math.random;
  Math.random = () => 0.5;
  try {
    for (let i = 0; i < 500; i++) {
      const t = i / SR;
      try { if (fn(t, DUR, { pitch: 220 }) !== fn(t, DUR, { pitch: 440 })) return true; }
      catch { return false; }
    }
    return false;
  } finally { Math.random = vrai; }
}

/** La batterie complète, appliquée à un corps. Rendue réutilisable pour les injections. */
function verdict(brut) {
  const { type, fn } = compiler(brut);
  if (type !== 'js') return { motif: `réalisation non-js (${type}:)` };
  if (typeof fn !== 'function') return { motif: 'ne compile pas en fonction' };

  const avec = rendre(fn, { pitch: 220 });
  const sans = rendre(fn, {});
  if (avec.leve) return { motif: `lève à l'appel : ${avec.leve}` };
  const rA = rms(avec.buffer), rS = rms(sans.buffer);
  if (rA <= RMS_MIN) return { motif: `MUET avec hauteur gravée — rms ${rA.toFixed(5)}` };
  if (pic(avec.buffer) > 1.5) return { motif: `écrête — pic ${pic(avec.buffer).toFixed(2)}` };

  const pitchee = litLaHauteur(fn);
  // ⛔ AUCUNE VOIX N'INVENTE DE HAUTEUR — une pitchée sans hauteur gravée se TAIT.
  if (pitchee && rS > RMS_MIN) {
    return { motif: `INVENTE une hauteur — sonne à rms ${rS.toFixed(5)} sans hauteur gravée` };
  }
  // Une percussion ignore la hauteur : elle doit sonner dans les deux cas.
  if (!pitchee && rS <= RMS_MIN) {
    return { motif: `percussive et MUETTE sans hauteur — rms ${rS.toFixed(5)}` };
  }

  // ⛔ DÉTERMINISME — `Math.random()` rend deux ondes différentes pour la même note. Inoffensif
  // à l'oreille, fatal à qui compare deux rendus échantillon par échantillon. Relevé par
  // runtime-audio sur trois corps le 2026-08-30 ; le bruit s'écrit en fonction du temps.
  const bis = rendre(fn, { pitch: 220 }).buffer;
  let ecarts = 0;
  for (let i = 0; i < avec.buffer.length; i++) if (avec.buffer[i] !== bis[i]) ecarts++;
  if (ecarts) return { motif: `TIRE AU SORT — ${ecarts} échantillon(s) diffèrent entre deux rendus` };

  return { motif: null, rms: rA, pitchee };
}

// ── 1. LA MATRICE : toutes les voix publiées, aucune exception ─────────────────────────────────
const voix = LIBS.voices?.objects;
ok(voix && typeof voix === 'object', 'A. le catalogue des voix est publié');
const noms = Object.keys(voix || {});

// ⛔ UN GARDE COMPTE CE QU'IL A EXAMINÉ ET REFUSE D'AVOIR EXAMINÉ ZÉRO. Un catalogue vide et un
//    catalogue mort ont la même empreinte : sans ce refus, tout ce qui suit serait vert sur rien.
ok(noms.length > 0, `B. le catalogue n'est pas vide — ${noms.length} voix`);

let pitchees = 0;
for (const nom of noms) {
  const brut = voix[nom]?.audio;
  ok(typeof brut === 'string' && brut.length > 0, `C.${nom} porte un corps \`audio\``);
  if (typeof brut !== 'string') continue;
  const v = verdict(brut);
  ok(v.motif === null, `D.${nom} est une fonction js qui sonne${v.motif ? ` — ${v.motif}` : ''}`);
  if (v.pitchee) pitchees++;
}

// ── 2. CE QUI SE REFUSE EST UNE SPÉCIFICITÉ BPSCRIPT, JAMAIS UN OPÉRATEUR JAVASCRIPT ──────────
//
// ⛔ CE GARDE A PORTÉ UN REFUS DE `>>` PAR LA GRAPHIE, ET IL ÉTAIT FAUX PAR CONSTRUCTION.
//    Décision de Romain, 2026-08-30 : « si c'est du js pur que ça n'utilise rien d'autre que
//    l'interpréteur js de notre archi pas de soucis » — rendue sur `||`, et le raisonnement est le
//    même pour `>>`. ⇒ Mesuré : `(t) => (t*220 >> 0) / 220` compile, rend 0.5, ne porte AUCUNE
//    spécificité BPScript — et l'ancien motif le refusait. **Un décalage binaire est du JavaScript.**
//
// ⇒ CE QUI RESTE, ET POURQUOI CHACUN TIENT :
//   · l'argument nommé à UNITÉ — `decay:350ms` — n'est PAS du JavaScript : c'est une graphie de
//     BPScript, et c'est exactement ce que la décision écarte. Le motif exige l'unité collée,
//     donc il ne peut refuser que de l'invalide.
//   · `Math.random` se refuse pour son EFFET, pas pour sa graphie : deux rendus de la même note
//     diffèrent. La comparaison de deux rendus le prouve déjà dans `verdict`, mais un corps qui ne
//     tire au sort qu'une fois sur mille la passerait — le motif ferme cette porte-là.
//
// ⚠️ LA FORME D'AVANT N'A DONC PLUS DE GARDE DE GRAPHIE, ET ELLE N'EN A PAS BESOIN :
//    `saw(pitch) >> lpf(cutoff) >> adsr(gate)` est refusée DÈS LA COMPILATION — mesuré — parce que
//    `saw` n'existe pas. Le § 1 la couvre entièrement.
for (const nom of noms) {
  const brut = String(voix[nom]?.audio ?? '');
  ok(!/\b[a-z_][a-z0-9_]*\s*:\s*[\d.]+(ms|s|hz)\b/i.test(brut),
    `E.${nom} n'a pas d'argument nommé à unité (\`decay:350ms\`) — c'est une graphie BPScript, `
    + `pas du JavaScript`);
  ok(!/Math\s*\.\s*random/.test(brut), `F.${nom} n'appelle pas \`Math.random\` — le bruit est une `
    + `fonction du temps, sinon deux rendus de la même note diffèrent`);
}

// ── 3. LA HAUTEUR : DEUX VOIX LA LISENT, TREIZE L'IGNORENT, AUCUNE NE L'INVENTE ────────────────
// Ce compte est ce qui distingue une voix mélodique d'une percussion : le perdre rendrait les
// quinze interchangeables sans qu'aucune assertion ne bouge.
ok(pitchees === 2, `H. exactement 2 voix lisent la hauteur — mesuré ${pitchees}`);
ok(verdict(voix.wobble?.audio ?? '').pitchee === true, 'I. `wobble` lit la hauteur');
ok(verdict(voix.fatbass?.audio ?? '').pitchee === true, 'J. `fatbass` lit la hauteur');
ok(verdict(voix.dayan_open?.audio ?? '').pitchee === false, 'K. `dayan_open` est percussive');

// ── 4. LE GARDE MORD — prouvé sur la graphie que le code écrit, jamais sur celle qu'on croit ───
// Chaque faute est fabriquée puis passée au MÊME juge que la donnée réelle.
const injections = [
  ['la forme d\'AVANT, refusée dès la compilation', '`js: saw(pitch) >> lpf(cutoff) >> adsr(gate)`'],
  ['une fonction qui LÈVE à l\'appel — elle, compile', '`js: (t) => saw(t)`'],
  ['un corps muet', '`js: (t) => 0`'],
  ['un corps qui rend NaN', '`js: (t) => Math.sqrt(-1)`'],
  ['un corps qui n\'est pas une fonction', '`js: 0.5`'],
  ['une réalisation non-js', '`faust: process = os.osc(440);`'],
  ['un corps qui n\'ouvre pas', '`js: (t => (((`'],
  ['une voix qui INVENTE une hauteur', '`js: (t, dur, env) => Math.sin(2*Math.PI*(env.pitch||110)*t)`'],
  ['une PERCUSSION muette sans hauteur', '`js: (t, dur, env) => (env.pitch ? 1 : 0) * Math.sin(t)`'],
  ['un corps qui TIRE AU SORT', '`js: (t) => Math.random()*2-1`'],
];
for (const [quoi, corps] of injections) {
  ok(verdict(corps).motif !== null, `L. le garde refuse ${quoi}`);
}
// Et le juge doit LAISSER PASSER les deux formes justes — sans quoi il refuserait tout.
ok(verdict('`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`').motif === null,
  'M. le garde laisse passer une PERCUSSION juste');
ok(verdict('`js: (t, dur, env) => Math.sin(2*Math.PI*env.pitch*t)`').motif === null,
  'N. le garde laisse passer une voix PITCHÉE juste — silencieuse sans hauteur');
// Les motifs du § 2, injectés dans le juge lui-même.
ok(/\b[a-z_][a-z0-9_]*\s*:\s*[\d.]+(ms|s|hz)\b/i.test('`js: adsr(decay:350ms)`'),
  'O. le motif de l\'argument à unité mord sur `decay:350ms`');
ok(/Math\s*\.\s*random/.test('`js: (t) => Math.random()`'),
  'P. le motif du tirage mord sur `Math.random()`');

// ⛔ ET LE TÉMOIN QUI TIENT LA DÉCISION DE ROMAIN : un OPÉRATEUR JavaScript ne se refuse pas.
// Sans lui, rien n'empêche de remettre un jour un motif de graphie sur `>>` ou `||` — et la
// première écriture de ce garde en portait un.
ok(verdict('`js: (t) => (t*220 >> 0) / 220`').motif === null,
  'Q. un corps de JS PUR portant `>>` PASSE — un décalage binaire est du JavaScript, pas du patching');
// ⛔ ET LE TÉMOIN SYMÉTRIQUE, QUI DIT SUR QUOI PORTE LE REFUS. `??` est un opérateur JavaScript
// légal, comme `>>` : ce corps est refusé quand même — et son motif nomme l'EFFET, jamais le signe.
// (Ma première écriture de ce témoin l'attendait PASSANT : le garde m'a repris, et il avait raison.)
{
  const v = verdict('`js: (t, dur, env) => Math.sin(2*Math.PI*(env.pitch ?? 220)*t)`');
  ok(v.motif !== null && /INVENTE une hauteur/.test(v.motif),
    `R. un repli écrit avec un opérateur JS légal est refusé pour son EFFET — motif rendu : ${v.motif}`);
}
ok(!/\b[a-z_][a-z0-9_]*\s*:\s*[\d.]+(ms|s|hz)\b/i.test('`js: (t) => t >> 1 || 0`'),
  'S. le motif de l\'unité ne mord PAS sur des opérateurs JavaScript');

// ── verdict ────────────────────────────────────────────────────────────────────────────────────
console.log(`— ${noms.length} voix examinées · ${pitchees} pitchée(s) · ${noms.length - pitchees} percussive(s) —`);
console.log(`  [convention] rms sur une fenêtre de ${DUR.toFixed(2)} s à ${SR} Hz, queue de silence `
  + `comprise · seuil d'audibilité ${RMS_MIN} — un rms d'ailleurs ne se compare qu'à convention dite`);
for (const e of echecs) console.log(`  ⛔ ${e}`);
console.log(`${passees} vérification(s) passée(s), ${echecs.length} échec(s)`);
process.exit(echecs.length ? 1 : 0);
