#!/usr/bin/env node
/**
 * GARDE — `in.<canal> <rôle>` déclare une ENTRÉE : un RÔLE, son canal, et facultativement
 * sa table (ex-`@in`, absorbée dans `@var` le 2026-08-04 — décision Romain, in/out remplacent
 * transport, hub/decisions/2026-08-04-la-direction-s-ecrit-in-et-out-remplacent-transport.md).
 *
 * DÉCISION Romain 2026-07-27 (`hub/decisions/2026-07-27-forme-des-entrees-in-mapping-adresse-nue.md`),
 * en conséquence de la symétrie entrée/sortie du même jour : une sortie est routée PAR LE NOM, AU
 * POINT OÙ ELLE SERT (`sitar1.Sa`) ; une entrée l'est de la même façon, au point de RÉCEPTION —
 * le point d'attente. Pas de directive de routage, pas de flèche, pas d'opérateur de câblage.
 *
 * LES TROIS CONTRAINTES ne sont pas des détails de forme, chacune corrige une erreur nommée :
 *  1. AUCUN NOM DE PORT — il vient du système et change de machine en machine ; une scène qui le
 *     porterait ne s'ouvrirait plus ailleurs. La scène nomme un RÔLE, l'association vit dehors.
 *  2. AUCUN ALPHABET — il n'y a RIEN à résoudre en entrée. Romain : « si sur mon entrée je fais un
 *     glissando, ça va activer au croisement de la fréquence ? on attend un événement DISCRET, pas
 *     un traitement de signal. » C'est la TABLE qui déclare le vocabulaire, en librairie.
 *  3. AUCUNE TABLE PAR DÉFAUT — sans table on écrit des adresses nues, et c'est EXPLICITE. Une
 *     identité implicite rendrait indistinguables « je n'ai pas de table » et « ma table ne fait rien ».
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
// L'étage de résolution — le module INTERNE, jamais la porte publiée : la surface expose le verdict,
// pas les étages. Ce banc vit dans le dépôt, donc il y a accès.
import { resoudreSource } from '../src/transpiler/bpxAst.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const EN_TETE = 'core\nalphabet.western:midi\n';
const compile = (corps) => {
  try { return compileToBPxAST(`${EN_TETE}${corps}\n`); }
  catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};
/**
 * ⛔ CE BANC POSE DEUX QUESTIONS, ET DEPUIS LE 2026-08-19 ELLES N'ONT PLUS LE MÊME JUGE.
 *
 * « la table inexistante CRIE-t-elle ? » se demande à LA PORTE — c'est un verdict.
 * « la déclaration est-elle LUE telle qu'écrite ? » se demande à L'ÉTAGE DE RÉSOLUTION — c'est une
 * question sur la FORME, et elle vaut sur une source que le compilateur refuse.
 *
 * La séparation était déjà écrite ici (§2, « on sépare donc les deux questions »), et elle tenait
 * par un défaut : la porte livrait l'arbre d'un refus, donc une seule fonction servait les deux. Un
 * compilateur qui refuse ne livre plus rien en aval ; la seconde question passe donc par l'étage,
 * qui est fait pour elle. AUCUNE table n'existe — le catalogue `mapping` est retiré depuis le
 * 2026-08-24 — donc TOUTE table invoquée crie, et sans l'étage aucune scène qui en nomme une ne
 * serait mesurable.
 */
const resoudre = (corps) => {
  try { return resoudreSource(`${EN_TETE}${corps}\n`); }
  catch (e) { return { errors: [{ message: e.message }], ast: null }; }
};

// ─── 1. LA LISTE DES CANAUX D'ENTRÉE EST FERMÉE, ET DISTINCTE DE CELLE DES SORTIES ───────────
// Les deux listes vivent désormais dans UN SEUL catalogue (schema.channels, décision 2026-08-04) :
// chaque canal porte les directions qu'il autorise, dérivées ici comme avant la fusion.
const CHANNELS = LIBS.core?.schema?.channels || {};
const ENTREE = Object.keys(CHANNELS).filter((c) => CHANNELS[c]?.in);
const SORTIE = Object.keys(CHANNELS).filter((c) => CHANNELS[c]?.out);
ok(ENTREE.length === 3, `1. trois canaux d'entrée attendus (décision 2026-07-26) — reçu ${JSON.stringify(ENTREE)}`);
for (const c of ['midi', 'osc', 'keyboard']) {
  ok(ENTREE.includes(c), `1. '${c}' doit être un canal d'ENTRÉE`);
}
// Le clavier entre côté entrée et NULLE PART ailleurs : une sortie clavier n'a pas de sens.
ok(!SORTIE.includes('keyboard'), "1. 'keyboard' ne doit PAS rejoindre les canaux de SORTIE");
ok(SORTIE.includes('audio') && !ENTREE.includes('audio'),
   "1. 'audio' est une SORTIE et pas une entrée — les deux listes ne se confondent pas");

