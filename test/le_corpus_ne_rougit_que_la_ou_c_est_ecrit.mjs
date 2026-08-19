#!/usr/bin/env node
/**
 * TOUTE SCÈNE DU CORPUS QUI REFUSE EST INSCRITE, DATÉE ET MOTIVÉE — ou le portillon rougit.
 *
 * ⚠️ CE GARDE EXISTE PARCE QUE MON INSTRUMENT DE MESURE COMPTAIT À CÔTÉ, pendant des jours.
 * Mon empreinte de corpus annonçait « 274 arbres, 0 refus » à chaque campagne, et je l'ai
 * répétée telle quelle dans plusieurs rapports. Elle comptait les scènes dont un ARBRE sort —
 * or `compileToBPxAST` rend un arbre ET une liste d'erreurs : une scène peut porter sept refus
 * et sortir quand même un arbre. Mesuré le 2026-08-08 : **6 scènes du corpus portent des
 * erreurs**, aucune ne faisait rougir quoi que ce soit.
 *
 * C'est kanopi qui l'a vu, et par le côté : ils mentionnaient en passant qu'une scène était
 * rouge chez eux « pour une cause qui précède ». Elle l'était chez moi aussi, et mon compte
 * disait le contraire. **L'instrument ment plus souvent que le sujet** — ici il ne mentait même
 * pas sur une valeur, il répondait à une autre question que celle que je croyais poser
 * (« combien d'arbres sortent » au lieu de « combien de scènes passent »).
 *
 * ⚠️ ET LE TROU N'ÉTAIT PAS QUE DANS MON SCRIPT DE MESURE : **aucun garde du portillon** n'exige
 * que le corpus compile sans erreur. Huit gardes le balayent, chacun pour SA propriété (l'alphabet,
 * la portée, les sacs…) ; aucun ne regardait `errors`. C'est la faute « on répare l'endroit où le
 * défaut s'est montré » : chaque garde a été écrit pour une famille, personne n'a gardé le socle.
 *
 * CE QUE CE GARDE FAIT, ET LES DEUX SENS COMPTENT :
 *   · une scène qui refuse SANS être au registre → rouge (une casse nouvelle ne passe plus) ;
 *   · une scène du registre qui ne refuse PLUS → rouge aussi, avec l'ordre de retirer l'entrée
 *     à la main. Un cliquet qui ne se desserre jamais devient un mensonge daté.
 *   · une scène du registre qui refuse pour une AUTRE cause que celle inscrite → rouge. C'est le
 *     mode d'échec le plus discret : une scène déjà rouge peut changer de raison en silence, et
 *     un compte « toujours 6 » ne le dirait jamais.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { toutesLesScenes } from './corpus.mjs';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

/**
 * LE REGISTRE — mesuré le 2026-08-08, jamais recopié de mémoire.
 * Chaque entrée : [scène, fragment attendu dans le refus, la raison, qui en est propriétaire].
 * Deux familles, et elles ne se traitent pas pareil.
 */
