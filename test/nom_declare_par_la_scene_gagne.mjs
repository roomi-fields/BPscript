#!/usr/bin/env node
/**
 * GARDE — un nom que LA SCÈNE déclare n'est jamais avalé par un mot du vocabulaire.
 *
 * SIGNALÉ par Kairos le 2026-07-27, sur pièces : `patchbay-demo.bps` déclare `@macro mute` et écrit
 * SEPT mots dans sa règle ; il en arrivait SIX. Zéro erreur, zéro avertissement. Trois de ses bancs
 * d'action glissaient d'un index.
 *
 * LA CAUSE EST DE MOI. J'ai déclaré `mute`, `unmute` et `panic` comme contrôles SANS ARGUMENT le
 * 2026-07-26. Un contrôle sans argument se reconnaît à son seul nom : le mot, jusque-là libre, est
 * devenu un mot du vocabulaire, et toute scène qui le portait déjà a été TRONQUÉE en silence. Je
 * n'ai mesuré aucun corpus consommateur avant de le déclarer — c'était une action de frontière et
 * je ne l'ai pas traitée comme telle.
 *
 * POURQUOI LE SILENCE EST LE VRAI DÉFAUT, plus encore que la troncature : côté consommateur, rien
 * ne distingue une scène qui a changé d'une scène qui a été amputée. Un mot qui disparaît sans un
 * mot est le pire des deux mondes.
 *
 * LA RÈGLE APPLIQUÉE n'est pas neuve : c'est la cascade déjà posée pour tout le langage (décision
 * 2026-06-26) — LE PLUS LOCAL GAGNE. La scène qui déclare un nom le possède. Le contrôle reste
 * joignable dans son sac, `(mute)` ou `!(mute)` : position syntaxique distincte, aucun conflit.
 *
 * ⚠️ ET ELLE EST VÉRIFIÉE SUR LES SEIZE contrôles sans argument, pas sur le seul mot signalé. Une
 * garde écrite pour la forme du ticket ne garde que celle-là — CLAUDE.md, règle des quatre fois.
 * La liste vient de la DONNÉE (le chargeur de librairies), jamais d'une liste en dur ici : le jour
 * où un dix-septième contrôle sans argument est déclaré, ce garde le couvre sans être touché.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { loadLibsFromDirectives } from '../src/transpiler/libs.js';
import { readFileSync } from 'node:fs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const CTX = loadLibsFromDirectives([{ name: 'core' }, { name: 'controls' }]);
const SANS_ARGUMENT = [...CTX.noArgControls].sort();
// Deux familles, et la donnée les sépare — pas une liste écrite ici. « Sans argument » ne veut pas
// dire « s'écrit nu au fil de la séquence » : les contrôles continus hérités de BP3 s'écrivent nus
// (10 scènes du corpus le font), `mute`/`unmute`/`panic` n'ont jamais eu que la forme du sac.
// Confondre les deux est CE QUI A TRONQUÉ la démo du patchbay.
const SAC_SEUL = SANS_ARGUMENT.filter((n) => CTX.bagOnlyControls.has(n));
const AVEC_FORME_NUE = SANS_ARGUMENT.filter((n) => !CTX.bagOnlyControls.has(n));

const regleDe = (o) => o.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [];

// ─── 1. SOCLE — la donnée n'est pas vide, sinon la garde rétrécit avec elle ──────────────────
// Ce garde est piloté par la donnée : si le chargeur rendait un ensemble vide, les boucles
// ci-dessous ne vérifieraient RIEN et resteraient vertes. On ancre donc le socle.
ok(SANS_ARGUMENT.length >= 16,
   `1. le vocabulaire doit porter au moins 16 contrôles sans argument — reçu ${SANS_ARGUMENT.length}`);
for (const attendu of ['mute', 'unmute', 'panic', 'stop']) {
  ok(SANS_ARGUMENT.includes(attendu), `1. '${attendu}' doit être un contrôle sans argument`);
}

ok(SAC_SEUL.length >= 3 && AVEC_FORME_NUE.length >= 10,
   `1. les deux familles doivent être peuplées — sac seul : ${SAC_SEUL.length}, forme nue : ${AVEC_FORME_NUE.length}`);

// ─── 2. Le mot QUI A une forme nue la garde — le corpus l'écrit ainsi, rien ne bouge ─────────
for (const mot of AVEC_FORME_NUE) {
  const o = compileToBPxAST(`@core\n@controls\n@mode:ord\nS -> a ${mot} b\n`);
  const r = regleDe(o);
  ok(r[1]?.type === 'Control' && r[1]?.name === mot,
     `2. '${mot}' sans déclaration locale reste un contrôle — reçu : ${JSON.stringify(r.map((e) => e.type))}`);
}

// ─── 2bis. Le mot SANS forme nue REFUSE — il ne disparaît pas ────────────────────────────────
// Demande de l'architecte, 2026-07-27 : « un mot réservé rencontré là où il ne peut pas l'être
// doit refuser, pas disparaître ». Le refus NOMME la faute et donne la réécriture ; constater
// sans réécrire laisserait l'auteur deviner.
for (const mot of SAC_SEUL) {
  const nu = compileToBPxAST(`@core\n@controls\n@mode:ord\nS -> a ${mot} b\n`);
  const msg = (nu.errors || []).map((e) => e.message || e).join(' | ');
  ok((nu.errors || []).length > 0, `2bis. '${mot}' nu dans le flux doit REFUSER, pas disparaître`);
  ok(msg.includes(`!(${mot})`), `2bis. le refus de '${mot}' doit donner la RÉÉCRITURE — reçu : ${msg.slice(0, 110)}`);
  // Et son sac reste ouvert, sinon on aurait supprimé le mot au lieu de le ranger.
  for (const forme of [`S -> a !(${mot}) b`, `S -> a(${mot}) b`]) {
    const o = compileToBPxAST(`@core\n@controls\n@mode:ord\n${forme}\n`);
    ok((o.errors || []).length === 0,
       `2bis. '${forme}' doit rester valide — reçu : ${(o.errors || []).map((e) => e.message || e).join(' | ')}`);
  }
}

// ─── 3. AVEC déclaration locale, la scène gagne — sur les SEIZE, pas sur le mot du ticket ────
for (const mot of SANS_ARGUMENT) {
  const avert = [];
  const o = compileToBPxAST(`@core\n@controls\n@macro ${mot} = drum.on\n@mode:ord\nS -> a ${mot} b\n`,
                            { onWarning: (w) => avert.push(w) });
  const r = regleDe(o);
  ok((o.errors || []).length === 0,
     `3. '@macro ${mot}' doit compiler — reçu : ${(o.errors || []).map((e) => e.message || e).join(' | ')}`);
  ok(r.length === 3,
     `3. '${mot}' déclaré par la scène ne doit PAS être avalé — ${r.length} mot(s) sur 3 dans la règle`);
  ok(r[1]?.type === 'Symbol' && r[1]?.name === mot,
     `3. '${mot}' déclaré reste un symbole — reçu : ${JSON.stringify(r.map((e) => e.type))}`);
  // L'ombrage est légitime, il n'est pas anodin : il se DIT.
  const messages = (o.warnings || avert).map((w) => w.message || w).join(' | ');
  ok(messages.includes(mot),
     `3. l'ombrage de '${mot}' doit être ANNONCÉ — avertissements reçus : ${messages.slice(0, 120) || '(aucun)'}`);
}

// ─── 4. LE CAS SIGNALÉ, en entier et sur pièce ───────────────────────────────────────────────
// Pas une réduction du cas : la démo elle-même, telle qu'elle vit dans le dépôt. Kairos comptait
// six mots là où elle en écrit sept.
{
  const source = readFileSync(new URL('../public/demos/patchbay-demo.bps', import.meta.url), 'utf8');
  const o = compileToBPxAST(source);
  const r = regleDe(o);
  ok((o.errors || []).length === 0,
     `4. patchbay-demo doit compiler — reçu : ${(o.errors || []).map((e) => e.message || e).join(' | ')}`);
  ok(r.length === 7,
     `4. patchbay-demo écrit SEPT mots, il doit en arriver sept — reçu ${r.length}`);
  ok(r.map((e) => e.name).join(' ') === 'lead strike open lead glide mute lead',
     `4. et dans l'ordre écrit — reçu : ${r.map((e) => e.name || e.type).join(' ')}`);
}

// ─── 5. Le contrôle reste JOIGNABLE dans son sac, même quand la scène a pris son nom ─────────
// Sinon la cascade coûterait le mot au lieu de le partager : deux positions syntaxiques, deux
// sens, aucun conflit.
{
  const o = compileToBPxAST('@core\n@controls\n@macro mute = drum.on\n@mode:ord\nS -> a !(mute) b\n');
  ok((o.errors || []).length === 0,
     `5. '!(mute)' doit rester valide malgré la macro homonyme — reçu : ${(o.errors || []).map((e) => e.message || e).join(' | ')}`);
}

if (echecs.length) {
  console.error(`❌ nom déclaré par la scène : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ un nom déclaré par la scène gagne — ${passe} vérification(s) passée(s) sur ${SANS_ARGUMENT.length} contrôle(s) sans argument`);
}
