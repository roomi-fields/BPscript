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
 * LE COMPLÉMENT — les contrôles qui n'ont AUCUN geste natif, nommés un par un.
 * Mesuré le 2026-08-13 contre la table des mots du moteur (83 entrées). Ce sont des contrôles de
 * sortie audio, de dérivation BPScript, ou des gestes que le natif écrit autrement (`cc` passe par
 * `_control`, `panic` par une extinction générale).
 */
const SANS_GESTE_NATIF = new Set([
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
]);

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
for (const { nom, def, ou } of controles) {
  const dit = typeof def.bp3 === 'string' && def.bp3.length > 0;
  const sans = SANS_GESTE_NATIF.has(nom);
  ok(dit !== sans,
     dit && sans
       ? `1. '${nom}' (${ou}) déclare la graphie native '${def.bp3}' ET figure parmi les contrôles `
         + 'sans geste natif — les deux ne peuvent pas être vrais'
       : `1. '${nom}' (${ou}) ne dit RIEN : ni graphie native déclarée, ni inscription parmi les `
         + `contrôles qui n'en ont pas. Le chargeur retombera sur '_${nom}', et ce repli est juste `
         + 'pour les uns et faux pour les autres — le lecteur ne peut pas les séparer.');
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
