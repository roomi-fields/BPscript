#!/usr/bin/env node
/**
 * GARDE — UN MOT RETIRÉ SE REFUSE EXACTEMENT COMME UN MOT INVENTÉ.
 *
 * Règle de Romain, 2026-08-18 : « pas de message dédié, pas de renvoi, pas de trace dans le code.
 * Seuls restent les gardes qui vérifient que le mot ne marche plus. »
 *
 * ⛔ CE QUI DISCRIMINE EST LE TÉMOIN, PAS LE MESSAGE. Lire un refus et le trouver « générique » est
 * un jugement ; comparer deux refus est une mesure. Le mot inventé n'a jamais existé : si le mot
 * retiré rend le même texte au nom près, il est débranché.
 *
 * ⛔ ET LE CRITÈRE DU REGISTRE NE DISCRIMINE PLUS. `hub/decisions/MOTS-SORTIS.md` disait que ce qui
 * tranche est « le mot que le refus nomme — le mot lui-même s'il est débranché, son argument s'il
 * est encore reconnu ». Depuis que le TYPE vient en tête, un mot INVENTÉ suivi de deux arguments
 * fait lui aussi accuser son argument : `macro aaa bbb` et `zorglubinvente aaa bbb` rendent le même
 * message, mot pour mot. Seule la comparaison au témoin sépare encore les deux cas.
 *
 * ⛔ ET UN MOT S'ÉCRIT À PLUSIEURS GRAPHIES, QUI NE TOMBENT PAS AU MÊME ENDROIT. Mesuré le
 * 2026-08-19 en retirant quatre écriteaux : `<mot>:<nombre>` était refusé, `<mot>:<mot>` était
 * AVALÉ EN SILENCE — le lecteur rangeait le second dans le champ d'un canal de sortie et plus rien
 * ne regardait la clé. Une seule graphie mesurée aurait déclaré le retrait fait.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const T = 'core\nalphabet.western\n';
const INVENTE = 'zorglubinvente';
const erreurs = (src) => {
  try { return (compileToBPxAST(src).errors || []).map((e) => String(e.message ?? e)); }
  catch (e) { return ['JETÉ : ' + String(e.message)]; }
};
/** Le texte d'un refus, sa position ôtée et le NOM du mot neutralisé : deux refus identiques à
 *  cela près sont le MÊME refus, chacun nommant simplement ce que l'auteur a écrit.
 *
 *  ⛔ LA NEUTRALISATION NE VAUT QUE SUR LE MOT CITÉ, JAMAIS SUR LA PROSE. Mon premier jet
 *  remplaçait le mot PARTOUT : le refus d'une invocation dit « rien ne distingue ce cas d'une
 *  scène qui n'a rien déclaré », et `scene` y était donc neutralisé une fois de plus côté retiré
 *  que côté témoin. Deux refus identiques rendaient deux empreintes différentes. On ne neutralise
 *  que les occurrences CITÉES — entre apostrophes, ou suivies d'un séparateur de graphie. */
const empreinte = (msgs, mot) => {
  let t = msgs.join(' ').replace(/at line \d+:\d+/g, '');
  // ⛔ SYMÉTRIQUE, SINON L INSTRUMENT FABRIQUE L ÉCART. Les DEUX noms sont neutralisés dans les
  // DEUX textes. Sans cela, un mot qui apparaît aussi dans la PROSE du refus — « rien ne distingue
  // ce silence d'une scene qui n'a pas declare » — est neutralisé une fois de plus du côté retiré
  // que du côté témoin, et deux refus rigoureusement identiques rendent deux empreintes
  // différentes. J'ai accusé le sujet avant l'instrument, et c'était l'instrument.
  for (const n of [mot, INVENTE]) t = t.split(n).join('§');
  return t.trim();
};

/**
 * LES MOTS RETIRÉS, ET LEUR DÉCISION. Nommés un par un : une liste dérivée d'un motif attraperait
 * l'anglais courant et les procédures natives homonymes.
 */
const MOTS_RETIRES = [
  ['routing', '2026-07-16'], ['transcription', '2026-08-07'], ['var', '2026-08-16'],
  ['label', '2026-07-28'], ['macro', '2026-08-16'], ['scene', '2026-07-29'],
  ['transport', '2026-08-04'], ['library', '2026-08-06'], ['alias', '2026-08-15'],
  ['mm', '2026-06-26'], ['speed', '2026-06-26'], ['map', '2026-07-27'],
  ['mine', '2026-08-17'], ['wire', '2026-08-15'], ['cv', '2026-08-08'],
  ['gate', '2026-08-15'], ['trigger', '2026-08-15'], ['sub', '2026-08-04'],
  ['tempx', '2026-08-06'], ['duration', '2026-08-04'], ['timepatterns', null],
];

