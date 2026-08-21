#!/usr/bin/env node
/**
 * GARDE — un contrôle DIT sa graphie native, ou n'en a aucune. Jamais rien entre les deux.
 *
 * CE QUI PASSAIT, ET C'EST LE FRONTAL BP3 QUI L'A VU (message du 2026-08-13). `pan` existait comme
 * clé d'autorité mais SANS champ `bp3`, alors que `panfixed`, `panstep` et `pancont` le portaient
 * tous les trois : la famille était déclarée sauf son mot de base. Vingt occurrences de `_pan` dans
 * le corpus natif restaient hors de portée du frontal, dont un témoin que Kairos attendait.
 *
 * POURQUOI LE SILENCE NE SE VOYAIT PAS. Le chargeur retombe sur `_<nom>` quand le champ manque, et
 * ce repli est JUSTE pour soixante-trois contrôles et FAUX pour dix-neuf — `wave`, `attack`,
 * `panic`, `cc`, `mode`… n'ont aucun geste natif, et `_wave` n'existe pas. L'absence du champ
 * disait donc DEUX choses opposées selon le contrôle, sans qu'on puisse les distinguer. Un
 * consommateur qui lit le champ ne voit rien ; un consommateur qui suit le repli fabrique une
 * graphie qui n'existe pas.
 *
 * ⚠️ L'AIDE DU MOTEUR EST UN MAUVAIS JUGE, et je m'y suis trompé en écrivant ce garde. `BP3_help.txt`
 * ne documente PAS `_mapfixed`, `_mapstep` ni `_mapcont` — j'en ai conclu une minute que je les
 * avais déclarés à tort. La SOURCE les porte (cinq occurrences chacun) : c'est l'aide qui est
 * incomplète. Le juge est donc la TABLE DES MOTS du moteur, jamais sa documentation.
 *
 * ⚠️ ET J'AI ÉCRIT ICI UNE AFFIRMATION FAUSSE, retirée le 2026-08-13 après réfutation par le frontal
 * BP3, qui l'a rejouée avec un meilleur protocole. J'avais écrit que le binaire ACCEPTE tout mot
 * souligné, `_bidon` compris. C'EST FAUX : le moteur refuse `_bidon` comme `_cresc`, une erreur,
 * code 15. Mon harnais n'avait AUCUN TÉMOIN DE CONTRÔLE — pas de grammaire connue-bonne pour
 * prouver qu'il mesurait quelque chose — et il lisait le mauvais canal : la sortie du moteur va
 * dans le fichier `-o`, pas dans le flux que je filtrais. Il rendait donc « aucune erreur » pour
 * TOUT, y compris pour les mots valides. Rejoué avec un témoin nu qui passe et la sortie lue au bon
 * endroit : `_bidon` et `_cresc` rougissent, `_step`, `_fixed`, `_value`, `_mapstep` et `_keymap`
 * passent et sont réémis.
 * LA LEÇON EST L'INVERSE DE CELLE QUE J'AVAIS TIRÉE : « ça compile » EST un témoin ici, et c'est un
 * instrument sans témoin de contrôle qui ne prouve rien.
 *
 * LA RÈGLE QUE CE GARDE TIENT : tout contrôle dont la table native porte le geste `_<nom>` le
 * DÉCLARE explicitement. L'absence du champ cesse alors d'être ambiguë — elle ne peut plus dire
 * que « aucun geste natif ».
 *
 * ⚠️ LA PORTÉE S'ÉCRIT AVEC SON COMPLÉMENT, sinon le garde ne tiendrait que les cas déjà connus.
 * `SANS_GESTE_NATIF` énumère nommément les dix-neuf : un contrôle NEUF n'est ni dans cette liste ni
 * porteur d'un champ, donc il rougit, et son auteur doit choisir. C'est ce qui empêche le silence
 * de revenir par la porte suivante. Et le balayage prend les TROIS sections qui déclarent des
 * contrôles — `controls`, `engine`, `subgrammar` — parce que n'en lire qu'une laissait seize mots
 * du moteur hors de toute vérification.
 *
 * INJECTION dans l'ACCUSÉ (un champ retiré, un contrôle neuf muet) et dans le JUGE (la décision
 * rejouée isolée).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
// La porte des gabarits de réglages natifs — l'inventaire des clés que le fichier `-se` accepte.
import { GABARITS } from '../src/transpiler/gabarits-data.js';

// Le bundle que TOUS les consommateurs chargent — la seule assiette qui dise le vocabulaire réel.
const _req = createRequire(import.meta.url);
const _d = _req('../src/transpiler/libs-data.js');
const BUNDLE = _d.LIBS || _d.default || _d;

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const RACINE = new URL('..', import.meta.url).pathname;
const LIB = join(RACINE, 'lib');
const SECTIONS = ['controls', 'engine', 'subgrammar'];

/**
 * ⛔ « AUCUN GESTE NATIF » DISAIT DEUX CHOSES, ET C'EST LE MÊME DÉFAUT QU'IL Y A UN CRAN PLUS HAUT.
 *
 * Ce complément a été écrit contre UNE table : les 83 mots du flux de `StringLists.h`. Il tenait
 * donc « ce mot n'est pas un geste du flux » — vrai pour les trente. Mais il était LU comme « ce mot
 * n'atteint pas le moteur », et c'est faux pour huit d'entre eux : leur cible est une clé du FICHIER
 * DE RÉGLAGES, une autre espèce, que le champ `bp3` ne sait pas dire.
 *
 * MESURÉ LE 2026-08-21, et c'est bp3-engine qui a ouvert la porte : il a lancé le binaire natif sur
 * une grammaire native et changé `EndFadeOut` dans le fichier de réglages. LE RÉGLAGE ARRIVE ET
 * S'ENTEND — 50 messages de contrôle, compte prédit par le code natif et retrouvé à la mesure. Un
 * mot inscrit ici « sans geste natif » désigne donc une cible qui fonctionne.
 *
 * LA DISTINCTION VIT MAINTENANT DANS LA DONNÉE, PAS DANS UNE PROSE. Elle était écrite en commentaire
 * quelques lignes plus bas — « `rate` et `fadeout` sont des PRÉFÉRENCES du moteur (SamplingRate,
 * EndFadeOut) » — donc vraie, mesurée, et ILLISIBLE pour tout ce qui n'est pas un humain. Le volet 5
 * la confronte au gabarit de réglages publié : une cible inventée rougit.
 */
