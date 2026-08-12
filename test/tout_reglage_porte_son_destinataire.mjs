#!/usr/bin/env node
/**
 * GARDE — tout réglage qui voyage dans l'arbre porte le DESTINATAIRE déclaré par sa librairie.
 *
 * CE QUE ÇA TIENT. Une librairie déclare UN destinataire (`resolvedBy`) et c'est le principe de
 * son découpage. Cette information s'arrêtait au chargeur : le sac partait avec sa nature et sa
 * portée, jamais avec sa destination, et l'aval devait la redeviner à partir du nom de la clé —
 * avec une table recopiée chez lui, qui dérive en silence le jour où une clé change de librairie.
 * Depuis, chaque sac porte `resolvedBy`, une table parallèle à `params`, clé pour clé.
 *
 * POURQUOI UNE TABLE ET NON UNE VALEUR : un sac unique mélange les destinataires. Le garde
 * l'exige explicitement plutôt que de l'espérer.
 *
 * CE QUE LE GARDE MESURE, EN MATRICE SUR TOUT LE VOCABULAIRE — jamais sur un échantillon :
 *   1. CHAQUE contrôle déclaré, écrit seul dans un sac, ressort avec son destinataire, et cette
 *      valeur est VERBATIM celle de sa librairie — pas une traduction, pas une classe.
 *   2. Un sac qui mélange trois librairies rend TROIS destinataires, un par clé.
 *   3. La table ne couvre que ce que les librairies déclarent : une clé sans librairie n'invente
 *      aucun destinataire — l'absence reste visible.
 *
 * INJECTION dans l'ACCUSÉ (un contrôle privé de destinataire dans une librairie fabriquée, puis
 * un contrôle dont la librairie en déclare un AUTRE) et dans le JUGE (la comparaison isolée).
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { loadLibsFromDirectives, registerLib, universeControlNames } from '../src/transpiler/libs.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** Le premier sac de réglages porteur de `params` rencontré dans l'arbre. */
const sacDe = (ast) => {
  let trouve = null;
  const walk = (n) => {
    if (!n || typeof n !== 'object' || trouve) return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.payload && n.payload.params) { trouve = n.payload; return; }
    Object.values(n).forEach(walk);
  };
  walk(ast);
  return trouve;
};

const scene = (corps) => `@core\n@alphabet.western:midi\n\nS -> !(${corps}) C4\n`;

// ─── LA TABLE ATTENDUE — lue sur les librairies, jamais recopiée ici ─────────────────────────
const destinataireAttendu = {};
for (const [nomLib, lib] of Object.entries(LIBS)) {
  if (!lib?.resolvedBy) continue;
  for (const section of ['controls', 'engine', 'subgrammar']) {
    for (const [n, d] of Object.entries(lib[section] || {})) {
      if (n.startsWith('_') || !d || typeof d !== 'object' || !('args' in d) || !('description' in d)) continue;
      destinataireAttendu[n] = { destinataire: lib.resolvedBy, lib: nomLib };
    }
  }
}

// ─── 0. Témoins anti-rétrécissement ──────────────────────────────────────────────────────────
const univers = universeControlNames();
ok(univers.size >= 75, `0. l'univers doit porter au moins 75 contrôles (reçu ${univers.size})`);
ok(Object.keys(destinataireAttendu).length >= 75,
   `0. au moins 75 contrôles doivent avoir un destinataire déclaré (reçu ${Object.keys(destinataireAttendu).length})`);
const libCtx = loadLibsFromDirectives(Object.keys(LIBS).map((name) => ({ name })));
ok(Object.keys(libCtx.controlResolvedBy || {}).length >= 75,
   `0. le chargeur doit exposer au moins 75 destinataires (reçu ${Object.keys(libCtx.controlResolvedBy || {}).length})`);