// ⚠️ DESSERRÉ À LA MAIN LE 2026-08-19, sur mesure et non sur impression. `dhadhatite_v2.bps`
// COMPILE désormais : Kanopi a réécrit ses bols composés en `def`, comme Romain l'a arbitré ce
// jour. `cv-curve-js.bps` et `cv-backtick.bps` n'existent PLUS chez lui — supprimés, pas migrés ;
// leur entrée certifiait un refus sur des fichiers absents.
const REGISTRE = [
  // ── A. LE REFUS EST VOULU, ET LA SCÈNE LE DIT ELLE-MÊME ───────────────────────────────────
  // `script(...)` a été SUPPRIMÉ du langage (GO Romain, 2026-07-26) : une fonction générique
  // n'est pas une écriture du langage. Ces trois scènes gardent la forme morte EN TÉMOIN, et
  // l'écrivent en toutes lettres dans leur en-tête (« CETTE SCÈNE NE COMPILE PLUS,
  // VOLONTAIREMENT », « c'est un ÉTAT STABLE — pas un chantier oublié »). Leur refus est le
  // comportement attendu ; c'est leur SILENCE qui serait le défaut.
  // ⚠️ MOTIF RÉVISÉ LE 2026-08-08, ET C'EST CE GARDE QUI L'A EXIGÉ. Les trois refusaient toujours,
  // donc aucun compte ne bougeait — mais elles avaient changé de CAUSE, exactement le mode d'échec
  // que ce registre vise. Le refus disait « 'script' n'existe pas » ; il dit maintenant pourquoi la
  // construction elle-même n'est lisible d'aucune façon, ce qui est plus précis : `script(MIDI
  // program 5)` n'est ni un sac (son contenu n'est pas fait de paires) ni un appel (aucune
  // définition ne porte ce nom). Le fait n'a pas bougé : la forme reste supprimée du langage.
  ['BPScript-tests/alan-dice.bps',      "n'est lisible ni comme un SAC", 'script(...) supprimé du langage (2026-07-26), témoin volontaire', 'kanopi', 'PERSONNE — refus voulu, état stable'],
  ['BPScript-tests/beatrix-dice.bps',   "n'est lisible ni comme un SAC", 'script(...) supprimé du langage (2026-07-26), témoin volontaire', 'kanopi', 'PERSONNE — refus voulu, état stable'],
  ['BPScript-tests/shapes-rhythm.bps',  "n'est lisible ni comme un SAC", 'script(...) supprimé du langage (2026-07-26), témoin volontaire', 'kanopi', 'PERSONNE — refus voulu, état stable'],

  // ── B. LA SCÈNE EST INCOMPLÈTE — un vrai défaut, chez son propriétaire ────────────────────
  // Les trois emploient un vocabulaire qu'elles ne DÉCLARENT pas : `dhadhatite_v2` écrit des bols
  // de tabla sous le seul socle core (donc sous l'alphabet occidental hérité), `trySrand` et
  // `tryCsoundObjects` écrivent des objets sonores nus sans aucune convention de notes. Ce ne
  // sont pas des témoins : ce sont des scènes à réparer, et elles appartiennent à kanopi.
  // ⚠️ Elles restent ici INSCRITES, pas tolérées : le jour où l'une passe au vert, ce garde le
  // dira, et l'entrée sortira. Une dérogation sans échéance visible est un trou.
  // ⛔ ONZE SCENES QUI ECRIVENT UNE DIRECTIVE SUPPRIMEE LE 2026-08-09 — `cv` et `macro`, dont
  // les modulateurs et le cablage relevent du patching. Leur forme de remplacement — le corps
  // branchement de `def` — est au BACKLOG jusqu a la revue FaustX.
  // ⚠️ ELLES NE SE REECRIVENT PAS AUJOURD HUI, et c est deliberе : reecrire vers une forme que le
  // langage ne lit pas encore produirait une scene qui compile et n agit pas — precisement le
  // defaut qui a fait perdre son brassage a trySrand sans qu un seul message ne le dise.
  // QUI ATTEND : la revue du patching. Les quatre de kanopi sont chez lui, les sept autres a moi.
  ['cv/cv-adsr.bps',                      'Expected IDENT', 'declare cv — attend la revue du patching', 'FaustX', 'BACKLOG'],
  ['cv/cv-lfo.bps',                       'Expected IDENT', 'declare cv — attend la revue du patching', 'FaustX', 'BACKLOG'],
  ['synthesis/group-cutoff.bps',          'Expected IDENT', 'declare cv — attend la revue du patching', 'FaustX', 'BACKLOG'],
  ['synthesis/superp-cutoff.bps',         'Expected IDENT', 'declare cv — attend la revue du patching', 'FaustX', 'BACKLOG'],
  ['synthesis/patchbay.bps',              'Expected IDENT', 'declare macro — attend la revue du patching', 'FaustX', 'BACKLOG'],
  ['test/fixtures/cv_modulation.bps',     'Expected IDENT', 'declare cv — attend la revue du patching', 'FaustX', 'BACKLOG'],
  // ⚠️ CAUSE RESSERRÉE le 2026-08-08 : cette scène refusait pour ses terminaux nus ; elle
  //    refuse désormais AVANT, sur un crochet COLLÉ à un élément — forme retirée du langage
  //    le même jour (arbitrage Romain). La cause inscrite est donc devenue fausse, et le
  //    cliquet l'a vu : un retard qui garde une cause périmée fait passer un défaut pour un
  //    autre, et son compte reste juste pendant que sa raison ment.
  ['BPScript-tests/trySrand.bps',         'non déclaré', 'terminaux nus sans convention de notes déclarée — kanopi a migré le crochet, la cause d origine ressort', 'kanopi', 'ROMAIN — arbitrage BPS-40 : un alphabet PLUS des notes déclarées. Inscrite AUSSI au garde de kanopi depuis le 2026-07-29 : c\'est LE cas qui a révélé le défaut de forme, inventoriée des deux côtés sans que ni l\'un ni l\'autre le sache'],
  // ⚠️ CAUSE RESSERRÉE le 2026-08-19, ET C'EST LE CLIQUET QUI L'A VU. `var` masquait la cause
  // d'origine ; kanopi a migré, et la scène refuse de nouveau pour ce qu'elle est — des objets
  // sonores nus sans convention de notes déclarée. Le compte n'a pas bougé, la raison si.
  ['BPScript-tests/tryCsoundObjects.bps', 'non déclaré', 'objets sonores nus sans convention de notes déclarée', 'kanopi', 'kanopi — il instruit après l ouverture de def'],
  // ⛔ DEUX SCÈNES QUE LA MIGRATION DE KANOPI N'A PAS PRISES, mesurées le 2026-08-19 : leur `var`
  // est suivi d'un BACKTICK, pas d'un type. La réécriture est la même que les dix-huit autres —
  // `var <nom> \`code\`` devient `symbol <nom> \`code\`` —, et elle est ÉPROUVÉE : la forme compile
  // et le backtick arrive dans l'arbre. Signalé à l'architecte le jour même.

  // ── C. controls.json SUPPRIMÉ (Romain, 2026-08-10) — cinq scènes écrivaient `controls` SEUL ──
  // `core` amène désormais le même ensemble (`core.apporte`) qu'apportait le stub `controls` —
  // la migration est mécanique, une ligne qui devient l'autre. Ces cinq scènes appartiennent à
  // kanopi et écrivent `controls` sans `core` à côté (193 autres scènes de sa bibliothèque
  // écrivent déjà les deux, redondance cosmétique qui ne casse rien — hors de ce registre).
  // QUI ATTEND : kanopi, prévenu À LA FRAPPE avec la liste exacte et la réécriture (`controls` →
  // `core`, même position).

  // ── D. `var` EST SORTI, ET SES DIX-HUIT SCÈNES SONT MIGRÉES ─────────────────────────────────
  // Inscrites le 2026-08-18 avec leur réécriture ligne à ligne — 21 lignes, quatre formes — et
  // kanopi a migré dans la nuit. Les dix-huit compilent : leurs entrées SORTENT le jour même.
  // ⛔ ET LEUR PASSAGE AU VERT A DÉCOUVERT UN FAUX POSITIF chez un autre garde : `in.midi sustain`
  // était lu comme une INVOCATION de librairie qui n'émettait rien, alors que le point y qualifie
  // un TYPE et que l'entrée voyage par `ast.inputs`. Une forme neuve traverse les gardes écrits
  // pour l'ancienne, et c'est en la voyant compiler qu'on l'apprend — jamais avant.
];

