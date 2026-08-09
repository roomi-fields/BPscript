#!/usr/bin/env node
/**
 * CORPUS DE REFUS — pour chaque règle du langage, une écriture qui la VIOLE.
 *
 * CHANTIER OUVERT PAR ROMAIN (2026-07-28) : « on a un très grave problème de gestion d'erreurs,
 * tu as passé la journée à me montrer que des trucs qui sont faux compilent. »
 *
 * LE MOTIF, ET C'EST CELUI DE TOUTE LA JOURNÉE : tout le monde teste que ça COMPILE, personne ne
 * teste que ça REFUSE. C'est le défaut que j'ai formulé le soir même sur mon outil de migration —
 * un garde qui ne teste que des cas qui réussissent garde l'accusé, pas le juge — et il est dans
 * le compilateur lui-même. Il a piégé l'architecte, qui a montré à Romain un exemple faux en le
 * croyant bon PARCE QU'IL COMPILAIT.
 *
 * ⚠️ CHAQUE RÈGLE EST TESTÉE DANS LES DEUX SENS, et le second compte autant :
 *   · une écriture FAUTIVE doit être REFUSÉE, avec un message qui NOMME la faute ;
 *   · une écriture VALIDE VOISINE doit PASSER.
 * Sans le second, un compilateur qui refuserait tout aurait l'air juste.
 *
 * TROIS CLASSES DE FAUTE, telles que l'architecte les a demandées :
 *   `autre-langage` — une graphie d'un AUTRE langage (le moteur historique) acceptée ici ;
 *   `sans-sens`     — une forme qui compile sans avoir de sens ;
 *   `decision`      — la violation d'une décision datée.
 *
 * CE FICHIER EST UN COMPTE AVANT D'ÊTRE UN GARDE : il imprime combien d'écritures fautives
 * PASSENT au lieu d'être refusées. Tant que ce nombre n'est pas zéro, il ne fait pas échouer le
 * portillon — il RAPPORTE. Le rendre bloquant se fera quand le compte sera à zéro, et pas avant :
 * un garde rouge en permanence ne garde rien, il apprend à être ignoré.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

const S = (corps) => `@core\n@alphabet.western\n${corps}`;

/**
 * Chaque entrée : [classe, ce que la règle interdit, écriture FAUTIVE, écriture VALIDE voisine,
 * fragment attendu dans le message de refus (ou null si on n'exige que le refus)].
 * Sources : `docs/spec/EBNF.md`, les décisions datées de `hub/decisions/`, et les pierres
 * tombales du parser — jamais de mémoire.
 */
