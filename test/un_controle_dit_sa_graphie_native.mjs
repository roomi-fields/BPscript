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
import '../src/transpiler/index.js';   // la porte : elle branche le compilateur sur son chargeur (2026-09-02)
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
/**
 * LE COMPLÉMENT — les contrôles qui n'ont AUCUNE image dans le moteur, nommés un par un.
 * Mesuré le 2026-08-13 contre la table des mots du flux (83 entrées), et de nouveau le 2026-08-21
 * contre le gabarit de réglages (64 clés). Ce sont des contrôles de sortie audio, de dérivation
 * BPScript, ou des gestes que le natif écrit autrement (`cc` passe par `_control`, `panic` par une
 * extinction générale).
 *
 * ⚠️ HUIT L'ONT QUITTÉ LE 2026-08-21 — `fadeout`, `rate`, et les six mots des trois paires de fin et
 * de relance. Ils déclarent maintenant leur image, qui est une clé de RÉGLAGE. Ils étaient inscrits
 * ici parce que le garde n'avait été écrit que contre UNE table : il tenait « ce mot n'est pas un
 * geste du flux », vrai, et il était lu « ce mot n'atteint pas le moteur », faux.
 */
const SANS_GESTE_NATIF = new Set([
  'wave', 'attack', 'release', 'detune', 'filter', 'filterQ',   // sortie audio
  'mode', 'scan', 'weight', 'on_fail', 'meter',                 // dérivation BPScript
  // Les neuf réglages de tête de scène, contrôles depuis le 2026-09-02 (Romain : « le rangement ne
  // type pas »). Ce sont des RÉGLAGES du moteur natif (Seed, MaxItemsProduce, AllItems, Improvize,
  // Quantization, Qclock), pas des procédures `_xxx` : aucun nom natif n'est déclaré tant qu'il
  // n'est pas mesuré, et le frontal BP3 les lit par son chemin dédié, comme `mode` et `weight`.
  'seed', 'maxitems', 'items', 'allitems', 'all_items', 'improvize', 'quantization', 'qclock', 'timepatterns',
  // `pressure` est SORTI de cette liste le 2026-09-02 : il porte `_press` depuis que l'alias `press` a quitté `midi`.
  'offvel', 'mute', 'unmute', 'panic', 'sync', 'cc', // MIDI, gestes écrits autrement
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

// ─── 2. LA GRAPHIE DÉCLARÉE EST UN NOM, ET LE MOTEUR LA PORTE ────────────────────────────────
// ⛔ LA FORME `_` + NOM A ÉTÉ RELÂCHÉE — Romain, 2026-08-21. Elle n'était pas une règle du langage :
// c'était l'empreinte de la SEULE table contre laquelle ce garde avait été écrit. Romain rappelle
// que lier un mot BPScript sans tiret bas à une commande native qui en porte un est résolu depuis
// toujours — `def chan (bp3:_chan, …)`. LE CHAMP PORTE LE NOM NATIF, QUEL QU'IL SOIT : `_chan` comme
// `MIDIsyncDelay`. Il n'y a pas deux espèces de cible, il y a un moteur et deux lieux d'écriture.
// Ce qui reste tenu ici est ce qui protégeait vraiment : un nom bien formé, jamais du vide ni une
// phrase. Ce que le moteur porte réellement se prouve aux volets 3 et 5, contre ses deux tables.
for (const { nom, def, ou } of controles) {
  if (typeof def.bp3 !== 'string') continue;
  ok(/^[A-Za-z_][A-Za-z0-9_]*$/.test(def.bp3),
     `2. '${nom}' (${ou}) : l'image native est un NOM — reçu '${JSON.stringify(def.bp3)}'`);
}

// ─── 2bis. UNE VALEUR D'IMAGE N'EXISTE QUE POUR UN MOT NU ────────────────────────────────────
// ⛔ `bp3value` porte ce qu'un mot SANS ARGUMENT écrit chez le natif — `letring` est `ResetNotes` à
// zéro. Un mot À ARGUMENT n'en a pas : sa valeur native EST son argument, et en déclarer une
// figerait `fadeout:5` sur un nombre écrit dans la librairie. Les deux ne peuvent pas coexister.
for (const { nom, def, ou } of controles) {
  if (def.bp3value === undefined) continue;
  ok(typeof def.bp3 === 'string' && def.bp3,
     `2bis. '${nom}' (${ou}) porte une VALEUR d'image sans nommer l'image — une valeur sans cible `
     + `n'a nulle part où s'écrire`);
  ok(!Array.isArray(def.args) || def.args.length === 0,
     `2bis. '${nom}' (${ou}) prend un argument (${(def.args || []).join(', ')}) ET déclare une valeur `
     + `d'image (${def.bp3value}) — sa valeur native est son ARGUMENT, la figer ici l'écraserait`);
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
    // ⚠️ CE VOLET NE JUGE QUE LE FLUX, et il jugeait tout. Depuis que l'image peut désigner une clé
    // du FICHIER DE RÉGLAGES, exiger d'elle qu'elle figure dans les mots du flux accuserait les huit
    // mots qui atteignent le moteur par l'autre porte. Le volet 5 juge celles-là, contre le gabarit.
    const reglages = new Set(Object.keys(GABARITS['bp3-settings-template'] || {}));
    ok(reglages.size >= 60, `3. TÉMOIN : le gabarit départage les deux lieux — ${reglages.size} clés`);
    for (const { nom, def } of controles) {
      const natif = mots.has(`_${nom}`);
      if (typeof def.bp3 === 'string') {
        if (reglages.has(def.bp3)) continue;         // image de RÉGLAGE — jugée au volet 5
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

// ─── 5. UNE IMAGE DÉCLARÉE EXISTE DANS L'UN DES DEUX LIEUX D'ÉCRITURE DU MOTEUR ──────────────
// Le moteur s'écrit à deux endroits : le FLUX, dont les mots vivent dans `StringLists.h` (volet 3),
// et le FICHIER DE RÉGLAGES, dont je publie le gabarit. Une image déclarée est dans l'un ou dans
// l'autre. Dans AUCUN des deux, elle est inventée — et une image inventée fait autorité chez tous
// mes lecteurs, ce qui est pire qu'un champ absent.
//
// ⛔ CE VOLET NE TIENT PLUS DE LISTE. Sa première écriture nommait les huit à la main ; la donnée
// les dit maintenant, et un registre tenu à côté de la donnée ne voit jamais le mot qu'on ajoute.
{
  const gabarit = GABARITS['bp3-settings-template'] || {};
  const reglages = new Set(Object.keys(gabarit));
  // TÉMOINS D'INSTRUMENT, dans les deux sens : un gabarit illisible rendrait « aucune clé » et le
  // volet accuserait des images justes.
  ok(reglages.size >= 60, `5. TÉMOIN : le gabarit doit porter au moins 60 clés — lues ${reglages.size}`);
  ok(reglages.has('EndFadeOut') && reglages.has('SamplingRate'),
     "5. TÉMOIN : le gabarit doit porter 'EndFadeOut' et 'SamplingRate' — sinon l'instrument ment");
  ok(!reglages.has('EndFadOut'),
     '5. TÉMOIN : une clé approchante ne doit PAS y être — sans quoi le gabarit dirait oui à tout');

  // La table des mots du flux, relue ici : le volet 3 ne la partage pas, et le juge doit connaître
  // LES DEUX lieux pour ne pas accuser une image qui vit dans l'autre.
  const TABLE = '/home/romi/dev/bp/bp3-engine/source/not_used/StringLists.h';
  const flux = existsSync(TABLE)
    ? new Set([...readFileSync(TABLE, 'utf8').matchAll(/"\d+ \d+ (_\w+)"/g)].map((m) => m[1]))
    : null;

  let declarees = 0, versReglage = 0;
  for (const { nom, def, ou } of controles) {
    if (typeof def.bp3 !== 'string' || !def.bp3) continue;
    declarees++;
    const estReglage = reglages.has(def.bp3);
    if (estReglage) versReglage++;
    // ⚠️ SI LA TABLE DU FLUX EST INATTEIGNABLE, ce volet ne juge que ce qu'il peut : une image
    // absente du gabarit passe, et le volet 3 le DIT déjà à voix haute. Un garde qui se sauterait
    // en silence serait un mensonge ; celui-ci se rétrécit en le disant.
    if (!flux) { ok(true, `5. (table du flux absente) '${nom}' non départagé`); continue; }
    ok(estReglage || flux.has(def.bp3),
       `5. '${nom}' (${ou}) déclare l'image '${def.bp3}', qui n'existe NI dans les mots du flux `
       + `(${flux.size}) NI dans le gabarit de réglages (${reglages.size}) — une image inventée fait `
       + `autorité chez tous mes lecteurs, et les deux lieux d'écriture l'ignoreraient en silence`);
  }
  ok(declarees >= 55,
     `5. TÉMOIN : ${declarees} image(s) déclarée(s) examinée(s) — sous 55, le balayage ne mesure rien`);
  ok(versReglage >= 8,
     `5. ${versReglage} image(s) visent une clé de réglage — sous 8, les mots qui atteignent le `
     + "moteur par le fichier de réglages ont cessé de le dire");
}

// ─── 6. LA TABLE DES IMAGES NE FABRIQUE RIEN ─────────────────────────────────────────────────
// ⛔ CE VOLET EXERCE, IL NE COMPTE PAS. Le chargeur retombait sur `_` + le nom quand l'image
// manquait : trente entrées sur quatre-vingt-treize en recevaient une INVENTÉE, et `_fadeout` ne
// figure ni dans les mots du flux ni dans le gabarit. Le repli a été retiré le 2026-08-21 sur
// décision de Romain — un mot sans image déclarée n'entre plus dans la table.
//
// UN CATALOGUE VIDE ET UN CATALOGUE MORT ONT LA MÊME EMPREINTE : on charge donc les librairies pour
// de vrai et on confronte CHAQUE entrée produite à ce que la donnée déclare. Un repli réintroduit à
// n'importe lequel des trois sites fait apparaître ici une entrée que rien ne déclare.
{
  const { loadLibsFromDirectives } = await import('../src/transpiler/libs.js');
  const dir = (n) => ({ type: 'Directive', name: n, subkey: null });
  const ctx = loadLibsFromDirectives(
    ['midi', 'engine', 'expression', 'audio', 'transpo', 'variation', 'time'].map(dir));
  const table = (ctx && ctx.controlMap) || {};
  const entrees = Object.entries(table);
  ok(entrees.length >= 60,
     `6. TÉMOIN : ${entrees.length} image(s) dans la table chargée — sous 60, le chargement ne rend rien`);

  // Toutes les images que la DONNÉE déclare, où qu'elles vivent dans le bundle.
  const declarees = new Set();
  const descendre = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const x of n) descendre(x); return; }
    if (typeof n.bp3 === 'string' && n.bp3) declarees.add(n.bp3);
    for (const v of Object.values(n)) descendre(v);
  };
  descendre(BUNDLE);
  ok(declarees.size >= 55, `6. TÉMOIN : ${declarees.size} image(s) déclarée(s) dans la donnée`);

  const fabriquees = entrees.filter(([nom, img]) => !declarees.has(img) || img === `_${nom}` && !declarees.has(img));
  ok(fabriquees.length === 0,
     `6. ⛔ ${fabriquees.length} entrée(s) de la table ne viennent d'AUCUNE déclaration : `
     + `${fabriquees.slice(0, 6).map(([n, v]) => `${n}→${v}`).join(', ')}. Le repli qui fabrique est `
     + `revenu — un mot sans image déclarée doit être ABSENT de la table, jamais complété. Un trou se `
     + `verrait ; une invention fait autorité.`);

  // ET LE COMPLÉMENT : les mots légitimement sans image n'y sont pas.
  for (const nom of ['wave', 'attack', 'panic', 'transpose']) {
    ok(table[nom] === undefined,
       `6. '${nom}' n'a aucune image native et ne doit pas figurer dans la table — reçu '${table[nom]}'`);
  }

  // ⛔ ET LE TROISIÈME SITE NE S'ATTEINT QU'AVEC UNE SCÈNE QUI NOMME UN CONTRÔLEUR. Sans cette
  // directive, la branche `cc` n'est jamais parcourue et le balayage ci-dessus ne peut rien en
  // dire — un site jamais atteint et un site correct ont exactement la même empreinte. Un
  // contrôleur que LA SCÈNE nomme n'a par construction aucune image dans le moteur : le nom vient
  // d'être inventé par qui écrit, et `_kick` ne veut rien dire pour le natif.
  const avecCC = loadLibsFromDirectives([
    dir('midi'),
    { type: 'Directive', name: 'cc', subkey: null,
      ccMappings: [{ name: 'zzguardkick', number: 36 }] },
  ]);
  ok(avecCC.controlNames.has('zzguardkick'),
     "6. TÉMOIN : le contrôleur nommé par la scène doit entrer au vocabulaire — sinon la branche "
     + "n'a pas été parcourue et le cas suivant ne prouve rien");
  ok(avecCC.controlMap.zzguardkick === undefined,
     `6. un contrôleur que la SCÈNE nomme n'a aucune image native — reçu `
     + `'${avecCC.controlMap.zzguardkick}'. Le nom vient d'être inventé par qui écrit ; lui `
     + `fabriquer une image la fait passer pour une mesure du moteur.`);
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
