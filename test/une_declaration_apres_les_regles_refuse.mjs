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
  actor: 'actor v\n  out.audio',
  def: 'def k (vel:120)',
  diapason: 'diapason:442',
};

// (b) LES CONTRÔLES DE PORTÉE — refusés EN TÊTE, avec un message qui dit OÙ ils vivent. Leur refus
//     tient à leur PORTÉE, pas à leur position, donc la prémisse de la matrice ne vaut pas pour eux.
const CONTROLES_DE_PORTEE = new Set([
  'destru', 'failed', 'filter', 'goto', 'legato', 'order', 'repeat', 'retro', 'rotate',
  'scaleshift', 'shuffle', 'staccato', 'stop', 'weight',
]);

// (c) `mode` — LE SEUL MOT QUI PASSE DANS LES DEUX POSITIONS, et c'est sa définition : il gouverne
//     la sous-grammaire QUI SUIT. 67 scènes du corpus sur 263 en vivent.
const LEGITIME_APRES = new Set(['mode']);

// ⛔ ET CETTE TROISIÈME FAMILLE SE NOMME AUSSI. Mon premier jet la calculait comme « tout ce qui
// n'est ni contrôle de portée ni `mode` » — donc un mot réservé NEUF y tombait tout seul, et le
// contrôle d'orphelins ne pouvait RIEN trouver : il comparait l'union à une famille dérivée de
// l'union. INJECTION FAITE, ELLE N'A PAS MORDU : `zorglubinvente` ajouté aux mots réservés est
// passé au vert. Une couverture qui se calcule depuis ce qu'elle couvre photographie l'état ; elle
// ne l'exige pas.
const DECLARATIONS_DE_TETE = new Set([
  'actor', 'all_items', 'allitems', 'alphabet', 'chromashift', 'core', 'def', 'diapason', 'eval',
  'homomorphism', 'improvize', 'init', 'ins', 'items', 'maxitems', 'meter', 'modulation',
  'octaves', 'on_fail', 'out', 'qclock', 'quantization', 'randomize', 'rndtime', 'scale', 'scan',
  'seed', 'settings', 'sound', 'sounds', 'test_alphabets', 'timepatterns', 'transpose', 'tuning',
]);

const nomsReserves0 = (rd) => (Array.isArray(rd) ? rd : Object.keys(rd || {}));
const UNION = [...new Set(Object.values(LIBS).flatMap((f) => nomsReserves0(f?.schema?.reservedDirectives)))].sort();
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
const nomsReserves = (rd) => (Array.isArray(rd) ? rd : Object.keys(rd || {}));
const RESERVEES = new Set(Object.values(LIBS).flatMap((f) => nomsReserves(f?.schema?.reservedDirectives))).size;
ok(RESERVEES >= 40, `4. le vocabulaire de directives doit être chargé — ${RESERVEES} mot(s)`);
// Le seuil est passé de 24 à 22 le 2026-08-09, et le motif s'écrit ici plutôt que dans un commit :
// `mm` est SORTIE du langage (Romain 2026-06-26, fermée le 2026-08-09), donc elle disparaît des
// deux listes — une forme qui n'existe plus ne peut pas être éprouvée. C'est le seul abaissement
// légitime de ce socle : une forme RETIRÉE du langage. Un seuil qu'on baisse parce qu'un cas
// « ne passe plus » est un socle qu'on désarme ; celui-ci se baisse parce que l'espace lui-même a
// rétréci, et le compte des directives réservées ci-dessus reste, lui, à 40 pour le prouver.
// ⛔ LE PLANCHER PORTE DÉSORMAIS SUR L'UNION, PAS SUR LA MATRICE. La matrice se dérive de l'union :
// un plancher posé sur elle mesurerait sa propre soustraction. C'est l'UNION qui dit la taille du
// vocabulaire, et c'est elle qui doit refuser de rétrécir sans qu'on le sache.
// Mesure du 2026-08-19 : 49 mots à l'union, 34 déclarations, 14 contrôles de portée, 1 légitime
// après. Le plancher descend d'un cran quand un mot SORT du langage, jamais parce qu'un extracteur
// a cessé de voir.
ok(UNION.length >= 49,
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
