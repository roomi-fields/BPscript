#!/usr/bin/env node
/**
 * TOUTE CLÉ QU'ON PEUT ÉCRIRE DANS UN SAC DÉCLARE OÙ ELLE A LE DROIT D'ÊTRE — sans exception.
 *
 * FORMALISME ARRÊTÉ PAR ROMAIN le 2026-08-08, en quatre points :
 *   · une LISTE, jamais une valeur seule — `vel` vaut pour une note, un groupe, une règle, le flux ;
 *   · un vocabulaire FERMÉ de six mots : scene · subgrammar · rule · group · symbol · flow ;
 *   · TOUTE clé de sac le déclare, pas seulement les contrôles ;
 *   · l'ABSENCE est une faute — c'est ce fichier qui la refuse.
 *
 * ⚠️ CE QUE CE CHAMP SERT, ET CE QU'IL NE SERT PLUS. L'accrochage dans l'arbre DIT déjà la portée :
 * un réglage est déposé au bon endroit selon où il est écrit, et l'aval n'a besoin d'aucune
 * déclaration pour le LOCALISER. Ce champ sert uniquement à VALIDER — l'arbre dit où le réglage
 * EST, la librairie dit où il A LE DROIT d'être. Sans lui on lit n'importe quel réglage n'importe
 * où sans pouvoir dire qu'il est mal placé : c'est ce qui a rendu un poids muet pendant quatre
 * jours, avec le défaut du moteur appliqué à la place, en silence.
 *
 * ⚠️ POURQUOI LA PORTÉE VIT DANS LA LIBRAIRIE DE LA CLÉ, ET NON DANS UN FICHIER CENTRAL. **Le sac
 * ne porte pas que des contrôles.** Mesuré sur les 274 scènes : `cutoff` y est écrit vingt fois et
 * vient de la librairie des modulations ; `ch` une fois, et vient du socle. Une validation bâtie
 * sur la seule librairie des contrôles les refuserait à tort. Ce garde balaie donc les TROIS
 * sources, et il échoue si une quatrième apparaît sans déclarer — c'est le volet C.
 *
 * ⚠️ UN SEUL AXE, et c'est une leçon plutôt qu'une simplification. Un second axe était prévu :
 * « où on a le droit d'écrire » contre « jusqu'où l'effet porte ». Il reposait ENTIÈREMENT sur
 * `mode` — écrit sur une règle, gouvernant le bloc, selon la spécification. Mesure du 2026-08-08 :
 * cette forme n'existe ni au moteur d'origine, ni dans une seule des 274 scènes, et mon arbre ne
 * l'appliquait nulle part. Romain l'a supprimée ; l'axe est parti avec elle. **Un champ conçu pour
 * un seul cas meurt avec ce cas.**
 */
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/** LE VOCABULAIRE — fermé. Une valeur hors de cette liste est une faute, pas une extension. */
const VOCABULAIRE = ['scene', 'subgrammar', 'rule', 'group', 'symbol', 'flow'];

/** Les clés de sac, par source. Ajouter une source ICI la soumet automatiquement aux trois volets. */
function toutesLesCles() {
  const cles = [];
  // (a) les contrôles. `racine` nomme la LIBRAIRIE balayée — jusqu'au 2026-08-10 elle était
  // toujours 'controls', HARDCODÉE dans le préfixe ; l'ajout de lib/engine.json (procédures
  // moteur rapatriées) exige de la porter en paramètre plutôt que de la recopier en dur.
  const w = (o, racine, chemin) => {
    for (const [k, v] of Object.entries(o)) {
      if (!v || typeof v !== 'object') continue;
      if ('args' in v && 'description' in v) cles.push({ source: `${racine}.${chemin}`, nom: k, def: v });
      else w(v, racine, chemin ? `${chemin}.${k}` : k);
    }
  };
  // `controls.json` SCINDÉ le 2026-08-10 (une librairie, un destinataire — LIBRAIRIES.md:213) en
  // quatre : `controls` lui-même n'est plus qu'un stub d'`apporte`, sans contrôle propre.
  // `variation` REJOINT LE BALAYAGE le 2026-08-12 : elle porte les dix-huit modes discrets des
  // neuf paramètres de jeu, résolus par Kairos. Une source déclarée et non balayée serait muette
  // pour les trois volets — c'est le compte du volet C qui l'a dit, à sa première omission.
  for (const racine of ['expression', 'midi', 'audio', 'transpo', 'variation']) w(LIBS[racine], racine, '');
  // Les procédures MOTEUR (mode/scan/weight/goto/rndtime, destru/randomize…) ont rejoint
  // lib/engine.json le 2026-08-10 (une clé ne vit que dans UNE librairie) — même balayage.
  w(LIBS.engine, 'engine', '');
  // (b) les entrées de modulation
  for (const [type, entrees] of Object.entries(LIBS.modulation || {})) {
    if (type.startsWith('_') || !entrees || typeof entrees !== 'object') continue;
    for (const [k, v] of Object.entries(entrees)) {
      if (v && typeof v === 'object') cles.push({ source: `modulation.${type}`, nom: k, def: v });
    }
  }
  return cles;
}