const CIBLE_DE_REGLAGE = new Map([
  // le mot            la clé du fichier de réglages natif      ce que le mot en dit
  ['fadeout', 'EndFadeOut'],            // la durée, en secondes
  ['rate', 'SamplingRate'],             // la cadence commune des cinq flux continus
  // ⚠️ QUATRE PAIRES, ET LES DEUX MOTS D'UNE PAIRE VISENT LA MÊME CLÉ AVEC LA VALEUR INVERSE. Un
  // champ qui ne porterait que le NOM de la cible ne suffirait donc pas à ces huit-là : `letring`
  // n'est pas « une autre cible », c'est `ResetNotes` à 0. La cible ET la valeur font le geste.
  ['resetnotes', 'ResetNotes'],         ['letring', 'ResetNotes'],
  ['resetcontrols', 'ResetControllers'], ['keepcontrols', 'ResetControllers'],
  ['strikeagain', 'StrikeAgainDefault'], ['sustain', 'StrikeAgainDefault'],
]);

/**
 * LE COMPLÉMENT — les contrôles qui n'ont AUCUN geste natif dans le FLUX, nommés un par un.
 * Mesuré le 2026-08-13 contre la table des mots du moteur (83 entrées). Ce sont des contrôles de
 * sortie audio, de dérivation BPScript, ou des gestes que le natif écrit autrement (`cc` passe par
 * `_control`, `panic` par une extinction générale).
 *
 * ⚠️ HUIT D'ENTRE EUX VISENT UNE CLÉ DE RÉGLAGE et sont repris de `CIBLE_DE_REGLAGE` ci-dessus : ils
 * restent inscrits ici — le volet 1 juge bien l'absence du champ `bp3`, qui ne porte que le flux —
 * mais ce qu'ils atteignent est désormais écrit.
 */