// ── LA MESURE ─────────────────────────────────────────────────────────────────────────────────
const refus = new Map();       // scène → [messages]
let scenes = 0;
for (const [nom, src] of toutesLesScenes()) {
  scenes++;
  let msgs;
  try {
    const r = compileToBPxAST(src);
    msgs = (r.errors || []).map((e) => e.message ?? String(e));
  } catch (e) {
    msgs = [`JETTE : ${e.message}`];
  }
  if (msgs.length) refus.set(nom, msgs);
}

ok(scenes >= 250,
   `SOCLE : ${scenes} scène(s) lues. Sous ce seuil la bibliothèque n'est pas là où ce garde la `
   + `cherche, et son verdict vert ne voudrait rien dire — c'est exactement la forme « 0 OK / `
   + `0 DIFF sur 0 » qui a survécu à la campagne du 2026-07-27.`);

// ── A. AUCUNE SCÈNE NE REFUSE HORS DU REGISTRE ────────────────────────────────────────────────
const inscrites = new Set(REGISTRE.map(([n]) => n));
for (const [nom, msgs] of refus) {
  ok(inscrites.has(nom),
     `A. ${nom} REFUSE et n'est pas au registre — ${msgs.length} erreur(s), la première : `
     + `« ${msgs[0].replace(/\s+/g, ' ').slice(0, 120)} ». Soit c'est une casse que je viens `
     + `d'introduire, soit c'est un refus légitime : dans les deux cas il s'INSCRIT, daté et `
     + `motivé, il ne se découvre pas six jours plus tard chez un voisin.`);
}