/**
 * LES GRAPHIES SOUS LESQUELLES UN MOT DE TÊTE S'ÉCRIT. Elles ne tombent PAS au même endroit du
 * lecteur — c'est exactement ce qui a laissé un silence vivre sous une réparation.
 */
const GRAPHIES = [
  ['nu, deux arguments', (m) => `${m} alpha beta`],
  ['nu, un argument',    (m) => `${m} alpha`],
  ['deux-points, mot',   (m) => `${m}:studio`],
  ['deux-points, nombre', (m) => `${m}:64`],
  ['point, entrée',      (m) => `${m}.dhati`],
];

/**
 * LE RETARD INVENTORIÉ — mots × graphies qui ne se refusent PAS encore comme un mot inventé, avec
 * leur cause. Inscrits le 2026-08-19, trouvés par ce garde en naissant.
 *
 * ⛔ CHACUN EST UN DÉFAUT NOMMÉ, PAS UNE EXEMPTION. Un retard porte sa cause et se resserre ; une
 * exemption ne porte rien et survit à ce qui l'a fait naître. Le volet du dessous EXIGE que chaque
 * entrée rougisse encore : celle qui a cessé de rougir doit sortir du registre, à la main.
 *
 *   cv · gate · trigger   ce sont des MOTS-CLÉS DU DÉCOUPEUR (`KEYWORDS`, tokenizer.js) : ils ne
 *                         sont pas lus comme des noms ordinaires, donc ils ne tombent pas dans le
 *                         refus du type en tête. Le registre du hub le dit déjà — « débranchés du
 *                         parser, mais déclarés dans une donnée ». Leur retrait est un geste du
 *                         DÉCOUPEUR, hors du périmètre tranché le 2026-08-19.
 *   timepatterns          le lecteur le CONSOMME encore : le refus accuse son argument, et la
 *                         graphie à deux-points rend « Expected EQUALS ». Aucune décision datée ne
 *                         le retire — c'est une mesure d'Atlas relayée le 2026-08-19, et son sort
 *                         se tranche avec l'architecte.
 */
const RETARD = new Set([
  'cv|nu, un argument',
  'gate|nu, un argument',
  'trigger|nu, un argument',
  'timepatterns|nu, un argument',
  'timepatterns|deux-points, mot',
  'timepatterns|deux-points, nombre',
]);
let retardsVus = 0;

console.log(`[mot retiré] ${MOTS_RETIRES.length} mots × ${GRAPHIES.length} graphies, `
  + `chacun contre le témoin inventé · ${RETARD.size} au retard inventorié`);

for (const [mot, decision] of MOTS_RETIRES) {
  for (const [nomGraphie, ecrire] of GRAPHIES) {
    const eRetire = erreurs(`${T}${ecrire(mot)}\n-----\nS -> C4\n`);
    const eInvente = erreurs(`${T}${ecrire(INVENTE)}\n-----\nS -> C4\n`);

    // ⛔ D'ABORD : LE TÉMOIN LUI-MÊME DOIT ÊTRE REFUSÉ. Un mot qui n'a jamais existé et qui compile
    // rend toute la comparaison muette — les deux côtés seraient « vides », donc « identiques ».
    ok(eInvente.length >= 1,
      `TÉMOIN MUET — '${INVENTE}' écrit « ${nomGraphie} » COMPILE sans un mot. Toute comparaison à `
      + `ce témoin est alors vide des deux côtés, et ce garde certifierait un silence.`);
    if (eInvente.length === 0) continue;

    ok(eRetire.length >= 1,
      `'${mot}' écrit « ${nomGraphie} » COMPILE, alors qu'il est sorti du langage`
      + `${decision ? ` le ${decision}` : ''} — une ligne avalée sans effet est le pire des refus.`);
    if (eRetire.length === 0) continue;

    // ⛔ LE MOT RETIRE EST PASSE AUX DEUX APPELS, ET C EST LA MOITIE QUI MANQUAIT. En passant
    // `INVENTE` au second, la prose du TEMOIN gardait le mot retire en clair alors que celle du
    // retire etait neutralisee : la fonction etait symetrique, l usage ne l etait pas.
    const identique = empreinte(eRetire, mot) === empreinte(eInvente, mot);
    const cle = `${mot}|${nomGraphie}`;
    if (RETARD.has(cle)) {
      // ⛔ UN RETARD SE RESSERRE OU IL SORT. Une entrée inscrite qui a cessé de rougir se retire
      // À LA MAIN, datée — sinon le registre compte un retard qui n'existe plus, et le compte
      // reste juste pendant que la raison ment.
      ok(!identique,
        `'${mot}' écrit « ${nomGraphie} » est inscrit au retard et se refuse DÉSORMAIS comme un `
        + `mot inventé — RETIRE-le du registre, daté.`);
      retardsVus++;
      continue;
    }
    ok(identique,
      `'${mot}' écrit « ${nomGraphie} » reçoit un refus PROPRE, pas celui d'un mot inventé.\n`
      + `      retiré  : ${eRetire[0]?.slice(0, 150)}\n`
      + `      inventé : ${eInvente[0]?.slice(0, 150)}`);
  }
}

