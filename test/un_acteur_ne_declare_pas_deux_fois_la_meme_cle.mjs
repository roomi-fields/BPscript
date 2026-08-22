#!/usr/bin/env node
/**
 * UN ACTEUR NE DÉCLARE PAS DEUX FOIS LA MÊME CLÉ — ET IL LE DISAIT À PERSONNE.
 *
 * ⛔ CE QUE CE GARDE FERME EST MUET, ET C'EST TOUTE SA VALEUR. `actor lead alphabet.western
 * alphabet.sargam out.midi(ch:1)` était ACCEPTÉ : la dernière écriture gagnait, la première était
 * mangée, sans refus, sans avertissement, sans trace. L'auteur croit déclarer deux choses, il en
 * déclare une, et rien ne le détrompe. C'est la famille exacte du poids muet — une déclaration qui
 * traverse et tombe, et qui ne s'entend qu'à l'arrivée.
 *
 * ⛔ ET LE REFUS EXISTAIT DÉJÀ, UNE PLACE PLUS HAUT : « une scène ne déclare qu'UN alphabet » mord
 * sur les invocations GLOBALES. Il n'avait aucun équivalent sur la clé d'acteur. Le même fait, deux
 * places, une seule gardée.
 *
 * ⚠️ LA PORTÉE VIENT DE LA MESURE, PAS DU CAS SIGNALÉ. On m'a nommé `alphabet` ; j'ai compilé la
 * matrice des CINQ clés que la donnée déclare, et les cinq avalaient le doublon :
 *     valeurs DIFFÉRENTES   tuning, out, eval   accepté — dernière-gagne, en silence
 *                           alphabet, octaves   accepté aussi ; leur refus tombait plus loin, sur un
 *                                               terminal — donc MUET dès que le flux n'en exerce aucun
 *     valeur IDENTIQUE      les cinq            accepté, en silence
 * Un garde écrit pour la seule clé signalée aurait laissé quatre portes ouvertes.
 *
 * ⚠️ ET LE DOUBLON À VALEUR IDENTIQUE EST REFUSÉ AUSSI : écrire deux fois la même chose est le signe
 * qu'on croit en écrire deux. C'est le seul cas où l'erreur d'intention est certaine.
 *
 * ⛔ LES CLÉS SE LISENT DANS LA DONNÉE (`core.schema.actorKeys`), jamais d'une liste ici : une
 * sixième clé ajoutée demain entre dans cette matrice toute seule. Une liste recopiée aurait gardé
 * cinq clés pendant que le langage en porterait six, et son vert n'aurait rien voulu dire.
 */
import { compileToBPxAST } from '../src/transpiler/index.js';
import { LIBS } from '../src/transpiler/libs-data.js';

let passe = 0;
const echecs = [];
const ok = (cond, quoi) => { if (cond) passe++; else echecs.push(quoi); };

const compiler = (corps, flux = '-') => {
  const src = `core\ntempo:120\n\nactor lead  ${corps}\n\n-----\nS -> ${flux}\n`;
  try {
    const r = compileToBPxAST(src, {});
    const errs = (r.errors || []).map((x) => x.message || String(x));
    const a = (r.ast && r.ast.actors || []).find((x) => x.name === 'lead');
    return { ok: !!r.ast && !errs.length, err: errs[0] || '', acteur: a || null };
  } catch (e) { return { ok: false, err: 'JET ' + e.message, acteur: null }; }
};

/** Deux valeurs vivantes par clé — le reste de la ligne d'acteur est ce qu'il faut pour compiler. */
const FORMES = {
  alphabet: ['alphabet.western', 'alphabet.sargam', 'out.midi(ch:1)'],
  tuning:   ['tuning.western_12TET', 'tuning.western_just', 'alphabet.western out.midi(ch:1)'],
  octaves:  ['octaves.western', 'octaves.arrows', 'alphabet.western out.midi(ch:1)'],
  out:      ['out.midi(ch:1)', 'out.audio', 'alphabet.western'],
  eval:     ['eval.js', 'eval.hydra', ''],
};

// ── SOCLE — les clés viennent de la donnée, et la matrice les couvre TOUTES ───────────────────
const CLES = LIBS.core.schema.actorKeys || [];
ok(CLES.length >= 5,
   `SOCLE : ${CLES.length} clé(s) d'acteur lues dans la donnée, 5 au moins attendues. Sous ce seuil, `
 + `ce garde est vert parce qu'il n'a rien à éprouver.`);
for (const k of CLES) {
  ok(!!FORMES[k],
     `SOCLE : la clé '${k}' est déclarée dans core.schema.actorKeys et cette matrice n'a aucune forme `
   + `pour elle — elle n'est donc éprouvée nulle part. Ajouter ses deux valeurs vivantes ici.`);
}

