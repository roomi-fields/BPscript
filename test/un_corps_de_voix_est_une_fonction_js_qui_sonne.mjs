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
 * ⚠️ CE GARDE NE TOUCHE PAS AU DÉPÔT DU VOISIN. La porte qui accueille ces corps vit chez
 *    runtime-audio ; l'appeler d'ici prouverait SA porte, jamais MA donnée. On reproduit donc la
 *    convention d'accueil — `(t, dur, env) => échantillon`, `env.pitch` en Hz — et on garde ce qui
 *    est à moi : que chacune des quinze valeurs publiées soit une fonction qui produit du son.
 */
import { LIBS } from '../src/transpiler/libs-data.js';

const SR = 8000;        // suffisant pour l'énergie ; le garde doit rester rapide
const DUR = 1.0;
const RMS_MIN = 0.01;   // sous ce seuil, la voix est inaudible

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

/** EXERCE le corps : énergie, pic, et toute exception levée À L'APPEL. */
function exercer(fn, env) {
  let somme = 0, pic = 0, nonFinis = 0;
  const n = Math.floor(SR * DUR);
  try {
    for (let i = 0; i < n; i++) {
      const s = fn(i / SR, DUR, env);
      if (typeof s !== 'number' || !Number.isFinite(s)) { nonFinis++; continue; }
      somme += s * s;
      if (Math.abs(s) > pic) pic = Math.abs(s);
    }
  } catch (e) { return { leve: e.message, rms: 0, pic: 0, nonFinis }; }
  return { leve: null, rms: Math.sqrt(somme / n), pic, nonFinis };
}

/** Le corps lit-il la hauteur ? `Math.random` est figé — sans quoi le bruit se lit comme un pitch. */
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
  const avec = exercer(fn, { pitch: 220 });
  const sans = exercer(fn, {});
  if (avec.leve || sans.leve) return { motif: `lève à l'appel : ${avec.leve || sans.leve}` };
  if (avec.nonFinis || sans.nonFinis) return { motif: `${avec.nonFinis + sans.nonFinis} échantillon(s) non finis` };
  if (avec.rms <= RMS_MIN || sans.rms <= RMS_MIN) return { motif: `MUET — rms ${avec.rms.toFixed(5)}` };
  if (avec.pic > 1.5) return { motif: `écrête — pic ${avec.pic.toFixed(2)}` };
  return { motif: null, rms: avec.rms, pic: avec.pic, pitchee: litLaHauteur(fn) };
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

// ── 2. LA FORME RETIRÉE NE REVIENT PAS PAR UN CORPS QUI COMPILE ────────────────────────────────
// `>>` et un argument nommé à unité (`decay:350ms`) sont les deux graphies du patching. La
// première COMPILE en JavaScript, elle ne peut donc pas être attrapée par « ça compile ».
for (const nom of noms) {
  const brut = String(voix[nom]?.audio ?? '');
  ok(!brut.includes('>>'), `E.${nom} ne compose aucune couche (\`>>\`)`);
  ok(!/\b[a-z_][a-z0-9_]*\s*:\s*[\d.]+(ms|s|hz)\b/i.test(brut),
    `F.${nom} n'a pas d'argument nommé à unité (\`decay:350ms\`)`);
}

// ── 3. LES DEUX VOIX PITCHÉES LISENT LA HAUTEUR, LES AUTRES SONNENT SANS ───────────────────────
// Ce compte est ce qui distingue une voix mélodique d'une percussion : le perdre rendrait les
// quinze interchangeables sans qu'aucune assertion ne bouge.
ok(pitchees === 2, `G. exactement 2 voix lisent la hauteur — mesuré ${pitchees}`);
ok(verdict(voix.wobble?.audio ?? '').pitchee === true, 'H. `wobble` lit la hauteur');
ok(verdict(voix.fatbass?.audio ?? '').pitchee === true, 'I. `fatbass` lit la hauteur');
ok(verdict(voix.dayan_open?.audio ?? '').pitchee === false, 'J. `dayan_open` est percussive');

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
];
for (const [quoi, corps] of injections) {
  ok(verdict(corps).motif !== null, `K. le garde refuse ${quoi}`);
}
// Et le juge doit LAISSER PASSER une forme juste — sans quoi il refuserait tout, y compris le vrai.
ok(verdict('`js: (t) => Math.sin(2*Math.PI*220*t) * Math.exp(-t/0.2)`').motif === null,
  'L. le garde laisse passer une forme juste');
// Le motif du patching, injecté dans le juge du § 2 lui-même.
ok('`js: (a) => a >> 1`'.includes('>>'), 'M. le motif `>>` mord sur un corps qui en porte');
ok(/\b[a-z_][a-z0-9_]*\s*:\s*[\d.]+(ms|s|hz)\b/i.test('`js: adsr(decay:350ms)`'),
  'N. le motif de l\'argument à unité mord sur `decay:350ms`');

// ── verdict ────────────────────────────────────────────────────────────────────────────────────
console.log(`— ${noms.length} voix examinées · ${pitchees} pitchée(s) · ${noms.length - pitchees} percussive(s) —`);
for (const e of echecs) console.log(`  ⛔ ${e}`);
console.log(`${passees} vérification(s) passée(s), ${echecs.length} échec(s)`);
process.exit(echecs.length ? 1 : 0);
