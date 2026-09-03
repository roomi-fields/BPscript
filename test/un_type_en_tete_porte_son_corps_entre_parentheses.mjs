#!/usr/bin/env node
/**
 * GARDE — UN TYPE EN TÊTE DE LIGNE PORTE SON CORPS ENTRE PARENTHÈSES.
 *
 * Décision Romain, 2026-08-16 : les quatre types et le mécanisme d'énumération s'écrivent avec la
 * parenthèse — « la forme du langage, celle qui porte ce qui appartient à ce qui la précède ».
 *
 *     enum valuetype(value, range, param, hz)          un vocabulaire fermé
 *     control sync(args:message, scope:flow)           ce qui module
 *     addresskey ch(scope:flow)                        ce qui route
 *     native srand(bp3:_srand)                         ce qui traduit
 *     destination midi(resolvedBy:runtime-MIDI)        qui résout
 *
 * ⛔ CE QUI BLOQUAIT ÉTAIT LA POSITION, PAS LE MOT. La récursivité par la parenthèse se lisait DANS
 * un sac depuis le 2026-08-19 et restait refusée EN TÊTE DE LIGNE. Le refus accusait la virgule
 * (« Expected COLON, got COMMA ») alors que la faute était qu'aucun lecteur de corps n'y était
 * branché. Un message qui accuse le mauvais jeton envoie l'auteur réparer ce qui va bien.
 *
 * ⛔ LE TYPE SE DÉCLARE DANS LA DONNÉE, jamais dans le parseur — décision du 2026-08-15. Le garde
 * lit donc la liste PAR LA PORTE que le code expose, et refuse de la recopier : une seconde liste
 * ici vaudrait seconde autorité, et c'est la faute qu'on a déjà payée sur les axes à catalogue.
 *
 * ⚠️ ET LE GARDE TIENT LES TÉMOINS DES FORMES VOISINES. Le même lecteur sert le drapeau, la
 * convention et le module : ouvrir la parenthèse pour les uns sans toucher les autres est
 * précisément ce qui doit être prouvé, pas supposé.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const TETE = 'core\nalphabet.western\n';
const lire = (ligne) => {
  const r = compileToBPxAST(`${TETE}${ligne}\n-----\nS -> C4\n`);
  return { erreurs: (r.errors || []).map((e) => String(e.message ?? e)), vars: r.ast?.vars || [] };
};
/** Les clés du corps, dans l'ordre écrit. */
const corpsDe = (v) => (v?.settings?.pairs || []).map((p) => p.key);
const valeurDe = (v, cle) => (v?.settings?.pairs || []).find((p) => p.key === cle)?.value;

console.log('[type-en-tête] un type en tête porte son corps entre parenthèses');

// ── 0. LA LISTE DES TYPES VIENT DE LA DONNÉE ────────────────────────────────────────────────
// ⛔ LES TYPES DU SOCLE SONT DES OBJETS DE `types`, PLUS UNE LISTE DE `core` — Romain, 2026-09-02.
// `object` (sorti le 2026-09-02, `def` est le mot unique) et `native` (forme B : un geste natif est
// un `control` portant `bpscript:false`) n'y figurent pas.
const TYPES = Object.entries(LIBS.types || {})
  .filter(([k, v]) => k !== 'types' && v && typeof v === 'object' && !Array.isArray(v)).map(([k]) => k);
ok(TYPES.length >= 6, `0. les types déclaratifs se lisent dans 'types' — reçu ${JSON.stringify(TYPES)}`);
for (const t of ['control', 'addresskey', 'destination', 'enum', 'flag', 'symbol']) {
  ok(TYPES.includes(t), `0. le type '${t}' doit être un objet de 'types'`);
}
ok(!TYPES.includes('native') && !TYPES.includes('object'),
   `0. 'native' et 'object' ne sont plus des types du socle — reçu ${JSON.stringify(TYPES)}`);

