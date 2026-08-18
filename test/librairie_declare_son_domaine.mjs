#!/usr/bin/env node
/**
 * GARDE — toute librairie que le corpus INVOQUE déclare son DESTINATAIRE (`resolvedBy`) DEDANS.
 *
 * ⚠️ CHAMP RENOMMÉ le 2026-08-10 (mise en conformité des librairies, Romain) : `domain` ET
 * `runtime` deviennent OBSOLÈTES, remplacés par `resolvedBy` — un champ qui nomme DIRECTEMENT
 * l'outil destinataire (`BPx`, `Kairos`, `Kronos`, `runtime-MIDI`, `runtime-audio`, `Dédale`,
 * `runtime-codevoices`, `toutes les sorties`), plutôt qu'un axe de catalogue (`domain`) que
 * personne ne consommait en dehors de ce garde. Ce fichier gardait `domain` (décision Romain
 * 2026-07-13, `hub ef75ec6`, `decisions/2026-07-13-invocation-librairies-factory-mine.md`) ; il
 * garde `resolvedBy` désormais, MÊME PRINCIPE : une librairie invoquée sans destinataire déclaré
 * est un trou identique à celui d'origine — l'aval ne sait plus où ranger ce qu'elle rend.
 *
 * SIGNALÉ par Kairos le 2026-07-27 : `lib/homomorphism.json` ne déclarait pas son domaine à
 * l'époque. La scène `transposition1.bps` l'invoque, le fichier existe, l'hôte le fournissait — et
 * Kairos refusait bruyamment de résoudre. Il avait raison : il n'invente pas le destinataire d'une
 * librairie qui ne lui appartient pas. Son banc d'iso sur les 75 notes de cette scène était
 * suspendu là-dessus.
 *
 * POURQUOI CE GARDE MESURE SUR LE CORPUS, et pas sur une liste de fichiers. Le trou n'est pas
 * « homomorphism.json manque un champ », c'est « une librairie peut être invoquée sans qu'on
 * sache qui la résout ». Le garde part donc des adresses que les scènes PRODUISENT vraiment : il
 * attrape le jour où une scène invoque un fichier sans destinataire, quel qu'il soit. Écrire la
 * liste à la main aurait gardé le fichier du ticket, pas la construction.
 *
 * ⚠️ CE QU'IL NE COUVRE PAS ENCORE, et c'est mesuré, pas oublié : SIX fichiers du bundle restent
 * invocables sans `resolvedBy` — `core`, `language`, `mapping`, `mod`, `sub`,
 * `bp3-settings-template`. `core` ne déclare aucun domaine par nature (atlas/architecture/
 * LIBRAIRIES.md : « core ne déclare aucun domaine : il invoque les librairies du socle et porte
 * les défauts ») — il n'est pas une librairie au sens de la table de découpage. `language` est le
 * schéma machine du COMPILATEUR (BPScript lui-même), pas résolu par un des outils aval nommés.
 * `mapping` et `mod` ont un contenu réel mais AUCUNE source mesurée ne nomme leur résolveur — cf.
 * leur `_resolvedBy_doc` respectif, signalé à Romain.
 *
 * `sub` (Romain, 2026-08-10) : SES 14 TABLES SONT VIVANTES — j'avais conclu « mort » sur une
 * mesure incomplète (qui charge le FICHIER dans le code), sans voir que le lien passe par le NOM
 * DES TABLES, référencées par les grammaires BP3 natives (12/14 tables ont un `-gr.*` ou `-da.*`
 * qui les nomme dans bp3-engine/test-data/) et par les scènes équivalentes. Romain l'a restauré ;
 * mesure détaillée par table dans le rapport à l'architecte du 2026-08-10 (repris ici : 4 noms
 * (`checkhomo`, `dhati`, `transposition`, `tryhomomorphism`) existent aussi dans `homomorphism.json`
 * avec un CONTENU DIFFÉRENT — collision signalée, pas tranchée).
 *
 * `bp3-settings-template` (Romain, 2026-08-10) : restauré après lecture de
 * `hub/constats/2026-08-04-collisions-de-vocabulaire.md:1152-1158`, qui le traite comme un
 * artefact INTENTIONNEL (le gabarit vide des réglages, à côté de `settings.json` qui les traduit)
 * et propose un RENOMMAGE (`lib/settings.defaults.json`), jamais une suppression. Aucun lecteur de
 * code mesuré à ce jour dans BPscript, BPx, Kairos, Kanopi ni bp3-frontend — mais l'absence de
 * lecteur ne vaut pas mort : cf. `sub`, ci-dessus, même erreur évitée deux fois de suite.
 * `controls.json` (Romain, 2026-08-10) : SUPPRIMÉ, pas simplement signalé. Il violait la règle
 * « une librairie, un destinataire » (elle en servait cinq, par sous-groupe) ; ses quatre
 * destinations (`expression`, `midi`, `audio`, `transpo`) vivent depuis dans des fichiers séparés,
 * amenées par `core.apporte`. Toute scène qui écrivait `@controls` NU écrit désormais `@core` NU —
 * les deux amènent le même ensemble, `@controls` n'était qu'un stub de compatibilité vers lui.
 */
