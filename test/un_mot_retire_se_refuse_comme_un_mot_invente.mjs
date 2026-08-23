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
import { readFileSync } from 'node:fs';
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
 * LES MOTS RETIRÉS, LEUR DÉCISION, ET CE QUI RESTE VIVANT SOUS LE MÊME NOM.
 *
 * ⛔ UNE DÉCISION RETIRE UN EMPLOI, JAMAIS UN NOM — et cette liste énonçait le retrait comme TOTAL.
 * Une entrée portait `['duration', '2026-08-04']` : le mot et la date, rien sur la place. Un lecteur
 * qui l'ouvre sans lire le volet 5 conclut « ce mot est mort », et c'est arrivé le 2026-08-22 —
 * `duration` a été signalé comme un mot vivant compté pour mort, alors que le garde n'accuse QUE sa
 * forme de MOT DE TÊTE, qui est bien celle que la décision supprime.
 *
 * ⚠️ CE QUE CE GARDE JUGE, ET LUI SEUL : le mot écrit EN TÊTE D'UNE LIGNE DÉCLARATIVE. Il ne dit
 * rien d'un homonyme employé ailleurs — champ de prototype, valeur d'un ensemble, clé d'une
 * librairie. La troisième colonne le nomme quand il existe, MESURÉ, pour qu'aucun lecteur n'ait à
 * le déduire de l'absence.
 *
 * ⛔ LA TROISIÈME COLONNE NE SE DÉDUIT PAS D'UN NOM DE FICHIER. Mon premier relevé cherchait la
 * décision de chaque mot par son nom dans `hub/decisions/` : il a rendu une décision de juin sur les
 * contrôles pour `transport`, et une décision de syntaxe pour `cv` — des fichiers qui portent le mot
 * sans le retirer. Ce qui est écrit ici est MESURÉ au compilateur, forme par forme.
 */
const MOTS_RETIRES = [
  // [mot, décision, ce qui reste VIVANT sous le même nom — mesuré, ou null]
  ['routing', '2026-07-16', null],
  ['transcription', '2026-08-07', null],
  ['var', '2026-08-16', null],
  ['label', '2026-07-28', null],
  ['macro', '2026-08-16', null],
  ['scene', '2026-07-29', 'portée d\'écriture dans la donnée — `scope[] = scene` ; refusé en scène'],
  // (les témoins compilables de la colonne 3 sont plus bas, dans TEMOINS_VIVANTS)
  ['transport', '2026-08-04', 'composant par défaut — `core.defaults.components.transport` ; refusé en scène'],
  ['library', '2026-08-06', null],
  ['alias', '2026-08-15', null],
  ['mm', '2026-06-26', null],
  ['speed', '2026-06-26', null],
  ['map', '2026-07-27', null],
  ['mine', '2026-08-17', null],
  ['factory', '2026-08-20', null],
  ['wire', '2026-08-15', null],
  ['cv', '2026-08-08', 'type de module — `mod.type = cv` ; refusé en scène'],
  ['gate', '2026-08-15', null],
  ['trigger', '2026-08-15', null],
  ['sub', '2026-08-04', 'VALEUR de mode — `mode:sub` COMPILE'],
  ['tempx', '2026-08-06', null],
  ['duration', '2026-08-04', 'CHAMP du prototype de terminal — `terminal zz(duration:2)` COMPILE'],
  ['timepatterns', null, 'directive réservée — `timepatterns` NU COMPILE ; son sort n\'est pas tranché'],
];

/**
 * LES GRAPHIES SOUS LESQUELLES UN MOT DE TÊTE S'ÉCRIT. Elles ne tombent PAS au même endroit du
 * lecteur — c'est exactement ce qui a laissé un silence vivre sous une réparation.
 */