// ── 1. CHAQUE TYPE PORTE SON CORPS, ET LE CORPS ARRIVE STRUCTURÉ ────────────────────────────
for (const [ligne, nom, clesAttendues] of [
  ['enum valuetype(value, range, param, hz)', 'valuetype', ['value', 'range', 'param', 'hz']],
  ['enum message(start, continue, stop)', 'message', ['start', 'continue', 'stop']],
  ['control sync(args:message, scope:flow)', 'sync', ['args', 'scope']],
  ['addresskey ch(scope:flow)', 'ch', ['scope']],
  // Forme B (Romain, 2026-09-02) : un geste natif est un `control` qui porte `bpscript:false`.
  ['control srand(bp3:_srand, bpscript:false)', 'srand', ['bp3', 'bpscript']],
  ['destination midi(resolvedBy:runtime-MIDI, version:1.0.0)', 'midi', ['resolvedBy', 'version']],
  // ⛔ `object racine(…)` A QUITTÉ CETTE TABLE LE 2026-09-02. La réserve de Romain du 2026-08-16
  // — `object racine(a:1)` et `def racine(a:1)` rendent le même contenu — a tranché : `object`
  // est SORTI, `def` est le mot unique, et une racine n'est pas un TYPE en tête. Sa forme, et le
  // collage de sa parenthèse, sont gardés par `def_declare_un_terminal.mjs`.
]) {
  const { erreurs, vars } = lire(ligne);
  ok(erreurs.length === 0, `1. '${ligne}' doit COMPILER — reçu : ${erreurs[0]?.slice(0, 120)}`);
  const v = vars.find((x) => (x.names || []).includes(nom));
  ok(v != null, `1. '${ligne}' doit déclarer '${nom}' — reçu ${JSON.stringify(vars.map((x) => x.names))}`);
  ok(v?.varType?.kind === 'type' && v?.varType?.type === ligne.split(' ')[0],
    `1. '${nom}' doit porter son TYPE — reçu ${JSON.stringify(v?.varType)}`);
  // ⛔ COMPILER NE SUFFIT PAS : le mode d'échec qu'on ferme est une graphie acceptée qui ne porte
  // rien. On exige les clés, ET DANS L'ORDRE ÉCRIT — un enum est une suite dont le rang peut être
  // lu ailleurs.
  ok(JSON.stringify(corpsDe(v)) === JSON.stringify(clesAttendues),
    `1. le corps de '${nom}' doit arriver ${JSON.stringify(clesAttendues)}, dans cet ordre — reçu `
    + `${JSON.stringify(corpsDe(v))}`);
}

// ── 2. UN COUPLE ET UNE SUITE COHABITENT DANS LE MÊME CORPS ─────────────────────────────────
// ⛔ CE VOLET A ÉCRIT UNE FORME MORTE PENDANT UNE HEURE : il posait
// `scope:symbol group rule flow` — une valeur en quatre parties — et l'exigeait entière. Romain a
// tranché le même soir que dans le déclaratif SEULE LA VIRGULE SÉPARE. Un garde qui certifie la
// forme qu'on vient de retirer la maintient en vie mieux qu'un oubli.
{
  const { erreurs, vars } = lire('control vel(args:value, scope(symbol, group, rule, flow))');
  ok(erreurs.length === 0, `2. un corps mêlant un couple et une suite doit compiler — ${erreurs[0]}`);
  const v = vars[0];
  ok(valeurDe(v, 'args') === 'value', `2. le couple reste intact — reçu ${JSON.stringify(valeurDe(v, 'args'))}`);
  ok(corpsDe({ settings: valeurDe(v, 'scope') }).join() === 'symbol,group,rule,flow',
    `2. la suite arrive entière et dans son ordre — reçu ${JSON.stringify(valeurDe(v, 'scope'))}`);
  // Et la forme d'hier est REFUSÉE ici comme partout dans le déclaratif.
  ok(lire('control vel(args:value, scope:symbol group rule flow)').erreurs.length >= 1,
    '2. la valeur à plusieurs parties doit être REFUSÉE dans un corps de type — l\'espace n\'y sépare rien');
}
{
  // La récursivité descend d'un niveau ici comme ailleurs — un seul lecteur de sac.
  const { erreurs, vars } = lire('control vel(range(min:0, max:127), scope:flow)');
  ok(erreurs.length === 0, `2. une parenthèse imbriquée doit descendre d'un niveau — ${erreurs[0]}`);
  ok(valeurDe(vars[0], 'range')?.type === 'SettingBag',
    `2. et rendre une STRUCTURE, jamais du texte — reçu ${JSON.stringify(valeurDe(vars[0], 'range'))?.slice(0, 80)}`);
}