const SANS_GESTE_NATIF = new Set([
  ...CIBLE_DE_REGLAGE.keys(),
  'wave', 'attack', 'release', 'detune', 'filter', 'filterQ',   // sortie audio
  'mode', 'scan', 'weight', 'on_fail', 'meter',                 // dérivation BPScript
  'offvel', 'pressure', 'mute', 'unmute', 'panic', 'sync', 'cc', // MIDI, gestes écrits autrement
  'scaleshift',                                                  // transposition, calcul BPScript
  // ⚠️ `transpose` EST LE CAS QUI M'A REPRIS, et il vaut d'être nommé ici. Le mot `_transpose`
  // existe bien dans la table, et j'en avais conclu que la clé `transpose` en était l'image. C'est
  // FAUX : `chromashift` porte ce geste, et `transpose` — qui s'écrit en centièmes — n'a aucun
  // équivalent natif. Mesuré par un garde voisin (`un_geste_natif_ne_se_declare_qu_une_fois`) : en
  // intonation juste sur do4, `chromashift:4` rend 330,000 Hz et `transpose:400c` 332,619 Hz.
  // LA LEÇON : un mot présent dans la table ne dit pas QUELLE clé en est l'image. L'état ne dit
  // jamais l'intention, et un nom voisin ne vaut pas équivalence.
  'transpose',
  // ── LES NEUF PRIMITIVES MIDI ENTRÉES LE 2026-08-15, mesurées sur la table AVANT d'être écrites
  // ici. Aucune des neuf n'apparaît dans les 83 entrées de `StringLists.h` — et leurs deux frères de
  // la même livraison, `volumecontrol` et `pancontrol`, Y SONT et déclarent donc leur graphie. C'est
  // cette DIFFÉRENCE à l'intérieur d'un même lot qui prouve que la liste est mesurée, pas décidée en
  // bloc. SEPT D'ENTRE ELLES SONT REMONTÉES DANS `CIBLE_DE_REGLAGE` : elles atteignent le moteur par
  // le fichier de réglages, et le dire ici « sans geste natif » ne le disait qu'à moitié.
  //
  // ⚠️ CES DEUX-CI RESTENT SANS CIBLE ÉCRITE, ET C'EST UNE MESURE, PAS UN OUBLI. Le fichier de
  // réglages ne porte aucune clé de pédale : `ResetNotes` dit « Send AllNotesOff, PEDALS OFF and
  // reset pitchbend at the end of item ». La pédale voyage donc DANS une clé qui en porte trois,
  // et lui attribuer `ResetNotes` ferait de `pedalhold` le contraire de `resetnotes`, ce qu'il
  // n'est pas. Reporté à Romain, non tranché ici.
  'pedalrelease', 'pedalhold',
]);

/**
 * LES INTERFACES — un mot générique n'a PAS de geste natif, et ce n'est pas une exception : c'est
 * sa définition. `expression.volume` est le mot que l'auteur écrit ; le geste natif `_volume` est
 * porté par sa RÉALISATION, `midi.volume`, qui le déclare. Le lui faire déclarer aussi ferait deux
 * clés pour un seul geste natif — ce qu'un garde voisin refuse, à raison.
 *
 * ⚠️ ET CE N'EST PAS UNE INSCRIPTION DANS LA LISTE CI-DESSUS. Y mettre `volume` affirmerait que le
 * mot n'a AUCUN geste natif, ce qui est faux : il en a un, ailleurs. La propriété se lit dans la
 * donnée — être la cible d'un `implements` — et non dans une liste tenue à la main.
 */
