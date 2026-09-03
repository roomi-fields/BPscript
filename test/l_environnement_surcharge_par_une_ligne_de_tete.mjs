#!/usr/bin/env node
/**
 * GARDE — UN CONTRÔLE PORTE SA VALEUR DANS `value`, ET L'ENVIRONNEMENT LA SURCHARGE PAR UNE LIGNE
 * DE TÊTE.
 *
 * Arbitrage de Romain, 2026-09-03 (point 3 et forme 4 des cinq arbitrages) : le membre s'appelle
 * `value` — ce que le contrôle vaut quand personne ne l'écrit — et une librairie d'environnement
 * surcharge en écrivant `volume:90` en tête de son fichier, comme une scène l'écrit en tête. Le
 * chargeur applique la surcharge aux contrôles en portée de qui invoque la librairie, dans l'ordre
 * d'invocation ; la scène, l'acteur et l'occurrence surchargent ensuite.
 *
 * LA MATRICE :
 *   1. la déclaration porte `value`, jamais `default` — sur TOUS les contrôles du registre ;
 *   2. l'environnement surcharge : sous `core` (qui apporte `midi_default`), `volume` vaut ce que
 *      `midi_default` écrit en tête, pas ce que `midi` déclare ; sans `midi_default`, la déclaration ;
 *   3. la ligne de tête d'une librairie n'est pas jugée par sa place : neuf réglages de
 *      `midi_default` n'ont pas la portée scène et compilent quand même ;
 *   4. une librairie d'environnement FABRIQUÉE, invoquée, surcharge un contrôle ; non invoquée, non
 *      (principe 1) ; deux invoquées, la dernière gagne ;
 *   5. le vocabulaire rend `value` et aucun `default`.
 */
import { compileToBPxAST, describeVocabulary } from '../src/transpiler/index.js';
import { loadLibsFromDirectives, leRegistre, registerLib } from '../src/transpiler/libs.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ── 1. `value`, jamais `default`, sur tous les contrôles du registre ───────────────────────────
{
  const registre = leRegistre();
  let controles = 0, avecValue = 0, avecDefault = 0;
  const marcher = (o) => { for (const v of Object.values(o || {})) { if (!v || typeof v !== 'object' || Array.isArray(v)) continue; if ('args' in v && 'description' in v) { controles++; if ('value' in v) avecValue++; if ('default' in v) avecDefault++; } else marcher(v); } };
  for (const [cle, lib] of Object.entries(registre)) if (lib && typeof lib === 'object' && !cle.includes('/')) marcher(lib);
  ok(controles >= 60, `1. SOCLE : ${controles} contrôles vus au registre`);
  ok(avecDefault === 0, `1. aucun contrôle ne porte 'default' — reçu ${avecDefault}`);
  ok(avecValue >= 15, `1. au moins quinze contrôles portent 'value' — reçu ${avecValue}`);
}

// ── 2. l'environnement surcharge, et seulement s'il est invoqué ────────────────────────────────
{
  const declaree = loadLibsFromDirectives([{ name: 'midi' }]).controls.volume;
  const sousCore = loadLibsFromDirectives([{ name: 'core' }]).controls.volume;
  const attendue = (leRegistre().midi_default.reglages || {}).volume;
  ok(attendue !== undefined, `2. midi_default écrit 'volume' en tête — reçu ${JSON.stringify(leRegistre().midi_default.reglages)}`);
  ok(sousCore && sousCore.value === attendue, `2. sous core, volume vaut la ligne de tête de midi_default(${attendue}) — reçu ${sousCore && sousCore.value}`);
  // `midi.volume` ne déclare pas de valeur propre : sans l'environnement, il n'en a pas(mesuré).
  ok(declaree && declaree.value !== attendue,
     `2. sans midi_default, volume vaut sa déclaration, jamais l'environnement — reçu ${declaree && declaree.value} contre ${attendue}`);
  const bool = loadLibsFromDirectives([{ name: 'core' }]).controls.letring;
  ok(bool && bool.value === true, `2. une valeur booléenne de tête reste un booléen — reçu ${JSON.stringify(bool && bool.value)}`);
}

// ── 3. la ligne de tête d'une librairie n'est pas jugée par sa place ───────────────────────────
{
  const r = compileToBPxAST('types\nmidi\npitchbend:0\nmod:0\ndef zzenv(resolvedBy:x, resolves:zzenv, name:zzenv)\n', { librairie: true });
  ok((r.errors || []).length === 0, `3. 'pitchbend:0' (sans portée scène) en tête d'une LIBRAIRIE compile — reçu ${JSON.stringify((r.errors || []).map((e) => e.message))}`);
  const scene = compileToBPxAST('core\npitchbend:0\n-----\nS -> C4\n');
  ok((scene.errors || []).some((e) => /pitchbend.*cannot be written at the top/.test(e.message)),
     `3. la même ligne en tête de SCÈNE reste jugée par sa place — reçu ${JSON.stringify((scene.errors || []).map((e) => e.message))}`);
}

// ── 4. une librairie d'environnement fabriquée ─────────────────────────────────────────────────
{
  const registre = leRegistre();
  registerLib('zzenvA', { resolves: 'zzenvA', resolvedBy: 'témoin', reglages: { volume: 11 } });
  registerLib('zzenvB', { resolves: 'zzenvB', resolvedBy: 'témoin', reglages: { volume: 22 } });
  try {
    ok(loadLibsFromDirectives([{ name: 'midi' }, { name: 'zzenvA' }]).controls.volume.value === 11, '4. une librairie d\'environnement invoquée surcharge volume');
    ok(loadLibsFromDirectives([{ name: 'midi' }]).controls.volume.value !== 11, '4. non invoquée, elle ne surcharge rien(principe 1)');
    ok(loadLibsFromDirectives([{ name: 'midi' }, { name: 'zzenvA' }, { name: 'zzenvB' }]).controls.volume.value === 22, '4. deux invoquées : la dernière gagne');
  } finally {
    delete registre.zzenvA; delete registre.zzenvB;
    registerLib('zzenvA', undefined); registerLib('zzenvB', undefined);
    delete registre.zzenvA; delete registre.zzenvB;
  }
}

// ── 5. le vocabulaire rend `value` ─────────────────────────────────────────────────────────────
{
  const v = describeVocabulary();
  const volume = v.controls.find((c) => c.name === 'volume');
  ok(volume && 'value' in volume && !('default' in volume), `5. describeVocabulary().controls.volume porte 'value', pas 'default' — reçu ${JSON.stringify(volume)}`);
  ok(v.controls.every((c) => !('default' in c)), '5. aucun contrôle du vocabulaire ne porte \'default\'');
}

ok(passe >= 13, `SOCLE : ${passe} vérifications — la matrice s'est vidée`);
if (echecs.length) {
  console.error(`[value + ligne de tête] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[value + ligne de tête] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