const CLES = toutesLesCles();

// ── A. AUCUNE CLÉ SANS PORTÉE ────────────────────────────────────────────────────────────────
//
// ⚠️ UNE EXEMPTION, ET UNE SEULE, POSÉE LE 2026-08-13 AVEC SA RAISON. Une entrée qui porte
// `bpscript: false` déclare un geste que le MOTEUR exécute, pour que le frontal BP3 puisse le
// router — elle N'EST PAS un mot du langage et une scène qui l'écrit est refusée. Or une portée dit
// OÙ un mot a le droit d'être ÉCRIT : exiger une portée d'un mot qui ne s'écrit nulle part n'a pas
// de sens, et lui en donner une serait pire — ça affirmerait un droit d'écriture que le vocabulaire
// refuse par ailleurs.
// Ce n'est donc pas un desserrage : c'est la même règle, appliquée à ce qui la concerne. Le témoin
// ci-dessous vérifie que l'exemption reste ÉTROITE — elle ne couvre que les entrées marquées, et il
// doit y en avoir, sinon elle serait une porte ouverte sur rien.
const exemptees = CLES.filter(({ def }) => def.bpscript === false);
ok(exemptees.length > 0,
   "A. l'exemption doit couvrir au moins une entrée — sinon elle est une porte ouverte que rien "
   + "n'emprunte, et c'est le moment de la retirer");
ok(exemptees.every(({ def }) => typeof def.bp3 === 'string' && def.bp3),
   'A. toute entrée exemptée doit porter sa graphie NATIVE — elle est déclarée POUR le routage, une '
   + 'exemption sans graphie ne déclarerait rien du tout');

for (const { source, nom, def } of CLES) {
  if (def.bpscript === false) continue;   // ne s'écrit nulle part : cf. l'exemption ci-dessus
  ok(def.scope !== undefined,
     `A. '${nom}' (${source}) ne déclare AUCUNE portée. L'absence ne peut pas vouloir dire `
     + `« partout » : elle rendrait toute validation impossible, et c'est l'état qu'on vient de `
     + `quitter — 57 des 65 contrôles étaient muets.`);
}

// ── B. LE FORMAT ET LE VOCABULAIRE ───────────────────────────────────────────────────────────
for (const { source, nom, def } of CLES) {
  if (def.scope === undefined) continue;
  ok(Array.isArray(def.scope),
     `B. '${nom}' (${source}) déclare sa portée en VALEUR SEULE (${JSON.stringify(def.scope)}) et `
     + `non en liste. Une clé vaut souvent pour plusieurs places — 'vel' en vaut quatre — et un `
     + `format à une valeur oblige l'aval à tester la forme avant de lire.`);
  if (!Array.isArray(def.scope)) continue;
  ok(def.scope.length > 0,
     `B. '${nom}' (${source}) déclare une liste VIDE. Une clé qui ne peut s'écrire nulle part n'a `
     + `pas de raison d'être au catalogue.`);
  for (const s of def.scope) {
    ok(VOCABULAIRE.includes(s),
       `B. '${nom}' (${source}) emploie '${s}', hors du vocabulaire fermé `
       + `(${VOCABULAIRE.join(', ')}). Un mot inventé au coup par coup ramène le désordre que ce `
       + `vocabulaire ferme : l'ancien champ portait 'seq_prefix', qui n'était pas une portée mais `
       + `une position dans le texte du moteur d'origine.`);
  }
}

