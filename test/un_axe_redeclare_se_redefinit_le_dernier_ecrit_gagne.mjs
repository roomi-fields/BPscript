#!/usr/bin/env node
/**
 * UN AXE REDÉCLARÉ SE REDÉFINIT — LE DERNIER ÉCRIT GAGNE.
 *
 * ARBITRAGE DE ROMAIN, 2026-08-23 : *« un axe redéclaré se redéfinit : le dernier écrit gagne, y
 * compris `alphabet`. LE REFUS ET LE PREMIER-QUI-TIENT SORTENT TOUS LES DEUX. »* C'est la même règle
 * que les trois clauses du prototypal pur, énoncée sur le MEMBRE au lieu de l'objet : rien n'est
 * scellé, tout membre est redéfinissable.
 *
 * ⛔ CE BANC REMPLACE SON EXACT CONTRAIRE, ET C'EST TOUTE SON HISTOIRE.
 * `un_acteur_ne_declare_pas_deux_fois_la_meme_cle.mjs` verrouillait le REFUS du doublon sur les cinq
 * clés, valeur identique comprise. Je l'avais écrit le 2026-08-22 ; Romain a tranché l'inverse le
 * lendemain. Un banc qui survit à la forme qu'il gardait est un fossile, et un fossile est une voie
 * parallèle : il sort dans le mouvement qui le rend faux, et ce qui le remplace verrouille l'INVERSE.
 *
 * ⚠️ ET LE DIAGNOSTIC D'ORIGINE N'ÉTAIT PAS FAUX — c'est la réparation qui l'était. Le doublon
 * passait EN SILENCE : la dernière écriture gagnait, la première était mangée, sans un mot. Ce qui
 * change n'est pas le comportement, c'est son STATUT : ce qui était muet devient ÉCRIT. La dernière
 * gagne parce que c'est la règle, plus parce que personne n'a regardé.
 *
 * ⚠️ COMPILER NE SUFFIT PAS, ET C'EST LA MOITIÉ QUI COMPTE : un doublon accepté puis mal résolu
 * serait vert ici et faux à l'arrivée. Chaque cas vérifie QUELLE valeur arrive dans l'arbre.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const acteur = (corps) => {
  const src = `core\ntempo:120\n\nactor lead  ${corps}\n\n-----\nS -> -\n`;
  try {
    const r = compileToBPxAST(src, {});
    const errs = (r.errors || []).map((x) => x.message || String(x));
    const a = ((r.ast && r.ast.actors) || []).find((x) => x.name === 'lead');
    return { ok: !!r.ast && !errs.length, err: errs[0] || '', props: (a && a.properties) || {} };
  } catch (e) { return { ok: false, err: 'JET ' + e.message, props: {} }; }
};

// ── SOCLE — les clés viennent de la DONNÉE, jamais d'une liste écrite ici ─────────────────────
const CLES = LIBS.core.schema.actorKeys || [];
ok(CLES.length >= 5,
   `SOCLE : ${CLES.length} clé(s) d'acteur lues dans la donnée, 5 au moins attendues.`);

/** deux valeurs vivantes par clé, plus ce qu'il faut pour compiler. */
const FORMES = {
  alphabet: ['alphabet.western', 'alphabet.sargam', 'out.midi(ch:1)'],
  tuning:   ['tuning.western_12TET', 'tuning.western_just', 'alphabet.western out.midi(ch:1)'],
  octaves:  ['octaves.western', 'octaves.arrows', 'alphabet.western out.midi(ch:1)'],
  out:      ['out.midi(ch:1)', 'out.audio', 'alphabet.western'],
};
for (const k of CLES) {
  if (k === 'eval') continue;   // un producteur `eval` sort en natif : il refuse pour une AUTRE cause
  ok(!!FORMES[k],
     `SOCLE : la clé '${k}' est déclarée dans la donnée et cette matrice n'a aucune forme pour elle.`);
}

