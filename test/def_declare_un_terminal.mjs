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

const compiler = (corps, suite = '\nS -> C4\n') => {
  try { return compileToBPxAST(`@core\n@alphabet.western\n${corps}${suite}`); }
  catch (e) { return { errors: [{ message: e.message }] }; }
};
const messages = (r) => (r.errors || []).map((e) => e.message ?? e).join(' | ');
const defDe = (r) => (r.ast?.directives || []).find((d) => d.type === 'DefDirective');

// ── A. LES FORMES QUE LA RÉFÉRENCE ÉCRIT ─────────────────────────────────────────────────────
// Les deux premières sont ses exemples LITTÉRAUX ; les suivantes couvrent la même construction.
const FORMES = [
  ['une clé qui APPELLE un composant',  '@def ka  voice.sec',                    { voice: 'sec' }],
  ['une clé qui AFFECTE une valeur',    '@def muet  sounding:false',             { sounding: 'false' }],
  ['deux clés sur la même ligne',       '@def sirene  hz:440  voice.sec',        { hz: '440', voice: 'sec' }],
  ['un bloc indenté, une clé par ligne','@def cloche\n  register:5\n  degree:0', { register: '5', degree: '0' }],
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
  const r = compiler('@def cloche\n  register:5\nS -> C4 D4\n', '');
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
for (const [quoi, corps, fragment] of [
  ['une définition sans rien',        '@def vide',            /ne déclare rien/],
  ['une clé ni appelée ni affectée',  '@def ka  voice',       /ni un appel de composant ni une affectation/],
  ['un point sans nom derrière',      '@def ka  voice.',      /nom attendu après/],
  ['un deux-points sans valeur',      '@def ka  hz:',         /valeur attendue après/],
  ['aucun nom après la directive',    '@def',                 /doit nommer ce qu'il définit/],
]) {
  const msg = messages(compiler(corps));
  ok(fragment.test(msg),
     `C-témoin. ${quoi} — doit REFUSER en nommant la faute. Reçu : ${msg.slice(0, 100) || 'aucune erreur'}`);
}

// ── D. LES CORPS PAS ENCORE LUS REFUSENT, ILS NE SONT PAS LUS DE TRAVERS ─────────────────────
// ⚠️ La référence décrit six corps ; ce palier n'en lit qu'un. Les cinq autres doivent CRIER —
// un corps qu'on ne sait pas lire ne doit jamais tomber dans une branche voisine et produire un
// arbre plausible. C'est la différence entre « pas encore fait » et « faux sans le dire ».
for (const [quoi, corps] of [
  ['un branchement',              '@def souffle lfo1.out >> lpf1.cutoff'],
  ['une transformation',          '@def accent(x) x(vel:120)'],
  ['un préréglage',               '@def kick (vel:120)'],
]) {
  ok(messages(compiler(corps)) !== '',
     `D. ${quoi} n'est pas encore lu par ce palier — il doit REFUSER, et il passe. Un corps lu de `
     + `travers produit un arbre plausible et faux, ce qui est pire qu'un refus.`);
}

// ── SOCLE ────────────────────────────────────────────────────────────────────────────────────
ok(FORMES.length >= 4, `SOCLE : ${FORMES.length} formes mesurées, 4 au moins attendues.`);

if (echecs.length) {
  console.error(`❌ @def déclare un terminal : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ '@def' déclare un terminal — ${FORMES.length} formes de la référence lues et RANGÉES `
          + `dans l'arbre, bloc borné par l'indentation, 5 refus nommés et 3 corps pas encore lus `
          + `qui crient au lieu de mentir. ${passe} vérification(s) passée(s).`);
