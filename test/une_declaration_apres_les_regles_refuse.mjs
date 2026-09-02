#!/usr/bin/env node
/**
 * GARDE — une DÉCLARATION écrite après les règles est REFUSÉE, elle ne se perd plus en silence.
 *
 * Décision Romain, transmise le 2026-07-29 : « une directive après les règles doit être une
 * erreur ». Mesure de l'architecte, reproduite ici : elle était ACCEPTÉE ET SILENCIEUSEMENT
 * IGNORÉE — `@var v` posé après une règle compilait sans un mot, et `v` n'existait dans aucun
 * arbre. La même ligne posée avant la règle le crée.
 *
 * ⚠️ POURQUOI C'EST LE PIRE MODE D'ÉCHEC, et pas une coquille : l'auteur CROIT avoir déclaré.
 * Rien ne le détrompe — ni le compilateur, ni l'arbre, ni l'aval. C'est le mode d'échec de la
 * flèche du moteur historique, en pire : celle-là au moins ne compilait pas.
 *
 * ⚠️ LE GARDE PORTE SUR L'ESPACE, PAS SUR LA FORME DU TICKET. Le signalement nommait `@var`. Le
 * balayage des directives réservées en a trouvé VINGT-QUATRE dans le même cas. Réparer la seule
 * forme signalée aurait laissé vivre les vingt-trois autres — c'est la faute que je paie le plus
 * souvent, et elle est ici mécanisée : la liste des directives est CONSTRUITE, pas écrite à la
 * main, et chacune est éprouvée dans les deux positions.
 *
 * ⚠️ ET `@mode` DOIT PASSER — ce n'est pas une exception de complaisance. Il porte le mode de la
 * sous-grammaire QUI SUIT, et 67 scènes du corpus en vivent. Un refus en bloc les aurait toutes
 * cassées : exactement le témoin qui aurait refusé 120 scènes sur 333 le 2026-07-28, retrouvé une
 * semaine plus tard sur un autre sujet. C'est la moitié « doit passer » qui démasque une règle
 * trop large, et elle est ici la plus fournie.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { universeReservedDirectives } from '../src/transpiler/libs.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };
const err = (src) => {
  try { return (compileToBPxAST(src).errors || []).map((e) => e.message ?? String(e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};
// ⚠️ LE SOCLE EST CONDITIONNEL DEPUIS LE 2026-08-07 : une scène ne déclare qu'UN alphabet
// (l'acteur implicite est unique, règle de Romain). Poser `alphabet.western` autour d'un
// `alphabet.sargam` testé fabriquait un refus qui n'a rien à voir avec ce qu'on mesure.
// ⚠️ LE SOCLE NE PORTE PAS LE DÉLIMITEUR : c'est le site d'emploi qui le pose, parce que la
// position de la déclaration éprouvée est PRÉCISÉMENT ce qu'on mesure — avant ou après lui.
const socle = (d) => `core\n${/^alphabet[.:]/.test(d) ? '' : 'alphabet.western\n'}`;
const S = 'core\nalphabet.western\n-----\n';

// ── 1. LA MATRICE, DÉRIVÉE DE LA DONNÉE ─────────────────────────────────────────────────────
// ⛔ ELLE ÉTAIT UNE LISTE ÉCRITE À LA MAIN — vingt et une entrées choisies, qui nommaient QUINZE
// des vingt-deux mots réservés de `core`. Sept n'y passaient jamais, et l'union sur TOUTES les
// librairies en compte QUARANTE-NEUF : la matrice en éprouvait moins de la moitié. Le sujet était
// bon (mesuré le 2026-08-19 : 47 refus nommés, 2 refus légitimes, 1 passage légitime) — c'est
// l'INSTRUMENT qui ne suivait pas sa source, et un garde qui ne se dérive pas de sa donnée pourrit
// sans le dire.
//
// CE QUI SE DÉRIVE : la LISTE des mots, de `reservedDirectives` sur toutes les librairies.
// CE QUI SE DÉCLARE : leur FAMILLE, ci-dessous, par leur nom. Sans quoi le garde photographierait
// le comportement au lieu de l'exiger — un mot qui changerait de camp serait simplement reclassé.
//
// ⛔ ET L'UNION DOIT ÊTRE EXACTEMENT COUVERTE, dans les deux sens : un mot réservé qu'aucune
// famille ne nomme fait ÉCHOUER le garde, et une famille qui nomme un mot sorti de l'union le fait
// échouer aussi. C'est la règle du 2026-08-19 : une exemption qui ne désigne plus rien de vivant
// n'est pas neutre, elle est un trou au nom de quelqu'un.

// LES TROIS FAMILLES, mesurées mot par mot le 2026-08-19 sur `compileToBPxAST`.

// (a) LES DÉCLARATIONS DE TÊTE — elles PASSENT avant les règles, et sont REFUSÉES-NOMMÉES après.
//     C'est le sujet de ce garde : la position qualifie la ligne.
const FORME = {
  // Trois seulement ont besoin d'une écriture : nues, elles manquent leur nom ou leur valeur.
  // Le reste s'éprouve NU — et c'est voulu : une forme écrite à la main est une forme qu'on choisit.
  def: 'def k (vel:120)',
  diapason: 'diapason:442',
  // Les contrôles de tête à valeur, entrés le 2026-09-02 : nus, ils manqueraient leur valeur.
  fadeout: 'fadeout:2', pan: 'pan:64', rate: 'rate:1', syncdelay: 'syncdelay:10', tempo: 'tempo:120',
  vel: 'vel:80', volume: 'volume:100', volumecontrol: 'volumecontrol:100', pancontrol: 'pancontrol:64',
};

// (b) LES CONTRÔLES DE PORTÉE — refusés EN TÊTE, avec un message qui dit OÙ ils vivent. Leur refus
//     tient à leur PORTÉE, pas à leur position, donc la prémisse de la matrice ne vaut pas pour eux.
// ⛔ DOUZE MOTS SONT SORTIS DE CETTE FAMILLE LE 2026-09-02 — destru, failed, goto, legato, order,
//     repeat, retro, rotate, shuffle, staccato, stop, weight. Ils n'étaient à l'union que par la
//     table réservée d'`engine`, qui les DUPLIQUAIT ; ils sont des contrôles de portée règle ou
//     flux, refusés en tête par leur portée, et l'union ne porte plus que les mots de portée scène.
//     Les deux qui restent viennent de la liste de `core`.
const CONTROLES_DE_PORTEE = new Set(['filter', 'scaleshift']);

// (c) `mode` PASSE DANS LES DEUX POSITIONS, et c'est sa définition : il gouverne la sous-grammaire
//     QUI SUIT. 67 scènes du corpus sur 263 en vivent. ⚠️ Il a quitté l'union le 2026-09-02 avec la
//     table d'`engine` — sa portée est `subgrammar`, pas `scene` — donc cette famille est vide ici ;
//     son passage dans les deux positions reste gardé par le corpus.
const LEGITIME_APRES = new Set([]);

// ⛔ ET CETTE TROISIÈME FAMILLE SE NOMME AUSSI. Mon premier jet la calculait comme « tout ce qui
// n'est ni contrôle de portée ni `mode` » — donc un mot réservé NEUF y tombait tout seul, et le
// contrôle d'orphelins ne pouvait RIEN trouver : il comparait l'union à une famille dérivée de
// l'union. INJECTION FAITE, ELLE N'A PAS MORDU : `zorglubinvente` ajouté aux mots réservés est
// passé au vert. Une couverture qui se calcule depuis ce qu'elle couvre photographie l'état ; elle
// ne l'exige pas.
// ⛔ `actor` SORTI LE 2026-09-02 : il est un objet du socle, déclaré dans `types` — « `def` et `init`
// sont les deux mots racines » (Romain). Il quitte la liste réservée de `core`, donc l'union.
const DECLARATIONS_DE_TETE = new Set([
  'all_items', 'allitems', 'chromashift', 'core', 'def', 'diapason', 'eval',
  'homomorphism', 'improvize', 'init', 'ins', 'items', 'maxitems', 'meter', 'modulation',
  // ⛔ `scale` SORTI LE 2026-09-02, même cause qu'`alphabet` : c'est le prototype des gammes, fourni
  // par `types` (décision de Romain, « scale est le mot des gammes, gamut sort »), donc il quitte la
  // liste réservée de `core`. `scale.raga_bhairav` compile toujours — `catalogAxes` route l'invocation.
  'on_fail', 'out', 'qclock', 'quantization', 'randomize', 'rndtime', 'scan',
  // ⛔ `sounds` ET `test_alphabets` SORTIS LE 2026-08-22 : c'étaient des noms de FICHIER, et une
  // librairie s'invoque par le mot qu'elle DÉCLARE. Le mot qu'ils servaient — `sound` — est déjà
  // dans cette famille, une seule fois.
  // ⛔ `tuning`, `octaves` ET `sound` SORTIS LE 2026-09-01, MÊME MOUVEMENT ET MÊME CAUSE que
  // `alphabet` : décision de Romain — « les mots du socle doivent être définis avec leur portée dans
  // le fichier dédié, et tout ce qui vient des librairies doit être spécifié dans scope ». Ces trois
  // mots sont les TYPES de catalogues (`tunings`, `octaves`, `sounds`) : ils viennent des
  // librairies, donc ils quittent le socle.
  // ⚠️ ILS S'ÉCRIVENT TOUJOURS — mesuré : `tuning.western_12TET` et `octaves.western` compilent
  // après le retrait. `catalogAxes` les porte, et c'est lui qui route l'invocation.
  // ⛔ `alphabet` SORTI LE 2026-09-01, décision de Romain : la table des types est le SOCLE, étendu
  // par les librairies invoquées. Un type fourni par une librairie n'appartient pas au socle, donc
  // le mot quitte `core.schema.reservedDirectives` — et l'exemption qui le nommait ici sort avec
  // lui. Une exemption qui ne désigne plus rien de vivant est un trou au nom de quelqu'un.
  'seed', 'settings', 'timepatterns', 'transpose',
  // ⛔ VINGT ET UN MOTS ENTRENT LE 2026-09-02, parce que l'union se lit désormais par la porte du
  // compilateur : tout contrôle de portée `scene` du registre est un mot de tête, quelle que soit
  // la librairie qui le porte — expression, midi, time, variation, engine. Ils passaient déjà en
  // tête avant ce jour ; seul l'instrument ne les comptait pas.
  'fadeout', 'keepcontrols', 'keepweights', 'letring', 'pan', 'pancontrol', 'pedalhold',
  'pedalrelease', 'rate', 'resetcontrols', 'resetnotes', 'resetweights', 'smooth', 'striated',
  'strikeagain', 'sustain', 'syncdelay', 'tempo', 'vel', 'volume', 'volumecontrol', ]);

// ⛔ L'UNION SE LIT PAR LA PORTE, PLUS PAR UN CHEMIN DU PAQUET. Depuis le 2026-09-02 la table
// réservée d'`engine` est sortie : un mot de tête est un objet qui déclare `scope(scene)`, dans
// n'importe quelle place du registre, et c'est `universeReservedDirectives` qui en fait l'union —
// la même que celle du compilateur. Une mesure ad hoc contournerait la porte que le code expose.
const UNION = [...universeReservedDirectives()].sort();
const DECLARATIONS = [...DECLARATIONS_DE_TETE].sort().map((m) => [m, FORME[m] || m]);

console.log(`[declaration apres regles] union ${UNION.length} mots · ${DECLARATIONS.length} declarations `
  + `x 2 positions · ${CONTROLES_DE_PORTEE.size} controles de portee · ${LEGITIME_APRES.size} legitime(s) apres`);

// ⛔ LES DEUX SENS DE LA COUVERTURE.
{
  const classes = new Set([...CONTROLES_DE_PORTEE, ...LEGITIME_APRES, ...DECLARATIONS_DE_TETE]);
  const orphelins = UNION.filter((m) => !classes.has(m));
  ok(orphelins.length === 0,
    `0. ${orphelins.length} mot(s) réservé(s) qu'aucune famille ne nomme : ${orphelins.join(', ')}. `
    + `Un mot neuf doit être CLASSÉ, jamais éprouvé par défaut — sinon la matrice grandit sans que `
    + `personne n'ait regardé ce que le mot fait.`);
  const fantomes = [...CONTROLES_DE_PORTEE, ...LEGITIME_APRES, ...DECLARATIONS_DE_TETE, ...Object.keys(FORME)]
    .filter((m) => !UNION.includes(m));
  ok(fantomes.length === 0,
    `0. ${fantomes.length} mot(s) nommé(s) par une famille et ABSENT(S) de l'union : ${fantomes.join(', ')}. `
    + `Une exemption qui ne désigne plus rien de vivant est un trou au nom de quelqu'un.`);
}

for (const [nom, forme] of DECLARATIONS) {
  // APRÈS une règle → REFUSÉE, et le refus doit NOMMER la directive et donner la réécriture.
  const apres = err(`${socle(forme)}-----\nS -> C4\n${forme}\n-----\nT -> D4\n`);
  ok(apres.length >= 1, `1. '${nom}' après une règle doit être REFUSÉE (elle se perdait en silence)`);
  ok(apres.some((m) => m.includes(`'${nom}'`)),
    `1. '${nom}' — le refus doit NOMMER la directive, pas dire « ligne non reconnue » (reçu : ${apres[0]})`);
  ok(apres.some((m) => /avant la première règle/.test(m)),
    `1. '${nom}' — le refus doit donner la RÉÉCRITURE, sinon il constate sans aider`);
  // AVANT les règles → PASSE. Sans cette moitié, une règle qui refuserait tout aurait l'air juste.
  ok(err(`${socle(forme)}${forme}\n-----\nS -> C4\n`).length === 0,
    `1. '${nom}' AVANT les règles doit PASSER — c'est la moitié qu'on casse sans s'en apercevoir`);
}

// ── 1bis. LES CONTRÔLES DE PORTÉE — refusés EN TÊTE, et le refus DIT OÙ ILS VIVENT ───────────
// Sans ce volet, on pourrait les exempter en silence et croire la matrice complète. Ils sont
// éprouvés, simplement sur une autre exigence : leur refus doit nommer leur portée.
for (const nom of CONTROLES_DE_PORTEE) {
  const tete = err(`${socle(nom)}${nom}\n-----\nS -> C4\n`);
  ok(tete.length >= 1, `1bis. '${nom}' est un contrôle de PORTÉE : il doit être REFUSÉ en tête de scène`);
  ok(tete.some((m) => m.includes(`'${nom}'`) && /ne peut pas s'écrire en tête de scène/.test(m)),
    `1bis. '${nom}' — le refus doit NOMMER le mot et dire qu'il ne s'écrit pas en tête (reçu : ${tete[0]?.slice(0, 100)})`);
  ok(tete.some((m) => /il (vaut|ne vaut)/.test(m)),
    `1bis. '${nom}' — le refus doit dire OÙ le mot vit, sinon il ferme une porte sans en ouvrir une`);

  // ⛔ ET LA MÊME CASE APRÈS LES RÈGLES, QUI N'ÉTAIT ÉPROUVÉE PAR PERSONNE. Atlas l'a mesurée le
  // 2026-08-19 : `destru` y recevait « remonter cette ligne AVANT la première règle de la scène »,
  // c'est-à-dire en tête de scène — que le refus juste au-dessus refuse. LES DEUX MESSAGES
  // S'ENVOYAIENT L'UN VERS L'AUTRE, et un lecteur qui les suit tourne en rond.
  //
  // Ma matrice n'éprouvait ces quatorze mots QU'EN TÊTE DE SCÈNE : elle les avait bien sortis des
  // déclarations, et n'avait rien mis à la place pour l'autre position. Une famille exemptée d'un
  // volet doit être éprouvée dans l'autre, sinon l'exemption est un trou.
  const apresRegles = err(`${S}S -> C4\n${nom}\n-----\nT -> D4\n`);
  ok(apresRegles.length >= 1, `1bis. '${nom}' écrit SEUL après des règles doit être REFUSÉ`);
  ok(!apresRegles.some((m) => /avant la première règle de la scène/.test(m)),
    `1bis. '${nom}' — le refus ne doit PAS renvoyer en tête de scène : le refus voisin l'y refuse, `
    + `et les deux messages s'enverraient l'un vers l'autre (reçu : ${apresRegles[0]?.slice(0, 110)})`);
  ok(apresRegles.some((m) => /il vaut/i.test(m)),
    `1bis. '${nom}' — le refus doit dire OÙ il vit, avec la FORME qui l'écrit (reçu : ${apresRegles[0]?.slice(0, 110)})`);
}

// ── 1quater. LA PLACE QUE LES REFUS NOMMENT DOIT ACCEPTER LE MOT ─────────────────────────────
// ⛔ « Un refus qui donne une réécriture PUBLIE une forme » — leçon du 2026-08-19 au matin. Ces deux
// refus nomment une PLACE ; le garde l'instancie et la compile. Sans ce volet, ils pourraient
// envoyer l'auteur vers un endroit qui le refuse à son tour — c'est exactement le cercle qu'Atlas a
// trouvé, et il vivait entre deux messages dont chacun, seul, avait l'air juste.
//
// ⚠️ ET LE GÉNÉRATEUR DE FORMES M'A TROMPÉ AVANT LE SUJET : il n'essayait que `(mot:1)`, alors que
// `order` et `retro` NE PRENNENT AUCUN ARGUMENT — `!(order)` compile, `!(order:1)` est refusé en le
// disant. J'ai conclu « AUCUNE forme ne compile » sur quatre mots avant de rouvrir. Une place se
// prouve avec TOUTES ses graphies, sinon c'est l'instrument qui rend le verdict.
const FORMES_DE_PLACE = {
  'sur une règle':             (m) => [`${S}S -> C4 D4 (${m})\n`, `${S}S -> C4 D4 (${m}:1)\n`],
  'dans le flux':              (m) => [`${S}S -> C4 !(${m}) D4\n`, `${S}S -> C4 !(${m}:1) D4\n`],
  'sur un élément':            (m) => [`${S}S -> C4(${m}) D4\n`, `${S}S -> C4(${m}:1) D4\n`],
  'sur un groupe':             (m) => [`${S}S -> {C4 D4}(${m})\n`, `${S}S -> {C4 D4}(${m}:1)\n`],
  'en tête de sous-grammaire': (m) => [`${S}S -> C4\n-----\nmode:rnd(${m})\nT -> D4\n`],
};
for (const nom of CONTROLES_DE_PORTEE) {
  const refus = err(`${socle(nom)}${nom}\n-----\nS -> C4\n`)[0] || '';
  const places = Object.keys(FORMES_DE_PLACE).filter((p) => refus.includes(p));
  ok(places.length >= 1,
    `1quater. le refus de '${nom}' ne nomme AUCUNE place connue — il ferme sans ouvrir `
    + `(reçu : ${refus.slice(0, 110)})`);
  const compile = places.some((p) => FORMES_DE_PLACE[p](nom).some((src) => err(src).length === 0));
  ok(compile,
    `1quater. '${nom}' — le refus nomme ${places.join(' / ')}, et AUCUNE graphie de ces places ne `
    + `compile. Un refus qui envoie vers un endroit qui le refuse aussi fait tourner l'auteur en rond.`);
}

// ── 2. `mode` EST LA SEULE LÉGITIME À CETTE PLACE ───────────────────────────────────────────
// 67 scènes du corpus sur 263 en vivent. Ce témoin est la preuve que la règle ne déborde pas.
ok(err(`${S}S -> C4\nmode:sub\n-----\nT -> D4\n`).length === 0,
  '2. SE TAIT — `mode` après une règle gouverne la sous-grammaire suivante, et doit passer');
{
  const r = compileToBPxAST(`${S}S -> C4\nmode:sub\n-----\nT -> D4\n`);
  ok((r.ast?.subgrammars || []).some((g) => g.mode === 'sub'),
    '2. et il AGIT — sinon il « passerait » en ne faisant rien, ce qui est le défaut qu\'on répare');
}
ok(err(`${S}S -> C4\n-----\nmode:lin\nT -> D4\n`).length === 0,
  '2. SE TAIT — `mode` après un séparateur de bloc aussi');

// ── 3. LE REFUS NE DÉBORDE PAS SUR LES AUTRES FORMES DE FIN DE SCÈNE ─────────────────────────
// La section `template` vient APRÈS toutes les sous-grammaires : c'est sa place, pas une faute.
ok(err(`${S}S -> C4\ntemplate\n  t1 = C4 D4\n`).length === 0,
  '3. SE TAIT — la section `template` se place après les règles, c\'est sa définition');
ok(err(`${S}S -> C4\n-----\nT -> D4\n`).length === 0,
  '3. SE TAIT — un séparateur de bloc n\'est pas une directive');

// ── 4. SOCLE ET ANTI-RÉTRÉCISSEMENT ─────────────────────────────────────────────────────────
// L'espace se lit dans la DONNÉE : si le vocabulaire de directives grandit, ce compte le dit.
// ⚠️ MESURE ÉTENDUE À L'UNION DU REGISTRE le 2026-08-10 (mise en conformité des librairies).
// Compter SEUL `core.schema.reservedDirectives` mesurait juste ce fichier — exact tant que lui
// seul en portait. Les 15 clés qui vivaient EN DOUBLE ici et dans lib/engine.json (mode, seed,
// maxitems, items, allitems, all_items, improvize, duration, meter, scan, weight, on_fail,
// quantization, qclock, timepatterns) l'ont QUITTÉ (une clé ne vit que dans UNE librairie) : le
// vocabulaire RÉEL du langage n'a pas rétréci, il s'est redistribué — c'est l'UNION, pas la seule
// part de `core`, que ce témoin doit garder. `reservedDirectives` porte deux formes (array plat
// ou objet {nom:{description,scope}}) ; les deux se comptent par leurs noms.
// ⛔ 2026-09-02 : L'UNION SE LIT PAR LA PORTE (`universeReservedDirectives`), et elle porte tout mot
// de portée scène du registre — la table objet d'`engine` est sortie, ses mots de portée règle ou
// flux avec elle, et les contrôles de tête des autres librairies (vel, pan, tempo, letring…) y
// sont comptés comme le compilateur les compte. Mesuré à la frappe : 51 mots.
// 51 → 49 le 2026-09-02 au soir : `scale` puis `actor` quittent la liste de `core` — deux types
// fournis par `types`, deux décisions de Romain, aucune cécité d'instrument.
const RESERVEES = UNION.length;
ok(RESERVEES >= 49, `4. le vocabulaire de directives doit être chargé — ${RESERVEES} mot(s)`);
// Le seuil est passé de 24 à 22 le 2026-08-09, et le motif s'écrit ici plutôt que dans un commit :
// `mm` est SORTIE du langage (Romain 2026-06-26, fermée le 2026-08-09), donc elle disparaît des
// deux listes — une forme qui n'existe plus ne peut pas être éprouvée. C'est le seul abaissement
// légitime de ce socle : une forme RETIRÉE du langage. Un seuil qu'on baisse parce qu'un cas
// « ne passe plus » est un socle qu'on désarme ; celui-ci se baisse parce que l'espace lui-même a
// rétréci, et le compte des directives réservées ci-dessus reste, lui, à 40 pour le prouver.
// ⛔ LE PLANCHER PORTE DÉSORMAIS SUR L'UNION, PAS SUR LA MATRICE. La matrice se dérive de l'union :
// un plancher posé sur elle mesurerait sa propre soustraction. C'est l'UNION qui dit la taille du
// vocabulaire, et c'est elle qui doit refuser de rétrécir sans qu'on le sache.
// Mesure du 2026-08-22 : 47 mots à l'union, 32 déclarations, 14 contrôles de portée, 1 légitime
// après. Le plancher descend d'un cran quand un mot SORT du langage, jamais parce qu'un extracteur
// a cessé de voir.
// ⛔ ET IL EST DESCENDU DE 49 À 47 CE JOUR-LÀ, POUR LA SEULE RAISON ADMISE : `sounds` et
// `test_alphabets` étaient des noms de FICHIER, et une librairie s'invoque par le mot qu'elle
// DÉCLARE. Le diff de la donnée porte exactement deux retraits et aucun autre — c'est cette
// soustraction-là qui est comptée, pas un extracteur devenu aveugle.
// ⛔ 47 → 46 LE 2026-09-01, ET LA RAISON N'EST PAS CELLE QUE LA PHRASE CI-DESSUS NOMMAIT. `alphabet`
// ne SORT PAS du langage — `alphabet.western` compile toujours, et le mot reste dans `catalogAxes`,
// qui est ce qui route l'invocation. Il sort du SOCLE : décision de Romain, la table des types est
// le socle, étendu par les librairies invoquées, et un type fourni par une librairie n'y appartient
// pas. ⇒ LE CRITÈRE RÉEL DERRIÈRE CETTE CLAUSE est donc plus large que sa lettre : la soustraction
// est-elle une DÉCISION sur la donnée, ou une CÉCITÉ de l'instrument ? Ici le diff porte exactement
// un retrait, décidé, et l'union passe de 47 à 46.
// ⛔ 46 → 43 LE MÊME JOUR : `tuning`, `octaves`, `sound` suivent `alphabet`, pour la raison écrite
// plus bas. Trois retraits décidés, diff à l'appui, et les trois mots compilent toujours.
ok(UNION.length >= 43,
  `4. le vocabulaire réservé ne s'est pas vidé — ${UNION.length} mot(s) à l'union des librairies`);
ok(DECLARATIONS_DE_TETE.size + CONTROLES_DE_PORTEE.size + LEGITIME_APRES.size === UNION.length,
  `4. les trois familles doivent PARTITIONNER l'union — ${DECLARATIONS.length} + `
  + `${CONTROLES_DE_PORTEE.size} + ${LEGITIME_APRES.size} contre ${UNION.length}. Un mot compté deux `
  + `fois ou pas du tout rend le compte juste et la couverture fausse.`);
// TÉMOIN D'INSTRUMENT : sans lui, une régression rendant le refus muet laisserait tout au vert.
ok(err(`${S}S -> C4\nsymbol v\n`).length >= 1,
  '4. TÉMOIN — la règle doit savoir MORDRE même en toute fin de scène (aucune règle après)');

if (echecs.length) {
  console.error(`[declaration apres regles] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[declaration apres regles] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