// ⚠️ `transcription` est REMPLACÉE par `homomorphism` (Romain, 2026-08-07, « oui on renomme ») :
// la bible n'a jamais écrit que `homomorphism.<table>`. Les tables ont rejoint
// `lib/homomorphism.json` (clé `tables`), `lib/transcription.json` est SUPPRIMÉ, et les 13 scènes
// de l'écosystème qui écrivaient l'ancien mot sont migrées. Ce garde suit le mot vivant.
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';
import { fichierDeLAxe } from '../src/transpiler/libs.js';
import { nomsBps, lireBps, exigerCorpus } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

// ─── 1. SOCLE — le cas signalé, nommément ────────────────────────────────────────────────────
// Ancré à part : le garde du corpus ci-dessous rétrécit avec le corpus, celui-ci non.
ok(LIBS.homomorphism?.resolvedBy === 'Kairos',
   `1. lib/homomorphism.json doit déclarer son destinataire — reçu : ${JSON.stringify(LIBS.homomorphism?.resolvedBy)}`);
{
  const o = compileToBPxAST('core\nalphabet.western:midi\nhomomorphism.transposition\nmode:ord\n-----\nS -> C4\n');
  ok((o.errors || []).length === 0,
     `1. la scène qui invoque la table de transposition doit compiler — reçu : ${(o.errors || []).map((e) => e.message || e).join(' | ')}`);
  ok((o.ast?.libRefs || []).includes('homomorphism.transposition'),
     "1. et l'adresse doit sortir — c'est elle que l'aval range par destinataire");
}

// ─── 2. TOUTES les librairies que le corpus invoque déclarent leur destinataire ──────────────
exigerCorpus();
const invoquees = new Map(); // fichier → scènes qui l'invoquent
let scenes = 0;
for (const nom of nomsBps()) {
  let o;
  try { o = compileToBPxAST(lireBps(nom)); } catch { continue; }
  if ((o.errors || []).length > 0) continue;
  scenes++;
  for (const adresse of (o.ast?.libRefs || [])) {
    // L'adresse porte l'AXE, la donnée vit sous le nom du FICHIER : `sound.tabla_perc` habite
    // `sounds.json`. Le passage se fait par la table du chargeur, jamais par une copie ici.
    // ⛔ LA PROVENANCE SE LIT AVANT LE FICHIER — corrigé le 2026-08-09, sur la mesure de kairos.
    // `factory` désigne le catalogue LIVRÉ, `mine` la librairie PERSONNELLE injectée par l'hôte au
    // moment de résoudre. Une adresse `mine.…` n'a donc RIEN à faire dans le bundle : son absence
    // en est la DÉFINITION, pas un défaut.
    // ⚠️ CETTE GARDE EXIGEAIT LA PRÉSENCE DANS LE BUNDLE SANS DISTINGUER D'OÙ VENAIT L'ADRESSE —
    // juste pour `factory`, FAUSSE pour `mine`. Six scènes de kairos la faisaient rougir, et je lui
    // avais demandé de choisir entre deux branches qui étaient toutes deux dans MA prémisse.
    // ⚠️ ET LE PIÈGE QU'IL A NOMMÉ : `mine` et `factory` peuvent porter le MÊME nom d'entrée — un
    // alphabet personnel homonyme du catalogue, avec une ancre différente, c'est exactement ce que
    // son banc éprouve. Le critère est donc la PROVENANCE de l'adresse, JAMAIS le nom du fichier :
    // une garde qui regarderait le nom verdirait sur la collision au lieu de la voir.
    const segments = String(adresse).split('.');
    if (segments[0] === 'mine') continue;          // injectée par l'hôte, absente du bundle par construction
    const fichier = fichierDeLAxe(segments[0] === 'factory' ? segments[1] : segments[0]);
    if (!invoquees.has(fichier)) invoquees.set(fichier, []);
    invoquees.get(fichier).push(nom);
  }
}
ok(scenes > 40, `2. le corpus doit fournir de quoi mesurer — ${scenes} scène(s) compilée(s)`);
ok(invoquees.size > 0, '2. le corpus doit invoquer au moins une librairie — sinon ce garde est creux');