// ── LE COMPLÉMENT — CE QUI DOIT ENCORE VIVRE ────────────────────────────────────────────────
// ⛔ SANS LUI, UN COMPILATEUR QUI REFUSERAIT TOUT PASSERAIT CE GARDE EN TRIOMPHE. Plusieurs mots
// retirés portent une NOTION vivante, ou partagent leur nom avec un axe de catalogue : le retrait
// vise la directive de tête, jamais la notion.
const CE_QUI_VIT = [
  ['le socle',                    `core\n-----\nS -> C4\n`],
  ['un alphabet',                 `${T}-----\nS -> C4\n`],
  ['un accordage',                `core\ntuning.sargam_22shruti\n-----\nS -> sa\n`],
  ['une convention de registre',  `${T}octaves.western\n-----\nS -> C4\n`],
  ['un réglage numérique',        `${T}tempo:120\n-----\nS -> C4\n`],
  ['la fréquence de référence',   `${T}diapason:442\n-----\nS -> C4\n`],
  ['le canal d\'un alphabet',     `core\nalphabet.western:audio\n-----\nS -> C4\n`],
  ['une sortie de scène',         `${T}out.midi(ch:1)\n-----\nS -> C4\n`],
  ['un acteur et ses clés',       `core\nactor v\n  alphabet.sargam\n  out.audio\n-----\nS -> sa\n`],
  ['le type en tête',             `${T}flag section(intro:1, drop:2)\n-----\nS -> C4\n`],
  ['un symbole déclaré',          `${T}symbol x\n-----\nS -> C4 x\n`],
  ['une instance de module',      `${T}lfo osc1\n-----\nS -> C4\n`],
  ['une table d\'homomorphisme',  `core\nhomomorphism.dhati\n-----\nS -> C4\n`],
  ['une définition nommée',       `${T}def k (vel:120)\n-----\nS -> C4\n`],
  ['l\'état de départ',           `${T}init\n  \`sc: x\`\n-----\nS -> C4\n`],
  ['un mode de dérivation',       `${T}-----\nS -> C4\nmode:rnd\nT -> D4\n`],
];
for (const [quoi, src] of CE_QUI_VIT) {
  const e = erreurs(src);
  ok(e.length === 0, `COMPLÉMENT — ${quoi} doit COMPILER (reçu : ${e[0]?.slice(0, 140)})`);
}

// ── TÉMOINS ANTI-RÉTRÉCISSEMENT ─────────────────────────────────────────────────────────────
ok(MOTS_RETIRES.length >= 21, 'la liste des mots retirés ne s\'est pas vidée');
ok(GRAPHIES.length >= 5, 'la matrice des graphies ne s\'est pas vidée');
ok(CE_QUI_VIT.length >= 16, 'le complément ne s\'est pas vidé');
ok(passe > 200, `le garde doit avoir EXAMINÉ, pas seulement tourné (${passe} assertions)`);
// ⛔ ET LE REGISTRE DE RETARD DOIT ÊTRE ATTEINT EN ENTIER. Une entrée dont la GRAPHIE a disparu de
// la matrice ne rougirait jamais et ne serait jamais retirée : elle deviendrait une exemption
// muette, exactement ce que ce registre refuse d'être.
ok(retardsVus === RETARD.size,
  `${retardsVus} entrée(s) de retard atteinte(s) sur ${RETARD.size} — une entrée que la matrice `
  + `n'atteint plus est une exemption muette. Vérifier son mot et sa graphie.`);

if (echecs.length) {
  console.error(`[mot retiré] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[mot retiré] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
