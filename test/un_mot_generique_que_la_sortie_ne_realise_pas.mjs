#!/usr/bin/env node
/**
 * GARDE — un mot GÉNÉRIQUE écrit pour une sortie qui ne le réalise pas est REFUSÉ.
 *
 * RÈGLE DE ROMAIN, 2026-08-15 : « si certains sont en attente d'une implémentation, il faut mettre
 * l'implémentation au backlog et s'assurer qu'on a un message d'erreur si on l'utilise ».
 *
 * ⛔ C'EST UN REFUS D'USAGE, PAS DE DÉCLARATION, et la distinction porte tout le mécanisme. Le
 * chargeur refuse déjà une déclaration incohérente — un `implements` qui pointe dans le vide. Ici
 * la déclaration est juste et c'est l'ÉCRITURE qui n'a nulle part où aller. Sans ce refus, le mot
 * compile et ne fait RIEN — le défaut que le langage refuse partout ailleurs.
 *
 * ⛔ CE GARDE A ATTENDU SA RÉALISATION, ET C'EST LE POINT. Écrit le 2026-08-15 au matin, il
 * invalidait QUATRE scènes vivantes de kairos et kanopi qui écrivent `!(volume:N)` sans sortie
 * déclarée — donc en `audio`, qu'aucune réalisation ne couvrait. Le refus avait raison ; ce
 * n'étaient pas les scènes qui étaient fautives, c'était `audio.volume` qui manquait. Il est resté
 * RETENU, non poussé, jusqu'à ce que runtime-audio mesure la réalisation et que Romain la tranche.
 * Mesure à l'armement : ZÉRO scène du périmètre ne tombe.
 *
 * LE CANAL D'UNE RÉALISATION EST LE NOM DE SA LIBRAIRIE quand ce nom est un canal déclaré
 * (`midi.volume` → canal `midi`). Aucun nom n'est écrit dans le code : le catalogue des canaux et
 * les liens de réalisation sont tous deux de la donnée.
 *
 * INJECTION dans l'ACCUSÉ (une réalisation retirée de la donnée) et dans le JUGE.
 */
import { createRequire } from 'node:module';
import { compileToBPxAST } from '../src/transpiler/index.js';

const require = createRequire(import.meta.url);
const { LIBS } = require('../src/transpiler/libs-data.js');

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const erreursDe = (src) => {
  try { return compileToBPxAST(src).errors ?? []; } catch (e) { return [{ message: e.message }]; }
};
const refusGenerique = (src) =>
  erreursDe(src).filter((e) => /is a GENERIC word/.test(String(e.message)));

// ── 0. SOCLE — l'interface et ses DEUX réalisations existent ─────────────────────────────────
ok(LIBS.expression?.controls?.volume && !LIBS.expression.controls.volume.implements,
   "0. SOCLE : `expression.volume` doit être l'INTERFACE — déclarée, et ne réalisant rien");
for (const canal of ['midi', 'audio']) {
  ok(LIBS[canal]?.controls?.volume?.implements === 'expression.volume',
     `0. SOCLE : '${canal}.volume' doit réaliser l'interface — sans les deux, les volets suivants `
     + `ne mesurent pas ce qu'ils croient`);
}

// ── 1. LES SORTIES QUI RÉALISENT PASSENT ────────────────────────────────────────────────────
for (const [quoi, src] of [
  ['une sortie midi',   'core\nalphabet.western:midi\n-----\nS -> C4 !(volume:90)\n'],
  ['une sortie audio',  'core\nalphabet.western:audio\n-----\nS -> C4 !(volume:90)\n'],
  ['la sortie par défaut', 'core\nalphabet.western\n-----\nS -> C4 !(volume:90)\n'],
]) {
  ok(erreursDe(src).length === 0,
     `1. ${quoi} doit compiler — reçu : ${erreursDe(src).map((e) => e.message).join(' | ').slice(0, 100)}`);
}

// ── 2. UNE SORTIE QUI NE RÉALISE PAS EST REFUSÉE, EN LA NOMMANT ─────────────────────────────
{
  const src = 'core\nalphabet.western\nactor v\n  alphabet.western\n  out.osc\n-----\nS -> v.C4 !(volume:90)\n';
  const m = refusGenerique(src);
  ok(m.length > 0, "2. une sortie qui ne réalise pas le mot doit être REFUSÉE");
  ok(m.length > 0 && /osc/.test(m[0].message),
     `2. et le refus doit NOMMER la sortie fautive — reçu : ${m[0] && m[0].message.slice(0, 110)}`);
  ok(m.length > 0 && /midi/.test(m[0].message) && /audio/.test(m[0].message),
     `2. et NOMMER les réalisations qui existent, pour que l'auteur voie ce qu'il peut viser`);
}