const INTERFACES = new Set();
for (const lib of Object.values(BUNDLE)) {
  for (const section of ['controls', 'engine', 'subgrammar']) {
    for (const def of Object.values((lib && lib[section]) || {})) {
      if (def && typeof def === 'object' && typeof def.implements === 'string') {
        INTERFACES.add(def.implements.slice(def.implements.indexOf('.') + 1));
      }
    }
  }
}

// ─── 0. SOCLE — refuser de conclure sur du vide ──────────────────────────────────────────────
// ⛔ CE GARDE LIT LE BUNDLE, PAS LES FICHIERS DU DISQUE — corrigé le 2026-08-13, et c'est la
// conversion des librairies en BPScript qui l'a démasqué : il balayait `lib/*.json`, donc le jour
// où quatre librairies sont passées en `.bps` il a vu son assiette fondre de 79 contrôles à 23 et
// s'est arrêté sur son propre socle. Il a bien fait de s'arrêter — mais il aurait pu, avec un
// seuil moins exigeant, continuer en silence sur un tiers du vocabulaire.
// C'EST MA PROPRE RÈGLE QU'IL ENFREIGNAIT : `src/transpiler/libs-data.js` est ce que TOUS les
// consommateurs chargent ; un garde qui lit la source du disque mesure autre chose que ce qui part
// chez les voisins. La source a deux graphies, le bundle une seule — et c'est le bundle qui fait foi.
const controles = [];
for (const [nomLib, j] of Object.entries(BUNDLE)) {
  const f = `${nomLib}.lib`;
  for (const section of SECTIONS) {
    const c = j[section];
    if (!c || typeof c !== 'object') continue;
    for (const [nom, def] of Object.entries(c)) {
      if (nom.startsWith('_') || !def || typeof def !== 'object') continue;
      controles.push({ nom, def, ou: `${f}/${section}` });
    }
  }
}
ok(controles.length >= 75,
   `0. SOCLE : ${controles.length} contrôle(s) lus dans lib/ — sous ce seuil le balayage ne mesure rien`);
ok(controles.some((c) => c.ou.endsWith('/engine')),
   '0. SOCLE : la section `engine` doit être balayée — ne lire que `controls` laissait seize mots '
   + 'du moteur hors de toute vérification');

// ─── 1. LA RÈGLE — chaque contrôle tranche, aucun ne se tait ─────────────────────────────────
// ⚠️ UNE INTERFACE EST EXEMPTÉE, ET LE VOLET 1bis TIENT SA CONTREPARTIE : elle ne peut pas se
// taire ET n'avoir aucune réalisation qui parle. Sans ce second volet, l'exemption serait une
// porte ouverte — il suffirait de se déclarer interface pour n'avoir plus rien à dire.
const interfacesVues = [];
for (const { nom, def, ou } of controles) {
  const dit = typeof def.bp3 === 'string' && def.bp3.length > 0;
  const sans = SANS_GESTE_NATIF.has(nom);
  if (INTERFACES.has(nom) && !dit) { interfacesVues.push(nom); continue; }
  ok(dit !== sans,
     dit && sans
       ? `1. '${nom}' (${ou}) déclare la graphie native '${def.bp3}' ET figure parmi les contrôles `
         + 'sans geste natif — les deux ne peuvent pas être vrais'
       : `1. '${nom}' (${ou}) ne dit RIEN : ni graphie native déclarée, ni inscription parmi les `
         + `contrôles qui n'en ont pas. Le chargeur retombera sur '_${nom}', et ce repli est juste `
         + 'pour les uns et faux pour les autres — le lecteur ne peut pas les séparer.');
}