// ─── 2. LA DÉCLARATION, dans ses formes valides ──────────────────────────────────────────────
// ⚠️ UNE TABLE INEXISTANTE CRIE depuis l'arbitrage du 2026-07-27, et depuis le 2026-08-24 il n'y a
// plus de catalogue du tout — le refus est le MÊME, mesuré mot pour mot sur deux compilateurs
// complets avant le retrait. Ce n'est pas ce que ce §2 mesure : il
// mesure que la DÉCLARATION est LUE telle qu'écrite. On sépare donc les deux questions — la forme
// est-elle portée, et la référence résout-elle — au lieu de les confondre dans un seul verdict.
for (const [corps, quoi, attendu, crie] of [
  ['in.midi pedale\nmode:ord\n-----\nS -> C4', 'un rôle et son canal, sans table', { name: 'pedale', transport: 'midi', mapping: null }, false],
  ['in.midi pedale mapping.fcb_std\nmode:ord\n-----\nS -> C4', 'avec sa table', { name: 'pedale', transport: 'midi', mapping: 'fcb_std' }, true],
  ['in.keyboard touches mapping.azerty\nmode:ord\n-----\nS -> C4', 'sur le canal clavier', { name: 'touches', transport: 'keyboard', mapping: 'azerty' }, true],
  ['in.osc o\nmode:ord\n-----\nS -> C4', 'sur le canal OSC', { name: 'o', transport: 'osc', mapping: null }, false],
]) {
  const r = compile(corps);
  const msgs = (r.errors || []).map((e) => e.message || e);
  if (crie) {
    ok(msgs.length === 1 && msgs[0].includes(attendu.mapping),
       `2. ${quoi} : la table inexistante doit CRIER, et rien d'autre — reçu : ${JSON.stringify(msgs)}`);
  } else {
    ok(msgs.length === 0, `2. ${quoi} doit compiler — reçu : ${msgs.join(' | ')}`);
  }
  // LA FORME SE LIT À L'ÉTAGE : une scène qui nomme une table est refusée, et la porte ne livre
  // plus d'arbre. La question posée ici n'est pas « est-ce valide » mais « est-ce lu tel qu'écrit ».
  const e = (resoudre(corps).ast?.inputs || [])[0];
  ok(e && e.name === attendu.name && e.transport === attendu.transport && (e.mapping ?? null) === attendu.mapping,
     `2. ${quoi} : l'entrée doit ARRIVER telle qu'écrite — reçu : ${JSON.stringify(e)}`);
}
// Plusieurs entrées coexistent.
{
  const r = compile('in.midi a\nin.osc b\nmode:ord\n-----\nS -> C4');
  ok((r.ast?.inputs || []).length === 2, `2. plusieurs entrées doivent coexister — reçu ${(r.ast?.inputs || []).length}`);
}