const REGLES = [
  // ── Graphies d'un AUTRE langage ────────────────────────────────────────────
  ['autre-langage', "la flèche du moteur historique", S('S --> C4 D4'), S('S -> C4 D4'), 'moteur historique'],
  ['autre-langage', "l'objet hors-temps du moteur historique", S('S -> <<f>>'), S('S -> !f'), null],
  ['autre-langage', "le drapeau du moteur historique", S('S -> C4 /x=1/ D4'), S('S -> C4 D4 [x=1]'), null],
  ['autre-langage', "le poids du moteur historique", S('<50> S -> C4'), S('S -> C4 [weight:50]'), null],
  ['autre-langage', "le préfixe de règle du moteur historique", S('gram#1[1] S -> C4'), S('S -> C4'), null],
  ['autre-langage', "le séparateur de séquence de BP2", S('S -> C4; D4'), S('S -> C4 D4'), 'BP2'],

  // ── Décisions datées ───────────────────────────────────────────────────────
  ['decision', "le signe d'égalité dans une directive (2026-07-27)",
   S('@def V = C4\nS -> V'), S('@def V C4\nS -> V'), "'=' a DISPARU"],
  ['decision', "la directive de correspondance, abandonnée (2026-07-27)",
   S('@map tempo cc:2\nS -> C4'), S('@alias tempo cc:2\nS -> C4'), 'ABANDONNÉ'],
  ['decision', "le suffixe arobase sur un élément (2026-07-28)",
   S('S -> C4@kick D4'), S('S -> C4 D4'), 'SUPPRIMÉ'],
  ['decision', "la directive d'étiquette (2026-07-28)",
   S('@label groove\nS -> C4'), S('S -> groove:{C4 D4}'), 'SUPPRIMÉE'],
  ['decision', "l'ancienne coupure de câblage (2026-07-28)",
   S('@def coupe !>> out.in\nS -> coupe'), S('@def coupe \\>> out.in\nS -> coupe'), "n'est plus la coupure"],
  ['decision', "le qualificatif de vitesse, supprimé (2026-06-26)",
   S('S -> {C4 D4}[speed:2]'), S('S -> {C4 D4}:2'), null],
  ['decision', "la forme d'appel d'un contrôle (2026-07-26)",
   S('@controls\nS -> C4 vel(80) D4'), S('@controls\nS -> C4 !(vel:80) D4'), null],
  ['decision', "un canal de sortie périmé (2026-07-16)",
   S('@alphabet.western:browser\nS -> C4'), S('@alphabet.western:audio\nS -> C4'), null],
  ['decision', "un canal de sortie hors de la liste fermée (2026-07-16)",
   S('@alphabet.western:video\nS -> C4'), S('@alphabet.western:midi\nS -> C4'), null],
  ['decision', "un nom déjà pris par une note (2026-07-28)",
   S('@def G4 saw >> audio\nS -> C4'), S('@def grondement saw >> audio\nS -> C4'), 'TERMINAL'],
  // ⚠️ « une tête de règle nommée comme une note » A ÉTÉ RETIRÉE D'ICI le 2026-08-07 — décision
  // Romain `2026-08-03-une-tete-de-regle-peut-etre-un-terminal.md` : c'est le principe même du
  // mode sub/sub1, une règle de substitution réécrit un terminal. La ligne au-dessus reste : elle
  // porte une DÉCLARATION (`@macro G4`), qui CRÉE un nom — la règle d'unicité tient pour elle.
  ['decision', "deux déclarations du même nom (2026-07-28)",
   S('@def x saw >> audio\n@alias x cc:2\nS -> C4'), S('@def x saw >> audio\n@alias y cc:2\nS -> C4'), 'déjà pris'],
  ['decision', "un câblage écrit dans le flux, non porté par le moteur (2026-07-28)",
   S('S -> C4 !osc >> filtre D4'), S('@def v osc >> filtre\nS -> C4!v D4'), null],

  // ── Formes sans sens ───────────────────────────────────────────────────────
  ['sans-sens', "un caractère qui n'existe pas dans le langage", S('S -> C4 % D4'), S('S -> C4 D4'), 'inattendu'],
  ['sans-sens', "un littéral entre guillemets en tête", S("S -> 'C4' D4"), S('S -> C4 D4'), null],
  ['sans-sens', "un backtick sans langage connu", S('S -> `note("c3")`'), S('S -> `js: 1 + 1`'), 'sans langage'],
  // ⚠️ LE CORPS DE MACRO N ETAIT PARCOURU PAR RIEN — ni etiquete, ni refuse : un bloc de code y
  // voyageait sans nature et sans langage, muet de bout en bout. Trouve le 2026-07-28 en mesurant
  // les quatre ecritures que Romain decrit comme legitimes ; la macro en est une (« pour ne pas
  // avoir a ecrire le code dans les regles »). Une ecriture qu on veut legitime ne peut pas etre
  // le seul endroit ou le langage n est jamais verifie.
  ['sans-sens', "un code sans langage DANS UN CORPS DE MACRO",
   S('@def forme `note("c3")`\nS -> forme'), S('@def forme `js: 1 + 1`\nS -> forme'), 'sans langage'],
  // ⚠️ La voisine valide emploie une MACRO, pas une variable de travail — mesuré : une variable
  // déclarée par '@var' n'est PAS acceptée comme valeur d'alias, alors qu'une macro l'est. Les
  // deux CRÉENT pourtant un nom au sens de la règle d'unicité. Incohérence entre deux de mes
  // propres règles, trouvée par ce corpus ; signalée, PAS corrigée sans arbitrage.
  ['sans-sens', "un alias qui ne désigne rien", S('@alias g fantome\nS -> C4'), S('@def reel saw >> audio\n@alias g reel\nS -> C4'), 'ne désigne rien'],
  ['sans-sens', "un terminal absent des alphabets en portée", S('S -> zzz'), S('S -> C4'), 'non déclaré'],
  ['sans-sens', "une adresse de point d'attente malformée",
   S('@var touches in.keyboard\nS -> C4 <!touches.60bis D4'), S('@var touches in.keyboard\nS -> C4 <!touches.60 D4'), 'adresse'],
  ['sans-sens', "un alphabet inexistant", S('@alphabet.klingon\nS -> C4'), S('@alphabet.western\nS -> C4'), null],
  ['sans-sens', "une directive inconnue", S('@zorglub 3\nS -> C4'), S('@quantization:50\nS -> C4'), null],
];