// ─── 1bis. UNE INTERFACE MUETTE A UNE RÉALISATION QUI PARLE ──────────────────────────────────
// La contrepartie de l'exemption. Une interface ne dit pas le geste natif ; au moins une de ses
// réalisations doit le dire, sinon le geste n'est déclaré NULLE PART et l'exemption a servi à
// cacher exactement ce que ce garde existe pour empêcher.
for (const nom of interfacesVues) {
  const realisations = [];
  for (const [nomLib, lib] of Object.entries(BUNDLE)) {
    for (const section of SECTIONS) {
      const def = (lib && lib[section] || {})[nom];
      if (def && typeof def.implements === 'string') realisations.push({ nomLib, def });
    }
  }
  ok(realisations.length > 0,
     `1bis. '${nom}' est exempté comme INTERFACE mais rien ne le réalise — l'exemption ne tient que `
     + 'par ses réalisations');
  ok(realisations.some((r) => typeof r.def.bp3 === 'string' && r.def.bp3.length > 0)
     || SANS_GESTE_NATIF.has(nom),
     `1bis. aucune réalisation de '${nom}' ne déclare de graphie native, et le mot ne figure pas `
     + `parmi ceux qui n'en ont pas — le geste natif ne serait déclaré nulle part`);
}

// ─── 2. LA GRAPHIE DÉCLARÉE A LA FORME D'UNE GRAPHIE NATIVE ──────────────────────────────────
// Un champ posé au hasard serait pire que pas de champ : il ferait AUTORITÉ.
for (const { nom, def, ou } of controles) {
  if (typeof def.bp3 !== 'string') continue;
  ok(/^_[A-Za-z][A-Za-z0-9]*$/.test(def.bp3),
     `2. '${nom}' (${ou}) : la graphie native s'écrit '_' suivi d'un nom — reçu '${def.bp3}'`);
}

// ─── 3. CONTRE-ÉPREUVE SUR LA TABLE DES MOTS DU MOTEUR ───────────────────────────────────────
// ⚠️ UN GARDE QUI SE SAUTE EN SILENCE EST UN MENSONGE : si la table n'est pas atteignable, le
// volet le DIT au lieu de passer au vert sans avoir rien lu. Les volets 1 et 2 restent tenus par
// le complément écrit ici, qui ne dépend d'aucun dépôt voisin.
{
  const TABLE = '/home/romi/dev/bp/bp3-engine/source/not_used/StringLists.h';
  if (!existsSync(TABLE)) {
    console.log('[graphie native] ⚠️  table des mots du moteur introuvable — volet 3 NON MESURÉ.');
  } else {
    const mots = new Set(
      [...readFileSync(TABLE, 'utf8').matchAll(/"\d+ \d+ (_\w+)"/g)].map((m) => m[1]));
    // TÉMOINS D'INSTRUMENT, dans les deux sens. Sans eux, une table illisible rendrait « aucun mot »
    // partout et le volet confirmerait exactement ce qu'il devait contredire.
    ok(mots.size >= 70, `3. TÉMOIN : la table doit porter au moins 70 mots — lue ${mots.size}`);
    ok(mots.has('_pan') && mots.has('_mapstep'),
       "3. TÉMOIN : la table doit porter '_pan' et '_mapstep' — sinon c'est l'instrument qui ment");
    ok(!mots.has('_bidon'),
       "3. TÉMOIN : un mot inventé ne doit PAS s'y trouver — sans quoi la table dirait oui à tout");
    for (const { nom, def } of controles) {
      const natif = mots.has(`_${nom}`);
      if (typeof def.bp3 === 'string') {
        ok(mots.has(def.bp3),
           `3. '${nom}' déclare la graphie '${def.bp3}', absente de la table des mots du moteur — `
           + 'une graphie inventée fait autorité chez tous mes lecteurs');
      } else {
        // ⚠️ « LA TABLE NE PORTE PAS `_<nom>` » N'EST PAS LA SEULE FAÇON DE N'AVOIR AUCUN GESTE :
        // le mot peut exister et appartenir à une AUTRE clé. `_transpose` est dans la table, et
        // c'est `chromashift` qui en est l'image, pas `transpose`. Sans cette seconde branche, le
        // volet exigeait de `transpose` qu'il revendique un geste qu'un garde voisin lui interdit.
        const prisParUneAutre = controles.some((c) => c.def.bp3 === `_${nom}`);
        ok(!natif || prisParUneAutre,
           `3. '${nom}' est inscrit sans geste natif, la table porte '_${nom}', et AUCUNE autre clé `
           + "ne le revendique — le complément est faux, et un contrôle atteignable reste hors de "
           + 'portée du frontal');
      }
    }
  }
}

