#!/usr/bin/env node
/**
 * GARDE — `@in` déclare une ENTRÉE : un RÔLE, son canal, et facultativement sa table.
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
 *
 * ⚠️ CE QUI EST DÉLIBÉRÉMENT DEHORS : l'adresse nue NUMÉRIQUE (`<!brut.60`). Un point suivi d'un
 * NOMBRE est déjà une lecture valide — la PÉRIODE suivie d'un terminal numérique. Les deux lectures
 * sont grammaticalement légitimes ; les départager demande une règle de langage, elle est chez
 * Romain. Pas de forme provisoire, pas de tolérance en attendant : ce garde ÉPINGLE l'exclusion
 * pour qu'elle ne se comble pas par accident, et il devra être retourné le jour de l'arbitrage.
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
const ENTREE = LIBS.core?.schema?.inputTransportChannels || [];
const SORTIE = LIBS.core?.schema?.transportChannels || [];
ok(ENTREE.length === 3, `1. trois canaux d'entrée attendus (décision 2026-07-26) — reçu ${JSON.stringify(ENTREE)}`);
for (const c of ['midi', 'osc', 'keyboard']) {
  ok(ENTREE.includes(c), `1. '${c}' doit être un canal d'ENTRÉE`);
}
// Le clavier entre côté entrée et NULLE PART ailleurs : une sortie clavier n'a pas de sens.
ok(!SORTIE.includes('keyboard'), "1. 'keyboard' ne doit PAS rejoindre les canaux de SORTIE");
ok(SORTIE.includes('audio') && !ENTREE.includes('audio'),
   "1. 'audio' est une SORTIE et pas une entrée — les deux listes ne se confondent pas");

// ─── 2. LA DÉCLARATION, dans ses formes valides ──────────────────────────────────────────────
for (const [corps, quoi, attendu] of [
  ['@in pedale transport.midi\n@mode:ord\nS -> C4', 'un rôle et son canal, sans table', { name: 'pedale', transport: 'midi', mapping: null }],
  ['@in pedale transport.midi mapping.fcb_std\n@mode:ord\nS -> C4', 'avec sa table', { name: 'pedale', transport: 'midi', mapping: 'fcb_std' }],
  ['@in touches transport.keyboard mapping.azerty\n@mode:ord\nS -> C4', 'sur le canal clavier', { name: 'touches', transport: 'keyboard', mapping: 'azerty' }],
  ['@in o transport.osc\n@mode:ord\nS -> C4', 'sur le canal OSC', { name: 'o', transport: 'osc', mapping: null }],
]) {
  const r = compile(corps);
  ok((r.errors || []).length === 0,
     `2. ${quoi} doit compiler — reçu : ${(r.errors || []).map((e) => e.message || e).join(' | ')}`);
  const e = (r.ast?.inputs || [])[0];
  ok(e && e.name === attendu.name && e.transport === attendu.transport && (e.mapping ?? null) === attendu.mapping,
     `2. ${quoi} : l'entrée doit ARRIVER telle qu'écrite — reçu : ${JSON.stringify(e)}`);
}
// Plusieurs entrées coexistent.
{
  const r = compile('@in a transport.midi\n@in b transport.osc\n@mode:ord\nS -> C4');
  ok((r.ast?.inputs || []).length === 2, `2. plusieurs entrées doivent coexister — reçu ${(r.ast?.inputs || []).length}`);
}

// ─── 3. LES TROIS CONTRAINTES REFUSENT, ET LE REFUS DIT POURQUOI ─────────────────────────────
for (const [corps, quoi, mot] of [
  ['@in x transport.midi(port:LPK25)\n@mode:ord\nS -> C4', 'un NOM DE PORT dans la scène', 'port'],
  // ⚠️ Le mot 'alphabet' ne suffit PAS à distinguer ce refus : le message générique « propriété
  // inconnue » le contient aussi. Prouvé par injection le 2026-07-27 — en désactivant la branche
  // dédiée, la garde restait VERTE. On exige donc ce que la contrainte a de PROPRE : dire qu'il
  // n'y a rien à résoudre en entrée, et renvoyer vers la table.
  ['@in x transport.midi alphabet.sargam\n@mode:ord\nS -> C4', 'un ALPHABET sur une entrée', 'rien'],
  ['@in x transport.audio\n@mode:ord\nS -> C4', 'un canal de SORTIE employé en entrée', 'audio'],
  ['@in x transport.bluetooth\n@mode:ord\nS -> C4', 'un canal inventé', 'bluetooth'],
  ['@in x transport.midi octaves.western\n@mode:ord\nS -> C4', 'une propriété étrangère', 'octaves'],
  ['@in x\n@mode:ord\nS -> C4', 'une entrée sans canal', 'canal'],
  ['@in\n@mode:ord\nS -> C4', 'une entrée sans nom', 'rôle'],
]) {
  const r = compile(corps);
  const msg = (r.errors || []).map((e) => e.message || e).join(' | ');
  ok((r.errors || []).length > 0, `3. ${quoi} doit être REFUSÉ`);
  ok(msg.includes(mot), `3. et le refus doit NOMMER la faute ('${mot}') — reçu : ${msg.slice(0, 120)}`);
}
// Le refus de l'alphabet doit dire POURQUOI, pas seulement refuser.
{
  const msg = (compile('@in x transport.midi alphabet.sargam\n@mode:ord\nS -> C4').errors || [])
    .map((e) => e.message || e).join(' | ');
  ok(msg.includes('AUCUN alphabet') && msg.includes('DISCRET') && msg.includes('mapping'),
     `3. le refus de l'alphabet doit expliquer qu'il n'y a RIEN à résoudre en entrée et renvoyer `
     + `vers la table — reçu : ${msg.slice(0, 160)}`);
}
// CONTRAINTE 3 : aucune table n'est inventée quand rien n'est déclaré.
{
  const r = compile('@in x transport.midi\n@mode:ord\nS -> C4');
  const e = (r.ast?.inputs || [])[0];
  ok(e && (e.mapping === null || e.mapping === undefined),
     `3. AUCUNE table par défaut ne doit être posée — reçu : ${JSON.stringify(e)}`);
}

// ─── 4. LA TABLE EST UNE INVOCATION DE LIBRAIRIE — son adresse doit SORTIR ───────────────────
// Sinon la scène « déclare » une table que l'aval ne voit jamais : accepter n'est pas transmettre.
{
  const r = compile('@in pedale transport.midi mapping.fcb_std\n@mode:ord\nS -> C4');
  ok((r.ast?.libRefs || []).includes('mapping.fcb_std'),
     `4. l'adresse de la table doit être ÉMISE — libRefs = ${JSON.stringify(r.ast?.libRefs ?? null)}`);
}
// La librairie existe, déclare son domaine, et reste VIDE tant que Romain n'a pas donné de table.
ok(LIBS.mapping?.domain === 'mapping',
   `4. lib/mapping.json doit déclarer son domaine — reçu : ${JSON.stringify(LIBS.mapping?.domain)}`);
{
  const entrees = Object.keys(LIBS.mapping || {}).filter((k) => !k.startsWith('_') && k !== 'domain');
  ok(entrees.length === 0,
     `4. et rester VIDE de contenu — un contenu de démonstration finirait cité comme référence. Reçu : ${JSON.stringify(entrees)}`);
}

// ─── 5. L'ADRESSE AU POINT D'USAGE — côté droit IDENTIFIANT ──────────────────────────────────
{
  const r = compile('@in pedale transport.midi\n@mode:ord\nS -> C4 <!pedale.suivant D4');
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
  const r = compile('@in pedale transport.midi\n@mode:ord\nS -> C4 <!pedale D4');
  const trig = ((r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [])[0]?.triggers || [])[0];
  ok(trig && trig.address === undefined, `5. sans point, AUCUNE adresse ne doit apparaître — reçu : ${JSON.stringify(trig)}`);
}

// ─── 6. TÉMOIN D'EXCLUSION — la forme NUMÉRIQUE reste dehors ─────────────────────────────────
// ⚠️ Ce témoin garde une ABSENCE, et c'est voulu : il doit ROUGIR le jour où quelqu'un implémente
// la forme numérique sans que la règle de désambiguïsation ait été tranchée par Romain. Le jour de
// l'arbitrage, il se RETOURNE (il exigera l'adresse) au lieu d'être supprimé.
{
  const r = compile('@in brut transport.midi\n@mode:ord\nS -> C4 <!brut.60 D4');
  ok((r.errors || []).length === 0, "6. la séquence doit rester lisible (période + terminal), pas planter");
  const types = (r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || []).map((e) => e.type);
  ok(types.includes('Period') && types.includes('NumericTerminal'),
     `6. un point suivi d'un NOMBRE reste PÉRIODE + TERMINAL — la forme numérique n'est PAS `
     + `implémentée tant que la règle n'est pas tranchée. Reçu : ${JSON.stringify(types)}`);
  const trig = ((r.ast?.subgrammars?.[0]?.rules?.[0]?.rhs || [])[0]?.triggers || [])[0];
  ok(trig && trig.address === undefined,
     `6. et surtout AUCUNE adresse ne doit être fabriquée depuis le nombre — reçu : ${JSON.stringify(trig)}`);
}

if (echecs.length) {
  console.error(`❌ déclaration d'entrée : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ déclaration d'entrée @in — ${passe} vérification(s) passée(s) sur ${ENTREE.length} canal(aux) d'entrée`);
}