const GRAPHIES = [
  // ⛔ LA GRAPHIE NUE MANQUAIT, ET C'EST `timepatterns` QUI L'A DIT. Mesure du 2026-08-22 : les
  // vingt-deux mots écrits SEULS en tête de scène — vingt-et-un refusent, UN passe, et ce garde ne
  // le voyait pas. Ses cinq graphies portaient toutes un argument, une valeur ou un composant ;
  // aucune ne posait le mot tout court. Un garde qui énumère des formes en oublie toujours une —
  // celle qu'on n'écrit pas parce qu'elle ne ressemble à rien.
  ['nu, seul',           (m) => `${m}`],
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
 *   timepatterns|nu, seul ⛔ INSCRIT LE 2026-08-22, ET IL EST LE SEUL DES VINGT-DEUX : écrit tout
 *                         court, il COMPILE. La sixième graphie l'a trouvé le jour où elle est
 *                         entrée — les cinq précédentes portaient toutes un argument, une valeur ou
 *                         un composant.
 *                         ⚠️ SA QUESTION EST OUVERTE ET ELLE A DEUX RÉPARATIONS OPPOSÉES : son
 *                         entrée porte une décision `null`, donc AUCUNE décision ne le retire. Ou
 *                         bien il doit refuser, et c'est le lecteur qu'on répare ; ou bien il est
 *                         VIVANT comme directive réservée, et c'est son entrée dans cette liste qui
 *                         est la faute. Choisir l'une reviendrait à trancher un mot du langage.
 *                         Remonté à l'architecte le 2026-08-22 ; inscrit, pas jugé.
 */
const RETARD = new Set([
  'cv|nu, un argument',
  'gate|nu, un argument',
  'trigger|nu, un argument',
  'timepatterns|nu, seul',
  'timepatterns|nu, un argument',
  'timepatterns|deux-points, mot',
  'timepatterns|deux-points, nombre',
]);
let retardsVus = 0;

/**
 * ⛔ LA TROISIÈME COLONNE SE PROUVE, SINON C'EST DE LA PROSE QUE RIEN NE TIENT.
 *
 * Mesuré le 2026-08-22 en l'injectant : retirer l'emploi vivant d'une entrée ne fait rougir AUCUN
 * volet. La colonne informait le lecteur et ne s'appuyait sur rien — exactement la forme qu'on
 * reproche à une donnée rangée où personne ne va la chercher. Ces témoins la rendent vraie : chacun
 * compile la forme citée et exige le verdict annoncé.
 *
 * ⚠️ Et le jour où un de ces emplois meurt, c'est ICI que ça crie — pas dans six semaines chez un
 * lecteur qui aura cru la colonne sur parole.
 */
const TEMOINS_VIVANTS = [
  ['duration', 'terminal zz(duration:2)', true,  'CHAMP du prototype de terminal'],
  ['sub',      'mode:sub',                true,  'VALEUR de mode'],
  ['scene',    'scene',                   false, 'portée dans la donnée, REFUSÉE en scène'],
  ['transport', 'transport.midi',         false, 'composant par défaut, REFUSÉ en scène'],
  ['cv',       'cv zz',                   false, 'type de module, REFUSÉ en scène'],
];
for (const [mot, forme, doitCompiler, quoi] of TEMOINS_VIVANTS) {
  const e = erreurs(`${T}${forme}\n-----\nS -> C4\n`);
  ok(doitCompiler ? e.length === 0 : e.length > 0,
    `COLONNE 3 — '${mot}' est annoncé « ${quoi} », donc '${forme}' doit `
    + `${doitCompiler ? 'COMPILER' : 'être REFUSÉ'}. Reçu : ${e[0]?.slice(0, 90) ?? 'compile'}`);
}
ok(TEMOINS_VIVANTS.length === MOTS_RETIRES.filter(([, , v]) => v).length - 1,
  `COLONNE 3 — ${TEMOINS_VIVANTS.length} témoin(s) pour `
  + `${MOTS_RETIRES.filter(([, , v]) => v).length} entrée(s) portant un emploi vivant. L'écart `
  + `attendu est de UN : 'timepatterns', dont le sort n'est pas tranché et qui est déjà au retard. `
  + `Toute autre entrée sans témoin serait une affirmation que rien ne tient.`);

console.log(`[mot retiré] ${MOTS_RETIRES.length} mots × ${GRAPHIES.length} graphies, `
  + `chacun contre le témoin inventé · ${RETARD.size} au retard inventorié`);

for (const [mot, decision, vivant] of MOTS_RETIRES) {
  for (const [nomGraphie, ecrire] of GRAPHIES) {
    const eRetire = erreurs(`${T}${ecrire(mot)}\n-----\nS -> C4\n`);
    const eInvente = erreurs(`${T}${ecrire(INVENTE)}\n-----\nS -> C4\n`);

    // ⛔ D'ABORD : LE TÉMOIN LUI-MÊME DOIT ÊTRE REFUSÉ. Un mot qui n'a jamais existé et qui compile
    // rend toute la comparaison muette — les deux côtés seraient « vides », donc « identiques ».
    ok(eInvente.length >= 1,
      `TÉMOIN MUET — '${INVENTE}' écrit « ${nomGraphie} » COMPILE sans un mot. Toute comparaison à `
      + `ce témoin est alors vide des deux côtés, et ce garde certifierait un silence.`);
    if (eInvente.length === 0) continue;

    // ⛔ UN RETARD INVENTORIÉ VAUT ICI AUSSI, et il ne le faisait pas. Ce volet exigeait un refus
    // AVANT de consulter le registre : une entrée inscrite avec sa cause rougissait quand même, donc
    // le registre ne servait qu'à la moitié basse de la matrice. Mesuré le 2026-08-22 en y inscrivant
    // `timepatterns|nu, seul` — le garde a crié sur une entrée qu'il venait d'accepter.
    const cleAmont = `${mot}|${nomGraphie}`;
    if (!RETARD.has(cleAmont)) {
      ok(eRetire.length >= 1,
        `'${mot}' écrit « ${nomGraphie} » COMPILE, alors qu'il est sorti du langage`
        + `${decision ? ` le ${decision}` : ''} — une ligne avalée sans effet est le pire des refus.`
        + `${vivant ? ` (ce mot reste vivant AILLEURS : ${vivant} — ce volet ne juge que sa forme de `
        + `MOT DE TÊTE.)` : ''}`);
    }
    // ⛔ UNE ENTRÉE DE RETARD SE COMPTE AVANT CE RACCOURCI. Le `continue` ci-dessous saute la fin de
    // la boucle quand le mot COMPILE — or c'est exactement l'état d'une entrée inscrite au retard.
    // Elle n'était donc jamais atteinte, et le volet de vérification du registre criait « 6 sur 7 »
    // pour une entrée parfaitement en règle. Un raccourci placé avant un compteur le rend aveugle
    // au seul cas qu'il existe pour compter.
    if (eRetire.length === 0) {
      if (RETARD.has(cleAmont)) retardsVus++;
      continue;
    }

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

// ── LE CINQUIÈME DOMICILE — LES PRODUCTIONS DE LA GRAMMAIRE ÉCRITE ──────────────────────────
// ⛔ RIEN NE COMPILE UNE PRODUCTION EBNF. L'oracle juge les blocs `bpscript` ; les blocs `ebnf` ne
// sont pas des scènes, donc aucun garde ne les regardait. Mesuré le 2026-08-19 : `EBNF.md` déclarait
// encore `MODE = "ord" | "random" | …` — la valeur sortie le matin même — et
// `provenance = "factory" | "mine"`, alors que `mine.` est refusé depuis le 2026-08-17.
//
// Un littéral d'EBNF est une PRESCRIPTION au même titre qu'un exemple : il dit ce que le langage
// accepte. C'est le cinquième domicile d'un mot retiré, après le parser, la liste réservée, les
// messages de refus et les descriptions de librairie.
//
// ⚠️ ET LA MESURE PORTE SUR LES LITTÉRAUX, PAS SUR LA PROSE. Un mot retiré se cite légitimement dans
// une phrase qui explique ce qui a changé ; ce qui ne se cite pas, c'est une production qui le
// DÉCLARE comme forme acceptée. On ne lit donc que l'intérieur des blocs `ebnf`, et dans ces blocs
// que ce qui est entre guillemets.
{
  const ebnf = readFileSync(new URL('../docs/spec/EBNF.md', import.meta.url), 'utf-8');
  const blocs = [...ebnf.matchAll(/```ebnf\n([\s\S]*?)```/g)].map((m) => m[1]);
  ok(blocs.length >= 10,
    `5. ${blocs.length} bloc(s) de production lus dans EBNF.md — sous ce seuil, l'extraction ne `
    + `reconnaît plus une production et ce volet devient un ensemble vide.`);
  // ⛔ UN MOT SORT D'UNE PLACE, JAMAIS DE TOUTES SES PLACES — et l'EBNF distingue les deux par sa
  // propre convention. Une production dont le membre gauche est en MAJUSCULES énumère les VALEURS
  // d'un ensemble : `MODE = "ord" | "sub" | …` déclare des valeurs de mode, `TERMINAL_VALUE` des
  // clés de terminal. Une production en minuscules déclare une FORME du langage.
  //
  // Mesuré : `mode:sub` COMPILE et `def cloche duration:2` COMPILE, alors que le mot de tête `sub`
  // est remplacé par `homomorphism` et que la durée de SCÈNE est supprimée. Ma première écriture
  // les accusait tous les deux — elle jugeait le MOT là où il fallait juger sa PLACE.
  const litteraux = new Set();
  const valeurs = new Set();
  for (const b of blocs) {
    for (const ligne of b.split('\n')) {
      const gauche = ligne.match(/^\s*([A-Za-z_][\w]*)\s*=/);
      const cible = (gauche && gauche[1] === gauche[1].toUpperCase()) ? valeurs : litteraux;
      for (const m of ligne.matchAll(/"([A-Za-z][\w.-]*)"/g)) cible.add(m[1]);
    }
  }
  ok(litteraux.size >= 15,
    `5. ${litteraux.size} littéral(aux) de FORME extrait(s) — l'extraction s'est vidée`);
  ok(valeurs.size >= 20,
    `5. ${valeurs.size} littéral(aux) de VALEUR extrait(s) — la distinction s'est effondrée, et `
    + `tout serait jugé comme une forme.`);
  for (const [mot] of MOTS_RETIRES) {
    ok(!litteraux.has(mot),
      `5. la grammaire écrite DÉCLARE '${mot}' comme forme acceptée, alors qu'il est sorti du `
      + `langage. Une production est une prescription : rien ne la compile, et elle enseigne.`);
  }
}

// ── LE SIXIÈME DOMICILE — LA PROSE DES SPECS ────────────────────────────────────────────────
// ⛔ TROUVÉ PAR BPx LE 2026-08-19, ET AUCUN DE MES GARDES NE POUVAIT LE VOIR. Trois passages de
// LANGUAGE.md disaient encore que l'arobase ouvre une ligne déclarative — dont deux CONTREDITS PAR
// LEUR PROPRE EXEMPLE, dans la cellule d'à côté ou le bloc juste dessous. L'oracle compile les
// BLOCS ; le volet du dessus lit les PRODUCTIONS ; la PROSE n'était lue par rien.
//
// Une phrase de spec est une prescription au même titre qu'un exemple : c'est même la seule que
// beaucoup de lecteurs lisent. Et elle survit d'autant mieux qu'elle est juste à côté d'un exemple
// qui la dément — l'exemple change, la phrase reste.
//
// ⚠️ ON NE LIT QUE CE QUI PRESCRIT, PAS CE QUI RACONTE. Un signe cité entre accents graves dans une
// table de correspondances avec un AUTRE langage n'est pas une prescription de celui-ci.
{
  const SPECS = ['LANGUAGE.md', 'AST.md', 'EBNF.md'];
  let lignesLues = 0;
  const coupables = [];
  for (const nom of SPECS) {
    const texte = readFileSync(new URL('../docs/spec/' + nom, import.meta.url), 'utf-8');
    let dansUnBloc = null;
    texte.split('\n').forEach((ligne, i) => {
      const fence = ligne.match(/^```(\w*)/);
      if (fence) { dansUnBloc = dansUnBloc === null ? (fence[1] || 'nu') : null; return; }
      // Un bloc de code est jugé par l'oracle (bpscript) ou appartient à un autre langage (bp3).
      if (dansUnBloc !== null) return;
      lignesLues++;
      // L'arobase PRESCRITE : collée à un mot, hors d'une table de correspondance native.
      if (!/(^|[\s(`|])@[a-z]/.test(ligne)) return;
      if (/\bBP3\b|natif|native/i.test(ligne)) return;   // une correspondance avec l'autre langage
      coupables.push(`${nom}:${i + 1} — ${ligne.trim().slice(0, 88)}`);
    });
  }
  ok(lignesLues >= 2000,
    `7. ${lignesLues} ligne(s) de prose lues dans ${SPECS.length} specs — sous ce seuil, la lecture `
    + `ne reconnaît plus la prose et ce volet devient un ensemble vide.`);
  ok(coupables.length === 0,
    `7. ${coupables.length} phrase(s) de spec écrivent l'arobase, sortie du langage le 2026-08-16 :\n`
    + `       ${coupables.slice(0, 8).join('\n       ')}`);
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
  ['le type en tête',             `${T}flag section:1\n-----\nS -> C4\n`],
  ['un symbole déclaré',          `${T}symbol x\n-----\nS -> C4 x\n`],
  // ⛔ `lfo osc1` A CHANGÉ DE CAMP LE 2026-08-23. Ce complément listait des formes qui doivent
  // COMPILER, pour que « le mot est refusé » ne se confonde pas avec « tout est refusé ». Une
  // instance de module n'en est plus une : le catalogue `mod` est archivé et ses trois entrées
  // quittent le langage. La ligne sort du complément — elle ne migre pas vers les formes refusées,
  // parce que ce garde-là porte sur les mots RETIRÉS NOMMÉMENT, et `adsr` n'est pas un mot du
  // langage retiré : c'était une ENTRÉE DE CATALOGUE, une autre nature.
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
// ⚠️ PLANCHER 16 → 15 le 2026-08-23, ET IL PORTE SA CAUSE. La forme partie est `lfo osc1`, une
// instance de module : le catalogue `mod` est archivé et ses trois entrées quittent le langage.
// Un plancher qui baisse sans dire quelle forme l'a quitté ne se distingue pas d'un plancher qu'on
// desserre — et c'est précisément ce que ce garde existe pour refuser ailleurs.
ok(CE_QUI_VIT.length >= 15, 'le complément ne s\'est pas vidé');
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