// ── C. LES SOURCES SONT TOUTES BALAYÉES ─────────────────────────────────────────────────────
// ⚠️ Ce volet existe parce que la faute est de N'EN VOIR QU'UNE. Si une librairie se met à porter
// Compte abaissé d'UNE unité le 2026-08-09 : `randomize` était déclaré DEUX FOIS (sections
// `subgrammar` et `engine`), avec deux portées divergentes — et c'est la plus étroite qui
// gagnait en silence. Le doublon part, le MOT reste déclaré : aucune confiscation, aucun
// nom ne quitte le vocabulaire. C'est le seul abaissement légitime de ce socle — une entrée
// dupliquée qu'on dédoublonne, jamais un cas qui « ne passe plus ».
// des clés de sac sans être ici, ce garde ne le dira pas — sauf par ce compte.
// ⚠️ COMPTE RÉPARTI SUR CINQ SOURCES le 2026-08-10 : les 18 procédures/attributs MOTEUR
// (mode/scan/weight/on_fail/meter/repeat/failed/stop/goto/retro/shuffle/order/rotate/staccato/
// legato/rndtime/destru/randomize) vivent dans lib/engine.json ; les 43 contrôles RUNTIME
// restants sont désormais scindés en QUATRE fichiers par destinataire (LIBRAIRIES.md:213) :
// expression (8 : vel/pan/rndvel/velcont/offvel/value/fixed/cont), midi (24), audio (6),
// transpo (5) — `controls.json` lui-même n'est plus qu'un stub d'`apporte`, zéro contrôle propre.
// ⚠️ COMPTES REVUS LE 2026-08-12 — LA FAMILLE DES MODES DE VARIATION (Romain : « on part sur des
// mots entiers »). Neuf paramètres de jeu portent chacun trois modes — fixe, paliers, continu —
// soit vingt-sept mots. Les DIX-HUIT discrets se résolvent à la note et vivent désormais dans
// `lib/variation.json` (destinataire Kairos) ; les NEUF continus exigent des messages pendant la
// note et vivent dans la librairie de leur paramètre.
// CE QUI BOUGE, ET POURQUOI CHAQUE MOUVEMENT EST LÉGITIME :
//   expression 8 → 9   : `pancont` déclaré (le mode manquait).
//   transpo    5 → 6   : `transposecont` déclaré (le mode manquait).
//   engine    21 → 22  : `articulcont` déclaré (le mode manquait) ; son paramètre, `legato`/
//                        `staccato`, vit ici.
//   midi      24 → 21  : `pitchfixed`, `mapstep`, `mapfixed` DÉMÉNAGENT vers `variation`. Aucun
//                        nom ne quitte le vocabulaire — c'est un déplacement de domicile, pas un
//                        retrait, et le garde `la_famille_des_modes_de_variation_est_entiere.mjs`
//                        exige que les vingt-sept restent écrivables.
//   variation  0 → 18  : la nouvelle source, INSCRITE ICI — une librairie absente de cette table
//                        ne serait balayée par personne, et c'est exactement la faute que ce volet
//                        existe pour empêcher.
//   expression 9 → 6   : `value`, `fixed` et `cont` RETIRÉS le 2026-08-13, arbitrage Romain. Leur
//     graphie cassait deux canons — `!(cont:slide)` inversait le sujet et la valeur, et
//     `!(value:slide 101)` cachait le sujet DANS la valeur. La forme canonique met le PARAMÈTRE en
//     clé et lui COLLE son mode (`!(slide:101)`, `!(slidecont)`), la même construction que les
//     vingt-sept mots ; le paramètre se déclare par `@var <nom> signal`. Ces trois clés ne sont donc
//     plus des contrôles de librairie : le nom vient de la SCÈNE.
//   expression 6 → 8, transpo 6 → 5, engine 22 → 21 : `articulcont` et `transposecont` DEPLACES le
//     2026-08-13 vers expression. Arbitrage Romain : « les continus partent aux RUNTIMES, sans
//     exception ; la destination suit la NATURE du mot ». Ils vivaient chez engine (BPx) et transpo
//     (Kairos) — or ni le moteur ni le resolveur d arbre ne SONNENT, et un mode continu se definit
//     par des messages intermediaires PENDANT la note.
//   expression 8 → 12 : `value`, `fixed`, `cont` et `step` REVIENNENT le 2026-08-13, mais comme
//     GESTES DE ROUTAGE (`bpscript: false`) et non comme mots du langage. Ils portent leur graphie
//     native pour que le frontal BP3 puisse traduire une grammaire native — le binaire les exécute
//     et six grammaires du corpus les écrivent — et ils restent REFUSÉS dans une scène. Le compte
//     de ce volet mesure ce que la LIBRAIRIE déclare, les deux métiers confondus ; c'est le volet A
//     qui sépare, en exemptant les marqués de la portée.
//   expression 12 → 13, midi 21 → 25 : LES CINQ CADENCES ENTRENT le 2026-08-13, par la décision de
//   Romain sur le continu. Une cadence vit où vit son continu, donc chez le même destinataire :
//   `panrate` rejoint `pancont` dans `expression`, et `volumerate`, `modrate`, `pitchrate`,
//   `pressrate` rejoignent leurs continus dans `midi`. Ce plancher monte parce que la famille a
//   grandi — il ne se règle JAMAIS sur ce que l'extracteur rend, sinon il cesserait de mesurer.
const PAR_DESTINATAIRE = { expression: 13, midi: 25, audio: 6, transpo: 5, variation: 18 };
for (const [racine, attendu] of Object.entries(PAR_DESTINATAIRE)) {
  const n = CLES.filter((c) => c.source.startsWith(`${racine}.`)).length;
  ok(n === attendu,
     `C. ${n} contrôles balayés sous '${racine}.', ${attendu} attendus. Un extracteur qui en `
     + `rate rendrait un verdict vert sur une famille qu'il n'a jamais vue.`);
}
// 18 rapatriés le 2026-08-10 (mode/scan/weight/on_fail/meter/repeat/failed/stop/goto/retro/
// shuffle/order/rotate/staccato/legato/rndtime/destru/randomize) + 3 rejoints dans la MÊME
// journée (striated/smooth : « nature du temps », LIBRAIRIES.md:168 ; mm : pragmatique, cf.
// engine.json subgrammar._comment) = 21.
//   engine 21 → 23 le 2026-08-13 : `srand` et `print` entrent comme GESTES DE ROUTAGE
//     (`bpscript: false`), à la demande du frontal BP3 qui les routait en allowlist depuis juin.
//     Ce sont deux contrats BP3 réels que le corpus écrit et que le vocabulaire BPScript n'a aucune
//     raison d'accueillir — `srand` réamorce l'aléa DANS LE FLUX (BPScript n'expose que le réglage
//     de scène `seed`), `print` écrit dans une fenêtre de trace que BPScript n'a pas.
ok(CLES.filter((c) => c.source.startsWith('engine.')).length === 23,
   `C. ${CLES.filter((c) => c.source.startsWith('engine.')).length} contrôles balayés sous `
   + `'engine.', 23 attendus (les procédures moteur rapatriées de lib/controls.json, plus `
   + `'articulcont' — le mode continu suit son paramètre, et 'legato'/'staccato' vivent ici).`);