// ── B. CHAQUE ENTRÉE DU REGISTRE REFUSE ENCORE, ET POUR LA RAISON INSCRITE ────────────────────
// ⚠️ ET LE CHAMP EST LU, PAS DÉCORATIF : un registre qui porterait « qui attend » sans jamais
// l'afficher aurait le défaut qu'il prétend fermer. La sortie le nomme à chaque passage.
for (const [nom, fragment, raison, , quiAttend] of REGISTRE) {
  const msgs = refus.get(nom);
  ok(!!msgs,
     `B. ${nom} ne refuse PLUS (motif inscrit : ${raison}). C'est peut-être une bonne nouvelle — `
     + `mais l'entrée doit sortir du registre À LA MAIN, sinon ce garde certifie un état qui `
     + `n'existe plus. Un cliquet qui ne se desserre jamais est un mensonge daté.`);
  if (!msgs) continue;
  ok(msgs.some((m) => m.includes(fragment)),
     `B. ${nom} refuse toujours, mais AUCUN de ses ${msgs.length} message(s) ne porte « ${fragment} » `
     + `— le motif inscrit était : ${raison}. La scène a donc changé de CAUSE sans changer de `
     + `couleur. C'est le mode d'échec que ce garde vise en premier : un compte « toujours 6 » ne `
     + `le dirait jamais. Reçu : « ${msgs[0].replace(/\s+/g, ' ').slice(0, 120)} ».`);
}

// ── TÉMOIN — LE DÉTECTEUR DOIT MORDRE ET SE TAIRE ────────────────────────────────────────────
// ⚠️ Sans lui, un détecteur qui rendrait toujours « aucune erreur » passerait le volet A en
// triomphe : zéro scène hors registre, verdict vert, et plus rien de gardé. C'est la moitié
// « injecter la faute dans le JUGE », pas seulement dans le sujet.
{
  const fautive = compileToBPxAST('core\nalphabet.western\n-----\nS -> zzzz_pas_une_note\n');
  ok((fautive.errors || []).length > 0,
     `TÉMOIN (mordre) — le détecteur ne voit plus d'erreur sur une scène délibérément fautive `
     + `(un terminal qui n'existe dans aucun alphabet). Tant qu'il est aveugle, les volets `
     + `au-dessus ne prouvent rien.`);
  const saine = compileToBPxAST('core\nalphabet.western\n-----\nS -> C4 D4\n');
  ok((saine.errors || []).length === 0,
     `TÉMOIN (se taire) — le détecteur crie sur une scène SAINE : `
     + `« ${(saine.errors || []).map((e) => e.message ?? e)[0]} ». Un détecteur qui refuserait `
     + `tout ferait passer le volet A pour rigoureux alors qu'il serait juste bruyant.`);
}

if (echecs.length) {
  console.error(`❌ le corpus refuse hors du registre : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
for (const [nom, , raison, , quiAttend] of REGISTRE) {
  if (quiAttend && !/^PERSONNE/.test(quiAttend)) {
    console.log(`   ⏳ ${nom.split('/').pop()} — attend : ${quiAttend}`);
  }
}
console.log(`✅ le corpus ne rougit que là où c'est écrit — ${scenes} scène(s) compilées, `
          + `${refus.size} refus, toutes inscrites au registre (${REGISTRE.length} entrées datées), `
          + `chacune vérifiée sur SA cause et non sur son seul nombre. `
          + `${passe} vérification(s) passée(s).`);
