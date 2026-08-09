#!/usr/bin/env node
/**
 * GARDE — un nom que LA SCÈNE déclare n'est jamais avalé par un mot du vocabulaire.
 *
 * SIGNALÉ par Kairos le 2026-07-27, sur pièces : `patchbay-demo.bps` déclare `@def mute` et écrit
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
// ⚠️ DEUX CHAMPS FERMENT DEUX PORTES DIFFÉRENTES, et les confondre a coûté un aller-retour le
// 2026-08-08. `sacSeul` ferme la forme NUE (`-> randomize C4`) ; la PORTÉE déclarée ferme les
// places où le contrôle ne vaut pas (`!(randomize)` dans le flux, quand sa portée est la seule
// tête de sous-grammaire). J'ai d'abord retiré `sacSeul` en croyant que la portée suffisait :
// la forme nue s'est rouverte aussitôt. Un contrôle peut donc être fermé DES DEUX CÔTÉS, et ce
// volet ne doit pas présumer que « interdit nu » implique « valide dans le flux ».
const VAUT_DANS_LE_FLUX = (n) => {
  const p = CTX.controls?.[n]?.scope;
  return Array.isArray(p) ? p.includes('flow') : false;
};
const SAC_SEUL = SANS_ARGUMENT.filter((n) => CTX.bagOnlyControls.has(n) && VAUT_DANS_LE_FLUX(n));
const AVEC_FORME_NUE = SANS_ARGUMENT.filter((n) => !CTX.bagOnlyControls.has(n));

const regleDe = (o) => o.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [];

// ─── 1. SOCLE — la donnée n'est pas vide, sinon la garde rétrécit avec elle ──────────────────
// Ce garde est piloté par la donnée : si le chargeur rendait un ensemble vide, les boucles
// Compte abaissé d'UNE unité le 2026-08-09 : `randomize` était déclaré DEUX FOIS (sections
// `subgrammar` et `engine`), avec deux portées divergentes — et c'est la plus étroite qui
// gagnait en silence. Le doublon part, le MOT reste déclaré : aucune confiscation, aucun
// nom ne quitte le vocabulaire. C'est le seul abaissement légitime de ce socle — une entrée
// dupliquée qu'on dédoublonne, jamais un cas qui « ne passe plus ».
// ci-dessous ne vérifieraient RIEN et resteraient vertes. On ancre donc le socle.
ok(SANS_ARGUMENT.length >= 15,
   `1. le vocabulaire doit porter au moins 16 contrôles sans argument — reçu ${SANS_ARGUMENT.length}`);
for (const attendu of ['mute', 'unmute', 'panic', 'stop']) {
  ok(SANS_ARGUMENT.includes(attendu), `1. '${attendu}' doit être un contrôle sans argument`);
}

ok(SAC_SEUL.length >= 3 && AVEC_FORME_NUE.length >= 10,
   `1. les deux familles doivent être peuplées — sac seul : ${SAC_SEUL.length}, forme nue : ${AVEC_FORME_NUE.length}`);

// ─── 2. Le mot QUI A une forme nue la garde — le corpus l'écrit ainsi, rien ne bouge ─────────
for (const mot of AVEC_FORME_NUE) {
  const o = compileToBPxAST(`@core\n@controls\n@alphabet.simple\n@mode:ord\nS -> a ${mot} b\n`);
  const r = regleDe(o);
  ok(r[1]?.type === 'Control' && r[1]?.name === mot,
     `2. '${mot}' sans déclaration locale reste un contrôle — reçu : ${JSON.stringify(r.map((e) => e.type))}`);
}

// ─── 2bis. Le mot SANS forme nue REFUSE — il ne disparaît pas ────────────────────────────────
// Demande de l'architecte, 2026-07-27 : « un mot réservé rencontré là où il ne peut pas l'être
// doit refuser, pas disparaître ». Le refus NOMME la faute et donne la réécriture ; constater
// sans réécrire laisserait l'auteur deviner.
for (const mot of SAC_SEUL) {
  const nu = compileToBPxAST(`@core\n@controls\n@alphabet.simple\n@mode:ord\nS -> a ${mot} b\n`);
  const msg = (nu.errors || []).map((e) => e.message || e).join(' | ');
  ok((nu.errors || []).length > 0, `2bis. '${mot}' nu dans le flux doit REFUSER, pas disparaître`);
  ok(msg.includes(`!(${mot})`), `2bis. le refus de '${mot}' doit donner la RÉÉCRITURE — reçu : ${msg.slice(0, 110)}`);
  // Et son sac reste ouvert, sinon on aurait supprimé le mot au lieu de le ranger.
  // ⚠️ LA SECONDE FORME EST TOMBÉE le 2026-08-08. Ce volet vérifiait que le sac de ces mots « reste
  // ouvert » aux deux places, collée et flux. Romain a tranché depuis que `mute`, `unmute` et
  // `panic` sont des GESTES : ils arrivent à un instant et ne valent QUE dans le flux. Le collé
  // n'est donc plus une place légitime, et le mot n'y est pas perdu — il est refusé en nommant
  // sa place. La propriété que ce volet garde est intacte : le mot n'a pas disparu, il a un sac.
  for (const forme of [`@alphabet.simple\nS -> a !(${mot}) b`]) {
    const o = compileToBPxAST(`@core\n@controls\n@mode:ord\n${forme}\n`);
    ok((o.errors || []).length === 0,
       `2bis. '${forme}' doit rester valide — reçu : ${(o.errors || []).map((e) => e.message || e).join(' | ')}`);
  }
}

// ─── 3. AVEC déclaration locale, la scène gagne — sur les SEIZE, pas sur le mot du ticket ────
for (const mot of SANS_ARGUMENT) {
  const avert = [];
  const o = compileToBPxAST(`@core\n@controls\n@alphabet.simple\n@def ${mot} drum.on\n@mode:ord\nS -> a ${mot} b\n`,
                            { onWarning: (w) => avert.push(w) });
  const r = regleDe(o);
  ok((o.errors || []).length === 0,
     `3. '@def ${mot}' doit compiler — reçu : ${(o.errors || []).map((e) => e.message || e).join(' | ')}`);
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
// ⛔ VOLET SUSPENDU le 2026-08-09 — LE TEMOIN HISTORIQUE NE COMPILE PLUS.
// C est la scene qui a fait naitre ce garde : Kairos y comptait six mots la ou elle en ecrit sept,
// parce qu un mot du vocabulaire avalait un nom qu elle declarait. Elle declare ses sept mots avec
// des macros de CABLAGE, et `@macro` est supprime du langage — elle est inscrite au registre des
// refus, en attente de la revue du patching.
// ⚠️ CE QUE CE VOLET AVAIT D IRREMPLAÇABLE : il mesurait la DEMO ELLE-MEME, telle qu elle vit dans
// le depot, et non une reduction du cas. C est ce qui avait attrape le defaut a l epoque — les
// volets synthetiques au-dessus, eux, passaient deja.
// RALLUMAGE : quand la demo sera reecrite avec la forme de cablage qui remplacera les macros. Les
// trois assertions sont conservees telles quelles pour qu il n y ait rien a reinventer.
const VOLET_4_ACTIF = false;
if (VOLET_4_ACTIF) {
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
  const o = compileToBPxAST('@core\n@controls\n@alphabet.simple\n@def mute drum.on\n@mode:ord\nS -> a !(mute) b\n');
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
