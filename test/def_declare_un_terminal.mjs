#!/usr/bin/env node
/**
 * `@def` DÉCLARE UN TERMINAL — un nom, puis ses clés, sur la ligne ou dans un bloc.
 *
 * `LANGUAGE.md` §« Déclarer un terminal » : « Un terminal se déclare avec `@def` et un bloc de
 * clés, celles du prototype d'un terminal. Le bloc s'écrit sous le nom, une clé par ligne, ou sur
 * la même ligne quand il tient. »
 *
 * ⚠️ POURQUOI CETTE DIRECTIVE EST LE PREMIER PALIER DU CHANTIER. Cinq directives sortent du
 * langage le 2026-08-08 — `@gate`, `@trigger`, `@cv`, `@macro`, `@alias` — et la référence ne
 * connaît que QUATRE mots : `@actor`, `@var`, `@def`, `@init`. Mesuré ce jour-là : `@var` était
 * déjà complet, et `@def` **n'existait pas du tout** — ses neuf formes refusées, le parseur ne
 * reconnaissant même pas la directive.
 * À lui seul, `@gate` pèse 119 lignes sur 14 scènes ; sa réécriture est cette forme-ci. Tant que
 * `@def` n'existait pas, poser sa pierre tombale aurait nommé une réécriture impossible — la règle
 * que kanopi a demandée le matin même et que j'ai acceptée. J'ai d'ailleurs manqué à cette règle
 * quelques heures plus tard en posant deux tombales dont la cible n'existait pas ; elles ont été
 * retirées. **L'ordre est la moitié du travail.**
 *
 * ⚠️ ET UN DÉFAUT MUET TROUVÉ EN L'ÉCRIVANT, qui vaut d'être gardé. Ma première lecture du bloc
 * cherchait une propriété `indente` sur le jeton — elle n'existe pas, le tokenizer donne `col`.
 * La condition était donc TOUJOURS fausse : le bloc n'était jamais lu, sans la moindre erreur.
 * **Une propriété inventée ne plante pas, elle rend `undefined`** — et la branche meurt en
 * silence, avec l'air de marcher. C'est la raison d'être du volet B.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compiler = (corps, suite = '\n-----\nS -> C4\n') => {
  try { return compileToBPxAST(`core\nalphabet.western\n${corps}${suite}`); }
  catch (e) { return { errors: [{ message: e.message }] }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message ?? e).join(' | ');
const defDe = (r) => (r.ast?.defs || []).find((d) => d.type === 'DefDirective');

// ── A. LES FORMES QUE LA RÉFÉRENCE ÉCRIT ─────────────────────────────────────────────────────
// Les deux premières sont ses exemples LITTÉRAUX ; les suivantes couvrent la même construction.
const FORMES = [
  ['une clé qui APPELLE un composant',  'def ka  voice.bayan_muted',                    { voice: 'bayan_muted' }],
  ['une clé qui AFFECTE une valeur',    'def muet  sounding:false',             { sounding: 'false' }],
  ['deux clés sur la même ligne',       'def sirene  hz:440  voice.bayan_muted',        { hz: '440', voice: 'bayan_muted' }],
  ['un bloc indenté, une clé par ligne','def cloche\n  register:5\n  degree:0', { register: '5', degree: '0' }],
];
for (const [quoi, corps, attendu] of FORMES) {
  const r = compiler(corps);
  ok(messages(r) === '', `A. ${quoi} — REFUSÉ : ${messages(r).slice(0, 90)}`);
  if (messages(r)) continue;
  const d = defDe(r);
  ok(!!d, `A. ${quoi} — aucun nœud de définition dans l'arbre. Accepter n'est pas transmettre.`);
  if (!d) continue;
  for (const [cle, val] of Object.entries(attendu)) {
    ok(d.keys?.[cle]?.value === val,
       `A. ${quoi} — la clé '${cle}' doit porter '${val}', reçu `
       + `${JSON.stringify(d.keys?.[cle])}. Une clé lue mais mal rangée ne se voit nulle part.`);
  }
}

// ── B. LE BLOC S'ARRÊTE À L'INDENTATION — le volet qui garde le défaut muet ──────────────────
// ⚠️ Si le bloc n'était pas borné, la règle qui suit deviendrait une clé du terminal, en silence.
// Et si la lecture du bloc mourait (le cas de la propriété inventée), ce volet le dirait aussi :
// les deux fautes se voient ici et nulle part ailleurs.
{
  const r = compiler('def cloche\n  register:5\n-----\nS -> C4 D4\n', '');
  ok(messages(r) === '', `B. un bloc suivi d'une règle est REFUSÉ : ${messages(r).slice(0, 80)}`);
  const d = defDe(r);
  ok(d && Object.keys(d.keys || {}).length === 1,
     `B. le bloc doit s'arrêter à la première ligne NON indentée — il a lu `
     + `${Object.keys(d?.keys || {}).length} clé(s) au lieu d'une : ${JSON.stringify(d?.keys)}. `
     + `Sans cette borne, la règle suivante devient une clé du terminal sans un mot.`);
  const regles = r.ast?.subgrammars?.[0]?.rules || [];
  ok(regles.length === 1 && (regles[0].rhs || []).length === 2,
     `B. la règle qui suit le bloc doit rester une RÈGLE — reçu ${regles.length} règle(s), `
     + `${(regles[0]?.rhs || []).length} élément(s). Si elle a été avalée par le bloc, la scène `
     + `compile et ne joue plus rien.`);
}

// ── C. TÉMOIN QUI MORD — une définition vide et une clé mal formée REFUSENT ──────────────────
// ⚠️ Sans cette moitié, une lecture qui accepterait n'importe quoi passerait le volet A en
// triomphe. Et le second cas est le vrai piège : un mot seul, sans point ni deux-points, n'est
// NI un appel NI une affectation — le laisser passer inventerait une troisième forme.
// ⚠️ CE VOLET A CHANGÉ DE PORTÉE LE 2026-08-08, ET LE CAS QUI A BOUGÉ EST INSTRUCTIF.
// Il exigeait que `def ka voice` REFUSE, comme « une clé ni appelée ni affectée ». Depuis que ce
// palier lit aussi la STRUCTURE, cette forme n'est plus une faute : c'est une structure d'un seul
// terme, et le refus aurait interdit `def bref C4`. Le témoin a donc été DÉPLACÉ, pas supprimé —
// un mot nu reste une faute **une fois le régime des clés engagé**, sur la ligne (`hz:440 voice`)
// comme dans le bloc. Mesuré aux deux endroits avant d'y toucher.
// La leçon : quand un garde tombe en ouvrant une forme, il faut établir si la forme a changé de
// SENS ou si le code a régressé. Ici la première ; effacer le témoin sans le rejouer ailleurs
// aurait retiré la garde du régime des clés en croyant suivre une évolution.
// ⛔ « UNE DÉFINITION SANS RIEN » A QUITTÉ CETTE LISTE LE 2026-09-02 — elle ne refuse plus. `def vide`
// est un objet RACINE au sac vide : « un nom nu vaut un objet vide, et le type voyage » (prototypal
// pur, Romain 2026-08-20), et `def` est le mot unique depuis que `object` est sorti (Romain,
// 2026-09-02). Ce que ce témoin gardait — qu'un mot ILLISIBLE après le nom refuse en le nommant —
// est tenu par les cinq lignes qui restent ; la forme nue, elle, est éprouvée au volet F.
for (const [quoi, corps, fragment] of [
  ['un mot nu APRÈS une clé',         'def ka  hz:440  voice', /ni un appel de composant ni une affectation/],
  ['un mot nu dans le BLOC',          'def ka\n  hz:440\n  voice', /ni un appel de composant ni une affectation/],
  ['un point sans nom derrière',      'def ka  voice.',      /nom attendu après/],
  ['un deux-points sans valeur',      'def ka  hz:',         /valeur attendue après/],
  ['aucun nom après la directive',    'def',                 /doit nommer ce qu'il définit/],
]) {
  const msg = messages(compiler(corps));
  ok(fragment.test(msg),
     `C-témoin. ${quoi} — doit REFUSER en nommant la faute. Reçu : ${msg.slice(0, 100) || 'aucune erreur'}`);
}

// ── D. LES CORPS PAS ENCORE LUS REFUSENT, ILS NE SONT PAS LUS DE TRAVERS ─────────────────────
// ⚠️ La référence décrit SIX corps (`LANGUAGE.md:310-315`) ; ce palier en lit DEUX — la
// déclaration de terminal et la structure. Les quatre autres doivent CRIER : un corps qu'on ne
// sait pas lire ne doit jamais tomber dans une branche voisine et produire un arbre plausible.
// C'est la différence entre « pas encore fait » et « faux sans le dire ».
//
// ⛔ ET CE VOLET A ATTRAPÉ EXACTEMENT ÇA, SUR MOI, LE JOUR OÙ LA STRUCTURE A ÉTÉ OUVERTE.
// `def fondu phase \`js: …\`` commence lui aussi par un terme nu : il tombait donc dans la
// branche structure et était ACCEPTÉ. L'arbre produit était plausible et faux — `phase`, qui est
// un TYPE de signal, devenait un `Symbol` (un terminal), et le code un élément voisin. Rien
// n'aurait signalé la confusion en aval : un terminal inconnu ressemble à un terminal.
// Le refus se décide sur la FORME — un backtick est présent — jamais sur le nom du premier terme :
// décider sur une liste de types ferait dépendre la forme d'un vocabulaire.
for (const [quoi, corps] of [
  ['un branchement',              'def souffle lfo1.out >> lpf1.cutoff'],
]) {
  ok(messages(compiler(corps)) !== '',
     `D. ${quoi} n'est pas encore lu par ce palier — il doit REFUSER, et il passe. Un corps lu de `
     + `travers produit un arbre plausible et faux, ce qui est pire qu'un refus.`);
}

// ── E. LA STRUCTURE — un nom vaut une suite de termes, qu'on réinvoque d'un mot ──────────────
// `LANGUAGE.md:304` : « `def` associe un nom a un corps, pour le reinvoquer d'un mot », et
// `:311` en donne la forme : `def cadence sa re ga pa`.
//
// ⚠️ LE CORPS EST LU PAR LE LECTEUR DE MEMBRE DROIT DES RÈGLES, et c'est ce que ce volet
// vérifie : une structure EST un membre droit. Le silence, la prolongation et les qualificatifs
// y marchent sans une ligne de code de plus — s'ils cessaient de marcher, ce serait le signe
// qu'un second lecteur a été écrit à côté, et deux grammaires pour une notion divergent toujours.
{
  const NATURES = [
    ['des terminaux nus',           'def cadence C4 D4 E4',   ['Symbol', 'Symbol', 'Symbol']],
    ['un silence et une tenue',     'def motif C4 - D4 _ E4', ['Symbol', 'Rest', 'Symbol', 'Prolongation', 'Symbol']],
    ['un seul terme',               'def bref C4',            ['Symbol']],
  ];
  for (const [quoi, corps, attendu] of NATURES) {
    const r = compiler(corps);
    ok(messages(r) === '', `E. ${quoi} — REFUSÉ : ${messages(r).slice(0, 90)}`);
    if (messages(r)) continue;
    const d = defDe(r);
    ok(d?.kind === 'structure',
       `E. ${quoi} — la définition doit porter la nature 'structure', reçu ${JSON.stringify(d?.kind)}.`);
    const natures = (d?.body || []).map((e) => e.type);
    ok(JSON.stringify(natures) === JSON.stringify(attendu),
       `E. ${quoi} — attendu ${JSON.stringify(attendu)}, reçu ${JSON.stringify(natures)}. Si le `
       + `silence ou la prolongation manquent, le corps n'est plus lu par le lecteur des règles.`);
  }

  // ⚠️ LE DÉPARTAGE SE FAIT SUR LA PONCTUATION COLLÉE, JAMAIS SUR LE NOM. Une clé porte `.` ou
  // `:` collé ; une structure est faite de termes nus. Ce témoin garde les deux sens — et le
  // second cas est le piège : un terminal peut porter le nom d'une clé.
  const CLE = compiler('def ka  voice.bayan_muted');
  ok(defDe(CLE)?.kind === 'terminal',
     `E-départage. 'def ka voice.bayan_muted' porte une CLÉ (point collé) : nature 'terminal' attendue, `
     + `reçu ${JSON.stringify(defDe(CLE)?.kind)}.`);
  const NU = compiler('def suite voice sec');
  ok(defDe(NU)?.kind === 'structure',
     `E-départage. 'def suite voice sec' n'a AUCUNE ponctuation collée : c'est une STRUCTURE, `
     + `même si son premier terme s'appelle 'voice'. Reçu ${JSON.stringify(defDe(NU)?.kind)}. `
     + `Décider sur le nom ferait dépendre la forme d'un vocabulaire.`);
  // ⛔ CE TÉMOIN A CHANGÉ DE SENS LE 2026-09-02, ET IL LE DIT. Il exigeait qu'un nom sans corps
  // REFUSE ; le prototypal pur dit l'inverse — « un nom nu vaut un objet vide » — et `def` est
  // devenu le mot unique de la déclaration (`object` sort). `def vide2` est donc une RACINE au sac
  // vide, dans `vars`, et ce qui doit rester vrai est qu'elle n'est PAS lue comme une structure.
  {
    const r = compiler('def vide2  ');
    const racine = (r.ast?.vars || []).find((v) => v.varType?.kind === 'type' && v.varType.type === null);
    ok(messages(r) === '' && !!racine && (racine.settings?.pairs || []).length === 0 && !defDe(r),
       `E-témoin. 'def vide2' est un objet RACINE au sac vide, jamais une structure — reçu `
       + `${messages(r).slice(0, 60) || JSON.stringify(racine)}.`);
  }
}

// ── F. LES DEUX CORPS QUE LA PARENTHESE DEPARTAGE — et c'est le COLLAGE qui tranche ─────────
// `LANGUAGE.md`, tableau des signes : « `(x)` COLLÉ au nom = liste de paramètres » ; « `(vel:60)`
// SÉPARÉ du nom = corps de la définition ». La même règle que partout — l'espace délimite les
// termes — et elle suffit à distinguer les deux sans deviner d'après le contenu.
//
// ⚠️ LA DÉCLARATION NE SUFFIT PAS, ET C'EST LA MOITIÉ QUI MANQUAIT DEUX FOIS AUJOURD'HUI : une
// transformation qu'on ne peut pas APPELER ne transforme rien, comme une définition qu'on ne peut
// pas RÉINVOQUER ne sert à rien. L'ensemble qui porte la bascule appel/réglage était déclaré et
// JAMAIS alimenté — son commentaire disait « vide tant que la directive n'est pas implémentée ».
// Sans lui, `accent(E4)` était lu comme un sac de réglages et refusé.
{
  const PARENTHESE = [
    ['transformation paramétrée', 'def accent(x) x(vel:120)', 'transformation', ['x']],
    ['transformation structurelle', 'def fast(x) {x}:2',      'transformation', ['x']],
    ['deux paramètres',           'def entre(a, b) a b',      'transformation', ['a', 'b']],
  ];
  // ⛔ LE PRÉRÉGLAGE A QUITTÉ CETTE TABLE LE 2026-09-02 : `def kick (vel:120)` n'est plus une
  // « nature » de définition, c'est un OBJET RACINE — un nom et un sac, dans `vars`. Le collage de la
  // parenthèse reste le seul discriminant, et c'est ce que le témoin juste après la boucle garde :
  // collée, une transformation ; séparée, une racine.
  for (const [quoi, corps, nature, params] of PARENTHESE) {
    const r = compiler(corps);
    ok(messages(r) === '', `F. ${quoi} — REFUSÉ : ${messages(r).slice(0, 90)}`);
    if (messages(r)) continue;
    const d = defDe(r);
    ok(d?.kind === nature,
       `F. ${quoi} — nature '${nature}' attendue, reçu ${JSON.stringify(d?.kind)}. Le collage de la `
       + `parenthèse est le seul discriminant : s'il se perd, les deux corps se confondent.`);
    if (params) {
      ok(JSON.stringify(d?.params) === JSON.stringify(params),
         `F. ${quoi} — paramètres ${JSON.stringify(params)} attendus, reçu ${JSON.stringify(d?.params)}.`);
    }
  }

  // ⛔ LA PARENTHÈSE SÉPARÉE DÉCLARE UNE RACINE — un nom et un sac, dans `vars`, sans DefDirective.
  // C'est la seconde branche du collage : `accent(x)` collé est une transformation ci-dessus,
  // `kick (vel:120)` séparé est un objet. Si la racine tombait dans `defs`, ou si le sac se perdait,
  // c'est ici que ça rougit — et le C-témoin d'avant ne garde plus cette forme.
  {
    const r = compiler('def kick (vel:120)');
    const racine = (r.ast?.vars || []).find((v) => v.varType?.kind === 'type' && v.varType.type === null);
    const vel = (racine?.settings?.pairs || []).find((p) => p.key === 'vel');
    ok(messages(r) === '' && !!racine && racine.names?.[0] === 'kick' && vel?.value === 120 && !defDe(r),
       `F-racine. 'def kick (vel:120)' est un objet RACINE porté par 'vars' avec son sac — reçu `
       + `${messages(r).slice(0, 60) || JSON.stringify({ racine: racine?.names, vel: vel?.value, def: !!defDe(r) })}.`);
  }

  // ⚠️ L'APPEL — la moitié qui compte. Le bloc EXACT de la référence (`LANGUAGE.md:317-321`).
  const bloc = compiler('def kick (vel:120)\ndef accent(x) x(vel:120)\ndef fast(x) {x}:2\n-----\n'
                        + 'Motif -> C4 D4 E4', '\n-----\nS -> C4!kick D4 accent(E4) fast(Motif)\n');
  ok(messages(bloc) === '',
     `F-APPEL. le bloc de la référence doit compiler ENTIER — reçu : ${messages(bloc).slice(0, 100)}`);

  // Témoins qui mordent, dans les deux sens.
  for (const [quoi, corps, fragment] of [
    ['une liste de paramètres VIDE',   'def rien() C4',        /ne parametre rien/],
    ['une transformation sans corps',  'def accent(x)',        /sans corps/],
    ['un paramètre qui n\'est pas un nom', 'def f(1) C4',      /que des NOMS/],
  ]) {
    ok(fragment.test(messages(compiler(corps))),
       `F-témoin. ${quoi} — doit REFUSER en nommant la faute. Reçu : ${messages(compiler(corps)).slice(0, 90) || 'aucune erreur'}`);
  }
}

// ── G. LE CODE TYPÉ — `def fondu phase \`js: …\`` ──────────────────────────────────────────
// `LANGUAGE.md:307` : « Ses types sont ceux des signaux : signal, pitch, phase, logic. »
// ⚠️ LE TYPE SE LIT DANS LA DONNÉE (`core.json`, les conventions que `var` consulte déjà) —
// aucun nom de type n'est écrit dans le parseur. Ajouter une convention à la donnée l'ouvre ici
// sans toucher au code ; en retirer une la ferme. C'est la leçon de la journée appliquée d'emblée.
//
// ⚠️ ET CE CORPS ÉTAIT REFUSÉ PAR LE PALIER STRUCTURE, VOLONTAIREMENT : `phase` est un terme nu,
// il tombait dans la branche structure et devenait un TERMINAL — un arbre plausible et faux, que
// rien n'aurait signalé en aval. Le refus posait la question ; ce palier la résout sur la même
// FORME (un backtick suit), jamais sur le nom du premier terme.
{
  const CODE = [
    ['la forme littérale de la référence', 'def fondu phase `js: (t, dur) => 1 - t / dur`', 'phase', 'js'],
    ['une autre convention',               'def g signal `js: 1`',                          'signal', 'js'],
    ['un autre langage',                   'def h logic `py: True`',                        'logic', 'py'],
  ];
  for (const [quoi, corps, convention, tag] of CODE) {
    const r = compiler(corps);
    ok(messages(r) === '', `G. ${quoi} — REFUSÉ : ${messages(r).slice(0, 90)}`);
    if (messages(r)) continue;
    const d = defDe(r);
    ok(d?.kind === 'code' && d?.convention === convention && d?.tag === tag,
       `G. ${quoi} — attendu code/${convention}/${tag}, reçu `
       + `${JSON.stringify({ k: d?.kind, c: d?.convention, t: d?.tag })}. Le type et le langage sont `
       + `deux choses : l'un dit ce que le signal EST, l'autre qui l'exécute.`);
  }
  // ⚠️ LE TÉMOIN QUI COMPTE : un type HORS des conventions déclarées ne doit pas passer pour un
  // code typé — sinon n'importe quel terme nu suivi d'un backtick en deviendrait un.
  ok(/porte du CODE, pas une structure/.test(messages(compiler('def h zzz `js: 1`'))),
     `G-témoin. un type hors des conventions déclarées ne fait PAS un code typé — reçu : `
     + `${messages(compiler('def h zzz `js: 1`')).slice(0, 90)}`);
}

// ── SOCLE ────────────────────────────────────────────────────────────────────────────────────
ok(FORMES.length >= 4, `SOCLE : ${FORMES.length} formes mesurées, 4 au moins attendues.`);

if (echecs.length) {
  console.error(`❌ def déclare un terminal : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ 'def' lit CINQ des six corps de la référence — terminal, structure, préréglage, `
          + `transformation (paramétrée et structurelle), code typé ; seul le BRANCHEMENT reste, au `
          + `backlog avec le patching. Départage sur la PONCTUATION COLLÉE et non sur le nom, type `
          + `du code lu dans la DONNÉE, bloc borné par l'indentation, et l'APPEL vérifié sur le bloc `
          + `littéral de la référence. ${passe} vérification(s) passée(s).`);