// ─── 5. UNE CIBLE DE RÉGLAGE EST UNE CLÉ QUI EXISTE ──────────────────────────────────────────
// Le volet 3 confronte les gestes du flux à la table des mots du moteur. Les cibles de RÉGLAGE
// n'y sont pas — elles vivent dans le fichier `-se`, dont je publie le gabarit. Sans ce volet,
// `CIBLE_DE_REGLAGE` serait une prose de plus : nommer `EndFadOut` d'une lettre en moins ferait
// autorité chez tous mes lecteurs sans que rien ne rougisse.
{
  const gabarit = GABARITS['bp3-settings-template'] || {};
  const cles = new Set(Object.keys(gabarit));
  // TÉMOINS D'INSTRUMENT, dans les deux sens : un gabarit illisible rendrait « aucune clé » et le
  // volet accuserait les huit cibles justes.
  ok(cles.size >= 60, `5. TÉMOIN : le gabarit doit porter au moins 60 clés — lues ${cles.size}`);
  ok(cles.has('EndFadeOut') && cles.has('SamplingRate'),
     "5. TÉMOIN : le gabarit doit porter 'EndFadeOut' et 'SamplingRate' — sinon l'instrument ment");
  ok(!cles.has('EndFadOut'),
     '5. TÉMOIN : une clé approchante ne doit PAS y être — sans quoi le gabarit dirait oui à tout');
  ok(CIBLE_DE_REGLAGE.size >= 8,
     `5. TÉMOIN : ${CIBLE_DE_REGLAGE.size} cible(s) de réglage écrites — sous 8, la table a fondu`);

  const parNom = new Map(controles.map((c) => [c.nom, c]));
  for (const [nom, cle] of CIBLE_DE_REGLAGE) {
    ok(cles.has(cle),
       `5. '${nom}' vise le réglage natif '${cle}', absent du gabarit publié — une clé inventée fait `
       + 'autorité chez tous mes lecteurs, et le fichier de réglages l\'ignorerait en silence');
    // ET LE MOT DOIT EXISTER : une cible écrite pour un contrôle retiré est une ligne morte qui
    // continue d'affirmer quelque chose. Même raison que le registre des retraits assumés.
    ok(parNom.has(nom),
       `5. '${nom}' porte une cible de réglage mais n'est plus déclaré dans aucune librairie — `
       + 'RETIRER la ligne. Un registre qui garde des entrées mortes finit par ne plus rien dire.');
    // ET IL NE DÉCLARE PAS AUSSI UN GESTE DU FLUX : les deux espèces de cible ne se cumulent pas
    // sans que quelqu'un ait tranché laquelle gagne, et personne ne l'a tranché.
    const def = parNom.get(nom) && parNom.get(nom).def;
    ok(!def || typeof def.bp3 !== 'string',
       `5. '${nom}' déclare À LA FOIS un geste du flux ('${def && def.bp3}') et une cible de réglage `
       + `('${cle}') — rien ne dit laquelle l'emporte, et un consommateur choisira pour moi`);
  }
}

// ─── 4. INJECTION DANS LE JUGE — la décision rejouée isolée ──────────────────────────────────
const juge = (bp3, sans) => (typeof bp3 === 'string' && bp3.length > 0) !== sans;
ok(juge('_pan', false), '4. (se tait) une graphie déclarée hors de la liste est conforme');
ok(juge(undefined, true), '4. (se tait) un contrôle sans geste natif, inscrit, est conforme');
ok(!juge(undefined, false), '4. (mord) un contrôle muet et non inscrit doit rougir');
ok(!juge('_wave', true), '4. (mord) déclarer une graphie ET être inscrit sans geste doit rougir');

if (echecs.length) {
  console.error(`❌ un contrôle ne dit pas sa graphie native : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ chaque contrôle dit sa graphie native, ou n'en a aucune — ${passe} vérification(s) passée(s)`);
}