// ─── 3. LES TROIS CONTRAINTES REFUSENT, ET LE REFUS DIT POURQUOI ─────────────────────────────
for (const [corps, quoi, mot] of [
  ['in.midi(port:LPK25) x\nmode:ord\n-----\nS -> C4', 'un NOM DE PORT dans la scène', 'port'],
  // ⚠️ Le mot 'alphabet' ne suffit PAS à distinguer ce refus : le message générique « propriété
  // inconnue » le contient aussi. Prouvé par injection le 2026-07-27 — en désactivant la branche
  // dédiée, la garde restait VERTE. On exige donc ce que la contrainte a de PROPRE : dire qu'il
  // n'y a rien à résoudre en entrée, et renvoyer vers la table.
  ['in.midi x alphabet.sargam\nmode:ord\n-----\nS -> C4', 'un ALPHABET sur une entrée', 'rien'],
  ['in.audio x\nmode:ord\n-----\nS -> C4', 'un canal de SORTIE employé en entrée', 'audio'],
  ['in.bluetooth x\nmode:ord\n-----\nS -> C4', 'un canal inventé', 'bluetooth'],
  ['in.midi x octaves.western\nmode:ord\n-----\nS -> C4', 'une propriété étrangère', 'octaves'],
  // ⚠️ 'une entrée sans canal'/'sans nom' n'ont plus d'équivalent DIRECT depuis la fusion dans
  // ⚠️ CE CAS A CHANGÉ DE SUJET AVEC LA GRAPHIE, le 2026-08-18 : le TYPE vient en tête, donc
  // c'est le CANAL qui engage, et le rôle qui peut manquer. `in.midi` seul est désormais la
  // forme incomplète, et son refus doit renvoyer au rôle — c'est exactement ce que la version
  // précédente mesurait sur `var` nu, sur l'autre moitié de la ligne.
  ['in.midi\nmode:ord\n-----\nS -> C4', 'un canal sans son rôle', 'RÔLE'],
]) {
  const r = compile(corps);
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok((r.errors || []).length > 0, `3. ${quoi} doit être REFUSÉ`);
  ok(msg.includes(mot), `3. et le refus doit NOMMER la faute ('${mot}') — reçu : ${msg.slice(0, 120)}`);
}
// Le refus de l'alphabet doit dire POURQUOI, pas seulement refuser.
{
  const msg = (compile('in.midi x alphabet.sargam\nmode:ord\n-----\nS -> C4').errors || [])
    .map((e) => e.message || e).join(' | ');
  ok(msg.includes('AUCUN alphabet') && msg.includes('DISCRET') && msg.includes('mapping'),
     `3. le refus de l'alphabet doit expliquer qu'il n'y a RIEN à résoudre en entrée et renvoyer `
     + `vers la table — reçu : ${msg.slice(0, 160)}`);
}
// CONTRAINTE 3 : aucune table n'est inventée quand rien n'est déclaré.
{
  const r = compile('in.midi x\nmode:ord\n-----\nS -> C4');
  const e = (r.ast?.inputs || [])[0];
  ok(e && (e.mapping === null || e.mapping === undefined),
     `3. AUCUNE table par défaut ne doit être posée — reçu : ${JSON.stringify(e)}`);
}

// ─── 4. LA TABLE EST UNE INVOCATION DE LIBRAIRIE — son adresse doit SORTIR ───────────────────
// Sinon la scène « déclare » une table que l'aval ne voit jamais : accepter n'est pas transmettre.
{
  const r = resoudre('in.midi pedale mapping.fcb_std\nmode:ord\n-----\nS -> C4');
  // L'ADRESSE SORT MÊME QUAND LA RÉFÉRENCE CRIE, et c'est voulu : émission et validation sont deux
  // questions distinctes. Confondre les deux ferait disparaître la trace de ce que la scène a écrit
  // au moment précis où on en a le plus besoin pour comprendre le refus.
  // ⛔ ET C'EST L'ÉTAGE QUI RÉPOND, PAS LA PORTE. « L'adresse sort même quand la référence crie »
  // n'est mesurable que là où un arbre existe malgré le refus — la porte, elle, n'en livre plus.
  // La phrase ci-dessus était vraie et sans juge depuis le 2026-08-19.
  ok((r.ast?.libRefs || []).includes('mapping.fcb_std'),
     `4. l'adresse de la table doit être ÉMISE — libRefs = ${JSON.stringify(r.ast?.libRefs ?? null)}`);
}
// ⛔ LE CATALOGUE `mapping` N'EXISTE PLUS, ET CE VOLET PART AVEC LUI. Décision de Romain,
// 2026-08-24 : *une place qui ne porte aucune donnée n'a pas de fichier*. Quatre clés, zéro table.
// Ce qu'il mesurait — « la librairie reste VIDE de tables » — n'a plus d'objet : il n'y a plus de
// librairie. Le remplacer par un volet « la clé est absente » ferait un garde qui surveille un
// fichier supprimé, c'est-à-dire rien.
//
// ⛔ ET L'AFFIRMATION QU'IL RÉPÉTAIT A ÉTÉ RE-MESURÉE AVANT DE PARTIR, plutôt que retirée en
// silence. Elle disait : *« sans ce champ le chargeur retombe sur le NOM DU FICHIER : le mot est
// alors juste par coïncidence. »* Mesuré le 2026-08-24 sur deux librairies fabriquées, avec témoin
// négatif et témoin positif :
//     librairie SANS `resolves`, invoquée par son nom de fichier          ✓ ACCEPTÉE
//     librairie dont `resolves` DIFFÈRE, par son nom de fichier           ✓ ACCEPTÉE
//     la même, par son `resolves`                                         ✓ ACCEPTÉE
//     un mot qu'aucune librairie ne porte                                 ⛔ REFUSÉ
// ⇒ Le premier membre est VRAI, le second FAUX EN CREUX : écrire `resolves` n'empêche pas
// l'invocation par le nom de fichier — la librairie répond aux DEUX. **Le champ AJOUTE un mot, il
// n'en FIXE pas un.** L'écart est routé aux consommateurs avec sa pièce, jamais opposé sans elle.
//
// ⚠️ CE QUE LE §2 CI-DESSUS CONTINUE DE COUVRIR : `mapping.<table>` reste refusé, et la forme de la
// déclaration reste lue telle qu'écrite. Mesuré avant la frappe sur deux compilateurs complets — le
// message de refus est IDENTIQUE mot pour mot avec et sans le catalogue.