// Les exceptions, écrites ici et pas cachées dans une condition — cf. l'en-tête. `settings` est
// SORTIE de cette liste le 2026-08-10 : la question tranchée le 2026-07-27 portait sur `domain`
// (catalogue d'entités invocables), et `settings.json` déclare bien un destinataire (BPx) sans
// pour autant redevenir un catalogue — les deux questions sont orthogonales. Restent en attente
// d'une décision de Romain (aucune source mesurée ne nomme leur résolveur, cf. leur propre
// `_resolvedBy_doc`, ou fichiers orphelins sans consommateur).
const SANS_RESOLVEDBY_SIGNALE = new Set(['core', 'language', 'mapping', 'mod', 'sub', 'bp3-settings-template']);
ok(SANS_RESOLVEDBY_SIGNALE.size === 6,
   `2. six exceptions sont tolérées, et elles sont nommées — reçu ${SANS_RESOLVEDBY_SIGNALE.size}`);

for (const [fichier, portees] of [...invoquees].sort()) {
  const lib = LIBS[fichier];
  if (SANS_RESOLVEDBY_SIGNALE.has(fichier)) continue;   // question ouverte, signalée à Romain
  ok(lib !== undefined,
     `2. la librairie '${fichier}' invoquée par ${portees[0]} doit exister dans le bundle`);
  ok(lib?.resolvedBy !== undefined && lib?.resolvedBy !== null && lib?.resolvedBy !== '',
     `2. la librairie '${fichier}' est invoquée par ${portees.length} scène(s) (dont ${portees[0]}) `
     + `et NE DÉCLARE PAS son destinataire — l'aval ne peut pas savoir qui la résout `
     + `(décision Romain 2026-08-10, remplace 2026-07-13)`);
}

// ─── 3. LA RÈGLE DE ROMAIN (2026-08-13) — QUI PORTE DES CONTRÔLES DÉCLARE SON DESTINATAIRE ──
// « Les librairies qui déclarent leur destinataire doivent être toutes celles qui contiennent des
// contrôles ; core est une librairie qui normalement n'embarque que des valeurs par défaut et des
// appels à d'autres librairies, donc normal pour lui. »
//
// ⚠️ CE VOLET NE RECOUVRE PAS LE PRÉCÉDENT, et c'est pour ça qu'il existe. Le volet 2 mesure les
// librairies qu'une SCÈNE invoque : une librairie de contrôles n'est jamais invoquée par son nom —
// elle arrive par la chaîne `apporte` de `core` — donc aucune des sept n'y passait. Une huitième
// pouvait naître sans destinataire sans que rien ne rougisse, et ses contrôles seraient arrivés en
// aval sans qu'on sache qui les résout.
//
// LA PORTÉE S'ÉCRIT AVEC SON COMPLÉMENT : les librairies SANS contrôles sont comptées, pour qu'un
// fichier qui en gagne un soit forcé de trancher au lieu de glisser dans l'exception.
{
  const SECTIONS_DE_CONTROLES = ['controls', 'engine', 'subgrammar'];
  const compteDeControles = (lib) => SECTIONS_DE_CONTROLES.reduce((n, sec) => {
    const c = lib && lib[sec];
    return n + (c && typeof c === 'object'
      ? Object.keys(c).filter((k) => !k.startsWith('_')).length : 0);
  }, 0);

  let avecControles = 0;
  let sansControles = 0;
  for (const [nom, lib] of Object.entries(LIBS)) {
    if (!lib || typeof lib !== 'object') continue;
    const n = compteDeControles(lib);
    if (n === 0) { sansControles++; continue; }
    avecControles++;
    ok(typeof lib.resolvedBy === 'string' && lib.resolvedBy.length > 0,
       `3. '${nom}' déclare ${n} contrôle(s) et NE NOMME PAS son destinataire — ses réglages `
       + `arriveraient en aval sans qu'on sache qui les résout, et aucune exception ne couvre une `
       + `librairie de contrôles (règle Romain 2026-08-13)`);
  }
  // TÉMOINS D'INSTRUMENT, dans les deux sens : un balayage qui ne verrait aucune librairie de
  // contrôles passerait au vert en ne mesurant rien, et un balayage qui les verrait TOUTES
  // signalerait que le critère ne discrimine pas.
  ok(avecControles >= 5,
     `3. TÉMOIN : au moins cinq librairies portent des contrôles — vu ${avecControles}`);
  ok(sansControles > 0,
     `3. TÉMOIN : des librairies SANS contrôle doivent exister — sinon le critère ne discrimine `
     + `rien (vu ${sansControles})`);
  ok(compteDeControles(LIBS.core) === 0,
     "3. TÉMOIN NOMMÉ PAR ROMAIN : `core` n'embarque que des valeurs par défaut et des appels à "
     + "d'autres librairies — s'il portait un contrôle, l'exception qui le couvre serait fausse");
}

if (echecs.length) {
  console.error(`❌ destinataire des librairies : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ toute librairie invoquée déclare son destinataire — ${passe} vérification(s) passée(s) `
            + `sur ${invoquees.size} librairie(s) invoquée(s) par ${scenes} scène(s)`);
}