// ── 3. TÉMOINS — LES FORMES VOISINES NE BOUGENT PAS ─────────────────────────────────────────
// Sans eux, un lecteur qui aurait happé le drapeau, la convention ou le module passerait tout
// ce qui précède en triomphe.
{
  const f = lire('flag section:1').vars[0];
  // ⛔ LE DRAPEAU N A PLUS D ETATS DEPUIS LE 2026-08-22 : il porte sa VALEUR INITIALE, et ce témoin
  // garde ce qu il gardait — que son lecteur reste PROPRE, distinct du corps parenthésé générique.
  ok(f?.varType?.kind === 'flag' && f.varType.initiale === 1 && f.varType.states?.length === 0,
    `3. TÉMOIN — le DRAPEAU garde son lecteur propre et porte sa valeur initiale, sans fabriquer `
    + `d'état — reçu ${JSON.stringify(f?.varType)}`);
  const c = lire('signal grain:0.5').vars[0];
  ok(c?.varType?.kind === 'convention' && c.initial?.[0]?.value === 0.5,
    `3. TÉMOIN — la CONVENTION garde sa valeur de départ collée — reçu ${JSON.stringify(c)}`);
  // ⛔ LE TROISIÈME TÉMOIN EST PARTI AVEC LE TYPE QU'IL GARDAIT. Il éprouvait que `adsr env1` reste
  // lu comme un MODULE — l'un des trois qui empêchaient qu'un lecteur trop gourmand happe le
  // drapeau, la convention ou le module d'un seul coup. Le catalogue `mod` est archivé le
  // 2026-08-23, aucun chemin ne produit plus un `varType.kind === 'module'`, et le lecteur qui le
  // fabriquait est sorti de `parser.js`. Les deux témoins restants tiennent ce que celui-ci
  // partageait : le drapeau et la convention gardent chacun leur forme.
}

// ── 4. LES REFUS QUI BORNENT LA FORME ───────────────────────────────────────────────────────
{
  const inconnu = lire('lpf lpf1');
  ok(inconnu.erreurs.length >= 1 && /is not a type in scope/.test(inconnu.erreurs[0]),
    `4. un type NON DÉCLARÉ reste refusé en nommant les types — reçu ${inconnu.erreurs[0]?.slice(0, 90)}`);
  // Depuis le 2026-09-02 les types sont des objets en portée : le refus nomme d'où ils viennent.
  ok(/object in scope/.test(inconnu.erreurs[0] || '') && /'types'/.test(inconnu.erreurs[0] || ''),
    '4. et le refus doit dire qu\'un type est un objet en portée et nommer \'types\' — sinon il envoie l\'auteur chercher ailleurs');
  const sansNom = lire('enum');
  ok(sansNom.erreurs.length >= 1 && /must name what it declares/.test(sansNom.erreurs[0]),
    `4. un type SEUL sur sa ligne ne déclare rien — reçu ${sansNom.erreurs[0]?.slice(0, 90)}`);
}

ok(passe >= 30, `le garde doit avoir EXAMINÉ, pas seulement tourné(${passe} assertions)`);

if (echecs.length) {
  console.error(`[type-en-tête] ${echecs.length} ÉCHEC(S) :`);
  for (const e of echecs) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`[type-en-tête] ${passe} PASS / 0 FAIL — ${passe} assertion(s)`);