// ─── 5. L'ADRESSE AU POINT D'USAGE — côté droit IDENTIFIANT ──────────────────────────────────
{
  const r = compile('in.midi pedale\nmode:ord\n-----\nS -> C4 <!pedale.suivant D4');
  ok((r.errors || []).length === 0,
     `5. l'adresse pointée doit compiler — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
  const t = (r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [])[0];
  const trig = (t?.triggers || [])[0];
  ok(trig?.name === 'pedale' && trig?.address === 'suivant',
     `5. le rôle ET l'adresse doivent ARRIVER dans l'arbre — reçu : ${JSON.stringify(trig)}`);
  ok(trig?.payload?.nature === 'wait', "5. et le point d'attente garde sa nature");
}
// Sans adresse, rien n'est inventé.
{
  const r = compile('in.midi pedale\nmode:ord\n-----\nS -> C4 <!pedale D4');
  const trig = ((r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [])[0]?.triggers || [])[0];
  ok(trig && trig.address === undefined, `5. sans point, AUCUNE adresse ne doit apparaître — reçu : ${JSON.stringify(trig)}`);
}

// ─── 6. COLLÉ = UNE ADRESSE, ESPACE = UN DÉCOUPAGE ──────────────────────────────────────────
// Règle validée par Romain le 2026-07-27. Ce n'est PAS une règle nouvelle : le langage colle déjà
// le marqueur de registre au nom de note, jamais une espace, parce que l'espace est le délimiteur
// de termes ; et la doc écrit déjà le découpage AVEC des espaces autour. On rend explicite ce qui
// l'était de fait.
//
// ⚠️ ÉCRITE POUR LA CONSTRUCTION : toutes les positions où une adresse peut vivre, pas les deux
// exemples de la décision. Un point d'attente peut être seul ou ancré, unique ou multiple, et son
// côté droit peut être un identifiant ou un nombre — chaque croisement est vérifié.
const adressesDe = (ast) => {
  const out = [];
  const w = (n) => {
    if (Array.isArray(n)) { n.forEach(w); return; }
    if (!n || typeof n !== 'object') return;
    if (n.type === 'Wait') out.push({ nom: n.name, adresse: n.address });
    // ⚠️ DESCENDRE JUSQU'AUX FEUILLES, pas au premier niveau. Écrit d'abord avec les deux seules
    // clés de la forme simple, l'instrument a rapporté « aucune adresse » pour un groupe
    // polymétrique où elle était bel et bien présente — quatrième fois de la journée où c'est
    // l'instrument qui ment, pas le sujet.
    for (const k of ['symbol', 'triggers', 'voices', 'elements', 'content', 'primary', 'secondaries']) {
      if (n[k]) w(n[k]);
    }
  };
  w(ast?.subgrammars?.[0]?.rules?.[0]?.rhs || []);
  return out;
};
const AVEC_ENTREES = 'in.midi brut\nin.midi pedale\nmode:ord\n';

for (const [regle, quoi, attendu] of [
  ['-----\nS -> C4 <!brut.60 D4', 'adresse NUMÉRIQUE, point d\'attente seul', 60],
  ['-----\nS -> C4 <!pedale.suivant D4', 'adresse IDENTIFIANT, point seul', 'suivant'],
  ['-----\nS -> C4<!brut.60 D4', 'adresse numérique sur un point ANCRÉ à la note', 60],
  ['-----\nS -> C4<!pedale.suivant D4', 'adresse identifiant sur un point ANCRÉ', 'suivant'],
  ['-----\nS -> <!brut.60 C4', 'adresse en TÊTE de règle', 60],
  ['-----\nS -> C4 <!brut.60', 'adresse en FIN de règle', 60],
  ['-----\nS -> {C4 <!brut.60} D4', 'adresse dans un groupe polymétrique', 60],
]) {
  const r = compile(AVEC_ENTREES + regle);
  ok((r.errors || []).length === 0,
     `6. ${quoi} doit compiler — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
  const vues = adressesDe(r.ast).filter((t) => t.adresse !== undefined);
  ok(vues.length === 1 && vues[0].adresse === attendu,
     `6. ${quoi} : l'adresse doit ARRIVER telle qu'écrite (${JSON.stringify(attendu)}) — reçu : ${JSON.stringify(vues)}`);
}
// DEUX adresses sur un même point : les deux arrivent, aucune n'absorbe l'autre.
{
  const r = compile(AVEC_ENTREES + '-----\nS -> C4<!brut.60<!pedale.suivant D4');
  const vues = adressesDe(r.ast);
  ok(vues.length === 2 && vues[0].adresse === 60 && vues[1].adresse === 'suivant',
     `6. deux adresses sur un même point doivent arriver toutes les deux — reçu : ${JSON.stringify(vues)}`);
}
// LE TYPE DIT CE QUE L'ADRESSE EST — l'aval n'a rien à deviner.
{
  const r = compile(AVEC_ENTREES + '-----\nS -> C4 <!brut.60 <!pedale.suivant D4');
  const vues = adressesDe(r.ast).filter((t) => t.adresse !== undefined);
  ok(typeof vues[0]?.adresse === 'number', `6. un NOMBRE sort en nombre — reçu : ${typeof vues[0]?.adresse}`);
  ok(typeof vues[1]?.adresse === 'string', `6. un IDENTIFIANT sort en chaîne — reçu : ${typeof vues[1]?.adresse}`);
}

// ─── 7. L'ESPACE DÉCOUPE — et ce n'est PAS une adresse ───────────────────────────────────────
for (const [regle, quoi] of [
  ['-----\nS -> C4 <!brut . 60 D4', 'espacé des deux côtés'],
  ['-----\nS -> C4 <!brut .60 D4', 'point détaché du nom'],
]) {
  const r = compile(AVEC_ENTREES + regle);
  ok((r.errors || []).length === 0, `7. ${quoi} doit rester lisible — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
  const types = (r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || []).map((e) => e.type);
  ok(types.includes('Period') && types.includes('NumericTerminal'),
     `7. ${quoi} : DÉCOUPAGE + terminal, pas une adresse — reçu : ${JSON.stringify(types)}`);
  ok(adressesDe(r.ast).every((t) => t.adresse === undefined),
     `7. ${quoi} : AUCUNE adresse ne doit être fabriquée — reçu : ${JSON.stringify(adressesDe(r.ast))}`);
}
// Sans point du tout, rien n'est inventé.
{
  const r = compile(AVEC_ENTREES + '-----\nS -> C4 <!brut D4');
  ok(adressesDe(r.ast).every((t) => t.adresse === undefined),
     "7. sans point, AUCUNE adresse ne doit apparaître");
}

// ─── 8. LE CAS MIXTE REFUSE — je ne choisis pas à la place de l'auteur ───────────────────────
// Point collé au nom, valeur détachée : ni l'une ni l'autre des deux formes. Le lire en silence
// comme un découpage trahirait une intention d'adresse manifeste ; le lire comme une adresse
// contredirait la règle. Signalé à l'architecte avant l'arbitrage, non tranché depuis — donc on
// REFUSE au lieu de deviner, en donnant les DEUX réécritures.
{
  const r = compile(AVEC_ENTREES + '-----\nS -> C4 <!brut. 60 D4');
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok((r.errors || []).length > 0, '8. la forme mixte doit être REFUSÉE, pas devinée');
  ok(msg.includes('ADRESSE') && msg.includes('DÉCOUPAGE'),
     `8. et le refus doit donner LES DEUX réécritures — reçu : ${msg.slice(0, 150)}`);
}

if (echecs.length) {
  console.error(`❌ déclaration d'entrée : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ déclaration d'entrée in.<canal> <rôle> — ${passe} vérification(s) passée(s) sur ${ENTREE.length} canal(aux) d'entrée`);
}