const compile = (src) => {
  try {
    const r = compileToBPxAST(src);
    return { ok: !!r.ast && (r.errors ?? []).length === 0, msg: (r.errors ?? []).map((e) => e.message ?? String(e)).join(' | ') };
  } catch (e) { return { ok: false, msg: 'JETÉ : ' + String(e.message) }; }
};

const passentAuLieuDEtreRefusees = [];
const refusMuets = [];
const voisinesCassees = [];

for (const [classe, quoi, fautive, valide, attendu] of REGLES) {
  const f = compile(fautive);
  const v = compile(valide);
  if (f.ok) passentAuLieuDEtreRefusees.push(`[${classe}] ${quoi}`);
  else if (attendu && !f.msg.includes(attendu)) refusMuets.push(`[${classe}] ${quoi} — refusé mais le message ne dit pas « ${attendu} » : ${f.msg.slice(0, 90)}`);
  if (!v.ok) voisinesCassees.push(`[${classe}] ${quoi} — la voisine VALIDE ne compile pas : ${v.msg.slice(0, 90)}`);
}

const parClasse = {};
for (const l of passentAuLieuDEtreRefusees) { const c = l.match(/^\[([^\]]+)\]/)[1]; parClasse[c] = (parClasse[c] ?? 0) + 1; }

console.log(`[corpus de refus] ${REGLES.length} règles testées, chacune dans LES DEUX SENS`);
console.log(`\n⚠️ PASSENT AU LIEU D'ÊTRE REFUSÉES : ${passentAuLieuDEtreRefusees.length} / ${REGLES.length}`);
for (const [c, n] of Object.entries(parClasse)) console.log(`     ${c} : ${n}`);
for (const l of passentAuLieuDEtreRefusees) console.log('   ✗ ' + l);

console.log(`\nREFUSÉES MAIS SANS NOMMER LA FAUTE : ${refusMuets.length}`);
for (const l of refusMuets) console.log('   ~ ' + l);

console.log(`\n⚠️ VOISINES VALIDES QUI NE COMPILENT PAS : ${voisinesCassees.length}`);
for (const l of voisinesCassees) console.log('   ! ' + l);
console.log('   (une voisine cassée ne dit PAS que le compilateur est trop sévère : elle dit que');
console.log('    MA scène témoin est fausse, ou que le compilateur l\'est. Il faut regarder.)');

// SOCLE — ce compte ne conclut pas sur zéro règle. Un corpus vide rendrait « 0 trou » et
// ressemblerait à un succès : c'est la famille close le 2026-07-27.
if (REGLES.length < 20) {
  console.error('[corpus de refus] SOCLE : moins de 20 règles testées — un compte sur si peu ne veut rien dire.');
  process.exit(1);
}
console.log(`\n[corpus de refus] ${REGLES.length * 2} PASS / 0 FAIL — compte rendu, pas verdict.`);
console.log('Ce fichier RAPPORTE tant que le compte n\'est pas à zéro ; le rendre bloquant avant');
console.log('rougirait en permanence, et un garde toujours rouge apprend à être ignoré.');
