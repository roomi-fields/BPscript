#!/usr/bin/env node
/**
 * GARDE — `@var <rôle> in.<canal>` déclare une ENTRÉE : un RÔLE, son canal, et facultativement
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
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const EN_TETE = '@core\n@controls\n@alphabet.western:midi\n';
const compile = (corps) => {
  try { return compileToBPxAST(`${EN_TETE}${corps}\n`); }
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
// ⚠️ UNE TABLE INEXISTANTE CRIE depuis l'arbitrage du 2026-07-27 (`lib/mapping.json` est vide par
// décision, donc TOUTE table invoquée crie aujourd'hui). Ce n'est pas ce que ce §2 mesure : il
// mesure que la DÉCLARATION est LUE telle qu'écrite. On sépare donc les deux questions — la forme
// est-elle portée, et la référence résout-elle — au lieu de les confondre dans un seul verdict.
for (const [corps, quoi, attendu, crie] of [
  ['@var pedale in.midi\n@mode:ord\nS -> C4', 'un rôle et son canal, sans table', { name: 'pedale', transport: 'midi', mapping: null }, false],
  ['@var pedale in.midi mapping.fcb_std\n@mode:ord\nS -> C4', 'avec sa table', { name: 'pedale', transport: 'midi', mapping: 'fcb_std' }, true],
  ['@var touches in.keyboard mapping.azerty\n@mode:ord\nS -> C4', 'sur le canal clavier', { name: 'touches', transport: 'keyboard', mapping: 'azerty' }, true],
  ['@var o in.osc\n@mode:ord\nS -> C4', 'sur le canal OSC', { name: 'o', transport: 'osc', mapping: null }, false],
]) {
  const r = compile(corps);
  const msgs = (r.errors || []).map((e) => e.message || e);
  if (crie) {
    ok(msgs.length === 1 && msgs[0].includes(attendu.mapping),
       `2. ${quoi} : la table inexistante doit CRIER, et rien d'autre — reçu : ${JSON.stringify(msgs)}`);
  } else {
    ok(msgs.length === 0, `2. ${quoi} doit compiler — reçu : ${msgs.join(' | ')}`);
  }
  const e = (r.ast?.inputs || [])[0];
  ok(e && e.name === attendu.name && e.transport === attendu.transport && (e.mapping ?? null) === attendu.mapping,
     `2. ${quoi} : l'entrée doit ARRIVER telle qu'écrite — reçu : ${JSON.stringify(e)}`);
}
// Plusieurs entrées coexistent.
{
  const r = compile('@var a in.midi\n@var b in.osc\n@mode:ord\nS -> C4');
  ok((r.ast?.inputs || []).length === 2, `2. plusieurs entrées doivent coexister — reçu ${(r.ast?.inputs || []).length}`);
}

// ─── 3. LES TROIS CONTRAINTES REFUSENT, ET LE REFUS DIT POURQUOI ─────────────────────────────
for (const [corps, quoi, mot] of [
  ['@var x in.midi(port:LPK25)\n@mode:ord\nS -> C4', 'un NOM DE PORT dans la scène', 'port'],
  // ⚠️ Le mot 'alphabet' ne suffit PAS à distinguer ce refus : le message générique « propriété
  // inconnue » le contient aussi. Prouvé par injection le 2026-07-27 — en désactivant la branche
  // dédiée, la garde restait VERTE. On exige donc ce que la contrainte a de PROPRE : dire qu'il
  // n'y a rien à résoudre en entrée, et renvoyer vers la table.
  ['@var x in.midi alphabet.sargam\n@mode:ord\nS -> C4', 'un ALPHABET sur une entrée', 'rien'],
  ['@var x in.audio\n@mode:ord\nS -> C4', 'un canal de SORTIE employé en entrée', 'audio'],
  ['@var x in.bluetooth\n@mode:ord\nS -> C4', 'un canal inventé', 'bluetooth'],
  ['@var x in.midi octaves.western\n@mode:ord\nS -> C4', 'une propriété étrangère', 'octaves'],
  // ⚠️ 'une entrée sans canal'/'sans nom' n'ont plus d'équivalent DIRECT depuis la fusion dans
  // `@var` (2026-08-04) : `@var x` seul est une VARIABLE DE TRAVAIL valide (forme nue), pas une
  // entrée incomplète — il n'y a plus de mot qui ENGAGE à un canal avant de le lire. Ce que la
  // contrainte protégeait reste vrai autrement : `@var` sans AUCUN nom (ni rôle ni variable)
  // refuse toujours, et le message renvoie vers la forme d'entrée.
  ['@var\n@mode:ord\nS -> C4', 'un @var sans aucun nom', 'rôle'],
]) {
  const r = compile(corps);
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok((r.errors || []).length > 0, `3. ${quoi} doit être REFUSÉ`);
  ok(msg.includes(mot), `3. et le refus doit NOMMER la faute ('${mot}') — reçu : ${msg.slice(0, 120)}`);
}
// Le refus de l'alphabet doit dire POURQUOI, pas seulement refuser.
{
  const msg = (compile('@var x in.midi alphabet.sargam\n@mode:ord\nS -> C4').errors || [])
    .map((e) => e.message || e).join(' | ');
  ok(msg.includes('AUCUN alphabet') && msg.includes('DISCRET') && msg.includes('mapping'),
     `3. le refus de l'alphabet doit expliquer qu'il n'y a RIEN à résoudre en entrée et renvoyer `
     + `vers la table — reçu : ${msg.slice(0, 160)}`);
}
// CONTRAINTE 3 : aucune table n'est inventée quand rien n'est déclaré.
{
  const r = compile('@var x in.midi\n@mode:ord\nS -> C4');
  const e = (r.ast?.inputs || [])[0];
  ok(e && (e.mapping === null || e.mapping === undefined),
     `3. AUCUNE table par défaut ne doit être posée — reçu : ${JSON.stringify(e)}`);
}

// ─── 4. LA TABLE EST UNE INVOCATION DE LIBRAIRIE — son adresse doit SORTIR ───────────────────
// Sinon la scène « déclare » une table que l'aval ne voit jamais : accepter n'est pas transmettre.
{
  const r = compile('@var pedale in.midi mapping.fcb_std\n@mode:ord\nS -> C4');
  // L'ADRESSE SORT MÊME QUAND LA RÉFÉRENCE CRIE, et c'est voulu : émission et validation sont deux
  // questions distinctes. Confondre les deux ferait disparaître la trace de ce que la scène a écrit
  // au moment précis où on en a le plus besoin pour comprendre le refus.
  ok((r.ast?.libRefs || []).includes('mapping.fcb_std'),
     `4. l'adresse de la table doit être ÉMISE — libRefs = ${JSON.stringify(r.ast?.libRefs ?? null)}`);
}
// La librairie existe et reste VIDE tant que Romain n'a pas donné de table.
// ⚠️ 2026-08-10 (mise en conformité des librairies) : `domain` est retiré partout, remplacé par
// `resolvedBy` — mais lib/mapping.json n'en porte PAS : aucune source mesurée ne nomme l'outil qui
// résout une table à l'exécution (cf. son `_resolvedBy_doc`), signalé à Romain plutôt qu'inventé.
// Cette assertion ne teste donc plus qu'un champ ABSENT, ce qui reste vrai des deux côtés du
// renommage.
{
  const entrees = Object.keys(LIBS.mapping || {}).filter((k) => !k.startsWith('_') && k !== 'domain' && k !== 'resolvedBy');
  ok(entrees.length === 0,
     `4. lib/mapping.json doit rester VIDE de contenu — un contenu de démonstration finirait cité `
     + `comme référence. Reçu : ${JSON.stringify(entrees)}`);
}

// ─── 5. L'ADRESSE AU POINT D'USAGE — côté droit IDENTIFIANT ──────────────────────────────────
{
  const r = compile('@var pedale in.midi\n@mode:ord\nS -> C4 <!pedale.suivant D4');
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
  const r = compile('@var pedale in.midi\n@mode:ord\nS -> C4 <!pedale D4');
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
const AVEC_ENTREES = '@var brut in.midi\n@var pedale in.midi\n@mode:ord\n';

for (const [regle, quoi, attendu] of [
  ['S -> C4 <!brut.60 D4', 'adresse NUMÉRIQUE, point d\'attente seul', 60],
  ['S -> C4 <!pedale.suivant D4', 'adresse IDENTIFIANT, point seul', 'suivant'],
  ['S -> C4<!brut.60 D4', 'adresse numérique sur un point ANCRÉ à la note', 60],
  ['S -> C4<!pedale.suivant D4', 'adresse identifiant sur un point ANCRÉ', 'suivant'],
  ['S -> <!brut.60 C4', 'adresse en TÊTE de règle', 60],
  ['S -> C4 <!brut.60', 'adresse en FIN de règle', 60],
  ['S -> {C4 <!brut.60} D4', 'adresse dans un groupe polymétrique', 60],
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
  const r = compile(AVEC_ENTREES + 'S -> C4<!brut.60<!pedale.suivant D4');
  const vues = adressesDe(r.ast);
  ok(vues.length === 2 && vues[0].adresse === 60 && vues[1].adresse === 'suivant',
     `6. deux adresses sur un même point doivent arriver toutes les deux — reçu : ${JSON.stringify(vues)}`);
}
// LE TYPE DIT CE QUE L'ADRESSE EST — l'aval n'a rien à deviner.
{
  const r = compile(AVEC_ENTREES + 'S -> C4 <!brut.60 <!pedale.suivant D4');
  const vues = adressesDe(r.ast).filter((t) => t.adresse !== undefined);
  ok(typeof vues[0]?.adresse === 'number', `6. un NOMBRE sort en nombre — reçu : ${typeof vues[0]?.adresse}`);
  ok(typeof vues[1]?.adresse === 'string', `6. un IDENTIFIANT sort en chaîne — reçu : ${typeof vues[1]?.adresse}`);
}

// ─── 7. L'ESPACE DÉCOUPE — et ce n'est PAS une adresse ───────────────────────────────────────
for (const [regle, quoi] of [
  ['S -> C4 <!brut . 60 D4', 'espacé des deux côtés'],
  ['S -> C4 <!brut .60 D4', 'point détaché du nom'],
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
  const r = compile(AVEC_ENTREES + 'S -> C4 <!brut D4');
  ok(adressesDe(r.ast).every((t) => t.adresse === undefined),
     "7. sans point, AUCUNE adresse ne doit apparaître");
}

// ─── 8. LE CAS MIXTE REFUSE — je ne choisis pas à la place de l'auteur ───────────────────────
// Point collé au nom, valeur détachée : ni l'une ni l'autre des deux formes. Le lire en silence
// comme un découpage trahirait une intention d'adresse manifeste ; le lire comme une adresse
// contredirait la règle. Signalé à l'architecte avant l'arbitrage, non tranché depuis — donc on
// REFUSE au lieu de deviner, en donnant les DEUX réécritures.
{
  const r = compile(AVEC_ENTREES + 'S -> C4 <!brut. 60 D4');
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
  console.log(`✅ déclaration d'entrée @var in. (ex-@in) — ${passe} vérification(s) passée(s) sur ${ENTREE.length} canal(aux) d'entrée`);
}