// ── A. LE DERNIER ÉCRIT GAGNE — sur chaque clé, et l'arbre le PORTE ──────────────────────────
for (const cle of Object.keys(FORMES)) {
  const [a, b, reste] = FORMES[cle];
  const r = acteur(`${a} ${b} ${reste}`.trim());
  ok(r.ok, `A. '${cle}' redéclarée doit COMPILER — le refus est sorti. Reçu : ${r.err.slice(0, 90)}`);
  if (!r.ok) continue;
  const attendu = b.split('.')[1].replace(/\(.*/, '');
  const champ = cle === 'out' ? (r.props.transport || {}).key : r.props[cle];
  ok(champ === attendu,
     `A. '${cle}' — la DERNIÈRE écrite doit gagner : attendu '${attendu}', l'arbre porte `
   + `${JSON.stringify(champ)}. Compiler ne suffit pas ; c'est la valeur qui arrive qui compte.`);
}

// ── B. LE TÉMOIN QUI DISCRIMINE — une seule déclaration porte la sienne ──────────────────────
// Sans lui, « la dernière gagne » ne se distingue pas de « une valeur fixe est écrite ».
for (const cle of Object.keys(FORMES)) {
  const [, b, reste] = FORMES[cle];
  const r = acteur(`${b} ${reste}`.trim());
  ok(r.ok, `B-témoin. '${cle}' écrite UNE FOIS doit compiler. Reçu : ${r.err.slice(0, 80)}`);
  if (!r.ok) continue;
  const attendu = b.split('.')[1].replace(/\(.*/, '');
  const champ = cle === 'out' ? (r.props.transport || {}).key : r.props[cle];
  ok(champ === attendu, `B-témoin. '${cle}' seule → attendu '${attendu}', reçu ${JSON.stringify(champ)}`);
}

// ── C. LA VALEUR IDENTIQUE PASSE AUSSI ───────────────────────────────────────────────────────
// ⛔ L'ANCIEN BANC LA REFUSAIT NOMMÉMENT — « écrire deux fois la même chose est le signe qu'on croit
// en écrire deux ». La règle ne fait aucune exception : rien n'est scellé, donc rien ne se refuse.
{
  const r = acteur('alphabet.western alphabet.western out.midi(ch:1)');
  ok(r.ok, `C. la même valeur écrite DEUX FOIS doit passer — la règle n'a pas d'exception. `
         + `Reçu : ${r.err.slice(0, 90)}`);
  ok(r.props.alphabet === 'western', `C. et elle arrive : ${JSON.stringify(r.props.alphabet)}`);
}

// ── D. TROIS DÉCLARATIONS — la dernière gagne, pas l'avant-dernière ──────────────────────────
// Une implémentation qui garderait « la précédente » passerait le volet A sur deux écritures.
{
  const r = acteur('alphabet.western alphabet.sargam alphabet.tabla out.midi(ch:1)');
  ok(r.ok, `D. trois déclarations doivent passer. Reçu : ${r.err.slice(0, 80)}`);
  ok(r.props.alphabet === 'tabla',
     `D. sur TROIS écritures, c'est la DERNIÈRE qui gagne — attendu 'tabla', reçu `
   + `${JSON.stringify(r.props.alphabet)}. Deux écritures ne distinguent pas « la dernière » de `
   + `« la suivante ».`);
}

// ── D-bis. ⛔ LA PORTEE SCENE AUSSI — ET ELLE A FAILLI RESTER ────────────────────────────────
// La décision dit « y compris `alphabet` ». Le refus du second alphabet de SCÈNE vivait dans un
// AUTRE fichier, sous un AUTRE nom (`refuserAlphabetsMultiples`, bpxAst.js) : ma frappe ne visait
// que la clé d'acteur, et il serait resté.
// ⛔ C'EST LE TÉMOIN POSITIF DE KANOPI QUI L'A MONTRÉ. Elle compilait une scène à deux alphabets
// pour prouver que sa sonde savait voir le cas — et la scène a été REFUSÉE. Son témoin mesurait sa
// sonde ; il a mesuré mon geste. Sans lui je poussais un doublon autorisé chez l'acteur et refusé
// chez la scène.
{
  const src = 'core\nalphabet.western\nalphabet.sargam\n-----\nS -> C4\n';
  let err = '', subkeys = [];
  try {
    const r = compileToBPxAST(src, {});
    err = ((r.errors || [])[0] || {}).message || '';
    subkeys = ((r.ast || {}).directives || []).filter((d) => d.name === 'alphabet').map((d) => d.subkey);
  } catch (e) { err = e.message; }
  ok(err === '', `D-bis. deux alphabets de SCÈNE doivent compiler — le refus de portée scène est `
                + `sorti avec celui d'acteur. Reçu : ${err.slice(0, 90)}`);
  ok(JSON.stringify(subkeys) === '["western","sargam"]',
     `D-bis. et les DEUX arrivent dans l'arbre, dans l'ordre écrit — reçu ${JSON.stringify(subkeys)}. `
   + `Un refus retiré qui laisserait tomber la seconde ligne serait vert au premier volet.`);
}

// ── D-ter. CE QUI DOIT PASSER — repris du banc que ce geste a périmé ─────────────────────────
// ⛔ CES QUATRE FORMES VENAIENT DE `une_scene_ne_declare_qu_un_alphabet.mjs`, supprimé le
// 2026-08-23 : il verrouillait le refus que la décision retire. Son volet A est mort avec le refus,
// mais son volet B restait VRAI — « une règle qui refuserait TOUTE scène passerait le volet A
// entier ». Un banc qu'on supprime emporte en silence ce qu'il gardait de juste.
{
  const DOIVENT_PASSER = [
    ['un seul alphabet — le cas ordinaire', 'core\nalphabet.sargam\n-----\nS -> sa re\n'],
    ['un alphabet avec sa sortie',          'core\nalphabet.sargam:audio\n-----\nS -> sa re\n'],
    ['la voie EXPLICITE — deux vocabulaires, deux acteurs, deux sorties',
     'core\nactor v1\n  alphabet.sargam\n  out.audio\nactor v2\n  alphabet.tabla\n  out.osc\n-----\nS -> v1.sa v2.dhin\n'],
    ['aucun alphabet — la scène hérite du socle', 'core\n-----\nS -> C4 D4\n'],
  ];
  for (const [quoi, src] of DOIVENT_PASSER) {
    let err = '';
    try { const r = compileToBPxAST(src, {}); err = ((r.errors || [])[0] || {}).message || ''; }
    catch (e) { err = e.message; }
    ok(err === '', `D-ter. ${quoi} — REFUSÉ à tort : ${err.replace(/\s+/g, ' ').slice(0, 100)}`);
  }
}

// ── E. LES BORNES — ce que ce retrait ne doit PAS avoir ouvert ───────────────────────────────
{
  const inconnu = acteur('alphabet.zorglub out.midi(ch:1)');
  ok(!inconnu.ok, `E-borne. un alphabet INCONNU reste refusé — le retrait du refus de doublon `
                + `n'ouvre pas la porte à une entrée qui n'existe pas.`);
  const deuxActeurs = (() => {
    const src = 'core\ntempo:120\n\nactor lead  alphabet.western  out.midi(ch:1)\n'
              + 'actor perc  alphabet.tabla    out.midi(ch:2)\n\n-----\nS -> -\n';
    try { const r = compileToBPxAST(src, {}); return ((r.errors || [])[0] || {}).message || ''; }
    catch (e) { return e.message; }
  })();
  ok(deuxActeurs === '',
     `E-borne. DEUX acteurs portant chacun sa clé restent indépendants. Reçu : ${deuxActeurs.slice(0, 80)}`);
}

if (echecs.length) {
  console.error(`❌ un axe redéclaré se redéfinit : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ un axe redéclaré se redéfinit — le DERNIER écrit gagne sur les ${Object.keys(FORMES).length} `
  + `clés que la donnée déclare, la valeur arrive dans l'arbre, la valeur identique passe, la dernière `
  + `de TROIS gagne, et ni l'entrée inconnue ni l'indépendance de deux acteurs n'ont été ouvertes. `
  + `${passe} vérification(s) passée(s).`);
