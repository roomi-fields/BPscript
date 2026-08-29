#!/usr/bin/env node
/**
 * GARDE — un POINT D'ATTENTE nomme ce qu'il attend, et ce nom se DÉCLARE.
 *
 * DÉCISION DE ROMAIN, 2026-08-15 : « oui il doit être déclaré, sinon on ne sait pas ce qu'on
 * attend ». La forme de déclaration existait depuis le 2026-08-04 — `@var <nom> in.<canal>` — et
 * c'est son EXIGENCE qui manquait, jamais sa graphie.
 *
 * ⛔ CE QUI PASSAIT, ET C'EST LE MODE D'ÉCHEC QUI COMPTE. `<!depart` et `<!depatr` étaient deux
 * points d'attente valides et sans rapport, en silence. Une coquille ne casse rien : elle fabrique
 * une SECONDE attente que rien ne viendra jamais satisfaire, et la dérivation s'arrête pour
 * toujours sans un mot. C'est le pire des trois — ni refus, ni son, ni trace.
 *
 * ⛔ LE REFUS PORTE SUR LA RACINE, ADRESSÉE OU NON — une seule règle, pas deux. Dans `<!p.60`, `p`
 * est le RÔLE et `.60` est l'ADRESSE ; c'est `p` qui se déclare, jamais l'adresse. Romain, même
 * jour : « bien oui, sinon comment on sait ce qu'est `p` ? ».
 *
 * ⚠️ LA DÉFINITION DE « DÉCLARÉ » EST LARGE, ET C'EST UN CHOIX ARMÉ EN LE SACHANT : tout ce qui
 * CRÉE le nom dans la scène — entrée, variable de travail, porte, trigger, acteur. Sur le corpus
 * d'aujourd'hui, la définition large et l'étroite donnent EXACTEMENT le même résultat : les cinq
 * scènes migrées déclarent toutes par `@var <nom> in.<canal>`. Le jour où quelqu'un déclarera
 * autrement, la large l'acceptera — le volet 4 mesure cet écart pour qu'il ne se découvre pas par
 * surprise.
 *
 * L'ORDRE DU MOUVEMENT, tenu : les cinq scènes du périmètre ont déclaré D'ABORD (trois canaux
 * différents, chacun choisi par le propriétaire), et le refus n'a été armé qu'ensuite. Mesure des
 * 885 avant/après l'armement : ZÉRO cassée.
 *
 * INJECTION dans le JUGE, et le complément : ce qui doit continuer de passer.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const T = 'core\nalphabet.western\n';
const erreursDe = (src) => {
  try { return compileToBPxAST(src).errors ?? []; } catch (e) { return [{ message: e.message }]; }
};
const refus = (src) =>
  erreursDe(src).filter((e) => /attend un signal que rien ne déclare/.test(String(e.message)));

// ── 1. LES TROIS GRAPHIES DU POINT D'ATTENTE, NON DÉCLARÉES, SONT REFUSÉES ──────────────────
// La matrice est le point : une seule règle doit valoir pour les trois, sinon la graphie décide
// du refus et un auteur contourne en changeant d'écriture.
const GRAPHIES = [
  ['espacée',    'S -> C4 <!depart D4'],
  ['collée',     'S -> A<!depart'],
  ['adressée',   'S -> C4 <!depart.60 D4'],
];
for (const [quoi, ligne] of GRAPHIES) {
  const m = refus(`${T}-----\n${ligne}\n`);
  ok(m.length > 0, `1. la graphie ${quoi} non déclarée doit être REFUSÉE`);
  ok(m.length > 0 && /depart/.test(m[0].message),
     `1. et le refus doit NOMMER le nom attendu — reçu : ${m[0] && m[0].message.slice(0, 90)}`);
}

// ── 2. LES MÊMES, DÉCLARÉES, PASSENT ────────────────────────────────────────────────────────
// Le complément, et c'est la moitié qu'on casse : un refus trop large refuserait aussi la forme
// juste, et les six vérifications ci-dessus resteraient vertes.
for (const [quoi, ligne] of GRAPHIES) {
  ok(erreursDe(`${T}in.midi depart\n-----\n${ligne}\n`).length === 0,
     `2. la graphie ${quoi} DÉCLARÉE doit compiler — reçu : `
     + `${erreursDe(`${T}in.midi depart\n-----\n${ligne}\n`).map((e) => e.message).join(' | ').slice(0, 90)}`);
}

// ── 3. LA COQUILLE — le cas qui motive tout le geste ────────────────────────────────────────
{
  const m = refus(`${T}in.midi depart\n-----\nS -> C4 <!depatr D4\n`);
  ok(m.length > 0 && /depatr/.test(m[0].message),
     `3. une COQUILLE sur un nom déclaré doit être refusée en nommant le nom FAUTIF, pas le juste `
     + `— c'est elle qui fabriquait une seconde attente que rien ne satisfait`);
}

// ── 4. LA DÉFINITION LARGE, MESURÉE — pour que le resserrage éventuel soit un geste borné ────
// ⚠️ CE VOLET NE DÉFEND PAS LA DÉFINITION LARGE, IL LA REND VISIBLE. Si Romain la resserre à la
// seule entrée, ces trois lignes rougissent et disent exactement ce qui change.
for (const [quoi, declaration] of [
  ["une ENTRÉE",              'in.midi depart'],
  ["une variable de travail", 'symbol depart'],
  ["un acteur",               'actor depart\n  alphabet.western\n  out.midi'],
]) {
  ok(erreursDe(`${T}${declaration}\n-----\nS -> C4 <!depart D4\n`).length === 0,
     `4. la définition LARGE accepte ${quoi} — si ce volet rougit, la définition a été resserrée, `
     + `et c'est peut-être voulu : relire avant de réparer`);
}

// ── 4bis. LES TROIS NIVEAUX DE PRÉCISION — arbitrage de Romain, 2026-08-15 ──────────────────
// « Un point de synchronisation, dans tous les cas, attend un ÉVÉNEMENT. Un événement peut être
// déclenché par une infinité de choses. » La DÉCLARATION dit d'où ça vient, la QUALIFICATION dit
// quoi exactement : ce sont deux questions, pas deux formes rivales.
for (const [quoi, src] of [
  ['le rôle seul',        `${T}in.midi sync1\n-----\nS -> C4 <!sync1 D4\n`],
  ['le rôle adressé',     `${T}in.midi sync1\n-----\nS -> C4 <!sync1.60 D4\n`],
  ['la direction, pleinement qualifiée', 'core\n-----\nS -> C4 <!in.midi(note:60, channel:3)\n'],
  ['la direction, nue',   'core\n-----\nS -> C4 <!in.midi\n'],
]) {
  ok(erreursDe(src).length === 0,
     `4bis. ${quoi} doit compiler — reçu : ${erreursDe(src).map((e) => e.message).join(' | ').slice(0, 90)}`);
}
// LE COMPLÉMENT DE L'EXEMPTION : une direction ne se déclare pas, mais un mot RETIRÉ n'est pas une
// direction. `transport` est sorti du langage le 2026-08-04 ; sa légende parle encore de direction,
// et une dérivation par cette légende l'aurait exempté. Le catalogue des canaux, lui, ne décrit que
// ce qui existe — ce volet tient ce choix de dérivation.
ok(refus(`${T}-----\nS -> C4 <!transport D4\n`).length > 0,
   "4bis. un mot RETIRÉ du langage n'est pas une direction : '<!transport' doit être refusé");

// ── 4ter. RIEN NE S'INTERCALE ENTRE LE SIGNE ET SA RACINE ───────────────────────────────────
// Romain, même jour : « attention à l'espace, on a un langage dans lequel les espaces ont du sens ».
// Les deux graphies compilaient et rendaient le MÊME arbre — deux écritures pour une chose, dans un
// langage où l'espace SÉPARE deux termes. Mesuré avant le refus : zéro scène du périmètre l'écrit.
for (const [quoi, src] of [
  ['un rôle',      `${T}in.midi sync1\n-----\nS -> C4 <! sync1 D4\n`],
  ['une direction', 'core\n-----\nS -> C4 <! in.midi(note:60)\n'],
]) {
  const m = erreursDe(src).filter((e) => /rien ne s'intercale/.test(String(e.message)));
  ok(m.length > 0, `4ter. l'espace après '<!' devant ${quoi} doit être REFUSÉ`);
}

// ── 5. LE COMPLÉMENT — une scène sans point d'attente n'est pas touchée ─────────────────────
for (const [quoi, src] of [
  ['une scène ordinaire',        `${T}-----\nS -> C4 D4 E4\n`],
  ['une entrée déclarée non employée', `${T}in.midi depart\n-----\nS -> C4 D4\n`],
]) {
  ok(erreursDe(src).length === 0, `5. ${quoi} doit compiler`);
}

// ── 6. À L'ARRIVÉE — le nœud porte le nom déclaré ───────────────────────────────────────────
// « Compile » n'est pas « désigne » : c'est la leçon du retrait d'`alias`, où une déclaration
// compilait de bout en bout sans que l'arbre en porte la moindre trace.
{
  const r = compileToBPxAST(`${T}in.midi depart\n-----\nS -> C4 <!depart.60 D4\n`);
  const attentes = [];
  (function marcher(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const e of n) marcher(e); return; }
    if (n.type === 'Wait') attentes.push(n);
    for (const k in n) marcher(n[k]);
  })(r.ast);
  ok(attentes.length === 1 && attentes[0].name === 'depart',
     `6. l'arbre doit porter UN point d'attente nommé 'depart' — vu ${JSON.stringify(attentes.map((w) => w.name))}`);
  ok(attentes[0] && attentes[0].address === 60,
     `6. et son ADRESSE, distincte de sa racine — vue ${JSON.stringify(attentes[0] && attentes[0].address)}`);
  // ⛔ UN GARDE QUI PLANTE N'EST PAS UN GARDE QUI ROUGIT. Sans ce défaut, le jour où cette scène
  // cesse de compiler, ce volet lève sur `null` et le portillon rend une TRACE DE PILE au lieu de
  // la phrase qui dit ce qui a changé. Trouvé le 2026-08-29 en injectant un refus trop large.
  const roles = ((r.ast || {}).inputs || []).flatMap((i) => i.names || (i.name ? [i.name] : []));
  ok(roles.includes('depart'),
     `6. le rôle déclaré doit vivre dans l'arbre — vus ${JSON.stringify(roles)}`);
}

// ── 7. INJECTION DANS LE JUGE — la décision rejouée isolée ──────────────────────────────────
const juger = (nom, connus) => !connus.has(nom);
const connus = new Set(['depart', 'touches']);
ok(juger('depatr', connus), '7. (mord) une coquille rougit');
ok(!juger('depart', connus), '7. (se tait) un nom déclaré passe');
ok(juger('p', connus), '7. (mord) un nom jamais vu rougit');

const TOTAL_ATTENDU = GRAPHIES.length * 2 + GRAPHIES.length + 1 + 3 + 5 + 2 + 2 + 3 + 3;
ok(passe + echecs.length === TOTAL_ATTENDU,
   `bilan : ${TOTAL_ATTENDU} vérifications attendues, ${passe + echecs.length} exécutées`);

if (echecs.length) {
  console.error(`❌ un point d'attente nomme ce qu'il attend : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`✅ un point d'attente nomme ce qu'il attend — ${passe} vérification(s) passée(s)`);
}