// ── A. LE TÉMOIN NON NUL — une clé écrite UNE FOIS passe, et l'arbre la PORTE ─────────────────
// ⛔ Sans lui, « il refuse le doublon » ne se distingue pas de « il refuse la clé ». Et compiler ne
// suffit pas : une clé acceptée puis perdue en route serait verte ici et muette à l'arrivée.
for (const cle of CLES.filter((k) => FORMES[k])) {
  const [a, , reste] = FORMES[cle];
  const r = compiler(`${a} ${reste}`.trim());
  ok(r.ok, `A-témoin. '${cle}' écrite UNE FOIS doit COMPILER — reçu : ${r.err.slice(0, 80)}`);
  if (!r.ok) continue;
  const valeur = a.split('.')[1].replace(/\(.*/, '');
  const portee = (r.acteur.references || []).some((x) => x.name === valeur);
  ok(portee,
     `A-témoin. '${a}' compile mais n'arrive PAS dans l'arbre — refs : `
   + `${(r.acteur.references || []).map((x) => `${x.category}=${x.name}`).join(' · ')}. `
   + `Une clé acceptée puis perdue est le défaut que ce garde ferme, pas celui qu'il tolère.`);
}

// ── B. LA MATRICE — deux régimes, toutes les clés ─────────────────────────────────────────────
for (const [regime, second] of [['valeurs DIFFÉRENTES', 1], ['valeur IDENTIQUE', 0]]) {
  for (const cle of CLES.filter((k) => FORMES[k])) {
    const [a, b, reste] = FORMES[cle];
    const r = compiler(`${a} ${second ? b : a} ${reste}`.trim());
    ok(!r.ok,
       `B. ${regime} — '${cle}' déclarée deux fois doit être REFUSÉE. Elle est ACCEPTÉE : la `
     + `dernière gagne et la première est mangée, sans un mot.`);
    if (r.ok) continue;
    ok(/DEUX FOIS/.test(r.err),
       `B. ${regime} — le refus de '${cle}' doit dire ce qu'il refuse. Reçu : ${r.err.slice(0, 90)}`);
    // ⛔ LES DEUX DÉCLARATIONS, PAS SEULEMENT LA SECONDE : un refus qui ne nomme que la dernière
    // envoie l'auteur regarder l'écriture qu'il vient de faire, alors que c'est la PREMIÈRE qui
    // disparaissait en silence.
    const v1 = a.split('.')[1].replace(/\(.*/, '');
    const v2 = (second ? b : a).split('.')[1].replace(/\(.*/, '');
    ok(r.err.includes(v1) && r.err.includes(v2),
       `B. ${regime} — le refus de '${cle}' doit NOMMER LES DEUX déclarations ('${v1}' et '${v2}'). `
     + `Reçu : ${r.err.slice(0, 120)}`);
  }
}

// ── C. LE CORPS SUR PLUSIEURS LIGNES — le doublon s'y cache aussi ─────────────────────────────
// ⚠️ 9 des 93 blocs d'acteur du corpus s'écrivent sur plusieurs lignes. Un refus qui ne mordrait que
// sur une ligne unique laisserait passer la forme la plus difficile à relire.
{
  const src = 'core\ntempo:120\n\nactor lead\n  alphabet.western\n  alphabet.sargam\n  out.midi(ch:1)\n\n-----\nS -> -\n';
  let err = '';
  try {
    const r = compileToBPxAST(src, {});
    err = ((r.errors || [])[0] || {}).message || '';
  } catch (e) { err = e.message; }
  ok(/DEUX FOIS/.test(err),
     `C. un doublon réparti sur DEUX LIGNES doit être refusé comme sur une seule. Reçu : `
   + `${err.slice(0, 90) || '(accepté)'}`);
  ok(/ligne 5/.test(err) && /ligne 6/.test(err),
     `C. et le refus doit nommer LES DEUX lignes — 5 et 6. Reçu : ${err.slice(0, 130)}`);
}

// ── D. LA BORNE — deux clés DIFFÉRENTES ne se gênent pas ──────────────────────────────────────
// Sans elle, « il refuse le doublon » se confondrait avec « il refuse plus d'une clé ».
{
  const r = compiler('alphabet.western tuning.western_just octaves.arrows out.midi(ch:1)');
  ok(r.ok,
     `D-borne. quatre clés DIFFÉRENTES sur le même acteur doivent passer — le refus vise la `
   + `répétition d'UNE clé, pas la richesse de la déclaration. Reçu : ${r.err.slice(0, 80)}`);
}

// ── E. DEUX ACTEURS portent chacun la leur ────────────────────────────────────────────────────
// La table des clés écrites est par ACTEUR ; si elle fuyait d'un acteur à l'autre, deux acteurs
// normaux seraient refusés et le langage deviendrait inutilisable en polyphonie.
{
  const src = 'core\ntempo:120\n\nactor lead  alphabet.western  out.midi(ch:1)\n'
            + 'actor perc  alphabet.tabla    out.midi(ch:2)\n\n-----\nS -> -\n';
  let err = '';
  try { const r = compileToBPxAST(src, {}); err = ((r.errors || [])[0] || {}).message || ''; }
  catch (e) { err = e.message; }
  ok(err === '',
     `E-borne. DEUX acteurs portant chacun sa clé 'alphabet' doivent passer — la table est par `
   + `acteur. Reçu : ${err.slice(0, 90)}`);
}

if (echecs.length) {
  console.error(`❌ un acteur ne déclare pas deux fois la même clé : ${echecs.length} échec(s)`);
  for (const e of echecs) console.error(`   - ${e}`);
  process.exit(1);
}
console.log(`✅ un acteur ne déclare pas deux fois la même clé — les ${CLES.length} clés que la `
  + `donnée déclare, éprouvées dans les deux régimes, refus nommant les deux déclarations et leurs `
  + `lignes ; une clé seule passe et arrive dans l'arbre, quatre clés différentes cohabitent, et `
  + `deux acteurs gardent chacun la leur. ${passe} vérification(s) passée(s).`);