// ─── 1. LA MATRICE — chaque contrôle écrivable ressort avec SON destinataire, verbatim ───────
// Les contrôles qui n'acceptent pas cette écriture (portée, arguments obligatoires) ne sont pas
// des échecs de CE garde : on les compte, et on exige que le lot mesuré reste massif — un garde
// qui n'aurait plus rien à mesurer serait vert sans rien voir.
let mesures = 0;
const nonEcrivables = [];
for (const [nom, attendu] of Object.entries(destinataireAttendu)) {
  const def = libCtx.controls[nom];
  const valeur = !def?.args || def.args.length === 0 ? nom : `${nom}:1`;
  const r = compileToBPxAST(scene(valeur));
  if ((r.errors ?? []).length) { nonEcrivables.push(nom); continue; }
  const sac = sacDe(r.ast ?? r);
  if (!sac) { nonEcrivables.push(nom); continue; }
  mesures++;
  ok(sac.resolvedBy && sac.resolvedBy[nom] === attendu.destinataire,
     `1. '${nom}' (lib/${attendu.lib}.json) doit ressortir avec le destinataire `
     + `'${attendu.destinataire}' ; le sac porte ${JSON.stringify(sac.resolvedBy)}`);
}
ok(mesures >= 40,
   `1. le lot réellement mesuré doit rester massif (mesurés ${mesures}, non écrivables tels quels `
   + `${nonEcrivables.length}) — sinon ce garde serait vert sans rien avoir vu`);

// ─── 2. UN SAC MÉLANGÉ REND UN DESTINATAIRE PAR CLÉ ──────────────────────────────────────────
{
  const sac = sacDe(compileToBPxAST(scene('vel:50, transpose:3/2, volume:90')).ast);
  ok(sac?.resolvedBy?.vel === destinataireAttendu.vel.destinataire, '2. le sac mélangé rend le destinataire de vel');
  ok(sac?.resolvedBy?.transpose === destinataireAttendu.transpose.destinataire, '2. le sac mélangé rend le destinataire de transpose');
  ok(sac?.resolvedBy?.volume === destinataireAttendu.volume.destinataire, '2. le sac mélangé rend le destinataire de volume');
  ok(new Set(Object.values(sac?.resolvedBy || {})).size === 3,
     `2. trois librairies dans un sac doivent rendre TROIS destinataires distincts `
     + `(reçu ${JSON.stringify(sac?.resolvedBy)}) — une valeur unique en tairait deux`);
}

// ─── 3. INJECTION DANS L'ACCUSÉ — une librairie sans destinataire, puis avec un autre ────────
{
  registerLib('_faux_muet', { name: '_faux_muet', controls: {
    zz_sans_destinataire: { args: [], description: 'sans resolvedBy', scope: ['flow'] } } });
  const ctx = loadLibsFromDirectives([...Object.keys(LIBS), '_faux_muet'].map((name) => ({ name })));
  ok(ctx.controlResolvedBy.zz_sans_destinataire === undefined,
     "3. (n'invente pas) un contrôle dont la librairie ne déclare aucun destinataire ne doit "
     + "en recevoir AUCUN — l'absence reste visible");

  registerLib('_faux_autre', { name: '_faux_autre', resolvedBy: 'un-autre-outil', controls: {
    zz_autre_destinataire: { args: [], description: 'autre resolvedBy', scope: ['flow'] } } });
  const ctx2 = loadLibsFromDirectives([...Object.keys(LIBS), '_faux_autre'].map((name) => ({ name })));
  ok(ctx2.controlResolvedBy.zz_autre_destinataire === 'un-autre-outil',
     '3. (mord) le destinataire porté doit suivre la librairie déclarante, verbatim — '
     + `reçu '${ctx2.controlResolvedBy.zz_autre_destinataire}'`);
}

// ─── 4. INJECTION DANS LE JUGE — la comparaison rejouée isolée ───────────────────────────────
const juger = (sac, attendus) => Object.entries(attendus)
  .filter(([k, v]) => !sac.resolvedBy || sac.resolvedBy[k] !== v).map(([k]) => k);
ok(juger({ resolvedBy: { vel: 'Kairos' } }, { vel: 'toutes les sorties' }).length === 1,
   '4. (mord) le juge doit signaler un destinataire qui ne correspond pas');
ok(juger({ resolvedBy: { vel: 'toutes les sorties' } }, { vel: 'toutes les sorties' }).length === 0,
   '4. (se tait) le juge ne signale rien quand le destinataire correspond');
ok(juger({}, { vel: 'toutes les sorties' }).length === 1,
   "4. (mord) un sac SANS table de destinataires doit être signalé, pas lu comme conforme");

if (echecs.length) {
  console.error(`❌ destinataire des réglages : ${echecs.length} échec(s)`);
  for (const e of echecs.slice(0, 12)) console.error(`   - ${e}`);
  if (echecs.length > 12) console.error(`   … et ${echecs.length - 12} autre(s)`);
  process.exitCode = 1;
} else {
  console.log(`✅ tout réglage porte le destinataire de sa librairie — ${passe} vérification(s) passée(s) `
    + `(${mesures} contrôles mesurés dans l'arbre, ${nonEcrivables.length} non écrivables tels quels)`);
}