ok(CLES.filter((c) => c.source.startsWith('modulation.')).length >= 5,
   `C. ${CLES.filter((c) => c.source.startsWith('modulation.')).length} entrées de modulation `
   + `balayées, 5 au moins attendues.`);
ok(Array.isArray(LIBS.core?.schema?.channelParamsScope)
   && LIBS.core.schema.channelParamsScope.every((s) => VOCABULAIRE.includes(s)),
   `C. les paramètres d'adresse du socle ne déclarent pas leur portée, ou l'écrivent hors `
   + `vocabulaire : ${JSON.stringify(LIBS.core?.schema?.channelParamsScope)}. Ils s'écrivent dans `
   + `un sac ('E4(ch:5)') : la règle vaut pour eux aussi.`);

// ── D. TÉMOIN — LE VOCABULAIRE EST VRAIMENT EMPLOYÉ, PAS DÉCORATIF ──────────────────────────
// ⚠️ Sans lui, un catalogue qui déclarerait partout la même portée passerait A, B et C en triomphe
// tout en ne distinguant plus rien. Le champ doit DISCRIMINER, sinon il ne sert qu'à être vert.
{
  const employes = new Set(CLES.flatMap((c) => (Array.isArray(c.def.scope) ? c.def.scope : [])));
  ok(employes.size >= 5,
     `D-témoin. seuls ${employes.size} des ${VOCABULAIRE.length} mots du vocabulaire sont employés `
     + `(${[...employes].join(', ')}). Un champ qui déclare la même chose partout ne valide rien.`);
  const distinctes = new Set(CLES.map((c) => JSON.stringify(c.def.scope)));
  ok(distinctes.size >= 6,
     `D-témoin. seules ${distinctes.size} combinaisons de portées distinctes existent. Le champ `
     + `doit DISTINGUER les familles — le poids ne va que sur une règle, le mode que sur un bloc, `
     + `l'intensité partout. S'il ne distingue plus, il est décoratif.`);
  // Les trois cas nommés par une décision ou par la mesure, en clair.
  // ⚠️ 'weight'/'mode' vivent sous 'engine.', 'vel' sous 'expression.' depuis le 2026-08-10
  // (rapatriement + scission de lib/controls.json) — la recherche accepte les CINQ racines de
  // contrôles, le nom seul les distingue déjà (une clé ne vit que dans UNE librairie).
  const RACINES_CONTROLES = ['expression.', 'midi.', 'audio.', 'transpo.', 'engine.'];
  const de = (n) => CLES.find((c) => c.nom === n && RACINES_CONTROLES.some((r) => c.source.startsWith(r)))?.def?.scope;
  ok(JSON.stringify(de('weight')) === JSON.stringify(['rule']),
     `D. 'weight' doit valoir pour la RÈGLE et elle seule — décision de Romain, 2026-08-08 : `
     + `« le poids n'a de sens que sur une règle ». Reçu : ${JSON.stringify(de('weight'))}.`);
  // ⚠️ AFFIRMATION RESSERRÉE le 2026-08-08, et c'est le TEST qui l'a exigée. J'écrivais « la
  // sous-grammaire ET ELLE SEULE » ; la référence liste `mode` parmi les clés écrivables en tête
  // de scène (`LANGUAGE.md:576`), et Romain l'a confirmé. Ce qui est décidé, c'est qu'il ne change
  // pas EN COURS DE TIRAGE — un défaut de scène que chaque bloc recouvre n'est pas un changement
  // en cours de tirage. J'avais durci une décision au-delà de ce qu'elle disait.
  ok(!de('mode').includes('rule') && !de('mode').includes('group') && !de('mode').includes('symbol')
     && !de('mode').includes('flow'),
     `D. 'mode' ne doit valoir NI sur une règle, NI sur un groupe, NI sur un élément, NI dans le `
     + `flux — il ne change pas en cours de tirage (Romain, 2026-08-08). Reçu : `
     + `${JSON.stringify(de('mode'))}.`);
  ok((de('vel') || []).length >= 4,
     `D. 'vel' doit valoir pour au moins quatre places — c'est l'exemple qui a fait rejeter le `
     + `format à une valeur. Reçu : ${JSON.stringify(de('vel'))}.`);
}

if (echecs.length) {
  console.error(`❌ toute clé de sac déclare sa portée : ${echecs.length} échec(s)`);
  for (const e of echecs.slice(0, 12)) console.error(`   - ${e}`);
  if (echecs.length > 12) console.error(`   … et ${echecs.length - 12} autre(s)`);
  process.exit(1);
}
console.log(`✅ toute clé de sac déclare sa portée — ${CLES.length} clés balayées sur trois sources `
          + `(contrôles, modulations, paramètres d'adresse), vocabulaire fermé de `
          + `${VOCABULAIRE.length} mots, format liste partout, et le champ DISTINGUE réellement les `
          + `familles. ${passe} vérification(s) passée(s).`);