// ── 2bis. LES DEUX PLACES D'ÉCRITURE, ET C'EST L'INJECTION QUI L'A EXIGÉ ────────────────────
// ⚠️ MON INJECTION N'A PAS MORDU LA PREMIÈRE FOIS, et c'est elle qu'il fallait suspecter, pas le
// code : le refus est branché à DEUX endroits — le sac replié d'une occurrence et le sac écrit —
// et couper un seul laissait l'autre le lever. Un garde qui ne teste qu'une place croit tenir le
// mécanisme alors qu'il tient une moitié. Les deux places sont donc mesurées.
{
  const A = 'core\nalphabet.western\nactor v\n  alphabet.western\n  out.osc\n-----\n';
  ok(refusGenerique(`${A}S -> v.C4 !(volume:90)\n`).length > 0,
     "2bis. dans le FLUX — le sac posé avec '!' doit être refusé");
  ok(refusGenerique(`${A}S -> v.C4(volume:90)\n`).length > 0,
     "2bis. sur un ÉLÉMENT — le sac collé à une occurrence doit l'être aussi");
}

// ── 3. LA FORME PRÉFIXÉE ÉCHAPPE AU REFUS — elle vise une réalisation, pas l'interface ───────
// Le complément : viser directement `midi.volume` est légitime même sur une scène qui ne sort pas
// en MIDI, parce que l'auteur a dit EXPLICITEMENT ce qu'il vise.
ok(erreursDe('core\nalphabet.western:audio\n-----\nS -> C4 !(midi.volume:90)\n').length === 0,
   "3. la forme PRÉFIXÉE doit passer — la viser directement est ce qu'elle sert à faire");

// ── 4. LE COMPLÉMENT — un mot qui n'est PAS générique n'est pas touché ──────────────────────
// Sans ce volet, un refus trop large refuserait tout mot écrit sur toute sortie, et les trois
// précédents resteraient verts.
for (const [quoi, src] of [
  ['un contrôle propre à une sortie', 'core\nalphabet.western:midi\n-----\nS -> C4 !(chan:3)\n'],
  ['un contrôle d\'expression sans réalisation', 'core\nalphabet.western:audio\n-----\nS -> C4 !(vel:90)\n'],
]) {
  ok(refusGenerique(src).length === 0, `4. ${quoi} ne doit pas être touché`);
}

// ── 5. INJECTION DANS L'ACCUSÉ — la réalisation audio retirée de la DONNÉE ──────────────────
// ⚠️ EN MÉMOIRE, jamais sur le disque : mes librairies sont lues VIVANTES par mes consommateurs.
{
  const { registerLib, clearRegistry, registerAll } = await import('../src/transpiler/libs.js');
  const ampute = JSON.parse(JSON.stringify(LIBS.audio));
  delete ampute.controls.volume;
  clearRegistry(); registerAll(LIBS); registerLib('audio', ampute);
  ok(refusGenerique('core\nalphabet.western:audio\n-----\nS -> C4 !(volume:90)\n').length > 0,
     "5. (mord) `audio.volume` retiré de la donnée doit faire retomber la scène audio sur le refus — "
     + "c'est l'état exact d'hier, où ce garde invalidait quatre scènes de kairos et kanopi");
  clearRegistry(); registerAll(LIBS);
  ok(erreursDe('core\nalphabet.western:audio\n-----\nS -> C4 !(volume:90)\n').length === 0,
     '5. après restauration, la scène audio repasse — sinon la mutilation fuit sur la suite');
}

// ── 6. INJECTION DANS LE JUGE — la décision rejouée isolée ──────────────────────────────────
const juger = (sorties, realisees) => sorties.filter((s) => !realisees.has(s));
ok(juger(['osc'], new Set(['midi', 'audio'])).length === 1, '6. (mord) une sortie non réalisée');
ok(juger(['audio'], new Set(['midi', 'audio'])).length === 0, '6. (se tait) une sortie réalisée');
ok(juger(['midi', 'osc'], new Set(['midi'])).length === 1,
   '6. (mord) une scène à deux sorties dont une seule réalise');

const TOTAL_ATTENDU = 3 + 3 + 3 + 2 + 1 + 2 + 2 + 3;
ok(passe + echecs.length === TOTAL_ATTENDU,
   `bilan : ${TOTAL_ATTENDU} vérifications attendues, ${passe + echecs.length} exécutées`);

if (echecs.length) {
  console.error(`❌ mot générique non réalisé : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ un mot générique que la sortie ne réalise pas est refusé — ${passe} vérification(s) passée(s)`);
}
